/**
 * @lsi/vljepa-video/realtime/LatencyTracker
 *
 * Latency tracker for tracking performance metrics in real-time.
 *
 * @version 1.0.0
 */

import type { LatencyMetrics, LatencyTrackerConfig } from "../types.js";

/**
 * Latency sample
 */
interface LatencySample {
  /** Frame identifier */
  frameId: number;

  /** Capture timestamp */
  captureTime: number;

  /** Processing start time */
  processStartTime: number;

  /** Processing end time */
  processEndTime: number;

  /** Output time */
  outputTime: number;

  /** Frame latency (processing time) */
  frameLatency: number;

  /** End-to-end latency */
  endToEndLatency: number;

  /** Whether frame was dropped */
  dropped: boolean;
}

/**
 * Latency tracker
 *
 * Tracks latency metrics for real-time video processing.
 */
export class LatencyTracker {
  private config: LatencyTrackerConfig;
  private samples: LatencySample[] = [];
  private frameCount: number = 0;
  private droppedFrames: number = 0;
  private currentCaptureTime: number = 0;
  private currentProcessStartTime: number = 0;

  // Jitter calculation
  private prevFrameLatency: number = 0;
  private jitterSum: number = 0;
  private jitterCount: number = 0;

  constructor(config: LatencyTrackerConfig) {
    this.config = config;
  }

  /**
   * Start tracking frame
   */
  startFrame(frameId: number): void {
    this.currentCaptureTime = performance.now();
    this.currentProcessStartTime = this.currentCaptureTime;
    this.frameCount++;
  }

  /**
   * Mark processing start
   */
  startProcessing(): void {
    this.currentProcessStartTime = performance.now();
  }

  /**
   * End tracking frame
   */
  endFrame(frameId: number, dropped: boolean = false): void {
    const now = performance.now();

    const frameLatency = now - this.currentProcessStartTime;
    const endToEndLatency = now - this.currentCaptureTime;

    // Calculate jitter
    if (this.config.trackJitter && this.frameCount > 1) {
      const jitter = Math.abs(frameLatency - this.prevFrameLatency);
      this.jitterSum += jitter;
      this.jitterCount++;
    }

    const sample: LatencySample = {
      frameId,
      captureTime: this.currentCaptureTime,
      processStartTime: this.currentProcessStartTime,
      processEndTime: now,
      outputTime: now,
      frameLatency,
      endToEndLatency,
      dropped,
    };

    this.samples.push(sample);

    // Trim to window size
    if (this.samples.length > this.config.windowSize) {
      this.samples.shift();
    }

    if (dropped) {
      this.droppedFrames++;
    }

    this.prevFrameLatency = frameLatency;
  }

  /**
   * Get latency metrics
   */
  getMetrics(): LatencyMetrics {
    if (this.samples.length === 0) {
      return {
        frameLatency: { p50: 0, p95: 0, p99: 0, max: 0 },
        endToEndLatency: 0,
        jitter: 0,
        droppedFrames: 0,
        totalFrames: this.frameCount,
        dropRate: 0,
        throughput: 0,
      };
    }

    // Calculate frame latency percentiles
    const frameLatencies = this.samples
      .filter(s => !s.dropped)
      .map(s => s.frameLatency);

    const sortedLatencies = [...frameLatencies].sort((a, b) => a - b);

    const p50 = this.percentile(sortedLatencies, 50);
    const p95 = this.percentile(sortedLatencies, 95);
    const p99 = this.percentile(sortedLatencies, 99);
    const max =
      sortedLatencies.length > 0
        ? sortedLatencies[sortedLatencies.length - 1]
        : 0;

    // Calculate end-to-end latency
    const endToEndLatencies = this.samples
      .filter(s => !s.dropped)
      .map(s => s.endToEndLatency);
    const avgEndToEnd =
      endToEndLatencies.length > 0
        ? endToEndLatencies.reduce((a, b) => a + b, 0) /
          endToEndLatencies.length
        : 0;

    // Calculate jitter
    const jitter = this.jitterCount > 0 ? this.jitterSum / this.jitterCount : 0;

    // Calculate drop rate
    const dropRate =
      this.frameCount > 0 ? this.droppedFrames / this.frameCount : 0;

    // Calculate throughput
    const timeWindow = this.getTimeWindow();
    const throughput =
      timeWindow > 0 ? (frameLatencies.length / timeWindow) * 1000 : 0;

    return {
      frameLatency: { p50, p95, p99, max },
      endToEndLatency: avgEndToEnd,
      jitter,
      droppedFrames: this.droppedFrames,
      totalFrames: this.frameCount,
      dropRate,
      throughput,
    };
  }

