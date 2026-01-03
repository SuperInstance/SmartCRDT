/**
 * @lsi/sse-server - SSE (Server-Sent Events) Server for Aequor Platform
 *
 * This package provides real-time streaming capabilities for Aequor responses,
 * CoAgents state, A2UI updates, and VL-JEPA embeddings to browsers using
 * Server-Sent Events (SSE) protocol.
 */

// ============================================================================
// CORE SSE TYPES
// ============================================================================

/**
 * Connection state for SSE clients
 */
export type ConnectionState =
  | "connecting" // Initial connection state
  | "open" // Connection established and active
  | "closed" // Connection closed normally
  | "error"; // Connection error occurred

/**
 * SSE event format according to W3C specification
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export interface SSEEvent {
  /** Optional event ID for reconnection */
  id?: string;
  /** Event type/name (default: 'message') */
  event?: string;
  /** Event data (will be JSON stringified if object) */
  data: unknown;
  /** Retry timeout in milliseconds (sent to client) */
  retry?: number;
}

/**
 * SSE client connection representation
 */
export interface SSEClient {
  /** Unique client identifier */
  client_id: string;
  /** HTTP response object for writing SSE data */
  connection: SSEConnection;
  /** Last event ID received by client (for reconnection) */
  last_event_id: string | null;
  /** Client headers from initial connection */
  headers: Record<string, string>;
  /** Current connection state */
  state: ConnectionState;
  /** Channel subscriptions */
  subscriptions: Set<string>;
  /** Connection timestamp */
  connected_at: number;
  /** Last activity timestamp */
  last_activity: number;
}

/**
 * Abstract SSE connection interface
 * In Node.js, this wraps http.ServerResponse
 * In browser, this wraps EventSource
 */
export interface SSEConnection {
  /** Write data to connection */
  write(data: string): boolean;
  /** Close connection */
  end(): void;
  /** Check if connection is writable */
  isWritable(): boolean;
  /** Set connection timeout */
  setTimeout(ms: number): void;
  /** Handle connection error */
  onError(error: Error): void;
  /** Handle connection close */
  onClose(): void;
}

/**
 * SSE channel for broadcasting to multiple clients
 */
export interface SSEChannel {
  /** Unique channel name */
  channel_name: string;
  /** Connected clients in this channel */
  clients: Set<string>;
  /** Last message ID in this channel */
  last_message_id: string;
  /** Channel creation timestamp */
  created_at: number;
  /** Channel metadata */
  metadata: ChannelMetadata;
  /** Event history for replay */
  history: SSEEvent[];
  /** Maximum history size */
  max_history_size: number;
}

/**
 * Channel metadata
 */
export interface ChannelMetadata {
  /** Channel description */
  description?: string;
  /** Channel is persistent (survives empty client set) */
  persistent: boolean;
  /** Maximum clients allowed (0 = unlimited) */
  max_clients: number;
  /** Require authentication */
  require_auth: boolean;
  /** Allowed event types */
  allowed_events?: string[];
  /** Custom attributes */
  attributes?: Record<string, unknown>;
}

/**
 * SSE server configuration
 */
export interface ServerConfig {
  /** Server port (default: 3000) */
  port: number;
  /** Server host (default: 'localhost') */
  host: string;
  /** Ping/keep-alive interval in milliseconds (default: 30000) */
  ping_interval: number;
  /** Client retry timeout in milliseconds (default: 5000) */
  retry_timeout: number;
  /** Maximum concurrent connections (default: 1000) */
  max_connections: number;
  /** Connection timeout in milliseconds (default: 60000) */
  connection_timeout: number;
  /** Enable CORS */
  enable_cors: boolean;
  /** CORS origin (default: '*') */
  cors_origin: string;
  /** Enable compression */
  enable_compression: boolean;
  /** Event history size per channel */
  history_size: number;
  /** Enable event replay */
  enable_replay: boolean;
}

/**
 * Default server configuration
 */
export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  port: 3000,
  host: "localhost",
  ping_interval: 30000,
  retry_timeout: 5000,
  max_connections: 1000,
  connection_timeout: 60000,
  enable_cors: true,
  cors_origin: "*",
  enable_compression: false,
  history_size: 100,
  enable_replay: true,
};

// ============================================================================
// EVENT DISPATCHER TYPES
// ============================================================================

/**
 * Event serialization format
 */
export type EventSerializationFormat =
  | "json" // JSON.stringify
  | "text" // String conversion
  | "binary" // Base64 encoding
  | "raw"; // No transformation

/**
 * Serialized event ready for transmission
 */
