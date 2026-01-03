/**
 * Hypothesis Protocol Tests
 *
 * Tests for hypothesis protocol types, distribution, and aggregation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type {
  HypothesisPacket,
  HypothesisType,
  ExpectedImpact,
  Actionability,
  EvidencePacket,
  EvidenceType,
  HypothesisScope,
  WorkloadType,
  TestingConfig,
  HypothesisResult,
  MetricsSnapshot,
  HypothesisDistribution,
  AggregatedResult,
  ValidationMetrics,
  NodeCapabilities,
  HypothesisDistributionRequest,
  HypothesisDistributionResponse,
} from "../hypothesis.js";

describe("Hypothesis Protocol", () => {
  describe("HypothesisPacket", () => {
    it("should create a valid hypothesis packet", () => {
      const packet: HypothesisPacket = {
        version: "1.0.0",
        hypothesisId: "hyp-123",
        timestamp: Date.now(),
        sourceNodeId: "node-1",
        type: "cache_optimization",
        title: "Increase cache size for better hit rate",
        description:
          "Increasing cache size from 1GB to 2GB improves hit rate by 15%",
        expectedImpact: {
          latency: 0.15,
          quality: 0.05,
          cost: -0.1,
          confidence: 0.8,
        },
        actionability: {
          level: "high",
          difficulty: "easy",
          estimatedTime: 2,
          requiredChanges: ["config/cache.json"],
          risks: ["Increased memory usage"],
          rollbackComplexity: "trivial",
        },
        evidence: [],
        distributionScope: {
          type: "cluster",
        },
        testingConfig: {
          testType: "ab_test",
          minDuration: 3600000,
          maxDuration: 86400000,
          minSampleSize: 1000,
          targetSampleSize: 10000,
          primaryMetric: "latency",
          targetImprovement: 0.1,
          maxRegression: 0.05,
          earlyStopOnSuccess: true,
          earlyStopOnFailure: true,
        },
        validationRequired: true,
        minConfidence: 0.7,
      };

      expect(packet.hypothesisId).toBe("hyp-123");
      expect(packet.type).toBe("cache_optimization");
      expect(packet.expectedImpact.latency).toBe(0.15);
      expect(packet.actionability.level).toBe("high");
    });

    it("should validate all hypothesis types", () => {
      const types: HypothesisType[] = [
        "cache_optimization",
        "routing_rule",
        "privacy_threshold",
        "query_refinement",
        "adapter_config",
        "resource_allocation",
        "cartridge_selection",
      ];

      types.forEach(type => {
        const packet: HypothesisPacket = {
          version: "1.0.0",
          hypothesisId: `hyp-${type}`,
          timestamp: Date.now(),
          sourceNodeId: "node-1",
          type,
          title: `Hypothesis for ${type}`,
          description: `Testing ${type} improvements`,
          expectedImpact: {
            latency: 0.1,
            quality: 0.05,
            cost: -0.05,
            confidence: 0.7,
          },
          actionability: {
            level: "medium",
            difficulty: "medium",
            estimatedTime: 4,
            requiredChanges: [],
            risks: [],
            rollbackComplexity: "easy",
          },
          evidence: [],
          distributionScope: { type: "local" },
          testingConfig: {
            testType: "ab_test",
            minDuration: 3600000,
            maxDuration: 86400000,
            minSampleSize: 100,
            targetSampleSize: 1000,
            primaryMetric: "latency",
            targetImprovement: 0.05,
            maxRegression: 0.02,
            earlyStopOnSuccess: false,
            earlyStopOnFailure: false,
          },
          validationRequired: true,
          minConfidence: 0.6,
        };

        expect(packet.type).toBe(type);
      });
    });
  });

  describe("ExpectedImpact", () => {
    it("should represent expected improvements", () => {
      const impact: ExpectedImpact = {
        latency: 0.25, // 25% improvement
        quality: 0.1, // 10% improvement
        cost: -0.3, // 30% reduction
        confidence: 0.9, // 90% confidence
      };

      expect(impact.latency).toBeGreaterThan(0);
      expect(impact.quality).toBeGreaterThan(0);
      expect(impact.cost).toBeLessThan(0); // Cost reduction
      expect(impact.confidence).toBeLessThanOrEqual(1);
    });

    it("should handle negative impacts", () => {
      const impact: ExpectedImpact = {
        latency: -0.05, // 5% regression
        quality: 0.02,
        cost: 0.1, // Cost increase
        confidence: 0.5,
      };

      expect(impact.latency).toBeLessThan(0);
      expect(impact.confidence).toBeLessThan(1);
    });
  });

  describe("Actionability", () => {
    it("should assess actionability levels", () => {
      const levels: Array<Actionability["level"]> = ["high", "medium", "low"];

      levels.forEach(level => {
        const actionability: Actionability = {
          level,
          difficulty: "easy",
          estimatedTime: level === "high" ? 1 : level === "medium" ? 4 : 8,
          requiredChanges: ["config.json"],
          risks: [],
          rollbackComplexity: "trivial",
        };

        expect(actionability.level).toBe(level);
      });
    });

    it("should assess implementation difficulty", () => {
      const difficulties: Array<Actionability["difficulty"]> = [
        "trivial",
        "easy",
        "medium",
        "hard",
      ];

      difficulties.forEach(difficulty => {
        const actionability: Actionability = {
          level: "medium",
          difficulty,
          estimatedTime:
            difficulty === "trivial" ? 0.5 : difficulty === "hard" ? 16 : 4,
          requiredChanges: [],
          risks: [],
          rollbackComplexity: "easy",
        };

        expect(actionability.difficulty).toBe(difficulty);
      });
    });
  });

  describe("EvidencePacket", () => {
    it("should store pattern evidence", () => {
      const evidence: EvidencePacket = {
        type: "pattern",
        source: "pattern-miner",
        timestamp: Date.now(),
        pattern: {
          support: 150,
          confidence: 0.85,
          lift: 2.5,
        },
      };

      expect(evidence.type).toBe("pattern");
      expect(evidence.pattern?.support).toBe(150);
      expect(evidence.pattern?.confidence).toBeGreaterThan(0.8);
    });

    it("should store correlation evidence", () => {
      const evidence: EvidencePacket = {
        type: "correlation",
        source: "correlation-analyzer",
        timestamp: Date.now(),
        correlation: {
          variable1: "cache_size",
          variable2: "hit_rate",
          coefficient: 0.92,
          pValue: 0.001,
        },
      };

      expect(evidence.type).toBe("correlation");
      expect(evidence.correlation?.coefficient).toBeGreaterThan(0.9);
      expect(evidence.correlation?.pValue).toBeLessThan(0.05);
    });

    it("should store anomaly evidence", () => {
      const evidence: EvidencePacket = {
        type: "anomaly",
        source: "anomaly-detector",
        timestamp: Date.now(),
        anomaly: {
          metric: "error_rate",
          value: 0.15,
          zScore: 4.5,
        },
      };

      expect(evidence.type).toBe("anomaly");
      expect(evidence.anomaly?.zScore).toBeGreaterThan(3);
    });

    it("should store user feedback evidence", () => {
      const evidence: EvidencePacket = {
        type: "user_feedback",
        source: "feedback-collector",
        timestamp: Date.now(),
        feedback: {
          userId: "user-123",
          rating: 5,
          comment: "Much faster now",
        },
      };

      expect(evidence.type).toBe("user_feedback");
      expect(evidence.feedback?.rating).toBe(5);
    });
  });

  describe("HypothesisScope", () => {
    it("should define local scope", () => {
      const scope: HypothesisScope = {
        type: "local",
      };

      expect(scope.type).toBe("local");
    });

    it("should define cluster scope with criteria", () => {
      const scope: HypothesisScope = {
        type: "cluster",
        criteria: {
          region: "us-east",
          workload: "compute_heavy",
          capacity: {
            minMemoryMB: 8192,
            minCPUCores: 4,
          },
        },
      };

      expect(scope.type).toBe("cluster");
      expect(scope.criteria?.region).toBe("us-east");
      expect(scope.criteria?.workload).toBe("compute_heavy");
      expect(scope.criteria?.capacity?.minMemoryMB).toBe(8192);
    });

    it("should define selective scope for specific nodes", () => {
      const scope: HypothesisScope = {
        type: "selective",
        nodes: ["node-1", "node-2", "node-5"],
      };

      expect(scope.type).toBe("selective");
      expect(scope.nodes).toHaveLength(3);
    });
  });

  describe("WorkloadType", () => {
    it("should support all workload types", () => {
      const workloadTypes: WorkloadType[] = [
        "read_heavy",
        "write_heavy",
        "compute_heavy",
        "memory_heavy",
        "mixed",
      ];

      workloadTypes.forEach(type => {
        expect(type).toBeDefined();
      });
    });
  });

  describe("TestingConfig", () => {
    it("should configure A/B test", () => {
      const config: TestingConfig = {
        testType: "ab_test",
        minDuration: 3600000, // 1 hour
        maxDuration: 86400000, // 24 hours
        minSampleSize: 1000,
        targetSampleSize: 10000,
        primaryMetric: "latency",
        targetImprovement: 0.1,
        maxRegression: 0.05,
        earlyStopOnSuccess: true,
        earlyStopOnFailure: true,
      };

      expect(config.testType).toBe("ab_test");
      expect(config.minDuration).toBe(3600000);
      expect(config.targetSampleSize).toBe(10000);
    });

    it("should configure multivariate test", () => {
      const config: TestingConfig = {
        testType: "multivariate",
        minDuration: 7200000,
        maxDuration: 172800000,
        minSampleSize: 5000,
        targetSampleSize: 50000,
        primaryMetric: "quality",
        targetImprovement: 0.15,
        maxRegression: 0.03,
        earlyStopOnSuccess: false,
        earlyStopOnFailure: true,
      };

      expect(config.testType).toBe("multivariate");
    });

    it("should configure sequential test", () => {
      const config: TestingConfig = {
        testType: "sequential",
        minDuration: 1800000,
        maxDuration: 3600000,
        minSampleSize: 500,
        targetSampleSize: 2000,
        primaryMetric: "cost",
        targetImprovement: 0.2,
        maxRegression: 0,
        earlyStopOnSuccess: true,
        earlyStopOnFailure: true,
      };

      expect(config.testType).toBe("sequential");
    });
  });

  describe("HypothesisResult", () => {
    it("should store test results from a node", () => {
      const metricsBefore: MetricsSnapshot = {
        avgLatency: 1000,
        p50Latency: 800,
        p95Latency: 1500,
        p99Latency: 2000,
        avgQuality: 0.8,
        userSatisfaction: 0.75,
        avgCost: 0.01,
        totalCost: 100,
        cacheHitRate: 0.6,
        timestamp: Date.now() - 3600000,
      };

      const metricsAfter: MetricsSnapshot = {
        avgLatency: 800,
        p50Latency: 650,
        p95Latency: 1200,
        p99Latency: 1600,
        avgQuality: 0.85,
        userSatisfaction: 0.8,
        avgCost: 0.009,
        totalCost: 90,
        cacheHitRate: 0.75,
        timestamp: Date.now(),
      };

      const result: HypothesisResult = {
        hypothesisId: "hyp-123",
        nodeId: "node-1",
        testType: "ab_test",
        duration: 3600000,
        sampleSize: 5000,
        metricsBefore,
        metricsAfter,
        decision: "accept",
        confidence: 0.85,
        improvement: {
          latency: 0.2,
          quality: 0.06,
          cost: 0.1,
        },
        errors: [],
        completedAt: Date.now(),
      };

      expect(result.decision).toBe("accept");
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.improvement.latency).toBe(0.2);
    });

    it("should record rejection with reasons", () => {
      const result: HypothesisResult = {
        hypothesisId: "hyp-456",
        nodeId: "node-2",
        testType: "ab_test",
        duration: 1800000,
        sampleSize: 1000,
        metricsBefore: {
          avgLatency: 500,
          p50Latency: 400,
          p95Latency: 800,
          p99Latency: 1200,
          avgQuality: 0.9,
          userSatisfaction: 0.85,
          avgCost: 0.005,
          totalCost: 50,
          timestamp: Date.now() - 1800000,
        },
        metricsAfter: {
          avgLatency: 600,
          p50Latency: 500,
          p95Latency: 1000,
          p99Latency: 1500,
          avgQuality: 0.88,
          userSatisfaction: 0.8,
          avgCost: 0.006,
          totalCost: 60,
          timestamp: Date.now(),
        },
        decision: "reject",
        confidence: 0.75,
        improvement: {
          latency: -0.2,
          quality: -0.02,
          cost: -0.2,
        },
        errors: ["Latency increased beyond acceptable threshold"],
        completedAt: Date.now(),
      };

      expect(result.decision).toBe("reject");
      expect(result.improvement.latency).toBeLessThan(0);
      expect(result.errors).toHaveLength(1);
    });

    it("should handle inconclusive results", () => {
      const result: HypothesisResult = {
        hypothesisId: "hyp-789",
        nodeId: "node-3",
        testType: "ab_test",
        duration: 3600000,
        sampleSize: 500,
        metricsBefore: {
          avgLatency: 700,
          p50Latency: 600,
          p95Latency: 1100,
          p99Latency: 1600,
          avgQuality: 0.82,
          userSatisfaction: 0.78,
          avgCost: 0.008,
          totalCost: 80,
          timestamp: Date.now() - 3600000,
        },
        metricsAfter: {
          avgLatency: 690,
          p50Latency: 590,
          p95Latency: 1080,
          p99Latency: 1580,
          avgQuality: 0.83,
          userSatisfaction: 0.79,
          avgCost: 0.008,
          totalCost: 79,
          timestamp: Date.now(),
        },
        decision: "inconclusive",
        confidence: 0.4,
        improvement: {
          latency: 0.014,
          quality: 0.012,
          cost: 0.012,
        },
        errors: [],
        completedAt: Date.now(),
      };

      expect(result.decision).toBe("inconclusive");
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe("HypothesisDistribution", () => {
    it("should track distribution status", () => {
      const distribution: HypothesisDistribution = {
        hypothesisId: "hyp-123",
        status: "distributed",
        targetNodes: ["node-1", "node-2", "node-3"],
        completedNodes: [],
        failedNodes: [],
        results: [],
      };

      expect(distribution.status).toBe("distributed");
      expect(distribution.targetNodes).toHaveLength(3);
    });

    it("should track testing progress", () => {
      const distribution: HypothesisDistribution = {
        hypothesisId: "hyp-456",
        status: "testing",
        targetNodes: ["node-1", "node-2", "node-3", "node-4"],
        completedNodes: ["node-1", "node-2"],
        failedNodes: ["node-3"],
        results: [],
      };

      expect(distribution.status).toBe("testing");
      expect(distribution.completedNodes).toHaveLength(2);
      expect(distribution.failedNodes).toHaveLength(1);
    });

    it("should track completed distribution", () => {
      const distribution: HypothesisDistribution = {
        hypothesisId: "hyp-789",
        status: "completed",
        targetNodes: ["node-1", "node-2", "node-3"],
        completedNodes: ["node-1", "node-2", "node-3"],
        failedNodes: [],
        results: [],
        finalDecision: "accept",
        finalConfidence: 0.85,
      };

      expect(distribution.status).toBe("completed");
      expect(distribution.finalDecision).toBe("accept");
      expect(distribution.finalConfidence).toBeGreaterThan(0.8);
    });
  });

  describe("AggregatedResult", () => {
    it("should aggregate results from multiple nodes", () => {
      const aggregated: AggregatedResult = {
        hypothesisId: "hyp-123",
        acceptCount: 4,
        rejectCount: 1,
        inconclusiveCount: 1,
        avgImprovement: {
          latency: 0.18,
          quality: 0.08,
          cost: 0.12,
        },
        significance: 0.01,
        recommendation: "accept",
      };

      expect(aggregated.acceptCount).toBe(4);
      expect(aggregated.rejectCount).toBe(1);
      expect(aggregated.inconclusiveCount).toBe(1);
      expect(aggregated.significance).toBeLessThan(0.05);
      expect(aggregated.recommendation).toBe("accept");
    });

    it("should recommend more data when inconclusive", () => {
      const aggregated: AggregatedResult = {
        hypothesisId: "hyp-456",
        acceptCount: 2,
        rejectCount: 1,
        inconclusiveCount: 3,
        avgImprovement: {
          latency: 0.05,
          quality: 0.02,
          cost: 0.03,
        },
        significance: 0.15,
        recommendation: "need_more_data",
      };

      expect(aggregated.recommendation).toBe("need_more_data");
      expect(aggregated.significance).toBeGreaterThan(0.1);
    });
  });

  describe("ValidationMetrics", () => {
    it("should track validation statistics", () => {
      const metrics: ValidationMetrics = {
        totalHypotheses: 100,
        acceptedHypotheses: 45,
        rejectedHypotheses: 35,
        inconclusiveHypotheses: 20,
        avgTestingTime: 7200000, // 2 hours
        avgImprovement: {
          latency: 0.15,
          quality: 0.08,
          cost: 0.12,
        },
      };

      expect(metrics.totalHypotheses).toBe(100);
      expect(
        metrics.acceptedHypotheses +
          metrics.rejectedHypotheses +
          metrics.inconclusiveHypotheses
      ).toBe(metrics.totalHypotheses);
      expect(metrics.avgImprovement.latency).toBeGreaterThan(0.1);
    });
  });

  describe("NodeCapabilities", () => {
    it("should describe node capabilities for testing", () => {
      const capabilities: NodeCapabilities = {
        nodeId: "node-1",
        memoryMB: 16384,
        cpuCores: 8,
        workload: "mixed",
        canTest: true,
        supportedHypothesisTypes: [
          "cache_optimization",
          "routing_rule",
          "adapter_config",
        ],
      };

      expect(capabilities.nodeId).toBe("node-1");
      expect(capabilities.canTest).toBe(true);
      expect(capabilities.supportedHypothesisTypes).toContain(
        "cache_optimization"
      );
    });
  });

  describe("DistributionRequest", () => {
    it("should create distribution request", () => {
      const packet: HypothesisPacket = {
        version: "1.0.0",
        hypothesisId: "hyp-123",
        timestamp: Date.now(),
        sourceNodeId: "node-1",
        type: "cache_optimization",
        title: "Test hypothesis",
        description: "Testing cache optimization",
        expectedImpact: {
          latency: 0.1,
          quality: 0.05,
          cost: -0.05,
          confidence: 0.8,
        },
        actionability: {
          level: "high",
          difficulty: "easy",
          estimatedTime: 2,
          requiredChanges: [],
          risks: [],
          rollbackComplexity: "trivial",
        },
        evidence: [],
        distributionScope: { type: "cluster" },
        testingConfig: {
          testType: "ab_test",
          minDuration: 3600000,
          maxDuration: 86400000,
          minSampleSize: 100,
          targetSampleSize: 1000,
          primaryMetric: "latency",
          targetImprovement: 0.1,
          maxRegression: 0.05,
          earlyStopOnSuccess: true,
          earlyStopOnFailure: true,
        },
        validationRequired: true,
        minConfidence: 0.7,
      };

      const request: HypothesisDistributionRequest = {
        hypothesis: packet,
        targetNodes: ["node-1", "node-2", "node-3"],
        priority: 0.8,
        timeout: 86400000,
      };

      expect(request.hypothesis.hypothesisId).toBe("hyp-123");
      expect(request.targetNodes).toHaveLength(3);
      expect(request.priority).toBe(0.8);
      expect(request.timeout).toBe(86400000);
    });
  });

  describe("DistributionResponse", () => {
    it("should accept distribution request", () => {
      const response: HypothesisDistributionResponse = {
        distributionId: "dist-123",
        hypothesisId: "hyp-123",
        selectedNodes: ["node-1", "node-2", "node-3"],
        estimatedCompletionTime: Date.now() + 3600000,
        status: "accepted",
      };

      expect(response.status).toBe("accepted");
      expect(response.selectedNodes).toHaveLength(3);
      expect(response.estimatedCompletionTime).toBeGreaterThan(Date.now());
    });

    it("should reject distribution request with reason", () => {
      const response: HypothesisDistributionResponse = {
        distributionId: "dist-456",
        hypothesisId: "hyp-456",
        selectedNodes: [],
        estimatedCompletionTime: 0,
        status: "rejected",
        rejectionReason: "Insufficient node capacity",
      };

      expect(response.status).toBe("rejected");
      expect(response.rejectionReason).toBeDefined();
    });
  });

  describe("Serialization", () => {
    it("should serialize and deserialize hypothesis packet", () => {
      const original: HypothesisPacket = {
        version: "1.0.0",
        hypothesisId: "hyp-serialize",
        timestamp: Date.now(),
        sourceNodeId: "node-1",
        type: "cache_optimization",
        title: "Serialization test",
        description: "Testing serialization",
        expectedImpact: {
          latency: 0.1,
          quality: 0.05,
          cost: -0.05,
          confidence: 0.8,
        },
        actionability: {
          level: "high",
          difficulty: "easy",
          estimatedTime: 1,
          requiredChanges: [],
          risks: [],
          rollbackComplexity: "trivial",
        },
        evidence: [],
        distributionScope: { type: "local" },
        testingConfig: {
          testType: "ab_test",
          minDuration: 3600000,
          maxDuration: 86400000,
          minSampleSize: 100,
          targetSampleSize: 1000,
          primaryMetric: "latency",
          targetImprovement: 0.1,
          maxRegression: 0.05,
          earlyStopOnSuccess: true,
          earlyStopOnFailure: true,
        },
        validationRequired: true,
        minConfidence: 0.7,
      };

      const serialized = JSON.stringify(original);
      const deserialized = JSON.parse(serialized) as HypothesisPacket;

      expect(deserialized.hypothesisId).toBe(original.hypothesisId);
      expect(deserialized.type).toBe(original.type);
      expect(deserialized.expectedImpact.confidence).toBe(
        original.expectedImpact.confidence
      );
    });
  });
});
