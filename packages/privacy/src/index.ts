/**
 * @lsi/privacy - Privacy Suite for Aequor Cognitive Orchestration Platform
 *
 * This package provides privacy-preserving components for the Aequor platform,
 * including intent encoding with differential privacy, PII detection, and
 * redaction protocols.
 */

// Intent encoding
export {
  IntentEncoder,
  cosineSimilarity,
  euclideanDistance,
} from "./intention/index.js";

// Privacy classification
export {
  PrivacyClassifier,
  createPrivacyClassifier,
} from "./classifier/index.js";

export type {
  PrivacyClassification as DetailedPrivacyClassification,
  PrivacyClassifierConfig,
  StylePattern,
} from "./privacy/index.js";

// Training pipeline
export { ClassifierTrainer } from "./training/index.js";

export type {
  LabeledQuery,
  TrainingConfig,
  TrainingResult,
  ConfusionMatrix,
  QueryFeatures,
  TrainedModelData,
} from "./training/index.js";

// Redaction
export { SemanticPIIRedactor, RedactionStrategy } from "./redaction/index.js";
export { RedactionAdditionProtocol, DEFAULT_RAP_CONFIG } from "./redaction/RedactionAdditionProtocolImpl.js";
export type { RedactionAdditionProtocolConfig } from "./redaction/RedactionAdditionProtocolImpl.js";

export type {
  PIIInstance,
  RedactedQuery,
  SemanticPIIRedactorConfig,
} from "./redaction/index.js";

// Privacy Firewall
export { PrivacyFirewall } from "./firewall/index.js";

export type {
  FirewallCondition,
  FirewallAction,
  FirewallRule,
  FirewallDecision,
  FirewallContext,
  PrivacyFirewallConfig,
} from "./firewall/index.js";

// Audit Logger
export { AuditLogger } from "./audit/index.js";

export type {
  PrivacyAuditEvent,
  AuditEventType,
  AuditLogFilter,
  DetailedComplianceReport as ComplianceReport,
  AuditLoggerConfig,
} from "./audit/index.js";

// Secure VM for untrusted cartridge execution
export {
  SecureVM,
  WASMSandbox,
  VMManager,
  getVMManager,
  resetVMManager,
  createWASMSandbox,
  DEFAULT_RESOURCE_LIMITS,
  DEFAULT_WASM_CONFIG,
  createVMError,
  canExecute,
  canChangeState,
} from "./vm/index.js";

export type {
  ResourceLimits,
  ResourceUsage,
  ExecutionRequest,
  ExecutionResult,
  VMError,
  VMState,
  VMSnapshot,
  VMMessage,
  VerificationResult,
  WASMConfig,
  SecureVMConfig,
  VMInfo,
  VMManagerStats,
  CreateVMOptions,
  ConsoleOutput,
} from "./vm/index.js";

export { VMErrorCode } from "./vm/SecureVM.js";

// Byzantine Ensemble for fault-tolerant multi-model inference
export {
  ByzantineEnsemble,
  VotingMechanism,
  FaultDetector,
  type EnsembleConfig,
  type EnsembleRequest,
  type EnsembleResponse,
  type ModelAdapter,
  type IndividualResponse,
  type Vote,
  type VotingResult,
  type ReputationScore,
  type VotingMechanismType,
  type FaultDetectionConfig,
  type FaultReport,
  type FaultReason,
  type OutlierMethod,
} from "./ensemble/index.js";

// Privacy-Preserving Machine Learning
export {
  DifferentialPrivacy,
  MomentsAccountant,
  RDPAccountant,
  ZCDPAccountant,
  PrivateGradient,
  DEFAULT_GRADIENT_CONFIG,
  PrivateTrainer,
  DEFAULT_TRAINER_CONFIG,
} from "./ml/index.js";

export type {
  PrivacyBudget,
  PrivacyCost,
  UtilityLoss,
  Recommendation as MLRecommendation,
  DifferentialPrivacyConfig,
  PrivateGradientConfig,
  ClippingStats,
  GradientResult,
  TrainingData,
  ValidationData,
  Model,
  TrainingResult as MLTrainingResult,
  BatchResult,
  TrainingMetrics,
  BudgetAllocation,
  PrivacyReport as MLPrivacyReport,
  PrivacyRisk,
  NoiseMultiplierResult,
  ClippingNormResult,
  BatchSizeResult,
  PrivacyUtilityCurve,
  OptimizationResult,
  UtilityMetrics,
  PrivateTrainerConfig,
} from "./ml/index.js";

// Anomaly Detection and Security Event Correlation
export {
  PrivacyAnomalyDetector,
  BehaviorProfiler,
  SecurityEventCorrelator,
} from "./anomaly/index.js";

