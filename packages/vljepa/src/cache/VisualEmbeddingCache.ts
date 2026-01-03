/**
 * VisualEmbeddingCache - Multi-level cache for VL-JEPA visual embeddings
 *
 * Aggressive caching strategy to achieve <100ms total inference:
 * - L1: In-Memory (Recent UI frames)     ~10ms access
 * - L2: IndexedDB (Persistent browser)   ~50ms access
 * - L3: Redis (Shared across sessions)   ~100ms access
 * - L4: Cloud (S3 + CloudFront)          ~200ms access
 *
 * Target hit rates:
 * - L1: 60% (Most recent UI frames)
 * - L2: 20% (User's persistent frames)
 * - L3: 5% (Popular frames across users)
 * - L4: 0% (Fallback only)
 * - Overall: 85%+
 *
 * Key Features:
 * - Automatic cache promotion/demotion
 * - Semantic similarity matching
 * - Perceptual hash-based keys
 * - TTL-based expiration
 * - Size-based eviction
 * - Performance monitoring
 *
 * @version 1.0.0
 */

import type { Float32Array } from "../types.js";
import {
  SemanticKeyGenerator,
  type SemanticKey,
} from "./SemanticKeyGenerator.js";
import {
  CacheInvalidation,
  type InvalidationEvent,
} from "./CacheInvalidation.js";
import { CacheWarming, type WarmupJob } from "./CacheWarming.js";
import {
  CacheMetrics,
  type CacheMetrics as MetricsType,
} from "./CacheMetrics.js";

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/**
 * Visual cache configuration for all cache levels
 */
export interface VisualCacheConfig {
  /** Protocol version */
  version: "1.0";

  /** L1: In-memory cache configuration */
  l1: {
    /** Maximum size in MB */
    maxSize: number;
    /** Maximum number of embeddings */
    maxEntries: number;
    /** TTL in seconds */
    ttl: number;
  };

  /** L2: IndexedDB cache configuration */
  l2: {
    /** Database name */
    dbName: string;
    /** Maximum number of entries */
    maxEntries: number;
    /** TTL in seconds */
    ttl: number;
  };

  /** L3: Redis cache configuration */
  l3: {
    /** Redis URL */
    redisUrl: string;
    /** Key prefix for VL-JEPA entries */
    keyPrefix: string;
    /** TTL in seconds */
    ttl: number;
  };

  /** L4: Cloud cache configuration */
  l4: {
    /** Whether cloud cache is enabled */
    enabled: boolean;
    /** S3 bucket name */
    bucket: string;
    /** CloudFront CDN distribution */
    cdn: string;
  };

  /** Global configuration */
  global?: {
    /** Similarity threshold for semantic matching (0-1) */
    similarityThreshold?: number;
    /** Enable automatic cache warming */
    enableWarming?: boolean;
    /** Enable detailed metrics */
    enableMetrics?: boolean;
    /** Log level */
    logLevel?: "debug" | "info" | "warn" | "error";
  };
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry {
  /** Semantic hash key for this entry */
  key: string;
  /** 768-dim cached embedding result */
  embedding: Float32Array;
  /** Perceptual hash for similarity matching */
  visualHash: string;
  /** Creation timestamp (Unix timestamp) */
  timestamp: number;
  /** TTL in seconds */
  ttl: number;
  /** Cache level that stored this entry */
  level: "l1" | "l2" | "l3" | "l4";
  /** Entry metadata */
  metadata: CacheMetadata;
}

/**
 * Cache metadata for tracking
 */
export interface CacheMetadata {
  /** Frame dimensions */
  frameSize: { width: number; height: number };
  /** UI context (e.g., "login_form", "dashboard") */
  uiContext: string;
  /** Confidence score of embedding */
  confidence: number;
  /** Processing time in milliseconds to generate */
  processingTime: number;
  /** Number of times this entry was accessed */
  accessCount: number;
  /** Last access timestamp */
  lastAccessed: number;
}

/**
 * Cache lookup result
 */
export interface CacheLookupResult {
  /** Whether cache hit was found */
  found: boolean;
  /** Which cache level was hit (null if miss) */
  level: "l1" | "l2" | "l3" | "l4" | null;
  /** Cached embedding (if found) */
  embedding?: Float32Array;
  /** Similarity score (0-1) if semantic match */
  similarity?: number;
  /** Cache entry (if found) */
  entry?: CacheEntry;
  /** Lookup time in milliseconds */
  lookupTime: number;
}

// ============================================================================
// L1: IN-MEMORY CACHE
// ============================================================================

/**
 * L1 In-Memory Cache Entry
 */
interface L1CacheEntry extends CacheEntry {
  /** Last access time for LRU */
  lastAccessed: number;
}

/**
 * L1 In-Memory Cache
 *
 * Fastest cache level for recent UI frames.
 * Target: ~10ms access, 60% hit rate
 */
class L1Cache {
  private cache: Map<string, L1CacheEntry> = new Map();
  private lruList: string[] = [];
  private currentSize: number = 0; // in bytes

