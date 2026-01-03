/**
 * Rate Limiting Module
 *
 * Exports all rate limiting functionality for @lsi/cascade.
 *
 * @module ratelimit
 */

// Core types and interfaces
export type {
  RateLimiter,
  RateLimiterConfig,
  RateLimitStats,
} from "./RateLimiter";

export { RateLimitError, DEFAULT_RATE_LIMIT_CONFIG } from "./RateLimiter";

// Token bucket implementation
export type { TokenBucketConfig } from "./TokenBucket";
export {
  TokenBucketRateLimiter,
  createTokenBucketLimiter,
} from "./TokenBucket";

// Sliding window implementation
export type { SlidingWindowConfig } from "./SlidingWindow";
export {
  SlidingWindowRateLimiter,
  createSlidingWindowLimiter,
} from "./SlidingWindow";

/**
 * Factory function to create a rate limiter
 *
 * Creates the appropriate rate limiter based on the algorithm specified in config.
 *
 * @param config - Rate limiter configuration
 * @returns Configured rate limiter
 *
 * @example
 * ```typescript
 * // Create a token bucket rate limiter
 * const limiter = createRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000,
 *   algorithm: 'token-bucket',
 *   refillRate: 10,
 *   burstCapacity: 20,
 * });
 *
 * // Create a sliding window rate limiter
 * const limiter = createRateLimiter({
 *   maxRequests: 100,
 *   windowMs: 60000,
 *   algorithm: 'sliding-window',
 * });
 * ```
 */
import { TokenBucketRateLimiter } from "./TokenBucket";
import { SlidingWindowRateLimiter } from "./SlidingWindow";
import type { RateLimiter, RateLimiterConfig } from "./RateLimiter";

export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  switch (config.algorithm) {
    case "token-bucket":
      return new TokenBucketRateLimiter({
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
        refillRate: config.refillRate ?? 10,
        burstCapacity: config.burstCapacity ?? config.maxRequests,
      });

    case "sliding-window":
      return new SlidingWindowRateLimiter({
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
      });

    default:
      throw new Error(`Unknown rate limiter algorithm: ${config.algorithm}`);
  }
}
