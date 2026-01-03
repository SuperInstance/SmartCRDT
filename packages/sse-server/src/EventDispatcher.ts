/**
 * EventDispatcher - SSE Event serialization and dispatching
 *
 * Handles event serialization, buffering for reconnection,
 * event ID generation, retry logic, and batching.
 */

import type {
  SSEEvent,
  SerializedEvent,
  BufferedEvent,
  EventDispatcherConfig,
  SSEChannel,
  SSEClient,
} from "./types.js";
import { SSEError, SSEErrorCode } from "./types.js";

/**
 * Default event dispatcher configuration
 */
const DEFAULT_CONFIG: EventDispatcherConfig = {
  format: "json",
  buffer_size: 100,
  enable_batching: false,
  batch_size: 10,
  batch_timeout: 100,
};

/**
 * Event batch for aggregation
 */
interface EventBatch {
  events: SerializedEvent[];
  timeout: NodeJS.Timeout | null;
  recipients: Set<string>;
}

/**
 * Event Dispatcher class
 */
export class EventDispatcher {
  private config: EventDispatcherConfig;
  private event_counter: number = 0;
  private event_buffers: Map<string, BufferedEvent[]> = new Map();
  private batches: Map<string, EventBatch> = new Map();
  private bytes_sent: number = 0;
  private events_sent: number = 0;
  private closed: boolean = false;