  constructor(private config: VisualCacheConfig["l1"]) {}

  /**
   * Get entry from L1 cache
   */
  get(key: string): L1CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    const age = (Date.now() - entry.timestamp) / 1000;
    if (age > entry.ttl) {
      this.delete(key);
      return null;
    }

    // Update LRU
    this.updateLRU(key);
    entry.metadata.lastAccessed = Date.now();
    entry.metadata.accessCount++;

    return entry;
  }

  /**
   * Set entry in L1 cache
   */
  set(key: string, entry: Omit<CacheEntry, "level">): boolean {
    const size = this.calculateSize(entry.embedding);

    // Check if we need to evict
    while (
      this.cache.size >= this.config.maxEntries ||
      this.currentSize + size > this.config.maxSize * 1024 * 1024
    ) {
      if (this.lruList.length === 0) return false;
      this.evictLRU();
    }

    const l1Entry: L1CacheEntry = {
      ...entry,
      level: "l1",
      lastAccessed: Date.now(),
    };

    this.cache.set(key, l1Entry);
    this.lruList.push(key);
    this.currentSize += size;

    return true;
  }

  /**
   * Delete entry from L1 cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= this.calculateSize(entry.embedding);
    }
    this.lruList = this.lruList.filter(k => k !== key);
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.lruList = [];
    this.currentSize = 0;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get current memory usage in MB
   */
  memoryUsage(): number {
    return this.currentSize / (1024 * 1024);
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  private updateLRU(key: string): void {
    const index = this.lruList.indexOf(key);
    if (index > -1) {
      this.lruList.splice(index, 1);
    }
    this.lruList.push(key);
  }

  private evictLRU(): void {
    const lruKey = this.lruList.shift();
    if (lruKey) {
      const entry = this.cache.get(lruKey);
      if (entry) {
        this.currentSize -= this.calculateSize(entry.embedding);
      }
      this.cache.delete(lruKey);
    }
  }

  private calculateSize(embedding: Float32Array): number {
    // Float32Array: 4 bytes per element
    return embedding.length * 4;
  }
}

// ============================================================================
// L2: INDEXEDDB CACHE
// ============================================================================

/**
 * L2 IndexedDB Cache
 *
 * Persistent browser storage for user's cached embeddings.
 * Target: ~50ms access, 20% hit rate
 */
class L2Cache {
  private db: IDBDatabase | null = null;
  private readonly STORE_NAME = "visual_embeddings";
  private initPromise: Promise<void> | null = null;

  constructor(private config: VisualCacheConfig["l2"]) {
    this.initPromise = this.initDB();
  }

  /**
   * Initialize IndexedDB
   */
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, {
            keyPath: "key",
          });
          store.createIndex("visualHash", "visualHash", { unique: false });
          store.createIndex("uiContext", "metadata.uiContext", {
            unique: false,
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });
  }

  /**
   * Get entry from L2 cache
   */
  async get(key: string): Promise<CacheEntry | null> {
    await this.initPromise;
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check TTL
        const age = (Date.now() - entry.timestamp) / 1000;
        if (age > entry.ttl) {
          this.delete(key);
          resolve(null);
          return;
        }

        // Update access metadata
        entry.metadata.lastAccessed = Date.now();
        entry.metadata.accessCount++;
        this.put(key, entry);

        resolve(entry);
      };
    });
  }

  /**
   * Set entry in L2 cache
   */
  async set(key: string, entry: Omit<CacheEntry, "level">): Promise<boolean> {
    await this.initPromise;
    if (!this.db) return false;

    // Check if we need to evict
    const count = await this.count();
    if (count >= this.config.maxEntries) {
      await this.evictOldest();
    }

    const cacheEntry: CacheEntry = {
      ...entry,
      level: "l2",
    };

    return this.put(key, cacheEntry);
  }

  /**
   * Delete entry from L2 cache
   */
  async delete(key: string): Promise<boolean> {
    await this.initPromise;
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result !== undefined);
    });
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    await this.initPromise;
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get entry count
   */
  async count(): Promise<number> {
    await this.initPromise;
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    await this.initPromise;
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  private async put(key: string, entry: CacheEntry): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  }

  private async evictOldest(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index("timestamp");
      const request = index.openCursor(null, "next");

      request.onerror = () => reject(request.error);
      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result as
          | IDBCursorWithValue
          | undefined;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
    });
  }
}

