/**
 * Integration tests for @lsi/llamaindex
 *
 * These tests verify that Aequor components work correctly with LlamaIndex.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { AequorLLM } from "./llm/AequorLLM.js";
import { AequorEmbedding } from "./embeddings/AequorEmbedding.js";
import { AequorCache } from "./cache/AequorCache.js";
import { Settings, VectorStoreIndex, Document } from "llamaindex";

describe("Aequor-LlamaIndex Integration", () => {
  beforeAll(() => {
    // Configure LlamaIndex with Aequor components
    process.env.OPENAI_API_KEY = "test-key";

    Settings.llm = new AequorLLM({
      router: {
        complexityThreshold: 0.6,
        enableCache: true,
      },
      local: {
        baseURL: "http://localhost:11434",
        model: "llama2",
      },
      cloud: {
        apiKey: "test-key",
        model: "gpt-4-turbo-preview",
      },
    });

    Settings.embedModel = new AequorEmbedding({
      apiKey: "test-key",
      model: "text-embedding-3-large",
      dimensions: 1536,
      enableCache: true,
    });

    Settings.llmCache = new AequorCache({
      maxSize: 100,
      similarityThreshold: 0.85,
    });
  });

  describe("Settings configuration", () => {
    it("should configure LLM in LlamaIndex Settings", () => {
      expect(Settings.llm).toBeDefined();
      expect(Settings.llm).toBeInstanceOf(AequorLLM);
    });

    it("should configure embedModel in LlamaIndex Settings", () => {
      expect(Settings.embedModel).toBeDefined();
      expect(Settings.embedModel).toBeInstanceOf(AequorEmbedding);
    });

    it("should configure llmCache in LlamaIndex Settings", () => {
      expect(Settings.llmCache).toBeDefined();
      expect(Settings.llmCache).toBeInstanceOf(AequorCache);
    });
  });

  describe("AequorLLM", () => {
    it("should have correct metadata", () => {
      const metadata = Settings.llm.metadata;

      expect(metadata.model).toBe("aequor-cascade");
      expect(metadata.contextWindow).toBe(128000);
    });

    it("should provide routing statistics", () => {
      const stats = (Settings.llm as AequorLLM).getRoutingStats();

      expect(stats).toHaveProperty("cache");
      expect(stats).toHaveProperty("budget");
      expect(stats).toHaveProperty("health");
    });
  });

  describe("AequorEmbedding", () => {
    it("should have correct dimensions", () => {
      const dimensions = (Settings.embedModel as AequorEmbedding).getDimensions();

      expect(dimensions).toBe(1536);
    });

    it("should have HNSW cache enabled", () => {
      const stats = (Settings.embedModel as AequorEmbedding).getCacheStats();

      expect(stats.hnswEnabled).toBe(true);
    });
  });

  describe("AequorCache", () => {
    it("should provide cache statistics", () => {
      const stats = (Settings.llmCache as AequorCache).getStats();

      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("hitRate");
      expect(stats).toHaveProperty("totalHits");
      expect(stats).toHaveProperty("totalMisses");
    });

    it("should provide analytics", () => {
      const analytics = (Settings.llmCache as AequorCache).getAnalytics();

      expect(analytics).toHaveProperty("performance");
      expect(analytics.performance).toHaveProperty("efficiency");
      expect(analytics.performance).toHaveProperty("recommendedAction");
    });
  });

  describe("end-to-end workflow", () => {
    it("should support basic cache operations", async () => {
      const cache = Settings.llmCache as AequorCache;

      await cache.set("test-key", "test-value");
      const value = await cache.get("test-key");

      expect(value).toBe("test-value");
    });

    it("should track cache statistics", async () => {
      const cache = Settings.llmCache as AequorCache;

      await cache.set("key1", "value1");
      await cache.get("key1"); // Hit
      await cache.get("key2"); // Miss

      const stats = cache.getStats();

      expect(stats.totalHits).toBeGreaterThan(0);
      expect(stats.totalMisses).toBeGreaterThan(0);
    });
  });

  describe("component integration", () => {
    it("should work together as a cohesive system", () => {
      const llm = Settings.llm as AequorLLM;
      const embedModel = Settings.embedModel as AequorEmbedding;
      const cache = Settings.llmCache as AequorCache;

      // All components should be properly initialized
      expect(llm).toBeInstanceOf(AequorLLM);
      expect(embedModel).toBeInstanceOf(AequorEmbedding);
      expect(cache).toBeInstanceOf(AequorCache);

      // Each component should provide its specific functionality
      expect(llm.getRoutingStats).toBeDefined();
      expect(embedModel.getCacheStats).toBeDefined();
      expect(cache.getAnalytics).toBeDefined();
    });
  });
});
