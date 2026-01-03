/**
 * @fileoverview Cache Manager for VL-JEPA Edge Deployment
 *
 * Multi-layer caching strategy for model and embedding data:
 * - IndexedDB for persistent storage
 * - Service Worker for offline support
 * - Memory cache for fast access
 * - Cache compression
 * - Version management
 *
 * @package @lsi/vljepa-edge
 */

import type { CacheManagerConfig, CacheEntry } from "../types.js";

/**
 * Cache Manager for VL-JEPA edge deployment
 *
 * Provides multi-layer caching with IndexedDB, Service Worker,
 * and in-memory storage.
 */
export class CacheManager {
  private config: CacheManagerConfig;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private db: IDBDatabase | null = null;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private totalCacheSize: number = 0;

  constructor(config: CacheManagerConfig) {
    this.config = config;
  }

  /**
   * Initialize cache manager
   */
  async initialize(): Promise<void> {
    // Initialize memory cache
    if (this.config.memoryCache.enabled) {
      this.memoryCache = new Map();
    }

    // Initialize IndexedDB
    if (this.config.indexedDB.enabled) {
      await this.openIndexedDB();
    }

    // Initialize Service Worker
    if (this.config.serviceWorker.enabled) {
      await this.registerServiceWorker();
    }

    // Clean up expired entries
    await this.cleanup();
  }

  /**
   * Get entry from cache
   */
  async get(key: string): Promise<ArrayBuffer | null> {
    // Try memory cache first
    if (this.config.memoryCache.enabled && this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      if (!this.isExpired(entry)) {
        return this.decompress(entry);
      }
      this.memoryCache.delete(key);
    }

    // Try IndexedDB
    if (this.config.indexedDB.enabled && this.db) {
      const entry = await this.getFromIndexedDB(key);
      if (entry && !this.isExpired(entry)) {
        // Promote to memory cache
        if (this.config.memoryCache.enabled) {
          this.memoryCache.set(key, entry);
        }
        return this.decompress(entry);
      }
    }

    return null;
  }

