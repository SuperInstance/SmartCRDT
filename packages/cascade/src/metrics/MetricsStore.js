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
/**
 * MetricsStore - Time-series storage with efficient querying
 */
export class MetricsStore {
    buckets = [];
    config;
    bucketSize = 60000; // 1 minute buckets
    maxBuckets;
    constructor(config) {
        this.config = config;
        // Calculate max buckets based on retention
        this.maxBuckets = Math.ceil((config.retentionHours * 3600000) / this.bucketSize);
    }
    /**
     * Write a metric to storage
     */
    write(metric) {
        const bucketTimestamp = Math.floor(metric.timestamp / this.bucketSize) * this.bucketSize;
        let bucket = this.buckets.find(b => b.timestamp === bucketTimestamp);
        if (!bucket) {
            bucket = {
                timestamp: bucketTimestamp,
                metrics: new Map(),
            };
            this.buckets.push(bucket);
            this.enforceRetentionPolicy();
        }
        const key = this.getMetricKey(metric);
        if (!bucket.metrics.has(key)) {
            bucket.metrics.set(key, []);
        }
        bucket.metrics.get(key).push(metric);
        // Enforce max data points per metric
        const metricList = bucket.metrics.get(key);
        if (metricList.length > this.config.maxDataPoints) {
            metricList.shift(); // Remove oldest
        }
    }
    /**
     * Query metrics by name and time range
     */
    query(options) {
        const { name, start, end, labels } = options;
        const results = [];
        // Find relevant buckets
        const startBucket = Math.floor(start / this.bucketSize) * this.bucketSize;
        const endBucket = Math.floor(end / this.bucketSize) * this.bucketSize;
        for (const bucket of this.buckets) {
            if (bucket.timestamp < startBucket || bucket.timestamp > endBucket) {
                continue;
            }
            // Search metrics in bucket
            for (const [key, metrics] of bucket.metrics) {
                if (!key.startsWith(name))
                    continue;
                for (const metric of metrics) {
                    // Filter by time range
                    if (metric.timestamp < start || metric.timestamp > end) {
                        continue;
                    }
                    // Filter by labels
                    if (labels) {
                        let match = true;
                        for (const [k, v] of Object.entries(labels)) {
                            if (metric.labels?.[k] !== v) {
                                match = false;
                                break;
                            }
                        }
                        if (!match)
                            continue;
                    }
                    results.push(metric);
                }
            }
        }
        // Sort by timestamp
        return results.sort((a, b) => a.timestamp - b.timestamp);
    }
    /**
     * Get latest value for a metric
     */
    getLatest(name, labels) {
        // Use a future timestamp to ensure all recently written metrics are included
        // This handles the case where metrics are written with timestamps slightly in the future
        const results = this.query({
            name,
            start: 0,
            end: Date.now() + 10000, // Add 10 seconds buffer
            labels,
        });
        return results.length > 0 ? results[results.length - 1] : null;
    }
    /**
     * Aggregate metrics by time window
     */
    aggregate(options) {
        const { name, start, end, window, aggregation, labels } = options;
        const results = new Map();
        // Get all matching metrics
        const metrics = this.query({ name, start, end, labels });
        // Group by time window
        for (const metric of metrics) {
            const windowStart = Math.floor(metric.timestamp / window) * window;
            if (!results.has(windowStart)) {
                results.set(windowStart, []);
            }
            results.get(windowStart).push(metric.value);
        }
        // Apply aggregation
        const aggregated = [];
        for (const [timestamp, values] of results) {
            let value;
            switch (aggregation) {
                case "sum":
                    value = values.reduce((sum, v) => sum + v, 0);
                    break;
                case "avg":
                    value = values.reduce((sum, v) => sum + v, 0) / values.length;
                    break;
                case "min":
                    value = Math.min(...values);
                    break;
                case "max":
                    value = Math.max(...values);
                    break;
                case "count":
                    value = values.length;
                    break;
                default:
                    value = values[0];
            }
            aggregated.push({ timestamp, value });
        }
        return aggregated.sort((a, b) => a.timestamp - b.timestamp);
    }
    /**
     * Get unique label values for a metric
     */
    getLabelValues(name, labelName) {
        const values = new Set();
        for (const bucket of this.buckets) {
            for (const [key, metrics] of bucket.metrics) {
                if (!key.startsWith(name))
                    continue;
                for (const metric of metrics) {
                    if (metric.labels?.[labelName]) {
                        values.add(metric.labels[labelName]);
                    }
                }
            }
        }
        return Array.from(values).sort();
    }
    /**
     * Get all metric names
     */
    getMetricNames() {
        const names = new Set();
        for (const bucket of this.buckets) {
            for (const key of bucket.metrics.keys()) {
                const name = key.split(":")[0];
                names.add(name);
            }
        }
        return Array.from(names).sort();
    }
    /**
     * Clear all metrics
     */
    clear() {
        this.buckets = [];
    }
    /**
     * Export metrics in Prometheus text format
     */
    exportPrometheus() {
        const lines = [];
        // Get all metric names
        const metricNames = this.getMetricNames();
        for (const name of metricNames) {
            const latest = this.getLatest(name);
            if (!latest)
                continue;
            // Add HELP line
            if (latest.help) {
                lines.push(`# HELP ${name} ${latest.help}`);
            }
            // Add TYPE line
            lines.push(`# TYPE ${name} ${latest.type}`);
            // Get all label combinations for this metric
            const metrics = this.query({
                name,
                start: 0,
                end: Date.now(),
            });
            // Group by labels (take latest value for each label combination)
            const byLabels = new Map();
            for (const metric of metrics) {
                const labelStr = this.labelsToString(metric.labels || {});
                const existing = byLabels.get(labelStr);
                if (!existing || metric.timestamp > existing.timestamp) {
                    byLabels.set(labelStr, metric);
                }
            }
            // Output metrics
            for (const metric of byLabels.values()) {
                const labelStr = this.labelsToString(metric.labels || {});
                const line = labelStr
                    ? `${name}{${labelStr}} ${metric.value}`
                    : `${name} ${metric.value}`;
                lines.push(line);
            }
            lines.push(""); // Empty line between metrics
        }
        return lines.join("\n");
    }
    /**
     * Get storage statistics
     */
    getStats() {
        let totalMetrics = 0;
        for (const bucket of this.buckets) {
            for (const metrics of bucket.metrics.values()) {
                totalMetrics += metrics.length;
            }
        }
        return {
            totalMetrics,
            totalBuckets: this.buckets.length,
            metricNames: this.getMetricNames(),
            memoryUsage: `${((totalMetrics * 200) / 1024).toFixed(2)} KB (estimated)`,
        };
    }
    /**
     * Enforce retention policy by removing old buckets
     */
    enforceRetentionPolicy() {
        const cutoffTime = Date.now() - this.config.retentionHours * 3600000;
        // Remove old buckets
        this.buckets = this.buckets.filter(b => b.timestamp >= cutoffTime);
        // If still too many buckets, remove oldest
        if (this.buckets.length > this.maxBuckets) {
            this.buckets = this.buckets.slice(-this.maxBuckets);
        }
    }
    /**
     * Generate a unique key for a metric
     */
    getMetricKey(metric) {
        const parts = [metric.name];
        if (metric.labels) {
            const labelStr = this.labelsToString(metric.labels);
            if (labelStr) {
                parts.push(labelStr);
            }
        }
        return parts.join(":");
    }
    /**
     * Convert labels to string
     */
    labelsToString(labels) {
        const parts = [];
        for (const [key, value] of Object.entries(labels).sort()) {
            parts.push(`${key}="${value}"`);
        }
        return parts.join(",");
    }
}
/**
 * Redis-backed metrics store (optional)
 *
 * For production deployments requiring persistence and horizontal scaling.
 */
