/**
 * GPU Embedding Operations with WebGPU/WebGL Compute
 *
 * High-performance embedding operations including matrix multiplication,
 * attention mechanisms, and similarity search using GPU compute shaders.
 *
 * @packageDocumentation
 */

import { GPUDeviceManager, BufferUsage } from "./GPUDevice.js";
import { GPUVectorOps } from "./GPUVectorOps.js";
import {
  EmbeddingOps,
  AttentionConfig,
  PCAConfig,
  PCAResult,
} from "../simd/EmbeddingOps.js";

/**
 * Matrix pair for batch operations
 */
export interface MatrixPair {
  a: Float32Array;
  b: Float32Array;
  m: number; // rows of A
  k: number; // cols of A / rows of B
  n: number; // cols of B
}

/**
 * Neighbor result for similarity search
 */
export interface NeighborResult {
  index: number;
  similarity: number;
  distance: number;
}

/**
 * GPU operation for memory estimation
 */
export interface GPUOperation {
  type: "matmul" | "similarity" | "attention" | "pca";
  dataSize: number;
  parameters: { [key: string]: number };
}

/**
 * GPU benchmark result for embedding operations
 */
export interface GPUBenchmarkResult {
  operation: string;
  backend: string;
  time_ms: number;
  throughput: number;
  memory_mb: number;
  speedup_vs_cpu: number;
}

/**
 * GPU Embedding Operations Class
 *
 * Provides GPU-accelerated embedding operations with automatic fallback
 * to CPU/SIMD when GPU is unavailable.
 */
export class GPUEmbeddingOps {
  private device: GPUDeviceManager;
  private vecOps: GPUVectorOps;
  private cpuFallback: EmbeddingOps;
  private useGPU: boolean;
  private workgroupSize: number = 256;

  // Matrix multiplication shader
  private readonly matmulShader = `
    struct MatmulConfig {
      m: u32,
      n: u32,
      k: u32,
    }

    @group(0) @binding(0) var<uniform> config: MatmulConfig;
    @group(0) @binding(1) var<storage, read> A: array<f32>;
    @group(0) @binding(2) var<storage, read> B: array<f32>;
    @group(0) @binding(3) var<storage, read_write> C: array<f32>;

    @compute @workgroup_size(16, 16, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let row = global_id.x;
      let col = global_id.y;

      if (row >= config.m || col >= config.n) {
        return;
      }

      var sum = 0.0;
      for (var k = 0u; k < config.k; k++) {
        sum += A[row * config.k + k] * B[k * config.n + col];
      }

      C[row * config.n + col] = sum;
    }
  `;

  // Similarity search shader
  private readonly similarityShader = `
    struct SimilarityConfig {
      num_queries: u32,
      num_embeddings: u32,
      embedding_dim: u32,
    }

    @group(0) @binding(0) var<uniform> config: SimilarityConfig;
    @group(0) @binding(1) var<storage, read> queries: array<f32>;
    @group(0) @binding(2) var<storage, read> embeddings: array<f32>;
    @group(0) @binding(3) var<storage, read_write> similarities: array<f32>;

    @compute @workgroup_size(256)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let query_idx = global_id.x;
      let embed_idx = global_id.y;

      if (query_idx >= config.num_queries || embed_idx >= config.num_embeddings) {
        return;
      }

      var dot = 0.0;
      let offset = query_idx * config.embedding_dim;
      let embed_offset = embed_idx * config.embedding_dim;

      for (var i = 0u; i < config.embedding_dim; i++) {
        dot += queries[offset + i] * embeddings[embed_offset + i];
      }

      similarities[query_idx * config.num_embeddings + embed_idx] = dot;
    }
  `;

  // Attention computation shader
  private readonly attentionShader = `
    struct AttentionConfig {
      seq_len: u32,
      head_dim: u32,
    }

    @group(0) @binding(0) var<uniform> config: AttentionConfig;
    @group(0) @binding(1) var<storage, read> Q: array<f32>;
    @group(0) @binding(2) var<storage, read> K: array<f32>;
    @group(0) @binding(3) var<storage, read> V: array<f32>;
    @group(0) @binding(4) var<storage, read_write> output: array<f32>;
    @group(0) @binding(5) var<storage, read_write> scores: array<f32>;

    @compute @workgroup_size(16, 16, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let i = global_id.x;
      let j = global_id.y;

      if (i >= config.seq_len || j >= config.seq_len) {
        return;
      }

      // Compute Q[i] @ K[j]^T
      var dot = 0.0;
      for (var k = 0u; k < config.head_dim; k++) {
        dot += Q[i * config.head_dim + k] * K[j * config.head_dim + k];
      }

      scores[i * config.seq_len + j] = dot / sqrt(f32(config.head_dim));
    }
  `;

