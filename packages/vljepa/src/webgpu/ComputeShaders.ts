/**
 * @lsi/vljepa/webgpu/ComputeShaders - GPU Compute Shaders for VL-JEPA
 *
 * WGSL (WebGPU Shading Language) compute kernels for VL-JEPA operations.
 * Includes matrix multiplication, layer normalization, attention, and
 * embedding operations.
 *
 * Key Features:
 * - Optimized matrix multiplication (16x16 workgroups)
 * - Layer normalization for transformers
 * - Self-attention computation
 * - Embedding projections
 * - Activation functions (GELU, ReLU, Swish)
 *
 * @see https://www.w3.org/TR/WGSL/
 * @version 1.0.0
 */

// ============================================================================
// SHADER CONSTANTS
// ============================================================================

/**
 * Embedding dimension for VL-JEPA
 */
export const EMBEDDING_DIM = 768;

/**
 * Hidden dimension for predictor
 */
export const HIDDEN_DIM = 2048;

/**
 * Maximum sequence length for attention
 */
export const MAX_SEQ_LEN = 512;

/**
 * Number of attention heads
 */
export const NUM_HEADS = 12;

/**
 * Head dimension
 */
export const HEAD_DIM = EMBEDDING_DIM / NUM_HEADS; // 64

// ============================================================================
// MATRIX MULTIPLICATION SHADER
// ============================================================================

/**
 * Matrix multiplication shader
 *
 * Computes C = A * B where:
 * - A is (M x K) matrix
 * - B is (K x N) matrix
 * - C is (M x N) result matrix
 *
 * ========================================================================
 * WGSL EXPLANATION
 * ========================================================================
 *
 * Workgroup size: (16, 16, 1)
 * - Each workgroup computes a 16x16 tile of the output matrix
 * - Optimal for GPU warp/wavefront size (32 threads)
 * - Balances parallelism with resource usage
 *
 * Memory layout: Row-major order
 * - A[row, k] stored at A[row * K + k]
 * - B[k, col] stored at B[k * N + col]
 * - C[row, col] stored at C[row * N + col]
 *
 * Algorithm: Each thread computes one output element
 * - Thread (i, j) computes C[i, j] = dot(A[i, :], B[:, j])
 * - Requires K multiply-accumulate operations
 *
 * @param M - Number of rows in matrix A (and C)
 * @param K - Number of columns in A, rows in B (inner dimension)
 * @param N - Number of columns in matrix B (and C)
 * @returns WGSL shader source code
 */
export function getMatMulShader(M: number, K: number, N: number): string {
  return `
// ============================================================================
// BUFFER DECLARATIONS
// ============================================================================

// Read-only buffer for matrix A (M x K)
// Storage format: row-major, packed f32 values
@group(0) @binding(0) var<storage, read> A: array<f32>;

// Read-only buffer for matrix B (K x N)
// Storage format: row-major, packed f32 values
@group(0) @binding(1) var<storage, read> B: array<f32>;

// Read-write buffer for output matrix C (M x N)
// Storage format: row-major, packed f32 values
@group(0) @binding(2) var<storage, read_write> C: array<f32>;

// ============================================================================
// COMPUTE SHADER ENTRY POINT
// ============================================================================

// Workgroup size: 16x16 threads per group
// Each thread computes one element of the output matrix
@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  // Extract thread coordinates from global invocation ID
  let row = global_id.x;  // Row index in output matrix (0 to M-1)
  let col = global_id.y;  // Column index in output matrix (0 to N-1)

  // ========================================================================
  // BOUNDARY CHECK
  // ========================================================================
  // GPU launches workgroups in grid, which may exceed matrix dimensions
  // This check prevents out-of-bounds memory access
  if (row >= ${M}u || col >= ${N}u) {
    return;  // Exit early if thread is outside matrix bounds
  }

  // ========================================================================
  // DOT PRODUCT COMPUTATION
  // ========================================================================
  // Compute C[row, col] = sum(A[row, k] * B[k, col]) for k = 0 to K-1
  // This is the standard matrix multiplication algorithm

  var sum: f32 = 0.0;  // Accumulator for dot product

  // Loop over inner dimension K
  for (var k: u32 = 0u; k < ${K}u; k = k + 1u) {
    // Fetch A[row, k] and B[k, col], multiply, and accumulate
    // Memory layout: row-major, so index = row * num_cols + col
    sum = sum + A[row * ${K}u + k] * B[k * ${N}u + col];
  }

  // ========================================================================
  // STORE RESULT
  // ========================================================================
  // Write computed dot product to output matrix
  C[row * ${N}u + col] = sum;
}
`;
}

