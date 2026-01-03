/**
 * Metrics module for Aequor Cognitive Orchestration Platform
 *
 * Provides comprehensive observability for the Aequor platform.
 *
 * Example:
 * ```ts
 * import { MetricsCollector, MetricsServer } from '@lsi/cascade/metrics';
 *
 * const collector = new MetricsCollector();
 * const server = new MetricsServer(collector, { port: 3000 });
 * await server.start();
 *
 * // Record metrics
 * collector.recordRequest({
 *   backend: 'local',
 *   model: 'llama2',
 *   queryType: 'question',
 *   latency: 150,
 *   success: true,
 *   cost: 0,
 *   sessionId: 'session-123',
 *   query: 'What is TypeScript?'
 * });
 * ```
 */
export { MetricsCollector } from "./MetricsCollector";
export { MetricsStore, RedisMetricsStore } from "./MetricsStore";
export { MetricsServer } from "./MetricsServer";
export type { Metric, MetricType, RequestLabels, ErrorLabels, CacheLabels, RequestMetrics, LatencyMetrics, LatencyDistribution, CacheMetrics, CostMetrics, BackendHealth, HealthMetrics, MetricsSnapshot, TimeSeriesPoint, TimeSeriesData, RequestLogEntry, ErrorLogEntry, MetricsConfig, AggregationWindow, MetricsQuery, AlertRule, Alert, } from "./types";
/**
 * Create a configured metrics collector
 */
export declare function createMetricsCollector(config?: Partial<import("./types.js").MetricsConfig>): import("./MetricsCollector.js").MetricsCollector;
/**
 * Create a metrics server
 */
export declare function createMetricsServer(collector: import("./MetricsCollector.js").MetricsCollector, config?: Partial<import("./types.js").MetricsConfig>): import("./MetricsServer.js").MetricsServer;
//# sourceMappingURL=index.d.ts.map