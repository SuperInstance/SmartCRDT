/**
 * Dynamic Batcher
 * Dynamically batches inference requests to improve throughput
 */

import type {
  BatcherConfig,
  BatchResult,
  InputBatch,
  BatchRequest,
  BatchingStrategy,
} from "../types.js";

export class DynamicBatcher {
  private config: BatcherConfig;
  private queue: BatchRequest[] = [];
  private processing = false;
  private batchHistory: BatchMetrics[] = [];
  private adaptiveParams = {
    targetBatchSize: 8,
    targetWaitTime: 5, // ms
    loadFactor: 0.5,
  };

  constructor(config: Partial<BatcherConfig> = {}) {
    this.config = {
      maxBatchSize: 32,
      maxWaitTime: 10, // ms
      minBatchSize: 1,
      adaptive: true,
      priority: true,
      ...config,
    };
  }

  /**
   * Add a request to the batch queue
   */
  async add(input: unknown, priority: number = 0): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: this.generateId(),
        input,
        priority,
        timestamp: performance.now(),
        timeout: Date.now() + 5000, // 5 second timeout
      };

      this.queue.push(request);
      request.resolve = resolve;
      request.reject = reject;

      // Try to form a batch
      this.tryFormBatch();
    });
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get batching statistics
   */
  getStats(): BatcherStats {
    const avgBatchSize = this.average(this.batchHistory.map(b => b.batchSize));
    const avgLatency = this.average(this.batchHistory.map(b => b.latency));
    const avgEfficiency = this.average(
      this.batchHistory.map(b => b.efficiency)
    );

    return {
      queueSize: this.queue.length,
      avgBatchSize,
      avgLatency,
      avgEfficiency,
      totalBatches: this.batchHistory.length,
      droppedRequests: this.batchHistory.reduce((sum, b) => sum + b.dropped, 0),
      adaptiveParams: { ...this.adaptiveParams },
    };
  }

  /**
   * Clear the queue and history
   */
  clear(): void {
    // Reject all pending requests
    for (const request of this.queue) {
      if (request.reject) {
        request.reject(new Error("Batcher cleared"));
      }
    }
    this.queue = [];
    this.batchHistory = [];
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private tryFormBatch(): void {
    if (this.processing) return;
    if (this.queue.length < this.config.minBatchSize) return;

    const batch = this.formBatch();
    if (!batch) return;

    this.processing = true;
    this.processBatch(batch).finally(() => {
      this.processing = false;
      // Check if we can form another batch
      if (this.queue.length >= this.config.minBatchSize) {
        this.tryFormBatch();
      }
    });
  }

  private formBatch(): BatchRequest[] | null {
    if (this.queue.length === 0) return null;

    // Sort by priority if enabled
    if (this.config.priority) {
      this.queue.sort((a, b) => b.priority - a.priority);
    }

    let batchSize: number;
    let batch: BatchRequest[];

    if (this.config.adaptive) {
      batchSize = Math.min(
        this.adaptiveParams.targetBatchSize,
        this.config.maxBatchSize,
        this.queue.length
      );
      batch = this.queue.splice(0, batchSize);
    } else {
      batchSize = Math.min(this.config.maxBatchSize, this.queue.length);
      batch = this.queue.splice(0, batchSize);
    }

    // Check timeout
    const now = Date.now();
    const timedOut = batch.filter(r => now > r.timeout);
    if (timedOut.length > 0) {
      for (const request of timedOut) {
        if (request.reject) {
          request.reject(new Error("Request timeout"));
        }
      }
      batch = batch.filter(r => now <= r.timeout);
    }

    return batch.length > 0 ? batch : null;
  }

  private async processBatch(batch: BatchRequest[]): Promise<void> {
    const startTime = performance.now();
    const inputs = batch.map(r => r.input);
    const priorities = batch.map(r => r.priority);
    const timestamps = batch.map(r => r.timestamp);

    // Create input batch
    const inputBatch: InputBatch = {
      inputs,
      ids: batch.map(r => r.id),
      timestamps,
      priorities,
    };

    // Process the batch (this would be delegated to actual inference)
    const results = await this.processInputs(inputBatch);

    const endTime = performance.now();
    const latency = endTime - startTime;
    const efficiency = batch.length / this.config.maxBatchSize;

    // Resolve promises
    for (let i = 0; i < batch.length; i++) {
      if (batch[i].resolve) {
        batch[i].resolve(results[i]);
      }
    }

    // Record metrics
    this.batchHistory.push({
      batchSize: batch.length,
      latency,
      efficiency,
      dropped: 0,
      timestamp: endTime,
    });

    // Keep history bounded
    if (this.batchHistory.length > 1000) {
      this.batchHistory = this.batchHistory.slice(-500);
    }

    // Update adaptive parameters
    if (this.config.adaptive) {
      this.updateAdaptiveParams();
    }
  }

  private async processInputs(batch: InputBatch): Promise<unknown[]> {
    // Placeholder - actual implementation would run inference
    // For now, return dummy results
    return batch.inputs.map(() => ({ result: "dummy" }));
  }

  private updateAdaptiveParams(): void {
    if (this.batchHistory.length < 10) return;

    const recent = this.batchHistory.slice(-20);
    const avgLatency = this.average(recent.map(b => b.latency));
    const avgEfficiency = this.average(recent.map(b => b.efficiency));

    // Adjust target batch size based on efficiency
    if (avgEfficiency < 0.5) {
      // Low efficiency, reduce batch size
      this.adaptiveParams.targetBatchSize = Math.max(
        this.config.minBatchSize,
        Math.floor(this.adaptiveParams.targetBatchSize * 0.8)
      );
    } else if (avgEfficiency > 0.9) {
      // High efficiency, increase batch size
      this.adaptiveParams.targetBatchSize = Math.min(
        this.config.maxBatchSize,
        Math.ceil(this.adaptiveParams.targetBatchSize * 1.2)
      );
    }

    // Adjust wait time based on latency
    if (avgLatency > this.config.maxWaitTime * 0.9) {
      // High latency, reduce wait time
      this.adaptiveParams.targetWaitTime = Math.max(
        1,
        this.adaptiveParams.targetWaitTime * 0.8
      );
    } else if (avgLatency < this.config.maxWaitTime * 0.5) {
      // Low latency, can wait longer for larger batches
      this.adaptiveParams.targetWaitTime = Math.min(
        this.config.maxWaitTime,
        this.adaptiveParams.targetWaitTime * 1.2
      );
    }

    // Update load factor
    this.adaptiveParams.loadFactor =
      this.queue.length / this.config.maxBatchSize;
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// BATCHING STRATEGIES
// ============================================================================

export class StaticBatchStrategy implements BatchingStrategy {
  constructor(
    private maxBatchSize: number,
    private maxWaitTime: number
  ) {}

  shouldBatch(request: BatchRequest): boolean {
    return true;
  }

  createBatch(requests: BatchRequest[]): InputBatch {
    return {
      inputs: requests.map(r => r.input),
      ids: requests.map(r => r.id),
      timestamps: requests.map(r => r.timestamp),
      priorities: requests.map(r => r.priority),
    };
  }

  estimateWaitTime(currentSize: number): number {
    // Wait for either full batch or max wait time
    const remaining = Math.max(0, this.maxBatchSize - currentSize);
    return Math.min(this.maxWaitTime, remaining * 0.5);
  }
}

export class PriorityBatchStrategy implements BatchingStrategy {
  constructor(
    private maxBatchSize: number,
    private maxWaitTime: number,
    private priorityThreshold: number = 0.5
  ) {}

  shouldBatch(request: BatchRequest): boolean {
    return request.priority >= this.priorityThreshold;
  }

  createBatch(requests: BatchRequest[]): InputBatch {
    // Sort by priority
    const sorted = [...requests].sort((a, b) => b.priority - a.priority);
    return {
      inputs: sorted.map(r => r.input),
      ids: sorted.map(r => r.id),
      timestamps: sorted.map(r => r.timestamp),
      priorities: sorted.map(r => r.priority),
    };
  }

  estimateWaitTime(currentSize: number): number {
    // High priority requests should wait less
    const avgPriority = currentSize > 0 ? 0.5 : 1.0;
    return this.maxWaitTime * (1 - avgPriority * 0.5);
  }
}

export class DeadlineBatchStrategy implements BatchingStrategy {
  constructor(
    private maxBatchSize: number,
    private maxWaitTime: number
  ) {}

  shouldBatch(request: BatchRequest): boolean {
    const remainingTime = request.timeout - Date.now();
    return remainingTime > this.maxWaitTime;
  }

  createBatch(requests: BatchRequest[]): InputBatch {
    // Sort by deadline (timeout)
    const sorted = [...requests].sort((a, b) => a.timeout - b.timeout);
    return {
      inputs: sorted.map(r => r.input),
      ids: sorted.map(r => r.id),
      timestamps: sorted.map(r => r.timestamp),
      priorities: sorted.map(r => r.priority),
    };
  }

  estimateWaitTime(currentSize: number): number {
    // Don't wait if we have requests with tight deadlines
    return this.maxWaitTime * 0.5;
  }
}

// ============================================================================
// REQUEST BATCHER
// ============================================================================

export class RequestBatcher {
  private batches: Map<string, BatchRequest[]> = new Map();
  private batchTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    private strategy: BatchingStrategy,
    private processor: (batch: InputBatch) => Promise<unknown[]>
  ) {}

  /**
   * Add a request to a batch
   */
  async add(
    batchKey: string,
    input: unknown,
    priority: number = 0
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: this.generateId(),
        input,
        priority,
        timestamp: performance.now(),
        timeout: Date.now() + 5000,
        resolve,
        reject,
      };

      // Get or create batch
      if (!this.batches.has(batchKey)) {
        this.batches.set(batchKey, []);
      }

      const batch = this.batches.get(batchKey)!;
      batch.push(request);

      // Check if we should process the batch
      if (batch.length >= this.strategy.estimateWaitTime(batch.length)) {
        this.processBatch(batchKey);
      } else {
        // Set timeout to process batch
        this.scheduleBatch(batchKey);
      }
    });
  }

  /**
   * Flush all pending batches
   */
  async flush(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const batchKey of this.batches.keys()) {
      promises.push(this.processBatch(batchKey));
    }

    await Promise.all(promises);
  }

  /**
   * Get statistics
   */
  getStats(): RequestBatcherStats {
    const totalRequests = Array.from(this.batches.values()).reduce(
      (sum, batch) => sum + batch.length,
      0
    );

    return {
      pendingBatches: this.batches.size,
      totalRequests,
      avgBatchSize:
        this.batches.size > 0 ? totalRequests / this.batches.size : 0,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async processBatch(batchKey: string): Promise<void> {
    // Clear timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    const batch = this.batches.get(batchKey);
    if (!batch || batch.length === 0) {
      this.batches.delete(batchKey);
      return;
    }

    // Remove from map
    this.batches.delete(batchKey);

    // Create input batch
    const inputBatch = this.strategy.createBatch(batch);

    try {
      // Process batch
      const results = await this.processor(inputBatch);

      // Resolve promises
      for (let i = 0; i < batch.length; i++) {
        if (batch[i].resolve) {
          batch[i].resolve(results[i]);
        }
      }
    } catch (error) {
      // Reject all promises
      for (const request of batch) {
        if (request.reject) {
          request.reject(error);
        }
      }
    }
  }

  private scheduleBatch(batchKey: string): void {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(batchKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const batch = this.batches.get(batchKey);
    if (!batch) return;

    const waitTime = this.strategy.estimateWaitTime(batch.length);

    const timer = setTimeout(() => {
      this.processBatch(batchKey);
    }, waitTime);

    this.batchTimers.set(batchKey, timer);
  }

  private generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface BatchMetrics {
  batchSize: number;
  latency: number;
  efficiency: number;
  dropped: number;
  timestamp: number;
}

export interface BatcherStats {
  queueSize: number;
  avgBatchSize: number;
  avgLatency: number;
  avgEfficiency: number;
  totalBatches: number;
  droppedRequests: number;
  adaptiveParams: {
    targetBatchSize: number;
    targetWaitTime: number;
    loadFactor: number;
  };
}

export interface RequestBatcherStats {
  pendingBatches: number;
  totalRequests: number;
  avgBatchSize: number;
}
