/**
 * Patch Embedding for Vision Transformer
 *
 * Converts image tensors into patch embeddings with positional encoding.
 * This is the first layer of a Vision Transformer, breaking an image
 * into fixed-size patches and embedding each patch.
 *
 * Architecture:
 * 1. Split image into N patches (e.g., 16x16 pixels each)
 * 2. Linear projection of each patch to embedding dimension
 * 3. Add learnable [CLS] token at the beginning
 * 4. Add positional encoding to each patch
 *
 * Example:
 * - Input: (3, 224, 224) - RGB image
 * - Patch size: 16x16
 * - Output: (197, 768) - 196 patches + 1 CLS token, 768-dim embeddings
 *
 * @packageDocumentation
 */

import type { XEncoderConfig } from "../protocol.js";

/**
 * Patch embedding configuration
 */
export interface PatchEmbeddingConfig {
  /** Image channels (default: 3 for RGB) */
  channels: number;
  /** Image height */
  height: number;
  /** Image width */
  width: number;
  /** Patch size (default: 16) */
  patchSize: number;
  /** Embedding dimension (default: 768) */
  embeddingDim: number;
}

/**
 * Patch embedding output
 */
export interface PatchEmbeddingOutput {
  /** Patch embeddings with positional encoding */
  embeddings: Float32Array;
  /** Number of patches (including CLS token) */
  numPatches: number;
  /** Patch grid dimensions */
  gridHeight: number;
  gridWidth: number;
}

/**
 * Patch Embedding Layer
 *
 * Converts image patches to embeddings with positional encoding.
 */
export class PatchEmbedding {
  private config: PatchEmbeddingConfig;
  private projectionWeights: Float32Array;
  private clsToken: Float32Array;
  private positionalEncoding: Float32Array;

  constructor(config: PatchEmbeddingConfig) {
    this.config = config;
    this.config.channels = config.channels || 3;

    // Initialize projection weights: (embeddingDim, channels * patchSize * patchSize)
    const inputDim = config.channels * config.patchSize * config.patchSize;
    this.projectionWeights = this.initProjectionWeights(
      config.embeddingDim,
      inputDim
    );

    // Initialize CLS token: (embeddingDim,)
    this.clsToken = this.initCLSToken(config.embeddingDim);

    // Initialize positional encoding: (numPatches + 1, embeddingDim)
    const numPatches =
      Math.ceil(config.height / config.patchSize) *
      Math.ceil(config.width / config.patchSize);
    this.positionalEncoding = this.initPositionalEncoding(
      numPatches + 1,
      config.embeddingDim
    );
  }

  /**
   * Forward pass: convert image tensor to patch embeddings
   *
   * @param imageTensor - Image tensor (C x H x W layout)
   * @returns Patch embeddings with positional encoding
   */
  forward(imageTensor: Float32Array): PatchEmbeddingOutput {
    const { channels, height, width, patchSize, embeddingDim } = this.config;

    // Validate input size
    const expectedSize = channels * height * width;
    if (imageTensor.length !== expectedSize) {
      throw new Error(
        `Expected tensor size ${expectedSize} (${channels}x${height}x${width}), ` +
          `got ${imageTensor.length}`
      );
    }

    // Calculate grid dimensions
    const gridHeight = Math.ceil(height / patchSize);
    const gridWidth = Math.ceil(width / patchSize);
    const numPatches = gridHeight * gridWidth;

    // Extract patches: (numPatches, channels * patchSize * patchSize)
    const patches = this.extractPatches(imageTensor, gridHeight, gridWidth);

    // Project patches to embedding dimension: (numPatches, embeddingDim)
    const projected = this.projectPatches(patches);

    // Prepend CLS token: (numPatches + 1, embeddingDim)
    const withCls = this.prependCLSToken(projected);

    // Add positional encoding: (numPatches + 1, embeddingDim)
    const embeddings = this.addPositionalEncoding(withCls, numPatches + 1);

    return {
      embeddings,
      numPatches: numPatches + 1, // +1 for CLS token
      gridHeight,
      gridWidth,
    };
  }

