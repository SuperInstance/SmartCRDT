/**
 * ATP and ACP Protocol Types for Aequor Cognitive Orchestration Platform
 *
 * This module defines the core protocol types for inter-model communication:
 * - ATP (Autonomous Task Processing): Single-model query protocol
 * - ACP (Assisted Collaborative Processing): Multi-model query protocol
 *
 * These protocols enable universal AI orchestration by standardizing how requests
 * are structured, routed, and processed across different models and backends.
 */

/**
 * Intent categories for classifying user queries
 *
 * These categories help the routing system understand the nature of a request
 * and select the appropriate model and processing strategy.
 */
export enum IntentCategory {
  /** Simple informational query */
  QUERY = "query",
  /** Command or instruction to execute */
  COMMAND = "command",
  /** Conversational response */
  CONVERSATION = "conversation",
  /** Code generation request */
  CODE_GENERATION = "code_generation",
  /** Analytical task */
  ANALYSIS = "analysis",
  /** Creative content generation */
  CREATIVE = "creative",
  /** Debugging task */
  DEBUGGING = "debugging",
  /** System-level operation */
  SYSTEM = "system",
  /** Unknown or unclassified intent */
  UNKNOWN = "unknown",
}

/**
 * Urgency levels for requests
 *
 * Urgency affects routing decisions, priority queuing, and resource allocation.
 * Higher urgency requests may be routed to faster (more expensive) models.
 */
export enum Urgency {
  /** Low priority - can be delayed or batched */
  LOW = "low",
  /** Normal priority - standard processing */
  NORMAL = "normal",
  /** High priority - expedited processing */
  HIGH = "high",
  /** Critical priority - immediate processing required */
  CRITICAL = "critical",
}

/**
 * Collaboration modes for multi-model processing
 *
 * These modes define how multiple models work together in ACP to process a request.
 */
export enum CollaborationMode {
  /** Models process one after another, with each model building on the previous output */
  SEQUENTIAL = "sequential",
  /** Models process simultaneously, with results aggregated */
  PARALLEL = "parallel",
  /** Output of one model feeds into the next as input */
  CASCADE = "cascade",
  /** Multiple models process independently, outputs are combined (voting, averaging) */
  ENSEMBLE = "ensemble",
}

/**
 * ATPRequest - Enhanced ATP protocol request format
 *
 * ATPRequest represents a single-model query with full constraint support
 * and preferences for the Aequor protocol. It enables optimal routing
 * and processing while respecting user preferences and system constraints.
 *
 * This format replaces the simpler ATPacket for production use, providing
 * comprehensive constraint-based routing capabilities.
 *
 * Usage:
 * - All single-model queries (replaces ATPacket)
 * - Requests with specific cost, latency, and quality requirements
 * - Privacy-sensitive queries with explicit constraints
 * - High-stakes production workloads
 *
 * Example:
 * ```typescript
 * const request: ATPRequest = {
 *   version: "1.0",
 *   id: 'atp-123',
 *   timestamp: Date.now(),
 *   query: 'What is the capital of France?',
 *   embedding: [0.1, 0.2, ...], // Optional for routing optimization
 *   context: { userId: 'user-456', session: 'sess-789' },
 *   constraints: {
 *     maxCost: 0.01,
 *     maxLatency: 2000,
 *     privacy: PrivacyLevel.SENSITIVE,
 *     hardware: { maxPower: 5.0 }
 *   },
 *   preferences: {
 *     backend: "auto",
 *     model: "gpt-3.5-turbo",
 *     fallback: true
 *   }
 * };
 * ```
 */
export interface ATPRequest {
  /** Protocol version (for backward compatibility) */
  version: "1.0";

  /** Unique identifier for this request (UUID or similar) */
  id: string;

  /** The user's query or request text */
  query: string;

  /** Optional semantic embedding for routing optimization (1536-dim) */
  embedding?: number[];

  /** Optional contextual metadata for routing/processing */
  context?: ContextData;

  /** Constraints that must be satisfied during processing */
  constraints: {
    /** Maximum cost in USD (optional) */
    maxCost?: number;
    /** Maximum latency in milliseconds (optional) */
    maxLatency?: number;
    /** Privacy level required (optional) */
    privacy?: PrivacyLevel;
    /** Hardware constraints (optional) */
    hardware?: HardwareConstraints;
  };

  /** Preferences for processing and routing */
  preferences: {
    /** Preferred backend: local, cloud, or auto (default: auto) */
    backend?: "local" | "cloud" | "auto";
    /** Specific model to use (optional) */
    model?: string;
    /** Whether to allow fallback to other models (default: true) */
    fallback?: boolean;
  };

  /** Unix timestamp (ms) when the request was created */
  timestamp: number;

  /** Classified intent category for routing decisions */
  intent: IntentCategory;

  /** Urgency level affecting processing priority */
  urgency: Urgency;
}

/**
 * ContextData - Structured contextual information
 *
 * Provides additional metadata that helps with routing, processing,
 * and personalization. This structured format enables better
 * understanding of the request context.
 */
export interface ContextData {
  /** User identifier for personalization */
  userId?: string;
  /** Session identifier for conversation continuity */
  sessionId?: string;
  /** Device information for hardware-aware routing */
  device?: {
    type: "mobile" | "desktop" | "tablet" | "server";
    platform: "ios" | "android" | "windows" | "macos" | "linux";
    capabilities: string[];
  };
  /** Application context */
  application?: {
    name: string;
    version: string;
    features: string[];
  };
  /** Conversation history for context continuity */
  conversation?: {
    history: Array<{
      role: "user" | "assistant";
      content: string;
      timestamp: number;
    }>;
    turns: number;
  };
  /** Custom metadata (max 50 keys) */
  custom?: Record<string, unknown>;
}

/**
 * HardwareConstraints - Physical resource constraints
 *
 * Defines limitations on hardware resource usage for processing.
 * Enables energy-efficient and thermally-aware routing decisions.
 */
