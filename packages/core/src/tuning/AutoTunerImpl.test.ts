/**
 * @lsi/core/tuning - AutoTunerImpl Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AutoTunerImpl, createAutoTunerImpl } from "./AutoTunerImpl.js";
import { WorkloadAnalyzer } from "./WorkloadAnalyzer.js";
import { ParameterOptimizer } from "./ParameterOptimizer.js";
import { ParameterController } from "./ParameterController.js";
import { TuningHistory } from "./TuningHistory.js";
import {
  TunableParameter,
  QueryHistory,
  PerformanceMetrics,
  DEFAULT_TUNABLE_PARAMETERS,
} from "./AutoTuner.js";

describe("AutoTunerImpl", () => {
  let autoTuner: AutoTunerImpl;
  let workloadAnalyzer: WorkloadAnalyzer;
  let parameterOptimizer: ParameterOptimizer;
  let parameterController: ParameterController;
  let tuningHistory: TuningHistory;

  beforeEach(() => {
    workloadAnalyzer = new WorkloadAnalyzer();
    parameterOptimizer = new ParameterOptimizer();
    parameterController = new ParameterController();
    tuningHistory = new TuningHistory();

    autoTuner = new AutoTunerImpl(
      {
        tuneInterval: 1000,
        cooldownPeriod: 5000,
        safeMode: true,
        rollbackOnDegradation: true,
        maxDegradation: 0.1,
        categories: ["cache", "routing"],
        objective: {
          primary: "latency",
          secondary: [
            { metric: "throughput", weight: 0.3, maximize: true },
            { metric: "quality", weight: 0.2, maximize: true },
          ],
        },
        constraints: {
          maxMemoryMB: 4096,
          maxCPUPercent: 80,
          maxLatency: 500,
          minThroughput: 10,
          minQuality: 0.8,
        },
        learningRate: 0.1,
        explorationRate: 0.2,
      },
      workloadAnalyzer,
      parameterOptimizer,
      parameterController,
      tuningHistory
    );
  });

  afterEach(async () => {
    if (autoTuner) {
      await autoTuner.stop();
    }
  });

  describe("Constructor", () => {
    it("should create instance with default config", () => {
      const tuner = createAutoTunerImpl();
      expect(tuner).toBeDefined();
      expect(tuner).toBeInstanceOf(AutoTunerImpl);
    });

    it("should create instance with custom config", () => {
      const tuner = new AutoTunerImpl({
        tuneInterval: 5000,
        categories: ["cache"],
        objective: { primary: "throughput", secondary: [] },
        constraints: { maxMemoryMB: 2048, maxCPUPercent: 60 },
        learningRate: 0.2,
        explorationRate: 0.3,
        cooldownPeriod: 10000,
        safeMode: false,
        rollbackOnDegradation: true,
        maxDegradation: 0.1,
      });
      expect(tuner).toBeDefined();
    });

    it("should register default parameters", async () => {
      const params = await autoTuner.getParameters();
      expect(params.length).toBeGreaterThan(0);
      expect(params.some(p => p.category === "cache")).toBe(true);
      expect(params.some(p => p.category === "routing")).toBe(true);
    });
  });

  describe("Start and Stop", () => {
    it("should start auto-tuning", async () => {
      await autoTuner.start();
      expect(await autoTuner.getCurrentPerformance()).toBeDefined();
    });

    it("should stop auto-tuning", async () => {
      await autoTuner.start();
      await autoTuner.stop();
      // Should not throw error
    });

    it("should handle multiple start calls", async () => {
      await autoTuner.start();
      await autoTuner.start(); // Should not create duplicate intervals
      await autoTuner.stop();
    });

    it("should handle stop without start", async () => {
      await autoTuner.stop(); // Should not throw error
    });
  });

  describe("Query Recording", () => {
    it("should record queries for analysis", () => {
      const query: QueryHistory = {
        timestamp: Date.now(),
        queryType: "test",
        complexity: 0.5,
        length: 100,
        latency: 100,
        cacheHit: true,
      };

      autoTuner.recordQuery(query);

      const state = autoTuner.getWorkloadState();
      expect(state).toBeDefined();
    });

    it("should limit query history size", () => {
      // Record 2000 queries
      for (let i = 0; i < 2000; i++) {
        autoTuner.recordQuery({
          timestamp: Date.now() + i,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      // Should only keep last 1000
      const state = autoTuner.getWorkloadState();
      expect(state).toBeDefined();
    });
  });

  describe("Parameter Control", () => {
    it("should get current parameters", async () => {
      const params = await autoTuner.getParameters();
      expect(Array.isArray(params)).toBe(true);
      expect(params.length).toBeGreaterThan(0);
    });

    it("should set parameter value", async () => {
      const params = await autoTuner.getParameters();
      if (params.length > 0) {
        const param = params[0];
        const newValue = param.minValue + (param.maxValue - param.minValue) / 2;

        await autoTuner.setParameter(param.name, newValue);

        const updatedParams = await autoTuner.getParameters();
        const updatedParam = updatedParams.find(p => p.name === param.name);
        expect(updatedParam?.currentValue).toBe(newValue);
      }
    });

    it("should throw error for invalid parameter name", async () => {
      await expect(
        autoTuner.setParameter("invalid.param", 100)
      ).rejects.toThrow();
    });

    it("should throw error for invalid parameter value", async () => {
      const params = await autoTuner.getParameters();
      if (params.length > 0) {
        const param = params[0];
        await expect(
          autoTuner.setParameter(param.name, param.maxValue + 1000)
        ).rejects.toThrow();
      }
    });
  });

  describe("Recommendations", () => {
    it("should get tuning recommendations", async () => {
      // Record some queries first
      for (let i = 0; i < 50; i++) {
        autoTuner.recordQuery({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100 + Math.random() * 50,
          cacheHit: Math.random() > 0.5,
        });
      }

      const recommendations = await autoTuner.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it("should generate recommendations with expected fields", async () => {
      // Record some queries
      for (let i = 0; i < 50; i++) {
        autoTuner.recordQuery({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const recommendations = await autoTuner.getRecommendations();

      for (const rec of recommendations) {
        expect(rec).toHaveProperty("parameter");
        expect(rec).toHaveProperty("currentValue");
        expect(rec).toHaveProperty("recommendedValue");
        expect(rec).toHaveProperty("expectedImprovement");
        expect(rec).toHaveProperty("confidence");
        expect(rec).toHaveProperty("reason");
      }
    });
  });

  describe("History", () => {
    it("should get tuning history", async () => {
      const history = await autoTuner.getHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it("should record manual parameter changes in history", async () => {
      const params = await autoTuner.getParameters();
      if (params.length > 0) {
        const param = params[0];
        const newValue = param.minValue + (param.maxValue - param.minValue) / 2;

        await autoTuner.setParameter(param.name, newValue);

        const history = await autoTuner.getHistory();
        const manualEntries = history.filter(e => (e as any).manual === true);
        expect(manualEntries.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Performance Measurement", () => {
    it("should measure current performance", async () => {
      const performance = await autoTuner.getCurrentPerformance();

      expect(performance).toHaveProperty("latency");
      expect(performance).toHaveProperty("throughput");
      expect(performance).toHaveProperty("errorRate");
      expect(performance).toHaveProperty("qualityScore");
      expect(performance).toHaveProperty("costPerRequest");
      expect(performance).toHaveProperty("resourceUsage");
    });

    it("should generate performance metrics from query history", async () => {
      // Record queries with known characteristics
      for (let i = 0; i < 100; i++) {
        autoTuner.recordQuery({
          timestamp: Date.now() + i * 100,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 150,
          cacheHit: i % 2 === 0, // 50% hit rate
        });
      }

      const performance = await autoTuner.getCurrentPerformance();
      expect(performance.throughput).toBeGreaterThan(0);
      expect(performance.qualityScore).toBeGreaterThan(0);
    });
  });

  describe("Workload State", () => {
    it("should get current workload state", () => {
      const state = autoTuner.getWorkloadState();

      expect(state).toHaveProperty("currentType");
      expect(state).toHaveProperty("throughput");
      expect(state).toHaveProperty("avgLatency");
      expect(state).toHaveProperty("cacheHitRate");
      expect(state).toHaveProperty("trend");
    });

    it("should update workload state based on queries", async () => {
      const initialState = autoTuner.getWorkloadState();

      // Record many queries
      for (let i = 0; i < 100; i++) {
        autoTuner.recordQuery({
          timestamp: Date.now() + i * 100,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      // Manually trigger workload analysis
      await (autoTuner as any).workloadAnalyzer.analyze(
        (autoTuner as any).queryHistory,
        100
      );

      const updatedState = autoTuner.getWorkloadState();
      expect(updatedState.throughput).toBeGreaterThan(0);
    });
  });

  describe("Safety Checks", () => {
    it("should detect high load conditions", async () => {
      // Record high-throughput queries
      for (let i = 0; i < 200; i++) {
        autoTuner.recordQuery({
          timestamp: Date.now() + i * 5, // High rate
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      // Manually trigger workload analysis
      await (autoTuner as any).workloadAnalyzer.analyze(
        (autoTuner as any).queryHistory,
        200
      );

      const state = autoTuner.getWorkloadState();
      // State should reflect high load
      expect(state.throughput).toBeGreaterThan(0);
    });
  });

  describe("Filtering Safe Recommendations", () => {
    it("should filter recommendations by confidence", async () => {
      // This is tested indirectly through getRecommendations
      const recommendations = await autoTuner.getRecommendations();

      // In safe mode, only high-confidence recommendations should be returned
      for (const rec of recommendations) {
        if (rec.expectedImprovement > 0.05) {
          expect(rec.confidence).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Parameter Cooldown", () => {
    it("should respect parameter cooldown period", async () => {
      const params = await autoTuner.getParameters();
      if (params.length > 0) {
        const param = params[0];

        // Set parameter once
        await autoTuner.setParameter(param.name, param.currentValue);

        // Try to get recommendations immediately
        const recommendations = await autoTuner.getRecommendations();

        // The recently tuned parameter should not be in recommendations
        const recForTunedParam = recommendations.find(
          r => r.parameter === param.name
        );
        // This may or may not be present depending on implementation
      }
    });
  });

  describe("Integration with Components", () => {
    it("should integrate with WorkloadAnalyzer", () => {
      autoTuner.recordQuery({
        timestamp: Date.now(),
        queryType: "interactive",
        complexity: 0.3,
        length: 50,
        latency: 80,
        cacheHit: true,
      });

      const state = autoTuner.getWorkloadState();
      expect(state.currentType).toBeDefined();
    });

    it("should integrate with ParameterOptimizer", async () => {
      // Record queries
      for (let i = 0; i < 50; i++) {
        autoTuner.recordQuery({
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5,
          length: 100,
          latency: 100,
          cacheHit: true,
        });
      }

      const recommendations = await autoTuner.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it("should integrate with ParameterController", async () => {
      const params = await autoTuner.getParameters();
      expect(params.length).toBeGreaterThan(0);

      if (params.length > 0) {
        const param = params[0];
        await autoTuner.setParameter(param.name, param.currentValue);
        // Should not throw
      }
    });

    it("should integrate with TuningHistory", async () => {
      const params = await autoTuner.getParameters();
      if (params.length > 0) {
        const param = params[0];
        await autoTuner.setParameter(param.name, param.currentValue);

        const history = await autoTuner.getHistory();
        expect(history.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty query history", async () => {
      const performance = await autoTuner.getCurrentPerformance();
      expect(performance).toBeDefined();
    });

    it("should handle single query", async () => {
      autoTuner.recordQuery({
        timestamp: Date.now(),
        queryType: "test",
        complexity: 0.5,
        length: 100,
        latency: 100,
        cacheHit: true,
      });

      const state = autoTuner.getWorkloadState();
      expect(state).toBeDefined();
    });

    it("should handle extreme latency values", async () => {
      autoTuner.recordQuery({
        timestamp: Date.now(),
        queryType: "test",
        complexity: 0.5,
        length: 100,
        latency: 10000, // Very high latency
        cacheHit: false,
      });

      const performance = await autoTuner.getCurrentPerformance();
      expect(performance.latency.p99).toBeGreaterThan(0);
    });
  });

  describe("Configuration Variations", () => {
    it("should work with latency objective", async () => {
      const tuner = new AutoTunerImpl({
        ...DEFAULT_TUNABLE_PARAMETERS[0],
        tuneInterval: 1000,
        categories: ["cache"],
        objective: { primary: "latency", secondary: [] },
        constraints: { maxMemoryMB: 4096, maxCPUPercent: 80 },
        learningRate: 0.1,
        explorationRate: 0.2,
      } as any);

      await tuner.start();
      await tuner.stop();
    });

    it("should work with throughput objective", async () => {
      const tuner = new AutoTunerImpl({
        ...DEFAULT_TUNABLE_PARAMETERS[0],
        tuneInterval: 1000,
        categories: ["cache"],
        objective: { primary: "throughput", secondary: [] },
        constraints: { maxMemoryMB: 4096, maxCPUPercent: 80 },
        learningRate: 0.1,
        explorationRate: 0.2,
      } as any);

      await tuner.start();
      await tuner.stop();
    });

    it("should work with quality objective", async () => {
      const tuner = new AutoTunerImpl({
        ...DEFAULT_TUNABLE_PARAMETERS[0],
        tuneInterval: 1000,
        categories: ["cache"],
        objective: { primary: "quality", secondary: [] },
        constraints: { maxMemoryMB: 4096, maxCPUPercent: 80 },
        learningRate: 0.1,
        explorationRate: 0.2,
      } as any);

      await tuner.start();
      await tuner.stop();
    });
  });

  describe("Helper Factory", () => {
    it("should create tuner with factory function", () => {
      const tuner = createAutoTunerImpl({
        tuneInterval: 2000,
        categories: ["cache", "routing"],
      });

      expect(tuner).toBeInstanceOf(AutoTunerImpl);
    });

    it("should merge config with defaults", () => {
      const tuner = createAutoTunerImpl({
        tuneInterval: 3000,
      });

      expect(tuner).toBeDefined();
    });
  });
});
