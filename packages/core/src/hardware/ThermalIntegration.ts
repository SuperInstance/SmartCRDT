/**
 * ThermalIntegration - Enhanced integration layer for thermal-aware dispatch
 *
 * This module bridges the ThermalManager with the dispatch system,
 * providing policy-based routing recommendations based on thermal state.
 * Now supports the new ThermalPolicy framework and AdaptiveThermalController.
 */

import type {
  ThermalManager,
  ThermalAction,
  ThermalZone,
} from "./ThermalManager.js";
import type { ThermalState } from "./HardwareState.js";
import type {
  ThermalPolicy,
  ThermalPrediction,
  PolicyStats,
} from "./ThermalPolicy.js";
import {
  BalancedThermalPolicy,
  type ThermalAction as PolicyThermalAction,
  createThermalPolicy,
} from "./ThermalPolicy.js";
import { AdaptiveThermalController } from "./AdaptiveThermalController.js";

/**
 * Dispatch action type
 */
export type DispatchAction =
  | { type: "local"; mode: "full" | "reduced" }
  | { type: "cloud"; reason: string }
  | { type: "queue"; delayMs: number; reason: string }
  | { type: "hybrid"; localRatio: number; reason: string };

/**
 * Thermal policy for dispatch decisions
 */
export interface ThermalDispatchPolicy {
  /** Temperature thresholds */
  normalThreshold: number;
  throttleThreshold: number;
  criticalThreshold: number;

  /** Dispatch actions for each zone */
  normalAction: DispatchAction;
  throttleAction: (temp: number) => DispatchAction;
  criticalAction: (temp: number) => DispatchAction;

  /** Whether to enable adaptive queueing */
  enableAdaptiveQueue?: boolean;
  /** Maximum queue delay in throttle zone (ms) */
  maxQueueDelay?: number;
  /** Minimum local processing ratio in hybrid mode */
  minHybridRatio?: number;
}

/**
 * Thermal dispatch recommendation
 */
export interface ThermalDispatchRecommendation {
  /** Recommended action */
  action: DispatchAction;
  /** Current thermal zone */
  zone: ThermalZone;
  /** Current temperature */
  temperature: number;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Estimated time to normal zone (ms) */
  timeToNormal: number;
  /** Reasoning for recommendation */
  reasoning: string;
}

/**
 * Thermal health report
 */
export interface ThermalHealthReport {
  currentTemp: number;
  currentZone: ThermalZone;
  prediction?: ThermalPrediction;
  recommendations: string[];
  stats: PolicyStats;
  isHealthy: boolean;
}

/**
 * Enhanced thermal integration options
 */
export interface ThermalIntegrationOptions {
  /** Custom policy (overrides default) */
  policy?: Partial<ThermalDispatchPolicy>;
  /** Thermal policy name or instance */
  thermalPolicy?:
    | "conservative"
    | "aggressive"
    | "balanced"
    | "adaptive"
    | ThermalPolicy;
  /** Enable automatic policy updates based on history */
  enableAdaptivePolicy?: boolean;
  /** Enable prediction */
  enablePrediction?: boolean;
  /** Callback when recommendation changes */
  onRecommendationChange?: (
    recommendation: ThermalDispatchRecommendation
  ) => void;
  /** Minimum confidence for preemptive actions */
  minPreemptiveConfidence?: number;
}

/**
 * Default thermal dispatch policy
 */
export const DEFAULT_THERMAL_DISPATCH_POLICY: ThermalDispatchPolicy = {
  normalThreshold: 70,
  throttleThreshold: 85,
  criticalThreshold: 95,
  normalAction: { type: "local", mode: "full" },
  throttleAction: (temp: number) => ({
    type: "hybrid",
    localRatio: Math.max(0.2, 1 - (temp - 85) / 10), // Reduce to 20-100%
    reason: `Temperature ${temp.toFixed(1)}°C in throttle zone, using hybrid approach`,
  }),
  criticalAction: (temp: number) => ({
    type: "cloud",
    reason: `Temperature ${temp.toFixed(1)}°C in critical zone, routing to cloud`,
  }),
  enableAdaptiveQueue: true,
  maxQueueDelay: 5000,
  minHybridRatio: 0.2,
};

