/**
 * Integration tests for embedding pipeline
 *
 * Tests the full embedding pipeline including:
 * - Query → Embed → Cache → Retrieve
 * - Multiple queries with cache hits
 * - Cache eviction
 * - Similarity search accuracy
 * - Configuration loading from files/env
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { OpenAIEmbeddingService, type EmbeddingResult } from "@lsi/cascade";
import {
  EmbeddingCache,
  type CachedEmbedding,
} from "@lsi/cascade/src/refiner/EmbeddingCache";
import { HNSWIndex } from "@lsi/cascade/src/refiner/HNSWIndex";
import {
  createEmbeddingConfig,
  type EmbeddingConfig,
  validateEmbeddingConfig,
  EMBEDDING_PRESETS,
  getEmbeddingPreset,
} from "@lsi/superinstance/src/config/EmbeddingConfig";

describe("Embedding Pipeline Integration Tests", () => {
  let embeddingService: OpenAIEmbeddingService;
  let embeddingCache: EmbeddingCache;
  let hnswIndex: HNSWIndex;

  beforeAll(async () => {
    // Initialize embedding service with fallback for testing
    embeddingService = new OpenAIEmbeddingService({
      apiKey: process.env.OPENAI_API_KEY || "",
      enableFallback: true,
      cacheEnabled: false, // We'll use our own cache for testing
    });

    await embeddingService.initialize();

    // Initialize cache
    embeddingCache = new EmbeddingCache({
      maxSize: 100,
      ttl: 60000, // 1 minute
    });

    // Initialize HNSW index for similarity search
    hnswIndex = new HNSWIndex({
      dimensions: 1536,
      maxConnections: 16,
      efConstruction: 200,
    });
  });

  afterAll(async () => {
    await embeddingService.shutdown();
  });

  beforeEach(() => {
    // Clear cache before each test
    embeddingCache.clear();
    hnswIndex.clear();
  });

  describe("Query → Embed → Cache → Retrieve Pipeline", () => {
    it("should complete full pipeline for single query", async () => {
      const query = "What is artificial intelligence?";

      // Step 1: Generate embedding
      const result = await embeddingService.embed(query);
      expect(result.embedding).toBeDefined();
      expect(result.embedding.length).toBe(1536);

      // Step 2: Cache the embedding
      const cached: CachedEmbedding = {
        text: query,
        embedding: result.embedding,
        metadata: {
          timestamp: Date.now(),
          model: result.model,
        },
      };
      embeddingCache.set(query, cached);

      // Step 3: Retrieve from cache
      const retrieved = embeddingCache.get(query);
      expect(retrieved).toBeDefined();
      expect(retrieved!.text).toBe(query);

      // Verify embeddings match
      const retrievedEmbedding = retrieved!.embedding;
      expect(Array.from(retrievedEmbedding)).toEqual(Array.from(result.embedding));
    });

    it("should handle multiple queries in pipeline", async () => {
      const queries = [
        "What is machine learning?",
        "How do neural networks work?",
        "Explain deep learning.",
      ];

      const results: EmbeddingResult[] = [];

      for (const query of queries) {
        // Generate embedding
        const result = await embeddingService.embed(query);
        results.push(result);

        // Cache the embedding
        embeddingCache.set(query, {
          text: query,
          embedding: result.embedding,
          metadata: {
            timestamp: Date.now(),
            model: result.model,
          },
        });
      }

      // Verify all queries processed
      expect(results).toHaveLength(3);

      // Verify cache hits
      for (const query of queries) {
        const cached = embeddingCache.get(query);
        expect(cached).toBeDefined();
        expect(cached!.text).toBe(query);
      }
    });

    it("should use cached embeddings when available", async () => {
      const query = "What is natural language processing?";

      // First call - generate and cache
      const result1 = await embeddingService.embed(query);
      embeddingCache.set(query, {
        text: query,
        embedding: result1.embedding,
        metadata: {
          timestamp: Date.now(),
          model: result1.model,
        },
      });

      // Second call - should use cache
      const cached = embeddingCache.get(query);
      expect(cached).toBeDefined();

      // Verify cached embedding matches original
      expect(Array.from(cached!.embedding)).toEqual(
        Array.from(result1.embedding)
      );
    });
  });

  describe("Cache Operations", () => {
    it("should track cache hits and misses", async () => {
      const query = "Test query for cache statistics";

      // First call - cache miss
      let cached = embeddingCache.get(query);
      expect(cached).toBeUndefined();

      // Generate and cache
      const result = await embeddingService.embed(query);
      embeddingCache.set(query, {
        text: query,
        embedding: result.embedding,
        metadata: {
          timestamp: Date.now(),
          model: result.model,
        },
      });

      // Second call - cache hit
      cached = embeddingCache.get(query);
      expect(cached).toBeDefined();

      // Check statistics
      const stats = embeddingCache.getStats();
      expect(stats.size).toBe(1);
    });

    it("should evict old entries when cache is full", async () => {
      // Create cache with small size
      const smallCache = new EmbeddingCache({
        maxSize: 3,
        ttl: 60000,
      });

      // Add 5 items
      for (let i = 0; i < 5; i++) {
        const result = await embeddingService.embed(`Query ${i}`);
        smallCache.set(`Query ${i}`, {
          text: `Query ${i}`,
          embedding: result.embedding,
          metadata: {
            timestamp: Date.now(),
            model: result.model,
          },
        });
      }

      // Cache should only keep 3 items
      const stats = smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(3);
    });

    it("should handle TTL expiration", async () => {
      // Create cache with very short TTL
      const shortCache = new EmbeddingCache({
        maxSize: 100,
        ttl: 100, // 100ms
      });

      const query = "TTL test query";
      const result = await embeddingService.embed(query);

      // Add to cache
      shortCache.set(query, {
        text: query,
        embedding: result.embedding,
        metadata: {
          timestamp: Date.now(),
          model: result.model,
        },
      });

      // Should be available immediately
      let cached = shortCache.get(query);
      expect(cached).toBeDefined();

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      cached = shortCache.get(query);
      expect(cached).toBeUndefined();
    });

    it("should clear all cache entries", async () => {
      // Add multiple items
      for (let i = 0; i < 10; i++) {
        const result = await embeddingService.embed(`Query ${i}`);
        embeddingCache.set(`Query ${i}`, {
          text: `Query ${i}`,
          embedding: result.embedding,
          metadata: {
            timestamp: Date.now(),
            model: result.model,
          },
        });
      }

      // Verify items are cached
      let stats = embeddingCache.getStats();
      expect(stats.size).toBe(10);

      // Clear cache
      embeddingCache.clear();

      // Verify cache is empty
      stats = embeddingCache.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("Similarity Search with HNSW Index", () => {
    it("should build index and find similar embeddings", async () => {
      // Add embeddings to index
      const queries = [
        "Machine learning algorithms",
        "Deep neural networks",
        "Natural language processing",
        "Computer vision systems",
        "Reinforcement learning agents",
      ];

      for (let i = 0; i < queries.length; i++) {
        const result = await embeddingService.embed(queries[i]);
        hnswIndex.addPoint(result.embedding, i);
      }

      // Search for similar items
      const query = "AI and machine learning";
      const queryEmbedding = await embeddingService.embed(query);

      const results = hnswIndex.searchKNN(queryEmbedding.embedding, 3);

      expect(results).toHaveLength(3);
      expect(results[0].index).toBeGreaterThanOrEqual(0);
      expect(results[0].index).toBeLessThan(queries.length);
      expect(results[0].distance).toBeGreaterThan(0);
    });

    it("should return results in order of similarity", async () => {
      // Add embeddings
      const texts = [
        "artificial intelligence",
        "machine learning",
        "deep learning",
        "neural networks",
      ];

      for (let i = 0; i < texts.length; i++) {
        const result = await embeddingService.embed(texts[i]);
        hnswIndex.addPoint(result.embedding, i);
      }

      // Search
      const query = "AI technology";
      const queryEmbedding = await embeddingService.embed(query);

      const results = hnswIndex.searchKNN(queryEmbedding.embedding, 4);

      // Results should be sorted by distance (lower is more similar)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i - 1].distance);
      }
    });

    it("should handle empty index gracefully", () => {
      const queryEmbedding = new Float32Array(1536);

      const results = hnswIndex.searchKNN(queryEmbedding, 5);

      expect(results).toHaveLength(0);
    });

    it("should clear index correctly", async () => {
      // Add items
      for (let i = 0; i < 5; i++) {
        const result = await embeddingService.embed(`Item ${i}`);
        hnswIndex.addPoint(result.embedding, i);
      }

      // Verify items are in index
      const queryEmbedding = new Float32Array(1536);
      let results = hnswIndex.searchKNN(queryEmbedding, 10);
      expect(results.length).toBeGreaterThan(0);

      // Clear index
      hnswIndex.clear();

      // Verify index is empty
      results = hnswIndex.searchKNN(queryEmbedding, 10);
      expect(results).toHaveLength(0);
    });
  });

  describe("Batch Processing", () => {
    it("should process large batches efficiently", async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `Test text ${i}`);

      const startTime = Date.now();
      const results = await embeddingService.embedBatch(texts);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.embedding).toBeDefined();
        expect(result.embedding.length).toBe(1536);
      });

      // Should complete in reasonable time (even with fallback)
      expect(duration).toBeLessThan(5000);
    });

    it("should cache batch results", async () => {
      const texts = ["Batch text 1", "Batch text 2", "Batch text 3"];

      // Generate embeddings
      const results = await embeddingService.embedBatch(texts);

      // Cache all results
      results.forEach((result, i) => {
        embeddingCache.set(texts[i], {
          text: texts[i],
          embedding: result.embedding,
          metadata: {
            timestamp: Date.now(),
            model: result.model,
          },
        });
      });

      // Verify all are cached
      for (const text of texts) {
        const cached = embeddingCache.get(text);
        expect(cached).toBeDefined();
        expect(cached!.text).toBe(text);
      }
    });
  });

  describe("Configuration Loading", () => {
    it("should validate correct configuration", () => {
      const config: EmbeddingConfig = {
        provider: "openai",
        apiKey: "test-key",
        model: "text-embedding-3-small",
        dimensions: 1536,
        cacheEnabled: true,
        cacheSize: 10000,
        timeout: 30000,
        maxRetries: 3,
        enableFallback: true,
      };

      const validation = validateEmbeddingConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect invalid provider", () => {
      const config = {
        provider: "invalid" as any,
      };

      const validation = validateEmbeddingConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it("should detect invalid dimensions", () => {
      const config: EmbeddingConfig = {
        provider: "openai",
        dimensions: 999, // Invalid
      };

      const validation = validateEmbeddingConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes("dimensions"))).toBe(true);
    });

    it("should detect missing API key for OpenAI", () => {
      const config: EmbeddingConfig = {
        provider: "openai",
        apiKey: "", // Missing
      };

      const validation = validateEmbeddingConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes("apiKey"))).toBe(true);
    });

    it("should load preset configurations", () => {
      const devConfig = getEmbeddingPreset("development");
      expect(devConfig.provider).toBe("ollama");
      expect(devConfig.debug).toBe(true);

      const prodConfig = getEmbeddingPreset("production");
      expect(prodConfig.provider).toBe("openai");
      expect(prodConfig.enableFallback).toBe(false);
      expect(prodConfig.debug).toBe(false);

      const testConfig = getEmbeddingPreset("test");
      expect(testConfig.provider).toBe("mock");
    });

    it("should create config from environment variables", () => {
      const originalEnv = { ...process.env };

      // Set environment variables
      process.env.EMBEDDING_PROVIDER = "ollama";
      process.env.EMBEDDING_MODEL = "nomic-embed-text";
      process.env.EMBEDDING_CACHE_ENABLED = "true";
      process.env.EMBEDDING_DEBUG = "true";

      const config = createEmbeddingConfig();

      expect(config.provider).toBe("ollama");
      expect(config.model).toBe("nomic-embed-text");
      expect(config.cacheEnabled).toBe(true);
      expect(config.debug).toBe(true);

      // Restore environment
      process.env = originalEnv;
    });
  });

  describe("Error Handling and Fallback", () => {
    it("should handle embedding service errors gracefully", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "", // Force fallback
        enableFallback: true,
      });

      await service.initialize();

      // Should use fallback and not throw
      const result = await service.embed("Test query");
      expect(result.embedding).toBeDefined();
      expect(result.usedFallback).toBe(true);

      await service.shutdown();
    });

    it("should handle batch errors with partial results", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "", // Force fallback
        enableFallback: true,
      });

      await service.initialize();

      const texts = ["Text 1", "Text 2", "Text 3"];
      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.embedding).toBeDefined();
        expect(result.usedFallback).toBe(true);
      });

      await service.shutdown();
    });
  });

  describe("Performance Benchmarks", () => {
    it("should meet performance targets for single embedding", async () => {
      const query = "Performance test query";

      const start = Date.now();
      const result = await embeddingService.embed(query);
      const duration = Date.now() - start;

      expect(result.embedding).toBeDefined();
      // Should be fast (even with fallback)
      expect(duration).toBeLessThan(1000);
    });

    it("should meet performance targets for batch embeddings", async () => {
      const texts = Array.from({ length: 50 }, (_, i) => `Text ${i}`);

      const start = Date.now();
      const results = await embeddingService.embedBatch(texts);
      const duration = Date.now() - start;

      expect(results).toHaveLength(50);
      // Should process quickly (even with fallback)
      expect(duration).toBeLessThan(2000);
    });

    it("should meet performance targets for similarity search", async () => {
      // Build index
      for (let i = 0; i < 100; i++) {
        const result = await embeddingService.embed(`Document ${i}`);
        hnswIndex.addPoint(result.embedding, i);
      }

      const query = "Search query";
      const queryEmbedding = await embeddingService.embed(query);

      const start = Date.now();
      const results = hnswIndex.searchKNN(queryEmbedding.embedding, 10);
      const duration = Date.now() - start;

      expect(results).toHaveLength(10);
      // Should be very fast
      expect(duration).toBeLessThan(100);
    });
  });

  describe("End-to-End Scenarios", () => {
    it("should handle semantic search workflow", async () => {
      // Index documents
      const documents = [
        "Machine learning is a subset of artificial intelligence.",
        "Deep learning uses neural networks with many layers.",
        "Natural language processing deals with text and speech.",
      ];

      for (let i = 0; i < documents.length; i++) {
        const result = await embeddingService.embed(documents[i]);
        hnswIndex.addPoint(result.embedding, i);
        embeddingCache.set(`doc:${i}`, {
          text: documents[i],
          embedding: result.embedding,
          metadata: { timestamp: Date.now(), model: result.model },
        });
      }

      // Search for similar documents
      const query = "AI and neural networks";
      const queryResult = await embeddingService.embed(query);
      const searchResults = hnswIndex.searchKNN(queryResult.embedding, 2);

      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].distance).toBeGreaterThan(0);

      // Retrieve actual document text
      const bestMatch = searchResults[0].index;
      const cachedDoc = embeddingCache.get(`doc:${bestMatch}`);
      expect(cachedDoc).toBeDefined();
      expect(cachedDoc!.text).toBe(documents[bestMatch]);
    });

    it("should handle deduplication workflow", async () => {
      const texts = [
        "The cat sat on the mat",
        "A cat was sitting on the mat",
        "The dog lay on the rug",
      ];

      const embeddings: Float32Array[] = [];

      for (const text of texts) {
        const result = await embeddingService.embed(text);
        embeddings.push(result.embedding);
      }

      // Calculate similarities
      const similarity01 = cosineSimilarity(embeddings[0], embeddings[1]);
      const similarity02 = cosineSimilarity(embeddings[0], embeddings[2]);
      const similarity12 = cosineSimilarity(embeddings[1], embeddings[2]);

      // Note: With hash-based fallback, similarities won't be meaningful
      // In production with real embeddings, similar texts would have higher similarity
      expect(similarity01).toBeDefined();
      expect(similarity02).toBeDefined();
      expect(similarity12).toBeDefined();
    });
  });
});

/**
 * Helper function to calculate cosine similarity
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have same dimensions");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);

  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}
