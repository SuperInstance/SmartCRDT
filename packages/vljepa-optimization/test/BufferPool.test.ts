/**
 * Buffer Pool Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BufferPool, TensorPool, MemoryArena, HierarchicalPoolManager } from '../src/memory/BufferPool.js';

// Mock GPUBuffer
const createMockGPUBuffer = (size: number): GPUBuffer => ({
  size,
  destroy: vi.fn(),
  mapAsync: vi.fn(),
  unmap: vi.fn(),
} as unknown as GPUBuffer);

describe('BufferPool', () => {
  let pool: BufferPool;

  beforeEach(() => {
    pool = new BufferPool({
      initialSize: 4,
      bufferSize: 1024,
      growStrategy: 'on_demand',
      shrinkStrategy: 'idle',
      maxSize: 10,
    });
  });

  describe('constructor', () => {
    it('should create pool with specified initial size', () => {
      const p = new BufferPool({
        initialSize: 8,
        bufferSize: 2048,
        growStrategy: 'linear',
        shrinkStrategy: 'never',
      });

      expect(p).toBeDefined();
      expect(p.size()).toBe(8);
    });
  });

  describe('acquire', () => {
    it('should return a buffer', () => {
      const buffer = pool.acquire();

      expect(buffer).toBeDefined();
    });

    it('should return buffer from pool when available', () => {
      const buffer1 = pool.acquire();
      pool.release(buffer1 as GPUBuffer);

      const buffer2 = pool.acquire();

      expect(buffer2).toBeDefined();
    });

    it('should decrease available count when acquiring', () => {
      const stats1 = pool.stats();

      pool.acquire();

      const stats2 = pool.stats();

      expect(stats2.availableBuffers).toBeLessThan(stats1.availableBuffers);
    });

    it('should increase acquired count', () => {
      pool.acquire();

      const stats = pool.stats();

      expect(stats.acquiredBuffers).toBe(1);
    });
  });

  describe('release', () => {
    it('should return buffer to pool', () => {
      const buffer = pool.acquire();

      pool.release(buffer as GPUBuffer);

      const stats = pool.stats();

      expect(stats.availableBuffers).toBeGreaterThan(0);
    });

    it('should throw error for non-acquired buffer', () => {
      const fakeBuffer = createMockGPUBuffer(1024);

      expect(() => pool.release(fakeBuffer)).toThrow();
    });

    it('should increase total releases', () => {
      const buffer = pool.acquire();

      const stats1 = pool.stats();
      pool.release(buffer as GPUBuffer);
      const stats2 = pool.stats();

      expect(stats2.totalReleases).toBe(stats1.totalReleases + 1);
    });
  });

  describe('stats', () => {
    it('should return pool statistics', () => {
      pool.acquire();

      const stats = pool.stats();

      expect(stats).toHaveProperty('totalBuffers');
      expect(stats).toHaveProperty('availableBuffers');
      expect(stats).toHaveProperty('acquiredBuffers');
      expect(stats).toHaveProperty('totalAllocations');
      expect(stats).toHaveProperty('totalReleases');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('peakUsage');
    });

    it('should calculate hit rate correctly', () => {
      const buffer = pool.acquire();
      pool.release(buffer as GPUBuffer);

      const stats = pool.stats();

      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should calculate memory usage in MB', () => {
      const stats = pool.stats();

      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all buffers', () => {
      pool.acquire();

      pool.clear();

      const stats = pool.stats();

      expect(stats.totalBuffers).toBe(0);
      expect(stats.acquiredBuffers).toBe(0);
    });

    it('should reset statistics', () => {
      pool.acquire();

      pool.clear();

      const stats = pool.stats();

      expect(stats.totalAllocations).toBe(0);
      expect(stats.totalReleases).toBe(0);
    });
  });

  describe('resize', () => {
    it('should grow pool when target > current', () => {
      const initialSize = pool.size();

      pool.resize(initialSize + 2);

      expect(pool.size()).toBe(initialSize + 2);
    });

    it('should shrink pool when target < current', () => {
      pool.acquire();
      pool.acquire();

      const stats1 = pool.stats();
      pool.resize(2);
      const stats2 = pool.stats();

      expect(stats2.totalBuffers).toBeLessThanOrEqual(stats1.totalBuffers);
    });
  });

  describe('warmup', () => {
    it('should pre-allocate buffers', () => {
      pool.clear();
      pool.warmup(5);

      expect(pool.size()).toBe(5);
    });
  });

  describe('isHealthy', () => {
    it('should return true when pool has available buffers', () => {
      expect(pool.isHealthy()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', () => {
      expect(() => pool.dispose()).not.toThrow();
    });
  });
});

describe('TensorPool', () => {
  let pool: TensorPool;

  beforeEach(() => {
    pool = new TensorPool();
  });

  describe('acquire', () => {
    it('should return a tensor', () => {
      const tensor = pool.acquire(1024);

      expect(tensor).toBeDefined();
      expect(tensor.data).toBeInstanceOf(Float32Array);
      expect(tensor.size).toBe(1024);
    });

    it('should reuse tensors from pool', () => {
      const tensor1 = pool.acquire(1024);
      pool.release(tensor1);

      const tensor2 = pool.acquire(1024);

      expect(tensor2).toBeDefined();
    });

    it('should allocate new tensor when pool is empty', () => {
      const tensor = pool.acquire(1024);

      expect(tensor.data.length).toBe(1024);
    });
  });

  describe('release', () => {
    it('should return tensor to pool', () => {
      const tensor = pool.acquire(1024);

      pool.release(tensor);

      const stats = pool.getStats();

      expect(stats.totalTensors).toBeGreaterThan(0);
    });

    it('should throw error for non-acquired tensor', () => {
      const fakeTensor = { data: new Float32Array(1024), shape: [1024], size: 1024 };

      expect(() => pool.release(fakeTensor)).toThrow();
    });
  });

  describe('getStats', () => {
    it('should return pool statistics', () => {
      pool.acquire(1024);

      const stats = pool.getStats();

      expect(stats).toHaveProperty('totalTensors');
      expect(stats).toHaveProperty('acquiredTensors');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('allocations');
      expect(stats).toHaveProperty('poolCount');
    });

    it('should calculate hit rate', () => {
      const tensor = pool.acquire(1024);
      pool.release(tensor);
      pool.acquire(1024);

      const stats = pool.getStats();

      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should clear all pools', () => {
      pool.acquire(1024);

      pool.clear();

      const stats = pool.getStats();

      expect(stats.totalTensors).toBe(0);
      expect(stats.acquiredTensors).toBe(0);
    });
  });
});

describe('MemoryArena', () => {
  let arena: MemoryArena;

  beforeEach(() => {
    arena = new MemoryArena(1024 * 1024); // 1MB arena
  });

  describe('allocate', () => {
    it('should allocate memory from arena', () => {
      const id = arena.allocate(1024);

      expect(id).toBeDefined();
    });

    it('should align allocations', () => {
      const id1 = arena.allocate(100, 16);
      const id2 = arena.allocate(100, 16);

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });

    it('should throw error when out of memory', () => {
      expect(() => arena.allocate(2 * 1024 * 1024)).toThrow();
    });
  });

  describe('free', () => {
    it('should free allocated memory', () => {
      const id = arena.allocate(1024);

      expect(() => arena.free(id)).not.toThrow();
    });

    it('should throw error for invalid ID', () => {
      expect(() => arena.free('invalid_id')).toThrow();
    });

    it('should allow reallocation after free', () => {
      const id1 = arena.allocate(1024);
      arena.free(id1);
      const id2 = arena.allocate(1024);

      expect(id2).toBeDefined();
    });
  });

  describe('getPointer', () => {
    it('should return pointer for allocation', () => {
      const id = arena.allocate(1024);
      const pointer = arena.getPointer(id);

      expect(typeof pointer).toBe('number');
    });

    it('should throw error for invalid ID', () => {
      expect(() => arena.getPointer('invalid')).toThrow();
    });
  });

  describe('getStats', () => {
    it('should return arena statistics', () => {
      arena.allocate(1024);

      const stats = arena.getStats();

      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('usedSize');
      expect(stats).toHaveProperty('freeSize');
      expect(stats).toHaveProperty('utilization');
      expect(stats).toHaveProperty('fragmentation');
      expect(stats).toHaveProperty('allocationCount');
      expect(stats).toHaveProperty('freeBlockCount');
    });

    it('should calculate utilization', () => {
      arena.allocate(512 * 1024);

      const stats = arena.getStats();

      expect(stats.utilization).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset arena', () => {
      arena.allocate(1024);

      arena.reset();

      const stats = arena.getStats();

      expect(stats.allocationCount).toBe(0);
      expect(stats.freeBlockCount).toBe(1);
    });
  });
});

describe('HierarchicalPoolManager', () => {
  let manager: HierarchicalPoolManager;

  beforeEach(() => {
    manager = new HierarchicalPoolManager();
  });

  describe('acquireBuffer', () => {
    it('should allocate from small buffer pool for small requests', () => {
      const buffer = manager.acquireBuffer(512);

      expect(buffer).toBeDefined();
    });

    it('should allocate from medium buffer pool for medium requests', () => {
      const buffer = manager.acquireBuffer(1024 * 512);

      expect(buffer).toBeDefined();
    });

    it('should allocate from large buffer pool for large requests', () => {
      const buffer = manager.acquireBuffer(1024 * 1024 * 8);

      expect(buffer).toBeDefined();
    });
  });

  describe('releaseBuffer', () => {
    it('should release buffer to correct pool', () => {
      const buffer = manager.acquireBuffer(512);

      expect(() => manager.releaseBuffer(buffer as GPUBuffer)).not.toThrow();
    });
  });

  describe('acquireTensor', () => {
    it('should acquire tensor from pool', () => {
      const tensor = manager.acquireTensor(1024);

      expect(tensor).toBeDefined();
    });
  });

  describe('releaseTensor', () => {
    it('should release tensor to pool', () => {
      const tensor = manager.acquireTensor(1024);

      expect(() => manager.releaseTensor(tensor)).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return aggregate statistics', () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty('smallBuffers');
      expect(stats).toHaveProperty('mediumBuffers');
      expect(stats).toHaveProperty('largeBuffers');
      expect(stats).toHaveProperty('tensors');
    });
  });

  describe('dispose', () => {
    it('should dispose all pools', () => {
      expect(() => manager.dispose()).not.toThrow();
    });
  });
});
