/**
 * @lsi/vljepa/protocol - VL-JEPA Protocol Types for Aequor Platform
 *
 * VL-JEPA (Vision-Language Joint Embedding Predictive Architecture)
 * Meta AI's breakthrough architecture for semantic visual understanding.
 *
 * Key Innovation: Predicts semantic embeddings (not pixels), enabling:
 * - 2.85x faster inference than traditional VLMs
 * - 50% fewer parameters (1.6B vs 72B)
 * - Real-time video understanding at edge scale
 * - World model capabilities for zero-shot action planning
 *
 * Architecture:
 * - X-Encoder: Vision (ViT) → 768-dim embedding
 * - Y-Encoder: Language → 768-dim embedding
 * - Predictor: Context + Intent → Goal embedding (768-dim)
 *
 * Integration Points:
 * - 768-dim embeddings match IntentEncoder for compatibility
 * - WebGPU-ready for browser inference
 * - On-device processing for privacy
 *
 * @see https://arxiv.org/abs/2512.10942 - VL-JEPA Paper (December 2025)
 * @see https://ai.meta.com/vjepa/ - Meta AI Official Page
 * @version 1.0.0
 */

// ============================================================================
// X-ENCODER CONFIGURATION (Vision → Embedding)
// ============================================================================

/**
 * Configuration for X-Encoder (Vision Encoder)
 *
 * The X-Encoder processes visual input (UI frames, screenshots, video frames)
 * using a Vision Transformer (ViT) architecture to extract semantic embeddings.
 *
 * Model Architecture:
 * - Input: Image/Video frame divided into patches
 * - Patch Size: Typically 16x16 pixels
 * - Output: 768-dim semantic embedding
 *
 * Supported Models:
 * - vit-base: Standard ViT with 12 transformer layers
 * - vit-small: Compact ViT with 6 transformer layers (faster inference)
 *
 * Integration Notes:
 * - 768-dim output matches IntentEncoder for direct compatibility
 * - Patch-based processing enables efficient WebGPU computation
 * - Supports variable input sizes (resized internally)
 */
export interface XEncoderConfig {
  /** Version of the X-Encoder protocol */
  version: "1.0";

  /** Input image dimensions */
  inputSize: {
    /** Width in pixels */
    width: number;
    /** Height in pixels */
    height: number;
  };

  /** ViT patch size (typically 16) - determines token count */
  patchSize: number;

  /** Output embedding dimension (must be 768 for IntentEncoder compatibility) */
  embeddingDim: 768;

  /** Vision model architecture */
  model: "vit-base" | "vit-small";

  /** Number of attention heads in ViT */
  numHeads?: number;

  /** Number of transformer layers */
  numLayers?: number;

  /** Whether to use positional encoding */
  usePositionalEncoding?: boolean;

  /** Dropout rate for regularization */
  dropout?: number;

  /** WebGPU compute shader configuration (for browser inference) */
  webgpu?: {
    /** Whether to use WebGPU acceleration */
    enabled: boolean;
    /** Number of compute shader workgroups */
    workgroups?: number;
    /** Memory optimization level */
    memoryOptimization?: "low" | "medium" | "high";
  };
}

// ============================================================================
// Y-ENCODER CONFIGURATION (Language → Embedding)
// ============================================================================

/**
 * Configuration for Y-Encoder (Language Encoder)
 *
 * The Y-Encoder processes textual input (user intent, commands, descriptions)
 * using a transformer encoder to extract semantic embeddings.
 *
 * Model Architecture:
 * - Input: Tokenized text (max contextLength tokens)
 * - Output: 768-dim semantic embedding
 *
 * Integration Notes:
 * - 768-dim output matches X-Encoder for shared embedding space
 * - Compatible with IntentEncoder architecture
 * - Supports bidirectional attention for context understanding
 */
export interface YEncoderConfig {
  /** Version of the Y-Encoder protocol */
  version: "1.0";

  /** Vocabulary size for tokenization */
  vocabSize: number;

  /** Output embedding dimension (must be 768 for IntentEncoder compatibility) */
  embeddingDim: 768;

  /** Maximum context length (tokens) */
  contextLength: number;

  /** Language model architecture */
  model: "transformer-encoder";

  /** Number of attention heads */
  numHeads?: number;

