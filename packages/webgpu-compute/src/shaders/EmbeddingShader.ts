/**
 * @lsi/webgpu-compute/shaders/EmbeddingShader - Embedding Operation Shaders
 *
 * WGSL compute shaders for embedding operations.
 * Supports similarity search, distance computation, and embedding clustering.
 *
 * @version 1.0.0
 */

import type { SimilarityMetric, WorkgroupSize } from "../types.js";

/**
 * Generate cosine similarity shader for embeddings
 *
 * Computes cosine similarity between query embedding and candidate embeddings
 *
 * @param embeddingDim - Embedding dimension (e.g., 768 for VL-JEPA)
 * @param numCandidates - Number of candidate embeddings
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getCosineSimilaritySearchShader(
  embeddingDim: number,
  numCandidates: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Cosine similarity search for embeddings
// Embedding dim: ${embeddingDim}, Candidates: ${numCandidates}

@group(0) @binding(0) var<storage, read> query: array<f32>; // (${embeddingDim},)
@group(0) @binding(1) var<storage, read> candidates: array<f32>; // (${numCandidates}, ${embeddingDim})
@group(0) @binding(2) var<storage, read_write> similarities: array<f32>; // (${numCandidates},)

@compute @workgroup_size(${wgX}u)
fn cosine_sim_search_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_idx = global_id.x;

  if (candidate_idx >= ${numCandidates}u) {
    return;
  }

  // Compute dot product
  var dot: f32 = 0.0;
  var norm_query: f32 = 0.0;
  var norm_candidate: f32 = 0.0;

  let offset = candidate_idx * ${embeddingDim}u;

  for (var i: u32 = 0u; i < ${embeddingDim}u; i = i + 1u) {
    let q = query[i];
    let c = candidates[offset + i];
    dot = dot + q * c;
    norm_query = norm_query + q * q;
    norm_candidate = norm_candidate + c * c;
  }

  let norm_product = sqrt(norm_query) * sqrt(norm_candidate);
  similarities[candidate_idx] = select(0.0, dot / norm_product, norm_product > 1e-8);
}
`;
}

/**
 * Generate Euclidean distance shader for embeddings
 *
 * Computes L2 distance between query embedding and candidate embeddings
 *
 * @param embeddingDim - Embedding dimension
 * @param numCandidates - Number of candidate embeddings
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getEuclideanDistanceSearchShader(
  embeddingDim: number,
  numCandidates: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Euclidean distance search for embeddings
// Embedding dim: ${embeddingDim}, Candidates: ${numCandidates}

@group(0) @binding(0) var<storage, read> query: array<f32>; // (${embeddingDim},)
@group(0) @binding(1) var<storage, read> candidates: array<f32>; // (${numCandidates}, ${embeddingDim})
@group(0) @binding(2) var<storage, read_write> distances: array<f32>; // (${numCandidates},)

@compute @workgroup_size(${wgX}u)
fn euclidean_dist_search_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_idx = global_id.x;

  if (candidate_idx >= ${numCandidates}u) {
    return;
  }

  // Compute L2 distance
  var sum_sq: f32 = 0.0;
  let offset = candidate_idx * ${embeddingDim}u;

  for (var i: u32 = 0u; i < ${embeddingDim}u; i = i + 1u) {
    let diff = query[i] - candidates[offset + i];
    sum_sq = sum_sq + diff * diff;
  }

  distances[candidate_idx] = sqrt(sum_sq);
}
`;
}

/**
 * Generate Manhattan distance shader for embeddings
 *
 * Computes L1 distance between query embedding and candidate embeddings
 *
 * @param embeddingDim - Embedding dimension
 * @param numCandidates - Number of candidate embeddings
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getManhattanDistanceSearchShader(
  embeddingDim: number,
  numCandidates: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Manhattan distance search for embeddings
// Embedding dim: ${embeddingDim}, Candidates: ${numCandidates}

@group(0) @binding(0) var<storage, read> query: array<f32>; // (${embeddingDim},)
@group(0) @binding(1) var<storage, read> candidates: array<f32>; // (${numCandidates}, ${embeddingDim})
@group(0) @binding(2) var<storage, read_write> distances: array<f32>; // (${numCandidates},)

@compute @workgroup_size(${wgX}u)
fn manhattan_dist_search_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let candidate_idx = global_id.x;

  if (candidate_idx >= ${numCandidates}u) {
    return;
  }

  // Compute L1 distance
  var sum_abs: f32 = 0.0;
  let offset = candidate_idx * ${embeddingDim}u;

  for (var i: u32 = 0u; i < ${embeddingDim}u; i = i + 1u) {
    let diff = query[i] - candidates[offset + i];
    sum_abs = sum_abs + abs(diff);
  }

  distances[candidate_idx] = sum_abs;
}
`;
}

/**
 * Generate embedding normalization shader
 *
 * Normalizes embeddings to unit length (L2 normalization)
 *
 * @param embeddingDim - Embedding dimension
 * @param numEmbeddings - Number of embeddings
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getEmbeddingNormalizeShader(
  embeddingDim: number,
  numEmbeddings: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Embedding normalization (L2)
// Embedding dim: ${embeddingDim}, Count: ${numEmbeddings}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(${wgX}u)
fn embedding_normalize_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let emb_idx = global_id.x;

  if (emb_idx >= ${numEmbeddings}u) {
    return;
  }

  // Compute L2 norm
  var sum_sq: f32 = 0.0;
  let offset = emb_idx * ${embeddingDim}u;

  for (var i: u32 = 0u; i < ${embeddingDim}u; i = i + 1u) {
    let val = input[offset + i];
    sum_sq = sum_sq + val * val;
  }

  let norm = sqrt(sum_sq);

  // Normalize
  for (var j: u32 = 0u; j < ${embeddingDim}u; j = j + 1u) {
    output[offset + j] = input[offset + j] / (norm + 1e-8);
  }
}
`;
}

/**
 * Generate embedding concatenation shader
 *
 * Concatenates multiple embeddings into one
 *
 * @param embeddingDim - Embedding dimension per embedding
 * @param numEmbeddings - Number of embeddings to concatenate
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getEmbeddingConcatShader(
  embeddingDim: number,
  numEmbeddings: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;
  const outputDim = embeddingDim * numEmbeddings;

  return `
// Embedding concatenation
// Input: ${numEmbeddings} x (${embeddingDim},), Output: (${outputDim},)

@group(0) @binding(0) var<storage, read> input: array<f32>; // (${numEmbeddings}, ${embeddingDim})
@group(0) @binding(1) var<storage, read_write> output: array<f32>; // (${outputDim},)

@compute @workgroup_size(${wgX}u)
fn embedding_concat_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${outputDim}u) {
    return;
  }

  // Calculate which embedding and position
  let emb_idx = idx / ${embeddingDim}u;
  let pos_idx = idx % ${embeddingDim}u;

  output[idx] = input[emb_idx * ${embeddingDim}u + pos_idx];
}
`;
}

/**
 * Generate embedding average shader
 *
 * Computes average of multiple embeddings
 *
 * @param embeddingDim - Embedding dimension
 * @param numEmbeddings - Number of embeddings to average
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getEmbeddingAverageShader(
  embeddingDim: number,
  numEmbeddings: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Embedding average
// Input: ${numEmbeddings} x (${embeddingDim},), Output: (${embeddingDim},)

struct AverageParams {
  count: u32,
}

@group(0) @binding(0) var<uniform> params: AverageParams;
@group(0) @binding(1) var<storage, read> input: array<f32>; // (${numEmbeddings}, ${embeddingDim})
@group(0) @binding(2) var<storage, read_write> output: array<f32>; // (${embeddingDim},)

@compute @workgroup_size(${wgX}u)
fn embedding_average_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let pos_idx = global_id.x;

  if (pos_idx >= ${embeddingDim}u) {
    return;
  }

  // Sum all embeddings at this position
  var sum: f32 = 0.0;
  for (var i: u32 = 0u; i < ${numEmbeddings}u; i = i + 1u) {
    sum = sum + input[i * ${embeddingDim}u + pos_idx];
  }

  output[pos_idx] = sum / f32(params.count);
}
`;
}

/**
 * Generate k-means clustering assignment shader
 *
 * Assigns embeddings to nearest cluster centroid
 *
 * @param embeddingDim - Embedding dimension
 * @param numEmbeddings - Number of embeddings
 * @param numClusters - Number of clusters
 * @param metric - Distance metric ('l2' or 'cosine')
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getKMeansAssignmentShader(
  embeddingDim: number,
  numEmbeddings: number,
  numClusters: number,
  metric: "l2" | "cosine" = "l2",
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  // Distance computation based on metric
  let distCode = "";
  if (metric === "l2") {
    distCode = `
      let diff = embedding[i] - centroid[i];
      sum_sq = sum_sq + diff * diff;
      return sum_sq;`;
  } else {
    distCode = `
      dot = dot + embedding[i] * centroid[i];
      norm_emb = norm_emb + embedding[i] * embedding[i];
      norm_cent = norm_cent + centroid[i] * centroid[i];
      let norm_product = sqrt(norm_emb) * sqrt(norm_cent);
      return select(1.0, 1.0 - dot / norm_product, norm_product > 1e-8);`;
  }

  return `
// K-means clustering assignment
// Embeddings: (${numEmbeddings}, ${embeddingDim}), Clusters: ${numClusters}
// Metric: ${metric}

@group(0) @binding(0) var<storage, read> embeddings: array<f32>; // (${numEmbeddings}, ${embeddingDim})
@group(0) @binding(1) var<storage, read> centroids: array<f32>; // (${numClusters}, ${embeddingDim})
@group(0) @binding(2) var<storage, read_write> assignments: array<u32>; // (${numEmbeddings},)
@group(0) @binding(3) var<storage, read_write> distances: array<f32>; // (${numEmbeddings},)

@compute @workgroup_size(${wgX}u)
fn kmeans_assignment_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let emb_idx = global_id.x;

  if (emb_idx >= ${numEmbeddings}u) {
    return;
  }

  let emb_offset = emb_idx * ${embeddingDim}u;
  var min_dist: f32 = 1e9;
  var nearest_cluster: u32 = 0u;

  // Find nearest centroid
  for (var c: u32 = 0u; c < ${numClusters}u; c = c + 1u) {
    let cent_offset = c * ${embeddingDim}u;
    var sum_sq: f32 = 0.0;
    var dot: f32 = 0.0;
    var norm_emb: f32 = 0.0;
    var norm_cent: f32 = 0.0;

    for (var i: u32 = 0u; i < ${embeddingDim}u; i = i + 1u) {
      ${distCode}
    }

    let dist = ${metric === "l2" ? "sum_sq" : "1.0 - dot / (sqrt(norm_emb) * sqrt(norm_cent) + 1e-8)"};
    if (dist < min_dist) {
      min_dist = dist;
      nearest_cluster = c;
    }
  }

  assignments[emb_idx] = nearest_cluster;
  distances[emb_idx] = min_dist;
}
`;
}

/**
 * Generate embedding similarity matrix shader
 *
 * Computes pairwise similarity matrix for embeddings
 *
 * @param embeddingDim - Embedding dimension
 * @param numEmbeddings - Number of embeddings
 * @param metric - Similarity metric
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getSimilarityMatrixShader(
  embeddingDim: number,
  numEmbeddings: number,
  metric: SimilarityMetric = "cosine",
  workgroupSize: WorkgroupSize = { x: 16, y: 16, z: 1 }
): string {
  const { x: wgX, y: wgY } = workgroupSize;

  // Similarity computation based on metric
  let simCode = "";
  switch (metric) {
    case "cosine":
      simCode = `
        let dot_product = a[i] * b[i];
        dot = dot + dot_product;
        norm_a = norm_a + a[i] * a[i];
        norm_b = norm_b + b[i] * b[i];
      }
      let norm_product = sqrt(norm_a) * sqrt(norm_b);
      return select(0.0, dot / norm_product, norm_product > 1e-8);`;
      break;
    case "euclidean":
      simCode = `
        let diff = a[i] - b[i];
        sum_sq = sum_sq + diff * diff;
      }
      return -sqrt(sum_sq); // Negative distance for "similarity"`;
      break;
    case "dot":
      simCode = `
        dot = dot + a[i] * b[i];
      }
      return dot;`;
      break;
    default:
      simCode = `
        dot = dot + a[i] * b[i];
        norm_a = norm_a + a[i] * a[i];
        norm_b = norm_b + b[i] * b[i];
      }
      let norm_product = sqrt(norm_a) * sqrt(norm_b);
      return select(0.0, dot / norm_product, norm_product > 1e-8);`;
  }

  return `
// Embedding similarity matrix
// Embeddings: (${numEmbeddings}, ${embeddingDim}), Metric: ${metric}

@group(0) @binding(0) var<storage, read> embeddings: array<f32>; // (${numEmbeddings}, ${embeddingDim})
@group(0) @binding(1) var<storage, read_write> similarity_matrix: array<f32>; // (${numEmbeddings}, ${numEmbeddings})

@compute @workgroup_size(${wgX}u, ${wgY}u)
fn similarity_matrix_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;
  let j = global_id.y;

  if (i >= ${numEmbeddings}u || j >= ${numEmbeddings}u) {
    return;
  }

  let offset_i = i * ${embeddingDim}u;
  let offset_j = j * ${embeddingDim}u;

  // Compute similarity
  var dot: f32 = 0.0;
  var norm_a: f32 = 0.0;
  var norm_b: f32 = 0.0;
  var sum_sq: f32 = 0.0;

  for (var k: u32 = 0u; k < ${embeddingDim}u; k = k + 1u) {
    let a = embeddings[offset_i + k];
    let b = embeddings[offset_j + k];
    ${simCode}
  }

  similarity_matrix[i * ${numEmbeddings}u + j] = ${metric === "euclidean" ? "-sqrt(sum_sq)" : metric === "dot" ? "dot" : "dot / (sqrt(norm_a) * sqrt(norm_b) + 1e-8)"};
}
`;
}

/**
 * Generate embedding projection shader
 *
 * Projects embeddings to different dimension using linear projection
 *
 * @param inputDim - Input embedding dimension
 * @param outputDim - Output embedding dimension
 * @param numEmbeddings - Number of embeddings
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getEmbeddingProjectionShader(
  inputDim: number,
  outputDim: number,
  numEmbeddings: number,
  workgroupSize: WorkgroupSize = { x: 256, y: 1, z: 1 }
): string {
  const { x: wgX } = workgroupSize;

  return `
// Embedding projection
// Input: (${numEmbeddings}, ${inputDim}), Output: (${numEmbeddings}, ${outputDim})
// Projection: (${outputDim}, ${inputDim})

@group(0) @binding(0) var<storage, read> input: array<f32>; // (${numEmbeddings}, ${inputDim})
@group(0) @binding(1) var<storage, read> projection: array<f32>; // (${outputDim}, ${inputDim})
@group(0) @binding(2) var<storage, read_write> output: array<f32>; // (${numEmbeddings}, ${outputDim})

@compute @workgroup_size(${wgX}u)
fn embedding_projection_main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let emb_idx = global_id.y;
  let out_idx = global_id.x;

  if (emb_idx >= ${numEmbeddings}u || out_idx >= ${outputDim}u) {
    return;
  }

  // Compute dot product
  var sum: f32 = 0.0;
  let input_offset = emb_idx * ${inputDim}u;
  let proj_offset = out_idx * ${inputDim}u;

  for (var i: u32 = 0u; i < ${inputDim}u; i = i + 1u) {
    sum = sum + input[input_offset + i] * projection[proj_offset + i];
  }

  output[emb_idx * ${outputDim}u + out_idx] = sum;
}
`;
}

/**
 * Pre-configured embedding shaders for VL-JEPA
 */
