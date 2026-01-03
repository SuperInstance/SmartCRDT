/**
 * @lsi/scale-strategy - Cooldown Manager
 *
 * Prevents rapid scale oscillation with configurable cooldown periods.
 */

import type { ScaleDirection, CooldownState, ScaleEvent } from "./types.js";

/**
 * Cooldown manager configuration
 */
export interface CooldownManagerConfig {
  /** Cooldown period after scale up (ms) */
  scaleUpCooldownMs: number;
  /** Cooldown period after scale down (ms) */
  scaleDownCooldownMs: number;
  /** Whether emergency scaling bypasses cooldown */
  allowEmergencyBypass: boolean;
  /** Maximum cooldown period (ms) */
  maxCooldownMs: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CooldownManagerConfig = {
  scaleUpCooldownMs: 60000, // 1 minute
  scaleDownCooldownMs: 300000, // 5 minutes
  allowEmergencyBypass: true,
  maxCooldownMs: 600000, // 10 minutes
};

/**
 * Cooldown state history
 */
interface CooldownHistory {
  timestamp: number;
  direction: ScaleDirection;
  cooldownMs: number;
}

/**
 * Manages cooldown periods to prevent rapid scaling oscillation
 */
export class CooldownManager {
  private config: CooldownManagerConfig;
  private lastScaleUp: number = 0;
  private lastScaleDown: number = 0;
  private history: CooldownHistory[] = [];

  constructor(config?: Partial<CooldownManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a scaling operation
   */
  recordScale(direction: ScaleDirection, isEmergency: boolean = false): void {
    const now = Date.now();

    // Allow emergency bypass if configured
    if (isEmergency && this.config.allowEmergencyBypass) {
      return;
    }

    if (direction === "up") {
      this.lastScaleUp = now;
    } else if (direction === "down") {
      this.lastScaleDown = now;
    }

    // Add to history
    this.history.push({
      timestamp: now,
      direction,
      cooldownMs:
        direction === "up"
          ? this.config.scaleUpCooldownMs
          : this.config.scaleDownCooldownMs,
    });

    // Trim history
    this.trimHistory();
  }

  /**
   * Check if scaling is allowed
   */
  canScale(direction: ScaleDirection, isEmergency: boolean = false): boolean {
    // Emergency scaling bypasses cooldown
    if (isEmergency && this.config.allowEmergencyBypass) {
      return true;
    }

    const now = Date.now();
    const state = this.getState();

    if (state.isInCooldown) {
      // Check if the cooldown is for the same direction
      // Allow scaling in opposite direction during cooldown
      if (direction === "up" && this.lastScaleDown > this.lastScaleUp) {
        return true;
      }
      if (direction === "down" && this.lastScaleUp > this.lastScaleDown) {
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Get current cooldown state
   */
  getState(): CooldownState {
    const now = Date.now();
    const timeSinceScaleUp = now - this.lastScaleUp;
    const timeSinceScaleDown = now - this.lastScaleDown;

    // Determine if in cooldown
    let isInCooldown = false;
    let remainingMs = 0;

    if (timeSinceScaleUp < this.config.scaleUpCooldownMs) {
      isInCooldown = true;
      remainingMs = Math.max(
        remainingMs,
        this.config.scaleUpCooldownMs - timeSinceScaleUp
      );
    }

    if (timeSinceScaleDown < this.config.scaleDownCooldownMs) {
      isInCooldown = true;
      remainingMs = Math.max(
        remainingMs,
        this.config.scaleDownCooldownMs - timeSinceScaleDown
      );
    }

    return {
      lastScaleUp: this.lastScaleUp,
      lastScaleDown: this.lastScaleDown,
      remainingMs,
      isInCooldown,
    };
  }

  /**
   * Get time until next scale is allowed
   */
  getTimeUntilNextScale(direction?: ScaleDirection): number {
    const state = this.getState();

    if (!state.isInCooldown) {
      return 0;
    }

    if (direction === "up") {
      const timeUntil =
        this.config.scaleUpCooldownMs - (Date.now() - state.lastScaleUp);
      return Math.max(0, timeUntil);
    }

    if (direction === "down") {
      const timeUntil =
        this.config.scaleDownCooldownMs - (Date.now() - state.lastScaleDown);
      return Math.max(0, timeUntil);
    }

    return state.remainingMs;
  }

  /**
   * Reset cooldown state
   */
  reset(): void {
    this.lastScaleUp = 0;
    this.lastScaleDown = 0;
    this.history = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CooldownManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): CooldownManagerConfig {
    return { ...this.config };
  }

  /**
   * Get cooldown history
   */
  getHistory(): CooldownHistory[] {
    return [...this.history];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalScales: number;
    scaleUpCount: number;
    scaleDownCount: number;
    averageCooldownTime: number;
    oscillationCount: number;
  } {
    const scaleUpCount = this.history.filter(h => h.direction === "up").length;
    const scaleDownCount = this.history.filter(
      h => h.direction === "down"
    ).length;
    const averageCooldownTime =
      this.history.length > 0
        ? this.history.reduce((sum, h) => sum + h.cooldownMs, 0) /
          this.history.length
        : 0;

    // Detect oscillations (rapid scale up/down)
    let oscillationCount = 0;
    for (let i = 1; i < this.history.length; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];

      // If directions changed within 2x cooldown period, it's an oscillation
      if (prev.direction !== curr.direction) {
        const timeDiff = curr.timestamp - prev.timestamp;
        const avgCooldown = (prev.cooldownMs + curr.cooldownMs) / 2;

        if (timeDiff < avgCooldown * 2) {
          oscillationCount++;
        }
      }
    }

    return {
      totalScales: this.history.length,
      scaleUpCount,
      scaleDownCount,
      averageCooldownTime,
      oscillationCount,
    };
  }

  /**
   * Adaptive cooldown adjustment based on oscillation detection
   */
  adjustCooldownForOscillation(): void {
    const stats = this.getStats();

    // If high oscillation, increase cooldown periods
    if (stats.oscillationCount > 3) {
      const multiplier = Math.min(2, 1 + (stats.oscillationCount - 3) * 0.1);

      this.config.scaleUpCooldownMs = Math.min(
        this.config.maxCooldownMs,
        Math.floor(this.config.scaleUpCooldownMs * multiplier)
      );

      this.config.scaleDownCooldownMs = Math.min(
        this.config.maxCooldownMs,
        Math.floor(this.config.scaleDownCooldownMs * multiplier)
      );
    }
  }

  private trimHistory(): void {
    // Keep only last 100 entries
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }
}
