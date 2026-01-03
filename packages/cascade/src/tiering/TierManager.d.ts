/**
 * TierManager - Automatic tier detection and management
 *
 * Manages tier transitions based on request rate monitoring.
 * Supports both automatic and manual modes.
 *
 * Features:
 * - Automatic tier upgrade/downgrade based on RPM
 * - Hysteresis to prevent rapid switching
 * - Manual override support
 * - Graceful transitions between tiers
 * - Comprehensive statistics tracking
 *
 * Example:
 * ```ts
 * const manager = new TierManager(config);
 * manager.recordRequest(Date.now());
 * const currentTier = manager.getCurrentTier();
 * if (manager.shouldUpgradeTier()) {
 *   manager.upgradeTier();
 * }
 * ```
 */
import type { Tier, TierConfig, TierStats, TierLimits } from "./types.js";
import { RequestRateMonitor } from "./RequestRateMonitor.js";
/**
 * TierManager - Central tier management
 */
export declare class TierManager {
    private config;
    private currentTier;
    private tierStartTime;
    private totalTransitions;
    private lastTransitionTime;
    private requestsProcessed;
    private successfulRequests;
    private totalLatency;
    private rateMonitor;
    private manualTier;
    constructor(config?: Partial<TierConfig>);
    /**
     * Get current tier
     */
    getCurrentTier(): Tier;
    /**
     * Record a request for monitoring
     */
    recordRequest(timestamp?: number): void;
    /**
     * Record successful request
     */
    recordSuccess(latency: number): void;
    /**
     * Get tier limits for current tier
     */
    getTierLimits(tier?: Tier): TierLimits;
    /**
     * Check if tier should be upgraded
     */
    shouldUpgradeTier(requestRate?: number): boolean;
    /**
     * Check if tier should be downgraded
     */
    shouldDowngradeTier(requestRate?: number): boolean;
    /**
     * Manually set tier (overrides auto mode)
     */
    setManualTier(tier: Tier): void;
    /**
     * Enable automatic mode
     */
    enableAutoMode(): void;
    /**
     * Get comprehensive tier statistics
     */
    getTierStats(): TierStats;
    /**
     * Check if a feature is available in current tier
     */
    hasFeature(feature: string): boolean;
    /**
     * Get all available features in current tier
     */
    getAvailableFeatures(): string[];
    /**
     * Reset statistics (useful for testing)
     */
    resetStats(): void;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<TierConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): TierConfig;
    /**
     * Automatically adjust tier based on current request rate
     */
    private adjustTierIfNeeded;
    /**
     * Upgrade to next tier
     */
    private upgradeTier;
    /**
     * Downgrade to previous tier
     */
    private downgradeTier;
    /**
     * Transition to a specific tier
     */
    private transitionToTier;
    /**
     * Get rate monitor instance (for advanced usage)
     */
    getRateMonitor(): RequestRateMonitor;
}
//# sourceMappingURL=TierManager.d.ts.map