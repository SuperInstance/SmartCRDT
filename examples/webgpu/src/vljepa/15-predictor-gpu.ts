/**
 * @lsi/webgpu-examples/vljepa/15-predictor-gpu
 *
 * VL-JEPA Predictor on GPU.
 * This example demonstrates how to:
 * - Combine X and Y encoder embeddings
 * - Predict goal state embeddings
 * - Generate action predictions
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Predictor configuration
 */
export interface PredictorConfig {
  embeddingDim: number;
  hiddenDim: number;
  numLayers: number;
}

/**
 * Default predictor configuration
 */
export const DEFAULT_PREDICTOR_CONFIG: PredictorConfig = {
  embeddingDim: 768,
  hiddenDim: 2048,
  numLayers: 4
};

/**
 * Action types for VL-JEPA
 */
export type JEPAAction = 'modify' | 'create' | 'delete';

/**
 * Predicted action with parameters
 */
export interface PredictedAction {
  type: JEPAAction;
  confidence: number;
  target: string;
  params: Record<string, unknown>;
}

/**
 * VL-JEPA Predictor on GPU
 */
export class PredictorGPU {
  private device: GPUDevice | null = null;
  private config: PredictorConfig;

  constructor(config: PredictorConfig = DEFAULT_PREDICTOR_CONFIG) {
    this.config = config;
  }

  /**
   * Initialize predictor
   */
  async init(): Promise<void> {
    const result = await initializeWebGPU(getDefaultConfig());
    if (!result.success || !result.device) {
      throw new Error(`Failed to initialize WebGPU: ${result.error}`);
    }
    this.device = result.device;
  }

