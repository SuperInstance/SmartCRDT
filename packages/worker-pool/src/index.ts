/**
 * @lsi/worker-pool
 *
 * Worker Pool Manager for zero cold start and efficient resource utilization.
 */

// Types
export type {
  WorkerState,
  Priority,
  LoadBalancingStrategy,
  WorkerEventType,
  WorkerEvent,
  WorkerEventHandler,
  WorkerPoolConfig,
  WorkerMetrics,
  PoolStatistics,
  QueuedRequest,
  WorkerReservation,
  HealthCheckResult,
  WarmupTask,
  WorkerFactory,
  WorkerTaskHandler,
  TaskResult,
  PoolOptions,
  ScaleResult,
  DrainResult,
} from "./types.js";

export { DEFAULT_WORKER_POOL_CONFIG } from "./types.js";

// Core classes
export { WorkerPoolManager } from "./WorkerPoolManager.js";
export { WorkerLifecycle } from "./WorkerLifecycle.js";
export { PriorityQueue } from "./PriorityQueue.js";
export { LoadBalancer } from "./LoadBalancer.js";

// Integration
export {
  IntegratedWorkerPool,
  WorkerAwareRouter,
  IntegrationHelpers,
  type ContainerOrchestrator,
  type ContainerConfig,
  type ContainerStatus,
  type IntegrationOptions,
} from "./integration.js";
