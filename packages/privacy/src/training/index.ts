/**
 * Training module exports
 *
 * Exports training pipeline components for privacy classifier.
 */

export { ClassifierTrainer } from "./ClassifierTrainer.js";

export type {
  LabeledQuery,
  TrainingConfig,
  TrainingResult,
  ConfusionMatrix,
  QueryFeatures,
  TrainedModelData,
} from "./ClassifierTrainer.js";

// Re-export PrivacyCategory for convenience
export { PrivacyCategory } from "../privacy/PrivacyClassifier.js";
