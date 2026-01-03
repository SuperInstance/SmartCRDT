/**
 * BufferManager - Manages event buffers for SSE clients
 *
 * Handles buffering of SSE events with size limits, priority tracking,
 * and overflow handling.
 */

import type {
  SSEEvent,
  BufferStats,
  EventPriority,
  DropStrategy,
} from "./types.js";
import { estimateEventSize, calculateBufferUsage } from "./types.js";

/**
 * Buffered event with metadata
 */
interface BufferedEvent {
  /** The event */
  event: SSEEvent;
  /** Event size in bytes */
  size: number;
  /** Timestamp when buffered */
  timestamp: number;
  /** Insertion order */
  order: number;
}

/**
 * Client buffer state
 */
interface ClientBuffer {
  /** Client identifier */
  clientId: string;
  /** Maximum buffer size in bytes */
  maxSize: number;
  /** Current buffer size in bytes */
  currentSize: number;
  /** Buffered events */
  events: BufferedEvent[];
  /** Next insertion order */
  nextOrder: number;
  /** Total events buffered */
  totalBuffered: number;
  /** Total events dropped */
  totalDropped: number;
  /** Total bytes dropped */
  totalBytesDropped: number;
  /** Drop strategy */
  dropStrategy: DropStrategy;
  /** Overflow count */
  overflowCount: number;
}

/**
 * Buffer flush result
 */
export interface BufferFlushResult {
  /** Number of events flushed */
  count: number;
  /** Events flushed */
  events: SSEEvent[];
  /** Bytes flushed */
  bytes: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * BufferManager - Main class
 */
export class BufferManager {
  private buffers: Map<string, ClientBuffer>;
  private defaultMaxSize: number;
  private defaultDropStrategy: DropStrategy;

  constructor(
    defaultMaxSize: number = 1024 * 1024, // 1MB default
    defaultDropStrategy: DropStrategy = "lowest-priority"
  ) {
    this.buffers = new Map();
    this.defaultMaxSize = defaultMaxSize;
    this.defaultDropStrategy = defaultDropStrategy;
  }

  /**
   * Buffer an event for a client
   * Returns true if buffered, false if dropped due to overflow
   */
  bufferEvent(
    clientId: string,
    event: SSEEvent,
    maxSize?: number,
    dropStrategy?: DropStrategy
  ): boolean {
    const buffer = this.getOrCreateBuffer(clientId, maxSize, dropStrategy);
    const eventSize = estimateEventSize(event);

    // Check if event would exceed buffer size
    if (eventSize > buffer.maxSize) {
      // Event is too large to ever fit
      buffer.totalDropped++;
      buffer.totalBytesDropped += eventSize;
      return false;
    }

    // Check if we need to drop events to make room
    while (
      buffer.currentSize + eventSize > buffer.maxSize &&
      buffer.events.length > 0
    ) {
      this.dropOneEvent(buffer, dropStrategy || buffer.dropStrategy);
    }

    // Check if still doesn't fit
    if (buffer.currentSize + eventSize > buffer.maxSize) {
      buffer.overflowCount++;
      buffer.totalDropped++;
      buffer.totalBytesDropped += eventSize;
      return false;
    }

    // Add event to buffer
    const bufferedEvent: BufferedEvent = {
      event,
      size: eventSize,
      timestamp: Date.now(),
      order: buffer.nextOrder++,
    };

    buffer.events.push(bufferedEvent);
    buffer.currentSize += eventSize;
    buffer.totalBuffered++;

    return true;
  }

  /**
   * Buffer multiple events
   * Returns number of events successfully buffered
   */
  bufferEvents(
    clientId: string,
    events: SSEEvent[],
    maxSize?: number,
    dropStrategy?: DropStrategy
  ): number {
    let buffered = 0;
    for (const event of events) {
      if (this.bufferEvent(clientId, event, maxSize, dropStrategy)) {
        buffered++;
      }
    }
    return buffered;
  }

  /**
   * Flush buffer for a client
   * Returns all buffered events and clears the buffer
   */
  flushBuffer(clientId: string): BufferFlushResult {
    const buffer = this.buffers.get(clientId);
    if (!buffer) {
      return {
        count: 0,
        events: [],
        bytes: 0,
        timestamp: Date.now(),
      };
    }

    const events = buffer.events.map(be => be.event);
    const bytes = buffer.currentSize;
    const count = buffer.events.length;

    // Clear buffer
    buffer.events = [];
    buffer.currentSize = 0;

    return {
      count,
      events,
      bytes,
      timestamp: Date.now(),
    };
  }

  /**
   * Get one event from buffer (without removing)
   */
  peek(clientId: string): SSEEvent | null {
    const buffer = this.buffers.get(clientId);
    if (!buffer || buffer.events.length === 0) {
      return null;
    }
    return buffer.events[0].event;
  }

  /**
   * Get and remove one event from buffer
   */
  dequeue(clientId: string): SSEEvent | null {
    const buffer = this.buffers.get(clientId);
    if (!buffer || buffer.events.length === 0) {
      return null;
    }

    const bufferedEvent = buffer.events.shift()!;
    buffer.currentSize -= bufferedEvent.size;
    return bufferedEvent.event;
  }

