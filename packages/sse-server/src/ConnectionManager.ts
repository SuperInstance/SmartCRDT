/**
 * ConnectionManager - Manages SSE client connections
 *
 * Handles client connection tracking, heartbeat/ping mechanism,
 * connection cleanup, reconnection support, and connection limits.
 */

import type {
  SSEClient,
  SSEConnection,
  ClientConnectionInfo,
  ConnectionManagerConfig,
  SSEEvent,
} from "./types.js";
import { SSEError, SSEErrorCode } from "./types.js";

/**
 * Default connection manager configuration
 */
const DEFAULT_CONFIG: ConnectionManagerConfig = {
  heartbeat_interval: 30000, // 30 seconds
  connection_timeout: 60000, // 60 seconds
  max_reconnect_attempts: 10,
  reconnect_delay: 1000, // 1 second
  enable_tracking: true,
  enable_rate_limiting: false,
  rate_limit_events_per_second: 100,
};

/**
 * Connection heartbeat data
 */
interface HeartbeatData {
  interval: NodeJS.Timeout | null;
  last_check: number;
}

/**
 * Rate limit data per client
 */
interface RateLimitData {
  events: number[];
  window_start: number;
}

/**
 * Connection Manager class
 */
export class ConnectionManager {
  private clients: Map<string, SSEClient> = new Map();
  private config: ConnectionManagerConfig;
  private heartbeat_data: Map<string, HeartbeatData> = new Map();
  private rate_limits: Map<string, RateLimitData> = new Map();
  private client_counter: number = 0;
  private heartbeat_interval: NodeJS.Timeout | null = null;
  private total_connections: number = 0;
  private closed: boolean = false;

  constructor(config?: Partial<ConnectionManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHeartbeat();
  }

  /**
   * Add a new client connection
   */
  addClient(
    connection: SSEConnection,
    headers: Record<string, string> = {},
    last_event_id: string | null = null
  ): SSEClient {
    if (this.closed) {
      throw new SSEError(
        SSEErrorCode.SERVER_START_FAILED,
        "Connection manager is closed"
      );
    }

    // Check connection limit
    if (
      this.config.max_reconnect_attempts > 0 &&
      this.clients.size >= this.config.max_reconnect_attempts
    ) {
      throw new SSEError(
        SSEErrorCode.CONNECTION_LIMIT,
        "Maximum connection limit reached",
        { limit: this.config.max_reconnect_attempts }
      );
    }

    // Generate unique client ID
    const client_id = this.generateClientId();
    const now = Date.now();

    const client: SSEClient = {
      client_id,
      connection,
      last_event_id,
      headers,
      state: "connecting",
      subscriptions: new Set(),
      connected_at: now,
      last_activity: now,
    };

    this.clients.set(client_id, client);
    this.total_connections++;
    this.client_counter++;

    // Initialize heartbeat for this client
    if (this.config.heartbeat_interval > 0) {
      this.initializeHeartbeat(client_id);
    }

    // Initialize rate limiting
    if (this.config.enable_rate_limiting) {
      this.rate_limits.set(client_id, {
        events: [],
        window_start: now,
      });
    }

    // Update state to open
    client.state = "open";

    return client;
  }

  /**
   * Remove a client connection
   */
  removeClient(client_id: string): boolean {
    const client = this.clients.get(client_id);
    if (!client) {
      return false;
    }

    // Clean up heartbeat
    this.cleanupHeartbeat(client_id);

    // Clean up rate limiting
    this.rate_limits.delete(client_id);

    // Close connection
    try {
      client.connection.end();
    } catch {
      // Ignore errors during cleanup
    }

    client.state = "closed";
    this.clients.delete(client_id);

    return true;
  }

  /**
   * Get a client by ID
   */
  getClient(client_id: string): SSEClient | undefined {
    return this.clients.get(client_id);
  }

  /**
   * Get all clients
   */
  getAllClients(): SSEClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients subscribed to a channel
   */
  getClientsByChannel(channel: string): SSEClient[] {
    return this.getAllClients().filter(client =>
      client.subscriptions.has(channel)
    );
  }

  /**
   * Subscribe client to channel
   */
  subscribeToChannel(client_id: string, channel: string): boolean {
    const client = this.clients.get(client_id);
    if (!client) {
      return false;
    }

    client.subscriptions.add(channel);
    return true;
  }

  /**
   * Unsubscribe client from channel
   */
  unsubscribeFromChannel(client_id: string, channel: string): boolean {
    const client = this.clients.get(client_id);
    if (!client) {
      return false;
    }

    return client.subscriptions.delete(channel);
  }