// ============================================================================
// L3: REDIS CACHE (Stub Implementation)
// ============================================================================

/**
 * L3 Redis Cache
 *
 * Shared cache across sessions/users.
 * Target: ~100ms access, 5% hit rate
 *
 * Note: This is a stub implementation. In production, use ioredis or redis.
 */
class L3Cache {
  private cache: Map<string, CacheEntry> = new Map();

  constructor(private config: VisualCacheConfig["l3"]) {}

  /**
   * Get entry from L3 cache
   */
  async get(key: string): Promise<CacheEntry | null> {
    // Stub: In production, use Redis client
    const entry = this.cache.get(this.config.keyPrefix + key);
    if (!entry) return null;

    // Check TTL
    const age = (Date.now() - entry.timestamp) / 1000;
    if (age > entry.ttl) {
      this.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Set entry in L3 cache
   */
  async set(key: string, entry: Omit<CacheEntry, "level">): Promise<boolean> {
    // Stub: In production, use Redis client
    const cacheEntry: CacheEntry = {
      ...entry,
      level: "l3",
    };
    this.cache.set(this.config.keyPrefix + key, cacheEntry);
    return true;
  }

  /**
   * Delete entry from L3 cache
   */
  async delete(key: string): Promise<boolean> {
    return this.cache.delete(this.config.keyPrefix + key);
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
  }

  /**
   * Get entry count
   */
  async count(): Promise<number> {
    return this.cache.size;
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys()).map(k =>
      k.slice(this.config.keyPrefix.length)
    );
  }
}

// ============================================================================
// L4: CLOUD CACHE (Stub Implementation)
// ============================================================================

/**
 * L4 Cloud Cache
 *
 * S3 + CloudFront for global CDN caching.
 * Target: ~200ms access, 0% hit rate (fallback only)
 *
 * Note: This is a stub implementation. In production, use AWS SDK.
 */
class L4Cache {
  constructor(private config: VisualCacheConfig["l4"]) {}

  /**
   * Get entry from L4 cache
   */
  async get(key: string): Promise<CacheEntry | null> {
    if (!this.config.enabled) return null;

    // Stub: In production, fetch from S3/CloudFront
    // const url = `https://${this.config.cdn}/${key}.json`;
    // const response = await fetch(url);
    // return response.json();

    return null;
  }

  /**
   * Set entry in L4 cache
   */
  async set(key: string, entry: Omit<CacheEntry, "level">): Promise<boolean> {
    if (!this.config.enabled) return false;

    // Stub: In production, upload to S3
    // await s3.putObject({
    //   Bucket: this.config.bucket,
    //   Key: `${key}.json`,
    //   Body: JSON.stringify(entry),
    //   ContentType: 'application/json',
    // });

    return true;
  }

  /**
   * Delete entry from L4 cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    // Stub: In production, delete from S3
    return true;
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    // Stub: No-op for cloud cache
  }
}

// ============================================================================
// VISUAL EMBEDDING CACHE (Main Class)
// ============================================================================

/**
 * Visual Embedding Cache
 *
 * Multi-level cache system for VL-JEPA visual embeddings.
 * Coordinates L1-L4 cache levels with automatic promotion/demotion.
 */
export class VisualEmbeddingCache {
  private l1: L1Cache;
  private l2: L2Cache;
  private l3: L3Cache;
  private l4: L4Cache;
  private keyGenerator: SemanticKeyGenerator;
  private invalidation: CacheInvalidation;
  private warming: CacheWarming;
  private metrics: CacheMetrics;

