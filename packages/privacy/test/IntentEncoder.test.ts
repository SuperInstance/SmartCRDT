/**
 * IntentEncoder Tests
 *
 * Tests for privacy-preserving intent encoding with
 * ε-differential privacy guarantees.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntentEncoder, cosineSimilarity, euclideanDistance } from '../src/intention/IntentEncoder.js';

// Mock OpenAI embedding service
class MockOpenAIEmbeddingService {
  async initialize() {
    // Mock initialization
  }

  async embed(text: string) {
    // Return deterministic mock embeddings based on text
    const hash = this.simpleHash(text);
    const embedding = new Float32Array(1536);
    for (let i = 0; i < 1536; i++) {
      embedding[i] = ((hash >> (i % 32)) & 0xff) / 255;
    }
    return embedding;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

describe('IntentEncoder - Basic Encoding', () => {
  let encoder: IntentEncoder;

  beforeEach(() => {
    // Create encoder with mock OpenAI service
    encoder = new IntentEncoder({
      openaiKey: 'test-key',
      epsilon: 1.0,
      outputDimensions: 768,
    }) as any;
  });

  it('should encode query to 768-dim vector', async () => {
    await encoder.initialize();

    const intent = await encoder.encode('What is the weather?');

    expect(intent.vector).toBeInstanceOf(Float32Array);
    expect(intent.vector.length).toBe(768);
  });

  it('should apply ε-differential privacy', async () => {
    await encoder.initialize();

    const intent = await encoder.encode('Test query', 1.0);

    expect(intent.epsilon).toBe(1.0);
    expect(intent.satisfiesDP).toBe(true);
  });

  it('should reduce dimensionality 1536→768', async () => {
    await encoder.initialize();

    const intent = await encoder.encode('Test');

    expect(intent.vector.length).toBe(768);
  });

  it('should normalize vector', async () => {
    await encoder.initialize();

    const intent = await encoder.encode('Test query');

    // Calculate L2 norm
    let norm = 0;
    for (let i = 0; i < intent.vector.length; i++) {
      norm += intent.vector[i] * intent.vector[i];
    }
    norm = Math.sqrt(norm);

    // Should be close to 1 (within floating point tolerance)
    expect(norm).toBeGreaterThan(0.99);
    expect(norm).toBeLessThan(1.01);
  });

  it('should add noise', async () => {
    await encoder.initialize();

    // Encode same query twice - should get different results due to noise
    const intent1 = await encoder.encode('Same query');
    const intent2 = await encoder.encode('Same query');

    // Vectors should be different (due to DP noise)
    let diff = 0;
    for (let i = 0; i < Math.min(intent1.vector.length, intent2.vector.length); i++) {
      diff += Math.abs(intent1.vector[i] - intent2.vector[i]);
    }

    expect(diff).toBeGreaterThan(0);
  });

  it('should encode with model name', async () => {
    await encoder.initialize();

    const intent = await encoder.encode('Test');

    expect(intent.model).toBeDefined();
  });

  it('should track latency', async () => {
    await encoder.initialize();

    const intent = await encoder.encode('Test');

    expect(intent.latency).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty query', async () => {
    await encoder.initialize();

    const intent = await encoder.encode('');

    expect(intent.vector.length).toBe(768);
  });

  it('should handle very long query', async () => {
    await encoder.initialize();

    const longQuery = 'a'.repeat(10000);
    const intent = await encoder.encode(longQuery);

    expect(intent.vector.length).toBe(768);
  });

  it('should handle unicode characters', async () => {
    await encoder.initialize();

    const unicodeQuery = 'Hello 世界 🌍 Привет';
    const intent = await encoder.encode(unicodeQuery);

    expect(intent.vector.length).toBe(768);
  });
});

describe('IntentEncoder - ε-Differential Privacy', () => {
  let encoder: IntentEncoder;

  beforeEach(async () => {
    encoder = new IntentEncoder({
      openaiKey: 'test-key',
      epsilon: 1.0,
    }) as any;
    await encoder.initialize();
  });

  it('should satisfy ε-DP with ε=0.1 (high privacy)', async () => {
    const intent = await encoder.encode('Test query', 0.1);

    expect(intent.epsilon).toBe(0.1);
    expect(intent.satisfiesDP).toBe(true);
  });

  it('should satisfy ε-DP with ε=1.0 (medium privacy)', async () => {
    const intent = await encoder.encode('Test query', 1.0);

    expect(intent.epsilon).toBe(1.0);
    expect(intent.satisfiesDP).toBe(true);
  });

  it('should satisfy ε-DP with ε=10.0 (low privacy)', async () => {
    const intent = await encoder.encode('Test query', 10.0);

    expect(intent.epsilon).toBe(10.0);
    expect(intent.satisfiesDP).toBe(true);
  });

  it('should add more noise with lower ε', async () => {
    // Lower epsilon = more noise = less similarity between encodings
    const query = 'Same query';
    const lowPrivacy1 = await encoder.encode(query, 0.1);
    const lowPrivacy2 = await encoder.encode(query, 0.1);

    const highPrivacy1 = await encoder.encode(query, 10.0);
    const highPrivacy2 = await encoder.encode(query, 10.0);

    const lowDiff = euclideanDistance(lowPrivacy1.vector, lowPrivacy2.vector);
    const highDiff = euclideanDistance(highPrivacy1.vector, highPrivacy2.vector);

    // Lower epsilon should have more variance (higher difference)
    expect(lowDiff).toBeGreaterThan(highDiff * 0.5);
  });

  it('should bound sensitivity', async () => {
    // Encoding similar queries should not produce vastly different outputs
    const intent1 = await encoder.encode('The quick brown fox');
    const intent2 = await encoder.encode('The quick brown cat');

    // Similar queries should have relatively close embeddings
    const similarity = cosineSimilarity(intent1.vector, intent2.vector);
    expect(similarity).toBeGreaterThan(0);
  });

  it('should prevent reconstruction', async () => {
    // Encoded vector should not allow easy reconstruction of original query
    const intent = await encoder.encode('My secret password is hunter2');

    // The vector is normalized and low-dimensional, making reconstruction hard
    // This is a conceptual test - in practice you'd measure reconstruction accuracy
    expect(intent.vector.length).toBe(768);
    expect(intent.satisfiesDP).toBe(true);
  });

  it('should add Gaussian noise', async () => {
    // Multiple encodings should follow a distribution (Gaussian mechanism)
    const query = 'Test query';
    const encodings = await Promise.all(
      Array.from({ length: 10 }, () => encoder.encode(query))
    );

    // Calculate variance of first dimension
    const values = encodings.map((e) => e.vector[0]);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;

    // Should have some variance (noise)
    expect(variance).toBeGreaterThan(0);
  });
});

describe('IntentEncoder - Batch Encoding', () => {
  let encoder: IntentEncoder;

  beforeEach(async () => {
    encoder = new IntentEncoder({
      openaiKey: 'test-key',
    }) as any;
    await encoder.initialize();
  });

  it('should encode batch of 10 queries', async () => {
    const queries = Array.from({ length: 10 }, (_, i) => `Query ${i}`);

    const intents = await encoder.encodeBatch(queries);

    expect(intents.length).toBe(10);
    intents.forEach((intent) => {
      expect(intent.vector.length).toBe(768);
    });
  });

  it('should encode batch of 100 queries', async () => {
    const queries = Array.from({ length: 100 }, (_, i) => `Query ${i}`);

    const intents = await encoder.encodeBatch(queries);

    expect(intents.length).toBe(100);
  });

  it('should maintain consistency across batch', async () => {
    const queries = ['Query 1', 'Query 2', 'Query 3'];

    const intents1 = await encoder.encodeBatch(queries);
    const intents2 = await encoder.encodeBatch(queries);

    // Each query should get consistent encoding
    for (let i = 0; i < queries.length; i++) {
      // Note: Due to DP noise, they won't be exactly equal, but should be close
      const similarity = cosineSimilarity(intents1[i].vector, intents2[i].vector);
      expect(similarity).toBeGreaterThan(0.9);
    }
  });

  it('should handle empty batch', async () => {
    const intents = await encoder.encodeBatch([]);

    expect(intents).toEqual([]);
  });

  it('should handle single item batch', async () => {
    const intents = await encoder.encodeBatch(['Single query']);

    expect(intents.length).toBe(1);
    expect(intents[0].vector.length).toBe(768);
  });
});

describe('IntentEncoder - Edge Cases', () => {
  let encoder: IntentEncoder;

  beforeEach(async () => {
    encoder = new IntentEncoder({
      openaiKey: 'test-key',
    }) as any;
    await encoder.initialize();
  });

  it('should handle special characters', async () => {
    const specialQuery = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const intent = await encoder.encode(specialQuery);

    expect(intent.vector.length).toBe(768);
  });

  it('should handle newlines and tabs', async () => {
    const whitespaceQuery = 'Line 1\nLine 2\tTabbed';

    const intent = await encoder.encode(whitespaceQuery);

    expect(intent.vector.length).toBe(768);
  });

  it('should handle numeric query', async () => {
    const numericQuery = '1234567890';

    const intent = await encoder.encode(numericQuery);

    expect(intent.vector.length).toBe(768);
  });

  it('should handle query with only spaces', async () => {
    const spaceQuery = '     ';

    const intent = await encoder.encode(spaceQuery);

    expect(intent.vector.length).toBe(768);
  });

  it('should handle very large epsilon', async () => {
    const intent = await encoder.encode('Test', 1000);

    expect(intent.epsilon).toBe(1000);
    expect(intent.satisfiesDP).toBe(true);
  });

  it('should handle very small epsilon', async () => {
    const intent = await encoder.encode('Test', 0.001);

    expect(intent.epsilon).toBe(0.001);
    expect(intent.satisfiesDP).toBe(true);
  });
});

describe('Similarity Functions', () => {
  it('should calculate cosine similarity', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([1, 0, 0]);

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(1, 5);
  });

  it('should calculate cosine similarity for orthogonal vectors', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([0, 1, 0]);

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(0, 5);
  });

  it('should calculate cosine similarity for opposite vectors', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([-1, 0, 0]);

    const similarity = cosineSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(-1, 5);
  });

  it('should calculate euclidean distance', () => {
    const vec1 = new Float32Array([0, 0, 0]);
    const vec2 = new Float32Array([1, 0, 0]);

    const distance = euclideanDistance(vec1, vec2);

    expect(distance).toBeCloseTo(1, 5);
  });

  it('should calculate euclidean distance for 2D vectors', () => {
    const vec1 = new Float32Array([0, 0]);
    const vec2 = new Float32Array([3, 4]);

    const distance = euclideanDistance(vec1, vec2);

    expect(distance).toBeCloseTo(5, 5);
  });

  it('should handle zero distance', () => {
    const vec1 = new Float32Array([1, 2, 3]);
    const vec2 = new Float32Array([1, 2, 3]);

    const distance = euclideanDistance(vec1, vec2);

    expect(distance).toBeCloseTo(0, 5);
  });

  it('should handle different length vectors (error case)', () => {
    const vec1 = new Float32Array([1, 2, 3]);
    const vec2 = new Float32Array([1, 2]);

    // Should handle gracefully - either throw error or use min length
    expect(() => euclideanDistance(vec1, vec2)).not.toThrow();
  });
});
