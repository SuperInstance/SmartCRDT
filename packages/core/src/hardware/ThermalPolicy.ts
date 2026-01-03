/**
 * ThermalPolicy - Policy framework for thermal management
 *
 * This module provides a flexible policy system for thermal-aware resource management,
 * with multiple predefined policies and support for custom implementations.
 */

import type { ThermalState } from "./HardwareState.js";
import type { ThermalZone } from "./ThermalManager.js";

// Re-export for convenience
export type { ThermalState } from "./HardwareState.js";
export type { ThermalZone } from "./ThermalManager.js";

/**
 * Thermal action types for resource management
 */
export type ThermalAction =
  | { type: "proceed" } // Full speed ahead
  | { type: "throttle"; factor: number } // Reduce load by factor (0-1)
  | { type: "redirect"; destination: "cloud"; reason: string } // Send to cloud
  | { type: "queue"; delayMs: number; reason: string } // Delay processing
  | { type: "stop"; reason: string }; // Stop processing

/**
 * Thermal policy configuration
 */
export interface ThermalPolicyConfig {
  // Temperature thresholds (°C)
  normalThreshold: number; // Default: 70
  throttleThreshold: number; // Default: 85
  criticalThreshold: number; // Default: 95

  // Actions per zone
  normalAction: ThermalAction;
  throttleAction: ThermalAction;
  criticalAction: ThermalAction;

  // Recovery behavior
  minTimeInZone: number; // Min ms before zone transition
  cooldownMultiplier: number; // How fast to cool down (0-1)

  // Prediction
  enablePrediction: boolean; // Use thermal prediction
  predictionHorizon: number; // Lookahead ms
}

/**
 * Policy statistics
 */
export interface PolicyStats {
  totalEvaluations: number;
  actionCounts: Record<string, number>;
  avgTemperature: number;
  timeInZones: {
    normal: number;
    throttle: number;
    critical: number;
  };
  lastUpdated: number;
}

/**
 * Thermal policy interface
 */
export interface ThermalPolicy {
  name: string;
  description: string;
  config: ThermalPolicyConfig;

  // Get action for current thermal state
  getAction(state: ThermalState): ThermalAction;

  // Update policy dynamically
  updateConfig(config: Partial<ThermalPolicyConfig>): void;

  // Get policy statistics
  getStats(): PolicyStats;

  // Reset statistics
  resetStats(): void;

  // Optional: Get prediction (only for adaptive policies)
  getPrediction?(state: ThermalState): ThermalPrediction;
}

/**
 * Base class for thermal policies with common functionality
 */
export abstract class BaseThermalPolicy implements ThermalPolicy {
  protected stats: PolicyStats = {
    totalEvaluations: 0,
    actionCounts: {
      proceed: 0,
      throttle: 0,
      redirect: 0,
      queue: 0,
      stop: 0,
    },
    avgTemperature: 0,
    timeInZones: {
      normal: 0,
      throttle: 0,
      critical: 0,
    },
    lastUpdated: Date.now(),
  };

  protected temperatureSum = 0;
  protected zoneEntryTimes: Record<ThermalZone, number> = {
    normal: Date.now(),
    throttle: Date.now(),
    critical: Date.now(),
  };
  protected currentZone: ThermalZone = "normal";

  constructor(
    public name: string,
    public description: string,
    public config: ThermalPolicyConfig
  ) {}

  /**
   * Get action for current thermal state
   */
  abstract getAction(state: ThermalState): ThermalAction;

