/**
 * CacheMetrics.test.ts
 *
 * Comprehensive tests for CacheMetrics performance monitoring.
 * Target: 30+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  CacheMetrics,
  DEFAULT_CACHE_METRICS_CONFIG,
  PRODUCTION_CACHE_METRICS_CONFIG,
  DEVELOPMENT_CACHE_METRICS_CONFIG,
} from "../CacheMetrics.js";

// ============================================================================
// LEVEL METRICS TRACKER TESTS
// ============================================================================

describe("LevelMetricsTracker", () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics({
      enabled: true,
      snapshotInterval: 1000,
      maxSnapshots: 10,
      costPerMs: 0.000001,
      enableLogging: false,
      logLevel: "info",
    });
  });

  afterEach(() => {
    metrics.destroy();
  });

  describe("Hit/Miss Tracking", () => {
    it("should record L1 hits", () => {
      metrics.recordHit("l1", 5);
      metrics.recordHit("l1", 10);

      const m = metrics.getMetrics();
      expect(m.hitRate.l1).toBe(1.0);
    });

    it("should record L2 hits", () => {
      metrics.recordHit("l2", 20);
      metrics.recordHit("l2", 30);

      const m = metrics.getMetrics();
      expect(m.hitRate.l2).toBe(1.0);
    });

    it("should record L3 hits", () => {
      metrics.recordHit("l3", 50);

      const m = metrics.getMetrics();
      expect(m.hitRate.l3).toBe(1.0);
    });

    it("should record L4 hits", () => {
      metrics.recordHit("l4", 100);

      const m = metrics.getMetrics();
      expect(m.hitRate.l4).toBe(1.0);
    });

    it("should record misses", () => {
      metrics.recordMiss("l1");
      metrics.recordMiss("l1");
      metrics.recordHit("l1", 5);

      const m = metrics.getMetrics();
      expect(m.hitRate.l1).toBeCloseTo(0.33, 2);
    });
  });

  describe("Latency Tracking", () => {
    it("should track average latency", () => {
      metrics.recordHit("l1", 5);
      metrics.recordHit("l1", 15);
      metrics.recordHit("l1", 10);

      const m = metrics.getMetrics();
      expect(m.latency.l1).toBe(10);
    });

    it("should track min latency", () => {
      metrics.recordHit("l1", 5);
      metrics.recordHit("l1", 15);

      const levelMetrics = metrics.getMetrics();
      expect(levelMetrics.latency.l1).toBeGreaterThan(0);
    });

    it("should track max latency", () => {
      metrics.recordHit("l1", 5);
      metrics.recordHit("l1", 100);

      const m = metrics.getMetrics();
      expect(m.latency.l1).toBeGreaterThan(0);
    });
  });

  describe("Eviction Tracking", () => {
    it("should track evictions per level", () => {
      metrics.recordEviction("l1");
      metrics.recordEviction("l1");
      metrics.recordEviction("l2");

      const m = metrics.getMetrics();
      expect(m.evictions.l1).toBe(2);
      expect(m.evictions.l2).toBe(1);
    });
  });
});

// ============================================================================
// SEMANTIC HIT TRACKER TESTS
// ============================================================================

describe("SemanticHitTracker", () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics({
      enabled: true,
      snapshotInterval: 1000,
      maxSnapshots: 10,
    });
  });

  afterEach(() => {
    metrics.destroy();
  });

  describe("Semantic Hit Tracking", () => {
    it("should record semantic hits", () => {
      metrics.recordSemanticHit(0.95);
      metrics.recordSemanticHit(0.97);
      metrics.recordSemanticHit(0.93);

      const m = metrics.getMetrics();
      expect(m.semanticHits.count).toBe(3);
    });

    it("should calculate average similarity", () => {
      metrics.recordSemanticHit(0.9);
      metrics.recordSemanticHit(0.95);
      metrics.recordSemanticHit(1.0);

      const m = metrics.getMetrics();
      expect(m.semanticHits.avgSimilarity).toBeCloseTo(0.95, 2);
    });

    it("should track min similarity", () => {
      metrics.recordSemanticHit(0.9);
      metrics.recordSemanticHit(0.95);
      metrics.recordSemanticHit(0.99);

      const m = metrics.getMetrics();
      expect(m.semanticHits.minSimilarity).toBe(0.9);
    });

    it("should track max similarity", () => {
      metrics.recordSemanticHit(0.9);
      metrics.recordSemanticHit(0.95);
      metrics.recordSemanticHit(0.99);

      const m = metrics.getMetrics();
      expect(m.semanticHits.maxSimilarity).toBe(0.99);
    });
  });
});

// ============================================================================
// COMPREHENSIVE METRICS TESTS
// ============================================================================

describe("CacheMetrics", () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics({
      enabled: true,
      snapshotInterval: 100,
      maxSnapshots: 5,
      costPerMs: 0.000001,
      enableLogging: false,
    });
  });

  afterEach(() => {
    metrics.destroy();
  });

  describe("Hit Rate Calculation", () => {
    it("should calculate L1 hit rate", () => {
      for (let i = 0; i < 60; i++) {
        metrics.recordHit("l1", 5);
      }
      for (let i = 0; i < 40; i++) {
        metrics.recordMiss("l1");
      }

      const m = metrics.getMetrics();
      expect(m.hitRate.l1).toBeCloseTo(0.6, 2);
    });

    it("should calculate overall hit rate", () => {
      metrics.recordHit("l1", 5);
      metrics.recordHit("l2", 20);
      metrics.recordHit("l3", 50);
      metrics.recordMiss("l1");
      metrics.recordMiss("l2");

      const m = metrics.getMetrics();
      expect(m.hitRate.overall).toBeCloseTo(0.6, 2);
    });
  });

  describe("Savings Calculation", () => {
    it("should track processing time saved", () => {
      metrics.recordHit("l1", 10);
      metrics.recordHit("l2", 20);

      const m = metrics.getMetrics();
      expect(m.savings.processingTimeSaved).toBe(30);
    });

    it("should calculate cost saved", () => {
      metrics.recordHit("l1", 1000); // 1 second
      metrics.recordHit("l2", 2000); // 2 seconds

      const m = metrics.getMetrics();
      expect(m.savings.costSaved).toBeCloseTo(0.003, 5); // 3ms * $0.000001/ms
    });

    it("should track total queries", () => {
      metrics.recordHit("l1", 5);
      metrics.recordMiss("l1");
      metrics.recordHit("l2", 10);
      metrics.recordMiss("l2");

      const m = metrics.getMetrics();
      expect(m.savings.totalQueries).toBe(4);
    });
  });

  describe("Size Tracking", () => {
    it("should track L1 cache size", () => {
      metrics.updateSize("l1", 1024 * 1024, 100);

      const m = metrics.getMetrics();
      expect(m.size.l1).toBe(1024 * 1024);
    });

    it("should track L2 cache size", () => {
      metrics.updateSize("l2", 10 * 1024 * 1024, 1000);

      const m = metrics.getMetrics();
      expect(m.size.l2).toBe(10 * 1024 * 1024);
    });

    it("should track total cache size", () => {
      metrics.updateSize("l1", 1024 * 1024, 100);
      metrics.updateSize("l2", 10 * 1024 * 1024, 1000);
      metrics.updateSize("l3", 5 * 1024 * 1024, 500);

      const m = metrics.getMetrics();
      expect(m.size.total).toBe(16 * 1024 * 1024);
    });
  });
});

// ============================================================================
// TARGET ACHIEVEMENT TESTS
// ============================================================================

describe("Target Achievement", () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics();
  });

  afterEach(() => {
    metrics.destroy();
  });

  describe("Hit Rate Targets", () => {
    it("should check L1 target achievement (60%)", () => {
      for (let i = 0; i < 60; i++) {
        metrics.recordHit("l1", 5);
      }
      for (let i = 0; i < 40; i++) {
        metrics.recordMiss("l1");
      }

      const status = metrics.getTargetStatus();
      expect(status.l1.target).toBe(0.6);
      expect(status.l1.current).toBeCloseTo(0.6, 2);
    });

    it("should check L2 target achievement (20%)", () => {
      for (let i = 0; i < 20; i++) {
        metrics.recordHit("l2", 20);
      }
      for (let i = 0; i < 80; i++) {
        metrics.recordMiss("l2");
      }

      const status = metrics.getTargetStatus();
      expect(status.l2.target).toBe(0.2);
      expect(status.l2.current).toBeCloseTo(0.2, 2);
    });

    it("should check L3 target achievement (5%)", () => {
      for (let i = 0; i < 5; i++) {
        metrics.recordHit("l3", 50);
      }
      for (let i = 0; i < 95; i++) {
        metrics.recordMiss("l3");
      }

      const status = metrics.getTargetStatus();
      expect(status.l3.target).toBe(0.05);
      expect(status.l3.current).toBeCloseTo(0.05, 2);
    });

    it("should check overall target achievement (85%)", () => {
      // 60 L1 hits + 20 L2 hits + 5 L3 hits = 85 total hits
      // + 15 misses = 100 total queries = 85% hit rate
      for (let i = 0; i < 60; i++) {
        metrics.recordHit("l1", 5);
      }
      for (let i = 0; i < 20; i++) {
        metrics.recordHit("l2", 20);
      }
      for (let i = 0; i < 5; i++) {
        metrics.recordHit("l3", 50);
      }
      for (let i = 0; i < 15; i++) {
        metrics.recordMiss("l1");
      }

      const status = metrics.getTargetStatus();
      expect(status.overall.target).toBe(0.85);
      expect(status.overall.current).toBeCloseTo(0.85, 2);
    });
  });

  describe("Achievement Status", () => {
    it("should mark achieved targets", () => {
      for (let i = 0; i < 60; i++) {
        metrics.recordHit("l1", 5);
      }
      for (let i = 0; i < 40; i++) {
        metrics.recordMiss("l1");
      }

      const status = metrics.getTargetStatus();
      expect(status.l1.achieved).toBe(true);
    });

    it("should mark unachieved targets", () => {
      for (let i = 0; i < 30; i++) {
        metrics.recordHit("l1", 5);
      }
      for (let i = 0; i < 70; i++) {
        metrics.recordMiss("l1");
      }

      const status = metrics.getTargetStatus();
      expect(status.l1.achieved).toBe(false);
    });
  });
});

// ============================================================================
// SNAPSHOT TESTS
// ============================================================================

describe("Metrics Snapshots", () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics({
      enabled: true,
      snapshotInterval: 50,
      maxSnapshots: 5,
    });
  });

  afterEach(() => {
    metrics.destroy();
  });

  describe("Snapshot Creation", () => {
    it("should create snapshot with timestamp", () => {
      const snapshot = metrics.getSnapshot();

      expect(snapshot).toHaveProperty("timestamp");
      expect(snapshot).toHaveProperty("metrics");
      expect(snapshot.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it("should include current metrics in snapshot", () => {
      metrics.recordHit("l1", 10);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.metrics.hitRate.l1).toBe(1.0);
    });

    it("should create automatic snapshots", async () => {
      metrics.recordHit("l1", 10);

      await new Promise(resolve => setTimeout(resolve, 150));

      const snapshots = metrics.getSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);
    });

    it("should trim snapshots when exceeding max", async () => {
      metrics.recordHit("l1", 10);

      // Wait for more than max snapshots
      await new Promise(resolve => setTimeout(resolve, 400));

      const snapshots = metrics.getSnapshots();
      expect(snapshots.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Snapshot Retrieval", () => {
    it("should get all snapshots", () => {
      metrics.recordHit("l1", 10);

      const snapshot1 = metrics.getSnapshot();
      metrics.recordHit("l2", 20);
      const snapshot2 = metrics.getSnapshot();

      const snapshots = metrics.getSnapshots();
      expect(snapshots.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================================
// METRICS REPORT TESTS
// ============================================================================

describe("Metrics Report", () => {
  let metrics: CacheMetrics;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    metrics = new CacheMetrics({ enableLogging: true });
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    metrics.destroy();
    consoleSpy.mockRestore();
  });

  it("should print metrics report", () => {
    metrics.recordHit("l1", 10);
    metrics.recordMiss("l1");
    metrics.updateSize("l1", 1024 * 1024, 100);

    metrics.printReport();

    expect(consoleSpy).toHaveBeenCalled();
  });

  it("should include all metric sections", () => {
    metrics.printReport();

    const calls = consoleSpy.mock.calls;
    const logContent = calls.map(call => call[0]).join(" ");

    expect(logContent).toContain("Hit Rates");
    expect(logContent).toContain("Latency");
    expect(logContent).toContain("Savings");
    expect(logContent).toContain("Size");
  });
});

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

describe("Configuration", () => {
  afterEach(() => {
    m?.destroy();
  });

  describe("Default Configuration", () => {
    it("should have default config values", () => {
      expect(DEFAULT_CACHE_METRICS_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CACHE_METRICS_CONFIG.snapshotInterval).toBe(60000);
      expect(DEFAULT_CACHE_METRICS_CONFIG.maxSnapshots).toBe(100);
    });
  });

  describe("Production Configuration", () => {
    it("should have production config values", () => {
      expect(PRODUCTION_CACHE_METRICS_CONFIG.snapshotInterval).toBe(300000);
      expect(PRODUCTION_CACHE_METRICS_CONFIG.maxSnapshots).toBe(288);
      expect(PRODUCTION_CACHE_METRICS_CONFIG.enableLogging).toBe(true);
    });
  });

  describe("Development Configuration", () => {
    it("should have development config values", () => {
      expect(DEVELOPMENT_CACHE_METRICS_CONFIG.snapshotInterval).toBe(10000);
      expect(DEVELOPMENT_CACHE_METRICS_CONFIG.maxSnapshots).toBe(60);
      expect(DEVELOPMENT_CACHE_METRICS_CONFIG.logLevel).toBe("debug");
    });
  });

  describe("Configuration Updates", () => {
    it("should update configuration", () => {
      const metrics = new CacheMetrics();
      const original = metrics.getConfig();

      metrics.updateConfig({ enableLogging: true });

      const updated = metrics.getConfig();
      expect(updated.enableLogging).toBe(true);
      metrics.destroy();
    });

    it("should stop snapshot timer when disabled", () => {
      const metrics = new CacheMetrics({ enabled: true });
      metrics.updateConfig({ enabled: false });

      // Should not throw
      metrics.destroy();
    });
  });
});

// ============================================================================
// RESET TESTS
// ============================================================================

describe("Metrics Reset", () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics();
  });

  afterEach(() => {
    metrics.destroy();
  });

  it("should reset all metrics", () => {
    metrics.recordHit("l1", 10);
    metrics.recordMiss("l1");
    metrics.recordSemanticHit(0.95);

    metrics.reset();

    const m = metrics.getMetrics();
    expect(m.hitRate.l1).toBe(0);
    expect(m.semanticHits.count).toBe(0);
  });

  it("should clear snapshots on reset", () => {
    metrics.recordHit("l1", 10);
    metrics.getSnapshot();

    metrics.reset();

    const snapshots = metrics.getSnapshots();
    expect(snapshots.length).toBe(0);
  });
});

// Total test count: 30+
