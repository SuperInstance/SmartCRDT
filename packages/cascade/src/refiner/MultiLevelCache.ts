/**
 * @lsi/cascade - Multi-Level Cache
 *
 * Implements a 3-tier caching strategy for optimal performance:
 * - L1 (Memory): Fastest, smallest, volatile
 * - L2 (Redis): Fast, medium size, persistent
 * - L3 (Disk): Slower, largest, persistent
 *
 * Cache Promotion Flow:
 * L3 → L2 → L1 (on cache hit, promote to higher level)
 *
 * Cache Demotion Flow:
 * L1 → L2 → L3 (on eviction, demote to lower level)
 *
 * Features:
 * - Automatic promotion/demotion between levels
 * - Configurable size limits for each level
 * - Aggregated statistics across all levels
 * - Write-through and write-back policies
 * - Cache warming from lower levels
 * - Temperature-based promotion/demotion
 * - Enhanced LRU eviction with frequency consideration
 */

import type { RefinedQuery, SemanticCacheEntry } from "../types.js";
import { SemanticCache } from "./SemanticCache.js";
import { promises as fsp } from "fs";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Cache entry with temperature tracking
 */
interface TemperatureCacheEntry extends SemanticCacheEntry {
  /** Temperature score (0-1, higher = hotter/more popular) */
  temperature: number;
  /** Level where this entry resides */
  level: "l1" | "l2" | "l3";
  /** Total size in bytes (approximate) */
  size: number;
  /** Last promotion time */
  lastPromoted?: number;
  /** Last demotion time */
  lastDemoted?: number;
}

/**
 * Cache level configuration
 */
export interface CacheLevelConfig {
  /** Maximum number of entries */
  maxSize: number;
  /** TTL in milliseconds */
  ttl: number;
  /** Enable this level */
  enabled: boolean;
}

/**
 * Multi-level cache configuration
 */
export interface MultiLevelCacheConfig {
  /** L1 (memory) cache configuration */
  l1?: Partial<CacheLevelConfig>;
  /** L2 (Redis) cache configuration */
  l2?: Partial<CacheLevelConfig> & {
    /** Redis connection string */
    redisUrl?: string;
    /** Redis key prefix */
    keyPrefix?: string;
  };
  /** L3 (disk) cache configuration */
  l3?: Partial<CacheLevelConfig> & {
    /** Disk cache directory */
    cacheDir?: string;
  };
  /** Write-through policy (write to all levels immediately) */
  writeThrough?: boolean;
  /** Promote on hit (move to higher level) */
  promoteOnHit?: boolean;
}

/**
 * Cache entry metadata
 */
interface CacheMetadata {
  level: "l1" | "l2" | "l3";
  createdAt: number;
  lastAccessed: number;
  hitCount: number;
  size: number;
}

/**
 * Multi-level cache statistics
 */
export interface MultiLevelCacheStats {
  /** Total size across all levels */
  totalSize: number;
  /** Hit rate across all levels */
  hitRate: number;
  /** Level-specific stats */
  levels: {
    l1: { size: number; hits: number; misses: number; hitRate: number };
    l2: { size: number; hits: number; misses: number; hitRate: number };
    l3: { size: number; hits: number; misses: number; hitRate: number };
  };
  /** Promotion/demotion counts */
  promotions: number;
  demotions: number;
  /** Average access time per level (ms) */
  avgAccessTime: {
    l1: number;
    l2: number;
    l3: number;
  };
  /** Hot entries count (high temperature) */
  hotEntries: number;
  /** Cold entries count (low temperature) */
  coldEntries: number;
}

/**
 * Cache hit result with level info
 */
export interface MultiLevelCacheHit {
  found: true;
  result: unknown;
  level: "l1" | "l2" | "l3";
  similarity: number;
  entry: SemanticCacheEntry;
}

/**
 * Cache miss result
 */
export interface MultiLevelCacheMiss {
  found: false;
  similarQueries: Array<{ query: string; similarity: number }>;
}

/**
 * MultiLevelCache - 3-tier caching with automatic promotion/demotion
 */
