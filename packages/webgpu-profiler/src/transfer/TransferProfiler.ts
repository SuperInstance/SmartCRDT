/**
 * TransferProfiler - Data transfer profiling and bandwidth analysis
 *
 * Tracks host-to-device, device-to-host, and device-to-device transfers
 */

import type {
  TransferRecord,
  PerformanceMetric,
  Statistics,
} from "../types.js";

/**
 * Transfer statistics by direction
 */
interface DirectionStats {
  /** Direction */
  direction: "host-to-device" | "device-to-host" | "device-to-device";
  /** Transfer count */
  count: number;
  /** Total bytes transferred */
  totalBytes: number;
  /** Average transfer size */
  avgSize: number;
  /** Total duration (ns) */
  totalDuration: number;
  /** Average bandwidth (GB/s) */
  avgBandwidth: number;
  /** Peak bandwidth (GB/s) */
  peakBandwidth: number;
  /** Bandwidth samples */
  bandwidthSamples: number[];
}

/**
 * Size bucket for analysis
 */
interface SizeBucket {
  /** Minimum size */
  minSize: number;
  /** Maximum size */
  maxSize: number;
  /** Transfer count */
  count: number;
  /** Average bandwidth */
  avgBandwidth: number;
  /** Peak bandwidth */
  peakBandwidth: number;
}

/**
 * TransferProfiler - Tracks data transfer performance
 *
 * @example
 * ```typescript
 * const transferProfiler = new TransferProfiler();
 *
 * const transferId = transferProfiler.beginTransfer(1024 * 1024, 'host-to-device');
 * // ... perform transfer ...
 * const bandwidth = transferProfiler.endTransfer(transferId);
 *
 * const stats = transferProfiler.getDirectionStats('host-to-device');
 * console.log(`Average bandwidth: ${stats.avgBandwidth} GB/s`);
 * ```
 */
export class TransferProfiler {
  /** All recorded transfers */
  private transfers: TransferRecord[] = [];
  /** Active transfers */
  private activeTransfers: Map<
    string,
    { startTime: number; size: number; direction: string }
  > = new Map();
  /** Direction-specific statistics */
  private directionStats: Map<string, DirectionStats> = new Map();
  /** Transfer counter */
  private transferCounter = 0;

  /**
   * Begin tracking a transfer
   *
   * @param size - Transfer size in bytes
   * @param direction - Transfer direction
   * @returns Transfer ID
   */
  beginTransfer(
    size: number,
    direction: "host-to-device" | "device-to-host" | "device-to-device"
  ): string {
    const id = `transfer-${this.transferCounter++}`;
    const startTime = performance.now();

    this.activeTransfers.set(id, {
      startTime,
      size,
      direction,
    });

    return id;
  }

  /**
   * Complete a transfer
   *
   * @param id - Transfer ID
   * @returns Bandwidth in GB/s
   */
  endTransfer(id: string): number {
    const active = this.activeTransfers.get(id);
    if (!active) {
      throw new Error(`No active transfer found: ${id}`);
    }

    const endTime = performance.now();
    const durationMs = endTime - active.startTime;
    const durationNs = durationMs * 1_000_000;
    const bandwidth =
      ((active.size / durationNs) * 1_000_000_000) / (1024 * 1024 * 1024);

    const transfer: TransferRecord = {
      id,
      direction: active.direction as any,
      size: active.size,
      startTime: active.startTime,
      endTime,
      duration: durationNs,
      bandwidth,
      async: false,
    };

    this.transfers.push(transfer);
    this.activeTransfers.delete(id);

    // Update direction stats
    this.updateDirectionStats(transfer);

    return bandwidth;
  }

  /**
   * Record a transfer directly
   *
   * @param transfer - Transfer record
   */
  recordTransfer(transfer: TransferRecord): void {
    this.transfers.push(transfer);
    this.updateDirectionStats(transfer);
  }

