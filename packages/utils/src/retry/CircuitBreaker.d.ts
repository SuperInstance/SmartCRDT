/**
 * CircuitBreaker - Circuit breaker pattern for fault tolerance
 *
 * Prevents cascading failures by failing fast when a service is down.
 * Automatically recovers when the service becomes available again.
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   recoveryTimeout: 60000,
 *   halfOpenAttempts: 3
 * });
 *
 * try {
 *   await breaker.execute(async () => {
 *     return await fetch('https://api.example.com/data');
 *   });
 * } catch (error) {
 *   if (breaker.isOpen()) {
 *     console.log('Circuit is open, using fallback');
 *   }
 * }
 * ```
 */
/**
 * Circuit breaker state
 */
export type CircuitState = "closed" | "open" | "half-open";
/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
    /** Number of consecutive failures before opening */
    failureThreshold?: number;
    /** Time to wait before attempting recovery (ms) */
    recoveryTimeout?: number;
    /** Number of attempts in half-open state */
    halfOpenAttempts?: number;
    /** Timeout for each execution attempt (ms) */
    executionTimeout?: number;
    /** Enable automatic recovery attempts */
    autoRecover?: boolean;
    /** Success threshold to close circuit in half-open */
    successThreshold?: number;
}
/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
    openedAt?: number;
    totalExecutions: number;
    totalFailures: number;
    totalSuccesses: number;
}
/**
 * Circuit breaker error
 */
export declare class CircuitBreakerError extends Error {
    state: CircuitState;
    stats: CircuitBreakerStats;
    constructor(message: string, state: CircuitState, stats: CircuitBreakerStats);
}
/**
 * Circuit breaker implementation
 */
export declare class CircuitBreaker {
    private state;
    private failureCount;
    private successCount;
    private halfOpenAttempts;
    private openedAt?;
    private lastFailureTime?;
    private lastSuccessTime?;
    private totalExecutions;
    private totalFailures;
    private totalSuccesses;
    private options;
    private recoveryTimer?;
    constructor(options?: CircuitBreakerOptions);
    /**
     * Get current state
     */
    getState(): CircuitState;
    /**
     * Check if circuit is open
     */
    isOpen(): boolean;
    /**
     * Check if circuit is closed
     */
    isClosed(): boolean;
    /**
     * Check if circuit is half-open
     */
    isHalfOpen(): boolean;
    /**
     * Execute a function through the circuit breaker
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Execute multiple functions in parallel through the circuit breaker
     */
    executeAll<T>(functions: Array<() => Promise<T>>): Promise<T[]>;
    /**
     * Get current statistics
     */
    getStats(): CircuitBreakerStats;
    /**
     * Reset the circuit breaker to closed state
     */
    reset(): void;
    /**
     * Force open the circuit
     */
    open(): void;
    /**
     * Force close the circuit
     */
    close(): void;
    /**
     * Dispose of resources
     */
    dispose(): void;
    /**
     * Handle successful execution
     */
    private onSuccess;
    /**
     * Handle failed execution
     */
    private onFailure;
    /**
     * Transition to a new state
     */
    private transitionTo;
    /**
     * Transition to half-open state
     */
    private transitionToHalfOpen;
    /**
     * Check if should attempt reset
     */
    private shouldAttemptReset;
    /**
     * Execute with timeout
     */
    private executeWithTimeout;
    /**
     * Start auto-recovery timer
     */
    private startAutoRecovery;
    /**
     * Create a wrapped function with circuit breaker
     */
    wrap<T extends (...args: unknown[]) => Promise<unknown>>(fn: T): T;
    /**
     * Get success rate (0-1)
     */
    getSuccessRate(): number;
    /**
     * Get failure rate (0-1)
     */
    getFailureRate(): number;
    /**
     * Get time since circuit opened (ms)
     */
    getTimeSinceOpened(): number | undefined;
    /**
     * Get estimated time until recovery (ms)
     */
    getTimeUntilRecovery(): number | undefined;
}
/**
 * Convenience function to create a circuit breaker
 */
export declare function createCircuitBreaker(options?: CircuitBreakerOptions): CircuitBreaker;
/**
 * Create a circuit breaker with standard settings
 */
export declare function createStandardCircuitBreaker(): CircuitBreaker;
//# sourceMappingURL=CircuitBreaker.d.ts.map