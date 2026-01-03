/**
 * @fileoverview Tests for EarlyStopping
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EarlyStopping } from '../src/callbacks/EarlyStopping.js';
import type { EarlyStoppingConfig, TrainingMetrics } from '../src/types.js';

function createMockConfig(overrides: Partial<EarlyStoppingConfig> = {}): EarlyStoppingConfig {
  return {
    enabled: true,
    monitor: 'val_loss',
    patience: 3,
    minDelta: 0.01,
    mode: 'min',
    restoreBestWeights: true,
    stopTraining: true,
    ...overrides,
  };
}

function createMockMetrics(valLoss: number): TrainingMetrics {
  return {
    epoch: 1,
    batch: 100,
    loss: {
      training: 0.5,
      validation: valLoss,
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

describe('EarlyStopping', () => {
  describe('Construction', () => {
    it('should create with config', () => {
      const config = createMockConfig();
      const es = new EarlyStopping(config);

      expect(es).toBeDefined();
      expect(es.active()).toBe(true);
    });

    it('should initialize state', () => {
      const es = new EarlyStopping(createMockConfig());

      expect(es.getBestValue()).toBeNull();
      expect(es.getWait()).toBe(0);
      expect(es.getBestEpoch()).toBe(0);
    });
  });

  describe('Monitoring Validation Loss (min mode)', () => {
    let es: EarlyStopping;

    beforeEach(() => {
      es = new EarlyStopping(createMockConfig({ mode: 'min', patience: 2, minDelta: 0.01 }));
    });

    it('should initialize on first check', () => {
      const shouldStop = es.check(createMockMetrics(1.0));

      expect(shouldStop).toBe(false);
      expect(es.getBestValue()).toBe(1.0);
      expect(es.getBestEpoch()).toBe(1);
    });

    it('should detect improvement', () => {
      es.check(createMockMetrics(1.0));
      const shouldStop = es.check(createMockMetrics(0.9));

      expect(shouldStop).toBe(false);
      expect(es.getBestValue()).toBe(0.9);
      expect(es.getWait()).toBe(0);
    });

    it('should not trigger on small change below minDelta', () => {
      es.check(createMockMetrics(1.0));
      const shouldStop = es.check(createMockMetrics(0.995));

      expect(shouldStop).toBe(false);
      expect(es.getWait()).toBe(1);
    });

    it('should increment wait on no improvement', () => {
      es.check(createMockMetrics(1.0));
      es.check(createMockMetrics(1.05));

      expect(es.getWait()).toBe(1);
    });

    it('should stop after patience epochs', () => {
      es.check(createMockMetrics(1.0));
      es.check(createMockMetrics(1.05));
      es.check(createMockMetrics(1.04));

      const shouldStop = es.check(createMockMetrics(1.06));

      expect(shouldStop).toBe(true);
      expect(es.getStoppedEpoch()).toBe(4);
    });

    it('should reset wait on improvement', () => {
      es.check(createMockMetrics(1.0));
      es.check(createMockMetrics(1.05));
      es.check(createMockMetrics(1.04));

      // Improvement
      es.check(createMockMetrics(0.95));

      expect(es.getWait()).toBe(0);
      expect(es.getBestValue()).toBe(0.95);
    });
  });

  describe('Monitoring Accuracy (max mode)', () => {
    let es: EarlyStopping;

    beforeEach(() => {
      es = new EarlyStopping(createMockConfig({
        monitor: 'val_accuracy',
        mode: 'max',
        patience: 2,
        minDelta: 0.01,
      }));
    });

    it('should detect improvement for max mode', () => {
      const metrics1 = createMockMetrics(0.5);
      (metrics1.accuracy as any).top1 = 0.8;

      const metrics2 = createMockMetrics(0.5);
      (metrics2.accuracy as any).top1 = 0.85;

      es.check(metrics1);
      const shouldStop = es.check(metrics2);

      expect(shouldStop).toBe(false);
      expect(es.getBestValue()).toBe(0.85);
    });

    it('should increment wait on decrease for max mode', () => {
      const metrics1 = createMockMetrics(0.5);
      (metrics1.accuracy as any).top1 = 0.85;

      const metrics2 = createMockMetrics(0.5);
      (metrics2.accuracy as any).top1 = 0.82;

      es.check(metrics1);
      es.check(metrics2);

      expect(es.getWait()).toBe(1);
    });

    it('should stop after patience for max mode', () => {
      const createAccMetrics = (acc: number) => {
        const m = createMockMetrics(0.5);
        (m.accuracy as any).top1 = acc;
        return m;
      };

      es.check(createAccMetrics(0.85));
      es.check(createAccMetrics(0.82));
      es.check(createAccMetrics(0.80));

      const shouldStop = es.check(createAccMetrics(0.78));

      expect(shouldStop).toBe(true);
    });
  });

  describe('Best Metrics Tracking', () => {
    it('should track best metrics', () => {
      const es = new EarlyStopping(createMockConfig());

      const metrics1 = createMockMetrics(1.0);
      const metrics2 = createMockMetrics(0.8);

      es.check(metrics1);
      es.check(metrics2);

      const best = es.getBestMetrics();
      expect(best).toBeDefined();
      expect(best?.loss.validation).toBe(0.8);
    });

    it('should update best metrics on improvement', () => {
      const es = new EarlyStopping(createMockConfig());

      es.check(createMockMetrics(1.0));
      es.check(createMockMetrics(0.9));
      es.check(createMockMetrics(0.8));

      expect(es.getBestValue()).toBe(0.8);
      expect(es.getBestEpoch()).toBe(3);
    });
  });

  describe('Reset', () => {
    it('should reset state', () => {
      const es = new EarlyStopping(createMockConfig());

      es.check(createMockMetrics(1.0));
      es.check(createMockMetrics(1.05));

      expect(es.getWait()).toBe(1);
      expect(es.getBestValue()).toBe(1.0);

      es.reset();

      expect(es.getWait()).toBe(0);
      expect(es.getBestValue()).toBeNull();
      expect(es.getBestEpoch()).toBe(0);
    });
  });

  describe('Different Metrics', () => {
    it('should monitor training loss', () => {
      const es = new EarlyStopping(createMockConfig({
        monitor: 'training_loss',
        mode: 'min',
      }));

      const metrics = createMockMetrics(0.5);
      metrics.loss.training = 1.0;

      es.check(metrics);

      expect(es.getBestValue()).toBe(1.0);
    });

    it('should monitor preference accuracy', () => {
      const es = new EarlyStopping(createMockConfig({
        monitor: 'preference_accuracy',
        mode: 'max',
      }));

      const metrics = createMockMetrics(0.5);
      (metrics.accuracy as any).preference = 0.75;

      es.check(metrics);

      expect(es.getBestValue()).toBe(0.75);
    });

    it('should return null for missing metric', () => {
      const es = new EarlyStopping(createMockConfig({
        monitor: 'preference_accuracy',
      }));

      const metrics = createMockMetrics(0.5);
      // No preference accuracy set

      const shouldStop = es.check(metrics);

      expect(shouldStop).toBe(false);
      expect(es.getBestValue()).toBeNull();
    });
  });

  describe('Patience Variations', () => {
    it('should respect patience of 1', () => {
      const es = new EarlyStopping(createMockConfig({ patience: 1 }));

      es.check(createMockMetrics(1.0));
      es.check(createMockMetrics(1.05));

      const shouldStop = es.check(createMockMetrics(1.06));

      expect(shouldStop).toBe(true);
    });

    it('should respect large patience', () => {
      const es = new EarlyStopping(createMockConfig({ patience: 10 }));

      for (let i = 0; i < 9; i++) {
        es.check(createMockMetrics(1.0 + i * 0.01));
      }

      const shouldStop = es.check(createMockMetrics(1.1));

      expect(shouldStop).toBe(false);
    });
  });

  describe('Min Delta Variations', () => {
    it('should respect min delta of 0', () => {
      const es = new EarlyStopping(createMockConfig({ minDelta: 0 }));

      es.check(createMockMetrics(1.0));

      // Even tiny improvement should count
      const shouldStop = es.check(createMockMetrics(0.9999));

      expect(shouldStop).toBe(false);
      expect(es.getWait()).toBe(0);
    });

    it('should require larger min delta', () => {
      const es = new EarlyStopping(createMockConfig({ minDelta: 0.1 }));

      es.check(createMockMetrics(1.0));

      const shouldStop = es.check(createMockMetrics(0.95));

      expect(shouldStop).toBe(false);
      expect(es.getWait()).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle flat metrics', () => {
      const es = new EarlyStopping(createMockConfig({ patience: 2 }));

      es.check(createMockMetrics(1.0));
      es.check(createMockMetrics(1.0));
      es.check(createMockMetrics(1.0));

      expect(es.getWait()).toBe(2);
    });

    it('should handle improvement after wait', () => {
      const es = new EarlyStopping(createMockConfig({ patience: 3 }));

      es.check(createMockMetrics(1.0));
      es.check(createMockMetrics(1.05));
      es.check(createMockMetrics(1.04));

      // Improvement after waiting
      const shouldStop = es.check(createMockMetrics(0.95));

      expect(shouldStop).toBe(false);
      expect(es.getWait()).toBe(0);
    });

    it('should handle disabled early stopping', () => {
      const es = new EarlyStopping(createMockConfig({ enabled: false }));

      expect(es.active()).toBe(false);
    });
  });
});
