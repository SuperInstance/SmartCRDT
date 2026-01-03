/**
 * @fileoverview Tests for TensorBoardLogger
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TensorBoardLogger } from '../src/monitoring/TensorBoardLogger.js';
import type { TensorBoardConfig, TrainingMetrics } from '../src/types.js';

function createMockConfig(): TensorBoardConfig {
  return {
    enabled: true,
    logDir: './test-logs',
    frequency: 100,
    scalars: ['loss', 'accuracy', 'learning_rate'],
    histograms: ['weights', 'gradients'],
    images: [],
    logGraph: false,
    logHyperparams: false,
  };
}

function createMockMetrics(): TrainingMetrics {
  return {
    epoch: 1,
    batch: 100,
    loss: {
      training: 0.5,
      validation: 0.6,
    },
    accuracy: {
      top1: 0.85,
    },
    latency: {
      forward: 50,
      backward: 30,
      total: 80,
    },
    memory: {
      gpu: 2000,
      cpu: 500,
      peak: 2500,
    },
    throughput: 100,
    learning: {
      gradientNorm: 1.0,
      learningRate: 0.001,
    },
    timestamp: Date.now(),
  };
}

describe('TensorBoardLogger', () => {
  let logger: TensorBoardLogger;

  beforeEach(async () => {
    logger = new TensorBoardLogger(createMockConfig());
    await logger.initialize();
  });

  describe('Construction and Initialization', () => {
    it('should create with config', () => {
      expect(logger).toBeDefined();
    });

    it('should initialize successfully', async () => {
      const newLogger = new TensorBoardLogger(createMockConfig());
      await expect(newLogger.initialize()).resolves.not.toThrow();
    });
  });

  describe('Logging Scalars', () => {
    it('should log scalar', () => {
      expect(() => logger.logScalar('test', 1.5, 10)).not.toThrow();
    });

    it('should log multiple scalars', () => {
      logger.logScalar('loss', 1.0, 1);
      logger.logScalar('loss', 0.9, 2);
      logger.logScalar('loss', 0.8, 3);

      const step = logger.getCurrentStep();
      expect(step).toBe(3);
    });

    it('should log scalars map', () => {
      const scalars = {
        loss: 0.5,
        accuracy: 0.85,
        lr: 0.001,
      };

      expect(() => logger.logScalars(scalars, 10)).not.toThrow();
    });

    it('should update step', () => {
      logger.logScalar('test', 1.0, 5);

      expect(logger.getCurrentStep()).toBe(5);
    });
  });

  describe('Logging Histograms', () => {
    it('should log histogram', () => {
      const values = [1, 2, 3, 4, 5];

      expect(() => logger.logHistogram('weights', values, 10)).not.toThrow();
    });

    it('should compute histogram stats', () => {
      const values = [1, 2, 3, 4, 5];

      expect(() => logger.logHistogram('weights', values, 10)).not.toThrow();
    });

    it('should handle empty histogram', () => {
      expect(() => logger.logHistogram('empty', [], 10)).not.toThrow();
    });

    it('should handle single value histogram', () => {
      expect(() => logger.logHistogram('single', [1], 10)).not.toThrow();
    });
  });

  describe('Logging Images', () => {
    it('should log image', () => {
      const imageData = {
        data: [1, 2, 3, 4],
        shape: [2, 2],
      };

      expect(() => logger.logImage('test', imageData, 10)).not.toThrow();
    });

    it('should handle 3D image', () => {
      const imageData = {
        data: [1, 2, 3],
        shape: [1, 1, 3],
      };

      expect(() => logger.logImage('rgb', imageData, 10)).not.toThrow();
    });
  });

  describe('Logging Graph', () => {
    it('should log model graph', () => {
      const model = {
        name: 'test_model',
        layers: ['conv1', 'relu', 'conv2', 'fc'],
      };

      expect(() => logger.logGraph(model)).not.toThrow();
    });

    it('should skip when logGraph is disabled', () => {
      const config = createMockConfig();
      config.logGraph = false;

      const disabledLogger = new TensorBoardLogger(config);

      const model = {
        name: 'test',
        layers: ['l1'],
      };

      expect(() => disabledLogger.logGraph(model)).not.toThrow();
    });
  });

  describe('Logging Hyperparameters', () => {
    it('should log hyperparameters', () => {
      const params = {
        learning_rate: 0.001,
        batch_size: 32,
        epochs: 100,
      };

      expect(() => logger.logHyperparams(params)).not.toThrow();
    });

    it('should handle complex params', () => {
      const params = {
        nested: {
          value: 10,
        },
        array: [1, 2, 3],
      };

      expect(() => logger.logHyperparams(params)).not.toThrow();
    });
  });

  describe('Logging Training Metrics', () => {
    it('should log loss scalars', () => {
      const metrics = createMockMetrics();

      expect(() => logger.logMetrics(metrics)).not.toThrow();
    });

    it('should log accuracy scalars', () => {
      const config = createMockConfig();
      config.scalars = ['accuracy'];

      const accLogger = new TensorBoardLogger(config);
      const metrics = createMockMetrics();

      expect(() => accLogger.logMetrics(metrics)).not.toThrow();
    });

    it('should log latency scalars', () => {
      const config = createMockConfig();
      config.scalars = ['latency'];

      const latLogger = new TensorBoardLogger(config);
      const metrics = createMockMetrics();

      expect(() => latLogger.logMetrics(metrics)).not.toThrow();
    });

    it('should log memory scalars', () => {
      const config = createMockConfig();
      config.scalars = ['memory'];

      const memLogger = new TensorBoardLogger(config);
      const metrics = createMockMetrics();

      expect(() => memLogger.logMetrics(metrics)).not.toThrow();
    });

    it('should log throughput scalars', () => {
      const config = createMockConfig();
      config.scalars = ['throughput'];

      const thrLogger = new TensorBoardLogger(config);
      const metrics = createMockMetrics();

      expect(() => thrLogger.logMetrics(metrics)).not.toThrow();
    });
  });

  describe('Flush and Close', () => {
    it('should flush pending writes', async () => {
      await expect(logger.flush()).resolves.not.toThrow();
    });

    it('should close gracefully', async () => {
      await expect(logger.close()).resolves.not.toThrow();
    });

    it('should flush on close', async () => {
      logger.logScalar('test', 1.0, 10);

      await expect(logger.close()).resolves.not.toThrow();
    });
  });

  describe('Disabled Logger', () => {
    it('should not log when disabled', () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledLogger = new TensorBoardLogger(config);

      expect(() => disabledLogger.logScalar('test', 1.0, 10)).not.toThrow();
      expect(disabledLogger.active()).toBe(false);
    });

    it('should not initialize when disabled', async () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledLogger = new TensorBoardLogger(config);

      await expect(disabledLogger.initialize()).resolves.not.toThrow();
    });
  });

  describe('Step Tracking', () => {
    it('should track current step', () => {
      logger.logScalar('test', 1.0, 5);
      expect(logger.getCurrentStep()).toBe(5);

      logger.logScalar('test', 2.0, 10);
      expect(logger.getCurrentStep()).toBe(10);
    });

    it('should initialize at step 0', () => {
      expect(logger.getCurrentStep()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative step', () => {
      expect(() => logger.logScalar('test', 1.0, -1)).not.toThrow();
    });

    it('should handle zero step', () => {
      expect(() => logger.logScalar('test', 1.0, 0)).not.toThrow();
    });

    it('should handle very large step', () => {
      expect(() => logger.logScalar('test', 1.0, 1000000)).not.toThrow();
    });

    it('should handle NaN values', () => {
      expect(() => logger.logScalar('test', NaN, 10)).not.toThrow();
    });

    it('should handle Infinity values', () => {
      expect(() => logger.logScalar('test', Infinity, 10)).not.toThrow();
    });
  });

  describe('Active State', () => {
    it('should report active when enabled', () => {
      expect(logger.active()).toBe(true);
    });

    it('should report inactive when disabled', () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledLogger = new TensorBoardLogger(config);
      expect(disabledLogger.active()).toBe(false);
    });
  });

  describe('Large Scale', () => {
    it('should handle many scalar logs efficiently', () => {
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        logger.logScalar('test', Math.random(), i);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
    });

    it('should handle large histogram', () => {
      const values = Array.from({ length: 10000 }, () => Math.random());

      expect(() => logger.logHistogram('large', values, 10)).not.toThrow();
    });
  });

  describe('Multiple Loggers', () => {
    it('should create multiple independent loggers', async () => {
      const config1 = createMockConfig();
      const config2 = createMockConfig();

      const logger1 = new TensorBoardLogger(config1);
      const logger2 = new TensorBoardLogger(config2);

      logger1.logScalar('test', 1.0, 10);
      logger2.logScalar('test', 2.0, 5);

      expect(logger1.getCurrentStep()).toBe(10);
      expect(logger2.getCurrentStep()).toBe(5);
    });
  });
});
