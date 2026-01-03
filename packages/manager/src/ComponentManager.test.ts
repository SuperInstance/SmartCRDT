/**
 * @lsi/manager - Component Manager Tests
 *
 * Comprehensive test suite for component lifecycle management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentManager, ComponentState } from './ComponentManager.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import { tmpdir } from 'os';

// Test utilities
let testCacheDir: string;
let testConfig: any;

function createTestConfig() {
  const cacheDir = path.join(tmpdir(), `aequor-test-${Date.now()}`);
  return {
    registry_url: 'https://registry.aequor.dev',
    cache_path: cacheDir,
    components_path: path.join(cacheDir, 'components'),
    config_path: path.join(cacheDir, 'config'),
    max_cache_size: 1024 * 1024 * 1024, // 1GB
    auto_update: false,
    hardware_profile: 'medium' as const,
    concurrent_downloads: 3,
    timeout: 30000,
  };
}

async function setupTestEnvironment() {
  testConfig = createTestConfig();
  testCacheDir = testConfig.cache_path;
  await fs.ensureDir(testCacheDir);
  await fs.ensureDir(testConfig.components_path);
  await fs.ensureDir(testConfig.config_path);
}

async function cleanupTestEnvironment() {
  if (testCacheDir && await fs.pathExists(testCacheDir)) {
    await fs.remove(testCacheDir);
  }
}

describe('ComponentManager', () => {
  let manager: ComponentManager;

  beforeEach(async () => {
    await setupTestEnvironment();
    manager = new ComponentManager(testConfig);
    await manager.initialize();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(manager).toBeDefined();
      expect(await fs.pathExists(testCacheDir)).toBe(true);
      expect(await fs.pathExists(testConfig.components_path)).toBe(true);
      expect(await fs.pathExists(testConfig.config_path)).toBe(true);
    });

    it('should create required directories', async () => {
      const downloadsPath = path.join(testCacheDir, 'downloads');
      const archivesPath = path.join(testCacheDir, 'archives');
      const tempPath = path.join(testCacheDir, 'temp');

      expect(await fs.pathExists(downloadsPath)).toBe(true);
      expect(await fs.pathExists(archivesPath)).toBe(true);
      expect(await fs.pathExists(tempPath)).toBe(true);
    });

    it('should create state database', async () => {
      const statePath = path.join(testConfig.config_path, 'state.yaml');
      expect(await fs.pathExists(statePath)).toBe(true);
    });
  });

  describe('Pull Flow', () => {
    it('should pull component from registry', async () => {
      // Mock fetchManifest to return test manifest
      vi.spyOn(manager as any, 'fetchManifest').mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        description: 'Test component',
        type: 'routing',
        language: 'typescript',
        dependencies: {},
        checksum: 'abc123',
        size_bytes: 1024,
        download_url: 'https://example.com/test-component.tar.gz',
      });

      // Mock downloadComponent
      vi.spyOn(manager as any, 'downloadComponent').mockResolvedValue('/tmp/test.tar.gz');

      // Mock verifyChecksum
      vi.spyOn(manager as any, 'verifyChecksum').mockResolvedValue(true);

      // Mock extractComponent
      vi.spyOn(manager as any, 'extractComponent').mockResolvedValue('/tmp/extracted');

      // Mock install
      vi.spyOn(manager as any, 'installDependencies').mockResolvedValue(undefined);
      vi.spyOn(manager as any, 'configureComponent').mockResolvedValue(undefined);

      const state = await manager.pull('test-component', '1.0.0');

      expect(state).toBeDefined();
      expect(state.name).toBe('test-component');
      expect(state.version).toBe('1.0.0');
      expect(state.status).toBe('installed');
    });

    it('should handle pull errors gracefully', async () => {
      vi.spyOn(manager as any, 'fetchManifest').mockRejectedValue(
        new Error('Network error')
      );

      await expect(manager.pull('test-component')).rejects.toThrow('Network error');
    });

    it('should verify checksums during pull', async () => {
      vi.spyOn(manager as any, 'fetchManifest').mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        description: 'Test component',
        type: 'routing',
        language: 'typescript',
        dependencies: {},
        checksum: 'abc123',
        size_bytes: 1024,
        download_url: 'https://example.com/test-component.tar.gz',
      });

      vi.spyOn(manager as any, 'downloadComponent').mockResolvedValue('/tmp/test.tar.gz');

      vi.spyOn(manager as any, 'verifyChecksum').mockResolvedValue(false);

      await expect(manager.pull('test-component')).rejects.toThrow('Checksum mismatch');
    });
  });

  describe('Install Flow', () => {
    it('should install downloaded component', async () => {
      // Create component state
      const state: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'downloaded',
        path: '/tmp/test-component',
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: [],
      };

      // Add to database
      (manager as any).db.set('test-component', '1.0.0', state);

      vi.spyOn(manager as any, 'installDependencies').mockResolvedValue(undefined);
      vi.spyOn(manager as any, 'configureComponent').mockResolvedValue(undefined);

      await manager.install('test-component', '1.0.0');

      const updatedState = (manager as any).db.get('test-component', '1.0.0');
      expect(updatedState.status).toBe('installed');
    });

    it('should install dependencies before component', async () => {
      const state: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'downloaded',
        path: '/tmp/test-component',
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: ['dep1', 'dep2'],
      };

      (manager as any).db.set('test-component', '1.0.0', state);

      const installSpy = vi.spyOn(manager as any, 'installDependencies').mockResolvedValue(undefined);
      vi.spyOn(manager as any, 'configureComponent').mockResolvedValue(undefined);

      await manager.install('test-component', '1.0.0');

      expect(installSpy).toHaveBeenCalledWith(['dep1', 'dep2']);
    });
  });

  describe('Run Flow', () => {
    it('should run installed component', async () => {
      const componentPath = path.join(testConfig.components_path, 'test-component', '1.0.0');
      await fs.ensureDir(path.join(componentPath, 'dist'));
      await fs.writeFile(
        path.join(componentPath, 'dist', 'index.js'),
        'console.log("Hello from component");'
      );

      const state: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: componentPath,
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: [],
      };

      (manager as any).db.set('test-component', '1.0.0', state);

      const process = await manager.run('test-component');

      expect(process).toBeDefined();
      expect(process.pid).toBeGreaterThan(0);
    });

    it('should update last_used timestamp when running', async () => {
      const componentPath = path.join(testConfig.components_path, 'test-component', '1.0.0');
      await fs.ensureDir(path.join(componentPath, 'dist'));
      await fs.writeFile(
        path.join(componentPath, 'dist', 'index.js'),
        'console.log("Hello"); process.exit(0);'
      );

      const oldDate = new Date('2025-01-01');
      const state: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: componentPath,
        size_bytes: 1024,
        installed_at: oldDate,
        last_used: oldDate,
        checksum: 'abc123',
        dependencies: [],
      };

      (manager as any).db.set('test-component', '1.0.0', state);

      await manager.run('test-component');

      const updatedState = (manager as any).db.get('test-component', '1.0.0');
      expect(updatedState.last_used.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should throw error if component not installed', async () => {
      await expect(manager.run('non-existent')).rejects.toThrow('not found');
    });
  });

  describe('Update Flow', () => {
    it('should update component to new version', async () => {
      const oldState: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: '/tmp/old',
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: [],
      };

      (manager as any).db.set('test-component', '1.0.0', oldState);

      vi.spyOn(manager as any, 'fetchManifest').mockResolvedValue({
        name: 'test-component',
        version: '2.0.0',
        description: 'Test component',
        type: 'routing',
        language: 'typescript',
        dependencies: {},
        checksum: 'def456',
        size_bytes: 2048,
        download_url: 'https://example.com/test-component-2.0.0.tar.gz',
      });

      vi.spyOn(manager as any, 'downloadComponent').mockResolvedValue('/tmp/test-2.0.0.tar.gz');
      vi.spyOn(manager as any, 'verifyChecksum').mockResolvedValue(true);
      vi.spyOn(manager as any, 'extractComponent').mockResolvedValue('/tmp/extracted-2.0.0');
      vi.spyOn(manager as any, 'installDependencies').mockResolvedValue(undefined);
      vi.spyOn(manager as any, 'configureComponent').mockResolvedValue(undefined);

      const newState = await manager.update('test-component', '2.0.0');

      expect(newState.version).toBe('2.0.0');
      expect(newState.status).toBe('installed');
    });

    it('should keep old version if update fails', async () => {
      const oldState: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: '/tmp/old',
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: [],
      };

      (manager as any).db.set('test-component', '1.0.0', oldState);

      vi.spyOn(manager as any, 'fetchManifest').mockRejectedValue(new Error('Download failed'));

      await expect(manager.update('test-component', '2.0.0')).rejects.toThrow();

      const savedState = (manager as any).db.get('test-component', '1.0.0');
      expect(savedState.version).toBe('1.0.0');
    });
  });

  describe('Remove Flow', () => {
    it('should remove installed component', async () => {
      const componentPath = path.join(testConfig.components_path, 'test-component', '1.0.0');
      await fs.ensureDir(componentPath);

      const state: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: componentPath,
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: [],
      };

      (manager as any).db.set('test-component', '1.0.0', state);

      await manager.remove('test-component', '1.0.0');

      expect(await fs.pathExists(componentPath)).toBe(false);
      expect((manager as any).db.get('test-component', '1.0.0')).toBeUndefined();
    });

    it('should not remove component with dependents', async () => {
      vi.spyOn(manager as any, 'findDependents').mockResolvedValue(['dependent-component']);

      const state: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: '/tmp/test',
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: [],
      };

      (manager as any).db.set('test-component', '1.0.0', state);

      await expect(manager.remove('test-component')).rejects.toThrow('depended on by');
    });
  });

  describe('Query Operations', () => {
    it('should list all installed components', async () => {
      const state1: ComponentState = {
        name: 'component1',
        version: '1.0.0',
        status: 'installed',
        path: '/tmp/c1',
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: [],
      };

      const state2: ComponentState = {
        name: 'component2',
        version: '2.0.0',
        status: 'installed',
        path: '/tmp/c2',
        size_bytes: 2048,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'def456',
        dependencies: [],
      };

      (manager as any).db.set('component1', '1.0.0', state1);
      (manager as any).db.set('component2', '2.0.0', state2);

      const components = await manager.list();

      expect(components).toHaveLength(2);
      expect(components.map(c => c.name)).toContain('component1');
      expect(components.map(c => c.name)).toContain('component2');
    });

    it('should get component status', async () => {
      const state: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: '/tmp/test',
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: [],
      };

      (manager as any).db.set('test-component', '1.0.0', state);

      const status = await manager.status('test-component');

      expect(status).toBeDefined();
      expect(status.name).toBe('test-component');
      expect(status.status).toBe('installed');
    });
  });

  describe('Maintenance Operations', () => {
    it('should clean unused components', async () => {
      const oldDate = new Date('2025-01-01');
      const recentDate = new Date();

      const oldComponent: ComponentState = {
        name: 'old-component',
        version: '1.0.0',
        status: 'installed',
        path: '/tmp/old',
        size_bytes: 1024,
        installed_at: oldDate,
        last_used: oldDate,
        checksum: 'abc123',
        dependencies: [],
      };

      const recentComponent: ComponentState = {
        name: 'recent-component',
        version: '1.0.0',
        status: 'installed',
        path: '/tmp/recent',
        size_bytes: 1024,
        installed_at: recentDate,
        last_used: recentDate,
        checksum: 'def456',
        dependencies: [],
      };

      (manager as any).db.set('old-component', '1.0.0', oldComponent);
      (manager as any).db.set('recent-component', '1.0.0', recentComponent);

      vi.spyOn(manager as any, 'remove').mockResolvedValue(undefined);

      const removed = await manager.clean({
        older_than: new Date('2025-06-01'),
      });

      expect(removed).toHaveLength(1);
      expect(removed[0].name).toBe('old-component');
    });

    it('should verify component integrity', async () => {
      const state: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: '/tmp/test',
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: [],
      };

      (manager as any).db.set('test-component', '1.0.0', state);

      vi.spyOn(manager as any, 'verifyChecksum').mockResolvedValue(true);
      vi.spyOn(manager as any, 'verifyDependencies').mockResolvedValue(true);

      const result = await manager.verify('test-component');

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should repair corrupted component', async () => {
      const state: ComponentState = {
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: '/tmp/test',
        size_bytes: 1024,
        installed_at: new Date(),
        last_used: new Date(),
        checksum: 'abc123',
        dependencies: ['dep1'],
      };

      (manager as any).db.set('test-component', '1.0.0', state);

      vi.spyOn(manager, 'verify').mockResolvedValue({
        name: 'test-component',
        valid: false,
        issues: ['Checksum mismatch'],
        checksum_valid: false,
        dependencies_valid: false,
        configuration_valid: true,
      });

      vi.spyOn(manager as any, 'pull').mockResolvedValue(state);
      vi.spyOn(manager as any, 'installDependencies').mockResolvedValue(undefined);
      vi.spyOn(manager as any, 'configureComponent').mockResolvedValue(undefined);

      const result = await manager.repair('test-component');

      expect(result.success).toBe(true);
      expect(result.issues_fixed).toContain('Checksum mismatch fixed');
    });
  });

  describe('Event Handling', () => {
    it('should emit state change events', async () => {
      const callback = vi.fn();
      manager.on('stateChange', callback);

      manager['emit']('stateChange', {
        type: 'stateChange',
        component: 'test-component',
        data: { status: 'pulling' },
        timestamp: new Date(),
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should emit error events', async () => {
      const callback = vi.fn();
      manager.on('error', callback);

      manager['emit']('error', {
        type: 'error',
        component: 'test-component',
        data: { error: 'Test error' },
        timestamp: new Date(),
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should emit progress events', async () => {
      const callback = vi.fn();
      manager.on('progress', callback);

      manager['emit']('progress', {
        type: 'progress',
        component: 'test-component',
        version: '1.0.0',
        data: {
          name: 'test-component',
          version: '1.0.0',
          downloaded_bytes: 512,
          total_bytes: 1024,
          progress: 50,
          speed: 1024,
          eta: 1,
          status: 'Downloading',
        },
        timestamp: new Date(),
      });

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent pulls of different components', async () => {
      vi.spyOn(manager as any, 'fetchManifest').mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        description: 'Test',
        type: 'routing',
        language: 'typescript',
        dependencies: {},
        checksum: 'abc123',
        size_bytes: 1024,
        download_url: 'https://example.com/test.tar.gz',
      });

      vi.spyOn(manager as any, 'downloadComponent').mockResolvedValue('/tmp/test.tar.gz');
      vi.spyOn(manager as any, 'verifyChecksum').mockResolvedValue(true);
      vi.spyOn(manager as any, 'extractComponent').mockResolvedValue('/tmp/extracted');
      vi.spyOn(manager as any, 'installDependencies').mockResolvedValue(undefined);
      vi.spyOn(manager as any, 'configureComponent').mockResolvedValue(undefined);

      const results = await Promise.all([
        manager.pull('component1'),
        manager.pull('component2'),
        manager.pull('component3'),
      ]);

      expect(results).toHaveLength(3);
    });

    it('should prevent concurrent operations on same component', async () => {
      const lockManager = (manager as any).lockManager;

      await lockManager.acquire('test-component');

      const locked = await lockManager.acquire('test-component', 1000);

      expect(locked).toBe(false);

      await lockManager.release('test-component');
    });
  });
});
