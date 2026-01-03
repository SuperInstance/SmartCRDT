/**
 * @lsi/scale-strategy - Custom Metric
 *
 * User-defined metric collector for custom scaling logic.
 */

import type {
  ScaleMetric,
  MetricCollectorConfig,
  WorkerPoolState,
} from "../types.js";
import { MetricType } from "../types.js";

/**
 * Custom metric collector function
 */
export type CustomMetricCollector = (
  workerState: WorkerPoolState,
  history: Array<{ timestamp: number; value: number }>
) => number | Promise<number>;

/**
 * Custom metric configuration
 */
export interface CustomMetricConfig {
  /** Metric name */
  name: string;
  /** Collector function */
  collector: CustomMetricCollector;
  /** Weight in decision making (0-1) */
  weight: number;
  /** Scale up threshold */
  thresholdUp: number;
  /** Scale down threshold */
  thresholdDown: number;
  /** Unit of measurement */
  unit: string;
  /** Collection interval (ms) */
  intervalMs?: number;
  /** Whether to enable smoothing */
  enableSmoothing?: boolean;
}

/**
 * Default configuration for custom metric
 */
const DEFAULT_CONFIG: MetricCollectorConfig = {
  intervalMs: 10000,
  retentionMs: 3600000,
  enableSmoothing: true,
  smoothingWindow: 3,
};

/**
 * Custom metric collector
 */
export class CustomMetric {
  private config: CustomMetricConfig;
  private collectorConfig: MetricCollectorConfig;
  private history: Array<{ timestamp: number; value: number }> = [];

  constructor(config: CustomMetricConfig) {
    this.config = config;
    this.collectorConfig = {
      ...DEFAULT_CONFIG,
      intervalMs: config.intervalMs || DEFAULT_CONFIG.intervalMs,
      enableSmoothing: config.enableSmoothing ?? DEFAULT_CONFIG.enableSmoothing,
    };
  }

  /**
   * Collect current metric value
   */
  async collect(workerState: WorkerPoolState): Promise<ScaleMetric> {
    // Call custom collector
    const value = await this.config.collector(workerState, this.history);
    const timestamp = Date.now();

    // Add to history
    this.history.push({ timestamp, value });
    this.trimHistory();

    // Apply smoothing if enabled
    const smoothedValue = this.collectorConfig.enableSmoothing
      ? this.smoothValue(value)
      : value;

    return {
      name: this.config.name,
      type: MetricType.CUSTOM,
      value: smoothedValue,
      weight: this.config.weight,
      threshold: {
        up: this.config.thresholdUp,
        down: this.config.thresholdDown,
      },
      unit: this.config.unit,
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
   * Get min value over time window
   */
  getMin(windowMs: number = 300000): number {
    const cutoff = Date.now() - windowMs;
    const relevant = this.history.filter(h => h.timestamp >= cutoff);

    if (relevant.length === 0) {
      return 0;
    }

    return Math.min(...relevant.map(h => h.value));
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
   * Get trend
   */
  getTrend(): "increasing" | "decreasing" | "stable" {
    if (this.history.length < 3) {
      return "stable";
    }

    const recent = this.history.slice(-10);
    const first = recent[0].value;
    const last = recent[recent.length - 1].value;
    const change = first !== 0 ? (last - first) / Math.abs(first) : 0;

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
  updateConfig(config: Partial<CustomMetricConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update collector configuration
   */
  updateCollectorConfig(config: Partial<MetricCollectorConfig>): void {
    this.collectorConfig = { ...this.collectorConfig, ...config };
  }

  private trimHistory(): void {
    const cutoff = Date.now() - this.collectorConfig.retentionMs;
    this.history = this.history.filter(h => h.timestamp >= cutoff);
  }

  private smoothValue(value: number): number {
    if (this.history.length < this.collectorConfig.smoothingWindow) {
      return value;
    }

    const window = this.history.slice(-this.collectorConfig.smoothingWindow);
    const sum = window.reduce((s, h) => s + h.value, 0);

    return (sum + value) / (window.length + 1);
  }
}

/**
 * Helper function to create a simple gauge-based custom metric
 */
export function createGaugeMetric(
  name: string,
  getter: () => number | Promise<number>,
  config: Partial<Omit<CustomMetricConfig, "name" | "collector">>
): CustomMetric {
  return new CustomMetric({
    name,
    collector: async () => getter(),
    weight: 0.5,
    thresholdUp: 80,
    thresholdDown: 20,
    unit: "",
    ...config,
  });
}

/**
 * Helper function to create a counter-based custom metric
 */
export function createCounterMetric(
  name: string,
  counter: { get: () => number; reset?: () => void },
  windowMs: number = 60000,
  config: Partial<Omit<CustomMetricConfig, "name" | "collector">> = {}
): CustomMetric {
  const history: Array<{ timestamp: number; value: number }> = [];

  return new CustomMetric({
    name,
    collector: () => {
      const now = Date.now();
      const currentValue = counter.get();

      // Calculate rate over window
      const cutoff = now - windowMs;
      const relevant = history.filter(h => h.timestamp >= cutoff);

      let rate: number;
      if (relevant.length > 0) {
        const firstValue = relevant[0].value;
        const timeDiff = now - relevant[0].timestamp;
        rate = ((currentValue - firstValue) / timeDiff) * 1000; // per second
      } else {
        rate = 0;
      }

      history.push({ timestamp: now, value: currentValue });

      // Trim history
      const maxHistory = Math.floor(windowMs / 1000) * 2;
      if (history.length > maxHistory) {
        history.shift();
      }

      return rate;
    },
    weight: 0.5,
    thresholdUp: 100,
    thresholdDown: 10,
    unit: "per second",
    ...config,
  });
}
