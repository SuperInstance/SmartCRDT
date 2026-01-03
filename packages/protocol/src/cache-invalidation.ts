/**
 * Cache Invalidation Protocol Types
 *
 * Defines the protocol for cache invalidation strategies, policies, and triggers.
 * Part of the @lsi/protocol package for Aequor Cognitive Orchestration Platform.
 *
 * Cache invalidation is one of the hardest problems in distributed systems.
 * These types provide a standard interface for multiple invalidation strategies:
 *
 * 1. TTL (Time-To-Live) - Expire after fixed duration
 * 2. Sliding Expiration - Reset TTL on access
 * 3. Semantic Drift - Invalidate when cached answer diverges from fresh
 * 4. Manual - Explicit invalidation API
 * 5. Tag-based - Group entries, invalidate by tag
 * 6. Dependency-based - Track dependencies, cascade invalidations
 */

// ============================================================================
// CACHE INVALIDATION STRATEGY TYPES
// ============================================================================

/**
 * Cache invalidation strategy types
 *
 * Each strategy defines a different approach to determining when cache entries
 * should be evicted or refreshed.
 */
export type CacheInvalidationStrategy =
  /** Time-To-Live - Expire after fixed duration */
  | "ttl"
  /** Sliding Expiration - Reset TTL on each access */
  | "sliding"
  /** Semantic Drift - Invalidate when cached result diverges from fresh */
  | "semantic-drift"
  /** Manual - Explicit invalidation via API */
  | "manual"
  /** Tag-based - Invalidate entries by tag */
  | "tagged"
  /** Dependency-based - Cascade invalidations based on dependencies */
  | "dependency"
  /** LRU - Least Recently Used */
  | "lru"
  /** LFU - Least Frequently Used */
  | "lfu"
  /** FIFO - First In First Out */
  | "fifo"
  /** Adaptive - Dynamic strategy based on performance metrics */
  | "adaptive";

/**
 * Cache invalidation trigger types
 *
 * Defines what events or conditions can trigger cache invalidation.
 */
export type CacheInvalidationTrigger =
  /** Data source changed */
  | "data-source-changed"
  /** User performed an action */
  | "user-action"
  /** Time-based expiration elapsed */
  | "time-expired"
  /** Semantic threshold exceeded */
  | "semantic-threshold"
  /** Manual cache clear requested */
  | "manual-clear"
  /** Memory pressure - cache too large */
  | "memory-pressure"
  /** Dependency changed */
  | "dependency-changed"
  /** Tag invalidated */
  | "tag-invalidated"
  /** Entry explicitly evicted */
  | "explicit-eviction"
  /** Cache full - need space */
  | "cache-full";

// ============================================================================
// CACHE ENTRY METADATA
// ============================================================================

/**
 * Extended cache entry metadata for invalidation tracking
 *
 * Cache entries need additional metadata beyond basic access tracking
 * to support sophisticated invalidation strategies.
 */
export interface CacheEntryMetadata {
  /** Unique cache key */
  key: string;
  /** Query text that generated this entry */
  query: string;
  /** Timestamp when entry was created */
  createdAt: number;
  /** Timestamp when entry was last accessed */
  lastAccessed: number;
  /** Number of times this entry was accessed */
  hitCount: number;
  /** Entry expiration timestamp (if applicable) */
  expiresAt?: number;
  /** Tags associated with this entry */
  tags: string[];
  /** Dependencies - keys this entry depends on */
  dependencies: string[];
  /** Dependents - keys that depend on this entry */
  dependents: string[];
  /** Semantic embedding vector */
  embedding: number[];
  /** Entry priority (higher = less likely to evict) */
  priority: number;
  /** Entry size in bytes (estimate) */
  size: number;
  /** Whether this entry is pinned (never evict) */
  pinned: boolean;
  /** Validation status */
  valid: boolean;
  /** Invalidated reason (if invalid) */
  invalidationReason?: string;
}

