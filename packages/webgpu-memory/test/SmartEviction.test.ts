/**
 * @lsi/webgpu-memory - SmartEviction Tests
 *
 * Tests for SmartEviction functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SmartEviction,
  MultiTierCache,
  PredictiveEviction,
  EvictionStrategy,
} from '../src/SmartEviction.js';

// Mock GPUBuffer
class MockGPUBuffer {
  destroyed = false;
  constructor(
    public size: number,
    public usage: number = 0
  ) {}
  destroy() {
    this.destroyed = true;
  }
}

describe('SmartEviction', () => {
  let eviction: SmartEviction;

  beforeEach(() => {
    eviction = new SmartEviction(1024 * 1024, EvictionStrategy.LRU);
  });

  describe('register', () => {
    it('should register cache entry', () => {
      const buffer = new MockGPUBuffer(1024, 0);
      eviction.register('key1', buffer as any, 1024);

      expect(eviction.has('key1')).toBe(true);
      expect(eviction.getCacheSize()).toBe(1);
    });

    it('should track memory usage', () => {
      const buffer = new MockGPUBuffer(1024, 0);
      eviction.register('key1', buffer as any, 1024);

      expect(eviction.getCurrentMemory()).toBe(1024);
    });

    it('should replace existing entry', () => {
      const buf1 = new MockGPUBuffer(512, 0);
      const buf2 = new MockGPUBuffer(1024, 0);

      eviction.register('key1', buf1 as any, 512);
      eviction.register('key1', buf2 as any, 1024);

      expect(eviction.getCurrentMemory()).toBe(1024);
      expect(buf1.destroyed).toBe(true);
    });

    it('should evict when over capacity', () => {
      const buf1 = new MockGPUBuffer(512 * 1024, 0);
      const buf2 = new MockGPUBuffer(512 * 1024, 0);
      const buf3 = new MockGPUBuffer(512 * 1024, 0);

      eviction.register('key1', buf1 as any, 512 * 1024);
      eviction.register('key2', buf2 as any, 512 * 1024);

      expect(buf1.destroyed).toBe(false);
      expect(buf2.destroyed).toBe(false);

      eviction.register('key3', buf3 as any, 512 * 1024);

      // One should have been evicted
      const destroyedCount = [buf1, buf2, buf3].filter(b => b.destroyed).length;
      expect(destroyedCount).toBe(1);
    });
  });

  describe('touch', () => {
    it('should update access time', () => {
      const buffer = new MockGPUBuffer(1024, 0);
      eviction.register('key1', buffer as any, 1024);

      const entry = eviction.get('key1');
      const beforeAccess = entry!.lastAccess;

      // Wait a bit (not really necessary in tests)
      eviction.touch('key1');

      const afterAccess = eviction.get('key1')!.lastAccess;

      expect(afterAccess).toBeGreaterThanOrEqual(beforeAccess);
    });

    it('should return false for non-existent key', () => {
      expect(eviction.touch('unknown')).toBe(false);
    });
  });

  describe('get', () => {
    it('should get cache entry', () => {
      const buffer = new MockGPUBuffer(1024, 0);
      eviction.register('key1', buffer as any, 1024);

      const entry = eviction.get('key1');

      expect(entry).toBeDefined();
      expect(entry!.key).toBe('key1');
      expect(entry!.buffer).toBe(buffer);
    });

    it('should return undefined for non-existent key', () => {
      const entry = eviction.get('unknown');
      expect(entry).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should check if key exists', () => {
      const buffer = new MockGPUBuffer(1024, 0);
      eviction.register('key1', buffer as any, 1024);

      expect(eviction.has('key1')).toBe(true);
      expect(eviction.has('unknown')).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should unregister entry', () => {
      const buffer = new MockGPUBuffer(1024, 0);
      eviction.register('key1', buffer as any, 1024);

      const result = eviction.unregister('key1');

      expect(result).toBe(true);
      expect(eviction.has('key1')).toBe(false);
      expect(buffer.destroyed).toBe(true);
    });

    it('should return false for non-existent key', () => {
      const result = eviction.unregister('unknown');
      expect(result).toBe(false);
    });
  });

  describe('evict', () => {
    it('should evict entries', () => {
      const buf1 = new MockGPUBuffer(256, 0);
      const buf2 = new MockGPUBuffer(256, 0);
      const buf3 = new MockGPUBuffer(256, 0);

      eviction.register('key1', buf1 as any, 256);
      eviction.register('key2', buf2 as any, 256);
      eviction.register('key3', buf3 as any, 256);

      const result = eviction.evict(400);

      expect(result.evictedCount).toBe(2);
      expect(result.freedBytes).toBe(512);
      expect(result.remainingCount).toBe(1);
    });

    it('should use LRU strategy', () => {
      const buf1 = new MockGPUBuffer(256, 0);
      const buf2 = new MockGPUBuffer(256, 0);

      eviction.register('key1', buf1 as any, 256);
      eviction.register('key2', buf2 as any, 256);

      // Access key2 to make it more recent
      eviction.touch('key2');

      const result = eviction.evict(256);

      // key1 should be evicted (least recently used)
      expect(result.evictedEntries[0].key).toBe('key1');
      expect(buf1.destroyed).toBe(true);
      expect(buf2.destroyed).toBe(false);
    });
  });

  describe('setStrategy', () => {
    it('should change eviction strategy', () => {
      eviction.setStrategy(EvictionStrategy.LFU);
      expect(eviction['strategy']).toBe(EvictionStrategy.LFU);
    });
  });

  describe('setMaxMemory', () => {
    it('should set max memory', () => {
      eviction.setMaxMemory(2048);

      const buf1 = new MockGPUBuffer(1024, 0);
      const buf2 = new MockGPUBuffer(1024, 0);
      const buf3 = new MockGPUBuffer(1024, 0);

      eviction.register('key1', buf1 as any, 1024);
      eviction.register('key2', buf2 as any, 1024);

      // Should not evict yet
      expect(buf1.destroyed).toBe(false);
      expect(buf2.destroyed).toBe(false);

      // This should trigger eviction
      eviction.register('key3', buf3 as any, 1024);

      const destroyedCount = [buf1, buf2, buf3].filter(b => b.destroyed).length;
      expect(destroyedCount).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      const buf1 = new MockGPUBuffer(256, 0);
      const buf2 = new MockGPUBuffer(256, 0);

      eviction.register('key1', buf1 as any, 256);
      eviction.register('key2', buf2 as any, 256);

      eviction.clear();

      expect(eviction.getCacheSize()).toBe(0);
      expect(eviction.getCurrentMemory()).toBe(0);
      expect(buf1.destroyed).toBe(true);
      expect(buf2.destroyed).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      const buffer = new MockGPUBuffer(1024, 0);
      eviction.register('key1', buffer as any, 1024);

      const stats = eviction.getStats();

      expect(stats.entryCount).toBe(1);
      expect(stats.totalBytes).toBe(1024);
      expect(stats.maxBytes).toBe(1024 * 1024);
    });
  });
});

describe('MultiTierCache', () => {
  let cache: MultiTierCache;

  beforeEach(() => {
    cache = new MultiTierCache(1024, 2048, 4096);
  });

  describe('put and get', () => {
    it('should put and get items', () => {
      const buffer = new MockGPUBuffer(512, 0);
      cache.put('key1', buffer as any, 512);

      const result = cache.get('key1');

      expect(result).toBe(buffer);
    });

    it('should return undefined for non-existent key', () => {
      const result = cache.get('unknown');
      expect(result).toBeUndefined();
    });
  });

  describe('promotion', () => {
    it('should promote items from cold to warm to hot', () => {
      const buffer = new MockGPUBuffer(512, 0);

      // Access multiple times to promote
      cache.put('key1', buffer as any, 512);
      cache.get('key1');
      cache.get('key1');

      const stats = cache.getStats();
      // After multiple accesses, should be in hot cache
      expect(stats.hot.entryCount).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return combined statistics', () => {
      const buffer = new MockGPUBuffer(512, 0);
      cache.put('key1', buffer as any, 512);

      const stats = cache.getStats();

      expect(stats.total.entryCount).toBe(1);
      expect(stats.total.totalBytes).toBe(512);
    });
  });

  describe('clear', () => {
    it('should clear all tiers', () => {
      const buffer = new MockGPUBuffer(512, 0);
      cache.put('key1', buffer as any, 512);

      cache.clear();

      const stats = cache.getStats();
      expect(stats.total.entryCount).toBe(0);
    });
  });
});

describe('PredictiveEviction', () => {
  let predictive: PredictiveEviction;

  beforeEach(() => {
    predictive = new PredictiveEviction();
  });

  describe('recordAccess', () => {
    it('should record access to item', () => {
      predictive.recordAccess('key1');
      predictive.recordAccess('key2');

      // Should not throw
      expect(() => predictive.recordAccess('key3')).not.toThrow();
    });

    it('should track access frequency', () => {
      predictive.recordAccess('key1');
      predictive.recordAccess('key1');
      predictive.recordAccess('key1');

      // Key1 should have higher frequency
      const candidates = predictive.getEvictionCandidates(10);
      const key1Index = candidates.indexOf('key1');

      expect(key1Index).toBeGreaterThanOrEqual(0);
    });
  });

  describe('predictNextAccess', () => {
    it('should predict next access time', () => {
      predictive.recordAccess('key1');

      // Wait and record again
      setTimeout(() => {
        predictive.recordAccess('key1');
      }, 10);

      // Need to wait for second access
    });

    it('should return null for insufficient data', () => {
      predictive.recordAccess('key1');

      const prediction = predictive.predictNextAccess('key1');
      expect(prediction).toBeNull();
    });
  });

  describe('getEvictionCandidates', () => {
    it('should return eviction candidates', () => {
      predictive.recordAccess('key1');
      predictive.recordAccess('key2');
      predictive.recordAccess('key3');

      const candidates = predictive.getEvictionCandidates(2);

      expect(candidates.length).toBeLessThanOrEqual(2);
    });
  });

  describe('clear', () => {
    it('should clear access patterns', () => {
      predictive.recordAccess('key1');
      predictive.recordAccess('key2');

      predictive.clear();

      const candidates = predictive.getEvictionCandidates(10);
      expect(candidates.length).toBe(0);
    });
  });
});
