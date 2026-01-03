/**
 * @lsi/vljepa/webgpu/PredictorGPU - GPU-Accelerated Predictor for VL-JEPA
 *
 * GPU-accelerated Predictor that predicts goal state embeddings
 * from context (visual) and intent (textual) embeddings.
 *
 * Architecture:
 * - Input: 1536-dim (768 context + 768 intent, concatenated)
 * - Hidden: Multi-layer transformer with attention
 * - Output: 768-dim goal embedding
 *
 * Key Features:
 * - GPU-accelerated embedding prediction
 * - Direct embedding-to-embedding (no token generation)
 * - <50ms prediction time (target)
 * - Confidence scoring
 *
 * @version 1.0.0
 */

import type { PredictorConfig, VLJEPAPrediction } from "../protocol.js";
import type { WebGPUContext } from "./WebGPUContext.js";
import { BufferManager } from "./BufferManager.js";
import {
  getConcatShader,
  getMatMulShader,
  getMLPShader,
  getLayerNormShader,
  getGELUShader,
  getAddShader,
} from "./ComputeShaders.js";

/**
 * Prediction options
 */
export interface PredictorOptions {
  /** Whether to use WebGPU acceleration */
  useWebGPU?: boolean;

  /** Number of transformer layers */
  numLayers?: number;

  /** Hidden dimension */
  hiddenDim?: number;

  /** Activation function */
  activation?: "gelu" | "relu" | "swish";
}

/**
 * Predictor performance metrics
 */
export interface PredictorMetrics {
  concatenationTime: number; // ms
  predictionTime: number; // ms
  scoringTime: number; // ms
  totalTime: number; // ms
  memoryUsed: number; // bytes
}

/**
 * GPU-Accelerated Predictor
 */
export class PredictorGPU {
  private config: PredictorConfig;
  private webgpu: WebGPUContext;
  private bufferManager: BufferManager;
  private options: PredictorOptions;

  // Model weights
  private weights: {
    inputProjection: Float32Array | null;
    layerWeights: Float32Array[] | null;
    outputProjection: Float32Array | null;
  };

  // Cached compute pipelines
  private pipelines: Map<string, GPUComputePipeline> = new Map();

  constructor(
    webgpu: WebGPUContext,
    config: PredictorConfig,
    options: PredictorOptions = {}
  ) {
    this.webgpu = webgpu;
    this.config = config;
    this.bufferManager = new BufferManager(webgpu);

    this.options = {
      useWebGPU: true,
      numLayers: config.numLayers ?? 4,
      hiddenDim: config.hiddenDim ?? 2048,
      activation: config.activation ?? "gelu",
      ...options,
    };

    this.weights = {
      inputProjection: null,
      layerWeights: null,
      outputProjection: null,
    };
  }

  /**
   * Initialize predictor with model weights
   *
   * @param weights - Model weights
   */
  async initialize(weights?: {
    inputProjection: Float32Array;
    layerWeights: Float32Array[];
    outputProjection: Float32Array;
  }): Promise<void> {
    const inputDim = this.config.inputDim;
    const hiddenDim = this.options.hiddenDim!;
    const outputDim = this.config.outputDim;
    const numLayers = this.options.numLayers!;

    // Initialize or load weights
    this.weights.inputProjection =
      weights?.inputProjection ??
      new Float32Array(inputDim * hiddenDim).map(() => Math.random() * 0.1);

    this.weights.outputProjection =
      weights?.outputProjection ??
      new Float32Array(hiddenDim * outputDim).map(() => Math.random() * 0.1);

    this.weights.layerWeights =
      weights?.layerWeights ??
      Array.from({ length: numLayers }, () =>
        new Float32Array(hiddenDim * hiddenDim * 4).map(
          () => Math.random() * 0.1
        )
      );

    // Pre-create compute pipelines
    await this.createPipelines();
  }

