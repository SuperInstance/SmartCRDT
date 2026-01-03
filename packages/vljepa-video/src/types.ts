/**
 * @lsi/vljepa-video/types - Real-Time Video Understanding Types
 *
 * Type definitions for 30fps video processing with VL-JEPA.
 * Supports frame capture, processing, tracking, buffering, and streaming.
 *
 * @version 1.0.0
 */

// ============================================================================
// FRAME TYPES
// ============================================================================

/**
 * Raw video frame from capture source
 */
export interface VideoFrame {
  /** Unique frame identifier */
  id: number;

  /** Frame data (RGBA pixels) */
  data: Uint8ClampedArray;

  /** Frame dimensions */
  width: number;
  height: number;

  /** Timestamp in milliseconds */
  timestamp: number;

  /** Frame sequence number */
  sequenceNumber: number;

  /** Frame index in video */
  frameIndex: number;
}

/**
 * Processed frame with embeddings
 */
export interface ProcessedFrame {
  /** Original frame data */
  frame: VideoFrame;

  /** VL-JEPA embedding (768-dim) */
  embedding: Float32Array;

  /** Processing time in milliseconds */
  processingTime: number;

  /** Quality metrics */
  quality: FrameQuality;

  /** Detected objects (if any) */
  objects?: DetectedObject[];

  /** Metadata */
  metadata: FrameMetadata;
}

/**
 * Frame quality metrics
 */
export interface FrameQuality {
  /** Overall quality score (0-1) */
  score: number;

  /** Sharpness metric */
  sharpness: number;

  /** Brightness metric */
  brightness: number;

  /** Contrast metric */
  contrast: number;

  /** Noise level */
  noise: number;

  /** Motion blur detection */
  motionBlur: boolean;
}

/**
 * Frame metadata
 */
export interface FrameMetadata {
  /** Capture timestamp */
  captureTime: number;

  /** Processing timestamp */
  processTime: number;

  /** Source identifier */
  source: string;

  /** Frame format */
  format: "rgba" | "rgb" | "grayscale";

  /** Additional metadata */
  extras?: Record<string, unknown>;
}

// ============================================================================
// PROCESSING TYPES
// ============================================================================

/**
 * Frame processor configuration
 */
export interface FrameProcessorConfig {
  /** Target FPS (default: 30) */
  targetFPS: number;

  /** Target resolution */
  targetResolution: {
    width: number;
    height: number;
  };

  /** Preprocessing configuration */
  preprocessing: PreprocessConfig;

  /** Batch size for processing */
  batchSize: number;

  /** Number of parallel workers */
  parallelism: number;

  /** Maximum queue size */
  maxQueueSize: number;

  /** Whether to enable GPU acceleration */
  enableGPU: boolean;
}

/**
 * Preprocessing configuration
 */
export interface PreprocessConfig {
  /** Whether to normalize pixels */
  normalize: boolean;

  /** Normalization range */
  normalizeRange: [number, number];

  /** Whether to resize frames */
  resize: boolean;

  /** Resize method */
  resizeMethod: "bilinear" | "bicubic" | "nearest";

  /** Whether to apply color correction */
  colorCorrection: boolean;

  /** Whether to denoise */
  denoise: boolean;

  /** Denoise strength (0-1) */
  denoiseStrength: number;
}

/**
 * Frame processing result
 */
export interface FrameResult {
  /** Frame identifier */
  frameId: number;

  /** VL-JEPA embedding (768-dim) */
  embedding: Float32Array;

  /** Timestamp */
  timestamp: number;

  /** Processing latency in milliseconds */
  latency: number;

  /** Whether frame was dropped */
  dropped: boolean;

  /** Reason for dropping (if applicable) */
  dropReason?: "queue_full" | "timeout" | "quality_low" | "error";

  /** Quality score */
  quality?: number;
}

/**
 * Batch processing result
 */
export interface BatchResult {
  /** Number of frames processed */
  processed: number;

  /** Number of frames dropped */
  dropped: number;

  /** Average latency per frame */
  avgLatency: number;

  /** Total batch processing time */
  totalTime: number;

  /** Results for each frame */
  results: FrameResult[];

  /** Batch timestamp */
  timestamp: number;
}

// ============================================================================
// TRACKING TYPES
// ============================================================================

/**
 * Tracking configuration
 */
export interface TrackingConfig {
  /** Tracking algorithm */
  algorithm: "kalman" | "sort" | "deepsort";

  /** Maximum age of track (frames) */
  maxAge: number;

  /** Minimum hits to confirm track */
  minHits: number;

  /** Intersection-over-union threshold */
  iouThreshold: number;

  /** Whether to use Re-ID features */
  useReID: boolean;

  /** Maximum number of tracks */
  maxTracks: number;
}

/**
 * Detected object in a frame
 */
export interface DetectedObject {
  /** Object track ID */
  id: string;

  /** Object class label */
  class: string;

  /** Bounding box */
  boundingBox: BoundingBox;

  /** Detection confidence */
  confidence: number;

