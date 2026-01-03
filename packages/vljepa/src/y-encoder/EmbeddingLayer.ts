/**
 * @lsi/vljepa/y-encoder/EmbeddingLayer - Token and Positional Embeddings for Y-Encoder
 *
 * This module implements the embedding layer for the Y-Encoder (Language Encoder).
 * It combines token embeddings with positional encodings to create input representations
 * for the transformer encoder.
 *
 * ## Architecture
 *
 * 1. **Token Embeddings**: Learnable embeddings for each token in vocabulary
 * 2. **Positional Encodings**: Sinusoidal or learnable position embeddings
 * 3. **Combination**: Token embeddings + positional encodings
 *
 * ## Integration
 *
 * - Output dimension: 768 (matches IntentEncoder and X-Encoder)
 * - Supports learnable or sinusoidal positional encodings
 * - Optimized for WebGPU computation
 *
 * @see https://arxiv.org/abs/1706.03762 - Attention Is All You Need (Transformer)
 * @version 1.0.0
 */

import type { YEncoderConfig } from "../protocol.js";

/**
 * Positional encoding type
 */
export enum PositionalEncodingType {
  /** Sinusoidal positional encoding (fixed, not learnable) */
  Sinusoidal = "sinusoidal",
  /** Learnable positional embeddings */
  Learnable = "learnable",
}

/**
 * Embedding layer configuration
 */
export interface EmbeddingLayerConfig {
  /** Vocabulary size */
  vocabSize: number;

  /** Embedding dimension (must be 768 for compatibility) */
  embeddingDim: number;

  /** Maximum sequence length */
  maxSequenceLength: number;

  /** Positional encoding type */
  positionalEncodingType?: PositionalEncodingType;

  /** Dropout rate */
  dropout?: number;
}

/**
 * Token and positional embedding result
 */
export interface EmbeddingResult {
  /** Combined embeddings [seqLen, embeddingDim] */
  embeddings: Float32Array;

  /** Token embeddings only (without positional) */
  tokenEmbeddings: Float32Array;

  /** Positional encodings only */
  positionalEncodings: Float32Array;

  /** Sequence length */
  sequenceLength: number;
}

/**
 * EmbeddingLayer - Token and Positional Embeddings
 *
 * Combines token embeddings with positional encodings to create
 * input representations for the transformer encoder.
 *
 * ## Token Embeddings
 *
 * Each token in the vocabulary is mapped to a learnable embedding vector.
 * This is implemented as a lookup table: [vocabSize, embeddingDim].
 *
 * ## Positional Encodings
 *
 * Positional information is added to embeddings to give the model
 * understanding of token order. Two options:
 *
 * 1. **Sinusoidal** (default): Fixed sinusoidal functions of position
 * 2. **Learnable**: Learned position embeddings
 *
 * ## Formula
 *
 * For sinusoidal encoding:
 *
 * ```
 * PE(pos, 2i)   = sin(pos / 10000^(2i/d))
 * PE(pos, 2i+1) = cos(pos / 10000^(2i/d))
 * ```
 *
 * @example
 * ```typescript
 * const embeddingLayer = new EmbeddingLayer({
 *   vocabSize: 50000,
 *   embeddingDim: 768,
 *   maxSequenceLength: 512,
 *   positionalEncodingType: PositionalEncodingType.Sinusoidal
 * });
 *
 * const tokenIds = [123, 456, 789, 101, 234];
 * const result = embeddingLayer.forward(tokenIds);
 * // result.embeddings: Float32Array [5 * 768]
 * ```
 */
export class EmbeddingLayer {
  /** Configuration */
  private config: Required<EmbeddingLayerConfig>;

  /** Token embedding matrix [vocabSize, embeddingDim] */
  private tokenEmbeddings: Float32Array;

  /** Positional encoding matrix [maxSequenceLength, embeddingDim] */
  private positionalEncodings: Float32Array;

  /** Whether embeddings are initialized */
  private initialized: boolean = false;

  /** Random seed for reproducibility */
  private readonly randomSeed: number = 42;