/**
 * Batched matrix multiplication shader
 *
 * Computes multiple matrix multiplications in parallel.
 * Useful for batch processing.
 */
export function getBatchMatMulShader(
  batchSize: number,
  M: number,
  K: number,
  N: number
): string {
  return `
@group(0) @binding(0) var<storage, read> A: array<f32>;
@group(0) @binding(1) var<storage, read> B: array<f32>;
@group(0) @binding(2) var<storage, read_write> C: array<f32>;

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let batch = global_id.z;
  let row = global_id.x;
  let col = global_id.y;

  // Boundary check
  if (batch >= ${batchSize}u || row >= ${M}u || col >= ${N}u) {
    return;
  }

  let batchOffset = batch * ${M * K}u;
  let batchOffsetB = batch * ${K * N}u;
  let batchOffsetC = batch * ${M * N}u;

  // Compute dot product
  var sum: f32 = 0.0;
  for (var k: u32 = 0u; k < ${K}u; k = k + 1u) {
    sum = sum + A[batchOffset + row * ${K}u + k] * B[batchOffsetB + k * ${N}u + col];
  }

  C[batchOffsetC + row * ${N}u + col] = sum;
}
`;
}

// ============================================================================
// LAYER NORMALIZATION SHADER
// ============================================================================

/**
 * Layer normalization shader
 *
 * Normalizes input along the feature dimension:
 * output = gamma * (input - mean) / sqrt(var + eps) + beta
 */
export function getLayerNormShader(dim: number, eps: number = 1e-5): string {
  return `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read> gamma: array<f32>;
@group(0) @binding(2) var<storage, read> beta: array<f32>;
@group(0) @binding(3) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  // Boundary check
  if (idx >= arrayLength(&input)) {
    return;
  }

  // First pass: compute mean
  var mean: f32 = 0.0;
  let N = ${dim}u;
  for (var i: u32 = 0u; i < N; i = i + 1u) {
    mean = mean + input[i];
  }
  mean = mean / f32(N);

  // Second pass: compute variance
  var variance: f32 = 0.0;
  for (var i: u32 = 0u; i < N; i = i + 1u) {
    let diff = input[i] - mean;
    variance = variance + diff * diff;
  }
  variance = variance / f32(N);

  // Normalize
  let stdDev = sqrt(variance + ${eps});
  output[idx] = gamma[idx] * (input[idx] - mean) / stdDev + beta[idx];
}
`;
}

// ============================================================================
// ATTENTION SHADER
// ============================================================================

