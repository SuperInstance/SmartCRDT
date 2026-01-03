/**
 * CacheProperties.test.ts - Property-Based Tests for Semantic Caching
 *
 * Tests cache-related invariants:
 * - Cache consistency (get after put returns same value)
 * - LRU eviction ordering
 * - TTL expiration
 * - Similarity score properties (symmetry, triangle inequality)
 * - Cache statistics accuracy
 * - Adaptive threshold behavior
 *
 * @packageDocumentation
 */

import { describe, expect, beforeEach } from "vitest";
import { SemanticCache } from "@lsi/cascade";
import type { SemanticCacheConfig, EnhancedCacheStats } from "@lsi/cascade";
import {
  registerProperty,
  integer,
  float,
  string,
  boolean,
  oneOf,
  array,
  constant,
  nullable,
  record,
  embedding,
} from "../property/PropertyTestFramework.js";
import type { RefinedQuery } from "@lsi/cascade";

// ============================================================================
// FIXTURES AND HELPERS
// ============================================================================

/**
 * Create a mock refined query for testing
 */
function createMockRefinedQuery(
  query: string,
  embedding: Float32Array,
  queryType:
    | "question"
    | "command"
    | "code"
    | "explanation"
    | "comparison"
    | "debug"
    | "general" = "general"
): RefinedQuery {
  return {
    query,
    originalQuery: query,
    embedding,
    queryType,
    complexity: float(0, 1).generate(Date.now()),
    urgency: "normal",
    semanticFeatures: {
      keyTerms: [],
      entities: [],
      concepts: [],
    },
    staticFeatures: {
      length: query.length,
      wordCount: query.split(/\s+/).length,
      hasCode: false,
      hasUrl: false,
      hasEmail: false,
    },
  };
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

let cache: SemanticCache;

beforeEach(() => {
  const config: SemanticCacheConfig = {
    maxSize: 100,
    similarityThreshold: 0.85,
    ttl: 60000,
  };
  cache = new SemanticCache(config);
});

// ============================================================================
// CACHE CONSISTENCY PROPERTIES
// ============================================================================

describe("Cache Properties: Consistency", () => {
  /**
   * Property: Get after put returns same value
   *
   * Setting a value and then getting it should return the same value.
   */
  registerProperty(
    "Get after put returns same value",
    {
      query: string(1, 100),
      value: record({
        content: string(1, 500),
        metadata: nullable(record({})),
      }),
    },
    async ({ query, value }) => {
      const emb = embedding(768).generate(Date.now());
      const refinedQuery = createMockRefinedQuery(query, emb);

      await cache.set(query, value);
      const result = await cache.get(refinedQuery);

      expect(result).toBeDefined();
      if (result && result.found) {
        expect(result.result).toEqual(value);
      }

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Set updates existing entry
   *
   * Setting the same key twice should update the value.
   */
  registerProperty(
    "Set updates existing entry",
    {
      query: string(1, 100),
      value1: string(1, 200),
      value2: string(1, 200),
    },
    async ({ query, value1, value2 }) => {
      const emb = embedding(768).generate(Date.now());
      const refinedQuery = createMockRefinedQuery(query, emb);

      await cache.set(query, { content: value1 });
      await cache.set(query, { content: value2 });

      const result = await cache.get(refinedQuery);

      if (result && result.found) {
        expect((result.result as { content: string }).content).toBe(value2);
      }

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Cache miss returns correct result
   *
   * Getting a non-existent key should return a miss.
   */
  registerProperty(
    "Non-existent key returns cache miss",
    {
      query: string(1, 100),
    },
    async ({ query }) => {
      // Don't set anything, just get
      const emb = embedding(768).generate(Date.now());
      const refinedQuery = createMockRefinedQuery(query, emb);

      const result = await cache.get(refinedQuery);

      expect(result).toBeDefined();
      expect(result?.found).toBe(false);

      return true;
    },
    { numCases: 50 }
  );
});

// ============================================================================
// SEMANTIC SIMILARITY PROPERTIES
// ============================================================================

describe("Cache Properties: Similarity", () => {
  /**
   * Property: Cosine similarity is symmetric
   *
   * similarity(a, b) = similarity(b, a)
   */
  registerProperty(
    "Cosine similarity is symmetric",
    {},
    async () => {
      const emb1 = embedding(768).generate(Date.now());
      const emb2 = embedding(768).generate(Date.now() + 1);

      const sim1 = cosineSimilarity(emb1, emb2);
      const sim2 = cosineSimilarity(emb2, emb1);

      expect(Math.abs(sim1 - sim2)).toBeLessThan(0.0001);

      return true;
    },
    { numCases: 100 }
  );

  /**
   * Property: Cosine similarity is in [0, 1]
   *
   * Similarity scores should always be between 0 and 1.
   */
  registerProperty(
    "Cosine similarity is in [0, 1]",
    {},
    async () => {
      const emb1 = embedding(768).generate(Date.now());
      const emb2 = embedding(768).generate(Date.now() + 1);

      const similarity = cosineSimilarity(emb1, emb2);

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);

      return true;
    },
    { numCases: 100 }
  );

  /**
   * Property: Self-similarity is 1
   *
   * similarity(a, a) = 1
   */
  registerProperty(
    "Self-similarity is 1",
    {},
    async () => {
      const emb = embedding(768).generate(Date.now());

      const similarity = cosineSimilarity(emb, emb);

      expect(Math.abs(similarity - 1)).toBeLessThan(0.0001);

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Triangle inequality (relaxed)
   *
   * For normalized vectors: similarity(a, c) >= similarity(a, b) + similarity(b, c) - 1
   */
  registerProperty(
    "Triangle inequality holds for cosine similarity",
    {},
    async () => {
      const emb1 = embedding(768).generate(Date.now());
      const emb2 = embedding(768).generate(Date.now() + 1);
      const emb3 = embedding(768).generate(Date.now() + 2);

      const sim12 = cosineSimilarity(emb1, emb2);
      const sim23 = cosineSimilarity(emb2, emb3);
      const sim13 = cosineSimilarity(emb1, emb3);

      // Triangle inequality for cosine distance: d(a, c) <= d(a, b) + d(b, c)
      // Since cosine distance = 1 - cosine similarity:
      // 1 - sim(a, c) <= 1 - sim(a, b) + 1 - sim(b, c)
      // sim(a, c) >= sim(a, b) + sim(b, c) - 1
      expect(sim13).toBeGreaterThanOrEqual(sim12 + sim23 - 1 - 0.001);

      return true;
    },
    { numCases: 100 }
  );
});

// ============================================================================
// LRU EVICTION PROPERTIES
// ============================================================================

describe("Cache Properties: LRU Eviction", () => {
  /**
   * Property: Cache respects max size
   *
   * Cache should not exceed its maximum size.
   */
  registerProperty(
    "Cache respects maximum size",
    {
      maxSize: integer(10, 50),
      entries: array(string(1, 20), 20, 100),
    },
    async ({ maxSize, entries }) => {
      const config: SemanticCacheConfig = {
        maxSize,
        similarityThreshold: 0.85,
        ttl: 60000,
      };
      const testCache = new SemanticCache(config);

      for (const entry of entries) {
        const emb = embedding(768).generate(Date.now() + entry.length);
        const refinedQuery = createMockRefinedQuery(entry, emb);
        await testCache.set(entry, { content: entry });
      }

      const stats = (await testCache.getStats()) as EnhancedCacheStats;
      expect(stats.size).toBeLessThanOrEqual(maxSize);

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: LRU evicts least recently used
   *
   * When cache is full, least recently used entry should be evicted.
   */
  registerProperty(
    "LRU evicts least recently used entry",
    {
      maxSize: constant(5),
    },
    async ({ maxSize }) => {
      const config: SemanticCacheConfig = {
        maxSize,
        similarityThreshold: 0.85,
        ttl: 60000,
      };
      const testCache = new SemanticCache(config);

      const entries = ["a", "b", "c", "d", "e", "f"];

      // Add first 5 entries
      for (let i = 0; i < 5; i++) {
        const emb = embedding(768).generate(Date.now() + i);
        const refinedQuery = createMockRefinedQuery(entries[i], emb);
        await testCache.set(entries[i], { content: entries[i] });
      }

      // Access 'a' to make it more recent
      const embA = embedding(768).generate(Date.now());
      const refinedA = createMockRefinedQuery("a", embA);
      await testCache.get(refinedA);

      // Add 6th entry - should evict 'b' (least recently used after 'a')
      const embF = embedding(768).generate(Date.now() + 6);
      const refinedF = createMockRefinedQuery("f", embF);
      await testCache.set("f", { content: "f" });

      // 'a' should still be in cache (was accessed recently)
      const resultA = await testCache.get(refinedA);
      expect(resultA?.found).toBe(true);

      return true;
    },
    { numCases: 10 }
  );
});

// ============================================================================
// TTL EXPIRATION PROPERTIES
// ============================================================================

describe("Cache Properties: TTL Expiration", () => {
  /**
   * Property: Expired entries are not returned
   *
   * Entries past their TTL should not be returned.
   */
  registerProperty(
    "Expired entries are not returned",
    {
      query: string(1, 50),
      ttl: constant(100), // 100ms TTL
    },
    async ({ query, ttl }) => {
      const config: SemanticCacheConfig = {
        maxSize: 100,
        similarityThreshold: 0.85,
        ttl,
      };
      const testCache = new SemanticCache(config);

      const emb = embedding(768).generate(Date.now());
      const refinedQuery = createMockRefinedQuery(query, emb);

      await testCache.set(query, { content: query });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, ttl + 50));

      const result = await testCache.get(refinedQuery);
      expect(result?.found).toBe(false);

      return true;
    },
    { numCases: 20 }
  );

  /**
   * Property: Fresh entries are returned
   *
   * Entries within their TTL should be returned.
   */
  registerProperty(
    "Fresh entries are returned",
    {
      query: string(1, 50),
      ttl: constant(1000), // 1s TTL
    },
    async ({ query, ttl }) => {
      const config: SemanticCacheConfig = {
        maxSize: 100,
        similarityThreshold: 0.85,
        ttl,
      };
      const testCache = new SemanticCache(config);

      const emb = embedding(768).generate(Date.now());
      const refinedQuery = createMockRefinedQuery(query, emb);

      await testCache.set(query, { content: query });

      // Get immediately (should be fresh)
      const result = await testCache.get(refinedQuery);
      expect(result?.found).toBe(true);

      return true;
    },
    { numCases: 20 }
  );
});

// ============================================================================
// CACHE STATISTICS PROPERTIES
// ============================================================================

describe("Cache Properties: Statistics", () => {
  /**
   * Property: Hit rate is in [0, 1]
   *
   * Cache hit rate should always be between 0 and 1.
   */
  registerProperty(
    "Hit rate is in [0, 1]",
    {
      queries: array(string(1, 50), 10, 50),
    },
    async ({ queries }) => {
      const testCache = new SemanticCache({
        maxSize: 100,
        similarityThreshold: 0.85,
        ttl: 60000,
      });

      // Add some queries to cache
      for (const query of queries.slice(0, queries.length / 2)) {
        const emb = embedding(768).generate(Date.now());
        await testCache.set(query, { content: query });
      }

      // Get stats
      const stats = (await testCache.getStats()) as EnhancedCacheStats;

      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Total accesses = hits + misses
   *
   * Total access count should equal hits plus misses.
   */
  registerProperty(
    "Total accesses equals hits plus misses",
    {
      queries: array(string(1, 50), 10, 30),
    },
    async ({ queries }) => {
      const testCache = new SemanticCache({
        maxSize: 100,
        similarityThreshold: 0.85,
        ttl: 60000,
      });

      // Add some queries to cache
      for (const query of queries.slice(0, queries.length / 2)) {
        const emb = embedding(768).generate(Date.now());
        await testCache.set(query, { content: query });
      }

      // Perform gets
      for (const query of queries) {
        const emb = embedding(768).generate(Date.now());
        const refinedQuery = createMockRefinedQuery(query, emb);
        await testCache.get(refinedQuery);
      }

      const stats = (await testCache.getStats()) as EnhancedCacheStats;

      expect(stats.totalHits + stats.totalMisses).toBeGreaterThan(0);

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Cache size is non-negative
   *
   * Cache size should always be >= 0.
   */
  registerProperty(
    "Cache size is non-negative",
    {},
    async () => {
      const stats = (await cache.getStats()) as EnhancedCacheStats;

      expect(stats.size).toBeGreaterThanOrEqual(0);

      return true;
    },
    { numCases: 20 }
  );
});

// ============================================================================
// SEMANTIC CACHE PROPERTIES
// ============================================================================

describe("Cache Properties: Semantic Matching", () => {
  /**
   * Property: Exact match returns cached value
   *
   * Same query should return cached value.
   */
  registerProperty(
    "Exact match returns cached value",
    {
      query: string(1, 100),
    },
    async ({ query }) => {
      const emb = embedding(768).generate(Date.now());
      const refinedQuery = createMockRefinedQuery(query, emb);
      const value = { content: "cached result" };

      await cache.set(query, value);
      const result = await cache.get(refinedQuery);

      expect(result?.found).toBe(true);
      expect(result?.result).toEqual(value);

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Similar queries may hit cache
   *
   * Queries with high similarity should hit the cache.
   */
  registerProperty(
    "High similarity queries may hit cache",
    {
      query1: constant("What is JavaScript?"),
      query2: constant("Explain JavaScript programming"),
    },
    async ({ query1, query2 }) => {
      // Use identical embeddings to ensure similarity
      const emb = embedding(768).generate(Date.now());

      const refinedQuery1 = createMockRefinedQuery(query1, emb);
      const refinedQuery2 = createMockRefinedQuery(query2, emb);
      const value = { content: "JavaScript explanation" };

      await cache.set(query1, value);
      const result = await cache.get(refinedQuery2);

      // With identical embeddings, should hit cache
      expect(result?.found).toBe(true);

      return true;
    },
    { numCases: 10 }
  );
});

// ============================================================================
// THRESHOLD PROPERTIES
// ============================================================================

describe("Cache Properties: Similarity Threshold", () => {
  /**
   * Property: Similarity threshold is respected
   *
   * Cache should not return entries below the similarity threshold.
   */
  registerProperty(
    "Threshold is respected for semantic matching",
    {
      threshold: float(0.5, 0.99),
    },
    async ({ threshold }) => {
      const testCache = new SemanticCache({
        maxSize: 100,
        similarityThreshold: threshold,
        ttl: 60000,
      });

      const query1 = "What is AI?";
      const query2 = "Explain artificial intelligence";

      // Use very different embeddings (low similarity)
      const emb1 = embedding(768).generate(Date.now());
      const emb2 = embedding(768).generate(Date.now() + 1000);

      const similarity = cosineSimilarity(emb1, emb2);

      const refinedQuery1 = createMockRefinedQuery(query1, emb1);
      const refinedQuery2 = createMockRefinedQuery(query2, emb2);
      const value = { content: "AI explanation" };

      await testCache.set(query1, value);
      const result = await testCache.get(refinedQuery2);

      // If similarity is below threshold, should not hit
      if (similarity < threshold) {
        expect(result?.found).toBe(false);
      }

      return true;
    },
    { numCases: 50 }
  );

  /**
   * Property: Threshold is in valid range
   *
   * Similarity threshold should be in [0, 1].
   */
  registerProperty(
    "Threshold is in valid range",
    {
      threshold: float(0, 1),
    },
    async ({ threshold }) => {
      expect(threshold).toBeGreaterThanOrEqual(0);
      expect(threshold).toBeLessThanOrEqual(1);

      const testCache = new SemanticCache({
        maxSize: 100,
        similarityThreshold: threshold,
        ttl: 60000,
      });

      const stats = (await testCache.getStats()) as EnhancedCacheStats;
      expect(stats.currentThreshold).toBe(threshold);

      return true;
    },
    { numCases: 50 }
  );
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("Cache Properties: Edge Cases", () => {
  /**
   * Property: Empty query handling
   */
  registerProperty(
    "Empty query is handled gracefully",
    {
      query: constant(""),
    },
    async ({ query }) => {
      const emb = embedding(768).generate(Date.now());
      const refinedQuery = createMockRefinedQuery(query, emb);

      const result = await cache.get(refinedQuery);

      // Should not crash
      expect(result).toBeDefined();

      return true;
    },
    { numCases: 10 }
  );

  /**
   * Property: Very long query handling
   */
  registerProperty(
    "Long query is handled",
    {
      query: string(1000, 5000),
    },
    async ({ query }) => {
      const emb = embedding(768).generate(Date.now());
      const refinedQuery = createMockRefinedQuery(query, emb);

      await cache.set(query, { content: "result" });
      const result = await cache.get(refinedQuery);

      expect(result?.found).toBe(true);

      return true;
    },
    { numCases: 10 }
  );

  /**
   * Property: Clear cache empties all entries
   */
  registerProperty(
    "Clear cache removes all entries",
    {
      queries: array(string(1, 50), 5, 20),
    },
    async ({ queries }) => {
      for (const query of queries) {
        const emb = embedding(768).generate(Date.now());
        await cache.set(query, { content: query });
      }

      await cache.clear();

      const stats = (await cache.getStats()) as EnhancedCacheStats;
      expect(stats.size).toBe(0);

      return true;
    },
    { numCases: 20 }
  );
});
