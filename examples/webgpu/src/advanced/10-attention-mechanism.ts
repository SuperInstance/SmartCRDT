/**
 * @lsi/webgpu-examples/advanced/10-attention-mechanism
 *
 * Attention Mechanism on GPU.
 * This example demonstrates how to:
 * - Implement scaled dot-product attention
 * - Compute Q, K, V matrices
 * - Handle softmax on GPU
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, createUniformBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Attention computation configuration
 */
export interface AttentionConfig {
  sequenceLength: number;
  embeddingDim: number;
  numHeads: number;
  headDim: number;
}

/**
 * Compute Q, K, V projections
 */
export async function computeQKV(
  input: Float32Array,
  weightsQ: Float32Array,
  weightsK: Float32Array,
  weightsV: Float32Array,
  seqLen: number,
  embedDim: number
): Promise<{ Q: Float32Array; K: Float32Array; V: Float32Array }> {
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Create buffers
  const bufferInput = createStorageBuffer(device, input.byteLength, 'input');
  const bufferWQ = createStorageBuffer(device, weightsQ.byteLength, 'wq');
  const bufferWK = createStorageBuffer(device, weightsK.byteLength, 'wk');
  const bufferWV = createStorageBuffer(device, weightsV.byteLength, 'wv');
  const bufferQ = createStorageBuffer(device, seqLen * embedDim * 4, 'q');
  const bufferK = createStorageBuffer(device, seqLen * embedDim * 4, 'k');
  const bufferV = createStorageBuffer(device, seqLen * embedDim * 4, 'v');

  // Write input data
  writeBuffer(device, bufferInput, input);
  writeBuffer(device, bufferWQ, weightsQ);
  writeBuffer(device, bufferWK, weightsK);
  writeBuffer(device, bufferWV, weightsV);

  // Shader for QKV projection
  const shaderCode = `
struct InputArray {
  data: array<f32>,
};

struct Weights {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputArray;
@group(0) @binding(1) var<storage, read> wq: Weights;
@group(0) @binding(2) var<storage, read> wk: Weights;
@group(0) @binding(3) var<storage, read> wv: Weights;
@group(0) @binding(4) var<storage, read_write> q: InputArray;
@group(0) @binding(5) var<storage, read_write> k: InputArray;
@group(0) @binding(6) var<storage, read_write> v: InputArray;

const SEQ_LEN = ${seqLen}u;
const EMBED_DIM = ${embedDim}u;

@workgroup_size(256)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let seq_idx = global_id.y;
  let embed_idx = global_id.x;

  if (seq_idx >= SEQ_LEN || embed_idx >= EMBED_DIM) {
    return;
  }

  let input_idx = seq_idx * EMBED_DIM + embed_idx;
  let in_val = input.data[input_idx];

  // Compute Q[seq_idx, embed_idx]
  var q_val = 0.0;
  var k_val = 0.0;
  var v_val = 0.0;

  for (var i = 0u; i < EMBED_DIM; i = i + 1u) {
    let weight_idx = embed_idx * EMBED_DIM + i;
    q_val = q_val + input.data[seq_idx * EMBED_DIM + i] * wq.data[weight_idx];
    k_val = k_val + input.data[seq_idx * EMBED_DIM + i] * wk.data[weight_idx];
    v_val = v_val + input.data[seq_idx * EMBED_DIM + i] * wv.data[weight_idx];
  }

  let out_idx = seq_idx * EMBED_DIM + embed_idx;
  q.data[out_idx] = q_val;
  k.data[out_idx] = k_val;
  v.data[out_idx] = v_val;
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
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferInput } },
      { binding: 1, resource: { buffer: bufferWQ } },
      { binding: 2, resource: { buffer: bufferWK } },
      { binding: 3, resource: { buffer: bufferWV } },
      { binding: 4, resource: { buffer: bufferQ } },
      { binding: 5, resource: { buffer: bufferK } },
      { binding: 6, resource: { buffer: bufferV } }
    ]
  });

  // Dispatch
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(embedDim / 256), seqLen);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read results
  const qData = await readBuffer(device, bufferQ, seqLen * embedDim * 4);
  const kData = await readBuffer(device, bufferK, seqLen * embedDim * 4);
  const vData = await readBuffer(device, bufferV, seqLen * embedDim * 4);

  // Clean up
  bufferInput.destroy();
  bufferWQ.destroy();
  bufferWK.destroy();
  bufferWV.destroy();
  bufferQ.destroy();
  bufferK.destroy();
  bufferV.destroy();
  disposeWebGPU(device);

  return {
    Q: new Float32Array(qData),
    K: new Float32Array(kData),
    V: new Float32Array(vData)
  };
}

/**
 * Compute attention scores (QK^T / sqrt(d))
 */
export async function computeAttentionScores(
  Q: Float32Array,
  K: Float32Array,
  seqLen: number,
  headDim: number
): Promise<Float32Array> {
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;
  const scale = Math.sqrt(headDim);

  // Create buffers
  const bufferQ = createStorageBuffer(device, Q.byteLength, 'q');
  const bufferK = createStorageBuffer(device, K.byteLength, 'k');
  const bufferScores = createStorageBuffer(device, seqLen * seqLen * 4, 'scores');

  writeBuffer(device, bufferQ, Q);
  writeBuffer(device, bufferK, K);

  // Shader for attention scores
  const shaderCode = `
struct InputArray {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> q: InputArray;
@group(0) @binding(1) var<storage, read> k: InputArray;
@group(0) @binding(2) var<storage, read_write> scores: InputArray;

const SEQ_LEN = ${seqLen}u;
const HEAD_DIM = ${headDim}u;
const SCALE = ${scale.toFixed(6)}f;

@workgroup_size(16, 16, 1)
@compute
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  let j = global_id.y;

  if (i >= SEQ_LEN || j >= SEQ_LEN) {
    return;
  }

  var dot = 0.0;
  for (var d = 0u; d < HEAD_DIM; d = d + 1u) {
    dot = dot + q.data[i * HEAD_DIM + d] * k.data[j * HEAD_DIM + d];
  }

  scores.data[i * SEQ_LEN + j] = dot / SCALE;
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
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferQ } },
      { binding: 1, resource: { buffer: bufferK } },
      { binding: 2, resource: { buffer: bufferScores } }
    ]
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(seqLen / 16), Math.ceil(seqLen / 16));
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read results
  const scoresData = await readBuffer(device, bufferScores, seqLen * seqLen * 4);

  // Clean up
  bufferQ.destroy();
  bufferK.destroy();
  bufferScores.destroy();
  disposeWebGPU(device);

  return new Float32Array(scoresData);
}