export interface HardwareConstraints {
  /** Maximum power consumption in watts (optional) */
  maxPower?: number;
  /** Maximum thermal impact (0-1 scale, where 1 is max heat) (optional) */
  maxThermal?: number;
  /** Preferred GPU availability (optional) */
  preferGPU?: boolean;
  /** Battery level threshold (0-1, only for mobile) (optional) */
  minBatteryLevel?: number;
  /** Available RAM in MB (optional) */
  maxRAM?: number;
  /** Available storage space in MB (optional) */
  maxStorage?: number;
}

/**
 * Legacy ATPacket - Deprecated
 *
 * @deprecated Use ATPRequest instead. ATPacket lacks constraint support
 * and preferences needed for production routing.
 */
export interface ATPacket {
  /** Unique identifier for this request (UUID or similar) */
  id: string;

  /** The user's query or request text */
  query: string;

  /** Classified intent category for routing decisions */
  intent: IntentCategory;

  /** Urgency level affecting processing priority */
  urgency: Urgency;

  /** Unix timestamp (ms) when the request was created */
  timestamp: number;

  /** Optional contextual metadata for routing/processing */
  context?: Record<string, unknown>;
}

/**
 * ACPRequest - Enhanced ACP protocol request format
 *
 * ACPRequest represents a multi-model collaboration request with full
 * workflow support and constraint handling. It enables complex,
 * multi-step AI processing with sophisticated orchestration.
 *
 * This format replaces the simpler ACPHandshake for production use,
 * providing comprehensive workflow and constraint capabilities.
 *
 * Usage:
 * - Complex multi-model queries requiring specialized handling
 * - Multi-step reasoning and analysis tasks
 * - High-accuracy requirements with ensemble validation
 * - Creative tasks requiring multiple perspectives
 *
 * Example:
 * ```typescript
 * const request: ACPRequest = {
 *   version: "1.0",
 *   id: 'acp-456',
 *   timestamp: Date.now(),
 *   workflow: [
 *     {
 *       model: 'gpt-4',
 *       operation: 'generate',
 *       input: 'Design a secure authentication system',
 *       constraints: { maxLatency: 5000, privacy: PrivacyLevel.SENSITIVE }
 *     },
 *     {
 *       model: 'codellama',
 *       operation: 'analyze',
 *       input: { code: gpt4Output, type: 'security-audit' },
 *       constraints: { maxLatency: 3000 }
 *     }
 *   ],
 *   sharedContext: {
 *     userId: 'user-789',
 *     requirements: ['security', 'scalability', 'user-friendly']
 *   }
 * };
 * ```
 */
export interface ACPRequest {
  /** Protocol version (for backward compatibility) */
  version: "1.0";

  /** Unique identifier for this collaboration session */
  id: string;

  /** Unix timestamp (ms) when the request was created */
  timestamp: number;

  /** The user's query or request text (root input) */
  query: string;

  /** Classified intent category for strategy selection */
  intent: IntentCategory;

  /** Workflow steps defining the multi-model collaboration */
  workflow: WorkflowStep[];

  /** Shared context available to all workflow steps */
  sharedContext: Map<string, any>;

  /** Global constraints for the entire workflow */
  constraints: {
    /** Maximum total cost in USD (optional) */
    maxCost?: number;
    /** Maximum total latency in milliseconds (optional) */
    maxLatency?: number;
    /** Privacy level required for all steps (optional) */
    privacy?: PrivacyLevel;
    /** Global hardware constraints (optional) */
    hardware?: HardwareConstraints;
  };

  /** Global preferences for workflow execution */
  preferences: {
    /** Preferred execution backend (default: auto) */
    backend?: "local" | "cloud" | "auto";
    /** Preferred models for fallback (optional) */
    preferredModels?: string[];
    /** Whether to allow step-level fallback (default: true) */
    allowStepFallback?: boolean;
    /** Aggregation strategy override (optional) */
    aggregationStrategy?: AggregationStrategy;
  };

  /** How models should collaborate (sequential, parallel, cascade, ensemble) */
  collaborationMode: CollaborationMode;

  /** Urgency level affecting processing priority */
  urgency: Urgency;
}

/**
 * WorkflowStep - Single step in a multi-model workflow
 *
 * Defines an operation to be performed by a specific model with
 * its own input, constraints, and execution parameters.
 */
export interface WorkflowStep {
  /** Unique step identifier within the workflow */
  stepId: string;

  /** Model identifier to execute this step */
  model: string;

  /** Type of operation to perform */
  operation: "generate" | "embed" | "classify" | "rank" | "analyze" | "transform";

  /** Input for this step (can be string, object, or reference) */
  input: any;

  /** Step-specific constraints (overrides global constraints) */
  constraints?: {
    /** Maximum cost for this step (optional) */
    maxCost?: number;
    /** Maximum latency for this step (optional) */
    maxLatency?: number;
    /** Privacy level for this step (optional) */
    privacy?: PrivacyLevel;
    /** Hardware constraints for this step (optional) */
    hardware?: HardwareConstraints;
  };

  /** How this step's output is used */
  outputTarget: "final" | "next" | "aggregate" | "branch";

  /** Dependencies on other steps (step IDs that must complete first) */
  dependencies?: string[];

  /** Optional parameters for the operation */
  parameters?: {
    /** Temperature for generation tasks (0-2) */
    temperature?: number;
    /** Maximum tokens for generation tasks */
    maxTokens?: number;
    /** Top-p sampling parameter (0-1) */
    topP?: number;
    /** Top-k sampling parameter */
    topK?: number;
    /** Custom parameters for specific models */
    custom?: Record<string, any>;
  };

  /** Estimated cost for this step in USD (optional, for planning) */
  estimatedCost?: number;

  /** Estimated latency for this step in ms (optional, for planning) */
  estimatedLatency?: number;
}

/**
 * AggregationStrategy - How to combine multiple outputs
 *
 * Defines the strategy for combining results from parallel or
 * ensemble workflow steps.
 */
export enum AggregationStrategy {
  /** Return the first response received */
  FIRST = "first",

  /** Return the last response received (sequential workflows) */
  LAST = "last",

  /** Majority vote across all responses */
  MAJORITY_VOTE = "majority_vote",

