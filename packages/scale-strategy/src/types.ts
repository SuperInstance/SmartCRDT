/**
 * @lsi/scale-strategy - Core Types
 *
 * Type definitions for intelligent scaling decisions with zero cold start support.
 */

/**
 * Direction of scaling operation
 */
export type ScaleDirection = "up" | "down" | "none";

/**
 * Scaling policy aggressiveness
 */
export type ScalePolicy = "aggressive" | "conservative" | "balanced";

/**
 * Metric types for scaling decisions
 */
export enum MetricType {
  /** Queue depth (number of pending requests) */
  QUEUE_DEPTH = "queue_depth",
  /** CPU utilization percentage */
  CPU_USAGE = "cpu_usage",
  /** Memory utilization percentage */
  MEMORY_USAGE = "memory_usage",
  /** Request latency in milliseconds */
  LATENCY = "latency",
  /** Error rate percentage */
  ERROR_RATE = "error_rate",
  /** Custom user-defined metric */
  CUSTOM = "custom",
}

/**
 * Scaling decision output
 */
export interface ScaleDecision {
  /** Direction to scale */
  direction: ScaleDirection;
  /** Target worker count */
  targetCount: number;
  /** Current worker count */
  currentCount: number;
  /** Reason for this decision */
  reason: string;
  /** Confidence in this decision (0-1) */
  confidence: number;
  /** Metrics that triggered this decision */
  triggeredBy: string[];
  /** Estimated time to complete scaling (ms) */
  estimatedTimeMs: number;
  /** Whether this is an emergency scale */
  isEmergency: boolean;
}

/**
 * Single metric data point
 */
export interface ScaleMetric {
  /** Metric name/identifier */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Current value */
  value: number;
  /** Weight in decision making (0-1) */
  weight: number;
  /** Threshold that triggers scaling */
  threshold: {
    /** Scale up threshold */
    up: number;
    /** Scale down threshold */
    down: number;
  };
  /** Unit of measurement */
  unit: string;
  /** Timestamp of measurement */
  timestamp: number;
}

/**
 * Historical scale event
 */
