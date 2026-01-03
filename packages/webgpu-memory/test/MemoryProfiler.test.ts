/**
 * @lsi/webgpu-memory - MemoryProfiler Tests
 *
 * Tests for MemoryProfiler functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryProfiler, MemorySnapshot } from '../src/MemoryProfiler.js';
import type { Allocation, MemoryEventType } from '../src/types.js';

// Mock GPUBuffer
class MockGPUBuffer {
  destroyed = false;
  constructor(public size: number = 1024) {}
  destroy() {
    this.destroyed = true;
  }
}

describe('MemoryProfiler', () => {
  let profiler: MemoryProfiler;

  beforeEach(() => {
    profiler = new MemoryProfiler();
  });

  describe('recordAllocation', () => {
    it('should record allocation', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);

      expect(profiler.getActiveAllocations()).toHaveLength(1);
    });

    it('should track multiple allocations', () => {
      const alloc1: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      const alloc2: Allocation = {
        allocation_id: 'alloc2',
        buffer: new MockGPUBuffer(2048) as any,
        offset: 0,
        size: 2048,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc1);
      profiler.recordAllocation(alloc2);

      expect(profiler.getActiveAllocations()).toHaveLength(2);
    });
  });

  describe('recordDeallocation', () => {
    it('should record deallocation', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);
      profiler.recordDeallocation('alloc1');

      expect(profiler.getActiveAllocations()).toHaveLength(0);
    });
  });

  describe('addEvent', () => {
    it('should add memory event', () => {
      profiler.addEvent({
        type: 'allocate' as MemoryEventType.Allocate,
        timestamp: Date.now(),
        size: 1024,
      });

      expect(profiler.getEvents()).toHaveLength(1);
    });
  });

  describe('startProfiling and stopProfiling', () => {
    it('should start and stop profiling', () => {
      profiler.startProfiling();
      profiler.stopProfiling();

      expect(() => profiler.startProfiling()).not.toThrow();
      expect(() => profiler.stopProfiling()).not.toThrow();
    });
  });

  describe('getReport', () => {
    it('should generate profiling report', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);

      const report = profiler.getReport();

      expect(report.totalAllocations).toBe(1);
      expect(report.peakMemory).toBe(1024);
      expect(report.avgAllocationSize).toBe(1024);
    });
  });

  describe('detectLeaks', () => {
    it('should detect no leaks when all freed', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);
      profiler.recordDeallocation('alloc1');

      const leaks = profiler.detectLeaks();

      expect(leaks.hasLeaks).toBe(false);
      expect(leaks.leakCount).toBe(0);
    });

    it('should detect leaks when allocations not freed', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);

      const leaks = profiler.detectLeaks();

      expect(leaks.hasLeaks).toBe(true);
      expect(leaks.leakCount).toBe(1);
      expect(leaks.leakedBytes).toBe(1024);
    });

    it('should break down leaks by age', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);

      const leaks = profiler.detectLeaks();

      expect(leaks.ageBreakdown).toBeDefined();
      expect(leaks.ageBreakdown.recent).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getActiveAllocations', () => {
    it('should return active allocations', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);

      const active = profiler.getActiveAllocations();

      expect(active).toHaveLength(1);
      expect(active[0].allocation.allocation_id).toBe('alloc1');
    });
  });

  describe('getAllocation', () => {
    it('should get allocation by ID', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);

      const record = profiler.getAllocation('alloc1');

      expect(record).toBeDefined();
      expect(record!.allocation.allocation_id).toBe('alloc1');
    });

    it('should return undefined for unknown ID', () => {
      const record = profiler.getAllocation('unknown');

      expect(record).toBeUndefined();
    });
  });

  describe('getEvents', () => {
    it('should return all events', () => {
      profiler.addEvent({
        type: 'allocate' as MemoryEventType.Allocate,
        timestamp: Date.now(),
        size: 1024,
      });

      profiler.addEvent({
        type: 'free' as MemoryEventType.Free,
        timestamp: Date.now(),
        size: 1024,
      });

      const events = profiler.getEvents();

      expect(events).toHaveLength(2);
    });
  });

  describe('getEventsByType', () => {
    it('should filter events by type', () => {
      profiler.addEvent({
        type: 'allocate' as MemoryEventType.Allocate,
        timestamp: Date.now(),
        size: 1024,
      });

      profiler.addEvent({
        type: 'free' as MemoryEventType.Free,
        timestamp: Date.now(),
        size: 1024,
      });

      profiler.addEvent({
        type: 'allocate' as MemoryEventType.Allocate,
        timestamp: Date.now(),
        size: 2048,
      });

      const allocEvents = profiler.getEventsByType('allocate' as MemoryEventType.Allocate);

      expect(allocEvents).toHaveLength(2);
    });
  });

  describe('getSizeDistribution', () => {
    it('should categorize allocations by size', () => {
      const tiny: Allocation = {
        allocation_id: 'tiny',
        buffer: new MockGPUBuffer(512) as any,
        offset: 0,
        size: 512,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      const small: Allocation = {
        allocation_id: 'small',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(tiny);
      profiler.recordAllocation(small);

      const distribution = profiler.getSizeDistribution();

      expect(distribution.tiny).toBe(1);
      expect(distribution.small).toBe(1);
    });
  });

  describe('getLifetimeDistribution', () => {
    it('should categorize by lifetime', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);
      profiler.recordDeallocation('alloc1');

      const distribution = profiler.getLifetimeDistribution();

      expect(distribution.ephemeral).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reset', () => {
    it('should reset profiler', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);

      profiler.reset();

      expect(profiler.getActiveAllocations()).toHaveLength(0);
      expect(profiler.getEvents()).toHaveLength(0);
    });
  });

  describe('generateSummary', () => {
    it('should generate text summary', () => {
      const alloc: Allocation = {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      };

      profiler.recordAllocation(alloc);

      const summary = profiler.generateSummary();

      expect(summary).toContain('Memory Profiler Summary');
      expect(summary).toContain('Total Allocations: 1');
      expect(summary).toContain('Peak Memory:');
    });
  });

  describe('destroy', () => {
    it('should destroy profiler', () => {
      profiler.startProfiling();
      profiler.destroy();

      expect(profiler.getActiveAllocations()).toHaveLength(0);
    });
  });
});

describe('MemorySnapshot', () => {
  it('should create snapshot', () => {
    const allocs: Allocation[] = [
      {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      },
    ];

    const stats = {
      total_memory: 4096,
      used_memory: 1024,
      free_memory: 3072,
      fragmentation: 0,
      allocation_count: 1,
      free_block_count: 1,
      peak_memory: 1024,
      size_distribution: {
        tiny: 1,
        small: 0,
        medium: 0,
        large: 0,
        huge: 0,
      },
    };

    const snapshot = new MemorySnapshot(allocs, stats);

    expect(snapshot.getTimestamp()).toBeDefined();
    expect(snapshot.getAllocations()).toHaveLength(1);
    expect(snapshot.getStats().total_memory).toBe(4096);
  });

  it('should compare snapshots', () => {
    const allocs1: Allocation[] = [
      {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      },
    ];

    const allocs2: Allocation[] = [
      {
        allocation_id: 'alloc1',
        buffer: new MockGPUBuffer(1024) as any,
        offset: 0,
        size: 1024,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      },
      {
        allocation_id: 'alloc2',
        buffer: new MockGPUBuffer(2048) as any,
        offset: 0,
        size: 2048,
        pool_id: 'pool1',
        usage: 0,
        memoryType: 'device_local',
        created_at: Date.now(),
        last_access: Date.now(),
        mapped: false,
      },
    ];

    const stats = {
      total_memory: 4096,
      used_memory: 0,
      free_memory: 4096,
      fragmentation: 0,
      allocation_count: 0,
      free_block_count: 1,
      peak_memory: 0,
      size_distribution: {
        tiny: 0,
        small: 0,
        medium: 0,
        large: 0,
        huge: 0,
      },
    };

    const snapshot1 = new MemorySnapshot(allocs1, {
      ...stats,
      used_memory: 1024,
      allocation_count: 1,
    });

    const snapshot2 = new MemorySnapshot(allocs2, {
      ...stats,
      used_memory: 3072,
      allocation_count: 2,
    });

    const comparison = snapshot2.compare(snapshot1);

    expect(comparison.allocationDelta).toBe(1);
    expect(comparison.memoryDelta).toBe(2048);
    expect(comparison.allocationsCreated).toHaveLength(1);
    expect(comparison.allocationsFreed).toHaveLength(0);
  });
});
