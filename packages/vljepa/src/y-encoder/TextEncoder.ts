/**
 * @lsi/vljepa/y-encoder/TextEncoder - Transformer Encoder for Y-Encoder
 *
 * This module implements the Transformer Encoder component of the Y-Encoder.
 * It processes token embeddings through multi-layer self-attention and feed-forward
 * networks to produce contextualized embeddings.
 *
 * ## Architecture
 *
 * 1. **Multi-Head Self-Attention**: 12 heads attending to all positions
 * 2. **Feed-Forward Network**: 2-layer MLP with GELU activation
 * 3. **Layer Normalization**: Pre-layer normalization for stability
 * 4. **Residual Connections**: Skip connections for gradient flow
 *
 * ## Dimensions
 *
 * - Input/Output: 768-dim (matches IntentEncoder)
 * - Hidden/FFN: 3072-dim (4x embedding dim)
 * - Attention Heads: 12 (64 dim each)
 *
 * @see https://arxiv.org/abs/1706.03762 - Attention Is All You Need
 * @version 1.0.0
 */

import type { YEncoderConfig } from "../protocol.js";

/**
 * Attention mechanism configuration
 */
export interface AttentionConfig {
  /** Number of attention heads */
  numHeads: number;

  /** Embedding dimension */
  embeddingDim: number;

  /** Dropout rate */
  dropout?: number;

  /** Whether to use causal mask (not used for encoder) */
  useCausalMask?: boolean;
}

/**
 * Feed-forward network configuration
 */
export interface FeedForwardConfig {
  /** Input dimension */
  inputDim: number;

  /** Hidden dimension (typically 4x input) */
  hiddenDim: number;

  /** Output dimension */
  outputDim: number;

  /** Activation function */
  activation?: "relu" | "gelu" | "swish";

  /** Dropout rate */
  dropout?: number;
}

/**
 * Transformer layer configuration
 */
export interface TransformerLayerConfig {
  /** Embedding dimension */
  embeddingDim: number;

  /** Number of attention heads */
  numHeads: number;

  /** Feed-forward dimension */
  feedForwardDim: number;

  /** Dropout rate */
  dropout?: number;

  /** Activation function */
  activation?: "relu" | "gelu" | "swish";

  /** Whether to use layer normalization */
  useLayerNorm?: boolean;
}

/**
 * Attention output
 */
export interface AttentionOutput {
  /** Output embeddings [seqLen, embeddingDim] */
  output: Float32Array;

  /** Attention weights [numHeads, seqLen, seqLen] */
  attentionWeights?: Float32Array;
}

/**
 * Transformer layer output
 */
export interface LayerOutput {
  /** Output embeddings [seqLen, embeddingDim] */
  output: Float32Array;

  /** Layer output before residual */
  beforeResidual?: Float32Array;
}

/**
 * MultiHeadAttention - Multi-Head Self-Attention Mechanism
 *
 * Implements scaled dot-product attention with multiple heads.
 *
 * ## Formula
 *
 * ```
 * Attention(Q, K, V) = softmax(QK^T / sqrt(d_k)) * V
 * ```
 *
 * Where:
 * - Q (Query) = W_Q * X
 * - K (Key) = W_K * X
 * - V (Value) = W_V * X
 * - d_k = embeddingDim / numHeads
 *
 * @example
 * ```typescript
 * const attention = new MultiHeadAttention({
 *   numHeads: 12,
 *   embeddingDim: 768,
 *   dropout: 0.1
 * });
 *
 * const output = attention.forward(embeddings);
 * ```
 */
export class MultiHeadAttention {
  /** Configuration */
  private config: Required<AttentionConfig>;

  /** Query projection matrix [embeddingDim, embeddingDim] */
  private queryProj: Float32Array;

  /** Key projection matrix [embeddingDim, embeddingDim] */
  private keyProj: Float32Array;

  /** Value projection matrix [embeddingDim, embeddingDim] */
  private valueProj: Float32Array;

  /** Output projection matrix [embeddingDim, embeddingDim] */
  private outputProj: Float32Array;