  /**
   * Create an embedding layer
   *
   * @param config - Embedding layer configuration
   */
  constructor(config: EmbeddingLayerConfig) {
    this.config = {
      vocabSize: config.vocabSize,
      embeddingDim: config.embeddingDim,
      maxSequenceLength: config.maxSequenceLength,
      positionalEncodingType:
        config.positionalEncodingType ?? PositionalEncodingType.Sinusoidal,
      dropout: config.dropout ?? 0.1,
    };

    // Initialize embedding matrices
    this.tokenEmbeddings = new Float32Array(
      this.config.vocabSize * this.config.embeddingDim
    );
    this.positionalEncodings = new Float32Array(
      this.config.maxSequenceLength * this.config.embeddingDim
    );
  }

  /**
   * Initialize the embedding layer
   *
   * Initializes token embeddings with random values and computes
   * positional encodings. Must be called before forward().
   */
  initialize(): void {
    if (this.initialized) {
      return;
    }

    // Initialize token embeddings with Xavier/Glorot initialization
    this.initializeTokenEmbeddings();

    // Compute positional encodings
    if (
      this.config.positionalEncodingType === PositionalEncodingType.Sinusoidal
    ) {
      this.computeSinusoidalPositionalEncodings();
    } else {
      this.initializeLearnablePositionalEncodings();
    }

    this.initialized = true;
  }

  /**
   * Forward pass - compute embeddings for token IDs
   *
   * @param tokenIds - Token IDs [seqLen]
   * @returns Combined token and positional embeddings
   */
  forward(tokenIds: number[]): EmbeddingResult {
    if (!this.initialized) {
      this.initialize();
    }

    const seqLen = tokenIds.length;

    if (seqLen > this.config.maxSequenceLength) {
      throw new Error(
        `Sequence length ${seqLen} exceeds maximum ${this.config.maxSequenceLength}`
      );
    }

    // Look up token embeddings
    const tokenEmbeddings = this.lookupTokenEmbeddings(tokenIds);

    // Get positional encodings for this sequence length
    const positionalEncodings = this.getPositionalEncodings(seqLen);

    // Add token and positional embeddings
    const embeddings = new Float32Array(seqLen * this.config.embeddingDim);
    for (let i = 0; i < embeddings.length; i++) {
      embeddings[i] = tokenEmbeddings[i] + positionalEncodings[i];
    }

    return {
      embeddings,
      tokenEmbeddings,
      positionalEncodings,
      sequenceLength: seqLen,
    };
  }

  /**
   * Look up token embeddings for token IDs
   *
   * @param tokenIds - Token IDs to look up
   * @returns Token embeddings [seqLen, embeddingDim]
   */
  private lookupTokenEmbeddings(tokenIds: number[]): Float32Array {
    const seqLen = tokenIds.length;
    const embeddings = new Float32Array(seqLen * this.config.embeddingDim);

    for (let i = 0; i < seqLen; i++) {
      const tokenId = tokenIds[i];

      if (tokenId < 0 || tokenId >= this.config.vocabSize) {
        throw new Error(
          `Token ID ${tokenId} out of range [0, ${this.config.vocabSize})`
        );
      }

      // Copy embedding for this token
      const offset = tokenId * this.config.embeddingDim;
      const targetOffset = i * this.config.embeddingDim;

      for (let j = 0; j < this.config.embeddingDim; j++) {
        embeddings[targetOffset + j] = this.tokenEmbeddings[offset + j];
      }
    }

    return embeddings;
  }

  /**
   * Get positional encodings for a sequence
   *
   * @param seqLen - Sequence length
   * @returns Positional encodings [seqLen, embeddingDim]
   */
  private getPositionalEncodings(seqLen: number): Float32Array {
    const encodings = new Float32Array(seqLen * this.config.embeddingDim);

    for (let i = 0; i < seqLen; i++) {
      const offset = i * this.config.embeddingDim;
      const sourceOffset = i * this.config.embeddingDim;

      for (let j = 0; j < this.config.embeddingDim; j++) {
        encodings[offset + j] = this.positionalEncodings[sourceOffset + j];
      }
    }

    return encodings;
  }

