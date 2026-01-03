/**
 * @lsi/scale-strategy - Scale Strategy Package
 *
 * Smart scale-to-zero and scale-up for the Aequor Platform with zero cold start.
 *
 * @packageDocumentation
 */

// Core types
export type {
  ScaleDirection,
  ScalePolicy,
  ScaleDecision,
  ScaleMetric,
  ScaleEvent,
  ScaleManagerConfig,
  MetricCollectorConfig,
  ScaleStrategyConfig,
  CooldownState,
  ZeroStartState,
  WorkerPoolState,
  IntegrationTarget,
  IntegrationConfig,
  ScaleOperationResult,
  PredictiveModelInput,
  PredictiveModelOutput,
  TimeBasedSchedule,
  CostOptimizedConfig,
} from "./types.js";

export { MetricType } from "./types.js";

// Scale Manager
export { ScaleManager } from "./ScaleManager.js";

// Cooldown Manager
export { CooldownManager } from "./CooldownManager.js";

// Zero Start Handler
export {
  ZeroStartHandler,
  type ZeroStartHandlerConfig,
} from "./ZeroStartHandler.js";

// Metrics
export {
  QueueDepthMetric,
  CpuUsageMetric,
  MemoryUsageMetric,
  LatencyMetric,
  ErrorRateMetric,
  CustomMetric,
  createGaugeMetric,
  createCounterMetric,
} from "./metrics/index.js";

export type {
  LatencyMeasurement,
  LatencyPercentile,
  ErrorRecord,
  CustomMetricConfig,
  CustomMetricCollector,
} from "./metrics/index.js";

// Strategies
export {
  ThresholdStrategy,
  PredictiveStrategy,
  TimeBasedStrategy,
  CostOptimizedStrategy,
} from "./strategies/index.js";

export type {
  ThresholdStrategyConfig,
  PredictiveStrategyConfig,
  TimeBasedStrategyConfig,
  CostOptimizedStrategyConfig,
} from "./strategies/index.js";

// Integration
export {
  createIntegration,
  IntegrationFactory,
  WorkerPoolIntegration,
  KubernetesIntegration,
  DockerIntegration,
  AWSAutoscalingIntegration,
  GCEAutoscalerIntegration,
} from "./integration.js";

export type { ScaleIntegration } from "./integration.js";
