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
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
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
export declare function retryWithBackoff<T>(fn: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T>;
/**
 * Execute with fallback options
 *
 * @param primaryFn - Primary function to try
 * @param fallbacks - Fallback options
 * @returns Result from first successful function
 */
export declare function withFallback<T>(primaryFn: () => Promise<T>, fallbacks: FallbackConfig<T>["fallbacks"]): Promise<T>;
/**
 * Execute with graceful degradation
 *
 * @param primaryFn - Primary function to try
 * @param fallbackFn - Fallback function if primary fails
 * @param degradedFn - Degraded function if fallback fails
 * @returns Result from successful function or throws
 */
export declare function withGracefulDegradation<T>(primaryFn: () => Promise<T>, fallbackFn: () => Promise<T>, degradedFn: () => Promise<T>): Promise<T>;
/**
 * Check if error is an AdapterError
 */
export declare function isAdapterError(error: unknown): error is AdapterError;
/**
 * Check if error is an OllamaAdapterError
 */
export declare function isOllamaError(error: unknown): error is OllamaAdapterError;
/**
 * Check if error is an OpenAIAdapterError
 */
export declare function isOpenAIError(error: unknown): error is OpenAIAdapterError;
/**
 * Check if error is an EmbeddingError
 */
export declare function isEmbeddingError(error: unknown): error is EmbeddingError;
/**
 * Check if error is a ValidationError
 */
export declare function isValidationError(error: unknown): error is ValidationError;
/**
 * Check if error is a RateLimitError
 */
export declare function isRateLimitError(error: unknown): error is RateLimitError;
/**
 * Get error code from error
 */
export declare function getErrorCode(error: unknown): string | undefined;
/**
 * Get error severity from error
 */
export declare function getErrorSeverity(error: unknown): string | undefined;
/**
 * Check if error is retryable
 */
export declare function isRetryable(error: unknown): boolean;
/**
 * Format error for logging
 */
export declare function formatError(error: unknown): string;
/**
 * Convert error to JSON for logging/serialization
 */
export declare function errorToJSON(error: unknown): Record<string, unknown>;
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
export declare function logError(logger: ErrorLogger, error: unknown, context?: Record<string, unknown>): void;
/**
 * Safe logging - remove sensitive data from logs
 */
export declare function sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown>;
/**
 * Parse Axios error into appropriate adapter error
 */
export declare function parseAxiosError(adapterName: "Ollama" | "OpenAI" | "Embedding", operation: string, axiosError: AxiosError<unknown>): AdapterError;
//# sourceMappingURL=utils.d.ts.map