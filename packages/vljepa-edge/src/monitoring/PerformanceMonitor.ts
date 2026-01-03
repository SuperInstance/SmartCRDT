/**
 * @fileoverview Performance Monitor for VL-JEPA Edge Deployment
 *
 * Monitors and tracks inference performance metrics:
 * - Latency percentiles (P50, P95, P99)
 * - Memory usage tracking
 * - GPU utilization (if available)
 * - Error rate monitoring
 * - Throughput metrics
 *
 * @package @lsi/vljepa-edge
 */

import type { PerformanceMonitorConfig, PerformanceMetrics } from "../types.js";

/**
 * Performance metric sample
 */
interface MetricSample {
  timestamp: number;
  latency: number;
  memory: number;
  gpuMemory?: number;
  gpuUtilization?: number;
  error: boolean;
  batchSize: number;
  cached: boolean;
}

/**
 * Performance Monitor for VL-JEPA edge deployment
 *
 * Tracks and analyzes performance metrics for inference operations.
 */
export class PerformanceMonitor {
  private config: PerformanceMonitorConfig;
  private samples: MetricSample[] = [];
  private errorCounts: Map<string, number> = new Map();
  private startTime: number = Date.now();
  private inferenceCount: number = 0;
  private cacheHits: number = 0;
  private collectionInterval: number | null = null;
  private modelLoadTime: number = 0;
  private currentMemory: number = 0;
  private peakMemory: number = 0;

  constructor(config: PerformanceMonitorConfig) {
    this.config = config;
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.config.autoProfiling) {
      this.collectionInterval = window.setInterval(() => {
        this.collectMetrics();
      }, this.config.collectionInterval);
    }

