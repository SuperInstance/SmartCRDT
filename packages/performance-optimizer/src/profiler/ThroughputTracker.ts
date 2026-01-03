/**
 * Throughput Measurement and Operations Per Second Tracking
 *
 * Features:
 * - Real-time throughput measurement
 * - Sliding window analysis
 * - Trend detection
 * - Operations per second calculation
 * - Success/failure tracking
 * - Performance statistics
 *
 * @module @lsi/performance-optimizer/profiler/ThroughputTracker
 */

import type {
  ThroughputMeasurement,
  ThroughputStatistics,
  ThroughputReport,
  LatencySample,
} from "@lsi/protocol";

/**
 * Throughput tracking configuration
 */
export interface ThroughputTrackerConfig {
  /** Measurement window in milliseconds */
  measurementWindow: number;
  /** Sliding window size (number of measurements) */
  slidingWindow: number;
  /** Operation name */
  operation: string;
}

/**
 * Throughput tracker with sliding window analysis
 */
export class ThroughputTracker {
  private operation: string;
  private measurementWindow: number;
  private slidingWindowSize: number;
  private measurements: ThroughputMeasurement[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private totalOperations: number = 0;
  private failedOperations: number = 0;
  private windowStartTime: number = 0;
  private windowOperations: number = 0;
  private windowFailures: number = 0;
  private timer?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: ThroughputTrackerConfig) {
    this.operation = config.operation;
    this.measurementWindow = config.measurementWindow;
    this.slidingWindowSize = config.slidingWindow;
  }

  /**
   * Start throughput tracking
   */
  start(): void {
    if (this.isRunning) {
      throw new Error("Throughput tracker is already running");
    }

    this.isRunning = true;
    this.startTime = Date.now();
    this.windowStartTime = this.startTime;
    this.totalOperations = 0;
    this.failedOperations = 0;
    this.windowOperations = 0;
    this.windowFailures = 0;
    this.measurements = [];

    // Start periodic measurement
    this.timer = setInterval(() => {
      this.collectMeasurement();
    }, this.measurementWindow);
  }

  /**
   * Stop throughput tracking
   */
  stop(): void {
    if (!this.isRunning) {
      throw new Error("Throughput tracker is not running");
    }

    this.isRunning = false;
    this.endTime = Date.now();

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    // Collect final measurement
    this.collectMeasurement();
  }

  /**
   * Record an operation completion
   */
  recordOperation(success: boolean = true): void {
    if (!this.isRunning) {
      throw new Error("Throughput tracker is not running");
    }

    this.totalOperations++;
    this.windowOperations++;

    if (!success) {
      this.failedOperations++;
      this.windowFailures++;
    }
  }

  /**
   * Record multiple operations
   */
  recordOperations(count: number, successCount: number = count): void {
    if (!this.isRunning) {
      throw new Error("Throughput tracker is not running");
    }

    this.totalOperations += count;
    this.windowOperations += count;
    this.failedOperations += (count - successCount);
    this.windowFailures += (count - successCount);
  }

  /**
   * Collect a throughput measurement
   */
  private collectMeasurement(): void {
    const now = Date.now();
    const windowDuration = now - this.windowStartTime;

    if (windowDuration === 0) {
      return; // Avoid division by zero
    }

    const opsPerSecond = (this.windowOperations / windowDuration) * 1000;
    const successCount = this.windowOperations - this.windowFailures;
    const failedCount = this.windowFailures;

    const measurement: ThroughputMeasurement = {
      timestamp: now,
      operation: this.operation,
      operationsCompleted: successCount,
      operationsFailed: failedCount,
      opsPerSecond,
      timeWindow: windowDuration,
    };

    this.measurements.push(measurement);

    // Reset window
    this.windowStartTime = now;
    this.windowOperations = 0;
    this.windowFailures = 0;

    // Maintain sliding window size
    if (this.measurements.length > this.slidingWindowSize) {
      this.measurements.shift();
    }
  }

  /**
   * Calculate throughput statistics
   */
  calculateStatistics(): ThroughputStatistics {
    if (this.measurements.length === 0) {
      return {
        averageThroughput: 0,
        peakThroughput: 0,
        minThroughput: 0,
        percentiles: {
          min: 0,
          max: 0,
          average: 0,
          p50: 0,
          p75: 0,
          p90: 0,
          p95: 0,
          p99: 0,
          p99_9: 0,
          stdDev: 0,
          variance: 0,
        },
        totalOperations: this.totalOperations,
        failedOperations: this.failedOperations,
        successRate: 1,
        trend: "stable",
        trendStrength: 0,
      };
    }

    const throughputs = this.measurements.map((m) => m.opsPerSecond);
    const totalOps = this.measurements.reduce(
      (sum, m) => sum + m.operationsCompleted + m.operationsFailed,
      0
    );
    const totalFailures = this.measurements.reduce(
      (sum, m) => sum + m.operationsFailed,
      0
    );

    // Calculate basic stats
    const averageThroughput =
      throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
    const peakThroughput = Math.max(...throughputs);
    const minThroughput = Math.min(...throughputs);

    // Calculate percentiles
    const sorted = [...throughputs].sort((a, b) => a - b);
    const percentiles = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      average: averageThroughput,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      p99_9: sorted[Math.floor(sorted.length * 0.999)],
      stdDev: this.calculateStdDev(throughputs),
      variance: this.calculateVariance(throughputs),
    };

