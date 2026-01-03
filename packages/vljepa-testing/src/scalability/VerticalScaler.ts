/**
 * VerticalScaler - Test vertical scaling (increasing resources per instance)
 * Measures performance gains from adding CPU, memory, etc.
 */

import type {
  TestRequest,
  PerformanceMetrics,
  ResourceLimits,
} from "../types.js";

export interface VerticalScaleConfig {
  baselineResources: ResourceLimits;
  maxResources: ResourceLimits;
  scaleSteps: number;
  measureDuration: number;
  stabilizeTime: number;
}

export interface VerticalScaleResult {
  baseline: PerformanceMetrics;
  scaled: ResourceScalePoint[];
  optimalResources: ResourceLimits;
  scalability: "linear" | "sublinear" | "plateau" | "diminishing";
  costEfficiency: number;
  recommendation: string;
}

export interface ResourceScalePoint {
  resources: ResourceLimits;
  metrics: PerformanceMetrics;
  improvement: number;
  efficiency: number;
}

export interface VerticalScaleExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
  setResources(resources: ResourceLimits): Promise<boolean>;
  getCurrentResources(): Promise<ResourceLimits>;
}

export class VerticalScaler {
  /**
   * Execute vertical scaling test
   */
  async execute(
    config: VerticalScaleConfig,
    executor: VerticalScaleExecutor
  ): Promise<VerticalScaleResult> {
    // Measure baseline
    await executor.setResources(config.baselineResources);
    await this.sleep(config.stabilizeTime);

    const baseline = await this.measurePerformance(config, executor);
    const scaled: ResourceScalePoint[] = [];

    // Scale through each step
    for (let step = 1; step <= config.scaleSteps; step++) {
      const resources = this.calculateResources(config, step);

      const scaleSuccess = await executor.setResources(resources);
      if (!scaleSuccess) {
        break;
      }

      // Wait for stabilization
      await this.sleep(config.stabilizeTime);

      // Measure performance
      const metrics = await this.measurePerformance(config, executor);
      const improvement = this.calculateImprovement(baseline, metrics);
      const efficiency = this.calculateEfficiency(resources, metrics);

      scaled.push({
        resources,
        metrics,
        improvement,
        efficiency,
      });
    }

    // Analyze scalability
    const scalability = this.analyzeScalability(scaled);

    // Find optimal resources
    const optimalResources = this.findOptimalResources(scaled);

    // Calculate cost efficiency
    const costEfficiency = this.calculateCostEfficiency(scaled);

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      scalability,
      optimalResources,
      scaled
    );

