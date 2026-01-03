/**
 * @lsi/vljepa-orpo - Preference Evaluator
 *
 * Comprehensive evaluation of multimodal ORPO models.
 * Combines win rate calculation, calibration, and category analysis.
 *
 * @module evaluators
 */

import type { UIPreferencePair, EvaluationResults } from "../types.js";
import { WinRateCalculator } from "./WinRateCalculator.js";
import { MultimodalORPOModel } from "../models/MultimodalORPOModel.js";

/**
 * Evaluation options
 */
export interface EvaluationOptions {
  /** Calculate bootstrap confidence intervals */
  bootstrapCI: boolean;
  /** Bootstrap samples for CI */
  bootstrapSamples: number;
  /** Confidence level for CI */
  confidenceLevel: number;
  /** Calculate per-category metrics */
  perCategory: boolean;
  /** Calculate calibration metrics */
  calculateCalibration: boolean;
  /** Verbose output */
  verbose: boolean;
}

/**
 * Detailed evaluation report
 */
export interface EvaluationReport extends EvaluationResults {
  /** Confidence intervals */
  confidenceIntervals?: {
    accuracy: { lower: number; upper: number };
    winRate: { lower: number; upper: number };
  };
  /** Recommendations */
  recommendations: string[];
  /** Evaluation timestamp */
  timestamp: number;
  /** Evaluation duration (ms) */
  duration: number;
}

/**
 * Preference Evaluator
 *
 * Comprehensive evaluation of preference models.
 *
 * @example
 * ```typescript
 * const evaluator = new PreferenceEvaluator();
 * const report = await evaluator.evaluate(model, pairs);
 * console.log(report.pairwiseAccuracy, report.recommendations);
 * ```
 */
export class PreferenceEvaluator {
  private winRateCalculator: WinRateCalculator;
  private options: EvaluationOptions;

  constructor(options: Partial<EvaluationOptions> = {}) {
    this.winRateCalculator = new WinRateCalculator({
      bootstrapSamples: 1000,
      confidenceLevel: 0.95,
      perCategory: true,
      calculateCalibration: true,
    });
    this.options = {
      bootstrapCI: true,
      bootstrapSamples: 1000,
      confidenceLevel: 0.95,
      perCategory: true,
      calculateCalibration: true,
      verbose: false,
      ...options,
    };
  }

