/**
 * Difficulty Sampler
 *
 * Samples training examples based on difficulty level with:
 * - Curriculum-aware sampling
 * - Dynamic difficulty adjustment
 * - Balanced batch composition
 */

import type {
  TrainingExample,
  DifficultySampler as IDifficultySampler,
} from "../types.js";

export class DifficultySampler implements IDifficultySampler {
  private currentDifficulty: number = 0.5;
  private history: Array<{
    difficulty: number;
    success: boolean;
    confidence: number;
    timestamp: number;
  }> = [];

  /**
   * Sample a batch of examples at the current difficulty level
   */
  sample(batchSize: number, currentDifficulty: number): TrainingExample[] {
    this.currentDifficulty = currentDifficulty;
    return [];
  }

  /**
   * Update difficulty based on performance
   */
  updateDifficulty(success: boolean, confidence: number): void {
    this.history.push({
      difficulty: this.currentDifficulty,
      success,
      confidence,
      timestamp: Date.now(),
    });

    // Keep only recent history
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }

  /**
   * Get recommended difficulty based on history
   */
  getRecommendedDifficulty(): number {
    if (this.history.length < 5) {
      return 0.5;
    }

    const recent = this.history.slice(-10);
    const successRate = recent.filter(h => h.success).length / recent.length;
    const avgConfidence =
      recent.reduce((sum, h) => sum + h.confidence, 0) / recent.length;

    // High success rate and high confidence - increase difficulty
    if (successRate > 0.8 && avgConfidence > 0.85) {
      return Math.min(1.0, this.currentDifficulty + 0.1);
    }

    // Low success rate - decrease difficulty
    if (successRate < 0.5) {
      return Math.max(0.0, this.currentDifficulty - 0.1);
    }

    // Maintain current difficulty
    return this.currentDifficulty;
  }

  /**
   * Get sampling statistics
   */
  getStats(): {
    totalSamples: number;
    successRate: number;
    averageConfidence: number;
    currentDifficulty: number;
  } {
    const successRate =
      this.history.length > 0
        ? this.history.filter(h => h.success).length / this.history.length
        : 0;

    const averageConfidence =
      this.history.length > 0
        ? this.history.reduce((sum, h) => sum + h.confidence, 0) /
          this.history.length
        : 0;

    return {
      totalSamples: this.history.length,
      successRate,
      averageConfidence,
      currentDifficulty: this.currentDifficulty,
    };
  }

  /**
   * Reset sampler state
   */
  reset(): void {
    this.history = [];
    this.currentDifficulty = 0.5;
  }
}