export interface SerializedEvent {
  /** Raw event data */
  raw: string;
  /** Event ID */
  id?: string;
  /** Event type */
  event?: string;
  /** Retry value */
  retry?: number;
}

/**
 * Event buffer entry for replay
 */
export interface BufferedEvent {
  /** Event data */
  event: SSEEvent;
  /** Event timestamp */
  timestamp: number;
  /** Channel name */
  channel: string;
  /** Event sequence number */
  sequence: number;
}

/**
 * Event dispatcher configuration
 */
export interface EventDispatcherConfig {
  /** Serialization format */
  format: EventSerializationFormat;
  /** Buffer size for replay */
  buffer_size: number;
  /** Enable event batching */
  enable_batching: boolean;
  /** Batch size */
  batch_size: number;
  /** Batch timeout in milliseconds */
  batch_timeout: number;
}

// ============================================================================
// CHANNEL MANAGER TYPES
// ============================================================================

/**
 * Channel statistics
 */
export interface ChannelStats {
  /** Channel name */
  channel: string;
  /** Client count */
  clients: number;
  /** Messages sent */
  messages_sent: number;
  /** Messages per second */
  messages_per_second: number;
  /** Average message size */
  avg_message_size: number;
  /** Channel uptime in seconds */
  uptime: number;
}

/**
 * Channel manager options
 */
export interface ChannelManagerOptions {
  /** Auto-create channels on demand */
  auto_create: boolean;
  /** Auto-delete empty channels */
  auto_delete: boolean;
  /** Channel cleanup interval in milliseconds */
  cleanup_interval: number;
  /** Default channel metadata */
  default_metadata: Partial<ChannelMetadata>;
}

// ============================================================================
// CONNECTION MANAGER TYPES
// ============================================================================

/**
 * Client connection info
 */
export interface ClientConnectionInfo {
  /** Client ID */
  client_id: string;
  /** Connection state */
  state: ConnectionState;
  /** Connected at timestamp */
  connected_at: number;
  /** Last activity timestamp */
  last_activity: number;
  /** Bytes sent */
  bytes_sent: number;
  /** Messages sent */
  messages_sent: number;
  /** Subscribed channels */
  channels: string[];
  /** Client IP address */
  ip?: string;
  /** User agent */
  user_agent?: string;
}

/**
 * Connection manager configuration
 */
export interface ConnectionManagerConfig {
  /** Heartbeat interval in milliseconds */
  heartbeat_interval: number;
  /** Connection timeout in milliseconds */
  connection_timeout: number;
  /** Maximum reconnection attempts */
  max_reconnect_attempts: number;
  /** Reconnection delay in milliseconds */
  reconnect_delay: number;
  /** Enable client tracking */
  enable_tracking: boolean;
  /** Enable rate limiting */
  enable_rate_limiting: boolean;
  /** Rate limit events per second */
  rate_limit_events_per_second: number;
}

// ============================================================================
// MIDDLEWARE TYPES
// ============================================================================

/**
 * Middleware context
 */
export interface MiddlewareContext {
  /** Request object */
  req: IncomingRequest;
  /** Response object */
  res: SSEConnection;
  /** Client ID */
  clientId: string;
  /** Channel name */
  channel: string;
  /** Event data */
  event?: SSEEvent;
  /** Metadata */
  metadata: Map<string, unknown>;
}

/**
 * Abstract incoming request
 */
export interface IncomingRequest {
  /** HTTP method */
  method: string;
  /** Request URL */
  url: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Query parameters */
  query: Record<string, string>;
  /** Last-Event-ID header for reconnection */
  lastEventId?: string;
}

/**
 * Middleware function
 */
export type MiddlewareFunction = (
  ctx: MiddlewareContext,
  next: () => Promise<void>
) => Promise<void> | void;

/**
 * Middleware interface
 */
export interface SSEMiddleware {
  /** Middleware name */
  name: string;
  /** Execute middleware */
  execute: MiddlewareFunction;
  /** Middleware priority (lower = earlier) */
  priority: number;
}

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /** Enable authentication */
  enable_auth: boolean;
  /** Enable rate limiting */
  enable_rate_limit: boolean;
  /** Enable logging */
  enable_logging: boolean;
  /** Enable compression */
  enable_compression: boolean;
  /** Rate limit per client (events per second) */
  rate_limit: number;
  /** Log level */
  log_level: "debug" | "info" | "warn" | "error" | "none";
}

// ============================================================================
// INTEGRATION TYPES
// ============================================================================

/**
 * Aequor response streaming event
 */
