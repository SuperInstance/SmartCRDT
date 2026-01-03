/**
 * @lsi/sse-client - Browser-side Server-Sent Events (SSE) client
 *
 * Complete SSE implementation with automatic reconnection,
 * message buffering, and React hooks integration.
 *
 * @example
 * ```typescript
 * import { createSSEClient } from '@lsi/sse-client';
 *
 * const client = createSSEClient('https://api.example.com/events');
 * await client.connect();
 *
 * client.onMessage((message) => {
 *   console.log('Received:', message);
 * });
 * ```
 */

// ============================================================================
// Core Client
// ============================================================================

export { SSEClient, createSSEClient } from "./SSEClient.js";

// ============================================================================
// Supporting Components
// ============================================================================

export { MessageParser, defaultParser } from "./MessageParser.js";

export { EventBus, defaultEventBus } from "./EventBus.js";

export { BufferManager } from "./BufferManager.js";

export {
  ReconnectionManager,
  calculateLinearBackoff,
  calculateExponentialBackoff,
  calculateJitterBackoff,
} from "./ReconnectionManager.js";

export {
  EventSourceWrapper,
  PolyfillEventSource,
  hasNativeEventSource,
  createEventSource,
  READY_STATE,
} from "./EventSourceWrapper.js";

// ============================================================================
// Browser Integration
// ============================================================================

export {
  useSSE,
  useSSEEvents,
  useSSEFiltered,
  VanillaSSEHelper,
  ServiceWorkerSSE,
  VisibilityHelper,
  createSSEHelper,
  createServiceWorkerSSE,
  createVisibilityHelper,
} from "./browser.js";

// ============================================================================
// Types
// ============================================================================

export type {
  // Core types
  ClientState,
  ReconnectStrategy,
  SSEMessage,
  SSELine,
  SSEEventBlock,
  ClientConfig,
  Logger,
  MessageHandler,
  ErrorHandler,
  OpenHandler,
  CloseHandler,
  StateChangeHandler,
  SSEError,
  ListenerOptions,
  EventListener,
  BufferedMessage,
  BufferStats,
  ConnectionStats,
  ReconnectAttempt,
  ReconnectionState,
  VisibilityState,
  BrowserConfig,
  SSEHookResult,
  SSEHookOptions,
  ServiceWorkerSSEMessage,
  EventSourcePolyfillConfig,
  // Component types
  BufferConfig,
  ReconnectionConfig,
  ReconnectionHandlers,
} from "./types.js";

export { DEFAULT_CONFIG } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Package version
 */
export const VERSION = "1.0.0";

/**
 * Package name
 */
export const PACKAGE_NAME = "@lsi/sse-client";

/**
 * Default configuration
 */
export { DEFAULT_CONFIG as DEFAULT_CLIENT_CONFIG } from "./types.js";
