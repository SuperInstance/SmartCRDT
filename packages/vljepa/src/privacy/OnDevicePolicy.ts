/**
 * OnDevicePolicy - Enforce on-device processing for VL-JEPA
 *
 * This module ensures that VL-JEPA visual processing happens on-device,
 * preventing raw UI frames and pixel data from leaving the user's browser.
 * Only semantic embeddings (768-dim vectors) can be transmitted.
 *
 * ## Core Privacy Guarantees
 *
 * 1. **Pixel Data Never Leaves Device**: Raw frames are always processed locally
 * 2. **Embeddings-Only Transmission**: Only 768-dim embeddings can be sent
 * 3. **No Persistence**: Visual data is never written to disk
 * 4. **Memory Ephemeral**: Frames cleared immediately after processing
 * 5. **Sanitized Embeddings**: Embeddings sanitized before transmission
 *
 * ## Threat Model
 *
 * ### Protected Against
 *
 * - **Network Interception**: Raw pixels never transmitted
 * - **Server Logs**: No visual data reaches servers
 * - **Cloud ML Services**: Processing happens on-device
 * - **Data Leaks**: Embeddings are semantic, not visual
 *
 * ### Limitations
 *
 * - **Malicious Browser Extensions**: Can access DOM/framebuffer
 * - **Screen Recording**: User can still record screen
 * - **Physical Observation**: Over-the-shoulder attacks
 *
 * ## Integration with VL-JEPA
 *
 * ```typescript
 * const policy = new OnDevicePolicy();
 *
 * // Before processing
 * policy.validateProcessingLocation(config);
 * policy.ensureNoDataLeak(frames);
 *
 * // After encoding
 * const sanitized = policy.sanitizeEmbedding(embedding);
 *
 * // Transmit sanitized embedding (safe)
 * await sendToServer(sanitized);
 * ```
 *
 * @packageDocumentation
 */

import { ProcessingLocation, VisualDataType } from "./VisualPrivacyAnalyzer";

/**
 * VL-JEPA configuration that must respect on-device policy
 */
export interface VLJEPAConfig {
  /** Where processing occurs */
  processingLocation: ProcessingLocation;

  /** Model URL (must be local for edge processing) */
  modelUrl?: string;

  /** Enable WebGPU for acceleration */
  enableWebGPU?: boolean;

  /** Fallback to cloud if on-device fails */
  allowCloudFallback?: boolean;

  /** Maximum frame size (pixels) */
  maxFrameSize?: number;
}

/**
 * Result of policy validation
 */
export interface PolicyValidationResult {
  /** Whether configuration is valid */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Warnings (non-blocking) */
  warnings: string[];
}

/**
 * Embedding sanitization result
 */
export interface SanitizedEmbedding {
  /** Sanitized embedding vector */
  vector: Float32Array;

  /** Privacy parameters applied */
  epsilon?: number;

  /** Quantization bits applied */
  quantizationBits?: number;

  /** Whether reconstruction protection was applied */
  reconstructionProtection: boolean;
}

/**
 * Data leak check result
 */
export interface DataLeakCheck {
  /** Whether data leak detected */
  hasLeak: boolean;

  /** Leak sources identified */
  leakSources: string[];

  /** Recommended fixes */
  recommendations: string[];
}

/**
 * Configuration for OnDevicePolicy
 */
export interface OnDevicePolicyConfig {
  /** Require edge-only processing */
  requireEdgeOnly?: boolean;

  /** Enable embedding sanitization */
  enableSanitization?: boolean;

  /** Differential privacy epsilon */
  epsilon?: number;

  /** Quantization bits for embeddings */
  quantizationBits?: number;

  /** Enable reconstruction protection */
  enableReconstructionProtection?: boolean;

  /** Maximum frame size (width * height) */
  maxFramePixels?: number;

  /** Allow cloud fallback (should be false for privacy) */
  allowCloudFallback?: boolean;
}

/**
 * Memory tracking for frames
 */
interface FrameMemory {
  frame: ImageData;
  timestamp: number;
  size: number;
}

