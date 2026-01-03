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
/**
 * Invalidation strategies
 */
export var InvalidationStrategy;
(function (InvalidationStrategy) {
    /** Least recently used - evict oldest entries */
    InvalidationStrategy["LRU"] = "lru";
    /** Least frequently used - evict entries with fewest hits */
    InvalidationStrategy["LFU"] = "lfu";
    /** Time-based expiration - evict entries older than maxAge */
    InvalidationStrategy["TTL"] = "ttl";
    /** Adaptive - evict based on hit rate performance */
    InvalidationStrategy["ADAPTIVE"] = "adaptive";
    /** Manual - pattern-based eviction */
    InvalidationStrategy["MANUAL"] = "manual";
})(InvalidationStrategy || (InvalidationStrategy = {}));
/**
 * CacheInvalidator - Smart cache eviction strategies
 */
export class CacheInvalidator {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
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
    invalidate(strategy, options = {}) {
        const entries = [];
        let count = 0;
        switch (strategy) {
            case InvalidationStrategy.LRU:
                count = this.invalidateLRU(options, entries);
                break;
            case InvalidationStrategy.LFU:
                count = this.invalidateLFU(options, entries);
                break;
            case InvalidationStrategy.TTL:
                count = this.invalidateByTTL(options, entries);
                break;
            case InvalidationStrategy.ADAPTIVE:
                count = this.invalidateAdaptive(options, entries);
                break;
            case InvalidationStrategy.MANUAL:
                count = this.invalidateByPattern(options, entries);
                break;
            default:
                console.warn(`[CacheInvalidator] Unknown strategy: ${strategy}`);
        }
        return {
            count,
            strategy,
            options,
            entries: options.dryRun ? entries : undefined,
            dryRun: options.dryRun ?? false,
        };
    }
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
    invalidateLRU(options, entries) {
        const maxAge = options.maxAge ?? 300000; // 5 minutes default
        const maxEntries = options.maxEntries ?? Infinity;
        const now = Date.now();
        let count = 0;
        // Collect entries to invalidate
        const toInvalidate = [];
        for (const [key, entry] of this.getCacheEntries()) {
            const age = now - entry.lastAccessed;
            if (age > maxAge) {
                toInvalidate.push({ key, age });
                if (entries.length < 100) {
                    // Limit entries array size
                    entries.push({
                        key,
                        query: entry.query,
                        reason: `LRU: age ${(age / 1000).toFixed(1)}s > ${(maxAge / 1000).toFixed(1)}s`,
                    });
                }
            }
        }
        // Sort by age (oldest first) and limit
        toInvalidate.sort((a, b) => b.age - a.age);
        for (const { key } of toInvalidate.slice(0, maxEntries)) {
            if (!options.dryRun) {
                this.cache.delete(key);
            }
            count++;
        }
        console.log(`[CacheInvalidator] LRU: Invalidated ${count} entries older than ${maxAge}ms`);
        return count;
    }
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
    invalidateLFU(options, entries) {
        const minHitCount = options.minHitCount ?? 2;
        const maxEntries = options.maxEntries ?? Infinity;
        let count = 0;
        // Collect entries to invalidate
        const toInvalidate = [];
        for (const [key, entry] of this.getCacheEntries()) {
            if (entry.hitCount < minHitCount) {
                toInvalidate.push({ key, hitCount: entry.hitCount });
                if (entries.length < 100) {
                    entries.push({
                        key,
                        query: entry.query,
                        reason: `LFU: hitCount ${entry.hitCount} < ${minHitCount}`,
                    });
                }
            }
        }
        // Sort by hit count (lowest first) and limit
        toInvalidate.sort((a, b) => a.hitCount - b.hitCount);
        for (const { key } of toInvalidate.slice(0, maxEntries)) {
            if (!options.dryRun) {
                this.cache.delete(key);
            }
            count++;
        }
        console.log(`[CacheInvalidator] LFU: Invalidated ${count} entries with hitCount < ${minHitCount}`);
        return count;
    }
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
    invalidateByTTL(options, entries) {
        // Use LRU logic but with createdAt
        const maxAge = options.maxAge ?? 300000; // 5 minutes default
        const maxEntries = options.maxEntries ?? Infinity;
        const now = Date.now();
        let count = 0;
        const toInvalidate = [];
        for (const [key, entry] of this.getCacheEntries()) {
            const age = now - entry.createdAt;
            if (age > maxAge) {
                toInvalidate.push({ key, age });
                if (entries.length < 100) {
                    entries.push({
                        key,
                        query: entry.query,
                        reason: `TTL: age ${(age / 1000).toFixed(1)}s > ${(maxAge / 1000).toFixed(1)}s`,
                    });
                }
            }
        }
        toInvalidate.sort((a, b) => b.age - a.age);
        for (const { key } of toInvalidate.slice(0, maxEntries)) {
            if (!options.dryRun) {
                this.cache.delete(key);
            }
            count++;
        }
        console.log(`[CacheInvalidator] TTL: Invalidated ${count} entries older than ${maxAge}ms`);
        return count;
    }
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
    invalidateAdaptive(options, entries) {
        const maxEntries = options.maxEntries ?? Infinity;
        // Get cache statistics
        const stats = this.cache.getStats();
        const threshold = stats.hitRate * 0.5; // Remove entries below 50% of average
        let count = 0;
        const toInvalidate = [];
        for (const [key, entry] of this.getCacheEntries()) {
            // Estimate entry hit rate from hitCount
            const entryHitRate = entry.hitCount / (entry.hitCount + 1);
            if (entryHitRate < threshold) {
                toInvalidate.push({ key, hitRate: entryHitRate });
                if (entries.length < 100) {
                    entries.push({
                        key,
                        query: entry.query,
                        reason: `Adaptive: hitRate ${(entryHitRate * 100).toFixed(1)}% < ${(threshold * 100).toFixed(1)}%`,
                    });
                }
            }
        }
        // Sort by hit rate (lowest first) and limit
        toInvalidate.sort((a, b) => a.hitRate - b.hitRate);
        for (const { key } of toInvalidate.slice(0, maxEntries)) {
            if (!options.dryRun) {
                this.cache.delete(key);
            }
            count++;
        }
        console.log(`[CacheInvalidator] Adaptive: Invalidated ${count} entries with hitRate < ${(threshold * 100).toFixed(1)}%`);
        return count;
    }
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
    invalidateByPattern(options, entries) {
        const pattern = options.pattern;
        const maxEntries = options.maxEntries ?? Infinity;
        if (!pattern) {
            console.warn("[CacheInvalidator] Manual: No pattern provided");
            return 0;
        }
        let count = 0;
        for (const [key, entry] of this.getCacheEntries()) {
            if (count >= maxEntries)
                break;
            if (pattern.test(key) || pattern.test(entry.query)) {
                if (!options.dryRun) {
                    this.cache.delete(key);
                }
                if (entries.length < 100) {
                    entries.push({
                        key,
                        query: entry.query,
                        reason: `Manual: matched pattern ${pattern.source}`,
                    });
                }
                count++;
            }
        }
        console.log(`[CacheInvalidator] Manual: Invalidated ${count} entries matching pattern ${pattern.source}`);
        return count;
    }
    /**
     * Get all cache entries
     *
     * Helper method to iterate over cache entries.
     * Uses public API methods to avoid accessing private members.
     *
     * @returns Array of [key, entry] tuples
     */
    getCacheEntries() {
        const entries = [];
        // Use public keys() and peek() methods
        for (const key of this.cache.keys()) {
            const entry = this.cache.peek(key);
            if (entry) {
                entries.push([key, entry]);
            }
        }
        return entries;
    }
    /**
     * Get cache statistics
     *
     * Proxy to cache's getStats method.
     *
     * @returns Cache statistics
     */
    getStats() {
        return this.cache.getStats();
    }
    /**
     * Clear all cache entries
     *
     * Proxy to cache's clear method.
     */
    clear() {
        this.cache.clear();
        console.log("[CacheInvalidator] Cleared all cache entries");
    }
    /**
     * Estimate cache memory usage
     *
     * Estimates memory usage based on cache size and average entry size.
     * This is a rough estimate, not exact.
     *
     * @returns Estimated memory usage in bytes
     */
    estimateMemoryUsage() {
        const stats = this.cache.getStats();
        const avgEntrySize = 1024; // Rough estimate: 1KB per entry
        return stats.size * avgEntrySize;
    }
    /**
     * Get recommended invalidation strategy
     *
     * Analyzes cache statistics and recommends the best strategy
     * based on current state.
     *
     * @returns Recommended strategy and options
     */
    getRecommendation() {
        const stats = this.cache.getStats();
        // If cache is small, no need to invalidate
        if (stats.size < 100) {
            return {
                strategy: InvalidationStrategy.TTL,
                options: { maxAge: 3600000 }, // 1 hour
                reason: "Cache is small, use TTL for basic cleanup",
            };
        }
        // If hit rate is low, try adaptive
        if (stats.hitRate < 0.5) {
            return {
                strategy: InvalidationStrategy.ADAPTIVE,
                options: {},
                reason: "Hit rate is low, adaptive invalidation may help",
            };
        }
        // If hit rate is high, use LRU
        if (stats.hitRate > 0.8) {
            return {
                strategy: InvalidationStrategy.LRU,
                options: { maxAge: 300000 }, // 5 minutes
                reason: "Hit rate is good, use LRU for maintenance",
            };
        }
        // Default to TTL
        return {
            strategy: InvalidationStrategy.TTL,
            options: { maxAge: 600000 }, // 10 minutes
            reason: "Default TTL strategy",
        };
    }
}
/**
 * Default invalidation options
 */
export const DEFAULT_INVALIDATION_OPTIONS = {
    maxAge: 300000, // 5 minutes
    minHitCount: 2,
    dryRun: false,
};
//# sourceMappingURL=CacheInvalidator.js.map