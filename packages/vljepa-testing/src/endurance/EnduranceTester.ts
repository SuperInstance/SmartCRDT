/**
 * EnduranceTester - Long-running stability and memory leak testing
 * Runs tests for extended periods to detect issues that only appear over time.
 */

import type {
  EnduranceTestConfig,
  EnduranceTestResult,
  EnduranceSample,
  MemoryLeak,
  TestRequest,
} from "../types.js";
import { MemoryLeakDetector } from "./MemoryLeakDetector.js";
import { StabilityTester } from "./StabilityTester.js";

export interface EnduranceTestExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
  healthCheck(): Promise<boolean>;
  getMetrics(): Promise<{ memory: number; cpu: number }>;
}

export class EnduranceTester {
  private samples: EnduranceSample[] = [];
  private leakDetector: MemoryLeakDetector;
  private stabilityTester: StabilityTester;
  private cancelRequested = false;

  constructor() {
    this.leakDetector = new MemoryLeakDetector({
      sampleInterval: 10000,
      thresholdMB: 100,
      growthRateThreshold: 10,
    });

    this.stabilityTester = new StabilityTester();
  }

  /**
   * Execute endurance test
   */
  async execute(
    config: EnduranceTestConfig,
    executor: EnduranceTestExecutor
  ): Promise<EnduranceTestResult> {
    const startTime = Date.now();
    this.cancelRequested = false;
    this.samples = [];

    // Start memory leak detection
    this.leakDetector.start();

    // Collect samples throughout the test
    const sampleInterval = setInterval(async () => {
      if (this.cancelRequested) {
        clearInterval(sampleInterval);
        return;
      }

      const sample = await this.captureSample(config, executor);
      this.samples.push(sample);
    }, config.sampleInterval);

    // Run stability test
    const stabilityConfig = {
      duration: config.duration,
      sampleInterval: config.sampleInterval,
      driftThreshold: config.degradationThreshold / 100,
      varianceThreshold: 0.5,
      healthCheckInterval: 60000,
    };

    const stabilityResult = await this.stabilityTester.execute(
      stabilityConfig,
      executor
    );

    // Stop sampling and memory detection
    clearInterval(sampleInterval);
    this.leakDetector.stop();

    // Analyze for memory leaks
    const leakResult = this.leakDetector.analyze();
    const memoryLeaks: MemoryLeak[] = [];

    if (leakResult.hasLeak) {
      memoryLeaks.push({
        detected: true,
        leakRate: leakResult.leakRate,
        estimatedLeak: leakResult.estimatedLeak,
        confidence: leakResult.confidence,
        location: leakResult.leakLocation,
      });
    }

    // Calculate overall metrics
    const duration = Date.now() - startTime;
    const degradation = this.calculateDegradation();
    const stable = this.isStable(config);

    const endTime = Date.now();

    return {
      success: true,
      duration,
      timestamp: startTime,
      samples: this.samples,
      memoryLeaks,
      stable,
      degradation,
      stabilityScore: stabilityResult.stabilityScore,
      recommendation: this.generateRecommendation(
        stable,
        memoryLeaks,
        degradation,
        stabilityResult
      ),
      trends: stabilityResult.trends,
    };
  }

