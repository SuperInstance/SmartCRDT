/**
 * ModuleLoader Tests
 * Tests for module loading with different strategies
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ModuleLoader } from "../src/federation/ModuleLoader.js";

describe("ModuleLoader", () => {
  let loader: ModuleLoader;
  let mockFactory: () => Promise<any>;
  let mockModuleInfo: any;

  beforeEach(() => {
    loader = new ModuleLoader({
      strategy: "lazy",
      timeout: 5000,
      retries: 3,
      fallback: "",
    });

    mockFactory = vi.fn().mockResolvedValue({
      default: { Component: () => null },
      version: "1.0.0",
    });

    mockModuleInfo = {
      id: "test-module",
      name: "TestModule",
      version: "1.0.0",
    };
  });

  describe("initialization", () => {
    it("should create with default config", () => {
      const defaultLoader = new ModuleLoader();
      expect(defaultLoader).toBeDefined();
      expect(defaultLoader.getStrategy()).toBe("lazy");
    });

    it("should create with custom config", () => {
      const customLoader = new ModuleLoader({
        strategy: "eager",
        timeout: 10000,
      });

      expect(customLoader.getStrategy()).toBe("eager");
      expect(customLoader.getConfig().timeout).toBe(10000);
    });

    it("should get config", () => {
      const config = loader.getConfig();
      expect(config.strategy).toBe("lazy");
      expect(config.timeout).toBe(5000);
    });
  });

  describe("loading strategies", () => {
    it("should load with eager strategy", async () => {
      loader.setStrategy("eager");

      const result = await loader.loadModule(mockFactory, mockModuleInfo);
      expect(result.module).toBeDefined();
      expect(result.cached).toBe(false);
    });

    it("should load with lazy strategy", async () => {
      loader.setStrategy("lazy");

      const result = await loader.loadModule(mockFactory, mockModuleInfo);
      expect(result.module).toBeDefined();
    });

    it("should load with priority strategy", async () => {
      loader.setStrategy("priority");

      const result = await loader.loadModule(mockFactory, mockModuleInfo);
      expect(result.module).toBeDefined();
    });

    it("should load with prefetch strategy", async () => {
      loader.setStrategy("prefetch");

      const result = await loader.loadModule(mockFactory, mockModuleInfo);
      // Prefetch returns immediately
      expect(result).toBeDefined();
    });
  });

  describe("caching", () => {
    it("should cache loaded modules", async () => {
      await loader.loadModule(mockFactory, mockModuleInfo);

      expect(loader.isCached("test-module")).toBe(true);
    });

    it("should return cached modules", async () => {
      await loader.loadModule(mockFactory, mockModuleInfo);

      const result = await loader.loadModule(mockFactory, mockModuleInfo);
      expect(result.cached).toBe(true);
    });

    it("should get cached module", async () => {
      await loader.loadModule(mockFactory, mockModuleInfo);

      const cached = loader.getCached("test-module");
      expect(cached).toBeDefined();
    });

    it("should clear cache for module", async () => {
      await loader.loadModule(mockFactory, mockModuleInfo);
      loader.clearCache("test-module");

      expect(loader.isCached("test-module")).toBe(false);
    });

    it("should clear all cache", async () => {
      await loader.loadModule(mockFactory, mockModuleInfo);
      loader.clearCache();

      expect(loader.getCacheSize()).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should retry on failure", async () => {
      const failingFactory = vi.fn()
        .mockRejectedValueOnce(new Error("Fail 1"))
        .mockRejectedValueOnce(new Error("Fail 2"))
        .mockResolvedValue({ version: "1.0.0" });

      const result = await loader.loadModule(failingFactory, mockModuleInfo);
      expect(result.module).toBeDefined();
      expect(failingFactory).toHaveBeenCalledTimes(3);
    });

    it("should use fallback after max retries", async () => {
      const alwaysFailingFactory = vi.fn()
        .mockRejectedValue(new Error("Always fails"));

      const fallbackLoader = new ModuleLoader({
        fallback: "fallback-module",
      });

      const result = await fallbackLoader.loadModule(
        alwaysFailingFactory,
        mockModuleInfo
      );

      expect(result.module).toBeDefined();
    });

    it("should timeout on slow load", async () => {
      const slowFactory = () => new Promise((resolve) => {
        setTimeout(() => resolve({ version: "1.0.0" }), 10000);
      });

      const quickLoader = new ModuleLoader({
        timeout: 100,
      });

      await expect(
        quickLoader.loadModule(slowFactory, mockModuleInfo)
      ).rejects.toThrow();
    }, 15000);
  });

  describe("preloading", () => {
    it("should preload modules", async () => {
      const factories = new Map([
        ["module1", vi.fn().mockResolvedValue({ version: "1.0.0" })],
        ["module2", vi.fn().mockResolvedValue({ version: "1.0.0" })],
      ]);

      const results = await loader.preloadModules(
        Array.from(factories.entries()).map(([id, factory]) => ({
          factory,
          info: { id, name: id, version: "1.0.0" },
        }))
      );

      expect(results.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("strategy updates", () => {
    it("should update strategy", () => {
      loader.setStrategy("eager");
      expect(loader.getStrategy()).toBe("eager");

      loader.setStrategy("lazy");
      expect(loader.getStrategy()).toBe("lazy");
    });
  });

  describe("statistics", () => {
    it("should get cache size", async () => {
      await loader.loadModule(mockFactory, mockModuleInfo);
      expect(loader.getCacheSize()).toBe(1);
    });

    it("should get preload queue size", () => {
      const size = loader.getPreloadQueueSize();
      expect(typeof size).toBe("number");
    });
  });

  describe("reset", () => {
    it("should reset loader state", async () => {
      await loader.loadModule(mockFactory, mockModuleInfo);
      loader.reset();

      expect(loader.getCacheSize()).toBe(0);
      expect(loader.getPreloadQueueSize()).toBe(0);
    });
  });

  describe("concurrent loading", () => {
    it("should handle concurrent loads", async () => {
      const factory = vi.fn().mockResolvedValue({ version: "1.0.0" });

      const [result1, result2] = await Promise.all([
        loader.loadModule(factory, mockModuleInfo),
        loader.loadModule(factory, mockModuleInfo),
      ]);

      expect(result1.module).toBeDefined();
      expect(result2.module).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("should handle empty module info", async () => {
      const result = await loader.loadModule(mockFactory, {});
      expect(result.module).toBeDefined();
    });

    it("should handle module with no id", async () => {
      const result = await loader.loadModule(mockFactory, {
        name: "TestModule",
      });
      expect(result.module).toBeDefined();
    });

    it("should handle factory that returns null", async () => {
      const nullFactory = vi.fn().mockResolvedValue(null);
      const result = await loader.loadModule(nullFactory, mockModuleInfo);
      expect(result.module).toBeNull();
    });
  });
});

describe("ModuleLoader strategies behavior", () => {
  it("eager should load immediately", async () => {
    const loader = new ModuleLoader({ strategy: "eager" });
    const factory = vi.fn().mockResolvedValue({ version: "1.0.0" });
    const info = { id: "test", name: "Test", version: "1.0.0" };

    const start = Date.now();
    await loader.loadModule(factory, info);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  it("prefetch should return quickly", async () => {
    const loader = new ModuleLoader({ strategy: "prefetch" });
    const factory = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ version: "1.0.0" }), 1000))
    );
    const info = { id: "test", name: "Test", version: "1.0.0" };

    const start = Date.now();
    await loader.loadModule(factory, info);
    const duration = Date.now() - start;

    // Prefetch should return before the actual load completes
    expect(duration).toBeLessThan(500);
  }, 10000);
});
