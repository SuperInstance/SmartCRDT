/**
 * @lsi/cascade/refiner - Query refinement and semantic caching
 */

export { QueryRefiner, DEFAULT_REFINER_CONFIG } from "./QueryRefiner";

export {
  SemanticCache,
  DEFAULT_SEMANTIC_CACHE_CONFIG,
  PRODUCTION_SEMANTIC_CACHE_CONFIG,
} from "./SemanticCache";

export {
  EmbeddingCache,
  DEFAULT_EMBEDDING_CACHE_CONFIG,
} from "./EmbeddingCache";

// P0 fix: HNSW index for O(log n) semantic search
export {
  HNSWIndex,
  DEFAULT_HNSW_CONFIG_768,
  DEFAULT_HNSW_CONFIG_1536,
} from "./HNSWIndex";

// Re-export from @lsi/embeddings for backward compatibility
export { OpenAIEmbeddingService } from "@lsi/embeddings";

// Cached embedding service with HNSW acceleration
export {
  CachedEmbeddingService,
} from "./CachedEmbeddingService";

export {
  MultiLevelCache,
  DEFAULT_MULTI_LEVEL_CACHE_CONFIG,
} from "./MultiLevelCache";

export type {
  QueryType,
  StaticFeatures,
  SemanticFeatures,
  RefinementSuggestion,
  RefinedQuery,
  SemanticCacheEntry,
} from "../types";

export type {
  SemanticCacheConfig,
  CacheHit,
  CacheMiss,
  EnhancedCacheStats,
  AdaptiveThresholdConfig,
  QueryTypeThresholds,
} from "./SemanticCache";

export type {
  CacheEntry,
  CacheStats,
  EmbeddingCacheConfig,
} from "./EmbeddingCache";

export type {
  EmbeddingServiceConfig,
  EmbeddingResult,
  EmbeddingError,
} from "@lsi/embeddings";

export type {
  CacheLevelConfig,
  MultiLevelCacheConfig,
  MultiLevelCacheStats,
  MultiLevelCacheHit,
  MultiLevelCacheMiss,
} from "./MultiLevelCache";

export type { HNSWConfig, SearchResult } from "./HNSWIndex";

export type {
  CachedEmbeddingServiceConfig,
  CachedEmbeddingStats,
  SimilarityResult,
} from "./CachedEmbeddingService";

// Cache invalidation strategies
export {
  CacheInvalidationManager,
  createInvalidationManager,
} from "./CacheInvalidationManager";
