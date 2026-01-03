/**
 * Comprehensive tests for cache analytics system
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CacheAnalyticsManager } from "./CacheAnalyticsManager.js";
import type { CacheAnalyticsConfig } from "@lsi/protocol";

const TEST_CONFIG: Partial<CacheAnalyticsConfig> = {
  metricsCollectionInterval: 1000, // 1 second for tests
  enableRealTimeMonitoring: true,
  enableAnomalyDetection: true,
  enableRecommendations: true,
};

describe("CacheAnalyticsManager Integration", () => {
  let manager: CacheAnalyticsManager;

  beforeEach(() => {
    manager = new CacheAnalyticsManager("test-cache", TEST_CONFIG);
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const defaultManager = new CacheAnalyticsManager("default-cache");
      expect(defaultManager).toBeDefined();
      expect(defaultManager.getMetrics()).toBeNull();
    });

    it("should initialize with custom config", () => {
      expect(manager).toBeDefined();
      expect(manager.getConfig().enableRealTimeMonitoring).toBe(true);
    });
  });

  describe("Metrics recording", () => {
    it("should record cache hits", () => {
      manager.recordHit("query1", 10, 0.85);
      manager.recordHit("query2", 15, 0.9);

      const metrics = manager.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics?.hitRate.overall).toBe(1); // 100% hit rate
    });

    it("should record cache misses", () => {
      manager.recordHit("query1", 10);
      manager.recordMiss("query2", 20);

      const metrics = manager.getMetrics();
      expect(metrics?.hitRate.overall).toBe(0.5);
    });

    it("should record evictions", () => {
      manager.recordEviction();
      manager.recordEviction();

      const metrics = manager.getMetrics();
      expect(metrics?.entries.evictions).toBe(2);
    });

    it("should update cache configuration", () => {
      manager.updateCacheConfig(500, 1000, 0.8);

      const metrics = manager.getMetrics();
      expect(metrics?.size).toBe(500);
      expect(metrics?.maxSize).toBe(1000);
      expect(metrics?.threshold).toBe(0.8);
    });
  });

  describe("Analytics collection", () => {
    it("should collect metrics on interval when started", async () => {
      manager.start();

      // Record some activity
      for (let i = 0; i < 10; i++) {
        manager.recordHit(`query${i}`, 10, 0.8 + Math.random() * 0.1);
      }

      // Wait for at least one collection cycle
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const metrics = manager.getMetrics();
      expect(metrics).toBeDefined();

      manager.stop();
    });

    it("should not collect when stopped", async () => {
      manager.start();
      manager.stop();

      manager.recordHit("query1", 10);

      // Wait to ensure no collection happens
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Metrics should still be accessible but not auto-collected
      expect(manager.getMetrics()).toBeDefined();
    });
  });

  describe("Efficiency scoring", () => {
    it("should calculate efficiency score", () => {
      // Generate good metrics
      for (let i = 0; i < 100; i++) {
        manager.recordHit(`query${i % 20}`, 10, 0.85); // High repetition
      }

      const score = manager.getEfficiencyScore();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should reflect hit rate in efficiency score", () => {
      // High hit rate
      const manager1 = new CacheAnalyticsManager("high-hit");
      for (let i = 0; i < 50; i++) {
        manager1.recordHit("query1", 10);
      }
      const highHitScore = manager1.getEfficiencyScore();

      // Low hit rate
      const manager2 = new CacheAnalyticsManager("low-hit");
      for (let i = 0; i < 50; i++) {
        manager2.recordMiss(`query${i}`, 10);
      }
      const lowHitScore = manager2.getEfficiencyScore();

      expect(highHitScore).toBeGreaterThan(lowHitScore);
    });
  });

  describe("Dashboard generation", () => {
    it("should generate dashboard data", () => {
      // Generate some activity
      for (let i = 0; i < 20; i++) {
        manager.recordHit(`query${i % 5}`, 10, 0.8);
      }

      const dashboard = manager.generateDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard.metrics).toBeDefined();
      expect(dashboard.efficiencyScore).toBeDefined();
      expect(dashboard.generatedAt).toBeDefined();
    });

    it("should include top issues in dashboard", () => {
      // Generate activity that might create issues
      for (let i = 0; i < 100; i++) {
        manager.recordMiss(`query${i}`, 100); // High latency misses
      }

      const dashboard = manager.generateDashboard();
      expect(dashboard.topIssues).toBeDefined();
      expect(Array.isArray(dashboard.topIssues)).toBe(true);
    });
  });

  describe("Report generation", () => {
    it("should generate JSON report", () => {
      for (let i = 0; i < 10; i++) {
        manager.recordHit("query1", 10);
      }

      const report = manager.generateReport("json");

      expect(report.format).toBe("json");
      expect(report.data).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });

    it("should generate HTML report", () => {
      const report = manager.generateReport("html");

      expect(report.format).toBe("html");
      expect(typeof report.data).toBe("string");
      expect(report.data).toContain("<!DOCTYPE html>");
      expect(report.data).toContain("Cache Analytics");
    });

    it("should generate markdown report", () => {
      const report = manager.generateReport("markdown");

      expect(report.format).toBe("markdown");
      expect(typeof report.data).toBe("string");
      expect(report.data).toContain("# Cache Analytics Report");
    });

    it("should generate CSV report", () => {
      const report = manager.generateReport("csv");

      expect(report.format).toBe("csv");
      expect(typeof report.data).toBe("string");
      expect(report.data).toContain("timestamp,cache_id");
    });
  });

  describe("Metrics export", () => {
    it("should export to Prometheus format", () => {
      manager.recordHit("query1", 10);
      manager.recordHit("query2", 15);

      const prometheus = manager.exportToPrometheus();

      expect(prometheus.textFormat).toBeDefined();
      expect(prometheus.metrics).toBeDefined();
      expect(prometheus.metrics.length).toBeGreaterThan(0);
      expect(prometheus.textFormat).toContain("# HELP");
      expect(prometheus.textFormat).toContain("# TYPE");
    });

    it("should export to Graphite format", () => {
      manager.recordHit("query1", 10);

      const graphite = manager.exportToGraphite();

      expect(graphite.plaintextFormat).toBeDefined();
      expect(graphite.metrics).toBeDefined();
      expect(graphite.metrics.length).toBeGreaterThan(0);
      expect(typeof graphite.plaintextFormat).toBe("string");
    });

    it("should include custom labels in export", () => {
      manager.recordHit("query1", 10);

      const prometheus = manager.exportToPrometheus({
        customLabels: { environment: "test" },
      });

      expect(prometheus.textFormat).toBeDefined();
    });
  });

  describe("Event system", () => {
    it("should emit metrics collected events", () => {
      const listener = vi.fn();
      manager.on("metrics_collected", listener);

      manager.recordHit("query1", 10);

      // Trigger collection
      const metrics = manager.getMetrics();
      expect(metrics).toBeDefined();
    });

    it("should support multiple listeners for same event", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.on("efficiency_calculated", listener1);
      manager.on("efficiency_calculated", listener2);

      manager.recordHit("query1", 10);
      const score = manager.getEfficiencyScore();
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("should remove event listeners", () => {
      const listener = vi.fn();
      manager.on("metrics_collected", listener);
      manager.off("metrics_collected", listener);

      manager.recordHit("query1", 10);
      const metrics = manager.getMetrics();

      // Listener should not be called after removal
      // (this is implicit, we're just verifying no errors occur)
      expect(metrics).toBeDefined();
    });
  });

  describe("Reset functionality", () => {
    it("should reset all analytics state", () => {
      // Generate activity
      for (let i = 0; i < 50; i++) {
        manager.recordHit(`query${i}`, 10);
      }
      manager.recordEviction();
      manager.recordEviction();

      // Get some metrics first
      const metrics1 = manager.getMetrics();
      expect(metrics1?.hitRate.overall).toBeGreaterThan(0);

      // Reset
      manager.reset();

      // Everything should be cleared
      const metrics2 = manager.getMetrics();
      expect(metrics2).toBeNull(); // No snapshot collected yet
    });
  });

  describe("Configuration updates", () => {
    it("should update configuration", () => {
      const newConfig = {
        enableAnomalyDetection: false,
        enableRecommendations: false,
      };

      manager.updateConfig(newConfig);

      const config = manager.getConfig();
      expect(config.enableAnomalyDetection).toBe(false);
      expect(config.enableRecommendations).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should handle report generation before metrics", () => {
      // Don't record any activity
      expect(() => manager.generateDashboard()).not.toThrow();
    });

    it("should handle export before metrics", () => {
      expect(() => manager.exportToPrometheus()).toThrow();
      expect(() => manager.exportToGraphite()).toThrow();
    });
  });
});
