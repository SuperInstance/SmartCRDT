/**
 * @lsi/vljepa - Training Types
 *
 * Types for VL-JEPA training methodology, fine-tuning, and UI-specific datasets.
 * VL-JEPA uses Joint Embedding Predictive Architecture, NOT traditional autoregressive training.
 *
 * Key Differences from Traditional Training:
 * - Loss: Embedding distance (cosine similarity), NOT token-level cross-entropy
 * - Data: Masked video + text with contextual masking (~10% visible)
 * - Efficiency: 2.85x fewer operations than traditional VLMs
 * - Goal: Predict semantic embeddings, NOT pixels/tokens
 *
 * @module training
 */

/**
 * JEPA vs Traditional Training Comparison
 */
export interface TrainingComparison {
  traditional: {
    approach: "autoregressive";
    loss: "cross-entropy";
    data: "paired (image, caption)";
    efficiency: "low";
    description: "Predicts next token in sequence";
  };
  jepa: {
    approach: "embedding-prediction";
    loss: "embedding-distance";
    data: "masked video + text";
    efficiency: "high";
    description: "Predicts semantic embeddings directly";
  };
}

/**
 * Masking strategy for JEPA contextual masking
 * This is the KEY innovation - only ~10% of input is visible during training
 */
export type MaskingStrategy = "random" | "block" | "tube" | "adaptive";

/**
 * Contextual masking configuration
 * JEPA's core innovation: hide most of the input, force model to learn "world model"
 */
export interface ContextualMaskingConfig {
  /** Percentage of input that is visible (typically 5-15%) */
  visibleRatio: number;

  /** Masking strategy */
  strategy: MaskingStrategy;

  /** For block masking: size of masked blocks */
  blockSize?: number;

  /** For tube masking: temporal extent (for video) */
  tubeLength?: number;

  /** For adaptive masking: threshold for information content */
  adaptiveThreshold?: number;

  /** Masked token value (special token) */
  maskToken: string;

  /** Whether to use spatial masking (block regions) */
  spatialMasking: boolean;

  /** Whether to use temporal masking (for video) */
  temporalMasking: boolean;
}

/**
 * JEPA loss function configuration
 * Uses embedding distance, NOT token-level cross-entropy
 */
export interface JEPALossConfig {
  /** Loss type - always embedding distance for JEPA */
  type: "embedding-distance";

  /** Distance metric */
  metric: "cosine-similarity" | "euclidean" | "manhattan";

  /** Temperature for scaling similarities */
  temperature: number;

  /** Whether to use contrastive loss */
  useContrastive: boolean;

  /** Contrastive temperature (if using contrastive) */
  contrastiveTemperature: number;

  /** Loss weight for predictor alignment */
  predictorWeight: number;

  /** Loss weight for encoder alignment */
  encoderWeight: number;
}

/**
 * JEPA architecture configuration
 */
export interface JEPAArchitectureConfig {
  /** X-Encoder (Vision) - typically ViT */
  xEncoder: {
    type: "ViT" | "Swin" | "ConvNeXt";
    embeddingDim: number; // 768 to match IntentEncoder
    patchSize: number;
    numLayers: number;
    numHeads: number;
    frozen: boolean; // Freeze X-encoder during fine-tuning
  };

  /** Y-Encoder (Language) - typically Transformer */
  yEncoder: {
    type: "Transformer" | "BERT" | "RoBERTa";
    embeddingDim: number; // 768 to match IntentEncoder
    numLayers: number;
    numHeads: number;
    frozen: boolean; // Freeze Y-encoder during fine-tuning
  };

  /** Predictor - narrow Transformer network */
  predictor: {
    type: "Transformer";
    numLayers: number; // Typically fewer than encoders
    hiddenDim: number;
    numHeads: number;
    ffnDim: number;
    dropout: number;
  };
}

/**
 * JEPA training data sources
 */
export interface JEPATrainingDataConfig {
  /** Video sources for pre-training */
  videoSources: string[];

  /** UI-specific datasets for fine-tuning */
  uiSources: string[];

  /** Whether to use synthetic data generation */
  useSynthetic: boolean;

  /** Synthetic data generation config */
  syntheticConfig?: {
    numSamples: number;
    variations: "layout" | "style" | "content" | "all";
  };

  /** Data augmentation */
  augmentation: {
    enabled: boolean;
    flip: boolean;
    rotate: number; // Max rotation degrees
    crop: boolean;
    colorJitter: boolean;
    gaussianBlur: boolean;
  };
}

/**
 * Complete JEPA training configuration
 */
export interface JEPATrainingConfig {
  /** Base model (Meta's VL-JEPA 1.6B) */
  baseModel: string;

  /** Training device */
  device: "cpu" | "cuda" | "webgpu";

  /** Contextual masking configuration */
  masking: ContextualMaskingConfig;

  /** Loss function configuration */
  loss: JEPALossConfig;

