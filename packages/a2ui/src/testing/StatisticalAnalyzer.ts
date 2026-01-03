/**
 * @fileoverview Statistical Analyzer - Statistical analysis for A/B test results
 * @author Aequor Project - Round 18 Agent 2
 * @version 1.0.0
 */

import type {
  MetricData,
  TestResult,
  AggregatedResults,
} from "./ABTestManager.js";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Statistical test type
 */
export type StatisticalTest =
  | "z-test"
  | "t-test"
  | "chi-square"
  | "mann-whitney"
  | "bootstrap";

/**
 * Significance report
 */
export interface SignificanceReport {
  test: StatisticalTest;
  pValue: number;
  isSignificant: boolean;
  confidence: number; // 1 - alpha
  confidenceInterval: {
    lower: number;
    upper: number;
    level: number; // e.g., 0.95
  };
  effectSize: number;
  power: number;
  recommendation: string;
}

/**
 * Comparison result between two variants
 */
export interface ComparisonResult {
  variantA: string;
  variantB: string;
  metric: string;
  difference: number; // B - A
  relativeDifference: number; // (B - A) / A * 100
  significance: SignificanceReport;
  winner: "A" | "B" | "tie" | "inconclusive";
}

/**
 * Winner recommendation
 */
export interface WinnerRecommendation {
  winningVariant: string;
  confidence: number; // 0-1
  lift: number; // Expected improvement over control
  expectedValue: number;
  risk: "low" | "medium" | "high";
  reasoning: string[];
  cautions: string[];
  nextSteps: string[];
}

/**
 * Power analysis result
 */
export interface PowerAnalysis {
  sampleSize: number;
  power: number;
  effectSize: number;
  alpha: number;
  recommendation: string;
}

/**
 * Test status summary
 */
export interface TestStatusSummary {
  totalParticipants: number;
  totalImpressions: number;
  totalConversions: number;
  overallConversionRate: number;
  status:
    | "needs_more_data"
    | "ready_to_conclude"
    | "inconclusive"
    | "significant_winner_found";
}

/**
 * Configuration for StatisticalAnalyzer
 */
export interface StatisticalAnalyzerConfig {
  defaultAlpha?: number; // Significance level (typically 0.05)
  defaultPower?: number; // Power (typically 0.8)
  minSampleSize?: number;
  bootstrapIterations?: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const DEFAULT_ANALYZER_CONFIG: Required<StatisticalAnalyzerConfig> = {
  defaultAlpha: 0.05,
  defaultPower: 0.8,
  minSampleSize: 100,
  bootstrapIterations: 10000,
};

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

/**
 * Calculate standard error
 */
function standardError(stdDev: number, n: number): number {
  return stdDev / Math.sqrt(n);
}

/**
 * Calculate z-score
 */
function zScore(mean: number, populationMean: number, se: number): number {
  return (mean - populationMean) / se;
}

/**
 * Calculate cumulative distribution function for standard normal
 */
function normalCDF(x: number): number {
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
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate inverse CDF for standard normal (approximation)
 */
function normalInvCDF(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error("p must be between 0 and 1");
  }

  // Approximation using Beasley-Springer-Moro algorithm
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q, r;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

/**
 * Calculate t-statistic (simplified, assuming large samples)
 */
function tStatistic(
  mean1: number,
  mean2: number,
  var1: number,
  var2: number,
  n1: number,
  n2: number
): number {
  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const se = Math.sqrt(pooledVar * (1 / n1 + 1 / n2));
  return (mean1 - mean2) / se;
}

/**
 * Calculate Cohen's d (effect size)
 */
function cohensD(mean1: number, mean2: number, pooledStdDev: number): number {
  return (mean1 - mean2) / pooledStdDev;
}

/**
 * Pooled standard deviation
 */
function pooledStdDev(
  stdDev1: number,
  stdDev2: number,
  n1: number,
  n2: number
): number {
  return Math.sqrt(
    ((n1 - 1) * stdDev1 * stdDev1 + (n2 - 1) * stdDev2 * stdDev2) /
      (n1 + n2 - 2)
  );
}

/**
 * Bootstrap confidence interval
 */
function bootstrapCI(
  values: number[],
  alpha: number,
  iterations: number
): { lower: number; upper: number } {
  const bootstrappedMeans: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const sample: number[] = [];
    for (let j = 0; j < values.length; j++) {
      const idx = Math.floor(Math.random() * values.length);
      sample.push(values[idx]);
    }
    const mean = sample.reduce((a, b) => a + b, 0) / sample.length;
    bootstrappedMeans.push(mean);
  }

  bootstrappedMeans.sort((a, b) => a - b);
  const lowerIndex = Math.floor((alpha / 2) * iterations);
  const upperIndex = Math.ceil((1 - alpha / 2) * iterations);

  return {
    lower: bootstrappedMeans[lowerIndex],
    upper: bootstrappedMeans[upperIndex],
  };
}

// ============================================================================
// STATISTICAL ANALYZER
// ============================================================================

/**
 * StatisticalAnalyzer - Perform statistical analysis on A/B test results
 *
 * Provides various statistical tests, confidence intervals, and winner
 * recommendations for A/B test experiments.
 */
export class StatisticalAnalyzer {
  private config: Required<StatisticalAnalyzerConfig>;

