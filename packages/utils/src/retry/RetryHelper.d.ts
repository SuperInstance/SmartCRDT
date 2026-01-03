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
 * Retry configuration options
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxAttempts?: number;
    /** Initial delay before first retry in ms (default: 1000) */
    initialDelay?: number;
    /** Maximum delay between retries in ms (default: 30000) */
    maxDelay?: number;
    /** Multiplier for exponential backoff (default: 2) */
    backoffMultiplier?: number;
    /** Add random jitter to delays (default: true) */
    jitter?: boolean;
    /** Function to determine if error is retryable */
    isRetryable?: (error: unknown) => boolean;
    /** Callback before each retry attempt */
    onRetry?: (attempt: number, error: unknown, delay: number) => void;
}
/**
 * Retry result with metadata
 */
export interface RetryResult<T> {
    /** The result value */
    value: T;
    /** Number of attempts made */
    attempts: number;
    /** Total time spent retrying in ms */
    totalDelay: number;
}
/**
 * Retry statistics
 */
export interface RetryStats {
    /** Total attempts made */
    totalAttempts: number;
    /** Successful attempts */
    successfulAttempts: number;
    /** Failed attempts */
    failedAttempts: number;
    /** Total delay time in ms */
    totalDelay: number;
    /** Average delay per attempt */
    averageDelay: number;
}
/**
 * Custom error for retry failures
 */
export declare class RetryError extends Error {
    attempts: number;
    lastError: unknown;
    totalDelay: number;
    constructor(message: string, attempts: number, lastError: unknown, totalDelay: number);
}
/**
 * RetryHelper - Static utility class for retry logic
 */
export declare class RetryHelper {
    private static stats;
    /**
     * Execute an operation with retry logic
     *
     * @param fn - The async function to execute
     * @param options - Retry configuration options
     * @returns The result of the operation
     * @throws {RetryError} If all retry attempts fail
     */
    static withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
    /**
     * Execute with retry and return detailed result
     */
    static withRetryDetailed<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<RetryResult<T>>;
    /**
     * Execute with timeout and retry
     */
    static withRetryAndTimeout<T>(fn: () => Promise<T>, timeoutMs: number, options?: RetryOptions): Promise<T>;
    /**
     * Retry with circuit breaker pattern
     */
    static withRetryAndCircuitBreaker<T>(fn: () => Promise<T>, options?: RetryOptions & {
        failureThreshold?: number;
        recoveryTimeout?: number;
    }): Promise<T>;
    /**
     * Calculate delay for retry attempt
     */
    private static calculateDelay;
    /**
     * Sleep for specified milliseconds
     */
    private static sleep;
    /**
     * Default retryable error checker
     */
    private static defaultIsRetryable;
    /**
     * Get global retry statistics
     */
    static getStats(): RetryStats;
    /**
     * Reset global statistics
     */
    static resetStats(): void;
    /**
     * Create a retry function with preset options
     */
    static createRetrier<T>(options: RetryOptions): (fn: () => Promise<T>) => Promise<T>;
    /**
     * Execute multiple operations with parallel retry
     */
    static retryAll<T>(operations: Array<() => Promise<T>>, options?: RetryOptions): Promise<T[]>;
    /**
     * Execute operations with retry, stop on first success
     */
    static retryAny<T>(operations: Array<() => Promise<T>>, options?: RetryOptions): Promise<T>;
}
/**
 * Convenience function for retry
 */
export declare function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Create a retriable function wrapper
 */
export declare function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, options?: RetryOptions): T;
//# sourceMappingURL=RetryHelper.d.ts.map