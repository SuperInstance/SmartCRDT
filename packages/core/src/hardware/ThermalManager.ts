/**
 * ThermalManager - Thermal management and throttling control
 *
 * This module provides thermal-aware resource management with configurable
 * policies for different thermal zones.
 */

import type { ThermalState } from "./HardwareState.js";

/**
 * Thermal zone
 */
export type ThermalZone = "normal" | "throttle" | "critical";

/**
 * Thermal action type
 */
export type ThermalAction =
  | { type: "proceed"; mode: "full" | "reduced" }
  | { type: "throttle"; reduction: number; reason: string }
  | { type: "queue"; delayMs: number; reason: string }
  | { type: "reject"; reason: string };

/**
 * Thermal policy configuration
 */
export interface ThermalPolicy {
  /** Normal temperature threshold (°C) */
  normalThreshold: number;
  /** Throttle temperature threshold (°C) */
  throttleThreshold: number;
  /** Critical temperature threshold (°C) */
  criticalThreshold: number;
  /** Action to take in normal zone */
  normalAction: () => ThermalAction;
  /** Action to take in throttle zone */
  throttleAction: (temperature: number) => ThermalAction;
  /** Action to take in critical zone */
  criticalAction: (temperature: number) => ThermalAction;
  /** How long to wait before rechecking (ms) */
  checkInterval: number;
  /** Minimum time to stay in zone before changing (ms) */
  minZoneTime: number;
}

/**
 * Thermal metrics
 */
export interface ThermalMetrics {
  /** Current temperature */
  currentTemperature: number;
  /** Current zone */
  currentZone: ThermalZone;
  /** Time spent in current zone (ms) */
  timeInZone: number;
  /** Maximum temperature seen */
  maxTemperature: number;
  /** Average temperature over session */
  averageTemperature: number;
  /** Number of thermal throttles this session */
  throttleCount: number;
  /** Total time spent throttling (ms) */
  totalThrottleTime: number;
}

/**
 * Thermal manager configuration
 */
export interface ThermalManagerConfig {
  /** Thermal policy */
  policy?: Partial<ThermalPolicy>;
  /** Enable automatic action execution */
  enableAutoActions?: boolean;
  /** Callback when zone changes */
  onZoneChange?: (from: ThermalZone, to: ThermalZone) => void;
  /** Callback when action is taken */
  onAction?: (action: ThermalAction) => void;
}

/**
 * Default thermal policy
 */
export const DEFAULT_THERMAL_POLICY: ThermalPolicy = {
  normalThreshold: 70,
  throttleThreshold: 85,
  criticalThreshold: 95,
  normalAction: () => ({ type: "proceed", mode: "full" }),
  throttleAction: temp => ({
    type: "throttle",
    reduction: Math.min(0.5, (temp - 85) / 10), // Reduce up to 50%
    reason: `Temperature ${temp.toFixed(1)}°C exceeds throttle threshold`,
  }),
  criticalAction: temp => ({
    type: "reject",
    reason: `Temperature ${temp.toFixed(1)}°C exceeds critical threshold`,
  }),
  checkInterval: 1000,
  minZoneTime: 5000, // Stay in zone for at least 5 seconds
};

/**
 * ThermalManager - Manages thermal state and actions
 */
export class ThermalManager {
  private policy: ThermalPolicy;
  private currentZone: ThermalZone = "normal";
  private lastZoneChange: number = Date.now();
  private metrics: ThermalMetrics = {
    currentTemperature: 0,
    currentZone: "normal",
    timeInZone: 0,
    maxTemperature: 0,
    averageTemperature: 0,
    throttleCount: 0,
    totalThrottleTime: 0,
  };
  private temperatureHistory: number[] = [];
  private enableAutoActions: boolean;
  private onZoneChangeCallback?: (from: ThermalZone, to: ThermalZone) => void;
  private onActionCallback?: (action: ThermalAction) => void;

  constructor(config: ThermalManagerConfig = {}) {
    this.policy = {
      ...DEFAULT_THERMAL_POLICY,
      ...config.policy,
      // Ensure functions are not overridden
      normalAction:
        config.policy?.normalAction ?? DEFAULT_THERMAL_POLICY.normalAction,
      throttleAction:
        config.policy?.throttleAction ?? DEFAULT_THERMAL_POLICY.throttleAction,
      criticalAction:
        config.policy?.criticalAction ?? DEFAULT_THERMAL_POLICY.criticalAction,
    };
    this.enableAutoActions = config.enableAutoActions ?? false;
    this.onZoneChangeCallback = config.onZoneChange;
    this.onActionCallback = config.onAction;
  }

