/**
 * @lsi/progressive-render - Progressive Rendering Package
 *
 * Streaming A2UI updates incrementally for Aequor Platform
 *
 * @version 1.0.0
 * @license Apache-2.0
 *
 * This package provides progressive rendering capabilities for A2UI components,
 * enabling incremental streaming of UI updates via Server-Sent Events (SSE).
 *
 * Features:
 * - Progressive rendering with skeleton screens
 * - Chunk-based streaming with priority scheduling
 * - Diff engine for minimal UI updates
 * - React hooks and components
 * - Visual feedback and animations
 * - SSE streaming with flow control
 */

// ============================================================================
// CORE CLASSES
// ============================================================================

export { ProgressiveRenderer } from "./ProgressiveRenderer.js";

export { ChunkScheduler } from "./ChunkScheduler.js";

export { DiffEngine } from "./DiffEngine.js";

export { SSEStreamer } from "./SSEStreamer.js";

// ============================================================================
// A2UI INTEGRATION
// ============================================================================

export { A2UIProgressiveConverter } from "./a2ui.js";

// ============================================================================
// VISUAL FEEDBACK
// ============================================================================

export { VisualFeedbackManager } from "./visual.js";

// ============================================================================
// REACT INTEGRATION
// ============================================================================

export {
  ProgressiveRender,
  ProgressiveSuspense,
  ProgressiveErrorBoundary,
  Skeleton,
  VisualEffectComponent,
  ChunkRenderer,
  useProgressiveRender,
  useSSEStream,
} from "./react.js";

// ============================================================================
// TYPES
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
} from "./types.js";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default render strategy
 */
export const DEFAULT_RENDER_STRATEGY: RenderStrategy = "critical-first";

/**
 * Default chunk priority
 */
export const DEFAULT_CHUNK_PRIORITY = 50;

/**
 * Default skeleton animation
 */
export const DEFAULT_SKELETON_ANIMATION = "shimmer";

/**
 * Default SSE heartbeat interval (ms)
 */
export const DEFAULT_HEARTBEAT_INTERVAL = 30000;

/**
 * Default SSE retry delay (ms)
 */
export const DEFAULT_RETRY_DELAY = 1000;

/**
 * Maximum SSE retry delay (ms)
 */
export const MAX_RETRY_DELAY = 30000;

/**
 * Default flow control options
 */
export const DEFAULT_FLOW_CONTROL: FlowControlOptions = {
  max_buffer_size: 1024 * 1024, // 1MB
  backpressure_threshold: 0.8,
  auto_throttle: true,
  throttle_delay: 100,
};

/**
 * Default schedule options
 */
export const DEFAULT_SCHEDULE_OPTIONS: ScheduleOptions = {
  strategy: "critical-first",
  priority_method: "dynamic",
  bandwidth_aware: true,
  predictive: true,
  max_concurrent: 6,
};

/**
 * Default diff options
 */
export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  batch: true,
  max_batch_size: 50,
  compute_moves: true,
  move_threshold: 10,
  similarity_threshold: 0.8,
};

// Import types for constants
import type {
  RenderStrategy,
  FlowControlOptions,
  ScheduleOptions,
  DiffOptions,
} from "./types.js";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create progressive renderer with default options
 *
 * @param options - Renderer options
 * @returns ProgressiveRenderer instance
 */
export function createRenderer(
  options?: Partial<FlowControlOptions>
): ProgressiveRenderer {
  return new ProgressiveRenderer(options);
}

/**
 * Create chunk scheduler with default options
 *
 * @param options - Scheduler options
 * @returns ChunkScheduler instance
 */
export function createScheduler(
  options?: Partial<ScheduleOptions>
): ChunkScheduler {
  return new ChunkScheduler(options);
}

/**
 * Create diff engine with default options
 *
 * @param options - Diff options
 * @returns DiffEngine instance
 */
export function createDiffEngine(options?: Partial<DiffOptions>): DiffEngine {
  return new DiffEngine(options);
}

/**
 * Create SSE streamer
 *
 * @returns SSEStreamer instance
 */
export function createSSEStreamer(): SSEStreamer {
  return new SSEStreamer();
}

/**
 * Create visual feedback manager
 *
 * @returns VisualFeedbackManager instance
 */
export function createVisualFeedbackManager(): VisualFeedbackManager {
  return new VisualFeedbackManager();
}

/**
 * Create A2UI progressive converter
 *
 * @returns A2UIProgressiveConverter instance
 */
export function createA2UIConverter(): A2UIProgressiveConverter {
  return new A2UIProgressiveConverter();
}

// ============================================================================
// REEXPORTS FOR CONVENIENCE
// ============================================================================

// Re-export A2UI types that are commonly used
export type { A2UIComponent, A2UILayout, A2UIResponse } from "@lsi/protocol";