    this.startTime = Date.now();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.collectionInterval !== null) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  /**
   * Record inference metrics
   */
  recordInference(metrics: {
    latency: number;
    memory: number;
    gpuMemory?: number;
    gpuUtilization?: number;
    error: boolean;
    batchSize: number;
    cached: boolean;
  }): void {
    const sample: MetricSample = {
      timestamp: Date.now(),
      ...metrics,
    };

    this.samples.push(sample);
    this.inferenceCount++;

    if (metrics.cached) {
      this.cacheHits++;
    }

    if (metrics.error) {
      const errorType = metrics.error ? "inference_error" : "unknown";
      this.errorCounts.set(
        errorType,
        (this.errorCounts.get(errorType) || 0) + 1
      );
    }

    // Track memory peaks
    this.currentMemory = metrics.memory;
    if (metrics.memory > this.peakMemory) {
      this.peakMemory = metrics.memory;
    }

    // Maintain sample size limit
    if (this.samples.length > this.config.sampleSize) {
      this.samples.shift();
    }

    // Check alert thresholds
    this.checkAlerts(sample);
  }

  /**
   * Record model load time
   */
  recordModelLoad(loadTime: number): void {
    this.modelLoadTime = loadTime;
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    const latencies = this.samples.map(s => s.latency);
    const memories = this.samples.map(s => s.memory);

    return {
      latency: this.calculatePercentiles(latencies),
      memory: {
        current: this.currentMemory,
        peak: this.peakMemory,
        average: this.average(memories),
        limit: this.getMemoryLimit(),
      },
      gpu: this.getGPUMetrics(),
      errors: this.getErrorMetrics(),
      throughput: this.getThroughputMetrics(),
      model: {
        loadTime: this.modelLoadTime,
        inferenceTime: this.average(latencies),
        cacheHitRate: this.cacheHits / Math.max(1, this.inferenceCount),
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.samples = [];
    this.errorCounts.clear();
    this.startTime = Date.now();
    this.inferenceCount = 0;
    this.cacheHits = 0;
    this.peakMemory = 0;
    this.modelLoadTime = 0;
  }

  /**
   * Export metrics as JSON
   */
  export(): string {
    const metrics = this.getMetrics();
    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    // Latency metrics
    lines.push(`vljepa_latency_p50 ${metrics.latency.p50}`);
    lines.push(`vljepa_latency_p95 ${metrics.latency.p95}`);
    lines.push(`vljepa_latency_p99 ${metrics.latency.p99}`);
    lines.push(`vljepa_latency_average ${metrics.latency.average}`);

    // Memory metrics
    lines.push(`vljepa_memory_current ${metrics.memory.current}`);
    lines.push(`vljepa_memory_peak ${metrics.memory.peak}`);
    lines.push(`vljepa_memory_average ${metrics.memory.average}`);

    // GPU metrics (if available)
    if (metrics.gpu) {
      lines.push(`vljepa_gpu_utilization ${metrics.gpu.utilization}`);
      lines.push(`vljepa_gpu_memory ${metrics.gpu.memory}`);
    }

    // Error metrics
    lines.push(`vljepa_error_rate ${metrics.errors.rate}`);

    // Throughput metrics
    lines.push(`vljepa_throughput_rps ${metrics.throughput.rps}`);

    // Cache metrics
    lines.push(`vljepa_cache_hit_rate ${metrics.model.cacheHitRate}`);

    return lines.join("\n");
  }

  /**
   * Get percentile latency over a time window
   */
  getLatencyPercentile(percentile: 50 | 95 | 99, windowMs?: number): number {
    let samples = this.samples;

    if (windowMs) {
      const cutoff = Date.now() - windowMs;
      samples = samples.filter(s => s.timestamp >= cutoff);
    }

    const latencies = samples.map(s => s.latency).sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * latencies.length);
    return latencies[Math.max(0, index - 1)] || 0;
  }

  /**
   * Get average latency over a time window
   */
  getAverageLatency(windowMs?: number): number {
    let samples = this.samples;

    if (windowMs) {
      const cutoff = Date.now() - windowMs;
      samples = samples.filter(s => s.timestamp >= cutoff);
    }

    return this.average(samples.map(s => s.latency));
  }

  /**
   * Get error rate
   */
  getErrorRate(): number {
    if (this.inferenceCount === 0) {
      return 0;
    }
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (a, b) => a + b,
      0
    );
    return totalErrors / this.inferenceCount;
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    if (this.inferenceCount === 0) {
      return 0;
    }
    return this.cacheHits / this.inferenceCount;
  }

  /**
   * Get samples
   */
  getSamples(): MetricSample[] {
    return [...this.samples];
  }

  /**
   * Get error counts by type
   */
  getErrorCounts(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Collect metrics periodically
   */
  private collectMetrics(): void {
    // Collect current system metrics
    if (performance.memory) {
      this.currentMemory = performance.memory.usedJSHeapSize / (1024 * 1024);
    }

    // Export metrics if configured
    if (this.config.exportMetrics && this.config.exportEndpoint) {
      this.exportToEndpoint();
    }
  }

  /**
   * Calculate percentiles from values
   */
  private calculatePercentiles(values: number[]): {
    p50: number;
    p95: number;
    p99: number;
    average: number;
    min: number;
    max: number;
  } {
    if (values.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        average: 0,
        min: 0,
        max: 0,
      };
    }

    const sorted = [...values].sort((a, b) => a - b);

    return {
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      average: this.average(values),
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.floor((p / 100) * sorted.length);
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get GPU metrics
   */
  private getGPUMetrics(): PerformanceMetrics["gpu"] | undefined {
    const gpuSamples = this.samples.filter(s => s.gpuUtilization !== undefined);

    if (gpuSamples.length === 0) {
      return undefined;
    }

    const utilizations = gpuSamples
      .map(s => s.gpuUtilization!)
      .filter(u => u !== undefined);
    const memories = gpuSamples
      .map(s => s.gpuMemory!)
      .filter(m => m !== undefined);

    return {
      utilization: this.average(utilizations),
      memory: this.average(memories),
      memoryLimit: 1024,
    };
  }

  /**
   * Get error metrics
   */
  private getErrorMetrics(): PerformanceMetrics["errors"] {
    const totalErrors = Array.from(this.errorCounts.values()).reduce(
      (a, b) => a + b,
      0
    );

    return {
      rate: this.getErrorRate(),
      total: totalErrors,
      totalRequests: this.inferenceCount,
      types: Object.fromEntries(this.errorCounts),
    };
  }

  /**
   * Get throughput metrics
   */
  private getThroughputMetrics(): PerformanceMetrics["throughput"] {
    const duration = (Date.now() - this.startTime) / 1000; // seconds
    const avgBatchSize = this.average(this.samples.map(s => s.batchSize)) || 1;

    return {
      rps: duration > 0 ? this.inferenceCount / duration : 0,
      avgBatchSize,
    };
  }

  /**
   * Get memory limit
   */
  private getMemoryLimit(): number {
    if (performance.memory) {
      return performance.memory.jsHeapSizeLimit / (1024 * 1024);
    }
    return 4096; // 4GB default
  }

  /**
   * Check alert thresholds
   */
  private checkAlerts(sample: MetricSample): void {
    if (sample.latency > this.config.alerts.latencyThreshold) {
      console.warn(
        `[PerformanceMonitor] High latency detected: ${sample.latency}ms > ${this.config.alerts.latencyThreshold}ms`
      );
    }

    if (sample.memory > this.config.alerts.memoryThreshold) {
      console.warn(
        `[PerformanceMonitor] High memory usage detected: ${sample.memory}MB > ${this.config.alerts.memoryThreshold}MB`
      );
    }

    const errorRate = this.getErrorRate();
    if (errorRate > this.config.alerts.errorRateThreshold) {
      console.warn(
        `[PerformanceMonitor] High error rate detected: ${(errorRate * 100).toFixed(1)}%`
      );
    }
  }

  /**
   * Export metrics to endpoint
   */
  private async exportToEndpoint(): Promise<void> {
    if (!this.config.exportEndpoint) {
      return;
    }

    try {
      const metrics = this.getMetrics();
      const format = this.config.exportFormat || "json";

      let body: string;
      let contentType: string;

      if (format === "json") {
        body = JSON.stringify(metrics);
        contentType = "application/json";
      } else {
        body = this.exportPrometheus();
        contentType = "text/plain";
      }

      await fetch(this.config.exportEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
        },
        body,
      });
    } catch (error) {
      console.error("[PerformanceMonitor] Failed to export metrics:", error);
    }
  }
}

/**
 * Create a performance monitor instance
 */
export function createPerformanceMonitor(
  config: PerformanceMonitorConfig
): PerformanceMonitor {
  return new PerformanceMonitor(config);
}

/**
 * Default performance monitor configuration
 */
export function getDefaultPerformanceMonitorConfig(): PerformanceMonitorConfig {
  return {
    collectionInterval: 1000, // 1 second
    sampleSize: 1000,
    autoProfiling: true,
    alerts: {
      latencyThreshold: 1000, // 1 second
      memoryThreshold: 1024, // 1GB
      errorRateThreshold: 0.05, // 5%
    },
    exportMetrics: false,
    exportFormat: "json",
  };
}