  // Transpose shader
  private readonly transposeShader = `
    struct TransposeConfig {
      rows: u32,
      cols: u32,
    }

    @group(0) @binding(0) var<uniform> config: TransposeConfig;
    @group(0) @binding(1) var<storage, read> input: array<f32>;
    @group(0) @binding(2) var<storage, read_write> output: array<f32>;

    @compute @workgroup_size(16, 16, 1)
    fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
      let i = global_id.x;
      let j = global_id.y;

      if (i >= config.rows || j >= config.cols) {
        return;
      }

      output[j * config.rows + i] = input[i * config.cols + j];
    }
  `;

  constructor(
    device: GPUDeviceManager,
    vecOps?: GPUVectorOps,
    cpuFallback?: EmbeddingOps
  ) {
    this.device = device;
    this.vecOps = vecOps || new GPUVectorOps(device);
    this.cpuFallback = cpuFallback || new EmbeddingOps();
    this.useGPU = device.isAvailable();
  }

  /**
   * Initialize GPU embedding operations
   */
  async init(): Promise<void> {
    await this.device.initialize();
    await this.vecOps.init();
    await this.cpuFallback.init();
    this.useGPU = this.device.isAvailable();
  }

  // ==================== Matrix Operations ====================

  /**
   * Matrix multiplication: C = A @ B
   *
   * @param A - Matrix of shape (M x K)
   * @param B - Matrix of shape (K x N)
   * @param M - Rows of A
   * @param K - Cols of A / Rows of B
   * @param N - Cols of B
   * @returns C - Matrix of shape (M x N)
   */
  async matmul(
    A: Float32Array,
    B: Float32Array,
    M: number,
    K: number,
    N: number
  ): Promise<Float32Array> {
    // Use GPU for large matrices
    if (!this.useGPU || M * N * K < 1000000) {
      return this.cpuFallback.matmul(A, B, M, K, N);
    }

    try {
      return await this.executeMatmul(A, B, M, K, N);
    } catch (error) {
      console.warn("GPU matmul failed, falling back to CPU:", error);
      return this.cpuFallback.matmul(A, B, M, K, N);
    }
  }

  /**
   * Transpose matrix
   *
   * @param matrix - Input matrix
   * @param rows - Number of rows
   * @param cols - Number of columns
   * @returns Transposed matrix
   */
  async transpose(
    matrix: Float32Array,
    rows: number,
    cols: number
  ): Promise<Float32Array> {
    if (!this.useGPU || rows * cols < 10000) {
      return this.cpuFallback.transpose(matrix, rows, cols);
    }

    try {
      return await this.executeTranspose(matrix, rows, cols);
    } catch (error) {
      console.warn("GPU transpose failed, falling back to CPU:", error);
      return this.cpuFallback.transpose(matrix, rows, cols);
    }
  }

  // ==================== Embedding Operations ====================

  /**
   * Compute similarity between query and embeddings
   *
   * @param query - Query vector (dim,)
   * @param embeddings - Embedding matrix (N x dim)
   * @returns Similarity scores (N,)
   */
  async computeSimilarity(
    query: Float32Array,
    embeddings: Float32Array[]
  ): Promise<Float32Array> {
    if (!this.useGPU || embeddings.length < 100) {
      // CPU fallback for small batches
      const similarities = new Float32Array(embeddings.length);
      for (let i = 0; i < embeddings.length; i++) {
        similarities[i] = await this.vecOps.cosine(query, embeddings[i]);
      }
      return similarities;
    }

    try {
      return await this.executeBatchSimilarity([query], embeddings);
    } catch (error) {
      console.warn("GPU similarity failed, falling back to CPU:", error);
      const similarities = new Float32Array(embeddings.length);
      for (let i = 0; i < embeddings.length; i++) {
        similarities[i] = await this.vecOps.cosine(query, embeddings[i]);
      }
      return similarities;
    }
  }

