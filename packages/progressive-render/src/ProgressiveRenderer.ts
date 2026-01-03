/**
 * @lsi/progressive-render - Progressive Renderer
 *
 * Core renderer for streaming A2UI updates incrementally
 *
 * @version 1.0.0
 * @license Apache-2.0
 */

import type {
  ProgressiveChunk,
  RenderPhase,
  RenderStats,
  RenderStrategy,
  RenderError,
  UIUpdate,
  SSEEvent,
  FlowControlState,
  FlowControlOptions,
  ChunkContent,
  SkeletonConfig,
} from "./types.js";

// ============================================================================
// PROGRESSIVE RENDERER CLASS
// ============================================================================

/**
 * ProgressiveRenderer - Main renderer for streaming A2UI updates
 *
 * Manages the rendering lifecycle for components, including:
 * - Starting/completing/aborting render streams
 * - Sending and updating chunks
 * - Tracking render statistics
 * - Flow control and backpressure management
 */
export class ProgressiveRenderer {
  private streams: Map<string, RenderStream> = new Map();
  private chunks: Map<string, ProgressiveChunk> = new Map();
  private stats: Map<string, RenderStats> = new Map();
  private flowControl: FlowControlState;
  private flowOptions: FlowControlOptions;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  constructor(flowOptions?: Partial<FlowControlOptions>) {
    this.flowOptions = {
      max_buffer_size: 1024 * 1024, // 1MB
      backpressure_threshold: 0.8,
      auto_throttle: true,
      throttle_delay: 100,
      ...flowOptions,
    };

    this.flowControl = {
      backpressure: 0,
      buffer_size: 0,
      buffer_capacity: this.flowOptions.max_buffer_size,
      active: false,
      throttled: false,
      paused: false,
    };
  }

  // ========================================================================
  // STREAM MANAGEMENT
  // ========================================================================