  /**
   * Extract patches from image tensor
   *
   * @param imageTensor - Image tensor (C x H x W)
   * @param gridHeight - Number of patches vertically
   * @param gridWidth - Number of patches horizontally
   * @returns Patch array (numPatches, channels * patchSize * patchSize)
   */
  private extractPatches(
    imageTensor: Float32Array,
    gridHeight: number,
    gridWidth: number
  ): Float32Array {
    const { channels, height, width, patchSize } = this.config;
    const numPatches = gridHeight * gridWidth;
    const patchDim = channels * patchSize * patchSize;
    const patches = new Float32Array(numPatches * patchDim);

    let patchIdx = 0;
    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const startY = gy * patchSize;
        const startX = gx * patchSize;

        // Extract patch pixels
        let pixelIdx = 0;
        for (let c = 0; c < channels; c++) {
          for (let py = 0; py < patchSize; py++) {
            const y = startY + py;
            if (y >= height) continue; // Skip if out of bounds

            for (let px = 0; px < patchSize; px++) {
              const x = startX + px;
              if (x >= width) continue; // Skip if out of bounds

              // Image is C x H x W layout
              const srcIdx = c * height * width + y * width + x;
              const dstIdx = patchIdx * patchDim + pixelIdx;
              patches[dstIdx] = imageTensor[srcIdx];
              pixelIdx++;
            }
          }
        }

        // Fill remaining pixels with zeros if patch is at boundary
        while (pixelIdx < patchDim) {
          patches[patchIdx * patchDim + pixelIdx] = 0;
          pixelIdx++;
        }

        patchIdx++;
      }
    }

    return patches;
  }

  /**
   * Project patches to embedding dimension
   *
   * @param patches - Patch array (numPatches, patchDim)
   * @returns Projected embeddings (numPatches, embeddingDim)
   */
  private projectPatches(patches: Float32Array): Float32Array {
    const numPatches =
      patches.length /
      (this.config.channels * this.config.patchSize * this.config.patchSize);
    const patchDim =
      this.config.channels * this.config.patchSize * this.config.patchSize;
    const embeddingDim = this.config.embeddingDim;
    const projected = new Float32Array(numPatches * embeddingDim);

    // Matrix multiplication: patches @ weights.T
    for (let p = 0; p < numPatches; p++) {
      for (let e = 0; e < embeddingDim; e++) {
        let sum = 0;
        for (let d = 0; d < patchDim; d++) {
          sum +=
            patches[p * patchDim + d] *
            this.projectionWeights[e * patchDim + d];
        }
        projected[p * embeddingDim + e] = sum;
      }
    }

    return projected;
  }

  /**
   * Prepend CLS token to patch embeddings
   *
   * @param patches - Patch embeddings (numPatches, embeddingDim)
   * @returns Embeddings with CLS token (numPatches + 1, embeddingDim)
   */
  private prependCLSToken(patches: Float32Array): Float32Array {
    const numPatches = patches.length / this.config.embeddingDim;
    const embeddingDim = this.config.embeddingDim;
    const withCls = new Float32Array((numPatches + 1) * embeddingDim);

    // Copy CLS token
    withCls.set(this.clsToken, 0);

    // Copy patches after CLS token
    withCls.set(patches, embeddingDim);

    return withCls;
  }

  /**
   * Add positional encoding to embeddings
   *
   * @param embeddings - Input embeddings (numTokens, embeddingDim)
   * @param numTokens - Number of tokens (including CLS)
   * @returns Embeddings with positional encoding
   */
  private addPositionalEncoding(
    embeddings: Float32Array,
    numTokens: number
  ): Float32Array {
    const embeddingDim = this.config.embeddingDim;
    const result = new Float32Array(numTokens * embeddingDim);

    for (let t = 0; t < numTokens; t++) {
      for (let d = 0; d < embeddingDim; d++) {
        result[t * embeddingDim + d] =
          embeddings[t * embeddingDim + d] +
          this.positionalEncoding[t * embeddingDim + d];
      }
    }

    return result;
  }

  /**
   * Initialize projection weights using Xavier initialization
   */
  private initProjectionWeights(
    outputDim: number,
    inputDim: number
  ): Float32Array {
    const weights = new Float32Array(outputDim * inputDim);
    const scale = Math.sqrt(2.0 / (inputDim + outputDim));

    for (let i = 0; i < weights.length; i++) {
      weights[i] = this.gaussianRandom() * scale;
    }

    return weights;
  }

  /**
   * Initialize CLS token
   */
  private initCLSToken(embeddingDim: number): Float32Array {
    const clsToken = new Float32Array(embeddingDim);
    const scale = Math.sqrt(2.0 / embeddingDim);

    for (let i = 0; i < embeddingDim; i++) {
      clsToken[i] = this.gaussianRandom() * scale;
    }

    return clsToken;
  }

  /**
   * Initialize positional encoding using sinusoidal encoding
   *
   * Uses the same sinusoidal encoding as in the original Transformer paper.
   * This allows the model to learn relative positions.
   */
  private initPositionalEncoding(
    numTokens: number,
    embeddingDim: number
  ): Float32Array {
    const encoding = new Float32Array(numTokens * embeddingDim);

    for (let pos = 0; pos < numTokens; pos++) {
      for (let dim = 0; dim < embeddingDim; dim++) {
        // Sinusoidal position encoding
        const period = Math.pow(
          10000,
          (2 * Math.floor(dim / 2)) / embeddingDim
        );
        let value: number;

        if (dim % 2 === 0) {
          // Even dimensions: sin
          value = Math.sin(pos / period);
        } else {
          // Odd dimensions: cos
          value = Math.cos(pos / period);
        }

        encoding[pos * embeddingDim + dim] = value;
      }
    }

    return encoding;
  }

  /**
   * Generate random sample from standard normal distribution N(0, 1)
   * Uses Box-Muller transform
   */
  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const safeU1 = Math.max(u1, 1e-10);
    return Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Get configuration
   */
  getConfig(): PatchEmbeddingConfig {
    return { ...this.config };
  }

  /**
   * Get CLS token (useful for analysis)
   */
  getCLSToken(): Float32Array {
    return new Float32Array(this.clsToken);
  }

  /**
   * Get positional encoding (useful for analysis)
   */
  getPositionalEncoding(): Float32Array {
    return new Float32Array(this.positionalEncoding);
  }

  /**
   * Set CLS token (for loading pre-trained weights)
   */
  setCLSToken(clsToken: Float32Array): void {
    if (clsToken.length !== this.config.embeddingDim) {
      throw new Error(
        `CLS token must have dimension ${this.config.embeddingDim}, ` +
          `got ${clsToken.length}`
      );
    }
    this.clsToken = new Float32Array(clsToken);
  }

  /**
   * Set projection weights (for loading pre-trained weights)
   */
  setProjectionWeights(weights: Float32Array): void {
    const expectedSize =
      this.config.embeddingDim *
      this.config.channels *
      this.config.patchSize *
      this.config.patchSize;
    if (weights.length !== expectedSize) {
      throw new Error(
        `Projection weights must have size ${expectedSize}, got ${weights.length}`
      );
    }
    this.projectionWeights = new Float32Array(weights);
  }

  /**
   * Set positional encoding (for loading pre-trained weights)
   */
  setPositionalEncoding(encoding: Float32Array): void {
    const numPatches =
      Math.ceil(this.config.height / this.config.patchSize) *
      Math.ceil(this.config.width / this.config.patchSize);
    const expectedSize = (numPatches + 1) * this.config.embeddingDim;
    if (encoding.length !== expectedSize) {
      throw new Error(
        `Positional encoding must have size ${expectedSize}, got ${encoding.length}`
      );
    }
    this.positionalEncoding = new Float32Array(encoding);
  }
}

