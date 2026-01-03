/**
 * VisualIntentEncoder - Intent encoding for visual data in VL-JEPA
 *
 * This module extends the IntentEncoder concept to handle visual data.
 * It encodes visual frames into intent vectors while maintaining privacy
 * through differential privacy and sanitization.
 *
 * ## Architecture
 *
 * This bridges VL-JEPA visual embeddings with the existing IntentEncoder:
 *
 * ```
 * Visual Frame (ImageData)
 *    ↓
 * VL-JEPA X-Encoder (Vision → 768-dim embedding)
 *    ↓
 * VisualIntentEncoder (Privacy + Sanitization)
 *    ↓
 * IntentVector (compatible with text intent vectors)
 *    ↓
 * CascadeRouter / CoAgents (unified intent handling)
 * ```
 *
 * ## Privacy Features
 *
 * 1. **Differential Privacy**: Gaussian noise (ε-DP)
 * 2. **Quantization**: Reduce embedding precision
 * 3. **Sanitization**: Prevent reconstruction attacks
 * 4. **Cache Control**: Ephemeral caching only
 *
 * @packageDocumentation
 */

import { IntentVector } from "@lsi/protocol";
import { OnDevicePolicy, SanitizedEmbedding } from "./OnDevicePolicy";
import { VisualPrivacyAnalyzer, VisualDataType } from "./VisualPrivacyAnalyzer";

/**
 * Configuration for Visual Intent Encoder
 */
export interface VisualIntentEncoderConfig {
  /** Privacy policy for encoding */
  onDevicePolicy: OnDevicePolicy;

  /** Enable visual privacy analysis before encoding */
  enablePrivacyAnalysis: boolean;

  /** Cache encoded embeddings (ephemeral) */
  enableCache: boolean;

  /** Cache TTL in milliseconds */
  cacheTTL: number;

  /** Maximum number of cached embeddings */
  maxCacheSize: number;
}

/**
 * Result of visual encoding
 */
export interface VisualIntentResult extends IntentVector {
  /** Type of visual data encoded */
  visualDataType: VisualDataType;

  /** Whether privacy analysis was performed */
  privacyAnalyzed: boolean;

  /** Privacy risk level (if analyzed) */
  riskLevel?: string;

  /** Whether PII was detected */
  piiDetected: boolean;
}

/**
 * Encoding options
 */
export interface VisualEncodingOptions {
  /** Privacy epsilon (default: from policy) */
  epsilon?: number;

  /** Skip privacy analysis (faster, less private) */
  skipPrivacyAnalysis?: boolean;

  /** Custom cache key */
  cacheKey?: string;
}

/**
 * VisualIntentEncoder - Encode visual data as intent vectors
 *
 * This encoder provides privacy-preserving visual intent encoding
 * compatible with the existing IntentEncoder for text.
 *
 * ## Example
 *
 * ```typescript
 * const encoder = new VisualIntentEncoder({
 *   onDevicePolicy: new OnDevicePolicy(),
 *   enablePrivacyAnalysis: true,
 * });
 *
 * const result = await encoder.encode(frame, VisualDataType.UI_FRAME);
 * console.log(result.vector); // Float32Array(768)
 * console.log(result.epsilon); // 1.0
 * console.log(result.piiDetected); // false
 * ```
 */
export class VisualIntentEncoder {
  private config: Required<VisualIntentEncoderConfig>;
  private privacyAnalyzer: VisualPrivacyAnalyzer;
  private cache: Map<string, { result: VisualIntentResult; expires: number }>;
  private modelLoaded: boolean = false;

  // Placeholder for VL-JEPA X-Encoder (will be implemented by Agent 1)
  private xEncoder: any = null;

  constructor(config: VisualIntentEncoderConfig) {
    this.config = {
      onDevicePolicy: config.onDevicePolicy,
      enablePrivacyAnalysis: config.enablePrivacyAnalysis ?? true,
      enableCache: config.enableCache ?? true,
      cacheTTL: config.cacheTTL ?? 60000, // 1 minute
      maxCacheSize: config.maxCacheSize ?? 100,
    };

    this.privacyAnalyzer = new VisualPrivacyAnalyzer({
      policy: this.config.onDevicePolicy.getPolicy() as any,
      verbose: false,
    });

    this.cache = new Map();
  }

  /**
   * Initialize the encoder
   *
   * Loads the VL-JEPA X-Encoder model for on-device processing.
   */
  async initialize(): Promise<void> {
    if (this.modelLoaded) {
      return;
    }

    // TODO: Initialize VL-JEPA X-Encoder
    // This will be implemented by Agent 1 (Core)
    // For now, we assume the model will be available

    this.modelLoaded = true;
  }