  /** Architecture configuration */
  architecture: JEPAArchitectureConfig;

  /** Training data configuration */
  data: JEPATrainingDataConfig;

  /** Training hyperparameters */
  hyperparameters: {
    /** Learning rate */
    learningRate: number;

    /** Batch size */
    batchSize: number;

    /** Number of epochs */
    epochs: number;

    /** Warmup ratio */
    warmupRatio: number;

    /** Weight decay */
    weightDecay: number;

    /** Gradient clipping norm */
    maxGradNorm: number;

    /** Validation frequency (steps) */
    evalSteps: number;

    /** Checkpoint frequency (steps) */
    saveSteps: number;
  };

  /** Output directories */
  output: {
    checkpointsDir: string;
    logsDir: string;
    tensorboardDir: string;
  };
}

/**
 * UI dataset entry for fine-tuning
 */
export interface UIDataEntry {
  /** Unique identifier */
  id: string;

  /** UI screenshot (before) */
  beforeImage: ImageData;

  /** UI screenshot (after change) */
  afterImage?: ImageData;

  /** User instruction */
  instruction: string;

  /** User intent (semantic embedding) */
  intentEmbedding?: Float32Array;

  /** UI metadata */
  metadata: {
    framework: "React" | "Vue" | "Angular" | "Svelte" | "Unknown";
    componentLib: string;
    layout: "grid" | "flex" | "absolute" | "unknown";
    responsive: boolean;
    theme: "light" | "dark" | "auto";
  };

  /** UI components in the screenshot */
  components?: UIComponent[];

  /** User interactions (if available) */
  interactions?: UserInteraction[];
}

/**
 * UI component detected in screenshot
 */
export interface UIComponent {
  /** Component type */
  type:
    | "button"
    | "input"
    | "text"
    | "image"
    | "container"
    | "navigation"
    | "form"
    | "other";

  /** Bounding box */
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  /** Component attributes */
  attributes: Record<string, unknown>;

  /** Text content (if any) */
  text?: string;

  /** Semantic embedding */
  embedding?: Float32Array;
}

/**
 * User interaction with UI
 */
export interface UserInteraction {
  /** Interaction type */
  type: "click" | "type" | "scroll" | "hover" | "drag";

  /** Target component */
  target?: UIComponent;

  /** Timestamp */
  timestamp: number;

  /** Interaction data */
  data: {
    text?: string;
    position?: { x: number; y: number };
    duration?: number;
  };

  /** User's goal (intent) */
  goal?: string;
}

/**
 * UI video frame for temporal JEPA training
 */
export interface UIVideoFrame {
  /** Frame number */
  frameNumber: number;

  /** Frame timestamp */
  timestamp: number;

  /** Frame image data */
  image: ImageData;

  /** Frame embedding (pre-computed) */
  embedding?: Float32Array;

  /** User interactions in this frame */
  interactions?: UserInteraction[];
}

/**
 * UI video clip for JEPA training
 */
export interface UIVideoClip {
  /** Unique identifier */
  id: string;

  /** Frame rate (fps) */
  frameRate: number;

  /** Frames in the clip */
  frames: UIVideoFrame[];

  /** Clip description/instruction */
  description: string;

  /** Start frame index */
  startFrame: number;

  /** End frame index */
  endFrame: number;

  /** Clip metadata */
  metadata: UIDataEntry["metadata"];
}

/**
 * Curriculum learning stage
 * JEPA uses curriculum learning: start simple, get complex
 */
export interface CurriculumStage {
  /** Stage name */
  name: string;

  /** Stage description */
  description: string;

  /** Stage number */
  stageNumber: number;

  /** Number of epochs for this stage */
  epochs: number;

  /** Learning rate multiplier */
  lrMultiplier: number;

  /** Dataset subset for this stage */
  datasetFilter: (entry: UIDataEntry) => boolean;

  /** Masking configuration for this stage */
  maskingConfig: Partial<ContextualMaskingConfig>;

  /** Success criteria to advance to next stage */
  successCriteria: {
    minAccuracy?: number;
    maxLoss?: number;
    minConfidence?: number;
  };
}

/**
 * Fine-tuning configuration for UI tasks
 */
export interface UIFineTuningConfig {
  /** Base JEPA model path */
  baseModelPath: string;

  /** Layers to freeze (transfer learning) */
  layersToFreeze: string[];

  /** Learning rate */
  learningRate: number;

  /** Batch size */
  batchSize: number;

  /** Number of epochs */
  epochs: number;

  /** Curriculum learning stages */
  curriculum: CurriculumStage[];

  /** UI dataset path */
  datasetPath: string;

  /** Validation split ratio */
  validationSplit: number;

  /** Early stopping patience */
  earlyStoppingPatience: number;

  /** Output directory */
  outputDir: string;
}

/**
 * JEPA training metrics
 */
export interface JEPATrainingMetrics {
  /** Current step */
  step: number;

  /** Current epoch */
  epoch: number;

