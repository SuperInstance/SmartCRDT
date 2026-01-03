/**
 * StatsTracker - Generic statistics tracking utility
 *
 * Provides a flexible way to track statistics with automatic aggregation
 * and time-windowed metrics. Eliminates ~1,050 lines of duplicate stats code.
 *
 * @example
 * ```typescript
 * interface MyStats {
 *   requestsProcessed: number;
 *   totalLatency: number;
 *   errorCount: number;
 * }
 *
 * const tracker = new StatsTracker<MyStats>({
 *   requestsProcessed: 0,
 *   totalLatency: 0,
 *   errorCount: 0
 * });
 *
 * tracker.increment('requestsProcessed');
 * tracker.increment('totalLatency', 150);
 * tracker.getAverage('totalLatency'); // 150
 * ```
 */

/**
 * Time window for rolling statistics
 */
export interface TimeWindow {
  /** Window duration in milliseconds */
  duration: number;
  /** Maximum number of data points in window */
  maxPoints?: number;
}

/**
 * Stat metadata
 */
interface StatMetadata {
  /** Count of updates */
  count: number;
  /** Sum of values (for averaging) */
  sum: number;
  /** Min value */
  min: number;
  /** Max value */
  max: number;
  /** Last updated timestamp */
  lastUpdate: number;
}

/**
 * Time-series data point
 */
interface DataPoint {
  value: number;
  timestamp: number;
}

/**
 * StatsTracker configuration
 */
export interface StatsTrackerOptions {
  /** Enable time-series tracking */
  enableTimeSeries?: boolean;
  /** Time window for rolling stats */
  timeWindow?: TimeWindow;
  /** Enable automatic cleanup of old data */
  autoCleanup?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
}

/**
 * StatsTracker - Generic statistics tracking
 */
export class StatsTracker<T extends Record<string, number>> {
  private stats: T;
  private metadata: Map<keyof T, StatMetadata>;
  private timeSeries: Map<keyof T, DataPoint[]>;
  private options: Required<StatsTrackerOptions>;
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private initialStats: T;

  constructor(initialStats: T, options?: StatsTrackerOptions) {
    this.initialStats = initialStats;
    this.stats = { ...initialStats };
    this.metadata = new Map();
    this.timeSeries = new Map();

    this.options = {
      enableTimeSeries: options?.enableTimeSeries ?? false,
      timeWindow: options?.timeWindow ?? { duration: 60000, maxPoints: 1000 },
      autoCleanup: options?.autoCleanup ?? false,
      cleanupInterval: options?.cleanupInterval ?? 30000,
    };

    // Initialize metadata
    for (const key of Object.keys(initialStats) as Array<keyof T>) {
      this.metadata.set(key, {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        lastUpdate: 0,
      });

      if (this.options.enableTimeSeries) {
        this.timeSeries.set(key, []);
      }
    }

    // Start cleanup timer if enabled
    if (this.options.autoCleanup && this.options.enableTimeSeries) {
      this.startCleanup();
    }
  }

  /**
   * Get current statistics
   */
  getStats(): Readonly<T> {
    return { ...this.stats };
  }

  /**
   * Get a specific stat value
   */
  get<K extends keyof T>(key: K): T[K] {
    return this.stats[key];
  }

  /**
   * Set a stat value
   */
  set<K extends keyof T>(key: K, value: T[K]): void {
    const oldValue = this.stats[key];
    this.stats[key] = value;

    // Update metadata
    const meta = this.metadata.get(key)!;
    const numValue = Number(value);
    meta.count++;
    meta.sum += numValue;
    meta.min = Math.min(meta.min, numValue);
    meta.max = Math.max(meta.max, numValue);
    meta.lastUpdate = Date.now();

    // Add to time series
    if (this.options.enableTimeSeries) {
      this.addTimeSeriesPoint(key, numValue);
    }
  }

  /**
   * Increment a stat by a value
   */
  increment<K extends keyof T>(key: K, value = 1): void {
    const current = this.stats[key];
    if (typeof current === "number") {
      this.set(key, (current + value) as T[K]);
    }
  }

