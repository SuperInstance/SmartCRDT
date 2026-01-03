/**
 * Worker Pool Manager
 *
 * Main orchestrator for worker pool management including worker
 * reservation, warm standby, scaling, and graceful shutdown.
 */

import type {
  Worker,
  WorkerPoolConfig,
  PoolStatistics,
  Priority,
  QueuedRequest,
  WarmupTask,
  ScaleResult,
  DrainResult,
  WorkerEvent,
  WorkerEventHandler,
} from "./types.js";
import { DEFAULT_WORKER_POOL_CONFIG } from "./types.js";
import { WorkerLifecycle } from "./WorkerLifecycle.js";
import { PriorityQueue } from "./PriorityQueue.js";
import { LoadBalancer } from "./LoadBalancer.js";

/**
 * Worker Pool Manager
 */
export class WorkerPoolManager {
  private config: WorkerPoolConfig;
  private lifecycle: WorkerLifecycle;
  private loadBalancer: LoadBalancer;
  private queue: PriorityQueue;
  private workerCounter: number;
  private isRunning: boolean;
  private isShuttingDown: boolean;
  private eventHandlers: Set<WorkerEventHandler>;
  private queueProcessorTimer?: ReturnType<typeof setInterval>;

  /**
   * Create a new worker pool manager
   */
  constructor(
    config: WorkerPoolConfig & {
      workerFactory: () => Promise<Worker> | Worker;
    }
  ) {
    this.config = { ...DEFAULT_WORKER_POOL_CONFIG, ...config };
    this.workerCounter = 0;
    this.isRunning = false;
    this.isShuttingDown = false;
    this.eventHandlers = new Set();

    // Initialize components
    this.lifecycle = new WorkerLifecycle(config.workerFactory, {
      healthCheckInterval: this.config.healthCheckInterval,
      maxHealthCheckFailures: this.config.maxHealthCheckFailures,
      warmupTimeout: this.config.warmupTimeout,
      enableMetrics: this.config.enableMetrics,
    });

    this.loadBalancer = new LoadBalancer(
      this.lifecycle,
      this.config.loadBalancingStrategy,
      {
        enableBackpressure: true,
        maxConnectionsPerWorker: 100,
      }
    );

    this.queue = new PriorityQueue(
      this.config.maxQueueDepth,
      this.config.maxQueueWaitTime
    );

    // Forward lifecycle events
    this.lifecycle.on(event => this.emitEvent(event));
  }

  /**
   * Start the worker pool
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Initialize minimum workers
    await this.scaleTo(this.config.minWorkers);

    // Warm standby workers
    if (this.config.warmStandbyCount > 0) {
      await this.warmStandby(this.config.warmStandbyCount);
    }

    // Start health checks
    this.lifecycle.startHealthChecks();

    // Start queue processor
    this.startQueueProcessor();
  }

  /**
   * Stop the worker pool
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isShuttingDown = true;

    // Stop queue processor
    this.stopQueueProcessor();

    // Stop health checks
    this.lifecycle.stopHealthChecks();

    // Drain all workers
    await this.drainAll();

    // Clean up
    await this.lifecycle.cleanup();
    this.queue.clear();
    this.loadBalancer.cleanup();

    this.isRunning = false;
    this.isShuttingDown = false;
  }

  /**
   * Reserve workers from the pool
   */
  async reserveWorkers(
    count: number,
    priority: Priority = "normal"
  ): Promise<Worker[]> {
    if (this.isShuttingDown) {
      throw new Error("Pool is shutting down");
    }

    // Try to get workers immediately
    const workers = this.loadBalancer.selectWorkers(count);

    if (workers.length === count) {
      // Mark workers as reserved
      workers.forEach(worker => {
        const workerId = this.getWorkerId(worker);
        if (workerId) {
          this.lifecycle.markReserved(workerId);
        }
      });

      return workers;
    }

    // Not enough workers available, queue the request
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        priority,
        queuedAt: Date.now(),
        resolve: (workers: Worker[]) => {
          workers.forEach(worker => {
            const workerId = this.getWorkerId(worker);
            if (workerId) {
              this.lifecycle.markReserved(workerId);
            }
          });
          resolve(workers);
        },
        reject: (error: Error) => reject(error),
        workerCount: count,
        timeout: this.config.maxQueueWaitTime,
      };

