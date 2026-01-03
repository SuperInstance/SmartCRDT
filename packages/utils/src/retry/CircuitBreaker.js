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
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
    state;
    stats;
    constructor(message, state, stats) {
        super(message);
        this.state = state;
        this.stats = stats;
        this.name = "CircuitBreakerError";
    }
}
/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
    state = "closed";
    failureCount = 0;
    successCount = 0;
    halfOpenAttempts = 0;
    openedAt;
    lastFailureTime;
    lastSuccessTime;
    totalExecutions = 0;
    totalFailures = 0;
    totalSuccesses = 0;
    options;
    recoveryTimer;
    constructor(options = {}) {
        this.options = {
            failureThreshold: options.failureThreshold ?? 5,
            recoveryTimeout: options.recoveryTimeout ?? 60000,
            halfOpenAttempts: options.halfOpenAttempts ?? 3,
            executionTimeout: options.executionTimeout ?? 30000,
            autoRecover: options.autoRecover ?? true,
            successThreshold: options.successThreshold ?? 2,
        };
        // Start auto-recovery if enabled
        if (this.options.autoRecover) {
            this.startAutoRecovery();
        }
    }
    /**
     * Get current state
     */
    getState() {
        return this.state;
    }
    /**
     * Check if circuit is open
     */
    isOpen() {
        return this.state === "open";
    }
    /**
     * Check if circuit is closed
     */
    isClosed() {
        return this.state === "closed";
    }
    /**
     * Check if circuit is half-open
     */
    isHalfOpen() {
        return this.state === "half-open";
    }
    /**
     * Execute a function through the circuit breaker
     */
    async execute(fn) {
        // Check if circuit is open
        if (this.state === "open") {
            if (this.shouldAttemptReset()) {
                this.transitionToHalfOpen();
            }
            else {
                throw new CircuitBreakerError("Circuit breaker is open", "open", this.getStats());
            }
        }
        this.totalExecutions++;
        try {
            // Execute with timeout
            const result = await this.executeWithTimeout(fn, this.options.executionTimeout);
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    /**
     * Execute multiple functions in parallel through the circuit breaker
     */
    async executeAll(functions) {
        if (this.state === "open" && !this.shouldAttemptReset()) {
            throw new CircuitBreakerError("Circuit breaker is open", "open", this.getStats());
        }
        return Promise.all(functions.map(fn => this.execute(fn)));
    }
    /**
     * Get current statistics
     */
    getStats() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            openedAt: this.openedAt,
            totalExecutions: this.totalExecutions,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
        };
    }
    /**
     * Reset the circuit breaker to closed state
     */
    reset() {
        this.state = "closed";
        this.failureCount = 0;
        this.successCount = 0;
        this.halfOpenAttempts = 0;
        this.openedAt = undefined;
        this.lastFailureTime = undefined;
        if (this.recoveryTimer) {
            clearTimeout(this.recoveryTimer);
            this.recoveryTimer = undefined;
        }
        if (this.options.autoRecover) {
            this.startAutoRecovery();
        }
    }
    /**
     * Force open the circuit
     */
    open() {
        this.transitionTo("open");
    }
    /**
     * Force close the circuit
     */
    close() {
        this.reset();
    }
    /**
     * Dispose of resources
     */
    dispose() {
        if (this.recoveryTimer) {
            clearTimeout(this.recoveryTimer);
            this.recoveryTimer = undefined;
        }
    }
    /**
     * Handle successful execution
     */
    onSuccess() {
        this.totalSuccesses++;
        this.lastSuccessTime = Date.now();
        this.successCount++;
        this.failureCount = 0;
        switch (this.state) {
            case "half-open":
                this.halfOpenAttempts++;
                if (this.successCount >= this.options.successThreshold) {
                    this.transitionTo("closed");
                }
                break;
            case "closed":
                // Stay closed
                break;
        }
    }
    /**
     * Handle failed execution
     */
    onFailure() {
        this.totalFailures++;
        this.lastFailureTime = Date.now();
        this.failureCount++;
        this.successCount = 0;
        switch (this.state) {
            case "closed":
                if (this.failureCount >= this.options.failureThreshold) {
                    this.transitionTo("open");
                }
                break;
            case "half-open":
                this.transitionTo("open");
                break;
        }
    }
    /**
     * Transition to a new state
     */
    transitionTo(newState) {
        const oldState = this.state;
        this.state = newState;
        if (newState === "open") {
            this.openedAt = Date.now();
        }
        if (newState === "closed") {
            this.halfOpenAttempts = 0;
        }
        if (newState === "half-open") {
            this.successCount = 0;
            this.halfOpenAttempts = 0;
        }
    }
    /**
     * Transition to half-open state
     */
    transitionToHalfOpen() {
        this.transitionTo("half-open");
    }
    /**
     * Check if should attempt reset
     */
    shouldAttemptReset() {
        if (!this.openedAt) {
            return false;
        }
        const timeSinceOpened = Date.now() - this.openedAt;
        return timeSinceOpened >= this.options.recoveryTimeout;
    }
    /**
     * Execute with timeout
     */
    async executeWithTimeout(fn, timeout) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Execution timed out after ${timeout}ms`)), timeout)),
        ]);
    }
    /**
     * Start auto-recovery timer
     */
    startAutoRecovery() {
        if (this.recoveryTimer) {
            clearTimeout(this.recoveryTimer);
        }
        this.recoveryTimer = setTimeout(() => {
            if (this.state === "open") {
                this.transitionToHalfOpen();
            }
            this.startAutoRecovery();
        }, this.options.recoveryTimeout);
    }
    /**
     * Create a wrapped function with circuit breaker
     */
    wrap(fn) {
        return ((...args) => {
            return this.execute(() => fn(...args));
        });
    }
    /**
     * Get success rate (0-1)
     */
    getSuccessRate() {
        if (this.totalExecutions === 0) {
            return 1;
        }
        return this.totalSuccesses / this.totalExecutions;
    }
    /**
     * Get failure rate (0-1)
     */
    getFailureRate() {
        if (this.totalExecutions === 0) {
            return 0;
        }
        return this.totalFailures / this.totalExecutions;
    }
    /**
     * Get time since circuit opened (ms)
     */
    getTimeSinceOpened() {
        if (!this.openedAt) {
            return undefined;
        }
        return Date.now() - this.openedAt;
    }
    /**
     * Get estimated time until recovery (ms)
     */
    getTimeUntilRecovery() {
        if (!this.openedAt) {
            return undefined;
        }
        const elapsed = Date.now() - this.openedAt;
        const remaining = this.options.recoveryTimeout - elapsed;
        return Math.max(0, remaining);
    }
}
/**
 * Convenience function to create a circuit breaker
 */
export function createCircuitBreaker(options) {
    return new CircuitBreaker(options);
}
/**
 * Create a circuit breaker with standard settings
 */
export function createStandardCircuitBreaker() {
    return new CircuitBreaker({
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenAttempts: 3,
        executionTimeout: 30000,
        autoRecover: true,
        successThreshold: 2,
    });
}
//# sourceMappingURL=CircuitBreaker.js.map