/**
 * Create patch embedding from X-Encoder config
 *
 * @param config - X-Encoder configuration
 * @returns Patch embedding instance
 */
export function createPatchEmbedding(config: XEncoderConfig): PatchEmbedding {
  return new PatchEmbedding({
    channels: 3, // RGB
    height: config.inputSize.height,
    width: config.inputSize.width,
    patchSize: config.patchSize,
    embeddingDim: config.embeddingDim,
  });
}

/**
 * Utility function to calculate number of patches
 *
 * @param imageSize - Image dimensions
 * @param patchSize - Patch size
 * @returns Number of patches (not including CLS token)
 */
export function calculateNumPatches(
  imageSize: { width: number; height: number },
  patchSize: number
): number {
  const gridWidth = Math.ceil(imageSize.width / patchSize);
  const gridHeight = Math.ceil(imageSize.height / patchSize);
  return gridWidth * gridHeight;
}

/**
 * Utility function to validate patch configuration
 *
 * @param config - Patch embedding configuration
 * @returns Validation result
 */
export function validatePatchConfig(config: PatchEmbeddingConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.channels <= 0) {
    errors.push("Channels must be positive");
  }
  if (config.height <= 0 || config.width <= 0) {
    errors.push("Image dimensions must be positive");
  }
  if (config.patchSize <= 0) {
    errors.push("Patch size must be positive");
  }
  if (config.embeddingDim <= 0) {
    errors.push("Embedding dimension must be positive");
  }
  if (config.patchSize > config.height || config.patchSize > config.width) {
    errors.push("Patch size cannot be larger than image dimensions");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
