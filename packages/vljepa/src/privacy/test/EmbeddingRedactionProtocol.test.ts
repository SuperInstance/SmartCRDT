/**
 * EmbeddingRedactionProtocol Tests
 *
 * Comprehensive test suite for embedding-level redaction.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EmbeddingRedactionProtocol,
  createConservativeRedaction,
  createBalancedRedaction,
  createPermissiveRedaction,
  calculateTradeoffMetrics,
  type RedactionResult,
  type RedactionConfig,
  type PrivacyElement,
} from "../EmbeddingRedactionProtocol";
import type { VisualPrivacyClassification } from "../VisualPrivacyClassifier";

describe("EmbeddingRedactionProtocol", () => {
  let protocol: EmbeddingRedactionProtocol;
  let testEmbedding: Float32Array;
  let testClassification: VisualPrivacyClassification;

  beforeEach(() => {
    protocol = new EmbeddingRedactionProtocol({
      strategy: "balanced",
    });
    testEmbedding = createTestEmbedding();
    testClassification = createTestClassification("SAFE", []);
  });

  describe("Construction", () => {
    it("should create with default config", () => {
      const p = new EmbeddingRedactionProtocol();
      expect(p).toBeDefined();
    });

    it("should create conservative redaction", () => {
      const p = createConservativeRedaction();
      expect(p).toBeDefined();
    });

    it("should create balanced redaction", () => {
      const p = createBalancedRedaction();
      expect(p).toBeDefined();
    });

    it("should create permissive redaction", () => {
      const p = createPermissiveRedaction();
      expect(p).toBeDefined();
    });

    it("should validate embedding dimension", () => {
      const wrongDim = new Float32Array(128);
      expect(() => protocol.redact(wrongDim, testClassification)).toThrow();
    });
  });

  describe("Redaction - SAFE Data", () => {
    it("should not redact SAFE classification", () => {
      const result = protocol.redact(testEmbedding, testClassification);

      expect(result.dimensionsRedacted).toBe(0);
      expect(result.redactionReason).toHaveLength(0);
      expect(result.privacyScore).toBe(0);
    });

    it("should return unchanged embedding for SAFE", () => {
      const result = protocol.redact(testEmbedding, testClassification);

      for (let i = 0; i < testEmbedding.length; i++) {
        expect(result.redactedEmbedding[i]).toBeCloseTo(testEmbedding[i], 6);
      }
    });
  });

  describe("Redaction - PII Data", () => {
    it("should redact PII classification", () => {
      const piiElements = [createPrivacyElement("face", 0, 100, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const result = protocol.redact(testEmbedding, piiClassification);

      expect(result.dimensionsRedacted).toBeGreaterThan(0);
      expect(result.redactionReason.length).toBeGreaterThan(0);
    });

    it("should zero out redacted dimensions", () => {
      const piiElements = [createPrivacyElement("face", 0, 100, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const result = protocol.redact(testEmbedding, piiClassification);

      // Check that redacted dimensions are zero
      for (let i = 0; i < 100; i++) {
        expect(result.redactedEmbedding[i]).toBe(0);
      }
    });

    it("should preserve non-redacted dimensions", () => {
      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const result = protocol.redact(testEmbedding, piiClassification);

      // Check that non-redacted dimensions are preserved
      for (let i = 50; i < testEmbedding.length; i++) {
        expect(result.redactedEmbedding[i]).toBeCloseTo(testEmbedding[i], 6);
      }
    });
  });

  describe("Redaction Strategies", () => {
    it("conservative should redact more dimensions", () => {
      const conservative = createConservativeRedaction();
      const balanced = createBalancedRedaction();

      const piiElements = [createPrivacyElement("face", 0, 100, 0.7)];
      const piiClassification = createTestClassification("PII", piiElements);

      const conservativeResult = conservative.redact(
        testEmbedding,
        piiClassification
      );
      const balancedResult = balanced.redact(testEmbedding, piiClassification);

      expect(conservativeResult.dimensionsRedacted).toBeGreaterThanOrEqual(
        balancedResult.dimensionsRedacted
      );
    });

    it("permissive should redact fewer dimensions", () => {
      const permissive = createPermissiveRedaction();
      const balanced = createBalancedRedaction();

      const piiElements = [createPrivacyElement("face", 0, 100, 0.7)];
      const piiClassification = createTestClassification("PII", piiElements);

      const permissiveResult = permissive.redact(
        testEmbedding,
        piiClassification
      );
      const balancedResult = balanced.redact(testEmbedding, piiClassification);

      expect(permissiveResult.dimensionsRedacted).toBeLessThanOrEqual(
        balancedResult.dimensionsRedacted
      );
    });
  });

  describe("Element Type Redaction", () => {
    it("should redact faces when enabled", () => {
      const p = new EmbeddingRedactionProtocol({
        redactFaces: true,
        redactText: false,
      });

      const faceElements = [createPrivacyElement("face", 0, 50, 0.8)];
      const classification = createTestClassification(
        "SENSITIVE",
        faceElements
      );

      const result = p.redact(testEmbedding, classification);
      expect(result.dimensionsRedacted).toBeGreaterThan(0);
    });

    it("should not redact faces when disabled", () => {
      const p = new EmbeddingRedactionProtocol({
        redactFaces: false,
        redactText: true,
      });

      const faceElements = [createPrivacyElement("face", 0, 50, 0.8)];
      const classification = createTestClassification(
        "SENSITIVE",
        faceElements
      );

      const result = p.redact(testEmbedding, classification);
      expect(result.dimensionsRedacted).toBe(0);
    });

    it("should redact text when enabled", () => {
      const p = new EmbeddingRedactionProtocol({
        redactText: true,
        redactFaces: false,
      });

      const textElements = [createPrivacyElement("text", 100, 200, 0.7)];
      const classification = createTestClassification(
        "SENSITIVE",
        textElements
      );

      const result = p.redact(testEmbedding, classification);
      expect(result.dimensionsRedacted).toBeGreaterThan(0);
    });

    it("should redact documents when enabled", () => {
      const p = new EmbeddingRedactionProtocol({
        redactDocuments: true,
      });

      const docElements = [createPrivacyElement("document", 50, 150, 0.8)];
      const classification = createTestClassification("PII", docElements);

      const result = p.redact(testEmbedding, classification);
      expect(result.dimensionsRedacted).toBeGreaterThan(0);
    });

    it("should redact screens when enabled", () => {
      const p = new EmbeddingRedactionProtocol({
        redactScreens: true,
      });

      const screenElements = [createPrivacyElement("screen", 200, 300, 0.7)];
      const classification = createTestClassification(
        "SENSITIVE",
        screenElements
      );

      const result = p.redact(testEmbedding, classification);
      expect(result.dimensionsRedacted).toBeGreaterThan(0);
    });
  });

  describe("Maximum Redaction Fraction", () => {
    it("should enforce maxRedactionFraction", () => {
      const p = new EmbeddingRedactionProtocol({
        maxRedactionFraction: 0.1, // Max 10%
      });

      // Create elements covering 50% of dimensions
      const manyElements = [
        createPrivacyElement("face", 0, 100, 0.9),
        createPrivacyElement("text", 100, 200, 0.9),
        createPrivacyElement("document", 200, 380, 0.9),
      ];
      const classification = createTestClassification("PII", manyElements);

      const result = p.redact(testEmbedding, classification);

      const maxDims = Math.floor(768 * 0.1);
      expect(result.dimensionsRedacted).toBeLessThanOrEqual(maxDims);
    });
  });

  describe("Differential Privacy", () => {
    it("should apply DP when epsilon is set", () => {
      const p = new EmbeddingRedactionProtocol({
        epsilon: 1.0,
      });

      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const result = p.redact(testEmbedding, piiClassification);

      expect(result.dpParams.enabled).toBe(true);
      expect(result.dpParams.epsilon).toBe(1.0);
      expect(result.dpParams.sigma).toBeDefined();
    });

    it("should not apply DP when epsilon is undefined", () => {
      const p = new EmbeddingRedactionProtocol({
        epsilon: undefined,
      });

      const result = p.redact(testEmbedding, testClassification);

      expect(result.dpParams.enabled).toBe(false);
    });

    it("should add noise to embedding with DP", () => {
      const p = new EmbeddingRedactionProtocol({
        epsilon: 1.0,
      });

      // Start with zero embedding
      const zeroEmbedding = new Float32Array(768);
      const piiElements = [createPrivacyElement("face", 50, 100, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const result = p.redact(zeroEmbedding, piiClassification);

      // Some dimensions should be non-zero due to DP noise
      let hasNonZero = false;
      for (let i = 0; i < result.redactedEmbedding.length; i++) {
        if (Math.abs(result.redactedEmbedding[i]) > 1e-6) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);
    });
  });

  describe("Redaction Mask", () => {
    it("should create correct mask", () => {
      const piiElements = [createPrivacyElement("face", 0, 100, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const result = protocol.redact(testEmbedding, piiClassification);

      expect(result.redactionMask).toHaveLength(768);
      expect(result.redactionMask.slice(0, 100)).every((v, i) => v === true);
    });
  });

  describe("Redaction by Elements", () => {
    it("should redact based on custom elements", () => {
      const elements = [
        createPrivacyElement("face", 0, 50, 0.8),
        createPrivacyElement("text", 100, 150, 0.7),
      ];

      const result = protocol.redactElements(testEmbedding, elements);

      expect(result.dimensionsRedacted).toBeGreaterThan(0);
      expect(result.redactionReason.length).toBeGreaterThan(0);
    });
  });

  describe("Re-hydration", () => {
    it("should rehydrate with zero strategy", () => {
      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const redacted = protocol.redact(testEmbedding, piiClassification);
      const rehydrated = protocol.rehydrate(redacted, "zero");

      expect(rehydrated.success).toBe(true);
      expect(rehydrated.metadata.rehydrationStrategy).toBe("zero");
    });

    it("should rehydrate with noise strategy", () => {
      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const redacted = protocol.redact(testEmbedding, piiClassification);
      const rehydrated = protocol.rehydrate(redacted, "noise");

      expect(rehydrated.success).toBe(true);
      expect(rehydrated.metadata.rehydrationStrategy).toBe("noise");
    });

    it("should rehydrate with semantic_placeholder strategy", () => {
      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const redacted = protocol.redact(testEmbedding, piiClassification);
      const rehydrated = protocol.rehydrate(redacted, "semantic_placeholder");

      expect(rehydrated.success).toBe(true);
      expect(rehydrated.metadata.rehydrationStrategy).toBe(
        "semantic_placeholder"
      );
    });
  });

  describe("Statistics", () => {
    it("should track embeddings redacted", () => {
      protocol.redact(testEmbedding, testClassification);
      protocol.redact(testEmbedding, testClassification);

      const stats = protocol.getStats();
      expect(stats.embeddingsRedacted).toBe(2);
    });

    it("should track total dimensions redacted", () => {
      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      protocol.redact(testEmbedding, piiClassification);

      const stats = protocol.getStats();
      expect(stats.totalDimensionsRedacted).toBeGreaterThan(0);
    });

    it("should track average redaction fraction", () => {
      protocol.redact(testEmbedding, testClassification);

      const stats = protocol.getStats();
      expect(stats.avgRedactionFraction).toBeGreaterThanOrEqual(0);
      expect(stats.avgRedactionFraction).toBeLessThanOrEqual(1);
    });

    it("should reset statistics", () => {
      protocol.redact(testEmbedding, testClassification);
      protocol.resetStats();

      const stats = protocol.getStats();
      expect(stats.embeddingsRedacted).toBe(0);
    });
  });

  describe("Tradeoff Metrics", () => {
    it("should calculate cosine similarity", () => {
      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const redacted = protocol.redact(testEmbedding, piiClassification);
      const metrics = calculateTradeoffMetrics(
        testEmbedding,
        redacted.redactedEmbedding
      );

      expect(metrics.cosineSimilarity).toBeGreaterThanOrEqual(-1);
      expect(metrics.cosineSimilarity).toBeLessThanOrEqual(1);
    });

    it("should calculate euclidean distance", () => {
      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const redacted = protocol.redact(testEmbedding, piiClassification);
      const metrics = calculateTradeoffMetrics(
        testEmbedding,
        redacted.redactedEmbedding
      );

      expect(metrics.euclideanDistance).toBeGreaterThanOrEqual(0);
    });

    it("should count dimensions changed", () => {
      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const redacted = protocol.redact(testEmbedding, piiClassification);
      const metrics = calculateTradeoffMetrics(
        testEmbedding,
        redacted.redactedEmbedding
      );

      expect(metrics.dimensionsChanged).toBe(50);
    });

    it("should calculate privacy gain", () => {
      const piiElements = [createPrivacyElement("face", 0, 50, 0.9)];
      const piiClassification = createTestClassification("PII", piiElements);

      const redacted = protocol.redact(testEmbedding, piiClassification);
      const metrics = calculateTradeoffMetrics(
        testEmbedding,
        redacted.redactedEmbedding
      );

      expect(metrics.privacyGain).toBeGreaterThan(0);
      expect(metrics.privacyGain).toBeLessThanOrEqual(1);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty detected elements", () => {
      const classification = createTestClassification("SAFE", []);
      const result = protocol.redact(testEmbedding, classification);

      expect(result.dimensionsRedacted).toBe(0);
    });

    it("should handle overlapping semantic regions", () => {
      const elements = [
        createPrivacyElement("face", 0, 100, 0.9),
        createPrivacyElement("text", 50, 150, 0.8),
      ];
      const classification = createTestClassification("SENSITIVE", elements);

      const result = protocol.redact(testEmbedding, classification);

      // Should handle overlapping regions correctly
      expect(result.dimensionsRedacted).toBeGreaterThan(0);
    });

    it("should handle out-of-range dimensions", () => {
      const elements = [
        createPrivacyElement("face", 700, 800, 0.9), // Beyond 768
      ];
      const classification = createTestClassification("PII", elements);

      const result = protocol.redact(testEmbedding, classification);

      // Should clamp to valid range
      expect(result).toBeDefined();
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

function createPrivacyElement(
  type: PrivacyElement["type"],
  startDim: number,
  endDim: number,
  confidence: number
): PrivacyElement {
  return {
    type,
    boundingBox: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
    confidence,
    semanticRegion: {
      startDim,
      endDim,
      activationStrength: confidence,
    },
  };
}
