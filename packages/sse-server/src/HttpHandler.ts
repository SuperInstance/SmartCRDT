/**
 * HttpHandler - HTTP request handling for SSE
 *
 * Handles SSE endpoint (GET /events), CORS for SSE,
 * Last-Event-ID header, client disconnection, keep-alive management.
 */

import type {
  SSEConnection,
  SSEClient,
  IncomingRequest,
  MiddlewareContext,
  SSEMiddleware,
} from "./types.js";
import { SSEError, SSEErrorCode } from "./types.js";
import { ConnectionManager } from "./ConnectionManager.js";
import { EventDispatcher } from "./EventDispatcher.js";
import { ChannelManager } from "./ChannelManager.js";

/**
 * HTTP response wrapper for SSE
 */
class SSEConnectionImpl implements SSEConnection {
  private closed: boolean = false;

  constructor(
    private _res: unknown,
    private onWrite: (data: string) => boolean,
    private onEnd: () => void,
    private onErrorHandler: (error: Error) => void
  ) {}

  write(data: string): boolean {
    if (this.closed) {
      return false;
    }
    return this.onWrite(data);
  }

  end(): void {
    if (!this.closed) {
      this.closed = true;
      this.onEnd();
    }
  }

  isWritable(): boolean {
    return !this.closed;
  }

  setTimeout(_ms: number): void {
    // In real implementation, set socket timeout
  }

  onError(error: Error): void {
    if (!this.closed) {
      this.onErrorHandler(error);
    }
  }

  onClose(): void {
    this.end();
  }
}

/**
 * HTTP Handler options
 */
export interface HttpHandlerOptions {
  /** SSE endpoint path */
  endpoint: string;
  /** Enable CORS */
  enable_cors: boolean;
  /** CORS origin */
  cors_origin: string;
  /** CORS headers */
  cors_headers: Record<string, string>;
  /** Custom SSE headers */
  sse_headers: Record<string, string>;
  /** Enable compression */
  enable_compression: boolean;
}

/**
 * Default HTTP handler options
 */
const DEFAULT_OPTIONS: HttpHandlerOptions = {
  endpoint: "/events",
  enable_cors: true,
  cors_origin: "*",
  cors_headers: {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Last-Event-ID, Cache-Control",
    "Access-Control-Max-Age": "86400",
  },
  sse_headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  },
  enable_compression: false,
};

/**
 * HTTP Handler class
 */
export class HttpHandler {
  private options: HttpHandlerOptions;
  private connectionManager: ConnectionManager;
  private eventDispatcher: EventDispatcher;
  private channelManager: ChannelManager;
  private middleware: SSEMiddleware[] = [];
  private closed: boolean = false;