/**
 * Scaled dot-product attention shader
 *
 * Computes: attention(Q, K, V) = softmax(Q * K^T / sqrt(d_k)) * V
 *
 * ========================================================================
 * ATTENTION MECHANISM EXPLANATION
 * ========================================================================
 *
 * Multi-head attention is the core of transformer architectures:
 *
 * 1. Queries (Q): "What am I looking for?"
 * 2. Keys (K): "What do I contain?"
 * 3. Values (V): "What is my actual content?"
 *
 * The attention mechanism computes:
 * - For each query, how much it should attend to each key
 * - The weighted sum of values based on those attention weights
 *
 * ========================================================================
 * MEMORY LAYOUT
 * ========================================================================
 *
 * Q, K, V tensors: (seqLen, numHeads, headDim)
 * - Stored as: [(head0_data), (head1_data), ...]
 * - Index: (seq * numHeads + head) * headDim + dim
 *
 * Scores tensor: (seqLen, seqLen, numHeads)
 * - Attention weights before/after softmax
 * - Index: (seq1 * seqLen + seq2) * numHeads + head
 *
 * ========================================================================
 * THREE-PASS COMPUTATION
 * ========================================================================
 *
 * Pass 1: Score Computation
 * - Each thread computes one attention score
 * - score[i, j, h] = Q[i, h] · K[j, h] / sqrt(d)
 *
 * Pass 2: Softmax Normalization
 * - Each thread normalizes one row of scores
 * - softmax(x) = exp(x - max) / sum(exp(x - max))
 *
 * Pass 3: Weighted Value Aggregation
 * - Each thread computes one output dimension
 * - output[i, h, d] = sum_j (attention[i, j, h] * V[j, h, d])
 *
 * @param seqLen - Sequence length (number of tokens)
 * @param numHeads - Number of attention heads (typically 12)
 * @param headDim - Dimension per head (embeddingDim / numHeads)
 * @returns WGSL shader source code
 */
