/**
 * Result Cache Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ResultCache,
  EmbeddingCache,
  KernelCache,
  HierarchicalCache,
  type CompiledKernel,
} from '../src/caching/ResultCache.js';

describe('ResultCache', () => {
  let cache: ResultCache;

  beforeEach(() => {
    cache = new ResultCache({
      maxSize: 100,
      similarityThreshold: 0.95,
      ttl: 60000,
      persistent: false,
    });
  });

  describe('constructor', () => {
    it('should create cache with config', () => {
      const c = new ResultCache({
        maxSize: 1000,
        similarityThreshold: 0.9,
        ttl: 300000,
        persistent: true,
      });

      expect(c).toBeDefined();
    });
  });

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      const embedding = new Float32Array([1, 2, 3, 4]);

      cache.set('key1', embedding);
      const result = cache.get('key1');

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Float32Array);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should update hit rate on cache hit', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.get('key1');

      const stats = cache.stats();

      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBe(1);
    });

    it('should update miss count on cache miss', () => {
      cache.get('nonexistent');

      const stats = cache.stats();

      expect(stats.misses).toBe(1);
    });

    it('should track hit rate correctly', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.get('key1');
      cache.get('key2');

      const stats = cache.stats();

      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);

      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should return false for expired entries', () => {
      const c = new ResultCache({
        maxSize: 100,
        similarityThreshold: 0.95,
        ttl: 10, // 10ms TTL
        persistent: false,
      });

      const embedding = new Float32Array([1, 2, 3]);
      c.set('key1', embedding);

      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(c.has('key1')).toBe(false);
          resolve(null);
        }, 20);
      });
    });
  });

  describe('invalidate', () => {
    it('should remove entry from cache', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.invalidate('key1');

      expect(cache.get('key1')).toBeNull();
    });

    it('should update cache size', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.invalidate('key1');

      const stats = cache.stats();

      expect(stats.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.set('key2', embedding);
      cache.clear();

      const stats = cache.stats();

      expect(stats.size).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should reset statistics', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.get('key1');

      cache.clear();

      const stats = cache.stats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('findSimilar', () => {
    it('should find similar embeddings', () => {
      const embedding1 = new Float32Array([1, 2, 3, 4]);
      const embedding2 = new Float32Array([1, 2, 3, 4.1]); // Very similar

      cache.set('key1', embedding1);
      cache.set('key2', embedding2);

      const similar = cache.findSimilar(embedding1);

      expect(similar.length).toBeGreaterThan(0);
    });

    it('should return empty array if no similar embeddings', () => {
      const embedding1 = new Float32Array([1, 2, 3, 4]);
      const embedding2 = new Float32Array([100, 200, 300, 400]); // Very different

      cache.set('key1', embedding1);

      const similar = cache.findSimilar(embedding2);

      expect(similar.length).toBe(0);
    });
  });

  describe('stats', () => {
    it('should return cache statistics', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);

      const stats = cache.stats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('evictions');
      expect(stats).toHaveProperty('memoryUsage');
    });

    it('should calculate memory usage correctly', () => {
      const embedding = new Float32Array([1, 2, 3, 4]);

      cache.set('key1', embedding);

      const stats = cache.stats();

      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      expect(() => cache.dispose()).not.toThrow();
    });
  });
});

describe('EmbeddingCache', () => {
  let cache: EmbeddingCache;

  beforeEach(() => {
    cache = new EmbeddingCache({
      maxSize: 100,
      similarityThreshold: 0.95,
    });
  });

  describe('getCache', () => {
    it('should create cache for layer', () => {
      const layerCache = cache.getCache('encoder');

      expect(layerCache).toBeDefined();
    });

    it('should reuse existing cache for layer', () => {
      const c1 = cache.getCache('encoder');
      const c2 = cache.getCache('encoder');

      expect(c1).toBe(c2);
    });
  });

  describe('set and get', () => {
    it('should set and get embeddings for layer', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('encoder', 'key1', embedding);
      const result = cache.get('encoder', 'key1');

      expect(result).toBeDefined();
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('encoder', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return stats for all layers', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('encoder', 'key1', embedding);
      cache.set('decoder', 'key2', embedding);

      const stats = cache.getStats();

      expect(stats).toHaveProperty('encoder');
      expect(stats).toHaveProperty('decoder');
    });
  });

  describe('clear', () => {
    it('should clear all layer caches', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('encoder', 'key1', embedding);
      cache.clear();

      const result = cache.get('encoder', 'key1');

      expect(result).toBeNull();
    });
  });
});

describe('KernelCache', () => {
  let cache: KernelCache;

  beforeEach(() => {
    cache = new KernelCache();
  });

  describe('get and set', () => {
    it('should store and retrieve kernels', () => {
      const mockKernel: CompiledKernel = {
        module: {} as GPUShaderModule,
        pipeline: {} as GPUComputePipeline,
        workgroupSize: [16, 16, 1],
        bindGroupLayout: {} as GPUBindGroupLayout,
      };

      cache.set('kernel1', mockKernel);
      const result = cache.get('kernel1');

      expect(result).toBeDefined();
      expect(result?.workgroupSize).toEqual([16, 16, 1]);
    });

    it('should return null for non-existent kernels', () => {
      const result = cache.get('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('has', () => {
    it('should return true for cached kernels', () => {
      const mockKernel: CompiledKernel = {
        module: {} as GPUShaderModule,
        pipeline: {} as GPUComputePipeline,
        workgroupSize: [16, 16, 1],
        bindGroupLayout: {} as GPUBindGroupLayout,
      };

      cache.set('kernel1', mockKernel);

      expect(cache.has('kernel1')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear cache', () => {
      const mockKernel: CompiledKernel = {
        module: { destroy: vi.fn() } as unknown as GPUShaderModule,
        pipeline: { destroy: vi.fn() } as unknown as GPUComputePipeline,
        workgroupSize: [16, 16, 1],
        bindGroupLayout: {} as GPUBindGroupLayout,
      };

      cache.set('kernel1', mockKernel);
      cache.clear();

      expect(cache.get('kernel1')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const mockKernel: CompiledKernel = {
        module: {} as GPUShaderModule,
        pipeline: {} as GPUComputePipeline,
        workgroupSize: [16, 16, 1],
        bindGroupLayout: {} as GPUBindGroupLayout,
      };

      cache.set('kernel1', mockKernel);
      cache.get('kernel1');

      const stats = cache.getStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });
  });

  describe('generateKey', () => {
    it('should generate cache key from source and params', () => {
      const key = cache.generateKey('shader source', { size: 1024 });

      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should generate same key for same inputs', () => {
      const key1 = cache.generateKey('source', { param: 1 });
      const key2 = cache.generateKey('source', { param: 1 });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = cache.generateKey('source', { param: 1 });
      const key2 = cache.generateKey('source', { param: 2 });

      expect(key1).not.toBe(key2);
    });
  });
});

describe('HierarchicalCache', () => {
  let cache: HierarchicalCache;

  beforeEach(() => {
    cache = new HierarchicalCache({
      l1Config: {
        maxSize: 10,
        similarityThreshold: 0.95,
        ttl: 60000,
        persistent: false,
      },
      l2Config: {
        maxSize: 100,
        similarityThreshold: 0.9,
        ttl: 300000,
        persistent: false,
      },
    });
  });

  describe('get and set', () => {
    it('should store in both L1 and L2', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);

      const stats = cache.getStats();

      expect(stats.l1.size).toBe(1);
      expect(stats.l2?.size).toBe(1);
    });

    it('should check L1 first', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.get('key1');

      const stats = cache.getStats();

      expect(stats.l1Hits).toBe(1);
      expect(stats.l2Hits).toBe(0);
    });

    it('should promote from L2 to L1 on miss', () => {
      const embedding = new Float32Array([1, 2, 3]);

      // Set in cache
      cache.set('key1', embedding);

      // Clear L1 to force L2 lookup
      cache['l1'].clear();

      // Get should find in L2 and promote to L1
      const result = cache.get('key1');

      expect(result).toBeDefined();

      const stats = cache.getStats();
      expect(stats.l2Hits).toBe(1);
      expect(stats.l1.size).toBe(1);
    });
  });

  describe('invalidate', () => {
    it('should invalidate from both levels', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.invalidate('key1');

      const stats = cache.getStats();

      expect(stats.l1.size).toBe(0);
      expect(stats.l2?.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all levels', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.clear();

      const stats = cache.getStats();

      expect(stats.l1.size).toBe(0);
      expect(stats.l2?.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return aggregated statistics', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.get('key1');

      const stats = cache.getStats();

      expect(stats).toHaveProperty('l1');
      expect(stats).toHaveProperty('l2');
      expect(stats).toHaveProperty('l1Hits');
      expect(stats).toHaveProperty('l2Hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('overallHitRate');
    });

    it('should calculate overall hit rate', () => {
      const embedding = new Float32Array([1, 2, 3]);

      cache.set('key1', embedding);
      cache.get('key1');
      cache.get('key2');

      const stats = cache.getStats();

      expect(stats.overallHitRate).toBe(0.5);
    });
  });
});
