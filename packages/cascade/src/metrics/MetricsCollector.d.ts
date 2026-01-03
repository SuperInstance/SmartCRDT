/**
 * MetricsCollector - Central metrics collection service
 *
 * Collects metrics from all components:
 * - CascadeRouter (routing decisions)
 * - Adapters (requests, latency, errors)
 * - SemanticCache (hits, misses)
 * - CostTracker (cost tracking)
 *
 * Thread-safe, efficient, low-overhead (<1% performance impact).
 *
 * Example:
 * ```ts
 * const collector = new MetricsCollector(config);
 * collector.recordRequest({ backend: 'local', model: 'llama2', ... });
 * const snapshot = collector.getSnapshot();
 * ```
 */
import type { MetricsSnapshot, MetricsConfig, RequestLogEntry, ErrorLogEntry, TimeSeriesPoint } from "./types.js";
/**
 * MetricsCollector - Central collection service
 */
export declare class MetricsCollector {
    private store;
    private config;
    private latencyBuffer;
    private requestLog;
    private errorLog;
    private startTime;
    private requestCounter;
    constructor(config?: Partial<MetricsConfig>);
    /**
     * Record a request
     */
    recordRequest(data: {
        backend: "local" | "cloud" | "hybrid";
        model: string;
        queryType: string;
        latency: number;
        success: boolean;
        cost: number;
        sessionId: string;
        query: string;
        requestId?: string;
    }): void;
    /**
     * Record an error
     */
    recordError(data: {
        errorType: string;
        message: string;
        backend: "local" | "cloud" | "hybrid";
        model?: string;
        stack?: string;
        requestId?: string;
        sessionId?: string;
    }): void;
    /**
     * Record a cache operation
     */
    recordCache(data: {
        cacheType: "semantic" | "embedding" | "lru";
        hit: boolean;
        entrySize?: number;
    }): void;
    /**
     * Update health status
     */
    updateHealth(data: {
        backend: "local" | "cloud" | "hybrid";
        healthy: boolean;
        responseTime: number;
        error?: string;
        consecutiveFailures?: number;
    }): void;
    /**
     * Update system metrics
     */
    updateSystemMetrics(data: {
        queueDepth?: number;
        cpuUsage?: number;
        memoryUsage?: number;
        activeConnections?: number;
    }): void;
    /**
     * Get current metrics snapshot
     */
    getSnapshot(): MetricsSnapshot;
    /**
     * Get request metrics
     */
    private getRequestMetrics;
    /**
     * Get latency metrics
     */
    private getLatencyMetrics;
    /**
     * Get cache metrics
     */
    private getCacheMetrics;
    /**
     * Get cost metrics
     */
    private getCostMetrics;
    /**
     * Get health metrics
     */
    private getHealthMetrics;
    /**
     * Get latest gauge value
     */
    private getLatestGauge;
    /**
     * Calculate latency distribution
     */
    private getLatencyDistribution;
    /**
     * Calculate percentile
     */
    private percentile;
    /**
     * Calculate average
     */
    private average;
    /**
     * Get request log
     */
    getRequestLog(options: {
        limit?: number;
        offset?: number;
    }): RequestLogEntry[];
    /**
     * Get error log
     */
    getErrorLog(options: {
        limit?: number;
        offset?: number;
        errorType?: string;
    }): ErrorLogEntry[];
    /**
     * Get time series data for a metric
     */
    getTimeSeries(name: string, window?: number): TimeSeriesPoint[];
    /**
     * Clear all metrics
     */
    clear(): void;
    /**
     * Export metrics as Prometheus format
     */
    exportPrometheus(): string;
    /**
     * Export metrics as JSON
     */
    exportJSON(): string;
}
//# sourceMappingURL=MetricsCollector.d.ts.map