  /** Track age (frames) */
  age: number;

  /** Number of detections */
  hits: number;

  /** Track state */
  state: "tentative" | "confirmed" | "deleted";

  /** Trajectory history */
  trajectory: Trajectory;

  /** Appearance features (for Re-ID) */
  features?: Float32Array;
}

/**
 * Bounding box
 */
export interface BoundingBox {
  /** X coordinate */
  x: number;

  /** Y coordinate */
  y: number;

  /** Width */
  width: number;

  /** Height */
  height: number;
}

/**
 * Object trajectory
 */
export interface Trajectory {
  /** Position history */
  positions: Array<{ x: number; y: number; timestamp: number }>;

  /** Velocity vector */
  velocity: { vx: number; vy: number };

  /** Predicted next position */
  predicted?: { x: number; y: number };
}

/**
 * Motion tracking result
 */
export interface MotionResult {
  /** Frame identifier */
  frameId: number;

  /** Tracked objects */
  tracks: DetectedObject[];

  /** Global motion vector */
  globalMotion: { vx: number; vy: number };

  /** Motion magnitude */
  motionMagnitude: number;

  /** Temporal patterns detected */
  patterns: MotionPattern[];
}

/**
 * Motion pattern
 */
export interface MotionPattern {
  /** Pattern type */
  type: "linear" | "circular" | "oscillating" | "static";

  /** Pattern confidence */
  confidence: number;

  /** Pattern region */
  region: BoundingBox;

  /** Pattern duration (frames) */
  duration: number;
}

// ============================================================================
// BUFFERING TYPES
// ============================================================================

/**
 * Buffer configuration
 */
export interface BufferConfig {
  /** Buffer type */
  type: "ring" | "adaptive" | "priority";

  /** Buffer size (number of frames) */
  size: number;

  /** Buffer strategy */
  strategy: "fifo" | "lru" | "priority";

  /** Whether to enable compression */
  compression: boolean;

  /** Maximum memory usage (MB) */
  maxMemoryMB?: number;
}

/**
 * Buffer statistics
 */
export interface BufferStats {
  /** Current size */
  size: number;

  /** Maximum size */
  maxSize: number;

  /** Usage percentage */
  usagePercent: number;

  /** Total pushes */
  totalPushes: number;

  /** Total pops */
  totalPops: number;

  /** Number of overwrites */
  overwrites: number;

  /** Number of drops */
  drops: number;

  /** Current memory usage (MB) */
  memoryUsageMB: number;
}

/**
 * Frame buffer interface
 */
export interface FrameBuffer {
  /** Push frame to buffer */
  push(frame: ProcessedFrame): void;

  /** Pop frame from buffer */
  pop(): ProcessedFrame | null;

  /** Peek at next frame */
  peek(): ProcessedFrame | null;

  /** Clear buffer */
  clear(): void;

  /** Get buffer statistics */
  stats(): BufferStats;

  /** Resize buffer */
  resize(size: number): void;
}

// ============================================================================
// SCHEDULING TYPES
// ============================================================================

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Target FPS */
  targetFPS: number;

  /** Frame time per frame (ms) */
  frameTime: number;

  /** Scheduling strategy */
  strategy: "frame" | "skip" | "quality";

  /** Maximum latency per frame (ms) */
  maxLatency: number;

  /** Maximum consecutive drops */
  maxDrops: number;

  /** Whether to enable adaptive scheduling */
  adaptive: boolean;
}

/**
 * Schedule result
 */
export interface ScheduleResult {
  /** Number of frames processed */
  processed: number;

  /** Number of frames dropped */
  dropped: number;

  /** Actual FPS achieved */
  actualFPS: number;

  /** Average latency (ms) */
  avgLatency: number;

  /** Maximum latency (ms) */
  maxLatency: number;

  /** Latency percentile (p95) */
  p95Latency: number;

  /** Schedule timestamp */
  timestamp: number;
}

/**
 * Scheduling decision
 */
export interface ScheduleDecision {
  /** Whether to process this frame */
  process: boolean;

  /** Processing priority */
  priority: number;

  /** Quality adjustment (if applicable) */
  qualityAdjustment?: number;

  /** Reason */
  reason: string;
}

// ============================================================================
// LATENCY TYPES
// ============================================================================

/**
 * Latency metrics
 */
export interface LatencyMetrics {
  /** Frame latency percentiles */
  frameLatency: {
    /** Median latency */
    p50: number;

    /** 95th percentile */
    p95: number;

    /** 99th percentile */
    p99: number;

    /** Maximum latency */
    max: number;
  };

  /** End-to-end latency (ms) */
  endToEndLatency: number;

  /** Latency jitter (ms) */
  jitter: number;

  /** Number of dropped frames */
  droppedFrames: number;

  /** Total frames processed */
  totalFrames: number;

  /** Drop rate */
  dropRate: number;

  /** Throughput (fps) */
  throughput: number;
}

/**
 * Latency tracker configuration
 */
