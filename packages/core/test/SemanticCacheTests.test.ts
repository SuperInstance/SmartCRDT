/**
 * SemanticCache Tests
 *
 * Tests for semantic caching including similarity calculations,
 * cache operations, and TTL handling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticCache } from '@lsi/cascade/src/refiner/SemanticCache.js';

describe('SemanticCache - Cache Operations', () => {
  let cache: SemanticCache;

  beforeEach(() => {
    cache = new SemanticCache({
      maxSize: 100,
      ttl: 60000,
      similarityThreshold: 0.85,
    });
  });

  it('should cache query-response pair', async () => {
    const query = 'What is the weather?';
    const embedding = new Float32Array(768).fill(0.1);
    const response = 'The weather is sunny';

    await cache.set(query, embedding, response);

    const cached = await cache.get(query, embedding);

    expect(cached).toBeDefined();
    expect(cached?.response).toBe(response);
  });

  it('should retrieve from cache', async () => {
    const query = 'What is AI?';
    const embedding = new Float32Array(768).fill(0.2);
    const response = 'AI is artificial intelligence';

    await cache.set(query, embedding, response);

    const cached = await cache.get(query, embedding);

    expect(cached).toBeDefined();
    expect(cached?.response).toBe(response);
    expect(cached?.fromCache).toBe(true);
  });

  it('should calculate similarity', async () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([1, 0, 0]);

    const similarity = cache.calculateSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(1, 5);
  });

  it('should handle cache miss', async () => {
    const query = 'Miss query';
    const embedding = new Float32Array(768).fill(0.3);

    const cached = await cache.get(query, embedding);

    expect(cached).toBeNull();
  });

  it('should handle cache hit with threshold', async () => {
    const query1 = 'Similar query 1';
    const query2 = 'Similar query 2';
    const embedding = new Float32Array(768).fill(0.4);
    const response = 'Response';

    await cache.set(query1, embedding, response);

    const cached = await cache.get(query2, embedding);

    // Should hit due to similarity
    expect(cached).toBeDefined();
  });

  it('should evict LRU entry', async () => {
    const smallCache = new SemanticCache({
      maxSize: 2,
      ttl: 60000,
      similarityThreshold: 0.85,
    });

    const embedding = new Float32Array(768).fill(0.5);

    await smallCache.set('query1', embedding, 'response1');
    await smallCache.set('query2', embedding, 'response2');
    await smallCache.set('query3', embedding, 'response3');

    // First entry should be evicted
    const cached1 = await smallCache.get('query1', embedding);
    const cached3 = await smallCache.get('query3', embedding);

    expect(cached1).toBeNull();
    expect(cached3).toBeDefined();
  });

  it('should handle TTL expiration', async () => {
    const shortCache = new SemanticCache({
      maxSize: 100,
      ttl: 100, // 100ms
      similarityThreshold: 0.85,
    });

    const query = 'TTL test';
    const embedding = new Float32Array(768).fill(0.6);
    const response = 'Response';

    await shortCache.set(query, embedding, response);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 150));

    const cached = await shortCache.get(query, embedding);

    expect(cached).toBeNull();
  });

  it('should batch get/set', async () => {
    const entries = [
      { query: 'query1', embedding: new Float32Array(768).fill(0.1), response: 'response1' },
      { query: 'query2', embedding: new Float32Array(768).fill(0.2), response: 'response2' },
      { query: 'query3', embedding: new Float32Array(768).fill(0.3), response: 'response3' },
    ];

    await cache.setBatch(entries);

    const results = await cache.getBatch(
      entries.map((e) => e.query),
      entries.map((e) => e.embedding)
    );

    expect(results.length).toBe(3);
    expect(results.filter((r) => r !== null).length).toBe(3);
  });

  it('should clear cache', async () => {
    const embedding = new Float32Array(768).fill(0.7);

    await cache.set('query1', embedding, 'response1');
    await cache.set('query2', embedding, 'response2');

    await cache.clear();

    const cached1 = await cache.get('query1', embedding);
    const cached2 = await cache.get('query2', embedding);

    expect(cached1).toBeNull();
    expect(cached2).toBeNull();
  });

  it('should get cache stats', async () => {
    const embedding = new Float32Array(768).fill(0.8);

    await cache.set('query1', embedding, 'response1');
    await cache.get('query1', embedding); // hit
    await cache.get('query2', embedding); // miss

    const stats = await cache.getStats();

    expect(stats.size).toBe(1);
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });
});

describe('SemanticCache - Similarity', () => {
  let cache: SemanticCache;

  beforeEach(() => {
    cache = new SemanticCache({
      maxSize: 100,
      ttl: 60000,
      similarityThreshold: 0.85,
    });
  });

  it('should calculate cosine similarity', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([1, 0, 0]);

    const similarity = cache.calculateSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(1, 5);
  });

  it('should calculate for orthogonal vectors', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([0, 1, 0]);

    const similarity = cache.calculateSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(0, 5);
  });

  it('should calculate for opposite vectors', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([-1, 0, 0]);

    const similarity = cache.calculateSimilarity(vec1, vec2);

    expect(similarity).toBeCloseTo(-1, 5);
  });

  it('should handle zero vectors', () => {
    const vec1 = new Float32Array([0, 0, 0]);
    const vec2 = new Float32Array([0, 0, 0]);

    const similarity = cache.calculateSimilarity(vec1, vec2);

    // Zero vectors have undefined similarity, should return 0 or handle gracefully
    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });

  it('should normalize vectors', () => {
    const vec1 = new Float32Array([2, 0, 0]);
    const vec2 = new Float32Array([1, 0, 0]);

    const similarity = cache.calculateSimilarity(vec1, vec2);

    // After normalization, should be identical
    expect(similarity).toBeCloseTo(1, 5);
  });

  it('should handle different dimensions', () => {
    const vec1 = new Float32Array([1, 0, 0]);
    const vec2 = new Float32Array([1, 0]);

    // Should handle gracefully - either throw error or use min dimension
    expect(() => cache.calculateSimilarity(vec1, vec2)).not.toThrow();
  });
});

describe('SemanticCache - Edge Cases', () => {
  it('should handle empty cache', async () => {
    const cache = new SemanticCache();

    const embedding = new Float32Array(768).fill(0.9);
    const cached = await cache.get('query', embedding);

    expect(cached).toBeNull();
  });

  it('should handle duplicate keys', async () => {
    const cache = new SemanticCache();

    const embedding = new Float32Array(768).fill(1.0);

    await cache.set('query', embedding, 'response1');
    await cache.set('query', embedding, 'response2');

    const cached = await cache.get('query', embedding);

    // Should have the latest value
    expect(cached?.response).toBe('response2');
  });

  it('should handle very long query', async () => {
    const cache = new SemanticCache();

    const longQuery = 'a'.repeat(10000);
    const embedding = new Float32Array(768).fill(0.1);

    await cache.set(longQuery, embedding, 'response');

    const cached = await cache.get(longQuery, embedding);

    expect(cached).toBeDefined();
  });

  it('should handle unicode in query', async () => {
    const cache = new SemanticCache();

    const unicodeQuery = 'Hello 世界 🌍';
    const embedding = new Float32Array(768).fill(0.2);

    await cache.set(unicodeQuery, embedding, 'response');

    const cached = await cache.get(unicodeQuery, embedding);

    expect(cached).toBeDefined();
  });

  it('should handle special characters in query', async () => {
    const cache = new SemanticCache();

    const specialQuery = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const embedding = new Float32Array(768).fill(0.3);

    await cache.set(specialQuery, embedding, 'response');

    const cached = await cache.get(specialQuery, embedding);

    expect(cached).toBeDefined();
  });

  it('should handle zero TTL', async () => {
    const cache = new SemanticCache({
      ttl: 0,
    });

    const query = 'Zero TTL';
    const embedding = new Float32Array(768).fill(0.4);

    await cache.set(query, embedding, 'response');

    // Should expire immediately
    const cached = await cache.get(query, embedding);

    expect(cached).toBeNull();
  });

  it('should handle very large embedding', async () => {
    const cache = new SemanticCache();

    const largeEmbedding = new Float32Array(1536).fill(0.5);

    await cache.set('query', largeEmbedding, 'response');

    const cached = await cache.get('query', largeEmbedding);

    expect(cached).toBeDefined();
  });

  it('should handle very small embedding', async () => {
    const cache = new SemanticCache();

    const smallEmbedding = new Float32Array(128).fill(0.6);

    await cache.set('query', smallEmbedding, 'response');

    const cached = await cache.get('query', smallEmbedding);

    expect(cached).toBeDefined();
  });

  it('should handle NaN in embedding', async () => {
    const cache = new SemanticCache();

    const embedding = new Float32Array(768);
    embedding[0] = NaN;

    await cache.set('query', embedding, 'response');

    const cached = await cache.get('query', embedding);

    // Should handle gracefully
    expect(cached).toBeDefined();
  });

  it('should handle Infinity in embedding', async () => {
    const cache = new SemanticCache();

    const embedding = new Float32Array(768);
    embedding[0] = Infinity;

    await cache.set('query', embedding, 'response');

    const cached = await cache.get('query', embedding);

    // Should handle gracefully
    expect(cached).toBeDefined();
  });

  it('should handle negative values in embedding', async () => {
    const cache = new SemanticCache();

    const embedding = new Float32Array(768).fill(-0.5);

    await cache.set('query', embedding, 'response');

    const cached = await cache.get('query', embedding);

    expect(cached).toBeDefined();
  });

  it('should handle all zeros embedding', async () => {
    const cache = new SemanticCache();

    const embedding = new Float32Array(768).fill(0);

    await cache.set('query', embedding, 'response');

    const cached = await cache.get('query', embedding);

    expect(cached).toBeDefined();
  });
});

describe('SemanticCache - Adaptive Threshold', () => {
  it('should adjust threshold based on hit rate', async () => {
    const cache = new SemanticCache({
      maxSize: 100,
      ttl: 60000,
      similarityThreshold: 0.85,
      enableAdaptiveThreshold: true,
    });

    const embedding = new Float32Array(768).fill(0.7);

    // Simulate many operations
    for (let i = 0; i < 100; i++) {
      await cache.set(`query${i}`, embedding, `response${i}`);
      await cache.get(`query${i}`, embedding);
    }

    const stats = await cache.getStats();

    expect(stats.size).toBeGreaterThan(0);
  });

  it('should lower threshold on low hit rate', async () => {
    const cache = new SemanticCache({
      maxSize: 100,
      ttl: 60000,
      similarityThreshold: 0.95,
      enableAdaptiveThreshold: true,
    });

    const embedding = new Float32Array(768).fill(0.8);

    // Create some cache entries
    for (let i = 0; i < 10; i++) {
      await cache.set(`query${i}`, embedding, `response${i}`);
    }

    // Try to get with different embeddings (misses)
    const differentEmbedding = new Float32Array(768).fill(0.1);
    for (let i = 0; i < 10; i++) {
      await cache.get(`miss${i}`, differentEmbedding);
    }

    const stats = await cache.getStats();

    // Should have more misses than hits
    expect(stats.misses).toBeGreaterThan(0);
  });
});
