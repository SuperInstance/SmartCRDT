/**
 * MetricsCollector - Comprehensive cache performance metrics collection
 *
 * Collects, aggregates, and analyzes cache performance metrics for real-time
 * monitoring and historical analysis.
 *
 * Features:
 * - Real-time metrics collection
 * - Time-windowed aggregation
 * - Historical data tracking
 * - Latency distribution calculation
 * - Memory usage monitoring
 * - Query pattern analysis
 * - Thread-safe operations
 */

import type {
  CacheMetricsSnapshot,
  HitRateMetrics,
  LatencyMetrics,
  MemoryMetrics,
  EntryMetrics,
  SimilarityMetrics,
  QueryPatternMetrics,
  HistoricalDataPoint,
  TimeSeriesData,
  TimeWindow,
  CacheAnalyticsConfig,
} from "@lsi/protocol";

/**
 * Query record for pattern analysis
 */
interface QueryRecord {
  query: string;
  timestamp: number;
  hit: boolean;
  latency: number;
  similarity?: number;
}

/**
 * Latency sample for distribution calculation
 */
interface LatencySample {
  latency: number;
  timestamp: number;
}

/**
 * Memory measurement
 */
interface MemoryMeasurement {
  usage: number;
  timestamp: number;
}

/**
 * MetricsCollector - Real-time cache metrics collection
 */
export class MetricsCollector {
  private cacheId: string;
  private config: CacheAnalyticsConfig;

  // Counter metrics
  private hits: number = 0;
  private missCount: number = 0;
  private evictions: number = 0;

  // Historical data
  private history: HistoricalDataPoint[] = [];
  private queryHistory: QueryRecord[] = [];
  private latencyHistory: LatencySample[] = [];
  private memoryHistory: MemoryMeasurement[] = [];

  // Current state
  private currentSize: number = 0;
  private maxSize: number = 0;
  private currentThreshold: number = 0;
  private peakMemoryUsage: number = 0;

  // Query pattern tracking
  private queryFrequency: Map<string, { count: number; lastSeen: number }> =
    new Map();
  private entryHitCount: Map<string, number> = new Map();
  private entryLastAccess: Map<string, number> = new Map();

  // Similarity scores
  private similarityScores: number[] = [];

  // Time window aggregations
  private timeWindowMetrics: Map<TimeWindow, HistoricalDataPoint[]> = new Map();

  constructor(cacheId: string, config: CacheAnalyticsConfig) {
    this.cacheId = cacheId;
    this.config = config;
    this.initializeTimeWindows();
  }

  /**
   * Record a cache hit
   */
  recordHit(query: string, latency: number, similarity?: number): void {
    this.hits++;
    this.recordQuery(query, true, latency, similarity);

    if (similarity !== undefined) {
      this.similarityScores.push(similarity);
    }
  }

  /**
   * Record a cache miss
   */
  recordMiss(query: string, latency: number): void {
    this.missCount++;
    this.recordQuery(query, false, latency);
  }

  /**
   * Record an eviction
   */
  recordEviction(): void {
    this.evictions++;
  }

  /**
   * Update cache size
   */
  updateSize(current: number, max: number): void {
    this.currentSize = current;
    this.maxSize = max;
  }

  /**
   * Update similarity threshold
   */
  updateThreshold(threshold: number): void {
    this.currentThreshold = threshold;
  }

