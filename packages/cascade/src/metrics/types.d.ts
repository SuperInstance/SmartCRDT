/**
 * Metrics types for Aequor Cognitive Orchestration Platform
 *
 * Provides comprehensive observability for:
 * - Request routing and latency
 * - Cache performance
 * - Cost tracking
 * - System health
 * - Error tracking
 */
/**
 * Metric types (Prometheus-style)
 */
export type MetricType = "counter" | "gauge" | "histogram" | "summary";
/**
 * Base metric interface
 */
export interface Metric {
    /** Metric name */
    name: string;
    /** Metric type */
    type: MetricType;
    /** Metric value */
    value: number;
    /** Unix timestamp (ms) */
    timestamp: number;
    /** Optional labels/dimensions */
    labels?: Record<string, string>;
    /** Metric help text */
    help?: string;
}
/**
 * Request metric labels
 */
export interface RequestLabels extends Record<string, string> {
    /** Backend used */
    backend: "local" | "cloud" | "hybrid";
    /** Model name */
    model: string;
    /** Query type */
    queryType: string;
    /** Session ID */
    sessionId: string;
    /** Success or failure */
    status: "success" | "error";
}
/**
 * Error metric labels
 */
export interface ErrorLabels {
    /** Error type */
    errorType: string;
    /** Backend where error occurred */
    backend: "local" | "cloud" | "hybrid";
    /** Model name */
    model?: string;
    /** Error code */
    errorCode?: string;
    [key: string]: string | undefined;
}
/**
 * Cache metric labels
 */
export interface CacheLabels extends Record<string, string> {
    /** Cache type */
    cacheType: "semantic" | "embedding" | "lru";
    /** Hit or miss */
    result: "hit" | "miss";
}
/**
 * Request metrics snapshot
 */
export interface RequestMetrics {
    /** Total requests */
    total: number;
    /** Requests by backend */
    byBackend: {
        local: number;
        cloud: number;
        hybrid: number;
    };
    /** Requests by model */
    byModel: Record<string, number>;
    /** Total errors */
    errors: number;
    /** Error rate (0-1) */
    errorRate: number;
    /** Requests per minute */
    rpm: number;
    /** Requests per second */
    rps: number;
}
/**
 * Latency metrics (in milliseconds)
 */
export interface LatencyMetrics {
    /** P50 latency */
    p50: number;
    /** P95 latency */
    p95: number;
    /** P99 latency */
    p99: number;
    /** Average latency */
    avg: number;
    /** Min latency */
    min: number;
    /** Max latency */
    max: number;
    /** Latency by backend */
    byBackend: {
        local: LatencyDistribution;
        cloud: LatencyDistribution;
        hybrid: LatencyDistribution;
    };
}
/**
 * Latency distribution
 */
export interface LatencyDistribution {
    /** P50 latency */
    p50: number;
    /** P95 latency */
    p95: number;
    /** P99 latency */
    p99: number;
    /** Average latency */
    avg: number;
}
/**
 * Cache performance metrics
 */
export interface CacheMetrics {
    /** Total cache hits */
    hits: number;
    /** Total cache misses */
    misses: number;
    /** Hit rate (0-1) */
    hitRate: number;
    /** Miss rate (0-1) */
    missRate: number;
    /** Average cache entry size (bytes) */
    avgEntrySize: number;
    /** Cache size (number of entries) */
    size: number;
    /** By cache type */
    byType: {
        semantic: {
            hits: number;
            misses: number;
            hitRate: number;
        };
        embedding: {
            hits: number;
            misses: number;
            hitRate: number;
        };
        lru: {
            hits: number;
            misses: number;
            hitRate: number;
        };
    };
}
/**
 * Cost tracking metrics
 */
export interface CostMetrics {
    /** Total cost (USD) */
    total: number;
    /** Cost by backend */
    byBackend: {
        local: number;
        cloud: number;
        hybrid: number;
    };
    /** Cost by model */
    byModel: Record<string, number>;
    /** Cost per 1K requests */
    costPer1k: number;
    /** Cost this hour */
    costThisHour: number;
    /** Cost today */
    costToday: number;
    /** Estimated monthly cost */
    estimatedMonthly: number;
}
/**
 * Health status for a backend
 */
export interface BackendHealth {
    /** Backend name */
    backend: "local" | "cloud" | "hybrid";
    /** Healthy status */
    healthy: boolean;
    /** Response time (ms) */
    responseTime: number;
    /** Uptime percentage (0-100) */
    uptime: number;
    /** Last check timestamp */
    lastCheck: number;
    /** Error message if unhealthy */
    error?: string;
    /** Consecutive failures */
    consecutiveFailures: number;
}
/**
 * Overall health metrics
 */
