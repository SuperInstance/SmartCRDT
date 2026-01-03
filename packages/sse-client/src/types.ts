/**
 * @lsi/sse-client - Browser-side Server-Sent Events (SSE) client
 *
 * This package provides a robust SSE client for browser environments with
 * automatic reconnection, message buffering, and React hooks integration.
 */

/**
 * Client connection states
 */
export type ClientState =
  | "connecting" // Initial connection attempt
  | "open" // Connection established and receiving events
  | "closed" // Connection closed by client
  | "error" // Connection error occurred
  | "reconnecting"; // Attempting to reconnect

/**
 * Reconnection backoff strategies
 */
export type ReconnectStrategy =
  | "linear" // Fixed delay between attempts
  | "exponential" // Delay doubles each attempt
  | "jitter"; // Exponential with random jitter to prevent thundering herd

/**
 * SSE message from server
 */
export interface SSEMessage {
  /** Unique message ID (from 'id' field) */
  id: string | null;
  /** Event type (from 'event' field, default 'message') */
  event: string;
  /** Message data payload */
  data: string;
  /** Origin URL of the message source */
  origin: string;
  /** Timestamp when message was received */
  timestamp: number;
  /** Parsed JSON data if data is valid JSON */
  json?: unknown;
}

/**
 * Parsed SSE line
 */
export interface SSELine {
  /** Field name (data, event, id, retry) */
  field: string | null;
  /** Field value */
  value: string;
  /** Line number in stream */
  line: number;
}

/**
 * Parsed SSE event block
 */
export interface SSEEventBlock {
  /** Event type (default 'message') */
  event: string;
  /** Accumulated data lines (joined by newline) */
  data: string;
  /** Event ID */
  id: string | null;
  /** Retry interval in milliseconds */
  retry: number | null;
}

/**
 * Client configuration options
 */
export interface ClientConfig {
  /** SSE endpoint URL */
  url: string;
  /** Include credentials (cookies, authorization) in requests */
  withCredentials?: boolean;
  /** Reconnection strategy */
  reconnectStrategy?: ReconnectStrategy;
  /** Maximum number of reconnection attempts (-1 for infinite) */
  maxRetries?: number;
  /** Initial delay before first reconnection (ms) */
  initialDelay?: number;
  /** Maximum delay between reconnections (ms) */
  maxDelay?: number;
  /** Enable message buffering while disconnected */
  enableBuffer?: boolean;
  /** Maximum buffer size (number of messages) */
  maxBufferSize?: number;
  /** Custom headers (requires fetch polyfill) */
  headers?: Record<string, string>;
  /** Connection timeout (ms) */
  connectionTimeout?: number;
  /** Logger for debugging */
  logger?: Logger;
  /** Pause connection when page is hidden */
  pauseWhenHidden?: boolean;
}

/**
 * Logger interface for debugging
 */
export interface Logger {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  debug?: (...args: unknown[]) => void;
}

/**
 * Message handler function
 */
export type MessageHandler = (message: SSEMessage) => void;

/**
 * Error handler function
 */
export type ErrorHandler = (error: SSEError) => void;

/**
 * Open handler function
 */
export type OpenHandler = (event: Event) => void;

/**
 * Close handler function
 */
export type CloseHandler = (event: CloseEvent) => void;

/**
 * State change handler
 */
export type StateChangeHandler = (
  state: ClientState,
  prevState: ClientState
) => void;

/**
 * SSE-specific error
 */
export interface SSEError extends Error {
  /** Error type */
  type: "connection" | "message" | "reconnect" | "timeout" | "parse";
  /** HTTP status code if available */
  statusCode?: number;
  /** Whether error is fatal (should stop reconnection) */
  fatal: boolean;
  /** Original error */
  originalError?: Error;
}

/**
 * Event listener options
 */
export interface ListenerOptions {
  /** Event name to listen for (default 'message') */
  event?: string;
  /** Filter messages by predicate */
  filter?: (message: SSEMessage) => boolean;
  /** Transform message before handler */
  transform?: <T>(message: SSEMessage) => T;
  /** Remove listener after first call */
  once?: boolean;
  /** Handler priority (higher = called first) */
  priority?: number;
}

/**
 * Event listener with metadata
 */
export interface EventListener {
  /** Listener ID */
  id: string;
  /** Handler function */
  handler: (...args: unknown[]) => void;
  /** Event name */
  event: string;
  /** Filter function */
  filter?: (message: SSEMessage) => boolean;
  /** Transform function */
  transform?: <T>(message: SSEMessage) => T;
  /** Remove after first call */
  once: boolean;
  /** Priority */
  priority: number;
}