  /**
   * Get multiple events from buffer (up to count)
   */
  dequeueMultiple(clientId: string, count: number): SSEEvent[] {
    const events: SSEEvent[] = [];
    for (let i = 0; i < count; i++) {
      const event = this.dequeue(clientId);
      if (!event) break;
      events.push(event);
    }
    return events;
  }

  /**
   * Get buffer size in bytes
   */
  getBufferSize(clientId: string): number {
    const buffer = this.buffers.get(clientId);
    return buffer?.currentSize || 0;
  }

  /**
   * Get buffer stats for a client
   */
  getBufferStats(clientId: string): BufferStats | null {
    const buffer = this.buffers.get(clientId);
    if (!buffer) {
      return null;
    }

    const timestamps = buffer.events.map(be => be.timestamp);
    const oldest = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const newest = timestamps.length > 0 ? Math.max(...timestamps) : null;

    return {
      current_size: buffer.currentSize,
      max_size: buffer.maxSize,
      usage_percent: calculateBufferUsage(buffer.currentSize, buffer.maxSize),
      event_count: buffer.events.length,
      oldest_timestamp: oldest,
      newest_timestamp: newest,
      total_dropped: buffer.totalBytesDropped,
      events_dropped: buffer.totalDropped,
    };
  }

  /**
   * Get event count in buffer
   */
  getEventCount(clientId: string): number {
    const buffer = this.buffers.get(clientId);
    return buffer?.events.length || 0;
  }

  /**
   * Clear buffer for a client
   */
  clearBuffer(clientId: string): void {
    const buffer = this.buffers.get(clientId);
    if (buffer) {
      buffer.events = [];
      buffer.currentSize = 0;
    }
  }

  /**
   * Remove buffer for a client
   */
  removeBuffer(clientId: string): void {
    this.buffers.delete(clientId);
  }

  /**
   * Set buffer limit for a client
   */
  setBufferLimit(clientId: string, bytes: number): void {
    const buffer = this.getOrCreateBuffer(clientId, bytes, undefined);
    buffer.maxSize = bytes;

    // Drop events if over new limit
    while (buffer.currentSize > buffer.maxSize && buffer.events.length > 0) {
      this.dropOneEvent(buffer, buffer.dropStrategy);
    }
  }

  /**
   * Set drop strategy for a client
   */
  setDropStrategy(clientId: string, strategy: DropStrategy): void {
    const buffer = this.buffers.get(clientId);
    if (buffer) {
      buffer.dropStrategy = strategy;
    }
  }

