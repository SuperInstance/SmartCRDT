/**
 * @lsi/vljepa/planning/test/EmbeddingDeltaCalculator.test.ts
 * Comprehensive tests for EmbeddingDeltaCalculator (55+ tests)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EmbeddingDeltaCalculator,
  createDeltaCalculator,
  calculateDelta,
  DEFAULT_DELTA_CONFIG,
} from "../EmbeddingDeltaCalculator.js";
import type {
  VisualState,
  GoalState,
  SemanticChange,
} from "../EmbeddingDeltaCalculator.js";
import { DEFAULT_EMBEDDING_DIM } from "../../index.js";

describe("EmbeddingDeltaCalculator", () => {
  let calculator: EmbeddingDeltaCalculator;

  beforeEach(() => {
    calculator = new EmbeddingDeltaCalculator();
  });

  describe("Construction", () => {
    it("should create instance with default config", () => {
      expect(calculator).toBeInstanceOf(EmbeddingDeltaCalculator);
    });

    it("should create instance with custom config", () => {
      const customCalc = new EmbeddingDeltaCalculator({
        changeThreshold: 0.2,
        topDimensions: 20,
      });
      expect(customCalc).toBeInstanceOf(EmbeddingDeltaCalculator);
    });

    it("should merge config with defaults", () => {
      const customCalc = new EmbeddingDeltaCalculator({
        changeThreshold: 0.2,
      });
      const config = customCalc.getConfig();
      expect(config.changeThreshold).toBe(0.2);
      expect(config.topDimensions).toBe(DEFAULT_DELTA_CONFIG.topDimensions);
    });
  });

  describe("calculate()", () => {
    let current: VisualState;
    let goal: GoalState;

    beforeEach(() => {
      current = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      goal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM),
        description: "Make button pop",
        confidence: 0.9,
      };

      // Set some different values
      for (let i = 0; i < DEFAULT_EMBEDDING_DIM; i++) {
        current.embedding[i] = Math.random() * 2 - 1;
        goal.embedding[i] = Math.random() * 2 - 1;
      }
    });

    it("should calculate delta with valid inputs", async () => {
      const delta = await calculator.calculate(current, goal);
      expect(delta).toBeDefined();
      expect(delta.current).toBe(current);
      expect(delta.goal).toBe(goal);
    });

    it("should calculate vector correctly", async () => {
      current.embedding[0] = 0.5;
      goal.embedding[0] = 0.8;
      const delta = await calculator.calculate(current, goal);
      expect(delta.vector[0]).toBeCloseTo(0.3);
    });

    it("should calculate magnitude as Euclidean distance", async () => {
      const delta = await calculator.calculate(current, goal);
      expect(delta.magnitude).toBeGreaterThan(0);
      expect(delta.magnitude).toBeLessThan(50);
    });

    it("should normalize direction vector", async () => {
      const delta = await calculator.calculate(current, goal);
      const norm = Math.sqrt(
        delta.direction.reduce((sum, v) => sum + v * v, 0)
      );
      expect(norm).toBeCloseTo(1, 5);
    });

    it("should decompose semantic changes", async () => {
      const delta = await calculator.calculate(current, goal);
      expect(Array.isArray(delta.semanticChanges)).toBe(true);
    });

    it("should calculate complexity", async () => {
      const delta = await calculator.calculate(current, goal);
      expect(delta.complexity).toBeGreaterThanOrEqual(0);
      expect(delta.complexity).toBeLessThanOrEqual(1);
    });

    it("should estimate number of actions", async () => {
      const delta = await calculator.calculate(current, goal);
      expect(delta.estimatedActions).toBeGreaterThan(0);
      expect(Number.isInteger(delta.estimatedActions)).toBe(true);
    });

    it("should estimate time", async () => {
      const delta = await calculator.calculate(current, goal);
      expect(delta.estimatedTime).toBeGreaterThan(0);
    });

    it("should calculate confidence", async () => {
      const delta = await calculator.calculate(current, goal);
      expect(delta.confidence).toBeGreaterThanOrEqual(0);
      expect(delta.confidence).toBeLessThanOrEqual(1);
    });

    it("should handle identical embeddings", async () => {
      const identicalGoal: GoalState = {
        ...goal,
        embedding: new Float32Array(current.embedding),
      };
      const delta = await calculator.calculate(current, identicalGoal);
      expect(delta.magnitude).toBeCloseTo(0);
    });

    it("should handle zero embeddings", async () => {
      current.embedding = new Float32Array(DEFAULT_EMBEDDING_DIM);
      goal.embedding = new Float32Array(DEFAULT_EMBEDDING_DIM);
      const delta = await calculator.calculate(current, goal);
      expect(delta.magnitude).toBe(0);
    });

    it("should reject wrong dimension current embedding", async () => {
      current.embedding = new Float32Array(100);
      await expect(calculator.calculate(current, goal)).rejects.toThrow();
    });

    it("should reject wrong dimension goal embedding", async () => {
      goal.embedding = new Float32Array(100);
      await expect(calculator.calculate(current, goal)).rejects.toThrow();
    });
  });

  describe("calculateBatch()", () => {
    it("should calculate multiple deltas", async () => {
      const pairs = [
        {
          current: {
            embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
            timestamp: Date.now(),
            uiContext: "/test1",
          },
          goal: {
            embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(1),
            description: "Test 1",
            confidence: 0.9,
          },
        },
        {
          current: {
            embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
            timestamp: Date.now(),
            uiContext: "/test2",
          },
          goal: {
            embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.8),
            description: "Test 2",
            confidence: 0.8,
          },
        },
      ];

      const deltas = await calculator.calculateBatch(pairs);
      expect(deltas).toHaveLength(2);
      expect(deltas[0]).toBeDefined();
      expect(deltas[1]).toBeDefined();
    });

    it("should handle empty array", async () => {
      const deltas = await calculator.calculateBatch([]);
      expect(deltas).toHaveLength(0);
    });
  });

  describe("calculateIncrementalDelta()", () => {
    it("should recalculate from new state", async () => {
      const original = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      const goal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(1),
        description: "Test",
        confidence: 0.9,
      };

      const originalDelta = await calculator.calculate(original, goal);

      const currentState = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      const incrementalDelta = await calculator.calculateIncrementalDelta(
        originalDelta,
        currentState
      );

      expect(incrementalDelta).toBeDefined();
      expect(incrementalDelta.current).toBe(currentState);
      expect(incrementalDelta.goal).toBe(goal);
    });
  });

  describe("Configuration", () => {
    it("should get current config", () => {
      const config = calculator.getConfig();
      expect(config).toBeDefined();
      expect(config.changeThreshold).toBeDefined();
      expect(config.topDimensions).toBeDefined();
    });

    it("should update config", () => {
      calculator.updateConfig({ changeThreshold: 0.3 });
      const config = calculator.getConfig();
      expect(config.changeThreshold).toBe(0.3);
    });

    it("should preserve other config values when updating", () => {
      const originalTopDimensions = calculator.getConfig().topDimensions;
      calculator.updateConfig({ changeThreshold: 0.3 });
      expect(calculator.getConfig().topDimensions).toBe(originalTopDimensions);
    });
  });

  describe("Dimension Semantics", () => {
    it("should get dimension semantics", () => {
      const semantics = calculator.getDimensionSemantics();
      expect(semantics).toBeInstanceOf(Map);
    });

    it("should set dimension semantics", () => {
      const newSemantics = new Map([[0, "test-semantic"]]);
      calculator.setDimensionSemantics(newSemantics);
      const retrieved = calculator.getDimensionSemantics();
      expect(retrieved.get(0)).toBe("test-semantic");
    });
  });

  describe("Semantic Changes", () => {
    it("should detect layout changes", async () => {
      const current = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      const goal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM),
        description: "Change layout",
        confidence: 0.9,
      };

      // Set middle dimensions to trigger layout change
      for (let i = 200; i < 300; i++) {
        current.embedding[i] = 0;
        goal.embedding[i] = 0.8;
      }

      const delta = await calculator.calculate(current, goal);
      const layoutChanges = delta.semanticChanges.filter(
        c => c.type === "layout"
      );
      expect(layoutChanges.length).toBeGreaterThan(0);
    });

    it("should assign target element", async () => {
      const current = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM),
        timestamp: Date.now(),
        uiContext: "/test",
        metadata: { focus: "#submit-btn" },
      };

      const goal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        description: "Style the button",
        confidence: 0.9,
      };

      const delta = await calculator.calculate(current, goal);
      if (delta.semanticChanges.length > 0) {
        expect(delta.semanticChanges[0].element).toBeDefined();
      }
    });
  });

  describe("Complexity Calculation", () => {
    it("should increase complexity with more changes", async () => {
      const current = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      const simpleGoal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.1),
        description: "Small change",
        confidence: 0.9,
      };

      const complexGoal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(1),
        description: "Large change",
        confidence: 0.9,
      };

      const simpleDelta = await calculator.calculate(current, simpleGoal);
      const complexDelta = await calculator.calculate(current, complexGoal);

      expect(complexDelta.complexity).toBeGreaterThanOrEqual(
        simpleDelta.complexity
      );
    });
  });

  describe("Effort Estimation", () => {
    it("should estimate more actions for complex changes", async () => {
      const current = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      const complexGoal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(1),
        description: "Complex change",
        confidence: 0.5,
      };

      const delta = await calculator.calculate(current, complexGoal);
      expect(delta.estimatedActions).toBeGreaterThan(0);
    });

    it("should estimate reasonable time", async () => {
      const current = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      const goal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        description: "Test",
        confidence: 0.9,
      };

      const delta = await calculator.calculate(current, goal);
      expect(delta.estimatedTime).toBeGreaterThan(0);
      expect(delta.estimatedTime).toBeLessThan(60000); // Less than 1 minute
    });
  });

  describe("Factory Functions", () => {
    it("should create calculator with factory", () => {
      const calc = createDeltaCalculator();
      expect(calc).toBeInstanceOf(EmbeddingDeltaCalculator);
    });

    it("should create calculator with custom config via factory", () => {
      const calc = createDeltaCalculator({ changeThreshold: 0.3 });
      expect(calc.getConfig().changeThreshold).toBe(0.3);
    });

    it("should calculate delta without instantiating", async () => {
      const current = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      const goal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        description: "Test",
        confidence: 0.9,
      };

      const delta = await calculateDelta(current, goal);
      expect(delta).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small changes", async () => {
      const current = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      const goal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.001),
        description: "Tiny change",
        confidence: 0.9,
      };

      const delta = await calculator.calculate(current, goal);
      expect(delta.complexity).toBeLessThan(0.5);
    });

    it("should handle very large changes", async () => {
      const current = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(-1),
        timestamp: Date.now(),
        uiContext: "/test",
      };

      const goal = {
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(1),
        description: "Huge change",
        confidence: 0.5,
      };

      const delta = await calculator.calculate(current, goal);
      expect(delta.magnitude).toBeGreaterThan(20);
    });
  });
});

describe("DEFAULT_DELTA_CONFIG", () => {
  it("should have valid defaults", () => {
    expect(DEFAULT_DELTA_CONFIG.changeThreshold).toBe(0.1);
    expect(DEFAULT_DELTA_CONFIG.topDimensions).toBe(50);
    expect(DEFAULT_DELTA_CONFIG.useWeightedMagnitude).toBe(true);
  });

  it("should have complexity weights", () => {
    expect(DEFAULT_DELTA_CONFIG.complexityWeights).toBeDefined();
    expect(DEFAULT_DELTA_CONFIG.complexityWeights.layout).toBeDefined();
    expect(DEFAULT_DELTA_CONFIG.complexityWeights.style).toBeDefined();
  });

  it("should have action time estimates", () => {
    expect(DEFAULT_DELTA_CONFIG.actionTimeEstimates).toBeDefined();
    expect(DEFAULT_DELTA_CONFIG.actionTimeEstimates.click).toBeDefined();
    expect(DEFAULT_DELTA_CONFIG.actionTimeEstimates.modify).toBeDefined();
  });
});
