/**
 * LatencyProfiler Tests
 * Tests for latency profiling and analysis.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LatencyProfiler, ThroughputTester, ResourceMonitor } from '../src/index.js';

describe('LatencyProfiler', () => {
  let profiler: LatencyProfiler;

  beforeEach(() => {
    profiler = new LatencyProfiler();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      expect(profiler).toBeInstanceOf(LatencyProfiler);
    });

    it('should accept custom config', () => {
      const customProfiler = new LatencyProfiler({
        maxSamples: 5000,
        trackingEnabled: true
      });

      expect(customProfiler).toBeInstanceOf(LatencyProfiler);
    });
  });

  describe('Recording Samples', () => {
    it('should record latency sample', () => {
      profiler.recordSample({
        timestamp: Date.now(),
        latency: 100,
        operation: 'test',
        success: true
      });

      expect(profiler.getSampleCount()).toBe(1);
    });

    it('should record multiple samples', () => {
      for (let i = 0; i < 10; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 100 + i * 10,
          operation: 'test',
          success: true
        });
      }

      expect(profiler.getSampleCount()).toBe(10);
    });

    it('should not record when tracking disabled', () => {
      const disabledProfiler = new LatencyProfiler({ trackingEnabled: false });

      disabledProfiler.recordSample({
        timestamp: Date.now(),
        latency: 100,
        operation: 'test',
        success: true
      });

      expect(disabledProfiler.getSampleCount()).toBe(0);
    });

    it('should trim samples exceeding max', () => {
      const smallMaxProfiler = new LatencyProfiler({ maxSamples: 5 });

      for (let i = 0; i < 10; i++) {
        smallMaxProfiler.recordSample({
          timestamp: Date.now() + i,
          latency: 100,
          operation: 'test',
          success: true
        });
      }

      expect(smallMaxProfiler.getSampleCount()).toBe(5);
    });
  });

  describe('Latency Metrics', () => {
    it('should calculate metrics from samples', () => {
      for (let i = 0; i < 10; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 50 + i * 10,
          operation: 'test',
          success: true
        });
      }

      const metrics = profiler.getMetrics();

      expect(metrics.min).toBe(50);
      expect(metrics.max).toBe(140);
      expect(metrics.mean).toBeGreaterThan(0);
      expect(metrics.p50).toBeGreaterThan(0);
      expect(metrics.p95).toBeGreaterThan(0);
      expect(metrics.p99).toBeGreaterThan(0);
    });

    it('should return empty metrics with no samples', () => {
      const metrics = profiler.getMetrics();

      expect(metrics.min).toBe(0);
      expect(metrics.max).toBe(0);
      expect(metrics.mean).toBe(0);
    });

    it('should calculate percentiles correctly', () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      for (let i = 0; i < latencies.length; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: latencies[i],
          operation: 'test',
          success: true
        });
      }

      const metrics = profiler.getMetrics();

      expect(metrics.p50).toBeCloseTo(60, 0);
      expect(metrics.p95).toBe(100);
    });

    it('should calculate standard deviation', () => {
      for (let i = 0; i < 10; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 100,
          operation: 'test',
          success: true
        });
      }

      const metrics = profiler.getMetrics();

      expect(metrics.stddev).toBe(0);
    });
  });

  describe('Histogram', () => {
    it('should generate histogram', () => {
      for (let i = 0; i < 100; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 10 + i * 5,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(report.histogram.buckets.length).toBeGreaterThan(0);
      expect(report.histogram.counts.length).toBe(report.histogram.buckets.length);
    });

    it('should calculate histogram statistics', () => {
      for (let i = 0; i < 50; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 50 + i * 2,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(report.histogram.min).toBeGreaterThan(0);
      expect(report.histogram.max).toBeGreaterThan(report.histogram.min);
      expect(report.histogram.mean).toBeGreaterThan(0);
    });
  });

  describe('Outlier Detection', () => {
    it('should detect outliers', () => {
      // Normal samples
      for (let i = 0; i < 30; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 100,
          operation: 'test',
          success: true
        });
      }

      // Add outlier
      profiler.recordSample({
        timestamp: Date.now() + 30,
        latency: 1000, // Way above normal
        operation: 'test',
        success: true
      });

      const report = profiler.generateReport();

      expect(report.outliers.length).toBeGreaterThan(0);
    });

    it('should classify outlier severity', () => {
      for (let i = 0; i < 30; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 100,
          operation: 'test',
          success: true
        });
      }

      // Extreme outlier
      profiler.recordSample({
        timestamp: Date.now() + 30,
        latency: 10000,
        operation: 'test',
        success: true
      });

      const report = profiler.generateReport();

      const extremeOutlier = report.outliers.find(o => o.severity === 'extreme');
      expect(extremeOutlier).toBeDefined();
    });

    it('should calculate z-score for outliers', () => {
      for (let i = 0; i < 30; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 100,
          operation: 'test',
          success: true
        });
      }

      profiler.recordSample({
        timestamp: Date.now() + 30,
        latency: 1000,
        operation: 'test',
        success: true
      });

      const report = profiler.generateReport();

      expect(report.outliers[0].zScore).toBeGreaterThan(3);
    });
  });

  describe('Trend Analysis', () => {
    it('should detect improving trend', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 200 - i * 5, // Improving
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(report.analysis.trend).toBe('improving');
    });

    it('should detect degrading trend', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100 + i * 10, // Degrading
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(report.analysis.trend).toBe('degrading');
    });

    it('should detect stable trend', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100, // Stable
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(report.analysis.trend).toBe('stable');
    });

    it('should calculate trend strength', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100 + i * 5,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(report.analysis.trendStrength).toBeGreaterThan(0);
    });

    it('should analyze variability', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100 + Math.random() * 20,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(['low', 'medium', 'high']).toContain(report.analysis.variability);
    });

    it('should find dominant percentile', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100 + Math.random() * 50,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect([50, 75, 90, 95]).toContain(report.analysis.dominantPercentile);
    });
  });

  describe('Recommendations', () => {
    it('should generate recommendations for degrading latency', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100 + i * 20,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(report.analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate recommendations for high variability', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100 + Math.random() * 200,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(report.analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('should recommend healthy when stable', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      const healthyRec = report.analysis.recommendations.find(r =>
        r.toLowerCase().includes('healthy')
      );

      expect(healthyRec).toBeDefined();
    });
  });

  describe('Time Series', () => {
    it('should track time series', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      expect(report.timeSeries.length).toBeGreaterThan(0);
    });

    it('should calculate time series metrics', () => {
      for (let i = 0; i < 20; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          operation: 'test',
          success: true
        });
      }

      const report = profiler.generateReport();

      for (const ts of report.timeSeries) {
        expect(ts.mean).toBeGreaterThan(0);
        expect(ts.p50).toBeGreaterThan(0);
        expect(ts.p95).toBeGreaterThan(0);
        expect(ts.p99).toBeGreaterThan(0);
        expect(ts.count).toBeGreaterThan(0);
      }
    });
  });

  describe('Reset', () => {
    it('should reset profiler', () => {
      for (let i = 0; i < 10; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 100,
          operation: 'test',
          success: true
        });
      }

      expect(profiler.getSampleCount()).toBe(10);

      profiler.reset();

      expect(profiler.getSampleCount()).toBe(0);
    });
  });
});

describe('ThroughputTester', () => {
  let tester: ThroughputTester;
  let mockExecutor: any;

  beforeEach(() => {
    tester = new ThroughputTester();
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      })
    };
  });

  describe('Throughput Testing', () => {
    it('should test throughput by size', async () => {
      const config = {
        duration: 2000,
        requestSizes: [100, 1000, 10000],
        concurrentRequests: 10,
        timeout: 30000
      };

      const result = await tester.execute(config, mockExecutor);

      expect(result.throughputBySize).toBeDefined();
      expect(result.throughputBySize.length).toBe(3);
    });

    it('should test latency vs throughput', async () => {
      const config = {
        duration: 1000,
        requestSizes: [1000],
        concurrentRequests: 10,
        timeout: 30000
      };

      const result = await tester.execute(config, mockExecutor);

      expect(result.latencyVsThroughput).toBeDefined();
      expect(result.latencyVsThroughput.length).toBeGreaterThan(0);
    });

    it('should find optimal concurrency', async () => {
      const config = {
        duration: 1000,
        requestSizes: [1000],
        concurrentRequests: 10,
        timeout: 30000
      };

      const result = await tester.execute(config, mockExecutor);

      expect(result.optimalConcurrency).toBeGreaterThan(0);
    });

    it('should identify bottleneck', async () => {
      const config = {
        duration: 1000,
        requestSizes: [1000],
        concurrentRequests: 10,
        timeout: 30000
      };

      const result = await tester.execute(config, mockExecutor);

      expect(['cpu', 'bandwidth', 'contention', 'unknown']).toContain(result.bottleneck);
    });
  });
});

describe('ResourceMonitor', () => {
  let monitor: ResourceMonitor;

  beforeEach(() => {
    monitor = new ResourceMonitor();
  });

  describe('Initialization', () => {
    it('should initialize monitor', () => {
      expect(monitor).toBeInstanceOf(ResourceMonitor);
    });

    it('should accept custom config', () => {
      const customMonitor = new ResourceMonitor({
        sampleInterval: 500,
        maxSamples: 100,
        trackCpu: true,
        trackMemory: true
      });

      expect(customMonitor).toBeInstanceOf(ResourceMonitor);
    });
  });

  describe('Monitoring', () => {
    it('should start monitoring', () => {
      monitor.start();
      expect(monitor).toBeDefined();
      monitor.stop();
    });

    it('should capture snapshots', () => {
      monitor.start();

      const snapshot = monitor.captureSnapshot();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.cpu).toBeGreaterThanOrEqual(0);
      expect(snapshot.memory.used).toBeGreaterThan(0);

      monitor.stop();
    });

    it('should stop monitoring', () => {
      monitor.start();
      monitor.stop();

      expect(monitor).toBeDefined();
    });

    it('should track CPU usage', () => {
      monitor.start();

      for (let i = 0; i < 5; i++) {
        monitor.captureSnapshot();
      }

      const report = monitor.generateReport();

      expect(report.cpu.avg).toBeGreaterThanOrEqual(0);

      monitor.stop();
    });

    it('should track memory usage', () => {
      monitor.start();

      for (let i = 0; i < 5; i++) {
        monitor.captureSnapshot();
      }

      const report = monitor.generateReport();

      expect(report.memory.avg).toBeGreaterThanOrEqual(0);

      monitor.stop();
    });
  });

  describe('Resource Reports', () => {
    it('should generate report', () => {
      monitor.start();

      for (let i = 0; i < 10; i++) {
        monitor.captureSnapshot();
      }

      const report = monitor.generateReport();

      expect(report.duration).toBeGreaterThan(0);
      expect(report.samples).toBe(10);

      monitor.stop();
    });

    it('should calculate resource statistics', () => {
      monitor.start();

      for (let i = 0; i < 10; i++) {
        monitor.captureSnapshot();
      }

      const report = monitor.generateReport();

      expect(report.cpu.min).toBeGreaterThanOrEqual(0);
      expect(report.cpu.max).toBeGreaterThanOrEqual(report.cpu.min);
      expect(report.memory.min).toBeGreaterThanOrEqual(0);
      expect(report.memory.max).toBeGreaterThanOrEqual(report.memory.min);

      monitor.stop();
    });

    it('should find peaks', () => {
      monitor.start();

      for (let i = 0; i < 10; i++) {
        monitor.captureSnapshot();
      }

      const report = monitor.generateReport();

      expect(report.peaks.cpu).toBeGreaterThanOrEqual(0);
      expect(report.peaks.memory).toBeGreaterThanOrEqual(0);
      expect(report.peaks.timestamp).toBeGreaterThan(0);

      monitor.stop();
    });

    it('should analyze trends', () => {
      monitor.start();

      for (let i = 0; i < 10; i++) {
        monitor.captureSnapshot();
      }

      const report = monitor.generateReport();

      expect(['increasing', 'stable', 'decreasing']).toContain(report.trends.cpu);
      expect(['increasing', 'stable', 'decreasing']).toContain(report.trends.memory);

      monitor.stop();
    });

    it('should calculate trend score', () => {
      monitor.start();

      for (let i = 0; i < 10; i++) {
        monitor.captureSnapshot();
      }

      const report = monitor.generateReport();

      expect(report.trends.score).toBeGreaterThanOrEqual(-1);
      expect(report.trends.score).toBeLessThanOrEqual(1);

      monitor.stop();
    });
  });

  describe('Current Metrics', () => {
    it('should get current metrics', () => {
      const metrics = monitor.getCurrentMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.cpu).toBeDefined();
      expect(metrics.memory).toBeDefined();
    });
  });

  describe('Reset', () => {
    it('should reset monitor', () => {
      monitor.start();

      for (let i = 0; i < 5; i++) {
        monitor.captureSnapshot();
      }

      expect(monitor.getSnapshots().length).toBeGreaterThan(0);

      monitor.reset();

      expect(monitor.getSnapshots().length).toBe(0);

      monitor.stop();
    });
  });

  describe('Network Tracking', () => {
    it('should track network when enabled', () => {
      const networkMonitor = new ResourceMonitor({ trackNetwork: true });

      networkMonitor.start();

      const snapshot = networkMonitor.captureSnapshot();

      expect(snapshot.network).toBeDefined();

      networkMonitor.stop();
    });

    it('should not track network when disabled', () => {
      const noNetworkMonitor = new ResourceMonitor({ trackNetwork: false });

      noNetworkMonitor.start();

      const snapshot = noNetworkMonitor.captureSnapshot();

      expect(snapshot.network).toBeUndefined();

      noNetworkMonitor.stop();
    });
  });

  describe('Disk Tracking', () => {
    it('should track disk when enabled', () => {
      const diskMonitor = new ResourceMonitor({ trackDisk: true });

      diskMonitor.start();

      const snapshot = diskMonitor.captureSnapshot();

      expect(snapshot.disk).toBeDefined();

      diskMonitor.stop();
    });
  });

  describe('Edge Cases', () => {
    it('should handle no samples', () => {
      const report = monitor.generateReport();

      expect(report).toBeDefined();
      expect(report.samples).toBe(0);
    });

    it('should handle single sample', () => {
      monitor.start();
      monitor.captureSnapshot();

      const report = monitor.generateReport();

      expect(report.samples).toBe(1);

      monitor.stop();
    });
  });
});