  /**
   * Get percentile value
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) {
      return 0;
    }

    const index = Math.floor((sortedArray.length * p) / 100);
    return sortedArray[Math.min(index, sortedArray.length - 1)];
  }

  /**
   * Get time window of samples
   */
  private getTimeWindow(): number {
    if (this.samples.length < 2) {
      return 0;
    }

    const first = this.samples[0].captureTime;
    const last = this.samples[this.samples.length - 1].captureTime;
    return last - first;
  }

  /**
   * Get latency samples
   */
  getSamples(): LatencySample[] {
    return [...this.samples];
  }

  /**
   * Get recent samples (last N)
   */
  getRecentSamples(n: number): LatencySample[] {
    return this.samples.slice(-n);
  }

  /**
   * Get latency by frame ID
   */
  getByFrameId(frameId: number): LatencySample | null {
    return this.samples.find(s => s.frameId === frameId) || null;
  }

  /**
   * Get samples in time range
   */
  getSamplesInTimeRange(startTime: number, endTime: number): LatencySample[] {
    return this.samples.filter(
      s => s.captureTime >= startTime && s.captureTime <= endTime
    );
  }

  /**
   * Get latency histogram
   */
  getLatencyHistogram(bins: number = 10): { bin: number; count: number }[] {
    const latencies = this.samples
      .filter(s => !s.dropped)
      .map(s => s.frameLatency);

    if (latencies.length === 0) {
      return [];
    }

    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const binSize = (max - min) / bins;

    const histogram: { bin: number; count: number }[] = [];

    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binSize;
      const binEnd = binStart + binSize;

      const count = latencies.filter(
        l => l >= binStart && (i === bins - 1 ? l <= binEnd : l < binEnd)
      ).length;

      histogram.push({
        bin: binStart + binSize / 2,
        count,
      });
    }

    return histogram;
  }

  /**
   * Get latency over time
   */
  getLatencyOverTime(): Array<{ timestamp: number; latency: number }> {
    return this.samples.map(s => ({
      timestamp: s.captureTime,
      latency: s.frameLatency,
    }));
  }

  /**
   * Check if latency threshold exceeded
   */
  isThresholdExceeded(threshold?: number): boolean {
    const maxLatency = threshold || this.config.maxLatencyThreshold;
    return this.samples.some(s => s.frameLatency > maxLatency);
  }

  /**
   * Get samples exceeding threshold
   */
  getExceededSamples(threshold?: number): LatencySample[] {
    const maxLatency = threshold || this.config.maxLatencyThreshold;
    return this.samples.filter(s => s.frameLatency > maxLatency);
  }

  /**
   * Calculate moving average
   */
  getMovingAverage(window: number = 10): number {
    const recent = this.samples.slice(-window);
    if (recent.length === 0) {
      return 0;
    }

    const sum = recent
      .filter(s => !s.dropped)
      .reduce((acc, s) => acc + s.frameLatency, 0);

    const count = recent.filter(s => !s.dropped).length;

    return count > 0 ? sum / count : 0;
  }

  /**
   * Get statistics summary
   */
  getSummary(): {
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    stdDev: number;
    jitter: number;
    dropRate: number;
    throughput: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const metrics = this.getMetrics();

    const latencies = this.samples
      .filter(s => !s.dropped)
      .map(s => s.frameLatency);

    const avg =
      latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    const min = latencies.length > 0 ? Math.min(...latencies) : 0;
    const max = latencies.length > 0 ? Math.max(...latencies) : 0;

    const variance =
      latencies.length > 0
        ? latencies.reduce((sum, l) => sum + (l - avg) ** 2, 0) /
          latencies.length
        : 0;

    const stdDev = Math.sqrt(variance);

    return {
      avgLatency: avg,
      minLatency: min,
      maxLatency: max,
      stdDev,
      jitter: metrics.jitter,
      dropRate: metrics.dropRate,
      throughput: metrics.throughput,
      p50: metrics.frameLatency.p50,
      p95: metrics.frameLatency.p95,
      p99: metrics.frameLatency.p99,
    };
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.samples = [];
    this.frameCount = 0;
    this.droppedFrames = 0;
    this.jitterSum = 0;
    this.jitterCount = 0;
    this.prevFrameLatency = 0;
  }

  /**
   * Get window size
   */
  getWindowSize(): number {
    return this.config.windowSize;
  }

  /**
   * Set window size
   */
  setWindowSize(size: number): void {
    this.config.windowSize = size;

    // Trim samples if needed
    if (this.samples.length > size) {
      this.samples = this.samples.slice(-size);
    }
  }
}

