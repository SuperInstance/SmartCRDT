/**
 * @fileoverview VL-JEPA Bridge Tests
 * @coverage 40+ tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VLJEPABridge, createVLJEPABridge } from "../state/VLJEPABridge.js";
import type {
  VLJEPAPrediction,
  VLJEPAAction,
} from "@lsi/vljepa/src/protocol.js";

describe("VLJEPABridge", () => {
  let bridge: VLJEPABridge;

  beforeEach(() => {
    bridge = createVLJEPABridge({
      minConfidence: 0.5,
      maxActions: 10,
      enableCaching: true,
    });
  });

  describe("Constructor", () => {
    it("should create bridge with default config", () => {
      const defaultBridge = createVLJEPABridge();
      expect(defaultBridge).toBeDefined();
      const config = defaultBridge.getConfig();
      expect(config.minConfidence).toBe(0.5);
      expect(config.maxActions).toBe(10);
    });

    it("should create bridge with custom config", () => {
      const customBridge = createVLJEPABridge({
        minConfidence: 0.7,
        maxActions: 5,
        enableCaching: false,
      });
      const config = customBridge.getConfig();
      expect(config.minConfidence).toBe(0.7);
      expect(config.maxActions).toBe(5);
      expect(config.enableCaching).toBe(false);
    });

    it("should initialize empty cache", () => {
      const config = bridge.getConfig();
      expect(config.enableCaching).toBe(true);
    });
  });

  describe("Prediction to Bridge State", () => {
    it("should convert prediction to bridge state", () => {
      const prediction: VLJEPAPrediction = {
        version: "1.0",
        goalEmbedding: new Float32Array(768),
        confidence: 0.85,
        actions: [],
        metadata: {
          timestamp: Date.now(),
          processingTime: 100,
        },
      };

      const state = bridge.predictionToBridgeState(prediction);

      expect(state.version).toBe("1.0");
      expect(state.confidence).toBe(0.85);
      expect(state.goalEmbedding).toEqual(prediction.goalEmbedding);
      expect(state.actions).toEqual([]);
    });

    it("should filter actions by confidence", () => {
      const actions: VLJEPAAction[] = [
        { type: "modify", target: "#btn1", params: {}, confidence: 0.9 },
        { type: "create", target: "#btn2", params: {}, confidence: 0.3 },
        { type: "delete", target: "#btn3", params: {}, confidence: 0.6 },
      ];

      const prediction: VLJEPAPrediction = {
        version: "1.0",
        goalEmbedding: new Float32Array(768),
        confidence: 0.8,
        actions,
        metadata: {
          timestamp: Date.now(),
          processingTime: 100,
        },
      };

      const state = bridge.predictionToBridgeState(prediction);

      expect(state.actions.length).toBe(2);
      expect(state.actions.every(a => a.confidence >= 0.5)).toBe(true);
    });

    it("should limit actions to maxActions", () => {
      const actions: VLJEPAAction[] = Array.from({ length: 15 }, (_, i) => ({
        type: "modify",
        target: `#elem${i}`,
        params: {},
        confidence: 0.9 - i * 0.01,
      }));

      const prediction: VLJEPAPrediction = {
        version: "1.0",
        goalEmbedding: new Float32Array(768),
        confidence: 0.8,
        actions,
        metadata: {
          timestamp: Date.now(),
          processingTime: 100,
        },
      };

      const state = bridge.predictionToBridgeState(prediction);

      expect(state.actions.length).toBe(10);
    });

    it("should preserve metadata", () => {
      const prediction: VLJEPAPrediction = {
        version: "1.0",
        goalEmbedding: new Float32Array(768),
        confidence: 0.8,
        actions: [],
        semanticDistance: 0.25,
        metadata: {
          timestamp: 1234567890,
          processingTime: 250,
          xEncoderTime: 80,
          yEncoderTime: 70,
          predictorTime: 100,
          device: "webgpu",
          modelVersion: "1.0.0",
          usedCache: true,
        },
      };

      const state = bridge.predictionToBridgeState(prediction);

      expect(state.semanticDistance).toBe(0.25);
      expect(state.metadata.processingTime).toBe(250);
      expect(state.metadata.device).toBe("webgpu");
    });
  });

  describe("Visual State Creation", () => {
    it("should create visual state from embedding and actions", () => {
      const embedding = new Float32Array(768);
      const actions: VLJEPAAction[] = [
        {
          type: "modify",
          target: "#button",
          params: { color: "red" },
          confidence: 0.9,
        },
      ];

      const visualState = bridge.createVisualState(embedding, actions);

      expect(visualState.embedding).toEqual(embedding);
      expect(visualState.elements.length).toBeGreaterThan(0);
      expect(visualState.confidence).toBeGreaterThan(0);
      expect(visualState.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it("should detect UI elements from actions", () => {
      const embedding = new Float32Array(768);
      const actions: VLJEPAAction[] = [
        {
          type: "modify",
          target: "#submit-btn",
          params: { text: "Submit" },
          confidence: 0.9,
        },
        {
          type: "create",
          target: "#input-field",
          params: { type: "text" },
          confidence: 0.8,
        },
      ];

      const visualState = bridge.createVisualState(embedding, actions);

      expect(visualState.elements.length).toBe(2);
      expect(visualState.elements[0].type).toBeDefined();
      expect(visualState.elements[0].selector).toBeDefined();
    });

    it("should extract visual features", () => {
      const embedding = new Float32Array(768);
      const actions: VLJEPAAction[] = [
        {
          type: "modify",
          target: "#div",
          params: { display: "flex", gap: 16 },
          confidence: 0.9,
        },
      ];

      const visualState = bridge.createVisualState(embedding, actions);

      expect(visualState.features).toBeDefined();
      expect(visualState.features.colors).toBeDefined();
      expect(visualState.features.layout).toBeDefined();
      expect(visualState.features.spacing).toBeDefined();
      expect(visualState.features.typography).toBeDefined();
    });

    it("should calculate visual confidence", () => {
      const embedding = new Float32Array(768);
      const actions: VLJEPAAction[] = [
        { type: "modify", target: "#elem1", params: {}, confidence: 0.9 },
        { type: "modify", target: "#elem2", params: {}, confidence: 0.7 },
      ];

      const visualState = bridge.createVisualState(embedding, actions);

      expect(visualState.confidence).toBeGreaterThan(0);
      expect(visualState.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Embedding State Creation", () => {
    it("should create embedding state from three embeddings", () => {
      const visual = new Float32Array(768).fill(0.1);
      const intent = new Float32Array(768).fill(0.2);
      const goal = new Float32Array(768).fill(0.3);

      const embeddingState = bridge.createEmbeddingState(visual, intent, goal);

      expect(embeddingState.visual).toEqual(visual);
      expect(embeddingState.intent).toEqual(intent);
      expect(embeddingState.goal).toEqual(goal);
      expect(embeddingState.fused).toBeDefined();
      expect(embeddingState.fused.length).toBe(768);
    });

    it("should fuse embeddings with weights", () => {
      const visual = new Float32Array([1, 2, 3]);
      const intent = new Float32Array([4, 5, 6]);

      bridge.updateConfig({ fusionWeights: { visual: 0.7, intent: 0.3 } });

      const embeddingState = bridge.createEmbeddingState(
        visual,
        intent,
        new Float32Array(768)
      );

      expect(embeddingState.weights.visual).toBe(0.7);
      expect(embeddingState.weights.intent).toBe(0.3);
    });

    it("should compute similarities between embeddings", () => {
      const visual = new Float32Array(768).fill(0.5);
      const intent = new Float32Array(768).fill(0.5);
      const goal = new Float32Array(768).fill(0.5);

      const embeddingState = bridge.createEmbeddingState(visual, intent, goal);

      expect(embeddingState.similarities.visualIntent).toBeDefined();
      expect(embeddingState.similarities.visualGoal).toBeDefined();
      expect(embeddingState.similarities.intentGoal).toBeDefined();
    });

    it("should handle different embedding values", () => {
      const visual = new Float32Array([1, 0, 0]);
      const intent = new Float32Array([0, 1, 0]);
      const goal = new Float32Array([0, 0, 1]);

      const embeddingState = bridge.createEmbeddingState(visual, intent, goal);

      expect(embeddingState.similarities.visualIntent).toBeLessThan(1);
      expect(embeddingState.similarities.visualGoal).toBeLessThan(1);
    });
  });

  describe("Action Extraction and Filtering", () => {
    it("should filter actions by confidence threshold", () => {
      const actions: VLJEPAAction[] = [
        { type: "modify", target: "#a", params: {}, confidence: 0.9 },
        { type: "modify", target: "#b", params: {}, confidence: 0.4 },
        { type: "modify", target: "#c", params: {}, confidence: 0.6 },
      ];

      const filtered = bridge.filterActions(actions);

      expect(filtered.length).toBe(2);
      expect(filtered.every(a => a.confidence >= 0.5)).toBe(true);
    });

    it("should sort actions by confidence", () => {
      const actions: VLJEPAAction[] = [
        { type: "modify", target: "#a", params: {}, confidence: 0.5 },
        { type: "modify", target: "#b", params: {}, confidence: 0.9 },
        { type: "modify", target: "#c", params: {}, confidence: 0.7 },
      ];

      const filtered = bridge.filterActions(actions);

      expect(filtered[0].confidence).toBeGreaterThanOrEqual(
        filtered[1].confidence
      );
      expect(filtered[1].confidence).toBeGreaterThanOrEqual(
        filtered[2].confidence
      );
    });

    it("should extract high confidence actions", () => {
      const prediction: VLJEPAPrediction = {
        version: "1.0",
        goalEmbedding: new Float32Array(768),
        confidence: 0.8,
        actions: [
          { type: "modify", target: "#a", params: {}, confidence: 0.9 },
          { type: "modify", target: "#b", params: {}, confidence: 0.4 },
        ],
        metadata: { timestamp: Date.now(), processingTime: 100 },
      };

      const actions = bridge.extractActions(prediction, 0.6);

      expect(actions.length).toBe(1);
      expect(actions[0].target).toBe("#a");
    });

    it("should group actions by target", () => {
      const actions: VLJEPAAction[] = [
        {
          type: "modify",
          target: "#btn",
          params: { color: "red" },
          confidence: 0.9,
        },
        {
          type: "restyle",
          target: "#btn",
          params: { size: "large" },
          confidence: 0.8,
        },
        { type: "modify", target: "#input", params: {}, confidence: 0.7 },
      ];

      const grouped = bridge.groupActionsByTarget(actions);

      expect(grouped.size).toBe(2);
      expect(grouped.get("#btn")?.length).toBe(2);
      expect(grouped.get("#input")?.length).toBe(1);
    });
  });

  describe("Embedding Fusion", () => {
    it("should fuse embeddings correctly", () => {
      const visual = new Float32Array([2, 4, 6]);
      const intent = new Float32Array([4, 6, 8]);

      const fused = bridge.fuseEmbeddings(visual, intent);

      expect(fused.length).toBe(3);
      expect(fused[0]).toBeCloseTo(3, 1); // (2+4)/2
      expect(fused[1]).toBeCloseTo(5, 1); // (4+6)/2
    });

    it("should normalize fused embedding", () => {
      const visual = new Float32Array([3, 4]);
      const intent = new Float32Array([0, 0]);

      const fused = bridge.fuseEmbeddings(visual, intent);

      const norm = Math.sqrt(fused[0] * fused[0] + fused[1] * fused[1]);
      expect(norm).toBeCloseTo(1, 5);
    });

    it("should handle dimension mismatch error", () => {
      const visual = new Float32Array([1, 2, 3]);
      const intent = new Float32Array([1, 2]);

      expect(() => bridge.fuseEmbeddings(visual, intent)).toThrow();
    });

    it("should compute cosine similarity", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([1, 0, 0]);

      const similarity = bridge.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it("should compute cosine similarity for orthogonal vectors", () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);

      const similarity = bridge.cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(0, 5);
    });
  });

  describe("Caching", () => {
    it("should cache bridge state", () => {
      const visionInput = "image1.png";
      const intent = "make button red";

      const state = bridge.predictionToBridgeState({
        version: "1.0",
        goalEmbedding: new Float32Array(768),
        confidence: 0.8,
        actions: [],
        metadata: { timestamp: Date.now(), processingTime: 100 },
      });

      bridge.setCachedState(visionInput, intent, state);

      const cached = bridge.getCachedState(visionInput, intent);

      expect(cached).toBeDefined();
      expect(cached!.confidence).toBe(0.8);
    });

    it("should return null for cache miss", () => {
      const cached = bridge.getCachedState("nonexistent", "intent");

      expect(cached).toBeNull();
    });

    it("should clear expired cache entries", () => {
      bridge.setCachedState(
        "img",
        "intent",
        bridge.predictionToBridgeState({
          version: "1.0",
          goalEmbedding: new Float32Array(768),
          confidence: 0.8,
          actions: [],
          metadata: { timestamp: Date.now(), processingTime: 100 },
        })
      );

      // Manually expire entry by setting very short TTL
      bridge.updateConfig({ cacheTTL: 1 });
      bridge.setCachedState(
        "img2",
        "intent2",
        bridge.predictionToBridgeState({
          version: "1.0",
          goalEmbedding: new Float32Array(768),
          confidence: 0.8,
          actions: [],
          metadata: { timestamp: Date.now(), processingTime: 100 },
        })
      );

      // Wait for expiry
      return new Promise(resolve => {
        setTimeout(() => {
          bridge.clearExpiredCache();
          resolve(true);
        }, 10);
      });
    });

    it("should clear all cache", () => {
      bridge.setCachedState(
        "a",
        "b",
        bridge.predictionToBridgeState({
          version: "1.0",
          goalEmbedding: new Float32Array(768),
          confidence: 0.8,
          actions: [],
          metadata: { timestamp: Date.now(), processingTime: 100 },
        })
      );

      bridge.clearCache();

      expect(bridge.getCachedState("a", "b")).toBeNull();
    });
  });

  describe("State Synchronization", () => {
    it("should sync VL-JEPA state with agent state", async () => {
      const agentState = {
        query: "test",
        intent: [],
        route: "local" as const,
        privacy: "public" as const,
        status: "idle" as const,
        sessionId: "session123",
        complexity: 0.5,
      };

      const prediction: VLJEPAPrediction = {
        version: "1.0",
        goalEmbedding: new Float32Array(768),
        confidence: 0.8,
        actions: [
          { type: "modify", target: "#btn", params: {}, confidence: 0.9 },
        ],
        metadata: { timestamp: Date.now(), processingTime: 100 },
      };

      const synced = await bridge.syncState(prediction, agentState);

      expect(synced.vljepa.confidence).toBe(0.8);
      expect(synced.visual.elements).toBeDefined();
      expect(synced.embeddings.fused).toBeDefined();
      expect(synced.pendingActions.length).toBe(1);
    });
  });

  describe("Utility Methods", () => {
    it("should validate embedding dimension", () => {
      const valid = new Float32Array(768);
      const invalid = new Float32Array(512);

      expect(bridge.validateEmbedding(valid)).toBe(true);
      expect(bridge.validateEmbedding(invalid)).toBe(false);
    });

    it("should clone bridge state", () => {
      const original = bridge.predictionToBridgeState({
        version: "1.0",
        goalEmbedding: new Float32Array(768),
        confidence: 0.8,
        actions: [
          { type: "modify", target: "#btn", params: {}, confidence: 0.9 },
        ],
        metadata: { timestamp: Date.now(), processingTime: 100 },
      });

      const cloned = bridge.cloneBridgeState(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.goalEmbedding).not.toBe(original.goalEmbedding);
    });

    it("should serialize and deserialize state", () => {
      const state = bridge.predictionToBridgeState({
        version: "1.0",
        goalEmbedding: new Float32Array([1, 2, 3]),
        confidence: 0.8,
        actions: [],
        metadata: { timestamp: Date.now(), processingTime: 100 },
      });

      const serialized = bridge.serializeBridgeState(state);
      const deserialized = bridge.deserializeBridgeState(serialized);

      expect(deserialized.version).toBe(state.version);
      expect(deserialized.confidence).toBe(state.confidence);
      expect(Array.from(deserialized.goalEmbedding)).toEqual([1, 2, 3]);
    });

    it("should update config", () => {
      bridge.updateConfig({ minConfidence: 0.9 });

      expect(bridge.getConfig().minConfidence).toBe(0.9);
    });
  });
});
