/**
 * Error handling utilities
 *
 * Provides utility functions for error recovery, logging, and handling.
 *
 * @packageDocumentation
 */

import type { AxiosError } from "axios";
import { AdapterError } from "./AdapterError.js";
import { OllamaAdapterError } from "./OllamaAdapterError.js";
import { OpenAIAdapterError } from "./OpenAIAdapterError.js";
import { EmbeddingError } from "./EmbeddingError.js";
import { ValidationError } from "./ValidationError.js";
import { RateLimitError } from "./RateLimitError.js";

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Whether to add jitter to delays */
  jitter: boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Fallback configuration
 */
export interface FallbackConfig<T> {
  /** Array of fallback options to try */
  fallbacks: Array<{
    /** Name of the fallback */
    name: string;
    /** Fallback function */
    fn: () => Promise<T>;
    /** Priority (lower = higher priority) */
    priority: number;
  }>;
  /** Whether to use all fallbacks or stop at first success */
  tryAll: boolean;
}

/**
 * Retry with exponential backoff
 *
 * @param fn - Function to retry
 * @param config - Retry configuration
 * @returns Result of function or throws last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: unknown;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      if (error instanceof AdapterError && !error.retryable) {
        throw error;
      }

      // Don't delay after last attempt
      if (attempt < finalConfig.maxRetries) {
        const delay = calculateDelay(attempt, finalConfig);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Calculate delay with exponential backoff and optional jitter
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff
  let delay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);

  // Cap at max delay
  delay = Math.min(delay, config.maxDelay);

  // Add jitter if enabled (±25%)
  if (config.jitter) {
    const jitterAmount = delay * 0.25;
    delay = delay - jitterAmount + Math.random() * jitterAmount * 2;
  }

  return Math.floor(delay);
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute with fallback options
 *
 * @param primaryFn - Primary function to try
 * @param fallbacks - Fallback options
 * @returns Result from first successful function
 */
export async function withFallback<T>(
  primaryFn: () => Promise<T>,
  fallbacks: FallbackConfig<T>["fallbacks"]
): Promise<T> {
  const allOptions = [
    { name: "primary", fn: primaryFn, priority: 0 },
    ...fallbacks,
  ].sort((a, b) => a.priority - b.priority);

  let lastError: unknown;

  for (const option of allOptions) {
    try {
      const result = await option.fn();
      return result;
    } catch (error) {
      lastError = error;
      // Continue to next fallback
    }
  }

  throw lastError;
}

/**
 * Execute with graceful degradation
 *
 * @param primaryFn - Primary function to try
 * @param fallbackFn - Fallback function if primary fails
 * @param degradedFn - Degraded function if fallback fails
 * @returns Result from successful function or throws
 */
export async function withGracefulDegradation<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  degradedFn: () => Promise<T>
): Promise<T> {
  try {
    return await primaryFn();
  } catch (primaryError) {
    try {
      return await fallbackFn();
    } catch (fallbackError) {
      try {
        return await degradedFn();
      } catch (degradedError) {
        // All failed, throw primary error
        throw primaryError;
      }
    }
  }
}

/**
 * Check if error is an AdapterError
 */
export function isAdapterError(error: unknown): error is AdapterError {
  return error instanceof AdapterError;
}

/**
 * Check if error is an OllamaAdapterError
 */
export function isOllamaError(error: unknown): error is OllamaAdapterError {
  return error instanceof OllamaAdapterError;
}

/**
 * Check if error is an OpenAIAdapterError
 */
export function isOpenAIError(error: unknown): error is OpenAIAdapterError {
  return error instanceof OpenAIAdapterError;
}

/**
 * Check if error is an EmbeddingError
 */
export function isEmbeddingError(error: unknown): error is EmbeddingError {
  return error instanceof EmbeddingError;
}

/**
 * Check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if error is a RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Get error code from error
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isAdapterError(error)) {
    return error.code;
  }
  return undefined;
}

/**
 * Get error severity from error
 */
export function getErrorSeverity(error: unknown): string | undefined {
  if (isAdapterError(error)) {
    return error.severity;
  }
  return undefined;
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: unknown): boolean {
  if (isAdapterError(error)) {
    return error.retryable;
  }
  return false;
}

/**
 * Format error for logging
 */
export function formatError(error: unknown): string {
  if (isAdapterError(error)) {
    return error.toString();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Convert error to JSON for logging/serialization
 */
export function errorToJSON(error: unknown): Record<string, unknown> {
  if (isAdapterError(error)) {
    return error.toJSON();
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    error: String(error),
  };
}

/**
 * Create error logger
 */
export interface ErrorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Log error with appropriate level
 */
export function logError(
  logger: ErrorLogger,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorJSON = errorToJSON(error);
  const meta = {
    ...context,
    error: errorJSON,
  };

  if (isAdapterError(error)) {
    switch (error.severity) {
      case "low":
        logger.debug("Error occurred", meta);
        break;
      case "medium":
        logger.warn("Warning", meta);
        break;
      case "high":
      case "critical":
        logger.error("Critical error", meta);
        break;
    }
  } else {
    logger.error("Unknown error", meta);
  }
}

/**
 * Safe logging - remove sensitive data from logs
 */
export function sanitizeForLogging(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sensitiveKeys = [
    "password",
    "apikey",
    "api_key",
    "secret",
    "token",
    "authorization",
    "bearer",
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitive =>
      lowerKey.includes(sensitive)
    );

    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Parse Axios error into appropriate adapter error
 */
export function parseAxiosError(
  adapterName: "Ollama" | "OpenAI" | "Embedding",
  operation: string,
  axiosError: AxiosError<unknown>
): AdapterError {
  switch (adapterName) {
    case "Ollama":
      return OllamaAdapterError.fromAxiosError(
        adapterName,
        operation,
        axiosError
      );
    case "OpenAI":
      return OpenAIAdapterError.fromAxiosError(
        adapterName,
        operation,
        axiosError
      );
    case "Embedding":
      return EmbeddingError.fromAxiosError(adapterName, operation, axiosError);
    default:
      return AdapterError.fromAxiosError(adapterName, operation, axiosError);
  }
}