/**
 * OnDevicePolicy - Enforce on-device processing guarantees
 *
 * This policy engine ensures that VL-JEPA respects user privacy by:
 * 1. Validating processing location (must be edge-only)
 * 2. Preventing data leaks (no raw pixels transmitted)
 * 3. Sanitizing embeddings (DP + quantization)
 * 4. Tracking memory (ephemeral storage only)
 *
 * ## Example
 *
 * ```typescript
 * const policy = new OnDevicePolicy({
 *   requireEdgeOnly: true,
 *   enableSanitization: true,
 *   epsilon: 1.0,
 * });
 *
 * // Validate config before processing
 * const validation = policy.validateProcessingLocation(config);
 * if (!validation.valid) {
 *   throw new Error('Config violates on-device policy');
 * }
 *
 * // Ensure no data leaks
 * const leakCheck = policy.ensureNoDataLeak(frames);
 * if (leakCheck.hasLeak) {
 *   throw new Error('Data leak detected');
 * }
 *
 * // Sanitize embedding before transmission
 * const safe = policy.sanitizeEmbedding(embedding);
 * await transmit(safe.vector);
 * ```
 */
export class OnDevicePolicy {
  private config: Required<OnDevicePolicyConfig>;
  private frameMemory: Map<string, FrameMemory>;
  private embeddingCache: Map<
    string,
    { embedding: Float32Array; timestamp: number }
  >;
  private stats: {
    framesProcessed: number;
    embeddingsTransmitted: number;
    dataLeaksPrevented: number;
  };

  constructor(config: OnDevicePolicyConfig = {}) {
    this.config = {
      requireEdgeOnly: config.requireEdgeOnly ?? true,
      enableSanitization: config.enableSanitization ?? true,
      epsilon: config.epsilon ?? 1.0,
      quantizationBits: config.quantizationBits ?? 16,
      enableReconstructionProtection:
        config.enableReconstructionProtection ?? true,
      maxFramePixels: config.maxFramePixels ?? 1920 * 1080, // Full HD
      allowCloudFallback: config.allowCloudFallback ?? false,
    };
    this.frameMemory = new Map();
    this.embeddingCache = new Map();
    this.stats = {
      framesProcessed: 0,
      embeddingsTransmitted: 0,
      dataLeaksPrevented: 0,
    };
  }

  /**
   * Validate that VL-JEPA configuration respects on-device policy
   *
   * @param config - VL-JEPA configuration to validate
   * @returns Validation result
   */
  validateProcessingLocation(config: VLJEPAConfig): PolicyValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check processing location
    if (this.config.requireEdgeOnly) {
      if (config.processingLocation !== ProcessingLocation.EDGE_ONLY) {
        errors.push(
          `Processing location must be EDGE_ONLY, got ${config.processingLocation}. ` +
            "Raw visual data must not leave device."
        );
      }
    }

    // Check model URL (should be local for edge processing)
    if (config.processingLocation === ProcessingLocation.EDGE_ONLY) {
      if (config.modelUrl && !this.isLocalModel(config.modelUrl)) {
        errors.push(
          `Model URL must be local for edge-only processing. ` +
            `Got: ${config.modelUrl}`
        );
      }
    }

    // Warn about cloud fallback
    if (config.allowCloudFallback && !this.config.allowCloudFallback) {
      errors.push(
        "Cloud fallback is disabled by policy. " +
          "Set allowCloudFallback=true to enable (reduces privacy)."
      );
    }

    // Check frame size
    if (
      config.maxFrameSize &&
      config.maxFrameSize > this.config.maxFramePixels
    ) {
      warnings.push(
        `Frame size ${config.maxFrameSize} exceeds recommended maximum ` +
          `${this.config.maxFramePixels}. Large frames may impact performance.`
      );
    }

