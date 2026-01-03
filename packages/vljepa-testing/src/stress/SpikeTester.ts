/**
 * SpikeTester - Test system's ability to handle sudden traffic spikes
 * Simulates flash crowds and viral traffic patterns.
 */

import type { TestRequest, StressTestConfig } from "../types.js";

export interface SpikeTestConfig {
  baselineLoad: number;
  spikeLoad: number;
  spikeDuration: number;
  spikePattern: "instant" | "ramp" | "wave";
  recoveryDuration: number;
  repeatCount: number;
  intervalBetweenSpikes: number;
}

export interface SpikeTestResult {
  survived: boolean;
  spikes: SpikeResult[];
  avgSpikeSurvival: number;
  recoveryTime: number;
  degradationDuringSpike: number;
  maxLatencyDuringSpike: number;
  recommendation: string;
}

export interface SpikeResult {
  spikeNumber: number;
  survived: boolean;
  maxLatency: number;
  errorRate: number;
  recovered: boolean;
  recoveryTime: number;
}

export interface SpikeTestExecutor {
  execute(
    request: TestRequest
  ): Promise<{ success: boolean; latency: number; error?: string }>;
  healthCheck(): Promise<boolean>;
}

export class SpikeTester {
  /**
   * Execute spike test
   */
  async execute(
    config: SpikeTestConfig,
    executor: SpikeTestExecutor
  ): Promise<SpikeTestResult> {
    const spikes: SpikeResult[] = [];

    for (let i = 0; i < config.repeatCount; i++) {
      const result = await this.executeSpike(i, config, executor);
      spikes.push(result);

      // Wait between spikes
      if (i < config.repeatCount - 1) {
        await this.sleep(config.intervalBetweenSpikes);
      }
    }

    const survived = spikes.every(s => s.survived);
    const avgSpikeSurvival =
      spikes.reduce((sum, s) => sum + (s.survived ? 1 : 0), 0) / spikes.length;
    const recoveryTime =
      spikes.reduce((sum, s) => sum + s.recoveryTime, 0) / spikes.length;
    const degradationDuringSpike = this.calculateDegradation(spikes);
    const maxLatencyDuringSpike = Math.max(...spikes.map(s => s.maxLatency));
    const recommendation = this.generateRecommendation(spikes, config);

    return {
      survived,
      spikes,
      avgSpikeSurvival,
      recoveryTime,
      degradationDuringSpike,
      maxLatencyDuringSpike,
      recommendation,
    };
  }

  /**
   * Execute a single spike
   */
  private async executeSpike(
    spikeNumber: number,
    config: SpikeTestConfig,
    executor: SpikeTestExecutor
  ): Promise<SpikeResult> {
    // Establish baseline
    const baseline = await this.measureBaseline(
      config.baselineLoad,
      executor,
      5000
    );

    // Execute spike based on pattern
    const spikeResult = await this.executeSpikePattern(config, executor);

    // Measure recovery
    const recovered = await this.measureRecovery(
      config.baselineLoad,
      executor,
      config.recoveryDuration
    );

    return {
      spikeNumber,
      survived: spikeResult.errorRate < 0.5,
      maxLatency: spikeResult.maxLatency,
      errorRate: spikeResult.errorRate,
      recovered: recovered.recovered,
      recoveryTime: recovered.recoveryTime,
    };
  }

  /**
   * Execute spike based on pattern
   */
  private async executeSpikePattern(
    config: SpikeTestConfig,
    executor: SpikeTestExecutor
  ): Promise<{ maxLatency: number; errorRate: number }> {
    switch (config.spikePattern) {
      case "instant":
        return await this.instantSpike(config, executor);
      case "ramp":
        return await this.rampSpike(config, executor);
      case "wave":
        return await this.waveSpike(config, executor);
      default:
        return await this.instantSpike(config, executor);
    }
  }

  /**
   * Instant spike - immediate jump to spike load
   */
  private async instantSpike(
    config: SpikeTestConfig,
    executor: SpikeTestExecutor
  ): Promise<{ maxLatency: number; errorRate: number }> {
    const startTime = Date.now();
    const latencies: number[] = [];
    let errors = 0;
    let total = 0;

    while (Date.now() - startTime < config.spikeDuration) {
      const promises: Promise<void>[] = [];

      for (let i = 0; i < config.spikeLoad; i++) {
        promises.push(
          (async () => {
            const request = this.generateRequest(i);
            const start = performance.now();

            try {
              const result = await executor.execute(request);
              const latency = performance.now() - start;
              latencies.push(latency);

              if (!result.success) {
                errors++;
              }
              total++;
            } catch {
              errors++;
              total++;
            }
          })()
        );
      }

      await Promise.all(promises);
      await this.sleep(100);
    }

    return {
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      errorRate: total > 0 ? errors / total : 0,
    };
  }

  /**
   * Ramp spike - gradual increase to spike load
   */
  private async rampSpike(
    config: SpikeTestConfig,
    executor: SpikeTestExecutor
  ): Promise<{ maxLatency: number; errorRate: number }> {
    const rampDuration = config.spikeDuration / 2;
    const sustainDuration = config.spikeDuration - rampDuration;
    const latencies: number[] = [];
    let errors = 0;
    let total = 0;

    // Ramp up
    const rampStart = Date.now();
    while (Date.now() - rampStart < rampDuration) {
      const progress = (Date.now() - rampStart) / rampDuration;
      const currentLoad = Math.floor(
        config.baselineLoad +
          (config.spikeLoad - config.baselineLoad) * progress
      );

      await this.executeAtLoad(currentLoad, executor, latencies, errors, total);
      total = latencies.length + errors;
      await this.sleep(100);
    }

    // Sustain
    const sustainStart = Date.now();
    while (Date.now() - sustainStart < sustainDuration) {
      await this.executeAtLoad(
        config.spikeLoad,
        executor,
        latencies,
        errors,
        total
      );
      total = latencies.length + errors;
      await this.sleep(100);
    }

    return {
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      errorRate: total > 0 ? errors / total : 0,
    };
  }

