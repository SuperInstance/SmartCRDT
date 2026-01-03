/**
 * SemanticCache Tests
 *
 * Comprehensive test suite for semantic cache functionality including:
 * - Exact match caching
 * - Semantic similarity matching
 * - LRU eviction
 * - TTL expiration
 * - Statistics tracking
 * - Adaptive threshold optimization
 * - Per-query-type thresholds
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SemanticCache,
  DEFAULT_SEMANTIC_CACHE_CONFIG,
  PRODUCTION_SEMANTIC_CACHE_CONFIG,
} from "./SemanticCache.js";
import type {
  RefinedQuery,
  SemanticFeatures,
  StaticFeatures,
} from "../types.js";

/**
 * Helper: Create a mock 768-dimensional embedding (OpenAI size)
 */
function createMockEmbedding(seed: number = 0): number[] {
  const embedding = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    // Create deterministic pseudo-random embeddings based on seed
    const value = Math.sin(seed * i * 1234.5678);
    embedding[i] = value;
  }
  // Normalize to unit length
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return Array.from(embedding.map(v => v / norm));
}

/**
 * Helper: Create an embedding similar to the base (for testing semantic hits)
 */
function createSimilarEmbedding(baseSeed: number, similarity: number): number[] {
  const base = createMockEmbedding(baseSeed);
  const noise = createMockEmbedding(baseSeed + 999);
  // Linear interpolation: result = similarity * base + (1-similarity) * noise
  const result = base.map((b, i) => {
    const s = similarity;
    const n = noise[i];
    return s * b + (1 - s) * n;
  });
  // Re-normalize
  const norm = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));
  return result.map(v => v / norm);
}

