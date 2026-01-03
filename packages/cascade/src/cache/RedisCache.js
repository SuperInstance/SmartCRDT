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
/**
 * RedisCache - Optional Redis-based L2 cache
 *
 * If Redis is unavailable or disabled, falls back to in-memory cache.
 */
export class RedisCache {
    config;
    redisClient = null; // ioredis.Redis (optional dependency)
    state = "disconnected";
    memoryCache = new Map();
    accessOrder = []; // For LRU tracking
    // Statistics
    stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0,
        redisHits: 0,
        memoryHits: 0,
        errors: 0,
    };
    // Per-level timing stats
    timingStats = {
        totalAccessTime: 0,
        accessCount: 0,
        avgAccessTime: 0,
    };
    constructor(config) {
        this.config = config;
        if (config.enabled) {
            this.initializeRedis();
        }
    }
    /**
     * Initialize Redis connection (optional)
     * If ioredis is not installed or connection fails, use in-memory fallback
     */
    async initializeRedis() {
        if (this.state !== "disconnected") {
            return;
        }
        this.state = "connecting";
        try {
            // Try to dynamically import ioredis
            const Redis = await this.tryImportIORedis();
            if (Redis) {
                this.redisClient = new Redis(this.config.redis.url, {
                    connectTimeout: this.config.redis.connectTimeout ?? 5000,
                    commandTimeout: this.config.redis.commandTimeout ?? 3000,
                    enableOfflineQueue: this.config.redis.enableOfflineQueue ?? false,
                    enableReadyCheck: this.config.redis.enableReadyCheck ?? true,
                    maxRetriesPerRequest: this.config.redis.maxRetries ?? 3,
                    retryStrategy: (times) => {
                        if (times > (this.config.redis.maxRetries ?? 3)) {
                            return null;
                        }
                        return this.config.redis.retryDelay ?? 100;
                    },
                });
                // Set up event handlers
                this.redisClient.on("connect", () => {
                    this.state = "connected";
                });
                this.redisClient.on("error", (error) => {
                    this.state = "error";
                    this.stats.errors++;
                    console.warn("Redis connection error, falling back to memory:", error.message);
                });
                this.redisClient.on("close", () => {
                    this.state = "disconnected";
                });
                // Wait for connection
                await this.redisClient.connect();
                this.state = "connected";
            }
            else {
                // ioredis not available, use memory fallback
                this.state = "disconnected";
            }
        }
        catch (error) {
            // Connection failed, use memory fallback
            this.state = "error";
            this.stats.errors++;
            console.warn("Redis initialization failed, using in-memory cache:", error);
        }
    }
    /**
     * Try to import ioredis module
     * Returns null if not installed
     */
    async tryImportIORedis() {
        try {
            // Dynamic import - will fail if ioredis is not installed
            // @ts-ignore - ioredis is an optional dependency
            const module = await import("ioredis");
            return module.default || module.Redis;
        }
        catch {
            // ioredis not installed, return null
            return null;
        }
    }
    /**
     * Check if Redis is available
     */
    isRedisAvailable() {
        return this.state === "connected" && this.redisClient !== null;
    }
    /**
     * Get cache key with prefix
     */
    getCacheKey(key) {
        return `${this.config.redis.keyPrefix}${key}`;
    }
    /**
     * Calculate entry score for eviction
     * Combines recency (LRU) and frequency (LFU)
     */
    calculateEvictionScore(entry) {
        const age = Date.now() - entry.lastAccessed;
        const recencyScore = 1 / (age + 1); // More recent = higher score
        const frequencyScore = entry.accessFrequency;
        // Weighted combination
        const weight = this.config.frequencyWeight;
        return weight * frequencyScore + (1 - weight) * recencyScore;
    }
    /**
     * Get entry from cache
     */
    async get(key) {
        const startTime = Date.now();
        try {
            // Try Redis first if available
            if (this.isRedisAvailable()) {
                const redisKey = this.getCacheKey(key);
                const data = await this.redisClient.get(redisKey);
                if (data) {
                    const parsed = JSON.parse(data);
                    // Check expiration
                    if (Date.now() > parsed.expiresAt) {
                        await this.delete(key);
                        this.stats.misses++;
                        return null;
                    }
                    this.stats.hits++;
                    this.stats.redisHits++;
                    // Update access frequency in Redis (fire and forget)
                    this.updateAccessFrequency(redisKey, parsed).catch(() => { });
                    return parsed.entry;
                }
            }
            // Fallback to memory cache
            const memoryEntry = this.memoryCache.get(key);
            if (memoryEntry) {
                // Check expiration
                if (Date.now() > memoryEntry.expiresAt) {
                    this.memoryCache.delete(key);
                    this.removeFromAccessOrder(key);
                    this.stats.misses++;
                    return null;
                }
                // Update access frequency and LRU
                memoryEntry.accessFrequency++;
                memoryEntry.lastAccessed = Date.now();
                this.updateAccessOrder(key);
                this.stats.hits++;
                this.stats.memoryHits++;
                return memoryEntry.entry;
            }
            this.stats.misses++;
            return null;
        }
        catch (error) {
            this.stats.errors++;
            console.warn("RedisCache get error:", error);
            this.stats.misses++;
            return null;
        }
        finally {
            // Track timing
            const elapsed = Date.now() - startTime;
            this.timingStats.totalAccessTime += elapsed;
            this.timingStats.accessCount++;
            this.timingStats.avgAccessTime =
                this.timingStats.totalAccessTime / this.timingStats.accessCount;
        }
    }
    /**
     * Set entry in cache
     */
    async set(key, entry, ttl) {
        const entryTTL = ttl ?? this.config.ttl;
        const now = Date.now();
        const entrySize = JSON.stringify(entry).length;
        try {
            // Try Redis first if available
            if (this.isRedisAvailable()) {
                const redisKey = this.getCacheKey(key);
                const cacheEntry = {
                    entry,
                    expiresAt: now + entryTTL,
                    accessFrequency: 1,
                    lastAccessed: now,
                    size: entrySize,
                };
                await this.redisClient.setex(redisKey, Math.floor(entryTTL / 1000), JSON.stringify(cacheEntry));
                this.stats.sets++;
                return;
            }
            // Check if we need to evict from memory
            if (this.memoryCache.size >= this.config.maxSize) {
                await this.evict();
            }
            // Store in memory cache
            const memoryEntry = {
                entry,
                expiresAt: now + entryTTL,
                accessFrequency: 1,
                lastAccessed: now,
            };
            this.memoryCache.set(key, memoryEntry);
            this.updateAccessOrder(key);
            this.stats.sets++;
        }
        catch (error) {
            this.stats.errors++;
            console.warn("RedisCache set error:", error);
        }
    }
    /**
     * Delete entry from cache
     */
    async delete(key) {
        try {
            // Delete from Redis if available
            if (this.isRedisAvailable()) {
                const redisKey = this.getCacheKey(key);
                await this.redisClient.del(redisKey);
            }
            // Delete from memory cache
            this.memoryCache.delete(key);
            this.removeFromAccessOrder(key);
            this.stats.deletes++;
        }
        catch (error) {
            this.stats.errors++;
            console.warn("RedisCache delete error:", error);
        }
    }
    /**
     * Clear all entries
     */
    async clear() {
        try {
            // Clear Redis if available
            if (this.isRedisAvailable()) {
                const pattern = `${this.config.redis.keyPrefix}*`;
                const keys = await this.redisClient.keys(pattern);
                if (keys.length > 0) {
                    await this.redisClient.del(...keys);
                }
            }
            // Clear memory cache
            this.memoryCache.clear();
            this.accessOrder = [];
            // Reset stats
            this.stats = {
                hits: 0,
                misses: 0,
                sets: 0,
                deletes: 0,
                evictions: 0,
                redisHits: 0,
                memoryHits: 0,
                errors: 0,
            };
            this.timingStats = {
                totalAccessTime: 0,
                accessCount: 0,
                avgAccessTime: 0,
            };
        }
        catch (error) {
            this.stats.errors++;
            console.warn("RedisCache clear error:", error);
        }
    }
    /**
     * Evict entries based on LRU+LFU policy
     */
    async evict() {
        if (this.memoryCache.size === 0) {
            return;
        }
        // Find entry with lowest eviction score
        let worstKey = null;
        let worstScore = Infinity;
        for (const [key, entry] of this.memoryCache.entries()) {
            const score = this.calculateEvictionScore(entry);
            if (score < worstScore) {
                worstScore = score;
                worstKey = key;
            }
        }
        if (worstKey) {
            this.memoryCache.delete(worstKey);
            this.removeFromAccessOrder(worstKey);
            this.stats.evictions++;
        }
    }
    /**
     * Update access frequency in Redis (background operation)
     */
    async updateAccessFrequency(redisKey, entry) {
        if (!this.isRedisAvailable()) {
            return;
        }
        try {
            entry.accessFrequency++;
            entry.lastAccessed = Date.now();
            await this.redisClient.setex(redisKey, Math.floor((entry.expiresAt - Date.now()) / 1000), JSON.stringify(entry));
        }
        catch {
            // Ignore errors for background update
        }
    }
    /**
     * Update access order for LRU
     */
    updateAccessOrder(key) {
        // Remove from current position
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        // Add to end (most recently used)
        this.accessOrder.push(key);
    }
    /**
     * Remove from access order
     */
    removeFromAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
        return {
            size: this.memoryCache.size,
            hitRate,
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            evictions: this.stats.evictions,
            redisHits: this.stats.redisHits,
            memoryHits: this.stats.memoryHits,
            errors: this.stats.errors,
            avgAccessTime: this.timingStats.avgAccessTime,
            state: this.state,
            usingRedis: this.isRedisAvailable(),
        };
    }
    /**
     * Get cache size
     */
    size() {
        return this.memoryCache.size;
    }
    /**
     * Check if Redis is connected
     */
    isConnected() {
        return this.isRedisAvailable();
    }
    /**
     * Disconnect Redis connection
     */
    async disconnect() {
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
            }
            catch {
                // Ignore errors during disconnect
            }
            this.redisClient = null;
        }
        this.state = "disconnected";
    }
    /**
     * Get all keys in memory cache
     */
    keys() {
        return Array.from(this.memoryCache.keys());
    }
    /**
     * Get entry without updating access
     */
    peek(key) {
        const entry = this.memoryCache.get(key);
        return entry?.entry;
    }
    /**
     * Check if key exists
     */
    has(key) {
        return this.memoryCache.has(key);
    }
    /**
     * Get connection state
     */
    getState() {
        return this.state;
    }
}
/**
 * Default Redis cache configuration
 */
export const DEFAULT_REDIS_CACHE_CONFIG = {
    enabled: false, // Disabled by default (requires Redis)
    maxSize: 10000,
    ttl: 3600000, // 1 hour
    lruEnabled: true,
    frequencyWeight: 0.3, // 30% frequency, 70% recency
    redis: {
        url: "redis://localhost:6379",
        keyPrefix: "lsi:cache:",
        connectTimeout: 5000,
        commandTimeout: 3000,
        maxRetries: 3,
        retryDelay: 100,
    },
};
//# sourceMappingURL=RedisCache.js.map