  /**
   * Update policy configuration
   */
  updateConfig(updates: Partial<ThermalPolicyConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
    };
    this.stats.lastUpdated = Date.now();
  }

  /**
   * Get policy statistics
   */
  getStats(): PolicyStats {
    // Update time in zones
    const now = Date.now();
    this.stats.timeInZones[this.currentZone] +=
      now - this.zoneEntryTimes[this.currentZone];
    this.zoneEntryTimes[this.currentZone] = now;

    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalEvaluations: 0,
      actionCounts: {
        proceed: 0,
        throttle: 0,
        redirect: 0,
        queue: 0,
        stop: 0,
      },
      avgTemperature: 0,
      timeInZones: {
        normal: 0,
        throttle: 0,
        critical: 0,
      },
      lastUpdated: Date.now(),
    };
    this.temperatureSum = 0;
    this.zoneEntryTimes = {
      normal: Date.now(),
      throttle: Date.now(),
      critical: Date.now(),
    };
    this.currentZone = "normal";
  }

  /**
   * Determine thermal zone from temperature
   */
  protected determineZone(temperature: number): ThermalZone {
    if (temperature >= this.config.criticalThreshold) {
      return "critical";
    } else if (temperature >= this.config.throttleThreshold) {
      return "throttle";
    }
    return "normal";
  }

  /**
   * Update statistics after action
   */
  protected updateStats(
    action: ThermalAction,
    temperature: number,
    zone: ThermalZone
  ): void {
    this.stats.totalEvaluations++;

    // Update action counts
    this.stats.actionCounts[action.type]++;

    // Update average temperature
    this.temperatureSum += temperature;
    this.stats.avgTemperature =
      this.temperatureSum / this.stats.totalEvaluations;

    // Update zone tracking
    if (zone !== this.currentZone) {
      const now = Date.now();
      this.stats.timeInZones[this.currentZone] +=
        now - this.zoneEntryTimes[this.currentZone];
      this.zoneEntryTimes[zone] = now;
      this.currentZone = zone;
    }
  }
}

/**
 * Default thermal policy configuration
 */
export const DEFAULT_THERMAL_POLICY_CONFIG: ThermalPolicyConfig = {
  normalThreshold: 70,
  throttleThreshold: 85,
  criticalThreshold: 95,
  normalAction: { type: "proceed" },
  throttleAction: { type: "throttle", factor: 0.5 },
  criticalAction: {
    type: "redirect",
    destination: "cloud",
    reason: "Critical temperature",
  },
  minTimeInZone: 5000,
  cooldownMultiplier: 0.5,
  enablePrediction: false,
  predictionHorizon: 10000,
};

/**
 * Conservative thermal policy
 * Lower thresholds, more aggressive throttling
 * Suitable for: Battery-powered devices, thermal-sensitive hardware
 */
export class ConservativeThermalPolicy extends BaseThermalPolicy {
  constructor() {
    const config: ThermalPolicyConfig = {
      ...DEFAULT_THERMAL_POLICY_CONFIG,
      normalThreshold: 60, // Lower normal threshold
      throttleThreshold: 75, // Lower throttle threshold
      criticalThreshold: 85, // Lower critical threshold
      throttleAction: { type: "throttle", factor: 0.3 }, // More aggressive throttling
      minTimeInZone: 8000, // Longer cooldown
      cooldownMultiplier: 0.3, // Slower recovery
    };

    super(
      "conservative",
      "Conservative thermal policy with lower thresholds and aggressive throttling",
      config
    );
  }

  getAction(state: ThermalState): ThermalAction {
    const zone = this.determineZone(state.cpu);
    let action: ThermalAction;

    switch (zone) {
      case "normal":
        action = this.config.normalAction;
        break;
      case "throttle":
        // Calculate throttle factor based on temperature
        const tempIntoThrottle = state.cpu - this.config.throttleThreshold;
        const throttleRange =
          this.config.criticalThreshold - this.config.throttleThreshold;
        const factor = 0.3 + (tempIntoThrottle / throttleRange) * 0.4; // 0.3-0.7
        action = { type: "throttle", factor };
        break;
      case "critical":
        // Queue short requests, redirect longer ones
        if (state.timeInZone < 3000) {
          action = {
            type: "queue",
            delayMs: 5000,
            reason: `Critical temperature ${state.cpu.toFixed(1)}°C, queuing for cooldown`,
          };
        } else {
          action = {
            type: "redirect",
            destination: "cloud",
            reason: `Critical temperature ${state.cpu.toFixed(1)}°C exceeded, redirecting to cloud`,
          };
        }
        break;
    }

    this.updateStats(action, state.cpu, zone);
    return action;
  }
}

/**
 * Aggressive thermal policy
 * Higher thresholds, less throttling
 * Suitable for: Desktop workstations, servers, performance-critical applications
 */
