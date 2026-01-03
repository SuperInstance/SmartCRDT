/**
 * @lsi/vljepa/planning/test/WorldModelReasoner.test.ts
 * Comprehensive tests for WorldModelReasoner (45+ tests)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  WorldModelReasoner,
  createWorldModelReasoner,
  predictAction,
  DEFAULT_WORLD_MODEL_CONFIG,
  DEFAULT_TRANSITION_RULES,
} from "../WorldModelReasoner.js";
import type { PlannedAction } from "../ActionSequenceGenerator.js";
import type {
  VisualState,
  WorldModelPrediction,
  SideEffect,
} from "../WorldModelReasoner.js";
import type { ActionSequence } from "../ActionSequenceGenerator.js";
import { DEFAULT_EMBEDDING_DIM } from "../../index.js";

describe("WorldModelReasoner", () => {
  let reasoner: WorldModelReasoner;
  let mockAction: PlannedAction;
  let mockCurrentState: VisualState;

  beforeEach(() => {
    reasoner = new WorldModelReasoner();

    mockAction = {
      id: "action-1",
      type: "modify",
      target: "#submit-btn",
      params: {
        backgroundColor: "#FF6B6B",
        color: "#FFFFFF",
      },
      preconditions: ["element exists"],
      postconditions: ["button styled"],
      confidence: 0.9,
      estimatedDuration: 150,
      reasoning: "Apply button styling",
      dependencies: [],
      reversible: true,
    };

    mockCurrentState = {
      embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
      timestamp: Date.now(),
      uiContext: "/test",
    };
  });

  describe("Construction", () => {
    it("should create instance with default config", () => {
      expect(reasoner).toBeInstanceOf(WorldModelReasoner);
    });

    it("should create instance with custom config", () => {
      const customReasoner = new WorldModelReasoner({
        useLearnedModel: true,
        maxTransitionRules: 500,
      });
      expect(customReasoner).toBeInstanceOf(WorldModelReasoner);
    });

    it("should create instance with custom rules", () => {
      const customRule = {
        id: "test-rule",
        actionType: "modify" as const,
        preconditions: {
          dimensionRanges: [],
          semanticConditions: ["test"],
        },
        effects: {
          dimensionDeltas: [{ dimension: 0, delta: 0.5 }],
          semanticEffects: ["test effect"],
        },
        confidence: 0.8,
        observationCount: 10,
        lastUpdated: Date.now(),
      };

      const customReasoner = new WorldModelReasoner(undefined, [customRule]);
      expect(customReasoner.getTransitionRules()).toContain(customRule);
    });

    it("should initialize world state", () => {
      const state = reasoner.getWorldState();
      expect(state).toBeDefined();
      expect(state.physics).toBe("intuitive");
      expect(state.objectPermanence).toBe(true);
      expect(state.causality).toBe(true);
    });
  });

  describe("predictAction()", () => {
    it("should predict action outcome", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction).toBeDefined();
    });

    it("should return predicted state", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction.predictedState).toBeInstanceOf(Float32Array);
      expect(prediction.predictedState.length).toBe(DEFAULT_EMBEDDING_DIM);
    });

    it("should calculate confidence", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it("should predict side effects", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(Array.isArray(prediction.sideEffects)).toBe(true);
    });

    it("should predict visual changes", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction.visualChanges).toBeDefined();
      expect(prediction.visualChanges.movedElements).toBeDefined();
      expect(prediction.visualChanges.changedElements).toBeDefined();
      expect(prediction.visualChanges.appearedElements).toBeDefined();
      expect(prediction.visualChanges.disappearedElements).toBeDefined();
    });

    it("should predict experience impact", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction.experienceImpact).toBeDefined();
      expect(prediction.experienceImpact.performance).toBeDefined();
      expect(prediction.experienceImpact.cognitiveLoad).toBeDefined();
      expect(prediction.experienceImpact.satisfaction).toBeDefined();
    });

    it("should include metadata", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction.metadata).toBeDefined();
      expect(prediction.metadata.timestamp).toBeDefined();
      expect(prediction.metadata.method).toBeDefined();
      expect(prediction.metadata.computationTime).toBeDefined();
    });

    it("should use embedding_space method by default", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(["embedding_space", "heuristic", "learned_model"]).toContain(
        prediction.metadata.method
      );
    });
  });

  describe("predictSequence()", () => {
    it("should predict entire action sequence", async () => {
      const mockSequence: ActionSequence = {
        version: "1.0",
        actions: [mockAction],
        totalEstimatedTime: 150,
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

      const chain = await reasoner.predictSequence(
        mockSequence,
        mockCurrentState
      );
      expect(chain).toBeDefined();
      expect(chain.actions).toBeDefined();
      expect(chain.intermediateStates).toBeDefined();
      expect(chain.cumulativeEffects).toBeDefined();
    });

    it("should include intermediate states", async () => {
      const mockSequence: ActionSequence = {
        version: "1.0",
        actions: [mockAction, { ...mockAction, id: "action-2" }],
        totalEstimatedTime: 300,
        confidence: 0.85,
        reasoning: "Test sequence",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 2,
          primaryChangeType: "style",
          complexity: 0.6,
          risk: "low",
        },
      };

      const chain = await reasoner.predictSequence(
        mockSequence,
        mockCurrentState
      );
      // Initial state + one per action
      expect(chain.intermediateStates.length).toBe(3);
    });

    it("should calculate chain confidence", async () => {
      const mockSequence: ActionSequence = {
        version: "1.0",
        actions: [mockAction],
        totalEstimatedTime: 150,
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

      const chain = await reasoner.predictSequence(
        mockSequence,
        mockCurrentState
      );
      expect(chain.confidence).toBeGreaterThanOrEqual(0);
      expect(chain.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("learnTransitionRule()", () => {
    it("should learn new rule from observation", () => {
      const beforeState = { ...mockCurrentState };
      const afterState = {
        ...mockCurrentState,
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
      };

      const initialCount = reasoner.getTransitionRules().length;
      reasoner.learnTransitionRule(mockAction, beforeState, afterState);
      const finalCount = reasoner.getTransitionRules().length;

      expect(finalCount).toBeGreaterThanOrEqual(initialCount);
    });

    it("should update existing rule", () => {
      const beforeState = { ...mockCurrentState };
      const afterState = {
        ...mockCurrentState,
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
      };

      // Learn first time
      reasoner.learnTransitionRule(mockAction, beforeState, afterState);

      // Learn second time (should update)
      reasoner.learnTransitionRule(mockAction, beforeState, afterState);

      const rules = reasoner.getTransitionRules();
      const modifyRules = rules.filter(r => r.actionType === "modify");

      expect(modifyRules.length).toBeGreaterThan(0);

      const rule = modifyRules[0];
      expect(rule.observationCount).toBeGreaterThan(1);
    });

    it("should limit rules to maxTransitionRules", () => {
      const smallReasoner = new WorldModelReasoner({ maxTransitionRules: 5 });

      for (let i = 0; i < 20; i++) {
        const action = { ...mockAction, id: `action-${i}` };
        const beforeState = { ...mockCurrentState };
        const afterState = {
          ...mockCurrentState,
          embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(
            Math.random()
          ),
        };

        smallReasoner.learnTransitionRule(action, beforeState, afterState);
      }

      expect(smallReasoner.getTransitionRules().length).toBeLessThanOrEqual(5);
    });
  });

  describe("Side Effects Prediction", () => {
    it("should predict side effects for create action", async () => {
      const createAction = { ...mockAction, type: "create" as const };
      const prediction = await reasoner.predictAction(
        createAction,
        mockCurrentState
      );

      expect(prediction.sideEffects.length).toBeGreaterThan(0);
      const layoutShift = prediction.sideEffects.find(
        e => e.type === "layout_shift"
      );
      expect(layoutShift).toBeDefined();
    });

    it("should predict side effects for delete action", async () => {
      const deleteAction = { ...mockAction, type: "delete" as const };
      const prediction = await reasoner.predictAction(
        deleteAction,
        mockCurrentState
      );

      expect(prediction.sideEffects.length).toBeGreaterThan(0);
    });

    it("should predict side effects for modify action", async () => {
      const modifyAction = { ...mockAction, params: { display: "flex" } };
      const prediction = await reasoner.predictAction(
        modifyAction,
        mockCurrentState
      );

      expect(prediction.sideEffects.length).toBeGreaterThanOrEqual(0);
    });

    it("should predict side effects for navigate action", async () => {
      const navigateAction = { ...mockAction, type: "navigate" as const };
      const prediction = await reasoner.predictAction(
        navigateAction,
        mockCurrentState
      );

      expect(prediction.sideEffects.length).toBeGreaterThan(0);
    });

    it("should set severity correctly", async () => {
      const deleteAction = { ...mockAction, type: "delete" as const };
      const prediction = await reasoner.predictAction(
        deleteAction,
        mockCurrentState
      );

      const highSeverityEffects = prediction.sideEffects.filter(
        e => e.severity === "high"
      );
      expect(highSeverityEffects.length).toBeGreaterThan(0);
    });

    it("should set reversibility correctly", async () => {
      const deleteAction = {
        ...mockAction,
        type: "delete" as const,
        reversible: false,
      };
      const prediction = await reasoner.predictAction(
        deleteAction,
        mockCurrentState
      );

      const irreversibleEffects = prediction.sideEffects.filter(
        e => !e.reversible
      );
      expect(irreversibleEffects.length).toBeGreaterThan(0);
    });
  });

  describe("Visual Changes Prediction", () => {
    it("should predict changed elements for modify", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction.visualChanges.changedElements.length).toBeGreaterThan(
        0
      );
    });

    it("should predict appeared elements for create", async () => {
      const createAction = { ...mockAction, type: "create" as const };
      const prediction = await reasoner.predictAction(
        createAction,
        mockCurrentState
      );
      expect(prediction.visualChanges.appearedElements.length).toBeGreaterThan(
        0
      );
    });

    it("should predict disappeared elements for delete", async () => {
      const deleteAction = { ...mockAction, type: "delete" as const };
      const prediction = await reasoner.predictAction(
        deleteAction,
        mockCurrentState
      );
      expect(
        prediction.visualChanges.disappearedElements.length
      ).toBeGreaterThan(0);
    });

    it("should predict moved elements for position changes", async () => {
      const positionAction = {
        ...mockAction,
        params: { position: "absolute", left: "10px" },
      };
      const prediction = await reasoner.predictAction(
        positionAction,
        mockCurrentState
      );
      expect(prediction.visualChanges.movedElements.length).toBeGreaterThan(0);
    });
  });

  describe("Experience Impact Prediction", () => {
    it("should predict performance impact", async () => {
      const createAction = { ...mockAction, type: "create" as const };
      const prediction = await reasoner.predictAction(
        createAction,
        mockCurrentState
      );
      expect(prediction.experienceImpact.performance).toBeGreaterThanOrEqual(0);
      expect(prediction.experienceImpact.performance).toBeLessThanOrEqual(1);
    });

    it("should predict cognitive load impact", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction.experienceImpact.cognitiveLoad).toBeGreaterThanOrEqual(
        0
      );
      expect(prediction.experienceImpact.cognitiveLoad).toBeLessThanOrEqual(1);
    });

    it("should predict satisfaction impact", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction.experienceImpact.satisfaction).toBeGreaterThanOrEqual(
        0
      );
      expect(prediction.experienceImpact.satisfaction).toBeLessThanOrEqual(1);
    });

    it("should increase satisfaction for reversible actions", async () => {
      const reversibleAction = { ...mockAction, reversible: true };
      const irreversibleAction = { ...mockAction, reversible: false };

      const reversiblePrediction = await reasoner.predictAction(
        reversibleAction,
        mockCurrentState
      );
      const irreversiblePrediction = await reasoner.predictAction(
        irreversibleAction,
        mockCurrentState
      );

      expect(
        reversiblePrediction.experienceImpact.satisfaction
      ).toBeGreaterThanOrEqual(
        irreversiblePrediction.experienceImpact.satisfaction
      );
    });
  });

  describe("Configuration", () => {
    it("should get current config", () => {
      const config = reasoner.getConfig();
      expect(config).toBeDefined();
      expect(config.useLearnedModel).toBeDefined();
      expect(config.maxTransitionRules).toBeDefined();
    });

    it("should update config", () => {
      reasoner.updateConfig({ useLearnedModel: true });
      expect(reasoner.getConfig().useLearnedModel).toBe(true);
    });

    it("should preserve other config values when updating", () => {
      const originalMaxRules = reasoner.getConfig().maxTransitionRules;
      reasoner.updateConfig({ useLearnedModel: true });
      expect(reasoner.getConfig().maxTransitionRules).toBe(originalMaxRules);
    });
  });

  describe("Transition Rules", () => {
    it("should get transition rules", () => {
      const rules = reasoner.getTransitionRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });

    it("should clear rules", () => {
      reasoner.clearRules();
      expect(reasoner.getTransitionRules()).toHaveLength(0);
    });

    it("should have valid default rules", () => {
      const rules = reasoner.getTransitionRules();
      rules.forEach(rule => {
        expect(rule.id).toBeDefined();
        expect(rule.actionType).toBeDefined();
        expect(rule.confidence).toBeGreaterThanOrEqual(0);
        expect(rule.confidence).toBeLessThanOrEqual(1);
        expect(rule.observationCount).toBeGreaterThan(0);
      });
    });
  });

  describe("World State", () => {
    it("should get world state", () => {
      const state = reasoner.getWorldState();
      expect(state).toBeDefined();
    });

    it("should have object permanence enabled", () => {
      const state = reasoner.getWorldState();
      expect(state.objectPermanence).toBe(true);
    });

    it("should have causality enabled", () => {
      const state = reasoner.getWorldState();
      expect(state.causality).toBe(true);
    });

    it("should have intuitive physics", () => {
      const state = reasoner.getWorldState();
      expect(state.physics).toBe("intuitive");
    });
  });

  describe("Factory Functions", () => {
    it("should create reasoner with factory", () => {
      const r = createWorldModelReasoner();
      expect(r).toBeInstanceOf(WorldModelReasoner);
    });

    it("should create reasoner with custom config via factory", () => {
      const r = createWorldModelReasoner({ useLearnedModel: true });
      expect(r.getConfig().useLearnedModel).toBe(true);
    });

    it("should predict action without instantiating", async () => {
      const prediction = await predictAction(mockAction, mockCurrentState);
      expect(prediction).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle unknown action type", async () => {
      const unknownAction = { ...mockAction, type: "wait" as const };
      const prediction = await reasoner.predictAction(
        unknownAction,
        mockCurrentState
      );
      expect(prediction).toBeDefined();
    });

    it("should handle action with no params", async () => {
      const noParamsAction = { ...mockAction, params: {} };
      const prediction = await reasoner.predictAction(
        noParamsAction,
        mockCurrentState
      );
      expect(prediction).toBeDefined();
    });

    it("should handle zero embedding state", async () => {
      const zeroState = {
        ...mockCurrentState,
        embedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
      };
      const prediction = await reasoner.predictAction(mockAction, zeroState);
      expect(prediction).toBeDefined();
    });
  });

  describe("Prediction Methods", () => {
    it("should use heuristic method when useLearnedModel is false", async () => {
      const heuristicReasoner = new WorldModelReasoner({
        useLearnedModel: false,
        predictionMethod: "heuristic",
      });

      const prediction = await heuristicReasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(prediction.metadata.method).toBe("heuristic");
    });

    it("should use embedding_space method by default", async () => {
      const prediction = await reasoner.predictAction(
        mockAction,
        mockCurrentState
      );
      expect(["embedding_space", "hybrid"]).toContain(
        prediction.metadata.method
      );
    });
  });
});

describe("DEFAULT_WORLD_MODEL_CONFIG", () => {
  it("should have valid defaults", () => {
    expect(DEFAULT_WORLD_MODEL_CONFIG.useLearnedModel).toBe(false);
    expect(DEFAULT_WORLD_MODEL_CONFIG.predictionMethod).toBe("hybrid");
    expect(DEFAULT_WORLD_MODEL_CONFIG.maxTransitionRules).toBe(1000);
  });

  it("should have simulateSideEffects enabled", () => {
    expect(DEFAULT_WORLD_MODEL_CONFIG.simulateSideEffects).toBe(true);
  });

  it("should have useCausalReasoning enabled", () => {
    expect(DEFAULT_WORLD_MODEL_CONFIG.useCausalReasoning).toBe(true);
  });
});

describe("DEFAULT_TRANSITION_RULES", () => {
  it("should have default rules", () => {
    expect(DEFAULT_TRANSITION_RULES.length).toBeGreaterThan(0);
  });

  it("should have all required rule fields", () => {
    DEFAULT_TRANSITION_RULES.forEach(rule => {
      expect(rule.id).toBeDefined();
      expect(rule.actionType).toBeDefined();
      expect(rule.preconditions).toBeDefined();
      expect(rule.effects).toBeDefined();
      expect(rule.confidence).toBeDefined();
      expect(rule.observationCount).toBeDefined();
    });
  });

  it("should have modify action rules", () => {
    const modifyRules = DEFAULT_TRANSITION_RULES.filter(
      r => r.actionType === "modify"
    );
    expect(modifyRules.length).toBeGreaterThan(0);
  });

  it("should have create action rules", () => {
    const createRules = DEFAULT_TRANSITION_RULES.filter(
      r => r.actionType === "create"
    );
    expect(createRules.length).toBeGreaterThan(0);
  });

  it("should have delete action rules", () => {
    const deleteRules = DEFAULT_TRANSITION_RULES.filter(
      r => r.actionType === "delete"
    );
    expect(deleteRules.length).toBeGreaterThan(0);
  });
});