    return {
      baseline,
      scaled,
      optimalResources,
      scalability,
      costEfficiency,
      recommendation,
    };
  }

  /**
   * Calculate resources for a scaling step
   */
  private calculateResources(
    config: VerticalScaleConfig,
    step: number
  ): ResourceLimits {
    const progress = step / config.scaleSteps;

    return {
      cpu: Math.floor(
        config.baselineResources.cpu +
          (config.maxResources.cpu - config.baselineResources.cpu) * progress
      ),
      memory: Math.floor(
        config.baselineResources.memory +
          (config.maxResources.memory - config.baselineResources.memory) *
            progress
      ),
      disk: config.maxResources.disk,
      network: config.maxResources.network,
    };
  }

  /**
   * Measure performance at current resource level
   */
  private async measurePerformance(
    config: VerticalScaleConfig,
    executor: VerticalScaleExecutor
  ): Promise<PerformanceMetrics> {
    const startTime = Date.now();
    const latencies: number[] = [];
    let successes = 0;
    let failures = 0;
    const requestCount = 50;

    while (Date.now() - startTime < config.measureDuration) {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < Math.min(requestCount, 20); i++) {
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
                failures++;
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
    const resources = await executor.getCurrentResources();

    return {
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
      throughput: successes / (config.measureDuration / 1000),
      resourceUsage: {
        cpu: { usage: 0, load: [], cores: resources.cpu },
        memory: { used: 0, free: 0, total: resources.memory, percentage: 0 },
      },
      timestamp: startTime,
    };
  }

  /**
   * Calculate improvement over baseline
   */
  private calculateImprovement(
    baseline: PerformanceMetrics,
    current: PerformanceMetrics
  ): number {
    const baselineLatency = baseline.latency.mean || 1;
    const currentLatency = current.latency.mean || baselineLatency;

    return ((baselineLatency - currentLatency) / baselineLatency) * 100;
  }

  /**
   * Calculate efficiency (throughput per resource unit)
   */
  private calculateEfficiency(
    resources: ResourceLimits,
    metrics: PerformanceMetrics
  ): number {
    const resourceScore = resources.cpu * (resources.memory / 1_000_000_000);
    return resourceScore > 0 ? metrics.throughput / resourceScore : 0;
  }

  /**
   * Analyze scalability pattern
   */
  private analyzeScalability(
    scaled: ResourceScalePoint[]
  ): "linear" | "sublinear" | "plateau" | "diminishing" {
    if (scaled.length < 2) return "linear";

    const improvements = scaled.map(p => p.improvement);

    // Check for plateau (no improvement in last steps)
    const lastTwo = improvements.slice(-2);
    if (lastTwo.length === 2 && Math.abs(lastTwo[1] - lastTwo[0]) < 5) {
      return "plateau";
    }

    // Check for diminishing returns (each step gives less improvement)
    let diminishingCount = 0;
    for (let i = 1; i < improvements.length; i++) {
      if (improvements[i] < improvements[i - 1] * 0.8) {
        diminishingCount++;
      }
    }

    if (diminishingCount >= improvements.length / 2) {
      return "diminishing";
    }

    // Check for sublinear (improvement < resource increase)
    const avgImprovement =
      improvements.reduce((a, b) => a + b, 0) / improvements.length;
    if (avgImprovement < 50) {
      // Less than 50% improvement over all steps
      return "sublinear";
    }

    return "linear";
  }

  /**
   * Find optimal resource configuration
   */
  private findOptimalResources(scaled: ResourceScalePoint[]): ResourceLimits {
    if (scaled.length === 0) {
      return { cpu: 1, memory: 1_000_000_000 };
    }

    // Find point with best efficiency
    let bestIdx = 0;
    let bestEfficiency = -1;

    for (let i = 0; i < scaled.length; i++) {
      if (scaled[i].efficiency > bestEfficiency) {
        bestEfficiency = scaled[i].efficiency;
        bestIdx = i;
      }
    }

    return scaled[bestIdx].resources;
  }

  /**
   * Calculate cost efficiency
   */
  private calculateCostEfficiency(scaled: ResourceScalePoint[]): number {
    if (scaled.length === 0) return 0;

    // Average efficiency normalized by resource cost
    const avgEfficiency =
      scaled.reduce((sum, p) => sum + p.efficiency, 0) / scaled.length;

    return avgEfficiency;
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    scalability: string,
    optimalResources: ResourceLimits,
    scaled: ResourceScalePoint[]
  ): string {
    const parts: string[] = [];

    switch (scalability) {
      case "linear":
        parts.push("EXCELLENT: System scales linearly with resources.");
        parts.push(
          `Recommend: ${optimalResources.cpu} CPUs, ${Math.round(optimalResources.memory / 1_000_000_000)}GB RAM`
        );
        break;
      case "sublinear":
        parts.push(
          "GOOD: System scales sublinearly. Benefits diminish with more resources."
        );
        parts.push(
          `Optimal: ${optimalResources.cpu} CPUs, ${Math.round(optimalResources.memory / 1_000_000_000)}GB RAM`
        );
        break;
      case "plateau":
        parts.push(
          "FAIR: System has hit a scaling plateau. Adding more resources provides little benefit."
        );
        parts.push(
          "Recommend: Investigate bottlenecks (I/O, network, locking) before scaling further."
        );
        break;
      case "diminishing":
        parts.push(
          "POOR: Diminishing returns. Each resource increase provides less benefit."
        );
        parts.push("Recommend: Consider horizontal scaling instead.");
        break;
    }

    // Add performance insights
    if (scaled.length > 0) {
      const bestPoint = scaled.reduce(
        (best, p) => (p.improvement > best.improvement ? p : best),
        scaled[0]
      );
      parts.push(
        `Best improvement: ${bestPoint.improvement.toFixed(1)}% latency reduction`
      );
    }

    return parts.join("\n");
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
      id: `vscale-req-${Date.now()}-${id}`,
      type: "vertical_scale_test",
      payload: { verticalScale: true },
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
