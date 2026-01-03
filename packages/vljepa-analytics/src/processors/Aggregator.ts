/**
 * Aggregator - Aggregates metrics across dimensions
 */

import type { AggregationConfig, AggregatedMetric, Filter } from "../types.js";

export class Aggregator {
  /**
   * Aggregate data
   */
  aggregate(
    data: Array<{
      timestamp: number;
      value: number;
      dimensions?: Record<string, string>;
    }>,
    config: AggregationConfig
  ): AggregatedMetric[] {
    let filtered = data;

    // Apply filters
    if (config.filters) {
      filtered = this.applyFilters(data, config.filters);
    }

    // Group by dimensions
    const groups = this.groupBy(filtered, config.groupBy || []);

    // Apply aggregation
    const results: AggregatedMetric[] = [];

    for (const [key, groupData] of groups) {
      const value = this.applyAggregation(groupData, config.type, config.field);
      const timestamp = this.calculateTimestamp(groupData, config.window);

      results.push({
        timestamp,
        value,
        metadata: {
          group: key,
          count: groupData.length,
        },
      });
    }

    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Apply aggregation type
   */
  private applyAggregation(
    data: Array<{ value: number }>,
    type: string,
    field?: string
  ): number {
    const values = field
      ? data.map(d => (d as Record<string, unknown>)[field] as number)
      : data.map(d => d.value);

    switch (type) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
      case "min":
        return values.length > 0 ? Math.min(...values) : 0;
      case "max":
        return values.length > 0 ? Math.max(...values) : 0;
      case "count":
        return values.length;
      case "unique":
        return new Set(values).size;
      default:
        return 0;
    }
  }

  /**
   * Group data by dimensions
   */
  private groupBy(
    data: Array<{ dimensions?: Record<string, string> }>,
    dimensions: string[]
  ): Map<string, Array<{ timestamp: number; value: number }>> {
    const groups = new Map();

    if (dimensions.length === 0) {
      groups.set("all", data);
      return groups;
    }

    for (const item of data) {
      const key = dimensions
        .map(d => item.dimensions?.[d] || "unknown")
        .join("|");

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(item);
    }

    return groups;
  }

  /**
   * Apply filters
   */
  private applyFilters(data: unknown[], filters: Filter[]): unknown[] {
    return data.filter(item => {
      return filters.every(filter => {
        const value = (item as Record<string, unknown>)[filter.field];

        switch (filter.operator) {
          case "equals":
            return value === filter.value;
          case "contains":
            return (
              typeof value === "string" && value.includes(String(filter.value))
            );
          case "gt":
            return (
              typeof value === "number" && value > (filter.value as number)
            );
          case "lt":
            return (
              typeof value === "number" && value < (filter.value as number)
            );
          case "in":
            return Array.isArray(filter.value) && filter.value.includes(value);
          default:
            return true;
        }
      });
    });
  }

  /**
   * Calculate timestamp for aggregated data
   */
  private calculateTimestamp(
    data: Array<{ timestamp: number }>,
    window?: number
  ): number {
    if (!window || data.length === 0) {
      return data[0]?.timestamp || Date.now();
    }

    const timestamps = data.map(d => d.timestamp);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);

    return min + Math.floor((max - min) / 2);
  }

  /**
   * Calculate percentiles
   */
  calculatePercentiles(
    data: number[],
    percentiles: number[]
  ): Record<number, number> {
    const sorted = [...data].sort((a, b) => a - b);
    const result: Record<number, number> = {};

    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[p] = sorted[Math.max(0, index)];
    }

    return result;
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(data: number[], window: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const subset = data.slice(start, i + 1);
      result.push(subset.reduce((a, b) => a + b, 0) / subset.length);
    }

    return result;
  }
}
