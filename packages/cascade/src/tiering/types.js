/**
 * Tier types for Scale-Adaptive Tiers feature
 *
 * Implements automatic tier detection and routing based on request volume:
 * - Quick Flow Tier: < 10 requests/minute (fast path, minimal overhead)
 * - Standard Tier: 10-100 requests/minute (full CascadeRouter functionality)
 * - Enterprise Tier: > 100 requests/minute (advanced features, queuing, batching)
 */
/**
 * Default tier limits
 */
export const DEFAULT_TIER_LIMITS = {
    quick: {
        maxRpm: 10,
        features: ["basic-routing"],
        baseLatency: 20,
    },
    standard: {
        maxRpm: 100,
        features: [
            "basic-routing",
            "complexity-analysis",
            "emotional-intelligence",
            "semantic-caching",
            "cost-tracking",
            "query-refinement",
        ],
        baseLatency: 50,
    },
    enterprise: {
        maxRpm: Infinity,
        features: [
            "basic-routing",
            "complexity-analysis",
            "emotional-intelligence",
            "semantic-caching",
            "cost-tracking",
            "query-refinement",
            "priority-queuing",
            "batch-processing",
            "predictive-prefetch",
            "advanced-metrics",
            "custom-rules",
        ],
        baseLatency: 100,
        maxQueueSize: 1000,
    },
};
/**
 * Default tier configuration
 */
export const DEFAULT_TIER_CONFIG = {
    mode: "auto",
    autoUpgradeThreshold: 10,
    autoDowngradeThreshold: 8,
    manualOverride: false,
    rpmWindowSeconds: 60,
    hysteresis: 0.2,
};
//# sourceMappingURL=types.js.map