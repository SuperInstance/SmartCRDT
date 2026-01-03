/**
 * SSEServer - Main SSE Server implementation
 *
 * Provides real-time streaming capabilities for Aequor responses,
 * CoAgents state, A2UI updates, and VL-JEPA embeddings using
 * Server-Sent Events (SSE) protocol.
 */

import type {
  SSEEvent,
  SSEChannel,
  SSEClient,
  ServerConfig,
  ServerStats,
  ServerStatus,
} from "./types.js";
import { SSEError, SSEErrorCode, DEFAULT_SERVER_CONFIG } from "./types.js";
import { ConnectionManager } from "./ConnectionManager.js";
import { ChannelManager } from "./ChannelManager.js";
import { EventDispatcher } from "./EventDispatcher.js";
import { HttpHandler, KeepAliveManager } from "./HttpHandler.js";

/**
 * SSE Server class
 */
export class SSEServer {
  private config: ServerConfig;
  private connectionManager: ConnectionManager;
  private channelManager: ChannelManager;
  private eventDispatcher: EventDispatcher;
  private httpHandler: HttpHandler;
  private keepAliveManager: KeepAliveManager;
  private server_started: boolean = false;
  private server_closed: boolean = false;
  private start_time: number = 0;
  private http_server: unknown | null = null;

  constructor(config?: Partial<ServerConfig>) {
    this.config = { ...DEFAULT_SERVER_CONFIG, ...config };

    // Initialize components
    this.connectionManager = new ConnectionManager({
      heartbeat_interval: this.config.ping_interval,
      connection_timeout: this.config.connection_timeout,
    });

    this.channelManager = new ChannelManager({
      auto_create: true,
      auto_delete: false,
    });

    this.eventDispatcher = new EventDispatcher({
      buffer_size: this.config.history_size,
      enable_batching: false,
    });

    this.httpHandler = new HttpHandler(
      this.connectionManager,
      this.eventDispatcher,
      this.channelManager,
      {
        endpoint: "/events",
        enable_cors: this.config.enable_cors,
        cors_origin: this.config.cors_origin,
        enable_compression: this.config.enable_compression,
      }
    );

    this.keepAliveManager = new KeepAliveManager(
      this.eventDispatcher,
      this.config.ping_interval
    );
  }

  /**
   * Start SSE server
   */
  async start(): Promise<void> {
    if (this.server_started) {
      throw new SSEError(
        SSEErrorCode.SERVER_START_FAILED,
        "Server is already running"
      );
    }

    if (this.server_closed) {
      throw new SSEError(
        SSEErrorCode.SERVER_START_FAILED,
        "Server has been closed, create a new instance"
      );
    }

    try {
      this.start_time = Date.now();
      this.server_started = true;

      // Create default channel
      this.createChannel("default");

      // In real implementation, start HTTP server here
      // For now, we simulate server start
      this.simulateServerStart();
    } catch (error) {
      this.server_started = false;
      throw new SSEError(
        SSEErrorCode.SERVER_START_FAILED,
        "Failed to start server",
        { error }
      );
    }
  }

  /**
   * Stop SSE server
   */
  async stop(): Promise<void> {
    if (!this.server_started) {
      throw new SSEError(
        SSEErrorCode.SERVER_STOP_FAILED,
        "Server is not running"
      );
    }

    try {
      // Disconnect all clients
      this.connectionManager.closeAll();

      // Close all channels
      this.channelManager.closeAll();

      // Close event dispatcher
      this.eventDispatcher.close();

      // Close keep-alive manager
      this.keepAliveManager.stopAll();

      // Close HTTP handler
      this.httpHandler.close();

      // In real implementation, stop HTTP server here
      this.simulateServerStop();

      this.server_started = false;
      this.server_closed = true;
    } catch (error) {
      throw new SSEError(
        SSEErrorCode.SERVER_STOP_FAILED,
        "Failed to stop server",
        { error }
      );
    }
  }

  /**
   * Create a new channel
   */
  createChannel(
    name: string,
    metadata?: {
      description?: string;
      persistent?: boolean;
      max_clients?: number;
      require_auth?: boolean;
    }
  ): SSEChannel {
    return this.channelManager.createChannel(name, metadata);
  }

  /**
   * Delete a channel
   */
  deleteChannel(name: string): boolean {
    return this.channelManager.deleteChannel(name);
  }

  /**
   * Force delete a channel
   */
  forceDeleteChannel(name: string): boolean {
    return this.channelManager.forceDeleteChannel(name);
  }

  /**
   * Get a channel
   */
  getChannel(name: string): SSEChannel | null {
    return this.channelManager.getChannel(name) || null;
  }

  /**
   * Get all channels
   */
  getAllChannels(): SSEChannel[] {
    return this.channelManager.getAllChannels();
  }

  /**
   * Check if channel exists
   */
  hasChannel(name: string): boolean {
    return this.channelManager.hasChannel(name);
  }

  /**
   * Broadcast event to channel
   */
  broadcast(channelName: string, event: SSEEvent): void {
    const channel = this.channelManager.getChannel(channelName);
    if (!channel) {
      throw new SSEError(
        SSEErrorCode.CHANNEL_NOT_FOUND,
        `Channel not found: ${channelName}`
      );
    }

    // Add to channel history
    this.channelManager.addEventToHistory(channelName, event);

    // Get all clients
    const clients = new Map(
      this.connectionManager.getAllClients().map(c => [c.client_id, c])
    );

    // Dispatch to channel
    this.eventDispatcher.dispatchToChannel(channel, clients, event);
  }

