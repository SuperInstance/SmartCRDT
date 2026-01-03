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
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public state: CircuitState,
    public stats: CircuitBreakerStats
  ) {
    super(message);
    this.name = "CircuitBreakerError";
  }
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private halfOpenAttempts = 0;
  private openedAt?: number;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private totalExecutions = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private options: Required<CircuitBreakerOptions>;
  private recoveryTimer?: ReturnType<typeof setTimeout>;

  constructor(options: CircuitBreakerOptions = {}) {
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
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state === "open";
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state === "closed";
  }

  /**
   * Check if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.state === "half-open";
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === "open") {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new CircuitBreakerError(
          "Circuit breaker is open",
          "open",
          this.getStats()
        );
      }
    }

    this.totalExecutions++;

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        fn,
        this.options.executionTimeout
      );

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute multiple functions in parallel through the circuit breaker
   */
  async executeAll<T>(functions: Array<() => Promise<T>>): Promise<T[]> {
    if (this.state === "open" && !this.shouldAttemptReset()) {
      throw new CircuitBreakerError(
        "Circuit breaker is open",
        "open",
        this.getStats()
      );
    }

    return Promise.all(functions.map(fn => this.execute(fn)));
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
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
  reset(): void {
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
  open(): void {
    this.transitionTo("open");
  }

  /**
   * Force close the circuit
   */
  close(): void {
    this.reset();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = undefined;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
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
  private onFailure(): void {
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
  private transitionTo(newState: CircuitState): void {
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
  private transitionToHalfOpen(): void {
    this.transitionTo("half-open");
  }

  /**
   * Check if should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.openedAt) {
      return false;
    }

    const timeSinceOpened = Date.now() - this.openedAt;
    return timeSinceOpened >= this.options.recoveryTimeout;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Execution timed out after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
  }

  /**
   * Start auto-recovery timer
   */
  private startAutoRecovery(): void {
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
  wrap<T extends (...args: unknown[]) => Promise<unknown>>(fn: T): T {
    return ((...args: unknown[]) => {
      return this.execute(() => fn(...args));
    }) as T;
  }

  /**
   * Get success rate (0-1)
   */
  getSuccessRate(): number {
    if (this.totalExecutions === 0) {
      return 1;
    }
    return this.totalSuccesses / this.totalExecutions;
  }

  /**
   * Get failure rate (0-1)
   */
  getFailureRate(): number {
    if (this.totalExecutions === 0) {
      return 0;
    }
    return this.totalFailures / this.totalExecutions;
  }

  /**
   * Get time since circuit opened (ms)
   */
  getTimeSinceOpened(): number | undefined {
    if (!this.openedAt) {
      return undefined;
    }
    return Date.now() - this.openedAt;
  }

  /**
   * Get estimated time until recovery (ms)
   */
  getTimeUntilRecovery(): number | undefined {
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
export function createCircuitBreaker(
  options?: CircuitBreakerOptions
): CircuitBreaker {
  return new CircuitBreaker(options);
}

/**
 * Create a circuit breaker with standard settings
 */
export function createStandardCircuitBreaker(): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: 5,
    recoveryTimeout: 60000,
    halfOpenAttempts: 3,
    executionTimeout: 30000,
    autoRecover: true,
    successThreshold: 2,
  });
}
