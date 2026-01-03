/**
 * Privacy classification components
 *
 * This module exports privacy classification utilities including:
 * - PrivacyClassifier: Main classifier with LOGIC/STYLE/SECRET categorization
 * - PIIDetector: PII detection for 12 PII types
 */

export {
  PrivacyClassifier,
  PIIDetector,
  PrivacyCategory,
  type PrivacyClassification,
  type PrivacyClassifierConfig,
  type StylePattern,
} from "./PrivacyClassifier.js";
