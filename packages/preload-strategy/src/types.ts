/**
 * @lsi/preload-strategy
 *
 * Predictive module preloading strategy for zero cold start
 * Core type definitions for preload management
 *
 * @version 1.0.0
 */

// ============================================================================
// Preload Trigger Types
// ============================================================================

/**
 * Types of preload triggers
 */
export type PreloadTrigger =
  | "time-based" // Preload based on schedule (cron, time of day)
  | "usage-based" // Preload based on access frequency
  | "event-based" // Preload based on events (deployment, traffic spike)
  | "predictive"; // Preload based on ML prediction

/**
 * Priority levels for preloading
 */
export type PreloadPriority = "critical" | "high" | "normal" | "low";

/**
 * Time of day bucket for pattern analysis
 */
export type TimeBucket =
  | "early-morning" // 00:00 - 06:00
  | "morning" // 06:00 - 12:00
  | "afternoon" // 12:00 - 18:00
  | "evening"; // 18:00 - 24:00;

/**
 * Day of week for pattern analysis
 */
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

// ============================================================================
// Module Metadata Types
// ============================================================================

/**
 * Metadata about a module for preloading decisions
 */
export interface ModuleMetadata {
  /** Unique module identifier */
  id: string;
  /** Module name */
  name: string;
  /** Module version */
  version: string;
  /** Module size in bytes */
  size: number;
  /** Expected load time in milliseconds */
  loadTime: number;
  /** Module dependencies */
  dependencies: string[];
  /** URL for remote modules */
  url?: string;
  /** Whether module is critical */
  critical?: boolean;
  /** Module tags for categorization */
  tags?: string[];
  /** Last modified timestamp */
  lastModified?: number;
}

/**
 * Module load state
 */
export interface ModuleLoadState {
  /** Module identifier */
  moduleId: string;
  /** Whether module is loaded */
  loaded: boolean;
  /** Load timestamp */
  loadedAt?: number;
  /** Time taken to load */
  loadTime?: number;
  /** Whether load was from cache */
  fromCache?: boolean;
  /** Load error if any */
  error?: string;
}

// ============================================================================
// Preload Rule Types
// ============================================================================

/**
 * Condition for preload rule
 */
export interface PreloadCondition {
  /** Time-based condition */
  time?: {
    /** Time bucket */
    bucket?: TimeBucket;
    /** Days of week */
    days?: DayOfWeek[];
    /** Hour range (0-23) */
    hourRange?: [number, number];
  };
  /** Usage-based condition */
  usage?: {
    /** Minimum access frequency */
    minFrequency?: number;
    /** Maximum idle time */
    maxIdleTime?: number;
  };
  /** Event-based condition */
  event?: {
    /** Event types to trigger on */
    types: string[];
    /** Event payload filter */
    filter?: Record<string, any>;
  };
  /** Predictive condition */
  prediction?: {
    /** Minimum confidence threshold */
    minConfidence: number;
    /** Maximum prediction age */
    maxAge: number;
  };
}

/**
 * Preload rule definition
 */
export interface PreloadRule {
  /** Unique rule identifier */
  id: string;
  /** Module name to preload */
  moduleName: string;
  /** Trigger type */
  trigger: PreloadTrigger;
  /** Priority level */
  priority: PreloadPriority;
  /** Preload conditions */
  conditions: PreloadCondition;
  /** Whether rule is enabled */
  enabled: boolean;
  /** Rule creation timestamp */
  createdAt: number;
  /** Rule update timestamp */
  updatedAt: number;
  /** Maximum times to apply rule (0 = unlimited) */
  maxApplications?: number;
  /** Current application count */
  applicationCount: number;
}

// ============================================================================
// Preload Statistics Types
// ============================================================================

/**
 * Preload statistics
 */
export interface PreloadStats {
  /** Total modules preloaded */
  totalPreloaded: number;
  /** Cache hits */
  cacheHits: number;
  /** Cache misses */
  cacheMisses: number;
  /** Average load time in milliseconds */
  avgLoadTime: number;
  /** Preload success rate (0-1) */
  successRate: number;
  /** Rules applied count */
  rulesApplied: number;
  /** Predictions made count */
  predictionsMade: number;
  /** Prediction accuracy (0-1) */
  predictionAccuracy: number;
  /** Statistics timestamp */
  timestamp: number;
}

/**
 * Per-module preload statistics
 */
export interface ModulePreloadStats {
  /** Module identifier */
  moduleId: string;
  /** Times preloaded */
  preloadCount: number;
  /** Times used after preload */
  usedCount: number;
  /** Preload utilization rate (0-1) */
  utilizationRate: number;
  /** Average time to load */
  avgLoadTime: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
}

// ============================================================================
// Usage Pattern Types
// ============================================================================

/**
 * Module access pattern
 */
