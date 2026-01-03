/**
 * @lsi/webgpu-examples/vljepa/13-x-encoder-gpu
 *
 * VL-JEPA X-Encoder (Vision) on GPU.
 * This example demonstrates how to:
 * - Implement Vision Transformer (ViT) components on GPU
 * - Process image patches and embeddings
 * - Accelerate VL-JEPA vision encoding with WebGPU
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, createUniformBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * X-Encoder configuration
 */
export interface XEncoderConfig {
  imageSize: number;
  patchSize: number;
  embeddingDim: number;
  numLayers: number;
  numHeads: number;
}

/**
 * Default X-Encoder configuration (768-dim embeddings)
 */
export const DEFAULT_X_ENCODER_CONFIG: XEncoderConfig = {
  imageSize: 224,
  patchSize: 16,
  embeddingDim: 768,
  numLayers: 12,
  numHeads: 12
};

/**
 * X-Encoder GPU implementation for VL-JEPA
 */
export class XEncoderGPU {
  private device: GPUDevice | null = null;
  private config: XEncoderConfig;
  private patchEmbeddingBuffer: GPUBuffer | null = null;
  private positionEmbeddingBuffer: GPUBuffer | null = null;

  constructor(config: XEncoderConfig = DEFAULT_X_ENCODER_CONFIG) {
    this.config = config;
  }

  /**
   * Initialize X-Encoder
   */
  async init(): Promise<void> {
    const result = await initializeWebGPU(getDefaultConfig());
    if (!result.success || !result.device) {
      throw new Error(`Failed to initialize WebGPU: ${result.error}`);
    }
    this.device = result.device;
  }

