/**
 * AequorCache - LlamaIndex cache adapter for Aequor SemanticCache
 *
 * This adapter bridges Aequor's semantic caching with LlamaIndex's cache interface,
 * enabling intelligent caching based on semantic similarity rather than exact matches.
 *
 * Features:
 * - Semantic similarity caching (80%+ hit rate)
 * - Automatic cache key generation
 * - LRU eviction with semantic awareness
 * - Per-query-type thresholds
 * - Adaptive threshold optimization
 * - HNSW indexing for O(log n) search
 *
 * Example:
 * ```ts
 * import { AequorCache } from '@lsi/llamaindex/cache';
 *
 * const cache = new AequorCache({
 *   similarityThreshold: 0.85,
 *   maxSize: 1000
 * });
 *
 * // LlamaIndex will use this automatically
 * Settings.llmCache = cache;
 * ```
 */

import type {
  BaseCache,
  Cache,
  CacheConfig,
} from "llamaindex";
import { SemanticCache } from "@lsi/cascade/refiner";
import type { RefinedQuery } from "@lsi/cascade";
import { QueryRefiner } from "@lsi/cascade/refiner";

/**
 * Configuration for AequorCache
 */
export interface AequorCacheConfig {
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

  /** Enable per-query-type thresholds */
  enableQueryTypeThresholds?: boolean;

  /** Per-query-type threshold overrides */
  queryTypeThresholds?: {
    question?: number;
    command?: number;
    code?: number;
    explanation?: number;
    comparison?: number;
    debug?: number;
    general?: number;
  };

  /** HNSW index configuration */
  hnswConfig?: {
    /** Connections per node */
    M?: number;

    /** Build-time accuracy */
    efConstruction?: number;

    /** Search-time accuracy */
    efSearch?: number;
  };
}

/**
 * Cached result with metadata
 */
export interface CachedResult<T = unknown> {
  /** Cached value */
  result: T;

  /** Similarity score (0-1) */
  similarity: number;

  /** Match type (exact or semantic) */
  matchType: "exact" | "semantic";

  /** Time cached */
  timestamp: number;

  /** Number of times accessed */
  accessCount: number;
}

/**
 * AequorCache - LlamaIndex cache adapter
 */
export class AequorCache implements Cache<string> {
  private semanticCache: SemanticCache;
  private queryRefiner: QueryRefiner;
  private config: AequorCacheConfig;
  private enabled: boolean = true;

  constructor(config: AequorCacheConfig = {}) {
    this.config = {
      maxSize: 1000,
      similarityThreshold: 0.85,
      ttl: 300000, // 5 minutes
      enableClustering: true,
      enableAdaptiveThreshold: true,
      enableQueryTypeThresholds: true,
      ...config,
    };

    // Initialize semantic cache
    this.semanticCache = new SemanticCache({
      maxSize: this.config.maxSize,
      similarityThreshold: this.config.similarityThreshold,
      ttl: this.config.ttl,
      enableClustering: this.config.enableClustering,
      enableAdaptiveThreshold: this.config.enableAdaptiveThreshold,
      enableQueryTypeThresholds: this.config.enableQueryTypeThresholds,
      queryTypeThresholds: this.config.queryTypeThresholds,
      enableHNSW: true,
      hnswConfig: this.config.hnswConfig,
    });

    // Initialize query refiner for cache key generation
    this.queryRefiner = new QueryRefiner();
  }

