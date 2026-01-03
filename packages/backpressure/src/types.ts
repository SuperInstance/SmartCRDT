/**
 * @lsi/backpressure - Backpressure Handling for SSE Streams
 *
 * This package provides comprehensive backpressure handling for Server-Sent Events
 * streams, including flow control strategies, buffering, throttling, and slow client detection.
 */

/**
 * Pressure level indicators for backpressure assessment
 */
export type PressureLevel =
  | "none" // No backpressure, client is keeping up
  | "low" // Slight backpressure, buffer filling slowly
  | "medium" // Moderate backpressure, buffer at 50%
  | "high" // High backpressure, buffer at 75%
  | "critical"; // Critical backpressure, buffer near overflow

/**
 * Flow control strategies for handling backpressure
 */
export type FlowControlStrategy =
  | "drop" // Drop events when buffer is full
  | "buffer" // Buffer events until capacity reached
  | "throttle" // Throttle event delivery rate
  | "compress"; // Compress multiple events into one

/**
 * Drop strategy for when events need to be dropped
 */
export type DropStrategy =
  | "oldest" // Drop oldest events first
  | "newest" // Drop newest events first
  | "lowest-priority" // Drop lowest priority events
  | "random"; // Drop random events

/**
 * Priority levels for events
 */
export type EventPriority =
  | "critical" // Critical events, never drop
  | "high" // High priority events
  | "normal" // Normal priority events
  | "low"; // Low priority events

/**
 * Client capacity metrics
 */
export interface ClientCapacity {
  /** Maximum buffer size in bytes */
  buffer_size: number;
  /** Estimated client bandwidth in bytes/second */
  bandwidth: number;
  /** Average processing time per event in milliseconds */
  processing_time: number;
  /** Maximum concurrent events client can handle */
  max_concurrent: number;
}

/**
 * SSE Event interface (reused from SSE packages)
 */
export interface SSEEvent {
  /** Event type/name */
  event?: string;
  /** Event data */
  data: string | unknown;
  /** Event ID */
  id?: string;
  /** Event retry interval */
  retry?: number;
  /** Event priority */
  priority?: EventPriority;
  /** Event timestamp */
  timestamp?: number;
  /** Event size in bytes */
  size?: number;
}

/**
 * Backpressure event notification
 */