  /**
   * Record entry access for per-entry statistics
   */
  recordEntryAccess(key: string): void {
    const currentCount = this.entryHitCount.get(key) || 0;
    this.entryHitCount.set(key, currentCount + 1);
    this.entryLastAccess.set(key, Date.now());
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(usage: number): void {
    this.memoryHistory.push({
      usage,
      timestamp: Date.now(),
    });

    if (usage > this.peakMemoryUsage) {
      this.peakMemoryUsage = usage;
    }

    // Trim memory history
    this.trimHistory(this.memoryHistory, this.config.maxHistoryPoints);
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): CacheMetricsSnapshot {
    return {
      timestamp: Date.now(),
      cacheId: this.cacheId,
      hitRate: this.calculateHitRateMetrics(),
      latency: this.calculateLatencyMetrics(),
      memory: this.calculateMemoryMetrics(),
      entries: this.calculateEntryMetrics(),
      similarity: this.calculateSimilarityMetrics(),
      patterns: this.calculateQueryPatternMetrics(),
      size: this.currentSize,
      maxSize: this.maxSize,
      threshold: this.currentThreshold,
    };
  }

  /**
   * Get historical time series data
   */
  getTimeSeries(window: TimeWindow): TimeSeriesData {
    const points = this.timeWindowMetrics.get(window) || [];
    return {
      points: points.slice(),
      window,
      count: points.length,
    };
  }

  /**
   * Get all historical data
   */
  getAllHistory(): TimeSeriesData {
    return {
      points: this.history.slice(),
      window: "24h",
      count: this.history.length,
    };
  }

  /**
   * Collect metrics and create historical data point
   */
  collectMetrics(): HistoricalDataPoint {
    const snapshot = this.getSnapshot();
    const point: HistoricalDataPoint = {
      timestamp: snapshot.timestamp,
      hitRate: snapshot.hitRate.overall,
      size: snapshot.size,
      memoryUsage: snapshot.memory.currentUsage,
      latency: snapshot.latency.p95,
    };

    this.history.push(point);

    // Add to time windows
    for (const window of this.getTimeWindowsForPoint(point)) {
      const windowPoints = this.timeWindowMetrics.get(window);
      if (windowPoints) {
        windowPoints.push(point);
        // Trim to max points
        if (windowPoints.length > this.getMaxPointsForWindow(window)) {
          windowPoints.shift();
        }
      }
    }

    // Trim main history
    this.trimHistory(this.history, this.config.maxHistoryPoints);

    return point;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.hits = 0;
    this.missCount = 0;
    this.evictions = 0;
    this.history = [];
    this.queryHistory = [];
    this.latencyHistory = [];
    this.memoryHistory = [];
    this.peakMemoryUsage = 0;
    this.queryFrequency.clear();
    this.entryHitCount.clear();
    this.entryLastAccess.clear();
    this.similarityScores = [];
    this.initializeTimeWindows();
  }

  /**
   * Calculate hit rate metrics
   */
  private calculateHitRateMetrics(): HitRateMetrics {
    const total = this.hits + this.missCount;
    const overall = total > 0 ? this.hits / total : 0;

    // Calculate rolling hit rate (last 1000 queries)
    const recentQueries = this.queryHistory.slice(-1000);
    const recentHits = recentQueries.filter((q) => q.hit).length;
    const rollingHitRate =
      recentQueries.length > 0 ? recentHits / recentQueries.length : 0;

    // Calculate per-time-window hit rates
    const byTimeWindow: Partial<Record<TimeWindow, number>> = {};
    for (const window of ["1m", "5m", "15m", "1h"] as TimeWindow[]) {
      const windowPoints = this.timeWindowMetrics.get(window) || [];
      if (windowPoints.length > 0) {
        const latest = windowPoints[windowPoints.length - 1];
        byTimeWindow[window] = latest.hitRate;
      }
    }

    // Determine trend
    const trend = this.calculateHitRateTrend();

    return {
      overall,
      byTimeWindow,
      rollingHitRate,
      trend: trend.direction,
      trendStrength: trend.strength,
    };
  }

  /**
   * Calculate latency metrics
   */
  private calculateLatencyMetrics(): LatencyMetrics {
    const latencies = this.latencyHistory
      .slice(-1000)
      .map((s) => s.latency);

    if (latencies.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        average: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        histogram: [],
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const len = sorted.length;

    const p50 = sorted[Math.floor(len * 0.5)];
    const p95 = sorted[Math.floor(len * 0.95)];
    const p99 = sorted[Math.floor(len * 0.99)];
    const min = sorted[0];
    const max = sorted[len - 1];

    const average = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance =
      latencies.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) /
      latencies.length;
    const stdDev = Math.sqrt(variance);

    // Create histogram
    const histogram = this.createLatencyHistogram(sorted);

    return {
      p50,
      p95,
      p99,
      average,
      min,
      max,
      stdDev,
      histogram,
    };
  }

  /**
   * Calculate memory metrics
   */
  private calculateMemoryMetrics(): MemoryMetrics {
    const currentUsage =
      this.memoryHistory.length > 0
        ? this.memoryHistory[this.memoryHistory.length - 1].usage
        : 0;

    const limit = 0; // No limit by default
    const usagePercent = limit > 0 ? currentUsage / limit : 0;

    // Determine trend
    const trend = this.calculateMemoryTrend();

    // Calculate bytes per entry
    const bytesPerEntry =
      this.currentSize > 0 ? currentUsage / this.currentSize : 0;

    return {
      currentUsage,
      peakUsage: this.peakMemoryUsage,
      limit,
      usagePercent,
      trend,
      bytesPerEntry,
    };
  }

  /**
   * Calculate entry metrics
   */
  private calculateEntryMetrics(): EntryMetrics {
    const now = Date.now();
    const totalEntries = this.currentSize;
    const activeEntries = totalEntries; // Approximation
    const expiredEntries = 0; // Would need actual tracking

    // Calculate eviction rate
    const recentEvictions = this.evictions;
    const timeSpan = Math.max(1, this.getElapsedSeconds() || 1);
    const evictionRate = recentEvictions / timeSpan;

    // Calculate entry ages (would need actual timestamps)
    const avgEntryAge = 0;
    const oldestEntryAge = 0;

    return {
      totalEntries,
      activeEntries,
      expiredEntries,
      evictions: this.evictions,
      evictionRate,
      avgEntryAge,
      oldestEntryAge,
    };
  }

  /**
   * Calculate similarity metrics
   */
  private calculateSimilarityMetrics(): SimilarityMetrics {
    if (this.similarityScores.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        histogram: [],
      };
    }

    const sorted = [...this.similarityScores].sort((a, b) => a - b);
    const len = sorted.length;

    const sum = sorted.reduce((a, b) => a + b, 0);
    const average = sum / len;
    const median = sorted[Math.floor(len / 2)];
    const min = sorted[0];
    const max = sorted[len - 1];

    const variance =
      sorted.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / len;
    const stdDev = Math.sqrt(variance);

    // Create histogram
    const histogram = this.createSimilarityHistogram(sorted);

    return {
      average,
      median,
      min,
      max,
      stdDev,
      histogram,
    };
  }

