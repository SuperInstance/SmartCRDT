/**
 * @lsi/progressive-render - Chunk Scheduler
 *
 * Schedules chunks by priority for progressive rendering
 *
 * @version 1.0.0
 * @license Apache-2.0
 */

import type {
  ProgressiveChunk,
  ChunkPriority,
  RenderStrategy,
  ScheduleOptions,
  ScheduledChunk,
  RenderPhase,
} from "./types.js";

// ============================================================================
// CHUNK SCHEDULER
// ============================================================================

/**
 * ChunkScheduler - Schedules and prioritizes render chunks
 *
 * Handles:
 * - Priority-based chunk scheduling
 * - Critical path rendering (above-the-fold first)
 * - Lazy loading for below-the-fold content
 * - Predictive pre-rendering
 * - Bandwidth-aware scheduling
 */
export class ChunkScheduler {
  private queue: ScheduledChunk[] = [];
  private scheduled: Set<string> = new Set();
  private rendering: Set<string> = new Set();
  private completed: Set<string> = new Set();
  private options: ScheduleOptions;
  private bandwidthEstimate: number = 1000000; // 1 Mbps default
  private bandwidthSamples: number[] = [];
  private predictiveCache: Map<string, ProgressiveChunk> = new Map();

  constructor(options?: Partial<ScheduleOptions>) {
    this.options = {
      strategy: "critical-first",
      priority_method: "dynamic",
      bandwidth_aware: true,
      predictive: true,
      max_concurrent: 6,
      ...options,
    };
  }

  // ========================================================================
  // SCHEDULING
  // ========================================================================

  /**
   * Schedule chunk for rendering
   *
   * @param chunk - Chunk to schedule
   * @returns Scheduled chunk
   */
  schedule(chunk: ProgressiveChunk): ScheduledChunk {
    const priorityScore = this.calculatePriorityScore(chunk);
    const scheduledAt = new Date();

    // Estimate render time based on size and bandwidth
    const estimatedSize = chunk.size_bytes || 5000; // Default 5KB
    const estimatedRenderTime = this.estimateRenderTime(estimatedSize);
    const expectedRenderTime = new Date(
      scheduledAt.getTime() + estimatedRenderTime
    );

    const scheduled: ScheduledChunk = {
      chunk,
      scheduled_at: scheduledAt,
      expected_render_time: expectedRenderTime,
      priority_score: priorityScore,
    };

    // Add to queue
    this.queue.push(scheduled);
    this.scheduled.add(chunk.chunk_id);

    // Sort queue by priority
    this.sortQueue();

    return scheduled;
  }

  /**
   * Schedule multiple chunks
   *
   * @param chunks - Chunks to schedule
   * @returns Array of scheduled chunks
   */
  scheduleBatch(chunks: ProgressiveChunk[]): ScheduledChunk[] {
    return chunks.map(chunk => this.schedule(chunk));
  }

  /**
   * Get next chunk to render
   *
   * @returns Next chunk or null if queue is empty
   */
  getNext(): ProgressiveChunk | null {
    if (this.queue.length === 0) {
      return null;
    }

    // Check concurrent limit
    if (this.rendering.size >= this.options.max_concurrent) {
      return null;
    }

    const scheduled = this.queue.shift()!;
    const chunk = scheduled.chunk;

    this.scheduled.delete(chunk.chunk_id);
    this.rendering.add(chunk.chunk_id);

    return chunk;
  }

  /**
   * Mark chunk as completed
   *
   * @param chunkId - Chunk identifier
   */
  complete(chunkId: string): void {
    this.rendering.delete(chunkId);
    this.completed.add(chunkId);

    // Update bandwidth estimate
    this.updateBandwidthEstimate();
  }

  /**
   * Mark chunk as failed
   *
   * @param chunkId - Chunk identifier
   * @param retry - Whether to reschedule
   */
  fail(chunkId: string, retry: boolean = true): void {
    this.rendering.delete(chunkId);

    if (retry) {
      // Find and reschedule the chunk
      for (const scheduled of this.queue) {
        if (scheduled.chunk.chunk_id === chunkId) {
          // Move to end of queue for retry
          this.queue = this.queue.filter(s => s.chunk.chunk_id !== chunkId);
          scheduled.scheduled_at = new Date();
          this.queue.push(scheduled);
          break;
        }
      }
    }
  }

  // ========================================================================
  // PRIORITY CALCULATION
  // ========================================================================

