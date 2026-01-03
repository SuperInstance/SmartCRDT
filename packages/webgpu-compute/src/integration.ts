/**
 * @lsi/webgpu-compute/integration - VL-JEPA and Platform Integration
 *
 * Integration layer for WebGPU compute with VL-JEPA and Aequor platform.
 *
 * @version 1.0.0
 */

import type {
  WebGPUContext,
  ComputeResult,
  VLJEPAOpConfig,
  SimilarityMetric,
} from "./types.js";
import { ComputeShaderManager } from "./ComputeShaderManager.js";
import { BufferManager } from "./BufferManager.js";
import { MatMulKernel } from "./kernels/MatMulKernel.js";
import {
  getCosineSimilaritySearchShader,
  getEuclideanDistanceSearchShader,
} from "./shaders/EmbeddingShader.js";
import { getMatMulShader } from "./shaders/MatMulShader.js";

// ============================================================================
// VL-JEPA INTEGRATION
// ============================================================================

/**
 * VL-JEPA GPU Acceleration
 *
 * Provides GPU-accelerated operations for VL-JEPA.
 */
export class VLJEPAGPUAccelerator {
  private context: WebGPUContext;
  private shaderManager: ComputeShaderManager;
  private bufferManager: BufferManager;
  private matMulKernel: MatMulKernel;
  private disposed: boolean = false;

  constructor(context: WebGPUContext) {
    this.context = context;
    this.shaderManager = new ComputeShaderManager(context);
    this.bufferManager = new BufferManager(context);
    this.matMulKernel = new MatMulKernel(context);
  }

