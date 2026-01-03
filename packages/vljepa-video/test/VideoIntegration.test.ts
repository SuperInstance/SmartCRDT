/**
 * @lsi/vljepa-video/test/VideoIntegration.test.ts
 *
 * Comprehensive integration tests for video processing pipeline.
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FrameProcessor,
  ObjectTracker,
  FrameBuffer,
  RingBuffer,
  RealTimeScheduler,
  LatencyTracker,
  EmbeddingStream,
  ActionStream,
} from "../src/index.js";
import type {
  VideoFrame,
  ProcessedFrame,
  FrameProcessorConfig,
  TrackingConfig,
  BufferConfig,
  SchedulerConfig,
  LatencyTrackerConfig,
  StreamConfig,
} from "../src/types.js";

describe("Video Integration Tests", () => {
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

  function createMockProcessedFrame(id: number): ProcessedFrame {
    return {
      frame: createMockFrame(id),
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

  describe("Frame Processing Pipeline", () => {
    let processor: FrameProcessor;
    let buffer: FrameBuffer;
    let scheduler: RealTimeScheduler;
    let tracker: LatencyTracker;

    beforeEach(async () => {
      const processorConfig: FrameProcessorConfig = {
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

      const bufferConfig: BufferConfig = {
        type: "ring",
        size: 10,
        strategy: "fifo",
        compression: false,
        maxMemoryMB: 100,
      };

      const schedulerConfig: SchedulerConfig = {
        targetFPS: 30,
        frameTime: 33.33,
        strategy: "frame",
        maxLatency: 50,
        maxDrops: 5,
        adaptive: false,
      };

      const trackerConfig: LatencyTrackerConfig = {
        windowSize: 100,
        trackJitter: true,
        trackPercentiles: true,
        maxLatencyThreshold: 50,
      };

      processor = new FrameProcessor(processorConfig);
      buffer = new FrameBuffer(bufferConfig);
      scheduler = new RealTimeScheduler(schedulerConfig);
      tracker = new LatencyTracker(trackerConfig);

      await processor.initialize();
      await scheduler.start();
    });

    it("should process frame through full pipeline", async () => {
      const frame = createMockFrame(1);

      // Schedule
      const decision = scheduler.schedule(frame);
      expect(decision.process).toBe(true);

      // Track latency
      tracker.startFrame(frame.id);

      // Process
      const result = await processor.processFrame(frame);
      expect(result.dropped).toBe(false);
      expect(result.embedding).toBeDefined();

      // End tracking
      tracker.endFrame(frame.id, false);

      // Add to buffer
      const processedFrame: ProcessedFrame = {
        frame,
        embedding: result.embedding,
        processingTime: result.latency,
        quality: {
          score: result.quality || 0.8,
          sharpness: 0.7,
          brightness: 0.8,
          contrast: 0.9,
          noise: 0.1,
          motionBlur: false,
        },
        metadata: {
          captureTime: frame.timestamp,
          processTime: performance.now(),
          source: "test",
          format: "rgba",
        },
      };

      buffer.push(processedFrame);

      // Verify all components
      const bufferStats = buffer.stats();
      expect(bufferStats.size).toBe(1);

      const schedulerStats = scheduler.getStats();
      expect(schedulerStats.queueSize).toBe(0);

      const latencyMetrics = tracker.getMetrics();
      expect(latencyMetrics.totalFrames).toBe(1);
    });

    it("should process batch of frames", async () => {
      const frames: VideoFrame[] = [];

      for (let i = 1; i <= 10; i++) {
        frames.push(createMockFrame(i));
      }

      // Schedule all frames
      for (const frame of frames) {
        scheduler.schedule(frame);
      }

      // Process all
      const processorFunc = async (frame: VideoFrame) => {
        tracker.startFrame(frame.id);
        const result = await processor.processFrame(frame);
        tracker.endFrame(frame.id, result.dropped);
        return frame.id;
      };

      const scheduleResult = await scheduler.processAll(processorFunc);

      expect(scheduleResult.processed).toBeGreaterThan(0);
      expect(scheduleResult.actualFPS).toBeGreaterThan(0);
    });

    it("should maintain 30fps target", async () => {
      const frameCount = 30;
      const frames: VideoFrame[] = [];

      for (let i = 1; i <= frameCount; i++) {
        frames.push(createMockFrame(i));
      }

      const startTime = performance.now();

      for (const frame of frames) {
        scheduler.schedule(frame);
        await processor.processFrame(frame);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should process 30 frames in roughly 1 second
      expect(duration).toBeLessThan(2000);
    });
  });

  describe("Object Tracking Integration", () => {
    let processor: FrameProcessor;
    let tracker: ObjectTracker;

    beforeEach(async () => {
      const config: FrameProcessorConfig = {
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

      const trackingConfig: TrackingConfig = {
        algorithm: "sort",
        maxAge: 30,
        minHits: 3,
        iouThreshold: 0.3,
        useReID: false,
        maxTracks: 100,
      };

      processor = new FrameProcessor(config);
      tracker = new ObjectTracker(trackingConfig);

      await processor.initialize();
    });

    it("should track objects across frames", async () => {
      // Simulate object detection across frames
      for (let frameId = 1; frameId <= 10; frameId++) {
        const frame = createMockFrame(frameId);
        await processor.processFrame(frame);

        // Simulate detected objects
        const detections = [
          {
            id: `det_${frameId}`,
            class: "person",
            boundingBox: {
              x: 100 + frameId * 5,
              y: 100,
              width: 50,
              height: 100,
            },
            confidence: 0.9,
            age: 0,
            hits: 1,
            state: "tentative" as const,
            trajectory: {
              positions: [
                {
                  x: 125 + frameId * 5,
                  y: 150,
                  timestamp: performance.now(),
                },
              ],
              velocity: { vx: frameId * 5, vy: 0 },
            },
          },
        ];

        const tracks = tracker.update(detections);

        expect(tracks).toBeDefined();
      }

      const stats = tracker.getStats();
      expect(stats.totalTracks).toBeGreaterThan(0);
    });
  });

  describe("Buffer Integration", () => {
    let ringBuffer: RingBuffer;
    let processor: FrameProcessor;

    beforeEach(async () => {
      const config: FrameProcessorConfig = {
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

      ringBuffer = new RingBuffer(10);
      processor = new FrameProcessor(config);

      await processor.initialize();
    });

    it("should buffer processed frames", async () => {
      for (let i = 1; i <= 5; i++) {
        const frame = createMockFrame(i);
        const result = await processor.processFrame(frame);

        const processedFrame: ProcessedFrame = {
          frame,
          embedding: result.embedding,
          processingTime: result.latency,
          quality: {
            score: result.quality || 0.8,
            sharpness: 0.7,
            brightness: 0.8,
            contrast: 0.9,
            noise: 0.1,
            motionBlur: false,
          },
          metadata: {
            captureTime: frame.timestamp,
            processTime: performance.now(),
            source: "test",
            format: "rgba",
          },
        };

        ringBuffer.push(processedFrame);
      }

      const stats = ringBuffer.getStats();
      expect(stats.count).toBe(5);
    });

    it("should overwrite when full", async () => {
      for (let i = 1; i <= 15; i++) {
        const frame = createMockFrame(i);
        const result = await processor.processFrame(frame);

        const processedFrame: ProcessedFrame = {
          frame,
          embedding: result.embedding,
          processingTime: result.latency,
          quality: {
            score: result.quality || 0.8,
            sharpness: 0.7,
            brightness: 0.8,
            contrast: 0.9,
            noise: 0.1,
            motionBlur: false,
          },
          metadata: {
            captureTime: frame.timestamp,
            processTime: performance.now(),
            source: "test",
            format: "rgba",
          },
        };

        ringBuffer.push(processedFrame);
      }

      const stats = ringBuffer.getStats();
      expect(stats.count).toBe(10); // Max size
      expect(stats.overwrites).toBe(5);
    });

    it("should retrieve frames in order", async () => {
      for (let i = 1; i <= 5; i++) {
        const frame = createMockFrame(i);
        const result = await processor.processFrame(frame);

        const processedFrame: ProcessedFrame = {
          frame,
          embedding: result.embedding,
          processingTime: result.latency,
          quality: {
            score: result.quality || 0.8,
            sharpness: 0.7,
            brightness: 0.8,
            contrast: 0.9,
            noise: 0.1,
            motionBlur: false,
          },
          metadata: {
            captureTime: frame.timestamp,
            processTime: performance.now(),
            source: "test",
            format: "rgba",
          },
        };

        ringBuffer.push(processedFrame);
      }

      const all = ringBuffer.getAll();
      expect(all).toHaveLength(5);
      expect(all[0].frame.id).toBe(1);
      expect(all[4].frame.id).toBe(5);
    });
  });

  describe("Streaming Integration", () => {
    let embeddingStream: EmbeddingStream;
    let actionStream: ActionStream;
    let processor: FrameProcessor;

    beforeEach(async () => {
      const streamConfig: StreamConfig = {
        format: "binary",
        batchSize: 5,
        compression: false,
        protocol: "ws",
        maxBufferSize: 10,
      };

      const processorConfig: FrameProcessorConfig = {
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

      embeddingStream = new EmbeddingStream(streamConfig);
      actionStream = new ActionStream(streamConfig);
      processor = new FrameProcessor(processorConfig);

      await processor.initialize();
      await embeddingStream.start();
      await actionStream.start();
    });

    it("should stream embeddings from processed frames", async () => {
      let streamResultCount = 0;

      embeddingStream.onStream((result) => {
        streamResultCount++;
        expect(result.embeddings).toBeDefined();
        expect(result.metadata).toBeDefined();
      });

      for (let i = 1; i <= 10; i++) {
        const frame = createMockFrame(i);
        const result = await processor.processFrame(frame);

        await embeddingStream.add(result.embedding, frame.id);
      }

      expect(streamResultCount).toBe(2); // 10 frames / batch size 5 = 2
    });

    it("should stream actions from video understanding", async () => {
      let actionResultCount = 0;

      actionStream.onStream((result) => {
        actionResultCount++;
        expect(result.actions).toBeDefined();
        expect(result.confidences).toBeDefined();
      });

      for (let i = 1; i <= 9; i++) {
        await actionStream.addAction(
          "modify",
          `button${i}`,
          { text: `Action ${i}` },
          0.8 + i * 0.01,
          i
        );
      }

      expect(actionResultCount).toBe(3); // 9 actions / batch size 3 = 3
    });

    it("should maintain stream statistics", async () => {
      for (let i = 1; i <= 5; i++) {
        const frame = createMockFrame(i);
        const result = await processor.processFrame(frame);
        await embeddingStream.add(result.embedding, frame.id);
      }

      const stats = embeddingStream.getStats();
      expect(stats.isStreaming).toBe(true);
      expect(stats.sequenceNumber).toBe(1);
    });
  });

  describe("End-to-End Pipeline", () => {
    it("should process video from capture to stream", async () => {
      // Setup components
      const processorConfig: FrameProcessorConfig = {
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

      const schedulerConfig: SchedulerConfig = {
        targetFPS: 30,
        frameTime: 33.33,
        strategy: "frame",
        maxLatency: 50,
        maxDrops: 5,
        adaptive: false,
      };

      const trackerConfig: LatencyTrackerConfig = {
        windowSize: 100,
        trackJitter: true,
        trackPercentiles: true,
        maxLatencyThreshold: 50,
      };

      const streamConfig: StreamConfig = {
        format: "binary",
        batchSize: 5,
        compression: false,
        protocol: "ws",
        maxBufferSize: 10,
      };

      const processor = new FrameProcessor(processorConfig);
      const scheduler = new RealTimeScheduler(schedulerConfig);
      const tracker = new LatencyTracker(trackerConfig);
      const stream = new EmbeddingStream(streamConfig);

      // Initialize
      await processor.initialize();
      await scheduler.start();
      await stream.start();

      // Process video
      const frameCount = 30;
      const frames: VideoFrame[] = [];

      for (let i = 1; i <= frameCount; i++) {
        frames.push(createMockFrame(i));
      }

      let processedCount = 0;
      let streamedCount = 0;

      stream.onStream((result) => {
        streamedCount += result.embeddings.length;
      });

      const startTime = performance.now();

      for (const frame of frames) {
        // Schedule
        const decision = scheduler.schedule(frame);

        if (!decision.process) {
          continue;
        }

        // Track
        tracker.startFrame(frame.id);

        // Process
        const result = await processor.processFrame(frame);

        tracker.endFrame(frame.id, result.dropped);

        if (!result.dropped) {
          processedCount++;

          // Stream
          await stream.add(result.embedding, frame.id);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Verify results
      expect(processedCount).toBeGreaterThan(0);
      expect(streamedCount).toBeGreaterThan(0);

      const latencyMetrics = tracker.getMetrics();
      expect(latencyMetrics.totalFrames).toBe(frameCount);

      const schedulerStats = scheduler.getStats();
      expect(schedulerStats.processedCount).toBeGreaterThan(0);

      const streamStats = stream.getStats();
      expect(streamStats.sequenceNumber).toBeGreaterThan(0);

      // Check performance targets
      expect(duration).toBeLessThan(2000); // Should complete in reasonable time
    });
  });

  describe("Error Handling", () => {
    it("should handle processing errors gracefully", async () => {
      const config: FrameProcessorConfig = {
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

      const processor = new FrameProcessor(config);
      await processor.initialize();

      // Invalid frame
      const invalidFrame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(0),
        width: 0,
        height: 0,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      const result = await processor.processFrame(invalidFrame);

      expect(result.dropped).toBe(true);
      expect(result.dropReason).toBeDefined();
    });

    it("should recover from errors", async () => {
      const config: FrameProcessorConfig = {
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

      const processor = new FrameProcessor(config);
      await processor.initialize();

      // Invalid frame
      const invalidFrame: VideoFrame = {
        id: 1,
        data: new Uint8ClampedArray(0),
        width: 0,
        height: 0,
        timestamp: performance.now(),
        sequenceNumber: 1,
        frameIndex: 0,
      };

      await processor.processFrame(invalidFrame);

      // Valid frame after error
      const validFrame = createMockFrame(2);
      const result = await processor.processFrame(validFrame);

      expect(result.dropped).toBe(false);
      expect(result.embedding).toBeDefined();
    });
  });

  describe("Performance Targets", () => {
    it("should achieve 30fps processing", async () => {
      const config: FrameProcessorConfig = {
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

      const processor = new FrameProcessor(config);
      await processor.initialize();

      const frameCount = 30;
      const startTime = performance.now();

      for (let i = 1; i <= frameCount; i++) {
        const frame = createMockFrame(i);
        await processor.processFrame(frame);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;
      const fps = (frameCount / duration) * 1000;

      expect(fps).toBeGreaterThan(25); // Allow some margin
    });

    it("should maintain latency under 50ms", async () => {
      const config: FrameProcessorConfig = {
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

      const processor = new FrameProcessor(config);
      await processor.initialize();

      const latencies: number[] = [];

      for (let i = 1; i <= 20; i++) {
        const frame = createMockFrame(i);
        const result = await processor.processFrame(frame);
        latencies.push(result.latency);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      expect(avgLatency).toBeLessThan(50);
      expect(maxLatency).toBeLessThan(100);
    });
  });
});
