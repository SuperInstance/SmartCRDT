/**
 * Sliding Window Rate Limiter
 *
 * Implements the sliding window log algorithm for rate limiting.
 *
 * Algorithm:
 * - Track timestamp of each request in a circular buffer
 * - Count requests within the current time window
 * - Requests are allowed if count < maxRequests
 * - Requests are denied if count >= maxRequests
 *
 * This provides a more accurate rate limit than fixed window by preventing
 * the "boundary problem" where bursts occur at window boundaries.
 *
 * @example
 * ```typescript
 * const limiter = new SlidingWindowRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000, // 60 seconds
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
 * Sliding window configuration
 */
export interface SlidingWindowConfig {
    /** Maximum number of requests allowed in the time window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
}
/**
 * Sliding Window Rate Limiter
 *
 * Uses a sliding window log algorithm to rate limit requests.
 * Provides accurate rate limiting without boundary spikes.
 */
export declare class SlidingWindowRateLimiter implements RateLimiter {
    private config;
    private state;
    /**
     * Create a new sliding window rate limiter
     *
     * @param config - Rate limiter configuration
     */
    constructor(config: SlidingWindowConfig);
    /**
     * Count requests within the current time window
     *
     * @param now - Current timestamp in milliseconds
     * @returns Number of requests in current window
     */
    private countInWindow;
    /**
     * Find the oldest timestamp in the current window
     *
     * @param now - Current timestamp in milliseconds
     * @returns Oldest timestamp, or now if no valid entries
     */
    private findOldestTimestamp;
    /**
     * Clean up old timestamps and compact buffer
     *
     * @param now - Current timestamp in milliseconds
     */
    private cleanup;
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
     * Adds a timestamp to the sliding window.
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
     * Clears all request history.
     */
    reset(): void;
    /**
     * Get current configuration
     *
     * @returns Current configuration
     */
    getConfig(): SlidingWindowConfig;
    /**
     * Update configuration
     *
     * Note: Updating configuration resets the rate limiter.
     *
     * @param config - Partial configuration to update
     */
    updateConfig(config: Partial<SlidingWindowConfig>): void;
}
/**
 * Factory function to create a sliding window rate limiter
 *
 * @param config - Rate limiter configuration
 * @returns Configured rate limiter
 *
 * @example
 * ```typescript
 * const limiter = createSlidingWindowLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000,
 * });
 * ```
 */
export declare function createSlidingWindowLimiter(config: SlidingWindowConfig): SlidingWindowRateLimiter;
/**
 * Export default class as default
 */
export default SlidingWindowRateLimiter;
//# sourceMappingURL=SlidingWindow.d.ts.map