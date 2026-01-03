/**
 * @fileoverview Main entry point for @lsi/vljepa-training
 * @package @lsi/vljepa-training
 */

// Pipeline
export { TrainingPipeline } from "./pipeline/TrainingPipeline.js";

// Monitoring
export { MetricsTracker } from "./monitoring/MetricsTracker.js";
export { TensorBoardLogger } from "./monitoring/TensorBoardLogger.js";
export { WandBLogger } from "./monitoring/WandBLogger.js";
export { AlertManager } from "./monitoring/AlertManager.js";

// Checkpointing
export { CheckpointManager } from "./checkpointing/CheckpointManager.js";
export { ModelRegistry } from "./checkpointing/ModelRegistry.js";
export { RollbackManager } from "./checkpointing/RollbackManager.js";

// Callbacks
export { EarlyStopping } from "./callbacks/EarlyStopping.js";
export { LRScheduler } from "./callbacks/LRScheduler.js";
export { GradientMonitor } from "./callbacks/GradientMonitor.js";
export { ValidationCallback } from "./callbacks/ValidationCallback.js";

// Visualization
export { EmbeddingVisualizer } from "./visualization/EmbeddingVisualizer.js";
export { AttentionVisualizer } from "./visualization/AttentionVisualizer.js";
export { LossPlotter } from "./visualization/LossPlotter.js";
export { ComparisonViewer } from "./visualization/ComparisonViewer.js";

// Configuration
export {
  getDefaultConfig,
  getQuickConfig,
  getProductionConfig,
} from "./config/TrainingConfig.js";

// Types
export type {
  // Main types
  TrainingPipelineConfig,
  PipelineStage,
  PipelineResult,
  StageResult,
  TrainingMetrics,
  TrainingState,

  // Data types
  DataConfig,
  CurriculumStage,

  // Model types
  ModelConfig,

  // Training types
  TrainingConfig,
  LRScheduleConfig,

  // Monitoring types
  MonitoringConfig,
  MetricsConfig,
  MetricStorageConfig,
  TensorBoardConfig,
  WandBConfig,
  AlertConfig,
  AlertCondition,
  AlertAction,
  AggregationType,

  // Checkpointing types
  CheckpointConfig,
  CheckpointInfo,

  // Callback types
  CallbackConfig,
  EarlyStoppingConfig,
  LRSchedulerConfig,
  GradientMonitorConfig,
  ValidationCallbackConfig,

  // Visualization types
  VisualizationConfig,

  // Device types
  DeviceConfig,

  // Evaluation types
  EvaluationResult,

  // Artifact types
  Artifact,
} from "./types.js";
