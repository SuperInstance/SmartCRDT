/**
 * @lsi/webgpu-memory - Smart Eviction
 *
 * LRU, LFU, priority-based, and predictive eviction strategies
 * for managing memory pressure.
 */

import { EvictionStrategy } from './types.js';
import type {
  GPUBuffer,
  CacheEntry,
  EvictionResult,
} from './types.js';

/**
 * Smart eviction manager for cached GPU buffers
 */
export class SmartEviction {
  private cache: Map<string, CacheEntry> = new Map();
  private maxMemory: number;
  private currentMemory: number = 0;
  private accessCounter: number = 0;

  constructor(
    maxMemory: number,
    private strategy: EvictionStrategy = 'lru'
  ) {
    this.maxMemory = maxMemory;
  }

  /**
   * Register cached buffer
   */
  register(
    key: string,
    buffer: GPUBuffer,
    size: number,
    priority: number = 0.5,
    reloadCost: number = 0.5
  ): void {
    const existingEntry = this.cache.get(key);

    // Update current memory
    if (existingEntry) {
      this.currentMemory -= existingEntry.size;
    }

    const entry: CacheEntry = {
      key,
      buffer,
      size,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      accessCount: 0,
      priority,
      reloadCost,
    };

    this.cache.set(key, entry);
    this.currentMemory += size;

    // Check if need to evict
    this.ensureCapacity();
  }

  /**
   * Touch cache entry (update access)
   */
  touch(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      entry.accessCount++;
      this.accessCounter++;
      return true;
    }
    return false;
  }

  /**
   * Get cache entry
   */
  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      this.touch(key);
    }
    return entry;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Unregister entry
   */
  unregister(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.currentMemory -= entry.size;
      entry.buffer.destroy();
      return true;
    }
    return false;
  }

  /**
   * Evict entries to free memory
   */
  evict(targetBytes: number): EvictionResult {
    const evicted: CacheEntry[] = [];
    let freedBytes = 0;

    // Sort entries by strategy
    const entries = this.getSortedEntries();

    for (const entry of entries) {
      if (freedBytes >= targetBytes) break;

      this.cache.delete(entry.key);
      this.currentMemory -= entry.size;
      freedBytes += entry.size;
      evicted.push(entry);

      // Destroy buffer
      entry.buffer.destroy();
    }

    return {
      evictedCount: evicted.length,
      freedBytes,
      evictedEntries: evicted,
      remainingCount: this.cache.size,
    };
  }

  /**
   * Get entries sorted by eviction strategy
   */
  private getSortedEntries(): CacheEntry[] {
    const entries = Array.from(this.cache.values());

    switch (this.strategy) {
        // Least recently used first
        return entries.sort((a, b) => a.lastAccess - b.lastAccess);

        // Least frequently used first
        return entries.sort((a, b) => a.accessCount - b.accessCount);

        // Oldest first
        return entries.sort((a, b) => a.createdAt - b.createdAt);

        // Lowest priority first
        return entries.sort((a, b) => a.priority - b.priority);

        // Largest first
        return entries.sort((a, b) => b.size - a.size);

        // Random order
        return entries.sort(() => Math.random() - 0.5);

      default:
        return entries;
    }
  }

  /**
   * Ensure cache doesn't exceed capacity
   */
  private ensureCapacity(): void {
    if (this.currentMemory > this.maxMemory) {
      const overflow = this.currentMemory - this.maxMemory;
      this.evict(overflow);
    }
  }

  /**
   * Get current memory usage
   */
  getCurrentMemory(): number {
    return this.currentMemory;
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache entries
   */
  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get utilization ratio
   */
  getUtilization(): number {
    return this.maxMemory > 0 ? this.currentMemory / this.maxMemory : 0;
  }

  /**
   * Set eviction strategy
   */
    this.strategy = strategy;
  }

  /**
   * Set max memory
   */
  setMaxMemory(maxMemory: number): void {
    this.maxMemory = maxMemory;
    this.ensureCapacity();
  }

  /**
   * Clear all entries
   */
  clear(): void {
    for (const entry of this.cache.values()) {
      entry.buffer.destroy();
    }
    this.cache.clear();
    this.currentMemory = 0;
  }

  /**
   * Predictive preloading based on access patterns
   */
  predictNextAccesses(): string[] {
    const now = Date.now();
    const window = 60000; // 1 minute window

    // Find frequently accessed items
    const frequentEntries = Array.from(this.cache.values())
      .filter((e) => now - e.lastAccess < window)
      .sort((a, b) => b.accessCount - a.accessCount);

    // Return top candidates
    return frequentEntries.slice(0, 10).map((e) => e.key);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());

    return {
      entryCount: entries.length,
      totalBytes: this.currentMemory,
      maxBytes: this.maxMemory,
      utilization: this.getUtilization(),
      avgPriority:
        entries.length > 0
          ? entries.reduce((sum, e) => sum + e.priority, 0) / entries.length
          : 0,
      totalAccesses: entries.reduce((sum, e) => sum + e.accessCount, 0),
      hitRate: 0, // Would need separate tracking
    };
  }
}

/**
 * Multi-tier cache with different eviction strategies per tier
 */
export class MultiTierCache {
  private hotCache: SmartEviction; // Fastest, smallest
  private warmCache: SmartEviction; // Medium
  private coldCache: SmartEviction; // Largest, slowest

