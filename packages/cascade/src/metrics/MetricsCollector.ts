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

import type {
  Metric,
  RequestLabels,
  ErrorLabels,
  CacheLabels,
  MetricsSnapshot,
  RequestMetrics,
  LatencyMetrics,
  LatencyDistribution,
  CacheMetrics,
  CostMetrics,
  HealthMetrics,
  BackendHealth,
  MetricsConfig,
  RequestLogEntry,
  ErrorLogEntry,
  TimeSeriesPoint,
} from "./types.js";
import { MetricsStore } from "./MetricsStore.js";

/**
 * Default metrics configuration
 */
const DEFAULT_CONFIG: MetricsConfig = {
  enabled: true,
  retentionHours: 24,
  maxDataPoints: 10000,
  sampleRate: 1.0,
  server: {
    enabled: true,
    port: 3000,
    host: "0.0.0.0",
  },
  storage: {
    type: "memory",
  },
  dashboard: {
    enabled: true,
    path: "/metrics",
    updateInterval: 1000,
  },
};

/**
 * Request record for tracking
 */
interface RequestRecord {
  timestamp: number;
  backend: "local" | "cloud" | "hybrid";
  model: string;
  queryType: string;
  latency: number;
  success: boolean;
  cost: number;
  sessionId: string;
  query: string;
  requestId: string;
}

/**
 * MetricsCollector - Central collection service
 */
export class MetricsCollector {
  private store: MetricsStore;
  private config: MetricsConfig;
  private latencyBuffer: number[] = [];
  private requestLog: RequestLogEntry[] = [];
  private errorLog: ErrorLogEntry[] = [];
  private startTime: number;
  private requestCounter = 0;