  /**
   * Extract patches from image
   *
   * @param image - Image data (H x W x C)
   * @returns Patch embeddings
   */
  async extractPatches(image: Float32Array): Promise<Float32Array> {
    if (!this.device) throw new Error('X-Encoder not initialized');

    const { imageSize, patchSize, embeddingDim } = this.config;
    const numPatches = (imageSize / patchSize) ** 2;
    const patchDim = patchSize * patchSize * 3; // RGB

    // Create buffers
    const bufferImage = createStorageBuffer(this.device, image.byteLength, 'image');
    const bufferPatches = createStorageBuffer(this.device, numPatches * patchDim * 4, 'patches');

    writeBuffer(this.device, bufferImage, image);

    // Patch extraction shader
    const shaderCode = `
struct ImageData {
  data: array<f32>,
};

struct PatchData {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> image: ImageData;
@group(0) @binding(1) var<storage, read_write> patches: PatchData;

const IMAGE_SIZE = ${imageSize}u;
const PATCH_SIZE = ${patchSize}u;
const NUM_PATCHES = ${numPatches}u;
const PATCH_DIM = ${patchDim}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let patch_idx = global_id.x;
  let pixel_idx = global_id.y;

  if (patch_idx >= NUM_PATCHES || pixel_idx >= PATCH_DIM) {
    return;
  }

  let patch_row = patch_idx / u32(IMAGE_SIZE / PATCH_SIZE);
  let patch_col = patch_idx % u32(IMAGE_SIZE / PATCH_SIZE);

  let pixel_row = pixel_idx / (PATCH_SIZE * 3u);
  let pixel_col = (pixel_idx % (PATCH_SIZE * 3u)) / 3u;
  let channel = pixel_idx % 3u;

  let img_row = patch_row * PATCH_SIZE + pixel_row;
  let img_col = patch_col * PATCH_SIZE + pixel_col;

  if (img_row < IMAGE_SIZE && img_col < IMAGE_SIZE) {
    let img_idx = (img_row * IMAGE_SIZE * 3u) + (img_col * 3u) + channel;
    patches.data[patch_idx * PATCH_DIM + pixel_idx] = image.data[img_idx];
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
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
      ]
    });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferImage } },
        { binding: 1, resource: { buffer: bufferPatches } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(numPatches / 256), patchDim);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read patches
    const patchesData = await readBuffer(this.device, bufferPatches, numPatches * patchDim * 4);
    const patches = new Float32Array(patchesData);

    // Clean up
    bufferImage.destroy();
    bufferPatches.destroy();

    return patches;
  }

  /**
   * Apply patch embedding projection
   *
   * @param patches - Flattened patch data
   * @param weights - Projection weights
   * @returns Embedded patches
   */
  async patchEmbedding(
    patches: Float32Array,
    weights: Float32Array
  ): Promise<Float32Array> {
    if (!this.device) throw new Error('X-Encoder not initialized');

    const { embeddingDim } = this.config;
    const numPatches = patches.length / (this.config.patchSize * this.config.patchSize * 3);

    // Create buffers
    const bufferPatches = createStorageBuffer(this.device, patches.byteLength, 'patches');
    const bufferWeights = createStorageBuffer(this.device, weights.byteLength, 'weights');
    const bufferOutput = createStorageBuffer(this.device, numPatches * embeddingDim * 4, 'embedded');

    writeBuffer(this.device, bufferPatches, patches);
    writeBuffer(this.device, bufferWeights, weights);

    // Patch embedding shader (matrix multiplication)
    const shaderCode = `
struct InputData {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> patches: InputData;
@group(0) @binding(1) var<storage, read> weights: InputData;
@group(0) @binding(2) var<storage, read_write> output: InputData;

const NUM_PATCHES = ${numPatches}u;
const EMBED_DIM = ${embeddingDim}u;
const PATCH_DIM = ${this.config.patchSize * this.config.patchSize * 3}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let patch_idx = global_id.y;
  let embed_idx = global_id.x;

  if (patch_idx >= NUM_PATCHES || embed_idx >= EMBED_DIM) {
    return;
  }

  var sum = 0.0;
  for (var i = 0u; i < PATCH_DIM; i = i + 1u) {
    sum = sum + patches.data[patch_idx * PATCH_DIM + i] * weights.data[i * EMBED_DIM + embed_idx];
  }

  output.data[patch_idx * EMBED_DIM + embed_idx] = sum;
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
        { binding: 0, resource: { buffer: bufferPatches } },
        { binding: 1, resource: { buffer: bufferWeights } },
        { binding: 2, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(embeddingDim / 256), numPatches);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, numPatches * embeddingDim * 4);
    const output = new Float32Array(outputData);

    // Clean up
    bufferPatches.destroy();
    bufferWeights.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Apply positional embeddings
   *
   * @param patches - Patch embeddings without position
   * @param positionEmbeddings - Position embeddings to add
   * @returns Patch embeddings with position
   */
  async addPositionEmbeddings(
    patches: Float32Array,
    positionEmbeddings: Float32Array
  ): Promise<Float32Array> {
    if (!this.device) throw new Error('X-Encoder not initialized');

    // Create buffers
    const bufferPatches = createStorageBuffer(this.device, patches.byteLength, 'patches');
    const bufferPos = createStorageBuffer(this.device, positionEmbeddings.byteLength, 'position');
    const bufferOutput = createStorageBuffer(this.device, patches.byteLength, 'output');

    writeBuffer(this.device, bufferPatches, patches);
    writeBuffer(this.device, bufferPos, positionEmbeddings);

    // Position embedding addition shader
    const shaderCode = `
struct Data {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> patches: Data;
@group(0) @binding(1) var<storage, read> position: Data;
@group(0) @binding(2) var<storage, read_write> output: Data;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&patches.data)) {
    return;
  }
  output.data[idx] = patches.data[idx] + position.data[idx];
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
        { binding: 0, resource: { buffer: bufferPatches } },
        { binding: 1, resource: { buffer: bufferPos } },
        { binding: 2, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(patches.length / 256));
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, patches.byteLength);
    const output = new Float32Array(outputData);

    // Clean up
    bufferPatches.destroy();
    bufferPos.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Encode image to 768-dim embedding
   *
   * @param image - Image data (224x224x3 flattened)
   * @param weights - Model weights
   * @returns 768-dim embedding
   */
  async encode(image: Float32Array, weights: any): Promise<Float32Array> {
    // Extract patches
    const patches = await this.extractPatches(image);

    // Apply patch embedding
    const embedded = await this.patchEmbedding(patches, weights.patchEmbedding);

    // Add positional embeddings
    const withPosition = await this.addPositionEmbeddings(embedded, weights.positionEmbedding);

    // Apply transformer layers (simplified - would need multi-step processing)
    // For now, return mean pooling of patch embeddings
    const numPatches = withPosition.length / this.config.embeddingDim;
    const embedding = new Float32Array(this.config.embeddingDim);

    for (let i = 0; i < this.config.embeddingDim; i++) {
      let sum = 0;
      for (let j = 0; j < numPatches; j++) {
        sum += withPosition[j * this.config.embeddingDim + i];
      }
      embedding[i] = sum / numPatches;
    }

    return embedding;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.patchEmbeddingBuffer) {
      this.patchEmbeddingBuffer.destroy();
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
 * Run X-Encoder example
 */
export async function runXEncoderGPU(): Promise<void> {
  console.log('=== VL-JEPA X-Encoder (Vision) on GPU ===\n');

  const encoder = new XEncoderGPU();
  await encoder.init();

  // Create sample image (224x224x3)
  const imageSize = 224 * 224 * 3;
  const image = new Float32Array(imageSize);
  for (let i = 0; i < imageSize; i++) {
    image[i] = Math.random();
  }

  console.log('Input image: 224x224x3');
  console.log('Processing on GPU...');

  // Create dummy weights
  const patchDim = 16 * 16 * 3; // patch_size^2 * channels
  const weights = {
    patchEmbedding: new Float32Array(patchDim * 768).map(() => Math.random() * 0.1),
    positionEmbedding: new Float32Array(196 * 768).map(() => Math.random() * 0.01)
  };

  const startTime = performance.now();
  const embedding = await encoder.encode(image, weights);
  const endTime = performance.now();

  console.log(`Output embedding: ${embedding.length} dimensions`);
  console.log(`First 10 values: [${Array.from(embedding.slice(0, 10)).map(v => v.toFixed(4)).join(', ')}]`);
  console.log(`Encoding time: ${(endTime - startTime).toFixed(2)}ms`);

  encoder.dispose();
}
