/**
 * @fileoverview Early stopping callback for training
 * @package @lsi/vljepa-training
 */

import type { EarlyStoppingConfig, TrainingMetrics } from "../types.js";

/**
 * Early stopping callback for training
 *
 * Stops training when a monitored metric has stopped improving.
 * Features:
 * - Monitor training or validation metrics
 * - Patience for epochs without improvement
 * - Minimum delta for improvement
 * - Restore best weights on stop
 */
export class EarlyStopping {
  private config: EarlyStoppingConfig;
  private bestValue: number | null = null;
  private wait = 0;
  private bestEpoch = 0;
  private stoppedEpoch = 0;
  private bestMetrics: TrainingMetrics | null = null;

  constructor(config: EarlyStoppingConfig) {
    this.config = config;
  }

  /**
   * Check if training should stop
   */
  check(metrics: TrainingMetrics): boolean {
    const current = this.getMonitorValue(metrics);

    if (current === null) {
      return false;
    }

    // Initialize best value on first call
    if (this.bestValue === null) {
      this.bestValue = current;
      this.bestEpoch = metrics.epoch;
      this.bestMetrics = metrics;
      return false;
    }

    // Check if improvement
    const improved = this.isImproved(current, this.bestValue);

    if (improved) {
      this.bestValue = current;
      this.bestEpoch = metrics.epoch;
      this.bestMetrics = metrics;
      this.wait = 0;
      console.log(
        `[EarlyStopping] Improvement: ${this.config.monitor} = ${current.toFixed(6)} ` +
          `(epoch ${metrics.epoch})`
      );
    } else {
      this.wait++;
      console.log(
        `[EarlyStopping] No improvement: ${this.config.monitor} = ${current.toFixed(6)} ` +
          `(best: ${this.bestValue.toFixed(6)}, wait: ${this.wait}/${this.config.patience})`
      );
    }

    // Check if should stop
    if (this.wait >= this.config.patience) {
      this.stoppedEpoch = metrics.epoch;
      console.log(
        `[EarlyStopping] Stopping early: No improvement for ${this.wait} epochs ` +
          `(best epoch: ${this.bestEpoch}, stopped at: ${this.stoppedEpoch})`
      );
      return true;
    }

    return false;
  }

  /**
   * Get monitored value from metrics
   */
  private getMonitorValue(metrics: TrainingMetrics): number | null {
    switch (this.config.monitor) {
      case "val_loss":
        return metrics.loss.validation;
      case "val_accuracy":
        return metrics.accuracy.top1 || null;
      case "preference_accuracy":
        return metrics.accuracy.preference || null;
      case "training_loss":
        return metrics.loss.training;
      default:
        return null;
    }
  }

  /**
   * Check if current value is improved over best
   */
  private isImproved(current: number, best: number): boolean {
    const delta = Math.abs(current - best);

    // Check if change exceeds minimum delta
    if (delta < this.config.minDelta) {
      return false;
    }

    // Check mode
    if (this.config.mode === "min") {
      return current < best;
    } else {
      return current > best;
    }
  }

  /**
   * Get best metrics
   */
  getBestMetrics(): TrainingMetrics | null {
    return this.bestMetrics;
  }

  /**
   * Get best epoch
   */
  getBestEpoch(): number {
    return this.bestEpoch;
  }

  /**
   * Get stopped epoch
   */
  getStoppedEpoch(): number {
    return this.stoppedEpoch;
  }

  /**
   * Get best value
   */
  getBestValue(): number | null {
    return this.bestValue;
  }

  /**
   * Get current wait count
   */
  getWait(): number {
    return this.wait;
  }

  /**
   * Reset early stopping state
   */
  reset(): void {
    this.bestValue = null;
    this.wait = 0;
    this.bestEpoch = 0;
    this.stoppedEpoch = 0;
    this.bestMetrics = null;
    console.log("[EarlyStopping] Reset state");
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.config.enabled;
  }
}