  /**
   * Calculate query pattern metrics
   */
  private calculateQueryPatternMetrics(): QueryPatternMetrics {
    // Query frequency
    const queryFrequency = Array.from(this.queryFrequency.entries())
      .map(([query, data]) => ({
        query,
        count: data.count,
        lastSeen: data.lastSeen,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);

    // Hot entries (most accessed)
    const hotEntries = Array.from(this.entryHitCount.entries())
      .map(([key, hitCount]) => ({
        key,
        hitCount,
        hitRate: hitCount / Math.max(1, this.hits),
      }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 20);

    // Cold entries (rarely accessed)
    const coldEntries = Array.from(this.entryLastAccess.entries())
      .filter(([key]) => (this.entryHitCount.get(key) || 0) < 5)
      .map(([key, lastAccess]) => ({
        key,
        hitCount: this.entryHitCount.get(key) || 0,
        lastAccess,
      }))
      .sort((a, b) => a.lastAccess - b.lastAccess)
      .slice(0, 20);

    // Calculate repetition rate
    const uniqueQueries = this.queryFrequency.size;
    const totalQueries = this.hits + this.missCount;
    const repetitionRate =
      totalQueries > 0 ? 1 - uniqueQueries / totalQueries : 0;

    return {
      queryFrequency,
      hotEntries,
      coldEntries,
      repetitionRate,
    };
  }

  /**
   * Record a query for pattern analysis
   */
  private recordQuery(
    query: string,
    hit: boolean,
    latency: number,
    similarity?: number
  ): void {
    const record: QueryRecord = {
      query,
      timestamp: Date.now(),
      hit,
      latency,
      similarity,
    };

    this.queryHistory.push(record);
    this.latencyHistory.push({
      latency,
      timestamp: record.timestamp,
    });

    // Trim histories
    this.trimHistory(this.queryHistory, 10_000);
    this.trimHistory(this.latencyHistory, 10_000);

    // Update query frequency
    const current = this.queryFrequency.get(query) || { count: 0, lastSeen: 0 };
    this.queryFrequency.set(query, {
      count: current.count + 1,
      lastSeen: record.timestamp,
    });
  }

  /**
   * Initialize time windows
   */
  private initializeTimeWindows(): void {
    for (const window of [
      "1m",
      "5m",
      "15m",
      "1h",
      "6h",
      "24h",
      "7d",
    ] as TimeWindow[]) {
      this.timeWindowMetrics.set(window, []);
    }
  }

  /**
   * Get time windows for a data point
   */
  private getTimeWindowsForPoint(point: HistoricalDataPoint): TimeWindow[] {
    const windows: TimeWindow[] = [];
    const now = Date.now();

    // Calculate age of point
    const age = now - point.timestamp;

    // Window mappings (milliseconds)
    const windowDurations: Record<TimeWindow, number> = {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
    };

    for (const [window, duration] of Object.entries(windowDurations)) {
      if (age <= duration) {
        windows.push(window as TimeWindow);
      }
    }

    return windows;
  }

  /**
   * Get max points for a time window
   */
  private getMaxPointsForWindow(window: TimeWindow): number {
    const durations: Record<TimeWindow, number> = {
      "1m": 60,
      "5m": 300,
      "15m": 900,
      "1h": 3600,
      "6h": 21600,
      "24h": 86400,
      "7d": 604800,
    };
    // Collect every 1 second worth of data
    return Math.min(1000, durations[window] / this.config.metricsCollectionInterval * 1000);
  }

  /**
   * Trim history to max size
   */
  private trimHistory<T>(history: T[], maxSize: number): void {
    while (history.length > maxSize) {
      history.shift();
    }
  }

  /**
   * Calculate hit rate trend
   */
  private calculateHitRateTrend(): {
    direction: "improving" | "stable" | "declining";
    strength: number;
  } {
    if (this.history.length < 10) {
      return { direction: "stable", strength: 0 };
    }

    const recent = this.history.slice(-20);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, p) => sum + p.hitRate, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, p) => sum + p.hitRate, 0) / secondHalf.length;

    const delta = secondAvg - firstAvg;
    const strength = Math.min(1, Math.abs(delta) * 10);

    if (delta > 0.02) {
      return { direction: "improving", strength };
    } else if (delta < -0.02) {
      return { direction: "declining", strength };
    } else {
      return { direction: "stable", strength };
    }
  }

