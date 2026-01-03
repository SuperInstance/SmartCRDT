/**
 * Event Buffer
 *
 * Buffers SSE events during disconnection for replay on reconnect.
 * Supports size limits and automatic overflow handling.
 */

import type { SSEEvent, BufferedEvent } from "./types.js";
import { BufferOverflowError } from "./types.js";

/**
 * Event buffer configuration
 */
export interface EventBufferConfig {
  /** Maximum buffer size in bytes (0 = unlimited) */
  maxBufferSize: number;
  /** Maximum number of events to buffer (0 = unlimited) */
  maxEventCount: number;
  /** Whether to evict oldest events when buffer is full */
  evictOldest: boolean;
  /** Whether to enable buffer compression */
  enableCompression: boolean;
}

/**
 * Default event buffer configuration
 */
export const DEFAULT_BUFFER_CONFIG: EventBufferConfig = {
  maxBufferSize: 1024 * 1024, // 1MB
  maxEventCount: 1000,
  evictOldest: true,
  enableCompression: false,
};

/**
 * Buffer statistics
 */
export interface BufferStats {
  /** Current number of buffered events */
  eventCount: number;
  /** Current buffer size in bytes */
  currentSize: number;
  /** Maximum buffer size */
  maxBufferSize: number;
  /** Buffer utilization percentage */
  utilizationPercentage: number;
  /** Number of events evicted due to overflow */
  eventsEvicted: number;
  /** Number of events added since buffer created */
  totalEventsAdded: number;
  /** Number of events replayed */
  totalEventsReplayed: number;
  /** Oldest event timestamp */
  oldestEventTimestamp: number | null;
  /** Newest event timestamp */
  newestEventTimestamp: number | null;
}

/**
 * Event buffer for SSE events
 */
export class EventBuffer {
  private events: BufferedEvent[];
  private currentSize: number;
  private config: EventBufferConfig;
  private eventsEvicted: number;
  private totalEventsAdded: number;
  private totalEventsReplayed: number;
  private nextBufferId: number;

  constructor(config: Partial<EventBufferConfig> = {}) {
    this.events = [];
    this.currentSize = 0;
    this.config = { ...DEFAULT_BUFFER_CONFIG, ...config };
    this.eventsEvicted = 0;
    this.totalEventsAdded = 0;
    this.totalEventsReplayed = 0;
    this.nextBufferId = 0;
  }

  /**
   * Buffer an event
   * @throws BufferOverflowError if buffer is full and evictOldest is false
   */
  bufferEvent(event: SSEEvent): BufferedEvent {
    const size = this.calculateEventSize(event);

    // Check if we need to evict events
    if (!this.canFit(size) && this.config.evictOldest) {
      this.evictOldestEvents(size);
    } else if (!this.canFit(size)) {
      throw new BufferOverflowError(
        `Buffer overflow: cannot fit event of size ${size} bytes`,
        this.currentSize,
        this.config.maxBufferSize
      );
    }

    // Create buffered event
    const bufferedEvent: BufferedEvent = {
      ...event,
      bufferId: `buffer-${this.nextBufferId++}`,
      bufferedAt: Date.now(),
      size,
    };

    this.events.push(bufferedEvent);
    this.currentSize += size;
    this.totalEventsAdded++;

    return bufferedEvent;
  }

  /**
   * Buffer multiple events
   */
  bufferEvents(events: SSEEvent[]): BufferedEvent[] {
    const buffered: BufferedEvent[] = [];

    for (const event of events) {
      try {
        buffered.push(this.bufferEvent(event));
      } catch (error) {
        if (error instanceof BufferOverflowError) {
          // Stop buffering on overflow
          break;
        }
        throw error;
      }
    }

    return buffered;
  }

  /**
   * Get all buffered events for replay
   */
  replayEvents(): BufferedEvent[] {
    this.totalEventsReplayed += this.events.length;
    return [...this.events];
  }

  /**
   * Replay events and clear buffer
   */
  replayAndClear(): BufferedEvent[] {
    const events = this.replayEvents();
    this.clearBuffer();
    return events;
  }

  /**
   * Clear the buffer
   */
  clearBuffer(): void {
    this.events = [];
    this.currentSize = 0;
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.currentSize;
  }

  /**
   * Get buffer event count
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Set buffer size limit
   */
  setBufferSizeLimit(bytes: number): void {
    this.config.maxBufferSize = bytes;

    // Evict events if necessary
    while (this.currentSize > bytes && this.events.length > 0) {
      this.evictFirstEvent();
    }
  }

  /**
   * Set max event count limit
   */
  setMaxEventCount(count: number): void {
    this.config.maxEventCount = count;

    // Evict events if necessary
    while (this.events.length > count) {
      this.evictFirstEvent();
    }
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.events.length === 0;
  }

