/**
 * Cache utilities for @lsi/cascade
 *
 * Provides cache warming, invalidation, optimization, and management utilities.
 */

export { CacheWarmer, getCommonQueries } from "./CacheWarmer";
export {
  type CacheWarmerConfig,
  type CacheWarmingResult,
  DEFAULT_CACHE_WARMER_CONFIG,
} from "./CacheWarmer";

export {
  CacheInvalidator,
  InvalidationStrategy,
  InvalidationPolicy,
  DEFAULT_INVALIDATION_OPTIONS,
} from "./CacheInvalidator";
export {
  type InvalidationOptions,
  type InvalidationResult,
} from "./CacheInvalidator";

export {
  CacheOptimizer,
  createOptimizer,
  needsOptimization,
  autoOptimize,
} from "./CacheOptimizer";
export {
  type CachePerformanceMetrics,
  type OptimizationSuggestion,
  type OptimizationResult,
} from "./CacheOptimizer";

export { RedisCache } from "./RedisCache";
export {
  type RedisOptions,
  type RedisCacheConfig,
  DEFAULT_REDIS_CACHE_CONFIG,
} from "./RedisCache";
