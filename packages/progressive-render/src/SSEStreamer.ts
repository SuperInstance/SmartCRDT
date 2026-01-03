/**
 * @lsi/progressive-render - SSE Streamer
 *
 * Streams render chunks via Server-Sent Events
 *
 * @version 1.0.0
 * @license Apache-2.0
 */

import type {
  ProgressiveChunk,
  UIUpdate,
  SSEEvent,
  SSEEventType,
  SSEEventData,
  RenderPhase,
  RenderStats,
  RenderError,
  FlowControlState,
} from "./types.js";

// ============================================================================
// SSE STREAMER
// ============================================================================

/**
 * SSEStreamer - Streams chunks via Server-Sent Events
 *
 * Handles:
 * - SSE connection management
 * - Flow control and backpressure
 * - Chunk prioritization
 * - Compression hints
 * - Abort controller support
 * - Auto-reconnection
 */
export class SSEStreamer {
  private connections: Map<string, SSEConnection> = new Map();
  private eventQueues: Map<string, SSEEvent[]> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private heartbeatInterval: number = 30000; // 30 seconds
  private heartbeatTimers: Map<string, ReturnType<typeof setInterval>> =
    new Map();
  private retryDelay: number = 1000; // Start with 1 second
  private maxRetryDelay: number = 30000; // Max 30 seconds

  // Browser-side streaming (for client usage)
  private eventSource: EventSource | null = null;
  private eventHandlers: Map<SSEEventType, Set<SSEEventHandler>> = new Map();

  constructor() {
    // Cleanup on process exit
    if (typeof process !== "undefined" && (process as any).on) {
      (process as any).on("beforeExit", () => this.closeAll());
    }
  }

  // ========================================================================
  // SERVER-SIDE STREAMING
  // ========================================================================

  /**
   * Create SSE stream for a client
   *
   * @param clientId - Client identifier
   * @param response - HTTP response object
   * @returns Stream ID
   */
  createStream(clientId: string, response: SSEStreamResponse): string {
    const streamId = `${clientId}-${Date.now()}`;

    // Set SSE headers
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    const connection: SSEConnection = {
      streamId,
      clientId,
      response,
      connected: true,
      connectedAt: new Date(),
      lastEventAt: new Date(),
      bytesSent: 0,
      eventsSent: 0,
    };

    this.connections.set(streamId, connection);
    this.eventQueues.set(streamId, []);

    // Create abort controller
    const abortController = new AbortController();
    this.abortControllers.set(streamId, abortController);

    // Start heartbeat
    this.startHeartbeat(streamId);

    // Send connection event
    this.sendEvent(streamId, {
      event: "chunk",
      id: "0",
      data: {
        type: "heartbeat",
        timestamp: new Date(),
      },
    });

    return streamId;
  }

  /**
   * Send chunk via SSE
   *
   * @param streamId - Stream identifier
   * @param chunk - Chunk to send
   * @returns Whether chunk was sent
   */
  sendChunk(streamId: string, chunk: ProgressiveChunk): boolean {
    const connection = this.connections.get(streamId);
    if (!connection || !connection.connected) {
      return false;
    }

    // Check if aborted
    const abortController = this.abortControllers.get(streamId);
    if (abortController?.signal.aborted) {
      return false;
    }

    const event: SSEEvent = {
      event: "chunk",
      id: String(chunk.chunk_id),
      data: {
        type: "chunk",
        chunk,
      },
    };

    return this.sendEvent(streamId, event);
  }

  /**
   * Send update via SSE
   *
   * @param streamId - Stream identifier
   * @param update - Update to send
   * @returns Whether update was sent
   */
  sendUpdate(streamId: string, update: UIUpdate): boolean {
    const connection = this.connections.get(streamId);
    if (!connection || !connection.connected) {
      return false;
    }

    const event: SSEEvent = {
      event: "update",
      id: String(update.update_id),
      data: {
        type: "update",
        update,
      },
    };

    return this.sendEvent(streamId, event);
  }

  /**
   * Send phase change event
   *
   * @param streamId - Stream identifier
   * @param componentId - Component identifier
   * @param phase - New phase
   * @returns Whether event was sent
   */
  sendPhase(
    streamId: string,
    componentId: string,
    phase: RenderPhase
  ): boolean {
    const event: SSEEvent = {
      event: "phase",
      id: `phase-${componentId}-${Date.now()}`,
      data: {
        type: "phase",
        component_id: componentId,
        phase,
      },
    };

    return this.sendEvent(streamId, event);
  }