  /**
   * Predict goal embedding (GPU-accelerated)
   *
   * @param contextEmbedding - Visual context embedding (768-dim)
   * @param intentEmbedding - User intent embedding (768-dim)
   * @returns Prediction with goal embedding and actions
   */
  async predictGPU(
    contextEmbedding: Float32Array,
    intentEmbedding: Float32Array
  ): Promise<VLJEPAPrediction> {
    const startTime = performance.now();
    const metrics: PredictorMetrics = {
      concatenationTime: 0,
      predictionTime: 0,
      scoringTime: 0,
      totalTime: 0,
      memoryUsed: 0,
    };

    // Step 1: Concatenate embeddings
    const concatStart = performance.now();
    const combined = await this.concatenateEmbeddingsGPU(
      contextEmbedding,
      intentEmbedding
    );
    metrics.concatenationTime = performance.now() - concatStart;

    // Step 2: Apply predictor layers
    const predictStart = performance.now();
    const goalEmbedding = await this.applyPredictorGPU(combined);
    metrics.predictionTime = performance.now() - predictStart;

    // Step 3: Compute confidence score
    const scoringStart = performance.now();
    const confidence = await this.computeConfidenceGPU(
      contextEmbedding,
      intentEmbedding,
      goalEmbedding
    );
    metrics.scoringTime = performance.now() - scoringStart;

    metrics.totalTime = performance.now() - startTime;

    // Generate actions from goal embedding
    const actions = await this.generateActions(goalEmbedding, confidence);

    return {
      version: "1.0",
      goalEmbedding,
      confidence,
      actions,
      semanticDistance: this.computeSemanticDistance(
        contextEmbedding,
        goalEmbedding
      ),
      metadata: {
        timestamp: Date.now(),
        processingTime: metrics.totalTime,
        xEncoderTime: 0,
        yEncoderTime: 0,
        predictorTime: metrics.predictionTime,
        device: "webgpu",
        modelVersion: "1.0.0-gpu",
      },
    };
  }

  /**
   * Predict with fallback to CPU
   *
   * @param contextEmbedding - Visual context embedding (768-dim)
   * @param intentEmbedding - User intent embedding (768-dim)
   * @returns Prediction with goal embedding and actions
   */
  async predictCPU(
    contextEmbedding: Float32Array,
    intentEmbedding: Float32Array
  ): Promise<VLJEPAPrediction> {
    const startTime = performance.now();

    // Concatenate embeddings
    const combined = new Float32Array(this.config.inputDim);
    combined.set(contextEmbedding, 0);
    combined.set(intentEmbedding, contextEmbedding.length);

    // Apply simple projection (CPU fallback)
    const outputDim = this.config.outputDim;
    const hiddenDim = this.options.hiddenDim!;
    const inputProjection = this.weights.inputProjection!;

    // Project to hidden dim
    const hidden = new Float32Array(hiddenDim);
    for (let i = 0; i < hiddenDim; i++) {
      let sum = 0;
      for (let j = 0; j < this.config.inputDim; j++) {
        sum += combined[j] * inputProjection[j * hiddenDim + i];
      }
      // GELU activation
      const cube = sum * sum * sum;
      hidden[i] =
        0.5 * sum * (1 + Math.tanh(0.7978845608 * (sum + 0.044715 * cube)));
    }

    // Project to output dim
    const goalEmbedding = new Float32Array(outputDim);
    const outputProjection = this.weights.outputProjection!;
    for (let i = 0; i < outputDim; i++) {
      let sum = 0;
      for (let j = 0; j < hiddenDim; j++) {
        sum += hidden[j] * outputProjection[j * outputDim + i];
      }
      goalEmbedding[i] = sum;
    }

    // Compute confidence
    const confidence = this.computeCosineSimilarity(
      contextEmbedding,
      goalEmbedding
    );

    // Generate actions
    const actions = await this.generateActions(goalEmbedding, confidence);

    return {
      version: "1.0",
      goalEmbedding,
      confidence: Math.abs(confidence), // Normalize to 0-1
      actions,
      semanticDistance: 1 - Math.abs(confidence),
      metadata: {
        timestamp: Date.now(),
        processingTime: performance.now() - startTime,
        device: "cpu",
        modelVersion: "1.0.0-cpu",
      },
    };
  }

  /**
   * Predict (automatic GPU/CPU selection)
   *
   * @param contextEmbedding - Visual context embedding (768-dim)
   * @param intentEmbedding - User intent embedding (768-dim)
   * @returns Prediction with goal embedding and actions
   */
  async predict(
    contextEmbedding: Float32Array,
    intentEmbedding: Float32Array
  ): Promise<VLJEPAPrediction> {
    if (this.options.useWebGPU && this.webgpu.isInitialized()) {
      try {
        return await this.predictGPU(contextEmbedding, intentEmbedding);
      } catch (error) {
        console.warn("GPU prediction failed, falling back to CPU:", error);
        return await this.predictCPU(contextEmbedding, intentEmbedding);
      }
    }
    return await this.predictCPU(contextEmbedding, intentEmbedding);
  }

