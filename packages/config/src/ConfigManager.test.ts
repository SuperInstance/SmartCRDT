/**
 * @lsi/config - Config Manager Tests
 *
 * Comprehensive test suite for configuration management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager, createConfigManager, detectHardwareProfile, formatConfig } from './ConfigManager.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import YAML from 'yaml';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let testConfigPath: string;
  let testCacheDir: string;

  beforeEach(async () => {
    testCacheDir = path.join(os.tmpdir(), `aequor-config-test-${Date.now()}`);
    testConfigPath = path.join(testCacheDir, 'config.yaml');
    await fs.ensureDir(testCacheDir);
    await fs.ensureDir(path.join(testCacheDir, 'components'));
    await fs.ensureDir(path.join(testCacheDir, 'config'));
  });

  afterEach(async () => {
    if (testCacheDir && await fs.pathExists(testCacheDir)) {
      await fs.remove(testCacheDir);
    }
  });

  describe('Initialization', () => {
    it('should initialize with default path', () => {
      const manager = new ConfigManager();
      expect(manager).toBeDefined();
    });

    it('should initialize with custom path', () => {
      const manager = new ConfigManager(testConfigPath);
      expect(manager).toBeDefined();
    });
  });

  describe('Load Configuration', () => {
    it('should create default config if file does not exist', async () => {
      const manager = new ConfigManager(testConfigPath);
      const config = await manager.load();

      expect(config).toBeDefined();
      expect(config.registry_url).toBe('https://registry.aequor.dev');
      expect(config.cache_path).toBeDefined();
      expect(config.components_path).toBeDefined();
    });

    it('should load existing configuration', async () => {
      const testConfig = {
        registry_url: 'https://custom-registry.com',
        cache_path: '/custom/cache',
        components_path: '/custom/components',
        config_path: '/custom/config',
        max_cache_size: 2048000000,
        auto_update: true,
        hardware_profile: 'high' as const,
        concurrent_downloads: 5,
        timeout: 60000,
        log_level: 'debug' as const,
        telemetry_enabled: false,
      };

      await fs.writeFile(testConfigPath, YAML.stringify(testConfig));

      const manager = new ConfigManager(testConfigPath);
      const config = await manager.load();

      expect(config.registry_url).toBe('https://custom-registry.com');
      expect(config.auto_update).toBe(true);
      expect(config.hardware_profile).toBe('high');
    });

    it('should merge with defaults on partial config', async () => {
      const partialConfig = {
        registry_url: 'https://custom-registry.com',
        auto_update: true,
      };

      await fs.writeFile(testConfigPath, YAML.stringify(partialConfig));

      const manager = new ConfigManager(testConfigPath);
      const config = await manager.load();

      expect(config.registry_url).toBe('https://custom-registry.com');
      expect(config.auto_update).toBe(true);
      expect(config.hardware_profile).toBe('medium'); // Default
    });

    it('should apply environment variable overrides', async () => {
      process.env.AEQUOR_REGISTRY_URL = 'https://env-registry.com';
      process.env.AEQUOR_AUTO_UPDATE = 'true';
      process.env.AEQUOR_HARDWARE_PROFILE = 'high';

      const manager = new ConfigManager(testConfigPath);
      const config = await manager.load();

      expect(config.registry_url).toBe('https://env-registry.com');
      expect(config.auto_update).toBe(true);
      expect(config.hardware_profile).toBe('high');

      delete process.env.AEQUOR_REGISTRY_URL;
      delete process.env.AEQUOR_AUTO_UPDATE;
      delete process.env.AEQUOR_HARDWARE_PROFILE;
    });

    it('should handle proxy environment variables', async () => {
      process.env.HTTP_PROXY = 'http://proxy.example.com:8080';
      process.env.HTTPS_PROXY = 'https://proxy.example.com:8443';
      process.env.NO_PROXY = 'localhost,127.0.0.1';

      const manager = new ConfigManager(testConfigPath);
      const config = await manager.load();

      expect(config.proxy).toBeDefined();
      expect(config.proxy!.http_proxy).toBe('http://proxy.example.com:8080');
      expect(config.proxy!.https_proxy).toBe('https://proxy.example.com:8443');
      expect(config.proxy!.no_proxy).toEqual(['localhost', '127.0.0.1']);

      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
      delete process.env.NO_PROXY;
    });

    it('should handle auth environment variables', async () => {
      process.env.AEQUOR_AUTH_TOKEN = 'test-token-123';
      process.env.AEQUOR_AUTH_USERNAME = 'testuser';

      const manager = new ConfigManager(testConfigPath);
      const config = await manager.load();

      expect(config.auth).toBeDefined();
      expect(config.auth!.token).toBe('test-token-123');
      expect(config.auth!.username).toBe('testuser');

      delete process.env.AEQUOR_AUTH_TOKEN;
      delete process.env.AEQUOR_AUTH_USERNAME;
    });
  });

  describe('Save Configuration', () => {
    it('should save configuration to file', async () => {
      const manager = new ConfigManager(testConfigPath);
      const config = await manager.load();

      config.registry_url = 'https://saved-registry.com';
      config.auto_update = true;

      await manager.save(config);

      expect(await fs.pathExists(testConfigPath)).toBe(true);

      const content = await fs.readFile(testConfigPath, 'utf8');
      const savedConfig = YAML.parse(content);

      expect(savedConfig.registry_url).toBe('https://saved-registry.com');
      expect(savedConfig.auto_update).toBe(true);
    });

    it('should validate before saving', async () => {
      const manager = new ConfigManager(testConfigPath);
      const config = await manager.load();

      config.registry_url = 'invalid-url';

      await expect(manager.save(config)).rejects.toThrow('Invalid configuration');
    });
  });

  describe('Get and Set Values', () => {
    it('should get nested values', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      expect(manager.get('registry_url')).toBe('https://registry.aequor.dev');
      expect(manager.get('hardware_profile')).toBe('medium');
    });

    it('should set nested values', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      manager.set('registry_url', 'https://modified.com');
      manager.set('auto_update', true);

      expect(manager.get('registry_url')).toBe('https://modified.com');
      expect(manager.get('auto_update')).toBe(true);
    });

    it('should return undefined for non-existent paths', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      expect(manager.get('nonexistent.path')).toBeUndefined();
    });

    it('should get all configuration', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      const all = manager.getAll();

      expect(all).toHaveProperty('registry_url');
      expect(all).toHaveProperty('cache_path');
      expect(all).toHaveProperty('components_path');
      expect(all).toHaveProperty('hardware_profile');
    });
  });

  describe('Merge Configuration', () => {
    it('should merge partial configuration', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      manager.merge({
        registry_url: 'https://merged.com',
        auto_update: true,
      });

      expect(manager.get('registry_url')).toBe('https://merged.com');
      expect(manager.get('auto_update')).toBe(true);
      expect(manager.get('hardware_profile')).toBe('medium'); // Unchanged
    });
  });

  describe('Validation', () => {
    it('should validate correct configuration', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      const result = manager.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid registry URL', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();
      manager.set('registry_url', 'not-a-valid-url');

      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid registry_url');
    });

    it('should detect invalid paths', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();
      manager.set('cache_path', 'relative/path');

      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('cache_path must be an absolute path');
    });

    it('should detect invalid enum values', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();
      manager['config'].hardware_profile = 'invalid' as any;

      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('hardware_profile must be low, medium, or high');
    });

    it('should detect invalid numeric values', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();
      manager.set('max_cache_size', -100);

      const result = manager.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('max_cache_size must be positive');
    });

    it('should provide warnings for non-optimal values', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();
      manager.set('concurrent_downloads', 15);

      const result = manager.validate();

      expect(result.warnings).toContain('concurrent_downloads should be between 1 and 10');
    });
  });

  describe('Reset Configuration', () => {
    it('should reset to defaults', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      manager.set('registry_url', 'https://custom.com');
      manager.set('auto_update', true);

      await manager.reset();

      expect(manager.get('registry_url')).toBe('https://registry.aequor.dev');
      expect(manager.get('auto_update')).toBe(false);
    });
  });

  describe('Component Configuration', () => {
    it('should load component configuration', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      const componentConfigPath = path.join(testCacheDir, 'components', 'test-component', 'config.yaml');
      await fs.ensureDir(path.dirname(componentConfigPath));

      const testComponentConfig = {
        name: 'test-component',
        version: '1.0.0',
        settings: {
          setting1: 'value1',
          setting2: 42,
        },
      };

      await fs.writeFile(componentConfigPath, YAML.stringify(testComponentConfig));

      const config = await manager.loadComponentConfig('test-component');

      expect(config).toBeDefined();
      expect(config!.name).toBe('test-component');
      expect(config!.version).toBe('1.0.0');
      expect(config!.settings.setting1).toBe('value1');
    });

    it('should save component configuration', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      const componentConfig = {
        name: 'test-component',
        version: '1.0.0',
        settings: {
          setting1: 'value1',
        },
      };

      await manager.saveComponentConfig('test-component', componentConfig);

      const loaded = await manager.loadComponentConfig('test-component');

      expect(loaded).toEqual(componentConfig);
    });

    it('should return undefined for non-existent component config', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      const config = await manager.loadComponentConfig('nonexistent');

      expect(config).toBeUndefined();
    });
  });

  describe('Hot Reloading', () => {
    it('should watch for configuration changes', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      const callback = vi.fn();
      await manager.watch(callback);

      // Modify config file
      const currentConfig = await manager.load();
      currentConfig.registry_url = 'https://updated.com';
      await fs.writeFile(testConfigPath, YAML.stringify(currentConfig));

      // Wait for file watcher to detect change
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(callback).toHaveBeenCalled();
    }, 10000);

    it('should unwatch configuration', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      const callback = vi.fn();
      await manager.watch(callback);

      await manager.unwatch();

      // Modify config file
      const currentConfig = await manager.load();
      currentConfig.registry_url = 'https://updated.com';
      await fs.writeFile(testConfigPath, YAML.stringify(currentConfig));

      // Wait
      await new Promise(resolve => setTimeout(resolve, 100));

      // Callback should not be called again after unwatch
      const callCount = callback.mock.calls.length;
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(callback.mock.calls.length).toBeLessThanOrEqual(callCount);
    }, 10000);
  });

  describe('Utility Functions', () => {
    it('should create config manager', async () => {
      const manager = await createConfigManager(testConfigPath);

      expect(manager).toBeDefined();
      expect(manager.get('registry_url')).toBe('https://registry.aequor.dev');
    });

    it('should detect hardware profile', () => {
      const totalMemSpy = vi.spyOn(os, 'totalmem');
      const cpuCountSpy = vi.spyOn(os, 'cpus');

      // High profile
      totalMemSpy.mockReturnValue(20 * 1024 * 1024 * 1024); // 20GB
      cpuCountSpy.mockReturnValue(Array(16).fill({}));
      expect(detectHardwareProfile()).toBe('high');

      // Medium profile
      totalMemSpy.mockReturnValue(10 * 1024 * 1024 * 1024); // 10GB
      cpuCountSpy.mockReturnValue(Array(6).fill({}));
      expect(detectHardwareProfile()).toBe('medium');

      // Low profile
      totalMemSpy.mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB
      cpuCountSpy.mockReturnValue(Array(2).fill({}));
      expect(detectHardwareProfile()).toBe('low');

      totalMemSpy.mockRestore();
      cpuCountSpy.mockRestore();
    });

    it('should format configuration for display', async () => {
      const manager = new ConfigManager(testConfigPath);
      await manager.load();

      const formatted = formatConfig(manager.getAll());

      expect(formatted).toContain('Aequor Configuration');
      expect(formatted).toContain('Registry URL');
      expect(formatted).toContain('Cache Path');
      expect(formatted).toContain('Hardware Profile');
    });
  });
});