export function getAttentionShader(
  seqLen: number,
  numHeads: number,
  headDim: number
): string {
  return `
// ============================================================================
// STRUCT DEFINITIONS
// ============================================================================

struct AttentionParams {
  seqLen: u32,
  numHeads: u32,
  headDim: u32,
}

// ============================================================================
// BUFFER DECLARATIONS
// ============================================================================

// Queries: (seqLen, numHeads, headDim)
// "What should I attend to?"
@group(0) @binding(0) var<storage, read> Q: array<f32>;

// Keys: (seqLen, numHeads, headDim)
// "What do I contain for matching?"
@group(0) @binding(1) var<storage, read> K: array<f32>;

// Values: (seqLen, numHeads, headDim)
// "What is my content to be aggregated?"
@group(0) @binding(2) var<storage, read> V: array<f32>;

// Output: (seqLen, numHeads, headDim)
// Attention-weighted values
@group(0) @binding(3) var<storage, read_write> output: array<f32>;

// Attention scores: (seqLen, seqLen, numHeads)
// Temporary storage for pre-softmax and post-softmax scores
@group(0) @binding(4) var<storage, read_write> scores: array<f32>;

// ============================================================================
// PASS 1: SCORE COMPUTATION
// ============================================================================

// Compute attention scores: Q · K^T / sqrt(d_k)
// Each thread computes one element of the attention matrix
@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;  // Query index (0 to seqLen-1)
  let j = global_id.y;  // Key index (0 to seqLen-1)
  let h = global_id.z;  // Head index (0 to numHeads-1)

  // ========================================================================
  // BOUNDARY CHECK
  // ========================================================================
  if (i >= ${seqLen}u || j >= ${seqLen}u || h >= ${numHeads}u) {
    return;
  }

  // ========================================================================
  // SCALE FACTOR
  // ========================================================================
  // Scale by 1/sqrt(d_k) to prevent dot products from growing too large
  // This is crucial for training stability and gradient flow
  let scale = 1.0 / sqrt(f32(${headDim}));

  // ========================================================================
  // DOT PRODUCT: Q[i, h, :] · K[j, h, :]
  // ========================================================================
  // Compute similarity between query i and key j in head h
  var score: f32 = 0.0;
  for (var d: u32 = 0u; d < ${headDim}u; d = d + 1u) {
    // Memory layout: (seq * numHeads + head) * headDim + dim
    let qIdx = ((i * ${numHeads}u + h) * ${headDim}u + d);
    let kIdx = ((j * ${numHeads}u + h) * ${headDim}u + d);
    score = score + Q[qIdx] * K[kIdx];
  }
  score = score * scale;  // Apply scaling

  // ========================================================================
  // STORE SCORE FOR SOFTMAX
  // ========================================================================
  // Memory layout: (seq1 * seqLen + seq2) * numHeads + head
  let scoreIdx = ((i * ${seqLen}u + j) * ${numHeads}u + h);
  scores[scoreIdx] = score;
}

// ============================================================================
// PASS 2: SOFTMAX NORMALIZATION
// ============================================================================

// Normalize attention scores using softmax
// Each thread normalizes one row of the attention matrix
@compute @workgroup_size(256, 1, 1)
fn softmax(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let i = global_id.x;  // Query index (row to normalize)
  let h = global_id.y;  // Head index

  // ========================================================================
  // BOUNDARY CHECK
  // ========================================================================
  if (i >= ${seqLen}u || h >= ${numHeads}u) {
    return;
  }

  // ========================================================================
  // FIND MAX FOR NUMERICAL STABILITY
  // ========================================================================
  // softmax(x) = exp(x) / sum(exp(x))
  // To prevent overflow, we compute: exp(x - max) / sum(exp(x - max))
  var maxScore: f32 = -1e9;
  for (var j: u32 = 0u; j < ${seqLen}u; j = j + 1u) {
    let scoreIdx = ((i * ${seqLen}u + j) * ${numHeads}u + h);
    maxScore = max(maxScore, scores[scoreIdx]);
  }

  // ========================================================================
  // COMPUTE EXP AND SUM
  // ========================================================================
  // First pass: compute exp(x - max) for all scores
  var sum: f32 = 0.0;
  for (var j: u32 = 0u; j < ${seqLen}u; j = j + 1u) {
    let scoreIdx = ((i * ${seqLen}u + j) * ${numHeads}u + h);
    let expVal = exp(scores[scoreIdx] - maxScore);
    scores[scoreIdx] = expVal;  // Store exp for normalization
    sum = sum + expVal;
  }

  // ========================================================================
  // NORMALIZE
  // ========================================================================
  // Second pass: divide by sum to get probability distribution
  for (var j: u32 = 0u; j < ${seqLen}u; j = j + 1u) {
    let scoreIdx = ((i * ${seqLen}u + j) * ${numHeads}u + h);
    scores[scoreIdx] = scores[scoreIdx] / sum;
  }

  // ========================================================================
  // PASS 3: WEIGHTED VALUE AGGREGATION
  // ========================================================================
  // Compute output[i, h, d] = sum_j (attention[i, j, h] * V[j, h, d])
  // Each thread computes one dimension of the output for one query/head

  for (var d: u32 = 0u; d < ${headDim}u; d = d + 1u) {
    // Weighted sum of values using attention weights
    var weightedSum: f32 = 0.0;
    for (var j: u32 = 0u; j < ${seqLen}u; j = j + 1u) {
      let scoreIdx = ((i * ${seqLen}u + j) * ${numHeads}u + h);
      let vIdx = ((j * ${numHeads}u + h) * ${headDim}u + d);
      weightedSum = weightedSum + scores[scoreIdx] * V[vIdx];
    }
    let outIdx = ((i * ${numHeads}u + h) * ${headDim}u + d);
    output[outIdx] = weightedSum;
  }
}
`;
}

// ============================================================================
// EMBEDDING SHADERS
// ============================================================================

/**
 * Patch embedding shader for Vision Transformer
 *
 * Extracts patches from image and projects to embeddings.
 */
