/**
 * @fileoverview Tests for GradientMonitor
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GradientMonitor } from '../src/callbacks/GradientMonitor.js';
import type { GradientMonitorConfig } from '../src/types.js';

function createMockConfig(): GradientMonitorConfig {
  return {
    enabled: true,
    logNorms: true,
    logHistograms: true,
    checkAnomalies: true,
    anomalyThreshold: 10.0,
    anomalyAction: 'clip',
  };
}

describe('GradientMonitor', () => {
  let monitor: GradientMonitor;

  beforeEach(() => {
    monitor = new GradientMonitor(createMockConfig());
  });

  describe('Construction', () => {
    it('should create with config', () => {
      expect(monitor).toBeDefined();
      expect(monitor.active()).toBe(true);
    });

    it('should initialize empty history', () => {
      expect(monitor.getNorms()).toEqual([]);
    });

    it('should initialize zero stats', () => {
      expect(monitor.getStats()).toBeNull();
    });
  });

  describe('Logging Gradient Norms', () => {
    it('should log gradient norm', () => {
      monitor.logGradientNorm(1.5);

      const norms = monitor.getNorms();
      expect(norms).toEqual([1.5]);
    });

    it('should log multiple norms', () => {
      monitor.logGradientNorm(1.0);
      monitor.logGradientNorm(2.0);
      monitor.logGradientNorm(1.5);

      const norms = monitor.getNorms();
      expect(norms).toEqual([1.0, 2.0, 1.5]);
    });

    it('should track epoch', () => {
      monitor.logGradientNorm(1.0, 5);

      const history = monitor.getHistory();
      expect(history.epochs).toEqual([5]);
    });

    it('should track timestamp', () => {
      const before = Date.now();
      monitor.logGradientNorm(1.0);
      const after = Date.now();

      const history = monitor.getHistory();
      expect(history.timestamps[0]).toBeGreaterThanOrEqual(before);
      expect(history.timestamps[0]).toBeLessThanOrEqual(after);
    });

    it('should increment total checks', () => {
      monitor.logGradientNorm(1.0);
      monitor.logGradientNorm(1.5);

      // Should have logged 2 times
      expect(monitor.getNorms().length).toBe(2);
    });
  });

  describe('Logging Gradient Stats', () => {
    it('should log gradient statistics', () => {
      const stats = {
        norm: 2.5,
        min: -1.0,
        max: 1.0,
        mean: 0.0,
        std: 0.5,
        numParameters: 1000,
        numZeroGradients: 10,
        numNanGradients: 0,
      };

      monitor.logGradientStats(stats);

      const norms = monitor.getNorms();
      expect(norms).toEqual([2.5]);
    });

    it('should log with epoch', () => {
      const stats = {
        norm: 1.0,
        min: 0,
        max: 1,
        mean: 0.5,
        std: 0.3,
        numParameters: 100,
        numZeroGradients: 0,
        numNanGradients: 0,
      };

      monitor.logGradientStats(stats, 10);

      const history = monitor.getHistory();
      expect(history.epochs).toEqual([10]);
    });
  });

  describe('Logging Histograms', () => {
    it('should log histogram values', () => {
      const values = [1, 2, 3, 4, 5];

      monitor.logHistogram(values);

      const norms = monitor.getNorms();
      expect(norms.length).toBe(1);
    });

    it('should compute histogram stats', () => {
      const values = [1, 2, 3, 4, 5];

      monitor.logHistogram(values);

      // Norm should be sqrt(1+4+9+16+25) = sqrt(55) ≈ 7.416
      const norm = monitor.getLatestNorm();
      expect(norm).toBeCloseTo(7.416, 2);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect exploding gradients', () => {
      monitor.logGradientNorm(15.0); // Above threshold of 10.0

      const stats = monitor.getStats();
      expect(stats).toBeDefined();
      expect(stats!.max).toBeGreaterThan(10);
    });

    it('should detect vanishing gradients', () => {
      monitor.logGradientNorm(1e-8); // Below 1e-7

      const stats = monitor.getStats();
      expect(stats).toBeDefined();
      expect(stats!.min).toBeLessThan(1e-7);
    });

    it('should track anomaly count', () => {
      monitor.logGradientNorm(15.0);
      monitor.logGradientNorm(20.0);

      const rate = monitor.getAnomalyRate();
      expect(rate).toBe(1.0); // Both were anomalies
    });

    it('should not flag normal gradients', () => {
      monitor.logGradientNorm(1.0);
      monitor.logGradientNorm(2.0);
      monitor.logGradientNorm(1.5);

      const stats = monitor.getStats();
      expect(stats!.max).toBeLessThan(10);
      expect(stats!.min).toBeGreaterThan(1e-7);
    });
  });

  describe('Statistics', () => {
    it('should compute statistics', () => {
      monitor.logGradientNorm(1.0);
      monitor.logGradientNorm(2.0);
      monitor.logGradientNorm(3.0);

      const stats = monitor.getStats();

      expect(stats).toBeDefined();
      expect(stats!.mean).toBe(2.0);
      expect(stats!.min).toBe(1.0);
      expect(stats!.max).toBe(3.0);
      expect(stats!.median).toBe(2.0);
    });

    it('should compute standard deviation', () => {
      monitor.logGradientNorm(1.0);
      monitor.logGradientNorm(2.0);
      monitor.logGradientNorm(3.0);

      const stats = monitor.getStats();

      // std of [1, 2, 3] is sqrt(2/3) ≈ 0.816
      expect(stats!.std).toBeCloseTo(0.816, 2);
    });

    it('should return null for empty history', () => {
      const stats = monitor.getStats();
      expect(stats).toBeNull();
    });

    it('should handle single value', () => {
      monitor.logGradientNorm(5.0);

      const stats = monitor.getStats();

      expect(stats!.mean).toBe(5.0);
      expect(stats!.std).toBe(0);
    });
  });

  describe('History Management', () => {
    it('should get full history', () => {
      monitor.logGradientNorm(1.0);
      monitor.logGradientNorm(2.0);

      const history = monitor.getHistory();

      expect(history.norms).toEqual([1.0, 2.0]);
      expect(history.epochs).toEqual([0, 0]);
      expect(history.timestamps).toHaveLength(2);
    });

    it('should get latest norm', () => {
      monitor.logGradientNorm(1.0);
      monitor.logGradientNorm(2.0);
      monitor.logGradientNorm(3.0);

      expect(monitor.getLatestNorm()).toBe(3.0);
    });

    it('should return null for latest when empty', () => {
      expect(monitor.getLatestNorm()).toBeNull();
    });
  });

  describe('Health Check', () => {
    it('should be healthy with normal gradients', () => {
      monitor.logGradientNorm(1.0);

      expect(monitor.isHealthy()).toBe(true);
    });

    it('should be unhealthy with exploding gradients', () => {
      monitor.logGradientNorm(15.0);

      expect(monitor.isHealthy()).toBe(false);
    });

    it('should be unhealthy with vanishing gradients', () => {
      monitor.logGradientNorm(1e-8);

      expect(monitor.isHealthy()).toBe(false);
    });

    it('should be healthy when no gradients logged', () => {
      expect(monitor.isHealthy()).toBe(true);
    });
  });

  describe('Clear', () => {
    it('should clear history', () => {
      monitor.logGradientNorm(1.0);
      monitor.logGradientNorm(2.0);

      monitor.clear();

      expect(monitor.getNorms()).toEqual([]);
    });

    it('should clear stats', () => {
      monitor.logGradientNorm(1.0);

      monitor.clear();

      expect(monitor.getStats()).toBeNull();
    });

    it('should reset anomaly count', () => {
      monitor.logGradientNorm(15.0);

      monitor.clear();

      const rate = monitor.getAnomalyRate();
      expect(rate).toBe(0);
    });
  });

  describe('Disabled Monitor', () => {
    it('should not log when disabled', () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledMonitor = new GradientMonitor(config);

      disabledMonitor.logGradientNorm(1.0);

      expect(disabledMonitor.getNorms()).toEqual([]);
    });

    it('should report inactive', () => {
      const config = createMockConfig();
      config.enabled = false;

      const disabledMonitor = new GradientMonitor(config);

      expect(disabledMonitor.active()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero norm', () => {
      monitor.logGradientNorm(0);

      const stats = monitor.getStats();
      expect(stats!.min).toBe(0);
    });

    it('should handle very small norms', () => {
      monitor.logGradientNorm(1e-10);
      monitor.logGradientNorm(1e-9);

      expect(monitor.getLatestNorm()).toBeCloseTo(1e-9, 15);
    });

    it('should handle very large norms', () => {
      monitor.logGradientNorm(1000);

      const stats = monitor.getStats();
      expect(stats!.max).toBe(1000);
    });
  });

  describe('Anomaly Actions', () => {
    it('should support log action', () => {
      const config = createMockConfig();
      config.anomalyAction = 'log';

      const logMonitor = new GradientMonitor(config);

      expect(() => logMonitor.logGradientNorm(15)).not.toThrow();
    });

    it('should support stop action', () => {
      const config = createMockConfig();
      config.anomalyAction = 'stop';

      const stopMonitor = new GradientMonitor(config);

      expect(() => stopMonitor.logGradientNorm(15)).not.toThrow();
    });

    it('should support skip action', () => {
      const config = createMockConfig();
      config.anomalyAction = 'skip';

      const skipMonitor = new GradientMonitor(config);

      expect(() => skipMonitor.logGradientNorm(15)).not.toThrow();
    });
  });

  describe('Large Scale', () => {
    it('should handle many gradients efficiently', () => {
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        monitor.logGradientNorm(Math.random() * 5);
      }

      const duration = Date.now() - start;

      // Should be fast
      expect(duration).toBeLessThan(1000);
    });
  });
});
