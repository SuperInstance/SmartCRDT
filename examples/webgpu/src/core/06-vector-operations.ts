/**
 * @lsi/webgpu-examples/core/06-vector-operations
 *
 * Vector Operations on GPU.
 * This example demonstrates how to:
 * - Perform element-wise vector operations
 * - Handle large vector datasets
 * - Optimize memory access patterns
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Vector operation types
 */
export type VectorOp = 'add' | 'sub' | 'mul' | 'div' | 'min' | 'max';

/**
 * Perform element-wise vector operation on GPU
 *
 * @param a - First vector
 * @param b - Second vector
 * @param op - Operation to perform
 * @returns Result vector
 */
export async function vectorOperation(
  a: Float32Array,
  b: Float32Array,
  op: VectorOp
): Promise<Float32Array> {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Create buffers
  const bufferA = createStorageBuffer(device, a.byteLength, 'vector-a');
  const bufferB = createStorageBuffer(device, b.byteLength, 'vector-b');
  const bufferC = createStorageBuffer(device, a.byteLength, 'vector-c');

  // Write input data
  writeBuffer(device, bufferA, a);
  writeBuffer(device, bufferB, b);

  // Create operation-specific shader
  const opCode = getOpCode(op);

  const shaderCode = `
struct Vector {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> a: Vector;
@group(0) @binding(1) var<storage, read> b: Vector;
@group(0) @binding(2) var<storage, read_write> c: Vector;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= arrayLength(&a.data)) {
    return;
  }
  c.data[index] = ${opCode};
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
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferA } },
      { binding: 1, resource: { buffer: bufferB } },
      { binding: 2, resource: { buffer: bufferC } }
    ]
  });

  // Dispatch
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(a.length / 256));
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read result
  const resultData = await readBuffer(device, bufferC, a.byteLength);
  const resultArray = new Float32Array(resultData);

  // Clean up
  bufferA.destroy();
  bufferB.destroy();
  bufferC.destroy();
  disposeWebGPU(device);

  return resultArray;
}

/**
 * Get WGSL code for operation
 */
function getOpCode(op: VectorOp): string {
  switch (op) {
    case 'add': return 'a.data[index] + b.data[index]';
    case 'sub': return 'a.data[index] - b.data[index]';
    case 'mul': return 'a.data[index] * b.data[index]';
    case 'div': return 'a.data[index] / b.data[index]';
    case 'min': return 'min(a.data[index], b.data[index])';
    case 'max': return 'max(a.data[index], b.data[index])';
    default: throw new Error(`Unknown operation: ${op}`);
  }
}

/**
 * Add two vectors
 */
export async function vectorAdd(a: Float32Array, b: Float32Array): Promise<Float32Array> {
  return vectorOperation(a, b, 'add');
}

/**
 * Subtract two vectors
 */
export async function vectorSub(a: Float32Array, b: Float32Array): Promise<Float32Array> {
  return vectorOperation(a, b, 'sub');
}

/**
 * Multiply two vectors element-wise
 */
export async function vectorMul(a: Float32Array, b: Float32Array): Promise<Float32Array> {
  return vectorOperation(a, b, 'mul');
}

/**
 * Divide two vectors element-wise
 */
export async function vectorDiv(a: Float32Array, b: Float32Array): Promise<Float32Array> {
  return vectorOperation(a, b, 'div');
}

/**
 * Element-wise minimum of two vectors
 */
export async function vectorMin(a: Float32Array, b: Float32Array): Promise<Float32Array> {
  return vectorOperation(a, b, 'min');
}

/**
 * Element-wise maximum of two vectors
 */
export async function vectorMax(a: Float32Array, b: Float32Array): Promise<Float32Array> {
  return vectorOperation(a, b, 'max');
}

/**
 * Scale vector by scalar
 */
export async function vectorScale(
  vector: Float32Array,
  scalar: number
): Promise<Float32Array> {
  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Create buffers
  const bufferIn = createStorageBuffer(device, vector.byteLength, 'vector-in');
  const bufferOut = createStorageBuffer(device, vector.byteLength, 'vector-out');
  const bufferUniform = createStorageBuffer(device, 4, 'scalar-uniform');

  // Write input data
  writeBuffer(device, bufferIn, vector);
  writeBuffer(device, bufferUniform, new Float32Array([scalar]));

  // Shader for scaling
  const shaderCode = `
struct Vector {
  data: array<f32>,
};

struct ScalarUniform {
  value: f32,
};

@group(0) @binding(0) var<storage, read> input: Vector;
@group(0) @binding(1) var<uniform> scalar: ScalarUniform;
@group(0) @binding(2) var<storage, read_write> output: Vector;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= arrayLength(&input.data)) {
    return;
  }
  output.data[index] = input.data[index] * scalar.value;
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
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferIn } },
      { binding: 1, resource: { buffer: bufferUniform } },
      { binding: 2, resource: { buffer: bufferOut } }
    ]
  });

  // Dispatch
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(vector.length / 256));
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read result
  const resultData = await readBuffer(device, bufferOut, vector.byteLength);
  const resultArray = new Float32Array(resultData);

  // Clean up
  bufferIn.destroy();
  bufferOut.destroy();
  bufferUniform.destroy();
  disposeWebGPU(device);

  return resultArray;
}

/**
 * Run vector operations example
 */
export async function runVectorOperations(): Promise<void> {
  const a = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const b = new Float32Array([8, 7, 6, 5, 4, 3, 2, 1]);

  console.log('Vector A:', Array.from(a));
  console.log('Vector B:', Array.from(b));

  console.log('\n--- Addition ---');
  const add = await vectorAdd(a, b);
  console.log('A + B =', Array.from(add));

  console.log('\n--- Subtraction ---');
  const sub = await vectorSub(a, b);
  console.log('A - B =', Array.from(sub));

  console.log('\n--- Multiplication ---');
  const mul = await vectorMul(a, b);
  console.log('A * B =', Array.from(mul));

  console.log('\n--- Scaling ---');
  const scaled = await vectorScale(a, 2.5);
  console.log('A * 2.5 =', Array.from(scaled));
}