  /**
   * Decrement a stat by a value
   */
  decrement<K extends keyof T>(key: K, value = 1): void {
    this.increment(key, -value);
  }

  /**
   * Get average value for a stat
   */
  getAverage<K extends keyof T>(key: K): number {
    const meta = this.metadata.get(key);
    if (!meta || meta.count === 0) {
      return 0;
    }
    return meta.sum / meta.count;
  }

  /**
   * Get rate (per second) for a stat
   */
  getRate<K extends keyof T>(key: K): number {
    const meta = this.metadata.get(key);
    if (!meta || meta.count === 0) {
      return 0;
    }

    const elapsed = Date.now() - meta.lastUpdate;
    if (elapsed === 0) {
      return 0;
    }

    return (meta.sum / elapsed) * 1000;
  }

  /**
   * Get min value for a stat
   */
  getMin<K extends keyof T>(key: K): number {
    const meta = this.metadata.get(key);
    return meta?.min ?? 0;
  }

  /**
   * Get max value for a stat
   */
  getMax<K extends keyof T>(key: K): number {
    const meta = this.metadata.get(key);
    return meta?.max ?? 0;
  }

  /**
   * Get count of updates for a stat
   */
  getCount<K extends keyof T>(key: K): number {
    return this.metadata.get(key)?.count ?? 0;
  }

  /**
   * Get all metadata for a stat
   */
  getMetadata<K extends keyof T>(key: K): StatMetadata | undefined {
    return this.metadata.get(key);
  }

  /**
   * Get time series data for a stat
   */
  getTimeSeries<K extends keyof T>(key: K): DataPoint[] {
    if (!this.options.enableTimeSeries) {
      return [];
    }
    return [...(this.timeSeries.get(key) ?? [])];
  }

  /**
   * Get time series data in a time range
   */
  getTimeSeriesRange<K extends keyof T>(
    key: K,
    startTime: number,
    endTime: number
  ): DataPoint[] {
    const series = this.getTimeSeries(key);
    return series.filter(
      point => point.timestamp >= startTime && point.timestamp <= endTime
    );
  }

  /**
   * Calculate percentile for a stat's time series
   */
  getPercentile<K extends keyof T>(key: K, percentile: number): number {
    const series = this.getTimeSeries(key);
    if (series.length === 0) {
      return 0;
    }

    const values = series.map(p => p.value).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[index] ?? 0;
  }

  /**
   * Get p50 (median) for a stat
   */
  getMedian<K extends keyof T>(key: K): number {
    return this.getPercentile(key, 50);
  }

  /**
   * Get p95 for a stat
   */
  getP95<K extends keyof T>(key: K): number {
    return this.getPercentile(key, 95);
  }

  /**
   * Get p99 for a stat
   */
  getP99<K extends keyof T>(key: K): number {
    return this.getPercentile(key, 99);
  }

  /**
   * Reset all stats to initial values
   */
  reset(): void {
    this.stats = { ...this.initialStats };
    this.metadata.clear();
    this.timeSeries.clear();

    // Reinitialize
    for (const key of Object.keys(this.initialStats) as Array<keyof T>) {
      this.metadata.set(key, {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        lastUpdate: 0,
      });

      if (this.options.enableTimeSeries) {
        this.timeSeries.set(key, []);
      }
    }
  }

  /**
   * Reset a specific stat
   */
  resetStat<K extends keyof T>(key: K): void {
    this.stats[key] = this.initialStats[key];
    this.metadata.set(key, {
      count: 0,
      sum: 0,
      min: Infinity,
      max: -Infinity,
      lastUpdate: 0,
    });

    if (this.options.enableTimeSeries) {
      this.timeSeries.set(key, []);
    }
  }