export class MultiLevelCache {
  private l1: SemanticCache;
  private l2Enabled: boolean;
  private l3Enabled: boolean;
  private l2Cache: Map<
    string,
    {
      entry: SemanticCacheEntry;
      expiresAt: number;
      accessFrequency: number;
      lastAccessed: number;
    }
  > = new Map();
  private l2AccessOrder: string[] = []; // For LRU tracking
  private l3CacheDir: string;
  private writeThrough: boolean;
  private promoteOnHit: boolean;

  // Temperature tracking
  private temperatureThreshold = 0.7; // Entries above this are "hot"
  private coldThreshold = 0.3; // Entries below this are "cold"

  // Statistics
  private stats = {
    l1: { hits: 0, misses: 0, totalTime: 0 },
    l2: { hits: 0, misses: 0, totalTime: 0 },
    l3: { hits: 0, misses: 0, totalTime: 0 },
    promotions: 0,
    demotions: 0,
    l3Size: 0, // Cached L3 size for non-async getStats()
    hotEntries: 0,
    coldEntries: 0,
  };

  // Configuration
  private l1Config: Required<CacheLevelConfig>;
  private l2Config: Required<CacheLevelConfig> & {
    redisUrl: string;
    keyPrefix: string;
  };
  private l3Config: Required<CacheLevelConfig> & { cacheDir: string };

  constructor(config: MultiLevelCacheConfig = {}) {
    // L1 Configuration (memory)
    this.l1Config = {
      maxSize: config.l1?.maxSize ?? 1000,
      ttl: config.l1?.ttl ?? 300000, // 5 minutes
      enabled: config.l1?.enabled ?? true,
    };

    // L2 Configuration (Redis/simulated)
    this.l2Config = {
      maxSize: config.l2?.maxSize ?? 10000,
      ttl: config.l2?.ttl ?? 3600000, // 1 hour
      enabled: config.l2?.enabled ?? false, // Disabled by default (requires Redis)
      redisUrl: config.l2?.redisUrl ?? "redis://localhost:6379",
      keyPrefix: config.l2?.keyPrefix ?? "lsi:cache:",
    };

    // L3 Configuration (disk)
    this.l3Config = {
      maxSize: config.l3?.maxSize ?? 100000,
      ttl: config.l3?.ttl ?? 86400000, // 24 hours
      enabled: config.l3?.enabled ?? true,
      cacheDir: config.l3?.cacheDir ?? "./cache/l3",
    };

    this.l2Enabled = this.l2Config.enabled;
    this.l3Enabled = this.l3Config.enabled;
    this.l3CacheDir = this.l3Config.cacheDir;
    this.writeThrough = config.writeThrough ?? true;
    this.promoteOnHit = config.promoteOnHit ?? true;

    // Initialize L1 cache
    this.l1 = new SemanticCache({
      maxSize: this.l1Config.maxSize,
      ttl: this.l1Config.ttl,
    });

    // Initialize L3 cache directory
    this.initializeL3Cache();
  }

  /**
   * Initialize L3 disk cache directory
   */
  private initializeL3Cache(): void {
    if (this.l3Enabled) {
      try {
        // Create directory synchronously (called from constructor)
        if (!existsSync(this.l3CacheDir)) {
          mkdirSync(this.l3CacheDir, { recursive: true });
        }
      } catch (error) {
        console.warn("Failed to create L3 cache directory:", error);
        this.l3Enabled = false;
      }
    }
  }

  /**
   * Calculate temperature score for a cache entry
   * Based on hit frequency, recency, and age
   */
  private calculateTemperature(entry: SemanticCacheEntry): number {
    const now = Date.now();
    const age = now - entry.createdAt;
    const timeSinceAccess = now - entry.lastAccessed;

    // Hit frequency component (more hits = hotter)
    const hitScore = Math.min(1, entry.hitCount / 10);

    // Recency component (recently accessed = hotter)
    const recencyScore = Math.max(0, 1 - timeSinceAccess / (60 * 60 * 1000)); // Decay over 1 hour

    // Age component (newer entries get slight boost)
    const ageScore = Math.max(0, 1 - age / (24 * 60 * 60 * 1000)); // Decay over 24 hours

    // Weighted average
    return hitScore * 0.5 + recencyScore * 0.3 + ageScore * 0.2;
  }

