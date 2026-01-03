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
import { DEFAULT_TIER_LIMITS, DEFAULT_TIER_CONFIG } from "./types.js";
import { RequestRateMonitor } from "./RequestRateMonitor.js";
/**
 * TierManager - Central tier management
 */
export class TierManager {
    config;
    currentTier;
    tierStartTime;
    totalTransitions = 0;
    lastTransitionTime;
    requestsProcessed = 0;
    successfulRequests = 0;
    totalLatency = 0;
    rateMonitor;
    manualTier = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_TIER_CONFIG, ...config };
        this.currentTier = config.currentTier ?? "quick";
        this.tierStartTime = Date.now();
        this.lastTransitionTime = Date.now();
        this.rateMonitor = new RequestRateMonitor(this.config.rpmWindowSeconds);
        if (config.mode === "manual" && config.currentTier) {
            this.manualTier = config.currentTier;
        }
    }
    /**
     * Get current tier
     */
    getCurrentTier() {
        return this.config.mode === "manual" && this.manualTier
            ? this.manualTier
            : this.currentTier;
    }
    /**
     * Record a request for monitoring
     */
    recordRequest(timestamp = Date.now()) {
        this.rateMonitor.recordRequest(timestamp);
        this.requestsProcessed++;
        // Auto-adjust tier if in auto mode
        if (this.config.mode === "auto") {
            this.adjustTierIfNeeded(timestamp);
        }
    }
    /**
     * Record successful request
     */
    recordSuccess(latency) {
        this.successfulRequests++;
        this.totalLatency += latency;
    }
    /**
     * Get tier limits for current tier
     */
    getTierLimits(tier) {
        const t = tier || this.getCurrentTier();
        return DEFAULT_TIER_LIMITS[t];
    }
    /**
     * Check if tier should be upgraded
     */
    shouldUpgradeTier(requestRate) {
        if (this.config.mode === "manual" || this.manualTier) {
            return false;
        }
        const rpm = requestRate ?? this.rateMonitor.getCurrentRpm();
        const limits = this.getTierLimits();
        // Apply hysteresis
        const threshold = this.config.autoUpgradeThreshold * (1 + this.config.hysteresis);
        return rpm > threshold && this.currentTier !== "enterprise";
    }
    /**
     * Check if tier should be downgraded
     */
    shouldDowngradeTier(requestRate) {
        if (this.config.mode === "manual" || this.manualTier) {
            return false;
        }
        const rpm = requestRate ?? this.rateMonitor.getCurrentRpm();
        // Apply hysteresis
        const threshold = this.config.autoDowngradeThreshold * (1 - this.config.hysteresis);
        // Can only downgrade if not already at quick
        return rpm < threshold && this.currentTier !== "quick";
    }
    /**
     * Manually set tier (overrides auto mode)
     */
    setManualTier(tier) {
        if (!this.config.manualOverride) {
            throw new Error("Manual override is disabled. Set manualOverride to true in config.");
        }
        this.manualTier = tier;
        this.config.mode = "manual";
        this.transitionToTier(tier);
    }
    /**
     * Enable automatic mode
     */
    enableAutoMode() {
        this.manualTier = null;
        this.config.mode = "auto";
    }
    /**
     * Get comprehensive tier statistics
     */
    getTierStats() {
        const metrics = this.rateMonitor.getMetrics();
        const now = Date.now();
        return {
            currentTier: this.getCurrentTier(),
            currentRpm: metrics.currentRpm,
            averageRpm: metrics.averageRpm,
            peakRpm: metrics.peakRpm,
            timeInTier: now - this.tierStartTime,
            totalTransitions: this.totalTransitions,
            lastTransitionTime: this.lastTransitionTime,
            requestsProcessed: this.requestsProcessed,
            successRate: this.requestsProcessed > 0
                ? this.successfulRequests / this.requestsProcessed
                : 1,
            averageLatency: this.successfulRequests > 0
                ? this.totalLatency / this.successfulRequests
                : 0,
        };
    }
    /**
     * Check if a feature is available in current tier
     */
    hasFeature(feature) {
        const limits = this.getTierLimits();
        return limits.features.includes(feature);
    }
    /**
     * Get all available features in current tier
     */
    getAvailableFeatures() {
        const limits = this.getTierLimits();
        return limits.features;
    }
    /**
     * Reset statistics (useful for testing)
     */
    resetStats() {
        this.rateMonitor.clear();
        this.requestsProcessed = 0;
        this.successfulRequests = 0;
        this.totalLatency = 0;
        this.totalTransitions = 0;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        // Update rate monitor window if changed
        if (config.rpmWindowSeconds !== undefined) {
            this.rateMonitor = new RequestRateMonitor(config.rpmWindowSeconds);
        }
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Automatically adjust tier based on current request rate
     */
    adjustTierIfNeeded(timestamp) {
        const rpm = this.rateMonitor.getCurrentRpm(timestamp);
        if (this.shouldUpgradeTier(rpm)) {
            this.upgradeTier();
        }
        else if (this.shouldDowngradeTier(rpm)) {
            this.downgradeTier();
        }
    }
    /**
     * Upgrade to next tier
     */
    upgradeTier() {
        const previousTier = this.currentTier;
        if (this.currentTier === "quick") {
            this.transitionToTier("standard");
        }
        else if (this.currentTier === "standard") {
            this.transitionToTier("enterprise");
        }
        if (previousTier !== this.currentTier) {
            console.debug(`[TierManager] Upgraded from ${previousTier} to ${this.currentTier}`);
        }
    }
    /**
     * Downgrade to previous tier
     */
    downgradeTier() {
        const previousTier = this.currentTier;
        if (this.currentTier === "enterprise") {
            this.transitionToTier("standard");
        }
        else if (this.currentTier === "standard") {
            this.transitionToTier("quick");
        }
        if (previousTier !== this.currentTier) {
            console.debug(`[TierManager] Downgraded from ${previousTier} to ${this.currentTier}`);
        }
    }
    /**
     * Transition to a specific tier
     */
    transitionToTier(tier) {
        if (this.currentTier === tier) {
            return;
        }
        this.currentTier = tier;
        this.tierStartTime = Date.now();
        this.lastTransitionTime = Date.now();
        this.totalTransitions++;
    }
    /**
     * Get rate monitor instance (for advanced usage)
     */
    getRateMonitor() {
        return this.rateMonitor;
    }
}
//# sourceMappingURL=TierManager.js.map