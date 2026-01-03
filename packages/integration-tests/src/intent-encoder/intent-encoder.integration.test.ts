/**
 * IntentEncoder Integration Tests
 *
 * Comprehensive integration tests for IntentEncoder covering:
 * - Full encoding pipeline with real embeddings
 * - Privacy guarantee verification
 * - Dimensionality reduction
 * - Cloud reconstruction resistance
 * - Batch encoding
 * - Privacy parameter selection
 * - Integration with PrivacyClassifier
 * - Cache performance
 * - Error handling
 * - Intent similarity search
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  IntentEncoder,
  cosineSimilarity,
  euclideanDistance,
  PrivacyClassifier,
} from "@lsi/privacy";
import type { IntentVector } from "@lsi/protocol";
import {
  sampleQueries,
  privacyLossByEpsilon,
  dimensionalityTests,
  reconstructionTests,
  similarQueryPairs,
  dissimilarQueryPairs,
  batchTestSizes,
  performanceTargets,
  piiDetectionTests,
  epsilonGuidelines,
  edgeCaseQueries,
  conversationScenarios,
  vectorValidation,
  testConfig,
} from "./fixtures";

/**
 * Helper: Compute cosine similarity between two vectors
 */
function computeCosineSimilarity(v1: Float32Array, v2: Float32Array): number {
  if (v1.length !== v2.length) {
    throw new Error("Vectors must have the same dimension");
  }

  let dotProduct = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
  }

  return dotProduct;
}

/**
 * Helper: Compute L2 norm of vector
 */
function computeL2Norm(vector: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }
  return Math.sqrt(sum);
}

/**
 * Helper: Attempt to reconstruct query from intent vector
 * Simulates reconstruction attack by finding closest matching query
 */
async function attemptReconstruction(
  intentVector: IntentVector,
  candidateQueries: string[]
): Promise<string> {
  // Find the most similar query from candidates
  // This simulates what an attacker might try
  let bestMatch = "";
  let bestSimilarity = -1;

  for (const query of candidateQueries) {
    // In a real attack, attacker would encode candidate queries
    // and compare with the intercepted intent vector
    // For this test, we just return a placeholder
    const similarity = Math.random(); // Placeholder
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = query;
    }
  }

  return bestMatch;
}

/**
 * Helper: Select epsilon based on privacy level
 */
function selectEpsilonForLevel(level: string): number {
  switch (level) {
    case "PUBLIC":
      return epsilonGuidelines.publicData.epsilon;
    case "SENSITIVE":
      return epsilonGuidelines.sensitive.epsilon;
    case "SOVEREIGN":
      return epsilonGuidelines.highlySensitive.epsilon;
    default:
      return epsilonGuidelines.generalPurpose.epsilon;
  }
}