  /** Number of transformer layers */
  numLayers?: number;

  /** Feed-forward dimension */
  feedForwardDim?: number;

  /** Dropout rate for regularization */
  dropout?: number;

  /** Whether to use layer normalization */
  useLayerNorm?: boolean;

  /** Tokenizer configuration */
  tokenizer?: {
    /** Tokenizer type (BPE, WordPiece, etc.) */
    type: "bpe" | "wordpiece" | "unigram";
    /** Maximum token sequence length */
    maxLength: number;
    /** Whether to lowercase input */
    lowercase?: boolean;
  };
}

// ============================================================================
// PREDICTOR CONFIGURATION (Context + Intent → Goal)
// ============================================================================

/**
 * Configuration for Predictor (Joint Embedding Prediction)
 *
 * The Predictor takes concatenated context (X-Encoder output) and intent (Y-Encoder output)
 * to predict the goal state embedding. This is the core innovation of VL-JEPA:
 * predicting semantic meaning directly, without token-by-token generation.
 *
 * Architecture:
 * - Input: 1536-dim (768 context + 768 intent, concatenated)
 * - Hidden: Multi-layer transformer with attention
 * - Output: 768-dim goal embedding
 *
 * Key Innovation:
 * - Direct embedding-to-embedding prediction (not token generation)
 * - Single forward pass (2.85x faster than autoregressive decoding)
 * - Semantic understanding (not pixel/token reconstruction)
 */
export interface PredictorConfig {
  /** Version of the Predictor protocol */
  version: "1.0";

  /** Input dimension (768 + 768 = 1536, concatenated embeddings) */
  inputDim: 1536;

  /** Hidden layer dimension */
  hiddenDim: number;

  /** Output embedding dimension (must be 768 for compatibility) */
  outputDim: 768;

  /** Number of transformer layers */
  numLayers: number;

  /** Number of attention heads */
  numHeads?: number;

  /** Feed-forward dimension */
  feedForwardDim?: number;

  /** Dropout rate for regularization */
  dropout?: number;

  /** Activation function */
  activation?: "relu" | "gelu" | "swish";

  /** Whether to use residual connections */
  useResiduals?: boolean;

  /** Training configuration */
  training?: {
    /** Learning rate */
    learningRate?: number;
    /** Batch size */
    batchSize?: number;
    /** Number of epochs */
    epochs?: number;
    /** Loss function (cosine similarity, MSE, etc.) */
    lossFunction?: "cosine" | "mse" | "smooth-l1";
    /** Whether to use contextual masking during training */
    useContextualMasking?: boolean;
    /** Masking ratio (0-1, typically 0.9 for 10% visibility) */
    maskingRatio?: number;
  };
}

// ============================================================================
// VL-JEPA COMPLETE CONFIGURATION
// ============================================================================

/**
 * Complete VL-JEPA Configuration
 *
 * Combines X-Encoder, Y-Encoder, and Predictor configurations
 * into a unified VL-JEPA protocol configuration.
 *
 * Usage:
 * ```typescript
 * const config: VLJEPAConfig = {
 *   version: "1.0",
 *   xEncoder: { ... },
 *   yEncoder: { ... },
 *   predictor: { ... }
 * };
 * ```
 */
export interface VLJEPAConfig {
  /** Protocol version */
  version: "1.0";

  /** X-Encoder (Vision) configuration */
  xEncoder: XEncoderConfig;

  /** Y-Encoder (Language) configuration */
  yEncoder: YEncoderConfig;

  /** Predictor configuration */
  predictor: PredictorConfig;

  /** Global configuration */
  global?: {
    /** Device to run inference on */
    device?: "cpu" | "gpu" | "webgpu";
    /** Precision for computation */
    precision?: "fp32" | "fp16" | "int8";
    /** Maximum batch size */
    maxBatchSize?: number;
    /** Cache configuration */
    cache?: {
      /** Whether to enable embedding cache */
      enabled: boolean;
      /** Maximum cache size (number of embeddings) */
      maxSize?: number;
      /** TTL for cache entries (milliseconds) */
      ttl?: number;
    };
  };
}

// ============================================================================
// VL-JEPA PREDICTION OUTPUT
// ============================================================================

