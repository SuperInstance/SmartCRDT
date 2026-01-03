/**
 * @lsi/scale-strategy - Latency Metric
 *
 * Tracks request latency (p50, p95, p99) for scaling decisions.
 */

import type {
  ScaleMetric,
  MetricCollectorConfig,
  WorkerPoolState,
} from "../types.js";
import { MetricType } from "../types.js";

/**
 * Latency percentile
 */
export type LatencyPercentile = "p50" | "p95" | "p99" | "p999";

/**
 * Default configuration for latency metric
 */
const DEFAULT_CONFIG: MetricCollectorConfig = {
  intervalMs: 5000,
  retentionMs: 3600000, // 1 hour
  enableSmoothing: false,
  smoothingWindow: 5,
};

/**
 * Latency measurement
 */
export interface LatencyMeasurement {
  timestamp: number;
  latency: number;
  workerId?: number;
}

/**
 * Latency metric collector
 */
export class LatencyMetric {
  private config: MetricCollectorConfig;
  private history: Array<{ timestamp: number; value: number }> = [];
  private measurements: LatencyMeasurement[] = [];
  private defaultPercentile: LatencyPercentile = "p95";

  constructor(config: Partial<MetricCollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Collect current latency
   */
  async collect(
    workerState: WorkerPoolState,
    percentile?: LatencyPercentile
  ): Promise<ScaleMetric> {
    const targetPercentile = percentile || this.defaultPercentile;

    // Calculate percentile from recent measurements
    const value = this.calculatePercentile(targetPercentile);

    const timestamp = Date.now();
    this.history.push({ timestamp, value });
    this.trimHistory();

    const smoothedValue = this.config.enableSmoothing
      ? this.smoothValue(value)
      : value;

    return {
      name: "latency",
      type: MetricType.LATENCY,
      value: smoothedValue,
      weight: 0.85,
      threshold: {
        up: 1000, // Scale up when latency > 1000ms
        down: 200, // Scale down when latency < 200ms
      },
      unit: "milliseconds",
      timestamp,
    };
  }

  /**
   * Record a latency measurement
   */
  recordMeasurement(measurement: LatencyMeasurement): void {
    this.measurements.push(measurement);

    // Keep only recent measurements (last 5 minutes)
    const cutoff = Date.now() - 300000;
    this.measurements = this.measurements.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Record a latency measurement (convenience method)
   */
  recordLatency(latency: number, workerId?: number): void {
    this.recordMeasurement({
      timestamp: Date.now(),
      latency,
      workerId,
    });
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
   * Get percentile value
   */
  getPercentile(percentile: LatencyPercentile): number {
    return this.calculatePercentile(percentile);
  }

  /**
   * Get all percentiles
   */
  getAllPercentiles(): Record<LatencyPercentile, number> {
    return {
      p50: this.calculatePercentile("p50"),
      p95: this.calculatePercentile("p95"),
      p99: this.calculatePercentile("p99"),
      p999: this.calculatePercentile("p999"),
    };
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
   * Get measurement count
   */
  getMeasurementCount(): number {
    return this.measurements.length;
  }

  /**
   * Get history
   */
  getHistory(): Array<{ timestamp: number; value: number }> {
    return [...this.history];
  }

  /**
   * Get measurements
   */
  getMeasurements(): LatencyMeasurement[] {
    return [...this.measurements];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.measurements = [];
  }

  /**
   * Set default percentile
   */
  setDefaultPercentile(percentile: LatencyPercentile): void {
    this.defaultPercentile = percentile;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MetricCollectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private calculatePercentile(percentile: LatencyPercentile): number {
    if (this.measurements.length === 0) {
      return 0;
    }

    const percentileValue = this.parsePercentile(percentile);
    const sorted = [...this.measurements]
      .map(m => m.latency)
      .sort((a, b) => a - b);

    const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
    return sorted[index];
  }

  private parsePercentile(percentile: LatencyPercentile): number {
    switch (percentile) {
      case "p50":
        return 50;
      case "p95":
        return 95;
      case "p99":
        return 99;
      case "p999":
        return 99.9;
      default:
        return 95;
    }
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
