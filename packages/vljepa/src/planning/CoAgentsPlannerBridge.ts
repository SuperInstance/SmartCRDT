/**
 * @lsi/vljepa/planning/CoAgentsPlannerBridge - CoAgents Integration
 *
 * Bridges VL-JEPA zero-shot planning with CoAgents LangGraph workflows.
 * Enables planning as a LangGraph node with human-in-the-loop checkpoints.
 *
 * Key Concepts:
 * - Planning as LangGraph Node: Planning step in agent workflow
 * - State Synchronization: Plan state <-> CoAgents state
 * - HITL Integration: Human approval before execution
 * - State Management: Shared state between planning and execution
 *
 * @version 1.0.0
 * @see https://arxiv.org/abs/2512.10942 - VL-JEPA Paper
 * @see https://docs.copilotkit.ai/langgraph/ - CoAgents LangGraph Integration
 */

import type {
  ActionSequence,
  PlannedAction,
} from "./ActionSequenceGenerator.js";
import type { EmbeddingDelta } from "./EmbeddingDeltaCalculator.js";
import type { ValidationReport } from "./PlanValidator.js";
import type { VisualState, GoalState } from "./EmbeddingDeltaCalculator.js";
import type { WorldModelPrediction } from "./WorldModelReasoner.js";
import { DEFAULT_EMBEDDING_DIM } from "../index.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Planning Node Input - Input to planning node
 *
 * Input structure for the planning node in LangGraph.
 */
export interface PlanningNodeInput {
  /** Current state embedding (768-dim) */
  currentEmbedding: Float32Array;

  /** Goal state embedding (768-dim) */
  goalEmbedding: Float32Array;

  /** Current frame data (optional) */
  currentFrame?: ImageData;

  /** Goal frame data (optional) */
  goalFrame?: ImageData;

  /** User context */
  userContext: {
    /** User's goal description */
    goalDescription: string;

    /** Current UI context (URL, component path) */
    uiContext: string;

    /** User preferences */
    preferences?: {
      /** Maximum risk tolerance (0-1) */
      maxRiskTolerance?: number;

      /** Allow destructive actions */
      allowDestructive?: boolean;

      /** Prefer reversible actions */
      preferReversible?: boolean;

      /** Maximum actions allowed */
      maxActions?: number;
    };
  };

  /** Session metadata */
  sessionMetadata?: {
    /** Session ID */
    sessionId: string;

    /** User ID */
    userId?: string;

    /** Previous plans in this session */
    previousPlans?: ActionSequence[];

    /** Execution history */
    executionHistory?: Array<{
      plan: ActionSequence;
      result: "success" | "failure" | "partial";
      timestamp: number;
    }>;
  };
}

/**
 * Planning Node Output - Output from planning node
 *
 * Output structure from the planning node in LangGraph.
 */
export interface PlanningNodeOutput {
  /** Generated action sequence */
  plan: ActionSequence;

  /** Validation report */
  validation: ValidationReport;

  /** Whether human approval is required */
  requiresApproval: boolean;

  /** Approval reason */
  approvalReason?: string;

  /** Estimated execution time (ms) */
  estimatedTime: number;

  /** Confidence in plan (0-1) */
  confidence: number;

  /** Next node to route to */
  nextNode: "human_approval" | "execute" | "replan" | "error";

  /** Error message (if any) */
  error?: string;

  /** Debug information */
  debug?: {
    /** Delta calculation time (ms) */
    deltaTime?: number;

    /** Action generation time (ms) */
    generationTime?: number;

    /** Validation time (ms) */
    validationTime?: number;

    /** Total planning time (ms) */
    totalTime: number;
  };
}

/**
 * CoAgents State - Shared state between nodes
 *
 * Represents the shared state in the CoAgents graph.
 */
export interface CoAgentsState {
  /** Current state embedding */
  currentEmbedding: Float32Array;

  /** Goal state embedding */
  goalEmbedding: Float32Array;

  /** Current plan */
  currentPlan?: ActionSequence;

  /** Plan validation */
  planValidation?: ValidationReport;

