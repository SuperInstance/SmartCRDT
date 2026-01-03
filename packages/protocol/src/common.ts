/**
 * @fileoverview Common Base Types for Aequor Platform
 *
 * This module provides foundational type abstractions used across all packages.
 * These base types eliminate duplication and ensure consistency in:
 * - Configuration objects
 * - Result/Response patterns
 * - Request/Response patterns
 * - State management
 * - Event handling
 * - Status tracking
 *
 * @module @lsi/protocol/common
 */

import type { PrivacyClassification, IntentVector } from "./atp-acp.js";
import type { ShadowLogEntry } from "./integration.js";
import type { EvidencePacket } from "./hypothesis.js";

// ============================================================================
// BASE CONFIG PATTERNS
// ============================================================================

/**
 * Base configuration interface with common fields
 *
 * Most configuration objects need timeout, retry, and logging controls.
 * Extend this interface to avoid duplicating these fields.
 *
 * @example
 * ```typescript
 * interface MyServiceConfig extends BaseConfig {
 *   apiUrl: string;
 *   maxConnections: number;
 * }
 * ```
 */
export interface BaseConfig {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts for failed operations */
  retries?: number;
  /** Logging configuration */
  logging?: LoggingConfig;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Log level */
  level?: "debug" | "info" | "warn" | "error" | "silent";
  /** Enable/disable logging */
  enabled?: boolean;
  /** Log format */
  format?: "json" | "text";
  /** Include timestamps */
  timestamps?: boolean;
}

/**
 * Network configuration for API-based services
 */
export interface NetworkConfig {
  /** Base URL for API */
  baseURL?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** API key for authentication */
  apiKey?: string;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Enable/disable caching */
  enabled?: boolean;
  /** Cache TTL in milliseconds */
  ttl?: number;
  /** Maximum cache size (entries) */
  maxSize?: number;
  /** Eviction policy */
  evictionPolicy?: "lru" | "fifo" | "lfu";
}

/**
 * Service configuration combining common config patterns
 */
export interface ServiceConfig
  extends NetworkConfig, CacheConfig, LoggingConfig {
  /** Service name */
  name?: string;
  /** Service version */
  version?: string;
  /** Enable/disable service */
  enabled?: boolean;
}

// ============================================================================
// BASE RESULT PATTERNS
// ============================================================================

/**
 * Base result type for operation outcomes
 *
 * @template T - Type of data contained in successful result
 */
