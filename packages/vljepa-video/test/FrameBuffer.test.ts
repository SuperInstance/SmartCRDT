/**
 * @lsi/vljepa-video/test/FrameBuffer.test.ts
 *
 * Comprehensive tests for FrameBuffer.
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FrameBuffer,
  RingBuffer,
  AdaptiveBuffer,
} from "../src/buffering/FrameBuffer.js";
import type { ProcessedFrame, BufferConfig, VideoFrame } from "../src/types.js";

describe("FrameBuffer", () => {
  let buffer: FrameBuffer;
  let config: BufferConfig;

  function createMockFrame(id: number): ProcessedFrame {
    return {
      frame: {
        id,
        data: new Uint8ClampedArray(640 * 480 * 4).fill(id),
        width: 640,
        height: 480,
        timestamp: performance.now() + id * 33.33,
        sequenceNumber: id,
        frameIndex: id - 1,
      },
      embedding: new Float32Array(768).fill(id * 0.01),
      processingTime: 10 + id,
      quality: {
        score: 0.8,
        sharpness: 0.7,
        brightness: 0.8,
        contrast: 0.9,
        noise: 0.1,
        motionBlur: false,
      },
      metadata: {
        captureTime: performance.now(),
        processTime: performance.now(),
        source: "test",
        format: "rgba",
      },
    };
  }

  beforeEach(() => {
    config = {
      type: "ring",
      size: 10,
      strategy: "fifo",
      compression: false,
      maxMemoryMB: 100,
    };

    buffer = new FrameBuffer(config);
  });

  describe("Ring Buffer Type", () => {
    beforeEach(() => {
      config.type = "ring";
      buffer = new FrameBuffer(config);
    });

    it("should push frames to ring buffer", () => {
      const frame = createMockFrame(1);
      buffer.push(frame);

      const stats = buffer.stats();
      expect(stats.size).toBe(1);
    });

    it("should pop frames in FIFO order", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      const frame1 = buffer.pop();
      const frame2 = buffer.pop();
      const frame3 = buffer.pop();

      expect(frame1?.frame.id).toBe(1);
      expect(frame2?.frame.id).toBe(2);
      expect(frame3?.frame.id).toBe(3);
    });

    it("should overwrite old frames when full", () => {
      for (let i = 1; i <= 15; i++) {
        buffer.push(createMockFrame(i));
      }

      const stats = buffer.stats();
      expect(stats.size).toBe(10); // Max size
      expect(stats.overwrites).toBeGreaterThan(0);
    });

    it("should peek at next frame", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      const peeked = buffer.peek();
      expect(peeked?.frame.id).toBe(1); // First frame
    });

    it("should return null when popping empty buffer", () => {
      const frame = buffer.pop();
      expect(frame).toBeNull();
    });

    it("should return null when peeking empty buffer", () => {
      const frame = buffer.peek();
      expect(frame).toBeNull();
    });

    it("should clear buffer", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      buffer.clear();

      const stats = buffer.stats();
      expect(stats.size).toBe(0);
    });

    it("should track statistics", () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(createMockFrame(i));
      }

      buffer.pop();
      buffer.pop();

      const stats = buffer.stats();
      expect(stats.totalPushes).toBe(5);
      expect(stats.totalPops).toBe(2);
      expect(stats.size).toBe(3);
    });

    it("should resize buffer", () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createMockFrame(i));
      }

      buffer.resize(5);

      const stats = buffer.stats();
      expect(stats.maxSize).toBe(5);
      expect(stats.size).toBeLessThanOrEqual(5);
    });
  });

  describe("Adaptive Buffer Type", () => {
    beforeEach(() => {
      config.type = "adaptive";
      buffer = new FrameBuffer(config);
    });

    it("should push frames to adaptive buffer", () => {
      const frame = createMockFrame(1);
      buffer.push(frame);

      const stats = buffer.stats();
      expect(stats.size).toBe(1);
    });

    it("should drop frames when memory limit exceeded", () => {
      config.maxMemoryMB = 1;
      buffer = new FrameBuffer(config);

      // Push many large frames
      for (let i = 1; i <= 100; i++) {
        buffer.push(createMockFrame(i));
      }

      const stats = buffer.stats();
      expect(stats.drops).toBeGreaterThan(0);
    });

    it("should track memory usage", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      const stats = buffer.stats();
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
    });
  });

  describe("Priority Buffer Type", () => {
    beforeEach(() => {
      config.type = "priority";
      buffer = new FrameBuffer(config);
    });

    it("should prioritize high quality frames", () => {
      const lowQualityFrame = createMockFrame(1);
      lowQualityFrame.quality = {
        score: 0.3,
        sharpness: 0.3,
        brightness: 0.3,
        contrast: 0.3,
        noise: 0.7,
        motionBlur: true,
      };

      const highQualityFrame = createMockFrame(2);
      highQualityFrame.quality = {
        score: 0.9,
        sharpness: 0.9,
        brightness: 0.9,
        contrast: 0.9,
        noise: 0.05,
        motionBlur: false,
      };

      buffer.push(lowQualityFrame);
      buffer.push(highQualityFrame);

      const popped = buffer.pop();
      expect(popped?.quality?.score).toBeGreaterThanOrEqual(0.8);
    });

    it("should drop low quality frames when full", () => {
      for (let i = 1; i <= 12; i++) {
        const frame = createMockFrame(i);
        frame.quality = {
          score: i % 2 === 0 ? 0.9 : 0.3,
          sharpness: 0.5,
          brightness: 0.5,
          contrast: 0.5,
          noise: 0.2,
          motionBlur: false,
        };
        buffer.push(frame);
      }

      const stats = buffer.stats();
      expect(stats.drops).toBeGreaterThan(0);
    });
  });

  describe("Buffer Strategies", () => {
    it("should use FIFO strategy", () => {
      config.strategy = "fifo";
      buffer = new FrameBuffer(config);

      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      expect(buffer.pop()?.frame.id).toBe(1);
      expect(buffer.pop()?.frame.id).toBe(2);
    });

    it("should use LRU strategy", () => {
      config.strategy = "lru";
      buffer = new FrameBuffer(config);

      const frame1 = createMockFrame(1);
      frame1.frame.timestamp = 1000;

      const frame2 = createMockFrame(2);
      frame2.frame.timestamp = 2000;

      buffer.push(frame1);
      buffer.push(frame2);

      // LRU should pop oldest
      expect(buffer.pop()?.frame.id).toBe(1);
    });
  });

  describe("Frame Retrieval", () => {
    it("should get frame by index", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      const frame = buffer.getFrame(1);
      expect(frame?.frame.id).toBe(2);
    });

    it("should return null for invalid index", () => {
      buffer.push(createMockFrame(1));

      const frame = buffer.getFrame(10);
      expect(frame).toBeNull();
    });

    it("should get frames in time range", () => {
      const now = performance.now();

      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      const frames = buffer.getFramesInTimeRange(now, now + 100);
      expect(frames.length).toBeGreaterThan(0);
    });
  });
});

describe("RingBuffer", () => {
  let buffer: RingBuffer;

  function createMockFrame(id: number): ProcessedFrame {
    return {
      frame: {
        id,
        data: new Uint8ClampedArray(640 * 480 * 4).fill(id),
        width: 640,
        height: 480,
        timestamp: performance.now() + id * 33.33,
        sequenceNumber: id,
        frameIndex: id - 1,
      },
      embedding: new Float32Array(768).fill(id * 0.01),
      processingTime: 10 + id,
      quality: {
        score: 0.8,
        sharpness: 0.7,
        brightness: 0.8,
        contrast: 0.9,
        noise: 0.1,
        motionBlur: false,
      },
      metadata: {
        captureTime: performance.now(),
        processTime: performance.now(),
        source: "test",
        format: "rgba",
      },
    };
  }

  beforeEach(() => {
    buffer = new RingBuffer(5);
  });

  describe("Push/Pop Operations", () => {
    it("should push and pop frames", () => {
      const frame = createMockFrame(1);
      const pushed = buffer.push(frame);

      expect(pushed).toBe(true);

      const popped = buffer.pop();
      expect(popped?.frame.id).toBe(1);
    });

    it("should overwrite when full", () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createMockFrame(i));
      }

      const stats = buffer.getStats();
      expect(stats.overwrites).toBe(5);
    });

    it("should maintain circular order", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      expect(buffer.pop()?.frame.id).toBe(1);
      expect(buffer.pop()?.frame.id).toBe(2);
      expect(buffer.pop()?.frame.id).toBe(3);
    });
  });

  describe("Frame Access", () => {
    it("should get frame by index", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      expect(buffer.get(0)?.frame.id).toBe(1);
      expect(buffer.get(1)?.frame.id).toBe(2);
      expect(buffer.get(2)?.frame.id).toBe(3);
    });

    it("should return null for invalid index", () => {
      expect(buffer.get(10)).toBeNull();
      expect(buffer.get(-1)).toBeNull();
    });

    it("should peek at oldest frame", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      expect(buffer.peek()?.frame.id).toBe(1);
    });

    it("should peek at newest frame", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      expect(buffer.peekNewest()?.frame.id).toBe(2);
    });
  });

  describe("Bulk Operations", () => {
    it("should get all frames", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      const all = buffer.getAll();
      expect(all).toHaveLength(3);
      expect(all[0].frame.id).toBe(1);
      expect(all[2].frame.id).toBe(3);
    });

    it("should get newest N frames", () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createMockFrame(i));
      }

      const newest = buffer.getNewest(3);
      expect(newest).toHaveLength(3);
      expect(newest[0].frame.id).toBe(8);
      expect(newest[2].frame.id).toBe(10);
    });

    it("should get oldest N frames", () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createMockFrame(i));
      }

      const oldest = buffer.getOldest(3);
      expect(oldest).toHaveLength(3);
      expect(oldest[0].frame.id).toBe(6); // After overwrites
      expect(oldest[2].frame.id).toBe(8);
    });
  });

  describe("Search Operations", () => {
    it("should find frame by ID", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(5));
      buffer.push(createMockFrame(10));

      expect(buffer.findById(5)?.frame.id).toBe(5);
      expect(buffer.findById(99)).toBeNull();
    });

    it("should remove frame by ID", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      const removed = buffer.removeById(2);
      expect(removed).toBe(true);

      const frame = buffer.findById(2);
      expect(frame).toBeNull();
    });

    it("should get frames in time range", () => {
      const now = performance.now();

      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      const frames = buffer.getFramesInTimeRange(now, now + 100);
      expect(frames.length).toBeGreaterThan(0);
    });
  });

  describe("State Queries", () => {
    it("should get count", () => {
      expect(buffer.getCount()).toBe(0);

      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      expect(buffer.getCount()).toBe(2);
    });

    it("should check if empty", () => {
      expect(buffer.isEmpty()).toBe(true);

      buffer.push(createMockFrame(1));

      expect(buffer.isEmpty()).toBe(false);
    });

    it("should check if full", () => {
      expect(buffer.isFull()).toBe(false);

      for (let i = 1; i <= 5; i++) {
        buffer.push(createMockFrame(i));
      }

      expect(buffer.isFull()).toBe(true);
    });

    it("should calculate memory usage", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      const usage = buffer.getMemoryUsage();
      expect(usage).toBeGreaterThan(0);
    });
  });

  describe("Statistics", () => {
    it("should get buffer statistics", () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(createMockFrame(i));
      }

      buffer.pop();

      const stats = buffer.getStats();
      expect(stats.size).toBe(4);
      expect(stats.totalPushes).toBe(5);
      expect(stats.totalPops).toBe(1);
      expect(stats.usagePercent).toBeCloseTo(80);
    });
  });

  describe("Resize", () => {
    it("should resize to larger buffer", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      buffer.resize(10);

      const stats = buffer.getStats();
      expect(stats.size).toBe(10);
      expect(buffer.getCount()).toBe(2);
    });

    it("should resize to smaller buffer", () => {
      for (let i = 1; i <= 5; i++) {
        buffer.push(createMockFrame(i));
      }

      buffer.resize(3);

      expect(buffer.getCount()).toBeLessThanOrEqual(3);
    });
  });

  describe("Clear", () => {
    it("should clear all frames", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      buffer.clear();

      expect(buffer.getCount()).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
    });
  });
});

describe("AdaptiveBuffer", () => {
  let buffer: AdaptiveBuffer;

  function createMockFrame(id: number): ProcessedFrame {
    return {
      frame: {
        id,
        data: new Uint8ClampedArray(640 * 480 * 4).fill(id),
        width: 640,
        height: 480,
        timestamp: performance.now() + id * 33.33,
        sequenceNumber: id,
        frameIndex: id - 1,
      },
      embedding: new Float32Array(768).fill(id * 0.01),
      processingTime: 10 + id,
      quality: {
        score: 0.5 + id * 0.05,
        sharpness: 0.5,
        brightness: 0.5,
        contrast: 0.5,
        noise: 0.2,
        motionBlur: false,
      },
      metadata: {
        captureTime: performance.now(),
        processTime: performance.now(),
        source: "test",
        format: "rgba",
      },
    };
  }

  beforeEach(() => {
    buffer = new AdaptiveBuffer(5, 20, 50);
  });

  describe("Push/Pop", () => {
    it("should push and pop frames", () => {
      const frame = createMockFrame(1);
      buffer.push(frame);

      expect(buffer.getSize()).toBe(1);

      const popped = buffer.pop();
      expect(popped?.frame.id).toBe(1);
    });

    it("should peek at oldest frame", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      expect(buffer.peek()?.frame.id).toBe(1);
    });
  });

  describe("Adaptive Behavior", () => {
    it("should grow when conditions allow", () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createMockFrame(i));
      }

      expect(buffer.getSize()).toBeGreaterThan(5);
    });

    it("should shrink when memory is high", () => {
      for (let i = 1; i <= 25; i++) {
        buffer.push(createMockFrame(i));
      }

      const beforeSize = buffer.getSize();

      // Force adaptation
      for (let i = 0; i < 5; i++) {
        buffer.push(createMockFrame(100 + i));
      }

      expect(buffer.getSize()).toBeLessThanOrEqual(20);
    });

    it("should keep high quality frames when shrinking", () => {
      for (let i = 1; i <= 25; i++) {
        const frame = createMockFrame(i);
        frame.quality.score = 0.9; // All high quality
        buffer.push(frame);
      }

      const stats = buffer.getStats();
      expect(stats.avgQuality).toBeGreaterThan(0.8);
    });
  });

  describe("Quality Filtering", () => {
    it("should get frames by quality range", () => {
      for (let i = 1; i <= 10; i++) {
        const frame = createMockFrame(i);
        frame.quality.score = i * 0.1;
        buffer.push(frame);
      }

      const highQuality = buffer.getFramesByQuality(0.7, 1.0);
      expect(highQuality.length).toBeGreaterThan(0);

      for (const frame of highQuality) {
        expect(frame.quality?.score).toBeGreaterThanOrEqual(0.7);
      }
    });

    it("should remove low quality frames", () => {
      for (let i = 1; i <= 10; i++) {
        const frame = createMockFrame(i);
        frame.quality.score = i * 0.1;
        buffer.push(frame);
      }

      const removed = buffer.removeLowQuality(0.5);
      expect(removed).toBeGreaterThan(0);
    });

    it("should trim to best N frames", () => {
      for (let i = 1; i <= 20; i++) {
        buffer.push(createMockFrame(i));
      }

      buffer.trimToBest(5);

      expect(buffer.getSize()).toBeLessThanOrEqual(5);
    });
  });

  describe("Statistics", () => {
    it("should get buffer statistics", () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(createMockFrame(i));
      }

      const stats = buffer.getStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.minSize).toBe(5);
      expect(stats.maxSize).toBe(20);
      expect(stats.avgQuality).toBeGreaterThan(0);
    });
  });

  describe("Frame Access", () => {
    it("should get oldest frame", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      const oldest = buffer.getOldest();
      expect(oldest?.frame.id).toBe(1);
    });

    it("should get newest frame", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      const newest = buffer.getNewest();
      expect(newest?.frame.id).toBe(3);
    });

    it("should get frames in time range", () => {
      const now = performance.now();

      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));
      buffer.push(createMockFrame(3));

      const frames = buffer.getFramesInTimeRange(now, now + 100);
      expect(frames.length).toBeGreaterThan(0);
    });
  });

  describe("Clear", () => {
    it("should clear buffer", () => {
      buffer.push(createMockFrame(1));
      buffer.push(createMockFrame(2));

      buffer.clear();

      expect(buffer.getSize()).toBe(0);
    });
  });
});
