/**
 * Adaptive Controller
 *
 * Implements adaptive learning strategies including:
 * - Performance-based adjustments
 * - Dynamic pacing control
 * - Difficulty adaptation
 * - Replay triggering
 */

import type {
  AdaptiveConfig,
  AdaptiveAction,
  StageProgress,
} from "../types.js";

export class AdaptiveController {
  private config: AdaptiveConfig;
  private actionHistory: Array<{
    action: AdaptiveAction;
    timestamp: number;
    stage: number;
  }> = [];

  constructor(config: AdaptiveConfig) {
    this.config = config;
  }

  /**
   * Determine if an adaptive action should be taken
   */
  shouldTakeAction(
    progress: StageProgress,
    currentMetrics: { loss: number; accuracy: number; mastery: number }
  ): AdaptiveAction | "none" {
    if (!this.config.enabled) {
      return "none";
    }

    // Check each metric against thresholds
    for (let i = 0; i < this.config.metrics.length; i++) {
      const metric = this.config.metrics[i];
      const threshold = this.config.thresholds[i];
      const action = this.config.actions[i];

      if (!metric) {
        continue;
      }

      const value = this.getMetricValue(progress, currentMetrics, metric);

      if (this.shouldTriggerAction(value, threshold, metric)) {
        this.recordAction(action, progress.stage);
        return action;
      }
    }

    // Check for specific conditions
    if (this.isStruggling(progress, currentMetrics)) {
      this.recordAction("increase_epochs", progress.stage);
      return "increase_epochs";
    }

    if (this.isAhead(progress, currentMetrics)) {
      this.recordAction("decrease_epochs", progress.stage);
      return "decrease_epochs";
    }

    if (this.isStuck(progress, currentMetrics)) {
      this.recordAction("replay_stage", progress.stage);
      return "replay_stage";
    }

    return "none";
  }

  /**
   * Get metric value from progress or current metrics
   */
  private getMetricValue(
    progress: StageProgress,
    currentMetrics: { loss: number; accuracy: number; mastery: number },
    metric: string
  ): number {
    switch (metric) {
      case "loss":
        return currentMetrics.loss;
      case "accuracy":
        return currentMetrics.accuracy;
      case "mastery":
        return currentMetrics.mastery;
      default:
        return progress.mastery;
    }
  }

  /**
   * Determine if action should be triggered based on metric value
   */
  private shouldTriggerAction(
    value: number,
    threshold: number,
    metric: string
  ): boolean {
    // For loss, lower is better - trigger if above threshold
    if (metric === "loss") {
      return value > threshold;
    }

    // For accuracy and mastery, higher is better - trigger if below threshold
    return value < threshold;
  }

  /**
   * Check if learner is struggling
   */
  private isStruggling(
    progress: StageProgress,
    metrics: { loss: number; accuracy: number; mastery: number }
  ): boolean {
    // High loss, low accuracy, low mastery after significant epochs
    return (
      progress.epochs > 5 &&
      metrics.loss > 0.5 &&
      metrics.accuracy < 0.6 &&
      metrics.mastery < 0.5
    );
  }

  /**
   * Check if learner is ahead of pace
   */
  private isAhead(
    progress: StageProgress,
    metrics: { loss: number; accuracy: number; mastery: number }
  ): boolean {
    // Low loss, high accuracy, high mastery early in training
    return (
      progress.epochs < progress.config.epochs * 0.5 &&
      metrics.loss < 0.2 &&
      metrics.accuracy > 0.85 &&
      metrics.mastery > 0.85
    );
  }

  /**
   * Check if learner is stuck (not improving)
   */
  private isStuck(
    progress: StageProgress,
    metrics: { loss: number; accuracy: number; mastery: number }
  ): boolean {
    // Not improving after many epochs
    return (
      progress.epochs > progress.config.epochs * 0.75 &&
      metrics.mastery < progress.config.masteryThreshold * 0.9 &&
      metrics.loss > 0.3
    );
  }

