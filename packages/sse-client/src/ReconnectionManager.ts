/**
 * ReconnectionManager - Automatic reconnection with backoff strategies
 *
 * Handles automatic reconnection with:
 * - Linear backoff
 * - Exponential backoff
 * - Jitter (exponential with randomization)
 * - Max retry limits
 * - Manual reconnection support
 */

import type {
  ReconnectStrategy,
  ReconnectionState,
  ReconnectAttempt,
  SSEError,
} from "./types.js";

/**
 * Reconfiguration options
 */
export interface ReconnectionConfig {
  /** Reconnection strategy */
  strategy: ReconnectStrategy;
  /** Maximum number of retry attempts (-1 for infinite) */
  maxRetries: number;
  /** Initial delay before first reconnection (ms) */
  initialDelay: number;
  /** Maximum delay between reconnections (ms) */
  maxDelay: number;
  /** Jitter amount (percentage, 0-1) */
  jitterAmount?: number;
}

/**
 * Reconnection event handlers
 */
export interface ReconnectionHandlers {
  /** Called when reconnection attempt starts */
  onAttempt?: (attempt: ReconnectAttempt) => void;
  /** Called when reconnection succeeds */
  onSuccess?: (attempt: ReconnectAttempt) => void;
  /** Called when reconnection fails */
  onFailure?: (attempt: ReconnectAttempt) => void;
  /** Called when max retries exceeded */
  onMaxRetriesReached?: () => void;
}

/**
 * ReconnectionManager for handling reconnection logic
 */
