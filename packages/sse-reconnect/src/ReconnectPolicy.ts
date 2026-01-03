/**
 * Reconnect Policy
 *
 * Determines whether and when to attempt reconnection based on
 * disconnect reason, attempt count, and configuration.
 */

import type {
  DisconnectReason,
  ReconnectDecision,
  ReconnectConfig,
  PolicyContext,
} from "./types.js";
import { BackoffCalculator } from "./BackoffCalculator.js";

/**
 * Reconnect policy configuration
 */
export interface ReconnectPolicyConfig {
  /** Maximum number of retry attempts (0 = infinite) */
  maxRetries: number;
  /** Initial delay before first retry */
  initialDelay: number;
  /** Maximum delay between retries */
  maxDelay: number;
  /** Backoff strategy */
  backoffStrategy: ReconnectConfig["backoffStrategy"];
  /** Jitter factor for exponential backoff */
  jitterFactor: number;
  /** Reasons that should trigger reconnection */
  reconnectOnReasons: Set<DisconnectReason>;
  /** Maximum time to spend attempting to reconnect (0 = infinite) */
  maxReconnectTime: number;
  /** Whether to reconnect on server close */
  reconnectOnServerClose: boolean;
  /** Whether to reconnect on network loss */
  reconnectOnNetworkLoss: boolean;
  /** Whether to reconnect on error */
  reconnectOnError: boolean;
}

/**
 * Default reconnect policy configuration
 */
export const DEFAULT_POLICY_CONFIG: ReconnectPolicyConfig = {
  maxRetries: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffStrategy: "exponential-with-jitter",
  jitterFactor: 0.1,
  reconnectOnReasons: new Set<DisconnectReason>([
    "error",
    "timeout",
    "server-close",
    "network-loss",
  ]),
  maxReconnectTime: 0, // No limit
  reconnectOnServerClose: true,
  reconnectOnNetworkLoss: true,
  reconnectOnError: true,
};

/**
 * Callback when max retries is reached
 */
export type MaxRetriesCallback = (
  totalAttempts: number,
  reason: DisconnectReason
) => void;

/**
 * Callback on successful reconnection
 */
export type ReconnectSuccessCallback = (
  attemptNumber: number,
  totalTime: number
) => void;

/**
 * Reconnect policy for determining reconnection behavior
 */
export class ReconnectPolicy {
  private config: ReconnectPolicyConfig;
  private backoffCalculator: BackoffCalculator;
  private maxRetriesCallback: MaxRetriesCallback | null;
  private reconnectSuccessCallback: ReconnectSuccessCallback | null;
  private attemptCount: number;
  private totalReconnectTime: number;
  private reconnectStartTime: number | null;

  constructor(config: Partial<ReconnectPolicyConfig> = {}) {
    this.config = { ...DEFAULT_POLICY_CONFIG, ...config };
    this.backoffCalculator = new BackoffCalculator(this.toReconnectConfig());
    this.maxRetriesCallback = null;
    this.reconnectSuccessCallback = null;
    this.attemptCount = 0;
    this.totalReconnectTime = 0;
    this.reconnectStartTime = null;
  }

