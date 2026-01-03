/**
 * Tier types for Scale-Adaptive Tiers feature
 *
 * Implements automatic tier detection and routing based on request volume:
 * - Quick Flow Tier: < 10 requests/minute (fast path, minimal overhead)
 * - Standard Tier: 10-100 requests/minute (full CascadeRouter functionality)
 * - Enterprise Tier: > 100 requests/minute (advanced features, queuing, batching)
 */
/**
 * Available routing tiers
 */
export type Tier = "quick" | "standard" | "enterprise";
/**
 * Tier configuration
 */
export interface TierConfig {
    /** Operating mode */
    mode: "auto" | "manual";
    /** Current tier (in manual mode) */
    currentTier?: Tier;
    /** Requests per minute threshold for auto-upgrade to standard */
    autoUpgradeThreshold: number;
    /** Requests per minute threshold for auto-downgrade to quick */
    autoDowngradeThreshold: number;
    /** Allow manual override */
    manualOverride: boolean;
    /** Window size for RPM calculation (seconds) */
    rpmWindowSeconds: number;
    /** Hysteresis to prevent rapid tier switching (0-1) */
    hysteresis: number;
}
/**
 * Tier-specific limits and features
 */
export interface TierLimits {
    /** Maximum requests per minute */
    maxRpm: number;
    /** Available features in this tier */
    features: TierFeature[];
    /** Estimated base latency (ms) */
    baseLatency: number;
    /** Maximum queue size (enterprise only) */
    maxQueueSize?: number;
}
/**
 * Features available per tier
 */
export type TierFeature = "basic-routing" | "complexity-analysis" | "emotional-intelligence" | "semantic-caching" | "cost-tracking" | "query-refinement" | "priority-queuing" | "batch-processing" | "predictive-prefetch" | "advanced-metrics" | "custom-rules";
/**
 * Tier statistics
 */
export interface TierStats {
    /** Current tier */
    currentTier: Tier;
    /** Current requests per minute */
    currentRpm: number;
    /** Average RPM over period */
    averageRpm: number;
    /** Peak RPM in current window */
    peakRpm: number;
    /** Time in current tier (ms) */
    timeInTier: number;
    /** Total tier transitions */
    totalTransitions: number;
    /** Last transition timestamp */
    lastTransitionTime: number;
    /** Requests processed in current tier */
    requestsProcessed: number;
    /** Success rate in current tier (0-1) */
    successRate: number;
    /** Average latency in current tier (ms) */
    averageLatency: number;
}
/**
 * Priority levels for enterprise queue
 */
export type PriorityLevel = "low" | "normal" | "high" | "urgent";
/**
 * Priority request for enterprise tier
 */
export interface PriorityRequest {
    /** The query/request text */
    request: string;
    /** Priority level */
    priority: PriorityLevel;
    /** Timestamp when queued */
    timestamp: number;
    /** User ID (for fairness) */
    userId?: string;
    /** Session ID */
    sessionId?: string;
    /** Estimated processing time (ms) */
    estimatedDuration?: number;
    /** Maximum wait time (ms) */
    maxWaitTime?: number;
    /** Request context */
    context?: Record<string, unknown>;
}
/**
 * Queue statistics
 */
export interface QueueStats {
    /** Current queue length */
    length: number;
    /** Estimated wait time (ms) */
    estimatedWaitTime: number;
    /** Requests by priority */
    byPriority: Record<PriorityLevel, number>;
    /** Oldest request age (ms) */
    oldestAge: number;
    /** Average wait time (ms) */
    averageWaitTime: number;
    /** Total processed */
    totalProcessed: number;
    /** Total dropped (timeout) */
    totalDropped: number;
}
/**
 * Request rate metrics
 */
export interface RequestRateMetrics {
    /** Current RPM */
    currentRpm: number;
    /** Average RPM over window */
    averageRpm: number;
    /** Peak RPM in window */
    peakRpm: number;
    /** Trough RPM in window */
    troughRpm: number;
    /** Standard deviation */
    stdDev: number;
    /** Spike detected (RPM increased >50% in short period) */
    spikeDetected: boolean;
    /** Trend direction */
    trend: "increasing" | "stable" | "decreasing";
}
/**
 * Router interface for tier-specific routing
 */
export interface TierRouter {
    /** Route a request */
    route(request: string, context?: Record<string, unknown>): Promise<RoutingDecision>;
    /** Check if this router can handle the request */
    canHandle(request: string): boolean;
    /** Get estimated latency for this router */
    getEstimatedLatency(): number;
    /** Get router statistics */
    getStats(): Record<string, unknown> | {
        totalRequests: number;
        localRequests: number;
        cloudRequests: number;
        averageLatency: number;
    } | {
        totalRequests: number;
        queuedRequests: number;
        directRequests: number;
        batchProcessed: number;
        averageLatency: number;
        totalLatency: number;
        queueStats: QueueStats;
        currentBatchSize: number;
    };
}
/**
 * Enhanced routing decision with tier info
 */
export interface RoutingDecision {
    /** Which route to take */
    route: "local" | "cloud" | "hybrid";
    /** Confidence in this decision (0-1) */
    confidence: number;
    /** Estimated latency in milliseconds */
    estimatedLatency: number;
    /** Estimated cost */
    estimatedCost: number;
    /** Tier used for routing */
    tier: Tier;
    /** Whether to use local preference */
    preferLocal?: boolean;
    /** Whether to skip refinement for speed */
    skipRefinement?: boolean;
    /** Suggest task breakdown to user */
    suggestBreakdown?: boolean;
    /** Suggest sharing/collaboration */
    suggestSharing?: boolean;
    /** Queue position (if queued) */
    queuePosition?: number;
    /** Estimated wait time (if queued) */
    estimatedWaitTime?: number;
    /** Additional notes */
    notes?: string[];
}
/**
 * Default tier limits
 */
export declare const DEFAULT_TIER_LIMITS: Record<Tier, TierLimits>;
/**
 * Default tier configuration
 */
export declare const DEFAULT_TIER_CONFIG: TierConfig;
//# sourceMappingURL=types.d.ts.map