  /**
   * Update client activity timestamp
   */
  updateActivity(client_id: string): boolean {
    const client = this.clients.get(client_id);
    if (!client) {
      return false;
    }

    client.last_activity = Date.now();
    return true;
  }

  /**
   * Check if client connection is alive
   */
  isAlive(client_id: string): boolean {
    const client = this.clients.get(client_id);
    if (!client) {
      return false;
    }

    // Check if connection is writable
    if (!client.connection.isWritable()) {
      return false;
    }

    // Check timeout
    const now = Date.now();
    const idle_time = now - client.last_activity;
    if (idle_time > this.config.connection_timeout) {
      return false;
    }

    return true;
  }

  /**
   * Send event to client with rate limiting
   */
  async sendToClient(client_id: string, _event: SSEEvent): Promise<boolean> {
    const client = this.clients.get(client_id);
    if (!client) {
      return false;
    }

    // Check rate limit
    if (this.config.enable_rate_limiting) {
      const allowed = this.checkRateLimit(client_id);
      if (!allowed) {
        throw new SSEError(
          SSEErrorCode.RATE_LIMIT_EXCEEDED,
          "Rate limit exceeded",
          { client_id, limit: this.config.rate_limit_events_per_second }
        );
      }
    }

    // Check if connection is writable
    if (!client.connection.isWritable()) {
      client.state = "error";
      return false;
    }

    // Update activity
    this.updateActivity(client_id);

    return true;
  }

  /**
   * Get client connection info
   */
  getClientInfo(client_id: string): ClientConnectionInfo | null {
    const client = this.clients.get(client_id);
    if (!client) {
      return null;
    }

    return {
      client_id: client.client_id,
      state: client.state,
      connected_at: client.connected_at,
      last_activity: client.last_activity,
      bytes_sent: 0, // Track separately
      messages_sent: 0, // Track separately
      channels: Array.from(client.subscriptions),
      ip: client.headers["x-forwarded-for"] || client.headers["x-real-ip"],
      user_agent: client.headers["user-agent"],
    };
  }

  /**
   * Get all client info
   */
  getAllClientInfo(): ClientConnectionInfo[] {
    return Array.from(this.clients.keys())
      .map(id => this.getClientInfo(id))
      .filter((info): info is ClientConnectionInfo => info !== null);
  }

  /**
   * Get total connections served
   */
  getTotalConnections(): number {
    return this.total_connections;
  }

  /**
   * Cleanup stale connections
   */
  cleanupStaleConnections(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [client_id, client] of this.clients.entries()) {
      const idle_time = now - client.last_activity;

      // Check if connection is stale
      if (
        idle_time > this.config.connection_timeout ||
        !client.connection.isWritable()
      ) {
        this.removeClient(client_id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const client_id of this.clients.keys()) {
      this.removeClient(client_id);
    }

    this.stopHeartbeat();
    this.closed = true;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${this.client_counter}`;
  }

  /**
   * Initialize heartbeat for client
   */
  private initializeHeartbeat(client_id: string): void {
    this.heartbeat_data.set(client_id, {
      interval: null,
      last_check: Date.now(),
    });
  }

  /**
   * Cleanup heartbeat for client
   */
  private cleanupHeartbeat(client_id: string): void {
    const data = this.heartbeat_data.get(client_id);
    if (data?.interval) {
      clearInterval(data.interval);
    }
    this.heartbeat_data.delete(client_id);
  }

  /**
   * Start global heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeat_interval || this.config.heartbeat_interval <= 0) {
      return;
    }

    this.heartbeat_interval = setInterval(() => {
      this.cleanupStaleConnections();
    }, this.config.heartbeat_interval);
  }

  /**
   * Stop global heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeat_interval) {
      clearInterval(this.heartbeat_interval);
      this.heartbeat_interval = null;
    }

    // Clean up all client heartbeats
    for (const client_id of this.heartbeat_data.keys()) {
      this.cleanupHeartbeat(client_id);
    }
  }

  /**
   * Check rate limit for client
   */
  private checkRateLimit(client_id: string): boolean {
    const limit = this.rate_limits.get(client_id);
    if (!limit) {
      return true;
    }

    const now = Date.now();
    const window = 1000; // 1 second

    // Reset window if expired
    if (now - limit.window_start > window) {
      limit.events = [];
      limit.window_start = now;
    }

    // Check limit
    if (limit.events.length >= this.config.rate_limit_events_per_second) {
      return false;
    }

    // Add event
    limit.events.push(now);
    return true;
  }
}
