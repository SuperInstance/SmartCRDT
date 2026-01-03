/**
 * Vision Transformer (ViT) for X-Encoder
 *
 * Implements the Vision Transformer architecture for processing visual input.
 * Uses multi-head self-attention to process patch embeddings and extract
 * semantic visual features.
 *
 * ========================================================================
 * ARCHITECTURE OVERVIEW
 * ========================================================================
 *
 * The Vision Transformer (ViT) adapts the transformer architecture (originally
 * for NLP) to work with images by treating image patches as "tokens".
 *
 * 1. INPUT: Patch embeddings with positional encoding
 *    - Shape: (numTokens, embeddingDim) where numTokens = numPatches + 1 (CLS)
 *    - Example: (197, 768) for 224x224 image with 16x16 patches
 *
 * 2. TRANSFORMER LAYERS (typically 12)
 *    Each layer contains:
 *    - Multi-Head Self-Attention (MHA): Allows each patch to attend to all patches
 *    - Feed-Forward Network (FFN): Non-linear transformation per patch
 *    - Layer Normalization: Stabilizes training
 *    - Residual Connections: Enables gradient flow
 *
 * 3. OUTPUT: Processed CLS token embedding
 *    - The CLS token (index 0) aggregates global information
 *    - After attending to all patches, it represents the whole image
 *    - Shape: (embeddingDim) = (768,)
 *
 * ========================================================================
 * MULTI-HEAD ATTENTION EXPLAINED
 * ========================================================================
 *
 * Self-attention allows each patch to "look at" all other patches and decide
 * which ones are relevant. Multi-head attention computes multiple types of
 * relationships in parallel.
 *
 * For each head h (1 to 12):
 *   1. Compute Query (Q): "What am I looking for?"
 *   2. Compute Key (K): "What do I contain?"
 *   3. Compute Value (V): "What is my content?"
 *
 * Attention = softmax(Q * K^T / sqrt(d)) * V
 *
 * Example: A patch containing "button text" might attend strongly to:
 * - Head 1: Color patches (for contrast)
 * - Head 2: Shape patches (for boundary)
 * - Head 3: Position patches (for layout)
 *
 * The 12 heads learn different relationship types!
 *
 * ========================================================================
 * FEED-FORWARD NETWORK
 * ========================================================================
 *
 * After attention, each patch is processed independently through an FFN:
 *
 * FFN(x) = GELU(x * W1 + b1) * W2 + b2
 *
 * Where:
 * - x: 768-dim patch embedding
 * - W1: 768 → 3072 expansion (4x)
 * - GELU: Smooth activation (better than ReLU)
 * - W2: 3072 → 768 contraction
 *
 * This adds non-linearity and capacity per patch.
 *
 * ========================================================================
 * RESIDUAL CONNECTIONS & LAYER NORMALIZATION
 * ========================================================================
 *
 * Each transformer layer uses:
 *
 * 1. Residual (Skip) Connections
 *    output = input + sublayer(input)
 *    - Prevents vanishing gradients
 *    - Allows gradient to flow directly
 *    - Enables training very deep networks
 *
 * 2. Layer Normalization
 *    output = gamma * (input - mean) / std + beta
 *    - Normalizes per patch (not batch)
 *    - Stabilizes training
 *    - Learnable scale (gamma) and shift (beta)
 *
 * Full layer:
 *    x = x + MHA(LayerNorm(x))      # Attention with residual
 *    x = x + FFN(LayerNorm(x))      # FFN with residual
 *
 * Based on:
 * - "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale" (Dosovitskiy et al., 2020)
 * - https://arxiv.org/abs/2010.11929
 *
 * @packageDocumentation
 */

import type { XEncoderConfig } from "../protocol.js";

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
  dropout: number;
}

/**
 * Vision Transformer configuration
 */
export interface VisionTransformerConfig {
  /** Embedding dimension (default: 768) */
  embeddingDim: number;
  /** Number of transformer layers */
  numLayers: number;
  /** Number of attention heads */
  numHeads: number;
  /** Feed-forward dimension */
  feedForwardDim: number;
  /** Dropout rate */
  dropout: number;
}

/**
 * Transformer forward pass output
 */
export interface TransformerOutput {
  /** Processed embeddings (numTokens, embeddingDim) */
  embeddings: Float32Array;
  /** CLS token embedding only (embeddingDim,) */
  clsToken: Float32Array;
  /** Attention weights (for visualization) */
  attentionWeights?: Float32Array[];
}

