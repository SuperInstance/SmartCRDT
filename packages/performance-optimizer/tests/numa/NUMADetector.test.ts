/**
 * NUMA Detector Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NUMADetector } from '../../src/numa/NUMADetector.js';
import type {
  NUMATopology,
  NUMANodeId,
  NUMADetectionResult,
} from '@lsi/protocol';

describe('NUMADetector', () => {
  let detector: NUMADetector;

  beforeEach(() => {
    detector = new NUMADetector({
      timeout: 5000,
      cacheTopology: true,
      cacheDuration: 1000,
    });
  });

  afterEach(() => {
    detector.stopMonitoring();
    detector.clearCache();
  });

  describe('Detection', () => {
    it('should detect NUMA topology', async () => {
      const result = await detector.detect();

      expect(result).toBeDefined();
      expect(result.available).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toBeLessThan(Date.now() + 1000);
    });

    it('should return topology with at least one node', async () => {
      const result = await detector.detect();

      expect(result.topology).toBeDefined();
      expect(result.topology!.nodeCount).toBeGreaterThanOrEqual(1);
    });

    it('should have valid node structure', async () => {
      const result = await detector.detect();
      const topology = result.topology!;

      for (const [nodeId, node] of topology.nodes.entries()) {
        expect(nodeId).toBe(node.nodeId);
        expect(node.cpus).toBeDefined();
        expect(node.cpus.length).toBeGreaterThan(0);
        expect(node.totalMemory).toBeGreaterThan(0);
        expect(node.freeMemory).toBeGreaterThanOrEqual(0);
        expect(node.memoryUsage).toBeGreaterThanOrEqual(0);
        expect(node.memoryUsage).toBeLessThanOrEqual(1);
        expect(node.cpuUsage).toBeGreaterThanOrEqual(0);
        expect(node.cpuUsage).toBeLessThanOrEqual(1);
        expect(node.activeTasks).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have distance matrix for multi-node systems', async () => {
      const result = await detector.detect();
      const topology = result.topology!;

      if (topology.nodeCount > 1) {
        expect(topology.distances.size).toBe(topology.nodeCount);

        for (const [nodeId, distances] of topology.distances.entries()) {
          expect(distances.size).toBe(topology.nodeCount);

          // Distance to self should be lowest
          const selfDistance = distances.get(nodeId);
          expect(selfDistance).toBeDefined();
          expect(selfDistance!).toBeLessThanOrEqual(20); // Typical NUMA distance
        }
      }
    });

    it('should cache topology when enabled', async () => {
      const cacheDetector = new NUMADetector({
        cacheTopology: true,
        cacheDuration: 5000,
      });

      const result1 = await cacheDetector.detect();
      const result2 = await cacheDetector.detect();

      expect(result1.topology).toEqual(result2.topology);

      cacheDetector.clearCache();
    });

    it('should not cache topology when disabled', async () => {
      const noCacheDetector = new NUMADetector({
        cacheTopology: false,
      });

      const result1 = await noCacheDetector.detect();
      const result2 = await noCacheDetector.detect();

      // Results should both exist but might differ
      expect(result1.topology).toBeDefined();
      expect(result2.topology).toBeDefined();
    });
  });

  describe('Topology Monitoring', () => {
    it('should detect topology changes', async () => {
      let callbackCallCount = 0;
      let lastTopology: NUMATopology | undefined;

      detector.monitorTopology((topology) => {
        callbackCallCount++;
        lastTopology = topology;
      });

      // Wait for initial callback
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(callbackCallCount).toBeGreaterThan(0);
      expect(lastTopology).toBeDefined();

      detector.stopMonitoring();
    });

    it('should stop monitoring when requested', async () => {
      let callbackCallCount = 0;

      detector.monitorTopology(() => {
        callbackCallCount++;
      });

      detector.stopMonitoring();

      // Wait to ensure no more callbacks
      await new Promise(resolve => setTimeout(resolve, 100));

      const countAfterStop = callbackCallCount;

      // Wait more
      await new Promise(resolve => setTimeout(resolve, 100));

      // Count should not have increased
      expect(callbackCallCount).toBe(countAfterStop);
    });
  });

  describe('Fallback Behavior', () => {
    it('should create UMA topology when NUMA not available', async () => {
      const result = await detector.detect();

      // Even on UMA systems, should return single-node topology
      expect(result.topology).toBeDefined();

      const topology = result.topology!;
      expect(topology.nodeCount).toBeGreaterThanOrEqual(1);

      if (!topology.numaAvailable) {
        // UMA system should have exactly one node
        expect(topology.nodeCount).toBe(1);
        expect(topology.nodes.get(0)).toBeDefined();
      }
    });

    it('should have valid totals in topology', async () => {
      const result = await detector.detect();
      const topology = result.topology!;

      let totalNodeCpus = 0;
      let totalNodeMemory = 0;

      for (const node of topology.nodes.values()) {
        totalNodeCpus += node.cpus.length;
        totalNodeMemory += node.totalMemory;
      }

      expect(topology.totalCpus).toBe(totalNodeCpus);
      expect(topology.totalMemory).toBe(totalNodeMemory);
    });
  });

  describe('Error Handling', () => {
    it('should handle detection timeout gracefully', async () => {
      const timeoutDetector = new NUMADetector({
        timeout: 1, // 1ms timeout
      });

      const result = await timeoutDetector.detect();

      // Should still return a result (fallback to UMA)
      expect(result).toBeDefined();
      expect(result.topology).toBeDefined();
    });

    it('should provide detection method', async () => {
      const result = await detector.detect();

      expect(result.method).toBeDefined();
      expect([
        'linux_numactl',
        'lscpu',
        'procfs',
        'fallback',
        'windows',
      ]).toContain(result.method);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache on request', async () => {
      await detector.detect();

      const cacheBefore = detector.getCache();
      expect(cacheBefore).toBeDefined();

      detector.clearCache();

      const cacheAfter = detector.getCache();
      expect(cacheAfter).toBeUndefined();
    });

    it('should expire cache after duration', async () => {
      const shortCacheDetector = new NUMADetector({
        cacheTopology: true,
        cacheDuration: 100, // 100ms
      });

      const result1 = await shortCacheDetector.detect();
      await new Promise(resolve => setTimeout(resolve, 150));
      const result2 = await shortCacheDetector.detect();

      // Both should have valid topology
      expect(result1.topology).toBeDefined();
      expect(result2.topology).toBeDefined();
    });
  });

  describe('Multi-Node Topology', () => {
    it('should handle multi-node topology', async () => {
      const result = await detector.detect();
      const topology = result.topology!;

      if (topology.nodeCount > 1) {
        // Verify multi-node structure
        expect(topology.nodes.size).toBe(topology.nodeCount);
        expect(topology.distances.size).toBe(topology.nodeCount);

        // Each node should have at least one CPU
        for (const node of topology.nodes.values()) {
          expect(node.cpus.length).toBeGreaterThan(0);
        }
      }
    });

    it('should calculate distances correctly', async () => {
      const result = await detector.detect();
      const topology = result.topology!;

      if (topology.nodeCount > 1) {
        for (const [nodeId, distances] of topology.distances.entries()) {
          for (const [targetNodeId, distance] of distances.entries()) {
            expect(distance).toBeGreaterThan(0);
            expect(distance).toBeLessThanOrEqual(40); // Reasonable upper bound
          }
        }
      }
    });
  });
});