  /**
   * Check if buffer is full
   */
  isFull(clientId: string): boolean {
    const buffer = this.buffers.get(clientId);
    if (!buffer) {
      return false;
    }
    return buffer.currentSize >= buffer.maxSize;
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(clientId: string): boolean {
    const buffer = this.buffers.get(clientId);
    if (!buffer) {
      return true;
    }
    return buffer.events.length === 0;
  }

  /**
   * Get all buffered client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.buffers.keys());
  }

  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalClients: number;
    totalEvents: number;
    totalBytes: number;
    totalDropped: number;
    averageUsage: number;
    maxUsage: number;
  } {
    const buffers = Array.from(this.buffers.values());

    const totalEvents = buffers.reduce((sum, b) => sum + b.events.length, 0);
    const totalBytes = buffers.reduce((sum, b) => sum + b.currentSize, 0);
    const totalDropped = buffers.reduce((sum, b) => sum + b.totalDropped, 0);

    const usages = buffers.map(b =>
      calculateBufferUsage(b.currentSize, b.maxSize)
    );
    const averageUsage =
      usages.length > 0
        ? usages.reduce((sum, u) => sum + u, 0) / usages.length
        : 0;
    const maxUsage = usages.length > 0 ? Math.max(...usages) : 0;

    return {
      totalClients: buffers.length,
      totalEvents,
      totalBytes,
      totalDropped,
      averageUsage,
      maxUsage,
    };
  }

  /**
   * Get or create client buffer
   */
  private getOrCreateBuffer(
    clientId: string,
    maxSize?: number,
    dropStrategy?: DropStrategy
  ): ClientBuffer {
    if (!this.buffers.has(clientId)) {
      this.buffers.set(clientId, {
        clientId,
        maxSize: maxSize || this.defaultMaxSize,
        currentSize: 0,
        events: [],
        nextOrder: 0,
        totalBuffered: 0,
        totalDropped: 0,
        totalBytesDropped: 0,
        dropStrategy: dropStrategy || this.defaultDropStrategy,
        overflowCount: 0,
      });
    }
    return this.buffers.get(clientId)!;
  }

  /**
   * Drop one event based on strategy
   */
  private dropOneEvent(buffer: ClientBuffer, strategy: DropStrategy): void {
    if (buffer.events.length === 0) {
      return;
    }

    let indexToDrop = 0;

    switch (strategy) {
      case "oldest":
        // Drop first event (oldest)
        indexToDrop = 0;
        break;

      case "newest":
        // Drop last event (newest)
        indexToDrop = buffer.events.length - 1;
        break;

      case "lowest-priority":
        // Find event with lowest priority
        let lowestScore = Infinity;
        for (let i = 0; i < buffer.events.length; i++) {
          const priority = buffer.events[i].event.priority || "normal";
          const score = this.getPriorityScore(priority);
          if (score < lowestScore) {
            lowestScore = score;
            indexToDrop = i;
          }
        }
        break;

      case "random":
        // Drop random event
        indexToDrop = Math.floor(Math.random() * buffer.events.length);
        break;
    }

    const dropped = buffer.events.splice(indexToDrop, 1)[0];
    buffer.currentSize -= dropped.size;
    buffer.totalDropped++;
    buffer.totalBytesDropped += dropped.size;
  }

  /**
   * Get priority score
   */
  private getPriorityScore(priority: EventPriority): number {
    switch (priority) {
      case "critical":
        return 1000;
      case "high":
        return 100;
      case "normal":
        return 10;
      case "low":
        return 1;
      default:
        return 10;
    }
  }

  /**
   * Clear all buffers
   */
  clear(): void {
    this.buffers.clear();
  }

  /**
   * Get buffer by priority (returns events sorted by priority)
   */
  getEventsByPriority(clientId: string): SSEEvent[] {
    const buffer = this.buffers.get(clientId);
    if (!buffer) {
      return [];
    }

    return [...buffer.events]
      .sort((a, b) => {
        const priorityA = a.event.priority || "normal";
        const priorityB = b.event.priority || "normal";
        const scoreA = this.getPriorityScore(priorityA);
        const scoreB = this.getPriorityScore(priorityB);
        return scoreB - scoreA; // Higher priority first
      })
      .map(be => be.event);
  }

  /**
   * Get events older than threshold
   */
  getOldEvents(clientId: string, ageMs: number): SSEEvent[] {
    const buffer = this.buffers.get(clientId);
    if (!buffer) {
      return [];
    }

    const now = Date.now();
    return buffer.events
      .filter(be => now - be.timestamp > ageMs)
      .map(be => be.event);
  }

  /**
   * Remove old events from buffer
   */
  removeOldEvents(clientId: string, ageMs: number): number {
    const buffer = this.buffers.get(clientId);
    if (!buffer) {
      return 0;
    }

    const now = Date.now();
    const initialCount = buffer.events.length;
    buffer.events = buffer.events.filter(be => {
      if (now - be.timestamp > ageMs) {
        buffer.currentSize -= be.size;
        buffer.totalDropped++;
        buffer.totalBytesDropped += be.size;
        return false;
      }
      return true;
    });

    return initialCount - buffer.events.length;
  }

  /**
   * Get buffer health status
   */
  getBufferHealth(clientId: string): {
    status: "healthy" | "warning" | "critical";
    usage: number;
    count: number;
    dropped: number;
  } {
    const stats = this.getBufferStats(clientId);
    if (!stats) {
      return { status: "healthy", usage: 0, count: 0, dropped: 0 };
    }

    let status: "healthy" | "warning" | "critical" = "healthy";
    if (stats.usage_percent >= 90) {
      status = "critical";
    } else if (stats.usage_percent >= 70) {
      status = "warning";
    }

    return {
      status,
      usage: stats.usage_percent,
      count: stats.event_count,
      dropped: stats.events_dropped,
    };
  }

  /**
   * Compact buffer by removing low priority events
   */
  compactBuffer(clientId: string, targetUsage: number = 50): number {
    const buffer = this.buffers.get(clientId);
    if (!buffer) {
      return 0;
    }

    const currentUsage = calculateBufferUsage(
      buffer.currentSize,
      buffer.maxSize
    );
    if (currentUsage <= targetUsage) {
      return 0;
    }

    // Sort events by priority (lowest first)
    const sortedByPriority = [...buffer.events].sort((a, b) => {
      const priorityA = a.event.priority || "normal";
      const priorityB = b.event.priority || "normal";
      return (
        this.getPriorityScore(priorityA) - this.getPriorityScore(priorityB)
      );
    });

    let removed = 0;
    for (const bufferedEvent of sortedByPriority) {
      if (
        calculateBufferUsage(buffer.currentSize, buffer.maxSize) <= targetUsage
      ) {
        break;
      }

      // Never drop critical events
      if (bufferedEvent.event.priority === "critical") {
        continue;
      }

      const index = buffer.events.indexOf(bufferedEvent);
      if (index !== -1) {
        buffer.events.splice(index, 1);
        buffer.currentSize -= bufferedEvent.size;
        buffer.totalDropped++;
        buffer.totalBytesDropped += bufferedEvent.size;
        removed++;
      }
    }

    return removed;
  }

  /**
   * Update default max size
   */
  setDefaultMaxSize(size: number): void {
    this.defaultMaxSize = size;
  }

  /**
   * Update default drop strategy
   */
  setDefaultDropStrategy(strategy: DropStrategy): void {
    this.defaultDropStrategy = strategy;
  }
}
