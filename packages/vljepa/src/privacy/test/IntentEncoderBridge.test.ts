/**
 * IntentEncoderBridge Tests
 *
 * Comprehensive test suite for unified privacy across text and visual modalities.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  IntentEncoderBridge,
  createStandardBridge,
  createStrictBridge,
  createPermissiveBridge,
  type UnifiedPrivacyState,
  type CoordinatedRedactionResult,
} from "../IntentEncoderBridge";
import { IntentEncoder, type IntentVector } from "@lsi/privacy/intention";
import type {
  VisualPrivacyClassification,
  PrivacyElement,
} from "../VisualPrivacyClassifier";
import { ProcessingLocation } from "../VisualPrivacyAnalyzer";

// Mock IntentEncoder
vi.mock("@lsi/privacy/intention", () => ({
  IntentEncoder: class MockIntentEncoder {
    async encode(query: string, epsilon?: number): Promise<IntentVector> {
      return {
        vector: new Float32Array(768).fill(0.5),
        epsilon: epsilon ?? 1.0,
        model: "mock-model",
        latency: 10,
        satisfiesDP: true,
      };
    }
  },
}));

describe("IntentEncoderBridge", () => {
  let bridge: IntentEncoderBridge;
  let mockIntentEncoder: IntentEncoder;
  let testEmbedding: Float32Array;
  let testClassification: VisualPrivacyClassification;

  beforeEach(() => {
    mockIntentEncoder = new IntentEncoder();
    bridge = new IntentEncoderBridge({
      intentEncoder: mockIntentEncoder,
      privacyBudget: {
        totalEpsilon: 10.0,
        windowDuration: 3600000,
      },
      defaultMode: "standard",
    });

    testEmbedding = createTestEmbedding();
    testClassification = createTestClassification("SAFE", []);
  });

  describe("Construction", () => {
    it("should create with required config", () => {
      const b = new IntentEncoderBridge({
        intentEncoder: mockIntentEncoder,
        privacyBudget: {
          totalEpsilon: 5.0,
          windowDuration: 1800000,
        },
      });

      expect(b).toBeDefined();
    });

    it("should create standard bridge", () => {
      const b = createStandardBridge(mockIntentEncoder);
      expect(b).toBeDefined();
    });

    it("should create strict bridge", () => {
      const b = createStrictBridge(mockIntentEncoder);
      expect(b).toBeDefined();
    });

    it("should create permissive bridge", () => {
      const b = createPermissiveBridge(mockIntentEncoder);
      expect(b).toBeDefined();
    });

    it("should initialize privacy state correctly", () => {
      const state = bridge.getPrivacyState();

      expect(state.mode).toBe("standard");
      expect(state.dpBudget.totalEpsilon).toBe(10.0);
      expect(state.dpBudget.remainingEpsilon).toBe(10.0);
      expect(state.dpBudget.usedEpsilon).toBe(0);
    });
  });

  describe("Text Encoding", () => {
    it("should encode text query", async () => {
      const intent = await bridge.encodeText("What is the weather?");

      expect(intent.vector).toHaveLength(768);
      expect(intent.epsilon).toBeDefined();
    });

    it("should consume epsilon for text encoding", async () => {
      await bridge.encodeText("Test query", 1.0);

      const budget = bridge.getBudgetStatus();
      expect(budget.used).toBe(1.0);
      expect(budget.remaining).toBe(9.0);
    });

    it("should use default epsilon when not specified", async () => {
      const intent = await bridge.encodeText("Test query");

      expect(intent.epsilon).toBeGreaterThan(0);
    });

    it("should throw when insufficient budget", async () => {
      // Use all budget
      await bridge.encodeText("Test", 10.0);

      await expect(bridge.encodeText("Test", 1.0)).rejects.toThrow(
        "Insufficient privacy budget"
      );
    });

    it("should update text privacy state", async () => {
      await bridge.encodeText("Test", 1.5);

      const state = bridge.getPrivacyState();
      expect(state.textPrivacy.epsilon).toBe(1.5);
    });

    it("should update lastUpdated timestamp", async () => {
      const before = Date.now();
      await bridge.encodeText("Test", 1.0);
      const after = Date.now();

      const state = bridge.getPrivacyState();
      expect(state.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(state.lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  describe("Visual Encoding", () => {
    it("should encode visual data", async () => {
      const result = await bridge.encodeVisual(
        testEmbedding,
        testClassification,
        1.0
      );

      expect(result.embedding).toBe(testEmbedding);
      expect(result.classification).toBe(testClassification);
      expect(result.epsilonUsed).toBe(1.0);
    });

    it("should consume epsilon for visual encoding", async () => {
      await bridge.encodeVisual(testEmbedding, testClassification, 1.0);

      const budget = bridge.getBudgetStatus();
      expect(budget.used).toBe(1.0);
      expect(budget.remaining).toBe(9.0);
    });

    it("should use default epsilon when not specified", async () => {
      const result = await bridge.encodeVisual(
        testEmbedding,
        testClassification
      );

      expect(result.epsilonUsed).toBeGreaterThan(0);
    });

    it("should throw when insufficient budget", async () => {
      await bridge.encodeVisual(testEmbedding, testClassification, 10.0);

      await expect(
        bridge.encodeVisual(testEmbedding, testClassification, 1.0)
      ).rejects.toThrow("Insufficient privacy budget");
    });

    it("should update visual privacy state", async () => {
      await bridge.encodeVisual(testEmbedding, testClassification, 1.5);

      const state = bridge.getPrivacyState();
      expect(state.visualPrivacy.epsilon).toBe(1.5);
    });
  });

  describe("Coordinated Redaction", () => {
    it("should perform coordinated redaction", async () => {
      const result = await bridge.coordinatedRedaction(
        "What's the weather?",
        testEmbedding,
        testClassification
      );

      expect(result.success).toBe(true);
      expect(result.totalEpsilonUsed).toBeGreaterThan(0);
    });

    it("should split epsilon between text and visual", async () => {
      const result = await bridge.coordinatedRedaction(
        "Test query",
        testEmbedding,
        testClassification
      );

      expect(result.text.epsilonUsed).toBeGreaterThan(0);
      expect(result.visual.epsilonUsed).toBeGreaterThan(0);
      expect(result.totalEpsilonUsed).toBe(
        result.text.epsilonUsed + result.visual.epsilonUsed
      );
    });

    it("should consume total epsilon for coordinated redaction", async () => {
      await bridge.coordinatedRedaction(
        "Test",
        testEmbedding,
        testClassification
      );

      const budget = bridge.getBudgetStatus();
      expect(budget.used).toBeGreaterThan(0);
    });

    it("should throw when insufficient budget for coordinated redaction", async () => {
      // Use almost all budget
      await bridge.encodeText("Test", 9.0);

      await expect(
        bridge.coordinatedRedaction("Test", testEmbedding, testClassification)
      ).rejects.toThrow("Insufficient privacy budget");
    });

    it("should include text in result", async () => {
      const result = await bridge.coordinatedRedaction(
        "Test query",
        testEmbedding,
        testClassification
      );

      expect(result.text.original).toBe("Test query");
      expect(result.text.redacted).toBeDefined();
    });

    it("should include visual in result", async () => {
      const result = await bridge.coordinatedRedaction(
        "Test query",
        testEmbedding,
        testClassification
      );

      expect(result.visual.originalEmbedding).toBe(testEmbedding);
      expect(result.visual.classification).toBe(testClassification);
    });
  });

  describe("Privacy State", () => {
    it("should return current privacy state", () => {
      const state = bridge.getPrivacyState();

      expect(state.mode).toBeDefined();
      expect(state.dpBudget).toBeDefined();
      expect(state.textPrivacy).toBeDefined();
      expect(state.visualPrivacy).toBeDefined();
      expect(state.lastUpdated).toBeDefined();
    });

    it("should return a copy of privacy state", () => {
      const state1 = bridge.getPrivacyState();
      const state2 = bridge.getPrivacyState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
    });
  });

  describe("Privacy Mode", () => {
    it("should set privacy mode to strict", () => {
      bridge.setPrivacyMode("strict");

      const state = bridge.getPrivacyState();
      expect(state.mode).toBe("strict");
      expect(state.textPrivacy.epsilon).toBe(0.5);
      expect(state.visualPrivacy.epsilon).toBe(0.5);
      expect(state.visualPrivacy.processingLocation).toBe(
        ProcessingLocation.EDGE_ONLY
      );
    });

    it("should set privacy mode to standard", () => {
      bridge.setPrivacyMode("standard");

      const state = bridge.getPrivacyState();
      expect(state.mode).toBe("standard");
      expect(state.textPrivacy.epsilon).toBe(1.0);
      expect(state.visualPrivacy.epsilon).toBe(1.0);
    });

    it("should set privacy mode to permissive", () => {
      bridge.setPrivacyMode("permissive");

      const state = bridge.getPrivacyState();
      expect(state.mode).toBe("permissive");
      expect(state.textPrivacy.epsilon).toBe(2.0);
      expect(state.visualPrivacy.epsilon).toBe(2.0);
      expect(state.visualPrivacy.processingLocation).toBe(
        ProcessingLocation.HYBRID
      );
    });

    it("should update lastUpdated on mode change", () => {
      const before = bridge.getPrivacyState().lastUpdated;

      setTimeout(() => {
        bridge.setPrivacyMode("strict");

        const after = bridge.getPrivacyState().lastUpdated;
        expect(after).toBeGreaterThan(before);
      }, 10);
    });
  });

  describe("Budget Status", () => {
    it("should return budget status", () => {
      const status = bridge.getBudgetStatus();

      expect(status.total).toBe(10.0);
      expect(status.used).toBe(0);
      expect(status.remaining).toBe(10.0);
      expect(status.percentageUsed).toBe(0);
      expect(status.warning).toBe(false);
      expect(status.exhausted).toBe(false);
    });

    it("should calculate percentage used correctly", async () => {
      await bridge.encodeText("Test", 5.0);

      const status = bridge.getBudgetStatus();
      expect(status.percentageUsed).toBe(50);
    });

    it("should warn when approaching limit", async () => {
      await bridge.encodeText("Test", 8.5); // 85% used

      const status = bridge.getBudgetStatus();
      expect(status.warning).toBe(true);
    });

    it("should show exhausted when budget depleted", async () => {
      await bridge.encodeText("Test", 10.0);

      const status = bridge.getBudgetStatus();
      expect(status.exhausted).toBe(true);
    });
  });

  describe("Budget Reset", () => {
    it("should reset privacy budget", async () => {
      await bridge.encodeText("Test", 5.0);

      bridge.resetBudget();

      const status = bridge.getBudgetStatus();
      expect(status.used).toBe(0);
      expect(status.remaining).toBe(10.0);
    });

    it("should clear usage log on reset", async () => {
      await bridge.encodeText("Test", 1.0);

      bridge.resetBudget();

      const log = bridge.getUsageLog();
      expect(log).toHaveLength(0);
    });

    it("should update reset time", async () => {
      const beforeReset = Date.now();

      bridge.resetBudget();

      const state = bridge.getPrivacyState();
      expect(state.dpBudget.resetTime).toBeGreaterThan(beforeReset);
    });
  });

  describe("Usage Log", () => {
    it("should log text encoding usage", async () => {
      await bridge.encodeText("Test", 1.0);

      const log = bridge.getUsageLog();
      expect(log).toHaveLength(1);
      expect(log[0].modality).toBe("text");
      expect(log[0].epsilon).toBe(1.0);
    });

    it("should log visual encoding usage", async () => {
      await bridge.encodeVisual(testEmbedding, testClassification, 1.0);

      const log = bridge.getUsageLog();
      expect(log).toHaveLength(1);
      expect(log[0].modality).toBe("visual");
    });

    it("should respect limit parameter", async () => {
      await bridge.encodeText("Test1", 1.0);
      await bridge.encodeText("Test2", 1.0);
      await bridge.encodeText("Test3", 1.0);

      const log = bridge.getUsageLog(2);
      expect(log).toHaveLength(2);
    });

    it("should return all entries when no limit", async () => {
      await bridge.encodeText("Test", 1.0);
      await bridge.encodeVisual(testEmbedding, testClassification, 1.0);

      const log = bridge.getUsageLog();
      expect(log).toHaveLength(2);
    });

    it("should include timestamp in usage log", async () => {
      const before = Date.now();
      await bridge.encodeText("Test", 1.0);
      const after = Date.now();

      const log = bridge.getUsageLog();
      expect(log[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(log[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("Block on Exhaustion", () => {
    it("should block operations when blockOnExhaustion is true", async () => {
      const b = new IntentEncoderBridge({
        intentEncoder: mockIntentEncoder,
        privacyBudget: {
          totalEpsilon: 1.0,
          windowDuration: 3600000,
          blockOnExhaustion: true,
        },
      });

      await b.encodeText("Test", 1.0);

      await expect(b.encodeText("Test", 0.5)).rejects.toThrow();
    });

    it("should allow operations when blockOnExhaustion is false", async () => {
      const b = new IntentEncoderBridge({
        intentEncoder: mockIntentEncoder,
        privacyBudget: {
          totalEpsilon: 1.0,
          windowDuration: 3600000,
          blockOnExhaustion: false,
        },
      });

      await b.encodeText("Test", 1.0);

      // Should not throw even though budget is exhausted
      const intent = await b.encodeText("Test", 0.5);
      expect(intent).toBeDefined();
    });
  });

  describe("Warning Threshold", () => {
    it("should warn at custom threshold", async () => {
      const b = new IntentEncoderBridge({
        intentEncoder: mockIntentEncoder,
        privacyBudget: {
          totalEpsilon: 10.0,
          windowDuration: 3600000,
          warningThreshold: 0.5,
        },
      });

      await b.encodeText("Test", 5.1); // Just over threshold

      const status = b.getBudgetStatus();
      expect(status.warning).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero epsilon request", async () => {
      const intent = await bridge.encodeText("Test", 0);

      expect(intent).toBeDefined();
    });

    it("should handle very small epsilon requests", async () => {
      const intent = await bridge.encodeText("Test", 0.01);

      expect(intent).toBeDefined();
    });

    it("should handle exact budget match", async () => {
      await bridge.encodeText("Test", 10.0);

      const status = bridge.getBudgetStatus();
      expect(status.remaining).toBe(0);
    });
  });
});

// Helper functions

function createTestEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.5;
  }
  return embedding;
}

function createTestClassification(
  classification: VisualPrivacyClassification["classification"],
  detectedElements: PrivacyElement[]
): VisualPrivacyClassification {
  return {
    version: "1.0",
    embedding: createTestEmbedding(),
    classification,
    confidence: 0.8,
    detectedElements,
    redactionNeeded: classification !== "SAFE",
    privacyScore: detectedElements.length > 0 ? 0.7 : 0,
    timestamp: Date.now(),
  };
}
