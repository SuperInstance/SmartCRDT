/**
 * MemoryLeakDetector - Detect and analyze memory leaks
 * Monitors memory usage over time to identify leaks.
 */

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

export interface LeakDetectionConfig {
  sampleInterval: number;
  thresholdMB: number;
  growthRateThreshold: number;
  minSamples: number;
  windowSize: number;
}

export interface LeakDetectionResult {
  hasLeak: boolean;
  leakRate: number; // MB per hour
  confidence: number;
  estimatedLeak: number; // MB over test duration
  leakLocation?: string;
  snapshots: MemorySnapshot[];
  trend: "increasing" | "stable" | "decreasing" | "unknown";
  recommendation: string;
}

export class MemoryLeakDetector {
  private snapshots: MemorySnapshot[] = [];
  private config: LeakDetectionConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<LeakDetectionConfig> = {}) {
    this.config = {
      sampleInterval: config.sampleInterval ?? 5000,
      thresholdMB: config.thresholdMB ?? 100,
      growthRateThreshold: config.growthRateThreshold ?? 10, // MB per hour
      minSamples: config.minSamples ?? 10,
      windowSize: config.windowSize ?? 5,
    };
  }

  /**
   * Start monitoring memory
   */
  start(): void {
    this.stop();
    this.snapshots = [];

    this.intervalId = setInterval(() => {
      this.captureSnapshot();
    }, this.config.sampleInterval);
  }

  /**
   * Stop monitoring memory
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Capture a memory snapshot
   */
  captureSnapshot(): MemorySnapshot {
    // In a real implementation, this would use process.memoryUsage()
    // For now, we'll create a mock snapshot
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: this.getHeapUsed(),
      heapTotal: this.getHeapTotal(),
      rss: this.getRSS(),
      external: 0,
      arrayBuffers: 0,
    };

    this.snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Get heap used (mock implementation)
   */
  private getHeapUsed(): number {
    // In real implementation: return process.memoryUsage().heapUsed
    return 100_000_000 + Math.random() * 10_000_000; // 100MB base + random
  }

  /**
   * Get heap total (mock implementation)
   */
  private getHeapTotal(): number {
    // In real implementation: return process.memoryUsage().heapTotal
    return 200_000_000;
  }

  /**
   * Get RSS (mock implementation)
   */
  private getRSS(): number {
    // In real implementation: return process.memoryUsage().rss
    return 150_000_000;
  }

  /**
   * Analyze memory for leaks
   */
  analyze(): LeakDetectionResult {
    if (this.snapshots.length < this.config.minSamples) {
      return {
        hasLeak: false,
        leakRate: 0,
        confidence: 0,
        estimatedLeak: 0,
        snapshots: this.snapshots,
        trend: "unknown",
        recommendation: "Insufficient data for leak detection",
      };
    }

    // Calculate trend
    const trend = this.calculateTrend();

    // Calculate leak rate
    const leakRate = this.calculateLeakRate();

    // Determine if there's a leak
    const hasLeak =
      trend === "increasing" && leakRate > this.config.growthRateThreshold;

    // Calculate confidence
    const confidence = this.calculateConfidence();

    // Estimate leak
    const estimatedLeak = this.estimateLeak();

    return {
      hasLeak,
      leakRate,
      confidence,
      estimatedLeak,
      snapshots: this.snapshots,
      trend,
      recommendation: this.generateRecommendation(
        hasLeak,
        leakRate,
        confidence
      ),
    };
  }

  /**
   * Calculate memory trend
   */
  private calculateTrend(): "increasing" | "stable" | "decreasing" | "unknown" {
    if (this.snapshots.length < 3) return "unknown";

    // Use linear regression to determine trend
    const x = this.snapshots.map((_, i) => i);
    const y = this.snapshots.map(s => s.heapUsed / 1_000_000); // Convert to MB

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Determine trend based on slope
    if (slope > 0.5) return "increasing";
    if (slope < -0.5) return "decreasing";
    return "stable";
  }

  /**
   * Calculate leak rate in MB per hour
   */
  private calculateLeakRate(): number {
    if (this.snapshots.length < 2) return 0;

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];

    const timeDiffHours = (last.timestamp - first.timestamp) / (1000 * 60 * 60);
    const memDiffMB = (last.heapUsed - first.heapUsed) / 1_000_000;

    if (timeDiffHours <= 0) return 0;

    return memDiffMB / timeDiffHours;
  }

  /**
   * Estimate total leak over test duration
   */
  private estimateLeak(): number {
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];

    if (!first || !last) return 0;

    return (last.heapUsed - first.heapUsed) / 1_000_000; // MB
  }

  /**
   * Calculate confidence in leak detection
   */
  private calculateConfidence(): number {
    if (this.snapshots.length < this.config.minSamples) return 0;

    // Calculate R-squared for linear fit
    const x = this.snapshots.map((_, i) => i);
    const y = this.snapshots.map(s => s.heapUsed / 1_000_000);

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);

    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    // High R-squared + increasing trend = high confidence
    const trend = this.calculateTrend();
    const trendFactor =
      trend === "increasing" ? 1 : trend === "stable" ? 0.5 : 0;

    return rSquared * trendFactor;
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    hasLeak: boolean,
    leakRate: number,
    confidence: number
  ): string {
    if (!hasLeak) {
      return "No memory leak detected. Memory usage is stable.";
    }

    if (confidence > 0.8) {
      return `HIGH CONFIDENCE: Memory leak detected. Leaking ~${leakRate.toFixed(2)} MB/hour. Review and fix memory management.`;
    }

    if (confidence > 0.5) {
      return `POSSIBLE LEAK: Memory increasing at ~${leakRate.toFixed(2)} MB/hour. Further investigation needed.`;
    }

    return `LOW CONFIDENCE: Memory trend unclear. Continue monitoring.`;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    currentHeap: number;
    peakHeap: number;
    avgHeap: number;
    minHeap: number;
    totalGrowth: number;
  } {
    if (this.snapshots.length === 0) {
      return {
        currentHeap: 0,
        peakHeap: 0,
        avgHeap: 0,
        minHeap: 0,
        totalGrowth: 0,
      };
    }

    const heaps = this.snapshots.map(s => s.heapUsed);

    return {
      currentHeap: heaps[heaps.length - 1],
      peakHeap: Math.max(...heaps),
      avgHeap: heaps.reduce((a, b) => a + b, 0) / heaps.length,
      minHeap: Math.min(...heaps),
      totalGrowth: heaps[heaps.length - 1] - heaps[0],
    };
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots = [];
  }

  /**
   * Export snapshots as CSV
   */
  exportCSV(): string {
    const header = "timestamp,heapUsed,heapTotal,rss,external,arrayBuffers\n";
    const rows = this.snapshots.map(
      s =>
        `${s.timestamp},${s.heapUsed},${s.heapTotal},${s.rss},${s.external},${s.arrayBuffers}`
    );

    return header + rows.join("\n");
  }
}
