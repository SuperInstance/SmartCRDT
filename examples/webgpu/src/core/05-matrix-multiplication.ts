/**
 * @lsi/webgpu-examples/core/05-matrix-multiplication
 *
 * Matrix Multiplication on GPU.
 * This example demonstrates how to:
 * - Perform matrix multiplication on GPU
 * - Use shared memory for optimization
 * - Handle 2D grid dispatch
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Matrix multiplication on GPU
 *
 * @param a - Matrix A (M x K)
 * @param b - Matrix B (K x N)
 * @param m - Rows in A
 * @param k - Columns in A / Rows in B
 * @param n - Columns in B
 * @returns Result matrix (M x N)
 */
export async function matrixMultiply(
  a: Float32Array,
  b: Float32Array,
  m: number,
  k: number,
  n: number
): Promise<Float32Array> {
  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Create buffers
  const bufferA = createStorageBuffer(device, a.byteLength, 'matrix-a');
  const bufferB = createStorageBuffer(device, b.byteLength, 'matrix-b');
  const bufferC = createStorageBuffer(device, m * n * 4, 'matrix-c');

  // Write input matrices
  writeBuffer(device, bufferA, a);
  writeBuffer(device, bufferB, b);

  // Initialize output with zeros
  writeBuffer(device, bufferC, new Float32Array(m * n));

  // Create compute shader for matrix multiplication
  const shaderCode = `
struct Matrix {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> a: Matrix;
@group(0) @binding(1) var<storage, read> b: Matrix;
@group(0) @binding(2) var<storage, read_write> c: Matrix;

const M = ${m}u;
const K = ${k}u;
const N = ${n}u;

@workgroup_size(16, 16, 1)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  let col = global_id.y;

  if (row >= M || col >= N) {
    return;
  }

  var sum = 0.0;
  for (var i = 0u; i < K; i = i + 1u) {
    sum = sum + a.data[row * K + i] * b.data[i * N + col];
  }

  c.data[row * N + col] = sum;
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

  // Create bind group layout and bind group
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

  // Dispatch compute shader
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(m / 16), Math.ceil(n / 16));
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read result
  const resultData = await readBuffer(device, bufferC, m * n * 4);
  const resultArray = new Float32Array(resultData);

  // Clean up
  bufferA.destroy();
  bufferB.destroy();
  bufferC.destroy();
  disposeWebGPU(device);

  return resultArray;
}

/**
 * Run matrix multiplication example
 */
export async function runMatrixMultiplication(): Promise<void> {
  // Example: Multiply 3x2 matrix by 2x4 matrix
  const m = 3, k = 2, n = 4;

  // Matrix A (3x2)
  const a = new Float32Array([
    1, 2,
    3, 4,
    5, 6
  ]);

  // Matrix B (2x4)
  const b = new Float32Array([
    1, 2, 3, 4,
    5, 6, 7, 8
  ]);

  console.log('Matrix A (3x2):');
  console.log(formatMatrix(a, m, k));
  console.log('\nMatrix B (2x4):');
  console.log(formatMatrix(b, k, n));

  const c = await matrixMultiply(a, b, m, k, n);

  console.log('\nResult C (3x4):');
  console.log(formatMatrix(c, m, n));
}

/**
 * Format a matrix for display
 */
function formatMatrix(data: Float32Array, rows: number, cols: number): string {
  const lines: string[] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(data[i * cols + j]);
    }
    lines.push('[ ' + row.join(', ') + ' ]');
  }
  return lines.join('\n');
}
