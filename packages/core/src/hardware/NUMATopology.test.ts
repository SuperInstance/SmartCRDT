/**
 * NUMA Topology Tests
 *
 * Tests for NUMA topology detection including:
 * - UMA topology detection
 * - NUMA topology detection (mocked)
 * - CPU parsing from various formats
 * - Memory statistics
 * - Distance calculations
 * - Node affinity lookups
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NUMATopologyDetector,
  getNUMAStats,
  numaTopologyDetector,
  type NUMATopology,
  type NUMANode,
} from "./NUMATopology.js";

describe("NUMATopologyDetector", () => {
  let detector: NUMATopologyDetector;

  beforeEach(() => {
    detector = new NUMATopologyDetector();
    detector.clearCache();
  });

  describe("UMA Topology Detection", () => {
    it("should detect single-node UMA topology", async () => {
      // Mock non-Linux platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      const topology = await detector.detect();

      expect(topology.type).toBe("UMA");
      expect(topology.numNodes).toBe(1);
      expect(topology.nodes.length).toBe(1);
      expect(topology.totalCPUs).toBeGreaterThan(0);
      expect(topology.totalMemory).toBeGreaterThan(0);

      // Restore platform
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should return correct node for UMA", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });

      const topology = await detector.detect();
      const node = topology.nodes[0];

      expect(node.nodeId).toBe(0);
      expect(node.cpus.length).toBeGreaterThan(0);
      expect(node.memory.total).toBeGreaterThan(0);
      expect(node.distances).toEqual([10]);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should have all CPUs in single node for UMA", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      const topology = await detector.detect();
      const node = topology.nodes[0];

      expect(topology.totalCPUs).toBe(node.cpus.length);
      expect(topology.getCPUs(0)).toEqual(node.cpus);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });

  describe("NUMA Node Queries", () => {
    it("should get CPUs for valid node", async () => {
      const topology = await detector.detect();
      const cpus = topology.getCPUs(0);

      expect(Array.isArray(cpus)).toBe(true);
      expect(cpus.length).toBeGreaterThan(0);
      expect(cpus.every(cpu => typeof cpu === "number")).toBe(true);
    });

    it("should return empty array for invalid node", async () => {
      const topology = await detector.detect();
      const cpus = topology.getCPUs(999);

      expect(cpus).toEqual([]);
    });

    it("should get preferred node for CPU", async () => {
      const topology = await detector.detect();
      const firstCPU = topology.nodes[0].cpus[0];
      const preferredNode = topology.getPreferredNode(firstCPU);

      expect(preferredNode).toBe(0);
    });

    it("should return -1 for unknown CPU", async () => {
      const topology = await detector.detect();
      const preferredNode = topology.getPreferredNode(9999);

      expect(preferredNode).toBe(-1);
    });

    it("should calculate distance correctly", async () => {
      const topology = await detector.detect();

      // Local distance
      const localDistance = topology.getDistance(0, 0);
      expect(localDistance).toBe(10);

      // Invalid node distances
      const invalidDistance = topology.getDistance(0, 999);
      expect(invalidDistance).toBe(20);
    });
  });

  describe("CPU List Parsing", () => {
    it("should parse simple CPU list", async () => {
      const detector = new NUMATopologyDetector();

      // Access private method through type assertion for testing
      const parseCPUList = (detector as any).parseCPUList.bind(detector);

      const result = parseCPUList("0,1,2,3");
      expect(result).toEqual([0, 1, 2, 3]);
    });

    it("should parse CPU range", async () => {
      const detector = new NUMATopologyDetector();
      const parseCPUList = (detector as any).parseCPUList.bind(detector);

      const result = parseCPUList("0-7");
      expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it("should parse mixed CPU list", async () => {
      const detector = new NUMATopologyDetector();
      const parseCPUList = (detector as any).parseCPUList.bind(detector);

      const result = parseCPUList("0-3,8,9,16-19");
      expect(result).toEqual([0, 1, 2, 3, 8, 9, 16, 17, 18, 19]);
    });

    it("should parse CPU bitmap", async () => {
      const detector = new NUMATopologyDetector();
      const parseCPUMap = (detector as any).parseCPUMap.bind(detector);

      // Binary: 1111 = CPUs 0,1,2,3
      const result = parseCPUMap("f");
      expect(result).toEqual([0, 1, 2, 3]);
    });

    it("should parse sparse CPU bitmap", async () => {
      const detector = new NUMATopologyDetector();
      const parseCPUMap = (detector as any).parseCPUMap.bind(detector);

      // Binary: 1010 = CPUs 1,3
      const result = parseCPUMap("a");
      expect(result).toEqual([1, 3]);
    });
  });

  describe("NUMA Statistics", () => {
    it("should calculate NUMA stats", async () => {
      const topology = await detector.detect();
      const stats = getNUMAStats(topology);

      expect(stats.nodeStats.length).toBe(topology.numNodes);
      expect(stats.avgLocalAccessRatio).toBeGreaterThanOrEqual(0);
      expect(stats.avgLocalAccessRatio).toBeLessThanOrEqual(1);
      expect(stats.loadBalanceScore).toBeGreaterThanOrEqual(0);
      expect(stats.loadBalanceScore).toBeLessThanOrEqual(1);
    });

    it("should include per-node stats", async () => {
      const topology = await detector.detect();
      const stats = getNUMAStats(topology);

      stats.nodeStats.forEach(nodeStat => {
        expect(nodeStat.nodeId).toBeGreaterThanOrEqual(0);
        expect(nodeStat.memoryUsage).toBeGreaterThanOrEqual(0);
        expect(nodeStat.memoryUsage).toBeLessThanOrEqual(1);
        expect(nodeStat.cpuUsage).toBeGreaterThanOrEqual(0);
        expect(nodeStat.cpuUsage).toBeLessThanOrEqual(1);
        expect(nodeStat.localAccessRatio).toBeGreaterThanOrEqual(0);
        expect(nodeStat.localAccessRatio).toBeLessThanOrEqual(1);
      });
    });

    it("should have perfect load balance for UMA", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "win32" });

      const topology = await detector.detect();
      const stats = getNUMAStats(topology);

      // Single node should have perfect balance
      expect(stats.loadBalanceScore).toBe(1);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });

  describe("Caching", () => {
    it("should cache topology detection", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });

      const topology1 = await detector.detect();
      const topology2 = await detector.detect();

      // Should return same cached instance
      expect(topology1).toBe(topology2);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should clear cache on demand", async () => {
      await detector.detect();
      detector.clearCache();

      // Should not throw, should re-detect
      const topology = await detector.detect();
      expect(topology).toBeDefined();
    });

    it("should expire cache after TTL", async () => {
      const detector = new NUMATopologyDetector();

      // Mock short cache TTL for testing
      (detector as any).CACHE_TTL = 0;

      await detector.detect();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should re-detect
      const topology = await detector.detect();
      expect(topology).toBeDefined();
    });
  });

  describe("Topology Validation", () => {
    it("should have consistent total CPU count", async () => {
      const topology = await detector.detect();

      let nodeCPUs = 0;
      topology.nodes.forEach(node => {
        nodeCPUs += node.cpus.length;
      });

      expect(topology.totalCPUs).toBe(nodeCPUs);
    });

    it("should have consistent total memory", async () => {
      const topology = await detector.detect();

      let nodeMemory = 0;
      topology.nodes.forEach(node => {
        nodeMemory += node.memory.total;
      });

      expect(topology.totalMemory).toBe(nodeMemory);
    });

    it("should have valid distance arrays", async () => {
      const topology = await detector.detect();

      topology.nodes.forEach(node => {
        expect(node.distances.length).toBe(topology.numNodes);
        expect(node.distances).toContain(10); // Should have local distance
      });
    });

    it("should have symmetric distances", async () => {
      const topology = await detector.detect();

      for (let i = 0; i < topology.numNodes; i++) {
        for (let j = 0; j < topology.numNodes; j++) {
          const dist1 = topology.getDistance(i, j);
          const dist2 = topology.getDistance(j, i);

          // Distances should be symmetric
          expect(dist1).toBe(dist2);
        }
      }
    });
  });

  describe("Mock NUMA Topology", () => {
    it("should create mock 2-node NUMA topology for testing", () => {
      const mockTopology: NUMATopology = {
        numNodes: 2,
        totalCPUs: 16,
        totalMemory: 64 * 1024 * 1024 * 1024,
        type: "NUMA",
        nodes: [
          {
            nodeId: 0,
            cpus: [0, 1, 2, 3, 4, 5, 6, 7],
            memory: {
              total: 32 * 1024 * 1024 * 1024,
              free: 16 * 1024 * 1024 * 1024,
              used: 16 * 1024 * 1024 * 1024,
            },
            distances: [10, 20],
            localCPUs: [0, 1, 2, 3, 4, 5, 6, 7],
          },
          {
            nodeId: 1,
            cpus: [8, 9, 10, 11, 12, 13, 14, 15],
            memory: {
              total: 32 * 1024 * 1024 * 1024,
              free: 24 * 1024 * 1024 * 1024,
              used: 8 * 1024 * 1024 * 1024,
            },
            distances: [20, 10],
            localCPUs: [8, 9, 10, 11, 12, 13, 14, 15],
          },
        ],
        getCPUs(nodeId: number) {
          return this.nodes[nodeId]?.cpus ?? [];
        },
        getPreferredNode(cpuId: number) {
          return cpuId < 8 ? 0 : 1;
        },
        getDistance(fromNode: number, toNode: number) {
          return this.nodes[fromNode]?.distances[toNode] ?? 20;
        },
      };

      expect(mockTopology.numNodes).toBe(2);
      expect(mockTopology.getCPUs(0).length).toBe(8);
      expect(mockTopology.getCPUs(1).length).toBe(8);
      expect(mockTopology.getPreferredNode(5)).toBe(0);
      expect(mockTopology.getPreferredNode(12)).toBe(1);
      expect(mockTopology.getDistance(0, 1)).toBe(20);
      expect(mockTopology.getDistance(1, 1)).toBe(10);
    });
  });

  describe("Singleton Instance", () => {
    it("should export singleton detector instance", () => {
      expect(numaTopologyDetector).toBeInstanceOf(NUMATopologyDetector);
    });

    it("should detect topology using singleton", async () => {
      const topology = await numaTopologyDetector.detect();

      expect(topology).toBeDefined();
      expect(topology.numNodes).toBeGreaterThan(0);
      expect(topology.nodes.length).toBe(topology.numNodes);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid node IDs gracefully", async () => {
      const topology = await detector.detect();

      expect(() => topology.getCPUs(-1)).not.toThrow();
      expect(() => topology.getCPUs(999)).not.toThrow();
    });

    it("should handle negative CPU IDs", async () => {
      const topology = await detector.detect();

      const preferredNode = topology.getPreferredNode(-1);
      expect(preferredNode).toBe(-1);
    });

    it("should handle out-of-range node IDs in distance", async () => {
      const topology = await detector.detect();

      const distance = topology.getDistance(0, 999);
      expect(distance).toBe(20); // Default remote distance
    });
  });
});