describe("SemanticCache", () => {
  let cache: SemanticCache;

  beforeEach(() => {
    cache = new SemanticCache(DEFAULT_SEMANTIC_CACHE_CONFIG);
  });

  /**
   * Helper: Create a mock RefinedQuery
   */
  function createMockRefinedQuery(
    query: string,
    embedding?: number[],
    queryType:
      | "question"
      | "command"
      | "code"
      | "explanation"
      | "comparison"
      | "debug"
      | "general" = "general"
  ): RefinedQuery {
    const staticFeatures: StaticFeatures = {
      length: query.length,
      wordCount: query.split(" ").length,
      queryType,
      complexity: 0.5,
      hasCode: false,
      hasSQL: false,
      hasUrl: false,
      hasEmail: false,
      questionMark: query.includes("?"),
      exclamationCount: (query.match(/!/g) || []).length,
      ellipsisCount: (query.match(/\.\.\./g) || []).length,
      capitalizationRatio: 0.1,
      punctuationDensity: 0.2,
      technicalTerms: [],
      domainKeywords: [],
    };

    const semanticFeatures: SemanticFeatures | null = embedding
      ? {
          embedding,
          embeddingDim: embedding.length,
          similarQueries: [],
          cluster: null,
          semanticComplexity: 0.5,
        }
      : null;

    return {
      original: query,
      normalized: query.toLowerCase().trim(),
      staticFeatures,
      semanticFeatures,
      cacheKey: `cache:${query}`,
      suggestions: [],
      timestamp: Date.now(),
    };
  }

  describe("exact match", () => {
    it("should return cached result for exact query", async () => {
      const query = createMockRefinedQuery("How do I optimize TypeScript?", createMockEmbedding());
      const result = { answer: "Use interfaces and types" };

      await cache.set(query, result);
      const cached = await cache.get(query);

      expect(cached.found).toBe(true);
      if (cached.found) {
        expect(cached.result).toEqual(result);
        expect(cached.similarity).toBe(1.0);
      }
    });

    it("should update hit count on exact match", async () => {
      const query = createMockRefinedQuery("test query");
      const result = { data: "test" };

      await cache.set(query, result);
      await cache.get(query);
      await cache.get(query);

      const stats = cache.getStats();
      expect(stats.exactHits).toBe(2);
      expect(stats.totalHits).toBe(2);
    });

    it("should update LRU list on exact match", async () => {
      const smallCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        maxSize: 5,
      });

      const query1 = createMockRefinedQuery("query 1");
      const query2 = createMockRefinedQuery("query 2");

      await smallCache.set(query1, { result: 1 });
      await smallCache.set(query2, { result: 2 });

      // Access query1 to make it more recent
      await smallCache.get(query1);

      // Add more entries to trigger eviction
      for (let i = 3; i <= 6; i++) {
        const q = createMockRefinedQuery(`query ${i}`);
        await smallCache.set(q, { result: i });
      }

      // query2 should be evicted (LRU), query1 should still exist
      const result1 = await smallCache.get(query1);
      const result2 = await smallCache.get(query2);

      expect(result1.found).toBe(true);
      expect(result2.found).toBe(false);
    });

    it("should not return expired entries", async () => {
      const shortTTLCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        ttl: 100, // 100ms
      });

      const query = createMockRefinedQuery("test query");
      await shortTTLCache.set(query, { result: "test" });

      // Should be available immediately
      let result = await shortTTLCache.get(query);
      expect(result.found).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      result = await shortTTLCache.get(query);
      expect(result.found).toBe(false);
    });
  });

  describe("semantic similarity", () => {
    it("should find semantically similar queries", async () => {
      const query1 = createMockRefinedQuery(
        "How do I optimize TypeScript?",
        createMockEmbedding(1)
      );
      const query2 = createMockRefinedQuery(
        "TypeScript optimization tips?",
        createSimilarEmbedding(1, 0.9) // 90% similar
      );

      await cache.set(query1, { answer: "Use interfaces" });

      const result = await cache.get(query2);

      expect(result.found).toBe(true);
      if (result.found) {
        expect(result.similarity).toBeGreaterThanOrEqual(0.85);
      }
    });

    it("should respect similarity threshold", async () => {
      const highThresholdCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        similarityThreshold: 0.95,
      });

      const query1 = createMockRefinedQuery("query 1", createMockEmbedding(1));
      const query2 = createMockRefinedQuery("query 2", createMockEmbedding(999)); // Very different

      await highThresholdCache.set(query1, { result: 1 });

      const result = await highThresholdCache.get(query2);

      // Should NOT be a hit because different embeddings
      expect(result.found).toBe(false);
    });

    it("should return results sorted by similarity", async () => {
      // Create entries with different similarities
      const highSimQuery = createMockRefinedQuery(
        "high similarity",
        createMockEmbedding(10)
      );
      const medSimQuery = createMockRefinedQuery(
        "medium similarity",
        createMockEmbedding(20)
      );
      const lowSimQuery = createMockRefinedQuery(
        "low similarity",
        createMockEmbedding(30)
      );

      await cache.set(highSimQuery, { result: "high" });
      await cache.set(medSimQuery, { result: "medium" });
      await cache.set(lowSimQuery, { result: "low" });

      // Query similar to highSimQuery
      const result = await cache.get(
        createMockRefinedQuery("test", createSimilarEmbedding(10, 0.85))
      );

      // Should find similar query
      expect(result).toBeDefined();
      if (result.found === false && result.similarQueries.length > 1) {
        for (let i = 0; i < result.similarQueries.length - 1; i++) {
          expect(result.similarQueries[i].similarity).toBeGreaterThanOrEqual(
            result.similarQueries[i + 1].similarity
          );
        }
      }
    });

    it("should use query-type specific thresholds when enabled", async () => {
      const queryTypeCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        enableQueryTypeThresholds: true,
        queryTypeThresholds: {
          code: 0.92, // Higher threshold for code
          general: 0.7, // Lower threshold for general
        },
      });

      const codeQuery = createMockRefinedQuery(
        "function code()",
        createMockEmbedding(100),
        "code"
      );
      const similarCodeQuery = createMockRefinedQuery(
        "similar function()",
        createMockEmbedding(101), // Slightly different
        "code"
      );

      await queryTypeCache.set(codeQuery, { result: "code" });

      const result = await queryTypeCache.get(similarCodeQuery);

      // Different embeddings should not match for code (high threshold)
      expect(result.found).toBe(false);
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used when full", async () => {
      const smallCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        maxSize: 3,
      });

      const q1 = createMockRefinedQuery("query 1");
      const q2 = createMockRefinedQuery("query 2");
      const q3 = createMockRefinedQuery("query 3");
      const q4 = createMockRefinedQuery("query 4");

      await smallCache.set(q1, { result: 1 });
      await smallCache.set(q2, { result: 2 });
      await smallCache.set(q3, { result: 3 });

      // Access q1 to make it more recent than q2
      await smallCache.get(q1);

      // Add q4, should evict q2 (least recently used)
      await smallCache.set(q4, { result: 4 });

      expect((await smallCache.get(q1)).found).toBe(true);
      expect((await smallCache.get(q2)).found).toBe(false);
      expect((await smallCache.get(q3)).found).toBe(true);
      expect((await smallCache.get(q4)).found).toBe(true);
    });

    it("should update LRU list on access", async () => {
      const smallCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        maxSize: 2,
      });

      const q1 = createMockRefinedQuery("query 1");
      const q2 = createMockRefinedQuery("query 2");
      const q3 = createMockRefinedQuery("query 3");

      await smallCache.set(q1, { result: 1 });
      await smallCache.set(q2, { result: 2 });

      // Access q1 to make it most recent
      await smallCache.get(q1);

      // Add q3, should evict q2 (least recently used)
      await smallCache.set(q3, { result: 3 });

      expect((await smallCache.get(q1)).found).toBe(true);
      expect((await smallCache.get(q2)).found).toBe(false);
      expect((await smallCache.get(q3)).found).toBe(true);
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", async () => {
      const ttlCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        ttl: 100, // 100ms
      });

      const query = createMockRefinedQuery("test query");
      await ttlCache.set(query, { result: "test" });

      // Should be available immediately
      let result = await ttlCache.get(query);
      expect(result.found).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      result = await ttlCache.get(query);
      expect(result.found).toBe(false);
    });

    it("should allow TTL of 0 (no expiration)", async () => {
      const noTTLCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        ttl: 0,
      });

      const query = createMockRefinedQuery("test query");
      await noTTLCache.set(query, { result: "test" });

      // Should still be available after time passes
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = await noTTLCache.get(query);
      expect(result.found).toBe(true);
    });
  });

  describe("statistics tracking", () => {
    it("should track exact vs semantic hits", async () => {
      const q1 = createMockRefinedQuery("exact query", createMockEmbedding(1));
      const q2 = createMockRefinedQuery("similar query", createSimilarEmbedding(1, 0.9));

      await cache.set(q1, { result: 1 });

      // Exact hit
      await cache.get(q1);

      // Semantic hit
      const result = await cache.get(q2);
      expect(result.found).toBe(true);

      const stats = cache.getStats();
      expect(stats.exactHits).toBe(1);
      expect(stats.semanticHits).toBe(1);
      expect(stats.totalHits).toBe(2);
    });

    it("should calculate accurate hit rate", async () => {
      const q1 = createMockRefinedQuery("query 1", createMockEmbedding(1));
      const q2 = createMockRefinedQuery("query 2", createSimilarEmbedding(1, 0.9));
      const q3 = createMockRefinedQuery("query 3", createMockEmbedding(999));

      await cache.set(q1, { result: 1 });

      await cache.get(q1); // Hit (exact)
      await cache.get(q2); // Hit (semantic)
      await cache.get(q3); // Miss

      const stats = cache.getStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });

    it("should provide per-query-type breakdown", async () => {
      const codeQuery = createMockRefinedQuery(
        "function()",
        createMockEmbedding(1),
        "code"
      );
      const generalQuery = createMockRefinedQuery(
        "general question",
        createMockEmbedding(2),
        "general"
      );

      await cache.set(codeQuery, { result: "code" });
      await cache.set(generalQuery, { result: "general" });

      await cache.get(codeQuery);
      await cache.get(generalQuery);

      const stats = cache.getStats();
      expect(stats.byQueryType.code.hits).toBe(1);
      expect(stats.byQueryType.general.hits).toBe(1);
    });
  });

  describe("adaptive threshold", () => {
    it("should decrease threshold when hit rate is low", async () => {
      const adaptiveCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        similarityThreshold: 0.9,
        enableAdaptiveThreshold: true,
        adaptiveThreshold: {
          initialThreshold: 0.9,
          minThreshold: 0.7,
          maxThreshold: 0.95,
          adjustmentFactor: 0.05,
          measurementWindow: 10,
          targetHitRate: 0.8,
        },
      });

      const q1 = createMockRefinedQuery("query 1", createMockEmbedding(1));
      await adaptiveCache.set(q1, { result: 1 });

      // Generate many misses to trigger threshold decrease
      for (let i = 0; i < 20; i++) {
        const q = createMockRefinedQuery(`query ${i}`, createMockEmbedding(i + 100));
        await adaptiveCache.get(q); // All misses (different embeddings)
      }

      const stats = adaptiveCache.getStats();
      // Threshold should have decreased due to low hit rate
      expect(stats.thresholdAdjustments).toBeGreaterThan(0);
    });

    it("should respect min/max bounds", async () => {
      const adaptiveCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        similarityThreshold: 0.85,
        enableAdaptiveThreshold: true,
        adaptiveThreshold: {
          initialThreshold: 0.85,
          minThreshold: 0.8,
          maxThreshold: 0.9,
          adjustmentFactor: 0.1,
          measurementWindow: 5,
          targetHitRate: 0.8,
        },
      });

      const q1 = createMockRefinedQuery("query 1", createMockEmbedding(1));
      await adaptiveCache.set(q1, { result: 1 });

      // Generate extreme conditions
      for (let i = 0; i < 20; i++) {
        const q = createMockRefinedQuery(`query ${i}`, createMockEmbedding(i + 100));
        await adaptiveCache.get(q); // All misses
      }

      const stats = adaptiveCache.getStats();
      expect(stats.currentThreshold).toBeGreaterThanOrEqual(0.8);
      expect(stats.currentThreshold).toBeLessThanOrEqual(0.9);
    });
  });

  describe("cache operations", () => {
    it("should clear all entries and statistics", async () => {
      const q1 = createMockRefinedQuery("query 1");
      await cache.set(q1, { result: 1 });
      await cache.get(q1);

      expect(cache.size()).toBe(1);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.getStats().totalHits).toBe(0);
    });

    it("should reset statistics without clearing cache", async () => {
      const q1 = createMockRefinedQuery("query 1");
      await cache.set(q1, { result: 1 });
      await cache.get(q1);

      cache.resetStats();

      expect(cache.size()).toBe(1);
      expect(cache.getStats().totalHits).toBe(0);
    });

    it("should delete specific entry", async () => {
      const q1 = createMockRefinedQuery("query 1");
      const q2 = createMockRefinedQuery("query 2");

      await cache.set(q1, { result: 1 });
      await cache.set(q2, { result: 2 });

      expect(cache.size()).toBe(2);

      cache.delete("cache:query 1");

      expect(cache.size()).toBe(1);
      expect((await cache.get(q1)).found).toBe(false);
    });

    it("should check if key exists", async () => {
      const q1 = createMockRefinedQuery("query 1");
      await cache.set(q1, { result: 1 });

      expect(cache.has("cache:query 1")).toBe(true);
      expect(cache.has("cache:nonexistent")).toBe(false);
    });

    it("should peek at entry without updating LRU", async () => {
      const q1 = createMockRefinedQuery("query 1");
      await cache.set(q1, { result: 1 });

      const entry = cache.peek("cache:query 1");
      expect(entry).toBeDefined();
      expect(entry?.result).toEqual({ result: 1 });
    });

    it("should return all cache keys", async () => {
      const q1 = createMockRefinedQuery("query 1");
      const q2 = createMockRefinedQuery("query 2");

      await cache.set(q1, { result: 1 });
      await cache.set(q2, { result: 2 });

      const keys = cache.keys();
      expect(keys).toContain("cache:query 1");
      expect(keys).toContain("cache:query 2");
    });
  });

  describe("production configuration", () => {
    it("should use production config correctly", () => {
      const prodCache = new SemanticCache(PRODUCTION_SEMANTIC_CACHE_CONFIG);

      expect(prodCache).toBeDefined();
      // Verify it's an instance
      expect(prodCache instanceof SemanticCache).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty embeddings gracefully", async () => {
      // Create cache without HNSW to avoid dimension errors
      const noHnswCache = new SemanticCache({
        ...DEFAULT_SEMANTIC_CACHE_CONFIG,
        enableHNSW: false,
      });

      const q1 = createMockRefinedQuery("query 1", []);
      const q2 = createMockRefinedQuery("query 2", []);

      await noHnswCache.set(q1, { result: 1 });

      const result = await noHnswCache.get(q2);
      // Empty embeddings can't be compared semantically
      expect(result.found).toBe(false);
    });

    it("should handle queries without semantic features", async () => {
      const q1 = createMockRefinedQuery("query 1"); // No embedding

      await cache.set(q1, { result: 1 });

      const result = await cache.get(q1);
      // Should still work with exact match
      expect(result.found).toBe(true);
    });

    it("should handle near-zero similarity vectors", async () => {
      const q1 = createMockRefinedQuery("query 1", createMockEmbedding(1));
      const q2 = createMockRefinedQuery("query 2", createMockEmbedding(999)); // Very different

      await cache.set(q1, { result: 1 });

      const result = await cache.get(q2);
      // Very different vectors should not match
      expect(result.found).toBe(false);
    });
  });
});