  /** Head dimension */
  private headDim: number;

  /** Scale factor for attention (1 / sqrt(d_k)) */
  private scale: number;

  /** Whether initialized */
  private initialized: boolean = false;

  /**
   * Create multi-head attention
   *
   * @param config - Attention configuration
   */
  constructor(config: AttentionConfig) {
    this.config = {
      numHeads: config.numHeads,
      embeddingDim: config.embeddingDim,
      dropout: config.dropout ?? 0.1,
      useCausalMask: config.useCausalMask ?? false,
    };

    if (this.config.embeddingDim % this.config.numHeads !== 0) {
      throw new Error(
        `embeddingDim ${this.config.embeddingDim} must be divisible by numHeads ${this.config.numHeads}`
      );
    }

    this.headDim = this.config.embeddingDim / this.config.numHeads;
    this.scale = 1 / Math.sqrt(this.headDim);

    const dim = this.config.embeddingDim;
    this.queryProj = new Float32Array(dim * dim);
    this.keyProj = new Float32Array(dim * dim);
    this.valueProj = new Float32Array(dim * dim);
    this.outputProj = new Float32Array(dim * dim);
  }

  /**
   * Initialize the attention mechanism
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initializeProjection(this.queryProj);
    this.initializeProjection(this.keyProj);
    this.initializeProjection(this.valueProj);
    this.initializeProjection(this.outputProj);

    this.initialized = true;
  }

  /**
   * Forward pass
   *
   * @param embeddings - Input embeddings [seqLen, embeddingDim]
   * @returns Attention output
   */
  forward(embeddings: Float32Array): AttentionOutput {
    if (!this.initialized) {
      this.initialize();
    }

    const seqLen = embeddings.length / this.config.embeddingDim;
    const dim = this.config.embeddingDim;
    const numHeads = this.config.numHeads;
    const headDim = this.headDim;

    // Compute Q, K, V projections
    const queries = this.project(embeddings, this.queryProj);
    const keys = this.project(embeddings, this.keyProj);
    const values = this.project(embeddings, this.valueProj);

    // Reshape for multi-head: [seqLen, numHeads, headDim]
    const queriesMultiHead = this.reshapeForMultiHead(
      queries,
      seqLen,
      numHeads,
      headDim
    );
    const keysMultiHead = this.reshapeForMultiHead(
      keys,
      seqLen,
      numHeads,
      headDim
    );
    const valuesMultiHead = this.reshapeForMultiHead(
      values,
      seqLen,
      numHeads,
      headDim
    );

    // Compute attention scores: [numHeads, seqLen, seqLen]
    const attentionScores = this.computeAttentionScores(
      queriesMultiHead,
      keysMultiHead,
      seqLen,
      numHeads,
      headDim
    );

    // Apply softmax to get attention weights
    const attentionWeights = this.softmax3D(attentionScores, numHeads, seqLen);

    // Apply attention to values: [numHeads, seqLen, headDim]
    const context = this.applyAttention(
      attentionWeights,
      valuesMultiHead,
      seqLen,
      numHeads,
      headDim
    );

    // Reshape back to [seqLen, embeddingDim]
    const contextReshaped = this.reshapeFromMultiHead(
      context,
      seqLen,
      numHeads,
      headDim
    );

    // Output projection
    const output = this.project(contextReshaped, this.outputProj);

    return {
      output,
      attentionWeights: attentionWeights,
    };
  }

