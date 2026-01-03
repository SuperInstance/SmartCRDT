/**
 * MetricCollector - Collects and aggregates numerical metrics
 */

import { EventEmitter } from "eventemitter3";
import type {
  Metric,
  MetricCollectorConfig,
  AggregatedMetric,
} from "../types.js";

export class MetricCollector extends EventEmitter {
  private config: MetricCollectorConfig;
  private metrics: Map<string, Metric[]> = new Map();
  private aggregated: Map<string, AggregatedMetric[]> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<MetricCollectorConfig> = {}) {
    super();

    this.config = {
      flushInterval: config.flushInterval ?? 60000,
      aggregationWindow: config.aggregationWindow ?? 60000,
      percentiles: config.percentiles ?? [50, 75, 90, 95, 99],
    };

    this.startFlushTimer();
  }

  /**
   * Record a metric
   */
  record(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const metric: Metric = {
      name,
      value,
      timestamp: Date.now(),
      labels,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(metric);
    this.emit("metric", metric);
  }

  /**
   * Increment a counter
   */
  increment(
    name: string,
    value: number = 1,
    labels: Record<string, string> = {}
  ): void {
    this.record(name, value, labels);
  }

  /**
   * Record a timing
   */
  timing(
    name: string,
    duration: number,
    labels: Record<string, string> = {}
  ): void {
    this.record(name, duration, { ...labels, type: "timing" });
  }

  /**
   * Record a gauge (set value)
   */
  gauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    this.record(name, value, { ...labels, type: "gauge" });
  }

  /**
   * Get metrics for a name
   */
  getMetrics(name: string): Metric[] {
    return this.metrics.get(name) ?? [];
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, Metric[]> {
    return this.metrics;
  }

  /**
   * Calculate statistics for a metric
   */
  getStats(name: string): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    percentiles: Record<number, number>;
  } | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = values[0];
    const max = values[count - 1];

    const percentiles: Record<number, number> = {};
    for (const p of this.config.percentiles) {
      const index = Math.ceil((p / 100) * count) - 1;
      percentiles[p] = values[index];
    }

    return { count, sum, avg, min, max, percentiles };
  }

  /**
   * Aggregate metrics
   */
  aggregate(name: string): AggregatedMetric[] {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return [];
    }

    // Group by time window
    const window = this.config.aggregationWindow;
    const groups = new Map<number, number[]>();

    for (const metric of metrics) {
      const time = Math.floor(metric.timestamp / window) * window;
      if (!groups.has(time)) {
        groups.set(time, []);
      }
      groups.get(time)!.push(metric.value);
    }

    const aggregated: AggregatedMetric[] = [];
    for (const [time, values] of groups) {
      const sum = values.reduce((a, b) => a + b, 0);
      aggregated.push({
        timestamp: time,
        value: sum / values.length,
        metadata: { count: values.length },
      });
    }

    return aggregated.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear metrics for a name
   */
  clear(name: string): void {
    this.metrics.delete(name);
  }

  /**
   * Clear all metrics
   */
  clearAll(): void {
    this.metrics.clear();
  }

  /**
   * Flush metrics
   */
  async flush(): Promise<void> {
    const allMetrics = Array.from(this.metrics.entries()).map(
      ([name, metrics]) => ({
        name,
        metrics,
      })
    );

    this.emit("flush", allMetrics);
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer
   */
  stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    this.stopAutoFlush();
    await this.flush();
    this.removeAllListeners();
  }
}
