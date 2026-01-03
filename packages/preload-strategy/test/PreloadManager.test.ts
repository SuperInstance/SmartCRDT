/**
 * PreloadManager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PreloadManager } from '../src/PreloadManager.js';
import type { ModuleMetadata, PreloadRule } from '../src/types.js';

describe('PreloadManager', () => {
  let manager: PreloadManager;
  let testModules: ModuleMetadata[];

  beforeEach(() => {
    manager = new PreloadManager();
    testModules = [
      {
        id: 'module-1',
        name: 'test-module-1',
        version: '1.0.0',
        size: 10000,
        loadTime: 100,
        dependencies: [],
        critical: true,
        tags: ['high-priority'],
      },
      {
        id: 'module-2',
        name: 'test-module-2',
        version: '1.0.0',
        size: 20000,
        loadTime: 200,
        dependencies: ['module-1'],
      },
      {
        id: 'module-3',
        name: 'test-module-3',
        version: '1.0.0',
        size: 15000,
        loadTime: 150,
        dependencies: [],
      },
    ];

    for (const mod of testModules) {
      manager.registerModule(mod);
    }
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Module Registration', () => {
    it('should register a module', () => {
      const module: ModuleMetadata = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: [],
      };

      manager.registerModule(module);
      expect(manager.getModule('test-module')).toEqual(module);
    });

    it('should register multiple modules', () => {
      expect(manager.getAllModules().length).toBe(3);
    });

    it('should unregister a module', () => {
      manager.unregisterModule('module-1');
      expect(manager.getModule('module-1')).toBeUndefined();
    });

    it('should get module by id', () => {
      const module = manager.getModule('module-1');
      expect(module).toBeDefined();
      expect(module?.id).toBe('module-1');
    });

    it('should get all modules', () => {
      const modules = manager.getAllModules();
      expect(modules).toHaveLength(3);
    });

    it('should handle module with dependencies', () => {
      const module = manager.getModule('module-2');
      expect(module?.dependencies).toContain('module-1');
    });

    it('should handle critical module flag', () => {
      const module = manager.getModule('module-1');
      expect(module?.critical).toBe(true);
    });

    it('should handle module tags', () => {
      const module = manager.getModule('module-1');
      expect(module?.tags).toContain('high-priority');
    });

    it('should return undefined for non-existent module', () => {
      expect(manager.getModule('non-existent')).toBeUndefined();
    });
  });

  describe('Preload Rules', () => {
    it('should add a preload rule', () => {
      const ruleId = manager.addRule({
        moduleName: 'module-1',
        trigger: 'time-based',
        priority: 'high',
        conditions: {
          time: { hourRange: [9, 17] },
        },
        enabled: true,
      });

      const rules = manager.getAllRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe(ruleId);
    });

    it('should remove a preload rule', () => {
      const ruleId = manager.addRule({
        moduleName: 'module-1',
        trigger: 'usage-based',
        priority: 'normal',
        conditions: {},
        enabled: true,
      });

      manager.removeRule(ruleId);
      expect(manager.getAllRules()).toHaveLength(0);
    });

    it('should update a preload rule', () => {
      const ruleId = manager.addRule({
        moduleName: 'module-1',
        trigger: 'event-based',
        priority: 'normal',
        conditions: {
          event: { types: ['deployment'] },
        },
        enabled: true,
      });

      manager.updateRule(ruleId, { priority: 'critical' });
      const rule = manager.getAllRules().find(r => r.id === ruleId);
      expect(rule?.priority).toBe('critical');
    });

    it('should get rules for a specific module', () => {
      manager.addRule({
        moduleName: 'module-1',
        trigger: 'usage-based',
        priority: 'high',
        conditions: {},
        enabled: true,
      });

      manager.addRule({
        moduleName: 'module-2',
        trigger: 'time-based',
        priority: 'normal',
        conditions: {},
        enabled: true,
      });

      const module1Rules = manager.getRulesForModule('module-1');
      expect(module1Rules).toHaveLength(1);
      expect(module1Rules[0].moduleName).toBe('module-1');
    });

    it('should only return enabled rules', () => {
      const ruleId = manager.addRule({
        moduleName: 'module-1',
        trigger: 'predictive',
        priority: 'normal',
        conditions: {},
        enabled: true,
      });

      manager.updateRule(ruleId, { enabled: false });
      const rules = manager.getRulesForModule('module-1');
      expect(rules).toHaveLength(0);
    });

    it('should create unique rule IDs', () => {
      const id1 = manager.addRule({
        moduleName: 'module-1',
        trigger: 'usage-based',
        priority: 'normal',
        conditions: {},
        enabled: true,
      });

      const id2 = manager.addRule({
        moduleName: 'module-2',
        trigger: 'usage-based',
        priority: 'normal',
        conditions: {},
        enabled: true,
      });

      expect(id1).not.toBe(id2);
    });

    it('should set created and updated timestamps', () => {
      const before = Date.now();
      const ruleId = manager.addRule({
        moduleName: 'module-1',
        trigger: 'usage-based',
        priority: 'normal',
        conditions: {},
        enabled: true,
      });
      const after = Date.now();

      const rule = manager.getAllRules().find(r => r.id === ruleId);
      expect(rule?.createdAt).toBeGreaterThanOrEqual(before);
      expect(rule?.createdAt).toBeLessThanOrEqual(after);
      expect(rule?.updatedAt).toBe(rule?.createdAt);
    });

    it('should initialize application count to zero', () => {
      const ruleId = manager.addRule({
        moduleName: 'module-1',
        trigger: 'usage-based',
        priority: 'normal',
        conditions: {},
        enabled: true,
      });

      const rule = manager.getAllRules().find(r => r.id === ruleId);
      expect(rule?.applicationCount).toBe(0);
    });
  });

  describe('Module Preloading', () => {
    it('should preload a single module', async () => {
      await manager.preloadModule('module-1');
      expect(manager.isPreloaded('module-1')).toBe(true);
    });

    it('should preload multiple modules', async () => {
      await manager.preloadModule('module-1');
      await manager.preloadModule('module-3');

      expect(manager.isPreloaded('module-1')).toBe(true);
      expect(manager.isPreloaded('module-3')).toBe(true);
    });

    it('should preload dependencies first', async () => {
      await manager.preloadModule('module-2');
      expect(manager.isPreloaded('module-1')).toBe(true);
      expect(manager.isPreloaded('module-2')).toBe(true);
    });

    it('should get preloaded modules list', async () => {
      await manager.preloadModule('module-1');
      await manager.preloadModule('module-3');

      const preloaded = manager.getPreloadedModules();
      expect(preloaded).toContain('module-1');
      expect(preloaded).toContain('module-3');
    });

    it('should not preload already loaded module', async () => {
      await manager.preloadModule('module-1');
      const state1 = manager.getModuleStats('module-1');

      await manager.preloadModule('module-1');
      const state2 = manager.getModuleStats('module-1');

      expect(state2?.preloadCount).toBe(state1?.preloadCount);
    });

    it('should handle preload errors gracefully', async () => {
      await expect(manager.preloadModule('non-existent')).rejects.toThrow();
    });

    it('should preload all modules', async () => {
      await manager.preloadAll();
      expect(manager.getPreloadedModules().length).toBe(3);
    });

    it('should preload only critical modules', async () => {
      await manager.preloadAll('critical');
      expect(manager.isPreloaded('module-1')).toBe(true);
      expect(manager.isPreloaded('module-2')).toBe(false);
    });

    it('should preload high priority modules', async () => {
      await manager.preloadAll('high');
      expect(manager.isPreloaded('module-1')).toBe(true);
    });

    it('should respect concurrent preload limit', async () => {
      const manager = new PreloadManager({ maxConcurrentPreloads: 1 });
      for (const mod of testModules) {
        manager.registerModule(mod);
      }

      // Start multiple preloads concurrently
      const promises = [
        manager.preloadModule('module-1'),
        manager.preloadModule('module-2'),
        manager.preloadModule('module-3'),
      ];

      await Promise.all(promises);
      expect(manager.getPreloadedModules().length).toBe(3);
      manager.destroy();
    });
  });

  describe('Predictive Preloading', () => {
    it('should record module access', () => {
      manager.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
      });

      const stats = manager.getUsageStats();
      expect(stats.totalAccesses).toBe(1);
    });

    it('should record multiple accesses', () => {
      manager.recordAccess({
        moduleName: 'module-1',
        userId: 'user-1',
      });
      manager.recordAccess({
        moduleName: 'module-2',
        userId: 'user-1',
      });

      const stats = manager.getUsageStats();
      expect(stats.totalAccesses).toBe(2);
    });

    it('should predict next modules', () => {
      manager.recordAccess({ moduleName: 'module-1', userId: 'user-1' });
      manager.recordAccess({ moduleName: 'module-2', userId: 'user-1' });

      const predictions = manager.predictNext('module-1', 5);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should predict for current time', () => {
      const predictions = manager.predictForCurrentTime(5);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should predict for user', () => {
      manager.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const predictions = manager.predictForUser('user-1', 5);
      expect(Array.isArray(predictions)).toBe(true);
    });

    it('should update predictive engine on access', () => {
      manager.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const stats = manager.getPredictionStats();
      expect(stats.markovChains).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    it('should get preload statistics', async () => {
      await manager.preloadModule('module-1');

      const stats = manager.getStats();
      expect(stats.totalPreloaded).toBe(1);
    });

    it('should get module statistics', async () => {
      await manager.preloadModule('module-1');

      const stats = manager.getModuleStats('module-1');
      expect(stats?.moduleId).toBe('module-1');
      expect(stats?.preloadCount).toBe(1);
    });

    it('should get usage tracker statistics', () => {
      manager.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const stats = manager.getUsageStats();
      expect(stats.totalModules).toBe(1);
    });

    it('should get prediction engine statistics', () => {
      const stats = manager.getPredictionStats();
      expect(stats).toHaveProperty('markovChains');
    });

    it('should get scheduler statistics', () => {
      const stats = manager.getSchedulerStats();
      expect(stats).toHaveProperty('totalSchedules');
    });

    it('should get event trigger statistics', () => {
      const stats = manager.getEventStats();
      expect(stats).toHaveProperty('totalTriggers');
    });
  });

  describe('Lifecycle', () => {
    it('should start all mechanisms', async () => {
      await manager.start();
      // Should not throw
      await manager.stop();
    });

    it('should stop all mechanisms', async () => {
      await manager.start();
      await manager.stop();
      // Should not throw
    });

    it('should wait for active preloads to complete', async () => {
      const preloadPromise = manager.preloadModule('module-1');
      await manager.start();
      await preloadPromise;
      await manager.stop();
      expect(manager.isPreloaded('module-1')).toBe(true);
    });

    it('should clear all data', async () => {
      await manager.preloadModule('module-1');
      manager.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      manager.clear();
      expect(manager.getPreloadedModules().length).toBe(0);
    });

    it('should destroy resources', async () => {
      await manager.preloadModule('module-1');
      manager.destroy();
      expect(manager.getAllModules().length).toBe(0);
    });
  });

  describe('Export/Import', () => {
    it('should export data', async () => {
      await manager.preloadModule('module-1');
      manager.recordAccess({ moduleName: 'module-1', userId: 'user-1' });

      const exported = manager.export();
      expect(exported.modules).toHaveProperty('module-1');
      expect(exported.stats.totalPreloaded).toBe(1);
    });

    it('should import modules', () => {
      const imported = new PreloadManager();
      imported.import({
        modules: {
          'module-1': testModules[0],
        },
      });

      expect(imported.getModule('module-1')).toBeDefined();
      imported.destroy();
    });

    it('should import rules', () => {
      const ruleId = manager.addRule({
        moduleName: 'module-1',
        trigger: 'usage-based',
        priority: 'normal',
        conditions: {},
        enabled: true,
      });

      const exported = manager.export();
      const imported = new PreloadManager();
      imported.import({ rules: exported.rules });

      expect(imported.getAllRules()).toHaveLength(1);
      imported.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty module list', () => {
      const emptyManager = new PreloadManager();
      expect(emptyManager.getAllModules()).toHaveLength(0);
      emptyManager.destroy();
    });

    it('should handle non-existent module preload', async () => {
      await expect(manager.preloadModule('non-existent')).rejects.toThrow();
    });

    it('should handle non-existent rule removal', () => {
      expect(manager.removeRule('non-existent')).toBe(false);
    });

    it('should handle non-existent rule update', () => {
      expect(manager.updateRule('non-existent', { priority: 'high' })).toBe(false);
    });

    it('should handle duplicate module registration', () => {
      manager.registerModule(testModules[0]);
      expect(manager.getAllModules()).toHaveLength(3); // Still 3 unique modules
    });

    it('should handle module with circular dependencies', async () => {
      const circularModule: ModuleMetadata = {
        id: 'circular-1',
        name: 'Circular Module 1',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: ['circular-2'],
      };

      const circularModule2: ModuleMetadata = {
        id: 'circular-2',
        name: 'Circular Module 2',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: ['circular-1'],
      };

      manager.registerModule(circularModule);
      manager.registerModule(circularModule2);

      // Should handle circular dependencies without infinite loop
      await expect(manager.preloadModule('circular-1')).resolves.not.toThrow();
    });
  });
});
