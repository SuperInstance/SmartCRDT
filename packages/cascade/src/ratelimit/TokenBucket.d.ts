/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm for rate limiting.
 *
 * Algorithm:
 * - Tokens are added to the bucket at a constant rate (refillRate)
 * - Bucket has a maximum capacity (burstCapacity)
 * - Each request consumes one token
 * - Requests are allowed if bucket has tokens
 * - Requests are denied if bucket is empty
 *
 * This allows for bursts of traffic while maintaining a long-term rate limit.
 *
 * @example
 * ```typescript
 * const limiter = new TokenBucketRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000,
 *   refillRate: 10, // 10 tokens per second
 *   burstCapacity: 20, // Allow burst of up to 20 requests
 * });
 *
 * if (await limiter.canMakeRequest()) {
 *   // Make request
 *   limiter.recordRequest();
 * } else {
 *   const waitTime = limiter.getWaitTime();
 *   console.log(`Wait ${waitTime}ms before retrying`);
 * }
 * ```
 */
import type { RateLimiter, RateLimitStats } from "./RateLimiter.js";
/**
 * Token bucket configuration
 */
export interface TokenBucketConfig {
    /** Maximum number of requests allowed in the time window */
    maxRequests: number;
    /** Time window in milliseconds (not directly used, but kept for config compatibility) */
    windowMs: number;
    /** Refill rate in tokens per second */
    refillRate: number;
    /** Maximum number of tokens the bucket can hold (burst capacity) */
    burstCapacity: number;
}
/**
 * Token Bucket Rate Limiter
 *
 * Uses a token bucket algorithm to rate limit requests.
 * Allows for bursts of traffic while maintaining a long-term average rate.
 */
export declare class TokenBucketRateLimiter implements RateLimiter {
    private config;
    private state;
    /**
     * Create a new token bucket rate limiter
     *
     * @param config - Rate limiter configuration
     */
    constructor(config: TokenBucketConfig);
    /**
     * Refill tokens based on elapsed time
     *
     * This is called automatically before checking if a request can be made.
     */
    private refill;
    /**
     * Check if a request can be made (async version)
     *
     * @returns Promise that resolves to true if request is allowed
     */
    canMakeRequest(): Promise<boolean>;
    /**
     * Check if a request can be made (sync version)
     *
     * @returns true if request is allowed, false otherwise
     */
    canMakeRequestSync(): boolean;
    /**
     * Record that a request was made
     *
     * Consumes one token from the bucket.
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
     * Clears all request history and resets token count.
     */
    reset(): void;
    /**
     * Get current configuration
     *
     * @returns Current configuration
     */
    getConfig(): TokenBucketConfig;
    /**
     * Update configuration
     *
     * @param config - Partial configuration to update
     */
    updateConfig(config: Partial<TokenBucketConfig>): void;
}
/**
 * Factory function to create a token bucket rate limiter
 *
 * @param config - Rate limiter configuration
 * @returns Configured rate limiter
 *
 * @example
 * ```typescript
 * const limiter = createTokenBucketLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000,
 *   refillRate: 10,
 *   burstCapacity: 20,
 * });
 * ```
 */
export declare function createTokenBucketLimiter(config: TokenBucketConfig): TokenBucketRateLimiter;
/**
 * Export default class as default
 */
export default TokenBucketRateLimiter;
//# sourceMappingURL=TokenBucket.d.ts.map