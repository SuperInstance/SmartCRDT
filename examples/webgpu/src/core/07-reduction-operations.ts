/**
 * @lsi/webgpu-examples/core/07-reduction-operations
 *
 * Reduction Operations on GPU.
 * This example demonstrates how to:
 * - Perform parallel reduction for sum, min, max
 * - Use workgroup memory for optimization
 * - Handle synchronization within workgroups
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, createUniformBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Reduction operation types
 */
export type ReductionOp = 'sum' | 'min' | 'max' | 'avg';

/**
 * Perform parallel reduction on GPU
 *
 * @param data - Input array
 * @param op - Reduction operation
 * @returns Reduction result
 */
export async function reduction(
  data: Float32Array,
  op: ReductionOp = 'sum'
): Promise<number> {
  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Create input buffer
  const inputBuffer = createStorageBuffer(device, data.byteLength, 'input-data');
  writeBuffer(device, inputBuffer, data);

  // Create output buffer (single value)
  const outputBuffer = createStorageBuffer(device, 4, 'output-result');
  writeBuffer(device, outputBuffer, new Float32Array([op === 'max' ? -Infinity : (op === 'min' ? Infinity : 0)]));

  // Create count uniform
  const countBuffer = createUniformBuffer(device, 4, 'count-uniform');
  writeBuffer(device, countBuffer, new Uint32Array([data.length]));

  // Get operation-specific code
  const { initValue, reduceCode } = getReduceCode(op);

  // Create shader with parallel reduction using workgroup memory
  const shaderCode = `
struct InputData {
  data: array<f32>,
};

struct OutputData {
  value: f32,
};

struct CountUniform {
  count: u32,
};

var<workgroup> shared_data: array<f32, 256>;

@group(0) @binding(0) var<storage, read> input: InputData;
@group(0) @binding(1) var<storage, read_write> output: OutputData;
@group(0) @binding(2) var<uniform> count: CountUniform;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>, @builtin(local_invocation_id) local_id: vec3<u32>) {
  let global_index = global_id.x;
  let local_index = local_id.x;

  // Initialize shared memory
  if (global_index < count.count) {
    shared_data[local_index] = input.data[global_index];
  } else {
    shared_data[local_index] = ${initValue};
  }

  workgroupBarrier();

  // Parallel reduction
  var stride = 128u;
  loop {
    if (local_index < stride) {
      shared_data[local_index] = ${reduceCode};
    }
    workgroupBarrier();
    stride = stride / 2u;
    if (stride == 0u) {
      break;
    }
  }

  // Write result from first workgroup
  if (local_index == 0u) {
    output.value = shared_data[0u];
  }
}
`;

  // Create pipeline
  const shaderModule = device.createShaderModule({ code: shaderCode });
  const pipeline = device.createComputePipeline({
    compute: {
      module: shaderModule,
      entryPoint: 'main'
    }
  });

  // Create bind group
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } },
      { binding: 2, resource: { buffer: countBuffer } }
    ]
  });

  // Dispatch
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  // Only need one workgroup for this reduction
  passEncoder.dispatchWorkgroups(1);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read result
  const resultData = await readBuffer(device, outputBuffer, 4);
  const resultValue = new Float32Array(resultData)[0];

  // Handle average
  const finalValue = op === 'avg' ? resultValue / data.length : resultValue;

  // Clean up
  inputBuffer.destroy();
  outputBuffer.destroy();
  countBuffer.destroy();
  disposeWebGPU(device);

  return finalValue;
}

/**
 * Get WGSL code for reduction operation
 */
function getReduceCode(op: ReductionOp): { initValue: string; reduceCode: string } {
  switch (op) {
    case 'sum':
      return { initValue: '0.0', reduceCode: 'shared_data[local_index] + shared_data[local_index + stride]' };
    case 'min':
      return { initValue: '1e30', reduceCode: 'min(shared_data[local_index], shared_data[local_index + stride])' };
    case 'max':
      return { initValue: '-1e30', reduceCode: 'max(shared_data[local_index], shared_data[local_index + stride])' };
    case 'avg':
      return { initValue: '0.0', reduceCode: 'shared_data[local_index] + shared_data[local_index + stride]' };
    default:
      throw new Error(`Unknown operation: ${op}`);
  }
}