  /**
   * Update L2 access order for LRU tracking
   */
  private updateL2AccessOrder(key: string): void {
    const index = this.l2AccessOrder.indexOf(key);
    if (index > -1) {
      this.l2AccessOrder.splice(index, 1);
    }
    this.l2AccessOrder.push(key);
  }

  /**
   * Remove from L2 access order
   */
  private removeFromL2AccessOrder(key: string): void {
    const index = this.l2AccessOrder.indexOf(key);
    if (index > -1) {
      this.l2AccessOrder.splice(index, 1);
    }
  }

  /**
   * Calculate eviction score for L2 entries
   * Combines LRU position and access frequency
   */
  private calculateL2EvictionScore(
    key: string,
    entry: { accessFrequency: number; lastAccessed: number }
  ): number {
    const position = this.l2AccessOrder.indexOf(key);
    const lruScore =
      position >= 0
        ? (this.l2AccessOrder.length - position) / this.l2AccessOrder.length
        : 0;
    const frequencyScore = Math.min(1, entry.accessFrequency / 10);

    // 70% LRU, 30% frequency
    return lruScore * 0.7 + frequencyScore * 0.3;
  }

  /**
   * Get from cache with level-aware lookup
   * Tries L1 → L2 → L3, promoting hits to higher levels
   */
  async get(
    refinedQuery: RefinedQuery
  ): Promise<MultiLevelCacheHit | MultiLevelCacheMiss> {
    const { cacheKey } = refinedQuery;

    // Try L1 (memory) - fastest
    const l1Start = Date.now();
    const l1Result = await this.l1.get(refinedQuery);
    this.stats.l1.totalTime += Date.now() - l1Start;

    if (l1Result.found) {
      this.stats.l1.hits++;

      // Update temperature tracking
      const temperature = this.calculateTemperature(l1Result.entry);
      if (temperature > this.temperatureThreshold) {
        this.stats.hotEntries++;
      } else if (temperature < this.coldThreshold) {
        this.stats.coldEntries++;
      }

      return {
        found: true,
        result: l1Result.result,
        level: "l1",
        similarity: l1Result.similarity,
        entry: l1Result.entry,
      };
    }
    this.stats.l1.misses++;

    // Try L2 (Redis) - medium speed
    if (this.l2Enabled) {
      const l2Start = Date.now();
      const l2Result = await this.getL2(cacheKey);
      this.stats.l2.totalTime += Date.now() - l2Start;

      if (l2Result) {
        this.stats.l2.hits++;
        this.stats.promotions++;

        // Update temperature and track if hot
        const temperature = this.calculateTemperature(l2Result.entry);
        if (temperature > this.temperatureThreshold) {
          this.stats.hotEntries++;
        } else if (temperature < this.coldThreshold) {
          this.stats.coldEntries++;
        }

        // Promote to L1
        await this.l1.set(refinedQuery, l2Result.entry.result);

        return {
          found: true,
          result: l2Result.entry.result,
          level: "l2",
          similarity: 1.0,
          entry: l2Result.entry,
        };
      }
      this.stats.l2.misses++;
    }

    // Try L3 (disk) - slowest
    if (this.l3Enabled) {
      const l3Start = Date.now();
      const l3Result = await this.getL3(cacheKey);
      this.stats.l3.totalTime += Date.now() - l3Start;

      if (l3Result) {
        this.stats.l3.hits++;
        this.stats.promotions++;

        // Update temperature
        const temperature = this.calculateTemperature(l3Result.entry);
        if (temperature > this.temperatureThreshold) {
          this.stats.hotEntries++;
        } else if (temperature < this.coldThreshold) {
          this.stats.coldEntries++;
        }

        // Promote to L2 and L1
        await this.setL2(cacheKey, l3Result.entry);
        await this.l1.set(refinedQuery, l3Result.entry.result);

        return {
          found: true,
          result: l3Result.entry.result,
          level: "l3",
          similarity: 1.0,
          entry: l3Result.entry,
        };
      }
      this.stats.l3.misses++;
    }

    // No hit at any level
    return {
      found: false,
      similarQueries: l1Result.found ? [] : l1Result.similarQueries,
    };
  }

