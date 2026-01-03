/**
 * @lsi/vljepa-orpo - Multimodal ORPO Types
 *
 * Types for VL-JEPA + ORPO integration for multimodal preference learning.
 * Combines VL-JEPA's visual understanding with ORPO's preference optimization.
 *
 * @module types
 */

// Global type declarations for browser APIs
declare global {
  interface ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: string;
  }

  interface HTMLCanvasElement {
    getContext(
      contextId: "2d",
      options?: {}
    ): {
      getImageData(sx: number, sy: number, sw: number, sh: number): ImageData;
    } | null;
    width: number;
    height: number;
  }
}

// Float32Array is built-in - we reference it directly
// No export needed

/**
 * UI State for preference pairs
 */
export interface UIState {
  /** UI screenshot/image data */
  image: ImageData;
  /** 768-dim embedding from VL-JEPA X-Encoder */
  embedding: Float32Array;
  /** DOM structure representation */
  dom: DOMStructure;
  /** CSS properties */
  styles: CSSProperties;
}

/**
 * DOM structure representation
 */
export interface DOMStructure {
  /** Tag name */
  tagName: string;
  /** Element ID */
  id?: string;
  /** CSS classes */
  classes: string[];
  /** Child elements */
  children: DOMStructure[];
  /** Attributes */
  attributes: Record<string, string>;
  /** Text content */
  text?: string;
  /** Bounding box */
  bbox?: { x: number; y: number; width: number; height: number };
}

/**
 * CSS properties
 */
export interface CSSProperties {
  /** Display property */
  display?: string;
  /** Position */
  position?: string;
  /** Width */
  width?: string | number;
  /** Height */
  height?: string | number;
  /** Margin */
  margin?: string | number;
  /** Padding */
  padding?: string | number;
  /** Background color */
  backgroundColor?: string;
  /** Color */
  color?: string;
  /** Font size */
  fontSize?: string | number;
  /** Flex properties */
  flex?: string | number;
  /** Grid properties */
  grid?: string;
  /** Border radius */
  borderRadius?: string | number;
  /** Opacity */
  opacity?: number;
  /** Additional CSS properties */
  [key: string]: string | number | undefined;
}

/**
 * Preference context
 */
export interface PreferenceContext {
  /** Task description */
  task: string;
  /** User intent */
  userIntent: string;
  /** UI context (page type, section, etc.) */
  uiContext: string;
  /** Constraints */
  constraints: Record<string, unknown>;
}

/**
 * User demographics (optional, for anonymized analysis)
 */
export interface Demographics {
  /** User age group */
  ageGroup?: string;
  /** Experience level */
  experienceLevel?: "beginner" | "intermediate" | "expert";
  /** Platform */
  platform?: string;
  /** Screen size category */
  screenCategory?: "mobile" | "tablet" | "desktop";
}

/**
 * Preference metadata
 */
export interface PreferenceMetadata {
  /** Source of preference */
  source: "ab_test" | "user_rating" | "synthetic" | "shadow_log";
  /** Confidence score (0-1) */
  confidence: number;
  /** User demographics (anonymized) */
  userDemographics?: Demographics;
  /** Timestamp */
  timestamp: number;
  /** Session ID */
  sessionId?: string;
}

/**
 * UI Preference Pair
 *
 * Core data structure for multimodal ORPO training.
 * Contains chosen (preferred) and rejected UI states.
 */
export interface UIPreferencePair {
  /** Unique identifier */
  id: string;
  /** Chosen (preferred) UI state */
  chosen: UIState;
  /** Rejected UI state */
  rejected: UIState;
  /** Preference context */
  context: PreferenceContext;
  /** Preference metadata */
  metadata: PreferenceMetadata;
}

/**
 * Preference head configuration
 */
