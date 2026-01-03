/**
 * HealthAggregator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HealthAggregator } from '../src/HealthAggregator.js';
import type { HealthMetric } from '../src/types.js';

describe('HealthAggregator', () => {
  let aggregator: HealthAggregator;

  beforeEach(() => {
    aggregator = new HealthAggregator();
  });

  describe('constructor', () => {
    it('should create with default strategy', () => {
      const agg = new HealthAggregator();
      expect(agg.getConfig().strategy).toBe('average');
    });

    it('should create with custom strategy', () => {
      const agg = new HealthAggregator({ strategy: 'weighted' });
      expect(agg.getConfig().strategy).toBe('weighted');
    });
  });

  describe('aggregate', () => {
    it('should aggregate empty metrics', () => {
      const result = aggregator.aggregate([]);

      expect(result.score).toBe(0);
      expect(result.status).toBe('unknown');
      expect(result.weight).toBe(0);
    });

    it('should calculate average score', () => {
      const metrics: HealthMetric[] = [
        createMetric('m1', 80, '%', 'healthy'),
        createMetric('m2', 90, '%', 'healthy'),
        createMetric('m3', 70, '%', 'healthy')
      ];

      const result = aggregator.aggregate(metrics);

      expect(result.score).toBeCloseTo(80, 1);
      expect(result.status).toBe('healthy');
    });

    it('should use weighted average when configured', () => {
      const agg = new HealthAggregator({
        strategy: 'weighted',
        weights: new Map([
          ['m1', 0.5],
          ['m2', 0.3],
          ['m3', 0.2]
        ])
      });

      const metrics: HealthMetric[] = [
        createMetric('m1', 80, '%', 'healthy'),
        createMetric('m2', 90, '%', 'healthy'),
        createMetric('m3', 70, '%', 'healthy')
      ];

      const result = agg.aggregate(metrics);

      expect(result.score).toBeCloseTo(80, 1);
    });

    it('should calculate minimum score', () => {
      const agg = new HealthAggregator({ strategy: 'min' });

      const metrics: HealthMetric[] = [
        createMetric('m1', 80, '%', 'healthy'),
        createMetric('m2', 90, '%', 'healthy'),
        createMetric('m3', 70, '%', 'healthy')
      ];

      const result = agg.aggregate(metrics);

      expect(result.score).toBe(70);
    });

    it('should calculate maximum score', () => {
      const agg = new HealthAggregator({ strategy: 'max' });

      const metrics: HealthMetric[] = [
        createMetric('m1', 80, '%', 'healthy'),
        createMetric('m2', 90, '%', 'healthy'),
        createMetric('m3', 70, '%', 'healthy')
      ];

      const result = agg.aggregate(metrics);

      expect(result.score).toBe(90);
    });

    it('should use custom aggregation function', () => {
      const agg = new HealthAggregator({
        strategy: 'custom',
        customFunction: (metrics) => {
          return metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length * 2;
        }
      });

      const metrics: HealthMetric[] = [
        createMetric('m1', 50, '%', 'healthy'),
        createMetric('m2', 50, '%', 'healthy')
      ];

      const result = agg.aggregate(metrics);

      expect(result.score).toBe(100);
    });

    it('should convert score to status correctly', () => {
      const agg = new HealthAggregator();

      const healthyMetrics = [createMetric('m1', 90, '%', 'healthy')];
      expect(agg.aggregate(healthyMetrics).status).toBe('healthy');

      const degradedMetrics = [createMetric('m1', 60, '%', 'degraded')];
      expect(agg.aggregate(degradedMetrics).status).toBe('degraded');

      const unhealthyMetrics = [createMetric('m1', 30, '%', 'unhealthy')];
      expect(agg.aggregate(unhealthyMetrics).status).toBe('unhealthy');
    });

    it('should apply minChecks weight', () => {
      const agg = new HealthAggregator({
        strategy: 'average',
        minChecks: 5
      });

      const metrics: HealthMetric[] = [
        createMetric('m1', 80, '%', 'healthy'),
        createMetric('m2', 80, '%', 'healthy')
      ];

      const result = agg.aggregate(metrics);

      expect(result.weight).toBeLessThan(1);
    });
  });

  describe('aggregateWorkers', () => {
    it('should aggregate multiple workers', () => {
      const workers = [
        createWorker('w1', [createMetric('m1', 90, '%', 'healthy')]),
        createWorker('w2', [createMetric('m1', 70, '%', 'healthy')]),
        createWorker('w3', [createMetric('m1', 80, '%', 'healthy')])
      ];

      const result = aggregator.aggregateWorkers(workers);

      expect(result.overallScore).toBeCloseTo(80, 1);
      expect(result.workerScores.size).toBe(3);
    });

    it('should handle empty workers', () => {
      const result = aggregator.aggregateWorkers([]);

      expect(result.overallScore).toBe(0);
      expect(result.overallStatus).toBe('unknown');
      expect(result.workerScores.size).toBe(0);
    });

    it('should calculate individual worker scores', () => {
      const workers = [
        createWorker('w1', [createMetric('m1', 100, '%', 'healthy')]),
        createWorker('w2', [createMetric('m1', 50, '%', 'degraded')]),
        createWorker('w3', [createMetric('m1', 0, '%', 'unhealthy')])
      ];

      const result = aggregator.aggregateWorkers(workers);

      expect(result.workerScores.get('w1')).toBe(100);
      expect(result.workerScores.get('w2')).toBe(50);
      expect(result.workerScores.get('w3')).toBe(0);
    });
  });

  describe('analyzeTrends', () => {
    it('should analyze trends for metric', () => {
      const metricName = 'cpu-usage';

      for (let i = 0; i < 10; i++) {
        aggregator.addToHistory(metricName, 50 + i * 2);
      }

      const trend = aggregator.analyzeTrends(metricName, 5);

      expect(trend).toBeDefined();
      expect(trend?.metric).toBe(metricName);
      expect(trend?.trend).toBe('up');
      expect(trend?.changePercent).toBeGreaterThan(0);
    });

    it('should detect downward trend', () => {
      const metricName = 'cpu-usage';

      for (let i = 0; i < 10; i++) {
        aggregator.addToHistory(metricName, 100 - i * 5);
      }

      const trend = aggregator.analyzeTrends(metricName, 5);

      expect(trend?.trend).toBe('down');
      expect(trend?.changePercent).toBeLessThan(0);
    });

    it('should detect stable trend', () => {
      const metricName = 'cpu-usage';

      for (let i = 0; i < 10; i++) {
        aggregator.addToHistory(metricName, 50);
      }

      const trend = aggregator.analyzeTrends(metricName, 5);

      expect(trend?.trend).toBe('stable');
      expect(Math.abs(trend!.changePercent)).toBeLessThan(5);
    });

    it('should return null for insufficient data', () => {
      aggregator.addToHistory('test', 50);

      const trend = aggregator.analyzeTrends('test', 5);

      expect(trend).toBeNull();
    });
  });

  describe('history', () => {
    it('should add values to history', () => {
      aggregator.addToHistory('metric1', 100);
      aggregator.addToHistory('metric1', 90);
      aggregator.addToHistory('metric1', 80);

      const history = aggregator.getHistory('metric1');

      expect(history).toEqual([100, 90, 80]);
    });

    it('should limit history size', () => {
      for (let i = 0; i < 150; i++) {
        aggregator.addToHistory('metric1', i);
      }

      const history = aggregator.getHistory('metric1');

      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should limit history when requested', () => {
      for (let i = 0; i < 20; i++) {
        aggregator.addToHistory('metric1', i);
      }

      const history = aggregator.getHistory('metric1', 5);

      expect(history.length).toBe(5);
      expect(history).toEqual([15, 16, 17, 18, 19]);
    });

    it('should return empty array for non-existent metric', () => {
      const history = aggregator.getHistory('non-existent');

      expect(history).toEqual([]);
    });

    it('should clear specific metric history', () => {
      aggregator.addToHistory('metric1', 100);
      aggregator.addToHistory('metric2', 200);

      aggregator.clearHistory('metric1');

      expect(aggregator.getHistory('metric1')).toEqual([]);
      expect(aggregator.getHistory('metric2')).toEqual([200]);
    });

    it('should clear all history', () => {
      aggregator.addToHistory('metric1', 100);
      aggregator.addToHistory('metric2', 200);

      aggregator.clearHistory();

      expect(aggregator.getHistory('metric1')).toEqual([]);
      expect(aggregator.getHistory('metric2')).toEqual([]);
    });
  });

  describe('calculateMovingAverage', () => {
    it('should calculate moving average', () => {
      for (let i = 1; i <= 10; i++) {
        aggregator.addToHistory('metric1', i * 10);
      }

      const ma = aggregator.calculateMovingAverage('metric1', 3);

      expect(ma).toBeCloseTo(90, 0); // Average of 80, 90, 100
    });

    it('should return 0 for non-existent metric', () => {
      const ma = aggregator.calculateMovingAverage('non-existent');
      expect(ma).toBe(0);
    });
  });

  describe('detectAnomalies', () => {
    it('should detect anomalies', () => {
      // Normal values
      for (let i = 0; i < 10; i++) {
        aggregator.addToHistory('metric1', 50 + Math.random() * 5);
      }

      // Anomaly
      aggregator.addToHistory('metric1', 150);

      const anomalies = aggregator.detectAnomalies('metric1', 2);

      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0].deviation).toBeGreaterThan(2);
    });

    it('should return empty for insufficient data', () => {
      aggregator.addToHistory('metric1', 50);

      const anomalies = aggregator.detectAnomalies('metric1');

      expect(anomalies).toEqual([]);
    });
  });

  describe('calculateVelocity', () => {
    it('should calculate velocity and acceleration', () => {
      for (let i = 0; i < 10; i++) {
        aggregator.addToHistory('metric1', 50 + i * 5);
      }

      const velocity = aggregator.calculateVelocity('metric1', 3);

      expect(velocity.velocity).toBeGreaterThan(0);
      expect(velocity.acceleration).toBeDefined();
    });

    it('should return zero for insufficient data', () => {
      aggregator.addToHistory('metric1', 50);

      const velocity = aggregator.calculateVelocity('metric1');

      expect(velocity.velocity).toBe(0);
      expect(velocity.acceleration).toBe(0);
    });
  });

  describe('predict', () => {
    it('should predict future values', () => {
      for (let i = 0; i < 10; i++) {
        aggregator.addToHistory('metric1', 50 + i * 5);
      }

      const prediction = aggregator.predict('metric1', 1);

      expect(prediction).toBeDefined();
      expect(prediction).toBeGreaterThan(90);
    });

    it('should return null for insufficient data', () => {
      aggregator.addToHistory('metric1', 50);

      const prediction = aggregator.predict('metric1');

      expect(prediction).toBeNull();
    });
  });

  describe('config', () => {
    it('should update configuration', () => {
      aggregator.updateConfig({ strategy: 'min' });

      expect(aggregator.getConfig().strategy).toBe('min');
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      aggregator.addToHistory('metric1', 100);
      aggregator.addToHistory('metric2', 200);

      aggregator.reset();

      expect(aggregator.getHistory('metric1')).toEqual([]);
      expect(aggregator.getHistory('metric2')).toEqual([]);
    });
  });
});

// Helper functions
function createMetric(
  name: string,
  value: number,
  unit: string,
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
): HealthMetric {
  return {
    name,
    value,
    unit,
    status,
    timestamp: new Date()
  };
}

function createWorker(id: string, metrics: HealthMetric[]) {
  return {
    workerId: id,
    status: 'healthy' as const,
    metrics,
    lastCheck: new Date(),
    uptime: 1000,
    consecutiveFailures: 0,
    consecutiveSuccesses: 5
  };
}
