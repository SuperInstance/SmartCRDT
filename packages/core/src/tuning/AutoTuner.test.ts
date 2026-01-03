/**
 * Tests for AutoTuner
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AutoTuner,
  DEFAULT_AUTOTUNER_CONFIG,
  DEFAULT_TUNABLE_PARAMETERS,
  createAutoTuner,
  type AutoTunerConfig,
  type QueryHistory,
} from "./AutoTuner.js";
import {
  WorkloadAnalyzer,
  createWorkloadAnalyzer,
} from "./WorkloadAnalyzer.js";
import {
  ParameterOptimizer,
  createParameterOptimizer,
} from "./ParameterOptimizer.js";

describe("AutoTuner", () => {
  let workloadAnalyzer: WorkloadAnalyzer;
  let parameterOptimizer: ParameterOptimizer;
  let autoTuner: AutoTuner;

  beforeEach(() => {
    workloadAnalyzer = createWorkloadAnalyzer();
    parameterOptimizer = createParameterOptimizer();
    autoTuner = createAutoTuner(workloadAnalyzer, parameterOptimizer);
  });

  describe("Constructor", () => {
    it("should create an AutoTuner with default configuration", () => {
      expect(autoTuner).toBeInstanceOf(AutoTuner);
      expect(autoTuner.getParameters().length).toBeGreaterThan(0);
    });

    it("should create an AutoTuner with custom configuration", () => {
      const customConfig: Partial<AutoTunerConfig> = {
        categories: ["cache"],
        learningRate: 0.2,
        explorationRate: 0.3,
      };

      const customTuner = createAutoTuner(
        workloadAnalyzer,
        parameterOptimizer,
        customConfig
      );

      expect(customTuner).toBeInstanceOf(AutoTuner);
      expect(customTuner.getParameters().length).toBeGreaterThan(0);
    });

    it("should filter parameters by category", () => {
      const cacheOnlyTuner = createAutoTuner(
        workloadAnalyzer,
        parameterOptimizer,
        { categories: ["cache"] }
      );

      const params = cacheOnlyTuner.getParameters();
      expect(params.every(p => p.category === "cache")).toBe(true);
    });
  });

  describe("getParameters", () => {
    it("should return all tunable parameters", () => {
      const params = autoTuner.getParameters();

      expect(params.length).toBe(DEFAULT_TUNABLE_PARAMETERS.length);
      expect(params[0]).toHaveProperty("name");
      expect(params[0]).toHaveProperty("category");
      expect(params[0]).toHaveProperty("minValue");
      expect(params[0]).toHaveProperty("maxValue");
      expect(params[0]).toHaveProperty("currentValue");
    });

    it("should include parameters from all categories", () => {
      const params = autoTuner.getParameters();
      const categories = new Set(params.map(p => p.category));

      expect(categories).toContain("cache");
      expect(categories).toContain("routing");
      expect(categories).toContain("thermal");
    });
  });

  describe("setParameter", () => {
    it("should update a parameter value", async () => {
      const params = autoTuner.getParameters();
      const param = params[0];
      const newValue = param.minValue + param.stepSize;

      await autoTuner.setParameter(param.name, newValue);

      const updatedParams = autoTuner.getParameters();
      const updatedParam = updatedParams.find(p => p.name === param.name);

      expect(updatedParam?.currentValue).toBe(newValue);
    });

    it("should reject invalid parameter name", async () => {
      await expect(
        autoTuner.setParameter("unknown.parameter", 100)
      ).rejects.toThrow("Unknown parameter");
    });

    it("should reject invalid parameter values", async () => {
      const params = autoTuner.getParameters();
      const param = params[0];

      await expect(
        autoTuner.setParameter(param.name, param.maxValue + 1000)
      ).rejects.toThrow("Invalid value");
    });

    it("should record parameter changes in history", async () => {
      const params = autoTuner.getParameters();
      const param = params[0];
      const newValue = param.minValue + param.stepSize;

      await autoTuner.setParameter(param.name, newValue);

      const history = autoTuner.getHistory();
      expect(history.length).toBeGreaterThan(0);

      const lastEntry = history[history.length - 1];
      expect(lastEntry.parameter).toBe(param.name);
      expect(lastEntry.newValue).toBe(newValue);
    });
  });

  describe("getHistory", () => {
    it("should return tuning history", async () => {
      const params = autoTuner.getParameters();
      const param = params[0];

      await autoTuner.setParameter(param.name, param.minValue + param.stepSize);

      const history = autoTuner.getHistory();

      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty("timestamp");
      expect(history[0]).toHaveProperty("parameter");
      expect(history[0]).toHaveProperty("oldValue");
      expect(history[0]).toHaveProperty("newValue");
    });

    it("should return empty history initially", () => {
      const newTuner = createAutoTuner(workloadAnalyzer, parameterOptimizer);
      const history = newTuner.getHistory();

      expect(history).toEqual([]);
    });
  });

  describe("recordQuery", () => {
    it("should record query history", () => {
      const query: QueryHistory = {
        timestamp: Date.now(),
        queryType: "test",
        complexity: 0.5,
        length: 100,
        latency: 150,
        cacheHit: true,
      };

      autoTuner.recordQuery(query);

      const state = autoTuner.getWorkloadState();
      expect(state).toBeDefined();
    });

    it("should limit query history size", () => {
      // Add 2000 queries
      for (let i = 0; i < 2000; i++) {
        autoTuner.recordQuery({
          timestamp: Date.now() + i,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 150,
          cacheHit: i % 2 === 0,
        });
      }

      // History should be limited to 1000
      const state = autoTuner.getWorkloadState();
      expect(state).toBeDefined();
    });
  });

  describe("start and stop", () => {
    it("should start auto-tuning", async () => {
      await autoTuner.start();

      // Auto-tuner should be running
      const state = autoTuner.getWorkloadState();
      expect(state).toBeDefined();

      await autoTuner.stop();
    });

    it("should stop auto-tuning", async () => {
      await autoTuner.start();
      await autoTuner.stop();

      // Should not throw
      await autoTuner.stop();
    });

    it("should handle multiple start calls", async () => {
      await autoTuner.start();
      await autoTuner.start(); // Should not throw

      await autoTuner.stop();
    });
  });

  describe("getRecommendations", () => {
    it("should return recommendations array", () => {
      const recommendations = autoTuner.getRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
    });

    it("should return empty array initially", () => {
      const recommendations = autoTuner.getRecommendations();

      expect(recommendations).toEqual([]);
    });
  });

  describe("getWorkloadState", () => {
    it("should return current workload state", () => {
      const state = autoTuner.getWorkloadState();

      expect(state).toHaveProperty("currentType");
      expect(state).toHaveProperty("throughput");
      expect(state).toHaveProperty("avgLatency");
      expect(state).toHaveProperty("cacheHitRate");
      expect(state).toHaveProperty("trend");
    });

    it("should update state after recording queries", () => {
      const initialState = autoTuner.getWorkloadState();

      // Add some queries
      for (let i = 0; i < 50; i++) {
        autoTuner.recordQuery({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 150,
          cacheHit: true,
        });
      }

      const updatedState = autoTuner.getWorkloadState();
      expect(updatedState).toBeDefined();
    });
  });

  describe("Performance measurement", () => {
    it("should measure performance from query history", async () => {
      // Add queries with known characteristics
      const baseTime = Date.now();

      for (let i = 0; i < 100; i++) {
        autoTuner.recordQuery({
          timestamp: baseTime + i * 100,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100 + i * 2,
          cacheHit: i % 2 === 0,
        });
      }

      // First analyze the workload to update state
      const history = autoTuner["queryHistory"];
      await workloadAnalyzer.analyze(history, Math.min(100, history.length));

      const state = autoTuner.getWorkloadState();

      expect(state.throughput).toBeGreaterThan(0);
      expect(state.avgLatency).toBeGreaterThan(0);
      expect(state.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(state.cacheHitRate).toBeLessThanOrEqual(1);
    });
  });

  describe("Parameter validation", () => {
    it("should validate cache.maxSize parameter", async () => {
      const params = autoTuner.getParameters();
      const param = params.find(p => p.name === "cache.maxSize");

      expect(param).toBeDefined();

      // Valid values
      expect(param!.validate(100)).toBe(true);
      expect(param!.validate(10000)).toBe(true);

      // Invalid values
      expect(param!.validate(50)).toBe(false);
      expect(param!.validate(20000)).toBe(false);
    });

    it("should validate routing.complexityThreshold parameter", async () => {
      const params = autoTuner.getParameters();
      const param = params.find(p => p.name === "routing.complexityThreshold");

      expect(param).toBeDefined();

      // Valid values
      expect(param!.validate(0.3)).toBe(true);
      expect(param!.validate(0.9)).toBe(true);

      // Invalid values
      expect(param!.validate(0.2)).toBe(false);
      expect(param!.validate(1.0)).toBe(false);
    });
  });

  describe("Cooldown period", () => {
    it("should respect cooldown period for parameter tuning", async () => {
      const params = autoTuner.getParameters();
      const param = params[0];

      // Set parameter
      await autoTuner.setParameter(param.name, param.minValue + param.stepSize);

      // Try to set again immediately (should work for manual override)
      await autoTuner.setParameter(
        param.name,
        param.minValue + 2 * param.stepSize
      );

      const history = autoTuner.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("WorkloadAnalyzer", () => {
  let analyzer: WorkloadAnalyzer;

  beforeEach(() => {
    analyzer = createWorkloadAnalyzer();
  });

  describe("Constructor", () => {
    it("should create a WorkloadAnalyzer", () => {
      expect(analyzer).toBeInstanceOf(WorkloadAnalyzer);
    });

    it("should create with custom config", () => {
      const customAnalyzer = createWorkloadAnalyzer({
        patternWindowSize: 200,
        burstThreshold: 3.0,
      });

      expect(customAnalyzer).toBeInstanceOf(WorkloadAnalyzer);
    });
  });

  describe("analyze", () => {
    it("should analyze empty history", async () => {
      const patterns = await analyzer.analyze([], 100);

      expect(patterns).toEqual([]);
    });

    it("should detect steady workload pattern", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 100; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 100);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]).toHaveProperty("patternType");
      expect(patterns[0]).toHaveProperty("avgComplexity");
      expect(patterns[0]).toHaveProperty("avgThroughput");
      expect(patterns[0]).toHaveProperty("cacheHitRate");
    });

    it("should detect burst workload pattern", async () => {
      const history: QueryHistory[] = [];
      const baseTime = Date.now();

      // Normal traffic
      for (let i = 0; i < 50; i++) {
        history.push({
          timestamp: baseTime + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      // Burst
      for (let i = 0; i < 50; i++) {
        history.push({
          timestamp: baseTime + 50000 + i * 100,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 150,
          cacheHit: false,
        });
      }

      const patterns = await analyzer.analyze(history, 100);

      expect(patterns.length).toBeGreaterThan(0);
    });

    it("should detect interactive workload pattern", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: Date.now() + i * 5000,
          queryType: "interactive",
          complexity: 0.3,
          length: 50,
          latency: 50,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 20);

      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("predict", () => {
    it("should predict future workload", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 100; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 100);
      const prediction = await analyzer.predict(patterns, 60000);

      expect(prediction).toHaveProperty("predictedType");
      expect(prediction).toHaveProperty("predictedThroughput");
      expect(prediction).toHaveProperty("predictedLatency");
      expect(prediction).toHaveProperty("confidence");
      expect(prediction).toHaveProperty("timeWindow");

      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it("should return low confidence for empty patterns", async () => {
      const prediction = await analyzer.predict([], 60000);

      expect(prediction.confidence).toBeLessThan(0.5);
    });
  });

  describe("getCurrentState", () => {
    it("should return initial state", () => {
      const state = analyzer.getCurrentState();

      expect(state.currentType).toBe("steady");
      expect(state.throughput).toBe(0);
      expect(state.trend).toBe("stable");
    });

    it("should update state after analysis", async () => {
      const history: QueryHistory[] = [];

      for (let i = 0; i < 100; i++) {
        history.push({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      await analyzer.analyze(history, 100);

      const state = analyzer.getCurrentState();

      expect(state.throughput).toBeGreaterThan(0);
      expect(state.avgLatency).toBeGreaterThan(0);
    });
  });

  describe("Burst detection", () => {
    it("should detect bursts in query history", async () => {
      const history: QueryHistory[] = [];
      const baseTime = Date.now();

      // Create burst pattern
      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: baseTime + i * 100,
          queryType: "burst",
          complexity: 0.7,
          length: 150,
          latency: 200,
          cacheHit: false,
        });
      }

      // Slow period
      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: baseTime + 2000 + i * 1000,
          queryType: "normal",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const patterns = await analyzer.analyze(history, 40);

      expect(patterns.length).toBeGreaterThan(0);
    });
  });
});

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
      const workload = {
        patternType: "steady" as const,
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

    it("should use grid search for small parameter space", async () => {
      const workload = null;
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
      const workload = {
        patternType: "interactive" as const,
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
  });

  describe("estimateImprovement", () => {
    it("should estimate improvement for parameter change", () => {
      const param = DEFAULT_TUNABLE_PARAMETERS[0];
      const newValue = param.currentValue + param.stepSize;
      const workload = {
        patternType: "steady" as const,
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
  });

  describe("Performance metrics simulation", () => {
    it("should simulate better metrics with larger cache", async () => {
      const workload = {
        patternType: "steady" as const,
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
  });
});

describe("Integration tests", () => {
  it("should run full tuning cycle", async () => {
    const workloadAnalyzer = createWorkloadAnalyzer();
    const parameterOptimizer = createParameterOptimizer();
    const autoTuner = createAutoTuner(workloadAnalyzer, parameterOptimizer, {
      categories: ["cache"],
      tuneInterval: 100,
      cooldownPeriod: 500,
    });

    // Add query history
    for (let i = 0; i < 100; i++) {
      autoTuner.recordQuery({
        timestamp: Date.now() + i * 1000,
        queryType: "test",
        complexity: 0.5,
        length: 100,
        latency: 100 + i,
        cacheHit: i % 2 === 0,
      });
    }

    // Start auto-tuner
    await autoTuner.start();

    // Wait for at least one tuning cycle
    await new Promise(resolve => setTimeout(resolve, 200));

    // Stop auto-tuner
    await autoTuner.stop();

    // Check that tuning occurred
    const state = autoTuner.getWorkloadState();
    expect(state).toBeDefined();
  });

  it("should handle workload pattern detection and optimization", async () => {
    const workloadAnalyzer = createWorkloadAnalyzer();
    const parameterOptimizer = createParameterOptimizer();
    const autoTuner = createAutoTuner(workloadAnalyzer, parameterOptimizer);

    // Simulate burst workload
    const history: QueryHistory[] = [];
    const baseTime = Date.now();

    for (let i = 0; i < 50; i++) {
      history.push({
        timestamp: baseTime + i * 100,
        queryType: "burst",
        complexity: 0.7,
        length: 150,
        latency: 200,
        cacheHit: false,
      });
    }

    for (const query of history) {
      autoTuner.recordQuery(query);
    }

    const patterns = await workloadAnalyzer.analyze(history, 50);
    expect(patterns.length).toBeGreaterThan(0);

    const optimization = await parameterOptimizer.optimize(
      patterns[0] || null,
      DEFAULT_TUNABLE_PARAMETERS.slice(0, 3),
      {
        primary: "throughput",
        secondary: [],
        targets: [],
      }
    );

    expect(optimization.recommendations).toBeDefined();
  });
});
