/**
 * @lsi/webgpu-examples/core/08-embedding-similarity
 *
 * Embedding Similarity on GPU.
 * This example demonstrates how to:
 * - Calculate cosine similarity between embeddings
 * - Batch compute similarity for multiple embeddings
 * - Handle high-dimensional vectors efficiently
 */

import { initializeWebGPU, getDefaultConfig, disposeWebGPU } from '../utils/WebGPUUtils.js';
import { createStorageBuffer, writeBuffer, readBuffer } from '../utils/BufferUtils.js';

/**
 * Calculate cosine similarity between two embeddings
 *
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Cosine similarity (-1 to 1)
 */
export async function cosineSimilarity(
  embedding1: Float32Array,
  embedding2: Float32Array
): Promise<number> {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Create buffers
  const dim = embedding1.length;
  const buffer1 = createStorageBuffer(device, embedding1.byteLength, 'embedding1');
  const buffer2 = createStorageBuffer(device, embedding2.byteLength, 'embedding2');
  const bufferResult = createStorageBuffer(device, 4 * 3, 'result-buffer'); // dot, norm1, norm2

  writeBuffer(device, buffer1, embedding1);
  writeBuffer(device, buffer2, embedding2);

  // Shader for cosine similarity
  const shaderCode = `
struct Embedding {
  data: array<f32>,
};

struct Result {
  dot_product: f32,
  norm1: f32,
  norm2: f32,
};

@group(0) @binding(0) var<storage, read> emb1: Embedding;
@group(0) @binding(1) var<storage, read> emb2: Embedding;
@group(0) @binding(2) var<storage, read_write> result: Result;

var<workgroup> shared_dot: array<f32, 256>;
var<workgroup> shared_norm1: array<f32, 256>;
var<workgroup> shared_norm2: array<f32, 256>;

@workgroup_size(256)
@compute
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let global_index = global_id.x;
  let local_index = local_id.x;

  let dim = ${dim}u;

  // Load values
  let val1 = select(0.0, emb1.data[global_index], global_index < dim);
  let val2 = select(0.0, emb2.data[global_index], global_index < dim);

  shared_dot[local_index] = val1 * val2;
  shared_norm1[local_index] = val1 * val1;
  shared_norm2[local_index] = val2 * val2;

  workgroupBarrier();

  // Parallel reduction
  var stride = 128u;
  loop {
    if (local_index < stride) {
      shared_dot[local_index] = shared_dot[local_index] + shared_dot[local_index + stride];
      shared_norm1[local_index] = shared_norm1[local_index] + shared_norm1[local_index + stride];
      shared_norm2[local_index] = shared_norm2[local_index] + shared_norm2[local_index + stride];
    }
    workgroupBarrier();
    stride = stride / 2u;
    if (stride == 0u) {
      break;
    }
  }

  // Write results
  if (local_index == 0u) {
    result.dot_product = shared_dot[0u];
    result.norm1 = sqrt(shared_norm1[0u]);
    result.norm2 = sqrt(shared_norm2[0u]);
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
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: buffer1 } },
      { binding: 1, resource: { buffer: buffer2 } },
      { binding: 2, resource: { buffer: bufferResult } }
    ]
  });

  // Dispatch
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(dim / 256));
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read results
  const resultData = await readBuffer(device, bufferResult, 4 * 3);
  const resultArray = new Float32Array(resultData);

  const [dot, norm1, norm2] = resultArray;
  const similarity = dot / (norm1 * norm2);

  // Clean up
  buffer1.destroy();
  buffer2.destroy();
  bufferResult.destroy();
  disposeWebGPU(device);

  return similarity;
}

/**
 * Batch cosine similarity calculation
 *
 * @param queryEmbedding - Query embedding
 * @param corpusEmbeddings - Corpus embeddings (N x D)
 * @returns Array of similarities
 */
export async function batchCosineSimilarity(
  queryEmbedding: Float32Array,
  corpusEmbeddings: Float32Array[]
): Promise<number[]> {
  const dim = queryEmbedding.length;
  const numEmbeddings = corpusEmbeddings.length;

  // Initialize WebGPU
  const config = getDefaultConfig();
  const result = await initializeWebGPU(config);

  if (!result.success || !result.device) {
    throw new Error(`Failed to initialize WebGPU: ${result.error}`);
  }

  const device = result.device;

  // Flatten corpus embeddings
  const flatCorpus = new Float32Array(numEmbeddings * dim);
  for (let i = 0; i < numEmbeddings; i++) {
    flatCorpus.set(corpusEmbeddings[i], i * dim);
  }

  // Create buffers
  const bufferQuery = createStorageBuffer(device, queryEmbedding.byteLength, 'query');
  const bufferCorpus = createStorageBuffer(device, flatCorpus.byteLength, 'corpus');
  const bufferResults = createStorageBuffer(device, numEmbeddings * 4, 'results');

  writeBuffer(device, bufferQuery, queryEmbedding);
  writeBuffer(device, bufferCorpus, flatCorpus);

  // Batch similarity shader
  const shaderCode = `
struct Embedding {
  data: array<f32>,
};

@group(0) @binding(0) var<storage, read> query: Embedding;
@group(0) @binding(1) var<storage, read> corpus: Embedding;
@group(0) @binding(2) var<storage, read_write> results: array<f32>;

const DIM = ${dim}u;

@workgroup_size(256)
@compute
fn main(
  @builtin(global_invocation_id) global_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  let corpus_idx = global_id.y;
  let local_idx = local_id.x;

  var dot_product = 0.0;
  var norm_query_sq = 0.0;
  var norm_corpus_sq = 0.0;

  for (var i = local_idx; i < DIM; i = i + 256u) {
    let q = query.data[i];
    let c = corpus.data[corpus_idx * DIM + i];
    dot_product = dot_product + q * c;
    norm_query_sq = norm_query_sq + q * q;
    norm_corpus_sq = norm_corpus_sq + c * c;
  }

  var<workgroup> shared_dot: array<f32, 256>;
  var<workgroup> shared_nq: array<f32, 256>;
  var<workgroup> shared_nc: array<f32, 256>;

  shared_dot[local_idx] = dot_product;
  shared_nq[local_idx] = norm_query_sq;
  shared_nc[local_idx] = norm_corpus_sq;

  workgroupBarrier();

  var stride = 128u;
  loop {
    if (local_idx < stride) {
      shared_dot[local_idx] = shared_dot[local_idx] + shared_dot[local_idx + stride];
      shared_nq[local_idx] = shared_nq[local_idx] + shared_nq[local_idx + stride];
      shared_nc[local_idx] = shared_nc[local_idx] + shared_nc[local_idx + stride];
    }
    workgroupBarrier();
    stride = stride / 2u;
    if (stride == 0u) {
      break;
    }
  }

  if (local_idx == 0u) {
    let similarity = shared_dot[0u] / sqrt(shared_nq[0u] * shared_nc[0u]);
    results[corpus_idx] = similarity;
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
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
    ]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: bufferQuery } },
      { binding: 1, resource: { buffer: bufferCorpus } },
      { binding: 2, resource: { buffer: bufferResults } }
    ]
  });

  // Dispatch (1 workgroup per corpus embedding)
  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(pipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(1, numEmbeddings);
  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);

  // Read results
  const resultsData = await readBuffer(device, bufferResults, numEmbeddings * 4);
  const results = Array.from(new Float32Array(resultsData));

  // Clean up
  bufferQuery.destroy();
  bufferCorpus.destroy();
  bufferResults.destroy();
  disposeWebGPU(device);

  return results;
}

