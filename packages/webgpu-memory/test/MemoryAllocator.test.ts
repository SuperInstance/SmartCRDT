/**
 * @lsi/webgpu-memory - MemoryAllocator Tests
 *
 * Tests for MemoryAllocator functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArenaAllocator,
  StackAllocator,
  PoolAllocator,
  FreeListAllocator,
  AllocatorType,
  AllocatorFactory,
} from '../src/MemoryAllocator.js';

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

describe('ArenaAllocator', () => {
  let device: MockGPUDevice;
  let arena: ArenaAllocator;

  beforeEach(() => {
    device = new MockGPUDevice();
    arena = new ArenaAllocator(device as any, {
      initialSize: 4096,
      maxSize: 8192,
    });
  });

  describe('allocate', () => {
    it('should allocate from arena', () => {
      const alloc = arena.allocate(1024);

      expect(alloc).toBeDefined();
      expect(alloc.size).toBe(1024);
      expect(alloc.buffer).toBeInstanceOf(MockGPUBuffer);
    });

    it('should align allocations', () => {
      const alloc = arena.allocate(1000);

      expect(alloc.size).toBe(1008); // Aligned to 16
    });

    it('should grow arena when full', () => {
      const alloc1 = arena.allocate(2048);
      const alloc2 = arena.allocate(2048);

      expect(alloc1).toBeDefined();
      expect(alloc2).toBeDefined();
      expect(arena.getSize()).toBeGreaterThan(4096);
    });

    it('should throw when exceeding max size', () => {
      const smallArena = new ArenaAllocator(device as any, {
        initialSize: 1024,
        maxSize: 1024,
      });

      smallArena.allocate(1024);

      expect(() => {
        smallArena.allocate(1);
      }).toThrow();
    });
  });

  describe('reset', () => {
    it('should reset arena', () => {
      arena.allocate(1024);
      arena.allocate(2048);

      let util = arena.getUtilization();
      expect(util).toBeGreaterThan(0);

      arena.reset();

      util = arena.getUtilization();
      expect(util).toBe(0);
    });
  });

  describe('getUtilization', () => {
    it('should return utilization ratio', () => {
      arena.allocate(1024);

      const util = arena.getUtilization();
      expect(util).toBeGreaterThan(0);
      expect(util).toBeLessThanOrEqual(1);
    });
  });

  describe('destroy', () => {
    it('should destroy arena', () => {
      const alloc = arena.allocate(1024);

      arena.destroy();

      // Should not throw on destroy
      expect(() => arena.destroy()).not.toThrow();
    });
  });
});

describe('StackAllocator', () => {
  let device: MockGPUDevice;
  let stack: StackAllocator;

  beforeEach(() => {
    device = new MockGPUDevice();
    stack = new StackAllocator(device as any, {
      initialSize: 4096,
    });
  });

  describe('push', () => {
    it('should push allocation onto stack', () => {
      const alloc = stack.push(1024);

      expect(alloc).toBeDefined();
      expect(alloc.size).toBe(1024);
      expect(alloc.buffer).toBeInstanceOf(MockGPUBuffer);
    });

    it('should push multiple allocations', () => {
      const alloc1 = stack.push(1024);
      const alloc2 = stack.push(512);
      const alloc3 = stack.push(256);

      expect(alloc1).toBeDefined();
      expect(alloc2).toBeDefined();
      expect(alloc3).toBeDefined();
    });

    it('should align allocations', () => {
      const alloc = stack.push(1000);

      expect(alloc.size).toBe(1008); // Aligned to 16
    });
  });

  describe('pop', () => {
    it('should pop top allocation', () => {
      const alloc1 = stack.push(1024);
      const alloc2 = stack.push(512);

      stack.pop();

      const top = stack.getTop();
      expect(top).toBe(alloc1.offset);
    });

    it('should only pop in LIFO order', () => {
      const alloc1 = stack.push(1024);
      const alloc2 = stack.push(512);

      expect(() => {
        stack.pop(alloc1);
      }).toThrow();
    });

    it('should throw when popping empty stack', () => {
      expect(() => {
        stack.pop();
      }).toThrow();
    });
  });

  describe('markers', () => {
    it('should create marker', () => {
      stack.push(1024);
      stack.push(512);

      const marker = stack.createMarker();
      expect(marker).toBeDefined();
    });

    it('should free to marker', () => {
      stack.push(1024);
      stack.push(512);
      const marker = stack.createMarker();
      stack.push(256);

      let top = stack.getTop();
      expect(top).toBeGreaterThan(0);

      stack.freeToMarker(marker);

      top = stack.getTop();
      expect(top).toBe(1536); // 1024 + 512
    });
  });

  describe('destroy', () => {
    it('should destroy stack', () => {
      stack.push(1024);
      stack.destroy();

      expect(() => stack.destroy()).not.toThrow();
    });
  });
});

describe('PoolAllocator', () => {
  let device: MockGPUDevice;
  let pool: PoolAllocator;

  beforeEach(() => {
    device = new MockGPUDevice();
    pool = new PoolAllocator(device as any, 1024, 10);
  });

  describe('allocate', () => {
    it('should allocate fixed-size block', () => {
      const { buffer, index } = pool.allocate();

      expect(buffer).toBeInstanceOf(MockGPUBuffer);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(10);
    });

    it('should reuse freed blocks', () => {
      const { buffer: buf1, index: idx1 } = pool.allocate();
      pool.free(idx1);
      const { buffer: buf2, index: idx2 } = pool.allocate();

      expect(idx1).toBe(idx2);
    });

    it('should throw when pool exhausted', () => {
      const smallPool = new PoolAllocator(device as any, 1024, 2);

      smallPool.allocate();
      smallPool.allocate();

      expect(() => {
        smallPool.allocate();
      }).toThrow();
    });
  });

  describe('free', () => {
    it('should free block', () => {
      const { index } = pool.allocate();

      pool.free(index);

      expect(pool.getFreeCount()).toBe(10);
    });

    it('should throw for invalid index', () => {
      expect(() => {
        pool.free(-1);
      }).toThrow();

      expect(() => {
        pool.free(100);
      }).toThrow();
    });
  });

  describe('getUtilization', () => {
    it('should return utilization ratio', () => {
      pool.allocate();
      pool.allocate();

      const util = pool.getUtilization();
      expect(util).toBe(0.2); // 2/10
    });
  });

  describe('destroy', () => {
    it('should destroy pool', () => {
      pool.allocate();
      pool.destroy();

      expect(() => pool.destroy()).not.toThrow();
    });
  });
});

describe('FreeListAllocator', () => {
  let device: MockGPUDevice;
  let freeList: FreeListAllocator;

  beforeEach(() => {
    device = new MockGPUDevice();
    freeList = new FreeListAllocator(device as any, {
      initialSize: 4096,
    });
  });

  describe('allocate', () => {
    it('should allocate from free list', () => {
      const alloc = freeList.allocate(1024);

      expect(alloc).toBeDefined();
      expect(alloc.size).toBe(1024);
      expect(alloc.buffer).toBeInstanceOf(MockGPUBuffer);
    });

    it('should align allocations', () => {
      const alloc = freeList.allocate(1000);

      expect(alloc.size).toBe(1008); // Aligned to 16
    });

    it('should grow when out of space', () => {
      freeList.allocate(2048);
      freeList.allocate(2048);

      const alloc = freeList.allocate(2048);

      expect(alloc).toBeDefined();
    });
  });

  describe('free', () => {
    it('should free allocation', () => {
      const alloc = freeList.allocate(1024);

      freeList.free(alloc.allocation_id);

      const stats = freeList.getStats();
      expect(stats.allocationCount).toBe(0);
    });

    it('should reuse freed memory', () => {
      const alloc1 = freeList.allocate(1024);
      freeList.free(alloc1.allocation_id);

      const alloc2 = freeList.allocate(1024);

      expect(alloc2).toBeDefined();
    });

    it('should throw for unknown allocation', () => {
      expect(() => {
        freeList.free('unknown_id');
      }).toThrow();
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      freeList.allocate(1024);
      freeList.allocate(2048);

      const stats = freeList.getStats();

      expect(stats.totalSize).toBe(4096);
      expect(stats.usedBytes).toBeGreaterThanOrEqual(3072);
      expect(stats.allocationCount).toBe(2);
    });
  });

  describe('destroy', () => {
    it('should destroy allocator', () => {
      freeList.allocate(1024);
      freeList.destroy();

      expect(() => freeList.destroy()).not.toThrow();
    });
  });
});

describe('AllocatorFactory', () => {
  let device: MockGPUDevice;

  beforeEach(() => {
    device = new MockGPUDevice();
  });

  it('should create arena allocator', () => {
    const allocator = AllocatorFactory.create(
      AllocatorType.Arena,
      device as any
    );

    expect(allocator).toBeInstanceOf(ArenaAllocator);
  });

  it('should create stack allocator', () => {
    const allocator = AllocatorFactory.create(
      AllocatorType.Stack,
      device as any
    );

    expect(allocator).toBeInstanceOf(StackAllocator);
  });

  it('should create pool allocator', () => {
    const allocator = AllocatorFactory.create(
      AllocatorType.Pool,
      device as any,
      { initialSize: 1024 }
    );

    expect(allocator).toBeInstanceOf(PoolAllocator);
  });

  it('should create free list allocator', () => {
    const allocator = AllocatorFactory.create(
      AllocatorType.FreeList,
      device as any
    );

    expect(allocator).toBeInstanceOf(FreeListAllocator);
  });

  it('should throw for unknown type', () => {
    expect(() => {
      AllocatorFactory.create('unknown' as AllocatorType, device as any);
    }).toThrow();
  });
});