/**
 * Multi-Head Self-Attention
 *
 * Splits the embedding into multiple heads, computes attention for each,
 * then concatenates the results.
 */
export class MultiHeadAttention {
  private embeddingDim: number;
  private numHeads: number;
  private headDim: number;
  private dropout: number;

  // QKV projection weights
  private qWeights: Float32Array;
  private kWeights: Float32Array;
  private vWeights: Float32Array;

  // Output projection weights
  private outWeights: Float32Array;

  constructor(config: TransformerLayerConfig) {
    this.embeddingDim = config.embeddingDim;
    this.numHeads = config.numHeads;
    this.headDim = config.embeddingDim / config.numHeads;
    this.dropout = config.dropout;

    // Validate head dimension divides evenly
    if (this.embeddingDim % this.numHeads !== 0) {
      throw new Error(
        `Embedding dimension ${this.embeddingDim} must be divisible by ` +
          `number of heads ${this.numHeads}`
      );
    }

    // Initialize QKV projection weights
    this.qWeights = this.initWeights(config.embeddingDim, config.embeddingDim);
    this.kWeights = this.initWeights(config.embeddingDim, config.embeddingDim);
    this.vWeights = this.initWeights(config.embeddingDim, config.embeddingDim);

    // Initialize output projection weights
    this.outWeights = this.initWeights(
      config.embeddingDim,
      config.embeddingDim
    );
  }

  /**
   * Forward pass: compute multi-head attention
   *
   * @param embeddings - Input embeddings (numTokens, embeddingDim)
   * @returns Output embeddings (numTokens, embeddingDim)
   */
  forward(embeddings: Float32Array): Float32Array {
    const numTokens = embeddings.length / this.embeddingDim;

    // Project to Q, K, V
    const q = this.project(embeddings, this.qWeights); // (numTokens, embeddingDim)
    const k = this.project(embeddings, this.kWeights);
    const v = this.project(embeddings, this.vWeights);

    // Reshape into heads and transpose
    const qHeads = this.reshapeToHeads(q); // (numHeads, numTokens, headDim)
    const kHeads = this.reshapeToHeads(k);
    const vHeads = this.reshapeToHeads(v);

    // Compute attention for each head
    const headOutputs: Float32Array[] = [];
    for (let h = 0; h < this.numHeads; h++) {
      const qHead = this.getHead(qHeads, h, numTokens);
      const kHead = this.getHead(kHeads, h, numTokens);
      const vHead = this.getHead(vHeads, h, numTokens);

      const headOutput = this.computeAttention(qHead, kHead, vHead);
      headOutputs.push(headOutput);
    }

    // Concatenate heads
    const concatenated = this.concatenateHeads(headOutputs, numTokens);

    // Output projection
    const output = this.project(concatenated, this.outWeights);

    return output;
  }

  /**
   * Compute scaled dot-product attention
   */
  private computeAttention(
    q: Float32Array,
    k: Float32Array,
    v: Float32Array
  ): Float32Array {
    const numTokens = q.length / this.headDim;

    // Compute attention scores: Q @ K.T / sqrt(d_k)
    const scores = new Float32Array(numTokens * numTokens);
    const scale = Math.sqrt(this.headDim);

    for (let i = 0; i < numTokens; i++) {
      for (let j = 0; j < numTokens; j++) {
        let dot = 0;
        for (let d = 0; d < this.headDim; d++) {
          dot += q[i * this.headDim + d] * k[j * this.headDim + d];
        }
        scores[i * numTokens + j] = dot / scale;
      }
    }

    // Softmax over scores
    const attentionWeights = this.softmax(scores, numTokens);

    // Apply attention to V: attention_weights @ V
    const output = new Float32Array(numTokens * this.headDim);
    for (let i = 0; i < numTokens; i++) {
      for (let d = 0; d < this.headDim; d++) {
        let sum = 0;
        for (let j = 0; j < numTokens; j++) {
          sum += attentionWeights[i * numTokens + j] * v[j * this.headDim + d];
        }
        output[i * this.headDim + d] = sum;
      }
    }

    return output;
  }