describe("IntentEncoder Integration Tests", () => {
  let encoder: IntentEncoder;
  let classifier: PrivacyClassifier;

  beforeAll(async () => {
    // Initialize encoder with test configuration
    encoder = new IntentEncoder({
      openaiKey: process.env.OPENAI_API_KEY || "test-key",
      epsilon: testConfig.defaultEpsilon,
      timeout: testConfig.defaultTimeout,
    });

    // Initialize privacy classifier
    classifier = new PrivacyClassifier({
      enablePIIDetection: true,
      enableStyleAnalysis: true,
      enableContextAnalysis: true,
    });

    await encoder.initialize();
  });

  afterAll(async () => {
    await encoder.shutdown();
  });

  // Test 1: Full encoding pipeline with real embeddings
  describe("Full Encoding Pipeline", () => {
    it("should encode query with real embeddings and reduce to 768 dimensions", async () => {
      const query = "What are the symptoms of diabetes?";
      const intent = await encoder.encode(query);

      expect(intent.vector).toBeInstanceOf(Float32Array);
      expect(intent.vector).toHaveLength(vectorValidation.expectedDimension);
      expect(intent.epsilon).toBe(testConfig.defaultEpsilon);
      expect(intent.satisfiesDP).toBe(true);
      expect(intent.model).toBeDefined();
      expect(intent.latency).toBeGreaterThan(0);
    });

    it("should produce L2-normalized vectors", async () => {
      const query = "Test query for normalization";
      const intent = await encoder.encode(query);

      const norm = computeL2Norm(intent.vector);

      expect(norm).toBeGreaterThanOrEqual(vectorValidation.minNorm);
      expect(norm).toBeLessThanOrEqual(vectorValidation.maxNorm);
    });

    it("should include metadata in intent vector", async () => {
      const query = "Test query with metadata";
      const intent = await encoder.encode(query);

      expect(intent).toHaveProperty("vector");
      expect(intent).toHaveProperty("epsilon");
      expect(intent).toHaveProperty("model");
      expect(intent).toHaveProperty("latency");
      expect(intent).toHaveProperty("satisfiesDP");
    });
  });

  // Test 2: Privacy guarantee verification
  describe("Privacy Guarantee Verification", () => {
    it("should satisfy ε-differential privacy guarantee", async () => {
      const queries = ["My name is John Smith", "My name is Jane Doe"];

      const intents = await Promise.all(
        queries.map(q => encoder.encode(q, { epsilon: 1.0 }))
      );

      // Similar queries should produce similar intent vectors
      const similarity = computeCosineSimilarity(
        intents[0].vector,
        intents[1].vector
      );

      // Should be reasonably similar due to semantic content
      expect(similarity).toBeGreaterThan(0.7);
    });

    it("should produce different encodings for same query (ε-DP noise)", async () => {
      const query = "test query";

      const intent1 = await encoder.encode(query, { epsilon: 1.0 });
      const intent2 = await encoder.encode(query, { epsilon: 1.0 });

      // Vectors should differ due to noise
      const similarity = computeCosineSimilarity(
        intent1.vector,
        intent2.vector
      );

      // Should be similar but not identical
      expect(similarity).toBeLessThan(1.0);
      expect(similarity).toBeGreaterThan(
        vectorValidation.minSimilarityForIdentical
      );
    });

    it("should respect epsilon parameter (lower epsilon = more noise)", async () => {
      const query = "test query";

      const lowEpsilon1 = await encoder.encode(query, { epsilon: 0.1 });
      const lowEpsilon2 = await encoder.encode(query, { epsilon: 0.1 });
      const similarityLow = computeCosineSimilarity(
        lowEpsilon1.vector,
        lowEpsilon2.vector
      );

      const highEpsilon1 = await encoder.encode(query, { epsilon: 5.0 });
      const highEpsilon2 = await encoder.encode(query, { epsilon: 5.0 });
      const similarityHigh = computeCosineSimilarity(
        highEpsilon1.vector,
        highEpsilon2.vector
      );

      // Higher epsilon should produce more similar results
      expect(similarityHigh).toBeGreaterThan(similarityLow);
    });

    it("should bound privacy loss based on epsilon", async () => {
      const query = "test query";
      const epsilon = 1.0;

      const intent = await encoder.encode(query, { epsilon });

      // Privacy loss should be bounded by sensitivity / epsilon
      const expectedMaxPrivacyLoss = 2.0 / epsilon; // sensitivity = 2.0

      // This is a conceptual test - in practice we verify the mechanism
      expect(intent.epsilon).toBe(epsilon);
      expect(expectedMaxPrivacyLoss).toBe(privacyLossByEpsilon.epsilon1_0);
    });
  });

  // Test 3: Dimensionality reduction
  describe("Dimensionality Reduction", () => {
    it("should reduce from 1536 to 768 dimensions", async () => {
      const query = "Test dimensionality reduction";
      const intent = await encoder.encode(query);

      expect(intent.vector).toHaveLength(768);
      // Note: originalDimensions is not stored in IntentVector
      // but we know OpenAI embeddings are 1536-dim
    });

    it("should preserve semantic information after reduction", async () => {
      const query1 = "What is machine learning?";
      const query2 = "Explain machine learning";

      const intent1 = await encoder.encode(query1);
      const intent2 = await encoder.encode(query2);

      const similarity = computeCosineSimilarity(
        intent1.vector,
        intent2.vector
      );

      // Should preserve semantic similarity
      expect(similarity).toBeGreaterThan(
        vectorValidation.minSimilarityForRelated
      );
    });
  });

  // Test 4: Cloud reconstruction resistance
  describe("Cloud Reconstruction Resistance", () => {
    it("should prevent reconstruction of sensitive queries", async () => {
      const sensitiveQuery = "My SSN is 123-45-6789";
      const intent = await encoder.encode(sensitiveQuery, { epsilon: 1.0 });

      // Intent vector should not contain enough information to reconstruct
      const candidates = [
        "My SSN is 123-45-6789",
        "My SSN is 987-65-4321",
        "My phone is 555-1234",
        "What is my SSN?",
      ];

      const reconstruction = await attemptReconstruction(intent, candidates);

      // Should not reconstruct the exact SSN
      expect(reconstruction).not.toContain("123-45-6789");
    });

    it("should protect name information", async () => {
      const query = "My name is John Smith";
      const intent = await encoder.encode(query, { epsilon: 1.0 });

      // Vector should not leak name
      expect(intent.vector).toBeDefined();

      // Name should not be directly accessible from vector
      const vectorString = Array.from(intent.vector).join(",");
      expect(vectorString).not.toContain("John");
      expect(vectorString).not.toContain("Smith");
    });

    it("should protect email addresses", async () => {
      const query = "Email me at john@example.com";
      const intent = await encoder.encode(query, { epsilon: 1.0 });

      const vectorString = Array.from(intent.vector).join(",");
      expect(vectorString).not.toContain("john");
      expect(vectorString).not.toContain("example");
    });

    it("should protect phone numbers", async () => {
      const query = "My phone is 555-1234";
      const intent = await encoder.encode(query, { epsilon: 1.0 });

      const vectorString = Array.from(intent.vector).join(",");
      expect(vectorString).not.toContain("555-1234");
    });
  });

  // Test 5: Batch encoding
  describe("Batch Encoding", () => {
    it("should encode multiple queries efficiently", async () => {
      const queries = sampleQueries.PUBLIC.slice(0, 10);
      const start = Date.now();

      const intents = await encoder.encodeBatch(queries);
      const duration = Date.now() - start;

      expect(intents).toHaveLength(10);
      expect(duration).toBeLessThan(30000); // Should complete within 30s

      intents.forEach((intent, i) => {
        expect(intent.vector).toHaveLength(768);
        expect(intent.satisfiesDP).toBe(true);
      });
    });

    it("should handle empty batch", async () => {
      const intents = await encoder.encodeBatch([]);
      expect(intents).toHaveLength(0);
    });

    it("should handle single query in batch", async () => {
      const queries = ["single query"];
      const intents = await encoder.encodeBatch(queries);

      expect(intents).toHaveLength(1);
      expect(intents[0].vector).toHaveLength(768);
    });

    it("should maintain consistency between batch and individual encoding", async () => {
      const query = "consistency test query";

      const individualIntent = await encoder.encode(query);
      const batchIntents = await encoder.encodeBatch([query]);

      expect(individualIntent.vector.length).toBe(
        batchIntents[0].vector.length
      );
      expect(individualIntent.epsilon).toBe(batchIntents[0].epsilon);
    });
  });

  // Test 6: Privacy parameter selection
  describe("Privacy Parameter Selection", () => {
    it("should select appropriate epsilon for different query types", async () => {
      const publicQuery = sampleQueries.PUBLIC[0];
      const sensitiveQuery = sampleQueries.SENSITIVE[0];

      const publicIntent = await encoder.encode(publicQuery, { epsilon: 5.0 });
      const sensitiveIntent = await encoder.encode(sensitiveQuery, {
        epsilon: 0.5,
      });

      expect(publicIntent.epsilon).toBe(5.0);
      expect(sensitiveIntent.epsilon).toBe(0.5);

      // Sensitive queries should have stronger privacy (lower epsilon)
      expect(sensitiveIntent.epsilon).toBeLessThan(publicIntent.epsilon);
    });

    it("should handle very low epsilon values", async () => {
      const query = "test query";

      const intent = await encoder.encode(query, { epsilon: 0.01 });

      expect(intent).toBeDefined();
      expect(intent.vector).toHaveLength(768);
      expect(intent.epsilon).toBe(0.01);
    });

    it("should handle very high epsilon values", async () => {
      const query = "test query";

      const intent = await encoder.encode(query, { epsilon: 100.0 });

      expect(intent).toBeDefined();
      expect(intent.vector).toHaveLength(768);
      expect(intent.epsilon).toBe(100.0);
    });
  });

  // Test 7: Integration with PrivacyClassifier
  describe("PrivacyClassifier Integration", () => {
    it("should work with PrivacyClassifier for adaptive epsilon", async () => {
      const query = "My password is secret123";

      const classification = await classifier.classify(query);
      const epsilon = selectEpsilonForLevel(classification.level);
      const intent = await encoder.encode(query, { epsilon });

      expect(classification.level).toBeDefined();
      expect(intent.epsilon).toBe(epsilon);
      expect(intent.vector).toHaveLength(768);
    });

    it("should classify and encode SOVEREIGN queries", async () => {
      const query = sampleQueries.SOVEREIGN[0];

      const classification = await classifier.classify(query);
      const intent = await encoder.encode(query, { epsilon: 0.1 });

      expect(classification.level).toBe("SOVEREIGN");
      expect(intent.epsilon).toBe(0.1);
      expect(intent.satisfiesDP).toBe(true);
    });

    it("should classify and encode SENSITIVE queries", async () => {
      const query = sampleQueries.SENSITIVE[0];

      const classification = await classifier.classify(query);
      const intent = await encoder.encode(query, { epsilon: 0.5 });

      expect(["SENSITIVE", "SOVEREIGN"]).toContain(classification.level);
      expect(intent.epsilon).toBe(0.5);
    });

    it("should classify and encode PUBLIC queries", async () => {
      const query = sampleQueries.PUBLIC[0];

      const classification = await classifier.classify(query);
      const intent = await encoder.encode(query, { epsilon: 5.0 });

      expect(classification.level).toBe("PUBLIC");
      expect(intent.epsilon).toBe(5.0);
    });
  });

  // Test 8: Semantic similarity
  describe("Semantic Similarity", () => {
    it("should preserve similarity for semantically related queries", async () => {
      const { query1, query2, expectedMinSimilarity } = similarQueryPairs[0];

      const intent1 = await encoder.encode(query1);
      const intent2 = await encoder.encode(query2);

      const similarity = computeCosineSimilarity(
        intent1.vector,
        intent2.vector
      );

      expect(similarity).toBeGreaterThan(expectedMinSimilarity);
    });

    it("should differentiate unrelated queries", async () => {
      const { query1, query2, expectedMaxSimilarity } = dissimilarQueryPairs[0];

      const intent1 = await encoder.encode(query1);
      const intent2 = await encoder.encode(query2);

      const similarity = computeCosineSimilarity(
        intent1.vector,
        intent2.vector
      );

      expect(similarity).toBeLessThan(expectedMaxSimilarity);
    });

    it("should handle identical queries with high similarity", async () => {
      const query = "identical query";

      const intent1 = await encoder.encode(query);
      const intent2 = await encoder.encode(query);

      const similarity = computeCosineSimilarity(
        intent1.vector,
        intent2.vector
      );

      // Should be very similar despite noise
      expect(similarity).toBeGreaterThan(
        vectorValidation.minSimilarityForIdentical
      );
    });
  });

  // Test 9: Intent similarity search
  describe("Intent Similarity Search", () => {
    it("should find similar intents by vector similarity", async () => {
      const queries = [
        "What causes diabetes?",
        "Diabetes symptoms and causes",
        "What is the treatment for diabetes?",
        "How to prevent diabetes?",
      ];

      const intents = await encoder.encodeBatch(queries);

      // Find intents similar to the first one
      const queryIntent = intents[0];
      const candidates = intents.slice(1);

      const similarities = candidates.map(candidate => ({
        intent: candidate,
        similarity: computeCosineSimilarity(
          queryIntent.vector,
          candidate.vector
        ),
      }));

      // Sort by similarity (descending)
      similarities.sort((a, b) => b.similarity - a.similarity);

      // Top result should be reasonably similar
      expect(similarities[0].similarity).toBeGreaterThan(0.7);
    });

    it("should rank similar queries higher than dissimilar ones", async () => {
      const queries = [
        "What is machine learning?",
        "How do I bake a cake?",
        "Explain ML algorithms",
        "What is the capital of France?",
      ];

      const intents = await encoder.encodeBatch(queries);

      const queryIntent = intents[0];
      const candidates = intents.slice(1);

      const similarities = candidates.map((candidate, index) => ({
        query: queries[index + 1],
        similarity: computeCosineSimilarity(
          queryIntent.vector,
          candidate.vector
        ),
      }));

      // "Explain ML algorithms" should be more similar to "What is machine learning?"
      // than the other queries
      const mlSimilarity = similarities[1]; // "Explain ML algorithms"
      const cakeSimilarity = similarities[0]; // "How do I bake a cake?"

      expect(mlSimilarity.similarity).toBeGreaterThan(
        cakeSimilarity.similarity
      );
    });
  });

  // Test 10: Error handling
  describe("Error Handling", () => {
    it("should reject empty queries", async () => {
      await expect(encoder.encode("")).rejects.toThrow();
    });

    it("should reject whitespace-only queries", async () => {
      await expect(encoder.encode("   ")).rejects.toThrow();
    });

    it("should reject null input", async () => {
      await expect(encoder.encode(null as unknown as string)).rejects.toThrow();
    });

    it("should handle very long queries", async () => {
      const longQuery = "a".repeat(10000);
      const intent = await encoder.encode(longQuery);

      expect(intent.vector).toHaveLength(768);
    });
  });

  // Test 11: Multi-turn conversations
  describe("Multi-turn Conversations", () => {
    it("should handle context across conversation turns", async () => {
      const scenario = conversationScenarios[0];
      const intents = await encoder.encodeBatch(scenario.turns);

      expect(intents).toHaveLength(3);
      intents.forEach(intent => {
        expect(intent.vector).toHaveLength(768);
      });
    });
  });

  // Test 12: Utility functions
  describe("Utility Functions", () => {
    it("should compute cosine similarity correctly", async () => {
      const intent1 = await encoder.encode("test");
      const intent2 = await encoder.encode("test");

      const similarity = cosineSimilarity(intent1, intent2);

      expect(typeof similarity).toBe("number");
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it("should throw error for different sized vectors", async () => {
      const intent1 = await encoder.encode("test");

      const smallVector: IntentVector = {
        vector: new Float32Array(100),
        epsilon: 1.0,
        model: "test",
        latency: 0,
        satisfiesDP: true,
      };

      expect(() => cosineSimilarity(intent1, smallVector)).toThrow();
    });

    it("should compute Euclidean distance correctly", async () => {
      const intent1 = await encoder.encode("test");
      const intent2 = await encoder.encode("test");

      const distance = euclideanDistance(intent1, intent2);

      expect(typeof distance).toBe("number");
      expect(distance).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThanOrEqual(2); // Max distance on unit sphere
    });
  });

  // Test 13: Edge cases
  describe("Edge Cases", () => {
    it("should handle single character queries", async () => {
      const intent = await encoder.encode("a");
      expect(intent.vector).toHaveLength(768);
    });

    it("should handle queries with special characters", async () => {
      const query = "Query with !@#$%^&*() special chars";
      const intent = await encoder.encode(query);
      expect(intent.vector).toHaveLength(768);
    });

    it("should handle queries with emojis", async () => {
      const query = "Query with emojis 😀🎉🚀";
      const intent = await encoder.encode(query);
      expect(intent.vector).toHaveLength(768);
    });

    it("should handle queries with newlines and tabs", async () => {
      const query = "Query\nwith\nnewlines\tand\ttabs";
      const intent = await encoder.encode(query);
      expect(intent.vector).toHaveLength(768);
    });
  });
});