export function getPatchEmbedShader(
  imgSize: number,
  patchSize: number,
  embedDim: number
): string {
  const numPatches = (imgSize / patchSize) ** 2;
  const patchPixels = patchSize * patchSize * 3; // RGB

  return `
@group(0) @binding(0) var<storage, read> image: array<f32>; // (imgSize, imgSize, 3)
@group(0) @binding(1) var<storage, read> projection: array<f32>; // (patchPixels, embedDim)
@group(0) @binding(2) var<storage, read_write> embeddings: array<f32>; // (numPatches, embedDim)

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let patchIdx = global_id.x;
  let embedIdx = global_id.y;

  // Boundary check
  if (patchIdx >= ${numPatches}u || embedIdx >= ${embedDim}u) {
    return;
  }

  // Extract patch
  let patchRow = patchIdx / ${imgSize / patchSize}u;
  let patchCol = patchIdx % ${imgSize / patchSize}u;

  var dotProduct: f32 = 0.0;
  for (var p: u32 = 0u; p < ${patchPixels}u; p = p + 1u) {
    let pixelRow = patchRow * ${patchSize}u + p / (${patchSize}u * 3u);
    let pixelCol = patchCol * ${patchSize}u + (p % (${patchSize}u * 3u)) / 3u;
    let channel = p % 3u;
    let imgIdx = ((pixelRow * ${imgSize}u + pixelCol) * 3u + channel);

    dotProduct = dotProduct + image[imgIdx] * projection[p * ${embedDim}u + embedIdx];
  }

  embeddings[patchIdx * ${embedDim}u + embedIdx] = dotProduct;
}
`;
}

/**
 * Position embedding shader
 *
 * Adds positional encodings to patch embeddings.
 */
export function getPositionEmbedShader(
  numPatches: number,
  embedDim: number
): string {
  return `
@group(0) @binding(0) var<storage, read> embeddings: array<f32>; // (numPatches, embedDim)
@group(0) @binding(1) var<storage, read> posEmbed: array<f32>; // (numPatches, embedDim)
@group(0) @binding(2) var<storage, read_write> output: array<f32>; // (numPatches, embedDim)

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  // Boundary check
  if (idx >= ${numPatches * embedDim}u) {
    return;
  }

  output[idx] = embeddings[idx] + posEmbed[idx];
}
`;
}

// ============================================================================
// ACTIVATION FUNCTIONS
// ============================================================================

/**
 * GELU activation shader
 *
 * GELU(x) = x * Phi(x) where Phi is the CDF of standard normal distribution.
 * Approximation: GELU(x) = 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
 */
export function getGELUShader(size: number): string {
  return `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  let x = input[idx];
  let cube = x * x * x;
  let tanh_arg = 0.7978845608 * (x + 0.044715 * cube); // sqrt(2/pi) = 0.7978845608
  output[idx] = 0.5 * x * (1.0 + tanh(tanh_arg));
}
`;
}

/**
 * ReLU activation shader
 *
 * ReLU(x) = max(0, x)
 */
export function getReLUInt(size: number): string {
  return `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  output[idx] = max(0.0, input[idx]);
}
`;
}

/**
 * Swish activation shader
 *
 * Swish(x) = x * sigmoid(x)
 */
export function getSwishShader(size: number): string {
  return `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  let x = input[idx];
  output[idx] = x * (1.0 / (1.0 + exp(-x)));
}
`;
}

// ============================================================================
// PREDICTOR SHADERS
// ============================================================================

/**
 * Embedding concatenation shader
 *
 * Concatenates context and intent embeddings.
 */
export function getConcatShader(embedDim: number): string {
  return `
@group(0) @binding(0) var<storage, read> context: array<f32>; // (embedDim,)
@group(0) @binding(1) var<storage, read> intent: array<f32>; // (embedDim,)
@group(0) @binding(2) var<storage, read_write> combined: array<f32>; // (embedDim * 2,)

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${embedDim * 2}u) {
    return;
  }

  if (idx < ${embedDim}u) {
    combined[idx] = context[idx];
  } else {
    combined[idx] = intent[idx - ${embedDim}u];
  }
}
`;
}

/**
 * MLP layer shader (feed-forward network)
 *
 * output = activation(input * weights1 + bias1) * weights2 + bias2
 */