  /**
   * Update direction-specific statistics
   */
  private updateDirectionStats(transfer: TransferRecord): void {
    let stats = this.directionStats.get(transfer.direction);

    if (!stats) {
      stats = {
        direction: transfer.direction,
        count: 0,
        totalBytes: 0,
        avgSize: 0,
        totalDuration: 0,
        avgBandwidth: 0,
        peakBandwidth: 0,
        bandwidthSamples: [],
      };
      this.directionStats.set(transfer.direction, stats);
    }

    stats.count++;
    stats.totalBytes += transfer.size;
    stats.avgSize = stats.totalBytes / stats.count;
    stats.totalDuration += transfer.duration;
    stats.avgBandwidth =
      stats.totalDuration > 0
        ? ((stats.totalBytes / stats.totalDuration) * 1_000_000_000) /
          (1024 * 1024 * 1024)
        : 0;
    stats.peakBandwidth = Math.max(stats.peakBandwidth, transfer.bandwidth);
    stats.bandwidthSamples.push(transfer.bandwidth);
  }

  /**
   * Get statistics for a specific direction
   *
   * @param direction - Transfer direction
   * @returns Direction statistics
   */
  getDirectionStats(
    direction: "host-to-device" | "device-to-host" | "device-to-device"
  ): Statistics | undefined {
    const stats = this.directionStats.get(direction);
    if (!stats) return undefined;

    const sortedBandwidth = [...stats.bandwidthSamples].sort((a, b) => a - b);
    const count = sortedBandwidth.length;

    return {
      count,
      min: Math.min(...sortedBandwidth),
      max: stats.peakBandwidth,
      mean: stats.avgBandwidth,
      median: count > 0 ? sortedBandwidth[Math.floor(count / 2)] : 0,
      stdDev: this.calculateStdDev(sortedBandwidth, stats.avgBandwidth),
      variance: this.calculateVariance(sortedBandwidth, stats.avgBandwidth),
      percentiles: this.calculatePercentiles(sortedBandwidth),
    };
  }

  /**
   * Get all direction statistics
   */
  getAllDirectionStats(): Map<string, Statistics> {
    const result = new Map<string, Statistics>();
    for (const direction of this.directionStats.keys()) {
      const stats = this.getDirectionStats(direction as any);
      if (stats) {
        result.set(direction, stats);
      }
    }
    return result;
  }

  /**
   * Analyze bandwidth by transfer size
   *
   * @param bucketCount - Number of size buckets
   * @returns Array of size buckets
   */
  analyzeBandwidthBySize(bucketCount = 10): SizeBucket[] {
    const sizeBuckets: SizeBucket[] = [];

    // Find min and max sizes
    const sizes = this.transfers.map(t => t.size);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const bucketWidth = (maxSize - minSize) / bucketCount;

    // Create buckets
    for (let i = 0; i < bucketCount; i++) {
      sizeBuckets.push({
        minSize: minSize + i * bucketWidth,
        maxSize: minSize + (i + 1) * bucketWidth,
        count: 0,
        avgBandwidth: 0,
        peakBandwidth: 0,
      });
    }

    // Fill buckets
    for (const transfer of this.transfers) {
      const bucketIndex = Math.min(
        Math.floor((transfer.size - minSize) / bucketWidth),
        bucketCount - 1
      );
      const bucket = sizeBuckets[bucketIndex];

      bucket.count++;
      bucket.peakBandwidth = Math.max(bucket.peakBandwidth, transfer.bandwidth);

      // Calculate average incrementally
      bucket.avgBandwidth =
        (bucket.avgBandwidth * (bucket.count - 1) + transfer.bandwidth) /
        bucket.count;
    }

    return sizeBuckets;
  }

  /**
   * Get peak bandwidth achieved
   *
   * @param direction - Optional direction filter
   * @returns Peak bandwidth in GB/s
   */
  getPeakBandwidth(direction?: string): number {
    let transfers = this.transfers;
    if (direction) {
      transfers = transfers.filter(t => t.direction === direction);
    }
    return transfers.length > 0
      ? Math.max(...transfers.map(t => t.bandwidth))
      : 0;
  }

