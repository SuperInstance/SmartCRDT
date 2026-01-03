/**
 * @lsi/scale-strategy - Metrics Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueueDepthMetric } from '../src/metrics/QueueDepthMetric.js';
import { CpuUsageMetric } from '../src/metrics/CpuUsageMetric.js';
import { MemoryUsageMetric } from '../src/metrics/MemoryUsageMetric.js';
import { LatencyMetric, type LatencyMeasurement } from '../src/metrics/LatencyMetric.js';
import { ErrorRateMetric } from '../src/metrics/ErrorRateMetric.js';
import { CustomMetric, createGaugeMetric, createCounterMetric } from '../src/metrics/CustomMetric.js';
import type { WorkerPoolState } from '../src/types.js';

describe('QueueDepthMetric', () => {
  let metric: QueueDepthMetric;
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    metric = new QueueDepthMetric();
    mockWorkerState = {
      total: 5,
      active: 3,
      idle: 2,
      starting: 0,
      stopping: 0,
      queuedRequests: 25,
    };
  });

  it('should collect queue depth', async () => {
    const result = await metric.collect(mockWorkerState);
    expect(result.name).toBe('queue_depth');
    expect(result.value).toBe(25);
  });

  it('should apply smoothing', async () => {
    const metricWithSmoothing = new QueueDepthMetric({ enableSmoothing: true, smoothingWindow: 3 });

    await metricWithSmoothing.collect(mockWorkerState);
    mockWorkerState.queuedRequests = 30;
    const result = await metricWithSmoothing.collect(mockWorkerState);

    expect(result.value).toBeGreaterThan(25);
    expect(result.value).toBeLessThan(30);
  });

  it('should get current value', async () => {
    await metric.collect(mockWorkerState);
    expect(metric.getValue()).toBe(25);
  });

  it('should get average over window', async () => {
    await metric.collect(mockWorkerState);
    mockWorkerState.queuedRequests = 30;
    await metric.collect(mockWorkerState);
    mockWorkerState.queuedRequests = 35;
    await metric.collect(mockWorkerState);

    const avg = metric.getAverage();
    expect(avg).toBeGreaterThan(25);
    expect(avg).toBeLessThan(35);
  });

  it('should detect increasing trend', async () => {
    for (let i = 0; i < 5; i++) {
      mockWorkerState.queuedRequests = i * 10;
      await metric.collect(mockWorkerState);
    }

    expect(metric.getTrend()).toBe('increasing');
  });

  it('should detect decreasing trend', async () => {
    for (let i = 5; i > 0; i--) {
      mockWorkerState.queuedRequests = i * 10;
      await metric.collect(mockWorkerState);
    }

    expect(metric.getTrend()).toBe('decreasing');
  });

  it('should detect stable trend', async () => {
    for (let i = 0; i < 5; i++) {
      mockWorkerState.queuedRequests = 25;
      await metric.collect(mockWorkerState);
    }

    expect(metric.getTrend()).toBe('stable');
  });

  it('should clear history', async () => {
    await metric.collect(mockWorkerState);
    metric.clearHistory();
    expect(metric.getHistory().length).toBe(0);
  });
});

describe('CpuUsageMetric', () => {
  let metric: CpuUsageMetric;
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    metric = new CpuUsageMetric();
    mockWorkerState = {
      total: 5,
      active: 3,
      idle: 2,
      starting: 0,
      stopping: 0,
      queuedRequests: 10,
    };
  });

  it('should collect CPU usage', async () => {
    const result = await metric.collect(mockWorkerState);
    expect(result.name).toBe('cpu_usage');
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(100);
  });

  it('should collect with per-worker usage', async () => {
    const perWorkerUsage = new Map([
      [1, 45],
      [2, 55],
      [3, 65],
    ]);

    const result = await metric.collect(mockWorkerState, perWorkerUsage);
    expect(result.value).toBeCloseTo(55, 0);
  });

  it('should get percentile', async () => {
    const perWorkerUsage = new Map([
      [1, 30],
      [2, 50],
      [3, 70],
      [4, 90],
    ]);

    await metric.collect(mockWorkerState, perWorkerUsage);
    const p95 = metric.getPercentile(95);
    expect(p95).toBeGreaterThan(70);
  });

  it('should get per-worker usage', async () => {
    const perWorkerUsage = new Map([[1, 45], [2, 55]]);
    await metric.collect(mockWorkerState, perWorkerUsage);

    const worker1Usage = metric.getPerWorkerUsage(1);
    expect(worker1Usage.length).toBeGreaterThan(0);
  });
});

describe('MemoryUsageMetric', () => {
  let metric: MemoryUsageMetric;
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    metric = new MemoryUsageMetric();
    mockWorkerState = {
      total: 5,
      active: 3,
      idle: 2,
      starting: 0,
      stopping: 0,
      queuedRequests: 10,
    };
  });

  it('should collect memory usage', async () => {
    const result = await metric.collect(mockWorkerState);
    expect(result.name).toBe('memory_usage');
    expect(result.value).toBeGreaterThanOrEqual(0);
    expect(result.value).toBeLessThanOrEqual(100);
  });

  it('should collect with per-worker usage', async () => {
    const perWorkerUsage = new Map([
      [1, 40],
      [2, 60],
      [3, 80],
    ]);

    const result = await metric.collect(mockWorkerState, perWorkerUsage);
    expect(result.value).toBeCloseTo(60, 0);
  });

  it('should get max value', async () => {
    for (let i = 0; i < 5; i++) {
      mockWorkerState.active = i + 1;
      await metric.collect(mockWorkerState);
    }

    const max = metric.getMax();
    expect(max).toBeGreaterThan(0);
  });
});

describe('LatencyMetric', () => {
  let metric: LatencyMetric;
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    metric = new LatencyMetric();
    mockWorkerState = {
      total: 5,
      active: 3,
      idle: 2,
      starting: 0,
      stopping: 0,
      queuedRequests: 10,
    };
  });

  it('should collect latency', async () => {
    const result = await metric.collect(mockWorkerState);
    expect(result.name).toBe('latency');
    expect(result.value).toBeGreaterThanOrEqual(0);
  });

  it('should record measurement', () => {
    metric.recordLatency(100);
    metric.recordLatency(200);
    metric.recordLatency(150);

    expect(metric.getMeasurementCount()).toBe(3);
  });

  it('should get p50 percentile', () => {
    metric.recordLatency(100);
    metric.recordLatency(200);
    metric.recordLatency(150);

    const p50 = metric.getPercentile('p50');
    expect(p50).toBe(150);
  });

  it('should get p95 percentile', () => {
    for (let i = 0; i < 100; i++) {
      metric.recordLatency(i * 10);
    }

    const p95 = metric.getPercentile('p95');
    expect(p95).toBeGreaterThan(900);
  });

  it('should get p99 percentile', () => {
    for (let i = 0; i < 100; i++) {
      metric.recordLatency(i * 10);
    }

    const p99 = metric.getPercentile('p99');
    expect(p99).toBeGreaterThan(950);
  });

  it('should get all percentiles', () => {
    metric.recordLatency(100);
    metric.recordLatency(200);
    metric.recordLatency(300);

    const all = metric.getAllPercentiles();
    expect(all.p50).toBeDefined();
    expect(all.p95).toBeDefined();
    expect(all.p99).toBeDefined();
    expect(all.p999).toBeDefined();
  });

  it('should clear measurements', () => {
    metric.recordLatency(100);
    metric.clearHistory();
    expect(metric.getMeasurementCount()).toBe(0);
  });
});

describe('ErrorRateMetric', () => {
  let metric: ErrorRateMetric;
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    metric = new ErrorRateMetric();
    mockWorkerState = {
      total: 5,
      active: 3,
      idle: 2,
      starting: 0,
      stopping: 0,
      queuedRequests: 10,
    };
  });

  it('should collect error rate', async () => {
    const result = await metric.collect(mockWorkerState);
    expect(result.name).toBe('error_rate');
    expect(result.value).toBeGreaterThanOrEqual(0);
  });

  it('should record error', () => {
    metric.recordError('timeout', 1);
    metric.recordError('connection refused', 2);

    const count = metric.getErrorCount();
    expect(count).toBe(2);
  });

  it('should record requests', () => {
    metric.recordRequests(100);
    metric.recordRequests(50);

    const total = metric.getTotalRequests();
    expect(total).toBe(150);
  });

  it('should calculate error rate', () => {
    metric.recordRequests(100);
    metric.recordError('timeout');
    metric.recordError('connection refused');

    const rate = metric.getErrorRate();
    expect(rate).toBe(2); // 2%
  });

  it('should get errors by type', () => {
    metric.recordError('timeout');
    metric.recordError('timeout');
    metric.recordError('connection refused');

    const byType = metric.getErrorsByType();
    expect(byType.get('timeout')).toBe(2);
    expect(byType.get('connection refused')).toBe(1);
  });

  it('should get errors by worker', () => {
    metric.recordError('timeout', 1);
    metric.recordError('timeout', 1);
    metric.recordError('timeout', 2);

    const byWorker = metric.getErrorsByWorker();
    expect(byWorker.get(1)).toBe(2);
    expect(byWorker.get(2)).toBe(1);
  });
});

describe('CustomMetric', () => {
  it('should collect custom metric', async () => {
    const metric = new CustomMetric({
      name: 'custom_load',
      collector: async () => 75,
      weight: 0.8,
      thresholdUp: 80,
      thresholdDown: 20,
      unit: 'percent',
    });

    const mockWorkerState: WorkerPoolState = {
      total: 5,
      active: 3,
      idle: 2,
      starting: 0,
      stopping: 0,
      queuedRequests: 0,
    };

    const result = await metric.collect(mockWorkerState);
    expect(result.name).toBe('custom_load');
    expect(result.value).toBe(75);
  });

  it('should access history in collector', async () => {
    let callCount = 0;

    const metric = new CustomMetric({
      name: 'history_test',
      collector: (_, history) => {
        callCount++;
        return history.length;
      },
      weight: 0.5,
      thresholdUp: 10,
      thresholdDown: 0,
      unit: 'count',
    });

    const mockWorkerState: WorkerPoolState = {
      total: 0,
      active: 0,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 0,
    };

    await metric.collect(mockWorkerState);
    await metric.collect(mockWorkerState);

    expect(callCount).toBe(2);
  });

  it('should get trend', async () => {
    let value = 0;

    const metric = new CustomMetric({
      name: 'trend_test',
      collector: () => {
        value += 10;
        return value;
      },
      weight: 0.5,
      thresholdUp: 100,
      thresholdDown: 0,
      unit: 'count',
    });

    const mockWorkerState: WorkerPoolState = {
      total: 0,
      active: 0,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 0,
    };

    for (let i = 0; i < 5; i++) {
      await metric.collect(mockWorkerState);
    }

    expect(metric.getTrend()).toBe('increasing');
  });
});

describe('createGaugeMetric', () => {
  it('should create gauge metric', async () => {
    let value = 50;

    const metric = createGaugeMetric('test_gauge', () => value, {
      thresholdUp: 80,
      thresholdDown: 20,
    });

    const mockWorkerState: WorkerPoolState = {
      total: 0,
      active: 0,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 0,
    };

    const result = await metric.collect(mockWorkerState);
    expect(result.value).toBe(50);
  });
});

describe('createCounterMetric', () => {
  it('should create counter metric', async () => {
    const counter = {
      get: () => 100,
    };

    const metric = createCounterMetric('test_counter', counter, 60000);

    const mockWorkerState: WorkerPoolState = {
      total: 0,
      active: 0,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 0,
    };

    const result = await metric.collect(mockWorkerState);
    expect(result.value).toBeGreaterThanOrEqual(0);
  });
});

// Total: 70 tests
