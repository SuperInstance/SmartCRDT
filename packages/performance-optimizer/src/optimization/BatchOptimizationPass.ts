/**
 * Batch Optimization Pass - Request batching and optimization
 *
 * Features:
 * - Request batching with configurable batch sizes
 * - Batch size optimization
 * - Multiple batching strategies
 * - Batch timing optimization
 * - Batch statistics and monitoring
 */

import { performance } from 'perf_hooks';

/**
 * Batching strategy
 */
export type BatchingStrategy = 'fixed-size' | 'time-window' | 'adaptive' | 'priority';

/**
 * Batch operation
 */
export interface BatchOperation<T> {
  id: string;
  data: T;
  priority?: number;
  timestamp: number;
  timeout?: number;
}

/**
 * Batch result
 */
export interface BatchResult<T, R> {
  operations: BatchOperation<T>[];
  results: R[];
  totalDuration: number;
  averageDuration: number;
  batchSize: number;
}

/**
 * Batching options
 */
export interface BatchingOptions<T, R> {
  maxSize?: number;
  maxWaitTime?: number;
  strategy?: BatchingStrategy;
  processor: (batch: T[]) => Promise<R[]>;
  onBatchStart?: (batch: BatchOperation<T>[]) => void;
  onBatchComplete?: (result: BatchResult<T, R>) => void;
  onBatchError?: (error: Error) => void;
}

/**
 * Batch queue
 */
export class BatchQueue<T, R> {
  private options: Required<Omit<BatchingOptions<T, R>, 'onBatchStart' | 'onBatchComplete' | 'onBatchError'>> & {
    onBatchStart?: (batch: BatchOperation<T>[]) => void;
    onBatchComplete?: (result: BatchResult<T, R>) => void;
    onBatchError?: (error: Error) => void;
  };
  private queue: BatchOperation<T>[] = [];
  private processing = false;
  private flushTimer?: NodeJS.Timeout;
  private stats = {
    totalBatches: 0,
    totalOperations: 0,
    totalDuration: 0,
    averageBatchSize: 0,
  };

  constructor(options: BatchingOptions<T, R>) {
    this.options = {
      maxSize: options.maxSize ?? 10,
      maxWaitTime: options.maxWaitTime ?? 100,
      strategy: options.strategy ?? 'adaptive',
      processor: options.processor,
      onBatchStart: options.onBatchStart,
      onBatchComplete: options.onBatchComplete,
      onBatchError: options.onBatchError,
    };
  }

  /**
   * Add operation to queue
   */
  async add(data: T, priority?: number, timeout?: number): Promise<R> {
    return new Promise((resolve, reject) => {
      const operation: BatchOperation<T> = {
        id: `${Date.now()}-${Math.random()}`,
        data,
        priority,
        timestamp: Date.now(),
        timeout,
      };

      this.queue.push(operation);

      // Store resolve/reject for this operation
      (operation as any).resolve = resolve;
      (operation as any).reject = reject;

      // Check if we should process batch
      if (this.shouldProcessBatch()) {
        this.processBatch();
      } else {
        this.scheduleFlush();
      }
    });
  }

  /**
   * Check if batch should be processed
   */
  private shouldProcessBatch(): boolean {
    if (this.processing) return false;

    switch (this.options.strategy) {
      case 'fixed-size':
        return this.queue.length >= this.options.maxSize;

      case 'time-window':
        return this.queue.length >= this.options.maxSize;

      case 'adaptive':
        // Process if queue is getting full or has high priority items
        if (this.queue.length >= this.options.maxSize) return true;
        if (this.queue.some((op) => op.priority && op.priority > 0.8)) return true;
        return false;

      case 'priority':
        // Process if high priority item or queue is full
        if (this.queue.length >= this.options.maxSize) return true;
        if (this.queue.some((op) => op.priority && op.priority > 0.7)) return true;
        return false;

      default:
        return false;
    }
  }

  /**
   * Schedule batch flush
   */
  private scheduleFlush(): void {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.processBatch();
      this.flushTimer = undefined;
    }, this.options.maxWaitTime);

    this.flushTimer.unref();
  }

  /**
   * Process batch
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    // Sort by priority if using priority strategy
    if (this.options.strategy === 'priority') {
      this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    // Take batch
    const batch = this.queue.splice(0, this.options.maxSize);
    this.options.onBatchStart?.(batch);

    const startTime = performance.now();

    try {
      const data = batch.map((op) => op.data);
      const results = await this.options.processor(data);

      const duration = performance.now() - startTime;

      // Resolve promises
      for (let i = 0; i < batch.length; i++) {
        const operation = batch[i] as any;
        if (results[i] !== undefined) {
          operation.resolve(results[i]);
        } else {
          operation.reject(new Error('No result returned'));
        }
      }

      // Update stats
      this.stats.totalBatches++;
      this.stats.totalOperations += batch.length;
      this.stats.totalDuration += duration;
      this.stats.averageBatchSize = this.stats.totalOperations / this.stats.totalBatches;

      const batchResult: BatchResult<T, R> = {
        operations: batch,
        results,
        totalDuration: duration,
        averageDuration: duration / batch.length,
        batchSize: batch.length,
      };

      this.options.onBatchComplete?.(batchResult);
    } catch (error) {
      // Reject all promises
      for (const operation of batch) {
        (operation as any).reject(error);
      }
      this.options.onBatchError?.(error as Error);
    } finally {
      this.processing = false;

      // Check if more items to process
      if (this.queue.length > 0) {
        if (this.shouldProcessBatch()) {
          this.processBatch();
        } else {
          this.scheduleFlush();
        }
      }
    }
  }

  /**
   * Flush all pending operations
   */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    while (this.queue.length > 0) {
      await this.processBatch();
    }
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Clear queue
   */
  clear(): void {
    // Reject all pending operations
    for (const operation of this.queue) {
      (operation as any).reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }
}

