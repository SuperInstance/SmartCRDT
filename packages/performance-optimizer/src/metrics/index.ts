/**
 * Performance Metrics Collection and Aggregation
 *
 * Real-time metrics collection with:
 * - Time-series data storage
 * - Rolling window aggregation
 * - Performance baseline comparison
 * - Threshold-based alerting
 */

import type {
  LatencyMetrics,
  MemoryMetrics,
  CpuMetrics,
  PerformanceThreshold,
  PerformanceAlert
} from "../types/index.js";

/**
 * Metrics collector for real-time performance tracking
 */
export class PerformanceMetrics {
  private latencyData: Map<string, number[]> = new Map();
  private memoryData: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  }> = [];

  private cpuData: Array<{
    timestamp: number;
    usage: number;
    userCpu: number;
    systemCpu: number;
  }> = [];

  private throughputData: Map<string, number[]> = new Map();
  private errorRateData: Map<string, number[]> = new Map();

  // Configuration
  private maxDataPoints = 1000; // Maximum data points to store per metric
  private alertThresholds: PerformanceThreshold[] = [];

  /**
   * Start collecting metrics for an operation
   */
  start(operationName: string): void {
    this.latencyData.set(operationName, []);
    this.throughputData.set(operationName, []);
    this.errorRateData.set(operationName, []);
  }

  /**
   * Record latency measurement
   */
  recordLatency(operationName: string, latency: number, breakdown?: {
    queue?: number;
    processing?: number;
    io?: number;
    network?: number;
  }): void {
    if (!this.latencyData.has(operationName)) {
      this.latencyData.set(operationName, []);
    }

    const latencies = this.latencyData.get(operationName)!;
    latencies.push(latency);

    // Maintain rolling window
    if (latencies.length > this.maxDataPoints) {
      latencies.shift();
    }
  }

  /**
   * Record throughput measurement
   */
  recordThroughput(operationName: string, throughput: number): void {
    if (!this.throughputData.has(operationName)) {
      this.throughputData.set(operationName, []);
    }

    const throughputs = this.throughputData.get(operationName)!;
    throughputs.push(throughput);

    if (throughputs.length > this.maxDataPoints) {
      throughputs.shift();
    }
  }

  /**
   * Record error rate
   */
  recordErrorRate(operationName: string, errorRate: number): void {
    if (!this.errorRateData.has(operationName)) {
      this.errorRateData.set(operationName, []);
    }

    const errorRates = this.errorRateData.get(operationName)!;
    errorRates.push(errorRate);

    if (errorRates.length > this.maxDataPoints) {
      errorRates.shift();
    }
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  }): void {
    this.memoryData.push({
      timestamp: Date.now(),
      ...memoryUsage
    });

    // Maintain rolling window
    if (this.memoryData.length > this.maxDataPoints) {
      this.memoryData.shift();
    }
  }

  /**
   * Record CPU usage
   */
  recordCpuUsage(cpuUsage: {
    usage: number;
    userCpu: number;
    systemCpu: number;
  }): void {
    this.cpuData.push({
      timestamp: Date.now(),
      ...cpuUsage
    });

    if (this.cpuData.length > this.maxDataPoints) {
      this.cpuData.shift();
    }
  }

  /**
   * Calculate latency metrics
   */
  getLatencyMetrics(operationName: string): LatencyMetrics | null {
    const latencies = this.latencyData.get(operationName);
    if (!latencies || latencies.length === 0) {
      return null;
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      total: sorted[count - 1], // Max as total (simplified)
      queue: 0, // Would need breakdown data
      processing: 0,
      io: 0,
      network: 0,
      p50: sorted[Math.floor(count * 0.5)],
      p90: sorted[Math.floor(count * 0.9)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
      stdDev: this.calculateStandardDeviation(sorted)
    };
  }

  /**
   * Calculate memory metrics
   */
  getMemoryMetrics(): MemoryMetrics | null {
    if (this.memoryData.length === 0) {
      return null;
    }

    const latest = this.memoryData[this.memoryData.length - 1];
    const history = this.memoryData.map(d => ({
      timestamp: d.timestamp,
      heapUsed: d.heapUsed
    }));

    // Detect memory leaks (simplified)
    const leakDetection = this.detectMemoryLeaks();

    return {
      heapUsed: latest.heapUsed,
      heapTotal: latest.heapTotal,
      external: latest.external,
      rss: latest.rss,
      history,
      leak: leakDetection
    };
  }

  /**
   * Calculate CPU metrics
   */
  getCpuMetrics(): CpuMetrics | null {
    if (this.cpuData.length === 0) {
      return null;
    }

    const latest = this.cpuData[this.cpuData.length - 1];
    const usages = this.cpuData.map(d => d.usage);

    return {
      usage: latest.usage,
      cores: require('os').cpus().length,
      breakdown: {
        user: (latest.userCpu / 1000) * 100, // Convert to percentage
        system: (latest.systemCpu / 1000) * 100,
        idle: 0, // Would need process.cpuinfo or similar
        iowait: 0
      },
      spikes: this.detectCpuSpikes(usages)
    };
  }

  /**
   * Stop metrics collection
   */
  stop(operationName: string): void {
    // Clear data for the operation
    this.latencyData.delete(operationName);
    this.throughputData.delete(operationName);
    this.errorRateData.delete(operationName);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.latencyData.clear();
    this.memoryData = [];
    this.cpuData = [];
    this.throughputData.clear();
    this.errorRateData.clear();
  }

  /**
   * Set alert thresholds
   */
  setAlertThresholds(thresholds: PerformanceThreshold[]): void {
    this.alertThresholds = thresholds;
  }

  /**
   * Check for threshold violations
   */
  checkThresholds(operationName: string): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];

    // Check latency
    const latencyMetrics = this.getLatencyMetrics(operationName);
    if (latencyMetrics) {
      const latencyThreshold = this.alertThresholds.find(t => t.metric === 'latency');
      if (latencyThreshold) {
        const check = this.evaluateThreshold(latencyMetrics.total, latencyThreshold);
        if (check) {
          alerts.push({
            id: `latency-${Date.now()}`,
            timestamp: Date.now(),
            type: check === 'warning' ? 'warning' : 'critical',
            metric: 'latency',
            value: latencyMetrics.total,
            threshold: latencyThreshold,
            message: latencyThreshold.message.replace('{value}', latencyMetrics.total.toString())
          });
        }
      }
    }

    // Check memory
    const memoryMetrics = this.getMemoryMetrics();
    if (memoryMetrics) {
      const memoryThreshold = this.alertThresholds.find(t => t.metric === 'memory');
      if (memoryThreshold) {
        const check = this.evaluateThreshold(memoryMetrics.heapUsed, memoryThreshold);
        if (check) {
          alerts.push({
            id: `memory-${Date.now()}`,
            timestamp: Date.now(),
            type: check === 'warning' ? 'warning' : 'critical',
            metric: 'memory',
            value: memoryMetrics.heapUsed,
            threshold: memoryThreshold,
            message: memoryThreshold.message.replace('{value}', memoryMetrics.heapUsed.toString())
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    operations: string[];
    latency: { [operation: string]: LatencyMetrics | null };
    memory: MemoryMetrics | null;
    cpu: CpuMetrics | null;
    throughput: { [operation: string]: number };
    errorRate: { [operation: string]: number };
  } {
    const operations = Array.from(this.latencyData.keys());
    const latency: { [operation: string]: LatencyMetrics | null } = {};
    const throughput: { [operation: string]: number } = {};
    const errorRate: { [operation: string]: number } = {};

    operations.forEach(op => {
      latency[op] = this.getLatencyMetrics(op);
      const throughputs = this.throughputData.get(op);
      const errorRates = this.errorRateData.get(op);

      if (throughputs && throughputs.length > 0) {
        throughput[op] = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      }

      if (errorRates && errorRates.length > 0) {
        errorRate[op] = errorRates.reduce((a, b) => a + b, 0) / errorRates.length;
      }
    });

    return {
      operations,
      latency,
      memory: this.getMemoryMetrics(),
      cpu: this.getCpuMetrics(),
      throughput,
      errorRate
    };
  }

  // Private helper methods
  private calculateStandardDeviation(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private detectMemoryLeaks(): { suspected: boolean; ratePerMinute: number; suspiciousObjects: string[] } {
    if (this.memoryData.length < 10) {
      return { suspected: false, ratePerMinute: 0, suspiciousObjects: [] };
    }

    const recent = this.memoryData.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    const duration = (newest.timestamp - oldest.timestamp) / 1000 / 60; // minutes
    const growth = newest.heapUsed - oldest.heapUsed;
    const ratePerMinute = growth / duration;

    return {
      suspected: ratePerMinute > 1, // > 1MB/min growth
      ratePerMinute,
      suspiciousObjects: ratePerMinute > 1 ? ['Memory buffer', 'Cache', 'Event listeners'] : []
    };
  }

  private detectCpuSpikes(usages: number[]): Array<{ timestamp: number; usage: number; duration: number }> {
    const spikes = [];
    let currentSpike: { start: number; usage: number } | null = null;

    for (let i = 0; i < usages.length; i++) {
      if (usages[i] > 90) { // > 90% CPU usage
        if (!currentSpike) {
          currentSpike = { start: i, usage: usages[i] };
        }
      } else {
        if (currentSpike) {
          spikes.push({
            timestamp: Date.now() - (usages.length - i) * 1000, // Approximate timestamp
            usage: currentSpike.usage,
            duration: i - currentSpike.start
          });
          currentSpike = null;
        }
      }
    }

    return spikes;
  }

  private evaluateThreshold(value: number, threshold: PerformanceThreshold): 'warning' | 'critical' | null {
    switch (threshold.operator) {
      case 'gt':
        if (value > threshold.critical) return 'critical';
        if (value > threshold.warning) return 'warning';
        break;
      case 'lt':
        if (value < threshold.critical) return 'critical';
        if (value < threshold.warning) return 'warning';
        break;
      case 'gte':
        if (value >= threshold.critical) return 'critical';
        if (value >= threshold.warning) return 'warning';
        break;
      case 'lte':
        if (value <= threshold.critical) return 'critical';
        if (value <= threshold.warning) return 'warning';
        break;
    }
    return null;
  }
}

/**
 * Metrics aggregator for rolling window calculations
 */
export class MetricsAggregator {
  private windowSize: number; // in milliseconds
  private data: Array<{
    timestamp: number;
    metrics: any;
  }> = [];

  constructor(windowSize: number = 60000) { // Default 1 minute window
    this.windowSize = windowSize;
  }

  /**
   * Add metrics data point
   */
  add(timestamp: number, metrics: any): void {
    this.data.push({ timestamp, metrics });

    // Remove old data points
    const cutoff = timestamp - this.windowSize;
    this.data = this.data.filter(d => d.timestamp > cutoff);
  }

  /**
   * Get aggregated metrics for the current window
   */
  aggregate(): any {
    if (this.data.length === 0) return null;

    const aggregated = {
      count: this.data.length,
      timestamp: Date.now()
    };

    // Calculate average for numeric fields
    for (const key in this.data[0].metrics) {
      if (typeof this.data[0].metrics[key] === 'number') {
        const sum = this.data.reduce((acc, d) => acc + d.metrics[key], 0);
        aggregated[key] = sum / this.data.length;
      } else {
        // For non-numeric fields, take the latest value
        aggregated[key] = this.data[this.data.length - 1].metrics[key];
      }
    }

    return aggregated;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.data = [];
  }
}