  constructor(config?: StatisticalAnalyzerConfig) {
    this.config = {
      ...DEFAULT_ANALYZER_CONFIG,
      ...config,
    };
  }

  /**
   * Calculate statistical significance for a metric
   */
  calculateSignificance(
    control: MetricData,
    treatment: MetricData,
    test: StatisticalTest = "z-test"
  ): SignificanceReport {
    const alpha = this.config.defaultAlpha;
    const confidence = 1 - alpha;

    let pValue = 1;
    let testScore = 0;

    switch (test) {
      case "z-test":
        // Two-sample z-test for large samples
        const se = Math.sqrt(
          control.variance / control.count +
            treatment.variance / treatment.count
        );
        testScore = Math.abs((treatment.mean - control.mean) / se);
        pValue = 2 * (1 - normalCDF(testScore));
        break;

      case "t-test":
        // Two-sample t-test
        const tStat = tStatistic(
          control.mean,
          treatment.mean,
          control.variance,
          treatment.variance,
          control.count,
          treatment.count
        );
        testScore = Math.abs(tStat);
        // Approximate p-value using normal distribution
        pValue = 2 * (1 - normalCDF(testScore));
        break;

      case "bootstrap":
        // Bootstrap test
        const controlCI = bootstrapCI(
          control.values,
          alpha,
          this.config.bootstrapIterations
        );
        const treatmentCI = bootstrapCI(
          treatment.values,
          alpha,
          this.config.bootstrapIterations
        );

        // Check for overlap
        if (
          controlCI.upper < treatmentCI.lower ||
          controlCI.lower > treatmentCI.upper
        ) {
          pValue = alpha / 2; // Significant
        } else {
          pValue = alpha * 2; // Not significant
        }
        break;

      default:
        throw new Error(`Unsupported test: ${test}`);
    }

    // Calculate effect size
    const pooled = pooledStdDev(
      control.stdDev,
      treatment.stdDev,
      control.count,
      treatment.count
    );
    const effectSize = cohensD(control.mean, treatment.mean, pooled);

    // Calculate confidence interval for difference
    const diff = treatment.mean - control.mean;
    const seDiff = Math.sqrt(
      control.variance / control.count + treatment.variance / treatment.count
    );
    const z = normalInvCDF(1 - alpha / 2);
    const ci = {
      lower: diff - z * seDiff,
      upper: diff + z * seDiff,
      level: confidence,
    };

    // Estimate power (simplified)
    const power = this.estimatePower(
      effectSize,
      control.count,
      treatment.count,
      alpha
    );

    return {
      test,
      pValue,
      isSignificant: pValue < alpha,
      confidence,
      confidenceInterval: ci,
      effectSize,
      power,
      recommendation: this.generateRecommendation(
        pValue,
        effectSize,
        power,
        alpha
      ),
    };
  }

  /**
   * Compare two variants on a specific metric
   */
  compareVariants(
    variantA: AggregatedResults,
    variantB: AggregatedResults,
    metric: string
  ): ComparisonResult {
    const metricA = variantA.metrics.get(metric);
    const metricB = variantB.metrics.get(metric);

    if (!metricA || !metricB) {
      throw new Error(`Metric not found: ${metric}`);
    }

    const significance = this.calculateSignificance(metricA, metricB);
    const difference = metricB.mean - metricA.mean;
    const relativeDifference =
      metricA.mean !== 0 ? (difference / metricA.mean) * 100 : 0;

    let winner: "A" | "B" | "tie" | "inconclusive";
    if (significance.isSignificant) {
      winner = difference > 0 ? "B" : difference < 0 ? "A" : "tie";
    } else {
      winner = "inconclusive";
    }

    return {
      variantA: variantA.variantId,
      variantB: variantB.variantId,
      metric,
      difference,
      relativeDifference,
      significance,
      winner,
    };
  }

