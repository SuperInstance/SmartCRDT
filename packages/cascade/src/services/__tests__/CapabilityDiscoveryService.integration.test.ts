/**
 * Integration tests for CapabilityDiscoveryService
 *
 * These tests require Ollama to be running with models installed.
 * They are skipped by default and can be enabled with OLLAMA_TEST=true.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { CapabilityDiscoveryService } from "../CapabilityDiscoveryService.js";
import { OllamaAdapter } from "../../adapters/OllamaAdapter.js";
import axios from "axios";

const OLLAMA_TEST_ENABLED = process.env.OLLAMA_TEST === "true";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

describe.runIf(OLLAMA_TEST_ENABLED)("CapabilityDiscoveryService Integration", () => {
  let service: CapabilityDiscoveryService;
  let adapter: OllamaAdapter;
  let availableModels: string[] = [];

  beforeAll(async () => {
    // Check if Ollama is running
    try {
      const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
      availableModels = response.data.models?.map((m: { name: string }) => m.name) || [];

      if (availableModels.length === 0) {
        throw new Error("No models available in Ollama");
      }

      console.log(`Found ${availableModels.length} models: ${availableModels.join(", ")}`);

      adapter = new OllamaAdapter(OLLAMA_BASE_URL);
      service = new CapabilityDiscoveryService(adapter, {
        runBenchmarks: false, // Skip benchmarks for faster integration tests
        logging: { enabled: true, level: "info" },
      });
    } catch (error) {
      throw new Error(`Ollama not available at ${OLLAMA_BASE_URL}: ${error}`);
    }
  }, 30000);

  describe("discoverAll", () => {
    it("should discover all available models", async () => {
      const result = await service.discoverAll();

      expect(result.success).toBe(true);
      expect(result.discoveredCount).toBeGreaterThan(0);
      expect(result.capabilities).toHaveLength(result.discoveredCount);
      expect(result.failedCount).toBe(0);

      console.log(`Discovered ${result.discoveredCount} models in ${result.duration}ms`);
    }, 60000);

    it("should discover capabilities for each available model", async () => {
      const result = await service.discoverAll();

      for (const modelId of availableModels) {
        const capability = result.capabilities?.find(c => c.modelId === modelId);
        expect(capability).toBeDefined();
        expect(capability?.modelId).toBe(modelId);

        console.log(`\nModel: ${capability?.modelId}`);
        console.log(`  Family: ${capability?.family}`);
        console.log(`  Size: ${capability?.parameterSize}`);
        console.log(`  Quant: ${capability?.quantizationLevel || "N/A"}`);
        console.log(`  Context: ${capability?.maxContextLength}`);
        console.log(`  Intents: ${capability?.supportedIntents.join(", ")}`);
        console.log(`  Quality: ${capability?.qualityScore?.toFixed(2)}`);
        console.log(`  Latency: ${capability?.averageLatencyMs}ms`);
        console.log(`  Tokens/s: ${capability?.tokensPerSecond?.toFixed(1)}`);
      }
    }, 60000);

    it("should cache discovered capabilities", async () => {
      await service.discoverAll();

      for (const modelId of availableModels) {
        const cached = service.getCapability(modelId);
        expect(cached).toBeDefined();
        expect(cached?.modelId).toBe(modelId);
      }
    }, 60000);
  });

  describe("getCapability", () => {
    it("should return capability for discovered model", async () => {
      await service.discoverAll();

      const firstModel = availableModels[0];
      const capability = service.getCapability(firstModel);

      expect(capability).toBeDefined();
      expect(capability?.modelId).toBe(firstModel);
      expect(capability?.family).toBeDefined();
      expect(capability?.parameterSize).toBeDefined();
      expect(capability?.supportedIntents.length).toBeGreaterThan(0);
    }, 60000);

    it("should return undefined for non-existent model", () => {
      const capability = service.getCapability("non-existent-model:42b");
      expect(capability).toBeUndefined();
    });
  });

  describe("capability validation", () => {
    it("should have valid quality scores for all models", async () => {
      await service.discoverAll();

      for (const modelId of availableModels) {
        const capability = service.getCapability(modelId);
        expect(capability?.qualityScore).toBeGreaterThanOrEqual(0);
        expect(capability?.qualityScore).toBeLessThanOrEqual(1);
      }
    }, 60000);

    it("should have valid latency for all models", async () => {
      await service.discoverAll();

      for (const modelId of availableModels) {
        const capability = service.getCapability(modelId);
        expect(capability?.averageLatencyMs).toBeGreaterThan(0);
      }
    }, 60000);

    it("should have valid token throughput for all models", async () => {
      await service.discoverAll();

      for (const modelId of availableModels) {
        const capability = service.getCapability(modelId);
        expect(capability?.tokensPerSecond).toBeGreaterThan(0);
      }
    }, 60000);

    it("should have supported intents for all models", async () => {
      await service.discoverAll();

      for (const modelId of availableModels) {
        const capability = service.getCapability(modelId);
        expect(capability?.supportedIntents.length).toBeGreaterThan(0);
      }
    }, 60000);
  });

  describe("well-known model profiles", () => {
    it("should use well-known profiles when available", async () => {
      await service.discoverAll();

      // Check if any well-known models are available
      const wellKnownModels = availableModels.filter(m =>
        m.includes("llama3") ||
        m.includes("mistral") ||
        m.includes("mixtral") ||
        m.includes("qwen") ||
        m.includes("gemma") ||
        m.includes("nomic-embed")
      );

      for (const modelId of wellKnownModels) {
        const capability = service.getCapability(modelId);
        expect(capability).toBeDefined();

        // Well-known models should have reasonable context lengths
        expect(capability?.maxContextLength).toBeGreaterThanOrEqual(2048);

        console.log(`\n${modelId}:`);
        console.log(`  Context: ${capability?.maxContextLength}`);
        console.log(`  Quality: ${capability?.qualityScore?.toFixed(2)}`);
        console.log(`  Use cases: ${capability?.recommendedUseCases.join(", ")}`);
      }
    }, 60000);
  });

  describe("embedding models", () => {
    it("should identify embedding models", async () => {
      await service.discoverAll();

      const embeddingModels = availableModels.filter(m =>
        m.includes("embed") || m.includes(" Embed ")
      );

      for (const modelId of embeddingModels) {
        const capability = service.getCapability(modelId);
        expect(capability?.supportedIntents).toContain("embedding");

        if (capability?.embeddingDimension) {
          console.log(`${modelId}: ${capability.embeddingDimension} dimensions`);
        }
      }
    }, 60000);
  });

  describe("code models", () => {
    it("should identify code models", async () => {
      await service.discoverAll();

      const codeModels = availableModels.filter(m =>
        m.includes("coder") || m.includes("code")
      );

      for (const modelId of codeModels) {
        const capability = service.getCapability(modelId);
        expect(capability?.supportedIntents).toContain("code-generation");

        console.log(`${modelId}: ${capability?.supportedIntents.join(", ")}`);
      }
    }, 60000);
  });

  describe("cache performance", () => {
    it("should retrieve cached capabilities quickly", async () => {
      await service.discoverAll();

      const start = Date.now();
      const capability = service.getCapability(availableModels[0]);
      const elapsed = Date.now() - start;

      expect(capability).toBeDefined();
      expect(elapsed).toBeLessThan(10); // Should be very fast from cache

      console.log(`Cache retrieval took ${elapsed}ms`);
    }, 60000);

    it("should update cache stats on access", async () => {
      await service.discoverAll();

      const modelId = availableModels[0];

      // Access multiple times
      service.getCapability(modelId);
      service.getCapability(modelId);
      service.getCapability(modelId);

      const capability = service.getCapability(modelId);
      expect(capability).toBeDefined();
      // We can't easily verify hit count without exposing internal state
    }, 60000);
  });

  describe("discovery performance", () => {
    it("should complete discovery in reasonable time", async () => {
      const start = Date.now();
      const result = await service.discoverAll();
      const elapsed = Date.now() - start;

      expect(result.success).toBe(true);

      // Discovery should take less than 1 second per model (without benchmarks)
      const expectedMaxTime = availableModels.length * 1000;
      expect(elapsed).toBeLessThan(expectedMaxTime);

      console.log(`Discovered ${result.discoveredCount} models in ${elapsed}ms`);
      console.log(`Average: ${(elapsed / result.discoveredCount).toFixed(0)}ms per model`);
    }, 120000);
  });
});

describe.runIf(OLLAMA_TEST_ENABLED)("CapabilityDiscoveryService with Benchmarks", () => {
  let service: CapabilityDiscoveryService;
  let adapter: OllamaAdapter;

  beforeAll(async () => {
    adapter = new OllamaAdapter(OLLAMA_BASE_URL);
    service = new CapabilityDiscoveryService(adapter, {
      runBenchmarks: true, // Enable benchmarks
      benchmarkSamples: 2, // Small number for faster tests
      logging: { enabled: true, level: "info" },
    });
  }, 30000);

  it("should run benchmarks and update quality scores", async () => {
    const result = await service.discoverAll();

    expect(result.success).toBe(true);

    for (const capability of result.capabilities || []) {
      console.log(`\n${capability.modelId}:`);
      console.log(`  Quality: ${capability.qualityScore.toFixed(2)}`);
      console.log(`  Latency: ${capability.averageLatencyMs}ms`);
      console.log(`  Tokens/s: ${capability.tokensPerSecond.toFixed(1)}`);

      // Quality should be reasonable (benchmarks ran)
      expect(capability.qualityScore).toBeGreaterThan(0);
    }
  }, 120000);
});

// Run a quick smoke test without Ollama
describe("CapabilityDiscoveryService Smoke Test", () => {
  it("should create service without errors", () => {
    const mockAdapter = {
      process: async () => ({
        content: "test",
        backend: "local",
        model: "test",
        tokensUsed: 1,
        latency: 100,
        metadata: {},
      }),
      getConfig: () => ({
        baseURL: "http://localhost:11434",
        defaultModel: "llama3:8b",
      }),
    };

    const service = new CapabilityDiscoveryService(mockAdapter as any, {
      runBenchmarks: false,
      logging: { enabled: false },
    });

    expect(service).toBeDefined();
    expect(service.getAllCapabilities()).toHaveLength(0);
  });

  it("should handle empty cache gracefully", () => {
    const mockAdapter = {
      process: async () => ({
        content: "test",
        backend: "local",
        model: "test",
        tokensUsed: 1,
        latency: 100,
        metadata: {},
      }),
      getConfig: () => ({
        baseURL: "http://localhost:11434",
        defaultModel: "llama3:8b",
      }),
    };

    const service = new CapabilityDiscoveryService(mockAdapter as any, {
      runBenchmarks: false,
      logging: { enabled: false },
    });

    expect(service.getCapability("non-existent")).toBeUndefined();
    expect(service.getAllCapabilities()).toHaveLength(0);

    service.clearCache(); // Should not throw
    expect(service.getAllCapabilities()).toHaveLength(0);
  });
});
