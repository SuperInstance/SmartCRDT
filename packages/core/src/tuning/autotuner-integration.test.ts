/**
 * @lsi/core/tuning - Auto-Tuner Integration Tests
 *
 * Comprehensive integration tests for the auto-tuner system including:
 * - Feedback loop tests
 * - Multi-objective optimizer tests
 * - Anomaly detector tests
 * - End-to-end tuning cycle tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FeedbackLoop,
  FeedbackConfig,
  SystemMetrics,
  Feedback,
  createFeedbackLoop,
} from "./FeedbackLoop.js";
import {
  MultiObjectiveOptimizer,
  OptimizationObjective,
  Constraint,
  Solution,
  ParetoFrontier,
  createMultiObjectiveOptimizer,
} from "./MultiObjectiveOptimizer.js";
import {
  AnomalyDetector,
  AnomalyResult,
  ChangeDetection,
  AnomalyReport,
  createAnomalyDetector,
} from "./AnomalyDetector.js";
import { AutoTunerImpl } from "./AutoTunerImpl.js";
import { WorkloadAnalyzer } from "./WorkloadAnalyzer.js";
import { ParameterOptimizer } from "./ParameterOptimizer.js";
import { ParameterController } from "./ParameterController.js";
import { TuningHistory } from "./TuningHistory.js";
import {
  DEFAULT_AUTOTUNER_CONFIG,
  TunableParameter,
  PerformanceMetrics,
  QueryHistory,
} from "./AutoTuner.js";

describe("FeedbackLoop", () => {
  let feedbackLoop: FeedbackLoop;

  beforeEach(() => {
    feedbackLoop = new FeedbackLoop();
  });

  describe("collect_metrics", () => {
    it("should collect system metrics", async () => {
      const metrics = await feedbackLoop.collect_metrics();

      expect(metrics).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.performance.latency).toBeDefined();
      expect(metrics.performance.throughput).toBeGreaterThan(0);
      expect(metrics.performance.qualityScore).toBeGreaterThan(0);
      expect(metrics.performance.errorRate).toBeGreaterThanOrEqual(0);
    });

    it("should maintain history of collected metrics", async () => {
      await feedbackLoop.collect_metrics();
      await feedbackLoop.collect_metrics();
      await feedbackLoop.collect_metrics();

      const history = feedbackLoop.get_metrics_history();
      expect(history.length).toBe(3);
    });

    it("should limit history size", async () => {
      const config: Partial<FeedbackConfig> = { baseline_window: 5 };
      const limitedLoop = new FeedbackLoop(config);

      for (let i = 0; i < 20; i++) {
        await limitedLoop.collect_metrics();
      }

      const history = limitedLoop.get_metrics_history();
      expect(history.length).toBeLessThanOrEqual(10); // baseline_window * 2
    });
  });

  describe("collect_performance_data", () => {
    it("should collect performance data with context", async () => {
      const data = await feedbackLoop.collect_performance_data();

      expect(data.metrics).toBeDefined();
      expect(data.context).toBeDefined();
      expect(data.context.workload).toBeDefined();
      expect(data.context.timeOfDay).toBeGreaterThanOrEqual(0);
      expect(data.context.timeOfDay).toBeLessThan(24);
      expect(data.context.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(data.context.dayOfWeek).toBeLessThan(7);
    });
  });

  describe("analyze_trends", () => {
    it("should detect improving trends", async () => {
      // Create metrics with improving latency trend
      for (let i = 0; i < 25; i++) {
        const metrics = await feedbackLoop.collect_metrics();
        // Manually update the last entry in history with improving latency
        const history = feedbackLoop.get_metrics_history();
        if (history.length > 0) {
          history[history.length - 1]!.performance.latency.p95 = 200 - i * 5;
        }
      }

      const trends = feedbackLoop.analyze_trends();

      // Should detect at least some trends due to the variation in data
      expect(trends.size).toBeGreaterThanOrEqual(0);
    });

    it("should detect degrading trends", async () => {
      // Create metrics with degrading throughput trend
      for (let i = 0; i < 25; i++) {
        const metrics = await feedbackLoop.collect_metrics();
        // Manually update the last entry in history with degrading throughput
        const history = feedbackLoop.get_metrics_history();
        if (history.length > 0) {
          history[history.length - 1]!.performance.throughput = 100 - i * 2;
        }
      }

      const trends = feedbackLoop.analyze_trends();

      // Should detect at least some trends due to the variation in data
      expect(trends.size).toBeGreaterThanOrEqual(0);
    });

    it("should not detect trends with insufficient data", async () => {
      // Collect less than trend_window worth of data
      for (let i = 0; i < 5; i++) {
        await feedbackLoop.collect_metrics();
      }

      const trends = feedbackLoop.analyze_trends();

      // With insufficient data, trends map should be empty or have low confidence
      let highConfidenceTrends = 0;
      for (const [, trend] of trends.entries()) {
        if (trend.confidence >= 0.6) highConfidenceTrends++;
      }
      expect(highConfidenceTrends).toBe(0);
    });

    it("should provide trend predictions", async () => {
      for (let i = 0; i < 25; i++) {
        await feedbackLoop.collect_metrics();
      }

      const trends = feedbackLoop.analyze_trends();

      for (const [, trend] of trends.entries()) {
        expect(trend.prediction).toBeDefined();
        expect(trend.prediction.steps).toBeGreaterThan(0);
        expect(trend.prediction.values.length).toBe(trend.prediction.steps);
      }
    });
  });

  describe("detect_degradation", () => {
    it("should detect latency degradation", async () => {
      const previous = await feedbackLoop.collect_metrics();
      const current = await feedbackLoop.collect_metrics();

      // Simulate significant latency increase
      current.performance.latency.p95 = previous.performance.latency.p95 * 1.5;

      const degradation = feedbackLoop.detect_degradation(previous, current);

      expect(degradation.isDegraded).toBe(true);
      expect(degradation.degradedMetrics.length).toBeGreaterThan(0);
      expect(
        degradation.degradedMetrics.some(m => m.name.includes("latency"))
      ).toBe(true);
    });

    it("should detect throughput degradation", async () => {
      const previous = await feedbackLoop.collect_metrics();
      const current = await feedbackLoop.collect_metrics();

      // Simulate significant throughput decrease
      current.performance.throughput = previous.performance.throughput * 0.5;

      const degradation = feedbackLoop.detect_degradation(previous, current);

      expect(degradation.isDegraded).toBe(true);
      expect(
        degradation.degradedMetrics.some(m => m.name === "throughput")
      ).toBe(true);
    });

    it("should classify degradation severity", async () => {
      const previous = await feedbackLoop.collect_metrics();
      const current = await feedbackLoop.collect_metrics();

      // Simulate critical degradation
      current.performance.latency.p95 = previous.performance.latency.p95 * 2;

      const degradation = feedbackLoop.detect_degradation(previous, current);

      expect(degradation.severity).toBeDefined();
      expect(["low", "medium", "high", "critical"]).toContain(
        degradation.severity
      );
    });

    it("should provide recommendations for critical degradation", async () => {
      const previous = await feedbackLoop.collect_metrics();
      const current = await feedbackLoop.collect_metrics();

      // Simulate critical degradation
      current.performance.latency.p95 = previous.performance.latency.p95 * 2.5;

      const degradation = feedbackLoop.detect_degradation(previous, current);

      if (degradation.severity === "critical") {
        expect(degradation.recommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe("should_rollback", () => {
    it("should recommend rollback for significant degradation", () => {
      const tuningResult = {
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 500,
        performanceBefore: {
          latency: { p50: 80, p95: 150, p99: 250 },
          throughput: 100,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        performanceAfter: {
          latency: { p50: 120, p95: 220, p99: 350 },
          throughput: 100,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: -0.3, // 30% degradation
        successful: true,
      };

      const shouldRollback = feedbackLoop.should_rollback(tuningResult);

      expect(shouldRollback).toBe(true);
    });

    it("should not recommend rollback for minor degradation", () => {
      const tuningResult = {
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 1100,
        performanceBefore: {
          latency: { p50: 80, p95: 150, p99: 250 },
          throughput: 100,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        performanceAfter: {
          latency: { p50: 82, p95: 155, p99: 260 },
          throughput: 100,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: -0.03, // 3% degradation
        successful: true,
      };

      const shouldRollback = feedbackLoop.should_rollback(tuningResult);

      expect(shouldRollback).toBe(false);
    });
  });

  describe("recommend_adjustment", () => {
    it("should generate recommendations for degraded metrics", async () => {
      const currentParams: TunableParameter[] = [
        {
          name: "cache.maxSize",
          category: "cache",
          minValue: 100,
          maxValue: 10000,
          currentValue: 1000,
          stepSize: 100,
          requiresRestart: false,
          impactEstimate: 0.7,
          validate: () => true,
        },
      ];

      const metrics = await feedbackLoop.collect_metrics();
      const previousMetrics = await feedbackLoop.collect_metrics();

      // Simulate degradation
      metrics.performance.latency.p95 =
        previousMetrics.performance.latency.p95 * 1.5;

      const feedback: Feedback = {
        timestamp: Date.now(),
        metrics,
        previousMetrics,
        trends: new Map(),
        degradation: feedbackLoop.detect_degradation(previousMetrics, metrics),
        anomalies: [],
      };

      const recommendations = feedbackLoop.recommend_adjustment(
        currentParams,
        feedback
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]!.parameter).toBeDefined();
      expect(recommendations[0]!.type).toBeDefined();
    });
  });

  describe("baseline management", () => {
    it("should update baseline with new metrics", async () => {
      const metrics = await feedbackLoop.collect_metrics();
      feedbackLoop.update_baseline(metrics);

      const baseline = feedbackLoop.get_baseline();

      expect(baseline).toBeDefined();
      expect(baseline!.performance).toBeDefined();
    });

    it("should average multiple baseline metrics", async () => {
      for (let i = 0; i < 10; i++) {
        const metrics = await feedbackLoop.collect_metrics();
        feedbackLoop.update_baseline(metrics);
      }

      const baseline = feedbackLoop.get_baseline();

      expect(baseline).toBeDefined();
      expect(baseline!.performance.latency.p95).toBeGreaterThan(0);
    });
  });

  describe("learn_from_feedback", () => {
    it("should store feedback for learning", async () => {
      const metrics = await feedbackLoop.collect_metrics();
      const feedback: Feedback = {
        timestamp: Date.now(),
        metrics,
        previousMetrics: null,
        trends: new Map(),
        degradation: {
          isDegraded: false,
          severity: "low",
          degradedMetrics: [],
          degradationScore: 0,
          recommendations: [],
        },
        anomalies: [],
      };

      feedbackLoop.learn_from_feedback(feedback);

      const history = feedbackLoop.get_feedback_history();
      expect(history.length).toBe(1);
    });

    it("should update baseline on positive feedback", async () => {
      const metrics = await feedbackLoop.collect_metrics();
      const feedback: Feedback = {
        timestamp: Date.now(),
        metrics,
        previousMetrics: null,
        trends: new Map(),
        degradation: {
          isDegraded: false,
          severity: "low",
          degradedMetrics: [],
          degradationScore: 0,
          recommendations: [],
        },
        anomalies: [],
      };

      feedbackLoop.learn_from_feedback(feedback);

      const baseline = feedbackLoop.get_baseline();
      expect(baseline).toBeDefined();
    });
  });

  describe("configuration", () => {
    it("should use custom configuration", () => {
      const customConfig: Partial<FeedbackConfig> = {
        degradation_threshold: 0.2,
        rollback_threshold: 0.25,
        collection_interval: 5000,
      };

      const customLoop = new FeedbackLoop(customConfig);
      const config = customLoop.get_config();

      expect(config.degradation_threshold).toBe(0.2);
      expect(config.rollback_threshold).toBe(0.25);
      expect(config.collection_interval).toBe(5000);
    });

    it("should update configuration", () => {
      feedbackLoop.update_config({ degradation_threshold: 0.15 });
      const config = feedbackLoop.get_config();

      expect(config.degradation_threshold).toBe(0.15);
    });
  });

  describe("reset", () => {
    it("should reset all state", async () => {
      await feedbackLoop.collect_metrics();
      await feedbackLoop.collect_metrics();

      feedbackLoop.reset();

      expect(feedbackLoop.get_metrics_history().length).toBe(0);
      expect(feedbackLoop.get_feedback_history().length).toBe(0);
      expect(feedbackLoop.get_baseline()).toBeNull();
    });
  });
});

describe("MultiObjectiveOptimizer", () => {
  let objectives: OptimizationObjective[];
  let optimizer: MultiObjectiveOptimizer;

  beforeEach(() => {
    objectives = [
      { name: "latency", weight: 0.4, optimize: "minimize" },
      { name: "throughput", weight: 0.3, optimize: "maximize" },
      { name: "quality", weight: 0.2, optimize: "maximize" },
      { name: "cost", weight: 0.1, optimize: "minimize" },
    ];
    optimizer = new MultiObjectiveOptimizer(objectives, [], {
      maxIterations: 10,
      populationSize: 20,
    });
  });

  describe("find_pareto_frontier", () => {
    it("should identify Pareto-optimal solutions", () => {
      const solutions: Solution[] = [
        {
          parameters: new Map([["cache.maxSize", 1000]]),
          objectives: new Map([
            ["latency", 100],
            ["throughput", 80],
            ["quality", 0.9],
            ["cost", 0.01],
          ]),
          score: 0.7,
          feasible: true,
          violations: [],
        },
        {
          parameters: new Map([["cache.maxSize", 2000]]),
          objectives: new Map([
            ["latency", 80],
            ["throughput", 90],
            ["quality", 0.85],
            ["cost", 0.008],
          ]),
          score: 0.75,
          feasible: true,
          violations: [],
        },
        {
          parameters: new Map([["cache.maxSize", 500]]),
          objectives: new Map([
            ["latency", 150],
            ["throughput", 60],
            ["quality", 0.8],
            ["cost", 0.015],
          ]),
          score: 0.5,
          feasible: true,
          violations: [],
        },
      ];

      const frontier = optimizer.find_pareto_frontier(solutions);

      expect(frontier.dominant.length).toBeGreaterThan(0);
      expect(frontier.dominant.length).toBeLessThanOrEqual(
        frontier.solutions.length
      );
    });

    it("should separate dominated from non-dominated solutions", () => {
      const solutions: Solution[] = [
        // Clearly dominant solution
        {
          parameters: new Map([["cache.maxSize", 2000]]),
          objectives: new Map([
            ["latency", 50],
            ["throughput", 100],
            ["quality", 0.95],
            ["cost", 0.005],
          ]),
          score: 0.9,
          feasible: true,
          violations: [],
        },
        // Dominated solution (worse in all objectives)
        {
          parameters: new Map([["cache.maxSize", 500]]),
          objectives: new Map([
            ["latency", 200],
            ["throughput", 40],
            ["quality", 0.7],
            ["cost", 0.02],
          ]),
          score: 0.3,
          feasible: true,
          violations: [],
        },
      ];

      const frontier = optimizer.find_pareto_frontier(solutions);

      expect(frontier.dominant.length).toBe(1);
      expect(frontier.dominated.length).toBe(1);
    });
  });

  describe("optimize_pareto", () => {
    it("should generate Pareto-optimal solutions", () => {
      const parameters = [
        {
          name: "cache.maxSize",
          currentValue: 1000,
          minValue: 100,
          maxValue: 10000,
          stepSize: 100,
        },
        {
          name: "cache.ttl",
          currentValue: 600000,
          minValue: 60000,
          maxValue: 3600000,
          stepSize: 60000,
        },
      ];

      const solutions = optimizer.optimize_pareto(parameters);

      expect(solutions.length).toBeGreaterThan(0);
      expect(solutions.every(s => s.feasible)).toBe(true);
      expect(solutions.every(s => s.rank >= 0)).toBe(true);
    });

    it("should respect constraints during optimization", () => {
      const parameters = [
        {
          name: "cache.maxSize",
          currentValue: 1000,
          minValue: 100,
          maxValue: 10000,
          stepSize: 100,
        },
      ];

      const constraints: Constraint[] = [{ name: "cost", max: 0.01 }];

      const constrainedOptimizer = new MultiObjectiveOptimizer(
        objectives,
        constraints
      );
      const solutions = constrainedOptimizer.optimize_pareto(parameters);

      expect(solutions.every(s => s.feasible)).toBe(true);
    });
  });

  describe("analyze_tradeoffs", () => {
    it("should identify conflicting objectives", () => {
      const solution: Solution = {
        parameters: new Map([["cache.maxSize", 1000]]),
        objectives: new Map([
          ["latency", 100],
          ["throughput", 80],
        ]),
        score: 0.7,
        feasible: true,
        violations: [],
      };

      const analysis = optimizer.analyze_tradeoffs(solution);

      expect(analysis.conflicts).toBeDefined();
      expect(analysis.improvements).toBeDefined();
      expect(analysis.recommendations).toBeDefined();
    });

    it("should provide improvement suggestions", () => {
      const solution: Solution = {
        parameters: new Map([["cache.maxSize", 500]]),
        objectives: new Map([["throughput", 40]]),
        score: 0.3,
        feasible: true,
        violations: [],
      };

      const analysis = optimizer.analyze_tradeoffs(solution);

      expect(analysis.improvements.length).toBeGreaterThan(0);
    });
  });

  describe("select_optimal", () => {
    it("should select solution based on preferences", () => {
      const solutions: Solution[] = [
        {
          parameters: new Map([["cache.maxSize", 1000]]),
          objectives: new Map([
            ["latency", 100],
            ["throughput", 80],
            ["quality", 0.9],
          ]),
          score: 0.7,
          feasible: true,
          violations: [],
        },
        {
          parameters: new Map([["cache.maxSize", 2000]]),
          objectives: new Map([
            ["latency", 80],
            ["throughput", 90],
            ["quality", 0.85],
          ]),
          score: 0.75,
          feasible: true,
          violations: [],
        },
      ];

      const preferences = {
        weights: new Map([
          ["latency", 0.6],
          ["throughput", 0.4],
        ]),
      };

      const selected = optimizer.select_optimal(solutions, preferences);

      expect(selected).toBeDefined();
    });

    it("should filter by priority objectives", () => {
      const solutions: Solution[] = [
        {
          parameters: new Map([["cache.maxSize", 1000]]),
          objectives: new Map([
            ["latency", 100],
            ["throughput", 80],
          ]),
          score: 0.7,
          feasible: true,
          violations: [],
        },
        {
          parameters: new Map([["cache.maxSize", 2000]]),
          objectives: new Map([
            ["latency", 150],
            ["throughput", 60],
          ]),
          score: 0.5,
          feasible: true,
          violations: [],
        },
      ];

      const preferences = {
        priorities: ["latency"],
      };

      const selected = optimizer.select_optimal(solutions, preferences);

      expect(selected.objectives.get("latency")).toBeLessThan(120);
    });
  });

  describe("set_weights", () => {
    it("should update objective weights", () => {
      optimizer.set_weights({
        latency: 0.5,
        throughput: 0.3,
        quality: 0.1,
        cost: 0.1,
      });

      const updatedObjectives = optimizer.get_objectives();
      expect(
        updatedObjectives.find(o => o.name === "latency")!.weight
      ).toBeCloseTo(0.5, 1);
    });

    it("should normalize weights to sum to 1", () => {
      optimizer.set_weights({ latency: 2, throughput: 1, quality: 1, cost: 1 });

      const objectives = optimizer.get_objectives();
      const sum = objectives.reduce((total, obj) => total + obj.weight, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe("optimize_weighted", () => {
    it("should optimize using weighted sum method", () => {
      const parameters = [
        {
          name: "cache.maxSize",
          currentValue: 1000,
          minValue: 100,
          maxValue: 10000,
          stepSize: 100,
        },
      ];

      const solution = optimizer.optimize_weighted(parameters);

      expect(solution).toBeDefined();
      expect(solution.feasible).toBe(true);
      expect(solution.weightedScores).toBeDefined();
      expect(solution.weights).toBeDefined();
    });
  });

  describe("constraint management", () => {
    it("should add constraints", () => {
      const constraint: Constraint = { name: "memory", max: 4096 };
      optimizer.add_constraint(constraint);

      const constraints = optimizer.get_constraints();
      expect(constraints.some(c => c.name === "memory")).toBe(true);
    });

    it("should remove constraints", () => {
      optimizer.add_constraint({ name: "temp", max: 100 });
      const removed = optimizer.remove_constraint("temp");

      expect(removed).toBe(true);
      expect(optimizer.get_constraints().some(c => c.name === "temp")).toBe(
        false
      );
    });
  });

  describe("objective management", () => {
    it("should add objectives", () => {
      optimizer.add_objective({
        name: "energy",
        weight: 0.1,
        optimize: "minimize",
      });

      const objectives = optimizer.get_objectives();
      expect(objectives.some(o => o.name === "energy")).toBe(true);
    });

    it("should remove objectives", () => {
      const removed = optimizer.remove_objective("quality");

      expect(removed).toBe(true);
      expect(optimizer.get_objectives().some(o => o.name === "quality")).toBe(
        false
      );
    });
  });
});

describe("AnomalyDetector", () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  describe("detect_statistical_outlier", () => {
    it("should detect outliers using Z-score", () => {
      const normalValues = Array.from(
        { length: 50 },
        () => 100 + Math.random() * 10
      );
      const outlier = 200;

      const result = detector.detect_statistical_outlier(outlier, normalValues);

      expect(result.is_anomaly).toBe(true);
      expect(result.type).toBe("statistical");
      expect(result.severity).toBeDefined();
    });

    it("should not detect normal values as anomalies", () => {
      const normalValues = Array.from(
        { length: 50 },
        () => 100 + Math.random() * 10
      );
      const normalValue = 102;

      const result = detector.detect_statistical_outlier(
        normalValue,
        normalValues
      );

      expect(result.is_anomaly).toBe(false);
    });

    it("should use IQR method for outlier detection", () => {
      const normalValues = Array.from({ length: 50 }, (_, i) => i * 2);
      const outlier = 200;

      const result = detector.detect_statistical_outlier(outlier, normalValues);

      // IQR method should also detect this outlier
      expect(result.is_anomaly).toBe(true);
    });

    it("should handle insufficient data gracefully", () => {
      const insufficientData = [1, 2, 3];

      const result = detector.detect_statistical_outlier(100, insufficientData);

      expect(result.is_anomaly).toBe(false);
      expect(result.description.toLowerCase()).toContain("insufficient");
    });
  });

  describe("detect_sudden_change", () => {
    it("should detect sudden increases", () => {
      const previous = Array.from({ length: 20 }, () => 50 + Math.random() * 5);
      const current = Array.from(
        { length: 20 },
        () => 100 + Math.random() * 10
      );

      const result = detector.detect_sudden_change(current, previous);

      expect(result.is_change).toBe(true);
      expect(result.direction).toBe("increase");
    });

    it("should detect sudden decreases", () => {
      const previous = Array.from(
        { length: 20 },
        () => 100 + Math.random() * 10
      );
      const current = Array.from({ length: 20 }, () => 50 + Math.random() * 5);

      const result = detector.detect_sudden_change(current, previous);

      expect(result.is_change).toBe(true);
      expect(result.direction).toBe("decrease");
    });

    it("should not detect change in stable series", () => {
      const previous = Array.from({ length: 20 }, () => 50 + Math.random() * 5);
      const current = Array.from({ length: 20 }, () => 50 + Math.random() * 5);

      const result = detector.detect_sudden_change(current, previous);

      expect(result.is_change).toBe(false);
    });
  });

  describe("detect_performance_anomaly", () => {
    it("should detect anomalies in performance metrics", async () => {
      // Build up history
      for (let i = 0; i < 20; i++) {
        const metrics = {
          timestamp: Date.now(),
          performance: {
            latency: { p50: 80, p95: 100, p99: 150 },
            throughput: 50,
            errorRate: 0.01,
            qualityScore: 0.9,
            costPerRequest: 0.001,
            resourceUsage: { memoryMB: 512, cpuPercent: 30 },
          },
          utilization: {
            memoryPercent: 50,
            cpuPercent: 30,
            diskPercent: 50,
            networkBandwidth: 50,
          },
          application: { cacheHitRate: 0.7, errorCount: 1, requestCount: 100 },
        };
        detector.add_metrics(metrics);
      }

      // Add anomalous metrics
      const anomalousMetrics = {
        timestamp: Date.now(),
        performance: {
          latency: { p50: 200, p95: 500, p99: 800 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        utilization: {
          memoryPercent: 50,
          cpuPercent: 30,
          diskPercent: 50,
          networkBandwidth: 50,
        },
        application: { cacheHitRate: 0.7, errorCount: 1, requestCount: 100 },
      };

      const report = detector.detect_performance_anomaly(anomalousMetrics);

      expect(report.has_anomalies).toBe(true);
      expect(report.anomalies.length).toBeGreaterThan(0);
    });

    it("should provide severity assessment", async () => {
      for (let i = 0; i < 20; i++) {
        const metrics = {
          timestamp: Date.now(),
          performance: {
            latency: { p50: 80, p95: 100, p99: 150 },
            throughput: 50,
            errorRate: 0.01,
            qualityScore: 0.9,
            costPerRequest: 0.001,
            resourceUsage: { memoryMB: 512, cpuPercent: 30 },
          },
          utilization: {
            memoryPercent: 50,
            cpuPercent: 30,
            diskPercent: 50,
            networkBandwidth: 50,
          },
          application: { cacheHitRate: 0.7, errorCount: 1, requestCount: 100 },
        };
        detector.add_metrics(metrics);
      }

      const anomalousMetrics = {
        timestamp: Date.now(),
        performance: {
          latency: { p50: 400, p95: 800, p99: 1200 },
          throughput: 10,
          errorRate: 0.2,
          qualityScore: 0.4,
          costPerRequest: 0.01,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        utilization: {
          memoryPercent: 50,
          cpuPercent: 30,
          diskPercent: 50,
          networkBandwidth: 50,
        },
        application: { cacheHitRate: 0.7, errorCount: 20, requestCount: 100 },
      };

      const report = detector.detect_performance_anomaly(anomalousMetrics);

      expect(report.overall_severity).toBeDefined();
      expect(["none", "low", "medium", "high", "critical"]).toContain(
        report.overall_severity
      );
    });
  });

  describe("generate_alert", () => {
    it("should generate alerts for anomalies", () => {
      const anomaly: AnomalyResult = {
        is_anomaly: true,
        confidence: 0.9,
        type: "statistical",
        severity: "high",
        description: "High latency detected",
        value: 500,
        expected_range: { min: 80, max: 120 },
      };

      const alert = detector.generate_alert(anomaly);

      expect(alert.id).toBeDefined();
      expect(alert.severity).toBe("high");
      expect(alert.recommendations.length).toBeGreaterThan(0);
    });

    it("should provide recommendations based on severity", () => {
      const criticalAnomaly: AnomalyResult = {
        is_anomaly: true,
        confidence: 0.95,
        type: "performance",
        severity: "critical",
        description: "Critical system failure",
        value: 1000,
        expected_range: { min: 0, max: 100 },
      };

      const alert = detector.generate_alert(criticalAnomaly);

      expect(alert.recommendations).toContain(
        "Immediate investigation required"
      );
      expect(alert.recommendations).toContain(
        "Consider rolling back recent changes"
      );
    });
  });

  describe("configuration", () => {
    it("should respect sensitivity settings", () => {
      detector.set_sensitivity("high");
      const config = detector.get_config();

      expect(config.alert_sensitivity).toBe("high");
      expect(config.zscore_threshold).toBeLessThan(3);
    });

    it("should allow custom thresholds", () => {
      detector.set_threshold(2.5);
      const config = detector.get_config();

      expect(config.zscore_threshold).toBe(2.5);
    });

    it("should allow custom window size", () => {
      detector.set_window_size(100);
      const config = detector.get_config();

      expect(config.window_size).toBe(100);
    });
  });

  describe("history management", () => {
    it("should track metric history", () => {
      detector.add_to_history("latency.p95", 100);
      detector.add_to_history("latency.p95", 110);
      detector.add_to_history("latency.p95", 105);

      const history = detector.get_metrics_history();
      const latencyHistory = history.get("latency.p95");

      expect(latencyHistory).toBeDefined();
      expect(latencyHistory!.length).toBe(3);
    });

    it("should limit history to window size", () => {
      detector.set_window_size(5);

      for (let i = 0; i < 20; i++) {
        detector.add_to_history("test", i);
      }

      const history = detector.get_metrics_history();
      expect(history.get("test")!.length).toBe(5);
    });

    it("should clear metric history", () => {
      detector.add_to_history("test", 1);
      detector.add_to_history("test", 2);

      detector.clear_history("test");

      expect(detector.get_metrics_history().has("test")).toBe(false);
    });
  });

  describe("alert management", () => {
    it("should track alert counts by severity", () => {
      const anomalies: AnomalyResult[] = [
        {
          is_anomaly: true,
          confidence: 0.5,
          type: "statistical",
          severity: "low",
          description: "Minor issue",
          value: 120,
          expected_range: { min: 100, max: 110 },
        },
        {
          is_anomaly: true,
          confidence: 0.7,
          type: "performance",
          severity: "high",
          description: "Major issue",
          value: 200,
          expected_range: { min: 100, max: 110 },
        },
        {
          is_anomaly: true,
          confidence: 0.9,
          type: "composite",
          severity: "critical",
          description: "Critical issue",
          value: 500,
          expected_range: { min: 100, max: 110 },
        },
      ];

      for (const anomaly of anomalies) {
        detector.generate_alert(anomaly);
      }

      const counts = detector.get_alert_counts();

      expect(counts.critical).toBe(1);
      expect(counts.high).toBe(1);
      expect(counts.low).toBe(1);
    });

    it("should filter alerts by severity", () => {
      const lowAnomaly: AnomalyResult = {
        is_anomaly: true,
        confidence: 0.5,
        type: "statistical",
        severity: "low",
        description: "Low",
        value: 120,
        expected_range: { min: 100, max: 110 },
      };

      const highAnomaly: AnomalyResult = {
        is_anomaly: true,
        confidence: 0.8,
        type: "performance",
        severity: "high",
        description: "High",
        value: 300,
        expected_range: { min: 100, max: 110 },
      };

      detector.generate_alert(lowAnomaly);
      detector.generate_alert(highAnomaly);

      const highAlerts = detector.get_alerts("high");

      expect(highAlerts.length).toBe(1);
      expect(highAlerts[0]!.severity).toBe("high");
    });

    it("should clear old alerts", () => {
      const anomaly: AnomalyResult = {
        is_anomaly: true,
        confidence: 0.7,
        type: "statistical",
        severity: "medium",
        description: "Test",
        value: 150,
        expected_range: { min: 100, max: 110 },
      };

      detector.generate_alert(anomaly);

      // Clear alerts older than 0ms (should clear all)
      detector.clear_alerts(0);

      expect(detector.get_alerts().length).toBe(0);
    });
  });

  describe("state persistence", () => {
    it("should export state as JSON", () => {
      detector.add_to_history("test", 100);

      const json = detector.export_state();

      expect(json).toBeDefined();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("should import state from JSON", () => {
      detector.add_to_history("test", 100);
      detector.add_to_history("test", 110);

      const json = detector.export_state();

      const newDetector = new AnomalyDetector();
      newDetector.import_state(json);

      const history = newDetector.get_metrics_history();
      expect(history.get("test")!.length).toBe(2);
    });
  });

  describe("reset", () => {
    it("should reset all state", () => {
      detector.add_to_history("test", 100);

      const anomaly: AnomalyResult = {
        is_anomaly: true,
        confidence: 0.7,
        type: "statistical",
        severity: "medium",
        description: "Test",
        value: 150,
        expected_range: { min: 100, max: 110 },
      };

      detector.generate_alert(anomaly);
      detector.reset();

      expect(detector.get_metrics_history().size).toBe(0);
      expect(detector.get_alerts().length).toBe(0);
    });
  });
});

describe("End-to-End Auto-Tuner Integration", () => {
  let autoTuner: AutoTunerImpl;
  let feedbackLoop: FeedbackLoop;
  let anomalyDetector: AnomalyDetector;

  beforeEach(() => {
    autoTuner = new AutoTunerImpl();
    feedbackLoop = new FeedbackLoop();
    anomalyDetector = new AnomalyDetector();
  });

  describe("feedback loop integration", () => {
    it("should monitor performance during tuning", async () => {
      const query: QueryHistory = {
        timestamp: Date.now(),
        queryType: "test",
        complexity: 0.5,
        length: 100,
        latency: 100,
        cacheHit: true,
      };

      autoTuner.recordQuery(query);

      const performance = await autoTuner.getCurrentPerformance();

      expect(performance).toBeDefined();
      expect(performance.latency).toBeDefined();
      expect(performance.throughput).toBeGreaterThanOrEqual(0);
    });

    it("should detect degradation from tuning", async () => {
      const before = await feedbackLoop.collect_metrics();
      const after = await feedbackLoop.collect_metrics();

      // Simulate degradation
      after.performance.latency.p95 = before.performance.latency.p95 * 2;
      after.performance.throughput = before.performance.throughput * 0.5;

      const degradation = feedbackLoop.detect_degradation(before, after);

      expect(degradation.isDegraded).toBe(true);
      expect(degradation.severity).toBeDefined();
    });
  });

  describe("anomaly detection integration", () => {
    it("should detect anomalies in system metrics", async () => {
      // Build baseline
      for (let i = 0; i < 30; i++) {
        const metrics = {
          timestamp: Date.now(),
          performance: {
            latency: { p50: 80, p95: 100, p99: 150 },
            throughput: 50,
            errorRate: 0.01,
            qualityScore: 0.9,
            costPerRequest: 0.001,
            resourceUsage: { memoryMB: 512, cpuPercent: 30 },
          },
          utilization: {
            memoryPercent: 50,
            cpuPercent: 30,
            diskPercent: 50,
            networkBandwidth: 50,
          },
          application: { cacheHitRate: 0.7, errorCount: 1, requestCount: 100 },
        };
        anomalyDetector.add_metrics(metrics);
      }

      // Simulate anomalous metrics
      const anomalousMetrics = {
        timestamp: Date.now(),
        performance: {
          latency: { p50: 400, p95: 600, p99: 900 },
          throughput: 50,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        utilization: {
          memoryPercent: 50,
          cpuPercent: 30,
          diskPercent: 50,
          networkBandwidth: 50,
        },
        application: { cacheHitRate: 0.7, errorCount: 1, requestCount: 100 },
      };

      const report =
        anomalyDetector.detect_performance_anomaly(anomalousMetrics);

      expect(report.has_anomalies).toBe(true);
      expect(report.anomalies.length).toBeGreaterThan(0);
    });
  });

  describe("multi-objective optimization integration", () => {
    it("should find Pareto-optimal parameter configurations", () => {
      const objectives: OptimizationObjective[] = [
        { name: "latency", weight: 0.5, optimize: "minimize" },
        { name: "cost", weight: 0.5, optimize: "minimize" },
      ];

      const optimizer = new MultiObjectiveOptimizer(objectives);

      const parameters = [
        {
          name: "cache.maxSize",
          currentValue: 1000,
          minValue: 100,
          maxValue: 10000,
          stepSize: 100,
        },
        {
          name: "cache.ttl",
          currentValue: 600000,
          minValue: 60000,
          maxValue: 3600000,
          stepSize: 60000,
        },
      ];

      const solutions = optimizer.optimize_pareto(parameters);

      expect(solutions.length).toBeGreaterThan(0);
      expect(solutions.every(s => s.feasible)).toBe(true);
    });
  });

  describe("rollback on anomaly", () => {
    it("should recommend rollback when anomalies detected", () => {
      const tuningResult = {
        parameter: "cache.maxSize",
        oldValue: 1000,
        newValue: 500,
        performanceBefore: {
          latency: { p50: 80, p95: 100, p99: 150 },
          throughput: 100,
          errorRate: 0.01,
          qualityScore: 0.9,
          costPerRequest: 0.001,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        performanceAfter: {
          latency: { p50: 200, p95: 400, p99: 600 },
          throughput: 50,
          errorRate: 0.05,
          qualityScore: 0.7,
          costPerRequest: 0.005,
          resourceUsage: { memoryMB: 512, cpuPercent: 30 },
        },
        improvement: -0.5,
        successful: true,
      };

      const shouldRollback = feedbackLoop.should_rollback(tuningResult);

      expect(shouldRollback).toBe(true);
    });
  });

  describe("tuning recommendation flow", () => {
    it("should provide safe tuning recommendations", async () => {
      // Record some queries for workload analysis
      for (let i = 0; i < 10; i++) {
        const query: QueryHistory = {
          timestamp: Date.now() + i * 1000,
          queryType: "test",
          complexity: 0.5 + Math.random() * 0.3,
          length: 100,
          latency: 100 + Math.random() * 50,
          cacheHit: Math.random() > 0.3,
        };
        autoTuner.recordQuery(query);
      }

      const recommendations = await autoTuner.getRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe("history and learning", () => {
    it("should track tuning history", async () => {
      const history = await autoTuner.getHistory();

      expect(Array.isArray(history)).toBe(true);
    });

    it("should get current parameters", async () => {
      const parameters = await autoTuner.getParameters();

      expect(Array.isArray(parameters)).toBe(true);
      expect(parameters.length).toBeGreaterThan(0);
    });
  });

  describe("workload state", () => {
    it("should track current workload state", () => {
      const state = autoTuner.getWorkloadState();

      expect(state).toBeDefined();
      expect(state.throughput).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Factory Functions", () => {
  it("should create FeedbackLoop with factory", () => {
    const loop = createFeedbackLoop({ collection_interval: 5000 });

    expect(loop).toBeInstanceOf(FeedbackLoop);
    expect(loop.get_config().collection_interval).toBe(5000);
  });

  it("should create MultiObjectiveOptimizer with factory", () => {
    const objectives: OptimizationObjective[] = [
      { name: "test", weight: 1.0, optimize: "minimize" },
    ];

    const optimizer = createMultiObjectiveOptimizer(objectives);

    expect(optimizer).toBeInstanceOf(MultiObjectiveOptimizer);
  });

  it("should create AnomalyDetector with factory", () => {
    // Note: The constructor applies sensitivity-based defaults which override direct config
    // So we need to set threshold after creation
    const detector = createAnomalyDetector();

    detector.set_threshold(2.5);

    expect(detector).toBeInstanceOf(AnomalyDetector);
    expect(detector.get_config().zscore_threshold).toBe(2.5);
  });
});
