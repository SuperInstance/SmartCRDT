/**
 * @file ErrorHandler.ts - Centralized error handling and management
 * @package @lsi/langgraph-errors
 */

import { ErrorClassifier } from "./ErrorClassifier.js";
import { RetryManager } from "./retry.js";
import { FallbackManager } from "./fallback.js";
import { CircuitBreakerManager } from "./circuit-breaker.js";
import { TimeoutManager } from "./timeout.js";
import { DeadLetterQueue } from "./dead-letter.js";
import { ErrorAnalytics } from "./analytics.js";
import type {
  Error,
  AgentError,
  ErrorPolicy,
  RecoveryResult,
  ErrorHandlerOptions,
  ErrorContext,
  ErrorSeverity,
  ErrorCategory,
  RecoveryStrategy,
} from "./types.js";

/**
 * Generate unique error ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Centralized error handler
 */
export class ErrorHandler {
  private classifiers: ErrorClassifier[];
  private retryManager: RetryManager;
  private fallbackManager: FallbackManager;
  private circuitBreakerManager: CircuitBreakerManager;
  private timeoutManager: TimeoutManager;
  private deadLetterQueue: DeadLetterQueue;
  private analytics: ErrorAnalytics;
  private options: Required<ErrorHandlerOptions>;
  private errorHistory: Map<string, AgentError[]>;
  private activeErrors: Map<string, AgentError>;

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      default_policy: options.default_policy || this.getDefaultPolicy(),
      enable_logging: options.enable_logging ?? true,
      enable_analytics: options.enable_analytics ?? true,
      enable_dead_letter_queue: options.enable_dead_letter_queue ?? true,
      max_dead_letter_queue_size: options.max_dead_letter_queue_size ?? 1000,
      custom_classifiers: options.custom_classifiers || [],
    };

    // Initialize components
    this.classifiers = [new ErrorClassifier()];
    this.retryManager = new RetryManager();
    this.fallbackManager = new FallbackManager();
    this.circuitBreakerManager = new CircuitBreakerManager();
    this.timeoutManager = new TimeoutManager();
    this.deadLetterQueue = new DeadLetterQueue(
      this.options.max_dead_letter_queue_size
    );
    this.analytics = new ErrorAnalytics();
    this.errorHistory = new Map();
    this.activeErrors = new Map();

    // Register custom classifiers
    for (const classifier of this.options.custom_classifiers) {
      this.classifiers[0].registerClassifier(classifier);
    }
  }

  /**
   * Handle an error with recovery
   */
  async handleError(
    error: Error,
    agentId: string,
    context?: ErrorContext,
    policy?: ErrorPolicy
  ): Promise<RecoveryResult> {
    const startTime = Date.now();

    // Create agent error
    const agentError = await this.createAgentError(error, agentId, context);

    // Store error
    this.storeError(agentId, agentError);

    // Track in analytics
    if (this.options.enable_analytics) {
      this.analytics.trackError(agentError);
    }

    // Log error
    if (this.options.enable_logging) {
      this.logError(agentError);
    }

    // Determine recovery strategy
    const mergedPolicy = { ...this.options.default_policy, ...policy };
    const strategy = this.determineRecoveryStrategy(agentError, mergedPolicy);

    // Attempt recovery
    const result = await this.attemptRecovery(
      agentError,
      strategy,
      mergedPolicy,
      context
    );

    result.recovery_time = Date.now() - startTime;

    // Track recovery result
    if (this.options.enable_analytics) {
      this.analytics.trackRecovery(agentError, result);
    }

    return result;
  }

  /**
   * Create an agent error from a standard error
   */
  private async createAgentError(
    error: Error,
    agentId: string,
    context?: ErrorContext
  ): Promise<AgentError> {
    // Classify error
    const classification = this.classifiers[0].classify(error);

    return {
      error_id: generateErrorId(),
      agent_id: agentId,
      severity: classification.severity,
      category: classification.category,
      message: error.message,
      stack: error.stack,
      context: context || {},
      timestamp: Date.now(),
      recovery_strategy: classification.recovery_strategy,
      retryable: classification.retryable,
      retry_count: 0,
      cause: error,
    };
  }

  /**
   * Store error in history
   */
  private storeError(agentId: string, error: AgentError): void {
    if (!this.errorHistory.has(agentId)) {
      this.errorHistory.set(agentId, []);
    }
    this.errorHistory.get(agentId)!.push(error);
    this.activeErrors.set(error.error_id, error);
  }

  /**
   * Determine recovery strategy
   */
  private determineRecoveryStrategy(
    error: AgentError,
    policy: ErrorPolicy
  ): RecoveryStrategy {
    // Use policy strategy if specified
    if (policy.recovery_strategy) {
      return policy.recovery_strategy;
    }

    // Use error's suggested strategy
    if (error.recovery_strategy) {
      return error.recovery_strategy;
    }

    // Default strategy based on retryability
    return error.retryable ? "retry" : "fallback";
  }

  /**
   * Attempt recovery based on strategy
   */
  private async attemptRecovery(
    error: AgentError,
    strategy: RecoveryStrategy,
    policy: ErrorPolicy,
    context?: ErrorContext
  ): Promise<RecoveryResult> {
    switch (strategy) {
      case "retry":
        return this.retryManager.retry(error, policy, async () => {
          // Callback to retry the operation
          throw error.cause || new Error(error.message);
        });

      case "fallback":
        return this.fallbackManager.fallback(error, policy, context);

      case "skip":
        return {
          success: true,
          strategy: "skip",
          recovery_time: 0,
          attempts: 0,
        };

      case "abort":
        return {
          success: false,
          strategy: "abort",
          error,
          recovery_time: 0,
          attempts: 0,
        };

      case "custom":
        if (policy.custom_recovery) {
          try {
            const result = await policy.custom_recovery(error);
            return {
              success: true,
              strategy: "custom",
              result,
              recovery_time: 0,
              attempts: 1,
            };
          } catch (e) {
            return {
              success: false,
              strategy: "custom",
              error,
              recovery_time: 0,
              attempts: 1,
            };
          }
        }
        return {
          success: false,
          strategy: "custom",
          error,
          recovery_time: 0,
          attempts: 0,
        };

      default:
        return {
          success: false,
          strategy: "abort",
          error,
          recovery_time: 0,
          attempts: 0,
        };
    }
  }

  /**
   * Log error
   */
  private logError(error: AgentError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.agent_id}] ${error.category.toUpperCase()}: ${error.message}`;

    switch (logLevel) {
      case "fatal":
      case "error":
        console.error(logMessage, error.context);
        break;
      case "warning":
        console.warn(logMessage, error.context);
        break;
      case "info":
      default:
        console.info(logMessage, error.context);
        break;
    }
  }

  /**
   * Get log level for severity
   */
  private getLogLevel(severity: ErrorSeverity): string {
    if (severity === "fatal" || severity === "critical") return "error";
    if (severity === "error") return "error";
    if (severity === "warning") return "warning";
    return "info";
  }

  /**
   * Get error history for an agent
   */
  getErrorHistory(agentId: string): AgentError[] {
    return this.errorHistory.get(agentId) || [];
  }

  /**
   * Get active error by ID
   */
  getActiveError(errorId: string): AgentError | undefined {
    return this.activeErrors.get(errorId);
  }

  /**
   * Clear error history
   */
  clearErrorHistory(agentId?: string): void {
    if (agentId) {
      this.errorHistory.delete(agentId);
    } else {
      this.errorHistory.clear();
    }
  }

  /**
   * Get error statistics
   */
  getStatistics() {
    return this.analytics.getStatistics();
  }

  /**
   * Get managers
   */
  getRetryManager(): RetryManager {
    return this.retryManager;
  }

  getFallbackManager(): FallbackManager {
    return this.fallbackManager;
  }

  getCircuitBreakerManager(): CircuitBreakerManager {
    return this.circuitBreakerManager;
  }

  getTimeoutManager(): TimeoutManager {
    return this.timeoutManager;
  }

  getDeadLetterQueue(): DeadLetterQueue {
    return this.deadLetterQueue;
  }

  getAnalytics(): ErrorAnalytics {
    return this.analytics;
  }

  /**
   * Get default error policy
   */
  private getDefaultPolicy(): ErrorPolicy {
    return {
      max_retries: 3,
      timeout: 30000,
      recovery_strategy: "retry",
      use_circuit_breaker: true,
      circuit_breaker_threshold: 5,
      circuit_breaker_reset_timeout: 60000,
    };
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    await this.deadLetterQueue.persist();
    this.analytics.reset();
    this.errorHistory.clear();
    this.activeErrors.clear();
  }
}

/**
 * Singleton instance
 */
export const errorHandler = new ErrorHandler();

/**
 * Convenience function to handle an error
 */
export async function handleError(
  error: Error,
  agentId: string,
  context?: ErrorContext,
  policy?: ErrorPolicy
): Promise<RecoveryResult> {
  return errorHandler.handleError(error, agentId, context, policy);
}