  /** Weighted average based on confidence scores */
  WEIGHTED_AVERAGE = "weighted_average",

  /** Return the response with highest confidence */
  BEST = "best",

  /** Return the response with lowest latency */
  FASTEST = "fastest",

  /** Concatenate all responses */
  CONCATENATE = "concatenate",

  /** Return all responses (let client decide) */
  ALL = "all",

  /** Custom aggregation function */
  CUSTOM = "custom",
}

/**
 * Legacy ACPHandshake - Deprecated
 *
 * @deprecated Use ACPRequest instead. ACPHandshake lacks workflow support
 * and advanced constraint handling needed for production orchestration.
 */
export interface ACPHandshake {
  /** Unique identifier for this collaboration session */
  id: string;

  /** Ordered list of model identifiers to use in collaboration */
  models: string[];

  /** The user's query or request text */
  query: string;

  /** Classified intent category for strategy selection */
  intent: IntentCategory;

  /** How models should collaborate (sequential, parallel, cascade, ensemble) */
  collaborationMode: CollaborationMode;

  /** Unix timestamp (ms) when the handshake was initiated */
  timestamp: number;
}

/**
 * Response from ATP or ACP processing
 *
 * Standardized response format for both single-model and multi-model processing.
 */
export interface AequorResponse {
  /** Unique identifier matching the request */
  id: string;

  /** Generated content/response */
  content: string;

  /** Whether this was ATP or ACP */
  protocol: "ATP" | "ACP";

  /** Models that participated (single for ATP, array for ACP) */
  models: string | string[];

  /** Backend(s) used ('local' | 'cloud' | 'hybrid') */
  backend: "local" | "cloud" | "hybrid";

  /** Confidence in the response (0-1) */
  confidence: number;

  /** Processing latency in milliseconds */
  latency: number;

  /** Token usage statistics */
  tokensUsed?: number;

  /** Whether result was retrieved from cache */
  fromCache?: boolean;

  /** Additional protocol-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Protocol error types
 *
 * Standardized error types for ATP/ACP protocol violations and failures.
 * Extended to cover all possible error scenarios in the enhanced protocol.
 */
export enum ProtocolErrorType {
  /** Invalid packet format */
  INVALID_PACKET = "invalid_packet",
  /** Unknown or unsupported model */
  UNKNOWN_MODEL = "unknown_model",
  /** Model failure during processing */
  MODEL_FAILURE = "model_failure",
  /** Insufficient permissions */
  ACCESS_DENIED = "access_denied",
  /** Rate limit exceeded */
  RATE_LIMITED = "rate_limited",
  /** Collaboration timeout */
  TIMEOUT = "timeout",
  /** Constraint violation */
  CONSTRAINT_VIOLATION = "constraint_violation",
  /** Hardware constraint violation */
  HARDWARE_LIMIT = "hardware_limit",
  /** Privacy requirement violation */
  PRIVACY_VIOLATION = "privacy_violation",
  /** Cost limit exceeded */
  COST_LIMIT = "cost_limit",
  /** Latency limit exceeded */
  LATENCY_LIMIT = "latency_limit",
  /** Invalid workflow step */
  INVALID_STEP = "invalid_step",
  /** Workflow dependency error */
  DEPENDENCY_ERROR = "dependency_error",
  /** Serialization error */
  SERIALIZATION_ERROR = "serialization_error",
  /** Deserialization error */
  DESERIALIZATION_ERROR = "deserialization_error",
  /** Version incompatibility */
  VERSION_MISMATCH = "version_mismatch",
  /** Authentication required */
  AUTHENTICATION_REQUIRED = "authentication_required",
  /** Invalid credentials */
  INVALID_CREDENTIALS = "invalid_credentials",
  /** Service unavailable */
  SERVICE_UNAVAILABLE = "service_unavailable",
  /** Network error */
  NETWORK_ERROR = "network_error",
  /** Internal server error */
  INTERNAL_ERROR = "internal_error",
  /** Bad request format */
  BAD_REQUEST = "bad_request",
  /** Unsupported operation */
  UNSUPPORTED_OPERATION = "unsupported_operation",
  /** Validation error */
  VALIDATION_ERROR = "validation_error",
  /** Configuration error */
  CONFIGURATION_ERROR = "configuration_error",
  /** Resource not found */
  NOT_FOUND = "not_found",
  /** Method not allowed */
  METHOD_NOT_ALLOWED = "method_not_allowed",
  /** Too many requests */
  TOO_MANY_REQUESTS = "too_many_requests",
}

/**
 * RetryPolicy - Configuration for automatic retry behavior
 *
 * Defines when and how to retry failed requests, with exponential
 * backoff and jitter for optimal retry behavior.
 */
export interface RetryPolicy {
  /** Whether retries are enabled (default: true) */
  enabled: boolean;

  /** Maximum number of retry attempts (default: 3) */
  maxAttempts: number;

  /** Initial delay between retries in milliseconds (default: 1000) */
  initialDelay: number;

  /** Maximum delay between retries in milliseconds (default: 30000) */
  maxDelay: number;

  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier: number;

  /** Whether to add jitter to retry delays (default: true) */
  jitter: boolean;

  /** Maximum jitter factor (0-1, default: 0.1) */
  jitterFactor: number;

  /** Timeout for each attempt in milliseconds (default: 30000) */
  timeout: number;

  /** Conditions that should trigger retry (default: all retryable errors) */
  retryConditions?: ProtocolErrorType[];

