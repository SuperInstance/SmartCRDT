/**
 * @lsi/vljepa-video - Real-Time Video Understanding for VL-JEPA
 *
 * 30fps video processing with VL-JEPA for real-time understanding.
 *
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export * from "./types.js";

// ============================================================================
// CAPTURE
// ============================================================================

export { VideoCapture } from "./capture/VideoCapture.js";
export { FrameExtractor } from "./capture/FrameExtractor.js";
export { StreamProcessor } from "./capture/StreamProcessor.js";

// ============================================================================
// PROCESSING
// ============================================================================

export { FrameProcessor } from "./processing/FrameProcessor.js";
export { BatchProcessor } from "./processing/BatchProcessor.js";
export {
  PipelineProcessor,
  PipelineStages,
} from "./processing/PipelineProcessor.js";

// ============================================================================
// TRACKING
// ============================================================================

export {
  ObjectTracker,
  MotionTracker as MotionTrackingTracker,
  TemporalTracker,
} from "./tracking/ObjectTracker.js";
export { MotionTracker } from "./tracking/MotionTracker.js";
export { TemporalTracker } from "./tracking/TemporalTracker.js";

// ============================================================================
// BUFFERING
// ============================================================================

export {
  FrameBuffer,
  RingBuffer as FrameRingBuffer,
  AdaptiveBuffer as FrameAdaptiveBuffer,
} from "./buffering/FrameBuffer.js";
export { RingBuffer } from "./buffering/RingBuffer.js";
export { AdaptiveBuffer } from "./buffering/AdaptiveBuffer.js";

// ============================================================================
// SYNC
// ============================================================================

export {
  TimestampSync,
  FrameAlignment,
  MultiStreamSync,
} from "./sync/TimestampSync.js";
export { FrameAlignment as FrameAligner } from "./sync/FrameAlignment.js";
export { MultiStreamSync as StreamSynchronizer } from "./sync/MultiStreamSync.js";

// ============================================================================
// QUALITY
// ============================================================================

export { QualityController } from "./quality/QualityController.js";
export { BitrateAdapter } from "./quality/BitrateAdapter.js";
export { ResolutionScaler } from "./quality/ResolutionScaler.js";

// ============================================================================
// REALTIME
// ============================================================================

export { RealTimeScheduler } from "./realtime/RealTimeScheduler.js";
export { LatencyTracker, DropoutHandler } from "./realtime/LatencyTracker.js";
export { DropoutHandler as FrameDropoutHandler } from "./realtime/DropoutHandler.js";

// ============================================================================
// OUTPUT
// ============================================================================

export {
  EmbeddingStream,
  ActionStream,
  MetadataStream,
} from "./output/EmbeddingStream.js";
export { ActionStream, ActionAggregator } from "./output/ActionStream.js";
export { MetadataStream, MetadataFilter } from "./output/MetadataStream.js";

// ============================================================================
// RE-EXPORT TYPES FOR CONVENIENCE
// ============================================================================

export type {
  VideoFrame,
  ProcessedFrame,
  FrameResult,
  BatchResult,
  FrameProcessorConfig,
  TrackingConfig,
  DetectedObject,
  BufferConfig,
  BufferStats,
  SchedulerConfig,
  ScheduleResult,
  LatencyMetrics,
  StreamConfig,
  StreamResult,
  ActionStreamResult,
} from "./types.js";