export type {
  AccessEvent as AnomalyAccessEvent,
  PrivacyAnomaly,
  AnomalyType,
  AnomalySeverity,
  Evidence as AnomalyEvidence,
  PatternAnomaly,
  TemporalAnomaly,
  VolumeAnomaly,
  BehaviorBaseline,
  AnomalyScore as PrivacyAnomalyScore,
  PrivacyAlert,
  Recommendation as AnomalyRecommendation,
  AlertGroup,
  AnomalyDetectorConfig,
  AccessPattern,
  TemporalPattern,
  VolumePattern,
  BaselineMetrics,
  SequenceScore,
  BehaviorProfile,
  ProfileCluster,
  ProfileType,
  ProfilerConfig,
  SecurityEvent,
  SecurityEventType,
  CorrelationResult,
  EventGroup,
  AttackPattern,
  AttackPatternType,
  LateralMovementPattern,
  ExfiltrationPattern,
  IncidentTimeline,
  TimelineEvent,
  Milestone,
  SecurityIncident,
  IncidentClassification,
  IncidentSeverity,
  IncidentStatus,
  ResponseRecommendation,
  IncidentNote,
  IncidentReport,
  Finding,
  ImpactAssessment,
  IncidentResolution,
} from "./anomaly/index.js";

// Partially Homomorphic Encryption (PHE) for embedding privacy
export {
  PHE,
  PHEIntentEncoder,
  PHEKeyManager,
  InMemoryKeyStorage,
  PHEOperations,
  PHEUtils,
  PHEPerformanceProfiler,
  encryptedEuclideanDistance,
  encryptedCosineSimilarity,
  serializePublicKey,
  deserializePublicKey,
  serializePrivateKey,
  deserializePrivateKey,
  serializeEncryptedEmbedding,
  deserializeEncryptedEmbedding,
  DEFAULT_KEY_SIZE,
  DEFAULT_PRECISION,
  MAX_SAFE_VALUE,
} from "./phe/index";

export type {
  PaillierPublicKey,
  PaillierPrivateKey,
  PaillierKeyPair,
  EncryptedEmbedding,
  PHEConfig,
  PHEStats,
  PHEIntentEncoderConfig,
  EncryptedIntentVector,
  PHEEncodeResult,
  KeySize,
  KeyFormat,
  KeyMetadata,
  KeyRecord,
  KeyRotationConfig,
  PHEKeyManagerConfig,
  KeyStorageBackend,
  KeyExportResult,
  KeyImportResult,
  KeyManagerStats,
  OperationResult,
  AggregationResult,
  StatisticsResult,
  ComparisonResult,
  ValidationResult,
  KeyComparisonResult,
  PerformanceMetrics,
  SecurityCheckResult,
} from "./phe/index";

// Zero Knowledge Proofs for verifiable computation without revealing data
export {
  ZKPSystem,
  ProofGenerator,
  ProofVerifier,
  RouterProofGenerator,
  RouterProofVerifier,
  RangeProof,
  SetMembershipProof,
  generateRoutingProof,
  verifyRoutingProof,
  createRoutingProof,
  generateRangeProof,
  verifyRangeProof,
  proveAgeRange,
  proveScoreRange,
  generateSetMembershipProof,
  verifySetMembershipProof,
  proveEmailOnAllowlist,
  proveCredentialValid,
  proveUserInGroup,
  hashToField,
  computeCommitment,
  verifyCommitment,
  generateChallenge,
  serializeProof,
  deserializeProof,
  generateProofId,
  validateProofFormat,
  checkProofFreshness,
  DEFAULT_ZKP_CONFIG,
} from "./zkp/index.js";

export type {
  // Core ZKP types
  ZKPConfig,
  ZKPProof,
  ZKPStatement,
  ZKPWitness,
  ZKPVerificationResult,
  ZKPProofType,
  ZKPSecurityLevel,
  // Proof generator/verifier types
  ProofGeneratorConfig,
  ProofVerifierConfig,
  // Routing proof types
  RoutingProofClaim,
  RoutingProofPublicInputs,
  RoutingProofPrivateInputs,
  // Range proof types
  RangeProofClaim,
  RangeProofPublicInputs,
  RangeProofPrivateInputs,
  // Set membership proof types
  SetMembershipClaim,
  SetMembershipPublicInputs,
  SetMembershipPrivateInputs,
  // Common types
  ProofChallenge,
  ProofResponse,
  Commitment,
  Opening,
  HashFunction,
  HashOutput,
  HashInput,
  ArithmeticCircuit,
  CircuitConstraint,
  WireAssignment,
  // Error types
  ZKPError,
  ZKPVerificationError,
  ZKPGenerationError,
  ZKPMetadata,
} from "./zkp/index.js";

// Re-export key types from protocol
export type {
  IntentVector,
  IntentEncoderConfig,
  PrivacyClassification,
  PIIType,
  RedactionResult,
  RedactionContext,
} from "@lsi/protocol";

// Re-export enums from protocol - includes aliases for compatibility
export {
  PrivacyLevel,
  PrivacyLevel as SensitivityLevel,
  PrivacyCategory,
  PrivacyCategory as PrivacyIntent,
} from "@lsi/protocol";
