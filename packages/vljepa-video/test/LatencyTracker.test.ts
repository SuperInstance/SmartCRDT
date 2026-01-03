/**
 * @lsi/vljepa-video/test/LatencyTracker.test.ts
 *
 * Comprehensive tests for LatencyTracker.
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  LatencyTracker,
  DropoutHandler,
} from "../src/realtime/LatencyTracker.js";
import type { LatencyTrackerConfig } from "../src/types.js";

describe("LatencyTracker", () => {
  let tracker: LatencyTracker;
  let config: LatencyTrackerConfig;

  beforeEach(() => {
    config = {
      windowSize: 100,
      trackJitter: true,
      trackPercentiles: true,
      maxLatencyThreshold: 50,
    };

    tracker = new LatencyTracker(config);
  });

  describe("Initialization", () => {
    it("should initialize with correct config", () => {
      expect(tracker).toBeDefined();
    });

    it("should have window size", () => {
      expect(tracker.getWindowSize()).toBe(100);
    });
  });

  describe("Frame Tracking", () => {
    it("should start and end frame tracking", () => {
      tracker.startFrame(1);
      tracker.endFrame(1, false);

      const metrics = tracker.getMetrics();
      expect(metrics.totalFrames).toBe(1);
    });

    it("should track dropped frames", () => {
      tracker.startFrame(1);
      tracker.endFrame(1, true);

      tracker.startFrame(2);
      tracker.endFrame(2, false);

      const metrics = tracker.getMetrics();
      expect(metrics.droppedFrames).toBe(1);
    });

    it("should track processing start time", () => {
      tracker.startFrame(1);
      tracker.startProcessing();

      // Simulate processing
      const start = performance.now();
      while (performance.now() - start < 10) {
        // Wait 10ms
      }

      tracker.endFrame(1, false);

      const metrics = tracker.getMetrics();
      expect(metrics.frameLatency.p50).toBeGreaterThan(0);
    });
  });

  describe("Latency Metrics", () => {
    beforeEach(() => {
      // Simulate multiple frames
      for (let i = 1; i <= 20; i++) {
        tracker.startFrame(i);
        tracker.startProcessing();

        // Simulate varying latency
        const latency = 10 + Math.random() * 20;
        const start = performance.now();
        while (performance.now() - start < latency) {
          // Wait
        }

        tracker.endFrame(i, false);
      }
    });

    it("should calculate p50 latency", () => {
      const metrics = tracker.getMetrics();
      expect(metrics.frameLatency.p50).toBeGreaterThan(0);
    });

    it("should calculate p95 latency", () => {
      const metrics = tracker.getMetrics();
      expect(metrics.frameLatency.p95).toBeGreaterThan(0);
    });

    it("should calculate p99 latency", () => {
      const metrics = tracker.getMetrics();
      expect(metrics.frameLatency.p99).toBeGreaterThan(0);
    });

    it("should calculate max latency", () => {
      const metrics = tracker.getMetrics();
      expect(metrics.frameLatency.max).toBeGreaterThan(0);
    });

    it("should have p99 >= p95 >= p50", () => {
      const metrics = tracker.getMetrics();

      expect(metrics.frameLatency.p99).toBeGreaterThanOrEqual(
        metrics.frameLatency.p95
      );
      expect(metrics.frameLatency.p95).toBeGreaterThanOrEqual(
        metrics.frameLatency.p50
      );
    });

    it("should calculate end-to-end latency", () => {
      const metrics = tracker.getMetrics();
      expect(metrics.endToEndLatency).toBeGreaterThan(0);
    });

    it("should calculate jitter", () => {
      const metrics = tracker.getMetrics();
      expect(metrics.jitter).toBeGreaterThanOrEqual(0);
    });

    it("should calculate drop rate", () => {
      // Add some dropped frames
      for (let i = 21; i <= 25; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, true);
      }

      const metrics = tracker.getMetrics();
      expect(metrics.dropRate).toBeGreaterThan(0);
      expect(metrics.dropRate).toBeLessThanOrEqual(1);
    });

    it("should calculate throughput", () => {
      const metrics = tracker.getMetrics();
      expect(metrics.throughput).toBeGreaterThan(0);
    });
  });

  describe("Sample Access", () => {
    beforeEach(() => {
      for (let i = 1; i <= 10; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, i % 3 === 0); // Drop every 3rd frame
      }
    });

    it("should get all samples", () => {
      const samples = tracker.getSamples();
      expect(samples.length).toBe(10);
    });

    it("should get recent samples", () => {
      const recent = tracker.getRecentSamples(5);
      expect(recent.length).toBe(5);
    });

    it("should get sample by frame ID", () => {
      const sample = tracker.getByFrameId(5);
      expect(sample).toBeDefined();
      expect(sample?.frameId).toBe(5);
    });

    it("should return null for non-existent frame", () => {
      const sample = tracker.getByFrameId(999);
      expect(sample).toBeNull();
    });

    it("should get samples in time range", () => {
      const now = performance.now();
      const samples = tracker.getSamplesInTimeRange(now - 1000, now);
      expect(samples.length).toBeGreaterThan(0);
    });
  });

  describe("Histogram", () => {
    beforeEach(() => {
      for (let i = 1; i <= 50; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, false);
      }
    });

    it("should generate latency histogram", () => {
      const histogram = tracker.getLatencyHistogram(10);
      expect(histogram).toBeDefined();
      expect(histogram.length).toBe(10);
    });

    it("should have valid histogram bins", () => {
      const histogram = tracker.getLatencyHistogram(5);

      for (const bin of histogram) {
        expect(bin.bin).toBeDefined();
        expect(bin.count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Latency Over Time", () => {
    it("should track latency over time", () => {
      for (let i = 1; i <= 10; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, false);
      }

      const overTime = tracker.getLatencyOverTime();
      expect(overTime).toHaveLength(10);

      for (const point of overTime) {
        expect(point.timestamp).toBeDefined();
        expect(point.latency).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Threshold Detection", () => {
    beforeEach(() => {
      config.maxLatencyThreshold = 20;
      tracker = new LatencyTracker(config);
    });

    it("should detect threshold exceeded", () => {
      tracker.startFrame(1);

      // Simulate long processing
      const start = performance.now();
      while (performance.now() - start < 30) {
        // Wait 30ms (exceeds threshold of 20ms)
      }

      tracker.endFrame(1, false);

      expect(tracker.isThresholdExceeded()).toBe(true);
    });

    it("should not detect threshold when within limits", () => {
      tracker.startFrame(1);

      // Quick processing
      tracker.endFrame(1, false);

      expect(tracker.isThresholdExceeded()).toBe(false);
    });

    it("should get exceeded samples", () => {
      // Add frames with varying latency
      for (let i = 1; i <= 10; i++) {
        tracker.startFrame(i);

        if (i % 2 === 0) {
          // Long processing
          const start = performance.now();
          while (performance.now() - start < 25) {
            // Wait 25ms
          }
        }

        tracker.endFrame(i, false);
      }

      const exceeded = tracker.getExceededSamples();
      expect(exceeded.length).toBeGreaterThan(0);
    });
  });

  describe("Moving Average", () => {
    it("should calculate moving average", () => {
      for (let i = 1; i <= 15; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, false);
      }

      const movingAvg = tracker.getMovingAverage(5);
      expect(movingAvg).toBeGreaterThan(0);
    });

    it("should respect window size", () => {
      for (let i = 1; i <= 20; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, false);
      }

      const avg5 = tracker.getMovingAverage(5);
      const avg10 = tracker.getMovingAverage(10);

      expect(avg5).toBeDefined();
      expect(avg10).toBeDefined();
    });
  });

  describe("Summary Statistics", () => {
    beforeEach(() => {
      for (let i = 1; i <= 30; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, i % 4 === 0);
      }
    });

    it("should get comprehensive summary", () => {
      const summary = tracker.getSummary();

      expect(summary.avgLatency).toBeGreaterThan(0);
      expect(summary.minLatency).toBeGreaterThanOrEqual(0);
      expect(summary.maxLatency).toBeGreaterThan(0);
      expect(summary.stdDev).toBeGreaterThanOrEqual(0);
      expect(summary.jitter).toBeGreaterThanOrEqual(0);
      expect(summary.dropRate).toBeGreaterThan(0);
      expect(summary.throughput).toBeGreaterThan(0);
    });

    it("should have max >= avg >= min", () => {
      const summary = tracker.getSummary();

      expect(summary.maxLatency).toBeGreaterThanOrEqual(summary.avgLatency);
      expect(summary.avgLatency).toBeGreaterThanOrEqual(summary.minLatency);
    });
  });

  describe("Configuration", () => {
    it("should set window size", () => {
      tracker.setWindowSize(50);
      expect(tracker.getWindowSize()).toBe(50);
    });

    it("should trim samples when reducing window", () => {
      for (let i = 1; i <= 100; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, false);
      }

      const samplesBefore = tracker.getSamples().length;
      tracker.setWindowSize(50);
      const samplesAfter = tracker.getSamples().length;

      expect(samplesAfter).toBeLessThanOrEqual(50);
    });
  });

  describe("Reset", () => {
    it("should reset tracker", () => {
      for (let i = 1; i <= 10; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, false);
      }

      tracker.reset();

      const metrics = tracker.getMetrics();
      expect(metrics.totalFrames).toBe(0);
      expect(metrics.droppedFrames).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle no samples", () => {
      const metrics = tracker.getMetrics();

      expect(metrics.totalFrames).toBe(0);
      expect(metrics.frameLatency.p50).toBe(0);
    });

    it("should handle single sample", () => {
      tracker.startFrame(1);
      tracker.endFrame(1, false);

      const metrics = tracker.getMetrics();
      expect(metrics.totalFrames).toBe(1);
    });

    it("should handle all dropped frames", () => {
      for (let i = 1; i <= 10; i++) {
        tracker.startFrame(i);
        tracker.endFrame(i, true);
      }

      const metrics = tracker.getMetrics();
      expect(metrics.droppedFrames).toBe(10);
      expect(metrics.dropRate).toBe(1);
    });

    it("should handle jitter calculation without jitter tracking", () => {
      config.trackJitter = false;
      tracker = new LatencyTracker(config);

      tracker.startFrame(1);
      tracker.endFrame(1, false);

      const metrics = tracker.getMetrics();
      expect(metrics.jitter).toBe(0);
    });
  });
});

describe("DropoutHandler", () => {
  let handler: DropoutHandler;

  beforeEach(() => {
    handler = new DropoutHandler({
      maxConsecutiveDrops: 5,
      recoveryStrategy: "skip",
      skipRatio: 0.5,
      qualityReduction: 0.2,
      bufferIncrease: 10,
      autoRecover: true,
    });
  });

  describe("Initialization", () => {
    it("should initialize with correct config", () => {
      expect(handler).toBeDefined();
    });
  });

  describe("Drop Handling", () => {
    it("should handle frame drop", () => {
      const result = handler.handleDrop();

      expect(result.shouldRecover).toBeDefined();
    });

    it("should track consecutive drops", () => {
      handler.handleDrop();
      handler.handleDrop();
      handler.handleDrop();

      expect(handler.getConsecutiveDrops()).toBe(3);
    });

    it("should reset on processed frame", () => {
      handler.handleDrop();
      handler.handleDrop();
      handler.handleProcessed();

      expect(handler.getConsecutiveDrops()).toBe(0);
    });
  });

  describe("Recovery", () => {
    it("should trigger recovery at threshold", () => {
      for (let i = 0; i < 5; i++) {
        handler.handleDrop();
      }

      const result = handler.handleDrop();
      expect(result.shouldRecover).toBe(true);
      expect(result.recoveryAction).toBeDefined();
    });

    it("should provide recovery action", () => {
      handler.setRecoveryStrategy("skip");

      for (let i = 0; i < 5; i++) {
        handler.handleDrop();
      }

      const result = handler.handleDrop();
      expect(result.recoveryAction?.action).toBe("skip_frames");
    });

    it("should use quality strategy", () => {
      handler.setRecoveryStrategy("reduce_quality");

      for (let i = 0; i < 5; i++) {
        handler.handleDrop();
      }

      const result = handler.handleDrop();
      expect(result.recoveryAction?.action).toBe("reduce_quality");
    });

    it("should use buffer strategy", () => {
      handler.setRecoveryStrategy("increase_buffer");

      for (let i = 0; i < 5; i++) {
        handler.handleDrop();
      }

      const result = handler.handleDrop();
      expect(result.recoveryAction?.action).toBe("increase_buffer");
    });

    it("should use none strategy", () => {
      handler.setRecoveryStrategy("none");

      for (let i = 0; i < 5; i++) {
        handler.handleDrop();
      }

      const result = handler.handleDrop();
      expect(result.recoveryAction?.action).toBe("none");
    });
  });

  describe("Statistics", () => {
    beforeEach(() => {
      // Simulate drops and recoveries
      for (let i = 0; i < 3; i++) {
        handler.handleDrop();
      }
      handler.handleProcessed();

      for (let i = 0; i < 7; i++) {
        handler.handleDrop();
      }
      handler.handleProcessed();
    });

    it("should track total drops", () => {
      const stats = handler.getStats();
      expect(stats.totalDrops).toBe(10);
    });

    it("should track total processed", () => {
      const stats = handler.getStats();
      expect(stats.totalProcessed).toBe(2);
    });

    it("should track drop events", () => {
      const stats = handler.getStats();
      expect(stats.totalDropEvents).toBe(2);
    });

    it("should calculate average drops per event", () => {
      const stats = handler.getStats();
      expect(stats.avgDropsPerEvent).toBe(5); // (3 + 7) / 2
    });

    it("should track max drops in event", () => {
      const stats = handler.getStats();
      expect(stats.maxDropsInEvent).toBe(7);
    });

    it("should calculate drop rate", () => {
      const stats = handler.getStats();
      expect(stats.dropRate).toBe(10 / 12); // 10 drops / 12 total
    });

    it("should track dropout state", () => {
      handler.handleDrop();

      expect(handler.isInDropoutState()).toBe(true);

      handler.handleProcessed();
      expect(handler.isInDropoutState()).toBe(false);
    });
  });

  describe("History", () => {
    it("should get recent events", () => {
      for (let i = 0; i < 5; i++) {
        handler.handleDrop();
      }
      handler.handleProcessed();

      const recent = handler.getRecentEvents(3);
      expect(recent).toBeDefined();
    });

    it("should get full history", () => {
      for (let i = 0; i < 3; i++) {
        handler.handleDrop();
      }
      handler.handleProcessed();

      const history = handler.getHistory();
      expect(history).toBeDefined();
    });
  });

  describe("Drop Rate in Window", () => {
    it("should calculate drop rate in time window", () => {
      for (let i = 0; i < 10; i++) {
        handler.handleDrop();
      }

      const rate = handler.getDropRateInWindow(1000);
      expect(rate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Configuration", () => {
    it("should set recovery strategy", () => {
      handler.setRecoveryStrategy("quality");
      // Should not throw
      expect(handler).toBeDefined();
    });

    it("should set max consecutive drops", () => {
      handler.setMaxConsecutiveDrops(10);
      // Should not throw
      expect(handler).toBeDefined();
    });

    it("should set auto recover", () => {
      handler.setAutoRecover(false);
      // Should not throw
      expect(handler).toBeDefined();
    });
  });

  describe("Recommendations", () => {
    it("should provide recommendations based on state", () => {
      for (let i = 0; i < 10; i++) {
        handler.handleDrop();
      }

      const recommendations = handler.getRecommendations();
      expect(recommendations).toBeDefined();
    });

    it("should include priority in recommendations", () => {
      for (let i = 0; i < 10; i++) {
        handler.handleDrop();
      }

      const recommendations = handler.getRecommendations();

      for (const rec of recommendations) {
        expect(rec.priority).toMatch(/^(high|medium|low)$/);
        expect(rec.action).toBeDefined();
        expect(rec.reason).toBeDefined();
      }
    });
  });

  describe("Reset", () => {
    it("should reset handler", () => {
      handler.handleDrop();
      handler.handleDrop();
      handler.handleDrop();

      handler.reset();

      const stats = handler.getStats();
      expect(stats.consecutiveDrops).toBe(0);
      expect(stats.totalDrops).toBe(0);
      expect(stats.totalDropEvents).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle no drops", () => {
      const stats = handler.getStats();
      expect(stats.consecutiveDrops).toBe(0);
      expect(stats.totalDrops).toBe(0);
    });

    it("should handle all drops (no processed)", () => {
      for (let i = 0; i < 10; i++) {
        handler.handleDrop();
      }

      const stats = handler.getStats();
      expect(stats.totalProcessed).toBe(0);
    });

    it("should handle disabled auto recover", () => {
      handler.setAutoRecover(false);

      for (let i = 0; i < 10; i++) {
        handler.handleDrop();
      }

      const result = handler.handleDrop();
      expect(result).toBeDefined();
    });
  });
});
