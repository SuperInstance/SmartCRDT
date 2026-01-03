/**
 * SemanticKeyGenerator - Perceptual hashing and semantic similarity for visual cache
 *
 * Generates semantic cache keys for visual embeddings using:
 * - Perceptual hashing: Detect similar UI frames (resize, color changes)
 * - UI structure awareness: Layout changes invalidate cache
 * - Semantic similarity: Use cache if embeddings >95% similar
 *
 * Key Strategy:
 * 1. Perceptual Hash: 64-bit hash of visual features (not pixels)
 * 2. UI Structure: Hash of DOM structure + layout
 * 3. Semantic Embedding: For similarity matching
 *
 * This enables cache hits for:
 * - Same UI with different colors/themes
 * - Slightly resized UI frames
 * - Same layout with different content
 *
 * @version 1.0.0
 */

import type { Float32Array } from "../types.js";

// ============================================================================
// SEMANTIC KEY TYPES
// ============================================================================

/**
 * Semantic key for visual cache lookups
 */
export interface SemanticKey {
  /** 64-bit perceptual hash of visual features */
  perceptualHash: string;
  /** Hash of UI structure (DOM layout) */
  uiStructure: string;
  /** Semantic embedding for similarity matching */
  embedding?: Float32Array;
  /** Confidence in key generation (0-1) */
  confidence: number;
}

/**
 * Similarity match result
 */
export interface SimilarityMatch {
  /** Matched semantic key */
  key: SemanticKey;
  /** Distance/Similarity score (0-1, higher is more similar) */
  distance: number;
  /** Whether this match is usable (above threshold) */
  usable: boolean;
}

/**
 * Perceptual hash configuration
 */
export interface PerceptualHashConfig {
  /** Hash algorithm to use */
  algorithm: "dhash" | "phash" | "whash" | "average";
  /** Hash size (bits) */
  hashSize: 8 | 16 | 32 | 64;
  /** Enable color invariance */
  colorInvariance: boolean;
  /** Enable resize invariance */
  resizeInvariance: boolean;
}

/**
 * UI structure hash configuration
 */
export interface UIStructureConfig {
  /** Include element types in hash */
  includeElementTypes: boolean;
  /** Include layout information */
  includeLayout: boolean;
  /** Include styling information */
  includeStyle: boolean;
  /** Include content (text) */
  includeContent: boolean;
}

/**
 * SemanticKeyGenerator configuration
 */
export interface SemanticKeyGeneratorConfig {
  /** Perceptual hash configuration */
  perceptualHash: Partial<PerceptualHashConfig>;
  /** UI structure configuration */
  uiStructure: Partial<UIStructureConfig>;
  /** Similarity threshold (0-1) */
  similarityThreshold: number;
  /** Enable semantic embedding matching */
  enableSemanticMatching: boolean;
}

// ============================================================================
// PERCEPTUAL HASH ALGORITHMS
// ============================================================================

/**
 * Perceptual Hash Generator
 *
 * Generates robust hashes that are invariant to:
 * - Resize (within reason)
 * - Color changes (if enabled)
 * - Small visual variations
 */
class PerceptualHashGenerator {
  constructor(private config: PerceptualHashConfig) {}

  /**
   * Generate perceptual hash from image data
   */
  generate(imageData: ImageData): string {
    switch (this.config.algorithm) {
      case "dhash":
        return this.differenceHash(imageData);
      case "phash":
        return this.perceptualHash(imageData);
      case "whash":
        return this.waveletHash(imageData);
      case "average":
        return this.averageHash(imageData);
      default:
        return this.differenceHash(imageData);
    }
  }

  /**
   * Difference Hash (dHash)
   *
   * Compares adjacent pixels to generate hash.
   * Fast and effective for detecting similar images.
   */
  private differenceHash(imageData: ImageData): string {
    const { width, height, data } = imageData;
    const hashSize = this.config.hashSize;

    // Resize to hashSize+1 x hashSize
    const resized = this.resizeGrayscale(imageData, hashSize + 1, hashSize);

    // Compare adjacent pixels
    let hash = 0n;
    for (let y = 0; y < hashSize; y++) {
      for (let x = 0; x < hashSize; x++) {
        const left = resized[y * (hashSize + 1) + x];
        const right = resized[y * (hashSize + 1) + x + 1];
        if (left < right) {
          hash |= 1n << BigInt(y * hashSize + x);
        }
      }
    }

    return this.hashToHex(hash, hashSize * hashSize);
  }

