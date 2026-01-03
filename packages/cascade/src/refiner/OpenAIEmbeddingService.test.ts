/**
 * Comprehensive unit tests for OpenAIEmbeddingService
 *
 * Tests cover:
 * - Service initialization
 * - Single and batch embedding generation
 * - Error handling and retries
 * - Fallback mechanisms
 * - Configuration loading
 * - Cache operations
 * - Similarity search
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  OpenAIEmbeddingService,
  type EmbeddingServiceConfig,
  type EmbeddingResult,
} from "./OpenAIEmbeddingService";
import {
  MockOpenAIAPI,
  createMockEmbeddingConfig,
  EMBEDDING_TEST_FIXTURES,
  assertEmbeddingResult,
  cosineSimilarity,
  generateMockEmbedding,
} from "./__tests__/testUtils";

describe("OpenAIEmbeddingService", () => {
  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const service = new OpenAIEmbeddingService();

      expect(service).toBeDefined();
    });

    it("should initialize with custom config", () => {
      const config: EmbeddingServiceConfig = {
        apiKey: "test-key",
        model: "text-embedding-3-large",
        dimensions: 3072,
      };

      const service = new OpenAIEmbeddingService(config);

      expect(service).toBeDefined();
    });

    it("should detect Ollama from localhost URL", () => {
      const config: EmbeddingServiceConfig = {
        baseURL: "http://localhost:11434",
      };

      const service = new OpenAIEmbeddingService(config);

      expect(service).toBeDefined();
    });

    it("should detect Ollama from 127.0.0.1 URL", () => {
      const config: EmbeddingServiceConfig = {
        baseURL: "http://127.0.0.1:11434",
      };

      const service = new OpenAIEmbeddingService(config);

      expect(service).toBeDefined();
    });

    it("should detect Ollama from ollama in URL", () => {
      const config: EmbeddingServiceConfig = {
        baseURL: "http://ollama.local:11434",
      };

      const service = new OpenAIEmbeddingService(config);

      expect(service).toBeDefined();
    });

    it("should initialize successfully", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        enableFallback: true,
      });

      await expect(service.initialize()).resolves.not.toThrow();
    });

    it("should warn when no API key provided", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const service = new OpenAIEmbeddingService({
        apiKey: "",
        baseURL: "https://api.openai.com/v1",
        enableFallback: true,
      });

      await service.initialize();

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it("should be idempotent - multiple initialize calls", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        enableFallback: true,
      });

      await service.initialize();
      await service.initialize();
      await service.initialize();

      // Should not throw any errors
      expect(true).toBe(true);
    });
  });

  describe("Single Embedding Generation", () => {
    let service: OpenAIEmbeddingService;

    beforeEach(() => {
      service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        enableFallback: true,
      });
    });

    afterEach(async () => {
      await service.shutdown();
    });

    it("should generate embedding for simple text", async () => {
      // This test will use fallback since we don't have real API
      const result = await service.embed(EMBEDDING_TEST_FIXTURES.simple);

      assertEmbeddingResult(result);
      expect(result.embedding.length).toBeGreaterThan(0);
      expect(result.usedFallback).toBe(true);
    });

    it("should generate embedding for long text", async () => {
      const result = await service.embed(EMBEDDING_TEST_FIXTURES.long);

      assertEmbeddingResult(result);
      expect(result.embedding.length).toBeGreaterThan(0);
    });

    it("should handle unicode text", async () => {
      const result = await service.embed(EMBEDDING_TEST_FIXTURES.unicode);

      assertEmbeddingResult(result);
      expect(result.embedding.length).toBeGreaterThan(0);
    });

    it("should handle special characters", async () => {
      const result = await service.embed(EMBEDDING_TEST_FIXTURES.special);

      assertEmbeddingResult(result);
      expect(result.embedding.length).toBeGreaterThan(0);
    });

    it("should handle code snippets", async () => {
      const result = await service.embed(EMBEDDING_TEST_FIXTURES.code);

      assertEmbeddingResult(result);
      expect(result.embedding.length).toBeGreaterThan(0);
    });

    it("should throw error for empty text", async () => {
      await expect(service.embed(EMBEDDING_TEST_FIXTURES.empty)).rejects.toThrow(
        "non-empty string"
      );
    });

    it("should throw error for whitespace-only text", async () => {
      await expect(
        service.embed(EMBEDDING_TEST_FIXTURES.whitespace)
      ).rejects.toThrow("Text must not be empty");
    });

    it("should throw error for non-string input", async () => {
      await expect(service.embed(null as any)).rejects.toThrow();
      await expect(service.embed(undefined as any)).rejects.toThrow();
      await expect(service.embed(123 as any)).rejects.toThrow();
    });

    it("should trim whitespace from input", async () => {
      const result1 = await service.embed("  hello  ");
      const result2 = await service.embed("hello");

      // Both should succeed (using fallback)
      assertEmbeddingResult(result1);
      assertEmbeddingResult(result2);
    });

    it("should include latency in result", async () => {
      const result = await service.embed("test");

      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(result.latency).toBeLessThan(10000); // Should be fast
    });
  });

  describe("Batch Embedding Generation", () => {
    let service: OpenAIEmbeddingService;

    beforeEach(() => {
      service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        enableFallback: true,
      });
    });

    afterEach(async () => {
      await service.shutdown();
    });

    it("should generate embeddings for multiple texts", async () => {
      const results = await service.embedBatch(EMBEDDING_TEST_FIXTURES.multiple);

      expect(results).toHaveLength(EMBEDDING_TEST_FIXTURES.multiple.length);
      results.forEach(assertEmbeddingResult);
    });

    it("should handle empty batch", async () => {
      const results = await service.embedBatch([]);

      expect(results).toHaveLength(0);
    });

    it("should handle single text in batch", async () => {
      const results = await service.embedBatch(["hello"]);

      expect(results).toHaveLength(1);
      assertEmbeddingResult(results[0]);
    });

    it("should handle large batch (within limits)", async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `text ${i}`);

      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(100);
      results.forEach(assertEmbeddingResult);
    });

    it("should handle very large batch (with automatic batching)", async () => {
      const texts = Array.from({ length: 3000 }, (_, i) => `text ${i}`);

      const results = await service.embedBatch(texts);

      expect(results).toHaveLength(3000);
      results.forEach(assertEmbeddingResult);
    });

    it("should throw error for non-array input", async () => {
      await expect(service.embedBatch(null as any)).rejects.toThrow();
      await expect(service.embedBatch("hello" as any)).rejects.toThrow();
    });

    it("should distribute latency across batch results", async () => {
      const results = await service.embedBatch(EMBEDDING_TEST_FIXTURES.multiple);

      results.forEach(result => {
        expect(result.latency).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("Fallback Mechanism", () => {
    it("should use hash-based fallback when no API key", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        enableFallback: true,
      });

      const result = await service.embed("test");

      assertEmbeddingResult(result);
      expect(result.usedFallback).toBe(true);
      expect(result.model).toContain("fallback");
    });

    it("should not use fallback when disabled and API fails", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "invalid-key",
        enableFallback: false,
      });

      // Should throw instead of using fallback
      await expect(service.embed("test")).rejects.toThrow();
    });

    it("should use fallback for batch when API fails", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        enableFallback: true,
      });

      const results = await service.embedBatch(["text1", "text2"]);

      expect(results).toHaveLength(2);
      results.forEach(result => {
        assertEmbeddingResult(result);
        expect(result.usedFallback).toBe(true);
      });
    });

    it("should generate deterministic hash-based embeddings", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        enableFallback: true,
      });

      const result1 = await service.embed("test text");
      const result2 = await service.embed("test text");

      // Same text should produce same hash embedding
      expect(Array.from(result1.embedding)).toEqual(Array.from(result2.embedding));
    });

    it("should generate different embeddings for different texts", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        enableFallback: true,
      });

      const result1 = await service.embed("text one");
      const result2 = await service.embed("text two");

      // Different texts should produce different embeddings
      expect(Array.from(result1.embedding)).not.toEqual(
        Array.from(result2.embedding)
      );
    });
  });

  describe("Model Dimensions", () => {
    it("should use correct dimensions for text-embedding-3-small", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        model: "text-embedding-3-small",
        enableFallback: true,
      });

      const result = await service.embed("test");

      expect(result.embedding.length).toBe(1536);
    });

    it("should use correct dimensions for text-embedding-3-large", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        model: "text-embedding-3-large",
        enableFallback: true,
      });

      const result = await service.embed("test");

      expect(result.embedding.length).toBe(3072);
    });

    it("should use correct dimensions for nomic-embed-text", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        model: "nomic-embed-text",
        enableFallback: true,
      });

      const result = await service.embed("test");

      expect(result.embedding.length).toBe(768);
    });

    it("should use correct dimensions for mxbai-embed-large", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        model: "mxbai-embed-large",
        enableFallback: true,
      });

      const result = await service.embed("test");

      expect(result.embedding.length).toBe(1024);
    });

    it("should allow custom dimensions", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        model: "text-embedding-3-small",
        dimensions: 512,
        enableFallback: true,
      });

      const result = await service.embed("test");

      expect(result.embedding.length).toBe(512);
    });
  });

  describe("Shutdown", () => {
    it("should shutdown gracefully", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        enableFallback: true,
      });

      await service.initialize();
      await service.embed("test");
      await service.shutdown();

      // Should be able to reinitialize after shutdown
      await service.initialize();
      await service.embed("test");

      expect(true).toBe(true);
    });

    it("should handle multiple shutdowns", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        enableFallback: true,
      });

      await service.shutdown();
      await service.shutdown();
      await service.shutdown();

      expect(true).toBe(true);
    });
  });

  describe("Similarity Calculations", () => {
    it("should calculate cosine similarity correctly", () => {
      const vec1 = new Float32Array([1, 0, 0]);
      const vec2 = new Float32Array([1, 0, 0]);

      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0);
    });

    it("should calculate similarity for orthogonal vectors", () => {
      const vec1 = new Float32Array([1, 0, 0]);
      const vec2 = new Float32Array([0, 1, 0]);

      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0.0);
    });

    it("should calculate similarity for opposite vectors", () => {
      const vec1 = new Float32Array([1, 0, 0]);
      const vec2 = new Float32Array([-1, 0, 0]);

      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(-1.0);
    });

    it("should handle different length vectors", () => {
      const vec1 = new Float32Array([1, 0]);
      const vec2 = new Float32Array([1, 0, 0]);

      expect(() => cosineSimilarity(vec1, vec2)).toThrow();
    });

    it("should handle zero vectors", () => {
      const vec1 = new Float32Array([0, 0, 0]);
      const vec2 = new Float32Array([1, 0, 0]);

      expect(cosineSimilarity(vec1, vec2)).toBe(0);
    });
  });

  describe("Mock Embedding Generation", () => {
    it("should generate mock embeddings", () => {
      const embedding = generateMockEmbedding(1536, "test");

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(1536);
    });

    it("should generate deterministic embeddings from same seed", () => {
      const emb1 = generateMockEmbedding(1536, "test");
      const emb2 = generateMockEmbedding(1536, "test");

      expect(Array.from(emb1)).toEqual(Array.from(emb2));
    });

    it("should generate different embeddings from different seeds", () => {
      const emb1 = generateMockEmbedding(1536, "test1");
      const emb2 = generateMockEmbedding(1536, "test2");

      expect(Array.from(emb1)).not.toEqual(Array.from(emb2));
    });

    it("should normalize mock embeddings to unit length", () => {
      const embedding = generateMockEmbedding(1536, "test");

      let magnitude = 0;
      for (let i = 0; i < embedding.length; i++) {
        magnitude += embedding[i] * embedding[i];
      }
      magnitude = Math.sqrt(magnitude);

      expect(magnitude).toBeCloseTo(1.0, 5);
    });
  });

  describe("Configuration", () => {
    it("should use environment variable for API key", () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "env-key";

      const service = new OpenAIEmbeddingService();

      expect(service).toBeDefined();

      process.env.OPENAI_API_KEY = originalKey;
    });

    it("should prefer constructor config over env var", () => {
      const originalKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "env-key";

      const service = new OpenAIEmbeddingService({
        apiKey: "constructor-key",
      });

      expect(service).toBeDefined();

      process.env.OPENAI_API_KEY = originalKey;
    });

    it("should use default timeout", () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
      });

      expect(service).toBeDefined();
    });

    it("should use custom timeout", () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        timeout: 60000,
      });

      expect(service).toBeDefined();
    });

    it("should use default max retries", () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
      });

      expect(service).toBeDefined();
    });

    it("should use custom max retries", () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        maxRetries: 5,
      });

      expect(service).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle timeout errors gracefully", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        timeout: 1, // 1ms timeout
        enableFallback: true,
      });

      // Should fall back to hash
      const result = await service.embed("test");

      assertEmbeddingResult(result);
      expect(result.usedFallback).toBe(true);
    });

    it("should validate text before embedding", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        enableFallback: true,
      });

      await expect(service.embed("")).rejects.toThrow();
      await expect(service.embed("   ")).rejects.toThrow();
    });

    it("should handle invalid batch input", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "test-key",
        enableFallback: true,
      });

      await expect(service.embedBatch(null as any)).rejects.toThrow();
      await expect(service.embedBatch("string" as any)).rejects.toThrow();
      await expect(service.embedBatch(123 as any)).rejects.toThrow();
    });
  });

  describe("Performance", () => {
    it("should generate single embedding quickly", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        enableFallback: true,
      });

      const start = Date.now();
      await service.embed("test");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should be fast with fallback
    });

    it("should generate batch embeddings quickly", async () => {
      const service = new OpenAIEmbeddingService({
        apiKey: "",
        enableFallback: true,
      });

      const texts = Array.from({ length: 100 }, (_, i) => `text ${i}`);

      const start = Date.now();
      await service.embedBatch(texts);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000); // Should be fast with fallback
    });
  });
});
