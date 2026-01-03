/**
 * @lsi/scale-strategy - Predictive Strategy
 *
 * ML-based prediction of load for proactive scaling.
 */

import type {
  ScaleDecision,
  ScalePolicy,
  ScaleMetric,
  ScaleManagerConfig,
  WorkerPoolState,
  ScaleEvent,
  PredictiveModelInput,
  PredictiveModelOutput,
} from "../types.js";

/**
 * Predictive strategy configuration
 */
export interface PredictiveStrategyConfig {
  /** Whether this strategy is enabled */
  enabled: boolean;
  /** Scale policy */
  policy: ScalePolicy;
  /** Prediction confidence threshold (0-1) */
  confidenceThreshold: number;
  /** How far ahead to predict (ms) */
  predictionHorizonMs: number;
  /** Historical data points to consider */
  historyWindow: number;
}

/**
 * Time series data point
 */
interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PredictiveStrategyConfig = {
  enabled: true,
  policy: "balanced",
  confidenceThreshold: 0.6,
  predictionHorizonMs: 300000, // 5 minutes
  historyWindow: 100, // 100 data points
};

/**
 * Predictive scaling strategy using simple time series forecasting
 */
export class PredictiveStrategy {
  private config: PredictiveStrategyConfig;
  private managerConfig: ScaleManagerConfig;
  private metricHistory: Map<string, TimeSeriesPoint[]> = new Map();

