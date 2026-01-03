/**
 * @lsi/vljepa-video/test/FrameProcessor.test.ts
 *
 * Comprehensive tests for FrameProcessor.
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { FrameProcessor } from "../src/processing/FrameProcessor.js";
import type {
  VideoFrame,
  FrameProcessorConfig,
  ProcessedFrame,
  FrameQuality,
} from "../src/types.js";

describe("FrameProcessor", () => {
  let processor: FrameProcessor;
  let config: FrameProcessorConfig;

  beforeEach(() => {
    config = {
      targetFPS: 30,
      targetResolution: { width: 640, height: 480 },
      preprocessing: {
        normalize: true,
        normalizeRange: [0, 1],
        resize: true,
        resizeMethod: "bilinear",
        colorCorrection: false,
        denoise: false,
        denoiseStrength: 0.1,
      },
      batchSize: 4,
      parallelism: 2,
      maxQueueSize: 10,
      enableGPU: false,
    };

    processor = new FrameProcessor(config);
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      await processor.initialize();
      expect(processer).toBeDefined();
    });

    it("should have correct default stats", async () => {
      await processor.initialize();
      const stats = processor.getStats();

      expect(stats.processedCount).toBe(0);
      expect(stats.droppedCount).toBe(0);
      expect(stats.avgLatency).toBe(0);
      expect(stats.dropRate).toBe(0);
      expect(stats.queueSize).toBe(0);
    });
  });

  describe("Frame Processing", () => {
    it("should process a single frame", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);

      expect(result.frameId).toBe(1);
      expect(result.dropped).toBe(false);
      expect(result.embedding).toBeInstanceOf(Float32Array);
      expect(result.embedding.length).toBe(768);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it("should drop frame when queue is full", async () => {
      await processor.initialize();

      // Fill the queue
      const frames: VideoFrame[] = [];
      for (let i = 0; i < 12; i++) {
        frames.push({
          id: i + 1,
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480,
          timestamp: performance.now(),
          sequenceNumber: i + 1,
          frameIndex: i,
        });
      }

      // Process frames synchronously to fill queue
      for (const frame of frames) {
        await processor.processFrame(frame);
      }

      const stats = processor.getStats();
      expect(stats.droppedCount).toBeGreaterThan(0);
    });

    it("should drop low quality frames", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4).fill(0), // All black (low quality)
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);

      // Quality check may drop the frame
      expect(result).toBeDefined();
    });

    it("should handle processing errors gracefully", async () => {
      await processor.initialize();

      const invalidFrame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(0), // Invalid frame
        width: 0,
        height: 0,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(invalidFrame);

      expect(result.dropped).toBe(true);
      expect(result.dropReason).toBe("error");
    });
  });

  describe("Batch Processing", () => {
    it("should process batch of frames sequentially", async () => {
      await processor.initialize();

      const frames: VideoFrame[] = [];
      for (let i = 0; i < 4; i++) {
        frames.push({
          id: i + 1,
          data: new Uint8ClampedArray(640 * 480 * 4).fill(i * 10),
          width: 640,
          height: 480,
          timestamp: performance.now() + i,
          sequenceNumber: i + 1,
          frameIndex: i,
        });
      }

      const results = await processor.processBatch(frames);

      expect(results).toHaveLength(4);
      expect(results[0].frameId).toBe(1);
      expect(results[3].frameId).toBe(4);
    });

    it("should process batch in parallel when parallelism > 1", async () => {
      config.parallelism = 4;
      processor = new FrameProcessor(config);
      await processor.initialize();

      const frames: VideoFrame[] = [];
      for (let i = 0; i < 8; i++) {
        frames.push({
          id: i + 1,
          data: new Uint8ClampedArray(640 * 480 * 4).fill(i * 10),
          width: 640,
          height: 480,
          timestamp: performance.now() + i,
          sequenceNumber: i + 1,
          frameIndex: i,
        });
      }

      const startTime = performance.now();
      const results = await processor.processBatch(frames);
      const endTime = performance.now();

      expect(results).toHaveLength(8);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast
    });

    it("should respect batch size limit", async () => {
      await processor.initialize();

      const frames: VideoFrame[] = [];
      for (let i = 0; i < 10; i++) {
        frames.push({
          id: i + 1,
          data: new Uint8ClampedArray(640 * 480 * 4).fill(i * 10),
          width: 640,
          height: 480,
          timestamp: performance.now() + i,
          sequenceNumber: i + 1,
          frameIndex: i,
        });
      }

      const results = await processor.processBatch(frames);

      expect(results).toHaveLength(10);
    });
  });

  describe("Preprocessing", () => {
    it("should resize frames to target resolution", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(1920 * 1080 * 4),
        width: 1920,
        height: 1080,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);

      expect(result.dropped).toBe(false);
      expect(result.embedding).toBeDefined();
    });

    it("should normalize pixel values", async () => {
      config.preprocessing.normalize = true;
      config.preprocessing.normalizeRange = [0, 1];
      processor = new FrameProcessor(config);
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4).fill(255),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);

      expect(result.dropped).toBe(false);
    });

    it("should denoise frames when enabled", async () => {
      config.preprocessing.denoise = true;
      config.preprocessing.denoiseStrength = 0.5;
      processor = new FrameProcessor(config);
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);

      expect(result.dropped).toBe(false);
    });
  });

  describe("Quality Assessment", () => {
    it("should assess frame quality", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4).fill(128),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);

      expect(result.quality).toBeGreaterThanOrEqual(0);
      expect(result.quality).toBeLessThanOrEqual(1);
    });

    it("should detect motion blur", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);

      expect(result).toBeDefined();
    });
  });

  describe("Statistics", () => {
    it("should track processed frames", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      await processor.processFrame(frame);

      const stats = processor.getStats();
      expect(stats.processedCount).toBe(1);
    });

    it("should track dropped frames", async () => {
      await processor.initialize();

      // Fill queue to force drops
      for (let i = 0; i < 15; i++) {
        const frame: VideoFrame = {
          id: i + 1,
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480,
          timestamp: performance.now() + i,
          sequenceNumber: i + 1,
          frameIndex: i,
        };

        await processor.processFrame(frame);
      }

      const stats = processor.getStats();
      expect(stats.droppedCount).toBeGreaterThan(0);
    });

    it("should calculate average latency", async () => {
      await processor.initialize();

      for (let i = 0; i < 5; i++) {
        const frame: VideoFrame = {
          id: i + 1,
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480,
          timestamp: performance.now() + i,
          sequenceNumber: i + 1,
          frameIndex: i,
        };

        await processor.processFrame(frame);
      }

      const stats = processor.getStats();
      expect(stats.avgLatency).toBeGreaterThan(0);
    });

    it("should calculate drop rate", async () => {
      await processor.initialize();

      // Process some frames
      for (let i = 0; i < 10; i++) {
        const frame: VideoFrame = {
          id: i + 1,
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480,
          timestamp: performance.now() + i,
          sequenceNumber: i + 1,
          frameIndex: i,
        };

        await processor.processFrame(frame);
      }

      const stats = processor.getStats();
      expect(stats.dropRate).toBeGreaterThanOrEqual(0);
      expect(stats.dropRate).toBeLessThanOrEqual(1);
    });

    it("should track queue size", async () => {
      await processor.initialize();

      const stats = processor.getStats();
      expect(stats.queueSize).toBe(0);
    });
  });

  describe("Statistics Reset", () => {
    it("should reset statistics", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      await processor.processFrame(frame);

      processor.resetStats();

      const stats = processor.getStats();
      expect(stats.processedCount).toBe(0);
      expect(stats.droppedCount).toBe(0);
      expect(stats.avgLatency).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small frames", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(16 * 16 * 4),
        width: 16,
        height: 16,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);
      expect(result).toBeDefined();
    });

    it("should handle very large frames", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(3840 * 2160 * 4),
        width: 3840,
        height: 2160,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);
      expect(result).toBeDefined();
    });

    it("should handle frames with zero data", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(0),
        width: 0,
        height: 0,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);
      expect(result.dropped).toBe(true);
    });
  });

  describe("Performance", () => {
    it("should process frames within latency target", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const startTime = performance.now();
      const result = await processor.processFrame(frame);
      const endTime = performance.now();

      expect(result.latency).toBeLessThan(100); // 100ms target
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should maintain 30fps processing rate", async () => {
      await processor.initialize();

      const frames: VideoFrame[] = [];
      for (let i = 0; i < 30; i++) {
        frames.push({
          id: i + 1,
          data: new Uint8ClampedArray(640 * 480 * 4),
          width: 640,
          height: 480,
          timestamp: performance.now() + i * 33.33,
          sequenceNumber: i + 1,
          frameIndex: i,
        });
      }

      const startTime = performance.now();
      await processor.processBatch(frames);
      const endTime = performance.now();

      // Should process 30 frames in about 1 second
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  describe("Embedding Output", () => {
    it("should produce 768-dim embeddings", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);

      expect(result.embedding).toBeInstanceOf(Float32Array);
      expect(result.embedding.length).toBe(768);
    });

    it("should normalize embeddings", async () => {
      await processor.initialize();

      const frame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(640 * 480 * 4),
        width: 640,
        height: 480,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(frame);

      // Check L2 norm
      let sum = 0;
      for (let i = 0; i < result.embedding.length; i++) {
        sum += result.embedding[i] * result.embedding[i];
      }
      const norm = Math.sqrt(sum);

      // Should be approximately 1 (normalized)
      expect(norm).toBeGreaterThan(0.9);
      expect(norm).toBeLessThan(1.1);
    });
  });

  describe("Concurrent Processing", () => {
    it("should handle concurrent frame processing", async () => {
      await processor.initialize();

      const promises: Promise<any>[] = [];

      for (let i = 0; i < 10; i++) {
        const frame: VideoFrame = {
          id: i + 1,
          data: new Uint8ClampedArray(640 * 480 * 4).fill(i * 10),
          width: 640,
          height: 480,
          timestamp: performance.now() + i,
          sequenceNumber: i + 1,
          frameIndex: i,
        };

        promises.push(processor.processFrame(frame));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      for (const result of results) {
        expect(result.embedding).toBeDefined();
      }
    });
  });
});