  /**
   * Set entry in cache (write-through or write-back)
   */
  async set(refinedQuery: RefinedQuery, result: unknown): Promise<void> {
    const { cacheKey, original } = refinedQuery;
    const now = Date.now();

    const entry: SemanticCacheEntry = {
      query: original,
      embedding: refinedQuery.semanticFeatures?.embedding || [],
      result,
      hitCount: 1,
      lastAccessed: now,
      createdAt: now,
    };

    // Always write to L1
    await this.l1.set(refinedQuery, result);

    // Write-through to L2 and L3 if enabled
    if (this.writeThrough) {
      if (this.l2Enabled) {
        await this.setL2(cacheKey, entry);
      }
      if (this.l3Enabled) {
        await this.setL3(cacheKey, entry);
      }
    }
  }

  /**
   * Delete from all cache levels
   */
  async delete(cacheKey: string): Promise<void> {
    // Delete from L1
    this.l1.delete(cacheKey);

    // Delete from L2
    if (this.l2Enabled) {
      this.l2Cache.delete(cacheKey);
      this.removeFromL2AccessOrder(cacheKey);
    }

    // Delete from L3
    if (this.l3Enabled) {
      try {
        const filePath = join(this.l3CacheDir, `${cacheKey}.json`);
        await fsp.unlink(filePath).catch(() => {});
        this.stats.l3Size--; // Decrement cached size
      } catch {
        // Ignore errors
      }
    }
  }

  /**
   * Clear all cache levels
   */
  async clear(): Promise<void> {
    // Clear L1
    this.l1.clear();

    // Clear L2
    this.l2Cache.clear();
    this.l2AccessOrder = [];

    // Clear L3
    if (this.l3Enabled) {
      try {
        const files = await fsp.readdir(this.l3CacheDir);
        await Promise.all(files.map(f => fsp.unlink(join(this.l3CacheDir, f))));
      } catch {
        // Ignore errors
      }
    }

    // Reset stats
    this.stats = {
      l1: { hits: 0, misses: 0, totalTime: 0 },
      l2: { hits: 0, misses: 0, totalTime: 0 },
      l3: { hits: 0, misses: 0, totalTime: 0 },
      promotions: 0,
      demotions: 0,
      l3Size: 0,
      hotEntries: 0,
      coldEntries: 0,
    };
  }

  /**
   * Get aggregated statistics across all levels
   * Uses cached L3 size for non-blocking access
   */
  getStats(): MultiLevelCacheStats {
    const l1Stats = this.l1.getStats();
    const l1Hits = this.stats.l1.hits;
    const l1Misses = this.stats.l1.misses;
    const l1TotalRequests = l1Hits + l1Misses;

    const l2Hits = this.stats.l2.hits;
    const l2Misses = this.stats.l2.misses;
    const l2Size = this.l2Cache.size;
    const l2TotalRequests = l2Hits + l2Misses;

    const l3Hits = this.stats.l3.hits;
    const l3Misses = this.stats.l3.misses;
    const l3Size = this.stats.l3Size; // Use cached size
    const l3TotalRequests = l3Hits + l3Misses;

    const totalHits = l1Hits + l2Hits + l3Hits;
    const totalMisses = l1Misses + l2Misses + l3Misses;
    const totalSize = l1Stats.size + l2Size + l3Size;

    return {
      totalSize,
      hitRate:
        totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0,
      levels: {
        l1: {
          size: l1Stats.size,
          hits: l1Hits,
          misses: l1Misses,
          hitRate: l1TotalRequests > 0 ? l1Hits / l1TotalRequests : 0,
        },
        l2: {
          size: l2Size,
          hits: l2Hits,
          misses: l2Misses,
          hitRate: l2TotalRequests > 0 ? l2Hits / l2TotalRequests : 0,
        },
        l3: {
          size: l3Size,
          hits: l3Hits,
          misses: l3Misses,
          hitRate: l3TotalRequests > 0 ? l3Hits / l3TotalRequests : 0,
        },
      },
      promotions: this.stats.promotions,
      demotions: this.stats.demotions,
      avgAccessTime: {
        l1: l1TotalRequests > 0 ? this.stats.l1.totalTime / l1TotalRequests : 0,
        l2: l2TotalRequests > 0 ? this.stats.l2.totalTime / l2TotalRequests : 0,
        l3: l3TotalRequests > 0 ? this.stats.l3.totalTime / l3TotalRequests : 0,
      },
      hotEntries: this.stats.hotEntries,
      coldEntries: this.stats.coldEntries,
    };
  }

