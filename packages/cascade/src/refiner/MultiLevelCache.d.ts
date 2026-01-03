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
 * Multi-level cache statistics
 */
export interface MultiLevelCacheStats {
    /** Total size across all levels */
    totalSize: number;
    /** Hit rate across all levels */
    hitRate: number;
    /** Level-specific stats */
    levels: {
        l1: {
            size: number;
            hits: number;
            misses: number;
            hitRate: number;
        };
        l2: {
            size: number;
            hits: number;
            misses: number;
            hitRate: number;
        };
        l3: {
            size: number;
            hits: number;
            misses: number;
            hitRate: number;
        };
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
    similarQueries: Array<{
        query: string;
        similarity: number;
    }>;
}
/**
 * MultiLevelCache - 3-tier caching with automatic promotion/demotion
 */
export declare class MultiLevelCache {
    private l1;
    private l2Enabled;
    private l3Enabled;
    private l2Cache;
    private l2AccessOrder;
    private l3CacheDir;
    private writeThrough;
    private promoteOnHit;
    private temperatureThreshold;
    private coldThreshold;
    private stats;
    private l1Config;
    private l2Config;
    private l3Config;
    constructor(config?: MultiLevelCacheConfig);
    /**
     * Initialize L3 disk cache directory
     */
    private initializeL3Cache;
    /**
     * Calculate temperature score for a cache entry
     * Based on hit frequency, recency, and age
     */
    private calculateTemperature;
    /**
     * Update L2 access order for LRU tracking
     */
    private updateL2AccessOrder;
    /**
     * Remove from L2 access order
     */
    private removeFromL2AccessOrder;
    /**
     * Calculate eviction score for L2 entries
     * Combines LRU position and access frequency
     */
    private calculateL2EvictionScore;
    /**
     * Get from cache with level-aware lookup
     * Tries L1 → L2 → L3, promoting hits to higher levels
     */
    get(refinedQuery: RefinedQuery): Promise<MultiLevelCacheHit | MultiLevelCacheMiss>;
    /**
     * Set entry in cache (write-through or write-back)
     */
    set(refinedQuery: RefinedQuery, result: unknown): Promise<void>;
    /**
     * Delete from all cache levels
     */
    delete(cacheKey: string): Promise<void>;
    /**
     * Clear all cache levels
     */
    clear(): Promise<void>;
    /**
     * Get aggregated statistics across all levels
     * Uses cached L3 size for non-blocking access
     */
    getStats(): MultiLevelCacheStats;
    /**
     * Get aggregated statistics across all levels (async version)
     * Computes actual L3 size from disk for accuracy
     */
    getStatsAsync(): Promise<MultiLevelCacheStats>;
    /**
     * Warm cache from lower levels
     * Uses access frequency and temperature to prioritize which entries to warm
     */
    warmCache(maxEntries?: number): Promise<number>;
    private getL2;
    private setL2;
    /**
     * Evict from L2 using improved LRU+frequency policy
     */
    private evictL2;
    private getL3;
    private setL3;
    private listL3Entries;
    private getL3Size;
    private evictL3;
    /**
     * Sanitize cache key for filesystem
     */
    private sanitizeKey;
    /**
     * Export cache state to JSON
     */
    exportCache(): Promise<{
        l1: Array<{
            key: string;
            entry: SemanticCacheEntry;
        }>;
        l2: Array<{
            key: string;
            entry: SemanticCacheEntry;
        }>;
        l3: Array<{
            key: string;
            entry: SemanticCacheEntry;
        }>;
    }>;
    /**
     * Import cache state from JSON
     */
    importCache(data: {
        l1?: Array<{
            key: string;
            entry: SemanticCacheEntry;
        }>;
        l2?: Array<{
            key: string;
            entry: SemanticCacheEntry;
        }>;
        l3?: Array<{
            key: string;
            entry: SemanticCacheEntry;
        }>;
    }): Promise<void>;
}
/**
 * Default configuration
 */
export declare const DEFAULT_MULTI_LEVEL_CACHE_CONFIG: MultiLevelCacheConfig;
//# sourceMappingURL=MultiLevelCache.d.ts.map