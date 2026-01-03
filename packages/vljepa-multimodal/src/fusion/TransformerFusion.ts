/**
 * TransformerFusion - Transformer-based cross-modal fusion
 *
 * Uses a transformer encoder to process concatenated text and
 * visual embeddings with cross-modal attention.
 */

import type { FusionConfig, FusionResult } from "../types.js";

/**
 * Transformer fusion strategy
 */
export class TransformerFusion {
  private config: FusionConfig;
  private numLayers: number;
  private numHeads: number;
  private feedForwardDim: number;
  private layers: TransformerLayer[] = [];

  constructor(config: FusionConfig) {
    this.config = config;
    this.numLayers = config.numLayers || 2;
    this.numHeads = config.numHeads || 8;
    this.feedForwardDim = (config.outputDim || 768) * 4;

    this.initializeLayers();
  }

  /**
   * Initialize transformer layers
   */
  private initializeLayers(): void {
    this.layers = [];
    for (let i = 0; i < this.numLayers; i++) {
      this.layers.push(new TransformerLayer(this.config));
    }
  }

  /**
   * Fuse embeddings using transformer
   */
  fuse(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): FusionResult {
    // Concatenate embeddings as input sequence
    const inputDim = textEmbedding.length + visualEmbedding.length;
    const input = new Float32Array(inputDim);
    input.set(textEmbedding, 0);
    input.set(visualEmbedding, textEmbedding.length);

    // Apply positional encoding
    const positioned = this.addPositionalEncoding(input);

    // Pass through transformer layers
    let hidden = positioned;
    for (const layer of this.layers) {
      hidden = layer.forward(hidden);
    }

    // Pool to output dimension
    const fused = this.pool(hidden);

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
    const confidence = this.calculateConfidence(textEmbedding, visualEmbedding);

    return {
      embedding: fused,
      attentionWeights,
      confidence,
      metadata: {
        model: "transformer",
      },
    };
  }

  /**
   * Add positional encoding
   */
  private addPositionalEncoding(input: Float32Array): Float32Array {
    const output = new Float32Array(input.length);

    for (let i = 0; i < input.length; i++) {
      const pos = i;
      const dim = input.length;

      // Sinusoidal encoding
      const angle = pos / Math.pow(10000, (2 * Math.floor(i / 2)) / dim);
      const encoding = i % 2 === 0 ? Math.sin(angle) : Math.cos(angle);

      output[i] = input[i] + encoding * 0.1; // Scale by 0.1
    }

    return output;
  }

  /**
   * Pool to output dimension
   */
  private pool(input: Float32Array): Float32Array {
    const outputDim = this.config.outputDim;
    const inputDim = input.length;

    // Average pooling if input is larger
    if (inputDim > outputDim) {
      const output = new Float32Array(outputDim);
      const binSize = inputDim / outputDim;

      for (let i = 0; i < outputDim; i++) {
        const start = Math.floor(i * binSize);
        const end = Math.floor((i + 1) * binSize);
        let sum = 0;

        for (let j = start; j < end; j++) {
          sum += input[j];
        }

        output[i] = sum / (end - start);
      }

      return output;
    }

    // Pad if input is smaller
    const output = new Float32Array(outputDim);
    output.set(input);
    return output;
  }

  /**
   * Calculate attention weights
   */
  private calculateAttentionWeights(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): Map<string, number> {
    const textNorm = this.l2Norm(textEmbedding);
    const visualNorm = this.l2Norm(visualEmbedding);
    const total = textNorm + visualNorm;

    const weights = new Map<string, number>();
    weights.set("text", total > 0 ? textNorm / total : 0.5);
    weights.set("visual", total > 0 ? visualNorm / total : 0.5);

    return weights;
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    textEmbedding: Float32Array,
    visualEmbedding: Float32Array
  ): number {
    const textNorm = this.l2Norm(textEmbedding);
    const visualNorm = this.l2Norm(visualEmbedding);

    // Confidence based on norms and balance
    const avgNorm = (textNorm + visualNorm) / 2;
    const balance =
      1 - Math.abs(textNorm - visualNorm) / (textNorm + visualNorm + 1e-8);

    return (avgNorm + balance) / 2;
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

/**
 * Single transformer layer
 */
class TransformerLayer {
  private config: FusionConfig;
  private attention: MultiHeadAttention | null = null;
  private feedForward: FeedForward | null = null;
  private norm1: LayerNorm | null = null;
  private norm2: LayerNorm | null = null;

  constructor(config: FusionConfig) {
    this.config = config;
  }

  /**
   * Forward pass
   */
  forward(input: Float32Array): Float32Array {
    // Initialize components on first use
    if (!this.attention) {
      this.attention = new MultiHeadAttention(this.config);
      this.feedForward = new FeedForward(this.config);
      this.norm1 = new LayerNorm(input.length);
      this.norm2 = new LayerNorm(input.length);
    }

    // Self-attention with residual
    const attnOut = this.attention.forward(input);
    const norm1Out = this.norm1.forward(this.add(input, attnOut));

    // Feed-forward with residual
    const ffOut = this.feedForward.forward(norm1Out);
    const norm2Out = this.norm2.forward(this.add(input, ffOut));

    return norm2Out;
  }

  /**
   * Add two vectors
   */
  private add(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] + b[i];
    }
    return result;
  }
}

/**
 * Multi-head attention
 */
class MultiHeadAttention {
  private config: FusionConfig;
  private numHeads: number;
  private headDim: number;
  private qkvProj: Float32Array | null = null;
  private outProj: Float32Array | null = null;

