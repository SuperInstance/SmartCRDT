/**
 * @lsi/vljepa/planning/test/CoAgentsPlannerBridge.test.ts
 * Comprehensive tests for CoAgentsPlannerBridge (30+ tests)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CoAgentsPlannerBridge,
  createCoAgentsPlannerBridge,
  initializeCoAgentsState,
  DEFAULT_BRIDGE_CONFIG,
} from "../CoAgentsPlannerBridge.js";
import type {
  PlanningNodeInput,
  PlanningNodeOutput,
  CoAgentsState,
  HITLCheckpoint,
} from "../CoAgentsPlannerBridge.js";
import type { ValidationReport } from "../PlanValidator.js";
import type { ActionSequence } from "../ActionSequenceGenerator.js";
import { DEFAULT_EMBEDDING_DIM } from "../../index.js";

describe("CoAgentsPlannerBridge", () => {
  let bridge: CoAgentsPlannerBridge;
  let mockInput: PlanningNodeInput;

  beforeEach(() => {
    bridge = new CoAgentsPlannerBridge();

    mockInput = {
      currentEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
      goalEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
      currentFrame: undefined,
      goalFrame: undefined,
      userContext: {
        goalDescription: "Make button pop",
        uiContext: "/dashboard",
        preferences: {
          maxRiskTolerance: 0.7,
          allowDestructive: false,
          preferReversible: true,
        },
      },
      sessionMetadata: {
        sessionId: "test-session-123",
        userId: "user-456",
        previousPlans: [],
        executionHistory: [],
      },
    };
  });

  describe("Construction", () => {
    it("should create instance with default config", () => {
      expect(bridge).toBeInstanceOf(CoAgentsPlannerBridge);
    });

    it("should create instance with custom config", () => {
      const customBridge = new CoAgentsPlannerBridge({
        requireApproval: false,
        approvalThreshold: 0.9,
      });
      expect(customBridge).toBeInstanceOf(CoAgentsPlannerBridge);
      expect(customBridge.getConfig().requireApproval).toBe(false);
    });

    it("should create instance with dependencies", () => {
      const mockDependencies = {
        deltaCalculator: {},
        actionGenerator: {},
        planValidator: {},
      };

      const customBridge = new CoAgentsPlannerBridge({}, mockDependencies);
      expect(customBridge).toBeInstanceOf(CoAgentsPlannerBridge);
    });
  });

  describe("runPlanningNode()", () => {
    it("should return planning output", async () => {
      const output = await bridge.runPlanningNode(mockInput);
      expect(output).toBeDefined();
    });

    it("should include plan in output", async () => {
      const output = await bridge.runPlanningNode(mockInput);
      expect(output.plan).toBeDefined();
    });

    it("should include validation in output", async () => {
      const output = await bridge.runPlanningNode(mockInput);
      expect(output.validation).toBeDefined();
    });

    it("should include estimated time", async () => {
      const output = await bridge.runPlanningNode(mockInput);
      expect(output.estimatedTime).toBeGreaterThanOrEqual(0);
    });

    it("should include confidence", async () => {
      const output = await bridge.runPlanningNode(mockInput);
      expect(output.confidence).toBeGreaterThanOrEqual(0);
      expect(output.confidence).toBeLessThanOrEqual(1);
    });

    it("should determine next node", async () => {
      const output = await bridge.runPlanningNode(mockInput);
      expect(["human_approval", "execute", "replan", "error"]).toContain(
        output.nextNode
      );
    });

    it("should include requiresApproval flag", async () => {
      const output = await bridge.runPlanningNode(mockInput);
      expect(typeof output.requiresApproval).toBe("boolean");
    });

    it("should handle errors gracefully", async () => {
      const invalidInput = {
        ...mockInput,
        currentEmbedding: new Float32Array(0), // Invalid
      };

      const output = await bridge.runPlanningNode(invalidInput);
      expect(output.nextNode).toBe("error");
      expect(output.error).toBeDefined();
    });

    it("should include debug info when enabled", async () => {
      const debugBridge = new CoAgentsPlannerBridge({ includeDebugInfo: true });
      const output = await debugBridge.runPlanningNode(mockInput);
      expect(output.debug).toBeDefined();
    });

    it("should not include debug info when disabled", async () => {
      const noDebugBridge = new CoAgentsPlannerBridge({
        includeDebugInfo: false,
      });
      const output = await noDebugBridge.runPlanningNode(mockInput);
      expect(output.debug).toBeUndefined();
    });
  });

  describe("stateToPlanningInput()", () => {
    it("should convert state to input", () => {
      const state: CoAgentsState = {
        currentEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        goalEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        executedActions: [],
        currentActionIndex: 0,
        sessionMetadata: {
          sessionId: "test-session",
          startTime: Date.now(),
          iterations: 0,
        },
      };

      const input = bridge.stateToPlanningInput(state);
      expect(input).toBeDefined();
      expect(input.currentEmbedding).toBe(state.currentEmbedding);
      expect(input.goalEmbedding).toBe(state.goalEmbedding);
    });

    it("should include session metadata", () => {
      const state: CoAgentsState = {
        currentEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        goalEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        executedActions: [],
        currentActionIndex: 0,
        sessionMetadata: {
          sessionId: "test-session",
          userId: "user-123",
          startTime: Date.now(),
          iterations: 3,
        },
        currentPlan: undefined,
      };

      const input = bridge.stateToPlanningInput(state);
      expect(input.sessionMetadata).toBeDefined();
      expect(input.sessionMetadata?.sessionId).toBe("test-session");
      expect(input.sessionMetadata?.userId).toBe("user-123");
    });

    it("should include previous plans if current plan exists", () => {
      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const state: CoAgentsState = {
        currentEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        goalEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        currentPlan: mockPlan,
        executedActions: [],
        currentActionIndex: 0,
        sessionMetadata: {
          sessionId: "test-session",
          startTime: Date.now(),
          iterations: 0,
        },
      };

      const input = bridge.stateToPlanningInput(state);
      expect(input.sessionMetadata?.previousPlans).toBeDefined();
    });
  });

  describe("updateState()", () => {
    it("should update state with planning output", () => {
      const state: CoAgentsState = {
        currentEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        goalEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        executedActions: [],
        currentActionIndex: 0,
        sessionMetadata: {
          sessionId: "test-session",
          startTime: Date.now(),
          iterations: 0,
        },
      };

      const mockOutput: PlanningNodeOutput = {
        plan: {
          version: "1.0",
          actions: [],
          totalEstimatedTime: 100,
          confidence: 0.9,
          reasoning: "Test",
          alternatives: [],
          metadata: {
            timestamp: Date.now(),
            actionCount: 0,
            primaryChangeType: "style",
            complexity: 0.5,
            risk: "low",
          },
        },
        validation: {
          valid: true,
          confidence: 0.9,
          issues: [],
          warnings: [],
          suggestions: [],
          metadata: {
            timestamp: Date.now(),
            duration: 10,
            actionCount: 0,
            issueCount: 0,
            warningCount: 0,
          },
        },
        requiresApproval: false,
        estimatedTime: 100,
        confidence: 0.9,
        nextNode: "execute",
      };

      const updated = bridge.updateState(state, mockOutput);
      expect(updated.currentPlan).toBeDefined();
      expect(updated.planValidation).toBeDefined();
      expect(updated.executionStatus).toBe("not_started");
    });

    it("should increment iterations", () => {
      const state: CoAgentsState = {
        currentEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        goalEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        executedActions: [],
        currentActionIndex: 0,
        sessionMetadata: {
          sessionId: "test-session",
          startTime: Date.now(),
          iterations: 0,
        },
      };

      const mockOutput: PlanningNodeOutput = {
        plan: {
          version: "1.0",
          actions: [],
          totalEstimatedTime: 0,
          confidence: 0.8,
          reasoning: "Test",
          alternatives: [],
          metadata: {
            timestamp: Date.now(),
            actionCount: 0,
            primaryChangeType: "style",
            complexity: 0.5,
            risk: "low",
          },
        },
        validation: {
          valid: true,
          confidence: 0.8,
          issues: [],
          warnings: [],
          suggestions: [],
          metadata: {
            timestamp: Date.now(),
            duration: 0,
            actionCount: 0,
            issueCount: 0,
            warningCount: 0,
          },
        },
        requiresApproval: false,
        estimatedTime: 0,
        confidence: 0.8,
        nextNode: "execute",
      };

      const updated = bridge.updateState(state, mockOutput);
      expect(updated.sessionMetadata.iterations).toBe(1);
    });

    it("should set approval status when required", () => {
      const state: CoAgentsState = {
        currentEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        goalEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        executedActions: [],
        currentActionIndex: 0,
        sessionMetadata: {
          sessionId: "test-session",
          startTime: Date.now(),
          iterations: 0,
        },
      };

      const mockOutput: PlanningNodeOutput = {
        plan: {
          version: "1.0",
          actions: [],
          totalEstimatedTime: 0,
          confidence: 0.7,
          reasoning: "Test",
          alternatives: [],
          metadata: {
            timestamp: Date.now(),
            actionCount: 0,
            primaryChangeType: "style",
            complexity: 0.5,
            risk: "low",
          },
        },
        validation: {
          valid: true,
          confidence: 0.7,
          issues: [],
          warnings: [],
          suggestions: [],
          metadata: {
            timestamp: Date.now(),
            duration: 0,
            actionCount: 0,
            issueCount: 0,
            warningCount: 0,
          },
        },
        requiresApproval: true,
        estimatedTime: 0,
        confidence: 0.7,
        nextNode: "human_approval",
      };

      const updated = bridge.updateState(state, mockOutput);
      expect(updated.approvalStatus).toBe("pending");
    });
  });

  describe("createCheckpoint()", () => {
    it("should create HITL checkpoint", () => {
      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const mockValidation: ValidationReport = {
        valid: true,
        confidence: 0.8,
        issues: [],
        warnings: [],
        suggestions: [],
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          actionCount: 0,
          issueCount: 0,
          warningCount: 0,
        },
      };

      const checkpoint = bridge.createCheckpoint(mockPlan, mockValidation);
      expect(checkpoint).toBeDefined();
      expect(checkpoint.type).toBe("plan_approval");
      expect(checkpoint.plan).toBe(mockPlan);
      expect(checkpoint.validation).toBe(mockValidation);
    });

    it("should generate unique checkpoint IDs", () => {
      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const mockValidation: ValidationReport = {
        valid: true,
        confidence: 0.8,
        issues: [],
        warnings: [],
        suggestions: [],
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          actionCount: 0,
          issueCount: 0,
          warningCount: 0,
        },
      };

      const checkpoint1 = bridge.createCheckpoint(mockPlan, mockValidation);
      const checkpoint2 = bridge.createCheckpoint(mockPlan, mockValidation);

      expect(checkpoint1.id).not.toBe(checkpoint2.id);
    });

    it("should store checkpoint", () => {
      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const mockValidation: ValidationReport = {
        valid: true,
        confidence: 0.8,
        issues: [],
        warnings: [],
        suggestions: [],
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          actionCount: 0,
          issueCount: 0,
          warningCount: 0,
        },
      };

      const checkpoint = bridge.createCheckpoint(mockPlan, mockValidation);
      const retrieved = bridge.getCheckpoint(checkpoint.id);
      expect(retrieved).toBe(checkpoint);
    });
  });

  describe("handleApprovalResponse()", () => {
    it("should handle approved decision", async () => {
      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const mockValidation: ValidationReport = {
        valid: true,
        confidence: 0.8,
        issues: [],
        warnings: [],
        suggestions: [],
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          actionCount: 0,
          issueCount: 0,
          warningCount: 0,
        },
      };

      const checkpoint = bridge.createCheckpoint(mockPlan, mockValidation);

      const update = await bridge.handleApprovalResponse(
        checkpoint.id,
        "approved"
      );
      expect(update?.approvalStatus).toBe("approved");
      expect(update?.currentPlan).toBe(mockPlan);
    });

    it("should handle rejected decision", async () => {
      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const mockValidation: ValidationReport = {
        valid: true,
        confidence: 0.8,
        issues: [],
        warnings: [],
        suggestions: [],
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          actionCount: 0,
          issueCount: 0,
          warningCount: 0,
        },
      };

      const checkpoint = bridge.createCheckpoint(mockPlan, mockValidation);

      const update = await bridge.handleApprovalResponse(
        checkpoint.id,
        "rejected",
        "Not good"
      );
      expect(update?.approvalStatus).toBe("rejected");
      expect(update?.userFeedback?.message).toBe("Not good");
    });

    it("should handle modified decision", async () => {
      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const mockValidation: ValidationReport = {
        valid: true,
        confidence: 0.8,
        issues: [],
        warnings: [],
        suggestions: [],
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          actionCount: 0,
          issueCount: 0,
          warningCount: 0,
        },
      };

      const modifiedPlan: ActionSequence = {
        ...mockPlan,
        reasoning: "Modified plan",
      };

      const checkpoint = bridge.createCheckpoint(mockPlan, mockValidation);

      const update = await bridge.handleApprovalResponse(
        checkpoint.id,
        "modified",
        "Changed",
        modifiedPlan
      );
      expect(update?.approvalStatus).toBe("modified");
      expect(update?.currentPlan).toBe(modifiedPlan);
    });

    it("should throw for non-existent checkpoint", async () => {
      await expect(
        bridge.handleApprovalResponse("non-existent", "approved")
      ).rejects.toThrow();
    });

    it("should throw for expired checkpoint", async () => {
      const shortTimeoutBridge = new CoAgentsPlannerBridge({
        defaultTimeout: 1,
      });

      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const mockValidation: ValidationReport = {
        valid: true,
        confidence: 0.8,
        issues: [],
        warnings: [],
        suggestions: [],
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          actionCount: 0,
          issueCount: 0,
          warningCount: 0,
        },
      };

      const checkpoint = shortTimeoutBridge.createCheckpoint(
        mockPlan,
        mockValidation
      );

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 10));

      await expect(
        shortTimeoutBridge.handleApprovalResponse(checkpoint.id, "approved")
      ).rejects.toThrow();
    });
  });

  describe("executeNextAction()", () => {
    it("should execute next action", async () => {
      const mockAction = {
        id: "action-1",
        type: "modify" as const,
        target: "#btn",
        params: {},
        preconditions: [],
        postconditions: [],
        confidence: 0.9,
        estimatedDuration: 100,
        reasoning: "Test",
        dependencies: [],
        reversible: true,
      };

      const state: CoAgentsState = {
        currentEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        goalEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        currentPlan: {
          version: "1.0",
          actions: [mockAction],
          totalEstimatedTime: 100,
          confidence: 0.9,
          reasoning: "Test",
          alternatives: [],
          metadata: {
            timestamp: Date.now(),
            actionCount: 1,
            primaryChangeType: "style",
            complexity: 0.5,
            risk: "low",
          },
        },
        executedActions: [],
        currentActionIndex: 0,
        executionStatus: "not_started",
        sessionMetadata: {
          sessionId: "test-session",
          startTime: Date.now(),
          iterations: 0,
        },
      };

      const updated = await bridge.executeNextAction(state);
      expect(updated.executedActions).toContain("action-1");
      expect(updated.currentActionIndex).toBe(1);
      expect(updated.executionStatus).toBe("in_progress");
    });

    it("should mark as completed when all actions done", async () => {
      const state: CoAgentsState = {
        currentEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        goalEmbedding: new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        currentPlan: {
          version: "1.0",
          actions: [],
          totalEstimatedTime: 0,
          confidence: 0.9,
          reasoning: "Test",
          alternatives: [],
          metadata: {
            timestamp: Date.now(),
            actionCount: 0,
            primaryChangeType: "style",
            complexity: 0.5,
            risk: "low",
          },
        },
        executedActions: [],
        currentActionIndex: 0,
        executionStatus: "not_started",
        sessionMetadata: {
          sessionId: "test-session",
          startTime: Date.now(),
          iterations: 0,
        },
      };

      const updated = await bridge.executeNextAction(state);
      expect(updated.executionStatus).toBe("completed");
    });
  });

  describe("Checkpoint Management", () => {
    it("should get active checkpoints", () => {
      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const mockValidation: ValidationReport = {
        valid: true,
        confidence: 0.8,
        issues: [],
        warnings: [],
        suggestions: [],
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          actionCount: 0,
          issueCount: 0,
          warningCount: 0,
        },
      };

      bridge.createCheckpoint(mockPlan, mockValidation);
      const activeCheckpoints = bridge.getActiveCheckpoints();
      expect(activeCheckpoints.length).toBeGreaterThan(0);
    });

    it("should clear expired checkpoints", () => {
      const shortTimeoutBridge = new CoAgentsPlannerBridge({
        defaultTimeout: 1,
      });

      const mockPlan: ActionSequence = {
        version: "1.0",
        actions: [],
        totalEstimatedTime: 0,
        confidence: 0.8,
        reasoning: "Test",
        alternatives: [],
        metadata: {
          timestamp: Date.now(),
          actionCount: 0,
          primaryChangeType: "style",
          complexity: 0.5,
          risk: "low",
        },
      };

      const mockValidation: ValidationReport = {
        valid: true,
        confidence: 0.8,
        issues: [],
        warnings: [],
        suggestions: [],
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          actionCount: 0,
          issueCount: 0,
          warningCount: 0,
        },
      };

      shortTimeoutBridge.createCheckpoint(mockPlan, mockValidation);

      // Wait for timeout
      setTimeout(() => {
        shortTimeoutBridge.clearExpiredCheckpoints();
        expect(shortTimeoutBridge.getActiveCheckpoints().length).toBe(0);
      }, 10);
    });
  });

  describe("Configuration", () => {
    it("should get current config", () => {
      const config = bridge.getConfig();
      expect(config).toBeDefined();
      expect(config.requireApproval).toBeDefined();
      expect(config.approvalThreshold).toBeDefined();
    });

    it("should update config", () => {
      bridge.updateConfig({ requireApproval: false });
      expect(bridge.getConfig().requireApproval).toBe(false);
    });

    it("should preserve other config values when updating", () => {
      const originalThreshold = bridge.getConfig().approvalThreshold;
      bridge.updateConfig({ requireApproval: false });
      expect(bridge.getConfig().approvalThreshold).toBe(originalThreshold);
    });
  });

  describe("Factory Functions", () => {
    it("should create bridge with factory", () => {
      const b = createCoAgentsPlannerBridge();
      expect(b).toBeInstanceOf(CoAgentsPlannerBridge);
    });

    it("should create bridge with custom config via factory", () => {
      const b = createCoAgentsPlannerBridge({ requireApproval: false });
      expect(b.getConfig().requireApproval).toBe(false);
    });

    it("should initialize CoAgents state", () => {
      const state = initializeCoAgentsState(
        new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0),
        new Float32Array(DEFAULT_EMBEDDING_DIM).fill(0.5),
        "test-session"
      );

      expect(state.currentEmbedding).toBeDefined();
      expect(state.goalEmbedding).toBeDefined();
      expect(state.sessionMetadata.sessionId).toBe("test-session");
      expect(state.executedActions).toHaveLength(0);
      expect(state.currentActionIndex).toBe(0);
    });
  });
});

describe("DEFAULT_BRIDGE_CONFIG", () => {
  it("should have valid defaults", () => {
    expect(DEFAULT_BRIDGE_CONFIG.requireApproval).toBe(true);
    expect(DEFAULT_BRIDGE_CONFIG.approvalThreshold).toBe(0.8);
    expect(DEFAULT_BRIDGE_CONFIG.maxIterations).toBe(5);
  });

  it("should use world model by default", () => {
    expect(DEFAULT_BRIDGE_CONFIG.useWorldModel).toBe(true);
  });

  it("should enable learning by default", () => {
    expect(DEFAULT_BRIDGE_CONFIG.enableLearning).toBe(true);
  });

  it("should have reasonable default timeout", () => {
    expect(DEFAULT_BRIDGE_CONFIG.defaultTimeout).toBe(60000);
  });

  it("should include debug info by default", () => {
    expect(DEFAULT_BRIDGE_CONFIG.includeDebugInfo).toBe(true);
  });
});