export interface PreferenceHeadConfig {
  /** Head type */
  type: "mlp" | "attention" | "transformer";
  /** Hidden dimensions */
  hiddenDims: number[];
  /** Activation function */
  activation: "relu" | "gelu" | "swish";
  /** Dropout rate */
  dropout: number;
  /** Use layer normalization */
  useLayerNorm: boolean;
  /** Use residual connections */
  useResiduals: boolean;
}

/**
 * Multimodal ORPO configuration
 */
export interface MultimodalORPOConfig {
  /** Base VL-JEPA model configuration */
  baseModel: {
    /** X-Encoder embedding dimension (768) */
    embeddingDim: number;
    /** Whether to use pretrained weights */
    usePretrained: boolean;
    /** Pretrained weights path */
    weightsPath?: string;
  };
  /** Reference model configuration */
  referenceModel: {
    /** Whether to use separate reference model */
    enabled: boolean;
    /** Frozen copy of base model */
    frozen: boolean;
  };
  /** Preference head configuration */
  preferenceHead: PreferenceHeadConfig;
  /** ORPO hyperparameters */
  orpo: {
    /** Beta parameter for odds ratio */
    beta: number;
    /** Lambda for ORPO loss weight */
    lambda: number;
    /** SFT loss weight */
    sftLossWeight: number;
  };
  /** Training configuration */
  training: {
    /** Learning rate */
    learningRate: number;
    /** Batch size */
    batchSize: number;
    /** Number of epochs */
    epochs: number;
    /** Warmup ratio */
    warmupRatio: number;
    /** Gradient clipping norm */
    gradientClipping: number;
    /** Weight decay */
    weightDecay: number;
  };
  /** Multimodal configuration */
  multimodal: {
    /** Visual weight in combined loss */
    visualWeight: number;
    /** Text weight in combined loss */
    textWeight: number;
    /** Fusion strategy */
    fusion: "concat" | "add" | "attention";
  };
}

/**
 * ORPO forward pass result
 */
export interface ORPOForwardResult {
  /** Chosen logits */
  chosenLogits: Float32Array;
  /** Rejected logits */
  rejectedLogits: Float32Array;
  /** Reference chosen logits */
  referenceChosenLogits: Float32Array;
  /** Reference rejected logits */
  referenceRejectedLogits: Float32Array;
  /** Log odds ratio */
  logOddsRatio: number;
  /** Preference score (0-1) */
  preferenceScore: number;
  /** SFT loss */
  sftLoss: number;
  /** ORPO loss */
  orpoLoss: number;
  /** Total loss */
  totalLoss: number;
}

/**
 * Training batch
 */
export interface TrainingBatch {
  /** Chosen embeddings (batch_size, 768) */
  chosenEmbeddings: Float32Array[];
  /** Rejected embeddings (batch_size, 768) */
  rejectedEmbeddings: Float32Array[];
  /** Context embeddings (batch_size, 768) */
  contextEmbeddings: Float32Array[];
  /** Batch indices */
  indices: number[];
}

/**
 * Training metrics
 */
export interface ORPOTrainingMetrics {
  /** Current step */
  step: number;
  /** Current epoch */
  epoch: number;
  /** Total steps */
  totalSteps: number;
  /** Training loss */
  trainingLoss: number;
  /** SFT loss */
  sftLoss: number;
  /** ORPO loss */
  orpoLoss: number;
  /** Log odds ratio */
  logOddsRatio: number;
  /** Preference accuracy */
  preferenceAccuracy: number;
  /** Chosen score */
  chosenScore: number;
  /** Rejected score */
  rejectedScore: number;
  /** Gradient norm */
  gradientNorm: number;
  /** Learning rate */
  learningRate: number;
  /** Epoch progress (0-1) */
  epochProgress: number;
  /** Estimated time remaining (seconds) */
  estimatedTimeRemaining?: number;
}

/**
 * Training progress callback
 */
export type ORPOTrainingProgressCallback = (
  metrics: ORPOTrainingMetrics
) => void;

/**
 * Training event callback
 */
