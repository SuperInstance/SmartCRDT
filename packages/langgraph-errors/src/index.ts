/**
 * @file index.ts - Main entry point for @lsi/langgraph-errors
 * @package @lsi/langgraph-errors
 */

// Core types
export type {
  ErrorSeverity,
  ErrorCategory,
  RecoveryStrategy,
  CircuitState,
  AgentError,
  ErrorPolicy,
  RetryConfig,
  FallbackConfig,
  CircuitBreakerConfig,
  CircuitBreakerState,
  TimeoutConfig,
  RecoveryResult,
  ErrorStatistics,
  DeadLetterEntry,
  ErrorHandlerOptions,
  ErrorClassification,
  ErrorContext,
} from "./types.js";

// Core classes
export { ErrorHandler, errorHandler, handleError } from "./ErrorHandler.js";
export {
  ErrorClassifier,
  errorClassifier,
  classifyError,
  classifyErrors,
} from "./ErrorClassifier.js";

// Retry
export {
  RetryManager,
  retryManager,
  retry,
  retryWithExponentialBackoff,
  retryWithLinearBackoff,
  retryWithJitter,
} from "./retry.js";

// Fallback
export {
  FallbackManager,
  fallbackManager,
  fallback,
  registerFallbackHandler,
  chainFallbacks,
} from "./fallback.js";

// Circuit breaker
export {
  CircuitBreakerManager,
  circuitBreakerManager,
  executeWithCircuitBreaker,
  getCircuitState,
} from "./circuit-breaker.js";

// Timeout
export {
  TimeoutManager,
  timeoutManager,
  withTimeout,
  withGlobalTimeout,
  Timeout,
  TimeoutError,
} from "./timeout.js";

// Dead letter queue
export {
  DeadLetterQueue,
  deadLetterQueue,
  addToDeadLetterQueue,
  retryFromDeadLetterQueue,
} from "./dead-letter.js";

// Analytics
export { ErrorAnalytics, errorAnalytics } from "./analytics.js";

// Integration
export {
  LangGraphIntegration,
  CoAgentsIntegration,
  VlJepaIntegration,
  A2UIIntegration,
  ErrorHandlingIntegration,
  errorHandlingIntegration,
  wrapLangGraphNode,
  wrapCoAgent,
  wrapVlJepaInference,
  wrapA2UIAction,
} from "./integration.js";

// Re-export types for convenience
export type { Error } from "./types.js";
