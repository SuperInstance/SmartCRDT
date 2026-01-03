/**
 * @lsi/vljepa-video/buffering/AdaptiveBuffer
 *
 * Adaptive buffer that grows and shrinks based on conditions.
 *
 * @version 1.0.0
 */

import type { ProcessedFrame } from "../types.js";

/**
 * Adaptive buffer configuration
 */
export interface AdaptiveBufferConfig {
  /** Initial buffer size */
  initialSize: number;

  /** Minimum buffer size */
  minSize: number;

  /** Maximum buffer size */
  maxSize: number;

  /** Maximum memory usage (MB) */
  maxMemoryMB: number;

  /** Growth factor */
  growthFactor: number;

  /** Shrink factor */
  shrinkFactor: number;

  /** Quality threshold for keeping frames */
  qualityThreshold: number;

  /** Whether to use memory-based adaptation */
  useMemoryBased: boolean;

  /** Whether to use quality-based adaptation */
  useQualityBased: boolean;
}

/**
 * Adaptive buffer
 *
 * Automatically grows and shrinks based on memory usage,
 * quality metrics, and other factors.
 */
export class AdaptiveBuffer {
  private config: AdaptiveBufferConfig;
  private buffer: ProcessedFrame[] = [];
  private totalPushes: number = 0;
  private totalPops: number = 0;
  private growthCount: number = 0;
  private shrinkCount: number = 0;

  constructor(config: AdaptiveBufferConfig) {
    this.config = {
      initialSize: config.initialSize || 30,
      minSize: config.minSize || 10,
      maxSize: config.maxSize || 100,
      maxMemoryMB: config.maxMemoryMB || 100,
      growthFactor: config.growthFactor || 1.5,
      shrinkFactor: config.shrinkFactor || 0.7,
      qualityThreshold: config.qualityThreshold || 0.5,
      useMemoryBased: config.useMemoryBased !== false,
      useQualityBased: config.useQualityBased !== false,
    };
  }

  /**
   * Push frame to adaptive buffer
   */
  push(frame: ProcessedFrame): boolean {
    this.totalPushes++;

    this.buffer.push(frame);

    // Check if we need to adapt
    this.adapt();

    return true;
  }

  /**
   * Pop frame from buffer
   */
  pop(): ProcessedFrame | null {
    if (this.buffer.length === 0) {
      return null;
    }

    this.totalPops++;
    return this.buffer.shift()!;
  }

