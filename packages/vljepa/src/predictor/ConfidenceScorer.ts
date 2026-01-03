/**
 * @lsi/vljepa/predictor/ConfidenceScorer - Calculate Prediction Confidence
 *
 * Computes confidence scores for VL-JEPA predictions based on
 * semantic alignment between context, intent, and goal embeddings.
 *
 * Confidence metrics:
 * - Cosine similarity: Alignment between goal and intent
 * - Euclidean distance: Magnitude of change required
 * - Semantic coherence: Consistency across embedding dimensions
 *
 * @version 1.0.0
 */

import {
  cosineSimilarity,
  euclideanDistance,
  normalizeEmbedding,
} from "../index.js";

/**
 * Confidence calculation method
 */
export type ConfidenceMethod =
  | "cosine-similarity" // Cosine similarity between goal and intent
  | "euclidean-distance" // Inverse of normalized Euclidean distance
  | "semantic-coherence" // Consistency across dimensions
  | "ensemble"; // Combined score from multiple methods

/**
 * ConfidenceScorer configuration
 */
export interface ConfidenceScorerConfig {
  /** Method for calculating confidence */
  method: ConfidenceMethod;

  /** Threshold for low confidence (0-1) */
  lowConfidenceThreshold: number;

  /** Threshold for high confidence (0-1) */
  highConfidenceThreshold: number;

  /** Weight for cosine similarity in ensemble */
  cosineWeight?: number;

  /** Weight for distance in ensemble */
  distanceWeight?: number;

  /** Weight for coherence in ensemble */
  coherenceWeight?: number;

  /** Whether to normalize embeddings before scoring */
  normalize: boolean;
}

/**
 * Confidence score result
 */
export interface ConfidenceResult {
  /** Overall confidence score (0-1) */
  confidence: number;

  /** Confidence level */
  level: "low" | "medium" | "high";

  /** Individual metric scores */
  metrics: {
    /** Cosine similarity score */
    cosineSimilarity: number;

    /** Normalized Euclidean distance (inverted) */
    euclideanDistance: number;

    /** Semantic coherence score */
    semanticCoherence: number;

    /** Combined ensemble score */
    ensemble: number;
  };

  /** Explanations */
  explanation: {
    /** Primary reason for confidence level */
    primary: string;

    /** Secondary factors */
    secondary: string[];
  };
}

/**
 * Confidence Scorer
 *
 * Computes confidence scores for VL-JEPA predictions.
 * Higher confidence indicates better alignment between predicted goal
 * and user intent.
 *
 * @example
 * ```typescript
 * const scorer = new ConfidenceScorer({ method: "ensemble" });
 * const result = scorer.calculate(goalEmbedding, contextEmbedding, intentEmbedding);
 * console.log(result.confidence); // 0.85
 * console.log(result.level); // "high"
 * ```
 */
export class ConfidenceScorer {
  private config: ConfidenceScorerConfig;

  constructor(config: Partial<ConfidenceScorerConfig> = {}) {
    this.config = {
      method: "ensemble",
      lowConfidenceThreshold: 0.3,
      highConfidenceThreshold: 0.7,
      cosineWeight: 0.5,
      distanceWeight: 0.3,
      coherenceWeight: 0.2,
      normalize: true,
      ...config,
    };

    // Validate ensemble weights sum to 1
    if (this.config.method === "ensemble") {
      const sum =
        (this.config.cosineWeight || 0) +
        (this.config.distanceWeight || 0) +
        (this.config.coherenceWeight || 0);
      if (Math.abs(sum - 1.0) > 0.01) {
        throw new Error(
          `Ensemble weights must sum to 1.0, got ${sum}. ` +
            `cosine=${this.config.cosineWeight}, distance=${this.config.distanceWeight}, ` +
            `coherence=${this.config.coherenceWeight}`
        );
      }
    }
  }

