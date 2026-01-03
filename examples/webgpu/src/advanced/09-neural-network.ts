/**
 * @lsi/webgpu-examples/advanced/09-neural-network
 *
 * Neural Network Inference on GPU.
 * This example demonstrates how to:
 * - Implement a simple neural network on GPU
 * - Perform matrix-vector multiplication for layers
 * - Apply activation functions
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, createUniformBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Neural network layer configuration
 */
export interface LayerConfig {
  inputSize: number;
  outputSize: number;
  hasBias: boolean;
  activation: 'relu' | 'sigmoid' | 'tanh' | 'none';
}

/**
 * Neural network weights
 */
export interface Weights {
  weights: Float32Array;
  biases?: Float32Array;
}

/**
 * Simple fully connected neural network for GPU inference
 */
export class GPUNeuralNetwork {
  private device: GPUDevice | null = null;
  private layers: LayerConfig[] = [];

  /**
   * Initialize the neural network
   */
  async init(layers: LayerConfig[]): Promise<void> {
    const config = getDefaultConfig();
    const result = await initializeWebGPU(config);

    if (!result.success || !result.device) {
      throw new Error(`Failed to initialize WebGPU: ${result.error}`);
    }

    this.device = result.device;
    this.layers = layers;
  }

  /**
   * Perform forward pass
   *
   * @param input - Input vector
   * @param allWeights - Array of weights for each layer
   * @returns Network output
   */
  async forward(input: Float32Array, allWeights: Weights[]): Promise<Float32Array> {
    if (!this.device) {
      throw new Error('Neural network not initialized');
    }

    let current = input;

    // Process each layer
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const weights = allWeights[i];

      current = await this.forwardLayer(current, layer, weights);
    }

    return current;
  }

  /**
   * Forward pass for a single layer
   */
  private async forwardLayer(
    input: Float32Array,
    layer: LayerConfig,
    weights: Weights
  ): Promise<Float32Array> {
    if (!this.device) throw new Error('Device not initialized');

    const { inputSize, outputSize, hasBias, activation } = layer;

    // Create buffers
    const bufferInput = createStorageBuffer(this.device, input.byteLength, 'input');
    const bufferWeights = createStorageBuffer(this.device, weights.weights.byteLength, 'weights');
    const bufferBias = hasBias && weights.biases
      ? createStorageBuffer(this.device, weights.biases.byteLength, 'bias')
      : null;
    const bufferOutput = createStorageBuffer(this.device, outputSize * 4, 'output');

    // Write input data
    writeBuffer(this.device, bufferInput, input);
    writeBuffer(this.device, bufferWeights, weights.weights);
    if (bufferBias && weights.biases) {
      writeBuffer(this.device, bufferBias, weights.biases);
    }

    // Get activation function code
    const activationCode = this.getActivationCode(activation);

    // Create shader
    const shaderCode = `
struct InputArray {
  data: array<f32>,
};

struct WeightsArray {
  data: array<f32>,
};

${bufferBias ? 'struct BiasArray { data: array<f32> },' : ''}
struct OutputArray {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputArray;
@group(0) @binding(1) var<storage, read> weights: WeightsArray;
${bufferBias ? '@group(0) @binding(2) var<storage, read> bias: BiasArray;' : ''}
@group(0) @binding(${bufferBias ? 3 : 2}) var<storage, read_write> output: OutputArray;

const INPUT_SIZE = ${inputSize}u;
const OUTPUT_SIZE = ${outputSize}u;

fn apply_activation(x: f32) -> f32 {
  return ${activationCode};
}

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let out_idx = global_id.x;
  if (out_idx >= OUTPUT_SIZE) {
    return;
  }

  var sum = 0.0;
  for (var i = 0u; i < INPUT_SIZE; i = i + 1u) {
    sum = sum + input.data[i] * weights.data[out_idx * INPUT_SIZE + i];
  }

  ${bufferBias ? 'sum = sum + bias.data[out_idx];' : ''}

  output.data[out_idx] = apply_activation(sum);
}
`;

    // Create pipeline
    const shaderModule = this.device.createShaderModule({ code: shaderCode });
    const pipeline = this.device.createComputePipeline({
      compute: { module: shaderModule, entryPoint: 'main' }
    });

    // Create bind group layout
    const entries: GPUBindGroupLayoutEntry[] = [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }
    ];

    if (bufferBias) {
      entries.push({ binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } });
    }

    entries.push({ binding: bufferBias ? 3 : 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } });

    const bindGroupLayout = this.device.createBindGroupLayout({ entries });

    // Create bind group
    const bindGroupEntries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: bufferInput } },
      { binding: 1, resource: { buffer: bufferWeights } }
    ];

    if (bufferBias) {
      bindGroupEntries.push({ binding: 2, resource: { buffer: bufferBias! } });
    }

    bindGroupEntries.push({ binding: bufferBias ? 3 : 2, resource: { buffer: bufferOutput } });

    const bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: bindGroupEntries
    });

    // Dispatch
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
    if (bufferBias) bufferBias.destroy();
    bufferOutput.destroy();

    return output;
  }

  /**
   * Get WGSL activation function code
   */
  private getActivationCode(activation: string): string {
    switch (activation) {
      case 'relu':
        return 'max(0.0, x)';
      case 'sigmoid':
        return '1.0 / (1.0 + exp(-x))';
      case 'tanh':
        return '(exp(x) - exp(-x)) / (exp(x) + exp(-x))';
      case 'none':
        return 'x';
      default:
        return 'x';
    }
  }

  /**
   * Dispose of neural network resources
   */
  dispose(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}

/**
 * Create a simple MLP for XOR problem
 */
export function createXORNetwork(): { layers: LayerConfig[]; weights: Weights[] } {
  const layers: LayerConfig[] = [
    { inputSize: 2, outputSize: 4, hasBias: true, activation: 'relu' },
    { inputSize: 4, outputSize: 1, hasBias: true, activation: 'sigmoid' }
  ];

  // Pre-trained weights for XOR (approximately)
  const weights: Weights[] = [
    {
      weights: new Float32Array([
        // Hidden layer weights
        1.0, 1.0, -1.0, -1.0,
        1.0, -1.0, 1.0, -1.0
      ]),
      biases: new Float32Array([0, 0, 0, 0])
    },
    {
      weights: new Float32Array([
        1.0, 1.0, 1.0, 1.0
      ]),
      biases: new Float32Array([-0.5])
    }
  ];

  return { layers, weights };
}

/**
 * Run neural network example
 */
export async function runNeuralNetwork(): Promise<void> {
  const nn = new GPUNeuralNetwork();

  // Create network
  const { layers, weights } = createXORNetwork();

  console.log('Initializing GPU Neural Network...');
  await nn.init(layers);

  console.log('Testing XOR function on GPU:');
  console.log('');

  // Test XOR inputs
  const testCases = [
    new Float32Array([0, 0]),
    new Float32Array([0, 1]),
    new Float32Array([1, 0]),
    new Float32Array([1, 1])
  ];

  for (const input of testCases) {
    const output = await nn.forward(input, weights);
    console.log(`XOR(${input[0]}, ${input[1]}) = ${(output[0] > 0.5 ? 1 : 0).toFixed(1)} (raw: ${output[0].toFixed(4)})`);
  }

  nn.dispose();
}