  /**
   * Recommend winner from test results
   */
  recommendWinner(
    results: AggregatedResults[],
    targetMetric: string
  ): WinnerRecommendation {
    if (results.length < 2) {
      throw new Error("Need at least 2 variants to recommend winner");
    }

    const control = results[0];
    const comparisons: ComparisonResult[] = [];

    // Compare control to each treatment
    for (let i = 1; i < results.length; i++) {
      try {
        const comparison = this.compareVariants(
          control,
          results[i],
          targetMetric
        );
        comparisons.push(comparison);
      } catch (error) {
        // Skip if metric not found
      }
    }

    if (comparisons.length === 0) {
      return {
        winningVariant: control.variantId,
        confidence: 0,
        lift: 0,
        expectedValue: control.metrics.get(targetMetric)?.mean || 0,
        risk: "high",
        reasoning: ["No valid comparisons could be made"],
        cautions: ["Metric may not be available for all variants"],
        nextSteps: ["Check metric collection", "Ensure sufficient sample size"],
      };
    }

    // Find best variant
    const significant = comparisons.filter(c => c.significance.isSignificant);
    let winningVariant = control.variantId;
    let lift = 0;
    let confidence = 0;

    if (significant.length > 0) {
      // Pick the winner with best lift
      const best = significant.sort(
        (a, b) => b.relativeDifference - a.relativeDifference
      )[0];
      winningVariant = best.winner === "B" ? best.variantB : best.variantA;
      lift = Math.abs(best.relativeDifference);
      confidence = 1 - best.significance.pValue;
    } else {
      // No significant winner, stick with control
      winningVariant = control.variantId;
      lift = 0;
      confidence = 0.5;
    }

    const risk = this.assessRisk(confidence, comparisons);
    const controlValue = control.metrics.get(targetMetric)?.mean || 0;
    const expectedValue =
      lift > 0 ? controlValue * (1 + lift / 100) : controlValue;

    return {
      winningVariant,
      confidence,
      lift,
      expectedValue,
      risk,
      reasoning: this.generateWinnerReasoning(comparisons, winningVariant),
      cautions: this.generateCautions(comparisons),
      nextSteps: this.generateNextSteps(winningVariant, confidence, risk),
    };
  }

  /**
   * Perform power analysis
   */
  analyzePower(
    effectSize: number,
    sampleSize?: number,
    alpha?: number
  ): PowerAnalysis {
    const alphaValue = alpha ?? this.config.defaultAlpha;
    const n = sampleSize ?? this.config.minSampleSize;

    // Simplified power calculation
    const zAlpha = normalInvCDF(1 - alphaValue / 2);
    const zBeta = effectSize * Math.sqrt(n / 2) - zAlpha;
    const power = normalCDF(zBeta);

    let recommendation: string;
    if (power < 0.5) {
      recommendation = `Low power (${(power * 100).toFixed(1)}%). Increase sample size to at least ${Math.ceil(n * 4)} for adequate power.`;
    } else if (power < 0.8) {
      recommendation = `Moderate power (${(power * 100).toFixed(1)}%). Consider increasing sample size to ${Math.ceil(n * 1.5)} for 80% power.`;
    } else {
      recommendation = `Good power (${(power * 100).toFixed(1)}%). Sample size is adequate.`;
    }

    return {
      sampleSize: n,
      power,
      effectSize,
      alpha: alphaValue,
      recommendation,
    };
  }

  /**
   * Get test status summary
   */
  getStatusSummary(
    results: AggregatedResults[],
    targetMetric: string
  ): TestStatusSummary {
    const totalParticipants = results.reduce(
      (sum, r) => sum + r.impressions,
      0
    );
    const totalConversions = results.reduce((sum, r) => sum + r.completions, 0);
    const overallConversionRate =
      totalParticipants > 0 ? totalConversions / totalParticipants : 0;

    const minSample = Math.min(...results.map(r => r.impressions));
    const hasMinSample = minSample >= this.config.minSampleSize;

    let status: TestStatusSummary["status"];
    if (!hasMinSample) {
      status = "needs_more_data";
    } else {
      // Check for significant winner
      const control = results[0];
      let hasSignificantWinner = false;

      for (let i = 1; i < results.length; i++) {
        try {
          const metricA = control.metrics.get(targetMetric);
          const metricB = results[i].metrics.get(targetMetric);
          if (metricA && metricB) {
            const sig = this.calculateSignificance(metricA, metricB);
            if (sig.isSignificant) {
              hasSignificantWinner = true;
              break;
            }
          }
        } catch (error) {
          // Skip
        }
      }

      status = hasSignificantWinner
        ? "significant_winner_found"
        : "inconclusive";
    }

    return {
      totalParticipants,
      totalImpressions: totalParticipants,
      totalConversions,
      overallConversionRate,
      status,
    };
  }

