/**
 * AdapterError - Base class for all adapter-related errors
 *
 * This error provides structured information about adapter failures,
 * including which adapter failed, what operation was being performed,
 * and whether the error is retryable.
 *
 * @packageDocumentation
 */

import type { AxiosError } from "axios";

/**
 * Severity level of the error
 */
export enum ErrorSeverity {
  /** Low severity - can be recovered automatically */
  LOW = "low",
  /** Medium severity - requires user attention or fallback */
  MEDIUM = "medium",
  /** High severity - critical failure, manual intervention required */
  HIGH = "high",
  /** Critical severity - system may be unstable */
  CRITICAL = "critical",
}

/**
 * Recovery strategy suggestion for the error
 */
export enum RecoveryStrategy {
  /** Retry the operation with exponential backoff */
  RETRY = "retry",
  /** Fall back to alternative adapter/service */
  FALLBACK = "fallback",
  /** Gracefully degrade functionality */
  DEGRADE = "degrade",
  /** Skip this operation and continue */
  SKIP = "skip",
  /** Manual intervention required */
  MANUAL = "manual",
  /** Abort the operation */
  ABORT = "abort",
}

/**
 * Base error context interface
 */
export interface ErrorContext {
  /** Additional contextual information */
  [key: string]: unknown;
}

/**
 * Adapter-specific error context
 */
export interface AdapterErrorContext extends ErrorContext {
  /** Name of the adapter that failed */
  adapterName: string;
  /** Operation being performed when error occurred */
  operation: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Request/response details */
  requestDetails?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
  /** Underlying network error */
  networkError?: {
    code?: string;
    errno?: number;
    syscall?: string;
    address?: string;
    port?: number;
  };
}

/**
 * AdapterError - Base class for all adapter errors
 *
 * All adapter-specific errors should extend this class.
 *
 * @example
 * ```typescript
 * throw new AdapterError(
 *   'Ollama',
 *   'generate',
 *   'Connection refused',
 *   'ECONNREFUSED',
 *   { statusCode: undefined, retryable: true }
 * );
 * ```
 */
export class AdapterError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;

  /** Severity level of the error */
  public readonly severity: ErrorSeverity;

  /** Suggested recovery strategy */
  public readonly recovery: RecoveryStrategy;

  /** Whether this error is retryable */
  public readonly retryable: boolean;

  /** Request ID for tracing */
  public readonly requestId?: string;

  /** Timestamp when error occurred */
  public readonly timestamp: number;

  /** Adapter-specific context */
  public readonly context: AdapterErrorContext;

  /** Original error that caused this error */
  public readonly cause?: Error;

  /**
   * Create a new AdapterError
   *
   * @param adapterName - Name of the adapter that failed
   * @param operation - Operation being performed
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling
   * @param context - Additional error context
   * @param cause - Original error that caused this error
   */
  constructor(
    adapterName: string,
    operation: string,
    message: string,
    code: string,
    context: Partial<AdapterErrorContext> = {},
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = Date.now();
    this.adapterName = adapterName;
    this.operation = operation;
    this.cause = cause;

    // Build context with required fields
    this.context = {
      adapterName,
      operation,
      ...context,
    };

    // Determine severity and recovery from context or defaults
    this.severity = (context.severity as ErrorSeverity) || ErrorSeverity.MEDIUM;
    this.recovery =
      (context.recovery as RecoveryStrategy) || RecoveryStrategy.RETRY;
    this.retryable = (context.retryable as boolean) ?? true;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Adapter name (convenience property)
   */
  private readonly adapterName: string;

  /**
   * Operation (convenience property)
   */
  private readonly operation: string;

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      recovery: this.recovery,
      retryable: this.retryable,
      requestId: this.requestId,
      timestamp: this.timestamp,
      context: this.context,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
      stack: this.stack,
    };
  }

  /**
   * Convert error to human-readable string
   */
  toString(): string {
    const parts = [
      `[${this.code}]`,
      this.message,
      `\n  Adapter: ${this.context.adapterName}`,
      `\n  Operation: ${this.context.operation}`,
      `\n  Severity: ${this.severity}`,
      `\n  Retryable: ${this.retryable}`,
      `\n  Recovery: ${this.recovery}`,
    ];

    if (this.context.statusCode) {
      parts.push(`\n  Status: ${this.context.statusCode}`);
    }

    if (this.cause) {
      parts.push(`\n  Caused by: ${this.cause.message}`);
    }

    return parts.join("");
  }

  /**
   * Check if this error matches a given error code
   */
  isErrorCode(code: string): boolean {
    return this.code === code;
  }

  /**
   * Check if error has specific severity level or higher
   */
  hasSeverityAtLeast(minSeverity: ErrorSeverity): boolean {
    const severityOrder = [
      ErrorSeverity.LOW,
      ErrorSeverity.MEDIUM,
      ErrorSeverity.HIGH,
      ErrorSeverity.CRITICAL,
    ];
    return (
      severityOrder.indexOf(this.severity) >= severityOrder.indexOf(minSeverity)
    );
  }

  /**
   * Create an AdapterError from an Axios error
   * Note: Subclasses should override this method with their own specific error handling
   */
  static fromAxiosError(
    adapterName: string,
    operation: string,
    axiosError: AxiosError<unknown>
  ): AdapterError {
    const statusCode = axiosError.response?.status;
    const errorCode = axiosError.code;

    // Determine if retryable based on status code
    const retryable =
      statusCode === undefined
        ? true // Network errors are retryable
        : statusCode === 408 || // Request timeout
          statusCode === 429 || // Rate limit
          statusCode >= 500; // Server errors

    // Determine severity based on status code
    let severity = ErrorSeverity.MEDIUM;
    if (statusCode === 401 || statusCode === 403) {
      severity = ErrorSeverity.HIGH;
    } else if (statusCode && statusCode >= 500) {
      severity = ErrorSeverity.LOW;
    } else if (statusCode && statusCode >= 400 && statusCode < 500) {
      severity = ErrorSeverity.MEDIUM;
    }

    return new this(
      adapterName,
      operation,
      axiosError.message,
      errorCode || "HTTP_ERROR",
      {
        statusCode,
        retryable,
        severity,
        recovery: retryable ? RecoveryStrategy.RETRY : RecoveryStrategy.ABORT,
        requestDetails: {
          url: axiosError.config?.url,
          method: axiosError.config?.method?.toUpperCase(),
        },
        networkError: errorCode
          ? {
              code: errorCode,
            }
          : undefined,
      },
      axiosError
    ) as AdapterError;
  }
}

export default AdapterError;
