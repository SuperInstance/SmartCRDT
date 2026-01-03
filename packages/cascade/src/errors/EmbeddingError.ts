/**
 * EmbeddingError - Embedding service-specific errors
 *
 * Provides structured error handling for embedding generation,
 * with specific error codes and recovery strategies for common scenarios.
 *
 * @packageDocumentation
 */

import {
  AdapterError,
  ErrorSeverity,
  RecoveryStrategy,
} from "./AdapterError.js";
import type { AxiosError } from "axios";

/**
 * Embedding-specific error codes
 */
export enum EmbeddingErrorCode {
  /** Dimension mismatch */
  DIMENSION_MISMATCH = "EMBEDDING_DIMENSION_MISMATCH",
  /** API failure */
  API_FAILURE = "EMBEDDING_API_FAILURE",
  /** Invalid input text */
  INVALID_INPUT = "EMBEDDING_INVALID_INPUT",
  /** Model not found */
  MODEL_NOT_FOUND = "EMBEDDING_MODEL_NOT_FOUND",
  /** Timeout */
  TIMEOUT = "EMBEDDING_TIMEOUT",
  /** Rate limit exceeded */
  RATE_LIMIT = "EMBEDDING_RATE_LIMIT",
  /** Batch size exceeded */
  BATCH_SIZE_EXCEEDED = "EMBEDDING_BATCH_SIZE_EXCEEDED",
  /** Fallback used */
  FALLBACK_USED = "EMBEDDING_FALLBACK_USED",
  /** Service unavailable */
  SERVICE_UNAVAILABLE = "EMBEDDING_SERVICE_UNAVAILABLE",
  /** Unknown error */
  UNKNOWN_ERROR = "EMBEDDING_UNKNOWN_ERROR",
}

/**
 * Embedding result metadata
 */
export interface EmbeddingMetadata {
  /** Model used for embedding */
  model: string;
  /** Expected dimensions */
  expectedDimensions: number;
  /** Actual dimensions */
  actualDimensions?: number;
  /** Text length */
  textLength?: number;
  /** Batch size */
  batchSize?: number;
  /** Maximum batch size */
  maxBatchSize?: number;
}

/**
 * Error recovery information specific to embeddings
 */
export interface EmbeddingRecoveryInfo {
  /** Whether fallback was used */
  usedFallback?: boolean;
  /** Fallback model name */
  fallbackModel?: string;
  /** Suggested retry with smaller batch */
  retryWithSmallerBatch?: number;
  /** Suggested alternative model */
  alternativeModel?: string;
  /** Suggested wait time before retry (ms) */
  waitTime?: number;
}

/**
 * EmbeddingError - Embedding service-specific error class
 *
 * @example
 * ```typescript
 * throw EmbeddingError.dimensionMismatch(1536, 768, 'text-embedding-3-small');
 * throw EmbeddingError.invalidInput('Text must not be empty');
 * throw EmbeddingError.batchSizeExceeded(100, 2048);
 * ```
 */
export class EmbeddingError extends AdapterError {
  /** Embedding-specific recovery information */
  public readonly embeddingRecovery?: EmbeddingRecoveryInfo;

  /** Embedding metadata */
  public readonly embeddingMetadata?: EmbeddingMetadata;

  private constructor(
    operation: string,
    message: string,
    code: EmbeddingErrorCode,
    context: Record<string, unknown> = {},
    cause?: Error
  ) {
    super("Embedding", operation, message, code, context, cause);

    // Extract embedding-specific properties from context
    this.embeddingRecovery = context.embeddingRecovery as
      | EmbeddingRecoveryInfo
      | undefined;
    this.embeddingMetadata = context.embeddingMetadata as
      | EmbeddingMetadata
      | undefined;
  }

