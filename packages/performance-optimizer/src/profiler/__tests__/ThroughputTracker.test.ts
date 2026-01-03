/**
 * Tests for Throughput Tracker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ThroughputTracker,
  MultiOperationThroughputTracker,
} from "../ThroughputTracker.js";

describe("ThroughputTracker", () => {
  let tracker: ThroughputTracker;

  beforeEach(() => {
    tracker = new ThroughputTracker({
      operation: "test-operation",
      measurementWindow: 100,
      slidingWindow: 5,
    });
  });

  afterEach(() => {
    if (tracker.isActive()) {
      tracker.stop();
    }
  });

  describe("Tracking Lifecycle", () => {
    it("should start and stop tracking", () => {
      expect(tracker.isActive()).toBe(false);

      tracker.start();
      expect(tracker.isActive()).toBe(true);

      tracker.stop();
      expect(tracker.isActive()).toBe(false);
    });

    it("should throw error when starting already running tracker", () => {
      tracker.start();

      expect(() => tracker.start()).toThrow(
        "Throughput tracker is already running"
      );
    });

    it("should throw error when stopping non-running tracker", () => {
      expect(() => tracker.stop()).toThrow(
        "Throughput tracker is not running"
      );
    });
  });

  describe("Operation Recording", () => {
    it("should record successful operations", () => {
      tracker.start();

      tracker.recordOperation(true);
      tracker.recordOperation(true);
      tracker.recordOperation(true);

      tracker.stop();

      const report = tracker.generateReport();
      expect(report.statistics.totalOperations).toBe(3);
      expect(report.statistics.failedOperations).toBe(0);
    });

    it("should record failed operations", () => {
      tracker.start();

      tracker.recordOperation(true);
      tracker.recordOperation(false);
      tracker.recordOperation(true);

      tracker.stop();

      const report = tracker.generateReport();
      expect(report.statistics.totalOperations).toBe(3);
      expect(report.statistics.failedOperations).toBe(1);
    });

    it("should record multiple operations at once", () => {
      tracker.start();

      tracker.recordOperations(100, 95);

      tracker.stop();

      const report = tracker.generateReport();
      expect(report.statistics.totalOperations).toBe(100);
      expect(report.statistics.failedOperations).toBe(5);
    });

    it("should throw error when recording while not running", () => {
      expect(() => tracker.recordOperation(true)).toThrow(
        "Throughput tracker is not running"
      );
    });
  });

  describe("Throughput Calculation", () => {
    it("should calculate average throughput", async () => {
      tracker.start();

      // Record some operations
      tracker.recordOperations(50);

      // Wait for measurement window
      await new Promise((resolve) => setTimeout(resolve, 150));

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(statistics.averageThroughput).toBeGreaterThan(0);
    });

    it("should calculate peak throughput", async () => {
      tracker.start();

      // Record operations in bursts
      tracker.recordOperations(100);
      await new Promise((resolve) => setTimeout(resolve, 50));

      tracker.recordOperations(50);
      await new Promise((resolve) => setTimeout(resolve, 50));

      tracker.recordOperations(150);
      await new Promise((resolve) => setTimeout(resolve, 150));

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(statistics.peakThroughput).toBeGreaterThan(0);
      expect(statistics.peakThroughput).toBeGreaterThanOrEqual(
        statistics.averageThroughput
      );
    });

    it("should calculate min throughput", async () => {
      tracker.start();

      await new Promise((resolve) => setTimeout(resolve, 150));

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(statistics.minThroughput).toBeGreaterThanOrEqual(0);
      expect(statistics.minThroughput).toBeLessThanOrEqual(
        statistics.averageThroughput
      );
    });
  });

  describe("Percentile Calculations", () => {
    it("should calculate throughput percentiles", async () => {
      tracker.start();

      // Create variable throughput
      for (let i = 0; i < 10; i++) {
        tracker.recordOperations(Math.floor(Math.random() * 100) + 10);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      const p = statistics.percentiles;

      expect(p).toHaveProperty("min");
      expect(p).toHaveProperty("max");
      expect(p).toHaveProperty("average");
      expect(p).toHaveProperty("p50");
      expect(p).toHaveProperty("p75");
      expect(p).toHaveProperty("p90");
      expect(p).toHaveProperty("p95");
      expect(p).toHaveProperty("p99");
      expect(p).toHaveProperty("p99_9");
      expect(p).toHaveProperty("stdDev");
      expect(p).toHaveProperty("variance");

      // Verify percentile ordering
      expect(p.min).toBeLessThanOrEqual(p.p50);
      expect(p.p50).toBeLessThanOrEqual(p.p90);
      expect(p.p90).toBeLessThanOrEqual(p.p95);
      expect(p.p95).toBeLessThanOrEqual(p.p99);
      expect(p.p99).toBeLessThanOrEqual(p.max);
    });
  });

  describe("Success Rate Calculation", () => {
    it("should calculate 100% success rate when all operations succeed", () => {
      tracker.start();

      tracker.recordOperations(100, 100);

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(statistics.successRate).toBe(1);
    });

    it("should calculate 0% success rate when all operations fail", () => {
      tracker.start();

      tracker.recordOperations(100, 0);

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(statistics.successRate).toBe(0);
    });

    it("should calculate partial success rate", () => {
      tracker.start();

      tracker.recordOperations(100, 75);

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(statistics.successRate).toBe(0.75);
    });
  });

  describe("Trend Detection", () => {
    it("should detect increasing trend", async () => {
      tracker.start();

      // Increasing load
      for (let i = 1; i <= 10; i++) {
        tracker.recordOperations(i * 10);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(["increasing", "stable"]).toContain(statistics.trend);
    });

    it("should detect decreasing trend", async () => {
      tracker.start();

      // Decreasing load
      for (let i = 10; i >= 1; i--) {
        tracker.recordOperations(i * 10);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(["decreasing", "stable"]).toContain(statistics.trend);
    });

    it("should detect stable trend", async () => {
      tracker.start();

      // Constant load
      for (let i = 0; i < 10; i++) {
        tracker.recordOperations(50);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(statistics.trend).toBe("stable");
    });

    it("should calculate trend strength", async () => {
      tracker.start();

      tracker.recordOperations(50);
      await new Promise((resolve) => setTimeout(resolve, 100));

      tracker.stop();

      const statistics = tracker.calculateStatistics();
      expect(statistics.trendStrength).toBeGreaterThanOrEqual(0);
      expect(statistics.trendStrength).toBeLessThanOrEqual(1);
    });
  });

  describe("Report Generation", () => {
    it("should generate comprehensive report", async () => {
      tracker.start();

      tracker.recordOperations(100, 95);

      await new Promise((resolve) => setTimeout(resolve, 150));

      tracker.stop();

      const report = tracker.generateReport();

      expect(report).toHaveProperty("operation", "test-operation");
      expect(report).toHaveProperty("totalDuration");
      expect(report).toHaveProperty("statistics");
      expect(report).toHaveProperty("timeline");
      expect(report).toHaveProperty("byTimeWindow");

      expect(report.statistics).toHaveProperty("averageThroughput");
      expect(report.statistics).toHaveProperty("peakThroughput");
      expect(report.statistics).toHaveProperty("minThroughput");
      expect(report.statistics).toHaveProperty("percentiles");
      expect(report.statistics).toHaveProperty("totalOperations");
      expect(report.statistics).toHaveProperty("failedOperations");
      expect(report.statistics).toHaveProperty("successRate");
      expect(report.statistics).toHaveProperty("trend");
      expect(report.statistics).toHaveProperty("trendStrength");
    });

    it("should populate timeline with measurements", async () => {
      tracker.start();

      await new Promise((resolve) => setTimeout(resolve, 150));

      tracker.stop();

      const report = tracker.generateReport();
      expect(report.timeline.length).toBeGreaterThan(0);
      expect(report.timeline[0]).toHaveProperty("timestamp");
      expect(report.timeline[0]).toHaveProperty("operation");
      expect(report.timeline[0]).toHaveProperty("operationsCompleted");
      expect(report.timeline[0]).toHaveProperty("operationsFailed");
      expect(report.timeline[0]).toHaveProperty("opsPerSecond");
      expect(report.timeline[0]).toHaveProperty("timeWindow");
    });

    it("should group measurements by time window", async () => {
      tracker.start();

      await new Promise((resolve) => setTimeout(resolve, 150));

      tracker.stop();

      const report = tracker.generateReport();
      expect(report.byTimeWindow.length).toBeGreaterThan(0);
      expect(report.byTimeWindow[0]).toHaveProperty("window");
      expect(report.byTimeWindow[0]).toHaveProperty("throughput");
      expect(report.byTimeWindow[0]).toHaveProperty("timestamp");
    });
  });

  describe("Current Throughput", () => {
    it("should return current throughput", () => {
      tracker.start();

      tracker.recordOperations(10);

      const currentThroughput = tracker.getCurrentThroughput();
      expect(currentThroughput).toBeGreaterThanOrEqual(0);

      tracker.stop();
    });

    it("should return 0 when no operations recorded", () => {
      tracker.start();

      const currentThroughput = tracker.getCurrentThroughput();
      expect(currentThroughput).toBe(0);

      tracker.stop();
    });
  });

  describe("Data Management", () => {
    it("should clear all data", async () => {
      tracker.start();

      tracker.recordOperations(100);

      await new Promise((resolve) => setTimeout(resolve, 150));

      tracker.stop();

      expect(tracker.getMeasurements().length).toBeGreaterThan(0);

      tracker.clear();

      expect(tracker.getMeasurements().length).toBe(0);
    });

    it("should maintain sliding window size", async () => {
      tracker.start();

      // Record for longer than sliding window
      for (let i = 0; i < 10; i++) {
        tracker.recordOperations(10);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      tracker.stop();

      const measurements = tracker.getMeasurements();
      expect(measurements.length).toBeLessThanOrEqual(5); // slidingWindow size
    });
  });
});

describe("MultiOperationThroughputTracker", () => {
  let multiTracker: MultiOperationThroughputTracker;

  beforeEach(() => {
    multiTracker = new MultiOperationThroughputTracker(100, 5);
  });

  afterEach(() => {
    multiTracker.stopAll();
  });

  describe("Multi-Operation Tracking", () => {
    it("should create separate trackers for each operation", () => {
      const tracker1 = multiTracker.getTracker("operation-1");
      const tracker2 = multiTracker.getTracker("operation-2");

      expect(tracker1).not.toBe(tracker2);
      expect(tracker1).toBeInstanceOf(ThroughputTracker);
      expect(tracker2).toBeInstanceOf(ThroughputTracker);
    });

    it("should reuse existing tracker for same operation", () => {
      const tracker1 = multiTracker.getTracker("operation-1");
      const tracker2 = multiTracker.getTracker("operation-1");

      expect(tracker1).toBe(tracker2);
    });

    it("should start and stop all trackers", async () => {
      multiTracker.getTracker("operation-1").start();
      multiTracker.getTracker("operation-2").start();
      multiTracker.getTracker("operation-3").start();

      expect(multiTracker.getTracker("operation-1").isActive()).toBe(true);
      expect(multiTracker.getTracker("operation-2").isActive()).toBe(true);
      expect(multiTracker.getTracker("operation-3").isActive()).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 50));

      multiTracker.stopAll();

      expect(multiTracker.getTracker("operation-1").isActive()).toBe(false);
      expect(multiTracker.getTracker("operation-2").isActive()).toBe(false);
      expect(multiTracker.getTracker("operation-3").isActive()).toBe(false);
    });

    it("should generate reports for all operations", async () => {
      const tracker1 = multiTracker.getTracker("operation-1");
      const tracker2 = multiTracker.getTracker("operation-2");

      tracker1.start();
      tracker2.start();

      tracker1.recordOperations(50);
      tracker2.recordOperations(75);

      await new Promise((resolve) => setTimeout(resolve, 150));

      tracker1.stop();
      tracker2.stop();

      const reports = multiTracker.generateAllReports();

      expect(reports.size).toBe(2);
      expect(reports.has("operation-1")).toBe(true);
      expect(reports.has("operation-2")).toBe(true);
    });

    it("should list all tracked operations", () => {
      multiTracker.getTracker("operation-1");
      multiTracker.getTracker("operation-2");
      multiTracker.getTracker("operation-3");

      const operations = multiTracker.getOperations();

      expect(operations.length).toBe(3);
      expect(operations).toContain("operation-1");
      expect(operations).toContain("operation-2");
      expect(operations).toContain("operation-3");
    });
  });
});
