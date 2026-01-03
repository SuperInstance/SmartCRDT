/**
 * @lsi/protocol - Core protocol types for Aequor Cognitive Orchestration Platform
 *
 * This package defines all shared interfaces and types used across the Aequor ecosystem.
 * All other packages depend on this for type definitions.
 */

// ============================================================================
// COMMON BASE TYPES
// ============================================================================

/**
 * Common base types for all packages
 *
 * Provides foundational abstractions for:
 * - Configuration objects (BaseConfig, RouterConfig, PrivacyConfig, etc.)
 * - Result patterns (BaseResult, ValidationResult, ExecutionResult, etc.)
 * - Request/Response patterns (BaseRequest, BaseResponse, Adapter)
 * - State management (SystemState, AgentState, CacheState)
 * - Event handling (BaseEvent, ErrorEvent, SystemEvent)
 * - Status tracking (StatusInfo, HealthStatus, HealthCheckResult)
 * - Utility types (BrandedId, DeepPartial, etc.)
 */
import type { BaseResult } from "./common.js";

export * from "./common.js";

// ============================================================================
// ERROR CLASSES (Runtime Error Handling)
// ============================================================================

export {
  LSIError,
  LSIRoutingError,
  LSISecurityError,
  LSIConfigurationError,
  LSIExecutionError,
  LSIValidationError,
  LSITimeoutError,
} from "./errors.js";

// ============================================================================
// PROTOCOL CONSTANTS
// ============================================================================

export {
  PROTOCOL_VERSION,
  TYPE_COUNT,
  PROTOCOL_METADATA,
  DEFAULT_CONSTRAINTS,
  EMBEDDING_DIMENSIONS,
} from "./constants.js";

// ============================================================================
// CROSS-PACKAGE EXPORTS
// ============================================================================

export type {
  BaseResult,
  RouterConfig,
  CacheConfig,
  SystemState,
  SystemState as BaseSystemState,
  HealthCheckResult,
  OllamaHealthCheckResult,
  OllamaHealthCheckConfig,
} from "./common.js";

// ============================================================================
// INTEGRATION TYPES (Cross-Package Communication)
// ============================================================================

/**
 * Integration types for cross-package communication
 *
 * Provides protocol interfaces for:
 * - Training (ORPO, LoRA adapters, metrics, events)
 * - Shadow logging (privacy levels, log entries, preference pairs)
 * - SuperInstance (ContextPlane, IntentionPlane, LucidDreamer)
 */
export {
  // Training types
  TrainingStatus,
  LoRAConfig,
  ORPOTrainingConfig,
  TrainingCheckpoint,
  TrainingMetrics,
  TrainingEvent,
  TrainingProgressCallback,
  TrainingEventCallback,
  // Shadow logging types
  PrivacyLevel as IntegrationPrivacyLevel,
  PIIType as IntegrationPIIType,
  PrivacyClassification as IntegrationPrivacyClassification,
  PIIDetection,
  ShadowLogEntry,
  QueryMetadata,
  ResponseMetadata,
  PreferencePair,
  // SuperInstance interfaces
  IContextPlane,
  IIntentionPlane,
  ILucidDreamer,
  ISuperInstanceConfig,
  ISuperInstance,
} from "./integration.js";

// ============================================================================
// LEGACY TYPES (Deprecated - use common.ts types instead)
// ============================================================================

/**
 * @deprecated Use RoutingDecision from common.ts instead
 */
export interface RoutingDecision {
  /** Which backend to use */
  backend: "local" | "cloud" | "hybrid";
  /** Model identifier to use */
  model: string;
  /** Confidence in this decision (0-1) */
  confidence: number;
  /** Reason for this routing decision */
  reason: string;
  /** Routing principles that were applied */
  appliedPrinciples: string[];
  /** Whether to cache the response */
  cacheResponse?: boolean;
}

/**
 * @deprecated Use ExecutionResult from common.ts instead
 */