  /**
   * Calculate confidence score
   *
   * @param goalEmbedding - Predicted goal state embedding (768-dim)
   * @param contextEmbedding - Current context embedding (768-dim)
   * @param intentEmbedding - User intent embedding (768-dim)
   * @returns Confidence result
   */
  calculate(
    goalEmbedding: Float32Array,
    contextEmbedding: Float32Array,
    intentEmbedding: Float32Array
  ): ConfidenceResult {
    // Normalize if configured
    let goal = this.config.normalize
      ? normalizeEmbedding(goalEmbedding)
      : goalEmbedding;
    let intent = this.config.normalize
      ? normalizeEmbedding(intentEmbedding)
      : intentEmbedding;
    let context = this.config.normalize
      ? normalizeEmbedding(contextEmbedding)
      : contextEmbedding;

    // Calculate individual metrics
    const cosineScore = this.calculateCosineSimilarity(goal, intent);
    const distanceScore = this.calculateEuclideanDistance(
      goal,
      intent,
      context
    );
    const coherenceScore = this.calculateSemanticCoherence(
      goal,
      intent,
      context
    );
    const ensembleScore = this.calculateEnsemble(
      cosineScore,
      distanceScore,
      coherenceScore
    );

    // Select confidence based on method
    let confidence: number;
    switch (this.config.method) {
      case "cosine-similarity":
        confidence = cosineScore;
        break;
      case "euclidean-distance":
        confidence = distanceScore;
        break;
      case "semantic-coherence":
        confidence = coherenceScore;
        break;
      case "ensemble":
        confidence = ensembleScore;
        break;
      default:
        confidence = ensembleScore;
    }

    // Determine confidence level
    const level = this.getConfidenceLevel(confidence);

    // Generate explanation
    const explanation = this.generateExplanation(
      confidence,
      level,
      cosineScore,
      distanceScore,
      coherenceScore
    );

    return {
      confidence,
      level,
      metrics: {
        cosineSimilarity: cosineScore,
        euclideanDistance: distanceScore,
        semanticCoherence: coherenceScore,
        ensemble: ensembleScore,
      },
      explanation,
    };
  }

  /**
   * Calculate cosine similarity score
   *
   * Higher similarity = better goal-intent alignment = higher confidence
   *
   * @param goal - Goal embedding
   * @param intent - Intent embedding
   * @returns Confidence score (0-1)
   */
  private calculateCosineSimilarity(
    goal: Float32Array,
    intent: Float32Array
  ): number {
    // Cosine similarity is in [-1, 1], transform to [0, 1]
    const similarity = cosineSimilarity(goal, intent);
    return (similarity + 1) / 2;
  }

  /**
   * Calculate normalized Euclidean distance score
   *
   * Smaller distance = less change required = higher confidence
   *
   * @param goal - Goal embedding
   * @param intent - Intent embedding
   * @param context - Context embedding
   * @returns Confidence score (0-1)
   */
  private calculateEuclideanDistance(
    goal: Float32Array,
    intent: Float32Array,
    context: Float32Array
  ): number {
    // Distance from context to intent (desired change)
    const desiredDistance = euclideanDistance(context, intent);

    // Distance from context to goal (predicted change)
    const predictedDistance = euclideanDistance(context, goal);

    // If goal is close to intent, confidence is high
    const difference = Math.abs(desiredDistance - predictedDistance);

    // Normalize: 0 difference = 1 confidence, large difference = 0 confidence
    // Use exponential decay for smooth transition
    return Math.exp(-difference / 10);
  }

  /**
   * Calculate semantic coherence score
   *
   * Measures consistency of semantic direction across dimensions
   *
   * @param goal - Goal embedding
   * @param intent - Intent embedding
   * @param context - Context embedding
   * @returns Confidence score (0-1)
   */
  private calculateSemanticCoherence(
    goal: Float32Array,
    intent: Float32Array,
    context: Float32Array
  ): number {
    // Calculate direction vectors
    const desiredDirection = this.subtract(intent, context);
    const predictedDirection = this.subtract(goal, context);

    // Normalize directions
    const desiredNorm = normalizeEmbedding(desiredDirection);
    const predictedNorm = normalizeEmbedding(predictedDirection);

    // Coherence = alignment of direction vectors
    const alignment = cosineSimilarity(desiredNorm, predictedNorm);

    // Transform to [0, 1]
    return (alignment + 1) / 2;
  }

