/**
 * SemanticCache - High-performance semantic caching
 *
 * Achieves 80% cache hit rate through:
 * 1. Semantic similarity matching (not just exact string matching)
 * 2. Intelligent cache key generation (includes query type, complexity)
 * 3. LRU eviction with semantic awareness
 * 4. Cache statistics for monitoring
 * 5. O(log n) HNSW index for fast similarity search
 *
 * The key insight: Two queries that are semantically similar should
 * hit the same cache entry, even if the wording is different.
 *
 * Example:
 * ```ts
 * const cache = new SemanticCache();
 * await cache.set("How do I optimize TypeScript?", result1);
 * await cache.set("TypeScript optimization tips?", result2);
 * // Second query hits cache (semantic similarity > 0.85)
 * ```
 */
import type { SemanticCacheEntry, RefinedQuery, QueryType } from "../types.js";
import { type HNSWConfig } from "./HNSWIndex.js";
/**
 * Adaptive threshold configuration
 */
export interface AdaptiveThresholdConfig {
    /** Initial threshold value */
    initialThreshold: number;
    /** Minimum threshold allowed */
    minThreshold: number;
    /** Maximum threshold allowed */
    maxThreshold: number;
    /** How much to adjust per step */
    adjustmentFactor: number;
    /** Number of samples before adjustment */
    measurementWindow: number;
    /** Target hit rate */
    targetHitRate: number;
}
/**
 * Per-query-type thresholds
 */
export interface QueryTypeThresholds {
    question: number;
    command: number;
    code: number;
    explanation: number;
    comparison: number;
    debug: number;
    general: number;
}
/**
 * Enhanced cache statistics
 */
export interface EnhancedCacheStats {
    /** Current cache size */
    size: number;
    /** Overall hit rate */
    hitRate: number;
    /** Total hits */
    totalHits: number;
    /** Total misses */
    totalMisses: number;
    /** Exact matches (fast path) */
    exactHits: number;
    /** Semantic similarity hits */
    semanticHits: number;
    /** Similarity distribution */
    similarityDistribution: {
        high: number;
        medium: number;
        low: number;
    };
    /** Per-query-type statistics */
    byQueryType: Record<QueryType, {
        hits: number;
        misses: number;
        hitRate: number;
        avgSimilarity: number;
    }>;
    /** Current threshold */
    currentThreshold: number;
    /** Number of threshold adjustments */
    thresholdAdjustments: number;
    /** Top entries */
    topEntries: Array<{
        query: string;
        hitCount: number;
    }>;
}
/**
 * SemanticCache configuration
 */
export interface SemanticCacheConfig {
    /** Maximum cache size */
    maxSize?: number;
    /** Similarity threshold for cache hits (0-1) */
    similarityThreshold?: number;
    /** TTL for cache entries (ms) */
    ttl?: number;
    /** Enable semantic clustering */
    enableClustering?: boolean;
    /** Enable adaptive threshold optimization */
    enableAdaptiveThreshold?: boolean;
    /** Adaptive threshold configuration */
    adaptiveThreshold?: Partial<AdaptiveThresholdConfig>;
    /** Enable per-query-type thresholds */
    enableQueryTypeThresholds?: boolean;
    /** Per-query-type threshold overrides */
    queryTypeThresholds?: Partial<QueryTypeThresholds>;
    /** HNSW index configuration */
    hnswConfig?: Partial<HNSWConfig>;
    /** Enable HNSW index (default: true) */
    enableHNSW?: boolean;
}
/**
 * Cache hit result
 */
export interface CacheHit {
    /** Hit found */
    found: true;
    /** Cached result */
    result: unknown;
    /** Similarity score (0-1) */
    similarity: number;
    /** Cache entry metadata */
    entry: SemanticCacheEntry;
}
/**
 * Cache miss result
 */
export interface CacheMiss {
    /** Hit not found */
    found: false;
    /** Similar queries (for suggestions) */
    similarQueries: Array<{
        query: string;
        similarity: number;
    }>;
}
/**
 * SemanticCache - High hit rate through semantic similarity
 */
export declare class SemanticCache {
    private config;
    private cache;
    private embeddingIndex;
    private lruList;
    private hnswIndex;
    private stats;
    private readonly defaultQueryTypeThresholds;
    private readonly defaultAdaptiveConfig;
    constructor(config?: SemanticCacheConfig);
    /**
     * Get from cache with semantic similarity matching
     * @param refinedQuery - The refined query with semantic features
     * @returns Cache hit or miss
     */
    get(refinedQuery: RefinedQuery): Promise<CacheHit | CacheMiss>;
    /**
     * Set entry in cache
     * @param refinedQuery - The refined query
     * @param result - The result to cache
     */
    set(refinedQuery: RefinedQuery, result: unknown): Promise<void>;
    /**
     * Find semantically similar cache entries
     * Uses HNSW index for O(log n) search if available, otherwise O(n) fallback
     * @param embedding - Query embedding vector
     * @param threshold - Similarity threshold to use
     * @returns Sorted array of similar entries
     */
    private findSimilarSemantically;
    /**
     * Get threshold for a specific query type
     * @param queryType - The query type
     * @returns Similarity threshold to use
     */
    private getThresholdForQuery;
    /**
     * Track a cache hit
     * @param queryType - The query type
     * @param hitType - Type of hit (exact or semantic)
     * @param similarity - Similarity score
     */
    private trackHit;
    /**
     * Track a cache miss
     * @param queryType - The query type
     */
    private trackMiss;
    /**
     * Check and adjust threshold based on performance
     */
    private checkAndAdjustThreshold;
    /**
     * Update embedding index for fast similarity search
     */
    private updateEmbeddingIndex;
    /**
     * Hash embedding to bucket (simplified LSH)
     */
    private hashEmbedding;
    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity;
    /**
     * Check if cache entry is expired
     */
    private isExpired;
    /**
     * Update LRU list
     */
    private updateLRU;
    /**
     * Evict least recently used entry
     */
    private evictLRU;
    /**
     * Get cache statistics
     * @returns Enhanced cache statistics
     */
    getStats(): EnhancedCacheStats;
    /**
     * Clear all cache entries and reset statistics
     */
    clear(): void;
    /**
     * Reset statistics without clearing cache
     */
    resetStats(): void;
    /**
     * Get cache size
     */
    size(): number;
    /**
     * Delete specific cache entry
     */
    delete(cacheKey: string): boolean;
    /**
     * Get all cache keys
     */
    keys(): string[];
    /**
     * Check if cache has key
     */
    has(cacheKey: string): boolean;
    /**
     * Get cache entry (without updating LRU)
     */
    peek(cacheKey: string): SemanticCacheEntry | undefined;
    /**
     * Get current similarity threshold
     */
    getSimilarityThreshold(): number;
    /**
     * Set similarity threshold
     */
    setSimilarityThreshold(threshold: number): void;
    /**
     * Get max cache size
     */
    getMaxSize(): number;
    /**
     * Set max cache size
     */
    setMaxSize(size: number): void;
}
/**
 * Default configuration
 */
export declare const DEFAULT_SEMANTIC_CACHE_CONFIG: SemanticCacheConfig;
/**
 * Production configuration for 80% hit rate target
 */
export declare const PRODUCTION_SEMANTIC_CACHE_CONFIG: SemanticCacheConfig;
//# sourceMappingURL=SemanticCache.d.ts.map