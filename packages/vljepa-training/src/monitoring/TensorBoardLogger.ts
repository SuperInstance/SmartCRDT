/**
 * @fileoverview TensorBoard integration for training monitoring
 * @package @lsi/vljepa-training
 */

import type { TensorBoardConfig, TrainingMetrics } from "../types.js";
import { mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

/**
 * TensorBoard logger for training metrics
 *
 * Provides:
 * - Scalar logging (loss, accuracy, LR, etc.)
 * - Histogram logging (weights, gradients)
 * - Image logging (samples, attention maps)
 * - Graph logging (model architecture)
 * - Hyperparameter logging
 */
export class TensorBoardLogger {
  private config: TensorBoardConfig;
  private logDir: string;
  private currentStep = 0;
  private isEnabled: boolean;

  constructor(config: TensorBoardConfig) {
    this.config = config;
    this.logDir = config.logDir;
    this.isEnabled = config.enabled;
  }

  /**
   * Initialize TensorBoard writer
   */
  async initialize(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    // Create log directory if it doesn't exist
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
    }

    console.log(`[TensorBoard] Logging to ${this.logDir}`);
  }

  /**
   * Log a scalar metric
   */
  logScalar(tag: string, value: number, step: number): void {
    if (!this.isEnabled) return;

    console.log(`[TensorBoard] Scalar: ${tag} = ${value} at step ${step}`);

    // In a real implementation, this would write to TensorBoard event file
    this.currentStep = step;
  }

  /**
   * Log multiple scalars at once
   */
  logScalars(scalars: Record<string, number>, step: number): void {
    if (!this.isEnabled) return;

    for (const [tag, value] of Object.entries(scalars)) {
      this.logScalar(tag, value, step);
    }
  }

  /**
   * Log a histogram (e.g., weights, gradients)
   */
  logHistogram(tag: string, values: number[], step: number): void {
    if (!this.isEnabled) return;

    const stats = this.computeHistogramStats(values);
    console.log(`[TensorBoard] Histogram: ${tag} at step ${step}`, stats);

    // In a real implementation, this would write histogram data to TensorBoard
  }

  /**
   * Log an image (e.g., attention map, sample)
   */
  logImage(
    tag: string,
    imageData: {
      data: number[];
      shape: [number, number, number?];
    },
    step: number
  ): void {
    if (!this.isEnabled) return;

    console.log(
      `[TensorBoard] Image: ${tag} at step ${step}, shape: ${imageData.shape}`
    );

    // In a real implementation, this would encode and write image to TensorBoard
  }

  /**
   * Log model graph
   */
  logGraph(model: { name: string; layers: string[] }): void {
    if (!this.isEnabled || !this.config.logGraph) return;

    console.log(
      `[TensorBoard] Graph: ${model.name} with ${model.layers.length} layers`
    );

    // In a real implementation, this would serialize and write model graph
  }

  /**
   * Log hyperparameters
   */
  logHyperparams(params: Record<string, unknown>): void {
    if (!this.isEnabled || !this.config.logHyperparams) return;

    console.log("[TensorBoard] Hyperparameters:", params);

    // In a real implementation, this would write hyperparameters to TensorBoard
  }

  /**
   * Log training metrics
   */
  logMetrics(metrics: TrainingMetrics): void {
    if (!this.isEnabled) return;

    const step = metrics.epoch;

    // Log scalars
    if (this.config.scalars.includes("loss")) {
      this.logScalar("loss/training", metrics.loss.training, step);
      this.logScalar("loss/validation", metrics.loss.validation, step);
    }

    if (this.config.scalars.includes("accuracy") && metrics.accuracy.top1) {
      this.logScalar("accuracy/top1", metrics.accuracy.top1, step);
    }

    if (this.config.scalars.includes("learning_rate")) {
      this.logScalar("learning_rate", metrics.learning.learningRate, step);
    }

    if (this.config.scalars.includes("latency")) {
      this.logScalar("latency/forward", metrics.latency.forward, step);
      this.logScalar("latency/backward", metrics.latency.backward, step);
    }

    if (this.config.scalars.includes("memory")) {
      this.logScalar("memory/gpu", metrics.memory.gpu, step);
      this.logScalar("memory/cpu", metrics.memory.cpu, step);
    }

    if (this.config.scalars.includes("throughput")) {
      this.logScalar("throughput", metrics.throughput, step);
    }
  }

  /**
   * Flush any pending writes
   */
  async flush(): Promise<void> {
    if (!this.isEnabled) return;

    console.log("[TensorBoard] Flushing writes...");
  }

  /**
   * Close the logger
   */
  async close(): Promise<void> {
    if (!this.isEnabled) return;

    await this.flush();
    console.log("[TensorBoard] Logger closed");
  }

  /**
   * Compute histogram statistics
   */
  private computeHistogramStats(values: number[]): {
    min: number;
    max: number;
    mean: number;
    std: number;
    count: number;
  } {
    const count = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((a, b) => a + b, 0) / count;
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const std = Math.sqrt(variance);

    return { min, max, mean, std, count };
  }

  /**
   * Get current step
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.isEnabled;
  }
}
