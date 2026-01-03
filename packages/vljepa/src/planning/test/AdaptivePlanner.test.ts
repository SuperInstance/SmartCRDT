/**
 * @lsi/vljepa/planning/test/AdaptivePlanner.test.ts
 * Comprehensive tests for AdaptivePlanner (35+ tests)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AdaptivePlanner,
  createAdaptivePlanner,
  DEFAULT_ADAPTIVE_CONFIG,
} from "../AdaptivePlanner.js";
import type {
  ExecutionResult,
  PlanningHistory,
  LearningPattern,
  PerformanceMetrics,
} from "../AdaptivePlanner.js";
import type { ActionSequence } from "../ActionSequenceGenerator.js";
import type { EmbeddingDelta } from "../EmbeddingDeltaCalculator.js";
import type { VisualState } from "../EmbeddingDeltaCalculator.js";
import { DEFAULT_EMBEDDING_DIM } from "../../index.js";

describe("AdaptivePlanner", () => {
  let planner: AdaptivePlanner;
  let mockDelta: EmbeddingDelta;
  let mockSequence: ActionSequence;

  beforeEach(() => {
    planner = new AdaptivePlanner();

    mockDelta = {
      current: {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        timestamp: Date.now(),
        uiContext: "/test",
      },
      goal: {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        description: "Test goal",
        confidence: 0.9,
      },
      vector: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
      magnitude: 10,
      direction: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.05),
      semanticChanges: [
        {
          type: "style",
          element: "#btn",
          description: "Style change",
          confidence: 0.9,
          magnitude: 0.5,
          difficulty: 0.3,
          relatedDimensions: [],
        },
      ],
      complexity: 0.5,
      estimatedActions: 2,
      estimatedTime: 500,
      confidence: 0.85,
    };

    const mockAction = {
      id: "action-1",
      type: "modify" as const,
      target: "#btn",
      params: { color: "red" },
      preconditions: [],
      postconditions: [],
      confidence: 0.9,
      estimatedDuration: 100,
      reasoning: "Test",
      dependencies: [],
      reversible: true,
    };

    mockSequence = {
      version: "1.0",
      actions: [mockAction],
      totalEstimatedTime: 100,
      confidence: 0.9,
      reasoning: "Test sequence",
      alternatives: [],
      metadata: {
        timestamp: Date.now(),
        actionCount: 1,
        primaryChangeType: "style",
        complexity: 0.5,
        risk: "low",
      },
    };
  });

  describe("Construction", () => {
    it("should create instance with default config", () => {
      expect(planner).toBeInstanceOf(AdaptivePlanner);
    });

    it("should create instance with custom config", () => {
      const customPlanner = new AdaptivePlanner({
        feedbackWeight: 0.8,
        explorationRate: 0.1,
      });
      expect(customPlanner).toBeInstanceOf(AdaptivePlanner);
      expect(customPlanner.getConfig().feedbackWeight).toBe(0.8);
    });

    it("should initialize empty history", () => {
      const history = planner.getHistory();
      expect(history.plans).toHaveLength(0);
      expect(history.results).toHaveLength(0);
    });

    it("should initialize empty patterns", () => {
      expect(planner.getPatterns()).toHaveLength(0);
    });
  });

  describe("generateWithLearning()", () => {
    it("should generate plan", async () => {
      const generatePlan = async () => mockSequence;
      const plan = await planner.generateWithLearning(mockDelta, generatePlan);
      expect(plan).toBeDefined();
    });

    it("should add plan to history", async () => {
      const generatePlan = async () => mockSequence;
      await planner.generateWithLearning(mockDelta, generatePlan);
      expect(planner.getHistory().plans.length).toBeGreaterThan(0);
    });

    it("should return plan with expected structure", async () => {
      const generatePlan = async () => mockSequence;
      const plan = await planner.generateWithLearning(mockDelta, generatePlan);
      expect(plan.version).toBe("1.0");
      expect(plan.actions).toBeDefined();
      expect(plan.confidence).toBeDefined();
    });

    it("should handle learning disabled", async () => {
      const noLearningPlanner = new AdaptivePlanner({ learningEnabled: false });
      const generatePlan = async () => mockSequence;
      const plan = await noLearningPlanner.generateWithLearning(
        mockDelta,
        generatePlan
      );
      expect(plan).toBeDefined();
    });
  });

  describe("recordResult()", () => {
    it("should record execution result", async () => {
      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.3),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0.8,
        userFeedback: "approved",
        timestamp: Date.now(),
        executionDuration: 200,
        successfulActions: ["action-1"],
        failedActions: [],
        errors: [],
      };

      await planner.recordResult(result);
      const history = planner.getHistory();
      expect(history.results).toHaveLength(1);
    });

    it("should update metrics on approval", async () => {
      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.3),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0.9,
        userFeedback: "approved",
        timestamp: Date.now(),
        executionDuration: 200,
        successfulActions: ["action-1"],
        failedActions: [],
        errors: [],
      };

      await planner.recordResult(result);
      const history = planner.getHistory();
      expect(history.totalApprovals).toBe(1);
      expect(history.successRate).toBe(1);
    });

    it("should update metrics on rejection", async () => {
      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.3),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0.3,
        userFeedback: "rejected",
        timestamp: Date.now(),
        executionDuration: 200,
        successfulActions: [],
        failedActions: ["action-1"],
        errors: ["Failed to execute"],
      };

      await planner.recordResult(result);
      const history = planner.getHistory();
      expect(history.totalRejections).toBe(1);
    });

    it("should update metrics on modification", async () => {
      const modifiedAction = {
        ...mockSequence.actions[0],
        params: { color: "blue" },
      };

      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.3),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0.7,
        userFeedback: "modified",
        timestamp: Date.now(),
        executionDuration: 200,
        successfulActions: ["action-1"],
        failedActions: [],
        errors: [],
        modifiedActions: [
          {
            originalAction: mockSequence.actions[0],
            modifiedAction,
            reason: "User preferred blue",
          },
        ],
      };

      await planner.recordResult(result);
      const history = planner.getHistory();
      expect(history.results).toHaveLength(1);
    });

    it("should trim history when exceeding max size", async () => {
      const smallHistoryPlanner = new AdaptivePlanner({ maxHistorySize: 5 });

      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.3),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0.8,
        userFeedback: "approved",
        timestamp: Date.now(),
        executionDuration: 200,
        successfulActions: ["action-1"],
        failedActions: [],
        errors: [],
      };

      for (let i = 0; i < 10; i++) {
        await smallHistoryPlanner.recordResult(result);
      }

      expect(
        smallHistoryPlanner.getHistory().results.length
      ).toBeLessThanOrEqual(5);
    });
  });

  describe("generateAlternatives()", () => {
    it("should generate single plan when A/B testing disabled", async () => {
      const noABPlanner = new AdaptivePlanner({ useABTesting: false });
      const generatePlan = async () => mockSequence;

      const alternatives = await noABPlanner.generateAlternatives(
        mockDelta,
        generatePlan
      );
      expect(alternatives).toHaveLength(1);
    });

    it("should generate multiple plans when A/B testing enabled", async () => {
      const generatePlan = async (
        delta: EmbeddingDelta,
        variation: number
      ) => ({
        ...mockSequence,
        metadata: {
          ...mockSequence.metadata,
          actionCount: variation + 1,
        },
      });

      const alternatives = await planner.generateAlternatives(
        mockDelta,
        generatePlan
      );
      expect(alternatives.length).toBeGreaterThan(1);
      expect(alternatives.length).toBeLessThanOrEqual(
        planner.getConfig().abTestCount + 1
      );
    });
  });

  describe("selectBestPlan()", () => {
    it("should return the only plan if only one", () => {
      const best = planner.selectBestPlan([mockSequence]);
      expect(best).toBe(mockSequence);
    });

    it("should score and rank multiple plans", () => {
      const highRiskSequence = {
        ...mockSequence,
        metadata: {
          ...mockSequence.metadata,
          risk: "high" as const,
        },
      };

      const lowRiskSequence = {
        ...mockSequence,
        metadata: {
          ...mockSequence.metadata,
          risk: "low" as const,
        },
      };

      const best = planner.selectBestPlan([highRiskSequence, lowRiskSequence]);
      expect(best).toBeDefined();
    });

    it("should add exploration randomness", () => {
      const plans = [mockSequence, { ...mockSequence, confidence: 0.95 }];
      const best1 = planner.selectBestPlan(plans);
      const best2 = planner.selectBestPlan(plans);
      // With randomness, might get different results
      expect(best1).toBeDefined();
      expect(best2).toBeDefined();
    });
  });

  describe("Performance Metrics", () => {
    it("should return zero metrics with no history", () => {
      const metrics = planner.getPerformanceMetrics();
      expect(metrics.generationTime).toBe(0);
      expect(metrics.executionTime).toBe(0);
      expect(metrics.achievementRate).toBe(0);
      expect(metrics.satisfactionRate).toBe(0);
    });

    it("should calculate metrics from history", async () => {
      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.3),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0.85,
        userFeedback: "approved",
        timestamp: Date.now(),
        executionDuration: 300,
        successfulActions: ["action-1"],
        failedActions: [],
        errors: [],
      };

      await planner.recordResult(result);
      const metrics = planner.getPerformanceMetrics();
      expect(metrics.executionTime).toBe(300);
      expect(metrics.achievementRate).toBe(0.85);
      expect(metrics.satisfactionRate).toBe(1);
    });

    it("should calculate action success rate", async () => {
      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.3),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0.8,
        userFeedback: "approved",
        timestamp: Date.now(),
        executionDuration: 200,
        successfulActions: ["action-1"],
        failedActions: [],
        errors: [],
      };

      await planner.recordResult(result);
      const metrics = planner.getPerformanceMetrics();
      expect(metrics.actionSuccessRate).toBe(1);
    });
  });

  describe("History Management", () => {
    it("should get history", () => {
      const history = planner.getHistory();
      expect(history).toBeDefined();
      expect(history.plans).toBeDefined();
      expect(history.results).toBeDefined();
      expect(history.successRate).toBeDefined();
      expect(history.averageAccuracy).toBeDefined();
    });

    it("should clear history", async () => {
      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.3),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0.8,
        userFeedback: "approved",
        timestamp: Date.now(),
        executionDuration: 200,
        successfulActions: ["action-1"],
        failedActions: [],
        errors: [],
      };

      await planner.recordResult(result);
      expect(planner.getHistory().results.length).toBeGreaterThan(0);

      planner.clearHistory();
      expect(planner.getHistory().results.length).toBe(0);
    });

    it("should track learning progress", async () => {
      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.3),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0.9,
        userFeedback: "approved",
        timestamp: Date.now(),
        executionDuration: 200,
        successfulActions: ["action-1"],
        failedActions: [],
        errors: [],
      };

      await planner.recordResult(result);
      const progress = planner.getHistory().learningProgress;
      expect(progress.iterations).toBe(1);
      expect(progress.currentAccuracy).toBeGreaterThan(0);
    });
  });

  describe("Pattern Management", () => {
    it("should start with no patterns", () => {
      expect(planner.getPatterns()).toHaveLength(0);
    });

    it("should clear patterns", async () => {
      // Patterns would be learned from results
      planner.clearPatterns();
      expect(planner.getPatterns()).toHaveLength(0);
    });
  });

  describe("State Export/Import", () => {
    it("should export state", () => {
      const state = planner.exportState();
      expect(state).toBeDefined();
      expect(state.config).toBeDefined();
      expect(state.history).toBeDefined();
      expect(state.patterns).toBeDefined();
    });

    it("should import state", () => {
      const exportedState = planner.exportState();
      const newPlanner = new AdaptivePlanner();
      newPlanner.importState(exportedState);
      expect(newPlanner.getConfig()).toEqual(planner.getConfig());
    });

    it("should import partial state", () => {
      const newPlanner = new AdaptivePlanner();
      newPlanner.importState({
        config: { explorationRate: 0.5 },
      });
      expect(newPlanner.getConfig().explorationRate).toBe(0.5);
    });
  });

  describe("Configuration", () => {
    it("should get current config", () => {
      const config = planner.getConfig();
      expect(config).toBeDefined();
      expect(config.learningEnabled).toBeDefined();
      expect(config.feedbackWeight).toBeDefined();
      expect(config.explorationRate).toBeDefined();
    });

    it("should update config", () => {
      planner.updateConfig({ explorationRate: 0.5 });
      expect(planner.getConfig().explorationRate).toBe(0.5);
    });

    it("should preserve other config values when updating", () => {
      const originalWeight = planner.getConfig().feedbackWeight;
      planner.updateConfig({ explorationRate: 0.5 });
      expect(planner.getConfig().feedbackWeight).toBe(originalWeight);
    });
  });

  describe("Factory Functions", () => {
    it("should create planner with factory", () => {
      const p = createAdaptivePlanner();
      expect(p).toBeInstanceOf(AdaptivePlanner);
    });

    it("should create planner with custom config via factory", () => {
      const p = createAdaptivePlanner({ feedbackWeight: 0.7 });
      expect(p.getConfig().feedbackWeight).toBe(0.7);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero match result", async () => {
      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 0,
        userFeedback: "rejected",
        timestamp: Date.now(),
        executionDuration: 100,
        successfulActions: [],
        failedActions: ["action-1"],
        errors: ["Failed"],
      };

      await planner.recordResult(result);
      const metrics = planner.getPerformanceMetrics();
      expect(metrics.achievementRate).toBe(0);
    });

    it("should handle perfect match result", async () => {
      const result: ExecutionResult = {
        plan: mockSequence,
        actualOutcome: {
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
          timestamp: Date.now(),
          uiContext: "/test",
        },
        match: 1,
        userFeedback: "approved",
        timestamp: Date.now(),
        executionDuration: 150,
        successfulActions: ["action-1"],
        failedActions: [],
        errors: [],
      };

      await planner.recordResult(result);
      const metrics = planner.getPerformanceMetrics();
      expect(metrics.achievementRate).toBe(1);
    });
  });
});

describe("DEFAULT_ADAPTIVE_CONFIG", () => {
  it("should have valid defaults", () => {
    expect(DEFAULT_ADAPTIVE_CONFIG.learningEnabled).toBe(true);
    expect(DEFAULT_ADAPTIVE_CONFIG.feedbackWeight).toBe(0.5);
    expect(DEFAULT_ADAPTIVE_CONFIG.explorationRate).toBe(0.2);
  });

  it("should have reasonable history size limits", () => {
    expect(DEFAULT_ADAPTIVE_CONFIG.minHistorySize).toBe(10);
    expect(DEFAULT_ADAPTIVE_CONFIG.maxHistorySize).toBe(1000);
  });

  it("should have pattern threshold", () => {
    expect(DEFAULT_ADAPTIVE_CONFIG.patternThreshold).toBe(0.7);
  });

  it("should have A/B testing enabled", () => {
    expect(DEFAULT_ADAPTIVE_CONFIG.useABTesting).toBe(true);
  });

  it("should have reasonable A/B test count", () => {
    expect(DEFAULT_ADAPTIVE_CONFIG.abTestCount).toBe(3);
  });
});
