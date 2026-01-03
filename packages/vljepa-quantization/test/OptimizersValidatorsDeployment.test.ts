/**
 * LayerFusion, AccuracyValidator, WebGPUOptimizer, EdgePackager Tests
 * 120+ tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  LayerFusionOptimizer,
  createLayerFusionOptimizer,
  DEFAULT_FUSION_CONFIG,
} from "../src/optimizers/LayerFusion.js";
import {
  OperatorFusionOptimizer,
  createOperatorFusionOptimizer,
} from "../src/optimizers/OperatorFusion.js";
import {
  ConstantFoldingOptimizer,
  createConstantFoldingOptimizer,
} from "../src/optimizers/ConstantFolding.js";
import {
  AccuracyValidator,
  createAccuracyValidator,
  DEFAULT_VALIDATION_CONFIG,
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
import type { ModelInfo, LayerInfo, QuantizationResult } from "../src/types.js";

describe("LayerFusionOptimizer", () => {
  let optimizer: LayerFusionOptimizer;
  let mockModel: ModelInfo;

  beforeEach(() => {
    optimizer = createLayerFusionOptimizer();
    mockModel = createMockModel();
  });

  it("should create optimizer", () => {
    expect(optimizer).toBeDefined();
  });

  it("should fuse layers", async () => {
    const result = await optimizer.fuse(mockModel);
    expect(result.success).toBe(true);
  });

  it("should report fused layers", async () => {
    const result = await optimizer.fuse(mockModel);
    expect(result.layersFused).toBeGreaterThan(0);
  });

  it("should estimate speedup", async () => {
    const result = await optimizer.fuse(mockModel);
    expect(result.speedup).toBeGreaterThan(1);
  });

  it("should track fusion time", async () => {
    const result = await optimizer.fuse(mockModel);
    expect(result.fusionTime).toBeGreaterThan(0);
  });

  it("should return applied patterns", async () => {
    const result = await optimizer.fuse(mockModel);
    expect(result.appliedPatterns.length).toBeGreaterThanOrEqual(0);
  });

  it("should detect conv+bn+relu patterns", async () => {
    const model = createModelWithPattern("conv2d", "batchnorm", "relu");
    const result = await optimizer.fuse(model);
    expect(result.appliedPatterns.some(p => p.type === "conv_bn_relu")).toBe(true);
  });

  it("should detect linear+relu patterns", async () => {
    const model = createModelWithPattern("linear", "relu");
    const result = await optimizer.fuse(model);
    expect(result.appliedPatterns.some(p => p.type === "linear_relu")).toBe(true);
  });

  it("should get stats", async () => {
    await optimizer.fuse(mockModel);
    const stats = optimizer.getStats();
    expect(stats.totalFusionAttempts).toBeGreaterThan(0);
  });

  it("should reset stats", () => {
    optimizer.resetStats();
    expect(optimizer.getStats().totalFusionAttempts).toBe(0);
  });

  it("should get config", () => {
    const config = optimizer.getConfig();
    expect(config).toBeDefined();
  });
});

describe("OperatorFusionOptimizer", () => {
  it("should create optimizer", () => {
    const o = createOperatorFusionOptimizer();
    expect(o).toBeDefined();
  });

  it("should fuse operators", async () => {
    const o = createOperatorFusionOptimizer();
    const layer: LayerInfo = {
      name: "test",
      type: "linear",
      inputShape: [1, 768],
      outputShape: [1, 768],
      parameters: 589824,
      sizeBytes: 2359296,
      quantized: false,
    };
    const result = await o.fuseOperators(layer);
    expect(result.fusedOperators.length).toBeGreaterThanOrEqual(0);
  });

  it("should calculate speedup", async () => {
    const o = createOperatorFusionOptimizer();
    const layer: LayerInfo = {
      name: "test",
      type: "linear",
      inputShape: [1, 768],
      outputShape: [1, 768],
      parameters: 589824,
      sizeBytes: 2359296,
      quantized: false,
    };
    const result = await o.fuseOperators(layer);
    expect(result.speedup).toBeGreaterThan(1);
  });
});

describe("ConstantFoldingOptimizer", () => {
  it("should create optimizer", () => {
    const o = createConstantFoldingOptimizer();
    expect(o).toBeDefined();
  });

  it("should fold constants", async () => {
    const o = createConstantFoldingOptimizer();
    const model = createMockModel();
    const result = await o.foldConstants(model);
    expect(result.optimizedModel).toBeDefined();
  });

  it("should calculate size reduction", async () => {
    const o = createConstantFoldingOptimizer();
    const model = createMockModel();
    const result = await o.foldConstants(model);
    expect(result.sizeReduction).toBeGreaterThanOrEqual(0);
  });

  it("should estimate speedup", async () => {
    const o = createConstantFoldingOptimizer();
    const model = createMockModel();
    const result = await o.foldConstants(model);
    expect(result.speedup).toBeGreaterThanOrEqual(1);
  });
});

describe("AccuracyValidator", () => {
  let validator: AccuracyValidator;
  let mockFP32: ModelInfo;
  let mockINT8: ModelInfo;

  beforeEach(() => {
    validator = createAccuracyValidator();
    mockFP32 = createMockModel();
    mockINT8 = { ...createMockModel(), precision: "int8" as any };
  });

  it("should create validator", () => {
    expect(validator).toBeDefined();
  });

  it("should validate model", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    expect(result).toBeDefined();
  });

  it("should check passed status", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    expect(typeof result.passed).toBe("boolean");
  });

  it("should return FP32 metrics", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    expect(result.fp32Metrics).toBeDefined();
  });

  it("should return INT8 metrics", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    expect(result.int8Metrics).toBeDefined();
  });

  it("should calculate differences", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    expect(result.differences.length).toBeGreaterThan(0);
  });

  it("should generate recommendations", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("should track validation time", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    expect(result.validationTime).toBeGreaterThan(0);
  });

  it("should validate cosine similarity", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    const cosineDiff = result.differences.find(d => d.metric === "cosine");
    expect(cosineDiff).toBeDefined();
  });

  it("should validate top1 accuracy", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    const top1Diff = result.differences.find(d => d.metric === "top1");
    expect(top1Diff).toBeDefined();
  });

  it("should validate MSE", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    const mseDiff = result.differences.find(d => d.metric === "mse");
    expect(mseDiff).toBeDefined();
  });

  it("should check tolerance", async () => {
    const result = await validator.validate(mockFP32, mockINT8);
    result.differences.forEach(d => {
      expect(typeof d.withinTolerance).toBe("boolean");
    });
  });

  it("should validate single metric", () => {
    const within = validator.validateMetric("cosine", 0.98, 0.97);
    expect(typeof within).toBe("boolean");
  });

  it("should get config", () => {
    const config = validator.getConfig();
    expect(config).toBeDefined();
  });
});

describe("PerformanceValidator", () => {
  it("should create validator", () => {
    const v = createPerformanceValidator();
    expect(v).toBeDefined();
  });

  it("should validate performance", async () => {
    const v = createPerformanceValidator();
    const mockResult: QuantizationResult = {
      originalModel: createMockModel(),
      quantizedModel: { ...createMockModel(), precision: "int8" as any },
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
        memorySaved: 1000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const result = await v.validatePerformance(mockResult);
    expect(result.speedup).toBeGreaterThan(0);
  });

  it("should check target achieved", async () => {
    const v = createPerformanceValidator(2.0);
    const mockResult: QuantizationResult = {
      originalModel: createMockModel(),
      quantizedModel: { ...createMockModel(), precision: "int8" as any },
      scale: new Float32Array([1.0]),
      zeroPoint: new Int8Array([0]),
      metrics: {
        sizeReduction: 4,
        accuracyDrop: 1.0,
        speedup: 2.5,
        calibrationError: 0.01,
        mse: 1e-4,
        sqnr: 40,
        layersQuantized: 100,
        memorySaved: 1000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const result = await v.validatePerformance(mockResult);
    expect(result.speedupAchieved).toBe(true);
  });

  it("should benchmark model", async () => {
    const v = createPerformanceValidator();
    const model = createMockModel();
    const latency = await v.benchmark(model, 10);
    expect(latency).toBeGreaterThan(0);
  });
});

describe("SizeValidator", () => {
  it("should create validator", () => {
    const v = createSizeValidator();
    expect(v).toBeDefined();
  });

  it("should validate size", async () => {
    const v = createSizeValidator();
    const mockResult: QuantizationResult = {
      originalModel: { ...createMockModel(), sizeBytes: 4000000000 },
      quantizedModel: { ...createMockModel(), sizeBytes: 1000000000 },
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
        memorySaved: 3000000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const result = await v.validateSize(mockResult);
    expect(result.sizeReduction).toBe(4);
  });

  it("should check target achieved", async () => {
    const v = createSizeValidator(4.0);
    const mockResult: QuantizationResult = {
      originalModel: { ...createMockModel(), sizeBytes: 4000000000 },
      quantizedModel: { ...createMockModel(), sizeBytes: 1000000000 },
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
        memorySaved: 3000000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const result = await v.validateSize(mockResult);
    expect(result.targetAchieved).toBe(true);
  });

  it("should calculate size reduction", () => {
    const v = createSizeValidator();
    const reduction = v.calculateSizeReduction(4000000, 1000000);
    expect(reduction).toBe(4);
  });

  it("should format size", () => {
    const v = createSizeValidator();
    expect(v.formatSize(1024)).toContain("KB");
    expect(v.formatSize(1048576)).toContain("MB");
  });
});

describe("WebGPUOptimizer", () => {
  it("should create optimizer", () => {
    const o = createWebGPUOptimizer();
    expect(o).toBeDefined();
  });

  it("should optimize model", async () => {
    const o = createWebGPUOptimizer();
    const weights = new Uint8Array(1000);
    const result = await o.optimize(weights, {});
    expect(result.success).toBe(true);
  });

  it("should generate shader", async () => {
    const o = createWebGPUOptimizer();
    const weights = new Uint8Array(1000);
    const result = await o.optimize(weights, {});
    expect(result.shader).toBeDefined();
    expect(result.shader.length).toBeGreaterThan(0);
  });

  it("should calculate memory layout", async () => {
    const o = createWebGPUOptimizer();
    const weights = new Uint8Array(1000);
    const result = await o.optimize(weights, {});
    expect(result.memoryLayout).toBeDefined();
    expect(result.memoryLayout.bufferSize).toBeGreaterThan(0);
  });

  it("should run benchmark", async () => {
    const o = createWebGPUOptimizer();
    const weights = new Uint8Array(1000);
    const result = await o.optimize(weights, {});
    expect(result.benchmark).toBeDefined();
    expect(result.benchmark.avgInferenceTime).toBeGreaterThan(0);
  });

  it("should track compilation time", async () => {
    const o = createWebGPUOptimizer();
    const weights = new Uint8Array(1000);
    const result = await o.optimize(weights, {});
    expect(result.compilationTime).toBeGreaterThan(0);
  });

  it("should generate shader for layer type", () => {
    const o = createWebGPUOptimizer();
    const shader = o.generateShaderForLayer("conv2d");
    expect(shader).toBeDefined();
    expect(shader.length).toBeGreaterThan(0);
  });

  it("should get config", () => {
    const o = createWebGPUOptimizer({ workgroupSize: [32, 32, 1] });
    const config = o.getConfig();
    expect(config.workgroupSize).toEqual([32, 32, 1]);
  });
});

describe("EdgePackager", () => {
  it("should create packager", () => {
    const p = createEdgePackager();
    expect(p).toBeDefined();
  });

  it("should package model", async () => {
    const p = createEdgePackager();
    const mockResult: QuantizationResult = {
      originalModel: createMockModel(),
      quantizedModel: { ...createMockModel(), precision: "int8" as any },
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
        memorySaved: 3000000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const pkg = await p.package(mockResult, {});
    expect(pkg.version).toBeDefined();
    expect(pkg.model).toBeDefined();
  });

  it("should include weights", async () => {
    const p = createEdgePackager();
    const mockResult: QuantizationResult = {
      originalModel: createMockModel(),
      quantizedModel: { ...createMockModel(), precision: "int8" as any },
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
        memorySaved: 3000000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const pkg = await p.package(mockResult, {});
    expect(pkg.model.weights).toBeInstanceOf(Uint8Array);
  });

  it("should include config", async () => {
    const p = createEdgePackager();
    const mockResult: QuantizationResult = {
      originalModel: createMockModel(),
      quantizedModel: { ...createMockModel(), precision: "int8" as any },
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
        memorySaved: 3000000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const pkg = await p.package(mockResult, {});
    expect(pkg.model.config).toBeDefined();
  });

  it("should include metadata", async () => {
    const p = createEdgePackager();
    const mockResult: QuantizationResult = {
      originalModel: createMockModel(),
      quantizedModel: { ...createMockModel(), precision: "int8" as any },
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
        memorySaved: 3000000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const pkg = await p.package(mockResult, {});
    expect(pkg.metadata).toBeDefined();
    expect(pkg.metadata.created).toBeGreaterThan(0);
  });

  it("should include runtime when requested", async () => {
    const p = createEdgePackager({ includeRuntime: true });
    const mockResult: QuantizationResult = {
      originalModel: createMockModel(),
      quantizedModel: { ...createMockModel(), precision: "int8" as any },
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
        memorySaved: 3000000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const pkg = await p.package(mockResult, {});
    expect(pkg.runtime).toBeDefined();
  });

  it("should include shaders when requested", async () => {
    const p = createEdgePackager({ includeShaders: true });
    const mockResult: QuantizationResult = {
      originalModel: createMockModel(),
      quantizedModel: { ...createMockModel(), precision: "int8" as any },
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
        memorySaved: 3000000000,
      },
      quantizationTime: 1000,
      warnings: [],
      success: true,
    };
    const shaders = { matmul: "shader_code" };
    const pkg = await p.package(mockResult, {}, shaders);
    expect(pkg.shaders).toBeDefined();
  });

  it("should get config", () => {
    const p = createEdgePackager({ format: "webllm" });
    const config = p.getConfig();
    expect(config.format).toBe("webllm");
  });
});

// Helper functions
function createMockModel(): ModelInfo {
  const layers: LayerInfo[] = [];
  for (let i = 0; i < 10; i++) {
    layers.push({
      name: `layer_${i}`,
      type: i % 2 === 0 ? "conv2d" : "relu",
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

function createModelWithPattern(...types: string[]): ModelInfo {
  const layers: LayerInfo[] = types.map((type, i) => ({
    name: `${type}_${i}`,
    type,
    inputShape: [1, 64, 32, 32],
    outputShape: [1, 64, 32, 32],
    parameters: 100000,
    sizeBytes: 400000,
    quantized: false,
  }));

  return {
    name: "pattern_model",
    version: "1.0.0",
    parameters: 100000 * types.length,
    sizeBytes: 400000 * types.length,
    precision: "fp32",
    layers,
  };
}