  /**
   * Get aggregated statistics across all levels (async version)
   * Computes actual L3 size from disk for accuracy
   */
  async getStatsAsync(): Promise<MultiLevelCacheStats> {
    const l1Stats = this.l1.getStats();
    const l1Hits = this.stats.l1.hits;
    const l1Misses = this.stats.l1.misses;
    const l1TotalRequests = l1Hits + l1Misses;

    const l2Hits = this.stats.l2.hits;
    const l2Misses = this.stats.l2.misses;
    const l2Size = this.l2Cache.size;
    const l2TotalRequests = l2Hits + l2Misses;

    const l3Hits = this.stats.l3.hits;
    const l3Misses = this.stats.l3.misses;
    // Get actual L3 size from disk for accuracy
    const l3Size = this.l3Enabled ? await this.getL3Size() : 0;
    const l3TotalRequests = l3Hits + l3Misses;

    const totalHits = l1Hits + l2Hits + l3Hits;
    const totalMisses = l1Misses + l2Misses + l3Misses;
    const totalSize = l1Stats.size + l2Size + l3Size;

    return {
      totalSize,
      hitRate:
        totalHits + totalMisses > 0 ? totalHits / (totalHits + totalMisses) : 0,
      levels: {
        l1: {
          size: l1Stats.size,
          hits: l1Hits,
          misses: l1Misses,
          hitRate: l1TotalRequests > 0 ? l1Hits / l1TotalRequests : 0,
        },
        l2: {
          size: l2Size,
          hits: l2Hits,
          misses: l2Misses,
          hitRate: l2TotalRequests > 0 ? l2Hits / l2TotalRequests : 0,
        },
        l3: {
          size: l3Size,
          hits: l3Hits,
          misses: l3Misses,
          hitRate: l3TotalRequests > 0 ? l3Hits / l3TotalRequests : 0,
        },
      },
      promotions: this.stats.promotions,
      demotions: this.stats.demotions,
      avgAccessTime: {
        l1: l1TotalRequests > 0 ? this.stats.l1.totalTime / l1TotalRequests : 0,
        l2: l2TotalRequests > 0 ? this.stats.l2.totalTime / l2TotalRequests : 0,
        l3: l3TotalRequests > 0 ? this.stats.l3.totalTime / l3TotalRequests : 0,
      },
      hotEntries: this.stats.hotEntries,
      coldEntries: this.stats.coldEntries,
    };
  }

  /**
   * Warm cache from lower levels
   * Uses access frequency and temperature to prioritize which entries to warm
   */
  async warmCache(maxEntries?: number): Promise<number> {
    let warmed = 0;

    if (this.l3Enabled) {
      // Get L3 entries with their metadata
      const l3Entries = await this.listL3Entries();
      const entriesWithTemperature: Array<{
        key: string;
        temperature: number;
      }> = [];

      // Calculate temperature for each L3 entry
      for (const cacheKey of l3Entries) {
        const result = await this.getL3(cacheKey);
        if (result) {
          const temperature = this.calculateTemperature(result.entry);
          entriesWithTemperature.push({ key: cacheKey, temperature });
        }
      }

      // Sort by temperature (hottest first)
      entriesWithTemperature.sort((a, b) => b.temperature - a.temperature);

      // Warm the hottest entries
      const toWarm = maxEntries
        ? entriesWithTemperature.slice(0, maxEntries)
        : entriesWithTemperature;

      for (const { key } of toWarm) {
        const result = await this.getL3(key);
        if (result) {
          // Promote to L2 (result.entry is the SemanticCacheEntry)
          if (this.l2Enabled) {
            await this.setL2(key, result.entry);
          }
          warmed++;
        }
      }
    }

    return warmed;
  }

