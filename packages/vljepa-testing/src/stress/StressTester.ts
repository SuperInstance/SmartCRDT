/**
 * StressTester - Find the breaking point of the system
 * Tests beyond normal capacity to determine limits and recovery behavior.
 */

import type {
  StressTestConfig,
  StressTestResult,
  LoadPoint,
  PerformancePoint,
  TestRequest,
} from "../types.js";

export interface StressTestExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
  healthCheck(): Promise<boolean>;
}

export class StressTester {
  private latencySamples: number[] = [];
  private errorSamples: { error: string; timestamp: number; load: number }[] =
    [];
  private performanceCurve: PerformancePoint[] = [];

  /**
   * Execute a stress test to find the breaking point
   */
  async execute(
    config: StressTestConfig,
    executor: StressTestExecutor
  ): Promise<StressTestResult> {
    const startTime = Date.now();
    this.reset();

    // Find breaking point through incremental load testing
    const breakingResult = await this.findBreakingPoint(config, executor);

    // Test spike handling
    const spikeResult = await this.testSpike(config, executor);

    // Test recovery if system broke
    let recovered = false;
    let recoveryTime = 0;
    if (config.recoveryCheck && breakingResult.breakingPoint > 0) {
      const recoveryResult = await this.testRecovery(
        config,
        executor,
        breakingResult.breakingPoint
      );
      recovered = recoveryResult.recovered;
      recoveryTime = recoveryResult.recoveryTime;
    }

    const endTime = Date.now();

    return {
      success: true,
      duration: endTime - startTime,
      timestamp: startTime,
      breakingPoint: breakingResult.breakingPoint,
      breakingLatency: breakingResult.breakingLatency,
      failureMode: breakingResult.failureMode,
      recovered,
      recoveryTime,
      spikeSurvived: spikeResult,
      loadPoints: breakingResult.loadPoints,
      degradationCurve: this.performanceCurve,
    };
  }

  /**
   * Incrementally increase load until system fails
   */
  private async findBreakingPoint(
    config: StressTestConfig,
    executor: StressTestExecutor
  ): Promise<{
    breakingPoint: number;
    breakingLatency: number;
    failureMode: string;
    loadPoints: LoadPoint[];
  }> {
    const loadPoints: LoadPoint[] = [];
    let currentLoad = config.loadIncrement;
    let breakingPoint = 0;
    let breakingLatency = 0;
    let failureMode = "";

    while (currentLoad <= config.maxLoad) {
      const point = await this.testLoadPoint(currentLoad, config, executor);
      loadPoints.push(point);

      // Check if system is failing
      const isFailing = this.isSystemFailing(point);

      if (isFailing && breakingPoint === 0) {
        breakingPoint = currentLoad;
        breakingLatency = point.p95Latency;
        failureMode = this.classifyFailure(point);
        break;
      }

      // Check health
      const healthy = await executor.healthCheck().catch(() => false);
      if (!healthy && breakingPoint === 0) {
        breakingPoint = currentLoad;
        breakingLatency = point.p95Latency;
        failureMode = "HEALTH_CHECK_FAILED";
        break;
      }

      currentLoad += config.loadIncrement;

      // Wait before next increment
      await this.sleep(config.incrementInterval);
    }

    // If we never broke, mark max load as breaking point
    if (breakingPoint === 0) {
      breakingPoint = config.maxLoad;
      breakingLatency = loadPoints[loadPoints.length - 1]?.p95Latency ?? 0;
      failureMode = "MAX_LOAD_REACHED";
    }

    return { breakingPoint, breakingLatency, failureMode, loadPoints };
  }

  /**
   * Test a specific load point
   */
  private async testLoadPoint(
    load: number,
    config: StressTestConfig,
    executor: StressTestExecutor
  ): Promise<LoadPoint> {
    const duration = config.incrementInterval;
    const startTime = Date.now();
    const latencies: number[] = [];
    let successes = 0;
    let failures = 0;

    while (Date.now() - startTime < duration) {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < Math.min(load, 100); i++) {
        promises.push(
          (async () => {
            const request = this.generateRequest(i);
            const testStart = performance.now();

            try {
              const result = await executor.execute(request);
              const latency = performance.now() - testStart;
              latencies.push(latency);

              if (result.success) {
                successes++;
              } else {
                failures++;
                this.errorSamples.push({
                  error: result.error ?? "Unknown error",
                  timestamp: Date.now(),
                  load,
                });
              }
            } catch {
              failures++;
            }
          })()
        );
      }

      await Promise.all(promises);
      await this.sleep(100);
    }

