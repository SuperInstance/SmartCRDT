/**
 * @file types.ts - Core type definitions for error handling and recovery
 * @package @lsi/langgraph-errors
 */

/**
 * Error severity levels
 */
export type ErrorSeverity = "info" | "warning" | "error" | "critical" | "fatal";

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | "validation"
  | "execution"
  | "timeout"
  | "resource"
  | "network"
  | "authentication"
  | "authorization"
  | "rate_limit"
  | "dependency"
  | "unknown";

/**
 * Recovery strategies
 */
export type RecoveryStrategy =
  | "retry"
  | "fallback"
  | "skip"
  | "abort"
  | "custom";

/**
 * Circuit breaker states
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Core agent error structure
 */
export interface AgentError {
  /** Unique error identifier */
  error_id: string;
  /** Agent that encountered the error */
  agent_id: string;
  /** Error severity level */
  severity: ErrorSeverity;
  /** Error category */
  category: ErrorCategory;
  /** Human-readable error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Additional error context */
  context: Record<string, unknown>;
  /** Timestamp of error occurrence */
  timestamp: number;
  /** Suggested recovery strategy */
  recovery_strategy?: RecoveryStrategy;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Number of retry attempts made */
  retry_count: number;
  /** Original error that caused this error */
  cause?: Error;
  /** Request/input that caused the error */
  input?: unknown;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error policy configuration
 */
export interface ErrorPolicy {
  /** Maximum number of retry attempts */
  max_retries: number;
  /** Fallback agent to use on failure */
  fallback_agent?: string;
  /** Timeout in milliseconds */
  timeout: number;
  /** Whether to escalate to human */
  escalate_on_failure?: boolean;
  /** Custom recovery handler */
  custom_recovery?: (error: AgentError) => Promise<unknown>;
  /** Recovery strategy preference */
  recovery_strategy?: RecoveryStrategy;
  /** Whether to use circuit breaker */
  use_circuit_breaker?: boolean;
  /** Circuit breaker failure threshold */
  circuit_breaker_threshold?: number;
  /** Circuit breaker reset timeout (ms) */
  circuit_breaker_reset_timeout?: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  max_attempts: number;
  /** Initial delay in milliseconds */
  initial_delay: number;
  /** Maximum delay in milliseconds */
  max_delay?: number;
  /** Backoff multiplier for exponential backoff */
  backoff_multiplier?: number;
  /** Jitter factor for randomized delays (0-1) */
  jitter_factor?: number;
  /** Retry condition function */
  retry_condition?: (error: AgentError) => boolean;
  /** Backoff strategy */
  strategy: "fixed" | "exponential" | "linear" | "jitter";
}

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  /** Chain of fallback agent IDs */
  fallback_chain: string[];
  /** Default result to return if all fallbacks fail */
  default_result?: unknown;
  /** Whether to use cached results */
  use_cache: boolean;
  /** Cache TTL for fallback results (ms) */
  cache_ttl?: number;
  /** Validate fallback results */
  validate_result?: (result: unknown) => boolean;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failure_threshold: number;
  /** Time in milliseconds before attempting recovery */
  reset_timeout: number;
  /** Number of successful attempts to close circuit in half-open state */
  success_threshold: number;
  /** Time window for failure counting (ms) */
  monitoring_window?: number;
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  /** Current circuit state */
  state: CircuitState;
  /** Number of consecutive failures */
  failure_count: number;
  /** Number of consecutive successes */
  success_count: number;
  /** Last failure timestamp */
  last_failure_time?: number;
  /** Last state change timestamp */
  last_state_change: number;
  /** Total request count */
  total_requests: number;
  /** Total failure count */
  total_failures: number;
}

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  /** Global timeout in milliseconds */
  global_timeout: number;
  /** Per-agent timeout overrides */
  agent_timeouts: Record<string, number>;
  /** Whether to escalate on timeout */
  escalate_on_timeout: boolean;
  /** Escalation timeout in milliseconds */
  escalation_timeout?: number;
}

/**
 * Recovery action result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovery strategy used */
  strategy: RecoveryStrategy;
  /** Recovered result */
  result?: unknown;
  /** Error if recovery failed */
  error?: AgentError;
  /** Time taken for recovery (ms) */
  recovery_time: number;
  /** Number of attempts made */
  attempts: number;
}

/**
 * Error statistics
 */
export interface ErrorStatistics {
  /** Total error count */
  total_errors: number;
  /** Error count by severity */
  errors_by_severity: Record<ErrorSeverity, number>;
  /** Error count by category */
  errors_by_category: Record<ErrorCategory, number>;
  /** Error count by agent */
  errors_by_agent: Record<string, number>;
  /** Recovery success rate */
  recovery_success_rate: number;
  /** Average recovery time (ms) */
  avg_recovery_time: number;
  /** Most common errors */
  common_errors: Array<{ message: string; count: number }>;
  /** Error rate (errors per minute) */
  error_rate: number;
}

/**
 * Dead letter queue entry
 */
export interface DeadLetterEntry<T = unknown> {
  /** Unique entry identifier */
  id: string;
  /** Original task/input */
  task: T;
  /** Error that caused failure */
  error: AgentError;
  /** Timestamp of failure */
  timestamp: number;
  /** Number of retry attempts */
  retry_count: number;
  /** Maximum retry attempts allowed */
  max_retries: number;
  /** Whether entry has been archived */
  archived: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Default error policy */
  default_policy?: ErrorPolicy;
  /** Whether to enable error logging */
  enable_logging?: boolean;
  /** Whether to enable error analytics */
  enable_analytics?: boolean;
  /** Whether to enable dead letter queue */
  enable_dead_letter_queue?: boolean;
  /** Maximum size of dead letter queue */
  max_dead_letter_queue_size?: number;
  /** Custom error classifiers */
  custom_classifiers?: Array<(error: Error) => ErrorCategory | null>;
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Whether error is retryable */
  retryable: boolean;
  /** Suggested recovery strategy */
  recovery_strategy: RecoveryStrategy;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Error context enrichment
 */
export interface ErrorContext {
  /** Agent state */
  agent_state?: Record<string, unknown>;
  /** Environment context */
  environment?: Record<string, unknown>;
  /** Request context */
  request?: Record<string, unknown>;
  /** Session context */
  session?: Record<string, unknown>;
  /** Custom context */
  custom?: Record<string, unknown>;
}
