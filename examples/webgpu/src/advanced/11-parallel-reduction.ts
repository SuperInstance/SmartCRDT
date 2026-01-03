/**
 * @lsi/webgpu-examples/advanced/11-parallel-reduction
 *
 * Optimized Parallel Reduction on GPU.
 * This example demonstrates how to:
 * - Implement optimized parallel reduction
 * - Use workgroup memory efficiently
 * - Handle bank conflicts and optimization
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, createUniformBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Optimized parallel reduction using shared memory
 *
 * @param data - Input array
 * @returns Sum of all elements
 */
export async function optimizedParallelSum(data: Float32Array): Promise<number> {
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;
  const workgroupSize = 256;

  // Calculate number of workgroups needed
  const numWorkgroups = Math.ceil(data.length / workgroupSize);
  const partialSize = numWorkgroups;

  // Create buffers
  const bufferInput = createStorageBuffer(device, data.byteLength, 'input');
  const bufferPartial = createStorageBuffer(device, partialSize * 4, 'partial');

  writeBuffer(device, bufferInput, data);

  // Optimized reduction shader with sequential addressing
  const shaderCode = `
struct InputArray {
  data: array<f32>,
};

struct PartialArray {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputArray;
@group(0) @binding(1) var<storage, read_write> partial: PartialArray;

var<workgroup> shared_data: array<f32, ${workgroupSize}>;

@workgroup_size(${workgroupSize})
@compute
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let global_idx = global_id.x;
  let local_idx = local_id.x;

  // Load data into shared memory
  shared_data[local_idx] = select(0.0, input.data[global_idx], global_idx < arrayLength(&input.data));

  workgroupBarrier();

  // Parallel reduction with sequential addressing to avoid bank conflicts
  var stride = ${workgroupSize / 2}u;
  loop {
    if (local_idx < stride) {
      shared_data[local_idx] = shared_data[local_idx] + shared_data[local_idx + stride];
    }
    workgroupBarrier();
    stride = stride / 2u;
    if (stride == 0u) {
      break;
    }
  }

  // Write result for this workgroup
  if (local_idx == 0u) {
    partial.data[global_id.x / ${workgroupSize}u] = shared_data[0u];
  }
}
`;

  // Create pipeline
  const shaderModule = device.createShaderModule({ code: shaderCode });
  const pipeline = device.createComputePipeline({
    compute: { module: shaderModule, entryPoint: 'main' }
  });

  // Create bind group
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferInput } },
      { binding: 1, resource: { buffer: bufferPartial } }
    ]
  });

  // Dispatch
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(numWorkgroups);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read partial results
  const partialData = await readBuffer(device, bufferPartial, partialSize * 4);
  const partialArray = new Float32Array(partialData);

  // Final reduction on CPU (or recursively on GPU)
  const result = partialArray.reduce((sum, val) => sum + val, 0);

  // Clean up
  bufferInput.destroy();
  bufferPartial.destroy();
  disposeWebGPU(device);

  return result;
}

/**
 * Parallel reduction for arbitrary operation
 */
export type ReduceOp = 'sum' | 'min' | 'max' | 'prod';

export async function parallelReduce(
  data: Float32Array,
  op: ReduceOp = 'sum'
): Promise<number> {
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;
  const workgroupSize = 256;
  const numWorkgroups = Math.ceil(data.length / workgroupSize);
  const partialSize = numWorkgroups;

  // Create buffers
  const bufferInput = createStorageBuffer(device, data.byteLength, 'input');
  const bufferPartial = createStorageBuffer(device, partialSize * 4, 'partial');

  writeBuffer(device, bufferInput, data);

  // Get operation-specific identity and reduce function
  const { identity, reduceFn } = getReduceOp(op);

  // Reduction shader
  const shaderCode = `
struct InputArray {
  data: array<f32>,
};

struct PartialArray {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputArray;
@group(0) @binding(1) var<storage, read_write> partial: PartialArray;

var<workgroup> shared_data: array<f32, ${workgroupSize}>;

@workgroup_size(${workgroupSize})
@compute
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let global_idx = global_id.x;
  let local_idx = local_id.x;

  // Load data with identity value for out-of-bounds
  shared_data[local_idx] = select(${identity}, input.data[global_idx], global_idx < arrayLength(&input.data));

  workgroupBarrier();

  // Parallel reduction
  var stride = ${workgroupSize / 2}u;
  loop {
    if (local_idx < stride) {
      shared_data[local_idx] = ${reduceFn};
    }
    workgroupBarrier();
    stride = stride / 2u;
    if (stride == 0u) {
      break;
    }
  }

  // Write result
  if (local_idx == 0u) {
    partial.data[global_id.x / ${workgroupSize}u] = shared_data[0u];
  }
}
`;

  // Create and dispatch
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
      { binding: 0, resource: { buffer: bufferInput } },
      { binding: 1, resource: { buffer: bufferPartial } }
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
  const partialData = await readBuffer(device, bufferPartial, partialSize * 4);
  const partialArray = new Float32Array(partialData);

  // Final reduction on CPU
  let finalResult: number;
  switch (op) {
    case 'sum':
      finalResult = partialArray.reduce((a, b) => a + b, 0);
      break;
    case 'min':
      finalResult = partialArray.reduce((a, b) => Math.min(a, b), Infinity);
      break;
    case 'max':
      finalResult = partialArray.reduce((a, b) => Math.max(a, b), -Infinity);
      break;
    case 'prod':
      finalResult = partialArray.reduce((a, b) => a * b, 1);
      break;
  }

  // Clean up
  bufferInput.destroy();
  bufferPartial.destroy();
  disposeWebGPU(device);

  return finalResult;
}

