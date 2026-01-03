/**
 * @lsi/scale-strategy - Queue Depth Metric
 *
 * Tracks pending request queue depth for scaling decisions.
 */

import type {
  ScaleMetric,
  MetricCollectorConfig,
  WorkerPoolState,
} from "../types.js";
import { MetricType } from "../types.js";

/**
 * Default configuration for queue depth metric
 */
const DEFAULT_CONFIG: MetricCollectorConfig = {
  intervalMs: 5000,
  retentionMs: 3600000, // 1 hour
  enableSmoothing: true,
  smoothingWindow: 5,
};

/**
 * Queue depth metric collector
 */
export class QueueDepthMetric {
  private config: MetricCollectorConfig;
  private history: Array<{ timestamp: number; value: number }> = [];

  constructor(config: Partial<MetricCollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Collect current queue depth
   */
  async collect(workerState: WorkerPoolState): Promise<ScaleMetric> {
    const value = workerState.queuedRequests;
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
      name: "queue_depth",
      type: MetricType.QUEUE_DEPTH,
      value: smoothedValue,
      weight: 0.9, // High weight for queue depth
      threshold: {
        up: 50, // Scale up when queue > 50
        down: 10, // Scale down when queue < 10
      },
      unit: "requests",
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
  getAverage(windowMs: number = 60000): number {
    const cutoff = Date.now() - windowMs;
    const relevant = this.history.filter(h => h.timestamp >= cutoff);

    if (relevant.length === 0) {
      return 0;
    }

    return relevant.reduce((sum, h) => sum + h.value, 0) / relevant.length;
  }

  /**
   * Get trend (increasing, decreasing, stable)
   */
  getTrend(): "increasing" | "decreasing" | "stable" {
    if (this.history.length < 3) {
      return "stable";
    }

    const recent = this.history.slice(-10);
    const first = recent[0].value;
    const last = recent[recent.length - 1].value;
    const change = (last - first) / first;

    if (change > 0.1) {
      return "increasing";
    } else if (change < -0.1) {
      return "decreasing";
    }
    return "stable";
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
  }

  private smoothValue(value: number): number {
    if (this.history.length < this.config.smoothingWindow) {
      return value;
    }

    const window = this.history.slice(-this.config.smoothingWindow);
    const sum = window.reduce((s, h) => s + h.value, 0);

    return (sum + value) / (window.length + 1);
  }
}