  /** Conditions that should NOT trigger retry (default: non-retryable errors) */
  excludeConditions?: ProtocolErrorType[];
}

/**
 * Default retry policy for ATP/ACP protocols
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  enabled: true,
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  jitterFactor: 0.1,
  timeout: 30000,
  retryConditions: [
    ProtocolErrorType.TIMEOUT,
    ProtocolErrorType.NETWORK_ERROR,
    ProtocolErrorType.SERVICE_UNAVAILABLE,
    ProtocolErrorType.RATE_LIMITED,
    ProtocolErrorType.TOO_MANY_REQUESTS,
  ],
  excludeConditions: [
    ProtocolErrorType.INVALID_PACKET,
    ProtocolErrorType.ACCESS_DENIED,
    ProtocolErrorType.AUTHENTICATION_REQUIRED,
    ProtocolErrorType.INVALID_CREDENTIALS,
    ProtocolErrorType.VALIDATION_ERROR,
    ProtocolErrorType.BAD_REQUEST,
    ProtocolErrorType.CONSTRAINT_VIOLATION,
    ProtocolErrorType.PRIVACY_VIOLATION,
  ],
};

/**
 * Protocol error response
 *
 * Standardized error format for ATP/ACP failures with enhanced
 * retry information and contextual data.
 */
export interface ProtocolError {
  /** Error type from ProtocolErrorType enum */
  type: ProtocolErrorType;

  /** Human-readable error message */
  message: string;

  /** Request ID that failed */
  requestId: string;

  /** Unix timestamp (ms) when error occurred */
  timestamp: number;

  /** Additional error details */
  details?: Record<string, unknown>;

  /** Retry policy for this error */
  retryPolicy?: RetryPolicy;

  /** Whether this error is retryable (default: false) */
  retryable?: boolean;

  /** Recommended action for handling this error */
  action?: "retry" | "fallback" | "abort" | "escalate";

  /** Error code for programmatic handling */
  code?: string;

  /** HTTP status code (if applicable) */
  statusCode?: number;

  /** Related error IDs (for correlated failures) */
  relatedErrors?: string[];

  /** Stack trace (for debugging) */
  stack?: string;

  /** Error context (additional debugging information) */
  context?: {
    /** Model that failed (if applicable) */
    model?: string;
    /** Step that failed (if ACP) */
    stepId?: string;
    /** Backend that failed */
    backend?: string;
    /** Constraint that was violated */
    constraint?: string;
  };
}

/**
 * ErrorHistory - Track retry attempts for debugging
 *
 * Maintains a history of retry attempts to aid in debugging
 * and optimize retry policies.
 */
export interface ErrorHistory {
  /** Original error ID */
  errorId: string;

  /** All retry attempts */
  attempts: Array<{
    /** Attempt number (1 = original, 2+ = retries) */
    attempt: number;

    /** Timestamp of this attempt */
    timestamp: number;

    /** Error that occurred (or null for success) */
    error?: ProtocolError;

    /** Delay before this attempt */
    delay: number;

    /** Backend/model used for this attempt */
    target: {
      backend: string;
      model?: string;
      stepId?: string;
    };
  }>;

  /** Total time spent on retries */
  totalRetryTime: number;

  /** Whether the request eventually succeeded */
  succeeded: boolean;

  /** Final result (if successful) */
  finalResult?: AequorResponse;
}

// ============================================================================
// PRIVACY AND INTENT ENCODING PROTOCOL TYPES
// ============================================================================

/**
 * Intent vector encoding result with privacy guarantees
 *
 * The output of IntentEncoder.encode() - a 768-dimensional vector
 * that captures query intent while providing ε-differential privacy.
 */
export interface IntentVector {
  /** 768-dimensional intent vector (L2-normalized) */
  vector: Float32Array;

  /** Privacy parameter used (ε-differential privacy) */
  epsilon: number;

  /** Model used for base embedding */
  model: string;

  /** Time taken in milliseconds */
  latency: number;

  /** Whether this satisfies ε-differential privacy */
  satisfiesDP: boolean;
}

/**
 * Configuration for IntentEncoder
 *
 * IntentEncoder generates privacy-preserving intent vectors by:
 * 1. Getting OpenAI embeddings (text-embedding-3-small, 1536-dim)
 * 2. Applying PCA dimensionality reduction (1536 → 768)
 * 3. Adding Gaussian noise for ε-differential privacy
 * 4. Normalizing output to unit sphere
 */
export interface IntentEncoderConfig {
  /** OpenAI API key for embeddings (from env or constructor) */
  openaiKey?: string;

  /** Base URL for embedding API (allows Ollama compatibility) */
  baseURL?: string;

  /** Default ε value for differential privacy (default: 1.0) */
  epsilon?: number;

  /** Output dimension (default: 768) */
  outputDimensions?: number;

  /** PCA projection matrix (pre-trained from 1536→768) */
  pcaMatrix?: number[][];

  /** Request timeout in milliseconds */
  timeout?: number;

  /** Maximum privacy budget (default: Infinity) */
  maxPrivacyBudget?: number;

  /** Use Laplacian noise instead of Gaussian (default: false) */
  useLaplacianNoise?: boolean;
}

/**
 * IntentEncoder - Privacy-preserving intent encoding interface
 *
 * Encodes queries as intent vectors that preserve semantic meaning
 * while providing ε-differential privacy guarantees.
 *
 * The encoding pipeline:
 * 1. Generate OpenAI embedding (text-embedding-3-small, 1536-dim)
 * 2. Apply PCA dimensionality reduction (1536 → 768)
 * 3. Add Gaussian noise for ε-differential privacy
 * 4. Normalize output vector to unit sphere
 *
 * Privacy guarantee: The output vector satisfies ε-DP, meaning
 * that changing one query cannot change the distribution of
 * outputs by more than exp(ε).
 *
 * ε values and their meanings:
 * - ε = 0.1: Strong privacy, low utility
 * - ε = 0.5: Moderate privacy, moderate utility
 * - ε = 1.0: Balanced privacy/utility (recommended)
 * - ε = 2.0: Weak privacy, high utility
 * - ε = 5.0: Very weak privacy, very high utility
 */
export interface IntentEncoder {
  /**
   * Encode a single query as an intent vector
   *
   * @param query - Text query to encode
   * @param epsilon - Privacy parameter (default: from config, lower = more private)
   * @returns Intent vector with privacy guarantees
   */
  encode(query: string, epsilon?: number): Promise<IntentVector>;

  /**
   * Encode multiple queries in batch
   *
   * @param queries - Array of text queries to encode
   * @param epsilon - Privacy parameter (default: from config)
   * @returns Array of intent vectors
   */
  encodeBatch(queries: string[], epsilon?: number): Promise<IntentVector[]>;

