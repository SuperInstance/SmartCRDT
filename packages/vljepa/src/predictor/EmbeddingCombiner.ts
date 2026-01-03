/**
 * @lsi/vljepa/predictor/EmbeddingCombiner - Combine X and Y Embeddings
 *
 * Combines vision (X-Encoder) and language (Y-Encoder) embeddings
 * into a unified representation for prediction.
 *
 * ========================================================================
 * WHY COMBINE EMBEDDINGS?
 * ========================================================================
 *
 * VL-JEPA's core insight is that BOTH visual and textual information are
 * needed to predict the goal state. The combiner merges these two modalities:
 *
 * - X-Encoder output: "What the UI looks like" (768-dim)
 * - Y-Encoder output: "What the user wants" (768-dim)
 * - Combined: "What the UI should become" (768 or 1536-dim)
 *
 * ========================================================================
 * COMBINATION STRATEGIES
 * ========================================================================
 *
 * 1. CONCATENATE (Default: 1536-dim)
 *    output = [vision[0..767], intent[0..767]]
 *
 *    Pros:
 *    - Preserves all information from both embeddings
 *    - No loss of semantic content
 *    - Predictor can learn complex relationships
 *
 *    Cons:
 *    - Larger input to predictor (2x parameters)
 *    - More computation
 *
 *    Best when: Vision and intent provide different, complementary info
 *
 * ========================================================================
 *
 * 2. ADD (768-dim)
 *    output[i] = vision[i] + intent[i]
 *
 *    Pros:
 *    - Maintains 768-dim size (efficient)
 *    - Element-wise fusion
 *    - Faster computation
 *
 *    Cons:
 *    - May lose information if embeddings conflict
 *    - Assumes aligned dimensions
 *
 *    Best when: Vision and intent reinforce each other
 *
 * ========================================================================
 *
 * 3. WEIGHTED-SUM (768-dim)
 *    output[i] = α * vision[i] + β * intent[i]
 *    where α + β = 1
 *
 *    Pros:
 *    - Controls contribution of each modality
 *    - Maintains 768-dim size
 *    - Learnable weights during training
 *
 *    Cons:
 *    - Need to tune weights
 *    - Static weights may not fit all cases
 *
 *    Best when: One modality is more reliable than the other
 *
 * ========================================================================
 * STRATEGY SELECTION GUIDE
 * ========================================================================
 *
 * Use CONCATENATE when:
 * - You want maximum information preservation
 * - Predictor has enough capacity
 * - Training data is abundant
 *
 * Use ADD when:
 * - You want efficiency
 * - Embeddings are already aligned
 * - Vision and intent are complementary
 *
 * Use WEIGHTED-SUM when:
 * - One modality dominates
 * - You need control over fusion
 * - You want to learn weights during training
 *
 * @version 1.0.0
 */

import type { PredictorConfig } from "../protocol.js";
import {
  validateEmbeddingDimension,
  EmbeddingDimensionError,
} from "../index.js";

/**
 * Combination strategy for X and Y embeddings
 */
export type CombinationStrategy = "concatenate" | "add" | "weighted-sum";

/**
 * EmbeddingCombiner configuration
 */
export interface EmbeddingCombinerConfig {
  /** Strategy for combining embeddings */
  strategy: CombinationStrategy;

  /** Weight for vision embedding (only for weighted-sum) */
  visionWeight?: number;

  /** Weight for language embedding (only for weighted-sum) */
  languageWeight?: number;

  /** Whether to normalize embeddings before combining */
  normalize?: boolean;

  /** Whether to use learned weights (future: train weights) */
  useLearnedWeights?: boolean;
}

/**
 * Embedding Combiner
 *
 * Combines vision (X-Encoder) and language (Y-Encoder) embeddings
 * into a unified representation for the predictor.
 *
 * @example
 * ```typescript
 * const combiner = new EmbeddingCombiner({ strategy: "concatenate" });
 * const combined = combiner.combine(visionEmbedding, languageEmbedding);
 * ```
 */
export class EmbeddingCombiner {
  private config: EmbeddingCombinerConfig;
  private embeddingDim: number = 768;

  // Learned weights (for future training)
  private learnedVisionWeight: number = 0.5;
  private learnedLanguageWeight: number = 0.5;

  constructor(config: EmbeddingCombinerConfig = { strategy: "concatenate" }) {
    this.config = {
      visionWeight: 0.5,
      languageWeight: 0.5,
      normalize: false,
      useLearnedWeights: false,
      ...config,
    };

    // Validate weights sum to 1 for weighted-sum
    if (this.config.strategy === "weighted-sum") {
      const sum =
        (this.config.visionWeight || 0) + (this.config.languageWeight || 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new Error(
          `Weights must sum to 1.0, got ${sum}. ` +
            `visionWeight=${this.config.visionWeight}, languageWeight=${this.config.languageWeight}`
        );
      }
    }
  }

