/**
 * @lsi/progressive-render - Progressive Rendering Types
 *
 * Core types for streaming A2UI updates incrementally via SSE
 *
 * @version 1.0.0
 * @license Apache-2.0
 */

import type { A2UIComponent, A2UILayout } from "@lsi/protocol";

// ============================================================================
// RENDER PHASE TYPES
// ============================================================================

/**
 * Render phases for progressive rendering
 *
 * Phases represent the stages of rendering for a component or chunk:
 * - skeleton: Initial placeholder structure shown immediately
 * - content: Actual content being streamed in
 * - interactive: Component becomes interactive/functional
 * - complete: All content loaded and ready
 */
export type RenderPhase = "skeleton" | "content" | "interactive" | "complete";

/**
 * Render strategy for how chunks are delivered
 *
 * - top-down: Render from root to leaves (parent before children)
 * - critical-first: Above-the-fold/important content first
 * - lazy: Load on-demand based on viewport/interaction
 * - streaming: Continuous stream as data becomes available
 */
export type RenderStrategy =
  | "top-down"
  | "critical-first"
  | "lazy"
  | "streaming";

/**
 * Progressive chunk - unit of rendering for streaming
 *
 * A chunk represents a portion of UI that can be rendered independently.
 * Chunks have phases, priority, and can be updated incrementally.
 */
export interface ProgressiveChunk {
  /** Unique chunk identifier */
  chunk_id: string;
  /** Current render phase */
  phase: RenderPhase;
  /** Chunk content (component, layout, or data) */
  content: ChunkContent;
  /** Priority (0-100, higher = more important) */
  priority: number;
  /** Parent chunk ID (if nested) */
  parent_id?: string;
  /** Child chunk IDs */
  child_ids?: string[];
  /** Estimated size in bytes */
  size_bytes?: number;
  /** Timestamp when chunk was created */
  created_at: Date;
  /** Timestamp when chunk was last updated */
  updated_at: Date;
  /** Metadata about the chunk */
  metadata: ChunkMetadata;
  /** Whether chunk is critical for above-the-fold rendering */
  critical: boolean;
  /** Dependencies (other chunks required before this can render) */
  dependencies?: string[];
  /** Component ID this chunk belongs to */
  component_id?: string;
}

/**
 * Chunk content types
 */
export type ChunkContent =
  | { type: "component"; data: A2UIComponent }
  | { type: "layout"; data: A2UILayout }
  | { type: "data"; data: Record<string, unknown> }
  | { type: "text"; data: string }
  | { type: "html"; data: string }
  | { type: "skeleton"; data: SkeletonConfig }
  | { type: "placeholder"; data: PlaceholderConfig };

/**
 * Chunk metadata
 */
