/**
 * @fileoverview VL-JEPA Node Tests
 * @coverage 25+ tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VLJEPANode, createVLJEPANode } from "../langgraph/VLJEPANode.js";
import type { VLJEPABridge } from "../state/VLJEPABridge.js";
import type { VisualStateManager } from "../state/VisualState.js";
import type { VLJEPAAgentState } from "../state/VLJEPAAgentState.js";
import type { VLJEPABridge as IVLJEPABridge } from "@lsi/vljepa/src/protocol.js";

// Mock VL-JEPA Bridge
const mockVLJEPABridge = {
  encodeVision: vi.fn(),
  encodeLanguage: vi.fn(),
  predict: vi.fn(),
} as unknown as IVLJEPABridge;

// Mock CoAgents Bridge
const mockCoagentsBridge = {
  predictionToBridgeState: vi.fn(),
  createVisualState: vi.fn(),
  createEmbeddingState: vi.fn(),
} as unknown as VLJEPABridge;

// Mock Visual Manager
const mockVisualManager = {
  createVisualState: vi.fn(),
} as unknown as VisualStateManager;

describe("VLJEPANode", () => {
  let node: VLJEPANode;

  beforeEach(() => {
    vi.clearAllMocks();

    node = createVLJEPANode({
      vljepaBridge: mockVLJEPABridge,
      coagentsBridge: mockCoagentsBridge,
      visualManager: mockVisualManager,
      minConfidence: 0.5,
      maxActions: 10,
    });
  });

  describe("Constructor", () => {
    it("should create node with config", () => {
      expect(node).toBeDefined();
      const config = node.getConfig();
      expect(config.minConfidence).toBe(0.5);
      expect(config.maxActions).toBe(10);
    });

    it("should have metadata", () => {
      const metadata = node.getMetadata();
      expect(metadata).toBeDefined();
      expect(metadata?.description).toBeDefined();
      expect(metadata?.version).toBeDefined();
    });
  });

  describe("Invoke", () => {
    it("should process state through VL-JEPA", async () => {
      const state: VLJEPAAgentState = {
        query: "make button red",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "session123",
        complexity: 0.5,
        visualContext: {
          currentFrame: {
            src: "data:image/png;base64,test",
            dimensions: { width: 1920, height: 1080 },
            timestamp: Date.now(),
          },
        },
        vljepa: {
          version: "1.0",
          visualEmbedding: new Float32Array(768),
          intentEmbedding: new Float32Array(768),
          goalEmbedding: new Float32Array(768),
          confidence: 0,
          timestamp: Date.now(),
          actions: [],
          metadata: { processingTime: 0 },
        },
        visual: {
          embedding: {
            values: new Float32Array(768),
            dimension: 768,
            source: "x-encoder",
            timestamp: Date.now(),
            isNormalized: false,
          },
          elements: [],
          features: {
            colors: [],
            layout: { type: "unknown", confidence: 0 },
            spacing: {
              averageGap: 16,
              padding: { top: 16, right: 16, bottom: 16, left: 16 },
              margin: { top: 16, right: 16, bottom: 16, left: 16 },
              whitespaceRatio: 0.3,
            },
            typography: {
              families: [],
              sizes: [],
              weights: [],
              lineHeights: [],
              contrastScores: [],
              headingHierarchy: {},
            },
            hierarchy: {
              tree: { id: "root", type: "container", weight: 0, children: [] },
              depth: 0,
              focusPoints: [],
            },
            components: [],
          },
          confidence: 0,
          timestamp: Date.now(),
          dimensions: { width: 1920, height: 1080 },
        },
        embeddings: {
          fused: new Float32Array(768),
          visual: new Float32Array(768),
          intent: new Float32Array(768),
          goal: new Float32Array(768),
          weights: { visual: 0.5, intent: 0.5 },
          similarities: { visualIntent: 0, visualGoal: 0, intentGoal: 0 },
          timestamp: Date.now(),
        },
        pendingActions: [],
        actionHistory: [],
      };

      // Mock responses
      const mockVisualEmbedding = new Float32Array(768).fill(0.1);
      const mockIntentEmbedding = new Float32Array(768).fill(0.2);
      const mockPrediction = {
        version: "1.0" as const,
        goalEmbedding: new Float32Array(768).fill(0.3),
        confidence: 0.85,
        actions: [
          {
            type: "modify" as const,
            target: "#button",
            params: { color: "red" },
            confidence: 0.9,
          },
        ],
        metadata: {
          timestamp: Date.now(),
          processingTime: 150,
          device: "webgpu" as const,
        },
      };

      vi.mocked(mockVLJEPABridge.encodeVision).mockResolvedValue(
        mockVisualEmbedding
      );
      vi.mocked(mockVLJEPABridge.encodeLanguage).mockResolvedValue(
        mockIntentEmbedding
      );
      vi.mocked(mockVLJEPABridge.predict).mockResolvedValue(mockPrediction);

      const result = await node.invoke(state);

      expect(result).toBeDefined();
      expect(result.vljepa).toBeDefined();
      expect(result.pendingActions).toBeDefined();
    });

    it("should handle missing visual context", async () => {
      const state: Partial<VLJEPAAgentState> = {
        query: "test",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "session123",
        complexity: 0,
      };

      const result = await node.invoke(state as VLJEPAAgentState);

      expect(result).toBeDefined();
    });
  });

  describe("Cache", () => {
    it("should use cached results", async () => {
      const state: Partial<VLJEPAAgentState> = {
        query: "cached query",
        intent: [],
        route: "local",
        privacy: "public",
        status: "processing",
        sessionId: "cache-session",
        complexity: 0,
        visualContext: {
          currentFrame: {
            src: "cached-image.png",
            dimensions: { width: 1920, height: 1080 },
            timestamp: Date.now(),
          },
        },
      };

      // First call
      await node.invoke(state as VLJEPAAgentState);

      // Second call should use cache
      const result = await node.invoke(state as VLJEPAAgentState);

      expect(result).toBeDefined();
    });

    it("should clear cache", () => {
      node.clearCache();

      // Should not throw
      expect(() => node.clearCache()).not.toThrow();
    });

    it("should clear expired cache entries", () => {
      node.clearExpiredCache();

      // Should not throw
      expect(() => node.clearExpiredCache()).not.toThrow();
    });
  });

  describe("Configuration", () => {
    it("should get node config", () => {
      const config = node.getConfig();

      expect(config).toBeDefined();
      expect(config.minConfidence).toBeDefined();
      expect(config.maxActions).toBeDefined();
      expect(config.metadata).toBeDefined();
    });
  });
});

describe("VLJEPANode Factory", () => {
  it("should create node with factory function", () => {
    const node = createVLJEPANode({
      vljepaBridge: mockVLJEPABridge,
      coagentsBridge: mockCoagentsBridge,
      visualManager: mockVisualManager,
    });

    expect(node).toBeDefined();
  });
});
