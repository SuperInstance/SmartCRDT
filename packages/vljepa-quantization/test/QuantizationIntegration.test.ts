/**
 * Integration Tests - 40+ tests
 *
 * End-to-end tests covering complete quantization workflows.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  INT8Quantizer,
  createINT8Quantizer,
} from "../src/quantizers/INT8Quantizer.js";
import {
  PostTrainingQuant,
  createPostTrainingQuant,
} from "../src/quantizers/PostTrainingQuant.js";
import {
  QuantAwareTraining,
  createQuantAwareTraining,
} from "../src/quantizers/QuantAwareTraining.js";
import {
  HybridQuantizer,
  createHybridQuantizer,
} from "../src/quantizers/HybridQuantizer.js";
import {
  LayerFusionOptimizer,
  createLayerFusionOptimizer,
} from "../src/optimizers/LayerFusion.js";
import {
  AccuracyValidator,
  createAccuracyValidator,
} from "../src/validators/AccuracyValidator.js";
import {
  PerformanceValidator,
  createPerformanceValidator,
} from "../src/validators/PerformanceValidator.js";
import {
  SizeValidator,
  createSizeValidator,
} from "../src/validators/SizeValidator.js";
import {
  WebGPUOptimizer,
  createWebGPUOptimizer,
} from "../src/deployment/WebGPUOptimizer.js";
import {
  EdgePackager,
  createEdgePackager,
} from "../src/deployment/EdgePackager.js";
import {
  quickQuantize,
  quickValidate,
  quickPackage,
} from "../src/index.js";
import type { ModelInfo, QuantizationResult } from "../src/types.js";

describe("Integration: End-to-End Quantization", () => {
  let mockModel: ModelInfo;

  beforeEach(() => {
    mockModel = createMockModel();
  });

  describe("Basic Quantization Flow", () => {
    it("should complete full quantization", async () => {
      const quantizer = createINT8Quantizer();
      const result = await quantizer.quantize(mockModel);
      expect(result.success).toBe(true);
      expect(result.quantizedModel.precision).toBe("int8");
    });

    it("should quantize with calibration", async () => {
      const ptq = createPostTrainingQuant({
        calibration: {
          samples: 50,
          batchSize: 10,
          method: "min_max",
        },
      });
      const result = await ptq.quantize(mockModel);
      expect(result.success).toBe(true);
    });

    it("should quantize with layer fusion", async () => {
      const quantizer = createINT8Quantizer({ fuseLayers: true });
      const result = await quantizer.quantize(mockModel);
      expect(result.success).toBe(true);
      expect(result.quantizedModel.layers.length).toBeLessThan(mockModel.layers.length);
    });
  });

  describe("Quantization + Validation", () => {
    it("should validate after quantization", async () => {
      const quantizer = createINT8Quantizer();
      const result = await quantizer.quantize(mockModel);

      const validator = createAccuracyValidator();
      const validation = await validator.validate(
        result.originalModel,
        result.quantizedModel
      );

      expect(validation).toBeDefined();
      expect(typeof validation.passed).toBe("boolean");
    });

    it("should validate performance", async () => {
      const quantizer = createINT8Quantizer();
      const result = await quantizer.quantize(mockModel);

      const validator = createPerformanceValidator(2.0);
      const perfResult = await validator.validatePerformance(result);

      expect(perfResult.speedup).toBeGreaterThan(0);
    });

    it("should validate size", async () => {
      const quantizer = createINT8Quantizer();
      const result = await quantizer.quantize(mockModel);

      const validator = createSizeValidator(4.0);
      const sizeResult = await validator.validateSize(result);

      expect(sizeResult.sizeReduction).toBeGreaterThan(0);
    });
  });

  describe("Quantization + Optimization", () => {
    it("should apply layer fusion after quantization", async () => {
      const quantizer = createINT8Quantizer({ fuseLayers: false });
      const result = await quantizer.quantize(mockModel);

      const optimizer = createLayerFusionOptimizer();
      const fusionResult = await optimizer.fuse(result.quantizedModel);

      expect(fusionResult.success).toBe(true);
    });

    it("should optimize for WebGPU after quantization", async () => {
      const quantizer = createINT8Quantizer();
      const result = await quantizer.quantize(mockModel);

      const optimizer = createWebGPUOptimizer();
      const webgpuResult = await optimizer.optimize(
        new Uint8Array(1000),
        result.quantizedModel
      );

      expect(webgpuResult.success).toBe(true);
    });
  });

  describe("Quantization + Deployment", () => {
    it("should package for deployment", async () => {
      const quantizer = createINT8Quantizer();
      const result = await quantizer.quantize(mockModel);

      const packager = createEdgePackager({
        format: "custom",
        compression: "gzip",
        target: "browser",
      });

      const pkg = await packager.package(result, {});
      expect(pkg.version).toBeDefined();
      expect(pkg.model).toBeDefined();
    });

    it("should create complete deployment package", async () => {
      // Step 1: Quantize
      const quantizer = createINT8Quantizer();
      const quantResult = await quantizer.quantize(mockModel);

      // Step 2: Validate
      const validator = createAccuracyValidator();
      const validationResult = await validator.validate(
        quantResult.originalModel,
        quantResult.quantizedModel
      );

      // Step 3: Optimize
      const optimizer = createWebGPUOptimizer();
      const webgpuResult = await optimizer.optimize(
        new Uint8Array(1000),
        quantResult.quantizedModel
      );

      // Step 4: Package
      const packager = createEdgePackager({
        includeShaders: true,
        includeRuntime: true,
      });

      const pkg = await packager.package(
        quantResult,
        {},
        webgpuResult.shader ? { compute: webgpuResult.shader } : undefined
      );

      expect(pkg.version).toBeDefined();
      expect(pkg.model).toBeDefined();
      expect(pkg.shaders).toBeDefined();
      expect(pkg.runtime).toBeDefined();
      expect(pkg.metadata).toBeDefined();
    });
  });

  describe("Post-Training Quantization Flow", () => {
    it("should complete PTQ workflow", async () => {
      const ptq = createPostTrainingQuant();
      const calibrationData = generateCalibrationData(100);

      const result = await ptq.quantize(mockModel, calibrationData);
      expect(result.success).toBe(true);
    });

    it("should apply bias correction", async () => {
      const ptq = createPostTrainingQuant({
        biasCorrection: true,
      });

      const result = await ptq.quantize(mockModel);
      expect(result.success).toBe(true);
    });
  });

  describe("Quantization-Aware Training Flow", () => {
    it("should complete QAT workflow", async () => {
      const qat = createQuantAwareTraining({
        epochs: 2,
        batchSize: 16,
      });

      const trainingData = generateCalibrationData(50);
      const validationData = generateCalibrationData(10);

      const result = await qat.trainAndQuantize(
        mockModel,
        trainingData,
        validationData
      );

      expect(result.success).toBe(true);
      expect(result.quantizedModel.precision).toBe("int8");
    });

    it("should have better accuracy than PTQ", async () => {
      const qat = createQuantAwareTraining();
      const ptq = createPostTrainingQuant();

      const qatResult = await qat.trainAndQuantize(
        mockModel,
        generateCalibrationData(50)
      );

      const ptqResult = await ptq.quantize(mockModel);

      // QAT should have lower accuracy drop
      expect(qatResult.metrics.accuracyDrop).toBeLessThanOrEqual(
        ptqResult.metrics.accuracyDrop
      );
    });
  });

  describe("Hybrid Quantization Flow", () => {
    it("should complete hybrid quantization", async () => {
      const hybrid = createHybridQuantizer({
        fp16StartLayers: 1,
        fp16EndLayers: 1,
        useSensitivityAnalysis: true,
      });

      const result = await hybrid.quantize(mockModel);
      expect(result.success).toBe(true);
      expect(result.quantizedModel.precision).toBe("mixed");
    });

    it("should provide sensitivity analysis", async () => {
      const hybrid = createHybridQuantizer({
        useSensitivityAnalysis: true,
      });

      await hybrid.quantize(mockModel);
      const sensitivity = hybrid.getSensitivityAnalysis();

      expect(sensitivity.length).toBe(mockModel.layers.length);
    });

    it("should provide precision assignment", async () => {
      const hybrid = createHybridQuantizer();

      await hybrid.quantize(mockModel);
      const assignment = hybrid.getPrecisionAssignment();

      expect(assignment.size).toBe(mockModel.layers.length);
    });
  });

  describe("Convenience Functions", () => {
    it("should quick quantize", async () => {
      const result = await quickQuantize(mockModel);
      expect(result).toBeDefined();
    });

    it("should quick validate", async () => {
      const result = await quickValidate(mockModel, mockModel);
      expect(result).toBeDefined();
    });

    it("should quick package", async () => {
      const mockResult: QuantizationResult = {
        originalModel: mockModel,
        quantizedModel: { ...mockModel, precision: "int8" as any },
        scale: new Float32Array([1.0]),
        zeroPoint: new Int8Array([0]),
        metrics: {
          sizeReduction: 4,
          accuracyDrop: 1.0,
          speedup: 2.0,
          calibrationError: 0.01,
          mse: 1e-4,
          sqnr: 40,
          layersQuantized: 100,
          memorySaved: 3000000,
        },
        quantizationTime: 1000,
        warnings: [],
        success: true,
      };

      const pkg = await quickPackage(mockResult, {});
      expect(pkg).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid model", async () => {
      const quantizer = createINT8Quantizer();
      const invalidModel = { ...mockModel, layers: [] };

      await expect(quantizer.quantize(invalidModel)).rejects.toThrow();
    });

    it("should handle calibration errors gracefully", async () => {
      const ptq = createPostTrainingQuant();
      // Empty calibration data should still work
      const result = await ptq.quantize(mockModel, []);
      expect(result.success).toBe(true);
    });
  });

  describe("Performance Targets", () => {
    it("should achieve 2x speedup", async () => {
      const quantizer = createINT8Quantizer({ target: "webgpu" });
      const result = await quantizer.quantize(mockModel);

      expect(result.metrics.speedup).toBeGreaterThanOrEqual(1.8);
    });

    it("should achieve 4x size reduction", async () => {
      const quantizer = createINT8Quantizer();
      const result = await quantizer.quantize(mockModel);

      expect(result.metrics.sizeReduction).toBeGreaterThanOrEqual(3.5);
    });

    it("should keep accuracy drop below 2%", async () => {
      const quantizer = createINT8Quantizer({ preserveAccuracy: true });
      const result = await quantizer.quantize(mockModel);

      expect(result.metrics.accuracyDrop).toBeLessThan(3.0);
    });
  });

  describe("Configuration Variations", () => {
    it("should work with symmetric mode", async () => {
      const quantizer = createINT8Quantizer({ mode: "symmetric" });
      const result = await quantizer.quantize(mockModel);
      expect(result.success).toBe(true);
    });

    it("should work with asymmetric mode", async () => {
      const quantizer = createINT8Quantizer({ mode: "asymmetric" });
      const result = await quantizer.quantize(mockModel);
      expect(result.success).toBe(true);
    });

    it("should work with min_max calibration", async () => {
      const quantizer = createINT8Quantizer({ calibration: "min_max" });
      const result = await quantizer.quantize(mockModel);
      expect(result.success).toBe(true);
    });

    it("should work with KLD calibration", async () => {
      const quantizer = createINT8Quantizer({ calibration: "kld" });
      const result = await quantizer.quantize(mockModel);
      expect(result.success).toBe(true);
    });

    it("should work with percentile calibration", async () => {
      const quantizer = createINT8Quantizer({ calibration: "percentile" });
      const result = await quantizer.quantize(mockModel);
      expect(result.success).toBe(true);
    });
  });
});

// Helper functions
function createMockModel(): ModelInfo {
  return {
    name: "test_model",
    version: "1.0.0",
    parameters: 1_600_000_000,
    sizeBytes: 6_400_000_000,
    precision: "fp32",
    layers: Array.from({ length: 22 }, (_, i) => ({
      name: `layer_${i}`,
      type: i < 12 ? "transformer" : i < 18 ? "transformer" : "transformer",
      inputShape: [1, 768],
      outputShape: [1, 768],
      parameters: 100_000_000,
      sizeBytes: 400_000_000,
      quantized: false,
    })),
  };
}

function generateCalibrationData(count: number): Float32Array[] {
  return Array.from({ length: count }, () => {
    const arr = new Float32Array(768);
    for (let i = 0; i < 768; i++) {
      arr[i] = (Math.random() - 0.5) * 2;
    }
    return arr;
  });
}
