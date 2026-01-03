/**
 * Error Classes for Aequor Cognitive Orchestration Platform
 *
 * Provides hierarchical error classes for different error scenarios.
 * All errors extend from the base LSIError class.
 */

/**
 * Base error class for all Aequor errors
 *
 * Provides a consistent error structure with error codes and metadata.
 */
export class LSIError extends Error {
  /** Error code for programmatic error handling */
  readonly code: string;

  /** Additional error metadata */
  readonly metadata?: Record<string, unknown>;

  constructor(message: string, code?: string, metadata?: Record<string, unknown>) {
    super(message);
    this.name = "LSIError";
    this.code = code || "LSI_ERROR";
    this.metadata = metadata;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (typeof (Error as any).captureStackTrace === "function") {
      (Error as any).captureStackTrace(this, LSIError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      stack: this.stack,
    };
  }
}

/**
 * Routing-related errors
 *
 * Thrown when routing decisions fail or routing constraints cannot be satisfied.
 */
export class LSIRoutingError extends LSIError {
  constructor(
    message: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, "LSI_ROUTING_ERROR", metadata);
    this.name = "LSIRoutingError";
  }
}

/**
 * Security-related errors
 *
 * Thrown when security constraints are violated or security checks fail.
 */
export class LSISecurityError extends LSIError {
  constructor(
    message: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, "LSI_SECURITY_ERROR", metadata);
    this.name = "LSISecurityError";
  }
}

/**
 * Configuration-related errors
 *
 * Thrown when configuration is invalid or missing required values.
 */
export class LSIConfigurationError extends LSIError {
  constructor(
    message: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, "LSI_CONFIGURATION_ERROR", metadata);
    this.name = "LSIConfigurationError";
  }
}

/**
 * Execution-related errors
 *
 * Thrown when query execution fails or produces invalid results.
 */
export class LSIExecutionError extends LSIError {
  constructor(
    message: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, "LSI_EXECUTION_ERROR", metadata);
    this.name = "LSIExecutionError";
  }
}

/**
 * Validation-related errors
 *
 * Thrown when input validation fails or protocol constraints are violated.
 */
export class LSIValidationError extends LSIError {
  constructor(
    message: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, "LSI_VALIDATION_ERROR", metadata);
    this.name = "LSIValidationError";
  }
}

/**
 * Timeout-related errors
 *
 * Thrown when operations timeout or take too long to complete.
 */
export class LSITimeoutError extends LSIError {
  constructor(
    message: string,
    metadata?: Record<string, unknown>
  ) {
    super(message, "LSI_TIMEOUT_ERROR", metadata);
    this.name = "LSITimeoutError";
  }
}
