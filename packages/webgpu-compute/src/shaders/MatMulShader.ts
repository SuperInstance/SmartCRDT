/**
 * @lsi/webgpu-compute/shaders/MatMulShader - Matrix Multiplication Shaders
 *
 * WGSL compute shaders for matrix multiplication operations.
 * Supports various matrix sizes and batched operations.
 *
 * @version 1.0.0
 */

import type { MatrixShape, WorkgroupSize } from "../types.js";

/**
 * Generate matrix multiplication shader
 *
 * Computes C = A * B where:
 * - A is (M x K)
 * - B is (K x N)
 * - C is (M x N)
 *
 * @param M - Number of rows in A and C
 * @param K - Number of columns in A, rows in B
 * @param N - Number of columns in B and C
 * @param workgroupSize - Workgroup size (default: 16x16x1)
 * @returns WGSL shader code
 */
export function getMatMulShader(
  M: number,
  K: number,
  N: number,
  workgroupSize: WorkgroupSize = { x: 16, y: 16, z: 1 }
): string {
  const { x: wgX, y: wgY, z: wgZ } = workgroupSize;

  return `
// Matrix multiplication: C = A * B
// A: ${M}x${K}, B: ${K}x${N}, C: ${M}x${N}

@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> B: array<f32>;
@group(0) @binding(2) var<storage, read_write> C: array<f32>;

@compute @workgroup_size(${wgX}u, ${wgY}u, ${wgZ}u)
fn matmul_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  let col = global_id.y;

  // Boundary check
  if (row >= ${M}u || col >= ${N}u) {
    return;
  }

  // Compute dot product
  var sum: f32 = 0.0;
  for (var k: u32 = 0u; k < ${K}u; k = k + 1u) {
    sum = sum + A[row * ${K}u + k] * B[k * ${N}u + col];
  }

  C[row * ${N}u + col] = sum;
}
`;
}

