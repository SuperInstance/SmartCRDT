/**
 * @fileoverview Core types for VL-JEPA training pipeline
 * @package @lsi/vljepa-training
 */

import type {
  VLJEPATrainingConfig,
  UIJEPATrainingData,
  VLJEPAAction,
} from "@lsi/protocol";

/**
 * Pipeline stage configuration
 */
export interface PipelineStage {
  /** Unique stage identifier */
  name: string;

  /** Stage type determining execution logic */
  type:
    | "data_prep"
    | "preprocessing"
    | "train"
    | "validate"
    | "checkpoint"
    | "finalize"
    | "evaluate"
    | "visualize";

  /** Stage-specific configuration */
  config: Record<string, unknown>;

  /** Stages that must complete before this one */
  dependencies: string[];

  /** Whether this stage is enabled */
  enabled: boolean;

  /** Maximum execution time in milliseconds */
  timeout?: number;

  /** Number of retries on failure */
  retries?: number;
}

/**
 * Main pipeline configuration
 */
export interface TrainingPipelineConfig {
  /** Pipeline stages in execution order */
  stages: PipelineStage[];

  /** Data configuration */
  data: DataConfig;

  /** Model architecture configuration */
  model: ModelConfig;

  /** Training hyperparameters */
  training: TrainingConfig;

  /** Monitoring and logging configuration */
  monitoring: MonitoringConfig;

  /** Checkpointing strategy */
  checkpointing: CheckpointConfig;

  /** Callback configuration */
  callbacks: CallbackConfig;

  /** Visualization settings */
  visualization: VisualizationConfig;

  /** Device configuration */
  device: DeviceConfig;
}

/**
 * Data loading and preprocessing configuration
 */
export interface DataConfig {
  /** Training data path/pattern */
  trainPath: string;

  /** Validation data path/pattern */
  valPath: string;

  /** Test data path/pattern (optional) */
  testPath?: string;

  /** Dataset type */
  datasetType: "image" | "video" | "multimodal" | "ui";

  /** Data augmentation settings */
  augmentation: {
    enabled: boolean;
    horizontalFlip: boolean;
    rotation: number;
    colorJitter: {
      brightness: number;
      contrast: number;
      saturation: number;
      hue: number;
    };
    randomCrop: boolean;
    gaussianBlur: boolean;
  };

  /** Preprocessing settings */
  preprocessing: {
    normalize: boolean;
    mean?: number[];
    std?: number[];
    resize?: {
      width: number;
      height: number;
    };
  };

  /** Data loader settings */
  loader: {
    batchSize: number;
    numWorkers: number;
    pinMemory: boolean;
    shuffle: boolean;
    dropLast: boolean;
  };

  /** Curriculum learning settings */
  curriculum?: {
    enabled: boolean;
    stages: CurriculumStage[];
  };
}

/**
 * Curriculum learning stage
 */
export interface CurriculumStage {
  /** Stage name */
  name: string;

  /** Number of epochs for this stage */
  epochs: number;

  /** Difficulty level [0, 1] */
  difficulty: number;

  /** Data subsets to use */
  subsets: string[];

  /** Learning rate multiplier */
  lrMultiplier: number;
}

/**
 * Model architecture configuration
 */
export interface ModelConfig {
  /** Model type */
  type: "vl-jepa" | "vision-transformer" | "language-transformer" | "combined";

  /** Architecture specific settings */
  architecture: {
    embeddingDim: number;
    numLayers: number;
    numAttentionHeads: number;
    hiddenDim: number;
    dropout: number;
    activation: "relu" | "gelu" | "silu" | "swish";
  };

  /** Vision encoder settings */
  visionEncoder: {
    patchSize: number;
    numPatches: number;
    positionEmbedding: boolean;
  };

  /** Language encoder settings */
  languageEncoder: {
    vocabSize: number;
    maxLength: number;
    positionEmbedding: boolean;
  };

  /** Predictor settings */
  predictor: {
    numLayers: number;
    hiddenDim: number;
    predictionDepth: number;
  };

  /** Weight initialization */
  initialization: {
    type: "xavier" | "kaiming" | "orthogonal" | "default";
    gain?: number;
  };

  /** Pretrained weights path (optional) */
  pretrainedPath?: string;

  /** Freeze certain layers */
  freezeLayers?: string[];
}

/**
 * Training hyperparameters
 */
export interface TrainingConfig extends VLJEPATrainingConfig {
  /** Optimizer configuration */
  optimizer: {
    type: "adam" | "adamw" | "sgd" | "rmsprop";
    learningRate: number;
    weightDecay: number;
    beta1?: number;
    beta2?: number;
    momentum?: number;
    epsilon?: number;
  };