  /**
   * Reshape embeddings into head dimension
   */
  private reshapeToHeads(embeddings: Float32Array): Float32Array {
    const numTokens = embeddings.length / this.embeddingDim;
    const reshaped = new Float32Array(this.numHeads * numTokens * this.headDim);

    for (let h = 0; h < this.numHeads; h++) {
      for (let t = 0; t < numTokens; t++) {
        for (let d = 0; d < this.headDim; d++) {
          const srcIdx = t * this.embeddingDim + h * this.headDim + d;
          const dstIdx = h * numTokens * this.headDim + t * this.headDim + d;
          reshaped[dstIdx] = embeddings[srcIdx];
        }
      }
    }

    return reshaped;
  }

  /**
   * Extract specific head from reshaped embeddings
   */
  private getHead(
    reshaped: Float32Array,
    headIdx: number,
    numTokens: number
  ): Float32Array {
    const head = new Float32Array(numTokens * this.headDim);
    const startIdx = headIdx * numTokens * this.headDim;
    head.set(reshaped.subarray(startIdx, startIdx + numTokens * this.headDim));
    return head;
  }

  /**
   * Concatenate heads back to full dimension
   */
  private concatenateHeads(
    heads: Float32Array[],
    numTokens: number
  ): Float32Array {
    const concatenated = new Float32Array(numTokens * this.embeddingDim);

    for (let h = 0; h < this.numHeads; h++) {
      for (let t = 0; t < numTokens; t++) {
        for (let d = 0; d < this.headDim; d++) {
          const srcIdx = t * this.headDim + d;
          const dstIdx = t * this.embeddingDim + h * this.headDim + d;
          concatenated[dstIdx] = heads[h][srcIdx];
        }
      }
    }

    return concatenated;
  }

  /**
   * Project embeddings using weights
   */
  private project(
    embeddings: Float32Array,
    weights: Float32Array
  ): Float32Array {
    const numTokens = embeddings.length / this.embeddingDim;
    const output = new Float32Array(numTokens * this.embeddingDim);

    for (let t = 0; t < numTokens; t++) {
      for (let o = 0; o < this.embeddingDim; o++) {
        let sum = 0;
        for (let i = 0; i < this.embeddingDim; i++) {
          sum +=
            embeddings[t * this.embeddingDim + i] *
            weights[o * this.embeddingDim + i];
        }
        output[t * this.embeddingDim + o] = sum;
      }
    }

    return output;
  }

  /**
   * Softmax with temperature scaling
   */
  private softmax(logits: Float32Array, numTokens: number): Float32Array {
    const probs = new Float32Array(logits.length);

    for (let i = 0; i < numTokens; i++) {
      const startIdx = i * numTokens;
      const endIdx = startIdx + numTokens;

      // Find max for numerical stability
      let max = -Infinity;
      for (let j = startIdx; j < endIdx; j++) {
        if (logits[j] > max) max = logits[j];
      }

      // Compute exp and sum
      let sum = 0;
      for (let j = startIdx; j < endIdx; j++) {
        probs[j] = Math.exp(logits[j] - max);
        sum += probs[j];
      }

      // Normalize
      for (let j = startIdx; j < endIdx; j++) {
        probs[j] /= sum;
      }
    }

    return probs;
  }

  /**
   * Initialize weights using Xavier initialization
   */
  private initWeights(outputDim: number, inputDim: number): Float32Array {
    const weights = new Float32Array(outputDim * inputDim);
    const scale = Math.sqrt(2.0 / (inputDim + outputDim));

    for (let i = 0; i < weights.length; i++) {
      weights[i] = this.gaussianRandom() * scale;
    }

    return weights;
  }

  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const safeU1 = Math.max(u1, 1e-10);
    return Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

/**
 * Feed-Forward Network
 *
 * Two-layer MLP with GELU activation.
 */
export class FeedForwardNetwork {
  private embeddingDim: number;
  private feedForwardDim: number;

  // Layer weights
  private fc1Weights: Float32Array;
  private fc2Weights: Float32Array;

  constructor(config: TransformerLayerConfig) {
    this.embeddingDim = config.embeddingDim;
    this.feedForwardDim = config.feedForwardDim;

    // Initialize layer weights
    this.fc1Weights = this.initWeights(
      config.feedForwardDim,
      config.embeddingDim
    );
    this.fc2Weights = this.initWeights(
      config.embeddingDim,
      config.feedForwardDim
    );
  }

