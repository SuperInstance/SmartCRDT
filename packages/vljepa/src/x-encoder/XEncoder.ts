/**
 * X-Encoder: Vision Transformer for UI Frame Encoding
 *
 * Converts UI screenshots into 768-dimensional semantic embeddings
 * compatible with VL-JEPA's joint embedding space.
 *
 * ========================================================================
 * ARCHITECTURE OVERVIEW
 * ========================================================================
 *
 * The X-Encoder implements a Vision Transformer (ViT) architecture:
 *
 * 1. PATCH EXTRACTION
 *    Input: 224x224 RGB image
 *    Process: Divide into 16x16 pixel patches
 *    Output: 196 patches (14x14 grid) + 1 CLS token = 197 tokens
 *
 * 2. LINEAR PROJECTION
 *    Each 16x16x3 patch → 96-dim vector (learned projection)
 *    All patches: 196 patches × 96 dims = 18,816 values
 *
 * 3. POSITION ENCODING
 *    Add sinusoidal position embeddings to each patch
 *    Preserves spatial information (top-left vs bottom-right)
 *
 * 4. TRANSFORMER ENCODER (12 layers)
 *    Each layer:
 *      - Multi-Head Self-Attention (12 heads, 64 dims each)
 *      - Feed-Forward Network (96 → 384 → 96)
 *      - Layer Normalization
 *      - Residual Connections
 *
 * 5. CLS TOKEN OUTPUT
 *    Extract first token (CLS) as representation
 *    Final: 768-dim embedding (CLIP-compatible space)
 *
 * ========================================================================
 * PIPELINE FLOW
 * ========================================================================
 *
 * ```
 * Input Image (224x224x3)
 *     │
 *     ▼
 * ┌─────────────────┐
 * │  Preprocessing  │  Resize → Normalize (ImageNet mean/std)
 * └────────┬────────┘
 *          │
 *          ▼
 * ┌─────────────────┐
 * │ Patch Embedding │  16x16 patches → Linear projection → 768-dim
 * └────────┬────────┘
 *          │
 *          ▼
 * ┌─────────────────┐
 * │ Position Embed  │  Add sinusoidal position encoding
 * └────────┬────────┘
 *          │
 *          ▼
 * ┌─────────────────┐
 * │   CLS Token     │  Prepend learnable [CLS] token
 * └────────┬────────┘
 *          │
 *          ▼
 * ┌──────────────────────────────────────────┐
 * │       Vision Transformer (12 layers)      │
 * │  ┌────────────────────────────────────┐  │
 * │  │ Layer 1: MSA + FFN + LayerNorm      │  │
 * │  ├────────────────────────────────────┤  │
 * │  │ Layer 2: MSA + FFN + LayerNorm      │  │
 * │  ├────────────────────────────────────┤  │
 * │  │ ...                                 │  │
 * │  ├────────────────────────────────────┤  │
 * │  │ Layer 12: MSA + FFN + LayerNorm    │  │
 * │  └────────────────────────────────────┘  │
 * └──────────────────┬───────────────────────┘
 *                   │
 *                   ▼
 *            Extract CLS Token
 *                   │
 *                   ▼
 *        Output: Float32Array(768)
 * ```
 *
 * ========================================================================
 * KEY DESIGN DECISIONS
 * ========================================================================
 *
 * 1. Why 768 dimensions?
 *    - Matches IntentEncoder output for compatibility
 *    - Standard ViT-Base size (proven effective)
 *    - Sufficient capacity for UI semantics
 *
 * 2. Why 16x16 patches?
 *    - Balances detail vs computational cost
 *    - 196 patches manageable for attention
 *    - Captures UI elements (buttons, text, icons)
 *
 * 3. Why CLS token?
 *    - Single representation for entire image
 *    - Learned during training to aggregate info
 *    - Standard practice (BERT, ViT, CLIP)
 *
 * 4. Why 12 transformer layers?
 *    - ViT-Base architecture (proven)
 *    - Enough depth for complex reasoning
 *    - Reasonable inference time (~30ms target)
 *
 * ========================================================================
 * INTEGRATION POINTS
 * ========================================================================
 *
 * - Input: HTMLCanvasElement, ImageData, or URL string
 * - Output: Float32Array(768) - shared embedding space with Y-Encoder
 * - Compatible with: IntentEncoder, Predictor, WebGPU acceleration
 *
 * ========================================================================
 * PERFORMANCE CHARACTERISTICS
 * ========================================================================
 *
 * - Target encoding time: ~30ms per frame
 * - Memory footprint: ~50MB for model weights
 * - Batch processing: Supported for efficiency
 * - WebGPU: Ready for GPU acceleration (16x16 workgroups)
 *
 * @packageDocumentation
 */