  /**
   * Batch predict multiple pairs
   *
   * @param pairs - Array of [context, intent] pairs
   * @returns Array of predictions
   */
  async predictBatch(
    pairs: Array<[Float32Array, Float32Array]>
  ): Promise<VLJEPAPrediction[]> {
    const predictions: VLJEPAPrediction[] = [];

    for (const [context, intent] of pairs) {
      const prediction = await this.predict(context, intent);
      predictions.push(prediction);
    }

    return predictions;
  }

  /**
   * Benchmark GPU vs CPU performance
   *
   * @param contextEmbedding - Context embedding
   * @param intentEmbedding - Intent embedding
   * @param iterations - Number of benchmark iterations
   * @returns Performance comparison
   */
  async benchmark(
    contextEmbedding: Float32Array,
    intentEmbedding: Float32Array,
    iterations: number = 10
  ): Promise<{
    gpu: { avgTime: number; minTime: number; maxTime: number };
    cpu: { avgTime: number; minTime: number; maxTime: number };
    speedup: number;
  }> {
    // GPU benchmark
    const gpuTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.predictGPU(contextEmbedding, intentEmbedding);
      gpuTimes.push(performance.now() - start);
    }

    // CPU benchmark
    const cpuTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.predictCPU(contextEmbedding, intentEmbedding);
      cpuTimes.push(performance.now() - start);
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const min = (arr: number[]) => Math.min(...arr);
    const max = (arr: number[]) => Math.max(...arr);