  /**
   * Send event to specific client
   */
  sendToClient(clientId: string, event: SSEEvent): void {
    const client = this.connectionManager.getClient(clientId);
    if (!client) {
      throw new SSEError(
        SSEErrorCode.CLIENT_NOT_FOUND,
        `Client not found: ${clientId}`
      );
    }

    this.eventDispatcher.dispatchToClient(client, event);
  }

  /**
   * Send event to multiple clients
   */
  sendToClients(
    clientIds: string[],
    event: SSEEvent
  ): {
    success: number;
    failed: number;
  } {
    const clients = clientIds
      .map(id => this.connectionManager.getClient(id))
      .filter((client): client is SSEClient => client !== undefined);

    return this.eventDispatcher.dispatchToClients(clients, event);
  }

  /**
   * Get total connected clients
   */
  getClientCount(): number {
    return this.connectionManager.getClientCount();
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): SSEClient | null {
    return this.connectionManager.getClient(clientId) || null;
  }

  /**
   * Get all clients
   */
  getAllClients(): SSEClient[] {
    return this.connectionManager.getAllClients();
  }

  /**
   * Get channel statistics
   */
  getChannelStats(): Record<
    string,
    {
      clients: number;
      messages_sent: number;
      messages_per_second: number;
      avg_message_size: number;
      uptime: number;
    }
  > {
    return this.channelManager.getAllChannelStats();
  }

  /**
   * Get channel client count
   */
  getChannelClientCount(channelName: string): number {
    return this.channelManager.getChannelClientCount(channelName);
  }

  /**
   * Get server statistics
   */
  getStats(): ServerStats {
    const uptime =
      this.start_time > 0
        ? Math.floor((Date.now() - this.start_time) / 1000)
        : 0;

    const channelStats = this.channelManager.getAllChannelStats();
    const totalEvents = this.eventDispatcher.getEventsSent();
    const totalBytes = this.eventDispatcher.getBytesSent();

    return {
      uptime,
      total_connections: this.connectionManager.getTotalConnections(),
      active_connections: this.connectionManager.getClientCount(),
      total_channels: this.channelManager.getTotalChannelsCreated(),
      active_channels: this.channelManager.getChannelCount(),
      total_events: totalEvents,
      events_per_second: uptime > 0 ? totalEvents / uptime : 0,
      total_bytes: totalBytes,
      bytes_per_second: uptime > 0 ? totalBytes / uptime : 0,
      avg_latency_ms: 0, // Track separately
      error_count: 0, // Track separately
      channel_stats: channelStats,
    };
  }

  /**
   * Get server status
   */
  getStatus(): ServerStatus {
    return {
      running: this.server_started,
      port: this.config.port,
      host: this.config.host,
      stats: this.getStats(),
    };
  }

  /**
   * Add middleware
   */
  use(middleware: {
    name: string;
    execute: (ctx: unknown, next: () => Promise<void>) => Promise<void>;
    priority?: number;
  }): void {
    this.httpHandler.use(middleware as any);
  }

  /**
   * Remove middleware
   */
  removeMiddleware(middlewareName: string): boolean {
    return this.httpHandler.remove(middlewareName);
  }

  /**
   * Subscribe client to channel
   */
  subscribe(clientId: string, channelName: string): boolean {
    const client = this.connectionManager.getClient(clientId);
    if (!client) {
      return false;
    }

    const added = this.channelManager.addClientToChannel(channelName, clientId);
    if (added) {
      this.connectionManager.subscribeToChannel(clientId, channelName);
    }

    return added;
  }

  /**
   * Unsubscribe client from channel
   */
  unsubscribe(clientId: string, channelName: string): boolean {
    const removed = this.channelManager.removeClientFromChannel(
      channelName,
      clientId
    );
    if (removed) {
      this.connectionManager.unsubscribeFromChannel(clientId, channelName);
    }

    return removed;
  }

  /**
   * Handle incoming connection
   */
  async handleConnection(
    req: {
      method: string;
      url: string;
      headers: Record<string, string>;
      query: Record<string, string>;
      lastEventId?: string;
    },
    res: unknown,
    onWrite: (data: string) => boolean,
    onEnd: () => void,
    onError: (error: Error) => void
  ): Promise<SSEClient> {
    const client = await this.httpHandler.handleConnection(
      req,
      res,
      onWrite,
      onEnd,
      onError
    );

    // Start keep-alive
    if (this.config.ping_interval > 0) {
      this.keepAliveManager.start(client);
    }

    return client;
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(clientId: string): void {
    this.keepAliveManager.stop(clientId);
    this.httpHandler.handleDisconnection(clientId);
  }

  /**
   * Get configuration
   */
  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ServerConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Simulate server start (for testing)
   */
  private simulateServerStart(): void {
    this.http_server = {
      listening: true,
      port: this.config.port,
      host: this.config.host,
    };
  }

  /**
   * Simulate server stop (for testing)
   */
  private simulateServerStop(): void {
    this.http_server = null;
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.server_started && !this.server_closed;
  }

  /**
   * Get HTTP handler (for advanced usage)
   */
  getHttpHandler() {
    return this.httpHandler;
  }

  /**
   * Get connection manager (for advanced usage)
   */
  getConnectionManager() {
    return this.connectionManager;
  }

  /**
   * Get channel manager (for advanced usage)
   */
  getChannelManager() {
    return this.channelManager;
  }

  /**
   * Get event dispatcher (for advanced usage)
   */
  getEventDispatcher() {
    return this.eventDispatcher;
  }
}

/**
 * Create a new SSE server instance
 */
export function createSSEServer(config?: Partial<ServerConfig>): SSEServer {
  return new SSEServer(config);
}

/**
 * Create SSE server with default configuration
 */
export function createDefaultSSEServer(): SSEServer {
  return new SSEServer(DEFAULT_SERVER_CONFIG);
}