/**
 * Action predicted by VL-JEPA
 *
 * Represents a specific action to take on the UI to achieve the goal state.
 * Actions are derived from the semantic understanding of the goal embedding.
 */
export interface VLJEPAAction {
  /** Action type */
  type: "modify" | "create" | "delete" | "move" | "resize" | "restyle";

  /** Target identification (CSS selector, component path, or element ID) */
  target: string;

  /** Action parameters (property-value pairs) */
  params: Record<string, unknown>;

  /** Confidence in this action (0-1) */
  confidence: number;

  /** Reasoning for this action (optional, for debugging) */
  reasoning?: string;

  /** Expected outcome of this action */
  expectedOutcome?: {
    /** Expected visual change */
    visualChange?: string;
    /** Expected functional change */
    functionalChange?: string;
  };
}

/**
 * VL-JEPA Prediction Result
 *
 * Output from VL-JEPA after processing visual context and textual intent.
 * Contains the predicted goal embedding and derived actions.
 *
 * Key Properties:
 * - goalEmbedding: 768-dim semantic representation of desired state
 * - confidence: Overall confidence in prediction (0-1)
 * - actions: Specific actions to achieve goal state
 * - metadata: Timing and processing information
 */
export interface VLJEPAPrediction {
  /** Protocol version */
  version: "1.0";

  /** Predicted goal state embedding (768-dim) */
  goalEmbedding: Float32Array;

  /** Overall prediction confidence (0-1) */
  confidence: number;

  /** Predicted actions to achieve goal state */
  actions: VLJEPAAction[];

  /** Semantic similarity between current and goal states */
  semanticDistance?: number;

  /** Metadata about the prediction */
  metadata: {
    /** Timestamp of prediction (Unix timestamp) */
    timestamp: number;

    /** Processing time in milliseconds */
    processingTime: number;

    /** X-Encoder inference time */
    xEncoderTime?: number;

    /** Y-Encoder inference time */
    yEncoderTime?: number;

    /** Predictor inference time */
    predictorTime?: number;

    /** Whether prediction used cached embeddings */
    usedCache?: boolean;

    /** Device used for inference */
    device?: "cpu" | "gpu" | "webgpu";

    /** Model version used */
    modelVersion?: string;
  };
}

// ============================================================================
// VL-JEPA BRIDGE INTERFACE
// ============================================================================

/**
 * VL-JEPA Bridge Interface
 *
 * Main interface for VL-JEPA integration with Aequor platform.
 * Provides methods for vision encoding, language encoding, and prediction.
 *
 * Integration Points:
 * - IntentEncoder: Both use 768-dim embeddings
 * - CoAgents: Goal embeddings drive agent state
 * - A2UI: Actions drive UI generation
 *
 * Usage:
 * ```typescript
 * const vljepa: VLJEPABridge = createVLJEPA(config);
 *
 * // Encode visual context
 * const visionEmbedding = await vljepa.encodeVision(uiFrame);
 *
 * // Encode user intent
 * const intentEmbedding = await vljepa.encodeLanguage("Make this button pop");
 *
 * // Predict goal state and actions
 * const prediction = await vljepa.predict(visionEmbedding, intentEmbedding);
 * ```
 */
export interface VLJEPABridge {
  /**
   * Encode visual input to semantic embedding
   *
   * Processes UI frames, screenshots, or video frames using X-Encoder (ViT).
   * Output is 768-dim embedding compatible with IntentEncoder.
   *
   * @param frame - Image data (ImageData, HTMLCanvasElement, or URL)
   * @returns 768-dim semantic embedding
   *
   * @example
   * ```typescript
   * const canvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
   * const embedding = await vljepa.encodeVision(canvas);
   * // Float32Array(768) = [0.23, -0.45, 0.67, ...]
   * ```
   */
  encodeVision(
    frame: ImageData | HTMLCanvasElement | string
  ): Promise<Float32Array>;

  /**
   * Encode textual input to semantic embedding
   *
   * Processes user intent, commands, or descriptions using Y-Encoder (Transformer).
   * Output is 768-dim embedding compatible with IntentEncoder and X-Encoder.
   *
   * @param text - Text input (user intent, command, description)
   * @returns 768-dim semantic embedding
   *
   * @example
   * ```typescript
   * const embedding = await vljepa.encodeLanguage("Make this button pop");
   * // Float32Array(768) = [0.25, -0.43, 0.65, ...]
   * ```
   */
  encodeLanguage(text: string): Promise<Float32Array>;