  /** Learning rate schedule */
  lrSchedule: LRScheduleConfig;

  /** Gradient clipping */
  gradientClipping: {
    enabled: boolean;
    maxNorm?: number;
    value?: number;
    algorithm: "norm" | "value";
  };

  /** Loss configuration */
  loss: {
    type: "mse" | "smooth_l1" | "cosine" | "combined";
    weights: {
      worldModel: number;
      prediction: number;
      auxiliary?: number;
    };
  };

  /** Mixed precision training */
  mixedPrecision: {
    enabled: boolean;
    dtype: "float16" | "bfloat16";
  };

  /** Distributed training */
  distributed: {
    enabled: boolean;
    backend: "nccl" | "gloo" | "mpi";
    worldSize: number;
  };

  /** Validation settings */
  validation: {
    frequency: number;
    batchSize?: number;
  };

  /** Number of epochs */
  epochs: number;
}

/**
 * Learning rate schedule configuration
 */
export interface LRScheduleConfig {
  /** Schedule type */
  type:
    | "step"
    | "cosine"
    | "warmup_cosine"
    | "exponential"
    | "one_cycle"
    | "constant";

  /** Initial learning rate */
  initialLR?: number;

  /** Maximum learning rate */
  maxLR?: number;

  /** Minimum learning rate */
  minLR?: number;

  /** Warmup epochs */
  warmupEpochs?: number;

  /** Step size for step decay */
  stepSize?: number;

  /** Decay rate for step/exponential */
  gamma?: number;

  /** Total epochs for cosine schedule */
  totalEpochs: number;

  /** Cycle length for one_cycle */
  cycleLength?: number;
}

/**
 * Monitoring and logging configuration
 */
export interface MonitoringConfig {
  /** Metrics to track */
  metrics: MetricsConfig;

  /** TensorBoard settings */
  tensorboard: TensorBoardConfig;

  /** Weights & Biases settings */
  wandb: WandBConfig;

  /** Alert configuration */
  alerts: AlertConfig[];

  /** Logging frequency */
  logFrequency: number;

  /** Progress bar */
  progressBar: boolean;
}

/**
 * Metrics tracking configuration
 */
export interface MetricsConfig {
  /** Scalar metrics to track */
  scalars: string[];

  /** Histogram metrics to track */
  histograms: string[];

  /** Metrics to aggregate */
  aggregations: AggregationType[];

  /** Storage backend */
  storage: MetricStorageConfig;
}

/**
 * Aggregation type for metrics
 */
export type AggregationType = "mean" | "median" | "std" | "min" | "max" | "sum";

/**
 * Metric storage configuration
 */
export interface MetricStorageConfig {
  /** Storage backend */
  backend: "memory" | "file" | "database";

  /** Storage path (for file backend) */
  path?: string;

  /** Database connection string (for database backend) */
  connectionString?: string;

  /** Retention policy */
  retention?: {
    keepAll: boolean;
    keepBest: number;
    keepLast: number;
  };
}

/**
 * TensorBoard configuration
 */
export interface TensorBoardConfig {
  /** Enable TensorBoard logging */
  enabled: boolean;

  /** Log directory */
  logDir: string;

  /** Logging frequency (batches) */
  frequency: number;

  /** Scalars to log */
  scalars: string[];

  /** Histograms to log */
  histograms: string[];

  /** Images to log */
  images: string[];

  /** Log model graph */
  logGraph: boolean;

  /** Log hyperparameters */
  logHyperparams: boolean;
}

/**
 * Weights & Biases configuration
 */
export interface WandBConfig {
  /** Enable W&B logging */
  enabled: boolean;

  /** Project name */
  project: string;

  /** Entity name */
  entity?: string;

  /** Run name */
  runName?: string;

  /** API key */
  apiKey?: string;

  /** Logging frequency */
  frequency: number;
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Alert type */
  type: "metric" | "loss" | "accuracy" | "latency" | "memory" | "gradient";

  /** Condition to trigger alert */
  condition: AlertCondition;

  /** Severity level */
  severity: "info" | "warning" | "error" | "critical";

  /** Action to take */
  action: AlertAction;

  /** Notification method */
  notification: "log" | "email" | "webhook" | "console";
}

/**
 * Alert condition
 */
export interface AlertCondition {
  /** Comparison operator */
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=";

  /** Threshold value */
  threshold: number;

  /** Consecutive occurrences */
  consecutive?: number;
}

