/**
 * OpenAIAdapterError - OpenAI-specific adapter errors
 *
 * Provides structured error handling for OpenAI API interactions,
 * with specific error codes and recovery strategies for common scenarios.
 *
 * @packageDocumentation
 */
import { AdapterError } from "./AdapterError.js";
import type { AxiosError } from "axios";
/**
 * OpenAI-specific error codes
 */
export declare enum OpenAIErrorCode {
    /** Authentication failed */
    AUTH_FAILED = "OPENAI_AUTH_FAILED",
    /** Rate limit exceeded */
    RATE_LIMIT = "OPENAI_RATE_LIMIT",
    /** Quota exceeded */
    QUOTA_EXCEEDED = "OPENAI_QUOTA_EXCEEDED",
    /** Invalid request */
    INVALID_REQUEST = "OPENAI_INVALID_REQUEST",
    /** Model not found */
    MODEL_NOT_FOUND = "OPENAI_MODEL_NOT_FOUND",
    /** Content filter triggered */
    CONTENT_FILTER = "OPENAI_CONTENT_FILTER",
    /** Server error */
    SERVER_ERROR = "OPENAI_SERVER_ERROR",
    /** Timeout */
    TIMEOUT = "OPENAI_TIMEOUT",
    /** Network error */
    NETWORK_ERROR = "OPENAI_NETWORK_ERROR",
    /** Context length exceeded */
    CONTEXT_LENGTH = "OPENAI_CONTEXT_LENGTH",
    /** Unknown error */
    UNKNOWN_ERROR = "OPENAI_UNKNOWN_ERROR"
}
/**
 * OpenAI API error response structure
 */
export interface OpenAIErrorResponse {
    /** Error object */
    error: {
        /** Error message */
        message: string;
        /** Error type */
        type: string;
        /** Error code */
        code?: string;
        /** Error parameter */
        param?: string;
    };
}
/**
 * Rate limit information
 */
export interface RateLimitInfo {
    /** Requests remaining */
    remaining?: number;
    /** Requests limit */
    limit?: number;
    /** Reset time (Unix timestamp) */
    reset?: number;
    /** Retry-After header value */
    retryAfter?: number;
}
/**
 * Error recovery information specific to OpenAI
 */
export interface OpenAIRecoveryInfo {
    /** Rate limit information */
    rateLimit?: RateLimitInfo;
    /** Suggested wait time before retry (ms) */
    waitTime?: number;
    /** Suggested alternative model */
    alternativeModel?: string;
    /** Whether to check API key */
    checkApiKey?: boolean;
    /** Whether content was filtered */
    contentFiltered?: boolean;
}
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
export declare class OpenAIAdapterError extends AdapterError {
    /** OpenAI-specific recovery information */
    readonly openaiRecovery?: OpenAIRecoveryInfo;
    /** Request ID from OpenAI (for support) */
    readonly openaiRequestId?: string;
    private constructor();
    /**
     * Create error for authentication failure
     */
    static authFailed(cause?: Error): OpenAIAdapterError;
    /**
     * Create error for rate limit exceeded
     */
    static rateLimit(retryAfter?: number, rateLimitInfo?: RateLimitInfo, cause?: Error): OpenAIAdapterError;
    /**
     * Create error for quota exceeded
     */
    static quotaExceeded(cause?: Error): OpenAIAdapterError;
    /**
     * Create error for invalid request
     */
    static invalidRequest(message: string, param?: string, cause?: Error): OpenAIAdapterError;
    /**
     * Create error for model not found
     */
    static modelNotFound(modelName: string, cause?: Error): OpenAIAdapterError;
    /**
     * Create error for content filter
     */
    static contentFilter(message?: string, cause?: Error): OpenAIAdapterError;
    /**
     * Create error for server error
     */
    static serverError(statusCode?: number, cause?: Error): OpenAIAdapterError;
    /**
     * Create error for timeout
     */
    static timeout(timeoutMs: number, operation?: string, cause?: Error): OpenAIAdapterError;
    /**
     * Create error for network error
     */
    static networkError(message: string, cause?: Error): OpenAIAdapterError;
    /**
     * Create error for context length exceeded
     */
    static contextLengthExceeded(modelName: string, maxLength: number, actualLength: number, cause?: Error): OpenAIAdapterError;
    /**
     * Create error for unknown issues
     */
    static unknown(operation: string, message: string, cause?: Error): OpenAIAdapterError;
    /**
     * Create OpenAIAdapterError from Axios error
     * Overrides base class method to provide OpenAI-specific error handling
     */
    static fromAxiosError(adapterName: string, operation: string, axiosError: AxiosError<unknown>): OpenAIAdapterError;
    /**
     * Check if error is authentication failure
     */
    isAuthFailed(): boolean;
    /**
     * Check if error is rate limit
     */
    isRateLimit(): boolean;
    /**
     * Check if error is quota exceeded
     */
    isQuotaExceeded(): boolean;
    /**
     * Check if error is model not found
     */
    isModelNotFound(): boolean;
    /**
     * Check if error is content filter
     */
    isContentFilter(): boolean;
    /**
     * Get recovery information
     */
    getRecoveryInfo(): OpenAIRecoveryInfo | undefined;
    /**
     * Get OpenAI request ID for support
     */
    getOpenAIRequestId(): string | undefined;
}
export default OpenAIAdapterError;
//# sourceMappingURL=OpenAIAdapterError.d.ts.map