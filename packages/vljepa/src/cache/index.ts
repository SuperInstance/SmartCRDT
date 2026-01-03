/**
 * @lsi/vljepa/cache - Visual Embedding Cache Module
 *
 * Multi-level caching system for VL-JEPA visual embeddings.
 *
 * @version 1.0.0
 */

// Visual Embedding Cache (main class)
export {
  VisualEmbeddingCache,
  DEFAULT_VISUAL_CACHE_CONFIG,
  PRODUCTION_VISUAL_CACHE_CONFIG,
  type VisualCacheConfig,
  type CacheEntry,
  type CacheMetadata,
  type CacheLookupResult,
} from "./VisualEmbeddingCache.js";

// Semantic Key Generator
export {
  SemanticKeyGenerator,
  DEFAULT_SEMANTIC_KEY_CONFIG,
  FAST_SEMANTIC_KEY_CONFIG,
  ACCURATE_SEMANTIC_KEY_CONFIG,
  type SemanticKey,
  type SimilarityMatch,
  type SemanticKeyGeneratorConfig,
  type PerceptualHashConfig,
  type UIStructureConfig,
} from "./SemanticKeyGenerator.js";

// Cache Invalidation
export {
  CacheInvalidation,
  DEFAULT_CACHE_INVALIDATION_CONFIG,
  AGGRESSIVE_CACHE_INVALIDATION_CONFIG,
  CONSERVATIVE_CACHE_INVALIDATION_CONFIG,
  type InvalidationTrigger,
  type InvalidationScope,
  type InvalidationRule,
  type InvalidationEvent,
  type CacheInvalidationConfig,
} from "./CacheInvalidation.js";

// Cache Warming
export {
  CacheWarming,
  DEFAULT_CACHE_WARMING_CONFIG,
  PRODUCTION_CACHE_WARMING_CONFIG,
  MINIMAL_CACHE_WARMING_CONFIG,
  type WarmingStrategy,
  type WarmupJob,
  type CacheWarmingConfig,
  type UserPattern,
  type PredictiveModel,
} from "./CacheWarming.js";

// Cache Metrics
export {
  CacheMetrics,
  DEFAULT_CACHE_METRICS_CONFIG,
  PRODUCTION_CACHE_METRICS_CONFIG,
  DEVELOPMENT_CACHE_METRICS_CONFIG,
  type LevelMetrics,
  type CacheMetrics as MetricsData,
  type MetricsSnapshot,
  type CacheMetricsConfig,
} from "./CacheMetrics.js";

// Semantic Cache Bridge
export {
  SemanticCacheBridge,
  DEFAULT_SEMANTIC_CACHE_BRIDGE_CONFIG,
  PRODUCTION_SEMANTIC_CACHE_BRIDGE_CONFIG,
  MINIMAL_SEMANTIC_CACHE_BRIDGE_CONFIG,
  type CacheEntryType,
  type MultiModalQuery,
  type MultiModalCacheResult,
  type UnifiedCacheMetrics,
  type SemanticCacheBridgeConfig,
} from "./SemanticCacheBridge.js";
