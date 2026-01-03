/**
 * @lsi/webgpu-examples/real-world/20-ml-inference
 *
 * ML Model Inference on GPU.
 * This example demonstrates how to:
 * - Run pre-trained model inference
 * - Batch process multiple inputs
 * - Optimize inference pipeline
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, createUniformBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Model layer types
 */
export type LayerType = 'dense' | 'conv2d' | 'maxpool' | 'flatten';

/**
 * Model layer configuration
 */
export interface ModelLayer {
  type: LayerType;
  inputShape: number[];
  outputShape: number[];
  weights?: Float32Array;
  biases?: Float32Array;
  kernelSize?: number[];
  strides?: number[];
}

/**
 * ML inference engine on GPU
 */
export class GPUMLInference {
  private device: GPUDevice | null = null;
  private layers: ModelLayer[] = [];

  constructor(layers: ModelLayer[]) {
    this.layers = layers;
  }

  /**
   * Initialize inference engine
   */
  async init(): Promise<void> {
    const result = await initializeWebGPU(getDefaultConfig());
    if (!result.success || !result.device) {
      throw new Error(`Failed to initialize WebGPU: ${result.error}`);
    }
    this.device = result.device;
  }

  /**
   * Run inference
   *
   * @param input - Input tensor
   * @returns Output tensor
   */
  async infer(input: Float32Array): Promise<Float32Array> {
    if (!this.device) throw new Error('Inference engine not initialized');

    let currentData = input;

    for (const layer of this.layers) {
      currentData = await this.forwardLayer(currentData, layer);
    }

    return currentData;
  }

  /**
   * Forward pass through a layer
   */
  private async forwardLayer(input: Float32Array, layer: ModelLayer): Promise<Float32Array> {
    if (!this.device) throw new Error('Device not initialized');

    switch (layer.type) {
      case 'dense':
        return this.forwardDense(input, layer);
      case 'conv2d':
        return this.forwardConv2D(input, layer);
      case 'maxpool':
        return this.forwardMaxPool(input, layer);
      case 'flatten':
        return input; // Already flat
      default:
        throw new Error(`Unknown layer type: ${layer.type}`);
    }
  }