  /** Human approval status */
  approvalStatus?: "pending" | "approved" | "rejected" | "modified";

  /** Execution status */
  executionStatus?: "not_started" | "in_progress" | "completed" | "failed";

  /** Executed actions */
  executedActions: string[];

  /** Current action index */
  currentActionIndex: number;

  /** User feedback */
  userFeedback?: {
    /** Feedback type */
    type: "approved" | "modified" | "rejected";

    /** Feedback message */
    message?: string;

    /** Modified plan (if applicable) */
    modifiedPlan?: ActionSequence;

    /** Timestamp */
    timestamp: number;
  };

  /** Session metadata */
  sessionMetadata: {
    /** Session ID */
    sessionId: string;

    /** User ID */
    userId?: string;

    /** Start time */
    startTime: number;

    /** Number of planning iterations */
    iterations: number;
  };

  /** World model predictions (if available) */
  worldPredictions?: Map<string, WorldModelPrediction>;
}

/**
 * HITL Checkpoint - Human-in-the-loop checkpoint
 *
 * Represents a checkpoint where human approval is required.
 */
export interface HITLCheckpoint {
  /** Checkpoint ID */
  id: string;

  /** Checkpoint type */
  type: "plan_approval" | "action_confirmation" | "error_recovery";

  /** Plan requiring approval */
  plan: ActionSequence;

  /** Validation report */
  validation: ValidationReport;

  /** Human decision */
  decision?: "approved" | "rejected" | "modified";

  /** Modified plan (if applicable) */
  modifiedPlan?: ActionSequence;

  /** Feedback message */
  feedback?: string;

  /** Timestamp */
  timestamp: number;

  /** Timeout (ms) */
  timeout?: number;

  /** Whether checkpoint has expired */
  expired: boolean;
}

/**
 * Bridge Configuration
 */
export interface BridgeConfig {
  /** Whether to require human approval for all plans */
  requireApproval: boolean;

  /** Approval threshold (confidence below this requires approval) */
  approvalThreshold: number;

  /** Maximum planning iterations before giving up */
  maxIterations: number;

  /** Whether to use world model predictions */
  useWorldModel: boolean;

  /** Whether to enable adaptive learning */
  enableLearning: boolean;

  /** Default timeout for HITL checkpoints (ms) */
  defaultTimeout: number;

  /** Whether to include debug information */
  includeDebugInfo: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default bridge configuration
 */
export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  requireApproval: true,
  approvalThreshold: 0.8,
  maxIterations: 5,
  useWorldModel: true,
  enableLearning: true,
  defaultTimeout: 60000, // 1 minute
  includeDebugInfo: true,
};

// ============================================================================
// COAGENTS PLANNER BRIDGE
// ============================================================================

/**
 * CoAgents Planner Bridge
 *
 * Bridges VL-JEPA planning with CoAgents LangGraph workflows.
 *
 * @example
 * ```typescript
 * const bridge = new CoAgentsPlannerBridge();
 *
 * // In LangGraph:
 * const planningNode = async (state: CoAgentsState) => {
 *   const input = bridge.stateToPlanningInput(state);
 *   const output = await bridge.runPlanningNode(input);
 *   return bridge.updateState(state, output);
 * };
 * ```
 */
export class CoAgentsPlannerBridge {
  private config: BridgeConfig;
  private checkpoints: Map<string, HITLCheckpoint>;
  private deltaCalculator: any; // Would be EmbeddingDeltaCalculator
  private actionGenerator: any; // Would be ActionSequenceGenerator
  private planValidator: any; // Would be PlanValidator

  constructor(
    config: Partial<BridgeConfig> = {},
    dependencies?: {
      deltaCalculator?: any;
      actionGenerator?: any;
      planValidator?: any;
    }
  ) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    this.checkpoints = new Map();

