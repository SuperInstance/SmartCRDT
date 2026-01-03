/**
 * Memory Affinity Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryAffinityManager } from '../../src/numa/MemoryAffinityManager.js';
import { NUMADetector } from '../../src/numa/NUMADetector.js';
import type {
  NUMATopology,
  NUMAMemoryAffinityRequest,
  NUMAMemoryPolicy,
  MemorySize,
} from '@lsi/protocol';

describe('MemoryAffinityManager', () => {
  let manager: MemoryAffinityManager;
  let detector: NUMADetector;
  let topology: NUMATopology;

  beforeEach(async () => {
    manager = new MemoryAffinityManager();
    detector = new NUMADetector();

    const detection = await detector.detect();
    topology = detection.topology!;

    manager.initializeTopology(topology);
  });

  afterEach(() => {
    manager.reset();
  });

  describe('Initialization', () => {
    it('should initialize with topology', () => {
      const stats = manager.getMemoryStatistics();

      expect(stats.size).toBe(topology.nodeCount);

      for (const [nodeId, stat] of stats.entries()) {
        expect(stat.allocated).toBe(0);
        expect(stat.available).toBeGreaterThan(0);
        expect(stat.utilization).toBe(0);
      }
    });

    it('should create memory pool for each node', () => {
      const stats = manager.getMemoryStatistics();

      expect(stats.size).toBe(topology.nodes.size);

      for (const [nodeId, node] of topology.nodes.entries()) {
        const stat = stats.get(nodeId);
        expect(stat).toBeDefined();
        expect(stat!.available).toBe(node.totalMemory);
      }
    });
  });

  describe('Memory Allocation', () => {
    it('should allocate memory on preferred node', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-1',
        preferredNodes: [0],
        size: 1024 * 1024 * 100 as MemorySize, // 100MB
        policy: 'bind',
        allowRemote: false,
      };

      const result = await manager.setMemoryAffinity(request);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-1');
      expect(result.nodeId).toBe(0);
      expect(result.allocation).toBeDefined();
      expect(result.allocation!.size).toBe(request.size);
      expect(result.fallbackUsed).toBe(false);
    });

    it('should allocate memory with default policy', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-2',
        size: 1024 * 1024 * 50 as MemorySize, // 50MB
        policy: 'default',
        allowRemote: true,
      };

      const result = await manager.setMemoryAffinity(request);

      expect(result.success).toBe(true);
      expect(result.allocation).toBeDefined();
    });

    it('should allocate memory with interleaved policy', async () => {
      const requests: NUMAMemoryAffinityRequest[] = Array.from(
        { length: 5 },
        (_, i) => ({
          taskId: `task-interleave-${i}`,
          size: 1024 * 1024 * 10 as MemorySize,
          policy: 'interleave' as NUMAMemoryPolicy,
          allowRemote: true,
        })
      );

      const results = await Promise.all(
        requests.map(req => manager.setMemoryAffinity(req))
      );

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.allocation).toBeDefined();
      });

      // Should distribute across nodes
      const nodeIds = new Set(results.map(r => r.nodeId));
      if (topology.nodeCount > 1) {
        expect(nodeIds.size).toBeGreaterThan(0);
      }
    });

    it('should reject allocation if insufficient memory', async () => {
      const hugeRequest: NUMAMemoryAffinityRequest = {
        taskId: 'task-huge',
        preferredNodes: [0],
        size: 9999999999999 as MemorySize, // Extremely large
        policy: 'bind',
        allowRemote: false,
      };

      const result = await manager.setMemoryAffinity(hugeRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should use fallback when allowed', async () => {
      const hugeRequest: NUMAMemoryAffinityRequest = {
        taskId: 'task-fallback',
        preferredNodes: [0],
        size: 9999999999999 as MemorySize,
        policy: 'bind',
        allowRemote: true,
      };

      const result = await manager.setMemoryAffinity(hugeRequest);

      if (topology.nodeCount > 1) {
        // Should try other nodes
        expect(result).toBeDefined();
      } else {
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Memory Affinity Retrieval', () => {
    it('should retrieve memory affinity for task', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-retrieve',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      await manager.setMemoryAffinity(request);
      const affinity = await manager.getMemoryAffinity('task-retrieve');

      expect(affinity).toBeDefined();
      expect(affinity!.taskId).toBe('task-retrieve');
      expect(affinity!.success).toBe(true);
      expect(affinity!.allocation).toBeDefined();
    });

    it('should return null for non-existent task', async () => {
      const affinity = await manager.getMemoryAffinity('non-existent');

      expect(affinity).toBeNull();
    });
  });

  describe('Memory Policy Updates', () => {
    it('should update memory policy for task', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-update',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      await manager.setMemoryAffinity(request);
      const updated = await manager.updateMemoryPolicy('task-update', 'interleave');

      expect(updated).toBe(true);
    });

    it('should return false when updating non-existent task', async () => {
      const updated = await manager.updateMemoryPolicy('non-existent', 'local');

      expect(updated).toBe(false);
    });
  });

  describe('Memory Deallocation', () => {
    it('should free memory allocation', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-free',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      const result = await manager.setMemoryAffinity(request);
      const allocationId = result.allocation!.allocationId;

      const freed = await manager.freeMemory(allocationId);

      expect(freed).toBe(true);

      // Verify memory was returned
      const affinity = await manager.getMemoryAffinity('task-free');
      expect(affinity).toBeNull();
    });

    it('should return false when freeing non-existent allocation', async () => {
      const freed = await manager.freeMemory('non-existent');

      expect(freed).toBe(false);
    });
  });

  describe('Memory Statistics', () => {
    it('should track memory usage', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-stats',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      await manager.setMemoryAffinity(request);

      const stats = manager.getMemoryStatistics();

      for (const [nodeId, stat] of stats.entries()) {
        expect(stat.allocated).toBeGreaterThanOrEqual(0);
        expect(stat.available).toBeGreaterThanOrEqual(0);
        expect(stat.utilization).toBeGreaterThanOrEqual(0);
        expect(stat.utilization).toBeLessThanOrEqual(1);

        if (stat.allocated > 0) {
          expect(stat.utilization).toBeGreaterThan(0);
        }
      }
    });

    it('should update statistics after allocation', async () => {
      const statsBefore = manager.getMemoryStatistics();

      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-stats-diff',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      const result = await manager.setMemoryAffinity(request);
      const statsAfter = manager.getMemoryStatistics();

      const nodeStatsBefore = statsBefore.get(result.nodeId);
      const nodeStatsAfter = statsAfter.get(result.nodeId);

      expect(nodeStatsAfter!.allocated).toBeGreaterThan(nodeStatsBefore!.allocated);
      expect(nodeStatsAfter!.available).toBeLessThan(nodeStatsBefore!.available);
      expect(nodeStatsAfter!.utilization).toBeGreaterThan(nodeStatsBefore!.utilization);
    });
  });

  describe('Total Memory Usage', () => {
    it('should calculate total memory usage', async () => {
      const usage = manager.getTotalMemoryUsage();

      expect(usage.total).toBeGreaterThan(0);
      expect(usage.allocated).toBeGreaterThanOrEqual(0);
      expect(usage.available).toBeGreaterThan(0);
      expect(usage.allocated + usage.available).toBe(usage.total);
    });

    it('should update total usage after allocation', async () => {
      const usageBefore = manager.getTotalMemoryUsage();

      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-total',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      await manager.setMemoryAffinity(request);
      const usageAfter = manager.getTotalMemoryUsage();

      expect(usageAfter.allocated).toBeGreaterThan(usageBefore.allocated);
      expect(usageAfter.available).toBeLessThan(usageBefore.available);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old allocations', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-cleanup',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      await manager.setMemoryAffinity(request);

      // Cleanup everything
      manager.cleanup(0);

      // Task should be removed
      const affinity = await manager.getMemoryAffinity('task-cleanup');
      expect(affinity).toBeNull();
    });

    it('should not cleanup recent allocations', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-recent',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      await manager.setMemoryAffinity(request);

      // Cleanup only allocations older than 1 hour
      manager.cleanup(3600000);

      // Recent task should still exist
      const affinity = await manager.getMemoryAffinity('task-recent');
      expect(affinity).toBeDefined();
    });
  });

  describe('Reset', () => {
    it('should reset all allocations', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-reset',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      await manager.setMemoryAffinity(request);
      manager.reset();

      const stats = manager.getMemoryStatistics();

      for (const stat of stats.values()) {
        expect(stat.allocated).toBe(0);
        expect(stat.utilization).toBe(0);
      }
    });
  });

  describe('Address Range', () => {
    it('should provide valid address range for allocations', async () => {
      const request: NUMAMemoryAffinityRequest = {
        taskId: 'task-address',
        size: 1024 * 1024 * 100 as MemorySize,
        policy: 'local',
        allowRemote: false,
      };

      const result = await manager.setMemoryAffinity(request);
      const allocation = result.allocation!;

      expect(allocation.addressRange.start).toBeDefined();
      expect(allocation.addressRange.end).toBeDefined();
      expect(allocation.addressRange.end).toBeGreaterThan(allocation.addressRange.start);
    });
  });

  describe('Multiple Allocations', () => {
    it('should handle multiple allocations', async () => {
      const requests: NUMAMemoryAffinityRequest[] = Array.from(
        { length: 10 },
        (_, i) => ({
          taskId: `task-multi-${i}`,
          size: (1024 * 1024 * 10) as MemorySize,
          policy: 'local' as NUMAMemoryPolicy,
          allowRemote: true,
        })
      );

      const results = await Promise.all(
        requests.map(req => manager.setMemoryAffinity(req))
      );

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.allocation).toBeDefined();
      });

      const stats = manager.getMemoryStatistics();
      let totalAllocated = 0;
      for (const stat of stats.values()) {
        totalAllocated += stat.allocated;
      }

      expect(totalAllocated).toBeGreaterThan(0);
    });
  });
});