export interface ExecutionResult {
  /** Generated content/response */
  content: string;
  /** Which backend was used */
  backend: "local" | "cloud" | "hybrid";
  /** Model that generated the response */
  model: string;
  /** Number of tokens used (if available) */
  tokensUsed?: number;
  /** Latency in milliseconds */
  latency: number;
  /** Whether result was from cache */
  fromCache?: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Process result from OllamaAdapter
 */
export interface ProcessResult {
  /** Generated content */
  content: string;
  /** Which backend was used */
  backend: string;
  /** Model used */
  model: string;
  /** Tokens used */
  tokensUsed: number;
  /** Latency in milliseconds */
  latency: number;
  /** Additional metadata */
  metadata: {
    model: string;
    tokensUsed: number;
    latency: number;
    backend: string;
    [key: string]: unknown; // Allow additional properties
  };
}

/**
 * Simple health check result for adapters
 *
 * Legacy interface used by OllamaAdapter and OpenAIAdapter.
 * For comprehensive health checking, use OllamaHealthCheckResult instead.
 */
export interface AdapterHealthCheckResult {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Available models */
  models: string[];
  /** Current model */
  currentModel?: string;
  /** Error message if unhealthy */
  error?: string;
  /** Additional status info */
  status?: string;
}

/**
 * Cost-aware routing result
 */
export interface CostAwareRoutingResult extends BaseResult<{
  /** Backend to use */
  backend: "local" | "cloud";
  /** Specific model to use */
  model: string;
  /** Estimated cost for this request */
  estimatedCost: number;
  /** Reasoning for this routing decision */
  reason: string;
  /** Additional notes about this decision (for logging/debugging) */
  notes?: string[];
}> {
  /** Confidence in routing decision (0-1) */
  confidence: number;
  /** Estimated latency (ms) */
  estimatedLatency: number;
  /** Whether budget check passed */
  withinBudget: boolean;
}

/**
 * @deprecated Use NetworkConfig from common.ts instead
 */
export interface OllamaAdapterConfig {
  /** Base URL for Ollama API */
  baseURL: string;
  /** Default model to use */
  defaultModel: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Whether to enable streaming */
  stream?: boolean;
}

/**
 * Ollama API request/response types
 */
export interface OllamaGenerateRequest {
  /** Model name */
  model: string;
  /** Prompt to generate from */
  prompt: string;
  /** Whether to stream responses */
  stream?: boolean;
  /** Temperature for sampling */
  options?: {
    temperature?: number;
    num_predict?: number;
    top_k?: number;
    top_p?: number;
  };
}

export interface OllamaGenerateResponse {
  /** Generated response */
  response: string;
  /** Whether generation is complete */
  done: boolean;
  /** Model used */
  model: string;
  /** Timing information */
  total_duration?: number;
  /** Load duration */
  load_duration?: number;
  /** Prompt eval count */
  prompt_eval_count?: number;
  /** Prompt eval duration */
  prompt_eval_duration?: number;
  /** Eval count */
  eval_count?: number;
  /** Eval duration */
  eval_duration?: number;
}

export interface OllamaModel {
  /** Model name */
  name: string;
  /** Modified timestamp */
  modified_at?: string;
  /** Model size */
  size?: number;
  /** Digest */
  digest?: string;
  /** Model details */
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaTagsResponse {
  /** List of models */
  models: OllamaModel[];
}

/**
 * @deprecated Use NetworkConfig from common.ts instead
 */
export interface OpenAIAdapterConfig {
  /** API key for OpenAI */
  apiKey: string;
  /** Organization ID (optional) */
  organization?: string;
  /** Default model to use */
  defaultModel: string;
  /** Base URL for API */
  baseURL?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Whether to enable streaming */
  stream?: boolean;
}

/**
 * OpenAI API request/response types
 */
export interface OpenAIMessage {
  /** Role of the message sender */
  role: "system" | "user" | "assistant";
  /** Content of the message */
  content: string;
}

export interface OpenAIChatRequest {
  /** Model to use */
  model: string;
  /** Messages array */
  messages: OpenAIMessage[];
  /** Temperature for sampling (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Nucleus sampling parameter */
  top_p?: number;
  /** Whether to stream responses */
  stream?: boolean;
}

export interface OpenAIChatChoice {
  /** Index of the choice */
  index: number;
  /** Message generated */
  message: {
    role: string;
    content: string;
  };
  /** Reason the generation finished */
  finish_reason: string;
}

export interface OpenAIUsage {
  /** Prompt tokens used */
  prompt_tokens: number;
  /** Completion tokens used */
  completion_tokens: number;
  /** Total tokens used */
  total_tokens: number;
}

export interface OpenAIChatResponse {
  /** Unique identifier */
  id: string;
  /** Object type */
  object: string;
  /** Timestamp created */
  created: number;
  /** Model used */
  model: string;
  /** Choices array */
  choices: OpenAIChatChoice[];
  /** Token usage */
  usage: OpenAIUsage;
}

export interface OpenAIModel {
  /** Model ID */
  id: string;
  /** Object type */
  object: string;
  /** Model owner */
  owned_by: string;
}

export interface OpenAIModelsResponse {
  /** Object type */
  object: string;
  /** List of models */
  data: OpenAIModel[];
}

/**
 * OpenAI error response structure
 */
export interface OpenAIErrorResponse {
  /** Error details */
  error: {
    /** Error message */
    message: string;
    /** Error type */
    type: string;
    /** Error parameter (optional) */
    param?: string;
    /** Error code (optional) */
    code?: string;
  };
}

// ============================================================================
// CLAUDE ADAPTER TYPES (Anthropic Claude API)
// ============================================================================

/**
 * Configuration for Claude adapter
 */
export interface ClaudeAdapterConfig {
  /** API key for Anthropic */
  apiKey: string;
  /** Default model to use */
  defaultModel: string;
  /** Base URL for API (optional, for custom endpoints) */
  baseURL?: string;
  /** Anthropic API version */
  version?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Whether to enable streaming */
  stream?: boolean;
}

/**
 * Claude API request types
 */
export interface ClaudeMessage {
  /** Role of the message sender */
  role: "user" | "assistant";
  /** Content of the message */
  content: string;
}

export interface ClaudeChatRequest {
  /** Model to use */
  model: string;
  /** Messages array */
  messages: ClaudeMessage[];
  /** Maximum tokens to generate */
  max_tokens: number;
  /** Temperature for sampling (0-1) */
  temperature?: number;
  /** Top-k sampling parameter */
  top_k?: number;
  /** Top-p sampling parameter */
  top_p?: number;
  /** Whether to stream responses */
  stream?: boolean;
  /** System prompt (optional) */
  system?: string;
}

export interface ClaudeChatResponse {
  /** Unique identifier */
  id: string;
  /** Object type */
  type: string;
  /** Message generated */
  content: Array<{
    type: string;
    text: string;
  }>;
  /** Model used */
  model: string;
  /** Reason the generation finished */
  stop_reason: string;
  /** Token usage */
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeErrorResponse {
  /** Error details */
  error: {
    /** Error type */
    type: string;
    /** Error message */
    message: string;
  };
}

// ============================================================================
// GEMINI ADAPTER TYPES (Google Gemini API)
// ============================================================================

/**
 * Configuration for Gemini adapter
 */
export interface GeminiAdapterConfig {
  /** API key for Google AI */
  apiKey: string;
  /** Default model to use */
  defaultModel: string;
  /** Base URL for API (optional, for custom endpoints) */
  baseURL?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Whether to enable streaming */
  stream?: boolean;
}

/**
 * Gemini API request types
 */
export interface GeminiContent {
  /** Parts of the content */
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
  /** Role of the content creator */
  role?: "user" | "model";
}

export interface GeminiChatRequest {
  /** Model to use */
  model: string;
  /** Contents array */
  contents: GeminiContent[];
  /** Generation configuration */
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
  };
  /** Safety settings (optional) */
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

export interface GeminiChatResponse {
  /** List of candidates */
  candidates: Array<{
    content: GeminiContent;
    finishReason: string;
    index: number;
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  /** Usage metadata */
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  /** Model version used */
  modelVersion: string;
}

export interface GeminiErrorResponse {
  /** Error details */
  error: {
    /** Error code */
    code: number;
    /** Error message */
    message: string;
    /** Error status */
    status: string;
  };
}

// ============================================================================
// COHERE ADAPTER TYPES (Cohere API)
// ============================================================================

/**
 * Configuration for Cohere adapter
 */
export interface CohereAdapterConfig {
  /** API key for Cohere */
  apiKey: string;
  /** Default model to use */
  defaultModel: string;
  /** Base URL for API (optional, for custom endpoints) */
  baseURL?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Whether to enable streaming */
  stream?: boolean;
}

/**
 * Cohere API request types
 */
export interface CohereMessage {
  /** Role of the message sender */
  role: "USER" | "CHATBOT" | "SYSTEM";
  /** Content of the message */
  message: string;
}

export interface CohereChatRequest {
  /** Model to use */
  model: string;
  /** Message to send */
  message: string;
  /** Chat history (optional) */
  chat_history?: CohereMessage[];
  /** Temperature for sampling (0-5) */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Top-p sampling parameter */
  p?: number;
  /** Top-k sampling parameter */
  k?: number;
  /** Whether to stream responses */
  stream?: boolean;
}

export interface CohereChatResponse {
  /** Unique identifier */
  generationId: string;
  /** Response text */
  text: string;
  /** Chat history */
  chatHistory: CohereMessage[];
  /** Finish reason */
  finishReason: string;
  /** Token usage */
  tokenCount: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    billingTokens: number;
  };
}

export interface CohereErrorResponse {
  /** Error details */
  message: string;
  /** Error code */
  code?: number;
  /** Additional details */
  details?: Record<string, unknown>;
}

// ============================================================================
// ATP/ACP Protocol Types (Autonomous Task Processing & Assisted Collaborative Processing)
// ============================================================================

export {
  IntentCategory,
  Urgency,
  CollaborationMode,
  ATPacket,
  ACPHandshake as ACPHandshakeLegacy,
  AequorResponse,
  ProtocolErrorType,
  ProtocolError,
  // Privacy and Intent Encoding Types
  IntentVector,
  IntentEncoderConfig,
  IntentEncoder,
  PrivacyLevel,
  PrivacyClassification,
  PrivacyCategory,
  PIIType,
  PrivacyClassifier,
  RedactionAdditionProtocol,
  RedactionResult,
  RedactionContext,
  // Audit and Compliance Types
  PrivacyAuditEvent,
  FirewallDecision,
  AuditEventType,
  // ZKP Types
  ZKPSecurityLevel,
  ProofGeneratorConfig,
  ProofVerifierConfig,
  ZKPProof,
  ZKPVerificationResult,
  // Configuration Types
  IntentionPlaneConfig,
  // Libcognitive API Types
  type ATPResponse,
  type ACPResponse,
  type Meaning,
  type Context,
  type Thought,
  type Action,
  type QueryConstraints,
  type ContextItem,
  type SimilarQuery,
  type PrivacyConstraint,
  type BudgetConstraint,
  type PerformanceConstraint,
  type ThermalConstraint,
  type QualityConstraint,
  type ConstraintValue,
} from "./atp-acp.js";

// ============================================================================
// CONSTRAINT ALGEBRA (Multi-Objective Routing Optimization)
// ============================================================================

export {
  ConstraintType,
  OptimizationStrategy,
  type Constraint,
  type ConstraintSet,
  type RouteOption,
  type OptimizationResult,
  ConstraintSolver,
  createDefaultConstraints,
  parseConstraint,
  validateConstraint,
} from "./constraints.js";

// ============================================================================
// ATP PACKET FORMAT (Wire Format for Autonomous Task Processing)
// ============================================================================

export {
  ATP_MAGIC,
  PacketFlags,
  type ATPPacketHeader,
  type ATPPacketFooter,
  type ATPacketWire,
  ATPPacketCodec,
  ATPPacketStream,
} from "./packet.js";

// ============================================================================
// ACP HANDSHAKE PROTOCOL (Multi-Model Collaboration)
// ============================================================================

export {
  ACPHandshake,
  AggregationStrategy,
  createHandshakeRequest,
  type ACPHandshakeRequest,
  type ACPHandshakeResponse,
  type ExecutionPlan,
  type ExecutionStep,
} from "./handshake.js";

// ============================================================================
// PROTOCOL VALIDATION SYSTEM
// ============================================================================

export {
  ProtocolValidator,
  ProtocolValidationErrorCode,
  createValidationResult,
  formatValidationErrors,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationOptions,
} from "./validation.js";

// ============================================================================
// CARTRIDGE PROTOCOL (Knowledge Cartridge Management)
// ============================================================================

export {
  CartridgeState,
  type CartridgeManifest,
  type CartridgeCapabilities,
  type CartridgeFileEntry,
  type CartridgeNegotiation,
  type CartridgeVersion,
  type CompatibilityResult as CartridgeCompatibilityResult,
  type CartridgeLifecycle,
  type DependencyNode as CartridgeDependencyNode,
  type CartridgeRegistryEntry,
  type CartridgeLoadOptions,
  type CartridgeLoadProgress,
  type DependencyResolutionResult,
  type VersionConstraint as CartridgeVersionConstraint,
  type CartridgeStats,
  type QueryType,
} from "./cartridge.js";

/**
 * JSON Schema for cartridge manifest validation
 *
 * This schema validates the structure and content of cartridge manifests.
 * Use with @lsi/swarm's ManifestLoader or any JSON Schema validator.
 *
 * @example
 * import { CARTRIDGE_MANIFEST_SCHEMA } from '@lsi/protocol';
 * const Ajv = require('ajv');
 * const ajv = new Ajv();
 * const validate = ajv.compile(CARTRIDGE_MANIFEST_SCHEMA);
 */
export { CARTRIDGE_MANIFEST_SCHEMA } from "./cartridge-manifest.js";

// ============================================================================
// VERSION NEGOTIATION PROTOCOL (Cartridge Version Management)
// ============================================================================

export {
  type VersionRange,
  type ClientCapabilities,
  type VersionNegotiationRequest,
  type SelectionReason,
  type BreakingChange,
  type BreakingChange as NegotiationBreakingChange,
  type MigrationStep,
  type MigrationStep as NegotiationMigrationStep,
  type MigrationPath,
  type MigrationPath as NegotiationMigrationPath,
  type VersionNegotiationResponse,
  type NegotiationCartridgeVersion,
  type VersionSelection,
  type NegotiationCompatibilityResult,
  type NegotiationOptions,
  type NegotiationResult,
  type UpgradeOptions,
  type UpgradeResult,
  type SemVer,
  type SemVer as NegotiationSemVer,
  type NegotiationVersionConstraint,
} from "./version-negotiation.js";

// ============================================================================
// ROLLBACK PROTOCOL (Distributed Rollback Operations)
// ============================================================================

export {
  type RollbackReason,
  type RollbackScope,
  type RollbackStrategy,
  type RollbackStatus,
  type NotificationChannelType,
  type HealthStatus,
  type VoteDecision,
  type ConsensusAlgorithm,
  type ProposalType,
  type RollbackRequest,
  type RollbackOptions,
  type NotificationChannel,
  type RollbackResponse,
  type VerificationResult,
  type VerificationMetrics,
  type RollbackError,
  type ConsensusConfig,
  type ConsensusProposal,
  type Vote,
  type ConsensusResult,
  type AutoRollbackConfig,
  type RollbackConfig,
  type RollbackStep,
  type MetricsSnapshot,
  type MetricsComparison,
  type RollbackReport,
  type RollbackFilters,
  type RollbackHistoryEntry,
  type Node,
  type NodeResult,
  type EmergencyTrigger,
  type EmergencyRollbackConfig,
} from "./rollback.js";

// ============================================================================
// HYPOTHESIS PROTOCOL (Distributed Hypothesis Testing & Validation)
// ============================================================================

export {
  type HypothesisPacket,
  type HypothesisType,
  type ExpectedImpact,
  type Actionability,
  type EvidencePacket,
  type EvidenceType,
  type HypothesisScope,
  type WorkloadType,
  type TestingConfig,
  type HypothesisResult,
  type MetricsSnapshot as HypothesisMetricsSnapshot,
  type HypothesisDistribution,
  type AggregatedResult,
  type ValidationMetrics,
  type NodeCapabilities,
  type HypothesisDistributionRequest,
  type HypothesisDistributionResponse,
} from "./hypothesis.js";

// ============================================================================
// PROTOCOL EXTENSIONS FRAMEWORK (Custom Protocol Extensibility)
// ============================================================================

export {
  // Core Extension Interface
  type ProtocolExtension,
  type ProtocolExtensionMetadata,
  type ExtensionCapability,
  type ExtensionCapabilityType,
  type ExtensionContext,
  type ExtensionRequest,
  type ExtensionResponse,
  type ExtensionError,
  type ResponseMetadata as ExtensionResponseMetadata,
  type Logger,
  type Config,
  type ServiceRegistry,
  // Use different names to avoid conflicts with existing exports
  type ValidationResult as ExtensionValidationResult,
  type ValidationError as ExtensionValidationError,
  type ValidationWarning as ExtensionValidationWarning,
  type CompatibilityResult as ExtensionCompatibilityResult,
  type CompatibilityIssue as ExtensionCompatibilityIssue,
  type SemVer as ExtensionSemVer,
  type ExtensionLoadOptions,
  // Extension Registry
  ExtensionRegistry,
  // Extension Loader
  ExtensionLoader,
  // Extension Validator
  ExtensionValidator,
  // Helper Functions
  createSemVer,
  formatSemVer as formatSemVerExtension,
  createExtensionContext,
  createValidationResult as createExtensionValidationResult,
} from "./extensions.js";

// ============================================================================
// PROTOCOL COMPLIANCE TESTING SUITE (Automated Compliance Checking)
// ============================================================================

export {
  // SemVer utilities
  parseSemVer as parseSemVerCompliance,
  formatSemVer as formatSemVerCompliance,
  compareSemVer as compareSemVerCompliance,
  // Type specifications
  type SemVer as ComplianceSemVer,
  type TypeSpecification,
  type TypeDefinition,
  type InterfaceDefinition,
  type TypeAliasDefinition,
  type EnumDefinition,
  type ClassDefinition,
  type PropertyDefinition,
  type MethodDefinition,
  type ParameterDefinition,
  type ValidationRule,
  // Message specifications
  type MessageSpecification,
  type FlowControlSpecification,
  type RetryPolicy,
  type ComplianceRateLimit,
  type ErrorHandlingSpecification,
  // Behavior specifications
  type BehaviorSpecification,
  type Condition,
  type Invariant,
  type ExecutionContext,
  // Constraint specifications
  type ConstraintSpecification,
  type ConstraintRule,
  // Protocol specification
  type ProtocolSpecification,
  // Compliance results
  type ComplianceViolation,
  type ComplianceWarning,
  type ComplianceResult,
  type Recommendation,
  type ComplianceReport,
  // Compliance checker
  ProtocolComplianceChecker,
  // Compliance test runner
  type ComplianceTestCase,
  type TestCaseResult,
  type ComplianceTestResult,
  ComplianceTestRunner,
  // Test case builders
  buildTypeTest,
  buildMessageTest,
  buildBehaviorTest,
  buildConstraintTest,
} from "./compliance.js";

// ============================================================================
// PROTOCOL SCHEMAS (Validation Schemas for ATP, ACP, Cartridge, Rollback)
// ============================================================================

export {
  // ATP Schema
  ATP_PACKET_FIELDS,
  ATP_HEADER_SCHEMA,
  ATP_FOOTER_SCHEMA,
  ATP_RESPONSE_SCHEMA,
  ATP_FLOW_CONTROL,
  ATP_ERROR_HANDLING,
  validateATPacket,
  validateATPResponse,
  ATP_SCHEMA,
} from "./schemas/atp-schema.js";

export {
  // ACP Schema
  ACP_HANDSHAKE_REQUEST_FIELDS,
  ACP_HANDSHAKE_RESPONSE_FIELDS,
  EXECUTION_PLAN_FIELDS,
  EXECUTION_STEP_FIELDS,
  COLLABORATION_MODES,
  AGGREGATION_STRATEGIES,
  validateACPHandshake,
  validateACPHandshakeResponse,
  ACP_SCHEMA,
} from "./schemas/acp-schema.js";

export {
  // Cartridge Schema
  CARTRIDGE_MANIFEST_FIELDS,
  CARTRIDGE_CAPABILITIES_FIELDS,
  CARTRIDGE_FILE_ENTRY_FIELDS,
  validateCartridgeManifest,
  CARTRIDGE_SCHEMA,
} from "./schemas/cartridge-schema.js";

export {
  // Rollback Schema
  ROLLBACK_REQUEST_FIELDS,
  ROLLBACK_OPTIONS_FIELDS,
  ROLLBACK_RESPONSE_FIELDS,
  CONSENSUS_CONFIG_FIELDS,
  CONSENSUS_PROPOSAL_FIELDS,
  VOTE_FIELDS,
  CONSENSUS_RESULT_FIELDS,
  VERIFICATION_RESULT_FIELDS,
  VERIFICATION_METRICS_FIELDS,
  NOTIFICATION_CHANNEL_FIELDS,
  ROLLBACK_REASON_TYPES,
  ROLLBACK_SCOPE_TYPES,
  ROLLBACK_STRATEGY_TYPES,
  ROLLBACK_STATUS_TYPES,
  CONSENSUS_ALGORITHMS,
  NOTIFICATION_CHANNEL_TYPES,
  validateRollbackRequest,
  validateConsensusProposal,
  validateVote,
  ROLLBACK_SCHEMA,
} from "./schemas/rollback-schema.js";

// ============================================================================
// PROTOCOL FINALIZATION (Registry, Validation, Stability)
// ============================================================================

export {
  // Protocol Registry
  ProtocolRegistry,
  globalProtocolRegistry,
  // SemVer utilities
  parseSemVer as parseSemVerRegistry,
  formatSemVer as formatSemVerRegistry,
  compareSemVer as compareSemVerRegistry,
  isVersionCompatible,
  satisfiesConstraint,
  DependencyGraph,
  // Protocol info types
  type ProtocolInfo,
  type SemVer as RegistrySemVer,
  type StabilityLevel,
  type ProtocolDependency,
  type VersionConstraint,
  type DeprecationInfo,
  type BreakingChange as RegistryBreakingChange,
  type CompatibilityMatrix,
  type CompatibilityLevel,
  type CompatibilityResult,
  type CompatibilityIssue,
  type VersionCompatibilityResult,
  type MigrationPath as RegistryMigrationPath,
  type MigrationStep as RegistryMigrationStep,
} from "./registry.js";

export {
  // Finalization Validator
  ProtocolValidator as ProtocolFinalizationValidator,
  ValidationErrorCode as FinalizationValidationErrorCode,
  // Validation result types
  type ValidationResult as FinalizationValidationResult,
  type ValidationError as FinalizationValidationError,
  type AggregateValidationResult,
  type VersionHandshake,
  // Convenience functions
  createValidationResult as createFinalizationValidationResult,
  createValidationFailure,
  formatValidationErrors as formatFinalizationValidationErrors,
} from "./finalization-validation.js";

// ============================================================================
// PARTIALLY HOMOMORPHIC ENCRYPTION (PHE) PROTOCOL TYPES
// ============================================================================

export {
  // Core PHE Types
  EncryptedEmbedding,
  PaillierPublicKey,
  PaillierPrivateKey,
  PaillierKeyPair,
  // PHE Configuration and Results
  PHEEncryptionConfig,
  PHEEncryptionResult,
  PHEDecryptionResult,
  PHEOperationResult,
  PHEOperationType,
  // PHE Capabilities and Security
  PHECapabilities,
  PHESecurityMetadata,
} from "./phe.js";

// ============================================================================
// DIFFERENTIAL PRIVACY TYPES (ε-DP, Composition, Utility Analysis)
// ============================================================================

export {
  // Noise Mechanism Types
  NoiseMechanismType,
  DPMechanism,
  // Privacy Budget Tracking
  PrivacyBudget,
  PrivacyCost,
  // Composition Theorems
  CompositionType,
  CompositionResult,
  // Advanced Accounting
  MomentsAccountantState,
  RDPState,
  ZCDPState,
  // Utility Analysis
  UtilityLoss,
  // Privacy Guarantees
  PrivacyGuarantee,
  // Configuration and Accounting
  DifferentialPrivacyConfig,
  PrivacyAccounting,
  // Interfaces
  INoiseMechanism,
  IPrivacyBudgetTracker,
  // Enhanced Intent Encoder Types
  IntentEncoderConfigDP,
  IntentVectorDP,
  IntentEncoderDP,
} from "./differential-privacy.js";

// ============================================================================
// A2UI PROTOCOL (Agent-to-User Interface Generation)
// ============================================================================

export {
  // Core A2UI Types
  type A2UIResponse,
  type A2UIComponent,
  type A2UILayout,
  type A2UIAction,
  type A2UIUpdate,
  type A2UISSEEvent,
  type ComponentCatalogEntry,
  type ComponentCatalog,
  type ComponentPropSchema,
  type SecurityPolicy,
  type ValidationResult as A2UIValidationResult,
  type ValidationError as A2UIValidationError,
  type ValidationWarning as A2UIValidationWarning,
  type UIRequirements,
  type UIFeedback,
  type A2UIContext,
  type A2UIAgentConfig,
  // Component Types
  type A2UISurface,
  type A2UIComponentType,
  type A2UILayoutType,
  type A2UIAlignment,
  type A2UIActionType,
  type A2UIUpdateType,
  type ComponentEventHandler,
  type ComponentStyle,
  type A2UIAccessibility,
  // Additional Types
  type ResponsiveBreakpoints,
  type ActionRequirement,
  type StyleRequirement,
  type AccessibilityRequirement,
  type FeedbackData,
  type ComponentCorrection,
  type UserPreference,
  type IssueReport,
  type DeviceCapabilities,
  type AppContext,
  // Validation Functions
  validateA2UIResponse,
  validateA2UIComponent,
  validateA2UILayout,
  sanitizeA2UIProps,
  createDefaultSecurityPolicy,
  createCatalogEntry,
  isValidComponentType,
  getComponentSchema,
  formatValidationErrors as formatA2UIValidationErrors,
} from "./a2ui.js";

// ============================================================================
// VL-JEPA PROTOCOL (Vision-Language Joint Embedding Predictive Architecture)
// ============================================================================

// Export VL-JEPA types from @lsi/vljepa package
// Note: Full VL-JEPA protocol is in @lsi/vljepa package
// These are minimal integration types for @lsi/protocol

export {
  // Core VL-JEPA Types
  type VLJEPABridgeConfig,
  type VLJEPABridge,
  type VisionEmbedding,
  type LanguageEmbedding,
  type VLJEPAPrediction,
  type VLJEPAAction,
  type StateDelta,
  type UIFrame,
  // Integration Types
  type VLJEPACoAgentsIntegration,
  type VLJEPAA2UIIntegration,
  // Training Types
  type VLJEPATrainingConfig,
  type UIJEPATrainingData,
  type VLJEPABenchmark,
} from "./vljepa.js";

/**
 * VL-JEPA Integration Note
 *
 * The full VL-JEPA protocol with 768-dim embeddings, X-Encoder,
 * Y-Encoder, and Predictor is available in the @lsi/vljepa package.
 *
 * @see @lsi/vljepa
 * @see https://arxiv.org/abs/2512.10942
 */

// ============================================================================
// FALLBACK STRATEGY TYPES (Intelligent Fallback Logic)
// ============================================================================

export {
  // Fallback Trigger Types
  type FallbackTrigger,
  type FallbackHTTPStatus,
  type FallbackErrorClassification,
  // Fallback Strategy Types
  type FallbackStrategyType,
  type FallbackStrategyConfig,
  type ImmediateFallbackStrategy,
  type DelayedFallbackStrategy,
  type ConditionalFallbackStrategy,
  type CircuitBreakerFallbackStrategy,
  type AdaptiveFallbackStrategy,
  type FallbackStrategy,
  type FallbackCondition,
  // Fallback Result Types
  type FallbackResult,
  type FallbackDecision,
  // Fallback Manager Types
  type FallbackManagerConfig,
  type FallbackMetrics,
  type FallbackState,
  // Routing with Fallback Types
  type RouteDecisionWithFallback,
  // Helper Types
  type HTTPError,
  type TimeoutError,
  type RateLimitError,
  // Type Guards and Helper Functions
  isHTTPError,
  isTimeoutError,
  isRateLimitError,
  classifyError,
  createDefaultFallbackStrategy,
  createImmediateFallbackStrategy,
  createDelayedFallbackStrategy,
  createCircuitBreakerFallbackStrategy,
  createAdaptiveFallbackStrategy,
} from "./fallback.js";

// ============================================================================
// MODEL CAPABILITY DISCOVERY (Automatic Model Fingerprinting)
// ============================================================================

export {
  // Core Capability Types
  type ModelCapability,
  type CapabilityDiscoveryResult,
  type BenchmarkResult,
  type LatencyMeasurement,
  type CapabilityCacheEntry,
  type CapabilityCacheConfig,
  type CapabilityDiscoveryConfig,
  type DiscoveryProgressCallback,
  type ModelFingerprint,
  type FingerprintMatch,
  type WellKnownModelProfile,
  type WellKnownModelRegistry,
  // Type aliases
  ModelIntentType,
} from "./capability.js";

// ============================================================================
// DOMAIN EXTRACTION (Code Structure Analysis)
// ============================================================================

export {
  // Core Domain Types
  type CodeDomain,
  type DomainDetection,
  type DomainEvidence,
  type DomainExtractionResult,
  // Domain Extractor Interface
  type DomainExtractor,
  type DomainExtractorConfig,
  // Domain Mappings
  DEFAULT_DOMAIN_MAPPINGS,
  DOMAIN_KEYWORDS,
  FILENAME_PATTERNS,
} from "./domain-extractor.js";

// ============================================================================
// KNOWLEDGE GRAPH (Codebase Relationship Graph)
// ============================================================================

export {
  // Graph Node Types
  type GraphNode,
  type NodeType,
  type NodeMetadata,
  // Graph Edge Types
  type GraphEdge,
  type EdgeType,
  type EdgeMetadata,
  // Graph Structure
  type KnowledgeGraph,
  type GraphMetadata,
  type GraphStatistics,
  // Graph Query Types
  type PathQuery,
  type PathAlgorithm,
  type PathResult,
  type NeighborsQuery,
  type NeighborsResult,
  type AncestorsQuery,
  type DescendantsQuery,
  type ImpactAnalysisResult,
  // Graph Serialization
  type SerializedGraph,
  type GraphSnapshot,
  // Graph Events
  type GraphEventType,
  type GraphEvent,
  type GraphEventListener,
  // Graph Builder Configuration
  type GraphBuilderConfig,
  type ImportInfo,
  // Graph Query Result Wrappers
  type GraphQueryResult,
  type CycleDetectionResult,
} from "./knowledge-graph.js";

// ============================================================================
// CACHE INVALIDATION PROTOCOL (Smart Cache Eviction Strategies)
// ============================================================================

export {
  // Core Types
  type CacheInvalidationStrategy,
  type CacheInvalidationTrigger,
  type CacheEntryMetadata,
  // Strategy Configurations
  type BaseInvalidationConfig,
  type TTLInvalidationConfig,
  type SlidingExpirationConfig,
  type SemanticDriftConfig,
  type TagInvalidationConfig,
  type DependencyInvalidationConfig,
  type LRUInvalidationConfig,
  type LFUInvalidationConfig,
  type FIFOInvalidationConfig,
  type AdaptiveInvalidationConfig,
  type InvalidationConfig,
  // Results
  type InvalidationEntry,
  type InvalidationResult,
  // Policy
  type CacheInvalidationPolicy,
  type PolicyEvaluationContext,
  type PolicyEvaluationResult,
  // Interface
  type ICacheInvalidationManager,
  // Statistics
  type InvalidationStatistics,
  // Events
  type CacheInvalidationEvent,
  type CacheInvalidationEventListener,
  // Defaults
  DEFAULT_TTL_CONFIG,
  DEFAULT_SLIDING_CONFIG,
  DEFAULT_SEMANTIC_DRIFT_CONFIG,
  DEFAULT_LRU_CONFIG,
  DEFAULT_LFU_CONFIG,
  DEFAULT_ADAPTIVE_CONFIG,
  DEFAULT_INVALIDATION_POLICY,
  // Type Guards
  isTTLConfig,
  isSlidingConfig,
  isSemanticDriftConfig,
  isTagConfig,
  isDependencyConfig,
  isLRUConfig,
  isLFUConfig,
  isFIFOConfig,
  isAdaptiveConfig,
} from "./cache-invalidation.js";

// ============================================================================
// CACHE WARMING (Proactive Cache Preloading Strategies)
// ============================================================================

export {
  // Warming Strategy Types
  type WarmingStrategyType,
  type WarmingStrategy,
  type StaticWarmingConfig,
  type HistoricalWarmingConfig,
  type PredictiveWarmingConfig,
  type HybridWarmingConfig,
  type AdaptiveWarmingConfig,
  // Query Pattern Types
  type QueryPattern,
  type PatternCluster,
  type PatternLearningResult,
  // Warming Progress Types
  type WarmingStage,
  type WarmingProgress,
  type WarmingProgressCallback,
  // Warming Result Types
  type CacheWarmingResult,
  type WarmingEffectiveness,
  // Warming Configuration
  type CacheWarmingConfig,
  type PatternLearnerConfig,
  // Warming Source Types
  type QueryLogEntry,
  type CommonQueryDataset,
  type DomainKnowledgeBase,
  // Predictive Model Types
  type QueryPrediction,
  type MarkovState,
  type NeuralPredictionConfig,
  // Validation Functions
  validateWarmingConfig,
  validateWarmingResult,
  calculateEffectiveness,
} from "./cache-warming.js";

// ============================================================================
// CACHE ANALYTICS PROTOCOL (Monitoring, Anomaly Detection, Optimization)
// ============================================================================

export {
  // Core Metrics Types
  type HitRateMetrics,
  type LatencyMetrics,
  type MemoryMetrics,
  type EntryMetrics,
  type SimilarityMetrics,
  type QueryPatternMetrics,
  type CacheMetricsSnapshot,
  // Historical Data Types
  type HistoricalDataPoint,
  type TimeSeriesData,
  // Anomaly Detection Types
  type Anomaly,
  type AnomalySeverity,
  type AnomalyType,
  type AnomalyDetectionConfig,
  type AnomalyDetectionResult,
  // Optimization Recommendation Types
  type OptimizationRecommendation,
  type OptimizationCategory,
  type RecommendationPriority,
  type OptimizationSummary,
  // Efficiency Scoring Types
  type EfficiencyScore,
  type EfficiencyScoreComponents,
  type EfficiencyScoreConfig,
  // Dashboard and Reporting Types
  type DashboardData,
  type ReportFormat,
  type ReportConfig,
  type CacheAnalyticsReport,
  // Prometheus/Graphite Export Types
  type PrometheusMetric,
  type PrometheusMetricType,
  type PrometheusExport,
  type GraphiteMetric,
  type GraphiteExport,
  type MetricsExportConfig,
  // Main Configuration
  type CacheAnalyticsConfig,
  type TimeWindow,
  // Default Configuration
  DEFAULT_CACHE_ANALYTICS_CONFIG,
} from "./cache-analytics.js";

// ============================================================================
// PERFORMANCE PROFILING PROTOCOL (CPU, Memory, Latency, Throughput)
// ============================================================================

// ============================================================================
// VECTOR DATABASE PROTOCOL (Pinecone, Weaviate, Qdrant, Milvus, etc.)
// ============================================================================

export {
  // Core Vector Types
  VectorId,
  NamespaceId,
  EmbeddingVector,
  // Enumerations
  DistanceMetric,
  // Data Structures
  VectorRecord,
  VectorMatch,
  MetadataFilter,
  VectorQueryOptions,
  BatchOperationResult,
  VectorDatabaseStats,
  VectorDatabaseHealth,
  // Configuration Types
  VectorDatabaseConfig,
  PineconeConfig,
  WeaviateConfig,
  QdrantConfig,
  MilvusConfig,
  MemoryConfig,
  VectorDatabaseFactoryConfig,
  AdapterSelection,
  // Main Interface
  IVectorDatabaseAdapter,
  // Result Types
  VectorDatabaseResult,
  VectorSearchResult,
  BatchUpsertResult,
} from "./vector-db.js";

export {
  // Main Configuration
  type HotPath,
  type CpuProfilingReport,
  // Memory Profiling Types
  type MemoryProfileSample,
  type MemoryAllocation,
  type MemoryLeakDetection,
  type MemoryProfilingReport,
  // Latency Tracking Types
  type LatencySample,
  type LatencyBreakdown,
  type PercentileMeasurements,
  type LatencyTrackingReport,
  // Throughput Measurement Types
  type ThroughputMeasurement,
  type ThroughputStatistics,
  type ThroughputReport,
  // Collected Metrics
  type CollectedMetrics,
  // Report Generation Types
  type ProfilingReport,
  type PerformanceSummary,
  type OptimizationRecommendation as PerformanceOptimizationRecommendation,
  // Benchmark Framework Types
  type BenchmarkDefinition,
  type BenchmarkSuite,
  type BenchmarkResult as PerformanceBenchmarkResult,
  type BenchmarkComparison,
  type BenchmarkSuiteResult,
  // Profiling Options
  type ProfilingOptions,
  DEFAULT_PROFILING_OPTIONS,
} from "./performance-profiling.js";

// ============================================================================
// THERMAL MANAGEMENT PROTOCOL (Thermal Monitoring, Power Management, DVFS)
// ============================================================================

export {
  // Core Thermal Types
  type TemperatureReading,
  ThermalComponent,
  ThermalStatus,
  type ThermalZoneConfig,
  type ThermalState,
  ThermalTrend,
  // Throttling Detection Types
  type ThrottlingEvent,
  ThrottlingType,
  type ThrottlingDetectionResult,
  // Power Management Types
  PowerState,
  type PowerReading,
  type PowerConsumptionState,
  PowerPolicy,
  type PowerStateTransition,
  PowerTransitionReason,
  // Predictive Thermal Modeling Types
  type ThermalModelConfig,
  ThermalModelType,
  type ThermalPrediction,
  ThermalAction,
  type WorkloadCharacteristics,
  ThermalWorkloadType,
  // Thermal Management Configuration
  type ThermalManagementConfig,
  CoolingStrategy,
  // Thermal Events and Notifications
  type ThermalEvent,
  ThermalEventType,
  type ThermalEventListener,
  // Thermal Constraints
  type ThermalRoutingConstraint,
  type ThermalRoutingDecision,
  // Thermal Telemetry
  type ThermalDataPoint,
  type ThermalStatistics,
  // Thermal Management Interface
  type IThermalManager,
} from "./thermal.js";

// ============================================================================
// NUMA-AWARE SCHEDULING (Non-Uniform Memory Access Optimization)
// ============================================================================

export {
  // Core NUMA Types
  type NUMANodeId,
  type CPUId,
  type MemorySize,
  // NUMA Enums
  NUMAMemoryPolicy,
  NUMASchedulingStrategy,
  // NUMA Topology
  type NUMANode,
  type NUMATopology,
  // NUMA Task Management
  type NUMATask,
  type NUMASchedulingDecision,
  // NUMA Configuration
  type NUMASchedulerConfig,
  // NUMA Memory Operations
  type NUMAMemoryAllocation,
  type NUMAMemoryMigration,
  type NUMAMemoryAffinityRequest,
  type NUMAMemoryAffinityResult,
  // NUMA Statistics
  type NUMAStatistics,
  type NUMAWorkloadDistribution,
  // NUMA Detection
  type NUMADetectionResult,
  // NUMA Optimization
  type NUMAOptimizationRecommendation,
  // NUMA Interfaces
  type INUMAScheduler,
  type INUMADetector,
  type INUMAMemoryAffinityManager,
} from "./numa.js";

// ============================================================================
// HARDWARE DETECTION AND ROUTING PROTOCOL (GPU/CPU/NPU Detection, Capability Profiling)
// ============================================================================

export {
  // Hardware Detection Types
  GPUType,
  type GPUInfo,
  type CPUInfo,
  type MemoryInfo,
  type NPUInfo,
  ThermalState as HardwareThermalState,
  type ThermalInfo,
  type HardwareProfile,
  type HardwareCapabilities,
  // Hardware Routing Types
  HardwareTarget,
  RoutingPriority,
  OperationType,
  type HardwareRoutingDecision,
  type HardwareRoutingConstraints,
  type HardwareDetectionResult,
  type CapabilityScoringResult,
  // Interfaces
  type IHardwareDetector,
  type ICapabilityProfiler,
  type IHardwareRouter,
  // Configuration Types
  type HardwareDetectorConfig,
  type CapabilityProfilerConfig,
  type HardwareRouterConfig,
  // Event Types
  HardwareEventType,
  type HardwareEvent,
  type HardwareEventListener,
  // Utility Functions
  isLocalTarget,
  isGPUTarget,
  isAcceleratorTarget,
  getDefaultRoutingDecision,
  validateConstraints,
} from "./hardware-detection.js";

// ============================================================================
// INPUT SANITIZATION AND VALIDATION (Injection Prevention, Security)
// ============================================================================

export {
  // Injection Types
  InjectionType,
  ThreatSeverity,
  // Sanitization Types
  SanitizationResult,
  DetectedThreat,
  SanitizationMethod,
  // Validation Types
  type InputValidationResult,
  type InputValidationError,
  InputValidationErrorCode,
  type InputValidationWarning,
  // Data Type Validation
  DataType,
  ValidationConstraint,
  // Schema Validation
  ValidationSchema,
  SchemaValidationResult,
  SchemaValidationError,
  // Sanitization Options
  SanitizationOptions,
  CustomSanitizationRule,
  // Input Context
  InputContext,
  InputSource,
  // Security Thresholds
  SecurityThresholds,
  // Interfaces
  IInputSanitizer,
  IValidator,
  ISchemaValidator,
  CompiledSchema,
  ISanitizationMiddleware,
  // Utilities
  isSanitizedString,
  type SanitizedString,
  type ValidatedData,
  type SanitizationStatistics,
  // Defaults
  DEFAULT_SANITIZATION_OPTIONS,
  DEFAULT_SECURITY_THRESHOLDS,
  CONTEXTUAL_OPTIONS,
} from "./input-sanitization.js";

// ============================================================================
// SECURITY AUDIT PROTOCOL (Vulnerability Scanning and Security Analysis)
// ============================================================================

export {
  // Core Types
  type VulnerabilityId,
  type SecurityRuleId,
  SecuritySeverity,
  OWASPVulnerabilityCategory,
  CustomVulnerabilityCategory,
  type VulnerabilityCategory,
  DetectionConfidence,
  // Findings
  type CodeLocation,
  type VulnerabilityFinding,
  type Remediation,
  type DependencyVulnerability,
  type SecretFinding,
  SecretType,
  type ConfigCheck,
  // Scan Configuration
  type ScanScope,
  type SecurityScanOptions,
  type SecurityScanResult,
  type SecuritySummary,
  // Rules
  type SecurityRule,
  type SecurityRuleEngine,
  // Scanner Interfaces
  type VulnerabilityScanner,
  type DependencyChecker,
  // Reporting
  SecurityReportFormat,
  type SecurityReportOptions,
  type SecurityReportGenerator,
  // Metrics and Benchmarks
  type SecurityMetrics,
  type SecurityBenchmark,
  // Policy
  type SecurityAuditPolicy,
  type SecurityPolicyException,
  type PolicyComplianceResult,
} from "./security-audit.js";

// ============================================================================
// ENTERPRISE SSO INTEGRATION (SAML, OAuth, JWT, User Provisioning)
// ============================================================================

export {
  // SSO Protocol Types
  SSOProtocol,
  IdentityProvider,
  // Configuration Types
  SSOConfig,
  ProviderConfig,
  SAMLProviderConfig,
  OAuthProviderConfig,
  LDAPProviderConfig,
  // User and Session Types
  SSOUser,
  SSOSession,
  SessionStatus,
  // Authentication Flow Types
  SAMLAuthRequest,
  SAMLAuthResponse,
  SAMLAuthResult,
  SAMLAuthError,
  OAuthAuthRequest,
  OAuthAuthResponse,
  OAuthAuthResult,
  OAuthAuthError,
  // JWT Validation Types
  JWTHeader,
  JWTPayload,
  JWTValidationOptions,
  JWTValidationResult,
  JWTValidationError,
  // User Provisioning Types
  ProvisioningAction,
  UserProvisioningEvent,
  SCIMResourceType,
  SCIMUser,
  // RBAC Types
  SystemRole,
  Permission,
  Role,
  // SSO Service Interface
  type ISSOService,
  // Validation Types
  SAMLConfigValidationResult,
  OAuthConfigValidationResult,
  IdPMetadataResponse,
  OIDCDiscoveryResponse,
} from "./sso.js";

// ============================================================================
// FEDERATED LEARNING PROTOCOL (Distributed Privacy-Preserving Training)
// ============================================================================

export {
  // Core Configuration Types
  type FederatedConfig,
  type FederatedPrivacyConfig,
  type FederatedValidationConfig,
  type CommunicationConfig,
  // Enums (note: AggregationStrategy and NoiseMechanismType are exported from other modules)
  ClientSelectionStrategy,
  RobustAggregationMethod,
  CompressionMethod,
  // Model Update Types
  type ModelUpdate,
  type ClientMetrics,
  type UpdatePrivacyMetadata,
  type CompressionMetadata,
  // Aggregation Result Types
  type AggregationResult,
  type AggregationMetrics,
  type AggregationValidation,
  type PrivacyConsumption,
  RejectionReason,
  // Federated Round Types
  type FederatedRound,
  RoundStatus,
  type RoundMetrics,
  // Client State Types
  type FederatedClientState,
  ClientStatus,
  type ClientStatistics,
  type ClientPrivacyBudget,
  // Server State Types
  type FederatedServerState,
  ServerStatus,
  type ServerPrivacyBudget,
  type ServerStatistics,
  // Message Types
  type FederatedMessage,
  type TrainRequest,
  type TrainResponse,
  type UpdateSubmission,
  type UpdateAcknowledgment,
  type RoundComplete,
  type ErrorMessage,
  // Result Types
  type FederatedTrainingResult,
  // Utility Types
  type WeightStructure,
  type ClientEligibility,
  type SecureAggregationProtocol,
  SecureAggregationType,
  EncryptionScheme,
} from "./federated.js";

// ============================================================================
// MULTI-TENANT ISOLATION PROTOCOL (Tenant Management, Resource Quotas)
// ============================================================================

export {
  // Core Tenant Types
  type TenantId,
  type Tenant,
  type TenantStatus,
  type TenantPlan,
  type TenantConfig,
  // Resource Quota Types
  type ResourceQuota,
  type RateLimit,
  type TokenQuota,
  type StorageQuota,
  type InferenceQuota,
  type QuotaResetInterval,
  // Usage Metrics Types
  type UsageMetrics,
  type RequestMetrics,
  type TokenUsageMetrics,
  type StorageUsageMetrics,
  type InferenceMetrics,
  type CostMetrics,
  // Tenant Resolution Types
  type TenantResolutionMethod,
  type TenantResolutionResult,
  type TenantAPIKey,
  type TenantJWT,
  // Billing Types
  type BillingPeriod,
  type InvoiceStatus,
  type PricingTier,
  type OveragePricing,
  type Invoice,
  type InvoiceLineItem,
  // Configuration Isolation Types
  type ModelPreferences,
  type RoutingRules,
  type RoutingRule,
  type PrivacySettings,
  type HardwarePreferences,
  type CacheConfiguration,
  // Namespace Isolation Types
  type TenantNamespace,
  type IsolationGuarantee,
  type NamespaceAccessControl,
  type AccessPermission,
  // Resource Pooling Types
  type ResourcePoolType,
  type ResourcePoolAllocation,
  type AllocatedResources,
  type ResourcePoolPriority,
  // Tenant Context Types
  type TenantExecutionContext,
  type TenantRequestContext,
  type QuotaViolation,
  // Tenant Registry Types
  type TenantRegistryEntry,
  type TenantRegistryStats,
  // Event Types
  type TenantEventType,
  type TenantEvent,
  // Validation Types
  type TenantValidationResult,
  type TenantValidationError,
  type TenantValidationWarning,
  // Helper Functions
  createTenantId,
  isValidTenantId,
  getDefaultQuotasForPlan,
} from "./tenant.js";

// ============================================================================
// LEARNING AND ADAPTATION PROTOCOL (Telemetry, Profiling, Adaptation)
// ============================================================================

export {
  // Core Learning Types
  type LearningProfile,
  type LearningHardwareProfile,
  type UsageProfile,
  type PerformanceProfile,
  type PreferenceProfile,
  type TelemetryEntry,
  type RoutingDestination,
  type LearningRoutingDecision,
  type QueryOutcome,
  type RoutingRecommendation,
  type HardwareConfig,
  type LearningConfig,
  type Query,
  type QueryContext,
  type LearningStatistics,
  type LearningResult,
  // Learning Interfaces
  type ILearningEngine,
  type ITelemetryCollector,
  type IHardwareProfiler,
} from "./learning.js";