  /**
   * Wave spike - multiple up and down cycles
   */
  private async waveSpike(
    config: SpikeTestConfig,
    executor: SpikeTestExecutor
  ): Promise<{ maxLatency: number; errorRate: number }> {
    const waveCount = 3;
    const waveDuration = config.spikeDuration / waveCount;
    const latencies: number[] = [];
    let errors = 0;
    let total = 0;

    for (let i = 0; i < waveCount; i++) {
      const waveStart = Date.now();

      // Up
      while (Date.now() - waveStart < waveDuration / 2) {
        const progress = (Date.now() - waveStart) / (waveDuration / 2);
        const currentLoad = Math.floor(
          config.baselineLoad +
            (config.spikeLoad - config.baselineLoad) * progress
        );
        await this.executeAtLoad(
          currentLoad,
          executor,
          latencies,
          errors,
          total
        );
        total = latencies.length + errors;
        await this.sleep(100);
      }

      // Down
      while (Date.now() - waveStart < waveDuration) {
        const progress =
          (Date.now() - waveStart - waveDuration / 2) / (waveDuration / 2);
        const currentLoad = Math.floor(
          config.spikeLoad - (config.spikeLoad - config.baselineLoad) * progress
        );
        await this.executeAtLoad(
          currentLoad,
          executor,
          latencies,
          errors,
          total
        );
        total = latencies.length + errors;
        await this.sleep(100);
      }
    }

    return {
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      errorRate: total > 0 ? errors / total : 0,
    };
  }

  /**
   * Execute requests at specific load level
   */
  private async executeAtLoad(
    load: number,
    executor: SpikeTestExecutor,
    latencies: number[],
    errors: number,
    total: number
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < Math.min(load, 50); i++) {
      promises.push(
        (async () => {
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
        })()
      );
    }

    await Promise.all(promises);
  }

  /**
   * Measure baseline performance
   */
  private async measureBaseline(
    load: number,
    executor: SpikeTestExecutor,
    duration: number
  ): Promise<{ avgLatency: number; errorRate: number }> {
    const startTime = Date.now();
    const latencies: number[] = [];
    let errors = 0;
    let total = 0;

    while (Date.now() - startTime < duration) {
      await this.executeAtLoad(load, executor, latencies, errors, total);
      total = latencies.length + errors;
      await this.sleep(100);
    }

    return {
      avgLatency:
        latencies.length > 0
          ? latencies.reduce((a, b) => a + b, 0) / latencies.length
          : 0,
      errorRate: total > 0 ? errors / total : 0,
    };
  }

  /**
   * Measure recovery after spike
   */
  private async measureRecovery(
    baselineLoad: number,
    executor: SpikeTestExecutor,
    maxDuration: number
  ): Promise<{ recovered: boolean; recoveryTime: number }> {
    const targetLatency = 1000; // 1 second
    const targetErrorRate = 0.05; // 5%
    const startTime = Date.now();

    while (Date.now() - startTime < maxDuration) {
      await this.sleep(5000);

      const metrics = await this.measureBaseline(baselineLoad, executor, 5000);

      if (
        metrics.avgLatency < targetLatency &&
        metrics.errorRate < targetErrorRate
      ) {
        return {
          recovered: true,
          recoveryTime: Date.now() - startTime,
        };
      }
    }

    return {
      recovered: false,
      recoveryTime: maxDuration,
    };
  }

  /**
   * Calculate degradation during spikes
   */
  private calculateDegradation(spikes: SpikeResult[]): number {
    if (spikes.length === 0) return 0;

    const avgErrorRate =
      spikes.reduce((sum, s) => sum + s.errorRate, 0) / spikes.length;
    const avgMaxLatency =
      spikes.reduce((sum, s) => sum + s.maxLatency, 0) / spikes.length;

    // Degradation score (0-100, higher is worse)
    return avgErrorRate * 50 + Math.min(100, (avgMaxLatency / 10000) * 50);
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    spikes: SpikeResult[],
    config: SpikeTestConfig
  ): string {
    const survivalRate = spikes.filter(s => s.survived).length / spikes.length;
    const avgRecoveryTime =
      spikes.reduce((sum, s) => sum + s.recoveryTime, 0) / spikes.length;

    if (survivalRate === 1 && avgRecoveryTime < 10000) {
      return "EXCELLENT: System handles spikes well and recovers quickly.";
    }
    if (survivalRate > 0.8) {
      return "GOOD: System mostly handles spikes but may need optimization for recovery time.";
    }
    if (survivalRate > 0.5) {
      return "FAIR: System struggles with spikes. Consider implementing rate limiting or auto-scaling.";
    }
    return "POOR: System cannot handle spikes. Implement circuit breakers, caching, or increase capacity.";
  }

  /**
   * Generate a test request
   */
  private generateRequest(id: number): TestRequest {
    return {
      id: `spike-req-${Date.now()}-${id}`,
      type: "spike_test",
      payload: { spike: true },
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
