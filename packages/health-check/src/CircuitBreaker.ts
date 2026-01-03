/**
 * Circuit Breaker
 *
 * Implements circuit breaker pattern for health check failure isolation.
 */

import type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
} from "./types.js";

/**
 * Circuit Breaker class
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private failureWindow: number[];
  private successCount: number;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: 5,
      successThreshold: 2,
      cooldownPeriod: 60000, // 1 minute
      failureWindow: 10000, // 10 seconds
    };
    this.config = { ...this.config, ...config };

    this.state = {
      state: "closed",
      failureCount: 0,
      successCount: 0,
      lastStateChange: new Date(),
    };
    this.failureWindow = [];
    this.successCount = 0;
  }

  /**
   * Record a successful check
   */
  recordSuccess(): void {
    const now = Date.now();

    switch (this.state.state) {
      case "closed":
        // Reset failure count on success
        this.state.failureCount = 0;
        this.state.lastSuccessTime = new Date(now);
        break;

      case "open":
        // Check if cooldown period has passed
        if (
          now - this.state.lastStateChange.getTime() >=
          this.config.cooldownPeriod
        ) {
          // Transition to half-open
          this.transitionTo("half-open");
        }
        break;

      case "half-open":
        this.successCount++;
        this.state.successCount = this.successCount;
        this.state.lastSuccessTime = new Date(now);

        // Check if we've reached success threshold
        if (this.successCount >= this.config.successThreshold) {
          this.transitionTo("closed");
          this.successCount = 0;
        }
        break;
    }
  }

  /**
   * Record a failed check
   */
  recordFailure(): void {
    const now = Date.now();

    // Add to failure window
    this.failureWindow.push(now);

    // Remove old failures outside the window
    this.failureWindow = this.failureWindow.filter(
      t => now - t <= this.config.failureWindow
    );

    switch (this.state.state) {
      case "closed":
        this.state.failureCount = this.failureWindow.length;
        this.state.lastFailureTime = new Date(now);

        // Check if we should open the circuit
        if (this.failureWindow.length >= this.config.failureThreshold) {
          this.transitionTo("open");
        }
        break;

      case "open":
        // Already open, just update timestamp
        this.state.lastFailureTime = new Date(now);
        this.state.failureCount = this.failureWindow.length;
        break;

      case "half-open":
        // Any failure in half-open state opens the circuit
        this.transitionTo("open");
        this.successCount = 0;
        break;
    }
  }

  /**
   * Check if circuit allows requests
   */
  allowRequest(): boolean {
    return this.state.state !== "open";
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Get circuit name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Reset circuit to closed state
   */
  reset(): void {
    this.transitionTo("closed");
    this.failureWindow = [];
    this.successCount = 0;
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state.state;
    this.state.state = newState;
    this.state.lastStateChange = new Date();

    // Reset counters on state change
    if (newState === "closed") {
      this.state.failureCount = 0;
      this.state.successCount = 0;
    } else if (newState === "open") {
      this.state.successCount = 0;
    } else if (newState === "half-open") {
      this.successCount = 0;
    }
  }

  /**
   * Get failure rate in current window
   */
  getFailureRate(): number {
    const now = Date.now();
    this.failureWindow = this.failureWindow.filter(
      t => now - t <= this.config.failureWindow
    );

    return this.failureWindow.length;
  }

  /**
   * Get time until next retry (when open)
   */
  getTimeUntilRetry(): number {
    if (this.state.state !== "open") {
      return 0;
    }

    const elapsed = Date.now() - this.state.lastStateChange.getTime();
    const remaining = this.config.cooldownPeriod - elapsed;

    return Math.max(0, remaining);
  }

  /**
   * Check if cooldown period has passed
   */
  hasCooldownPassed(): boolean {
    return this.getTimeUntilRetry() === 0;
  }

  /**
   * Get circuit health metrics
   */
  getMetrics(): {
    name: string;
    state: CircuitState;
    failureCount: number;
    successCount: number;
    failureRate: number;
    timeUntilRetry: number;
    uptime: number;
  } {
    const now = Date.now();
    const uptime = now - this.state.lastStateChange.getTime();

    return {
      name: this.name,
      state: this.state.state,
      failureCount: this.state.failureCount,
      successCount: this.state.successCount,
      failureRate: this.getFailureRate(),
      timeUntilRetry: this.getTimeUntilRetry(),
      uptime,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Force open the circuit
   */
  forceOpen(): void {
    this.transitionTo("open");
  }

  /**
   * Force close the circuit
   */
  forceClose(): void {
    this.transitionTo("closed");
    this.failureWindow = [];
    this.successCount = 0;
  }

  /**
   * Get state description
   */
  getStateDescription(): string {
    switch (this.state.state) {
      case "closed":
        return "Circuit is closed - requests are allowed";
      case "open":
        return `Circuit is open - requests blocked for ${this.getTimeUntilRetry()}ms`;
      case "half-open":
        return "Circuit is half-open - testing recovery";
      default:
        return "Unknown state";
    }
  }
}

/**
 * Circuit Breaker Registry
 *
 * Manages multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker>;

  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create a circuit breaker
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(name, config);
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Get all circuit breakers
   */
  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<string, CircuitBreakerState> {
    const states = new Map<string, CircuitBreakerState>();
    for (const [name, breaker] of this.breakers) {
      states.set(name, breaker.getState());
    }
    return states;
  }

  /**
   * Get all circuit breaker metrics
   */
  getAllMetrics(): Array<ReturnType<CircuitBreaker["getMetrics"]>> {
    return this.getAll().map(b => b.getMetrics());
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get circuit breakers by state
   */
  getByState(state: CircuitState): CircuitBreaker[] {
    return this.getAll().filter(b => b.getState().state === state);
  }

  /**
   * Count circuit breakers by state
   */
  countByState(): Map<CircuitState, number> {
    const counts = new Map<CircuitState, number>();
    counts.set("closed", 0);
    counts.set("open", 0);
    counts.set("half-open", 0);

    for (const breaker of this.breakers.values()) {
      const state = breaker.getState().state;
      counts.set(state, (counts.get(state) || 0) + 1);
    }

    return counts;
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
  }
}