  /**
   * Get average bandwidth
   *
   * @param direction - Optional direction filter
   * @returns Average bandwidth in GB/s
   */
  getAverageBandwidth(direction?: string): number {
    let transfers = this.transfers;
    if (direction) {
      transfers = transfers.filter(t => t.direction === direction);
    }

    if (transfers.length === 0) return 0;

    const totalBytes = transfers.reduce((sum, t) => sum + t.size, 0);
    const totalDuration = transfers.reduce((sum, t) => sum + t.duration, 0);

    return totalDuration > 0
      ? ((totalBytes / totalDuration) * 1_000_000_000) / (1024 * 1024 * 1024)
      : 0;
  }

  /**
   * Get total bytes transferred
   *
   * @param direction - Optional direction filter
   * @returns Total bytes
   */
  getTotalBytes(direction?: string): number {
    let transfers = this.transfers;
    if (direction) {
      transfers = transfers.filter(t => t.direction === direction);
    }
    return transfers.reduce((sum, t) => sum + t.size, 0);
  }

  /**
   * Get total transfer time
   *
   * @param direction - Optional direction filter
   * @returns Total duration in nanoseconds
   */
  getTotalTransferTime(direction?: string): number {
    let transfers = this.transfers;
    if (direction) {
      transfers = transfers.filter(t => t.direction === direction);
    }
    return transfers.reduce((sum, t) => sum + t.duration, 0);
  }

  /**
   * Get transfer timeline
   *
   * @returns Array of transfer records
   */
  getTimeline(): TransferRecord[] {
    return [...this.transfers];
  }

  /**
   * Get transfers by size range
   *
   * @param minSize - Minimum size in bytes
   * @param maxSize - Maximum size in bytes
   * @returns Filtered transfers
   */
  getTransfersBySize(minSize: number, maxSize: number): TransferRecord[] {
    return this.transfers.filter(t => t.size >= minSize && t.size <= maxSize);
  }

  /**
   * Get slowest transfers
   *
   * @param limit - Maximum number to return
   * @returns Sorted array of slowest transfers
   */
  getSlowestTransfers(limit = 10): TransferRecord[] {
    return [...this.transfers]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get fastest transfers
   *
   * @param limit - Maximum number to return
   * @returns Sorted array of fastest transfers
   */
  getFastestTransfers(limit = 10): TransferRecord[] {
    return [...this.transfers]
      .sort((a, b) => a.duration - b.duration)
      .slice(0, limit);
  }

  /**
   * Get performance metrics
   *
   * @returns Array of performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    const metrics: PerformanceMetric[] = [];

    for (const [direction, stats] of this.directionStats) {
      const directionKey = direction.replace("-", "_");

      metrics.push({
        name: `transfer-${directionKey}-count`,
        type: "throughput",
        value: stats.count,
        unit: "ops",
        min: 0,
        max: stats.count,
        avg: stats.count,
        sampleCount: 1,
        firstSample: 0,
        lastSample: 0,
      });

      metrics.push({
        name: `transfer-${directionKey}-bandwidth`,
        type: "throughput",
        value: stats.avgBandwidth,
        unit: "GB/s",
        min: 0,
        max: stats.peakBandwidth,
        avg: stats.avgBandwidth,
        sampleCount: stats.bandwidthSamples.length,
        firstSample: 0,
        lastSample: 0,
      });

      metrics.push({
        name: `transfer-${directionKey}-bytes`,
        type: "memory",
        value: stats.totalBytes,
        unit: "bytes",
        min: 0,
        max: stats.totalBytes,
        avg: stats.totalBytes,
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
    this.transfers = [];
    this.activeTransfers.clear();
    this.directionStats.clear();
    this.transferCounter = 0;
  }

  /**
   * Get total transfer count
   */
  getCount(): number {
    return this.transfers.length;
  }
}
