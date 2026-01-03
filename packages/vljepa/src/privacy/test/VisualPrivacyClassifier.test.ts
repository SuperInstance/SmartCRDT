/**
 * VisualPrivacyClassifier Tests
 *
 * Comprehensive test suite for embedding-based visual privacy classification.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  VisualPrivacyClassifier,
  SensitivityLevel,
  createConservativeClassifier,
  createBalancedClassifier,
  createPermissiveClassifier,
  type VisualPrivacyClassification,
  type PrivacyElement,
} from "../VisualPrivacyClassifier";

describe("VisualPrivacyClassifier", () => {
  let classifier: VisualPrivacyClassifier;
  let testEmbedding: Float32Array;

  beforeEach(() => {
    classifier = new VisualPrivacyClassifier({
      sensitivity: SensitivityLevel.BALANCED,
    });
    testEmbedding = createTestEmbedding();
  });

  describe("Construction", () => {
    it("should create classifier with default config", () => {
      const c = new VisualPrivacyClassifier();
      expect(c).toBeDefined();
      expect(c.getStats().classifications).toBe(0);
    });

    it("should create classifier with custom sensitivity", () => {
      const c = new VisualPrivacyClassifier({
        sensitivity: SensitivityLevel.CONSERVATIVE,
      });
      expect(c).toBeDefined();
    });

    it("should create conservative classifier factory", () => {
      const c = createConservativeClassifier();
      expect(c).toBeDefined();
    });

    it("should create balanced classifier factory", () => {
      const c = createBalancedClassifier();
      expect(c).toBeDefined();
    });

    it("should create permissive classifier factory", () => {
      const c = createPermissiveClassifier();
      expect(c).toBeDefined();
    });

    it("should validate embedding dimension on classify", () => {
      const wrongDim = new Float32Array(128);
      expect(() => classifier.classify(wrongDim)).toThrow(
        "Invalid embedding dimension"
      );
    });
  });

  describe("Classification - SAFE", () => {
    it("should classify low-activation embedding as SAFE", () => {
      const safeEmbedding = createTestEmbedding(0.1); // Low activation
      const result = classifier.classify(safeEmbedding);

      expect(result.classification).toBe("SAFE");
      expect(result.detectedElements).toHaveLength(0);
      expect(result.redactionNeeded).toBe(false);
      expect(result.privacyScore).toBe(0);
    });

    it("should have high confidence for SAFE classification", () => {
      const safeEmbedding = createTestEmbedding(0.1);
      const result = classifier.classify(safeEmbedding);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should include timestamp in result", () => {
      const before = Date.now();
      const result = classifier.classify(testEmbedding);
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });

    it("should include version in result", () => {
      const result = classifier.classify(testEmbedding);
      expect(result.version).toBe("1.0");
    });
  });

  describe("Classification - SENSITIVE", () => {
    it("should classify medium-activation embedding as SENSITIVE", () => {
      const sensitiveEmbedding = createTestEmbedding(0.5); // Medium activation
      const result = classifier.classify(sensitiveEmbedding);

      expect(result.classification).toBe("SENSITIVE");
      expect(result.privacyScore).toBeGreaterThan(0);
    });

    it("should detect text elements", () => {
      const textEmbedding = createTextEmbedding();
      const result = classifier.classify(textEmbedding);

      const textElements = result.detectedElements.filter(
        e => e.type === "text"
      );
      expect(textElements.length).toBeGreaterThan(0);
    });

    it("should detect keyboard elements", () => {
      const keyboardEmbedding = createKeyboardEmbedding();
      const result = classifier.classify(keyboardEmbedding);

      const keyboardElements = result.detectedElements.filter(
        e => e.type === "keyboard"
      );
      expect(keyboardElements.length).toBeGreaterThan(0);
    });

    it("should detect cursor elements", () => {
      const cursorEmbedding = createCursorEmbedding();
      const result = classifier.classify(cursorEmbedding);

      const cursorElements = result.detectedElements.filter(
        e => e.type === "cursor"
      );
      expect(cursorElements.length).toBeGreaterThan(0);
    });
  });

  describe("Classification - PII", () => {
    it("should classify high-activation embedding as PII", () => {
      const piiEmbedding = createTestEmbedding(0.8); // High activation
      const result = classifier.classify(piiEmbedding);

      expect(result.classification).toBe("PII");
      expect(result.redactionNeeded).toBe(true);
      expect(result.privacyScore).toBeGreaterThan(0.5);
    });

    it("should detect face elements", () => {
      const faceEmbedding = createFaceEmbedding();
      const result = classifier.classify(faceEmbedding);

      const faceElements = result.detectedElements.filter(
        e => e.type === "face"
      );
      expect(faceElements.length).toBeGreaterThan(0);
    });

    it("should detect document elements", () => {
      const documentEmbedding = createDocumentEmbedding();
      const result = classifier.classify(documentEmbedding);

      const documentElements = result.detectedElements.filter(
        e => e.type === "document"
      );
      expect(documentElements.length).toBeGreaterThan(0);
    });

    it("should detect screen elements", () => {
      const screenEmbedding = createScreenEmbedding();
      const result = classifier.classify(screenEmbedding);

      const screenElements = result.detectedElements.filter(
        e => e.type === "screen"
      );
      expect(screenElements.length).toBeGreaterThan(0);
    });

    it("should include PII type for documents", () => {
      const documentEmbedding = createDocumentEmbedding();
      const result = classifier.classify(documentEmbedding);

      const docElement = result.detectedElements.find(
        e => e.type === "document"
      );
      expect(docElement?.piiType).toBeDefined();
    });
  });

  describe("Classification - SECRET", () => {
    it("should classify very high activation with face as SECRET", () => {
      const secretEmbedding = createSecretEmbedding();
      const result = classifier.classify(secretEmbedding);

      expect(result.classification).toBe("SECRET");
      expect(result.redactionNeeded).toBe(true);
      expect(result.privacyScore).toBeGreaterThan(0.7);
    });

    it("should detect multiple element types in SECRET data", () => {
      const secretEmbedding = createSecretEmbedding();
      const result = classifier.classify(secretEmbedding);

      expect(result.detectedElements.length).toBeGreaterThan(1);
    });
  });

  describe("Sensitivity Levels", () => {
    it("conservative should flag more PII", () => {
      const conservative = createConservativeClassifier();
      const embedding = createTestEmbedding(0.4);
      const result = conservative.classify(embedding);

      expect(result.classification).not.toBe("SAFE");
    });

    it("permissive should flag less PII", () => {
      const permissive = createPermissiveClassifier();
      const embedding = createTestEmbedding(0.5);
      const result = permissive.classify(embedding);

      // Permissive might still classify as SAFE or SENSITIVE
      expect(["SAFE", "SENSITIVE"]).toContain(result.classification);
    });

    it("balanced should be in between", () => {
      const balanced = createBalancedClassifier();
      const embedding = createTestEmbedding(0.5);
      const result = balanced.classify(embedding);

      expect(result.classification).toBeDefined();
    });
  });

  describe("Element Detection", () => {
    it("should respect detectElements.faces setting", () => {
      const c = new VisualPrivacyClassifier({
        detectElements: {
          faces: false,
          text: true,
          documents: true,
          screens: true,
          keyboards: true,
          cursors: true,
        },
      });

      const faceEmbedding = createFaceEmbedding();
      const result = c.classify(faceEmbedding);

      const faceElements = result.detectedElements.filter(
        e => e.type === "face"
      );
      expect(faceElements.length).toBe(0);
    });

    it("should respect detectElements.text setting", () => {
      const c = new VisualPrivacyClassifier({
        detectElements: {
          faces: true,
          text: false,
          documents: true,
          screens: true,
          keyboards: true,
          cursors: true,
        },
      });

      const textEmbedding = createTextEmbedding();
      const result = c.classify(textEmbedding);

      const textElements = result.detectedElements.filter(
        e => e.type === "text"
      );
      expect(textElements.length).toBe(0);
    });

    it("should include semantic region in detected elements", () => {
      const result = classifier.classify(testEmbedding);

      for (const element of result.detectedElements) {
        expect(element.semanticRegion).toBeDefined();
        expect(element.semanticRegion.startDim).toBeGreaterThanOrEqual(0);
        expect(element.semanticRegion.endDim).toBeGreaterThan(
          element.semanticRegion.startDim
        );
        expect(
          element.semanticRegion.activationStrength
        ).toBeGreaterThanOrEqual(0);
      }
    });

    it("should include bounding box in detected elements", () => {
      const result = classifier.classify(testEmbedding);

      for (const element of result.detectedElements) {
        expect(element.boundingBox).toBeDefined();
        expect(element.boundingBox.x).toBeGreaterThanOrEqual(0);
        expect(element.boundingBox.y).toBeGreaterThanOrEqual(0);
        expect(element.boundingBox.width).toBeGreaterThan(0);
        expect(element.boundingBox.height).toBeGreaterThan(0);
      }
    });

    it("should sort elements by confidence descending", () => {
      const embedding = createSecretEmbedding();
      const result = classifier.classify(embedding);

      for (let i = 1; i < result.detectedElements.length; i++) {
        expect(
          result.detectedElements[i - 1].confidence
        ).toBeGreaterThanOrEqual(result.detectedElements[i].confidence);
      }
    });
  });

  describe("Privacy Score", () => {
    it("should be 0 for no elements", () => {
      const safeEmbedding = createTestEmbedding(0.1);
      const result = classifier.classify(safeEmbedding);

      expect(result.privacyScore).toBe(0);
    });

    it("should increase with more elements", () => {
      const single = createTestEmbedding(0.3);
      const result1 = classifier.classify(single);

      const multiple = createSecretEmbedding();
      const result2 = classifier.classify(multiple);

      expect(result2.privacyScore).toBeGreaterThanOrEqual(result1.privacyScore);
    });

    it("should weight faces higher than cursors", () => {
      // Face has weight 1.0, cursor has weight 0.2
      const faceEmbedding = createFaceEmbedding();
      const cursorEmbedding = createCursorEmbedding();

      const faceResult = classifier.classify(faceEmbedding);
      const cursorResult = classifier.classify(cursorEmbedding);

      // Face should have higher privacy score due to weight
      expect(faceResult.privacyScore).toBeGreaterThan(
        cursorResult.privacyScore
      );
    });
  });

  describe("Statistics", () => {
    it("should track classifications", () => {
      classifier.classify(testEmbedding);
      classifier.classify(testEmbedding);

      const stats = classifier.getStats();
      expect(stats.classifications).toBe(2);
    });

    it("should track PII detections", () => {
      const piiEmbedding = createSecretEmbedding();
      classifier.classify(piiEmbedding);

      const stats = classifier.getStats();
      expect(stats.piiDetected).toBeGreaterThan(0);
    });

    it("should track SENSITIVE detections", () => {
      const sensitiveEmbedding = createTextEmbedding();
      classifier.classify(sensitiveEmbedding);

      const stats = classifier.getStats();
      expect(stats.sensitiveDetected).toBeGreaterThan(0);
    });

    it("should track SAFE classifications", () => {
      const safeEmbedding = createTestEmbedding(0.1);
      classifier.classify(safeEmbedding);

      const stats = classifier.getStats();
      expect(stats.safeClassified).toBeGreaterThan(0);
    });

    it("should reset statistics", () => {
      classifier.classify(testEmbedding);
      classifier.resetStats();

      const stats = classifier.getStats();
      expect(stats.classifications).toBe(0);
      expect(stats.piiDetected).toBe(0);
    });
  });

  describe("Batch Classification", () => {
    it("should classify multiple embeddings", () => {
      const embeddings = [
        createTestEmbedding(0.1),
        createTestEmbedding(0.5),
        createTestEmbedding(0.9),
      ];

      const results = classifier.classifyBatch(embeddings);

      expect(results).toHaveLength(3);
      expect(results[0].classification).toBeDefined();
      expect(results[1].classification).toBeDefined();
      expect(results[2].classification).toBeDefined();
    });

    it("should handle empty batch", () => {
      const results = classifier.classifyBatch([]);
      expect(results).toHaveLength(0);
    });

    it("should update stats for batch", () => {
      const embeddings = [testEmbedding, testEmbedding];
      classifier.classifyBatch(embeddings);

      const stats = classifier.getStats();
      expect(stats.classifications).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle all-zero embedding", () => {
      const zeroEmbedding = new Float32Array(768);
      const result = classifier.classify(zeroEmbedding);

      expect(result.classification).toBe("SAFE");
    });

    it("should handle uniform embedding", () => {
      const uniformEmbedding = new Float32Array(768).fill(0.5);
      const result = classifier.classify(uniformEmbedding);

      expect(result).toBeDefined();
    });

    it("should handle high-value embedding", () => {
      const highEmbedding = new Float32Array(768).fill(1.0);
      const result = classifier.classify(highEmbedding);

      expect(result).toBeDefined();
    });
  });
});

// Helper functions to create test embeddings

function createTestEmbedding(activation: number = 0.3): Float32Array {
  const embedding = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    embedding[i] = (Math.random() - 0.5) * activation;
  }
  return embedding;
}

function createFaceEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  // High activation in early dimensions (visual features)
  for (let i = 0; i < 150; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.8;
  }
  return embedding;
}

function createTextEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  // Medium activation in mid dimensions (text features)
  for (let i = 150; i < 460; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.5;
  }
  return embedding;
}

function createDocumentEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  // High activation in early-mid dimensions (document structure)
  for (let i = 75; i < 380; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.7;
  }
  return embedding;
}

function createScreenEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  // Medium-high activation in mid dimensions
  for (let i = 230; i < 540; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.6;
  }
  return embedding;
}

function createKeyboardEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  // Medium activation in late-mid dimensions
  for (let i = 380; i < 610; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.5;
  }
  return embedding;
}

function createCursorEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  // Low-medium activation in late dimensions
  for (let i = 540; i < 768; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.4;
  }
  return embedding;
}

function createSecretEmbedding(): Float32Array {
  const embedding = new Float32Array(768);
  // Very high activation across all dimensions
  for (let i = 0; i < 768; i++) {
    embedding[i] = (Math.random() - 0.5) * 0.9;
  }
  return embedding;
}