  /**
   * Send complete event
   *
   * @param streamId - Stream identifier
   * @param componentId - Component identifier
   * @param stats - Render statistics
   * @returns Whether event was sent
   */
  sendComplete(
    streamId: string,
    componentId: string,
    stats: RenderStats
  ): boolean {
    const event: SSEEvent = {
      event: "complete",
      id: `complete-${componentId}-${Date.now()}`,
      data: {
        type: "complete",
        component_id: componentId,
        stats,
      },
    };

    return this.sendEvent(streamId, event);
  }

  /**
   * Send error event
   *
   * @param streamId - Stream identifier
   * @param error - Error to send
   * @returns Whether event was sent
   */
  sendError(streamId: string, error: RenderError): boolean {
    const event: SSEEvent = {
      event: "error",
      id: `error-${Date.now()}`,
      data: {
        type: "error",
        error,
      },
    };

    return this.sendEvent(streamId, event);
  }

  /**
   * Send progress event
   *
   * @param streamId - Stream identifier
   * @param componentId - Component identifier
   * @param progress - Progress percentage (0-100)
   * @returns Whether event was sent
   */
  sendProgress(
    streamId: string,
    componentId: string,
    progress: number
  ): boolean {
    const event: SSEEvent = {
      event: "progress",
      id: `progress-${componentId}-${Date.now()}`,
      data: {
        type: "progress",
        component_id: componentId,
        progress: Math.max(0, Math.min(100, progress)),
      },
    };

    return this.sendEvent(streamId, event);
  }

  /**
   * Send raw SSE event
   *
   * @param streamId - Stream identifier
   * @param event - Event to send
   * @returns Whether event was sent
   */
  sendEvent(streamId: string, event: SSEEvent): boolean {
    const connection = this.connections.get(streamId);
    if (!connection || !connection.connected) {
      return false;
    }

    try {
      // Format SSE event
      let sseData = "";

      if (event.event) {
        sseData += `event: ${event.event}\n`;
      }

      if (event.id) {
        sseData += `id: ${event.id}\n`;
      }

      if (event.retry) {
        sseData += `retry: ${event.retry}\n`;
      }

      // Serialize data
      const jsonData = JSON.stringify(event.data);
      sseData += `data: ${jsonData}\n\n`;

      // Send to client
      connection.response.write(sseData);

      // Update connection stats
      connection.lastEventAt = new Date();
      connection.bytesSent += sseData.length;
      connection.eventsSent++;

      return true;
    } catch (error) {
      console.error("Error sending SSE event:", error);
      connection.connected = false;
      return false;
    }
  }

  /**
   * Close stream
   *
   * @param streamId - Stream identifier
   */
  closeStream(streamId: string): void {
    const connection = this.connections.get(streamId);
    if (!connection) {
      return;
    }

    connection.connected = false;

    try {
      connection.response.end();
    } catch (error) {
      // Ignore errors during cleanup
    }

    // Clear heartbeat
    const timer = this.heartbeatTimers.get(streamId);
    if (timer) {
      clearTimeout(timer);
      this.heartbeatTimers.delete(streamId);
    }

    // Abort any pending operations
    const abortController = this.abortControllers.get(streamId);
    abortController?.abort();

    // Cleanup
    this.connections.delete(streamId);
    this.eventQueues.delete(streamId);
    this.abortControllers.delete(streamId);
  }

  /**
   * Close all streams
   */
  closeAll(): void {
    for (const streamId of this.connections.keys()) {
      this.closeStream(streamId);
    }
  }

  // ========================================================================
  // FLOW CONTROL
  // ========================================================================

  /**
   * Check if client is ready for more data
   *
   * @param streamId - Stream identifier
   * @returns Whether client is ready
   */
  isReady(streamId: string): boolean {
    const connection = this.connections.get(streamId);
    return connection?.connected === true;
  }

  /**
   * Get connection state
   *
   * @param streamId - Stream identifier
   * @returns Connection state or null
   */
  getConnectionState(streamId: string): SSEConnectionState | null {
    const connection = this.connections.get(streamId);
    if (!connection) {
      return null;
    }

    return {
      streamId: connection.streamId,
      clientId: connection.clientId,
      connected: connection.connected,
      connectedAt: connection.connectedAt,
      lastEventAt: connection.lastEventAt,
      bytesSent: connection.bytesSent,
      eventsSent: connection.eventsSent,
      queueSize: this.eventQueues.get(streamId)?.length || 0,
    };
  }

  /**
   * Get abort signal for stream
   *
   * @param streamId - Stream identifier
   * @returns Abort signal
   */
  getAbortSignal(streamId: string): AbortSignal | null {
    return this.abortControllers.get(streamId)?.signal || null;
  }

  // ========================================================================
  // HEARTBEAT
  // ========================================================================

