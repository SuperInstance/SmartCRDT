/**
 * @lsi/vljepa-orpo - Multimodal ORPO for VL-JEPA
 *
 * Integrates VL-JEPA's visual understanding with ORPO's preference optimization.
 * Trains multimodal models to align with user UI preferences.
 *
 * @packageDocumentation
 * @module @lsi/vljepa-orpo
 */

// ============================================================================
// Types
// ============================================================================
export type {
  UIState,
  DOMStructure,
  CSSProperties,
  PreferenceContext,
  Demographics,
  PreferenceMetadata,
  UIPreferencePair,
  PreferenceHeadConfig,
  MultimodalORPOConfig,
  ORPOForwardResult,
  TrainingBatch,
  ORPOTrainingMetrics,
  ORPOTrainingProgressCallback,
  ORPOTrainingEventCallback,
  ORPOTrainingEvent,
  OptimizationResult,
  PreferenceStrategy,
  SyntheticPreferenceConfig,
  GeneratedPreference,
  PreferenceSource,
  CollectorConfig,
  CalibrationMetrics,
  CategoryMetrics,
  EvaluationResults,
  DataCollatorOptions,
  PairEncoderResult,
  PreferenceLoaderOptions,
  DatasetSplit,
} from "./types.js";

export {
  DEFAULT_MULTIMODAL_ORPO_CONFIG,
  DEFAULT_PREFERENCE_HEAD_CONFIG,
  DEFAULT_COLLECTOR_CONFIG,
  DEFAULT_SYNTHETIC_PREF_CONFIG,
} from "./types.js";

// ============================================================================
// Models
// ============================================================================
export {
  MultimodalORPOModel,
  PreferenceHead,
  ReferenceModel,
  createMultimodalORPOModel,
} from "./models/MultimodalORPOModel.js";

export { PairEncoder, createPairEncoder } from "./models/PairEncoder.js";

export {
  PreferenceCollector,
  createPreferenceCollector,
} from "./models/PreferenceCollector.js";

// ============================================================================
// Trainers
// ============================================================================
export {
  ORPOLossFunction,
  computeLogProb,
  computeSequenceLogProb,
  batchComputeORPOLoss,
  computeAverageORPOLoss,
  createORPOLossFunction,
} from "./trainers/LossFunctions.js";

export { ORPOTrainer, createORPOTrainer } from "./trainers/ORPOTrainer.js";

export { DataCollator, createDataCollator } from "./trainers/DataCollator.js";

// ============================================================================
// Data
// ============================================================================
export {
  PreferenceDataset,
  createPreferenceDataset,
  loadPreferenceDataset,
} from "./data/PreferenceDataset.js";

export {
  SyntheticPreferences,
  createSyntheticPreferences,
  generateSyntheticPreferences,
} from "./data/SyntheticPreferences.js";

export {
  PreferenceLoader,
  createPreferenceLoader,
  loadPreferenceDataset as loadPreferenceDatasetWithLoader,
} from "./data/PreferenceLoader.js";

// ============================================================================
// Evaluators
// ============================================================================
export {
  WinRateCalculator,
  createWinRateCalculator,
  calculateWinRate,
} from "./evaluators/WinRateCalculator.js";

export {
  PreferenceEvaluator,
  createPreferenceEvaluator,
  evaluateModel,
} from "./evaluators/PreferenceEvaluator.js";

// ============================================================================
// Integrations
// ============================================================================
export {
  VLJEPABridge,
  createVLJEPABridge,
} from "./integrations/VLJEPABridge.js";

export {
  ORPOLegacyBridge,
  createORPOLegacyBridge,
} from "./integrations/ORPOLegacyBridge.js";

// ============================================================================
// Re-exports from types
// ============================================================================
// Note: MLPLayer is internal to MultimodalORPOModel and not exported
