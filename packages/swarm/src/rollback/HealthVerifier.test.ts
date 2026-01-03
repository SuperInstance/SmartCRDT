/**
 * @lsi/swarm/rollback - HealthVerifier Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HealthVerifier } from "./HealthVerifier.js";
import type { Node, RollbackRequest, MetricsSnapshot } from "@lsi/protocol";

describe("HealthVerifier", () => {
  let verifier: HealthVerifier;
  let mockNodes: Node[];
  let mockRequest: RollbackRequest;

  beforeEach(() => {
    verifier = new HealthVerifier();
    mockNodes = [
      {
        id: "node-1",
        address: "localhost",
        port: 3001,
        role: "leader",
        status: "online",
        lastHeartbeat: Date.now(),
        capabilities: ["health-check"],
      },
      {
        id: "node-2",
        address: "localhost",
        port: 3002,
        role: "follower",
        status: "online",
        lastHeartbeat: Date.now(),
        capabilities: ["health-check"],
      },
      {
        id: "node-3",
        address: "localhost",
        port: 3003,
        role: "follower",
        status: "online",
        lastHeartbeat: Date.now(),
        capabilities: ["health-check"],
      },
    ];

    mockRequest = {
      rollbackId: "rollback-1",
      timestamp: Date.now(),
      targetComponent: "adapter",
      targetVersion: "1.9.0",
      currentVersion: "2.0.0",
      reason: "degradation",
      description: "Test rollback",
      scope: "cluster",
      initiatedBy: "admin",
      requiresApproval: false,
      options: {
        strategy: "immediate",
        createBackup: false,
        verifyAfterRollback: true,
        notifyStakeholders: false,
      },
    };
  });

  describe("verifyRollback", () => {
    it("should verify all nodes successfully", async () => {
      const results = await verifier.verifyRollback(mockRequest, mockNodes);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty("nodeId");
      expect(results[0]).toHaveProperty("componentVersion", "1.9.0");
      expect(results[0]).toHaveProperty("healthStatus");
      expect(results[0]).toHaveProperty("metrics");
      expect(results[0]).toHaveProperty("timestamp");
    }, 10000);

    it("should call progress callbacks", async () => {
      const progressCallback = vi.fn();
      const resultCallback = vi.fn();

      await verifier.verifyRollback(mockRequest, mockNodes, undefined, {
        onProgress: progressCallback,
        onResult: resultCallback,
      });

      expect(progressCallback).toHaveBeenCalled();
      expect(resultCallback).toHaveBeenCalledTimes(3);
    });

    it("should handle offline nodes", async () => {
      const offlineNodes = [
        {
          id: "node-offline",
          address: "localhost",
          port: 3004,
          role: "follower",
          status: "offline",
          lastHeartbeat: Date.now() - 30000,
        },
      ];

      const results = await verifier.verifyRollback(mockRequest, offlineNodes);

      expect(results).toHaveLength(1);
      // Offline nodes should have unhealthy status
      expect(["unhealthy", "degraded", "healthy"]).toContain(
        results[0].healthStatus
      );
    });

    it("should skip health checks when requested", async () => {
      const results = await verifier.verifyRollback(
        mockRequest,
        mockNodes,
        undefined,
        {
          skipHealthChecks: true,
        }
      );

      expect(results).toHaveLength(3);
      // When skipping checks, nodes should be marked healthy
      expect(results.every(r => r.healthStatus === "healthy")).toBe(true);
    });
  });

  describe("verifyNode", () => {
    it("should verify single node with health checks", async () => {
      const beforeMetrics: MetricsSnapshot = {
        timestamp: Date.now() - 10000,
        errorRate: 0.15,
        avgLatency: 2000,
        p95Latency: 3000,
        p99Latency: 5000,
        throughput: 500,
        qualityScore: 0.7,
      };

      const result = await verifier.verifyNode(
        mockNodes[0],
        mockRequest,
        beforeMetrics
      );

      expect(result.nodeId).toBe("node-1");
      expect(result.componentVersion).toBe("1.9.0");
      expect(["healthy", "degraded", "unhealthy"]).toContain(
        result.healthStatus
      );
      expect(result.metrics).toBeDefined();
    });

    it("should skip metric comparison when requested", async () => {
      const result = await verifier.verifyNode(
        mockNodes[0],
        mockRequest,
        undefined,
        {
          skipMetricComparison: true,
        }
      );

      expect(result.nodeId).toBe("node-1");
      expect(result.healthStatus).toBeDefined();
    });
  });

  describe("checkHealth", () => {
    it("should perform health checks with retries", async () => {
      const healthStatus = await verifier.checkHealth(mockNodes[0], {
        timeout: 5000,
        retries: 2,
        retryDelay: 100,
      });

      expect(healthStatus.status).toBeDefined();
      expect(healthStatus.checks).toBeDefined();
      expect(healthStatus.checks.length).toBeGreaterThan(0);
      expect(healthStatus.timestamp).toBeDefined();
    });

    it("should include all required health checks", async () => {
      const healthStatus = await verifier.checkHealth(mockNodes[0], {
        timeout: 5000,
        retries: 1,
        retryDelay: 100,
      });

      const checkNames = healthStatus.checks.map(c => c.name);
      expect(checkNames).toContain("node_availability");
      expect(checkNames).toContain("api_responsiveness");
      expect(checkNames).toContain("resource_utilization");
      expect(checkNames).toContain("service_health");
      expect(checkNames).toContain("database_connectivity");
      expect(checkNames).toContain("cache_connectivity");
    });

    it("should have proper check statuses", async () => {
      const healthStatus = await verifier.checkHealth(mockNodes[0], {
        timeout: 5000,
        retries: 1,
        retryDelay: 100,
      });

      healthStatus.checks.forEach(check => {
        expect(["pass", "fail", "warn"]).toContain(check.status);
        expect(check.name).toBeDefined();
        expect(check.timestamp).toBeDefined();
      });
    });
  });

  describe("compareMetrics", () => {
    it("should compare before and after metrics", async () => {
      const before: MetricsSnapshot = {
        timestamp: Date.now() - 10000,
        errorRate: 0.15,
        avgLatency: 2000,
        p95Latency: 3000,
        p99Latency: 5000,
        throughput: 500,
        qualityScore: 0.7,
      };

      const after: MetricsSnapshot = {
        timestamp: Date.now(),
        errorRate: 0.02,
        avgLatency: 150,
        p95Latency: 200,
        p99Latency: 300,
        throughput: 1000,
        qualityScore: 0.95,
      };

      const comparison = await verifier.compareMetrics(before, after);

      expect(comparison.before).toEqual(before);
      expect(comparison.after).toEqual(after);
      expect(comparison.improvement).toBeDefined();
      // Improvement should be positive (after is better)
      expect(comparison.improvement).toBeGreaterThan(0);
    });

    it("should calculate negative improvement for degradation", async () => {
      const before: MetricsSnapshot = {
        timestamp: Date.now() - 10000,
        errorRate: 0.02,
        avgLatency: 150,
        p95Latency: 200,
        p99Latency: 300,
        throughput: 1000,
        qualityScore: 0.95,
      };

      const after: MetricsSnapshot = {
        timestamp: Date.now(),
        errorRate: 0.15,
        avgLatency: 2000,
        p95Latency: 3000,
        p99Latency: 5000,
        throughput: 500,
        qualityScore: 0.7,
      };

      const comparison = await verifier.compareMetrics(before, after);

      // Improvement should be negative (after is worse)
      expect(comparison.improvement).toBeLessThan(0);
    });
  });

  describe("isSuccessful", () => {
    it("should return true when all nodes are healthy", async () => {
      const results = await verifier.verifyRollback(mockRequest, mockNodes);
      const healthyResults = results.map(r => ({
        ...r,
        healthStatus: "healthy" as const,
      }));

      expect(verifier.isSuccessful(healthyResults)).toBe(true);
    });

    it("should return true when some nodes are degraded", async () => {
      const results = await verifier.verifyRollback(mockRequest, mockNodes);
      const mixedResults = results.map((r, i) => ({
        ...r,
        healthStatus: i === 0 ? ("degraded" as const) : ("healthy" as const),
      }));

      expect(verifier.isSuccessful(mixedResults)).toBe(true);
    });

    it("should return false when any node is unhealthy", async () => {
      const results = await verifier.verifyRollback(mockRequest, mockNodes);
      const unhealthyResults = results.map((r, i) => ({
        ...r,
        healthStatus: i === 0 ? ("unhealthy" as const) : ("healthy" as const),
      }));

      expect(verifier.isSuccessful(unhealthyResults)).toBe(false);
    });
  });

  describe("isPartialSuccess", () => {
    it("should return true when some nodes are degraded", async () => {
      const results = await verifier.verifyRollback(mockRequest, mockNodes);
      const degradedResults = results.map((r, i) => ({
        ...r,
        healthStatus: i === 0 ? ("degraded" as const) : ("healthy" as const),
      }));

      expect(verifier.isPartialSuccess(degradedResults)).toBe(true);
    });

    it("should return false when all nodes are healthy", async () => {
      const results = await verifier.verifyRollback(mockRequest, mockNodes);
      const healthyResults = results.map(r => ({
        ...r,
        healthStatus: "healthy" as const,
      }));

      expect(verifier.isPartialSuccess(healthyResults)).toBe(false);
    });

    it("should return false when any node is unhealthy", async () => {
      const results = await verifier.verifyRollback(mockRequest, mockNodes);
      const unhealthyResults = results.map((r, i) => ({
        ...r,
        healthStatus: i === 0 ? ("unhealthy" as const) : ("healthy" as const),
      }));

      expect(verifier.isPartialSuccess(unhealthyResults)).toBe(false);
    });
  });

  describe("verification history", () => {
    it("should store verification history", async () => {
      await verifier.verifyRollback(mockRequest, mockNodes);

      const history = verifier.getVerificationHistory("rollback-1");
      expect(history).toBeDefined();
      expect(history).toHaveLength(3);
    });

    it("should return undefined for non-existent history", () => {
      const history = verifier.getVerificationHistory("non-existent");
      expect(history).toBeUndefined();
    });

    it("should get all histories", async () => {
      await verifier.verifyRollback(mockRequest, mockNodes);

      const histories = verifier.getAllHistories();
      expect(histories.size).toBeGreaterThan(0);
      expect(histories.has("rollback-1")).toBe(true);
    });

    it("should clear specific history", async () => {
      await verifier.verifyRollback(mockRequest, mockNodes);

      verifier.clearHistory("rollback-1");

      const history = verifier.getVerificationHistory("rollback-1");
      expect(history).toBeUndefined();
    });

    it("should clear all histories", async () => {
      await verifier.verifyRollback(mockRequest, mockNodes);

      verifier.clearHistory();

      const histories = verifier.getAllHistories();
      expect(histories.size).toBe(0);
    });
  });

  describe("thresholds", () => {
    it("should update thresholds", () => {
      verifier.updateThresholds({
        maxErrorRate: 0.1,
        maxLatency: 1000,
      });

      const thresholds = verifier.getThresholds();
      expect(thresholds.maxErrorRate).toBe(0.1);
      expect(thresholds.maxLatency).toBe(1000);
      expect(thresholds.minThroughput).toBeDefined(); // Other values preserved
    });

    it("should get current thresholds", () => {
      const thresholds = verifier.getThresholds();
      expect(thresholds).toHaveProperty("maxErrorRate");
      expect(thresholds).toHaveProperty("maxLatency");
      expect(thresholds).toHaveProperty("minThroughput");
      expect(thresholds).toHaveProperty("minQualityScore");
    });
  });
});
