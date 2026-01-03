/**
 * VL-JEPA Caching Strategy
 *
 * Comprehensive caching strategy for VL-JEPA embeddings
 * Optimizes for: hit rate >80%, memory efficiency, fast invalidation
 *
 * Key Insights:
 * - 768-dim embeddings are tiny (3KB each) - cache aggressively
 * - UI frames change frequently - need smart invalidation
 * - User intent repeats often - high cache hit rate
 * - Goal predictions can be cached for identical scenarios
 */

import type { CachingMetrics } from "./types";

/**
 * Cache Entry Metadata
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  size: number; // bytes
  tags: string[]; // For selective invalidation
}

/**
 * Cache Configuration
 */
export interface CacheConfig {
  maxSize: number; // Maximum number of entries
  maxMemoryMB: number; // Maximum memory in MB
  ttl: number; // Time-to-live in milliseconds
  strategy: "lru" | "lfu" | "fifo" | "smart";
  enableCompression: boolean;
  enablePersistence: boolean;
}

/**
 * Cache Invalidation Strategy
 */
export interface InvalidationStrategy {
  type: "ui-change" | "ttl-expiry" | "manual" | "capacity";
  reason: string;
  affectedEntries: number;
}

/**
 * VL-JEPA Smart Cache
 * Advanced caching with smart invalidation and compression
 */