  /**
   * Check if buffer is full
   */
  isFull(): boolean {
    if (this.config.maxBufferSize === 0) {
      return false; // Unlimited size
    }

    return (
      this.currentSize >= this.config.maxBufferSize ||
      (this.config.maxEventCount > 0 &&
        this.events.length >= this.config.maxEventCount)
    );
  }

  /**
   * Get buffer utilization percentage
   */
  getUtilizationPercentage(): number {
    if (this.config.maxBufferSize === 0) {
      return 0; // Unlimited size
    }

    return (this.currentSize / this.config.maxBufferSize) * 100;
  }

  /**
   * Get buffer statistics
   */
  getStats(): BufferStats {
    const timestamps = this.events.map(e => e.timestamp || e.bufferedAt);

    return {
      eventCount: this.events.length,
      currentSize: this.currentSize,
      maxBufferSize: this.config.maxBufferSize,
      utilizationPercentage: this.getUtilizationPercentage(),
      eventsEvicted: this.eventsEvicted,
      totalEventsAdded: this.totalEventsAdded,
      totalEventsReplayed: this.totalEventsReplayed,
      oldestEventTimestamp:
        timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEventTimestamp:
        timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }

  /**
   * Get events by ID
   */
  getEventsById(eventId: string): BufferedEvent[] {
    return this.events.filter(e => e.id === eventId);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: string): BufferedEvent[] {
    return this.events.filter(e => e.event === eventType);
  }

  /**
   * Get events since timestamp
   */
  getEventsSince(timestamp: number): BufferedEvent[] {
    return this.events.filter(e => (e.timestamp || e.bufferedAt) >= timestamp);
  }

  /**
   * Remove events by ID
   */
  removeEventsById(eventId: string): number {
    const beforeCount = this.events.length;
    this.events = this.events.filter(e => {
      if (e.id === eventId) {
        this.currentSize -= e.size;
        return false;
      }
      return true;
    });
    return beforeCount - this.events.length;
  }

  /**
   * Peek at oldest event without removing
   */
  peekOldest(): BufferedEvent | null {
    return this.events.length > 0 ? this.events[0] : null;
  }

  /**
   * Peek at newest event without removing
   */
  peekNewest(): BufferedEvent | null {
    return this.events.length > 0 ? this.events[this.events.length - 1] : null;
  }

  /**
   * Trim events older than timestamp
   */
  trimOlderThan(timestamp: number): number {
    const beforeCount = this.events.length;
    this.events = this.events.filter(e => {
      const eventTime = e.timestamp || e.bufferedAt;
      if (eventTime < timestamp) {
        this.currentSize -= e.size;
        return false;
      }
      return true;
    });
    return beforeCount - this.events.length;
  }

  /**
   * Trim to maximum age (milliseconds)
   */
  trimToMaxAge(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    return this.trimOlderThan(cutoff);
  }

  /**
   * Reset buffer state
   */
  reset(): void {
    this.clearBuffer();
    this.eventsEvicted = 0;
    this.totalEventsAdded = 0;
    this.totalEventsReplayed = 0;
    this.nextBufferId = 0;
  }

  /**
   * Export buffer contents
   */
  export(): BufferedEvent[] {
    return [...this.events];
  }

  /**
   * Import events into buffer
   */
  import(events: BufferedEvent[]): void {
    for (const event of events) {
      try {
        this.bufferEvent(event);
      } catch (error) {
        // Skip events that don't fit
        if (!(error instanceof BufferOverflowError)) {
          throw error;
        }
      }
    }
  }

  /**
   * Check if an event can fit in the buffer
   */
  private canFit(eventSize: number): boolean {
    if (this.config.maxBufferSize === 0) {
      return true; // Unlimited size
    }

    const hasSizeSpace =
      this.currentSize + eventSize <= this.config.maxBufferSize;
    const hasCountSpace =
      this.config.maxEventCount === 0 ||
      this.events.length < this.config.maxEventCount;

    return hasSizeSpace && hasCountSpace;
  }

  /**
   * Evict oldest events to make room for new event
   */
  private evictOldestEvents(requiredSpace: number): void {
    while (!this.canFit(requiredSpace) && this.events.length > 0) {
      this.evictFirstEvent();
    }
  }

  /**
   * Remove the first (oldest) event from buffer
   */
  private evictFirstEvent(): void {
    const event = this.events.shift();
    if (event) {
      this.currentSize -= event.size;
      this.eventsEvicted++;
    }
  }

  /**
   * Calculate the size of an event in bytes
   */
  private calculateEventSize(event: SSEEvent): number {
    // Rough estimation of event size
    const idSize = (event.id || "").length * 2; // UTF-16
    const eventSize = (event.event || "").length * 2;
    const dataSize = event.data.length * 2;
    const timestampSize = event.timestamp ? 8 : 0; // 64-bit number

    return idSize + eventSize + dataSize + timestampSize + 32; // +32 for overhead
  }
}

/**
 * Create an event buffer with configuration
 */
export function createEventBuffer(
  config?: Partial<EventBufferConfig>
): EventBuffer {
  return new EventBuffer(config);
}
