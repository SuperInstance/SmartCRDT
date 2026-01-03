/**
 * UtilizationMonitor - GPU utilization tracking
 *
 * Monitors GPU compute, memory bandwidth, and power utilization
 */

import type {
  UtilizationSample,
  PerformanceMetric,
  ResourceSnapshot,
} from "../types.js";

/**
 * Utilization statistics
 */
interface UtilizationStats {
  /** Average compute utilization */
  avgCompute: number;
  /** Peak compute utilization */
  peakCompute: number;
  /** Average memory bandwidth utilization */
  avgMemoryBandwidth: number;
  /** Peak memory bandwidth utilization */
  peakMemoryBandwidth: number;
  /** Average power consumption (W) */
  avgPower?: number;
  /** Peak power consumption (W) */
  peakPower?: number;
  /** Average temperature (C) */
  avgTemperature?: number;
  /** Peak temperature (C) */
  peakTemperature?: number;
}

/**
 * UtilizationMonitor - Tracks GPU resource utilization
 *
 * Note: WebGPU doesn't provide direct access to GPU utilization metrics.
 * This class provides a framework for integration with platform-specific APIs
 * and estimates utilization based on profiling data.
 *
 * @example
 * ```typescript
 * const monitor = new UtilizationMonitor();
 *
 * monitor.startSampling();
 * // ... GPU operations ...
 * monitor.sample();
 *
 * const stats = monitor.getStatistics();
 * console.log(`Average compute utilization: ${stats.avgCompute}%`);
 * ```
 */
export class UtilizationMonitor {
  /** Utilization samples */
  private samples: UtilizationSample[] = [];
  /** Sampling interval in milliseconds */
  private samplingInterval: number;
  /** Sampling timer */
  private samplingTimer?: ReturnType<typeof setInterval>;
  /** Is currently sampling */
  private isSampling = false;
  /** Sample counter */
  private sampleCounter = 0;

  /**
   * Estimated GPU utilization based on recent activity
   */
  private estimatedUtilization = {
    compute: 0,
    memoryBandwidth: 0,
  };

  /**
   * Recent kernel executions for estimation
   */
  private recentKernels: Array<{ startTime: number; endTime: number }> = [];

  /**
   * Create a new utilization monitor
   *
   * @param samplingInterval - Sampling interval in milliseconds (default: 100ms)
   */
  constructor(samplingInterval = 100) {
    this.samplingInterval = samplingInterval;
  }

  /**
   * Start automatic sampling
   */
  startSampling(): void {
    if (this.isSampling) return;

    this.isSampling = true;
    this.samplingTimer = setInterval(() => {
      this.sample();
    }, this.samplingInterval);
  }

