/**
 * @lsi/vljepa-orpo - Win Rate Calculator
 *
 * Calculates win rates and preference accuracy for multimodal ORPO models.
 * Evaluates how well the model aligns with user preferences.
 *
 * @module evaluators
 */

import type {
  UIPreferencePair,
  EvaluationResults,
  CalibrationMetrics,
  CategoryMetrics,
} from "../types.js";

/**
 * Win rate calculation options
 */
export interface WinRateOptions {
  /** Bootstrap samples for confidence intervals */
  bootstrapSamples: number;
  /** Confidence interval level */
  confidenceLevel: number;
  /** Calculate per-category metrics */
  perCategory: boolean;
  /** Calculate calibration */
  calculateCalibration: boolean;
}

/**
 * Pairwise comparison result
 */
interface PairwiseResult {
  /** Chosen score */
  chosenScore: number;
  /** Rejected score */
  rejectedScore: number;
  /** Correct (chosen > rejected) */
  correct: boolean;
  /** Margin */
  margin: number;
}

/**
 * Calibration bucket
 */
interface CalibrationBucket {
  /** Min confidence */
  minConfidence: number;
  /** Max confidence */
  maxConfidence: number;
  /** Total count */
  count: number;
  /** Correct count */
  correct: number;
  /** Accuracy */
  accuracy: number;
}

/**
 * Win Rate Calculator
 *
 * Calculates various metrics for evaluating preference models.
 *
 * @example
 * ```typescript
 * const calculator = new WinRateCalculator();
 * const results = calculator.evaluate(pairs, predictions);
 * console.log(results.pairwiseAccuracy); // Target: >70%
 * ```
 */
export class WinRateCalculator {
  private options: WinRateOptions;

  constructor(options: Partial<WinRateOptions> = {}) {
    this.options = {
      bootstrapSamples: 1000,
      confidenceLevel: 0.95,
      perCategory: true,
      calculateCalibration: true,
      ...options,
    };
  }

  /**
   * Evaluate model predictions against preferences
   */
  evaluate(
    pairs: UIPreferencePair[],
    predictions: Float32Array[] // Preference scores for each pair
  ): EvaluationResults {
    if (pairs.length !== predictions.length) {
      throw new Error(
        `Pairs count (${pairs.length}) does not match predictions count (${predictions.length})`
      );
    }

    // Calculate pairwise accuracy
    const pairwiseResults = this.calculatePairwiseResults(pairs, predictions);
    const pairwiseAccuracy = this.calculateAccuracy(pairwiseResults);

    // Calculate win rate vs baseline (random)
    const winRateVsBaseline = pairwiseAccuracy - 0.5;

    // Calculate calibration
    const calibration = this.options.calculateCalibration
      ? this.calculateCalibrationMetrics(pairwiseResults, predictions)
      : this.getDefaultCalibration();

    // Calculate per-category metrics
    const perCategory = this.options.perCategory
      ? this.calculatePerCategoryMetrics(pairs, pairwiseResults)
      : [];

    // Calculate ranking consistency
    const rankingConsistency = this.calculateRankingConsistency(
      pairs,
      pairwiseResults
    );

    // Calculate average preference score
    const avgPreferenceScore =
      predictions.reduce((sum, p) => sum + p[0], 0) / predictions.length;

    // Calculate average odds ratio
    const avgOddsRatio = this.calculateAverageOddsRatio(pairwiseResults);

    return {
      pairwiseAccuracy,
      winRateVsBaseline,
      calibration,
      rankingConsistency,
      perCategory,
      totalPairs: pairs.length,
      avgPreferenceScore,
      avgOddsRatio,
    };
  }

  /**
   * Calculate win rate against a baseline model
   */
  calculateWinRate(
    pairs: UIPreferencePair[],
    modelScores: Float32Array[],
    baselineScores: Float32Array[]
  ): number {
    let modelWins = 0;
    let ties = 0;

    for (let i = 0; i < pairs.length; i++) {
      const modelCorrect = modelScores[i][0] > 0.5;
      const baselineCorrect = baselineScores[i][0] > 0.5;

      if (modelCorrect && !baselineCorrect) {
        modelWins++;
      } else if (modelCorrect === baselineCorrect) {
        ties++;
      }
    }

    // Exclude ties from calculation
    const n = pairs.length - ties;
    return n > 0 ? modelWins / n : 0.5;
  }