import type { XEncoderConfig } from "../protocol.js";
import { XEncoderError, validateEmbeddingDimension } from "../index.js";
import {
  ImagePreprocessor,
  type PreprocessedImage,
  type ImageSize,
} from "./Preprocessing.js";
import { PatchEmbedding, type PatchEmbeddingOutput } from "./PatchEmbedding.js";
import {
  VisionTransformer,
  type TransformerOutput,
} from "./VisionTransformer.js";

/**
 * X-Encoder encoding result
 */
export interface XEncoderResult {
  /** 768-dim semantic embedding */
  embedding: Float32Array;
  /** Processing time in milliseconds */
  latency: number;
  /** Preprocessing info */
  preprocessing: {
    originalSize: ImageSize;
    processedSize: ImageSize;
    numPatches: number;
  };
}

/**
 * X-Encoder: Vision Transformer for UI frame encoding
 *
 * Processes visual input into 768-dimensional semantic embeddings.
 */
export class XEncoder {
  private config: XEncoderConfig;
  private preprocessor: ImagePreprocessor;
  private patchEmbedding: PatchEmbedding;
  private transformer: VisionTransformer;
  private initialized: boolean = false;

  // Performance tracking
  private stats = {
    totalEncodings: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
  };

  constructor(config: Partial<XEncoderConfig> = {}) {
    // Create default config with overrides
    this.config = this.createDefaultConfig(config);

    // Initialize components
    this.preprocessor = new ImagePreprocessor({
      targetSize: this.config.inputSize,
      normalization: "imagenet",
      maintainAspectRatio: false,
    });

    this.patchEmbedding = new PatchEmbedding({
      channels: 3, // RGB
      height: this.config.inputSize.height,
      width: this.config.inputSize.width,
      patchSize: this.config.patchSize,
      embeddingDim: this.config.embeddingDim,
    });

    this.transformer = new VisionTransformer({
      embeddingDim: this.config.embeddingDim,
      numLayers: this.config.numLayers || 12,
      numHeads: this.config.numHeads || 12,
      feedForwardDim: this.config.embeddingDim * 4,
      dropout: this.config.dropout || 0.1,
    });
  }

  /**
   * Initialize the encoder
   *
   * Pre-allocates resources for encoding. Must be called before encode().
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Warm up with a dummy encoding
    const dummyImage = this.createDummyImage();
    await this.encode(dummyImage);

    this.initialized = true;
  }

  /**
   * Encode a single image frame to 768-dim embedding
   *
   * This is the main inference method that transforms visual input into a
   * semantic embedding vector through the complete ViT pipeline.
   *
   * ========================================================================
   * ENCODING PIPELINE (Step-by-Step)
   * ========================================================================
   *
   * Step 1: Input Conversion
   *   - Convert various input types (canvas, URL, ImageData) to ImageData
   *   - Handle CORS for remote images
   *
   * Step 2: Preprocessing
   *   - Resize to 224x224 (standard ViT input size)
   *   - Normalize RGB values: (pixel - mean) / std
   *   - ImageNet stats: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
   *
   * Step 3: Patch Embedding
   *   - Divide image into 16x16 pixel patches (196 patches total)
   *   - Flatten each patch: 16x16x3 → 768-dim vector
   *   - Add CLS token: 196 + 1 = 197 tokens
   *
   * Step 4: Transformer Processing
   *   - 12 layers of multi-head self-attention
   *   - Each layer attends to all patches
   *   - Builds global semantic understanding
   *
   * Step 5: CLS Token Extraction
   *   - Extract first token (CLS) as image representation
   *   - This token has attended to all patches
   *   - Represents the "meaning" of the entire image
   *
   * ========================================================================
   * OUTPUT FORMAT
   * ========================================================================
   *
   * Returns XEncoderResult containing:
   * - embedding: Float32Array(768) - semantic representation
   * - latency: number - processing time in milliseconds
   * - preprocessing: metadata about image transformations
   *
   * @param frame - Image data (ImageData, HTMLCanvasElement, or URL string)
   * @returns XEncoderResult with 768-dim embedding and metadata
   *
   * @example
   * ```typescript
   * const encoder = new XEncoder();
   * await encoder.initialize();
   *
   * const canvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
   * const result = await encoder.encode(canvas);
   * console.log(result.embedding.length); // 768
   * console.log(result.latency); // ~30ms
   * ```
   */
  async encode(
    frame: ImageData | HTMLCanvasElement | string
  ): Promise<XEncoderResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = performance.now();

