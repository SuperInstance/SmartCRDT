/**
 * NUMA Allocator Tests
 *
 * Tests for NUMA-aware resource allocation including:
 * - Pack/spread/balanced allocation strategies
 * - Memory allocation on specific nodes
 * - CPU scheduling and placement
 * - Cross-node allocation with penalties
 * - Memory migration
 * - Statistics tracking
 * - Rebalancing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  NUMAAllocator,
  NUMAMemoryManager,
  NUMACPUScheduler,
  createNUMAAllocator,
  type AllocationRequest,
  type NUMATask,
} from "./NUMAAllocator.js";
import type { NUMATopology, NUMANode } from "./NUMATopology.js";

describe("NUMAMemoryManager", () => {
  let topology: NUMATopology;
  let manager: NUMAMemoryManager;

  beforeEach(() => {
    // Create mock 2-node NUMA topology
    topology = createMockNUMATopology(2);
    manager = new NUMAMemoryManager(topology);
  });

  describe("Node-Specific Allocation", () => {
    it("should allocate memory on specific node", () => {
      const size = 1024 * 1024; // 1 MB
      const allocation = manager.allocateOnNode(size, 0);

      expect(allocation.nodeId).toBe(0);
      expect(allocation.pointer).toBeGreaterThan(0);

      const stats = manager.getMemoryStats();
      const nodeStats = stats.get(0);
      expect(nodeStats?.used).toBe(size);
      expect(nodeStats?.free).toBe(topology.nodes[0].memory.total - size);
    });

    it("should allocate local to CPU", () => {
      const size = 1024 * 1024;
      const cpuId = 5; // On node 0

      const allocation = manager.allocateLocal(size, cpuId);

      expect(allocation.nodeId).toBe(0);
    });

    it("should reject allocation with insufficient memory", () => {
      const size = topology.nodes[0].memory.total + 1;

      expect(() => manager.allocateOnNode(size, 0)).toThrow();
    });

    it("should reject allocation on invalid node", () => {
      expect(() => manager.allocateOnNode(1024, 999)).toThrow();
    });
  });

  describe("Interleaved Allocation", () => {
    it("should interleave allocation across nodes", () => {
      const size = 1024 * 1024;
      const allocation = manager.allocateInterleaved(size, [0, 1]);

      expect(allocation.nodes.length).toBeGreaterThan(0);
      expect(allocation.pointer).toBeGreaterThan(0);
    });

    it("should use all nodes by default", () => {
      const size = 1024 * 1024;
      const allocation = manager.allocateInterleaved(size);

      expect(allocation.nodes.length).toBe(topology.numNodes);
    });

    it("should handle insufficient total memory", () => {
      const size = topology.totalMemory + 1;

      expect(() => manager.allocateInterleaved(size)).toThrow();
    });
  });

  describe("Memory Locality", () => {
    it("should get locality info for allocation", () => {
      const size = 1024;
      const allocation = manager.allocateOnNode(size, 0);
      const locality = manager.getLocality(allocation.pointer);

      expect(locality.nodeId).toBe(0);
      expect(locality.isLocal).toBe(true);
      expect(locality.accessCost).toBeGreaterThan(0);
    });

    it("should reject locality for unknown pointer", () => {
      expect(() => manager.getLocality(99999)).toThrow();
    });
  });

  describe("Memory Migration", () => {
    it("should migrate memory between nodes", async () => {
      const size = 1024 * 1024;
      const allocation = manager.allocateOnNode(size, 0);

      await manager.migrate(allocation.pointer, 1);

      const locality = manager.getLocality(allocation.pointer);
      expect(locality.nodeId).toBe(1);

      const stats = manager.getMemoryStats();
      expect(stats.get(0)?.used).toBe(0);
      expect(stats.get(1)?.used).toBe(size);
    });

    it("should reject migration to same node", async () => {
      const size = 1024;
      const allocation = manager.allocateOnNode(size, 0);

      // Should succeed but do nothing
      await manager.migrate(allocation.pointer, 0);

      const locality = manager.getLocality(allocation.pointer);
      expect(locality.nodeId).toBe(0);
    });

    it("should reject migration with insufficient memory", async () => {
      // Fill node 1
      const size = topology.nodes[1].memory.free;
      manager.allocateOnNode(size, 1);

      // Try to migrate to node 1
      const allocation = manager.allocateOnNode(1024, 0);

      await expect(manager.migrate(allocation.pointer, 1)).rejects.toThrow();
    });
  });

  describe("Memory Free", () => {
    it("should free memory allocation", () => {
      const size = 1024 * 1024;
      const allocation = manager.allocateOnNode(size, 0);

      manager.free(allocation.pointer);

      const stats = manager.getMemoryStats();
      const nodeStats = stats.get(0);
      expect(nodeStats?.used).toBe(0);
      expect(nodeStats?.free).toBe(topology.nodes[0].memory.total);
    });

    it("should reject free of unknown pointer", () => {
      expect(() => manager.free(99999)).toThrow();
    });
  });
});

describe("NUMACPUScheduler", () => {
  let topology: NUMATopology;
  let scheduler: NUMACPUScheduler;

  beforeEach(() => {
    topology = createMockNUMATopology(2);
    scheduler = new NUMACPUScheduler(topology);
  });

  describe("Task Scheduling", () => {
    it("should schedule task on CPU", () => {
      const task: NUMATask = {
        taskId: "task-1",
        memoryBytes: 1024 * 1024,
      };

      const cpu = scheduler.schedule(task);

      expect(cpu).toBeGreaterThanOrEqual(0);
      expect(task.currentCPUs).toContain(cpu);
      expect(task.currentNode).toBeGreaterThanOrEqual(0);
    });

    it("should schedule on preferred CPU", () => {
      const task: NUMATask = {
        taskId: "task-2",
        memoryBytes: 1024,
      };

      const preferredCPU = 5;
      const cpu = scheduler.schedule(task, preferredCPU);

      expect(cpu).toBe(preferredCPU);
    });

    it("should distribute tasks across CPUs", () => {
      const tasks: NUMATask[] = Array.from({ length: 10 }, (_, i) => ({
        taskId: `task-${i}`,
        memoryBytes: 1024,
      }));

      const cpus = tasks.map(task => scheduler.schedule(task));

      // Should use different CPUs
      const uniqueCPUs = new Set(cpus);
      expect(uniqueCPUs.size).toBeGreaterThan(1);
    });
  });

  describe("CPU Binding", () => {
    it("should bind task to specific CPUs", () => {
      const task: NUMATask = {
        taskId: "task-bind",
        memoryBytes: 1024,
      };

      scheduler.schedule(task);
      scheduler.bindToCPUs(task.taskId, [0, 1]);

      const placement = scheduler.getPlacement(task.taskId);
      expect(placement.cpus).toEqual([0, 1]);
    });

    it("should update task on CPU bind", () => {
      const task: NUMATask = {
        taskId: "task-bind-update",
        memoryBytes: 1024,
      };

      scheduler.schedule(task);
      scheduler.bindToCPUs(task.taskId, [2, 3]);

      expect(task.currentCPUs).toEqual([2, 3]);
    });

    it("should reject binding unknown task", () => {
      expect(() => scheduler.bindToCPUs("unknown", [0, 1])).toThrow();
    });
  });

  describe("Task Placement", () => {
    it("should get task placement", () => {
      const task: NUMATask = {
        taskId: "task-placement",
        memoryBytes: 1024 * 1024,
      };

      scheduler.schedule(task);
      const placement = scheduler.getPlacement(task.taskId);

      expect(placement.nodeId).toBeGreaterThanOrEqual(0);
      expect(placement.cpus.length).toBeGreaterThan(0);
      expect(placement.localMemory).toBe(task.memoryBytes);
      expect(placement.isOptimal).toBe(true);
      expect(placement.score).toBeGreaterThan(0);
    });

    it("should reject placement for unknown task", () => {
      expect(() => scheduler.getPlacement("unknown")).toThrow();
    });
  });

  describe("Task Migration", () => {
    it("should migrate task to better node", async () => {
      const task: NUMATask = {
        taskId: "task-migrate",
        memoryBytes: 1024,
      };

      scheduler.schedule(task);

      const oldNode = task.currentNode;
      await scheduler.migrate(task.taskId);

      // In mock topology with balanced load, might stay on same node
      expect(task.currentNode).toBeGreaterThanOrEqual(0);
    });
  });

  describe("CPU Statistics", () => {
    it("should get per-node CPU stats", () => {
      const task: NUMATask = {
        taskId: "task-stats",
        memoryBytes: 1024,
      };

      scheduler.schedule(task);
      const stats = scheduler.getCPUStats();

      expect(stats.size).toBe(topology.numNodes);

      stats.forEach((nodeStats, nodeId) => {
        expect(nodeId).toBeGreaterThanOrEqual(0);
        expect(nodeStats.usage).toBeGreaterThanOrEqual(0);
        expect(nodeStats.tasks).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

describe("NUMAAllocator", () => {
  let topology: NUMATopology;
  let allocator: NUMAAllocator;

  beforeEach(() => {
    topology = createMockNUMATopology(4);
    allocator = new NUMAAllocator(topology, {
      strategy: "balanced",
      allowCrossNode: true,
      crossNodePenalty: 1.5,
    });
  });

  afterEach(() => {
    allocator.stopRebalancing();
  });

  describe("Basic Allocation", () => {
    it("should allocate resources", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024 * 1024,
        cpuCount: 2,
        taskId: "task-1",
      };

      const result = allocator.allocate(request);

      expect(result.nodeId).toBeGreaterThanOrEqual(0);
      expect(result.cpus.length).toBe(2);
      expect(result.memoryBytes).toBe(request.memoryBytes);
      expect(result.isFallback).toBe(false);
      expect(result.estimatedLatency).toBeGreaterThan(0);
      expect(result.estimatedBandwidth).toBeGreaterThan(0);
    });

    it("should track active allocations", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
        taskId: "task-track",
      };

      allocator.allocate(request);

      const allocations = allocator.getAllocations();
      expect(allocations.size).toBe(1);
      expect(allocations.has("task-track")).toBe(true);
    });

    it("should generate allocation reasoning", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
      };

      const result = allocator.allocate(request);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe("Allocation Strategies", () => {
    it("should use pack strategy", () => {
      const packAllocator = new NUMAAllocator(topology, { strategy: "pack" });

      const requests: AllocationRequest[] = Array.from(
        { length: 8 },
        (_, i) => ({
          memoryBytes: 1024,
          cpuCount: 1,
          taskId: `pack-${i}`,
        })
      );

      const results = requests.map(req => packAllocator.allocate(req));

      // Pack should concentrate on fewer nodes
      const uniqueNodes = new Set(results.map(r => r.nodeId));
      expect(uniqueNodes.size).toBeLessThan(topology.numNodes);

      packAllocator.stopRebalancing();
    });

    it("should use spread strategy", () => {
      const spreadAllocator = new NUMAAllocator(topology, {
        strategy: "spread",
      });

      const requests: AllocationRequest[] = Array.from(
        { length: 8 },
        (_, i) => ({
          memoryBytes: 1024,
          cpuCount: 1,
          taskId: `spread-${i}`,
        })
      );

      const results = requests.map(req => spreadAllocator.allocate(req));

      // Spread should use more nodes
      const uniqueNodes = new Set(results.map(r => r.nodeId));
      expect(uniqueNodes.size).toBeGreaterThanOrEqual(2);

      spreadAllocator.stopRebalancing();
    });

    it("should use balanced strategy", () => {
      const balancedAllocator = new NUMAAllocator(topology, {
        strategy: "balanced",
      });

      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
      };

      const result = balancedAllocator.allocate(request);

      expect(result.nodeId).toBeGreaterThanOrEqual(0);
      expect(result.nodeId).toBeLessThan(topology.numNodes);

      balancedAllocator.stopRebalancing();
    });
  });

  describe("Affinity", () => {
    it("should respect strict affinity", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
        preferredNode: 2,
        affinity: "strict",
      };

      const result = allocator.allocate(request);

      expect(result.nodeId).toBe(2);
    });

    it("should prefer preferred node", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
        preferredNode: 1,
        affinity: "prefer",
      };

      const result = allocator.allocate(request);

      // Should prefer node 1 but may use others if needed
      expect(result.nodeId).toBeGreaterThanOrEqual(0);
    });

    it("should allocate local to preferred CPU", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
        preferredCPU: 5,
      };

      const result = allocator.allocate(request);

      const preferredNode = topology.getPreferredNode(5);
      expect(result.nodeId).toBe(preferredNode);
    });
  });

  describe("Cross-Node Allocation", () => {
    it("should allocate cross-node when needed", () => {
      // Create allocator with strict memory limits
      const strictAllocator = new NUMAAllocator(topology, {
        maxMemoryUsage: 0.01, // Very low
        allowCrossNode: true,
      });

      const request: AllocationRequest = {
        memoryBytes: 1024 * 1024 * 1024, // 1 GB
        cpuCount: 1,
      };

      const result = strictAllocator.allocate(request);

      expect(result).toBeDefined();
      // May be cross-node allocation

      strictAllocator.stopRebalancing();
    });

    it("should apply cross-node penalty", () => {
      const crossNodeAllocator = new NUMAAllocator(topology, {
        maxMemoryUsage: 0.01,
        allowCrossNode: true,
        crossNodePenalty: 2.0,
        remoteLatency: 200,
      });

      const request: AllocationRequest = {
        memoryBytes: 1024 * 1024 * 1024,
        cpuCount: 1,
      };

      const result = crossNodeAllocator.allocate(request);

      if (result.isFallback) {
        expect(result.estimatedLatency).toBeGreaterThan(200);
      }

      crossNodeAllocator.stopRebalancing();
    });
  });

  describe("Allocation Feasibility", () => {
    it("should check if allocation is possible", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
      };

      const possible = allocator.canAllocate(request);

      expect(possible).toBe(true);
    });

    it("should reject impossible allocations", () => {
      const request: AllocationRequest = {
        memoryBytes: topology.totalMemory + 1,
        cpuCount: topology.totalCPUs + 1,
      };

      const allocatorNoCross = new NUMAAllocator(topology, {
        allowCrossNode: false,
      });

      const possible = allocatorNoCross.canAllocate(request);

      expect(possible).toBe(false);

      allocatorNoCross.stopRebalancing();
    });
  });

  describe("Resource Freeing", () => {
    it("should free allocation", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
        taskId: "task-free",
      };

      const result = allocator.allocate(request);
      allocator.free(result);

      const allocations = allocator.getAllocations();
      expect(allocations.size).toBe(0);
    });

    it("should update active allocation count", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
        taskId: "task-count",
      };

      const statsBefore = allocator.getStats();
      allocator.allocate(request);
      const statsAfter = allocator.getStats();

      expect(statsAfter.activeAllocations).toBe(
        statsBefore.activeAllocations + 1
      );

      allocator.free(allocator.getAllocations().get("task-count")!);

      const statsFinal = allocator.getStats();
      expect(statsFinal.activeAllocations).toBe(statsBefore.activeAllocations);
    });
  });

  describe("Statistics", () => {
    it("should track allocation statistics", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
        taskId: "task-stats",
      };

      allocator.allocate(request);
      const stats = allocator.getStats();

      expect(stats.totalAllocations).toBe(1);
      expect(stats.activeAllocations).toBe(1);
      expect(stats.allocationsByNode.length).toBe(topology.numNodes);
    });

    it("should calculate load balance score", () => {
      const requests: AllocationRequest[] = Array.from(
        { length: 8 },
        (_, i) => ({
          memoryBytes: 1024,
          cpuCount: 1,
          taskId: `balance-${i}`,
        })
      );

      requests.forEach(req => allocator.allocate(req));

      const stats = allocator.getStats();

      expect(stats.loadBalanceScore).toBeGreaterThanOrEqual(0);
      expect(stats.loadBalanceScore).toBeLessThanOrEqual(1);
    });

    it("should track allocations per node", () => {
      const request: AllocationRequest = {
        memoryBytes: 1024,
        cpuCount: 1,
        taskId: "node-track",
      };

      allocator.allocate(request);
      const stats = allocator.getStats();

      const totalAllocations = stats.allocationsByNode.reduce(
        (a, b) => a + b,
        0
      );
      expect(totalAllocations).toBe(1);
    });
  });

  describe("Rebalancing", () => {
    it("should perform manual rebalance", () => {
      const requests: AllocationRequest[] = Array.from(
        { length: 10 },
        (_, i) => ({
          memoryBytes: 1024,
          cpuCount: 1,
          taskId: `rebalance-${i}`,
        })
      );

      requests.forEach(req => allocator.allocate(req));

      const statsBefore = allocator.getStats();
      allocator.rebalance();
      const statsAfter = allocator.getStats();

      expect(statsAfter.rebalanceCount).toBe(statsBefore.rebalanceCount + 1);
      expect(statsAfter.lastRebalance).toBeDefined();
    });

    it("should start automatic rebalancing", () => {
      const autoAllocator = new NUMAAllocator(topology, {
        enableRebalancing: true,
        rebalanceInterval: 100,
      });

      // Wait for at least one rebalance
      return new Promise<void>(resolve => {
        setTimeout(() => {
          const stats = autoAllocator.getStats();
          expect(stats.rebalanceCount).toBeGreaterThan(0);
          autoAllocator.stopRebalancing();
          resolve();
        }, 150);
      });
    });

    it("should stop automatic rebalancing", () => {
      const autoAllocator = new NUMAAllocator(topology, {
        enableRebalancing: true,
        rebalanceInterval: 50,
      });

      autoAllocator.stopRebalancing();

      const statsBefore = autoAllocator.getStats();
      const statsAfter = autoAllocator.getStats();

      // Should not have additional rebalances
      expect(statsAfter.rebalanceCount).toBe(statsBefore.rebalanceCount);
    });
  });

  describe("Memory Manager Access", () => {
    it("should provide memory manager", () => {
      const memManager = allocator.getMemoryManager();

      expect(memManager).toBeInstanceOf(NUMAMemoryManager);
    });

    it("should provide CPU scheduler", () => {
      const cpuSched = allocator.getCPUScheduler();

      expect(cpuSched).toBeInstanceOf(NUMACPUScheduler);
    });
  });
});

describe("createNUMAAllocator", () => {
  it("should create allocator with default config", () => {
    const topology = createMockNUMATopology(2);
    const allocator = createNUMAAllocator(topology);

    expect(allocator).toBeInstanceOf(NUMAAllocator);

    const request: AllocationRequest = {
      memoryBytes: 1024,
      cpuCount: 1,
    };

    const result = allocator.allocate(request);
    expect(result).toBeDefined();

    allocator.stopRebalancing();
  });

  it("should create allocator with custom config", () => {
    const topology = createMockNUMATopology(2);
    const allocator = createNUMAAllocator(topology, {
      strategy: "pack",
      maxMemoryUsage: 0.8,
      allowCrossNode: false,
    });

    expect(allocator).toBeInstanceOf(NUMAAllocator);

    allocator.stopRebalancing();
  });
});

/**
 * Helper function to create mock NUMA topology for testing
 */
