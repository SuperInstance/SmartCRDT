/**
 * Tests for ConfigBuilder
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigBuilder, buildConfig, mergeConfig, ConfigValidationError } from '../src/config/ConfigBuilder.js';

interface TestConfig {
  timeout: number;
  retries: number;
  apiKey: string;
  endpoint?: string;
  nested?: {
    value: number;
  };
}

describe('ConfigBuilder', () => {
  let defaults: TestConfig;

  beforeEach(() => {
    defaults = {
      timeout: 30000,
      retries: 3,
      apiKey: '',
      endpoint: 'https://api.example.com',
    };
  });

  describe('Basic operations', () => {
    it('should create builder with defaults', () => {
      const builder = new ConfigBuilder(defaults);
      const config = builder.build();

      expect(config.timeout).toBe(30000);
      expect(config.retries).toBe(3);
    });

    it('should set individual values', () => {
      const config = new ConfigBuilder(defaults)
        .set('timeout', 60000)
        .set('retries', 5)
        .build();

      expect(config.timeout).toBe(60000);
      expect(config.retries).toBe(5);
    });

    it('should merge partial config', () => {
      const config = new ConfigBuilder(defaults)
        .merge({ timeout: 60000 })
        .build();

      expect(config.timeout).toBe(60000);
      expect(config.retries).toBe(3); // unchanged
    });

    it('should deep merge nested objects', () => {
      const config = new ConfigBuilder({
        ...defaults,
        nested: { value: 10 }
      })
        .merge({ nested: { value: 20 } })
        .build();

      expect(config.nested?.value).toBe(20);
    });
  });

  describe('Environment variables', () => {
    beforeEach(() => {
      // Save original env
      process.env = { ...process.env };
    });

    afterEach(() => {
      // Restore env
      delete process.env.MY_TIMEOUT;
      delete process.env.MY_API_KEY;
      delete process.env.APP_TIMEOUT;
    });

    it('should load from env mapping', () => {
      process.env.MY_TIMEOUT = '60000';
      process.env.MY_API_KEY = 'test-key';

      const config = new ConfigBuilder(defaults)
        .fromEnv({
          timeout: 'MY_TIMEOUT',
          apiKey: 'MY_API_KEY',
        })
        .build();

      expect(config.timeout).toBe(60000);
      expect(config.apiKey).toBe('test-key');
    });

    it('should parse numbers from env', () => {
      process.env.MY_TIMEOUT = '60000';

      const config = new ConfigBuilder(defaults)
        .fromEnv({ timeout: 'MY_TIMEOUT' })
        .build();

      expect(config.timeout).toBe(60000);
      expect(typeof config.timeout).toBe('number');
    });

    it('should parse booleans from env', () => {
      interface BoolConfig {
        enabled: boolean;
      }

      process.env.MY_ENABLED = 'true';

      const config = new ConfigBuilder({ enabled: false } as BoolConfig)
        .fromEnv({ enabled: 'MY_ENABLED' })
        .build();

      expect(config.enabled).toBe(true);
    });

    it('should load from env prefix', () => {
      process.env.APP_TIMEOUT = '60000';
      process.env.APP_RETRIES = '5';

      const config = new ConfigBuilder(defaults)
        .fromEnvPrefix('APP_')
        .build();

      expect(config.timeout).toBe(60000);
      expect(config.retries).toBe(5);
    });
  });

  describe('Validation', () => {
    it('should validate with custom validator', () => {
      expect(() => {
        new ConfigBuilder(defaults)
          .validate((c) => c.apiKey.length > 0, 'API key required')
          .build();
      }).toThrow(ConfigValidationError);
    });

    it('should validate required fields', () => {
      expect(() => {
        new ConfigBuilder(defaults)
          .validateRequired('apiKey')
          .build();
      }).toThrow(ConfigValidationError);
    });

    it('should validate ranges', () => {
      expect(() => {
        new ConfigBuilder(defaults)
          .validateRange('timeout', 1000, 60000)
          .set('timeout', 100)
          .build();
      }).toThrow(ConfigValidationError);
    });

    it('should pass valid range', () => {
      const config = new ConfigBuilder(defaults)
        .validateRange('timeout', 1000, 60000)
        .set('timeout', 5000)
        .build();

      expect(config.timeout).toBe(5000);
    });

    it('should validate choices', () => {
      expect(() => {
        new ConfigBuilder(defaults)
          .validateChoices('retries', [1, 3, 5])
          .set('retries', 2)
          .build();
      }).toThrow(ConfigValidationError);
    });

    it('should collect validation errors', () => {
      expect(() => {
        new ConfigBuilder(defaults)
          .validateRequired('apiKey')
          .validateRange('timeout', 1000, 60000)
          .set('timeout', 100)
          .build();
      }).toThrow('apiKey');
    });

    it('should get validation errors', () => {
      const builder = new ConfigBuilder(defaults)
        .validateRequired('apiKey');

      const errors = builder.getErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('apiKey');
    });

    it('should check validity', () => {
      const builder1 = new ConfigBuilder(defaults).validateRequired('apiKey');
      expect(builder1.isValid()).toBe(false);

      const builder2 = new ConfigBuilder(defaults)
        .set('apiKey', 'test-key')
        .validateRequired('apiKey');
      expect(builder2.isValid()).toBe(true);
    });

    it('should build safe', () => {
      const builder = new ConfigBuilder(defaults)
        .validateRequired('apiKey');

      expect(builder.buildSafe()).toBeNull();
    });
  });

  describe('Builder operations', () => {
    it('should reset builder', () => {
      const builder = new ConfigBuilder(defaults)
        .set('timeout', 60000)
        .reset();

      expect(builder.build().timeout).toBe(30000);
    });

    it('should clone builder', () => {
      const builder1 = new ConfigBuilder(defaults)
        .set('timeout', 60000);

      const builder2 = builder1.clone();
      builder2.set('timeout', 90000);

      expect(builder1.build().timeout).toBe(60000);
      expect(builder2.build().timeout).toBe(90000);
    });

    it('should create snapshot', () => {
      const builder = new ConfigBuilder(defaults)
        .set('timeout', 60000);

      const snapshot = builder.snapshot();
      expect(snapshot.config.timeout).toBe(60000);
    });

    it('should restore from snapshot', () => {
      const builder1 = new ConfigBuilder(defaults)
        .set('timeout', 60000);

      const snapshot = builder1.snapshot();

      const builder2 = new ConfigBuilder(defaults)
        .set('timeout', 90000)
        .restore(snapshot);

      expect(builder2.build().timeout).toBe(60000);
    });
  });

  describe('Convenience functions', () => {
    it('should build config with buildConfig', () => {
      const config = buildConfig(defaults)
        .set('timeout', 60000)
        .build();

      expect(config.timeout).toBe(60000);
    });

    it('should merge config with mergeConfig', () => {
      const config = mergeConfig(defaults, { timeout: 60000 });

      expect(config.timeout).toBe(60000);
      expect(config.retries).toBe(3);
    });
  });

  describe('Fluent API', () => {
    it('should chain methods', () => {
      const config = new ConfigBuilder(defaults)
        .set('timeout', 60000)
        .set('retries', 5)
        .set('apiKey', 'test-key')
        .validateRequired('apiKey')
        .validateRange('timeout', 1000, 120000)
        .build();

      expect(config.timeout).toBe(60000);
      expect(config.retries).toBe(5);
      expect(config.apiKey).toBe('test-key');
    });
  });
});
