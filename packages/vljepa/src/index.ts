/**
 * @lsi/vljepa - VL-JEPA Integration for Aequor Platform
 *
 * Vision-Language Joint Embedding Predictive Architecture
 * Meta AI's breakthrough for semantic visual understanding.
 *
 * ========================================================================
 * VL-JEPA: THE COMPLETE PIPELINE
 * ========================================================================
 *
 * VL-JEPA (Vision-Language Joint Embedding Predictive Architecture) enables
 * real-time understanding of visual UI state and user intent through a
 * unified embedding space.
 *
 * ========================================================================
 * END-TO-END PIPELINE DIAGRAM
 * ========================================================================
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                          USER INPUT                                  │
 * │  ┌──────────────────────┐           ┌──────────────────────┐        │
 * │  │   Visual Context     │           │    User Intent        │        │
 * │  │  (UI Frame/Canvas)   │           │   ("Center button")   │        │
 * │  └──────────┬───────────┘           └──────────┬───────────┘        │
 * │             │                                  │                     │
 * │             ▼                                  ▼                     │
 * │  ┌──────────────────────┐           ┌──────────────────────┐        │
 * │  │     X-Encoder        │           │     Y-Encoder        │        │
 * │  │  (Vision Transformer)│           │  (Text Transformer)  │        │
 * │  │                       │           │                       │        │
 * │  │  1. Patch Embedding   │           │  1. Tokenization     │        │
 * │  │  2. Position Encoding │           │  2. Embedding Layer  │        │
 * │  │  3. 12x Attention     │           │  3. 6-12x Attention  │        │
 * │  │  4. Feed-Forward     │           │  4. Feed-Forward     │        │
 * │  │  5. CLS Token        │           │  5. Pooling          │        │
 * │  └──────────┬───────────┘           └──────────┬───────────┘        │
 * │             │                                  │                     │
 * │             │ Float32Array(768)                │ Float32Array(768)  │
 * │             │ (visual semantics)               │ (intent semantics) │
 * │             │                                  │                     │
 * │             └────────────┬─────────────────────┘                     │
 * │                          │                                           │
 * │                          ▼                                           │
 * │              ┌───────────────────────┐                               │
 * │              │    Embedding Combiner  │                               │
 * │              │   (Concatenate/Add)    │                               │
 * │              │                       │                               │
 * │              │  768 + 768 = 1536     │                               │
 * │              └───────────┬───────────┘                               │
 * │                          │                                           │
 * │                          ▼                                           │
 * │              ┌───────────────────────┐                               │
 * │              │      Predictor        │                               │
 * │              │  (Joint Embedding)     │                               │
 * │              │                       │                               │
 * │              │  1. Combine (1536)    │                               │
 * │              │  2. Transform Layers  │                               │
 * │              │  3. Goal Embedding    │                               │
 * │              └───────────┬───────────┘                               │
 * │                          │                                           │
 * │                          │ Float32Array(768)                         │
 * │                          │ (goal state semantics)                    │
 * │                          │                                           │
 * │            ┌─────────────┼─────────────┐                             │
 * │            ▼             ▼             ▼                             │
 * │    ┌─────────────┐ ┌─────────┐ ┌─────────────┐                      │
 * │    │ Confidence  │ │ Action  │ │  Semantic   │                      │
 * │    │  Scorer     │ │Generator│ │   Delta     │                      │
 * │    │             │ │         │ │             │                      │
 * │    │  How sure?  │ │ What do ││  Current →  │                      │
 * │    │  (0.92)     │ │ do?     ││  Goal       │                      │
 * │    └──────┬──────┘ └────┬────┘ └──────┬──────┘                      │
 * │           │              │              │                            │
 * │           └──────────────┼──────────────┘                            │
 * │                          ▼                                           │
 * │              ┌───────────────────────┐                               │
 * │              │    Output Actions     │                               │
 * │              │                       │                               │
 * │              │  [{                  │                               │
 * │              │    type: "modify",    │                               │
 * │              │    target: "#btn",    │                               │
 * │              │    params: {          │                               │
 * │              │      center: true     │                               │
 * │              │    },                 │                               │
 * │              │    confidence: 0.95   │                               │
 * │              │  }]                  │                               │
 * │              └───────────────────────┘                               │
 * └─────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ========================================================================
 * THE KEY INSIGHT: SHARED EMBEDDING SPACE
 * ========================================================================
 *
 * What makes VL-JEPA work is that BOTH encoders produce embeddings in the
 * SAME semantic space. This means:
 *
 * - "Button" seen by X-Encoder ≈ "button" read by Y-Encoder
 * - "Red" color value ≈ "red" text description
 * - "Center" layout position ≈ "center" alignment command
 *
 * When we combine these embeddings, the predictor learns to bridge the
 * gap between "what I see" (context) and "what I want" (intent).
 *
 * ========================================================================
 * WHY THIS IS BETTER THAN TRADITIONAL APPROACHES
 * ========================================================================
 *
 * Traditional VLMs (Vision-Language Models):
 * - Generate tokens autoregressively: "display" → ":" → "flex" → ...
 * - Slow: Need ~50 forward passes for one response
 * - Expensive: 72B+ parameters for good quality
 *
 * VL-JEPA:
 * - Direct embedding prediction: Single forward pass
 * - Fast: ~50ms total (30ms X-Enc + 15ms Y-Enc + 5ms Predictor)
 * - Efficient: 1.6B parameters (50% reduction)
 * - Semantic: Understands meaning, not just pixels/tokens
 *
 * Result: **2.85x faster inference** with **equal or better quality**
 *
 * ========================================================================
 * ARCHITECTURE COMPONENTS
 * ========================================================================
 *
 * 1. X-ENCODER (Vision)
 *    - Input: 224x224 RGB image
 *    - Architecture: Vision Transformer (ViT-Base)
 *    - Output: 768-dim semantic embedding
 *    - Time: ~30ms
 *    - Purpose: Extract visual semantics from UI frames
 *
 * 2. Y-ENCODER (Language)
 *    - Input: Text string (user intent)
 *    - Architecture: Transformer Encoder (BERT-style)
 *    - Output: 768-dim semantic embedding
 *    - Time: ~15ms
 *    - Purpose: Extract intent semantics from commands
 *
 * 3. PREDICTOR (Joint Embedding)
 *    - Input: Context (768) + Intent (768) = 1536-dim
 *    - Architecture: Multi-layer Transformer
 *    - Output: 768-dim goal state embedding
 *    - Time: ~5ms
 *    - Purpose: Predict desired state from current + intent
 *
 * 4. ACTION GENERATOR
 *    - Input: Goal embedding (768)
 *    - Method: Semantic delta analysis
 *    - Output: Specific UI actions
 *    - Purpose: Translate goal → executable actions
 *
 * ========================================================================
 * INTEGRATION WITH AEQUOR PLATFORM
 * ========================================================================
 *
 * - IntentEncoder: Shared 768-dim embedding space
 * - CoAgents: Goal embeddings drive agent state
 * - A2UI: Actions drive UI generation
 * - WebGPU: Browser-based inference
 *
 * ========================================================================
 * Key Features:
 * - 768-dim semantic embeddings (compatible with IntentEncoder)
 * - 2.85x faster inference than traditional VLMs
 * - 50% fewer parameters (1.6B vs 72B)
 * - Real-time video understanding at edge scale
 * - WebGPU-ready for browser inference
 *
 * @version 1.0.0
 * @see https://arxiv.org/abs/2512.10942
 */

