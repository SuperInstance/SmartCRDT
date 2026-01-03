/**
 * Worker Lifecycle Manager
 *
 * Manages the complete lifecycle of workers including initialization,
 * warmup, health monitoring, auto-replacement, and graceful shutdown.
 */

import type {
  Worker,
  WorkerState,
  WorkerMetrics,
  WorkerEvent,
  WorkerEventHandler,
  WarmupTask,
  HealthCheckResult,
  WorkerFactory,
} from "./types.js";

/**
 * Worker Lifecycle Manager
 */
export class WorkerLifecycle {
  private workers: Map<string, WorkerWrapper>;
  private workerFactory: WorkerFactory;
  private warmupTasks: WarmupTask[];
  private eventHandlers: Set<WorkerEventHandler>;
  private healthCheckInterval: number;
  private maxHealthCheckFailures: number;
  private warmupTimeout: number;
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private metricsEnabled: boolean;

  /**
   * Create a new worker lifecycle manager
   */
  constructor(
    workerFactory: WorkerFactory,
    options: {
      healthCheckInterval?: number;
      maxHealthCheckFailures?: number;
      warmupTimeout?: number;
      enableMetrics?: boolean;
    } = {}
  ) {
    this.workerFactory = workerFactory;
    this.workers = new Map();
    this.warmupTasks = [];
    this.eventHandlers = new Set();
    this.healthCheckInterval = options.healthCheckInterval || 30000;
    this.maxHealthCheckFailures = options.maxHealthCheckFailures || 3;
    this.warmupTimeout = options.warmupTimeout || 30000;
    this.metricsEnabled = options.enableMetrics !== false;
  }

  /**
   * Initialize a new worker
   */
  async initializeWorker(workerId: string): Promise<Worker> {
    const worker = await this.workerFactory(workerId);
    const wrapper: WorkerWrapper = {
      id: workerId,
      worker,
      state: "warming",
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      healthCheckFailures: 0,
      requestsProcessed: 0,
      totalLatency: 0,
      activeConnections: 0,
    };

    this.workers.set(workerId, wrapper);
    this.emitEvent({
      type: "initialized",
      workerId,
      timestamp: Date.now(),
    });

    // Start warmup
    await this.warmupWorker(workerId);

    return worker;
  }

  /**
   * Warm up a worker with registered warmup tasks
   */
  async warmupWorker(workerId: string): Promise<void> {
    const wrapper = this.workers.get(workerId);
    if (!wrapper) {
      throw new Error(`Worker ${workerId} not found`);
    }

    wrapper.state = "warming";
    this.emitEvent({
      type: "warming",
      workerId,
      timestamp: Date.now(),
    });

    try {
      const warmupStart = Date.now();

      // Run all warmup tasks in sequence
      for (const task of this.warmupTasks) {
        const taskStart = Date.now();

        try {
          await Promise.race([
            task.fn(),
            this.createTimeout(this.warmupTimeout),
          ]);

          const taskDuration = Date.now() - taskStart;
          // Could log task durations here
        } catch (error) {
          console.error(
            `Warmup task "${task.name}" failed for worker ${workerId}:`,
            error
          );
          throw error;
        }
      }

      const totalWarmupTime = Date.now() - warmupStart;

      wrapper.state = "idle";
      this.emitEvent({
        type: "ready",
        workerId,
        timestamp: Date.now(),
        data: { warmupTime: totalWarmupTime },
      });
    } catch (error) {
      wrapper.state = "terminated";
      this.emitEvent({
        type: "failed",
        workerId,
        timestamp: Date.now(),
        data: { error: String(error) },
      });
      throw error;
    }
  }

  /**
   * Register a warmup task
   */
  registerWarmupTask(task: WarmupTask): void {
    this.warmupTasks.push(task);
  }

  /**
   * Register a warmup task from a function
   */
  registerWarmupTaskFn(
    name: string,
    fn: () => Promise<void>,
    expectedDuration?: number
  ): void {
    this.registerWarmupTask({ name, fn, expectedDuration });
  }

  /**
   * Clear all warmup tasks
   */
  clearWarmupTasks(): void {
    this.warmupTasks = [];
  }