  /**
   * Perceptual Hash (pHash)
   *
   * Uses DCT (Discrete Cosine Transform) for robustness.
   * More accurate but slower than dHash.
   */
  private perceptualHash(imageData: ImageData): string {
    const { width, height, data } = imageData;
    const hashSize = this.config.hashSize;

    // Resize to 32x32
    const resized = this.resizeGrayscale(imageData, 32, 32);

    // Compute DCT (simplified)
    const dct = this.computeDCT(resized, 32, 32);

    // Extract low-frequency components (top-left 8x8)
    const lowFreq = new Float32Array(hashSize * hashSize);
    for (let y = 0; y < hashSize; y++) {
      for (let x = 0; x < hashSize; x++) {
        lowFreq[y * hashSize + x] = dct[y * 32 + x];
      }
    }

    // Compute median
    const median = this.median(lowFreq);

    // Generate hash based on median
    let hash = 0n;
    for (let i = 0; i < lowFreq.length; i++) {
      if (lowFreq[i] > median) {
        hash |= 1n << BigInt(i);
      }
    }

    return this.hashToHex(hash, hashSize * hashSize);
  }

  /**
   * Wavelet Hash (wHash)
   *
   * Uses Haar wavelet transform for multi-scale analysis.
   * Good for detecting similar images at different scales.
   */
  private waveletHash(imageData: ImageData): string {
    const hashSize = this.config.hashSize;

    // Resize to hashSize x hashSize
    const resized = this.resizeGrayscale(imageData, hashSize, hashSize);

    // Apply Haar wavelet transform (simplified)
    const wavelet = this.haarWavelet(resized, hashSize);

    // Compute mean
    const mean = wavelet.reduce((a, b) => a + b, 0) / wavelet.length;

    // Generate hash
    let hash = 0n;
    for (let i = 0; i < wavelet.length; i++) {
      if (wavelet[i] > mean) {
        hash |= 1n << BigInt(i);
      }
    }

    return this.hashToHex(hash, hashSize * hashSize);
  }

  /**
   * Average Hash
   *
   * Simple average-based hashing.
   * Fast but less robust than other methods.
   */
  private averageHash(imageData: ImageData): string {
    const hashSize = this.config.hashSize;

    // Resize to hashSize x hashSize
    const resized = this.resizeGrayscale(imageData, hashSize, hashSize);

    // Compute average
    const avg = resized.reduce((a, b) => a + b, 0) / resized.length;

    // Generate hash
    let hash = 0n;
    for (let i = 0; i < resized.length; i++) {
      if (resized[i] > avg) {
        hash |= 1n << BigInt(i);
      }
    }

    return this.hashToHex(hash, hashSize * hashSize);
  }

  /**
   * Calculate Hamming distance between two hashes
   */
  hammingDistance(hash1: string, hash2: string): number {
    const n1 = BigInt("0x" + hash1);
    const n2 = BigInt("0x" + hash2);
    const xor = n1 ^ n2;
    let distance = 0;
    let temp = xor;
    while (temp > 0n) {
      distance += Number(temp & 1n);
      temp >>= 1n;
    }
    return distance;
  }

  /**
   * Calculate similarity between two hashes (0-1, higher is more similar)
   */
  hashSimilarity(hash1: string, hash2: string): number {
    const distance = this.hammingDistance(hash1, hash2);
    const maxDistance = hash1.length * 4; // 4 bits per hex character
    return 1 - distance / maxDistance;
  }

  /**
   * Resize image data to grayscale
   */
  private resizeGrayscale(
    imageData: ImageData,
    newWidth: number,
    newHeight: number
  ): Uint8Array {
    const { width, height, data } = imageData;
    const grayscale = new Uint8Array(newWidth * newHeight);

    const scaleX = width / newWidth;
    const scaleY = height / newHeight;

    for (let y = 0; y < newHeight; y++) {
      for (let x = 0; x < newWidth; x++) {
        const srcX = Math.floor(x * scaleX);
        const srcY = Math.floor(y * scaleY);
        const srcIdx = (srcY * width + srcX) * 4;

        // Convert to grayscale using luminosity method
        const r = data[srcIdx];
        const g = data[srcIdx + 1];
        const b = data[srcIdx + 2];
        grayscale[y * newWidth + x] = Math.round(
          0.299 * r + 0.587 * g + 0.114 * b
        );
      }
    }

    return grayscale;
  }