  constructor(private config: VisualCacheConfig) {
    this.l1 = new L1Cache(config.l1);
    this.l2 = new L2Cache(config.l2);
    this.l3 = new L3Cache(config.l3);
    this.l4 = new L4Cache(config.l4);
    this.keyGenerator = new SemanticKeyGenerator();
    this.invalidation = new CacheInvalidation();
    this.warming = new CacheWarming();
    this.metrics = new CacheMetrics();

    // Start background warming if enabled
    if (config.global?.enableWarming) {
      this.startBackgroundWarming();
    }
  }

  /**
   * Get embedding from cache (checks L1 → L2 → L3 → L4)
   */
  async get(
    frame: ImageData | HTMLCanvasElement | string,
    semanticKey?: SemanticKey
  ): Promise<CacheLookupResult> {
    const startTime = performance.now();

    // Generate semantic key if not provided
    const key = semanticKey || (await this.keyGenerator.generate(frame));

    // Try L1 first (fastest)
    let entry = this.l1.get(key.perceptualHash);
    if (entry) {
      this.metrics.recordHit("l1");
      return {
        found: true,
        level: "l1",
        embedding: entry.embedding,
        entry,
        lookupTime: performance.now() - startTime,
      };
    }
    this.metrics.recordMiss("l1");

    // Try L2
    entry = await this.l2.get(key.perceptualHash);
    if (entry) {
      // Promote to L1
      this.l1.set(key.perceptualHash, entry);
      this.metrics.recordHit("l2");
      return {
        found: true,
        level: "l2",
        embedding: entry.embedding,
        entry,
        lookupTime: performance.now() - startTime,
      };
    }
    this.metrics.recordMiss("l2");

    // Try L3
    entry = await this.l3.get(key.perceptualHash);
    if (entry) {
      // Promote to L2 and L1
      await this.l2.set(key.perceptualHash, entry);
      this.l1.set(key.perceptualHash, entry);
      this.metrics.recordHit("l3");
      return {
        found: true,
        level: "l3",
        embedding: entry.embedding,
        entry,
        lookupTime: performance.now() - startTime,
      };
    }
    this.metrics.recordMiss("l3");

    // Try L4
    entry = await this.l4.get(key.perceptualHash);
    if (entry) {
      // Promote to L3, L2, and L1
      await this.l3.set(key.perceptualHash, entry);
      await this.l2.set(key.perceptualHash, entry);
      this.l1.set(key.perceptualHash, entry);
      this.metrics.recordHit("l4");
      return {
        found: true,
        level: "l4",
        embedding: entry.embedding,
        entry,
        lookupTime: performance.now() - startTime,
      };
    }
    this.metrics.recordMiss("l4");

    // Cache miss - check for semantic similarity
    const similar = await this.keyGenerator.findSimilar(key);
    if (similar.length > 0 && similar[0].distance > 0.95) {
      const similarEntry = await this.getFromAllLevels(
        similar[0].key.perceptualHash
      );
      if (similarEntry) {
        this.metrics.recordSemanticHit(similar[0].distance);
        return {
          found: true,
          level: similarEntry.level,
          embedding: similarEntry.embedding,
          similarity: similar[0].distance,
          entry: similarEntry,
          lookupTime: performance.now() - startTime,
        };
      }
    }

    // Complete miss
    return {
      found: false,
      level: null,
      lookupTime: performance.now() - startTime,
    };
  }

  /**
   * Set embedding in cache (stores in all configured levels)
   */
  async set(
    frame: ImageData | HTMLCanvasElement | string,
    embedding: Float32Array,
    metadata: Omit<CacheMetadata, "accessCount" | "lastAccessed">
  ): Promise<void> {
    const key = await this.keyGenerator.generate(frame);

    const entry: Omit<CacheEntry, "level"> = {
      key: key.perceptualHash,
      embedding,
      visualHash: key.perceptualHash,
      timestamp: Date.now(),
      ttl: this.config.l1.ttl,
      metadata: {
        ...metadata,
        accessCount: 1,
        lastAccessed: Date.now(),
      },
    };

    // Store in all levels
    this.l1.set(key.perceptualHash, entry);
    await this.l2.set(key.perceptualHash, entry);
    await this.l3.set(key.perceptualHash, entry);
    await this.l4.set(key.perceptualHash, entry);
  }

