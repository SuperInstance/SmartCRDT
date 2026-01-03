/**
 * Transition Decider
 *
 * Decides when to transition between curriculum stages with:
 * - Readiness assessment
 * - Confidence estimation
 * - Recommendation generation
 */

import type {
  TransitionDecider as ITransitionDecider,
  TransitionDecision,
  StageProgress,
  StageMetrics,
} from "../types.js";

export class TransitionDecider implements ITransitionDecider {
  private minEpochsThreshold: number = 5;
  private patienceBuffer: number = 2;

  /**
   * Decide if should transition to next stage
   */
  shouldTransition(
    progress: StageProgress,
    metrics: StageMetrics
  ): TransitionDecision {
    // Check minimum epochs
    if (progress.epochs < this.minEpochsThreshold) {
      return {
        shouldTransition: false,
        reason: `Minimum epochs not met (${progress.epochs}/${this.minEpochsThreshold})`,
        confidence: 0.2,
        recommendations: ["Continue training", "Monitor loss trends"],
      };
    }

    // Check mastery threshold
    const masteryMet = progress.mastery >= progress.config.masteryThreshold;
    if (!masteryMet) {
      const gap = progress.config.masteryThreshold - progress.mastery;
      return {
        shouldTransition: false,
        reason: `Mastery threshold not met (${(progress.mastery * 100).toFixed(1)}% < ${(progress.config.masteryThreshold * 100).toFixed(1)}%)`,
        confidence: progress.mastery / progress.config.masteryThreshold,
        recommendations: [
          `Continue for ~${Math.ceil(gap * 20)} more epochs`,
          "Check if loss is converging",
          "Consider replay buffer",
        ],
      };
    }

    // Check loss stability
    const lossStable = this.isLossStable(metrics.loss);
    if (!lossStable) {
      return {
        shouldTransition: false,
        reason: "Loss not stable yet",
        confidence: 0.6,
        recommendations: [
          "Wait for loss convergence",
          "Monitor last 5 epochs",
          "Reduce learning rate if oscillating",
        ],
      };
    }

    // All checks passed
    return {
      shouldTransition: true,
      reason: "Stage mastered - ready to advance",
      confidence: Math.min(
        1.0,
        progress.mastery / progress.config.masteryThreshold
      ),
      recommendations: [
        "Proceed to next stage",
        "Save current checkpoint",
        "Archive training logs",
      ],
    };
  }

  /**
   * Estimate readiness for transition (0-1)
   */
  estimateReadiness(progress: StageProgress, metrics: StageMetrics): number {
    let readiness = 0;

    // Epoch contribution (max 0.25)
    const epochProgress = Math.min(1, progress.epochs / progress.config.epochs);
    readiness += epochProgress * 0.25;

    // Mastery contribution (max 0.5)
    const masteryRatio = progress.mastery / progress.config.masteryThreshold;
    readiness += Math.min(1, masteryRatio) * 0.5;

    // Loss stability contribution (max 0.25)
    const stabilityScore = this.calculateStabilityScore(metrics.loss);
    readiness += stabilityScore * 0.25;

    return Math.min(1.0, readiness);
  }

  /**
   * Check if loss is stable
   */
  private isLossStable(lossSeries: { values: number[]; std: number }): boolean {
    if (lossSeries.values.length < 5) {
      return false;
    }

    const recent = lossSeries.values.slice(-5);
    const variance =
      recent.reduce((sum, v) => {
        const mean = recent.reduce((s, val) => s + val, 0) / recent.length;
        return sum + (v - mean) ** 2;
      }, 0) / recent.length;

    return variance < 0.01;
  }

  /**
   * Calculate stability score (0-1)
   */
  private calculateStabilityScore(lossSeries: {
    values: number[];
    std: number;
  }): number {
    if (lossSeries.values.length < 3) {
      return 0;
    }

    const recent = lossSeries.values.slice(-5);
    const mean = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const max = Math.max(...recent);
    const min = Math.min(...recent);

    // Stable if range is small relative to mean
    const rangeRatio = mean > 0 ? (max - min) / mean : 1;
    return Math.max(0, 1 - rangeRatio * 10);
  }

  /**
   * Generate training recommendations
   */
  generateRecommendations(
    progress: StageProgress,
    metrics: StageMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Mastery-based recommendations
    if (progress.mastery < 0.5) {
      recommendations.push(
        "Struggling with current stage - consider reducing difficulty"
      );
    } else if (progress.mastery < 0.8) {
      recommendations.push("Making progress - continue current pace");
    } else if (progress.mastery < progress.config.masteryThreshold) {
      recommendations.push("Almost there - a few more epochs needed");
    }

    // Loss-based recommendations
    if (metrics.loss.std > 0.1) {
      recommendations.push(
        "High loss variance - consider reducing learning rate"
      );
    }

    // Epoch-based recommendations
    const epochRatio = progress.epochs / progress.config.epochs;
    if (
      epochRatio > 1.2 &&
      progress.mastery < progress.config.masteryThreshold
    ) {
      recommendations.push(
        "Taking longer than expected - may need to adjust curriculum"
      );
    }

    return recommendations;
  }

  /**
   * Set minimum epochs threshold
   */
  setMinEpochsThreshold(threshold: number): void {
    this.minEpochsThreshold = threshold;
  }

  /**
   * Set patience buffer
   */
  setPatienceBuffer(buffer: number): void {
    this.patienceBuffer = buffer;
  }
}
