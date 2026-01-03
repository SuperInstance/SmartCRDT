/**
 * @lsi/scale-strategy - CPU Usage Metric
 *
 * Tracks CPU utilization across workers for scaling decisions.
 */

import type {
  ScaleMetric,
  MetricCollectorConfig,
  WorkerPoolState,
} from "../types.js";
import { MetricType } from "../types.js";

/**
 * Default configuration for CPU usage metric
 */
const DEFAULT_CONFIG: MetricCollectorConfig = {
  intervalMs: 10000,
  retentionMs: 3600000, // 1 hour
  enableSmoothing: true,
  smoothingWindow: 3,
};

/**
 * CPU usage metric collector
 */
export class CpuUsageMetric {
  private config: MetricCollectorConfig;
  private history: Array<{ timestamp: number; value: number }> = [];
  private perWorkerHistory: Map<
    number,
    Array<{ timestamp: number; value: number }>
  > = new Map();

  constructor(config: Partial<MetricCollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Collect current CPU usage
   */
  async collect(
    workerState: WorkerPoolState,
    perWorkerUsage?: Map<number, number>
  ): Promise<ScaleMetric> {
    // Calculate average CPU usage
    let value: number;

    if (perWorkerUsage && perWorkerUsage.size > 0) {
      // Average of per-worker CPU
      const values = Array.from(perWorkerUsage.values());
      value = values.reduce((sum, v) => sum + v, 0) / values.length;

      // Store per-worker history
      for (const [workerId, cpu] of perWorkerUsage.entries()) {
        if (!this.perWorkerHistory.has(workerId)) {
          this.perWorkerHistory.set(workerId, []);
        }
        this.perWorkerHistory
          .get(workerId)!
          .push({ timestamp: Date.now(), value: cpu });
      }
    } else if (workerState.active > 0) {
      // Simulated CPU based on active workers
      // In real implementation, this would query actual CPU metrics
      value = this.simulateCpuUsage(workerState);
    } else {
      value = 0;
    }

    const timestamp = Date.now();

    // Add to history
    this.history.push({ timestamp, value });

    // Trim old history
    this.trimHistory();

    // Apply smoothing if enabled
    const smoothedValue = this.config.enableSmoothing
      ? this.smoothValue(value)
      : value;

    return {
      name: "cpu_usage",
      type: MetricType.CPU_USAGE,
      value: smoothedValue,
      weight: 0.8,
      threshold: {
        up: 70, // Scale up when CPU > 70%
        down: 30, // Scale down when CPU < 30%
      },
      unit: "percent",
      timestamp,
    };
  }

  /**
   * Get current value
   */
  getValue(): number {
    if (this.history.length === 0) {
      return 0;
    }
    return this.history[this.history.length - 1].value;
  }

  /**
   * Get average value over time window
   */
  getAverage(windowMs: number = 300000): number {
    const cutoff = Date.now() - windowMs;
    const relevant = this.history.filter(h => h.timestamp >= cutoff);

    if (relevant.length === 0) {
      return 0;
    }

    return relevant.reduce((sum, h) => sum + h.value, 0) / relevant.length;
  }

  /**
   * Get percentile value over time window
   */
  getPercentile(percentile: number = 95, windowMs: number = 300000): number {
    const cutoff = Date.now() - windowMs;
    const relevant = this.history.filter(h => h.timestamp >= cutoff);

    if (relevant.length === 0) {
      return 0;
    }

    const sorted = relevant.map(h => h.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;

    return sorted[index];
  }

  /**
   * Get per-worker CPU usage
   */
  getPerWorkerUsage(
    workerId: number
  ): Array<{ timestamp: number; value: number }> {
    return this.perWorkerHistory.get(workerId) || [];
  }

  /**
   * Get history
   */
  getHistory(): Array<{ timestamp: number; value: number }> {
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.perWorkerHistory.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MetricCollectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private trimHistory(): void {
    const cutoff = Date.now() - this.config.retentionMs;
    this.history = this.history.filter(h => h.timestamp >= cutoff);

    // Trim per-worker history
    for (const [workerId, history] of this.perWorkerHistory.entries()) {
      this.perWorkerHistory.set(
        workerId,
        history.filter(h => h.timestamp >= cutoff)
      );
    }
  }

  private smoothValue(value: number): number {
    if (this.history.length < this.config.smoothingWindow) {
      return value;
    }

    const window = this.history.slice(-this.config.smoothingWindow);
    const sum = window.reduce((s, h) => s + h.value, 0);

    return (sum + value) / (window.length + 1);
  }

  private simulateCpuUsage(workerState: WorkerPoolState): number {
    // Simulated CPU based on active workers and queue
    // In real implementation, this would query actual metrics
    const baseCpu = 20; // Base CPU usage
    const perWorkerCpu = 15; // CPU per active worker
    const queueCpu = Math.min(workerState.queuedRequests * 0.5, 30); // CPU from queued requests

    return Math.min(
      100,
      baseCpu + workerState.active * perWorkerCpu + queueCpu
    );
  }
}