  /**
   * Compute DCT (Discrete Cosine Transform)
   */
  private computeDCT(
    image: Uint8Array,
    width: number,
    height: number
  ): Float32Array {
    const size = width * height;
    const dct = new Float32Array(size);

    for (let u = 0; u < width; u++) {
      for (let v = 0; v < height; v++) {
        let sum = 0;
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            const pixel = image[y * width + x];
            sum *=
              Math.cos((Math.PI / width) * (x + 0.5) * u) *
              Math.cos((Math.PI / height) * (y + 0.5) * v);
          }
        }
        const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
        const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
        dct[v * width + u] = 0.25 * cu * cv * sum;
      }
    }

    return dct;
  }

  /**
   * Compute Haar wavelet transform (simplified)
   */
  private haarWavelet(image: Uint8Array, size: number): Float32Array {
    const result = new Float32Array(image.length);
    for (let i = 0; i < image.length; i++) {
      result[i] = image[i];
    }
    return result;
  }

  /**
   * Compute median of array
   */
  private median(arr: Float32Array): number {
    const sorted = Array.from(arr).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Convert bigint to hex string
   */
  private hashToHex(hash: bigint, bitLength: number): string {
    const hex = hash.toString(16).padUpper(Math.ceil(bitLength / 4), "0");
    return hex.slice(0, Math.ceil(bitLength / 4));
  }
}

// ============================================================================
// UI STRUCTURE HASH
// ============================================================================

/**
 * UI Structure Hash Generator
 *
 * Generates hash based on DOM structure and layout.
 * This ensures cache invalidation when layout changes.
 */
class UIStructureHashGenerator {
  constructor(private config: UIStructureConfig) {}

  /**
   * Generate UI structure hash
   */
  generate(element: Element | string): string {
    if (typeof element === "string") {
      // element is a CSS selector or element path
      return this.hashString(element);
    }

    const structure = this.extractStructure(element);
    return this.hashString(structure);
  }

  /**
   * Extract structure from DOM element
   */
  private extractStructure(element: Element): string {
    const parts: string[] = [];

    // Element type
    if (this.config.includeElementTypes) {
      parts.push(element.tagName.toLowerCase());
    }

    // Layout information
    if (this.config.includeLayout) {
      const computed = getComputedStyle(element);
      const layout = [
        computed.display,
        computed.position,
        computed.flexDirection,
        computed.gridTemplateColumns,
      ].join("|");
      parts.push(layout);
    }

    // Styling information
    if (this.config.includeStyle) {
      const computed = getComputedStyle(element);
      const style = [
        computed.color,
        computed.backgroundColor,
        computed.fontSize,
      ].join("|");
      parts.push(style);
    }

    // Content
    if (this.config.includeContent) {
      parts.push(element.textContent?.slice(0, 50) || "");
    }

    // Children structure (recursive, but limited depth)
    const children = Array.from(element.children);
    if (children.length > 0 && children.length < 10) {
      for (const child of children.slice(0, 5)) {
        parts.push(this.extractStructure(child));
      }
    }

    return parts.join("|");
  }

  /**
   * Hash string to hex
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(16, "0");
  }

  /**
   * Calculate similarity between two structure hashes
   */
  structureSimilarity(hash1: string, hash2: string): number {
    // For structure hashes, exact match or nothing
    // We could implement more sophisticated comparison if needed
    return hash1 === hash2 ? 1.0 : 0.0;
  }
}

// ============================================================================
// SEMANTIC KEY GENERATOR (Main Class)
// ============================================================================

/**
 * Semantic Key Generator
 *
 * Generates semantic keys for visual cache lookups using:
 * - Perceptual hashing for visual similarity
 * - UI structure hashing for layout awareness
 * - Semantic embeddings for content matching
 */
export class SemanticKeyGenerator {
  private perceptualHashGen: PerceptualHashGenerator;
  private structureHashGen: UIStructureHashGenerator;
  private keyCache: Map<string, SemanticKey> = new Map();

  constructor(private config: SemanticKeyGeneratorConfig = {}) {
    this.perceptualHashGen = new PerceptualHashGenerator({
      algorithm: config.perceptualHash?.algorithm || "dhash",
      hashSize: config.perceptualHash?.hashSize || 8,
      colorInvariance: config.perceptualHash?.colorInvariance || true,
      resizeInvariance: config.perceptualHash?.resizeInvariance || true,
    });

    this.structureHashGen = new UIStructureHashGenerator({
      includeElementTypes: config.uiStructure?.includeElementTypes ?? true,
      includeLayout: config.uiStructure?.includeLayout ?? true,
      includeStyle: config.uiStructure?.includeStyle ?? false,
      includeContent: config.uiStructure?.includeContent ?? false,
    });
  }