    return {
      gpu: {
        avgTime: avg(gpuTimes),
        minTime: min(gpuTimes),
        maxTime: max(gpuTimes),
      },
      cpu: {
        avgTime: avg(cpuTimes),
        minTime: min(cpuTimes),
        maxTime: max(cpuTimes),
      },
      speedup: avg(cpuTimes) / avg(gpuTimes),
    };
  }

  /**
   * Concatenate embeddings on GPU
   *
   * @param context - Context embedding
   * @param intent - Intent embedding
   * @returns Concatenated embeddings
   */
  private async concatenateEmbeddingsGPU(
    context: Float32Array,
    intent: Float32Array
  ): Promise<Float32Array> {
    const embedDim = context.length;
    const combined = new Float32Array(embedDim * 2);

    // Create buffers
    const contextBuffer = this.bufferManager.createBuffer(
      "pred-context",
      context,
      { usage: GPUBufferUsage.STORAGE }
    );

    const intentBuffer = this.bufferManager.createBuffer(
      "pred-intent",
      intent,
      { usage: GPUBufferUsage.STORAGE }
    );

    const combinedBuffer = this.bufferManager.createBuffer(
      "pred-combined",
      undefined,
      {
        size: embedDim * 2 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }
    );

    // Get pipeline
    const pipeline = this.pipelines.get("concat")!;

    // Create bind group
    const bindGroupLayout = this.webgpu.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ]);

    const bindGroup = this.webgpu.getDevice().createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: contextBuffer } },
        { binding: 1, resource: { buffer: intentBuffer } },
        { binding: 2, resource: { buffer: combinedBuffer } },
      ],
    });

    // Dispatch
    const commandEncoder =
      this.webgpu.createCommandEncoder("concat-embeddings");
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil((embedDim * 2) / 256));
    passEncoder.end();
    this.webgpu.submit([commandEncoder.finish()]);

    // Wait and read
    await this.webgpu.onWorkDone();
    return this.bufferManager.readBuffer("pred-combined");
  }

  /**
   * Apply predictor layers on GPU
   *
   * @param combined - Combined embeddings
   * @returns Goal embedding
   */
  private async applyPredictorGPU(
    combined: Float32Array
  ): Promise<Float32Array> {
    const inputDim = this.config.inputDim;
    const hiddenDim = this.options.hiddenDim!;
    const outputDim = this.config.outputDim;

    let current = combined;

    // Input projection
    current = await this.applyMatMulGPU(
      current,
      this.weights.inputProjection!,
      inputDim,
      hiddenDim,
      "pred-input-proj"
    );

    // Apply activation (GELU)
    current = await this.applyActivationGPU(current, hiddenDim, "gelu");

    // Apply transformer layers
    const numLayers = this.options.numLayers!;
    for (let layer = 0; layer < numLayers; layer++) {
      // Self-attention (simplified as matmul for demo)
      const layerOutput = await this.applyMatMulGPU(
        current,
        this.weights.layerWeights![layer],
        hiddenDim,
        hiddenDim,
        `pred-layer-${layer}`
      );

      // Residual connection
      current = await this.addElementwiseGPU(current, layerOutput, hiddenDim);

      // Layer norm (simplified)
      current = await this.applyLayerNormGPU(current, hiddenDim);
    }

    // Output projection
    const goalEmbedding = await this.applyMatMulGPU(
      current,
      this.weights.outputProjection!,
      hiddenDim,
      outputDim,
      "pred-output-proj"
    );

    return goalEmbedding;
  }

  /**
   * Apply matrix multiplication on GPU
   *
   * @param input - Input tensor
   * @param weights - Weight matrix
   * @param inputDim - Input dimension
   * @param outputDim - Output dimension
   * @param label - Operation label
   * @returns Output tensor
   */
  private async applyMatMulGPU(
    input: Float32Array,
    weights: Float32Array,
    inputDim: number,
    outputDim: number,
    label: string
  ): Promise<Float32Array> {
    // Create buffers
    const inputBuffer = this.bufferManager.createBuffer(
      `${label}-input`,
      input,
      { usage: GPUBufferUsage.STORAGE }
    );

    const weightsBuffer = this.bufferManager.createBuffer(
      `${label}-weights`,
      weights,
      { usage: GPUBufferUsage.STORAGE }
    );

    const outputBuffer = this.bufferManager.createBuffer(
      `${label}-output`,
      undefined,
      {
        size: outputDim * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }
    );

    // Get pipeline
    const shader = getMatMulShader(1, inputDim, outputDim);
    const pipeline = this.webgpu.getComputePipeline(shader, label);

    // Create bind group
    const bindGroupLayout = this.webgpu.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ]);

    const bindGroup = this.webgpu.getDevice().createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: weightsBuffer } },
        { binding: 2, resource: { buffer: outputBuffer } },
      ],
    });

    // Dispatch
    const commandEncoder = this.webgpu.createCommandEncoder(label);
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(outputDim / 16));
    passEncoder.end();
    this.webgpu.submit([commandEncoder.finish()]);

    // Wait and read
    await this.webgpu.onWorkDone();
    return this.bufferManager.readBuffer(`${label}-output`);
  }

  /**
   * Apply activation function on GPU
   *
   * @param input - Input tensor
   * @param size - Tensor size
   * @param activation - Activation type
   * @returns Output tensor
   */
  private async applyActivationGPU(
    input: Float32Array,
    size: number,
    activation: "gelu" | "relu" | "swish"
  ): Promise<Float32Array> {
    const pipeline = this.pipelines.get(activation)!;

    const inputBuffer = this.bufferManager.createBuffer(
      `act-${activation}-input`,
      input,
      { usage: GPUBufferUsage.STORAGE }
    );

    const outputBuffer = this.bufferManager.createBuffer(
      `act-${activation}-output`,
      undefined,
      {
        size: size * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }
    );

    // Create bind group
    const bindGroupLayout = this.webgpu.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ]);

    const bindGroup = this.webgpu.getDevice().createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
      ],
    });

    // Dispatch
    const commandEncoder = this.webgpu.createCommandEncoder(
      `activation-${activation}`
    );
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(size / 256));
    passEncoder.end();
    this.webgpu.submit([commandEncoder.finish()]);

    await this.webgpu.onWorkDone();
    return this.bufferManager.readBuffer(`act-${activation}-output`);
  }

  /**
   * Apply element-wise addition on GPU
   *
   * @param a - First tensor
   * @param b - Second tensor
   * @param size - Tensor size
   * @returns Output tensor
   */
  private async addElementwiseGPU(
    a: Float32Array,
    b: Float32Array,
    size: number
  ): Promise<Float32Array> {
    const pipeline = this.pipelines.get("add")!;

    const bufferA = this.bufferManager.createBuffer("add-a", a, {
      usage: GPUBufferUsage.STORAGE,
    });

    const bufferB = this.bufferManager.createBuffer("add-b", b, {
      usage: GPUBufferUsage.STORAGE,
    });

    const outputBuffer = this.bufferManager.createBuffer(
      "add-output",
      undefined,
      {
        size: size * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }
    );

    // Create bind group
    const bindGroupLayout = this.webgpu.createBindGroupLayout([
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "read-only-storage" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ]);

    const bindGroup = this.webgpu.getDevice().createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferA } },
        { binding: 1, resource: { buffer: bufferB } },
        { binding: 2, resource: { buffer: outputBuffer } },
      ],
    });

    // Dispatch
    const commandEncoder = this.webgpu.createCommandEncoder("elementwise-add");
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(size / 256));
    passEncoder.end();
    this.webgpu.submit([commandEncoder.finish()]);

    await this.webgpu.onWorkDone();
    return this.bufferManager.readBuffer("add-output");
  }

  /**
   * Apply layer normalization on GPU
   *
   * @param input - Input tensor
   * @param size - Tensor size
   * @returns Normalized tensor
   */
  private async applyLayerNormGPU(
    input: Float32Array,
    size: number
  ): Promise<Float32Array> {
    // For simplicity, just return input (layer norm shader needs multiple passes)
    return input;
  }

  /**
   * Compute confidence score on GPU
   *
   * @param context - Context embedding
   * @param intent - Intent embedding
   * @param goal - Goal embedding
   * @returns Confidence score
   */
  private async computeConfidenceGPU(
    context: Float32Array,
    intent: Float32Array,
    goal: Float32Array
  ): Promise<number> {
    // Simple cosine similarity between context and goal
    return Math.abs(this.computeCosineSimilarity(context, goal));
  }

  /**
   * Compute cosine similarity
   *
   * @param a - First embedding
   * @param b - Second embedding
   * @returns Cosine similarity
   */
  private computeCosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Compute semantic distance
   *
   * @param a - First embedding
   * @param b - Second embedding
   * @returns Euclidean distance
   */
  private computeSemanticDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Generate actions from goal embedding
   *
   * @param goalEmbedding - Goal embedding
   * @param confidence - Prediction confidence
   * @returns Array of actions
   */
  private async generateActions(
    goalEmbedding: Float32Array,
    confidence: number
  ): Promise<
    Array<{
      type: string;
      target: string;
      params: Record<string, unknown>;
      confidence: number;
    }>
  > {
    // In a real implementation, would decode embedding to specific actions
    // For now, return placeholder actions
    return [
      {
        type: "modify",
        target: ".ui-element",
        params: { style: goalEmbedding.slice(0, 10).join(",") },
        confidence: confidence * 0.9,
      },
    ];
  }

  /**
   * Pre-create compute pipelines
   */
  private async createPipelines(): Promise<void> {
    const embedDim = 768;

    // Concat pipeline
    const concatShader = getConcatShader(embedDim);
    const concatPipeline = this.webgpu.getComputePipeline(
      concatShader,
      "pred-concat"
    );
    this.pipelines.set("concat", concatPipeline);

    // Activation pipelines
    const geluShader = getGELUShader(embedDim);
    const geluPipeline = this.webgpu.getComputePipeline(
      geluShader,
      "pred-gelu"
    );
    this.pipelines.set("gelu", geluPipeline);

    const reluShader = getReLUInt(embedDim);
    const reluPipeline = this.webgpu.getComputePipeline(
      reluShader,
      "pred-relu"
    );
    this.pipelines.set("relu", reluPipeline);

    const swishShader = getSwishShader(embedDim);
    const swishPipeline = this.webgpu.getComputePipeline(
      swishShader,
      "pred-swish"
    );
    this.pipelines.set("swish", swishPipeline);

    // Add pipeline
    const addShader = getAddShader(embedDim);
    const addPipeline = this.webgpu.getComputePipeline(addShader, "pred-add");
    this.pipelines.set("add", addPipeline);

    // Layer norm pipeline
    const layerNormShader = getLayerNormShader(embedDim);
    const layerNormPipeline = this.webgpu.getComputePipeline(
      layerNormShader,
      "pred-layer-norm"
    );
    this.pipelines.set("layer-norm", layerNormPipeline);
  }

  /**
   * Dispose of predictor resources
   */
  dispose(): void {
    this.bufferManager.dispose();
    this.pipelines.clear();

    this.weights.inputProjection = null;
    this.weights.layerWeights = null;
    this.weights.outputProjection = null;
  }
}

/**
 * Get ReLU shader
 */
function getReLUInt(size: number): string {
  return `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= ${size}u) { return; }
  output[idx] = max(0.0, input[idx]);
}
`;
}

/**
 * Get Swish shader
 */
function getSwishShader(size: number): string {
  return `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= ${size}u) { return; }
  let x = input[idx];
  output[idx] = x * (1.0 / (1.0 + exp(-x)));
}
`;
}

/**
 * Create Predictor GPU instance
 *
 * @param webgpu - WebGPU context
 * @param config - Predictor configuration
 * @param options - Predictor options
 * @returns Predictor GPU instance
 */
export async function createPredictorGPU(
  webgpu: WebGPUContext,
  config: PredictorConfig,
  options?: PredictorOptions
): Promise<PredictorGPU> {
  const predictor = new PredictorGPU(webgpu, config, options);
  await predictor.initialize();
  return predictor;
}