  /**
   * Calculate bootstrap confidence interval
   */
  calculateBootstrapCI(
    pairs: UIPreferencePair[],
    predictions: Float32Array[],
    metric: "accuracy" | "calibration" = "accuracy"
  ): { lower: number; upper: number } {
    const scores: number[] = [];

    for (let i = 0; i < this.options.bootstrapSamples; i++) {
      // Sample with replacement
      const bootPairs: UIPreferencePair[] = [];
      const bootPreds: Float32Array[] = [];

      for (let j = 0; j < pairs.length; j++) {
        const idx = Math.floor(Math.random() * pairs.length);
        bootPairs.push(pairs[idx]);
        bootPreds.push(predictions[idx]);
      }

      // Calculate metric on bootstrap sample
      if (metric === "accuracy") {
        const results = this.calculatePairwiseResults(bootPairs, bootPreds);
        scores.push(this.calculateAccuracy(results));
      } else {
        // Calibration
        const results = this.calculatePairwiseResults(bootPairs, bootPreds);
        const cal = this.calculateCalibrationMetrics(results, bootPreds);
        scores.push(1 - cal.expectedCalibrationError); // Lower ECE is better
      }
    }

    // Calculate percentiles
    scores.sort((a, b) => a - b);
    const alpha = 1 - this.options.confidenceLevel;
    const lowerIdx = Math.floor((scores.length * alpha) / 2);
    const upperIdx = Math.ceil(scores.length * (1 - alpha / 2)) - 1;

    return {
      lower: scores[lowerIdx],
      upper: scores[upperIdx],
    };
  }

  /**
   * Calculate pairwise results
   */
  private calculatePairwiseResults(
    pairs: UIPreferencePair[],
    predictions: Float32Array[]
  ): PairwiseResult[] {
    const results: PairwiseResult[] = [];

    for (let i = 0; i < pairs.length; i++) {
      const score = predictions[i][0];
      const correct = score > 0.5;
      const margin = Math.abs(score - 0.5);

      results.push({
        chosenScore: correct ? score : 1 - score,
        rejectedScore: correct ? 1 - score : score,
        correct,
        margin,
      });
    }

    return results;
  }

  /**
   * Calculate accuracy from pairwise results
   */
  private calculateAccuracy(results: PairwiseResult[]): number {
    if (results.length === 0) return 0;
    const correctCount = results.filter(r => r.correct).length;
    return correctCount / results.length;
  }

  /**
   * Calculate calibration metrics
   */
  private calculateCalibrationMetrics(
    results: PairwiseResult[],
    predictions: Float32Array[]
  ): CalibrationMetrics {
    // Create calibration buckets
    const numBuckets = 10;
    const buckets: CalibrationBucket[] = [];

    for (let i = 0; i < numBuckets; i++) {
      buckets.push({
        minConfidence: i / numBuckets,
        maxConfidence: (i + 1) / numBuckets,
        count: 0,
        correct: 0,
        accuracy: 0,
      });
    }

    // Fill buckets
    for (let i = 0; i < results.length; i++) {
      const score = predictions[i][0];
      const bucketIdx = Math.min(
        Math.floor(score * numBuckets),
        numBuckets - 1
      );

      buckets[bucketIdx].count++;
      if (results[i].correct) {
        buckets[bucketIdx].correct++;
      }
    }

    // Calculate bucket accuracies
    const reliabilityDiagram: { confidence: number; accuracy: number }[] = [];

    for (const bucket of buckets) {
      if (bucket.count > 0) {
        bucket.accuracy = bucket.correct / bucket.count;
        const confidence = (bucket.minConfidence + bucket.maxConfidence) / 2;
        reliabilityDiagram.push({ confidence, accuracy: bucket.accuracy });
      }
    }

    // Calculate Expected Calibration Error (ECE)
    let ece = 0;
    let totalSamples = 0;

    for (const bucket of buckets) {
      if (bucket.count > 0) {
        const bucketWeight = bucket.count / results.length;
        const confidence = (bucket.minConfidence + bucket.maxConfidence) / 2;
        ece += bucketWeight * Math.abs(confidence - bucket.accuracy);
        totalSamples += bucket.count;
      }
    }

    // Calculate Brier score
    let brierSum = 0;
    for (let i = 0; i < results.length; i++) {
      const score = predictions[i][0];
      const label = results[i].correct ? 1 : 0;
      brierSum += (score - label) ** 2;
    }
    const brierScore = brierSum / results.length;

    return {
      expectedCalibrationError: ece,
      reliabilityDiagram,
      brierScore,
    };
  }

