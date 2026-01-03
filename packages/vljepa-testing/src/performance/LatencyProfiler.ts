/**
 * LatencyProfiler - Detailed latency profiling and analysis
 * Provides in-depth latency metrics and distribution analysis.
 */

import type { LatencyMetrics, PercentileResult, Histogram } from "../types.js";

export interface LatencyProfilerConfig {
  buckets: number[];
  maxSamples: number;
  trackingEnabled: boolean;
}

export interface LatencySample {
  timestamp: number;
  latency: number;
  operation: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface LatencyReport {
  metrics: LatencyMetrics;
  histogram: Histogram;
  percentiles: PercentileResult[];
  outliers: LatencyOutlier[];
  timeSeries: LatencyTimeSeries[];
  analysis: LatencyAnalysis;
}

export interface LatencyOutlier {
  latency: number;
  timestamp: number;
  zScore: number;
  severity: "mild" | "moderate" | "extreme";
  operation: string;
}

export interface LatencyTimeSeries {
  timestamp: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  count: number;
}

export interface LatencyAnalysis {
  trend: "improving" | "stable" | "degrading";
  trendStrength: number;
  variability: "low" | "medium" | "high";
  dominantPercentile: number;
  recommendations: string[];
}

export class LatencyProfiler {
  private samples: LatencySample[] = [];
  private config: LatencyProfilerConfig;
  private timeSeriesWindow: LatencyTimeSeries[] = [];

  constructor(config?: Partial<LatencyProfilerConfig>) {
    this.config = {
      buckets: config?.buckets ?? this.getDefaultBuckets(),
      maxSamples: config?.maxSamples ?? 10000,
      trackingEnabled: config?.trackingEnabled ?? true,
    };
  }

  /**
   * Record a latency sample
   */
  record(sample: LatencySample): void {
    if (!this.config.trackingEnabled) return;

    this.samples.push(sample);

    // Trim samples if exceeding max
    if (this.samples.length > this.config.maxSamples) {
      this.samples = this.samples.slice(-this.config.maxSamples);
    }

    // Update time series
    this.updateTimeSeries();
  }

  /**
   * Get current latency metrics
   */
  getMetrics(): LatencyMetrics {
    if (this.samples.length === 0) {
      return this.getEmptyMetrics();
    }

    const latencies = this.samples.map(s => s.latency).sort((a, b) => a - b);

    return {
      min: latencies[0],
      max: latencies[latencies.length - 1],
      mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      median: latencies[Math.floor(latencies.length / 2)],
      p50: this.percentile(latencies, 50),
      p75: this.percentile(latencies, 75),
      p90: this.percentile(latencies, 90),
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99),
      p999: this.percentile(latencies, 99.9),
      stddev: this.calculateStdDev(latencies),
    };
  }

  /**
   * Generate comprehensive latency report
   */
  generateReport(): LatencyReport {
    const metrics = this.getMetrics();
    const histogram = this.generateHistogram();
    const percentiles = this.generatePercentiles();
    const outliers = this.detectOutliers();
    const timeSeries = [...this.timeSeriesWindow];
    const analysis = this.analyzeLatency();

    return {
      metrics,
      histogram,
      percentiles,
      outliers,
      timeSeries,
      analysis,
    };
  }

  /**
   * Generate histogram
   */
  private generateHistogram(): Histogram {
    if (this.samples.length === 0) {
      return {
        buckets: this.config.buckets,
        counts: new Array(this.config.buckets.length).fill(0),
        min: 0,
        max: 0,
        mean: 0,
        stddev: 0,
      };
    }

    const latencies = this.samples.map(s => s.latency);
    const counts = new Array(this.config.buckets.length + 1).fill(0);

    for (const latency of latencies) {
      let bucketIdx = this.config.buckets.findIndex(b => latency < b);
      if (bucketIdx === -1) {
        bucketIdx = this.config.buckets.length; // Overflow bucket
      }
      counts[bucketIdx]++;
    }

    const sorted = latencies.sort((a, b) => a - b);
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const stddev = this.calculateStdDev(latencies);

    return {
      buckets: [...this.config.buckets, Infinity],
      counts: counts as number[],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      stddev,
    };
  }

  /**
   * Generate percentile results
   */
  private generatePercentiles(): PercentileResult[] {
    if (this.samples.length === 0) return [];

    const latencies = this.samples.map(s => s.latency).sort((a, b) => a - b);
    const percentiles = [50, 75, 90, 95, 99, 99.9];

    return percentiles.map(p => ({
      value: this.percentile(latencies, p),
      count: latencies.filter(l => l <= this.percentile(latencies, p)).length,
      percentage: p,
    }));
  }

  /**
   * Detect outliers using z-score
   */
  private detectOutliers(): LatencyOutlier[] {
    if (this.samples.length < 30) return [];

    const latencies = this.samples.map(s => s.latency);
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const stddev = Math.sqrt(
      latencies.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0) /
        latencies.length
    );

    if (stddev === 0) return [];

    const outliers: LatencyOutlier[] = [];

    for (const sample of this.samples) {
      const zScore = Math.abs((sample.latency - mean) / stddev);

      if (zScore > 3) {
        let severity: LatencyOutlier["severity"];
        if (zScore > 5) {
          severity = "extreme";
        } else if (zScore > 4) {
          severity = "moderate";
        } else {
          severity = "mild";
        }

        outliers.push({
          latency: sample.latency,
          timestamp: sample.timestamp,
          zScore,
          severity,
          operation: sample.operation,
        });
      }
    }

