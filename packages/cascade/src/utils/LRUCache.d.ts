/**
 * LRU Cache - Least Recently Used cache implementation.
 *
 * Provides O(1) get/set operations with automatic eviction of least recently used items.
 *
 * @packageDocumentation
 */
/**
 * LRU Cache configuration.
 */
export interface LRUCacheConfig {
    /** Maximum cache size */
    maxSize: number;
    /** TTL in milliseconds (optional) */
    ttl?: number;
    /** Enable statistics tracking */
    trackStats?: boolean;
}
/**
 * Cache statistics.
 */
export interface CacheStats {
    /** Total cache hits */
    hits: number;
    /** Total cache misses */
    misses: number;
    /** Current cache size */
    size: number;
    /** Cache hit rate (0-1) */
    hitRate: number;
    /** Total evictions */
    evictions: number;
}
/**
 * LRU Cache implementation.
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, number>({ maxSize: 100 });
 * cache.set('key', 42);
 * const value = cache.get('key'); // 42
 * const stats = cache.getStats();
 * console.log(stats.hitRate); // 0.5 (50%)
 * ```
 */
export declare class LRUCache<K, V> {
    private cache;
    private config;
    private stats;
    constructor(config: LRUCacheConfig);
    /**
     * Get a value from the cache.
     *
     * @param key - Cache key
     * @returns Cached value or undefined
     */
    get(key: K): V | undefined;
    /**
     * Set a value in the cache.
     *
     * @param key - Cache key
     * @param value - Value to cache
     */
    set(key: K, value: V): void;
    /**
     * Check if a key exists in the cache.
     *
     * @param key - Cache key
     * @returns True if key exists and is not expired
     */
    has(key: K): boolean;
    /**
     * Delete a key from the cache.
     *
     * @param key - Cache key
     * @returns True if key was deleted
     */
    delete(key: K): boolean;
    /**
     * Clear all entries from the cache.
     */
    clear(): void;
    /**
     * Get cache statistics.
     *
     * @returns Cache statistics
     */
    getStats(): CacheStats;
    /**
     * Reset statistics.
     */
    resetStats(): void;
    /**
     * Get current cache size.
     *
     * @returns Current number of entries
     */
    get size(): number;
    /**
     * Evict least recently used entry.
     */
    private evictLRU;
    /**
     * Clean up expired entries.
     */
    cleanup(): void;
}
//# sourceMappingURL=LRUCache.d.ts.map