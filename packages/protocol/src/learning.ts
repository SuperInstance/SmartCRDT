/**
 * Learning and Adaptation Protocol Types
 *
 * Cross-package types for learning, telemetry, and adaptation.
 * These types are shared between @lsi/learning and other packages.
 */

/**
 * Learning profile for a SuperInstance installation
 *
 * Each installation develops its own profile based on:
 * - Hardware characteristics
 * - Usage patterns
 * - Performance metrics
 * - Error rates
 */
export interface LearningProfile {
  /** Unique identifier for this installation */
  installationId: string;
  /** Hardware profile */
  hardware: LearningHardwareProfile;
  /** Usage patterns */
  usage: UsageProfile;
  /** Performance metrics */
  performance: PerformanceProfile;
  /** User preferences */
  preferences: PreferenceProfile;
  /** When this profile was last updated */
  learnedAt: Date;
  /** Profile version */
  version: number;
}

/**
 * Hardware characteristics
 */
export interface LearningHardwareProfile {
  /** CPU information */
  cpu: {
    /** Number of cores */
    cores: number;
    /** Frequency in MHz */
    frequency: number;
    /** Architecture (x86_64, arm64, etc.) */
    architecture: string;
    /** CPU model name */
    model?: string;
  };
  /** Memory information */
  memory: {
    /** Total memory in bytes */
    total: number;
    /** Available memory in bytes */
    available: number;
  };
  /** GPU information (if available) */
  gpu?: {
    /** Whether GPU is available */
    available: boolean;
    /** GPU memory in bytes */
    memory?: number;
    /** GPU model */
    model?: string;
    /** GPU vendor */
    vendor?: string;
  };
  /** When this profile was detected */
  detectedAt: Date;
}

/**
 * Usage patterns over time
 */
export interface UsageProfile {
  /** Query patterns */
  queryPatterns: {
    /** Average query complexity (0-1) */
    averageComplexity: number;
    /** Complexity distribution (bucket -> count) */
    complexityDistribution: Map<number, number>;
    /** Peak usage hours (0-23) */
    peakHours: number[];
    /** Average queries per hour */
    averageQueriesPerHour: number;
    /** Total queries processed */
    totalQueries: number;
  };
  /** Routing patterns */
  routing: {
    /** Local model preference (0-1) */
    localModelPreference: number;
    /** Cloud fallback rate (0-1) */
    cloudFallbackRate: number;
    /** Common query patterns */
    commonPatterns: string[];
    /** Cache hit rate */
    cacheHitRate: number;
  };
  /** Feature usage */
  features: {
    /** Most used features */
    mostUsed: string[];
    /** Rarely used features */
    rarelyUsed: string[];
    /** Feature interdependencies */
    featureInterdependencies: Map<string, string[]>;
  };
}

/**
 * Performance metrics
 */
export interface PerformanceProfile {
  /** Latency measurements */
  latencies: {
    /** Local model latencies (ms) */
    localModel: number[];
    /** Cloud model latencies (ms) */
    cloudModel: number[];
    /** Cache latencies (ms) */
    cache: number[];
  };
  /** Cache performance */
  cache: {
    /** Hit rate (0-1) */
    hitRate: number;
    /** Miss patterns */
    missPatterns: string[];
    /** Eviction effectiveness (0-1) */
    evictionEffectiveness: number;
  };
  /** Error tracking */
  errors: {
    /** Error rate (0-1) */
    rate: number;
    /** Common errors */
    commonErrors: Map<string, number>;
  };
}

/**
 * User preferences (learned or explicit)
 */
export interface PreferenceProfile {
  /** Privacy preference (0-1, higher = more private) */
  privacy: number;
  /** Cost preference (0-1, higher = more cost-conscious) */
  cost: number;
  /** Speed preference (0-1, higher = prioritize speed) */
  speed: number;
  /** Quality preference (0-1, higher = prioritize quality) */
  quality: number;
  /** Custom preferences */
  custom?: Map<string, unknown>;
}

/**
 * Telemetry entry for a single query
 */
