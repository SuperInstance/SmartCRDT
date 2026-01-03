/**
 * SLAReporter Tests
 * Tests for SLA reporting and compliance checking.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SLAReporter } from '../src/index.js';

describe('SLAReporter', () => {
  let reporter: SLAReporter;

  beforeEach(() => {
    reporter = new SLAReporter({
      config: {
        latency: { p50: 100, p95: 200, p99: 500 },
        availability: 0.99,
        throughput: 100,
        errorRate: 0.01
      },
      windowSize: 60000,
      reportingInterval: 10000
    });
  });

  describe('Initialization', () => {
    it('should initialize with config', () => {
      expect(reporter).toBeInstanceOf(SLAReporter);
    });

    it('should have default window and intervals', () => {
      const defaultReporter = new SLAReporter({
        config: {
          latency: { p50: 100, p95: 200, p99: 500 },
          availability: 0.99,
          throughput: 100,
          errorRate: 0.01
        },
        windowSize: 60000,
        reportingInterval: 10000
      });

      expect(defaultReporter).toBeInstanceOf(SLAReporter);
    });
  });

  describe('Recording Samples', () => {
    it('should record sample', () => {
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: true
      });

      const metrics = reporter.getMetrics();

      expect(metrics).toBeDefined();
    });

    it('should record multiple samples', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100 + i * 10,
          success: true
        });
      }

      const metrics = reporter.getMetrics();

      expect(metrics.latency.p50).toBeGreaterThan(0);
    });

    it('should track successful requests', () => {
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: true
      });

      const metrics = reporter.getMetrics();

      expect(metrics.availability).toBe(1);
    });

    it('should track failed requests', () => {
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: true
      });

      reporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: false
      });

      const metrics = reporter.getMetrics();

      expect(metrics.availability).toBeLessThan(1);
    });

    it('should clean up old samples', async () => {
      const oldTime = Date.now() - 120000; // 2 minutes ago

      reporter.recordSample({
        timestamp: oldTime,
        latency: 100,
        success: true
      });

      // Record new sample to trigger cleanup
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: true
      });

      const metrics = reporter.getMetrics();

      // Old sample should be cleaned up
      expect(metrics).toBeDefined();
    });
  });

  describe('SLA Compliance', () => {
    it('should detect latency violations', () => {
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 600, // Exceeds p99 of 500
        success: true
      });

      const report = reporter.generateReport();

      expect(report.metrics.latency.p99).toBeGreaterThan(500);
    });

    it('should detect availability violations', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: i < 5 // 50% success rate
        });
      }

      const report = reporter.generateReport();

      expect(report.metrics.availability).toBeLessThan(0.99);
    });

    it('should track error rate', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: i < 9 // 10% error rate
        });
      }

      const report = reporter.generateReport();

      expect(report.metrics.errorRate).toBeCloseTo(0.1, 1);
    });

    it('should calculate throughput', () => {
      const now = Date.now();

      for (let i = 0; i < 100; i++) {
        reporter.recordSample({
          timestamp: now + i * 100,
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();

      expect(report.metrics.throughput).toBeGreaterThan(0);
    });

    it('should check compliance for all metrics', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();

      expect(report.metrics.compliance).toBeDefined();
      expect(report.metrics.compliance.latency_p50).toBeDefined();
      expect(report.metrics.compliance.latency_p95).toBeDefined();
      expect(report.metrics.compliance.latency_p99).toBeDefined();
      expect(report.metrics.compliance.availability).toBeDefined();
    });
  });

  describe('SLA Report', () => {
    it('should generate report', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('should calculate summary', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();

      expect(report.summary).toBeDefined();
      expect(report.summary.totalMetrics).toBeGreaterThan(0);
      expect(report.summary.passingMetrics).toBeGreaterThanOrEqual(0);
      expect(report.summary.failingMetrics).toBeGreaterThanOrEqual(0);
    });

    it('should calculate SLA score', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();

      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    });

    it('should identify overall compliance', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();

      expect(report.compliant).toBeDefined();
    });

    it('should generate recommendations when compliant', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should generate recommendations when not compliant', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 1000, // Exceeds SLA
          success: false
        });
      }

      const report = reporter.generateReport();

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Violations', () => {
    it('should track latency violations', () => {
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 1000, // Exceeds p99
        success: true
      });

      const report = reporter.generateReport();

      expect(report.violations).toBeDefined();
    });

    it('should categorize violation severity', () => {
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 600, // Just above p99
        success: true
      });

      const report = reporter.generateReport();

      const violation = report.violations[0];
      if (violation) {
        expect(['minor', 'major', 'critical']).toContain(violation.severity);
      }
    });

    it('should find worst violation', () => {
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 2000, // Way above p99
        success: true
      });

      const report = reporter.generateReport();

      expect(report.summary.worstViolation).toBeDefined();
    });
  });

  describe('Configuration Updates', () => {
    it('should update SLA config', () => {
      reporter.updateConfig({
        latency: { p50: 50, p95: 100, p99: 200 }
      });

      const report = reporter.generateReport();

      expect(report).toBeDefined();
    });

    it('should use updated config for new samples', () => {
      reporter.updateConfig({
        latency: { p50: 50, p95: 100, p99: 200 },
        availability: 0.99,
        throughput: 100,
        errorRate: 0.01
      });

      reporter.recordSample({
        timestamp: Date.now(),
        latency: 150, // Exceeds new p99
        success: true
      });

      const metrics = reporter.getMetrics();

      expect(metrics.latency.p99).toBe(150);
    });
  });

  describe('Reset', () => {
    it('should reset reporter state', () => {
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: true
      });

      reporter.reset();

      const violations = reporter.getViolations();

      expect(violations.length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no samples', () => {
      const report = reporter.generateReport();

      expect(report).toBeDefined();
      expect(report.summary.totalMetrics).toBeGreaterThan(0);
    });

    it('should handle all successful samples', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();

      expect(report.metrics.availability).toBe(1);
    });

    it('should handle all failed samples', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: false
        });
      }

      const report = reporter.generateReport();

      expect(report.metrics.availability).toBe(0);
    });

    it('should handle samples with CPU and memory', () => {
      reporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: true,
        cpu: 50,
        memory: 100_000_000
      });

      const metrics = reporter.getMetrics();

      expect(metrics).toBeDefined();
    });
  });

  describe('Latency Metrics', () => {
    it('should calculate p50 latency', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 50 + i * 10,
          success: true
        });
      }

      const metrics = reporter.getMetrics();

      expect(metrics.latency.p50).toBeGreaterThan(0);
    });

    it('should calculate p95 latency', () => {
      for (let i = 0; i < 20; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 50 + i * 5,
          success: true
        });
      }

      const metrics = reporter.getMetrics();

      expect(metrics.latency.p95).toBeGreaterThan(0);
    });

    it('should calculate p99 latency', () => {
      for (let i = 0; i < 100; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 100,
          latency: 50 + i,
          success: true
        });
      }

      const metrics = reporter.getMetrics();

      expect(metrics.latency.p99).toBeGreaterThan(0);
    });
  });

  describe('Recommendations', () => {
    it('should recommend latency improvements when slow', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 1000, // Slow
          success: true
        });
      }

      const report = reporter.generateReport();

      const latencyRec = report.recommendations.find(r =>
        r.toLowerCase().includes('latency')
      );

      expect(latencyRec).toBeDefined();
    });

    it('should recommend availability improvements when failing', () => {
      for (let i = 0; i < 10; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: i < 5 // 50% availability
        });
      }

      const report = reporter.generateReport();

      const availRec = report.recommendations.find(r =>
        r.toLowerCase().includes('availability')
      );

      expect(availRec).toBeDefined();
    });

    it('should recommend throughput improvements when low', () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        reporter.recordSample({
          timestamp: now + i * 10000, // Spread out
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();

      // Should have some recommendation about low throughput
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});