export const DEFAULT_EMBEDDING_SHADERS = {
  "768-cosine-search": getCosineSimilaritySearchShader(768, 1000),
  "768-euclidean-search": getEuclideanDistanceSearchShader(768, 1000),
  "768-normalize": getEmbeddingNormalizeShader(768, 1000),
  "768-concat": getEmbeddingConcatShader(768, 2),
  "768-similarity-matrix": getSimilarityMatrixShader(768, 100, "cosine"),
} as const;

/**
 * Get embedding similarity shader
 *
 * Returns shader for specified similarity metric.
 *
 * @param metric - Similarity metric
 * @param embeddingDim - Embedding dimension
 * @param numCandidates - Number of candidates
 * @param workgroupSize - Workgroup size
 * @returns WGSL shader code
 */
export function getSimilarityShader(
  metric: SimilarityMetric,
  embeddingDim: number,
  numCandidates: number,
  workgroupSize?: WorkgroupSize
): string {
  switch (metric) {
    case "cosine":
      return getCosineSimilaritySearchShader(
        embeddingDim,
        numCandidates,
        workgroupSize
      );
    case "euclidean":
      return getEuclideanDistanceSearchShader(
        embeddingDim,
        numCandidates,
        workgroupSize
      );
    case "manhattan":
      return getManhattanDistanceSearchShader(
        embeddingDim,
        numCandidates,
        workgroupSize
      );
    case "dot":
      return getCosineSimilaritySearchShader(
        embeddingDim,
        numCandidates,
        workgroupSize
      ); // Dot is similar code
    default:
      return getCosineSimilaritySearchShader(
        embeddingDim,
        numCandidates,
        workgroupSize
      );
  }
}
