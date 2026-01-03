/**
 * OpenAIAdapterError - OpenAI-specific adapter errors
 *
 * Provides structured error handling for OpenAI API interactions,
 * with specific error codes and recovery strategies for common scenarios.
 *
 * @packageDocumentation
 */
import { AdapterError, ErrorSeverity, RecoveryStrategy, } from "./AdapterError.js";
/**
 * OpenAI-specific error codes
 */
export var OpenAIErrorCode;
(function (OpenAIErrorCode) {
    /** Authentication failed */
    OpenAIErrorCode["AUTH_FAILED"] = "OPENAI_AUTH_FAILED";
    /** Rate limit exceeded */
    OpenAIErrorCode["RATE_LIMIT"] = "OPENAI_RATE_LIMIT";
    /** Quota exceeded */
    OpenAIErrorCode["QUOTA_EXCEEDED"] = "OPENAI_QUOTA_EXCEEDED";
    /** Invalid request */
    OpenAIErrorCode["INVALID_REQUEST"] = "OPENAI_INVALID_REQUEST";
    /** Model not found */
    OpenAIErrorCode["MODEL_NOT_FOUND"] = "OPENAI_MODEL_NOT_FOUND";
    /** Content filter triggered */
    OpenAIErrorCode["CONTENT_FILTER"] = "OPENAI_CONTENT_FILTER";
    /** Server error */
    OpenAIErrorCode["SERVER_ERROR"] = "OPENAI_SERVER_ERROR";
    /** Timeout */
    OpenAIErrorCode["TIMEOUT"] = "OPENAI_TIMEOUT";
    /** Network error */
    OpenAIErrorCode["NETWORK_ERROR"] = "OPENAI_NETWORK_ERROR";
    /** Context length exceeded */
    OpenAIErrorCode["CONTEXT_LENGTH"] = "OPENAI_CONTEXT_LENGTH";
    /** Unknown error */
    OpenAIErrorCode["UNKNOWN_ERROR"] = "OPENAI_UNKNOWN_ERROR";
})(OpenAIErrorCode || (OpenAIErrorCode = {}));
/**
 * OpenAIAdapterError - OpenAI-specific error class
 *
 * @example
 * ```typescript
 * throw OpenAIAdapterError.authFailed();
 * throw OpenAIAdapterError.rateLimit(100, 60);
 * throw OpenAIAdapterError.modelNotFound('gpt-4');
 * ```
 */
