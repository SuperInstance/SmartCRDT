/**
 * @lsi/vljepa-video/quality/QualityController
 *
 * Quality controller for controlling video quality dynamically.
 *
 * @version 1.0.0
 */

import type {
  QualityControllerConfig,
  VideoFrame,
  FrameQuality,
} from "../types.js";

/**
 * Quality controller
 *
 * Dynamically controls video quality based on conditions.
 */
export class QualityController {
  private config: QualityControllerConfig;
  private currentQuality: number = 1.0;
  private qualityHistory: Array<{ quality: number; timestamp: number }> = [];
  private adaptationCount: number = 0;

  constructor(config: QualityControllerConfig) {
    this.config = {
      targetQuality: config.targetQuality || 0.8,
      minQuality: config.minQuality || 0.5,
      adaptResolution: config.adaptResolution !== false,
      adaptFrameRate: config.adaptFrameRate !== false,
      measureInterval: config.measureInterval || 30,
    };
  }

  /**
   * Assess and adjust quality
   */
  assess(
    frame: VideoFrame,
    quality: FrameQuality
  ): {
    currentQuality: number;
    adjustment: number;
    reason: string;
    shouldAdapt: boolean;
  } {
    // Add to history
    this.qualityHistory.push({
      quality: quality.score,
      timestamp: performance.now(),
    });

    // Trim history
    if (this.qualityHistory.length > this.config.measureInterval) {
      this.qualityHistory.shift();
    }

    // Calculate average quality
    const avgQuality =
      this.qualityHistory.reduce((sum, h) => sum + h.quality, 0) /
      this.qualityHistory.length;

    let adjustment = 0;
    let reason = "no_change";
    let shouldAdapt = false;

    // Check if below target
    if (avgQuality < this.config.targetQuality * 0.9) {
      // Need to increase quality
      adjustment = this.config.targetQuality - avgQuality;
      reason = "below_target";
      shouldAdapt = true;
    } else if (avgQuality > this.config.targetQuality * 1.1) {
      // Can reduce quality for performance
      adjustment = this.config.targetQuality - avgQuality;
      reason = "above_target";
      shouldAdapt = this.config.adaptFrameRate || this.config.adaptResolution;
    }

    // Check if below minimum
    if (avgQuality < this.config.minQuality) {
      adjustment = this.config.minQuality - avgQuality;
      reason = "below_minimum";
      shouldAdapt = true;
    }

    // Apply adjustment
    if (shouldAdapt) {
      this.currentQuality = Math.max(
        this.config.minQuality,
        Math.min(1.0, this.currentQuality + adjustment)
      );
      this.adaptationCount++;
    }

    return {
      currentQuality: this.currentQuality,
      adjustment,
      reason,
      shouldAdapt,
    };
  }

  /**
   * Get current quality
   */
  getCurrentQuality(): number {
    return this.currentQuality;
  }

  /**
   * Set current quality
   */
  setCurrentQuality(quality: number): void {
    this.currentQuality = Math.max(
      this.config.minQuality,
      Math.min(1.0, quality)
    );
  }

  /**
   * Get quality statistics
   */
  getStats(): {
    currentQuality: number;
    targetQuality: number;
    minQuality: number;
    adaptationCount: number;
    avgQuality: number;
    qualityTrend: "improving" | "stable" | "declining";
  } {
    const avgQuality =
      this.qualityHistory.length > 0
        ? this.qualityHistory.reduce((sum, h) => sum + h.quality, 0) /
          this.qualityHistory.length
        : this.currentQuality;

    let trend: "improving" | "stable" | "declining" = "stable";

    if (this.qualityHistory.length >= 5) {
      const recent = this.qualityHistory.slice(-5);
      const older = this.qualityHistory.slice(-10, -5);

      const recentAvg =
        recent.reduce((sum, h) => sum + h.quality, 0) / recent.length;
      const olderAvg =
        older.length > 0
          ? older.reduce((sum, h) => sum + h.quality, 0) / older.length
          : recentAvg;

      if (recentAvg > olderAvg * 1.05) {
        trend = "improving";
      } else if (recentAvg < olderAvg * 0.95) {
        trend = "declining";
      }
    }

    return {
      currentQuality: this.currentQuality,
      targetQuality: this.config.targetQuality,
      minQuality: this.config.minQuality,
      adaptationCount: this.adaptationCount,
      avgQuality,
      qualityTrend: trend,
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.qualityHistory = [];
    this.currentQuality = this.config.targetQuality;
    this.adaptationCount = 0;
  }
}