export interface ChunkMetadata {
  /** Source of this chunk (agent, cache, generated) */
  source: "agent" | "cache" | "generated" | "stream";
  /** Render strategy used */
  strategy: RenderStrategy;
  /** Content type hint */
  content_type?: string;
  /** Compression hint */
  compression?: "gzip" | "br" | "none";
  /** Encoding */
  encoding?: "utf-8" | "ascii";
  /** Cache key */
  cache_key?: string;
  /** TTL for cache */
  cache_ttl?: number;
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Skeleton configuration for placeholder rendering
 */
export interface SkeletonConfig {
  /** Structure type */
  type: "text" | "circle" | "rect" | "custom";
  /** Width (CSS value) */
  width?: string | number;
  /** Height (CSS value) */
  height?: string | number;
  /** Number of lines to show */
  lines?: number;
  /** Animation type */
  animation?: "pulse" | "wave" | "shimmer" | "none";
  /** Border radius */
  radius?: string | number;
  /** Custom CSS class */
  className?: string;
}

/**
 * Placeholder configuration
 */
export interface PlaceholderConfig {
  /** Placeholder type */
  type: "spinner" | "dots" | "bar" | "custom";
  /** Message to show */
  message?: string;
  /** Size */
  size?: "small" | "medium" | "large";
  /** Custom CSS class */
  className?: string;
}

// ============================================================================
// UI UPDATE TYPES
// ============================================================================

/**
 * Patch types for diff-based updates
 */
export type PatchType =
  | "add"
  | "replace"
  | "remove"
  | "move"
  | "update"
  | "reorder";

/**
 * UI Update - atomic change to UI
 *
 * Updates represent minimal changes to apply to the UI.
 * Used by the diff engine to minimize data transfer.
 */
export interface UIUpdate {
  /** Unique update identifier */
  update_id: string;
  /** Component being updated */
  component_id: string;
  /** Patch type */
  patch_type: PatchType;
  /** Update data */
  data: UpdateData;
  /** Path to the element being updated (dot notation) */
  path?: string;
  /** Old value (for rollback) */
  old_value?: unknown;
  /** New value */
  new_value?: unknown;
  /** Update metadata */
  metadata: UpdateMetadata;
}

/**
 * Update data types based on patch type
 */
export type UpdateData =
  | { type: "add"; element: A2UIComponent; position?: number }
  | { type: "replace"; element: A2UIComponent }
  | { type: "remove"; element_id: string }
  | {
      type: "move";
      element_id: string;
      new_position: number;
      new_parent?: string;
    }
  | { type: "update"; prop: string; value: unknown }
  | { type: "reorder"; order: string[] };

/**
 * Update metadata
 */
export interface UpdateMetadata {
  /** Timestamp when update was generated */
  timestamp: Date;
  /** Source of update */
  source: "diff" | "agent" | "user" | "stream";
  /** Priority */
  priority: number;
  /** Whether update is batched */
  batched: boolean;
  /** Batch ID if part of a batch */
  batch_id?: string;
}

/**
 * Batched updates
 */
export interface UpdateBatch {
  /** Batch identifier */
  batch_id: string;
  /** Updates in this batch */
  updates: UIUpdate[];
  /** Timestamp */
  timestamp: Date;
  /** Total size in bytes */
  size_bytes: number;
}

// ============================================================================
// RENDER STATS TYPES
// ============================================================================

/**
 * Render statistics for a component or session
 */
export interface RenderStats {
  /** Component/session ID */
  component_id: string;
  /** When rendering started */
  start_time: Date;
  /** When rendering completed (null if ongoing) */
  end_time?: Date | null;
  /** Phases completed */
  phases_completed: RenderPhase[];
  /** Current phase */
  current_phase: RenderPhase;
  /** Total bytes sent */
  bytes_sent: number;
  /** Number of chunks sent */
  chunks_sent: number;
  /** Number of chunks remaining */
  chunks_remaining: number;
  /** Current FPS (frames per second) */
  fps: number;
  /** Average FPS */
  avg_fps: number;
  /** Time to first byte (ms) */
  ttfb: number;
  /** Time to interactive (ms) */
  tti: number;
  /** Total render time (ms) */
  total_time: number;
  /** Percentage complete (0-100) */
  progress: number;
  /** Number of errors encountered */
  errors: number;
  /** Warnings count */
  warnings: number;
  /** Strategy used */
  strategy: RenderStrategy;
}

/**
 * Performance metrics for monitoring
 */
export interface PerformanceMetrics {
  /** Memory usage (bytes) */
  memory_usage: number;
  /** CPU usage (percentage) */
  cpu_usage: number;
  /** Network bandwidth (bytes/second) */
  bandwidth: number;
  /** Latency (ms) */
  latency: number;
  /** Chunk processing rate (chunks/second) */
  chunk_rate: number;
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

/**
 * SSE event types for progressive rendering
 */
export type SSEEventType =
  | "chunk"
  | "update"
  | "phase"
  | "complete"
  | "error"
  | "heartbeat"
  | "progress";

/**
 * SSE event format
 */
export interface SSEEvent {
  /** Event type */
  event: SSEEventType;
  /** Event ID (for reconnection) */
  id?: string;
  /** Event data */
  data: SSEEventData;
  /** Retry delay (ms) */
  retry?: number;
}

/**
 * SSE event data based on event type
 */
export type SSEEventData =
  | { type: "chunk"; chunk: ProgressiveChunk }
  | { type: "update"; update: UIUpdate }
  | { type: "phase"; component_id: string; phase: RenderPhase }
  | { type: "complete"; component_id: string; stats: RenderStats }
  | { type: "error"; error: RenderError }
  | { type: "heartbeat"; timestamp: Date }
  | { type: "progress"; component_id: string; progress: number };

/**
 * Render error
 */
export interface RenderError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Component ID where error occurred */
  component_id?: string;
  /** Chunk ID where error occurred */
  chunk_id?: string;
  /** Stack trace */
  stack?: string;
  /** Timestamp */
  timestamp: Date;
  /** Whether error is fatal */
  fatal: boolean;
}

// ============================================================================
// FLOW CONTROL TYPES
// ============================================================================

/**
 * Flow control state
 */
export interface FlowControlState {
  /** Current backpressure level (0-1) */
  backpressure: number;
  /** Buffer size (bytes) */
  buffer_size: number;
  /** Buffer capacity (bytes) */
  buffer_capacity: number;
  /** Whether flow control is active */
  active: boolean;
  /** Throttled state */
  throttled: boolean;
  /** Paused state */
  paused: boolean;
}

/**
 * Flow control options
 */
export interface FlowControlOptions {
  /** Maximum buffer size (bytes) */
  max_buffer_size: number;
  /** Backpressure threshold (0-1) */
  backpressure_threshold: number;
  /** Whether to enable auto-throttling */
  auto_throttle: boolean;
  /** Throttle delay (ms) */
  throttle_delay: number;
}

// ============================================================================
// SCHEDULER TYPES
// ============================================================================

/**
 * Chunk priority level
 */
export type ChunkPriority =
  | "critical"
  | "high"
  | "normal"
  | "low"
  | "background";

/**
 * Schedule options
 */
export interface ScheduleOptions {
  /** Render strategy */
  strategy: RenderStrategy;
  /** Priority calculation method */
  priority_method: "static" | "dynamic" | "ml";
  /** Bandwidth-aware scheduling */
  bandwidth_aware: boolean;
  /** Predictive pre-rendering */
  predictive: boolean;
  /** Maximum concurrent chunks */
  max_concurrent: number;
}

/**
 * Scheduled chunk
 */
export interface ScheduledChunk {
  /** The chunk */
  chunk: ProgressiveChunk;
  /** Scheduled time */
  scheduled_at: Date;
  /** Expected render time */
  expected_render_time: Date;
  /** Priority score */
  priority_score: number;
}

// ============================================================================
// REACT INTEGRATION TYPES
// ============================================================================

/**
 * Progressive render options for React
 */
export interface ProgressiveRenderOptions {
  /** Component ID */
  componentId: string;
  /** Render strategy */
  strategy?: RenderStrategy;
  /** Whether to show skeleton */
  showSkeleton?: boolean;
  /** Custom skeleton config */
  skeletonConfig?: SkeletonConfig;
  /** Error fallback */
  errorFallback?: React.ComponentType<{ error: Error }>;
  /** Loading indicator */
  loadingIndicator?: React.ComponentType;
  /** On complete callback */
  onComplete?: (stats: RenderStats) => void;
  /** On error callback */
  onError?: (error: RenderError) => void;
  /** On phase change callback */
  onPhaseChange?: (phase: RenderPhase) => void;
}

/**
 * Progressive render context
 */
export interface ProgressiveRenderContext {
  /** Component ID */
  componentId: string;
  /** Current phase */
  phase: RenderPhase;
  /** Render stats */
  stats: RenderStats;
  /** Start rendering */
  start: () => void;
  /** Pause rendering */
  pause: () => void;
  /** Resume rendering */
  resume: () => void;
  /** Abort rendering */
  abort: () => void;
}

/**
 * Use progressive render hook return
 */
export interface UseProgressiveRenderReturn {
  /** Current phase */
  phase: RenderPhase;
  /** Progress percentage (0-100) */
  progress: number;
  /** Render stats */
  stats: RenderStats | null;
  /** Whether loading */
  loading: boolean;
  /** Error if any */
  error: RenderError | null;
  /** Start rendering */
  start: () => void;
  /** Pause rendering */
  pause: () => void;
  /** Resume rendering */
  resume: () => void;
  /** Abort rendering */
  abort: () => void;
}

// ============================================================================
// DIFF ENGINE TYPES
// ============================================================================

/**
 * Diff result
 */
export interface DiffResult {
  /** Updates to apply */
  updates: UIUpdate[];
  /** Number of additions */
  additions: number;
  /** Number of removals */
  removals: number;
  /** Number of replacements */
  replacements: number;
  /** Number of moves */
  moves: number;
  /** Number of updates */
  updates: number;
  /** Total changes */
  total_changes: number;
  /** Similarity score (0-1) */
  similarity: number;
  /** Time to compute diff (ms) */
  compute_time: number;
}

/**
 * Diff options
 */
export interface DiffOptions {
  /** Whether to batch updates */
  batch: boolean;
  /** Maximum batch size */
  max_batch_size: number;
  /** Whether to compute moves */
  compute_moves: boolean;
  /** Move distance threshold */
  move_threshold: number;
  /** Similarity threshold for considering unchanged */
  similarity_threshold: number;
}

// ============================================================================
// RECONCILIATION TYPES
// ============================================================================

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  /** UI updates to apply */
  updates: UIUpdate[];
  /** Components to unmount */
  unmount: string[];
  /** Components to mount */
  mount: A2UIComponent[];
  /** Whether reconciliation was successful */
  success: boolean;
  /** Reconciliation time (ms) */
  time: number;
}

