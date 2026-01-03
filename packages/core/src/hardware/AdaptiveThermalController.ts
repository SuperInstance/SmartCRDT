/**
 * AdaptiveThermalController - Intelligent thermal management with prediction
 *
 * This module provides an adaptive controller that learns from thermal history
 * and makes preemptive decisions based on temperature trends.
 */

import type { ThermalManager } from "./ThermalManager.js";
import type {
  ThermalPolicy,
  ThermalHistoryEntry,
  ThermalPrediction,
  ThermalAction,
} from "./ThermalPolicy.js";
import type { ThermalState } from "./HardwareState.js";
import type { ThermalZone } from "./ThermalManager.js";

/**
 * Controller statistics
 */
export interface ControllerStats {
  totalPredictions: number;
  accuratePredictions: number;
  preemptiveActions: number;
  avgPredictionError: number;
  historySize: number;
  uptime: number;
  lastUpdated: number;
}

/**
 * Adaptive thermal controller configuration
 */
export interface AdaptiveControllerConfig {
  /** History size limit */
  maxHistorySize?: number;
  /** Monitoring interval (ms) */
  monitorInterval?: number;
  /** Learning rate for threshold adjustment */
  learningRate?: number;
  /** Minimum confidence for preemptive action */
  minPreemptiveConfidence?: number;
  /** Enable prediction */
  enablePrediction?: boolean;
}

/**
 * AdaptiveThermalController - Learns from thermal history and predicts future states
 */
export class AdaptiveThermalController {
  private history: ThermalHistoryEntry[] = [];
  private maxHistorySize: number;
  private monitorInterval: number | null = null;
  private startTime = Date.now();
  private learningRate: number;
  private minPreemptiveConfidence: number;
  private enablePrediction: boolean;

  private stats: ControllerStats = {
    totalPredictions: 0,
    accuratePredictions: 0,
    preemptiveActions: 0,
    avgPredictionError: 0,
    historySize: 0,
    uptime: 0,
    lastUpdated: Date.now(),
  };

  private lastState: ThermalState | null = null;
  private predictionErrors: number[] = [];

  constructor(
    private thermalManager: ThermalManager,
    private policy: ThermalPolicy,
    config: AdaptiveControllerConfig = {}
  ) {
    this.maxHistorySize = config.maxHistorySize ?? 10000;
    this.learningRate = config.learningRate ?? 0.1;
    this.minPreemptiveConfidence = config.minPreemptiveConfidence ?? 0.7;
    this.enablePrediction = config.enablePrediction ?? true;

    this.startMonitoring();
  }

  /**
   * Get action with prediction
   */
  async getAction(currentState?: ThermalState): Promise<ThermalAction> {
    const state = currentState ?? (await this.getCurrentState());

    // Add to history
    this.addToHistory(state);

    // Get action from policy
    const action = this.policy.getAction(state);

    // Use prediction if enabled and policy supports it
    if (this.enablePrediction && this.isAdaptivePolicy(this.policy)) {
      const prediction = this.policy.getPrediction(state);

      // Take preemptive action if confident
      if (prediction.confidence >= this.minPreemptiveConfidence) {
        const preemptiveAction = this.shouldTakePreemptiveAction(
          state,
          prediction
        );

        if (preemptiveAction) {
          this.stats.preemptiveActions++;
          return preemptiveAction;
        }
      }
    }

    return action;
  }

  /**
   * Get thermal prediction
   */
  async getPrediction(): Promise<ThermalPrediction | null> {
    if (!this.enablePrediction) {
      return null;
    }

    const state = await this.getCurrentState();

    if (this.isAdaptivePolicy(this.policy)) {
      const prediction = this.policy.getPrediction(state);
      this.stats.totalPredictions++;

      // Track prediction accuracy
      if (this.lastState) {
        const error = Math.abs(prediction.predictedTemp - this.lastState.cpu);
        this.predictionErrors.push(error);
        if (this.predictionErrors.length > 100) {
          this.predictionErrors.shift();
        }

        this.stats.avgPredictionError =
          this.predictionErrors.reduce((sum, e) => sum + e, 0) /
          this.predictionErrors.length;
      }

      return prediction;
    }

    return null;
  }

