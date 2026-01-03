/**
 * @lsi/vljepa-video/test/EmbeddingStream.test.ts
 *
 * Comprehensive tests for EmbeddingStream.
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EmbeddingStream,
  ActionStream,
  MetadataStream,
} from "../src/output/EmbeddingStream.js";
import type { StreamConfig, PredictedAction, StreamResult } from "../src/types.js";

describe("EmbeddingStream", () => {
  let stream: EmbeddingStream;
  let config: StreamConfig;

  function createMockEmbedding(id: number): Float32Array {
    return new Float32Array(768).fill(id * 0.01);
  }

  beforeEach(() => {
    config = {
      format: "binary",
      batchSize: 5,
      compression: false,
      protocol: "ws",
      maxBufferSize: 10,
    };

    stream = new EmbeddingStream(config);
  });

  describe("Initialization", () => {
    it("should initialize with correct config", () => {
      expect(stream).toBeDefined();
    });

    it("should generate unique stream ID", () => {
      const stream2 = new EmbeddingStream(config);

      const stats1 = stream.getStats();
      const stats2 = stream2.getStats();

      expect(stats1.streamId).not.toBe(stats2.streamId);
    });

    it("should have initial stats", () => {
      const stats = stream.getStats();

      expect(stats.isStreaming).toBe(false);
      expect(stats.bufferSize).toBe(0);
      expect(stats.sequenceNumber).toBe(0);
      expect(stats.clientCount).toBe(0);
    });
  });

  describe("Stream Lifecycle", () => {
    it("should start streaming", async () => {
      await stream.start();

      const stats = stream.getStats();
      expect(stats.isStreaming).toBe(true);
    });

    it("should not start when already streaming", async () => {
      await stream.start();

      await expect(stream.start()).rejects.toThrow("Already streaming");
    });

    it("should stop streaming", async () => {
      await stream.start();
      await stream.stop();

      const stats = stream.getStats();
      expect(stats.isStreaming).toBe(false);
    });

    it("should flush on stop", async () => {
      await stream.start();
      await stream.add(createMockEmbedding(1), 1);
      await stream.stop();

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(0);
    });
  });

  describe("Adding Embeddings", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should add embedding to stream", async () => {
      await stream.add(createMockEmbedding(1), 1);

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(1);
    });

    it("should flush when batch size reached", async () => {
      let flushed = false;

      stream.onStream((result) => {
        flushed = true;
        expect(result.embeddings).toHaveLength(5);
      });

      for (let i = 1; i <= 5; i++) {
        await stream.add(createMockEmbedding(i), i);
      }

      expect(flushed).toBe(true);
    });

    it("should manually flush buffer", async () => {
      for (let i = 1; i <= 3; i++) {
        await stream.add(createMockEmbedding(i), i);
      }

      const result = await stream.flush();
      expect(result).toBeDefined();
      expect(result?.embeddings).toHaveLength(3);
    });

    it("should return null when flushing empty buffer", async () => {
      const result = await stream.flush();
      expect(result).toBeNull();
    });

    it("should track frame IDs", async () => {
      for (let i = 1; i <= 5; i++) {
        await stream.add(createMockEmbedding(i), i * 10);
      }

      const result = await stream.flush();
      expect(result?.metadata.frameIds).toEqual([10, 20, 30, 40, 50]);
    });
  });

  describe("Stream Result", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should create stream result with embeddings", async () => {
      await stream.add(createMockEmbedding(1), 1);
      await stream.add(createMockEmbedding(2), 2);

      const result = await stream.flush();

      expect(result?.embeddings).toHaveLength(2);
      expect(result?.embeddings[0]).toBeInstanceOf(Float32Array);
      expect(result?.embeddings[0].length).toBe(768);
    });

    it("should include metadata", async () => {
      await stream.add(createMockEmbedding(1), 1);

      const result = await stream.flush();

      expect(result?.metadata.streamId).toBeDefined();
      expect(result?.metadata.encoding).toBe("binary");
    });

    it("should include timestamp", async () => {
      await stream.add(createMockEmbedding(1), 1);

      const result = await stream.flush();

      expect(result?.timestamp).toBeDefined();
      expect(result?.timestamp).toBeGreaterThan(0);
    });

    it("should increment sequence number", async () => {
      await stream.add(createMockEmbedding(1), 1);

      const result1 = await stream.flush();
      const stats1 = stream.getStats();

      await stream.add(createMockEmbedding(2), 2);
      const result2 = await stream.flush();
      const stats2 = stream.getStats();

      expect(result1?.sequence).toBe(0);
      expect(result2?.sequence).toBe(1);
    });
  });

  describe("Encoding", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should encode as JSON", async () => {
      config.format = "json";
      stream = new EmbeddingStream(config);
      await stream.start();

      await stream.add(createMockEmbedding(1), 1);

      const result = await stream.flush();
      expect(result?.metadata.encoding).toBe("json");
    });

    it("should encode as binary", async () => {
      await stream.add(createMockEmbedding(1), 1);

      const result = await stream.flush();
      expect(result?.metadata.encoding).toBe("binary");
    });

    it("should encode as protobuf", async () => {
      config.format = "protobuf";
      stream = new EmbeddingStream(config);
      await stream.start();

      await stream.add(createMockEmbedding(1), 1);

      const result = await stream.flush();
      expect(result?.metadata.encoding).toBe("protobuf");
    });

    it("should indicate compression", async () => {
      config.compression = true;
      stream = new EmbeddingStream(config);
      await stream.start();

      await stream.add(createMockEmbedding(1), 1);

      const result = await stream.flush();
      expect(result?.metadata.compression).toBeDefined();
    });
  });

  describe("Client Callbacks", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should notify clients on flush", async () => {
      let receivedResult: StreamResult | null = null;

      stream.onStream((result) => {
        receivedResult = result;
      });

      for (let i = 1; i <= 5; i++) {
        await stream.add(createMockEmbedding(i), i);
      }

      expect(receivedResult).toBeDefined();
    });

    it("should support multiple clients", async () => {
      let callCount = 0;

      const callback1 = () => { callCount++; };
      const callback2 = () => { callCount++; };

      stream.onStream(callback1);
      stream.onStream(callback2);

      for (let i = 1; i <= 5; i++) {
        await stream.add(createMockEmbedding(i), i);
      }

      expect(callCount).toBe(2);
    });

    it("should remove client callback", async () => {
      let callCount = 0;

      const callback = () => { callCount++; };

      stream.onStream(callback);
      stream.offStream(callback);

      for (let i = 1; i <= 5; i++) {
        await stream.add(createMockEmbedding(i), i);
      }

      expect(callCount).toBe(0);
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should track buffer size", async () => {
      for (let i = 1; i <= 3; i++) {
        await stream.add(createMockEmbedding(i), i);
      }

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(3);
    });

    it("should track sequence number", async () => {
      await stream.add(createMockEmbedding(1), 1);

      await stream.flush();

      const stats = stream.getStats();
      expect(stats.sequenceNumber).toBe(1);
    });

    it("should track client count", async () => {
      const callback = () => {};

      stream.onStream(callback);
      stream.onStream(callback);

      const stats = stream.getStats();
      expect(stats.clientCount).toBe(2);
    });
  });

  describe("Buffer Management", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should clear buffer", async () => {
      await stream.add(createMockEmbedding(1), 1);
      await stream.add(createMockEmbedding(2), 2);

      stream.clearBuffer();

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(0);
    });

    it("should respect batch size", async () => {
      let flushCount = 0;

      stream.onStream(() => {
        flushCount++;
      });

      for (let i = 1; i <= 15; i++) {
        await stream.add(createMockEmbedding(i), i);
      }

      // Should flush 3 times (15 / 5 = 3)
      expect(flushCount).toBe(3);
    });
  });

  describe("Edge Cases", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should handle empty embedding", async () => {
      await stream.add(new Float32Array(0), 1);

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(1);
    });

    it("should handle very large embedding", async () => {
      const largeEmbedding = new Float32Array(10000);
      await stream.add(largeEmbedding, 1);

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(1);
    });

    it("should handle rapid adds", async () => {
      const promises: Promise<void>[] = [];

      for (let i = 1; i <= 10; i++) {
        promises.push(stream.add(createMockEmbedding(i), i));
      }

      await Promise.all(promises);

      const stats = stream.getStats();
      expect(stats.bufferSize).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("ActionStream", () => {
  let stream: ActionStream;
  let config: StreamConfig;

  function createMockAction(id: number): PredictedAction {
    return {
      type: "modify",
      target: `element_${id}`,
      parameters: { value: id },
      confidence: 0.8 + id * 0.01,
    };
  }

  beforeEach(() => {
    config = {
      format: "json",
      batchSize: 3,
      compression: false,
      protocol: "ws",
    };

    stream = new ActionStream(config);
  });

  describe("Adding Actions", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should add action to stream", async () => {
      await stream.addAction("modify", "button1", { text: "Click" }, 0.9, 1);

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(1);
    });

    it("should flush when batch size reached", async () => {
      let flushed = false;

      stream.onStream((result) => {
        flushed = true;
      });

      for (let i = 1; i <= 3; i++) {
        await stream.addAction("modify", `button${i}`, {}, 0.8, i);
      }

      expect(flushed).toBe(true);
    });

    it("should include actions in result", async () => {
      await stream.addAction("create", "button1", { text: "Click" }, 0.9, 1);
      await stream.addAction("modify", "button2", { text: "Press" }, 0.85, 2);
      await stream.addAction("delete", "button3", {}, 0.75, 3);

      const result = await stream.flush();

      expect(result?.actions).toHaveLength(3);
      expect(result?.actions[0].type).toBe("create");
      expect(result?.actions[1].type).toBe("modify");
      expect(result?.actions[2].type).toBe("delete");
    });

    it("should include confidences", async () => {
      for (let i = 1; i <= 3; i++) {
        await stream.addAction("modify", `button${i}`, {}, 0.8 + i * 0.05, i);
      }

      const result = await stream.flush();

      expect(result?.confidences).toHaveLength(3);
      expect(result?.confidences[0]).toBeCloseTo(0.85);
    });
  });

  describe("Action History", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should track action history", async () => {
      for (let i = 1; i <= 5; i++) {
        await stream.addAction("modify", `button${i}`, {}, 0.8, i);
      }

      await stream.flush();

      const history = stream.getHistory();
      expect(history).toHaveLength(5);
    });

    it("should get recent history", async () => {
      for (let i = 1; i <= 10; i++) {
        await stream.addAction("modify", `button${i}`, {}, 0.8, i);
      }

      await stream.flush();

      const recent = stream.getHistory(5);
      expect(recent).toHaveLength(5);
    });

    it("should get actions by type", async () => {
      for (let i = 1; i <= 10; i++) {
        const type = i % 2 === 0 ? "create" : "modify";
        await stream.addAction(type, `button${i}`, {}, 0.8, i);
      }

      await stream.flush();

      const createActions = stream.getActionsByType("create");
      const modifyActions = stream.getActionsByType("modify");

      expect(createActions).toHaveLength(5);
      expect(modifyActions).toHaveLength(5);
    });

    it("should get actions by target", async () => {
      await stream.addAction("modify", "button1", {}, 0.8, 1);
      await stream.addAction("create", "button1", {}, 0.8, 2);
      await stream.addAction("modify", "button2", {}, 0.8, 3);

      await stream.flush();

      const button1Actions = stream.getActionsByTarget("button1");
      expect(button1Actions).toHaveLength(2);
    });

    it("should get actions by confidence threshold", async () => {
      for (let i = 1; i <= 10; i++) {
        await stream.addAction("modify", `button${i}`, {}, 0.5 + i * 0.05, i);
      }

      await stream.flush();

      const highConfidence = stream.getActionsByConfidence(0.8);
      expect(highConfidence.length).toBeGreaterThan(0);

      for (const action of highConfidence) {
        expect(action.confidence).toBeGreaterThanOrEqual(0.8);
      }
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should track total actions", async () => {
      for (let i = 1; i <= 10; i++) {
        await stream.addAction("modify", `button${i}`, {}, 0.8, i);
      }

      await stream.flush();

      const stats = stream.getStats();
      expect(stats.totalActions).toBe(10);
    });

    it("should categorize actions by type", async () => {
      for (let i = 1; i <= 10; i++) {
        const type = ["create", "modify", "delete"][i % 3];
        await stream.addAction(type, `button${i}`, {}, 0.8, i);
      }

      await stream.flush();

      const stats = stream.getStats();
      expect(stats.actionsByType.create).toBeGreaterThan(0);
      expect(stats.actionsByType.modify).toBeGreaterThan(0);
      expect(stats.actionsByType.delete).toBeGreaterThan(0);
    });

    it("should calculate average confidence", async () => {
      for (let i = 1; i <= 10; i++) {
        await stream.addAction("modify", `button${i}`, {}, 0.7 + i * 0.02, i);
      }

      await stream.flush();

      const stats = stream.getStats();
      expect(stats.avgConfidence).toBeGreaterThan(0.7);
      expect(stats.avgConfidence).toBeLessThan(1.0);
    });

    it("should count high and low confidence actions", async () => {
      for (let i = 1; i <= 10; i++) {
        const confidence = i <= 3 ? 0.9 : i <= 6 ? 0.5 : 0.3;
        await stream.addAction("modify", `button${i}`, {}, confidence, i);
      }

      await stream.flush();

      const stats = stream.getStats();
      expect(stats.highConfidenceActions).toBe(3);
      expect(stats.lowConfidenceActions).toBe(4);
    });
  });

  describe("Reset", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should clear buffer", async () => {
      await stream.addAction("modify", "button1", {}, 0.8, 1);

      stream.clearBuffer();

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(0);
    });

    it("should clear history", async () => {
      for (let i = 1; i <= 5; i++) {
        await stream.addAction("modify", `button${i}`, {}, 0.8, i);
      }

      await stream.flush();

      stream.clearHistory();

      const history = stream.getHistory();
      expect(history).toHaveLength(0);
    });

    it("should reset all state", async () => {
      for (let i = 1; i <= 5; i++) {
        await stream.addAction("modify", `button${i}`, {}, 0.8, i);
      }

      await stream.flush();

      stream.reset();

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(0);
      expect(stats.sequenceNumber).toBe(0);
    });
  });
});

describe("MetadataStream", () => {
  let stream: MetadataStream;
  let config: StreamConfig;

  beforeEach(() => {
    config = {
      format: "json",
      batchSize: 5,
      compression: false,
      protocol: "ws",
    };

    stream = new MetadataStream(config);
  });

  describe("Adding Metadata", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should add metadata to stream", async () => {
      await stream.add(1, performance.now(), { quality: 0.8 });

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(1);
    });

    it("should include flags", async () => {
      await stream.add(
        1,
        performance.now(),
        { quality: 0.8 },
        { keyframe: true, dropped: false, hasMotion: true }
      );

      await stream.flush();

      const history = stream.getHistory();
      expect(history[0].flags?.keyframe).toBe(true);
      expect(history[0].flags?.hasMotion).toBe(true);
    });

    it("should flush on batch size", async () => {
      let flushed = false;

      stream.onStream(() => {
        flushed = true;
      });

      for (let i = 1; i <= 5; i++) {
        await stream.add(i, performance.now(), {});
      }

      expect(flushed).toBe(true);
    });
  });

  describe("Metadata Retrieval", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should get history", async () => {
      for (let i = 1; i <= 10; i++) {
        await stream.add(i, performance.now() + i, { frame: i });
      }

      const history = stream.getHistory();
      expect(history).toHaveLength(10);
    });

    it("should get recent history", async () => {
      for (let i = 1; i <= 10; i++) {
        await stream.add(i, performance.now() + i, {});
      }

      const recent = stream.getHistory(5);
      expect(recent).toHaveLength(5);
    });

    it("should get by frame ID", async () => {
      await stream.add(5, performance.now(), { quality: 0.8 });
      await stream.add(10, performance.now(), { quality: 0.9 });

      const metadata = stream.getByFrameId(5);
      expect(metadata?.frameId).toBe(5);
      expect(metadata?.metadata.quality).toBe(0.8);
    });

    it("should get in time range", async () => {
      const now = performance.now();

      await stream.add(1, now - 100, {});
      await stream.add(2, now, {});
      await stream.add(3, now + 100, {});

      const inRange = stream.getInTimeRange(now - 50, now + 50);
      expect(inRange).toHaveLength(2);
    });

    it("should get keyframes", async () => {
      await stream.add(1, performance.now(), {}, { keyframe: true });
      await stream.add(2, performance.now(), {}, {});
      await stream.add(3, performance.now(), {}, { keyframe: true });

      const keyframes = stream.getKeyframes();
      expect(keyframes).toHaveLength(2);
    });

    it("should get dropped frames", async () => {
      await stream.add(1, performance.now(), {}, { dropped: true });
      await stream.add(2, performance.now(), {}, {});
      await stream.add(3, performance.now(), {}, { dropped: true });

      const dropped = stream.getDroppedFrames();
      expect(dropped).toHaveLength(2);
    });

    it("should get frames with motion", async () => {
      await stream.add(1, performance.now(), {}, { hasMotion: true });
      await stream.add(2, performance.now(), {}, {});
      await stream.add(3, performance.now(), {}, { hasMotion: true });

      const withMotion = stream.getFramesWithMotion();
      expect(withMotion).toHaveLength(2);
    });
  });

  describe("Statistics", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should track buffer size", async () => {
      for (let i = 1; i <= 3; i++) {
        await stream.add(i, performance.now(), {});
      }

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(3);
    });

    it("should track sequence number", async () => {
      await stream.add(1, performance.now(), {});
      await stream.flush();

      const stats = stream.getStats();
      expect(stats.sequenceNumber).toBe(1);
    });

    it("should track history size", async () => {
      for (let i = 1; i <= 10; i++) {
        await stream.add(i, performance.now(), {});
      }

      const stats = stream.getStats();
      expect(stats.historySize).toBe(10);
    });

    it("should count keyframes", async () => {
      await stream.add(1, performance.now(), {}, { keyframe: true });
      await stream.add(2, performance.now(), {}, {});
      await stream.add(3, performance.now(), {}, { keyframe: true });

      const stats = stream.getStats();
      expect(stats.keyframeCount).toBe(2);
    });

    it("should count dropped frames", async () => {
      await stream.add(1, performance.now(), {}, { dropped: true });
      await stream.add(2, performance.now(), {}, {});
      await stream.add(3, performance.now(), {}, { dropped: true });

      const stats = stream.getStats();
      expect(stats.droppedFrameCount).toBe(2);
    });

    it("should count motion frames", async () => {
      await stream.add(1, performance.now(), {}, { hasMotion: true });
      await stream.add(2, performance.now(), {}, {});
      await stream.add(3, performance.now(), {}, { hasMotion: true });

      const stats = stream.getStats();
      expect(stats.motionFrameCount).toBe(2);
    });
  });

  describe("Client Callbacks", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should notify clients on flush", async () => {
      let received = false;

      stream.onStream(() => {
        received = true;
      });

      for (let i = 1; i <= 5; i++) {
        await stream.add(i, performance.now(), {});
      }

      expect(received).toBe(true);
    });

    it("should include stream ID in result", async () => {
      let streamId: string | null = null;

      stream.onStream((result) => {
        streamId = result.streamId;
      });

      for (let i = 1; i <= 5; i++) {
        await stream.add(i, performance.now(), {});
      }

      expect(streamId).toBeDefined();
    });
  });

  describe("Reset", () => {
    beforeEach(async () => {
      await stream.start();
    });

    it("should clear buffer", async () => {
      await stream.add(1, performance.now(), {});

      stream.clearBuffer();

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(0);
    });

    it("should clear history", async () => {
      for (let i = 1; i <= 5; i++) {
        await stream.add(i, performance.now(), {});
      }

      stream.clearHistory();

      const stats = stream.getStats();
      expect(stats.historySize).toBe(0);
    });

    it("should reset all state", async () => {
      for (let i = 1; i <= 5; i++) {
        await stream.add(i, performance.now(), {});
      }

      stream.reset();

      const stats = stream.getStats();
      expect(stats.bufferSize).toBe(0);
      expect(stats.historySize).toBe(0);
      expect(stats.sequenceNumber).toBe(0);
    });
  });
});
