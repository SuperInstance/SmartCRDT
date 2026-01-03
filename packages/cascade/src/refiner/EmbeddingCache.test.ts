/**
 * EmbeddingCache tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EmbeddingCache,
  DEFAULT_EMBEDDING_CACHE_CONFIG,
} from "./EmbeddingCache.js";

describe("EmbeddingCache", () => {
  let cache: EmbeddingCache;

  beforeEach(() => {
    cache = new EmbeddingCache();
  });

  describe("Basic Operations", () => {
    it("should store and retrieve embeddings", () => {
      const text = "test query";
      const embedding = new Float32Array([1, 2, 3, 4, 5]);

      cache.set(text, embedding);
      const retrieved = cache.get(text);

      expect(retrieved).toBeDefined();
      expect(retrieved).toBeInstanceOf(Float32Array);
      expect(Array.from(retrieved!)).toEqual([1, 2, 3, 4, 5]);
    });

    it("should return undefined for cache misses", () => {
      const retrieved = cache.get("non-existent");
      expect(retrieved).toBeUndefined();
    });

    it("should handle multiple entries", () => {
      cache.set("query1", new Float32Array([1, 2, 3]));
      cache.set("query2", new Float32Array([4, 5, 6]));
      cache.set("query3", new Float32Array([7, 8, 9]));

      expect(cache.get("query1")).toEqual(new Float32Array([1, 2, 3]));
      expect(cache.get("query2")).toEqual(new Float32Array([4, 5, 6]));
      expect(cache.get("query3")).toEqual(new Float32Array([7, 8, 9]));
    });
  });

  describe("LRU Eviction", () => {
    it("should evict LRU entry when max size is reached", () => {
      const smallCache = new EmbeddingCache({ maxSize: 3 });

      smallCache.set("query1", new Float32Array([1]));
      smallCache.set("query2", new Float32Array([2]));
      smallCache.set("query3", new Float32Array([3]));

      // Access query1 to make it more recent than query2
      smallCache.get("query1");

      // Add fourth entry - should evict query2
      smallCache.set("query4", new Float32Array([4]));

      expect(smallCache.get("query1")).toBeDefined();
      expect(smallCache.get("query2")).toBeUndefined(); // Evicted
      expect(smallCache.get("query3")).toBeDefined();
      expect(smallCache.get("query4")).toBeDefined();
    });

    it("should update LRU on cache hit", () => {
      const smallCache = new EmbeddingCache({ maxSize: 3 });

      smallCache.set("query1", new Float32Array([1]));
      smallCache.set("query2", new Float32Array([2]));
      smallCache.set("query3", new Float32Array([3]));

      // Access query1 to make it most recent
      smallCache.get("query1");

      // Add query2 again (no-op as it exists)
      smallCache.set("query2", new Float32Array([2]));

      // Add fourth entry - should evict query3
      smallCache.set("query4", new Float32Array([4]));

      expect(smallCache.get("query1")).toBeDefined();
      expect(smallCache.get("query2")).toBeDefined();
      expect(smallCache.get("query3")).toBeUndefined(); // Evicted
      expect(smallCache.get("query4")).toBeDefined();
    });
  });

  describe("TTL Expiration", () => {
    it("should expire entries after TTL", async () => {
      const shortTTL = 100; // 100ms
      const cacheWithTTL = new EmbeddingCache({ ttl: shortTTL });

      cacheWithTTL.set("query", new Float32Array([1, 2, 3]));

      // Should be available immediately
      expect(cacheWithTTL.get("query")).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      expect(cacheWithTTL.get("query")).toBeUndefined();
    });

    it("should prune expired entries", async () => {
      const shortTTL = 100;
      const cacheWithTTL = new EmbeddingCache({ ttl: shortTTL });

      cacheWithTTL.set("query1", new Float32Array([1]));
      cacheWithTTL.set("query2", new Float32Array([2]));

      await new Promise(resolve => setTimeout(resolve, 150));

      const pruned = cacheWithTTL.prune();
      expect(pruned).toBe(2);
      expect(cacheWithTTL.size()).toBe(0);
    });

    it("should not expire entries before TTL", async () => {
      const longTTL = 5000;
      const cacheWithTTL = new EmbeddingCache({ ttl: longTTL });

      cacheWithTTL.set("query", new Float32Array([1, 2, 3]));

      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still be available
      expect(cacheWithTTL.get("query")).toBeDefined();
    });
  });

  describe("Cache Statistics", () => {
    it("should track cache hits and misses", () => {
      cache.set("query1", new Float32Array([1]));
      cache.set("query2", new Float32Array([2]));

      cache.get("query1"); // hit
      cache.get("query2"); // hit
      cache.get("query3"); // miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it("should track evictions", () => {
      const smallCache = new EmbeddingCache({ maxSize: 2 });

      smallCache.set("query1", new Float32Array([1]));
      smallCache.set("query2", new Float32Array([2]));
      smallCache.set("query3", new Float32Array([3])); // Evicts query1

      const stats = smallCache.getStats();

      expect(stats.evictions).toBe(1);
    });

    it("should return zero stats for empty cache", () => {
      const stats = cache.getStats();

      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  describe("Batch Operations", () => {
    it("should get multiple embeddings", () => {
      cache.set("query1", new Float32Array([1]));
      cache.set("query2", new Float32Array([2]));
      cache.set("query3", new Float32Array([3]));

      const results = cache.getBatch(["query1", "query2", "query3", "query4"]);

      expect(results[0]).toEqual(new Float32Array([1]));
      expect(results[1]).toEqual(new Float32Array([2]));
      expect(results[2]).toEqual(new Float32Array([3]));
      expect(results[3]).toBeUndefined();
    });

    it("should set multiple embeddings", () => {
      const entries: Array<[string, Float32Array]> = [
        ["query1", new Float32Array([1])],
        ["query2", new Float32Array([2])],
        ["query3", new Float32Array([3])],
      ];

      cache.setBatch(entries);

      expect(cache.get("query1")).toEqual(new Float32Array([1]));
      expect(cache.get("query2")).toEqual(new Float32Array([2]));
      expect(cache.get("query3")).toEqual(new Float32Array([3]));
    });
  });

  describe("Utility Methods", () => {
    it("should clear all entries", () => {
      cache.set("query1", new Float32Array([1]));
      cache.set("query2", new Float32Array([2]));

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get("query1")).toBeUndefined();
      expect(cache.get("query2")).toBeUndefined();
    });

    it("should check if key exists", () => {
      cache.set("query", new Float32Array([1]));

      expect(cache.has("query")).toBe(true);
      expect(cache.has("non-existent")).toBe(false);
    });

    it("should delete specific entry", () => {
      cache.set("query1", new Float32Array([1]));
      cache.set("query2", new Float32Array([2]));

      const deleted = cache.delete("query1");

      expect(deleted).toBe(true);
      expect(cache.has("query1")).toBe(false);
      expect(cache.has("query2")).toBe(true);
    });

    it("should return cache size", () => {
      expect(cache.size()).toBe(0);

      cache.set("query1", new Float32Array([1]));
      expect(cache.size()).toBe(1);

      cache.set("query2", new Float32Array([2]));
      expect(cache.size()).toBe(2);
    });
  });

  describe("Default Configuration", () => {
    it("should use default configuration", () => {
      const defaultCache = new EmbeddingCache(DEFAULT_EMBEDDING_CACHE_CONFIG);

      expect(defaultCache).toBeInstanceOf(EmbeddingCache);
      expect(defaultCache.size()).toBe(0);
    });
  });
});