  /**
   * Combine X and Y embeddings
   *
   * @param xEmbedding - Vision embedding (768-dim)
   * @param yEmbedding - Language embedding (768-dim)
   * @param weights - Combination weights
   * @returns Combined embedding
   */
  async combineEmbeddings(
    xEmbedding: Float32Array,
    yEmbedding: Float32Array,
    weights: { Wx: Float32Array; Wy: Float32Array; bias: Float32Array }
  ): Promise<Float32Array> {
    if (!this.device) throw new Error('Predictor not initialized');

    const { embeddingDim, hiddenDim } = this.config;

    // Create buffers
    const bufferX = createStorageBuffer(this.device, xEmbedding.byteLength, 'x');
    const bufferY = createStorageBuffer(this.device, yEmbedding.byteLength, 'y');
    const bufferWx = createStorageBuffer(this.device, weights.Wx.byteLength, 'wx');
    const bufferWy = createStorageBuffer(this.device, weights.Wy.byteLength, 'wy');
    const bufferBias = createStorageBuffer(this.device, weights.bias.byteLength, 'bias');
    const bufferOutput = createStorageBuffer(this.device, hiddenDim * 4, 'output');

    writeBuffer(this.device, bufferX, xEmbedding);
    writeBuffer(this.device, bufferY, yEmbedding);
    writeBuffer(this.device, bufferWx, weights.Wx);
    writeBuffer(this.device, bufferWy, weights.Wy);
    writeBuffer(this.device, bufferBias, weights.bias);

    // Combination shader
    const shaderCode = `
struct Data {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> x: Data;
@group(0) @binding(1) var<storage, read> y: Data;
@group(0) @binding(2) var<storage, read> wx: Data;
@group(0) @binding(3) var<storage, read> wy: Data;
@group(0) @binding(4) var<storage, read> bias: Data;
@group(0) @binding(5) var<storage, read_write> output: Data;

const EMBED_DIM = ${embeddingDim}u;
const HIDDEN_DIM = ${hiddenDim}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= HIDDEN_DIM) {
    return;
  }

  var sum = bias.data[idx];
  for (var i = 0u; i < EMBED_DIM; i = i + 1u) {
    sum = sum + x.data[i] * wx.data[i * HIDDEN_DIM + idx];
    sum = sum + y.data[i] * wy.data[i * HIDDEN_DIM + idx];
  }

  // GELU activation
  output.data[idx] = sum * 0.5 * (1.0 + tanh(0.7978845608 * (sum + 0.044715 * sum * sum * sum)));
}
`;

    // Create and dispatch
    const shaderModule = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      compute: { module: shaderModule, entryPoint: 'main' }
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferX } },
        { binding: 1, resource: { buffer: bufferY } },
        { binding: 2, resource: { buffer: bufferWx } },
        { binding: 3, resource: { buffer: bufferWy } },
        { binding: 4, resource: { buffer: bufferBias } },
        { binding: 5, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(hiddenDim / 256));
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, hiddenDim * 4);
    const output = new Float32Array(outputData);

    // Clean up
    bufferX.destroy();
    bufferY.destroy();
    bufferWx.destroy();
    bufferWy.destroy();
    bufferBias.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Predict goal state
   *
   * @param combined - Combined X+Y embedding
   * @param weights - Prediction weights
   * @returns Goal state embedding (768-dim)
   */
  async predictGoal(
    combined: Float32Array,
    weights: { W: Float32Array; bias: Float32Array }
  ): Promise<Float32Array> {
    if (!this.device) throw new Error('Predictor not initialized');

    const { embeddingDim, hiddenDim } = this.config;

    // Create buffers
    const bufferInput = createStorageBuffer(this.device, combined.byteLength, 'input');
    const bufferW = createStorageBuffer(this.device, weights.W.byteLength, 'w');
    const bufferBias = createStorageBuffer(this.device, weights.bias.byteLength, 'bias');
    const bufferOutput = createStorageBuffer(this.device, embeddingDim * 4, 'output');

    writeBuffer(this.device, bufferInput, combined);
    writeBuffer(this.device, bufferW, weights.W);
    writeBuffer(this.device, bufferBias, weights.bias);

    // Goal prediction shader
    const shaderCode = `
struct Data {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: Data;
@group(0) @binding(1) var<storage, read> w: Data;
@group(0) @binding(2) var<storage, read> bias: Data;
@group(0) @binding(3) var<storage, read_write> output: Data;

const HIDDEN_DIM = ${hiddenDim}u;
const EMBED_DIM = ${embeddingDim}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= EMBED_DIM) {
    return;
  }

  var sum = bias.data[idx];
  for (var i = 0u; i < HIDDEN_DIM; i = i + 1u) {
    sum = sum + input.data[i] * w.data[i * EMBED_DIM + idx];
  }

  output.data[idx] = sum;
}
`;

    // Create and dispatch
    const shaderModule = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      compute: { module: shaderModule, entryPoint: 'main' }
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferInput } },
        { binding: 1, resource: { buffer: bufferW } },
        { binding: 2, resource: { buffer: bufferBias } },
        { binding: 3, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(embeddingDim / 256));
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, embeddingDim * 4);
    const output = new Float32Array(outputData);

    // Clean up
    bufferInput.destroy();
    bufferW.destroy();
    bufferBias.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Predict actions from goal state
   *
   * @param goal - Goal state embedding
   * @param weights - Action prediction weights
   * @returns Predicted actions with confidence scores
   */
  async predictActions(
    goal: Float32Array,
    weights: {
      modify: Float32Array;
      create: Float32Array;
      delete: Float32Array;
    }
  ): Promise<PredictedAction[]> {
    if (!this.device) throw new Error('Predictor not initialized');

    const { embeddingDim } = this.config;

    // Create buffers
    const bufferGoal = createStorageBuffer(this.device, goal.byteLength, 'goal');
    const bufferWModify = createStorageBuffer(this.device, weights.modify.byteLength, 'w_modify');
    const bufferWCreate = createStorageBuffer(this.device, weights.create.byteLength, 'w_create');
    const bufferWDelete = createStorageBuffer(this.device, weights.delete.byteLength, 'w_delete');
    const bufferScores = createStorageBuffer(this.device, 3 * 4, 'scores');

    writeBuffer(this.device, bufferGoal, goal);
    writeBuffer(this.device, bufferWModify, weights.modify);
    writeBuffer(this.device, bufferWCreate, weights.create);
    writeBuffer(this.device, bufferWDelete, weights.delete);

    // Action scoring shader
    const shaderCode = `
struct Data {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> goal: Data;
@group(0) @binding(1) var<storage, read> w_modify: Data;
@group(0) @binding(2) var<storage, read> w_create: Data;
@group(0) @binding(3) var<storage, read> w_delete: Data;
@group(0) @binding(4) var<storage, read_write> scores: Data;

const EMBED_DIM = ${embeddingDim}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let action_idx = global_id.x;
  if (action_idx >= 3u) {
    return;
  }

  var dot = 0.0;
  for (var i = 0u; i < EMBED_DIM; i = i + 1u) {
    let weight = 0.0;
    if (action_idx == 0u) {
      weight = w_modify.data[i];
    } else if (action_idx == 1u) {
      weight = w_create.data[i];
    } else {
      weight = w_delete.data[i];
    }
    dot = dot + goal.data[i] * weight;
  }

  // Sigmoid to get probability
  scores.data[action_idx] = 1.0 / (1.0 + exp(-dot));
}
`;

    // Create and dispatch
    const shaderModule = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      compute: { module: shaderModule, entryPoint: 'main' }
    });

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferGoal } },
        { binding: 1, resource: { buffer: bufferWModify } },
        { binding: 2, resource: { buffer: bufferWCreate } },
        { binding: 3, resource: { buffer: bufferWDelete } },
        { binding: 4, resource: { buffer: bufferScores } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(1);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read scores
    const scoresData = await readBuffer(this.device, bufferScores, 3 * 4);
    const scores = new Float32Array(scoresData);

    // Clean up
    bufferGoal.destroy();
    bufferWModify.destroy();
    bufferWCreate.destroy();
    bufferWDelete.destroy();
    bufferScores.destroy();

    // Create action predictions
    const actions: PredictedAction[] = [
      { type: 'modify', confidence: scores[0], target: 'ui_element', params: {} },
      { type: 'create', confidence: scores[1], target: 'ui_element', params: {} },
      { type: 'delete', confidence: scores[2], target: 'ui_element', params: {} }
    ];

    return actions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Full prediction pipeline
   *
   * @param xEmbedding - Vision embedding
   * @param yEmbedding - Language embedding
   * @param weights - All prediction weights
   * @returns Goal embedding and predicted actions
   */
  async predict(
    xEmbedding: Float32Array,
    yEmbedding: Float32Array,
    weights: any
  ): Promise<{ goal: Float32Array; actions: PredictedAction[] }> {
    // Combine embeddings
    const combined = await this.combineEmbeddings(
      xEmbedding,
      yEmbedding,
      weights.combine
    );

    // Predict goal state
    const goal = await this.predictGoal(combined, weights.goal);

    // Predict actions
    const actions = await this.predictActions(goal, weights.actions);

    return { goal, actions };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}

/**
 * Run predictor example
 */
export async function runPredictorGPU(): Promise<void> {
  console.log('=== VL-JEPA Predictor on GPU ===\n');

  const predictor = new PredictorGPU();
  await predictor.init();

  // Create sample embeddings
  const xEmbedding = new Float32Array(768).map(() => Math.random() * 0.1);
  const yEmbedding = new Float32Array(768).map(() => Math.random() * 0.1);

  console.log('X-Embedding (first 10):', Array.from(xEmbedding.slice(0, 10)).map(v => v.toFixed(4)).join(', '));
  console.log('Y-Embedding (first 10):', Array.from(yEmbedding.slice(0, 10)).map(v => v.toFixed(4)).join(', '));
  console.log('\nProcessing on GPU...');

  // Create dummy weights
  const weights = {
    combine: {
      Wx: new Float32Array(768 * 2048).map(() => Math.random() * 0.1),
      Wy: new Float32Array(768 * 2048).map(() => Math.random() * 0.1),
      bias: new Float32Array(2048).fill(0)
    },
    goal: {
      W: new Float32Array(2048 * 768).map(() => Math.random() * 0.1),
      bias: new Float32Array(768).fill(0)
    },
    actions: {
      modify: new Float32Array(768).map(() => Math.random() * 0.1),
      create: new Float32Array(768).map(() => Math.random() * 0.1),
      delete: new Float32Array(768).map(() => Math.random() * 0.1)
    }
  };

  const startTime = performance.now();
  const { goal, actions } = await predictor.predict(xEmbedding, yEmbedding, weights);
  const endTime = performance.now();

  console.log('\n--- Results ---');
  console.log(`Goal embedding: ${goal.length} dimensions`);
  console.log(`Goal (first 10): [${Array.from(goal.slice(0, 10)).map(v => v.toFixed(4)).join(', ')}]`);

  console.log('\nPredicted actions:');
  for (const action of actions) {
    console.log(`  ${action.type}: ${(action.confidence * 100).toFixed(1)}% confidence`);
  }

  console.log(`\nPrediction time: ${(endTime - startTime).toFixed(2)}ms`);

  predictor.dispose();
}
