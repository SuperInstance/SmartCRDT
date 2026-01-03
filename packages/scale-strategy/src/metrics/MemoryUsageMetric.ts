/**
 * @lsi/scale-strategy - Memory Usage Metric
 *
 * Tracks memory utilization across workers for scaling decisions.
 */

import type {
  ScaleMetric,
  MetricCollectorConfig,
  WorkerPoolState,
} from "../types.js";
import { MetricType } from "../types.js";

/**
 * Default configuration for memory usage metric
 */
const DEFAULT_CONFIG: MetricCollectorConfig = {
  intervalMs: 15000,
  retentionMs: 3600000, // 1 hour
  enableSmoothing: true,
  smoothingWindow: 3,
};

/**
 * Memory usage metric collector
 */
export class MemoryUsageMetric {
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
   * Collect current memory usage
   */
  async collect(
    workerState: WorkerPoolState,
    perWorkerUsage?: Map<number, number>
  ): Promise<ScaleMetric> {
    let value: number;

    if (perWorkerUsage && perWorkerUsage.size > 0) {
      const values = Array.from(perWorkerUsage.values());
      value = values.reduce((sum, v) => sum + v, 0) / values.length;

      // Store per-worker history
      for (const [workerId, mem] of perWorkerUsage.entries()) {
        if (!this.perWorkerHistory.has(workerId)) {
          this.perWorkerHistory.set(workerId, []);
        }
        this.perWorkerHistory
          .get(workerId)!
          .push({ timestamp: Date.now(), value: mem });
      }
    } else if (workerState.active > 0) {
      value = this.simulateMemoryUsage(workerState);
    } else {
      value = 0;
    }

    const timestamp = Date.now();

    this.history.push({ timestamp, value });
    this.trimHistory();

    const smoothedValue = this.config.enableSmoothing
      ? this.smoothValue(value)
      : value;

    return {
      name: "memory_usage",
      type: MetricType.MEMORY_USAGE,
      value: smoothedValue,
      weight: 0.7,
      threshold: {
        up: 80, // Scale up when memory > 80%
        down: 40, // Scale down when memory < 40%
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
   * Get max value over time window
   */
  getMax(windowMs: number = 300000): number {
    const cutoff = Date.now() - windowMs;
    const relevant = this.history.filter(h => h.timestamp >= cutoff);

    if (relevant.length === 0) {
      return 0;
    }

    return Math.max(...relevant.map(h => h.value));
  }

  /**
   * Get per-worker memory usage
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

  private simulateMemoryUsage(workerState: WorkerPoolState): number {
    const baseMem = 10; // Base memory usage
    const perWorkerMem = 12; // Memory per active worker
    const queueMem = Math.min(workerState.queuedRequests * 0.3, 20);

    return Math.min(
      100,
      baseMem + workerState.active * perWorkerMem + queueMem
    );
  }
}