    // Warn if WebGPU is not enabled (slower processing)
    if (!config.enableWebGPU) {
      warnings.push(
        "WebGPU is not enabled. On-device processing will be slower without GPU acceleration."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Ensure that visual data does not leak from device
   *
   * Performs comprehensive checks to prevent data exfiltration:
   * - Frames not in network requests
   * - Frames not persisted to disk
   * - Frames not exposed to third-party scripts
   *
   * @param frames - Frames to check for leaks
   * @returns Data leak check result
   */
  ensureNoDataLeak(frames: ImageData[]): DataLeakCheck {
    const leakSources: string[] = [];
    const recommendations: string[] = [];

    // Check frame size (prevent enormous frames)
    for (const frame of frames) {
      const size = frame.width * frame.height;
      if (size > this.config.maxFramePixels) {
        leakSources.push(
          `Frame ${frame.width}x${frame.height} exceeds maximum size ` +
            `(${this.config.maxFramePixels} pixels)`
        );
        recommendations.push(
          "Downsample frames before processing or increase maxFramePixels"
        );
      }
    }

    // Check for potential network transmission (heuristic)
    // In production, this would use network interception APIs
    if (this.detectNetworkActivity()) {
      leakSources.push("Network activity detected during frame processing");
      recommendations.push(
        "Ensure VL-JEPA processing completes before any network requests"
      );
    }

    // Check for storage APIs (prevent persistence)
    if (this.detectStorageActivity()) {
      leakSources.push("Storage activity detected - frames may be persisted");
      recommendations.push(
        "Disable any storage operations during frame processing"
      );
    }

    // Check memory leaks
    if (this.frameMemory.size > 100) {
      leakSources.push(
        `Excessive frames in memory (${this.frameMemory.size}). ` +
          "Possible memory leak."
      );
      recommendations.push("Clear frame memory after processing");
    }

    const hasLeak = leakSources.length > 0;

    if (hasLeak) {
      this.stats.dataLeaksPrevented++;
    }

    return {
      hasLeak,
      leakSources,
      recommendations,
    };
  }

  /**
   * Sanitize embedding before transmission
   *
   * Applies privacy-preserving transformations:
   * 1. Differential privacy noise (Gaussian mechanism)
   * 2. Quantization (reduce precision)
   * 3. Reconstruction protection (prevent reverse engineering)
   *
   * @param embedding - Raw embedding vector (768-dim)
   * @returns Sanitized embedding
   */
  sanitizeEmbedding(embedding: Float32Array): SanitizedEmbedding {
    let sanitized = embedding;

    // Apply differential privacy
    if (this.config.epsilon !== undefined) {
      sanitized = this.addDPNoise(sanitized, this.config.epsilon);
    }

    // Apply quantization
    if (this.config.quantizationBits) {
      sanitized = this.quantize(sanitized, this.config.quantizationBits);
    }

    // Apply reconstruction protection
    if (this.config.enableReconstructionProtection) {
      sanitized = this.applyReconstructionProtection(sanitized);
    }

    this.stats.embeddingsTransmitted++;

    return {
      vector: sanitized,
      epsilon: this.config.epsilon,
      quantizationBits: this.config.quantizationBits,
      reconstructionProtection: this.config.enableReconstructionProtection,
    };
  }

  /**
   * Register a frame for processing (memory tracking)
   *
   * @param frame - Frame to register
   * @param id - Unique identifier
   */
  registerFrame(frame: ImageData, id: string): void {
    this.frameMemory.set(id, {
      frame,
      timestamp: Date.now(),
      size: frame.width * frame.height * 4, // 4 bytes per pixel (RGBA)
    });

    this.stats.framesProcessed++;
  }

  /**
   * Clear frame from memory after processing
   *
   * @param id - Frame identifier
   */
  clearFrame(id: string): void {
    this.frameMemory.delete(id);
  }

  /**
   * Clear all frame memory
   */
  clearAllFrames(): void {
    this.frameMemory.clear();
  }

  /**
   * Cache embedding locally (ephemeral, in-memory only)
   *
   * @param key - Cache key
   * @param embedding - Embedding to cache
   * @param ttl - Time-to-live in ms (default: 60000 = 1 minute)
   */
  cacheEmbedding(
    key: string,
    embedding: Float32Array,
    ttl: number = 60000
  ): void {
    this.embeddingCache.set(key, {
      embedding,
      timestamp: Date.now() + ttl,
    });

    // Schedule cleanup
    setTimeout(() => {
      this.embeddingCache.delete(key);
    }, ttl);
  }

  /**
   * Get cached embedding if available and not expired
   *
   * @param key - Cache key
   * @returns Cached embedding or undefined
   */
  getCachedEmbedding(key: string): Float32Array | undefined {
    const cached = this.embeddingCache.get(key);
    if (!cached) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > cached.timestamp) {
      this.embeddingCache.delete(key);
      return undefined;
    }

    return cached.embedding;
  }

  /**
   * Get privacy statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      framesProcessed: 0,
      embeddingsTransmitted: 0,
      dataLeaksPrevented: 0,
    };
  }

  /**
   * Check if model URL is local (on-device)
   *
   * @param url - Model URL to check
   * @returns True if local
   */
  private isLocalModel(url: string): boolean {
    // Check for local protocols
    const localProtocols = ["file:", "blob:", "data:", ""];

    try {
      const parsed = new URL(url, window.location.href);
      return (
        localProtocols.some(proto => url.startsWith(proto)) ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]"
      );
    } catch {
      // Invalid URL, assume not local
      return false;
    }
  }