  constructor(hotSize: number, warmSize: number, coldSize: number) {
    this.hotCache = new SmartEviction(hotSize, EvictionStrategy.LRU);
    this.warmCache = new SmartEviction(warmSize, EvictionStrategy.LFU);
    this.coldCache = new SmartEviction(coldSize, EvictionStrategy.Priority);
  }

  /**
   * Get item from cache
   */
  get(key: string): GPUBuffer | undefined {
    // Check hot cache first
    const hotEntry = this.hotCache.get(key);
    if (hotEntry) return hotEntry.buffer;

    // Check warm cache
    const warmEntry = this.warmCache.get(key);
    if (warmEntry) {
      // Promote to hot cache
      this.promote(key, this.warmCache, this.hotCache);
      return warmEntry.buffer;
    }

    // Check cold cache
    const coldEntry = this.coldCache.get(key);
    if (coldEntry) {
      // Promote to warm cache
      this.promote(key, this.coldCache, this.warmCache);
      return coldEntry.buffer;
    }

    return undefined;
  }

  /**
   * Put item in cache
   */
  put(
    key: string,
    buffer: GPUBuffer,
    size: number,
    priority: number = 0.5
  ): void {
    // Always start in hot cache
    this.hotCache.register(key, buffer, size, priority);
  }

  /**
   * Promote entry from one cache to another
   */
  private promote(
    key: string,
    fromCache: SmartEviction,
    toCache: SmartEviction
  ): void {
    const entry = fromCache.get(key);
    if (entry) {
      fromCache.unregister(key);
      toCache.register(
        key,
        entry.buffer,
        entry.size,
        entry.priority,
        entry.reloadCost
      );
    }
  }

  /**
   * Get combined statistics
   */
  getStats() {
    return {
      hot: this.hotCache.getStats(),
      warm: this.warmCache.getStats(),
      cold: this.coldCache.getStats(),
      total: {
        entryCount:
          this.hotCache.getCacheSize() +
          this.warmCache.getCacheSize() +
          this.coldCache.getCacheSize(),
        totalBytes:
          this.hotCache.getCurrentMemory() +
          this.warmCache.getCurrentMemory() +
          this.coldCache.getCurrentMemory(),
      },
    };
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.hotCache.clear();
    this.warmCache.clear();
    this.coldCache.clear();
  }
}

/**
 * Predictive eviction based on access patterns
 */
export class PredictiveEviction {
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private windowSize: number = 10; // Number of accesses to track

  /**
   * Record access to item
   */
  recordAccess(key: string): void {
    let pattern = this.accessPatterns.get(key);

    if (!pattern) {
      pattern = {
        key,
        accesses: [],
        frequency: 0,
        recency: 0,
        predictability: 0,
      };
      this.accessPatterns.set(key, pattern);
    }

    const now = Date.now();
    pattern.accesses.push(now);

    // Keep only recent accesses
    if (pattern.accesses.length > this.windowSize) {
      pattern.accesses.shift();
    }

    // Update metrics
    pattern.frequency = pattern.accesses.length;
    pattern.recency = now - pattern.accesses[0];

    // Calculate predictability (variance in inter-access times)
    if (pattern.accesses.length > 2) {
      const intervals: number[] = [];
      for (let i = 1; i < pattern.accesses.length; i++) {
        intervals.push(pattern.accesses[i] - pattern.accesses[i - 1]);
      }

      const mean =
        intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance =
        intervals.reduce((sum, i) => sum + Math.pow(i - mean, 2), 0) /
        intervals.length;

      // Lower variance = higher predictability
      pattern.predictability = Math.max(0, 1 - variance / mean);
    }
  }

  /**
   * Get predicted next access time for key
   */
  predictNextAccess(key: string): number | null {
    const pattern = this.accessPatterns.get(key);
    if (!pattern || pattern.accesses.length < 2) {
      return null;
    }

    // Simple prediction: average interval
    const intervals: number[] = [];
    for (let i = 1; i < pattern.accesses.length; i++) {
      intervals.push(pattern.accesses[i] - pattern.accesses[i - 1]);
    }

    const avgInterval =
      intervals.reduce((a, b) => a + b, 0) / intervals.length;

    return pattern.accesses[pattern.accesses.length - 1] + avgInterval;
  }

  /**
   * Get keys unlikely to be accessed soon (for eviction)
   */
  getEvictionCandidates(count: number = 10): string[] {
    const now = Date.now();
    const candidates: Array<{ key: string; score: number }> = [];

    for (const [key, pattern] of this.accessPatterns.entries()) {
      const nextAccess = this.predictNextAccess(key);

      if (nextAccess) {
        // Score based on how far in future next access is
        // and how predictable the pattern is
        const score = (nextAccess - now) * pattern.predictability;
        candidates.push({ key, score });
      }
    }

    // Sort by score (higher = later next access = better eviction candidate)
    candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, count).map((c) => c.key);
  }

  /**
   * Clear access patterns
   */
  clear(): void {
    this.accessPatterns.clear();
  }
}

/**
 * Access pattern for predictive eviction
 */
interface AccessPattern {
  key: string;
  accesses: number[];
  frequency: number;
  recency: number;
  predictability: number;
}