    return outliers.sort((a, b) => b.zScore - a.zScore);
  }

  /**
   * Analyze latency patterns
   */
  private analyzeLatency(): LatencyAnalysis {
    if (this.timeSeriesWindow.length < 2) {
      return {
        trend: "stable",
        trendStrength: 0,
        variability: "low",
        dominantPercentile: 95,
        recommendations: ["Insufficient data for analysis"],
      };
    }

    // Analyze trend
    const first = this.timeSeriesWindow[0];
    const last = this.timeSeriesWindow[this.timeSeriesWindow.length - 1];
    const trendChange = (last.mean - first.mean) / (first.mean || 1);

    let trend: LatencyAnalysis["trend"];
    let trendStrength: number;

    if (Math.abs(trendChange) < 0.1) {
      trend = "stable";
      trendStrength = Math.abs(trendChange) * 10;
    } else if (trendChange < 0) {
      trend = "improving";
      trendStrength = Math.abs(trendChange);
    } else {
      trend = "degrading";
      trendStrength = trendChange;
    }

    // Analyze variability
    const variance = this.calculateVariance();
    let variability: LatencyAnalysis["variability"];

    if (variance < 0.2) {
      variability = "low";
    } else if (variance < 0.5) {
      variability = "medium";
    } else {
      variability = "high";
    }

    // Find dominant percentile
    const metrics = this.getMetrics();
    const dominantPercentile = this.findDominantPercentile(metrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      trend,
      variability,
      metrics
    );

    return {
      trend,
      trendStrength,
      variability,
      dominantPercentile,
      recommendations,
    };
  }

  /**
   * Calculate variance coefficient
   */
  private calculateVariance(): number {
    if (this.samples.length === 0) return 0;

    const latencies = this.samples.map(s => s.latency);
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const stddev = this.calculateStdDev(latencies);

    return mean > 0 ? stddev / mean : 0;
  }

  /**
   * Find dominant percentile (where latency changes most)
   */
  private findDominantPercentile(metrics: LatencyMetrics): number {
    const ratios = {
      50: metrics.p95 / metrics.p50,
      75: metrics.p95 / metrics.p75,
      90: metrics.p99 / metrics.p90,
      95: metrics.p99 / metrics.p95,
    };

    let maxRatio = 0;
    let dominant = 95;

    for (const [p, ratio] of Object.entries(ratios)) {
      if (ratio > maxRatio) {
        maxRatio = ratio;
        dominant = parseInt(p);
      }
    }

    return dominant;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    trend: LatencyAnalysis["trend"],
    variability: LatencyAnalysis["variability"],
    metrics: LatencyMetrics
  ): string[] {
    const recommendations: string[] = [];

    if (trend === "degrading") {
      recommendations.push("CRITICAL: Latency is degrading over time");
      recommendations.push("- Investigate resource leaks");
      recommendations.push("- Check for database query slowdown");
      recommendations.push("- Review connection pool usage");
    } else if (trend === "improving") {
      recommendations.push("Good: Latency is improving");
    }

    if (variability === "high") {
      recommendations.push("High variability detected");
      recommendations.push("- Investigate inconsistent performance");
      recommendations.push("- Check for resource contention");
      recommendations.push("- Review caching effectiveness");
    }

    if (metrics.p99 > metrics.p95 * 2) {
      recommendations.push("Long tail latency detected");
      recommendations.push("- Investigate outliers");
      recommendations.push("- Consider request timeouts");
      recommendations.push("- Implement request cancellation");
    }

    if (recommendations.length === 0) {
      recommendations.push("Latency is healthy");
    }

    return recommendations;
  }

  /**
   * Update time series window
   */
  private updateTimeSeries(): void {
    if (this.samples.length < 10) return;

    // Group samples into 1-second windows
    const windowSize = 1000;
    const now = Date.now();
    const windowStart = now - windowSize;

    const windowSamples = this.samples.filter(s => s.timestamp >= windowStart);

    if (windowSamples.length === 0) return;

    const latencies = windowSamples.map(s => s.latency).sort((a, b) => a - b);

    this.timeSeriesWindow.push({
      timestamp: now,
      mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50: latencies[Math.floor(latencies.length * 0.5)],
      p95: latencies[Math.floor(latencies.length * 0.95)],
      p99: latencies[Math.floor(latencies.length * 0.99)],
      count: latencies.length,
    });

    // Keep only last 60 seconds
    this.timeSeriesWindow = this.timeSeriesWindow.slice(-60);
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    return Math.sqrt(variance);
  }

  /**
   * Get empty metrics
   */
  private getEmptyMetrics(): LatencyMetrics {
    return {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      p999: 0,
      stddev: 0,
    };
  }

  /**
   * Get default buckets
   */
  private getDefaultBuckets(): number[] {
    return [
      10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000,
      5000, 10000,
    ];
  }

  /**
   * Reset profiler
   */
  reset(): void {
    this.samples = [];
    this.timeSeriesWindow = [];
  }

  /**
   * Get sample count
   */
  getSampleCount(): number {
    return this.samples.length;
  }
}
