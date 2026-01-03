/**
 * ScaleTester - Test horizontal and vertical scaling
 * Measures how performance scales with resources.
 */

import type {
  ScaleTestConfig,
  ScaleTestResult,
  PerformanceMetrics,
  ScalabilityType,
  OptimalConfig,
  ScalingPoint,
  ResourceLimits,
  TestRequest,
} from "../types.js";

export interface ScaleTestExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
  scaleUp(type: "horizontal" | "vertical", amount: number): Promise<boolean>;
  scaleDown(type: "horizontal" | "vertical", amount: number): Promise<boolean>;
  getCurrentCapacity(): Promise<{
    instances: number;
    resources: ResourceLimits;
  }>;
  getCost(): Promise<number>;
}

export class ScaleTester {
  /**
   * Execute scaling test
   */
  async execute(
    config: ScaleTestConfig,
    executor: ScaleTestExecutor
  ): Promise<ScaleTestResult> {
    const startTime = Date.now();
    const scalingCurve: ScalingPoint[] = [];
    const scaled: PerformanceMetrics[] = [];

    // Get baseline
    const baseline = await this.measureBaseline(config, executor);
    const initialCapacity = await executor.getCurrentCapacity();

    // Perform scaling steps
    for (let step = 1; step <= config.scaleSteps; step++) {
      // Scale up or down
      const scaledSuccessfully = await this.performScaling(
        config,
        executor,
        step
      );

      if (!scaledSuccessfully) {
        break;
      }

      // Wait for scaling to take effect
      await this.sleep(config.stepDuration);

      // Measure performance at new scale
      const metrics = await this.measurePerformance(config, executor);
      const currentCapacity = await executor.getCurrentCapacity();

      scaled.push(metrics);

      // Calculate cost per request
      const cost = config.measureCost
        ? await executor.getCost().catch(() => 0)
        : 0;
      const costPerRequest = cost / (metrics.throughput || 1);

      // Calculate efficiency (throughput per resource unit)
      const efficiency = this.calculateEfficiency(
        metrics,
        currentCapacity,
        baseline
      );

      scalingCurve.push({
        configuration: step,
        throughput: metrics.throughput,
        latency: metrics.latency.mean,
        efficiency,
        costPerRequest,
      });
    }

    // Analyze scalability
    const scalability = this.analyzeScalability(scalingCurve);
    const scalingFactor = this.calculateScalingFactor(baseline, scaled);

    // Find optimal configuration
    const optimalConfig = await this.findOptimalConfig(
      config,
      executor,
      scalingCurve,
      baseline
    );

    // Calculate cost per request
    const costPerRequest = this.calculateAverageCostPerRequest(scalingCurve);

    const endTime = Date.now();

    return {
      success: true,
      duration: endTime - startTime,
      timestamp: startTime,
      baseline,
      scaled,
      scalability,
      scalingFactor,
      optimalConfig,
      costPerRequest,
      efficiency: optimalConfig.efficiency,
      scalingCurve,
    };
  }

  /**
   * Measure baseline performance
   */
  private async measureBaseline(
    config: ScaleTestConfig,
    executor: ScaleTestExecutor
  ): Promise<PerformanceMetrics> {
    return await this.measurePerformance(config, executor);
  }

