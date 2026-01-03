/**
 * Loss Functions
 *
 * JEPA-specific loss functions including:
 * - Embedding loss (cosine, MSE, Huber, Smooth L1)
 * - Consistency loss for temporal stability
 * - Auxiliary loss for reconstruction
 */

import type { JEPALossConfig } from "../types.js";

export class LossFunctions {
  private config: JEPALossConfig;

  constructor(config: JEPALossConfig) {
    this.config = config;
  }

  /**
   * Calculate embedding loss
   */
  calculateEmbeddingLoss(
    target: Float32Array,
    prediction: Float32Array
  ): number {
    switch (this.config.embeddingLoss) {
      case "cosine":
        return this.cosineLoss(target, prediction);
      case "mse":
        return this.mse(target, prediction);
      case "huber":
        return this.huberLoss(target, prediction);
      case "smooth_l1":
        return this.smoothL1Loss(target, prediction);
      default:
        return this.cosineLoss(target, prediction);
    }
  }

  /**
   * Cosine similarity loss (1 - cosine similarity)
   */
  private cosineLoss(target: Float32Array, prediction: Float32Array): number {
    const similarity = this.cosineSimilarity(target, prediction);
    return 1 - similarity;
  }

  /**
   * Mean squared error
   */
  private mse(target: Float32Array, prediction: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < Math.min(target.length, prediction.length); i++) {
      const diff = target[i] - prediction[i];
      sum += diff * diff;
    }
    return sum / target.length;
  }

  /**
   * Huber loss (less sensitive to outliers)
   */
  private huberLoss(
    target: Float32Array,
    prediction: Float32Array,
    delta: number = 1.0
  ): number {
    let sum = 0;
    for (let i = 0; i < Math.min(target.length, prediction.length); i++) {
      const diff = Math.abs(target[i] - prediction[i]);
      if (diff <= delta) {
        sum += 0.5 * diff * diff;
      } else {
        sum += delta * (diff - 0.5 * delta);
      }
    }
    return sum / target.length;
  }

  /**
   * Smooth L1 loss
   */
  private smoothL1Loss(target: Float32Array, prediction: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < Math.min(target.length, prediction.length); i++) {
      const diff = target[i] - prediction[i];
      const absDiff = Math.abs(diff);
      if (absDiff < 1) {
        sum += 0.5 * diff * diff;
      } else {
        sum += absDiff - 0.5;
      }
    }
    return sum / target.length;
  }

  /**
   * Calculate consistency loss (for temporal stability)
   */
  calculateConsistencyLoss(
    prediction1: Float32Array,
    prediction2: Float32Array
  ): number {
    // Consistency: predictions from similar contexts should be similar
    const similarity = this.cosineSimilarity(prediction1, prediction2);
    return 1 - similarity;
  }

  /**
   * Calculate auxiliary loss (reconstruction)
   */
  calculateAuxiliaryLoss(
    target: Float32Array,
    prediction: Float32Array
  ): number {
    // Simple MSE for reconstruction
    return this.mse(target, prediction);
  }

  /**
   * Calculate total JEPA loss
   */
  calculateTotalLoss(
    target: Float32Array,
    prediction: Float32Array,
    auxiliaryPrediction?: Float32Array
  ): {
    total: number;
    embedding: number;
    consistency: number;
    auxiliary: number;
  } {
    const embeddingLoss = this.calculateEmbeddingLoss(target, prediction);
    const consistencyLoss = this.calculateConsistencyLoss(
      prediction,
      this.augment(target)
    );
    const auxiliaryLoss = auxiliaryPrediction
      ? this.calculateAuxiliaryLoss(target, auxiliaryPrediction)
      : 0;

    const total =
      this.config.predictionWeight * embeddingLoss +
      this.config.consistencyWeight * consistencyLoss +
      this.config.auxiliaryWeight * auxiliaryLoss;

    return {
      total,
      embedding: embeddingLoss,
      consistency: consistencyLoss,
      auxiliary: auxiliaryLoss,
    };
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm > 0 ? dotProduct / norm : 0;
  }

  /**
   * Create augmented version of embedding (for consistency)
   */
  private augment(embedding: Float32Array): Float32Array {
    const augmented = new Float32Array(embedding.length);

    for (let i = 0; i < embedding.length; i++) {
      augmented[i] =
        embedding[i] + (Math.random() - 0.5) * this.config.temperature;
    }

    // Normalize
    const norm = Math.sqrt(augmented.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < augmented.length; i++) {
        augmented[i] /= norm;
      }
    }

    return augmented;
  }

  /**
   * Get configuration
   */
  getConfig(): JEPALossConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<JEPALossConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