  /**
   * Get current thermal state from manager
   */
  private async getCurrentState(): Promise<ThermalState> {
    const metrics = this.thermalManager.getMetrics();
    const zone = this.thermalManager.getCurrentZone();

    return {
      cpu: metrics.currentTemperature,
      zone,
      critical: zone === "critical",
      timeInZone: metrics.timeInZone,
    };
  }

  /**
   * Add state to history
   */
  private addToHistory(state: ThermalState): void {
    const zone = this.thermalManager.getCurrentZone();
    const action = this.policy.getAction(state);

    const entry: ThermalHistoryEntry = {
      timestamp: Date.now(),
      temperature: state.cpu,
      zone,
      action,
      load: 0.5, // Placeholder - would come from actual system load
      ambientTemp: 25, // Placeholder - would come from sensor
    };

    this.history.push(entry);

    // Trim history
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.stats.historySize = this.history.length;
    this.stats.lastUpdated = Date.now();
    this.lastState = state;
  }

  /**
   * Determine if preemptive action should be taken
   */
  private shouldTakePreemptiveAction(
    state: ThermalState,
    prediction: ThermalPrediction
  ): ThermalAction | null {
    // Only preempt if confident and prediction is concerning
    if (prediction.confidence < this.minPreemptiveConfidence) {
      return null;
    }

    // Preempt if predicted to go critical soon
    if (
      prediction.predictedZone === "critical" &&
      prediction.timeToCritical < 5000
    ) {
      return {
        type: "redirect",
        destination: "cloud",
        reason: `Preemptive: Predicted critical temp in ${prediction.timeToCritical}ms`,
      };
    }

    // Preempt if predicted to go throttle and can queue
    if (
      prediction.predictedZone === "throttle" &&
      prediction.timeToThrottle < 3000 &&
      state.zone === "normal"
    ) {
      return {
        type: "queue",
        delayMs: 2000,
        reason: `Preemptive: Predicted throttle zone in ${prediction.timeToThrottle}ms`,
      };
    }

    return null;
  }

  /**
   * Check if policy is adaptive (supports prediction)
   */
  private isAdaptivePolicy(policy: ThermalPolicy): policy is ThermalPolicy & {
    getPrediction(state: ThermalState): ThermalPrediction | null;
  } {
    return (
      "getPrediction" in policy &&
      typeof (policy as any).getPrediction === "function"
    );
  }

