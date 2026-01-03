/**
 * @lsi/vljepa-video/buffering/FrameBuffer
 *
 * Frame buffer for buffering processed frames with various strategies.
 *
 * @version 1.0.0
 */

import type {
  ProcessedFrame,
  BufferConfig,
  BufferStats,
  FrameBuffer as FrameBufferInterface,
} from "../types.js";

/**
 * Frame buffer implementation
 *
 * Buffers processed frames using various strategies.
 */
export class FrameBuffer implements FrameBufferInterface {
  private config: BufferConfig;
  private buffer: ProcessedFrame[] = [];
  private stats = {
    totalPushes: 0,
    totalPops: 0,
    overwrites: 0,
    drops: 0,
  };

  constructor(config: BufferConfig) {
    this.config = config;
  }

  /**
   * Push frame to buffer
   */
  push(frame: ProcessedFrame): void {
    this.stats.totalPushes++;

    switch (this.config.type) {
      case "ring":
        this.pushRing(frame);
        break;
      case "adaptive":
        this.pushAdaptive(frame);
        break;
      case "priority":
        this.pushPriority(frame);
        break;
    }
  }

  /**
   * Pop frame from buffer
   */
  pop(): ProcessedFrame | null {
    if (this.buffer.length === 0) {
      return null;
    }

    this.stats.totalPops++;

    switch (this.config.strategy) {
      case "fifo":
        return this.buffer.shift()!;
      case "lru":
        // Sort by access time and pop oldest
        this.buffer.sort((a, b) => a.frame.timestamp - b.frame.timestamp);
        return this.buffer.shift()!;
      case "priority":
        // Sort by quality and pop highest
        this.buffer.sort(
          (a, b) => (b.quality?.score || 0) - (a.quality?.score || 0)
        );
        return this.buffer.shift()!;
      default:
        return this.buffer.shift()!;
    }
  }

  /**
   * Peek at next frame
   */
  peek(): ProcessedFrame | null {
    if (this.buffer.length === 0) {
      return null;
    }

    switch (this.config.strategy) {
      case "fifo":
        return this.buffer[0];
      case "lru":
        return this.buffer.sort(
          (a, b) => a.frame.timestamp - b.frame.timestamp
        )[0];
      case "priority":
        return this.buffer.sort(
          (a, b) => (b.quality?.score || 0) - (a.quality?.score || 0)
        )[0];
      default:
        return this.buffer[0];
    }
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get buffer statistics
   */
  stats(): BufferStats {
    const memoryUsage = this.calculateMemoryUsage();

    return {
      size: this.buffer.length,
      maxSize: this.config.size,
      usagePercent: (this.buffer.length / this.config.size) * 100,
      totalPushes: this.stats.totalPushes,
      totalPops: this.stats.totalPops,
      overwrites: this.stats.overwrites,
      drops: this.stats.drops,
      memoryUsageMB: memoryUsage,
    };
  }

  /**
   * Resize buffer
   */
  resize(size: number): void {
    this.config.size = size;

    // Trim buffer if necessary
    if (this.buffer.length > size) {
      this.buffer = this.buffer.slice(this.buffer.length - size);
      this.stats.overwrites += this.buffer.length - size;
    }
  }

  /**
   * Push to ring buffer
   */
  private pushRing(frame: ProcessedFrame): void {
    if (this.buffer.length >= this.config.size) {
      // Overwrite oldest
      this.buffer.shift();
      this.stats.overwrites++;
    }

    this.buffer.push(frame);
  }

  /**
   * Push to adaptive buffer
   */
  private pushAdaptive(frame: ProcessedFrame): void {
    // Calculate memory usage
    const memoryUsage = this.calculateMemoryUsage();
    const maxMemory = this.config.maxMemoryMB || 100;

    if (memoryUsage >= maxMemory && this.buffer.length >= this.config.size) {
      // Buffer is full, drop frame
      this.stats.drops++;
      return;
    }

    if (this.buffer.length >= this.config.size) {
      this.buffer.shift();
      this.stats.overwrites++;
    }

    this.buffer.push(frame);
  }

  /**
   * Push to priority buffer
   */
  private pushPriority(frame: ProcessedFrame): void {
    const qualityScore = frame.quality?.score || 0.5;

    if (this.buffer.length >= this.config.size) {
      // Find lowest quality frame
      let minIdx = -1;
      let minScore = qualityScore;

      for (let i = 0; i < this.buffer.length; i++) {
        const score = this.buffer[i].quality?.score || 0.5;
        if (score < minScore) {
          minScore = score;
          minIdx = i;
        }
      }

      if (minIdx >= 0) {
        // Replace with higher quality
        this.buffer[minIdx] = frame;
        this.stats.overwrites++;
      } else {
        // New frame has lowest quality, drop it
        this.stats.drops++;
      }
    } else {
      // Insert in sorted order
      let inserted = false;
      for (let i = 0; i < this.buffer.length; i++) {
        if (qualityScore >= (this.buffer[i].quality?.score || 0.5)) {
          this.buffer.splice(i, 0, frame);
          inserted = true;
          break;
        }
      }

      if (!inserted) {
        this.buffer.push(frame);
      }
    }
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalBytes = 0;

    for (const frame of this.buffer) {
      // Frame data
      totalBytes += frame.frame.data.length;

      // Embedding
      totalBytes += frame.embedding.length * 4; // Float32Array

      // Metadata
      totalBytes += 1000; // Estimate
    }

    return totalBytes / (1024 * 1024); // Convert to MB
  }

  /**
   * Get buffer contents (for debugging)
   */
  getContents(): ProcessedFrame[] {
    return [...this.buffer];
  }

  /**
   * Get frame by index
   */
  getFrame(index: number): ProcessedFrame | null {
    if (index < 0 || index >= this.buffer.length) {
      return null;
    }

    return this.buffer[index];
  }

  /**
   * Get frames in time range
   */
  getFramesInTimeRange(startTime: number, endTime: number): ProcessedFrame[] {
    return this.buffer.filter(
      f => f.frame.timestamp >= startTime && f.frame.timestamp <= endTime
    );
  }
}

/**
 * Ring buffer
 *
 * Fixed-size circular buffer.
 */
export class RingBuffer {
  private buffer: ProcessedFrame[] = [];
  private size: number;
  private head: number = 0;
  private count: number = 0;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Array(size);
  }