  /**
   * Start rendering stream for a component
   *
   * @param componentId - Component identifier
   * @param strategy - Render strategy to use
   * @returns Stream ID
   */
  startStream(
    componentId: string,
    strategy: RenderStrategy = "top-down"
  ): string {
    const streamId = `${componentId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const stream: RenderStream = {
      streamId,
      componentId,
      strategy,
      phase: "skeleton",
      startedAt: new Date(),
      completedAt: null,
      aborted: false,
      chunks: [],
      totalChunks: 0,
      sentChunks: 0,
      bytesSent: 0,
    };

    this.streams.set(streamId, stream);

    // Initialize stats
    const stats: RenderStats = {
      component_id: componentId,
      start_time: new Date(),
      end_time: null,
      phases_completed: [],
      current_phase: "skeleton",
      bytes_sent: 0,
      chunks_sent: 0,
      chunks_remaining: 0,
      fps: 0,
      avg_fps: 0,
      ttfb: 0,
      tti: 0,
      total_time: 0,
      progress: 0,
      errors: 0,
      warnings: 0,
      strategy,
    };

    this.stats.set(componentId, stats);

    // Emit start event
    this.emit("stream:start", { streamId, componentId, strategy });

    return streamId;
  }

  /**
   * Complete rendering stream for a component
   *
   * @param componentId - Component identifier
   */
  completeStream(componentId: string): void {
    const stream = this.getStreamByComponentId(componentId);
    if (!stream || stream.completedAt) {
      return;
    }

    stream.completedAt = new Date();
    stream.phase = "complete";

    const stats = this.stats.get(componentId);
    if (stats) {
      stats.end_time = new Date();
      stats.current_phase = "complete";
      stats.phases_completed.push("complete");
      stats.total_time = stats.end_time.getTime() - stats.start_time.getTime();
      stats.progress = 100;
      stats.chunks_remaining = 0;
    }

    // Emit complete event
    this.emit("stream:complete", {
      componentId,
      streamId: stream.streamId,
      stats: stats || null,
    });
  }

  /**
   * Abort rendering stream for a component
   *
   * @param componentId - Component identifier
   * @param reason - Abort reason
   */
  abortStream(componentId: string, reason?: string): void {
    const stream = this.getStreamByComponentId(componentId);
    if (!stream || stream.aborted) {
      return;
    }

    stream.aborted = true;
    stream.completedAt = new Date();

    const stats = this.stats.get(componentId);
    if (stats) {
      stats.end_time = new Date();
      stats.current_phase = stream.phase;
      stats.total_time = stats.end_time.getTime() - stats.start_time.getTime();
    }

    // Emit abort event
    this.emit("stream:abort", {
      componentId,
      streamId: stream.streamId,
      reason,
    });
  }

  // ========================================================================
  // CHUNK MANAGEMENT
  // ========================================================================

  /**
   * Send render chunk
   *
   * @param chunk - Chunk to send
   * @returns Whether chunk was sent
   */
  sendChunk(chunk: ProgressiveChunk): boolean {
    // Check flow control
    if (this.flowControl.paused || this.flowControl.throttled) {
      return false;
    }

    // Check backpressure
    if (
      this.flowControl.backpressure > this.flowOptions.backpressure_threshold
    ) {
      this.applyBackpressure();
      return false;
    }

    const stream = this.getStreamByComponentId(chunk.component_id || "");
    if (!stream) {
      return false;
    }

    // Store chunk
    this.chunks.set(chunk.chunk_id, chunk);
    stream.chunks.push(chunk.chunk_id);
    stream.sentChunks++;
    stream.bytesSent += chunk.size_bytes || 0;

    // Update stats
    const stats = this.stats.get(stream.componentId);
    if (stats) {
      stats.chunks_sent = stream.sentChunks;
      stats.bytes_sent = stream.bytesSent;
      stats.chunks_remaining = stream.totalChunks - stream.sentChunks;
      stats.progress =
        stream.totalChunks > 0
          ? (stream.sentChunks / stream.totalChunks) * 100
          : 0;
    }

    // Update buffer size
    this.flowControl.buffer_size += chunk.size_bytes || 0;
    this.updateFlowControl();

    // Emit chunk event
    this.emit("chunk:send", { chunk, streamId: stream.streamId });

    return true;
  }

  /**
   * Update existing chunk
   *
   * @param chunkId - Chunk identifier
   * @param update - Partial update to chunk
   * @returns Whether chunk was updated
   */
  updateChunk(chunkId: string, update: Partial<ProgressiveChunk>): boolean {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) {
      return false;
    }

    const updatedChunk = {
      ...chunk,
      ...update,
      updated_at: new Date(),
    };

    this.chunks.set(chunkId, updatedChunk);

    // Emit update event
    this.emit("chunk:update", { chunk: updatedChunk, previous: chunk });

    return true;
  }

  /**
   * Get chunk by ID
   *
   * @param chunkId - Chunk identifier
   * @returns Chunk or null
   */
  getChunk(chunkId: string): ProgressiveChunk | null {
    return this.chunks.get(chunkId) || null;
  }

  /**
   * Get all chunks for a component
   *
   * @param componentId - Component identifier
   * @returns Array of chunks
   */
  getChunksForComponent(componentId: string): ProgressiveChunk[] {
    const chunks: ProgressiveChunk[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.component_id === componentId) {
        chunks.push(chunk);
      }
    }
    return chunks.sort((a, b) => b.priority - a.priority);
  }

  // ========================================================================
  // PHASE MANAGEMENT
  // ========================================================================

  /**
   * Advance to next render phase
   *
   * @param componentId - Component identifier
   * @param phase - New phase
   */
  advancePhase(componentId: string, phase: RenderPhase): void {
    const stream = this.getStreamByComponentId(componentId);
    if (!stream) {
      return;
    }

    const phases: RenderPhase[] = [
      "skeleton",
      "content",
      "interactive",
      "complete",
    ];
    const currentIdx = phases.indexOf(stream.phase);
    const newIdx = phases.indexOf(phase);

    if (newIdx <= currentIdx) {
      return; // Can't go backwards
    }

    stream.phase = phase;

    const stats = this.stats.get(componentId);
    if (stats) {
      stats.current_phase = phase;
      if (!stats.phases_completed.includes(phase)) {
        stats.phases_completed.push(phase);
      }

      // Calculate TTI when reaching interactive
      if (phase === "interactive" && stats.tti === 0) {
        stats.tti = Date.now() - stats.start_time.getTime();
      }
    }

    // Emit phase change event
    this.emit("phase:change", { componentId, phase, previous: stream.phase });
  }

  // ========================================================================
  // STATS MANAGEMENT
  // ========================================================================

  /**
   * Get render stats for a component
   *
   * @param componentId - Component identifier
   * @returns Render stats or null
   */
  getRenderStats(componentId: string): RenderStats | null {
    const stats = this.stats.get(componentId);
    if (!stats) {
      return null;
    }

    // Calculate FPS if rendering is in progress
    if (!stats.end_time) {
      const elapsed = Date.now() - stats.start_time.getTime();
      stats.fps = elapsed > 0 ? (stats.chunks_sent / elapsed) * 1000 : 0;
      stats.avg_fps = stats.fps; // Simple average for now
    }

    return { ...stats };
  }

  /**
   * Get all render stats
   *
   * @returns Map of component ID to stats
   */
  getAllStats(): Map<string, RenderStats> {
    return new Map(this.stats);
  }

  // ========================================================================
  // FLOW CONTROL
  // ========================================================================

  /**
   * Update flow control state
   */
  private updateFlowControl(): void {
    const ratio =
      this.flowControl.buffer_size / this.flowControl.buffer_capacity;
    this.flowControl.backpressure = ratio;
    this.flowControl.active = ratio > 0.5;

    if (
      this.flowOptions.auto_throttle &&
      ratio > this.flowOptions.backpressure_threshold
    ) {
      this.applyBackpressure();
    }
  }

  /**
   * Apply backpressure (throttle or pause)
   */
  private applyBackpressure(): void {
    if (this.flowOptions.auto_throttle) {
      this.flowControl.throttled = true;

      setTimeout(() => {
        this.flowControl.throttled = false;
        this.flowControl.buffer_size = 0; // Reset buffer
        this.updateFlowControl();
      }, this.flowOptions.throttle_delay);
    }
  }

  /**
   * Pause streaming
   */
  pause(): void {
    this.flowControl.paused = true;
    this.emit("flow:pause", { state: this.flowControl });
  }

  /**
   * Resume streaming
   */
  resume(): void {
    this.flowControl.paused = false;
    this.emit("flow:resume", { state: this.flowControl });
  }

  /**
   * Get current flow control state
   *
   * @returns Flow control state
   */
  getFlowControlState(): FlowControlState {
    return { ...this.flowControl };
  }

  // ========================================================================
  // EVENT HANDLING
  // ========================================================================

  /**
   * Register event handler
   *
   * @param event - Event name
   * @param handler - Event handler
   */
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unregister event handler
   *
   * @param event - Event name
   * @param handler - Event handler
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event to all handlers
   *
   * @param event - Event name
   * @param data - Event data
   */
  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get stream by component ID
   *
   * @param componentId - Component identifier
   * @returns Stream or null
   */
  private getStreamByComponentId(componentId: string): RenderStream | null {
    for (const stream of this.streams.values()) {
      if (stream.componentId === componentId && !stream.completedAt) {
        return stream;
      }
    }
    return null;
  }

  /**
   * Create skeleton chunk
   *
   * @param componentId - Component identifier
   * @param config - Skeleton configuration
   * @returns Skeleton chunk
   */
  createSkeletonChunk(
    componentId: string,
    config: SkeletonConfig
  ): ProgressiveChunk {
    return {
      chunk_id: `skeleton-${componentId}-${Date.now()}`,
      phase: "skeleton",
      content: { type: "skeleton", data: config },
      priority: 100,
      created_at: new Date(),
      updated_at: new Date(),
      critical: true,
      component_id: componentId,
      metadata: {
        source: "generated",
        strategy: "critical-first",
      },
    };
  }

  /**
   * Create content chunk
   *
   * @param componentId - Component identifier
   * @param content - Chunk content
   * @param priority - Chunk priority
   * @returns Content chunk
   */
  createContentChunk(
    componentId: string,
    content: ChunkContent,
    priority: number = 50
  ): ProgressiveChunk {
    return {
      chunk_id: `chunk-${componentId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      phase: "content",
      content,
      priority,
      created_at: new Date(),
      updated_at: new Date(),
      critical: priority > 80,
      component_id: componentId,
      metadata: {
        source: "stream",
        strategy: "streaming",
      },
    };
  }