/**
 * Dropout handler
 *
 * Handles frame drops and recovery strategies.
 */
export class DropoutHandler {
  private consecutiveDrops: number = 0;
  private maxConsecutiveDrops: number = 5;
  private dropHistory: Array<{ timestamp: number; count: number }> = [];
  private recoveryStrategy: "skip" | "reduce_quality" | "increase_buffer" =
    "skip";

  /**
   * Handle frame drop
   */
  handleDrop(): void {
    this.consecutiveDrops++;
  }

  /**
   * Handle frame processed
   */
  handleProcessed(): void {
    if (this.consecutiveDrops > 0) {
      // Record drop event
      this.dropHistory.push({
        timestamp: performance.now(),
        count: this.consecutiveDrops,
      });

      // Trim history
      if (this.dropHistory.length > 100) {
        this.dropHistory.shift();
      }
    }

    this.consecutiveDrops = 0;
  }

  /**
   * Check if should apply recovery
   */
  shouldRecover(): boolean {
    return this.consecutiveDrops >= this.maxConsecutiveDrops;
  }

  /**
   * Get recovery action
   */
  getRecoveryAction(): {
    action: string;
    parameter: number | string;
  } {
    switch (this.recoveryStrategy) {
      case "skip":
        return {
          action: "skip_frames",
          parameter: Math.ceil(this.consecutiveDrops / 2),
        };
      case "reduce_quality":
        return {
          action: "reduce_quality",
          parameter: -0.2,
        };
      case "increase_buffer":
        return {
          action: "increase_buffer",
          parameter: 10,
        };
      default:
        return {
          action: "none",
          parameter: 0,
        };
    }
  }

  /**
   * Get drop statistics
   */
  getStats(): {
    consecutiveDrops: number;
    totalDropEvents: number;
    avgDropsPerEvent: number;
    maxDropsInEvent: number;
  } {
    const totalEvents = this.dropHistory.length;
    const totalDrops = this.dropHistory.reduce((sum, e) => sum + e.count, 0);
    const avgDropsPerEvent = totalEvents > 0 ? totalDrops / totalEvents : 0;
    const maxDropsInEvent =
      totalEvents > 0 ? Math.max(...this.dropHistory.map(e => e.count)) : 0;

    return {
      consecutiveDrops: this.consecutiveDrops,
      totalDropEvents: totalEvents,
      avgDropsPerEvent,
      maxDropsInEvent,
    };
  }

  /**
   * Set recovery strategy
   */
  setRecoveryStrategy(strategy: DropoutHandler["recoveryStrategy"]): void {
    this.recoveryStrategy = strategy;
  }

  /**
   * Set max consecutive drops
   */
  setMaxConsecutiveDrops(max: number): void {
    this.maxConsecutiveDrops = max;
  }

  /**
   * Reset handler
   */
  reset(): void {
    this.consecutiveDrops = 0;
    this.dropHistory = [];
  }
}
