/**
 * @lsi/sse-server - SSE (Server-Sent Events) Server for Aequor Platform
 *
 * Provides real-time streaming capabilities for Aequor responses,
 * CoAgents state, A2UI updates, and VL-JEPA embeddings using
 * Server-Sent Events (SSE) protocol.
 *
 * @example
 * ```ts
 * import { createSSEServer } from '@lsi/sse-server';
 *
 * const server = createSSEServer({
 *   port: 3000,
 *   host: 'localhost',
 * });
 *
 * await server.start();
 *
 * // Broadcast to channel
 * server.broadcast('events', {
 *   event: 'message',
 *   data: { hello: 'world' }
 * });
 *
 * await server.stop();
 * ```
 */

// ============================================================================
// EXPORTS
// ============================================================================

// Core types
export * from "./types.js";

// SSE Server
export {
  SSEServer,
  createSSEServer,
  createDefaultSSEServer,
} from "./SSEServer.js";

// Connection Manager
export { ConnectionManager } from "./ConnectionManager.js";

// Channel Manager
export { ChannelManager } from "./ChannelManager.js";

// Event Dispatcher
export {
  EventDispatcher,
  EventRetryHandler,
  EventReplayHandler,
} from "./EventDispatcher.js";

// HTTP Handler
export { HttpHandler, KeepAliveManager } from "./HttpHandler.js";

// Middleware
export {
  AuthMiddleware,
  RateLimitMiddleware,
  LoggingMiddleware,
  CompressionMiddleware,
  CORSMiddleware,
  createBearerAuthMiddleware,
  createIPRateLimitMiddleware,
  createLoggingMiddleware,
  createCORSMiddleware,
  middleware,
} from "./middleware/index.js";

// Integration
export {
  AequorStreamer,
  CoAgentsStreamer,
  A2UIStreamer,
  VLJEPATreamer,
  SSEIntegration,
  createSSEIntegration,
} from "./integration.js";

// Version
export const VERSION = "1.0.0";
