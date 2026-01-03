/**
 * OllamaAdapterError - Ollama-specific adapter errors
 *
 * Provides structured error handling for Ollama API interactions,
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
 * Ollama-specific error codes
 */
export enum OllamaErrorCode {
  /** Connection refused - Ollama not running */
  ECONNREFUSED = "OLLAMA_ECONNREFUSED",
  /** Request timeout */
  TIMEOUT = "OLLAMA_TIMEOUT",
  /** Model not found on server */
  MODEL_NOT_FOUND = "OLLAMA_MODEL_NOT_FOUND",
  /** Internal server error */
  INTERNAL_ERROR = "OLLAMA_INTERNAL_ERROR",
  /** Generic HTTP error */
  HTTP_ERROR = "OLLAMA_HTTP_ERROR",
  /** Invalid request format */
  INVALID_REQUEST = "OLLAMA_INVALID_REQUEST",
  /** Model loading failed */
  MODEL_LOAD_FAILED = "OLLAMA_MODEL_LOAD_FAILED",
  /** Generation failed */
  GENERATION_FAILED = "OLLAMA_GENERATION_FAILED",
  /** Unknown error */
  UNKNOWN_ERROR = "OLLAMA_UNKNOWN_ERROR",
}

/**
 * Error recovery information specific to Ollama
 */
export interface OllamaRecoveryInfo {
  /** Suggested wait time before retry (ms) */
  waitTime?: number;
  /** Suggested alternative model */
  alternativeModel?: string;
  /** Whether to check Ollama health */
  checkHealth?: boolean;
  /** Command to start Ollama (if applicable) */
  startCommand?: string;
}

/**
 * OllamaAdapterError - Ollama-specific error class
 *
 * @example
 * ```typescript
 * throw OllamaAdapterError.connectionRefused('http://localhost:11434');
 * throw OllamaAdapterError.modelNotFound('llama2');
 * throw OllamaAdapterError.timeout(30000);
 * ```
 */
export class OllamaAdapterError extends AdapterError {
  /** Ollama-specific recovery information */
  public readonly ollamaRecovery?: OllamaRecoveryInfo;

  private constructor(
    operation: string,
    message: string,
    code: OllamaErrorCode,
    context: Record<string, unknown> = {},
    cause?: Error
  ) {
    super("Ollama", operation, message, code, context, cause);

    // Extract Ollama-specific recovery information from context
    this.ollamaRecovery = context.ollamaRecovery as
      | OllamaRecoveryInfo
      | undefined;
  }

