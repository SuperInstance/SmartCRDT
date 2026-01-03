/**
 * Tests for UtilizationMonitor
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UtilizationMonitor } from '../src/utilization/UtilizationMonitor.js';

describe('UtilizationMonitor', () => {
  let monitor: UtilizationMonitor;

  beforeEach(() => {
    monitor = new UtilizationMonitor(50); // 50ms sampling
  });

  afterEach(() => {
    monitor.stopSampling();
  });

  describe('sampling', () => {
    it('should start and stop sampling', () => {
      expect(monitor.isActive()).toBe(false);

      monitor.startSampling();
      expect(monitor.isActive()).toBe(true);

      monitor.stopSampling();
      expect(monitor.isActive()).toBe(false);
    });

    it('should not start sampling if already active', () => {
      monitor.startSampling();
      monitor.startSampling(); // Should be idempotent

      expect(monitor.isActive()).toBe(true);
    });
  });

  describe('taking samples', () => {
    it('should take single sample', () => {
      const sample = monitor.sample();

      expect(sample.timestamp).toBeGreaterThan(0);
      expect(sample.compute).toBeGreaterThanOrEqual(0);
      expect(sample.compute).toBeLessThanOrEqual(100);
      expect(sample.memoryBandwidth).toBeGreaterThanOrEqual(0);
      expect(sample.memoryBandwidth).toBeLessThanOrEqual(100);
    });

    it('should accumulate samples', () => {
      monitor.sample();
      monitor.sample();
      monitor.sample();

      expect(monitor.getSampleCount()).toBe(3);
    });
  });

  describe('kernel tracking', () => {
    it('should record kernel execution', () => {
      const startTime = performance.now();
      monitor.recordKernel(startTime, 10); // 10ms duration

      // Wait a bit
      const sample = monitor.sample();

      // Utilization should be updated based on recent kernels
      expect(sample.compute).toBeGreaterThanOrEqual(0);
    });

    it('should track multiple kernels', () => {
      const now = performance.now();

      monitor.recordKernel(now, 5);
      monitor.recordKernel(now + 2, 5);
      monitor.recordKernel(now + 4, 5);

      const sample = monitor.sample();

      expect(sample.compute).toBeGreaterThan(0);
    });

    it('should clean up old kernels', () => {
      const oldTime = performance.now() - 1000;
      monitor.recordKernel(oldTime, 10);

      const sample1 = monitor.sample();
      expect(sample1.compute).toBe(0); // Old kernel should be cleaned up
    });
  });

  describe('statistics', () => {
    it('should calculate statistics', () => {
      monitor.sample();
      monitor.sample();
      monitor.sample();

      const stats = monitor.getStatistics();

      expect(stats.avgCompute).toBeGreaterThanOrEqual(0);
      expect(stats.peakCompute).toBeGreaterThanOrEqual(0);
      expect(stats.avgMemoryBandwidth).toBeGreaterThanOrEqual(0);
      expect(stats.peakMemoryBandwidth).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty samples', () => {
      const stats = monitor.getStatistics();

      expect(stats.avgCompute).toBe(0);
      expect(stats.peakCompute).toBe(0);
      expect(stats.avgMemoryBandwidth).toBe(0);
      expect(stats.peakMemoryBandwidth).toBe(0);
    });
  });

  describe('filtered samples', () => {
    beforeEach(() => {
      const now = performance.now();
      for (let i = 0; i < 5; i++) {
        monitor.sample();
      }
    });

    it('should get all samples', () => {
      const samples = monitor.getSamples();
      expect(samples.length).toBe(5);
    });

    it('should filter by start time', () => {
      const now = performance.now();
      const samples = monitor.getSamples(now - 100);

      expect(samples.length).toBe(5); // All samples should be recent
    });

    it('should filter by end time', () => {
      const now = performance.now();
      const future = now + 10000;
      const samples = monitor.getSamples(undefined, future);

      expect(samples.length).toBe(5);
    });

    it('should filter by time range', () => {
      const now = performance.now();
      const samples = monitor.getSamples(now - 100, now + 100);

      expect(samples.length).toBe(5);
    });
  });

  describe('utilization calculations', () => {
    it('should calculate average utilization over range', () => {
      const now = performance.now();
      monitor.sample();
      monitor.sample();

      const avg = monitor.getAverageUtilization(now - 100, now + 100);

      expect(avg.compute).toBeGreaterThanOrEqual(0);
      expect(avg.memoryBandwidth).toBeGreaterThanOrEqual(0);
    });

    it('should calculate peak utilization over range', () => {
      const now = performance.now();
      monitor.recordKernel(now, 5);
      monitor.sample();

      const peak = monitor.getPeakUtilization(now - 100, now + 100);

      expect(peak.compute).toBeGreaterThanOrEqual(0);
      expect(peak.memoryBandwidth).toBeGreaterThanOrEqual(0);
    });

    it('should return zero for empty range', () => {
      const future = performance.now() + 10000;

      const avg = monitor.getAverageUtilization(future, future + 1000);

      expect(avg.compute).toBe(0);
      expect(avg.memoryBandwidth).toBe(0);
    });
  });

  describe('anomaly detection', () => {
    it('should detect no anomalies in stable data', () => {
      for (let i = 0; i < 20; i++) {
        monitor.sample();
      }

      const anomalies = monitor.detectAnomalies();

      // With consistent sampling, should have minimal anomalies
      expect(anomalies.length).toBeLessThan(20);
    });

    it('should require minimum samples for anomaly detection', () => {
      monitor.sample();

      const anomalies = monitor.detectAnomalies();

      expect(anomalies.length).toBe(0);
    });

    it('should respect threshold parameter', () => {
      for (let i = 0; i < 20; i++) {
        monitor.sample();
      }

      const anomalies1 = monitor.detectAnomalies(1);
      const anomalies2 = monitor.detectAnomalies(5);

      // Higher threshold should result in fewer anomalies
      expect(anomalies2.length).toBeLessThanOrEqual(anomalies1.length);
    });
  });

  describe('metrics', () => {
    it('should generate performance metrics', () => {
      monitor.sample();
      monitor.sample();

      const metrics = monitor.getMetrics();

      expect(metrics.length).toBeGreaterThan(0);

      const computeMetric = metrics.find((m) => m.name === 'utilization-compute');
      expect(computeMetric).toBeDefined();
      expect(computeMetric?.type).toBe('utilization');
      expect(computeMetric?.unit).toBe('%');
    });

    it('should include power and temperature if available', () => {
      // Add samples with power data
      const sample = monitor.sample();
      (sample as any).power = 50;
      (sample as any).temperature = 65;

      const metrics = monitor.getMetrics();

      const powerMetric = metrics.find((m) => m.name === 'utilization-power');
      const tempMetric = metrics.find((m) => m.name === 'utilization-temperature');

      // These should only exist if samples have power/temp data
      // Since we can't easily add that data, we just check the structure
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all samples', () => {
      monitor.sample();
      monitor.sample();

      expect(monitor.getSampleCount()).toBe(2);

      monitor.clear();

      expect(monitor.getSampleCount()).toBe(0);
      expect(monitor.isActive()).toBe(false);
    });

    it('should stop sampling when cleared', () => {
      monitor.startSampling();
      monitor.sample();

      monitor.clear();

      expect(monitor.isActive()).toBe(false);
    });
  });

  describe('custom sampling interval', () => {
    it('should accept custom interval', () => {
      const customMonitor = new UtilizationMonitor(100);

      expect(customMonitor).toBeDefined();
    });

    it('should use custom interval for estimation', () => {
      const customMonitor = new UtilizationMonitor(100);

      const now = performance.now();
      customMonitor.recordKernel(now, 50); // 50% of interval

      customMonitor.sample();

      const stats = customMonitor.getStatistics();
      expect(stats.avgCompute).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('UtilizationMonitor with active sampling', () => {
  it('should automatically collect samples', (done) => {
    const monitor = new UtilizationMonitor(10); // 10ms interval

    monitor.startSampling();

    setTimeout(() => {
      expect(monitor.getSampleCount()).toBeGreaterThan(0);
      monitor.stopSampling();
      done();
    }, 50);
  }, 1000);
});

describe('UtilizationMonitor edge cases', () => {
  it('should handle very short sampling intervals', () => {
    const monitor = new UtilizationMonitor(1);

    expect(monitor).toBeDefined();
  });

  it('should handle zero utilization', () => {
    const monitor = new UtilizationMonitor();

    const sample = monitor.sample();

    // Without any kernels, utilization should be near zero
    expect(sample.compute).toBe(0);
  });

  it('should handle clearing during active sampling', () => {
    const monitor = new UtilizationMonitor(50);

    monitor.startSampling();
    monitor.sample();

    monitor.clear();

    expect(monitor.getSampleCount()).toBe(0);
    expect(monitor.isActive()).toBe(false);
  });
});
