/**
 * @fileoverview Fallback Strategy Types for Intelligent Routing
 *
 * This module defines types and interfaces for implementing intelligent
 * fallback logic when primary models fail or are unavailable.
 *
 * Fallback strategies enable the system to:
 * - Gracefully degrade when cloud models fail
 * - Use local models as backup
 * - Implement circuit breaker patterns
 * - Handle rate limiting and timeouts
 * - Respect cost thresholds
 *
 * @module @lsi/protocol/fallback
 */

// ============================================================================
// FALLBACK TRIGGER TYPES
// ============================================================================

/**
 * Reasons that can trigger a fallback
 */
export type FallbackTrigger =
  | "timeout"
  | "rate_limit"
  | "server_error"
  | "client_error"
  | "network_error"
  | "cost_threshold"
  | "model_unavailable"
  | "authentication_error"
  | "unknown"
  | "none"
  | "max_depth_exceeded";

/**
 * HTTP status codes that trigger fallback
 */
export interface FallbackHTTPStatus {
  /** HTTP status code */
  status: number;
  /** Whether this status triggers fallback */
  triggersFallback: boolean;
  /** Fallback reason for this status */
  reason: FallbackTrigger;
}

/**
 * Error classification for fallback decisions
 */
export interface FallbackErrorClassification {
  /** The error that occurred */
  error: Error;
  /** Whether this error triggers fallback */
  shouldFallback: boolean;
  /** Fallback trigger reason */
  trigger: FallbackTrigger;
  /** Whether to retry before falling back */
  retry: boolean;
  /** Suggested delay before retry (ms) */
  retryDelay?: number;
}

// ============================================================================
// FALLBACK STRATEGY TYPES
// ============================================================================

/**
 * Fallback strategy type
 */
export type FallbackStrategyType =
  | "immediate"
  | "delayed"
  | "conditional"
  | "circuit_breaker"
  | "adaptive";

/**
 * Base fallback strategy configuration
 */
export interface FallbackStrategyConfig {
  /** Strategy type */
  type: FallbackStrategyType;
  /** Target backend when fallback triggers */
  targetBackend: "local" | "cloud" | "hybrid";
  /** Maximum number of fallback attempts */
  maxAttempts?: number;
  /** Delay before fallback (ms) */
  fallbackDelay?: number;
  /** Enable fallback on timeout */
  onTimeout?: boolean;
  /** Enable fallback on rate limit */
  onRateLimit?: boolean;
  /** Enable fallback on server errors (5xx) */
  onServerError?: boolean;
  /** Enable fallback on client errors (4xx) */
  onClientError?: boolean;
  /** Enable fallback on network errors */
  onNetworkError?: boolean;
  /** Enable fallback when cost threshold exceeded */
  onCostThreshold?: boolean;
  /** Cost threshold that triggers fallback (USD) */
  costThreshold?: number;
  /** Custom fallback condition */
  customCondition?: (error: Error) => boolean;
}

/**
 * Immediate fallback strategy
 * Falls back immediately when a trigger occurs
 */
export interface ImmediateFallbackStrategy extends FallbackStrategyConfig {
  type: "immediate";
  /** No additional configuration */
}

/**
 * Delayed fallback strategy
 * Waits for specified delay before falling back
 */
export interface DelayedFallbackStrategy extends FallbackStrategyConfig {
  type: "delayed";
  /** Delay before fallback (ms) - required for delayed */
  fallbackDelay: number;
  /** Whether to attempt retries during delay */
  retryDuringDelay?: boolean;
}

/**
 * Conditional fallback strategy
 * Falls back only when specific conditions are met
 */
export interface ConditionalFallbackStrategy extends FallbackStrategyConfig {
  type: "conditional";
  /** Conditions that must be met for fallback */
  conditions: FallbackCondition[];
  /** Whether all conditions must be met (AND) or any (OR) */
  conditionLogic: "all" | "any";
}

/**
 * Circuit breaker fallback strategy
 * Uses circuit breaker pattern for fallback
 */
export interface CircuitBreakerFallbackStrategy extends FallbackStrategyConfig {
  type: "circuit_breaker";
  /** Circuit breaker configuration */
  circuitBreaker: {
    /** Number of consecutive failures before opening */
    failureThreshold: number;
    /** Time to wait before attempting recovery (ms) */
    recoveryTimeout: number;
    /** Number of attempts in half-open state */
    halfOpenAttempts: number;
    /** Success threshold to close circuit */
    successThreshold: number;
  };
}

/**
 * Adaptive fallback strategy
 * Adapts fallback behavior based on historical performance
 */
export interface AdaptiveFallbackStrategy extends FallbackStrategyConfig {
  type: "adaptive";
  /** Learning window size (number of requests) */
  learningWindow: number;
  /** Success rate threshold (0-1) */
  successRateThreshold: number;
  /** Minimum samples before adapting */
  minSamples: number;
}

/**
 * Fallback condition
 */
