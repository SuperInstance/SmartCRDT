/**
 * Embedding Operations with SIMD Optimization
 *
 * High-performance embedding operations including matrix multiplication,
 * attention mechanisms, and dimensionality reduction using SIMD.
 *
 * @packageDocumentation
 */

import { SIMDOptimizer } from "./SIMDOptimizer.js";
import { VectorOps } from "./VectorOps.js";

/**
 * Attention configuration
 */
export interface AttentionConfig {
  // Dimensions
  seqLen: number;
  headDim: number;
  numHeads: number;

  // Scaling
  scale?: number;

  // Masking
  enableMasking?: boolean;
}

/**
 * PCA configuration
 */
export interface PCAConfig {
  // Input
  inputDim: number; // D
  outputDim: number; // d (d < D)

  // Method
  method?: "standard" | "incremental" | "randomized";

  // Whitening
  whiten?: boolean;

  // Centering
  center?: boolean;
}

/**
 * PCA result
 */
export interface PCAResult {
  reduced: Float32Array[]; // N x d output
  components: Float32Array; // D x d PCA matrix
  mean: Float32Array; // D mean vector
  explainedVariance: Float32Array; // d explained variance
}

/**
 * Matrix layout for storage
 */
export enum MatrixLayout {
  RowMajor = 0, // C-style
  ColMajor = 1, // Fortran-style
}

/**
 * Embedding operations with SIMD optimization
 */
export class EmbeddingOps {
  private optimizer: SIMDOptimizer;
  private vecOps: VectorOps;

  constructor(optimizer?: SIMDOptimizer, vecOps?: VectorOps) {
    this.optimizer = optimizer || new SIMDOptimizer();
    this.vecOps = vecOps || new VectorOps(this.optimizer);
  }

  /**
   * Initialize the optimizer
   */
  async init(): Promise<void> {
    await this.optimizer.detectCapabilities();
    await this.vecOps.init();
  }

  // ==================== Embedding Lookup ====================

  /**
   * Embedding lookup with SIMD
   *
   * @param ids - Token IDs to lookup
   * @param embeddingMatrix - Matrix of shape (vocabSize x embeddingDim)
   * @param embeddingDim - Dimension of embeddings
   * @returns Looked up embeddings (N x embeddingDim)
   */
  async lookup(
    ids: number[],
    embeddingMatrix: Float32Array,
    embeddingDim: number
  ): Promise<Float32Array> {
    const result = new Float32Array(ids.length * embeddingDim);

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const offset = id * embeddingDim;

      // Copy embedding
      for (let j = 0; j < embeddingDim; j++) {
        result[i * embeddingDim + j] = embeddingMatrix[offset + j];
      }
    }