export class VLJEPASmartCache<T = Float32Array> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private accessOrder: string[] = []; // For LRU
  private accessFrequency: Map<string, number> = new Map(); // For LFU
  private config: CacheConfig;
  private invalidations: InvalidationStrategy[] = [];

  // Statistics
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 10000, // 10K entries
      maxMemoryMB: 100, // 100MB
      ttl: 3600000, // 1 hour
      strategy: "smart", // Adaptive strategy
      enableCompression: false, // Compression not needed for 3KB embeddings
      enablePersistence: false, // Optional persistence
      ...config,
    };
  }

  /**
   * Get cached entry
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    // Cache miss
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.invalidate(key, "ttl-expiry");
      this.misses++;
      return undefined;
    }

    // Cache hit
    this.hits++;
    entry.accessCount++;
    entry.lastAccess = Date.now();

    // Update access tracking
    this.updateAccessTracking(key);

    return entry.data;
  }

  /**
   * Set cached entry
   */
  set(key: string, data: T, tags: string[] = []): void {
    const size = this.calculateSize(data);

    // Check if we need to evict
    this.ensureCapacity(size);

    // Store entry
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccess: Date.now(),
      size,
      tags,
    };

    this.cache.set(key, entry);
    this.updateAccessTracking(key);
  }

  /**
   * Get or compute (cache-aside pattern)
   */
  async getOrCompute(
    key: string,
    compute: () => Promise<T>,
    tags: string[] = []
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Cache miss - compute and store
    const data = await compute();
    this.set(key, data, tags);
    return data;
  }

  /**
   * Invalidate specific entry
   */
  invalidate(
    key: string,
    reason: InvalidationStrategy["type"] = "manual"
  ): void {
    const entry = this.cache.get(key);
    const size = entry?.size || 0;

    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessFrequency.delete(key);

    this.invalidations.push({
      type: reason,
      reason: `Entry ${key} invalidated`,
      affectedEntries: 1,
    });
  }

  /**
   * Invalidate by tag
   */
  invalidateByTag(tag: string): number {
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.invalidate(key, "ui-change");
        count++;
      }
    }

    this.invalidations.push({
      type: "ui-change",
      reason: `Tag ${tag} invalidated`,
      affectedEntries: count,
    });

    return count;
  }

  /**
   * Invalidate all entries
   */
  invalidateAll(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.accessOrder = [];
    this.accessFrequency.clear();

    this.invalidations.push({
      type: "manual",
      reason: "Cache cleared",
      affectedEntries: count,
    });
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        this.invalidate(key, "ttl-expiry");
        count++;
      }
    }

    return count;
  }

  /**
   * Get cache statistics
   */
  getStats(): CachingMetrics {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    const cacheMemoryMB = this.getCurrentMemoryUsage();

    // Count invalidations by type
    const invalidationReason = {
      uiChange: this.invalidations.filter(i => i.type === "ui-change").length,
      ttlExpiry: this.invalidations.filter(i => i.type === "ttl-expiry").length,
      manual: this.invalidations.filter(i => i.type === "manual").length,
    };

    return {
      strategy: this.config.strategy,
      cacheSize: this.cache.size,
      cacheMemoryMB,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      invalidations: this.invalidations.length,
      invalidationReason,
      avgHitLatency: 0.1, // ~0.1ms for in-memory cache
      avgMissLatency: 50, // ~50ms to compute embedding
      latencySaved: this.hits * 49.9, // ~50ms - 0.1ms
    };
  }

  /**
   * Get detailed analytics
   */
  getAnalytics() {
    return {
      ...this.getStats(),

      // Access patterns
      topKeys: this.getTopKeys(10),
      accessPattern: this.analyzeAccessPattern(),

      // Memory breakdown
      memoryBreakdown: this.getMemoryBreakdown(),

      // Invalidation history
      invalidationHistory: this.invalidations.slice(-20),

      // Recommendations
      recommendations: this.generateRecommendations(),
    };
  }

  /**
   * Ensure capacity for new entry
   */
  private ensureCapacity(requiredSize: number): void {
    const currentMemory = this.getCurrentMemoryUsage();
    const maxMemoryBytes = this.config.maxMemoryMB * 1024 * 1024;

    // Evict if necessary
    while (
      this.cache.size >= this.config.maxSize ||
      currentMemory + requiredSize > maxMemoryBytes
    ) {
      this.evictOne();
    }
  }

  /**
   * Evict one entry based on strategy
   */
  private evictOne(): void {
    let keyToEvict: string | undefined;

    switch (this.config.strategy) {
      case "lru":
        keyToEvict = this.accessOrder[0];
        break;

      case "lfu":
        // Find least frequently used
        let minFreq = Infinity;
        for (const [key, freq] of this.accessFrequency.entries()) {
          if (freq < minFreq) {
            minFreq = freq;
            keyToEvict = key;
          }
        }
        break;

      case "fifo":
        keyToEvict = this.accessOrder[0];
        break;

      case "smart":
        // Adaptive: combine recency and frequency
        keyToEvict = this.smartEviction();
        break;
    }

    if (keyToEvict) {
      this.invalidate(keyToEvict, "capacity");
      this.evictions++;
    }
  }

  /**
   * Smart eviction (adaptive strategy)
   */
  private smartEviction(): string | undefined {
    // Score = (frequency / age) - lower score = evict first
    let bestKey: string | undefined;
    let bestScore = Infinity;

    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      const freq = this.accessFrequency.get(key) || 1;
      const score = age / freq;

      if (score < bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    return bestKey;
  }

  /**
   * Update access tracking for LRU/LFU
   */
  private updateAccessTracking(key: string): void {
    // Update LRU order
    const lruIndex = this.accessOrder.indexOf(key);
    if (lruIndex > -1) {
      this.accessOrder.splice(lruIndex, 1);
    }
    this.accessOrder.push(key);

    // Update LFU frequency
    const freq = this.accessFrequency.get(key) || 0;
    this.accessFrequency.set(key, freq + 1);
  }

  /**
   * Calculate size of data
   */
  private calculateSize(data: T): number {
    if (data instanceof Float32Array) {
      return data.length * 4; // 4 bytes per float
    }
    // Rough estimate for other types
    return 1024; // 1KB default
  }

  /**
   * Get current memory usage in MB
   */
  private getCurrentMemoryUsage(): number {
    let totalBytes = 0;
    for (const entry of this.cache.values()) {
      totalBytes += entry.size;
    }
    return totalBytes / (1024 * 1024);
  }

  /**
   * Get top accessed keys
   */
  private getTopKeys(count: number): Array<{ key: string; accesses: number }> {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accesses: entry.accessCount,
    }));

    return entries.sort((a, b) => b.accesses - a.accesses).slice(0, count);
  }

  /**
   * Analyze access patterns
   */
  private analyzeAccessPattern(): string {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    if (hitRate > 0.8) return "excellent";
    if (hitRate > 0.6) return "good";
    if (hitRate > 0.4) return "fair";
    return "poor";
  }

  /**
   * Get memory breakdown
   */
  private getMemoryBreakdown() {
    let totalEntries = 0;
    let totalSize = 0;
    let avgEntrySize = 0;

    for (const entry of this.cache.values()) {
      totalEntries++;
      totalSize += entry.size;
    }

    if (totalEntries > 0) {
      avgEntrySize = totalSize / totalEntries;
    }

    return {
      totalEntries,
      totalSizeMB: totalSize / (1024 * 1024),
      avgEntrySizeBytes: avgEntrySize,
      capacityUtilization:
        (totalSize / (this.config.maxMemoryMB * 1024 * 1024)) * 100,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): string[] {
    const stats = this.getStats();
    const recommendations: string[] = [];

    if (stats.hitRate < 0.6) {
      recommendations.push(
        "Low cache hit rate - consider increasing cache size"
      );
    }

    if (
      stats.invalidationReason.uiChange >
      stats.invalidationReason.ttlExpiry * 2
    ) {
      recommendations.push(
        "High UI change invalidation - consider longer TTL for stable elements"
      );
    }

    if (stats.cacheMemoryMB < this.config.maxMemoryMB * 0.5) {
      recommendations.push(
        "Cache underutilized - can increase size for better hit rate"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Cache is performing optimally");
    }

    return recommendations;
  }
}

/**
 * VL-JEPA Tiered Cache
 * Multi-level cache: L1 (memory) → L2 (compressed) → L3 (persistent)
 */
export class VLJEPTieredCache<T = Float32Array> {
  private l1: VLJEPASmartCache<T>; // Hot cache (fastest)
  private l2: VLJEPASmartCache<T>; // Warm cache (larger)
  private l3?: Map<string, T>; // Cold cache (persistent, optional)

  constructor(
    l1Config?: Partial<CacheConfig>,
    l2Config?: Partial<CacheConfig>
  ) {
    this.l1 = new VLJEPASmartCache({
      maxSize: 1000, // 1K entries
      maxMemoryMB: 10,
      ttl: 1800000, // 30 minutes
      ...l1Config,
    });

    this.l2 = new VLJEPASmartCache({
      maxSize: 10000, // 10K entries
      maxMemoryMB: 100,
      ttl: 7200000, // 2 hours
      ...l2Config,
    });
  }

  /**
   * Get from tiered cache
   */
  get(key: string): T | undefined {
    // Check L1 first
    let value = this.l1.get(key);
    if (value !== undefined) return value;

    // Check L2
    value = this.l2.get(key);
    if (value !== undefined) {
      // Promote to L1
      this.l1.set(key, value);
      return value;
    }

    // Check L3
    if (this.l3) {
      value = this.l3.get(key);
      if (value !== undefined) {
        // Promote to L2 and L1
        this.l2.set(key, value);
        this.l1.set(key, value);
        return value;
      }
    }

    return undefined;
  }

  /**
   * Set in tiered cache
   */
  set(key: string, data: T, tags: string[] = []): void {
    // Store in L1 and L2
    this.l1.set(key, data, tags);
    this.l2.set(key, data, tags);
  }

  /**
   * Get aggregated statistics
   */
  getStats() {
    const l1Stats = this.l1.getStats();
    const l2Stats = this.l2.getStats();

    return {
      tiered: {
        l1: l1Stats,
        l2: l2Stats,
        overall: {
          hitRate: (l1Stats.hitRate + l2Stats.hitRate) / 2,
          totalHits: l1Stats.hits + l2Stats.hits,
          totalMisses: l1Stats.misses + l2Stats.misses,
          totalMemoryMB: l1Stats.cacheMemoryMB + l2Stats.cacheMemoryMB,
        },
      },
    };
  }
}

/**
 * Create default VL-JEPA cache
 */
export function createDefaultCache(): VLJEPASmartCache<Float32Array> {
  return new VLJEPASmartCache<Float32Array>({
    maxSize: 10000,
    maxMemoryMB: 100,
    ttl: 3600000, // 1 hour
    strategy: "smart",
  });
}

/**
 * Create tiered cache for production
 */
export function createTieredCache(): VLJEPTieredCache<Float32Array> {
  return new VLJEPTieredCache<Float32Array>();
}
