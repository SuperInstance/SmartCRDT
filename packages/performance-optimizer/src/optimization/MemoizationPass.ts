/**
 * Memoization Pass - Automatic function result caching
 *
 * Features:
 * - Function result caching with automatic invalidation
 * - Memoization decorators for classes and functions
 * - Cache size limits and LRU eviction
 * - TTL-based expiration
 * - Cache statistics and monitoring
 */

import { performance } from 'perf_hooks';

/**
 * Cache entry
 */
interface CacheEntry<K, V> {
  key: K;
  value: V;
  timestamp: number;
  hits: number;
  ttl?: number;
}

/**
 * Memoization options
 */
export interface MemoizationOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  keyGenerator?: (...args: any[]) => string;
  onEvict?: (key: string, value: any) => void;
  enableStatistics?: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
  averageAccessTime: number;
}

/**
 * Memoization cache
 */
export class MemoizationCache<K = any, V = any> {
  private cache: Map<string, CacheEntry<K, V>> = new Map();
  private accessOrder: string[] = [];
  private maxSize: number;
  private defaultTTL?: number;
  private onEvict?: (key: string, value: V) => void;
  private statistics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalAccessTime: 0,
  };

  constructor(options: MemoizationOptions = {}) {
    this.maxSize = options.maxSize ?? 1000;
    this.defaultTTL = options.ttl;
    this.onEvict = options.onEvict;
  }

  /**
   * Get value from cache
   */
  get(key: string): V | undefined {
    const start = performance.now();
    const entry = this.cache.get(key);

    if (entry) {
      // Check TTL
      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        this.statistics.misses++;
        this.statistics.totalAccessTime += performance.now() - start;
        return undefined;
      }

      // Update access order
      this.updateAccessOrder(key);
      entry.hits++;
      this.statistics.hits++;
      this.statistics.totalAccessTime += performance.now() - start;
      return entry.value;
    }

    this.statistics.misses++;
    this.statistics.totalAccessTime += performance.now() - start;
    return undefined;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: V, ttl?: number): void {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
      ttl: ttl ?? this.defaultTTL,
    });

    this.updateAccessOrder(key);
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.statistics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalAccessTime: 0,
    };
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      const entry = this.cache.get(lruKey);
      if (entry && this.onEvict) {
        this.onEvict(lruKey, entry.value);
      }
      this.cache.delete(lruKey);
      this.statistics.evictions++;
    }
  }

  /**
   * Update access order
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index !== -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get statistics
   */
  getStatistics(): CacheStatistics {
    const totalAccesses = this.statistics.hits + this.statistics.misses;
    return {
      hits: this.statistics.hits,
      misses: this.statistics.misses,
      evictions: this.statistics.evictions,
      size: this.cache.size,
      hitRate: totalAccesses > 0 ? this.statistics.hits / totalAccesses : 0,
      averageAccessTime:
        totalAccesses > 0 ? this.statistics.totalAccessTime / totalAccesses : 0,
    };
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values
   */
  values(): V[] {
    return Array.from(this.cache.values()).map((entry) => entry.value);
  }
}

/**
 * Default key generator
 */
function defaultKeyGenerator(...args: any[]): string {
  return args
    .map((arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return '[object Object]';
        }
      }
      return String(arg);
    })
    .join('|');
}

/**
 * Create memoized function
 */
export function memoize<Fn extends (...args: any[]) => any>(
  fn: Fn,
  options: MemoizationOptions = {}
): Fn & { cache: MemoizationCache; original: Fn } {
  const cache = new MemoizationCache(options);
  const keyGen = options.keyGenerator ?? defaultKeyGenerator;

  const memoized = (...args: any[]) => {
    const key = keyGen(...args);

    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };

  (memoized as any).cache = cache;
  (memoized as any).original = fn;

  return memoized as Fn & { cache: MemoizationCache; original: Fn };
}

/**
 * Memoization decorator for class methods
 */
export function Memoize(options: MemoizationOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = new MemoizationCache(options);
    const keyGen = options.keyGenerator ?? defaultKeyGenerator;

    descriptor.value = function (...args: any[]) {
      const key = keyGen(...args);

      const cached = cache.get(key);
      if (cached !== undefined) {
        return cached;
      }

      const result = originalMethod.apply(this, args);
      cache.set(key, result);
      return result;
    };

    // Attach cache to method for inspection
    (descriptor.value as any).cache = cache;

    return descriptor;
  };
}

/**
 * Async memoization
 */
export function memoizeAsync<Fn extends (...args: any[]) => Promise<any>>(
  fn: Fn,
  options: MemoizationOptions = {}
): Fn & { cache: MemoizationCache; original: Fn } {
  const cache = new MemoizationCache(options);
  const keyGen = options.keyGenerator ?? defaultKeyGenerator;

  const memoized = async (...args: any[]) => {
    const key = keyGen(...args);

    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const result = await fn(...args);
    cache.set(key, result);
    return result;
  };

  (memoized as any).cache = cache;
  (memoized as any).original = fn;

  return memoized as Fn & { cache: MemoizationCache; original: Fn };
}

