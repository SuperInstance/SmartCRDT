/**
 * Result Cache
 * Caches inference results to avoid redundant computation
 */

import type { ResultCacheConfig, CacheEntry, CacheStats } from "../types.js";

export class ResultCache {
  private cache: Map<string, CacheEntry> = new Map();
  private index: VectorIndex | null = null;
  private stats: CacheStats;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private config: ResultCacheConfig) {
    this.stats = {
      size: 0,
      maxSize: config.maxSize,
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
      memoryUsage: 0,
    };

    // Initialize vector index for semantic similarity if enabled
    if (config.similarityThreshold > 0) {
      this.index = new VectorIndex(config.similarityThreshold);
    }

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get a cached result by key
   */
  get(key: string): Float32Array | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.invalidate(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update hit count and access time
    entry.hits++;
    entry.timestamp = Date.now();
    this.stats.hits++;
    this.updateHitRate();

    return entry.embedding;
  }

  /**
   * Set a cached result
   */
  set(key: string, embedding: Float32Array): void {
    // Check if we need to evict
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    const entry: CacheEntry = {
      key,
      embedding,
      timestamp: Date.now(),
      hits: 0,
      size: embedding.length * 4, // 4 bytes per float
      ttl: this.config.ttl,
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
    this.stats.memoryUsage = this.calculateMemoryUsage();

    // Add to vector index if enabled
    if (this.index) {
      this.index.add(key, embedding);
    }
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return !this.isExpired(entry);
  }

  /**
   * Invalidate a cache entry
   */
  invalidate(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.memoryUsage = this.calculateMemoryUsage();

      if (this.index) {
        this.index.remove(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    if (this.index) {
      this.index.clear();
    }
    this.stats.size = 0;
    this.stats.memoryUsage = 0;
    this.updateHitRate();
  }

  /**
   * Find semantically similar embeddings
   */
  findSimilar(embedding: Float32Array): CacheEntry[] {
    if (!this.index) return [];

    const similarKeys = this.index.search(embedding, 5);
    const entries: CacheEntry[] = [];

    for (const key of similarKeys) {
      const entry = this.cache.get(key);
      if (entry && !this.isExpired(entry)) {
        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private isExpired(entry: CacheEntry): boolean {
    if (entry.ttl === 0) return false; // No expiration
    const age = Date.now() - entry.timestamp;
    return age > entry.ttl;
  }

  private evict(): void {
    // LRU eviction
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.invalidate(oldestKey);
      this.stats.evictions++;
    }
  }

  private evictMultiple(count: number): void {
    for (let i = 0; i < count; i++) {
      this.evict();
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private calculateMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total / 1024 / 1024; // Convert to MB
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl > 0 && now - entry.timestamp > entry.ttl) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.invalidate(key);
      this.stats.evictions++;
    }
  }
}

// ============================================================================
// VECTOR INDEX FOR SEMANTIC SIMILARITY
// ============================================================================

class VectorIndex {
  private vectors: Map<string, Float32Array> = new Map();
  private dimension: number = 0;

  constructor(private similarityThreshold: number) {}

  add(key: string, vector: Float32Array): void {
    this.vectors.set(key, vector);
    if (this.dimension === 0) {
      this.dimension = vector.length;
    }
  }

  remove(key: string): void {
    this.vectors.delete(key);
  }

  search(query: Float32Array, k: number = 5): string[] {
    const results: Array<{ key: string; similarity: number }> = [];

    for (const [key, vector] of this.vectors.entries()) {
      const similarity = this.cosineSimilarity(query, vector);
      if (similarity >= this.similarityThreshold) {
        results.push({ key, similarity });
      }
    }

    // Sort by similarity (descending)
    results.sort((a, b) => b.similarity - a.similarity);

    // Return top k
    return results.slice(0, k).map(r => r.key);
  }

  clear(): void {
    this.vectors.clear();
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
  }
}

// ============================================================================
// EMBEDDING CACHE
// ============================================================================

export class EmbeddingCache {
  private caches: Map<string, ResultCache> = new Map();

  constructor(private defaultConfig: Partial<ResultCacheConfig> = {}) {}

  /**
   * Get or create a cache for a specific model layer
   */
  getCache(layer: string): ResultCache {
    if (!this.caches.has(layer)) {
      this.caches.set(
        layer,
        new ResultCache({
          maxSize: 1000,
          similarityThreshold: 0.95,
          ttl: 300000, // 5 minutes
          persistent: false,
          compression: true,
          ...this.defaultConfig,
        })
      );
    }
    return this.caches.get(layer)!;
  }

  /**
   * Cache an embedding for a specific layer
   */
  set(layer: string, key: string, embedding: Float32Array): void {
    const cache = this.getCache(layer);
    cache.set(key, embedding);
  }

  /**
   * Get a cached embedding for a specific layer
   */
  get(layer: string, key: string): Float32Array | null {
    const cache = this.getCache(layer);
    return cache.get(key);
  }

  /**
   * Clear all caches
   */
  clear(): void {
    for (const cache of this.caches.values()) {
      cache.dispose();
    }
    this.caches.clear();
  }

  /**
   * Get aggregate statistics
   */
  getStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};

    for (const [layer, cache] of this.caches.entries()) {
      stats[layer] = cache.stats();
    }

    return stats;
  }
}

// ============================================================================
// KERNEL CACHE
// ============================================================================

export interface CompiledKernel {
  module: GPUShaderModule;
  pipeline: GPUComputePipeline;
  workgroupSize: [number, number, number];
  bindGroupLayout: GPUBindGroupLayout;
}

export class KernelCache {
  private cache: Map<string, CompiledKernel> = new Map();
  private hits = 0;
  private misses = 0;

  /**
   * Get a compiled kernel from cache
   */
  get(key: string): CompiledKernel | null {
    const kernel = this.cache.get(key);
    if (kernel) {
      this.hits++;
      return kernel;
    }
    this.misses++;
    return null;
  }

  /**
   * Set a compiled kernel in cache
   */
  set(key: string, kernel: CompiledKernel): void {
    this.cache.set(key, kernel);
  }

  /**
   * Check if kernel is cached
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    // Destroy all GPU resources
    for (const kernel of this.cache.values()) {
      kernel.module.destroy();
      kernel.pipeline.destroy();
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / Math.max(1, this.hits + this.misses),
    };
  }

  /**
   * Generate cache key from kernel source and parameters
   */
  generateKey(source: string, params: Record<string, unknown>): string {
    const paramStr = JSON.stringify(params, Object.keys(params).sort());
    return `${this.hash(source)}_${this.hash(paramStr)}`;
  }

  private hash(str: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

// ============================================================================
// HIERARCHICAL CACHE
// ============================================================================

export class HierarchicalCache {
  private l1: ResultCache; // Fast, small cache (in-memory)
  private l2: ResultCache | null; // Slower, larger cache (could be persistent)
  private l1Hits = 0;
  private l2Hits = 0;
  private misses = 0;

  constructor(config: {
    l1Config: ResultCacheConfig;
    l2Config?: ResultCacheConfig;
  }) {
    this.l1 = new ResultCache(config.l1Config);
    this.l2 = config.l2Config ? new ResultCache(config.l2Config) : null;
  }

  /**
   * Get from cache (checks L1, then L2)
   */
  get(key: string): Float32Array | null {
    // Check L1 first
    const l1Result = this.l1.get(key);
    if (l1Result) {
      this.l1Hits++;
      return l1Result;
    }

    // Check L2
    if (this.l2) {
      const l2Result = this.l2.get(key);
      if (l2Result) {
        this.l2Hits++;
        // Promote to L1
        this.l1.set(key, l2Result);
        return l2Result;
      }
    }

    this.misses++;
    return null;
  }

  /**
   * Set in cache (stores in both L1 and L2)
   */
  set(key: string, embedding: Float32Array): void {
    this.l1.set(key, embedding);
    if (this.l2) {
      this.l2.set(key, embedding);
    }
  }

  /**
   * Invalidate from all levels
   */
  invalidate(key: string): void {
    this.l1.invalidate(key);
    if (this.l2) {
      this.l2.invalidate(key);
    }
  }

  /**
   * Clear all levels
   */
  clear(): void {
    this.l1.clear();
    if (this.l2) {
      this.l2.clear();
    }
    this.l1Hits = 0;
    this.l2Hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalAccess = this.l1Hits + this.l2Hits + this.misses;
    return {
      l1: this.l1.stats(),
      l2: this.l2?.stats() || null,
      l1Hits: this.l1Hits,
      l2Hits: this.l2Hits,
      misses: this.misses,
      overallHitRate: (this.l1Hits + this.l2Hits) / Math.max(1, totalAccess),
    };
  }
}
