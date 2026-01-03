/**
 * @lsi/swarm - Hypothesis Protocol Tests
 *
 * Unit tests for HypothesisDistributor and related types.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HypothesisDistributor } from "./HypothesisDistributor.js";
import type {
  HypothesisPacket,
  HypothesisResult,
  NodeCapabilities,
} from "@lsi/protocol";

describe("HypothesisDistributor", () => {
  let distributor: HypothesisDistributor;
  let mockNodes: NodeCapabilities[];

  beforeEach(async () => {
    distributor = new HypothesisDistributor({
      maxConcurrentTests: 5,
      defaultTimeout: 60000,
      minNodesForDistribution: 2,
      maxNodesForDistribution: 5,
      autoAggregate: true,
    });
    await distributor.initialize();

    // Create mock nodes
    mockNodes = [
      {
        nodeId: "node-1",
        memoryMB: 8192,
        cpuCores: 4,
        workload: "mixed",
        canTest: true,
        supportedHypothesisTypes: [
          "cache_optimization",
          "routing_rule",
          "privacy_threshold",
        ],
      },
      {
        nodeId: "node-2",
        memoryMB: 16384,
        cpuCores: 8,
        workload: "read_heavy",
        canTest: true,
        supportedHypothesisTypes: ["cache_optimization", "adapter_config"],
      },
      {
        nodeId: "node-3",
        memoryMB: 4096,
        cpuCores: 2,
        workload: "write_heavy",
        canTest: true,
        supportedHypothesisTypes: ["cache_optimization", "routing_rule"],
      },
      {
        nodeId: "node-4",
        memoryMB: 32768,
        cpuCores: 16,
        workload: "mixed",
        canTest: true,
        supportedHypothesisTypes: [
          "cache_optimization",
          "routing_rule",
          "privacy_threshold",
          "adapter_config",
        ],
      },
      {
        nodeId: "node-5",
        memoryMB: 2048,
        cpuCores: 1,
        workload: "compute_heavy",
        canTest: false, // Cannot test
        supportedHypothesisTypes: [],
      },
    ];

    // Register nodes
    for (const node of mockNodes) {
      distributor.registerNode(node);
    }
  });

  afterEach(async () => {
    await distributor.shutdown();
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      const newDistributor = new HypothesisDistributor();
      await newDistributor.initialize();
      expect(newDistributor.getStatistics().registeredNodes).toBe(0);
      await newDistributor.shutdown();
    });

    it("should register nodes", () => {
      const stats = distributor.getStatistics();
      expect(stats.registeredNodes).toBe(5);
    });
  });

  describe("Node Management", () => {
    it("should get registered nodes", () => {
      const nodes = distributor.getRegisteredNodes();
      expect(nodes).toHaveLength(5);
      expect(nodes[0].nodeId).toBe("node-1");
    });

    it("should get available nodes (excluding non-testing nodes)", () => {
      const available = distributor.getAvailableNodes();
      expect(available).toHaveLength(4); // node-5 cannot test
      expect(available.find(n => n.nodeId === "node-5")).toBeUndefined();
    });

    it("should get available nodes filtered by hypothesis type", () => {
      const available = distributor.getAvailableNodes("adapter_config");
      expect(available).toHaveLength(2); // node-2 and node-4 support adapter_config
    });

    it("should unregister a node", () => {
      distributor.unregisterNode("node-1");
      const nodes = distributor.getRegisteredNodes();
      expect(nodes).toHaveLength(4);
      expect(nodes.find(n => n.nodeId === "node-1")).toBeUndefined();
    });
  });

  describe("Hypothesis Distribution", () => {
    let mockHypothesis: HypothesisPacket;

    beforeEach(() => {
      mockHypothesis = {
        version: "1.0",
        hypothesisId: "hypothesis-test-1",
        timestamp: Date.now(),
        sourceNodeId: "source-1",
        type: "cache_optimization",
        title: "Increase cache TTL for better hit rate",
        description:
          "Increasing cache TTL from 5 minutes to 10 minutes should improve hit rate by 15%",
        expectedImpact: {
          latency: 0.15, // 15% improvement
          quality: 0.0,
          cost: 0.1, // 10% cost reduction
          confidence: 0.8,
        },
        actionability: {
          level: "high",
          difficulty: "easy",
          estimatedTime: 2,
          requiredChanges: ["cache/config.ts"],
          risks: ["Slightly stale data"],
          rollbackComplexity: "trivial",
        },
        evidence: [
          {
            type: "pattern",
            source: "shadow-logs",
            timestamp: Date.now(),
            pattern: {
              support: 150,
              confidence: 0.85,
              lift: 1.5,
            },
          },
        ],
        distributionScope: {
          type: "global",
        },
        testingConfig: {
          testType: "ab_test",
          minDuration: 300000, // 5 minutes
          maxDuration: 3600000, // 1 hour
          minSampleSize: 100,
          targetSampleSize: 1000,
          primaryMetric: "latency",
          targetImprovement: 0.1,
          maxRegression: 0.02,
          earlyStopOnSuccess: true,
          earlyStopOnFailure: true,
        },
        validationRequired: true,
        minConfidence: 0.7,
      };
    });

    it("should distribute hypothesis to available nodes", async () => {
      const distribution = await distributor.distribute(mockHypothesis);

      expect(distribution.status).toBe("distributed");
      expect(distribution.hypothesisId).toBe("hypothesis-test-1");
      expect(distribution.targetNodes.length).toBeGreaterThan(0);
      expect(distribution.targetNodes.length).toBeLessThanOrEqual(5); // maxNodesForDistribution
    });

    it("should select nodes that support the hypothesis type", async () => {
      mockHypothesis.type = "adapter_config";
      const distribution = await distributor.distribute(mockHypothesis);

      // Only node-2 and node-4 support adapter_config
      expect(distribution.targetNodes).toContain("node-2");
      expect(distribution.targetNodes).toContain("node-4");
      expect(distribution.targetNodes).not.toContain("node-1");
    });

    it("should fail distribution if not enough nodes available", async () => {
      // Unregister all but one node
      distributor.unregisterNode("node-2");
      distributor.unregisterNode("node-3");
      distributor.unregisterNode("node-4");

      const distribution = await distributor.distribute(mockHypothesis);
      expect(distribution.status).toBe("failed");
    });

    it("should support selective distribution by node IDs", async () => {
      mockHypothesis.distributionScope = {
        type: "selective",
        nodes: ["node-1", "node-2"],
      };

      const distribution = await distributor.distribute(mockHypothesis);
      expect(distribution.targetNodes).toHaveLength(2);
      expect(distribution.targetNodes).toContain("node-1");
      expect(distribution.targetNodes).toContain("node-2");
    });

    it("should support selective distribution by workload", async () => {
      mockHypothesis.distributionScope = {
        type: "selective",
        criteria: {
          workload: "read_heavy",
        },
      };

      const distribution = await distributor.distribute(mockHypothesis);
      expect(distribution.targetNodes).toContain("node-2"); // Only read_heavy node
    });

    it("should support selective distribution by capacity", async () => {
      mockHypothesis.distributionScope = {
        type: "selective",
        criteria: {
          capacity: {
            minMemoryMB: 10000,
            minCPUCores: 4,
          },
        },
      };

      const distribution = await distributor.distribute(mockHypothesis);
      expect(distribution.targetNodes.length).toBeGreaterThan(0);
      // Should only select nodes with >= 10GB memory and >= 4 cores
      for (const nodeId of distribution.targetNodes) {
        const node = mockNodes.find(n => n.nodeId === nodeId);
        expect(node!.memoryMB).toBeGreaterThanOrEqual(10000);
        expect(node!.cpuCores).toBeGreaterThanOrEqual(4);
      }
    });
  });

  describe("Result Collection", () => {
    let mockHypothesis: HypothesisPacket;
    let mockResults: HypothesisResult[];

    beforeEach(async () => {
      mockHypothesis = {
        version: "1.0",
        hypothesisId: "hypothesis-test-2",
        timestamp: Date.now(),
        sourceNodeId: "source-1",
        type: "cache_optimization",
        title: "Test hypothesis",
        description: "Test description",
        expectedImpact: {
          latency: 0.1,
          quality: 0.0,
          cost: 0.05,
          confidence: 0.7,
        },
        actionability: {
          level: "medium",
          difficulty: "easy",
          estimatedTime: 1,
          requiredChanges: ["config.ts"],
          risks: [],
          rollbackComplexity: "easy",
        },
        evidence: [],
        distributionScope: {
          type: "global",
        },
        testingConfig: {
          testType: "ab_test",
          minDuration: 10000,
          maxDuration: 60000,
          minSampleSize: 50,
          targetSampleSize: 100,
          primaryMetric: "latency",
          targetImprovement: 0.05,
          maxRegression: 0.01,
          earlyStopOnSuccess: false,
          earlyStopOnFailure: false,
        },
        validationRequired: true,
        minConfidence: 0.6,
      };

      // Distribute hypothesis
      await distributor.distribute(mockHypothesis);

      // Create mock results
      mockResults = [
        {
          hypothesisId: "hypothesis-test-2",
          nodeId: "node-1",
          testType: "ab_test",
          duration: 30000,
          sampleSize: 100,
          metricsBefore: {
            avgLatency: 100,
            p50Latency: 90,
            p95Latency: 150,
            p99Latency: 200,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now() - 30000,
          },
          metricsAfter: {
            avgLatency: 85,
            p50Latency: 75,
            p95Latency: 125,
            p99Latency: 170,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.009,
            totalCost: 0.9,
            timestamp: Date.now(),
          },
          decision: "accept",
          confidence: 0.85,
          improvement: {
            latency: 0.15, // 15% improvement
            quality: 0.0,
            cost: 0.1, // 10% reduction
          },
          errors: [],
          completedAt: Date.now(),
        },
        {
          hypothesisId: "hypothesis-test-2",
          nodeId: "node-2",
          testType: "ab_test",
          duration: 35000,
          sampleSize: 120,
          metricsBefore: {
            avgLatency: 110,
            p50Latency: 100,
            p95Latency: 160,
            p99Latency: 210,
            avgQuality: 0.88,
            userSatisfaction: 0.82,
            avgCost: 0.011,
            totalCost: 1.32,
            timestamp: Date.now() - 35000,
          },
          metricsAfter: {
            avgLatency: 90,
            p50Latency: 80,
            p95Latency: 130,
            p99Latency: 180,
            avgQuality: 0.89,
            userSatisfaction: 0.83,
            avgCost: 0.01,
            totalCost: 1.2,
            timestamp: Date.now(),
          },
          decision: "accept",
          confidence: 0.9,
          improvement: {
            latency: 0.18,
            quality: 0.01,
            cost: 0.09,
          },
          errors: [],
          completedAt: Date.now(),
        },
        {
          hypothesisId: "hypothesis-test-2",
          nodeId: "node-3",
          testType: "ab_test",
          duration: 28000,
          sampleSize: 80,
          metricsBefore: {
            avgLatency: 95,
            p50Latency: 85,
            p95Latency: 145,
            p99Latency: 195,
            avgQuality: 0.91,
            userSatisfaction: 0.86,
            avgCost: 0.0095,
            totalCost: 0.76,
            timestamp: Date.now() - 28000,
          },
          metricsAfter: {
            avgLatency: 80,
            p50Latency: 70,
            p95Latency: 120,
            p99Latency: 165,
            avgQuality: 0.91,
            userSatisfaction: 0.86,
            avgCost: 0.0086,
            totalCost: 0.69,
            timestamp: Date.now(),
          },
          decision: "accept",
          confidence: 0.88,
          improvement: {
            latency: 0.16,
            quality: 0.0,
            cost: 0.095,
          },
          errors: [],
          completedAt: Date.now(),
        },
      ];
    });

    it("should accept results from nodes", async () => {
      await distributor.submitResult(mockResults[0]);

      const collected = await distributor.collectResults("hypothesis-test-2");
      expect(collected).toHaveLength(1);
      expect(collected[0].nodeId).toBe("node-1");
    });

    it("should collect all results from nodes", async () => {
      for (const result of mockResults) {
        await distributor.submitResult(result);
      }

      const collected = await distributor.collectResults("hypothesis-test-2");
      expect(collected).toHaveLength(3);
    });

    it("should reject unexpected results", async () => {
      const unexpectedResult: HypothesisResult = {
        ...mockResults[0],
        hypothesisId: "unknown-hypothesis",
      };

      // Should not throw, just warn
      await distributor.submitResult(unexpectedResult);

      const collected = await distributor.collectResults("unknown-hypothesis");
      expect(collected).toBeUndefined(); // No results collected
    });
  });

  describe("Result Aggregation", () => {
    let mockHypothesis: HypothesisPacket;

    beforeEach(async () => {
      mockHypothesis = {
        version: "1.0",
        hypothesisId: "hypothesis-test-3",
        timestamp: Date.now(),
        sourceNodeId: "source-1",
        type: "cache_optimization",
        title: "Aggregation test",
        description: "Test aggregation",
        expectedImpact: {
          latency: 0.1,
          quality: 0.0,
          cost: 0.05,
          confidence: 0.7,
        },
        actionability: {
          level: "medium",
          difficulty: "easy",
          estimatedTime: 1,
          requiredChanges: [],
          risks: [],
          rollbackComplexity: "easy",
        },
        evidence: [],
        distributionScope: {
          type: "global",
        },
        testingConfig: {
          testType: "ab_test",
          minDuration: 10000,
          maxDuration: 60000,
          minSampleSize: 50,
          targetSampleSize: 100,
          primaryMetric: "latency",
          targetImprovement: 0.05,
          maxRegression: 0.01,
          earlyStopOnSuccess: false,
          earlyStopOnFailure: false,
        },
        validationRequired: true,
        minConfidence: 0.6,
      };

      await distributor.distribute(mockHypothesis);
    });

    it("should aggregate results and recommend acceptance", async () => {
      // Submit positive results
      const results: HypothesisResult[] = [
        {
          hypothesisId: "hypothesis-test-3",
          nodeId: "node-1",
          testType: "ab_test",
          duration: 30000,
          sampleSize: 100,
          metricsBefore: {
            avgLatency: 100,
            p50Latency: 90,
            p95Latency: 150,
            p99Latency: 200,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now(),
          },
          metricsAfter: {
            avgLatency: 85,
            p50Latency: 75,
            p95Latency: 125,
            p99Latency: 170,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.009,
            totalCost: 0.9,
            timestamp: Date.now(),
          },
          decision: "accept",
          confidence: 0.9,
          improvement: {
            latency: 0.15,
            quality: 0.0,
            cost: 0.1,
          },
          errors: [],
          completedAt: Date.now(),
        },
        {
          hypothesisId: "hypothesis-test-3",
          nodeId: "node-2",
          testType: "ab_test",
          duration: 30000,
          sampleSize: 100,
          metricsBefore: {
            avgLatency: 100,
            p50Latency: 90,
            p95Latency: 150,
            p99Latency: 200,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now(),
          },
          metricsAfter: {
            avgLatency: 82,
            p50Latency: 72,
            p95Latency: 122,
            p99Latency: 167,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.009,
            totalCost: 0.9,
            timestamp: Date.now(),
          },
          decision: "accept",
          confidence: 0.92,
          improvement: {
            latency: 0.18,
            quality: 0.0,
            cost: 0.1,
          },
          errors: [],
          completedAt: Date.now(),
        },
        {
          hypothesisId: "hypothesis-test-3",
          nodeId: "node-3",
          testType: "ab_test",
          duration: 30000,
          sampleSize: 100,
          metricsBefore: {
            avgLatency: 100,
            p50Latency: 90,
            p95Latency: 150,
            p99Latency: 200,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now(),
          },
          metricsAfter: {
            avgLatency: 80,
            p50Latency: 70,
            p95Latency: 120,
            p99Latency: 165,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.009,
            totalCost: 0.9,
            timestamp: Date.now(),
          },
          decision: "accept",
          confidence: 0.95,
          improvement: {
            latency: 0.2,
            quality: 0.0,
            cost: 0.1,
          },
          errors: [],
          completedAt: Date.now(),
        },
      ];

      for (const result of results) {
        await distributor.submitResult(result);
      }

      const aggregated =
        await distributor.aggregateResults("hypothesis-test-3");

      expect(aggregated.acceptCount).toBe(3);
      expect(aggregated.rejectCount).toBe(0);
      expect(aggregated.inconclusiveCount).toBe(0);
      expect(aggregated.avgImprovement.latency).toBeCloseTo(0.1767, 3);
      expect(aggregated.recommendation).toBe("accept");
    });

    it("should aggregate results and recommend rejection", async () => {
      // Submit negative results
      const results: HypothesisResult[] = [
        {
          hypothesisId: "hypothesis-test-3",
          nodeId: "node-1",
          testType: "ab_test",
          duration: 30000,
          sampleSize: 100,
          metricsBefore: {
            avgLatency: 100,
            p50Latency: 90,
            p95Latency: 150,
            p99Latency: 200,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now(),
          },
          metricsAfter: {
            avgLatency: 105,
            p50Latency: 95,
            p95Latency: 155,
            p99Latency: 205,
            avgQuality: 0.89,
            userSatisfaction: 0.84,
            avgCost: 0.011,
            totalCost: 1.1,
            timestamp: Date.now(),
          },
          decision: "reject",
          confidence: 0.8,
          improvement: {
            latency: -0.05,
            quality: -0.01,
            cost: -0.1,
          },
          errors: ["Latency increased"],
          completedAt: Date.now(),
        },
        {
          hypothesisId: "hypothesis-test-3",
          nodeId: "node-2",
          testType: "ab_test",
          duration: 30000,
          sampleSize: 100,
          metricsBefore: {
            avgLatency: 100,
            p50Latency: 90,
            p95Latency: 150,
            p99Latency: 200,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now(),
          },
          metricsAfter: {
            avgLatency: 102,
            p50Latency: 92,
            p95Latency: 152,
            p99Latency: 202,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now(),
          },
          decision: "reject",
          confidence: 0.75,
          improvement: {
            latency: -0.02,
            quality: 0.0,
            cost: 0.0,
          },
          errors: ["No significant improvement"],
          completedAt: Date.now(),
        },
      ];

      for (const result of results) {
        await distributor.submitResult(result);
      }

      const aggregated =
        await distributor.aggregateResults("hypothesis-test-3");

      expect(aggregated.acceptCount).toBe(0);
      expect(aggregated.rejectCount).toBe(2);
      expect(aggregated.recommendation).toBe("reject");
    });

    it("should handle inconclusive results", async () => {
      // Submit mixed results
      const results: HypothesisResult[] = [
        {
          hypothesisId: "hypothesis-test-3",
          nodeId: "node-1",
          testType: "ab_test",
          duration: 30000,
          sampleSize: 100,
          metricsBefore: {
            avgLatency: 100,
            p50Latency: 90,
            p95Latency: 150,
            p99Latency: 200,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now(),
          },
          metricsAfter: {
            avgLatency: 85,
            p50Latency: 75,
            p95Latency: 125,
            p99Latency: 170,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.009,
            totalCost: 0.9,
            timestamp: Date.now(),
          },
          decision: "accept",
          confidence: 0.9,
          improvement: {
            latency: 0.15,
            quality: 0.0,
            cost: 0.1,
          },
          errors: [],
          completedAt: Date.now(),
        },
        {
          hypothesisId: "hypothesis-test-3",
          nodeId: "node-2",
          testType: "ab_test",
          duration: 30000,
          sampleSize: 100,
          metricsBefore: {
            avgLatency: 100,
            p50Latency: 90,
            p95Latency: 150,
            p99Latency: 200,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now(),
          },
          metricsAfter: {
            avgLatency: 102,
            p50Latency: 92,
            p95Latency: 152,
            p99Latency: 202,
            avgQuality: 0.9,
            userSatisfaction: 0.85,
            avgCost: 0.01,
            totalCost: 1.0,
            timestamp: Date.now(),
          },
          decision: "inconclusive",
          confidence: 0.4,
          improvement: {
            latency: -0.02,
            quality: 0.0,
            cost: 0.0,
          },
          errors: ["Insufficient sample size"],
          completedAt: Date.now(),
        },
      ];

      for (const result of results) {
        await distributor.submitResult(result);
      }

      const aggregated =
        await distributor.aggregateResults("hypothesis-test-3");

      expect(aggregated.acceptCount).toBe(1);
      expect(aggregated.inconclusiveCount).toBe(1);
      // With 50% inconclusive, should recommend need more data
      expect(aggregated.recommendation).toBe("need_more_data");
    });
  });

  describe("Distribution Status", () => {
    it("should return distribution status", async () => {
      const mockHypothesis: HypothesisPacket = {
        version: "1.0",
        hypothesisId: "hypothesis-status-1",
        timestamp: Date.now(),
        sourceNodeId: "source-1",
        type: "cache_optimization",
        title: "Status test",
        description: "Test status tracking",
        expectedImpact: {
          latency: 0.1,
          quality: 0.0,
          cost: 0.05,
          confidence: 0.7,
        },
        actionability: {
          level: "medium",
          difficulty: "easy",
          estimatedTime: 1,
          requiredChanges: [],
          risks: [],
          rollbackComplexity: "easy",
        },
        evidence: [],
        distributionScope: {
          type: "global",
        },
        testingConfig: {
          testType: "ab_test",
          minDuration: 10000,
          maxDuration: 60000,
          minSampleSize: 50,
          targetSampleSize: 100,
          primaryMetric: "latency",
          targetImprovement: 0.05,
          maxRegression: 0.01,
          earlyStopOnSuccess: false,
          earlyStopOnFailure: false,
        },
        validationRequired: true,
        minConfidence: 0.6,
      };

      await distributor.distribute(mockHypothesis);

      const status = distributor.getStatus("hypothesis-status-1");
      expect(status).toBeDefined();
      expect(status!.hypothesisId).toBe("hypothesis-status-1");
      expect(status!.status).toBe("distributed");
    });

    it("should return undefined for unknown hypothesis", () => {
      const status = distributor.getStatus("unknown-hypothesis");
      expect(status).toBeUndefined();
    });

    it("should return all distributions", async () => {
      const hypothesis1: HypothesisPacket = {
        version: "1.0",
        hypothesisId: "hypothesis-all-1",
        timestamp: Date.now(),
        sourceNodeId: "source-1",
        type: "cache_optimization",
        title: "Test 1",
        description: "Test 1",
        expectedImpact: {
          latency: 0.1,
          quality: 0.0,
          cost: 0.05,
          confidence: 0.7,
        },
        actionability: {
          level: "medium",
          difficulty: "easy",
          estimatedTime: 1,
          requiredChanges: [],
          risks: [],
          rollbackComplexity: "easy",
        },
        evidence: [],
        distributionScope: {
          type: "global",
        },
        testingConfig: {
          testType: "ab_test",
          minDuration: 10000,
          maxDuration: 60000,
          minSampleSize: 50,
          targetSampleSize: 100,
          primaryMetric: "latency",
          targetImprovement: 0.05,
          maxRegression: 0.01,
          earlyStopOnSuccess: false,
          earlyStopOnFailure: false,
        },
        validationRequired: true,
        minConfidence: 0.6,
      };

      const hypothesis2: HypothesisPacket = {
        ...hypothesis1,
        hypothesisId: "hypothesis-all-2",
      };

      await distributor.distribute(hypothesis1);
      await distributor.distribute(hypothesis2);

      const allDistributions = distributor.getAllDistributions();
      expect(allDistributions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Statistics", () => {
    it("should return distributor statistics", () => {
      const stats = distributor.getStatistics();

      expect(stats.registeredNodes).toBe(5);
      expect(stats.availableNodes).toBe(4); // node-5 cannot test
      expect(stats.testingNodes).toBe(0);
      expect(stats.activeDistributions).toBe(0);
      expect(stats.completedDistributions).toBe(0);
    });
  });

  describe("Cancel Testing", () => {
    it("should cancel ongoing hypothesis testing", async () => {
      const mockHypothesis: HypothesisPacket = {
        version: "1.0",
        hypothesisId: "hypothesis-cancel-1",
        timestamp: Date.now(),
        sourceNodeId: "source-1",
        type: "cache_optimization",
        title: "Cancel test",
        description: "Test cancellation",
        expectedImpact: {
          latency: 0.1,
          quality: 0.0,
          cost: 0.05,
          confidence: 0.7,
        },
        actionability: {
          level: "medium",
          difficulty: "easy",
          estimatedTime: 1,
          requiredChanges: [],
          risks: [],
          rollbackComplexity: "easy",
        },
        evidence: [],
        distributionScope: {
          type: "global",
        },
        testingConfig: {
          testType: "ab_test",
          minDuration: 10000,
          maxDuration: 60000,
          minSampleSize: 50,
          targetSampleSize: 100,
          primaryMetric: "latency",
          targetImprovement: 0.05,
          maxRegression: 0.01,
          earlyStopOnSuccess: false,
          earlyStopOnFailure: false,
        },
        validationRequired: true,
        minConfidence: 0.6,
      };

      await distributor.distribute(mockHypothesis);
      await distributor.cancelTesting("hypothesis-cancel-1");

      const status = distributor.getStatus("hypothesis-cancel-1");
      expect(status!.status).toBe("failed");
    });
  });
});