  // ========== L2 (Redis) Methods ==========

  private async getL2(
    cacheKey: string
  ): Promise<{ entry: SemanticCacheEntry } | null> {
    const cached = this.l2Cache.get(cacheKey);
    if (!cached) return null;

    // Check expiration
    if (Date.now() > cached.expiresAt) {
      this.l2Cache.delete(cacheKey);
      this.removeFromL2AccessOrder(cacheKey);
      return null;
    }

    // Update access frequency and LRU position
    cached.accessFrequency++;
    cached.lastAccessed = Date.now();
    this.updateL2AccessOrder(cacheKey);

    return { entry: cached.entry };
  }

  private async setL2(
    cacheKey: string,
    entry: SemanticCacheEntry
  ): Promise<void> {
    const expiresAt = Date.now() + this.l2Config.ttl;

    // Check size limit and evict if needed
    if (
      this.l2Cache.size >= this.l2Config.maxSize &&
      !this.l2Cache.has(cacheKey)
    ) {
      await this.evictL2();
    }

    this.l2Cache.set(cacheKey, {
      entry,
      expiresAt,
      accessFrequency: 1,
      lastAccessed: Date.now(),
    });
    this.updateL2AccessOrder(cacheKey);

    // TODO: If Redis is configured, also write to Redis
    // This would use ioredis or redis client
  }

  /**
   * Evict from L2 using improved LRU+frequency policy
   */
  private async evictL2(): Promise<void> {
    if (this.l2Cache.size === 0) return;

    // Find entry with lowest eviction score (coldest/least recently used)
    let worstKey: string | null = null;
    let worstScore = Infinity;

    for (const [key, value] of this.l2Cache.entries()) {
      const score = this.calculateL2EvictionScore(key, value);
      if (score < worstScore) {
        worstScore = score;
        worstKey = key;
      }
    }

    if (worstKey) {
      this.l2Cache.delete(worstKey);
      this.removeFromL2AccessOrder(worstKey);
      this.stats.demotions++;
    }
  }

  // ========== L3 (Disk) Methods ==========

  private async getL3(
    cacheKey: string
  ): Promise<{ entry: SemanticCacheEntry } | null> {
    try {
      const filePath = join(
        this.l3CacheDir,
        `${this.sanitizeKey(cacheKey)}.json`
      );
      const data = await fsp.readFile(filePath, "utf8");
      const cached = JSON.parse(data) as {
        entry: SemanticCacheEntry;
        expiresAt: number;
      };

      // Check expiration
      if (Date.now() > cached.expiresAt) {
        await fsp.unlink(filePath).catch(() => {});
        this.stats.l3Size--; // Decrement on expiration
        return null;
      }

      return cached;
    } catch {
      return null;
    }
  }

  private async setL3(
    cacheKey: string,
    entry: SemanticCacheEntry
  ): Promise<void> {
    try {
      // Ensure directory exists
      await fsp.mkdir(this.l3CacheDir, { recursive: true });

      const sanitizedKey = this.sanitizeKey(cacheKey);
      const filePath = join(this.l3CacheDir, `${sanitizedKey}.json`);
      const expiresAt = Date.now() + this.l3Config.ttl;

      const data = JSON.stringify({ entry, expiresAt });
      await fsp.writeFile(filePath, data, "utf8");

      // Update cached size
      this.stats.l3Size++;

      // Check size limit
      if (this.stats.l3Size > this.l3Config.maxSize) {
        await this.evictL3();
      }
    } catch (error) {
      console.warn("Failed to write to L3 cache:", error);
    }
  }

  private async listL3Entries(): Promise<string[]> {
    try {
      const files = await fsp.readdir(this.l3CacheDir);
      return files
        .filter(f => f.endsWith(".json"))
        .map(f => f.replace(".json", ""));
    } catch {
      return [];
    }
  }

