/**
 * CacheManager - Cache loaded modules
 * Manage module cache with expiration and eviction
 */

import type { ModuleInfo, CacheEntry } from "../types.js";

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private defaultTTL: number;
  private accessOrder: string[] = [];

  constructor(maxSize: number = 100, defaultTTL: number = 3600000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Set cache entry
   */
  set(moduleId: string, module: any, info: Partial<ModuleInfo> = {}): void {
    const now = Date.now();

    const entry: CacheEntry = {
      module,
      version: info.version || "unknown",
      timestamp: now,
      expiresAt: now + this.defaultTTL,
    };

    this.cache.set(moduleId, entry);
    this.updateAccessOrder(moduleId);

    // Evict if over max size
    this.evictIfNeeded();
  }

  /**
   * Get cache entry
   */
  get(moduleId: string): any | undefined {
    const entry = this.cache.get(moduleId);

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(moduleId);
      return undefined;
    }

    // Update access order
    this.updateAccessOrder(moduleId);

    return entry.module;
  }

  /**
   * Get cache entry with metadata
   */
  getEntry(moduleId: string): CacheEntry | undefined {
    const entry = this.cache.get(moduleId);

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(moduleId);
      return undefined;
    }

    // Update access order
    this.updateAccessOrder(moduleId);

    return entry;
  }

  /**
   * Check if module is cached
   */
  has(moduleId: string): boolean {
    const entry = this.cache.get(moduleId);
    if (!entry) {
      return false;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(moduleId);
      return false;
    }

    return true;
  }

  /**
   * Delete cache entry
   */
  delete(moduleId: string): boolean {
    this.accessOrder = this.accessOrder.filter(id => id !== moduleId);
    return this.cache.delete(moduleId);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Update access order (LRU)
   */
  private updateAccessOrder(moduleId: string): void {
    // Remove from current position
    this.accessOrder = this.accessOrder.filter(id => id !== moduleId);
    // Add to end (most recently used)
    this.accessOrder.push(moduleId);
  }

  /**
   * Evict least recently used entries
   */
  private evictIfNeeded(): void {
    while (this.cache.size > this.maxSize && this.accessOrder.length > 0) {
      const lru = this.accessOrder.shift()!;
      this.cache.delete(lru);
    }
  }

  /**
   * Set entry with custom TTL
   */
  setWithTTL(
    moduleId: string,
    module: any,
    ttl: number,
    info?: Partial<ModuleInfo>
  ): void {
    const now = Date.now();

    const entry: CacheEntry = {
      module,
      version: info?.version || "unknown",
      timestamp: now,
      expiresAt: now + ttl,
    };

    this.cache.set(moduleId, entry);
    this.updateAccessOrder(moduleId);
    this.evictIfNeeded();
  }

  /**
   * Extend TTL for an entry
   */
  extendTTL(moduleId: string, additionalTTL: number): boolean {
    const entry = this.cache.get(moduleId);
    if (!entry) {
      return false;
    }

    entry.expiresAt += additionalTTL;
    return true;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all entries
   */
  entries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get expired entries
   */
  getExpiredEntries(): Array<[string, CacheEntry]> {
    const now = Date.now();
    const expired: Array<[string, CacheEntry]> = [];

    for (const [id, entry] of this.cache) {
      if (now > entry.expiresAt) {
        expired.push([id, entry]);
      }
    }

    return expired;
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const expired = this.getExpiredEntries();
    for (const [id] of expired) {
      this.delete(id);
    }
    return expired.length;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    expiredCount: number;
    hitRate: number;
    avgAge: number;
  } {
    const now = Date.now();
    let expiredCount = 0;
    let totalAge = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      }
      totalAge += now - entry.timestamp;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expiredCount,
      hitRate: 0, // Would need hit/miss tracking
      avgAge: this.cache.size > 0 ? totalAge / this.cache.size : 0,
    };
  }

  /**
   * Export cache
   */
  export(): Array<[string, CacheEntry]> {
    return Array.from(this.cache.entries());
  }

  /**
   * Import cache
   */
  import(entries: Array<[string, CacheEntry]>): void {
    for (const [id, entry] of entries) {
      this.cache.set(id, entry);
      this.updateAccessOrder(id);
    }
    this.evictIfNeeded();
  }

  /**
   * Get memory usage (approximate)
   */
  getMemoryUsage(): number {
    let total = 0;

    for (const [id, entry] of this.cache) {
      total += id.length * 2; // String memory
      total += JSON.stringify(entry).length * 2;
    }

    return total;
  }

  /**
   * Set max size
   */
  setMaxSize(size: number): void {
    this.maxSize = size;
    this.evictIfNeeded();
  }

  /**
   * Set default TTL
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  /**
   * Warm cache with preload data
   */
  warm(data: Array<[string, any, Partial<ModuleInfo>]>): void {
    for (const [id, module, info] of data) {
      this.set(id, module, info);
    }
  }
}
