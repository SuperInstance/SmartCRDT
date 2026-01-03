/**
 * ConcatFusion - Simple concatenation-based fusion
 *
 * Concatenates text and visual embeddings followed by
 * a projection to the target dimension.
 */

import type { FusionConfig, FusionResult } from "../types.js";

/**
 * Concatenation fusion strategy
 */
export class ConcatFusion {
  private config: FusionConfig;
  private projectionMatrix: Float32Array | null = null;

  constructor(config: FusionConfig) {
    this.config = config;
  }

  /**
   * Initialize projection matrix
   */
  private initProjection(inputDim: number): void {
    const outputDim = this.config.outputDim;
    this.projectionMatrix = new Float32Array(inputDim * outputDim);

    // Xavier initialization
    const scale = Math.sqrt(2.0 / (inputDim + outputDim));
    for (let i = 0; i < this.projectionMatrix.length; i++) {
      this.projectionMatrix[i] = (Math.random() * 2 - 1) * scale;
    }
  }

  /**
   * Fuse embeddings using concatenation
   */
  fuse(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): FusionResult {
    const textDim = textEmbedding.length;
    const visualDim = visualEmbedding.length;
    const combinedDim = textDim + visualDim;

    // Initialize projection matrix if needed
    if (
      !this.projectionMatrix ||
      this.projectionMatrix.length !== combinedDim * this.config.outputDim
    ) {
      this.initProjection(combinedDim);
    }

    // Concatenate embeddings
    const concatenated = new Float32Array(combinedDim);
    concatenated.set(textEmbedding, 0);
    concatenated.set(visualEmbedding, textDim);

    // Project to output dimension
    const fused = this.project(concatenated);

    // Normalize if configured
    if (this.config.normalize) {
      this.normalizeInPlace(fused);
    }

    // Calculate confidence based on input norms
    const textNorm = this.l2Norm(textEmbedding);
    const visualNorm = this.l2Norm(visualEmbedding);
    const confidence = (textNorm + visualNorm) / 2;

    // Calculate attention weights (equal for concat)
    const attentionWeights = new Map<string, number>();
    attentionWeights.set("text", 0.5);
    attentionWeights.set("visual", 0.5);

    return {
      embedding: fused,
      attentionWeights,
      confidence,
      metadata: {
        model: "concat",
      },
    };
  }

  /**
   * Project vector to output dimension
   */
  private project(input: Float32Array): Float32Array {
    const output = new Float32Array(this.config.outputDim);
    const matrix = this.projectionMatrix!;

    for (let i = 0; i < this.config.outputDim; i++) {
      let sum = 0;
      for (let j = 0; j < input.length; j++) {
        sum += input[j] * matrix[i * input.length + j];
      }
      output[i] = sum;
    }

    return output;
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