  /**
   * Calculate priority score for chunk
   *
   * @param chunk - Chunk to score
   * @returns Priority score (0-1000, higher = more important)
   */
  private calculatePriorityScore(chunk: ProgressiveChunk): number {
    let score = 0;

    // Base priority from chunk (0-100, scale to 0-500)
    score += chunk.priority * 5;

    // Critical chunk bonus (+200)
    if (chunk.critical) {
      score += 200;
    }

    // Phase priority (skeleton > content > interactive > complete)
    const phasePriority: Record<RenderPhase, number> = {
      skeleton: 150,
      content: 100,
      interactive: 50,
      complete: 0,
    };
    score += phasePriority[chunk.phase];

    // Size penalty (smaller chunks prioritized)
    const size = chunk.size_bytes || 5000;
    if (size < 1000) score += 50;
    else if (size < 5000) score += 25;
    else if (size > 50000) score -= 50;

    // Dependency boost (if all dependencies are met)
    if (chunk.dependencies && chunk.dependencies.length > 0) {
      const allDepsMet = chunk.dependencies.every(dep =>
        this.completed.has(dep)
      );
      if (allDepsMet) {
        score += 100;
      } else {
        score -= 200; // Deprioritize if dependencies not met
      }
    }

    // Bandwidth-aware adjustment
    if (this.options.bandwidth_aware) {
      score = this.adjustForBandwidth(score, size);
    }

    return Math.max(0, Math.min(1000, score));
  }

  /**
   * Adjust priority score based on available bandwidth
   *
   * @param score - Current score
   * @param size - Chunk size in bytes
   * @returns Adjusted score
   */
  private adjustForBandwidth(score: number, size: number): number {
    // Low bandwidth: prioritize smaller chunks
    if (this.bandwidthEstimate < 500000) {
      // < 500 Kbps
      if (size < 2000) score += 100;
      else if (size > 20000) score -= 100;
    }

    return score;
  }

  /**
   * Sort queue by priority score
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // Strategy-specific sorting
      switch (this.options.strategy) {
        case "critical-first":
          // Critical chunks first, then by score
          if (a.chunk.critical && !b.chunk.critical) return -1;
          if (!a.chunk.critical && b.chunk.critical) return 1;
          return b.priority_score - a.priority_score;

        case "top-down":
          // Parents (with children) before children
          if (a.chunk.child_ids?.length && !b.chunk.child_ids?.length)
            return -1;
          if (!a.chunk.child_ids?.length && b.chunk.child_ids?.length) return 1;
          return b.priority_score - a.priority_score;

        case "lazy":
          // Low priority chunks later
          return b.priority_score - a.priority_score;

        case "streaming":
          // Maintain insertion order
          return 0;

        default:
          return b.priority_score - a.priority_score;
      }
    });
  }

  // ========================================================================
  // CRITICAL PATH RENDERING
  // ========================================================================

  /**
   * Get chunks for critical path (above-the-fold content)
   *
   * @param chunks - All chunks
   * @returns Critical path chunks
   */
  getCriticalPath(chunks: ProgressiveChunk[]): ProgressiveChunk[] {
    return chunks.filter(chunk => chunk.critical);
  }

  /**
   * Get chunks for lazy loading (below-the-fold content)
   *
   * @param chunks - All chunks
   * @returns Lazy chunks
   */
  getLazyChunks(chunks: ProgressiveChunk[]): ProgressiveChunk[] {
    return chunks.filter(chunk => !chunk.critical && chunk.priority < 50);
  }

  /**
   * Check if chunk is on critical path
   *
   * @param chunk - Chunk to check
   * @returns Whether chunk is critical
   */
  isCriticalPath(chunk: ProgressiveChunk): boolean {
    return chunk.critical || chunk.phase === "skeleton";
  }

  // ========================================================================
  // BANDWIDTH ESTIMATION
  // ========================================================================

  /**
   * Update bandwidth estimate based on recent transfers
   */
  private updateBandwidthEstimate(): void {
    // Keep last 10 samples
    if (this.bandwidthSamples.length > 10) {
      this.bandwidthSamples.shift();
    }

    // Calculate average bandwidth (simplified)
    if (this.bandwidthSamples.length > 0) {
      const sum = this.bandwidthSamples.reduce((a, b) => a + b, 0);
      this.bandwidthEstimate = sum / this.bandwidthSamples.length;
    }
  }

  /**
   * Record bandwidth sample
   *
   * @param bytes - Bytes transferred
   * @param ms - Time in milliseconds
   */
  recordBandwidth(bytes: number, ms: number): void {
    if (ms > 0) {
      const bps = (bytes / ms) * 1000;
      this.bandwidthSamples.push(bps);
      this.updateBandwidthEstimate();
    }
  }