/**
 * Compute softmax on GPU (row-wise)
 */
export async function softmax(
  input: Float32Array,
  rows: number,
  cols: number
): Promise<Float32Array> {
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Two-pass softmax: first find max, then compute exp and sum

  // Pass 1: Find max per row
  const bufferInput = createStorageBuffer(device, input.byteLength, 'input');
  const bufferMax = createStorageBuffer(device, rows * 4, 'max');
  const bufferExpSum = createStorageBuffer(device, rows * 4, 'expsum');
  const bufferOutput = createStorageBuffer(device, input.byteLength, 'output');

  writeBuffer(device, bufferInput, input);

  // Find max per row
  const maxShader = `
struct InputArray {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputArray;
@group(0) @binding(1) var<storage, read_write> max_vals: InputArray;

const ROWS = ${rows}u;
const COLS = ${cols}u;

var<workgroup> shared_max: array<f32, 256>;

@workgroup_size(256)
@compute
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let row = workgroup_id.x;
  let col = local_id.x;

  let val = select(-1e30, input.data[row * COLS + col], col < COLS);
  shared_max[col] = val;

  workgroupBarrier();

  var stride = 128u;
  loop {
    if (col < stride) {
      shared_max[col] = max(shared_max[col], shared_max[col + stride]);
    }
    workgroupBarrier();
    stride = stride / 2u;
    if (stride == 0u) {
      break;
    }
  }

  if (col == 0u) {
    max_vals.data[row] = shared_max[0u];
  }
}
`;

  const maxModule = device.createShaderModule({ code: maxShader });
  const maxPipeline = device.createComputePipeline({
    compute: { module: maxModule, entryPoint: 'main' }
  });

  const maxBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const maxBindGroup = device.createBindGroup({
    layout: maxBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferInput } },
      { binding: 1, resource: { buffer: bufferMax } }
    ]
  });

  const ce = device.createCommandEncoder();
  const pass = ce.beginComputePass();
  pass.setPipeline(maxPipeline);
  pass.setBindGroup(0, maxBindGroup);
  pass.dispatchWorkgroups(rows);
  pass.end();
  device.queue.submit([ce.finish()]);

  // Pass 2: Compute exp and normalize
  const softmaxShader = `
struct InputArray {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> input: InputArray;
@group(0) @binding(1) var<storage, read> max_vals: InputArray;
@group(0) @binding(2) var<storage, read_write> output: InputArray;

const ROWS = ${rows}u;
const COLS = ${cols}u;

var<workgroup> shared_sum: array<f32, 256>;

@workgroup_size(256)
@compute
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>,
  @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
  let row = workgroup_id.x;
  let col = local_id.x;

  let max_val = max_vals.data[row];
  let exp_val = exp(select(0.0, input.data[row * COLS + col] - max_val, col < COLS));
  shared_sum[col] = exp_val;

  workgroupBarrier();

  var stride = 128u;
  loop {
    if (col < stride) {
      shared_sum[col] = shared_sum[col] + shared_sum[col + stride];
    }
    workgroupBarrier();
    stride = stride / 2u;
    if (stride == 0u) {
      break;
    }
  }

  if (col < COLS) {
    output.data[row * COLS + col] = exp_val / shared_sum[0u];
  }
}
`;

  const softmaxModule = device.createShaderModule({ code: softmaxShader });
  const softmaxPipeline = device.createComputePipeline({
    compute: { module: softmaxModule, entryPoint: 'main' }
  });

  const softmaxBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const softmaxBindGroup = device.createBindGroup({
    layout: softmaxBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferInput } },
      { binding: 1, resource: { buffer: bufferMax } },
      { binding: 2, resource: { buffer: bufferOutput } }
    ]
  });

  const ce2 = device.createCommandEncoder();
  const pass2 = ce2.beginComputePass();
  pass2.setPipeline(softmaxPipeline);
  pass2.setBindGroup(0, softmaxBindGroup);
  pass2.dispatchWorkgroups(rows);
  pass2.end();
  device.queue.submit([ce2.finish()]);

  // Read results
  const outputData = await readBuffer(device, bufferOutput, input.byteLength);

  // Clean up
  bufferInput.destroy();
  bufferMax.destroy();
  bufferExpSum.destroy();
  bufferOutput.destroy();
  disposeWebGPU(device);

  return new Float32Array(outputData);
}