/**
 * Generate batched matrix multiplication shader
 *
 * Computes multiple matrix multiplications in parallel.
 * Useful for batch processing.
 *
 * @param batchSize - Number of matrices in batch
 * @param M - Number of rows in A and C
 * @param K - Number of columns in A, rows in B
 * @param N - Number of columns in B and C
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getBatchMatMulShader(
  batchSize: number,
  M: number,
  K: number,
  N: number,
  workgroupSize: WorkgroupSize = { x: 16, y: 16, z: 1 }
): string {
  const { x: wgX, y: wgY, z: wgZ } = workgroupSize;

  return `
// Batched matrix multiplication: C[b] = A[b] * B[b]
// Batch size: ${batchSize}, A: ${M}x${K}, B: ${K}x${N}, C: ${M}x${N}

@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> B: array<f32>;
@group(0) @binding(2) var<storage, read_write> C: array<f32>;

@compute @workgroup_size(${wgX}u, ${wgY}u, ${wgZ}u)
fn batch_matmul_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let batch = global_id.z;
  let row = global_id.x;
  let col = global_id.y;

  // Boundary check
  if (batch >= ${batchSize}u || row >= ${M}u || col >= ${N}u) {
    return;
  }

  let batchOffsetA = batch * ${M * K}u;
  let batchOffsetB = batch * ${K * N}u;
  let batchOffsetC = batch * ${M * N}u;

  // Compute dot product
  var sum: f32 = 0.0;
  for (var k: u32 = 0u; k < ${K}u; k = k + 1u) {
    let a_idx = batchOffsetA + row * ${K}u + k;
    let b_idx = batchOffsetB + k * ${N}u + col;
    sum = sum + A[a_idx] * B[b_idx];
  }

  let c_idx = batchOffsetC + row * ${N}u + col;
  C[c_idx] = sum;
}
`;
}

/**
 * Generate matrix-vector multiplication shader
 *
 * Computes y = A * x where:
 * - A is (M x N) matrix
 * - x is (N,) vector
 * - y is (M,) vector
 *
 * @param M - Number of rows in A
 * @param N - Number of columns in A (dimension of x)
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getMatVecMulShader(
  M: number,
  N: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Matrix-vector multiplication: y = A * x
// A: ${M}x${N}, x: ${N}, y: ${M}

@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> x: array<f32>;
@group(0) @binding(2) var<storage, read_write> y: array<f32>;

@compute @workgroup_size(${wgX}u)
fn matvec_mul_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;

  if (row >= ${M}u) {
    return;
  }

  // Compute dot product
  var sum: f32 = 0.0;
  for (var col: u32 = 0u; col < ${N}u; col = col + 1u) {
    sum = sum + A[row * ${N}u + col] * x[col];
  }

  y[row] = sum;
}
`;
}

/**
 * Generate outer product shader
 *
 * Computes C = x * y^T where:
 * - x is (M,) vector
 * - y is (N,) vector
 * - C is (M x N) matrix
 *
 * @param M - Dimension of x
 * @param N - Dimension of y
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getOuterProductShader(
  M: number,
  N: number,
  workgroupSize: WorkgroupSize = { x: 16, y: 16, z: 1 }
): string {
  const { x: wgX, y: wgY } = workgroupSize;

  return `
// Outer product: C = x * y^T
// x: ${M}, y: ${N}, C: ${M}x${N}

@group(0) @binding(0) var<storage, read> x: array<f32>;
@group(0) @binding(1) var<storage, read> y: array<f32>;
@group(0) @binding(2) var<storage, read_write> C: array<f32>;

@compute @workgroup_size(${wgX}u, ${wgY}u)
fn outer_product_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  let col = global_id.y;

  if (row >= ${M}u || col >= ${N}u) {
    return;
  }

  C[row * ${N}u + col] = x[row] * y[col];
}
`;
}

/**
 * Generate matrix transpose shader
 *
 * Computes B = A^T where:
 * - A is (M x N) matrix
 * - B is (N x M) matrix (transposed)
 *
 * @param M - Number of rows in A
 * @param N - Number of columns in A
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getTransposeShader(
  M: number,
  N: number,
  workgroupSize: WorkgroupSize = { x: 16, y: 16, z: 1 }
): string {
  const { x: wgX, y: wgY } = workgroupSize;

  return `
// Matrix transpose: B = A^T
// A: ${M}x${N}, B: ${N}x${M}

@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read_write> B: array<f32>;

@compute @workgroup_size(${wgX}u, ${wgY}u)
fn transpose_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row = global_id.x;
  let col = global_id.y;

  if (row >= ${M}u || col >= ${N}u) {
    return;
  }

  // Transpose: B[col, row] = A[row, col]
  B[col * ${M}u + row] = A[row * ${N}u + col];
}
`;
}

/**
 * Generate matrix addition shader
 *
 * Computes C = A + B (element-wise)
 *
 * @param M - Number of rows
 * @param N - Number of columns
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getMatAddShader(
  M: number,
  N: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Matrix addition: C = A + B
// A, B, C: ${M}x${N}

@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> B: array<f32>;
@group(0) @binding(2) var<storage, read_write> C: array<f32>;

@compute @workgroup_size(${wgX}u)
fn matadd_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${M * N}u) {
    return;
  }

  C[idx] = A[idx] + B[idx];
}
`;
}

/**
 * Generate matrix scalar multiplication shader
 *
 * Computes B = alpha * A
 *
 * @param M - Number of rows
 * @param N - Number of columns
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getMatScalarMulShader(
  M: number,
  N: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Matrix scalar multiplication: B = alpha * A
// A, B: ${M}x${N}

struct ScalarParams {
  alpha: f32,
}

@group(0) @binding(0) var<uniform> params: ScalarParams;
@group(0) @binding(1) var<storage, read> A: array<f32>;
@group(0) @binding(2) var<storage, read_write> B: array<f32>;

@compute @workgroup_size(${wgX}u)
fn matscalarmul_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${M * N}u) {
    return;
  }

  B[idx] = params.alpha * A[idx];
}
`;
}

/**
 * Generate matrix Hadamard product shader
 *
 * Computes C = A * B (element-wise)
 *
 * @param M - Number of rows
 * @param N - Number of columns
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getMatHadamardShader(
  M: number,
  N: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Matrix Hadamard product: C = A * B (element-wise)
// A, B, C: ${M}x${N}

@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> B: array<f32>;
@group(0) @binding(2) var<storage, read_write> C: array<f32>;

@compute @workgroup_size(${wgX}u)
fn mathadamard_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${M * N}u) {
    return;
  }

  C[idx] = A[idx] * B[idx];
}
`;
}

/**
 * Pre-configured matrix shaders for common sizes
 */
export const DEFAULT_MATMUL_SHADERS = {
  "768x768": getMatMulShader(768, 768, 768),
  "1536x768": getMatMulShader(1536, 768, 768),
  "768x1536": getMatMulShader(768, 1536, 768),
  "1536x1536": getMatMulShader(1536, 768, 1536),
  "2048x768": getMatMulShader(2048, 768, 768),
  "768x2048": getMatMulShader(768, 2048, 768),
} as const;

/**
 * Get matrix shader for shape
 *
 * Returns pre-configured shader if available, generates new one otherwise.
 *
 * @param leftShape - Left matrix shape
 * @param rightShape - Right matrix shape
 * @returns WGSL shader code
 */
export function getMatMulShaderForShapes(
  leftShape: MatrixShape,
  rightShape: MatrixShape
): string {
  const key = `${leftShape.rows}x${leftShape.cols}x${rightShape.cols}`;
  const defaultKey = `${leftShape.rows}x${rightShape.cols}`;

  // Check if we have a pre-configured shader
  if (defaultKey in DEFAULT_MATMUL_SHADERS) {
    return DEFAULT_MATMUL_SHADERS[
      defaultKey as keyof typeof DEFAULT_MATMUL_SHADERS
    ];
  }

  // Generate custom shader
  return getMatMulShader(leftShape.rows, leftShape.cols, rightShape.cols);
}
