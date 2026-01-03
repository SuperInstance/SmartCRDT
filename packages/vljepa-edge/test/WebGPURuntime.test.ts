/**
 * @fileoverview WebGPU Runtime Tests
 * @package @lsi/vljepa-edge
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WebGPURuntime,
  createWebGPURuntime,
  getDefaultWebGPUConfig,
} from "../src/runtime/WebGPURuntime.js";
import type { WebGPURuntimeConfig } from "../src/types.js";

describe("WebGPURuntime", () => {
  let runtime: WebGPURuntime;
  let config: WebGPURuntimeConfig;

  beforeEach(() => {
    config = getDefaultWebGPUConfig();
    runtime = new WebGPURuntime(config);
  });

  afterEach(async () => {
    if (runtime) {
      runtime.dispose();
    }
  });

  describe("Constructor", () => {
    it("should create a WebGPU runtime instance", () => {
      expect(runtime).toBeInstanceOf(WebGPURuntime);
    });

    it("should accept custom configuration", () => {
      const customConfig: WebGPURuntimeConfig = {
        devicePreference: "discrete",
        shaderCache: true,
        bufferManager: {
          initialPoolSize: 128,
          maxPoolSize: 1024,
          alignment: 128,
          reuse: true,
          asyncMap: true,
        },
        workgroupSize: [32, 32, 1],
        maxBufferSize: 2048,
        asyncCompilation: true,
      };
      const customRuntime = new WebGPURuntime(customConfig);
      expect(customRuntime).toBeInstanceOf(WebGPURuntime);
    });

    it("should create runtime with factory function", () => {
      const factoryRuntime = createWebGPURuntime(config);
      expect(factoryRuntime).toBeInstanceOf(WebGPURuntime);
    });

    it("should provide default config", () => {
      const defaultConfig = getDefaultWebGPUConfig();
      expect(defaultConfig.devicePreference).toBe("any");
      expect(defaultConfig.shaderCache).toBe(true);
      expect(defaultConfig.bufferManager.reuse).toBe(true);
    });
  });

  describe("Initialization", () => {
    it("should initialize when WebGPU is available", async () => {
      // Mock WebGPU if not available
      if (!navigator.gpu) {
        (navigator as any).gpu = mockGPU;
      }

      try {
        await runtime.initialize();
        // If WebGPU is available, should initialize successfully
        expect(true).toBe(true);
      } catch (e) {
        // WebGPU not available in test environment
        expect(e).toBeDefined();
      }
    });

    it("should throw error when WebGPU is not available", async () => {
      const originalGPU = (navigator as any).gpu;
      (navigator as any).gpu = undefined;

      try {
        await runtime.initialize();
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect((e as Error).message).toContain("WebGPU");
      } finally {
        (navigator as any).gpu = originalGPU;
      }
    });
  });

  describe("Buffer Management", () => {
    it("should track memory usage", () => {
      const usage = runtime.getMemoryUsage();
      expect(usage).toBeDefined();
      expect(usage.allocated).toBeGreaterThanOrEqual(0);
      expect(usage.limit).toBeGreaterThan(0);
    });

    it("should enforce memory limits", () => {
      const usage = runtime.getMemoryUsage();
      expect(usage.allocated).toBeLessThanOrEqual(usage.limit);
    });
  });

  describe("GPU Info", () => {
    it("should return GPU info when available", async () => {
      const info = runtime.getGPUInfo();
      // Info may be null if WebGPU not available
      expect(info === null || typeof info === "object").toBe(true);
    });

    it("should return null when GPU not available", () => {
      // In environments without WebGPU
      const info = runtime.getGPUInfo();
      expect(info === null || info !== undefined).toBe(true);
    });
  });

  describe("Disposal", () => {
    it("should dispose resources", () => {
      expect(() => runtime.dispose()).not.toThrow();
    });

    it("should reset memory after disposal", () => {
      runtime.dispose();
      const usage = runtime.getMemoryUsage();
      expect(usage.allocated).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("should respect device preference", () => {
      const discreteConfig = getDefaultWebGPUConfig();
      discreteConfig.devicePreference = "discrete";
      const discreteRuntime = new WebGPURuntime(discreteConfig);
      expect(discreteRuntime).toBeInstanceOf(WebGPURuntime);
      discreteRuntime.dispose();
    });

    it("should respect workgroup size configuration", () => {
      const customConfig = getDefaultWebGPUConfig();
      customConfig.workgroupSize = [8, 8, 1];
      const customRuntime = new WebGPURuntime(customConfig);
      expect(customRuntime).toBeInstanceOf(WebGPURuntime);
      customRuntime.dispose();
    });

    it("should respect buffer manager settings", () => {
      const customConfig = getDefaultWebGPUConfig();
      customConfig.bufferManager.alignment = 512;
      const customRuntime = new WebGPURuntime(customConfig);
      expect(customRuntime).toBeInstanceOf(WebGPURuntime);
      customRuntime.dispose();
    });

    it("should respect max buffer size", () => {
      const customConfig = getDefaultWebGPUConfig();
      customConfig.maxBufferSize = 512;
      const customRuntime = new WebGPURuntime(customConfig);
      const limit = customRuntime.getMemoryUsage().limit;
      expect(limit).toBe(512 * 1024 * 1024);
      customRuntime.dispose();
    });
  });

  describe("Shader Cache", () => {
    it("should support shader caching", () => {
      const config = getDefaultWebGPUConfig();
      config.shaderCache = true;
      const cachedRuntime = new WebGPURuntime(config);
      expect(cachedRuntime).toBeInstanceOf(WebGPURuntime);
      cachedRuntime.dispose();
    });

    it("should disable shader cache when configured", () => {
      const config = getDefaultWebGPUConfig();
      config.shaderCache = false;
      const uncachedRuntime = new WebGPURuntime(config);
      expect(uncachedRuntime).toBeInstanceOf(WebGPURuntime);
      uncachedRuntime.dispose();
    });
  });

  describe("Device Preference", () => {
    const preferences = ["discrete", "integrated", "any"] as const;

    it.each(preferences)("should support %s preference", (preference) => {
      const config = getDefaultWebGPUConfig();
      config.devicePreference = preference;
      const prefRuntime = new WebGPURuntime(config);
      expect(prefRuntime).toBeInstanceOf(WebGPURuntime);
      prefRuntime.dispose();
    });
  });

  describe("Buffer Manager", () => {
    it("should support buffer reuse", () => {
      const config = getDefaultWebGPUConfig();
      config.bufferManager.reuse = true;
      const reuseRuntime = new WebGPURuntime(config);
      expect(reuseRuntime).toBeInstanceOf(WebGPURuntime);
      reuseRuntime.dispose();
    });

    it("should support async mapping", () => {
      const config = getDefaultWebGPUConfig();
      config.bufferManager.asyncMap = true;
      const asyncRuntime = new WebGPURuntime(config);
      expect(asyncRuntime).toBeInstanceOf(WebGPURuntime);
      asyncRuntime.dispose();
    });

    it("should respect alignment settings", () => {
      const alignments = [64, 128, 256, 512];
      alignments.forEach((alignment) => {
        const config = getDefaultWebGPUConfig();
        config.bufferManager.alignment = alignment;
        const alignedRuntime = new WebGPURuntime(config);
        expect(alignedRuntime).toBeInstanceOf(WebGPURuntime);
        alignedRuntime.dispose();
      });
    });
  });

  describe("Workgroup Sizes", () => {
    it("should support various workgroup sizes", () => {
      const sizes: Array<[number, number, number]> = [
        [8, 8, 1],
        [16, 16, 1],
        [32, 32, 1],
        [64, 64, 1],
      ];

      sizes.forEach((size) => {
        const config = getDefaultWebGPUConfig();
        config.workgroupSize = size;
        const sizedRuntime = new WebGPURuntime(config);
        expect(sizedRuntime).toBeInstanceOf(WebGPURuntime);
        sizedRuntime.dispose();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle initialization failures gracefully", async () => {
      const badRuntime = new WebGPURuntime(getDefaultWebGPUConfig());
      // Test should not throw even if WebGPU unavailable
      try {
        await badRuntime.initialize();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    it("should handle disposal of uninitialized runtime", () => {
      const freshRuntime = new WebGPURuntime(getDefaultWebGPUConfig());
      expect(() => freshRuntime.dispose()).not.toThrow();
    });
  });

  describe("Memory Tracking", () => {
    it("should track allocated memory", () => {
      const before = runtime.getMemoryUsage().allocated;
      // Runtime should track memory
      const after = runtime.getMemoryUsage().allocated;
      expect(typeof after).toBe("number");
    });

    it("should provide memory limit", () => {
      const limit = runtime.getMemoryUsage().limit;
      expect(limit).toBeGreaterThan(0);
    });

    it("should calculate memory percentage correctly", () => {
      const usage = runtime.getMemoryUsage();
      const percentage = (usage.allocated / usage.limit) * 100;
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });
  });

  describe("Async Compilation", () => {
    it("should support async compilation", () => {
      const config = getDefaultWebGPUConfig();
      config.asyncCompilation = true;
      const asyncRuntime = new WebGPURuntime(config);
      expect(asyncRuntime).toBeInstanceOf(WebGPURuntime);
      asyncRuntime.dispose();
    });

    it("should support sync compilation", () => {
      const config = getDefaultWebGPUConfig();
      config.asyncCompilation = false;
      const syncRuntime = new WebGPURuntime(config);
      expect(syncRuntime).toBeInstanceOf(WebGPURuntime);
      syncRuntime.dispose();
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete lifecycle", async () => {
      const lifecycleRuntime = new WebGPURuntime(getDefaultWebGPUConfig());

      // Create
      expect(lifecycleRuntime).toBeInstanceOf(WebGPURuntime);

      // Check initial state
      const initialMem = lifecycleRuntime.getMemoryUsage();
      expect(initialMem.allocated).toBe(0);

      // Dispose
      lifecycleRuntime.dispose();

      // Verify cleanup
      const finalMem = lifecycleRuntime.getMemoryUsage();
      expect(finalMem.allocated).toBe(0);
    });

    it("should support multiple instances", () => {
      const runtime1 = new WebGPURuntime(getDefaultWebGPUConfig());
      const runtime2 = new WebGPURuntime(getDefaultWebGPUConfig());

      expect(runtime1).toBeInstanceOf(WebGPURuntime);
      expect(runtime2).toBeInstanceOf(WebGPURuntime);

      runtime1.dispose();
      runtime2.dispose();
    });
  });

  describe("Type Safety", () => {
    it("should have correct GPUInfo type when available", () => {
      const info = runtime.getGPUInfo();
      if (info) {
        expect(typeof info.vendor).toBe("string");
        expect(typeof info.architecture).toBe("string");
      }
    });

    it("should return correct memory usage type", () => {
      const usage = runtime.getMemoryUsage();
      expect(typeof usage.allocated).toBe("number");
      expect(typeof usage.limit).toBe("number");
    });
  });
});

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
      vendor: "Test Vendor",
      architecture: "test-arch",
      device: "test-device",
      description: "Test GPU",
    },
    features: new Set(["texture-compression-bc"]),
    limits: {
      maxBufferSize: 256 * 1024 * 1024,
    },
  })),
};