/**
 * Virtual node for diffing
 */
export interface VirtualNode {
  /** Node type */
  type: string;
  /** Node key/ID */
  key: string;
  /** Props */
  props: Record<string, unknown>;
  /** Children */
  children: VirtualNode[];
  /** Node version (for optimistic updates) */
  version: number;
}

// ============================================================================
// VISUAL FEEDBACK TYPES
// ============================================================================

/**
 * Visual effect types
 */
export type VisualEffectType =
  | "fade-in"
  | "fade-out"
  | "slide-in"
  | "slide-out"
  | "scale"
  | "shimmer"
  | "pulse"
  | "spin";

/**
 * Visual effect configuration
 */
export interface VisualEffect {
  /** Effect type */
  type: VisualEffectType;
  /** Duration (ms) */
  duration: number;
  /** Delay (ms) */
  delay: number;
  /** Easing function */
  easing: string;
  /** CSS class to apply */
  className?: string;
}

/**
 * Visual feedback state
 */
export interface VisualFeedbackState {
  /** Current effect */
  effect: VisualEffect | null;
  /** Whether showing feedback */
  showing: boolean;
  /** Progress (0-1) */
  progress: number;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  // Render phase types
  RenderPhase,
  RenderStrategy,
  ProgressiveChunk,
  ChunkContent,
  ChunkMetadata,
  SkeletonConfig,
  PlaceholderConfig,
  // UI update types
  PatchType,
  UIUpdate,
  UpdateData,
  UpdateMetadata,
  UpdateBatch,
  // Render stats types
  RenderStats,
  PerformanceMetrics,
  // Streaming types
  SSEEventType,
  SSEEvent,
  SSEEventData,
  RenderError,
  // Flow control types
  FlowControlState,
  FlowControlOptions,
  // Scheduler types
  ChunkPriority,
  ScheduleOptions,
  ScheduledChunk,
  // React integration types
  ProgressiveRenderOptions,
  ProgressiveRenderContext,
  UseProgressiveRenderReturn,
  // Diff engine types
  DiffResult,
  DiffOptions,
  // Reconciliation types
  ReconciliationResult,
  VirtualNode,
  // Visual feedback types
  VisualEffectType,
  VisualEffect,
  VisualFeedbackState,
};
