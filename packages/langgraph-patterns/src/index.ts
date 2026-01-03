/**
 * @fileoverview LangGraph Advanced Patterns Package Exports
 *
 * Provides advanced graph patterns for complex multi-agent workflows.
 * Includes sequential, parallel, conditional, recursive, hierarchical,
 * and dynamic patterns with full LangGraph, CoAgents, VL-JEPA, and A2UI integration.
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Core Pattern Types
  GraphPattern,
  NodeType,
  AgentNode,
  AgentConfig,
  EdgeConnection,
  EdgeCondition,
  GraphConfig,
  RetryPolicy,
  FallbackStrategy,
  CheckpointConfig,
  GraphState,
  ExecutionError,
  ExecutionMetadata,
  ExecutionStatus,
  ExecutionResult,
  ExecutionMetrics,
  ExecutionTrace,
  TraceEntry,
  GraphTopology,
  PartialResult,

  // Pattern-Specific Types
  SequentialPatternConfig,
  ParallelPatternConfig,
  MergeStrategy,
  ConditionalPatternConfig,
  ConditionalRoute,
  RecursivePatternConfig,
  HierarchicalPatternConfig,
  HierarchyRelationship,
  BubbleStrategy,
  DynamicPatternConfig,
  ModificationRule,
  ModificationTrigger,
  ModificationAction,

  // Pattern Composer Types
  PatternComposition,
  ComposedPattern,
  GraphPatternInstance,
  CompositionPosition,
  CompositionConfig,

  // Integration Types
  LangGraphIntegration,
  CoAgentsIntegration,
  VLJEPAIntegration,
  A2UIIntegration,
} from "./types.js";

// ============================================================================
// DEFAULT CONFIGS EXPORT
// ============================================================================

export {
  DEFAULT_GRAPH_CONFIG,
  PRODUCTION_GRAPH_CONFIG,
  MINIMAL_GRAPH_CONFIG,
  DEFAULT_RETRY_POLICY,
} from "./types.js";

// ============================================================================
// VALIDATION FUNCTIONS EXPORT
// ============================================================================

export {
  validateAgentNode,
  validateEdgeConnection,
  validateGraphConfig,
  validateExecutionResult,
} from "./types.js";

// ============================================================================
// PATTERN EXPORTS
// ============================================================================

// Sequential Pattern
export {
  SequentialPattern,
  createSequentialPattern,
  executeSequential,
} from "./patterns/SequentialPattern.js";

// Parallel Pattern
export {
  ParallelPattern,
  createParallelPattern,
  executeParallel,
} from "./patterns/ParallelPattern.js";

// Conditional Pattern
export {
  ConditionalPattern,
  createConditionalPattern,
  executeConditional,
} from "./patterns/ConditionalPattern.js";

// Recursive Pattern
export {
  RecursivePattern,
  createRecursivePattern,
  executeRecursive,
} from "./patterns/RecursivePattern.js";

// Hierarchical Pattern
export {
  HierarchicalPattern,
  createHierarchicalPattern,
  executeHierarchical,
} from "./patterns/HierarchicalPattern.js";

// Dynamic Pattern
export {
  DynamicPattern,
  createDynamicPattern,
  executeDynamic,
} from "./patterns/DynamicPattern.js";

// Pattern Composer
export {
  PatternComposer,
  createPatternComposer,
  composeAndExecute,
} from "./patterns/PatternComposer.js";

// ============================================================================
// INTEGRATION EXPORTS
// ============================================================================

// LangGraph Integration
export {
  LangGraphPatternIntegration,
  createLangGraphPattern,
} from "./integration.js";

// CoAgents Integration
export {
  CoAgentsPatternIntegration,
  createCoAgentsPattern,
} from "./integration.js";

// VL-JEPA Integration
export { VLJEPAPatternIntegration, createVisualNode } from "./integration.js";

// A2UI Integration
export { A2UIPatternIntegration, createUINode } from "./integration.js";

// Unified Integration
export {
  UnifiedPatternIntegration,
  createMultiModalPattern,
  executeMultiModalPattern,
} from "./integration.js";

// ============================================================================
// VERSION
// ============================================================================

export const VERSION = "1.0.0" as const;