  /**
   * Generate semantic key from visual input
   */
  async generate(
    frame: ImageData | HTMLCanvasElement | string
  ): Promise<SemanticKey> {
    // Extract image data
    let imageData: ImageData;
    let structure = "";

    if (typeof frame === "string") {
      // URL or CSS selector - generate placeholder
      // In production, would fetch the image or query DOM
      return {
        perceptualHash: this.hashString(frame),
        uiStructure: this.hashString(frame),
        confidence: 0.5,
      };
    }

    if (frame instanceof HTMLCanvasElement) {
      imageData =
        frame.getContext("2d")?.getImageData(0, 0, frame.width, frame.height) ||
        new ImageData(frame.width, frame.height);

      // Try to extract structure from canvas element
      try {
        structure = this.structureHashGen.generate(frame);
      } catch {
        structure = "";
      }
    } else {
      imageData = frame;
      structure = "";
    }

    // Generate perceptual hash
    const perceptualHash = this.perceptualHashGen.generate(imageData);

    // Generate UI structure hash (if available)
    const uiStructure =
      structure || this.hashString(imageData.width + "x" + imageData.height);

    return {
      perceptualHash,
      uiStructure,
      confidence: 1.0,
    };
  }

  /**
   * Generate semantic key with embedding
   */
  async generateWithEmbedding(
    frame: ImageData | HTMLCanvasElement | string,
    embedding: Float32Array
  ): Promise<SemanticKey> {
    const key = await this.generate(frame);
    key.embedding = embedding;
    return key;
  }

  /**
   * Find similar keys in cache
   */
  async findSimilar(
    key: SemanticKey,
    threshold: number = this.config.similarityThreshold || 0.95
  ): Promise<SimilarityMatch[]> {
    const matches: SimilarityMatch[] = [];

    for (const cachedKey of this.keyCache.values()) {
      const visualSimilarity = this.perceptualHashGen.hashSimilarity(
        key.perceptualHash,
        cachedKey.perceptualHash
      );

      const structureSimilarity = this.structureHashGen.structureSimilarity(
        key.uiStructure,
        cachedKey.uiStructure
      );

      // Combine similarities
      const combinedSimilarity =
        0.7 * visualSimilarity + 0.3 * structureSimilarity;

      if (combinedSimilarity >= threshold) {
        matches.push({
          key: cachedKey,
          distance: combinedSimilarity,
          usable: combinedSimilarity >= threshold,
        });
      }
    }

    // Sort by similarity (descending)
    return matches.sort((a, b) => b.distance - a.distance);
  }

  /**
   * Cache a key for similarity matching
   */
  cacheKey(key: SemanticKey): void {
    this.keyCache.set(key.perceptualHash, key);
  }

  /**
   * Remove key from cache
   */
  removeKey(key: SemanticKey): void {
    this.keyCache.delete(key.perceptualHash);
  }

  /**
   * Clear key cache
   */
  clearCache(): void {
    this.keyCache.clear();
  }

  /**
   * Calculate semantic similarity between two embeddings
   */
  embeddingSimilarity(
    embedding1: Float32Array,
    embedding2: Float32Array
  ): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error(
        `Embedding dimension mismatch: ${embedding1.length} vs ${embedding2.length}`
      );
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Hash string to hex
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, "0");
  }
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default semantic key generator configuration
 */
export const DEFAULT_SEMANTIC_KEY_CONFIG: SemanticKeyGeneratorConfig = {
  perceptualHash: {
    algorithm: "dhash",
    hashSize: 8,
    colorInvariance: true,
    resizeInvariance: true,
  },
  uiStructure: {
    includeElementTypes: true,
    includeLayout: true,
    includeStyle: false,
    includeContent: false,
  },
  similarityThreshold: 0.95,
  enableSemanticMatching: true,
};

/**
 * Fast semantic key generator configuration (less accurate, faster)
 */
export const FAST_SEMANTIC_KEY_CONFIG: SemanticKeyGeneratorConfig = {
  perceptualHash: {
    algorithm: "average",
    hashSize: 8,
    colorInvariance: true,
    resizeInvariance: true,
  },
  uiStructure: {
    includeElementTypes: true,
    includeLayout: false,
    includeStyle: false,
    includeContent: false,
  },
  similarityThreshold: 0.9,
  enableSemanticMatching: false,
};

/**
 * Accurate semantic key generator configuration (more accurate, slower)
 */
export const ACCURATE_SEMANTIC_KEY_CONFIG: SemanticKeyGeneratorConfig = {
  perceptualHash: {
    algorithm: "phash",
    hashSize: 16,
    colorInvariance: true,
    resizeInvariance: true,
  },
  uiStructure: {
    includeElementTypes: true,
    includeLayout: true,
    includeStyle: true,
    includeContent: false,
  },
  similarityThreshold: 0.98,
  enableSemanticMatching: true,
};