export function getMLPShader(
  inputDim: number,
  hiddenDim: number,
  outputDim: number,
  activation: "gelu" | "relu" | "swish" = "gelu"
): string {
  const activationFn = {
    gelu: "0.5 * x * (1.0 + tanh(0.7978845608 * (x + 0.044715 * x * x * x)))",
    relu: "max(0.0, x)",
    swish: "x * (1.0 / (1.0 + exp(-x)))",
  }[activation];

  return `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read> weights1: array<f32>;
@group(0) @binding(2) var<storage, read> bias1: array<f32>;
@group(0) @binding(3) var<storage, read> weights2: array<f32>;
@group(0) @binding(4) var<storage, read> bias2: array<f32>;
@group(0) @binding(5) var<storage, read_write> output: array<f32>;
@group(0) @binding(6) var<storage, read_write> hidden: array<f32>;

// First layer: input -> hidden
@compute @workgroup_size(256, 1, 1)
fn layer1(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let h = global_id.x;

  if (h >= ${hiddenDim}u) {
    return;
  }

  var sum: f32 = 0.0;
  for (var i: u32 = 0u; i < ${inputDim}u; i = i + 1u) {
    sum = sum + input[i] * weights1[i * ${hiddenDim}u + h];
  }
  let x = sum + bias1[h];
  hidden[h] = ${activationFn};
}

// Second layer: hidden -> output
@compute @workgroup_size(256, 1, 1)
fn layer2(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let o = global_id.x;

  if (o >= ${outputDim}u) {
    return;
  }

  var sum: f32 = 0.0;
  for (var h: u32 = 0u; h < ${hiddenDim}u; h = h + 1u) {
    sum = sum + hidden[h] * weights2[h * ${outputDim}u + o];
  }
  output[o] = sum + bias2[o];
}
`;
}

// ============================================================================
// UTILITY SHADERS
// ============================================================================

/**
 * Element-wise addition shader
 */
export function getAddShader(size: number): string {
  return `
@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  output[idx] = a[idx] + b[idx];
}
`;
}

/**
 * Element-wise multiplication shader
 */
export function getMulShader(size: number): string {
  return `
@group(0) @binding(0) var<storage, read> a: array<f32>;
@group(0) @binding(1) var<storage, read> b: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  output[idx] = a[idx] * b[idx];
}
`;
}

/**
 * Scale shader (multiply by scalar)
 */
export function getScaleShader(size: number): string {
  return `
struct ScaleParams {
  scale: f32,
}

@group(0) @binding(0) var<uniform> params: ScaleParams;
@group(0) @binding(1) var<storage, read> input: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  output[idx] = input[idx] * params.scale;
}
`;
}

/**
 * Copy shader
 */
export function getCopyShader(size: number): string {
  return `
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= ${size}u) {
    return;
  }

  output[idx] = input[idx];
}
`;
}

// ============================================================================
// DEFAULT SHADER INSTANCES
// ============================================================================

/**
 * Default matrix multiplication shader (768x768)
 */
export const DEFAULT_MATMUL_SHADER = getMatMulShader(768, 768, 768);

/**
 * Default layer normalization shader (768-dim)
 */
export const DEFAULT_LAYER_NORM_SHADER = getLayerNormShader(768);

/**
 * Default patch embedding shader (224x224 image, 16x16 patches, 768-dim)
 */
export const DEFAULT_PATCH_EMBED_SHADER = getPatchEmbedShader(224, 16, 768);

/**
 * Default GELU activation shader
 */
export const DEFAULT_GELU_SHADER = getGELUShader(768);

/**
 * Default concatenation shader
 */
export const DEFAULT_CONCAT_SHADER = getConcatShader(768);

/**
 * Default MLP shader (1536 -> 2048 -> 768)
 */
export const DEFAULT_MLP_SHADER = getMLPShader(1536, 2048, 768, "gelu");
