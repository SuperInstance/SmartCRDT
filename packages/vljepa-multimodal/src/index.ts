/**
 * @lsi/vljepa-multimodal - Multi-modal state management for VL-JEPA
 *
 * Unified state management combining text, visual, and embedding
 * modalities with fusion, synchronization, and history tracking.
 */

// Core types
export type * from "./types.js";

// State management
export {
  TextStateManager,
  VisualStateManager,
  EmbeddingStateManager,
  FusedStateManager,
  MultiModalStateManager,
} from "./state/index.js";

// Fusion strategies
export {
  StateFusion,
  ConcatFusion,
  AttentionFusion,
  TransformerFusion,
  GatingFusion,
} from "./fusion/index.js";

// Synchronization
export {
  StateSync,
  ConflictResolver,
  ConsistencyChecker,
} from "./synchronization/index.js";

// History and time travel
export { StateHistory, TimeTravel, BranchManager } from "./history/index.js";

// Query system
export { MultiModalQuery, StateQuery, SemanticQuery } from "./query/index.js";

// Indexing
export { HybridIndex, StateIndex, VectorIndex } from "./indexing/index.js";

// Serialization
export {
  StateSerializer,
  StateDeserializer,
  Compression,
} from "./serialization/index.js";

// Re-export key types
export type {
  MultiModalState,
  TextState,
  VisualState,
  EmbeddingState,
  FusedState,
  FusionConfig,
  FusionResult,
  SyncConfig,
  SyncResult,
  StateSnapshot,
  Branch,
  QueryConfig,
  QueryResult,
} from "./types.js";