  /**
   * Forward pass: FFN(x) = GELU(x @ W1) @ W2
   */
  forward(embeddings: Float32Array): Float32Array {
    const numTokens = embeddings.length / this.embeddingDim;

    // First layer: expand to feedForwardDim
    const hidden = new Float32Array(numTokens * this.feedForwardDim);
    for (let t = 0; t < numTokens; t++) {
      for (let o = 0; o < this.feedForwardDim; o++) {
        let sum = 0;
        for (let i = 0; i < this.embeddingDim; i++) {
          sum +=
            embeddings[t * this.embeddingDim + i] *
            this.fc1Weights[o * this.embeddingDim + i];
        }
        // GELU activation
        hidden[t * this.feedForwardDim + o] = this.gelu(sum);
      }
    }

    // Second layer: project back to embeddingDim
    const output = new Float32Array(numTokens * this.embeddingDim);
    for (let t = 0; t < numTokens; t++) {
      for (let o = 0; o < this.embeddingDim; o++) {
        let sum = 0;
        for (let i = 0; i < this.feedForwardDim; i++) {
          sum +=
            hidden[t * this.feedForwardDim + i] *
            this.fc2Weights[o * this.feedForwardDim + i];
        }
        output[t * this.embeddingDim + o] = sum;
      }
    }

    return output;
  }

  /**
   * GELU activation function
   * GELU(x) = x * Phi(x) where Phi is the CDF of standard normal
   * Approximation: 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
   */
  private gelu(x: number): number {
    const sqrt2OverPi = Math.sqrt(2 / Math.PI);
    const cubic = 0.044715 * x * x * x;
    const tanhArg = sqrt2OverPi * (x + cubic);
    return 0.5 * x * (1 + Math.tanh(tanhArg));
  }

  private initWeights(outputDim: number, inputDim: number): Float32Array {
    const weights = new Float32Array(outputDim * inputDim);
    const scale = Math.sqrt(2.0 / (inputDim + outputDim));

    for (let i = 0; i < weights.length; i++) {
      weights[i] = this.gaussianRandom() * scale;
    }

    return weights;
  }

  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const safeU1 = Math.max(u1, 1e-10);
    return Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

/**
 * Transformer Layer
 *
 * One transformer block: LayerNorm -> MHA -> Add -> LayerNorm -> FFN -> Add
 */
export class TransformerLayer {
  private attention: MultiHeadAttention;
  private ffn: FeedForwardNetwork;
  private embeddingDim: number;

  // Layer norm parameters (gamma and beta for each layer)
  private norm1Gamma: Float32Array;
  private norm1Beta: Float32Array;
  private norm2Gamma: Float32Array;
  private norm2Beta: Float32Array;

  constructor(config: TransformerLayerConfig) {
    this.embeddingDim = config.embeddingDim;
    this.attention = new MultiHeadAttention(config);
    this.ffn = new FeedForwardNetwork(config);

    // Initialize layer norm parameters
    this.norm1Gamma = new Float32Array(config.embeddingDim).fill(1.0);
    this.norm1Beta = new Float32Array(config.embeddingDim).fill(0.0);
    this.norm2Gamma = new Float32Array(config.embeddingDim).fill(1.0);
    this.norm2Beta = new Float32Array(config.embeddingDim).fill(0.0);
  }

  /**
   * Forward pass: one transformer block
   */
  forward(embeddings: Float32Array): Float32Array {
    const numTokens = embeddings.length / this.embeddingDim;

    // Layer norm 1
    const normalized1 = this.layerNorm(
      embeddings,
      this.norm1Gamma,
      this.norm1Beta
    );

    // Multi-head attention with residual connection
    const attentionOut = this.attention.forward(normalized1);
    const residual1 = new Float32Array(embeddings.length);
    for (let i = 0; i < embeddings.length; i++) {
      residual1[i] = embeddings[i] + attentionOut[i];
    }

    // Layer norm 2
    const normalized2 = this.layerNorm(
      residual1,
      this.norm2Gamma,
      this.norm2Beta
    );

    // Feed-forward with residual connection
    const ffnOut = this.ffn.forward(normalized2);
    const output = new Float32Array(residual1.length);
    for (let i = 0; i < residual1.length; i++) {
      output[i] = residual1[i] + ffnOut[i];
    }

    return output;
  }