  /**
   * Project embeddings using weight matrix
   */
  private project(
    embeddings: Float32Array,
    weights: Float32Array
  ): Float32Array {
    const seqLen = embeddings.length / this.config.embeddingDim;
    const dim = this.config.embeddingDim;
    const output = new Float32Array(seqLen * dim);

    // Matrix multiplication: output[i] = sum(embeddings[i, k] * weights[k, j])
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < dim; j++) {
        let sum = 0;
        for (let k = 0; k < dim; k++) {
          sum += embeddings[i * dim + k] * weights[k * dim + j];
        }
        output[i * dim + j] = sum;
      }
    }

    return output;
  }

  /**
   * Reshape for multi-head attention
   */
  private reshapeForMultiHead(
    embeddings: Float32Array,
    seqLen: number,
    numHeads: number,
    headDim: number
  ): Float32Array {
    const output = new Float32Array(seqLen * numHeads * headDim);

    for (let i = 0; i < seqLen; i++) {
      for (let h = 0; h < numHeads; h++) {
        for (let d = 0; d < headDim; d++) {
          const srcIdx = i * this.config.embeddingDim + h * headDim + d;
          const dstIdx = (h * seqLen + i) * headDim + d;
          output[dstIdx] = embeddings[srcIdx];
        }
      }
    }

    return output;
  }

  /**
   * Reshape from multi-head attention
   */
  private reshapeFromMultiHead(
    embeddings: Float32Array,
    seqLen: number,
    numHeads: number,
    headDim: number
  ): Float32Array {
    const output = new Float32Array(seqLen * this.config.embeddingDim);

    for (let h = 0; h < numHeads; h++) {
      for (let i = 0; i < seqLen; i++) {
        for (let d = 0; d < headDim; d++) {
          const srcIdx = (h * seqLen + i) * headDim + d;
          const dstIdx = i * this.config.embeddingDim + h * headDim + d;
          output[dstIdx] = embeddings[srcIdx];
        }
      }
    }

    return output;
  }

  /**
   * Compute attention scores
   */
  private computeAttentionScores(
    queries: Float32Array,
    keys: Float32Array,
    seqLen: number,
    numHeads: number,
    headDim: number
  ): Float32Array {
    const scores = new Float32Array(numHeads * seqLen * seqLen);

    // scores[h, i, j] = dot(query[h, i], key[h, j])
    for (let h = 0; h < numHeads; h++) {
      for (let i = 0; i < seqLen; i++) {
        for (let j = 0; j < seqLen; j++) {
          let dot = 0;
          const qOffset = (h * seqLen + i) * headDim;
          const kOffset = (h * seqLen + j) * headDim;

          for (let d = 0; d < headDim; d++) {
            dot += queries[qOffset + d] * keys[kOffset + d];
          }

          scores[(h * seqLen + i) * seqLen + j] = dot * this.scale;
        }
      }
    }

    return scores;
  }

  /**
   * Apply attention weights to values
   */
  private applyAttention(
    weights: Float32Array,
    values: Float32Array,
    seqLen: number,
    numHeads: number,
    headDim: number
  ): Float32Array {
    const output = new Float32Array(numHeads * seqLen * headDim);

    // output[h, i, d] = sum(weights[h, i, j] * values[h, j, d])
    for (let h = 0; h < numHeads; h++) {
      for (let i = 0; i < seqLen; i++) {
        for (let d = 0; d < headDim; d++) {
          let sum = 0;
          for (let j = 0; j < seqLen; j++) {
            sum +=
              weights[(h * seqLen + i) * seqLen + j] *
              values[(h * seqLen + j) * headDim + d];
          }
          output[(h * seqLen + i) * headDim + d] = sum;
        }
      }
    }

    return output;
  }

  /**
   * Softmax for 3D tensor
   */
  private softmax3D(
    scores: Float32Array,
    numHeads: number,
    seqLen: number
  ): Float32Array {
    const output = new Float32Array(scores.length);

    for (let h = 0; h < numHeads; h++) {
      for (let i = 0; i < seqLen; i++) {
        // Find max for numerical stability
        let max = -Infinity;
        for (let j = 0; j < seqLen; j++) {
          const idx = (h * seqLen + i) * seqLen + j;
          if (scores[idx] > max) max = scores[idx];
        }

        // Compute exp and sum
        let sum = 0;
        for (let j = 0; j < seqLen; j++) {
          const idx = (h * seqLen + i) * seqLen + j;
          const exp = Math.exp(scores[idx] - max);
          output[idx] = exp;
          sum += exp;
        }

        // Normalize
        for (let j = 0; j < seqLen; j++) {
          const idx = (h * seqLen + i) * seqLen + j;
          output[idx] /= sum;
        }
      }
    }

    return output;
  }

  /**
   * Initialize projection matrix with Xavier initialization
   */
  private initializeProjection(weights: Float32Array): void {
    const dim = this.config.embeddingDim;
    const limit = Math.sqrt(6 / (2 * dim));

    let seed = 42;
    const random = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < weights.length; i++) {
      weights[i] = (random() * 2 - 1) * limit;
    }
  }
}

