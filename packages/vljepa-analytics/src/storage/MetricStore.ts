/**
 * MetricStore - Stores and retrieves metrics
 */

import type { Metric, QueryOptions, DateRange } from "../types.js";

export class MetricStore {
  private metrics: Map<string, Metric[]> = new Map();
  private metricIndex: Map<string, Set<string>> = new Map(); // label -> metric names

  /**
   * Store a metric
   */
  store(metric: Metric): void {
    const key = this.getMetricKey(metric.name, metric.labels);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push(metric);

    // Index by labels
    for (const [labelKey, labelValue] of Object.entries(metric.labels)) {
      const indexKey = `${labelKey}:${labelValue}`;
      if (!this.metricIndex.has(indexKey)) {
        this.metricIndex.set(indexKey, new Set());
      }
      this.metricIndex.get(indexKey)!.add(metric.name);
    }
  }

  /**
   * Store multiple metrics
   */
  storeBatch(metrics: Metric[]): void {
    for (const metric of metrics) {
      this.store(metric);
    }
  }

  /**
   * Query metrics
   */
  query(name: string, options: QueryOptions = {}): Metric[] {
    const keys = Array.from(this.metrics.keys()).filter(k =>
      k.startsWith(name)
    );
    let results: Metric[] = [];

    for (const key of keys) {
      results.push(...this.metrics.get(key)!);
    }

    // Apply date range
    if (options.dateRange) {
      const { start, end } = options.dateRange;
      results = results.filter(
        m => m.timestamp >= start.getTime() && m.timestamp <= end.getTime()
      );
    }

    // Sort by timestamp
    results.sort((a, b) => a.timestamp - b.timestamp);

    // Apply pagination
    if (options.pagination) {
      const { page, pageSize } = options.pagination;
      const startIdx = (page - 1) * pageSize;
      const endIdx = startIdx + pageSize;
      results = results.slice(startIdx, endIdx);
    }

    return results;
  }

  /**
   * Get latest value for a metric
   */
  getLatest(
    name: string,
    labels: Record<string, string> = {}
  ): Metric | undefined {
    const key = this.getMetricKey(name, labels);
    const metrics = this.metrics.get(key);
    if (!metrics || metrics.length === 0) return undefined;

    return metrics[metrics.length - 1];
  }

  /**
   * Get metrics in date range
   */
  getByDateRange(
    name: string,
    range: DateRange,
    labels: Record<string, string> = {}
  ): Metric[] {
    const key = this.getMetricKey(name, labels);
    const metrics = this.metrics.get(key);
    if (!metrics) return [];

    const { start, end } = range;
    return metrics.filter(
      m => m.timestamp >= start.getTime() && m.timestamp <= end.getTime()
    );
  }

  /**
   * Aggregate metrics
   */
  aggregate(
    name: string,
    aggregation: "sum" | "avg" | "min" | "max" | "count",
    labels: Record<string, string> = {},
    dateRange?: DateRange
  ): number {
    let metrics = this.getByDateRange(
      name,
      dateRange || { start: new Date(0), end: new Date() },
      labels
    );

    if (metrics.length === 0) return 0;

    const values = metrics.map(m => m.value);

    switch (aggregation) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
      case "count":
        return values.length;
      default:
        return 0;
    }
  }

  /**
   * Get metric names
   */
  getMetricNames(): string[] {
    return Array.from(
      new Set(Array.from(this.metrics.keys()).map(k => k.split("|")[0]))
    );
  }

  /**
   * Get metric key
   */
  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(",");
    return `${name}|${labelStr}`;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.metricIndex.clear();
  }
}
