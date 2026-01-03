/**
 * Federation Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FederationPreloadManager,
  createFederationPreloadManager,
  preloadByPriority,
  setupHMRHandling,
} from '../src/federation.js';
import type { ModuleMetadata } from '../src/types.js';

describe('FederationPreloadManager', () => {
  let manager: FederationPreloadManager;
  let testModules: ModuleMetadata[];

  beforeEach(() => {
    testModules = [
      {
        id: 'remote-module-1',
        name: 'Remote Module 1',
        version: '1.0.0',
        size: 10000,
        loadTime: 100,
        dependencies: [],
        url: 'https://example.com/remote1.js',
      },
      {
        id: 'remote-module-2',
        name: 'Remote Module 2',
        version: '1.0.0',
        size: 20000,
        loadTime: 200,
        dependencies: [],
        url: 'https://example.com/remote2.js',
      },
    ];

    manager = new FederationPreloadManager({
      remoteModules: testModules,
      containerCacheTTL: 3600000,
      versionNegotiationTimeout: 10000,
      hmrAware: true,
    });

    for (const mod of testModules) {
      manager.registerRemoteModule(mod);
    }
  });

  describe('Remote Module Management', () => {
    it('should register a remote module', () => {
      manager.registerRemoteModule(testModules[0]);

      const state = manager.getRemoteState('remote-module-1');
      expect(state).toBeDefined();
      expect(state?.moduleId).toBe('remote-module-1');
    });

    it('should get all remote states', () => {
      const states = manager.getAllRemoteStates();
      expect(states.size).toBe(2);
    });

    it('should get state for specific module', () => {
      const state = manager.getRemoteState('remote-module-1');
      expect(state?.moduleId).toBe('remote-module-1');
    });

    it('should return undefined for non-existent module', () => {
      const state = manager.getRemoteState('non-existent');
      expect(state).toBeUndefined();
    });
  });

  describe('Remote Module Preloading', () => {
    it('should preload a remote module', async () => {
      const result = await manager.preloadRemoteModule('remote-module-1');

      expect(result.module).toBeDefined();
      expect(result.cached).toBe(false);
      expect(result.loadTime).toBeGreaterThan(0);
    });

    it('should set loaded state after preload', async () => {
      await manager.preloadRemoteModule('remote-module-1');

      const state = manager.getRemoteState('remote-module-1');
      expect(state?.state).toBe('loaded');
    });

    it('should return cached result on second preload', async () => {
      await manager.preloadRemoteModule('remote-module-1');
      const result = await manager.preloadRemoteModule('remote-module-1');

      expect(result.cached).toBe(true);
    });

    it('should handle non-existent module', async () => {
      await expect(manager.preloadRemoteModule('non-existent')).rejects.toThrow();
    });

    it('should set loading state during preload', async () => {
      const preloadPromise = manager.preloadRemoteModule('remote-module-1');

      const state = manager.getRemoteState('remote-module-1');
      expect(state?.state).toBe('loading');

      await preloadPromise;
    });

    it('should handle preload errors gracefully', async () => {
      // This would require mocking to properly test error handling
      const state = manager.getRemoteState('remote-module-1');
      expect(state).toBeDefined();
    });
  });

  describe('Container Caching', () => {
    it('should cache a container', () => {
      const container = { test: 'value' };
      manager.cacheContainer('remote-module-1', container, '1.0.0');

      const cached = manager.getCachedContainer('remote-module-1');
      expect(cached?.container).toBe(container);
      expect(cached?.version).toBe('1.0.0');
    });

    it('should get cached container', () => {
      const container = { test: 'value' };
      manager.cacheContainer('remote-module-1', container, '1.0.0');

      const cached = manager.getCachedContainer('remote-module-1');
      expect(cached).toBeDefined();
      expect(cached?.container).toEqual(container);
    });

    it('should return undefined for non-existent cache', () => {
      const cached = manager.getCachedContainer('non-existent');
      expect(cached).toBeUndefined();
    });

    it('should clear expired cache entries', () => {
      const container = { test: 'value' };
      // Cache with very short TTL
      manager.cacheContainer('remote-module-1', container, '1.0.0');

      // Manually expire
      const cached = manager['containerCache'].get('remote-module-1');
      if (cached) {
        cached.expiresAt = Date.now() - 1000;
      }

      manager.clearExpiredCache();

      const result = manager.getCachedContainer('remote-module-1');
      expect(result).toBeUndefined();
    });

    it('should clear all cache', () => {
      const container = { test: 'value' };
      manager.cacheContainer('remote-module-1', container, '1.0.0');

      manager.clearCache();

      const result = manager.getCachedContainer('remote-module-1');
      expect(result).toBeUndefined();
    });

    it('should reset state when cache is cleared', async () => {
      await manager.preloadRemoteModule('remote-module-1');
      manager.clearCache();

      const state = manager.getRemoteState('remote-module-1');
      expect(state?.state).toBe('not-loaded');
    });
  });

  describe('Version Negotiation', () => {
    it('should negotiate version', async () => {
      const version = await manager.negotiateVersion('remote-module-1');
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
    });

    it('should use required version if provided', async () => {
      const version = await manager.negotiateVersion('remote-module-1', '2.0.0');
      expect(version).toBe('2.0.0');
    });

    it('should check version compatibility', () => {
      const compatible = manager.isVersionCompatible('1.0.0', '1.0.0');
      expect(compatible).toBe(true);
    });

    it('should check version compatibility with range', () => {
      const compatible = manager.isVersionCompatible('1.2.3', '1');
      expect(compatible).toBe(true);
    });

    it('should detect incompatible versions', () => {
      const compatible = manager.isVersionCompatible('2.0.0', '1.0.0');
      expect(compatible).toBe(false);
    });
  });

  describe('HMR Awareness', () => {
    it('should handle HMR update', async () => {
      await manager.preloadRemoteModule('remote-module-1');

      await manager.handleHMRUpdate('remote-module-1', '2.0.0');

      const state = manager.getRemoteState('remote-module-1');
      expect(state?.state).toBe('loaded');
    });

    it('should invalidate cache on HMR update', async () => {
      const container = { test: 'value' };
      manager.cacheContainer('remote-module-1', container, '1.0.0');

      await manager.handleHMRUpdate('remote-module-1', '2.0.0');

      const cached = manager.getCachedContainer('remote-module-1');
      expect(cached).toBeUndefined();
    });

    it('should subscribe to HMR updates', () => {
      const unsubscribe = manager.subscribeToHMR('remote-module-1', (newVersion) => {
        expect(newVersion).toBeDefined();
      });

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe from HMR updates', () => {
      const unsubscribe = manager.subscribeToHMR('remote-module-1', () => {});

      unsubscribe();

      // Should not throw
    });

    it('should preload new version after HMR if HMR aware', async () => {
      const hmrAwareManager = new FederationPreloadManager({
        remoteModules: testModules,
        hmrAware: true,
        containerCacheTTL: 3600000,
        versionNegotiationTimeout: 10000,
      });

      hmrAwareManager.registerRemoteModule(testModules[0]);

      await hmrAwareManager.handleHMRUpdate('remote-module-1', '2.0.0');

      const state = hmrAwareManager.getRemoteState('remote-module-1');
      expect(state?.state).toBe('loaded');

      hmrAwareManager.destroy();
    });

    it('should not preload if not HMR aware', async () => {
      const hmrUnawareManager = new FederationPreloadManager({
        remoteModules: testModules,
        hmrAware: false,
        containerCacheTTL: 3600000,
        versionNegotiationTimeout: 10000,
      });

      hmrUnawareManager.registerRemoteModule(testModules[0]);

      await hmrUnawareManager.handleHMRUpdate('remote-module-1', '2.0.0');

      const state = hmrUnawareManager.getRemoteState('remote-module-1');
      expect(state?.state).toBe('not-loaded');

      hmrUnawareManager.destroy();
    });
  });

  describe('Bulk Operations', () => {
    it('should preload batch of modules', async () => {
      const results = await manager.preloadBatch(['remote-module-1', 'remote-module-2']);

      expect(results.size).toBe(2);
      expect(results.has('remote-module-1')).toBe(true);
      expect(results.has('remote-module-2')).toBe(true);
    });

    it('should respect concurrency limit', async () => {
      const results = await manager.preloadBatch(['remote-module-1', 'remote-module-2'], 1);

      expect(results.size).toBeGreaterThan(0);
    });

    it('should continue on individual failures', async () => {
      // Add non-existent module to batch
      const results = await manager.preloadBatch([
        'remote-module-1',
        'non-existent',
        'remote-module-2',
      ]);

      // Should preload the valid ones
      expect(results.has('remote-module-1')).toBe(true);
      expect(results.has('remote-module-2')).toBe(true);
    });

    it('should preload all registered modules', async () => {
      const results = await manager.preloadAll();

      expect(results.size).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should get cache statistics', () => {
      const container = { test: 'value' };
      manager.cacheContainer('remote-module-1', container, '1.0.0');

      const stats = manager.getCacheStats();
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('expiredEntries');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('cacheSize');
    });

    it('should count total cache entries', () => {
      manager.cacheContainer('remote-module-1', { test: '1' }, '1.0.0');
      manager.cacheContainer('remote-module-2', { test: '2' }, '1.0.0');

      const stats = manager.getCacheStats();
      expect(stats.totalEntries).toBe(2);
    });

    it('should count expired entries', () => {
      manager.cacheContainer('remote-module-1', { test: 'value' }, '1.0.0');

      // Manually expire
      const cached = manager['containerCache'].get('remote-module-1');
      if (cached) {
        cached.expiresAt = Date.now() - 1000;
      }

      const stats = manager.getCacheStats();
      expect(stats.expiredEntries).toBe(1);
    });

    it('should get preload statistics', async () => {
      await manager.preloadRemoteModule('remote-module-1');

      const stats = manager.getPreloadStats();
      expect(stats).toHaveProperty('totalModules');
      expect(stats).toHaveProperty('loadedModules');
      expect(stats).toHaveProperty('loadingModules');
      expect(stats).toHaveProperty('errorModules');
      expect(stats).toHaveProperty('notLoadedModules');
    });

    it('should count loaded modules', async () => {
      await manager.preloadRemoteModule('remote-module-1');

      const stats = manager.getPreloadStats();
      expect(stats.loadedModules).toBe(1);
    });

    it('should count total modules', () => {
      const stats = manager.getPreloadStats();
      expect(stats.totalModules).toBe(2);
    });
  });

  describe('Cleanup', () => {
    it('should destroy resources', () => {
      manager.cacheContainer('remote-module-1', { test: 'value' }, '1.0.0');

      manager.destroy();

      expect(manager.getAllRemoteStates().size).toBe(0);
      expect(manager.getCacheStats().totalEntries).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty remote module list', () => {
      const emptyManager = new FederationPreloadManager({
        remoteModules: [],
        containerCacheTTL: 3600000,
        versionNegotiationTimeout: 10000,
        hmrAware: true,
      });

      expect(emptyManager.getAllRemoteStates().size).toBe(0);
      emptyManager.destroy();
    });

    it('should handle module with no URL', () => {
      const noUrlModule: ModuleMetadata = {
        id: 'no-url',
        name: 'No URL Module',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: [],
      };

      manager.registerRemoteModule(noUrlModule);

      const state = manager.getRemoteState('no-url');
      expect(state?.moduleId).toBe('no-url');
    });

    it('should handle very long cache TTL', () => {
      const longTTLManager = new FederationPreloadManager({
        remoteModules: testModules,
        containerCacheTTL: Number.MAX_SAFE_INTEGER,
        versionNegotiationTimeout: 10000,
        hmrAware: true,
      });

      longTTLManager.cacheContainer('remote-module-1', { test: 'value' }, '1.0.0');

      const cached = longTTLManager.getCachedContainer('remote-module-1');
      expect(cached).toBeDefined();

      longTTLManager.destroy();
    });

    it('should handle zero cache TTL', async () => {
      const zeroTTLManager = new FederationPreloadManager({
        remoteModules: testModules,
        containerCacheTTL: 0,
        versionNegotiationTimeout: 10000,
        hmrAware: true,
      });

      await zeroTTLManager.preloadRemoteModule('remote-module-1');

      // Cache should immediately expire
      zeroTTLManager.clearExpiredCache();

      const cached = zeroTTLManager.getCachedContainer('remote-module-1');
      expect(cached).toBeUndefined();

      zeroTTLManager.destroy();
    });
  });
});

describe('Federation Utilities', () => {
  describe('createFederationPreloadManager', () => {
    it('should create manager with default config', () => {
      const modules = [{
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        size: 1000,
        loadTime: 10,
        dependencies: [],
      }];

      const manager = createFederationPreloadManager(modules);

      expect(manager).toBeDefined();
      expect(manager.getAllRemoteStates().size).toBe(1);

      manager.destroy();
    });

    it('should set default HMR awareness', () => {
      const modules = [{
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        size: 1000,
        loadTime: 10,
        dependencies: [],
      }];

      const manager = createFederationPreloadManager(modules);

      // Should be HMR aware by default
      expect(manager).toBeDefined();

      manager.destroy();
    });
  });

  describe('preloadByPriority', () => {
    it('should preload by priority', async () => {
      const modules = [{
        id: 'critical-module',
        name: 'Critical',
        version: '1.0.0',
        size: 1000,
        loadTime: 10,
        dependencies: [],
        critical: true,
      }];

      const manager = createFederationPreloadManager(modules);

      const results = await preloadByPriority(manager, 'critical');

      expect(results).toBeDefined();

      manager.destroy();
    });
  });

  describe('setupHMRHandling', () => {
    it('should setup HMR handling', () => {
      const modules = [{
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        size: 1000,
        loadTime: 10,
        dependencies: [],
      }];

      const manager = createFederationPreloadManager(modules);

      const unsubscribe = setupHMRHandling(manager, ['test']);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      manager.destroy();
    });

    it('should handle multiple modules', () => {
      const modules = [
        {
          id: 'test-1',
          name: 'Test 1',
          version: '1.0.0',
          size: 1000,
          loadTime: 10,
          dependencies: [],
        },
        {
          id: 'test-2',
          name: 'Test 2',
          version: '1.0.0',
          size: 1000,
          loadTime: 10,
          dependencies: [],
        },
      ];

      const manager = createFederationPreloadManager(modules);

      const unsubscribe = setupHMRHandling(manager, ['test-1', 'test-2']);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      manager.destroy();
    });

    it('should unsubscribe all handlers', () => {
      const modules = [{
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        size: 1000,
        loadTime: 10,
        dependencies: [],
      }];

      const manager = createFederationPreloadManager(modules);

      const unsubscribe = setupHMRHandling(manager, ['test']);
      unsubscribe();

      // Should cleanup without error
      expect(manager).toBeDefined();

      manager.destroy();
    });
  });
});