  /**
   * Perform health check on a worker
   */
  async healthCheck(workerId: string): Promise<HealthCheckResult> {
    const wrapper = this.workers.get(workerId);
    if (!wrapper) {
      return {
        workerId,
        healthy: false,
        responseTime: 0,
        error: "Worker not found",
        timestamp: Date.now(),
      };
    }

    const startTime = Date.now();

    try {
      // Simulate health check - in real implementation would ping worker
      // For now, just check if worker exists and is not terminated
      await Promise.race([
        this.pingWorker(wrapper.worker),
        this.createTimeout(5000), // 5 second timeout for health check
      ]);

      const responseTime = Date.now() - startTime;

      // Reset failure counter on success
      wrapper.healthCheckFailures = 0;
      wrapper.lastActivityAt = Date.now();

      return {
        workerId,
        healthy: true,
        responseTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      wrapper.healthCheckFailures++;

      const result: HealthCheckResult = {
        workerId,
        healthy: false,
        responseTime,
        error: String(error),
        timestamp: Date.now(),
      };

      // Check if worker should be replaced
      if (wrapper.healthCheckFailures >= this.maxHealthCheckFailures) {
        this.emitEvent({
          type: "failed",
          workerId,
          timestamp: Date.now(),
          data: {
            error: `Max health check failures (${this.maxHealthCheckFailures}) exceeded`,
            consecutiveFailures: wrapper.healthCheckFailures,
          },
        });

        // Auto-replace if enabled
        await this.replaceWorker(workerId);
      }

      return result;
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      const workerIds = Array.from(this.workers.keys());

      for (const workerId of workerIds) {
        const wrapper = this.workers.get(workerId);
        if (
          wrapper &&
          wrapper.state !== "terminated" &&
          wrapper.state !== "draining"
        ) {
          await this.healthCheck(workerId);
        }
      }
    }, this.healthCheckInterval);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Replace a failed worker with a new one
   */
  async replaceWorker(oldWorkerId: string): Promise<string | null> {
    const oldWrapper = this.workers.get(oldWorkerId);
    if (!oldWrapper) {
      return null;
    }

    // Terminate old worker
    await this.terminateWorker(oldWorkerId, false);

    // Create new worker with same ID (or generate new one)
    const newWorkerId = `${oldWorkerId.replace("-replaced", "")}-replaced-${Date.now()}`;

    try {
      await this.initializeWorker(newWorkerId);

      this.emitEvent({
        type: "replaced",
        workerId: newWorkerId,
        timestamp: Date.now(),
        data: { replacedWorker: oldWorkerId },
      });

      return newWorkerId;
    } catch (error) {
      console.error(`Failed to replace worker ${oldWorkerId}:`, error);
      return null;
    }
  }

  /**
   * Drain a worker (finish current work, stop accepting new work)
   */
  async drainWorker(workerId: string): Promise<void> {
    const wrapper = this.workers.get(workerId);
    if (!wrapper) {
      throw new Error(`Worker ${workerId} not found`);
    }

    wrapper.state = "draining";
    this.emitEvent({
      type: "draining",
      workerId,
      timestamp: Date.now(),
    });

    // Wait for active connections to complete
    const maxWait = 30000; // 30 seconds
    const start = Date.now();

    while (wrapper.activeConnections > 0 && Date.now() - start < maxWait) {
      await this.sleep(100);
    }

    // Terminate worker
    await this.terminateWorker(workerId);
  }

  /**
   * Terminate a worker
   */
  async terminateWorker(
    workerId: string,
    graceful: boolean = true
  ): Promise<void> {
    const wrapper = this.workers.get(workerId);
    if (!wrapper) {
      return;
    }

    if (graceful) {
      wrapper.state = "draining";
      this.emitEvent({
        type: "draining",
        workerId,
        timestamp: Date.now(),
      });
    }

    // In a real implementation, would properly terminate the worker
    // For now, just mark as terminated
    wrapper.state = "terminated";

    this.emitEvent({
      type: "terminated",
      workerId,
      timestamp: Date.now(),
    });

    // Remove from map
    this.workers.delete(workerId);
  }

  /**
   * Drain all workers
   */
  async drainAll(): Promise<void> {
    const workerIds = Array.from(this.workers.keys());

    await Promise.all(workerIds.map(id => this.drainWorker(id)));
  }

  /**
   * Mark worker as reserved
   */
  markReserved(workerId: string): void {
    const wrapper = this.workers.get(workerId);
    if (wrapper) {
      wrapper.state = "busy";
      wrapper.activeConnections++;
      wrapper.lastActivityAt = Date.now();

      this.emitEvent({
        type: "reserved",
        workerId,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Mark worker as released
   */
  markReleased(workerId: string, latency: number = 0): void {
    const wrapper = this.workers.get(workerId);
    if (wrapper) {
      wrapper.state = "idle";
      wrapper.activeConnections--;
      wrapper.requestsProcessed++;
      wrapper.totalLatency += latency;
      wrapper.lastActivityAt = Date.now();

      this.emitEvent({
        type: "released",
        workerId,
        timestamp: Date.now(),
        data: { latency },
      });
    }
  }

  /**
   * Get worker metrics
   */
  getWorkerMetrics(workerId: string): WorkerMetrics | null {
    const wrapper = this.workers.get(workerId);
    if (!wrapper) {
      return null;
    }

    return {
      workerId: wrapper.id,
      state: wrapper.state,
      cpuUsage: 0, // Would collect actual CPU usage in real implementation
      memoryUsage: 0, // Would collect actual memory usage
      requestsProcessed: wrapper.requestsProcessed,
      avgLatency:
        wrapper.requestsProcessed > 0
          ? wrapper.totalLatency / wrapper.requestsProcessed
          : 0,
      activeConnections: wrapper.activeConnections,
      healthCheckFailures: wrapper.healthCheckFailures,
      createdAt: wrapper.createdAt,
      lastActivityAt: wrapper.lastActivityAt,
      uptime: Date.now() - wrapper.createdAt,
    };
  }

  /**
   * Get all worker metrics
   */
  getAllWorkerMetrics(): WorkerMetrics[] {
    const metrics: WorkerMetrics[] = [];

    this.workers.forEach((wrapper, workerId) => {
      const workerMetrics = this.getWorkerMetrics(workerId);
      if (workerMetrics) {
        metrics.push(workerMetrics);
      }
    });

    return metrics;
  }

  /**
   * Get worker state
   */
  getWorkerState(workerId: string): WorkerState | null {
    const wrapper = this.workers.get(workerId);
    return wrapper?.state || null;
  }

  /**
   * Get all workers
   */
  getAllWorkers(): Worker[] {
    const workers: Worker[] = [];
    this.workers.forEach(wrapper => {
      if (wrapper.state !== "terminated") {
        workers.push(wrapper.worker);
      }
    });
    return workers;
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): Worker | null {
    const wrapper = this.workers.get(workerId);
    return wrapper?.worker || null;
  }

  /**
   * Get workers by state
   */
  getWorkersByState(state: WorkerState): Worker[] {
    const workers: Worker[] = [];

    this.workers.forEach(wrapper => {
      if (wrapper.state === state) {
        workers.push(wrapper.worker);
      }
    });

    return workers;
  }

  /**
   * Register event handler
   */
  on(event: WorkerEventHandler): void {
    this.eventHandlers.add(event);
  }

  /**
   * Unregister event handler
   */
  off(event: WorkerEventHandler): void {
    this.eventHandlers.delete(event);
  }

  /**
   * Emit event to all handlers
   */
  private emitEvent(event: WorkerEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in worker event handler:", error);
      }
    });
  }

  /**
   * Ping worker to check if it's responsive
   */
  private async pingWorker(worker: Worker): Promise<void> {
    // In a real implementation, would send a ping message to the worker
    // For now, just simulate a successful ping
    await this.sleep(10);

    // Check if worker is still valid
    if (!worker) {
      throw new Error("Worker is null or undefined");
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout")), ms);
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up all workers
   */
  async cleanup(): Promise<void> {
    this.stopHealthChecks();
    await this.drainAll();
    this.workers.clear();
    this.eventHandlers.clear();
  }

  /**
   * Get worker count
   */
  getWorkerCount(): number {
    return this.workers.size;
  }

  /**
   * Get worker count by state
   */
  getWorkerCountByState(): Record<WorkerState, number> {
    const counts: Record<WorkerState, number> = {
      idle: 0,
      busy: 0,
      warming: 0,
      draining: 0,
      terminated: 0,
    };

    this.workers.forEach(wrapper => {
      counts[wrapper.state]++;
    });

    return counts;
  }
}

/**
 * Internal worker wrapper
 */
interface WorkerWrapper {
  id: string;
  worker: Worker;
  state: WorkerState;
  createdAt: number;
  lastActivityAt: number;
  healthCheckFailures: number;
  requestsProcessed: number;
  totalLatency: number;
  activeConnections: number;
}
