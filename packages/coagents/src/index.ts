/**
 * @fileoverview CoAgents package exports
 */

// Providers
export {
  CoagentsProvider,
  SharedStateContext,
  useSharedStateManager,
} from "./providers/CoagentsProvider.js";

// Adapters
export { LangGraphAdapter } from "./adapters/LangGraphAdapter.js";

// State
export { SharedStateManager } from "./state/SharedStateManager.js";
export type {
  AgentState,
  AgentConfig,
  AgentAction,
  CheckpointConfig,
  CheckpointResult,
  HumanInput,
} from "./state/SharedStateManager.js";

// Hooks
export {
  useAgentState,
  useOptimisticState,
  useAgentAction,
  useCheckpoint,
  useAgentStateChange,
  useAgentHistory,
} from "./hooks/useSharedState.js";

export {
  useAgentById,
  useAgentList,
  useNewAgent,
} from "./hooks/useAgentState.js";

// Checkpoints
export {
  CheckpointManager,
  createAequorCheckpoints,
} from "./checkpoints/CheckpointManager.js";
export { CheckpointUI, CheckpointToast } from "./checkpoints/CheckpointUI.js";
export type { CheckpointUIProps } from "./checkpoints/CheckpointUI.js";

// Hybrid
export {
  StateToA2UIConverter,
  createConverter,
  CoAgentsA2UIProvider,
  useHybridA2UI,
} from "./hybrid/index.js";

// ============================================================================
// VL-JEPA BRIDGE EXPORTS
// ============================================================================

// VL-JEPA Bridge
export { VLJEPABridge, createVLJEPABridge } from "./state/VLJEPABridge.js";
export type {
  VLJEPABridgeState,
  VisualState,
  EmbeddingState,
  VLJEPAAgentState,
  VisualUIElement,
  VLJEPAActionHistoryEntry,
} from "./state/VLJEPABridge.js";

// Embedding State
export {
  EmbeddingStateManager,
  createEmbeddingStateManager,
} from "./state/EmbeddingState.js";
export type {
  EmbeddingVector,
  EmbeddingSimilarityMatrix,
  EmbeddingStateHistory,
  EmbeddingHistoryEntry,
  EmbeddingStateConfig,
} from "./state/EmbeddingState.js";

// Visual State
export {
  VisualStateManager,
  createVisualStateManager,
} from "./state/VisualState.js";
export type {
  VisualUIElement as FullVisualUIElement,
  VisualFeatures,
  UIElementType,
  BoundingBox,
  UIStyles,
  InteractionType,
  ColorInfo,
  LayoutInfo,
  LayoutType,
  GridInfo,
  FlexInfo,
  AbsoluteInfo,
  SpacingInfo,
  TypographyInfo,
  VisualHierarchy,
  HierarchyNode,
  FocusPoint,
  ComponentInfo,
  ComponentType,
  VisualStateConfig,
} from "./state/VisualState.js";

// Combined Agent State
export {
  VLJEPAAgentStateManager,
  createVLJEPAAgentStateManager,
  serializeAgentState,
  deserializeAgentState,
  createStateDiff,
  validateAgentState,
} from "./state/VLJEPAAgentState.js";
export type {
  VLJEPAAgentState as FullVLJEPAAgentState,
  VisualContext,
  FrameChange,
  UserPreferences,
} from "./state/VLJEPAAgentState.js";

// ============================================================================
// LANGGRAPH EXPORTS
// ============================================================================

// VL-JEPA Node
export {
  VLJEPANode,
  createVLJEPANode,
  createVLJEPANodeHandler,
} from "./langgraph/VLJEPANode.js";
export type {
  VLJEPANodeConfig,
  VLJEPANodeInput,
  VLJEPANodeOutput,
} from "./langgraph/VLJEPANode.js";

// Visual Reasoning Node
export {
  VisualReasoningNode,
  createVisualReasoningNode,
  createVisualReasoningNodeHandler,
} from "./langgraph/VisualReasoningNode.js";
export type {
  VisualReasoningResult,
  VisualInsight,
  VisualPattern,
  DesignRecommendation,
  AccessibilityIssue,
  UXConcern,
  VisualReasoningNodeConfig,
} from "./langgraph/VisualReasoningNode.js";

// Complete Graph
export {
  VLJEPAGraph,
  createVLJEPAGraph,
} from "./langgraph/graphs/VLJEPAGraph.js";
export type {
  VLJEPAGraphConfig,
  VLJEPAGraphInput,
  VLJEPAGraphOutput,
  CheckpointResult as VLJEPACheckpointResult,
} from "./langgraph/graphs/VLJEPAGraph.js";

// ============================================================================
// CHECKPOINT EXPORTS
// ============================================================================

// HITL Checkpoint Manager
export {
  HITLCheckpointManager,
  createHITLCheckpointManager,
} from "./checkpoints/HITLCheckpoint.js";
export type {
  HITLCheckpointConfig,
  CheckpointType,
  CheckpointStatus,
  VisualDiffData,
  DiffHighlight,
  HITLCheckpointManagerConfig,
  CheckpointFilterOptions,
} from "./checkpoints/HITLCheckpoint.js";

// Visual Approval Manager
export {
  VisualApprovalManager,
  createVisualApprovalManager,
} from "./checkpoints/VisualApproval.js";
export type {
  VisualApprovalState,
  VisualStateSnapshot,
  UserSelection,
  VisualApprovalOptions,
  VisualApprovalHistoryEntry,
} from "./checkpoints/VisualApproval.js";

// ============================================================================
// ORIGINAL EXPORTS (Preserved for backwards compatibility)
// ============================================================================

// Types
export type {
  LangGraphNode,
  LangGraphEdge,
  CompiledGraph,
  LangGraphAdapterConfig,
} from "./adapters/LangGraphAdapter.js";
export type { StateManagerConfig } from "./state/SharedStateManager.js";
export type {
  CheckpointManagerConfig,
  ActiveCheckpoint,
  CheckpointStatus,
} from "./checkpoints/CheckpointManager.js";
export type { ConverterConfig, HybridProviderConfig } from "./hybrid/index.js";
