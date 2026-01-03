/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm for rate limiting.
 *
 * Algorithm:
 * - Tokens are added to the bucket at a constant rate (refillRate)
 * - Bucket has a maximum capacity (burstCapacity)
 * - Each request consumes one token
 * - Requests are allowed if bucket has tokens
 * - Requests are denied if bucket is empty
 *
 * This allows for bursts of traffic while maintaining a long-term rate limit.
 *
 * @example
 * ```typescript
 * const limiter = new TokenBucketRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000,
 *   refillRate: 10, // 10 tokens per second
 *   burstCapacity: 20, // Allow burst of up to 20 requests
 * });
 *
 * if (await limiter.canMakeRequest()) {
 *   // Make request
 *   limiter.recordRequest();
 * } else {
 *   const waitTime = limiter.getWaitTime();
 *   console.log(`Wait ${waitTime}ms before retrying`);
 * }
 * ```
 */

import type { RateLimiter, RateLimitStats } from "./RateLimiter.js";

/**
 * Token bucket configuration
 */
export interface TokenBucketConfig {
  /** Maximum number of requests allowed in the time window */
  maxRequests: number;
  /** Time window in milliseconds (not directly used, but kept for config compatibility) */
  windowMs: number;
  /** Refill rate in tokens per second */
  refillRate: number;
  /** Maximum number of tokens the bucket can hold (burst capacity) */
  burstCapacity: number;
}

/**
 * Token bucket state
 */
interface TokenBucketState {
  /** Current token count */
  tokens: number;
  /** Last refill timestamp (ms since epoch) */
  lastRefill: number;
  /** Total requests made */
  requestsMade: number;
  /** Total requests limited */
  requestsLimited: number;
}

/**
 * Token Bucket Rate Limiter
 *
 * Uses a token bucket algorithm to rate limit requests.
 * Allows for bursts of traffic while maintaining a long-term average rate.
 */
export class TokenBucketRateLimiter implements RateLimiter {
  private config: TokenBucketConfig;
  private state: TokenBucketState;

  /**
   * Create a new token bucket rate limiter
   *
   * @param config - Rate limiter configuration
   */
  constructor(config: TokenBucketConfig) {
    this.config = {
      ...config,
      burstCapacity: config.burstCapacity || config.maxRequests,
    };

    // Initialize state with full bucket
    this.state = {
      tokens: this.config.burstCapacity,
      lastRefill: Date.now(),
      requestsMade: 0,
      requestsLimited: 0,
    };
  }

  /**
   * Refill tokens based on elapsed time
   *
   * This is called automatically before checking if a request can be made.
   */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.state.lastRefill;
    const elapsedSec = elapsedMs / 1000;

    // Calculate tokens to add
    const tokensToAdd = elapsedSec * this.config.refillRate;

    // Update token count (capped at burst capacity)
    this.state.tokens = Math.min(
      this.config.burstCapacity,
      this.state.tokens + tokensToAdd
    );

    // Update last refill time
    this.state.lastRefill = now;
  }

  /**
   * Check if a request can be made (async version)
   *
   * @returns Promise that resolves to true if request is allowed
   */
  async canMakeRequest(): Promise<boolean> {
    return this.canMakeRequestSync();
  }

  /**
   * Check if a request can be made (sync version)
   *
   * @returns true if request is allowed, false otherwise
   */
  canMakeRequestSync(): boolean {
    // Refill tokens first
    this.refill();

    // Check if we have at least one token
    return this.state.tokens >= 1;
  }

  /**
   * Record that a request was made
   *
   * Consumes one token from the bucket.
   */
  recordRequest(): void {
    // Refill tokens first
    this.refill();

    // Consume one token
    if (this.state.tokens >= 1) {
      this.state.tokens -= 1;
      this.state.requestsMade++;
    } else {
      this.state.requestsLimited++;
    }
  }

  /**
   * Get the wait time in milliseconds until the next request can be made
   *
   * @returns Wait time in milliseconds (0 if request can be made now)
   */
  getWaitTime(): number {
    // Refill tokens first
    this.refill();

    // If we have tokens, no wait time
    if (this.state.tokens >= 1) {
      return 0;
    }

    // Calculate time to get one token
    // refillRate is tokens per second, so time for one token = 1 / refillRate seconds
    const secondsPerToken = 1 / this.config.refillRate;
    return Math.ceil(secondsPerToken * 1000); // Convert to milliseconds
  }

  /**
   * Get current rate limit statistics
   *
   * @returns Current statistics
   */
  getStats(): RateLimitStats {
    // Refill tokens first
    this.refill();

    // Calculate when bucket will be full again
    const tokensNeeded = this.config.burstCapacity - this.state.tokens;
    const secondsToFull = tokensNeeded / this.config.refillRate;
    const resetTime = Date.now() + secondsToFull * 1000;

    return {
      requestsMade: this.state.requestsMade,
      requestsLimited: this.state.requestsLimited,
      currentCount: Math.floor(this.state.tokens),
      resetTime: Math.floor(resetTime),
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
    };
  }

  /**
   * Reset the rate limiter
   *
   * Clears all request history and resets token count.
   */
  reset(): void {
    this.state = {
      tokens: this.config.burstCapacity,
      lastRefill: Date.now(),
      requestsMade: 0,
      requestsLimited: 0,
    };
  }

  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getConfig(): TokenBucketConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<TokenBucketConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      burstCapacity: config.burstCapacity || this.config.burstCapacity,
    };
  }
}

/**
 * Factory function to create a token bucket rate limiter
 *
 * @param config - Rate limiter configuration
 * @returns Configured rate limiter
 *
 * @example
 * ```typescript
 * const limiter = createTokenBucketLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000,
 *   refillRate: 10,
 *   burstCapacity: 20,
 * });
 * ```
 */
export function createTokenBucketLimiter(
  config: TokenBucketConfig
): TokenBucketRateLimiter {
  return new TokenBucketRateLimiter(config);
}

/**
 * Export default class as default
 */
export default TokenBucketRateLimiter;
