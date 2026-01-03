/**
 * @lsi/sse-reconnect - Automatic Reconnection Logic for SSE
 *
 * Provides automatic reconnection on SSE disconnect with configurable
 * backoff strategies, event buffering, and state management.
 */

// ============================================================================
// RECONNECTION STATE TYPES
// ============================================================================

/**
 * Possible states for the reconnection manager
 */
export type ReconnectState =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "failed";

/**
 * Backoff strategies for reconnection delays
 */
export type BackoffStrategy =
  | "fixed" // Constant delay between attempts
  | "linear" // Linear increase (delay = initialDelay * attempt)
  | "exponential" // Exponential backoff (delay = initialDelay * 2^attempt)
  | "exponential-with-jitter"; // Exponential with random jitter

/**
 * Reasons for disconnection
 */
export type DisconnectReason =
  | "error" // Connection error occurred
  | "timeout" // Connection timed out
  | "server-close" // Server closed the connection
  | "network-loss" // Network connectivity lost
  | "manual"; // User manually disconnected

/**
 * Reconnection attempt record
 */
export interface ReconnectAttempt {
  /** Attempt number (1-indexed) */
  attemptNumber: number;
  /** Timestamp when attempt was made */
  timestamp: Date;
  /** Delay used before this attempt (ms) */
  delay: number;
  /** Whether the attempt was successful */
  success: boolean;
  /** Error if attempt failed */
  error?: Error;
  /** Time taken for the attempt (ms) */
  duration?: number;
}

// ============================================================================
// RECONNECTION CONFIGURATION
// ============================================================================

/**
 * Configuration for reconnection behavior
 */
export interface ReconnectConfig {
  /** Maximum number of reconnection attempts (0 = infinite) */
  maxRetries: number;
  /** Initial delay before first reconnection attempt (ms) */
  initialDelay: number;
  /** Maximum delay between attempts (ms) */
  maxDelay: number;
  /** Jitter factor for exponential-with-jitter (0-1) */
  jitterFactor: number;
  /** Backoff strategy to use */
  backoffStrategy: BackoffStrategy;
  /** Whether to enable event buffering during disconnect */
  enableEventBuffer: true;
  /** Maximum buffer size in bytes (0 = unlimited) */
  maxBufferSize: number;
  /** Connection health check interval (ms) */
  healthCheckInterval: number;
  /** Connection timeout (ms) */
  connectionTimeout: number;
  /** Whether to reconnect on server close */
  reconnectOnServerClose: boolean;
  /** Whether to reconnect on network loss */
  reconnectOnNetworkLoss: boolean;
  /** Whether to reconnect on error */
  reconnectOnError: boolean;
}

/**
 * Default reconnection configuration
 */
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxRetries: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  jitterFactor: 0.1,
  backoffStrategy: "exponential-with-jitter",
  enableEventBuffer: true,
  maxBufferSize: 1024 * 1024, // 1MB
  healthCheckInterval: 30000,
  connectionTimeout: 10000,
  reconnectOnServerClose: true,
  reconnectOnNetworkLoss: true,
  reconnectOnError: true,
};

// ============================================================================
// SSE EVENT TYPES
// ============================================================================

/**
 * Server-Sent Event structure
 */
export interface SSEEvent {
  /** Event ID */
  id?: string;
  /** Event type/name */
  event?: string;
  /** Event data */
  data: string;
  /** Retry reconnection delay */
  retry?: number;
  /** Timestamp when event was received */
  timestamp?: number;
}

/**
 * Buffered event with metadata
 */
export interface BufferedEvent extends SSEEvent {
  /** Unique buffer entry ID */
  bufferId: string;
  /** Timestamp when buffered */
  bufferedAt: number;
  /** Event size in bytes */
  size: number;
}

// ============================================================================
// MONITORING TYPES
// ============================================================================

/**
 * Connection health status
 */
export interface ConnectionHealth {
  /** Whether connection is healthy */
  healthy: boolean;
  /** Last successful ping time */
  lastPingTime: Date | null;
  /** Connection uptime in seconds */
  uptime: number;
  /** Number of consecutive health check failures */
  consecutiveFailures: number;
  /** Last health check timestamp */
  lastCheckTime: Date | null;
}

/**
 * Connection monitor event
 */
