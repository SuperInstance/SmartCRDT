/**
 * NUMA Integration Tests
 *
 * Tests for NUMA allocator, memory manager, and CPU scheduler integration.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  NUMAAllocator,
  NUMAMemoryManager,
  NUMACPUScheduler,
  createNUMAAllocator,
  type NUMAAllocatorConfig,
  type NUMATask,
  type AllocationRequest,
  type AllocationResult,
} from "../hardware/NUMAAllocator.js";
import type { NUMATopology, NUMANode } from "../hardware/NUMATopology.js";

// Mock NUMA topology for testing
function createMockTopology(numNodes: number = 2): NUMATopology {
  const nodes: NUMANode[] = [];

  for (let i = 0; i < numNodes; i++) {
    const cpus: number[] = [];
    const cpusPerNode = 4;

    for (let j = 0; j < cpusPerNode; j++) {
      cpus.push(i * cpusPerNode + j);
    }

    nodes.push({
      nodeId: i,
      cpus: cpus,
      localCPUs: cpus,
      memory: {
        total: 16 * 1024 * 1024 * 1024, // 16GB
        used: 0,
        free: 16 * 1024 * 1024 * 1024,
      },
      distances: i === 0 ? [10, 20] : [20, 10], // Local vs remote distance
    });
  }

  return {
    numNodes,
    nodes,
    totalCPUs: numNodes * 4,
    totalMemory: numNodes * 16 * 1024 * 1024 * 1024,
    type: "NUMA",
    getPreferredNode: (cpuId: number) => Math.floor(cpuId / 4),
    getCPUs: (nodeId: number) => {
      const node = nodes[nodeId];
      return node ? Array.from(node.cpus) : [];
    },
    getDistance: (fromNode: number, toNode: number) => {
      return fromNode === toNode ? 10 : 20;
    },
  };
}

describe("NUMA Integration", () => {
  let topology: NUMATopology;
  let allocator: NUMAAllocator;

  beforeEach(() => {
    topology = createMockTopology(2);
    allocator = new NUMAAllocator(topology);
  });

  describe("NUMA Memory Manager", () => {
    it("should allocate memory on specific node", () => {
      const memoryManager = new NUMAMemoryManager(topology);

      const size = 1024 * 1024 * 1024; // 1GB
      const allocation = memoryManager.allocateOnNode(size, 0);

      expect(allocation.pointer).toBeGreaterThan(0);
      expect(allocation.nodeId).toBe(0);
    });

    it("should allocate memory local to CPU", () => {
      const memoryManager = new NUMAMemoryManager(topology);

      const size = 512 * 1024 * 1024; // 512MB
      const cpuId = 2; // On node 0
      const allocation = memoryManager.allocateLocal(size, cpuId);

      expect(allocation.nodeId).toBe(0);
    });

    it("should interleave allocations across nodes", () => {
      const memoryManager = new NUMAMemoryManager(topology);

      const size = 2 * 1024 * 1024 * 1024; // 2GB
      const allocation = memoryManager.allocateInterleaved(size);

      expect(allocation.pointer).toBeGreaterThan(0);
      expect(allocation.nodes).toBeDefined();
      expect(allocation.nodes!.length).toBeGreaterThan(0);
    });

    it("should track memory locality", () => {
      const memoryManager = new NUMAMemoryManager(topology);

      const size = 256 * 1024 * 1024;
      const allocation = memoryManager.allocateOnNode(size, 0);

      const locality = memoryManager.getLocality(allocation.pointer);

      expect(locality.nodeId).toBe(0);
      expect(locality.isLocal).toBeDefined();
      expect(locality.accessCost).toBeGreaterThan(0);
    });

    it("should migrate memory between nodes", async () => {
      const memoryManager = new NUMAMemoryManager(topology);

      const size = 128 * 1024 * 1024;
      const allocation = memoryManager.allocateOnNode(size, 0);

      await memoryManager.migrate(allocation.pointer, 1);

      const locality = memoryManager.getLocality(allocation.pointer);
      expect(locality.nodeId).toBe(1);
    });

    it("should free memory allocations", () => {
      const memoryManager = new NUMAMemoryManager(topology);

      const size = 64 * 1024 * 1024;
      const allocation = memoryManager.allocateOnNode(size, 0);

      const statsBefore = memoryManager.getMemoryStats();
      const usedBefore = statsBefore.get(0)?.used || 0;

      memoryManager.free(allocation.pointer);

      const statsAfter = memoryManager.getMemoryStats();
      const usedAfter = statsAfter.get(0)?.used || 0;

      expect(usedAfter).toBeLessThan(usedBefore);
    });

    it("should get memory statistics", () => {
      const memoryManager = new NUMAMemoryManager(topology);

      const stats = memoryManager.getMemoryStats();

      expect(stats.size).toBe(2);
      expect(stats.get(0)).toBeDefined();
      expect(stats.get(1)).toBeDefined();
    });
  });

  describe("NUMA CPU Scheduler", () => {
    it("should schedule task on optimal CPU", () => {
      const scheduler = new NUMACPUScheduler(topology);

      const task: NUMATask = {
        taskId: "task-1",
        memoryBytes: 1024 * 1024 * 1024,
        currentNode: undefined,
      };

      const cpuId = scheduler.schedule(task);

      expect(cpuId).toBeGreaterThanOrEqual(0);
      expect(task.currentNode).toBeDefined();
      expect(task.currentCPUs).toBeDefined();
    });

    it("should schedule task on preferred CPU", () => {
      const scheduler = new NUMACPUScheduler(topology);

      const task: NUMATask = {
        taskId: "task-2",
        memoryBytes: 512 * 1024 * 1024,
        preferredCPU: 5, // On node 1
      };

      const cpuId = scheduler.schedule(task, 5);

      expect(cpuId).toBe(5);
      expect(task.currentNode).toBe(1);
    });

    it("should bind task to specific CPUs", () => {
      const scheduler = new NUMACPUScheduler(topology);

      const task: NUMATask = {
        taskId: "task-3",
        memoryBytes: 256 * 1024 * 1024,
      };

      scheduler.schedule(task);
      scheduler.bindToCPUs("task-3", [2, 3]);

      expect(task.currentCPUs).toEqual([2, 3]);
    });

    it("should get task placement", () => {
      const scheduler = new NUMACPUScheduler(topology);

      const task: NUMATask = {
        taskId: "task-4",
        memoryBytes: 128 * 1024 * 1024,
      };

      scheduler.schedule(task);
      const placement = scheduler.getPlacement("task-4");

      expect(placement.nodeId).toBeDefined();
      expect(placement.cpus).toBeDefined();
      expect(placement.isOptimal).toBe(true);
    });

    it("should migrate task to better node", async () => {
      const scheduler = new NUMACPUScheduler(topology);

      const task: NUMATask = {
        taskId: "task-5",
        memoryBytes: 256 * 1024 * 1024,
        currentNode: 1, // Start on node 1
      };

      const cpuBefore = scheduler.schedule(task);

      await scheduler.migrate("task-5");

      const placement = scheduler.getPlacement("task-5");

      expect(placement.nodeId).toBeDefined();
    });

    it("should get CPU statistics", () => {
      const scheduler = new NUMACPUScheduler(topology);

      const stats = scheduler.getCPUStats();

      expect(stats.size).toBe(2);
    });
  });

  describe("NUMA Allocator", () => {
    it("should allocate resources with default strategy", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024 * 1024 * 1024,
        cpuCount: 2,
        taskId: "alloc-1",
      };

      const result = allocator.allocate(request);

      expect(result.nodeId).toBeGreaterThanOrEqual(0);
      expect(result.cpus).toHaveLength(2);
      expect(result.memoryBytes).toBe(1024 * 1024 * 1024);
    });

    it("should allocate with pack strategy", () => {
      const packAllocator = new NUMAAllocator(topology, {
        strategy: "pack",
      });

      const request: AllocationRequest = {
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 1,
        taskId: "alloc-2",
      };

      const result = packAllocator.allocate(request);

      expect(result.nodeId).toBeGreaterThanOrEqual(0);
    });

    it("should allocate with spread strategy", () => {
      const spreadAllocator = new NUMAAllocator(topology, {
        strategy: "spread",
      });

      const request: AllocationRequest = {
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 1,
        taskId: "alloc-3",
      };

      const result = spreadAllocator.allocate(request);

      expect(result.nodeId).toBeGreaterThanOrEqual(0);
    });

    it("should allocate with balanced strategy", () => {
      const balancedAllocator = new NUMAAllocator(topology, {
        strategy: "balanced",
      });

      const request: AllocationRequest = {
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 1,
        taskId: "alloc-4",
      };

      const result = balancedAllocator.allocate(request);

      expect(result.nodeId).toBeGreaterThanOrEqual(0);
    });

    it("should respect preferred node", () => {
      const request: AllocationRequest = {
        memoryBytes: 256 * 1024 * 1024,
        cpuCount: 1,
        preferredNode: 1,
        affinity: "prefer",
        taskId: "alloc-5",
      };

      const result = allocator.allocate(request);

      expect(result.nodeId).toBe(1);
    });

    it("should respect strict affinity", () => {
      const request: AllocationRequest = {
        memoryBytes: 256 * 1024 * 1024,
        cpuCount: 1,
        preferredNode: 0,
        affinity: "strict",
        taskId: "alloc-6",
      };

      const result = allocator.allocate(request);

      expect(result.nodeId).toBe(0);
    });

    it("should handle cross-node allocation", () => {
      // Create topology with limited memory on node 0
      const limitedTopology = createMockTopology(2);
      limitedTopology.nodes[0].memory.free = 100 * 1024 * 1024; // Only 100MB

      const crossNodeAllocator = new NUMAAllocator(limitedTopology, {
        allowCrossNode: true,
      });

      const request: AllocationRequest = {
        memoryBytes: 1024 * 1024 * 1024, // 1GB - too large for node 0
        cpuCount: 1,
        taskId: "alloc-7",
      };

      const result = crossNodeAllocator.allocate(request);

      expect(result.isFallback).toBe(true);
      expect(result.fallbackReason).toBeDefined();
    });

    it("should estimate performance characteristics", () => {
      const request: AllocationRequest = {
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 2,
        taskId: "alloc-8",
      };

      const result = allocator.allocate(request);

      expect(result.estimatedLatency).toBeGreaterThan(0);
      expect(result.estimatedBandwidth).toBeGreaterThan(0);
    });

    it("should provide allocation reasoning", () => {
      const request: AllocationRequest = {
        memoryBytes: 256 * 1024 * 1024,
        cpuCount: 1,
        taskId: "alloc-9",
        priority: "high",
      };

      const result = allocator.allocate(request);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it("should check if allocation is possible", () => {
      const possibleRequest: AllocationRequest = {
        memoryBytes: 1 * 1024 * 1024 * 1024,
        cpuCount: 2,
      };

      const impossibleRequest: AllocationRequest = {
        memoryBytes: 100 * 1024 * 1024 * 1024, // 100GB - too large
        cpuCount: 100,
      };

      expect(allocator.canAllocate(possibleRequest)).toBe(true);
      expect(allocator.canAllocate(impossibleRequest)).toBe(false);
    });

    it("should free allocations", () => {
      const request: AllocationRequest = {
        memoryBytes: 256 * 1024 * 1024,
        cpuCount: 1,
        taskId: "alloc-10",
      };

      const allocation = allocator.allocate(request);
      const statsBefore = allocator.getStats();

      allocator.free(allocation);

      const statsAfter = allocator.getStats();
      expect(statsAfter.activeAllocations).toBe(
        statsBefore.activeAllocations - 1
      );
    });

    it("should get allocator statistics", () => {
      const request: AllocationRequest = {
        memoryBytes: 128 * 1024 * 1024,
        cpuCount: 1,
        taskId: "alloc-11",
      };

      allocator.allocate(request);

      const stats = allocator.getStats();

      expect(stats.totalAllocations).toBeGreaterThan(0);
      expect(stats.activeAllocations).toBeGreaterThan(0);
      expect(stats.allocationsByNode).toBeDefined();
    });

    it("should rebalance allocations", () => {
      const rebalancingAllocator = new NUMAAllocator(topology, {
        enableRebalancing: true,
        rebalanceInterval: 60000,
      });

      // Make some allocations
      for (let i = 0; i < 5; i++) {
        rebalancingAllocator.allocate({
          memoryBytes: 128 * 1024 * 1024,
          cpuCount: 1,
          taskId: `alloc-rebal-${i}`,
        });
      }

      const statsBefore = rebalancingAllocator.getStats();
      rebalancingAllocator.rebalance();
      const statsAfter = rebalancingAllocator.getStats();

      expect(statsAfter.rebalanceCount).toBe(statsBefore.rebalanceCount + 1);
    });

    it("should support helper function", () => {
      const allocator2 = createNUMAAllocator(topology, {
        strategy: "balanced",
      });

      expect(allocator2).toBeInstanceOf(NUMAAllocator);
    });
  });

  describe("NUMA Affinity Types", () => {
    it("should handle strict affinity", () => {
      const request: AllocationRequest = {
        memoryBytes: 256 * 1024 * 1024,
        cpuCount: 1,
        preferredNode: 0,
        affinity: "strict",
        taskId: "affinity-1",
      };

      const result = allocator.allocate(request);

      expect(result.nodeId).toBe(0);
    });

    it("should handle prefer affinity", () => {
      const request: AllocationRequest = {
        memoryBytes: 256 * 1024 * 1024,
        cpuCount: 1,
        preferredNode: 1,
        affinity: "prefer",
        taskId: "affinity-2",
      };

      const result = allocator.allocate(request);

      expect(result.nodeId).toBe(1);
    });

    it("should handle interleave affinity", () => {
      const request: AllocationRequest = {
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 2,
        affinity: "interleave",
        taskId: "affinity-3",
      };

      const result = allocator.allocate(request);

      expect(result.nodeId).toBeGreaterThanOrEqual(0);
    });
  });

  describe("NUMA Task Context", () => {
    it("should handle compute-intensive tasks", () => {
      const request: AllocationRequest = {
        memoryBytes: 128 * 1024 * 1024,
        cpuCount: 4,
        taskId: "compute-1",
      };

      const result = allocator.allocate(request);

      expect(result.cpus.length).toBe(4);
    });

    it("should handle memory-intensive tasks", () => {
      const request: AllocationRequest = {
        memoryBytes: 8 * 1024 * 1024 * 1024, // 8GB
        cpuCount: 1,
        taskId: "memory-1",
      };

      const result = allocator.allocate(request);

      expect(result.memoryBytes).toBe(8 * 1024 * 1024 * 1024);
    });

    it("should handle mixed workload tasks", () => {
      const request: AllocationRequest = {
        memoryBytes: 2 * 1024 * 1024 * 1024,
        cpuCount: 2,
        taskId: "mixed-1",
      };

      const result = allocator.allocate(request);

      expect(result.nodeId).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Load Balancing", () => {
    it("should calculate load balance score", () => {
      // Make allocations to create imbalance
      allocator.allocate({
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 2,
        taskId: "lb-1",
      });

      allocator.allocate({
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 2,
        taskId: "lb-2",
      });

      const stats = allocator.getStats();

      expect(stats.loadBalanceScore).toBeGreaterThanOrEqual(0);
      expect(stats.loadBalanceScore).toBeLessThanOrEqual(1);
    });

    it("should distribute allocations across nodes", () => {
      const balancedAllocator = new NUMAAllocator(topology, {
        strategy: "spread",
      });

      for (let i = 0; i < 10; i++) {
        balancedAllocator.allocate({
          memoryBytes: 128 * 1024 * 1024,
          cpuCount: 1,
          taskId: `spread-${i}`,
        });
      }

      const stats = balancedAllocator.getStats();

      // With spread strategy, should have better load balance
      expect(stats.loadBalanceScore).toBeGreaterThan(0.5);
    });
  });

  describe("Memory Locality", () => {
    it("should track local vs remote memory access", () => {
      const request: AllocationRequest = {
        memoryBytes: 256 * 1024 * 1024,
        cpuCount: 1,
        preferredCPU: 2,
        requireLocalMemory: true,
        taskId: "locality-1",
      };

      const result = allocator.allocate(request);

      // With requireLocalMemory, should allocate on node 0 (where CPU 2 is)
      expect(result.nodeId).toBe(0);
    });

    it("should estimate cross-node traffic", () => {
      const stats = allocator.getStats();

      expect(stats.avgCrossNodeTraffic).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero memory allocation", () => {
      const request: AllocationRequest = {
        memoryBytes: 0,
        cpuCount: 1,
        taskId: "edge-1",
      };

      const result = allocator.allocate(request);

      expect(result).toBeDefined();
    });

    it("should handle zero CPU allocation", () => {
      const request: AllocationRequest = {
        memoryBytes: 256 * 1024 * 1024,
        cpuCount: 0,
        taskId: "edge-2",
      };

      const result = allocator.allocate(request);

      expect(result.cpus).toHaveLength(0);
    });

    it("should handle very large allocations", () => {
      const largeTopology = createMockTopology(4);
      const largeAllocator = new NUMAAllocator(largeTopology);

      const request: AllocationRequest = {
        memoryBytes: 60 * 1024 * 1024 * 1024, // 60GB across 4 nodes
        cpuCount: 8,
        taskId: "edge-3",
      };

      const canAllocate = largeAllocator.canAllocate(request);

      // Should be possible with 4 nodes
      expect(canAllocate).toBe(true);
    });

    it("should handle priority allocation", () => {
      const highPriorityRequest: AllocationRequest = {
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 2,
        priority: "high",
        taskId: "priority-1",
      };

      const lowPriorityRequest: AllocationRequest = {
        memoryBytes: 512 * 1024 * 1024,
        cpuCount: 2,
        priority: "low",
        taskId: "priority-2",
      };

      const highResult = allocator.allocate(highPriorityRequest);
      const lowResult = allocator.allocate(lowPriorityRequest);

      expect(highResult).toBeDefined();
      expect(lowResult).toBeDefined();
    });
  });
});