  /**
   * Compute similarity for multiple queries
   *
   * @param queries - Query vectors (M x dim)
   * @param embeddings - Embedding matrix (N x dim)
   * @returns Similarity matrix (M x N)
   */
  async computeSimilarityBatch(
    queries: Float32Array[],
    embeddings: Float32Array[]
  ): Promise<Float32Array[]> {
    if (!this.useGPU || queries.length * embeddings.length < 1000) {
      // CPU fallback for small batches
      const results: Float32Array[] = [];
      for (const query of queries) {
        results.push(await this.computeSimilarity(query, embeddings));
      }
      return results;
    }

    try {
      const flatResult = await this.executeBatchSimilarity(queries, embeddings);

      // Reshape result
      const results: Float32Array[] = [];
      for (let i = 0; i < queries.length; i++) {
        const offset = i * embeddings.length;
        results.push(flatResult.slice(offset, offset + embeddings.length));
      }

      return results;
    } catch (error) {
      console.warn("GPU batch similarity failed, falling back to CPU:", error);
      const results: Float32Array[] = [];
      for (const query of queries) {
        results.push(await this.computeSimilarity(query, embeddings));
      }
      return results;
    }
  }

  /**
   * Find k nearest neighbors
   *
   * @param query - Query vector
   * @param embeddings - Embedding vectors
   * @param k - Number of neighbors to return
   * @returns Nearest neighbors
   */
  async findNearest(
    query: Float32Array,
    embeddings: Float32Array[],
    k: number
  ): Promise<NeighborResult[]> {
    const similarities = await this.computeSimilarity(query, embeddings);

    // Verify we got valid similarities
    if (!similarities || similarities.length !== embeddings.length) {
      throw new Error(
        `Invalid similarities array: length ${similarities?.length} vs ${embeddings.length}`
      );
    }

    // Create indexed results
    const results: NeighborResult[] = [];
    for (let idx = 0; idx < similarities.length; idx++) {
      const sim = similarities[idx];
      // Check if similarity is valid
      if (typeof sim === "number" && !isNaN(sim)) {
        // Clamp similarity to [-1, 1] to avoid NaN from sqrt of negative
        const clampedSim = Math.max(-1, Math.min(1, sim));
        results.push({
          index: idx,
          similarity: sim,
          distance: Math.sqrt(1 - clampedSim * clampedSim), // Convert cosine to euclidean
        });
      }
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top k
    return results.slice(0, Math.min(k, results.length));
  }

  // ==================== Attention Computation ====================

  /**
   * Compute attention: attention(Q, K, V) = softmax(Q @ K^T / sqrt(d_k)) @ V
   *
   * @param Q - Query matrix (seqLen x headDim)
   * @param K - Key matrix (seqLen x headDim)
   * @param V - Value matrix (seqLen x headDim)
   * @returns Attention output (seqLen x headDim)
   */
  async computeAttention(
    Q: Float32Array,
    K: Float32Array,
    V: Float32Array,
    config?: Partial<AttentionConfig>
  ): Promise<Float32Array> {
    const seqLen = Math.sqrt(Q.length);
    const headDim = Math.sqrt(Q.length);

    const fullConfig: AttentionConfig = {
      seqLen,
      headDim,
      numHeads: 1,
      scale: Math.sqrt(headDim),
      ...config,
    };

    if (!this.useGPU || seqLen * seqLen * headDim < 1000000) {
      return this.cpuFallback.attention(Q, K, V, fullConfig);
    }

    try {
      return await this.executeAttention(Q, K, V, fullConfig);
    } catch (error) {
      console.warn("GPU attention failed, falling back to CPU:", error);
      return this.cpuFallback.attention(Q, K, V, fullConfig);
    }
  }

  /**
   * Compute attention for multiple queries
   *
   * @param queries - Query matrices
   * @param keys - Key matrices
   * @param values - Value matrices
   * @param config - Attention configuration
   * @returns Attention outputs
   */
  async computeAttentionBatch(
    queries: Float32Array[],
    keys: Float32Array[],
    values: Float32Array[],
    config?: Partial<AttentionConfig>
  ): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    for (let i = 0; i < queries.length; i++) {
      results.push(
        await this.computeAttention(queries[i], keys[i], values[i], config)
      );
    }

    return results;
  }

