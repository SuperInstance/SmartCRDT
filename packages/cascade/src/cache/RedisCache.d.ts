/**
 * @lsi/cascade - Redis L2 Cache
 *
 * Optional Redis-based L2 cache implementation.
 * If Redis is not available, falls back to in-memory simulation.
 *
 * Features:
 * - Optional Redis support (via ioredis)
 * - Graceful fallback to in-memory when Redis unavailable
 * - LRU eviction with access frequency consideration
 * - Size-based eviction with configurable limits
 * - TTL support with automatic expiration
 * - Connection health checking
 * - Statistics tracking
 */
import type { SemanticCacheEntry } from "../types.js";
/**
 * Redis connection options
 */
export interface RedisOptions {
    /** Redis connection URL */
    url: string;
    /** Key prefix for cache entries */
    keyPrefix: string;
    /** Connection timeout in milliseconds */
    connectTimeout?: number;
    /** Command timeout in milliseconds */
    commandTimeout?: number;
    /** Enable offline queue */
    enableOfflineQueue?: boolean;
    /** Enable ready check */
    enableReadyCheck?: boolean;
    /** Max number of retries */
    maxRetries?: number;
    /** Retry delay in milliseconds */
    retryDelay?: number;
}
/**
 * Redis cache configuration
 */
export interface RedisCacheConfig {
    /** Redis connection options */
    redis: RedisOptions;
    /** Maximum cache size */
    maxSize: number;
    /** Default TTL in milliseconds */
    ttl: number;
    /** Enable Redis (falls back to in-memory if false/unavailable) */
    enabled: boolean;
    /** LRU eviction enabled */
    lruEnabled: boolean;
    /** Access frequency weight for eviction (0-1) */
    frequencyWeight: number;
}
/**
 * Redis connection state
 */
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
/**
 * RedisCache - Optional Redis-based L2 cache
 *
 * If Redis is unavailable or disabled, falls back to in-memory cache.
 */
export declare class RedisCache {
    private config;
    private redisClient;
    private state;
    private memoryCache;
    private accessOrder;
    private stats;
    private timingStats;
    constructor(config: RedisCacheConfig);
    /**
     * Initialize Redis connection (optional)
     * If ioredis is not installed or connection fails, use in-memory fallback
     */
    private initializeRedis;
    /**
     * Try to import ioredis module
     * Returns null if not installed
     */
    private tryImportIORedis;
    /**
     * Check if Redis is available
     */
    private isRedisAvailable;
    /**
     * Get cache key with prefix
     */
    private getCacheKey;
    /**
     * Calculate entry score for eviction
     * Combines recency (LRU) and frequency (LFU)
     */
    private calculateEvictionScore;
    /**
     * Get entry from cache
     */
    get(key: string): Promise<SemanticCacheEntry | null>;
    /**
     * Set entry in cache
     */
    set(key: string, entry: SemanticCacheEntry, ttl?: number): Promise<void>;
    /**
     * Delete entry from cache
     */
    delete(key: string): Promise<void>;
    /**
     * Clear all entries
     */
    clear(): Promise<void>;
    /**
     * Evict entries based on LRU+LFU policy
     */
    private evict;
    /**
     * Update access frequency in Redis (background operation)
     */
    private updateAccessFrequency;
    /**
     * Update access order for LRU
     */
    private updateAccessOrder;
    /**
     * Remove from access order
     */
    private removeFromAccessOrder;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        hitRate: number;
        hits: number;
        misses: number;
        sets: number;
        deletes: number;
        evictions: number;
        redisHits: number;
        memoryHits: number;
        errors: number;
        avgAccessTime: number;
        state: ConnectionState;
        usingRedis: boolean;
    };
    /**
     * Get cache size
     */
    size(): number;
    /**
     * Check if Redis is connected
     */
    isConnected(): boolean;
    /**
     * Disconnect Redis connection
     */
    disconnect(): Promise<void>;
    /**
     * Get all keys in memory cache
     */
    keys(): string[];
    /**
     * Get entry without updating access
     */
    peek(key: string): SemanticCacheEntry | undefined;
    /**
     * Check if key exists
     */
    has(key: string): boolean;
    /**
     * Get connection state
     */
    getState(): ConnectionState;
}
/**
 * Default Redis cache configuration
 */
export declare const DEFAULT_REDIS_CACHE_CONFIG: Partial<RedisCacheConfig>;
export {};
//# sourceMappingURL=RedisCache.d.ts.map