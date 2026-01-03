/**
 * @lsi/webgpu-memory - MemoryManager Tests
 *
 * Tests for MemoryManager functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryManager } from '../src/MemoryManager.js';
import type { MemoryType, MemoryEvent } from '../src/types.js';

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
  limits = {
    maxBufferSize: 256 * 1024 * 1024,
    minUniformBufferOffsetAlignment: 256,
    maxStorageBuffersPerStage: 8,
    maxUniformBuffersPerStage: 8,
  };

  createBuffer(descriptor: { size: number; usage: number; mappedAtCreation?: boolean }) {
    return new MockGPUBuffer(descriptor.size, descriptor.usage);
  }

  queue = {
    writeBuffer: vi.fn(),
  };
}

class MockGPUAdapter {
  limits = {
    maxBufferSize: 256 * 1024 * 1024,
    minUniformBufferOffsetAlignment: 256,
    maxStorageBuffersPerShaderStage: 8,
    maxUniformBuffersPerShaderStage: 8,
  };

  async requestAdapterInfo() {
    return {
      device: 'MockGPU',
      vendor: 'MockVendor',
      architecture: 'MockArch',
    };
  }
}

describe('MemoryManager', () => {
  let device: MockGPUDevice;
  let adapter: MockGPUAdapter;
  let manager: MemoryManager;

  beforeEach(() => {
    device = new MockGPUDevice();
    adapter = new MockGPUAdapter();
    manager = new MemoryManager(device as any);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Construction', () => {
    it('should create memory manager with default config', () => {
      expect(manager).toBeDefined();
      expect(manager.getPools()).toHaveLength(1);
    });

    it('should create memory manager with custom config', () => {
      const customManager = new MemoryManager(device as any, {
        initialPoolSize: 8 * 1024 * 1024,
        enableProfiling: false,
      });

      expect(customManager).toBeDefined();
      customManager.destroy();
    });
  });

  describe('setAdapter', () => {
    it('should set adapter and query device info', async () => {
      await manager.setAdapter(adapter as any);

      const deviceInfo = manager.getDeviceInfo();
      expect(deviceInfo).toBeDefined();
      expect(deviceInfo?.name).toBe('MockGPU');
      expect(deviceInfo?.maxBufferSize).toBe(256 * 1024 * 1024);
    });
  });

  describe('allocateBuffer', () => {
    it('should allocate buffer from default pool', () => {
      const buffer = manager.allocateBuffer(1024, 0x08);

      expect(buffer).toBeInstanceOf(MockGPUBuffer);
      expect(buffer.size).toBe(1024);
      expect(buffer.destroyed).toBe(false);
    });

    it('should allocate multiple buffers', () => {
      const buf1 = manager.allocateBuffer(1024, 0x08);
      const buf2 = manager.allocateBuffer(2048, 0x08);
      const buf3 = manager.allocateBuffer(4096, 0x08);

      expect(buf1.size).toBe(1024);
      expect(buf2.size).toBe(2048);
      expect(buf3.size).toBe(4096);
    });

    it('should throw when exceeding budget', async () => {
      await manager.setAdapter(adapter as any);

      const smallManager = new MemoryManager(device as any, {
        maxMemory: 2048,
      });

      smallManager.allocateBuffer(1024, 0x08);

      expect(() => {
        smallManager.allocateBuffer(2048, 0x08);
      }).toThrow();

      smallManager.destroy();
    });
  });

  describe('allocate', () => {
    it('should allocate with full result', () => {
      const result = manager.allocate({
        size: 1024,
        usage: 0x08,
      });

      expect(result.buffer).toBeInstanceOf(MockGPUBuffer);
      expect(result.size).toBeGreaterThanOrEqual(1024);
      expect(result.allocationId).toBeDefined();
      expect(result.poolId).toBeDefined();
    });
  });

  describe('freeBuffer', () => {
    it('should free allocated buffer', () => {
      const buffer = manager.allocateBuffer(1024, 0x08);
      expect(buffer.destroyed).toBe(false);

      manager.freeBuffer(buffer);
      expect(buffer.destroyed).toBe(true);
    });

    it('should throw when freeing non-managed buffer', () => {
      const buffer = new MockGPUBuffer(1024, 0x08);

      expect(() => {
        manager.freeBuffer(buffer as any);
      }).toThrow();
    });
  });

  describe('getMemoryStats', () => {
    it('should return correct statistics', () => {
      manager.allocateBuffer(1024, 0x08);
      manager.allocateBuffer(2048, 0x08);

      const stats = manager.getMemoryStats();

      expect(stats.total_memory).toBeGreaterThan(0);
      expect(stats.used_memory).toBeGreaterThanOrEqual(3072);
      expect(stats.allocation_count).toBe(2);
      expect(stats.peak_memory).toBeGreaterThan(0);
    });

    it('should track peak memory', () => {
      manager.allocateBuffer(1024, 0x08);
      manager.allocateBuffer(2048, 0x08);

      const stats1 = manager.getMemoryStats();
      const peak1 = stats1.peak_memory;

      manager.freeBuffer((manager as any).allocations.values().next().value.buffer);

      const stats2 = manager.getMemoryStats();

      expect(stats2.peak_memory).toBe(peak1);
    });
  });

  describe('defragment', () => {
    it('should defragment memory pools', () => {
      manager.allocateBuffer(1024, 0x08);
      manager.allocateBuffer(2048, 0x08);

      const result = manager.defragment();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.afterFragmentation).toBeLessThanOrEqual(result.beforeFragmentation + 0.1);
    });
  });

  describe('garbageCollect', () => {
    it('should garbage collect empty pools', () => {
      // Allocate and free to potentially create empty pools
      const buffer = manager.allocateBuffer(1024, 0x08);
      manager.freeBuffer(buffer);

      const result = manager.garbageCollect();

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMemoryHealth', () => {
    it('should return healthy status for low usage', () => {
      const health = manager.getMemoryHealth();

      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.score).toBeGreaterThan(0.5);
      expect(health.pressure).toBe('none');
    });
  });

  describe('createSnapshot', () => {
    it('should create memory snapshot', () => {
      manager.allocateBuffer(1024, 0x08);

      const snapshot = manager.createSnapshot();

      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.pools).toBeDefined();
      expect(snapshot.allocations).toBeDefined();
      expect(snapshot.stats).toBeDefined();
    });
  });

  describe('Event Handling', () => {
    it('should emit allocation events', () => {
      const events: MemoryEvent[] = [];

      manager.onEvent((event) => {
        events.push(event);
      });

      manager.allocateBuffer(1024, 0x08);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('allocate');
      expect(events[0].size).toBe(1024);
    });

    it('should emit free events', () => {
      const events: MemoryEvent[] = [];

      manager.onEvent((event) => {
        events.push(event);
      });

      const buffer = manager.allocateBuffer(1024, 0x08);
      manager.freeBuffer(buffer);

      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(events[events.length - 1].type).toBe('free');
    });

    it('should unregister event callback', () => {
      const events: MemoryEvent[] = [];

      const callback = (event: MemoryEvent) => {
        events.push(event);
      };

      manager.onEvent(callback);
      manager.offEvent(callback);

      manager.allocateBuffer(1024, 0x08);

      expect(events).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should reset all allocations', () => {
      manager.allocateBuffer(1024, 0x08);
      manager.allocateBuffer(2048, 0x08);

      expect(manager.getAllocations()).toHaveLength(2);

      manager.reset();

      expect(manager.getAllocations()).toHaveLength(0);
    });
  });

  describe('getAllocations', () => {
    it('should return all allocations', () => {
      manager.allocateBuffer(1024, 0x08);
      manager.allocateBuffer(2048, 0x08);

      const allocations = manager.getAllocations();

      expect(allocations).toHaveLength(2);
    });
  });

  describe('getPools', () => {
    it('should return all pools', () => {
      const pools = manager.getPools();

      expect(pools.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getPoolStats', () => {
    it('should return pool statistics', () => {
      manager.allocateBuffer(1024, 0x08);

      const pools = manager.getPools();
      const stats = manager.getPoolStats(pools[0].pool_id);

      expect(stats).toBeDefined();
      expect(stats.poolId).toBe(pools[0].pool_id);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });
});
