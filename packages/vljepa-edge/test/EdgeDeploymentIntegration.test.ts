/**
 * @fileoverview Edge Deployment Integration Tests
 * @package @lsi/vljepa-edge
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createBrowserRuntime,
  createWebGPURuntime,
  createWASMRuntime,
  createHybridRuntime,
  createModelManager,
  createCacheManager,
  createPerformanceMonitor,
  CapabilityDetector,
  detectCapabilities,
  getDeviceProfile,
  type BrowserRuntimeConfig,
  type WebGPURuntimeConfig,
  type WASMRuntimeConfig,
  type HybridRuntimeConfig,
} from "../src/index.js";

describe("Edge Deployment Integration", () => {
  describe("Complete Workflow", () => {
    it("should complete full deployment workflow", async () => {
      // 1. Detect capabilities
      const capabilities = await detectCapabilities();
      expect(capabilities).toBeDefined();

      // 2. Get device profile
      const profile = await getDeviceProfile();
      expect(profile).toBeDefined();

      // 3. Create runtime based on profile
      const runtimeConfig: BrowserRuntimeConfig = {
        modelPath: "./models/test",
        useWebGPU: profile.recommendedRuntime !== "wasm",
        useWebWorkers: capabilities.workers,
        cacheStrategy: "memory",
        memoryLimit: 256,
        maxBatchSize: profile.batchSize,
        preloadModels: false,
        logging: { enabled: false },
      };

      const runtime = createBrowserRuntime(runtimeConfig);
      expect(runtime).toBeInstanceOf(Object);

      // 4. Initialize runtime
      await runtime.initialize();

      // 5. Health check
      const health = await runtime.healthCheck();
      expect(health.healthy).toBe(true);

      // 6. Run inference
      const result = await runtime.inference({ text: "integration test" });
      expect(result.embedding).toBeInstanceOf(Float32Array);

      // 7. Cleanup
      await runtime.dispose();
    });

    it("should handle error in workflow gracefully", async () => {
      const runtime = createBrowserRuntime({
        modelPath: "",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 256,
        maxBatchSize: 1,
        preloadModels: false,
        logging: { enabled: false },
      });

      // Should handle errors gracefully
      await expect(runtime.initialize()).resolves.not.toThrow();

      await runtime.dispose();
    });
  });

  describe("Runtime Selection", () => {
    it("should select appropriate runtime based on capabilities", async () => {
      const capabilities = await detectCapabilities();
      const profile = await getDeviceProfile();

      if (profile.recommendedRuntime === "webgpu" && capabilities.webGPU) {
        const webgpuRuntime = createWebGPURuntime({
          devicePreference: "any",
          shaderCache: true,
          bufferManager: {
            initialPoolSize: 64,
            maxPoolSize: 512,
            alignment: 256,
            reuse: true,
            asyncMap: true,
          },
          workgroupSize: [16, 16, 1],
          maxBufferSize: 1024,
          asyncCompilation: true,
        });
        expect(webgpuRuntime).toBeDefined();
        webgpuRuntime.dispose();
      } else if (profile.recommendedRuntime === "wasm") {
        const wasmRuntime = createWASMRuntime({
          memoryPageSize: 256,
          maxMemoryPages: 4096,
          useSIMD: true,
          useMultiThreading: capabilities.cores,
          useBulkMemory: true,
          useSaturatedFloatToInt: true,
        });
        expect(wasmRuntime).toBeDefined();
        wasmRuntime.dispose();
      } else {
        const hybridRuntime = createHybridRuntime({
          webgpu: {
            devicePreference: "any",
            shaderCache: true,
            bufferManager: {
              initialPoolSize: 64,
              maxPoolSize: 512,
              alignment: 256,
              reuse: true,
              asyncMap: true,
            },
            workgroupSize: [16, 16, 1],
            maxBufferSize: 1024,
            asyncCompilation: true,
          },
          wasm: {
            memoryPageSize: 256,
            maxMemoryPages: 4096,
            useSIMD: true,
            useMultiThreading: capabilities.cores,
            useBulkMemory: true,
            useSaturatedFloatToInt: true,
          },
          fallbackThreshold: 40,
          autoFallback: true,
          fallbackCooldown: 5000,
        });
        expect(hybridRuntime).toBeDefined();
        hybridRuntime.dispose();
      }
    });
  });

  describe("Manager Integration", () => {
    it("should integrate model and cache managers", async () => {
      const modelManager = createModelManager({
        maxModels: 2,
        cacheSize: 256,
        preload: [],
        updateStrategy: "manual",
        versionCheckInterval: 3600000,
        verifyIntegrity: false,
        maxConcurrentDownloads: 2,
      });

      const cacheManager = createCacheManager({
        indexedDB: {
          enabled: false,
          dbName: "test-cache",
          storeName: "entries",
          version: 1,
        },
        serviceWorker: {
          enabled: false,
          scriptPath: "/sw.js",
          scope: "/",
        },
        memoryCache: {
          enabled: true,
          maxSize: 64,
          ttl: 1800000,
        },
        maxCacheSize: 128,
        versioning: true,
        compression: false,
      });

      // Register and load model
      modelManager.registerModel({
        id: "test-model",
        version: "1.0.0",
        size: 50,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["wasm"],
      });

      await modelManager.initialize();

      // Cache data
      await cacheManager.initialize();
      await cacheManager.set("test-key", new ArrayBuffer(100));

      const cached = await cacheManager.get("test-key");
      expect(cached).toBeInstanceOf(ArrayBuffer);

      // Cleanup
      await modelManager.dispose();
      cacheManager.dispose();
    });

    it("should integrate performance monitor", async () => {
      const monitor = createPerformanceMonitor({
        collectionInterval: 1000,
        sampleSize: 100,
        autoProfiling: false,
        alerts: {
          latencyThreshold: 1000,
          memoryThreshold: 512,
          errorRateThreshold: 0.1,
        },
        exportMetrics: false,
      });

      monitor.start();

      // Record some metrics
      monitor.recordInference({
        latency: 100,
        memory: 50,
        error: false,
        batchSize: 1,
        cached: false,
      });

      monitor.recordInference({
        latency: 150,
        memory: 60,
        error: false,
        batchSize: 1,
        cached: true,
      });

      const metrics = monitor.getMetrics();
      expect(metrics.latency.p50).toBeGreaterThan(0);
      expect(metrics.memory.current).toBeGreaterThan(0);

      monitor.stop();
    });
  });

  describe("Device Profile Integration", () => {
    it("should optimize configuration based on profile", async () => {
      const profile = await getDeviceProfile();

      // High tier should use WebGPU
      if (profile.tier === "high") {
        expect(profile.recommendedRuntime).toBe("webgpu");
        expect(profile.quantization).toBe("fp32");
      }

      // Low tier should use WASM
      if (profile.tier === "low") {
        expect(["wasm", "hybrid"]).toContain(profile.recommendedRuntime);
        expect(["int8", "fp16"]).toContain(profile.quantization);
      }
    });

    it("should respect batch size limits", async () => {
      const profile = await getDeviceProfile();
      const runtime = createBrowserRuntime({
        modelPath: "./models/test",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 256,
        maxBatchSize: profile.batchSize,
        preloadModels: false,
        logging: { enabled: false },
      });

      await runtime.initialize();

      // Should handle batch size
      const inputs = Array.from({ length: profile.batchSize }, (_, i) => ({
        text: `input ${i}`,
      }));
      const results = await runtime.batchInference(inputs);
      expect(results).toHaveLength(profile.batchSize);

      await runtime.dispose();
    });
  });

  describe("Memory Management Integration", () => {
    it("should manage memory across components", async () => {
      const runtime = createBrowserRuntime({
        modelPath: "./models/test",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 128,
        maxBatchSize: 2,
        preloadModels: false,
        logging: { enabled: false },
      });

      await runtime.initialize();

      const memoryBefore = runtime.getCurrentMemory();

      // Run some inferences
      await runtime.inference({ text: "test 1" });
      await runtime.inference({ text: "test 2" });

      const memoryAfter = runtime.getCurrentMemory();

      expect(memoryAfter).toBeGreaterThanOrEqual(memoryBefore);

      await runtime.dispose();
      expect(runtime.getCurrentMemory()).toBe(0);
    });
  });

  describe("Cache Integration", () => {
    it("should use cache across inference calls", async () => {
      const runtime = createBrowserRuntime({
        modelPath: "./models/test",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 256,
        maxBatchSize: 1,
        preloadModels: false,
        logging: { enabled: false },
      });

      await runtime.initialize();

      const input = { text: "cache integration test" };

      // First call
      const result1 = await runtime.inference(input);
      expect(result1.metadata.cached).toBe(false);

      // Second call should use cache
      const result2 = await runtime.inference(input);
      expect(result2.metadata.cached).toBe(true);

      await runtime.dispose();
    });
  });

  describe("Health Monitoring Integration", () => {
    it("should provide comprehensive health status", async () => {
      const runtime = createBrowserRuntime({
        modelPath: "./models/test",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 256,
        maxBatchSize: 1,
        preloadModels: false,
        logging: { enabled: false },
      });

      await runtime.initialize();

      const health = await runtime.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.runtime.available).toBe(true);
      expect(health.model.loaded).toBe(true);
      expect(health.cache.available).toBe(true);
      expect(health.memory.used).toBeGreaterThanOrEqual(0);
      expect(health.memory.limit).toBeGreaterThan(0);

      await runtime.dispose();
    });
  });

  describe("Performance Tracking Integration", () => {
    it("should track performance metrics", async () => {
      const runtime = createBrowserRuntime({
        modelPath: "./models/test",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 256,
        maxBatchSize: 1,
        preloadModels: false,
        logging: { enabled: false },
      });

      const monitor = createPerformanceMonitor({
        collectionInterval: 100,
        sampleSize: 50,
        autoProfiling: false,
        alerts: {
          latencyThreshold: 5000,
          memoryThreshold: 512,
          errorRateThreshold: 0.5,
        },
        exportMetrics: false,
      });

      await runtime.initialize();
      monitor.start();

      // Run inferences and track performance
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await runtime.inference({ text: `test ${i}` });
        const latency = performance.now() - start;

        monitor.recordInference({
          latency,
          memory: runtime.getCurrentMemory(),
          error: false,
          batchSize: 1,
          cached: false,
        });
      }

      const metrics = monitor.getMetrics();
      expect(metrics.throughput.rps).toBeGreaterThan(0);

      monitor.stop();
      await runtime.dispose();
    });
  });

  describe("Error Recovery Integration", () => {
    it("should recover from errors gracefully", async () => {
      const runtime = createBrowserRuntime({
        modelPath: "./models/test",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 256,
        maxBatchSize: 1,
        preloadModels: false,
        logging: { enabled: false },
      });

      await runtime.initialize();

      // Should handle invalid input gracefully
      const result = await runtime.inference({});
      expect(result).toBeDefined();

      await runtime.dispose();
    });
  });

  describe("Multi-Tenant Scenarios", () => {
    it("should support multiple isolated sessions", async () => {
      const runtime1 = createBrowserRuntime({
        modelPath: "./models/test",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 128,
        maxBatchSize: 1,
        preloadModels: false,
        logging: { enabled: false },
      });

      const runtime2 = createBrowserRuntime({
        modelPath: "./models/test",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 128,
        maxBatchSize: 1,
        preloadModels: false,
        logging: { enabled: false },
      });

      await Promise.all([runtime1.initialize(), runtime2.initialize()]);

      // Both runtimes should work independently
      const result1 = await runtime1.inference({ text: "session 1" });
      const result2 = await runtime2.inference({ text: "session 2" });

      expect(result1.embedding).toBeInstanceOf(Float32Array);
      expect(result2.embedding).toBeInstanceOf(Float32Array);

      await Promise.all([runtime1.dispose(), runtime2.dispose()]);
    });
  });

  describe("Resource Cleanup Integration", () => {
    it("should properly cleanup all resources", async () => {
      const components: Array<{ dispose: () => Promise<void> | void }> = [];

      // Create various components
      components.push(createBrowserRuntime({
        modelPath: "./models/test",
        useWebGPU: false,
        useWebWorkers: false,
        cacheStrategy: "memory",
        memoryLimit: 128,
        maxBatchSize: 1,
        preloadModels: false,
        logging: { enabled: false },
      }));

      components.push(createModelManager({
        maxModels: 1,
        cacheSize: 128,
        preload: [],
        updateStrategy: "manual",
        versionCheckInterval: 3600000,
        verifyIntegrity: false,
        maxConcurrentDownloads: 1,
      }));

      components.push(createCacheManager({
        indexedDB: { enabled: false, dbName: "test", storeName: "test", version: 1 },
        serviceWorker: { enabled: false, scriptPath: "/sw.js", scope: "/" },
        memoryCache: { enabled: true, maxSize: 32, ttl: 1800000 },
        maxCacheSize: 64,
        versioning: false,
        compression: false,
      }));

      // Initialize components
      const runtime = components[0] as ReturnType<typeof createBrowserRuntime>;
      await runtime.initialize();

      // Cleanup all
      for (const component of components) {
        await component.dispose();
      }

      // Verify cleanup
      const health = await runtime.healthCheck();
      expect(health.model.loaded).toBe(false);
    });
  });
});