export interface FallbackCondition {
  /** Condition type */
  type: FallbackTrigger;
  /** Threshold value (if applicable) */
  threshold?: number;
  /** Comparison operator */
  operator?: ">" | ">=" | "<" | "<=" | "==" | "!=";
}

/**
 * Union type of all fallback strategies
 */
export type FallbackStrategy =
  | ImmediateFallbackStrategy
  | DelayedFallbackStrategy
  | ConditionalFallbackStrategy
  | CircuitBreakerFallbackStrategy
  | AdaptiveFallbackStrategy;

// ============================================================================
// FALLBACK RESULT TYPES
// ============================================================================

/**
 * Fallback execution result
 */
export interface FallbackResult {
  /** Whether fallback was triggered */
  triggered: boolean;
  /** Original route before fallback */
  originalRoute: "local" | "cloud" | "hybrid";
  /** Final route after fallback */
  finalRoute: "local" | "cloud" | "hybrid";
  /** Fallback trigger reason */
  trigger?: FallbackTrigger;
  /** Number of attempts made */
  attempts: number;
  /** Time spent on fallback (ms) */
  fallbackTime: number;
  /** Whether fallback was successful */
  success: boolean;
  /** Error if fallback failed */
  error?: Error;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Fallback decision
 */
export interface FallbackDecision {
  /** Whether to trigger fallback */
  shouldFallback: boolean;
  /** Target route for fallback */
  targetRoute: "local" | "cloud" | "hybrid";
  /** Reason for fallback decision */
  reason: FallbackTrigger | "none";
  /** Confidence in decision (0-1) */
  confidence: number;
  /** Estimated success rate of fallback (0-1) */
  estimatedSuccessRate: number;
  /** Recommended delay before fallback (ms) */
  recommendedDelay?: number;
}

// ============================================================================
// FALLBACK MANAGER TYPES
// ============================================================================

/**
 * Fallback manager configuration
 */
export interface FallbackManagerConfig {
  /** Default fallback strategy */
  defaultStrategy: FallbackStrategy;
  /** Per-route fallback strategies */
  routeStrategies?: Partial<
    Record<"local" | "cloud" | "hybrid", FallbackStrategy>
  >;
  /** Enable adaptive learning */
  enableAdaptive?: boolean;
  /** Enable fallback metrics */
  enableMetrics?: boolean;
  /** Maximum fallback depth (prevent infinite fallback loops) */
  maxFallbackDepth?: number;
}

/**
 * Fallback metrics
 */
export interface FallbackMetrics {
  /** Total fallback triggers */
  totalTriggers: number;
  /** Triggers by type */
  triggersByType: Partial<Record<FallbackTrigger, number>>;
  /** Successful fallbacks */
  successfulFallbacks: number;
  /** Failed fallbacks */
  failedFallbacks: number;
  /** Average fallback time (ms) */
  averageFallbackTime: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Last fallback time */
  lastFallbackTime?: number;
  /** Fallback history (recent) */
  recentFallbacks: FallbackResult[];
}

/**
 * Fallback state
 */
export interface FallbackState {
  /** Current route */
  currentRoute: "local" | "cloud" | "hybrid";
  /** Original route (before any fallbacks) */
  originalRoute: "local" | "cloud" | "hybrid";
  /** Fallback depth (number of fallbacks in chain) */
  fallbackDepth: number;
  /** Active fallback strategy */
  activeStrategy: FallbackStrategy;
  /** Whether circuit is open (for circuit breaker strategy) */
  circuitOpen: boolean;
  /** Historical performance data */
  performanceHistory: Array<{
    route: "local" | "cloud" | "hybrid";
    success: boolean;
    latency: number;
    cost: number;
    timestamp: number;
  }>;
}

// ============================================================================
// ROUTING WITH FALLBACK TYPES
// ============================================================================

/**
 * Extended route decision with fallback information
 */
export interface RouteDecisionWithFallback {
  /** Primary route decision */
  route: "local" | "cloud" | "hybrid";
  /** Confidence in this decision (0-1) */
  confidence: number;
  /** Estimated latency in milliseconds */
  estimatedLatency: number;
  /** Estimated cost */
  estimatedCost: number;
  /** Fallback strategy for this route */
  fallbackStrategy?: FallbackStrategy;
  /** Fallback decision (if fallback should be considered) */
  fallbackDecision?: FallbackDecision;
  /** Whether fallback is available */
  fallbackAvailable: boolean;
  /** Fallback trigger conditions */
  fallbackTriggers: FallbackTrigger[];
  /** Additional notes */
  notes?: string[];
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * HTTP error classification
 */
export interface HTTPError extends Error {
  /** HTTP status code */
  status?: number;
  /** Response headers */
  headers?: Record<string, string>;
  /** Request URL */
  url?: string;
  /** Request method */
  method?: string;
}

/**
 * Timeout error classification
 */
export interface TimeoutError extends Error {
  /** Timeout duration (ms) */
  timeout?: number;
  /** Operation that timed out */
  operation?: string;
}

/**
 * Rate limit error classification
 */
export interface RateLimitError extends Error {
  /** Rate limit retry-after header value (seconds) */
  retryAfter?: number;
  /** Rate limit limit */
  limit?: number;
  /** Rate limit remaining */
  remaining?: number;
}

/**
 * Type guards for error classification
 */
export function isHTTPError(error: Error): error is HTTPError {
  return "status" in error;
}

export function isTimeoutError(error: Error): error is TimeoutError {
  return error.name === "TimeoutError" || "timeout" in error;
}

export function isRateLimitError(error: Error): error is RateLimitError {
  return (
    error.name === "RateLimitError" ||
    ("status" in error && (error as HTTPError).status === 429)
  );
}

/**
 * Classify error for fallback decision
 */
export function classifyError(error: Error): FallbackErrorClassification {
  // Rate limit errors
  if (isRateLimitError(error)) {
    return {
      error,
      shouldFallback: true,
      trigger: "rate_limit",
      retry: true,
      retryDelay: (error as RateLimitError).retryAfter
        ? (error as RateLimitError).retryAfter! * 1000
        : 60000,
    };
  }

  // Timeout errors
  if (isTimeoutError(error)) {
    return {
      error,
      shouldFallback: true,
      trigger: "timeout",
      retry: false,
    };
  }

  // HTTP errors
  if (isHTTPError(error)) {
    const status = (error as HTTPError).status!;
    if (status >= 500) {
      return {
        error,
        shouldFallback: true,
        trigger: "server_error",
        retry: true,
        retryDelay: 1000,
      };
    } else if (status >= 400 && status < 500) {
      // Client errors - generally don't fallback
      // Exception: 408 Request Timeout, 429 Too Many Requests
      if (status === 408 || status === 429) {
        return {
          error,
          shouldFallback: true,
          trigger: status === 429 ? "rate_limit" : "timeout",
          retry: true,
          retryDelay: 5000,
        };
      }
      return {
        error,
        shouldFallback: false,
        trigger: "client_error",
        retry: false,
      };
    }
  }

  // Network errors (usually ECONNREFUSED, ENOTFOUND, etc.)
  if (
    error.name === "ECONNREFUSED" ||
    error.name === "ENOTFOUND" ||
    error.name === "ECONNRESET" ||
    error.name === "ETIMEDOUT" ||
    error.message.includes("network") ||
    error.message.includes("connect")
  ) {
    return {
      error,
      shouldFallback: true,
      trigger: "network_error",
      retry: true,
      retryDelay: 2000,
    };
  }

  // Unknown errors
  return {
    error,
    shouldFallback: false,
    trigger: "unknown",
    retry: false,
  };
}

/**
 * Create a default fallback strategy
 */
export function createDefaultFallbackStrategy(): FallbackStrategy {
  return {
    type: "circuit_breaker",
    targetBackend: "local",
    maxAttempts: 3,
    onTimeout: true,
    onRateLimit: true,
    onServerError: true,
    onNetworkError: true,
    onCostThreshold: false,
    circuitBreaker: {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenAttempts: 3,
      successThreshold: 2,
    },
  };
}

/**
 * Create an immediate fallback strategy
 */
export function createImmediateFallbackStrategy(
  targetBackend: "local" | "cloud" | "hybrid" = "local"
): ImmediateFallbackStrategy {
  return {
    type: "immediate",
    targetBackend,
    onTimeout: true,
    onRateLimit: true,
    onServerError: true,
    onNetworkError: true,
  };
}

/**
 * Create a delayed fallback strategy
 */
export function createDelayedFallbackStrategy(
  targetBackend: "local" | "cloud" | "hybrid" = "local",
  fallbackDelay: number = 1000
): DelayedFallbackStrategy {
  return {
    type: "delayed",
    targetBackend,
    fallbackDelay,
    onTimeout: true,
    onRateLimit: true,
    onServerError: true,
    onNetworkError: true,
  };
}

/**
 * Create a circuit breaker fallback strategy
 */
export function createCircuitBreakerFallbackStrategy(
  targetBackend: "local" | "cloud" | "hybrid" = "local",
  circuitBreaker?: CircuitBreakerFallbackStrategy["circuitBreaker"]
): CircuitBreakerFallbackStrategy {
  return {
    type: "circuit_breaker",
    targetBackend,
    circuitBreaker: circuitBreaker || {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      halfOpenAttempts: 3,
      successThreshold: 2,
    },
    onTimeout: true,
    onRateLimit: true,
    onServerError: true,
    onNetworkError: true,
  };
}

/**
 * Create an adaptive fallback strategy
 */
export function createAdaptiveFallbackStrategy(
  targetBackend: "local" | "cloud" | "hybrid" = "local",
  learningWindow: number = 100,
  successRateThreshold: number = 0.8
): AdaptiveFallbackStrategy {
  return {
    type: "adaptive",
    targetBackend,
    learningWindow,
    successRateThreshold,
    minSamples: 10,
    onTimeout: true,
    onRateLimit: true,
    onServerError: true,
    onNetworkError: true,
  };
}
