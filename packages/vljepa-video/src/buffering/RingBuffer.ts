/**
 * @lsi/vljepa-video/buffering/RingBuffer
 *
 * Ring buffer for circular frame buffering.
 *
 * @version 1.0.0
 */

import type { ProcessedFrame } from "../types.js";

/**
 * Ring buffer node
 */
interface RingBufferNode {
  frame: ProcessedFrame | null;
  next: RingBufferNode | null;
  prev: RingBufferNode | null;
}

/**
 * Ring buffer
 *
 * Fixed-size circular buffer for efficient frame buffering.
 */
export class RingBuffer {
  private buffer: (ProcessedFrame | null)[];
  private size: number;
  private head: number = 0;
  private tail: number = 0;
  private count: number = 0;
  private totalPushes: number = 0;
  private totalPops: number = 0;
  private overwrites: number = 0;

  constructor(size: number) {
    this.size = size;
    this.buffer = new Array(size).fill(null);
  }

  /**
   * Push frame to ring buffer
   */
  push(frame: ProcessedFrame): boolean {
    this.totalPushes++;

    if (this.count < this.size) {
      // Buffer not full, add to tail
      this.buffer[this.tail] = frame;
      this.tail = (this.tail + 1) % this.size;
      this.count++;
      return true;
    } else {
      // Buffer full, overwrite oldest
      this.buffer[this.tail] = frame;
      this.tail = (this.tail + 1) % this.size;
      this.head = this.tail; // Move head to new oldest
      this.overwrites++;
      return false;
    }
  }

  /**
   * Pop frame from ring buffer
   */
  pop(): ProcessedFrame | null {
    if (this.count === 0) {
      return null;
    }

    this.totalPops++;
    const frame = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.head = (this.head + 1) % this.size;
    this.count--;

    return frame;
  }

  /**
   * Peek at oldest frame
   */
  peek(): ProcessedFrame | null {
    if (this.count === 0) {
      return null;
    }

    return this.buffer[this.head];
  }

  /**
   * Peek at newest frame
   */
  peekNewest(): ProcessedFrame | null {
    if (this.count === 0) {
      return null;
    }

    const idx = (this.tail - 1 + this.size) % this.size;
    return this.buffer[idx];
  }

  /**
   * Get frame at index (0 = oldest)
   */
  get(index: number): ProcessedFrame | null {
    if (index < 0 || index >= this.count) {
      return null;
    }

    const actualIndex = (this.head + index) % this.size;
    return this.buffer[actualIndex];
  }

  /**
   * Get all frames in order (oldest to newest)
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
   * Get count of frames
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
    this.buffer.fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /**
   * Get buffer statistics
   */
  getStats(): {
    size: number;
    count: number;
    usagePercent: number;
    totalPushes: number;
    totalPops: number;
    overwrites: number;
  } {
    return {
      size: this.size,
      count: this.count,
      usagePercent: (this.count / this.size) * 100,
      totalPushes: this.totalPushes,
      totalPops: this.totalPops,
      overwrites: this.overwrites,
    };
  }

  /**
   * Resize buffer
   */
  resize(newSize: number): void {
    if (newSize === this.size) {
      return;
    }

    const frames = this.getAll();

    this.size = newSize;
    this.buffer = new Array(newSize).fill(null);
    this.head = 0;
    this.tail = 0;
    this.count = 0;

    // Re-add frames (up to new size)
    for (const frame of frames.slice(-newSize)) {
      this.push(frame);
    }
  }

  /**
   * Get frames in time range
   */
  getFramesInTimeRange(startTime: number, endTime: number): ProcessedFrame[] {
    const frames: ProcessedFrame[] = [];

    for (let i = 0; i < this.count; i++) {
      const frame = this.get(i);
      if (
        frame &&
        frame.frame.timestamp >= startTime &&
        frame.frame.timestamp <= endTime
      ) {
        frames.push(frame);
      }
    }

    return frames;
  }

  /**
   * Get newest N frames
   */
  getNewest(n: number): ProcessedFrame[] {
    const frames: ProcessedFrame[] = [];
    const start = Math.max(0, this.count - n);

    for (let i = start; i < this.count; i++) {
      const frame = this.get(i);
      if (frame) {
        frames.push(frame);
      }
    }

    return frames;
  }

  /**
   * Get oldest N frames
   */
  getOldest(n: number): ProcessedFrame[] {
    const frames: ProcessedFrame[] = [];
    const count = Math.min(n, this.count);

    for (let i = 0; i < count; i++) {
      const frame = this.get(i);
      if (frame) {
        frames.push(frame);
      }
    }

    return frames;
  }

  /**
   * Find frame by ID
   */
  findById(frameId: number): ProcessedFrame | null {
    for (let i = 0; i < this.count; i++) {
      const frame = this.get(i);
      if (frame && frame.frame.id === frameId) {
        return frame;
      }
    }

    return null;
  }

  /**
   * Remove frame by ID
   */
  removeById(frameId: number): boolean {
    for (let i = 0; i < this.count; i++) {
      const actualIndex = (this.head + i) % this.size;
      const frame = this.buffer[actualIndex];

      if (frame && frame.frame.id === frameId) {
        // Remove by shifting elements
        for (let j = i; j < this.count - 1; j++) {
          const currIdx = (this.head + j) % this.size;
          const nextIdx = (this.head + j + 1) % this.size;
          this.buffer[currIdx] = this.buffer[nextIdx];
        }

        this.buffer[(this.head + this.count - 1) % this.size] = null;
        this.tail = (this.tail - 1 + this.size) % this.size;
        this.count--;
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate memory usage (estimate)
   */
  getMemoryUsage(): number {
    let totalBytes = 0;

    for (let i = 0; i < this.count; i++) {
      const frame = this.get(i);
      if (frame) {
        totalBytes += frame.frame.data.length;
        totalBytes += frame.embedding.length * 4;
        totalBytes += 1000; // Metadata estimate
      }
    }

    return totalBytes / (1024 * 1024); // Convert to MB
  }
}
