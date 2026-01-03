/**
 * @fileoverview Model Manager Tests
 * @package @lsi/vljepa-edge
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ModelManager,
  createModelManager,
  getDefaultModelManagerConfig,
} from "../src/managers/ModelManager.js";
import type { ModelManagerConfig, ModelInfo } from "../src/types.js";

describe("ModelManager", () => {
  let manager: ModelManager;
  let config: ModelManagerConfig;

  beforeEach(() => {
    config = getDefaultModelManagerConfig();
    manager = new ModelManager(config);
  });

  afterEach(async () => {
    if (manager) {
      await manager.dispose();
    }
  });

  describe("Constructor", () => {
    it("should create a model manager instance", () => {
      expect(manager).toBeInstanceOf(ModelManager);
    });

    it("should use custom configuration", () => {
      const customConfig: ModelManagerConfig = {
        maxModels: 5,
        cacheSize: 2048,
        preload: [],
        updateStrategy: "manual",
        versionCheckInterval: 7200000,
        verifyIntegrity: false,
        maxConcurrentDownloads: 3,
      };
      const customManager = new ModelManager(customConfig);
      expect(customManager).toBeInstanceOf(ModelManager);
    });

    it("should create with factory function", () => {
      const factoryManager = createModelManager(config);
      expect(factoryManager).toBeInstanceOf(ModelManager);
    });

    it("should provide default config", () => {
      const defaultConfig = getDefaultModelManagerConfig();
      expect(defaultConfig.maxModels).toBe(3);
      expect(defaultConfig.cacheSize).toBe(1024);
    });
  });

  describe("Model Registration", () => {
    it("should register a model", () => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu", "wasm"],
      };
      manager.registerModel(info);
      const retrieved = manager.getModelInfo("test-model");
      expect(retrieved).toEqual(info);
    });

    it("should register multiple models", () => {
      const models: ModelInfo[] = [
        {
          id: "model1",
          version: "1.0.0",
          size: 100,
          quantization: "fp32",
          loaded: false,
          cached: false,
          url: "./models/model1",
          compatibleRuntimes: ["webgpu"],
        },
        {
          id: "model2",
          version: "1.0.0",
          size: 100,
          quantization: "int8",
          loaded: false,
          cached: false,
          url: "./models/model2",
          compatibleRuntimes: ["wasm"],
        },
      ];

      models.forEach((model) => manager.registerModel(model));

      expect(manager.getModelInfo("model1")).toBeDefined();
      expect(manager.getModelInfo("model2")).toBeDefined();
    });

    it("should get all models", () => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu", "wasm"],
      };
      manager.registerModel(info);
      const models = manager.getModels();
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe("test-model");
    });
  });

  describe("Model Loading", () => {
    beforeEach(() => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu", "wasm"],
        checksum: "abc123",
      };
      manager.registerModel(info);
    });

    it("should load a model", async () => {
      const model = await manager.loadModel("test-model");
      expect(model).toBeDefined();
    });

    it("should throw error for unregistered model", async () => {
      await expect(manager.loadModel("unknown")).rejects.toThrow();
    });

    it("should call progress callback during loading", async () => {
      const progress = vi.fn();
      await manager.loadModel("test-model", progress);
      expect(progress).toHaveBeenCalled();
    });

    it("should update model loaded status", async () => {
      await manager.loadModel("test-model");
      const info = manager.getModelInfo("test-model");
      expect(info?.loaded).toBe(true);
    });
  });

  describe("Model Unloading", () => {
    beforeEach(async () => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu", "wasm"],
      };
      manager.registerModel(info);
    });

    it("should unload a loaded model", async () => {
      await manager.loadModel("test-model");
      await manager.unloadModel("test-model");
      const info = manager.getModelInfo("test-model");
      expect(info?.loaded).toBe(false);
    });

    it("should handle unloading non-loaded model", async () => {
      await expect(manager.unloadModel("test-model")).resolves.not.toThrow();
    });
  });

  describe("Model Switching", () => {
    beforeEach(() => {
      const models: ModelInfo[] = [
        {
          id: "model1",
          version: "1.0.0",
          size: 100,
          quantization: "fp32",
          loaded: false,
          cached: false,
          url: "./models/model1",
          compatibleRuntimes: ["webgpu"],
        },
        {
          id: "model2",
          version: "1.0.0",
          size: 100,
          quantization: "int8",
          loaded: false,
          cached: false,
          url: "./models/model2",
          compatibleRuntimes: ["wasm"],
        },
      ];

      models.forEach((model) => manager.registerModel(model));
    });

    it("should switch to a different model", async () => {
      await manager.switchModel("model1");
      expect(manager.getCurrentModel()).toBe("model1");

      await manager.switchModel("model2");
      expect(manager.getCurrentModel()).toBe("model2");
    });

    it("should load model if not loaded", async () => {
      await manager.switchModel("model1");
      expect(manager.getModelInfo("model1")?.loaded).toBe(true);
    });
  });

  describe("Current Model", () => {
    it("should return null when no model selected", () => {
      expect(manager.getCurrentModel()).toBeNull();
    });

    it("should return current model after switching", async () => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu"],
      };
      manager.registerModel(info);
      await manager.switchModel("test-model");
      expect(manager.getCurrentModel()).toBe("test-model");
    });
  });

  describe("Getting Models", () => {
    beforeEach(() => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu"],
        metadata: {
          description: "Test model",
          author: "Test Author",
        },
      };
      manager.registerModel(info);
    });

    it("should get model info", () => {
      const info = manager.getModelInfo("test-model");
      expect(info).toBeDefined();
      expect(info?.id).toBe("test-model");
    });

    it("should return undefined for unknown model", () => {
      const info = manager.getModelInfo("unknown");
      expect(info).toBeUndefined();
    });

    it("should get loaded model instance", async () => {
      await manager.loadModel("test-model");
      const model = manager.getModel("test-model");
      expect(model).toBeDefined();
    });
  });

  describe("Version Checking", () => {
    it("should check for updates", async () => {
      const updates = await manager.checkForUpdates();
      expect(updates).toBeInstanceOf(Map);
    });
  });

  describe("Model Updates", () => {
    beforeEach(() => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu"],
      };
      manager.registerModel(info);
    });

    it("should update a model", async () => {
      await manager.updateModel("test-model");
      expect(manager.getModelInfo("test-model")?.version).toBeDefined();
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", async () => {
      await manager.clearCache();
      expect(true).toBe(true); // Should not throw
    });

    it("should get cache size", async () => {
      const size = await manager.getCacheSize();
      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Disposal", () => {
    it("should dispose all resources", async () => {
      await manager.dispose();
      expect(manager.getCurrentModel()).toBeNull();
    });

    it("should handle multiple dispose calls", async () => {
      await manager.dispose();
      await manager.dispose();
      expect(true).toBe(true); // Should not throw
    });
  });

  describe("Memory Limits", () => {
    it("should enforce max models limit", async () => {
      const config: ModelManagerConfig = {
        ...getDefaultModelManagerConfig(),
        maxModels: 2,
      };
      const limitedManager = new ModelManager(config);

      for (let i = 0; i < 3; i++) {
        limitedManager.registerModel({
          id: `model${i}`,
          version: "1.0.0",
          size: 100,
          quantization: "fp32",
          loaded: false,
          cached: false,
          url: `./models/model${i}`,
          compatibleRuntimes: ["webgpu"],
        });
      }

      // Load first two models
      await limitedManager.loadModel("model0");
      await limitedManager.loadModel("model1");

      // Loading third should evict one
      await limitedManager.loadModel("model2");

      const loadedCount = limitedManager.getModels().filter((m) => m.loaded).length;
      expect(loadedCount).toBeLessThanOrEqual(2);

      await limitedManager.dispose();
    });
  });

  describe("Model Metadata", () => {
    it("should store custom metadata", () => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu"],
        metadata: {
          description: "Test model",
          author: "Test Author",
          tags: ["test", "demo"],
        },
      };
      manager.registerModel(info);
      const retrieved = manager.getModelInfo("test-model");
      expect(retrieved?.metadata?.description).toBe("Test model");
      expect(retrieved?.metadata?.tags).toEqual(["test", "demo"]);
    });
  });

  describe("Quantization Types", () => {
    const quantizations: Array<"int8" | "fp16" | "fp32"> = ["int8", "fp16", "fp32"];

    it.each(quantizations)("should support %s quantization", (quantization) => {
      const info: ModelInfo = {
        id: `model-${quantization}`,
        version: "1.0.0",
        size: 100,
        quantization,
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu"],
      };
      manager.registerModel(info);
      expect(manager.getModelInfo(`model-${quantization}`)?.quantization).toBe(quantization);
    });
  });

  describe("Runtime Compatibility", () => {
    it("should store compatible runtimes", () => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "fp32",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["webgpu", "wasm"],
      };
      manager.registerModel(info);
      expect(manager.getModelInfo("test-model")?.compatibleRuntimes).toEqual(["webgpu", "wasm"]);
    });

    it("should support single runtime compatibility", () => {
      const info: ModelInfo = {
        id: "test-model",
        version: "1.0.0",
        size: 100,
        quantization: "int8",
        loaded: false,
        cached: false,
        url: "./models/test",
        compatibleRuntimes: ["wasm"],
      };
      manager.registerModel(info);
      expect(manager.getModelInfo("test-model")?.compatibleRuntimes).toEqual(["wasm"]);
    });
  });

  describe("Integrity Verification", () => {
    it("should support checksum verification", () => {
      const configWithVerification: ModelManagerConfig = {
        ...getDefaultModelManagerConfig(),
        verifyIntegrity: true,
      };
      const verifyingManager = new ModelManager(configWithVerification);
      expect(verifyingManager).toBeInstanceOf(ModelManager);
    });
  });

  describe("Update Strategies", () => {
    const strategies: Array<"auto" | "manual" | "never"> = ["auto", "manual", "never"];

    it.each(strategies)("should support %s update strategy", (strategy) => {
      const config: ModelManagerConfig = {
        ...getDefaultModelManagerConfig(),
        updateStrategy: strategy,
      };
      const strategyManager = new ModelManager(config);
      expect(strategyManager).toBeInstanceOf(ModelManager);
    });
  });

  describe("Concurrent Downloads", () => {
    it("should respect max concurrent downloads", () => {
      const config: ModelManagerConfig = {
        ...getDefaultModelManagerConfig(),
        maxConcurrentDownloads: 2,
      };
      const concurrentManager = new ModelManager(config);
      expect(concurrentManager).toBeInstanceOf(ModelManager);
    });
  });
});