    // Step 1: Convert input to ImageData if needed
    // Handles: ImageData (pass-through), HTMLCanvasElement (extract), URL (load)
    const imageData = await this.toImageData(frame);

    // Step 2: Preprocess (resize, normalize)
    // - Resize to 224x224 (maintain aspect ratio if configured)
    // - Normalize using ImageNet mean/std for pretrained compatibility
    const preprocessed = this.preprocessor.preprocess(imageData);

    // Step 3: Patch embedding
    // - Divide into 16x16 patches: 224/16 = 14, so 14x14 = 196 patches
    // - Linear projection: each patch → 768-dim vector
    // - Add positional encoding to preserve spatial info
    // - Prepend CLS token: 196 + 1 = 197 tokens
    const patchOutput = this.patchEmbedding.forward(preprocessed.tensor);

    // Step 4: Vision Transformer forward pass
    // - 12 transformer layers process all tokens
    // - Multi-head attention: each patch attends to all patches
    // - Layer normalization and residual connections throughout
    // - Output: 197 tokens × 768 dims
    const transformerOutput = this.transformer.forward(patchOutput.embeddings);

    // Step 5: Extract CLS token embedding
    // - CLS token (index 0) has global context after attention
    // - Used as single representation of entire image
    // - 768-dim vector compatible with Y-Encoder and IntentEncoder
    const embedding = transformerOutput.clsToken;

    // Validate embedding dimension
    // Ensures compatibility with downstream components
    try {
      validateEmbeddingDimension(embedding, this.config.embeddingDim);
    } catch (e) {
      throw new XEncoderError(
        `Invalid embedding dimension: ${embedding.length}, expected ${this.config.embeddingDim}`,
        { latency: performance.now() - startTime }
      );
    }

    const latency = performance.now() - startTime;

    // Update stats for performance monitoring
    this.updateStats(latency);

