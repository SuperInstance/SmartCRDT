/**
 * ThroughputTester - Measure and analyze system throughput
 * Tests request processing capacity under various conditions.
 */

import type { TestRequest, PerformanceMetrics } from "../types.js";

export interface ThroughputTestConfig {
  duration: number;
  requestSizes: number[];
  concurrentRequests: number;
  timeout: number;
}

export interface ThroughputTestResult {
  maxThroughput: number;
  sustainedThroughput: number;
  burstThroughput: number;
  throughputBySize: ThroughputBySize[];
  latencyVsThroughput: LatencyThroughputPoint[];
  optimalConcurrency: number;
  bottleneck: string;
}

export interface ThroughputBySize {
  size: number;
  throughput: number;
  avgLatency: number;
}

export interface LatencyThroughputPoint {
  throughput: number;
  latency: number;
  concurrency: number;
}

export interface ThroughputTestExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
  getCurrentConcurrency(): Promise<number>;
}

export class ThroughputTester {
  /**
   * Execute throughput test
   */
  async execute(
    config: ThroughputTestConfig,
    executor: ThroughputTestExecutor
  ): Promise<ThroughputTestResult> {
    // Test different request sizes
    const throughputBySize = await this.testBySize(config, executor);

    // Test latency vs throughput
    const latencyVsThroughput = await this.testLatencyVsThroughput(
      config,
      executor
    );

    // Find maximum throughput
    const maxThroughput = this.findMaxThroughput(latencyVsThroughput);

    // Test sustained throughput
    const sustainedThroughput = await this.testSustainedThroughput(
      config,
      executor
    );

    // Test burst throughput
    const burstThroughput = await this.testBurstThroughput(config, executor);

    // Find optimal concurrency
    const optimalConcurrency = this.findOptimalConcurrency(latencyVsThroughput);

    // Identify bottleneck
    const bottleneck = this.identifyBottleneck(
      latencyVsThroughput,
      throughputBySize
    );

    return {
      maxThroughput,
      sustainedThroughput,
      burstThroughput,
      throughputBySize,
      latencyVsThroughput,
      optimalConcurrency,
      bottleneck,
    };
  }

  /**
   * Test throughput by request size
   */
  private async testBySize(
    config: ThroughputTestConfig,
    executor: ThroughputTestExecutor
  ): Promise<ThroughputBySize[]> {
    const results: ThroughputBySize[] = [];

    for (const size of config.requestSizes) {
      const requestCount = 100;
      const startTime = Date.now();
      const latencies: number[] = [];
      let successes = 0;

      const promises: Promise<void>[] = [];

      for (let i = 0; i < requestCount; i++) {
        promises.push(
          (async () => {
            const request = this.generateRequest(i, size);
            const start = performance.now();

            try {
              const result = await executor.execute(request);
              const latency = performance.now() - start;
              latencies.push(latency);

              if (result.success) {
                successes++;
              }
            } catch {
              // Ignore errors
            }
          })()
        );
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      const throughput = successes / (duration / 1000);
      const avgLatency =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;

      results.push({
        size,
        throughput,
        avgLatency,
      });
    }

    return results;
  }

  /**
   * Test latency vs throughput curve
   */
  private async testLatencyVsThroughput(
    config: ThroughputTestConfig,
    executor: ThroughputTestExecutor
  ): Promise<LatencyThroughputPoint[]> {
    const points: LatencyThroughputPoint[] = [];
    const concurrencies = [1, 2, 5, 10, 20, 50, 100];

    for (const concurrency of concurrencies) {
      const duration = 5000; // 5 seconds per test
      const startTime = Date.now();
      const latencies: number[] = [];
      let successes = 0;

      while (Date.now() - startTime < duration) {
        const promises: Promise<void>[] = [];

        for (let i = 0; i < concurrency; i++) {
          promises.push(
            (async () => {
              const request = this.generateRequest(i, 1000);
              const start = performance.now();

              try {
                const result = await executor.execute(request);
                const latency = performance.now() - start;
                latencies.push(latency);

                if (result.success) {
                  successes++;
                }
              } catch {
                // Ignore errors
              }
            })()
          );
        }

        await Promise.all(promises);
        await this.sleep(100);
      }

      const elapsed = Date.now() - startTime;
      const throughput = successes / (elapsed / 1000);
      const avgLatency =
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0;

      points.push({
        throughput,
        latency: avgLatency,
        concurrency,
      });
    }

    return points;
  }

  /**
   * Test sustained throughput
   */
  private async testSustainedThroughput(
    config: ThroughputTestConfig,
    executor: ThroughputTestExecutor
  ): Promise<number> {
    const duration = 30000; // 30 seconds
    const startTime = Date.now();
    let totalSuccesses = 0;

    while (Date.now() - startTime < duration) {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < config.concurrentRequests; i++) {
        promises.push(
          (async () => {
            const request = this.generateRequest(i, 1000);

            try {
              const result = await executor.execute(request);
              if (result.success) {
                totalSuccesses++;
              }
            } catch {
              // Ignore errors
            }
          })()
        );
      }

      await Promise.all(promises);
      await this.sleep(100);
    }

    return totalSuccesses / (duration / 1000);
  }

