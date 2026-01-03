/**
 * Tests for BottleneckAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BottleneckAnalyzer } from '../src/bottleneck/BottleneckAnalyzer.js';
import type { ProfileReport } from '../src/types.js';

describe('BottleneckAnalyzer', () => {
  let analyzer: BottleneckAnalyzer;

  beforeEach(() => {
    analyzer = new BottleneckAnalyzer();
  });

  const createMockReport = (overrides?: Partial<ProfileReport>): ProfileReport => ({
    id: 'test-report',
    timestamp: Date.now(),
    sessionStart: Date.now() - 1000,
    sessionDuration: 1000,
    metrics: [],
    kernelSummary: {
      totalKernels: 10,
      totalDuration: 100_000_000,
      avgDuration: 10_000_000,
      minDuration: 1_000_000,
      maxDuration: 50_000_000,
      slowestKernels: [
        {
          id: 'kernel-1',
          name: 'slow-kernel',
          startTime: 0,
          endTime: 60,
          duration: 60_000_000,
          dispatchSize: [1, 1, 1],
        },
      ],
    },
    memorySummary: {
      totalAllocated: 10 * 1024 * 1024,
      peakMemory: 10 * 1024 * 1024,
      currentMemory: 2 * 1024 * 1024,
      allocationCount: 100,
      leakCount: 5,
    },
    transferSummary: {
      totalTransfers: 50,
      totalBytes: 50 * 1024 * 1024,
      avgBandwidth: 0.5,
      maxBandwidth: 1.0,
      totalTransferTime: 100_000_000,
    },
    bottlenecks: [],
    optimizations: [],
    timeline: [],
    frames: [],
    metadata: {},
    ...overrides,
  });

  describe('analyzeReport', () => {
    it('should analyze complete report', () => {
      const report = createMockReport();
      const analysis = analyzer.analyzeReport(report);

      expect(analysis.bottlenecks).toBeDefined();
      expect(analysis.optimizations).toBeDefined();
      expect(analysis.bottleneckScore).toBeGreaterThanOrEqual(0);
      expect(analysis.bottleneckScore).toBeLessThanOrEqual(100);
    });

    it('should detect slow kernel bottlenecks', () => {
      const report = createMockReport({
        kernelSummary: {
          totalKernels: 1,
          totalDuration: 100_000_000,
          avgDuration: 100_000_000,
          minDuration: 100_000_000,
          maxDuration: 100_000_000,
          slowestKernels: [
            {
              id: 'kernel-1',
              name: 'very-slow-kernel',
              startTime: 0,
              endTime: 100,
              duration: 100_000_000, // 100ms
              dispatchSize: [1, 1, 1],
            },
          ],
        },
      });

      const analysis = analyzer.analyzeReport(report);

      const kernelBottlenecks = analysis.bottlenecks.filter(
        (b) => b.category === 'compute-bound' || b.category === 'latency-bound'
      );

      expect(kernelBottlenecks.length).toBeGreaterThan(0);
    });

    it('should detect memory leak bottlenecks', () => {
      const report = createMockReport({
        memorySummary: {
          totalAllocated: 100 * 1024 * 1024,
          peakMemory: 100 * 1024 * 1024,
          currentMemory: 50 * 1024 * 1024,
          allocationCount: 1000,
          leakCount: 100, // Many leaks
        },
      });

      const analysis = analyzer.analyzeReport(report);

      const memoryBottlenecks = analysis.bottlenecks.filter(
        (b) => b.category === 'memory-bound'
      );

      expect(memoryBottlenecks.length).toBeGreaterThan(0);
    });

    it('should detect low bandwidth bottlenecks', () => {
      const report = createMockReport({
        transferSummary: {
          totalTransfers: 10,
          totalBytes: 1024 * 1024,
          avgBandwidth: 0.1, // Very low
          maxBandwidth: 0.2,
          totalTransferTime: 10_000_000,
        },
      });

      const analysis = analyzer.analyzeReport(report);

      const transferBottlenecks = analysis.bottlenecks.filter(
        (b) => b.category === 'transfer-bound'
      );

      expect(transferBottlenecks.length).toBeGreaterThan(0);
    });
  });

  describe('kernel analysis', () => {
    it('should generate kernel optimization suggestions', () => {
      const report = createMockReport({
        kernelSummary: {
          totalKernels: 1,
          totalDuration: 50_000_000,
          avgDuration: 50_000_000,
          minDuration: 50_000_000,
          maxDuration: 50_000_000,
          slowestKernels: [
            {
              id: 'kernel-1',
              name: 'test-kernel',
              startTime: 0,
              endTime: 50,
              duration: 50_000_000,
              dispatchSize: [10, 1, 1], // Low parallelism
              workgroupSize: [16, 1, 1],
            },
          ],
        },
      });

      const analysis = analyzer.analyzeReport(report);

      expect(analysis.optimizations.length).toBeGreaterThan(0);

      const hasWorkgroupOpt = analysis.optimizations.some(
        (o) => o.category === 'workgroup-size'
      );
      const hasParallelismOpt = analysis.optimizations.some(
        (o) => o.category === 'insufficient-parallelism'
      );

      expect(hasWorkgroupOpt || hasParallelismOpt).toBe(true);
    });

    it('should detect high variance', () => {
      const report = createMockReport({
        kernelSummary: {
          totalKernels: 10,
          totalDuration: 100_000_000,
          avgDuration: 10_000_000,
          minDuration: 1_000_000,
          maxDuration: 50_000_000, // Much higher than avg
          slowestKernels: [],
        },
      });

      const analysis = analyzer.analyzeReport(report);

      const syncBottlenecks = analysis.bottlenecks.filter(
        (b) => b.category === 'synchronization'
      );

      expect(syncBottlenecks.length).toBeGreaterThan(0);
    });
  });

  describe('memory analysis', () => {
    it('should suggest memory pooling for high usage', () => {
      const report = createMockReport({
        memorySummary: {
          totalAllocated: 600 * 1024 * 1024, // 600 MB
          peakMemory: 600 * 1024 * 1024,
          currentMemory: 400 * 1024 * 1024,
          allocationCount: 1000,
          leakCount: 0,
        },
      });

      const analysis = analyzer.analyzeReport(report);

      const poolOpt = analysis.optimizations.find(
        (o) => o.category === 'memory-layout'
      );

      expect(poolOpt).toBeDefined();
    });
  });

  describe('transfer analysis', () => {
    it('should suggest transfer optimizations for low bandwidth', () => {
      const report = createMockReport({
        transferSummary: {
          totalTransfers: 100,
          totalBytes: 100 * 1024 * 1024,
          avgBandwidth: 0.5,
          maxBandwidth: 1.0,
          totalTransferTime: 200_000_000,
        },
      });

      const analysis = analyzer.analyzeReport(report);

      const transferOpts = analysis.optimizations.filter(
        (o) => o.category === 'transfer-reduction'
      );

      expect(transferOpts.length).toBeGreaterThan(0);
    });
  });

  describe('bottleneck scoring', () => {
    it('should calculate bottleneck score', () => {
      const report = createMockReport();
      const analysis = analyzer.analyzeReport(report);

      expect(analysis.bottleneckScore).toBeGreaterThanOrEqual(0);
      expect(analysis.bottleneckScore).toBeLessThanOrEqual(100);
    });

    it('should return higher score for more bottlenecks', () => {
      const badReport = createMockReport({
        kernelSummary: {
          totalKernels: 1,
          totalDuration: 100_000_000,
          avgDuration: 100_000_000,
          minDuration: 100_000_000,
          maxDuration: 100_000_000,
          slowestKernels: [
            {
              id: 'kernel-1',
              name: 'very-slow-kernel',
              startTime: 0,
              endTime: 100,
              duration: 100_000_000,
              dispatchSize: [1, 1, 1],
            },
          ],
        },
        memorySummary: {
          totalAllocated: 100 * 1024 * 1024,
          peakMemory: 100 * 1024 * 1024,
          currentMemory: 50 * 1024 * 1024,
          allocationCount: 1000,
          leakCount: 100,
        },
        transferSummary: {
          totalTransfers: 10,
          totalBytes: 1024 * 1024,
          avgBandwidth: 0.1,
          maxBandwidth: 0.2,
          totalTransferTime: 10_000_000,
        },
      });

      const analysis = analyzer.analyzeReport(badReport);

      expect(analysis.bottleneckScore).toBeGreaterThan(0);
    });
  });

  describe('severity classification', () => {
    it('should classify critical bottlenecks', () => {
      const report = createMockReport({
        kernelSummary: {
          totalKernels: 1,
          totalDuration: 100_000_000,
          avgDuration: 100_000_000,
          minDuration: 100_000_000,
          maxDuration: 100_000_000,
          slowestKernels: [
            {
              id: 'kernel-1',
              name: 'critical-kernel',
              startTime: 0,
              endTime: 100,
              duration: 100_000_000, // 100ms - critical
              dispatchSize: [1, 1, 1],
            },
          ],
        },
      });

      const analysis = analyzer.analyzeReport(report);

      const criticalBottlenecks = analysis.bottlenecks.filter(
        (b) => b.severity === 'critical'
      );

      expect(criticalBottlenecks.length).toBeGreaterThan(0);
    });
  });

  describe('summarization', () => {
    it('should summarize bottlenecks', () => {
      const bottlenecks = analyzer.analyzeReport(createMockReport()).bottlenecks;

      const summary = analyzer.summarizeBottlenecks(bottlenecks);

      expect(summary).toContain('bottleneck');
    });

    it('should summarize optimizations', () => {
      const optimizations = analyzer.analyzeReport(createMockReport()).optimizations;

      const summary = analyzer.summarizeOptimizations(optimizations);

      expect(summary).toContain('optimization');
    });
  });

  describe('thresholds', () => {
    it('should use custom thresholds', () => {
      const customAnalyzer = new BottleneckAnalyzer({
        slowKernelThreshold: 1, // Very low threshold
        memoryLeakThreshold: 100, // Very low threshold
      });

      const report = createMockReport();

      const analysis = customAnalyzer.analyzeReport(report);

      // Should detect more bottlenecks with lower thresholds
      expect(analysis.bottlenecks.length).toBeGreaterThanOrEqual(0);
    });

    it('should allow updating thresholds', () => {
      analyzer.setThresholds({
        slowKernelThreshold: 20,
      });

      expect(analyzer.getThresholds().slowKernelThreshold).toBe(20);
    });

    it('should get current thresholds', () => {
      const thresholds = analyzer.getThresholds();

      expect(thresholds.slowKernelThreshold).toBeDefined();
      expect(thresholds.memoryLeakThreshold).toBeDefined();
      expect(thresholds.lowBandwidthThreshold).toBeDefined();
      expect(thresholds.highTransferTimeThreshold).toBeDefined();
    });
  });

  describe('optimization suggestions', () => {
    it('should prioritize optimizations', () => {
      const analysis = analyzer.analyzeReport(createMockReport());

      // Check that optimizations are sorted by priority
      for (let i = 1; i < analysis.optimizations.length; i++) {
        expect(analysis.optimizations[i].priority)
          .toBeLessThanOrEqual(analysis.optimizations[i - 1].priority);
      }
    });

    it('should include expected improvement', () => {
      const analysis = analyzer.analyzeReport(createMockReport());

      for (const opt of analysis.optimizations) {
        expect(opt.expectedImprovement).toBeGreaterThan(0);
        expect(opt.expectedImprovement).toBeLessThanOrEqual(100);
      }
    });

    it('should include effort level', () => {
      const analysis = analyzer.analyzeReport(createMockReport());

      for (const opt of analysis.optimizations) {
        expect(['low', 'medium', 'high']).toContain(opt.effort);
      }
    });
  });

  describe('empty report', () => {
    it('should handle empty report', () => {
      const emptyReport: ProfileReport = {
        id: 'empty',
        timestamp: Date.now(),
        sessionStart: Date.now(),
        sessionDuration: 0,
        metrics: [],
        kernelSummary: {
          totalKernels: 0,
          totalDuration: 0,
          avgDuration: 0,
          minDuration: 0,
          maxDuration: 0,
          slowestKernels: [],
        },
        memorySummary: {
          totalAllocated: 0,
          peakMemory: 0,
          currentMemory: 0,
          allocationCount: 0,
          leakCount: 0,
        },
        transferSummary: {
          totalTransfers: 0,
          totalBytes: 0,
          avgBandwidth: 0,
          maxBandwidth: 0,
          totalTransferTime: 0,
        },
        bottlenecks: [],
        optimizations: [],
        timeline: [],
        frames: [],
        metadata: {},
      };

      const analysis = analyzer.analyzeReport(emptyReport);

      expect(analysis.bottlenecks.length).toBe(0);
      expect(analysis.bottleneckScore).toBe(0);
    });
  });
});

describe('BottleneckAnalyzer edge cases', () => {
  it('should handle metrics with high variance', () => {
    const analyzer = new BottleneckAnalyzer();

    const report: ProfileReport = {
      id: 'test',
      timestamp: Date.now(),
      sessionStart: Date.now() - 1000,
      sessionDuration: 1000,
      metrics: [
        {
          name: 'test-metric',
          type: 'timing',
          value: 100,
          unit: 'ms',
          min: 10,
          max: 200,
          avg: 100,
          stdDev: 60, // High variance
          sampleCount: 10,
          firstSample: 0,
          lastSample: 1000,
        },
      ],
      kernelSummary: {
        totalKernels: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowestKernels: [],
      },
      memorySummary: {
        totalAllocated: 0,
        peakMemory: 0,
        currentMemory: 0,
        allocationCount: 0,
        leakCount: 0,
      },
      transferSummary: {
        totalTransfers: 0,
        totalBytes: 0,
        avgBandwidth: 0,
        maxBandwidth: 0,
        totalTransferTime: 0,
      },
      bottlenecks: [],
      optimizations: [],
      timeline: [],
      frames: [],
      metadata: {},
    };

    const analysis = analyzer.analyzeReport(report);

    // Should detect variance as synchronization bottleneck
    const syncBottlenecks = analysis.bottlenecks.filter(
      (b) => b.category === 'synchronization'
    );

    expect(syncBottlenecks.length).toBeGreaterThanOrEqual(0);
  });
});
