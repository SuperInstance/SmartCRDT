/**
 * CachedEmbeddingService tests
 *
 * Tests for the cached embedding service with HNSW indexing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CachedEmbeddingService,
  type CachedEmbeddingServiceConfig,
  type CachedEmbeddingStats,
} from "./CachedEmbeddingService.js";

// Mock OpenAI API for testing
const mockEmbed = async (text: string): Promise<Float32Array> => {
  // Create deterministic embeddings based on text
  const embedding = new Float32Array(1536);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash;
  }
  for (let i = 0; i < 1536; i++) {
    embedding[i] = ((hash * (i + 1)) % 10000) / 5000 - 1;
  }
  return embedding;
};

describe("CachedEmbeddingService", () => {
  let service: CachedEmbeddingService;

  beforeEach(async () => {
    service = new CachedEmbeddingService({
      model: "text-embedding-3-small",
      dimensions: 1536,
      enableFallback: true, // Use fallback for testing
      cache: {
        maxSize: 100,
        ttl: 60000, // 1 minute for testing
      },
      enableCacheWarming: false, // Disable warming for tests
    });
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe("Basic Operations", () => {
    it("should initialize successfully", async () => {
      const stats = service.getStats();
      expect(stats.cache.size).toBe(0);
      expect(stats.hnsw.size).toBe(0);
    });

    it("should generate and cache embeddings", async () => {
      const text = "test query";
      const result1 = await service.embed(text);
      const result2 = await service.embed(text);

      expect(result1.embedding).toBeInstanceOf(Float32Array);
      expect(result1.embedding.length).toBe(1536);

      // Second call should hit cache
      const stats = service.getStats();
      expect(stats.cache.hits).toBeGreaterThan(0);
      expect(stats.apiCallsSaved).toBeGreaterThan(0);
    });

    it("should handle batch embeddings", async () => {
      const texts = ["query1", "query2", "query3"];
      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.embedding).toBeInstanceOf(Float32Array);
        expect(result.embedding.length).toBe(1536);
      });

      // Check cache hit on second batch
      await service.embedBatch(texts);
      const stats = service.getStats();
      expect(stats.cache.hits).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Caching Behavior", () => {
    it("should track cache statistics", async () => {
      // Generate some embeddings
      await service.embed("test1");
      await service.embed("test2");
      await service.embed("test1"); // Cache hit
      await service.embed("test3");

      const stats = service.getStats();
      expect(stats.cache.size).toBe(3);
      expect(stats.cache.hits).toBeGreaterThanOrEqual(1);
      expect(stats.cache.misses).toBeGreaterThanOrEqual(3);
      expect(stats.overallHitRate).toBeGreaterThan(0);
    });

    it("should evict LRU entries when full", async () => {
      const smallCache = new CachedEmbeddingService({
        cache: { maxSize: 3 },
        enableFallback: true,
        enableCacheWarming: false,
      });
      await smallCache.initialize();

      await smallCache.embed("query1");
      await smallCache.embed("query2");
      await smallCache.embed("query3");
      await smallCache.embed("query4"); // Should evict query1

      const stats = smallCache.getStats();
      expect(stats.cache.size).toBe(3); // Max 3
      expect(stats.cache.evictions).toBe(1);

      await smallCache.shutdown();
    });

    it("should prune expired entries", async () => {
      const shortTTL = new CachedEmbeddingService({
        cache: { ttl: 100, maxSize: 100 },
        enableFallback: true,
        enableCacheWarming: false,
      });
      await shortTTL.initialize();

      await shortTTL.embed("test1");
      await shortTTL.embed("test2");

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const pruned = shortTTL.prune();
      expect(pruned).toBe(2);

      const stats = shortTTL.getStats();
      expect(stats.cache.size).toBe(0);

      await shortTTL.shutdown();
    });
  });

  describe("HNSW Integration", () => {
    it("should maintain HNSW index", async () => {
      await service.embed("test1");
      await service.embed("test2");

      const stats = service.getStats();
      expect(stats.hnsw.size).toBe(2);
      expect(stats.hnsw.numLayers).toBeGreaterThan(0);
    });

    it("should find similar texts", async () => {
      // Add similar texts
      await service.embed("machine learning is great");
      await service.embed("machine learning is awesome");
      await service.embed("computer vision is fun");

      const similar = await service.findSimilar("machine learning", 5, 0.5);

      expect(similar.length).toBeGreaterThan(0);
      similar.forEach(result => {
        expect(result.text).toBeDefined();
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      });
    });

    it("should respect similarity threshold", async () => {
      await service.embed("test query");

      const highThreshold = await service.findSimilar("completely different", 10, 0.99);
      const lowThreshold = await service.findSimilar("completely different", 10, 0.0);

      // High threshold should return fewer results
      expect(highThreshold.length).toBeLessThanOrEqual(lowThreshold.length);
    });

    it("should return results in descending similarity order", async () => {
      await service.embed("test1");
      await service.embed("test2");
      await service.embed("test3");

      const results = await service.findSimilar("test", 3, 0.0);

      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i].similarity).toBeLessThanOrEqual(results[i - 1].similarity);
        }
      }
    });
  });

  describe("Statistics and Metrics", () => {
    it("should track API calls saved", async () => {
      await service.embed("test");
      await service.embed("test"); // Cache hit
      await service.embed("test"); // Cache hit

      const stats = service.getStats();
      expect(stats.apiCallsSaved).toBeGreaterThanOrEqual(2);
      expect(stats.latencySaved).toBeGreaterThan(0);
    });

    it("should estimate latency saved", async () => {
      await service.embed("test1");
      await service.embed("test1"); // Cache hit
      await service.embed("test2");
      await service.embed("test2"); // Cache hit

      const stats = service.getStats();
      // Assuming 200ms per API call
      expect(stats.latencySaved).toBeGreaterThanOrEqual(400);
    });

    it("should report HNSW memory usage", async () => {
      await service.embed("test1");
      await service.embed("test2");

      const stats = service.getStats();
      expect(stats.hnsw.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe("Cache Management", () => {
    it("should clear all cache data", async () => {
      await service.embed("test1");
      await service.embed("test2");

      service.clear();

      const stats = service.getStats();
      expect(stats.cache.size).toBe(0);
      expect(stats.hnsw.size).toBe(0);
    });

    it("should handle cache miss gracefully", async () => {
      // Query not in cache
      const result = await service.embed("never before seen query");

      expect(result.embedding).toBeInstanceOf(Float32Array);
      expect(result.embedding.length).toBe(1536);

      const stats = service.getStats();
      expect(stats.cache.misses).toBe(1);
    });
  });

  describe("Error Handling", () => {
    it("should handle empty text", async () => {
      await expect(service.embed("")).rejects.toThrow();
    });

    it("should handle invalid input", async () => {
      await expect(service.embed("   ")).rejects.toThrow();
    });

    it("should handle empty batch", async () => {
      const results = await service.embedBatch([]);
      expect(results).toEqual([]);
    });
  });

  describe("Performance", () => {
    it("should be faster with cache hits", async () => {
      const text = "performance test";

      const start1 = Date.now();
      await service.embed(text);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await service.embed(text);
      const time2 = Date.now() - start2;

      // Cache hit should be faster or equal (may be 0ms due to timing precision)
      expect(time2).toBeLessThanOrEqual(time1);

      // Verify it actually hit the cache
      const stats = service.getStats();
      expect(stats.cache.hits).toBeGreaterThan(0);
    });

    it("should handle large batches efficiently", async () => {
      const texts = Array.from({ length: 50 }, (_, i) => `query ${i}`);

      const start = Date.now();
      await service.embedBatch(texts);
      const time = Date.now() - start;

      // Should complete in reasonable time
      expect(time).toBeLessThan(5000);
    });
  });

  describe("Configuration", () => {
    it("should use custom cache size", async () => {
      const customService = new CachedEmbeddingService({
        cache: { maxSize: 5 },
        enableFallback: true,
        enableCacheWarming: false,
      });
      await customService.initialize();

      for (let i = 0; i < 10; i++) {
        await customService.embed(`query ${i}`);
      }

      const stats = customService.getStats();
      expect(stats.cache.size).toBeLessThanOrEqual(5);

      await customService.shutdown();
    });

    it("should use custom TTL", async () => {
      const customService = new CachedEmbeddingService({
        cache: { ttl: 50 },
        enableFallback: true,
        enableCacheWarming: false,
      });
      await customService.initialize();

      await customService.embed("test");

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 60));

      const result = await customService.embed("test");
      // Should have expired and been regenerated
      const stats = customService.getStats();
      expect(stats.cache.misses).toBeGreaterThanOrEqual(1);

      await customService.shutdown();
    });
  });

  describe("Edge Cases", () => {
    it("should handle single character", async () => {
      const result = await service.embed("a");
      expect(result.embedding.length).toBe(1536);
    });

    it("should handle very long text", async () => {
      const longText = "a".repeat(10000);
      const result = await service.embed(longText);
      expect(result.embedding.length).toBe(1536);
    });

    it("should handle special characters", async () => {
      const special = "Hello 🌍 世界 !@#$%^&*()";
      const result = await service.embed(special);
      expect(result.embedding.length).toBe(1536);
    });

    it("should handle unicode", async () => {
      const unicode = "مرحبا بالعالم 🚀";
      const result = await service.embed(unicode);
      expect(result.embedding.length).toBe(1536);
    });
  });

  describe("Batch Processing", () => {
    it("should handle mixed cache hits and misses", async () => {
      await service.embed("cached1");
      await service.embed("cached2");

      const texts = ["cached1", "cached2", "new1", "new2"];
      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(4);
      results.forEach(r => expect(r.embedding).toBeDefined());

      const stats = service.getStats();
      expect(stats.cache.hits).toBeGreaterThanOrEqual(2);
      expect(stats.cache.misses).toBeGreaterThanOrEqual(2);
    });

    it("should handle duplicate texts in batch", async () => {
      const texts = ["test", "test", "test"];
      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(3);
      // All should return the same embedding
      for (let i = 1; i < results.length; i++) {
        expect(Array.from(results[i].embedding)).toEqual(Array.from(results[0].embedding));
      }
    });
  });

  describe("Shutdown", () => {
    it("should shutdown cleanly", async () => {
      await service.embed("test");
      await service.shutdown();

      // Should not throw
      const stats = service.getStats();
      expect(stats).toBeDefined();
    });
  });
});