  constructor(config?: Partial<EventDispatcherConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Serialize an event for transmission
   */
  serializeEvent(event: SSEEvent): SerializedEvent {
    const serialized: SerializedEvent = {
      raw: "",
      id: event.id,
      event: event.event || "message",
      retry: event.retry,
    };

    // Serialize data based on format
    let dataStr: string;
    try {
      switch (this.config.format) {
        case "json":
          dataStr = JSON.stringify(event.data);
          break;
        case "text":
          dataStr = String(event.data);
          break;
        case "binary":
          if (typeof event.data === "string") {
            dataStr = event.data;
          } else {
            // Base64 encode (using btoa for browser compatibility)
            const json = JSON.stringify(event.data);
            if (typeof btoa !== "undefined") {
              dataStr = btoa(json);
            } else {
              // Node.js fallback
              dataStr = Buffer.from(json).toString("base64");
            }
          }
          break;
        case "raw":
          dataStr = String(event.data);
          break;
        default:
          dataStr = JSON.stringify(event.data);
      }
    } catch (error) {
      throw new SSEError(
        SSEErrorCode.SERIALIZATION_FAILED,
        "Failed to serialize event data",
        { error, data: event.data }
      );
    }

    // Build SSE format string
    const lines: string[] = [];

    if (serialized.id) {
      lines.push(`id: ${serialized.id}`);
    }

    if (serialized.event) {
      lines.push(`event: ${serialized.event}`);
    }

    if (serialized.retry) {
      lines.push(`retry: ${serialized.retry}`);
    }

    // Split multi-line data
    for (const line of dataStr.split("\n")) {
      lines.push(`data: ${line}`);
    }

    lines.push(""); // Empty line to end event
    serialized.raw = lines.join("\n");

    return serialized;
  }

  /**
   * Dispatch event to a single client
   */
  dispatchToClient(
    client: SSEClient,
    event: SSEEvent,
    channel?: SSEChannel
  ): boolean {
    if (this.closed) {
      return false;
    }

    // Generate event ID if not present
    if (!event.id) {
      event.id = this.generateEventId(channel?.channel_name || "global");
    }

    // Serialize event
    const serialized = this.serializeEvent(event);

    // Buffer event for replay if channel provided
    if (channel) {
      this.bufferEvent(channel.channel_name, event);
    }

    // Write to connection
    try {
      const success = client.connection.write(serialized.raw);

      if (success) {
        this.bytes_sent += serialized.raw.length;
        this.events_sent++;
      }

      return success;
    } catch (error) {
      client.state = "error";
      return false;
    }
  }

  /**
   * Dispatch event to multiple clients
   */
  dispatchToClients(
    clients: SSEClient[],
    event: SSEEvent,
    channel?: SSEChannel
  ): { success: number; failed: number } {
    let success = 0;
    let failed = 0;

    for (const client of clients) {
      if (this.dispatchToClient(client, event, channel)) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * Dispatch event to channel
   */
  dispatchToChannel(
    channel: SSEChannel,
    clients: Map<string, SSEClient>,
    event: SSEEvent
  ): { success: number; failed: number } {
    // Filter clients subscribed to this channel
    const channelClients = Array.from(channel.clients)
      .map(clientId => clients.get(clientId))
      .filter((client): client is SSEClient => client !== undefined);

    return this.dispatchToClients(channelClients, event, channel);
  }

  /**
   * Dispatch ping/keep-alive event
   */
  dispatchPing(client: SSEClient): boolean {
    const pingEvent: SSEEvent = {
      event: "ping",
      data: { timestamp: Date.now() },
    };

    return this.dispatchToClient(client, pingEvent);
  }

  /**
   * Dispatch error event to client
   */
  dispatchError(
    client: SSEClient,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): boolean {
    const errorEvent: SSEEvent = {
      event: "error",
      data: {
        code,
        message,
        details,
        timestamp: Date.now(),
      },
    };

    return this.dispatchToClient(client, errorEvent);
  }

  /**
   * Buffer event for replay
   */
  private bufferEvent(channel: string, event: SSEEvent): void {
    if (this.config.buffer_size <= 0) {
      return;
    }

    let buffer = this.event_buffers.get(channel);
    if (!buffer) {
      buffer = [];
      this.event_buffers.set(channel, buffer);
    }

    const buffered: BufferedEvent = {
      event: { ...event },
      timestamp: Date.now(),
      channel,
      sequence: this.event_counter++,
    };

    buffer.push(buffered);

    // Trim buffer if needed
    if (buffer.length > this.config.buffer_size) {
      buffer.shift();
    }
  }

  /**
   * Get buffered events for replay
   */
  getBufferedEvents(channel: string, sinceEventId?: string): BufferedEvent[] {
    const buffer = this.event_buffers.get(channel);
    if (!buffer) {
      return [];
    }

    if (!sinceEventId) {
      return [...buffer];
    }

    // Find events since given ID
    const startIndex = buffer.findIndex(e => e.event.id === sinceEventId);
    if (startIndex === -1) {
      return [...buffer];
    }

    return buffer.slice(startIndex + 1);
  }

  /**
   * Clear event buffer for channel
   */
  clearBuffer(channel: string): boolean {
    return this.event_buffers.delete(channel);
  }

  /**
   * Clear all event buffers
   */
  clearAllBuffers(): void {
    this.event_buffers.clear();
  }

  /**
   * Get buffer size for channel
   */
  getBufferSize(channel: string): number {
    const buffer = this.event_buffers.get(channel);
    return buffer ? buffer.length : 0;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(source: string): string {
    return `${source}_${Date.now()}_${this.event_counter++}`;
  }

  /**
   * Get total bytes sent
   */
  getBytesSent(): number {
    return this.bytes_sent;
  }

  /**
   * Get total events sent
   */
  getEventsSent(): number {
    return this.events_sent;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.bytes_sent = 0;
    this.events_sent = 0;
  }

  /**
   * Close dispatcher
   */
  close(): void {
    // Clear all batches
    for (const batch of this.batches.values()) {
      if (batch.timeout) {
        clearTimeout(batch.timeout);
      }
    }
    this.batches.clear();

    // Clear all buffers
    this.event_buffers.clear();

    this.closed = true;
  }
}

/**
 * Event Retry Handler - manages retry logic for clients
 */
export class EventRetryHandler {
  private retry_intervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Schedule retry for client
   */
  scheduleRetry(clientId: string, callback: () => void, delay: number): void {
    // Clear existing retry
    this.cancelRetry(clientId);

    const timeout = setTimeout(() => {
      this.retry_intervals.delete(clientId);
      callback();
    }, delay);

    this.retry_intervals.set(clientId, timeout);
  }

  /**
   * Cancel retry for client
   */
  cancelRetry(clientId: string): boolean {
    const timeout = this.retry_intervals.get(clientId);
    if (timeout) {
      clearTimeout(timeout);
      this.retry_intervals.delete(clientId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all retries
   */
  cancelAllRetries(): void {
    for (const timeout of this.retry_intervals.values()) {
      clearTimeout(timeout);
    }
    this.retry_intervals.clear();
  }

  /**
   * Check if client has pending retry
   */
  hasPendingRetry(clientId: string): boolean {
    return this.retry_intervals.has(clientId);
  }
}

/**
 * Event Replay Handler - manages event replay for reconnection
 */
export class EventReplayHandler {
  private replay_buffers: Map<string, BufferedEvent[]> = new Map();

  /**
   * Add event to replay buffer
   */
  addEvent(channel: string, event: BufferedEvent): void {
    let buffer = this.replay_buffers.get(channel);
    if (!buffer) {
      buffer = [];
      this.replay_buffers.set(channel, buffer);
    }

    buffer.push(event);

    // Limit buffer size
    const max_size = 1000;
    if (buffer.length > max_size) {
      buffer.shift();
    }
  }

  /**
   * Get events for replay
   */
  getEvents(channel: string, fromSequence?: number): BufferedEvent[] {
    const buffer = this.replay_buffers.get(channel);
    if (!buffer) {
      return [];
    }

    if (fromSequence === undefined) {
      return [...buffer];
    }

    return buffer.filter(e => e.sequence > fromSequence);
  }

  /**
   * Get events since last event ID
   */
  getEventsSince(channel: string, lastEventId: string): BufferedEvent[] {
    const buffer = this.replay_buffers.get(channel);
    if (!buffer) {
      return [];
    }

    const index = buffer.findIndex(e => e.event.id === lastEventId);
    if (index === -1) {
      return [...buffer];
    }

    return buffer.slice(index + 1);
  }

  /**
   * Clear replay buffer
   */
  clearBuffer(channel: string): void {
    this.replay_buffers.delete(channel);
  }

  /**
   * Clear all replay buffers
   */
  clearAllBuffers(): void {
    this.replay_buffers.clear();
  }

  /**
   * Get buffer size
   */
  getBufferSize(channel: string): number {
    const buffer = this.replay_buffers.get(channel);
    return buffer ? buffer.length : 0;
  }
}
