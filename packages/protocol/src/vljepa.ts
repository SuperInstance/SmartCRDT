/**
 * @fileoverview VL-JEPA (Vision-Language Joint Embedding Predictive Architecture) Protocol Types
 *
 * VL-JEPA is Meta AI's breakthrough architecture (December 2025) that predicts
 * semantic embeddings instead of pixels/tokens, enabling real-time visual understanding
 * with 2.85x fewer decoding operations than traditional VLMs.
 *
 * @package @lsi/protocol
 * @version 1.0.0
 * @see https://arxiv.org/abs/2512.10942
 */

/**
 * VL-JEPA configuration options
 */
export interface VLJEPABridgeConfig {
  /** Embedding dimension (default: 768) */
  embeddingDim?: number;

  /** Maximum sequence length for video frames */
  maxFrames?: number;

  /** Target latency in milliseconds */
  targetLatency?: number;

  /** Whether to use WebGPU for inference */
  useWebGPU?: boolean;

  /** Model path or URL */
  modelPath?: string;

  /** Enable on-device processing (privacy-preserving) */
  onDevice?: boolean;
}

/**
 * Vision embedding result from X-Encoder
 */
export interface VisionEmbedding {
  /** 768-dim semantic embedding of visual input */
  embedding: Float32Array;

  /** Confidence score [0, 1] */
  confidence: number;

  /** Processing time in milliseconds */
  latency: number;

  /** Frame metadata */
  metadata: {
    width: number;
    height: number;
    timestamp: number;
    frameIndex?: number;
  };
}

/**
 * Language embedding result from Y-Encoder
 */
export interface LanguageEmbedding {
  /** 768-dim semantic embedding of text input */
  embedding: Float32Array;

  /** Confidence score [0, 1] */
  confidence: number;

  /** Processing time in milliseconds */
  latency: number;

  /** Text metadata */
  metadata: {
    length: number;
    tokenCount: number;
  };
}

/**
 * Predicted goal state from VL-JEPA Predictor
 */
export interface VLJEPAPrediction {
  /** Predicted goal embedding (768-dim) */
  goalEmbedding: Float32Array;

  /** Confidence in prediction [0, 1] */
  confidence: number;

  /** Suggested actions to achieve goal */
  actions: VLJEPAAction[];

  /** Semantic similarity to input [0, 1] */
  semanticSimilarity: number;

  /** World model consistency score [0, 1] */
  worldModelConsistency: number;

  /** Total processing time */
  latency: number;
}

/**
 * Action suggested by VL-JEPA
 */
export interface VLJEPAAction {
  /** Action type */
  type: "modify" | "create" | "delete" | "reorder" | "restyle";

  /** Target element (CSS selector or component path) */
  target: string;

  /** Action parameters */
  params: Record<string, unknown>;

  /** Confidence in this action [0, 1] */
  confidence: number;

  /** Reasoning for this action */
  reasoning?: string;
}

/**
 * Delta between current and goal state
 */
export interface StateDelta {
  /** Cosine distance between embeddings */
  distance: number;

  /** Actions needed to bridge delta */
  actions: VLJEPAAction[];

  /** Estimated steps to reach goal */
  steps: number;

  /** Difficulty rating [0, 1] */
  difficulty: number;
}

/**
 * UI Frame capture
 */
export interface UIFrame {
  /** Raw image data */
  data: ImageData | HTMLImageElement | VideoFrame;

  /** Capture timestamp */
  timestamp: number;

  /** Frame index for video */
  index?: number;

  /** Element metadata (if available) */
  metadata?: {
    url?: string;
    title?: string;
    elementType?: string;
  };
}

/**
 * VL-JEPA Bridge interface
 *
 * Main interface for VL-JEPA integration with Aequor platform.
 * Provides X-Encoder (vision), Y-Encoder (language), and Predictor.
 */
export interface VLJEPABridge {
  /** Bridge configuration */
  readonly config: VLJEPABridgeConfig;

  /**
   * X-Encoder: Process visual frame into semantic embedding
   * @param frame - UI frame to encode
   * @returns Vision embedding
   */
  encodeVision(frame: UIFrame): Promise<VisionEmbedding>;

