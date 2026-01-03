/**
 * @lsi/core/tuning - ParameterController Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ParameterController,
  createParameterController,
} from "./ParameterController.js";
import { TunableParameter, ParameterCategory } from "./AutoTuner.js";

describe("ParameterController", () => {
  let controller: ParameterController;

  beforeEach(() => {
    controller = new ParameterController();
  });

  describe("Constructor", () => {
    it("should create instance", () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(ParameterController);
    });

    it("should create with factory function", () => {
      const c = createParameterController();
      expect(c).toBeDefined();
      expect(c).toBeInstanceOf(ParameterController);
    });
  });

  describe("Parameter Registration", () => {
    it("should register a parameter", () => {
      const param: TunableParameter = {
        name: "test.param",
        category: "cache",
        minValue: 0,
        maxValue: 100,
        currentValue: 50,
        stepSize: 10,
        requiresRestart: false,
        impactEstimate: 0.5,
        validate: v => v >= 0 && v <= 100,
      };

      controller.register(param);
      expect(controller.has("test.param")).toBe(true);
    });

    it("should register multiple parameters", () => {
      const params: TunableParameter[] = [
        {
          name: "cache.maxSize",
          category: "cache",
          minValue: 100,
          maxValue: 10000,
          currentValue: 1000,
          stepSize: 100,
          requiresRestart: false,
          impactEstimate: 0.7,
          validate: v => v >= 100 && v <= 10000,
        },
        {
          name: "cache.ttl",
          category: "cache",
          minValue: 60000,
          maxValue: 3600000,
          currentValue: 600000,
          stepSize: 60000,
          requiresRestart: false,
          impactEstimate: 0.5,
          validate: v => v >= 60000 && v <= 3600000,
        },
      ];

      controller.registerAll(params);
      expect(controller.count()).toBe(2);
    });

    it("should unregister a parameter", async () => {
      const param: TunableParameter = {
        name: "test.param",
        category: "cache",
        minValue: 0,
        maxValue: 100,
        currentValue: 50,
        stepSize: 10,
        requiresRestart: false,
        impactEstimate: 0.5,
        validate: v => v >= 0 && v <= 100,
      };

      controller.register(param);
      expect(controller.has("test.param")).toBe(true);

      controller.unregister("test.param");
      expect(controller.has("test.param")).toBe(false);
    });
  });

  describe("Getting Parameters", () => {
    beforeEach(() => {
      const params: TunableParameter[] = [
        {
          name: "cache.maxSize",
          category: "cache",
          minValue: 100,
          maxValue: 10000,
          currentValue: 1000,
          stepSize: 100,
          requiresRestart: false,
          impactEstimate: 0.7,
          validate: v => v >= 100 && v <= 10000,
        },
        {
          name: "routing.complexityThreshold",
          category: "routing",
          minValue: 0.3,
          maxValue: 0.9,
          currentValue: 0.7,
          stepSize: 0.05,
          requiresRestart: false,
          impactEstimate: 0.9,
          validate: v => v >= 0.3 && v <= 0.9,
        },
      ];

      controller.registerAll(params);
    });

    it("should get all parameters", async () => {
      const params = await controller.getAll();
      expect(params.length).toBe(2);
    });

    it("should return copies of parameters", async () => {
      const params1 = await controller.getAll();
      const params2 = await controller.getAll();

      expect(params1).not.toBe(params2);
      expect(params1[0]).toEqual(params2[0]);
    });

    it("should get parameters by category", async () => {
      const cacheParams = await controller.getByCategory("cache");
      expect(cacheParams.length).toBe(1);
      expect(cacheParams[0].name).toBe("cache.maxSize");

      const routingParams = await controller.getByCategory("routing");
      expect(routingParams.length).toBe(1);
      expect(routingParams[0].name).toBe("routing.complexityThreshold");
    });

    it("should get single parameter", async () => {
      const param = await controller.get("cache.maxSize");
      expect(param).not.toBeNull();
      expect(param!.name).toBe("cache.maxSize");
    });

    it("should return null for unknown parameter", async () => {
      const param = await controller.get("unknown.param");
      expect(param).toBeNull();
    });

    it("should get parameter value", async () => {
      const value = await controller.getValue("cache.maxSize");
      expect(value).toBe(1000);
    });

    it("should return null for unknown parameter value", async () => {
      const value = await controller.getValue("unknown.param");
      expect(value).toBeNull();
    });
  });

  describe("Setting Parameters", () => {
    beforeEach(() => {
      const param: TunableParameter = {
        name: "cache.maxSize",
        category: "cache",
        minValue: 100,
        maxValue: 10000,
        currentValue: 1000,
        stepSize: 100,
        requiresRestart: false,
        impactEstimate: 0.7,
        validate: v => v >= 100 && v <= 10000,
      };

      controller.register(param);
    });

    it("should set parameter value", async () => {
      await controller.set("cache.maxSize", 2000);
      const value = await controller.getValue("cache.maxSize");
      expect(value).toBe(2000);
    });

    it("should throw error for unknown parameter", async () => {
      await expect(controller.set("unknown.param", 100)).rejects.toThrow(
        "Parameter unknown.param not found"
      );
    });

    it("should throw error for value below minimum", async () => {
      await expect(controller.set("cache.maxSize", 50)).rejects.toThrow();
    });

    it("should throw error for value above maximum", async () => {
      await expect(controller.set("cache.maxSize", 20000)).rejects.toThrow();
    });

    it("should throw error for invalid custom validation", async () => {
      const param: TunableParameter = {
        name: "test.param",
        category: "cache",
        minValue: 0,
        maxValue: 100,
        currentValue: 50,
        stepSize: 10,
        requiresRestart: false,
        impactEstimate: 0.5,
        validate: v => v % 10 === 0, // Must be divisible by 10
      };

      controller.register(param);

      await expect(controller.set("test.param", 55)).rejects.toThrow();
    });

    it("should set multiple parameters", async () => {
      const param2: TunableParameter = {
        name: "cache.ttl",
        category: "cache",
        minValue: 60000,
        maxValue: 3600000,
        currentValue: 600000,
        stepSize: 60000,
        requiresRestart: false,
        impactEstimate: 0.5,
        validate: v => v >= 60000 && v <= 3600000,
      };

      controller.register(param2);

      const values = new Map<string, number>([
        ["cache.maxSize", 2000],
        ["cache.ttl", 700000],
      ]);

      await controller.setMany(values);

      expect(await controller.getValue("cache.maxSize")).toBe(2000);
      expect(await controller.getValue("cache.ttl")).toBe(700000);
    });
  });

  describe("Resetting Parameters", () => {
    beforeEach(() => {
      const params: TunableParameter[] = [
        {
          name: "cache.maxSize",
          category: "cache",
          minValue: 100,
          maxValue: 10000,
          currentValue: 1000,
          stepSize: 100,
          requiresRestart: false,
          impactEstimate: 0.7,
          validate: v => v >= 100 && v <= 10000,
        },
        {
          name: "cache.ttl",
          category: "cache",
          minValue: 60000,
          maxValue: 3600000,
          currentValue: 600000,
          stepSize: 60000,
          requiresRestart: false,
          impactEstimate: 0.5,
          validate: v => v >= 60000 && v <= 3600000,
        },
      ];

      controller.registerAll(params);
    });

    it("should reset single parameter to default", async () => {
      await controller.set("cache.maxSize", 5000);
      expect(await controller.getValue("cache.maxSize")).toBe(5000);

      await controller.reset("cache.maxSize");
      const value = await controller.getValue("cache.maxSize");
      // Default should be midpoint
      expect(value).toBe(5050);
    });

    it("should throw error when resetting unknown parameter", async () => {
      await expect(controller.reset("unknown.param")).rejects.toThrow();
    });

    it("should reset all parameters", async () => {
      await controller.set("cache.maxSize", 5000);
      await controller.set("cache.ttl", 1000000);

      await controller.resetAll();

      const maxSize = await controller.getValue("cache.maxSize");
      const ttl = await controller.getValue("cache.ttl");

      expect(maxSize).toBe(5050);
      expect(ttl).toBe(1830000);
    });
  });

  describe("Applicators", () => {
    it("should register applicator for category", () => {
      const applicator = vi.fn();
      controller.registerApplicator("cache", applicator);

      // Should not throw
      expect(controller.getCategories()).toContain("cache");
    });

    it("should call applicator when setting parameter", async () => {
      const applicator = vi.fn();
      controller.registerApplicator("cache", applicator);

      const param: TunableParameter = {
        name: "cache.maxSize",
        category: "cache",
        minValue: 100,
        maxValue: 10000,
        currentValue: 1000,
        stepSize: 100,
        requiresRestart: false,
        impactEstimate: 0.7,
        validate: v => v >= 100 && v <= 10000,
      };

      controller.register(param);
      await controller.set("cache.maxSize", 2000);

      expect(applicator).toHaveBeenCalledWith("cache.maxSize", 2000);
    });

    it("should call multiple applicators", async () => {
      const applicator1 = vi.fn();
      const applicator2 = vi.fn();

      controller.registerApplicator("cache", applicator1);
      controller.registerApplicator("cache", applicator2);

      const param: TunableParameter = {
        name: "cache.maxSize",
        category: "cache",
        minValue: 100,
        maxValue: 10000,
        currentValue: 1000,
        stepSize: 100,
        requiresRestart: false,
        impactEstimate: 0.7,
        validate: v => v >= 100 && v <= 10000,
      };

      controller.register(param);
      await controller.set("cache.maxSize", 2000);

      expect(applicator1).toHaveBeenCalledWith("cache.maxSize", 2000);
      expect(applicator2).toHaveBeenCalledWith("cache.maxSize", 2000);
    });

    it("should handle applicator errors gracefully", async () => {
      const applicator = vi.fn(() => {
        throw new Error("Applicator error");
      });

      controller.registerApplicator("cache", applicator);

      const param: TunableParameter = {
        name: "cache.maxSize",
        category: "cache",
        minValue: 100,
        maxValue: 10000,
        currentValue: 1000,
        stepSize: 100,
        requiresRestart: false,
        impactEstimate: 0.7,
        validate: v => v >= 100 && v <= 10000,
      };

      controller.register(param);

      // Should not throw, error is caught and logged
      await controller.set("cache.maxSize", 2000);

      // Value should still be set
      expect(await controller.getValue("cache.maxSize")).toBe(2000);
    });
  });

  describe("System Values", () => {
    it("should store system values", async () => {
      const param: TunableParameter = {
        name: "cache.maxSize",
        category: "cache",
        minValue: 100,
        maxValue: 10000,
        currentValue: 1000,
        stepSize: 100,
        requiresRestart: false,
        impactEstimate: 0.7,
        validate: v => v >= 100 && v <= 10000,
      };

      controller.register(param);
      await controller.set("cache.maxSize", 2000);

      const value = controller.getSystemValue("cache.maxSize");
      expect(value).toBe(2000);
    });

    it("should get all system values", async () => {
      const params: TunableParameter[] = [
        {
          name: "cache.maxSize",
          category: "cache",
          minValue: 100,
          maxValue: 10000,
          currentValue: 1000,
          stepSize: 100,
          requiresRestart: false,
          impactEstimate: 0.7,
          validate: v => v >= 100 && v <= 10000,
        },
        {
          name: "cache.ttl",
          category: "cache",
          minValue: 60000,
          maxValue: 3600000,
          currentValue: 600000,
          stepSize: 60000,
          requiresRestart: false,
          impactEstimate: 0.5,
          validate: v => v >= 60000 && v <= 3600000,
        },
      ];

      controller.registerAll(params);
      await controller.set("cache.maxSize", 2000);
      await controller.set("cache.ttl", 700000);

      const allValues = controller.getAllSystemValues();
      expect(allValues.size).toBe(2);
      expect(allValues.get("cache.maxSize")).toBe(2000);
      expect(allValues.get("cache.ttl")).toBe(700000);
    });

    it("should return undefined for unknown system value", () => {
      const value = controller.getSystemValue("unknown.param");
      expect(value).toBeUndefined();
    });
  });

  describe("Utility Methods", () => {
    beforeEach(() => {
      const params: TunableParameter[] = [
        {
          name: "cache.maxSize",
          category: "cache",
          minValue: 100,
          maxValue: 10000,
          currentValue: 1000,
          stepSize: 100,
          requiresRestart: false,
          impactEstimate: 0.7,
          validate: v => v >= 100 && v <= 10000,
        },
        {
          name: "routing.complexityThreshold",
          category: "routing",
          minValue: 0.3,
          maxValue: 0.9,
          currentValue: 0.7,
          stepSize: 0.05,
          requiresRestart: false,
          impactEstimate: 0.9,
          validate: v => v >= 0.3 && v <= 0.9,
        },
      ];

      controller.registerAll(params);
    });

    it("should check if parameter exists", () => {
      expect(controller.has("cache.maxSize")).toBe(true);
      expect(controller.has("unknown.param")).toBe(false);
    });

    it("should get parameter count", () => {
      expect(controller.count()).toBe(2);
    });

    it("should get parameter names", () => {
      const names = controller.getNames();
      expect(names).toContain("cache.maxSize");
      expect(names).toContain("routing.complexityThreshold");
      expect(names.length).toBe(2);
    });

    it("should get categories", () => {
      const categories = controller.getCategories();
      expect(categories).toContain("cache");
      expect(categories).toContain("routing");
    });
  });

  describe("Category-based Application", () => {
    it("should apply cache parameters", async () => {
      const param: TunableParameter = {
        name: "cache.maxSize",
        category: "cache",
        minValue: 100,
        maxValue: 10000,
        currentValue: 1000,
        stepSize: 100,
        requiresRestart: false,
        impactEstimate: 0.7,
        validate: v => v >= 100 && v <= 10000,
      };

      controller.register(param);
      await controller.set("cache.maxSize", 2000);

      expect(await controller.getValue("cache.maxSize")).toBe(2000);
    });

    it("should apply routing parameters", async () => {
      const param: TunableParameter = {
        name: "routing.complexityThreshold",
        category: "routing",
        minValue: 0.3,
        maxValue: 0.9,
        currentValue: 0.7,
        stepSize: 0.05,
        requiresRestart: false,
        impactEstimate: 0.9,
        validate: v => v >= 0.3 && v <= 0.9,
      };

      controller.register(param);
      await controller.set("routing.complexityThreshold", 0.8);

      expect(
        await controller.getValue("routing.complexityThreshold")
      ).toBeCloseTo(0.8, 1);
    });

    it("should apply thermal parameters", async () => {
      const param: TunableParameter = {
        name: "thermal.throttleThreshold",
        category: "thermal",
        minValue: 60,
        maxValue: 90,
        currentValue: 75,
        stepSize: 5,
        requiresRestart: false,
        impactEstimate: 0.6,
        validate: v => v >= 60 && v <= 90,
      };

      controller.register(param);
      await controller.set("thermal.throttleThreshold", 80);

      expect(await controller.getValue("thermal.throttleThreshold")).toBe(80);
    });

    it("should apply memory parameters", async () => {
      const param: TunableParameter = {
        name: "memory.maxCacheSize",
        category: "memory",
        minValue: 256,
        maxValue: 2048,
        currentValue: 512,
        stepSize: 256,
        requiresRestart: false,
        impactEstimate: 0.6,
        validate: v => v >= 256 && v <= 2048,
      };

      controller.register(param);
      await controller.set("memory.maxCacheSize", 1024);

      expect(await controller.getValue("memory.maxCacheSize")).toBe(1024);
    });

    it("should apply network parameters", async () => {
      const param: TunableParameter = {
        name: "network.timeout",
        category: "network",
        minValue: 1000,
        maxValue: 30000,
        currentValue: 5000,
        stepSize: 1000,
        requiresRestart: false,
        impactEstimate: 0.4,
        validate: v => v >= 1000 && v <= 30000,
      };

      controller.register(param);
      await controller.set("network.timeout", 10000);

      expect(await controller.getValue("network.timeout")).toBe(10000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle setting to same value", async () => {
      const param: TunableParameter = {
        name: "cache.maxSize",
        category: "cache",
        minValue: 100,
        maxValue: 10000,
        currentValue: 1000,
        stepSize: 100,
        requiresRestart: false,
        impactEstimate: 0.7,
        validate: v => v >= 100 && v <= 10000,
      };

      controller.register(param);
      await controller.set("cache.maxSize", 1000);

      expect(await controller.getValue("cache.maxSize")).toBe(1000);
    });

    it("should handle setting to minimum value", async () => {
      const param: TunableParameter = {
        name: "cache.maxSize",
        category: "cache",
        minValue: 100,
        maxValue: 10000,
        currentValue: 1000,
        stepSize: 100,
        requiresRestart: false,
        impactEstimate: 0.7,
        validate: v => v >= 100 && v <= 10000,
      };

      controller.register(param);
      await controller.set("cache.maxSize", 100);

      expect(await controller.getValue("cache.maxSize")).toBe(100);
    });

    it("should handle setting to maximum value", async () => {
      const param: TunableParameter = {
        name: "cache.maxSize",
        category: "cache",
        minValue: 100,
        maxValue: 10000,
        currentValue: 1000,
        stepSize: 100,
        requiresRestart: false,
        impactEstimate: 0.7,
        validate: v => v >= 100 && v <= 10000,
      };

      controller.register(param);
      await controller.set("cache.maxSize", 10000);

      expect(await controller.getValue("cache.maxSize")).toBe(10000);
    });

    it("should handle empty controller", () => {
      const emptyController = new ParameterController();

      expect(emptyController.count()).toBe(0);
      expect(emptyController.getNames()).toEqual([]);
      expect(emptyController.has("any.param")).toBe(false);
    });
  });

  describe("Integration", () => {
    it("should work with default tunable parameters", async () => {
      // This uses the DEFAULT_TUNABLE_PARAMETERS from AutoTuner.ts
      const param: TunableParameter = {
        name: "cache.similarityThreshold",
        category: "cache",
        minValue: 0.7,
        maxValue: 0.99,
        currentValue: 0.85,
        stepSize: 0.01,
        requiresRestart: false,
        impactEstimate: 0.8,
        validate: v => v >= 0.7 && v <= 0.99,
      };

      controller.register(param);
      await controller.set("cache.similarityThreshold", 0.9);

      expect(
        await controller.getValue("cache.similarityThreshold")
      ).toBeCloseTo(0.9, 2);
    });
  });
});