  /**
   * Initialize token embeddings with Xavier/Glorot initialization
   *
   * Initializes embeddings from a uniform distribution with range:
   *   [-sqrt(6 / (fanIn + fanOut)), sqrt(6 / (fanIn + fanOut))]
   *
   * For embeddings, fanIn = fanOut = embeddingDim.
   */
  private initializeTokenEmbeddings(): void {
    const limit = Math.sqrt(
      6 / (this.config.embeddingDim + this.config.embeddingDim)
    );

    // Seed random generator for reproducibility
    let seed = this.randomSeed;
    const random = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < this.tokenEmbeddings.length; i++) {
      this.tokenEmbeddings[i] = (random() * 2 - 1) * limit;
    }
  }

  /**
   * Compute sinusoidal positional encodings
   *
   * Uses fixed sinusoidal functions:
   *
   * PE(pos, 2i)   = sin(pos / 10000^(2i/d))
   * PE(pos, 2i+1) = cos(pos / 10000^(2i/d))
   *
   * where d = embeddingDim.
   */
  private computeSinusoidalPositionalEncodings(): void {
    const maxLen = this.config.maxSequenceLength;
    const dim = this.config.embeddingDim;

    for (let pos = 0; pos < maxLen; pos++) {
      for (let i = 0; i < dim; i++) {
        const offset = pos * dim + i;

        if (i % 2 === 0) {
          // Even dimensions: sin
          const power = i / dim;
          const divisor = Math.pow(10000, power);
          this.positionalEncodings[offset] = Math.sin(pos / divisor);
        } else {
          // Odd dimensions: cos
          const power = (i - 1) / dim;
          const divisor = Math.pow(10000, power);
          this.positionalEncodings[offset] = Math.cos(pos / divisor);
        }
      }
    }
  }

  /**
   * Initialize learnable positional encodings
   *
   * Initializes positional embeddings with small random values.
   * These will be learned during training.
   */
  private initializeLearnablePositionalEncodings(): void {
    const std = 0.02; // Small standard deviation for positional encodings

    // Seed random generator
    let seed = this.randomSeed + 1;
    const random = (): number => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Box-Muller transform for normal distribution
    const gaussianRandom = (): number => {
      const u1 = Math.max(random(), 1e-10);
      const u2 = random();
      return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    };

    for (let i = 0; i < this.positionalEncodings.length; i++) {
      this.positionalEncodings[i] = gaussianRandom() * std;
    }
  }

  /**
   * Get the embedding dimension
   */
  getEmbeddingDim(): number {
    return this.config.embeddingDim;
  }

  /**
   * Get the vocabulary size
   */
  getVocabSize(): number {
    return this.config.vocabSize;
  }

  /**
   * Get the maximum sequence length
   */
  getMaxSequenceLength(): number {
    return this.config.maxSequenceLength;
  }

  /**
   * Get token embedding matrix (for training/export)
   *
   * @returns Token embedding matrix [vocabSize, embeddingDim]
   */
  getTokenEmbeddings(): Float32Array {
    return new Float32Array(this.tokenEmbeddings);
  }

  /**
   * Set token embedding matrix (for loading trained weights)
   *
   * @param embeddings - Token embedding matrix
   */
  setTokenEmbeddings(embeddings: Float32Array): void {
    if (embeddings.length !== this.tokenEmbeddings.length) {
      throw new Error(
        `Embedding size mismatch: expected ${this.tokenEmbeddings.length}, got ${embeddings.length}`
      );
    }
    this.tokenEmbeddings.set(embeddings);
  }

  /**
   * Get positional encoding matrix (for export)
   *
   * @returns Positional encoding matrix [maxSequenceLength, embeddingDim]
   */
  getPositionalEncodingsMatrix(): Float32Array {
    return new Float32Array(this.positionalEncodings);
  }

  /**
   * Reset the embedding layer
   */
  reset(): void {
    this.initialized = false;
    this.tokenEmbeddings.fill(0);
    this.positionalEncodings.fill(0);
  }

  /**
   * Get the configuration
   */
  getConfig(): Required<EmbeddingLayerConfig> {
    return { ...this.config };
  }
}

/**
 * Create an embedding layer from Y-Encoder configuration
 *
 * @param config - Y-Encoder configuration
 * @returns Embedding layer
 */
export function createEmbeddingLayer(config: YEncoderConfig): EmbeddingLayer {
  return new EmbeddingLayer({
    vocabSize: config.vocabSize,
    embeddingDim: config.embeddingDim,
    maxSequenceLength: config.contextLength,
    positionalEncodingType: PositionalEncodingType.Sinusoidal,
    dropout: config.dropout,
  });
}
