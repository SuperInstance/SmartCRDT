/**
 * Rate Limiter Module
 *
 * Provides configurable rate limiting to prevent DoS vulnerabilities and API quota exhaustion.
 * Supports multiple algorithms: TokenBucket and SlidingWindow.
 *
 * @module ratelimit
 */
/**
 * Default rate limiter configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG = {
    algorithm: "token-bucket",
    refillRate: 10, // 10 tokens per second
    burstCapacity: 20, // Allow burst of up to 20 requests
};
/**
 * Rate limit error
 *
 * Thrown when a rate limit is exceeded.
 */
export class RateLimitError extends Error {
    waitTime;
    stats;
    /**
     * Create a new rate limit error
     *
     * @param message - Error message
     * @param waitTime - Time to wait in milliseconds before retrying
     * @param stats - Current rate limit statistics
     */
    constructor(message, waitTime, stats) {
        super(message);
        this.waitTime = waitTime;
        this.stats = stats;
        this.name = "RateLimitError";
    }
    /**
     * Get a human-readable message with wait time
     *
     * @returns Formatted error message
     */
    getFormattedMessage() {
        const seconds = Math.ceil(this.waitTime / 1000);
        return `${this.message}. Wait ${seconds} second${seconds !== 1 ? "s" : ""} before retrying.`;
    }
}
//# sourceMappingURL=RateLimiter.js.map