  /**
   * Push frame to ring buffer
   */
  push(frame: ProcessedFrame): void {
    this.buffer[this.head] = frame;
    this.head = (this.head + 1) % this.size;

    if (this.count < this.size) {
      this.count++;
    }
  }

  /**
   * Get frame at index
   */
  get(index: number): ProcessedFrame | null {
    if (index < 0 || index >= this.count) {
      return null;
    }

    const actualIndex =
      (this.head - this.count + index + this.size) % this.size;
    return this.buffer[actualIndex];
  }

  /**
   * Get all frames in order
   */
  getAll(): ProcessedFrame[] {
    const frames: ProcessedFrame[] = [];

    for (let i = 0; i < this.count; i++) {
      const frame = this.get(i);
      if (frame) {
        frames.push(frame);
      }
    }

    return frames;
  }

  /**
   * Get count
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Check if empty
   */
  isEmpty(): boolean {
    return this.count === 0;
  }

  /**
   * Check if full
   */
  isFull(): boolean {
    return this.count === this.size;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}

/**
 * Adaptive buffer
 *
 * Grows and shrinks based on memory usage and quality.
 */
export class AdaptiveBuffer {
  private buffer: ProcessedFrame[] = [];
  private maxSize: number;
  private minSize: number;
  private maxMemoryMB: number;
  private growthFactor: number = 1.5;
  private shrinkFactor: number = 0.7;

  constructor(minSize: number, maxSize: number, maxMemoryMB: number = 100) {
    this.minSize = minSize;
    this.maxSize = maxSize;
    this.maxMemoryMB = maxMemoryMB;
  }

  /**
   * Push frame to adaptive buffer
   */
  push(frame: ProcessedFrame): void {
    this.buffer.push(frame);

    // Check if we need to shrink
    if (this.shouldShrink()) {
      this.shrink();
    }
  }

  /**
   * Pop frame from buffer
   */
  pop(): ProcessedFrame | null {
    return this.buffer.shift() || null;
  }

  /**
   * Check if should grow
   */
  shouldGrow(): boolean {
    return (
      this.buffer.length >= this.minSize * 0.9 &&
      this.buffer.length < this.maxSize &&
      this.getMemoryUsage() < this.maxMemoryMB * 0.8
    );
  }

  /**
   * Check if should shrink
   */
  shouldShrink(): boolean {
    return (
      this.buffer.length > this.minSize &&
      (this.getMemoryUsage() > this.maxMemoryMB * 0.9 ||
        this.buffer.length >= this.maxSize)
    );
  }

  /**
   * Grow buffer
   */
  grow(): void {
    const newSize = Math.min(
      Math.floor(this.buffer.length * this.growthFactor),
      this.maxSize
    );

    // Keep highest quality frames
    this.buffer.sort(
      (a, b) => (b.quality?.score || 0) - (a.quality?.score || 0)
    );
    this.buffer = this.buffer.slice(0, newSize);
  }

  /**
   * Shrink buffer
   */
  shrink(): void {
    const newSize = Math.max(
      Math.floor(this.buffer.length * this.shrinkFactor),
      this.minSize
    );

    // Keep highest quality frames
    this.buffer.sort(
      (a, b) => (b.quality?.score || 0) - (a.quality?.score || 0)
    );
    this.buffer = this.buffer.slice(0, newSize);
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
   * Get buffer size
   */
  getSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.buffer = [];
  }
}
