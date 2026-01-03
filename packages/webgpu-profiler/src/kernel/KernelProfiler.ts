/**
 * KernelProfiler - GPU kernel execution profiling
 *
 * Tracks kernel execution times, workgroup sizes, and identifies hotspots
 */

import type {
  KernelExecution,
  PerformanceMetric,
  Statistics,
  Histogram,
} from "../types.js";

/**
 * Kernel statistics entry
 */
interface KernelStats {
  /** Kernel name */
  name: string;
  /** Execution count */
  count: number;
  /** Total duration (ns) */
  totalDuration: number;
  /** Average duration (ns) */
  avgDuration: number;
  /** Min duration (ns) */
  minDuration: number;
  /** Max duration (ns) */
  maxDuration: number;
  /** Durations for histogram */
  durations: number[];
  /** Workgroup sizes used */
  workgroupSizes: Set<string>;
}

/**
 * Kernel comparison result
 */
interface KernelComparison {
  /** First kernel */
  kernel1: string;
  /** Second kernel */
  kernel2: string;
  /** Speedup factor */
  speedup: number;
  /** Significance (p-value approximation) */
  significant: boolean;
}

/**
 * KernelProfiler - Tracks and analyzes kernel executions
 *
 * @example
 * ```typescript
 * const kernelProfiler = new KernelProfiler();
 *
 * kernelProfiler.beginKernel('matmul', [16, 16, 1], [256, 256, 1]);
 * // ... kernel execution ...
 * kernelProfiler.endKernel('matmul');
 *
 * const stats = kernelProfiler.getStatistics('matmul');
 * console.log(stats.mean, stats.stdDev);
 * ```
 */
export class KernelProfiler {
  /** Recorded kernel executions */
  private executions: KernelExecution[] = [];
  /** Kernel statistics by name */
  private kernelStats: Map<string, KernelStats> = new Map();
  /** Active kernel starts */
  private activeKernels: Map<
    string,
    { startTime: number; workgroupSize: [number, number, number] }
  > = new Map();

  /**
   * Begin tracking a kernel execution
   *
   * @param name - Kernel name
   * @param workgroupSize - Workgroup dimensions
   * @param dispatchSize - Dispatch dimensions
   */
  beginKernel(
    name: string,
    workgroupSize: [number, number, number],
    dispatchSize: [number, number, number]
  ): void {
    this.activeKernels.set(name, {
      startTime: performance.now(),
      workgroupSize,
    });
  }

  /**
   * End tracking a kernel execution
   *
   * @param name - Kernel name
   * @returns Execution duration in milliseconds
   */
  endKernel(name: string): number {
    const start = this.activeKernels.get(name);
    if (!start) {
      throw new Error(`No active kernel found: ${name}`);
    }

    const endTime = performance.now();
    const duration = endTime - start.startTime;

    const execution: KernelExecution = {
      id: `kernel-${this.executions.length}`,
      name,
      startTime: start.startTime,
      endTime,
      duration: duration * 1_000_000, // Convert to nanoseconds
      workgroupSize: start.workgroupSize,
      dispatchSize: [1, 1, 1], // Default, will be set if provided
    };

    this.executions.push(execution);
    this.activeKernels.delete(name);

    // Update statistics
    this.updateStats(name, execution);

    return duration;
  }

  /**
   * Record a kernel execution directly
   *
   * @param execution - Kernel execution record
   */
  recordExecution(execution: KernelExecution): void {
    this.executions.push(execution);
    this.updateStats(execution.name, execution);
  }

  /**
   * Update kernel statistics
   */
  private updateStats(name: string, execution: KernelExecution): void {
    let stats = this.kernelStats.get(name);

    if (!stats) {
      stats = {
        name,
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: -Infinity,
        durations: [],
        workgroupSizes: new Set(),
      };
      this.kernelStats.set(name, stats);
    }

    stats.count++;
    stats.totalDuration += execution.duration;
    stats.avgDuration = stats.totalDuration / stats.count;
    stats.minDuration = Math.min(stats.minDuration, execution.duration);
    stats.maxDuration = Math.max(stats.maxDuration, execution.duration);
    stats.durations.push(execution.duration);

    if (execution.workgroupSize) {
      const key = execution.workgroupSize.join("x");
      stats.workgroupSizes.add(key);
    }
  }

  /**
   * Get statistics for a specific kernel
   *
   * @param name - Kernel name
   * @returns Kernel statistics
   */
  getStatistics(name: string): Statistics {
    const stats = this.kernelStats.get(name);
    if (!stats) {
      throw new Error(`No statistics found for kernel: ${name}`);
    }

    const sorted = [...stats.durations].sort((a, b) => a - b);
    const count = sorted.length;

    return {
      count,
      min: stats.minDuration,
      max: stats.maxDuration,
      mean: stats.avgDuration,
      median: count > 0 ? sorted[Math.floor(count / 2)] : 0,
      stdDev: this.calculateStdDev(stats.durations, stats.avgDuration),
      variance: this.calculateVariance(stats.durations, stats.avgDuration),
      percentiles: this.calculatePercentiles(sorted),
    };
  }

  /**
   * Get all kernel names
   */
  getKernelNames(): string[] {
    return Array.from(this.kernelStats.keys());
  }

  /**
   * Get statistics for all kernels
   */
  getAllStatistics(): Map<string, Statistics> {
    const result = new Map<string, Statistics>();
    for (const name of this.kernelStats.keys()) {
      result.set(name, this.getStatistics(name));
    }
    return result;
  }

  /**
   * Identify hotspot kernels (slowest execution)
   *
   * @param limit - Maximum number of hotspots to return
   * @returns Sorted list of kernel names by total time
   */
  identifyHotspots(limit = 10): string[] {
    return Array.from(this.kernelStats.entries())
      .sort((a, b) => b[1].totalDuration - a[1].totalDuration)
      .slice(0, limit)
      .map(([name]) => name);
  }