export interface ConnectionMonitorEvent {
  /** Event type */
  type: "connect" | "disconnect" | "reconnect" | "error" | "health-check";
  /** Timestamp of event */
  timestamp: Date;
  /** Connection state */
  state: ReconnectState;
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Handler for connection monitor events
 */
export type ConnectionMonitorHandler = (event: ConnectionMonitorEvent) => void;

// ============================================================================
// STATE MACHINE TYPES
// ============================================================================

/**
 * State transition record
 */
export interface StateTransition {
  /** Previous state */
  from: ReconnectState;
  /** New state */
  to: ReconnectState;
  /** Timestamp of transition */
  timestamp: Date;
  /** Reason for transition */
  reason?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Valid state transitions
 */
export const VALID_STATE_TRANSITIONS: Record<ReconnectState, ReconnectState[]> =
  {
    connected: ["disconnected", "failed"],
    disconnected: ["reconnecting", "failed"],
    reconnecting: ["connected", "disconnected", "failed"],
    failed: ["disconnected"], // Can only retry from failed
  };

// ============================================================================
// RECONNECT POLICY TYPES
// ============================================================================

/**
 * Reconnection policy decision
 */
export interface ReconnectDecision {
  /** Whether to attempt reconnection */
  shouldReconnect: boolean;
  /** Delay before reconnection attempt (ms) */
  delay: number;
  /** Reason for decision */
  reason: string;
}

/**
 * Policy evaluation context
 */
export interface PolicyContext {
  /** Current reconnection attempt number */
  attemptNumber: number;
  /** Reason for disconnection */
  reason: DisconnectReason;
  /** Time since last successful connection */
  timeSinceLastConnection: number;
  /** Total time spent attempting to reconnect */
  totalReconnectTime: number;
  /** Current configuration */
  config: ReconnectConfig;
}

// ============================================================================
// RECONNECTION MANAGER TYPES
// ============================================================================

/**
 * Reconnection manager events
 */
export type ReconnectionManagerEvent =
  | {
      type: "state-change";
      state: ReconnectState;
      previousState: ReconnectState;
    }
  | { type: "reconnect-attempt"; attempt: ReconnectAttempt }
  | { type: "reconnect-success"; attempt: ReconnectAttempt }
  | { type: "reconnect-failed"; attempt: ReconnectAttempt; error: Error }
  | { type: "max-retries-reached"; totalAttempts: number }
  | { type: "buffer-full"; size: number; limit: number }
  | { type: "event-buffered"; event: BufferedEvent }
  | { type: "events-replayed"; count: number };

/**
 * Handler for reconnection manager events
 */
export type ReconnectionManagerEventHandler = (
  event: ReconnectionManagerEvent
) => void;

/**
 * Reconnection manager statistics
 */
export interface ReconnectionStats {
  /** Current reconnection state */
  state: ReconnectState;
  /** Total number of reconnection attempts */
  totalAttempts: number;
  /** Number of successful reconnections */
  successfulReconnections: number;
  /** Number of failed reconnections */
  failedReconnections: number;
  /** Current buffer size */
  bufferSize: number;
  /** Number of buffered events */
  bufferedEventCount: number;
  /** Total time spent reconnecting (ms) */
  totalReconnectTime: number;
  /** Average reconnection time (ms) */
  avgReconnectTime: number;
  /** Last successful connection time */
  lastConnectedAt: Date | null;
  /** Current uptime (seconds) */
  uptime: number;
}

// ============================================================================
// CLIENT INTEGRATION TYPES
// ============================================================================

/**
 * SSE client integration options
 */
export interface ClientIntegrationOptions {
  /** Whether to automatically reconnect on disconnect */
  autoReconnect: boolean;
  /** Whether to replay buffered events on reconnect */
  replayBufferedEvents: boolean;
  /** Whether to show reconnection notifications to user */
  showNotifications: boolean;
  /** Custom notification handler */
  notificationHandler?: (
    message: string,
    type: "info" | "warning" | "error"
  ) => void;
}

/**
 * Client connection state
 */
export interface ClientConnectionState {
  /** Whether client is currently connected */
  connected: boolean;
  /** Whether reconnection is in progress */
  reconnecting: boolean;
  /** Current attempt number */
  attemptNumber: number;
  /** Last disconnect reason */
  lastDisconnectReason?: DisconnectReason;
  /** Connection URL */
  url: string;
}

// ============================================================================
// SERVER INTEGRATION TYPES
// ============================================================================

/**
 * Server session information
 */
export interface ServerSession {
  /** Unique session ID */
  sessionId: string;
  /** Client ID */
  clientId: string;
  /** Session creation timestamp */
  createdAt: Date;
  /** Last activity timestamp */
  lastActivityAt: Date;
  /** Connection URL */
  url: string;
  /** Session state */
  state: "active" | "disconnected" | "expired";
}

/**
 * Missed event record
 */
export interface MissedEvent {
  /** Event ID */
  id: string;
  /** Event data */
  data: string;
  /** Original timestamp */
  timestamp: number;
  /** Reason it was missed */
  reason: "disconnect" | "buffer-overflow" | "replay-failed";
}

/**
 * Server session persistence options
 */
export interface ServerSessionOptions {
  /** Session timeout (ms) */
  sessionTimeout: number;
  /** Whether to persist missed events */
  persistMissedEvents: boolean;
  /** Maximum missed events to keep per session */
  maxMissedEvents: number;
  /** Whether to support session transfer */
  enableSessionTransfer: boolean;
}

/**
 * Reconnection acknowledgment from client
 */
export interface ReconnectAck {
  /** Session ID being reconnected */
  sessionId: string;
  /** Last received event ID */
  lastEventId: string | null;
  /** Client reconnect timestamp */
  timestamp: number;
}

/**
 * Missed event delivery response
 */
export interface MissedEventDelivery {
  /** Session ID */
  sessionId: string;
  /** Number of missed events delivered */
  eventCount: number;
  /** Missed events */
  events: MissedEvent[];
  /** Delivery timestamp */
  timestamp: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Reconnection error
 */
export class ReconnectionError extends Error {
  constructor(
    message: string,
    public readonly reason: DisconnectReason,
    public readonly attemptNumber: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "ReconnectionError";
  }
}

/**
 * Buffer overflow error
 */
export class BufferOverflowError extends Error {
  constructor(
    message: string,
    public readonly currentSize: number,
    public readonly limit: number
  ) {
    super(message);
    this.name = "BufferOverflowError";
  }
}

/**
 * State transition error
 */
export class StateTransitionError extends Error {
  constructor(
    message: string,
    public readonly from: ReconnectState,
    public readonly to: ReconnectState
  ) {
    super(message);
    this.name = "StateTransitionError";
  }
}

/**
 * Maximum retries exceeded error
 */
export class MaxRetriesExceededError extends Error {
  constructor(
    message: string,
    public readonly totalAttempts: number,
    public readonly maxRetries: number
  ) {
    super(message);
    this.name = "MaxRetriesExceededError";
  }
}
