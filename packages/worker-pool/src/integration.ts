/**
 * Integration Layer
 *
 * Integrates the Worker Pool Manager with @lsi/protocol types,
 * CoAgents for worker-aware task routing, and container orchestration.
 */

// Types that would come from @lsi/protocol
interface AequorRequest {
  requestId: string;
  query: string;
  context?: any;
  constraints?: any;
}

interface AequorResponse {
  requestId: string;
  result?: any;
  error?: string;
  confidence?: number;
  timestamp: number;
  processingTime?: number;
}

interface ModelCapabilities {
  [key: string]: any;
}

interface TaskContext {
  taskId?: string;
  urgent?: boolean;
  deadline?: number;
}

import type {
  Worker,
  WorkerPoolConfig,
  WorkerMetrics,
  PoolStatistics,
  Priority,
} from "./types.js";

import { WorkerPoolManager } from "./WorkerPoolManager.js";

/**
 * Container orchestration interface
 */
export interface ContainerOrchestrator {
  startContainer(config: ContainerConfig): Promise<string>;
  stopContainer(containerId: string): Promise<void>;
  getContainerStatus(containerId: string): Promise<ContainerStatus>;
  scaleContainers(count: number): Promise<void>;
}

/**
 * Container configuration
 */
export interface ContainerConfig {
  image: string;
  cpu: string;
  memory: string;
  env?: Record<string, string>;
}

/**
 * Container status
 */
export interface ContainerStatus {
  containerId: string;
  status: "running" | "stopped" | "pending" | "failed";
  cpuUsage: number;
  memoryUsage: number;
}

/**
 * Integration options
 */
export interface IntegrationOptions {
  /** Enable CoAgents integration */
  enableCoAgents?: boolean;
  /** Enable container orchestration */
  enableContainerOrchestration?: boolean;
  /** Container orchestrator instance */
  containerOrchestrator?: ContainerOrchestrator;
}

/**
 * Integrated Worker Pool with protocol and orchestration support
 */
export class IntegratedWorkerPool {
  private pool: WorkerPoolManager;
  private options: IntegrationOptions;
  private containerMap: Map<string, string>; // workerId -> containerId

  constructor(
    config: WorkerPoolConfig & { workerFactory: () => Promise<Worker> },
    options: IntegrationOptions = {}
  ) {
    this.options = {
      enableCoAgents: true,
      enableContainerOrchestration: false,
      ...options,
    };

    this.pool = new WorkerPoolManager(config);
    this.containerMap = new Map();
  }

  /**
   * Start the integrated pool
   */
  async start(): Promise<void> {
    await this.pool.start();

    if (
      this.options.enableContainerOrchestration &&
      this.options.containerOrchestrator
    ) {
      await this.initializeContainers();
    }
  }

  /**
   * Stop the integrated pool
   */
  async stop(): Promise<void> {
    if (
      this.options.enableContainerOrchestration &&
      this.options.containerOrchestrator
    ) {
      await this.cleanupContainers();
    }

    await this.pool.stop();
  }

  /**
   * Process an Aequor request using worker pool
   */
  async processRequest(request: AequorRequest): Promise<AequorResponse> {
    // Determine priority based on request context
    const priority = this.determinePriority(request);

    // Reserve a worker
    const workers = await this.pool.reserveWorkers(1, priority);

    try {
      const worker = workers[0];

      // Execute request on worker
      const response = await this.executeOnWorker(worker, request);

      return response;
    } finally {
      // Always release worker
      this.pool.releaseWorkers(workers);
    }
  }

  /**
   * Process multiple requests in parallel
   */
  async processRequests(requests: AequorRequest[]): Promise<AequorResponse[]> {
    const results = await Promise.all(
      requests.map(req => this.processRequest(req))
    );

    return results;
  }

  /**
   * Get pool statistics with protocol-specific data
   */
  getPoolStatistics(): PoolStatistics & {
    containersActive: number;
    protocolRequestsProcessed: number;
  } {
    const stats = this.pool.getPoolStats();

    return {
      ...stats,
      containersActive: this.containerMap.size,
      protocolRequestsProcessed: stats.totalRequestsProcessed,
    };
  }

  /**
   * Scale pool and containers
   */
  async scaleTo(count: number): Promise<void> {
    if (
      this.options.enableContainerOrchestration &&
      this.options.containerOrchestrator
    ) {
      await this.options.containerOrchestrator.scaleContainers(count);
    }

    await this.pool.scaleTo(count);
  }

  /**
   * Determine request priority from Aequor request
   */
  private determinePriority(request: AequorRequest): Priority {
    // Check for priority flags in context
    if (request.context?.priority === "critical") {
      return "critical";
    }

    // Real-time requests get high priority
    if (
      request.constraints?.maxLatency &&
      request.constraints.maxLatency < 1000
    ) {
      return "high";
    }

    // Batch requests get low priority
    if (request.context?.batch === true) {
      return "low";
    }

    return "normal";
  }