// ============================================================================
// INVALIDATION STRATEGY CONFIGURATIONS
// ============================================================================

/**
 * Base invalidation strategy configuration
 *
 * Common configuration options for all invalidation strategies.
 */
export interface BaseInvalidationConfig {
  /** Whether this strategy is enabled */
  enabled: boolean;
  /** Priority of this strategy (higher = checked first) */
  priority: number;
  /** Maximum number of entries to invalidate in one operation */
  maxInvalidations?: number;
  /** Dry run - don't actually invalidate */
  dryRun?: boolean;
}

/**
 * TTL invalidation configuration
 *
 * Time-To-Live strategy expires entries after a fixed duration,
 * regardless of access patterns.
 */
export interface TTLInvalidationConfig extends BaseInvalidationConfig {
  strategy: "ttl";
  /** Time-to-live in milliseconds */
  ttl: number;
  /** Whether to use soft deletes (mark invalid, keep in cache) */
  softDelete?: boolean;
}

/**
 * Sliding expiration configuration
 *
 * Sliding expiration resets the TTL on each access, keeping frequently
 * accessed entries fresh.
 */
export interface SlidingExpirationConfig extends BaseInvalidationConfig {
  strategy: "sliding";
  /** Sliding window duration in milliseconds */
  window: number;
  /** Minimum time before expiration can be reset */
  minResetInterval?: number;
}

/**
 * Semantic drift invalidation configuration
 *
 * Semantic drift detection compares cached results against fresh results
 * and invalidates when they diverge beyond a threshold.
 */
export interface SemanticDriftConfig extends BaseInvalidationConfig {
  strategy: "semantic-drift";
  /** Similarity threshold below which to invalidate (0-1) */
  similarityThreshold: number;
  /** Number of samples before triggering invalidation */
  sampleWindow: number;
  /** Whether to auto-refresh on drift detection */
  autoRefresh?: boolean;
  /** Maximum age before forced validation */
  maxAge?: number;
}

/**
 * Tag-based invalidation configuration
 *
 * Tag-based grouping allows invalidating multiple related entries at once.
 */
export interface TagInvalidationConfig extends BaseInvalidationConfig {
  strategy: "tagged";
  /** Tags to invalidate */
  tags: string[];
  /** Tag matching strategy */
  matchMode: "exact" | "prefix" | "regex";
  /** Whether to invalidate dependencies too */
  cascade?: boolean;
}

/**
 * Dependency-based invalidation configuration
 *
 * Dependency tracking ensures that when a dependency changes, all
 * dependent cache entries are invalidated.
 */
export interface DependencyInvalidationConfig extends BaseInvalidationConfig {
  strategy: "dependency";
  /** Changed dependency keys */
  changedKeys: string[];
  /** Cascade depth (how many levels to invalidate) */
  cascadeDepth?: number;
  /** Whether to use soft deletes */
  softDelete?: boolean;
}

/**
 * LRU invalidation configuration
 *
 * Least Recently Used strategy evicts entries that haven't been accessed
 * in the longest time.
 */
export interface LRUInvalidationConfig extends BaseInvalidationConfig {
  strategy: "lru";
  /** Maximum age in milliseconds */
  maxAge: number;
  /** Whether to use soft deletes */
  softDelete?: boolean;
}

/**
 * LFU invalidation configuration
 *
 * Least Frequently Used strategy evicts entries with the lowest hit counts.
 */
export interface LFUInvalidationConfig extends BaseInvalidationConfig {
  strategy: "lfu";
  /** Minimum hit count threshold */
  minHitCount: number;
  /** Whether to consider recency */
  considerRecency?: boolean;
}

/**
 * FIFO invalidation configuration
 *
 * First In First Out evicts entries in creation order.
 */
export interface FIFOInvalidationConfig extends BaseInvalidationConfig {
  strategy: "fifo";
  /** Maximum number of entries */
  maxSize: number;
  /** Whether to respect pinned status */
  respectPinned?: boolean;
}