/**
 * Memoization decorator for async methods
 */
export function MemoizeAsync(options: MemoizationOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cache = new MemoizationCache(options);
    const keyGen = options.keyGenerator ?? defaultKeyGenerator;

    descriptor.value = async function (...args: any[]) {
      const key = keyGen(...args);

      const cached = cache.get(key);
      if (cached !== undefined) {
        return cached;
      }

      const result = await originalMethod.apply(this, args);
      cache.set(key, result);
      return result;
    };

    (descriptor.value as any).cache = cache;

    return descriptor;
  };
}

/**
 * Cache with size-based eviction
 */
export class SizeLimitedCache<K = any, V = any> extends MemoizationCache<K, V> {
  private sizeCalculator: (value: V) => number;
  private maxSizeBytes: number;
  private currentSizeBytes: number;

  constructor(
    maxSizeBytes: number,
    sizeCalculator: (value: V) => number,
    options: MemoizationOptions = {}
  ) {
    super(options);
    this.maxSizeBytes = maxSizeBytes;
    this.sizeCalculator = sizeCalculator;
    this.currentSizeBytes = 0;
  }

  set(key: string, value: V, ttl?: number): void {
    const size = this.sizeCalculator(value);

    // Evict entries until there's room
    while (this.currentSizeBytes + size > this.maxSizeBytes && this.size() > 0) {
      this.evictLRU();
    }

    if (this.currentSizeBytes + size <= this.maxSizeBytes) {
      super.set(key, value, ttl);
      this.currentSizeBytes += size;
    }
  }

  private evictLRU(): void {
    const stats = this.getStatistics();
    if (stats.size === 0) return;

    // Get the first key from access order (LRU)
    const keys = (this as any).accessOrder;
    if (keys.length > 0) {
      const lruKey = keys[0];
      const entry = (this as any).cache.get(lruKey);
      if (entry) {
        this.currentSizeBytes -= this.sizeCalculator(entry.value);
      }
    }

    super.delete((this as any).accessOrder.shift());
  }

  clear(): void {
    super.clear();
    this.currentSizeBytes = 0;
  }
}

/**
 * TTL-based cache
 */
export class TTLCache<K = any, V = any> extends MemoizationCache<K, V> {
  constructor(defaultTTL: number, options: MemoizationOptions = {}) {
    super({ ...options, ttl: defaultTTL });
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of (this as any).cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        (this as any).cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get all expired keys
   */
  getExpiredKeys(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, entry] of (this as any).cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        expired.push(key);
      }
    }

    return expired;
  }
}

/**
 * Memoization pass optimizer
 */
export class MemoizationPass {
  private static caches: Map<string, MemoizationCache> = new Map();

  /**
   * Create or get a named cache
   */
  static getCache(name: string, options: MemoizationOptions = {}): MemoizationCache {
    if (!this.caches.has(name)) {
      this.caches.set(name, new MemoizationCache(options));
    }
    return this.caches.get(name)!;
  }

  /**
   * Clear all caches
   */
  static clearAll(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Get all cache statistics
   */
  static getAllStatistics(): Map<string, CacheStatistics> {
    const stats = new Map<string, CacheStatistics>();
    for (const [name, cache] of this.caches.entries()) {
      stats.set(name, cache.getStatistics());
    }
    return stats;
  }

  /**
   * Generate statistics report
   */
  static generateStatisticsReport(): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('MEMOIZATION CACHE STATISTICS');
    lines.push('='.repeat(80));
    lines.push('');

    let totalHits = 0;
    let totalMisses = 0;
    let totalEvictions = 0;

    for (const [name, cache] of this.caches.entries()) {
      const stats = cache.getStatistics();
      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalEvictions += stats.evictions;

      lines.push(`Cache: ${name}`);
      lines.push(`  Size: ${stats.size} entries`);
      lines.push(`  Hits: ${stats.hits}`);
      lines.push(`  Misses: ${stats.misses}`);
      lines.push(`  Evictions: ${stats.evictions}`);
      lines.push(`  Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
      lines.push(`  Avg Access Time: ${stats.averageAccessTime.toFixed(6)}ms`);
      lines.push('');
    }

    lines.push('-'.repeat(80));
    lines.push(`TOTALS:`);
    lines.push(`  Total Hits: ${totalHits}`);
    lines.push(`  Total Misses: ${totalMisses}`);
    lines.push(`  Total Evictions: ${totalEvictions}`);
    const overallHitRate = totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0;
    lines.push(`  Overall Hit Rate: ${(overallHitRate * 100).toFixed(2)}%`);
    lines.push('');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}