  /**
   * Clean up completed streams
   *
   * @param maxAge - Maximum age in milliseconds (default: 5 minutes)
   */
  cleanup(maxAge: number = 5 * 60 * 1000): void {
    const now = Date.now();

    for (const [streamId, stream] of this.streams.entries()) {
      const age = stream.completedAt
        ? now - stream.completedAt.getTime()
        : now - stream.startedAt.getTime();

      if (age > maxAge) {
        // Remove chunks
        for (const chunkId of stream.chunks) {
          this.chunks.delete(chunkId);
        }

        // Remove stream
        this.streams.delete(streamId);

        // Remove stats
        this.stats.delete(stream.componentId);
      }
    }
  }

  /**
   * Destroy renderer and clean up resources
   */
  destroy(): void {
    // Abort all active streams
    for (const stream of this.streams.values()) {
      if (!stream.completedAt) {
        this.abortStream(stream.componentId, "Renderer destroyed");
      }
    }

    // Clear all maps
    this.streams.clear();
    this.chunks.clear();
    this.stats.clear();
    this.eventHandlers.clear();
  }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * Render stream state
 */
interface RenderStream {
  streamId: string;
  componentId: string;
  strategy: RenderStrategy;
  phase: RenderPhase;
  startedAt: Date;
  completedAt: Date | null;
  aborted: boolean;
  chunks: string[];
  totalChunks: number;
  sentChunks: number;
  bytesSent: number;
}

/**
 * Event handler type
 */
type EventHandler = (data: unknown) => void;