  /**
   * Initialize the encoder (lazy loading of resources)
   */
  initialize?(): Promise<void>;

  /**
   * Shutdown and release resources
   */
  shutdown?(): Promise<void>;
}

/**
 * Privacy classification levels
 *
 * Determines how queries should be handled with respect to
 * data transmission and storage.
 */
export enum PrivacyLevel {
  /** Safe to transmit to cloud without redaction */
  PUBLIC = "public",

  /** Requires selective redaction before cloud transmission */
  SENSITIVE = "sensitive",

  /** Must never leave local device */
  SOVEREIGN = "sovereign",
}

/**
 * Privacy classification result
 */
export interface PrivacyClassification {
  /** Overall privacy level */
  level: PrivacyLevel;

  /** Confidence in classification (0-1) */
  confidence: number;

  /** Detected PII types */
  piiTypes: PIIType[];

  /** Reason for classification */
  reason: string;
}

/**
 * Privacy categories for query classification
 *
 * These categories determine how queries should be processed:
 * - LOGIC: Safe to transmit without modification
 * - STYLE: Should be rewritten to remove identifying patterns
 * - SECRET: Must be redacted using R-A Protocol
 */
export enum PrivacyCategory {
  /** Safe to share - pure reasoning, no PII */
  LOGIC = "logic",
  /** Needs rewriting - stylistic patterns that could identify user */
  STYLE = "style",
  /** Apply R-A Protocol - contains direct PII or secrets */
  SECRET = "secret",
}

/**
 * PII types supported for detection
 *
 * Supported Personally Identifiable Information types for
 * detection and redaction.
 */
export enum PIIType {
  /** Email addresses (e.g., user@example.com) */
  EMAIL = "email",

  /** Phone numbers (e.g., +1-555-123-4567) */
  PHONE = "phone",

  /** Social Security Numbers (e.g., 123-45-6789) */
  SSN = "ssn",

  /** Credit card numbers (e.g., 4111-1111-1111-1111) */
  CREDIT_CARD = "credit_card",

  /** IP addresses (e.g., 192.168.1.1) */
  IP_ADDRESS = "ip_address",

  /** Physical addresses */
  ADDRESS = "address",

  /** Person names (probabilistic) */
  NAME = "name",

  /** Dates of birth */
  DATE_OF_BIRTH = "date_of_birth",

  /** Passport numbers */
  PASSPORT = "passport",

  /** Driver's license numbers */
  DRIVERS_LICENSE = "drivers_license",

  /** Bank account numbers */
  BANK_ACCOUNT = "bank_account",

  /** Medical record numbers */
  MEDICAL_RECORD = "medical_record",

  /** Health ID numbers */
  HEALTH_ID = "health_id",

  /** Passwords */
  PASSWORD = "password",

  /** License plate numbers */
  LICENSE_PLATE = "license_plate",

  /** API keys */
  API_KEY = "api_key",

  /** URL patterns */
  URL = "url",

  /** Custom regex patterns */
  CUSTOM_PATTERN = "custom_pattern",
}

/**
 * Privacy classifier interface
 */
export interface PrivacyClassifier {
  /**
   * Classify privacy level of a query
   *
   * @param query - Text query to classify
   * @returns Privacy classification result
   */
  classify(query: string): Promise<PrivacyClassification>;

  /**
   * Detect PII in text
   *
   * @param text - Text to scan for PII
   * @returns Array of detected PII types
   */
  detectPII(text: string): Promise<PIIType[]>;

  /**
   * Redact PII from text
   *
   * @param text - Text to redact
   * @param types - PII types to redact (default: all detected)
   * @returns Redacted text
   */
  redact(text: string, types?: PIIType[]): Promise<string>;
}

/**
 * Redaction-Addition Protocol (R-A Protocol)
 *
 * A protocol for functional privacy:
 * 1. Redact sensitive content locally
 * 2. Send structural query to cloud
 * 3. Re-hydrate response with local context
 *
 * This enables cloud processing without exposing sensitive data.
 */
export interface RedactionAdditionProtocol {
  /**
   * Redact sensitive content from query
   *
   * @param query - Original query
   * @returns Redacted query with metadata
   */
  redact(query: string): Promise<RedactionResult>;

  /**
   * Re-hydrate cloud response with local context
   *
   * @param response - Cloud response
   * @param context - Local redaction context
   * @returns Re-hydrated response
   */
  rehydrate(response: string, context: RedactionContext): Promise<string>;
}

/**
 * Result of redaction operation
 */
export interface RedactionResult {
  /** Redacted query (safe to send to cloud) */
  redactedQuery: string;

  /** Context needed for re-hydration */
  context: RedactionContext;

  /** Number of redactions made */
  redactionCount: number;
}

/**
 * Context for re-hydrating responses
 */
export interface RedactionContext {
  /** Map of redaction markers to original values */
  redactions: Map<string, string>;

  /** PII types that were redacted */
  piiTypes: PIIType[];

  /** Timestamp of redaction */
  timestamp: number;
}

/**
 * ConstraintSerialization - JSON-serializable constraint format
 *
 * Provides a standardized way to serialize constraints for transport
 * and storage. This format ensures compatibility across different
 * implementations and languages.
 */
export interface ConstraintSerialization {
  /** Human-readable name for the constraint */
  name: string;

  /** Type identifier for the constraint */
  type: "budget" | "latency" | "privacy" | "thermal" | "energy" | "battery" | "quality";

  /** Serialized constraint value(s) */
  value: {
    /** Lower bound (for quality, privacy, battery) */
    min?: number;
    /** Upper bound (for budget, latency, thermal, energy) */
    max?: number;
    /** Target value (for optimization) */
    target?: number;
  };

  /** Relative importance (0-1) */
  weight: number;

  /** Whether this is a hard constraint */
  isHard: boolean;