  /**
   * Compute embedding similarity search
   *
   * Finds most similar embeddings to a query embedding.
   *
   * @param query - Query embedding (768-dim)
   * @param candidates - Candidate embeddings
   * @param metric - Similarity metric
   * @param topK - Number of top results to return
   * @returns Top K similar embeddings with scores
   */
  async similaritySearch(
    query: Float32Array,
    candidates: Float32Array[],
    metric: SimilarityMetric = "cosine",
    topK: number = 10
  ): Promise<Array<{ index: number; score: number }>> {
    const embeddingDim = query.length;
    const numCandidates = candidates.length;

    if (embeddingDim !== 768) {
      throw new Error(`Query embedding must be 768-dim, got ${embeddingDim}`);
    }

    // Flatten candidates
    const flatCandidates = new Float32Array(numCandidates * embeddingDim);
    for (let i = 0; i < numCandidates; i++) {
      flatCandidates.set(candidates[i], i * embeddingDim);
    }

    // Create buffers
    const bufferQuery = this.bufferManager.createBuffer("vljepa-query", query);
    const bufferCandidates = this.bufferManager.createBuffer(
      "vljepa-candidates",
      flatCandidates
    );
    const bufferSimilarities = this.bufferManager.createStorageBuffer(
      "vljepa-similarities",
      numCandidates * 4
    );

    // Create shader
    const shaderCode =
      metric === "cosine"
        ? getCosineSimilaritySearchShader(embeddingDim, numCandidates)
        : getEuclideanDistanceSearchShader(embeddingDim, numCandidates);

    const shader = await this.shaderManager.createShaderModule(
      "vljepa-sim-shader",
      shaderCode
    );

    // Create pipeline
    const pipeline = this.shaderManager.createComputePipeline(
      "vljepa-sim-pipeline",
      shader
    );

    // Create bind group
    const device = this.context.getDevice();
    const bindGroup = device.createBindGroup({
      layout: pipeline.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: bufferQuery } },
        { binding: 1, resource: { buffer: bufferCandidates } },
        { binding: 2, resource: { buffer: bufferSimilarities } },
      ],
    });

    // Execute
    const result = await this.shaderManager.execute(
      pipeline,
      [bindGroup],
      { x: Math.ceil(numCandidates / 256), y: 1, z: 1 },
      bufferSimilarities,
      numCandidates * 4
    );

    // Cleanup
    this.bufferManager.destroyBuffer("vljepa-query");
    this.bufferManager.destroyBuffer("vljepa-candidates");
    this.bufferManager.destroyBuffer("vljepa-similarities");

    // Get top K
    if (result.success && result.data) {
      const similarities = result.data;
      const indexed = similarities.map((score, index) => ({ score, index }));

      // Sort by score (descending for cosine, ascending for distance)
      indexed.sort((a, b) =>
        metric === "cosine" ? b.score - a.score : a.score - b.score
      );

      return indexed.slice(0, topK);
    }

    return [];
  }

  /**
   * Batch compute embedding similarities
   *
   * Computes pairwise similarities between multiple query embeddings and candidates.
   *
   * @param queries - Query embeddings
   * @param candidates - Candidate embeddings
   * @param metric - Similarity metric
   * @returns Similarity matrix [queries x candidates]
   */
  async batchSimilarity(
    queries: Float32Array[],
    candidates: Float32Array[],
    metric: SimilarityMetric = "cosine"
  ): Promise<Float32Array | null> {
    const embeddingDim = queries[0].length;
    const numQueries = queries.length;
    const numCandidates = candidates.length;

    // Flatten arrays
    const flatQueries = new Float32Array(numQueries * embeddingDim);
    const flatCandidates = new Float32Array(numCandidates * embeddingDim);

    for (let i = 0; i < numQueries; i++) {
      flatQueries.set(queries[i], i * embeddingDim);
    }
    for (let i = 0; i < numCandidates; i++) {
      flatCandidates.set(candidates[i], i * embeddingDim);
    }

    // Create buffers
    const bufferQueries = this.bufferManager.createBuffer(
      "vljepa-queries",
      flatQueries
    );
    const bufferCandidates = this.bufferManager.createBuffer(
      "vljepa-candidates",
      flatCandidates
    );
    const bufferMatrix = this.bufferManager.createStorageBuffer(
      "vljepa-sim-matrix",
      numQueries * numCandidates * 4
    );

    // Create and execute shader
    // ... (implementation similar to similaritySearch but for matrix output)

    return null;
  }

  /**
   * Normalize embeddings to unit length
   *
   * @param embeddings - Embeddings to normalize
   * @returns Normalized embeddings
   */
  async normalizeEmbeddings(
    embeddings: Float32Array[]
  ): Promise<Float32Array[]> {
    // Implementation for L2 normalization
    return embeddings; // Placeholder
  }

  /**
   * Concatenate embeddings
   *
   * @param embeddings - Embeddings to concatenate
   * @returns Concatenated embeddings
   */
  async concatenateEmbeddings(
    ...embeddings: Float32Array[][]
  ): Promise<Float32Array[]> {
    // Implementation for embedding concatenation
    return embeddings[0]; // Placeholder
  }

  /**
   * Project embeddings to different dimension
   *
   * @param embeddings - Input embeddings
   * @param projectionMatrix - Projection matrix
   * @param outputDim - Output dimension
   * @returns Projected embeddings
   */
  async projectEmbeddings(
    embeddings: Float32Array[],
    projectionMatrix: Float32Array,
    outputDim: number
  ): Promise<Float32Array[]> {
    const inputDim = embeddings[0].length;
    const numEmbeddings = embeddings.length;

    // Validate projection matrix size
    if (projectionMatrix.length !== inputDim * outputDim) {
      throw new Error(
        `Projection matrix size mismatch: expected ${inputDim * outputDim}, got ${projectionMatrix.length}`
      );
    }

    const results: Float32Array[] = [];

    for (const embedding of embeddings) {
      // Matrix-vector multiplication: output = projection * embedding
      const result = await this.matMulKernel.multiply(
        projectionMatrix,
        embedding,
        {
          leftMatrix: { rows: outputDim, cols: inputDim },
          rightMatrix: { rows: inputDim, cols: 1 },
        }
      );

      if (result.success && result.data) {
        results.push(result.data);
      }
    }

    return results;
  }

  /**
   * Dispose of accelerator
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.shaderManager.dispose();
    this.bufferManager.dispose();
    this.matMulKernel.dispose();
    this.disposed = true;
  }
}

// ============================================================================
// EMBEDDING CACHE
// ============================================================================

/**
 * GPU-accelerated embedding cache
 *
 * Caches embeddings in GPU memory for fast similarity search.
 */
export class EmbeddingCache {
  private context: WebGPUContext;
  private bufferManager: BufferManager;
  private embeddings: Map<string, Float32Array> = new Map();
  private gpuBuffer: GPUBuffer | null = null;
  private maxCacheSize: number;
  private disposed: boolean = false;

  constructor(context: WebGPUContext, maxCacheSize: number = 10000) {
    this.context = context;
    this.bufferManager = new BufferManager(context);
    this.maxCacheSize = maxCacheSize;
  }