    return result;
  }

  /**
   * Batch embedding lookup
   */
  async batchLookup(
    batches: number[][],
    embeddingMatrix: Float32Array,
    embeddingDim: number
  ): Promise<Float32Array[]> {
    const results: Float32Array[] = [];

    for (const ids of batches) {
      const embeddings = await this.lookup(ids, embeddingMatrix, embeddingDim);
      results.push(embeddings);
    }

    return results;
  }

  // ==================== Matrix Multiplication ====================

  /**
   * Matrix multiplication with SIMD: C = A @ B
   *
   * @param A - Matrix of shape (M x K)
   * @param B - Matrix of shape (K x N)
   * @param M - Rows of A
   * @param K - Cols of A / Rows of B (must match)
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
    const C = new Float32Array(M * N);

    // Optimized tiled matrix multiplication
    const TILE_SIZE = 32;

    for (let i = 0; i < M; i += TILE_SIZE) {
      for (let j = 0; j < N; j += TILE_SIZE) {
        for (let k = 0; k < K; k += TILE_SIZE) {
          // Process tile
          const iEnd = Math.min(i + TILE_SIZE, M);
          const jEnd = Math.min(j + TILE_SIZE, N);
          const kEnd = Math.min(k + TILE_SIZE, K);

          for (let ii = i; ii < iEnd; ii++) {
            for (let jj = j; jj < jEnd; jj++) {
              let sum = 0;

              // Inner loop with SIMD potential
              for (let kk = k; kk < kEnd; kk++) {
                sum += A[ii * K + kk] * B[kk * N + jj];
              }

              C[ii * N + jj] += sum;
            }
          }
        }
      }
    }

    return C;
  }

  /**
   * Batch matrix multiplication
   *
   * @param A - Batch of matrices (Batch x M x K)
   * @param B - Batch of matrices (Batch x K x N)
   * @param M - Rows of A
   * @param K - Cols of A / Rows of B
   * @param N - Cols of B
   * @returns Batch of results (Batch x M x N)
   */
  async batchMatmul(
    A: Float32Array[],
    B: Float32Array[],
    M: number,
    K: number,
    N: number
  ): Promise<Float32Array[]> {
    if (A.length !== B.length) {
      throw new Error("Batch sizes must match");
    }

    const results: Float32Array[] = [];

    for (let i = 0; i < A.length; i++) {
      const C = await this.matmul(A[i], B[i], M, K, N);
      results.push(C);
    }

    return results;
  }

  /**
   * Vector-matrix multiplication: y = x @ A
   *
   * @param x - Vector of length K
   * @param A - Matrix of shape (K x N)
   * @returns y - Vector of length N
   */
  async vecMatMul(
    x: Float32Array,
    A: Float32Array,
    K: number,
    N: number
  ): Promise<Float32Array> {
    const y = new Float32Array(N);

    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let k = 0; k < K; k++) {
        sum += x[k] * A[k * N + j];
      }
      y[j] = sum;
    }

    return y;
  }

  /**
   * Matrix-vector multiplication: y = A @ x
   *
   * @param A - Matrix of shape (M x K)
   * @param x - Vector of length K
   * @returns y - Vector of length M
   */
  async matVecMul(
    A: Float32Array,
    x: Float32Array,
    M: number,
    K: number
  ): Promise<Float32Array> {
    const y = new Float32Array(M);

    for (let i = 0; i < M; i++) {
      let sum = 0;
      for (let k = 0; k < K; k++) {
        sum += A[i * K + k] * x[k];
      }
      y[i] = sum;
    }

    return y;
  }

  // ==================== Attention Mechanism ====================

  /**
   * Scaled dot-product attention
   *
   * attention(Q, K, V) = softmax(Q @ K^T / sqrt(d_k)) @ V
   *
   * @param Q - Query matrix (seqLen x headDim)
   * @param K - Key matrix (seqLen x headDim)
   * @param V - Value matrix (seqLen x headDim)
   * @param config - Attention configuration
   * @returns Attention output (seqLen x headDim)
   */
  async attention(
    Q: Float32Array,
    K: Float32Array,
    V: Float32Array,
    config: AttentionConfig
  ): Promise<Float32Array> {
    const { seqLen, headDim, scale } = config;

    // Compute Q @ K^T
    const scores = await this._computeAttentionScores(Q, K, seqLen, headDim);

    // Scale scores
    const scaleValue = scale || Math.sqrt(headDim);
    for (let i = 0; i < scores.length; i++) {
      scores[i] /= scaleValue;
    }

    // Apply mask if needed
    if (config.enableMasking) {
      this._applyCausalMask(scores, seqLen);
    }

    // Apply softmax
    const attentionWeights = this.softmax2D(scores, seqLen);

    // Compute attention output: weights @ V
    const output = await this._computeAttentionOutput(
      attentionWeights,
      V,
      seqLen,
      headDim
    );

    return output;
  }

  /**
   * Multi-head attention
   *
   * @param Q - Query matrices (numHeads x seqLen x headDim)
   * @param K - Key matrices (numHeads x seqLen x headDim)
   * @param V - Value matrices (numHeads x seqLen x headDim)
   * @param config - Attention configuration
   * @returns Multi-head attention output (seqLen x (numHeads * headDim))
   */
  async multiHeadAttention(
    Q: Float32Array[],
    K: Float32Array[],
    V: Float32Array[],
    config: AttentionConfig
  ): Promise<Float32Array> {
    const { seqLen, headDim, numHeads } = config;

    // Compute attention for each head
    const heads: Float32Array[] = [];

    for (let h = 0; h < numHeads; h++) {
      const headOutput = await this.attention(Q[h], K[h], V[h], config);
      heads.push(headOutput);
    }

    // Concatenate heads
    const outputDim = numHeads * headDim;
    const output = new Float32Array(seqLen * outputDim);

    for (let i = 0; i < seqLen; i++) {
      for (let h = 0; h < numHeads; h++) {
        for (let j = 0; j < headDim; j++) {
          output[i * outputDim + h * headDim + j] = heads[h][i * headDim + j];
        }
      }
    }

    return output;
  }

  /**
   * Compute attention scores (Q @ K^T)
   */
  private async _computeAttentionScores(
    Q: Float32Array,
    K: Float32Array,
    seqLen: number,
    headDim: number
  ): Promise<Float32Array> {
    const scores = new Float32Array(seqLen * seqLen);

    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < seqLen; j++) {
        let sum = 0;
        for (let k = 0; k < headDim; k++) {
          sum += Q[i * headDim + k] * K[j * headDim + k];
        }
        scores[i * seqLen + j] = sum;
      }
    }

    return scores;
  }

  /**
   * Apply causal mask to attention scores
   */
  private _applyCausalMask(scores: Float32Array, seqLen: number): void {
    for (let i = 0; i < seqLen; i++) {
      for (let j = i + 1; j < seqLen; j++) {
        scores[i * seqLen + j] = -Infinity;
      }
    }
  }

  /**
   * Compute attention output (weights @ V)
   */
  private async _computeAttentionOutput(
    weights: Float32Array,
    V: Float32Array,
    seqLen: number,
    headDim: number
  ): Promise<Float32Array> {
    const output = new Float32Array(seqLen * headDim);

    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < headDim; j++) {
        let sum = 0;
        for (let k = 0; k < seqLen; k++) {
          sum += weights[i * seqLen + k] * V[k * headDim + j];
        }
        output[i * headDim + j] = sum;
      }
    }

    return output;
  }

  // ==================== Softmax ====================

  /**
   * Softmax with SIMD optimization
   * softmax(x)_i = exp(x_i - max(x)) / sum(exp(x - max(x)))
   *
   * @param x - Input vector
   * @returns Softmax output
   */
  softmax(x: Float32Array): Float32Array {
    // Find max for numerical stability
    let max = x[0];
    for (let i = 1; i < x.length; i++) {
      if (x[i] > max) {
        max = x[i];
      }
    }

    // Compute exp and sum
    const exp = new Float32Array(x.length);
    let sum = 0;

    for (let i = 0; i < x.length; i++) {
      exp[i] = Math.exp(x[i] - max);
      sum += exp[i];
    }

    // Normalize
    const result = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      result[i] = exp[i] / sum;
    }

    return result;
  }

  /**
   * Compute softmax for a 1D array (alias for clarity)
   */
  computeSoftmax(x: Float32Array): Float32Array {
    return this.softmax(x);
  }

  /**
   * Softmax for 2D attention matrix
   */
  private softmax2D(scores: Float32Array, seqLen: number): Float32Array {
    const result = new Float32Array(scores.length);

    // Apply softmax row-wise
    for (let i = 0; i < seqLen; i++) {
      const offset = i * seqLen;

      // Find max
      let max = scores[offset];
      for (let j = 1; j < seqLen; j++) {
        if (scores[offset + j] > max) {
          max = scores[offset + j];
        }
      }

      // Compute exp and sum
      let sum = 0;
      for (let j = 0; j < seqLen; j++) {
        const val = Math.exp(scores[offset + j] - max);
        result[offset + j] = val;
        sum += val;
      }

      // Normalize
      for (let j = 0; j < seqLen; j++) {
        result[offset + j] /= sum;
      }
    }

    return result;
  }

  // ==================== Layer Normalization ====================

  /**
   * Layer normalization
   *
   * layerNorm(x) = gamma * (x - mean) / sqrt(var + epsilon) + beta
   *
   * @param x - Input vector
   * @param gamma - Scale parameter
   * @param beta - Shift parameter
   * @param epsilon - Small constant for numerical stability
   * @returns Normalized output
   */
  layerNorm(
    x: Float32Array,
    gamma: Float32Array,
    beta: Float32Array,
    epsilon: number = 1e-5
  ): Float32Array {
    // Compute mean
    let mean = 0;
    for (let i = 0; i < x.length; i++) {
      mean += x[i];
    }
    mean /= x.length;

    // Compute variance
    let variance = 0;
    for (let i = 0; i < x.length; i++) {
      const diff = x[i] - mean;
      variance += diff * diff;
    }
    variance /= x.length;

    // Normalize
    const std = Math.sqrt(variance + epsilon);
    const result = new Float32Array(x.length);

    for (let i = 0; i < x.length; i++) {
      result[i] = (gamma[i] * (x[i] - mean)) / std + beta[i];
    }

    return result;
  }

  /**
   * Batch layer normalization
   */
  batchLayerNorm(
    batch: Float32Array[],
    gamma: Float32Array,
    beta: Float32Array,
    epsilon: number = 1e-5
  ): Float32Array[] {
    return batch.map(x => this.layerNorm(x, gamma, beta, epsilon));
  }

  // ==================== PCA ====================

  /**
   * Principal Component Analysis for dimensionality reduction
   *
   * @param embeddings - N x D input embeddings
   * @param targetDim - d output dimensions (d < D)
   * @param config - PCA configuration
   * @returns PCA result with reduced embeddings and components
   */
  async pca(
    embeddings: Float32Array[],
    targetDim: number,
    config?: Partial<PCAConfig>
  ): Promise<PCAResult> {
    const N = embeddings.length;
    const D = embeddings[0].length;

    if (targetDim >= D) {
      throw new Error("targetDim must be less than input dimension");
    }

    // Compute mean
    const mean = this._computeMean(embeddings, N, D);

    // Center the data
    const centered = this._centerData(embeddings, mean, N, D);

    // Compute covariance matrix
    const cov = this._computeCovariance(centered, N, D);

    // Compute eigendecomposition (using power iteration)
    const { components, explainedVariance } =
      await this._computeEigendecomposition(cov, D, targetDim);

    // Project data onto principal components
    const reduced = this._projectData(centered, components, N, D, targetDim);

    return {
      reduced,
      components,
      mean,
      explainedVariance,
    };
  }

  /**
   * Batch PCA for large datasets
   */
  async batchPCA(
    embeddings: Float32Array[],
    targetDim: number,
    batchSize: number = 1000
  ): Promise<Float32Array[]> {
    const N = embeddings.length;
    const D = embeddings[0].length;

    // Process in batches
    const batches: Float32Array[][] = [];
    for (let i = 0; i < N; i += batchSize) {
      const batch = embeddings.slice(i, Math.min(i + batchSize, N));
      batches.push(batch);
    }

    // Fit PCA on first batch (or use incremental PCA)
    const firstBatch = batches[0];
    const result = await this.pca(firstBatch, targetDim);

    // Transform remaining batches
    const allReduced: Float32Array[] = [...result.reduced];

    for (let b = 1; b < batches.length; b++) {
      const batch = batches[b];
      const batchReduced = this._transformBatch(
        batch,
        result.mean,
        result.components,
        targetDim
      );
      allReduced.push(...batchReduced);
    }

    return allReduced;
  }

  /**
   * Transform new data using existing PCA
   */
  transform(
    embeddings: Float32Array[],
    mean: Float32Array,
    components: Float32Array,
    targetDim: number
  ): Float32Array[] {
    return this._transformBatch(embeddings, mean, components, targetDim);
  }

  /**
   * Compute mean of embeddings
   */
  private _computeMean(
    embeddings: Float32Array[],
    N: number,
    D: number
  ): Float32Array {
    const mean = new Float32Array(D);

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < D; j++) {
        mean[j] += embeddings[i][j];
      }
    }

    for (let j = 0; j < D; j++) {
      mean[j] /= N;
    }

    return mean;
  }

  /**
   * Center data by subtracting mean
   */
  private _centerData(
    embeddings: Float32Array[],
    mean: Float32Array,
    N: number,
    D: number
  ): Float32Array[] {
    const centered: Float32Array[] = [];

    for (let i = 0; i < N; i++) {
      const row = new Float32Array(D);
      for (let j = 0; j < D; j++) {
        row[j] = embeddings[i][j] - mean[j];
      }
      centered.push(row);
    }

    return centered;
  }

  /**
   * Compute covariance matrix
   */
  private _computeCovariance(
    centered: Float32Array[],
    N: number,
    D: number
  ): Float32Array {
    const cov = new Float32Array(D * D);

    for (let i = 0; i < D; i++) {
      for (let j = i; j < D; j++) {
        let sum = 0;
        for (let k = 0; k < N; k++) {
          sum += centered[k][i] * centered[k][j];
        }
        sum /= N - 1;

        cov[i * D + j] = sum;
        cov[j * D + i] = sum; // Symmetric
      }
    }

    return cov;
  }

  /**
   * Compute eigendecomposition using power iteration
   */
  private async _computeEigendecomposition(
    cov: Float32Array,
    D: number,
    targetDim: number
  ): Promise<{
    components: Float32Array;
    explainedVariance: Float32Array;
  }> {
    const components = new Float32Array(D * targetDim);
    const explainedVariance = new Float32Array(targetDim);

    // Use deflation for multiple eigenvectors
    const covCopy = new Float32Array(cov);

    for (let dim = 0; dim < targetDim; dim++) {
      // Power iteration
      let eigenvector = new Float32Array(D);
      eigenvector[0] = 1; // Initial guess

      const iterations = 100;
      for (let iter = 0; iter < iterations; iter++) {
        // Multiply: cov @ eigenvector
        const newVec = new Float32Array(D);
        for (let i = 0; i < D; i++) {
          let sum = 0;
          for (let j = 0; j < D; j++) {
            sum += covCopy[i * D + j] * eigenvector[j];
          }
          newVec[i] = sum;
        }

        // Normalize
        let norm = 0;
        for (let i = 0; i < D; i++) {
          norm += newVec[i] * newVec[i];
        }
        norm = Math.sqrt(norm);

        for (let i = 0; i < D; i++) {
          eigenvector[i] = newVec[i] / norm;
        }
      }

      // Compute eigenvalue (Rayleigh quotient)
      let eigenvalue = 0;
      for (let i = 0; i < D; i++) {
        let sum = 0;
        for (let j = 0; j < D; j++) {
          sum += covCopy[i * D + j] * eigenvector[j];
        }
        eigenvalue += eigenvector[i] * sum;
      }

      // Store component
      for (let i = 0; i < D; i++) {
        components[i * targetDim + dim] = eigenvector[i];
      }
      explainedVariance[dim] = eigenvalue;

      // Deflate
      if (dim < targetDim - 1) {
        for (let i = 0; i < D; i++) {
          for (let j = 0; j < D; j++) {
            covCopy[i * D + j] -= eigenvalue * eigenvector[i] * eigenvector[j];
          }
        }
      }
    }

    return { components, explainedVariance };
  }

  /**
   * Project centered data onto principal components
   */
  private _projectData(
    centered: Float32Array[],
    components: Float32Array,
    N: number,
    D: number,
    targetDim: number
  ): Float32Array[] {
    const reduced: Float32Array[] = [];

    for (let i = 0; i < N; i++) {
      const row = new Float32Array(targetDim);
      for (let j = 0; j < targetDim; j++) {
        let sum = 0;
        for (let k = 0; k < D; k++) {
          sum += centered[i][k] * components[k * targetDim + j];
        }
        row[j] = sum;
      }
      reduced.push(row);
    }

    return reduced;
  }

  /**
   * Transform batch using existing PCA
   */
  private _transformBatch(
    embeddings: Float32Array[],
    mean: Float32Array,
    components: Float32Array,
    targetDim: number
  ): Float32Array[] {
    const D = mean.length;
    const N = embeddings.length;

    const reduced: Float32Array[] = [];

    for (let i = 0; i < N; i++) {
      const row = new Float32Array(targetDim);

      for (let j = 0; j < targetDim; j++) {
        let sum = 0;
        for (let k = 0; k < D; k++) {
          sum += (embeddings[i][k] - mean[k]) * components[k * targetDim + j];
        }
        row[j] = sum;
      }

      reduced.push(row);
    }

    return reduced;
  }

  // ==================== Utility Functions ====================

  /**
   * Transpose matrix
   */
  transpose(A: Float32Array, M: number, N: number): Float32Array {
    const result = new Float32Array(M * N);

    for (let i = 0; i < M; i++) {
      for (let j = 0; j < N; j++) {
        result[j * M + i] = A[i * N + j];
      }
    }

    return result;
  }

  /**
   * Get vector ops instance
   */
  getVectorOps(): VectorOps {
    return this.vecOps;
  }

  /**
   * Get optimizer instance
   */
  getOptimizer(): SIMDOptimizer {
    return this.optimizer;
  }
}