  constructor(config: FusionConfig) {
    this.config = config;
    this.numHeads = config.numHeads || 8;
    this.headDim = Math.floor((config.outputDim || 768) / this.numHeads);
  }

  /**
   * Forward pass
   */
  forward(input: Float32Array): Float32Array {
    const dim = input.length;

    // Initialize projections
    if (!this.qkvProj) {
      this.qkvProj = this.randomMatrix(dim, dim * 3);
      this.outProj = this.randomMatrix(dim, dim);
    }

    // Project to Q, K, V
    const qkv = this.matmul(input, this.qkvProj);
    const Q = qkv.slice(0, dim);
    const K = qkv.slice(dim, dim * 2);
    const V = qkv.slice(dim * 2);

    // Apply attention
    const output = this.scaledDotProductAttention(Q, K, V);

    // Output projection
    return this.matmul(output, this.outProj);
  }

  /**
   * Scaled dot-product attention
   */
  private scaledDotProductAttention(
    Q: Float32Array,
    K: Float32Array,
    V: Float32Array
  ): Float32Array {
    // For simplicity, treat as single token attention
    const scale = Math.sqrt(Q.length);
    const scores = this.dot(Q, K) / scale;
    const weights = this.scalarSoftmax(scores);
    return this.scale(V, weights);
  }

  /**
   * Dot product
   */
  private dot(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Scalar softmax
   */
  private scalarSoftmax(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Scale vector
   */
  private scale(vec: Float32Array, scalar: number): Float32Array {
    const result = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) {
      result[i] = vec[i] * scalar;
    }
    return result;
  }

  /**
   * Matrix multiplication
   */
  private matmul(vec: Float32Array, matrix: Float32Array): Float32Array {
    const outDim = matrix.length / vec.length;
    const result = new Float32Array(outDim);

    for (let i = 0; i < outDim; i++) {
      let sum = 0;
      for (let j = 0; j < vec.length; j++) {
        sum += vec[j] * matrix[i * vec.length + j];
      }
      result[i] = sum;
    }

    return result;
  }

  /**
   * Random matrix
   */
  private randomMatrix(rows: number, cols: number): Float32Array {
    const matrix = new Float32Array(rows * cols);
    const scale = Math.sqrt(2.0 / (rows + cols));

    for (let i = 0; i < matrix.length; i++) {
      matrix[i] = (Math.random() * 2 - 1) * scale;
    }

    return matrix;
  }
}

/**
 * Feed-forward network
 */
class FeedForward {
  private config: FusionConfig;
  private w1: Float32Array | null = null;
  private w2: Float32Array | null = null;
  private hiddenDim: number;

  constructor(config: FusionConfig) {
    this.config = config;
    this.hiddenDim = (config.outputDim || 768) * 4;
  }

  /**
   * Forward pass
   */
  forward(input: Float32Array): Float32Array {
    const dim = input.length;

    // Initialize weights
    if (!this.w1) {
      this.w1 = this.randomMatrix(dim, this.hiddenDim);
      this.w2 = this.randomMatrix(this.hiddenDim, dim);
    }

    // First layer with GELU
    const hidden = this.gelu(this.matmul(input, this.w1));

    // Second layer
    return this.matmul(hidden, this.w2);
  }

  /**
   * GELU activation
   */
  private gelu(x: Float32Array): Float32Array {
    const result = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const xi = x[i];
      result[i] =
        0.5 *
        xi *
        (1 +
          Math.tanh(Math.sqrt(2 / Math.PI) * (xi + 0.044715 * xi * xi * xi)));
    }
    return result;
  }

  /**
   * Matrix multiplication
   */
  private matmul(vec: Float32Array, matrix: Float32Array): Float32Array {
    const outDim = matrix.length / vec.length;
    const result = new Float32Array(outDim);

    for (let i = 0; i < outDim; i++) {
      let sum = 0;
      for (let j = 0; j < vec.length; j++) {
        sum += vec[j] * matrix[i * vec.length + j];
      }
      result[i] = sum;
    }

    return result;
  }

  /**
   * Random matrix
   */
  private randomMatrix(rows: number, cols: number): Float32Array {
    const matrix = new Float32Array(rows * cols);
    const scale = Math.sqrt(2.0 / (rows + cols));

    for (let i = 0; i < matrix.length; i++) {
      matrix[i] = (Math.random() * 2 - 1) * scale;
    }

    return matrix;
  }
}

/**
 * Layer normalization
 */
class LayerNorm {
  private gamma: Float32Array;
  private beta: Float32Array;
  private epsilon: number = 1e-5;

  constructor(dim: number) {
    this.gamma = new Float32Array(dim).fill(1);
    this.beta = new Float32Array(dim).fill(0);
  }

  /**
   * Forward pass
   */
  forward(input: Float32Array): Float32Array {
    // Calculate mean
    let mean = 0;
    for (let i = 0; i < input.length; i++) {
      mean += input[i];
    }
    mean /= input.length;

    // Calculate variance
    let variance = 0;
    for (let i = 0; i < input.length; i++) {
      variance += (input[i] - mean) ** 2;
    }
    variance /= input.length;

    // Normalize
    const output = new Float32Array(input.length);
    const stdDev = Math.sqrt(variance + this.epsilon);

    for (let i = 0; i < input.length; i++) {
      output[i] = (this.gamma[i] * (input[i] - mean)) / stdDev + this.beta[i];
    }

    return output;
  }
}