      const enqueued = this.queue.enqueue(request);
      if (!enqueued) {
        reject(new Error("Queue is full"));
      }
    });
  }

  /**
   * Release workers back to the pool
   */
  releaseWorkers(workers: Worker[]): void {
    workers.forEach(worker => {
      const workerId = this.getWorkerId(worker);
      if (workerId) {
        this.lifecycle.markReleased(workerId);
      }
    });

    // Process queue after releasing workers
    this.processQueue();
  }

  /**
   * Warm up standby workers
   */
  async warmStandby(count: number): Promise<void> {
    const idleWorkers = this.lifecycle.getWorkersByState("idle");
    const currentWarm = idleWorkers.length;
    const needed = Math.max(0, count - currentWarm);

    if (needed === 0) {
      return;
    }

    // Create and warm additional workers
    const workersToAdd = Math.min(
      needed,
      this.config.maxWorkers - this.lifecycle.getWorkerCount()
    );

    await Promise.all(
      Array.from({ length: workersToAdd }, async () => {
        const workerId = this.generateWorkerId();
        await this.lifecycle.initializeWorker(workerId);
      })
    );
  }

  /**
   * Get current pool statistics
   */
  getPoolStats(): PoolStatistics {
    const stateCounts = this.lifecycle.getWorkerCountByState();
    const allMetrics = this.lifecycle.getAllWorkerMetrics();
    const queueStats = this.queue.getStats();

    // Calculate averages
    let totalCpu = 0;
    let totalMemory = 0;
    let totalLatency = 0;
    let totalRequests = 0;

    allMetrics.forEach(metrics => {
      totalCpu += metrics.cpuUsage;
      totalMemory += metrics.memoryUsage;
      totalLatency += metrics.avgLatency * metrics.requestsProcessed;
      totalRequests += metrics.requestsProcessed;
    });

    const activeCount = stateCounts.busy;
    const utilization =
      allMetrics.length > 0 ? (activeCount / allMetrics.length) * 100 : 0;

    return {
      totalWorkers: this.lifecycle.getWorkerCount(),
      activeWorkers: stateCounts.busy,
      idleWorkers: stateCounts.idle,
      warmingWorkers: stateCounts.warming,
      drainingWorkers: stateCounts.draining,
      terminatedWorkers: stateCounts.terminated,
      queueDepth: queueStats.totalDepth,
      utilizationPercentage: utilization,
      warmWorkers: stateCounts.idle, // Idle workers are warmed
      avgCpuUsage: allMetrics.length > 0 ? totalCpu / allMetrics.length : 0,
      avgMemoryUsage:
        allMetrics.length > 0 ? totalMemory / allMetrics.length : 0,
      avgLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      totalRequestsProcessed: totalRequests,
      timestamp: Date.now(),
    };
  }

  /**
   * Scale pool to target size
   */
  async scaleTo(targetCount: number): Promise<ScaleResult> {
    const currentCount = this.lifecycle.getWorkerCount();
    const target = Math.max(
      this.config.minWorkers,
      Math.min(this.config.maxWorkers, targetCount)
    );

    const result: ScaleResult = {
      previousCount: currentCount,
      newCount: currentCount,
      workersAdded: 0,
      workersRemoved: 0,
      timestamp: Date.now(),
    };

    if (target > currentCount) {
      // Scale up
      const toAdd = target - currentCount;
      const workersToAdd = Math.min(
        toAdd,
        this.config.maxWorkers - currentCount
      );

      await Promise.all(
        Array.from({ length: workersToAdd }, async () => {
          const workerId = this.generateWorkerId();
          await this.lifecycle.initializeWorker(workerId);
        })
      );

      result.workersAdded = workersToAdd;
      result.newCount = currentCount + workersToAdd;
    } else if (target < currentCount) {
      // Scale down - drain excess workers
      const toRemove = currentCount - target;
      const idleWorkers = this.lifecycle.getWorkersByState("idle");

      const workersToDrain = idleWorkers.slice(0, toRemove);
      await Promise.all(
        workersToDrain.map(worker => {
          const workerId = this.getWorkerId(worker);
          return workerId
            ? this.lifecycle.drainWorker(workerId)
            : Promise.resolve();
        })
      );

      result.workersRemoved = workersToDrain.length;
      result.newCount = currentCount - workersToDrain.length;
    }

    return result;
  }

  /**
   * Drain all workers gracefully
   */
  async drainAll(): Promise<DrainResult> {
    const start = Date.now();
    const statsBefore = this.getPoolStats();
    const requestsBefore = statsBefore.totalRequestsProcessed;

    // Clear the queue
    this.queue.clear();

    // Drain all workers
    await this.lifecycle.drainAll();

    const statsAfter = this.getPoolStats();
    const end = Date.now();

    return {
      workersDrained: statsBefore.totalWorkers,
      requestsCompleted: statsAfter.totalRequestsProcessed - requestsBefore,
      requestsCancelled: this.queue.getTotalDepth(),
      drainTime: end - start,
      timestamp: end,
    };
  }

  /**
   * Perform health check on a specific worker
   */
  async healthCheck(workerId: string): Promise<boolean> {
    const result = await this.lifecycle.healthCheck(workerId);
    return result.healthy;
  }

  /**
   * Register a warmup task
   */
  registerWarmupTask(task: WarmupTask): void {
    this.lifecycle.registerWarmupTask(task);
  }

  /**
   * Register a warmup task function
   */
  registerWarmupTaskFn(
    name: string,
    fn: () => Promise<void>,
    expectedDuration?: number
  ): void {
    this.lifecycle.registerWarmupTaskFn(name, fn, expectedDuration);
  }

  /**
   * Clear all warmup tasks
   */
  clearWarmupTasks(): void {
    this.lifecycle.clearWarmupTasks();
  }

  /**
   * Register event handler
   */
  on(handler: WorkerEventHandler): void {
    this.eventHandlers.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(handler: WorkerEventHandler): void {
    this.eventHandlers.delete(handler);
  }

  /**
   * Set load balancing strategy
   */
  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this.loadBalancer.setStrategy(strategy);
    this.config.loadBalancingStrategy = strategy;
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): Worker | null {
    return this.lifecycle.getWorker(workerId);
  }

  /**
   * Get all workers
   */
  getAllWorkers(): Worker[] {
    return this.lifecycle.getAllWorkers();
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.queue.getStats();
  }

  /**
   * Get load balancer statistics
   */
  getLoadBalancerStats() {
    return this.loadBalancer.getStats();
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    if (this.queueProcessorTimer) {
      return;
    }

    this.queueProcessorTimer = setInterval(() => {
      this.processQueue();
    }, 100); // Process queue every 100ms
  }

  /**
   * Stop queue processor
   */
  private stopQueueProcessor(): void {
    if (this.queueProcessorTimer) {
      clearInterval(this.queueProcessorTimer);
      this.queueProcessorTimer = undefined;
    }
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    // Clean up expired requests first
    this.queue.cleanExpiredRequests();

    // Process as many requests as possible
    while (true) {
      const request = this.queue.dequeue();
      if (!request) {
        break;
      }

      // Try to fulfill the request
      const workers = this.loadBalancer.selectWorkers(request.workerCount);

      if (workers.length === request.workerCount) {
        // Clear timeout
        if (request.timeout) {
          clearTimeout(request.timeout);
        }
        // Resolve with workers
        request.resolve(workers);
      } else {
        // Not enough workers, put back in queue
        this.queue.enqueue(request);
        break;
      }
    }
  }

  /**
   * Generate unique worker ID
   */
  private generateWorkerId(): string {
    return `worker-${Date.now()}-${++this.workerCounter}`;
  }

  /**
   * Get worker ID from worker object
   */
  private getWorkerId(worker: Worker): string | null {
    const allMetrics = this.lifecycle.getAllWorkerMetrics();

    for (const metrics of allMetrics) {
      const w = this.lifecycle.getWorker(metrics.workerId);
      if (w === worker) {
        return metrics.workerId;
      }
    }

    return null;
  }

  /**
   * Emit event to all handlers
   */
  private emitEvent(event: WorkerEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in worker pool event handler:", error);
      }
    });
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<WorkerPoolConfig>): void {
    this.config = { ...this.config, ...updates };

    // Update queue settings
    if (updates.maxQueueDepth !== undefined) {
      this.queue.setMaxDepth(updates.maxQueueDepth);
    }
    if (updates.maxQueueWaitTime !== undefined) {
      this.queue.setMaxWaitTime(updates.maxQueueWaitTime);
    }

    // Update load balancer strategy
    if (updates.loadBalancingStrategy !== undefined) {
      this.loadBalancer.setStrategy(updates.loadBalancingStrategy);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): WorkerPoolConfig {
    return { ...this.config };
  }

  /**
   * Check if pool is running
   */
  isActive(): boolean {
    return this.isRunning && !this.isShuttingDown;
  }

  /**
   * Check if pool is shutting down
   */
  isShutting(): boolean {
    return this.isShuttingDown;
  }
}

/**
 * Import LoadBalancingStrategy for type usage
 */
type LoadBalancingStrategy =
  | "round-robin"
  | "least-connections"
  | "least-latency";