  /**
   * Execute request on worker
   */
  private async executeOnWorker(
    worker: Worker,
    request: AequorRequest
  ): Promise<AequorResponse> {
    // In a real implementation, would send request to worker and wait for response
    // For now, simulate execution

    const startTime = Date.now();

    try {
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        requestId: request.requestId,
        result: {
          content: "Simulated response",
          metadata: {
            model: "worker-pool",
            processedAt: new Date().toISOString(),
          },
        },
        confidence: 0.9,
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        requestId: request.requestId,
        error: String(error),
        timestamp: Date.now(),
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Initialize containers for workers
   */
  private async initializeContainers(): Promise<void> {
    if (!this.options.containerOrchestrator) {
      return;
    }

    const config: ContainerConfig = {
      image: "lsi/worker:latest",
      cpu: "1",
      memory: "1Gi",
    };

    const stats = this.pool.getPoolStats();
    const containerCount = Math.max(stats.totalWorkers, 2);

    for (let i = 0; i < containerCount; i++) {
      try {
        const containerId =
          await this.options.containerOrchestrator.startContainer(config);
        // Map would be populated as workers are created
      } catch (error) {
        console.error("Failed to start container:", error);
      }
    }
  }

  /**
   * Cleanup containers
   */
  private async cleanupContainers(): Promise<void> {
    if (!this.options.containerOrchestrator) {
      return;
    }

    const containerIds = Array.from(this.containerMap.values());

    await Promise.all(
      containerIds.map(id =>
        this.options.containerOrchestrator!.stopContainer(id)
      )
    );

    this.containerMap.clear();
  }

  /**
   * Get underlying pool manager
   */
  getPoolManager(): WorkerPoolManager {
    return this.pool;
  }
}

/**
 * Worker-aware task routing for CoAgents
 */
export class WorkerAwareRouter {
  private pool: WorkerPoolManager;

  constructor(pool: WorkerPoolManager) {
    this.pool = pool;
  }

  /**
   * Route task to best available worker
   */
  async routeTask(task: TaskContext): Promise<Worker | null> {
    const priority = this.determineTaskPriority(task);
    const workers = await this.pool.reserveWorkers(1, priority);

    if (workers.length === 0) {
      return null;
    }

    return workers[0];
  }

  /**
   * Determine task priority
   */
  private determineTaskPriority(task: TaskContext): Priority {
    if (task.urgent) {
      return "critical";
    }

    if (task.deadline && task.deadline - Date.now() < 5000) {
      return "high";
    }

    return "normal";
  }

  /**
   * Get pool health for routing decisions
   */
  getPoolHealth(): {
    healthy: boolean;
    utilization: number;
    queueDepth: number;
    recommendation: "scale-up" | "scale-down" | "maintain";
  } {
    const stats = this.pool.getPoolStats();

    let recommendation: "scale-up" | "scale-down" | "maintain" = "maintain";

    if (stats.utilizationPercentage > 80 || stats.queueDepth > 50) {
      recommendation = "scale-up";
    } else if (stats.utilizationPercentage < 20 && stats.totalWorkers > 2) {
      recommendation = "scale-down";
    }

    return {
      healthy:
        stats.utilizationPercentage < 90 &&
        stats.queueDepth < stats.totalWorkers * 10,
      utilization: stats.utilizationPercentage,
      queueDepth: stats.queueDepth,
      recommendation,
    };
  }
}

/**
 * Integration helper functions
 */
export class IntegrationHelpers {
  /**
   * Create worker factory from container orchestrator
   */
  static createContainerWorkerFactory(
    orchestrator: ContainerOrchestrator,
    config: ContainerConfig
  ): () => Promise<Worker> {
    return async () => {
      const containerId = await orchestrator.startContainer(config);

      // Return a mock worker that references the container
      return {
        postMessage: async (data: unknown) => {
          // In real implementation, would send message to container
        },
        terminate: async () => {
          await orchestrator.stopContainer(containerId);
        },
        containerId,
      } as unknown as Worker;
    };
  }

  /**
   * Map Aequor constraints to pool configuration
   */
  static constraintsToPoolConfig(constraints: {
    maxCost?: number;
    maxLatency?: number;
    privacy?: "strict" | "moderate" | "none";
  }): Partial<WorkerPoolConfig> {
    const config: Partial<WorkerPoolConfig> = {};

    // Lower latency requirement = more warm workers
    if (constraints.maxLatency) {
      if (constraints.maxLatency < 500) {
        config.warmStandbyCount = 5;
        config.minWorkers = 3;
      } else if (constraints.maxLatency < 2000) {
        config.warmStandbyCount = 2;
        config.minWorkers = 2;
      }
    }

    // Cost constraints = limit max workers
    if (constraints.maxCost && constraints.maxCost < 10) {
      config.maxWorkers = 5;
    }

    return config;
  }

  /**
   * Create CoAgents-compatible pool
   */
  static createCoAgentsPool(
    config: WorkerPoolConfig & { workerFactory: () => Promise<Worker> }
  ): IntegratedWorkerPool {
    return new IntegratedWorkerPool(config, {
      enableCoAgents: true,
      enableContainerOrchestration: false,
    });
  }
}
