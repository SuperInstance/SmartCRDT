/**
 * @lsi/webgpu-examples/getting-started/02-compute-shader
 *
 * Simple Compute Shader - Basic compute shader execution.
 * This example demonstrates how to:
 * - Write a simple WGSL compute shader
 * - Compile and create a compute pipeline
 * - Dispatch a compute shader
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createComputeShader, createBindGroup } from '../utils/ShaderUtils.js';
import { createStorageBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Simple compute shader example - adds 1 to each element
 *
 * @param inputArray - Input array of numbers
 * @returns Promise resolving to output array
 */
export async function simpleComputeShader(inputArray: Float32Array): Promise<Float32Array> {
  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Create input and output buffers
  const inputBuffer = createStorageBuffer(device, inputArray.byteLength, 'input-buffer');
  const outputBuffer = createStorageBuffer(device, inputArray.byteLength, 'output-buffer');

  // Write input data
  writeBuffer(device, inputBuffer, inputArray);

  // Write initial zeros to output
  const zeros = new Float32Array(inputArray.length);
  writeBuffer(device, outputBuffer, zeros);

  // Create compute shader
  const shaderCode = createComputeShader([64, 1, 1], `
    let index = global_id.x;
    if (index < ${inputArray.length}u) {
      output[index] = input[index] + 1.0;
    }
  `);

  // Add storage buffer declarations
  const fullShaderCode = `
struct StorageArray {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: StorageArray;
@group(0) @binding(1) var<storage, read_write> output: StorageArray;

` + shaderCode;

  // Create compute pipeline
  const pipeline = device.createComputePipeline({
    compute: {
      module: device.createShaderModule({ code: fullShaderCode }),
      entryPoint: 'main'
    }
  });

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' }
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' }
      }
    ]
  });

  // Create bind group
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } }
    ]
  });

  // Dispatch compute shader
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(inputArray.length / 64));
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read results
  const outputData = await readBuffer(device, outputBuffer, inputArray.byteLength);
  const outputArray = new Float32Array(outputData);

  // Clean up
  inputBuffer.destroy();
  outputBuffer.destroy();
  disposeWebGPU(device);

  return outputArray;
}

/**
 * Run the simple compute shader example
 */
export async function runSimpleComputeShader(): Promise<void> {
  const input = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
  console.log('Input:', input);

  const output = await simpleComputeShader(input);
  console.log('Output:', output);
  console.log('Expected:', input.map(x => x + 1));
}
