/**
 * EmbeddingError - Embedding service-specific errors
 *
 * Provides structured error handling for embedding generation,
 * with specific error codes and recovery strategies for common scenarios.
 *
 * @packageDocumentation
 */
import { AdapterError, ErrorSeverity, RecoveryStrategy, } from "./AdapterError.js";
/**
 * Embedding-specific error codes
 */
export var EmbeddingErrorCode;
(function (EmbeddingErrorCode) {
    /** Dimension mismatch */
    EmbeddingErrorCode["DIMENSION_MISMATCH"] = "EMBEDDING_DIMENSION_MISMATCH";
    /** API failure */
    EmbeddingErrorCode["API_FAILURE"] = "EMBEDDING_API_FAILURE";
    /** Invalid input text */
    EmbeddingErrorCode["INVALID_INPUT"] = "EMBEDDING_INVALID_INPUT";
    /** Model not found */
    EmbeddingErrorCode["MODEL_NOT_FOUND"] = "EMBEDDING_MODEL_NOT_FOUND";
    /** Timeout */
    EmbeddingErrorCode["TIMEOUT"] = "EMBEDDING_TIMEOUT";
    /** Rate limit exceeded */
    EmbeddingErrorCode["RATE_LIMIT"] = "EMBEDDING_RATE_LIMIT";
    /** Batch size exceeded */
    EmbeddingErrorCode["BATCH_SIZE_EXCEEDED"] = "EMBEDDING_BATCH_SIZE_EXCEEDED";
    /** Fallback used */
    EmbeddingErrorCode["FALLBACK_USED"] = "EMBEDDING_FALLBACK_USED";
    /** Service unavailable */
    EmbeddingErrorCode["SERVICE_UNAVAILABLE"] = "EMBEDDING_SERVICE_UNAVAILABLE";
    /** Unknown error */
    EmbeddingErrorCode["UNKNOWN_ERROR"] = "EMBEDDING_UNKNOWN_ERROR";
})(EmbeddingErrorCode || (EmbeddingErrorCode = {}));
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
    embeddingRecovery;
    /** Embedding metadata */
    embeddingMetadata;
    constructor(operation, message, code, context = {}, cause) {
        super("Embedding", operation, message, code, context, cause);
        // Extract embedding-specific properties from context
        this.embeddingRecovery = context.embeddingRecovery;
        this.embeddingMetadata = context.embeddingMetadata;
    }
    /**
     * Create error for dimension mismatch
     */
    static dimensionMismatch(expected, actual, model, cause) {
        return new EmbeddingError("embed", `Embedding dimension mismatch for ${model}. Expected: ${expected}, Actual: ${actual}`, EmbeddingErrorCode.DIMENSION_MISMATCH, {
            severity: ErrorSeverity.HIGH,
            recovery: RecoveryStrategy.ABORT,
            retryable: false,
            embeddingMetadata: {
                model,
                expectedDimensions: expected,
                actualDimensions: actual,
            },
        }, cause);
    }
    /**
     * Create error for API failure
     */
    static apiFailure(operation, message, retryable = true, cause) {
        return new EmbeddingError(operation, `API failure: ${message}`, EmbeddingErrorCode.API_FAILURE, {
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
        }, cause);
    }
    /**
     * Create error for invalid input
     */
    static invalidInput(message, field, cause) {
        return new EmbeddingError("validate", `Invalid input: ${message}`, EmbeddingErrorCode.INVALID_INPUT, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.ABORT,
            retryable: false,
            context: { field },
        }, cause);
    }
    /**
     * Create error for model not found
     */
    static modelNotFound(modelName, availableModels = [], cause) {
        return new EmbeddingError("embed", `Embedding model not found: ${modelName}`, EmbeddingErrorCode.MODEL_NOT_FOUND, {
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
        }, cause);
    }
    /**
     * Create error for timeout
     */
    static timeout(timeoutMs, operation = "embed", cause) {
        return new EmbeddingError(operation, `Embedding request timeout after ${timeoutMs}ms`, EmbeddingErrorCode.TIMEOUT, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.FALLBACK,
            retryable: true,
            embeddingRecovery: {
                waitTime: Math.min(timeoutMs * 2, 30000),
                usedFallback: true,
                fallbackModel: "hash-based",
            },
        }, cause);
    }
    /**
     * Create error for rate limit
     */
    static rateLimit(retryAfter, cause) {
        return new EmbeddingError("embed", `Embedding rate limit exceeded. Retry after ${retryAfter || 60} seconds.`, EmbeddingErrorCode.RATE_LIMIT, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.RETRY,
            retryable: true,
            statusCode: 429,
            embeddingRecovery: {
                waitTime: (retryAfter || 60) * 1000,
            },
        }, cause);
    }
    /**
     * Create error for batch size exceeded
     */
    static batchSizeExceeded(batchSize, maxBatchSize, cause) {
        return new EmbeddingError("embedBatch", `Batch size ${batchSize} exceeds maximum ${maxBatchSize}`, EmbeddingErrorCode.BATCH_SIZE_EXCEEDED, {
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
        }, cause);
    }
    /**
     * Create warning for fallback used
     */
    static fallbackUsed(originalModel, fallbackModel, cause) {
        return new EmbeddingError("embed", `Embedding service unavailable, using fallback: ${fallbackModel}`, EmbeddingErrorCode.FALLBACK_USED, {
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
        }, cause);
    }
    /**
     * Create error for service unavailable
     */
    static serviceUnavailable(serviceName = "Embedding service", cause) {
        return new EmbeddingError("embed", `${serviceName} unavailable. Please try again later.`, EmbeddingErrorCode.SERVICE_UNAVAILABLE, {
            severity: ErrorSeverity.HIGH,
            recovery: RecoveryStrategy.FALLBACK,
            retryable: true,
            statusCode: 503,
            embeddingRecovery: {
                waitTime: 5000,
                usedFallback: true,
                fallbackModel: "hash-based",
            },
        }, cause);
    }
    /**
     * Create error for unknown issues
     */
    static unknown(operation, message, cause) {
        return new EmbeddingError(operation, `Unknown embedding error: ${message}`, EmbeddingErrorCode.UNKNOWN_ERROR, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.ABORT,
            retryable: false,
        }, cause);
    }
    /**
     * Create EmbeddingError from Axios error
     * Overrides base class method to provide Embedding-specific error handling
     */
    static fromAxiosError(adapterName, operation, axiosError) {
        const statusCode = axiosError.response?.status;
        const errorCode = axiosError.code;
        // Map error codes to specific errors
        if (errorCode === "ETIMEDOUT" || errorCode === "ECONNABORTED") {
            const timeout = parseInt(axiosError.config?.timeout?.toString() || "30000");
            return EmbeddingError.timeout(timeout, operation, axiosError);
        }
        if (statusCode === 429) {
            return EmbeddingError.rateLimit(undefined, axiosError);
        }
        if (statusCode === 404) {
            return EmbeddingError.modelNotFound("unknown", [], axiosError);
        }
        if (statusCode === 400) {
            return EmbeddingError.invalidInput(axiosError.message, undefined, axiosError);
        }
        if (statusCode && statusCode >= 500) {
            return EmbeddingError.serviceUnavailable("OpenAI embedding service", axiosError);
        }
        return EmbeddingError.unknown(operation, axiosError.message, axiosError);
    }
    /**
     * Check if error is dimension mismatch
     */
    isDimensionMismatch() {
        return this.code === EmbeddingErrorCode.DIMENSION_MISMATCH;
    }
    /**
     * Check if fallback was used
     */
    isFallbackUsed() {
        return this.code === EmbeddingErrorCode.FALLBACK_USED;
    }
    /**
     * Check if error is retryable
     */
    canRetry() {
        return this.retryable && this.recovery !== RecoveryStrategy.ABORT;
    }
    /**
     * Get recovery information
     */
    getRecoveryInfo() {
        return this.embeddingRecovery;
    }
    /**
     * Get embedding metadata
     */
    getMetadata() {
        return this.embeddingMetadata;
    }
}
export default EmbeddingError;
//# sourceMappingURL=EmbeddingError.js.map