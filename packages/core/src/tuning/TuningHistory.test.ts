/**
 * @lsi/core/tuning - TuningHistory Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TuningHistory, createTuningHistory } from "./TuningHistory.js";
import { TuningHistoryEntry, PerformanceMetrics } from "./AutoTuner.js";

describe("TuningHistory", () => {
  let history: TuningHistory;

  beforeEach(() => {
    history = new TuningHistory(100, false); // No persistence for tests
  });

  afterEach(() => {
    history.clearAll();
  });

  describe("Constructor", () => {
    it("should create instance with defaults", () => {
      const h = new TuningHistory();
      expect(h).toBeDefined();
      expect(h).toBeInstanceOf(TuningHistory);
    });

    it("should create instance with custom max size", () => {
      const h = new TuningHistory(50);
      expect(h).toBeDefined();
    });

    it("should create instance with persistence", () => {
      const h = new TuningHistory(1000, true, "test-key");
      expect(h).toBeDefined();
    });

    it("should create with factory function", () => {
      const h = createTuningHistory();
      expect(h).toBeDefined();
      expect(h).toBeInstanceOf(TuningHistory);
    });
  });

  describe("Recording Entries", () => {
    it("should record a tuning entry", async () => {
      const entry: TuningHistoryEntry = {
        timestamp: Date.now(),
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        performanceAfter: {
          latency: { p50: 90, p95: 180, p99: 270 },
          throughput: 55,
          errorRate: 0.01,
          qualityScore: 0.92,
          costPerRequest: 0.0009,
          resourceUsage: { memoryMB: 550, cpuPercent: 28 },
        },
        improvement: 0.1,
        successful: true,
      };

      await history.record(entry);
      const all = await history.getAll();
      expect(all.length).toBe(1);
      expect(all[0]).toEqual(entry);
    });

    it("should record multiple entries", async () => {
      const entries: TuningHistoryEntry[] = [
        {
          timestamp: Date.now(),
          parameter: "cache.maxSize",
          oldValue: 1000,
          newValue: 1500,
          performanceBefore: {
            latency: { p50: 100, p95: 200, p99: 300 },
            throughput: 50,
            errorRate: 0.01,
            qualityScore: 0.9,
            costPerRequest: 0.001,
            resourceUsage: { memoryMB: 512, cpuPercent: 30 },
          },
          improvement: 0.1,
          successful: true,
        },
        {
          timestamp: Date.now() + 1000,
          parameter: "cache.ttl",
          oldValue: 600000,
          newValue: 700000,
          performanceBefore: {
            latency: { p50: 100, p95: 200, p99: 300 },
            throughput: 50,
            errorRate: 0.01,
            qualityScore: 0.9,
            costPerRequest: 0.001,
            resourceUsage: { memoryMB: 512, cpuPercent: 30 },
          },
          improvement: 0.05,
          successful: true,
        },
      ];

      for (const entry of entries) {
        await history.record(entry);
      }

      const all = await history.getAll();
      expect(all.length).toBe(2);
    });

    it("should limit history size", async () => {
      const maxSize = 10;
      const h = new TuningHistory(maxSize);

      // Record more than max size
      for (let i = 0; i < 20; i++) {
        await h.record({
          timestamp: Date.now() + i,
          parameter: "test.param",
          oldValue: i,
          newValue: i + 1,
          performanceBefore: {
            latency: { p50: 100, p95: 200, p99: 300 },
            throughput: 50,
            errorRate: 0.01,
            qualityScore: 0.9,
            costPerRequest: 0.001,
            resourceUsage: { memoryMB: 512, cpuPercent: 30 },
          },
          improvement: 0,
          successful: true,
        });
      }

      const all = await h.getAll();
      expect(all.length).toBe(maxSize);
    });
  });

  describe("Retrieving History", () => {
    beforeEach(async () => {
      // Add sample data
      await history.record({
        timestamp: Date.now(),
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });

      await history.record({
        timestamp: Date.now() + 1000,
        parameter: "cache.ttl",
        oldValue: 600000,
        newValue: 700000,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: -0.05,
        successful: false,
      });

      await history.record({
        timestamp: Date.now() + 2000,
        parameter: "cache.maxSize",
        oldValue: 1500,
        newValue: 2000,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.15,
        successful: true,
      });
    });

    it("should get all history", async () => {
      const all = await history.getAll();
      expect(all.length).toBe(3);
    });

    it("should get history for specific parameter", async () => {
      const paramHistory = await history.getParameterHistory("cache.maxSize");
      expect(paramHistory.length).toBe(2);
      expect(paramHistory[0].newValue).toBe(1500);
      expect(paramHistory[1].newValue).toBe(2000);
    });

    it("should return empty array for unknown parameter", async () => {
      const paramHistory = await history.getParameterHistory("unknown.param");
      expect(paramHistory.length).toBe(0);
    });

    it("should get recent history", async () => {
      const recent = await history.getRecentHistory(2);
      expect(recent.length).toBe(2);
      // Check that we have the expected parameters regardless of order
      const parameters = recent.map(r => r.parameter);
      expect(parameters).toContain("cache.maxSize");
      expect(parameters).toContain("cache.ttl");
    });

    it("should get history in time range", async () => {
      const now = Date.now();
      const range = await history.getHistoryInRange(now, now + 1500);
      expect(range.length).toBe(2);
    });
  });

  describe("Successful and Failed Tuning", () => {
    beforeEach(async () => {
      await history.record({
        timestamp: Date.now(),
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });

      await history.record({
        timestamp: Date.now() + 1000,
        parameter: "cache.maxSize",
        oldValue: 1500,
        newValue: 2000,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: -0.15,
        successful: false,
      });

      await history.record({
        timestamp: Date.now() + 2000,
        parameter: "cache.ttl",
        oldValue: 600000,
        newValue: 700000,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.05,
        successful: true,
      });
    });

    it("should get successful tuning actions", async () => {
      const successful = await history.getSuccessfulHistory();
      expect(successful.length).toBe(2);
    });

    it("should get successful tuning for parameter", async () => {
      const successful = await history.getSuccessfulHistory("cache.maxSize");
      expect(successful.length).toBe(1);
      expect(successful[0].newValue).toBe(1500);
    });

    it("should get failed tuning actions", async () => {
      const failed = await history.getFailedHistory();
      expect(failed.length).toBe(1);
      expect(failed[0].newValue).toBe(2000);
    });

    it("should get failed tuning for parameter", async () => {
      const failed = await history.getFailedHistory("cache.maxSize");
      expect(failed.length).toBe(1);
    });
  });

  describe("Best Value Calculation", () => {
    beforeEach(async () => {
      // Record multiple tunings with different improvements
      await history.record({
        timestamp: Date.now(),
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });

      await history.record({
        timestamp: Date.now() + 1000,
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 2000,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.2,
        successful: true,
      });

      await history.record({
        timestamp: Date.now() + 2000,
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.15,
        successful: true,
      });
    });

    it("should get best value for parameter", async () => {
      const bestValue = await history.getBestValue("cache.maxSize");
      expect(bestValue).toBe(2000); // Value 2000 has best improvement (0.2)
    });

    it("should return null for parameter with no successful tunings", async () => {
      const bestValue = await history.getBestValue("cache.ttl");
      expect(bestValue).toBeNull();
    });
  });

  describe("Improvement Statistics", () => {
    beforeEach(async () => {
      await history.record({
        timestamp: Date.now(),
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });

      await history.record({
        timestamp: Date.now() + 1000,
        parameter: "cache.maxSize",
        oldValue: 1500,
        newValue: 2000,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.2,
        successful: true,
      });

      await history.record({
        timestamp: Date.now() + 2000,
        parameter: "cache.maxSize",
        oldValue: 2000,
        newValue: 2500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.15,
        successful: true,
      });
    });

    it("should get improvement statistics", async () => {
      const stats = await history.getImprovementStats("cache.maxSize");

      expect(stats).not.toBeNull();
      expect(stats!.average).toBeCloseTo(0.15, 2);
      expect(stats!.min).toBe(0.1);
      expect(stats!.max).toBe(0.2);
      expect(stats!.count).toBe(3);
    });

    it("should return null for parameter with no successful tunings", async () => {
      const stats = await history.getImprovementStats("cache.ttl");
      expect(stats).toBeNull();
    });
  });

  describe("Tuning Frequency", () => {
    beforeEach(async () => {
      const now = Date.now();

      await history.record({
        timestamp: now - 10000,
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });

      await history.record({
        timestamp: now - 5000,
        parameter: "cache.maxSize",
        oldValue: 1500,
        newValue: 2000,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });

      await history.record({
        timestamp: now - 300000, // 5 minutes ago
        parameter: "cache.maxSize",
        oldValue: 2000,
        newValue: 2500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });
    });

    it("should get tuning frequency", async () => {
      const frequency = await history.getTuningFrequency(
        "cache.maxSize",
        60000
      ); // Last minute
      expect(frequency).toBeGreaterThanOrEqual(1); // At least one tuning in last minute
    });

    it("should check if parameter was recently tuned", async () => {
      const recent = await history.wasRecentlyTuned("cache.maxSize", 60000);
      // Should be true since we have recent entries
      expect(recent).toBe(true);
    });

    it("should return false for parameter not recently tuned", async () => {
      const recent = await history.wasRecentlyTuned("cache.ttl", 60000);
      expect(recent).toBe(false);
    });

    it("should get last tuning time", async () => {
      const lastTime = await history.getLastTuningTime("cache.maxSize");
      expect(lastTime).not.toBeNull();
      expect(lastTime).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("Manual Changes", () => {
    it("should record manual change", async () => {
      await history.recordManualChange("cache.maxSize", 2000);

      const all = await history.getAll();
      const manualEntry = all.find(e => (e as any).manual === true);
      expect(manualEntry).toBeDefined();
      expect(manualEntry!.newValue).toBe(2000);
    });
  });

  describe("Clearing History", () => {
    beforeEach(async () => {
      await history.record({
        timestamp: Date.now(),
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });
    });

    it("should clear parameter history", async () => {
      await history.clearParameterHistory("cache.maxSize");
      const paramHistory = await history.getParameterHistory("cache.maxSize");
      expect(paramHistory.length).toBe(0);
    });

    it("should clear all history", async () => {
      await history.clearAll();
      const all = await history.getAll();
      expect(all.length).toBe(0);
    });
  });

  describe("Import/Export", () => {
    beforeEach(async () => {
      await history.record({
        timestamp: Date.now(),
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });
    });

    it("should export as JSON", async () => {
      const json = await history.exportAsJSON();
      expect(json).toBeDefined();

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
    });

    it("should import from JSON", async () => {
      const json = await history.exportAsJSON();

      const newHistory = new TuningHistory();
      await newHistory.importFromJSON(json);

      const imported = await newHistory.getAll();
      expect(imported.length).toBe(1);
      expect(imported[0].parameter).toBe("cache.maxSize");
    });
  });

  describe("Summary Statistics", () => {
    beforeEach(async () => {
      await history.record({
        timestamp: Date.now(),
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.1,
        successful: true,
      });

      await history.record({
        timestamp: Date.now() + 1000,
        parameter: "cache.maxSize",
        oldValue: 1500,
        newValue: 2000,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: -0.1,
        successful: false,
      });

      await history.record({
        timestamp: Date.now() + 2000,
        parameter: "cache.ttl",
        oldValue: 600000,
        newValue: 700000,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: 0.05,
        successful: true,
      });
    });

    it("should get summary statistics", async () => {
      const summary = await history.getSummary();

      expect(summary.totalTunings).toBe(3);
      expect(summary.successfulTunings).toBe(2);
      expect(summary.failedTunings).toBe(1);
      expect(summary.parametersTuned).toBe(2);
      expect(summary.mostTunedParameter).toBe("cache.maxSize");
      // Average of all improvements: (0.1 + -0.1 + 0.05) = 0.075
      expect(summary.averageImprovement).toBeCloseTo(0.075, 2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty history", async () => {
      const all = await history.getAll();
      expect(all.length).toBe(0);
    });

    it("should handle operations on empty history", async () => {
      const bestValue = await history.getBestValue("unknown");
      expect(bestValue).toBeNull();

      const stats = await history.getImprovementStats("unknown");
      expect(stats).toBeNull();

      const lastTime = await history.getLastTuningTime("unknown");
      expect(lastTime).toBeNull();
    });

    it("should handle entries without improvement", async () => {
      await history.record({
        timestamp: Date.now(),
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1500,
        performanceBefore: {
          latency: { p50: 100, p95: 200, p99: 300 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        successful: true,
        // No improvement field
      });

      const all = await history.getAll();
      expect(all.length).toBe(1);
    });
  });
});
