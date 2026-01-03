/**
 * @fileoverview Additional Integration Tests
 * @coverage 15+ tests
 */

import { describe, it, expect } from "vitest";
import { VLJEPABridge, createVLJEPABridge } from "../state/VLJEPABridge.js";
import {
  EmbeddingStateManager,
  createEmbeddingStateManager,
} from "../state/EmbeddingState.js";
import {
  VisualStateManager,
  createVisualStateManager,
} from "../state/VisualState.js";
import {
  VLJEPAAgentStateManager,
  createVLJEPAAgentStateManager,
} from "../state/VLJEPAAgentState.js";
import {
  HITLCheckpointManager,
  createHITLCheckpointManager,
} from "../checkpoints/HITLCheckpoint.js";

describe("VL-JEPA Integration Tests", () => {
  describe("End-to-End Bridge Workflow", () => {
    it("should complete full prediction to state workflow", () => {
      const bridge = createVLJEPABridge();
      const prediction = {
        version: "1.0" as const,
        goalEmbedding: new Float32Array(768).fill(0.5),
        confidence: 0.85,
        actions: [
          {
            type: "modify" as const,
            target: "#btn",
            params: { color: "red" },
            confidence: 0.9,
          },
          {
            type: "create" as const,
            target: "#input",
            params: { type: "text" },
            confidence: 0.8,
          },
        ],
        metadata: { timestamp: Date.now(), processingTime: 100 },
      };

      const bridgeState = bridge.predictionToBridgeState(prediction);
      expect(bridgeState.actions.length).toBe(2);
      expect(bridgeState.confidence).toBe(0.85);
    });

    it("should integrate visual and embedding states", () => {
      const bridge = createVLJEPABridge();
      const visualEmbedding = new Float32Array(768).fill(0.1);
      const intentEmbedding = new Float32Array(768).fill(0.2);
      const goalEmbedding = new Float32Array(768).fill(0.3);

      const visualState = bridge.createVisualState(visualEmbedding, []);
      const embeddingState = bridge.createEmbeddingState(
        visualEmbedding,
        intentEmbedding,
        goalEmbedding
      );

      expect(visualState.elements).toBeDefined();
      expect(embeddingState.fused).toBeDefined();
      expect(embeddingState.similarities.visualIntent).toBeDefined();
    });
  });

  describe("Multi-Component Integration", () => {
    it("should work with embedding manager", () => {
      const embeddingManager = createEmbeddingStateManager();
      const visual = embeddingManager.createEmbedding([1, 2, 3], "x-encoder");
      const intent = embeddingManager.createEmbedding([4, 5, 6], "y-encoder");

      const fused = embeddingManager.fuseVisualIntent(visual, intent);

      expect(fused.values.length).toBe(3);
      expect(fused.isNormalized).toBe(true);
    });

    it("should work with visual manager", () => {
      const visualManager = createVisualStateManager();
      const actions = [
        {
          type: "modify" as const,
          target: "#div",
          params: { display: "flex" },
          confidence: 0.9,
        },
      ];

      const elements = visualManager.detectElements(actions);

      expect(elements.length).toBeGreaterThan(0);
      expect(elements[0].type).toBeDefined();
    });

    it("should work with agent state manager", () => {
      const agentManager = createVLJEPAAgentStateManager();
      const state = agentManager.getState();

      expect(state.vljepa).toBeDefined();
      expect(state.visual).toBeDefined();
      expect(state.embeddings).toBeDefined();
    });

    it("should work with checkpoint manager", async () => {
      const checkpointManager = createHITLCheckpointManager();
      const actions = [
        {
          type: "modify" as const,
          target: "#btn",
          params: {},
          confidence: 0.9,
        },
      ];

      const id = await checkpointManager.createCheckpoint(
        "visual_confirmation",
        actions,
        "Review",
        { required: false, sessionId: "session123" }
      );

      expect(id).toBeDefined();

      const checkpoint = checkpointManager.getCheckpoint(id);
      expect(checkpoint.actions).toEqual(actions);
    });
  });

  describe("Cache Integration", () => {
    it("should cache and retrieve state", () => {
      const bridge = createVLJEPABridge();
      const state = bridge.predictionToBridgeState({
        version: "1.0",
        goalEmbedding: new Float32Array(768),
        confidence: 0.8,
        actions: [],
        metadata: { timestamp: Date.now(), processingTime: 100 },
      });

      bridge.setCachedState("img", "intent", state);
      const cached = bridge.getCachedState("img", "intent");

      expect(cached).toBeDefined();
      expect(cached!.confidence).toBe(0.8);
    });

    it("should cache similarity results", () => {
      const embeddingManager = createEmbeddingStateManager();
      const a = embeddingManager.createEmbedding([1, 2], "x-encoder");
      const b = embeddingManager.createEmbedding([1, 2], "y-encoder");

      const sim1 = embeddingManager.cosineSimilarity(a, b);
      const sim2 = embeddingManager.cosineSimilarity(a, b);

      expect(sim1).toBe(sim2);
    });
  });

  describe("Action Flow", () => {
    it("should filter and group actions correctly", () => {
      const bridge = createVLJEPABridge();
      const actions = [
        {
          type: "modify" as const,
          target: "#btn1",
          params: {},
          confidence: 0.9,
        },
        {
          type: "modify" as const,
          target: "#btn1",
          params: {},
          confidence: 0.7,
        },
        {
          type: "modify" as const,
          target: "#btn2",
          params: {},
          confidence: 0.3,
        },
        {
          type: "delete" as const,
          target: "#old",
          params: {},
          confidence: 0.8,
        },
      ];

      const filtered = bridge.filterActions(actions);
      const grouped = bridge.groupActionsByTarget(filtered);

      expect(filtered.length).toBeLessThanOrEqual(3); // One below 0.5 threshold
      expect(grouped.get("#btn1")?.length).toBe(2);
    });

    it("should detect element types from actions", () => {
      const visualManager = createVisualStateManager();
      const actions = [
        {
          type: "modify" as const,
          target: "#submit",
          params: { onClick: "handler" },
          confidence: 0.9,
        },
        {
          type: "modify" as const,
          target: "#email",
          params: { type: "email" },
          confidence: 0.9,
        },
        {
          type: "create" as const,
          target: "#card",
          params: { display: "flex" },
          confidence: 0.9,
        },
      ];

      const elements = visualManager.detectElements(actions);

      expect(elements.length).toBe(3);
      expect(elements.some(e => e.type === "button")).toBe(true);
      expect(elements.some(e => e.type === "input")).toBe(true);
    });
  });

  describe("State Serialization", () => {
    it("should serialize and deserialize agent state", () => {
      const {
        serializeAgentState,
        deserializeAgentState,
        VLJEPAAgentStateManager,
      } = require("../state/VLJEPAAgentState.js");

      const manager = new VLJEPAAgentStateManager();
      const state = manager.getState();

      const serialized = serializeAgentState(state);
      const deserialized = deserializeAgentState(serialized);

      expect(deserialized.sessionId).toBe(state.sessionId);
      expect(deserialized.vljepa.version).toBe(state.vljepa.version);
    });

    it("should create state diff", () => {
      const {
        createStateDiff,
        VLJEPAAgentStateManager,
      } = require("../state/VLJEPAAgentState.js");

      const manager = new VLJEPAAgentStateManager();
      const before = manager.getState();

      manager.setState({ query: "updated query" });
      const after = manager.getState();

      const diff = createStateDiff(before, after);

      expect(diff.query).toBeDefined();
      expect(diff.query.before).toBe("");
      expect(diff.query.after).toBe("updated query");
    });

    it("should validate agent state", () => {
      const {
        validateAgentState,
        VLJEPAAgentStateManager,
      } = require("../state/VLJEPAAgentState.js");

      const manager = new VLJEPAAgentStateManager();
      const state = manager.getState();

      const validation = validateAgentState(state);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });
});

describe("Error Handling", () => {
  it("should handle embedding dimension mismatch", () => {
    const bridge = createVLJEPABridge();
    const visual = new Float32Array(768);
    const intent = new Float32Array(512);

    expect(() => bridge.fuseEmbeddings(visual, intent)).toThrow();
  });

  it("should handle invalid checkpoint ID", () => {
    const manager = createHITLCheckpointManager();

    expect(() => manager.getCheckpoint("nonexistent")).toThrow();
  });

  it("should handle approving non-pending checkpoint", async () => {
    const manager = createHITLCheckpointManager();
    const actions = [
      { type: "modify" as const, target: "#btn", params: {}, confidence: 0.9 },
    ];

    const id = await manager.createCheckpoint(
      "visual_confirmation",
      actions,
      "Review",
      {
        required: false,
        sessionId: "session123",
      }
    );

    await manager.approveCheckpoint(id);

    await expect(manager.approveCheckpoint(id)).rejects.toThrow();
  });

  it("should handle empty history", () => {
    const embeddingManager = createEmbeddingStateManager();
    const history = embeddingManager.getAllHistory();

    expect(history).toEqual([]);
  });
});

describe("Configuration Updates", () => {
  it("should update bridge config", () => {
    const bridge = createVLJEPABridge();
    bridge.updateConfig({ minConfidence: 0.9 });

    expect(bridge.getConfig().minConfidence).toBe(0.9);
  });

  it("should update embedding manager config", () => {
    const manager = createEmbeddingStateManager();
    manager.updateFusionWeights({ visual: 0.8, intent: 0.2 });

    const config = manager.getConfig();
    expect(config.fusionWeights.visual).toBe(0.8);
  });

  it("should update checkpoint manager config", () => {
    const manager = createHITLCheckpointManager();
    manager.updateConfig({ defaultTimeout: 120000 });

    expect(manager.getConfig().defaultTimeout).toBe(120000);
  });
});

describe("Statistics and Reporting", () => {
  it("should get checkpoint stats", async () => {
    const manager = createHITLCheckpointManager();
    const actions = [
      { type: "modify" as const, target: "#btn", params: {}, confidence: 0.9 },
    ];

    await manager.createCheckpoint("visual_confirmation", actions, "Review 1", {
      required: false,
      sessionId: "session123",
    });

    const stats = manager.getStats();

    expect(stats.total).toBe(1);
    expect(stats.pending).toBe(1);
  });

  it("should get embedding stats", () => {
    const manager = createEmbeddingStateManager();
    const stats = manager.getStats();

    expect(stats.historySize).toBe(0);
    expect(stats.cacheSize).toBe(0);
  });
});