    // Calculate success rate
    const successRate = totalOps > 0 ? (totalOps - totalFailures) / totalOps : 1;

    // Detect trend
    const trend = this.detectTrend();
    const trendStrength = this.calculateTrendStrength();

    return {
      averageThroughput,
      peakThroughput,
      minThroughput,
      percentiles,
      totalOperations: this.totalOperations,
      failedOperations: this.failedOperations,
      successRate,
      trend,
      trendStrength,
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    return Math.sqrt(this.calculateVariance(values));
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  /**
   * Detect throughput trend
   */
  private detectTrend(): "increasing" | "stable" | "decreasing" {
    if (this.measurements.length < 3) {
      return "stable";
    }

    // Use linear regression to detect trend
    const n = this.measurements.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = this.measurements[i].opsPerSecond;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Threshold for trend detection
    const avgThroughput = sumY / n;
    const threshold = avgThroughput * 0.05; // 5% change

    if (slope > threshold) {
      return "increasing";
    } else if (slope < -threshold) {
      return "decreasing";
    } else {
      return "stable";
    }
  }

  /**
   * Calculate trend strength (0-1)
   */
  private calculateTrendStrength(): number {
    if (this.measurements.length < 3) {
      return 0;
    }

    const throughputs = this.measurements.map((m) => m.opsPerSecond);
    const avg = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
    const variance = this.calculateVariance(throughputs);

    // Trend strength is based on signal-to-noise ratio
    // Higher variance relative to mean = weaker trend
    const coefficientOfVariation = avg > 0 ? Math.sqrt(variance) / avg : 0;
    const strength = Math.max(0, 1 - coefficientOfVariation);

    return Math.min(1, Math.max(0, strength));
  }

  /**
   * Group measurements by time window
   */
  private groupByTimeWindow(): Array<{
    window: string;
    throughput: number;
    timestamp: number;
  }> {
    return this.measurements.map((m) => ({
      window: `${m.timeWindow}ms`,
      throughput: m.opsPerSecond,
      timestamp: m.timestamp,
    }));
  }

  /**
   * Generate comprehensive throughput report
   */
  generateReport(): ThroughputReport {
    const statistics = this.calculateStatistics();
    const totalDuration = (this.endTime || Date.now()) - this.startTime;

    return {
      operation: this.operation,
      totalDuration,
      statistics,
      timeline: this.measurements,
      byTimeWindow: this.groupByTimeWindow(),
    };
  }

  /**
   * Get current throughput (ops/sec in current window)
   */
  getCurrentThroughput(): number {
    const now = Date.now();
    const windowDuration = now - this.windowStartTime;

    if (windowDuration === 0) {
      return 0;
    }

    return (this.windowOperations / windowDuration) * 1000;
  }

  /**
   * Get raw measurements
   */
  getMeasurements(): ThroughputMeasurement[] {
    return this.measurements;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.measurements = [];
    this.startTime = 0;
    this.endTime = 0;
    this.totalOperations = 0;
    this.failedOperations = 0;
    this.windowOperations = 0;
    this.windowFailures = 0;
  }

  /**
   * Check if tracker is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

/**
 * Multi-operation throughput tracker
 */
export class MultiOperationThroughputTracker {
  private trackers: Map<string, ThroughputTracker> = new Map();
  private measurementWindow: number;
  private slidingWindow: number;

  constructor(measurementWindow: number = 1000, slidingWindow: number = 5) {
    this.measurementWindow = measurementWindow;
    this.slidingWindow = slidingWindow;
  }

  /**
   * Get or create tracker for operation
   */
  getTracker(operation: string): ThroughputTracker {
    let tracker = this.trackers.get(operation);

    if (!tracker) {
      tracker = new ThroughputTracker({
        operation,
        measurementWindow: this.measurementWindow,
        slidingWindow: this.slidingWindow,
      });
      this.trackers.set(operation, tracker);
    }

    return tracker;
  }

  /**
   * Start tracking all operations
   */
  startAll(): void {
    for (const tracker of this.trackers.values()) {
      tracker.start();
    }
  }

  /**
   * Stop tracking all operations
   */
  stopAll(): void {
    for (const tracker of this.trackers.values()) {
      tracker.stop();
    }
  }

  /**
   * Generate reports for all operations
   */
  generateAllReports(): Map<string, ThroughputReport> {
    const reports = new Map<string, ThroughputReport>();

    for (const [operation, tracker] of this.trackers) {
      reports.set(operation, tracker.generateReport());
    }

    return reports;
  }

  /**
   * Get all tracked operations
   */
  getOperations(): string[] {
    return Array.from(this.trackers.keys());
  }
}