  /**
   * Stop automatic sampling
   */
  stopSampling(): void {
    if (this.samplingTimer) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = undefined;
    }
    this.isSampling = false;
  }

  /**
   * Take a single utilization sample
   *
   * @returns Sample data
   */
  sample(): UtilizationSample {
    const timestamp = performance.now();

    // Estimate utilization based on recent activity
    this.updateEstimates();

    const sample: UtilizationSample = {
      timestamp,
      compute: this.estimatedUtilization.compute,
      memoryBandwidth: this.estimatedUtilization.memoryBandwidth,
    };

    this.samples.push(sample);

    return sample;
  }

  /**
   * Update utilization estimates based on recent activity
   */
  private updateEstimates(): void {
    const now = performance.now();
    const windowSize = this.samplingInterval;

    // Clean up old kernels
    this.recentKernels = this.recentKernels.filter(
      k => now - k.startTime < windowSize * 2
    );

    // Estimate compute utilization
    let busyTime = 0;
    for (const kernel of this.recentKernels) {
      if (kernel.startTime <= now && kernel.endTime >= now) {
        busyTime +=
          Math.min(kernel.endTime, now) -
          Math.max(kernel.startTime, now - windowSize);
      } else if (
        kernel.startTime > now - windowSize &&
        kernel.startTime < now
      ) {
        busyTime += Math.min(kernel.endTime, now) - kernel.startTime;
      }
    }

    this.estimatedUtilization.compute = Math.min(
      (busyTime / windowSize) * 100,
      100
    );

    // Estimate memory bandwidth utilization
    // This is a simplified estimation
    this.estimatedUtilization.memoryBandwidth = Math.min(
      this.estimatedUtilization.compute * 0.8,
      100
    );
  }

  /**
   * Record a kernel execution for utilization estimation
   *
   * @param startTime - Kernel start time
   * @param duration - Kernel duration in milliseconds
   */
  recordKernel(startTime: number, duration: number): void {
    this.recentKernels.push({
      startTime,
      endTime: startTime + duration,
    });
  }

  /**
   * Get utilization statistics
   *
   * @returns Statistics for all samples
   */
  getStatistics(): UtilizationStats {
    if (this.samples.length === 0) {
      return {
        avgCompute: 0,
        peakCompute: 0,
        avgMemoryBandwidth: 0,
        peakMemoryBandwidth: 0,
      };
    }

    const computeValues = this.samples.map(s => s.compute);
    const memoryBandwidthValues = this.samples.map(s => s.memoryBandwidth);
    const powerValues = this.samples
      .map(s => s.power)
      .filter((p): p is number => p !== undefined);
    const temperatureValues = this.samples
      .map(s => s.temperature)
      .filter((t): t is number => t !== undefined);

    return {
      avgCompute:
        computeValues.reduce((a, b) => a + b, 0) / computeValues.length,
      peakCompute: Math.max(...computeValues),
      avgMemoryBandwidth:
        memoryBandwidthValues.reduce((a, b) => a + b, 0) /
        memoryBandwidthValues.length,
      peakMemoryBandwidth: Math.max(...memoryBandwidthValues),
      avgPower:
        powerValues.length > 0
          ? powerValues.reduce((a, b) => a + b, 0) / powerValues.length
          : undefined,
      peakPower: powerValues.length > 0 ? Math.max(...powerValues) : undefined,
      avgTemperature:
        temperatureValues.length > 0
          ? temperatureValues.reduce((a, b) => a + b, 0) /
            temperatureValues.length
          : undefined,
      peakTemperature:
        temperatureValues.length > 0
          ? Math.max(...temperatureValues)
          : undefined,
    };
  }

  /**
   * Get utilization samples
   *
   * @param startTime - Optional start time filter
   * @param endTime - Optional end time filter
   * @returns Filtered samples
   */
  getSamples(startTime?: number, endTime?: number): UtilizationSample[] {
    let samples = [...this.samples];

    if (startTime !== undefined) {
      samples = samples.filter(s => s.timestamp >= startTime);
    }

    if (endTime !== undefined) {
      samples = samples.filter(s => s.timestamp <= endTime);
    }

    return samples;
  }

  /**
   * Get average utilization over a time range
   *
   * @param startTime - Start time
   * @param endTime - End time
   * @returns Average utilization
   */
  getAverageUtilization(
    startTime: number,
    endTime: number
  ): {
    compute: number;
    memoryBandwidth: number;
  } {
    const samples = this.getSamples(startTime, endTime);

    if (samples.length === 0) {
      return { compute: 0, memoryBandwidth: 0 };
    }

    return {
      compute: samples.reduce((sum, s) => sum + s.compute, 0) / samples.length,
      memoryBandwidth:
        samples.reduce((sum, s) => sum + s.memoryBandwidth, 0) / samples.length,
    };
  }

  /**
   * Get peak utilization over a time range
   *
   * @param startTime - Start time
   * @param endTime - End time
   * @returns Peak utilization
   */
  getPeakUtilization(
    startTime: number,
    endTime: number
  ): {
    compute: number;
    memoryBandwidth: number;
  } {
    const samples = this.getSamples(startTime, endTime);

    if (samples.length === 0) {
      return { compute: 0, memoryBandwidth: 0 };
    }

    return {
      compute: Math.max(...samples.map(s => s.compute)),
      memoryBandwidth: Math.max(...samples.map(s => s.memoryBandwidth)),
    };
  }

  /**
   * Detect utilization anomalies
   *
   * @param threshold - Threshold for anomaly detection (default: 2 standard deviations)
   * @returns Array of anomalous samples
   */
  detectAnomalies(threshold = 2): Array<{
    sample: UtilizationSample;
    reason: string;
  }> {
    const anomalies: Array<{ sample: UtilizationSample; reason: string }> = [];

    if (this.samples.length < 10) {
      return anomalies;
    }

    const stats = this.getStatistics();
    const computeStdDev = this.calculateStdDev(
      this.samples.map(s => s.compute),
      stats.avgCompute
    );
    const memoryStdDev = this.calculateStdDev(
      this.samples.map(s => s.memoryBandwidth),
      stats.avgMemoryBandwidth
    );

    for (const sample of this.samples) {
      if (
        Math.abs(sample.compute - stats.avgCompute) >
        threshold * computeStdDev
      ) {
        anomalies.push({
          sample,
          reason: `Compute utilization (${sample.compute.toFixed(1)}%) deviates significantly from average (${stats.avgCompute.toFixed(1)}%)`,
        });
      }

      if (
        Math.abs(sample.memoryBandwidth - stats.avgMemoryBandwidth) >
        threshold * memoryStdDev
      ) {
        anomalies.push({
          sample,
          reason: `Memory bandwidth utilization (${sample.memoryBandwidth.toFixed(1)}%) deviates significantly from average (${stats.avgMemoryBandwidth.toFixed(1)}%)`,
        });
      }
    }

    return anomalies;
  }

  /**
   * Get performance metrics
   *
   * @returns Array of performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    const stats = this.getStatistics();

    return [
      {
        name: "utilization-compute",
        type: "utilization",
        value: stats.avgCompute,
        unit: "%",
        min: 0,
        max: stats.peakCompute,
        avg: stats.avgCompute,
        sampleCount: this.samples.length,
        firstSample: this.samples[0]?.timestamp ?? 0,
        lastSample: this.samples[this.samples.length - 1]?.timestamp ?? 0,
      },
      {
        name: "utilization-memory-bandwidth",
        type: "utilization",
        value: stats.avgMemoryBandwidth,
        unit: "%",
        min: 0,
        max: stats.peakMemoryBandwidth,
        avg: stats.avgMemoryBandwidth,
        sampleCount: this.samples.length,
        firstSample: this.samples[0]?.timestamp ?? 0,
        lastSample: this.samples[this.samples.length - 1]?.timestamp ?? 0,
      },
      ...(stats.avgPower !== undefined
        ? [
            {
              name: "utilization-power",
              type: "utilization" as const,
              value: stats.avgPower,
              unit: "W" as const,
              min: 0,
              max: stats.peakPower ?? 0,
              avg: stats.avgPower,
              sampleCount: this.samples.filter(s => s.power !== undefined)
                .length,
              firstSample: this.samples[0]?.timestamp ?? 0,
              lastSample: this.samples[this.samples.length - 1]?.timestamp ?? 0,
            },
          ]
        : []),
      ...(stats.avgTemperature !== undefined
        ? [
            {
              name: "utilization-temperature",
              type: "utilization" as const,
              value: stats.avgTemperature,
              unit: "C" as const,
              min: 0,
              max: stats.peakTemperature ?? 0,
              avg: stats.avgTemperature,
              sampleCount: this.samples.filter(s => s.temperature !== undefined)
                .length,
              firstSample: this.samples[0]?.timestamp ?? 0,
              lastSample: this.samples[this.samples.length - 1]?.timestamp ?? 0,
            },
          ]
        : []),
    ];
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length <= 1) return 0;
    const variance =
      values.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
      (values.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Clear all samples
   */
  clear(): void {
    this.stopSampling();
    this.samples = [];
    this.recentKernels = [];
    this.sampleCounter = 0;
    this.estimatedUtilization = {
      compute: 0,
      memoryBandwidth: 0,
    };
  }

  /**
   * Get sample count
   */
  getSampleCount(): number {
    return this.samples.length;
  }

  /**
   * Check if currently sampling
   */
  isActive(): boolean {
    return this.isSampling;
  }
}
