/**
 * @lsi/vljepa-orpo - Pair Encoder
 *
 * Encodes chosen/rejected UI states for multimodal ORPO training.
 * Uses VL-JEPA X-Encoder to convert UI states to 768-dim embeddings.
 *
 * @module models
 */

import type { UIState, UIPreferencePair, PairEncoderResult } from "../types.js";

/**
 * Pair encoder options
 */
export interface PairEncoderOptions {
  /** Normalize embeddings */
  normalizeEmbeddings: boolean;
  /** Cache embeddings */
  useCache: boolean;
  /** Cache size */
  cacheSize: number;
  /** Batch encoding */
  batchSize: number;
}

/**
 * Pair Encoder
 *
 * Encodes UI state pairs into embeddings for ORPO training.
 * Uses VL-JEPA's X-Encoder for visual encoding.
 *
 * @example
 * ```typescript
 * const encoder = new PairEncoder();
 * const result = await encoder.encodePair(chosenUI, rejectedUI);
 * console.log(result.chosenEncoding); // Float32Array(768)
 * ```
 */
export class PairEncoder {
  private options: PairEncoderOptions;
  private cache: Map<string, Float32Array>;
  private cacheHits: number;
  private cacheMisses: number;
  private initialized: boolean;

  constructor(options: Partial<PairEncoderOptions> = {}) {
    this.options = {
      normalizeEmbeddings: true,
      useCache: true,
      cacheSize: 1000,
      batchSize: 8,
      ...options,
    };
    this.cache = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.initialized = false;
  }

  /**
   * Initialize encoder
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // TODO: Load VL-JEPA X-Encoder model
    this.initialized = true;
  }

  /**
   * Encode a single UI state to embedding
   */
  async encodeUIState(state: UIState): Promise<Float32Array> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check cache first
    const cacheKey = this.getCacheKey(state);
    if (this.options.useCache && this.cache.has(cacheKey)) {
      this.cacheHits++;
      return this.cache.get(cacheKey)!;
    }

    this.cacheMisses++;

    // Encode using VL-JEPA X-Encoder
    // For now, return the embedding if it exists, otherwise generate a placeholder
    let embedding: Float32Array;

    if (state.embedding && state.embedding.length === 768) {
      embedding = state.embedding;
    } else {
      // Generate placeholder embedding
      embedding = await this.encodeWithXEncoder(state.image);
    }

    // Normalize if enabled
    if (this.options.normalizeEmbeddings) {
      embedding = this.normalizeEmbedding(embedding);
    }

    // Cache the result
    if (this.options.useCache) {
      this.manageCacheSize();
      this.cache.set(cacheKey, embedding);
    }

    return embedding;
  }

  /**
   * Encode a preference pair
   */
  async encodePair(pair: UIPreferencePair): Promise<PairEncoderResult> {
    const startTime = performance.now();

    // Encode chosen and rejected states
    const chosenEncoding = await this.encodeUIState(pair.chosen);
    const rejectedEncoding = await this.encodeUIState(pair.rejected);

    // Generate context encoding (concatenation with task awareness)
    const contextEncoding = await this.encodeContext(pair);

    const encodingTime = performance.now() - startTime;

    return {
      chosenEncoding,
      rejectedEncoding,
      contextEncoding,
      metadata: {
        encodingTime,
        modelVersion: "vljepa-orpo-1.0.0",
        device: "cpu", // TODO: Detect actual device
      },
    };
  }

  /**
   * Encode multiple pairs in batch
   */
  async encodeBatch(pairs: UIPreferencePair[]): Promise<PairEncoderResult[]> {
    const results: PairEncoderResult[] = [];

    // Process in batches
    for (let i = 0; i < pairs.length; i += this.options.batchSize) {
      const batch = pairs.slice(i, i + this.options.batchSize);
      const batchResults = await Promise.all(
        batch.map(pair => this.encodePair(pair))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Encode context from preference pair
   */
  private async encodeContext(pair: UIPreferencePair): Promise<Float32Array> {
    // Context encoding combines task, user intent, and UI context
    const contextText = `${pair.context.task} ${pair.context.userIntent} ${pair.context.uiContext}`;

    // For now, use simple hash-based encoding
    // TODO: Replace with actual Y-Encoder for text
    const hash = this.hashString(contextText);
    const embedding = new Float32Array(768);

    for (let i = 0; i < 768; i++) {
      // Use hash to generate deterministic pseudo-random values
      const seed = hash + i * 31;
      embedding[i] =
        (((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    }

    return this.normalizeEmbedding(embedding);
  }

  /**
   * Encode image with X-Encoder (placeholder)
   * TODO: Replace with actual VL-JEPA X-Encoder inference
   */
  private async encodeWithXEncoder(image: ImageData): Promise<Float32Array> {
    // Placeholder: Generate deterministic embedding from image data
    const pixels = image.data;
    let hash = 0;

    // Simple hash of image data
    for (let i = 0; i < Math.min(pixels.length, 10000); i += 4) {
      hash = (hash << 5) - hash + pixels[i];
      hash = hash & hash; // Convert to 32-bit integer
    }

    const embedding = new Float32Array(768);
    for (let i = 0; i < 768; i++) {
      const seed = Math.abs(hash) + i * 17;
      embedding[i] =
        (((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    }

    return embedding;
  }

  /**
   * Normalize embedding to unit length
   */
  private normalizeEmbedding(embedding: Float32Array): Float32Array {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalized = new Float32Array(embedding.length);

    for (let i = 0; i < embedding.length; i++) {
      normalized[i] = embedding[i] / (norm + 1e-8);
    }

    return normalized;
  }

  /**
   * Generate cache key for UI state
   */
  private getCacheKey(state: UIState): string {
    // Use image data hash as cache key
    const imageData = state.image.data;
    let hash = 0;

    for (let i = 0; i < Math.min(imageData.length, 1000); i += 10) {
      hash = (hash << 5) - hash + imageData[i];
      hash = hash & hash;
    }

    return `ui_${Math.abs(hash)}`;
  }

  /**
   * Manage cache size (LRU eviction)
   */
  private manageCacheSize(): void {
    if (this.cache.size >= this.options.cacheSize) {
      // Simple FIFO eviction (could be improved with LRU)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Hash string to number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  /**
   * Check if encoder is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get options
   */
  getOptions(): PairEncoderOptions {
    return { ...this.options };
  }
}

/**
 * Create a pair encoder
 */
export async function createPairEncoder(
  options?: Partial<PairEncoderOptions>
): Promise<PairEncoder> {
  const encoder = new PairEncoder(options);
  await encoder.initialize();
  return encoder;
}