  /**
   * Evaluate model on preference pairs
   */
  async evaluate(
    model: MultimodalORPOModel,
    pairs: UIPreferencePair[]
  ): Promise<EvaluationReport> {
    const startTime = performance.now();

    if (this.options.verbose) {
      console.log(`Evaluating model on ${pairs.length} preference pairs...`);
    }

    // Get predictions from model
    const predictions = await this.getPredictions(model, pairs);

    // Calculate basic metrics
    const results = this.winRateCalculator.evaluate(pairs, predictions);

    // Calculate confidence intervals if enabled
    let confidenceIntervals;
    if (this.options.bootstrapCI) {
      const accuracyCI = this.winRateCalculator.calculateBootstrapCI(
        pairs,
        predictions,
        "accuracy"
      );
      const winRateCI = this.winRateCalculator.calculateBootstrapCI(
        pairs,
        predictions,
        "accuracy"
      ); // Reuse for win rate

      confidenceIntervals = {
        accuracy: accuracyCI,
        winRate: winRateCI,
      };
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(results);

    const duration = performance.now() - startTime;

    if (this.options.verbose) {
      console.log(`Evaluation complete in ${duration.toFixed(0)}ms`);
      console.log(`Accuracy: ${(results.pairwiseAccuracy * 100).toFixed(1)}%`);
      console.log(
        `Win Rate vs Baseline: ${(results.winRateVsBaseline * 100).toFixed(1)}%`
      );
    }

    return {
      ...results,
      confidenceIntervals,
      recommendations,
      timestamp: Date.now(),
      duration,
    };
  }

  /**
   * Get predictions from model
   */
  private async getPredictions(
    model: MultimodalORPOModel,
    pairs: UIPreferencePair[]
  ): Promise<Float32Array[]> {
    const predictions: Float32Array[] = [];

    for (const pair of pairs) {
      const result = await model.forward(
        pair.chosen.embedding,
        pair.rejected.embedding
      );
      predictions.push(new Float32Array([result.preferenceScore]));
    }

    return predictions;
  }

  /**
   * Generate recommendations based on evaluation results
   */
  private generateRecommendations(results: EvaluationResults): string[] {
    const recommendations: string[] = [];

    // Accuracy recommendations
    if (results.pairwiseAccuracy < 0.7) {
      recommendations.push(
        `Model accuracy (${(results.pairwiseAccuracy * 100).toFixed(1)}%) is below target (70%). Consider more training data.`
      );
    } else if (results.pairwiseAccuracy >= 0.8) {
      recommendations.push(
        `Excellent accuracy (${(results.pairwiseAccuracy * 100).toFixed(1)}%) - model is well-calibrated.`
      );
    }

    // Win rate recommendations
    if (results.winRateVsBaseline < 0.6) {
      recommendations.push(
        `Win rate vs baseline (${(results.winRateVsBaseline * 100).toFixed(1)}%) is below target (60%). Model may not be learning effectively.`
      );
    }

    // Calibration recommendations
    if (results.calibration.expectedCalibrationError > 0.1) {
      recommendations.push(
        `Poor calibration (ECE: ${results.calibration.expectedCalibrationError.toFixed(3)}). Consider temperature scaling.`
      );
    }

    // Category-specific recommendations
    const lowPerfCategories = results.perCategory.filter(c => c.accuracy < 0.6);
    if (lowPerfCategories.length > 0) {
      recommendations.push(
        `Low performance on ${lowPerfCategories.length} categories: ${lowPerfCategories.map(c => c.category).join(", ")}. Consider category-specific fine-tuning.`
      );
    }

    // Ranking consistency
    if (results.rankingConsistency < 0.7) {
      recommendations.push(
        `Low ranking consistency (${(results.rankingConsistency * 100).toFixed(1)}%). Model may violate transitivity.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Model performs well across all metrics.");
    }

    return recommendations;
  }

  /**
   * Compare two models
   */
  async compareModels(
    modelA: MultimodalORPOModel,
    modelB: MultimodalORPOModel,
    pairs: UIPreferencePair[]
  ): Promise<{
    modelA: EvaluationReport;
    modelB: EvaluationReport;
    winner: "modelA" | "modelB" | "tie";
    significance: number;
  }> {
    if (this.options.verbose) {
      console.log("Comparing two models...");
    }

    const [reportA, reportB] = await Promise.all([
      this.evaluate(modelA, pairs),
      this.evaluate(modelB, pairs),
    ]);

    // Determine winner (using accuracy as primary metric)
    let winner: "modelA" | "modelB" | "tie";
    if (reportA.pairwiseAccuracy > reportB.pairwiseAccuracy + 0.02) {
      winner = "modelA";
    } else if (reportB.pairwiseAccuracy > reportA.pairwiseAccuracy + 0.02) {
      winner = "modelB";
    } else {
      winner = "tie";
    }

    // Calculate statistical significance (simplified)
    const n = pairs.length;
    const se = Math.sqrt(
      (reportA.pairwiseAccuracy * (1 - reportA.pairwiseAccuracy) +
        reportB.pairwiseAccuracy * (1 - reportB.pairwiseAccuracy)) /
        (2 * n)
    );
    const z =
      Math.abs(reportA.pairwiseAccuracy - reportB.pairwiseAccuracy) / se;
    const significance = 1 - this.normalCDF(z); // One-tailed p-value

    return {
      modelA: reportA,
      modelB: reportB,
      winner,
      significance,
    };
  }

  /**
   * Normal cumulative distribution function
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Evaluate on specific subset
   */
  async evaluateSubset(
    model: MultimodalORPOModel,
    pairs: UIPreferencePair[],
    filter: (pair: UIPreferencePair) => boolean
  ): Promise<EvaluationReport> {
    const subset = pairs.filter(filter);
    return await this.evaluate(model, subset);
  }

  /**
   * Get evaluation summary as text
   */
  summarizeReport(report: EvaluationReport): string {
    const lines = [
      "=== Evaluation Summary ===",
      `Timestamp: ${new Date(report.timestamp).toISOString()}`,
      `Duration: ${report.duration.toFixed(0)}ms`,
      "",
      "Metrics:",
      `  Pairwise Accuracy: ${(report.pairwiseAccuracy * 100).toFixed(1)}% (target: >70%)`,
      `  Win Rate vs Baseline: ${(report.winRateVsBaseline * 100).toFixed(1)}% (target: >60%)`,
      `  Ranking Consistency: ${(report.rankingConsistency * 100).toFixed(1)}%`,
      "",
      "Calibration:",
      `  ECE: ${report.calibration.expectedCalibrationError.toFixed(4)}`,
      `  Brier Score: ${report.calibration.brierScore.toFixed(4)}`,
      "",
      "Categories:",
    ];

    for (const cat of report.perCategory.slice(0, 10)) {
      lines.push(
        `  ${cat.category}: ${(cat.accuracy * 100).toFixed(1)}% (n=${cat.sampleSize})`
      );
    }

    if (report.perCategory.length > 10) {
      lines.push(`  ... and ${report.perCategory.length - 10} more`);
    }

    lines.push("", "Recommendations:");
    for (const rec of report.recommendations) {
      lines.push(`  - ${rec}`);
    }

    if (report.confidenceIntervals) {
      lines.push("", "Confidence Intervals (95%):");
      lines.push(
        `  Accuracy: [${(report.confidenceIntervals.accuracy.lower * 100).toFixed(1)}%, ${(report.confidenceIntervals.accuracy.upper * 100).toFixed(1)}%]`
      );
      lines.push(
        `  Win Rate: [${(report.confidenceIntervals.winRate.lower * 100).toFixed(1)}%, ${(report.confidenceIntervals.winRate.upper * 100).toFixed(1)}%]`
      );
    }

    return lines.join("\n");
  }

  /**
   * Get options
   */
  getOptions(): EvaluationOptions {
    return { ...this.options };
  }

  /**
   * Set options
   */
  setOptions(options: Partial<EvaluationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get win rate calculator
   */
  getWinRateCalculator(): WinRateCalculator {
    return this.winRateCalculator;
  }
}

/**
 * Create a preference evaluator
 */
export function createPreferenceEvaluator(
  options?: Partial<EvaluationOptions>
): PreferenceEvaluator {
  return new PreferenceEvaluator(options);
}

/**
 * Evaluate model (convenience function)
 */
export async function evaluateModel(
  model: MultimodalORPOModel,
  pairs: UIPreferencePair[],
  options?: Partial<EvaluationOptions>
): Promise<EvaluationReport> {
  const evaluator = new PreferenceEvaluator(options);
  return await evaluator.evaluate(model, pairs);
}
