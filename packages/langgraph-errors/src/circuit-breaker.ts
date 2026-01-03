/**
 * @file circuit-breaker.ts - Circuit breaker pattern implementation
 * @package @lsi/langgraph-errors
 */

import type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
  AgentError,
} from "./types.js";

/**
 * Circuit breaker instance
 */
class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private agentId: string;

  constructor(agentId: string, config: CircuitBreakerConfig) {
    this.agentId = agentId;
    this.config = config;
    this.state = {
      state: "closed",
      failure_count: 0,
      success_count: 0,
      last_state_change: Date.now(),
      total_requests: 0,
      total_failures: 0,
    };
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.state.total_requests++;

    // Check if circuit is open
    if (this.state.state === "open") {
      // Check if reset timeout has elapsed
      if (
        Date.now() - this.state.last_failure_time! >=
        this.config.reset_timeout
      ) {
        this.transitionTo("half-open");
      } else {
        throw new Error(
          `Circuit breaker is open for agent: ${this.agentId}. ` +
            `Rejecting request.`
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.state.success_count++;

    if (this.state.state === "half-open") {
      if (this.state.success_count >= this.config.success_threshold) {
        this.transitionTo("closed");
      }
    } else if (this.state.state === "closed") {
      this.state.failure_count = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.state.failure_count++;
    this.state.total_failures++;
    this.state.last_failure_time = Date.now();
    this.state.success_count = 0;

    if (this.state.state === "closed") {
      if (this.state.failure_count >= this.config.failure_threshold) {
        this.transitionTo("open");
      }
    } else if (this.state.state === "half-open") {
      this.transitionTo("open");
    }
  }

  /**
   * Transition to new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state.state;
    this.state.state = newState;
    this.state.last_state_change = Date.now();

    if (newState === "closed") {
      this.state.failure_count = 0;
      this.state.success_count = 0;
    }

    console.log(
      `Circuit breaker for agent '${this.agentId}' ` +
        `transitioned from ${oldState} to ${newState}`
    );
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = {
      state: "closed",
      failure_count: 0,
      success_count: 0,
      last_state_change: Date.now(),
      total_requests: 0,
      total_failures: 0,
    };
  }

  /**
   * Force open circuit
   */
  forceOpen(): void {
    this.transitionTo("open");
  }

  /**
   * Force close circuit
   */
  forceClose(): void {
    this.transitionTo("closed");
  }

  /**
   * Check if circuit allows requests
   */
  allowsRequests(): boolean {
    if (this.state.state === "open") {
      return (
        Date.now() - this.state.last_failure_time! >= this.config.reset_timeout
      );
    }
    return true;
  }
}

/**
 * Circuit breaker manager
 */
export class CircuitBreakerManager {
  private circuitBreakers: Map<string, CircuitBreaker>;
  private defaultConfig: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.circuitBreakers = new Map();
    this.defaultConfig = {
      failure_threshold: config?.failure_threshold ?? 5,
      reset_timeout: config?.reset_timeout ?? 60000,
      success_threshold: config?.success_threshold ?? 2,
      monitoring_window: config?.monitoring_window ?? 60000,
    };
  }

  /**
   * Get or create circuit breaker for an agent
   */
  getCircuitBreaker(
    agentId: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    let breaker = this.circuitBreakers.get(agentId);

    if (!breaker) {
      breaker = new CircuitBreaker(agentId, {
        ...this.defaultConfig,
        ...config,
      });
      this.circuitBreakers.set(agentId, breaker);
    }

    return breaker;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    agentId: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(agentId, config);
    return breaker.execute(operation);
  }

  /**
   * Get circuit breaker state
   */
  getState(agentId: string): CircuitBreakerState | undefined {
    const breaker = this.circuitBreakers.get(agentId);
    return breaker?.getState();
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<string, CircuitBreakerState> {
    const states = new Map<string, CircuitBreakerState>();
    for (const [agentId, breaker] of this.circuitBreakers) {
      states.set(agentId, breaker.getState());
    }
    return states;
  }

  /**
   * Reset circuit breaker
   */
  reset(agentId: string): void {
    const breaker = this.circuitBreakers.get(agentId);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Force open circuit breaker
   */
  forceOpen(agentId: string): void {
    const breaker = this.circuitBreakers.get(agentId);
    if (breaker) {
      breaker.forceOpen();
    }
  }

  /**
   * Force close circuit breaker
   */
  forceClose(agentId: string): void {
    const breaker = this.circuitBreakers.get(agentId);
    if (breaker) {
      breaker.forceClose();
    }
  }

  /**
   * Check if circuit allows requests
   */
  allowsRequests(agentId: string): boolean {
    const breaker = this.circuitBreakers.get(agentId);
    return breaker ? breaker.allowsRequests() : true;
  }

  /**
   * Get circuit breaker statistics
   */
  getStatistics(): {
    total: number;
    byState: Record<CircuitState, number>;
    details: Array<{
      agentId: string;
      state: CircuitBreakerState;
    }>;
  } {
    const byState: Record<CircuitState, number> = {
      closed: 0,
      open: 0,
      "half-open": 0,
    };

    const details: Array<{
      agentId: string;
      state: CircuitBreakerState;
    }> = [];

    for (const [agentId, breaker] of this.circuitBreakers) {
      const state = breaker.getState();
      byState[state.state]++;
      details.push({ agentId, state });
    }

    return {
      total: this.circuitBreakers.size,
      byState,
      details,
    };
  }

  /**
   * Remove circuit breaker
   */
  remove(agentId: string): void {
    this.circuitBreakers.delete(agentId);
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.circuitBreakers.clear();
  }
}

/**
 * Singleton instance
 */
export const circuitBreakerManager = new CircuitBreakerManager();

/**
 * Convenience function to execute with circuit breaker
 */
export async function executeWithCircuitBreaker<T>(
  agentId: string,
  operation: () => Promise<T>,
  config?: Partial<CircuitBreakerConfig>
): Promise<T> {
  return circuitBreakerManager.execute(agentId, operation, config);
}

/**
 * Convenience function to check circuit state
 */
export function getCircuitState(
  agentId: string
): CircuitBreakerState | undefined {
  return circuitBreakerManager.getState(agentId);
}