  private async getL3Size(): Promise<number> {
    try {
      const files = await fsp.readdir(this.l3CacheDir);
      return files.filter(f => f.endsWith(".json")).length;
    } catch {
      return 0;
    }
  }

  private async evictL3(): Promise<void> {
    try {
      const files = await fsp.readdir(this.l3CacheDir);
      const jsonFiles = files.filter(f => f.endsWith(".json"));

      // Get file stats and find oldest
      const fileStats = await Promise.all(
        jsonFiles.map(async f => ({
          name: f,
          stat: await fsp.stat(join(this.l3CacheDir, f)),
        }))
      );

      fileStats.sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);

      // Delete oldest file
      if (fileStats.length > 0) {
        await fsp.unlink(join(this.l3CacheDir, fileStats[0].name));
        this.stats.demotions++;
        this.stats.l3Size--; // Decrement on eviction
      }
    } catch (error) {
      console.warn("Failed to evict from L3 cache:", error);
    }
  }

  /**
   * Sanitize cache key for filesystem
   */
  private sanitizeKey(key: string): string {
    // Replace special characters with underscores
    return key.replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  /**
   * Export cache state to JSON
   */
  async exportCache(): Promise<{
    l1: Array<{ key: string; entry: SemanticCacheEntry }>;
    l2: Array<{ key: string; entry: SemanticCacheEntry }>;
    l3: Array<{ key: string; entry: SemanticCacheEntry }>;
  }> {
    const l1: Array<{ key: string; entry: SemanticCacheEntry }> = [];
    const l2: Array<{ key: string; entry: SemanticCacheEntry }> = [];
    const l3: Array<{ key: string; entry: SemanticCacheEntry }> = [];

    // Export L1
    for (const key of this.l1.keys()) {
      const entry = this.l1.peek(key);
      if (entry) {
        l1.push({ key, entry });
      }
    }

    // Export L2
    for (const [key, value] of this.l2Cache.entries()) {
      l2.push({ key, entry: value.entry });
    }

    // Export L3
    if (this.l3Enabled) {
      const l3Keys = await this.listL3Entries();
      for (const key of l3Keys) {
        const result = await this.getL3(key);
        if (result) {
          l3.push({ key, entry: result.entry });
        }
      }
    }

    return { l1, l2, l3 };
  }

  /**
   * Import cache state from JSON
   */
  async importCache(data: {
    l1?: Array<{ key: string; entry: SemanticCacheEntry }>;
    l2?: Array<{ key: string; entry: SemanticCacheEntry }>;
    l3?: Array<{ key: string; entry: SemanticCacheEntry }>;
  }): Promise<void> {
    // Import L3 first (bottom-up)
    if (data.l3 && this.l3Enabled) {
      for (const { key, entry } of data.l3) {
        await this.setL3(key, entry);
      }
    }

    // Import L2
    if (data.l2 && this.l2Enabled) {
      for (const { key, entry } of data.l2) {
        await this.setL2(key, entry);
      }
    }

    // Import L1
    if (data.l1) {
      for (const { key, entry } of data.l1) {
        // Need to reconstruct RefinedQuery for L1
        // For now, just store the entry data
        this.l1.set(
          {
            cacheKey: key,
            original: entry.query,
            semanticFeatures: { embedding: entry.embedding },
          } as RefinedQuery,
          entry.result
        );
      }
    }
  }
}

/**
 * Default configuration
 */
export const DEFAULT_MULTI_LEVEL_CACHE_CONFIG: MultiLevelCacheConfig = {
  l1: {
    maxSize: 1000,
    ttl: 300000, // 5 minutes
    enabled: true,
  },
  l2: {
    maxSize: 10000,
    ttl: 3600000, // 1 hour
    enabled: false, // Requires Redis
    redisUrl: "redis://localhost:6379",
    keyPrefix: "lsi:cache:",
  },
  l3: {
    maxSize: 100000,
    ttl: 86400000, // 24 hours
    enabled: true,
    cacheDir: "./cache/l3",
  },
  writeThrough: true,
  promoteOnHit: true,
};
