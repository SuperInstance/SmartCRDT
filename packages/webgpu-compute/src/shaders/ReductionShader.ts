/**
 * @lsi/webgpu-compute/shaders/ReductionShader - Reduction Operation Shaders
 *
 * WGSL compute shaders for reduction operations.
 * Supports sum, min, max, argmin, argmax, mean, and product reductions.
 *
 * @version 1.0.0
 */

import type { ReductionOpType, WorkgroupSize } from "../types.js";

/**
 * Generate sum reduction shader
 *
 * Computes sum of all elements
 *
 * @param inputSize - Number of input elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getSumReductionShader(
  inputSize: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Sum reduction
// Input size: ${inputSize}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn sum_reduction_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${inputSize}u) {
    return;
  }

  // Tree reduction: each thread writes its value
  output[idx] = input[idx];
}
`;
}

/**
 * Generate min reduction shader
 *
 * Computes minimum of all elements
 *
 * @param inputSize - Number of input elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getMinReductionShader(
  inputSize: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Min reduction
// Input size: ${inputSize}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn min_reduction_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${inputSize}u) {
    return;
  }

  output[idx] = input[idx];
}
`;
}

/**
 * Generate max reduction shader
 *
 * Computes maximum of all elements
 *
 * @param inputSize - Number of input elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getMaxReductionShader(
  inputSize: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Max reduction
// Input size: ${inputSize}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn max_reduction_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${inputSize}u) {
    return;
  }

  output[idx] = input[idx];
}
`;
}

/**
 * Generate argmin reduction shader
 *
 * Finds index of minimum element
 *
 * @param inputSize - Number of input elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getArgminReductionShader(
  inputSize: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Argmin reduction
// Input size: ${inputSize}

struct MinValIndex {
  value: f32,
  index: u32,
}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<MinValIndex>;

@compute @workgroup_size(${wgX}u)
fn argmin_reduction_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${inputSize}u) {
    return;
  }

  output[idx] = MinValIndex(input[idx], idx);
}
`;
}

/**
 * Generate argmax reduction shader
 *
 * Finds index of maximum element
 *
 * @param inputSize - Number of input elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getArgmaxReductionShader(
  inputSize: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Argmax reduction
// Input size: ${inputSize}

struct MaxValIndex {
  value: f32,
  index: u32,
}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<MaxValIndex>;

@compute @workgroup_size(${wgX}u)
fn argmax_reduction_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${inputSize}u) {
    return;
  }

  output[idx] = MaxValIndex(input[idx], idx);
}
`;
}

/**
 * Generate mean reduction shader
 *
 * Computes mean of all elements
 *
 * @param inputSize - Number of input elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getMeanReductionShader(
  inputSize: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Mean reduction
// Input size: ${inputSize}

struct MeanParams {
  count: u32,
}

@group(0) @binding(0) var<uniform> params: MeanParams;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> sum: array<f32>;

@compute @workgroup_size(${wgX}u)
fn mean_reduction_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${inputSize}u) {
    return;
  }

  sum[idx] = input[idx];
}
`;
}

/**
 * Generate product reduction shader
 *
 * Computes product of all elements
 *
 * @param inputSize - Number of input elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getProductReductionShader(
  inputSize: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Product reduction
// Input size: ${inputSize}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn product_reduction_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${inputSize}u) {
    return;
  }

  output[idx] = input[idx];
}
`;
}

/**
 * Generate all-reduce shader (tree-based parallel reduction)
 *
 * Performs efficient parallel reduction using tree algorithm
 *
 * @param inputSize - Number of input elements
 * @param operation - Reduction operation
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getAllReduceShader(
  inputSize: number,
  operation: ReductionOpType,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  // Get operation-specific code
  let identity = "0.0";
  let opCode = "a + b";

  switch (operation) {
    case "sum":
      identity = "0.0";
      opCode = "a + b";
      break;
    case "min":
      identity = "1e9";
      opCode = "min(a, b)";
      break;
    case "max":
      identity = "-1e9";
      opCode = "max(a, b)";
      break;
    case "prod":
      identity = "1.0";
      opCode = "a * b";
      break;
    default:
      identity = "0.0";
      opCode = "a + b";
  }

  return `
// All-reduce (tree-based parallel reduction)
// Input size: ${inputSize}, Operation: ${operation}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> partial: array<f32>;

var<workgroup> shared_data: array<f32, ${wgX}u>;

@compute @workgroup_size(${wgX}u)
fn all_reduce_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let local_idx = local_invocation_id.x;
  let global_idx = global_id.x;

  // Load input into shared memory
  let value = select(${identity}, input[global_idx], global_idx < ${inputSize}u);
  shared_data[local_idx] = value;
  workgroupBarrier();

  // Tree reduction
  var stride: u32 = ${wgX / 2}u;
  while (stride > 0u) {
    if (local_idx < stride) {
      shared_data[local_idx] = ${opCode.replace(/a/g, "shared_data[local_idx]").replace(/b/g, "shared_data[local_idx + stride]")};
    }
    stride = stride / 2u;
    workgroupBarrier();
  }

  // Write partial result
  if (local_idx == 0u) {
    partial[global_id.x / ${wgX}u] = shared_data[0u];
  }
}
`;
}

/**
 * Generate reduction shader along axis
 *
 * Reduces along a specific axis (for multi-dimensional arrays)
 *
 * @param inputShape - Input array shape
 * @param axis - Axis to reduce along
 * @param operation - Reduction operation
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getAxisReductionShader(
  inputShape: number[],
  axis: number,
  operation: ReductionOpType,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const reducedShape = inputShape.filter((_, i) => i !== axis);
  const axisSize = inputShape[axis];
  const outputSize = reducedShape.reduce((a, b) => a * b, 1);

  // Get operation-specific code
  let identity = "0.0";
  let opCode = "a + b";

  switch (operation) {
    case "sum":
      identity = "0.0";
      opCode = "a + b";
      break;
    case "min":
      identity = "1e9";
      opCode = "min(a, b)";
      break;
    case "max":
      identity = "-1e9";
      opCode = "max(a, b)";
      break;
    case "mean":
      identity = "0.0";
      opCode = "a + b";
      break;
    case "prod":
      identity = "1.0";
      opCode = "a * b";
      break;
    default:
      identity = "0.0";
      opCode = "a + b";
  }

  return `
// Axis reduction
// Input shape: [${inputShape.join(", ")}], Axis: ${axis}, Operation: ${operation}
// Output shape: [${reducedShape.join(", ")}]

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn axis_reduce_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let out_idx = global_id.x;

  if (out_idx >= ${outputSize}u) {
    return;
  }

  // Compute reduction
  var acc: f32 = ${identity};
  for (var i: u32 = 0u; i < ${axisSize}u; i = i + 1u) {
    // Calculate input index based on output index and axis position
    let in_idx = out_idx * ${axisSize}u + i;
    acc = ${opCode.replace(/a/g, "acc").replace(/b/g, `input[in_idx]`)};
  }

  // Apply normalization for mean
  ${operation === "mean" ? `output[out_idx] = acc / f32(${axisSize}u);` : `output[out_idx] = acc;`}
}
`;
}

/**
 * Get reduction shader for operation
 *
 * Returns shader for specified reduction operation.
 *
 * @param operation - Reduction operation type
 * @param inputSize - Number of input elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getReductionShader(
  operation: ReductionOpType,
  inputSize: number,
  workgroupSize?: WorkgroupSize
): string {
  switch (operation) {
    case "sum":
      return getSumReductionShader(inputSize, workgroupSize);
    case "min":
      return getMinReductionShader(inputSize, workgroupSize);
    case "max":
      return getMaxReductionShader(inputSize, workgroupSize);
    case "argmin":
      return getArgminReductionShader(inputSize, workgroupSize);
    case "argmax":
      return getArgmaxReductionShader(inputSize, workgroupSize);
    case "mean":
      return getMeanReductionShader(inputSize, workgroupSize);
    case "prod":
      return getProductReductionShader(inputSize, workgroupSize);
    default:
      throw new Error(`Unknown reduction operation: ${operation}`);
  }
}

/**
 * Pre-configured reduction shaders
 */
export const DEFAULT_REDUCTION_SHADERS = {
  "768-sum": getSumReductionShader(768),
  "768-min": getMinReductionShader(768),
  "768-max": getMaxReductionShader(768),
  "768-mean": getMeanReductionShader(768),
  "768-argmin": getArgminReductionShader(768),
  "768-argmax": getArgmaxReductionShader(768),
} as const;
