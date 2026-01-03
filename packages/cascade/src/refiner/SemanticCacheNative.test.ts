/**
 * SemanticCacheNative Integration Tests
 *
 * Tests for the native Rust implementation of semantic cache.
 * Verifies correctness and measures performance improvements.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { SemanticCacheNative, isNativeAvailable } from "./SemanticCacheNative.js";
import type { RefinedQuery } from "../types.js";

describe("SemanticCacheNative", () => {
  let cache: SemanticCacheNative;

  beforeAll(() => {
    cache = new SemanticCacheNative({
      max_size: 100,
      similarity_threshold: 0.85,
      ttl_ms: 3600000,
      num_threads: 0,
    });
  });

  describe("Native Module Availability", () => {
    it("should detect native module availability", () => {
      const available = isNativeAvailable();
      console.log(`[Test] Native module available: ${available}`);

      if (available) {
        expect(cache.isUsingNative()).toBe(true);
      } else {
        console.warn("[Test] ⚠️  Native module not available, testing fallback behavior");
        expect(cache.isUsingNative()).toBe(false);
      }
    });
  });

  describe("Basic Cache Operations", () => {
    it("should set and get cache entries", async () => {
      const query: RefinedQuery = {
        original: "How do I optimize TypeScript?",
        cacheKey: "test_key_1",
        staticFeatures: {
          queryType: "question",
          complexity: 0.7,
          urgency: 0.5,
          specificity: 0.6,
          hasCode: false,
          questionMark: true,
          exclamationMark: false,
          wordCount: 5,
        },
        semanticFeatures: {
          embedding: [1.0, 0.0, 0.0, 0.0],
          complexity: 0.7,
          confidence: 1.0,
        },
      };

      await cache.set(query, { answer: "Use TypeScript strict mode" });

      const result = await cache.get(query);

      if (cache.isUsingNative()) {
        expect(result.found).toBe(true);
        if (result.found) {
          expect(result.similarity).toBe(1.0);
          expect(result.result).toEqual({
            answer: "Use TypeScript strict mode",
          });
        }
      } else {
        // Fallback behavior when native is not available
        expect(result.found).toBe(false);
      }
    });

    it("should find semantically similar queries", async () => {
      const query1: RefinedQuery = {
        original: "TypeScript optimization tips",
        cacheKey: "test_key_2",
        staticFeatures: {
          queryType: "question",
          complexity: 0.6,
          urgency: 0.5,
          specificity: 0.6,
          hasCode: false,
          questionMark: false,
          exclamationMark: false,
          wordCount: 3,
        },
        semanticFeatures: {
          embedding: [0.95, 0.1, 0.0, 0.0], // Similar to [1.0, 0.0, 0.0, 0.0]
          complexity: 0.6,
          confidence: 1.0,
        },
      };

      await cache.set(query1, { answer: "Use strict mode and enable noImplicitAny" });

      // Query with slightly different embedding
      const similar = await cache.findSimilar([1.0, 0.0, 0.0, 0.0], 0.85);

      if (cache.isUsingNative()) {
        expect(similar.length).toBeGreaterThan(0);
        expect(similar[0].similarity).toBeGreaterThan(0.85);
      } else {
        expect(similar.length).toBe(0);
      }
    });

    it("should respect cache size limits", async () => {
      const smallCache = new SemanticCacheNative({
        max_size: 3,
        similarity_threshold: 0.85,
        ttl_ms: 0,
        num_threads: 0,
      });

      // Add 5 entries (should evict 2)
      for (let i = 0; i < 5; i++) {
        const query: RefinedQuery = {
          original: `Query ${i}`,
          cacheKey: `limit_test_${i}`,
          staticFeatures: {
            queryType: "question",
            complexity: 0.5,
            urgency: 0.5,
            specificity: 0.5,
            hasCode: false,
            questionMark: false,
            exclamationMark: false,
            wordCount: 2,
          },
          semanticFeatures: {
            embedding: [i * 0.1, 0.0, 0.0, 0.0],
            complexity: 0.5,
            confidence: 1.0,
          },
        };

        await smallCache.set(query, { result: i });
      }

      // Should have at most 3 entries
      expect(smallCache.size()).toBeLessThanOrEqual(3);
    });
  });

  describe("Cache Management", () => {
    it("should clear all cache entries", async () => {
      const query: RefinedQuery = {
        original: "Test query",
        cacheKey: "clear_test",
        staticFeatures: {
          queryType: "question",
          complexity: 0.5,
          urgency: 0.5,
          specificity: 0.5,
          hasCode: false,
          questionMark: false,
          exclamationMark: false,
          wordCount: 2,
        },
        semanticFeatures: {
          embedding: [0.5, 0.5, 0.5, 0.5],
          complexity: 0.5,
          confidence: 1.0,
        },
      };

      await cache.set(query, { result: "test" });
      expect(cache.size()).toBeGreaterThan(0);

      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it("should delete specific entries", async () => {
      const query: RefinedQuery = {
        original: "Delete test",
        cacheKey: "delete_test_key",
        staticFeatures: {
          queryType: "question",
          complexity: 0.5,
          urgency: 0.5,
          specificity: 0.5,
          hasCode: false,
          questionMark: false,
          exclamationMark: false,
          wordCount: 2,
        },
        semanticFeatures: {
          embedding: [0.3, 0.3, 0.3, 0.3],
          complexity: 0.5,
          confidence: 1.0,
        },
      };

      await cache.set(query, { result: "delete me" });
      expect(cache.has("delete_test_key")).toBe(true);

      const deleted = cache.delete("delete_test_key");
      expect(deleted).toBe(true);
      expect(cache.has("delete_test_key")).toBe(false);
    });

    it("should get all cache keys", async () => {
      cache.clear();

      const keys = ["key1", "key2", "key3"];
      for (const key of keys) {
        const query: RefinedQuery = {
          original: `Query for ${key}`,
          cacheKey: key,
          staticFeatures: {
            queryType: "question",
            complexity: 0.5,
            urgency: 0.5,
            specificity: 0.5,
            hasCode: false,
            questionMark: false,
            exclamationMark: false,
            wordCount: 4,
          },
          semanticFeatures: {
            embedding: [Math.random(), Math.random(), Math.random(), Math.random()],
            complexity: 0.5,
            confidence: 1.0,
          },
        };

        await cache.set(query, { result: key });
      }

      const cacheKeys = cache.keys();
      if (cache.isUsingNative()) {
        expect(cacheKeys.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe("Similarity Threshold", () => {
    it("should only return results above similarity threshold", async () => {
      cache.clear();

      // Add entries with different similarities
      const embeddings = [
        [1.0, 0.0, 0.0, 0.0], // Exact match to query
        [0.9, 0.1, 0.0, 0.0], // Very similar
        [0.7, 0.3, 0.0, 0.0], // Below threshold
        [0.0, 1.0, 0.0, 0.0], // Dissimilar
      ];

      for (let i = 0; i < embeddings.length; i++) {
        const query: RefinedQuery = {
          original: `Query ${i}`,
          cacheKey: `threshold_test_${i}`,
          staticFeatures: {
            queryType: "question",
            complexity: 0.5,
            urgency: 0.5,
            specificity: 0.5,
            hasCode: false,
            questionMark: false,
            exclamationMark: false,
            wordCount: 2,
          },
          semanticFeatures: {
            embedding: embeddings[i],
            complexity: 0.5,
            confidence: 1.0,
          },
        };

        await cache.set(query, { result: i });
      }

      // Query with [1.0, 0.0, 0.0, 0.0]
      const similar = await cache.findSimilar([1.0, 0.0, 0.0, 0.0], 0.85);

      if (cache.isUsingNative()) {
        // Should only return results with similarity >= 0.85
        for (const result of similar) {
          expect(result.similarity).toBeGreaterThanOrEqual(0.85);
        }
      }
    });
  });

  describe("Performance", () => {
    it("should perform similarity search quickly", async () => {
      cache.clear();

      // Add 1000 entries
      const numEntries = 1000;
      for (let i = 0; i < numEntries; i++) {
        const query: RefinedQuery = {
          original: `Query ${i}`,
          cacheKey: `perf_test_${i}`,
          staticFeatures: {
            queryType: "question",
            complexity: 0.5,
            urgency: 0.5,
            specificity: 0.5,
            hasCode: false,
            questionMark: false,
            exclamationMark: false,
            wordCount: 2,
          },
          semanticFeatures: {
            embedding: [
              Math.random(),
              Math.random(),
              Math.random(),
              Math.random(),
            ],
            complexity: 0.5,
            confidence: 1.0,
          },
        };

        await cache.set(query, { result: i });
      }

      // Measure search time
      const start = performance.now();
      await cache.findSimilar([0.5, 0.5, 0.5, 0.5], 0.7);
      const end = performance.now();

      const elapsedMs = end - start;

      console.log(`[Performance] Similarity search over ${numEntries} entries: ${elapsedMs.toFixed(3)}ms`);

      if (cache.isUsingNative()) {
        // Native implementation should be fast (< 50ms for 1000 entries)
        expect(elapsedMs).toBeLessThan(50);
      }
    });

    it("should handle concurrent operations efficiently", async () => {
      cache.clear();

      const numOps = 100;
      const operations = [];

      for (let i = 0; i < numOps; i++) {
        const query: RefinedQuery = {
          original: `Concurrent query ${i}`,
          cacheKey: `concurrent_${i}`,
          staticFeatures: {
            queryType: "question",
            complexity: 0.5,
            urgency: 0.5,
            specificity: 0.5,
            hasCode: false,
            questionMark: false,
            exclamationMark: false,
            wordCount: 3,
          },
          semanticFeatures: {
            embedding: [i * 0.01, 0.0, 0.0, 0.0],
            complexity: 0.5,
            confidence: 1.0,
          },
        };

        operations.push(cache.set(query, { result: i }));
      }

      const start = performance.now();
      await Promise.all(operations);
      const end = performance.now();

      const elapsedMs = end - start;
      console.log(`[Performance] ${numOps} concurrent sets: ${elapsedMs.toFixed(3)}ms`);

      if (cache.isUsingNative()) {
        // All operations should complete quickly
        expect(elapsedMs).toBeLessThan(100);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty cache", async () => {
      cache.clear();

      const result = await cache.get({
        original: "Test",
        cacheKey: "empty_test",
        staticFeatures: {
          queryType: "question",
          complexity: 0.5,
          urgency: 0.5,
          specificity: 0.5,
          hasCode: false,
          questionMark: false,
          exclamationMark: false,
          wordCount: 1,
        },
        semanticFeatures: {
          embedding: [0.5, 0.5, 0.5, 0.5],
          complexity: 0.5,
          confidence: 1.0,
        },
      });

      expect(result.found).toBe(false);
    });

    it("should handle queries without semantic features", async () => {
      const result = await cache.get({
        original: "No semantic features",
        cacheKey: "no_semantic",
        staticFeatures: {
          queryType: "question",
          complexity: 0.5,
          urgency: 0.5,
          specificity: 0.5,
          hasCode: false,
          questionMark: false,
          exclamationMark: false,
          wordCount: 3,
        },
        semanticFeatures: undefined, // No semantic features
      });

      expect(result.found).toBe(false);
      expect(result.similarQueries).toEqual([]);
    });
  });
});