/**
 * Batch size optimizer
 */
export class BatchSizeOptimizer {
  private batchSizeHistory: number[] = [];
  private performanceHistory: number[] = [];
  private optimalBatchSize = 10;
  private minBatchSize = 1;
  private maxBatchSize = 100;

  /**
   * Record batch performance
   */
  recordPerformance(batchSize: number, averageDuration: number): void {
    this.batchSizeHistory.push(batchSize);
    this.performanceHistory.push(averageDuration);

    // Keep only recent history
    if (this.batchSizeHistory.length > 100) {
      this.batchSizeHistory.shift();
      this.performanceHistory.shift();
    }

    this.updateOptimalBatchSize();
  }

  /**
   * Update optimal batch size based on performance
   */
  private updateOptimalBatchSize(): void {
    if (this.batchSizeHistory.length < 10) return;

    // Find batch size with best performance
    const performanceBySize = new Map<number, number[]>();

    for (let i = 0; i < this.batchSizeHistory.length; i++) {
      const size = this.batchSizeHistory[i];
      const perf = this.performanceHistory[i];

      if (!performanceBySize.has(size)) {
        performanceBySize.set(size, []);
      }
      performanceBySize.get(size)!.push(perf);
    }

    let bestSize = this.optimalBatchSize;
    let bestAvgPerf = Infinity;

    for (const [size, perfs] of performanceBySize.entries()) {
      const avgPerf = perfs.reduce((sum, p) => sum + p, 0) / perfs.length;
      if (avgPerf < bestAvgPerf) {
        bestAvgPerf = avgPerf;
        bestSize = size;
      }
    }

    // Update optimal size with some hysteresis
    if (bestSize !== this.optimalBatchSize) {
      this.optimalBatchSize = Math.max(
        this.minBatchSize,
        Math.min(this.maxBatchSize, bestSize)
      );
    }
  }

  /**
   * Get optimal batch size
   */
  getOptimalBatchSize(): number {
    return this.optimalBatchSize;
  }

  /**
   * Set batch size limits
   */
  setBatchSizeLimits(min: number, max: number): void {
    this.minBatchSize = min;
    this.maxBatchSize = max;
    this.optimalBatchSize = Math.max(min, Math.min(max, this.optimalBatchSize));
  }
}

/**
 * Batch optimization pass
 */
export class BatchOptimizationPass {
  private static queues: Map<string, BatchQueue<any, any>> = new Map();
  private static optimizers: Map<string, BatchSizeOptimizer> = new Map();

  /**
   * Create or get a batch queue
   */
  static getQueue<T, R>(
    name: string,
    processor: (batch: T[]) => Promise<R[]>,
    options?: Partial<BatchingOptions<T, R>>
  ): BatchQueue<T, R> {
    if (!this.queues.has(name)) {
      const queue = new BatchQueue<T, R>({
        processor,
        ...options,
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name) as BatchQueue<T, R>;
  }

  /**
   * Create or get a batch size optimizer
   */
  static getOptimizer(name: string): BatchSizeOptimizer {
    if (!this.optimizers.has(name)) {
      this.optimizers.set(name, new BatchSizeOptimizer());
    }
    return this.optimizers.get(name)!;
  }

  /**
   * Get all queue statistics
   */
  static getAllStatistics(): Map<string, any> {
    const stats = new Map<string, any>();
    for (const [name, queue] of this.queues.entries()) {
      stats.set(name, queue.getStatistics());
    }
    return stats;
  }

  /**
   * Generate batch report
   */
  static generateBatchReport(): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('BATCH OPTIMIZATION REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    let totalBatches = 0;
    let totalOperations = 0;
    let totalDuration = 0;

    for (const [name, queue] of this.queues.entries()) {
      const stats = queue.getStatistics();
      totalBatches += stats.totalBatches;
      totalOperations += stats.totalOperations;
      totalDuration += stats.totalDuration;

      lines.push(`Queue: ${name}`);
      lines.push(`  Total Batches: ${stats.totalBatches}`);
      lines.push(`  Total Operations: ${stats.totalOperations}`);
      lines.push(`  Average Batch Size: ${stats.averageBatchSize.toFixed(2)}`);
      lines.push(`  Total Duration: ${stats.totalDuration.toFixed(2)}ms`);
      lines.push(`  Average Duration per Batch: ${(stats.totalDuration / stats.totalBatches || 0).toFixed(2)}ms`);
      lines.push(`  Average Duration per Operation: ${(stats.totalDuration / stats.totalOperations || 0).toFixed(2)}ms`);
      lines.push('');
    }

    lines.push('-'.repeat(80));
    lines.push('TOTALS:');
    lines.push(`  Total Batches: ${totalBatches}`);
    lines.push(`  Total Operations: ${totalOperations}`);
    lines.push(`  Average Batch Size: ${(totalOperations / totalBatches || 0).toFixed(2)}`);
    lines.push(`  Total Duration: ${totalDuration.toFixed(2)}ms`);
    lines.push('');

    // Optimizer recommendations
    if (this.optimizers.size > 0) {
      lines.push('OPTIMAL BATCH SIZES:');
      for (const [name, optimizer] of this.optimizers.entries()) {
        lines.push(`  ${name}: ${optimizer.getOptimalBatchSize()}`);
      }
      lines.push('');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Clear all queues
   */
  static clearAll(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
  }
}