  /**
   * Update thermal state from hardware state
   */
  updateThermalState(thermalState: ThermalState): ThermalAction {
    const temperature = thermalState.cpu;
    const zone = this.determineZone(temperature);

    // Update metrics
    this.metrics.currentTemperature = temperature;
    this.metrics.currentZone = zone;
    this.metrics.timeInZone = thermalState.timeInZone;

    // Track temperature history
    this.temperatureHistory.push(temperature);
    if (this.temperatureHistory.length > 1000) {
      this.temperatureHistory.shift();
    }

    // Update max temperature
    if (temperature > this.metrics.maxTemperature) {
      this.metrics.maxTemperature = temperature;
    }

    // Calculate average temperature
    this.metrics.averageTemperature =
      this.temperatureHistory.reduce((sum, temp) => sum + temp, 0) /
      this.temperatureHistory.length;

    // Check for zone change
    if (zone !== this.currentZone) {
      const minTimePassed =
        Date.now() - this.lastZoneChange >= this.policy.minZoneTime;

      if (minTimePassed) {
        const previousZone = this.currentZone;
        this.currentZone = zone;
        this.lastZoneChange = Date.now();

        // Update throttle count
        if (zone === "throttle" || zone === "critical") {
          this.metrics.throttleCount++;
        }

        // Track throttle time
        if (previousZone === "throttle") {
          this.metrics.totalThrottleTime += thermalState.timeInZone;
        }

        // Emit zone change callback
        if (this.onZoneChangeCallback) {
          this.onZoneChangeCallback(previousZone, zone);
        }
      }
    }

    // Get action based on zone
    const action = this.getActionForZone(zone, temperature);

    // Auto-execute action if enabled
    if (this.enableAutoActions && this.onActionCallback) {
      this.onActionCallback(action);
    }

    return action;
  }

  /**
   * Determine thermal zone from temperature
   */
  private determineZone(temperature: number): ThermalZone {
    if (temperature >= this.policy.criticalThreshold) {
      return "critical";
    } else if (temperature >= this.policy.throttleThreshold) {
      return "throttle";
    }
    return "normal";
  }

  /**
   * Get action for a thermal zone
   */
  private getActionForZone(
    zone: ThermalZone,
    temperature: number
  ): ThermalAction {
    switch (zone) {
      case "normal":
        return this.policy.normalAction();
      case "throttle":
        return this.policy.throttleAction(temperature);
      case "critical":
        return this.policy.criticalAction(temperature);
    }
  }

  /**
   * Get current thermal zone
   */
  getCurrentZone(): ThermalZone {
    return this.currentZone;
  }

  /**
   * Check if currently in thermal throttle zone
   */
  isThrottling(): boolean {
    return this.currentZone === "throttle" || this.currentZone === "critical";
  }

  /**
   * Check if in critical zone
   */
  isCritical(): boolean {
    return this.currentZone === "critical";
  }

  /**
   * Get thermal metrics
   */
  getMetrics(): ThermalMetrics {
    return { ...this.metrics };
  }

  /**
   * Get thermal policy
   */
  getPolicy(): ThermalPolicy {
    return { ...this.policy };
  }

  /**
   * Update thermal policy
   */
  updatePolicy(updates: Partial<ThermalPolicy>): void {
    this.policy = {
      ...this.policy,
      ...updates,
      // Ensure functions are properly merged
      normalAction: updates.normalAction ?? this.policy.normalAction,
      throttleAction: updates.throttleAction ?? this.policy.throttleAction,
      criticalAction: updates.criticalAction ?? this.policy.criticalAction,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      currentTemperature: 0,
      currentZone: "normal",
      timeInZone: 0,
      maxTemperature: 0,
      averageTemperature: 0,
      throttleCount: 0,
      totalThrottleTime: 0,
    };
    this.temperatureHistory = [];
  }

  /**
   * Estimate time to normal zone (in milliseconds)
   * Uses a simple exponential decay model
   */
  estimateTimeToNormal(): number {
    if (this.currentZone === "normal") {
      return 0;
    }

    const currentTemp = this.metrics.currentTemperature;
    const normalThreshold = this.policy.normalThreshold;

    if (currentTemp <= normalThreshold) {
      return 0;
    }

    // Simple model: 1°C per 10 seconds when cooling
    const degreesToCool = currentTemp - normalThreshold;
    const coolingRate = 0.1; // °C per second
    const secondsToCool = degreesToCool / coolingRate;

    return Math.round(secondsToCool * 1000);
  }

  /**
   * Get recommendation for processing
   */
  getProcessingRecommendation(): {
    canProceed: boolean;
    action: ThermalAction;
    confidence: number;
  } {
    const action = this.getActionForZone(
      this.currentZone,
      this.metrics.currentTemperature
    );

    let confidence = 1.0;
    switch (this.currentZone) {
      case "normal":
        confidence = 1.0;
        break;
      case "throttle":
        confidence = Math.max(
          0,
          1 -
            (this.metrics.currentTemperature - this.policy.throttleThreshold) /
              10
        );
        break;
      case "critical":
        confidence = 0.0;
        break;
    }

    return {
      canProceed: action.type !== "reject",
      action,
      confidence,
    };
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot(): {
    zone: ThermalZone;
    metrics: ThermalMetrics;
    policy: ThermalPolicy;
    timestamp: number;
  } {
    return {
      zone: this.currentZone,
      metrics: { ...this.metrics },
      policy: { ...this.policy },
      timestamp: Date.now(),
    };
  }

  /**
   * Restore from snapshot
   */
  restoreSnapshot(snapshot: {
    zone: ThermalZone;
    metrics: ThermalMetrics;
    policy: ThermalPolicy;
  }): void {
    this.currentZone = snapshot.zone;
    this.metrics = { ...snapshot.metrics };
    this.policy = { ...snapshot.policy };
    this.lastZoneChange = Date.now();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.resetMetrics();
    this.onZoneChangeCallback = undefined;
    this.onActionCallback = undefined;
  }
}

/**
 * Create a default thermal manager
 */
export function createThermalManager(
  config?: ThermalManagerConfig
): ThermalManager {
  return new ThermalManager(config);
}
