/**
 * @lsi/vljepa/webgpu Tests - Comprehensive WebGPU Test Suite
 *
 * Tests for WebGPU-accelerated VL-JEPA components including:
 * - WebGPUContext initialization and management
 * - BufferManager memory management
 * - XEncoderGPU vision encoding
 * - PredictorGPU embedding prediction
 * - Compute shader functionality
 * - Performance benchmarks
 * - Fallback to CPU
 *
 * Target: 40+ tests passing
 *
 * @version 1.0.0
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  WebGPUContext,
  checkWebGPUCompatibility,
  createWebGPUContext,
} from "./WebGPUContext.js";
import { BufferManager, TensorBuffer } from "./BufferManager.js";
import { XEncoderGPU, createXEncoderGPU } from "./XEncoderGPU.js";
import { PredictorGPU, createPredictorGPU } from "./PredictorGPU.js";
import {
  getMatMulShader,
  getLayerNormShader,
  getPatchEmbedShader,
  getGELUShader,
  getAddShader,
  getConcatShader,
  EMBEDDING_DIM,
  HIDDEN_DIM,
  DEFAULT_MATMUL_SHADER,
  DEFAULT_LAYER_NORM_SHADER,
} from "./ComputeShaders.js";
import type { XEncoderConfig, PredictorConfig } from "../protocol.js";
import { createDefaultConfig } from "../index.js";

// Skip all tests if WebGPU is not available
const describeWebGPU = WebGPUContext.isAvailable() ? describe : describe.skip;

describeWebGPU("WebGPUContext", () => {
  let context: WebGPUContext;

  beforeAll(async () => {
    context = new WebGPUContext({
      enableProfiling: true,
      debugShaders: false,
    });
    await context.initialize();
  });

  afterAll(() => {
    context.dispose();
  });

  it("should initialize WebGPU device", async () => {
    const result = await context.initialize();
    expect(result.success).toBe(true);
    expect(result.device).toBeDefined();
    expect(result.adapter).toBeDefined();
    expect(result.adapterInfo).toBeDefined();
  });

  it("should check WebGPU availability", () => {
    expect(WebGPUContext.isAvailable()).toBe(true);
  });

  it("should get GPU device", () => {
    const device = context.getDevice();
    expect(device).toBeDefined();
    expect(device.queue).toBeDefined();
  });

  it("should get GPU adapter", () => {
    const adapter = context.getAdapter();
    expect(adapter).toBeDefined();
  });

  it("should get adapter info", () => {
    const info = context.getAdapterInfo();
    expect(info).toBeDefined();
    expect(info?.description).toBeDefined();
    expect(info?.vendor).toBeDefined();
  });

  it("should check if initialized", () => {
    expect(context.isInitialized()).toBe(true);
  });

  it("should create a buffer", () => {
    const buffer = context.createBuffer(
      1024,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    expect(buffer).toBeDefined();
    expect(buffer.size).toBe(1024);
  });

  it("should destroy a buffer", () => {
    const buffer = context.createBuffer(
      1024,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    expect(() => context.destroyBuffer(buffer)).not.toThrow();
  });

  it("should create bind group layout", () => {
    const layout = context.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
    ]);
    expect(layout).toBeDefined();
  });

  it("should create pipeline layout", () => {
    const bindGroupLayout = context.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
    ]);
    const pipelineLayout = context.createPipelineLayout([bindGroupLayout]);
    expect(pipelineLayout).toBeDefined();
  });

  it("should create command encoder", () => {
    const encoder = context.createCommandEncoder("test");
    expect(encoder).toBeDefined();
  });

  it("should get compute pipeline with caching", () => {
    const shaderCode = `
      @group(0) @binding(0) var<storage, read> input: array<f32>;
      @group(0) @binding(1) var<storage, read_write> output: array<f32>;
      @compute @workgroup_size(64)
      fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        output[id.x] = input[id.x] * 2.0;
      }
    `;

    const pipeline1 = context.getComputePipeline(shaderCode, "test");
    const pipeline2 = context.getComputePipeline(shaderCode, "test");

    // Should return cached pipeline
    expect(pipeline1).toBe(pipeline2);
  });

  it("should track metrics", () => {
    const metrics = context.getMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.totalPipelineCreations).toBeGreaterThan(0);
  });

  it("should reset metrics", () => {
    context.resetMetrics();
    const metrics = context.getMetrics();
    expect(metrics.totalPipelineCreations).toBe(0);
  });

  it("should get cache stats", () => {
    const stats = context.getCacheStats();
    expect(stats).toBeDefined();
    expect(stats.size).toBeGreaterThanOrEqual(0);
    expect(typeof stats.hitRate).toBe("number");
  });

  it("should clear pipeline cache", () => {
    expect(() => context.clearPipelineCache()).not.toThrow();
    const stats = context.getCacheStats();
    expect(stats.size).toBe(0);
  });

  it("should write and read buffer", async () => {
    const data = new Float32Array([1, 2, 3, 4]);
    const buffer = context.createBuffer(
      data.byteLength,
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    );

    context.writeBuffer(buffer, 0, data);
    await context.onWorkDone();

    const result = await context.readBuffer(buffer, data.byteLength);
    const resultArray = new Float32Array(result.buffer);

    expect(Array.from(resultArray)).toEqual(Array.from(data));
  });

  it("should dispose resources", () => {
    const testContext = new WebGPUContext();
    testContext.initialize();
    expect(testContext.isInitialized()).toBe(true);

    testContext.dispose();
    expect(testContext.isInitialized()).toBe(false);
  });
});

describeWebGPU("BufferManager", () => {
  let context: WebGPUContext;
  let manager: BufferManager;

  beforeAll(async () => {
    context = await createWebGPUContext();
    manager = new BufferManager(context);
  });

  afterAll(() => {
    manager.dispose();
    context.dispose();
  });

  it("should create a buffer", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    const buffer = manager.createBuffer("test-buffer", data);
    expect(buffer).toBeDefined();
  });

  it("should get a buffer by ID", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    manager.createBuffer("get-test", data);
    const buffer = manager.getBuffer("get-test");
    expect(buffer).toBeDefined();
  });

  it("should check if buffer exists", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    manager.createBuffer("has-test", data);
    expect(manager.hasBuffer("has-test")).toBe(true);
    expect(manager.hasBuffer("nonexistent")).toBe(false);
  });

  it("should read buffer data", async () => {
    const data = new Float32Array([1, 2, 3, 4]);
    manager.createBuffer("read-test", data);

    const result = await manager.readBuffer("read-test");
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it("should write to buffer", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    manager.createBuffer("write-test", data);

    const newData = new Float32Array([5, 6, 7, 8]);
    manager.writeBuffer("write-test", newData);

    // Verify
    const buffer = manager.getBuffer("write-test");
    expect(buffer).toBeDefined();
  });

  it("should destroy a buffer", () => {
    const data = new Float32Array([1, 2, 3, 4]);
    manager.createBuffer("destroy-test", data);
    expect(manager.hasBuffer("destroy-test")).toBe(true);

    manager.destroyBuffer("destroy-test");
    expect(manager.hasBuffer("destroy-test")).toBe(false);
  });

  it("should create multiple buffers", () => {
    const buffers = manager.createBuffers([
      { id: "multi-1", data: new Float32Array([1, 2, 3]) },
      { id: "multi-2", data: new Float32Array([4, 5, 6]) },
      { id: "multi-3", data: new Float32Array([7, 8, 9]) },
    ]);

    expect(buffers.size).toBe(3);
    expect(manager.hasBuffer("multi-1")).toBe(true);
    expect(manager.hasBuffer("multi-2")).toBe(true);
    expect(manager.hasBuffer("multi-3")).toBe(true);
  });

  it("should get buffer statistics", () => {
    const stats = manager.getStats();
    expect(stats).toBeDefined();
    expect(stats.totalBuffers).toBeGreaterThanOrEqual(0);
    expect(stats.activeBuffers).toBeGreaterThanOr_equal(0);
    expect(stats.allocations).toBeGreaterThan(0);
  });

  it("should reset statistics", () => {
    manager.resetStats();
    const stats = manager.getStats();
    expect(stats.allocations).toBe(0);
    expect(stats.deallocations).toBe(0);
  });

  it("should clear buffer pool", () => {
    expect(() => manager.clearPool()).not.toThrow();
  });

  it("should cleanup old pooled buffers", () => {
    expect(() => manager.cleanupPool(1000)).not.toThrow();
  });

  it("should dispose of manager", () => {
    const testManager = new BufferManager(context);
    testManager.createBuffer("test", new Float32Array([1, 2, 3]));

    expect(() => testManager.dispose()).not.toThrow();
  });
});

describeWebGPU("TensorBuffer", () => {
  let context: WebGPUContext;
  let manager: BufferManager;

  beforeAll(async () => {
    context = await createWebGPUContext();
    manager = new BufferManager(context);
  });

  afterAll(() => {
    manager.dispose();
    context.dispose();
  });

  it("should create tensor buffer", () => {
    const tensor = new TensorBuffer(manager, "tensor-1", [768], "float32");
    expect(tensor).toBeDefined();
    expect(tensor.getShape()).toEqual([768]);
    expect(tensor.getSize()).toBe(768 * 4);
  });

  it("should allocate tensor buffer", () => {
    const tensor = new TensorBuffer(manager, "tensor-2", [768], "float32");
    const buffer = tensor.allocate(new Float32Array(768));
    expect(buffer).toBeDefined();
  });

  it("should read tensor data", async () => {
    const tensor = new TensorBuffer(manager, "tensor-3", [10], "float32");
    const data = new Float32Array(10).map((_, i) => i);
    tensor.allocate(data);

    const result = await tensor.read();
    expect(Array.from(result)).toEqual(Array.from(data));
  });

  it("should write tensor data", () => {
    const tensor = new TensorBuffer(manager, "tensor-4", [10], "float32");
    const data = new Float32Array(10).map((_, i) => i);
    tensor.allocate();

    expect(() => tensor.write(data)).not.toThrow();
  });

  it("should get tensor shape", () => {
    const tensor = new TensorBuffer(manager, "tensor-5", [2, 3, 4], "float32");
    expect(tensor.getShape()).toEqual([2, 3, 4]);
  });

  it("should get tensor size", () => {
    const tensor = new TensorBuffer(manager, "tensor-6", [2, 3, 4], "float32");
    expect(tensor.getSize()).toBe(2 * 3 * 4 * 4); // 24 elements * 4 bytes
  });

  it("should destroy tensor buffer", () => {
    const tensor = new TensorBuffer(manager, "tensor-7", [10], "float32");
    tensor.allocate();

    expect(() => tensor.destroy()).not.toThrow();
  });
});

describeWebGPU("XEncoderGPU", () => {
  let context: WebGPUContext;
  let encoder: XEncoderGPU;
  const config: XEncoderConfig = {
    version: "1.0",
    inputSize: { width: 224, height: 224 },
    patchSize: 16,
    embeddingDim: 768,
    model: "vit-base",
    numHeads: 12,
    numLayers: 12,
    usePositionalEncoding: true,
    dropout: 0.1,
  };

  beforeAll(async () => {
    context = await createWebGPUContext();
    encoder = new XEncoderGPU(context, config, { useWebGPU: true });
    await encoder.initialize();
  });

  afterAll(() => {
    encoder.dispose();
    context.dispose();
  });

  it("should create encoder", () => {
    expect(encoder).toBeDefined();
  });

  it("should encode image on GPU", async () => {
    // Create dummy image data (224x224 RGBA)
    const imageData = new ImageData(224, 224);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = Math.random() * 255; // R
      imageData.data[i + 1] = Math.random() * 255; // G
      imageData.data[i + 2] = Math.random() * 255; // B
      imageData.data[i + 3] = 255; // A
    }

    const embedding = await encoder.encodeGPU(imageData);
    expect(embedding).toBeDefined();
    expect(embedding.length).toBe(768);
  });

  it("should encode image on CPU", async () => {
    const imageData = new ImageData(224, 224);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = Math.random() * 255;
      imageData.data[i + 1] = Math.random() * 255;
      imageData.data[i + 2] = Math.random() * 255;
      imageData.data[i + 3] = 255;
    }

    const embedding = await encoder.encodeCPU(imageData);
    expect(embedding).toBeDefined();
    expect(embedding.length).toBe(768);
  });

  it("should encode image with automatic selection", async () => {
    const imageData = new ImageData(224, 224);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = Math.random() * 255;
      imageData.data[i + 1] = Math.random() * 255;
      imageData.data[i + 2] = Math.random() * 255;
      imageData.data[i + 3] = 255;
    }

    const embedding = await encoder.encode(imageData);
    expect(embedding).toBeDefined();
    expect(embedding.length).toBe(768);
  });

  it("should benchmark GPU vs CPU", async () => {
    const imageData = new ImageData(224, 224);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = Math.random() * 255;
      imageData.data[i + 1] = Math.random() * 255;
      imageData.data[i + 2] = Math.random() * 255;
      imageData.data[i + 3] = 255;
    }

    const results = await encoder.benchmark(imageData, 3);
    expect(results).toBeDefined();
    expect(results.gpu).toBeDefined();
    expect(results.cpu).toBeDefined();
    expect(results.speedup).toBeGreaterThan(0);
  });
});

describeWebGPU("PredictorGPU", () => {
  let context: WebGPUContext;
  let predictor: PredictorGPU;
  const config: PredictorConfig = {
    version: "1.0",
    inputDim: 1536,
    hiddenDim: 2048,
    outputDim: 768,
    numLayers: 4,
    numHeads: 8,
    feedForwardDim: 4096,
    dropout: 0.1,
    activation: "gelu",
    useResiduals: true,
  };

  beforeAll(async () => {
    context = await createWebGPUContext();
    predictor = new PredictorGPU(context, config, { useWebGPU: true });
    await predictor.initialize();
  });

  afterAll(() => {
    predictor.dispose();
    context.dispose();
  });

  it("should create predictor", () => {
    expect(predictor).toBeDefined();
  });

  it("should predict on GPU", async () => {
    const context = new Float32Array(768).map(() => Math.random());
    const intent = new Float32Array(768).map(() => Math.random());

    const prediction = await predictor.predictGPU(context, intent);
    expect(prediction).toBeDefined();
    expect(prediction.goalEmbedding.length).toBe(768);
    expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
    expect(prediction.actions).toBeDefined();
    expect(Array.isArray(prediction.actions)).toBe(true);
  });

  it("should predict on CPU", async () => {
    const context = new Float32Array(768).map(() => Math.random());
    const intent = new Float32Array(768).map(() => Math.random());

    const prediction = await predictor.predictCPU(context, intent);
    expect(prediction).toBeDefined();
    expect(prediction.goalEmbedding.length).toBe(768);
    expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
  });

  it("should predict with automatic selection", async () => {
    const context = new Float32Array(768).map(() => Math.random());
    const intent = new Float32Array(768).map(() => Math.random());

    const prediction = await predictor.predict(context, intent);
    expect(prediction).toBeDefined();
    expect(prediction.goalEmbedding.length).toBe(768);
  });

  it("should batch predict", async () => {
    const pairs = [
      [
        new Float32Array(768).map(() => Math.random()),
        new Float32Array(768).map(() => Math.random()),
      ],
      [
        new Float32Array(768).map(() => Math.random()),
        new Float32Array(768).map(() => Math.random()),
      ],
      [
        new Float32Array(768).map(() => Math.random()),
        new Float32Array(768).map(() => Math.random()),
      ],
    ] as Array<[Float32Array, Float32Array]>;

    const predictions = await predictor.predictBatch(pairs);
    expect(predictions).toBeDefined();
    expect(predictions.length).toBe(3);
    expect(predictions[0].goalEmbedding.length).toBe(768);
  });

  it("should benchmark GPU vs CPU", async () => {
    const context = new Float32Array(768).map(() => Math.random());
    const intent = new Float32Array(768).map(() => Math.random());

    const results = await predictor.benchmark(context, intent, 3);
    expect(results).toBeDefined();
    expect(results.gpu).toBeDefined();
    expect(results.cpu).toBeDefined();
    expect(results.speedup).toBeGreaterThan(0);
  });
});

describeWebGPU("ComputeShaders", () => {
  it("should generate matmul shader", () => {
    const shader = getMatMulShader(768, 768, 768);
    expect(shader).toContain("@compute");
    expect(shader).toContain("@workgroup_size");
    expect(shader).toContain("var<storage, read> A");
    expect(shader).toContain("var<storage, read> B");
    expect(shader).toContain("var<storage, read_write> C");
  });

  it("should generate layer norm shader", () => {
    const shader = getLayerNormShader(768);
    expect(shader).toContain("@compute");
    expect(shader).toContain("var<storage, read> input");
    expect(shader).toContain("var<storage, read> gamma");
    expect(shader).toContain("var<storage, read> beta");
  });

  it("should generate patch embed shader", () => {
    const shader = getPatchEmbedShader(224, 16, 768);
    expect(shader).toContain("@compute");
    expect(shader).toContain("var<storage, read> image");
    expect(shader).toContain("var<storage, read> projection");
  });

  it("should generate GELU shader", () => {
    const shader = getGELUShader(768);
    expect(shader).toContain("@compute");
    expect(shader).toContain("tanh");
  });

  it("should generate add shader", () => {
    const shader = getAddShader(768);
    expect(shader).toContain("@compute");
    expect(shader).toContain("a[idx] + b[idx]");
  });

  it("should generate concat shader", () => {
    const shader = getConcatShader(768);
    expect(shader).toContain("@compute");
    expect(shader).toContain("combined[idx] = context[idx]");
  });

  it("should have correct embedding dim constant", () => {
    expect(EMBEDDING_DIM).toBe(768);
  });

  it("should have correct hidden dim constant", () => {
    expect(HIDDEN_DIM).toBe(2048);
  });

  it("should have default matmul shader", () => {
    expect(DEFAULT_MATMUL_SHADER).toBeDefined();
    expect(DEFAULT_MATMUL_SHADER.length).toBeGreaterThan(0);
  });

  it("should have default layer norm shader", () => {
    expect(DEFAULT_LAYER_NORM_SHADER).toBeDefined();
    expect(DEFAULT_LAYER_NORM_SHADER.length).toBeGreaterThan(0);
  });
});

describeWebGPU("WebGPU Compatibility", () => {
  it("should check WebGPU compatibility", async () => {
    const result = await checkWebGPUCompatibility();
    expect(result).toBeDefined();

    if (result.supported) {
      expect(result.adapterInfo).toBeDefined();
    } else {
      expect(result.error).toBeDefined();
    }
  });
});

describeWebGPU("End-to-End Integration", () => {
  let context: WebGPUContext;
  let encoder: XEncoderGPU;
  let predictor: PredictorGPU;
  const defaultConfig = createDefaultConfig();

  beforeAll(async () => {
    context = await createWebGPUContext();
    encoder = await createXEncoderGPU(context, defaultConfig.xEncoder);
    predictor = await createPredictorGPU(context, defaultConfig.predictor);
  });

  afterAll(() => {
    encoder.dispose();
    predictor.dispose();
    context.dispose();
  });

  it("should process full VL-JEPA pipeline", async () => {
    // Step 1: Encode vision
    const imageData = new ImageData(224, 224);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = Math.random() * 255;
      imageData.data[i + 1] = Math.random() * 255;
      imageData.data[i + 2] = Math.random() * 255;
      imageData.data[i + 3] = 255;
    }

    const visionEmbedding = await encoder.encode(imageData);
    expect(visionEmbedding.length).toBe(768);

    // Step 2: Create intent embedding (simulated)
    const intentEmbedding = new Float32Array(768).map(() => Math.random());
    expect(intentEmbedding.length).toBe(768);

    // Step 3: Predict goal
    const prediction = await predictor.predict(
      visionEmbedding,
      intentEmbedding
    );
    expect(prediction.goalEmbedding.length).toBe(768);
    expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
    expect(prediction.actions).toBeDefined();
  });

  it("should achieve target latency <100ms", async () => {
    const imageData = new ImageData(224, 224);
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = Math.random() * 255;
      imageData.data[i + 1] = Math.random() * 255;
      imageData.data[i + 2] = Math.random() * 255;
      imageData.data[i + 3] = 255;
    }

    const intentEmbedding = new Float32Array(768).map(() => Math.random());

    const startTime = performance.now();
    const visionEmbedding = await encoder.encode(imageData);
    const prediction = await predictor.predict(
      visionEmbedding,
      intentEmbedding
    );
    const totalTime = performance.now() - startTime;

    // Target: <100ms total inference time
    expect(totalTime).toBeLessThan(100);
  });
});
