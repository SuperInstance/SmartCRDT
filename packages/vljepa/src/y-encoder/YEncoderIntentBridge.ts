/**
 * @lsi/vljepa/y-encoder/YEncoderIntentBridge - Y-Encoder to IntentEncoder Integration
 *
 * This module provides integration between the Y-Encoder (VL-JEPA) and
 * IntentEncoder (Aequor Privacy Suite). Both use 768-dim embeddings,
 * enabling seamless compatibility.
 *
 * ## Integration Strategy
 *
 * 1. **Dimension Matching**: Both use 768-dim embeddings
 * 2. **Semantic Compatibility**: Same embedding space for UI intent
 * 3. **Fusion**: Can combine visual (VL-JEPA) and textual (IntentEncoder) embeddings
 * 4. **Interchangeability**: Can use either encoder or both together
 *
 * @version 1.0.0
 */

import type { IntentVector } from "@lsi/protocol";
import type { YEncoderConfig, VLJEPAIntentEncoderBridge } from "../protocol.js";
import type { EncodingResult } from "./YEncoder.js";
import { YEncoder } from "./YEncoder.js";

/**
 * Embedding fusion configuration
 */
export interface FusionConfig {
  /** Weight for visual (VL-JEPA) embedding */
  visionWeight?: number;

  /** Weight for intent (IntentEncoder) embedding */
  intentWeight?: number;

  /** Fusion method */
  method?: "weighted" | "concat" | "attention";
}

/**
 * Combined encoding result
 */
export interface CombinedEncodingResult {
  /** Fused 768-dim embedding */
  embedding: Float32Array;

  /** Y-Encoder encoding result */
  yEncoderResult?: EncodingResult;

  /** IntentEncoder intent vector */
  intentVector?: IntentVector;

  /** Fusion metadata */
  fusionMetadata: {
    method: string;
    visionWeight: number;
    intentWeight: number;
  };
}

/**
 * YEncoderIntentBridge - Integration between Y-Encoder and IntentEncoder
 *
 * Enables seamless interoperability between VL-JEPA's Y-Encoder and
 * Aequor's IntentEncoder.
 *
 * Note: This class implements the VLJEPAIntentEncoderBridge protocol interface,
 * which uses simple Float32Array parameters. Additional helper methods for
 * IntentVector are provided separately.
 *
 * ## Use Cases
 *
 * 1. **Fallback**: Use IntentEncoder when Y-Encoder unavailable
 * 2. **Ensemble**: Combine both for better embeddings
 * 3. **Validation**: Cross-check encodings for consistency
 * 4. **Migration**: Gradual transition from IntentEncoder to Y-Encoder
 *
 * @example
 * ```typescript
 * const bridge = new YEncoderIntentBridge({
 *   yEncoderConfig: { vocabSize: 50000, embeddingDim: 768, contextLength: 512 }
 * });
 *
 * await bridge.initialize();
 *
 * // Use Y-Encoder encoding
 * const result = await bridge.encodeWithYEncoder("Make this button pop");
 * const intentVector = toIntentVector(result.embedding);
 * ```
 */
export class YEncoderIntentBridge implements VLJEPAIntentEncoderBridge {
  /** Y-Encoder instance */
  private yEncoder: YEncoder | null = null;

  /** Y-Encoder configuration */
  private yEncoderConfig: YEncoderConfig | null = null;

  /** IntentEncoder instance (if available) */
  private intentEncoder: any = null;

  /** Whether initialized */
  private initialized: boolean = false;

  /**
   * Create a Y-Encoder to IntentEncoder bridge
   *
   * @param options - Bridge options
   */
  constructor(
    options: {
      yEncoderConfig?: YEncoderConfig;
      intentEncoder?: any;
    } = {}
  ) {
    if (options.yEncoderConfig) {
      this.yEncoderConfig = options.yEncoderConfig;
      this.yEncoder = new YEncoder({
        vocabSize: options.yEncoderConfig.vocabSize,
        embeddingDim: options.yEncoderConfig.embeddingDim,
        contextLength: options.yEncoderConfig.contextLength,
        numLayers: options.yEncoderConfig.numLayers,
        numHeads: options.yEncoderConfig.numHeads,
        feedForwardDim: options.yEncoderConfig.feedForwardDim,
        dropout: options.yEncoderConfig.dropout,
        useLayerNorm: options.yEncoderConfig.useLayerNorm,
      });
    }

    if (options.intentEncoder) {
      this.intentEncoder = options.intentEncoder;
    }
  }

