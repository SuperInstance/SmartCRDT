/**
 * StabilityTester - Test system stability over time
 * Monitors performance degradation and system health.
 */

import type {
  TestRequest,
  EnduranceTestConfig,
  EnduranceSample,
  PerformanceTrend,
} from "../types.js";

export interface StabilityTestConfig {
  duration: number;
  sampleInterval: number;
  driftThreshold: number;
  varianceThreshold: number;
  healthCheckInterval: number;
}

export interface StabilityTestResult {
  stable: boolean;
  duration: number;
  samples: EnduranceSample[];
  trends: PerformanceTrend[];
  driftScore: number;
  varianceScore: number;
  healthScore: number;
  stabilityScore: number;
  recommendations: string[];
}

export interface StabilityTestExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
  healthCheck(): Promise<boolean>;
  getMetrics(): Promise<{ memory: number; cpu: number }>;
}

export class StabilityTester {
  private samples: EnduranceSample[] = [];
  private driftScores: number[] = [];
  private healthChecks: boolean[] = [];

  /**
   * Execute stability test
   */
  async execute(
    config: StabilityTestConfig,
    executor: StabilityTestExecutor
  ): Promise<StabilityTestResult> {
    this.reset();

    const startTime = Date.now();
    let lastHealthCheck = startTime;

    while (Date.now() - startTime < config.duration) {
      // Capture sample
      const sample = await this.captureSample(config, executor);
      this.samples.push(sample);

      // Periodic health check
      if (Date.now() - lastHealthCheck > config.healthCheckInterval) {
        const healthy = await this.performHealthCheck(executor);
        this.healthChecks.push(healthy);
        lastHealthCheck = Date.now();
      }

      // Calculate drift
      const driftScore = this.calculateDrift();
      this.driftScores.push(driftScore);

      // Wait for next sample
      await this.sleep(config.sampleInterval);
    }

    const trends = this.analyzeTrends();
    const driftScore = this.getAverageDrift();
    const varianceScore = this.calculateVarianceScore();
    const healthScore = this.calculateHealthScore();
    const stabilityScore = this.calculateOverallStability(
      driftScore,
      varianceScore,
      healthScore,
      config
    );

    const recommendations = this.generateRecommendations(
      stabilityScore,
      driftScore,
      varianceScore,
      trends
    );

    return {
      stable: stabilityScore > 0.7,
      duration: Date.now() - startTime,
      samples: this.samples,
      trends,
      driftScore,
      varianceScore,
      healthScore,
      stabilityScore,
      recommendations,
    };
  }