/**
 * ThermalIntegration - Enhanced thermal-aware dispatch with policy support
 */
export class ThermalIntegration {
  private policy: ThermalDispatchPolicy;
  private thermalPolicy: ThermalPolicy;
  private thermalManager: ThermalManager;
  private controller: AdaptiveThermalController;
  private currentRecommendation: ThermalDispatchRecommendation | null = null;
  private enableAdaptivePolicy: boolean;
  private enablePrediction: boolean;
  private onRecommendationChangeCallback?: (
    recommendation: ThermalDispatchRecommendation
  ) => void;

  constructor(
    thermalManager: ThermalManager,
    options: ThermalIntegrationOptions = {}
  ) {
    this.thermalManager = thermalManager;
    this.policy = {
      ...DEFAULT_THERMAL_DISPATCH_POLICY,
      ...options.policy,
      // Ensure functions are properly merged
      normalAction:
        options.policy?.normalAction ??
        DEFAULT_THERMAL_DISPATCH_POLICY.normalAction,
      throttleAction:
        options.policy?.throttleAction ??
        DEFAULT_THERMAL_DISPATCH_POLICY.throttleAction,
      criticalAction:
        options.policy?.criticalAction ??
        DEFAULT_THERMAL_DISPATCH_POLICY.criticalAction,
    };

    // Initialize thermal policy
    if (typeof options.thermalPolicy === "string") {
      this.thermalPolicy = createThermalPolicy(options.thermalPolicy);
    } else if (options.thermalPolicy) {
      this.thermalPolicy = options.thermalPolicy;
    } else {
      this.thermalPolicy = new BalancedThermalPolicy();
    }

    // Initialize adaptive controller
    this.controller = new AdaptiveThermalController(
      thermalManager,
      this.thermalPolicy,
      {
        enablePrediction: options.enablePrediction ?? true,
        minPreemptiveConfidence: options.minPreemptiveConfidence ?? 0.7,
      }
    );

    this.enableAdaptivePolicy = options.enableAdaptivePolicy ?? false;
    this.enablePrediction = options.enablePrediction ?? true;
    this.onRecommendationChangeCallback = options.onRecommendationChange;
  }

  /**
   * Get dispatch recommendation based on current thermal state
   * Enhanced with prediction support
   */
  async recommend(
    thermalState: ThermalState
  ): Promise<ThermalDispatchRecommendation> {
    // Update thermal manager with new state
    const thermalAction = this.thermalManager.updateThermalState(thermalState);

    // Get action from controller if prediction is enabled
    let policyAction: PolicyThermalAction;
    let prediction: ThermalPrediction | undefined;

    if (this.enablePrediction) {
      policyAction = await this.controller.getAction(thermalState);
      prediction = await this.controller.getPrediction();
    } else {
      policyAction = this.thermalPolicy.getAction(thermalState);
    }

    // Get current zone and temperature
    const zone = this.thermalManager.getCurrentZone();
    const temperature = thermalState.cpu;

    // Map policy thermal action to dispatch action
    const dispatchAction = this.mapPolicyActionToDispatch(policyAction);

    // Calculate confidence
    const confidence = this.calculateConfidence(zone, temperature, prediction);

    // Get time to normal
    const timeToNormal = this.thermalManager.estimateTimeToNormal();

    // Generate reasoning
    const reasoning = this.generateReasoning(
      zone,
      temperature,
      dispatchAction,
      prediction
    );

    const recommendation: ThermalDispatchRecommendation = {
      action: dispatchAction,
      zone,
      temperature,
      confidence,
      timeToNormal,
      reasoning,
    };

    // Check if recommendation changed
    if (
      !this.currentRecommendation ||
      this.currentRecommendation.zone !== zone ||
      this.shouldUpdateAction(this.currentRecommendation.action, dispatchAction)
    ) {
      this.currentRecommendation = recommendation;

      if (this.onRecommendationChangeCallback) {
        this.onRecommendationChangeCallback(recommendation);
      }
    }

    return recommendation;
  }