  // ==================== Dimensionality Reduction ====================

  /**
   * Principal Component Analysis
   *
   * @param embeddings - Input embeddings (N x D)
   * @param components - Number of PCA components
   * @param config - PCA configuration
   * @returns PCA result
   */
  async pca(
    embeddings: Float32Array[],
    components: number,
    config?: Partial<PCAConfig>
  ): Promise<PCAResult> {
    // PCA is typically CPU-bound due to eigendecomposition
    // Use CPU fallback for now
    return this.cpuFallback.pca(embeddings, components, config);
  }

  /**
   * Reduce embedding dimensions
   *
   * @param embedding - Input embedding
   * @param targetDim - Target dimension
   * @returns Reduced embedding
   */
  async reduceDimensions(
    embedding: Float32Array,
    targetDim: number
  ): Promise<Float32Array> {
    if (targetDim >= embedding.length) {
      return embedding;
    }

    // Simple truncation for now
    // In practice, use PCA projection
    return embedding.slice(0, targetDim);
  }

  // ==================== Large-Scale Operations ====================

  /**
   * Batch matrix multiplication
   *
   * @param matrices - Array of matrix pairs
   * @returns Array of results
   */
  async batchMatmul(matrices: MatrixPair[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    for (const { a, b, m, k, n } of matrices) {
      results.push(await this.matmul(a, b, m, k, n));
    }

    return results;
  }

  /**
   * Batch similarity computation
   *
   * @param queries - Query vectors
   * @param embeddings - Embedding vectors
   * @returns Similarity matrix
   */
  async batchSimilarity(
    queries: Float32Array[],
    embeddings: Float32Array[]
  ): Promise<Float32Array[]> {
    return this.computeSimilarityBatch(queries, embeddings);
  }

  // ==================== Performance ====================

  /**
   * Benchmark GPU operation
   *
   * @param operation - Operation to benchmark
   * @param dataSize - Size of test data
   * @returns Benchmark result
   */
  async benchmark(
    operation: string,
    dataSize: number
  ): Promise<GPUBenchmarkResult> {
    const iterations = 10;
    let cpuTime = 0;
    let gpuTime = 0;

    // Generate test data
    const testMatrixA = new Float32Array(dataSize);
    const testMatrixB = new Float32Array(dataSize);
    for (let i = 0; i < dataSize; i++) {
      testMatrixA[i] = Math.random();
      testMatrixB[i] = Math.random();
    }

    // Benchmark GPU
    const size = Math.sqrt(dataSize);
    const gpuStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      switch (operation) {
        case "matmul":
          await this.matmul(testMatrixA, testMatrixB, size, size, size);
          break;
        case "transpose":
          await this.transpose(testMatrixA, size, size);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    }
    gpuTime = performance.now() - gpuStart;

    // Benchmark CPU
    const cpuStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      switch (operation) {
        case "matmul":
          await this.cpuFallback.matmul(
            testMatrixA,
            testMatrixB,
            size,
            size,
            size
          );
          break;
        case "transpose":
          this.cpuFallback.transpose(testMatrixA, size, size);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    }
    cpuTime = performance.now() - cpuStart;

    return {
      operation,
      backend: this.device.getBackend(),
      time_ms: gpuTime,
      throughput: iterations / (gpuTime / 1000),
      memory_mb: this.device.getMemoryUsage() / (1024 * 1024),
      speedup_vs_cpu: cpuTime / gpuTime,
    };
  }

  /**
   * Estimate memory usage for operations
   *
   * @param operations - Array of operations
   * @returns Estimated memory in bytes
   */
  estimateMemoryUsage(operations: GPUOperation[]): number {
    let total = 0;

    for (const op of operations) {
      switch (op.type) {
        case "matmul":
          // A + B + C buffers
          total += op.dataSize * 3 * 4; // 4 bytes per float
          break;
        case "similarity":
          // queries + embeddings + similarities
          total += op.dataSize * 3 * 4;
          break;
        case "attention":
          // Q + K + V + output + scores
          total += op.dataSize * 5 * 4;
          break;
        case "pca":
          // Input + covariance + components + reduced
          total += op.dataSize * 4 * 4;
          break;
      }
    }

    return total;
  }

  // ==================== Private Helper Methods ====================

  /**
   * Execute matrix multiplication on GPU
   */
  private async executeMatmul(
    A: Float32Array,
    B: Float32Array,
    M: number,
    K: number,
    N: number
  ): Promise<Float32Array> {
    if (this.device.getBackend() !== "webgpu") {
      throw new Error("Only WebGPU is supported for compute operations");
    }

    const device = this.device.getDevice()!;

    // Allocate buffers
    const bufferA = this.device.allocateBuffer(
      A.length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferB = this.device.allocateBuffer(
      B.length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferC = this.device.allocateBuffer(
      M * N * 4,
      BufferUsage.Storage | BufferUsage.CopySrc
    );
    const bufferConfig = this.device.allocateBuffer(
      12,
      BufferUsage.Uniform | BufferUsage.CopyDst
    );

    // Write input data
    await bufferA.write(A);
    await bufferB.write(B);

    // Write config
    const configData = new Uint32Array([M, N, K]);
    await bufferConfig.write(new Float32Array(configData.buffer));

    // Create compute pipeline
    const pipeline = this.device.createComputePipeline(
      this.matmulShader,
      "main"
    );

    // Create bind group
    const bindGroup = this.device.createBindGroup(pipeline.bindGroupLayout!, [
      { buffer: bufferConfig.buffer! },
      { buffer: bufferA.buffer! },
      { buffer: bufferB.buffer! },
      { buffer: bufferC.buffer! },
    ]);

    // Encode and submit commands
    const encoder = this.device.beginCommands();
    const passEncoder = encoder.encoder!.beginComputePass();
    passEncoder.setPipeline(pipeline.pipeline as GPUComputePipeline);
    passEncoder.setBindGroup(0, bindGroup.bindGroup as GPUBindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(M / 16), Math.ceil(N / 16));
    passEncoder.end();

    const commandBuffer = encoder.finish();
    this.device.submitCommands(commandBuffer);

    // Read result
    const result = await bufferC.read();

    // Cleanup
    bufferA.destroy();
    bufferB.destroy();
    bufferC.destroy();
    bufferConfig.destroy();

    return result;
  }

  /**
   * Execute transpose on GPU
   */
  private async executeTranspose(
    matrix: Float32Array,
    rows: number,
    cols: number
  ): Promise<Float32Array> {
    if (this.device.getBackend() !== "webgpu") {
      throw new Error("Only WebGPU is supported for compute operations");
    }

    const device = this.device.getDevice()!;

    // Allocate buffers
    const bufferInput = this.device.allocateBuffer(
      matrix.length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferOutput = this.device.allocateBuffer(
      matrix.length * 4,
      BufferUsage.Storage | BufferUsage.CopySrc
    );
    const bufferConfig = this.device.allocateBuffer(
      8,
      BufferUsage.Uniform | BufferUsage.CopyDst
    );

    // Write input data
    await bufferInput.write(matrix);

    // Write config
    const configData = new Uint32Array([rows, cols]);
    await bufferConfig.write(new Float32Array(configData.buffer));

    // Create compute pipeline
    const pipeline = this.device.createComputePipeline(
      this.transposeShader,
      "main"
    );

    // Create bind group
    const bindGroup = this.device.createBindGroup(pipeline.bindGroupLayout!, [
      { buffer: bufferConfig.buffer! },
      { buffer: bufferInput.buffer! },
      { buffer: bufferOutput.buffer! },
    ]);

    // Encode and submit commands
    const encoder = this.device.beginCommands();
    const passEncoder = encoder.encoder!.beginComputePass();
    passEncoder.setPipeline(pipeline.pipeline as GPUComputePipeline);
    passEncoder.setBindGroup(0, bindGroup.bindGroup as GPUBindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(rows / 16), Math.ceil(cols / 16));
    passEncoder.end();

    const commandBuffer = encoder.finish();
    this.device.submitCommands(commandBuffer);

    // Read result
    const result = await bufferOutput.read();

    // Cleanup
    bufferInput.destroy();
    bufferOutput.destroy();
    bufferConfig.destroy();

    return result;
  }

  /**
   * Execute batch similarity on GPU
   */
  private async executeBatchSimilarity(
    queries: Float32Array[],
    embeddings: Float32Array[]
  ): Promise<Float32Array> {
    if (this.device.getBackend() !== "webgpu") {
      throw new Error("Only WebGPU is supported for compute operations");
    }

    const numQueries = queries.length;
    const numEmbeddings = embeddings.length;
    const embeddingDim = queries[0].length;

    // Flatten arrays
    const flatQueries = new Float32Array(numQueries * embeddingDim);
    const flatEmbeddings = new Float32Array(numEmbeddings * embeddingDim);

    for (let i = 0; i < numQueries; i++) {
      flatQueries.set(queries[i], i * embeddingDim);
    }

    for (let i = 0; i < numEmbeddings; i++) {
      flatEmbeddings.set(embeddings[i], i * embeddingDim);
    }

    // Allocate buffers
    const bufferQueries = this.device.allocateBuffer(
      flatQueries.length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferEmbeddings = this.device.allocateBuffer(
      flatEmbeddings.length * 4,
      BufferUsage.Storage | BufferUsage.CopyDst
    );
    const bufferSimilarities = this.device.allocateBuffer(
      numQueries * numEmbeddings * 4,
      BufferUsage.Storage | BufferUsage.CopySrc
    );
    const bufferConfig = this.device.allocateBuffer(
      12,
      BufferUsage.Uniform | BufferUsage.CopyDst
    );

    // Write input data
    await bufferQueries.write(flatQueries);
    await bufferEmbeddings.write(flatEmbeddings);

    // Write config
    const configData = new Uint32Array([
      numQueries,
      numEmbeddings,
      embeddingDim,
    ]);
    await bufferConfig.write(new Float32Array(configData.buffer));

    // Create compute pipeline
    const pipeline = this.device.createComputePipeline(
      this.similarityShader,
      "main"
    );

    // Create bind group
    const bindGroup = this.device.createBindGroup(pipeline.bindGroupLayout!, [
      { buffer: bufferConfig.buffer! },
      { buffer: bufferQueries.buffer! },
      { buffer: bufferEmbeddings.buffer! },
      { buffer: bufferSimilarities.buffer! },
    ]);

    // Encode and submit commands
    const encoder = this.device.beginCommands();
    const passEncoder = encoder.encoder!.beginComputePass();
    passEncoder.setPipeline(pipeline.pipeline as GPUComputePipeline);
    passEncoder.setBindGroup(0, bindGroup.bindGroup as GPUBindGroup);
    passEncoder.dispatchWorkgroups(
      Math.ceil(numQueries / 16),
      Math.ceil(numEmbeddings / 16)
    );
    passEncoder.end();

    const commandBuffer = encoder.finish();
    this.device.submitCommands(commandBuffer);

    // Read result
    const result = await bufferSimilarities.read();

    // Cleanup
    bufferQueries.destroy();
    bufferEmbeddings.destroy();
    bufferSimilarities.destroy();
    bufferConfig.destroy();

    return result;
  }

  /**
   * Execute attention on GPU
   */
  private async executeAttention(
    Q: Float32Array,
    K: Float32Array,
    V: Float32Array,
    config: AttentionConfig
  ): Promise<Float32Array> {
    // For now, use CPU fallback for attention
    // Full GPU attention requires multi-pass computation
    return this.cpuFallback.attention(Q, K, V, config);
  }

  // ==================== Getters ====================

  /**
   * Get CPU fallback instance
   */
  getCPUFallback(): EmbeddingOps {
    return this.cpuFallback;
  }

  /**
   * Get GPU vector ops instance
   */
  getVectorOps(): GPUVectorOps {
    return this.vecOps;
  }

  /**
   * Get GPU device
   */
  getDevice(): GPUDeviceManager {
    return this.device;
  }

  /**
   * Check if GPU is being used
   */
  isUsingGPU(): boolean {
    return this.useGPU;
  }
}

/**
 * Type declarations
 */
interface GPUBindGroup {}
interface GPUComputePipeline {}
interface GPUCommandBuffer {}