  /**
   * Invalidate cache entries based on triggers
   */
  async invalidate(
    trigger: CacheInvalidation["triggers"][number],
    context?: unknown
  ): Promise<InvalidationEvent[]> {
    const events = await this.invalidation.invalidate(trigger, context);

    for (const event of events) {
      for (const key of event.keysAffected) {
        this.l1.delete(key);
        await this.l2.delete(key);
        await this.l3.delete(key);
        await this.l4.delete(key);
      }
    }

    return events;
  }

  /**
   * Warm cache with common UI frames
   */
  async warm(uiContexts: string[]): Promise<WarmupJob[]> {
    const jobs = await this.warming.createWarmupJobs(uiContexts);

    for (const job of jobs) {
      if (job.priority >= 0.8) {
        // High-priority jobs run immediately
        await this.executeWarmupJob(job);
      }
    }

    return jobs;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): MetricsType {
    return this.metrics.getMetrics();
  }

  /**
   * Clear all cache levels
   */
  async clear(): Promise<void> {
    this.l1.clear();
    await this.l2.clear();
    await this.l3.clear();
    await this.l4.clear();
    this.metrics.reset();
  }

  /**
   * Get cache size across all levels
   */
  async getCacheSize(): Promise<{
    l1: number;
    l2: number;
    l3: number;
    total: number;
  }> {
    const [l1, l2, l3] = await Promise.all([
      Promise.resolve(this.l1.size()),
      this.l2.count(),
      this.l3.count(),
    ]);

    return {
      l1,
      l2,
      l3,
      total: l1 + l2 + l3,
    };
  }

  private async getFromAllLevels(key: string): Promise<CacheEntry | null> {
    const entry = this.l1.get(key);
    if (entry) return entry;

    const l2Entry = await this.l2.get(key);
    if (l2Entry) {
      this.l1.set(key, l2Entry);
      return l2Entry;
    }

    const l3Entry = await this.l3.get(key);
    if (l3Entry) {
      await this.l2.set(key, l3Entry);
      this.l1.set(key, l3Entry);
      return l3Entry;
    }

    return null;
  }

  private async executeWarmupJob(job: WarmupJob): Promise<void> {
    // Stub: Execute warmup job
    // In production, this would encode the UI context and cache it
  }

  private startBackgroundWarming(): void {
    // Stub: Start background warming interval
    // In production, this would periodically warm the cache
  }
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default visual cache configuration
 */
export const DEFAULT_VISUAL_CACHE_CONFIG: VisualCacheConfig = {
  version: "1.0",
  l1: {
    maxSize: 50, // 50 MB
    maxEntries: 100,
    ttl: 3600, // 1 hour
  },
  l2: {
    dbName: "vljepa_visual_cache",
    maxEntries: 1000,
    ttl: 86400, // 24 hours
  },
  l3: {
    redisUrl: "redis://localhost:6379",
    keyPrefix: "vljepa:visual:",
    ttl: 604800, // 7 days
  },
  l4: {
    enabled: false,
    bucket: "vljepa-cache",
    cdn: "cdn.vljepa.example.com",
  },
  global: {
    similarityThreshold: 0.95,
    enableWarming: false,
    enableMetrics: true,
    logLevel: "info",
  },
};

/**
 * Production visual cache configuration (optimized for 85%+ hit rate)
 */
export const PRODUCTION_VISUAL_CACHE_CONFIG: VisualCacheConfig = {
  version: "1.0",
  l1: {
    maxSize: 100, // 100 MB
    maxEntries: 500,
    ttl: 7200, // 2 hours
  },
  l2: {
    dbName: "vljepa_visual_cache_prod",
    maxEntries: 5000,
    ttl: 604800, // 7 days
  },
  l3: {
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    keyPrefix: "vljepa:visual:prod:",
    ttl: 2592000, // 30 days
  },
  l4: {
    enabled: true,
    bucket: "vljepa-cache-prod",
    cdn: "d123456.cloudfront.net",
  },
  global: {
    similarityThreshold: 0.95,
    enableWarming: true,
    enableMetrics: true,
    logLevel: "warn",
  },
};
