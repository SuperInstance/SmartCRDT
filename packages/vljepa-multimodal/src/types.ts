/**
 * @lsi/vljepa-multimodal - Core type definitions
 *
 * Multi-modal state management for VL-JEPA combining text, visual,
 * and embedding modalities with unified state representation.
 */

// ============================================================================
// CORE STATE TYPES
// ============================================================================

/**
 * Entity extracted from text
 */
export interface Entity {
  /** Entity text */
  text: string;
  /** Entity type (PERSON, ORG, LOCATION, etc.) */
  type: string;
  /** Position in text */
  start: number;
  end: number;
  /** Confidence score */
  confidence: number;
}

/**
 * Sentiment analysis result
 */
export interface Sentiment {
  /** Sentiment label */
  label: "positive" | "negative" | "neutral";
  /** Confidence score */
  confidence: number;
  /** Raw scores */
  scores: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

/**
 * Text/language state component
 */
export interface TextState {
  /** Input text */
  input: string;
  /** Intent classification */
  intent: string;
  /** Extracted entities */
  entities: Entity[];
  /** Sentiment analysis */
  sentiment: Sentiment;
  /** Text embedding (768-dim from Y-Encoder) */
  embedding: Float32Array;
  /** Timestamp */
  timestamp: number;
}

/**
 * Image frame from UI
 */
export interface ImageFrame {
  /** Frame identifier */
  id: string;
  /** Image data (base64 or buffer) */
  data: Uint8Array | string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Frame timestamp */
  timestamp: number;
}

/**
 * UI component detected in image
 */
export interface UIComponent {
  /** Component type (button, input, text, etc.) */
  type: string;
  /** Bounding box [x, y, width, height] */
  bbox: [number, number, number, number];
  /** Component label/text */
  label: string;
  /** Confidence score */
  confidence: number;
  /** Additional attributes */
  attributes: Record<string, unknown>;
}

/**
 * Layout information from image
 */
export interface LayoutInfo {
  /** Layout type (grid, flex, absolute, etc.) */
  type: string;
  /** Number of columns */
  columns?: number;
  /** Number of rows */
  rows?: number;
  /** Component hierarchy */
  hierarchy: UIComponent[];
  /** Spacing information */
  spacing: {
    horizontal: number;
    vertical: number;
  };
}

/**
 * Visual/image state component
 */
export interface VisualState {
  /** Image frames */
  frames: ImageFrame[];
  /** Detected UI components */
  components: UIComponent[];
  /** Layout information */
  layout: LayoutInfo;
  /** Visual embedding (768-dim from X-Encoder) */
  embedding: Float32Array;
  /** Timestamp */
  timestamp: number;
}

/**
 * Attention map for fusion
 */
export interface AttentionMap {
  /** Attention weights for text */
  text: Map<string, number>;
  /** Attention weights for visual */
  visual: Map<string, number>;
  /** Cross-modal attention */
  crossModal: Map<string, Map<string, number>>;
}

/**
 * Fused multi-modal state
 */
export interface FusedState {
  /** Fused embedding (768-dim) */
  embedding: Float32Array;
  /** Attention weights */
  attention: AttentionMap;
  /** Fusion confidence */
  confidence: number;
  /** Reasoning text */
  reasoning: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * State metadata
 */
export interface StateMetadata {
  /** State identifier */
  id: string;
  /** State version */
  version: number;
  /** Timestamp */
  timestamp: number;
  /** Author/creator */
  author: string;
  /** Tags */
  tags: string[];
  /** Additional metadata */
  properties: Record<string, unknown>;
}

// ============================================================================
// MULTI-MODAL STATE
// ============================================================================

/**
 * Unified multi-modal state combining all modalities
 */
export interface MultiModalState {
  /** State identifier */
  id: string;
  /** State version */
  version: number;
  /** Creation timestamp */
  timestamp: number;
  /** Last modified timestamp */
  modified: number;

  // Modalities
  /** Text/language state */
  text: TextState;
  /** Visual/image state */
  visual: VisualState;
  /** Combined embedding state */
  embedding: EmbeddingState;
  /** Fused multi-modal state */
  fused: FusedState;