  /** Total steps */
  totalSteps: number;

  /** Training loss (embedding distance) */
  trainingLoss: number;

  /** Validation loss */
  validationLoss?: number;

  /** Learning rate */
  learningRate: number;

  /** Epoch progress (0-1) */
  epochProgress: number;

  /** Estimated time remaining (seconds) */
  estimatedTimeRemaining?: number;

  /** GPU memory usage (MB) */
  gpuMemoryUsage?: number;

  /** Embedding alignment accuracy */
  embeddingAccuracy?: number;

  /** Predictor confidence */
  predictorConfidence?: number;

  /** Masked prediction accuracy */
  maskedAccuracy?: number;

  /** Curriculum stage (if using curriculum) */
  curriculumStage?: number;
}

/**
 * JEPA training checkpoint
 */
export interface JEPACheckpoint {
  /** Checkpoint ID */
  id: string;

  /** Timestamp */
  timestamp: number;

  /** Step number */
  step: number;

  /** Epoch number */
  epoch: number;

  /** Training loss */
  trainingLoss: number;

  /** Validation loss */
  validationLoss?: number;

  /** Model weights path */
  modelPath: string;

  /** Checkpoint directory */
  checkpointDir: string;

  /** Training config snapshot */
  config: JEPATrainingConfig;

  /** Metrics at checkpoint time */
  metrics: JEPATrainingMetrics;
}

/**
 * JEPA training status
 */
export enum JEPATrainingStatus {
  IDLE = "idle",
  PREPARING = "preparing",
  TRAINING = "training",
  VALIDATING = "validating",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

/**
 * JEPA training progress callback
 */
export type JEPATrainingProgressCallback = (
  metrics: JEPATrainingMetrics
) => void;

/**
 * JEPA training event callback
 */
export type JEPATrainingEventCallback = (event: JEPATrainingEvent) => void;

/**
 * JEPA training event
 */
export interface JEPATrainingEvent {
  /** Event type */
  type:
    | "start"
    | "progress"
    | "checkpoint"
    | "eval"
    | "curriculum_advance"
    | "complete"
    | "error"
    | "cancel";

  /** Timestamp */
  timestamp: number;

  /** Training ID */
  trainingId: string;

  /** Event data */
  data?: Record<string, unknown>;
}

/**
 * JEPA training result
 */
export interface JEPATrainingResult {
  /** Training ID */
  trainingId: string;

  /** Final checkpoint */
  finalCheckpoint: JEPACheckpoint;

  /** Best checkpoint (by validation loss) */
  bestCheckpoint: JEPACheckpoint;

  /** Training duration (seconds) */
  trainingDuration: number;

  /** Final metrics */
  finalMetrics: JEPATrainingMetrics;

  /** Training config */
  config: JEPATrainingConfig;

  /** Model path */
  modelPath: string;

  /** Success */
  success: boolean;

  /** Error (if failed) */
  error?: string;
}

/**
 * Default JEPA training configuration
 */
export const DEFAULT_JEPA_CONFIG: Partial<JEPATrainingConfig> = {
  baseModel: "facebook/vl-jepa-1.6b",
  device: "cuda",
  masking: {
    visibleRatio: 0.1, // Only 10% visible!
    strategy: "block",
    blockSize: 16,
    maskToken: "[MASK]",
    spatialMasking: true,
    temporalMasking: true,
  },
  loss: {
    type: "embedding-distance",
    metric: "cosine-similarity",
    temperature: 0.07,
    useContrastive: true,
    contrastiveTemperature: 0.05,
    predictorWeight: 1.0,
    encoderWeight: 0.5,
  },
  architecture: {
    xEncoder: {
      type: "ViT",
      embeddingDim: 768,
      patchSize: 16,
      numLayers: 12,
      numHeads: 12,
      frozen: true, // Freeze during fine-tuning
    },
    yEncoder: {
      type: "Transformer",
      embeddingDim: 768,
      numLayers: 6,
      numHeads: 8,
      frozen: true, // Freeze during fine-tuning
    },
    predictor: {
      type: "Transformer",
      numLayers: 4, // Narrow predictor
      hiddenDim: 768,
      numHeads: 8,
      ffnDim: 2048,
      dropout: 0.1,
    },
  },
  hyperparameters: {
    learningRate: 1e-4,
    batchSize: 32,
    epochs: 10,
    warmupRatio: 0.1,
    weightDecay: 0.01,
    maxGradNorm: 1.0,
    evalSteps: 100,
    saveSteps: 500,
  },
};

/**
 * Default UI fine-tuning configuration
 */
export const DEFAULT_UI_FINETUNING_CONFIG: Partial<UIFineTuningConfig> = {
  layersToFreeze: ["xEncoder", "yEncoder"], // Freeze encoders, train predictor only
  learningRate: 5e-5,
  batchSize: 16,
  epochs: 20,
  validationSplit: 0.2,
  earlyStoppingPatience: 5,
};