export class AggressiveThermalPolicy extends BaseThermalPolicy {
  constructor() {
    const config: ThermalPolicyConfig = {
      ...DEFAULT_THERMAL_POLICY_CONFIG,
      normalThreshold: 80, // Higher normal threshold
      throttleThreshold: 90, // Higher throttle threshold
      criticalThreshold: 100, // Higher critical threshold
      throttleAction: { type: "throttle", factor: 0.7 }, // Less aggressive throttling
      minTimeInZone: 2000, // Shorter cooldown
      cooldownMultiplier: 0.8, // Faster recovery
    };

    super(
      "aggressive",
      "Aggressive thermal policy with higher thresholds and minimal throttling",
      config
    );
  }

  getAction(state: ThermalState): ThermalAction {
    const zone = this.determineZone(state.cpu);
    let action: ThermalAction;

    switch (zone) {
      case "normal":
        action = this.config.normalAction;
        break;
      case "throttle":
        // Calculate throttle factor based on temperature
        const tempIntoThrottle = state.cpu - this.config.throttleThreshold;
        const throttleRange =
          this.config.criticalThreshold - this.config.throttleThreshold;
        const factor = 0.7 + (tempIntoThrottle / throttleRange) * 0.3; // 0.7-1.0
        action = { type: "throttle", factor: Math.min(1, factor) };
        break;
      case "critical":
        // Only redirect at very high temperatures (98+)
        if (state.cpu >= 98) {
          action = {
            type: "redirect",
            destination: "cloud",
            reason: `Extreme temperature ${state.cpu.toFixed(1)}°C, redirecting to cloud`,
          };
        } else if (state.cpu >= 95) {
          // Heavy throttling at 95-97°C
          action = {
            type: "throttle",
            factor: 0.2,
          };
        } else {
          // Moderate throttling at 90-94°C
          const tempIntoCritical = state.cpu - this.config.criticalThreshold;
          const criticalRange = 100 - this.config.criticalThreshold;
          const factor = 0.4 - (tempIntoCritical / criticalRange) * 0.2; // 0.2-0.4
          action = { type: "throttle", factor };
        }
        break;
    }

    this.updateStats(action, state.cpu, zone);
    return action;
  }
}

/**
 * Balanced thermal policy
 * Balanced approach with default thresholds
 * Suitable for: Most use cases, laptops, general-purpose systems
 */
export class BalancedThermalPolicy extends BaseThermalPolicy {
  constructor() {
    super(
      "balanced",
      "Balanced thermal policy with default thresholds and moderate throttling",
      { ...DEFAULT_THERMAL_POLICY_CONFIG }
    );
  }

  getAction(state: ThermalState): ThermalAction {
    const zone = this.determineZone(state.cpu);
    let action: ThermalAction;

    switch (zone) {
      case "normal":
        action = this.config.normalAction;
        break;
      case "throttle":
        // Calculate throttle factor based on temperature
        const tempIntoThrottle = state.cpu - this.config.throttleThreshold;
        const throttleRange =
          this.config.criticalThreshold - this.config.throttleThreshold;
        const factor = 0.5 + (tempIntoThrottle / throttleRange) * 0.3; // 0.5-0.8
        action = { type: "throttle", factor };
        break;
      case "critical":
        action = {
          type: "redirect",
          destination: "cloud",
          reason: `Critical temperature ${state.cpu.toFixed(1)}°C exceeded, redirecting to cloud`,
        };
        break;
    }

    this.updateStats(action, state.cpu, zone);
    return action;
  }
}

/**
 * Thermal history entry for adaptive learning
 */
export interface ThermalHistoryEntry {
  timestamp: number;
  temperature: number;
  zone: ThermalZone;
  action: ThermalAction;
  load: number; // CPU/GPU utilization (0-1)
  ambientTemp: number;
}

/**
 * Thermal prediction result
 */
export interface ThermalPrediction {
  predictedTemp: number;
  predictedZone: ThermalZone;
  confidence: number; // 0-1
  timeToThrottle: number; // ms until throttle zone
  timeToCritical: number; // ms until critical zone
  recommendation: ThermalAction;
  timestamp: number;
}

/**
 * Adaptive thermal policy
 * Learns from usage patterns and adapts thresholds
 * Suitable for: Systems with variable workloads, long-running processes
 */