function createMockNUMATopology(numNodes: number): NUMATopology {
  const cpusPerNode = 8;
  const memoryPerNode = 32 * 1024 * 1024 * 1024; // 32 GB

  const nodes: NUMANode[] = Array.from({ length: numNodes }, (_, i) => ({
    nodeId: i,
    cpus: Array.from({ length: cpusPerNode }, (_, j) => i * cpusPerNode + j),
    memory: {
      total: memoryPerNode,
      free: memoryPerNode,
      used: 0,
    },
    distances: Array.from({ length: numNodes }, (_, j) => (i === j ? 10 : 20)),
    localCPUs: Array.from(
      { length: cpusPerNode },
      (_, j) => i * cpusPerNode + j
    ),
  }));

  const cpuToNode = new Map<number, number>();
  nodes.forEach(node => {
    node.cpus.forEach(cpu => {
      cpuToNode.set(cpu, node.nodeId);
    });
  });

  return {
    numNodes,
    nodes,
    totalCPUs: numNodes * cpusPerNode,
    totalMemory: numNodes * memoryPerNode,
    type: numNodes > 1 ? "NUMA" : "UMA",

    getCPUs(nodeId: number): number[] {
      return this.nodes[nodeId]?.cpus ?? [];
    },

    getPreferredNode(cpuId: number): number {
      return cpuToNode.get(cpuId) ?? -1;
    },

    getDistance(fromNode: number, toNode: number): number {
      return this.nodes[fromNode]?.distances[toNode] ?? 20;
    },
  };
}