  /**
   * Set entry in cache
   */
  async set(
    key: string,
    data: ArrayBuffer,
    version: string = "1.0",
    ttl: number = 3600000
  ): Promise<void> {
    const size = data.byteLength;

    // Check cache size limit
    if (this.totalCacheSize + size > this.config.maxCacheSize * 1024 * 1024) {
      await this.evict(size);
    }

    const entry: CacheEntry = {
      key,
      version,
      data: this.config.compression ? await this.compress(data) : data,
      size,
      timestamp: Date.now(),
      ttl,
      compression: this.config.compression ? "none" : "none",
    };

    // Store in memory cache
    if (this.config.memoryCache.enabled) {
      this.memoryCache.set(key, entry);
    }

    // Store in IndexedDB
    if (this.config.indexedDB.enabled && this.db) {
      await this.setToIndexedDB(key, entry);
    }

    this.totalCacheSize += size;
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    if (this.config.memoryCache.enabled && this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      return !this.isExpired(entry);
    }

    if (this.config.indexedDB.enabled && this.db) {
      const entry = await this.getFromIndexedDB(key);
      return entry !== null && !this.isExpired(entry);
    }

    return false;
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<void> {
    // Remove from memory cache
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      this.totalCacheSize -= entry.size;
      this.memoryCache.delete(key);
    }

    // Remove from IndexedDB
    if (this.db) {
      await this.deleteFromIndexedDB(key);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    this.totalCacheSize = 0;

    // Clear IndexedDB
    if (this.db) {
      await this.clearIndexedDB();
    }

    // Clear Service Worker cache
    if (this.serviceWorkerRegistration) {
      await this.clearServiceWorkerCache();
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalSize: number;
    entryCount: number;
    memoryEntries: number;
    indexedDBEntries: number;
    hitRate: number;
  }> {
    const memoryEntries = this.memoryCache.size;
    const indexedDBEntries = this.db ? await this.countIndexedDBEntries() : 0;

    return {
      totalSize: this.totalCacheSize,
      entryCount: memoryEntries + indexedDBEntries,
      memoryEntries,
      indexedDBEntries,
      hitRate: 0, // TODO: Track hits/misses
    };
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<void> {
    // Clean memory cache
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.totalCacheSize -= entry.size;
        this.memoryCache.delete(key);
      }
    }

    // Clean IndexedDB
    if (this.db) {
      await this.cleanupIndexedDB();
    }
  }

  /**
   * Preload data into cache
   */
  async preload(items: Map<string, ArrayBuffer>): Promise<void> {
    for (const [key, data] of items) {
      await this.set(key, data);
    }
  }

  /**
   * Export cache as JSON
   */
  async export(): Promise<string> {
    const items: Record<string, unknown> = {};

    // Export memory cache
    for (const [key, entry] of this.memoryCache) {
      items[key] = {
        version: entry.version,
        data: Array.from(new Uint8Array(entry.data)),
        timestamp: entry.timestamp,
        ttl: entry.ttl,
      };
    }

    return JSON.stringify(items);
  }

  /**
   * Import cache from JSON
   */
  async import(json: string): Promise<void> {
    const items = JSON.parse(json);

    for (const [key, value] of Object.entries(items)) {
      const entry = value as {
        version: string;
        data: number[];
        timestamp: number;
        ttl: number;
      };

      const data = new Uint8Array(entry.data).buffer;
      await this.set(key, data, entry.version, entry.ttl);
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.memoryCache.clear();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Open IndexedDB
   */
  private async openIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(
        this.config.indexedDB.dbName,
        this.config.indexedDB.version
      );

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.config.indexedDB.storeName)) {
          const store = db.createObjectStore(this.config.indexedDB.storeName, {
            keyPath: "key",
          });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("version", "version", { unique: false });
        }
      };
    });
  }

  /**
   * Get entry from IndexedDB
   */
  private async getFromIndexedDB(key: string): Promise<CacheEntry | null> {
    if (!this.db) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        this.config.indexedDB.storeName,
        "readonly"
      );
      const request = tx.objectStore(this.config.indexedDB.storeName).get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Set entry in IndexedDB
   */
  private async setToIndexedDB(_key: string, entry: CacheEntry): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        this.config.indexedDB.storeName,
        "readwrite"
      );
      const request = tx
        .objectStore(this.config.indexedDB.storeName)
        .put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete entry from IndexedDB
   */
  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        this.config.indexedDB.storeName,
        "readwrite"
      );
      const request = tx
        .objectStore(this.config.indexedDB.storeName)
        .delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        this.config.indexedDB.storeName,
        "readwrite"
      );
      const request = tx.objectStore(this.config.indexedDB.storeName).clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Count IndexedDB entries
   */
  private async countIndexedDBEntries(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        this.config.indexedDB.storeName,
        "readonly"
      );
      const request = tx.objectStore(this.config.indexedDB.storeName).count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cleanup expired IndexedDB entries
   */
  private async cleanupIndexedDB(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(
        this.config.indexedDB.storeName,
        "readwrite"
      );
      const store = tx.objectStore(this.config.indexedDB.storeName);
      const index = store.index("timestamp");
      const now = Date.now();
      const request = index.openCursor(IDBKeyRange.upperBound(now));

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Register Service Worker
   */
  private async registerServiceWorker(): Promise<void> {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    try {
      this.serviceWorkerRegistration = await navigator.serviceWorker.register(
        this.config.serviceWorker.scriptPath,
        { scope: this.config.serviceWorker.scope }
      );
    } catch (error) {
      console.warn("[CacheManager] Service Worker registration failed:", error);
    }
  }

  /**
   * Clear Service Worker cache
   */
  private async clearServiceWorkerCache(): Promise<void> {
    if (!this.serviceWorkerRegistration) {
      return;
    }

    try {
      const caches = await window.caches.open("vljepa-cache");
      await caches
        .keys()
        .then(keys => Promise.all(keys.map(key => caches.delete(key))));
    } catch (error) {
      console.warn(
        "[CacheManager] Failed to clear Service Worker cache:",
        error
      );
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    return now - entry.timestamp > entry.ttl;
  }

  /**
   * Compress data (placeholder)
   */
  private async compress(data: ArrayBuffer): Promise<ArrayBuffer> {
    // Placeholder for actual compression (e.g., gzip, brotli)
    // In real implementation, use CompressionStream API
    return data;
  }

  /**
   * Decompress data (placeholder)
   */
  private async decompress(entry: CacheEntry): Promise<ArrayBuffer> {
    if (entry.compression === "none") {
      return entry.data;
    }
    // Placeholder for actual decompression
    return entry.data;
  }

  /**
   * Evict entries to make space
   */
  private async evict(requiredSize: number): Promise<void> {
    let freed = 0;

    // Evict from memory cache first (LRU)
    const keys = Array.from(this.memoryCache.keys());
    for (const key of keys) {
      const entry = this.memoryCache.get(key);
      if (entry) {
        this.totalCacheSize -= entry.size;
        freed += entry.size;
        this.memoryCache.delete(key);

        if (freed >= requiredSize) {
          return;
        }
      }
    }

    // If still need more space, evict from IndexedDB
    if (this.db && freed < requiredSize) {
      // Evict oldest entries
      const tx = this.db.transaction(
        this.config.indexedDB.storeName,
        "readwrite"
      );
      const store = tx.objectStore(this.config.indexedDB.storeName);
      const index = store.index("timestamp");
      const request = index.openCursor();

      request.onsuccess = event => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry: CacheEntry = cursor.value;
          this.totalCacheSize -= entry.size;
          freed += entry.size;
          cursor.delete();

          if (freed >= requiredSize) {
            return;
          }

          cursor.continue();
        }
      };
    }
  }
}

/**
 * Create a cache manager instance
 */
export function createCacheManager(config: CacheManagerConfig): CacheManager {
  return new CacheManager(config);
}

/**
 * Default cache manager configuration
 */
export function getDefaultCacheManagerConfig(): CacheManagerConfig {
  return {
    indexedDB: {
      enabled: true,
      dbName: "vljepa-edge-cache",
      storeName: "entries",
      version: 1,
    },
    serviceWorker: {
      enabled: false,
      scriptPath: "/sw.js",
      scope: "/",
    },
    memoryCache: {
      enabled: true,
      maxSize: 256, // 256MB
      ttl: 1800000, // 30 minutes
    },
    maxCacheSize: 1024, // 1GB total
    versioning: true,
    compression: false,
  };
}