  /**
   * Calculate temperature trend from history
   */
  calculateTrend(): number {
    if (this.history.length < 10) {
      return 0;
    }

    const recent = this.history.slice(-100);
    const n = recent.length;

    // Linear regression
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
  calculateVariance(): number {
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
   * Estimate time to reach a thermal zone
   */
  timeToZone(targetZone: ThermalZone): number {
    const state = this.thermalManager.getMetrics();
    const currentTemp = state.currentTemperature;
    const trend = this.calculateTrend();

    let threshold: number;
    switch (targetZone) {
      case "normal":
        threshold = 70; // Default
        break;
      case "throttle":
        threshold = 85; // Default
        break;
      case "critical":
        threshold = 95; // Default
        break;
    }

    if (currentTemp >= threshold) {
      return 0;
    }

    if (trend <= 0) {
      return Infinity;
    }

    const degreesToThreshold = threshold - currentTemp;
    const secondsToThreshold = degreesToThreshold / trend;

    return Math.round(secondsToThreshold * 1000);
  }

  /**
   * Learn from history and adapt policy
   */
  learnFromHistory(): void {
    if (this.history.length < 100) {
      return;
    }

    const recent = this.history.slice(-1000);

    // Calculate zone distribution
    const zoneCounts = { normal: 0, throttle: 0, critical: 0 };
    recent.forEach(entry => zoneCounts[entry.zone]++);

    const totalEntries = recent.length;
    const throttleRatio = zoneCounts.throttle / totalEntries;
    const criticalRatio = zoneCounts.critical / totalEntries;

    // Adjust policy based on patterns
    if (this.isAdaptivePolicy(this.policy)) {
      // Policy adapts itself
      return;
    }

    // For non-adaptive policies, provide recommendations
    if (throttleRatio > 0.3) {
      console.warn(
        `High throttle ratio (${(throttleRatio * 100).toFixed(1)}%), consider conservative policy`
      );
    } else if (throttleRatio < 0.05 && criticalRatio === 0) {
      console.info(
        `Low throttle ratio (${(throttleRatio * 100).toFixed(1)}%), could use aggressive policy`
      );
    }
  }

  /**
   * Set policy
   */
  setPolicy(policy: ThermalPolicy): void {
    this.policy = policy;
    this.stats.lastUpdated = Date.now();
  }

  /**
   * Get current policy
   */
  getPolicy(): ThermalPolicy {
    return this.policy;
  }

  /**
   * Get controller statistics
   */
  getStats(): ControllerStats {
    this.stats.uptime = Date.now() - this.startTime;
    return { ...this.stats };
  }

  /**
   * Get thermal history
   */
  getHistory(): ThermalHistoryEntry[] {
    return [...this.history];
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
    this.stats.historySize = 0;
    this.lastState = null;
    this.predictionErrors = [];
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalPredictions: 0,
      accuratePredictions: 0,
      preemptiveActions: 0,
      avgPredictionError: 0,
      historySize: this.history.length,
      uptime: 0,
      lastUpdated: Date.now(),
    };
    this.startTime = Date.now();
    this.predictionErrors = [];
  }

  /**
   * Start monitoring thermal state
   */
  private startMonitoring(): void {
    // Monitoring is passive - updates happen when getAction is called
    // Could add active monitoring here if needed
  }

  /**
   * Stop monitoring and cleanup
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Get health report
   */
  getHealthReport(): {
    isHealthy: boolean;
    currentTemp: number;
    currentZone: ThermalZone;
    prediction: ThermalPrediction | null;
    recommendations: string[];
  } {
    const metrics = this.thermalManager.getMetrics();
    const zone = this.thermalManager.getCurrentZone();
    const stats = this.getStats();

    const isHealthy = zone !== "critical" && stats.avgPredictionError < 5;

    const recommendations: string[] = [];

    if (zone === "critical") {
      recommendations.push(
        "System in critical thermal zone - reduce load immediately"
      );
    } else if (zone === "throttle") {
      recommendations.push("System in throttle zone - consider reducing load");
    }

    if (stats.avgPredictionError > 5) {
      recommendations.push(
        "Prediction accuracy low - recommend more conservative policy"
      );
    }

    if (stats.preemptiveActions > 100) {
      recommendations.push(
        "High preemptive action count - system under thermal stress"
      );
    }

    return {
      isHealthy,
      currentTemp: metrics.currentTemperature,
      currentZone: zone,
      prediction: null, // Would be filled by getPrediction()
      recommendations,
    };
  }

  /**
   * Dispose of controller
   */
  dispose(): void {
    this.stop();
    this.clearHistory();
    this.resetStats();
  }
}

/**
 * Create adaptive thermal controller
 */
export function createAdaptiveThermalController(
  thermalManager: ThermalManager,
  policy?: ThermalPolicy,
  config?: AdaptiveControllerConfig
): AdaptiveThermalController {
  const defaultPolicy = policy;
  return new AdaptiveThermalController(
    thermalManager,
    defaultPolicy ?? policy!,
    config
  );
}