export interface AequorStreamEvent extends SSEEvent {
  event: "aequor-response";
  data: {
    /** Response content */
    content: string;
    /** Backend used */
    backend: "local" | "cloud" | "hybrid";
    /** Model used */
    model: string;
    /** Is final chunk */
    is_final: boolean;
    /** Chunk index */
    chunk_index: number;
    /** Total chunks */
    total_chunks?: number;
    /** Metadata */
    metadata?: Record<string, unknown>;
  };
}

/**
 * CoAgents state streaming event
 */
export interface CoAgentsStreamEvent extends SSEEvent {
  event: "coagents-state";
  data: {
    /** Agent ID */
    agent_id: string;
    /** State update */
    state: Record<string, unknown>;
    /** Status */
    status: "idle" | "thinking" | "acting" | "error";
    /** Progress (0-1) */
    progress?: number;
    /** Timestamp */
    timestamp: number;
  };
}

/**
 * A2UI progressive rendering event
 */
export interface A2UIStreamEvent extends SSEEvent {
  event: "a2ui-update";
  data: {
    /** Update type */
    type: "create" | "update" | "delete";
    /** Component data */
    component: {
      type: string;
      props: Record<string, unknown>;
      id?: string;
    };
    /** Layout info */
    layout?: {
      type: string;
      props?: Record<string, unknown>;
    };
    /** Update priority */
    priority: "low" | "normal" | "high" | "critical";
  };
}

/**
 * VL-JEPA embedding stream event
 */
export interface VLJEPATreamEvent extends SSEEvent {
  event: "vljepa-embedding";
  data: {
    /** Embedding type */
    type: "vision" | "language" | "prediction";
    /** Embedding vector (768-dim) */
    embedding: number[];
    /** Confidence score */
    confidence: number;
    /** Processing time */
    processing_time_ms: number;
    /** Metadata */
    metadata?: {
      /** Input shape */
      input_shape?: number[];
      /** Model version */
      model_version?: string;
      /** GPU enabled */
      gpu_enabled?: boolean;
    };
  };
}

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  /** Enable Aequor streaming */
  enable_aequor: boolean;
  /** Enable CoAgents streaming */
  enable_coagents: boolean;
  /** Enable A2UI streaming */
  enable_a2ui: boolean;
  /** Enable VL-JEPA streaming */
  enable_vljepa: boolean;
  /** Stream channels */
  channels: {
    /** Aequor response channel */
    aequor: string;
    /** CoAgents state channel */
    coagents: string;
    /** A2UI update channel */
    a2ui: string;
    /** VL-JEPA embedding channel */
    vljepa: string;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * SSE error codes
 */
export enum SSEErrorCode {
  /** Server failed to start */
  SERVER_START_FAILED = "SERVER_START_FAILED",
  /** Server failed to stop */
  SERVER_STOP_FAILED = "SERVER_STOP_FAILED",
  /** Channel not found */
  CHANNEL_NOT_FOUND = "CHANNEL_NOT_FOUND",
  /** Channel already exists */
  CHANNEL_EXISTS = "CHANNEL_EXISTS",
  /** Client not found */
  CLIENT_NOT_FOUND = "CLIENT_NOT_FOUND",
  /** Client disconnected */
  CLIENT_DISCONNECTED = "CLIENT_DISCONNECTED",
  /** Connection limit reached */
  CONNECTION_LIMIT = "CONNECTION_LIMIT",
  /** Invalid event format */
  INVALID_EVENT = "INVALID_EVENT",
  /** Serialization failed */
  SERIALIZATION_FAILED = "SERIALIZATION_FAILED",
  /** Authentication failed */
  AUTH_FAILED = "AUTH_FAILED",
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
}

/**
 * SSE error
 */
export class SSEError extends Error {
  constructor(
    public code: SSEErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "SSEError";
  }
}

// ============================================================================
// SERVER STATISTICS
// ============================================================================

/**
 * Server statistics
 */
export interface ServerStats {
  /** Server uptime in seconds */
  uptime: number;
  /** Total connections served */
  total_connections: number;
  /** Current active connections */
  active_connections: number;
  /** Total channels created */
  total_channels: number;
  /** Current active channels */
  active_channels: number;
  /** Total events sent */
  total_events: number;
  /** Events per second */
  events_per_second: number;
  /** Total bytes sent */
  total_bytes: number;
  /** Bytes per second */
  bytes_per_second: number;
  /** Average latency in milliseconds */
  avg_latency_ms: number;
  /** Error count */
  error_count: number;
  /** Channel-specific stats */
  channel_stats: Record<string, ChannelStats>;
}

/**
 * Server status
 */
export interface ServerStatus {
  /** Server is running */
  running: boolean;
  /** Server port */
  port: number;
  /** Server host */
  host: string;
  /** Statistics */
  stats: ServerStats;
}