/**
 * Sum all elements
 */
export async function sum(data: Float32Array): Promise<number> {
  return reduction(data, 'sum');
}

/**
 * Find minimum element
 */
export async function min(data: Float32Array): Promise<number> {
  return reduction(data, 'min');
}

/**
 * Find maximum element
 */
export async function max(data: Float32Array): Promise<number> {
  return reduction(data, 'max');
}

/**
 * Calculate average of all elements
 */
export async function avg(data: Float32Array): Promise<number> {
  return reduction(data, 'avg');
}

/**
 * Multi-stage reduction for large arrays
 */
export async function largeReduction(
  data: Float32Array,
  op: ReductionOp = 'sum'
): Promise<number> {
  const workgroupSize = 256;
  const numWorkgroups = Math.ceil(data.length / workgroupSize);

  // For small arrays, use single reduction
  if (numWorkgroups <= 1) {
    return reduction(data, op);
  }

  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Create buffers
  const inputBuffer = createStorageBuffer(device, data.byteLength, 'input-data');
  const partialBuffer = createStorageBuffer(device, numWorkgroups * 4, 'partial-results');

  writeBuffer(device, inputBuffer, data);

  const { initValue, reduceCode } = getReduceCode(op);

  // First pass: reduce within workgroups
  const shaderCode = `
struct InputData {
  data: array<f32>,
};

struct PartialData {
  results: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputData;
@group(0) @binding(1) var<storage, read_write> partial: PartialData;

var<workgroup> shared_data: array<f32, ${workgroupSize}>;

@workgroup_size(${workgroupSize})
@compute
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let global_index = global_id.x;
  let local_index = local_id.x;

  if (global_index < arrayLength(&input.data)) {
    shared_data[local_index] = input.data[global_index];
  } else {
    shared_data[local_index] = ${initValue};
  }

  workgroupBarrier();

  var stride = ${workgroupSize / 2}u;
  loop {
    if (local_index < stride) {
      shared_data[local_index] = ${reduceCode};
    }
    workgroupBarrier();
    stride = stride / 2u;
    if (stride == 0u) {
      break;
    }
  }

  if (local_index == 0u) {
    partial.results[workgroup_id.x] = shared_data[0u];
  }
}
`;

  // Create and dispatch pipeline
  const shaderModule = device.createShaderModule({ code: shaderCode });
  const pipeline = device.createComputePipeline({
    compute: { module: shaderModule, entryPoint: 'main' }
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: partialBuffer } }
    ]
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(numWorkgroups);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read partial results
  const partialData = await readBuffer(device, partialBuffer, numWorkgroups * 4);
  const partialArray = new Float32Array(partialData);

  // Final reduction on CPU (or recursively on GPU)
  let result: number;
  switch (op) {
    case 'sum':
      result = partialArray.reduce((a, b) => a + b, 0);
      break;
    case 'min':
      result = partialArray.reduce((a, b) => Math.min(a, b), Infinity);
      break;
    case 'max':
      result = partialArray.reduce((a, b) => Math.max(a, b), -Infinity);
      break;
    case 'avg':
      result = partialArray.reduce((a, b) => a + b, 0) / data.length;
      break;
  }

  // Clean up
  inputBuffer.destroy();
  partialBuffer.destroy();
  disposeWebGPU(device);

  return result;
}

/**
 * Run reduction operations example
 */
export async function runReductionOperations(): Promise<void> {
  const data = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  console.log('Data:', Array.from(data));

  console.log('\n--- Reduction Operations ---');
  console.log('Sum:', await sum(data));
  console.log('Min:', await min(data));
  console.log('Max:', await max(data));
  console.log('Avg:', await avg(data));

  // Test with larger array
  const largeData = new Float32Array(1000);
  for (let i = 0; i < 1000; i++) {
    largeData[i] = i + 1;
  }

  console.log('\n--- Large Array (1000 elements) ---');
  console.log('Sum:', await largeReduction(largeData, 'sum'));
}