  /**
   * Map policy thermal action to dispatch action
   */
  private mapPolicyActionToDispatch(
    policyAction: PolicyThermalAction
  ): DispatchAction {
    switch (policyAction.type) {
      case "proceed":
        return { type: "local", mode: "full" };

      case "throttle":
        // Convert throttle factor to hybrid local ratio
        const localRatio = 1 - policyAction.factor;
        return {
          type: "hybrid",
          localRatio: Math.max(this.policy.minHybridRatio ?? 0.2, localRatio),
          reason: `Throttling by ${(policyAction.factor * 100).toFixed(0)}% due to thermal conditions`,
        };

      case "redirect":
        return {
          type: "cloud",
          reason: policyAction.reason,
        };

      case "queue":
        return {
          type: "queue",
          delayMs: policyAction.delayMs,
          reason: policyAction.reason,
        };

      case "stop":
        return {
          type: "cloud",
          reason: policyAction.reason,
        };
    }
  }

  /**
   * Legacy map thermal action to dispatch action (for backward compatibility)
   */
  private mapToDispatchAction(
    thermalAction: ThermalAction,
    temperature: number
  ): DispatchAction {
    switch (thermalAction.type) {
      case "proceed":
        return {
          type: "local",
          mode: thermalAction.mode === "full" ? "full" : "reduced",
        };

      case "throttle":
        // Convert throttle action to hybrid
        const reduction = thermalAction.reduction;
        return {
          type: "hybrid",
          localRatio: Math.max(
            this.policy.minHybridRatio ?? 0.2,
            1 - reduction
          ),
          reason: thermalAction.reason,
        };

      case "queue":
        return {
          type: "queue",
          delayMs: thermalAction.delayMs,
          reason: thermalAction.reason,
        };

      case "reject":
        return {
          type: "cloud",
          reason: thermalAction.reason,
        };
    }
  }

  /**
   * Calculate confidence in recommendation
   * Enhanced with prediction support
   */
  private calculateConfidence(
    zone: ThermalZone,
    temperature: number,
    prediction?: ThermalPrediction
  ): number {
    let baseConfidence: number;

    switch (zone) {
      case "normal":
        baseConfidence = 1.0;
        break;
      case "throttle":
        // Linear decrease from 1.0 to 0.5 as temp approaches critical
        const throttleRange =
          this.policy.criticalThreshold - this.policy.throttleThreshold;
        const tempIntoThrottle = temperature - this.policy.throttleThreshold;
        baseConfidence = Math.max(
          0.5,
          1.0 - tempIntoThrottle / throttleRange / 2
        );
        break;
      case "critical":
        baseConfidence = 1.0; // High confidence in rejecting local processing
        break;
    }

    // Adjust confidence based on prediction
    if (prediction && prediction.confidence > 0.7) {
      if (prediction.predictedZone === "critical" && zone !== "critical") {
        // Reduce confidence if critical is predicted
        baseConfidence *= 0.5;
      } else if (prediction.predictedZone === "normal" && zone === "throttle") {
        // Increase confidence if recovery is predicted
        baseConfidence *= 1.2;
      }
    }

    return Math.min(1.0, baseConfidence);
  }

  /**
   * Generate human-readable reasoning
   * Enhanced with prediction information
   */
  private generateReasoning(
    zone: ThermalZone,
    temperature: number,
    action: DispatchAction,
    prediction?: ThermalPrediction
  ): string {
    let baseReason = `Current temperature: ${temperature.toFixed(1)}°C (${zone} zone). `;

    // Add prediction info if available
    if (prediction && prediction.confidence > 0.7) {
      baseReason += `Predicted: ${prediction.predictedTemp.toFixed(1)}°C (${prediction.predictedZone} zone, ${(prediction.confidence * 100).toFixed(0)}% confidence). `;
    }

    switch (action.type) {
      case "local":
        return (
          baseReason +
          `Thermal conditions are optimal. Can process locally at ${action.mode} capacity.`
        );
      case "cloud":
        return baseReason + action.reason;
      case "queue":
        return (
          baseReason +
          `Queuing request for ${action.delayMs}ms. ${action.reason}`
        );
      case "hybrid":
        return (
          baseReason +
          `Using hybrid approach with ${(action.localRatio * 100).toFixed(0)}% local processing. ${action.reason}`
        );
    }
  }