  /**
   * Calculate recommended epochs based on current progress
   */
  calculateRecommendedEpochs(progress: StageProgress): number {
    const baseEpochs = progress.config.epochs;
    const masteryRatio = progress.mastery / progress.config.masteryThreshold;

    if (masteryRatio >= 1.0) {
      // Already mastered, can reduce
      return Math.floor(baseEpochs * 0.8);
    } else if (masteryRatio >= 0.9) {
      // Almost there, slight increase
      return Math.floor(baseEpochs * 1.1);
    } else if (masteryRatio >= 0.7) {
      // Making good progress
      return baseEpochs;
    } else if (masteryRatio >= 0.5) {
      // Need more time
      return Math.floor(baseEpochs * 1.3);
    } else {
      // Significantly behind
      return Math.floor(baseEpochs * 1.5);
    }
  }

  /**
   * Calculate recommended batch size based on performance
   */
  calculateRecommendedBatchSize(
    progress: StageProgress,
    currentBatchSize: number,
    lossHistory: number[]
  ): number {
    const baseBatchSize = currentBatchSize;

    // Check loss variance
    if (lossHistory.length < 5) {
      return baseBatchSize;
    }

    const recent = lossHistory.slice(-5);
    const variance =
      recent.reduce((sum, v) => {
        const mean = recent.reduce((s, val) => s + val, 0) / recent.length;
        return sum + (v - mean) ** 2;
      }, 0) / recent.length;

    // High variance - decrease batch size for more stable gradients
    if (variance > 0.1) {
      return Math.max(8, Math.floor(baseBatchSize * 0.8));
    }

    // Low variance - can increase batch size for faster training
    if (variance < 0.01 && progress.epochs > 3) {
      return Math.min(128, Math.floor(baseBatchSize * 1.2));
    }

    return baseBatchSize;
  }

  /**
   * Calculate recommended learning rate based on progress
   */
  calculateRecommendedLearningRate(
    progress: StageProgress,
    currentLR: number,
    lossHistory: number[]
  ): number {
    // Simple learning rate scheduling based on loss trend
    if (lossHistory.length < 3) {
      return currentLR;
    }

    const recent = lossHistory.slice(-3);
    const trend = recent[2] - recent[0];

    // Loss increasing - decrease learning rate
    if (trend > 0.01) {
      return currentLR * 0.5;
    }

    // Loss decreasing steadily - can increase learning rate slightly
    if (trend < -0.05 && progress.epochs < progress.config.epochs * 0.5) {
      return currentLR * 1.1;
    }

    return currentLR;
  }

  /**
   * Get difficulty adjustment factor
   */
  getDifficultyAdjustment(progress: StageProgress): number {
    const masteryRatio = progress.mastery / progress.config.masteryThreshold;

    if (masteryRatio >= 1.0) {
      return 1.2; // Increase difficulty
    } else if (masteryRatio >= 0.8) {
      return 1.0; // Maintain difficulty
    } else if (masteryRatio >= 0.6) {
      return 0.9; // Slightly decrease difficulty
    } else {
      return 0.8; // Significantly decrease difficulty
    }
  }

  /**
   * Record action taken
   */
  private recordAction(action: AdaptiveAction, stage: number): void {
    this.actionHistory.push({
      action,
      timestamp: Date.now(),
      stage,
    });

    // Keep only last 100 actions
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-100);
    }
  }

  /**
   * Get action history
   */
  getActionHistory(): Array<{
    action: AdaptiveAction;
    timestamp: number;
    stage: number;
  }> {
    return [...this.actionHistory];
  }

  /**
   * Get action frequency
   */
  getActionFrequency(
    action: AdaptiveAction,
    windowMs: number = 3600000
  ): number {
    const now = Date.now();
    const recent = this.actionHistory.filter(
      a => a.action === action && now - a.timestamp < windowMs
    );

    return recent.length;
  }

  /**
   * Check if action should be throttled
   */
  shouldThrottleAction(
    action: AdaptiveAction,
    minIntervalMs: number = 300000
  ): boolean {
    const history = this.actionHistory.filter(a => a.action === action);
    if (history.length === 0) {
      return false;
    }

    const lastAction = history[history.length - 1];
    return Date.now() - lastAction.timestamp < minIntervalMs;
  }

  /**
   * Reset controller state
   */
  reset(): void {
    this.actionHistory = [];
  }

  /**
   * Get configuration
   */
  getConfig(): AdaptiveConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AdaptiveConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