export interface UsagePattern {
  /** Module name */
  moduleName: string;
  /** Access frequency (accesses per hour) */
  accessFrequency: number;
  /** Time of day pattern */
  timeOfDay: TimeBucket;
  /** Day of week pattern */
  dayOfWeek: DayOfWeek;
  /** Co-accessed modules (accessed together) */
  coAccess: CoAccessPattern[];
  /** Session-based pattern */
  sessionPattern: SessionPattern;
  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * Co-access pattern between modules
 */
export interface CoAccessPattern {
  /** Other module name */
  moduleName: string;
  /** Co-access probability (0-1) */
  probability: number;
  /** Average time between accesses (ms) */
  avgTimeBetween: number;
}

/**
 * Session-based pattern
 */
export interface SessionPattern {
  /** Session start probability (0-1) */
  startProbability: number;
  /** Session end probability (0-1) */
  endProbability: number;
  /** Average session position (0-1) */
  avgPosition: number;
}

/**
 * User-specific usage pattern
 */
export interface UserUsagePattern {
  /** User identifier */
  userId: string;
  /** Module patterns */
  patterns: Map<string, UsagePattern>;
  /** User time zone */
  timeZone?: string;
  /** Active hours */
  activeHours?: [number, number][];
  /** Last active timestamp */
  lastActive: number;
}

// ============================================================================
// Prediction Types
// ============================================================================

/**
 * Markov chain transition
 */
export interface MarkovTransition {
  /** From state */
  from: string;
  /** To state */
  to: string;
  /** Transition count */
  count: number;
  /** Transition probability (0-1) */
  probability: number;
}

/**
 * Markov chain model
 */
export interface MarkovChain {
  /** State name (module name) */
  state: string;
  /** Transitions from this state */
  transitions: Map<string, number>;
  /** Total transition count */
  totalCount: number;
}

/**
 * Prediction result
 */
export interface PredictionResult {
  /** Module name */
  moduleName: string;
  /** Prediction confidence (0-1) */
  confidence: number;
  /** Prediction reason */
  reason: string;
  /** Related modules that influenced prediction */
  relatedModules: string[];
  /** Prediction timestamp */
  timestamp: number;
}

/**
 * Sequence pattern for prediction
 */
export interface SequencePattern {
  /** Module sequence */
  sequence: string[];
  /** Pattern occurrence count */
  count: number;
  /** Pattern confidence (0-1) */
  confidence: number;
  /** Average time between sequence items */
  avgTimeBetween: number[];
}

// ============================================================================
// Schedule Types
// ============================================================================

/**
 * Cron-like schedule
 */
export interface Schedule {
  /** Schedule identifier */
  id: string;
  /** Module name to preload */
  moduleName: string;
  /** Cron expression */
  cron: string;
  /** Time zone for schedule */
  timeZone: string;
  /** Whether schedule is recurring */
  recurring: boolean;
  /** One-time execution timestamp (if not recurring) */
  oneTimeAt?: number;
  /** Next execution timestamp */
  nextRun: number;
  /** Last execution timestamp */
  lastRun?: number;
  /** Whether schedule is enabled */
  enabled: boolean;
  /** Schedule creation timestamp */
  createdAt: number;
  /** Schedule update timestamp */
  updatedAt?: number;
  /** Maximum times to apply schedule (0 = unlimited) */
  maxApplications?: number;
  /** Current application count */
  applicationCount?: number;
}

/**
 * Schedule execution result
 */
export interface ScheduleResult {
  /** Schedule identifier */
  scheduleId: string;
  /** Execution timestamp */
  timestamp: number;
  /** Modules preloaded */
  modulesPreloaded: string[];
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Preload event
 */
export interface PreloadEvent {
  /** Event type */
  type: string;
  /** Event timestamp */
  timestamp: number;
  /** Event payload */
  payload: Record<string, any>;
  /** Event source */
  source: string;
}

/**
 * Event trigger configuration
 */
export interface EventTriggerConfig {
  /** Unique trigger identifier (auto-generated) */
  id?: string;
  /** Event type to listen for */
  eventType: string;
  /** Event filter conditions */
  filter?: Record<string, any>;
  /** Debounce time in milliseconds */
  debounceTime?: number;
  /** Throttle time in milliseconds */
  throttleTime?: number;
  /** Maximum times to trigger (0 = unlimited) */
  maxTriggers?: number;
  /** Whether trigger is enabled */
  enabled?: boolean;
}

/**
 * Event trigger result
 */
export interface EventTriggerResult {
  /** Trigger identifier */
  triggerId: string;
  /** Event that triggered */
  event: PreloadEvent;
  /** Modules preloaded */
  modulesPreloaded: string[];
  /** Success status */
  success: boolean;
  /** Processing time */
  processingTime: number;
}

// ============================================================================
// Federation Integration Types
// ============================================================================

/**
 * Federation preload configuration
 */
export interface FederationPreloadConfig {
  /** Remote module metadata */
  remoteModules: ModuleMetadata[];
  /** Container cache TTL in milliseconds */
  containerCacheTTL: number;
  /** Version negotiation timeout */
  versionNegotiationTimeout: number;
  /** Hot module replacement aware */
  hmrAware: boolean;
}

/**
 * Remote module preload state
 */
export interface RemoteModuleState {
  /** Module identifier */
  moduleId: string;
  /** Federation container */
  container?: any;
  /** Cached version */
  cachedVersion?: string;
  /** Cache expiration */
  cacheExpiresAt?: number;
  /** Load state */
  state: "not-loaded" | "loading" | "loaded" | "error";
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Preload manager configuration
 */
export interface PreloadManagerConfig {
  /** Maximum modules to preload simultaneously */
  maxConcurrentPreloads: number;
  /** Preload timeout in milliseconds */
  preloadTimeout: number;
  /** Whether to enable predictive preloading */
  enablePrediction: boolean;
  /** Whether to enable time-based scheduling */
  enableScheduling: boolean;
  /** Whether to enable event triggers */
  enableEventTriggers: boolean;
  /** Maximum cache size (in bytes) */
  maxCacheSize: number;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
}

/**
 * Usage tracker configuration
 */
export interface UsageTrackerConfig {
  /** Whether to enable tracking */
  enabled: boolean;
  /** Sample rate (0-1) */
  sampleRate: number;
  /** Maximum patterns to store per module */
  maxPatternsPerModule: number;
  /** Maximum patterns to store per user */
  maxPatternsPerUser: number;
  /** Pattern aggregation interval in milliseconds */
  aggregationInterval: number;
}

/**
 * Predictive engine configuration
 */
export interface PredictiveEngineConfig {
  /** Whether to enable predictions */
  enabled: boolean;
  /** Minimum confidence for predictions */
  minConfidence: number;
  /** Maximum sequence length for pattern detection */
  maxSequenceLength: number;
  /** Minimum pattern count for validity */
  minPatternCount: number;
  /** Learning rate for adaptive learning */
  learningRate: number;
  /** Model update interval in milliseconds */
  modelUpdateInterval: number;
}

/**
 * Time scheduler configuration
 */
export interface TimeSchedulerConfig {
  /** Whether to enable scheduler */
  enabled: boolean;
  /** Time zone for schedules */
  defaultTimeZone: string;
  /** Maximum schedules to run simultaneously */
  maxConcurrentSchedules: number;
  /** Schedule execution timeout */
  scheduleTimeout: number;
}

/**
 * Event trigger configuration (manager level)
 */
export interface EventTriggerManagerConfig {
  /** Whether to enable event triggers */
  enabled: boolean;
  /** Maximum concurrent event handlers */
  maxConcurrentHandlers: number;
  /** Event processing timeout */
  eventTimeout: number;
  /** Default debounce time */
  defaultDebounceTime: number;
  /** Default throttle time */
  defaultThrottleTime: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error for preload operations
 */
export class PreloadError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = "PreloadError";
  }
}

/**
 * Module load error
 */
export class ModuleLoadError extends PreloadError {
  constructor(
    message: string,
    public moduleName: string,
    public version: string
  ) {
    super(message, "MODULE_LOAD_ERROR");
    this.name = "ModuleLoadError";
  }
}

/**
 * Prediction error
 */
export class PredictionError extends PreloadError {
  constructor(
    message: string,
    public moduleName: string
  ) {
    super(message, "PREDICTION_ERROR");
    this.name = "PredictionError";
  }
}

/**
 * Schedule error
 */
export class ScheduleError extends PreloadError {
  constructor(
    message: string,
    public scheduleId: string
  ) {
    super(message, "SCHEDULE_ERROR");
    this.name = "ScheduleError";
  }
}

/**
 * Event trigger error
 */
export class EventTriggerError extends PreloadError {
  constructor(
    message: string,
    public eventType: string
  ) {
    super(message, "EVENT_TRIGGER_ERROR");
    this.name = "EventTriggerError";
  }
}

/**
 * Cache error
 */
export class CacheError extends PreloadError {
  constructor(
    message: string,
    public key: string
  ) {
    super(message, "CACHE_ERROR");
    this.name = "CacheError";
  }
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type for configuration updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Module factory function
 */
export type ModuleFactory = () => Promise<any>;

/**
 * Preload callback
 */
export type PreloadCallback = (result: PredictionResult) => void;

/**
 * Event listener
 */
export type EventListener = (event: PreloadEvent) => void | Promise<void>;

/**
 * Module load result (for federation)
 */
export interface ModuleLoadResult {
  module: any;
  version: string;
  loadTime: number;
  cached: boolean;
}
