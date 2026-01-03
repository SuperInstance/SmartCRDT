/**
 * @lsi/sse-reconnect - Automatic Reconnection Logic for SSE
 *
 * Provides automatic reconnection on SSE disconnect with configurable
 * backoff strategies, event buffering, and state management.
 *
 * @example
 * ```typescript
 * import { createReconnectionManager } from '@lsi/sse-reconnect';
 *
 * const manager = createReconnectionManager('https://api.example.com/events', {
 *   config: {
 *     maxRetries: 10,
 *     backoffStrategy: 'exponential-with-jitter'
 *   }
 * });
 *
 * await manager.start();
 * ```
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type {
  // Reconnection state types
  ReconnectState,
  BackoffStrategy,
  DisconnectReason,
  ReconnectAttempt,
  ReconnectConfig,
  DEFAULT_RECONNECT_CONFIG,

  // SSE event types
  SSEEvent,
  BufferedEvent,

  // Monitoring types
  ConnectionHealth,
  ConnectionMonitorEvent,
  ConnectionMonitorHandler,

  // State machine types
  StateTransition,
  VALID_STATE_TRANSITIONS,

  // Policy types
  ReconnectDecision,
  PolicyContext,

  // Manager types
  ReconnectionManagerEvent,
  ReconnectionManagerEventHandler,
  ReconnectionStats,

  // Client integration types
  ClientIntegrationOptions,
  ClientConnectionState,

  // Server integration types
  ServerSession,
  MissedEvent,
  ServerSessionOptions,
  ReconnectAck,
  MissedEventDelivery,
} from "./types.js";

// ============================================================================
// ERROR TYPES
// ============================================================================

export {
  ReconnectionError,
  BufferOverflowError,
  StateTransitionError,
  MaxRetriesExceededError,
} from "./types.js";

// ============================================================================
// BACKOFF CALCULATOR
// ============================================================================

export { BackoffCalculator, type BackoffResult } from "./BackoffCalculator.js";

export { createBackoffCalculator } from "./BackoffCalculator.js";

// ============================================================================
// STATE MACHINE
// ============================================================================

export { StateMachine } from "./StateMachine.js";

export { createStateMachine } from "./StateMachine.js";

// ============================================================================
// EVENT BUFFER
// ============================================================================

export {
  EventBuffer,
  type EventBufferConfig,
  type BufferStats,
  DEFAULT_BUFFER_CONFIG,
} from "./EventBuffer.js";

export { createEventBuffer } from "./EventBuffer.js";

// ============================================================================
// CONNECTION MONITOR
// ============================================================================

export {
  ConnectionMonitor,
  type ConnectionMonitorConfig,
  DEFAULT_MONITOR_CONFIG,
} from "./ConnectionMonitor.js";

export { createConnectionMonitor } from "./ConnectionMonitor.js";

// ============================================================================
// RECONNECT POLICY
// ============================================================================

export {
  ReconnectPolicy,
  type ReconnectPolicyConfig,
  type MaxRetriesCallback,
  type ReconnectSuccessCallback,
  DEFAULT_POLICY_CONFIG,
} from "./ReconnectPolicy.js";

export {
  createReconnectPolicy,
  createReconnectPolicyFromConfig,
} from "./ReconnectPolicy.js";

// ============================================================================
// RECONNECTION MANAGER
// ============================================================================

export {
  ReconnectionManager,
  type SSEConnection,
  type ReconnectionManagerOptions,
} from "./ReconnectionManager.js";

export { createReconnectionManager } from "./ReconnectionManager.js";

// ============================================================================
// CLIENT INTEGRATION
// ============================================================================

export {
  ReconnectionClient,
  type SSEClient,
  type ReconnectionClientOptions,
  DEFAULT_CLIENT_OPTIONS,
} from "./client.js";

export { createReconnectionClient } from "./client.js";

// ============================================================================
// SERVER INTEGRATION
// ============================================================================

export {
  SessionManager,
  SSEResponseHelper,
  DEFAULT_SERVER_OPTIONS,
} from "./server.js";

export { createSessionManager, createSSEResponseHelper } from "./server.js";