/**
 * Find top-k most similar embeddings
 *
 * @param queryEmbedding - Query embedding
 * @param corpusEmbeddings - Corpus embeddings with IDs
 * @param k - Number of results to return
 * @returns Top-k similar embeddings with IDs and scores
 */
export async function findTopKSimilar(
  queryEmbedding: Float32Array,
  corpusEmbeddings: Array<{ id: string; embedding: Float32Array }>,
  k: number = 5
): Promise<Array<{ id: string; score: number }>> {
  const embeddingsOnly = corpusEmbeddings.map(e => e.embedding);
  const similarities = await batchCosineSimilarity(queryEmbedding, embeddingsOnly);

  // Sort by similarity
  const indexed = similarities.map((score, idx) => ({ id: corpusEmbeddings[idx].id, score }));
  indexed.sort((a, b) => b.score - a.score);

  return indexed.slice(0, k);
}

/**
 * Run embedding similarity example
 */
export async function runEmbeddingSimilarity(): Promise<void> {
  // Example: 768-dim embeddings (like VL-JEPA)
  const dim = 768;

  // Create sample embeddings
  const embedding1 = new Float32Array(dim);
  const embedding2 = new Float32Array(dim);
  const embedding3 = new Float32Array(dim);

  // Initialize with some values
  for (let i = 0; i < dim; i++) {
    embedding1[i] = Math.sin(i * 0.1);
    embedding2[i] = Math.sin(i * 0.1) * 0.9; // Similar to embedding1
    embedding3[i] = Math.cos(i * 0.1); // Different from embedding1
  }

  console.log('Computing cosine similarity between 768-dim embeddings...');

  const sim12 = await cosineSimilarity(embedding1, embedding2);
  const sim13 = await cosineSimilarity(embedding1, embedding3);
  const sim23 = await cosineSimilarity(embedding2, embedding3);

  console.log('\n--- Cosine Similarities ---');
  console.log('Embedding 1 vs Embedding 2:', sim12.toFixed(4), '(similar)');
  console.log('Embedding 1 vs Embedding 3:', sim13.toFixed(4), '(different)');
  console.log('Embedding 2 vs Embedding 3:', sim23.toFixed(4), '(different)');

  // Batch similarity example
  const query = embedding1;
  const corpus = [
    { id: 'doc1', embedding: embedding1 },
    { id: 'doc2', embedding: embedding2 },
    { id: 'doc3', embedding: embedding3 }
  ];

  console.log('\n--- Top-K Similarity Search ---');
  const topK = await findTopKSimilar(query, corpus, 3);
  for (const result of topK) {
    console.log(`${result.id}: ${result.score.toFixed(4)}`);
  }
}