  /**
   * Peek at oldest frame
   */
  peek(): ProcessedFrame | null {
    return this.buffer.length > 0 ? this.buffer[0] : null;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get buffer size
   */
  getSize(): number {
    return this.buffer.length;
  }

  /**
   * Check if should grow
   */
  shouldGrow(): boolean {
    const currentSize = this.buffer.length;
    const memoryUsage = this.getMemoryUsage();

    // Check if we're at capacity
    const atCapacity = currentSize >= this.config.maxSize;
    if (atCapacity) {
      return false;
    }

    // Check if we're near min size
    const nearMinSize = currentSize <= this.config.minSize * 1.1;
    if (nearMinSize && memoryUsage < this.config.maxMemoryMB * 0.7) {
      return true;
    }

    // Memory-based growth
    if (this.config.useMemoryBased) {
      const memoryPressure = memoryUsage / this.config.maxMemoryMB;
      if (memoryPressure < 0.7 && currentSize >= this.config.minSize) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if should shrink
   */
  shouldShrink(): boolean {
    const currentSize = this.buffer.length;
    const memoryUsage = this.getMemoryUsage();

    // Memory-based shrinking
    if (this.config.useMemoryBased) {
      const memoryPressure = memoryUsage / this.config.maxMemoryMB;
      if (memoryPressure > 0.9) {
        return true;
      }
    }

    // Size-based shrinking
    if (currentSize > this.config.maxSize * 0.9) {
      return true;
    }

    // Quality-based shrinking
    if (this.config.useQualityBased) {
      const lowQualityCount = this.buffer.filter(
        f => (f.quality?.score || 0) < this.config.qualityThreshold
      ).length;

      const lowQualityRatio = lowQualityCount / currentSize;
      if (lowQualityRatio > 0.5 && currentSize > this.config.minSize) {
        return true;
      }
    }

    return false;
  }

  /**
   * Grow buffer
   */
  grow(): void {
    const currentSize = this.buffer.length;

    if (currentSize >= this.config.maxSize) {
      return;
    }

    this.growthCount++;

    // Growth is implicit - we keep more frames
    // Buffer will grow naturally as we push
  }

  /**
   * Shrink buffer
   */
  shrink(): void {
    const currentSize = this.buffer.length;

    if (currentSize <= this.config.minSize) {
      return;
    }

    this.shrinkCount++;

    // Sort by quality
    this.buffer.sort(
      (a, b) => (b.quality?.score || 0) - (a.quality?.score || 0)
    );

    // Calculate target size
    let targetSize = Math.floor(currentSize * this.config.shrinkFactor);
    targetSize = Math.max(targetSize, this.config.minSize);

    // Keep highest quality frames
    this.buffer = this.buffer.slice(0, targetSize);
  }

  /**
   * Adapt buffer size based on conditions
   */
  adapt(): void {
    if (this.shouldGrow()) {
      this.grow();
    } else if (this.shouldShrink()) {
      this.shrink();
    }
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): number {
    let totalBytes = 0;

    for (const frame of this.buffer) {
      totalBytes += frame.frame.data.length;
      totalBytes += frame.embedding.length * 4;
      totalBytes += 1000; // Metadata estimate
    }

    return totalBytes / (1024 * 1024);
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    size: number;
    minSize: number;
    maxSize: number;
    memoryUsageMB: number;
    maxMemoryMB: number;
    totalPushes: number;
    totalPops: number;
    growthCount: number;
    shrinkCount: number;
    avgQuality: number;
  } {
    const qualitySum = this.buffer.reduce(
      (sum, f) => sum + (f.quality?.score || 0),
      0
    );
    const avgQuality =
      this.buffer.length > 0 ? qualitySum / this.buffer.length : 0;

    return {
      size: this.buffer.length,
      minSize: this.config.minSize,
      maxSize: this.config.maxSize,
      memoryUsageMB: this.getMemoryUsage(),
      maxMemoryMB: this.config.maxMemoryMB,
      totalPushes: this.totalPushes,
      totalPops: this.totalPops,
      growthCount: this.growthCount,
      shrinkCount: this.shrinkCount,
      avgQuality,
    };
  }

  /**
   * Get frames by quality range
   */
  getFramesByQuality(minQuality: number, maxQuality: number): ProcessedFrame[] {
    return this.buffer.filter(f => {
      const quality = f.quality?.score || 0;
      return quality >= minQuality && quality <= maxQuality;
    });
  }

  /**
   * Get frames in time range
   */
  getFramesInTimeRange(startTime: number, endTime: number): ProcessedFrame[] {
    return this.buffer.filter(
      f => f.frame.timestamp >= startTime && f.frame.timestamp <= endTime
    );
  }

  /**
   * Remove low quality frames
   */
  removeLowQuality(threshold: number = this.config.qualityThreshold): number {
    const beforeLength = this.buffer.length;

    this.buffer = this.buffer.filter(f => (f.quality?.score || 0) >= threshold);

    return beforeLength - this.buffer.length;
  }

  /**
   * Trim to highest quality N frames
   */
  trimToBest(n: number): void {
    this.buffer.sort(
      (a, b) => (b.quality?.score || 0) - (a.quality?.score || 0)
    );
    this.buffer = this.buffer.slice(0, n);
  }

  /**
   * Get oldest frame
   */
  getOldest(): ProcessedFrame | null {
    if (this.buffer.length === 0) {
      return null;
    }

    let oldest = this.buffer[0];
    for (const frame of this.buffer) {
      if (frame.frame.timestamp < oldest.frame.timestamp) {
        oldest = frame;
      }
    }

    return oldest;
  }

  /**
   * Get newest frame
   */
  getNewest(): ProcessedFrame | null {
    if (this.buffer.length === 0) {
      return null;
    }

    let newest = this.buffer[0];
    for (const frame of this.buffer) {
      if (frame.frame.timestamp > newest.frame.timestamp) {
        newest = frame;
      }
    }

    return newest;
  }
}
