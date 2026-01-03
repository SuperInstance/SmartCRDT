/**
 * RetryHelper - Retry logic with exponential backoff
 *
 * Eliminates ~400 lines of duplicate retry code across 8+ adapter/manager classes.
 *
 * @example
 * ```typescript
 * const result = await RetryHelper.withRetry(
 *   async () => await fetch('https://api.example.com/data'),
 *   {
 *     maxAttempts: 3,
 *     initialDelay: 1000,
 *     maxDelay: 10000,
 *     backoffMultiplier: 2,
 *     jitter: true
 *   }
 * );
 * ```
 */
/**
 * Custom error for retry failures
 */
export class RetryError extends Error {
    attempts;
    lastError;
    totalDelay;
    constructor(message, attempts, lastError, totalDelay) {
        super(message);
        this.attempts = attempts;
        this.lastError = lastError;
        this.totalDelay = totalDelay;
        this.name = "RetryError";
    }
}
/**
 * RetryHelper - Static utility class for retry logic
 */
export class RetryHelper {
    static stats = {
        totalAttempts: 0,
        successfulAttempts: 0,
        failedAttempts: 0,
        totalDelay: 0,
    };
    /**
     * Execute an operation with retry logic
     *
     * @param fn - The async function to execute
     * @param options - Retry configuration options
     * @returns The result of the operation
     * @throws {RetryError} If all retry attempts fail
     */
    static async withRetry(fn, options = {}) {
        const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30000, backoffMultiplier = 2, jitter = true, isRetryable = RetryHelper.defaultIsRetryable, onRetry, } = options;
        let lastError;
        let totalDelay = 0;
        for (let attempt = 0; attempt <= maxAttempts; attempt++) {
            try {
                const result = await fn();
                RetryHelper.stats.successfulAttempts++;
                RetryHelper.stats.totalAttempts++;
                return result;
            }
            catch (error) {
                lastError = error;
                RetryHelper.stats.totalAttempts++;
                // Don't retry if this is the last attempt or error is not retryable
                if (attempt >= maxAttempts || !isRetryable(error)) {
                    RetryHelper.stats.failedAttempts++;
                    throw error;
                }
                // Calculate delay
                const delay = RetryHelper.calculateDelay(attempt, initialDelay, backoffMultiplier, maxDelay, jitter);
                totalDelay += delay;
                RetryHelper.stats.totalDelay += delay;
                // Call retry callback
                if (onRetry) {
                    try {
                        onRetry(attempt + 1, error, delay);
                    }
                    catch {
                        // Ignore callback errors
                    }
                }
                // Wait before retrying
                await RetryHelper.sleep(delay);
            }
        }
        // Should not reach here, but TypeScript needs it
        throw new RetryError(`Retry failed after ${maxAttempts} attempts`, maxAttempts, lastError, totalDelay);
    }
    /**
     * Execute with retry and return detailed result
     */
    static async withRetryDetailed(fn, options = {}) {
        const startTime = Date.now();
        let attempts = 0;
        try {
            const value = await RetryHelper.withRetry(fn, options);
            attempts = RetryHelper.stats.totalAttempts;
            return {
                value,
                attempts,
                totalDelay: Date.now() - startTime,
            };
        }
        catch (error) {
            throw new RetryError("Retry failed", attempts, error, Date.now() - startTime);
        }
    }
    /**
     * Execute with timeout and retry
     */
    static async withRetryAndTimeout(fn, timeoutMs, options = {}) {
        return RetryHelper.withRetry(async () => {
            return await Promise.race([
                fn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)),
            ]);
        }, options);
    }
    /**
     * Retry with circuit breaker pattern
     */
    static async withRetryAndCircuitBreaker(fn, options = {}) {
        const { failureThreshold = 5, recoveryTimeout = 60000, ...retryOptions } = options;
        let failures = 0;
        let lastFailureTime = 0;
        let circuitOpen = false;
        return RetryHelper.withRetry(async () => {
            // Check if circuit is open
            if (circuitOpen) {
                const timeSinceLastFailure = Date.now() - lastFailureTime;
                if (timeSinceLastFailure < recoveryTimeout) {
                    throw new Error("Circuit breaker is open");
                }
                else {
                    // Try to close circuit
                    circuitOpen = false;
                    failures = 0;
                }
            }
            try {
                const result = await fn();
                // Reset failures on success
                failures = 0;
                return result;
            }
            catch (error) {
                failures++;
                lastFailureTime = Date.now();
                if (failures >= failureThreshold) {
                    circuitOpen = true;
                }
                throw error;
            }
        }, retryOptions);
    }
    /**
     * Calculate delay for retry attempt
     */
    static calculateDelay(attempt, initialDelay, multiplier, maxDelay, jitter) {
        const exponentialDelay = initialDelay * Math.pow(multiplier, attempt);
        const baseDelay = Math.min(exponentialDelay, maxDelay);
        if (jitter) {
            // Add random jitter: +/- 25% of base delay
            const jitterAmount = baseDelay * 0.25;
            return baseDelay - jitterAmount + Math.random() * jitterAmount * 2;
        }
        return baseDelay;
    }
    /**
     * Sleep for specified milliseconds
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Default retryable error checker
     */
    static defaultIsRetryable(error) {
        // Retry on network errors
        if (error instanceof TypeError && error.message.includes("fetch")) {
            return true;
        }
        // Retry on specific HTTP status codes
        const httpError = error;
        if (httpError.status) {
            // Retry on 408 (Request Timeout), 429 (Too Many Requests), 5xx errors
            return (httpError.status === 408 ||
                httpError.status === 429 ||
                httpError.status >= 500);
        }
        // Retry on specific error codes
        if (httpError.code) {
            const retryableCodes = [
                "ECONNRESET",
                "ECONNREFUSED",
                "ETIMEDOUT",
                "ENOTFOUND",
                "EAI_AGAIN",
                "EPIPE",
            ];
            return retryableCodes.includes(httpError.code);
        }
        // Don't retry on 4xx errors (except 408 and 429)
        return false;
    }
    /**
     * Get global retry statistics
     */
    static getStats() {
        const { totalAttempts, successfulAttempts, failedAttempts, totalDelay } = RetryHelper.stats;
        return {
            totalAttempts,
            successfulAttempts,
            failedAttempts,
            totalDelay,
            averageDelay: totalAttempts > 0 ? totalDelay / totalAttempts : 0,
        };
    }
    /**
     * Reset global statistics
     */
    static resetStats() {
        RetryHelper.stats = {
            totalAttempts: 0,
            successfulAttempts: 0,
            failedAttempts: 0,
            totalDelay: 0,
        };
    }
    /**
     * Create a retry function with preset options
     */
    static createRetrier(options) {
        return fn => RetryHelper.withRetry(fn, options);
    }
    /**
     * Execute multiple operations with parallel retry
     */
    static async retryAll(operations, options = {}) {
        return Promise.all(operations.map(op => RetryHelper.withRetry(op, options)));
    }
    /**
     * Execute operations with retry, stop on first success
     */
    static async retryAny(operations, options = {}) {
        const errors = [];
        for (const operation of operations) {
            try {
                return await RetryHelper.withRetry(operation, options);
            }
            catch (error) {
                errors.push(error);
            }
        }
        throw new Error("All operations failed", {
            cause: errors,
        });
    }
}
/**
 * Convenience function for retry
 */
export function retry(fn, options) {
    return RetryHelper.withRetry(fn, options);
}
/**
 * Create a retriable function wrapper
 */
export function withRetry(fn, options) {
    return ((...args) => {
        return RetryHelper.withRetry(() => fn(...args), options);
    });
}
//# sourceMappingURL=RetryHelper.js.map