  /**
   * Combine two embeddings
   *
   * @param xEmbedding - Vision embedding (768-dim)
   * @param yEmbedding - Language embedding (768-dim)
   * @returns Combined embedding (768-dim or 1536-dim)
   * @throws {EmbeddingDimensionError} If dimensions are incorrect
   */
  combine(xEmbedding: Float32Array, yEmbedding: Float32Array): Float32Array {
    // Validate input dimensions
    validateEmbeddingDimension(xEmbedding, this.embeddingDim);
    validateEmbeddingDimension(yEmbedding, this.embeddingDim);

    // Normalize if configured
    let x = this.config.normalize ? this.normalize(xEmbedding) : xEmbedding;
    let y = this.config.normalize ? this.normalize(yEmbedding) : yEmbedding;

    // Combine based on strategy
    switch (this.config.strategy) {
      case "concatenate":
        return this.concatenate(x, y);
      case "add":
        return this.add(x, y);
      case "weighted-sum":
        return this.weightedSum(x, y);
      default:
        throw new Error(
          `Unknown combination strategy: ${this.config.strategy}`
        );
    }
  }

  /**
   * Concatenate embeddings (768 + 768 = 1536)
   *
   * @param x - Vision embedding (768-dim)
   * @param y - Language embedding (768-dim)
   * @returns Concatenated embedding (1536-dim)
   */
  private concatenate(x: Float32Array, y: Float32Array): Float32Array {
    const combined = new Float32Array(this.embeddingDim * 2);
    combined.set(x, 0);
    combined.set(y, this.embeddingDim);
    return combined;
  }

  /**
   * Add embeddings element-wise (768)
   *
   * @param x - Vision embedding (768-dim)
   * @param y - Language embedding (768-dim)
   * @returns Added embedding (768-dim)
   */
  private add(x: Float32Array, y: Float32Array): Float32Array {
    const result = new Float32Array(this.embeddingDim);
    for (let i = 0; i < this.embeddingDim; i++) {
      result[i] = x[i] + y[i];
    }
    return result;
  }

  /**
   * Weighted sum of embeddings (768)
   *
   * @param x - Vision embedding (768-dim)
   * @param y - Language embedding (768-dim)
   * @returns Weighted sum embedding (768-dim)
   */
  private weightedSum(x: Float32Array, y: Float32Array): Float32Array {
    const visionWeight = this.config.useLearnedWeights
      ? this.learnedVisionWeight
      : this.config.visionWeight || 0.5;
    const languageWeight = this.config.useLearnedWeights
      ? this.learnedLanguageWeight
      : this.config.languageWeight || 0.5;

    const result = new Float32Array(this.embeddingDim);
    for (let i = 0; i < this.embeddingDim; i++) {
      result[i] = visionWeight * x[i] + languageWeight * y[i];
    }
    return result;
  }

  /**
   * Normalize embedding to unit length
   *
   * @param embedding - Embedding to normalize
   * @returns Normalized embedding
   */
  private normalize(embedding: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);

    if (norm < 1e-8) {
      return new Float32Array(embedding.length);
    }

    const normalized = new Float32Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      normalized[i] = embedding[i] / norm;
    }
    return normalized;
  }

  /**
   * Get the output dimension based on strategy
   *
   * @returns Output embedding dimension
   */
  getOutputDim(): number {
    switch (this.config.strategy) {
      case "concatenate":
        return this.embeddingDim * 2; // 1536
      case "add":
      case "weighted-sum":
        return this.embeddingDim; // 768
      default:
        throw new Error(
          `Unknown combination strategy: ${this.config.strategy}`
        );
    }
  }

  /**
   * Update learned weights (for training)
   *
   * @param visionWeight - New weight for vision
   * @param languageWeight - New weight for language
   */
  updateLearnedWeights(visionWeight: number, languageWeight: number): void {
    // Normalize weights to sum to 1
    const sum = visionWeight + languageWeight;
    this.learnedVisionWeight = visionWeight / sum;
    this.learnedLanguageWeight = languageWeight / sum;
  }

  /**
   * Get current learned weights
   *
   * @returns Current learned weights
   */
  getLearnedWeights(): { vision: number; language: number } {
    return {
      vision: this.learnedVisionWeight,
      language: this.learnedLanguageWeight,
    };
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  getConfig(): EmbeddingCombinerConfig {
    return { ...this.config };
  }

  /**
   * Create from PredictorConfig
   *
   * @param predictorConfig - Predictor configuration
   * @returns EmbeddingCombiner instance
   */
  static fromPredictorConfig(
    predictorConfig: PredictorConfig
  ): EmbeddingCombiner {
    // Determine strategy based on input dimension
    let strategy: CombinationStrategy = "concatenate";
    if (predictorConfig.inputDim === 768) {
      strategy = "add"; // or "weighted-sum"
    } else if (predictorConfig.inputDim === 1536) {
      strategy = "concatenate";
    }

    return new EmbeddingCombiner({ strategy });
  }
}
