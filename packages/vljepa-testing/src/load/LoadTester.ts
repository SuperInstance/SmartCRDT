/**
 * LoadTester - Comprehensive load testing framework
 * Simulates realistic user load with configurable ramp strategies.
 */

import type {
  LoadTestConfig,
  LoadTestResult,
  TestRequest,
  LatencyMetrics,
  ResourceMetrics,
  ErrorStats,
  ErrorSample,
} from "../types.js";
import { createRampStrategy, type RampStrategy } from "./RampStrategy.js";
import { SustainedLoad } from "./SustainedLoad.js";

export interface LoadTestExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
}

export class LoadTester {
  private strategy: RampStrategy;
  private latencySamples: number[] = [];
  private errorSamples: ErrorSample[] = [];
  private resourceSamples: ResourceMetrics[] = [];

  constructor(strategy?: RampStrategy) {
    this.strategy = strategy ?? createRampStrategy("linear");
  }

  /**
   * Execute a complete load test
   */
  async execute(
    config: LoadTestConfig,
    executor: LoadTestExecutor
  ): Promise<LoadTestResult> {
    const startTime = Date.now();
    this.reset();

    // Phase 1: Ramp up
    const rampUpResult = await this.executeRampUp(config, executor);

    // Phase 2: Sustain
    const sustainResult = await this.executeSustain(config, executor);

    // Phase 3: Ramp down
    const rampDownResult = await this.executeRampDown(config, executor);

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      success: true,
      duration,
      timestamp: startTime,
      totalRequests:
        rampUpResult.requests +
        sustainResult.requests +
        rampDownResult.requests,
      successfulRequests:
        rampUpResult.successes +
        sustainResult.successes +
        rampDownResult.successes,
      failedRequests:
        rampUpResult.failures +
        sustainResult.failures +
        rampDownResult.failures,
      latency: this.calculateLatencyMetrics(),
      throughput: this.calculateThroughput(duration),
      errors: this.aggregateErrors(),
      resourceUsage: this.aggregateResourceUsage(),
      rampUpData: rampUpResult,
      sustainData: sustainResult,
      rampDownData: rampDownResult,
    };
  }

  /**
   * Execute ramp up phase
   */
  private async executeRampUp(
    config: LoadTestConfig,
    executor: LoadTestExecutor
  ): Promise<{
    requests: number;
    successes: number;
    failures: number;
    duration: number;
    avgLatency: number;
  }> {
    const startTime = Date.now();
    let totalRequests = 0;
    let successes = 0;
    let failures = 0;
    const phaseLatencies: number[] = [];

    while (Date.now() - startTime < config.rampUpDuration) {
      const elapsed = Date.now() - startTime;
      const currentLoad = this.strategy.getCurrentLoad(elapsed, config);
      const targetRate = this.calculateTargetRate(
        config,
        elapsed,
        config.rampUpDuration
      );

      const batchResult = await this.executeBatch(
        currentLoad,
        targetRate,
        executor
      );
      totalRequests += batchResult.total;
      successes += batchResult.successes;
      failures += batchResult.failures;
      phaseLatencies.push(...batchResult.latencies);

      // Control request rate
      await this.sleep(100); // Sample every 100ms
    }

    return {
      requests: totalRequests,
      successes,
      failures,
      duration: config.rampUpDuration,
      avgLatency:
        phaseLatencies.length > 0
          ? phaseLatencies.reduce((a, b) => a + b, 0) / phaseLatencies.length
          : 0,
    };
  }

  /**
   * Execute sustain phase
   */
  private async executeSustain(
    config: LoadTestConfig,
    executor: LoadTestExecutor
  ): Promise<{
    requests: number;
    successes: number;
    failures: number;
    duration: number;
    avgLatency: number;
  }> {
    const startTime = Date.now();
    let totalRequests = 0;
    let successes = 0;
    let failures = 0;
    const phaseLatencies: number[] = [];

    while (Date.now() - startTime < config.sustainDuration) {
      const currentLoad = config.concurrentUsers;
      const targetRate = config.requestsPerSecond;

      const batchResult = await this.executeBatch(
        currentLoad,
        targetRate,
        executor
      );
      totalRequests += batchResult.total;
      successes += batchResult.successes;
      failures += batchResult.failures;
      phaseLatencies.push(...batchResult.latencies);

      await this.sleep(100);
    }

    return {
      requests: totalRequests,
      successes,
      failures,
      duration: config.sustainDuration,
      avgLatency:
        phaseLatencies.length > 0
          ? phaseLatencies.reduce((a, b) => a + b, 0) / phaseLatencies.length
          : 0,
    };
  }

  /**
   * Execute ramp down phase
   */
  private async executeRampDown(
    config: LoadTestConfig,
    executor: LoadTestExecutor
  ): Promise<{
    requests: number;
    successes: number;
    failures: number;
    duration: number;
    avgLatency: number;
  }> {
    const startTime = Date.now();
    const rampUpStart = config.rampUpDuration + config.sustainDuration;
    let totalRequests = 0;
    let successes = 0;
    let failures = 0;
    const phaseLatencies: number[] = [];

    while (Date.now() - startTime < config.rampDownDuration) {
      const totalElapsed = Date.now() - startTime + rampUpStart;
      const currentLoad = this.strategy.getCurrentLoad(totalElapsed, config);
      const targetRate = this.calculateTargetRate(
        config,
        Date.now() - startTime,
        config.rampDownDuration,
        true
      );

      const batchResult = await this.executeBatch(
        currentLoad,
        targetRate,
        executor
      );
      totalRequests += batchResult.total;
      successes += batchResult.successes;
      failures += batchResult.failures;
      phaseLatencies.push(...batchResult.latencies);

      await this.sleep(100);
    }

    return {
      requests: totalRequests,
      successes,
      failures,
      duration: config.rampDownDuration,
      avgLatency:
        phaseLatencies.length > 0
          ? phaseLatencies.reduce((a, b) => a + b, 0) / phaseLatencies.length
          : 0,
    };
  }

  /**
   * Execute a batch of requests
   */
  private async executeBatch(
    load: number,
    targetRate: number,
    executor: LoadTestExecutor
  ): Promise<{
    total: number;
    successes: number;
    failures: number;
    latencies: number[];
  }> {
    const batchSize = Math.max(1, Math.floor(load / 10)); // Distribute load across 10 intervals per second
    const batchLatencies: number[] = [];
    let successes = 0;
    let failures = 0;

    const promises: Promise<void>[] = [];

    for (let i = 0; i < batchSize; i++) {
      promises.push(
        (async () => {
          const request = this.generateRequest(i);
          const startTime = performance.now();

          try {
            const result = await executor.execute(request);
            const latency = performance.now() - startTime;

            this.latencySamples.push(latency);
            batchLatencies.push(latency);

            if (result.success) {
              successes++;
            } else {
              failures++;
              this.recordError(
                request,
                result.error ?? "Unknown error",
                latency
              );
            }
          } catch (error) {
            failures++;
            this.recordError(
              request,
              error instanceof Error ? error.message : String(error),
              0
            );
          }
        })()
      );
    }

    await Promise.all(promises);

    return {
      total: batchSize,
      successes,
      failures,
      latencies: batchLatencies,
    };
  }

  /**
   * Generate a test request
   */
  private generateRequest(id: number): TestRequest {
    return {
      id: `req-${Date.now()}-${id}`,
      type: "test",
      payload: { test: true },
      timestamp: Date.now(),
      timeout: 30000,
    };
  }

  /**
   * Record an error sample
   */
  private recordError(
    request: TestRequest,
    error: string,
    latency: number
  ): void {
    this.errorSamples.push({
      error,
      timestamp: Date.now(),
      latency,
      request,
    });
  }

  /**
   * Calculate target rate for current phase
   */
  private calculateTargetRate(
    config: LoadTestConfig,
    elapsed: number,
    phaseDuration: number,
    rampDown = false
  ): number {
    const progress = Math.min(1, elapsed / phaseDuration);
    if (rampDown) {
      return config.requestsPerSecond * (1 - progress);
    }
    return config.requestsPerSecond * progress;
  }

  /**
   * Calculate latency metrics
   */
  private calculateLatencyMetrics(): LatencyMetrics {
    if (this.latencySamples.length === 0) {
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

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const len = sorted.length;

    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / len;

    const variance =
      sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / len;
    const stddev = Math.sqrt(variance);

    const percentile = (p: number) => {
      const idx = Math.ceil((p / 100) * len) - 1;
      return sorted[Math.max(0, idx)];
    };

    return {
      min: sorted[0],
      max: sorted[len - 1],
      mean,
      median: sorted[Math.floor(len / 2)],
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      p999: percentile(99.9),
      stddev,
    };
  }

  /**
   * Calculate throughput
   */
  private calculateThroughput(duration: number): number {
    if (duration === 0) return 0;
    return (this.latencySamples.length / duration) * 1000;
  }

  /**
   * Aggregate errors
   */
  private aggregateErrors(): ErrorStats {
    const byType: Record<string, number> = {};
    const byCode: Record<string, number> = {};

    for (const sample of this.errorSamples) {
      byType[sample.error] = (byType[sample.error] || 0) + 1;
      const code = this.extractErrorCode(sample.error);
      byCode[code] = (byCode[code] || 0) + 1;
    }

    return {
      total: this.errorSamples.length,
      byType,
      byCode,
      samples: this.errorSamples.slice(0, 100), // Limit samples
    };
  }

  /**
   * Extract error code from error message
   */
  private extractErrorCode(error: string): string {
    const match = error.match(/\[([A-Z_]+)\]/);
    return match ? match[1] : "UNKNOWN";
  }

  /**
   * Aggregate resource usage
   */
  private aggregateResourceUsage(): ResourceMetrics {
    if (this.resourceSamples.length === 0) {
      return {
        cpu: { usage: 0, load: [], cores: 0 },
        memory: { used: 0, free: 0, total: 0, percentage: 0 },
      };
    }

    // Aggregate samples (simplified - in real implementation would be more sophisticated)
    const latest = this.resourceSamples[this.resourceSamples.length - 1];
    return latest;
  }

  /**
   * Reset test state
   */
  private reset(): void {
    this.latencySamples = [];
    this.errorSamples = [];
    this.resourceSamples = [];
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set ramp strategy
   */
  setStrategy(strategy: RampStrategy): void {
    this.strategy = strategy;
  }

  /**
   * Get current statistics (for monitoring during test)
   */
  getCurrentStats(): {
    requests: number;
    errors: number;
    avgLatency: number;
    p95Latency: number;
  } {
    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const avg =
      sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
    const p95 =
      sorted.length > 0 ? sorted[Math.ceil(sorted.length * 0.95) - 1] : 0;

    return {
      requests: this.latencySamples.length,
      errors: this.errorSamples.length,
      avgLatency: avg,
      p95Latency: p95,
    };
  }
}