export interface ScaleEvent {
  /** Event timestamp */
  timestamp: number;
  /** Direction scaled */
  direction: ScaleDirection;
  /** Worker count before scaling */
  fromCount: number;
  /** Worker count after scaling */
  toCount: number;
  /** What triggered this scaling */
  trigger: string;
  /** Metrics at time of scaling */
  metrics: Record<string, number>;
  /** Decision confidence */
  confidence: number;
  /** Time taken to complete (ms) */
  durationMs: number;
  /** Whether scaling was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Scale manager configuration
 */
export interface ScaleManagerConfig {
  /** Minimum worker count */
  minWorkers: number;
  /** Maximum worker count */
  maxWorkers: number;
  /** Initial worker count */
  initialWorkers: number;
  /** Scaling policy */
  policy: ScalePolicy;
  /** Scale up cooldown period (ms) */
  scaleUpCooldownMs: number;
  /** Scale down cooldown period (ms) */
  scaleDownCooldownMs: number;
  /** Whether scale-to-zero is enabled */
  enableScaleToZero: boolean;
  /** Idle time before scale-to-zero (ms) */
  scaleToZeroIdleMs: number;
  /** Whether predictive scaling is enabled */
  enablePredictiveScaling: boolean;
  /** Prediction horizon (ms) */
  predictionHorizonMs: number;
  /** Emergency scale-up threshold (queue depth) */
  emergencyThreshold: number;
}

/**
 * Metric collector configuration
 */
export interface MetricCollectorConfig {
  /** Collection interval (ms) */
  intervalMs: number;
  /** Metric retention period (ms) */
  retentionMs: number;
  /** Whether to enable metric smoothing */
  enableSmoothing: boolean;
  /** Smoothing window size */
  smoothingWindow: number;
}

/**
 * Scale strategy configuration
 */
export interface ScaleStrategyConfig {
  /** Strategy name */
  name: string;
  /** Strategy type */
  type: "threshold" | "predictive" | "time-based" | "cost-optimized";
  /** Whether this strategy is enabled */
  enabled: boolean;
  /** Strategy-specific configuration */
  config: Record<string, unknown>;
}

/**
 * Cooldown state
 */
export interface CooldownState {
  /** Last scale up timestamp */
  lastScaleUp: number;
  /** Last scale down timestamp */
  lastScaleDown: number;
  /** Current cooldown remaining (ms) */
  remainingMs: number;
  /** Whether in cooldown period */
  isInCooldown: boolean;
}

/**
 * Zero-start state
 */
export interface ZeroStartState {
  /** Whether currently at zero workers */
  isAtZero: boolean;
  /** Time since idle (ms) */
  idleTimeMs: number;
  /** Pending requests during zero state */
  pendingRequests: number;
  /** Whether fast-start is available */
  hasFastStart: boolean;
  /** Estimated time to first worker (ms) */
  timeToFirstWorkerMs: number;
}

/**
 * Worker pool state
 */
export interface WorkerPoolState {
  /** Total workers */
  total: number;
  /** Active workers */
  active: number;
  /** Idle workers */
  idle: number;
  /** Starting workers */
  starting: number;
  /** Stopping workers */
  stopping: number;
  /** Pending requests in queue */
  queuedRequests: number;
}

/**
 * Integration target type
 */
export type IntegrationTarget =
  | "worker-pool"
  | "kubernetes"
  | "docker"
  | "aws-asg"
  | "gce-autoscaler"
  | "custom";

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  /** Target type */
  target: IntegrationTarget;
  /** Connection details */
  connection: {
    /** Endpoint URL */
    endpoint?: string;
    /** Authentication token */
    token?: string;
    /** API key */
    apiKey?: string;
    /** Region/zone */
    region?: string;
    /** Additional connection options */
    options?: Record<string, unknown>;
  };
  /** Target-specific configuration */
  targetConfig: {
    /** Deployment name/identifier */
    deployment?: string;
    /** Container image */
    image?: string;
    /** Resource limits */
    resources?: {
      cpu: string;
      memory: string;
    };
    /** Additional target config */
    [key: string]: unknown;
  };
}

/**
 * Scale operation result
 */
export interface ScaleOperationResult {
  /** Whether operation succeeded */
  success: boolean;
  /** Actual worker count after operation */
  actualCount: number;
  /** Time taken (ms) */
  durationMs: number;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Predictive model input
 */
export interface PredictiveModelInput {
  /** Historical metrics */
  historicalMetrics: Array<{
    timestamp: number;
    value: number;
  }>;
  /** Current metrics */
  currentMetrics: Record<string, number>;
  /** Time patterns */
  timePatterns: {
    hourOfDay: number;
    dayOfWeek: number;
    isWeekend: boolean;
  };
  /** Recent scale events */
  recentScaleEvents: ScaleEvent[];
}

/**
 * Predictive model output
 */
export interface PredictiveModelOutput {
  /** Predicted load (0-1) */
  predictedLoad: number;
  /** Predicted worker count needed */
  predictedWorkerCount: number;
  /** Confidence in prediction (0-1) */
  confidence: number;
  /** Time horizon for prediction (ms) */
  horizonMs: number;
  /** Recommended action */
  recommendedAction: ScaleDirection;
}

/**
 * Time-based schedule entry
 */
export interface TimeBasedSchedule {
  /** Schedule identifier */
  id: string;
  /** Day of week (0-6, 0 = Sunday) */
  dayOfWeek: number;
  /** Hour of day (0-23) */
  hour: number;
  /** Minute of hour (0-59) */
  minute: number;
  /** Target worker count */
  workerCount: number;
  /** Whether this schedule is enabled */
  enabled: boolean;
}

/**
 * Cost optimization configuration
 */
export interface CostOptimizedConfig {
  /** Maximum cost per hour */
  maxCostPerHour: number;
  /** Cost per worker per hour */
  costPerWorkerPerHour: number;
  /** Cost vs latency tradeoff (0-1, higher = prefer lower cost) */
  costLatencyTradeoff: number;
  /** Budget period (ms) */
  budgetPeriodMs: number;
  /** Current budget spent */
  currentBudgetSpent: number;
}
