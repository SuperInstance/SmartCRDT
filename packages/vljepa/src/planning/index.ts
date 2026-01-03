/**
 * @lsi/vljepa/planning - Zero-Shot Planning Module
 *
 * Complete zero-shot planning system for "vibe coding" from VL-JEPA embeddings.
 * Enables goal-state planning from visual embeddings.
 *
 * Components:
 * - EmbeddingDeltaCalculator: Calculate difference between states
 * - ActionSequenceGenerator: Generate concrete actions from deltas
 * - WorldModelReasoner: Physical reasoning and prediction
 * - PlanValidator: Validate plans before execution
 * - AdaptivePlanner: Learn from feedback and improve
 * - CoAgentsPlannerBridge: Integration with LangGraph workflows
 *
 * @version 1.0.0
 */

// ============================================================================
// EMBEDDING DELTA CALCULATOR
// ============================================================================

export {
  EmbeddingDeltaCalculator,
  createDeltaCalculator,
  calculateDelta,
} from "./EmbeddingDeltaCalculator.js";

export type {
  VisualState,
  GoalState,
  SemanticChange,
  EmbeddingDelta,
  DimensionAnalysis,
  DeltaCalculatorConfig,
} from "./EmbeddingDeltaCalculator.js";

export { DEFAULT_DELTA_CONFIG } from "./EmbeddingDeltaCalculator.js";

// ============================================================================
// ACTION SEQUENCE GENERATOR
// ============================================================================

export {
  ActionSequenceGenerator,
  createActionSequenceGenerator,
  generateActionSequence,
} from "./ActionSequenceGenerator.js";

export type {
  PlannedAction,
  ActionSequence,
  ActionTemplate,
  PlanningContext,
  PlanningConfig,
} from "./ActionSequenceGenerator.js";

export {
  DEFAULT_PLANNING_CONFIG,
  DEFAULT_ACTION_TEMPLATES,
} from "./ActionSequenceGenerator.js";

// ============================================================================
// WORLD MODEL REASONER
// ============================================================================

export {
  WorldModelReasoner,
  createWorldModelReasoner,
  predictAction,
} from "./WorldModelReasoner.js";

export type {
  SideEffect,
  WorldModelPrediction,
  WorldModelState,
  TransitionRule,
  CausalChain,
  WorldModelConfig,
} from "./WorldModelReasoner.js";

export {
  DEFAULT_WORLD_MODEL_CONFIG,
  DEFAULT_TRANSITION_RULES,
} from "./WorldModelReasoner.js";

// ============================================================================
// PLAN VALIDATOR
// ============================================================================

export {
  PlanValidator,
  createPlanValidator,
  validatePlan,
} from "./PlanValidator.js";

export type {
  ValidationIssue,
  ValidationWarning,
  ValidationReport,
  ValidationRule,
  ValidationContext,
  ValidationConfig,
} from "./PlanValidator.js";

export {
  DEFAULT_VALIDATION_CONFIG,
  DEFAULT_VALIDATION_RULES,
} from "./PlanValidator.js";

// ============================================================================
// ADAPTIVE PLANNER
// ============================================================================

export { AdaptivePlanner, createAdaptivePlanner } from "./AdaptivePlanner.js";

export type {
  ExecutionResult,
  PlanningHistory,
  PerformanceMetrics,
  LearningPattern,
  AdaptiveConfig,
} from "./AdaptivePlanner.js";

export { DEFAULT_ADAPTIVE_CONFIG } from "./AdaptivePlanner.js";

// ============================================================================
// COAGENTS PLANNER BRIDGE
// ============================================================================

export {
  CoAgentsPlannerBridge,
  createCoAgentsPlannerBridge,
  initializeCoAgentsState,
} from "./CoAgentsPlannerBridge.js";

export type {
  PlanningNodeInput,
  PlanningNodeOutput,
  CoAgentsState,
  HITLCheckpoint,
  BridgeConfig,
} from "./CoAgentsPlannerBridge.js";

export { DEFAULT_BRIDGE_CONFIG } from "./CoAgentsPlannerBridge.js";
