/**
 * RateLimitError - Rate limiting errors
 *
 * Provides structured error handling for rate limiting scenarios,
 * with retry information and quota details.
 *
 * @packageDocumentation
 */
import { AdapterError, ErrorSeverity, RecoveryStrategy, } from "./AdapterError.js";
/**
 * Rate limit error codes
 */
export var RateLimitErrorCode;
(function (RateLimitErrorCode) {
    /** Rate limit exceeded */
    RateLimitErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    /** Quota exceeded */
    RateLimitErrorCode["QUOTA_EXCEEDED"] = "RATE_LIMIT_QUOTA_EXCEEDED";
    /** Concurrent request limit */
    RateLimitErrorCode["CONCURRENT_LIMIT"] = "RATE_LIMIT_CONCURRENT_LIMIT";
    /** Daily limit exceeded */
    RateLimitErrorCode["DAILY_LIMIT"] = "RATE_LIMIT_DAILY_LIMIT";
    /** Monthly limit exceeded */
    RateLimitErrorCode["MONTHLY_LIMIT"] = "RATE_LIMIT_MONTHLY_LIMIT";
    /** Unknown rate limit error */
    RateLimitErrorCode["UNKNOWN_ERROR"] = "RATE_LIMIT_UNKNOWN_ERROR";
})(RateLimitErrorCode || (RateLimitErrorCode = {}));
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
export class RateLimitError extends AdapterError {
    /** Rate limit details */
    rateLimit;
    /** Quota information */
    quota;
    /** Suggested retry strategy */
    retryStrategy;
    constructor(operation, message, code, context = {}, cause) {
        super("RateLimit", operation, message, code, context, cause);
        // Extract rate limit specific properties from context
        this.rateLimit = context.rateLimit;
        this.quota = context.quota;
        this.retryStrategy = context.retryStrategy;
    }
    /**
     * Create error for rate limit exceeded
     */
    static rateLimitExceeded(requestsMade, retryAfter, scope = "global", resetsAt, cause) {
        const requestsLimit = requestsMade + 1;
        const details = {
            requestsMade,
            requestsLimit,
            requestsRemaining: 0,
            resetsAt: resetsAt || Math.floor(Date.now() / 1000) + retryAfter,
            retryAfter,
            window: retryAfter,
            scope,
        };
        const retryStrategy = {
            initialDelay: retryAfter * 1000,
            maxDelay: Math.min(retryAfter * 1000 * 4, 60000),
            backoffMultiplier: 2,
            maxRetries: 3,
        };
        return new RateLimitError("rateLimitCheck", `Rate limit exceeded: ${requestsMade}/${requestsLimit} requests. Retry after ${retryAfter}s.`, RateLimitErrorCode.RATE_LIMIT_EXCEEDED, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.RETRY,
            retryable: true,
            statusCode: 429,
            rateLimit: details,
            retryStrategy,
        }, cause);
    }
    /**
     * Create error for quota exceeded
     */
    static quotaExceeded(maximum, current, resetsAt, scope = "daily", cause) {
        const remaining = maximum - current;
        const resetInterval = scope === "daily" ? 86400 : 2592000; // 1 day or 30 days
        const quota = {
            current,
            maximum,
            remaining,
            resetsAt,
            resetInterval,
        };
        return new RateLimitError("quotaCheck", `Quota exceeded: ${current}/${maximum} ${scope} requests used. Resets at ${new Date(resetsAt * 1000).toISOString()}.`, scope === "daily"
            ? RateLimitErrorCode.DAILY_LIMIT
            : RateLimitErrorCode.MONTHLY_LIMIT, {
            severity: ErrorSeverity.HIGH,
            recovery: RecoveryStrategy.MANUAL,
            retryable: false,
            statusCode: 429,
            quota,
            context: { scope },
        }, cause);
    }
    /**
     * Create error for concurrent request limit
     */
    static concurrentLimit(activeRequests, maxConcurrent, cause) {
        const details = {
            requestsMade: activeRequests,
            requestsLimit: maxConcurrent,
            requestsRemaining: 0,
            resetsAt: 0,
            retryAfter: 1, // Retry quickly
            window: 1,
            scope: "per-api-key",
        };
        const retryStrategy = {
            initialDelay: 100,
            maxDelay: 1000,
            backoffMultiplier: 1.5,
            maxRetries: 10,
        };
        return new RateLimitError("concurrentCheck", `Concurrent request limit exceeded: ${activeRequests}/${maxConcurrent} active requests.`, RateLimitErrorCode.CONCURRENT_LIMIT, {
            severity: ErrorSeverity.LOW,
            recovery: RecoveryStrategy.RETRY,
            retryable: true,
            statusCode: 429,
            rateLimit: details,
            retryStrategy,
        }, cause);
    }
    /**
     * Create error for daily limit exceeded
     */
    static dailyLimit(dailyLimit, dailyUsed, resetsAt, cause) {
        return RateLimitError.quotaExceeded(dailyLimit, dailyUsed, resetsAt, "daily", cause);
    }
    /**
     * Create error for monthly limit exceeded
     */
    static monthlyLimit(monthlyLimit, monthlyUsed, resetsAt, cause) {
        return RateLimitError.quotaExceeded(monthlyLimit, monthlyUsed, resetsAt, "monthly", cause);
    }
    /**
     * Create error for unknown rate limit issues
     */
    static unknown(operation, message, cause) {
        return new RateLimitError(operation, `Unknown rate limit error: ${message}`, RateLimitErrorCode.UNKNOWN_ERROR, {
            severity: ErrorSeverity.MEDIUM,
            recovery: RecoveryStrategy.ABORT,
            retryable: false,
        }, cause);
    }
    /**
     * Calculate wait time before retry
     */
    getWaitTime() {
        if (this.rateLimit?.retryAfter) {
            return this.rateLimit.retryAfter * 1000;
        }
        if (this.quota?.resetsAt) {
            const waitMs = this.quota.resetsAt * 1000 - Date.now();
            return Math.max(0, waitMs);
        }
        return 60000; // Default 60 seconds
    }
    /**
     * Check if rate limit has reset
     */
    hasReset() {
        const now = Date.now() / 1000;
        if (this.rateLimit?.resetsAt) {
            return now >= this.rateLimit.resetsAt;
        }
        if (this.quota?.resetsAt) {
            return now >= this.quota.resetsAt;
        }
        return false;
    }
    /**
     * Get time until reset
     */
    getTimeUntilReset() {
        const now = Date.now() / 1000;
        if (this.rateLimit?.resetsAt) {
            return Math.max(0, this.rateLimit.resetsAt - now);
        }
        if (this.quota?.resetsAt) {
            return Math.max(0, this.quota.resetsAt - now);
        }
        return 0;
    }
    /**
     * Format reset time as human-readable string
     */
    getResetTimeString() {
        const seconds = this.getTimeUntilReset();
        if (seconds === 0) {
            return "now";
        }
        if (seconds < 60) {
            return `${Math.ceil(seconds)} seconds`;
        }
        if (seconds < 3600) {
            const minutes = Math.ceil(seconds / 60);
            return `${minutes} minute${minutes > 1 ? "s" : ""}`;
        }
        const hours = Math.ceil(seconds / 3600);
        return `${hours} hour${hours > 1 ? "s" : ""}`;
    }
    /**
     * Get retry strategy
     */
    getRetryStrategy() {
        return this.retryStrategy;
    }
    /**
     * Get rate limit details
     */
    getRateLimitDetails() {
        return this.rateLimit;
    }
    /**
     * Get quota information
     */
    getQuota() {
        return this.quota;
    }
    /**
     * Check if error is recoverable by waiting
     */
    isRecoverableByWaiting() {
        return this.retryable && this.getTimeUntilReset() > 0;
    }
}
export default RateLimitError;
//# sourceMappingURL=RateLimitError.js.map