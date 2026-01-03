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
import { DEFAULT_TIER_LIMITS, DEFAULT_TIER_CONFIG } from "./types.js";
import { RequestRateMonitor } from "./RequestRateMonitor.js";

/**
 * TierManager - Central tier management
 */
export class TierManager {
  private config: TierConfig;
  private currentTier: Tier;
  private tierStartTime: number;
  private totalTransitions: number = 0;
  private lastTransitionTime: number;
  private requestsProcessed: number = 0;
  private successfulRequests: number = 0;
  private totalLatency: number = 0;
  private rateMonitor: RequestRateMonitor;
  private manualTier: Tier | null = null;

  constructor(config: Partial<TierConfig> = {}) {
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
  getCurrentTier(): Tier {
    return this.config.mode === "manual" && this.manualTier
      ? this.manualTier
      : this.currentTier;
  }

  /**
   * Record a request for monitoring
   */
  recordRequest(timestamp: number = Date.now()): void {
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
  recordSuccess(latency: number): void {
    this.successfulRequests++;
    this.totalLatency += latency;
  }

  /**
   * Get tier limits for current tier
   */
  getTierLimits(tier?: Tier): TierLimits {
    const t = tier || this.getCurrentTier();
    return DEFAULT_TIER_LIMITS[t];
  }

  /**
   * Check if tier should be upgraded
   */
  shouldUpgradeTier(requestRate?: number): boolean {
    if (this.config.mode === "manual" || this.manualTier) {
      return false;
    }

    const rpm = requestRate ?? this.rateMonitor.getCurrentRpm();
    const limits = this.getTierLimits();

    // Apply hysteresis
    const threshold =
      this.config.autoUpgradeThreshold * (1 + this.config.hysteresis);

    return rpm > threshold && this.currentTier !== "enterprise";
  }

  /**
   * Check if tier should be downgraded
   */
  shouldDowngradeTier(requestRate?: number): boolean {
    if (this.config.mode === "manual" || this.manualTier) {
      return false;
    }

    const rpm = requestRate ?? this.rateMonitor.getCurrentRpm();

    // Apply hysteresis
    const threshold =
      this.config.autoDowngradeThreshold * (1 - this.config.hysteresis);

    // Can only downgrade if not already at quick
    return rpm < threshold && this.currentTier !== "quick";
  }

  /**
   * Manually set tier (overrides auto mode)
   */
  setManualTier(tier: Tier): void {
    if (!this.config.manualOverride) {
      throw new Error(
        "Manual override is disabled. Set manualOverride to true in config."
      );
    }

    this.manualTier = tier;
    this.config.mode = "manual";
    this.transitionToTier(tier);
  }

  /**
   * Enable automatic mode
   */
  enableAutoMode(): void {
    this.manualTier = null;
    this.config.mode = "auto";
  }

  /**
   * Get comprehensive tier statistics
   */
  getTierStats(): TierStats {
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
      successRate:
        this.requestsProcessed > 0
          ? this.successfulRequests / this.requestsProcessed
          : 1,
      averageLatency:
        this.successfulRequests > 0
          ? this.totalLatency / this.successfulRequests
          : 0,
    };
  }

  /**
   * Check if a feature is available in current tier
   */
  hasFeature(feature: string): boolean {
    const limits = this.getTierLimits();
    return limits.features.includes(feature as any);
  }

  /**
   * Get all available features in current tier
   */
  getAvailableFeatures(): string[] {
    const limits = this.getTierLimits();
    return limits.features;
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats(): void {
    this.rateMonitor.clear();
    this.requestsProcessed = 0;
    this.successfulRequests = 0;
    this.totalLatency = 0;
    this.totalTransitions = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TierConfig>): void {
    this.config = { ...this.config, ...config };

    // Update rate monitor window if changed
    if (config.rpmWindowSeconds !== undefined) {
      this.rateMonitor = new RequestRateMonitor(config.rpmWindowSeconds);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): TierConfig {
    return { ...this.config };
  }

  /**
   * Automatically adjust tier based on current request rate
   */
  private adjustTierIfNeeded(timestamp: number): void {
    const rpm = this.rateMonitor.getCurrentRpm(timestamp);

    if (this.shouldUpgradeTier(rpm)) {
      this.upgradeTier();
    } else if (this.shouldDowngradeTier(rpm)) {
      this.downgradeTier();
    }
  }

  /**
   * Upgrade to next tier
   */
  private upgradeTier(): void {
    const previousTier = this.currentTier;

    if (this.currentTier === "quick") {
      this.transitionToTier("standard");
    } else if (this.currentTier === "standard") {
      this.transitionToTier("enterprise");
    }

    if (previousTier !== this.currentTier) {
      console.debug(
        `[TierManager] Upgraded from ${previousTier} to ${this.currentTier}`
      );
    }
  }

  /**
   * Downgrade to previous tier
   */
  private downgradeTier(): void {
    const previousTier = this.currentTier;

    if (this.currentTier === "enterprise") {
      this.transitionToTier("standard");
    } else if (this.currentTier === "standard") {
      this.transitionToTier("quick");
    }

    if (previousTier !== this.currentTier) {
      console.debug(
        `[TierManager] Downgraded from ${previousTier} to ${this.currentTier}`
      );
    }
  }

  /**
   * Transition to a specific tier
   */
  private transitionToTier(tier: Tier): void {
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
  getRateMonitor(): RequestRateMonitor {
    return this.rateMonitor;
  }
}