  constructor(
    connectionManager: ConnectionManager,
    eventDispatcher: EventDispatcher,
    channelManager: ChannelManager,
    options?: Partial<HttpHandlerOptions>
  ) {
    this.connectionManager = connectionManager;
    this.eventDispatcher = eventDispatcher;
    this.channelManager = channelManager;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Handle SSE connection request
   */
  async handleConnection(
    req: IncomingRequest,
    res: unknown,
    onWrite: (data: string) => boolean,
    onEnd: () => void,
    onError: (error: Error) => void
  ): Promise<SSEClient> {
    if (this.closed) {
      throw new SSEError(
        SSEErrorCode.SERVER_START_FAILED,
        "HTTP handler is closed"
      );
    }

    // Validate method
    if (req.method !== "GET" && req.method !== "OPTIONS") {
      throw new SSEError(SSEErrorCode.INVALID_EVENT, "Method not allowed", {
        method: req.method,
        allowed: ["GET", "OPTIONS"],
      });
    }

    // Handle OPTIONS preflight
    if (req.method === "OPTIONS") {
      // Send CORS headers
      return this.createDummyClient();
    }

    // Extract channel from query
    const channel = req.query.channel || "default";

    // Create SSE connection
    const connection = new SSEConnectionImpl(res, onWrite, onEnd, onError);

    // Add client
    const lastEventId = req.lastEventId || null;
    const client = this.connectionManager.addClient(
      connection,
      req.headers,
      lastEventId
    );

    // Subscribe to channel
    this.channelManager.addClientToChannel(channel, client.client_id);
    this.connectionManager.subscribeToChannel(client.client_id, channel);

    // Send SSE headers
    this.sendSSEHeaders(onWrite);

    // Send retry timeout
    this.sendRetryTimeout(onWrite, 5000);

    // Replay missed events if Last-Event-ID provided
    if (lastEventId) {
      await this.replayEvents(client, channel, lastEventId, onWrite);
    }

    // Execute middleware
    await this.executeMiddleware({
      req,
      res: connection,
      clientId: client.client_id,
      channel,
      metadata: new Map(),
    });

    return client;
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId: string): void {
    // Unsubscribe from all channels
    const channels =
      this.connectionManager.getClient(clientId)?.subscriptions || new Set();

    for (const channel of channels) {
      this.channelManager.removeClientFromChannel(channel, clientId);
    }

    // Remove client
    this.connectionManager.removeClient(clientId);
  }

  /**
   * Add middleware
   */
  use(middleware: SSEMiddleware): void {
    this.middleware.push(middleware);
    // Sort by priority
    this.middleware.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove middleware
   */
  remove(middlewareName: string): boolean {
    const index = this.middleware.findIndex(m => m.name === middlewareName);
    if (index >= 0) {
      this.middleware.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Send SSE headers
   */
  private sendSSEHeaders(onWrite: (data: string) => boolean): void {
    // Headers are sent by the server, but we can send initial comment
    onWrite(":sse-server-connected\n\n");
  }

  /**
   * Send retry timeout
   */
  private sendRetryTimeout(
    onWrite: (data: string) => boolean,
    timeout: number
  ): void {
    onWrite(`retry: ${timeout}\n\n`);
  }

  /**
   * Replay missed events
   */
  private async replayEvents(
    client: SSEClient,
    channel: string,
    lastEventId: string,
    onWrite: (data: string) => boolean
  ): Promise<void> {
    // Get channel history
    const history = this.channelManager.getChannelHistory(channel, lastEventId);

    // Replay events
    for (const event of history) {
      const serialized = this.eventDispatcher.serializeEvent(event);
      onWrite(serialized.raw);
    }
  }

  /**
   * Execute middleware chain
   */
  private async executeMiddleware(context: MiddlewareContext): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        await middleware.execute(context, next);
      }
    };

    await next();
  }

  /**
   * Generate CORS headers
   */
  generateCORSHeaders(): Record<string, string> {
    if (!this.options.enable_cors) {
      return {};
    }

    return {
      "Access-Control-Allow-Origin": this.options.cors_origin,
      ...this.options.cors_headers,
    };
  }

  /**
   * Generate SSE headers
   */
  generateSSEHeaders(): Record<string, string> {
    return {
      ...this.options.sse_headers,
      ...this.generateCORSHeaders(),
    };
  }

  /**
   * Close handler
   */
  close(): void {
    this.closed = true;
  }

  /**
   * Create dummy client for OPTIONS requests
   */
  private createDummyClient(): SSEClient {
    const dummyConnection: SSEConnection = {
      write: () => false,
      end: () => {},
      isWritable: () => false,
      setTimeout: () => {},
      onError: () => {},
      onClose: () => {},
    };

    return {
      client_id: "dummy",
      connection: dummyConnection,
      last_event_id: null,
      headers: {},
      state: "closed",
      subscriptions: new Set(),
      connected_at: Date.now(),
      last_activity: Date.now(),
    };
  }
}

/**
 * Keep-alive manager for SSE connections
 */
export class KeepAliveManager {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private eventDispatcher: EventDispatcher;
  private interval: number;

  constructor(eventDispatcher: EventDispatcher, interval: number = 30000) {
    this.eventDispatcher = eventDispatcher;
    this.interval = interval;
  }

  /**
   * Start keep-alive for client
   */
  start(client: SSEClient): void {
    this.stop(client.client_id);

    const timeout = setInterval(() => {
      if (client.connection.isWritable()) {
        this.eventDispatcher.dispatchPing(client);
      } else {
        this.stop(client.client_id);
      }
    }, this.interval);

    this.intervals.set(client.client_id, timeout);
  }

  /**
   * Stop keep-alive for client
   */
  stop(clientId: string): void {
    const timeout = this.intervals.get(clientId);
    if (timeout) {
      clearInterval(timeout);
      this.intervals.delete(clientId);
    }
  }

  /**
   * Stop all keep-alives
   */
  stopAll(): void {
    for (const timeout of this.intervals.values()) {
      clearInterval(timeout);
    }
    this.intervals.clear();
  }
}