export class RedisMetricsStore {
    config;
    redis; // Redis client (lazy loaded)
    constructor(config) {
        this.config = config;
    }
    /**
     * Initialize Redis connection
     */
    async connect() {
        if (this.config.storage.type !== "redis" || !this.config.storage.redis) {
            throw new Error("Redis not configured");
        }
        // Dynamic import to avoid hard dependency
        try {
            // @ts-ignore - Optional dependency
            const { createClient } = await import("redis");
            this.redis = createClient({
                socket: {
                    host: this.config.storage.redis.host,
                    port: this.config.storage.redis.port,
                },
                password: this.config.storage.redis.password,
            });
            await this.redis.connect();
        }
        catch (error) {
            throw new Error(`Failed to connect to Redis: ${error}`);
        }
    }
    /**
     * Write a metric to Redis
     */
    async write(metric) {
        if (!this.redis) {
            throw new Error("Redis not connected");
        }
        const key = this.getRedisKey(metric);
        const value = JSON.stringify(metric);
        await this.redis.lPush(key, value);
        await this.redis.expire(key, this.config.retentionHours * 3600);
    }
    /**
     * Query metrics from Redis
     */
    async query(options) {
        if (!this.redis) {
            throw new Error("Redis not connected");
        }
        const results = [];
        const { name, start, end } = options;
        // Scan for matching keys
        const pattern = `${this.config.storage.redis?.keyPrefix || "metrics"}:${name}:*`;
        const keys = [];
        for await (const key of this.redis.scanIterator({
            MATCH: pattern,
            COUNT: 100,
        })) {
            keys.push(key);
        }
        // Fetch and filter metrics
        for (const key of keys) {
            const values = await this.redis.lRange(key, 0, -1);
            for (const value of values) {
                const metric = JSON.parse(value);
                if (metric.timestamp >= start && metric.timestamp <= end) {
                    results.push(metric);
                }
            }
        }
        return results.sort((a, b) => a.timestamp - b.timestamp);
    }
    /**
     * Close Redis connection
     */
    async close() {
        if (this.redis) {
            await this.redis.quit();
            this.redis = null;
        }
    }
    /**
     * Generate Redis key for a metric
     */
    getRedisKey(metric) {
        const prefix = this.config.storage.redis?.keyPrefix || "metrics";
        const timestamp = Math.floor(metric.timestamp / 3600000); // Hourly keys
        return `${prefix}:${metric.name}:${timestamp}`;
    }
}
//# sourceMappingURL=MetricsStore.js.map