    // Store dependencies (would be injected in practice)
    this.deltaCalculator = dependencies?.deltaCalculator;
    this.actionGenerator = dependencies?.actionGenerator;
    this.planValidator = dependencies?.planValidator;
  }

  /**
   * Run planning node (LangGraph compatible)
   *
   * @param input - Planning node input
   * @returns Planning node output
   */
  async runPlanningNode(input: PlanningNodeInput): Promise<PlanningNodeOutput> {
    const startTime = Date.now();
    const debug: PlanningNodeOutput["debug"] = { totalTime: 0 };

    try {
      // Step 1: Calculate embedding delta
      const deltaTimeStart = Date.now();
      const visualState: VisualState = {
        embedding: input.currentEmbedding,
        frame: input.currentFrame,
        timestamp: Date.now(),
        uiContext: input.userContext.uiContext,
      };

      const goalState: GoalState = {
        embedding: input.goalEmbedding,
        frame: input.goalFrame,
        description: input.userContext.goalDescription,
        confidence: 0.9,
      };

      const delta = await this.calculateDelta(visualState, goalState);
      debug.deltaTime = Date.now() - deltaTimeStart;

      // Step 2: Generate action sequence
      const generationTimeStart = Date.now();
      const plan = await this.generateActions(delta, input.userContext);
      debug.generationTime = Date.now() - generationTimeStart;

      // Step 3: Validate plan
      const validationTimeStart = Date.now();
      const validation = await this.validatePlan(plan, input.userContext);
      debug.validationTime = Date.now() - validationTimeStart;

      debug.totalTime = Date.now() - startTime;

      // Determine if approval is required
      const requiresApproval = this.determineApprovalRequired(plan, validation);

      // Determine next node
      const nextNode = this.determineNextNode(
        plan,
        validation,
        requiresApproval
      );

      return {
        plan,
        validation,
        requiresApproval,
        approvalReason: requiresApproval
          ? this.getApprovalReason(plan, validation)
          : undefined,
        estimatedTime: plan.totalEstimatedTime,
        confidence: plan.confidence,
        nextNode,
        debug: this.config.includeDebugInfo ? debug : undefined,
      };
    } catch (error) {
      debug.totalTime = Date.now() - startTime;

      return {
        plan: this.createEmptyPlan(),
        validation: this.createErrorValidation(error),
        requiresApproval: false,
        estimatedTime: 0,
        confidence: 0,
        nextNode: "error",
        error: error instanceof Error ? error.message : String(error),
        debug: this.config.includeDebugInfo ? debug : undefined,
      };
    }
  }

  /**
   * Convert CoAgents state to planning input
   *
   * @param state - CoAgents state
   * @returns Planning node input
   */
  stateToPlanningInput(state: CoAgentsState): PlanningNodeInput {
    return {
      currentEmbedding: state.currentEmbedding,
      goalEmbedding: state.goalEmbedding,
      userContext: {
        goalDescription: "", // Would be stored in state
        uiContext: "",
        preferences: {},
      },
      sessionMetadata: {
        sessionId: state.sessionMetadata.sessionId,
        userId: state.sessionMetadata.userId,
        previousPlans: state.currentPlan ? [state.currentPlan] : [],
        executionHistory: [], // Would be populated from state
      },
    };
  }

  /**
   * Update CoAgents state from planning output
   *
   * @param state - Current CoAgents state
   * @param output - Planning node output
   * @returns Updated CoAgents state
   */
  updateState(state: CoAgentsState, output: PlanningNodeOutput): CoAgentsState {
    return {
      ...state,
      currentPlan: output.plan,
      planValidation: output.validation,
      approvalStatus: output.requiresApproval ? "pending" : undefined,
      executionStatus: "not_started",
      executedActions: [],
      currentActionIndex: 0,
      sessionMetadata: {
        ...state.sessionMetadata,
        iterations: state.sessionMetadata.iterations + 1,
      },
    };
  }

  /**
   * Create HITL checkpoint
   *
   * @param plan - Plan requiring approval
   * @param validation - Validation report
   * @returns HITL checkpoint
   */
  createCheckpoint(
    plan: ActionSequence,
    validation: ValidationReport
  ): HITLCheckpoint {
    const checkpoint: HITLCheckpoint = {
      id: `checkpoint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "plan_approval",
      plan,
      validation,
      timestamp: Date.now(),
      timeout: this.config.defaultTimeout,
      expired: false,
    };

    this.checkpoints.set(checkpoint.id, checkpoint);

    return checkpoint;
  }

  /**
   * Handle human approval response
   *
   * @param checkpointId - Checkpoint ID
   * @param decision - Human decision
   * @param feedback - Optional feedback
   * @returns Updated state
   */
  async handleApprovalResponse(
    checkpointId: string,
    decision: "approved" | "rejected" | "modified",
    feedback?: string,
    modifiedPlan?: ActionSequence
  ): Promise<CoAgentsState | null> {
    const checkpoint = this.checkpoints.get(checkpointId);

    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    if (checkpoint.expired) {
      throw new Error(`Checkpoint has expired: ${checkpointId}`);
    }

    // Update checkpoint
    checkpoint.decision = decision;
    checkpoint.feedback = feedback;
    checkpoint.modifiedPlan = modifiedPlan;

    // Create state update
    const stateUpdate: Partial<CoAgentsState> = {
      approvalStatus: decision,
      userFeedback: {
        type: decision,
        message: feedback,
        modifiedPlan,
        timestamp: Date.now(),
      },
    };

    if (decision === "approved") {
      stateUpdate.currentPlan = checkpoint.plan;
    } else if (decision === "modified" && modifiedPlan) {
      stateUpdate.currentPlan = modifiedPlan;
    }

    return stateUpdate as CoAgentsState;
  }

  /**
   * Execute next action from plan
   *
   * @param state - Current CoAgents state
   * @returns Updated state after action execution
   */
  async executeNextAction(state: CoAgentsState): Promise<CoAgentsState> {
    if (
      !state.currentPlan ||
      state.currentActionIndex >= state.currentPlan.actions.length
    ) {
      return {
        ...state,
        executionStatus: "completed",
      };
    }

    const action = state.currentPlan.actions[state.currentActionIndex];

    // In a real implementation, this would execute the action
    // For now, we just track it
    const executedActions = [...state.executedActions, action.id];

    return {
      ...state,
      executedActions,
      currentActionIndex: state.currentActionIndex + 1,
      executionStatus: "in_progress",
    };
  }

  /**
   * Determine if approval is required
   */
  private determineApprovalRequired(
    plan: ActionSequence,
    validation: ValidationReport
  ): boolean {
    // Always require if configured
    if (this.config.requireApproval) {
      return true;
    }

    // Require if confidence below threshold
    if (plan.confidence < this.config.approvalThreshold) {
      return true;
    }

    // Require if validation found issues
    if (validation.issues.length > 0) {
      return true;
    }

    // Require if high risk
    if (plan.metadata.risk === "high") {
      return true;
    }

    return false;
  }

  /**
   * Determine next node in graph
   */
  private determineNextNode(
    plan: ActionSequence,
    validation: ValidationReport,
    requiresApproval: boolean
  ): PlanningNodeOutput["nextNode"] {
    if (!validation.valid) {
      return "replan";
    }

    if (requiresApproval) {
      return "human_approval";
    }

    return "execute";
  }

  /**
   * Get approval reason
   */
  private getApprovalReason(
    plan: ActionSequence,
    validation: ValidationReport
  ): string {
    const reasons: string[] = [];

    if (plan.confidence < this.config.approvalThreshold) {
      reasons.push(
        `Plan confidence below threshold: ${plan.confidence.toFixed(2)} < ${this.config.approvalThreshold}`
      );
    }

    if (validation.issues.length > 0) {
      reasons.push(`${validation.issues.length} validation issue(s) found`);
    }

    if (plan.metadata.risk === "high") {
      reasons.push("Plan is marked as high-risk");
    }

    return reasons.join("; ") || "Plan requires human review";
  }

  /**
   * Calculate embedding delta
   */
  private async calculateDelta(
    current: VisualState,
    goal: GoalState
  ): Promise<EmbeddingDelta> {
    // In practice, would use real delta calculator
    // For now, return placeholder
    return {
      current: goal,
      goal,
      vector: new Float32Array(DEFAULT_EMBEDDING_DIM),
      magnitude: 0,
      direction: new Float32Array(DEFAULT_EMBEDDING_DIM),
      semanticChanges: [],
      complexity: 0.5,
      estimatedActions: 5,
      estimatedTime: 1000,
      confidence: 0.8,
    };
  }

  /**
   * Generate actions from delta
   */
  private async generateActions(
    delta: EmbeddingDelta,
    context: any
  ): Promise<ActionSequence> {
    // In practice, would use real action generator
    // For now, return placeholder
    return {
      version: "1.0",
      actions: [],
      totalEstimatedTime: delta.estimatedTime,
      confidence: delta.confidence,
      reasoning: "Placeholder plan",
      alternatives: [],
      metadata: {
        timestamp: Date.now(),
        actionCount: 0,
        primaryChangeType: "unknown",
        complexity: delta.complexity,
        risk: "low",
      },
    };
  }

  /**
   * Validate plan
   */
  private async validatePlan(
    plan: ActionSequence,
    context: any
  ): Promise<ValidationReport> {
    // In practice, would use real validator
    // For now, return placeholder
    return {
      valid: true,
      confidence: plan.confidence,
      issues: [],
      warnings: [],
      suggestions: [],
      metadata: {
        timestamp: Date.now(),
        duration: 0,
        actionCount: plan.actions.length,
        issueCount: 0,
        warningCount: 0,
      },
    };
  }

  /**
   * Create empty plan
   */
  private createEmptyPlan(): ActionSequence {
    return {
      version: "1.0",
      actions: [],
      totalEstimatedTime: 0,
      confidence: 0,
      reasoning: "",
      alternatives: [],
      metadata: {
        timestamp: Date.now(),
        actionCount: 0,
        primaryChangeType: "unknown",
        complexity: 0,
        risk: "low",
      },
    };
  }

  /**
   * Create error validation
   */
  private createErrorValidation(error: unknown): ValidationReport {
    return {
      valid: false,
      confidence: 0,
      issues: [
        {
          id: "planning-error",
          severity: "critical",
          type: "impossible",
          description: error instanceof Error ? error.message : String(error),
          confidence: 1,
        },
      ],
      warnings: [],
      suggestions: ["Check input parameters and try again"],
      metadata: {
        timestamp: Date.now(),
        duration: 0,
        actionCount: 0,
        issueCount: 1,
        warningCount: 0,
      },
    };
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(checkpointId: string): HITLCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }

  /**
   * Get all active checkpoints
   */
  getActiveCheckpoints(): HITLCheckpoint[] {
    return Array.from(this.checkpoints.values()).filter(c => !c.expired);
  }

  /**
   * Clear expired checkpoints
   */
  clearExpiredCheckpoints(): void {
    const now = Date.now();

    for (const [id, checkpoint] of this.checkpoints.entries()) {
      if (
        checkpoint.timeout &&
        now - checkpoint.timestamp > checkpoint.timeout
      ) {
        checkpoint.expired = true;
      }

      if (checkpoint.expired) {
        this.checkpoints.delete(id);
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): BridgeConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create CoAgents planner bridge with default config
 */
export function createCoAgentsPlannerBridge(
  config?: Partial<BridgeConfig>,
  dependencies?: {
    deltaCalculator?: any;
    actionGenerator?: any;
    planValidator?: any;
  }
): CoAgentsPlannerBridge {
  return new CoAgentsPlannerBridge(config, dependencies);
}

/**
 * Initialize CoAgents state for planning
 */
export function initializeCoAgentsState(
  currentEmbedding: Float32Array,
  goalEmbedding: Float32Array,
  sessionId?: string
): CoAgentsState {
  return {
    currentEmbedding,
    goalEmbedding,
    executedActions: [],
    currentActionIndex: 0,
    sessionMetadata: {
      sessionId: sessionId || `session-${Date.now()}`,
      startTime: Date.now(),
      iterations: 0,
    },
  };
}