export class AdaptiveThermalPolicy extends BaseThermalPolicy {
  private history: ThermalHistoryEntry[] = [];
  private maxHistorySize = 10000;
  private learningRate = 0.1;
  private lastLearningUpdate = Date.now();
  private learningInterval = 60000; // Learn every minute

  constructor() {
    const config: ThermalPolicyConfig = {
      ...DEFAULT_THERMAL_POLICY_CONFIG,
      enablePrediction: true,
      predictionHorizon: 15000, // 15 second lookahead
    };

    super(
      "adaptive",
      "Adaptive thermal policy that learns from usage patterns",
      config
    );
  }

  getAction(state: ThermalState): ThermalAction {
    // Add to history
    this.addToHistory(state);

    // Periodically learn from history
    const now = Date.now();
    if (now - this.lastLearningUpdate > this.learningInterval) {
      this.learnFromHistory();
      this.lastLearningUpdate = now;
    }

    const zone = this.determineZone(state.cpu);
    let action: ThermalAction;

    switch (zone) {
      case "normal":
        action = this.config.normalAction;
        break;
      case "throttle":
        // Use adaptive throttle factor based on history
        const adaptiveFactor = this.getAdaptiveThrottleFactor();
        action = { type: "throttle", factor: adaptiveFactor };
        break;
      case "critical":
        action = {
          type: "redirect",
          destination: "cloud",
          reason: `Critical temperature ${state.cpu.toFixed(1)}°C exceeded, redirecting to cloud`,
        };
        break;
    }

    this.updateStats(action, state.cpu, zone);
    return action;
  }

  /**
   * Get thermal prediction
   */
  getPrediction(state: ThermalState): ThermalPrediction {
    const trend = this.calculateTrend();
    const predictedTemp = state.cpu + trend;
    const predictedZone = this.determineZone(predictedTemp);
    const variance = this.calculateVariance();
    const confidence = Math.max(0, 1 - variance / 10); // Higher variance = lower confidence

    return {
      predictedTemp,
      predictedZone,
      confidence,
      timeToThrottle: this.timeToZone(
        state.cpu,
        this.config.throttleThreshold,
        trend
      ),
      timeToCritical: this.timeToZone(
        state.cpu,
        this.config.criticalThreshold,
        trend
      ),
      recommendation: this.getPreemptiveAction(predictedTemp, confidence),
      timestamp: Date.now(),
    };
  }

