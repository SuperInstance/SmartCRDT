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
export class EmbeddingCache {
  private cache: Map<string, CacheEntry> = new Map();
  private lruList: string[] = [];
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  private maxSize: number;
  private ttl: number;

  constructor(config: EmbeddingCacheConfig = {}) {
    this.maxSize = config.maxSize ?? 1000;
    this.ttl = config.ttl ?? 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get embedding from cache.
   *
   * @param text - Text to get embedding for
   * @returns Embedding if found and not expired, undefined otherwise
   */
  get(text: string): Float32Array | undefined {
    const key = this.generateKey(text);
    const entry = this.cache.get(key);

    // Cache miss
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.ttl) {
      this.cache.delete(key);
      this.lruList = this.lruList.filter(k => k !== key);
      this.misses++;
      return undefined;
    }

    // Cache hit - update LRU
    this.hits++;
    entry.hits++;
    this.updateLRU(key);

    return entry.embedding;
  }

  /**
   * Store embedding in cache.
   *
   * @param text - Text that was embedded
   * @param embedding - Embedding vector
   */
  set(text: string, embedding: Float32Array): void {
    const key = this.generateKey(text);

    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    // Store entry
    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      hits: 0,
    });

    // Update LRU list
    this.updateLRU(key);
  }

  /**
   * Get multiple embeddings from cache.
   *
   * @param texts - Array of texts to get embeddings for
   * @returns Array of embeddings (undefined for cache misses)
   */
  getBatch(texts: string[]): Array<Float32Array | undefined> {
    return texts.map(text => this.get(text));
  }

  /**
   * Store multiple embeddings in cache.
   *
   * @param entries - Array of [text, embedding] pairs
   */
  setBatch(entries: Array<[string, Float32Array]>): void {
    for (const [text, embedding] of entries) {
      this.set(text, embedding);
    }
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      evictions: this.evictions,
    };
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.cache.clear();
    this.lruList = [];
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Remove expired entries from cache.
   *
   * @returns Number of entries removed
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > this.ttl) {
        this.cache.delete(key);
        this.lruList = this.lruList.filter(k => k !== key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache size.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if cache has key.
   */
  has(text: string): boolean {
    const key = this.generateKey(text);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.ttl) {
      this.cache.delete(key);
      this.lruList = this.lruList.filter(k => k !== key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific cache entry.
   */
  delete(text: string): boolean {
    const key = this.generateKey(text);
    this.lruList = this.lruList.filter(k => k !== key);
    return this.cache.delete(key);
  }

  /**
   * Generate cache key from text.
   *
   * Uses a simple hash function to generate a deterministic key.
   */
  private generateKey(text: string): string {
    // Simple hash function (djb2)
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) + hash + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update LRU list (move to end).
   */
  private updateLRU(key: string): void {
    const index = this.lruList.indexOf(key);
    if (index > -1) {
      this.lruList.splice(index, 1);
    }
    this.lruList.push(key);
  }

  /**
   * Evict least recently used entry.
   */
  private evictLRU(): void {
    const lruKey = this.lruList.shift();
    if (lruKey) {
      this.cache.delete(lruKey);
      this.evictions++;
    }
  }
}

/**
 * Default configuration.
 */
export const DEFAULT_EMBEDDING_CACHE_CONFIG: EmbeddingCacheConfig = {
  maxSize: 1000,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
};
