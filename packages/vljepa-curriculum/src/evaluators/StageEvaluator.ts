/**
 * Stage Evaluator
 *
 * Base evaluator for curriculum stage predictions with:
 * - Similarity metrics
 * - Accuracy calculations
 * - Mastery assessment
 */

import type {
  StageEvaluator as IStageEvaluator,
  TrainingExample,
  EvaluationResult,
  BatchEvaluationResult,
  StageProgress,
} from "../types.js";

export class StageEvaluator implements IStageEvaluator {
  /**
   * Evaluate single prediction
   */
  evaluate(
    example: TrainingExample,
    prediction: Float32Array
  ): EvaluationResult {
    const target = example.embedding;
    const similarity = this.cosineSimilarity(target, prediction);
    const mse = this.mse(target, prediction);
    const euclidean = this.euclideanDistance(target, prediction);

    // Accuracy is inversely related to distance
    const accuracy = Math.max(0, 1 - euclidean / 10);

    // Confidence based on similarity
    const confidence = similarity > 0.8 ? similarity : similarity * 0.9;

    return {
      loss: mse,
      accuracy,
      confidence,
      metrics: {
        cosine_similarity: similarity,
        mse,
        euclidean_distance: euclidean,
      },
    };
  }

  /**
   * Evaluate batch of predictions
   */
  batchEvaluate(
    examples: TrainingExample[],
    predictions: Float32Array[]
  ): BatchEvaluationResult {
    const results = examples.map((ex, i) => this.evaluate(ex, predictions[i]));

    const totalLoss = results.reduce((sum, r) => sum + r.loss, 0);
    const totalAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0);
    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);

    return {
      totalLoss,
      averageLoss: totalLoss / results.length,
      averageAccuracy: totalAccuracy / results.length,
      averageConfidence: totalConfidence / results.length,
      metrics: {
        total_loss: totalLoss,
        total_accuracy: totalAccuracy,
        std_loss: this.calculateStd(results.map(r => r.loss)),
        std_accuracy: this.calculateStd(results.map(r => r.accuracy)),
      },
      perExample: results,
    };
  }

  /**
   * Check if stage is mastered
   */
  isMastered(progress: StageProgress): boolean {
    return progress.mastery >= 0.8 && progress.loss < 0.2;
  }

  /**
   * Calculate cosine similarity
   */
  protected cosineSimilarity(a: Float32Array, b: Float32Array): number {
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
   * Calculate mean squared error
   */
  protected mse(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return sum / a.length;
  }

  /**
   * Calculate Euclidean distance
   */
  protected euclideanDistance(a: Float32Array, b: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Calculate standard deviation
   */
  private calculateStd(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}