export class OpenAIAdapterError extends AdapterError {
    /** OpenAI-specific recovery information */
    openaiRecovery;
    /** Request ID from OpenAI (for support) */
    openaiRequestId;
    constructor(operation, message, code, context = {}, cause) {
        super("OpenAI", operation, message, code, context, cause);
        // Extract OpenAI-specific properties from context
        this.openaiRecovery = context.openaiRecovery;
        this.openaiRequestId = context.openaiRequestId;
    }
    /**
     * Create error for authentication failure
     */
    static authFailed(cause) {
        return new OpenAIAdapterError("authenticate", "OpenAI authentication failed. Please check your API key.", OpenAIErrorCode.AUTH_FAILED, {
            severity: ErrorSeverity.HIGH,
            recovery: RecoveryStrategy.MANUAL,
            retryable: false,
            statusCode: 401,
            openaiRecovery: {
                checkApiKey: true,
            },
        }, cause);
    }
    /**
     * Create error for rate limit exceeded
     */
    static rateLimit(retryAfter, rateLimitInfo, cause) {
        const waitTime = retryAfter ? retryAfter * 1000 : 60000;
        return new OpenAIAdapterError("generate", `OpenAI rate limit exceeded. Please retry after ${retryAfter || 60} seconds.`, OpenAIErrorCode.RATE_LIMIT, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.RETRY,
            retryable: true,
            statusCode: 429,
            openaiRecovery: {
                waitTime,
                rateLimit: rateLimitInfo,
            },
        }, cause);
    }
    /**
     * Create error for quota exceeded
     */
    static quotaExceeded(cause) {
        return new OpenAIAdapterError("generate", "OpenAI quota exceeded. Please check your usage and billing details.", OpenAIErrorCode.QUOTA_EXCEEDED, {
            severity: ErrorSeverity.CRITICAL,
            recovery: RecoveryStrategy.MANUAL,
            retryable: false,
            statusCode: 429,
            openaiRecovery: {
                checkApiKey: true,
            },
        }, cause);
    }
    /**
     * Create error for invalid request
     */
    static invalidRequest(message, param, cause) {
        return new OpenAIAdapterError("generate", `Invalid request: ${message}`, OpenAIErrorCode.INVALID_REQUEST, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.ABORT,
            retryable: false,
            statusCode: 400,
            context: { param },
        }, cause);
    }
    /**
     * Create error for model not found
     */
    static modelNotFound(modelName, cause) {
        return new OpenAIAdapterError("generate", `Model not found: ${modelName}`, OpenAIErrorCode.MODEL_NOT_FOUND, {
            severity: ErrorSeverity.HIGH,
            recovery: RecoveryStrategy.FALLBACK,
            retryable: false,
            statusCode: 404,
            context: { modelName },
            openaiRecovery: {
                alternativeModel: "gpt-3.5-turbo",
            },
        }, cause);
    }
    /**
     * Create error for content filter
     */
    static contentFilter(message = "Content flagged by OpenAI content filter", cause) {
        return new OpenAIAdapterError("generate", message, OpenAIErrorCode.CONTENT_FILTER, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.ABORT,
            retryable: false,
            statusCode: 400,
            openaiRecovery: {
                contentFiltered: true,
            },
        }, cause);
    }
    /**
     * Create error for server error
     */
    static serverError(statusCode = 500, cause) {
        return new OpenAIAdapterError("generate", `OpenAI server error: ${statusCode}`, OpenAIErrorCode.SERVER_ERROR, {
            severity: ErrorSeverity.LOW,
            recovery: RecoveryStrategy.RETRY,
            retryable: true,
            statusCode,
            openaiRecovery: {
                waitTime: 2000,
            },
        }, cause);
    }
    /**
     * Create error for timeout
     */
    static timeout(timeoutMs, operation = "generate", cause) {
        return new OpenAIAdapterError(operation, `Request timeout after ${timeoutMs}ms`, OpenAIErrorCode.TIMEOUT, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.RETRY,
            retryable: true,
            openaiRecovery: {
                waitTime: Math.min(timeoutMs * 2, 30000),
            },
        }, cause);
    }
    /**
     * Create error for network error
     */
    static networkError(message, cause) {
        return new OpenAIAdapterError("connect", `Network error: ${message}`, OpenAIErrorCode.NETWORK_ERROR, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.RETRY,
            retryable: true,
            openaiRecovery: {
                waitTime: 5000,
            },
        }, cause);
    }
    /**
     * Create error for context length exceeded
     */
    static contextLengthExceeded(modelName, maxLength, actualLength, cause) {
        return new OpenAIAdapterError("generate", `Context length exceeded for ${modelName}. Maximum: ${maxLength}, Actual: ${actualLength}`, OpenAIErrorCode.CONTEXT_LENGTH, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.DEGRADE,
            retryable: false,
            statusCode: 400,
            context: {
                modelName,
                maxLength,
                actualLength,
            },
        }, cause);
    }
    /**
     * Create error for unknown issues
     */
    static unknown(operation, message, cause) {
        return new OpenAIAdapterError(operation, `Unknown error: ${message}`, OpenAIErrorCode.UNKNOWN_ERROR, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.ABORT,
            retryable: false,
        }, cause);
    }
    /**
     * Create OpenAIAdapterError from Axios error
     * Overrides base class method to provide OpenAI-specific error handling
     */
    static fromAxiosError(adapterName, operation, axiosError) {
        const statusCode = axiosError.response?.status;
        const responseData = axiosError.response?.data;
        // Extract request ID from headers
        const headers = axiosError.response?.headers;
        const requestIdHeader = headers?.["x-request-id"];
        const baseContext = requestIdHeader
            ? { openaiRequestId: requestIdHeader }
            : {};
        // Extract rate limit info from headers
        const rateLimitInfo = {
            remaining: headers?.["x-ratelimit-remaining"]
                ? parseInt(headers["x-ratelimit-remaining"])
                : undefined,
            limit: headers?.["x-ratelimit-limit"]
                ? parseInt(headers["x-ratelimit-limit"])
                : undefined,
            reset: headers?.["x-ratelimit-reset"]
                ? parseInt(headers["x-ratelimit-reset"])
                : undefined,
            retryAfter: headers?.["retry-after"]
                ? parseInt(headers["retry-after"])
                : undefined,
        };
        // Extract error message from response
        const errorMessage = responseData?.error?.message || axiosError.message;
        const errorCode = responseData?.error?.code;
        const errorParam = responseData?.error?.param;
        // Map status codes to specific errors
        if (statusCode === 401) {
            return new OpenAIAdapterError("authenticate", "OpenAI authentication failed. Please check your API key.", OpenAIErrorCode.AUTH_FAILED, {
                ...baseContext,
                severity: ErrorSeverity.HIGH,
                recovery: RecoveryStrategy.MANUAL,
                retryable: false,
                statusCode: 401,
                openaiRecovery: {
                    checkApiKey: true,
                },
            }, axiosError);
        }
        if (statusCode === 429) {
            // Check if it's quota exceeded or rate limit
            if (errorCode === "quota_exceeded") {
                return new OpenAIAdapterError("generate", "OpenAI quota exceeded. Please check your usage and billing details.", OpenAIErrorCode.QUOTA_EXCEEDED, {
                    ...baseContext,
                    severity: ErrorSeverity.CRITICAL,
                    recovery: RecoveryStrategy.MANUAL,
                    retryable: false,
                    statusCode: 429,
                    openaiRecovery: {
                        checkApiKey: true,
                    },
                }, axiosError);
            }
            return new OpenAIAdapterError("generate", `OpenAI rate limit exceeded. Please retry after ${rateLimitInfo.retryAfter || 60} seconds.`, OpenAIErrorCode.RATE_LIMIT, {
                ...baseContext,
                severity: ErrorSeverity.MEDIUM,
                recovery: RecoveryStrategy.RETRY,
                retryable: true,
                statusCode: 429,
                openaiRecovery: {
                    waitTime: (rateLimitInfo.retryAfter || 60) * 1000,
                    rateLimit: rateLimitInfo,
                },
            }, axiosError);
        }
        if (statusCode === 404) {
            return new OpenAIAdapterError("generate", `Model not found: ${errorParam || "unknown"}`, OpenAIErrorCode.MODEL_NOT_FOUND, {
                ...baseContext,
                severity: ErrorSeverity.HIGH,
                recovery: RecoveryStrategy.FALLBACK,
                retryable: false,
                statusCode: 404,
                context: { modelName: errorParam },
                openaiRecovery: {
                    alternativeModel: "gpt-3.5-turbo",
                },
            }, axiosError);
        }
        if (statusCode === 400) {
            if (errorCode === "content_filter") {
                return new OpenAIAdapterError("generate", errorMessage, OpenAIErrorCode.CONTENT_FILTER, {
                    ...baseContext,
                    severity: ErrorSeverity.MEDIUM,
                    recovery: RecoveryStrategy.ABORT,
                    retryable: false,
                    statusCode: 400,
                    openaiRecovery: {
                        contentFiltered: true,
                    },
                }, axiosError);
            }
            if (errorCode === "context_length_exceeded") {
                // Parse context length from error message if available
                return new OpenAIAdapterError("generate", `Context length exceeded for model. Maximum: 0, Actual: 0`, OpenAIErrorCode.CONTEXT_LENGTH, {
                    ...baseContext,
                    severity: ErrorSeverity.MEDIUM,
                    recovery: RecoveryStrategy.DEGRADE,
                    retryable: false,
                    statusCode: 400,
                    context: {
                        modelName: "unknown",
                        maxLength: 0,
                        actualLength: 0,
                    },
                }, axiosError);
            }
            return new OpenAIAdapterError("generate", `Invalid request: ${errorMessage}`, OpenAIErrorCode.INVALID_REQUEST, {
                ...baseContext,
                severity: ErrorSeverity.MEDIUM,
                recovery: RecoveryStrategy.ABORT,
                retryable: false,
                statusCode: 400,
                context: { param: errorParam },
            }, axiosError);
        }
        if (statusCode && statusCode >= 500) {
            return new OpenAIAdapterError("generate", `OpenAI server error: ${statusCode}`, OpenAIErrorCode.SERVER_ERROR, {
                ...baseContext,
                severity: ErrorSeverity.LOW,
                recovery: RecoveryStrategy.RETRY,
                retryable: true,
                statusCode,
                openaiRecovery: {
                    waitTime: 2000,
                },
            }, axiosError);
        }
        // Network errors
        if (axiosError.code === "ETIMEDOUT" || axiosError.code === "ECONNABORTED") {
            const timeout = parseInt(axiosError.config?.timeout?.toString() || "30000");
            return new OpenAIAdapterError(operation, `Request timeout after ${timeout}ms`, OpenAIErrorCode.TIMEOUT, {
                ...baseContext,
                severity: ErrorSeverity.MEDIUM,
                recovery: RecoveryStrategy.RETRY,
                retryable: true,
                openaiRecovery: {
                    waitTime: Math.min(timeout * 2, 30000),
                },
            }, axiosError);
        }
        if (axiosError.code === "ECONNREFUSED" || axiosError.code === "ENOTFOUND") {
            return new OpenAIAdapterError("connect", `Network error: ${axiosError.message}`, OpenAIErrorCode.NETWORK_ERROR, {
                ...baseContext,
                severity: ErrorSeverity.MEDIUM,
                recovery: RecoveryStrategy.RETRY,
                retryable: true,
                openaiRecovery: {
                    waitTime: 5000,
                },
            }, axiosError);
        }
        // Unknown error
        return new OpenAIAdapterError(operation, `Unknown error: ${errorMessage}`, OpenAIErrorCode.UNKNOWN_ERROR, {
            ...baseContext,
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.ABORT,
            retryable: false,
        }, axiosError);
    }
    /**
     * Check if error is authentication failure
     */
    isAuthFailed() {
        return this.code === OpenAIErrorCode.AUTH_FAILED;
    }
    /**
     * Check if error is rate limit
     */
    isRateLimit() {
        return this.code === OpenAIErrorCode.RATE_LIMIT;
    }
    /**
     * Check if error is quota exceeded
     */
    isQuotaExceeded() {
        return this.code === OpenAIErrorCode.QUOTA_EXCEEDED;
    }
    /**
     * Check if error is model not found
     */
    isModelNotFound() {
        return this.code === OpenAIErrorCode.MODEL_NOT_FOUND;
    }
    /**
     * Check if error is content filter
     */
    isContentFilter() {
        return this.code === OpenAIErrorCode.CONTENT_FILTER;
    }
    /**
     * Get recovery information
     */
    getRecoveryInfo() {
        return this.openaiRecovery;
    }
    /**
     * Get OpenAI request ID for support
     */
    getOpenAIRequestId() {
        return this.openaiRequestId;
    }
}
export default OpenAIAdapterError;
//# sourceMappingURL=OpenAIAdapterError.js.map