  /** Metadata about the constraint */
  metadata?: {
    /** Source of the constraint (user, system, policy) */
    source?: "user" | "system" | "policy";
    /** Time when constraint was created */
    createdAt?: number;
    /** Time when constraint expires (optional) */
    expiresAt?: number;
    /** Tags for categorization */
    tags?: string[];
  };
}

/**
 * ConstraintValidationError - Constraint validation error details
 *
 * Provides detailed information about constraint validation failures,
 * including the specific constraint that failed and the reason.
 */
export interface ConstraintValidationError {
  /** Constraint name that failed validation */
  constraintName: string;

  /** Type of validation error */
  errorType: "TYPE_ERROR" | "RANGE_ERROR" | "DEPENDENCY_ERROR" | "CONFLICT_ERROR";

  /** Human-readable error message */
  message: string;

  /** Constraint value that caused the error */
  value?: any;

  /** Expected value or range */
  expected?: any;

  /** Related constraint names (for dependency conflicts) */
  relatedConstraints?: string[];
}

/**
 * ConstraintValidator - Constraint validation and serialization utility
 *
 * Provides functionality to validate, serialize, and deserialize constraints
 * in a standardized format. Ensures consistency across ATP/ACP implementations.
 */
export class ConstraintValidator {
  /**
   * Validate constraints before serialization
   *
   * @param constraints - Constraint objects to validate
   * @returns Validation result with errors
   */
  validateConstraints(
    constraints: Record<string, any>
  ): {
    valid: boolean;
    errors: ConstraintValidationError[];
    serialized: ConstraintSerialization[];
  } {
    const errors: ConstraintValidationError[] = [];
    const serialized: ConstraintSerialization[] = [];

    for (const [name, constraint] of Object.entries(constraints)) {
      // Basic validation
      const validationError = this.validateSingleConstraint(name, constraint);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      // Serialization
      try {
        const serializedConstraint = this.serializeConstraint(name, constraint);
        serialized.push(serializedConstraint);
      } catch (error) {
        errors.push({
          constraintName: name,
          errorType: "TYPE_ERROR",
          message: `Failed to serialize constraint: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      serialized,
    };
  }

  /**
   * Validate a single constraint
   *
   * @param name - Constraint name
   * @param constraint - Constraint object
   * @returns Validation error or null if valid
   */
  private validateSingleConstraint(
    name: string,
    constraint: any
  ): ConstraintValidationError | null {
    // Check required fields
    if (!name || typeof name !== "string") {
      return {
        constraintName: name || "unnamed",
        errorType: "TYPE_ERROR",
        message: "Constraint name must be a non-empty string",
      };
    }

    if (!constraint || typeof constraint !== "object") {
      return {
        constraintName: name,
        errorType: "TYPE_ERROR",
        message: "Constraint must be an object",
      };
    }

    // Validate type
    const validTypes = ["budget", "latency", "privacy", "thermal", "energy", "battery", "quality"];
    if (!validTypes.includes(constraint.type)) {
      return {
        constraintName: name,
        errorType: "TYPE_ERROR",
        message: `Invalid constraint type. Must be one of: ${validTypes.join(", ")}`,
        expected: validTypes,
        value: constraint.type,
      };
    }

    // Validate weight
    if (
      typeof constraint.weight !== "number" ||
      constraint.weight < 0 ||
      constraint.weight > 1
    ) {
      return {
        constraintName: name,
        errorType: "RANGE_ERROR",
        message: "Constraint weight must be between 0 and 1",
        expected: "0 <= x <= 1",
        value: constraint.weight,
      };
    }

    // Validate bounds
    if (constraint.min !== undefined && constraint.min < 0) {
      return {
        constraintName: name,
        errorType: "RANGE_ERROR",
        message: "Minimum value cannot be negative",
        value: constraint.min,
      };
    }

    if (constraint.max !== undefined && constraint.max < 0) {
      return {
        constraintName: name,
        errorType: "RANGE_ERROR",
        message: "Maximum value cannot be negative",
        value: constraint.max,
      };
    }

    if (
      constraint.min !== undefined &&
      constraint.max !== undefined &&
      constraint.min > constraint.max
    ) {
      return {
        constraintName: name,
        errorType: "CONFLICT_ERROR",
        message: "Minimum value cannot be greater than maximum value",
        expected: "min <= max",
        value: { min: constraint.min, max: constraint.max },
      };
    }

    return null;
  }

  /**
   * Serialize constraint to transport format
   *
   * @param name - Constraint name
   * @param constraint - Constraint object
   * @returns Serialized constraint
   */
  private serializeConstraint(name: string, constraint: any): ConstraintSerialization {
    // Map constraint types to standard types
    const typeMap: Record<string, string> = {
      BUDGET: "budget",
      LATENCY: "latency",
      PRIVACY: "privacy",
      THERMAL: "thermal",
      ENERGY: "energy",
      BATTERY: "battery",
      QUALITY: "quality",
    };

    return {
      name,
      type: typeMap[constraint.type] || constraint.type,
      value: {
        min: constraint.minValue,
        max: constraint.maxValue,
        target: constraint.targetValue,
      },
      weight: constraint.weight ?? 0.5,
      isHard: constraint.isHard ?? false,
      metadata: constraint.metadata,
    };
  }

  /**
   * Deserialize constraint from transport format
   *
   * @param serialized - Serialized constraint
   * @returns Constraint object
   */
  deserializeConstraint(serialized: ConstraintSerialization): any {
    const typeMap: Record<string, string> = {
      budget: "BUDGET",
      latency: "LATENCY",
      privacy: "PRIVACY",
      thermal: "THERMAL",
      energy: "ENERGY",
      battery: "BATTERY",
      quality: "QUALITY",
    };

    return {
      name: serialized.name,
      type: typeMap[serialized.type] || serialized.type,
      minValue: serialized.value.min,
      maxValue: serialized.value.max,
      targetValue: serialized.value.target,
      weight: serialized.weight,
      isHard: serialized.isHard,
      metadata: serialized.metadata,
    };
  }

  /**
   * Parse constraints from JSON string
   *
   * @param jsonString - JSON string containing constraints
   * @returns Parsed and validated constraints
   */
  parseConstraintsFromJSON(jsonString: string): {
    valid: boolean;
    errors: ConstraintValidationError[];
    constraints: Record<string, any>;
  } {
    try {
      const parsed = JSON.parse(jsonString);
      const validation = this.validateConstraints(parsed);

      return {
        valid: validation.valid,
        errors: validation.errors,
        constraints: validation.serialized.reduce((acc, constraint) => {
          acc[constraint.name] = this.deserializeConstraint(constraint);
          return acc;
        }, {} as Record<string, any>),
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          constraintName: "json_parse",
          errorType: "TYPE_ERROR",
          message: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        constraints: {},
      };
    }
  }
}

/**
 * ProtocolVersion - Version information for ATP/ACP protocols
 *
 * Enables version negotiation and backward compatibility between
 * different protocol implementations.
 */
export interface ProtocolVersion {
  /** Major version (breaking changes) */
  major: number;

  /** Minor version (backward-compatible additions) */
  minor: number;

  /** Patch version (bug fixes) */
  patch: number;

  /** Pre-release identifier (optional) */
  preRelease?: string;

  /** Build metadata (optional) */
  buildMetadata?: string;
}

/**
 * ProtocolInfo - Protocol metadata and capabilities
 *
 * Provides information about protocol version, supported features,
 * and compatibility information.
 */
export interface ProtocolInfo {
  /** Protocol name (ATP or ACP) */
  protocol: "ATP" | "ACP";

  /** Protocol version */
  version: ProtocolVersion;

  /** Supported features */
  features: {
    /** Whether constraints are supported */
    constraints: boolean;
    /** Whether embeddings are supported */
    embeddings: boolean;
    /** Whether streaming is supported */
    streaming: boolean;
    /** Whether caching is supported */
    caching: boolean;
    /** Whether privacy features are supported */
    privacy: boolean;
    /** Whether hardware constraints are supported */
    hardware: boolean;
  };

  /** Minimum compatible version */
  minCompatibleVersion: ProtocolVersion;

  /** Maximum compatible version */
  maxCompatibleVersion: ProtocolVersion;

  /** Protocol documentation URL */
  documentationUrl: string;

  /** Protocol specification URL */
  specificationUrl: string;
}

/**
 * IntentionPlane configuration
 *
 * Configuration for the IntentionPlane which handles query routing
 * and execution with privacy-preserving intent encoding.
 */
export interface IntentionPlaneConfig {
  /** Optional router instance for custom routing logic */
  router?: any;

  /** Enable reasoning mode */
  enableReasoning?: boolean;

  /** Intent encoder configuration */
  intentEncoder?: {
    /** Output dimensions for intent vectors (default: 768) */
    dimensions?: number;
    /** Model to use for embeddings (default: text-embedding-3-small) */
    model?: string;
    /** Provider for embeddings (openai, ollama, hash) */
    provider?: string;
    /** Enable fallback to hash-based embeddings */
    fallback?: boolean;
    /** ε value for differential privacy */
    epsilon?: number;
  };

  /** Local inference configuration */
  localInference?: {
    enabled?: boolean;
    defaultModel?: string;
    endpoint?: string;
    timeout?: number;
    maxRetries?: number;
  };

  /** Cloud fallback configuration */
  cloudFallback?: {
    enabled?: boolean;
    apiKey?: string;
    baseURL?: string;
    model?: string;
  };
}

/**
 * Audit event types for privacy logging
 */
export type AuditEventType =
  | "query_blocked"
  | "query_redacted"
  | "query_allowed"
  | "pii_detected"
  | "classification_change"
  | "rule_modified"
  | "firewall_evaluated";

/**
 * Firewall decision interface
 */
export interface FirewallDecision {
  /** Action taken: allow, deny, redact, redirect */
  action: "allow" | "deny" | "redact" | "redirect";
  /** Rules that matched this decision */
  matchedRules: string[];
  /** Confidence in this decision (0-1) */
  confidence: number;
}

/**
 * Privacy audit event for compliance logging
 */
export interface PrivacyAuditEvent {
  /** Unix timestamp (ms) when event occurred */
  timestamp: number;
  /** Type of event */
  eventType:
    | "query_blocked"
    | "query_redacted"
    | "query_allowed"
    | "pii_detected"
    | "classification_change"
    | "rule_modified"
    | "firewall_evaluated";
  /** Query text (SHA-256 hashed for privacy) */
  queryHash: string;
  /** Original query length (for analysis) */
  queryLength: number;
  /** Privacy classification */
  classification?: PrivacyClassification;
  /** PII types detected */
  piiDetected?: PIIType[];
  /** Firewall decision */
  decision: FirewallDecision;
  /** Final destination */
  destination: "local" | "cloud";
  /** User ID (SHA-256 hashed for privacy) */
  userIdHash?: string;
  /** Session identifier */
  sessionId: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// ZERO KNOWLEDGE PROOF TYPES (For Privacy Verification)
// ============================================================================

/**
 * ZKP security levels
 */
export type ZKPSecurityLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

/**
 * Proof generator configuration
 */
export interface ProofGeneratorConfig {
  /** Security level for proof generation */
  securityLevel?: ZKPSecurityLevel;
  /** Hash function to use */
  hashFunction?: "SHA256" | "SHA384" | "SHA512" | "BLAKE2B" | "BLAKE3";
  /** Include metadata in proofs */
  includeMetadata?: boolean;
  /** Compress proof output */
  compressProof?: boolean;
  /** Generation timeout in milliseconds */
  timeout?: number;
  /** Maximum proof age in milliseconds */
  maxProofAgeMs?: number;
  /** Prover identifier */
  proverId?: string;
}

/**
 * Proof verifier configuration
 */
export interface ProofVerifierConfig {
  /** Enable result caching */
  enableCaching?: boolean;
  /** Enable batch verification */
  enableBatchVerification?: boolean;
  /** Verify commitments */
  verifyCommitments?: boolean;
  /** Check proof expiration */
  checkExpiration?: boolean;
  /** Strict mode (all constraints must be verifiable) */
  strictMode?: boolean;
  /** Verification timeout in milliseconds */
  timeout?: number;
  /** Maximum proof age in milliseconds */
  maxProofAgeMs?: number;
  /** Hash function to use */
  hashFunction?: "SHA256" | "SHA384" | "SHA512" | "BLAKE2B" | "BLAKE3";
}

/**
 * ZKP proof interface
 */
export interface ZKPProof<T = Record<string, unknown>> {
  /** Proof ID */
  id: string;
  /** Proof type */
  type: string;
  /** Public inputs (do not reveal secrets) */
  publicInputs: T;
  /** Proof data ( cryptographic proof) */
  proofData: string;
  /** Verification key */
  verificationKey: string;
  /** Timestamp */
  timestamp: number;
  /** Expiration time */
  expiresAt?: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * ZKP verification result
 */
export interface ZKPVerificationResult {
  /** Whether verification succeeded */
  valid: boolean;
  /** Verification timestamp */
  timestamp: number;
  /** Verification duration (ms) */
  duration: number;
  /** Error message (if verification failed) */
  error?: string;
  /** Warnings */
  warnings?: string[];
}

// ============================================================================
// LIBCOGNITIVE API TYPES (Core 4-Primitive Types)
// ============================================================================

/**
 * ATPResponse - Response type for ATP (Autonomous Task Processing) requests
 *
 * Type alias to AequorResponse for ATP protocol responses.
 */
export type ATPResponse = AequorResponse;

/**
 * ACPResponse - Response type for ACP (Assisted Collaborative Processing) requests
 *
 * Type alias to AequorResponse for ACP protocol responses.
 */
export type ACPResponse = AequorResponse;

/**
 * Meaning - The result of transducing raw data into semantic understanding
 *
 * This is the first primitive of the libcognitive API: Data → Meaning
 * Represents parsed, classified, and embedded understanding of input.
 */
export interface Meaning {
  /** Unique identifier for this meaning */
  id: string;
  /** Semantic embedding (768-dim vector) */
  embedding: number[];
  /** Complexity score (0-1) */
  complexity: number;
  /** Intent category */
  intent: IntentCategory;
  /** Query type classification */
  type: string;
  /** Timestamp when meaning was created */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Context - Retrieved relevant information for a meaning
 *
 * This is the second primitive of the libcognitive API: Meaning → Context
 * Represents the context retrieved from memory and knowledge bases.
 */
export interface Context {
  /** Unique identifier for this context */
  id: string;
  /** Associated meaning */
  meaningId: string;
  /** Retrieved knowledge items */
  knowledge: ContextItem[];
  /** Similar queries */
  similarQueries?: SimilarQuery[];
  /** Confidence in context relevance (0-1) */
  confidence: number;
  /** Timestamp when context was retrieved */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Context item - Single piece of retrieved knowledge
 */
export interface ContextItem {
  /** Content */
  content: string;
  /** Source */
  source: string;
  /** Relevance score */
  relevance: number;
  /** Type */
  type: string;
}

/**
 * Similar query - Previous similar query
 */
export interface SimilarQuery {
  /** Query text */
  query: string;
  /** Similarity score */
  similarity: number;
  /** Response from that query */
  response?: string;
}

/**
 * Thought - The result of cogitating on meaning with context
 *
 * This is the third primitive of the libcognitive API: Meaning + Context → Thought
 * Represents reasoning, generation, and decision-making output.
 */
export interface Thought {
  /** Unique identifier for this thought */
  id: string;
  /** Generated response */
  response: string;
  /** Confidence in the thought (0-1) */
  confidence: number;
  /** Reasoning process (optional) */
  reasoning?: string;
  /** Model that generated the thought */
  model: string;
  /** Backend used */
  backend: "local" | "cloud" | "hybrid";
  /** Processing latency in milliseconds */
  latency: number;
  /** Timestamp when thought was created */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Action - The result of effecting a thought into executable output
 *
 * This is the fourth primitive of the libcognitive API: Thought → Action
 * Represents formatted, presentable, or executable output.
 */
export interface Action {
  /** Unique identifier for this action */
  id: string;
  /** Associated thought */
  thoughtId: string;
  /** Action type */
  type: "display" | "execute" | "format" | "store";
  /** Formatted output */
  output: string;
  /** Execution result (if applicable) */
  result?: unknown;
  /** Timestamp when action was effected */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// QUERY CONSTRAINTS
// ============================================================================

/**
 * QueryConstraints - Unified constraint specification for queries
 *
 * Collects all constraints (privacy, budget, thermal, latency, etc.) into
 * a single structure for constraint algebra optimization.
 */
export interface QueryConstraints {
  /** Privacy constraints */
  privacy?: PrivacyConstraint;
  /** Budget constraints */
  budget?: BudgetConstraint;
  /** Performance constraints */
  performance?: PerformanceConstraint;
  /** Thermal/power constraints */
  thermal?: ThermalConstraint;
  /** Quality constraints */
  quality?: QualityConstraint;
  /** Custom constraints */
  custom?: Record<string, ConstraintValue>;
}

/**
 * Privacy constraint
 */
export interface PrivacyConstraint {
  /** Minimum privacy level */
  minLevel: number;
  /** Allowed data redaction */
  allowRedaction: boolean;
  /** Require local-only processing */
  localOnly?: boolean;
}

/**
 * Budget constraint
 */
export interface BudgetConstraint {
  /** Maximum cost in USD */
  maxCost: number;
  /** Cost per request limit */
  maxCostPerRequest?: number;
}

/**
 * Performance constraint
 */
export interface PerformanceConstraint {
  /** Maximum latency in milliseconds */
  maxLatency: number;
  /** Minimum throughput (queries/second) */
  minThroughput?: number;
}

/**
 * Thermal constraint
 */
export interface ThermalConstraint {
  /** Maximum temperature (Celsius) */
  maxTemperature: number;
  /** Maximum power usage (Watts) */
  maxPower?: number;
}

/**
 * Quality constraint
 */
export interface QualityConstraint {
  /** Minimum quality score (0-1) */
  minQuality: number;
  /** Minimum confidence (0-1) */
  minConfidence?: number;
}

/**
 * Constraint value type
 */
export type ConstraintValue = number | string | boolean | number[];