// Import types from protocol
import type {
  XEncoderConfig,
  YEncoderConfig,
  PredictorConfig,
  VLJEPAConfig,
  VLJEPAPrediction,
  VLJEPAAction,
  VLJEPABridge,
  VLJEPAFactoryConfig,
  VLJEPAIntentEncoderBridge,
  VLJEPAA2UIBridge,
  VLJEPACoAgentsBridge,
} from "./protocol.js";

// Re-export types
export type {
  XEncoderConfig,
  YEncoderConfig,
  PredictorConfig,
  VLJEPAConfig,
  VLJEPAPrediction,
  VLJEPAAction,
  VLJEPABridge,
  VLJEPAFactoryConfig,
  VLJEPAIntentEncoderBridge,
  VLJEPAA2UIBridge,
  VLJEPACoAgentsBridge,
};

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * VL-JEPA Error Types
 */
export class VLJEPAError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "VLJEPAError";
  }
}

export class XEncoderError extends VLJEPAError {
  constructor(message: string, details?: unknown) {
    super(message, "X_ENCODER_ERROR", details);
    this.name = "XEncoderError";
  }
}

export class YEncoderError extends VLJEPAError {
  constructor(message: string, details?: unknown) {
    super(message, "Y_ENCODER_ERROR", details);
    this.name = "YEncoderError";
  }
}

