/**
 * Rate Limiting Module
 *
 * Exports all rate limiting functionality for @lsi/cascade.
 *
 * @module ratelimit
 */
export type { RateLimiter, RateLimiterConfig, RateLimitStats, } from "./RateLimiter";
export { RateLimitError, DEFAULT_RATE_LIMIT_CONFIG } from "./RateLimiter";
export type { TokenBucketConfig } from "./TokenBucket";
export { TokenBucketRateLimiter, createTokenBucketLimiter, } from "./TokenBucket";
export type { SlidingWindowConfig } from "./SlidingWindow";
export { SlidingWindowRateLimiter, createSlidingWindowLimiter, } from "./SlidingWindow";
import type { RateLimiter, RateLimiterConfig } from "./RateLimiter";
export declare function createRateLimiter(config: RateLimiterConfig): RateLimiter;
//# sourceMappingURL=index.d.ts.map