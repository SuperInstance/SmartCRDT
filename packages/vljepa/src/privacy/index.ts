/**
 * VL-JEPA Privacy Module
 *
 * Privacy-preserving visual data processing for VL-JEPA.
 *
 * ## Components
 *
 * - **VisualPrivacyAnalyzer**: Analyze privacy risks in visual data
 * - **OnDevicePolicy**: Enforce on-device processing
 * - **VisualPIIRedaction**: Redact PII from visual data
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   VisualPrivacyAnalyzer,
 *   OnDevicePolicy,
 *   VisualPIIRedactor,
 *   createDefaultPrivacyPolicy,
 *   createBalancedOnDevicePolicy,
 *   createDefaultRedactionConfig,
 * } from '@lsi/vljepa/privacy';
 *
 * // 1. Analyze privacy
 * const analyzer = new VisualPrivacyAnalyzer({
 *   policy: createDefaultPrivacyPolicy(),
 * });
 * const analysis = await analyzer.analyze(frame, VisualDataType.UI_FRAME);
 *
 * // 2. Enforce on-device policy
 * const policy = new OnDevicePolicy(createBalancedOnDevicePolicy());
 * policy.validateProcessingLocation(config);
 *
 * // 3. Redact PII if needed
 * const redactor = new VisualPIIRedactor(createDefaultRedactionConfig());
 * const redacted = await redactor.redact(frame, analysis.detectedPII);
 * ```
 *
 * @packageDocumentation
 */

// Visual Privacy Analyzer
export {
  VisualPrivacyAnalyzer,
  createDefaultPrivacyPolicy,
  createStrictPrivacyPolicy,
} from "./VisualPrivacyAnalyzer";

export {
  VisualDataType,
  VisualPIIType,
  ProcessingLocation,
  PrivacyRiskLevel,
  VisualDataAction,
} from "./VisualPrivacyAnalyzer";

export type {
  BoundingBox,
  VisualPrivacyPolicy,
  VisualPrivacyAnalysis,
  VisualPrivacyAnalyzerConfig,
} from "./VisualPrivacyAnalyzer";

// On-Device Policy
export {
  OnDevicePolicy,
  createStrictOnDevicePolicy,
  createBalancedOnDevicePolicy,
} from "./OnDevicePolicy";

export type {
  VLJEPAConfig,
  PolicyValidationResult,
  SanitizedEmbedding,
  DataLeakCheck,
  OnDevicePolicyConfig,
} from "./OnDevicePolicy";

// Visual PII Redaction
export {
  VisualPIIRedactor,
  createDefaultRedactionConfig,
} from "./VisualPIIRedaction";

export { RedactionStrategy } from "./VisualPIIRedaction";

export type {
  RedactionRegion,
  RedactionResult,
  VisualPIIRedactionConfig,
  RedactionQuality,
} from "./VisualPIIRedaction";

// Visual Intent Encoder (Integration with existing privacy suite)
export {
  VisualIntentEncoder,
  createDefaultVisualIntentEncoder,
} from "./VisualIntentEncoder";

export type {
  VisualIntentEncoderConfig,
  VisualIntentResult,
  VisualEncodingOptions,
} from "./VisualIntentEncoder";

// ============================================================================
// NEW: Visual Privacy Layer (Round 20)
// ============================================================================

// Visual Privacy Classifier
export {
  VisualPrivacyClassifier,
  SensitivityLevel,
  createConservativeClassifier,
  createBalancedClassifier,
  createPermissiveClassifier,
} from "./VisualPrivacyClassifier";

export type {
  VisualPrivacyClassification,
  PrivacyElement,
  VisualPrivacyClassifierConfig,
} from "./VisualPrivacyClassifier";

// Embedding Redaction Protocol
export {
  EmbeddingRedactionProtocol,
  createConservativeRedaction,
  createBalancedRedaction,
  createPermissiveRedaction,
  calculateTradeoffMetrics,
} from "./EmbeddingRedactionProtocol";

export type {
  RedactionResult,
  RedactionConfig,
  RehydrationResult,
} from "./EmbeddingRedactionProtocol";

// On Device Processing Policy (Enhanced)
export {
  OnDeviceProcessingPolicy,
  PrivacyMode,
  createStrictPolicy,
  createStandardPolicy,
  createPermissivePolicy,
} from "./OnDeviceProcessingPolicy";

export type {
  PrivacyAuditEntry,
  ProcessingPolicyConfig,
  PolicyValidationResult,
} from "./OnDeviceProcessingPolicy";

// Visual Privacy Firewall
export {
  VisualPrivacyFirewall,
  createDefaultFirewall,
  createStrictFirewall,
  createPermissiveFirewall,
} from "./VisualPrivacyFirewall";

export type {
  FirewallAction,
  FirewallRule,
  FirewallRuleCondition,
  FirewallDecision,
  QuarantineEntry,
  FirewallStats,
  VisualPrivacyFirewallConfig,
} from "./VisualPrivacyFirewall";

// Intent Encoder Bridge (Unified Privacy)
export {
  IntentEncoderBridge,
  createStandardBridge,
  createStrictBridge,
  createPermissiveBridge,
} from "./IntentEncoderBridge";

export type {
  UnifiedPrivacyState,
  CoordinatedRedactionResult,
  PrivacyBudgetConfig,
  IntentEncoderBridgeConfig,
} from "./IntentEncoderBridge";