/**
 * Adaptive invalidation configuration
 *
 * Adaptive strategy dynamically selects the best approach based on
 * performance metrics and cache state.
 */
export interface AdaptiveInvalidationConfig extends BaseInvalidationConfig {
  strategy: "adaptive";
  /** Target hit rate (0-1) */
  targetHitRate: number;
  /** Maximum cache utilization (0-1) */
  maxUtilization: number;
  /** Measurement window for metrics */
  measurementWindow: number;
  /** Available strategies to choose from */
  availableStrategies: CacheInvalidationStrategy[];
}

/**
 * Union type of all invalidation configurations
 */
export type InvalidationConfig =
  | TTLInvalidationConfig
  | SlidingExpirationConfig
  | SemanticDriftConfig
  | TagInvalidationConfig
  | DependencyInvalidationConfig
  | LRUInvalidationConfig
  | LFUInvalidationConfig
  | FIFOInvalidationConfig
  | AdaptiveInvalidationConfig;

// ============================================================================
// INVALIDATION RESULTS
// ============================================================================

/**
 * Individual invalidation result
 *
 * Details about a single cache entry that was invalidated.
 */
export interface InvalidationEntry {
  /** Cache key that was invalidated */
  key: string;
  /** Query text */
  query: string;
  /** Reason for invalidation */
  reason: string;
  /** Trigger that caused invalidation */
  trigger: CacheInvalidationTrigger;
  /** Timestamp of invalidation */
  timestamp: number;
  /** Whether entry was pinned (should not happen) */
  wasPinned: boolean;
  /** Entry age at invalidation (ms) */
  age: number;
  /** Entry hit count at invalidation */
  hitCount: number;
}

/**
 * Batch invalidation result
 *
 * Summary of a batch invalidation operation.
 */
export interface InvalidationResult {
  /** Strategy that was used */
  strategy: CacheInvalidationStrategy;
  /** Configuration that was applied */
  config: InvalidationConfig;
  /** Number of entries invalidated */
  count: number;
  /** Number of entries that were skipped (pinned, etc.) */
  skipped: number;
  /** Total entries examined */
  examined: number;
  /** Duration of invalidation operation (ms) */
  duration: number;
  /** Individual entry results (optional, can be large) */
  entries?: InvalidationEntry[];
  /** Whether this was a dry run */
  dryRun: boolean;
  /** Success status */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// INVALIDATION POLICY
// ============================================================================

/**
 * Cache invalidation policy
 *
 * Defines which invalidation strategies to use and when to apply them.
 * Supports multiple strategies with priority-based execution.
 */
export interface CacheInvalidationPolicy {
  /** Policy identifier */
  id: string;
  /** Policy name/description */
  name: string;
  /** Policy version */
  version: string;
  /** Invalidations strategies to apply (in priority order) */
  strategies: InvalidationConfig[];
  /** Whether to automatically apply policy */
  autoApply: boolean;
  /** Auto-apply interval (ms) */
  autoApplyInterval?: number;
  /** Tags this policy applies to (empty = all entries) */
  appliesToTags: string[];
  /** Tags this policy excludes */
  excludesTags: string[];
  /** Maximum cache size before triggering policy */
  maxCacheSize?: number;
  /** Maximum cache memory usage before triggering policy */
  maxCacheMemory?: number;
  /** Created timestamp */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
  /** Last applied timestamp */
  lastApplied?: number;
  /** Policy metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Invalidations policy evaluation context
 *
 * Provides context for evaluating when to apply an invalidation policy.
 */
export interface PolicyEvaluationContext {
  /** Current cache size */
  cacheSize: number;
  /** Current cache memory usage (bytes) */
  cacheMemoryUsage: number;
  /** Current cache hit rate */
  cacheHitRate: number;
  /** Time since last invalidation */
  timeSinceLastInvalidation: number;
  /** Number of entries pending invalidation */
  pendingInvalidations: number;
  /** Available memory (bytes) */
  availableMemory: number;
  /** System load (0-1) */
  systemLoad: number;
}

/**
 * Policy evaluation result
 *
 * Result of evaluating whether an invalidation policy should be applied.
 */
export interface PolicyEvaluationResult {
  /** Whether the policy should be applied */
  shouldApply: boolean;
  /** Confidence in this decision (0-1) */
  confidence: number;
  /** Reasoning for the decision */
  reasoning: string;
  /** Recommended configuration adjustments */
  recommendedAdjustments?: Partial<InvalidationConfig>[];
  /** Estimated impact if applied */
  estimatedImpact?: {
    /** Estimated entries to invalidate */
    entriesToInvalidate: number;
    /** Estimated memory to free (bytes) */
    memoryToFree: number;
    /** Expected hit rate improvement */
    hitRateImprovement: number;
  };
}

// ============================================================================
// CACHE INVALIDATION INTERFACE
// ============================================================================

/**
 * Cache invalidation manager interface
 *
 * Defines the contract for cache invalidation implementations.
 * All cache invalidation strategies should implement this interface.
 */
export interface ICacheInvalidationManager {
  /**
   * Invalidate cache entries using the specified strategy
   *
   * @param config - Invalidation configuration
   * @returns Invalidation result
   */
  invalidate(config: InvalidationConfig): Promise<InvalidationResult>;