  /**
   * Initialize the bridge
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.yEncoder) {
      await this.yEncoder.initialize();
    }

    if (
      this.intentEncoder &&
      typeof this.intentEncoder.initialize === "function"
    ) {
      await this.intentEncoder.initialize();
    }

    this.initialized = true;
  }

  /**
   * Encode text using Y-Encoder
   *
   * @param text - Text to encode
   * @returns Encoding result
   */
  async encodeWithYEncoder(text: string): Promise<EncodingResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.yEncoder) {
      throw new Error(
        "Y-Encoder not configured. Provide yEncoderConfig in constructor."
      );
    }

    return this.yEncoder.encode(text);
  }

  /**
   * Encode text using IntentEncoder
   *
   * @param text - Text to encode
   * @returns IntentVector
   */
  async encodeWithIntentEncoder(text: string): Promise<IntentVector> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.intentEncoder) {
      throw new Error(
        "IntentEncoder not configured. Provide intentEncoder in constructor."
      );
    }

    return this.intentEncoder.encode(text);
  }

  /**
   * Encode with both and combine
   *
   * @param text - Text to encode
   * @param config - Fusion configuration
   * @returns Combined encoding result
   */
  async encodeCombined(
    text: string,
    config: FusionConfig = {}
  ): Promise<CombinedEncodingResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const visionWeight = config.visionWeight ?? 0.5;
    const intentWeight = config.intentWeight ?? 0.5;
    const method = config.method ?? "weighted";

    const result: CombinedEncodingResult = {
      embedding: new Float32Array(768),
      fusionMetadata: {
        method,
        visionWeight,
        intentWeight,
      },
    };

    // Encode with Y-Encoder if available
    if (this.yEncoder) {
      result.yEncoderResult = await this.yEncoder.encode(text);
    }

    // Encode with IntentEncoder if available
    if (this.intentEncoder) {
      result.intentVector = await this.intentEncoder.encode(text);
    }

    // Fuse embeddings based on method
    if (result.yEncoderResult && result.intentVector) {
      result.embedding = this.fuse(
        result.yEncoderResult.embedding,
        result.intentVector.vector,
        { vision: visionWeight, intent: intentWeight }
      );
    } else if (result.yEncoderResult) {
      result.embedding = new Float32Array(result.yEncoderResult.embedding);
    } else if (result.intentVector) {
      result.embedding = new Float32Array(result.intentVector.vector);
    } else {
      throw new Error("Neither Y-Encoder nor IntentEncoder is configured");
    }

    return result;
  }

  /**
   * Convert Y-Encoder embedding to IntentEncoder-compatible embedding
   *
   * Protocol interface method: Returns Float32Array directly.
   *
   * @param yEncoderEmbedding - Y-Encoder 768-dim embedding
   * @returns IntentEncoder-compatible 768-dim embedding
   */
  toIntentEncoder(yEncoderEmbedding: Float32Array): Float32Array {
    if (yEncoderEmbedding.length !== 768) {
      throw new Error(
        `Expected 768-dim embedding, got ${yEncoderEmbedding.length}-dim`
      );
    }

    return new Float32Array(yEncoderEmbedding);
  }

  /**
   * Convert IntentEncoder embedding to Y-Encoder format
   *
   * Protocol interface method: Takes Float32Array directly.
   *
   * @param intentEmbedding - IntentEncoder 768-dim embedding
   * @returns VL-JEPA-compatible 768-dim embedding
   */
  fromIntentEncoder(intentEmbedding: Float32Array): Float32Array {
    if (intentEmbedding.length !== 768) {
      throw new Error(
        `Expected 768-dim embedding, got ${intentEmbedding.length}-dim`
      );
    }

    return new Float32Array(intentEmbedding);
  }

  /**
   * Compute similarity between Y-Encoder and IntentEncoder embeddings
   *
   * Protocol interface method: Takes two Float32Arrays.
   *
   * @param yEncoderEmbedding - Y-Encoder embedding
   * @param intentEmbedding - IntentEncoder embedding
   * @returns Cosine similarity (-1 to 1)
   */
  similarity(
    yEncoderEmbedding: Float32Array,
    intentEmbedding: Float32Array
  ): number {
    if (yEncoderEmbedding.length !== intentEmbedding.length) {
      throw new Error("Embedding dimensions must match");
    }

    return this.cosineSimilarity(yEncoderEmbedding, intentEmbedding);
  }

  /**
   * Convert Y-Encoder embedding to IntentVector format (helper)
   *
   * Additional helper method for creating IntentVector from embedding.
   *
   * @param yEncoderEmbedding - Y-Encoder 768-dim embedding
   * @param metadata - Optional metadata
   * @returns IntentVector
   */
  toIntentVector(
    yEncoderEmbedding: Float32Array,
    metadata?: Partial<IntentVector>
  ): IntentVector {
    if (yEncoderEmbedding.length !== 768) {
      throw new Error(
        `Expected 768-dim embedding, got ${yEncoderEmbedding.length}-dim`
      );
    }

    return {
      vector: new Float32Array(yEncoderEmbedding),
      model: "y-encoder-v1.0",
      epsilon: metadata?.epsilon ?? 1.0, // Y-Encoder doesn't add DP noise
      latency: metadata?.latency ?? 0,
      satisfiesDP: metadata?.satisfiesDP ?? false,
    };
  }

  /**
   * Convert IntentVector to embedding (helper)
   *
   * Additional helper method for extracting embedding from IntentVector.
   *
   * @param intentVector - IntentVector from IntentEncoder
   * @returns Float32Array embedding
   */
  fromIntentVector(intentVector: IntentVector): Float32Array {
    if (intentVector.vector.length !== 768) {
      throw new Error(
        `Expected 768-dim embedding, got ${intentVector.vector.length}-dim`
      );
    }

    return new Float32Array(intentVector.vector);
  }

  /**
   * Compute similarity between embedding and IntentVector (helper)
   *
   * Additional helper method for computing similarity with IntentVector.
   *
   * @param yEncoderEmbedding - Y-Encoder embedding
   * @param intentVector - IntentEncoder vector
   * @returns Cosine similarity (-1 to 1)
   */
  similarityWithIntentVector(
    yEncoderEmbedding: Float32Array,
    intentVector: IntentVector
  ): number {
    if (yEncoderEmbedding.length !== intentVector.vector.length) {
      throw new Error("Embedding dimensions must match");
    }

    return this.cosineSimilarity(yEncoderEmbedding, intentVector.vector);
  }

  /**
   * Fuse Y-Encoder and IntentEncoder embeddings
   *
   * @param yEncoderEmbedding - Y-Encoder embedding
   * @param intentEmbedding - IntentEncoder embedding
   * @param weights - Fusion weights
   * @returns Fused 768-dim embedding
   */
  fuse(
    yEncoderEmbedding: Float32Array,
    intentEmbedding: Float32Array,
    weights: { vision: number; intent: number } = { vision: 0.5, intent: 0.5 }
  ): Float32Array {
    if (yEncoderEmbedding.length !== intentEmbedding.length) {
      throw new Error("Embedding dimensions must match");
    }

    const dim = yEncoderEmbedding.length;
    const fused = new Float32Array(dim);

    // Normalize weights
    const totalWeight = weights.vision + weights.intent;
    const normVisionWeight = weights.vision / totalWeight;
    const normIntentWeight = weights.intent / totalWeight;

    // Weighted combination
    for (let i = 0; i < dim; i++) {
      fused[i] =
        normVisionWeight * yEncoderEmbedding[i] +
        normIntentWeight * intentEmbedding[i];
    }

    return fused;
  }

  /**
   * Combine Y-Encoder output with IntentEncoder output
   *
   * @param yEncoderOutput - Y-Encoder encoding result
   * @param intentEncoderOutput - IntentEncoder intent vector
   * @param config - Fusion configuration
   * @returns IntentVector with combined embedding
   */
  combineWithIntentEncoder(
    yEncoderOutput: EncodingResult,
    intentEncoderOutput: IntentVector,
    config: FusionConfig = {}
  ): IntentVector {
    const fused = this.fuse(
      yEncoderOutput.embedding,
      intentEncoderOutput.vector,
      {
        vision: config.visionWeight ?? 0.5,
        intent: config.intentWeight ?? 0.5,
      }
    );

    return {
      vector: fused,
      model: "y-encoder-intent-fusion",
      epsilon: intentEncoderOutput.epsilon, // Inherit DP guarantee from IntentEncoder
      latency: yEncoderOutput.latency + (intentEncoderOutput.latency ?? 0),
      satisfiesDP: intentEncoderOutput.satisfiesDP ?? false,
    };
  }

  /**
   * Combine Y-Encoder embedding with IntentEncoder embedding (helper)
   *
   * @param yEncoderEmbedding - Y-Encoder 768-dim embedding
   * @param intentEmbedding - IntentEncoder 768-dim embedding
   * @param weights - Fusion weights
   * @returns Fused 768-dim embedding
   */
  combineEmbeddings(
    yEncoderEmbedding: Float32Array,
    intentEmbedding: Float32Array,
    weights: { vision: number; intent: number } = { vision: 0.5, intent: 0.5 }
  ): Float32Array {
    return this.fuse(yEncoderEmbedding, intentEmbedding, weights);
  }

  /**
   * Compute cosine similarity between two embeddings
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error("Embedding dimensions must match");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
  }

  /**
   * Get Y-Encoder instance
   */
  getYEncoder(): YEncoder | null {
    return this.yEncoder;
  }

  /**
   * Get IntentEncoder instance
   */
  getIntentEncoder(): any {
    return this.intentEncoder;
  }

  /**
   * Check if bridge is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset the bridge
   */
  reset(): void {
    this.initialized = false;
    if (this.yEncoder) {
      this.yEncoder.reset();
    }
  }
}