export class ReconnectionManager {
  private config: ReconnectionConfig;
  private handlers: ReconnectionHandlers;
  private state: ReconnectionState;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    config: Partial<ReconnectionConfig> = {},
    handlers: ReconnectionHandlers = {}
  ) {
    this.config = {
      strategy: config.strategy ?? "exponential",
      maxRetries: config.maxRetries ?? -1,
      initialDelay: config.initialDelay ?? 1000,
      maxDelay: config.maxDelay ?? 30000,
      jitterAmount: config.jitterAmount ?? 0.1,
    };
    this.handlers = handlers;

    this.state = {
      attempts: 0,
      nextAttemptAt: null,
      nextDelay: null,
      history: [],
      isReconnecting: false,
    };
  }

  /**
   * Calculate delay for next reconnection attempt
   * @param attempt Attempt number
   * @returns Delay in milliseconds
   */
  calculateDelay(attempt: number): number {
    const {
      strategy,
      initialDelay,
      maxDelay,
      jitterAmount = 0.1,
    } = this.config;

    let delay: number;

    switch (strategy) {
      case "linear":
        // Linear: initialDelay * attempt
        delay = initialDelay * attempt;
        break;

      case "exponential":
        // Exponential: initialDelay * 2^(attempt-1)
        delay = initialDelay * Math.pow(2, attempt - 1);
        break;

      case "jitter":
        // Jitter: exponential with random variation
        const exponentialDelay = initialDelay * Math.pow(2, attempt - 1);
        // Add random jitter +/- jitterAmount%
        const jitter =
          exponentialDelay * jitterAmount * (Math.random() * 2 - 1);
        delay = exponentialDelay + jitter;
        break;

      default:
        delay = initialDelay;
    }

    // Clamp to max delay
    return Math.min(Math.max(delay, 0), maxDelay);
  }

  /**
   * Start reconnection process
   * @param connectFn Function to call for reconnection
   * @returns Promise that resolves when reconnected
   */
  async reconnect(connectFn: () => Promise<void>): Promise<void> {
    if (this.state.isReconnecting) {
      throw new Error("Reconnection already in progress");
    }

    // Check max retries
    if (
      this.config.maxRetries >= 0 &&
      this.state.attempts >= this.config.maxRetries
    ) {
      this.handlers.onMaxRetriesReached?.();
      throw new Error("Max retries exceeded");
    }

    this.state.isReconnecting = true;
    this.state.attempts++;

    const delay = this.calculateDelay(this.state.attempts);
    this.state.nextDelay = delay;
    this.state.nextAttemptAt = Date.now() + delay;

    const attempt: ReconnectAttempt = {
      attempt: this.state.attempts,
      delay,
      timestamp: Date.now(),
    };

    this.handlers.onAttempt?.(attempt);
    this.state.history.push(attempt);

    try {
      // Wait for delay
      await new Promise<void>((resolve, reject) => {
        this.timeoutId = setTimeout(() => {
          this.timeoutId = null;
          resolve();
        }, delay);
      });

      // Attempt connection
      await connectFn();

      // Success
      this.state.isReconnecting = false;
      this.state.attempts = 0; // Reset on success
      this.state.nextDelay = null;
      this.state.nextAttemptAt = null;

      attempt.success = true;
      this.handlers.onSuccess?.(attempt);
    } catch (error) {
      // Failure
      attempt.success = false;
      attempt.error = error as Error;
      this.state.isReconnecting = false;
      this.handlers.onFailure?.(attempt);
      throw error;
    }
  }

  /**
   * Schedule next reconnection
   * @param connectFn Connection function
   * @returns Promise that resolves when scheduled
   */
  scheduleReconnect(connectFn: () => Promise<void>): Promise<void> {
    if (this.state.isReconnecting) {
      return Promise.reject(new Error("Reconnection already in progress"));
    }

    return this.reconnect(connectFn);
  }

  /**
   * Cancel pending reconnection
   */
  cancel(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.state.isReconnecting = false;
    this.state.nextAttemptAt = null;
    this.state.nextDelay = null;
  }

  /**
   * Reset reconnection state
   */
  reset(): void {
    this.cancel();
    this.state.attempts = 0;
    this.state.history = [];
  }

  /**
   * Get current reconnection state
   * @returns Reconnection state
   */
  getState(): ReconnectionState {
    return { ...this.state };
  }

  /**
   * Check if currently reconnecting
   * @returns True if reconnecting
   */
  isReconnecting(): boolean {
    return this.state.isReconnecting;
  }

  /**
   * Get retry count
   * @returns Current retry count
   */
  getRetryCount(): number {
    return this.state.attempts;
  }

  /**
   * Get delay until next attempt
   * @returns Delay in ms or null
   */
  getNextDelay(): number | null {
    return this.state.nextDelay;
  }

  /**
   * Get time until next attempt
   * @returns Time in ms or null
   */
  getTimeUntilNextAttempt(): number | null {
    if (!this.state.nextAttemptAt) {
      return null;
    }
    return Math.max(0, this.state.nextAttemptAt - Date.now());
  }

  /**
   * Get reconnection history
   * @returns Array of attempts
   */
  getHistory(): ReconnectAttempt[] {
    return [...this.state.history];
  }

  /**
   * Update configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<ReconnectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update handlers
   * @param handlers New handlers
   */
  updateHandlers(handlers: Partial<ReconnectionHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Calculate if should reconnect based on error
   * @param error Error that occurred
   * @returns True if should reconnect
   */
  shouldReconnect(error: SSEError): boolean {
    // Don't reconnect on fatal errors
    if (error.fatal) {
      return false;
    }

    // Check max retries
    if (
      this.config.maxRetries >= 0 &&
      this.state.attempts >= this.config.maxRetries
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get statistics
   * @returns Statistics object
   */
  getStats(): {
    attempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    averageDelay: number;
    lastAttemptDelay: number | null;
    totalReconnectTime: number;
  } {
    const successfulAttempts = this.state.history.filter(a => a.success).length;
    const failedAttempts = this.state.history.filter(
      a => a.success === false
    ).length;
    const delays = this.state.history.map(a => a.delay);
    const averageDelay =
      delays.length > 0
        ? delays.reduce((sum, d) => sum + d, 0) / delays.length
        : 0;
    const lastAttemptDelay =
      delays.length > 0 ? delays[delays.length - 1] : null;

    // Calculate total time spent reconnecting (sum of all delays)
    const totalReconnectTime = delays.reduce((sum, d) => sum + d, 0);

    return {
      attempts: this.state.history.length,
      successfulAttempts,
      failedAttempts,
      averageDelay,
      lastAttemptDelay,
      totalReconnectTime,
    };
  }
}

/**
 * Calculate linear backoff delay
 * @param initialDelay Initial delay
 * @param attempt Attempt number
 * @param maxDelay Maximum delay
 * @returns Calculated delay
 */
export function calculateLinearBackoff(
  initialDelay: number,
  attempt: number,
  maxDelay: number
): number {
  return Math.min(initialDelay * attempt, maxDelay);
}

/**
 * Calculate exponential backoff delay
 * @param initialDelay Initial delay
 * @param attempt Attempt number
 * @param maxDelay Maximum delay
 * @returns Calculated delay
 */
export function calculateExponentialBackoff(
  initialDelay: number,
  attempt: number,
  maxDelay: number
): number {
  return Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay);
}

/**
 * Calculate jittered exponential backoff delay
 * @param initialDelay Initial delay
 * @param attempt Attempt number
 * @param maxDelay Maximum delay
 * @param jitterAmount Jitter percentage (0-1)
 * @returns Calculated delay
 */
export function calculateJitterBackoff(
  initialDelay: number,
  attempt: number,
  maxDelay: number,
  jitterAmount = 0.1
): number {
  const exponentialDelay = initialDelay * Math.pow(2, attempt - 1);
  const jitter = exponentialDelay * jitterAmount * (Math.random() * 2 - 1);
  return Math.min(Math.max(exponentialDelay + jitter, 0), maxDelay);
}
