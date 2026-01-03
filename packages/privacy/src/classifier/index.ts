/**
 * Privacy Classifier Module for Aequor Cognitive Orchestration Platform
 *
 * This module exports the PrivacyClassifier implementation and related types
 * for classifying query sensitivity levels and detecting PII patterns.
 *
 * Includes:
 * - PrivacyClassifier: Rule-based PII detection
 * - MLPrivacyClassifier: ML-enhanced PII detection with ensemble voting
 * - FeatureExtractor: Feature extraction for ML models
 * - LightweightPIIModel: Lightweight neural network for PII classification
 */

// Rule-based classifier
export { PrivacyClassifier, createPrivacyClassifier } from './PrivacyClassifier.js';
export type {
  InternalPrivacyLevel,
  SensitiveSpan,
  RedactionRule,
  InternalPrivacyClassification,
} from './PrivacyClassifier.js';

// ML-enhanced classifier
export {
  MLPrivacyClassifier,
  createMLPrivacyClassifier,
  FeatureExtractor,
  LightweightPIIModel,
} from './MLPrivacyClassifier.js';
export type {
  MLPIIType,
  FeatureVector,
  MLPrediction,
  TrainingSample,
  ModelMetadata,
  TrainingConfig,
  EnsembleResult,
} from './MLPrivacyClassifier.js';

// Re-export protocol types for convenience
export type {
  PrivacyLevel as PrivacyLevelEnum,
  PIIType as PIITypeEnum,
  PrivacyClassification as PrivacyClassificationType,
  PrivacyClassifier as PrivacyClassifierInterface,
} from '@lsi/protocol';