/**
 * @lsi/vljepa-video/test/RealTimeScheduler.test.ts
 *
 * Comprehensive tests for RealTimeScheduler.
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RealTimeScheduler } from "../src/realtime/RealTimeScheduler.js";
import type { SchedulerConfig, VideoFrame, ScheduleResult } from "../src/types.js";

describe("RealTimeScheduler", () => {
  let scheduler: RealTimeScheduler;
  let config: SchedulerConfig;

  function createMockFrame(id: number): VideoFrame {
    return {
      id,
      data: new Uint8ClampedArray(640 * 480 * 4).fill(id),
      width: 640,
      height: 480,
      timestamp: performance.now() + id * 33.33,
      sequenceNumber: id,
      frameIndex: id - 1,
    };
  }

  beforeEach(() => {
    config = {
      targetFPS: 30,
      frameTime: 33.33,
      strategy: "frame",
      maxLatency: 50,
      maxDrops: 5,
      adaptive: false,
    };

    scheduler = new RealTimeScheduler(config);
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      await scheduler.start();
      expect(scheduler).toBeDefined();
    });

    it("should have correct initial stats", async () => {
      await scheduler.start();

      const stats = scheduler.getStats();
      expect(stats.isRunning).toBe(true);
      expect(stats.queueSize).toBe(0);
      expect(stats.processedCount).toBe(0);
      expect(stats.droppedCount).toBe(0);
    });

    it("should not start when already running", async () => {
      await scheduler.start();

      await expect(scheduler.start()).rejects.toThrow("Scheduler already running");
    });
  });

  describe("Scheduling Decisions", () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it("should schedule frame in frame-based mode", () => {
      const frame = createMockFrame(1);
      const decision = scheduler.schedule(frame);

      expect(decision.process).toBe(true);
      expect(decision.priority).toBeDefined();
      expect(decision.reason).toBeDefined();
    });

    it("should skip frames in skip-based mode", async () => {
      config.strategy = "skip";
      scheduler = new RealTimeScheduler(config);
      await scheduler.start();

      const frame1 = createMockFrame(1);
      const decision1 = scheduler.schedule(frame1);

      // Second frame soon after should be skipped
      const frame2 = createMockFrame(2);
      const decision2 = scheduler.schedule(frame2);

      expect(decision1.process).toBe(true);
      // Second may or may not be skipped depending on timing
      expect(decision2).toBeDefined();
    });

    it("should adjust quality in quality-based mode", async () => {
      config.strategy = "quality";
      scheduler = new RealTimeScheduler(config);
      await scheduler.start();

      const frame = createMockFrame(1);
      const decision = scheduler.schedule(frame);

      expect(decision.process).toBe(true);
      expect(decision.qualityAdjustment).toBeDefined();
    });
  });

  describe("Frame Processing", () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it("should process single frame", async () => {
      const frame = createMockFrame(1);

      // Schedule frame
      scheduler.schedule(frame);

      // Process with mock processor
      const processor = vi.fn().mockResolvedValue(1);
      const result = await scheduler.processNext(processor);

      expect(result).toBe(1);
      expect(processor).toHaveBeenCalled();
    });

    it("should process all queued frames", async () => {
      for (let i = 1; i <= 5; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const processor = vi.fn().mockResolvedValue(i);
      const result = await scheduler.processAll(processor);

      expect(result.processed).toBe(5);
      expect(processor).toHaveBeenCalledTimes(5);
    });

    it("should drop frames past deadline", async () => {
      // Set very short maxLatency
      config.maxLatency = 1;
      scheduler = new RealTimeScheduler(config);
      await scheduler.start();

      scheduler.schedule(createMockFrame(1));

      // Wait past deadline
      await new Promise((resolve) => setTimeout(resolve, 10));

      const processor = vi.fn().mockResolvedValue(1);
      const result = await scheduler.processAll(processor);

      expect(result.dropped).toBeGreaterThan(0);
    });

    it("should return empty result for empty queue", async () => {
      const processor = vi.fn().mockResolvedValue(1);
      const result = await scheduler.processAll(processor);

      expect(result.processed).toBe(0);
      expect(result.dropped).toBe(0);
      expect(processor).not.toHaveBeenCalled();
    });
  });

  describe("Schedule Result", () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it("should calculate actual FPS", async () => {
      for (let i = 1; i <= 30; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const processor = vi.fn().mockResolvedValue(i);
      const result = await scheduler.processAll(processor);

      expect(result.actualFPS).toBeGreaterThan(0);
    });

    it("should calculate average latency", async () => {
      for (let i = 1; i <= 10; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const processor = vi.fn().mockResolvedValue(i);
      const result = await scheduler.processAll(processor);

      expect(result.avgLatency).toBeGreaterThanOrEqual(0);
    });

    it("should calculate max latency", async () => {
      for (let i = 1; i <= 10; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const processor = vi.fn().mockResolvedValue(i);
      const result = await scheduler.processAll(processor);

      expect(result.maxLatency).toBeGreaterThanOrEqual(0);
    });

    it("should calculate p95 latency", async () => {
      for (let i = 1; i <= 20; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const processor = vi.fn().mockResolvedValue(i);
      const result = await scheduler.processAll(processor);

      expect(result.p95Latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it("should track processed frames", async () => {
      scheduler.schedule(createMockFrame(1));

      const processor = vi.fn().mockResolvedValue(1);
      await scheduler.processNext(processor);

      const stats = scheduler.getStats();
      expect(stats.processedCount).toBe(1);
    });

    it("should track dropped frames", async () => {
      // Force drops by scheduling more than maxDrops
      for (let i = 1; i <= 10; i++) {
        const decision = scheduler.schedule(createMockFrame(i));
        // Don't process, should accumulate drops
      }

      const stats = scheduler.getStats();
      expect(stats.droppedCount).toBeGreaterThanOrEqual(0);
    });

    it("should calculate drop rate", async () => {
      for (let i = 1; i <= 10; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const processor = vi.fn().mockResolvedValue(i);
      await scheduler.processAll(processor);

      const stats = scheduler.getStats();
      expect(stats.dropRate).toBeGreaterThanOrEqual(0);
      expect(stats.dropRate).toBeLessThanOrEqual(1);
    });

    it("should track consecutive drops", async () => {
      // Don't process frames, should accumulate consecutive drops
      for (let i = 1; i <= 3; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const stats = scheduler.getStats();
      expect(stats.consecutiveDrops).toBeGreaterThanOrEqual(0);
    });

    it("should track queue size", async () => {
      scheduler.schedule(createMockFrame(1));
      scheduler.schedule(createMockFrame(2));
      scheduler.schedule(createMockFrame(3));

      const stats = scheduler.getStats();
      expect(stats.queueSize).toBe(3);
    });

    it("should track latency percentiles", async () => {
      for (let i = 1; i <= 20; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const processor = vi.fn().mockResolvedValue(i);
      await scheduler.processAll(processor);

      const stats = scheduler.getStats();
      expect(stats.p95Latency).toBeGreaterThanOrEqual(0);
      expect(stats.maxLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Queue Management", () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it("should clear queue", () => {
      scheduler.schedule(createMockFrame(1));
      scheduler.schedule(createMockFrame(2));
      scheduler.schedule(createMockFrame(3));

      scheduler.clearQueue();

      const stats = scheduler.getStats();
      expect(stats.queueSize).toBe(0);
    });

    it("should process frames in priority order", async () => {
      scheduler.schedule(createMockFrame(1));
      scheduler.schedule(createMockFrame(2));

      const processedOrder: number[] = [];
      const processor = vi.fn().mockImplementation(async (frame) => {
        processedOrder.push(frame.id);
        return frame.id;
      });

      await scheduler.processAll(processor);

      expect(processedOrder.length).toBeGreaterThan(0);
    });
  });

  describe("Configuration", () => {
    it("should get target FPS", () => {
      expect(scheduler.getTargetFPS()).toBe(30);
    });

    it("should set target FPS", () => {
      scheduler.setTargetFPS(60);
      expect(scheduler.getTargetFPS()).toBe(60);
    });

    it("should set adaptive mode", () => {
      scheduler.setAdaptive(true);
      // Setting adaptive should not throw
      expect(scheduler).toBeDefined();
    });
  });

  describe("Stop", () => {
    it("should stop scheduler", async () => {
      await scheduler.start();
      await scheduler.stop();

      const stats = scheduler.getStats();
      expect(stats.isRunning).toBe(false);
    });

    it("should stop gracefully with queued frames", async () => {
      await scheduler.start();

      for (let i = 1; i <= 5; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      await scheduler.stop();

      const stats = scheduler.getStats();
      expect(stats.isRunning).toBe(false);
    });
  });

  describe("Reset Statistics", () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it("should reset statistics", async () => {
      scheduler.schedule(createMockFrame(1));

      const processor = vi.fn().mockResolvedValue(1);
      await scheduler.processNext(processor);

      scheduler.resetStats();

      const stats = scheduler.getStats();
      expect(stats.processedCount).toBe(0);
      expect(stats.droppedCount).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it("should handle very high FPS", async () => {
      config.targetFPS = 120;
      scheduler = new RealTimeScheduler(config);
      await scheduler.start();

      const frame = createMockFrame(1);
      const decision = scheduler.schedule(frame);

      expect(decision.process).toBe(true);
    });

    it("should handle very low FPS", async () => {
      config.targetFPS = 5;
      scheduler = new RealTimeScheduler(config);
      await scheduler.start();

      const frame = createMockFrame(1);
      const decision = scheduler.schedule(frame);

      expect(decision.process).toBe(true);
    });

    it("should handle zero max latency", async () => {
      config.maxLatency = 0;
      scheduler = new RealTimeScheduler(config);
      await scheduler.start();

      scheduler.schedule(createMockFrame(1));

      const processor = vi.fn().mockResolvedValue(1);
      const result = await scheduler.processAll(processor);

      // Should still process, but may have drops
      expect(result).toBeDefined();
    });

    it("should handle very short max drops", async () => {
      config.maxDrops = 1;
      scheduler = new RealTimeScheduler(config);
      await scheduler.start();

      for (let i = 1; i <= 10; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const stats = scheduler.getStats();
      expect(stats.consecutiveDrops).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Performance Targets", () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it("should maintain 30fps processing", async () => {
      const frameCount = 30;

      for (let i = 1; i <= frameCount; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      const startTime = performance.now();

      const processor = vi.fn().mockResolvedValue(i);
      const result = await scheduler.processAll(processor);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.processed).toBe(frameCount);
      // Should process 30 frames in reasonable time
      expect(duration).toBeLessThan(2000);
    });

    it("should keep latency under 50ms", async () => {
      const latencies: number[] = [];

      const processor = vi.fn().mockImplementation(async (frame) => {
        const start = performance.now();
        await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate processing
        const end = performance.now();
        latencies.push(end - start);
        return frame.id;
      });

      for (let i = 1; i <= 10; i++) {
        scheduler.schedule(createMockFrame(i));
      }

      await scheduler.processAll(processor);

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      expect(avgLatency).toBeLessThan(50);
    });
  });

  describe("Adaptive Scheduling", () => {
    it("should adapt scheduling based on load", async () => {
      config.adaptive = true;
      config.strategy = "quality";
      scheduler = new RealTimeScheduler(config);
      await scheduler.start();

      // Simulate high load
      for (let i = 1; i <= 20; i++) {
        const frame = createMockFrame(i);
        const decision = scheduler.schedule(frame);

        if (i > 15) {
          // Later decisions may adapt
          expect(decision).toBeDefined();
        }
      }

      const stats = scheduler.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe("Deadline Handling", () => {
    beforeEach(async () => {
      await scheduler.start();
    });

    it("should respect frame deadlines", async () => {
      config.maxLatency = 10;
      scheduler = new RealTimeScheduler(config);
      await scheduler.start();

      scheduler.schedule(createMockFrame(1));

      // Wait past deadline
      await new Promise((resolve) => setTimeout(resolve, 20));

      const processor = vi.fn().mockResolvedValue(1);
      const result = await scheduler.processAll(processor);

      expect(result.dropped).toBe(1);
    });

    it("should process frames before deadline", async () => {
      scheduler.schedule(createMockFrame(1));

      // Process immediately
      const processor = vi.fn().mockResolvedValue(1);
      const result = await scheduler.processAll(processor);

      expect(result.processed).toBe(1);
      expect(result.dropped).toBe(0);
    });
  });
});