export interface BackpressureEvent {
  /** Client identifier */
  client_id: string;
  /** Current pressure level */
  pressure_level: PressureLevel;
  /** Action taken */
  action: BackpressureAction;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Actions taken for backpressure
 */
export type BackpressureAction =
  | "none"
  | "started_monitoring"
  | "applied_throttle"
  | "dropped_events"
  | "compressed_events"
  | "buffer_overflow"
  | "client_slow_detected"
  | "client_recovered";

/**
 * Flow control configuration
 */
export interface FlowControlConfig {
  /** Maximum buffer size in bytes */
  max_buffer_size: number;
  /** Maximum acceptable latency in milliseconds */
  max_latency: number;
  /** Strategy for dropping events */
  drop_strategy: DropStrategy;
  /** Default flow control strategy */
  default_strategy: FlowControlStrategy;
  /** Enable automatic strategy switching */
  auto_switch_strategy: boolean;
  /** Threshold for switching to drop strategy (buffer usage 0-1) */
  drop_threshold: number;
  /** Threshold for switching to throttle strategy (buffer usage 0-1) */
  throttle_threshold: number;
  /** Threshold for switching to compress strategy (buffer usage 0-1) */
  compress_threshold: number;
}

/**
 * Backpressure detection configuration
 */
export interface BackpressureDetectorConfig {
  /** Monitoring interval in milliseconds */
  monitor_interval: number;
  /** Buffer usage threshold for low pressure (0-1) */
  low_threshold: number;
  /** Buffer usage threshold for medium pressure (0-1) */
  medium_threshold: number;
  /** Buffer usage threshold for high pressure (0-1) */
  high_threshold: number;
  /** Latency threshold for slow client detection (ms) */
  slow_latency_threshold: number;
  /** Number of consecutive slow detections before marking as slow */
  slow_detection_count: number;
  /** Bandwidth estimation window size */
  bandwidth_window: number;
}

/**
 * Buffer statistics
 */
export interface BufferStats {
  /** Current buffer size in bytes */
  current_size: number;
  /** Maximum buffer size in bytes */
  max_size: number;
  /** Buffer usage percentage (0-100) */
  usage_percent: number;
  /** Number of events in buffer */
  event_count: number;
  /** Oldest event timestamp */
  oldest_timestamp: number | null;
  /** Newest event timestamp */
  newest_timestamp: number | null;
  /** Total bytes dropped */
  total_dropped: number;
  /** Total events dropped */
  events_dropped: number;
}

/**
 * Throttle statistics
 */
export interface ThrottleStats {
  /** Current throttle rate (events/second) */
  current_rate: number;
  /** Original/unthrottled rate (events/second) */
  original_rate: number;
  /** Throttle percentage (0-100) */
  throttle_percent: number;
  /** Number of throttled events */
  throttled_count: number;
  /** Number of delivered events */
  delivered_count: number;
  /** Average latency after throttling (ms) */
  avg_latency: number;
  /** Timestamp of last adjustment */
  last_adjustment: number;
}

/**
 * Client metrics for backpressure assessment
 */
export interface ClientMetrics {
  /** Client identifier */
  client_id: string;
  /** Current pressure level */
  pressure_level: PressureLevel;
  /** Buffer statistics */
  buffer_stats: BufferStats;
  /** Estimated bandwidth (bytes/second) */
  bandwidth: number;
  /** Average latency (milliseconds) */
  latency: number;
  /** Throughput (events/second) */
  throughput: number;
  /** Whether client is detected as slow */
  is_slow: boolean;
  /** Current flow control strategy */
  strategy: FlowControlStrategy;
  /** Timestamp of last update */
  last_update: number;
}

/**
 * Slow client detection result
 */
export interface SlowClientDetection {
  /** Client identifier */
  client_id: string;
  /** Whether client is slow */
  is_slow: boolean;
  /** Latency in milliseconds */
  latency: number;
  /** Throughput in events/second */
  throughput: number;
  /** Detection confidence (0-1) */
  confidence: number;
  /** Reasons for detection */
  reasons: string[];
}

/**
 * Priority queue item
 */
export interface PriorityItem<T = SSEEvent> {
  /** Item priority */
  priority: EventPriority;
  /** Numeric priority score (higher = more important) */
  score: number;
  /** Item data */
  data: T;
  /** Insertion order for tie-breaking */
  order: number;
}

/**
 * Compression result
 */
export interface CompressionResult {
  /** Original event count */
  original_count: number;
  /** Compressed event count */
  compressed_count: number;
  /** Compression ratio (0-1) */
  compression_ratio: number;
  /** Compressed events */
  events: SSEEvent[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Flow control decision
 */
export interface FlowControlDecision {
  /** Whether to send the event */
  should_send: boolean;
  /** Action taken */
  action: BackpressureAction;
  /** Modified event (if compressed/throttled) */
  modified_event?: SSEEvent;
  /** Reason for decision */
  reason: string;
  /** New pressure level */
  pressure_level: PressureLevel;
}

/**
 * Backpressure alert
 */
export interface BackpressureAlert {
  /** Alert severity */
  severity: "info" | "warning" | "error" | "critical";
  /** Client identifier */
  client_id: string;
  /** Pressure level */
  pressure_level: PressureLevel;
  /** Alert message */
  message: string;
  /** Recommended action */
  recommended_action: string;
  /** Timestamp */
  timestamp: number;
  /** Metrics snapshot */
  metrics: ClientMetrics;
}

/**
 * Adaptive throttle parameters
 */
export interface ThrottleParams {
  /** Minimum throttle rate (events/second) */
  min_rate: number;
  /** Maximum throttle rate (events/second) */
  max_rate: number;
  /** Rate adjustment step size */
  adjustment_step: number;
  /** Adjustment interval (ms) */
  adjustment_interval: number;
  /** Target latency (ms) */
  target_latency: number;
  /** Latency tolerance (+/- ms) */
  latency_tolerance: number;
  /** Enable automatic rate increase when latency improves */
  auto_increase: boolean;
}

/**
 * Bandwidth sample for estimation
 */
export interface BandwidthSample {
  /** Bytes transferred */
  bytes: number;
  /** Time taken (ms) */
  duration: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Latency sample
 */
export interface LatencySample {
  /** Latency in milliseconds */
  latency: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Throughput sample
 */
export interface ThroughputSample {
  /** Events processed */
  events: number;
  /** Time window (ms) */
  duration: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Configuration for the entire backpressure system
 */
export interface BackpressureConfig {
  /** Flow control configuration */
  flow_control: FlowControlConfig;
  /** Detector configuration */
  detector: BackpressureDetectorConfig;
  /** Throttle parameters */
  throttle: ThrottleParams;
  /** Enable metrics collection */
  enable_metrics: boolean;
  /** Enable alerts */
  enable_alerts: boolean;
  /** Alert on critical backpressure */
  alert_on_critical: boolean;
  /** Enable auto-recovery when pressure decreases */
  enable_auto_recovery: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_FLOW_CONTROL_CONFIG: FlowControlConfig = {
  max_buffer_size: 1024 * 1024, // 1MB
  max_latency: 5000, // 5 seconds
  drop_strategy: "lowest-priority",
  default_strategy: "buffer",
  auto_switch_strategy: true,
  drop_threshold: 0.95,
  throttle_threshold: 0.7,
  compress_threshold: 0.5,
};

export const DEFAULT_DETECTOR_CONFIG: BackpressureDetectorConfig = {
  monitor_interval: 100, // 100ms
  low_threshold: 0.25,
  medium_threshold: 0.5,
  high_threshold: 0.75,
  slow_latency_threshold: 1000, // 1 second
  slow_detection_count: 3,
  bandwidth_window: 10,
};

export const DEFAULT_THROTTLE_PARAMS: ThrottleParams = {
  min_rate: 1, // 1 event/second minimum
  max_rate: 1000, // 1000 events/second maximum
  adjustment_step: 0.1, // 10% adjustment
  adjustment_interval: 500, // 500ms
  target_latency: 100, // 100ms target
  latency_tolerance: 50, // +/- 50ms
  auto_increase: true,
};

export const DEFAULT_BACKPRESSURE_CONFIG: BackpressureConfig = {
  flow_control: DEFAULT_FLOW_CONTROL_CONFIG,
  detector: DEFAULT_DETECTOR_CONFIG,
  throttle: DEFAULT_THROTTLE_PARAMS,
  enable_metrics: true,
  enable_alerts: true,
  alert_on_critical: true,
  enable_auto_recovery: true,
};

/**
 * Event priority to numeric score mapping
 */
export const PRIORITY_SCORES: Record<EventPriority, number> = {
  critical: 1000,
  high: 100,
  normal: 10,
  low: 1,
};

/**
 * Get numeric score from event priority
 */
export function getPriorityScore(priority: EventPriority): number {
  return PRIORITY_SCORES[priority] || 10;
}

/**
 * Calculate buffer usage percentage
 */
export function calculateBufferUsage(current: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(100, Math.max(0, (current / max) * 100));
}

/**
 * Determine pressure level from buffer usage
 */
export function getPressureLevelFromUsage(
  usagePercent: number,
  config: BackpressureDetectorConfig = DEFAULT_DETECTOR_CONFIG
): PressureLevel {
  if (usagePercent >= config.high_threshold * 100) {
    return usagePercent >= 95 ? "critical" : "high";
  }
  if (usagePercent >= config.medium_threshold * 100) {
    return "medium";
  }
  if (usagePercent >= config.low_threshold * 100) {
    return "low";
  }
  return "none";
}

/**
 * Estimate event size in bytes
 */
export function estimateEventSize(event: SSEEvent): number {
  if (event.size !== undefined) {
    return event.size;
  }

  let size = 0;

  // Estimate size based on data
  if (typeof event.data === "string") {
    size += event.data.length * 2; // UTF-16
  } else {
    size += JSON.stringify(event.data).length * 2;
  }

  // Add event type and id
  if (event.event) {
    size += event.event.length * 2;
  }
  if (event.id) {
    size += event.id.length * 2;
  }

  // Add overhead
  size += 100; // SSE format overhead

  return size;
}

/**
 * Create a backpressure event
 */
export function createBackpressureEvent(
  clientId: string,
  pressureLevel: PressureLevel,
  action: BackpressureAction,
  metadata?: Record<string, unknown>
): BackpressureEvent {
  return {
    client_id: clientId,
    pressure_level: pressureLevel,
    action,
    timestamp: Date.now(),
    metadata,
  };
}

/**
 * Create a backpressure alert
 */
export function createBackpressureAlert(
  clientId: string,
  pressureLevel: PressureLevel,
  metrics: ClientMetrics,
  message?: string
): BackpressureAlert {
  const severity =
    pressureLevel === "critical" || pressureLevel === "high"
      ? "error"
      : pressureLevel === "medium"
        ? "warning"
        : "info";

  const recommendedAction =
    pressureLevel === "critical"
      ? "Drop events immediately or disconnect client"
      : pressureLevel === "high"
        ? "Apply aggressive throttling or compression"
        : pressureLevel === "medium"
          ? "Apply moderate throttling"
          : pressureLevel === "low"
            ? "Monitor closely"
            : "No action needed";

  return {
    severity,
    client_id: clientId,
    pressure_level: pressureLevel,
    message: message || `Backpressure level: ${pressureLevel}`,
    recommended_action: recommendedAction,
    timestamp: Date.now(),
    metrics,
  };
}