/**
 * FeedForwardNetwork - Position-wise Feed-Forward Network
 *
 * Two-layer MLP with activation function.
 *
 * ## Formula
 *
 * ```
 * FFN(x) = Activation(x * W1 + b1) * W2 + b2
 * ```
 *
 * Typical hidden dimension is 4x input dimension.
 */
export class FeedForwardNetwork {
  /** Configuration */
  private config: Required<FeedForwardConfig>;

  /** First layer weights [inputDim, hiddenDim] */
  private weights1: Float32Array;

  /** First layer bias [hiddenDim] */
  private bias1: Float32Array;

  /** Second layer weights [hiddenDim, outputDim] */
  private weights2: Float32Array;

  /** Second layer bias [outputDim] */
  private bias2: Float32Array;

  /** Whether initialized */
  private initialized: boolean = false;

  /**
   * Create feed-forward network
   *
   * @param config - Feed-forward configuration
   */
  constructor(config: FeedForwardConfig) {
    this.config = {
      inputDim: config.inputDim,
      hiddenDim: config.hiddenDim,
      outputDim: config.outputDim,
      activation: config.activation ?? "gelu",
      dropout: config.dropout ?? 0.1,
    };

    this.weights1 = new Float32Array(
      this.config.inputDim * this.config.hiddenDim
    );
    this.bias1 = new Float32Array(this.config.hiddenDim);
    this.weights2 = new Float32Array(
      this.config.hiddenDim * this.config.outputDim
    );
    this.bias2 = new Float32Array(this.config.outputDim);
  }

  /**
   * Initialize the network
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initializeWeights();
    this.initialized = true;
  }

  /**
   * Forward pass
   *
   * @param embeddings - Input embeddings [seqLen, inputDim]
   * @returns Output embeddings [seqLen, outputDim]
   */
  forward(embeddings: Float32Array): Float32Array {
    if (!this.initialized) {
      this.initialize();
    }

    const seqLen = embeddings.length / this.config.inputDim;
    const hidden = new Float32Array(seqLen * this.config.hiddenDim);
    const output = new Float32Array(seqLen * this.config.outputDim);

    // First layer: linear + activation
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < this.config.hiddenDim; j++) {
        let sum = this.bias1[j];
        for (let k = 0; k < this.config.inputDim; k++) {
          sum +=
            embeddings[i * this.config.inputDim + k] *
            this.weights1[k * this.config.hiddenDim + j];
        }
        hidden[i * this.config.hiddenDim + j] = this.activation(sum);
      }
    }

    // Second layer: linear
    for (let i = 0; i < seqLen; i++) {
      for (let j = 0; j < this.config.outputDim; j++) {
        let sum = this.bias2[j];
        for (let k = 0; k < this.config.hiddenDim; k++) {
          sum +=
            hidden[i * this.config.hiddenDim + k] *
            this.weights2[k * this.config.outputDim + j];
        }
        output[i * this.config.outputDim + j] = sum;
      }
    }

    return output;
  }

  /**
   * Activation function
   */
  private activation(x: number): number {
    switch (this.config.activation) {
      case "relu":
        return Math.max(0, x);

      case "gelu":
        // GELU approximation: 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
        return (
          0.5 *
          x *
          (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)))
        );

      case "swish":
        // Swish: x * sigmoid(x)
        return x * (1 / (1 + Math.exp(-x)));

      default:
        return x;
    }
  }

  /**
   * Initialize weights with Xavier initialization
   */
  private initializeWeights(): void {
    // First layer
    const limit1 = Math.sqrt(
      6 / (this.config.inputDim + this.config.hiddenDim)
    );
    for (let i = 0; i < this.weights1.length; i++) {
      this.weights1[i] = (Math.random() * 2 - 1) * limit1;
    }
    this.bias1.fill(0);

    // Second layer
    const limit2 = Math.sqrt(
      6 / (this.config.hiddenDim + this.config.outputDim)
    );
    for (let i = 0; i < this.weights2.length; i++) {
      this.weights2[i] = (Math.random() * 2 - 1) * limit2;
    }
    this.bias2.fill(0);
  }
}