  /**
   * Layer normalization
   */
  private layerNorm(
    x: Float32Array,
    gamma: Float32Array,
    beta: Float32Array
  ): Float32Array {
    const numTokens = x.length / this.embeddingDim;
    const output = new Float32Array(x.length);

    for (let t = 0; t < numTokens; t++) {
      const start = t * this.embeddingDim;
      const end = start + this.embeddingDim;

      // Compute mean
      let mean = 0;
      for (let i = start; i < end; i++) {
        mean += x[i];
      }
      mean /= this.embeddingDim;

      // Compute variance
      let variance = 0;
      for (let i = start; i < end; i++) {
        const diff = x[i] - mean;
        variance += diff * diff;
      }
      variance /= this.embeddingDim;

      // Normalize: gamma * (x - mean) / sqrt(var + eps) + beta
      const eps = 1e-5;
      const std = Math.sqrt(variance + eps);

      for (let i = start; i < end; i++) {
        output[i] = (gamma[i - start] * (x[i] - mean)) / std + beta[i - start];
      }
    }

    return output;
  }
}

/**
 * Vision Transformer
 *
 * Full ViT: multiple transformer layers processing patch embeddings.
 */
export class VisionTransformer {
  private config: VisionTransformerConfig;
  private layers: TransformerLayer[];

  constructor(config: VisionTransformerConfig) {
    this.config = config;

    // Create transformer layers
    this.layers = [];
    for (let i = 0; i < config.numLayers; i++) {
      this.layers.push(
        new TransformerLayer({
          embeddingDim: config.embeddingDim,
          numHeads: config.numHeads,
          feedForwardDim: config.feedForwardDim,
          dropout: config.dropout,
        })
      );
    }
  }

  /**
   * Forward pass: process patch embeddings through transformer
   *
   * @param embeddings - Patch embeddings with positional encoding (numTokens, embeddingDim)
   * @returns Transformer output with CLS token
   */
  forward(embeddings: Float32Array): TransformerOutput {
    let current = embeddings;

    // Pass through all transformer layers
    for (const layer of this.layers) {
      current = layer.forward(current);
    }

    // Extract CLS token (first token)
    const clsToken = new Float32Array(this.config.embeddingDim);
    clsToken.set(current.subarray(0, this.config.embeddingDim));

    return {
      embeddings: current,
      clsToken,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): VisionTransformerConfig {
    return { ...this.config };
  }

  /**
   * Get number of parameters (for memory estimation)
   */
  getNumParameters(): number {
    const embeddingDim = this.config.embeddingDim;
    const numHeads = this.config.numHeads;
    const feedForwardDim = this.config.feedForwardDim;
    const numLayers = this.config.numLayers;

    // Per layer parameters:
    // - MHA: 3 * embeddingDim^2 (QKV) + embeddingDim^2 (out) = 4 * embeddingDim^2
    // - FFN: embeddingDim * feedForwardDim + feedForwardDim * embeddingDim = 2 * embeddingDim * feedForwardDim
    // - LayerNorm: 2 * 2 * embeddingDim = 4 * embeddingDim (gamma + beta for 2 layers)
    const paramsPerLayer =
      4 * embeddingDim * embeddingDim + // MHA
      2 * embeddingDim * feedForwardDim + // FFN
      4 * embeddingDim; // LayerNorm

    return paramsPerLayer * numLayers;
  }
}

/**
 * Create Vision Transformer from X-Encoder config
 */
export function createVisionTransformer(
  config: XEncoderConfig
): VisionTransformer {
  return new VisionTransformer({
    embeddingDim: config.embeddingDim,
    numLayers: config.numLayers || 12,
    numHeads: config.numHeads || 12,
    feedForwardDim: config.embeddingDim * 4, // Standard ViT uses 4x embedding dim
    dropout: config.dropout || 0.1,
  });
}

/**
 * Create Vision Transformer from VisionTransformerConfig
 */
export function createVisionTransformerFromConfig(
  config: VisionTransformerConfig
): VisionTransformer {
  return new VisionTransformer(config);
}

/**
 * Validate Vision Transformer configuration
 */
export function validateViTConfig(config: VisionTransformerConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.embeddingDim <= 0) {
    errors.push("Embedding dimension must be positive");
  }
  if (config.numLayers <= 0) {
    errors.push("Number of layers must be positive");
  }
  if (config.numHeads <= 0) {
    errors.push("Number of heads must be positive");
  }
  if (config.embeddingDim % config.numHeads !== 0) {
    errors.push("Embedding dimension must be divisible by number of heads");
  }
  if (config.feedForwardDim <= 0) {
    errors.push("Feed-forward dimension must be positive");
  }
  if (config.dropout < 0 || config.dropout >= 1) {
    errors.push("Dropout must be in [0, 1)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