  /**
   * Get current bandwidth estimate
   *
   * @returns Bandwidth in bytes per second
   */
  getBandwidth(): number {
    return this.bandwidthEstimate;
  }

  /**
   * Estimate render time for chunk size
   *
   * @param size - Chunk size in bytes
   * @returns Estimated time in milliseconds
   */
  private estimateRenderTime(size: number): number {
    // Transfer time
    const transferTime = (size / this.bandwidthEstimate) * 1000;

    // Base render time (10ms + 1ms per KB)
    const renderTime = 10 + size / 1000;

    return transferTime + renderTime;
  }

  // ========================================================================
  // PREDICTIVE PRE-RENDERING
  // ========================================================================

  /**
   * Predict and pre-render chunks likely to be needed
   *
   * @param currentChunk - Current chunk being rendered
   * @param allChunks - All available chunks
   * @returns Predicted chunks to pre-render
   */
  predictNextChunks(
    currentChunk: ProgressiveChunk,
    allChunks: ProgressiveChunk[]
  ): ProgressiveChunk[] {
    if (!this.options.predictive) {
      return [];
    }

    const predictions: ProgressiveChunk[] = [];

    // Add children
    if (currentChunk.child_ids) {
      for (const childId of currentChunk.child_ids) {
        const child = allChunks.find(c => c.chunk_id === childId);
        if (child && !this.scheduled.has(childId)) {
          predictions.push(child);
        }
      }
    }

    // Add siblings with similar priority
    const siblings = allChunks.filter(
      c =>
        c.component_id === currentChunk.component_id &&
        c.chunk_id !== currentChunk.chunk_id &&
        Math.abs(c.priority - currentChunk.priority) < 10 &&
        !this.scheduled.has(c.chunk_id)
    );

    predictions.push(...siblings.slice(0, 2));

    return predictions.slice(0, 3); // Max 3 predictions
  }

  /**
   * Cache chunk for predictive pre-rendering
   *
   * @param chunk - Chunk to cache
   */
  cachePredictive(chunk: ProgressiveChunk): void {
    this.predictiveCache.set(chunk.chunk_id, chunk);
  }

  /**
   * Get cached predictive chunk
   *
   * @param chunkId - Chunk identifier
   * @returns Cached chunk or null
   */
  getCached(chunkId: string): ProgressiveChunk | null {
    return this.predictiveCache.get(chunkId) || null;
  }

  /**
   * Clear predictive cache
   */
  clearPredictiveCache(): void {
    this.predictiveCache.clear();
  }

  // ========================================================================
  // QUEUE MANAGEMENT
  // ========================================================================

  /**
   * Get queue size
   *
   * @returns Number of chunks in queue
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   *
   * @returns Whether queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.rendering.size === 0;
  }

  /**
   * Check if chunk is scheduled
   *
   * @param chunkId - Chunk identifier
   * @returns Whether chunk is scheduled
   */
  isScheduled(chunkId: string): boolean {
    return this.scheduled.has(chunkId);
  }

  /**
   * Check if chunk is rendering
   *
   * @param chunkId - Chunk identifier
   * @returns Whether chunk is rendering
   */
  isRendering(chunkId: string): boolean {
    return this.rendering.has(chunkId);
  }

  /**
   * Check if chunk is completed
   *
   * @param chunkId - Chunk identifier
   * @returns Whether chunk is completed
   */
  isCompleted(chunkId: string): boolean {
    return this.completed.has(chunkId);
  }

  /**
   * Get queue statistics
   *
   * @returns Queue statistics
   */
  getStats(): QueueStats {
    return {
      queued: this.queue.length,
      scheduled: this.scheduled.size,
      rendering: this.rendering.size,
      completed: this.completed.size,
      bandwidth_bps: this.bandwidthEstimate,
      cache_size: this.predictiveCache.size,
    };
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.queue = [];
    this.scheduled.clear();
    this.rendering.clear();
    this.completed.clear();
    this.predictiveCache.clear();
  }

  /**
   * Pause scheduling
   */
  pause(): void {
    // Store current state for resume
  }

  /**
   * Resume scheduling
   */
  resume(): void {
    // Restore state
  }
}

// ============================================================================
// QUEUE STATS TYPE
// ============================================================================

interface QueueStats {
  queued: number;
  scheduled: number;
  rendering: number;
  completed: number;
  bandwidth_bps: number;
  cache_size: number;
}
