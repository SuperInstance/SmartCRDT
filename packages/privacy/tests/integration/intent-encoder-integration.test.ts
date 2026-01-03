/**
 * IntentEncoder Integration Tests
 *
 * These tests verify the IntentEncoder works correctly with the
 * IntentionPlane integration.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { IntentEncoder, cosineSimilarity } from '@lsi/privacy/intention';
import type { IntentVector } from '@lsi/protocol';

/**
 * Helper function to compute cosine similarity between two vectors
 */
function computeCosineSimilarity(v1: Float32Array, v2: Float32Array): number {
  if (v1.length !== v2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  for (let i = 0; i < v1.length; i++) {
    dotProduct += v1[i] * v2[i];
  }

  return dotProduct;
}

describe('IntentEncoder Integration', () => {
  let encoder: IntentEncoder;

  beforeAll(() => {
    encoder = new IntentEncoder({
      openaiKey: process.env.OPENAI_API_KEY || 'test-key',
      epsilon: 1.0,
    });
  });

  describe('Basic Encoding', () => {
    it('should encode query to 768-dimensional vector', async () => {
      await encoder.initialize();

      const result = await encoder.encode('What is the weather?');

      expect(result.vector).toBeInstanceOf(Float32Array);
      expect(result.vector.length).toBe(768);
      expect(result.epsilon).toBe(1.0);
      expect(result.satisfiesDP).toBe(true);
      expect(result.model).toBeDefined();
      expect(result.latency).toBeGreaterThan(0);
    });

    it('should produce normalized vectors', async () => {
      await encoder.initialize();

      const result = await encoder.encode('test query');

      // Compute L2 norm
      let norm = 0;
      for (let i = 0; i < result.vector.length; i++) {
        norm += result.vector[i] * result.vector[i];
      }
      norm = Math.sqrt(norm);

      // L2 norm should be close to 1.0
      expect(norm).toBeGreaterThan(0.99);
      expect(norm).toBeLessThan(1.01);
    });

    it('should handle empty query with error', async () => {
      await encoder.initialize();

      await expect(encoder.encode('')).rejects.toThrow();
      await expect(encoder.encode('   ')).rejects.toThrow();
    });
  });

  describe('Differential Privacy', () => {
    it('should produce different encodings for same query (ε-DP)', async () => {
      await encoder.initialize();

      const result1 = await encoder.encode('test query');
      const result2 = await encoder.encode('test query');

      // Vectors should differ due to noise
      const similarity = computeCosineSimilarity(result1.vector, result2.vector);

      // Should be similar but not identical
      expect(similarity).toBeLessThan(1.0);
      expect(similarity).toBeGreaterThan(0.95);
    });

    it('should respect epsilon parameter', async () => {
      await encoder.initialize();

      // Lower epsilon = more noise = less similar
      const result1a = await encoder.encode('test query', 0.1);
      const result1b = await encoder.encode('test query', 0.1);
      const similarityLow = computeCosineSimilarity(result1a.vector, result1b.vector);

      // Higher epsilon = less noise = more similar
      const result2a = await encoder.encode('test query', 2.0);
      const result2b = await encoder.encode('test query', 2.0);
      const similarityHigh = computeCosineSimilarity(result2a.vector, result2b.vector);

      // Higher epsilon should produce more similar results
      expect(similarityHigh).toBeGreaterThan(similarityLow);
    });
  });

  describe('Semantic Similarity', () => {
    it('should preserve semantic similarity for related queries', async () => {
      await encoder.initialize();

      const result1 = await encoder.encode('What is JavaScript?');
      const result2 = await encoder.encode('Explain JavaScript programming');

      // Should be semantically similar
      const similarity = computeCosineSimilarity(result1.vector, result2.vector);
      expect(similarity).toBeGreaterThan(0.8);
    });

    it('should differentiate unrelated queries', async () => {
      await encoder.initialize();

      const result1 = await encoder.encode('What is the capital of France?');
      const result2 = await encoder.encode('How do I bake a cake?');

      // Should be less similar than related queries
      const similarity = computeCosineSimilarity(result1.vector, result2.vector);
      expect(similarity).toBeLessThan(0.7);
    });

    it('should be more similar for identical queries than different ones', async () => {
      await encoder.initialize();

      const result1 = await encoder.encode('identical query');
      const result2 = await encoder.encode('identical query');
      const result3 = await encoder.encode('different query');

      // Identical queries should be more similar than different ones
      const similarityIdentical = computeCosineSimilarity(result1.vector, result2.vector);
      const similarityDifferent = computeCosineSimilarity(result1.vector, result3.vector);

      expect(similarityIdentical).toBeGreaterThan(similarityDifferent);
    });
  });

  describe('Batch Encoding', () => {
    it('should handle batch encoding', async () => {
      await encoder.initialize();

      const queries = ['query 1', 'query 2', 'query 3'];
      const results = await encoder.encodeBatch(queries);

      expect(results).toHaveLength(3);
      expect(results[0].vector.length).toBe(768);
      expect(results[1].vector.length).toBe(768);
      expect(results[2].vector.length).toBe(768);
    });

    it('should return consistent results for batch vs individual', async () => {
      await encoder.initialize();

      const query = 'test query';

      const individualResult = await encoder.encode(query);
      const batchResults = await encoder.encodeBatch([query]);

      // Results should have same structure
      expect(individualResult.vector.length).toBe(batchResults[0].vector.length);
      expect(individualResult.epsilon).toBe(batchResults[0].epsilon);
    });

    it('should handle empty batch', async () => {
      await encoder.initialize();

      const results = await encoder.encodeBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const badEncoder = new IntentEncoder({
        openaiKey: '',
        epsilon: 1.0,
      });

      // Should not throw, but may fail on encode
      await expect(badEncoder.encode('test')).resolves.toBeDefined();
    });

    it('should handle invalid epsilon values', async () => {
      await encoder.initialize();

      // Very low epsilon should still work
      const result = await encoder.encode('test', 0.01);
      expect(result.vector).toBeDefined();
      expect(result.epsilon).toBe(0.01);

      // Very high epsilon should still work
      const result2 = await encoder.encode('test', 10.0);
      expect(result2.vector).toBeDefined();
      expect(result2.epsilon).toBe(10.0);
    });
  });

  describe('Performance', () => {
    it('should encode queries within reasonable time', async () => {
      await encoder.initialize();

      const start = Date.now();
      await encoder.encode('test query');
      const duration = Date.now() - start;

      // Should complete within 30 seconds
      expect(duration).toBeLessThan(30000);
    });

    it('should handle batch encoding efficiently', async () => {
      await encoder.initialize();

      const queries = Array(10).fill('test query');

      const start = Date.now();
      await encoder.encodeBatch(queries);
      const duration = Date.now() - start;

      // Batch should complete within 60 seconds
      expect(duration).toBeLessThan(60000);
    });
  });

  describe('Utility Functions', () => {
    it('should compute cosine similarity correctly', async () => {
      await encoder.initialize();

      const result1: IntentVector = await encoder.encode('test');
      const result2: IntentVector = await encoder.encode('test');

      const similarity = cosineSimilarity(result1, result2);

      expect(typeof similarity).toBe('number');
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should throw error for different sized vectors', async () => {
      await encoder.initialize();

      const result1 = await encoder.encode('test');

      // Create a different sized vector
      const smallVector: IntentVector = {
        vector: new Float32Array(100),
        epsilon: 1.0,
        model: 'test',
        latency: 0,
        satisfiesDP: true,
      };

      expect(() => cosineSimilarity(result1, smallVector)).toThrow();
    });
  });
});