/**
 * Get operation-specific values
 */
function getReduceOp(op: ReduceOp): { identity: string; reduceFn: string } {
  switch (op) {
    case 'sum':
      return { identity: '0.0', reduceFn: 'shared_data[local_idx] + shared_data[local_idx + stride]' };
    case 'min':
      return { identity: '1e30', reduceFn: 'min(shared_data[local_idx], shared_data[local_idx + stride])' };
    case 'max':
      return { identity: '-1e30', reduceFn: 'max(shared_data[local_idx], shared_data[local_idx + stride])' };
    case 'prod':
      return { identity: '1.0', reduceFn: 'shared_data[local_idx] * shared_data[local_idx + stride]' };
  }
}

/**
 * Scan (prefix sum) operation on GPU
 */
export async function parallelScan(data: Float32Array): Promise<Float32Array> {
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;
  const n = data.length;
  const workgroupSize = 256;
  const numWorkgroups = Math.ceil(n / workgroupSize);

  // For simplicity, we'll use a basic Hillis-Steele scan
  // This requires O(n log n) work but is simple to implement

  const bufferInput = createStorageBuffer(device, data.byteLength, 'input');
  const bufferOutput = createStorageBuffer(device, data.byteLength, 'output');

  writeBuffer(device, bufferInput, data);

  // Hillis-Steele scan shader (single pass per workgroup)
  const shaderCode = `
struct InputArray {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputArray;
@group(0) @binding(1) var<storage, read_write> output: InputArray;

var<workgroup> shared_data: array<f32, ${workgroupSize + 1}>;

@workgroup_size(${workgroupSize})
@compute
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let global_idx = global_id.x;
  let local_idx = local_id.x;

  // Load data (with padding at index 0)
  shared_data[local_idx + 1u] = select(0.0, input.data[global_idx], global_idx < arrayLength(&input.data));
  shared_data[0u] = 0.0;

  workgroupBarrier();

  // Hillis-Steele scan
  var stride = 1u;
  loop {
    if (local_idx + 1u > stride) {
      shared_data[local_idx + 1u] = shared_data[local_idx + 1u] + shared_data[local_idx + 1u - stride];
    }
    workgroupBarrier();
    stride = stride * 2u;
    if (stride >= ${workgroupSize}u) {
      break;
    }
  }

  if (global_idx < arrayLength(&input.data)) {
    output.data[global_idx] = shared_data[local_idx + 1u];
  }
}
`;

  // Create and dispatch
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
      { binding: 0, resource: { buffer: bufferInput } },
      { binding: 1, resource: { buffer: bufferOutput } }
    ]
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(numWorkgroups);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read results
  const outputData = await readBuffer(device, bufferOutput, data.byteLength);
  const output = new Float32Array(outputData);

  // Clean up
  bufferInput.destroy();
  bufferOutput.destroy();
  disposeWebGPU(device);

  return output;
}

/**
 * Run parallel reduction example
 */
export async function runParallelReduction(): Promise<void> {
  const sizes = [256, 1024, 10000];

  for (const size of sizes) {
    console.log(`\n=== Parallel Reduction (${size} elements) ===`);

    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i + 1;
    }

    console.log('Testing sum...');
    const sum = await optimizedParallelSum(data);
    const expected = size * (size + 1) / 2;
    console.log(`Sum: ${sum}, Expected: ${expected}, Match: ${Math.abs(sum - expected) < 0.01}`);

    console.log('Testing reduce operations...');
    const min = await parallelReduce(data, 'min');
    const max = await parallelReduce(data, 'max');
    console.log(`Min: ${min}, Expected: 1`);
    console.log(`Max: ${max}, Expected: ${size}`);

    console.log('Testing prefix sum...');
    const scan = await parallelScan(new Float32Array([1, 2, 3, 4, 5]));
    console.log('Scan of [1,2,3,4,5]:', Array.from(scan));
  }
}