  /**
   * Calculate memory trend
   */
  private calculateMemoryTrend(): "growing" | "stable" | "shrinking" {
    if (this.memoryHistory.length < 10) {
      return "stable";
    }

    const recent = this.memoryHistory.slice(-20);
    const firstAvg =
      recent.slice(0, Math.floor(recent.length / 2)).reduce((sum, m) => sum + m.usage, 0) /
      Math.floor(recent.length / 2);
    const secondAvg =
      recent
        .slice(Math.floor(recent.length / 2))
        .reduce((sum, m) => sum + m.usage, 0) /
      Math.ceil(recent.length / 2);

    const delta = (secondAvg - firstAvg) / firstAvg;

    if (delta > 0.05) {
      return "growing";
    } else if (delta < -0.05) {
      return "shrinking";
    } else {
      return "stable";
    }
  }

  /**
   * Create latency histogram
   */
  private createLatencyHistogram(sorted: number[]): {
    bucket: number;
    count: number;
  }[] {
    const buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    const histogram: { bucket: number; count: number }[] = [];

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const nextBucket = buckets[i + 1] || Infinity;
      const count = sorted.filter((l) => l >= bucket && l < nextBucket).length;
      histogram.push({ bucket, count });
    }

    return histogram;
  }

  /**
   * Create similarity histogram
   */
  private createSimilarityHistogram(sorted: number[]): {
    minScore: number;
    maxScore: number;
    count: number;
  }[] {
    const bucketSize = 0.1;
    const histogram: { minScore: number; maxScore: number; count: number }[] =
      [];

    for (let i = 0; i < 10; i++) {
      const minScore = i * bucketSize;
      const maxScore = (i + 1) * bucketSize;
      const count = sorted.filter(
        (s) => s >= minScore && s < maxScore
      ).length;
      histogram.push({ minScore, maxScore, count });
    }

    return histogram;
  }

  /**
   * Get elapsed seconds since start
   */
  private getElapsedSeconds(): number {
    if (this.history.length === 0) {
      return 0;
    }
    const firstTimestamp = this.history[0].timestamp;
    return (Date.now() - firstTimestamp) / 1000;
  }

  /**
   * Get current counter values
   */
  getCounters(): {
    hits: number;
    missCount: number;
    evictions: number;
  } {
    return {
      hits: this.hits,
      missCount: this.missCount,
      evictions: this.evictions,
    };
  }
}