/**
 * Alert action
 */
export interface AlertAction {
  /** Stop training */
  stopTraining: boolean;

  /** Save checkpoint */
  saveCheckpoint: boolean;

  /** Run custom script */
  script?: string;
}

/**
 * Checkpointing configuration
 */
export interface CheckpointConfig {
  /** Enable checkpointing */
  enabled: boolean;

  /** Checkpoint directory */
  dir: string;

  /** Checkpointing frequency (epochs) */
  frequency: number;

  /** Retention policy */
  keep: {
    best: number;
    last: number;
    every: number;
  };

  /** Validate before saving */
  validateBeforeSave: boolean;

  /** Compression */
  compression: "gzip" | "bz2" | "none";

  /** Save optimizer state */
  saveOptimizer: boolean;

  /** Save training state */
  saveTrainingState: boolean;
}

/**
 * Callback configuration
 */
export interface CallbackConfig {
  /** Early stopping settings */
  earlyStopping?: EarlyStoppingConfig;

  /** Learning rate scheduler */
  lrScheduler: LRSchedulerConfig;

  /** Gradient monitoring */
  gradientMonitor?: GradientMonitorConfig;

  /** Validation callback */
  validationCallback?: ValidationCallbackConfig;

  /** Model checkpoint callback */
  modelCheckpoint?: ModelCheckpointConfig;
}

/**
 * Early stopping configuration
 */
export interface EarlyStoppingConfig {
  /** Enable early stopping */
  enabled: boolean;

  /** Metric to monitor */
  monitor:
    | "val_loss"
    | "val_accuracy"
    | "preference_accuracy"
    | "training_loss";

  /** Patience (epochs without improvement) */
  patience: number;

  /** Minimum change to qualify as improvement */
  minDelta: number;

  /** Mode (minimize or maximize) */
  mode: "min" | "max";

  /** Restore best weights on stop */
  restoreBestWeights: boolean;

  /** Stop training if no improvement */
  stopTraining: boolean;
}

/**
 * Learning rate scheduler configuration
 */
export interface LRSchedulerConfig {
  /** Enable scheduler */
  enabled: boolean;

  /** Schedule type */
  type: "step" | "cosine" | "warmup_cosine" | "one_cycle" | "reduce_on_plateau";

  /** Settings (same as LRScheduleConfig) */
  settings: LRScheduleConfig;
}

/**
 * Gradient monitoring configuration
 */
export interface GradientMonitorConfig {
  /** Enable monitoring */
  enabled: boolean;

  /** Log gradient norms */
  logNorms: boolean;

  /** Log gradient distributions */
  logHistograms: boolean;

  /** Check for vanishing/exploding gradients */
  checkAnomalies: boolean;

  /** Threshold for anomaly detection */
  anomalyThreshold: number;

  /** Action on anomaly */
  anomalyAction: "log" | "skip" | "clip" | "stop";
}

/**
 * Validation callback configuration
 */
export interface ValidationCallbackConfig {
  /** Enable callback */
  enabled: boolean;

  /** Validation frequency (epochs) */
  frequency: number;

  /** Save validation predictions */
  savePredictions: boolean;

  /** Compute detailed metrics */
  detailedMetrics: boolean;
}

/**
 * Model checkpoint callback configuration
 */
export interface ModelCheckpointConfig {
  /** Enable callback */
  enabled: boolean;

  /** Save best model */
  saveBest: boolean;

  /** Save last model */
  saveLast: boolean;

  /** Metric for 'best' */
  monitor: string;

  /** Mode */
  mode: "min" | "max";
}

/**
 * Visualization configuration
 */
export interface VisualizationConfig {
  /** Enable visualization */
  enabled: boolean;

  /** Output directory */
  outputDir: string;

  /** Output formats */
  formats: ("png" | "svg" | "html" | "json")[];

  /** Visualization frequency */
  frequency: number;

  /** Interactive visualizations (HTML) */
  interactive: boolean;

  /** Embedding visualization settings */
  embeddings: {
    enabled: boolean;
    method: "pca" | "tsne" | "umap";
    dimension: 2 | 3;
    samples: number;
  };

  /** Attention visualization settings */
  attention: {
    enabled: boolean;
    layers: number[];
    heads: number[];
    samples: number;
  };

  /** Loss curve settings */
  lossCurves: {
    enabled: boolean;
    smoothing: number;
    figsize: [number, number];
  };

  /** Confusion matrix settings */
  confusionMatrix: {
    enabled: boolean;
    normalize: boolean;
  };
}

/**
 * Device configuration
 */