/**
 * TransformerEncoderLayer - Single Transformer Layer
 *
 * Combines multi-head self-attention and feed-forward network
 * with residual connections and layer normalization.
 */
export class TransformerEncoderLayer {
  /** Configuration */
  private config: Required<TransformerLayerConfig>;

  /** Multi-head attention */
  private attention: MultiHeadAttention;

  /** Feed-forward network */
  private feedForward: FeedForwardNetwork;

  /** Layer norm 1 gamma */
  private norm1Gamma: Float32Array;

  /** Layer norm 1 beta */
  private norm1Beta: Float32Array;

  /** Layer norm 2 gamma */
  private norm2Gamma: Float32Array;

  /** Layer norm 2 beta */
  private norm2Beta: Float32Array;

  /** Whether initialized */
  private initialized: boolean = false;

  /**
   * Create transformer encoder layer
   *
   * @param config - Layer configuration
   */
  constructor(config: TransformerLayerConfig) {
    this.config = {
      embeddingDim: config.embeddingDim,
      numHeads: config.numHeads,
      feedForwardDim: config.feedForwardDim,
      dropout: config.dropout ?? 0.1,
      activation: config.activation ?? "gelu",
      useLayerNorm: config.useLayerNorm ?? true,
    };

    this.attention = new MultiHeadAttention({
      numHeads: this.config.numHeads,
      embeddingDim: this.config.embeddingDim,
      dropout: this.config.dropout,
    });

    this.feedForward = new FeedForwardNetwork({
      inputDim: this.config.embeddingDim,
      hiddenDim: this.config.feedForwardDim,
      outputDim: this.config.embeddingDim,
      activation: this.config.activation,
      dropout: this.config.dropout,
    });

    const dim = this.config.embeddingDim;
    this.norm1Gamma = new Float32Array(dim).fill(1);
    this.norm1Beta = new Float32Array(dim).fill(0);
    this.norm2Gamma = new Float32Array(dim).fill(1);
    this.norm2Beta = new Float32Array(dim).fill(0);
  }

  /**
   * Initialize the layer
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    this.attention.initialize();
    this.feedForward.initialize();
    this.initialized = true;
  }

  /**
   * Forward pass
   *
   * @param embeddings - Input embeddings [seqLen, embeddingDim]
   * @returns Output embeddings [seqLen, embeddingDim]
   */
  forward(embeddings: Float32Array): LayerOutput {
    if (!this.initialized) {
      this.initialize();
    }

    const seqLen = embeddings.length / this.config.embeddingDim;

    // Self-attention with residual
    const attnOut = this.attention.forward(embeddings);
    const attnWithResidual = new Float32Array(embeddings.length);
    for (let i = 0; i < embeddings.length; i++) {
      attnWithResidual[i] = embeddings[i] + attnOut.output[i];
    }

    // Layer norm 1
    const norm1Out = this.layerNorm(
      attnWithResidual,
      this.norm1Gamma,
      this.norm1Beta,
      seqLen
    );

    // Feed-forward with residual
    const ffOut = this.feedForward.forward(norm1Out);
    const ffWithResidual = new Float32Array(norm1Out.length);
    for (let i = 0; i < norm1Out.length; i++) {
      ffWithResidual[i] = norm1Out[i] + ffOut[i];
    }

    // Layer norm 2
    const output = this.layerNorm(
      ffWithResidual,
      this.norm2Gamma,
      this.norm2Beta,
      seqLen
    );

    return { output };
  }