  /**
   * Create error for connection refused
   */
  static connectionRefused(baseUrl: string, cause?: Error): OllamaAdapterError {
    return new OllamaAdapterError(
      "connect",
      `Ollama service unreachable at ${baseUrl}. Is Ollama running?`,
      OllamaErrorCode.ECONNREFUSED,
      {
        severity: ErrorSeverity.HIGH,
        recovery: RecoveryStrategy.MANUAL,
        retryable: false,
        requestDetails: { url: baseUrl },
        ollamaRecovery: {
          checkHealth: true,
          startCommand: "ollama serve",
          waitTime: 5000,
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
    operation: string = "generate",
    cause?: Error
  ): OllamaAdapterError {
    return new OllamaAdapterError(
      operation,
      `Request timeout after ${timeoutMs}ms`,
      OllamaErrorCode.TIMEOUT,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.RETRY,
        retryable: true,
        context: { timeoutMs },
        ollamaRecovery: {
          waitTime: Math.min(timeoutMs * 2, 30000),
        },
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
  ): OllamaAdapterError {
    return new OllamaAdapterError(
      "generate",
      `Model not found: ${modelName}`,
      OllamaErrorCode.MODEL_NOT_FOUND,
      {
        severity: ErrorSeverity.HIGH,
        recovery: RecoveryStrategy.MANUAL,
        retryable: false,
        context: {
          modelName,
          availableModels,
        },
        ollamaRecovery: {
          alternativeModel: availableModels[0] || "llama2",
          checkHealth: true,
        },
      },
      cause
    );
  }

  /**
   * Create error for internal server error
   */
  static internalError(
    message: string = "Ollama internal server error",
    cause?: Error
  ): OllamaAdapterError {
    return new OllamaAdapterError(
      "generate",
      message,
      OllamaErrorCode.INTERNAL_ERROR,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.RETRY,
        retryable: true,
        statusCode: 500,
        ollamaRecovery: {
          waitTime: 2000,
          checkHealth: true,
        },
      },
      cause
    );
  }

  /**
   * Create error for invalid request
   */
  static invalidRequest(message: string, cause?: Error): OllamaAdapterError {
    return new OllamaAdapterError(
      "generate",
      `Invalid request: ${message}`,
      OllamaErrorCode.INVALID_REQUEST,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
        statusCode: 400,
      },
      cause
    );
  }

  /**
   * Create error for model load failure
   */
  static modelLoadFailed(modelName: string, cause?: Error): OllamaAdapterError {
    return new OllamaAdapterError(
      "loadModel",
      `Failed to load model: ${modelName}`,
      OllamaErrorCode.MODEL_LOAD_FAILED,
      {
        severity: ErrorSeverity.HIGH,
        recovery: RecoveryStrategy.MANUAL,
        retryable: false,
        context: { modelName },
        ollamaRecovery: {
          checkHealth: true,
          alternativeModel: "llama2",
        },
      },
      cause
    );
  }

  /**
   * Create error for generation failure
   */
  static generationFailed(
    modelName: string,
    cause?: Error
  ): OllamaAdapterError {
    return new OllamaAdapterError(
      "generate",
      `Generation failed for model: ${modelName}`,
      OllamaErrorCode.GENERATION_FAILED,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.FALLBACK,
        retryable: true,
        context: { modelName },
        ollamaRecovery: {
          waitTime: 1000,
          alternativeModel: "llama2",
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
  ): OllamaAdapterError {
    return new OllamaAdapterError(
      operation,
      `Unknown error: ${message}`,
      OllamaErrorCode.UNKNOWN_ERROR,
      {
        severity: ErrorSeverity.MEDIUM,
        recovery: RecoveryStrategy.ABORT,
        retryable: false,
      },
      cause
    );
  }

  /**
   * Create OllamaAdapterError from Axios error
   * Overrides base class method to provide Ollama-specific error handling
   */
  static fromAxiosError(
    adapterName: string,
    operation: string,
    axiosError: AxiosError<unknown>
  ): OllamaAdapterError {
    const statusCode = axiosError.response?.status;
    const errorCode = axiosError.code;

    // Map error codes to specific errors
    if (errorCode === "ECONNREFUSED") {
      return OllamaAdapterError.connectionRefused(
        axiosError.config?.baseURL || "unknown",
        axiosError
      );
    }

    if (errorCode === "ETIMEDOUT" || errorCode === "ECONNABORTED") {
      return OllamaAdapterError.timeout(
        parseInt(axiosError.config?.timeout?.toString() || "30000"),
        operation,
        axiosError
      );
    }

    if (statusCode === 404) {
      return OllamaAdapterError.modelNotFound(
        axiosError.config?.data?.model || "unknown",
        [],
        axiosError
      );
    }

    if (statusCode === 500) {
      return OllamaAdapterError.internalError(axiosError.message, axiosError);
    }

    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return OllamaAdapterError.invalidRequest(axiosError.message, axiosError);
    }

    return OllamaAdapterError.unknown(
      operation,
      axiosError.message,
      axiosError
    );
  }

  /**
   * Check if error is connection refused
   */
  isConnectionRefused(): boolean {
    return this.code === OllamaErrorCode.ECONNREFUSED;
  }

  /**
   * Check if error is timeout
   */
  isTimeout(): boolean {
    return this.code === OllamaErrorCode.TIMEOUT;
  }

  /**
   * Check if error is model not found
   */
  isModelNotFound(): boolean {
    return this.code === OllamaErrorCode.MODEL_NOT_FOUND;
  }

  /**
   * Get recovery information
   */
  getRecoveryInfo(): OllamaRecoveryInfo | undefined {
    return this.ollamaRecovery;
  }
}

export default OllamaAdapterError;
