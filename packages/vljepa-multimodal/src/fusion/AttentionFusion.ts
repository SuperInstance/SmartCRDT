/**
 * AttentionFusion - Attention-based fusion
 *
 * Uses multi-head attention to combine text and visual
 * embeddings with learnable attention weights.
 */

import type { FusionConfig, FusionResult } from "../types.js";

/**
 * Attention-based fusion strategy
 */
export class AttentionFusion {
  private config: FusionConfig;
  private numHeads: number;
  private headDim: number;
  private queryWeights: Float32Array | null = null;
  private keyWeights: Float32Array | null = null;
  private valueWeights: Float32Array | null = null;
  private outputWeights: Float32Array | null = null;

  constructor(config: FusionConfig) {
    this.config = config;
    this.numHeads = config.numHeads || 8;
    this.headDim = Math.floor((config.outputDim || 768) / this.numHeads);
  }

  /**
   * Initialize attention weights
   */
  private initWeights(embeddingDim: number): void {
    const outputDim = this.config.outputDim;
    const totalDim = embeddingDim * 2; // text + visual

    // Query, Key, Value projections
    this.queryWeights = this.randomMatrix(totalDim, outputDim);
    this.keyWeights = this.randomMatrix(totalDim, outputDim);
    this.valueWeights = this.randomMatrix(totalDim, outputDim);
    this.outputWeights = this.randomMatrix(outputDim, outputDim);
  }

  /**
   * Create random weight matrix
   */
  private randomMatrix(rows: number, cols: number): Float32Array {
    const matrix = new Float32Array(rows * cols);
    const scale = Math.sqrt(2.0 / (rows + cols));

    for (let i = 0; i < matrix.length; i++) {
      matrix[i] = (Math.random() * 2 - 1) * scale;
    }

    return matrix;
  }

  /**
   * Fuse embeddings using attention
   */
  fuse(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): FusionResult {
    const embeddingDim = textEmbedding.length;

    // Initialize weights if needed
    if (!this.queryWeights) {
      this.initWeights(embeddingDim);
    }

    // Concatenate embeddings
    const concatenated = new Float32Array(embeddingDim * 2);
    concatenated.set(textEmbedding, 0);
    concatenated.set(visualEmbedding, embeddingDim);

    // Apply multi-head attention
    const fused = this.multiHeadAttention(concatenated);

    // Normalize if configured
    if (this.config.normalize) {
      this.normalizeInPlace(fused);
    }

    // Calculate attention weights
    const attentionWeights = this.calculateAttentionWeights(
      textEmbedding,
      visualEmbedding
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(
      textEmbedding,
      visualEmbedding,
      attentionWeights
    );

    return {
      embedding: fused,
      attentionWeights,
      confidence,
      metadata: {
        model: "attention",
      },
    };
  }

  /**
   * Multi-head attention computation
   */
  private multiHeadAttention(input: Float32Array): Float32Array {
    const outputDim = this.config.outputDim;

    // Project to Q, K, V
    const Q = this.matmul1d(input, this.queryWeights!);
    const K = this.matmul1d(input, this.keyWeights!);
    const V = this.matmul1d(input, this.valueWeights!);

    // Reshape for multi-head
    const Qheads = this.reshapeToHeads(Q);
    const Kheads = this.reshapeToHeads(K);
    const Vheads = this.reshapeToHeads(V);

    // Compute attention per head
    const headsOutput: Float32Array[] = [];
    for (let h = 0; h < this.numHeads; h++) {
      const Qh = Qheads[h];
      const Kh = Kheads[h];
      const Vh = Vheads[h];

      // Scaled dot-product attention
      const scores = this.dotProduct(Qh, Kh) / Math.sqrt(this.headDim);
      const weights = this.softmax(scores);
      const headOutput = this.weightedSum(Vh, weights);

      headsOutput.push(headOutput);
    }

    // Concatenate heads
    const concatenated = this.concatHeads(headsOutput);

    // Final output projection
    const output = this.matmul1d(concatenated, this.outputWeights!);

    return output;
  }

  /**
   * Matrix multiplication: 1D vector x 2D matrix
   */
  private matmul1d(vec: Float32Array, matrix: Float32Array): Float32Array {
    const outputDim = matrix.length / vec.length;
    const output = new Float32Array(outputDim);

    for (let i = 0; i < outputDim; i++) {
      let sum = 0;
      for (let j = 0; j < vec.length; j++) {
        sum += vec[j] * matrix[i * vec.length + j];
      }
      output[i] = sum;
    }

    return output;
  }

  /**
   * Reshape vector to multiple heads
   */
  private reshapeToHeads(vec: Float32Array): Float32Array[] {
    const heads: Float32Array[] = [];

    for (let h = 0; h < this.numHeads; h++) {
      const head = new Float32Array(this.headDim);
      const offset = h * this.headDim;
      for (let i = 0; i < this.headDim; i++) {
        head[i] = vec[offset + i];
      }
      heads.push(head);
    }

    return heads;
  }

  /**
   * Dot product of two vectors
   */
  private dotProduct(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Softmax of a scalar
   */
  private softmax(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Weighted sum
   */
  private weightedSum(vec: Float32Array, weight: number): Float32Array {
    const result = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) {
      result[i] = vec[i] * weight;
    }
    return result;
  }

  /**
   * Concatenate heads
   */
  private concatHeads(heads: Float32Array[]): Float32Array {
    const totalDim = heads.length * heads[0].length;
    const result = new Float32Array(totalDim);

    let offset = 0;
    for (const head of heads) {
      result.set(head, offset);
      offset += head.length;
    }

    return result;
  }

  /**
   * Calculate attention weights for each modality
   */
  private calculateAttentionWeights(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): Map<string, number> {
    // Calculate norms as proxy for importance
    const textNorm = this.l2Norm(textEmbedding);
    const visualNorm = this.l2Norm(visualEmbedding);
    const total = textNorm + visualNorm;

    const weights = new Map<string, number>();
    weights.set("text", total > 0 ? textNorm / total : 0.5);
    weights.set("visual", total > 0 ? visualNorm / total : 0.5);

    return weights;
  }

  /**
   * Calculate fusion confidence
   */
  private calculateConfidence(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array,
    attentionWeights: Map<string, number>
  ): number {
    const textWeight = attentionWeights.get("text") || 0.5;
    const visualWeight = attentionWeights.get("visual") || 0.5;

    // Confidence based on balance between modalities
    const balance = 1 - Math.abs(textWeight - visualWeight);
    const textNorm = this.l2Norm(textEmbedding);
    const visualNorm = this.l2Norm(visualEmbedding);

    return (balance + textNorm + visualNorm) / 3;
  }

  /**
   * Calculate L2 norm
   */
  private l2Norm(vec: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
      sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
  }

  /**
   * Normalize vector in place
   */
  private normalizeInPlace(vec: Float32Array): void {
    const norm = this.l2Norm(vec);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) {
        vec[i] /= norm;
      }
    }
  }
}
