/**
 * @lsi/scale-strategy - Metrics Index
 *
 * Exports all metric collectors.
 */

export { QueueDepthMetric } from "./QueueDepthMetric.js";
export { CpuUsageMetric } from "./CpuUsageMetric.js";
export { MemoryUsageMetric } from "./MemoryUsageMetric.js";
export {
  LatencyMetric,
  type LatencyMeasurement,
  type LatencyPercentile,
} from "./LatencyMetric.js";
export { ErrorRateMetric, type ErrorRecord } from "./ErrorRateMetric.js";
export {
  CustomMetric,
  createGaugeMetric,
  createCounterMetric,
  type CustomMetricConfig,
  type CustomMetricCollector,
} from "./CustomMetric.js";
