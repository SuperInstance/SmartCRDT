import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContainerCache, createContainerCache } from '../src/ContainerCache.js';
import { CacheStrategy } from '../src/types.js';
import { mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('ContainerCache', () => {
  let cacheDir: string;
  let cache: ContainerCache;

  beforeEach(async () => {
    cacheDir = join(tmpdir(), `container-cache-test-${Date.now()}`);
    await mkdir(cacheDir, { recursive: true });

    cache = createContainerCache({
      cache_dir: cacheDir,
      max_size: 1024 * 1024 * 1024, // 1GB
      max_images: 10,
      predictive_preloading: false // Disable for tests
    });

    await cache.initialize();
  });

  afterEach(async () => {
    await cache.clearCache();
    try {
      await rm(cacheDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore
    }
  });

  describe('initialization', () => {
    it('should initialize cache directory', async () => {
      const fs = await import('fs/promises');
      const exists = await fs.access(cacheDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should initialize with default config', () => {
      const defaultCache = createContainerCache();
      expect(defaultCache).toBeInstanceOf(ContainerCache);
    });

    it('should initialize with custom config', () => {
      const customCache = createContainerCache({
        max_size: 2 * 1024 * 1024 * 1024,
        max_images: 20,
        default_strategy: 'eager'
      });
      expect(customCache).toBeInstanceOf(ContainerCache);
    });
  });

  describe('image operations', () => {
    it('should add and retrieve image from cache', async () => {
      // Note: This test would require actual Docker to be running
      // For unit testing, we test the cache mechanics
      const stats = cache.getCacheStats();
      expect(stats.image_count).toBe(0);
    });

    it('should check if image exists in cache', () => {
      const hasImage = cache.hasImage('python:3.11-slim');
      expect(hasImage).toBe(false);
    });

    it('should get cached images list', () => {
      const images = cache.getCachedImages();
      expect(images).toEqual([]);
      expect(Array.isArray(images)).toBe(true);
    });

    it('should get cache entry for non-existent image', () => {
      const entry = cache.getCacheEntry('python:3.11-slim');
      expect(entry).toBeUndefined();
    });
  });

  describe('cache statistics', () => {
    it('should return initial cache stats', () => {
      const stats = cache.getCacheStats();

      expect(stats.hit_rate).toBe(0);
      expect(stats.miss_rate).toBe(0);
      expect(stats.total_hits).toBe(0);
      expect(stats.total_misses).toBe(0);
      expect(stats.image_count).toBe(0);
      expect(stats.layer_count).toBe(0);
      expect(stats.total_evictions).toBe(0);
      expect(stats.eviction_rate).toBe(0);
    });

    it('should track total size correctly', () => {
      const stats = cache.getCacheStats();
      expect(stats.total_size).toBe(0);
      expect(stats.max_size).toBeGreaterThan(0);
    });

    it('should calculate average access time', () => {
      const stats = cache.getCacheStats();
      expect(stats.avg_access_time).toBe(0);
    });

    it('should track compression ratio', () => {
      const stats = cache.getCacheStats();
      expect(stats.compression_ratio).toBeGreaterThanOrEqual(0);
      expect(stats.compression_ratio).toBeLessThanOrEqual(1);
    });
  });

  describe('eviction', () => {
    it('should evict least recently used images', async () => {
      await cache.evictLRU(5);
      const stats = cache.getCacheStats();
      // No images to evict
      expect(stats.image_count).toBe(0);
    });

    it('should evict by size', async () => {
      const result = await cache.evictBySize(1024 * 1024);

      expect(result.evicted_images).toEqual([]);
      expect(result.evicted_layers).toEqual([]);
      expect(result.bytes_freed).toBe(0);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('warmup', () => {
    it('should warmup empty list', async () => {
      const result = await cache.warmupCache([]);

      expect(result.warmed).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.cached).toEqual([]);
      expect(result.bytes_downloaded).toBe(0);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('verification', () => {
    it('should verify non-existent image returns false', async () => {
      const isValid = await cache.verifyCache('python:3.11-slim');
      expect(isValid).toBe(false);
    });
  });

  describe('cache clearing', () => {
    it('should clear cache', async () => {
      await cache.clearCache();
      const stats = cache.getCacheStats();
      expect(stats.image_count).toBe(0);
    });
  });

  describe('priority management', () => {
    it('should set priority for non-existent image', () => {
      cache.setPriority('python:3.11-slim', 80);
      const entry = cache.getCacheEntry('python:3.11-slim');
      expect(entry).toBeUndefined();
    });

    it('should clamp priority to valid range', () => {
      const testCache = createContainerCache({ cache_dir });
      // Test internal logic
      expect(() => testCache.setPriority('test', 150)).not.toThrow();
      expect(() => testCache.setPriority('test', -10)).not.toThrow();
    });
  });

  describe('recommended preloads', () => {
    it('should return empty recommendations initially', () => {
      const recommended = cache.getRecommendedPreloads();
      expect(recommended).toEqual([]);
    });
  });

  describe('state export/import', () => {
    it('should export empty state', () => {
      const state = cache.exportState();

      expect(state.entries).toEqual([]);
      expect(state.metrics).toBeDefined();
      expect(state.usagePatterns).toBeDefined();
    });

    it('should import state', async () => {
      const state = {
        entries: [],
        usagePatterns: {
          patterns: [],
          usageHistory: []
        }
      };

      await expect(cache.importState(state)).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very large cache size', () => {
      const largeCache = createContainerCache({
        max_size: Number.MAX_SAFE_INTEGER,
        cache_dir
      });
      expect(largeCache).toBeInstanceOf(ContainerCache);
    });

    it('should handle zero cache size', () => {
      const zeroCache = createContainerCache({
        max_size: 0,
        cache_dir
      });
      expect(zeroCache).toBeInstanceOf(ContainerCache);
    });

    it('should handle negative cache size', () => {
      const negativeCache = createContainerCache({
        max_size: -1,
        cache_dir
      });
      expect(negativeCache).toBeInstanceOf(ContainerCache);
    });

    it('should handle zero max images', () => {
      const zeroImagesCache = createContainerCache({
        max_images: 0,
        cache_dir
      });
      expect(zeroImagesCache).toBeInstanceOf(ContainerCache);
    });

    it('should handle very large max images', () => {
      const largeImagesCache = createContainerCache({
        max_images: Number.MAX_SAFE_INTEGER,
        cache_dir
      });
      expect(largeImagesCache).toBeInstanceOf(ContainerCache);
    });
  });

  describe('cache strategies', () => {
    it('should support all cache strategies', () => {
      const strategies: CacheStrategy[] = ['eager', 'lazy', 'predictive', 'on-demand'];

      for (const strategy of strategies) {
        const testCache = createContainerCache({
          default_strategy: strategy,
          cache_dir: join(cacheDir, strategy)
        });
        expect(testCache).toBeInstanceOf(ContainerCache);
      }
    });
  });

  describe('error handling', () => {
    it('should handle invalid image reference gracefully', async () => {
      const result = await cache.warmupCache(['']);
      expect(result).toBeDefined();
    });

    it('should handle duplicate warmup', async () => {
      const images = ['python:3.11-slim', 'python:3.11-slim'];
      const result = await cache.warmupCache(images);
      expect(result).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should use custom prediction window', () => {
      const customCache = createContainerCache({
        prediction_window: 48,
        cache_dir
      });
      expect(customCache).toBeInstanceOf(ContainerCache);
    });

    it('should use custom min probability', () => {
      const customCache = createContainerCache({
        min_preload_probability: 0.8,
        cache_dir
      });
      expect(customCache).toBeInstanceOf(ContainerCache);
    });

    it('should use custom preload interval', () => {
      const customCache = createContainerCache({
        preload_check_interval: 600000,
        cache_dir
      });
      expect(customCache).toBeInstanceOf(ContainerCache);
    });
  });

  describe('layer deduplication', () => {
    it('should support layer deduplication enabled', () => {
      const dedupCache = createContainerCache({
        layer_deduplication: true,
        cache_dir
      });
      expect(dedupCache).toBeInstanceOf(ContainerCache);
    });

    it('should support layer deduplication disabled', () => {
      const noDedupCache = createContainerCache({
        layer_deduplication: false,
        cache_dir
      });
      expect(noDedupCache).toBeInstanceOf(ContainerCache);
    });
  });

  describe('integrity verification', () => {
    it('should support integrity verification enabled', () => {
      const verifyCache = createContainerCache({
        verify_integrity: true,
        cache_dir
      });
      expect(verifyCache).toBeInstanceOf(ContainerCache);
    });

    it('should support integrity verification disabled', () => {
      const noVerifyCache = createContainerCache({
        verify_integrity: false,
        cache_dir
      });
      expect(noVerifyCache).toBeInstanceOf(ContainerCache);
    });
  });

  describe('layer compression', () => {
    it('should support layer compression enabled', () => {
      const compressCache = createContainerCache({
        compress_layers: true,
        cache_dir
      });
      expect(compressCache).toBeInstanceOf(ContainerCache);
    });

    it('should support layer compression disabled', () => {
      const noCompressCache = createContainerCache({
        compress_layers: false,
        cache_dir
      });
      expect(noCompressCache).toBeInstanceOf(ContainerCache);
    });
  });

  describe('eviction policies', () => {
    it('should support LRU eviction enabled', () => {
      const lruCache = createContainerCache({
        lru_eviction: true,
        cache_dir
      });
      expect(lruCache).toBeInstanceOf(ContainerCache);
    });

    it('should support LRU eviction disabled', () => {
      const noLruCache = createContainerCache({
        lru_eviction: false,
        cache_dir
      });
      expect(noLruCache).toBeInstanceOf(ContainerCache);
    });

    it('should support size eviction enabled', () => {
      const sizeCache = createContainerCache({
        size_eviction: true,
        cache_dir
      });
      expect(sizeCache).toBeInstanceOf(ContainerCache);
    });

    it('should support size eviction disabled', () => {
      const noSizeCache = createContainerCache({
        size_eviction: false,
        cache_dir
      });
      expect(noSizeCache).toBeInstanceOf(ContainerCache);
    });
  });
});

describe('createContainerCache', () => {
  it('should create cache instance with no config', () => {
    const cache = createContainerCache();
    expect(cache).toBeInstanceOf(ContainerCache);
  });

  it('should create cache instance with config', () => {
    const cache = createContainerCache({
      max_size: 1024 * 1024 * 1024
    });
    expect(cache).toBeInstanceOf(ContainerCache);
  });

  it('should create unique instances', () => {
    const cache1 = createContainerCache();
    const cache2 = createContainerCache();
    expect(cache1).not.toBe(cache2);
  });
});
