/**
 * @lsi/scale-strategy - Threshold Strategy
 *
 * Scale when metrics cross defined thresholds.
 */

import type {
  ScaleDecision,
  ScalePolicy,
  ScaleMetric,
  ScaleManagerConfig,
  WorkerPoolState,
} from "../types.js";

/**
 * Threshold strategy configuration
 */
export interface ThresholdStrategyConfig {
  /** Whether this strategy is enabled */
  enabled: boolean;
  /** Scale policy */
  policy: ScalePolicy;
  /** How many metrics must agree before scaling */
  agreementThreshold: number;
  /** Hysteresis factor to prevent oscillation (0-1) */
  hysteresis: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ThresholdStrategyConfig = {
  enabled: true,
  policy: "balanced",
  agreementThreshold: 0.5, // 50% of metrics must agree
  hysteresis: 0.1, // 10% hysteresis
};

/**
 * Threshold-based scaling strategy
 */
export class ThresholdStrategy {
  private config: ThresholdStrategyConfig;
  private managerConfig: ScaleManagerConfig;
  private lastDecision: ScaleDirection | null = null;

  constructor(
    managerConfig: ScaleManagerConfig,
    config?: Partial<ThresholdStrategyConfig>
  ) {
    this.managerConfig = managerConfig;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Evaluate metrics and make scaling decision
   */
  async evaluate(
    metrics: ScaleMetric[],
    workerState: WorkerPoolState
  ): Promise<ScaleDecision> {
    if (!this.config.enabled) {
      return this.noActionDecision(workerState);
    }

    // Count metric recommendations
    const scaleUpVotes: ScaleMetric[] = [];
    const scaleDownVotes: ScaleMetric[] = [];
    const noActionVotes: ScaleMetric[] = [];

    for (const metric of metrics) {
      const vote = this.evaluateMetric(metric);
      if (vote === "up") {
        scaleUpVotes.push(metric);
      } else if (vote === "down") {
        scaleDownVotes.push(metric);
      } else {
        noActionVotes.push(metric);
      }
    }

    // Calculate agreement
    const totalMetrics = metrics.length;
    const scaleUpRatio = scaleUpVotes.length / totalMetrics;
    const scaleDownRatio = scaleDownVotes.length / totalMetrics;

    let direction: ScaleDirection;
    let targetCount: number;
    let confidence: number;
    const triggeredBy: string[] = [];

    // Apply hysteresis based on last decision
    const hysteresisThreshold = this.config.hysteresis;

    if (scaleUpRatio >= this.config.agreementThreshold) {
      // Check hysteresis if last decision was scale down
      if (
        this.lastDecision === "down" &&
        scaleUpRatio < this.config.agreementThreshold + hysteresisThreshold
      ) {
        direction = "none";
        targetCount = workerState.active;
        confidence = 0.5;
        triggeredBy.push("hysteresis");
      } else {
        direction = "up";
        targetCount = this.calculateTargetCount(
          "up",
          scaleUpVotes,
          workerState
        );
        confidence = scaleUpRatio;
        triggeredBy.push(...scaleUpVotes.map(m => m.name));
      }
    } else if (scaleDownRatio >= this.config.agreementThreshold) {
      // Check hysteresis if last decision was scale up
      if (
        this.lastDecision === "up" &&
        scaleDownRatio < this.config.agreementThreshold + hysteresisThreshold
      ) {
        direction = "none";
        targetCount = workerState.active;
        confidence = 0.5;
        triggeredBy.push("hysteresis");
      } else {
        direction = "down";
        targetCount = this.calculateTargetCount(
          "down",
          scaleDownVotes,
          workerState
        );
        confidence = scaleDownRatio;
        triggeredBy.push(...scaleDownVotes.map(m => m.name));
      }
    } else {
      direction = "none";
      targetCount = workerState.active;
      confidence = 0.5;
      triggeredBy.push("no_consensus");
    }

    // Store decision for hysteresis
    this.lastDecision = direction;

    return {
      direction,
      targetCount,
      currentCount: workerState.active,
      reason: `Threshold strategy: ${scaleUpVotes.length} up, ${scaleDownVotes.length} down (${direction})`,
      confidence,
      triggeredBy,
      estimatedTimeMs: this.estimateTime(direction, targetCount, workerState),
      isEmergency: false,
    };
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
  updateConfig(config: Partial<ThresholdStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): ThresholdStrategyConfig {
    return { ...this.config };
  }

  private evaluateMetric(metric: ScaleMetric): ScaleDirection {
    // Apply weight-based threshold adjustment
    const adjustedUpThreshold =
      metric.threshold.up * (1 + (1 - metric.weight) * 0.2);
    const adjustedDownThreshold =
      metric.threshold.down * (1 - (1 - metric.weight) * 0.2);

    if (metric.value >= adjustedUpThreshold) {
      return "up";
    } else if (metric.value <= adjustedDownThreshold) {
      return "down";
    }
    return "none";
  }

  private calculateTargetCount(
    direction: ScaleDirection,
    triggeringMetrics: ScaleMetric[],
    workerState: WorkerPoolState
  ): number {
    let count = workerState.active;

    if (direction === "up") {
      // Find the metric requiring the most scale-up
      const maxMetric = triggeringMetrics.reduce(
        (max, m) => (m.value > max.value ? m : max),
        triggeringMetrics[0]
      );

      // Scale based on how far above threshold we are
      const excessFactor = maxMetric.value / maxMetric.threshold.up;

      if (this.config.policy === "aggressive") {
        count = Math.ceil(count * excessFactor * 1.5);
      } else if (this.config.policy === "conservative") {
        count = Math.ceil(count + excessFactor);
      } else {
        count = Math.ceil(count * excessFactor * 1.2);
      }
    } else {
      // Scale down based on how far below threshold we are
      const minMetric = triggeringMetrics.reduce(
        (min, m) => (m.value < min.value ? m : min),
        triggeringMetrics[0]
      );

      const underFactor = minMetric.threshold.down / (minMetric.value || 1);

      if (this.config.policy === "aggressive") {
        count = Math.floor(count / (underFactor * 1.5));
      } else if (this.config.policy === "conservative") {
        count = Math.floor(count - 1);
      } else {
        count = Math.floor(count / underFactor);
      }
    }

    // Enforce bounds
    const minCount = this.managerConfig.enableScaleToZero
      ? 0
      : this.managerConfig.minWorkers;
    return Math.max(minCount, Math.min(this.managerConfig.maxWorkers, count));
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
      reason: "Threshold strategy is disabled",
      confidence: 0,
      triggeredBy: [],
      estimatedTimeMs: 0,
      isEmergency: false,
    };
  }
}