  /**
   * Create error for dimension mismatch
   */
  static dimensionMismatch(
    expected: number,
    actual: number,
    model: string,
    cause?: Error
  ): EmbeddingError {
    return new EmbeddingError(
      "embed",
      `Embedding dimension mismatch for ${model}. Expected: ${expected}, Actual: ${actual}`,
      EmbeddingErrorCode.DIMENSION_MISMATCH,
      {
        severity: ErrorSeverity.HIGH,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        embeddingMetadata: {
          model,
          expectedDimensions: expected,
          actualDimensions: actual,
        },
      },
      cause
    );
  }

  /**
   * Create error for API failure
   */
  static apiFailure(
    operation: string,
    message: string,
    retryable: boolean = true,
    cause?: Error
  ): EmbeddingError {
    return new EmbeddingError(
      operation,
      `API failure: ${message}`,
      EmbeddingErrorCode.API_FAILURE,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: retryable
          ? RecoveryStrategy.RETRY
          : RecoveryStrategy.FALLBACK,
        retryable,
        embeddingRecovery: {
          waitTime: 2000,
          usedFallback: !retryable,
          fallbackModel: "hash-based",
        },
      },
      cause
    );
  }

  /**
   * Create error for invalid input
   */
  static invalidInput(
    message: string,
    field?: string,
    cause?: Error
  ): EmbeddingError {
    return new EmbeddingError(
      "validate",
      `Invalid input: ${message}`,
      EmbeddingErrorCode.INVALID_INPUT,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        context: { field },
      },
      cause
    );
  }

  /**
   * Create error for model not found
   */
  static modelNotFound(
    modelName: string,
    availableModels: string[] = [],
    cause?: Error
  ): EmbeddingError {
    return new EmbeddingError(
      "embed",
      `Embedding model not found: ${modelName}`,
      EmbeddingErrorCode.MODEL_NOT_FOUND,
      {
        severity: ErrorSeverity.HIGH,
        recovery: RecoveryStrategy.FALLBACK,
        retryable: false,
        statusCode: 404,
        embeddingMetadata: {
          model: modelName,
          expectedDimensions: 0,
        },
        embeddingRecovery: {
          alternativeModel: availableModels[0] || "text-embedding-3-small",
          usedFallback: true,
          fallbackModel: "hash-based",
        },
      },
      cause
    );
  }

  /**
   * Create error for timeout
   */
  static timeout(
    timeoutMs: number,
    operation: string = "embed",
    cause?: Error
  ): EmbeddingError {
    return new EmbeddingError(
      operation,
      `Embedding request timeout after ${timeoutMs}ms`,
      EmbeddingErrorCode.TIMEOUT,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.FALLBACK,
        retryable: true,
        embeddingRecovery: {
          waitTime: Math.min(timeoutMs * 2, 30000),
          usedFallback: true,
          fallbackModel: "hash-based",
        },
      },
      cause
    );
  }

  /**
   * Create error for rate limit
   */
  static rateLimit(retryAfter?: number, cause?: Error): EmbeddingError {
    return new EmbeddingError(
      "embed",
      `Embedding rate limit exceeded. Retry after ${retryAfter || 60} seconds.`,
      EmbeddingErrorCode.RATE_LIMIT,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.RETRY,
        retryable: true,
        statusCode: 429,
        embeddingRecovery: {
          waitTime: (retryAfter || 60) * 1000,
        },
      },
      cause
    );
  }

  /**
   * Create error for batch size exceeded
   */
  static batchSizeExceeded(
    batchSize: number,
    maxBatchSize: number,
    cause?: Error
  ): EmbeddingError {
    return new EmbeddingError(
      "embedBatch",
      `Batch size ${batchSize} exceeds maximum ${maxBatchSize}`,
      EmbeddingErrorCode.BATCH_SIZE_EXCEEDED,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.RETRY,
        retryable: false,
        embeddingMetadata: {
          model: "unknown",
          expectedDimensions: 0,
          batchSize,
          maxBatchSize,
        },
        embeddingRecovery: {
          retryWithSmallerBatch: maxBatchSize,
        },
      },
      cause
    );
  }

  /**
   * Create warning for fallback used
   */
  static fallbackUsed(
    originalModel: string,
    fallbackModel: string,
    cause?: Error
  ): EmbeddingError {
    return new EmbeddingError(
      "embed",
      `Embedding service unavailable, using fallback: ${fallbackModel}`,
      EmbeddingErrorCode.FALLBACK_USED,
      {
        severity: ErrorSeverity.LOW,
        recovery: RecoveryStrategy.DEGRADE,
        retryable: false,
        embeddingMetadata: {
          model: originalModel,
          expectedDimensions: 0,
        },
        embeddingRecovery: {
          usedFallback: true,
          fallbackModel,
        },
      },
      cause
    );
  }

  /**
   * Create error for service unavailable
   */
  static serviceUnavailable(
    serviceName: string = "Embedding service",
    cause?: Error
  ): EmbeddingError {
    return new EmbeddingError(
      "embed",
      `${serviceName} unavailable. Please try again later.`,
      EmbeddingErrorCode.SERVICE_UNAVAILABLE,
      {
        severity: ErrorSeverity.HIGH,
        recovery: RecoveryStrategy.FALLBACK,
        retryable: true,
        statusCode: 503,
        embeddingRecovery: {
          waitTime: 5000,
          usedFallback: true,
          fallbackModel: "hash-based",
        },
      },
      cause
    );
  }

  /**
   * Create error for unknown issues
   */
  static unknown(
    operation: string,
    message: string,
    cause?: Error
  ): EmbeddingError {
    return new EmbeddingError(
      operation,
      `Unknown embedding error: ${message}`,
      EmbeddingErrorCode.UNKNOWN_ERROR,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
      },
      cause
    );
  }

  /**
   * Create EmbeddingError from Axios error
   * Overrides base class method to provide Embedding-specific error handling
   */
  static fromAxiosError(
    adapterName: string,
    operation: string,
    axiosError: AxiosError<unknown>
  ): EmbeddingError {
    const statusCode = axiosError.response?.status;
    const errorCode = axiosError.code;

    // Map error codes to specific errors
    if (errorCode === "ETIMEDOUT" || errorCode === "ECONNABORTED") {
      const timeout = parseInt(
        axiosError.config?.timeout?.toString() || "30000"
      );
      return EmbeddingError.timeout(timeout, operation, axiosError);
    }

    if (statusCode === 429) {
      return EmbeddingError.rateLimit(undefined, axiosError);
    }

    if (statusCode === 404) {
      return EmbeddingError.modelNotFound("unknown", [], axiosError);
    }

    if (statusCode === 400) {
      return EmbeddingError.invalidInput(
        axiosError.message,
        undefined,
        axiosError
      );
    }

    if (statusCode && statusCode >= 500) {
      return EmbeddingError.serviceUnavailable(
        "OpenAI embedding service",
        axiosError
      );
    }

    return EmbeddingError.unknown(operation, axiosError.message, axiosError);
  }

  /**
   * Check if error is dimension mismatch
   */
  isDimensionMismatch(): boolean {
    return this.code === EmbeddingErrorCode.DIMENSION_MISMATCH;
  }

  /**
   * Check if fallback was used
   */
  isFallbackUsed(): boolean {
    return this.code === EmbeddingErrorCode.FALLBACK_USED;
  }

  /**
   * Check if error is retryable
   */
  canRetry(): boolean {
    return this.retryable && this.recovery !== RecoveryStrategy.ABORT;
  }

  /**
   * Get recovery information
   */
  getRecoveryInfo(): EmbeddingRecoveryInfo | undefined {
    return this.embeddingRecovery;
  }

  /**
   * Get embedding metadata
   */
  getMetadata(): EmbeddingMetadata | undefined {
    return this.embeddingMetadata;
  }
}

export default EmbeddingError;
