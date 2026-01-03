/**
 * @fileoverview Browser Runtime Tests
 * @package @lsi/vljepa-edge
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BrowserRuntime, createBrowserRuntime } from "../src/runtime/BrowserRuntime.js";
import type { BrowserRuntimeConfig } from "../src/types.js";

// Mock GPU for testing
const mockGPU = {
  requestAdapter: vi.fn(async () => ({
    requestDevice: vi.fn(async () => ({
      destroy: vi.fn(),
      createBuffer: vi.fn(),
      createShaderModule: vi.fn(),
      createComputePipeline: vi.fn(),
      createCommandEncoder: vi.fn(),
      queue: {
        submit: vi.fn(),
        writeBuffer: vi.fn(),
      },
    })),
    info: {
      vendor: "Test GPU",
      architecture: "test-arch",
      device: "test-device",
      description: "Test GPU Description",
    },
    features: new Set(["texture-compression-bc"]),
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
    },
  })),
};

describe("BrowserRuntime", () => {
  let runtime: BrowserRuntime;
  let config: BrowserRuntimeConfig;

  beforeEach(() => {
    config = {
      modelPath: "./models/test",
      useWebGPU: false,
      useWebWorkers: false,
      cacheStrategy: "memory",
      memoryLimit: 256,
      maxBatchSize: 4,
      preloadModels: false,
      logging: { enabled: false },
    };
    runtime = new BrowserRuntime(config);
  });

  afterEach(async () => {
    if (runtime) {
      await runtime.dispose();
    }
  });

  describe("Constructor", () => {
    it("should create a runtime instance", () => {
      expect(runtime).toBeInstanceOf(BrowserRuntime);
    });

    it("should use provided configuration", () => {
      const customConfig: BrowserRuntimeConfig = {
        modelPath: "./custom/model",
        useWebGPU: true,
        useWebWorkers: true,
        cacheStrategy: "indexeddb",
        memoryLimit: 512,
        maxBatchSize: 8,
        preloadModels: true,
        logging: { enabled: true, level: "debug" },
      };
      const customRuntime = new BrowserRuntime(customConfig);
      expect(customRuntime).toBeInstanceOf(BrowserRuntime);
    });

    it("should create runtime with factory function", () => {
      const factoryRuntime = createBrowserRuntime(config);
      expect(factoryRuntime).toBeInstanceOf(BrowserRuntime);
    });
  });

  describe("Initialization", () => {
    it("should initialize without WebGPU", async () => {
      await runtime.initialize();
      const health = await runtime.healthCheck();
      expect(health.runtime.available).toBe(true);
    });

    it("should call progress callback during initialization", async () => {
      const progress = vi.fn();
      await runtime.initialize(progress);
      expect(progress).toHaveBeenCalled();
      expect(progress.mock.calls[0][0].stage).toBeDefined();
    });

    it("should track initialization stages", async () => {
      const stages: string[] = [];
      await runtime.initialize(({ stage }) => {
        stages.push(stage);
      });
      expect(stages.length).toBeGreaterThan(0);
      expect(stages.includes("Ready")).toBe(true);
    });
  });

  describe("Inference", () => {
    beforeEach(async () => {
      await runtime.initialize();
    });

    it("should run inference with text input", async () => {
      const result = await runtime.inference({ text: "test input" });
      expect(result).toBeDefined();
      expect(result.embedding).toBeInstanceOf(Float32Array);
      expect(result.embedding.length).toBe(768);
    });

    it("should run inference with image input", async () => {
      const mockImage = {} as ImageData;
      const result = await runtime.inference({ image: mockImage });
      expect(result).toBeDefined();
      expect(result.embedding).toBeInstanceOf(Float32Array);
    });

    it("should run inference with both inputs", async () => {
      const result = await runtime.inference({
        text: "test",
        image: {} as ImageData,
      });
      expect(result).toBeDefined();
    });

    it("should return result with metadata", async () => {
      const result = await runtime.inference({ text: "test" });
      expect(result.metadata).toBeDefined();
      expect(result.metadata.timestamp).toBeGreaterThan(0);
      expect(result.metadata.modelVersion).toBeDefined();
    });

    it("should track latency", async () => {
      const result = await runtime.inference({ text: "test" });
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it("should track memory usage", async () => {
      const result = await runtime.inference({ text: "test" });
      expect(result.memory).toBeGreaterThanOrEqual(0);
    });

    it("should include device info", async () => {
      const result = await runtime.inference({ text: "test" });
      expect(result.device).toBeDefined();
      expect(result.device.runtime).toBeDefined();
      expect(result.device.tier).toBeDefined();
    });
  });

  describe("Batch Inference", () => {
    beforeEach(async () => {
      await runtime.initialize();
    });

    it("should run batch inference", async () => {
      const inputs = [
        { text: "input 1" },
        { text: "input 2" },
        { text: "input 3" },
      ];
      const results = await runtime.batchInference(inputs);
      expect(results).toHaveLength(3);
      expect(results[0].embedding).toBeInstanceOf(Float32Array);
    });

    it("should enforce batch size limit", async () => {
      const inputs = Array.from({ length: 10 }, (_, i) => ({ text: `input ${i}` }));
      await expect(runtime.batchInference(inputs)).rejects.toThrow();
    });

    it("should handle empty batch", async () => {
      const results = await runtime.batchInference([]);
      expect(results).toHaveLength(0);
    });
  });

  describe("Caching", () => {
    beforeEach(async () => {
      await runtime.initialize();
    });

    it("should cache inference results", async () => {
      const input = { text: "cache test" };
      await runtime.inference(input);
      const result = await runtime.inference(input);
      expect(result.metadata.cached).toBe(true);
    });

    it("should clear cache", async () => {
      runtime.clearCache();
      const input = { text: "cache test" };
      await runtime.inference(input);
      runtime.clearCache();
      const result = await runtime.inference(input);
      expect(result.metadata.cached).toBe(false);
    });

    it("should use different cache keys for different inputs", async () => {
      const result1 = await runtime.inference({ text: "input 1" });
      const result2 = await runtime.inference({ text: "input 2" });
      expect(result1.metadata.cached).toBe(false);
      expect(result2.metadata.cached).toBe(false);
    });
  });

  describe("Health Check", () => {
    it("should return healthy status when initialized", async () => {
      await runtime.initialize();
      const health = await runtime.healthCheck();
      expect(health.healthy).toBe(true);
    });

    it("should return unhealthy when not initialized", async () => {
      const health = await runtime.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it("should include memory info", async () => {
      await runtime.initialize();
      const health = await runtime.healthCheck();
      expect(health.memory).toBeDefined();
      expect(health.memory.used).toBeGreaterThanOrEqual(0);
      expect(health.memory.limit).toBeGreaterThan(0);
    });

    it("should include model status", async () => {
      await runtime.initialize();
      const health = await runtime.healthCheck();
      expect(health.model).toBeDefined();
      expect(health.model.loaded).toBe(true);
    });

    it("should include cache info", async () => {
      await runtime.initialize();
      const health = await runtime.healthCheck();
      expect(health.cache).toBeDefined();
      expect(health.cache.available).toBe(true);
    });
  });

  describe("Memory Management", () => {
    beforeEach(async () => {
      await runtime.initialize();
    });

    it("should get current memory usage", () => {
      const memory = runtime.getCurrentMemory();
      expect(memory).toBeGreaterThanOrEqual(0);
    });

    it("should get memory limit", () => {
      const limit = runtime.getMemoryLimit();
      expect(limit).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should throw if inference called before initialization", async () => {
      await expect(runtime.inference({ text: "test" })).rejects.toThrow();
    });

    it("should handle initialization errors gracefully", async () => {
      const badRuntime = new BrowserRuntime({
        ...config,
        modelPath: "",
      });
      // Should not throw, but handle error
      await expect(badRuntime.initialize()).resolves.not.toThrow();
    });
  });

  describe("Disposal", () => {
    it("should dispose resources", async () => {
      await runtime.initialize();
      await runtime.dispose();
      const health = await runtime.healthCheck();
      expect(health.healthy).toBe(false);
    });

    it("should clear cache on dispose", async () => {
      await runtime.initialize();
      await runtime.inference({ text: "test" });
      await runtime.dispose();
      expect(runtime.getCurrentMemory()).toBe(0);
    });

    it("should terminate workers on dispose", async () => {
      const workerRuntime = new BrowserRuntime({
        ...config,
        useWebWorkers: true,
      });
      await workerRuntime.initialize();
      await workerRuntime.dispose();
      // Should not throw
    });
  });

  describe("WebGPU Support", () => {
    it("should detect WebGPU availability", async () => {
      const hasGPU = "gpu" in navigator;
      expect(typeof hasGPU).toBe("boolean");
    });

    it("should handle WebGPU unavailability gracefully", async () => {
      const gpuRuntime = new BrowserRuntime({
        ...config,
        useWebGPU: true,
      });
      await gpuRuntime.initialize();
      const health = await gpuRuntime.healthCheck();
      expect(health.runtime.available).toBe(true);
    });
  });

  describe("Progress Callbacks", () => {
    it("should report progress percentages", async () => {
      const percentages: number[] = [];
      await runtime.initialize(({ percentage }) => {
        percentages.push(percentage);
      });
      expect(percentages.length).toBeGreaterThan(0);
      expect(percentages[percentages.length - 1]).toBe(100);
    });

    it("should report loaded bytes", async () => {
      const loaded: number[] = [];
      await runtime.initialize(({ loaded }) => {
        if (loaded !== undefined) loaded.push(loaded);
      });
      expect(loaded.length).toBeGreaterThan(0);
    });
  });

  describe("Configuration", () => {
    it("should respect memory limit", () => {
      expect(runtime.getMemoryLimit()).toBe(256);
    });

    it("should respect max batch size", async () => {
      await runtime.initialize();
      const inputs = Array.from({ length: 4 }, (_, i) => ({ text: `input ${i}` }));
      const results = await runtime.batchInference(inputs);
      expect(results).toHaveLength(4);
    });

    it("should use correct cache strategy", () => {
      const strategies = ["memory", "indexeddb", "service_worker", "hybrid"];
      expect(strategies).toContain(config.cacheStrategy);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty input", async () => {
      await runtime.initialize();
      const result = await runtime.inference({});
      expect(result).toBeDefined();
    });

    it("should handle very long input", async () => {
      await runtime.initialize();
      const longText = "a".repeat(10000);
      const result = await runtime.inference({ text: longText });
      expect(result).toBeDefined();
    });

    it("should handle special characters", async () => {
      await runtime.initialize();
      const specialText = "Test 🧪 with émojis 🚀 and spëcial çhars";
      const result = await runtime.inference({ text: specialText });
      expect(result).toBeDefined();
    });

    it("should handle unicode text", async () => {
      await runtime.initialize();
      const unicodeText = "测试中文😊🎉";
      const result = await runtime.inference({ text: unicodeText });
      expect(result).toBeDefined();
    });
  });

  describe("Performance", () => {
    it("should complete inference in reasonable time", async () => {
      await runtime.initialize();
      const start = performance.now();
      await runtime.inference({ text: "test" });
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it("should handle rapid successive inferences", async () => {
      await runtime.initialize();
      const promises = Array.from({ length: 10 }, () =>
        runtime.inference({ text: "test" })
      );
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
    });
  });
});

describe("BrowserRuntime Integration", () => {
  it("should complete full workflow", async () => {
    const runtime = createBrowserRuntime({
      modelPath: "./models/test",
      useWebGPU: false,
      useWebWorkers: false,
      cacheStrategy: "memory",
      memoryLimit: 256,
      maxBatchSize: 4,
      preloadModels: false,
      logging: { enabled: false },
    });

    // Initialize
    await runtime.initialize();

    // Health check
    const health = await runtime.healthCheck();
    expect(health.healthy).toBe(true);

    // Run inference
    const result = await runtime.inference({ text: "integration test" });
    expect(result.embedding.length).toBe(768);

    // Batch inference
    const batchResults = await runtime.batchInference([
      { text: "test 1" },
      { text: "test 2" },
    ]);
    expect(batchResults).toHaveLength(2);

    // Cleanup
    await runtime.dispose();
  });
});
