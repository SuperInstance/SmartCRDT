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
/**
 * Sliding Window Rate Limiter
 *
 * Uses a sliding window log algorithm to rate limit requests.
 * Provides accurate rate limiting without boundary spikes.
 */
export class SlidingWindowRateLimiter {
    config;
    state;
    /**
     * Create a new sliding window rate limiter
     *
     * @param config - Rate limiter configuration
     */
    constructor(config) {
        this.config = config;
        // Initialize circular buffer with maxRequests capacity
        this.state = {
            timestamps: new Array(config.maxRequests).fill(0),
            position: 0,
            count: 0,
            requestsMade: 0,
            requestsLimited: 0,
        };
    }
    /**
     * Count requests within the current time window
     *
     * @param now - Current timestamp in milliseconds
     * @returns Number of requests in current window
     */
    countInWindow(now) {
        const windowStart = now - this.config.windowMs;
        let windowCount = 0;
        // Count valid entries
        for (let i = 0; i < this.state.count; i++) {
            // Calculate index in circular buffer
            // The oldest entry is at (position - count + 1) mod maxRequests
            // The newest entry is at position
            const idx = (this.state.position -
                this.state.count +
                1 +
                i +
                this.config.maxRequests) %
                this.config.maxRequests;
            if (this.state.timestamps[idx] > windowStart) {
                windowCount++;
            }
        }
        return windowCount;
    }
    /**
     * Find the oldest timestamp in the current window
     *
     * @param now - Current timestamp in milliseconds
     * @returns Oldest timestamp, or now if no valid entries
     */
    findOldestTimestamp(now) {
        const windowStart = now - this.config.windowMs;
        let oldest = now;
        for (let i = 0; i < this.state.count; i++) {
            const idx = (this.state.position -
                this.state.count +
                1 +
                i +
                this.config.maxRequests) %
                this.config.maxRequests;
            const ts = this.state.timestamps[idx];
            if (ts > windowStart && ts < oldest) {
                oldest = ts;
            }
        }
        return oldest;
    }
    /**
     * Clean up old timestamps and compact buffer
     *
     * @param now - Current timestamp in milliseconds
     */
    cleanup(now) {
        const windowStart = now - this.config.windowMs;
        let validCount = 0;
        // First, count valid entries and find the newest valid entry
        for (let i = 0; i < this.state.count; i++) {
            const idx = (this.state.position -
                this.state.count +
                1 +
                i +
                this.config.maxRequests) %
                this.config.maxRequests;
            if (this.state.timestamps[idx] > windowStart) {
                validCount++;
            }
        }
        // If all entries are valid, no cleanup needed
        if (validCount === this.state.count) {
            return;
        }
        // If no valid entries, reset
        if (validCount === 0) {
            this.state.count = 0;
            this.state.position = 0;
            return;
        }
        // Compact the buffer by moving valid entries to the front
        const validTimestamps = [];
        for (let i = 0; i < this.state.count; i++) {
            const idx = (this.state.position -
                this.state.count +
                1 +
                i +
                this.config.maxRequests) %
                this.config.maxRequests;
            if (this.state.timestamps[idx] > windowStart) {
                validTimestamps.push(this.state.timestamps[idx]);
            }
        }
        // Rebuild the buffer with valid entries
        this.state.timestamps.fill(0);
        for (let i = 0; i < validTimestamps.length; i++) {
            this.state.timestamps[i] = validTimestamps[i];
        }
        // Update state
        this.state.count = validTimestamps.length;
        this.state.position = validTimestamps.length - 1;
    }
    /**
     * Check if a request can be made (async version)
     *
     * @returns Promise that resolves to true if request is allowed
     */
    async canMakeRequest() {
        return this.canMakeRequestSync();
    }
    /**
     * Check if a request can be made (sync version)
     *
     * @returns true if request is allowed, false otherwise
     */
    canMakeRequestSync() {
        const now = Date.now();
        // Clean up old entries
        this.cleanup(now);
        // Count requests in window
        const windowCount = this.countInWindow(now);
        // Check if we're under the limit
        return windowCount < this.config.maxRequests;
    }
    /**
     * Record that a request was made
     *
     * Adds a timestamp to the sliding window.
     */
    recordRequest() {
        const now = Date.now();
        // Clean up old entries
        this.cleanup(now);
        // Count requests in window
        const windowCount = this.countInWindow(now);
        // Check if we can add a new request
        if (windowCount < this.config.maxRequests) {
            // Add new timestamp
            this.state.position = (this.state.position + 1) % this.config.maxRequests;
            this.state.timestamps[this.state.position] = now;
            this.state.count = Math.min(this.state.count + 1, this.config.maxRequests);
            this.state.requestsMade++;
        }
        else {
            this.state.requestsLimited++;
        }
    }
    /**
     * Get the wait time in milliseconds until the next request can be made
     *
     * @returns Wait time in milliseconds (0 if request can be made now)
     */
    getWaitTime() {
        const now = Date.now();
        // Clean up old entries
        this.cleanup(now);
        // Count requests in window
        const windowCount = this.countInWindow(now);
        // If we're under the limit, no wait time
        if (windowCount < this.config.maxRequests) {
            return 0;
        }
        // Find the oldest timestamp in the window
        const oldestTimestamp = this.findOldestTimestamp(now);
        // Calculate when the oldest request will exit the window
        const resetTime = oldestTimestamp + this.config.windowMs;
        return Math.max(0, resetTime - now);
    }
    /**
     * Get current rate limit statistics
     *
     * @returns Current statistics
     */
    getStats() {
        const now = Date.now();
        // Clean up old entries
        this.cleanup(now);
        // Count requests in window
        const windowCount = this.countInWindow(now);
        // Calculate when the oldest request will exit the window
        let resetTime = now;
        if (windowCount >= this.config.maxRequests) {
            const oldestTimestamp = this.findOldestTimestamp(now);
            resetTime = oldestTimestamp + this.config.windowMs;
        }
        return {
            requestsMade: this.state.requestsMade,
            requestsLimited: this.state.requestsLimited,
            currentCount: windowCount,
            resetTime: Math.floor(resetTime),
            maxRequests: this.config.maxRequests,
            windowMs: this.config.windowMs,
        };
    }
    /**
     * Reset the rate limiter
     *
     * Clears all request history.
     */
    reset() {
        this.state = {
            timestamps: new Array(this.config.maxRequests).fill(0),
            position: 0,
            count: 0,
            requestsMade: 0,
            requestsLimited: 0,
        };
    }
    /**
     * Get current configuration
     *
     * @returns Current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     *
     * Note: Updating configuration resets the rate limiter.
     *
     * @param config - Partial configuration to update
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config,
        };
        // Reset state with new maxRequests
        this.state = {
            timestamps: new Array(this.config.maxRequests).fill(0),
            position: 0,
            count: 0,
            requestsMade: 0,
            requestsLimited: 0,
        };
    }
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
export function createSlidingWindowLimiter(config) {
    return new SlidingWindowRateLimiter(config);
}
/**
 * Export default class as default
 */
export default SlidingWindowRateLimiter;
//# sourceMappingURL=SlidingWindow.js.map