  // Metadata
  /** State metadata */
  metadata: StateMetadata;
  /** Overall confidence */
  confidence: number;
}

/**
 * Embedding state (unified representation)
 */
export interface EmbeddingState {
  /** Combined embedding vector (768-dim) */
  vector: Float32Array;
  /** Text embedding contribution */
  textContribution: Float32Array;
  /** Visual embedding contribution */
  visualContribution: Float32Array;
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// FUSION TYPES
// ============================================================================

/**
 * Fusion strategy type
 */
export type FusionStrategy = "concat" | "attention" | "transformer" | "gating";

/**
 * Fusion configuration
 */
export interface FusionConfig {
  /** Fusion strategy */
  strategy: FusionStrategy;
  /** Output dimension (default: 768) */
  outputDim: number;
  /** Number of attention heads (for attention/transformer) */
  numHeads?: number;
  /** Number of transformer layers */
  numLayers?: number;
  /** Dropout rate */
  dropout?: number;
  /** Whether to normalize */
  normalize?: boolean;
}

/**
 * Fusion metadata
 */
export interface FusionMetadata {
  /** Strategy used */
  strategy: FusionStrategy;
  /** Fusion duration (ms) */
  duration: number;
  /** Input dimensions */
  inputDims: {
    text: number;
    visual: number;
  };
  /** Model info */
  model?: string;
}

/**
 * Fusion result
 */
export interface FusionResult {
  /** Fused embedding (768-dim) */
  embedding: Float32Array;
  /** Attention weights by modality */
  attentionWeights: Map<string, number>;
  /** Fusion confidence */
  confidence: number;
  /** Fusion metadata */
  metadata: FusionMetadata;
}

// ============================================================================
// SYNCHRONIZATION TYPES
// ============================================================================

/**
 * Sync strategy type
 */
export type SyncStrategy = "event" | "polling" | "optimistic" | "pessimistic";

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = "last_write_wins" | "merge" | "manual";

/**
 * Synchronization configuration
 */
export interface SyncConfig {
  /** Sync strategy */
  strategy: SyncStrategy;
  /** Poll interval in ms (for polling strategy) */
  pollInterval?: number;
  /** Conflict resolution strategy */
  conflictResolution: ConflictResolution;
  /** Timeout for sync operations (ms) */
  timeout?: number;
  /** Maximum retries */
  maxRetries?: number;
}

/**
 * Conflict between state updates
 */
export interface Conflict {
  /** Conflict identifier */
  id: string;
  /** Conflicting field path */
  field: string;
  /** Local value */
  localValue: unknown;
  /** Remote value */
  remoteValue: unknown;
  /** Conflict timestamp */
  timestamp: number;
  /** Conflict severity */
  severity: "low" | "medium" | "high";
}

/**
 * Resolution applied to a conflict
 */
export interface Resolution {
  /** Conflict ID */
  conflictId: string;
  /** Resolution strategy used */
  strategy: ConflictResolution;
  /** Resolved value */
  value: unknown;
  /** Resolution timestamp */
  timestamp: number;
  /** Who resolved it */
  resolvedBy: "system" | "user";
}

/**
 * Synchronization result
 */
export interface SyncResult {
  /** Whether sync was successful */
  synced: boolean;
  /** Conflicts detected */
  conflicts: Conflict[];
  /** Resolutions applied */
  resolution: Resolution[];
  /** Sync duration (ms) */
  duration: number;
  /** Error if failed */
  error?: string;
}

// ============================================================================
// HISTORY TYPES
// ============================================================================

/**
 * State snapshot for history
 */
export interface StateSnapshot {
  /** Snapshot state */
  state: MultiModalState;
  /** Snapshot timestamp */
  timestamp: number;
  /** Snapshot author */
  author: string;
  /** Snapshot description */
  description: string;
  /** Snapshot ID */
  id: string;
}

/**
 * Branch for parallel state versions
 */
export interface Branch {
  /** Branch identifier */
  id: string;
  /** Branch name */
  name: string;
  /** Parent branch ID (null for root) */
  parent: string | null;
  /** Snapshots in this branch */
  snapshots: StateSnapshot[];
  /** Created timestamp */
  created: number;
  /** Last modified */
  modified: number;
  /** Is active branch */
  active: boolean;
}

/**
 * State history with time travel
 */
export interface StateHistory {
  /** Current state */
  current: MultiModalState;
  /** Past states (for undo) */
  past: StateSnapshot[];
  /** Future states (for redo) */
  future: StateSnapshot[];
  /** Branches */
  branches: Branch[];
  /** Current branch ID */
  currentBranch: string;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

/**
 * Similarity metric type
 */
export type SimilarityMetric = "cosine" | "euclidean" | "dot";

/**
 * Modality type for queries
 */
export type ModalityType = "text" | "visual" | "embedding" | "fused";

/**
 * Query configuration
 */
export interface QueryConfig {
  /** Modalities to search */
  modalities: ModalityType[];
  /** Similarity metric */
  similarity: SimilarityMetric;
  /** Similarity threshold */
  threshold: number;
  /** Maximum results */
  limit: number;
  /** Whether to use hybrid search */
  hybrid?: boolean;
  /** Text query weight (for hybrid) */
  textWeight?: number;
  /** Visual query weight (for hybrid) */
  visualWeight?: number;
}

/**
 * Query match result
 */
export interface Match {
  /** Matched state */
  state: MultiModalState;
  /** Similarity score */
  similarity: number;
  /** Matched modality */
  modality: ModalityType;
  /** Match highlights */
  highlights?: string[];
}

/**
 * Query metadata
 */
export interface QueryMetadata {
  /** Query duration (ms) */
  duration: number;
  /** Number of states searched */
  searched: number;
  /** Number of results */
  results: number;
  /** Query timestamp */
  timestamp: number;
}

/**
 * Query result
 */
export interface QueryResult {
  /** Matches found */
  matches: Match[];
  /** Similarity scores */
  similarity: number[];
  /** Query metadata */
  metadata: QueryMetadata;
}

// ============================================================================
// SERIALIZATION TYPES
// ============================================================================

/**
 * Serialization format
 */
export type SerializationFormat = "json" | "binary" | "messagepack";

/**
 * Serialization options
 */
export interface SerializationOptions {
  /** Format to use */
  format: SerializationFormat;
  /** Whether to compress */
  compress?: boolean;
  /** Compression level (0-9) */
  compressionLevel?: number;
  /** Whether to include embeddings */
  includeEmbeddings?: boolean;
  /** Whether to include metadata */
  includeMetadata?: boolean;
}

/**
 * Serialization result
 */
export interface SerializationResult {
  /** Serialized data */
  data: Uint8Array | string;
  /** Size in bytes */
  size: number;
  /** Compression ratio */
  compressionRatio?: number;
  /** Serialization duration (ms) */
  duration: number;
}

// ============================================================================
// INDEXING TYPES
// ============================================================================

/**
 * Index configuration
 */
export interface IndexConfig {
  /** Index type */
  type: "vector" | "hybrid" | "full-text";
  /** Vector dimension */
  dimension?: number;
  /** Index metric */
  metric?: SimilarityMetric;
  /** Whether to build quantized index */
  quantized?: boolean;
  /** Number of neighbors for HNSW */
  M?: number;
  /** HNSW efConstruction */
  efConstruction?: number;
}

/**
 * Index statistics
 */
export interface IndexStats {
  /** Number of items indexed */
  count: number;
  /** Index size in bytes */
  size: number;
  /** Index build time (ms) */
  buildTime: number;
  /** Average query time (ms) */
  avgQueryTime: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * State change event
 */
export interface StateChangeEvent {
  /** Event type */
  type: "create" | "update" | "delete" | "merge";
  /** State ID */
  stateId: string;
  /** Previous state (for updates) */
  previous?: MultiModalState;
  /** New state */
  current?: MultiModalState;
  /** Changed fields */
  changedFields: string[];
  /** Event timestamp */
  timestamp: number;
}

/**
 * State change listener
 */
export type StateChangeListener = (
  event: StateChangeEvent
) => void | Promise<void>;

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Multi-modal state error
 */
export class MultiModalStateError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "MultiModalStateError";
  }
}

/**
 * Fusion error
 */
export class FusionError extends MultiModalStateError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "FUSION_ERROR", details);
    this.name = "FusionError";
  }
}

/**
 * Sync error
 */
export class SyncError extends MultiModalStateError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SYNC_ERROR", details);
    this.name = "SyncError";
  }
}

/**
 * Query error
 */
export class QueryError extends MultiModalStateError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "QUERY_ERROR", details);
    this.name = "QueryError";
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Deep partial type for updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * State update type
 */
export type StateUpdate = DeepPartial<MultiModalState>;

/**
 * Diff result between two states
 */
export interface StateDiff {
  /** Added fields */
  added: string[];
  /** Removed fields */
  removed: string[];
  /** Modified fields */
  modified: string[];
  /** Field-level changes */
  changes: Map<string, { oldValue: unknown; newValue: unknown }>;
}