export interface DeviceConfig {
  /** Device type */
  type: "cpu" | "cuda" | "mps" | "webgpu";

  /** Device ID (for multi-GPU) */
  deviceId?: number;

  /** Number of devices */
  numDevices?: number;

  /** Memory settings */
  memory: {
    maxMemoryMB?: number;
    memoryFraction?: number;
    allowGrowth: boolean;
  };

  /** Performance settings */
  performance: {
    allowTF32: boolean;
    allowFp16: boolean;
    cudnnBenchmark: boolean;
    cudnnDeterministic: boolean;
  };
}

/**
 * Training metrics at a point in time
 */
export interface TrainingMetrics {
  /** Epoch number */
  epoch: number;

  /** Batch number */
  batch: number;

  /** Loss metrics */
  loss: {
    training: number;
    validation: number;
    worldModel?: number;
    prediction?: number;
    orpo?: number;
  };

  /** Accuracy metrics */
  accuracy: {
    top1?: number;
    top5?: number;
    preference?: number;
  };

  /** Latency metrics (ms) */
  latency: {
    forward: number;
    backward: number;
    total: number;
  };

  /** Memory usage (MB) */
  memory: {
    gpu: number;
    cpu: number;
    peak: number;
  };

  /** Throughput (examples/sec) */
  throughput: number;

  /** Learning dynamics */
  learning: {
    gradientNorm: number;
    learningRate: number;
    momentum?: number;
  };

  /** Timestamp */
  timestamp: number;
}

/**
 * Stage execution result
 */
export interface StageResult {
  /** Stage name */
  name: string;

  /** Success status */
  success: boolean;

  /** Error message (if failed) */
  error?: string;

  /** Execution time (ms) */
  duration: number;

  /** Stage-specific output */
  output?: Record<string, unknown>;

  /** Retry count */
  retries: number;
}

/**
 * Pipeline execution result
 */
export interface PipelineResult {
  /** Overall success */
  success: boolean;

  /** Stage results */
  stages: StageResult[];

  /** Final metrics */
  metrics: TrainingMetrics;

  /** Checkpoints saved */
  checkpoints: CheckpointInfo[];

  /** Total duration (ms) */
  duration: number;

  /** Artifacts generated */
  artifacts: Artifact[];

  /** Error message (if failed) */
  error?: string;
}

/**
 * Checkpoint information
 */
export interface CheckpointInfo {
  /** Checkpoint path */
  path: string;

  /** Epoch number */
  epoch: number;

  /** Metrics at checkpoint */
  metrics: TrainingMetrics;

  /** Checkpoint type */
  type: "best" | "last" | "epoch" | "manual";

  /** Timestamp */
  timestamp: number;

  /** File size (bytes) */
  size: number;
}

/**
 * Artifact information
 */
export interface Artifact {
  /** Artifact type */
  type:
    | "model"
    | "checkpoint"
    | "log"
    | "visualization"
    | "metrics"
    | "prediction";

  /** Artifact path */
  path: string;

  /** Artifact metadata */
  metadata: Record<string, unknown>;

  /** Timestamp */
  timestamp: number;
}

/**
 * Evaluation result
 */
export interface EvaluationResult {
  /** Model checkpoint used */
  checkpoint: string;

  /** Test set metrics */
  metrics: {
    loss: number;
    accuracy: number;
    top5Accuracy?: number;
    preferenceAccuracy?: number;
  };

  /** Per-class metrics */
  perClass?: {
    class: string;
    precision: number;
    recall: number;
    f1: number;
  }[];

  /** Confusion matrix */
  confusionMatrix?: number[][];

  /** Sample predictions */
  predictions?: {
    input: unknown;
    target: unknown;
    prediction: unknown;
    confidence: number;
  }[];

  /** Evaluation duration (ms) */
  duration: number;
}

/**
 * Training state for resuming
 */
export interface TrainingState {
  /** Current epoch */
  epoch: number;

  /** Current batch */
  batch: number;

  /** Model state dict */
  modelState: Record<string, unknown>;

  /** Optimizer state */
  optimizerState: Record<string, unknown>;

  /** Learning rate scheduler state */
  lrSchedulerState: Record<string, unknown>;

  /** Random states */
  randomStates: {
    python?: number;
    numpy?: number;
    torch?: number[];
    cuda?: number[];
  };

  /** Metrics history */
  metricsHistory: TrainingMetrics[];

  /** Best metrics */
  bestMetrics: {
    epoch: number;
    metrics: TrainingMetrics;
  };

  /** Configuration hash */
  configHash: string;
}