export type ORPOTrainingEventCallback = (event: ORPOTrainingEvent) => void;

/**
 * Training event
 */
export interface ORPOTrainingEvent {
  /** Event type */
  type: "start" | "progress" | "checkpoint" | "eval" | "complete" | "error";
  /** Timestamp */
  timestamp: number;
  /** Training ID */
  trainingId: string;
  /** Event data */
  data?: Record<string, unknown>;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  /** Training ID */
  trainingId: string;
  /** Final loss */
  finalLoss: number;
  /** Best loss */
  bestLoss: number;
  /** Preference accuracy */
  preferenceAccuracy: number;
  /** Win rate vs baseline */
  winRateVsBaseline: number;
  /** Training duration (seconds) */
  trainingDuration: number;
  /** Adapter path */
  adapterPath: string;
  /** Success */
  success: boolean;
  /** Error (if failed) */
  error?: string;
}

/**
 * Preference strategy for synthetic data
 */
export interface PreferenceStrategy {
  /** Strategy type */
  type: "design_principle" | "ab_simulation" | "rule_based" | "learned";
  /** Strategy weight */
  weight: number;
  /** Strategy parameters */
  parameters: Record<string, unknown>;
}

/**
 * Synthetic preference configuration
 */
export interface SyntheticPreferenceConfig {
  /** Preference strategies */
  strategies: PreferenceStrategy[];
  /** Quality weight (bias toward quality) */
  qualityWeight: number;
  /** Diversity factor */
  diversity: number;
  /** Random seed */
  seed: number;
  /** Number of pairs to generate */
  numPairs: number;
}

/**
 * Generated preference
 */
export interface GeneratedPreference {
  /** Chosen UI state */
  chosen: UIState;
  /** Rejected UI state */
  rejected: UIState;
  /** Reason for preference */
  reason: string;
  /** Confidence score */
  confidence: number;
  /** Generation strategy used */
  strategy: string;
}

/**
 * Preference source configuration
 */
export interface PreferenceSource {
  /** Source type */
  type: "ab_test" | "shadow_log" | "explicit" | "implicit";
  /** API endpoint (if applicable) */
  endpoint?: string;
  /** Authentication credentials */
  auth?: Record<string, string>;
  /** Polling interval (milliseconds) */
  pollingInterval?: number;
}

/**
 * Collector configuration
 */
export interface CollectorConfig {
  /** Preference sources */
  sources: PreferenceSource[];
  /** Sampling rate (0-1) */
  samplingRate: number;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Whether to anonymize data */
  anonymize: boolean;
  /** Storage path */
  storagePath: string;
}

/**
 * Calibration metrics
 */
export interface CalibrationMetrics {
  /** Expected calibration error */
  expectedCalibrationError: number;
  /** Reliability diagram data */
  reliabilityDiagram: { confidence: number; accuracy: number }[];
  /** Brier score */
  brierScore: number;
}

/**
 * Category metrics
 */
export interface CategoryMetrics {
  /** Category name */
  category: string;
  /** Accuracy */
  accuracy: number;
  /** Win rate */
  winRate: number;
  /** Sample size */
  sampleSize: number;
  /** Average confidence */
  avgConfidence: number;
}

/**
 * Evaluation results
 */
export interface EvaluationResults {
  /** Pairwise accuracy (target: >70%) */
  pairwiseAccuracy: number;
  /** Win rate vs baseline (target: >60%) */
  winRateVsBaseline: number;
  /** Calibration metrics */
  calibration: CalibrationMetrics;
  /** Ranking consistency (transitivity) */
  rankingConsistency: number;
  /** Per-category metrics */
  perCategory: CategoryMetrics[];
  /** Total pairs evaluated */
  totalPairs: number;
  /** Average preference score */
  avgPreferenceScore: number;
  /** Average odds ratio */
  avgOddsRatio: number;
}

/**
 * Data collator options
 */
