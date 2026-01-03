/**
 * SustainedLoad - Manages sustained load testing
 * Focuses on maintaining consistent load over extended periods.
 */

import type {
  LoadTestConfig,
  LoadPhase,
  LatencyMetrics,
  ResourceMetrics,
  ErrorStats,
} from "../types.js";

export interface SustainedLoadConfig {
  targetLoad: number;
  duration: number;
  stabilityThreshold: number;
  driftThreshold: number;
  adjustmentInterval: number;
}

export interface SustainedLoadResult {
  phase: LoadPhase;
  stability: number;
  drift: number;
  adjustments: number;
  recommendedAction: string;
}

export class SustainedLoad {
  private config: SustainedLoadConfig;
  private latencies: number[] = [];
  private throughputs: number[] = [];
  private adjustments = 0;
  private startAdjustmentTime = 0;

  constructor(config: SustainedLoadConfig) {
    this.config = config;
  }

  /**
   * Start sustained load phase
   */
  async execute(
    config: LoadTestConfig,
    executor: (
      load: number
    ) => Promise<{ latency: number; success: boolean; error?: string }>
  ): Promise<SustainedLoadResult> {
    this.latencies = [];
    this.throughputs = [];
    this.adjustments = 0;

    const startTime = Date.now();
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    while (Date.now() - startTime < this.config.duration) {
      const elapsed = Date.now() - startTime;

      // Execute requests at current load
      const results = await this.executeBatch(config, executor);

      totalRequests += results.total;
      successfulRequests += results.successful;
      failedRequests += results.failed;

      // Check stability and adjust
      if (elapsed - this.startAdjustmentTime > this.config.adjustmentInterval) {
        const stability = this.calculateStability();
        if (stability < this.config.stabilityThreshold) {
          await this.adjustLoad(config);
          this.adjustments++;
        }
        this.startAdjustmentTime = elapsed;
      }
    }

    const drift = this.calculateDrift();
    const stability = this.calculateStability();

    return {
      phase: {
        requests: totalRequests,
        successes: successfulRequests,
        failures: failedRequests,
        duration: this.config.duration,
        avgLatency: this.calculateAverage(this.latencies),
      },
      stability,
      drift,
      adjustments: this.adjustments,
      recommendedAction: this.getRecommendation(stability, drift),
    };
  }

  /**
   * Execute a batch of requests
   */
  private async executeBatch(
    config: LoadTestConfig,
    executor: (
      load: number
    ) => Promise<{ latency: number; success: boolean; error?: string }>
  ): Promise<{ total: number; successful: number; failed: number }> {
    const batchSize = Math.ceil(config.requestsPerSecond / 10); // 10 batches per second
    const batchPromises: Promise<{
      latency: number;
      success: boolean;
      error?: string;
    }>[] = [];

    for (let i = 0; i < batchSize; i++) {
      batchPromises.push(executor(this.config.targetLoad));
    }

    const results = await Promise.all(batchPromises);

    let total = results.length;
    let successful = 0;
    let failed = 0;

    for (const result of results) {
      if (result.success) {
        successful++;
        this.latencies.push(result.latency);
      } else {
        failed++;
      }
    }

    return { total, successful, failed };
  }

  /**
   * Calculate stability metric (lower = more stable)
   */
  private calculateStability(): number {
    if (this.latencies.length < 10) {
      return 0;
    }

    const recent = this.latencies.slice(-100);
    const mean = this.calculateAverage(recent);
    const variance =
      recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      recent.length;
    const stddev = Math.sqrt(variance);

    return stddev / mean; // Coefficient of variation
  }

  /**
   * Calculate drift metric (latency trend)
   */
  private calculateDrift(): number {
    if (this.latencies.length < 20) {
      return 0;
    }

    const firstHalf = this.latencies.slice(
      0,
      Math.floor(this.latencies.length / 2)
    );
    const secondHalf = this.latencies.slice(
      Math.floor(this.latencies.length / 2)
    );

    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);

    return (secondAvg - firstAvg) / firstAvg; // Percentage drift
  }

  /**
   * Adjust load to maintain stability
   */
  private async adjustLoad(config: LoadTestConfig): Promise<void> {
    const drift = this.calculateDrift();

    if (drift > this.config.driftThreshold) {
      // Reduce load
      this.config.targetLoad = Math.max(
        1,
        Math.floor(this.config.targetLoad * 0.9)
      );
    } else if (drift < -this.config.driftThreshold / 2) {
      // Can increase load
      this.config.targetLoad = Math.min(
        config.concurrentUsers,
        Math.floor(this.config.targetLoad * 1.1)
      );
    }
  }

  /**
   * Get recommendation based on stability and drift
   */
  private getRecommendation(stability: number, drift: number): string {
    if (stability > this.config.stabilityThreshold * 2) {
      return "UNSTABLE: System is experiencing high variance. Reduce load or investigate bottlenecks.";
    }
    if (drift > this.config.driftThreshold) {
      return "DEGRADING: Latency is increasing over time. System may be approaching saturation.";
    }
    if (this.adjustments > 10) {
      return "TROUBLED: Required frequent adjustments. System may not be suitable for sustained load.";
    }
    return "HEALTHY: System is stable under sustained load.";
  }

  /**
   * Calculate average of array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Get current statistics
   */
  getStats(): {
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    sampleCount: number;
  } {
    if (this.latencies.length === 0) {
      return { avgLatency: 0, minLatency: 0, maxLatency: 0, sampleCount: 0 };
    }

    const avg = this.calculateAverage(this.latencies);
    const min = Math.min(...this.latencies);
    const max = Math.max(...this.latencies);

    return {
      avgLatency: avg,
      minLatency: min,
      maxLatency: max,
      sampleCount: this.latencies.length,
    };
  }

  /**
   * Reset the sustained load state
   */
  reset(): void {
    this.latencies = [];
    this.throughputs = [];
    this.adjustments = 0;
    this.startAdjustmentTime = 0;
  }
}
