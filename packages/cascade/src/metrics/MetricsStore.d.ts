/**
 * MetricsStore - Time-series metrics storage
 *
 * Provides efficient storage and retrieval of time-series metrics.
 * In-memory implementation with optional Redis persistence.
 *
 * Features:
 * - Time-bucketed storage for efficient queries
 * - Automatic retention policy enforcement
 * - Prometheus format export
 * - Label-based filtering
 *
 * Example:
 * ```ts
 * const store = new MetricsStore(config);
 * store.write({ name: 'requests_total', type: 'counter', value: 1, ... });
 * const metrics = store.query({ name: 'requests_total', start, end });
 * ```
 */
import type { Metric, MetricsConfig } from "./types.js";
/**
 * MetricsStore - Time-series storage with efficient querying
 */
export declare class MetricsStore {
    private buckets;
    private config;
    private bucketSize;
    private maxBuckets;
    constructor(config: MetricsConfig);
    /**
     * Write a metric to storage
     */
    write(metric: Metric): void;
    /**
     * Query metrics by name and time range
     */
    query(options: {
        name: string;
        start: number;
        end: number;
        labels?: Record<string, string>;
    }): Metric[];
    /**
     * Get latest value for a metric
     */
    getLatest(name: string, labels?: Record<string, string>): Metric | null;
    /**
     * Aggregate metrics by time window
     */
    aggregate(options: {
        name: string;
        start: number;
        end: number;
        window: number;
        aggregation: "sum" | "avg" | "min" | "max" | "count";
        labels?: Record<string, string>;
    }): Array<{
        timestamp: number;
        value: number;
    }>;
    /**
     * Get unique label values for a metric
     */
    getLabelValues(name: string, labelName: string): string[];
    /**
     * Get all metric names
     */
    getMetricNames(): string[];
    /**
     * Clear all metrics
     */
    clear(): void;
    /**
     * Export metrics in Prometheus text format
     */
    exportPrometheus(): string;
    /**
     * Get storage statistics
     */
    getStats(): {
        totalMetrics: number;
        totalBuckets: number;
        metricNames: string[];
        memoryUsage: string;
    };
    /**
     * Enforce retention policy by removing old buckets
     */
    private enforceRetentionPolicy;
    /**
     * Generate a unique key for a metric
     */
    private getMetricKey;
    /**
     * Convert labels to string
     */
    private labelsToString;
}
/**
 * Redis-backed metrics store (optional)
 *
 * For production deployments requiring persistence and horizontal scaling.
 */
export declare class RedisMetricsStore {
    private config;
    private redis;
    constructor(config: MetricsConfig);
    /**
     * Initialize Redis connection
     */
    connect(): Promise<void>;
    /**
     * Write a metric to Redis
     */
    write(metric: Metric): Promise<void>;
    /**
     * Query metrics from Redis
     */
    query(options: {
        name: string;
        start: number;
        end: number;
        labels?: Record<string, string>;
    }): Promise<Metric[]>;
    /**
     * Close Redis connection
     */
    close(): Promise<void>;
    /**
     * Generate Redis key for a metric
     */
    private getRedisKey;
}
//# sourceMappingURL=MetricsStore.d.ts.map