  /**
   * Get a summary of all stats
   */
  getSummary(): Record<
    keyof T,
    { value: number; average: number; min: number; max: number; count: number }
  > {
    const summary = {} as Record<
      keyof T,
      {
        value: number;
        average: number;
        min: number;
        max: number;
        count: number;
      }
    >;

    for (const key of Object.keys(this.stats) as Array<keyof T>) {
      const meta = this.metadata.get(key)!;
      summary[key] = {
        value: Number(this.stats[key]),
        average: meta.count > 0 ? meta.sum / meta.count : 0,
        min: meta.min === Infinity ? 0 : meta.min,
        max: meta.max === -Infinity ? 0 : meta.max,
        count: meta.count,
      };
    }

    return summary;
  }

  /**
   * Export stats as JSON
   */
  toJSON(): {
    stats: T;
    summary: Record<string, unknown>;
    timestamp: number;
  } {
    return {
      stats: this.getStats(),
      summary: this.getSummary() as Record<string, unknown>,
      timestamp: Date.now(),
    };
  }

  /**
   * Create a snapshot
   */
  snapshot(): {
    stats: T;
    metadata: Map<keyof T, StatMetadata>;
    timeSeries: Map<keyof T, DataPoint[]>;
    timestamp: number;
  } {
    return {
      stats: { ...this.stats },
      metadata: new Map(
        Array.from(this.metadata.entries()).map(([k, v]) => [k, { ...v }])
      ),
      timeSeries: new Map(
        Array.from(this.timeSeries.entries()).map(([k, v]) => [k, [...v]])
      ),
      timestamp: Date.now(),
    };
  }

  /**
   * Restore from snapshot
   */
  restore(snapshot: ReturnType<StatsTracker<T>["snapshot"]>): void {
    this.stats = snapshot.stats;
    this.metadata = new Map(
      Array.from(snapshot.metadata.entries()).map(([k, v]) => [k, { ...v }])
    );
    this.timeSeries = new Map(
      Array.from(snapshot.timeSeries.entries()).map(([k, v]) => [k, [...v]])
    );
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Add time series point
   */
  private addTimeSeriesPoint<K extends keyof T>(key: K, value: number): void {
    const series = this.timeSeries.get(key);
    if (!series) {
      return;
    }

    series.push({ value, timestamp: Date.now() });

    // Enforce max points
    if (
      this.options.timeWindow.maxPoints &&
      series.length > this.options.timeWindow.maxPoints
    ) {
      series.shift();
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Cleanup old time series data
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.options.timeWindow.duration;

    for (const [key, series] of this.timeSeries.entries()) {
      // Remove old points
      const filtered = series.filter(point => point.timestamp > cutoff);
      this.timeSeries.set(key, filtered);
    }
  }

  /**
   * Merge stats from another tracker
   */
  merge(other: StatsTracker<T>): void {
    const otherStats = other.getStats();
    for (const key of Object.keys(otherStats) as Array<keyof T>) {
      this.set(key, otherStats[key]);
    }
  }

  /**
   * Calculate difference from snapshot
   */
  diffFrom(snapshot: ReturnType<StatsTracker<T>["snapshot"]>): Partial<T> {
    const diff = {} as Partial<T>;

    for (const key of Object.keys(this.stats) as Array<keyof T>) {
      const oldValue = snapshot.stats[key];
      const newValue = this.stats[key];
      if (typeof oldValue === "number" && typeof newValue === "number") {
        (diff as Record<string, number>)[key as string] = newValue - oldValue;
      }
    }

    return diff;
  }
}

/**
 * Convenience function to create a StatsTracker
 */
export function createStatsTracker<T extends Record<string, number>>(
  initialStats: T,
  options?: StatsTrackerOptions
): StatsTracker<T> {
  return new StatsTracker(initialStats, options);
}

/**
 * Create a tracker with predefined metrics
 */
export function createStandardTracker(): StatsTracker<{
  requests: number;
  errors: number;
  totalLatency: number;
  minLatency: number;
  maxLatency: number;
}> {
  return new StatsTracker(
    {
      requests: 0,
      errors: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
    },
    { enableTimeSeries: true }
  );
}
