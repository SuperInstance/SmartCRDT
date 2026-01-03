/**
 * @lsi/webgpu-compute/shaders/NeuralShader - Neural Network Operation Shaders
 *
 * WGSL compute shaders for neural network operations.
 * Supports activation functions, pooling, convolution, and layer operations.
 *
 * @version 1.0.0
 */

import type { ActivationType, PoolingType, WorkgroupSize } from "../types.js";

/**
 * Generate ReLU activation shader
 *
 * ReLU(x) = max(0, x)
 *
 * @param size - Number of elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getReLUShader(
  size: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// ReLU activation
// Size: ${size}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn relu_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  output[idx] = max(0.0, input[idx]);
}
`;
}

/**
 * Generate GELU activation shader
 *
 * GELU(x) = 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
 *
 * @param size - Number of elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getGELUShader(
  size: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// GELU activation
// Size: ${size}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn gelu_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  let x = input[idx];
  let cube = x * x * x;
  let tanh_arg = 0.7978845608 * (x + 0.044715 * cube); // sqrt(2/pi)
  output[idx] = 0.5 * x * (1.0 + tanh(tanh_arg));
}
`;
}

/**
 * Generate Swish activation shader
 *
 * Swish(x) = x * sigmoid(x)
 *
 * @param size - Number of elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getSwishShader(
  size: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Swish activation
// Size: ${size}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn swish_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  let x = input[idx];
  output[idx] = x * (1.0 / (1.0 + exp(-x)));
}
`;
}

/**
 * Generate sigmoid activation shader
 *
 * @param size - Number of elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getSigmoidShader(
  size: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Sigmoid activation
// Size: ${size}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn sigmoid_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  output[idx] = 1.0 / (1.0 + exp(-input[idx]));
}
`;
}

/**
 * Generate tanh activation shader
 *
 * @param size - Number of elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getTanhShader(
  size: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Tanh activation
// Size: ${size}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn tanh_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  output[idx] = tanh(input[idx]);
}
`;
}

/**
 * Generate leaky ReLU activation shader
 *
 * @param size - Number of elements
 * @param alpha - Negative slope
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getLeakyReLUShader(
  size: number,
  alpha: number = 0.01,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Leaky ReLU activation
// Size: ${size}, Alpha: ${alpha}

struct LeakyReLUParams {
  alpha: f32,
}

@group(0) @binding(0) var<uniform> params: LeakyReLUParams;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn leaky_relu_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  let x = input[idx];
  output[idx] = select(x * params.alpha, x, x >= 0.0);
}
`;
}

/**
 * Generate softmax activation shader
 *
 * @param size - Number of elements
 * @param numVectors - Number of vectors to apply softmax to
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getSoftmaxShader(
  size: number,
  numVectors: number = 1,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Softmax activation
// Size: ${size}, Vectors: ${numVectors}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

var<workgroup> shared_max: array<f32, ${wgX}u>;
var<workgroup> shared_sum: array<f32, ${wgX}u>;

@compute @workgroup_size(${wgX}u)
fn softmax_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let vec_idx = global_id.y;
  let elem_idx = global_id.x;
  let local_idx = local_invocation_id.x;

  if (vec_idx >= ${numVectors}u) {
    return;
  }

  let offset = vec_idx * ${size}u;

  // Find max for numerical stability
  var max_val: f32 = -1e9;
  for (var i: u32 = local_idx; i < ${size}u; i = i + ${wgX}u) {
    max_val = max(max_val, input[offset + i]);
  }
  shared_max[local_idx] = max_val;
  workgroupBarrier();

  // Reduce max
  var stride: u32 = ${wgX / 2}u;
  while (stride > 0u) {
    if (local_idx < stride) {
      shared_max[local_idx] = max(shared_max[local_idx], shared_max[local_idx + stride]);
    }
    stride = stride / 2u;
    workgroupBarrier();
  }

  // Compute exp and sum
  var exp_sum: f32 = 0.0;
  for (var j: u32 = local_idx; j < ${size}u; j = j + ${wgX}u) {
    let exp_val = exp(input[offset + j] - shared_max[0u]);
    exp_sum = exp_sum + exp_val;
    output[offset + j] = exp_val; // Store exp values
  }
  shared_sum[local_idx] = exp_sum;
  workgroupBarrier();

  // Reduce sum
  stride = ${wgX / 2}u;
  while (stride > 0u) {
    if (local_idx < stride) {
      shared_sum[local_idx] = shared_sum[local_idx] + shared_sum[local_idx + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }

  // Normalize
  for (var k: u32 = local_idx; k < ${size}u; k = k + ${wgX}u) {
    output[offset + k] = output[offset + k] / shared_sum[0u];
  }
}
`;
}

/**
 * Generate 2D max pooling shader
 *
 * @param inputShape - Input shape [batch, height, width, channels]
 * @param kernelSize - Kernel size [height, width]
 * @param stride - Stride [height, width]
 * @param padding - Padding [top, bottom, left, right]
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getMaxPool2DShader(
  inputShape: [number, number, number, number],
  kernelSize: [number, number],
  stride: [number, number],
  padding: [number, number, number, number],
  workgroupSize: WorkgroupSize = { x: 16, y: 16, z: 1 }
): string {
  const [batch, height, width, channels] = inputShape;
  const [kH, kW] = kernelSize;
  const [sH, sW] = stride;
  const [pt, pb, pl, pr] = padding;

  const outHeight = Math.floor((height + pt + pb - kH) / sH) + 1;
  const outWidth = Math.floor((width + pl + pr - kW) / sW) + 1;

  const { x: wgX, y: wgY } = workgroupSize;

  return `
// 2D Max pooling
// Input: [${batch}, ${height}, ${width}, ${channels}]
// Kernel: [${kH}, ${kW}], Stride: [${sH}, ${sW}]
// Output: [${batch}, ${outHeight}, ${outWidth}, ${channels}]

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u, ${wgY}u)
fn maxpool2d_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let b = global_id.z;
  let out_h = global_id.y;
  let out_w = global_id.x;

  if (b >= ${batch}u || out_h >= ${outHeight}u || out_w >= ${outWidth}u) {
    return;
  }

  for (var c: u32 = 0u; c < ${channels}u; c = c + 1u) {
    var max_val: f32 = -1e9;

    for (var kh: u32 = 0u; kh < ${kH}u; kh = kh + 1u) {
      for (var kw: u32 = 0u; kw < ${kW}u; kw = kw + 1u) {
        let in_h = i32(out_h) * ${sH} + i32(kh) - ${pt};
        let in_w = i32(out_w) * ${sW} + i32(kw) - ${pl};

        if (in_h >= 0 && in_h < ${height} && in_w >= 0 && in_w < ${width}) {
          let in_idx = (((b * ${height}u + u32(in_h)) * ${width}u + u32(in_w)) * ${channels}u + c);
          max_val = max(max_val, input[in_idx]);
        }
      }
    }

    let out_idx = (((b * ${outHeight}u + out_h) * ${outWidth}u + out_w) * ${channels}u + c);
    output[out_idx] = max_val;
  }
}
`;
}

/**
 * Generate 2D average pooling shader
 *
 * @param inputShape - Input shape [batch, height, width, channels]
 * @param kernelSize - Kernel size [height, width]
 * @param stride - Stride [height, width]
 * @param padding - Padding [top, bottom, left, right]
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getAvgPool2DShader(
  inputShape: [number, number, number, number],
  kernelSize: [number, number],
  stride: [number, number],
  padding: [number, number, number, number],
  workgroupSize: WorkgroupSize = { x: 16, y: 16, z: 1 }
): string {
  const [batch, height, width, channels] = inputShape;
  const [kH, kW] = kernelSize;
  const [sH, sW] = stride;
  const [pt, pb, pl, pr] = padding;

  const outHeight = Math.floor((height + pt + pb - kH) / sH) + 1;
  const outWidth = Math.floor((width + pl + pr - kW) / sW) + 1;

  const { x: wgX, y: wgY } = workgroupSize;

  return `
// 2D Average pooling
// Input: [${batch}, ${height}, ${width}, ${channels}]
// Kernel: [${kH}, ${kW}], Stride: [${sH}, ${sW}]
// Output: [${batch}, ${outHeight}, ${outWidth}, ${channels}]

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u, ${wgY}u)
fn avgpool2d_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let b = global_id.z;
  let out_h = global_id.y;
  let out_w = global_id.x;

  if (b >= ${batch}u || out_h >= ${outHeight}u || out_w >= ${outWidth}u) {
    return;
  }

  for (var c: u32 = 0u; c < ${channels}u; c = c + 1u) {
    var sum: f32 = 0.0;
    var count: f32 = 0.0;

    for (var kh: u32 = 0u; kh < ${kH}u; kh = kh + 1u) {
      for (var kw: u32 = 0u; kw < ${kW}u; kw = kw + 1u) {
        let in_h = i32(out_h) * ${sH} + i32(kh) - ${pt};
        let in_w = i32(out_w) * ${sW} + i32(kw) - ${pl};

        if (in_h >= 0 && in_h < ${height} && in_w >= 0 && in_w < ${width}) {
          let in_idx = (((b * ${height}u + u32(in_h)) * ${width}u + u32(in_w)) * ${channels}u + c);
          sum = sum + input[in_idx];
          count = count + 1.0;
        }
      }
    }

    let out_idx = (((b * ${outHeight}u + out_h) * ${outWidth}u + out_w) * ${channels}u + c);
    output[out_idx] = select(0.0, sum / count, count > 0.0);
  }
}
`;
}

/**
 * Generate layer normalization shader
 *
 * @param normalizedShape - Shape to normalize over
 * @param eps - Epsilon for numerical stability
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getLayerNormShader(
  normalizedShape: number[],
  eps: number = 1e-5,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const normSize = normalizedShape.reduce((a, b) => a * b, 1);

  return `
// Layer normalization
// Normalized shape: [${normalizedShape.join(", ")}], Epsilon: ${eps}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read> gamma: array<f32>;
@group(0) @binding(2) var<storage, read> beta: array<f32>;
@group(0) @binding(3) var<storage, read_write> output: array<f32>;

var<workgroup> shared_mean: array<f32, ${wgX}u>;
var<workgroup> shared_var: array<f32, ${wgX}u>;

@compute @workgroup_size(${wgX}u)
fn layer_norm_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let row_idx = global_id.y;
  let elem_idx = global_id.x;
  let local_idx = local_invocation_id.x;

  let offset = row_idx * ${normSize}u;

  // Compute mean
  var sum: f32 = 0.0;
  for (var i: u32 = local_idx; i < ${normSize}u; i = i + ${wgX}u) {
    sum = sum + input[offset + i];
  }
  shared_mean[local_idx] = sum;
  workgroupBarrier();

  var stride: u32 = ${wgX / 2}u;
  while (stride > 0u) {
    if (local_idx < stride) {
      shared_mean[local_idx] = shared_mean[local_idx] + shared_mean[local_idx + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }

  let mean = shared_mean[0u] / f32(${normSize}u);

  // Compute variance
  var var_sum: f32 = 0.0;
  for (var j: u32 = local_idx; j < ${normSize}u; j = j + ${wgX}u) {
    let diff = input[offset + j] - mean;
    var_sum = var_sum + diff * diff;
  }
  shared_var[local_idx] = var_sum;
  workgroupBarrier();

  stride = ${wgX / 2}u;
  while (stride > 0u) {
    if (local_idx < stride) {
      shared_var[local_idx] = shared_var[local_idx] + shared_var[local_idx + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }

  let variance = shared_var[0u] / f32(${normSize}u);
  let std_dev = sqrt(variance + ${eps});

  // Normalize
  if (elem_idx < ${normSize}u) {
    let idx = offset + elem_idx;
    output[idx] = gamma[elem_idx] * (input[idx] - mean) / std_dev + beta[elem_idx];
  }
}
`;
}

/**
 * Generate dropout shader (training only)
 *
 * @param size - Number of elements
 * @param dropoutRate - Dropout probability
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getDropoutShader(
  size: number,
  dropoutRate: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const scale = 1.0 / (1.0 - dropoutRate);

  return `
// Dropout (training mode)
// Size: ${size}, Dropout rate: ${dropoutRate}

struct DropoutParams {
  rate: f32,
  scale: f32,
  seed: u32,
}

@group(0) @binding(0) var<uniform> params: DropoutParams;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<storage, read_write> mask: array<f32>;

// Simple PRNG
fn random_hash(seed: u32, idx: u32) -> f32 {
  let h = seed ^ idx;
  let h2 = h * 374761393u;
  let h3 = h2 ^ (h2 >> 13);
  let h4 = h3 * 668265263u;
  let h5 = h4 ^ (h4 >> 16);
  return f32(h5) / 4294967296.0;
}

@compute @workgroup_size(${wgX}u)
fn dropout_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  let rand_val = random_hash(params.seed, idx);
  let keep = rand_val > params.rate;

  mask[idx] = select(0.0, 1.0, keep);
  output[idx] = input[idx] * mask[idx] * params.scale;
}
`;
}

/**
 * Get activation shader
 *
 * Returns shader for specified activation function.
 *
 * @param activation - Activation type
 * @param size - Number of elements
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getActivationShader(
  activation: ActivationType,
  size: number,
  workgroupSize?: WorkgroupSize
): string {
  switch (activation) {
    case "relu":
      return getReLUShader(size, workgroupSize);
    case "gelu":
      return getGELUShader(size, workgroupSize);
    case "swish":
      return getSwishShader(size, workgroupSize);
    case "sigmoid":
      return getSigmoidShader(size, workgroupSize);
    case "tanh":
      return getTanhShader(size, workgroupSize);
    case "softmax":
      return getSoftmaxShader(size, 1, workgroupSize);
    case "leaky-relu":
      return getLeakyReLUShader(size, 0.01, workgroupSize);
    default:
      return getReLUShader(size, workgroupSize);
  }
}

/**
 * Pre-configured neural network shaders
 */
export const DEFAULT_NEURAL_SHADERS = {
  "relu-768": getReLUShader(768),
  "gelu-768": getGELUShader(768),
  "swish-768": getSwishShader(768),
  "softmax-768": getSoftmaxShader(768),
  "layernorm-768": getLayerNormShader([768]),
} as const;
