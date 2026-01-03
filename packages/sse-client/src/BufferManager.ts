/**
 * BufferManager - Buffer messages while disconnected
 *
 * Handles buffering of SSE messages when connection is lost:
 * - Buffer messages while disconnected
 * - Replay buffer on reconnect
 * - Buffer size limits
 * - Priority-based buffering
 */

import type { SSEMessage, BufferedMessage, BufferStats } from "./types.js";

/**
 * Buffer configuration
 */
export interface BufferConfig {
  /** Maximum buffer size */
  maxSize: number;
  /** Enable buffer */
  enabled: boolean;
}

/**
 * BufferManager for managing message buffering
 */
export class BufferManager {
  private buffer: BufferedMessage[] = [];
  private maxSize: number;
  private enabled: boolean;

  constructor(config: BufferConfig) {
    this.maxSize = config.maxSize;
    this.enabled = config.enabled;
  }

  /**
   * Add a message to the buffer
   * @param message Message to buffer
   * @param priority Message priority
   * @returns True if message was buffered
   */
  add(
    message: SSEMessage,
    priority: "critical" | "normal" = "normal"
  ): boolean {
    if (!this.enabled) {
      return false;
    }

    // Check if buffer is full
    if (this.buffer.length >= this.maxSize) {
      // Remove oldest normal priority message first
      const normalIndex = this.buffer.findIndex(m => m.priority === "normal");
      if (normalIndex !== -1) {
        this.buffer.splice(normalIndex, 1);
      } else {
        // Only critical messages left, remove oldest
        this.buffer.shift();
      }
    }

    // Insert maintaining priority order (critical first, then by timestamp)
    const buffered: BufferedMessage = {
      message,
      priority,
      timestamp: Date.now(),
    };

    if (priority === "critical") {
      // Insert before first normal message
      const normalIndex = this.buffer.findIndex(m => m.priority === "normal");
      if (normalIndex !== -1) {
        this.buffer.splice(normalIndex, 0, buffered);
      } else {
        this.buffer.push(buffered);
      }
    } else {
      // Add to end (normal priority)
      this.buffer.push(buffered);
    }

    return true;
  }

  /**
   * Get all buffered messages
   * @returns Array of buffered messages
   */
  getAll(): BufferedMessage[] {
    return [...this.buffer];
  }

