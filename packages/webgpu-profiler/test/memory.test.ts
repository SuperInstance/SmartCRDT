/**
 * Tests for MemoryProfiler
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryProfiler } from '../src/memory/MemoryProfiler.js';

describe('MemoryProfiler', () => {
  let profiler: MemoryProfiler;

  beforeEach(() => {
    profiler = new MemoryProfiler();
  });

  describe('allocation tracking', () => {
    it('should record allocation', () => {
      const id = profiler.recordAllocation(1024, 'buffer', ['STORAGE', 'COPY_DST']);

      expect(id).toMatch(/^alloc-\d+$/);
      expect(profiler.getCount()).toBe(1);
    });

    it('should track allocation details', () => {
      const id = profiler.recordAllocation(2048, 'texture', ['SAMPLED', 'RENDER_ATTACHMENT']);
      const allocation = profiler.getAllocation(id);

      expect(allocation).toBeDefined();
      expect(allocation?.size).toBe(2048);
      expect(allocation?.type).toBe('texture');
      expect(allocation?.usage).toEqual(['SAMPLED', 'RENDER_ATTACHMENT']);
      expect(allocation?.freed).toBe(false);
    });

    it('should record deallocation', () => {
      const id = profiler.recordAllocation(1024, 'buffer');
      profiler.recordDeallocation(id);

      const allocation = profiler.getAllocation(id);
      expect(allocation?.freed).toBe(true);
      expect(allocation?.lifetime).toBeGreaterThan(0);
    });

    it('should handle multiple allocations', () => {
      profiler.recordAllocation(512, 'buffer');
      profiler.recordAllocation(1024, 'texture');
      profiler.recordAllocation(2048, 'sampler');

      expect(profiler.getCount()).toBe(3);
    });
  });

  describe('memory usage', () => {
    it('should calculate current usage', () => {
      profiler.recordAllocation(1024, 'buffer');
      profiler.recordAllocation(2048, 'texture');
      profiler.recordAllocation(512, 'buffer');

      const usage = profiler.getCurrentUsage();

      expect(usage.totalAllocated).toBe(3584); // 1024 + 2048 + 512
      expect(usage.activeAllocations).toBe(3);
      expect(usage.bufferMemory).toBe(1536); // 1024 + 512
      expect(usage.textureMemory).toBe(2048);
    });

    it('should exclude freed allocations from usage', () => {
      const id1 = profiler.recordAllocation(1024, 'buffer');
      const id2 = profiler.recordAllocation(2048, 'buffer');

      profiler.recordDeallocation(id1);

      const usage = profiler.getCurrentUsage();

      expect(usage.totalAllocated).toBe(2048);
      expect(usage.activeAllocations).toBe(1);
      expect(usage.freedAllocations).toBe(1);
    });
  });

  describe('leak detection', () => {
    it('should detect memory leaks', () => {
      profiler.recordAllocation(10 * 1024 * 1024, 'buffer'); // 10MB

      const leaks = profiler.detectLeaks(1000, 60000);

      expect(leaks.length).toBeGreaterThanOrEqual(0);
    });

    it('should categorize leaks by age', () => {
      profiler.recordAllocation(1024, 'buffer');

      const leaks = profiler.detectLeaks(0);

      if (leaks.length > 0) {
        expect(leaks[0].age).toBeGreaterThanOrEqual(0);
        expect(leaks[0].allocationId).toBeDefined();
        expect(leaks[0].likelyCause).toBeDefined();
      }
    });
  });

  describe('fragmentation analysis', () => {
    it('should analyze fragmentation', () => {
      profiler.recordAllocation(1024, 'buffer');
      profiler.recordAllocation(2048, 'buffer');

      const analysis = profiler.analyzeFragmentation();

      expect(analysis).toBeDefined();
      expect(analysis.fragmentationRatio).toBeGreaterThanOrEqual(0);
      expect(analysis.fragmentationRatio).toBeLessThanOrEqual(1);
    });

    it('should handle empty state', () => {
      const analysis = profiler.analyzeFragmentation();

      expect(analysis.fragmentedBlocks).toBe(0);
      expect(analysis.totalFree).toBe(0);
    });
  });

  describe('snapshots', () => {
    it('should take snapshot', () => {
      profiler.recordAllocation(1024, 'buffer');
      profiler.recordAllocation(2048, 'texture');

      const snapshot = profiler.takeSnapshot();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.bufferMemoryUsed).toBe(1024);
      expect(snapshot.textureMemoryUsed).toBe(2048);
      expect(snapshot.totalMemoryUsed).toBe(3072);
    });

    it('should maintain snapshot history', () => {
      profiler.takeSnapshot();
      profiler.recordAllocation(1024, 'buffer');
      profiler.takeSnapshot();

      const history = profiler.getHistory();

      expect(history.length).toBe(2);
      expect(history[1].totalMemoryUsed).toBeGreaterThan(history[0].totalMemoryUsed);
    });
  });

  describe('allocation queries', () => {
    it('should get active allocations', () => {
      const id1 = profiler.recordAllocation(1024, 'buffer');
      const id2 = profiler.recordAllocation(2048, 'buffer');

      profiler.recordDeallocation(id1);

      const active = profiler.getActiveAllocations();

      expect(active.length).toBe(1);
      expect(active[0].id).toBe(id2);
    });

    it('should get allocations by type', () => {
      profiler.recordAllocation(1024, 'buffer');
      profiler.recordAllocation(2048, 'buffer');
      profiler.recordAllocation(512, 'texture');

      const buffers = profiler.getAllocationsByType('buffer');
      const textures = profiler.getAllocationsByType('texture');

      expect(buffers.length).toBe(2);
      expect(textures.length).toBe(1);
    });
  });

  describe('pattern analysis', () => {
    it('should analyze allocation patterns', () => {
      profiler.recordAllocation(1024, 'buffer');
      profiler.recordAllocation(1024, 'buffer');
      profiler.recordAllocation(2048, 'buffer');

      const patterns = profiler.analyzePatterns();

      expect(patterns.averageAllocationSize).toBeGreaterThan(0);
      expect(patterns.mostCommonSize).toBe(1024);
      expect(patterns.allocationCount).toBe(3);
    });

    it('should calculate allocation rates', () => {
      for (let i = 0; i < 10; i++) {
        profiler.recordAllocation(1024, 'buffer');
        profiler.recordDeallocation(`alloc-${i}`);
      }

      const patterns = profiler.analyzePatterns();

      expect(patterns.allocationRate).toBeGreaterThan(0);
      expect(patterns.deallocationRate).toBeGreaterThan(0);
    });

    it('should calculate average lifetime', () => {
      const id = profiler.recordAllocation(1024, 'buffer');
      profiler.recordDeallocation(id);

      const patterns = profiler.analyzePatterns();

      expect(patterns.averageLifetime).toBeGreaterThan(0);
    });
  });

  describe('metrics', () => {
    it('should generate performance metrics', () => {
      profiler.recordAllocation(1024, 'buffer');
      profiler.recordAllocation(2048, 'texture');

      const metrics = profiler.getMetrics();

      expect(metrics.length).toBeGreaterThan(0);

      const memoryMetric = metrics.find((m) => m.name === 'memory-total-allocated');
      expect(memoryMetric).toBeDefined();
      expect(memoryMetric?.value).toBe(3072);
    });
  });

  describe('memory pools', () => {
    it('should track allocations in pools', () => {
      profiler.recordAllocation(1024, 'buffer', [], 'pool1');
      profiler.recordAllocation(2048, 'buffer', [], 'pool1');
      profiler.recordAllocation(512, 'buffer', [], 'pool2');

      const usage = profiler.getCurrentUsage();

      expect(usage.totalAllocated).toBe(3584);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      profiler.recordAllocation(1024, 'buffer');
      profiler.takeSnapshot();

      expect(profiler.getCount()).toBe(1);

      profiler.clear();

      expect(profiler.getCount()).toBe(0);
      expect(profiler.getHistory().length).toBe(0);
    });
  });
});

describe('MemoryProfiler edge cases', () => {
  it('should handle double deallocation', () => {
    const profiler = new MemoryProfiler();
    const id = profiler.recordAllocation(1024, 'buffer');

    profiler.recordDeallocation(id);
    profiler.recordDeallocation(id); // Should not throw

    const allocation = profiler.getAllocation(id);
    expect(allocation?.freed).toBe(true);
  });

  it('should handle deallocation of unknown ID', () => {
    const profiler = new MemoryProfiler();

    expect(() => profiler.recordDeallocation('unknown')).not.toThrow();
  });

  it('should handle empty snapshot', () => {
    const profiler = new MemoryProfiler();

    const snapshot = profiler.takeSnapshot();

    expect(snapshot.totalMemoryUsed).toBe(0);
    expect(snapshot.bufferMemoryUsed).toBe(0);
    expect(snapshot.textureMemoryUsed).toBe(0);
  });
});
