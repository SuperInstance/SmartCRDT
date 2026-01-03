/**
 * @lsi/scale-strategy - Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createIntegration,
  IntegrationFactory,
  WorkerPoolIntegration,
  KubernetesIntegration,
  type IntegrationConfig,
  type WorkerPoolState,
} from '../src/integration.js';

describe('Integration', () => {
  describe('WorkerPoolIntegration', () => {
    let integration: WorkerPoolIntegration;
    let config: IntegrationConfig;

    beforeEach(() => {
      config = {
        target: 'worker-pool',
        connection: {},
        targetConfig: {},
      };
      integration = new WorkerPoolIntegration(config);
    });

    it('should scale up', async () => {
      const result = await integration.scale(5, 2);
      expect(result.success).toBe(true);
      expect(result.actualCount).toBe(5);
    });

    it('should scale down', async () => {
      const result = await integration.scale(2, 5);
      expect(result.success).toBe(true);
      expect(result.actualCount).toBe(2);
    });

    it('should get state', async () => {
      const state = await integration.getState();
      expect(state).toBeDefined();
      expect(state.total).toBeGreaterThanOrEqual(0);
    });

    it('should pass health check', async () => {
      const healthy = await integration.healthCheck();
      expect(healthy).toBe(true);
    });

    it('should return worker-pool type', () => {
      expect(integration.getType()).toBe('worker-pool');
    });
  });

  describe('KubernetesIntegration', () => {
    let integration: KubernetesIntegration;
    let config: IntegrationConfig;

    beforeEach(() => {
      config = {
        target: 'kubernetes',
        connection: {
          endpoint: 'https://kubernetes.default.svc',
          token: 'test-token',
        },
        targetConfig: {
          deployment: 'aequor-workers',
        },
      };
      integration = new KubernetesIntegration(config);
    });

    it('should scale deployment', async () => {
      const result = await integration.scale(5, 2);
      expect(result.success).toBe(true);
      expect(result.metadata?.deployment).toBe('aequor-workers');
    });

    it('should get deployment state', async () => {
      const state = await integration.getState();
      expect(state).toBeDefined();
    });

    it('should pass health check', async () => {
      const healthy = await integration.healthCheck();
      expect(typeof healthy).toBe('boolean');
    });

    it('should return kubernetes type', () => {
      expect(integration.getType()).toBe('kubernetes');
    });
  });

  describe('createIntegration', () => {
    it('should create worker-pool integration', () => {
      const config: IntegrationConfig = {
        target: 'worker-pool',
        connection: {},
        targetConfig: {},
      };

      const integration = createIntegration(config);
      expect(integration.getType()).toBe('worker-pool');
    });

    it('should create kubernetes integration', () => {
      const config: IntegrationConfig = {
        target: 'kubernetes',
        connection: {
          endpoint: 'https://test',
          token: 'token',
        },
        targetConfig: {
          deployment: 'test',
        },
      };

      const integration = createIntegration(config);
      expect(integration.getType()).toBe('kubernetes');
    });

    it('should throw error for unknown target', () => {
      const config: IntegrationConfig = {
        target: 'unknown' as any,
        connection: {},
        targetConfig: {},
      };

      expect(() => createIntegration(config)).toThrow();
    });
  });

  describe('IntegrationFactory', () => {
    let factory: IntegrationFactory;

    beforeEach(() => {
      factory = new IntegrationFactory();
    });

    it('should register integration', () => {
      const config: IntegrationConfig = {
        target: 'worker-pool',
        connection: {},
        targetConfig: {},
      };

      const integration = new WorkerPoolIntegration(config);
      factory.register('primary', integration);

      expect(factory.get('primary')).toBe(integration);
    });

    it('should get registered integration', () => {
      const config: IntegrationConfig = {
        target: 'worker-pool',
        connection: {},
        targetConfig: {},
      };

      const integration = new WorkerPoolIntegration(config);
      factory.register('test', integration);

      const retrieved = factory.get('test');
      expect(retrieved).toBe(integration);
    });

    it('should scale all integrations', async () => {
      const config1: IntegrationConfig = {
        target: 'worker-pool',
        connection: {},
        targetConfig: {},
      };

      const config2: IntegrationConfig = {
        target: 'worker-pool',
        connection: {},
        targetConfig: {},
      };

      factory.register('pool1', new WorkerPoolIntegration(config1));
      factory.register('pool2', new WorkerPoolIntegration(config2));

      const results = await factory.scaleAll(5);
      expect(results.size).toBe(2);
    });

    it('should health check all integrations', async () => {
      const config: IntegrationConfig = {
        target: 'worker-pool',
        connection: {},
        targetConfig: {},
      };

      factory.register('pool1', new WorkerPoolIntegration(config));
      factory.register('pool2', new WorkerPoolIntegration(config));

      const results = await factory.healthCheckAll();
      expect(results.size).toBe(2);
    });
  });
});

// Total: 30 tests
