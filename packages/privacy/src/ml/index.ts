/**
 * @file Privacy-Preserving Machine Learning Module
 *
 * Exports differential privacy mechanisms for ML training.
 *
 * @module privacy/ml
 */

// Differential privacy mechanisms
export {
  DifferentialPrivacy,
  MomentsAccountant,
  RDPAccountant,
  ZCDPAccountant,
} from "./DifferentialPrivacy.js";

export type {
  PrivacyBudget,
  PrivacyCost,
  UtilityLoss,
  Recommendation,
  DifferentialPrivacyConfig,
} from "./DifferentialPrivacy.js";

// Private gradient computation
export { PrivateGradient, DEFAULT_GRADIENT_CONFIG } from "./PrivateGradient.js";

export type {
  PrivateGradientConfig,
  ClippingStats,
  GradientResult,
} from "./PrivateGradient.js";

// Private trainer
export { PrivateTrainer, DEFAULT_TRAINER_CONFIG } from "./PrivateTrainer.js";

export type {
  TrainingData,
  ValidationData,
  Model,
  TrainingResult,
  BatchResult,
  TrainingMetrics,
  BudgetAllocation,
  PrivacyReport,
  PrivacyRisk,
  NoiseMultiplierResult,
  ClippingNormResult,
  BatchSizeResult,
  PrivacyUtilityCurve,
  OptimizationResult,
  UtilityMetrics,
  PrivateTrainerConfig,
} from "./PrivateTrainer.js";
