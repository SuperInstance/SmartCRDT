/**
 * Worker Pool Types
 *
 * Core types for the Worker Pool Manager, including worker states,
 * configurations, metrics, and statistics.
 */

/**
 * Generic Worker interface compatible with Web Workers and Worker Threads
 */
export interface Worker {
  postMessage?(data: unknown): void;
  terminate?(): void;
  onmessage?: ((event: MessageEvent) => void) | null;
  onerror?: ((event: ErrorEvent) => void) | null;
  addEventListener?(type: string, listener: EventListener): void;
  removeEventListener?(type: string, listener: EventListener): void;
}

/**
 * Possible states for a worker in the pool
 */
export type WorkerState =
  | "idle"
  | "busy"
  | "warming"
  | "draining"
  | "terminated";

/**
 * Priority levels for requests and worker reservations
 */
export type Priority = "critical" | "high" | "normal" | "low";

/**
 * Load balancing strategies
 */
export type LoadBalancingStrategy =
  | "round-robin"
  | "least-connections"
  | "least-latency";

/**
 * Worker lifecycle event types
 */
export type WorkerEventType =
  | "initialized"
  | "warming"
  | "ready"
  | "reserved"
  | "released"
  | "failed"
  | "replaced"
  | "draining"
  | "terminated";

/**
 * Worker event payload
 */
export interface WorkerEvent {
  type: WorkerEventType;
  workerId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * Worker callback event handler
 */
export type WorkerEventHandler = (event: WorkerEvent) => void;

/**
 * Configuration for a worker pool
 */
export interface WorkerPoolConfig {
  /** Minimum number of workers to maintain */
  minWorkers: number;
  /** Maximum number of workers allowed */
  maxWorkers: number;
  /** Number of workers to keep in warm standby */
  warmStandbyCount: number;
  /** Timeout for worker warmup (ms) */
  warmupTimeout: number;
  /** Interval for health checks (ms) */
  healthCheckInterval: number;
  /** Maximum number of health check failures before replacement */
  maxHealthCheckFailures: number;
  /** Maximum time a request can wait in queue (ms) */
  maxQueueWaitTime: number;
  /** Maximum queue depth before rejection */
  maxQueueDepth: number;
  /** Load balancing strategy */
  loadBalancingStrategy: LoadBalancingStrategy;
  /** Enable worker auto-replacement on failure */
  enableAutoReplacement: boolean;
  /** Enable metrics collection */
  enableMetrics: boolean;
}

/**
 * Default worker pool configuration
 */
export const DEFAULT_WORKER_POOL_CONFIG: WorkerPoolConfig = {
  minWorkers: 2,
  maxWorkers: 10,
  warmStandbyCount: 2,
  warmupTimeout: 30000,
  healthCheckInterval: 30000,
  maxHealthCheckFailures: 3,
  maxQueueWaitTime: 60000,
  maxQueueDepth: 100,
  loadBalancingStrategy: "least-connections",
  enableAutoReplacement: true,
  enableMetrics: true,
};

/**
 * Individual worker metrics
 */
export interface WorkerMetrics {
  /** Worker unique identifier */
  workerId: string;
  /** Current state of the worker */
  state: WorkerState;
  /** CPU usage percentage (0-100) */
  cpuUsage: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Total number of requests processed */
  requestsProcessed: number;
  /** Average request latency in milliseconds */
  avgLatency: number;
  /** Current number of active connections */
  activeConnections: number;
  /** Number of consecutive health check failures */
  healthCheckFailures: number;
  /** Timestamp when worker was created */
  createdAt: number;
  /** Timestamp of last activity */
  lastActivityAt: number;
  /** Total uptime in milliseconds */
  uptime: number;
}

/**
 * Aggregate pool statistics
 */
export interface PoolStatistics {
  /** Total number of workers in the pool */
  totalWorkers: number;
  /** Number of workers currently processing requests */
  activeWorkers: number;
  /** Number of idle workers ready for work */
  idleWorkers: number;
  /** Number of workers currently warming up */
  warmingWorkers: number;
  /** Number of workers being drained */
  drainingWorkers: number;
  /** Number of workers terminated */
  terminatedWorkers: number;
  /** Current depth of the pending request queue */
  queueDepth: number;
  /** Pool utilization percentage (0-100) */
  utilizationPercentage: number;
  /** Number of warm standby workers */
  warmWorkers: number;
  /** Average CPU usage across all workers (0-100) */
  avgCpuUsage: number;
  /** Average memory usage across all workers (bytes) */
  avgMemoryUsage: number;
  /** Average request latency across all workers (ms) */
  avgLatency: number;
  /** Total requests processed by the pool */
  totalRequestsProcessed: number;
  /** Timestamp when statistics were collected */
  timestamp: number;
}

/**
 * Request queue entry
 */
export interface QueuedRequest {
  /** Unique request identifier */
  requestId: string;
  /** Request priority */
  priority: Priority;
  /** Timestamp when request was queued */
  queuedAt: number;
  /** Resolve function for the request promise */
  resolve: (workers: Worker[]) => void;
  /** Reject function for the request promise */
  reject: (error: Error) => void;
  /** Number of workers requested */
  workerCount: number;
  /** Request timeout */
  timeout: number;
}

/**
 * Worker reservation result
 */
export interface WorkerReservation {
  /** Reserved workers */
  workers: Worker[];
  /** Reservation ID */
  reservationId: string;
  /** Timestamp of reservation */
  reservedAt: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Worker ID */
  workerId: string;
  /** Whether worker is healthy */
  healthy: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Error message if unhealthy */
  error?: string;
  /** Timestamp of check */
  timestamp: number;
}

/**
 * Warmup task definition
 */
export interface WarmupTask {
  /** Task name/identifier */
  name: string;
  /** Warmup function to execute */
  fn: () => Promise<void>;
  /** Expected execution time (ms) */
  expectedDuration?: number;
}

/**
 * Worker factory function for creating new workers
 */
export type WorkerFactory = (workerId: string) => Promise<Worker> | Worker;

/**
 * Worker task handler
 */
export type WorkerTaskHandler<T = unknown, R = unknown> = (
  task: T
) => Promise<R>;

/**
 * Task result
 */
export interface TaskResult<T = unknown> {
  /** Success flag */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Execution time in milliseconds */
  executionTime: number;
}

/**
 * Pool configuration options
 */
export interface PoolOptions extends Partial<WorkerPoolConfig> {
  /** Worker factory for creating new workers */
  workerFactory: WorkerFactory;
  /** Optional custom worker task handler */
  taskHandler?: WorkerTaskHandler;
}

/**
 * Scale operation result
 */
export interface ScaleResult {
  /** Previous worker count */
  previousCount: number;
  /** New worker count */
  newCount: number;
  /** Number of workers added */
  workersAdded: number;
  /** Number of workers removed */
  workersRemoved: number;
  /** Timestamp of operation */
  timestamp: number;
}

/**
 * Drain operation result
 */
export interface DrainResult {
  /** Number of workers drained */
  workersDrained: number;
  /** Number of requests completed during drain */
  requestsCompleted: number;
  /** Number of requests cancelled during drain */
  requestsCancelled: number;
  /** Total drain time in milliseconds */
  drainTime: number;
  /** Timestamp of operation */
  timestamp: number;
}