/**
 * Run attention mechanism example
 */
export async function runAttentionMechanism(): Promise<void> {
  const seqLen = 4;
  const embedDim = 8;

  console.log('Attention Mechanism on GPU');
  console.log(`Sequence Length: ${seqLen}, Embedding Dim: ${embedDim}`);
  console.log('');

  // Create sample input
  const input = new Float32Array(seqLen * embedDim);
  for (let i = 0; i < seqLen * embedDim; i++) {
    input[i] = Math.sin(i * 0.5) + Math.cos(i * 0.3);
  }

  // Create projection weights (identity for simplicity)
  const weights = new Float32Array(embedDim * embedDim);
  for (let i = 0; i < embedDim; i++) {
    weights[i * embedDim + i] = 1.0;
  }

  // Compute QKV
  console.log('Computing Q, K, V projections...');
  const { Q, K, V } = await computeQKV(input, weights, weights, weights, seqLen, embedDim);

  console.log('Q computed:', Array.from(Q.slice(0, embedDim)).map(v => v.toFixed(2)).join(', '));
  console.log('K computed:', Array.from(K.slice(0, embedDim)).map(v => v.toFixed(2)).join(', '));
  console.log('V computed:', Array.from(V.slice(0, embedDim)).map(v => v.toFixed(2)).join(', '));
  console.log('');

  // Compute attention scores
  console.log('Computing attention scores...');
  const scores = await computeAttentionScores(Q, K, seqLen, embedDim);
  console.log('Attention scores (first row):', Array.from(scores.slice(0, seqLen)).map(v => v.toFixed(2)).join(', '));
  console.log('');

  // Apply softmax
  console.log('Applying softmax...');
  const attentionWeights = await softmax(scores, seqLen, seqLen);
  console.log('Attention weights (first row):', Array.from(attentionWeights.slice(0, seqLen)).map(v => v.toFixed(4)).join(', '));
}
