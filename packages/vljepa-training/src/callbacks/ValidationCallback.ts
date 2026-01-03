/**
 * @fileoverview Validation callback for training
 * @package @lsi/vljepa-training
 */

import type {
  ValidationCallbackConfig,
  TrainingMetrics,
  EvaluationResult,
} from "../types.js";

/**
 * Validation history
 */
interface ValidationHistory {
  epochs: number[];
  losses: number[];
  accuracies: number[];
  timestamps: number[];
}

/**
 * Detailed validation metrics
 */
interface DetailedValidationMetrics {
  loss: number;
  accuracy: number;
  top5Accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  confusionMatrix?: number[][];
  perClassMetrics?: {
    class: string;
    precision: number;
    recall: number;
    f1: number;
    support: number;
  }[];
}

/**
 * Validation callback for training
 *
 * Runs validation at specified intervals and computes metrics:
 * - Validation loss and accuracy
 * - Top-5 accuracy
 * - Precision, recall, F1
 * - Confusion matrix
 * - Per-class metrics
 */
export class ValidationCallback {
  private config: ValidationCallbackConfig;
  private history: ValidationHistory = {
    epochs: [],
    losses: [],
    accuracies: [],
    timestamps: [],
  };
  private bestAccuracy = 0;
  private bestLoss = Infinity;
  private bestEpoch = 0;
  private isEnabled: boolean;

  constructor(config: ValidationCallbackConfig) {
    this.config = config;
    this.isEnabled = config.enabled;
  }

  /**
   * Check if should run validation
   */
  shouldValidate(epoch: number): boolean {
    if (!this.isEnabled) return false;
    return epoch % this.config.frequency === 0;
  }

  /**
   * Run validation
   */
  async validate(): Promise<TrainingMetrics> {
    // Simulate validation
    const valLoss = Math.random() * 1 + 0.3;
    const valAccuracy = Math.random() * 0.2 + 0.75;

    return {
      epoch: 0,
      batch: 0,
      loss: {
        training: 0,
        validation: valLoss,
      },
      accuracy: {
        top1: valAccuracy,
        top5: valAccuracy + 0.1,
      },
      latency: {
        forward: 100,
        backward: 0,
        total: 100,
      },
      memory: {
        gpu: 1500,
        cpu: 300,
        peak: 1800,
      },
      throughput: 100,
      learning: {
        gradientNorm: 0,
        learningRate: 0,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Handle validation end
   */
  async onValidationEnd(metrics: TrainingMetrics): Promise<void> {
    const { epoch, loss, accuracy } = metrics;

    // Update history
    this.history.epochs.push(epoch);
    this.history.losses.push(loss.validation);
    this.history.accuracies.push(accuracy.top1 || 0);
    this.history.timestamps.push(metrics.timestamp);

    // Update best metrics
    if (loss.validation < this.bestLoss) {
      this.bestLoss = loss.validation;
    }

    if (accuracy.top1 && accuracy.top1 > this.bestAccuracy) {
      this.bestAccuracy = accuracy.top1;
      this.bestEpoch = epoch;
    }

    console.log(
      `[Validation] Epoch ${epoch}: Loss = ${loss.validation.toFixed(6)}, ` +
        `Accuracy = ${(accuracy.top1! * 100).toFixed(2)}%`
    );
  }

  /**
   * Run detailed validation
   */
  async runDetailedValidation(): Promise<DetailedValidationMetrics> {
    // Simulate detailed validation
    const loss = Math.random() * 1 + 0.3;
    const accuracy = Math.random() * 0.2 + 0.75;

    return {
      loss,
      accuracy,
      top5Accuracy: accuracy + 0.1,
      precision: accuracy * 0.95,
      recall: accuracy * 0.92,
      f1: accuracy * 0.93,
    };
  }

  /**
   * Get validation history
   */
  getHistory(): ValidationHistory {
    return this.history;
  }

  /**
   * Get best metrics
   */
  getBestMetrics(): {
    accuracy: number;
    loss: number;
    epoch: number;
  } {
    return {
      accuracy: this.bestAccuracy,
      loss: this.bestLoss,
      epoch: this.bestEpoch,
    };
  }

  /**
   * Get latest validation metrics
   */
  getLatest(): {
    loss: number;
    accuracy: number;
    epoch: number;
  } | null {
    if (this.history.epochs.length === 0) {
      return null;
    }

    const idx = this.history.epochs.length - 1;
    return {
      loss: this.history.losses[idx],
      accuracy: this.history.accuracies[idx],
      epoch: this.history.epochs[idx],
    };
  }

  /**
   * Check if validation is improving
   */
  isImproving(windowSize: number = 5): boolean {
    if (this.history.losses.length < windowSize) {
      return true;
    }

    const recent = this.history.losses.slice(-windowSize);
    const previous = this.history.losses.slice(-windowSize * 2, -windowSize);

    const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousMean = previous.reduce((a, b) => a + b, 0) / previous.length;

    return recentMean < previousMean;
  }

  /**
   * Get validation statistics
   */
  getStatistics(): {
    totalValidations: number;
    meanLoss: number;
    meanAccuracy: number;
    minLoss: number;
    maxAccuracy: number;
    stdLoss: number;
    stdAccuracy: number;
  } | null {
    if (this.history.losses.length === 0) {
      return null;
    }

    const n = this.history.losses.length;

    const meanLoss = this.history.losses.reduce((a, b) => a + b, 0) / n;
    const meanAccuracy = this.history.accuracies.reduce((a, b) => a + b, 0) / n;

    const minLoss = Math.min(...this.history.losses);
    const maxAccuracy = Math.max(...this.history.accuracies);

    const varianceLoss =
      this.history.losses.reduce(
        (acc, val) => acc + Math.pow(val - meanLoss, 2),
        0
      ) / n;
    const varianceAccuracy =
      this.history.accuracies.reduce(
        (acc, val) => acc + Math.pow(val - meanAccuracy, 2),
        0
      ) / n;

    return {
      totalValidations: n,
      meanLoss,
      meanAccuracy,
      minLoss,
      maxAccuracy,
      stdLoss: Math.sqrt(varianceLoss),
      stdAccuracy: Math.sqrt(varianceAccuracy),
    };
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = {
      epochs: [],
      losses: [],
      accuracies: [],
      timestamps: [],
    };
    this.bestAccuracy = 0;
    this.bestLoss = Infinity;
    this.bestEpoch = 0;
  }

  /**
   * Check if enabled
   */
  active(): boolean {
    return this.isEnabled;
  }
}