  /**
   * Calculate ensemble confidence
   *
   * @param cosine - Cosine similarity score
   * @param distance - Euclidean distance score
   * @param coherence - Semantic coherence score
   * @returns Ensemble confidence score
   */
  private calculateEnsemble(
    cosine: number,
    distance: number,
    coherence: number
  ): number {
    const cosineWeight = this.config.cosineWeight || 0.5;
    const distanceWeight = this.config.distanceWeight || 0.3;
    const coherenceWeight = this.config.coherenceWeight || 0.2;

    return (
      cosineWeight * cosine +
      distanceWeight * distance +
      coherenceWeight * coherence
    );
  }

  /**
   * Get confidence level from score
   *
   * @param confidence - Confidence score
   * @returns Confidence level
   */
  private getConfidenceLevel(confidence: number): "low" | "medium" | "high" {
    if (confidence < this.config.lowConfidenceThreshold) {
      return "low";
    } else if (confidence < this.config.highConfidenceThreshold) {
      return "medium";
    } else {
      return "high";
    }
  }

  /**
   * Generate explanation for confidence score
   *
   * @param confidence - Overall confidence
   * @param level - Confidence level
   * @param cosine - Cosine similarity score
   * @param distance - Euclidean distance score
   * @param coherence - Semantic coherence score
   * @returns Explanation object
   */
  private generateExplanation(
    confidence: number,
    level: "low" | "medium" | "high",
    cosine: number,
    distance: number,
    coherence: number
  ): ConfidenceResult["explanation"] {
    const secondary: string[] = [];

    // Add secondary explanations based on metrics
    if (cosine > 0.8) {
      secondary.push("Goal state strongly aligns with user intent");
    } else if (cosine < 0.4) {
      secondary.push("Goal state may not fully match user intent");
    }

    if (distance > 0.8) {
      secondary.push("Predicted changes closely match desired changes");
    } else if (distance < 0.4) {
      secondary.push(
        "Predicted changes differ significantly from desired changes"
      );
    }

    if (coherence > 0.8) {
      secondary.push("Semantic direction is consistent");
    } else if (coherence < 0.4) {
      secondary.push("Semantic direction may be inconsistent");
    }

    // Primary explanation
    let primary: string;
    switch (level) {
      case "high":
        primary = `High confidence (${confidence.toFixed(2)}): Goal state strongly matches user intent`;
        break;
      case "medium":
        primary = `Medium confidence (${confidence.toFixed(2)}): Goal state partially matches user intent`;
        break;
      case "low":
        primary = `Low confidence (${confidence.toFixed(2)}): Goal state may not match user intent`;
        break;
    }

    return { primary, secondary };
  }

  /**
   * Subtract two embeddings
   *
   * @param a - First embedding
   * @param b - Second embedding
   * @returns a - b
   */
  private subtract(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] - b[i];
    }
    return result;
  }

  /**
   * Calculate confidence for batch predictions
   *
   * @param goals - Array of goal embeddings
   * @param contexts - Array of context embeddings
   * @param intents - Array of intent embeddings
   * @returns Array of confidence results
   */
  calculateBatch(
    goals: Float32Array[],
    contexts: Float32Array[],
    intents: Float32Array[]
  ): ConfidenceResult[] {
    if (goals.length !== contexts.length || goals.length !== intents.length) {
      throw new Error("Batch arrays must have the same length");
    }

    const results: ConfidenceResult[] = [];

    for (let i = 0; i < goals.length; i++) {
      results.push(this.calculate(goals[i], contexts[i], intents[i]));
    }

    return results;
  }

  /**
   * Get configuration
   *
   * @returns Current configuration
   */
  getConfig(): ConfidenceScorerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * @param config - New configuration values
   */
  updateConfig(config: Partial<ConfidenceScorerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
