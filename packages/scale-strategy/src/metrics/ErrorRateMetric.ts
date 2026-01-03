/**
 * @lsi/scale-strategy - Error Rate Metric
 *
 * Tracks request error rate for scaling decisions.
 */

import type {
  ScaleMetric,
  MetricCollectorConfig,
  WorkerPoolState,
} from "../types.js";
import { MetricType } from "../types.js";

/**
 * Error record
 */
export interface ErrorRecord {
  timestamp: number;
  error: string;
  workerId?: number;
}

/**
 * Default configuration for error rate metric
 */
const DEFAULT_CONFIG: MetricCollectorConfig = {
  intervalMs: 10000,
  retentionMs: 3600000, // 1 hour
  enableSmoothing: true,
  smoothingWindow: 3,
};

/**
 * Error rate metric collector
 */
export class ErrorRateMetric {
  private config: MetricCollectorConfig;
  private history: Array<{ timestamp: number; value: number }> = [];
  private errors: ErrorRecord[] = [];
  private requestCounts: Array<{ timestamp: number; count: number }> = [];
  private windowMs: number = 60000; // 1 minute window for rate calculation

  constructor(config: Partial<MetricCollectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Collect current error rate
   */
  async collect(workerState: WorkerPoolState): Promise<ScaleMetric> {
    // Calculate error rate as percentage
    const value = this.calculateErrorRate();

    const timestamp = Date.now();
    this.history.push({ timestamp, value });
    this.trimHistory();

    const smoothedValue = this.config.enableSmoothing
      ? this.smoothValue(value)
      : value;

    return {
      name: "error_rate",
      type: MetricType.ERROR_RATE,
      value: smoothedValue,
      weight: 0.75,
      threshold: {
        up: 5, // Scale up when error rate > 5%
        down: 1, // Scale down when error rate < 1%
      },
      unit: "percent",
      timestamp,
    };
  }

  /**
   * Record an error
   */
  recordError(error: string, workerId?: number): void {
    this.errors.push({
      timestamp: Date.now(),
      error,
      workerId,
    });

    // Trim old errors (keep last hour)
    const cutoff = Date.now() - 3600000;
    this.errors = this.errors.filter(e => e.timestamp >= cutoff);
  }

  /**
   * Record a request count
   */
  recordRequests(count: number): void {
    this.requestCounts.push({
      timestamp: Date.now(),
      count,
    });

    // Trim old request counts
    const cutoff = Date.now() - this.config.retentionMs;
    this.requestCounts = this.requestCounts.filter(r => r.timestamp >= cutoff);
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
   * Get error rate over time window
   */
  getErrorRate(windowMs?: number): number {
    this.windowMs = windowMs || this.windowMs;
    return this.calculateErrorRate();
  }

  /**
   * Get error count over time window
   */
  getErrorCount(windowMs: number = 60000): number {
    const cutoff = Date.now() - windowMs;
    return this.errors.filter(e => e.timestamp >= cutoff).length;
  }

  /**
   * Get total request count over time window
   */
  getTotalRequests(windowMs: number = 60000): number {
    const cutoff = Date.now() - windowMs;
    return this.requestCounts
      .filter(r => r.timestamp >= cutoff)
      .reduce((sum, r) => sum + r.count, 0);
  }

  /**
   * Get errors by type
   */
  getErrorsByType(): Map<string, number> {
    const errorTypes = new Map<string, number>();

    for (const error of this.errors) {
      const count = errorTypes.get(error.error) || 0;
      errorTypes.set(error.error, count + 1);
    }

    return errorTypes;
  }

  /**
   * Get errors by worker
   */
  getErrorsByWorker(): Map<number, number> {
    const workerErrors = new Map<number, number>();

    for (const error of this.errors) {
      if (error.workerId !== undefined) {
        const count = workerErrors.get(error.workerId) || 0;
        workerErrors.set(error.workerId, count + 1);
      }
    }

    return workerErrors;
  }

  /**
   * Get history
   */
  getHistory(): Array<{ timestamp: number; value: number }> {
    return [...this.history];
  }

  /**
   * Get errors
   */
  getErrors(): ErrorRecord[] {
    return [...this.errors];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
    this.errors = [];
    this.requestCounts = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MetricCollectorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private calculateErrorRate(): number {
    const cutoff = Date.now() - this.windowMs;
    const recentErrors = this.errors.filter(e => e.timestamp >= cutoff);
    const recentRequests = this.requestCounts
      .filter(r => r.timestamp >= cutoff)
      .reduce((sum, r) => sum + r.count, 0);

    if (recentRequests === 0) {
      return 0;
    }

    return (recentErrors.length / recentRequests) * 100;
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