  /**
   * Dense layer forward pass
   */
  private async forwardDense(input: Float32Array, layer: ModelLayer): Promise<Float32Array> {
    if (!this.device || !layer.weights || !layer.biases) {
      throw new Error('Invalid dense layer');
    }

    const inputSize = layer.inputShape[0];
    const outputSize = layer.outputShape[0];

    // Create buffers
    const bufferInput = createStorageBuffer(this.device, input.byteLength, 'input');
    const bufferWeights = createStorageBuffer(this.device, layer.weights.byteLength, 'weights');
    const bufferBiases = createStorageBuffer(this.device, layer.biases.byteLength, 'biases');
    const bufferOutput = createStorageBuffer(this.device, outputSize * 4, 'output');

    writeBuffer(this.device, bufferInput, input);
    writeBuffer(this.device, bufferWeights, layer.weights);
    writeBuffer(this.device, bufferBiases, layer.biases);

    // Dense layer shader with ReLU
    const shaderCode = `
struct InputArray {
  data: array<f32>,
};

struct Weights {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputArray;
@group(0) @binding(1) var<storage, read> weights: Weights;
@group(0) @binding(2) var<storage, read> biases: InputArray;
@group(0) @binding(3) var<storage, read_write> output: InputArray;

const INPUT_SIZE = ${inputSize}u;
const OUTPUT_SIZE = ${outputSize}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let out_idx = global_id.x;
  if (out_idx >= OUTPUT_SIZE) {
    return;
  }

  var sum = biases.data[out_idx];
  for (var i = 0u; i < INPUT_SIZE; i = i + 1u) {
    sum = sum + input.data[i] * weights.data[i * OUTPUT_SIZE + out_idx];
  }

  // ReLU activation
  output.data[out_idx] = max(0.0, sum);
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
        { binding: 1, resource: { buffer: bufferWeights } },
        { binding: 2, resource: { buffer: bufferBiases } },
        { binding: 3, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(outputSize / 256));
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, outputSize * 4);
    const output = new Float32Array(outputData);

    // Clean up
    bufferInput.destroy();
    bufferWeights.destroy();
    bufferBiases.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Conv2D layer forward pass
   */
  private async forwardConv2D(input: Float32Array, layer: ModelLayer): Promise<Float32Array> {
    if (!this.device || !layer.weights || !layer.kernelSize) {
      throw new Error('Invalid conv2d layer');
    }

    const [inputHeight, inputWidth, inputChannels] = layer.inputShape;
    const [outputHeight, outputWidth, outputChannels] = layer.outputShape;
    const [kernelHeight, kernelWidth] = layer.kernelSize;
    const strides = layer.strides || [1, 1];

    // Create buffers
    const bufferInput = createStorageBuffer(this.device, input.byteLength, 'input');
    const bufferWeights = createStorageBuffer(this.device, layer.weights.byteLength, 'weights');
    const bufferOutput = createStorageBuffer(this.device, outputHeight * outputWidth * outputChannels * 4, 'output');

    writeBuffer(this.device, bufferInput, input);
    writeBuffer(this.device, bufferWeights, layer.weights);

    // Conv2D shader
    const shaderCode = `
struct InputArray {
  data: array<f32>,
};

struct Weights {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputArray;
@group(0) @binding(1) var<storage, read> weights: Weights;
@group(0) @binding(2) var<storage, read_write> output: InputArray;

const IN_H = ${inputHeight}u;
const IN_W = ${inputWidth}u;
const IN_C = ${inputChannels}u;
const OUT_H = ${outputHeight}u;
const OUT_W = ${outputWidth}u;
const OUT_C = ${outputChannels}u;
const K_H = ${kernelHeight}u;
const K_W = ${kernelWidth}u;
const STRIDE_H = ${strides[0]}u;
const STRIDE_W = ${strides[1]}u;

@workgroup_size(16, 16, 1)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let out_y = global_id.y;
  let out_x = global_id.x;
  let out_c = global_id.z;

  if (out_y >= OUT_H || out_x >= OUT_W || out_c >= OUT_C) {
    return;
  }

  var sum = 0.0;
  for (var ky = 0u; ky < K_H; ky = ky + 1u) {
    for (var kx = 0u; kx < K_W; kx = kx + 1u) {
      for (var ic = 0u; ic < IN_C; ic = ic + 1u) {
        let in_y = out_y * STRIDE_H + ky;
        let in_x = out_x * STRIDE_W + kx;

        if (in_y < IN_H && in_x < IN_W) {
          let in_idx = ((in_y * IN_W + in_x) * IN_C + ic);
          let weight_idx = ((ky * K_W + kx) * IN_C + ic) * OUT_C + out_c;
          sum = sum + input.data[in_idx] * weights.data[weight_idx];
        }
      }
    }
  }

  // ReLU
  let out_idx = (out_y * OUT_W + out_x) * OUT_C + out_c;
  output.data[out_idx] = max(0.0, sum);
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
        { binding: 0, resource: { buffer: bufferInput } },
        { binding: 1, resource: { buffer: bufferWeights } },
        { binding: 2, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(outputWidth / 16), Math.ceil(outputHeight / 16), outputChannels);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, outputHeight * outputWidth * outputChannels * 4);
    const output = new Float32Array(outputData);

    // Clean up
    bufferInput.destroy();
    bufferWeights.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Max pooling layer
   */
  private async forwardMaxPool(input: Float32Array, layer: ModelLayer): Promise<Float32Array> {
    if (!this.device) throw new Error('Device not initialized');

    const [inputHeight, inputWidth, channels] = layer.inputShape;
    const [outputHeight, outputWidth] = layer.outputShape;
    const poolSize = layer.kernelSize?.[0] || 2;
    const strides = layer.strides?.[0] || 2;

    // Create buffers
    const bufferInput = createStorageBuffer(this.device, input.byteLength, 'input');
    const bufferOutput = createStorageBuffer(this.device, outputHeight * outputWidth * channels * 4, 'output');

    writeBuffer(this.device, bufferInput, input);

    // Max pool shader
    const shaderCode = `
struct Data {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: Data;
@group(0) @binding(1) var<storage, read_write> output: Data;

const IN_H = ${inputHeight}u;
const IN_W = ${inputWidth}u;
const OUT_H = ${outputHeight}u;
const OUT_W = ${outputWidth}u;
const C = ${channels}u;
const POOL = ${poolSize}u;
const STRIDE = ${strides}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let out_idx = global_id.x;
  if (out_idx >= OUT_H * OUT_W * C) {
    return;
  }

  let c = out_idx % C;
  let out_x = (out_idx / C) % OUT_W;
  let out_y = out_idx / (OUT_W * C);

  var max_val = -1e30;
  for (var ky = 0u; ky < POOL; ky = ky + 1u) {
    for (var kx = 0u; kx < POOL; kx = kx + 1u) {
      let in_y = out_y * STRIDE + ky;
      let in_x = out_x * STRIDE + kx;

      if (in_y < IN_H && in_x < IN_W) {
        let in_idx = (in_y * IN_W + in_x) * C + c;
        max_val = max(max_val, input.data[in_idx]);
      }
    }
  }

  output.data[out_idx] = max_val;
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
        { binding: 0, resource: { buffer: bufferInput } },
        { binding: 1, resource: { buffer: bufferOutput } }
      ]
    });

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(outputHeight * outputWidth * channels / 256));
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Read output
    const outputData = await readBuffer(this.device, bufferOutput, outputHeight * outputWidth * channels * 4);
    const output = new Float32Array(outputData);

    // Clean up
    bufferInput.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Batch inference
   */
  async inferBatch(inputs: Float32Array[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    for (const input of inputs) {
      const output = await this.infer(input);
      results.push(output);
    }

    return results;
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
 * Create a simple CNN model
 */
export function createSimpleCNN(): GPUMLInference {
  const layers: ModelLayer[] = [
    // Conv2D layer: 28x28x1 -> 26x26x8, kernel 3x3
    {
      type: 'conv2d',
      inputShape: [28, 28, 1],
      outputShape: [26, 26, 8],
      kernelSize: [3, 3],
      strides: [1, 1],
      weights: new Float32Array(3 * 3 * 1 * 8).map(() => Math.random() * 0.1 - 0.05)
    },
    // MaxPool: 26x26x8 -> 13x13x8, pool 2x2
    {
      type: 'maxpool',
      inputShape: [26, 26, 8],
      outputShape: [13, 13, 8],
      kernelSize: [2, 2],
      strides: [2, 2]
    },
    // Flatten: 13x13x8 -> 1352
    {
      type: 'flatten',
      inputShape: [13, 13, 8],
      outputShape: [1352]
    },
    // Dense: 1352 -> 128
    {
      type: 'dense',
      inputShape: [1352],
      outputShape: [128],
      weights: new Float32Array(1352 * 128).map(() => Math.random() * 0.1 - 0.05),
      biases: new Float32Array(128).fill(0)
    },
    // Dense: 128 -> 10
    {
      type: 'dense',
      inputShape: [128],
      outputShape: [10],
      weights: new Float32Array(128 * 10).map(() => Math.random() * 0.1 - 0.05),
      biases: new Float32Array(10).fill(0)
    }
  ];

  return new GPUMLInference(layers);
}

/**
 * Run ML inference example
 */
export async function runMLInference(): Promise<void> {
  console.log('=== ML Model Inference on GPU ===\n');

  const model = createSimpleCNN();
  await model.init();

  // Create sample input (e.g., MNIST digit 28x28)
  const input = new Float32Array(28 * 28);
  for (let i = 0; i < 28 * 28; i++) {
    input[i] = Math.random();
  }

  console.log('Input: 28x28 image (MNIST-like)');
  console.log('Model: Simple CNN (Conv -> Pool -> Dense -> Dense)');
  console.log();

  // Run inference
  const startTime = performance.now();
  const output = await model.infer(input);
  const endTime = performance.now();

  console.log('Output (class probabilities):');
  for (let i = 0; i < output.length; i++) {
    const bar = '█'.repeat(Math.floor(output[i] * 50));
    console.log(`  Class ${i}: ${bar} ${output[i].toFixed(4)}`);
  }

  console.log();
  console.log(`Inference time: ${(endTime - startTime).toFixed(2)}ms`);

  // Batch inference
  console.log();
  console.log('Batch inference (10 samples)...');
  const inputs = Array(10).fill(null).map(() => new Float32Array(28 * 28).fill(0.5));

  const batchStart = performance.now();
  const batchOutputs = await model.inferBatch(inputs);
  const batchEnd = performance.now();

  console.log(`Batch time: ${(batchEnd - batchStart).toFixed(2)}ms`);
  console.log(`Average: ${((batchEnd - batchStart) / 10).toFixed(2)}ms per sample`);

  model.dispose();
}