  /**
   * Predict goal state from context and intent
   *
   * Core VL-JEPA operation: Takes context (visual) and intent (textual) embeddings,
   * predicts goal state embedding, and derives specific actions.
   *
   * @param context - Visual context embedding (from encodeVision)
   * @param intent - User intent embedding (from encodeLanguage)
   * @returns Prediction with goal embedding and actions
   *
   * @example
   * ```typescript
   * const context = await vljepa.encodeVision(uiFrame);
   * const intent = await vljepa.encodeLanguage("Center this div");
   * const prediction = await vljepa.predict(context, intent);
   *
   * console.log(prediction.confidence); // 0.92
   * console.log(prediction.actions);
   * // [{
   * //   type: "modify",
   * //   target: "#main-div",
   * //   params: { display: "flex", justifyContent: "center" },
   * //   confidence: 0.95
   * // }]
   * ```
   */
  predict(
    context: Float32Array,
    intent: Float32Array
  ): Promise<VLJEPAPrediction>;

  /**
   * Batch encode multiple visual inputs
   *
   * Optimized batch processing for multiple frames (e.g., video clips).
   *
   * @param frames - Array of image data
   * @returns Array of 768-dim embeddings
   */
  encodeVisionBatch(
    frames: Array<ImageData | HTMLCanvasElement | string>
  ): Promise<Float32Array[]>;

  /**
   * Batch encode multiple textual inputs
   *
   * Optimized batch processing for multiple text inputs.
   *
   * @param texts - Array of text strings
   * @returns Array of 768-dim embeddings
   */
  encodeLanguageBatch(texts: string[]): Promise<Float32Array[]>;

  /**
   * Get configuration
   *
   * Returns the current VL-JEPA configuration.
   *
   * @returns Current configuration
   */
  getConfig(): VLJEPAConfig;

  /**
   * Health check
   *
   * Checks if VL-JEPA is operational and ready for inference.
   *
   * @returns Health status
   */
  healthCheck(): Promise<{
    healthy: boolean;
    device?: string;
    modelLoaded: boolean;
    cacheSize?: number;
    error?: string;
  }>;

  /**
   * Clear embedding cache
   *
   * Clears the internal embedding cache (if enabled).
   */
  clearCache(): void;
}

// ============================================================================
// VL-JEPA FACTORY
// ============================================================================

/**
 * VL-JEPA Factory Configuration
 *
 * Configuration for creating VL-JEPA instances.
 */
export interface VLJEPAFactoryConfig {
  /** VL-JEPA configuration */
  config: VLJEPAConfig;

  /** Model URL or path (for loading weights) */
  modelUrl?: string;

  /** Whether to lazy-load models */
  lazyLoad?: boolean;