  /**
   * Check if action should be updated
   */
  private shouldUpdateAction(
    oldAction: DispatchAction,
    newAction: DispatchAction
  ): boolean {
    // Simple comparison - could be more sophisticated
    if (oldAction.type !== newAction.type) {
      return true;
    }

    if (newAction.type === "hybrid" && oldAction.type === "hybrid") {
      return Math.abs(newAction.localRatio - oldAction.localRatio) > 0.1;
    }

    return false;
  }

  /**
   * Get current recommendation
   */
  getCurrentRecommendation(): ThermalDispatchRecommendation | null {
    return this.currentRecommendation;
  }

  /**
   * Get current thermal state
   */
  getCurrentState(): {
    temperature: number;
    zone: ThermalZone;
    recommendation: DispatchAction;
  } {
    const metrics = this.thermalManager.getMetrics();
    const zone = this.thermalManager.getCurrentZone();
    const recommendation = this.currentRecommendation?.action ?? {
      type: "local",
      mode: "full",
    };

    return {
      temperature: metrics.currentTemperature,
      zone,
      recommendation,
    };
  }

  /**
   * Update policy
   */
  updatePolicy(updates: Partial<ThermalDispatchPolicy>): void {
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
   * Get current policy
   */
  getPolicy(): ThermalDispatchPolicy {
    return { ...this.policy };
  }

  /**
   * Check if adaptive queueing is enabled
   */
  isAdaptiveQueueEnabled(): boolean {
    return this.policy.enableAdaptiveQueue ?? false;
  }

  /**
   * Get maximum queue delay
   */
  getMaxQueueDelay(): number {
    return this.policy.maxQueueDelay ?? 5000;
  }

  /**
   * Switch thermal policy dynamically
   */
  setPolicy(
    policy:
      | "conservative"
      | "aggressive"
      | "balanced"
      | "adaptive"
      | ThermalPolicy
  ): void {
    if (typeof policy === "string") {
      this.thermalPolicy = createThermalPolicy(policy);
    } else {
      this.thermalPolicy = policy;
    }

    // Update controller policy
    this.controller.setPolicy(this.thermalPolicy);
  }

  /**
   * Get current thermal policy
   */
  getThermalPolicy(): ThermalPolicy {
    return this.thermalPolicy;
  }

  /**
   * Get thermal health report
   */
  async getHealthReport(): Promise<ThermalHealthReport> {
    const metrics = this.thermalManager.getMetrics();
    const zone = this.thermalManager.getCurrentZone();
    const stats = this.thermalPolicy.getStats();

    let prediction: ThermalPrediction | undefined;
    if (this.enablePrediction) {
      prediction = (await this.controller.getPrediction()) ?? undefined;
    }

    const recommendations: string[] = [];

    // Add recommendations based on state
    if (zone === "critical") {
      recommendations.push(
        "System in critical thermal zone - reduce load immediately"
      );
    } else if (zone === "throttle") {
      recommendations.push(
        "System in throttle zone - consider reducing load or switching to conservative policy"
      );
    }

    if (prediction && prediction.confidence > 0.8) {
      if (prediction.predictedZone === "critical" && zone !== "critical") {
        recommendations.push(
          `Critical zone predicted in ${prediction.timeToCritical}ms - recommend preemptive action`
        );
      } else if (prediction.predictedZone === "normal" && zone === "throttle") {
        recommendations.push(
          `Recovery to normal predicted in ${prediction.timeToThrottle}ms`
        );
      }
    }

    const controllerStats = this.controller.getStats();
    if (controllerStats.avgPredictionError > 5) {
      recommendations.push(
        "Prediction accuracy low - recommend more conservative policy"
      );
    }

    const isHealthy =
      zone !== "critical" && controllerStats.avgPredictionError < 5;

    return {
      currentTemp: metrics.currentTemperature,
      currentZone: zone,
      prediction,
      recommendations,
      stats,
      isHealthy,
    };
  }

  /**
   * Get controller statistics
   */
  getControllerStats() {
    return this.controller.getStats();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.currentRecommendation = null;
    this.onRecommendationChangeCallback = undefined;
    this.controller.stop();
  }
}

/**
 * Create thermal integration with default policy
 */
export function createThermalIntegration(
  thermalManager: ThermalManager,
  options?: ThermalIntegrationOptions
): ThermalIntegration {
  return new ThermalIntegration(thermalManager, options);
}
