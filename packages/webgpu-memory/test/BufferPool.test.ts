/**
 * @lsi/webgpu-memory - BufferPool Tests
 *
 * Tests for BufferPool functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BufferPool, PoolStrategy, createMultiTypePools } from '../src/BufferPool.js';
import type { MemoryType } from '../src/types.js';

// Mock GPUDevice
class MockGPUBuffer {
  destroyed = false;
  constructor(
    public size: number,
    public usage: number
  ) {}
  destroy() {
    this.destroyed = true;
  }
}

class MockGPUDevice {
  createBuffer(descriptor: { size: number; usage: number }) {
    return new MockGPUBuffer(descriptor.size, descriptor.usage);
  }
}

describe('BufferPool', () => {
  let device: MockGPUDevice;

  beforeEach(() => {
    device = new MockGPUDevice();
  });

  describe('Construction', () => {
    it('should create pool with default config', () => {
      const pool = new BufferPool(device as any);

      expect(pool).toBeDefined();
      const stats = pool.getStats();
      expect(stats.totalSize).toBe(16 * 1024 * 1024);
    });

    it('should create pool with custom config', () => {
      const pool = new BufferPool(device as any, {
        size: 8 * 1024 * 1024,
        memoryType: 'host_visible',
        strategy: PoolStrategy.FirstFit,
        label: 'test_pool',
      });

      expect(pool).toBeDefined();
      const stats = pool.getStats();
      expect(stats.totalSize).toBe(8 * 1024 * 1024);
    });
  });

  describe('allocate', () => {
    it('should allocate from pool', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      const allocation = pool.allocate(1024);

      expect(allocation).toBeDefined();
      expect(allocation.size).toBe(1024);
      expect(allocation.buffer).toBeInstanceOf(MockGPUBuffer);
      expect(allocation.buffer.destroyed).toBe(false);
    });

    it('should align allocation size', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      const allocation = pool.allocate(1000, 256);

      expect(allocation.size).toBe(1024); // Aligned to 256
    });

    it('should allocate multiple blocks', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      const alloc1 = pool.allocate(1024);
      const alloc2 = pool.allocate(1024);
      const alloc3 = pool.allocate(1024);

      expect(alloc1.buffer).toBeDefined();
      expect(alloc2.buffer).toBeDefined();
      expect(alloc3.buffer).toBeDefined();
    });

    it('should throw when pool is full', () => {
      const pool = new BufferPool(device as any, { size: 2048 });

      pool.allocate(1024);
      pool.allocate(512);

      expect(() => {
        pool.allocate(1024);
      }).toThrow();
    });
  });

  describe('free', () => {
    it('should free allocation back to pool', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      const allocation = pool.allocate(1024);
      const stats1 = pool.getStats();

      pool.free(allocation);
      const stats2 = pool.getStats();

      expect(allocation.buffer.destroyed).toBe(true);
      expect(stats2.allocationCount).toBe(stats1.allocationCount - 1);
    });

    it('should reuse freed memory', () => {
      const pool = new BufferPool(device as any, { size: 2048 });

      const alloc1 = pool.allocate(1024);
      pool.free(alloc1);

      const alloc2 = pool.allocate(1024);

      expect(alloc2).toBeDefined();
      expect(alloc2.size).toBe(1024);
    });

    it('should throw when freeing wrong allocation', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      const otherPool = new BufferPool(device as any, { size: 4096 });
      const allocation = otherPool.allocate(1024);

      expect(() => {
        pool.free(allocation);
      }).toThrow();
    });
  });

  describe('Pool Strategies', () => {
    it('should use first-fit strategy', () => {
      const pool = new BufferPool(device as any, {
        size: 4096,
        strategy: PoolStrategy.FirstFit,
      });

      const alloc = pool.allocate(1024);
      expect(alloc).toBeDefined();
    });

    it('should use best-fit strategy', () => {
      const pool = new BufferPool(device as any, {
        size: 4096,
        strategy: PoolStrategy.BestFit,
      });

      const alloc = pool.allocate(1024);
      expect(alloc).toBeDefined();
    });

    it('should use worst-fit strategy', () => {
      const pool = new BufferPool(device as any, {
        size: 4096,
        strategy: PoolStrategy.WorstFit,
      });

      const alloc = pool.allocate(1024);
      expect(alloc).toBeDefined();
    });
  });

  describe('grow', () => {
    it('should grow pool size', () => {
      const pool = new BufferPool(device as any, { size: 2048 });

      pool.grow(2048);

      const stats = pool.getStats();
      expect(stats.totalSize).toBe(4096);
    });

    it('should allow allocations after growing', () => {
      const pool = new BufferPool(device as any, { size: 2048 });

      pool.allocate(1024);
      pool.grow(2048);

      const alloc = pool.allocate(2048);
      expect(alloc).toBeDefined();
    });
  });

  describe('shrink', () => {
    it('should shrink pool size', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      const reduction = pool.shrink(2048);

      expect(reduction).toBe(2048);
      const stats = pool.getStats();
      expect(stats.totalSize).toBe(2048);
    });

    it('should throw when shrinking with allocations at end', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      pool.allocate(2048);

      expect(() => {
        pool.shrink(2048);
      }).toThrow();
    });
  });

  describe('getStats', () => {
    it('should return pool statistics', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      pool.allocate(1024);
      pool.allocate(512);

      const stats = pool.getStats();

      expect(stats.poolId).toBeDefined();
      expect(stats.totalSize).toBe(4096);
      expect(stats.allocationCount).toBe(2);
      expect(stats.utilization).toBeGreaterThan(0);
    });
  });

  describe('hasSpace', () => {
    it('should check if pool has space', () => {
      const pool = new BufferPool(device as any, { size: 2048 });

      expect(pool.hasSpace(1024)).toBe(true);
      expect(pool.hasSpace(2048)).toBe(true);
      expect(pool.hasSpace(4096)).toBe(false);
    });

    it('should account for existing allocations', () => {
      const pool = new BufferPool(device as any, { size: 2048 });

      pool.allocate(1024);

      expect(pool.hasSpace(512)).toBe(true);
      expect(pool.hasSpace(1024)).toBe(false);
    });
  });

  describe('getLargestFreeBlock', () => {
    it('should return largest free block size', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      expect(pool.getLargestFreeBlock()).toBe(4096);

      pool.allocate(1024);
      expect(pool.getLargestFreeBlock()).toBe(3072);
    });

    it('should return 0 when pool is full', () => {
      const pool = new BufferPool(device as any, { size: 2048 });

      pool.allocate(2048);

      expect(pool.getLargestFreeBlock()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset pool to initial state', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      pool.allocate(1024);
      pool.allocate(2048);

      let stats = pool.getStats();
      expect(stats.allocationCount).toBe(2);

      pool.reset();

      stats = pool.getStats();
      expect(stats.allocationCount).toBe(0);
      expect(stats.freeBytes).toBe(4096);
    });
  });

  describe('destroy', () => {
    it('should destroy all buffers', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      const alloc1 = pool.allocate(1024);
      const alloc2 = pool.allocate(1024);

      pool.destroy();

      expect(alloc1.buffer.destroyed).toBe(true);
      expect(alloc2.buffer.destroyed).toBe(true);
    });
  });

  describe('Coalescing', () => {
    it('should merge adjacent free blocks', () => {
      const pool = new BufferPool(device as any, { size: 4096 });

      const alloc1 = pool.allocate(1024);
      const alloc2 = pool.allocate(1024);
      const alloc3 = pool.allocate(1024);

      pool.free(alloc1);
      pool.free(alloc3);

      let stats = pool.getStats();
      const freeBlocksBefore = stats.freeBlockCount;

      pool.free(alloc2);

      stats = pool.getStats();
      // After freeing all, blocks should coalesce into one
      expect(stats.freeBlockCount).toBeLessThanOrEqual(freeBlocksBefore);
    });
  });
});

describe('createMultiTypePools', () => {
  it('should create pools for different memory types', () => {
    const device = new MockGPUDevice();
    const pools = createMultiTypePools(device as any, 1024, 3);

    expect(pools.size).toBe(3);
    expect(pools.has('device_local')).toBe(true);
    expect(pools.has('host_visible')).toBe(true);
    expect(pools.has('host_coherent')).toBe(true);
  });
});
