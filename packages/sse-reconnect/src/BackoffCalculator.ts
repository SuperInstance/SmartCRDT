/**
 * Backoff Calculator
 *
 * Calculates reconnection delays using various backoff strategies.
 * Supports fixed, linear, exponential, and exponential-with-jitter strategies.
 */

import type { BackoffStrategy, ReconnectConfig } from "./types.js";

/**
 * Result of a backoff calculation
 */
export interface BackoffResult {
  /** Calculated delay in milliseconds */
  delay: number;
  /** Strategy used */
  strategy: BackoffStrategy;
  /** Attempt number */
  attempt: number;
  /** Whether jitter was applied */
  jitterApplied: boolean;
}

/**
 * Backoff Calculator class
 */
export class BackoffCalculator {
  private config: ReconnectConfig;

  constructor(config: ReconnectConfig) {
    this.config = config;
  }

  /**
   * Update the configuration
   */
  updateConfig(config: Partial<ReconnectConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ReconnectConfig {
    return { ...this.config };
  }

  /**
   * Calculate delay for a given attempt using configured strategy
   */
  calculateDelay(attempt: number): BackoffResult {
    const strategy = this.config.backoffStrategy;

    let baseDelay: number;
    let jitterApplied = false;

    switch (strategy) {
      case "fixed":
        baseDelay = this.calculateFixedDelay(attempt);
        break;
      case "linear":
        baseDelay = this.calculateLinearDelay(attempt);
        break;
      case "exponential":
        baseDelay = this.calculateExponentialDelay(attempt);
        break;
      case "exponential-with-jitter":
        baseDelay = this.calculateExponentialDelay(attempt);
        baseDelay = this.calculateJitterDelay(
          baseDelay,
          this.config.jitterFactor
        );
        jitterApplied = true;
        break;
      default:
        // Fallback to exponential-with-jitter
        baseDelay = this.calculateExponentialDelay(attempt);
        baseDelay = this.calculateJitterDelay(
          baseDelay,
          this.config.jitterFactor
        );
        jitterApplied = true;
    }

    // Clamp to max delay
    const finalDelay = Math.min(baseDelay, this.config.maxDelay);

    return {
      delay: finalDelay,
      strategy,
      attempt,
      jitterApplied,
    };
  }

  /**
   * Calculate fixed delay (constant)
   * Returns initial delay regardless of attempt number
   */
  calculateFixedDelay(attempt: number): number {
    // Fixed delay: always return initial delay
    return this.config.initialDelay;
  }

  /**
   * Calculate linear delay
   * Increases linearly with attempt number: delay = initialDelay * attempt
   */
  calculateLinearDelay(attempt: number): number {
    // Linear backoff: delay increases linearly
    return this.config.initialDelay * attempt;
  }

  /**
   * Calculate exponential delay
   * Increases exponentially: delay = initialDelay * 2^(attempt-1)
   */
  calculateExponentialDelay(attempt: number): number {
    // Exponential backoff: delay doubles each attempt
    // attempt 1: delay = initialDelay * 2^0 = initialDelay
    // attempt 2: delay = initialDelay * 2^1 = initialDelay * 2
    // attempt 3: delay = initialDelay * 2^2 = initialDelay * 4
    const exponent = Math.max(0, attempt - 1);
    return this.config.initialDelay * Math.pow(2, exponent);
  }

  /**
   * Add jitter to a base delay
   * Jitter helps prevent "thundering herd" problem where multiple clients
   * reconnect simultaneously
   */
  calculateJitterDelay(baseDelay: number, jitterFactor: number): number {
    if (jitterFactor <= 0 || jitterFactor >= 1) {
      return baseDelay;
    }

    // Calculate jitter range
    const jitterRange = baseDelay * jitterFactor;

    // Random value within jitter range
    const jitter = (Math.random() * 2 - 1) * jitterRange;

    // Apply jitter to base delay
    return Math.max(0, baseDelay + jitter);
  }

  /**
   * Calculate delay with custom strategy override
   */
  calculateDelayWithStrategy(
    attempt: number,
    strategy: BackoffStrategy
  ): number {
    let delay: number;

    switch (strategy) {
      case "fixed":
        delay = this.calculateFixedDelay(attempt);
        break;
      case "linear":
        delay = this.calculateLinearDelay(attempt);
        break;
      case "exponential":
        delay = this.calculateExponentialDelay(attempt);
        break;
      case "exponential-with-jitter":
        delay = this.calculateExponentialDelay(attempt);
        delay = this.calculateJitterDelay(delay, this.config.jitterFactor);
        break;
      default:
        delay = this.calculateExponentialDelay(attempt);
    }

    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * Calculate total time spent after n attempts (cumulative delay)
   */
  calculateCumulativeDelay(attempts: number): number {
    let total = 0;
    for (let i = 1; i <= attempts; i++) {
      total += this.calculateDelay(i).delay;
    }
    return total;
  }

  /**
   * Estimate how many attempts will be made within a time budget
   */
  estimateAttemptsWithinBudget(timeBudgetMs: number): number {
    let attempts = 0;
    let cumulative = 0;

    while (cumulative < timeBudgetMs) {
      attempts++;
      cumulative += this.calculateDelay(attempts).delay;

      // Safety check for infinite loops
      if (attempts > 1000) {
        break;
      }
    }

    return attempts;
  }

  /**
   * Reset calculator state (no-op for stateless calculator, exists for interface consistency)
   */
  reset(): void {
    // This calculator is stateless, so nothing to reset
  }
}

/**
 * Create a backoff calculator with default config
 */
export function createBackoffCalculator(
  config?: Partial<ReconnectConfig>
): BackoffCalculator {
  const defaultConfig: ReconnectConfig = {
    maxRetries: 10,
    initialDelay: 1000,
    maxDelay: 30000,
    jitterFactor: 0.1,
    backoffStrategy: "exponential-with-jitter",
    enableEventBuffer: true,
    maxBufferSize: 1024 * 1024,
    healthCheckInterval: 30000,
    connectionTimeout: 10000,
    reconnectOnServerClose: true,
    reconnectOnNetworkLoss: true,
    reconnectOnError: true,
  };

  return new BackoffCalculator(
    config ? { ...defaultConfig, ...config } : defaultConfig
  );
}