export interface TelemetryEntry {
  /** Timestamp */
  timestamp: number;
  /** Query text (hashed if sensitive) */
  query: string;
  /** Routing destination */
  route: RoutingDestination;
  /** Query complexity (0-1) */
  complexity: number;
  /** Latency in milliseconds */
  latency: number;
  /** Whether the query succeeded */
  success: boolean;
  /** Whether the result was from cache */
  cached: boolean;
  /** Model used */
  model?: string;
  /** Tokens used (if available) */
  tokens?: number;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Routing destination
 */
export type RoutingDestination = 'local' | 'cloud' | 'hybrid' | 'cache';

/**
 * Routing decision with metadata
 */
export interface LearningRoutingDecision {
  /** Which backend to use */
  destination: RoutingDestination;
  /** Model identifier */
  model?: string;
  /** Confidence in this decision (0-1) */
  confidence: number;
  /** Reason for this decision */
  reason: string;
  /** Query complexity (0-1) */
  complexity: number;
}

/**
 * Query outcome
 */
export interface QueryOutcome {
  /** Latency in milliseconds */
  latency: number;
  /** Whether the query succeeded */
  success: boolean;
  /** Whether the result was from cache */
  cached: boolean;
  /** Model used */
  model?: string;
  /** Tokens used (if available) */
  tokens?: number;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Routing recommendation based on learning
 */
export interface RoutingRecommendation {
  /** Recommended destination */
  destination: RoutingDestination;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Reason for recommendation */
  reason: string;
  /** Expected latency (ms) */
  expectedLatency?: number;
  /** Expected cost */
  expectedCost?: number;
}

/**
 * Hardware-aware configuration
 */
export interface HardwareConfig {
  /** Maximum concurrent queries */
  maxConcurrentQueries: number;
  /** Cache size in bytes */
  cacheSize: number;
  /** Whether to enable GPU acceleration */
  enableGPU: boolean;
  /** Parallelism level */
  parallelism: number;
  /** Memory limit in bytes */
  memoryLimit: number;
}

/**
 * Learning engine configuration
 */
export interface LearningConfig {
  /** Data directory for storing profiles */
  dataDir: string;
  /** Profile update interval (hours) */
  updateInterval: number;
  /** Minimum queries before profile update */
  minQueriesForUpdate: number;
  /** Telemetry retention period (days) */
  retentionDays: number;
  /** Whether learning is enabled */
  enabled: boolean;
  /** Whether to encrypt profiles at rest */
  encryptProfiles: boolean;
  /** Maximum telemetry entries in memory */
  maxMemoryEntries: number;
}

/**
 * Query for routing recommendation
 */
export interface Query {
  /** Query text */
  text: string;
  /** Query complexity (optional, will be calculated) */
  complexity?: number;
  /** User context */
  context?: QueryContext;
}

/**
 * Query context
 */
export interface QueryContext {
  /** User ID (optional) */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Timestamp */
  timestamp?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Learning statistics
 */
export interface LearningStatistics {
  /** Total queries processed */
  totalQueries: number;
  /** Queries in learning period */
  queriesInPeriod: number;
  /** Profile age (hours) */
  profileAge: number;
  /** Telemetry size (bytes) */
  telemetrySize: number;
  /** Profile size (bytes) */
  profileSize: number;
}

/**
 * Learning engine result
 */
export interface LearningResult<T> {
  /** Result data */
  data: T;
  /** Confidence in result (0-1) */
  confidence: number;
  /** Metadata */
  metadata: {
    /** Timestamp */
    timestamp: number;
    /** Profile version */
    profileVersion: number;
    /** Source of this result */
    source: 'profile' | 'realtime' | 'default';
  };
}

/**
 * Learning engine interface
 *
 * This interface can be implemented by other packages to provide
 * learning capabilities.
 */
export interface ILearningEngine {
  /**
   * Initialize the learning engine
   */
  initialize(): Promise<void>;

  /**
   * Record a query and its outcome
   */
  recordQuery(
    query: string,
    route: LearningRoutingDecision,
    outcome: QueryOutcome
  ): Promise<void>;

  /**
   * Get routing recommendation based on learning
   */
  getRoutingRecommendation(query: Query): RoutingRecommendation;

  /**
   * Get hardware-aware configuration
   */
  getHardwareConfig(): HardwareConfig;

  /**
   * Get user preferences
   */
  getPreferences(): PreferenceProfile;

  /**
   * Update user preferences
   */
  updatePreferences(preferences: Partial<PreferenceProfile>): Promise<void>;

  /**
   * Get learning statistics
   */
  getStatistics(): Promise<LearningStatistics>;

  /**
   * Get the current learning profile
   */
  getProfile(): LearningProfile | null;

  /**
   * Export learning data
   */
  exportData(): Promise<{
    profile: LearningProfile | null;
    telemetry: TelemetryEntry[];
  }>;

  /**
   * Clear all learning data
   */
  clearData(): Promise<void>;

  /**
   * Shutdown the learning engine
   */
  shutdown(): Promise<void>;
}

/**
 * Telemetry collector interface
 */
export interface ITelemetryCollector {
  /**
   * Start the telemetry collector
   */
  start(): Promise<void>;

  /**
   * Stop the telemetry collector
   */
  stop(): Promise<void>;

  /**
   * Record a telemetry entry
   */
  record(entry: TelemetryEntry): Promise<void>;

  /**
   * Get recent telemetry entries
   */
  getRecent(duration: number): Promise<TelemetryEntry[]>;

  /**
   * Get telemetry statistics
   */
  getStats(duration?: number): Promise<{
    totalEntries: number;
    bufferEntries: number;
    diskEntries: number;
    oldestEntry?: number;
    newestEntry?: number;
  }>;

  /**
   * Delete old telemetry data
   */
  prune(retentionDays: number): Promise<number>;

  /**
   * Clear all telemetry data
   */
  clear(): Promise<void>;
}

/**
 * Hardware profiler interface
 */
export interface IHardwareProfiler {
  /**
   * Profile system hardware
   */
  profile(): Promise<LearningHardwareProfile>;

  /**
   * Get a hardware fingerprint
   */
  getFingerprint(): Promise<string>;

  /**
   * Check if hardware has changed significantly
   */
  hasHardwareChanged(previousProfile: LearningHardwareProfile): Promise<boolean>;
}