  /**
   * Y-Encoder: Process text intent into semantic embedding
   * @param text - User intent text
   * @returns Language embedding
   */
  encodeLanguage(text: string): Promise<LanguageEmbedding>;

  /**
   * Predictor: Predict goal state from context and intent
   * @param contextEmbedding - Current state embedding
   * @param intentEmbedding - User intent embedding
   * @returns Prediction of goal state
   */
  predict(
    contextEmbedding: Float32Array,
    intentEmbedding: Float32Array
  ): Promise<VLJEPAPrediction>;

  /**
   * Convenience method: Encode vision and language, then predict
   * @param frame - Current UI frame
   * @param intent - User intent text
   * @returns Full prediction
   */
  encodeAndPredict(frame: UIFrame, intent: string): Promise<VLJEPAPrediction>;

  /**
   * Calculate delta between current and goal embeddings
   * @param currentEmbedding - Current state
   * @param goalEmbedding - Desired state
   * @returns State delta with actions
   */
  calculateDelta(
    currentEmbedding: Float32Array,
    goalEmbedding: Float32Array
  ): Promise<StateDelta>;

  /**
   * Initialize the VL-JEPA model
   */
  initialize(): Promise<void>;

  /**
   * Cleanup resources
   */
  dispose(): void;
}

/**
 * VL-JEPA integration with CoAgents
 */
export interface VLJEPACoAgentsIntegration {
  /**
   * Convert VL-JEPA prediction to CoAgent state
   * @param prediction - VL-JEPA prediction
   * @returns CoAgent state object
   */
  predictionToAgentState(prediction: VLJEPAPrediction): Record<string, unknown>;

  /**
   * Convert CoAgent state to VL-JEPA embedding
   * @param state - CoAgent state
   * @returns Embedding for VL-JEPA
   */
  agentStateToEmbedding(state: Record<string, unknown>): Float32Array;
}

/**
 * VL-JEPA integration with A2UI
 */
export interface VLJEPAA2UIIntegration {
  /**
   * Generate A2UI components from VL-JEPA prediction
   * @param prediction - VL-JEPA prediction
   * @returns A2UI component tree
   */
  predictionToA2UI(
    prediction: VLJEPAPrediction
  ): import("./a2ui").A2UIComponent[];

  /**
   * Generate A2UI from state delta
   * @param delta - State delta
   * @returns A2UI update
   */
  deltaToA2UI(delta: StateDelta): import("./a2ui").A2UIUpdate;
}

/**
 * VL-JEPA training configuration
 */
export interface VLJEPATrainingConfig {
  /** Learning rate */
  learningRate: number;

  /** Batch size */
  batchSize: number;

  /** Number of training epochs */
  epochs: number;

  /** Context window size (in frames) */
  contextWindow: number;

  /** Masking ratio (0-1, typically 0.9) */
  maskingRatio: number;

  /** Weight for world model loss */
  worldModelWeight: number;

  /** Weight for prediction loss */
  predictionWeight: number;

  /** Whether to use curriculum learning */
  curriculumLearning: boolean;
}

/**
 * UI-specific JEPA training data
 */
export interface UIJEPATrainingData {
  /** Before state frame */
  beforeFrame: UIFrame;

  /** User intent */
  intent: string;

  /** After state frame */
  afterFrame: UIFrame;

  /** Actions taken */
  actions: VLJEPAAction[];

  /** Difficulty rating */
  difficulty: number;
}

/**
 * VL-JEPA benchmark results
 */
export interface VLJEPABenchmark {
  /** Model name/version */
  model: string;

  /** Average latency (ms) */
  avgLatency: number;

  /** Throughput (frames/second) */
  throughput: number;

  /** Memory usage (MB) */
  memoryUsage: number;

  /** Accuracy on UI tasks */
  accuracy: number;

  /** Comparison to baseline VLM */
  vsBaseline: {
    latencyImprovement: number; // 2.85x for VL-JEPA
    accuracyComparison: number;
    parameterReduction: number; // 50% for VL-JEPA
  };
}
