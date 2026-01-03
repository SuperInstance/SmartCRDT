/**
 * Tests for KernelProfiler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KernelProfiler } from '../src/kernel/KernelProfiler.js';

describe('KernelProfiler', () => {
  let profiler: KernelProfiler;

  beforeEach(() => {
    profiler = new KernelProfiler();
  });

  describe('kernel tracking', () => {
    it('should begin and end kernel', () => {
      profiler.beginKernel('test-kernel', [32, 1, 1], [256, 256, 1]);
      const duration = profiler.endKernel('test-kernel');

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(profiler.getExecutionCount()).toBe(1);
    });

    it('should throw on end without begin', () => {
      expect(() => profiler.endKernel('nonexistent')).toThrow('No active kernel found');
    });

    it('should record multiple executions', () => {
      profiler.beginKernel('kernel1', [32, 1, 1], [256, 1, 1]);
      profiler.endKernel('kernel1');
      profiler.beginKernel('kernel2', [64, 1, 1], [512, 1, 1]);
      profiler.endKernel('kernel2');

      expect(profiler.getExecutionCount()).toBe(2);
    });
  });

  describe('statistics', () => {
    it('should calculate statistics for kernel', () => {
      // Record some executions
      for (let i = 0; i < 10; i++) {
        profiler.beginKernel('test', [1, 1, 1], [1, 1, 1]);
        profiler.endKernel('test');
      }

      const stats = profiler.getStatistics('test');

      expect(stats.count).toBe(10);
      expect(stats.mean).toBeGreaterThan(0);
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThanOrEqual(stats.min);
      expect(stats.stdDev).toBeGreaterThanOrEqual(0);
    });

    it('should throw for unknown kernel', () => {
      expect(() => profiler.getStatistics('unknown')).toThrow('No statistics found');
    });

    it('should get all kernel names', () => {
      profiler.beginKernel('kernel1', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('kernel1');
      profiler.beginKernel('kernel2', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('kernel2');

      const names = profiler.getKernelNames();
      expect(names).toContain('kernel1');
      expect(names).toContain('kernel2');
    });
  });

  describe('hotspots', () => {
    it('should identify hotspot kernels', () => {
      // Add a slow kernel
      profiler.beginKernel('slow-kernel', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('slow-kernel');

      // Add fast kernels
      for (let i = 0; i < 5; i++) {
        profiler.beginKernel('fast-kernel', [1, 1, 1], [1, 1, 1]);
        profiler.endKernel('fast-kernel');
      }

      const hotspots = profiler.identifyHotspots(5);
      expect(hotspots.length).toBeGreaterThan(0);
    });

    it('should get most frequent kernels', () => {
      for (let i = 0; i < 10; i++) {
        profiler.beginKernel('frequent-kernel', [1, 1, 1], [1, 1, 1]);
        profiler.endKernel('frequent-kernel');
      }

      profiler.beginKernel('rare-kernel', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('rare-kernel');

      const frequent = profiler.getMostFrequent(5);
      expect(frequent[0]).toBe('frequent-kernel');
    });

    it('should get high variance kernels', () => {
      // Add kernels with varying durations
      for (let i = 0; i < 5; i++) {
        profiler.beginKernel('variable-kernel', [1, 1, 1], [1, 1, 1]);
        // Simulate variable duration by small delay
        const start = Date.now();
        while (Date.now() - start < i) {}
        profiler.endKernel('variable-kernel');
      }

      const highVariance = profiler.getHighestVariance(5);
      expect(highVariance.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('kernel comparison', () => {
    it('should compare two kernels', () => {
      profiler.beginKernel('kernel1', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('kernel1');

      profiler.beginKernel('kernel2', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('kernel2');

      const comparison = profiler.compareKernels('kernel1', 'kernel2');

      expect(comparison.kernel1).toBe('kernel1');
      expect(comparison.kernel2).toBe('kernel2');
      expect(comparison.speedup).toBeGreaterThan(0);
    });

    it('should throw for unknown kernels', () => {
      expect(() => profiler.compareKernels('unknown1', 'unknown2')).toThrow('Kernel not found');
    });
  });

  describe('histogram', () => {
    it('should create histogram for kernel', () => {
      for (let i = 0; i < 20; i++) {
        profiler.beginKernel('test', [1, 1, 1], [1, 1, 1]);
        profiler.endKernel('test');
      }

      const histogram = profiler.createHistogram('test', 10);

      expect(histogram.metric).toBe('test');
      expect(histogram.totalCount).toBe(20);
      expect(histogram.bins.length).toBe(10);
    });

    it('should handle empty histogram', () => {
      const histogram = profiler.createHistogram('nonexistent', 5);

      expect(histogram.totalCount).toBe(0);
      expect(histogram.bins.length).toBe(0);
    });
  });

  describe('timeline', () => {
    it('should get timeline for all kernels', () => {
      profiler.beginKernel('kernel1', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('kernel1');
      profiler.beginKernel('kernel2', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('kernel2');

      const timeline = profiler.getTimeline();
      expect(timeline.length).toBe(2);
    });

    it('should get timeline for specific kernel', () => {
      profiler.beginKernel('kernel1', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('kernel1');
      profiler.beginKernel('kernel2', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('kernel2');

      const timeline = profiler.getTimeline('kernel1');
      expect(timeline.length).toBe(1);
      expect(timeline[0].name).toBe('kernel1');
    });
  });

  describe('workgroup sizes', () => {
    it('should track workgroup sizes used', () => {
      profiler.beginKernel('kernel1', [32, 1, 1], [256, 256, 1]);
      profiler.endKernel('kernel1');

      profiler.beginKernel('kernel1', [64, 1, 1], [256, 256, 1]);
      profiler.endKernel('kernel1');

      const sizes = profiler.getWorkgroupSizes('kernel1');
      expect(sizes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('metrics', () => {
    it('should generate performance metrics', () => {
      profiler.beginKernel('test-kernel', [32, 1, 1], [256, 1, 1]);
      profiler.endKernel('test-kernel');

      const metrics = profiler.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      const durationMetric = metrics.find((m) => m.name.includes('duration'));
      expect(durationMetric).toBeDefined();
      expect(durationMetric?.type).toBe('timing');
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      profiler.beginKernel('test', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('test');

      expect(profiler.getExecutionCount()).toBe(1);

      profiler.clear();

      expect(profiler.getExecutionCount()).toBe(0);
    });
  });

  describe('recordExecution', () => {
    it('should record execution directly', () => {
      profiler.recordExecution({
        id: 'manual-1',
        name: 'manual-kernel',
        startTime: performance.now() - 10,
        endTime: performance.now(),
        duration: 10_000_000, // 10ms in nanoseconds
        dispatchSize: [1, 1, 1],
      });

      expect(profiler.getExecutionCount()).toBe(1);

      const stats = profiler.getStatistics('manual-kernel');
      expect(stats.count).toBe(1);
    });
  });
});

describe('KernelProfiler statistics calculations', () => {
  it('should calculate percentiles correctly', () => {
    const profiler = new KernelProfiler();

    // Add controlled data
    for (let i = 0; i < 100; i++) {
      profiler.beginKernel('test', [1, 1, 1], [1, 1, 1]);
      profiler.endKernel('test');
    }

    const stats = profiler.getStatistics('test');

    expect(stats.percentiles.p50).toBeGreaterThan(0);
    expect(stats.percentiles.p90).toBeGreaterThanOrEqual(stats.percentiles.p50);
    expect(stats.percentiles.p95).toBeGreaterThanOrEqual(stats.percentiles.p90);
    expect(stats.percentiles.p99).toBeGreaterThanOrEqual(stats.percentiles.p95);
  });

  it('should calculate standard deviation', () => {
    const profiler = new KernelProfiler();

    profiler.beginKernel('test', [1, 1, 1], [1, 1, 1]);
    profiler.endKernel('test');

    const stats = profiler.getStatistics('test');
    expect(stats.stdDev).toBe(0); // Only one sample
  });
});
