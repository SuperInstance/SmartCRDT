/**
 * Tests for MetricsCollector
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MetricsCollector } from "./MetricsCollector.js";
import type { CacheAnalyticsConfig } from "@lsi/protocol";

const DEFAULT_CONFIG: CacheAnalyticsConfig = {
  metricsCollectionInterval: 60_000,
  historyRetention: 7 * 24 * 60 * 60 * 1000,
  maxHistoryPoints: 10_000,
  anomalyDetection: {
    hitRateDropThreshold: 0.15,
    latencySpikeMultiplier: 2.0,
    memoryGrowthRate: 0.05,
    evictionStormThreshold: 10,
    similarityShiftThreshold: 2.0,
    minConfidence: 0.7,
    detectionWindow: 5 * 60 * 1000,
    baselineWindow: 60 * 60 * 1000,
  },
  efficiencyScore: {
    hitRateWeight: 0.35,
    memoryWeight: 0.2,
    latencyWeight: 0.2,
    evictionWeight: 0.15,
    patternWeight: 0.1,
  },
  metricsExport: {
    includeLabels: true,
    metricPrefix: "cache_analytics",
    histogramBuckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    customLabels: {},
  },
  enableRealTimeMonitoring: true,
  enableAnomalyDetection: true,
  enableRecommendations: true,
  dashboardRefreshInterval: 5_000,
};

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector("test-cache", DEFAULT_CONFIG);
  });

  describe("Counter tracking", () => {
    it("should track hits and misses correctly", () => {
      collector.recordHit("query1", 10, 0.85);
      collector.recordHit("query2", 15);
      collector.recordMiss("query3", 20);

      const counters = collector.getCounters();
      expect(counters.hits).toBe(2);
      expect(counters.misses).toBe(1);
    });

    it("should track evictions correctly", () => {
      collector.recordEviction();
      collector.recordEviction();
      collector.recordEviction();

      const snapshot = collector.getSnapshot();
      expect(snapshot.entries.evictions).toBe(3);
    });
  });

  describe("Metrics snapshots", () => {
    it("should generate metrics snapshot", () => {
      collector.recordHit("query1", 10, 0.85);
      collector.recordMiss("query2", 20);
      collector.updateSize(100, 1000);
      collector.updateThreshold(0.8);

      const snapshot = collector.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.cacheId).toBe("test-cache");
      expect(snapshot.size).toBe(100);
      expect(snapshot.maxSize).toBe(1000);
      expect(snapshot.threshold).toBe(0.8);
    });

    it("should calculate hit rate correctly", () => {
      collector.recordHit("q1", 10, 0.8);
      collector.recordHit("q2", 10, 0.85);
      collector.recordHit("q3", 10, 0.9);
      collector.recordMiss("q4", 20);
      collector.recordMiss("q5", 20);

      const snapshot = collector.getSnapshot();
      expect(snapshot.hitRate.overall).toBe(0.6); // 3 hits out of 5
    });

    it("should calculate latency metrics", () => {
      // Record various latencies
      for (let i = 0; i < 100; i++) {
        collector.recordHit(`q${i}`, 5 + Math.random() * 20, 0.8);
      }

      const snapshot = collector.getSnapshot();
      expect(snapshot.latency.average).toBeGreaterThan(0);
      expect(snapshot.latency.p50).toBeGreaterThan(0);
      expect(snapshot.latency.p95).toBeGreaterThan(0);
      expect(snapshot.latency.p99).toBeGreaterThanOrEqual(snapshot.latency.p95);
    });

    it("should track similarity scores", () => {
      collector.recordHit("q1", 10, 0.75);
      collector.recordHit("q2", 10, 0.85);
      collector.recordHit("q3", 10, 0.95);

      const snapshot = collector.getSnapshot();
      expect(snapshot.similarity.average).toBeCloseTo(0.85, 1);
      expect(snapshot.similarity.min).toBe(0.75);
      expect(snapshot.similarity.max).toBe(0.95);
    });
  });

  describe("Query pattern tracking", () => {
    it("should track query frequency", () => {
      collector.recordHit("common query", 10);
      collector.recordHit("common query", 10);
      collector.recordHit("rare query", 10);

      const snapshot = collector.getSnapshot();
      const commonQuery = snapshot.patterns.queryFrequency.find(
        (q) => q.query === "common query"
      );

      expect(commonQuery).toBeDefined();
      expect(commonQuery?.count).toBe(2);
    });

    it("should track hot entries", () => {
      collector.recordEntryAccess("key1");
      collector.recordEntryAccess("key1");
      collector.recordEntryAccess("key1");
      collector.recordEntryAccess("key2");

      const snapshot = collector.getSnapshot();
      const hotKey = snapshot.patterns.hotEntries.find((e) => e.key === "key1");

      expect(hotKey).toBeDefined();
      expect(hotKey?.hitCount).toBe(3);
    });

    it("should calculate repetition rate", () => {
      // Same query 10 times
      for (let i = 0; i < 10; i++) {
        collector.recordHit("same query", 10);
      }
      // Different query 5 times
      for (let i = 0; i < 5; i++) {
        collector.recordHit(`unique query ${i}`, 10);
      }

      const snapshot = collector.getSnapshot();
      expect(snapshot.patterns.repetitionRate).toBeGreaterThan(0);
    });
  });

  describe("Memory tracking", () => {
    it("should track memory usage", () => {
      collector.recordMemoryUsage(1_000_000);
      collector.recordMemoryUsage(2_000_000);
      collector.recordMemoryUsage(1_500_000);

      const snapshot = collector.getSnapshot();
      expect(snapshot.memory.currentUsage).toBe(1_500_000);
      expect(snapshot.memory.peakUsage).toBe(2_000_000);
    });

    it("should detect memory trend", () => {
      // Increasing memory
      for (let i = 1; i <= 10; i++) {
        collector.recordMemoryUsage(i * 1_000_000);
      }

      const snapshot = collector.getSnapshot();
      expect(snapshot.memory.trend).toBe("growing");
    });
  });

  describe("Historical data", () => {
    it("should collect historical data points", () => {
      collector.recordHit("q1", 10);
      collector.recordMiss("q2", 20);
      collector.updateSize(100, 1000);

      const point = collector.collectMetrics();

      expect(point).toBeDefined();
      expect(point.hitRate).toBeGreaterThanOrEqual(0);
      expect(point.size).toBe(100);
    });

    it("should maintain time series data", () => {
      for (let i = 0; i < 5; i++) {
        collector.recordHit("q1", 10);
        collector.collectMetrics();
      }

      const history = collector.getAllHistory();
      expect(history.count).toBe(5);
      expect(history.points.length).toBe(5);
    });

    it("should limit history size", () => {
      const config = { ...DEFAULT_CONFIG, maxHistoryPoints: 5 };
      const limitedCollector = new MetricsCollector("test", config);

      // Add more than max
      for (let i = 0; i < 10; i++) {
        limitedCollector.recordHit("q1", 10);
        limitedCollector.collectMetrics();
      }

      const history = limitedCollector.getAllHistory();
      expect(history.points.length).toBeLessThanOrEqual(5);
    });
  });

  describe("Reset functionality", () => {
    it("should reset all metrics", () => {
      collector.recordHit("q1", 10);
      collector.recordMiss("q2", 20);
      collector.recordEviction();
      collector.recordMemoryUsage(1_000_000);
      collector.collectMetrics();

      collector.reset();

      const counters = collector.getCounters();
      expect(counters.hits).toBe(0);
      expect(counters.misses).toBe(0);
      expect(counters.evictions).toBe(0);

      const snapshot = collector.getSnapshot();
      expect(snapshot.hitRate.overall).toBe(0);
      expect(snapshot.entries.evictions).toBe(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty metrics gracefully", () => {
      const snapshot = collector.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(snapshot.hitRate.overall).toBe(0);
      expect(snapshot.latency.p50).toBe(0);
      expect(snapshot.latency.p95).toBe(0);
    });

    it("should handle division by zero in hit rate", () => {
      // No hits or misses
      const snapshot = collector.getSnapshot();
      expect(snapshot.hitRate.overall).toBe(0);
    });

    it("should handle missing similarity scores", () => {
      collector.recordHit("q1", 10); // No similarity
      collector.recordHit("q2", 10, 0.8);

      const snapshot = collector.getSnapshot();
      expect(snapshot.similarity.average).toBeCloseTo(0.8, 1);
    });
  });
});