  /**
   * Determine if reconnection should be attempted
   */
  shouldReconnect(reason: DisconnectReason, attempt: number): boolean {
    // Check if max retries exceeded
    if (this.config.maxRetries > 0 && attempt > this.config.maxRetries) {
      return false;
    }

    // Check if reason allows reconnection
    if (!this.config.reconnectOnReasons.has(reason)) {
      return false;
    }

    // Check specific reason settings
    if (reason === "server-close" && !this.config.reconnectOnServerClose) {
      return false;
    }

    if (reason === "network-loss" && !this.config.reconnectOnNetworkLoss) {
      return false;
    }

    if (reason === "error" && !this.config.reconnectOnError) {
      return false;
    }

    // Check if reconnect time exceeded
    if (this.reconnectStartTime && this.config.maxReconnectTime > 0) {
      const elapsed = Date.now() - this.reconnectStartTime;
      if (elapsed >= this.config.maxReconnectTime) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get reconnection decision with delay calculation
   */
  getReconnectDecision(
    reason: DisconnectReason,
    attempt: number,
    timeSinceLastConnection: number
  ): ReconnectDecision {
    if (!this.shouldReconnect(reason, attempt)) {
      let reasonStr = "Max retries exceeded";
      if (!this.config.reconnectOnReasons.has(reason)) {
        reasonStr = `Reconnection disabled for reason: ${reason}`;
      } else if (this.config.maxReconnectTime > 0 && this.reconnectStartTime) {
        const elapsed = Date.now() - this.reconnectStartTime;
        if (elapsed >= this.config.maxReconnectTime) {
          reasonStr = "Max reconnect time exceeded";
        }
      }

      return {
        shouldReconnect: false,
        delay: 0,
        reason: reasonStr,
      };
    }

    const delay = this.backoffCalculator.calculateDelay(attempt).delay;

    return {
      shouldReconnect: true,
      delay,
      reason: `Reconnection attempt ${attempt} after ${delay}ms delay`,
    };
  }

  /**
   * Get retry delay for a given attempt
   */
  getRetryDelay(attempt: number): number {
    return this.backoffCalculator.calculateDelay(attempt).delay;
  }

  /**
   * Record a reconnection attempt
   */
  recordAttempt(): void {
    if (this.attemptCount === 0) {
      this.reconnectStartTime = Date.now();
    }
    this.attemptCount++;
  }

  /**
   * Record a successful reconnection
   */
  recordSuccess(attempt: number): void {
    const totalTime = this.reconnectStartTime
      ? Date.now() - this.reconnectStartTime
      : 0;

    this.totalReconnectTime = totalTime;
    this.attemptCount = 0;
    this.reconnectStartTime = null;

    if (this.reconnectSuccessCallback) {
      this.reconnectSuccessCallback(attempt, totalTime);
    }
  }

  /**
   * Handle max retries reached
   */
  onMaxRetriesReached(reason: DisconnectReason): void {
    if (this.maxRetriesCallback) {
      this.maxRetriesCallback(this.attemptCount, reason);
    }

    // Reset state
    this.attemptCount = 0;
    this.reconnectStartTime = null;
  }

  /**
   * Set callback for max retries reached
   */
  setMaxRetriesCallback(callback: MaxRetriesCallback): void {
    this.maxRetriesCallback = callback;
  }

  /**
   * Set callback for successful reconnection
   */
  setReconnectSuccessCallback(callback: ReconnectSuccessCallback): void {
    this.reconnectSuccessCallback = callback;
  }

  /**
   * Get current attempt count
   */
  getAttemptCount(): number {
    return this.attemptCount;
  }

  /**
   * Get total reconnect time
   */
  getTotalReconnectTime(): number {
    if (this.reconnectStartTime) {
      return Date.now() - this.reconnectStartTime;
    }
    return this.totalReconnectTime;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ReconnectPolicyConfig>): void {
    this.config = { ...this.config, ...config };
    this.backoffCalculator.updateConfig(this.toReconnectConfig());
  }

  /**
   * Get current configuration
   */
  getConfig(): ReconnectPolicyConfig {
    return { ...this.config };
  }

  /**
   * Reset policy state
   */
  reset(): void {
    this.attemptCount = 0;
    this.totalReconnectTime = 0;
    this.reconnectStartTime = null;
  }

  /**
   * Estimate if reconnection will succeed based on attempts so far
   */
  estimateSuccessProbability(): number {
    if (this.attemptCount === 0) {
      return 1.0;
    }

    if (this.config.maxRetries === 0) {
      // Infinite retries, probability decreases slowly
      return Math.max(0.1, 1.0 - this.attemptCount * 0.05);
    }

    const remaining = this.config.maxRetries - this.attemptCount;
    const total = this.config.maxRetries;

    return remaining / total;
  }

  /**
   * Convert to ReconnectConfig for BackoffCalculator
   */
  private toReconnectConfig(): ReconnectConfig {
    return {
      maxRetries: this.config.maxRetries,
      initialDelay: this.config.initialDelay,
      maxDelay: this.config.maxDelay,
      jitterFactor: this.config.jitterFactor,
      backoffStrategy: this.config.backoffStrategy,
      enableEventBuffer: true,
      maxBufferSize: 1024 * 1024,
      healthCheckInterval: 30000,
      connectionTimeout: 10000,
      reconnectOnServerClose: this.config.reconnectOnServerClose,
      reconnectOnNetworkLoss: this.config.reconnectOnNetworkLoss,
      reconnectOnError: this.config.reconnectOnError,
    };
  }
}

/**
 * Create a reconnect policy with configuration
 */
export function createReconnectPolicy(
  config?: Partial<ReconnectPolicyConfig>
): ReconnectPolicy {
  return new ReconnectPolicy(config);
}

/**
 * Create a reconnect policy from ReconnectConfig
 */
export function createReconnectPolicyFromConfig(
  config: ReconnectConfig
): ReconnectPolicy {
  return new ReconnectPolicy({
    maxRetries: config.maxRetries,
    initialDelay: config.initialDelay,
    maxDelay: config.maxDelay,
    backoffStrategy: config.backoffStrategy,
    jitterFactor: config.jitterFactor,
    reconnectOnReasons: new Set<DisconnectReason>(
      config.reconnectOnServerClose ||
        config.reconnectOnNetworkLoss ||
        config.reconnectOnError
        ? ["error", "timeout", "server-close", "network-loss"]
        : []
    ),
    reconnectOnServerClose: config.reconnectOnServerClose,
    reconnectOnNetworkLoss: config.reconnectOnNetworkLoss,
    reconnectOnError: config.reconnectOnError,
  });
}