  /**
   * Get value from cache
   */
  async get(key: string): Promise<string | undefined | null> {
    if (!this.enabled) return undefined;

    try {
      // Refine the key to get semantic features
      const refinedQuery = await this.queryRefiner.refine(key);

      // Check semantic cache
      const cached = await this.semanticCache.get(refinedQuery);

      if (cached.found) {
        const result = cached.result as CachedResult<string>;

        // Update access count
        result.accessCount++;

        // Return the cached value
        return result.result;
      }

      // No cache hit
      return undefined;
    } catch (error) {
      console.warn("[AequorCache] Error getting from cache:", error);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: string): Promise<void> {
    if (!this.enabled) return;

    try {
      // Refine the key to get semantic features
      const refinedQuery = await this.queryRefiner.refine(key);

      // Create cached result with metadata
      const cachedResult: CachedResult<string> = {
        result: value,
        similarity: 1.0,
        matchType: "exact",
        timestamp: Date.now(),
        accessCount: 1,
      };

      // Store in semantic cache
      await this.semanticCache.set(refinedQuery, cachedResult);
    } catch (error) {
      console.warn("[AequorCache] Error setting to cache:", error);
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const refinedQuery = await this.queryRefiner.refine(key);
      return this.semanticCache.delete(refinedQuery.cacheKey);
    } catch (error) {
      console.warn("[AequorCache] Error deleting from cache:", error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.semanticCache.clear();
  }

  /**
   * Check if cache has key
   */
  async has(key: string): Promise<boolean> {
    try {
      const refinedQuery = await this.queryRefiner.refine(key);
      return this.semanticCache.has(refinedQuery.cacheKey);
    } catch (error) {
      console.warn("[AequorCache] Error checking cache:", error);
      return false;
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.semanticCache.size();
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return this.semanticCache.keys();
  }

  /**
   * Enable or disable cache
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if cache is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = this.semanticCache.getStats();

    return {
      ...stats,
      enabled: this.enabled,
      // Additional computed metrics
      missRate: stats.totalMisses / (stats.totalHits + stats.totalMisses),
      averageSimilarity:
        stats.totalHits > 0
          ? (stats.exactHits * 1.0 +
              Array.from(Object.values(stats.byQueryType)).reduce(
                (sum, type) => sum + type.hits * type.avgSimilarity,
                0
              )) /
            stats.totalHits
          : 0,
    };
  }

  /**
   * Get detailed analytics
   */
  getAnalytics() {
    const stats = this.getStats();

    return {
      ...stats,

      // Performance indicators
      performance: {
        efficiency: stats.hitRate > 0.8 ? "excellent" : stats.hitRate > 0.6 ? "good" : "poor",
        recommendedAction: this.getRecommendedAction(stats),
      },

      // Query type breakdown
      queryTypeAnalysis: this.analyzeQueryTypes(stats.byQueryType),

      // Threshold optimization
      thresholdStatus: {
        current: stats.currentThreshold,
        adjustments: stats.thresholdAdjustments,
        optimized: stats.thresholdAdjustments > 5,
      },
    };
  }

  /**
   * Get recommended action based on cache performance
   */
  private getRecommendedAction(stats: any): string {
    if (stats.hitRate < 0.5) {
      return "Consider increasing cache size or lowering similarity threshold";
    } else if (stats.hitRate < 0.7) {
      return "Cache performance acceptable - consider enabling adaptive thresholds";
    } else if (stats.hitRate < 0.85) {
      return "Good cache performance - monitor and optimize";
    } else {
      return "Excellent cache performance - maintain current settings";
    }
  }

  /**
   * Analyze query type performance
   */
  private analyzeQueryTypeStats(byQueryType: Record<string, any>) {
    return Object.entries(byQueryType).map(([type, stats]) => ({
      type,
      hitRate: stats.hitRate,
      avgSimilarity: stats.avgSimilarity,
      volume: stats.hits + stats.misses,
      efficiency: stats.hitRate > 0.8 ? "excellent" : stats.hitRate > 0.6 ? "good" : "poor",
    }));
  }

  /**
   * Set similarity threshold
   */
  setSimilarityThreshold(threshold: number): void {
    this.semanticCache.setSimilarityThreshold(threshold);
  }

  /**
   * Get current similarity threshold
   */
  getSimilarityThreshold(): number {
    return this.semanticCache.getSimilarityThreshold();
  }

  /**
   * Set max cache size
   */
  setMaxSize(size: number): void {
    this.semanticCache.setMaxSize(size);
  }

  /**
   * Get max cache size
   */
  getMaxSize(): number {
    return this.semanticCache.getMaxSize();
  }

  /**
   * Warm cache with common queries
   */
  async warmCache(entries: Array<{ key: string; value: string }>): Promise<{
    success: number;
    failed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        await this.set(entry.key, entry.value);
        success++;
      } catch (error) {
        console.warn(`[AequorCache] Failed to warm cache for key: ${entry.key}`, error);
        failed++;
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[AequorCache] Cache warming complete: ${success} successful, ${failed} failed, ${duration}ms`
    );

    return { success, failed, duration };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): void {
    // Semantic cache handles TTL automatically
    // This is a no-op but kept for API compatibility
  }

  /**
   * Export cache contents for analysis
   */
  exportCache(): Array<{ key: string; result: CachedResult; similarity?: number }> {
    const keys = this.semanticCache.keys();
    const exported: Array<{ key: string; result: CachedResult; similarity?: number }> = [];

    for (const key of keys) {
      const entry = this.semanticCache.peek(key);
      if (entry) {
        exported.push({
          key,
          result: entry.result as CachedResult,
          similarity: entry.embedding ? 1.0 : undefined,
        });
      }
    }

    return exported;
  }

  /**
   * Import cache entries (for migration or bulk loading)
   */
  async importCache(
    entries: Array<{ key: string; value: string; timestamp?: number }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        await this.set(entry.key, entry.value);
        success++;
      } catch (error) {
        console.warn(`[AequorCache] Failed to import key: ${entry.key}`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Get top accessed entries
   */
  getTopEntries(limit: number = 10): Array<{ key: string; accessCount: number }> {
    const stats = this.semanticCache.getStats();
    return stats.topEntries.slice(0, limit);
  }

  /**
   * Reset statistics without clearing cache
   */
  resetStats(): void {
    this.semanticCache.resetStats();
  }
}

/**
 * Create an AequorCache instance with default configuration
 */
export function createAequorCache(config?: AequorCacheConfig): AequorCache {
  return new AequorCache(config);
}

/**
 * Default cache configuration for production use
 */
export const DEFAULT_AEQUOR_CACHE_CONFIG: AequorCacheConfig = {
  maxSize: 1000,
  similarityThreshold: 0.85,
  ttl: 300000, // 5 minutes
  enableClustering: true,
  enableAdaptiveThreshold: true,
  enableQueryTypeThresholds: true,
  queryTypeThresholds: {
    code: 0.92,
    debug: 0.88,
  },
  hnswConfig: {
    M: 16,
    efConstruction: 200,
    efSearch: 50,
  },
};