export interface LatencyTrackerConfig {
  /** Measurement window size (frames) */
  windowSize: number;

  /** Whether to track jitter */
  trackJitter: boolean;

  /** Whether to track percentiles */
  trackPercentiles: boolean;

  /** Maximum latency threshold (ms) */
  maxLatencyThreshold: number;
}

// ============================================================================
// STREAMING TYPES
// ============================================================================

/**
 * Stream configuration
 */
export interface StreamConfig {
  /** Output format */
  format: "json" | "binary" | "protobuf";

  /** Batch size for streaming */
  batchSize: number;

  /** Whether to enable compression */
  compression: boolean;

  /** WebSocket endpoint (if streaming) */
  endpoint?: string;

  /** Stream protocol */
  protocol: "ws" | "sse" | "webrtc";

  /** Maximum buffer size for streaming */
  maxBufferSize: number;
}

/**
 * Embedding stream result
 */
export interface StreamResult {
  /** Embeddings array */
  embeddings: Float32Array[];

  /** Stream metadata */
  metadata: StreamMetadata;

  /** Timestamp */
  timestamp: number;

  /** Sequence number */
  sequence: number;
}

/**
 * Stream metadata
 */
export interface StreamMetadata {
  /** Stream identifier */
  streamId: string;

  /** Frame IDs included */
  frameIds: number[];

  /** Encoding format */
  encoding: string;

  /** Compression used */
  compression?: string;

  /** Additional metadata */
  extras?: Record<string, unknown>;
}

/**
 * Action stream result
 */
export interface ActionStreamResult {
  /** Predicted actions */
  actions: PredictedAction[];

  /** Confidence scores */
  confidences: number[];

  /** Metadata */
  metadata: StreamMetadata;

  /** Timestamp */
  timestamp: number;
}

/**
 * Predicted action
 */
export interface PredictedAction {
  /** Action type */
  type: "create" | "modify" | "delete" | "navigate" | "input";

  /** Target element */
  target: string;

  /** Action parameters */
  parameters: Record<string, unknown>;

  /** Action confidence */
  confidence: number;
}

// ============================================================================
// QUALITY TYPES
// ============================================================================

/**
 * Quality controller configuration
 */
export interface QualityControllerConfig {
  /** Target quality level (0-1) */
  targetQuality: number;

  /** Minimum acceptable quality */
  minQuality: number;

  /** Whether to adapt resolution */
  adaptResolution: boolean;

  /** Whether to adapt frame rate */
  adaptFrameRate: boolean;

  /** Quality measurement interval (frames) */
  measureInterval: number;
}

/**
 * Bitrate adapter configuration
 */
export interface BitrateAdapterConfig {
  /** Target bitrate (Mbps) */
  targetBitrate: number;

  /** Minimum bitrate */
  minBitrate: number;

  /** Maximum bitrate */
  maxBitrate: number;

  /** Adaptation interval (ms) */
  adaptationInterval: number;

  /** Whether to use VBR */
  useVBR: boolean;
}

/**
 * Resolution scaler configuration
 */
export interface ResolutionScalerConfig {
  /** Target resolution */
  targetResolution: { width: number; height: number };

  /** Minimum resolution */
  minResolution: { width: number; height: number };

  /** Maximum resolution */
  maxResolution: { width: number; height: number };

  /** Scaling step */
  scalingStep: number;

  /** Scaling method */
  scalingMethod: "bilinear" | "bicubic" | "lanczos";
}

// ============================================================================
// SYNC TYPES
// ============================================================================

/**
 * Timestamp sync configuration
 */
export interface TimestampSyncConfig {
  /** Clock source */
  clockSource: "system" | "monotonic" | "ptp";

  /** Sync interval (ms) */
  syncInterval: number;

  /** Maximum drift tolerance (ms) */
  maxDrift: number;

  /** Whether to enable drift correction */
  enableDriftCorrection: boolean;
}

/**
 * Frame alignment configuration
 */
export interface FrameAlignmentConfig {
  /** Alignment method */
  method: "timestamp" | "sequence" | "marker";

  /** Maximum skew tolerance (ms) */
  maxSkew: number;

  /** Whether to interpolate missing frames */
  interpolate: boolean;
}

// ============================================================================
// CAPTURE TYPES
// ============================================================================

/**
 * Video capture configuration
 */
export interface VideoCaptureConfig {
  /** Video source */
  source: "camera" | "file" | "stream" | "screen";

  /** Source identifier (URL, device ID, etc.) */
  sourceId: string;

  /** Frame rate */
  frameRate: number;

  /** Resolution */
  resolution: {
    width: number;
    height: number;
  };

  /** Whether to use hardware acceleration */
  hardwareAcceleration: boolean;
}

/**
 * Stream processor configuration
 */
export interface StreamProcessorConfig {
  /** Processing pipeline steps */
  pipeline: string[];

  /** Parallel processing */
  parallel: boolean;

  /** Worker count */
  workers: number;

  /** Queue size */
  queueSize: number;
}