  constructor(config: Partial<MetricsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = new MetricsStore(this.config);
    this.startTime = Date.now();
  }

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
  }): void {
    if (!this.config.enabled) return;
    if (Math.random() > this.config.sampleRate) return;

    const timestamp = Date.now();
    const requestId = data.requestId || `req_${this.requestCounter++}`;

    // Record latency
    this.latencyBuffer.push(data.latency);

    // Store metric
    const labels: RequestLabels = {
      backend: data.backend,
      model: data.model,
      queryType: data.queryType,
      sessionId: data.sessionId,
      status: data.success ? "success" : "error",
    };

    const metric: Metric = {
      name: "request_total",
      type: "counter",
      value: 1,
      timestamp,
      labels,
      help: "Total number of requests",
    };

    this.store.write(metric);

    // Record latency metric
    this.store.write({
      name: "request_latency_ms",
      type: "histogram",
      value: data.latency,
      timestamp,
      labels,
      help: "Request latency in milliseconds",
    });

    // Record cost
    this.store.write({
      name: "request_cost_usd",
      type: "counter",
      value: data.cost,
      timestamp,
      labels: {
        backend: data.backend,
        model: data.model,
        queryType: data.queryType,
        sessionId: data.sessionId,
        status: data.success ? "success" : "error",
      },
      help: "Request cost in USD",
    });

    // Add to request log
    const logEntry: RequestLogEntry = {
      requestId,
      timestamp,
      query: data.query.slice(0, 500), // Truncate long queries
      backend: data.backend,
      model: data.model,
      latency: data.latency,
      success: data.success,
      cost: data.cost,
      sessionId: data.sessionId,
    };

    this.requestLog.push(logEntry);

    // Trim log if needed
    const maxLogSize = this.config.maxDataPoints;
    if (this.requestLog.length > maxLogSize) {
      this.requestLog = this.requestLog.slice(-maxLogSize);
    }
  }

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
  }): void {
    if (!this.config.enabled) return;

    const timestamp = Date.now();
    const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Build labels object, filtering out undefined values
    const labels: Record<string, string> = {
      errorType: data.errorType,
      backend: data.backend,
      status: "error", // Mark as error request
    };
    if (data.model) {
      labels.model = data.model;
    }

    // Record error metric
    this.store.write({
      name: "errors_total",
      type: "counter",
      value: 1,
      timestamp,
      labels,
      help: "Total number of errors",
    });

    // Also record as a request with error status for accurate error counting
    this.store.write({
      name: "request_total",
      type: "counter",
      value: 1,
      timestamp,
      labels,
    });

    // Add to error log
    const logEntry: ErrorLogEntry = {
      errorId,
      timestamp,
      errorType: data.errorType,
      message: data.message.slice(0, 500),
      backend: data.backend,
      model: data.model,
      stack: data.stack?.slice(0, 1000),
      requestId: data.requestId,
      sessionId: data.sessionId,
    };

    this.errorLog.push(logEntry);

    // Trim log if needed
    const maxLogSize = this.config.maxDataPoints;
    if (this.errorLog.length > maxLogSize) {
      this.errorLog = this.errorLog.slice(-maxLogSize);
    }
  }

  /**
   * Record a cache operation
   */
  recordCache(data: {
    cacheType: "semantic" | "embedding" | "lru";
    hit: boolean;
    entrySize?: number;
  }): void {
    if (!this.config.enabled) return;

    const timestamp = Date.now();

    const labels: CacheLabels = {
      cacheType: data.cacheType,
      result: data.hit ? "hit" : "miss",
    };

    // Record cache metric
    this.store.write({
      name: "cache_operations",
      type: "counter",
      value: 1,
      timestamp,
      labels,
      help: "Cache operations (hits and misses)",
    });

    // Record cache size if provided
    if (data.entrySize !== undefined) {
      this.store.write({
        name: "cache_entry_size_bytes",
        type: "gauge",
        value: data.entrySize,
        timestamp,
        labels: {
          cacheType: data.cacheType,
        },
        help: "Cache entry size in bytes",
      });
    }
  }

  /**
   * Update health status
   */
  updateHealth(data: {
    backend: "local" | "cloud" | "hybrid";
    healthy: boolean;
    responseTime: number;
    error?: string;
    consecutiveFailures?: number;
  }): void {
    if (!this.config.enabled) return;

    const timestamp = Date.now();

    // Record health status
    this.store.write({
      name: "backend_healthy",
      type: "gauge",
      value: data.healthy ? 1 : 0,
      timestamp,
      labels: {
        backend: data.backend,
      },
      help: "Backend health status (1 = healthy, 0 = unhealthy)",
    });

    // Record response time
    this.store.write({
      name: "backend_response_time_ms",
      type: "gauge",
      value: data.responseTime,
      timestamp,
      labels: {
        backend: data.backend,
      },
      help: "Backend health check response time",
    });

    // Record consecutive failures
    if (data.consecutiveFailures !== undefined) {
      this.store.write({
        name: "backend_consecutive_failures",
        type: "gauge",
        value: data.consecutiveFailures,
        timestamp,
        labels: {
          backend: data.backend,
        },
        help: "Consecutive health check failures",
      });
    }
  }

  /**
   * Update system metrics
   */
  updateSystemMetrics(data: {
    queueDepth?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    activeConnections?: number;
  }): void {
    if (!this.config.enabled) return;

    const timestamp = Date.now();

    if (data.queueDepth !== undefined) {
      this.store.write({
        name: "queue_depth",
        type: "gauge",
        value: data.queueDepth,
        timestamp,
        help: "Current queue depth",
      });
    }

    if (data.cpuUsage !== undefined) {
      this.store.write({
        name: "cpu_usage_percent",
        type: "gauge",
        value: data.cpuUsage,
        timestamp,
        help: "CPU usage percentage",
      });
    }

    if (data.memoryUsage !== undefined) {
      this.store.write({
        name: "memory_usage_percent",
        type: "gauge",
        value: data.memoryUsage,
        timestamp,
        help: "Memory usage percentage",
      });
    }

    if (data.activeConnections !== undefined) {
      this.store.write({
        name: "active_connections",
        type: "gauge",
        value: data.activeConnections,
        timestamp,
        help: "Active connections count",
      });
    }
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    const now = Date.now();

    return {
      timestamp: now,
      requests: this.getRequestMetrics(),
      latency: this.getLatencyMetrics(),
      cache: this.getCacheMetrics(),
      cost: this.getCostMetrics(),
      health: this.getHealthMetrics(),
    };
  }

  /**
   * Get request metrics
   */
  private getRequestMetrics(): RequestMetrics {
    const requests = this.store.query({
      name: "request_total",
      start: this.startTime,
      end: Date.now(),
    });

    const total = requests.reduce((sum, m) => sum + m.value, 0);

    const byBackend = { local: 0, cloud: 0, hybrid: 0 };
    const byModel: Record<string, number> = {};
    let errors = 0;

    for (const metric of requests) {
      if (metric.labels?.backend) {
        byBackend[metric.labels.backend as keyof typeof byBackend] +=
          metric.value;
      }
      if (metric.labels?.model) {
        byModel[metric.labels.model] =
          (byModel[metric.labels.model] || 0) + metric.value;
      }
      if (metric.labels?.status === "error") {
        errors += metric.value;
      }
    }

    // Calculate requests per minute/second
    const uptimeMs = Date.now() - this.startTime;
    const uptimeMinutes = uptimeMs / 60000;
    const uptimeSeconds = uptimeMs / 1000;

    return {
      total,
      byBackend,
      byModel,
      errors,
      errorRate: total > 0 ? errors / total : 0,
      rpm: uptimeMinutes > 0 ? total / uptimeMinutes : 0,
      rps: uptimeSeconds > 0 ? total / uptimeSeconds : 0,
    };
  }

  /**
   * Get latency metrics
   */
  private getLatencyMetrics(): LatencyMetrics {
    const latencies = this.store.query({
      name: "request_latency_ms",
      start: this.startTime,
      end: Date.now(),
    });

    const allLatencies = latencies.map(m => m.value);

    // Get latencies by backend
    const localLatencies = latencies
      .filter(m => m.labels?.backend === "local")
      .map(m => m.value);
    const cloudLatencies = latencies
      .filter(m => m.labels?.backend === "cloud")
      .map(m => m.value);
    const hybridLatencies = latencies
      .filter(m => m.labels?.backend === "hybrid")
      .map(m => m.value);

    return {
      p50: this.percentile(allLatencies, 50),
      p95: this.percentile(allLatencies, 95),
      p99: this.percentile(allLatencies, 99),
      avg: this.average(allLatencies),
      min: Math.min(...allLatencies, 0),
      max: Math.max(...allLatencies, 0),
      byBackend: {
        local: this.getLatencyDistribution(localLatencies),
        cloud: this.getLatencyDistribution(cloudLatencies),
        hybrid: this.getLatencyDistribution(hybridLatencies),
      },
    };
  }

  /**
   * Get cache metrics
   */
  private getCacheMetrics(): CacheMetrics {
    const cacheOps = this.store.query({
      name: "cache_operations",
      start: this.startTime,
      end: Date.now(),
    });

    let hits = 0;
    let misses = 0;

    const byType = {
      semantic: { hits: 0, misses: 0, hitRate: 0 },
      embedding: { hits: 0, misses: 0, hitRate: 0 },
      lru: { hits: 0, misses: 0, hitRate: 0 },
    };

    for (const metric of cacheOps) {
      const cacheType = metric.labels?.cacheType as keyof typeof byType;
      const result = metric.labels?.result;

      if (cacheType && result) {
        if (result === "hit") {
          hits += metric.value;
          byType[cacheType].hits += metric.value;
        } else {
          misses += metric.value;
          byType[cacheType].misses += metric.value;
        }
      }
    }

    const total = hits + misses;

    // Calculate hit rates
    for (const type of Object.keys(byType)) {
      const typeTotal =
        byType[type as keyof typeof byType].hits +
        byType[type as keyof typeof byType].misses;
      byType[type as keyof typeof byType].hitRate =
        typeTotal > 0
          ? byType[type as keyof typeof byType].hits / typeTotal
          : 0;
    }

    // Get cache size (sum of all unique cache entries)
    const sizeMetrics = this.store.query({
      name: "cache_entry_size_bytes",
      start: this.startTime,
      end: Date.now(),
    });

    const avgEntrySize =
      sizeMetrics.length > 0 ? this.average(sizeMetrics.map(m => m.value)) : 0;

    return {
      hits,
      misses,
      hitRate: total > 0 ? hits / total : 0,
      missRate: total > 0 ? misses / total : 0,
      avgEntrySize,
      size: sizeMetrics.length,
      byType,
    };
  }

  /**
   * Get cost metrics
   */
  private getCostMetrics(): CostMetrics {
    const costs = this.store.query({
      name: "request_cost_usd",
      start: this.startTime,
      end: Date.now(),
    });

    let total = 0;
    const byBackend = { local: 0, cloud: 0, hybrid: 0 };
    const byModel: Record<string, number> = {};

    for (const metric of costs) {
      total += metric.value;

      if (metric.labels?.backend) {
        byBackend[metric.labels.backend as keyof typeof byBackend] +=
          metric.value;
      }
      if (metric.labels?.model) {
        byModel[metric.labels.model] =
          (byModel[metric.labels.model] || 0) + metric.value;
      }
    }

    const requestCount = this.getRequestMetrics().total;
    const uptimeHours = (Date.now() - this.startTime) / 3600000;

    // Cost this hour (last hour)
    const oneHourAgo = Date.now() - 3600000;
    const costThisHour = costs
      .filter(m => m.timestamp >= oneHourAgo)
      .reduce((sum, m) => sum + m.value, 0);

    // Cost today (last 24 hours)
    const oneDayAgo = Date.now() - 86400000;
    const costToday = costs
      .filter(m => m.timestamp >= oneDayAgo)
      .reduce((sum, m) => sum + m.value, 0);

    // Estimate monthly cost
    const estimatedMonthly =
      uptimeHours > 0 ? (total / uptimeHours) * 24 * 30 : 0;

    return {
      total,
      byBackend,
      byModel,
      costPer1k: requestCount > 0 ? (total / requestCount) * 1000 : 0,
      costThisHour,
      costToday,
      estimatedMonthly,
    };
  }

  /**
   * Get health metrics
   */
  private getHealthMetrics(): HealthMetrics {
    const healthMetrics = this.store.query({
      name: "backend_healthy",
      start: Date.now() - 300000, // Last 5 minutes
      end: Date.now() + 10000, // Add buffer to include recently written metrics
    });

    const backends: BackendHealth[] = [
      {
        backend: "local",
        healthy: true,
        responseTime: 0,
        uptime: 100,
        lastCheck: 0,
        consecutiveFailures: 0,
      },
      {
        backend: "cloud",
        healthy: true,
        responseTime: 0,
        uptime: 100,
        lastCheck: 0,
        consecutiveFailures: 0,
      },
      {
        backend: "hybrid",
        healthy: true,
        responseTime: 0,
        uptime: 100,
        lastCheck: 0,
        consecutiveFailures: 0,
      },
    ];

    for (const metric of healthMetrics) {
      const backendName = metric.labels?.backend as
        | "local"
        | "cloud"
        | "hybrid";
      if (backendName) {
        const backend = backends.find(b => b.backend === backendName);
        if (backend) {
          const isHealthy = metric.value === 1;
          // Update if this metric is newer than the last check
          if (metric.timestamp > backend.lastCheck) {
            backend.healthy = isHealthy;
            backend.lastCheck = metric.timestamp;
          }
        }
      }
    }

    // Get system metrics
    const queueDepth = this.getLatestGauge("queue_depth");
    const cpuUsage = this.getLatestGauge("cpu_usage_percent");
    const memoryUsage = this.getLatestGauge("memory_usage_percent");
    const activeConnections = this.getLatestGauge("active_connections");

    const overallHealthy = backends.every(b => b.healthy);

    return {
      healthy: overallHealthy,
      backends,
      queueDepth,
      cpuUsage,
      memoryUsage,
      activeConnections,
    };
  }

  /**
   * Get latest gauge value
   */
  private getLatestGauge(name: string): number {
    const metrics = this.store.query({
      name,
      start: Date.now() - 60000,
      end: Date.now(),
    });

    return metrics.length > 0 ? metrics[metrics.length - 1].value : 0;
  }

  /**
   * Calculate latency distribution
   */
  private getLatencyDistribution(latencies: number[]): LatencyDistribution {
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0 };
    }

    return {
      p50: this.percentile(latencies, 50),
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99),
      avg: this.average(latencies),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;

    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Calculate average
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, v) => sum + v, 0) / arr.length;
  }

  /**
   * Get request log
   */
  getRequestLog(options: {
    limit?: number;
    offset?: number;
  }): RequestLogEntry[] {
    const { limit = 100, offset = 0 } = options;
    // Use a stable sort to maintain insertion order when timestamps are equal
    // We add to the end of the array, so newer entries have higher indices
    return [...this.requestLog]
      .sort((a, b) => {
        if (b.timestamp !== a.timestamp) {
          return b.timestamp - a.timestamp; // Descending by timestamp
        }
        // When timestamps are equal, use the index in the original array as a tiebreaker
        // Since we push to the end, newer entries have higher indices
        return this.requestLog.indexOf(b) - this.requestLog.indexOf(a);
      })
      .slice(offset, offset + limit);
  }

  /**
   * Get error log
   */
  getErrorLog(options: {
    limit?: number;
    offset?: number;
    errorType?: string;
  }): ErrorLogEntry[] {
    const { limit = 100, offset = 0, errorType } = options;

    // Use a stable sort to maintain insertion order when timestamps are equal
    // We add to the end of the array, so newer entries have higher indices
    let errors = [...this.errorLog].sort((a, b) => {
      if (b.timestamp !== a.timestamp) {
        return b.timestamp - a.timestamp; // Descending by timestamp
      }
      // When timestamps are equal, use the index in the original array as a tiebreaker
      // Since we push to the end, newer entries have higher indices
      return this.errorLog.indexOf(b) - this.errorLog.indexOf(a);
    });

    if (errorType) {
      errors = errors.filter(e => e.errorType === errorType);
    }

    return errors.slice(offset, offset + limit);
  }

  /**
   * Get time series data for a metric
   */
  getTimeSeries(name: string, window: number = 60000): TimeSeriesPoint[] {
    const start = Date.now() - window;
    const metrics = this.store.query({ name, start, end: Date.now() });

    return metrics.map(m => ({
      timestamp: m.timestamp,
      value: m.value,
    }));
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.store.clear();
    this.requestLog = [];
    this.errorLog = [];
    this.latencyBuffer = [];
    this.startTime = Date.now();
  }

  /**
   * Export metrics as Prometheus format
   */
  exportPrometheus(): string {
    return this.store.exportPrometheus();
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }
}
