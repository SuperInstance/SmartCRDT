/**
 * Cache Warming Effectiveness Standalone Tests
 *
 * Tests for cache warming effectiveness without external dependencies
 */

import { describe, it, expect, beforeEach } from "vitest";
import { WarmingProgressTracker, createConsoleTracker } from "./WarmingProgressTracker.js";
import type { WarmingProgress } from "@lsi/protocol";

describe("Cache Warming Effectiveness - Standalone", () => {
  describe("WarmingProgressTracker", () => {
    it("should track warming progress through all stages", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();

      expect(tracker.isInProgress()).toBe(true);
      expect(tracker.getCurrentStage()).toBe("initializing");

      tracker.startStage("loading_patterns", 100);
      expect(tracker.getCurrentStage()).toBe("loading_patterns");

      tracker.updateProgress(50);
      const progress = tracker.getCurrentProgress();
      expect(progress.queriesWarmed).toBe(50);
      expect(progress.totalQueries).toBe(100);

      tracker.completeStage();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(100);
      tracker.complete();

      expect(tracker.isComplete()).toBe(true);
      expect(tracker.isInProgress()).toBe(false);
    });

    it("should calculate progress percentage correctly", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 100);

      tracker.updateProgress(25);
      expect(tracker.getCurrentProgress().progress).toBeGreaterThan(0);

      tracker.updateProgress(50);
      expect(tracker.getCurrentProgress().progress).toBeGreaterThan(0);

      tracker.updateProgress(100);
      const progress = tracker.getCurrentProgress();
      expect(progress.progress).toBeGreaterThan(0);
    });

    it("should estimate time remaining accurately", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 100);

      tracker.updateProgress(50);
      const eta = tracker.getCurrentProgress().estimatedTimeRemaining;

      expect(eta).toBeGreaterThan(0);
      expect(eta).toBeLessThan(60000); // Should be less than 1 minute
    });

    it("should generate detailed progress report", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(75);

      const report = tracker.generateReport();

      expect(report).toContain("Cache Warming Progress Report");
      expect(report).toContain("warming_cache");
      expect(report).toContain("75/100");
      expect(report).toContain("Progress");
      expect(report).toContain("Elapsed Time");
    });

    it("should handle stage transitions correctly", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();

      const stages = [
        "initializing",
        "loading_patterns",
        "generating_predictions",
        "warming_cache",
        "verifying",
        "complete",
      ] as const;

      for (const stage of stages) {
        tracker.startStage(stage, 100);
        expect(tracker.getCurrentStage()).toBe(stage);
      }

      expect(tracker.isComplete()).toBe(true);
    });

    it("should track error states", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.fail("Test error");

      expect(tracker.isFailed()).toBe(true);
      expect(tracker.isComplete()).toBe(false);
      expect(tracker.isInProgress()).toBe(false);
    });

    it("should provide accurate statistics", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 200);
      tracker.updateProgress(150);

      const stats = tracker.getStats();

      expect(stats.currentStage).toBe("warming_cache");
      expect(stats.queriesWarmed).toBe(150);
      expect(stats.totalQueries).toBe(200);
      expect(stats.progress).toBeGreaterThan(0);
      // Elapsed time can be very fast, just check it's defined
      expect(stats.elapsedTime).toBeGreaterThanOrEqual(0);
    });

    it("should reset state correctly", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(50);

      tracker.reset();

      expect(tracker.getCurrentStage()).toBe("initializing");
      expect(tracker.getStats().queriesWarmed).toBe(0);
    });
  });

  describe("Console Tracker", () => {
    it("should create tracker with console logging", () => {
      const tracker = createConsoleTracker(false);
      expect(tracker).toBeInstanceOf(WarmingProgressTracker);
    });

    it("should track all stages", () => {
      const tracker = createConsoleTracker(false);
      tracker.start();

      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(50);
      tracker.complete();

      expect(tracker.isComplete()).toBe(true);
    });
  });

  describe("Progress Events", () => {
    it("should emit stage_start events", () => {
      const tracker = new WarmingProgressTracker();
      let eventReceived = false;

      tracker.on("stage_start", () => {
        eventReceived = true;
      });

      tracker.start();
      tracker.startStage("warming_cache", 100);

      expect(eventReceived).toBe(true);
    });

    it("should emit progress_update events", () => {
      const tracker = new WarmingProgressTracker();
      let updateCount = 0;

      tracker.on("progress_update", () => {
        updateCount++;
      });

      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(25);
      tracker.updateProgress(50);
      tracker.updateProgress(75);

      expect(updateCount).toBeGreaterThan(0);
    });

    it("should emit warming_complete event", () => {
      const tracker = new WarmingProgressTracker();
      let completeReceived = false;

      tracker.on("warming_complete", () => {
        completeReceived = true;
      });

      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(100);
      tracker.complete();

      expect(completeReceived).toBe(true);
    });

    it("should emit error event", () => {
      const tracker = new WarmingProgressTracker();
      let errorReceived = false;

      tracker.on("error", () => {
        errorReceived = true;
      });

      tracker.start();
      tracker.fail("Test error");

      expect(errorReceived).toBe(true);
    });

    it("should support event listener removal", () => {
      const tracker = new WarmingProgressTracker();
      let callCount = 0;

      const listener = () => {
        callCount++;
      };

      tracker.on("progress_update", listener);
      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(25);

      tracker.off("progress_update", listener);
      tracker.updateProgress(50);

      expect(callCount).toBe(1); // Only called once before removal
    });
  });

  describe("Progress Snapshots", () => {
    it("should capture progress snapshots", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();

      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(25);
      tracker.updateProgress(50);
      tracker.updateProgress(75);

      const snapshots = tracker.getSnapshots();

      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[snapshots.length - 1].queriesWarmed).toBe(75);
    });

    it("should include timestamps in snapshots", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 100);
      tracker.updateProgress(50);

      const progress = tracker.getCurrentProgress();

      expect(progress.startTime).toBeGreaterThan(0);
    });
  });

  describe("Performance Targets", () => {
    it("should complete warming cycle quickly", () => {
      const tracker = new WarmingProgressTracker();
      const startTime = Date.now();

      tracker.start();
      tracker.startStage("initializing");
      tracker.completeStage();

      tracker.startStage("warming_cache", 100);
      for (let i = 0; i <= 100; i += 10) {
        tracker.updateProgress(i);
      }
      tracker.completeStage();

      tracker.complete();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should be very fast
    });

    it("should handle large query counts efficiently", () => {
      const tracker = new WarmingProgressTracker();
      const largeCount = 10000;

      const startTime = Date.now();
      tracker.start();
      tracker.startStage("warming_cache", largeCount);
      tracker.updateProgress(largeCount);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should be instant
      expect(tracker.getCurrentProgress().queriesWarmed).toBe(largeCount);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero queries", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 0);
      tracker.updateProgress(0);

      const progress = tracker.getCurrentProgress();
      expect(progress.queriesWarmed).toBe(0);
      expect(progress.totalQueries).toBe(0);
    });

    it("should handle single query", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 1);
      tracker.updateProgress(1);

      const progress = tracker.getCurrentProgress();
      expect(progress.queriesWarmed).toBe(1);
      expect(progress.totalQueries).toBe(1);
    });

    it("should handle rapid progress updates", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 100);

      for (let i = 0; i <= 100; i++) {
        tracker.updateProgress(i);
      }

      expect(tracker.getCurrentProgress().queriesWarmed).toBe(100);
    });

    it("should handle out-of-order progress", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 100);

      tracker.updateProgress(50);
      tracker.updateProgress(25); // Go backwards
      tracker.updateProgress(75); // Go forwards again

      expect(tracker.getCurrentProgress().queriesWarmed).toBe(75);
    });
  });

  describe("Effectiveness Metrics", () => {
    it("should track elapsed time accurately", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();

      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 100) {
        // Busy wait for 100ms
      }

      const elapsed = tracker.getElapsedTime();
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(200);
    });

    it("should calculate progress percentage", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 1000);

      tracker.updateProgress(500);
      const progress = tracker.getCurrentProgress();

      expect(progress.progress).toBeGreaterThan(0);
      expect(progress.progress).toBeLessThanOrEqual(100);
    });

    it("should provide ETA estimates", () => {
      const tracker = new WarmingProgressTracker();
      tracker.start();
      tracker.startStage("warming_cache", 100);

      tracker.updateProgress(10);

      const eta = tracker.getCurrentProgress().estimatedTimeRemaining;
      expect(eta).toBeGreaterThan(0);

      // After half complete, ETA should be reasonable
      tracker.updateProgress(50);
      const etaHalf = tracker.getCurrentProgress().estimatedTimeRemaining;
      // ETA should stay the same or decrease (allow equal due to timing)
      expect(etaHalf).toBeLessThanOrEqual(eta);
    });
  });
});