  /**
   * Calculate required sample size for target power
   */
  calculateRequiredSampleSize(
    effectSize: number,
    targetPower: number = this.config.defaultPower,
    alpha: number = this.config.defaultAlpha
  ): number {
    const zAlpha = normalInvCDF(1 - alpha / 2);
    const zBeta = normalInvCDF(targetPower);
    const n = 2 * Math.pow((zAlpha + zBeta) / effectSize, 2);
    return Math.ceil(n);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Estimate statistical power (simplified)
   */
  private estimatePower(
    effectSize: number,
    n1: number,
    n2: number,
    alpha: number
  ): number {
    const avgN = (n1 + n2) / 2;
    const zAlpha = normalInvCDF(1 - alpha / 2);
    const zBeta = effectSize * Math.sqrt(avgN / 2) - zAlpha;
    return Math.min(1, Math.max(0, normalCDF(zBeta)));
  }

  /**
   * Generate recommendation based on test results
   */
  private generateRecommendation(
    pValue: number,
    effectSize: number,
    power: number,
    alpha: number
  ): string {
    if (pValue < alpha) {
      if (Math.abs(effectSize) < 0.2) {
        return "Statistically significant but small effect size. Consider practical significance.";
      } else if (power < 0.8) {
        return "Statistically significant but underpowered. Results may not be reproducible.";
      } else {
        return "Statistically significant with good power. Ready to make a decision.";
      }
    } else {
      if (power < 0.5) {
        return "Not significant and underpowered. Collect more data.";
      } else {
        return "Not statistically significant. Variants are likely equivalent.";
      }
    }
  }

  /**
   * Assess risk of choosing winner
   */
  private assessRisk(
    confidence: number,
    comparisons: ComparisonResult[]
  ): "low" | "medium" | "high" {
    if (confidence > 0.95) {
      return "low";
    } else if (confidence > 0.8) {
      return "medium";
    } else {
      return "high";
    }
  }

  /**
   * Generate reasoning for winner recommendation
   */
  private generateWinnerReasoning(
    comparisons: ComparisonResult[],
    winner: string
  ): string[] {
    const reasoning: string[] = [];

    const significant = comparisons.filter(c => c.significance.isSignificant);
    if (significant.length > 0) {
      reasoning.push(`Found ${significant.length} significant comparison(s)`);
      for (const comp of significant) {
        reasoning.push(
          `${comp.variantB} shows ${comp.relativeDifference.toFixed(2)}% ${comp.relativeDifference > 0 ? "improvement" : "decline"} over ${comp.variantA} (p=${comp.significance.pValue.toFixed(4)})`
        );
      }
    } else {
      reasoning.push("No statistically significant differences found");
      reasoning.push("Recommending control variant by default");
    }

    return reasoning;
  }

  /**
   * Generate cautions for winner recommendation
   */
  private generateCautions(comparisons: ComparisonResult[]): string[] {
    const cautions: string[] = [];
    const lowPower = comparisons.filter(c => c.significance.power < 0.8);

    if (lowPower.length > 0) {
      cautions.push("Some comparisons have low statistical power");
    }

    const smallEffects = comparisons.filter(
      c => Math.abs(c.significance.effectSize) < 0.2
    );
    if (smallEffects.length > 0) {
      cautions.push("Effect sizes are small; consider practical significance");
    }

    return cautions;
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(
    winner: string,
    confidence: number,
    risk: string
  ): string[] {
    const steps: string[] = [];

    if (confidence > 0.95) {
      steps.push(`Implement variant ${winner} as the new default`);
      steps.push("Monitor performance after rollout");
    } else if (confidence > 0.8) {
      steps.push(`Consider implementing variant ${winner}`);
      steps.push("Continue monitoring for additional validation");
    } else {
      steps.push("Continue running the test to collect more data");
      steps.push("Consider increasing sample size");
    }

    if (risk === "high") {
      steps.push("Conduct additional validation before full rollout");
    }

    return steps;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a statistical analyzer with default configuration
 */
export function createStatisticalAnalyzer(
  config?: StatisticalAnalyzerConfig
): StatisticalAnalyzer {
  return new StatisticalAnalyzer(config);
}

/**
 * Quick check if results are significant
 */
export function isSignificant(pValue: number, alpha: number = 0.05): boolean {
  return pValue < alpha;
}

/**
 * Calculate conversion rate with confidence interval
 */
export function conversionRateWithCI(
  conversions: number,
  total: number,
  confidence: number = 0.95
): { rate: number; lower: number; upper: number } {
  const rate = conversions / total;
  const se = Math.sqrt((rate * (1 - rate)) / total);
  const alpha = 1 - confidence;
  const z = normalInvCDF(1 - alpha / 2);

  return {
    rate,
    lower: Math.max(0, rate - z * se),
    upper: Math.min(1, rate + z * se),
  };
}
