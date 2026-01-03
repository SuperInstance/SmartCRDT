/**
 * @lsi/webgpu-examples/vljepa/14-y-encoder-gpu
 *
 * VL-JEPA Y-Encoder (Language) on GPU.
 * This example demonstrates how to:
 * - Implement Language Transformer on GPU
 * - Process text tokens to embeddings
 * - Accelerate VL-JEPA language encoding with WebGPU
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Y-Encoder configuration
 */
export interface YEncoderConfig {
  vocabSize: number;
  maxSeqLen: number;
  embeddingDim: number;
  numLayers: number;
  numHeads: number;
}

/**
 * Default Y-Encoder configuration (768-dim embeddings)
 */
export const DEFAULT_Y_ENCODER_CONFIG: YEncoderConfig = {
  vocabSize: 50000,
  maxSeqLen: 512,
  embeddingDim: 768,
  numLayers: 12,
  numHeads: 12
};

/**
 * Y-Encoder GPU implementation for VL-JEPA
 */
export class YEncoderGPU {
  private device: GPUDevice | null = null;
  private config: YEncoderConfig;
  private tokenEmbeddingBuffer: GPUBuffer | null = null;
  private positionEmbeddingBuffer: GPUBuffer | null = null;

  constructor(config: YEncoderConfig = DEFAULT_Y_ENCODER_CONFIG) {
    this.config = config;
  }

  /**
   * Initialize Y-Encoder
   */
  async init(): Promise<void> {
    const result = await initializeWebGPU(getDefaultConfig());
    if (!result.success || !result.device) {
      throw new Error(`Failed to initialize WebGPU: ${result.error}`);
    }
    this.device = result.device;
  }