export interface DataCollatorOptions {
  /** Pad embeddings to max length */
  padEmbeddings: boolean;
  /** Shuffle batches */
  shuffle: boolean;
  /** Drop last incomplete batch */
  dropLast: boolean;
  /** Prefetch batches */
  prefetch: number;
  /** Batch size */
  batchSize?: number;
}

/**
 * Pair encoder result
 */
export interface PairEncoderResult {
  /** Chosen encoding */
  chosenEncoding: Float32Array;
  /** Rejected encoding */
  rejectedEncoding: Float32Array;
  /** Context encoding */
  contextEncoding: Float32Array;
  /** Encoding metadata */
  metadata: {
    /** Encoding time (ms) */
    encodingTime: number;
    /** Model version */
    modelVersion: string;
    /** Device used */
    device: string;
  };
}

/**
 * Preference loader options
 */
export interface PreferenceLoaderOptions {
  /** Validation split ratio */
  validationSplit: number;
  /** Test split ratio */
  testSplit: number;
  /** Shuffle data */
  shuffle: boolean;
  /** Random seed */
  seed: number;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Filter by sources */
  sources?: string[];
  /** Filter by UI context */
  uiContexts?: string[];
}

/**
 * Loaded dataset split
 */
export interface DatasetSplit {
  /** Training pairs */
  train: UIPreferencePair[];
  /** Validation pairs */
  validation: UIPreferencePair[];
  /** Test pairs */
  test: UIPreferencePair[];
  /** Metadata */
  metadata: {
    /** Total pairs */
    total: number;
    /** Source distribution */
    sourceDistribution: Record<string, number>;
    /** Context distribution */
    contextDistribution: Record<string, number>;
    /** Average confidence */
    avgConfidence: number;
  };
}

/**
 * Default multimodal ORPO configuration
 */
export const DEFAULT_MULTIMODAL_ORPO_CONFIG: Partial<MultimodalORPOConfig> = {
  baseModel: {
    embeddingDim: 768,
    usePretrained: true,
  },
  referenceModel: {
    enabled: true,
    frozen: true,
  },
  preferenceHead: {
    type: "mlp",
    hiddenDims: [1536, 768, 384, 1],
    activation: "gelu",
    dropout: 0.1,
    useLayerNorm: true,
    useResiduals: true,
  },
  orpo: {
    beta: 0.1,
    lambda: 1.0,
    sftLossWeight: 1.0,
  },
  training: {
    learningRate: 2e-4,
    batchSize: 8,
    epochs: 3,
    warmupRatio: 0.1,
    gradientClipping: 1.0,
    weightDecay: 0.01,
  },
  multimodal: {
    visualWeight: 0.5,
    textWeight: 0.5,
    fusion: "concat",
  },
};

/**
 * Default preference head configuration
 */
export const DEFAULT_PREFERENCE_HEAD_CONFIG: PreferenceHeadConfig = {
  type: "mlp",
  hiddenDims: [1536, 768, 384, 1],
  activation: "gelu",
  dropout: 0.1,
  useLayerNorm: true,
  useResiduals: true,
};

/**
 * Default collector configuration
 */
export const DEFAULT_COLLECTOR_CONFIG: Partial<CollectorConfig> = {
  samplingRate: 1.0,
  minConfidence: 0.5,
  anonymize: true,
  storagePath: "./data/preferences",
};

/**
 * Default synthetic preference configuration
 */
export const DEFAULT_SYNTHETIC_PREF_CONFIG: Partial<SyntheticPreferenceConfig> =
  {
    strategies: [
      { type: "design_principle", weight: 0.4, parameters: {} },
      { type: "ab_simulation", weight: 0.3, parameters: {} },
      { type: "rule_based", weight: 0.3, parameters: {} },
    ],
    qualityWeight: 0.6,
    diversity: 0.8,
    seed: 42,
    numPairs: 5000,
  };