  /**
   * Invalidate a specific cache entry by key
   *
   * @param key - Cache key to invalidate
   * @param reason - Reason for invalidation
   * @returns Whether entry was found and invalidated
   */
  invalidateKey(key: string, reason: string): Promise<boolean>;

  /**
   * Invalidate cache entries by tag
   *
   * @param tags - Tags to invalidate
   * @param cascade - Whether to cascade to dependencies
   * @returns Number of entries invalidated
   */
  invalidateByTags(tags: string[], cascade?: boolean): Promise<number>;

  /**
   * Invalidate entries by dependency
   *
   * @param dependencyKey - Dependency key that changed
   * @param cascadeDepth - How many levels to cascade
   * @returns Number of entries invalidated
   */
  invalidateByDependency(
    dependencyKey: string,
    cascadeDepth?: number
  ): Promise<number>;

  /**
   * Manually trigger semantic drift detection
   *
   * @param sampleKeys - Optional specific keys to check
   * @returns Number of entries invalidated
   */
  detectSemanticDrift(sampleKeys?: string[]): Promise<number>;

  /**
   * Clear all cache entries
   *
   * @param reason - Reason for clearing
   * @returns Number of entries cleared
   */
  clearAll(reason: string): Promise<number>;

  /**
   * Apply an invalidation policy
   *
   * @param policy - Policy to apply
   * @param context - Evaluation context
   * @returns Invalidation result
   */
  applyPolicy(
    policy: CacheInvalidationPolicy,
    context: PolicyEvaluationContext
  ): Promise<InvalidationResult>;

  /**
   * Evaluate whether a policy should be applied
   *
   * @param policy - Policy to evaluate
   * @param context - Evaluation context
   * @returns Evaluation result
   */
  evaluatePolicy(
    policy: CacheInvalidationPolicy,
    context: PolicyEvaluationContext
  ): Promise<PolicyEvaluationResult>;

  /**
   * Get invalidation statistics
   *
   * @returns Invalidation statistics
   */
  getInvalidationStats(): Promise<InvalidationStatistics>;

  /**
   * Check if a cache entry is valid
   *
   * @param key - Cache key to check
   * @returns Whether entry is valid
   */
  isEntryValid(key: string): Promise<boolean>;

  /**
   * Pin an entry to prevent eviction
   *
   * @param key - Cache key to pin
   * @returns Whether pin was successful
   */
  pinEntry(key: string): Promise<boolean>;

  /**
   * Unpin an entry to allow eviction
   *
   * @param key - Cache key to unpin
   * @returns Whether unpin was successful
   */
  unpinEntry(key: string): Promise<boolean>;

