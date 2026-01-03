/**
 * @fileoverview Tests for MetricsTracker
 * @package @lsi/vljepa-training
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsTracker } from '../src/monitoring/MetricsTracker.js';
import type { MetricsConfig, TrainingMetrics } from '../src/types.js';

function createMockMetrics(override: Partial<TrainingMetrics> = {}): TrainingMetrics {
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
    ...override,
  };
}

function createMockConfig(): MetricsConfig {
  return {
    scalars: ['loss', 'accuracy', 'learning_rate', 'latency', 'memory', 'throughput'],
    histograms: ['weights', 'gradients', 'embeddings'],
    aggregations: ['mean', 'std', 'min', 'max'],
    storage: {
      backend: 'memory',
    },
  };
}

describe('MetricsTracker', () => {
  let tracker: MetricsTracker;

  beforeEach(() => {
    tracker = new MetricsTracker(createMockConfig());
  });

  describe('Construction', () => {
    it('should create tracker with config', () => {
      expect(tracker).toBeDefined();
      expect(tracker.active()).toBe(true);
    });

    it('should initialize scalar tracking', () => {
      const loss = tracker.getScalar('loss_training');
      expect(loss).toEqual([]);
    });

    it('should initialize histogram tracking', () => {
      const weights = tracker.getHistogram('weights');
      expect(weights).toEqual([]);
    });
  });

  describe('Logging Metrics', () => {
    it('should log metrics', () => {
      const metrics = createMockMetrics();
      tracker.logMetrics(metrics);

      const history = tracker.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(metrics);
    });

    it('should log multiple metrics', () => {
      const m1 = createMockMetrics({ epoch: 1 });
      const m2 = createMockMetrics({ epoch: 2 });

      tracker.logMetrics(m1);
      tracker.logMetrics(m2);

      const history = tracker.getHistory();
      expect(history).toHaveLength(2);
    });

    it('should extract scalar values', () => {
      const metrics = createMockMetrics();
      tracker.logMetrics(metrics);

      const trainingLoss = tracker.getScalar('loss_training');
      expect(trainingLoss).toHaveLength(1);
      expect(trainingLoss[0]).toBe(0.5);
    });

    it('should extract all scalars', () => {
      const metrics = createMockMetrics();
      tracker.logMetrics(metrics);

      expect(tracker.getScalar('loss_training')).toHaveLength(1);
      expect(tracker.getScalar('loss_validation')).toHaveLength(1);
      expect(tracker.getScalar('accuracy_top1')).toHaveLength(1);
      expect(tracker.getScalar('learning_rate')).toHaveLength(1);
      expect(tracker.getScalar('latency_total')).toHaveLength(1);
      expect(tracker.getScalar('memory_gpu')).toHaveLength(1);
      expect(tracker.getScalar('throughput')).toHaveLength(1);
    });
  });

  describe('Scalar Tracking', () => {
    it('should log individual scalar', () => {
      tracker.logScalar('test_metric', 1.5, 10);

      const values = tracker.getScalar('test_metric');
      expect(values).toEqual([1.5]);
    });

    it('should append to existing scalar', () => {
      tracker.logScalar('test_metric', 1.0, 1);
      tracker.logScalar('test_metric', 2.0, 2);
      tracker.logScalar('test_metric', 3.0, 3);

      const values = tracker.getScalar('test_metric');
      expect(values).toEqual([1.0, 2.0, 3.0]);
    });
  });

  describe('Histogram Tracking', () => {
    it('should log histogram', () => {
      const values = [1, 2, 3, 4, 5];
      tracker.logHistogram('weights', values, 10);

      const histograms = tracker.getHistogram('weights');
      expect(histograms).toHaveLength(1);
      expect(histograms[0]).toEqual(values);
    });

    it('should log multiple histograms', () => {
      tracker.logHistogram('gradients', [1, 2], 1);
      tracker.logHistogram('gradients', [3, 4], 2);

      const histograms = tracker.getHistogram('gradients');
      expect(histograms).toHaveLength(2);
    });
  });

  describe('Aggregation', () => {
    it('should aggregate metrics when window is full', () => {
      // Log 100 metrics to trigger aggregation
      for (let i = 0; i < 100; i++) {
        tracker.logMetrics(createMockMetrics({ batch: i }));
      }

      const meanAggs = tracker.getAggregations('mean');
      expect(meanAggs.length).toBeGreaterThan(0);
    });

    it('should compute mean aggregation', () => {
      tracker.logMetrics(createMockMetrics({ loss: { training: 1.0, validation: 1.0 } }));
      tracker.logMetrics(createMockMetrics({ loss: { training: 2.0, validation: 2.0 } }));
      tracker.logMetrics(createMockMetrics({ loss: { training: 3.0, validation: 3.0 } }));

      for (let i = 0; i < 97; i++) {
        tracker.logMetrics(createMockMetrics());
      }

      const meanAggs = tracker.getAggregations('mean');
      expect(meanAggs.length).toBeGreaterThan(0);

      const latest = meanAggs[meanAggs.length - 1];
      expect(latest.metrics.loss_training).toBeCloseTo(2.0, 0);
    });
  });

  describe('History Management', () => {
    it('should get full history', () => {
      tracker.logMetrics(createMockMetrics({ epoch: 1 }));
      tracker.logMetrics(createMockMetrics({ epoch: 2 }));
      tracker.logMetrics(createMockMetrics({ epoch: 3 }));

      const history = tracker.getHistory();
      expect(history).toHaveLength(3);
    });

    it('should get latest metrics', () => {
      tracker.logMetrics(createMockMetrics({ epoch: 1 }));
      tracker.logMetrics(createMockMetrics({ epoch: 2 }));

      const latest = tracker.getLatest();
      expect(latest?.epoch).toBe(2);
    });

    it('should return null when no metrics exist', () => {
      const latest = tracker.getLatest();
      expect(latest).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should compute statistics for metric', () => {
      for (let i = 0; i < 10; i++) {
        tracker.logScalar('test_stat', i, i);
      }

      const stats = tracker.getStatistics('test_stat');
      expect(stats).toBeDefined();
      expect(stats!.min).toBe(0);
      expect(stats!.max).toBe(9);
      expect(stats!.mean).toBe(4.5);
      expect(stats!.median).toBe(5);
    });

    it('should return null for non-existent metric', () => {
      const stats = tracker.getStatistics('non_existent');
      expect(stats).toBeNull();
    });

    it('should compute standard deviation', () => {
      tracker.logScalar('std_test', 0, 0);
      tracker.logScalar('std_test', 2, 1);
      tracker.logScalar('std_test', 4, 2);

      const stats = tracker.getStatistics('std_test');
      expect(stats!.std).toBeCloseTo(2.31, 1);
    });
  });

  describe('Storage', () => {
    it('should save metrics', async () => {
      tracker.logMetrics(createMockMetrics());

      await tracker.save();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should clear metrics', async () => {
      tracker.logMetrics(createMockMetrics());
      tracker.logMetrics(createMockMetrics());

      expect(tracker.getHistory().length).toBe(2);

      await tracker.clear();

      expect(tracker.getHistory().length).toBe(0);
    });

    it('should clear scalars', async () => {
      tracker.logScalar('test', 1, 1);
      tracker.logScalar('test', 2, 2);

      expect(tracker.getScalar('test').length).toBe(2);

      await tracker.clear();

      expect(tracker.getScalar('test').length).toBe(0);
    });
  });

  describe('Summary', () => {
    it('should generate summary', () => {
      tracker.logMetrics(createMockMetrics());
      tracker.logMetrics(createMockMetrics());

      const summary = tracker.getSummary();

      expect(summary).toHaveProperty('totalSteps', 2);
      expect(summary).toHaveProperty('scalars');
      expect(summary).toHaveProperty('histograms');
    });

    it('should include scalar info in summary', () => {
      tracker.logMetrics(createMockMetrics());

      const summary = tracker.getSummary() as { scalars: Record<string, { count: number; latest: number }> };

      expect(summary.scalars.loss_training.count).toBe(1);
      expect(summary.scalars.loss_training.latest).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty history', () => {
      const history = tracker.getHistory();
      expect(history).toEqual([]);
    });

    it('should handle metrics with missing accuracy', () => {
      const metrics = createMockMetrics();
      delete (metrics.accuracy as any).top1;

      tracker.logMetrics(metrics);

      const acc = tracker.getScalar('accuracy_top1');
      expect(acc).toEqual([]);
    });

    it('should handle metrics with missing ORPO loss', () => {
      const metrics = createMockMetrics();

      tracker.logMetrics(metrics);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Large Scale', () => {
    it('should handle many metrics efficiently', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        tracker.logMetrics(createMockMetrics({ batch: i }));
      }

      const duration = Date.now() - start;

      // Should be fast (< 1 second for 1000 metrics)
      expect(duration).toBeLessThan(1000);
    });

    it('should aggregate at correct intervals', () => {
      // Log 250 metrics - should trigger aggregation at 100, 200
      for (let i = 0; i < 250; i++) {
        tracker.logMetrics(createMockMetrics({ batch: i }));
      }

      const meanAggs = tracker.getAggregations('mean');
      // Should have 2 aggregations (at 100 and 200)
      expect(meanAggs.length).toBeGreaterThanOrEqual(2);
    });
  });
});