export class PredictorError extends VLJEPAError {
  constructor(message: string, details?: unknown) {
    super(message, "PREDICTOR_ERROR", details);
    this.name = "PredictorError";
  }
}

export class EmbeddingDimensionError extends VLJEPAError {
  constructor(actual: number, expected: number) {
    super(
      `Invalid embedding dimension: expected ${expected}, got ${actual}`,
      "EMBEDDING_DIMENSION_ERROR",
      { actual, expected }
    );
    this.name = "EmbeddingDimensionError";
  }
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default embedding dimension for VL-JEPA
 * Matches IntentEncoder for compatibility
 */
export const DEFAULT_EMBEDDING_DIM = 768;

/**
 * Default input size for X-Encoder (Vision)
 */
export const DEFAULT_INPUT_SIZE = { width: 224, height: 224 };

/**
 * Default patch size for ViT
 */
export const DEFAULT_PATCH_SIZE = 16;

/**
 * Default context length for Y-Encoder (Language)
 */
export const DEFAULT_CONTEXT_LENGTH = 512;

/**
 * Default predictor hidden dimension
 */
export const DEFAULT_HIDDEN_DIM = 2048;

/**
 * VL-JEPA protocol version
 */
export const VLJEPA_VERSION = "1.0" as const;

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate that embedding has correct dimension
 *
 * @param embedding - Embedding to validate
 * @param expectedDim - Expected dimension (default: 768)
 * @returns Whether embedding is valid
 * @throws {EmbeddingDimensionError} If dimension is incorrect
 */
export function validateEmbeddingDimension(
  embedding: Float32Array,
  expectedDim: number = DEFAULT_EMBEDDING_DIM
): boolean {
  if (embedding.length !== expectedDim) {
    throw new EmbeddingDimensionError(embedding.length, expectedDim);
  }
  return true;
}

/**
 * Validate VL-JEPA configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result
 */
export function validateVLJEPAConfig(config: VLJEPAConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check X-Encoder
  if (config.xEncoder.embeddingDim !== DEFAULT_EMBEDDING_DIM) {
    errors.push(`X-Encoder embeddingDim must be ${DEFAULT_EMBEDDING_DIM}`);
  }

  // Check Y-Encoder
  if (config.yEncoder.embeddingDim !== DEFAULT_EMBEDDING_DIM) {
    errors.push(`Y-Encoder embeddingDim must be ${DEFAULT_EMBEDDING_DIM}`);
  }

  // Check Predictor
  if (config.predictor.inputDim !== DEFAULT_EMBEDDING_DIM * 2) {
    errors.push(`Predictor inputDim must be ${DEFAULT_EMBEDDING_DIM * 2}`);
  }
  if (config.predictor.outputDim !== DEFAULT_EMBEDDING_DIM) {
    errors.push(`Predictor outputDim must be ${DEFAULT_EMBEDDING_DIM}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate embedding dimension
 *
 * @param embedding - Embedding to validate
 * @param expectedDim - Expected dimension (default: 768)
 * @returns Whether embedding is valid
 */
export function validateEmbedding(
  embedding: Float32Array,
  expectedDim: number = DEFAULT_EMBEDDING_DIM
): boolean {
  return embedding.length === expectedDim;
}

/**
 * Validate VL-JEPA prediction
 *
 * @param prediction - Prediction to validate
 * @returns Validation result
 */
export function validatePrediction(prediction: VLJEPAPrediction): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check goal embedding
  if (prediction.goalEmbedding.length !== DEFAULT_EMBEDDING_DIM) {
    errors.push(`goalEmbedding must be ${DEFAULT_EMBEDDING_DIM}-dim`);
  }

  // Check confidence
  if (prediction.confidence < 0 || prediction.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }

  // Check actions
  prediction.actions.forEach((action: VLJEPAAction, index: number) => {
    if (action.confidence < 0 || action.confidence > 1) {
      errors.push(`Action ${index} confidence must be between 0 and 1`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Compute cosine similarity between two embeddings
 *
 * @param a - First embedding
 * @param b - Second embedding
 * @returns Cosine similarity (-1 to 1)
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new EmbeddingDimensionError(b.length, a.length);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalize embedding to unit length
 *
 * @param embedding - Embedding to normalize
 * @returns Normalized embedding
 */
export function normalizeEmbedding(embedding: Float32Array): Float32Array {
  const normalized = new Float32Array(embedding.length);
  let norm = 0;

  for (let i = 0; i < embedding.length; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);

  for (let i = 0; i < embedding.length; i++) {
    normalized[i] = embedding[i] / norm;
  }

  return normalized;
}

/**
 * Compute Euclidean distance between two embeddings
 *
 * @param a - First embedding
 * @param b - Second embedding
 * @returns Euclidean distance
 */
export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new EmbeddingDimensionError(b.length, a.length);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

// ============================================================================
// X-ENCODER EXPORTS
// ============================================================================

// Re-export X-Encoder components
export {
  XEncoder,
  createXEncoder,
  encodeImage,
  encodeImageBatch,
  validateXEncoderConfig,
  estimateMemoryUsage,
  getSupportedFormats,
  isFormatSupported,
  type XEncoderResult,
  ImagePreprocessor,
  preprocessImage,
  PatchEmbedding,
  createPatchEmbedding,
  calculateNumPatches,
  validatePatchConfig,
  VisionTransformer,
  createVisionTransformer,
  validateViTConfig,
} from "./x-encoder/index.js";

// Re-export Predictor components
export {
  Predictor,
  EmbeddingCombiner,
  PredictionHead,
  ConfidenceScorer,
  ActionGenerator,
  type ExtendedPredictorConfig,
  type PredictorMetrics as CPredictorMetrics,
  type EmbeddingCombinerConfig,
  type CombinationStrategy,
  type PredictionHeadConfig,
  type LayerConfig,
  type ActivationFunction,
  type ConfidenceScorerConfig,
  type ConfidenceMethod,
  type ConfidenceResult,
  type ActionGeneratorConfig,
  type ActionStrategy,
  type SemanticDelta,
  type ActionResult,
  type DeltaCategory,
} from "./predictor/index.js";

// ============================================================================
// FACTORY FUNCTION (Declaration only, implementation in separate module)
// ============================================================================

/**
 * Create VL-JEPA instance
 *
 * Factory function for creating VL-JEPA bridge instances.
 *
 * @param factoryConfig - Factory configuration
 * @returns VL-JEPA bridge instance
 *
 * @example
 * ```typescript
 * const vljepa = createVLJEPA({
 *   config: createDefaultConfig(),
 *   modelUrl: "./models/vljepa-1.6b"
 * });
 * ```
 */
export declare function createVLJEPA(
  factoryConfig: VLJEPAFactoryConfig
): VLJEPABridge;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default VL-JEPA configuration
 *
 * @returns Default configuration with sensible defaults
 */
export function createDefaultConfig(): VLJEPAConfig {
  return {
    version: VLJEPA_VERSION,
    xEncoder: {
      version: VLJEPA_VERSION,
      inputSize: DEFAULT_INPUT_SIZE,
      patchSize: DEFAULT_PATCH_SIZE,
      embeddingDim: DEFAULT_EMBEDDING_DIM,
      model: "vit-base",
      numHeads: 12,
      numLayers: 12,
      usePositionalEncoding: true,
      dropout: 0.1,
      webgpu: {
        enabled: true,
        workgroups: 8,
        memoryOptimization: "medium",
      },
    },
    yEncoder: {
      version: VLJEPA_VERSION,
      vocabSize: 50000,
      embeddingDim: DEFAULT_EMBEDDING_DIM,
      contextLength: DEFAULT_CONTEXT_LENGTH,
      model: "transformer-encoder",
      numHeads: 12,
      numLayers: 6,
      feedForwardDim: 3072,
      dropout: 0.1,
      useLayerNorm: true,
      tokenizer: {
        type: "bpe",
        maxLength: DEFAULT_CONTEXT_LENGTH,
        lowercase: true,
      },
    },
    predictor: {
      version: VLJEPA_VERSION,
      inputDim: 1536, // 768 + 768
      hiddenDim: DEFAULT_HIDDEN_DIM,
      outputDim: DEFAULT_EMBEDDING_DIM,
      numLayers: 4,
      numHeads: 8,
      feedForwardDim: 4096,
      dropout: 0.1,
      activation: "gelu",
      useResiduals: true,
      training: {
        learningRate: 0.001,
        batchSize: 32,
        epochs: 100,
        lossFunction: "cosine",
        useContextualMasking: true,
        maskingRatio: 0.9,
      },
    },
    global: {
      device: "webgpu",
      precision: "fp16",
      maxBatchSize: 8,
      cache: {
        enabled: true,
        maxSize: 1000,
        ttl: 300000, // 5 minutes
      },
    },
  };
}

/**
 * Create zero-initialized embedding
 *
 * @param dim - Embedding dimension (default: 768)
 * @returns Zero-initialized Float32Array
 */
export function createZeroEmbedding(
  dim: number = DEFAULT_EMBEDDING_DIM
): Float32Array {
  return new Float32Array(dim);
}

/**
 * Create random embedding (for testing)
 *
 * @param dim - Embedding dimension (default: 768)
 * @returns Random Float32Array with values in [-1, 1]
 */
export function createRandomEmbedding(
  dim: number = DEFAULT_EMBEDDING_DIM
): Float32Array {
  const embedding = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    embedding[i] = Math.random() * 2 - 1;
  }
  return embedding;
}

/**
 * Clone embedding
 *
 * @param embedding - Embedding to clone
 * @returns Cloned Float32Array
 */
export function cloneEmbedding(embedding: Float32Array): Float32Array {
  return new Float32Array(embedding);
}

/**
 * Serialize embedding to base64
 *
 * @param embedding - Embedding to serialize
 * @returns Base64-encoded string
 */
export function serializeEmbedding(embedding: Float32Array): string {
  const binary = new Uint8Array(embedding.buffer);
  return btoa(String.fromCharCode(...binary));
}

/**
 * Deserialize embedding from base64
 *
 * @param base64 - Base64-encoded string
 * @param dim - Expected dimension (default: 768)
 * @returns Deserialized Float32Array
 */
export function deserializeEmbedding(
  base64: string,
  dim: number = DEFAULT_EMBEDDING_DIM
): Float32Array {
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Float32Array(binary.buffer);
}

// ============================================================================
// Y-ENCODER EXPORTS
// ============================================================================

// Re-export Y-Encoder components
export {
  // Main Y-Encoder
  YEncoder,
  createYEncoder,
  createYEncoderFromConfig,
  PoolingStrategy,
  type YEncoderOptions,
  type EncodingResult,

  // Text Tokenizer
  TextTokenizer,
  SpecialToken,
  createTokenizer,
  getSpecialTokenCount,
  type TokenizerConfig,
  type TokenizationResult,

  // Embedding Layer
  EmbeddingLayer,
  PositionalEncodingType,
  createEmbeddingLayer,
  type EmbeddingLayerConfig,
  type EmbeddingResult,

  // Text Encoder (Transformer)
  MultiHeadAttention,
  FeedForwardNetwork,
  TransformerEncoderLayer,
  TextEncoder,
  createTextEncoder,
  type AttentionConfig,
  type FeedForwardConfig,
  type TransformerLayerConfig,
  type AttentionOutput,
  type LayerOutput,

  // IntentEncoder Integration
  YEncoderIntentBridge,
  createYEncoderIntentBridge,
  toIntentVector,
  fromIntentVector,
  embeddingSimilarity,
  fuseEmbeddings,
  type FusionConfig,
  type CombinedEncodingResult,
} from "./y-encoder/index.js";

// ============================================================================
// WEBGPU EXPORTS
// ============================================================================

// Re-export WebGPU components
export {
  // WebGPU Context
  WebGPUContext,
  createWebGPUContext,
  checkWebGPUCompatibility,

  // Buffer Manager
  BufferManager,
  TensorBuffer,

  // GPU-Accelerated Components
  XEncoderGPU,
  createXEncoderGPU,
  PredictorGPU,
  createPredictorGPU,

  // Compute Shaders
  EMBEDDING_DIM,
  HIDDEN_DIM,
  MAX_SEQ_LEN,
  NUM_HEADS,
  HEAD_DIM,
  getMatMulShader,
  getBatchMatMulShader,
  getLayerNormShader,
  getAttentionShader,
  getPatchEmbedShader,
  getPositionEmbedShader,
  getGELUShader,
  getReLUShader,
  getSwishShader,
  getConcatShader,
  getMLPShader,
  getAddShader,
  getMulShader,
  getScaleShader,
  getCopyShader,
  DEFAULT_MATMUL_SHADER,
  DEFAULT_LAYER_NORM_SHADER,
  DEFAULT_PATCH_EMBED_SHADER,
  DEFAULT_GELU_SHADER,
  DEFAULT_CONCAT_SHADER,
  DEFAULT_MLP_SHADER,

  // Types
  type WebGPUConfig,
  type WebGPUInitResult,
  type WebGPUMetrics,
  type BufferOptions,
  type BufferStats,
  type XEncoderOptions,
  type XEncoderMetrics,
  type PredictorOptions,
  type PredictorMetrics,
} from "./webgpu/index.js";

// ============================================================================
// CACHE EXPORTS
// ============================================================================

// Re-export Cache components
export {
  // Visual Embedding Cache
  VisualEmbeddingCache,
  DEFAULT_VISUAL_CACHE_CONFIG,
  PRODUCTION_VISUAL_CACHE_CONFIG,
  type VisualCacheConfig,
  type CacheEntry,
  type CacheMetadata,
  type CacheLookupResult,

  // Semantic Key Generator
  SemanticKeyGenerator,
  DEFAULT_SEMANTIC_KEY_CONFIG,
  FAST_SEMANTIC_KEY_CONFIG,
  ACCURATE_SEMANTIC_KEY_CONFIG,
  type SemanticKey,
  type SimilarityMatch,
  type SemanticKeyGeneratorConfig,
  type PerceptualHashConfig,
  type UIStructureConfig,

  // Cache Invalidation
  CacheInvalidation,
  DEFAULT_CACHE_INVALIDATION_CONFIG,
  AGGRESSIVE_CACHE_INVALIDATION_CONFIG,
  CONSERVATIVE_CACHE_INVALIDATION_CONFIG,
  type InvalidationTrigger,
  type InvalidationScope,
  type InvalidationRule,
  type InvalidationEvent,
  type CacheInvalidationConfig,

  // Cache Warming
  CacheWarming,
  DEFAULT_CACHE_WARMING_CONFIG,
  PRODUCTION_CACHE_WARMING_CONFIG,
  MINIMAL_CACHE_WARMING_CONFIG,
  type WarmingStrategy,
  type WarmupJob,
  type CacheWarmingConfig,
  type UserPattern,
  type PredictiveModel,

  // Cache Metrics
  CacheMetrics,
  DEFAULT_CACHE_METRICS_CONFIG,
  PRODUCTION_CACHE_METRICS_CONFIG,
  DEVELOPMENT_CACHE_METRICS_CONFIG,
  type LevelMetrics,
  type CacheMetrics as CacheMetricsData,
  type MetricsSnapshot,
  type CacheMetricsConfig,

  // Semantic Cache Bridge
  SemanticCacheBridge,
  DEFAULT_SEMANTIC_CACHE_BRIDGE_CONFIG,
  PRODUCTION_SEMANTIC_CACHE_BRIDGE_CONFIG,
  MINIMAL_SEMANTIC_CACHE_BRIDGE_CONFIG,
  type CacheEntryType,
  type MultiModalQuery,
  type MultiModalCacheResult,
  type UnifiedCacheMetrics,
  type SemanticCacheBridgeConfig,
} from "./cache/index.js";

// ============================================================================
// PLANNING EXPORTS (Zero-Shot Planning for "Vibe Coding")
// ============================================================================

// Re-export Planning components
export {
  // Embedding Delta Calculator
  EmbeddingDeltaCalculator,
  createDeltaCalculator,
  calculateDelta,
  DEFAULT_DELTA_CONFIG,
  type VisualState,
  type GoalState,
  type SemanticChange,
  type EmbeddingDelta,
  type DimensionAnalysis,
  type DeltaCalculatorConfig,

  // Action Sequence Generator
  ActionSequenceGenerator,
  createActionSequenceGenerator,
  generateActionSequence,
  DEFAULT_PLANNING_CONFIG,
  DEFAULT_ACTION_TEMPLATES,
  type PlannedAction,
  type ActionSequence,
  type ActionTemplate,
  type PlanningContext,
  type PlanningConfig,

  // World Model Reasoner
  WorldModelReasoner,
  createWorldModelReasoner,
  predictAction,
  DEFAULT_WORLD_MODEL_CONFIG,
  DEFAULT_TRANSITION_RULES,
  type SideEffect,
  type WorldModelPrediction,
  type WorldModelState,
  type TransitionRule,
  type CausalChain,
  type WorldModelConfig,

  // Plan Validator
  PlanValidator,
  createPlanValidator,
  validatePlan,
  DEFAULT_VALIDATION_CONFIG,
  DEFAULT_VALIDATION_RULES,
  type ValidationIssue,
  type ValidationWarning,
  type ValidationReport,
  type ValidationRule,
  type ValidationContext,
  type ValidationConfig,

  // Adaptive Planner
  AdaptivePlanner,
  createAdaptivePlanner,
  DEFAULT_ADAPTIVE_CONFIG,
  type ExecutionResult,
  type PlanningHistory,
  type PerformanceMetrics,
  type LearningPattern,
  type AdaptiveConfig,

  // CoAgents Planner Bridge
  CoAgentsPlannerBridge,
  createCoAgentsPlannerBridge,
  initializeCoAgentsState,
  DEFAULT_BRIDGE_CONFIG,
  type PlanningNodeInput,
  type PlanningNodeOutput,
  type CoAgentsState,
  type HITLCheckpoint,
  type BridgeConfig,
} from "./planning/index.js";