  /**
   * Add tags to a cache entry
   *
   * @param key - Cache key
   * @param tags - Tags to add
   * @returns Whether tags were added successfully
   */
  addTags(key: string, tags: string[]): Promise<boolean>;

  /**
   * Remove tags from a cache entry
   *
   * @param key - Cache key
   * @param tags - Tags to remove
   * @returns Whether tags were removed successfully
   */
  removeTags(key: string, tags: string[]): Promise<boolean>;

  /**
   * Add dependency relationship
   *
   * @param dependentKey - Entry that depends on dependencyKey
   * @param dependencyKey - Entry that dependentKey depends on
   * @returns Whether relationship was added
   */
  addDependency(
    dependentKey: string,
    dependencyKey: string
  ): Promise<boolean>;

  /**
   * Remove dependency relationship
   *
   * @param dependentKey - Entry that depends on dependencyKey
   * @param dependencyKey - Entry that dependentKey depends on
   * @returns Whether relationship was removed
   */
  removeDependency(
    dependentKey: string,
    dependencyKey: string
  ): Promise<boolean>;

  /**
   * Get dependencies for a cache entry
   *
   * @param key - Cache key
   * @returns Array of dependency keys
   */
  getDependencies(key: string): Promise<string[]>;

  /**
   * Get dependents for a cache entry
   *
   * @param key - Cache key
   * @returns Array of dependent keys
   */
  getDependents(key: string): Promise<string[]>;
}

// ============================================================================
// INVALIDATION STATISTICS
// ============================================================================

/**
 * Cache invalidation statistics
 *
 * Aggregated statistics about cache invalidation operations.
 */
export interface InvalidationStatistics {
  /** Total invalidations performed */
  totalInvalidations: number;
  /** Invalidations by strategy */
  invalidationsByStrategy: Record<CacheInvalidationStrategy, number>;
  /** Invalidations by trigger */
  invalidationsByTrigger: Record<CacheInvalidationTrigger, number>;
  /** Average entries invalidated per operation */
  avgEntriesPerInvalidation: number;
  /** Total time spent invalidating (ms) */
  totalInvalidationTime: number;
  /** Average invalidation time (ms) */
  avgInvalidationTime: number;
  /** Cache hit rate before invalidations */
  hitRateBefore: number;
  /** Cache hit rate after invalidations */
  hitRateAfter: number;
  /** Memory freed by invalidations (bytes) */
  memoryFreed: number;
  /** Entries pinned */
  entriesPinned: number;
  /** Entries currently pending invalidation */
  pendingInvalidations: number;
  /** Last invalidation timestamp */
  lastInvalidation?: number;
  /** Invalidation history (recent) */
  recentHistory: InvalidationResult[];
}

// ============================================================================
// INVALIDATION EVENTS
// ============================================================================

/**
 * Cache invalidation event
 *
 * Event emitted when cache invalidation occurs.
 */
export interface CacheInvalidationEvent {
  /** Event type */
  type: "invalidation" | "policy-applied" | "drift-detected" | "cleared";
  /** Timestamp */
  timestamp: number;
  /** Strategy used */
  strategy?: CacheInvalidationStrategy;
  /** Trigger that caused invalidation */
  trigger: CacheInvalidationTrigger;
  /** Number of entries affected */
  entriesAffected: number;
  /** Policy ID (if applicable) */
  policyId?: string;
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Cache invalidation event listener
 *
 * Function signature for listening to invalidation events.
 */
export type CacheInvalidationEventListener = (
  event: CacheInvalidationEvent
) => void | Promise<void>;

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default TTL invalidation configuration (5 minutes)
 */
export const DEFAULT_TTL_CONFIG: TTLInvalidationConfig = {
  strategy: "ttl",
  enabled: true,
  priority: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
  softDelete: false,
};

/**
 * Default sliding expiration configuration (10 minutes)
 */
export const DEFAULT_SLIDING_CONFIG: SlidingExpirationConfig = {
  strategy: "sliding",
  enabled: true,
  priority: 90,
  window: 10 * 60 * 1000, // 10 minutes
  minResetInterval: 1000, // 1 second
};

/**
 * Default semantic drift configuration
 */
export const DEFAULT_SEMANTIC_DRIFT_CONFIG: SemanticDriftConfig = {
  strategy: "semantic-drift",
  enabled: true,
  priority: 80,
  similarityThreshold: 0.85,
  sampleWindow: 10,
  autoRefresh: false,
  maxAge: 30 * 60 * 1000, // 30 minutes
};

/**
 * Default LRU configuration
 */
export const DEFAULT_LRU_CONFIG: LRUInvalidationConfig = {
  strategy: "lru",
  enabled: true,
  priority: 70,
  maxAge: 15 * 60 * 1000, // 15 minutes
  softDelete: false,
};

/**
 * Default LFU configuration
 */
export const DEFAULT_LFU_CONFIG: LFUInvalidationConfig = {
  strategy: "lfu",
  enabled: true,
  priority: 60,
  minHitCount: 2,
  considerRecency: true,
};

/**
 * Default adaptive configuration
 */
export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveInvalidationConfig = {
  strategy: "adaptive",
  enabled: true,
  priority: 50,
  targetHitRate: 0.8,
  maxUtilization: 0.9,
  measurementWindow: 100,
  availableStrategies: ["lru", "lfu", "ttl"],
};

/**
 * Default invalidation policy
 *
 * Provides sensible defaults for cache invalidation.
 */
export const DEFAULT_INVALIDATION_POLICY: CacheInvalidationPolicy = {
  id: "default-invalidation-policy",
  name: "Default Cache Invalidation Policy",
  version: "1.0.0",
  strategies: [
    DEFAULT_TTL_CONFIG,
    DEFAULT_SLIDING_CONFIG,
    DEFAULT_SEMANTIC_DRIFT_CONFIG,
  ],
  autoApply: true,
  autoApplyInterval: 60 * 1000, // 1 minute
  appliesToTags: [],
  excludesTags: ["pinned"],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for TTL configuration
 */
export function isTTLConfig(
  config: InvalidationConfig
): config is TTLInvalidationConfig {
  return config.strategy === "ttl";
}

/**
 * Type guard for sliding expiration configuration
 */
export function isSlidingConfig(
  config: InvalidationConfig
): config is SlidingExpirationConfig {
  return config.strategy === "sliding";
}

/**
 * Type guard for semantic drift configuration
 */
export function isSemanticDriftConfig(
  config: InvalidationConfig
): config is SemanticDriftConfig {
  return config.strategy === "semantic-drift";
}

/**
 * Type guard for tag-based configuration
 */
export function isTagConfig(
  config: InvalidationConfig
): config is TagInvalidationConfig {
  return config.strategy === "tagged";
}

/**
 * Type guard for dependency configuration
 */
export function isDependencyConfig(
  config: InvalidationConfig
): config is DependencyInvalidationConfig {
  return config.strategy === "dependency";
}

/**
 * Type guard for LRU configuration
 */
export function isLRUConfig(
  config: InvalidationConfig
): config is LRUInvalidationConfig {
  return config.strategy === "lru";
}

/**
 * Type guard for LFU configuration
 */
export function isLFUConfig(
  config: InvalidationConfig
): config is LFUInvalidationConfig {
  return config.strategy === "lfu";
}

/**
 * Type guard for FIFO configuration
 */
export function isFIFOConfig(
  config: InvalidationConfig
): config is FIFOInvalidationConfig {
  return config.strategy === "fifo";
}

/**
 * Type guard for adaptive configuration
 */
export function isAdaptiveConfig(
  config: InvalidationConfig
): config is AdaptiveInvalidationConfig {
  return config.strategy === "adaptive";
}