  /**
   * Encode visual frame as intent vector
   *
   * The encoding process:
   * 1. (Optional) Privacy analysis - detect PII, assess risk
   * 2. VL-JEPA X-Encoder - generate visual embedding
   * 3. On-device policy - sanitize with DP, quantization
   * 4. Return intent vector compatible with text intent vectors
   *
   * @param frame - Visual frame to encode
   * @param dataType - Type of visual data
   * @param options - Encoding options
   * @returns Visual intent result
   */
  async encode(
    frame: ImageData,
    dataType: VisualDataType,
    options?: VisualEncodingOptions
  ): Promise<VisualIntentResult> {
    if (!this.modelLoaded) {
      await this.initialize();
    }

    const startTime = Date.now();
    const skipPrivacy = options?.skipPrivacyAnalysis ?? false;

    // Step 1: Privacy analysis (if enabled)
    let piiDetected = false;
    let riskLevel: string | undefined;
    let analyzedFrame = frame;

    if (this.config.enablePrivacyAnalysis && !skipPrivacy) {
      const analysis = await this.privacyAnalyzer.analyze(frame, dataType);

      piiDetected = analysis.detectedPII.length > 0;
      riskLevel = analysis.riskLevel;

      // If high risk and PII detected, we may want to handle this
      // For now, we proceed but mark the result
      if (analysis.action === "block") {
        throw new Error(
          `Visual data blocked by privacy policy: ${analysis.violations.join(", ")}`
        );
      }
    }

    // Step 2: Check cache
    const cacheKey =
      options?.cacheKey ?? this.generateCacheKey(frame, dataType);
    if (this.config.enableCache) {
      const cached = this.getCached(cacheKey);
      if (cached) {
        return {
          ...cached,
          latency: Date.now() - startTime,
        };
      }
    }

    // Step 3: VL-JEPA X-Encoder (placeholder)
    // In production, this would call the actual VL-JEPA model
    const visualEmbedding = await this.encodeWithXEncoder(frame);

    // Step 4: Sanitize with on-device policy
    const sanitized = this.config.onDevicePolicy.sanitizeEmbedding(
      visualEmbedding,
      options?.epsilon
    );

    const latency = Date.now() - startTime;

    const result: VisualIntentResult = {
      vector: sanitized.vector,
      epsilon: sanitized.epsilon,
      model: "vl-jepa-x-encoder",
      latency,
      satisfiesDP: true,
      visualDataType: dataType,
      privacyAnalyzed: this.config.enablePrivacyAnalysis && !skipPrivacy,
      riskLevel,
      piiDetected,
    };

    // Step 5: Cache result
    if (this.config.enableCache) {
      this.setCached(cacheKey, result);
    }

    return result;
  }

  /**
   * Encode multiple frames in batch
   *
   * @param frames - Frames to encode
   * @param dataType - Type of visual data
   * @param options - Encoding options
   * @returns Array of visual intent results
   */
  async encodeBatch(
    frames: ImageData[],
    dataType: VisualDataType,
    options?: VisualEncodingOptions
  ): Promise<VisualIntentResult[]> {
    const results: VisualIntentResult[] = [];

    for (const frame of frames) {
      const result = await this.encode(frame, dataType, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Clear the encoding cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Shutdown the encoder and release resources
   */
  async shutdown(): Promise<void> {
    this.cache.clear();
    this.modelLoaded = false;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
    };
  }

  /**
   * Encode frame with VL-JEPA X-Encoder (placeholder)
   *
   * This is a placeholder that will be implemented by Agent 1 (Core).
   * In production, this will call the actual VL-JEPA model running on-device.
   *
   * @param frame - Frame to encode
   * @returns 768-dim visual embedding
   */
  private async encodeWithXEncoder(frame: ImageData): Promise<Float32Array> {
    // TODO: Implement actual VL-JEPA X-Encoder call
    // For now, return a placeholder embedding

    // In production, this would be:
    // const embedding = await this.xEncoder.encode(frame);

    // Placeholder: Generate deterministic embedding based on frame
    const embedding = new Float32Array(768);
    const data = frame.data;

    // Simple hash-based embedding (for testing only)
    for (let i = 0; i < 768; i++) {
      const idx = (i * 4) % data.length;
      embedding[i] = (data[idx] / 255.0 - 0.5) * 2; // Normalize to [-1, 1]
    }

    // Normalize to unit sphere
    let norm = 0;
    for (let i = 0; i < 768; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < 768; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  /**
   * Generate cache key for frame
   *
   * @param frame - Frame to cache
   * @param dataType - Data type
   * @returns Cache key
   */
  private generateCacheKey(frame: ImageData, dataType: VisualDataType): string {
    // Simple hash-based cache key
    // In production, could use perceptual hash for better cache hits

    const data = frame.data;
    let hash = 0;

    // Sample pixels for hash (don't read entire array for performance)
    const sampleRate = Math.max(1, Math.floor(data.length / 1000));
    for (let i = 0; i < data.length; i += sampleRate) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }

    return `${dataType}-${frame.width}x${frame.height}-${hash}`;
  }

  /**
   * Get cached result
   *
   * @param key - Cache key
   * @returns Cached result or undefined
   */
  private getCached(key: string): VisualIntentResult | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.result;
  }

  /**
   * Set cached result
   *
   * @param key - Cache key
   * @param result - Result to cache
   */
  private setCached(key: string, result: VisualIntentResult): void {
    // Enforce max cache size
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entry (first in map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      result,
      expires: Date.now() + this.config.cacheTTL,
    });
  }
}

/**
 * Create a default visual intent encoder
 *
 * @returns Configured visual intent encoder
 */
export function createDefaultVisualIntentEncoder(): VisualIntentEncoder {
  return new VisualIntentEncoder({
    onDevicePolicy: require("./OnDevicePolicy").createBalancedOnDevicePolicy(),
    enablePrivacyAnalysis: true,
    enableCache: true,
    cacheTTL: 60000,
    maxCacheSize: 100,
  });
}