  /**
   * Layer normalization
   */
  private layerNorm(
    x: Float32Array,
    gamma: Float32Array,
    beta: Float32Array,
    seqLen: number
  ): Float32Array {
    const output = new Float32Array(x.length);
    const dim = this.config.embeddingDim;

    for (let i = 0; i < seqLen; i++) {
      const offset = i * dim;

      // Compute mean
      let mean = 0;
      for (let j = 0; j < dim; j++) {
        mean += x[offset + j];
      }
      mean /= dim;

      // Compute variance
      let variance = 0;
      for (let j = 0; j < dim; j++) {
        const diff = x[offset + j] - mean;
        variance += diff * diff;
      }
      variance /= dim;

      // Normalize
      const std = Math.sqrt(variance + 1e-6);
      for (let j = 0; j < dim; j++) {
        output[offset + j] =
          gamma[j] * ((x[offset + j] - mean) / std) + beta[j];
      }
    }

    return output;
  }
}

/**
 * TextEncoder - Full Transformer Encoder
 *
 * Stacks multiple transformer encoder layers to produce
 * contextualized embeddings for text input.
 *
 * @example
 * ```typescript
 * const encoder = new TextEncoder({
 *   embeddingDim: 768,
 *   numLayers: 12,
 *   numHeads: 12,
 *   feedForwardDim: 3072
 * });
 *
 * const output = encoder.forward(embeddings);
 * ```
 */
export class TextEncoder {
  /** Configuration */
  private config: Required<TransformerLayerConfig>;

  /** Transformer layers */
  private layers: TransformerEncoderLayer[];

  /** Number of layers */
  private numLayers: number;

  /** Whether initialized */
  private initialized: boolean = false;

  /**
   * Create text encoder
   *
   * @param numLayers - Number of transformer layers
   * @param config - Layer configuration
   */
  constructor(numLayers: number, config: TransformerLayerConfig) {
    this.numLayers = numLayers;
    this.config = {
      embeddingDim: config.embeddingDim,
      numHeads: config.numHeads,
      feedForwardDim: config.feedForwardDim,
      dropout: config.dropout ?? 0.1,
      activation: config.activation ?? "gelu",
      useLayerNorm: config.useLayerNorm ?? true,
    };

    this.layers = [];
    for (let i = 0; i < this.numLayers; i++) {
      this.layers.push(new TransformerEncoderLayer(this.config));
    }
  }

  /**
   * Initialize the encoder
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    for (const layer of this.layers) {
      layer.initialize();
    }

    this.initialized = true;
  }

  /**
   * Forward pass through all layers
   *
   * @param embeddings - Input embeddings [seqLen, embeddingDim]
   * @returns Output embeddings [seqLen, embeddingDim]
   */
  forward(embeddings: Float32Array): Float32Array {
    if (!this.initialized) {
      this.initialize();
    }

    let output = embeddings;

    for (const layer of this.layers) {
      const layerOut = layer.forward(output);
      output = layerOut.output;
    }

    return output;
  }

  /**
   * Get the number of layers
   */
  getNumLayers(): number {
    return this.numLayers;
  }

  /**
   * Get the embedding dimension
   */
  getEmbeddingDim(): number {
    return this.config.embeddingDim;
  }
}

/**
 * Create a text encoder from Y-Encoder configuration
 *
 * @param config - Y-Encoder configuration
 * @returns Text encoder
 */
export function createTextEncoder(config: YEncoderConfig): TextEncoder {
  const numLayers = config.numLayers ?? 12;
  const numHeads = config.numHeads ?? 12;
  const feedForwardDim = config.feedForwardDim ?? config.embeddingDim * 4;

  return new TextEncoder(numLayers, {
    embeddingDim: config.embeddingDim,
    numHeads,
    feedForwardDim,
    dropout: config.dropout,
    activation: "gelu",
    useLayerNorm: config.useLayerNorm ?? true,
  });
}