export interface HealthMetrics {
    /** Overall system health */
    healthy: boolean;
    /** Health by backend */
    backends: BackendHealth[];
    /** Queue depth (for enterprise tier) */
    queueDepth: number;
    /** CPU usage (0-100) */
    cpuUsage: number;
    /** Memory usage (0-100) */
    memoryUsage: number;
    /** Active connections */
    activeConnections: number;
}
/**
 * Complete metrics snapshot
 */
export interface MetricsSnapshot {
    /** Snapshot timestamp */
    timestamp: number;
    /** Request metrics */
    requests: RequestMetrics;
    /** Latency metrics */
    latency: LatencyMetrics;
    /** Cache metrics */
    cache: CacheMetrics;
    /** Cost metrics */
    cost: CostMetrics;
    /** Health metrics */
    health: HealthMetrics;
}
/**
 * Time series data point
 */
export interface TimeSeriesPoint {
    /** Timestamp (ms) */
    timestamp: number;
    /** Value */
    value: number;
}
/**
 * Time series data for charts
 */
export interface TimeSeriesData {
    /** Series name */
    name: string;
    /** Data points */
    points: TimeSeriesPoint[];
    /** Unit */
    unit?: string;
}
/**
 * Request log entry
 */
export interface RequestLogEntry {
    /** Request ID */
    requestId: string;
    /** Timestamp */
    timestamp: number;
    /** Query (truncated if needed) */
    query: string;
    /** Backend used */
    backend: "local" | "cloud" | "hybrid";
    /** Model used */
    model: string;
    /** Latency (ms) */
    latency: number;
    /** Success or failure */
    success: boolean;
    /** Cost (USD) */
    cost: number;
    /** Error message if failed */
    error?: string;
    /** Session ID */
    sessionId: string;
}
/**
 * Error log entry
 */
export interface ErrorLogEntry {
    /** Error ID */
    errorId: string;
    /** Timestamp */
    timestamp: number;
    /** Error type */
    errorType: string;
    /** Error message */
    message: string;
    /** Backend where error occurred */
    backend: "local" | "cloud" | "hybrid";
    /** Model name (if applicable) */
    model?: string;
    /** Stack trace */
    stack?: string;
    /** Request ID */
    requestId?: string;
    /** Session ID */
    sessionId?: string;
}
/**
 * Metrics configuration
 */
export interface MetricsConfig {
    /** Enable/disable metrics collection */
    enabled: boolean;
    /** Retention period (hours) */
    retentionHours: number;
    /** Maximum data points per metric */
    maxDataPoints: number;
    /** Sampling rate (0-1, 1 = all requests) */
    sampleRate: number;
    /** Server configuration */
    server: {
        /** Enable HTTP/WebSocket server */
        enabled: boolean;
        /** Port to listen on */
        port: number;
        /** Host to bind to */
        host: string;
    };
    /** Storage configuration */
    storage: {
        /** Storage type */
        type: "memory" | "redis";
        /** Redis configuration (if using Redis) */
        redis?: {
            host: string;
            port: number;
            password?: string;
            keyPrefix: string;
        };
    };
    /** Dashboard configuration */
    dashboard: {
        /** Enable dashboard */
        enabled: boolean;
        /** Dashboard path */
        path: string;
        /** Update interval (ms) */
        updateInterval: number;
    };
}
/**
 * Aggregation window
 */
export type AggregationWindow = "1m" | "5m" | "15m" | "1h" | "6h" | "24h" | "7d" | "30d";
/**
 * Metrics query parameters
 */
export interface MetricsQuery {
    /** Start timestamp */
    start: number;
    /** End timestamp */
    end: number;
    /** Aggregation window */
    window?: AggregationWindow;
    /** Filter by labels */
    labels?: Record<string, string>;
    /** Metric names to include */
    metrics?: string[];
}
/**
 * Alert rule
 */
export interface AlertRule {
    /** Alert ID */
    id: string;
    /** Alert name */
    name: string;
    /** Metric to monitor */
    metric: string;
    /** Condition (e.g., '>', '<', '>=', '<=') */
    condition: ">" | "<" | ">=" | "<=" | "==";
    /** Threshold value */
    threshold: number;
    /** Duration before alerting (ms) */
    duration: number;
    /** Alert severity */
    severity: "info" | "warning" | "critical";
    /** Whether alert is enabled */
    enabled: boolean;
    /** Alert notification channels */
    channels: string[];
}
/**
 * Alert state
 */
export interface Alert {
    /** Alert ID */
    id: string;
    /** Alert rule that triggered */
    ruleId: string;
    /** Alert message */
    message: string;
    /** Severity */
    severity: "info" | "warning" | "critical";
    /** Timestamp when alert triggered */
    triggeredAt: number;
    /** Current value that triggered alert */
    value: number;
    /** Threshold */
    threshold: number;
    /** Whether alert is resolved */
    resolved: boolean;
    /** Timestamp when resolved (null if active) */
    resolvedAt?: number;
}
//# sourceMappingURL=types.d.ts.map