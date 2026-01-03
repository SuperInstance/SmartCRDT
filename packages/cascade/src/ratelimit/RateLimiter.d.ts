/**
 * Rate Limiter Module
 *
 * Provides configurable rate limiting to prevent DoS vulnerabilities and API quota exhaustion.
 * Supports multiple algorithms: TokenBucket and SlidingWindow.
 *
 * @module ratelimit
 */
/**
 * Rate limit statistics
 */
export interface RateLimitStats {
    /** Number of requests made */
    requestsMade: number;
    /** Number of requests that were limited */
    requestsLimited: number;
    /** Current token count (for token bucket) or request count in window (for sliding window) */
    currentCount: number;
    /** Timestamp when the limit will reset (ms since epoch) */
    resetTime: number;
    /** Maximum requests allowed */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
}
/**
 * Rate limiter interface
 *
 * All rate limiter implementations must implement this interface.
 */
export interface RateLimiter {
    /**
     * Check if a request can be made
     *
     * @returns Promise that resolves to true if request is allowed, false otherwise
     */
    canMakeRequest(): Promise<boolean>;
    /**
     * Check if a request can be made (synchronous version)
     *
     * @returns true if request is allowed, false otherwise
     */
    canMakeRequestSync(): boolean;
    /**
     * Record that a request was made
     *
     * This should be called after a successful request is made.
     */
    recordRequest(): void;
    /**
     * Get the wait time in milliseconds until the next request can be made
     *
     * @returns Wait time in milliseconds (0 if request can be made now)
     */
    getWaitTime(): number;
    /**
     * Get current rate limit statistics
     *
     * @returns Current statistics
     */
    getStats(): RateLimitStats;
    /**
     * Reset the rate limiter
     *
     * Clears all request history and token counts.
     */
    reset(): void;
}
/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
    /** Maximum number of requests allowed in the time window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
    /** Rate limiter algorithm to use */
    algorithm: "token-bucket" | "sliding-window";
    /** Token bucket specific: refill rate in tokens per second (only for token-bucket) */
    refillRate?: number;
    /** Token bucket specific: burst capacity (maximum tokens, only for token-bucket) */
    burstCapacity?: number;
}
/**
 * Default rate limiter configuration
 */
export declare const DEFAULT_RATE_LIMIT_CONFIG: Omit<RateLimiterConfig, "maxRequests" | "windowMs">;
/**
 * Rate limit error
 *
 * Thrown when a rate limit is exceeded.
 */
export declare class RateLimitError extends Error {
    readonly waitTime: number;
    readonly stats: RateLimitStats;
    /**
     * Create a new rate limit error
     *
     * @param message - Error message
     * @param waitTime - Time to wait in milliseconds before retrying
     * @param stats - Current rate limit statistics
     */
    constructor(message: string, waitTime: number, stats: RateLimitStats);
    /**
     * Get a human-readable message with wait time
     *
     * @returns Formatted error message
     */
    getFormattedMessage(): string;
}
//# sourceMappingURL=RateLimiter.d.ts.map