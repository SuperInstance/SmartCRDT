/**
 * EmbeddingError - Embedding service-specific errors
 *
 * Provides structured error handling for embedding generation,
 * with specific error codes and recovery strategies for common scenarios.
 *
 * @packageDocumentation
 */
import { AdapterError } from "./AdapterError.js";
import type { AxiosError } from "axios";
/**
 * Embedding-specific error codes
 */
export declare enum EmbeddingErrorCode {
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
    UNKNOWN_ERROR = "EMBEDDING_UNKNOWN_ERROR"
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
export declare class EmbeddingError extends AdapterError {
    /** Embedding-specific recovery information */
    readonly embeddingRecovery?: EmbeddingRecoveryInfo;
    /** Embedding metadata */
    readonly embeddingMetadata?: EmbeddingMetadata;
    private constructor();
    /**
     * Create error for dimension mismatch
     */
    static dimensionMismatch(expected: number, actual: number, model: string, cause?: Error): EmbeddingError;
    /**
     * Create error for API failure
     */
    static apiFailure(operation: string, message: string, retryable?: boolean, cause?: Error): EmbeddingError;
    /**
     * Create error for invalid input
     */
    static invalidInput(message: string, field?: string, cause?: Error): EmbeddingError;
    /**
     * Create error for model not found
     */
    static modelNotFound(modelName: string, availableModels?: string[], cause?: Error): EmbeddingError;
    /**
     * Create error for timeout
     */
    static timeout(timeoutMs: number, operation?: string, cause?: Error): EmbeddingError;
    /**
     * Create error for rate limit
     */
    static rateLimit(retryAfter?: number, cause?: Error): EmbeddingError;
    /**
     * Create error for batch size exceeded
     */
    static batchSizeExceeded(batchSize: number, maxBatchSize: number, cause?: Error): EmbeddingError;
    /**
     * Create warning for fallback used
     */
    static fallbackUsed(originalModel: string, fallbackModel: string, cause?: Error): EmbeddingError;
    /**
     * Create error for service unavailable
     */
    static serviceUnavailable(serviceName?: string, cause?: Error): EmbeddingError;
    /**
     * Create error for unknown issues
     */
    static unknown(operation: string, message: string, cause?: Error): EmbeddingError;
    /**
     * Create EmbeddingError from Axios error
     * Overrides base class method to provide Embedding-specific error handling
     */
    static fromAxiosError(adapterName: string, operation: string, axiosError: AxiosError<unknown>): EmbeddingError;
    /**
     * Check if error is dimension mismatch
     */
    isDimensionMismatch(): boolean;
    /**
     * Check if fallback was used
     */
    isFallbackUsed(): boolean;
    /**
     * Check if error is retryable
     */
    canRetry(): boolean;
    /**
     * Get recovery information
     */
    getRecoveryInfo(): EmbeddingRecoveryInfo | undefined;
    /**
     * Get embedding metadata
     */
    getMetadata(): EmbeddingMetadata | undefined;
}
export default EmbeddingError;
//# sourceMappingURL=EmbeddingError.d.ts.map