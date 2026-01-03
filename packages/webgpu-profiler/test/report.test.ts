/**
 * Tests for PerformanceReport
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceReport } from '../src/report/PerformanceReport.js';
import type { ProfileReport } from '../src/types.js';

describe('PerformanceReport', () => {
  let reporter: PerformanceReport;

  beforeEach(() => {
    reporter = new PerformanceReport();
  });

  const createMockReport = (overrides?: Partial<ProfileReport>): ProfileReport => ({
    id: 'test-report',
    timestamp: Date.now(),
    sessionStart: Date.now() - 1000,
    sessionDuration: 1000,
    metrics: [
      {
        name: 'test-metric',
        type: 'timing',
        value: 100,
        unit: 'ms',
        min: 50,
        max: 150,
        avg: 100,
        sampleCount: 10,
        firstSample: 0,
        lastSample: 1000,
      },
    ],
    kernelSummary: {
      totalKernels: 10,
      totalDuration: 100_000_000,
      avgDuration: 10_000_000,
      minDuration: 1_000_000,
      maxDuration: 50_000_000,
      slowestKernels: [],
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
      avgBandwidth: 2.5,
      maxBandwidth: 5.0,
      totalTransferTime: 20_000_000,
    },
    bottlenecks: [],
    optimizations: [],
    timeline: [],
    frames: [],
    metadata: {},
    ...overrides,
  });

  describe('generateReport', () => {
    it('should generate JSON report', () => {
      const report = createMockReport();
      const json = reporter.generateReport(report, { format: 'json' });

      expect(json).toBeDefined();
      expect(json.startsWith('{')).toBe(true);

      const parsed = JSON.parse(json);
      expect(parsed.id).toBe('test-report');
    });

    it('should generate CSV report', () => {
      const report = createMockReport();
      const csv = reporter.generateReport(report, { format: 'csv' });

      expect(csv).toContain('# Summary');
      expect(csv).toContain('Session Duration');
    });

    it('should generate HTML report', () => {
      const report = createMockReport();
      const html = reporter.generateReport(report, { format: 'html' });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('WebGPU Profiling Report');
    });

    it('should generate Markdown report', () => {
      const report = createMockReport();
      const md = reporter.generateReport(report, { format: 'markdown' });

      expect(md).toContain('# WebGPU Profiling Report');
      expect(md).toContain('## Summary');
    });

    it('should throw on unsupported format', () => {
      const report = createMockReport();

      expect(() => reporter.generateReport(report, { format: 'pdf' as any })).toThrow('Unsupported export format');
    });
  });

  describe('exportAsJSON', () => {
    it('should export report as JSON', () => {
      const report = createMockReport();
      const json = reporter.exportAsJSON(report);

      expect(json).toBeDefined();

      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(report.id);
      expect(parsed.timestamp).toBe(report.timestamp);
      expect(parsed.summary).toBeDefined();
    });

    it('should include bottlenecks when requested', () => {
      const report = createMockReport();
      const json = reporter.exportAsJSON(report, { includeBottlenecks: true });

      const parsed = JSON.parse(json);

      expect(parsed.bottlenecks).toBeDefined();
      expect(parsed.optimizations).toBeDefined();
    });

    it('should include timeline when requested', () => {
      const report = createMockReport({
        timeline: [
          {
            type: 'kernel',
            id: '1',
            name: 'test-kernel',
            startTime: 0,
            endTime: 10,
            duration: 10,
            metadata: {},
          },
        ],
      });

      const json = reporter.exportAsJSON(report, { includeTimeline: true });

      const parsed = JSON.parse(json);

      expect(parsed.timeline).toBeDefined();
      expect(parsed.timeline.length).toBe(1);
    });

    it('should include raw data when requested', () => {
      const report = createMockReport();
      const json = reporter.exportAsJSON(report, { includeRawData: true });

      const parsed = JSON.parse(json);

      expect(parsed.metrics).toBeDefined();
      expect(parsed.frames).toBeDefined();
    });
  });

  describe('exportAsCSV', () => {
    it('should export summary section', () => {
      const report = createMockReport();
      const csv = reporter.exportAsCSV(report);

      expect(csv).toContain('# Summary');
      expect(csv).toContain('Total Kernels,10');
      expect(csv).toContain('Avg Kernel Duration,');
      expect(csv).toContain('Total Memory,');
    });

    it('should export metrics when requested', () => {
      const report = createMockReport();
      const csv = reporter.exportAsCSV(report, { includeRawData: true });

      expect(csv).toContain('# Metrics');
      expect(csv).toContain('Name,Type,Value,Unit');
    });

    it('should export bottlenecks when requested', () => {
      const report = createMockReport();
      const csv = reporter.exportAsCSV(report, { includeBottlenecks: true });

      expect(csv).toContain('# Bottlenecks');
      expect(csv).toContain('Category,Severity,Description');
    });

    it('should export optimizations when requested', () => {
      const report = createMockReport();
      const csv = reporter.exportAsCSV(report, { includeBottlenecks: true });

      expect(csv).toContain('# Optimization Suggestions');
      expect(csv).toContain('Title,Category,Expected Improvement');
    });
  });

  describe('exportAsHTML', () => {
    it('should export complete HTML report', () => {
      const report = createMockReport();
      const html = reporter.exportAsHTML(report);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>WebGPU Profiling Report</title>');
      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
    });

    it('should include summary cards', () => {
      const report = createMockReport();
      const html = reporter.exportAsHTML(report);

      expect(html).toContain('metric-card');
      expect(html).toContain('Total Kernels');
      expect(html).toContain('10');
    });

    it('should include bottlenecks when requested', () => {
      const report = createMockReport();
      const html = reporter.exportAsHTML(report, { includeBottlenecks: true });

      expect(html).toContain('Bottlenecks');
    });

    it('should include optimizations when requested', () => {
      const report = createMockReport();
      const html = reporter.exportAsHTML(report, { includeBottlenecks: true });

      expect(html).toContain('Optimization Suggestions');
    });

    it('should include metrics table when requested', () => {
      const report = createMockReport();
      const html = reporter.exportAsHTML(report, { includeRawData: true });

      expect(html).toContain('Metrics');
      expect(html).toContain('<table>');
    });

    it('should escape HTML in report data', () => {
      const report = createMockReport({
        bottlenecks: [
          {
            category: 'compute-bound',
            severity: 'high',
            description: '<script>alert("xss")</script>',
            affectedComponent: ['test'],
            impact: 50,
            evidence: [],
            suggestions: [],
          },
        ],
      });

      const html = reporter.exportAsHTML(report, { includeBottlenecks: true });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('exportAsMarkdown', () => {
    it('should export markdown report', () => {
      const report = createMockReport();
      const md = reporter.exportAsMarkdown(report);

      expect(md).toContain('# WebGPU Profiling Report');
      expect(md).toContain('**Generated:**');
      expect(md).toContain('**Session ID:**');
      expect(md).toContain('**Duration:**');
    });

    it('should include summary table', () => {
      const report = createMockReport();
      const md = reporter.exportAsMarkdown(report);

      expect(md).toContain('## Summary');
      expect(md).toContain('| Metric | Value |');
      expect(md).toContain('| Total Kernels | 10 |');
    });

    it('should include bottlenecks section', () => {
      const report = createMockReport();
      const md = reporter.exportAsMarkdown(report, { includeBottlenecks: true });

      expect(md).toContain('## Bottlenecks');
    });

    it('should include optimizations section', () => {
      const report = createMockReport();
      const md = reporter.exportAsMarkdown(report, { includeBottlenecks: true });

      expect(md).toContain('## Optimization Suggestions');
    });
  });

  describe('compareReports', () => {
    it('should compare two reports', () => {
      const before = createMockReport({
        kernelSummary: {
          totalKernels: 100,
          totalDuration: 1_000_000_000,
          avgDuration: 10_000_000,
          minDuration: 1_000_000,
          maxDuration: 50_000_000,
          slowestKernels: [],
        },
      });

      const after = createMockReport({
        kernelSummary: {
          totalKernels: 80,
          totalDuration: 600_000_000,
          avgDuration: 7_500_000,
          minDuration: 500_000,
          maxDuration: 30_000_000,
          slowestKernels: [],
        },
      });

      const comparison = reporter.compareReports(before, after);

      expect(comparison.before).toBe(before);
      expect(comparison.after).toBe(after);
      expect(comparison.comparisons.length).toBeGreaterThan(0);
      expect(comparison.overallImprovement).toBeGreaterThanOrEqual(0);
      expect(comparison.keyImprovements).toBeDefined();
      expect(comparison.regressions).toBeDefined();
    });

    it('should calculate correct change percentages', () => {
      const before = createMockReport({
        kernelSummary: {
          totalKernels: 100,
          totalDuration: 1_000_000_000,
          avgDuration: 10_000_000,
          minDuration: 1_000_000,
          maxDuration: 50_000_000,
          slowestKernels: [],
        },
      });

      const after = createMockReport({
        kernelSummary: {
          totalKernels: 50,
          totalDuration: 500_000_000,
          avgDuration: 10_000_000,
          minDuration: 1_000_000,
          maxDuration: 50_000_000,
          slowestKernels: [],
        },
      });

      const comparison = reporter.compareReports(before, after);

      const kernelComparison = comparison.comparisons.find((c) => c.metric === 'Total Kernels');
      expect(kernelComparison?.before).toBe(100);
      expect(kernelComparison?.after).toBe(50);
      expect(kernelComparison?.changePercent).toBe(-50);
      expect(kernelComparison?.improved).toBe(true); // Fewer kernels is improvement
    });

    it('should identify improvements correctly', () => {
      const before = createMockReport({
        memorySummary: {
          totalAllocated: 100 * 1024 * 1024,
          peakMemory: 100 * 1024 * 1024,
          currentMemory: 50 * 1024 * 1024,
          allocationCount: 1000,
          leakCount: 10,
        },
      });

      const after = createMockReport({
        memorySummary: {
          totalAllocated: 80 * 1024 * 1024,
          peakMemory: 80 * 1024 * 1024,
          currentMemory: 40 * 1024 * 1024,
          allocationCount: 800,
          leakCount: 5,
        },
      });

      const comparison = reporter.compareReports(before, after);

      expect(comparison.keyImprovements.length).toBeGreaterThan(0);
    });

    it('should identify regressions correctly', () => {
      const before = createMockReport({
        transferSummary: {
          totalTransfers: 10,
          totalBytes: 10 * 1024 * 1024,
          avgBandwidth: 5.0,
          maxBandwidth: 10.0,
          totalTransferTime: 2_000_000,
        },
      });

      const after = createMockReport({
        transferSummary: {
          totalTransfers: 10,
          totalBytes: 10 * 1024 * 1024,
          avgBandwidth: 2.5,
          maxBandwidth: 5.0,
          totalTransferTime: 4_000_000,
        },
      });

      const comparison = reporter.compareReports(before, after);

      expect(comparison.regressions.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeTrends', () => {
    it('should analyze trends from multiple reports', () => {
      const reports = [
        createMockReport({
          kernelSummary: {
            totalKernels: 100,
            totalDuration: 1_000_000_000,
            avgDuration: 10_000_000,
            minDuration: 1_000_000,
            maxDuration: 50_000_000,
            slowestKernels: [],
          },
        }),
        createMockReport({
          kernelSummary: {
            totalKernels: 90,
            totalDuration: 900_000_000,
            avgDuration: 10_000_000,
            minDuration: 1_000_000,
            maxDuration: 50_000_000,
            slowestKernels: [],
          },
        }),
        createMockReport({
          kernelSummary: {
            totalKernels: 80,
            totalDuration: 800_000_000,
            avgDuration: 10_000_000,
            minDuration: 1_000_000,
            maxDuration: 50_000_000,
            slowestKernels: [],
          },
        }),
      ];

      const trends = reporter.analyzeTrends(reports);

      expect(trends.metricTrends).toBeDefined();
      expect(trends.improvingMetrics).toBeDefined();
      expect(trends.degradingMetrics).toBeDefined();
    });

    it('should handle single report', () => {
      const reports = [createMockReport()];

      const trends = reporter.analyzeTrends(reports);

      expect(trends.metricTrends.size).toBeGreaterThan(0);
      expect(trends.improvingMetrics.length).toBe(0);
      expect(trends.degradingMetrics.length).toBe(0);
    });

    it('should handle empty reports', () => {
      const trends = reporter.analyzeTrends([]);

      expect(trends.metricTrends.size).toBe(0);
      expect(trends.improvingMetrics.length).toBe(0);
      expect(trends.degradingMetrics.length).toBe(0);
    });
  });

  describe('HTML escaping', () => {
    it('should escape special HTML characters', () => {
      const report = createMockReport({
        bottlenecks: [
          {
            category: 'compute-bound',
            severity: 'high',
            description: 'Test <script> & "quotes"',
            affectedComponent: ['test'],
            impact: 50,
            evidence: [],
            suggestions: [],
          },
        ],
      });

      const html = reporter.exportAsHTML(report, { includeBottlenecks: true });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&quot;');
    });
  });
});

describe('PerformanceReport edge cases', () => {
  it('should handle empty report', () => {
    const reporter = new PerformanceReport();
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

    const html = reporter.exportAsHTML(emptyReport);

    expect(html).toContain('WebGPU Profiling Report');
  });

  it('should handle reports with no bottlenecks', () => {
    const reporter = new PerformanceReport();
    const report: ProfileReport = {
      id: 'test',
      timestamp: Date.now(),
      sessionStart: Date.now() - 1000,
      sessionDuration: 1000,
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

    const md = reporter.exportAsMarkdown(report, { includeBottlenecks: true });

    expect(md).toContain('## Summary');
  });
});