  /**
   * Get buffered messages by priority
   * @param priority Priority filter
   * @returns Array of buffered messages
   */
  getByPriority(priority: "critical" | "normal"): BufferedMessage[] {
    return this.buffer.filter(m => m.priority === priority);
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get buffer statistics
   * @returns Buffer statistics
   */
  getStats(): BufferStats {
    if (this.buffer.length === 0) {
      return {
        size: 0,
        criticalCount: 0,
        normalCount: 0,
        oldestTimestamp: null,
        newestTimestamp: null,
      };
    }

    const criticalMessages = this.buffer.filter(m => m.priority === "critical");
    const normalMessages = this.buffer.filter(m => m.priority === "normal");

    const timestamps = this.buffer.map(m => m.timestamp);
    const oldestTimestamp = Math.min(...timestamps);
    const newestTimestamp = Math.max(...timestamps);

    return {
      size: this.buffer.length,
      criticalCount: criticalMessages.length,
      normalCount: normalMessages.length,
      oldestTimestamp,
      newestTimestamp,
    };
  }

  /**
   * Get buffer size
   * @returns Current buffer size
   */
  get size(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is empty
   * @returns True if empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Check if buffer is full
   * @returns True if full
   */
  isFull(): boolean {
    return this.buffer.length >= this.maxSize;
  }

  /**
   * Remove messages older than specified timestamp
   * @param timestamp Timestamp cutoff
   * @returns Number of messages removed
   */
  removeOlderThan(timestamp: number): number {
    const initialSize = this.buffer.length;
    this.buffer = this.buffer.filter(m => m.timestamp >= timestamp);
    return initialSize - this.buffer.length;
  }

  /**
   * Remove messages newer than specified timestamp
   * @param timestamp Timestamp cutoff
   * @returns Number of messages removed
   */
  removeNewerThan(timestamp: number): number {
    const initialSize = this.buffer.length;
    this.buffer = this.buffer.filter(m => m.timestamp <= timestamp);
    return initialSize - this.buffer.length;
  }

  /**
   * Get buffer capacity percentage
   * @returns Capacity percentage (0-100)
   */
  getCapacity(): number {
    return (this.buffer.length / this.maxSize) * 100;
  }

  /**
   * Enable or disable buffering
   * @param enabled Enable state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Set maximum buffer size
   * @param size New maximum size
   */
  setMaxSize(size: number): void {
    this.maxSize = size;
    // Trim buffer if necessary
    while (this.buffer.length > this.maxSize) {
      // Remove oldest normal priority message first
      const normalIndex = this.buffer.findIndex(m => m.priority === "normal");
      if (normalIndex !== -1) {
        this.buffer.splice(normalIndex, 1);
      } else {
        this.buffer.shift();
      }
    }
  }

  /**
   * Peek at oldest message without removing
   * @returns Oldest message or null
   */
  peekOldest(): BufferedMessage | null {
    return this.buffer[0] ?? null;
  }

  /**
   * Peek at newest message without removing
   * @returns Newest message or null
   */
  peekNewest(): BufferedMessage | null {
    return this.buffer[this.buffer.length - 1] ?? null;
  }

  /**
   * Remove and return oldest message
   * @returns Oldest message or null
   */
  dequeueOldest(): BufferedMessage | null {
    return this.buffer.shift() ?? null;
  }

  /**
   * Remove and return newest message
   * @returns Newest message or null
   */
  dequeueNewest(): BufferedMessage | null {
    return this.buffer.pop() ?? null;
  }

  /**
   * Filter buffer by predicate
   * @param predicate Filter function
   * @returns Filtered messages
   */
  filter(predicate: (message: SSEMessage) => boolean): BufferedMessage[] {
    return this.buffer.filter(bm => predicate(bm.message));
  }

  /**
   * Find first message matching predicate
   * @param predicate Filter function
   * @returns Matching message or null
   */
  find(predicate: (message: SSEMessage) => boolean): BufferedMessage | null {
    return this.buffer.find(bm => predicate(bm.message)) ?? null;
  }

  /**
   * Get messages within time range
   * @param startTime Start timestamp
   * @param endTime End timestamp
   * @returns Messages in range
   */
  getInTimeRange(startTime: number, endTime: number): BufferedMessage[] {
    return this.buffer.filter(
      bm => bm.timestamp >= startTime && bm.timestamp <= endTime
    );
  }

  /**
   * Get buffer age in milliseconds
   * @returns Age of oldest message
   */
  getAge(): number | null {
    if (this.buffer.length === 0) {
      return null;
    }
    const now = Date.now();
    const oldestTimestamp = Math.min(...this.buffer.map(m => m.timestamp));
    return now - oldestTimestamp;
  }

  /**
   * Trim buffer to specified size
   * @param size Target size
   * @returns Number of messages removed
   */
  trim(size: number): number {
    const initialSize = this.buffer.length;
    while (this.buffer.length > size) {
      const normalIndex = this.buffer.findIndex(m => m.priority === "normal");
      if (normalIndex !== -1) {
        this.buffer.splice(normalIndex, 1);
      } else {
        this.buffer.shift();
      }
    }
    return initialSize - this.buffer.length;
  }

  /**
   * Clone the buffer
   * @returns Copy of buffer
   */
  clone(): BufferedMessage[] {
    return this.buffer.map(bm => ({ ...bm }));
  }

  /**
   * Export buffer as JSON
   * @returns JSON representation
   */
  toJSON(): object {
    return {
      size: this.buffer.length,
      maxSize: this.maxSize,
      enabled: this.enabled,
      messages: this.buffer.map(bm => ({
        ...bm.message,
        priority: bm.priority,
        bufferedAt: bm.timestamp,
      })),
    };
  }

  /**
   * Reset buffer manager
   */
  reset(): void {
    this.buffer = [];
    this.enabled = true;
  }

  /**
   * Check if buffer is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
