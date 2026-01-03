/**
 * @fileoverview Tests for ValidationCallback
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationCallback } from '../src/callbacks/ValidationCallback.js';
import type { ValidationCallbackConfig, TrainingMetrics } from '../src/types.js';

function createMockConfig(): ValidationCallbackConfig {
  return {
    enabled: true,
    frequency: 1,
    savePredictions: false,
    detailedMetrics: true,
  };
}

function createMockMetrics(epoch: number, valLoss: number, valAcc: number): TrainingMetrics {
  return {
    epoch,
    batch: 100,
    loss: {
      training: 0.5,
      validation: valLoss,
    },
    accuracy: {
      top1: valAcc,
      top5: valAcc + 0.1,
    },
    latency: {
      forward: 50,
      backward: 0,
      total: 50,
    },
    memory: {
      gpu: 1500,
      cpu: 300,
      peak: 1800,
    },
    throughput: 100,
    learning: {
      gradientNorm: 0,
      learningRate: 0.001,
    },
    timestamp: Date.now(),
  };
}

describe('ValidationCallback', () => {
  let callback: ValidationCallback;

  beforeEach(() => {
    callback = new ValidationCallback(createMockConfig());
  });

  describe('Construction', () => {
    it('should create with config', () => {
      expect(callback).toBeDefined();
      expect(callback.active()).toBe(true);
    });

    it('should initialize empty history', () => {
      const history = callback.getHistory();

      expect(history.epochs).toEqual([]);
      expect(history.losses).toEqual([]);
      expect(history.accuracies).toEqual([]);
    });

    it('should initialize best metrics', () => {
      const best = callback.getBestMetrics();

      expect(best.accuracy).toBe(0);
      expect(best.loss).toBe(Infinity);
      expect(best.epoch).toBe(0);
    });
  });

  describe('Validation Timing', () => {
    it('should validate every epoch with frequency 1', () => {
      expect(callback.shouldValidate(1)).toBe(true);
      expect(callback.shouldValidate(2)).toBe(true);
      expect(callback.shouldValidate(3)).toBe(true);
    });

    it('should validate every N epochs with frequency > 1', () => {
      const config = createMockConfig();
      config.frequency = 5;

      const callback = new ValidationCallback(config);

      expect(callback.shouldValidate(5)).toBe(true);
      expect(callback.shouldValidate(10)).toBe(true);
      expect(callback.shouldValidate(15)).toBe(true);

      expect(callback.shouldValidate(3)).toBe(false);
      expect(callback.shouldValidate(7)).toBe(false);
    });

    it('should not validate when disabled', () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledCallback = new ValidationCallback(config);

      expect(disabledCallback.shouldValidate(1)).toBe(false);
    });
  });

  describe('Running Validation', () => {
    it('should run validation', async () => {
      const metrics = await callback.validate();

      expect(metrics).toBeDefined();
      expect(metrics.loss.validation).toBeGreaterThan(0);
      expect(metrics.accuracy.top1).toBeGreaterThan(0);
    });

    it('should generate different metrics on each run', async () => {
      const m1 = await callback.validate();
      const m2 = await callback.validate();

      // Random values, so likely different
      expect(m1.loss.validation).not.toBe(m2.loss.validation);
    });
  });

  describe('Handling Validation End', () => {
    it('should record metrics on validation end', async () => {
      const metrics = createMockMetrics(1, 0.6, 0.85);
      await callback.onValidationEnd(metrics);

      const history = callback.getHistory();

      expect(history.epochs).toEqual([1]);
      expect(history.losses).toEqual([0.6]);
      expect(history.accuracies).toEqual([0.85]);
    });

    it('should update best metrics on improvement', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 1.0, 0.7));
      await callback.onValidationEnd(createMockMetrics(2, 0.8, 0.8));

      const best = callback.getBestMetrics();

      expect(best.accuracy).toBe(0.8);
      expect(best.loss).toBe(0.8);
      expect(best.epoch).toBe(2);
    });

    it('should track best accuracy', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.75));
      await callback.onValidationEnd(createMockMetrics(2, 0.5, 0.85));
      await callback.onValidationEnd(createMockMetrics(3, 0.4, 0.80));

      const best = callback.getBestMetrics();
      expect(best.accuracy).toBe(0.85);
    });

    it('should track best loss', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 1.0, 0.7));
      await callback.onValidationEnd(createMockMetrics(2, 0.8, 0.8));
      await callback.onValidationEnd(createMockMetrics(3, 0.6, 0.75));

      const best = callback.getBestMetrics();
      expect(best.loss).toBe(0.6);
    });

    it('should update history sequentially', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.8));
      await callback.onValidationEnd(createMockMetrics(2, 0.5, 0.85));
      await callback.onValidationEnd(createMockMetrics(3, 0.4, 0.9));

      const history = callback.getHistory();

      expect(history.epochs).toEqual([1, 2, 3]);
      expect(history.losses).toEqual([0.6, 0.5, 0.4]);
      expect(history.accuracies).toEqual([0.8, 0.85, 0.9]);
    });
  });

  describe('Getting Latest Metrics', () => {
    it('should get latest validation metrics', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.8));
      await callback.onValidationEnd(createMockMetrics(2, 0.5, 0.85));

      const latest = callback.getLatest();

      expect(latest).toBeDefined();
      expect(latest!.epoch).toBe(2);
      expect(latest!.loss).toBe(0.5);
      expect(latest!.accuracy).toBe(0.85);
    });

    it('should return null when no validations', () => {
      const latest = callback.getLatest();
      expect(latest).toBeNull();
    });
  });

  describe('Improvement Detection', () => {
    it('should detect improvement', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 1.0, 0.7));
      await callback.onValidationEnd(createMockMetrics(2, 0.9, 0.75));
      await callback.onValidationEnd(createMockMetrics(3, 0.8, 0.8));
      await callback.onValidationEnd(createMockMetrics(4, 0.7, 0.85));
      await callback.onValidationEnd(createMockMetrics(5, 0.6, 0.9));

      expect(callback.isImproving()).toBe(true);
    });

    it('should detect no improvement', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.8));
      await callback.onValidationEnd(createMockMetrics(2, 0.65, 0.78));
      await callback.onValidationEnd(createMockMetrics(3, 0.7, 0.76));
      await callback.onValidationEnd(createMockMetrics(4, 0.75, 0.74));
      await callback.onValidationEnd(createMockMetrics(5, 0.8, 0.72));

      expect(callback.isImproving()).toBe(false);
    });

    it('should use window size for improvement check', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.8));
      await callback.onValidationEnd(createMockMetrics(2, 0.65, 0.78));
      await(callback.onValidationEnd(createMockMetrics(3, 0.7, 0.76)));

      // Need at least windowSize validations
      expect(callback.isImproving(2)).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should compute validation statistics', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.8));
      await callback.onValidationEnd(createMockMetrics(2, 0.5, 0.85));
      await callback.onValidationEnd(createMockMetrics(3, 0.4, 0.9));

      const stats = callback.getStatistics();

      expect(stats).toBeDefined();
      expect(stats!.totalValidations).toBe(3);
      expect(stats!.meanLoss).toBeCloseTo(0.5, 5);
      expect(stats!.meanAccuracy).toBeCloseTo(0.85, 5);
    });

    it('should compute min/max', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.8));
      await callback.onValidationEnd(createMockMetrics(2, 0.5, 0.85));
      await callback.onValidationEnd(createMockMetrics(3, 0.4, 0.9));

      const stats = callback.getStatistics();

      expect(stats!.minLoss).toBe(0.4);
      expect(stats!.maxAccuracy).toBe(0.9);
    });

    it('should compute standard deviation', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.8));
      await callback.onValidationEnd(createMockMetrics(2, 0.5, 0.85));
      await callback.onValidationEnd(createMockMetrics(3, 0.4, 0.9));

      const stats = callback.getStatistics();

      expect(stats!.stdLoss).toBeGreaterThan(0);
      expect(stats!.stdAccuracy).toBeGreaterThan(0);
    });

    it('should return null when no validations', () => {
      const stats = callback.getStatistics();
      expect(stats).toBeNull();
    });
  });

  describe('Detailed Validation', () => {
    it('should run detailed validation', async () => {
      const detailed = await callback.runDetailedValidation();

      expect(detailed).toBeDefined();
      expect(detailed.loss).toBeGreaterThan(0);
      expect(detailed.accuracy).toBeGreaterThan(0);
      expect(detailed.top5Accuracy).toBeGreaterThan(detailed.accuracy);
      expect(detailed.precision).toBeGreaterThan(0);
      expect(detailed.recall).toBeGreaterThan(0);
      expect(detailed.f1).toBeGreaterThan(0);
    });

    it('should generate F1 from precision and recall', async () => {
      const detailed = await callback.runDetailedValidation();

      // F1 should be harmonic mean of precision and recall
      const expectedF1 = 2 * (detailed.precision * detailed.recall) / (detailed.precision + detailed.recall);
      expect(detailed.f1).toBeCloseTo(expectedF1, 4);
    });
  });

  describe('Clear', () => {
    it('should clear history', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.8));
      await callback.onValidationEnd(createMockMetrics(2, 0.5, 0.85));

      callback.clear();

      const history = callback.getHistory();
      expect(history.epochs).toEqual([]);
      expect(history.losses).toEqual([]);
      expect(history.accuracies).toEqual([]);
    });

    it('should clear best metrics', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.6, 0.8));

      callback.clear();

      const best = callback.getBestMetrics();
      expect(best.accuracy).toBe(0);
      expect(best.loss).toBe(Infinity);
    });
  });

  describe('Disabled Callback', () => {
    it('should not validate when disabled', () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledCallback = new ValidationCallback(config);

      expect(disabledCallback.shouldValidate(1)).toBe(false);
      expect(disabledCallback.active()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle validation without top-1 accuracy', async () => {
      const metrics = createMockMetrics(1, 0.6, 0);
      delete (metrics.accuracy as any).top1;

      await callback.onValidationEnd(metrics);

      const history = callback.getHistory();
      expect(history.accuracies[0]).toBe(0);
    });

    it('should handle equal loss values', async () => {
      await callback.onValidationEnd(createMockMetrics(1, 0.5, 0.8));
      await callback.onValidationEnd(createMockMetrics(2, 0.5, 0.85));

      const best = callback.getBestMetrics();
      expect(best.loss).toBe(0.5);
    });
  });

  describe('Large Scale', () => {
    it('should handle many validations efficiently', async () => {
      const start = Date.now();

      for (let i = 1; i <= 100; i++) {
        await callback.onValidationEnd(createMockMetrics(i, 1.0 - i * 0.005, 0.7 + i * 0.002));
      }

      const duration = Date.now() - start;

      expect(callback.getHistory().epochs.length).toBe(100);
      expect(duration).toBeLessThan(1000);
    });
  });
});
