/**
 * GatingFusion - Gated fusion mechanism
 *
 * Uses learnable gates to dynamically weight text and
 * visual contributions based on input content.
 */

import type { FusionConfig, FusionResult } from "../types.js";

/**
 * Gated fusion strategy
 */
export class GatingFusion {
  private config: FusionConfig;
  private gateWeights: Float32Array | null = null;
  private textProjection: Float32Array | null = null;
  private visualProjection: Float32Array | null = null;

  constructor(config: FusionConfig) {
    this.config = config;
  }

  /**
   * Initialize gate weights
   */
  private initWeights(embeddingDim: number): void {
    const outputDim = this.config.outputDim;

    // Gate network: computes weights for text and visual
    this.gateWeights = new Float32Array(embeddingDim * 2);

    // Projections for each modality
    this.textProjection = this.randomMatrix(embeddingDim, outputDim);
    this.visualProjection = this.randomMatrix(embeddingDim, outputDim);

    // Initialize gate with small random values
    for (let i = 0; i < this.gateWeights.length; i++) {
      this.gateWeights[i] = (Math.random() - 0.5) * 0.1;
    }
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
   * Fuse embeddings using gating
   */
  fuse(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): FusionResult {
    const embeddingDim = textEmbedding.length;

    // Initialize weights if needed
    if (!this.gateWeights) {
      this.initWeights(embeddingDim);
    }

    // Compute gate values
    const gate = this.computeGate(textEmbedding, visualEmbedding);
    const textGate = gate[0];
    const visualGate = gate[1];

    // Normalize gates to sum to 1
    const total = textGate + visualGate;
    const normalizedTextGate = total > 0 ? textGate / total : 0.5;
    const normalizedVisualGate = total > 0 ? visualGate / total : 0.5;

    // Project embeddings
    const textProjected = this.matmul1d(textEmbedding, this.textProjection!);
    const visualProjected = this.matmul1d(
      visualEmbedding,
      this.visualProjection!
    );

    // Weight and sum
    const fused = new Float32Array(this.config.outputDim);
    for (let i = 0; i < this.config.outputDim; i++) {
      fused[i] =
        textProjected[i] * normalizedTextGate +
        visualProjected[i] * normalizedVisualGate;
    }

    // Normalize if configured
    if (this.config.normalize) {
      this.normalizeInPlace(fused);
    }

    // Calculate attention weights (using gate values)
    const attentionWeights = new Map<string, number>();
    attentionWeights.set("text", normalizedTextGate);
    attentionWeights.set("visual", normalizedVisualGate);

    // Calculate confidence based on gate distribution
    const confidence = this.calculateConfidence(
      normalizedTextGate,
      normalizedVisualGate
    );

    return {
      embedding: fused,
      attentionWeights,
      confidence,
      metadata: {
        model: "gating",
      },
    };
  }

  /**
   * Compute gate values for text and visual
   */
  private computeGate(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): [number, number] {
    // Concatenate embeddings for gate computation
    const combined = new Float32Array(
      textEmbedding.length + visualEmbedding.length
    );
    combined.set(textEmbedding, 0);
    combined.set(visualEmbedding, textEmbedding.length);

    // Simple gate: compute dot product with learned weights
    const textScore = this.dotProduct(
      combined,
      this.gateWeights!,
      0,
      combined.length / 2
    );
    const visualScore = this.dotProduct(
      combined,
      this.gateWeights!,
      combined.length / 2,
      combined.length
    );

    // Apply sigmoid
    const textGate = this.sigmoid(textScore);
    const visualGate = this.sigmoid(visualScore);

    return [textGate, visualGate];
  }

  /**
   * Dot product with offset
   */
  private dotProduct(
    vec: Float32Array,
    weights: Float32Array,
    offset: number,
    length: number
  ): number {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += vec[i] * weights[offset + i];
    }
    return sum;
  }

  /**
   * Sigmoid activation
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Matrix multiplication: 1D x 2D
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
   * Calculate confidence from gate distribution
   */
  private calculateConfidence(textGate: number, visualGate: number): number {
    // Confidence is higher when gates are balanced
    const balance = 1 - Math.abs(textGate - visualGate);
    const strength = (textGate + visualGate) / 2;

    return (balance + strength) / 2;
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
