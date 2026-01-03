/**
 * EmbeddingCache - LRU cache for embedding vectors with TTL.
 *
 * Features:
 * - LRU (Least Recently Used) eviction
 * - 24-hour TTL (time-to-live)
 * - Cache hit rate tracking
 * - Thread-safe operations
 *
 * Rationale: Embeddings are deterministic for the same text,
 * so we can cache them to avoid redundant API calls.
 */
export interface CacheEntry {
    embedding: Float32Array;
    timestamp: number;
    hits: number;
}
export interface CacheStats {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
}
export interface EmbeddingCacheConfig {
    /** Maximum cache size (number of entries) */
    maxSize?: number;
    /** TTL in milliseconds (default: 24 hours) */
    ttl?: number;
}
/**
 * EmbeddingCache - LRU cache with TTL.
 */
export declare class EmbeddingCache {
    private cache;
    private lruList;
    private hits;
    private misses;
    private evictions;
    private maxSize;
    private ttl;
    constructor(config?: EmbeddingCacheConfig);
    /**
     * Get embedding from cache.
     *
     * @param text - Text to get embedding for
     * @returns Embedding if found and not expired, undefined otherwise
     */
    get(text: string): Float32Array | undefined;
    /**
     * Store embedding in cache.
     *
     * @param text - Text that was embedded
     * @param embedding - Embedding vector
     */
    set(text: string, embedding: Float32Array): void;
    /**
     * Get multiple embeddings from cache.
     *
     * @param texts - Array of texts to get embeddings for
     * @returns Array of embeddings (undefined for cache misses)
     */
    getBatch(texts: string[]): Array<Float32Array | undefined>;
    /**
     * Store multiple embeddings in cache.
     *
     * @param entries - Array of [text, embedding] pairs
     */
    setBatch(entries: Array<[string, Float32Array]>): void;
    /**
     * Get cache statistics.
     *
     * @returns Cache statistics
     */
    getStats(): CacheStats;
    /**
     * Clear all cache entries.
     */
    clear(): void;
    /**
     * Remove expired entries from cache.
     *
     * @returns Number of entries removed
     */
    prune(): number;
    /**
     * Get cache size.
     */
    size(): number;
    /**
     * Check if cache has key.
     */
    has(text: string): boolean;
    /**
     * Delete specific cache entry.
     */
    delete(text: string): boolean;
    /**
     * Generate cache key from text.
     *
     * Uses a simple hash function to generate a deterministic key.
     */
    private generateKey;
    /**
     * Update LRU list (move to end).
     */
    private updateLRU;
    /**
     * Evict least recently used entry.
     */
    private evictLRU;
}
/**
 * Default configuration.
 */
export declare const DEFAULT_EMBEDDING_CACHE_CONFIG: EmbeddingCacheConfig;
//# sourceMappingURL=EmbeddingCache.d.ts.map