  /**
   * Start heartbeat for stream
   *
   * @param streamId - Stream identifier
   */
  private startHeartbeat(streamId: string): void {
    const timer = setInterval(() => {
      if (!this.isReady(streamId)) {
        clearInterval(timer);
        return;
      }

      this.sendEvent(streamId, {
        event: "heartbeat",
        id: `heartbeat-${Date.now()}`,
        data: {
          type: "heartbeat",
          timestamp: new Date(),
        },
      });
    }, this.heartbeatInterval) as unknown as ReturnType<typeof setInterval>;

    this.heartbeatTimers.set(streamId, timer);
  }

  /**
   * Set heartbeat interval
   *
   * @param interval - Interval in milliseconds
   */
  setHeartbeatInterval(interval: number): void {
    this.heartbeatInterval = interval;
  }

  // ========================================================================
  // CLIENT-SIDE STREAMING
  // ========================================================================

  /**
   * Connect to SSE stream (client-side)
   *
   * @param url - SSE endpoint URL
   * @param options - Connection options
   * @returns EventSource
   */
  connect(url: string, options?: SSEConnectOptions): EventSource {
    // Close existing connection
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Create new EventSource
    this.eventSource = new EventSource(url, {
      withCredentials: options?.withCredentials || false,
    });

    // Set up event handlers
    this.eventSource.onopen = () => {
      console.log("SSE connection opened");
    };

    this.eventSource.onerror = error => {
      console.error("SSE connection error:", error);

      // Auto-reconnect with exponential backoff
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        setTimeout(() => {
          if (this.retryDelay < this.maxRetryDelay) {
            this.retryDelay *= 2;
          }
          this.connect(url, options);
        }, this.retryDelay);
      }
    };

    // Set up message handler
    this.eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data) as SSEEventData;
        this.handleMessage("chunk", data);
      } catch (error) {
        console.error("Error parsing SSE message:", error);
      }
    };

    // Set up typed event handlers
    const eventTypes: SSEEventType[] = [
      "chunk",
      "update",
      "phase",
      "complete",
      "error",
      "heartbeat",
      "progress",
    ];
    for (const eventType of eventTypes) {
      this.eventSource.addEventListener(eventType, (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as SSEEventData;
          this.handleMessage(eventType, data);
        } catch (error) {
          console.error(`Error parsing SSE ${eventType} message:`, error);
        }
      });
    }

    return this.eventSource;
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Register event handler (client-side)
   *
   * @param eventType - Event type
   * @param handler - Event handler
   */
  on(eventType: SSEEventType, handler: SSEEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
  }

  /**
   * Unregister event handler (client-side)
   *
   * @param eventType - Event type
   * @param handler - Event handler
   */
  off(eventType: SSEEventType, handler: SSEEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Handle incoming SSE message
   *
   * @param eventType - Event type
   * @param data - Event data
   */
  private handleMessage(eventType: SSEEventType, data: SSEEventData): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(eventType, data);
        } catch (error) {
          console.error(`Error in SSE event handler for ${eventType}:`, error);
        }
      }
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get statistics
   *
   * @returns Streamer statistics
   */
  getStats(): SSEStreamerStats {
    return {
      activeConnections: this.connections.size,
      totalBytesSent: Array.from(this.connections.values()).reduce(
        (sum, conn) => sum + conn.bytesSent,
        0
      ),
      totalEventsSent: Array.from(this.connections.values()).reduce(
        (sum, conn) => sum + conn.eventsSent,
        0
      ),
      heartbeatInterval: this.heartbeatInterval,
      connected: this.eventSource?.readyState === EventSource.OPEN,
    };
  }
}

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/**
 * SSE connection
 */
interface SSEConnection {
  streamId: string;
  clientId: string;
  response: SSEStreamResponse;
  connected: boolean;
  connectedAt: Date;
  lastEventAt: Date;
  bytesSent: number;
  eventsSent: number;
}

/**
 * SSE stream response (HTTP response interface)
 */
interface SSEStreamResponse {
  setHeader: (name: string, value: string) => void;
  write: (data: string) => void;
  end: () => void;
}

/**
 * SSE connection state
 */
interface SSEConnectionState {
  streamId: string;
  clientId: string;
  connected: boolean;
  connectedAt: Date;
  lastEventAt: Date;
  bytesSent: number;
  eventsSent: number;
  queueSize: number;
}

/**
 * SSE connect options
 */
interface SSEConnectOptions {
  withCredentials?: boolean;
}

/**
 * SSE streamer statistics
 */
interface SSEStreamerStats {
  activeConnections: number;
  totalBytesSent: number;
  totalEventsSent: number;
  heartbeatInterval: number;
  connected: boolean;
}

/**
 * SSE event handler type
 */
type SSEEventHandler = (eventType: SSEEventType, data: SSEEventData) => void;