/**
 * Buffered message with priority
 */
export interface BufferedMessage {
  /** Message data */
  message: SSEMessage;
  /** Message priority (higher = delivered first on reconnect) */
  priority: "critical" | "normal";
  /** Timestamp when buffered */
  timestamp: number;
}

/**
 * Buffer statistics
 */
export interface BufferStats {
  /** Current buffer size */
  size: number;
  /** Critical messages count */
  criticalCount: number;
  /** Normal messages count */
  normalCount: number;
  /** Oldest message timestamp */
  oldestTimestamp: number | null;
  /** Newest message timestamp */
  newestTimestamp: number | null;
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  /** Current state */
  state: ClientState;
  /** Number of connection attempts */
  attempts: number;
  /** Number of successful connections */
  successes: number;
  /** Number of errors */
  errors: number;
  /** Number of reconnections */
  reconnections: number;
  /** Current retry count */
  retryCount: number;
  /** Total messages received */
  messagesReceived: number;
  /** Total bytes received */
  bytesReceived: number;
  /** Connection uptime in milliseconds */
  uptime: number;
  /** Time since last message (ms) */
  timeSinceLastMessage: number | null;
}

/**
 * Reconnection attempt info
 */
export interface ReconnectAttempt {
  /** Attempt number */
  attempt: number;
  /** Delay before this attempt (ms) */
  delay: number;
  /** Timestamp of attempt */
  timestamp: number;
  /** Success or failure */
  success?: boolean;
  /** Error if failed */
  error?: Error;
}

/**
 * Reconnection state
 */
export interface ReconnectionState {
  /** Current attempt count */
  attempts: number;
  /** Next attempt timestamp */
  nextAttemptAt: number | null;
  /** Delay for next attempt */
  nextDelay: number | null;
  /** Reconnection history */
  history: ReconnectAttempt[];
  /** Whether currently reconnecting */
  isReconnecting: boolean;
}

/**
 * Browser visibility state
 */
export type VisibilityState = "visible" | "hidden";

/**
 * Browser integration configuration
 */
export interface BrowserConfig {
  /** Pause connection when page is hidden */
  pauseWhenHidden?: boolean;
  /** Resume connection when page becomes visible */
  resumeWhenVisible?: boolean;
  /** Connection check interval when paused (ms) */
  checkInterval?: number;
}

/**
 * React hook return value
 */
export interface SSEHookResult {
  /** Current connection state */
  state: ClientState;
  /** Last received message */
  lastMessage: SSEMessage | null;
  /** Connection statistics */
  stats: ConnectionStats;
  /** Whether currently connected */
  isConnected: boolean;
  /** Whether currently reconnecting */
  isReconnecting: boolean;
  /** Connect to SSE endpoint */
  connect: () => Promise<void>;
  /** Disconnect from SSE endpoint */
  disconnect: () => Promise<void>;
  /** Force reconnection */
  reconnect: () => Promise<void>;
}

/**
 * React hook options
 */
export interface SSEHookOptions extends ClientConfig {
  /** Whether to auto-connect on mount */
  autoConnect?: boolean;
  /** Cleanup on unmount */
  cleanupOnUnmount?: boolean;
}

/**
 * Service worker message for SSE
 */
export interface ServiceWorkerSSEMessage {
  /** Message type */
  type: "sse-message" | "sse-error" | "sse-open" | "sse-close";
  /** SSE endpoint URL */
  url: string;
  /** Message data */
  data?: SSEMessage;
  /** Error data */
  error?: SSEError;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<Omit<ClientConfig, "url" | "logger">> & {
  logger: Logger;
} = {
  withCredentials: false,
  reconnectStrategy: "exponential",
  maxRetries: -1, // Infinite
  initialDelay: 1000,
  maxDelay: 30000,
  enableBuffer: true,
  maxBufferSize: 100,
  headers: {},
  connectionTimeout: 10000,
  logger: {
    log: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
  },
  pauseWhenHidden: true,
};

/**
 * Default EventSource polyfill configuration
 */
export interface EventSourcePolyfillConfig {
  /** Maximum reconnect time */
  maxReconnectTime?: number;
  /** Initial reconnect time */
  initialReconnectTime?: number;
  /** Read buffer size */
  readBufferSize?: number;
  /** Headers to include */
  headers?: Record<string, string>;
  /** Custom fetch implementation */
  fetch?: typeof globalThis.fetch;
}
