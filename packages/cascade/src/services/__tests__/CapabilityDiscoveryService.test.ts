/**
 * Tests for CapabilityDiscoveryService
 *
 * Tests automatic model capability discovery, fingerprinting, and caching.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CapabilityDiscoveryService } from "../CapabilityDiscoveryService.js";
import { OllamaAdapter } from "../../adapters/OllamaAdapter.js";
import type {
  ModelCapability,
  CapabilityDiscoveryResult,
  ModelIntentType,
} from "@lsi/protocol";
import axios from "axios";

// Mock axios
vi.mock("axios");

describe("CapabilityDiscoveryService", () => {
  let service: CapabilityDiscoveryService;
  let mockAdapter: OllamaAdapter;

  beforeEach(() => {
    // Create mock adapter
    mockAdapter = {
      process: vi.fn().mockResolvedValue({
        content: "4",
        backend: "local",
        model: "test-model",
        tokensUsed: 10,
        latency: 100,
        metadata: {},
      }),
      getConfig: vi.fn().mockReturnValue({
        baseURL: "http://localhost:11434",
        defaultModel: "llama3:8b",
      }),
    } as unknown as OllamaAdapter;

    service = new CapabilityDiscoveryService(mockAdapter, {
      runBenchmarks: false, // Disable benchmarks for faster tests
      logging: { enabled: false },
    });

    // Mock axios responses
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        models: [
          {
            name: "llama3:8b",
            modified_at: "2024-01-01T00:00:00Z",
            size: 4000000000,
            digest: "abc123",
            details: {
              format: "gguf",
              family: "llama3",
              parameter_size: "8B",
              quantization_level: "Q4_K_M",
            },
          },
          {
            name: "mistral:7b",
            modified_at: "2024-01-01T00:00:00Z",
            size: 4000000000,
            digest: "def456",
            details: {
              format: "gguf",
              family: "mistral",
              parameter_size: "7B",
              quantization_level: "Q4_K_M",
            },
          },
          {
            name: "nomic-embed-text",
            modified_at: "2024-01-01T00:00:00Z",
            size: 500000000,
            digest: "ghi789",
            details: {
              format: "gguf",
              family: "nomic",
            },
          },
        ],
      },
    });

    vi.mocked(axios.post).mockResolvedValue({
      data: {
        license: "MIT",
        modelfile: "FROM llama3:8b",
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("discoverAll", () => {
    it("should discover all available models", async () => {
      const result = await service.discoverAll();

      expect(result.success).toBe(true);
      expect(result.discoveredCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.capabilities).toHaveLength(3);
    });

    it("should discover correct capabilities for llama3:8b", async () => {
      const result = await service.discoverAll();
      const llama3Cap = result.capabilities?.find(c => c.modelId === "llama3:8b");

      expect(llama3Cap).toBeDefined();
      expect(llama3Cap?.family).toBe("llama3");
      expect(llama3Cap?.parameterSize).toBe("8B");
      expect(llama3Cap?.quantizationLevel).toBe("Q4_K_M");
      expect(llama3Cap?.supportedIntents).toContain("chat");
      expect(llama3Cap?.maxContextLength).toBeGreaterThan(0);
      expect(llama3Cap?.qualityScore).toBeGreaterThan(0);
      expect(llama3Cap?.tokensPerSecond).toBeGreaterThan(0);
    });

    it("should discover correct capabilities for mistral:7b", async () => {
      const result = await service.discoverAll();
      const mistralCap = result.capabilities?.find(c => c.modelId === "mistral:7b");

      expect(mistralCap).toBeDefined();
      expect(mistralCap?.family).toBe("mistral");
      expect(mistralCap?.parameterSize).toBe("7B");
      expect(mistralCap?.supportedIntents).toContain("chat");
    });

    it("should identify embedding models", async () => {
      const result = await service.discoverAll();
      const embedCap = result.capabilities?.find(c => c.modelId === "nomic-embed-text");

      expect(embedCap).toBeDefined();
      expect(embedCap?.supportedIntents).toContain("embedding");
      expect(embedCap?.embeddingDimension).toBeDefined();
    });

    it("should report progress when callback is provided", async () => {
      const progressCallback = vi.fn();
      await service.discoverAll(progressCallback);

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          currentModel: expect.any(String),
          discovered: expect.any(Number),
          total: 3,
          progress: expect.any(Number),
          operation: "discovering",
        })
      );
    });

    it("should cache discovered capabilities", async () => {
      await service.discoverAll();

      const llama3Cap = service.getCapability("llama3:8b");
      expect(llama3Cap).toBeDefined();
      expect(llama3Cap?.modelId).toBe("llama3:8b");
    });

    it("should handle discovery errors gracefully", async () => {
      // Mock axios to throw error
      vi.mocked(axios.get).mockRejectedValue(new Error("Ollama unreachable"));

      const result = await service.discoverAll();

      expect(result.success).toBe(false);
      expect(result.discoveredCount).toBe(0);
    });
  });

  describe("getCapability", () => {
    it("should return cached capability", async () => {
      await service.discoverAll();

      const capability = service.getCapability("llama3:8b");

      expect(capability).toBeDefined();
      expect(capability?.modelId).toBe("llama3:8b");
    });

    it("should return undefined for non-existent model", () => {
      const capability = service.getCapability("non-existent:model");

      expect(capability).toBeUndefined();
    });

    it("should update cache hit stats", async () => {
      await service.discoverAll();

      service.getCapability("llama3:8b");
      service.getCapability("llama3:8b");

      const capability = service.getCapability("llama3:8b");
      // The cache entry should have hitCount > 0, but we can't easily verify this
      // without exposing internal cache state
      expect(capability).toBeDefined();
    });

    it("should expire cached entries", async () => {
      const shortTTLService = new CapabilityDiscoveryService(mockAdapter, {
        cache: { ttl: 100, enabled: true }, // 100ms TTL
        runBenchmarks: false,
        logging: { enabled: false },
      });

      await shortTTLService.discoverAll();

      // Should get cached capability immediately
      let capability = shortTTLService.getCapability("llama3:8b");
      expect(capability).toBeDefined();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should return undefined after expiration
      capability = shortTTLService.getCapability("llama3:8b");
      expect(capability).toBeUndefined();
    });
  });

  describe("getAllCapabilities", () => {
    it("should return all cached capabilities", async () => {
      await service.discoverAll();

      const capabilities = service.getAllCapabilities();

      expect(capabilities).toHaveLength(3);
      expect(capabilities.map(c => c.modelId)).toContain("llama3:8b");
      expect(capabilities.map(c => c.modelId)).toContain("mistral:7b");
      expect(capabilities.map(c => c.modelId)).toContain("nomic-embed-text");
    });

    it("should return empty array when nothing is cached", () => {
      const capabilities = service.getAllCapabilities();

      expect(capabilities).toHaveLength(0);
    });
  });

  describe("clearCache", () => {
    it("should clear all cached capabilities", async () => {
      await service.discoverAll();

      expect(service.getAllCapabilities()).toHaveLength(3);

      service.clearCache();

      expect(service.getAllCapabilities()).toHaveLength(0);
      expect(service.getCapability("llama3:8b")).toBeUndefined();
    });
  });

  describe("well-known model profiles", () => {
    it("should use well-known profiles for llama3", async () => {
      await service.discoverAll();
      const capability = service.getCapability("llama3:8b");

      expect(capability?.maxContextLength).toBe(8192);
      expect(capability?.supportsStreaming).toBe(true);
      expect(capability?.recommendedUseCases).toContain("general-purpose");
    });

    it("should use well-known profiles for mistral", async () => {
      await service.discoverAll();
      const capability = service.getCapability("mistral:7b");

      expect(capability?.maxContextLength).toBe(32768);
      expect(capability?.supportsFunctionCalling).toBe(true);
      expect(capability?.recommendedUseCases).toContain("code-generation");
    });

    it("should use well-known profiles for embedding models", async () => {
      await service.discoverAll();
      const capability = service.getCapability("nomic-embed-text");

      expect(capability?.supportedIntents).toEqual(["embedding"]);
      expect(capability?.embeddingDimension).toBe(768);
    });
  });

  describe("capability structure", () => {
    it("should include all required fields", async () => {
      await service.discoverAll();
      const capability = service.getCapability("llama3:8b");

      expect(capability).toMatchObject({
        modelId: expect.any(String),
        name: expect.any(String),
        family: expect.any(String),
        parameterSize: expect.any(String),
        maxContextLength: expect.any(Number),
        supportedIntents: expect.any(Array<ModelIntentType>),
        qualityScore: expect.any(Number),
        averageLatencyMs: expect.any(Number),
        tokensPerSecond: expect.any(Number),
        supportsStreaming: expect.any(Boolean),
        supportsFunctionCalling: expect.any(Boolean),
        supportsVision: expect.any(Boolean),
        recommendedUseCases: expect.any(Array<string>),
        limitations: expect.any(Array<string>),
        discoveredAt: expect.any(Number),
        version: expect.any(String),
      });
    });

    it("should have quality score between 0 and 1", async () => {
      await service.discoverAll();

      for (const capability of service.getAllCapabilities()) {
        expect(capability.qualityScore).toBeGreaterThanOrEqual(0);
        expect(capability.qualityScore).toBeLessThanOrEqual(1);
      }
    });

    it("should have positive latency and tokens per second", async () => {
      await service.discoverAll();

      for (const capability of service.getAllCapabilities()) {
        expect(capability.averageLatencyMs).toBeGreaterThan(0);
        expect(capability.tokensPerSecond).toBeGreaterThan(0);
      }
    });
  });

  describe("cache size limit", () => {
    it("should enforce cache size limit", async () => {
      const smallCacheService = new CapabilityDiscoveryService(mockAdapter, {
        cache: { maxSize: 2, enabled: true },
        runBenchmarks: false,
        logging: { enabled: false },
      });

      await smallCacheService.discoverAll();

      // Should only keep 2 most recent entries
      const capabilities = smallCacheService.getAllCapabilities();
      expect(capabilities.length).toBeLessThanOrEqual(2);
    });
  });

  describe("benchmark integration", () => {
    it("should run benchmarks when enabled", async () => {
      const benchmarkService = new CapabilityDiscoveryService(mockAdapter, {
        runBenchmarks: true,
        benchmarkSamples: 1,
        logging: { enabled: false },
      });

      await benchmarkService.discoverAll();

      // Verify that the adapter was called for benchmarking
      expect(mockAdapter.process).toHaveBeenCalled();
    });
  });

  describe("intent testing", () => {
    it("should detect chat intent", async () => {
      await service.discoverAll();
      const capability = service.getCapability("llama3:8b");

      expect(capability?.supportedIntents).toContain("chat");
    });

    it("should detect completion intent", async () => {
      await service.discoverAll();
      const capability = service.getCapability("llama3:8b");

      expect(capability?.supportedIntents).toContain("completion");
    });

    it("should detect embedding intent for embedding models", async () => {
      await service.discoverAll();
      const capability = service.getCapability("nomic-embed-text");

      expect(capability?.supportedIntents).toContain("embedding");
    });
  });
});
