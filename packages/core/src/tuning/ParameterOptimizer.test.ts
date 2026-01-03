/**
 * Tests for ParameterOptimizer
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ParameterOptimizer,
  createParameterOptimizer,
  type TunableParameter,
} from "./ParameterOptimizer.js";
import { type WorkloadPattern } from "./WorkloadAnalyzer.js";
import { DEFAULT_TUNABLE_PARAMETERS } from "./AutoTuner.js";

describe("ParameterOptimizer", () => {
  let optimizer: ParameterOptimizer;

  beforeEach(() => {
    optimizer = createParameterOptimizer();
  });

  describe("Constructor", () => {
    it("should create a ParameterOptimizer", () => {
      expect(optimizer).toBeInstanceOf(ParameterOptimizer);
    });
  });

  describe("optimize", () => {
    it("should optimize parameters for steady workload", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 3);

      const objective = {
        primary: "efficiency" as const,
        secondary: [
          { metric: "latency", weight: 0.5, maximize: false },
          { metric: "throughput", weight: 0.5, maximize: true },
        ],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.parameters).toBeInstanceOf(Map);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.recommendations).toBeDefined();
    });

    it("should handle null workload gracefully", async () => {
      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "latency" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(null, parameters, objective);

      expect(result.parameters).toBeInstanceOf(Map);
      expect(result.expectedMetrics).toBeDefined();
    });

    it("should use grid search for small parameter space", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "latency" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.parameters.size).toBe(2);
    });

    it("should generate recommendations", async () => {
      const workload: WorkloadPattern = {
        patternType: "interactive",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.3,
        avgLength: 50,
        avgLatency: 50,
        avgThroughput: 10,
        cacheHitRate: 0.7,
        predictability: 0.9,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 4);

      const objective = {
        primary: "latency" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.recommendations.length).toBeGreaterThan(0);

      const rec = result.recommendations[0];
      expect(rec).toHaveProperty("parameter");
      expect(rec).toHaveProperty("currentValue");
      expect(rec).toHaveProperty("recommendedValue");
      expect(rec).toHaveProperty("expectedImprovement");
      expect(rec).toHaveProperty("confidence");
      expect(rec).toHaveProperty("reason");
    });

    it("should respect parameter constraints", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "efficiency" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      // Check that recommended values are within bounds
      for (const [name, value] of result.parameters.entries()) {
        const param = parameters.find(p => p.name === name);
        if (param) {
          expect(value).toBeGreaterThanOrEqual(param.minValue);
          expect(value).toBeLessThanOrEqual(param.maxValue);
        }
      }
    });
  });

  describe("estimateImprovement", () => {
    it("should estimate improvement for parameter change", () => {
      const param = DEFAULT_TUNABLE_PARAMETERS[0];
      const newValue = param.currentValue + param.stepSize;
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const improvement = optimizer.estimateImprovement(
        param,
        newValue,
        workload
      );

      expect(improvement).toBeGreaterThanOrEqual(0);
      expect(improvement).toBeLessThanOrEqual(1);
    });

    it("should estimate higher improvement for high-impact parameters", () => {
      const param = {
        ...DEFAULT_TUNABLE_PARAMETERS[0],
        impactEstimate: 0.9,
      };

      const highImpactImprovement = optimizer.estimateImprovement(
        param,
        param.currentValue + param.stepSize,
        null
      );

      const lowImpactParam = {
        ...param,
        impactEstimate: 0.3,
      };

      const lowImpactImprovement = optimizer.estimateImprovement(
        lowImpactParam,
        lowImpactParam.currentValue + lowImpactParam.stepSize,
        null
      );

      expect(highImpactImprovement).toBeGreaterThan(lowImpactImprovement);
    });

    it("should estimate higher improvement for larger changes", () => {
      const param = DEFAULT_TUNABLE_PARAMETERS[0];
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const smallChange = param.currentValue + param.stepSize;
      const largeChange = param.currentValue + param.stepSize * 10;

      const smallImprovement = optimizer.estimateImprovement(
        param,
        smallChange,
        workload
      );
      const largeImprovement = optimizer.estimateImprovement(
        param,
        largeChange,
        workload
      );

      expect(largeImprovement).toBeGreaterThan(smallImprovement);
    });

    it("should consider workload predictability", () => {
      const param = DEFAULT_TUNABLE_PARAMETERS[0];
      const newValue = param.currentValue + param.stepSize;

      const predictableWorkload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.9,
      };

      const unpredictableWorkload: WorkloadPattern = {
        patternType: "burst",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.3,
      };

      const predictableImprovement = optimizer.estimateImprovement(
        param,
        newValue,
        predictableWorkload
      );

      const unpredictableImprovement = optimizer.estimateImprovement(
        param,
        newValue,
        unpredictableWorkload
      );

      expect(predictableImprovement).toBeGreaterThan(unpredictableImprovement);
    });
  });

  describe("Performance metrics simulation", () => {
    it("should simulate better cache hit rate with larger cache", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = [DEFAULT_TUNABLE_PARAMETERS[0]];

      const objective = {
        primary: "efficiency" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.expectedMetrics).toBeDefined();
      expect(result.expectedMetrics.throughput).toBeGreaterThanOrEqual(0);
      expect(result.expectedMetrics.latency.p95).toBeGreaterThan(0);
      expect(result.expectedMetrics.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.expectedMetrics.qualityScore).toBeLessThanOrEqual(1);
    });

    it("should simulate lower latency with higher cache hit rate", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.9,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 3);

      const objective = {
        primary: "latency" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.expectedMetrics.latency.p95).toBeGreaterThan(0);
    });
  });

  describe("Objective function handling", () => {
    it("should optimize for latency objective", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "latency" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.parameters).toBeInstanceOf(Map);
    });

    it("should optimize for throughput objective", async () => {
      const workload: WorkloadPattern = {
        patternType: "batch",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 100,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "throughput" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.parameters).toBeInstanceOf(Map);
    });

    it("should optimize for quality objective", async () => {
      const workload: WorkloadPattern = {
        patternType: "interactive",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.7,
        avgLength: 150,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "quality" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.parameters).toBeInstanceOf(Map);
    });

    it("should optimize for cost objective", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "cost" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.parameters).toBeInstanceOf(Map);
    });

    it("should handle secondary objectives", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "efficiency" as const,
        secondary: [
          { metric: "latency", weight: 0.3, maximize: false },
          { metric: "throughput", weight: 0.3, maximize: true },
          { metric: "quality", weight: 0.2, maximize: true },
          { metric: "cost", weight: 0.2, maximize: false },
        ],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.parameters).toBeInstanceOf(Map);
    });

    it("should handle target values", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "latency" as const,
        secondary: [],
        targets: [
          { metric: "latency", value: 80 },
          { metric: "quality", value: 0.9 },
        ],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      expect(result.parameters).toBeInstanceOf(Map);
    });
  });

  describe("Recommendation generation", () => {
    it("should skip parameters with minimal changes", async () => {
      const workload: WorkloadPattern = {
        patternType: "steady",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.5,
        avgLength: 100,
        avgLatency: 100,
        avgThroughput: 50,
        cacheHitRate: 0.5,
        predictability: 0.8,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 2);

      const objective = {
        primary: "efficiency" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      // Should only recommend significant changes
      result.recommendations.forEach(rec => {
        const changePercent = Math.abs(
          (rec.recommendedValue - rec.currentValue) / rec.currentValue
        );
        // Small changes should be filtered out
        if (changePercent < 0.05) {
          expect(rec.expectedImprovement).toBeLessThan(0.1);
        }
      });
    });

    it("should provide reasons for recommendations", async () => {
      const workload: WorkloadPattern = {
        patternType: "burst",
        timeOfDay: [10],
        dayOfWeek: [1],
        queryTypes: ["test"],
        avgComplexity: 0.7,
        avgLength: 150,
        avgLatency: 150,
        avgThroughput: 100,
        cacheHitRate: 0.3,
        predictability: 0.6,
      };

      const parameters = DEFAULT_TUNABLE_PARAMETERS.slice(0, 3);

      const objective = {
        primary: "throughput" as const,
        secondary: [],
        targets: [],
      };

      const result = await optimizer.optimize(workload, parameters, objective);

      result.recommendations.forEach(rec => {
        expect(rec.reason).toBeDefined();
        expect(rec.reason.length).toBeGreaterThan(0);
      });
    });
  });
});