    const sorted = latencies.sort((a, b) => a - b);

    const point: LoadPoint = {
      load,
      requests: successes + failures,
      successes,
      failures,
      avgLatency:
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
      p95Latency: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      errorRate:
        successes + failures > 0 ? failures / (successes + failures) : 0,
    };

    // Record performance curve point
    this.performanceCurve.push({
      load,
      throughput: point.requests / (duration / 1000),
      latency: point.avgLatency,
      resourceUsage: 0, // Would be populated by actual monitoring
      timestamp: startTime,
    });

    return point;
  }

  /**
   * Test spike handling
   */
  private async testSpike(
    config: StressTestConfig,
    executor: StressTestExecutor
  ): Promise<boolean> {
    const baselineLoad = Math.floor(config.maxLoad * 0.5);
    const spikeLoad = Math.floor(baselineLoad * config.spikeMagnitude);

    // Establish baseline
    await this.testLoadPoint(baselineLoad, config, executor);

    // Apply spike
    const spikeStart = Date.now();
    const spikeResult = await this.testLoadPoint(spikeLoad, config, executor);

    // Check if spike was handled
    const survived = spikeResult.errorRate < 0.5; // Less than 50% errors during spike

    // Check recovery after spike
    await this.sleep(config.spikeDuration);
    const recoveryResult = await this.testLoadPoint(
      baselineLoad,
      config,
      executor
    );

    return survived && recoveryResult.errorRate < spikeResult.errorRate;
  }

  /**
   * Test system recovery after failure
   */
  private async testRecovery(
    config: StressTestConfig,
    executor: StressTestExecutor,
    breakingLoad: number
  ): Promise<{ recovered: boolean; recoveryTime: number }> {
    const safeLoad = Math.floor(breakingLoad * 0.5);
    const startTime = Date.now();
    const maxWaitTime = 60000; // 1 minute max

    while (Date.now() - startTime < maxWaitTime) {
      await this.sleep(5000); // Wait 5 seconds between checks

      const point = await this.testLoadPoint(safeLoad, config, executor);
      const healthy = await executor.healthCheck().catch(() => false);

      if (point.errorRate < 0.05 && healthy) {
        return {
          recovered: true,
          recoveryTime: Date.now() - startTime,
        };
      }
    }

    return {
      recovered: false,
      recoveryTime: maxWaitTime,
    };
  }

  /**
   * Determine if system is failing based on metrics
   */
  private isSystemFailing(point: LoadPoint): boolean {
    // Consider system failing if:
    // 1. Error rate > 50%
    // 2. P95 latency > 10 seconds
    // 3. Success rate < 50%
    return (
      point.errorRate > 0.5 ||
      point.p95Latency > 10000 ||
      (point.requests > 0 && point.successes / point.requests < 0.5)
    );
  }

  /**
   * Classify the failure mode
   */
  private classifyFailure(point: LoadPoint): string {
    if (point.errorRate > 0.8) {
      return "CATASTROPHIC_FAILURE";
    }
    if (point.errorRate > 0.5) {
      return "HIGH_ERROR_RATE";
    }
    if (point.p95Latency > 30000) {
      return "TIMEOUT_FAILURE";
    }
    if (point.p95Latency > 10000) {
      return "HIGH_LATENCY";
    }
    return "DEGRADED_PERFORMANCE";
  }

  /**
   * Generate a test request
   */
  private generateRequest(id: number): TestRequest {
    return {
      id: `stress-req-${Date.now()}-${id}`,
      type: "stress_test",
      payload: { stress: true },
      timestamp: Date.now(),
      timeout: 30000,
    };
  }

  /**
   * Reset test state
   */
  private reset(): void {
    this.latencySamples = [];
    this.errorSamples = [];
    this.performanceCurve = [];
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
