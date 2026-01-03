/**
 * @lsi/webgpu-compute/shaders/VectorShader - Vector Operation Shaders
 *
 * WGSL compute shaders for vector operations.
 * Supports arithmetic, comparison, and reduction operations.
 *
 * @version 1.0.0
 */

import type { VectorOpType, WorkgroupSize } from "../types.js";

/**
 * Generate vector addition shader
 *
 * Computes c = a + b (element-wise)
 *
 * @param size - Vector dimension
 * @param numVectors - Number of vectors (for batch operations)
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorAddShader(
  size: number,
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const batchSize = numVectors > 1 ? numVectors : 1;

  return `
// Vector addition: c = a + b
// Vector size: ${size}, Batch size: ${batchSize}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> c: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecadd_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vec_idx = global_id.y;
  let elem_idx = global_id.x;

  if (vec_idx >= ${batchSize}u || elem_idx >= ${size}u) {
    return;
  }

  let idx = vec_idx * ${size}u + elem_idx;
  c[idx] = a[idx] + b[idx];
}
`;
}

/**
 * Generate vector subtraction shader
 *
 * Computes c = a - b (element-wise)
 *
 * @param size - Vector dimension
 * @param numVectors - Number of vectors
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorSubShader(
  size: number,
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const batchSize = numVectors > 1 ? numVectors : 1;

  return `
// Vector subtraction: c = a - b
// Vector size: ${size}, Batch size: ${batchSize}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> c: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecsub_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vec_idx = global_id.y;
  let elem_idx = global_id.x;

  if (vec_idx >= ${batchSize}u || elem_idx >= ${size}u) {
    return;
  }

  let idx = vec_idx * ${size}u + elem_idx;
  c[idx] = a[idx] - b[idx];
}
`;
}

/**
 * Generate vector multiplication shader
 *
 * Computes c = a * b (element-wise)
 *
 * @param size - Vector dimension
 * @param numVectors - Number of vectors
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorMulShader(
  size: number,
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const batchSize = numVectors > 1 ? numVectors : 1;

  return `
// Vector multiplication: c = a * b (element-wise)
// Vector size: ${size}, Batch size: ${batchSize}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> c: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecmul_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vec_idx = global_id.y;
  let elem_idx = global_id.x;

  if (vec_idx >= ${batchSize}u || elem_idx >= ${size}u) {
    return;
  }

  let idx = vec_idx * ${size}u + elem_idx;
  c[idx] = a[idx] * b[idx];
}
`;
}

/**
 * Generate vector division shader
 *
 * Computes c = a / b (element-wise)
 *
 * @param size - Vector dimension
 * @param numVectors - Number of vectors
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorDivShader(
  size: number,
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const batchSize = numVectors > 1 ? numVectors : 1;

  return `
// Vector division: c = a / b (element-wise)
// Vector size: ${size}, Batch size: ${batchSize}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> c: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecdiv_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vec_idx = global_id.y;
  let elem_idx = global_id.x;

  if (vec_idx >= ${batchSize}u || elem_idx >= ${size}u) {
    return;
  }

  let idx = vec_idx * ${size}u + elem_idx;
  c[idx] = a[idx] / b[idx];
}
`;
}

/**
 * Generate vector dot product shader
 *
 * Computes dot = a . b (scalar)
 *
 * @param size - Vector dimension
 * @param numPairs - Number of vector pairs
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorDotShader(
  size: number,
  numPairs: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Vector dot product: dot = a . b
// Vector size: ${size}, Number of pairs: ${numPairs}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> dot: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecdot_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let pair_idx = global_id.x;

  if (pair_idx >= ${numPairs}u) {
    return;
  }

  // Compute dot product
  var sum: f32 = 0.0;
  let offset = pair_idx * ${size}u;
  for (var i: u32 = 0u; i < ${size}u; i = i + 1u) {
    sum = sum + a[offset + i] * b[offset + i];
  }

  dot[pair_idx] = sum;
}
`;
}

/**
 * Generate vector cross product shader (3D only)
 *
 * Computes c = a x b (cross product for 3D vectors)
 *
 * @param numVectors - Number of vectors
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorCrossShader(
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Vector cross product: c = a x b (3D only)
// Number of vectors: ${numVectors}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> c: array<f32>;

@compute @workgroup_size(${wgX}u)
fn veccross_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${numVectors}u) {
    return;
  }

  let i = idx * 3u;

  // Cross product: c = a x b
  // c[0] = a[1]*b[2] - a[2]*b[1]
  // c[1] = a[2]*b[0] - a[0]*b[2]
  // c[2] = a[0]*b[1] - a[1]*b[0]

  c[i + 0u] = a[i + 1u] * b[i + 2u] - a[i + 2u] * b[i + 1u];
  c[i + 1u] = a[i + 2u] * b[i + 0u] - a[i + 0u] * b[i + 2u];
  c[i + 2u] = a[i + 0u] * b[i + 1u] - a[i + 1u] * b[i + 0u];
}
`;
}

/**
 * Generate vector normalization shader
 *
 * Computes c = a / ||a|| (L2 normalization)
 *
 * @param size - Vector dimension
 * @param numVectors - Number of vectors
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorNormalizeShader(
  size: number,
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const batchSize = numVectors > 1 ? numVectors : 1;

  return `
// Vector normalization: c = a / ||a||_2
// Vector size: ${size}, Batch size: ${batchSize}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read_write> c: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecnorm_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vec_idx = global_id.y;

  if (vec_idx >= ${batchSize}u) {
    return;
  }

  // First compute L2 norm
  var sum: f32 = 0.0;
  let offset = vec_idx * ${size}u;
  for (var i: u32 = 0u; i < ${size}u; i = i + 1u) {
    let val = a[offset + i];
    sum = sum + val * val;
  }
  let norm = sqrt(sum);

  // Normalize
  for (var j: u32 = 0u; j < ${size}u; j = j + 1u) {
    c[offset + j] = a[offset + j] / (norm + 1e-8);
  }
}
`;
}

/**
 * Generate vector magnitude shader
 *
 * Computes ||a|| (L2 norm)
 *
 * @param size - Vector dimension
 * @param numVectors - Number of vectors
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorMagnitudeShader(
  size: number,
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Vector magnitude: ||a||_2
// Vector size: ${size}, Number of vectors: ${numVectors}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read_write> magnitude: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecmag_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vec_idx = global_id.x;

  if (vec_idx >= ${numVectors}u) {
    return;
  }

  // Compute L2 norm
  var sum: f32 = 0.0;
  let offset = vec_idx * ${size}u;
  for (var i: u32 = 0u; i < ${size}u; i = i + 1u) {
    let val = a[offset + i];
    sum = sum + val * val;
  }

  magnitude[vec_idx] = sqrt(sum);
}
`;
}

/**
 * Generate vector L1 distance shader
 *
 * Computes ||a - b||_1 (Manhattan distance)
 *
 * @param size - Vector dimension
 * @param numPairs - Number of vector pairs
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorL1DistanceShader(
  size: number,
  numPairs: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Vector L1 distance: ||a - b||_1
// Vector size: ${size}, Number of pairs: ${numPairs}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> distance: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecl1dist_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let pair_idx = global_id.x;

  if (pair_idx >= ${numPairs}u) {
    return;
  }

  // Compute L1 distance
  var sum: f32 = 0.0;
  let offset = pair_idx * ${size}u;
  for (var i: u32 = 0u; i < ${size}u; i = i + 1u) {
    let diff = a[offset + i] - b[offset + i];
    sum = sum + abs(diff);
  }

  distance[pair_idx] = sum;
}
`;
}

/**
 * Generate vector L2 distance shader
 *
 * Computes ||a - b||_2 (Euclidean distance)
 *
 * @param size - Vector dimension
 * @param numPairs - Number of vector pairs
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorL2DistanceShader(
  size: number,
  numPairs: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Vector L2 distance: ||a - b||_2
// Vector size: ${size}, Number of pairs: ${numPairs}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> distance: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecl2dist_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let pair_idx = global_id.x;

  if (pair_idx >= ${numPairs}u) {
    return;
  }

  // Compute L2 distance
  var sum: f32 = 0.0;
  let offset = pair_idx * ${size}u;
  for (var i: u32 = 0u; i < ${size}u; i = i + 1u) {
    let diff = a[offset + i] - b[offset + i];
    sum = sum + diff * diff;
  }

  distance[pair_idx] = sqrt(sum);
}
`;
}

/**
 * Generate cosine similarity shader
 *
 * Computes cosine_similarity(a, b) = (a . b) / (||a|| * ||b||)
 *
 * @param size - Vector dimension
 * @param numPairs - Number of vector pairs
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getCosineSimilarityShader(
  size: number,
  numPairs: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Cosine similarity: (a . b) / (||a|| * ||b||)
// Vector size: ${size}, Number of pairs: ${numPairs}

@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> similarity: array<f32>;

@compute @workgroup_size(${wgX}u)
fn cossim_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let pair_idx = global_id.x;

  if (pair_idx >= ${numPairs}u) {
    return;
  }

  let offset = pair_idx * ${size}u;

  // Compute dot product
  var dot: f32 = 0.0;
  var norm_a: f32 = 0.0;
  var norm_b: f32 = 0.0;

  for (var i: u32 = 0u; i < ${size}u; i = i + 1u) {
    let val_a = a[offset + i];
    let val_b = b[offset + i];
    dot = dot + val_a * val_b;
    norm_a = norm_a + val_a * val_a;
    norm_b = norm_b + val_b * val_b;
  }

  let norm_product = sqrt(norm_a) * sqrt(norm_b);
  similarity[pair_idx] = select(0.0, dot / norm_product, norm_product > 1e-8);
}
`;
}

/**
 * Generate vector scale shader
 *
 * Computes b = alpha * a
 *
 * @param size - Vector dimension
 * @param numVectors - Number of vectors
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorScaleShader(
  size: number,
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const batchSize = numVectors > 1 ? numVectors : 1;

  return `
// Vector scale: b = alpha * a
// Vector size: ${size}, Batch size: ${batchSize}

struct ScaleParams {
  alpha: f32,
}

@group(0) @binding(0) var<uniform> params: ScaleParams;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read_write> b: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecscale_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vec_idx = global_id.y;
  let elem_idx = global_id.x;

  if (vec_idx >= ${batchSize}u || elem_idx >= ${size}u) {
    return;
  }

  let idx = vec_idx * ${size}u + elem_idx;
  b[idx] = params.alpha * a[idx];
}
`;
}

/**
 * Generate vector clamp shader
 *
 * Computes c = clamp(a, min, max)
 *
 * @param size - Vector dimension
 * @param numVectors - Number of vectors
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorClampShader(
  size: number,
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const batchSize = numVectors > 1 ? numVectors : 1;

  return `
// Vector clamp: c = clamp(a, min, max)
// Vector size: ${size}, Batch size: ${batchSize}

struct ClampParams {
  min_val: f32,
  max_val: f32,
}

@group(0) @binding(0) var<uniform> params: ClampParams;
@group(0) @binding(1) var<storage, read> a: array<f32>;
@group(0) @binding(2) var<storage, read_write> c: array<f32>;

@compute @workgroup_size(${wgX}u)
fn vecclamp_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vec_idx = global_id.y;
  let elem_idx = global_id.x;

  if (vec_idx >= ${batchSize}u || elem_idx >= ${size}u) {
    return;
  }

  let idx = vec_idx * ${size}u + elem_idx;
  c[idx] = clamp(a[idx], params.min_val, params.max_val);
}
`;
}

/**
 * Get vector operation shader
 *
 * Returns shader for specified operation type.
 *
 * @param operation - Vector operation type
 * @param size - Vector dimension
 * @param numVectors - Number of vectors
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getVectorOpShader(
  operation: VectorOpType,
  size: number,
  numVectors: number = 1,
  workgroupSize?: WorkgroupSize
): string {
  switch (operation) {
    case "add":
      return getVectorAddShader(size, numVectors, workgroupSize);
    case "sub":
      return getVectorSubShader(size, numVectors, workgroupSize);
    case "mul":
      return getVectorMulShader(size, numVectors, workgroupSize);
    case "div":
      return getVectorDivShader(size, numVectors, workgroupSize);
    case "dot":
      return getVectorDotShader(size, numVectors, workgroupSize);
    case "cross":
      return getVectorCrossShader(numVectors, workgroupSize);
    case "normalize":
      return getVectorNormalizeShader(size, numVectors, workgroupSize);
    case "magnitude":
      return getVectorMagnitudeShader(size, numVectors, workgroupSize);
    case "distance":
      return getVectorL2DistanceShader(size, numVectors, workgroupSize);
    case "similarity":
      return getCosineSimilarityShader(size, numVectors, workgroupSize);
    default:
      throw new Error(`Unknown vector operation: ${operation}`);
  }
}

/**
 * Pre-configured vector shaders for common sizes
 */
export const DEFAULT_VECTOR_SHADERS = {
  "768-add": getVectorAddShader(768),
  "768-sub": getVectorSubShader(768),
  "768-mul": getVectorMulShader(768),
  "768-div": getVectorDivShader(768),
  "768-dot": getVectorDotShader(768),
  "768-normalize": getVectorNormalizeShader(768),
  "768-similarity": getCosineSimilarityShader(768),
} as const;