    return {
      embedding,
      latency,
      preprocessing: {
        originalSize: { width: imageData.width, height: imageData.height },
        processedSize: preprocessed.size,
        numPatches: patchOutput.numPatches,
      },
    };
  }

  /**
   * Encode multiple frames in batch
   *
   * More efficient than encoding individually for large batches.
   *
   * @param frames - Array of image data
   * @returns Array of encoding results
   */
  async encodeBatch(
    frames: Array<ImageData | HTMLCanvasElement | string>
  ): Promise<XEncoderResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results: XEncoderResult[] = [];

    for (const frame of frames) {
      const result = await this.encode(frame);
      results.push(result);
    }

    return results;
  }

  /**
   * Convert various input types to ImageData
   */
  private async toImageData(
    frame: ImageData | HTMLCanvasElement | string
  ): Promise<ImageData> {
    if (frame instanceof ImageData) {
      return frame;
    }

    if (frame instanceof HTMLCanvasElement) {
      const ctx = frame.getContext("2d");
      if (!ctx) {
        throw new XEncoderError("Failed to get canvas context");
      }
      return ctx.getImageData(0, 0, frame.width, frame.height);
    }

    if (typeof frame === "string") {
      // URL or data URL
      return this.loadImageFromUrl(frame);
    }

    throw new XEncoderError(`Unsupported input type: ${typeof frame}`);
  }

  /**
   * Load image from URL and convert to ImageData
   */
  private async loadImageFromUrl(url: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;

        try {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          resolve(imageData);
        } catch (e) {
          reject(
            new XEncoderError(
              `Failed to extract image data: ${e instanceof Error ? e.message : String(e)}`
            )
          );
        }
      };

      img.onerror = () => {
        reject(new XEncoderError(`Failed to load image from URL: ${url}`));
      };

      img.src = url;
    });
  }

  /**
   * Create dummy image for warmup
   */
  private createDummyImage(): ImageData {
    const size = this.config.inputSize;
    const data = new Uint8ClampedArray(size.width * size.height * 4);

    // Fill with gray
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128; // R
      data[i + 1] = 128; // G
      data[i + 2] = 128; // B
      data[i + 3] = 255; // A
    }

    return new ImageData(data, size.width, size.height);
  }

  /**
   * Update performance statistics
   */
  private updateStats(latency: number): void {
    this.stats.totalEncodings++;
    this.stats.totalLatency += latency;
    this.stats.minLatency = Math.min(this.stats.minLatency, latency);
    this.stats.maxLatency = Math.max(this.stats.maxLatency, latency);
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    totalEncodings: number;
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
  } {
    return {
      totalEncodings: this.stats.totalEncodings,
      averageLatency:
        this.stats.totalEncodings > 0
          ? this.stats.totalLatency / this.stats.totalEncodings
          : 0,
      minLatency:
        this.stats.minLatency === Infinity ? 0 : this.stats.minLatency,
      maxLatency: this.stats.maxLatency,
    };
  }

  /**
   * Reset performance statistics
   */
  resetStats(): void {
    this.stats = {
      totalEncodings: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): XEncoderConfig {
    return { ...this.config };
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDim(): number {
    return this.config.embeddingDim;
  }

  /**
   * Check if encoder is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.initialized = false;
  }

  /**
   * Create default X-Encoder configuration
   */
  private createDefaultConfig(
    overrides: Partial<XEncoderConfig>
  ): XEncoderConfig {
    return {
      version: "1.0",
      inputSize: overrides.inputSize || { width: 224, height: 224 },
      patchSize: overrides.patchSize || 16,
      embeddingDim: 768, // Fixed for IntentEncoder compatibility
      model: overrides.model || "vit-base",
      numHeads: overrides.numHeads || 12,
      numLayers: overrides.numLayers || 12,
      usePositionalEncoding: overrides.usePositionalEncoding !== false,
      dropout: overrides.dropout || 0.1,
      webgpu: overrides.webgpu || {
        enabled: true,
        workgroups: 8,
        memoryOptimization: "medium",
      },
    };
  }
}

/**
 * Create X-Encoder instance from configuration
 *
 * @param config - X-Encoder configuration
 * @returns Initialized X-Encoder instance
 *
 * @example
 * ```typescript
 * const encoder = createXEncoder({
 *   inputSize: { width: 224, height: 224 },
 *   patchSize: 16,
 *   model: 'vit-small'
 * });
 * await encoder.initialize();
 *
 * const result = await encoder.encode(imageData);
 * ```
 */
export async function createXEncoder(
  config?: Partial<XEncoderConfig>
): Promise<XEncoder> {
  const encoder = new XEncoder(config);
  await encoder.initialize();
  return encoder;
}

/**
 * Quick encoding utility
 *
 * @param frame - Image data
 * @param config - Optional configuration
 * @returns 768-dim embedding
 *
 * @example
 * ```typescript
 * const embedding = await encodeImage(canvas);
 * console.log(embedding.length); // 768
 * ```
 */
export async function encodeImage(
  frame: ImageData | HTMLCanvasElement | string,
  config?: Partial<XEncoderConfig>
): Promise<Float32Array> {
  const encoder = new XEncoder(config);
  const result = await encoder.encode(frame);
  encoder.dispose();
  return result.embedding;
}

/**
 * Batch encoding utility
 *
 * @param frames - Array of image data
 * @param config - Optional configuration
 * @returns Array of 768-dim embeddings
 */
export async function encodeImageBatch(
  frames: Array<ImageData | HTMLCanvasElement | string>,
  config?: Partial<XEncoderConfig>
): Promise<Float32Array[]> {
  const encoder = new XEncoder(config);
  const results = await encoder.encodeBatch(frames);
  encoder.dispose();
  return results.map(r => r.embedding);
}

/**
 * Validate X-Encoder configuration
 */
export function validateXEncoderConfig(config: XEncoderConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate embedding dimension
  if (config.embeddingDim !== 768) {
    errors.push(
      `embeddingDim must be 768 for IntentEncoder compatibility, got ${config.embeddingDim}`
    );
  }

  // Validate input size
  if (config.inputSize.width <= 0 || config.inputSize.height <= 0) {
    errors.push(
      `Invalid inputSize: ${config.inputSize.width}x${config.inputSize.height}`
    );
  }

  // Validate patch size
  if (config.patchSize <= 0) {
    errors.push(`patchSize must be positive, got ${config.patchSize}`);
  }

  // Validate model type
  if (!["vit-base", "vit-small"].includes(config.model)) {
    warnings.push(`Unknown model type: ${config.model}`);
  }

  // Validate numHeads divides embeddingDim
  if (config.numHeads && config.embeddingDim % config.numHeads !== 0) {
    errors.push(
      `numHeads (${config.numHeads}) must divide embeddingDim (${config.embeddingDim}) evenly`
    );
  }

  // Validate numLayers
  if (config.numLayers && config.numLayers <= 0) {
    errors.push(`numLayers must be positive, got ${config.numLayers}`);
  }

  // Validate dropout
  if (
    config.dropout !== undefined &&
    (config.dropout < 0 || config.dropout >= 1)
  ) {
    errors.push(`dropout must be in [0, 1), got ${config.dropout}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Estimate memory usage for X-Encoder
 *
 * @param config - X-Encoder configuration
 * @returns Estimated memory usage in bytes
 */
export function estimateMemoryUsage(config: XEncoderConfig): {
  total: number;
  patches: number;
  transformer: number;
  embeddings: number;
} {
  const { inputSize, patchSize, embeddingDim, numLayers, numHeads } = config;

  // Patches: gridH * gridW * embeddingDim * 4 (float32)
  const gridH = Math.ceil(inputSize.height / patchSize);
  const gridW = Math.ceil(inputSize.width / patchSize);
  const numPatches = gridH * gridW + 1; // +1 for CLS
  const patches = numPatches * embeddingDim * 4;

  // Transformer: layers * (4 * embeddingDim^2 + 2 * embeddingDim * feedForwardDim) * 4
  const feedForwardDim = embeddingDim * 4;
  const paramsPerLayer =
    4 * embeddingDim * embeddingDim + 2 * embeddingDim * feedForwardDim;
  const transformer = paramsPerLayer * (numLayers || 12) * 4;

  // Embeddings: intermediate activations (numLayers * numPatches * embeddingDim * 4)
  const embeddings = (numLayers || 12) * numPatches * embeddingDim * 4;

  const total = patches + transformer + embeddings;

  return { total, patches, transformer, embeddings };
}

/**
 * Get supported input formats
 */
export function getSupportedFormats(): string[] {
  return [
    "ImageData",
    "HTMLCanvasElement",
    "data:image/*",
    "http://*",
    "https://*",
  ];
}

/**
 * Check if format is supported
 */
export function isFormatSupported(format: string): boolean {
  const supported = getSupportedFormats();
  return supported.some(s => {
    // Exact match
    if (format === s) return true;
    // Prefix match for URLs
    if (s.startsWith("data:") || s.startsWith("http")) {
      return format.startsWith(s.split("*")[0]);
    }
    return false;
  });
}
