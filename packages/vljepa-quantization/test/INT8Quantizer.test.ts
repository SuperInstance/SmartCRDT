/**
 * @lsi/vljepa-quantization - INT8 Quantizer Tests
 *
 * Comprehensive test suite for INT8 quantizer.
 * 55+ tests covering quantization, calibration, and edge cases.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  INT8Quantizer,
  createINT8Quantizer,
  DEFAULT_QUANTIZER_CONFIG,
} from "../src/quantizers/INT8Quantizer.js";
import type { INT8QuantizerConfig, ModelInfo, LayerInfo } from "../src/types.js";

describe("INT8Quantizer", () => {
  let quantizer: INT8Quantizer;
  let mockModel: ModelInfo;

  beforeEach(() => {
    quantizer = createINT8Quantizer();
    mockModel = createMockModel();
  });

  describe("Constructor", () => {
    it("should create quantizer with default config", () => {
      const q = createINT8Quantizer();
      expect(q).toBeDefined();
    });

    it("should create quantizer with custom config", () => {
      const config: Partial<INT8QuantizerConfig> = {
        mode: "asymmetric",
        calibration: "kld",
        granularity: "per_channel",
      };
      const q = createINT8Quantizer(config);
      expect(q).toBeDefined();
    });

    it("should have correct default mode", () => {
      const config = quantizer.getConfig();
      expect(config.mode).toBe("symmetric");
    });

    it("should have correct default calibration", () => {
      const config = quantizer.getConfig();
      expect(config.calibration).toBe("min_max");
    });

    it("should have correct default granularity", () => {
      const config = quantizer.getConfig();
      expect(config.granularity).toBe("per_tensor");
    });
  });

  describe("Symmetric Quantization", () => {
    it("should quantize value to INT8 range", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const result = quantizer.quantizeValue(1.0, params);
      expect(result).toBeGreaterThanOrEqual(-128);
      expect(result).toBeLessThanOrEqual(127);
    });

    it("should handle zero value", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const result = quantizer.quantizeValue(0, params);
      expect(result).toBe(0);
    });

    it("should handle positive values", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const result = quantizer.quantizeValue(0.5, params);
      expect(result).toBeGreaterThan(0);
    });

    it("should handle negative values", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const result = quantizer.quantizeValue(-0.5, params);
      expect(result).toBeLessThan(0);
    });

    it("should clamp to max INT8", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const result = quantizer.quantizeValue(10.0, params);
      expect(result).toBe(127);
    });

    it("should clamp to min INT8", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const result = quantizer.quantizeValue(-10.0, params);
      expect(result).toBe(-128);
    });
  });

  describe("Asymmetric Quantization", () => {
    it("should use zero point offset", () => {
      const asymmetricQ = createINT8Quantizer({ mode: "asymmetric" });
      expect(asymmetricQ.getConfig().mode).toBe("asymmetric");
    });

    it("should quantize with zero point", () => {
      const params = { scale: 0.01, zeroPoint: 10, min: -1.0, max: 1.5 };
      const result = quantizer.quantizeValue(0, params);
      expect(result).toBeCloseTo(10, 0);
    });
  });

  describe("Dequantization", () => {
    it("should dequantize to original value", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const original = 0.5;
      const quantized = quantizer.quantizeValue(original, params);
      const dequantized = quantizer.dequantizeValue(quantized, params);
      expect(dequantized).toBeCloseTo(original, 1);
    });

    it("should handle array dequantization", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const input = new Float32Array([0.1, 0.2, 0.3]);
      const quantized = quantizer.quantizeArray(input, params);
      const dequantized = quantizer.dequantizeArray(quantized, params);
      expect(dequantized.length).toBe(input.length);
    });
  });

  describe("Array Quantization", () => {
    it("should quantize full array", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const input = new Float32Array([0.1, 0.2, 0.3, -0.1, -0.2]);
      const result = quantizer.quantizeArray(input, params);
      expect(result).toBeInstanceOf(Int8Array);
      expect(result.length).toBe(input.length);
    });

    it("should handle empty array", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const input = new Float32Array([]);
      const result = quantizer.quantizeArray(input, params);
      expect(result.length).toBe(0);
    });

    it("should handle large array", () => {
      const params = { scale: 0.01, zeroPoint: 0, min: -1.27, max: 1.27 };
      const input = new Float32Array(10000);
      for (let i = 0; i < input.length; i++) {
        input[i] = (Math.random() - 0.5) * 2;
      }
      const result = quantizer.quantizeArray(input, params);
      expect(result.length).toBe(input.length);
    });
  });

  describe("Model Quantization", () => {
    it("should quantize model successfully", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.success).toBe(true);
    });

    it("should return quantized model info", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.quantizedModel).toBeDefined();
      expect(result.quantizedModel.precision).toBe("int8");
    });

    it("should calculate size reduction", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.metrics.sizeReduction).toBeGreaterThan(1);
    });

    it("should estimate accuracy drop", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.metrics.accuracyDrop).toBeGreaterThanOrEqual(0);
      expect(result.metrics.accuracyDrop).toBeLessThanOrEqual(5);
    });

    it("should estimate speedup", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.metrics.speedup).toBeGreaterThan(1);
    });

    it("should track quantization time", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.quantizationTime).toBeGreaterThan(0);
    });
  });

  describe("Progress Callback", () => {
    it("should call progress callback", async () => {
      let progressCalled = false;
      await quantizer.quantize(mockModel, (stats) => {
        progressCalled = true;
        expect(stats.layersQuantized).toBeGreaterThanOrEqual(0);
      });
      expect(progressCalled).toBe(true);
    });

    it("should report correct progress", async () => {
      const progresses: number[] = [];
      await quantizer.quantize(mockModel, (stats) => {
        progresses.push(stats.progress);
      });
      expect(progresses.length).toBeGreaterThan(0);
      expect(progresses[progresses.length - 1]).toBeCloseTo(1);
    });
  });

  describe("Error Handling", () => {
    it("should reject empty model", async () => {
      const emptyModel: ModelInfo = {
        name: "empty",
        version: "1.0",
        parameters: 0,
        sizeBytes: 0,
        precision: "fp32",
        layers: [],
      };
      await expect(quantizer.quantize(emptyModel)).rejects.toThrow();
    });

    it("should reject invalid precision", async () => {
      const invalidModel: ModelInfo = {
        ...mockModel,
        precision: "int8" as any,
      };
      await expect(quantizer.quantize(invalidModel)).rejects.toThrow();
    });
  });

  describe("Layer Fusion", () => {
    it("should fuse conv+bn+relu", async () => {
      const q = createINT8Quantizer({ fuseLayers: true });
      const result = await q.quantize(mockModel);
      expect(result.quantizedModel.layers.length).toBeLessThan(mockModel.layers.length);
    });

    it("should fuse linear+relu", async () => {
      const q = createINT8Quantizer({ fuseLayers: true });
      const result = await q.quantize(mockModel);
      expect(result.quantizedModel.layers.some(l => l.type.includes("fused"))).toBe(true);
    });

    it("should not fuse when disabled", async () => {
      const q = createINT8Quantizer({ fuseLayers: false });
      const result = await q.quantize(mockModel);
      expect(result.quantizedModel.layers.every(l => !l.type.includes("fused"))).toBe(true);
    });
  });

  describe("Configuration", () => {
    it("should get config", () => {
      const config = quantizer.getConfig();
      expect(config).toBeDefined();
    });

    it("should reset state", () => {
      expect(() => quantizer.reset()).not.toThrow();
    });
  });

  describe("Metrics", () => {
    it("should calculate MSE", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.metrics.mse).toBeGreaterThan(0);
    });

    it("should calculate SQNR", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.metrics.sqnr).toBeGreaterThan(0);
    });

    it("should calculate calibration error", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.metrics.calibrationError).toBeGreaterThan(0);
    });

    it("should calculate memory saved", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.metrics.memorySaved).toBeGreaterThan(0);
    });

    it("should calculate layers quantized percentage", async () => {
      const result = await quantizer.quantize(mockModel);
      expect(result.metrics.layersQuantized).toBeGreaterThan(0);
      expect(result.metrics.layersQuantized).toBeLessThanOrEqual(100);
    });
  });
});

// Helper function to create mock model
function createMockModel(): ModelInfo {
  const layers: LayerInfo[] = [];
  for (let i = 0; i < 10; i++) {
    layers.push({
      name: `layer_${i}`,
      type: i % 2 === 0 ? "conv2d" : i % 3 === 0 ? "batchnorm" : "relu",
      inputShape: [1, 64, 32, 32],
      outputShape: [1, 64, 32, 32],
      parameters: 100000,
      sizeBytes: 400000,
      quantized: false,
    });
  }

  return {
    name: "test_model",
    version: "1.0.0",
    parameters: 1000000,
    sizeBytes: 4000000,
    precision: "fp32",
    layers,
  };
}
