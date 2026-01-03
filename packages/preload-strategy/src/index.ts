/**
 * @lsi/preload-strategy
 *
 * Predictive module preloading strategy for zero cold start
 *
 * @version 1.0.0
 */

// ============================================================================
// Main Manager and Component Classes
// ============================================================================

export { PreloadManager } from "./PreloadManager.js";
export { UsageTracker } from "./UsageTracker.js";
export { PredictiveEngine } from "./PredictiveEngine.js";
export { TimeScheduler } from "./TimeScheduler.js";
export { EventTriggerManager } from "./EventTrigger.js";

// ============================================================================
// Federation Integration
// ============================================================================

export {
  FederationPreloadManager,
  createFederationPreloadManager,
  preloadByPriority,
  setupHMRHandling,
} from "./federation.js";

// ============================================================================
// Types
// ============================================================================

export type {
  // Trigger Types
  PreloadTrigger,
  PreloadPriority,
  TimeBucket,
  DayOfWeek,

  // Module Types
  ModuleMetadata,
  ModuleLoadState,
  ModuleLoadResult,

  // Rule Types
  PreloadRule,
  PreloadCondition,

  // Statistics Types
  PreloadStats,
  ModulePreloadStats,

  // Pattern Types
  UsagePattern,
  CoAccessPattern,
  SessionPattern,
  UserUsagePattern,

  // Prediction Types
  MarkovChain,
  MarkovTransition,
  PredictionResult,
  SequencePattern,

  // Schedule Types
  Schedule,
  ScheduleResult,

  // Event Types
  PreloadEvent,
  EventTriggerConfig,
  EventTriggerResult,

  // Federation Types
  FederationPreloadConfig,
  RemoteModuleState,

  // Configuration Types
  PreloadManagerConfig,
  UsageTrackerConfig,
  PredictiveEngineConfig,
  TimeSchedulerConfig,
  EventTriggerManagerConfig,

  // Utility Types
  DeepPartial,
  ModuleFactory,
  PreloadCallback,
  EventListener,
} from "./types.js";

// ============================================================================
// Error Classes
// ============================================================================

export {
  PreloadError,
  ModuleLoadError,
  PredictionError,
  ScheduleError,
  EventTriggerError,
  CacheError,
} from "./types.js";

// ============================================================================
// Factory Functions
// ============================================================================

import { PreloadManager } from "./PreloadManager.js";
import { UsageTracker } from "./UsageTracker.js";
import { PredictiveEngine } from "./PredictiveEngine.js";
import { TimeScheduler } from "./TimeScheduler.js";
import { EventTriggerManager } from "./EventTrigger.js";
import type {
  PreloadManagerConfig,
  UsageTrackerConfig,
  PredictiveEngineConfig,
  TimeSchedulerConfig,
  EventTriggerManagerConfig,
} from "./types.js";

export function createPreloadManager(
  config?: Partial<PreloadManagerConfig>
): PreloadManager {
  return new PreloadManager(config);
}

export function createUsageTracker(
  config?: Partial<UsageTrackerConfig>
): UsageTracker {
  return new UsageTracker(config);
}

export function createPredictiveEngine(
  usageTracker: UsageTracker,
  config?: Partial<PredictiveEngineConfig>
): PredictiveEngine {
  return new PredictiveEngine(usageTracker, config);
}

export function createTimeScheduler(
  config?: Partial<TimeSchedulerConfig>
): TimeScheduler {
  return new TimeScheduler(config);
}

export function createEventTriggerManager(
  config?: Partial<EventTriggerManagerConfig>
): EventTriggerManager {
  return new EventTriggerManager(config);
}