  /**
   * Calculate per-category metrics
   */
  private calculatePerCategoryMetrics(
    pairs: UIPreferencePair[],
    results: PairwiseResult[]
  ): CategoryMetrics[] {
    const byCategory = new Map<
      string,
      { correct: number; total: number; scores: number[] }
    >();

    for (let i = 0; i < pairs.length; i++) {
      const category = pairs[i].context.uiContext || "unknown";

      if (!byCategory.has(category)) {
        byCategory.set(category, { correct: 0, total: 0, scores: [] });
      }

      const stats = byCategory.get(category)!;
      stats.total++;
      if (results[i].correct) {
        stats.correct++;
      }
      stats.scores.push(results[i].chosenScore);
    }

    const metrics: CategoryMetrics[] = [];

    for (const [category, stats] of byCategory) {
      const accuracy = stats.correct / stats.total;
      const avgScore =
        stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;

      metrics.push({
        category,
        accuracy,
        winRate: accuracy, // Same as accuracy for this context
        sampleSize: stats.total,
        avgConfidence: avgScore,
      });
    }

    // Sort by sample size (descending)
    metrics.sort((a, b) => b.sampleSize - a.sampleSize);

    return metrics;
  }

  /**
   * Calculate ranking consistency (transitivity)
   */
  private calculateRankingConsistency(
    pairs: UIPreferencePair[],
    results: PairwiseResult[]
  ): number {
    // Find triplets where A > B, B > C, check if A > C
    // This is expensive, so we sample
    const sampleSize = Math.min(1000, Math.floor(pairs.length / 10));
    let consistentCount = 0;
    let totalCount = 0;

    // Group pairs by context to find related items
    const byContext = new Map<string, number[]>();

    for (let i = 0; i < pairs.length; i++) {
      const context = pairs[i].context.uiContext;
      if (!byContext.has(context)) {
        byContext.set(context, []);
      }
      byContext.get(context)!.push(i);
    }

    // Sample triplets from each context
    for (const [context, indices] of byContext) {
      if (indices.length < 3) continue;

      for (let i = 0; i < Math.min(sampleSize, indices.length); i++) {
        // Select 3 random indices from this context
        const idx1 = indices[Math.floor(Math.random() * indices.length)];
        const idx2 = indices[Math.floor(Math.random() * indices.length)];
        const idx3 = indices[Math.floor(Math.random() * indices.length)];

        if (idx1 === idx2 || idx2 === idx3 || idx1 === idx3) continue;

        const score1 = results[idx1].chosenScore;
        const score2 = results[idx2].chosenScore;
        const score3 = results[idx3].chosenScore;

        // Check transitivity: if score1 > score2 and score2 > score3, then score1 should > score3
        if (score1 > score2 && score2 > score3) {
          totalCount++;
          if (score1 > score3) {
            consistentCount++;
          }
        }
      }
    }

    return totalCount > 0 ? consistentCount / totalCount : 1.0;
  }

  /**
   * Calculate average odds ratio
   */
  private calculateAverageOddsRatio(results: PairwiseResult[]): number {
    if (results.length === 0) return 1.0;

    const oddsRatios = results.map(r => {
      const p = r.chosenScore / (r.chosenScore + r.rejectedScore + 1e-8);
      const odds = p / (1 - p + 1e-8);
      return odds;
    });

    // Use geometric mean
    const logSum = oddsRatios.reduce((sum, o) => sum + Math.log(o + 1e-8), 0);
    return Math.exp(logSum / oddsRatios.length);
  }

  /**
   * Get default calibration metrics
   */
  private getDefaultCalibration(): CalibrationMetrics {
    return {
      expectedCalibrationError: 0,
      reliabilityDiagram: [],
      brierScore: 0,
    };
  }

  /**
   * Calculate simplified win rate
   */
  calculateSimpleWinRate(predictions: Float32Array[]): number {
    const correct = predictions.filter(p => p[0] > 0.5).length;
    return correct / predictions.length;
  }

  /**
   * Calculate top-k accuracy
   */
  calculateTopKAccuracy(
    pairs: UIPreferencePair[],
    predictions: Float32Array[],
    k: number
  ): number {
    // For preference pairs, top-k doesn't directly apply
    // Instead, we check if the chosen is in the top k scores
    // This is more relevant for ranking tasks

    // Simplified: return standard accuracy for k=1
    if (k === 1) {
      return this.calculateSimpleWinRate(predictions);
    }

    // For k > 1, we'd need multiple candidates to rank
    // This is a placeholder
    return this.calculateSimpleWinRate(predictions);
  }

  /**
   * Get options
   */
  getOptions(): WinRateOptions {
    return { ...this.options };
  }

  /**
   * Set options
   */
  setOptions(options: Partial<WinRateOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

/**
 * Create a win rate calculator
 */
export function createWinRateCalculator(
  options?: Partial<WinRateOptions>
): WinRateCalculator {
  return new WinRateCalculator(options);
}

/**
 * Calculate win rate (convenience function)
 */
export function calculateWinRate(
  pairs: UIPreferencePair[],
  predictions: Float32Array[],
  options?: Partial<WinRateOptions>
): EvaluationResults {
  const calculator = new WinRateCalculator(options);
  return calculator.evaluate(pairs, predictions);
}
