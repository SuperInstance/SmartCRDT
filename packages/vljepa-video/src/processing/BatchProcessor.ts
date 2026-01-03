/**
 * @lsi/vljepa-video/processing/BatchProcessor
 *
 * Batch processor for processing multiple frames efficiently.
 *
 * @version 1.0.0
 */

import type { VideoFrame, FrameResult, BatchResult } from "../types.js";

/**
 * Batch processor configuration
 */
export interface BatchProcessorConfig {
  /** Batch size */
  batchSize: number;

  /** Maximum batch timeout (ms) */
  maxTimeout: number;

  /** Whether to process in parallel */
  parallel: boolean;

  /** Number of workers */
  workers: number;
}

/**
 * Batch processor
 *
 * Accumulates frames and processes them in batches for efficiency.
 */
export class BatchProcessor {
  private config: BatchProcessorConfig;
  private batch: VideoFrame[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private resolvePending: ((result: BatchResult) => void) | null = null;

  // Processing function (provided externally)
  private processFn: (frames: VideoFrame[]) => Promise<FrameResult[]>;

  constructor(
    config: BatchProcessorConfig,
    processFn: (frames: VideoFrame[]) => Promise<FrameResult[]>
  ) {
    this.config = config;
    this.processFn = processFn;
  }

  /**
   * Add frame to batch
   */
  async addFrame(frame: VideoFrame): Promise<BatchResult | null> {
    this.batch.push(frame);

    // Check if batch is full
    if (this.batch.length >= this.config.batchSize) {
      return await this.processBatch();
    }

    // Set timeout for partial batch
    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(
        () => this.processBatch(),
        this.config.maxTimeout
      );
    }

    return null;
  }

  /**
   * Process current batch
   */
  async processBatch(): Promise<BatchResult> {
    // Clear timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    // Get frames to process
    const frames = [...this.batch];
    this.batch = [];

    if (frames.length === 0) {
      return {
        processed: 0,
        dropped: 0,
        avgLatency: 0,
        totalTime: 0,
        results: [],
        timestamp: performance.now(),
      };
    }

    const startTime = performance.now();

    // Process batch
    const results = await this.processFn(frames);

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Calculate statistics
    const processed = results.filter(r => !r.dropped).length;
    const dropped = results.filter(r => r.dropped).length;
    const avgLatency =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.latency, 0) / results.length
        : 0;

    return {
      processed,
      dropped,
      avgLatency,
      totalTime,
      results,
      timestamp: startTime,
    };
  }

  /**
   * Flush remaining batch
   */
  async flush(): Promise<BatchResult> {
    return await this.processBatch();
  }

  /**
   * Get current batch size
   */
  getBatchSize(): number {
    return this.batch.length;
  }

  /**
   * Clear batch without processing
   */
  clear(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.batch = [];
  }
}