  /**
   * Capture a performance sample
   */
  private async captureSample(
    config: StabilityTestConfig,
    executor: StabilityTestExecutor
  ): Promise<EnduranceSample> {
    const requestCount = 10;
    const latencies: number[] = [];
    let errors = 0;

    // Execute sample requests
    for (let i = 0; i < requestCount; i++) {
      const request = this.generateRequest(i);
      const start = performance.now();

      try {
        const result = await executor.execute(request);
        const latency = performance.now() - start;
        latencies.push(latency);

        if (!result.success) {
          errors++;
        }
      } catch {
        errors++;
      }
    }

    // Get system metrics
    const metrics = await executor
      .getMetrics()
      .catch(() => ({ memory: 0, cpu: 0 }));

    // Calculate latency metrics
    const sorted = latencies.sort((a, b) => a - b);

    return {
      timestamp: Date.now(),
      latency: {
        min: sorted[0] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        mean:
          latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0,
        median: sorted[Math.floor(sorted.length / 2)] ?? 0,
        p50: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p75: sorted[Math.floor(sorted.length * 0.75)] ?? 0,
        p90: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
        p999: sorted[Math.floor(sorted.length * 0.999)] ?? 0,
        stddev: this.calculateStdDev(latencies),
      },
      throughput: requestCount / (config.sampleInterval / 1000),
      memory: metrics.memory,
      cpu: metrics.cpu,
      errors,
    };
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(
    executor: StabilityTestExecutor
  ): Promise<boolean> {
    try {
      return await executor.healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * Calculate performance drift
   */
  private calculateDrift(): number {
    if (this.samples.length < 10) return 0;

    const window = 20;
    const recent = this.samples.slice(-window);
    const earlier = this.samples.slice(-window * 2, -window);

    if (earlier.length === 0) return 0;

    const recentAvg =
      recent.reduce((sum, s) => sum + s.latency.mean, 0) / recent.length;
    const earlierAvg =
      earlier.reduce((sum, s) => sum + s.latency.mean, 0) / earlier.length;

    if (earlierAvg === 0) return 0;

    return (recentAvg - earlierAvg) / earlierAvg; // Fractional drift
  }

  /**
   * Get average drift score
   */
  private getAverageDrift(): number {
    if (this.driftScores.length === 0) return 0;
    return Math.abs(
      this.driftScores.reduce((a, b) => a + b, 0) / this.driftScores.length
    );
  }

  /**
   * Calculate variance score (lower is better)
   */
  private calculateVarianceScore(): number {
    if (this.samples.length < 10) return 0;

    const latencies = this.samples.map(s => s.latency.mean);
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const variance =
      latencies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      latencies.length;
    const stddev = Math.sqrt(variance);

    // Normalize by mean
    return mean > 0 ? stddev / mean : 0;
  }

  /**
   * Calculate health score (0-1)
   */
  private calculateHealthScore(): number {
    if (this.healthChecks.length === 0) return 1;

    const healthy = this.healthChecks.filter(h => h).length;
    return healthy / this.healthChecks.length;
  }

  /**
   * Calculate overall stability score
   */
  private calculateOverallStability(
    driftScore: number,
    varianceScore: number,
    healthScore: number,
    config: StabilityTestConfig
  ): number {
    // Drift: lower is better (0-1 scale)
    const driftComponent = Math.max(0, 1 - driftScore / config.driftThreshold);

    // Variance: lower is better (0-1 scale)
    const varianceComponent = Math.max(
      0,
      1 - varianceScore / config.varianceThreshold
    );

    // Health: higher is better
    const healthComponent = healthScore;

    // Weighted average
    return (
      driftComponent * 0.4 + varianceComponent * 0.3 + healthComponent * 0.3
    );
  }

  /**
   * Analyze trends in performance
   */
  private analyzeTrends(): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];

    if (this.samples.length < 20) return trends;

    // Analyze latency trend
    const latencyTrend = this.analyzeMetricTrend(
      this.samples.map(s => s.latency.mean),
      "latency"
    );
    trends.push(latencyTrend);

    // Analyze throughput trend
    const throughputTrend = this.analyzeMetricTrend(
      this.samples.map(s => s.throughput),
      "throughput"
    );
    trends.push(throughputTrend);

    // Analyze memory trend
    const memoryTrend = this.analyzeMetricTrend(
      this.samples.map(s => s.memory),
      "memory"
    );
    trends.push(memoryTrend);

    // Analyze error trend
    const errorTrend = this.analyzeMetricTrend(
      this.samples.map(s => s.errors),
      "errors"
    );
    trends.push(errorTrend);

    return trends;
  }

  /**
   * Analyze trend of a specific metric
   */
  private analyzeMetricTrend(
    values: number[],
    metric: string
  ): PerformanceTrend {
    if (values.length < 10) {
      return {
        metric,
        direction: "stable",
        rate: 0,
        correlation: 0,
      };
    }

    // Linear regression
    const x = values.map((_, i) => i);
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Determine direction
    let direction: "improving" | "stable" | "degrading";
    if (Math.abs(slope) < 0.01) {
      direction = "stable";
    } else if (
      metric === "errors" ||
      metric === "latency" ||
      metric === "memory"
    ) {
      // For these, negative slope is improving
      direction = slope < 0 ? "improving" : "degrading";
    } else {
      // For throughput, positive slope is improving
      direction = slope > 0 ? "improving" : "degrading";
    }

    // Calculate correlation
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = x.reduce(
      (sum, xi, i) => sum + (xi - meanX) * (values[i] - meanY),
      0
    );
    const denomX = Math.sqrt(
      x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0)
    );
    const denomY = Math.sqrt(
      values.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0)
    );
    const correlation =
      denomX > 0 && denomY > 0 ? numerator / (denomX * denomY) : 0;

    return {
      metric,
      direction,
      rate: slope,
      correlation,
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    stabilityScore: number,
    driftScore: number,
    varianceScore: number,
    trends: PerformanceTrend[]
  ): string[] {
    const recommendations: string[] = [];

    if (stabilityScore > 0.9) {
      recommendations.push(
        "EXCELLENT: System is very stable. Ready for production."
      );
      return recommendations;
    }

    if (stabilityScore < 0.5) {
      recommendations.push(
        "CRITICAL: System stability is poor. Do NOT deploy to production."
      );
    }

    if (driftScore > 0.5) {
      recommendations.push(
        "HIGH DRIFT: Performance degrading significantly over time. Investigate resource leaks."
      );
    }

    if (varianceScore > 0.3) {
      recommendations.push(
        "HIGH VARIANCE: Performance inconsistent. Check for resource contention."
      );
    }

    // Analyze trends
    for (const trend of trends) {
      if (
        trend.direction === "degrading" &&
        Math.abs(trend.correlation) > 0.7
      ) {
        recommendations.push(
          `DEGRADING ${trend.metric.toUpperCase()}: ${trend.metric} is getting worse over time.`
        );
      }
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "FAIR: System stability is acceptable but could be improved."
      );
    }

    return recommendations;
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
   * Generate a test request
   */
  private generateRequest(id: number): TestRequest {
    return {
      id: `stability-req-${Date.now()}-${id}`,
      type: "stability_test",
      payload: { stability: true },
      timestamp: Date.now(),
      timeout: 30000,
    };
  }

  /**
   * Reset state
   */
  private reset(): void {
    this.samples = [];
    this.driftScores = [];
    this.healthChecks = [];
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
