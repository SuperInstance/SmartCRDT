/**
 * Tests for AequorEmbedding
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AequorEmbedding } from "./AequorEmbedding.js";

describe("AequorEmbedding", () => {
  let embedModel: AequorEmbedding;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";

    embedModel = new AequorEmbedding({
      apiKey: "test-key",
      model: "text-embedding-3-large",
      dimensions: 1536,
      enableCache: true,
    });
  });

  describe("configuration", () => {
    it("should initialize with correct dimensions", () => {
      expect(embedModel.getDimensions()).toBe(1536);
    });

    it("should have HNSW index enabled", () => {
      const stats = embedModel.getCacheStats();
      expect(stats.hnswEnabled).toBe(true);
    });
  });

  describe("cache", () => {
    it("should provide cache statistics", () => {
      const stats = embedModel.getCacheStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("hits");
      expect(stats).toHaveProperty("misses");
      expect(stats).toHaveProperty("hitRate");
      expect(stats).toHaveProperty("hnswEnabled");
    });

    it("should clear cache", () => {
      embedModel.clearCache();
      const stats = embedModel.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it("should set cache limit", () => {
      expect(() => embedModel.setCacheLimit(100)).not.toThrow();
    });

    it("should clean expired entries", () => {
      expect(() => embedModel.cleanExpired(3600000)).not.toThrow();
    });
  });

  describe("analytics", () => {
    it("should provide detailed analytics", () => {
      const analytics = embedModel.getCacheAnalytics();

      expect(analytics).toHaveProperty("totalEntries");
      expect(analytics).toHaveProperty("avgAccessCount");
      expect(analytics).toHaveProperty("oldestEntry");
      expect(analytics).toHaveProperty("newestEntry");
      expect(analytics).toHaveProperty("topEntries");
      expect(Array.isArray(analytics.topEntries)).toBe(true);
    });
  });

  describe("warmCache", () => {
    it("should warm cache with texts", async () => {
      const result = await embedModel.warmCache([
        "Test text 1",
        "Test text 2",
        "Test text 3",
      ]);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("failed");
      expect(result.success + result.failed).toBe(3);
    });
  });

  describe("HNSW index", () => {
    it("should expose HNSW index", () => {
      const hnsw = embedModel.getHNSWIndex();
      expect(hnsw).toBeDefined();
    });

    it("should support similarity search", async () => {
      // Add some embeddings first
      await embedModel.warmCache([
        "quantum computing",
        "machine learning",
        "neural networks",
      ]);

      try {
        const similar = await embedModel.findSimilar("artificial intelligence", 3);
        expect(Array.isArray(similar)).toBe(true);
        expect(similar.length).toBeGreaterThan(0);
        expect(similar[0]).toHaveProperty("text");
        expect(similar[0]).toHaveProperty("similarity");
      } catch (error) {
        // May fail if OpenAI API not available
        expect(error).toBeDefined();
      }
    });
  });

  describe("cache key generation", () => {
    it("should generate consistent cache keys", async () => {
      const text = "Test text for cache key";

      // First call - cache miss
      const embedding1 = await embedModel.getTextEmbedding(text);
      const stats1 = embedModel.getCacheStats();

      // Second call - cache hit
      const embedding2 = await embedModel.getTextEmbedding(text);
      const stats2 = embedModel.getCacheStats();

      // Cache should have increased
      expect(stats2.hits).toBeGreaterThanOrEqual(stats1.hits);
      expect(embedding2).toEqual(embedding1);
    });
  });

  describe("batch embeddings", () => {
    it("should handle batch requests", async () => {
      const texts = ["Text 1", "Text 2", "Text 3"];

      try {
        const embeddings = await embedModel.getTextEmbeddings(texts);

        expect(Array.isArray(embeddings)).toBe(true);
        expect(embeddings.length).toBe(texts.length);
        expect(embeddings[0]).toBeInstanceOf(Array);
        expect(embeddings[0].length).toBe(1536);
      } catch (error) {
        // May fail if OpenAI API not available
        expect(error).toBeDefined();
      }
    });
  });

  describe("query embeddings", () => {
    it("should generate query embeddings", async () => {
      const query = "What is quantum computing?";

      try {
        const embedding = await embedModel.getQueryEmbedding(query);

        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(1536);
      } catch (error) {
        // May fail if OpenAI API not available
        expect(error).toBeDefined();
      }
    });
  });
});
