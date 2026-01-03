/**
 * @lsi/backpressure - Backpressure Handling for SSE Streams
 *
 * Comprehensive backpressure handling system for Server-Sent Events
 * with flow control, buffering, throttling, and slow client detection.
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
  // Pressure levels and strategies
  PressureLevel,
  FlowControlStrategy,
  DropStrategy,
  EventPriority,
  // Core interfaces
  SSEEvent,
  BackpressureEvent,
  FlowControlConfig,
  BackpressureDetectorConfig,
  ThrottleParams,
  ClientCapacity,
  // Stats and metrics
  BufferStats,
  ThrottleStats,
  ClientMetrics,
  SlowClientDetection,
  PriorityItem,
  CompressionResult,
  FlowControlDecision,
  BackpressureAlert,
  BandwidthSample,
  LatencySample,
  ThroughputSample,
  // Configuration
  BackpressureConfig,
} from "./types.js";

// ============================================================================
// Default Values and Helpers
// ============================================================================

export {
  DEFAULT_FLOW_CONTROL_CONFIG,
  DEFAULT_DETECTOR_CONFIG,
  DEFAULT_THROTTLE_PARAMS,
  DEFAULT_BACKPRESSURE_CONFIG,
  PRIORITY_SCORES,
  getPriorityScore,
  calculateBufferUsage,
  getPressureLevelFromUsage,
  estimateEventSize,
  createBackpressureEvent,
  createBackpressureAlert,
} from "./types.js";

// ============================================================================
// Core Components
// ============================================================================

export { BackpressureDetector } from "./BackpressureDetector.js";
export type {
  DetectionResult,
  BackpressureEventHandler,
} from "./BackpressureDetector.js";

export { FlowController } from "./FlowController.js";
export type {
  ClientFlowState,
  FlowControllerOptions,
} from "./FlowController.js";

export { BufferManager } from "./BufferManager.js";
export type {
  BufferedEvent,
  ClientBuffer,
  BufferFlushResult,
} from "./BufferManager.js";

export { PriorityQueue } from "./PriorityQueue.js";
export type { DequeueResult, BulkDequeueResult } from "./PriorityQueue.js";

export { AdaptiveThrottler } from "./AdaptiveThrottler.js";
export type { ClientThrottleState } from "./AdaptiveThrottler.js";

export { SlowClientDetector } from "./SlowClientDetector.js";
export type {
  ClientMonitoringData,
  SlowClientDetectorOptions,
} from "./SlowClientDetector.js";

// ============================================================================
// Integration
// ============================================================================

export {
  IntegratedBackpressureManager,
  createBackpressureManager,
  createSSEBackpressureMiddleware,
  BackpressureMetricsCollector,
} from "./integration.js";

// ============================================================================
// Convenience Factory Functions
// ============================================================================

/**
 * Create a backpressure detector with default config
 */
export function createBackpressureDetector(
  config?: Partial<import("./types.js").BackpressureDetectorConfig>
): BackpressureDetector {
  const {
    BackpressureDetector: Detector,
  } = require("./BackpressureDetector.js");
  return new Detector(config);
}

/**
 * Create a flow controller with default config
 */
export function createFlowController(
  config?: Partial<import("./FlowController.js").FlowControllerOptions>
): FlowController {
  const { FlowController: Controller } = require("./FlowController.js");
  return new Controller(config);
}

/**
 * Create a buffer manager with default config
 */
export function createBufferManager(
  maxSize?: number,
  dropStrategy?: DropStrategy
): BufferManager {
  const { BufferManager: Manager } = require("./BufferManager.js");
  return new Manager(maxSize, dropStrategy);
}

/**
 * Create a priority queue with default config
 */
export function createPriorityQueue(maxSize?: number): PriorityQueue {
  const { PriorityQueue: Queue } = require("./PriorityQueue.js");
  return new Queue(maxSize);
}

/**
 * Create an adaptive throttler with default config
 */
export function createAdaptiveThrottler(
  config?: Partial<ThrottleParams>
): AdaptiveThrottler {
  const { AdaptiveThrottler: Throttler } = require("./AdaptiveThrottler.js");
  return new Throttler(config);
}

/**
 * Create a slow client detector with default config
 */
export function createSlowClientDetector(
  config?: Partial<import("./SlowClientDetector.js").SlowClientDetectorOptions>
): SlowClientDetector {
  const { SlowClientDetector: Detector } = require("./SlowClientDetector.js");
  return new Detector(config);
}

// Re-import at top level for convenience
import { BackpressureDetector as _BackpressureDetector } from "./BackpressureDetector.js";
import { FlowController as _FlowController } from "./FlowController.js";
import { BufferManager as _BufferManager } from "./BufferManager.js";
import { PriorityQueue as _PriorityQueue } from "./PriorityQueue.js";
import { AdaptiveThrottler as _AdaptiveThrottler } from "./AdaptiveThrottler.js";
import { SlowClientDetector as _SlowClientDetector } from "./SlowClientDetector.js";

export { BackpressureDetector as _BackpressureDetector };
export { FlowController as _FlowController };
export { BufferManager as _BufferManager };
export { PriorityQueue as _PriorityQueue };
export { AdaptiveThrottler as _AdaptiveThrottler };
export { SlowClientDetector as _SlowClientDetector };