  constructor(
    managerConfig: ScaleManagerConfig,
    config?: Partial<PredictiveStrategyConfig>
  ) {
    this.managerConfig = managerConfig;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      predictionHorizonMs: managerConfig.predictionHorizonMs,
    };
  }

  /**
   * Evaluate metrics and make predictive scaling decision
   */
  async evaluate(
    metrics: ScaleMetric[],
    workerState: WorkerPoolState
  ): Promise<ScaleDecision> {
    if (!this.config.enabled) {
      return this.noActionDecision(workerState);
    }

    // Update metric history
    this.updateHistory(metrics);

    // Build prediction input
    const input = this.buildPredictionInput(metrics, workerState);

    // Run prediction
    const output = this.runPrediction(input);

    // Check confidence threshold
    if (output.confidence < this.config.confidenceThreshold) {
      return this.lowConfidenceDecision(workerState, output);
    }

    // Calculate target count based on prediction
    let targetCount = this.calculateTargetCount(output, workerState);

    // Apply policy adjustments
    targetCount = this.applyPolicy(targetCount, output, workerState);

    // Enforce bounds
    const minCount = this.managerConfig.enableScaleToZero
      ? 0
      : this.managerConfig.minWorkers;
    targetCount = Math.max(
      minCount,
      Math.min(this.managerConfig.maxWorkers, targetCount)
    );

    // Determine if scaling is needed
    let direction: ScaleDirection;
    let triggeredBy: string[];

    if (targetCount > workerState.active) {
      direction = "up";
      triggeredBy = ["predictive_model", "forecast_increase"];
    } else if (targetCount < workerState.active) {
      direction = "down";
      triggeredBy = ["predictive_model", "forecast_decrease"];
    } else {
      direction = "none";
      triggeredBy = ["predictive_model", "stable_forecast"];
    }

    return {
      direction,
      targetCount,
      currentCount: workerState.active,
      reason: `Predictive strategy: forecast load ${output.predictedLoad.toFixed(2)}, ${output.predictedWorkerCount} workers needed (confidence: ${output.confidence.toFixed(2)})`,
      confidence: output.confidence,
      triggeredBy,
      estimatedTimeMs: this.estimateTime(direction, targetCount, workerState),
      isEmergency: false,
    };
  }

  /**
   * Update metric history
   */
  updateHistory(metrics: ScaleMetric[]): void {
    const now = Date.now();

    for (const metric of metrics) {
      if (!this.metricHistory.has(metric.name)) {
        this.metricHistory.set(metric.name, []);
      }

      const history = this.metricHistory.get(metric.name)!;
      history.push({ timestamp: now, value: metric.value });

      // Trim to history window
      if (history.length > this.config.historyWindow) {
        history.shift();
      }
    }
  }

  /**
   * Get metric history
   */
  getMetricHistory(metricName: string): TimeSeriesPoint[] {
    return this.metricHistory.get(metricName) || [];
  }

  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set policy
   */
  setPolicy(policy: ScalePolicy): void {
    this.config.policy = policy;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PredictiveStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): PredictiveStrategyConfig {
    return { ...this.config };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.metricHistory.clear();
  }

  private buildPredictionInput(
    metrics: ScaleMetric[],
    workerState: WorkerPoolState
  ): PredictiveModelInput {
    const historicalMetrics = metrics.map(m => ({
      timestamp: m.timestamp,
      value: m.value,
    }));

    const now = new Date();
    const timePatterns = {
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
    };

    const currentMetrics: Record<string, number> = {};
    for (const metric of metrics) {
      currentMetrics[metric.name] = metric.value;
    }

    return {
      historicalMetrics,
      currentMetrics,
      timePatterns,
      recentScaleEvents: [], // Would be populated from manager
    };
  }

  private runPrediction(input: PredictiveModelInput): PredictiveModelOutput {
    // Simple linear regression prediction
    // In production, this would use a trained ML model

    const queueDepthHistory = this.metricHistory.get("queue_depth") || [];
    const cpuHistory = this.metricHistory.get("cpu_usage") || [];

    let predictedLoad = 0.5;
    let confidence = 0.5;

    if (queueDepthHistory.length >= 10) {
      // Calculate trend
      const recent = queueDepthHistory.slice(-10);
      const trend = this.calculateTrend(recent);

      // Predict future value
      const lastValue = recent[recent.length - 1].value;
      const predictedValue = lastValue + trend * 10; // 10 steps ahead

      // Normalize to 0-1
      predictedLoad = Math.min(1, Math.max(0, predictedValue / 100));

      // Calculate confidence based on trend stability
      const variance = this.calculateVariance(recent);
      confidence = Math.max(0.3, Math.min(0.95, 1 - variance / 1000));
    }

    // Adjust for time patterns
    if (input.timePatterns.isWeekend) {
      predictedLoad *= 0.7; // Lower load on weekends
    }

    const hour = input.timePatterns.hourOfDay;
    if (hour >= 9 && hour <= 17) {
      predictedLoad *= 1.3; // Higher load during business hours
    } else if (hour >= 0 && hour <= 6) {
      predictedLoad *= 0.5; // Lower load at night
    }

    predictedLoad = Math.min(1, Math.max(0, predictedLoad));

    // Calculate predicted worker count
    const predictedWorkerCount = Math.ceil(
      predictedLoad * this.managerConfig.maxWorkers
    );

    return {
      predictedLoad,
      predictedWorkerCount,
      confidence,
      horizonMs: this.config.predictionHorizonMs,
      recommendedAction:
        predictedWorkerCount > input.currentMetrics["queue_depth" || 0] / 10
          ? "up"
          : "down",
    };
  }

  private calculateTrend(data: TimeSeriesPoint[]): number {
    if (data.length < 2) {
      return 0;
    }

    // Simple linear regression
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i].value;
      sumXY += i * data[i].value;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private calculateVariance(data: TimeSeriesPoint[]): number {
    if (data.length === 0) {
      return 0;
    }

    const mean = data.reduce((sum, d) => sum + d.value, 0) / data.length;
    const variance =
      data.reduce((sum, d) => sum + Math.pow(d.value - mean, 2), 0) /
      data.length;

    return variance;
  }

  private calculateTargetCount(
    output: PredictiveModelOutput,
    workerState: WorkerPoolState
  ): number {
    return output.predictedWorkerCount;
  }

  private applyPolicy(
    targetCount: number,
    output: PredictiveModelOutput,
    workerState: WorkerPoolState
  ): number {
    if (this.config.policy === "conservative") {
      // Be more conservative with predictions
      const diff = targetCount - workerState.active;
      return workerState.active + Math.sign(diff) * Math.min(Math.abs(diff), 1);
    }

    if (this.config.policy === "aggressive") {
      // Trust the prediction more
      return targetCount;
    }

    // Balanced: scale gradually towards prediction
    const diff = targetCount - workerState.active;
    return workerState.active + Math.floor(diff * 0.5);
  }

  private estimateTime(
    direction: ScaleDirection,
    targetCount: number,
    workerState: WorkerPoolState
  ): number {
    if (direction === "none") {
      return 0;
    }

    const countDiff = Math.abs(targetCount - workerState.active);
    const timePerWorker = direction === "up" ? 2000 : 5000;

    return countDiff * timePerWorker;
  }

  private noActionDecision(workerState: WorkerPoolState): ScaleDecision {
    return {
      direction: "none",
      targetCount: workerState.active,
      currentCount: workerState.active,
      reason: "Predictive strategy is disabled",
      confidence: 0,
      triggeredBy: [],
      estimatedTimeMs: 0,
      isEmergency: false,
    };
  }

  private lowConfidenceDecision(
    workerState: WorkerPoolState,
    output: PredictiveModelOutput
  ): ScaleDecision {
    return {
      direction: "none",
      targetCount: workerState.active,
      currentCount: workerState.active,
      reason: `Predictive strategy: low confidence (${output.confidence.toFixed(2)} < ${this.config.confidenceThreshold})`,
      confidence: output.confidence,
      triggeredBy: ["predictive_model", "low_confidence"],
      estimatedTimeMs: 0,
      isEmergency: false,
    };
  }
}