  /**
   * Capture a performance sample
   */
  private async captureSample(
    config: EnduranceTestConfig,
    executor: EnduranceTestExecutor
  ): Promise<EnduranceSample> {
    const requestCount = Math.max(5, Math.floor(config.loadLevel / 10));
    const latencies: number[] = [];
    let errors = 0;
    let successes = 0;

    // Execute sample requests
    const promises: Promise<void>[] = [];

    for (let i = 0; i < requestCount; i++) {
      promises.push(
        (async () => {
          const request = this.generateRequest(i);
          const start = performance.now();

          try {
            const result = await executor.execute(request);
            const latency = performance.now() - start;
            latencies.push(latency);

            if (result.success) {
              successes++;
            } else {
              errors++;
            }
          } catch {
            errors++;
          }
        })()
      );
    }

    await Promise.all(promises);

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
      throughput: successes / (config.sampleInterval / 1000 || 1),
      memory: metrics.memory,
      cpu: metrics.cpu,
      errors,
    };
  }

  /**
   * Calculate performance degradation
   */
  private calculateDegradation(): number {
    if (this.samples.length < 20) return 0;

    // Compare first 10% with last 10% of samples
    const firstChunk = this.samples.slice(
      0,
      Math.floor(this.samples.length * 0.1)
    );
    const lastChunk = this.samples.slice(
      -Math.floor(this.samples.length * 0.1)
    );

    const firstAvgLatency =
      firstChunk.reduce((sum, s) => sum + s.latency.mean, 0) /
      firstChunk.length;
    const lastAvgLatency =
      lastChunk.reduce((sum, s) => sum + s.latency.mean, 0) / lastChunk.length;

    if (firstAvgLatency === 0) return 0;

    return ((lastAvgLatency - firstAvgLatency) / firstAvgLatency) * 100; // Percentage
  }

  /**
   * Determine if system is stable
   */
  private isStable(config: EnduranceTestConfig): boolean {
    const degradation = this.calculateDegradation();
    const leakResult = this.leakDetector.analyze();

    // Stable if:
    // 1. Degradation within threshold
    // 2. No memory leaks
    // 3. Error rate not increasing

    const degradationStable = degradation <= config.degradationThreshold;
    const memoryStable = !leakResult.hasLeak || leakResult.confidence < 0.5;

    // Check error rate trend
    const errorRateStable = this.isErrorRateStable();

    return degradationStable && memoryStable && errorRateStable;
  }

  /**
   * Check if error rate is stable
   */
  private isErrorRateStable(): boolean {
    if (this.samples.length < 20) return true;

    const firstChunk = this.samples.slice(
      0,
      Math.floor(this.samples.length * 0.1)
    );
    const lastChunk = this.samples.slice(
      -Math.floor(this.samples.length * 0.1)
    );

    const firstAvgErrors =
      firstChunk.reduce((sum, s) => sum + s.errors, 0) / firstChunk.length;
    const lastAvgErrors =
      lastChunk.reduce((sum, s) => sum + s.errors, 0) / lastChunk.length;

    // Error rate should not increase by more than 50%
    return lastAvgErrors <= firstAvgErrors * 1.5;
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    stable: boolean,
    memoryLeaks: MemoryLeak[],
    degradation: number,
    stabilityResult: { stabilityScore: number; recommendations: string[] }
  ): string {
    if (stable) {
      return `PASSED: System is stable for endurance testing. Stability score: ${stabilityResult.stabilityScore.toFixed(2)}. Ready for long-running deployments.`;
    }

    const issues: string[] = [];

    if (memoryLeaks.length > 0 && memoryLeaks[0].detected) {
      issues.push(
        `memory leak detected (${memoryLeaks[0].leakRate.toFixed(2)} MB/hour)`
      );
    }

    if (degradation > 20) {
      issues.push(
        `significant performance degradation (${degradation.toFixed(1)}%)`
      );
    } else if (degradation > 10) {
      issues.push(
        `moderate performance degradation (${degradation.toFixed(1)}%)`
      );
    }

    if (issues.length === 0) {
      issues.push("stability concerns");
    }

    const mainRecommendation = `FAILED: System has ${issues.join(" and ")}. `;

    // Add specific recommendations
    const specificRecommendations: string[] = [];

    if (memoryLeaks.some(m => m.detected)) {
      specificRecommendations.push(
        "- Investigate memory management and fix leaks"
      );
    }

    if (degradation > 10) {
      specificRecommendations.push(
        "- Optimize resource usage to prevent degradation"
      );
    }

    if (stabilityResult.recommendations.length > 0) {
      specificRecommendations.push(
        ...stabilityResult.recommendations.map(r => `- ${r}`)
      );
    }

    return mainRecommendation + "\n" + specificRecommendations.join("\n");
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
      id: `endurance-req-${Date.now()}-${id}`,
      type: "endurance_test",
      payload: { endurance: true },
      timestamp: Date.now(),
      timeout: 30000,
    };
  }

  /**
   * Cancel the running test
   */
  cancel(): void {
    this.cancelRequested = true;
    this.leakDetector.stop();
  }

  /**
   * Get current progress
   */
  getProgress(config: EnduranceTestConfig): {
    elapsed: number;
    remaining: number;
    progress: number;
    sampleCount: number;
  } {
    const now = Date.now();
    const elapsed =
      now - (this.samples.length > 0 ? this.samples[0].timestamp : now);
    const remaining = Math.max(0, config.duration - elapsed);
    const progress = Math.min(1, elapsed / config.duration);

    return {
      elapsed,
      remaining,
      progress,
      sampleCount: this.samples.length,
    };
  }

  /**
   * Get memory leak detector for external access
   */
  getMemoryLeakDetector(): MemoryLeakDetector {
    return this.leakDetector;
  }

  /**
   * Get all samples collected so far
   */
  getSamples(): EnduranceSample[] {
    return [...this.samples];
  }
}