  /**
   * Measure performance at current scale
   */
  private async measurePerformance(
    config: ScaleTestConfig,
    executor: ScaleTestExecutor
  ): Promise<PerformanceMetrics> {
    const duration = 10000; // 10 seconds measurement
    const startTime = Date.now();
    const latencies: number[] = [];
    let successes = 0;
    let failures = 0;

    while (Date.now() - startTime < duration) {
      const promises: Promise<void>[] = [];

      // Execute requests at baseline load
      for (let i = 0; i < Math.min(config.baselineLoad, 20); i++) {
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

    // Get current resource usage
    const capacity = await executor.getCurrentCapacity();

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
      throughput: successes / (duration / 1000),
      resourceUsage: {
        cpu: {
          usage: 0,
          load: [],
          cores: capacity.resources.cpu,
        },
        memory: {
          used: 0,
          free: 0,
          total: capacity.resources.memory,
          percentage: 0,
        },
      },
      timestamp: startTime,
    };
  }

  /**
   * Perform scaling step
   */
  private async performScaling(
    config: ScaleTestConfig,
    executor: ScaleTestExecutor,
    step: number
  ): Promise<boolean> {
    const scaleAmount = this.calculateScaleAmount(config, step);

    try {
      if (config.scaleDirection === "up") {
        return await executor.scaleUp(config.scaleType, scaleAmount);
      } else {
        return await executor.scaleDown(config.scaleType, scaleAmount);
      }
    } catch {
      return false;
    }
  }

  /**
   * Calculate scale amount for step
   */
  private calculateScaleAmount(config: ScaleTestConfig, step: number): number {
    if (config.scaleType === "horizontal") {
      // Add 1 instance per step
      return 1;
    } else {
      // Add 25% resources per step for vertical scaling
      return 0.25;
    }
  }

  /**
   * Calculate efficiency (throughput per resource unit)
   */
  private calculateEfficiency(
    metrics: PerformanceMetrics,
    capacity: { instances: number; resources: ResourceLimits },
    baseline: PerformanceMetrics
  ): number {
    // Calculate total resources
    const totalCPU = capacity.instances * capacity.resources.cpu;
    const totalMemory = capacity.instances * capacity.resources.memory;

    // Efficiency = throughput / (CPU * memory factor)
    const resourceScore = totalCPU * (totalMemory / 1_000_000_000); // Normalize memory to GB
    return resourceScore > 0 ? metrics.throughput / resourceScore : 0;
  }

  /**
   * Analyze scalability type
   */
  private analyzeScalability(curve: ScalingPoint[]): ScalabilityType {
    if (curve.length < 2) return "linear";

    // Calculate throughput scaling
    const first = curve[0];
    const last = curve[curve.length - 1];

    const throughputRatio = last.throughput / (first.throughput || 1);
    const configRatio = last.configuration / (first.configuration || 1);

    if (throughputRatio < configRatio * 0.5) {
      return "degrading";
    } else if (throughputRatio < configRatio * 0.8) {
      return "sublinear";
    } else if (throughputRatio > configRatio * 1.2) {
      return "superlinear";
    } else {
      return "linear";
    }
  }

  /**
   * Calculate scaling factor
   */
  private calculateScalingFactor(
    baseline: PerformanceMetrics,
    scaled: PerformanceMetrics[]
  ): number {
    if (scaled.length === 0) return 1;

    const last = scaled[scaled.length - 1];
    const baselineThroughput = baseline.throughput || 1;
    const scaledThroughput = last.throughput || baselineThroughput;

    return scaledThroughput / baselineThroughput;
  }

  /**
   * Find optimal configuration
   */
  private async findOptimalConfig(
    config: ScaleTestConfig,
    executor: ScaleTestExecutor,
    curve: ScalingPoint[],
    baseline: PerformanceMetrics
  ): Promise<OptimalConfig> {
    if (curve.length === 0) {
      const capacity = await executor.getCurrentCapacity();
      return {
        instances: capacity.instances,
        resources: capacity.resources,
        performance: baseline.throughput,
        cost: 0,
        score: 0,
      };
    }

    // Score each configuration
    let bestConfig = 0;
    let bestScore = -1;

    for (let i = 0; i < curve.length; i++) {
      const point = curve[i];

      // Score combines throughput, efficiency, and cost
      const throughputScore = point.throughput / baseline.throughput;
      const efficiencyScore = point.efficiency;
      const costScore = point.costPerRequest > 0 ? 1 / point.costPerRequest : 1;

      // Weighted score
      const score =
        throughputScore * 0.4 + efficiencyScore * 0.4 + costScore * 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestConfig = i;
      }
    }

    const optimalPoint = curve[bestConfig];
    const capacity = await executor.getCurrentCapacity();

    return {
      instances: capacity.instances,
      resources: capacity.resources,
      performance: optimalPoint.throughput,
      cost: optimalPoint.costPerRequest,
      score: bestScore,
    };
  }

  /**
   * Calculate average cost per request
   */
  private calculateAverageCostPerRequest(curve: ScalingPoint[]): number {
    if (curve.length === 0) return 0;

    const total = curve.reduce((sum, p) => sum + p.costPerRequest, 0);
    return total / curve.length;
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
      id: `scale-req-${Date.now()}-${id}`,
      type: "scale_test",
      payload: { scale: true },
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