  /** Logging configuration */
  logging?: {
    enabled: boolean;
    level?: "debug" | "info" | "warn" | "error";
  };
}

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
 *   config: {
 *     version: "1.0",
 *     xEncoder: { ... },
 *     yEncoder: { ... },
 *     predictor: { ... }
 *   },
 *   modelUrl: "./models/vljepa-1.6b"
 * });
 * ```
 */
export declare function createVLJEPA(
  factoryConfig: VLJEPAFactoryConfig
): VLJEPABridge;

// ============================================================================
// INTEGRATION TYPES (Bridging to Aequor)
// ============================================================================

/**
 * VL-JEPA to IntentEncoder Bridge
 *
 * Enables seamless integration between VL-JEPA visual embeddings
 * and IntentEncoder intent embeddings.
 *
 * Key Feature: Both use 768-dim embeddings for compatibility.
 */
export interface VLJEPAIntentEncoderBridge {
  /**
   * Convert VL-JEPA visual embedding to IntentEncoder format
   *
   * @param vljepaEmbedding - VL-JEPA 768-dim embedding
   * @returns IntentEncoder-compatible embedding
   */
  toIntentEncoder(vljepaEmbedding: Float32Array): Float32Array;

  /**
   * Convert IntentEncoder embedding to VL-JEPA format
   *
   * @param intentEmbedding - IntentEncoder 768-dim embedding
   * @returns VL-JEPA-compatible embedding
   */
  fromIntentEncoder(intentEmbedding: Float32Array): Float32Array;

  /**
   * Compute similarity between VL-JEPA and IntentEncoder embeddings
   *
   * @param vljepaEmbedding - VL-JEPA embedding
   * @param intentEmbedding - IntentEncoder embedding
   * @returns Cosine similarity (-1 to 1)
   */
  similarity(
    vljepaEmbedding: Float32Array,
    intentEmbedding: Float32Array
  ): number;

  /**
   * Fuse VL-JEPA and IntentEncoder embeddings
   *
   * Combines visual and intent embeddings for joint understanding.
   *
   * @param vljepaEmbedding - VL-JEPA visual embedding
   * @param intentEmbedding - IntentEncoder intent embedding
   * @param weights - Fusion weights (default: equal)
   * @returns Fused 768-dim embedding
   */
  fuse(
    vljepaEmbedding: Float32Array,
    intentEmbedding: Float32Array,
    weights?: { vision: number; intent: number }
  ): Float32Array;
}

/**
 * VL-JEPA to A2UI Bridge
 *
 * Converts VL-JEPA predictions to A2UI component specifications.
 */
export interface VLJEPAA2UIBridge {
  /**
   * Convert VL-JEPA prediction to A2UI component
   *
   * @param prediction - VL-JEPA prediction
   * @returns A2UI component specification
   */
  toA2UIComponent(prediction: VLJEPAPrediction): {
    type: string;
    props: Record<string, unknown>;
    style?: Record<string, string>;
    children?: any[];
  };

  /**
   * Convert VL-JEPA actions to A2UI updates
   *
   * @param actions - VL-JEPA actions
   * @returns A2UI update specification
   */
  toA2UIUpdates(actions: VLJEPAAction[]): {
    type: "update" | "create" | "delete";
    target: string;
    changes: Record<string, unknown>;
  }[];
}

/**
 * VL-JEPA to CoAgents Bridge
 *
 * Integrates VL-JEPA predictions with CoAgents state management.
 */
export interface VLJEPACoAgentsBridge {
  /**
   * Convert VL-JEPA prediction to CoAgent state update
   *
   * @param prediction - VL-JEPA prediction
   * @returns CoAgent state update
   */
  toCoAgentState(prediction: VLJEPAPrediction): {
    currentState: Float32Array;
    goalState: Float32Array;
    actions: VLJEPAAction[];
    confidence: number;
  };

  /**
   * Plan CoAgent actions from VL-JEPA goal embedding
   *
   * @param goalEmbedding - VL-JEPA goal embedding
   * @returns CoAgent action plan
   */
  planFromGoal(goalEmbedding: Float32Array): {
    steps: VLJEPAAction[];
    estimatedDuration: number;
    confidence: number;
  };
}

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
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate VL-JEPA configuration
 *
 * @param config - Configuration to validate
 * @returns Validation result
 */
export declare function validateVLJEPAConfig(config: VLJEPAConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validate embedding dimension
 *
 * @param embedding - Embedding to validate
 * @param expectedDim - Expected dimension (default: 768)
 * @returns Whether embedding is valid
 */
export declare function validateEmbedding(
  embedding: Float32Array,
  expectedDim?: number
): boolean;

/**
 * Validate VL-JEPA prediction
 *
 * @param prediction - Prediction to validate
 * @returns Validation result
 */
export declare function validatePrediction(prediction: VLJEPAPrediction): {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Compute cosine similarity between two embeddings
 *
 * @param a - First embedding
 * @param b - Second embedding
 * @returns Cosine similarity (-1 to 1)
 */
export declare function cosineSimilarity(
  a: Float32Array,
  b: Float32Array
): number;

/**
 * Normalize embedding to unit length
 *
 * @param embedding - Embedding to normalize
 * @returns Normalized embedding
 */
export declare function normalizeEmbedding(
  embedding: Float32Array
): Float32Array;

/**
 * Compute Euclidean distance between two embeddings
 *
 * @param a - First embedding
 * @param b - Second embedding
 * @returns Euclidean distance
 */
export declare function euclideanDistance(
  a: Float32Array,
  b: Float32Array
): number;
