/**
 * RateLimitError - Rate limiting errors
 *
 * Provides structured error handling for rate limiting scenarios,
 * with retry information and quota details.
 *
 * @packageDocumentation
 */
import { AdapterError } from "./AdapterError.js";
/**
 * Rate limit error codes
 */
export declare enum RateLimitErrorCode {
    /** Rate limit exceeded */
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    /** Quota exceeded */
    QUOTA_EXCEEDED = "RATE_LIMIT_QUOTA_EXCEEDED",
    /** Concurrent request limit */
    CONCURRENT_LIMIT = "RATE_LIMIT_CONCURRENT_LIMIT",
    /** Daily limit exceeded */
    DAILY_LIMIT = "RATE_LIMIT_DAILY_LIMIT",
    /** Monthly limit exceeded */
    MONTHLY_LIMIT = "RATE_LIMIT_MONTHLY_LIMIT",
    /** Unknown rate limit error */
    UNKNOWN_ERROR = "RATE_LIMIT_UNKNOWN_ERROR"
}
/**
 * Rate limit quota information
 */
export interface RateLimitQuota {
    /** Current usage */
    current: number;
    /** Maximum allowed */
    maximum: number;
    /** Remaining quota */
    remaining: number;
    /** When quota resets (Unix timestamp) */
    resetsAt: number;
    /** Reset interval in seconds */
    resetInterval: number;
}
/**
 * Rate limit details
 */
export interface RateLimitDetails {
    /** Requests made in current window */
    requestsMade: number;
    /** Maximum requests allowed */
    requestsLimit: number;
    /** Requests remaining */
    requestsRemaining: number;
    /** When rate limit resets (Unix timestamp) */
    resetsAt: number;
    /** Retry-After header value (seconds) */
    retryAfter: number;
    /** Rate limit window (seconds) */
    window: number;
    /** Scope of rate limit */
    scope: "global" | "per-api-key" | "per-model" | "per-user";
}
/**
 * Retry strategy for rate limits
 */
export interface RetryStrategy {
    /** Initial delay before retry (ms) */
    initialDelay: number;
    /** Maximum delay between retries (ms) */
    maxDelay: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
    /** Maximum retry attempts */
    maxRetries: number;
}
/**
 * RateLimitError - Rate limit error class
 *
 * @example
 * ```typescript
 * throw RateLimitError.rateLimitExceeded(100, 60, 'global');
 * throw RateLimitError.quotaExceeded(1000, 950, Date.now() / 1000 + 86400);
 * throw RateLimitError.concurrentLimit(10);
 * ```
 */
export declare class RateLimitError extends AdapterError {
    /** Rate limit details */
    readonly rateLimit?: RateLimitDetails;
    /** Quota information */
    readonly quota?: RateLimitQuota;
    /** Suggested retry strategy */
    readonly retryStrategy?: RetryStrategy;
    private constructor();
    /**
     * Create error for rate limit exceeded
     */
    static rateLimitExceeded(requestsMade: number, retryAfter: number, scope?: RateLimitDetails["scope"], resetsAt?: number, cause?: Error): RateLimitError;
    /**
     * Create error for quota exceeded
     */
    static quotaExceeded(maximum: number, current: number, resetsAt: number, scope?: "daily" | "monthly", cause?: Error): RateLimitError;
    /**
     * Create error for concurrent request limit
     */
    static concurrentLimit(activeRequests: number, maxConcurrent: number, cause?: Error): RateLimitError;
    /**
     * Create error for daily limit exceeded
     */
    static dailyLimit(dailyLimit: number, dailyUsed: number, resetsAt: number, cause?: Error): RateLimitError;
    /**
     * Create error for monthly limit exceeded
     */
    static monthlyLimit(monthlyLimit: number, monthlyUsed: number, resetsAt: number, cause?: Error): RateLimitError;
    /**
     * Create error for unknown rate limit issues
     */
    static unknown(operation: string, message: string, cause?: Error): RateLimitError;
    /**
     * Calculate wait time before retry
     */
    getWaitTime(): number;
    /**
     * Check if rate limit has reset
     */
    hasReset(): boolean;
    /**
     * Get time until reset
     */
    getTimeUntilReset(): number;
    /**
     * Format reset time as human-readable string
     */
    getResetTimeString(): string;
    /**
     * Get retry strategy
     */
    getRetryStrategy(): RetryStrategy | undefined;
    /**
     * Get rate limit details
     */
    getRateLimitDetails(): RateLimitDetails | undefined;
    /**
     * Get quota information
     */
    getQuota(): RateLimitQuota | undefined;
    /**
     * Check if error is recoverable by waiting
     */
    isRecoverableByWaiting(): boolean;
}
export default RateLimitError;
//# sourceMappingURL=RateLimitError.d.ts.map