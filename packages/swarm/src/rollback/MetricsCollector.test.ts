/**
 * @lsi/swarm/rollback - MetricsCollector Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MetricsCollector } from "./MetricsCollector.js";
import type { MetricsSnapshot, Node } from "@lsi/protocol";

describe("MetricsCollector", () => {
  let collector: MetricsCollector;
  let mockNodes: Node[];

  beforeEach(() => {
    collector = new MetricsCollector();
    mockNodes = [
      {
        id: "node-1",
        address: "localhost",
        port: 3001,
        role: "leader",
        status: "online",
        lastHeartbeat: Date.now(),
      },
      {
        id: "node-2",
        address: "localhost",
        port: 3002,
        role: "follower",
        status: "online",
        lastHeartbeat: Date.now(),
      },
      {
        id: "node-3",
        address: "localhost",
        port: 3003,
        role: "follower",
        status: "online",
        lastHeartbeat: Date.now(),
      },
    ];
  });

  describe("collectBefore", () => {
    it("should collect metrics before rollback", async () => {
      const snapshots = await collector.collectBefore(mockNodes, "rollback-1");

      expect(snapshots).toHaveLength(3);
      expect(snapshots[0]).toHaveProperty("nodeId");
      expect(snapshots[0]).toHaveProperty("timestamp");
      expect(snapshots[0]).toHaveProperty("errorRate");
      expect(snapshots[0]).toHaveProperty("avgLatency");
      expect(snapshots[0]).toHaveProperty("throughput");
      expect(snapshots[0]).toHaveProperty("qualityScore");
    });

    it("should store snapshots for retrieval", async () => {
      await collector.collectBefore(mockNodes, "rollback-1");

      const stored = collector.getSnapshots("rollback-1", "before");
      expect(stored).toHaveLength(3);
    });
  });

  describe("collectAfter", () => {
    it("should collect metrics after rollback", async () => {
      const snapshots = await collector.collectAfter(mockNodes, "rollback-1");

      expect(snapshots).toHaveLength(3);
      expect(snapshots[0]).toHaveProperty("nodeId");
      expect(snapshots[0]).toHaveProperty("timestamp");
    });

    it("should store after snapshots separately", async () => {
      await collector.collectBefore(mockNodes, "rollback-1");
      await collector.collectAfter(mockNodes, "rollback-1");

      const before = collector.getSnapshots("rollback-1", "before");
      const after = collector.getSnapshots("rollback-1", "after");

      expect(before).toHaveLength(3);
      expect(after).toHaveLength(3);
    });
  });

  describe("streamMetrics", () => {
    it("should stream metrics during rollback", async () => {
      const callback = vi.fn();

      // Start streaming
      await collector.streamMetrics(mockNodes, "rollback-2", callback, 100);

      // Wait a bit for initial metrics
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(callback).toHaveBeenCalled();

      // Stop streaming
      collector.stopStreaming("rollback-2");

      // Wait for interval to clear
      await new Promise(resolve => setTimeout(resolve, 150));

      const callCount = callback.mock.calls.length;
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should not have more calls after stopping
      expect(callback).toHaveBeenCalledTimes(callCount);
    });

    it("should send updates for all nodes", async () => {
      const callback = vi.fn();

      await collector.streamMetrics(mockNodes, "rollback-3", callback, 100);

      await new Promise(resolve => setTimeout(resolve, 50));

      const updates = callback.mock.calls.map(call => call[0]);
      const nodeIds = new Set(updates.map((u: any) => u.nodeId));

      expect(nodeIds.size).toBe(3);
      expect(nodeIds.has("node-1")).toBe(true);

      collector.stopStreaming("rollback-3");
    });

    it("should track active sessions", async () => {
      const callback = vi.fn();

      expect(collector.getActiveSessions()).toEqual([]);

      await collector.streamMetrics(mockNodes, "rollback-4", callback, 100);

      expect(collector.getActiveSessions()).toContain("rollback-4");

      collector.stopStreaming("rollback-4");

      expect(collector.getActiveSessions()).not.toContain("rollback-4");
    });

    it("should stop all streaming sessions", async () => {
      const callback = vi.fn();

      await collector.streamMetrics(mockNodes, "rollback-5a", callback, 100);
      await collector.streamMetrics(mockNodes, "rollback-5b", callback, 100);

      expect(collector.getActiveSessions().length).toBeGreaterThanOrEqual(2);

      collector.stopAllStreaming();

      expect(collector.getActiveSessions()).toEqual([]);
    });
  });

  describe("aggregateMetrics", () => {
    it("should aggregate metrics from multiple snapshots", () => {
      const snapshots: MetricsSnapshot[] = [
        {
          timestamp: Date.now(),
          errorRate: 0.1,
          avgLatency: 100,
          p95Latency: 150,
          p99Latency: 200,
          throughput: 1000,
          qualityScore: 0.9,
        },
        {
          timestamp: Date.now(),
          errorRate: 0.2,
          avgLatency: 200,
          p95Latency: 250,
          p99Latency: 300,
          throughput: 800,
          qualityScore: 0.8,
        },
        {
          timestamp: Date.now(),
          errorRate: 0.15,
          avgLatency: 150,
          p95Latency: 200,
          p99Latency: 250,
          throughput: 900,
          qualityScore: 0.85,
        },
      ];

      const aggregate = collector.aggregateMetrics(snapshots);

      expect(aggregate.errorRate).toBeCloseTo(0.15, 2);
      expect(aggregate.avgLatency).toBeCloseTo(150, 0);
      expect(aggregate.throughput).toBeCloseTo(900, 0);
      expect(aggregate.qualityScore).toBeCloseTo(0.85, 2);
      expect(aggregate.nodeCount).toBe(3);
    });

    it("should throw error on empty snapshots", () => {
      expect(() => collector.aggregateMetrics([])).toThrow(
        "Cannot aggregate empty snapshots"
      );
    });
  });

  describe("getRollbackAggregates", () => {
    it("should return before and after aggregates", async () => {
      await collector.collectBefore(mockNodes, "rollback-6");
      await collector.collectAfter(mockNodes, "rollback-6");

      const aggregates = await collector.getRollbackAggregates("rollback-6");

      expect(aggregates.before).toBeDefined();
      expect(aggregates.after).toBeDefined();
      expect(aggregates.before?.nodeCount).toBe(3);
      expect(aggregates.after?.nodeCount).toBe(3);
    });

    it("should return only before if after not collected", async () => {
      await collector.collectBefore(mockNodes, "rollback-7");

      const aggregates = await collector.getRollbackAggregates("rollback-7");

      expect(aggregates.before).toBeDefined();
      expect(aggregates.after).toBeUndefined();
    });

    it("should return undefined for non-existent rollback", async () => {
      const aggregates = await collector.getRollbackAggregates("non-existent");

      expect(aggregates.before).toBeUndefined();
      expect(aggregates.after).toBeUndefined();
    });
  });

  describe("calculateImprovement", () => {
    it("should calculate positive improvement", () => {
      const before: MetricsSnapshot = {
        timestamp: Date.now(),
        errorRate: 0.2,
        avgLatency: 1000,
        p95Latency: 1500,
        p99Latency: 2000,
        throughput: 500,
        qualityScore: 0.7,
      };

      const after: MetricsSnapshot = {
        timestamp: Date.now(),
        errorRate: 0.05,
        avgLatency: 200,
        p95Latency: 300,
        p99Latency: 400,
        throughput: 1000,
        qualityScore: 0.95,
      };

      const improvement = collector.calculateImprovement(before, after);

      expect(improvement.errorRateImprovement).toBeGreaterThan(0);
      expect(improvement.latencyImprovement).toBeGreaterThan(0);
      expect(improvement.throughputImprovement).toBeGreaterThan(0);
      expect(improvement.qualityImprovement).toBeGreaterThan(0);
      expect(improvement.overallImprovement).toBeGreaterThan(0);
    });

    it("should calculate negative improvement for degradation", () => {
      const before: MetricsSnapshot = {
        timestamp: Date.now(),
        errorRate: 0.05,
        avgLatency: 200,
        p95Latency: 300,
        p99Latency: 400,
        throughput: 1000,
        qualityScore: 0.95,
      };

      const after: MetricsSnapshot = {
        timestamp: Date.now(),
        errorRate: 0.2,
        avgLatency: 1000,
        p95Latency: 1500,
        p99Latency: 2000,
        throughput: 500,
        qualityScore: 0.7,
      };

      const improvement = collector.calculateImprovement(before, after);

      expect(improvement.errorRateImprovement).toBeLessThan(0);
      expect(improvement.latencyImprovement).toBeLessThan(0);
      expect(improvement.throughputImprovement).toBeLessThan(0);
      expect(improvement.qualityImprovement).toBeLessThan(0);
      expect(improvement.overallImprovement).toBeLessThan(0);
    });

    it("should work with aggregate metrics", () => {
      const before = {
        errorRate: 0.2,
        avgLatency: 1000,
        p95Latency: 1500,
        p99Latency: 2000,
        throughput: 500,
        qualityScore: 0.7,
        nodeCount: 3,
        timestamp: Date.now(),
      };

      const after = {
        errorRate: 0.05,
        avgLatency: 200,
        p95Latency: 300,
        p99Latency: 400,
        throughput: 1000,
        qualityScore: 0.95,
        nodeCount: 3,
        timestamp: Date.now(),
      };

      const improvement = collector.calculateImprovement(before, after);

      expect(improvement.overallImprovement).toBeGreaterThan(0);
    });
  });

  describe("snapshot storage", () => {
    it("should get snapshots without type", async () => {
      await collector.collectBefore(mockNodes, "rollback-8");

      const snapshots = collector.getSnapshots("rollback-8-before");
      expect(snapshots).toHaveLength(3);
    });

    it("should clear specific rollback snapshots", async () => {
      await collector.collectBefore(mockNodes, "rollback-9");
      await collector.collectAfter(mockNodes, "rollback-9");

      collector.clearSnapshots("rollback-9");

      expect(collector.getSnapshots("rollback-9", "before")).toEqual([]);
      expect(collector.getSnapshots("rollback-9", "after")).toEqual([]);
    });

    it("should clear all snapshots", async () => {
      await collector.collectBefore(mockNodes, "rollback-10a");
      await collector.collectBefore(mockNodes, "rollback-10b");

      collector.clearAllSnapshots();

      expect(collector.getSnapshots("rollback-10a", "before")).toEqual([]);
      expect(collector.getSnapshots("rollback-10b", "before")).toEqual([]);
    });
  });

  describe("configuration", () => {
    it("should update configuration", () => {
      collector.updateConfig({
        sampleCount: 10,
        sampleDelay: 500,
      });

      const config = collector.getConfig();
      expect(config.sampleCount).toBe(10);
      expect(config.sampleDelay).toBe(500);
      expect(config.timeout).toBeDefined(); // Other values preserved
    });

    it("should get current configuration", () => {
      const config = collector.getConfig();

      expect(config).toHaveProperty("timeout");
      expect(config).toHaveProperty("sampleCount");
      expect(config).toHaveProperty("sampleDelay");
      expect(config).toHaveProperty("includeResourceUtil");
    });
  });

  describe("getSnapshotStats", () => {
    it("should return statistics about stored snapshots", async () => {
      await collector.collectBefore(mockNodes, "rollback-11");
      await collector.collectAfter(mockNodes, "rollback-11");
      await collector.collectBefore(mockNodes, "rollback-12");

      const stats = collector.getSnapshotStats();

      // Total is 9 because: 3 (before-11) + 3 (after-11) + 3 (before-12)
      expect(stats.totalSnapshots).toBeGreaterThanOrEqual(6);
      expect(stats.rollbackIds).toContain("rollback-11");
      expect(stats.rollbackIds).toContain("rollback-12");
      expect(stats.storageSize).toBeGreaterThanOrEqual(3);
    });

    it("should return empty stats when no snapshots", () => {
      const stats = collector.getSnapshotStats();

      expect(stats.totalSnapshots).toBe(0);
      expect(stats.rollbackIds).toEqual([]);
      expect(stats.storageSize).toBe(0);
    });
  });
});