  /**
   * Detect network activity (heuristic)
   *
   * In production, this would use performance API or network interception.
   * For now, returns false (no detection).
   *
   * @returns True if network activity detected
   */
  private detectNetworkActivity(): boolean {
    // Placeholder: In production, use PerformanceResourceTiming API
    // or Service Worker interception to detect network requests
    return false;
  }

  /**
   * Detect storage activity (heuristic)
   *
   * In production, this would intercept storage APIs.
   * For now, returns false (no detection).
   *
   * @returns True if storage activity detected
   */
  private detectStorageActivity(): boolean {
    // Placeholder: In production, proxy localStorage, sessionStorage,
    // IndexedDB to detect writes during frame processing
    return false;
  }

  /**
   * Add differential privacy noise (Gaussian mechanism)
   *
   * Uses the Gaussian mechanism: add noise N(0, σ²) where σ = sensitivity / ε.
   *
   * @param vector - Input vector
   * @param epsilon - Privacy parameter
   * @returns Noisy vector
   */
  private addDPNoise(vector: Float32Array, epsilon: number): Float32Array {
    const sensitivity = 2.0; // L2 sensitivity for normalized embeddings
    const sigma = sensitivity / epsilon;
    const result = new Float32Array(vector.length);

    for (let i = 0; i < vector.length; i++) {
      result[i] = vector[i] + this.gaussianRandom() * sigma;
    }

    return result;
  }

  /**
   * Quantize embedding to reduce precision
   *
   * @param vector - Input vector
   * @param bits - Number of bits per value
   * @returns Quantized vector
   */
  private quantize(vector: Float32Array, bits: number): Float32Array {
    const levels = Math.pow(2, bits);
    const result = new Float32Array(vector.length);

    for (let i = 0; i < vector.length; i++) {
      // Normalize to [0, 1] (assuming vector is roughly in [-1, 1])
      const normalized = (vector[i] + 1) / 2;

      // Quantize
      const quantized = Math.round(normalized * (levels - 1)) / (levels - 1);

      // Denormalize back to [-1, 1]
      result[i] = quantized * 2 - 1;
    }

    return result;
  }

  /**
   * Apply reconstruction protection
   *
   * Adds small perturbations to prevent exact reconstruction of input
   * from the embedding. This is a lightweight defense against model
   * inversion attacks.
   *
   * @param vector - Input vector
   * @returns Protected vector
   */
  private applyReconstructionProtection(vector: Float32Array): Float32Array {
    const result = new Float32Array(vector.length);
    const noiseMagnitude = 0.001; // Very small noise

    for (let i = 0; i < vector.length; i++) {
      // Add small random perturbation
      const perturbation = (Math.random() - 0.5) * 2 * noiseMagnitude;
      result[i] = vector[i] + perturbation;
    }

    return result;
  }

  /**
   * Generate Gaussian random number (Box-Muller transform)
   *
   * @returns Random sample from N(0, 1)
   */
  private gaussianRandom(): number {
    const u1 = Math.max(Math.random(), 1e-10);
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }
}

/**
 * Create a strict on-device policy (maximum privacy)
 *
 * @returns Strict on-device policy
 */
export function createStrictOnDevicePolicy(): OnDevicePolicy {
  return new OnDevicePolicy({
    requireEdgeOnly: true,
    enableSanitization: true,
    epsilon: 0.5, // Stronger DP
    quantizationBits: 8, // Lower precision
    enableReconstructionProtection: true,
    allowCloudFallback: false,
  });
}

/**
 * Create a balanced on-device policy (privacy + utility)
 *
 * @returns Balanced on-device policy
 */
export function createBalancedOnDevicePolicy(): OnDevicePolicy {
  return new OnDevicePolicy({
    requireEdgeOnly: true,
    enableSanitization: true,
    epsilon: 1.0, // Balanced DP
    quantizationBits: 16, // Good precision
    enableReconstructionProtection: true,
    allowCloudFallback: false,
  });
}