  /**
   * Token embedding lookup
   *
   * @param tokens - Token IDs
   * @param embeddingMatrix - Vocabulary embedding matrix
   * @returns Token embeddings
   */
  async tokenEmbedding(
    tokens: Uint32Array,
    embeddingMatrix: Float32Array
  ): Promise<Float32Array> {
    if (!this.device) throw new Error('Y-Encoder not initialized');

    const { vocabSize, embeddingDim } = this.config;
    const seqLen = tokens.length;

    // Create buffers
    const bufferTokens = createStorageBuffer(this.device, tokens.byteLength, 'tokens');
    const bufferEmbeddings = createStorageBuffer(this.device, embeddingMatrix.byteLength, 'embeddings');
    const bufferOutput = createStorageBuffer(this.device, seqLen * embeddingDim * 4, 'output');

    writeBuffer(this.device, bufferTokens, tokens);
    writeBuffer(this.device, bufferEmbeddings, embeddingMatrix);

    // Token embedding lookup shader
    const shaderCode = `
struct TokenArray {
  data: array<u32>,
};

struct EmbeddingMatrix {
  data: array<f32>,
};

struct OutputArray {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> tokens: TokenArray;
@group(0) @binding(1) var<storage, read> embeddings: EmbeddingMatrix;
@group(0) @binding(2) var<storage, read_write> output: OutputArray;

const SEQ_LEN = ${seqLen}u;
const EMBED_DIM = ${embeddingDim}u;
const VOCAB_SIZE = ${vocabSize}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let token_idx = global_id.y;
  let embed_idx = global_id.x;

  if (token_idx >= SEQ_LEN || embed_idx >= EMBED_DIM) {
    return;
  }

  let token_id = tokens.data[token_idx];
  if (token_id < VOCAB_SIZE) {
    output.data[token_idx * EMBED_DIM + embed_idx] = embeddings.data[token_id * EMBED_DIM + embed_idx];
  } else {
    output.data[token_idx * EMBED_DIM + embed_idx] = 0.0;
  }
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
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferTokens } },
        { binding: 1, resource: { buffer: bufferEmbeddings } },
        { binding: 2, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(embeddingDim / 256), seqLen);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, seqLen * embeddingDim * 4);
    const output = new Float32Array(outputData);

    // Clean up
    bufferTokens.destroy();
    bufferEmbeddings.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Add positional embeddings
   *
   * @param tokens - Token embeddings
   * @param positionEmbeddings - Position embeddings
   * @returns Tokens with position
   */
  async addPositionEmbeddings(
    tokens: Float32Array,
    positionEmbeddings: Float32Array
  ): Promise<Float32Array> {
    if (!this.device) throw new Error('Y-Encoder not initialized');

    // Create buffers
    const bufferTokens = createStorageBuffer(this.device, tokens.byteLength, 'tokens');
    const bufferPos = createStorageBuffer(this.device, positionEmbeddings.byteLength, 'position');
    const bufferOutput = createStorageBuffer(this.device, tokens.byteLength, 'output');

    writeBuffer(this.device, bufferTokens, tokens);
    writeBuffer(this.device, bufferPos, positionEmbeddings);

    // Position embedding addition shader
    const shaderCode = `
struct Data {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> tokens: Data;
@group(0) @binding(1) var<storage, read> position: Data;
@group(0) @binding(2) var<storage, read_write> output: Data;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&tokens.data)) {
    return;
  }
  output.data[idx] = tokens.data[idx] + position.data[idx];
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
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferTokens } },
        { binding: 1, resource: { buffer: bufferPos } },
        { binding: 2, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(tokens.length / 256));
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, tokens.byteLength);
    const output = new Float32Array(outputData);

    // Clean up
    bufferTokens.destroy();
    bufferPos.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Self-attention layer
   *
   * @param hidden - Hidden state
   * @param weights - Q, K, V projection weights
   * @returns Attention output
   */
  async selfAttention(
    hidden: Float32Array,
    weights: { Q: Float32Array; K: Float32Array; V: Float32Array }
  ): Promise<Float32Array> {
    if (!this.device) throw new Error('Y-Encoder not initialized');

    const { embeddingDim, numHeads } = this.config;
    const seqLen = hidden.length / embeddingDim;
    const headDim = embeddingDim / numHeads;

    // Simplified attention: concatenate QKV projections and do matmul
    // Full implementation would have separate Q, K, V projections and softmax

    // For now, return hidden state as placeholder
    return hidden;
  }

  /**
   * Feed-forward network layer
   *
   * @param hidden - Hidden state
   * @param weights - FFN weights
   * @returns FFN output
   */
  async feedForward(
    hidden: Float32Array,
    weights: { W1: Float32Array; W2: Float32Array }
  ): Promise<Float32Array> {
    if (!this.device) throw new Error('Y-Encoder not initialized');

    const { embeddingDim } = this.config;
    const ffnDim = weights.W1.length / embeddingDim;
    const seqLen = hidden.length / embeddingDim;

    // Create buffers
    const bufferInput = createStorageBuffer(this.device, hidden.byteLength, 'input');
    const bufferW1 = createStorageBuffer(this.device, weights.W1.byteLength, 'w1');
    const bufferW2 = createStorageBuffer(this.device, weights.W2.byteLength, 'w2');
    const bufferOutput = createStorageBuffer(this.device, hidden.byteLength, 'output');

    writeBuffer(this.device, bufferInput, hidden);
    writeBuffer(this.device, bufferW1, weights.W1);
    writeBuffer(this.device, bufferW2, weights.W2);

    // FFN shader
    const shaderCode = `
struct Data {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: Data;
@group(0) @binding(1) var<storage, read> w1: Data;
@group(0) @binding(2) var<storage, read> w2: Data;
@group(0) @binding(3) var<storage, read_write> output: Data;

const SEQ_LEN = ${seqLen}u;
const EMBED_DIM = ${embeddingDim}u;
const FFN_DIM = ${ffnDim}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let seq_idx = global_id.y;
  let embed_idx = global_id.x;

  if (seq_idx >= SEQ_LEN || embed_idx >= EMBED_DIM) {
    return;
  }

  // First linear: input -> ffn_dim
  var hidden_val = 0.0;
  for (var i = 0u; i < EMBED_DIM; i = i + 1u) {
    hidden_val = hidden_val + input.data[seq_idx * EMBED_DIM + i] * w1.data[i * FFN_DIM + embed_idx];
  }

  // GELU activation
  hidden_val = hidden_val * 0.5 * (1.0 + tanh(0.7978845608 * (hidden_val + 0.044715 * hidden_val * hidden_val * hidden_val)));

  // Second linear: ffn_dim -> embed_dim
  var output_val = 0.0;
  for (var i = 0u; i < FFN_DIM; i = i + 1u) {
    output_val = output_val + hidden_val * w2.data[i * EMBED_DIM + embed_idx];
  }

  output.data[seq_idx * EMBED_DIM + embed_idx] = output_val;
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
        { binding: 1, resource: { buffer: bufferW1 } },
        { binding: 2, resource: { buffer: bufferW2 } },
        { binding: 3, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(embeddingDim / 256), seqLen);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, hidden.byteLength);
    const output = new Float32Array(outputData);

    // Clean up
    bufferInput.destroy();
    bufferW1.destroy();
    bufferW2.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Encode text to 768-dim embedding
   *
   * @param tokens - Token IDs
   * @param weights - Model weights
   * @returns 768-dim embedding
   */
  async encode(tokens: Uint32Array, weights: any): Promise<Float32Array> {
    // Token embedding lookup
    let hidden = await this.tokenEmbedding(tokens, weights.tokenEmbedding);

    // Add positional embeddings
    hidden = await this.addPositionEmbeddings(hidden, weights.positionEmbedding);

    // Apply transformer layers (simplified)
    for (let i = 0; i < this.config.numLayers; i++) {
      // Self-attention (placeholder)
      hidden = await this.selfAttention(hidden, weights.layers[i].attention);

      // Feed-forward
      hidden = await this.feedForward(hidden, weights.layers[i].ffn);
    }

    // Mean pooling to get single embedding
    const seqLen = tokens.length;
    const embedding = new Float32Array(this.config.embeddingDim);
    for (let i = 0; i < this.config.embeddingDim; i++) {
      let sum = 0;
      for (let j = 0; j < seqLen; j++) {
        sum += hidden[j * this.config.embeddingDim + i];
      }
      embedding[i] = sum / seqLen;
    }

    return embedding;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.tokenEmbeddingBuffer) {
      this.tokenEmbeddingBuffer.destroy();
    }
    if (this.positionEmbeddingBuffer) {
      this.positionEmbeddingBuffer.destroy();
    }
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}

/**
 * Run Y-Encoder example
 */
export async function runYEncoderGPU(): Promise<void> {
  console.log('=== VL-JEPA Y-Encoder (Language) on GPU ===\n');

  const encoder = new YEncoderGPU();
  await encoder.init();

  // Create sample tokens (e.g., "make button pop")
  const tokens = new Uint32Array([100, 500, 1234, 5678]); // Example token IDs

  console.log('Input tokens:', Array.from(tokens));
  console.log('Processing on GPU...');

  // Create dummy weights
  const weights = {
    tokenEmbedding: new Float32Array(50000 * 768).map(() => Math.random() * 0.1),
    positionEmbedding: new Float32Array(512 * 768).map(() => Math.random() * 0.01),
    layers: Array(12).fill(null).map(() => ({
      attention: {
        Q: new Float32Array(768 * 768).map(() => Math.random() * 0.1),
        K: new Float32Array(768 * 768).map(() => Math.random() * 0.1),
        V: new Float32Array(768 * 768).map(() => Math.random() * 0.1)
      },
      ffn: {
        W1: new Float32Array(768 * 3072).map(() => Math.random() * 0.1),
        W2: new Float32Array(3072 * 768).map(() => Math.random() * 0.1)
      }
    }))
  };

  const startTime = performance.now();
  const embedding = await encoder.encode(tokens, weights);
  const endTime = performance.now();

  console.log(`Output embedding: ${embedding.length} dimensions`);
  console.log(`First 10 values: [${Array.from(embedding.slice(0, 10)).map(v => v.toFixed(4)).join(', ')}]`);
  console.log(`Encoding time: ${(endTime - startTime).toFixed(2)}ms`);

  encoder.dispose();
}
