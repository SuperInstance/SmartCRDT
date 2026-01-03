/**
 * @fileoverview Tests for WandBLogger
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WandBLogger } from '../src/monitoring/WandBLogger.js';
import type { WandBConfig, TrainingMetrics } from '../src/types.js';

function createMockConfig(): WandBConfig {
  return {
    enabled: true,
    project: 'test-project',
    entity: 'test-entity',
    runName: 'test-run',
    frequency: 100,
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
      top5: 0.95,
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

describe('WandBLogger', () => {
  let logger: WandBLogger;

  beforeEach(async () => {
    logger = new WandBLogger(createMockConfig());
    await logger.initialize();
  });

  describe('Construction and Initialization', () => {
    it('should create with config', () => {
      expect(logger).toBeDefined();
    });

    it('should initialize successfully', async () => {
      const newLogger = new WandBLogger(createMockConfig());
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

      expect(logger.getCurrentStep()).toBe(3);
    });

    it('should log scalars map', () => {
      const scalars = {
        loss: 0.5,
        accuracy: 0.85,
        lr: 0.001,
      };

      expect(() => logger.logMetrics(scalars, 10)).not.toThrow();
    });
  });

  describe('Logging Training Metrics', () => {
    it('should log complete metrics', () => {
      const metrics = createMockMetrics();

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });

    it('should log loss metrics', () => {
      const metrics = createMockMetrics();

      logger.logTrainingMetrics(metrics);

      expect(logger.getCurrentStep()).toBe(metrics.epoch);
    });

    it('should log all loss components', () => {
      const metrics = createMockMetrics();
      metrics.loss.worldModel = 0.3;
      metrics.loss.prediction = 0.2;

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });

    it('should log accuracy metrics', () => {
      const metrics = createMockMetrics();

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });

    it('should log latency metrics', () => {
      const metrics = createMockMetrics();

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });

    it('should log memory metrics', () => {
      const metrics = createMockMetrics();

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });

    it('should log throughput metrics', () => {
      const metrics = createMockMetrics();

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });
  });

  describe('Logging Config', () => {
    it('should log config', () => {
      const config = {
        learning_rate: 0.001,
        batch_size: 32,
        epochs: 100,
      };

      expect(() => logger.logConfig(config)).not.toThrow();
    });

    it('should handle nested config', () => {
      const config = {
        model: {
          layers: 12,
          hidden_dim: 768,
        },
        training: {
          optimizer: 'adamw',
        },
      };

      expect(() => logger.logConfig(config)).not.toThrow();
    });
  });

  describe('Logging Images', () => {
    it('should log image', () => {
      const image = {
        data: 'base64string...',
        caption: 'Test image',
      };

      expect(() => logger.logImage('test', image)).not.toThrow();
    });

    it('should log image without caption', () => {
      const image = {
        data: [1, 2, 3, 4],
      };

      expect(() => logger.logImage('test', image)).not.toThrow();
    });
  });

  describe('Logging Histograms', () => {
    it('should log histogram', () => {
      const values = [1, 2, 3, 4, 5];

      expect(() => logger.logHistogram('weights', values)).not.toThrow();
    });

    it('should compute histogram stats', () => {
      const values = [1, 2, 3, 4, 5];

      expect(() => logger.logHistogram('weights', values)).not.toThrow();
    });

    it('should handle empty histogram', () => {
      expect(() => logger.logHistogram('empty', [])).not.toThrow();
    });
  });

  describe('Logging Tables', () => {
    it('should log table', () => {
      const columns = ['epoch', 'loss', 'accuracy'];
      const data = [
        [1, 0.5, 0.85],
        [2, 0.4, 0.87],
      ];

      expect(() => logger.logTable('results', columns, data)).not.toThrow();
    });

    it('should handle empty table', () => {
      expect(() => logger.logTable('empty', [], [])).not.toThrow();
    });
  });

  describe('Logging Artifacts', () => {
    it('should log artifact', () => {
      const artifact = {
        name: 'model',
        type: 'model',
        path: '/path/to/model.ckpt',
        metadata: {
          epoch: 10,
          accuracy: 0.9,
        },
      };

      expect(() => logger.logArtifact(artifact)).not.toThrow();
    });

    it('should log model artifact', () => {
      expect(() => logger.saveModel('/path/to/model.ckpt')).not.toThrow();
    });

    it('should log model with name', () => {
      expect(() => logger.saveModel('/path/to/model.ckpt', 'best-model')).not.toThrow();
    });
  });

  describe('Logging Custom Data', () => {
    it('should log custom object', () => {
      const data = {
        custom_metric: 0.95,
        custom_list: [1, 2, 3],
      };

      expect(() => logger.logCustom(data)).not.toThrow();
    });
  });

  describe('Defining Metrics', () => {
    it('should define metric', () => {
      expect(() => logger.defineMetric('loss', 'batch')).not.toThrow();
    });

    it('should define metric without step metric', () => {
      expect(() => logger.defineMetric('accuracy')).not.toThrow();
    });
  });

  describe('Flush and Finish', () => {
    it('should flush pending writes', async () => {
      await expect(logger.flush()).resolves.not.toThrow();
    });

    it('should finish successfully', async () => {
      await expect(logger.finish()).resolves.not.toThrow();
    });

    it('should finish with exit code', async () => {
      await expect(logger.finish(0)).resolves.not.toThrow();
    });

    it('should finish with non-zero exit code', async () => {
      await expect(logger.finish(1)).resolves.not.toThrow();
    });

    it('should flush on finish', async () => {
      logger.logScalar('test', 1.0, 10);

      await expect(logger.finish()).resolves.not.toThrow();
    });
  });

  describe('Disabled Logger', () => {
    it('should not log when disabled', () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledLogger = new WandBLogger(config);

      expect(() => disabledLogger.logScalar('test', 1.0, 10)).not.toThrow();
      expect(disabledLogger.active()).toBe(false);
    });

    it('should not initialize when disabled', async () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledLogger = new WandBLogger(config);

      await expect(disabledLogger.initialize()).resolves.not.toThrow();
    });
  });

  describe('Step Tracking', () => {
    it('should track current step', () => {
      const metrics = createMockMetrics();
      metrics.epoch = 5;

      logger.logTrainingMetrics(metrics);

      expect(logger.getCurrentStep()).toBe(5);
    });

    it('should initialize at step 0', () => {
      expect(logger.getCurrentStep()).toBe(0);
    });
  });

  describe('Active State', () => {
    it('should report active when enabled and initialized', async () => {
      const newLogger = new WandBLogger(createMockConfig());
      await newLogger.initialize();

      expect(newLogger.active()).toBe(true);
    });

    it('should report inactive when disabled', () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledLogger = new WandBLogger(config);
      expect(disabledLogger.active()).toBe(false);
    });

    it('should report inactive before initialization', () => {
      const newLogger = new WandBLogger(createMockConfig());
      expect(newLogger.active()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle metrics without top-1 accuracy', () => {
      const metrics = createMockMetrics();
      delete (metrics.accuracy as any).top1;

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });

    it('should handle metrics without top-5 accuracy', () => {
      const metrics = createMockMetrics();
      delete (metrics.accuracy as any).top5;

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });

    it('should handle metrics without world model loss', () => {
      const metrics = createMockMetrics();
      delete (metrics.loss as any).worldModel;

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });

    it('should handle metrics without prediction loss', () => {
      const metrics = createMockMetrics();
      delete (metrics.loss as any).prediction;

      expect(() => logger.logTrainingMetrics(metrics)).not.toThrow();
    });
  });

  describe('Config Variations', () => {
    it('should work without entity', async () => {
      const config = createMockConfig();
      delete config.entity;

      const newLogger = new WandBLogger(config);

      await expect(newLogger.initialize()).resolves.not.toThrow();
    });

    it('should work without run name', async () => {
      const config = createMockConfig();
      delete config.runName;

      const newLogger = new WandBLogger(config);

      await expect(newLogger.initialize()).resolves.not.toThrow();
    });

    it('should work with API key', async () => {
      const config = createMockConfig();
      config.apiKey = 'test-api-key';

      const newLogger = new WandBLogger(config);

      await expect(newLogger.initialize()).resolves.not.toThrow();
    });
  });

  describe('Large Scale', () => {
    it('should handle many scalar logs efficiently', () => {
      for (let i = 0; i < 10000; i++) {
        logger.logScalar('test', Math.random(), i);
      }

      expect(logger.getCurrentStep()).toBe(9999);
    });

    it('should handle large histogram', () => {
      const values = Array.from({ length: 10000 }, () => Math.random());

      expect(() => logger.logHistogram('large', values)).not.toThrow();
    });
  });

  describe('Multiple Runs', () => {
    it('should support multiple independent loggers', async () => {
      const logger1 = new WandBLogger({ ...createMockConfig(), runName: 'run1' });
      const logger2 = new WandBLogger({ ...createMockConfig(), runName: 'run2' });

      await logger1.initialize();
      await logger2.initialize();

      logger1.logScalar('test', 1.0, 10);
      logger2.logScalar('test', 2.0, 5);

      expect(logger1.getCurrentStep()).toBe(10);
      expect(logger2.getCurrentStep()).toBe(5);

      await logger1.finish();
      await logger2.finish();
    });
  });
});