  /**
   * Get most frequently called kernels
   *
   * @param limit - Maximum number to return
   * @returns Sorted list of kernel names by call count
   */
  getMostFrequent(limit = 10): string[] {
    return Array.from(this.kernelStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([name]) => name);
  }

  /**
   * Get kernels with highest variance (inconsistent performance)
   *
   * @param limit - Maximum number to return
   * @returns Sorted list of kernel names by variance
   */
  getHighestVariance(limit = 10): string[] {
    const varianceMap = new Map<string, number>();

    for (const [name, stats] of this.kernelStats) {
      if (stats.count > 1) {
        varianceMap.set(
          name,
          this.calculateVariance(stats.durations, stats.avgDuration)
        );
      }
    }

    return Array.from(varianceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name]) => name);
  }

  /**
   * Compare two kernels
   *
   * @param kernel1 - First kernel name
   * @param kernel2 - Second kernel name
   * @returns Comparison result
   */
  compareKernels(kernel1: string, kernel2: string): KernelComparison {
    const stats1 = this.kernelStats.get(kernel1);
    const stats2 = this.kernelStats.get(kernel2);

    if (!stats1 || !stats2) {
      throw new Error(`Kernel not found: ${!stats1 ? kernel1 : kernel2}`);
    }

    const speedup = stats1.avgDuration / stats2.avgDuration;

    // Simple significance test (if one is consistently faster)
    const significant = Math.abs(speedup - 1) > 0.1;

    return {
      kernel1,
      kernel2,
      speedup,
      significant,
    };
  }

  /**
   * Create histogram for kernel execution times
   *
   * @param name - Kernel name
   * @param binCount - Number of histogram bins
   * @returns Histogram data
   */
  createHistogram(name: string, binCount = 20): Histogram {
    const stats = this.kernelStats.get(name);
    if (!stats || stats.durations.length === 0) {
      return {
        metric: name,
        bins: [],
        totalCount: 0,
        binWidth: 0,
      };
    }

    const min = stats.minDuration;
    const max = stats.maxDuration;
    const binWidth = (max - min) / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
      start: min + i * binWidth,
      end: min + (i + 1) * binWidth,
      count: 0,
      percentage: 0,
    }));

    // Fill bins
    for (const duration of stats.durations) {
      const binIndex = Math.min(
        Math.floor((duration - min) / binWidth),
        binCount - 1
      );
      bins[binIndex].count++;
    }

    // Calculate percentages
    const totalCount = stats.durations.length;
    for (const bin of bins) {
      bin.percentage = (bin.count / totalCount) * 100;
    }

    return {
      metric: name,
      bins,
      totalCount,
      binWidth,
    };
  }

  /**
   * Get kernel execution timeline
   *
   * @param name - Kernel name (optional, returns all if not specified)
   * @returns Array of kernel executions
   */
  getTimeline(name?: string): KernelExecution[] {
    if (name) {
      return this.executions.filter(e => e.name === name);
    }
    return [...this.executions];
  }

  /**
   * Get workgroup sizes used by a kernel
   *
   * @param name - Kernel name
   * @returns Set of workgroup size strings
   */
  getWorkgroupSizes(name: string): string[] {
    const stats = this.kernelStats.get(name);
    return stats ? Array.from(stats.workgroupSizes) : [];
  }

  /**
   * Get performance metrics for all kernels
   *
   * @returns Array of performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    const metrics: PerformanceMetric[] = [];

    for (const [name, stats] of this.kernelStats) {
      const stdDev = this.calculateStdDev(stats.durations, stats.avgDuration);

      metrics.push({
        name: `${name}-duration`,
        type: "timing",
        value: stats.avgDuration,
        unit: "ns",
        min: stats.minDuration,
        max: stats.maxDuration,
        avg: stats.avgDuration,
        stdDev,
        sampleCount: stats.count,
        firstSample: this.executions.find(e => e.name === name)?.startTime ?? 0,
        lastSample:
          this.executions.filter(e => e.name === name).pop()?.endTime ?? 0,
      });

      metrics.push({
        name: `${name}-count`,
        type: "throughput",
        value: stats.count,
        unit: "ops",
        min: stats.count,
        max: stats.count,
        avg: stats.count,
        sampleCount: 1,
        firstSample: 0,
        lastSample: 0,
      });
    }

    return metrics;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length <= 1) return 0;
    return Math.sqrt(this.calculateVariance(values, mean));
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[], mean: number): number {
    if (values.length <= 1) return 0;
    const sumSquaredDiff = values.reduce(
      (sum, val) => sum + (val - mean) ** 2,
      0
    );
    return sumSquaredDiff / (values.length - 1);
  }

  /**
   * Calculate percentiles
   */
  private calculatePercentiles(sorted: number[]): Statistics["percentiles"] {
    const count = sorted.length;
    if (count === 0) {
      return { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }

    const getPercentile = (p: number): number => {
      const index = Math.ceil((count - 1) * p);
      return sorted[index] ?? sorted[count - 1];
    };

    return {
      p25: getPercentile(0.25),
      p50: getPercentile(0.5),
      p75: getPercentile(0.75),
      p90: getPercentile(0.9),
      p95: getPercentile(0.95),
      p99: getPercentile(0.99),
    };
  }

  /**
   * Clear all recorded data
   */
  clear(): void {
    this.executions = [];
    this.kernelStats.clear();
    this.activeKernels.clear();
  }

  /**
   * Get total number of recorded executions
   */
  getExecutionCount(): number {
    return this.executions.length;
  }
}