  /**
   * Add state to history
   */
  private addToHistory(state: ThermalState): void {
    const zone = this.determineZone(state.cpu);
    const currentAction = this.getActionForZone(zone, state.cpu);

    this.history.push({
      timestamp: Date.now(),
      temperature: state.cpu,
      zone,
      action: currentAction,
      load: 0.5, // Placeholder - would come from actual load
      ambientTemp: 25, // Placeholder - would come from sensor
    });

    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Learn from history and adjust policy
   */
  private learnFromHistory(): void {
    if (this.history.length < 100) {
      return; // Not enough data
    }

    const recent = this.history.slice(-1000);

    // Calculate average temperature
    const avgTemp =
      recent.reduce((sum, entry) => sum + entry.temperature, 0) / recent.length;

    // Calculate time spent in each zone
    const zoneCounts = { normal: 0, throttle: 0, critical: 0 };
    recent.forEach(entry => zoneCounts[entry.zone]++);

    const totalEntries = recent.length;
    const throttleRatio = zoneCounts.throttle / totalEntries;
    const criticalRatio = zoneCounts.critical / totalEntries;

    // Adjust thresholds based on patterns
    if (throttleRatio > 0.3) {
      // Frequently throttling, lower thresholds to be more conservative
      const adjustment = this.learningRate * 2;
      this.config.throttleThreshold = Math.max(
        70,
        this.config.throttleThreshold - adjustment
      );
      this.config.criticalThreshold = Math.max(
        80,
        this.config.criticalThreshold - adjustment
      );
    } else if (throttleRatio < 0.1 && criticalRatio === 0) {
      // Rarely throttling, can be more aggressive
      const adjustment = this.learningRate;
      this.config.throttleThreshold = Math.min(
        90,
        this.config.throttleThreshold + adjustment
      );
    }
  }

  /**
   * Calculate temperature trend using linear regression
   */
  private calculateTrend(): number {
    if (this.history.length < 10) {
      return 0;
    }

    const recent = this.history.slice(-100);
    const n = recent.length;

    // Simple linear regression: y = mx + b
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    recent.forEach((entry, i) => {
      const x = i;
      const y = entry.temperature;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope * 1000; // Convert to °C per second
  }

  /**
   * Calculate variance of recent temperatures
   */
  private calculateVariance(): number {
    if (this.history.length < 10) {
      return 0;
    }

    const recent = this.history.slice(-100);
    const temps = recent.map(entry => entry.temperature);
    const mean = temps.reduce((sum, t) => sum + t, 0) / temps.length;
    const variance =
      temps.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / temps.length;

    return variance;
  }

  /**
   * Estimate time to reach a threshold
   */
  private timeToZone(
    currentTemp: number,
    threshold: number,
    trend: number
  ): number {
    if (currentTemp >= threshold) {
      return 0;
    }

    if (trend <= 0) {
      return Infinity; // Not trending toward threshold
    }

    const degreesToThreshold = threshold - currentTemp;
    const secondsToThreshold = degreesToThreshold / trend;

    return Math.round(secondsToThreshold * 1000);
  }

  /**
   * Get adaptive throttle factor based on history
   */
  private getAdaptiveThrottleFactor(): number {
    if (this.history.length < 100) {
      return 0.5; // Default until we have data
    }

    const recent = this.history.slice(-100);
    const throttleEntries = recent.filter(e => e.zone === "throttle");

    if (throttleEntries.length === 0) {
      return 0.5;
    }

    // Calculate average temperature during throttle
    const avgThrottleTemp =
      throttleEntries.reduce((sum, e) => sum + e.temperature, 0) /
      throttleEntries.length;

    // Adjust factor based on how deep into throttle zone we are
    const tempIntoThrottle = avgThrottleTemp - this.config.throttleThreshold;
    const throttleRange =
      this.config.criticalThreshold - this.config.throttleThreshold;
    const factor = 0.4 + (tempIntoThrottle / throttleRange) * 0.4; // 0.4-0.8

    return factor;
  }

  /**
   * Get preemptive action based on prediction
   */
  private getPreemptiveAction(
    predictedTemp: number,
    confidence: number
  ): ThermalAction {
    const predictedZone = this.determineZone(predictedTemp);

    // Only take preemptive action if high confidence
    if (confidence < 0.7) {
      return { type: "proceed" };
    }

    if (predictedZone === "critical") {
      return {
        type: "redirect",
        destination: "cloud",
        reason: `Predicted critical temperature (${predictedTemp.toFixed(1)}°C)`,
      };
    }

    if (predictedZone === "throttle") {
      const tempIntoThrottle = predictedTemp - this.config.throttleThreshold;
      const throttleRange =
        this.config.criticalThreshold - this.config.throttleThreshold;
      const factor = 0.5 + (tempIntoThrottle / throttleRange) * 0.3;
      return { type: "throttle", factor };
    }

    return { type: "proceed" };
  }

  /**
   * Get action for a zone
   */
  private getActionForZone(
    zone: ThermalZone,
    temperature: number
  ): ThermalAction {
    switch (zone) {
      case "normal":
        return this.config.normalAction;
      case "throttle":
        return { type: "throttle", factor: 0.5 };
      case "critical":
        return {
          type: "redirect",
          destination: "cloud",
          reason: "Critical temperature",
        };
    }
  }

  /**
   * Get history size
   */
  getHistorySize(): number {
    return this.history.length;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }
}

/**
 * Create a thermal policy by name
 */
export function createThermalPolicy(
  name: "conservative" | "aggressive" | "balanced" | "adaptive"
): ThermalPolicy {
  switch (name) {
    case "conservative":
      return new ConservativeThermalPolicy();
    case "aggressive":
      return new AggressiveThermalPolicy();
    case "balanced":
      return new BalancedThermalPolicy();
    case "adaptive":
      return new AdaptiveThermalPolicy();
  }
}
