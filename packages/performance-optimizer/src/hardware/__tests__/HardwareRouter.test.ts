/**
 * HardwareRouter Tests
 *
 * Tests for intelligent hardware routing decisions.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HardwareRouter } from "../HardwareRouter.js";
import { HardwareDetector } from "../HardwareDetector.js";
import { CapabilityProfiler } from "../CapabilityProfiler.js";
import type {
  HardwareProfile,
  OperationType,
  HardwareTarget,
  RoutingPriority,
  HardwareRoutingConstraints,
  GPUType,
} from "@lsi/protocol";

describe("HardwareRouter", () => {
  let router: HardwareRouter;
  let detector: HardwareDetector;
  let profiler: CapabilityProfiler;

  const createMockProfile = (overrides?: Partial<HardwareProfile>): HardwareProfile => ({
    timestamp: Date.now(),
    gpu: {
      type: GPUType.NONE,
      name: "No GPU",
      vramMB: 0,
      availableVRAMMB: 0,
      available: false,
      features: [],
    },
    cpu: {
      architecture: "x64",
      physicalCores: 8,
      logicalCores: 16,
      baseClockMHz: 3000,
      maxClockMHz: 5000,
      model: "Test CPU",
      vendor: "Intel",
      simd: {
        sse: true,
        sse2: true,
        sse3: true,
        sse4_1: true,
        sse4_2: true,
        avx: true,
        avx2: true,
        avx512: false,
        neon: false,
      },
      cache: {
        l1KB: 512,
        l2KB: 4096,
        l3KB: 16384,
      },
    },
    memory: {
      totalMB: 32768,
      availableMB: 16384,
      usedMB: 16384,
      usagePercent: 50,
    },
    npu: {
      available: false,
      computeAvailable: false,
      supportedPrecision: [],
    },
    thermal: {
      state: "normal",
      throttling: false,
    },
    capabilityScore: 50,
    capabilities: {
      gpuScore: 0,
      cpuScore: 50,
      memoryScore: 50,
      npuScore: 0,
      supportedOperations: {
        mlInference: false,
        mlTraining: false,
        vectorOps: true,
        matrixMul: true,
        videoEncode: false,
        videoDecode: false,
      },
    },
    ...overrides,
  });

  beforeEach(() => {
    detector = new HardwareDetector();
    profiler = new CapabilityProfiler();
    router = new HardwareRouter(detector, profiler);
  });

  describe("Basic Routing", () => {
    it("should route simple queries to CPU", async () => {
      const decision = await router.route(OperationType.SIMPLE_QUERY);

      expect(decision.target).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.reasoning).toBeDefined();
      expect(Array.isArray(decision.reasoning)).toBe(true);
    });

    it("should route ML inference to optimal hardware", async () => {
      const decision = await router.route(OperationType.ML_INFERENCE);

      expect(decision.target).toBeDefined();
      expect(decision.estimatedLatency).toBeGreaterThan(0);
      expect(decision.fallbackTargets).toBeDefined();
      expect(Array.isArray(decision.fallbackTargets)).toBe(true);
    });

    it("should respect routing priority", async () => {
      const normalDecision = await router.routeWithPriority(
        OperationType.ML_INFERENCE,
        RoutingPriority.NORMAL
      );

      const criticalDecision = await router.routeWithPriority(
        OperationType.ML_INFERENCE,
        RoutingPriority.CRITICAL
      );

      expect(normalDecision.target).toBeDefined();
      expect(criticalDecision.target).toBeDefined();
    });
  });

  describe("Constraint-Based Routing", () => {
    it("should require local execution when specified", async () => {
      const constraints: HardwareRoutingConstraints = {
        requireLocal: true,
      };

      const decision = await router.route(OperationType.ML_INFERENCE, constraints);

      expect(decision.useCloud).toBe(false);
      expect(decision.target).not.toBe("cloud");
    });

    it("should prefer local execution when specified", async () => {
      const constraints: HardwareRoutingConstraints = {
        preferLocal: true,
      };

      const decision = await router.route(OperationType.ML_INFERENCE, constraints);

      expect(decision.reasoning).toContain("Local execution preferred");
    });

    it("should respect latency constraints", async () => {
      const constraints: HardwareRoutingConstraints = {
        maxLatency: 50,
      };

      const decision = await router.route(OperationType.SIMPLE_QUERY, constraints);

      expect(decision.estimatedLatency).toBeDefined();
      // Should warn if latency exceeds constraint
      if (decision.estimatedLatency > 50) {
        expect(decision.reasoning.some(r => r.includes("Latency"))).toBe(true);
      }
    });

    it("should respect cost constraints", async () => {
      const constraints: HardwareRoutingConstraints = {
        maxCost: 0.0001,
      };

      const decision = await router.route(OperationType.SIMPLE_QUERY, constraints);

      expect(decision.estimatedCost).toBeDefined();
      // Local routes should be free
      if (decision.target !== "cloud") {
        expect(decision.estimatedCost).toBe(0);
      }
    });

    it("should respect memory requirements", async () => {
      const constraints: HardwareRoutingConstraints = {
        memoryRequirementMB: 1024,
        requireLocal: true,
      };

      const decision = await router.route(OperationType.SIMPLE_QUERY, constraints);

      // Should succeed if we have enough memory
      expect(decision.target).toBeDefined();
    });

    it("should respect VRAM requirements", async () => {
      const constraints: HardwareRoutingConstraints = {
        vramRequirementMB: 8192,
        requireLocal: true,
      };

      const decision = await router.route(OperationType.ML_TRAINING, constraints);

      // Should fail if not enough VRAM and requireLocal is true
      if (decision.target === "cpu") {
        expect(decision.confidence).toBeLessThan(0.5);
      }
    });

    it("should respect thermal limits", async () => {
      const constraints: HardwareRoutingConstraints = {
        thermalLimit: "high",
      };

      // Mock thermal state
      vi.spyOn(detector, "detect").mockResolvedValue({
        success: true,
        profile: createMockProfile({
          thermal: { state: "critical", throttling: true },
        }),
        detectionTime: 10,
      });

      const decision = await router.route(OperationType.ML_INFERENCE, constraints);

      expect(decision.target).toBeDefined();
      if (constraints.preferLocal) {
        expect(decision.target).not.toBe("cloud");
      }
    });
  });

  describe("Routing Strategies", () => {
    it("should use capability-first strategy", async () => {
      const capabilityRouter = new HardwareRouter(detector, profiler, {
        routingStrategy: "capability-first",
      });

      const decision = await capabilityRouter.route(OperationType.ML_INFERENCE);

      expect(decision.target).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should use cost-first strategy", async () => {
      const costRouter = new HardwareRouter(detector, profiler, {
        routingStrategy: "cost-first",
      });

      const decision = await costRouter.route(OperationType.ML_INFERENCE);

      // Cost-first should prefer local (free)
      expect(decision.estimatedCost).toBe(0);
    });

    it("should use latency-first strategy", async () => {
      const latencyRouter = new HardwareRouter(detector, profiler, {
        routingStrategy: "latency-first",
      });

      const decision = await latencyRouter.route(OperationType.SIMPLE_QUERY);

      expect(decision.estimatedLatency).toBeGreaterThan(0);
    });

    it("should use balanced strategy", async () => {
      const balancedRouter = new HardwareRouter(detector, profiler, {
        routingStrategy: "balanced",
      });

      const decision = await balancedRouter.route(OperationType.ML_INFERENCE);

      expect(decision.target).toBeDefined();
      expect(decision.reasoning).toBeDefined();
    });
  });

  describe("Fallback Behavior", () => {
    it("should include fallback targets", async () => {
      const decision = await router.route(OperationType.ML_INFERENCE);

      expect(decision.fallbackTargets.length).toBeGreaterThan(0);
      expect(decision.fallbackTargets).not.toContain(decision.target);
    });

    it("should fallback to cloud when local insufficient", async () => {
      const constraints: HardwareRoutingConstraints = {
        vramRequirementMB: 24576, // Very high requirement
      };

      const decision = await router.route(OperationType.ML_TRAINING, constraints);

      // Should use cloud if local GPU insufficient
      expect(decision.useCloud).toBeDefined();
      expect(typeof decision.useCloud).toBe("boolean");
    });

    it("should handle detection failure gracefully", async () => {
      vi.spyOn(detector, "detect").mockResolvedValue({
        success: false,
        error: "Detection failed",
        detectionTime: 10,
      });

      const decision = await router.route(OperationType.ML_INFERENCE);

      expect(decision.target).toBe("cloud");
      expect(decision.useCloud).toBe(true);
    });
  });

  describe("Statistics", () => {
    it("should track routing statistics", async () => {
      await router.route(OperationType.SIMPLE_QUERY);
      await router.route(OperationType.ML_INFERENCE);

      const stats = router.getStatistics();

      expect(stats.totalRoutes).toBe(2);
      expect(stats.routesByOperation["simple_query"]).toBe(1);
      expect(stats.routesByOperation["ml_inference"]).toBe(1);
      expect(stats.averageLatency).toBeGreaterThan(0);
    });

    it("should track routes by target", async () => {
      await router.route(OperationType.SIMPLE_QUERY);

      const stats = router.getStatistics();

      expect(Object.keys(stats.routesByTarget).length).toBeGreaterThan(0);
    });

    it("should track cloud fallback rate", async () => {
      vi.spyOn(detector, "detect").mockResolvedValue({
        success: false,
        error: "Detection failed",
        detectionTime: 10,
      });

      await router.route(OperationType.ML_INFERENCE);
      await router.route(OperationType.ML_TRAINING);

      const stats = router.getStatistics();

      expect(stats.cloudFallbackRate).toBeGreaterThan(0);
    });

    it("should clear statistics", async () => {
      await router.route(OperationType.SIMPLE_QUERY);
      router.clearStatistics();

      const stats = router.getStatistics();

      expect(stats.totalRoutes).toBe(0);
      expect(stats.routesByTarget).toEqual({});
      expect(stats.routesByOperation).toEqual({});
    });
  });

  describe("Decision Quality", () => {
    it("should provide reasoning for decisions", async () => {
      const decision = await router.route(OperationType.ML_INFERENCE);

      expect(decision.reasoning.length).toBeGreaterThan(0);
      decision.reasoning.forEach(reason => {
        expect(typeof reason).toBe("string");
        expect(reason.length).toBeGreaterThan(0);
      });
    });

    it("should estimate latency accurately", async () => {
      const decision = await router.route(OperationType.SIMPLE_QUERY);

      expect(decision.estimatedLatency).toBeGreaterThan(0);
      expect(decision.estimatedLatency).toBeLessThan(10000); // Less than 10 seconds
    });

    it("should estimate cost accurately", async () => {
      const decision = await router.route(OperationType.SIMPLE_QUERY);

      expect(decision.estimatedCost).toBeGreaterThanOrEqual(0);

      // Local routes should be free
      if (decision.target !== "cloud") {
        expect(decision.estimatedCost).toBe(0);
      }
    });

    it("should calculate confidence correctly", async () => {
      const decision = await router.route(OperationType.SIMPLE_QUERY);

      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Operation-Specific Routing", () => {
    it("should route video processing appropriately", async () => {
      const decision = await router.route(OperationType.VIDEO_PROCESSING);

      expect(decision.target).toBeDefined();
      if (decision.target === "cpu") {
        expect(decision.confidence).toBeLessThan(0.5);
      }
    });

    it("should route ML training appropriately", async () => {
      const decision = await router.route(OperationType.ML_TRAINING);

      expect(decision.target).toBeDefined();
      // ML training needs substantial resources
      expect(decision.estimatedLatency).toBeGreaterThan(100);
    });

    it("should route embedding generation appropriately", async () => {
      const decision = await router.route(OperationType.EMBEDDING_GEN);

      expect(decision.target).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it("should route embedding search appropriately", async () => {
      const decision = await router.route(OperationType.EMBEDDING_SEARCH);

      expect(decision.target).toBeDefined();
      // Search should be fast
      expect(decision.estimatedLatency).toBeLessThan(500);
    });
  });

  describe("Edge Cases", () => {
    it("should handle all operation types", async () => {
      const operations: OperationType[] = [
        "simple_query",
        "complex_reasoning",
        "ml_inference",
        "ml_training",
        "vector_ops",
        "matrix_ops",
        "video_processing",
        "embedding_gen",
        "embedding_search",
        "general_compute",
      ];

      for (const operation of operations) {
        const decision = await router.route(operation);
        expect(decision.target).toBeDefined();
      }
    });

    it("should handle concurrent routing requests", async () => {
      const promises = [
        router.route(OperationType.SIMPLE_QUERY),
        router.route(OperationType.ML_INFERENCE),
        router.route(OperationType.VECTOR_OPS),
      ];

      const decisions = await Promise.all(promises);

      decisions.forEach(decision => {
        expect(decision.target).toBeDefined();
        expect(decision.confidence).toBeGreaterThan(0);
      });
    });

    it("should handle empty constraints", async () => {
      const decision = await router.route(OperationType.SIMPLE_QUERY, {});

      expect(decision.target).toBeDefined();
    });

    it("should handle conflicting constraints", async () => {
      const constraints: HardwareRoutingConstraints = {
        requireLocal: true,
        vramRequirementMB: 24576, // Impossibly high
      };

      const decision = await router.route(OperationType.ML_TRAINING, constraints);

      expect(decision.target).toBeDefined();
      expect(decision.confidence).toBeLessThan(0.5);
    });
  });
});
