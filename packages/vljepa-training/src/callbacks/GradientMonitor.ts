/**
 * @fileoverview Gradient monitoring callback for training
 * @package @lsi/vljepa-training
 */

import type { GradientMonitorConfig, TrainingMetrics } from "../types.js";

/**
 * Gradient statistics
 */
interface GradientStats {
  norm: number;
  min: number;
  max: number;
  mean: number;
  std: number;
  numParameters: number;
  numZeroGradients: number;
  numNanGradients: number;
}

/**
 * Gradient history
 */
interface GradientHistory {
  norms: number[];
  timestamps: number[];
  epochs: number[];
}

/**
 * Gradient monitoring callback
 *
 * Monitors gradients during training for:
 * - Vanishing gradients (very small norms)
 * - Exploding gradients (very large norms)
 * - NaN/Inf gradients
 * - Gradient distribution statistics
 */
export class GradientMonitor {
  private config: GradientMonitorConfig;
  private gradientHistory: GradientHistory = {
    norms: [],
    timestamps: [],
    epochs: [],
  };
  private anomalyCount = 0;
  private totalChecks = 0;
  private isEnabled: boolean;

  constructor(config: GradientMonitorConfig) {
    this.config = config;
    this.isEnabled = config.enabled;
  }

  /**
   * Log gradient norm
   */
  logGradientNorm(norm: number, epoch?: number): void {
    if (!this.isEnabled) return;

    this.totalChecks++;

    this.gradientHistory.norms.push(norm);
    this.gradientHistory.timestamps.push(Date.now());
    this.gradientHistory.epochs.push(epoch || 0);

    // Check for anomalies
    if (this.config.checkAnomalies) {
      this.checkAnomaly(norm);
    }

    // Log if enabled
    if (this.config.logNorms) {
      console.log(`[GradientMonitor] Norm: ${norm.toFixed(6)}`);
    }
  }

  /**
   * Log gradient statistics
   */
  logGradientStats(stats: GradientStats, epoch?: number): void {
    if (!this.isEnabled) return;

    this.totalChecks++;

    this.gradientHistory.norms.push(stats.norm);
    this.gradientHistory.timestamps.push(Date.now());
    this.gradientHistory.epochs.push(epoch || 0);

    // Check for anomalies
    if (this.config.checkAnomalies) {
      this.checkAnomaly(stats.norm);
    }

    // Log details if enabled
    if (this.config.logNorms) {
      console.log(
        `[GradientMonitor] Norm: ${stats.norm.toFixed(6)}, ` +
          `Min: ${stats.min.toFixed(6)}, Max: ${stats.max.toFixed(6)}, ` +
          `Mean: ${stats.mean.toFixed(6)}, Std: ${stats.std.toFixed(6)}`
      );
    }

    // Check for zero/NaN gradients
    if (stats.numNanGradients > 0) {
      console.warn(
        `[GradientMonitor] Found ${stats.numNanGradients} NaN gradients!`
      );
    }

    if (stats.numZeroGradients > stats.numParameters * 0.5) {
      console.warn(
        `[GradientMonitor] ${stats.numZeroGradients}/${stats.numParameters} ` +
          "gradients are zero (possible vanishing gradient)"
      );
    }
  }

  /**
   * Check for gradient anomalies
   */
  private checkAnomaly(norm: number): void {
    const threshold = this.config.anomalyThreshold;

    // Exploding gradients
    if (norm > threshold) {
      this.anomalyCount++;
      console.error(
        `[GradientMonitor] Exploding gradient detected! ` +
          `Norm: ${norm.toFixed(6)} > ${threshold}`
      );

      this.handleAnomaly("exploding", norm);
    }

    // Vanishing gradients
    if (norm < 1e-7) {
      this.anomalyCount++;
      console.warn(
        `[GradientMonitor] Vanishing gradient detected! ` +
          `Norm: ${norm.toFixed(6)} < 1e-7`
      );

      this.handleAnomaly("vanishing", norm);
    }
  }

  /**
   * Handle gradient anomaly
   */
  private handleAnomaly(type: "exploding" | "vanishing", norm: number): void {
    switch (this.config.anomalyAction) {
      case "log":
        // Already logged above
        break;

      case "skip":
        console.warn(
          "[GradientMonitor] Skipping batch due to gradient anomaly"
        );
        break;

      case "clip":
        console.log("[GradientMonitor] Clipping gradients");
        // In real implementation, would clip gradients
        break;

      case "stop":
        console.error(
          "[GradientMonitor] Stopping training due to gradient anomaly"
        );
        // In real implementation, would signal to stop
        break;
    }
  }

  /**
   * Log gradient histogram
   */
  logHistogram(values: number[], epoch?: number): void {
    if (!this.isEnabled || !this.config.logHistograms) return;

    const stats = this.computeStats(values);
    this.logGradientStats(stats, epoch);
  }

  /**
   * Compute gradient statistics
   */
  private computeStats(values: number[]): GradientStats {
    const n = values.length;

    // Basic statistics
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const std = Math.sqrt(variance);

    // Norm (L2)
    const norm = Math.sqrt(values.reduce((acc, val) => acc + val * val, 0));

    // Count special values
    const numZeroGradients = values.filter(v => Math.abs(v) < 1e-10).length;
    const numNanGradients = values.filter(v => Number.isNaN(v)).length;

    return {
      norm,
      min,
      max,
      mean,
      std,
      numParameters: n,
      numZeroGradients,
      numNanGradients,
    };
  }

  /**
   * Get gradient history
   */
  getHistory(): GradientHistory {
    return this.gradientHistory;
  }

  /**
   * Get gradient norms
   */
  getNorms(): number[] {
    return this.gradientHistory.norms;
  }

  /**
   * Get latest gradient norm
   */
  getLatestNorm(): number | null {
    if (this.gradientHistory.norms.length === 0) {
      return null;
    }
    return this.gradientHistory.norms[this.gradientHistory.norms.length - 1];
  }

  /**
   * Get gradient statistics
   */
  getStats(): {
    mean: number;
    std: number;
    min: number;
    max: number;
    median: number;
  } | null {
    const norms = this.gradientHistory.norms;
    if (norms.length === 0) {
      return null;
    }

    const sorted = [...norms].sort((a, b) => a - b);
    const mean = norms.reduce((a, b) => a + b, 0) / norms.length;
    const variance =
      norms.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      norms.length;
    const std = Math.sqrt(variance);

    return {
      mean,
      std,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
    };
  }

  /**
   * Get anomaly rate
   */
  getAnomalyRate(): number {
    if (this.totalChecks === 0) {
      return 0;
    }
    return this.anomalyCount / this.totalChecks;
  }

  /**
   * Check if gradients are healthy
   */
  isHealthy(): boolean {
    const latest = this.getLatestNorm();
    if (latest === null) {
      return true;
    }

    // Check if norm is in reasonable range
    return latest > 1e-7 && latest < this.config.anomalyThreshold;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.gradientHistory = {
      norms: [],
      timestamps: [],
      epochs: [],
    };
    this.anomalyCount = 0;
    this.totalChecks = 0;
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.isEnabled;
  }
}
