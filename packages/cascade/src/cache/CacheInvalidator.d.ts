/**
 * Cache Invalidation - Smart cache eviction strategies
 *
 * Cache invalidation is one of the hardest problems in computer science.
 * This utility provides multiple strategies for evicting cache entries:
 *
 * 1. LRU (Least Recently Used) - Evict oldest entries
 * 2. LFU (Least Frequently Used) - Evict entries with fewest hits
 * 3. TTL (Time To Live) - Evict expired entries
 * 4. Adaptive - Evict based on performance metrics
 * 5. Manual - Pattern-based eviction
 *
 * Example:
 * ```ts
 * const invalidator = new CacheInvalidator(cache);
 * const count = invalidator.invalidate(InvalidationStrategy.LRU, {
 *   maxAge: 300000, // 5 minutes
 * });
 * console.log(`Invalidated ${count} entries`);
 * ```
 */
import { SemanticCache } from "../refiner/SemanticCache.js";
/**
 * Invalidation strategies
 */
export declare enum InvalidationStrategy {
    /** Least recently used - evict oldest entries */
    LRU = "lru",
    /** Least frequently used - evict entries with fewest hits */
    LFU = "lfu",
    /** Time-based expiration - evict entries older than maxAge */
    TTL = "ttl",
    /** Adaptive - evict based on hit rate performance */
    ADAPTIVE = "adaptive",
    /** Manual - pattern-based eviction */
    MANUAL = "manual"
}
/**
 * Invalidation options
 */
export interface InvalidationOptions {
    /** Maximum age in milliseconds (for LRU/TTL) */
    maxAge?: number;
    /** Minimum hit count threshold (for LFU) */
    minHitCount?: number;
    /** Pattern for manual matching (regex) */
    pattern?: RegExp;
    /** Maximum number of entries to invalidate */
    maxEntries?: number;
    /** Dry run - don't actually invalidate */
    dryRun?: boolean;
}
/**
 * Invalidation result
 */
export interface InvalidationResult {
    /** Number of entries invalidated */
    count: number;
    /** Strategy used */
    strategy: InvalidationStrategy;
    /** Options used */
    options: InvalidationOptions;
    /** Entries that would be/were invalidated */
    entries?: Array<{
        key: string;
        query: string;
        reason: string;
    }>;
    /** Dry run indicator */
    dryRun: boolean;
}
/**
 * CacheInvalidator - Smart cache eviction strategies
 */
export declare class CacheInvalidator {
    private cache;
    constructor(cache: SemanticCache);
    /**
     * Invalidate cache entries by strategy
     *
     * Applies the specified invalidation strategy with the given options.
     * Returns statistics about what was invalidated.
     *
     * @param strategy - Invalidation strategy to use
     * @param options - Strategy-specific options
     * @returns Invalidation result
     */
    invalidate(strategy: InvalidationStrategy, options?: InvalidationOptions): InvalidationResult;
    /**
     * Invalidate least recently used entries
     *
     * Evicts entries that haven't been accessed in a while.
     * Uses the lastAccessed timestamp to determine age.
     *
     * @param options - Invalidation options
     * @param entries - Array to collect invalidated entries
     * @returns Number of entries invalidated
     */
    private invalidateLRU;
    /**
     * Invalidate least frequently used entries
     *
     * Evicts entries with low hit counts. These entries aren't providing
     * much value and can be safely removed.
     *
     * @param options - Invalidation options
     * @param entries - Array to collect invalidated entries
     * @returns Number of entries invalidated
     */
    private invalidateLFU;
    /**
     * Invalidate by TTL (Time To Live)
     *
     * Similar to LRU but uses createdAt instead of lastAccessed.
     * Useful for absolute expiration regardless of access patterns.
     *
     * @param options - Invalidation options
     * @param entries - Array to collect invalidated entries
     * @returns Number of entries invalidated
     */
    private invalidateByTTL;
    /**
     * Invalidate based on adaptive performance
     *
     * Evicts entries with below-average hit rates. This adapts to
     * actual usage patterns and removes entries that aren't pulling
     * their weight.
     *
     * @param options - Invalidation options
     * @param entries - Array to collect invalidated entries
     * @returns Number of entries invalidated
     */
    private invalidateAdaptive;
    /**
     * Invalidate by pattern (manual)
     *
     * Evicts entries matching a regex pattern. Useful for selective
     * invalidation of specific query types or domains.
     *
     * @param options - Invalidation options
     * @param entries - Array to collect invalidated entries
     * @returns Number of entries invalidated
     */
    private invalidateByPattern;
    /**
     * Get all cache entries
     *
     * Helper method to iterate over cache entries.
     * Uses public API methods to avoid accessing private members.
     *
     * @returns Array of [key, entry] tuples
     */
    private getCacheEntries;
    /**
     * Get cache statistics
     *
     * Proxy to cache's getStats method.
     *
     * @returns Cache statistics
     */
    getStats(): import("../refiner/SemanticCache.js").EnhancedCacheStats;
    /**
     * Clear all cache entries
     *
     * Proxy to cache's clear method.
     */
    clear(): void;
    /**
     * Estimate cache memory usage
     *
     * Estimates memory usage based on cache size and average entry size.
     * This is a rough estimate, not exact.
     *
     * @returns Estimated memory usage in bytes
     */
    estimateMemoryUsage(): number;
    /**
     * Get recommended invalidation strategy
     *
     * Analyzes cache statistics and recommends the best strategy
     * based on current state.
     *
     * @returns Recommended strategy and options
     */
    getRecommendation(): {
        strategy: InvalidationStrategy;
        options: InvalidationOptions;
        reason: string;
    };
}
/**
 * Default invalidation options
 */
export declare const DEFAULT_INVALIDATION_OPTIONS: InvalidationOptions;
//# sourceMappingURL=CacheInvalidator.d.ts.map