  /**
   * Add embedding to cache
   *
   * @param key - Embedding key
   * @param embedding - Embedding to cache
   */
  add(key: string, embedding: Float32Array): void {
    if (this.embeddings.size >= this.maxCacheSize) {
      // Remove oldest entry (simple FIFO)
      const firstKey = this.embeddings.keys().next().value;
      this.embeddings.delete(firstKey);
    }

    this.embeddings.set(key, embedding);
    this.gpuBuffer = null; // Invalidate GPU buffer
  }

  /**
   * Get embedding from cache
   *
   * @param key - Embedding key
   * @returns Cached embedding or undefined
   */
  get(key: string): Float32Array | undefined {
    return this.embeddings.get(key);
  }

  /**
   * Check if embedding is cached
   *
   * @param key - Embedding key
   * @returns Whether embedding is cached
   */
  has(key: string): boolean {
    return this.embeddings.has(key);
  }

  /**
   * Upload all cached embeddings to GPU
   */
  uploadToGPU(): void {
    if (this.embeddings.size === 0) {
      return;
    }

    const embeddingDim = Array.from(this.embeddings.values())[0].length;
    const numEmbeddings = this.embeddings.size;

    // Flatten embeddings
    const flat = new Float32Array(numEmbeddings * embeddingDim);
    let idx = 0;
    for (const embedding of this.embeddings.values()) {
      flat.set(embedding, idx * embeddingDim);
      idx++;
    }

    // Create GPU buffer
    this.gpuBuffer = this.bufferManager.createBuffer("embedding-cache", flat, {
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Get GPU buffer containing cached embeddings
   *
   * @returns GPU buffer or null
   */
  getGPUBuffer(): GPUBuffer | null {
    return this.gpuBuffer;
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.embeddings.clear();
    if (this.gpuBuffer) {
      this.bufferManager.destroyBuffer("embedding-cache");
      this.gpuBuffer = null;
    }
  }

  /**
   * Get cache size
   *
   * @returns Number of cached embeddings
   */
  size(): number {
    return this.embeddings.size;
  }

  /**
   * Dispose of cache
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.clear();
    this.bufferManager.dispose();
    this.disposed = true;
  }
}

// ============================================================================
// GPU PIPELINE BUILDER
// ============================================================================

/**
 * GPU Pipeline Builder
 *
 * Builds optimized GPU pipelines for specific use cases.
 */
export class GPUPipelineBuilder {
  private context: WebGPUContext;

  constructor(context: WebGPUContext) {
    this.context = context;
  }

  /**
   * Build VL-JEPA pipeline
   *
   * Creates optimized pipeline for VL-JEPA operations.
   *
   * @returns VL-JEPA GPU accelerator
   */
  buildVLJEPAPipeline(): VLJEPAGPUAccelerator {
    return new VLJEPAGPUAccelerator(this.context);
  }

  /**
   * Build embedding cache
   *
   * @param maxCacheSize - Maximum cache size
   * @returns Embedding cache
   */
  buildEmbeddingCache(maxCacheSize: number = 10000): EmbeddingCache {
    return new EmbeddingCache(this.context, maxCacheSize);
  }

  /**
   * Build matrix multiplication kernel
   *
   * @returns MatMul kernel
   */
  buildMatMulKernel(): MatMulKernel {
    return new MatMulKernel(this.context);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create VL-JEPA GPU accelerator
 *
 * @param context - WebGPU context
 * @returns VL-JEPA GPU accelerator instance
 */
export function createVLJEPAGPUAccelerator(
  context: WebGPUContext
): VLJEPAGPUAccelerator {
  return new VLJEPAGPUAccelerator(context);
}

/**
 * Create embedding cache
 *
 * @param context - WebGPU context
 * @param maxCacheSize - Maximum cache size
 * @returns Embedding cache instance
 */
export function createEmbeddingCache(
  context: WebGPUContext,
  maxCacheSize?: number
): EmbeddingCache {
  return new EmbeddingCache(context, maxCacheSize);
}

/**
 * Batch compute cosine similarities
 *
 * Utility function for batch similarity computation.
 *
 * @param queries - Query embeddings
 * @param candidates - Candidate embeddings
 * @param context - WebGPU context
 * @returns Similarity matrix
 */
export async function batchCosineSimilarity(
  queries: Float32Array[],
  candidates: Float32Array[],
  context: WebGPUContext
): Promise<Float32Array | null> {
  const accelerator = new VLJEPAGPUAccelerator(context);
  try {
    return await accelerator.batchSimilarity(queries, candidates, "cosine");
  } finally {
    accelerator.dispose();
  }
}
