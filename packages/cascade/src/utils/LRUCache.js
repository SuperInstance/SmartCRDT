/**
 * LRU Cache - Least Recently Used cache implementation.
 *
 * Provides O(1) get/set operations with automatic eviction of least recently used items.
 *
 * @packageDocumentation
 */
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
export class LRUCache {
    cache = new Map();
    config;
    stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
    };
    constructor(config) {
        this.config = {
            maxSize: config.maxSize,
            ttl: config.ttl ?? Infinity,
            trackStats: config.trackStats ?? true,
        };
    }
    /**
     * Get a value from the cache.
     *
     * @param key - Cache key
     * @returns Cached value or undefined
     */
    get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            if (this.config.trackStats) {
                this.stats.misses++;
            }
            return undefined;
        }
        // Check TTL
        if (Date.now() - entry.timestamp > this.config.ttl) {
            this.cache.delete(key);
            if (this.config.trackStats) {
                this.stats.misses++;
            }
            return undefined;
        }
        // Update entry metadata (move to end = most recently used)
        entry.timestamp = Date.now();
        entry.accessCount++;
        if (this.config.trackStats) {
            this.stats.hits++;
        }
        return entry.value;
    }
    /**
     * Set a value in the cache.
     *
     * @param key - Cache key
     * @param value - Value to cache
     */
    set(key, value) {
        // Check if we need to evict
        if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            accessCount: 0,
        });
    }
    /**
     * Check if a key exists in the cache.
     *
     * @param key - Cache key
     * @returns True if key exists and is not expired
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        // Check TTL
        if (Date.now() - entry.timestamp > this.config.ttl) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }
    /**
     * Delete a key from the cache.
     *
     * @param key - Cache key
     * @returns True if key was deleted
     */
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * Clear all entries from the cache.
     */
    clear() {
        this.cache.clear();
        if (this.config.trackStats) {
            this.stats.hits = 0;
            this.stats.misses = 0;
            this.stats.evictions = 0;
        }
    }
    /**
     * Get cache statistics.
     *
     * @returns Cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            size: this.cache.size,
            hitRate: total > 0 ? this.stats.hits / total : 0,
            evictions: this.stats.evictions,
        };
    }
    /**
     * Reset statistics.
     */
    resetStats() {
        this.stats.hits = 0;
        this.stats.misses = 0;
        this.stats.evictions = 0;
    }
    /**
     * Get current cache size.
     *
     * @returns Current number of entries
     */
    get size() {
        return this.cache.size;
    }
    /**
     * Evict least recently used entry.
     */
    evictLRU() {
        let lruKey;
        let lruTimestamp = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < lruTimestamp) {
                lruTimestamp = entry.timestamp;
                lruKey = key;
            }
        }
        if (lruKey !== undefined) {
            this.cache.delete(lruKey);
            if (this.config.trackStats) {
                this.stats.evictions++;
            }
        }
    }
    /**
     * Clean up expired entries.
     */
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.config.ttl) {
                this.cache.delete(key);
            }
        }
    }
}
//# sourceMappingURL=LRUCache.js.map