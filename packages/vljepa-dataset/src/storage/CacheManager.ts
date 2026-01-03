/**
 * @fileoverview Cache Manager - In-memory caching layer
 * @description Manages caching of frequently accessed data
 */

import type { CacheConfig, DatasetError } from "../types.js";

/**
 * Cache entry
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
  accessCount: number;
  lastAccess: number;
}

/**
 * Cache Manager class
 */
export class CacheManager<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;
  private currentSize: number = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 1024 * 1024 * 1024, // 1GB
      ttl: config.ttl ?? 3600000, // 1 hour
      strategy: config.strategy ?? "lru",
      persistToDisk: config.persistToDisk ?? false,
      diskPath: config.diskPath,
    };
  }

  /**
   * Get item from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.delete(key);
      return null;
    }

    // Update access info
    entry.accessCount++;
    entry.lastAccess = Date.now();

    return entry.data;
  }

  /**
   * Set item in cache
   */
  set(key: string, data: T, size: number = 1024): boolean {
    // Check if adding would exceed max size
    if (this.currentSize + size > this.config.maxSize) {
      this.evict(size);
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      size,
      accessCount: 0,
      lastAccess: Date.now(),
    };

    this.cache.set(key, entry);
    this.currentSize += size;

    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);

    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }

    return false;
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Evict items based on strategy
   */
  private evict(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries());
    let freedSpace = 0;

    switch (this.config.strategy) {
      case "lru":
        // Sort by last access time
        entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        break;

      case "lfu":
        // Sort by access count
        entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;

      case "fifo":
        // Sort by timestamp (oldest first)
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        break;
    }

    // Evict until we have enough space
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) break;

      this.delete(key);
      freedSpace += entry.size;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    count: number;
    hitRate: number;
  } {
    let totalAccess = 0;
    let hits = 0;

    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
      hits += entry.accessCount;
    }

    return {
      size: this.currentSize,
      count: this.cache.size,
      hitRate: totalAccess > 0 ? hits / totalAccess : 0,
    };
  }

  /**
   * Clean expired entries
   */
  clean(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  /**
   * Create dataset error
   */
  private createError(
    type: DatasetError["type"],
    message: string,
    details?: Record<string, unknown>
  ): DatasetError {
    const error = new Error(message) as DatasetError;
    error.type = type;
    error.timestamp = Date.now();
    error.recoverable = true;
    error.details = details;
    return error;
  }
}