  /**
   * Test burst throughput
   */
  private async testBurstThroughput(
    config: ThroughputTestConfig,
    executor: ThroughputTestExecutor
  ): Promise<number> {
    const burstDuration = 5000; // 5 seconds
    const highConcurrency = config.concurrentRequests * 5;
    const startTime = Date.now();
    let totalSuccesses = 0;

    while (Date.now() - startTime < burstDuration) {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < highConcurrency; i++) {
        promises.push(
          (async () => {
            const request = this.generateRequest(i, 1000);

            try {
              const result = await executor.execute(request);
              if (result.success) {
                totalSuccesses++;
              }
            } catch {
              // Ignore errors
            }
          })()
        );
      }

      await Promise.all(promises);
      await this.sleep(100);
    }

    return totalSuccesses / (burstDuration / 1000);
  }

  /**
   * Find maximum throughput
   */
  private findMaxThroughput(points: LatencyThroughputPoint[]): number {
    if (points.length === 0) return 0;

    // Find maximum throughput before latency degrades significantly
    let maxThroughput = 0;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      // Consider throughput valid if latency is reasonable
      if (point.latency < 1000) {
        maxThroughput = Math.max(maxThroughput, point.throughput);
      }
    }

    return maxThroughput;
  }

  /**
   * Find optimal concurrency
   */
  private findOptimalConcurrency(points: LatencyThroughputPoint[]): number {
    if (points.length === 0) return 1;

    // Find concurrency with best throughput/latency ratio
    let bestConcurrency = 1;
    let bestScore = 0;

    for (const point of points) {
      // Score = throughput / latency (higher is better)
      const score = point.throughput / (point.latency || 1);

      if (score > bestScore) {
        bestScore = score;
        bestConcurrency = point.concurrency;
      }
    }

    return bestConcurrency;
  }

  /**
   * Identify bottleneck
   */
  private identifyBottleneck(
    latencyPoints: LatencyThroughputPoint[],
    sizeResults: ThroughputBySize[]
  ): string {
    // Check if latency increases disproportionately with concurrency
    if (latencyPoints.length < 2) return "unknown";

    const first = latencyPoints[0];
    const last = latencyPoints[latencyPoints.length - 1];

    const concurrencyRatio = last.concurrency / first.concurrency;
    const latencyRatio = last.latency / (first.latency || 1);

    if (latencyRatio > concurrencyRatio * 2) {
      return "contention"; // Lock contention, connection pool, etc.
    }

    // Check if throughput increases with size
    if (sizeResults.length >= 2) {
      const smallSize = sizeResults[0];
      const largeSize = sizeResults[sizeResults.length - 1];

      if (largeSize.throughput < smallSize.throughput * 0.5) {
        return "bandwidth"; // Network/disk bandwidth
      }
    }

    return "cpu"; // Default to CPU
  }

  /**
   * Generate a test request
   */
  private generateRequest(id: number, size: number): TestRequest {
    return {
      id: `throughput-req-${Date.now()}-${id}`,
      type: "throughput_test",
      payload: { size, data: "x".repeat(size) },
      timestamp: Date.now(),
      timeout: 30000,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