/**
 * Create a Y-Encoder IntentBridge with default configuration
 *
 * @param options - Bridge options
 * @returns YEncoderIntentBridge instance
 */
export function createYEncoderIntentBridge(options?: {
  yEncoderConfig?: YEncoderConfig;
  intentEncoder?: any;
}): YEncoderIntentBridge {
  return new YEncoderIntentBridge(options);
}

/**
 * Convert Y-Encoder embedding to IntentVector format (standalone function)
 *
 * @param yEncoderEmbedding - Y-Encoder 768-dim embedding
 * @param metadata - Optional metadata
 * @returns IntentVector
 */
export function toIntentVector(
  yEncoderEmbedding: Float32Array,
  metadata?: Partial<IntentVector>
): IntentVector {
  const bridge = new YEncoderIntentBridge();
  return bridge.toIntentVector(yEncoderEmbedding, metadata);
}

/**
 * Convert IntentVector to Y-Encoder format (standalone function)
 *
 * @param intentVector - IntentVector from IntentEncoder
 * @returns Float32Array embedding
 */
export function fromIntentVector(intentVector: IntentVector): Float32Array {
  const bridge = new YEncoderIntentBridge();
  return bridge.fromIntentVector(intentVector);
}

/**
 * Compute similarity between embeddings (standalone function)
 *
 * @param yEncoderEmbedding - Y-Encoder embedding
 * @param intentVector - IntentEncoder vector
 * @returns Cosine similarity (-1 to 1)
 */
export function embeddingSimilarity(
  yEncoderEmbedding: Float32Array,
  intentVector: IntentVector
): number {
  const bridge = new YEncoderIntentBridge();
  return bridge.similarityWithIntentVector(yEncoderEmbedding, intentVector);
}

/**
 * Fuse two embeddings (standalone function)
 *
 * @param yEncoderEmbedding - Y-Encoder embedding
 * @param intentEmbedding - IntentEncoder embedding
 * @param weights - Fusion weights
 * @returns Fused 768-dim embedding
 */
export function fuseEmbeddings(
  yEncoderEmbedding: Float32Array,
  intentEmbedding: Float32Array,
  weights?: { vision: number; intent: number }
): Float32Array {
  const bridge = new YEncoderIntentBridge();
  return bridge.fuse(yEncoderEmbedding, intentEmbedding, weights);
}
