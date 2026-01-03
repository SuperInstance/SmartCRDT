/**
 * @fileoverview VL-JEPA Bridge module exports
 */

// Main bridge
export { VLJEPABridge, createVLJEPABridge } from "./VLJEPABridge.js";

// Types
export type {
  VLJEPABridgeState,
  VisualState,
  EmbeddingState,
  VLJEPAAgentState,
  VisualUIElement,
  VLJEPAActionHistoryEntry,
  VLJEPAAction,
} from "./VLJEPABridge.js";

// Embedding state
export {
  EmbeddingStateManager,
  createEmbeddingStateManager,
} from "./EmbeddingState.js";

export type {
  EmbeddingVector,
  EmbeddingSimilarityMatrix,
  EmbeddingStateHistory,
  EmbeddingHistoryEntry,
  EmbeddingStateConfig,
} from "./EmbeddingState.js";

// Visual state
export { VisualStateManager, createVisualStateManager } from "./VisualState.js";

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
} from "./VisualState.js";

// Combined agent state
export {
  VLJEPAAgentStateManager,
  createVLJEPAAgentStateManager,
  serializeAgentState,
  deserializeAgentState,
  createStateDiff,
  validateAgentState,
} from "./VLJEPAAgentState.js";

export type {
  VLJEPAAgentState as FullVLJEPAAgentState,
  VisualContext,
  FrameChange,
  UserPreferences,
} from "./VLJEPAAgentState.js";