export interface BaseResult<T = unknown> {
  /** Whether operation succeeded */
  success: boolean;
  /** Result data (if successful) */
  data?: T;
  /** Error (if failed) */
  error?: Error | string;
  /** Operation timestamp */
  timestamp: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result with request tracking
 *
 * @template T - Type of data contained in successful result
 */
export interface ResultWithRequest<T = unknown> extends BaseResult<T> {
  /** Request ID */
  requestId: string;
}

/**
 * Paginated result
 *
 * @template T - Type of items in the result
 */
export interface PaginatedResult<T = unknown> extends BaseResult<T[]> {
  /** Current page (0-indexed) */
  page: number;
  /** Page size */
  pageSize: number;
  /** Total items */
  total: number;
  /** Total pages */
  totalPages: number;
  /** Whether there's a next page */
  hasNext: boolean;
  /** Whether there's a previous page */
  hasPrevious: boolean;
}

// ============================================================================
// BASE REQUEST/RESPONSE PATTERNS
// ============================================================================

/**
 * Base request interface
 *
 * @template T - Type of payload data
 */
export interface BaseRequest<T = unknown> {
  /** Request ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Request payload */
  payload?: T;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Base response interface
 *
 * @template T - Type of response data
 */
export interface BaseResponse<T = unknown> extends BaseResult<T> {
  /** Request ID */
  requestId: string;
  /** Response timestamp */
  timestamp: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Whether response was from cache */
  fromCache?: boolean;
}

/**
 * Adapter interface for request/response handlers
 *
 * @template TRequest - Request type
 * @template TResponse - Response type
 */
export interface Adapter<
  TRequest extends BaseRequest,
  TResponse extends BaseResponse,
> {
  /** Adapter name */
  readonly name: string;
  /** Execute request and get response */
  execute(request: TRequest): Promise<TResponse>;
  /** Health check */
  healthCheck(): Promise<HealthCheckResult>;
}

// ============================================================================
// STATUS TYPES
// ============================================================================

/**
 * Common status levels
 */
export type StatusLevel = "idle" | "active" | "busy" | "error" | "offline";

/**
 * Status information
 */
export interface StatusInfo {
  /** Current status level */
  status: StatusLevel;
  /** Status message */
  message?: string;
  /** Progress (0-1) */
  progress?: number;
  /** Timestamp */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// PATTERN ANALYSIS TYPES
// ============================================================================

/**
 * Data point for evidence collection
 */
export interface DataPoint {
  /** Data point ID */
  id: string;
  /** Data point type */
  type: string;
  /** Data point value */
  value: number | string;
  /** Data point timestamp */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Pattern analysis result for shadow log processing
 */
export interface PatternAnalysis {
  /** Pattern type */
  type: PatternType;
  /** Pattern identifier */
  id: string;
  /** Pattern strength/confidence */
  confidence: number;
  /** Pattern description */
  description: string;
  /** Related pattern IDs */
  related: string[];
  /** Evidence packets supporting this pattern */
  evidence: EvidencePacket[];
  /** Support count */
  support: number;
  /** Latency improvement (0-1) */
  latencyImprovement?: number;
  /** Cost improvement (0-1) */
  costImprovement?: number;
  /** Quality impact (0-1) */
  qualityImpact?: number;
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Pattern types for analysis
 */
export type PatternType =
  | "query_pattern"
  | "model_performance"
  | "latency_improvement"
  | "cost_savings"
  | "error_pattern"
  | "user_satisfaction";

/**
 * Health status extends status with health information
 */
export interface HealthStatus extends StatusInfo {
  /** Whether healthy */
  healthy: boolean;
  /** Health score (0-1) */
  score?: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Health score (0-1) */
  score?: number;
  /** Status message */
  message?: string;
  /** Error if unhealthy */
  error?: string;
  /** Additional status info */
  status?: string;
  /** Timestamp */
  timestamp: number;
  /** Health check duration */
  duration?: number;
}

/**
 * Ollama-specific health check result
 *
 * Extends base HealthCheckResult with Ollama-specific metrics
 * including daemon status, model availability, memory state, and performance.
 */
export interface OllamaHealthCheckResult extends HealthCheckResult {
  /** Ollama daemon is running */
  daemonRunning: boolean;
  /** Daemon version */
  daemonVersion?: string;
  /** Available models */
  availableModels: string[];
  /** Default model is available */
  defaultModelAvailable: boolean;
  /** Default model is loaded in memory */
  defaultModelLoaded?: boolean;
  /** Model load state */
  modelLoadState?: "loaded" | "not-loaded" | "partial" | "unknown";
  /** Response time in milliseconds */
  responseTime: number;
  /** Memory usage in MB */
  memoryUsage?: number;
  /** CPU usage percentage */
  cpuUsage?: number;
  /** GPU utilization (if available) */
  gpuUtilization?: number;
  /** VRAM usage in MB (if GPU available) */
  vramUsage?: number;
  /** Number of pending requests */
  pendingRequests?: number;
  /** Overall health status */
  healthStatus: "healthy" | "degraded" | "unhealthy";
  /** Degradation reason (if applicable) */
  degradationReason?: string;
  /** Cache hit rate (0-1) */
  cacheHitRate?: number;
  /** Request queue depth */
  queueDepth?: number;
}

/**
 * Ollama health check configuration
 */
export interface OllamaHealthCheckConfig {
  /** Base URL for Ollama API */
  baseURL: string;
  /** Default model to check */
  defaultModel: string;
  /** Health check timeout in milliseconds */
  timeout: number;
  /** Cache TTL for health status in milliseconds */
  cacheTTL: number;
  /** Maximum acceptable response time in ms */
  maxResponseTime: number;
  /** Maximum acceptable memory usage in MB */
  maxMemoryUsage?: number;
  /** Maximum acceptable CPU usage percentage */
  maxCpuUsage?: number;
  /** Enable performance metrics collection */
  enablePerformanceMetrics: boolean;
  /** Enable model availability check */
  enableModelCheck: boolean;
  /** Enable memory/CPU monitoring */
  enableResourceMonitoring: boolean;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Base event interface
 */
export interface BaseEvent {
  /** Event type discriminator */
  type: string;
  /** Timestamp */
  timestamp: number;
  /** Event source */
  source: string;
  /** Event ID */
  id?: string;
  /** Correlation ID for related events */
  correlationId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseEvent {
  /** Event type is 'error' */
  type: "error";
  /** Error details */
  error: Error;
  /** Error context */
  context?: Record<string, unknown>;
  /** Stack trace */
  stack?: string;
}

/**
 * System event types
 */
export type SystemEventType =
  | "system.started"
  | "system.stopped"
  | "system.error"
  | "cache.hit"
  | "cache.miss"
  | "cache.invalidate"
  | "route.decision"
  | "checkpoint.triggered"
  | "checkpoint.approved"
  | "checkpoint.rejected";

/**
 * System event
 */
export interface SystemEvent extends BaseEvent {
  /** System event type */
  type: SystemEventType;
}

// ============================================================================
// STATE TYPES
// ============================================================================

/**
 * State snapshot with versioning
 *
 * @template T - Type of state data
 */
export interface StateSnapshot<T> {
  /** Current state */
  state: T;
  /** Timestamp */
  timestamp: number;
  /** State version */
  version: number;
  /** Previous version (if available) */
  previousVersion?: number;
}

/**
 * State transition
 *
 * @template T - Type of state data
 */
export interface StateTransition<T> {
  /** From state */
  from: T;
  /** To state */
  to: T;
  /** Transition timestamp */
  timestamp: number;
  /** Transition reason */
  reason?: string;
  /** Transition trigger */
  trigger?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

/**
 * Base options for one-time operations
 */
export interface BaseOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Abort signal */
  signal?: AbortSignal;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Query options for filtering/pagination
 */
export interface QueryOptions extends BaseOptions {
  /** Filter criteria */
  filter?: Record<string, unknown>;
  /** Sort field */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: "asc" | "desc";
  /** Pagination: page number (0-indexed) */
  page?: number;
  /** Pagination: page size */
  pageSize?: number;
  /** Fields to include */
  include?: string[];
  /** Fields to exclude */
  exclude?: string[];
}

// ============================================================================
// SPECIALIZED CONFIG TYPES (Common Patterns)
// ============================================================================

/**
 * Router configuration
 */
export interface RouterConfig extends BaseConfig {
  /** Complexity threshold (0-1) */
  complexityThreshold?: number;
  /** Confidence threshold (0-1) */
  confidenceThreshold?: number;
  /** Maximum acceptable latency (ms) */
  maxLatency?: number;
  /** Enable cost-aware routing */
  enableCostAware?: boolean;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache configuration */
  cacheConfig?: CacheConfig;
  /** Cache similarity threshold */
  cacheSimilarityThreshold?: number;
  /** Enable adaptive cache */
  enableAdaptiveCache?: boolean;
}

/**
 * Privacy configuration
 */
export interface PrivacyConfig extends BaseConfig {
  /** Enable redaction */
  enableRedaction?: boolean;
  /** Differential privacy epsilon */
  epsilon?: number;
  /** Strict mode (fail on uncertainty) */
  strictMode?: boolean;
  /** Minimum privacy level */
  minPrivacyLevel?: "public" | "sensitive" | "sovereign";
}

/**
 * Training configuration
 */
export interface TrainingConfig extends BaseConfig {
  /** Number of training epochs */
  epochs?: number;
  /** Batch size */
  batchSize?: number;
  /** Learning rate */
  learningRate?: number;
  /** Checkpoint interval (steps) */
  checkpointInterval?: number;
  /** Evaluation interval (steps) */
  evalInterval?: number;
  /** Device to train on */
  device?: "cpu" | "cuda" | "auto";
}

/**
 * Checkpoint configuration
 */
export interface CheckpointConfig extends BaseConfig {
  /** Unique checkpoint identifier */
  id: string;
  /** Checkpoint type */
  type: "confirmation" | "input" | "approval" | "correction";
  /** Message to display */
  message: string;
  /** Node that triggers checkpoint */
  nodeId: string;
  /** Timeout in milliseconds (0 = no timeout) */
  timeout?: number;
  /** Whether checkpoint is required */
  required?: boolean;
}

/**
 * Model capabilities for adapter routing
 */
export interface ModelCapabilities {
  /** Maximum tokens the model can handle */
  maxTokens: number;
  /** Supported processing modes */
  supportedModes: string[];
  /** Whether streaming is supported */
  streaming: boolean;
  /** Temperature range (0-2) */
  temperatureRange?: [number, number];
  /** Top-p range (0-1) */
  topPRange?: [number, number];
  /** Supported input formats */
  inputFormats?: string[];
}

// ============================================================================
// SPECIALIZED RESULT TYPES
// ============================================================================

/**
 * Validation result
 */
export interface ValidationResult extends BaseResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Path to invalid field */
  path?: string;
  /** Invalid value */
  value?: unknown;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Path to field */
  path?: string;
  /** Value that caused warning */
  value?: unknown;
}

/**
 * Query result (alias for ExecutionResult)
 */
export type QueryResult<T = unknown> = ExecutionResult<T> & {
  /** Confidence score for the result */
  confidence?: number;
};

/**
 * Privacy class alias
 */
export type PrivacyClass = PrivacyClassification;

/**
 * Shadow log alias
 */
export type ShadowLog = ShadowLogEntry;

/**
 * Cache entry alias
 */
export type CacheEntry<T = unknown> = {
  key: string;
  value: T;
  timestamp: number;
  ttl?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Knowledge entry alias
 */
export type KnowledgeEntryAlias = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: Float32Array;
  intent?: IntentVector;
  timestamp: number;
  source: string;
};

/**
 * Experience type for learning
 */
export interface Experience {
  /** Experience ID */
  id: string;
  /** Type of experience */
  type: "query" | "decision" | "feedback" | "observation";
  /** Content or description */
  content: unknown;
  /** Confidence score */
  confidence: number;
  /** Timestamp */
  timestamp: number;
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Hypothesis type for learning
 */
export interface Hypothesis {
  /** Hypothesis ID */
  id: string;
  /** Type of hypothesis */
  type: "optimization" | "exploration" | "validation";
  /** Hypothesis statement */
  statement: string;
  /** Evidence supporting */
  evidence: Experience[];
  /** Confidence level */
  confidence: number;
  /** Status */
  status: "pending" | "testing" | "validated" | "rejected";
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

/**
 * Training result
 */
export interface TrainingResult {
  /** Training ID */
  id: string;
  /** Model used */
  model: string;
  /** Training metrics */
  metrics: Record<string, number>;
  /** Loss values */
  lossHistory: number[];
  /** Validation accuracy */
  validationAccuracy?: number;
  /** Timestamp */
  timestamp: number;
  /** Duration */
  duration: number;
}

/**
 * Policy type
 */
export interface Policy {
  /** Policy ID */
  id: string;
  /** Policy name */
  name: string;
  /** Policy type */
  type: "routing" | "privacy" | "performance" | "security";
  /** Rules */
  rules: Rule[];
  /** Priority */
  priority: number;
  /** Status */
  status: "active" | "inactive" | "draft";
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
}

/**
 * Rule interface
 */
export interface Rule {
  /** Rule ID */
  id: string;
  /** Condition */
  condition: string;
  /** Action */
  action: string;
  /** Priority */
  priority: number;
}

/**
 * Execution result
 */
export interface ExecutionResult<T = unknown> extends BaseResult<T> {
  /** Execution time in milliseconds */
  executionTime: number;
  /** Memory used (bytes) */
  memoryUsed?: number;
  /** Execution steps */
  steps?: ExecutionStep[];
}

/**
 * Execution step
 */
export interface ExecutionStep {
  /** Step name */
  name: string;
  /** Step status */
  status: "pending" | "running" | "completed" | "failed";
  /** Step start time */
  startTime: number;
  /** Step end time */
  endTime?: number;
  /** Step duration */
  duration?: number;
  /** Step output */
  output?: unknown;
  /** Step error */
  error?: Error;
}

/**
 * Optimization result
 */
export interface OptimizationResult<T = unknown> extends BaseResult<T> {
  /** Original value */
  original: T;
  /** Optimized value */
  optimized: T;
  /** Improvement metric */
  improvement: number;
  /** Improvement percentage */
  improvementPercent?: number;
}

// ============================================================================
// SPECIALIZED STATE TYPES
// ============================================================================

/**
 * System state
 */
export interface SystemState {
  /** Current status */
  status: StatusLevel;
  /** Uptime in milliseconds */
  uptime: number;
  /** Health level */
  health: "healthy" | "degraded" | "unhealthy";
  /** Last error */
  lastError?: Error;
  /** Metrics snapshot */
  metrics?: Record<string, number>;
}

/**
 * Agent state
 */
export interface AgentState extends SystemState {
  /** Agent ID */
  agentId: string;
  /** Current task */
  currentTask?: string;
  /** Queue size */
  queueSize: number;
  /** Processed count */
  processedCount: number;
  /** Error count */
  errorCount: number;
}

/**
 * Cache state
 */
export interface CacheState {
  /** Current size (entries) */
  size: number;
  /** Maximum size */
  maxSize: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Total hits */
  hits: number;
  /** Total misses */
  misses: number;
  /** Evictions count */
  evictions: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Branded type for type-safe IDs
 *
 * @template T - Brand name
 */
export type BrandedId<T extends string> = string & { readonly __brand: T };

/**
 * Request ID type
 */
export type RequestId = BrandedId<"RequestId">;

/**
 * Create a branded ID
 */
export function createRequestId(id: string): RequestId {
  return id as RequestId;
}

/**
 * Event ID type
 */
export type EventId = BrandedId<"EventId">;

/**
 * Create an event ID
 */
export function createEventId(id: string): EventId {
  return id as EventId;
}

/**
 * Make specific fields required
 *
 * @template T - Type to modify
 * @template K - Keys to make required
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific fields optional
 *
 * @template T - Type to modify
 * @template K - Keys to make optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/**
 * Extract keys of specific type
 *
 * @template T - Type to extract from
 * @template V - Value type to match
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Deep partial type (all nested properties optional)
 *
 * @template T - Type to make partial
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * Deep required type (all nested properties required)
 *
 * @template T - Type to make required
 */
export type DeepRequired<T> = {
  [K in keyof T]-?: T[K] extends object ? DeepRequired<T[K]> : T[K];
};

// ============================================================================
// DOMAIN KNOWLEDGE TYPES
// ============================================================================

/**
 * Domain classification for knowledge organization
 *
 * Provides domain labeling and categorization for knowledge entries,
 * enabling domain-aware retrieval and specialized processing.
 */
export interface Domain {
  /** Domain identifier (unique) */
  id: string;
  /** Human-readable domain name */
  name: string;
  /** Domain description and scope */
  description: string;
  /** Confidence score (0-1) in this classification */
  confidence: number;
  /** Keywords associated with this domain */
  keywords: string[];
  /** Parent domain (for hierarchical organization) */
  parentDomain?: string;
  /** Sub-domains within this domain */
  subDomains?: string[];
  /** Domain-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Domain classification result
 *
 * Contains the detected domains for a given text with confidence scores.
 */
export interface DomainClassification {
  /** List of detected domains */
  domains: Domain[];
  /** Primary domain (highest confidence) */
  primaryDomain?: string;
  /** Classification confidence */
  confidence: number;
  /** Additional classification metadata */
  metadata?: {
    timestamp: number;
    classifierVersion: string;
    processingTime: number;
  };
}

/**
 * Knowledge entry with domain tags
 *
 * Extends basic knowledge storage with domain classification for better organization.
 */
export interface KnowledgeEntry {
  /** Knowledge key */
  key: string;
  /** Knowledge value/content */
  value: any;
  /** Domain classifications for this knowledge */
  domains?: Domain[];
  /** Timestamp when knowledge was added */
  timestamp?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONTEXT PLANE TYPES
// ============================================================================

/**
 * Represents a single import statement analysis
 */
export interface ImportStatement {
  /** Raw import statement */
  statement: string;
  /** Module being imported */
  module: string;
  /** Named imports (if any) */
  namedImports: string[];
  /** Default import (if any) */
  defaultImport?: string;
  /** Namespace imports (if any) */
  namespaceImports: string[];
  /** Import type ('import', 'require', 'dynamic-import') */
  importType: 'import' | 'require' | 'dynamic-import';
  /** Line number where import appears */
  lineNumber: number;
  /** Whether this is a relative import */
  isRelative: boolean;
  /** File extension of the imported module */
  fileExtension?: string;
}

/**
 * Represents a complete analysis of code imports
 */
export interface ImportAnalysis {
  /** Whether the input contained code imports */
  hasImports: boolean;
  /** All detected import statements */
  imports: ImportStatement[];
  /** Unique module names imported */
  modules: string[];
  /** Total count of import statements */
  totalCount: number;
  /** Count of unique modules */
  uniqueModules: number;
  /** Detected file type based on imports */
  fileType?: 'typescript' | 'javascript' | 'tsx' | 'jsx' | 'unknown';
  /** Primary domain/package inferred from imports */
  primaryDomain?: string;
  /** Dependency graph of imports */
  dependencyGraph: Record<string, string[]>;
}

/**
 * Options for import parsing
 */
export interface ImportAnalysisOptions {
  /** Include line numbers in results */
  includeLineNumbers?: boolean;
  /** Analyze dependency relationships */
  analyzeDependencies?: boolean;
  /** Detect file type based on imports */
  detectFileType?: boolean;
  /** Extract primary domain/package */
  extractPrimaryDomain?: boolean;
}

/**
 * Import parser interface for AST-based import parsing
 *
 * Defines contract for parsing TypeScript/JavaScript imports using AST.
 * Implementations can use TypeScript compiler API, Babel, or other parsers.
 */
export interface ImportParser {
  /**
   * Parse imports from source code
   *
   * @param code - Source code to parse
   * @param sourceKey - Optional identifier for the source
   * @param options - Parsing options
   * @returns Promise resolving to import analysis
   */
  parse(
    code: string,
    sourceKey?: string,
    options?: ImportAnalysisOptions
  ): Promise<ImportAnalysis>;

  /**
   * Check if parser supports a given file type
   *
   * @param fileType - File type to check
   * @returns True if parser supports this file type
   */
  supports(fileType: string): boolean;
}
