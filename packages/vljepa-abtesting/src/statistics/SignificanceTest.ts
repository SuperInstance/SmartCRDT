/**
 * @fileoverview SignificanceTest - Statistical testing for A/B experiments
 * @author Aequor Project - Round 23 Agent 2
 * @version 1.0.0
 */

import type {
  StatisticalTest,
  TestConfig,
  TestResult,
  ConfidenceInterval,
  PowerAnalysisResult,
  MetricSummary,
} from "../types.js";

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
 * Cumulative distribution function for standard normal
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
 * Inverse CDF for standard normal (rational approximation from Abramowitz & Stegun 26.2.23)
 */
function normalInvCDF(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error("p must be between 0 and 1");
  }

  // Approximation of inverse normal CDF
  // Using the Abramowitz and Stegun formula 26.2.23
  const c = [2.515517, 0.802853, 0.010328];
  const d = [1.432788, 0.189269, 0.001308];

  // Handle symmetry: work with upper tail
  const sign = p > 0.5 ? 1 : -1;
  const q = p > 0.5 ? 1 - p : p;

  const t = Math.sqrt(-2 * Math.log(q));
  const z =
    t -
    ((c[2] * t + c[1]) * t + c[0]) / (((d[2] * t + d[1]) * t + d[0]) * t + 1);

  return sign * z;
}

/**
 * Calculate t-statistic
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
    lower: bootstrappedMeans[Math.max(0, lowerIndex)],
    upper: bootstrappedMeans[Math.min(iterations - 1, upperIndex)],
  };
}

/**
 * Chi-square test for proportions
 */
function chiSquareTest(
  controlConversions: number,
  controlTotal: number,
  treatmentConversions: number,
  treatmentTotal: number
): { chiSquare: number; pValue: number } {
  const controlNonConversions = controlTotal - controlConversions;
  const treatmentNonConversions = treatmentTotal - treatmentConversions;

  const row1Total = controlConversions + treatmentConversions;
  const row2Total = controlNonConversions + treatmentNonConversions;
  const col1Total = controlTotal;
  const col2Total = treatmentTotal;
  const grandTotal = controlTotal + treatmentTotal;

  // Expected values
  const e11 = (row1Total * col1Total) / grandTotal;
  const e12 = (row1Total * col2Total) / grandTotal;
  const e21 = (row2Total * col1Total) / grandTotal;
  const e22 = (row2Total * col2Total) / grandTotal;

  // Chi-square statistic
  const chiSquare =
    Math.pow(controlConversions - e11, 2) / e11 +
    Math.pow(treatmentConversions - e12, 2) / e12 +
    Math.pow(controlNonConversions - e21, 2) / e21 +
    Math.pow(treatmentNonConversions - e22, 2) / e22;

  // Approximate p-value (using normal approximation for 1 degree of freedom)
  const z = Math.sqrt(chiSquare);
  const pValue = 2 * (1 - normalCDF(z));

  return { chiSquare, pValue };
}

// ============================================================================
// SIGNIFICANCE TESTER
// ============================================================================

/**
 * SignificanceTester - Perform statistical tests on A/B experiment results
 */
export class SignificanceTester {
  private defaultAlpha: number;
  private bootstrapIterations: number;

  constructor(alpha: number = 0.05, bootstrapIterations: number = 10000) {
    this.defaultAlpha = alpha;
    this.bootstrapIterations = bootstrapIterations;
  }

  /**
   * Run a statistical test
   */
  runTest(
    config: TestConfig,
    control: MetricSummary,
    treatment: MetricSummary
  ): TestResult {
    const alpha = config.alpha || this.defaultAlpha;
    let pValue = 1;
    let effectSize = 0;
    let confidenceInterval: ConfidenceInterval;
    let power = 0.8;

    switch (config.test) {
      case "z_test":
        ({ pValue, effectSize, confidenceInterval } = this.zTest(
          control,
          treatment,
          alpha,
          config.twoTailed !== false
        ));
        power = this.estimatePower(
          effectSize,
          control.count,
          treatment.count,
          alpha
        );
        break;

      case "t_test":
        ({ pValue, effectSize, confidenceInterval } = this.tTest(
          control,
          treatment,
          alpha,
          config.twoTailed !== false
        ));
        power = this.estimatePower(
          effectSize,
          control.count,
          treatment.count,
          alpha
        );
        break;

      case "bootstrap":
        ({ pValue, effectSize, confidenceInterval } = this.bootstrapTest(
          control,
          treatment,
          alpha
        ));
        power = this.estimatePower(
          effectSize,
          control.count,
          treatment.count,
          alpha
        );
        break;

      case "chi_square":
        ({ pValue, effectSize, confidenceInterval } = this.chiSquare(
          control,
          treatment,
          alpha
        ));
        power = this.estimatePower(
          effectSize,
          control.count,
          treatment.count,
          alpha
        );
        break;

      case "fisher_exact":
        // Approximation using chi-square for large samples
        ({ pValue, effectSize, confidenceInterval } = this.chiSquare(
          control,
          treatment,
          alpha
        ));
        power = this.estimatePower(
          effectSize,
          control.count,
          treatment.count,
          alpha
        );
        break;

      default:
        throw new Error(`Unknown test type: ${config.test}`);
    }

    return {
      significant: pValue < alpha,
      pValue,
      confidenceInterval,
      effectSize,
      power,
      recommendation: this.generateRecommendation(
        pValue,
        effectSize,
        power,
        alpha
      ),
      test: config.test,
    };
  }

  /**
   * Z-test for comparing means
   */
  zTest(
    control: MetricSummary,
    treatment: MetricSummary,
    alpha: number,
    twoTailed: boolean
  ): {
    pValue: number;
    effectSize: number;
    confidenceInterval: ConfidenceInterval;
  } {
    // Two-sample z-test
    const se = Math.sqrt(
      control.variance / control.count + treatment.variance / treatment.count
    );
    const z = Math.abs((treatment.mean - control.mean) / se);

    let pValue: number;
    if (twoTailed) {
      pValue = 2 * (1 - normalCDF(z));
    } else {
      pValue = 1 - normalCDF(z);
    }

    // Effect size (Cohen's d)
    const pooled = pooledStdDev(
      control.stdDev,
      treatment.stdDev,
      control.count,
      treatment.count
    );
    const effectSize = cohensD(control.mean, treatment.mean, pooled);

    // Confidence interval for difference
    const diff = treatment.mean - control.mean;
    const seDiff = se;
    const zCrit = normalInvCDF(1 - alpha / (twoTailed ? 2 : 1));

    const confidenceInterval: ConfidenceInterval = {
      lower: diff - zCrit * seDiff,
      upper: diff + zCrit * seDiff,
      level: 1 - alpha,
    };

    return { pValue, effectSize, confidenceInterval };
  }

  /**
   * T-test for comparing means
   */
  tTest(
    control: MetricSummary,
    treatment: MetricSummary,
    alpha: number,
    twoTailed: boolean
  ): {
    pValue: number;
    effectSize: number;
    confidenceInterval: ConfidenceInterval;
  } {
    const t = tStatistic(
      control.mean,
      treatment.mean,
      control.variance,
      treatment.variance,
      control.count,
      treatment.count
    );

    // Approximate p-value using normal distribution (valid for large samples)
    let pValue: number;
    if (twoTailed) {
      pValue = 2 * (1 - normalCDF(Math.abs(t)));
    } else {
      pValue = 1 - normalCDF(t);
    }

    // Effect size
    const pooled = pooledStdDev(
      control.stdDev,
      treatment.stdDev,
      control.count,
      treatment.count
    );
    const effectSize = cohensD(control.mean, treatment.mean, pooled);

    // Confidence interval
    const diff = treatment.mean - control.mean;
    const pooledVar =
      ((control.count - 1) * control.variance +
        (treatment.count - 1) * treatment.variance) /
      (control.count + treatment.count - 2);
    const seDiff = Math.sqrt(
      pooledVar * (1 / control.count + 1 / treatment.count)
    );
    const tCrit = normalInvCDF(1 - alpha / (twoTailed ? 2 : 1));

    const confidenceInterval: ConfidenceInterval = {
      lower: diff - tCrit * seDiff,
      upper: diff + tCrit * seDiff,
      level: 1 - alpha,
    };

    return { pValue, effectSize, confidenceInterval };
  }

  /**
   * Bootstrap test
   */
  bootstrapTest(
    control: MetricSummary,
    treatment: MetricSummary,
    alpha: number
  ): {
    pValue: number;
    effectSize: number;
    confidenceInterval: ConfidenceInterval;
  } {
    // Bootstrap confidence intervals
    const controlValues = this.generateDistribution(control);
    const treatmentValues = this.generateDistribution(treatment);

    const controlCI = bootstrapCI(
      controlValues,
      alpha,
      this.bootstrapIterations
    );
    const treatmentCI = bootstrapCI(
      treatmentValues,
      alpha,
      this.bootstrapIterations
    );

    // Check for overlap
    const noOverlap =
      treatmentCI.upper < controlCI.lower ||
      controlCI.upper < treatmentCI.lower;
    const pValue = noOverlap ? alpha / 2 : alpha * 2;

    // Effect size
    const pooled = pooledStdDev(
      control.stdDev,
      treatment.stdDev,
      control.count,
      treatment.count
    );
    const effectSize = cohensD(control.mean, treatment.mean, pooled);

    // Confidence interval for difference
    const diff = treatment.mean - control.mean;
    const seDiff = Math.sqrt(
      control.variance / control.count + treatment.variance / treatment.count
    );
    const zCrit = normalInvCDF(1 - alpha / 2);

    const confidenceInterval: ConfidenceInterval = {
      lower: diff - zCrit * seDiff,
      upper: diff + zCrit * seDiff,
      level: 1 - alpha,
    };

    return { pValue, effectSize, confidenceInterval };
  }

  /**
   * Chi-square test for proportions
   */
  chiSquare(
    control: MetricSummary,
    treatment: MetricSummary,
    alpha: number
  ): {
    pValue: number;
    effectSize: number;
    confidenceInterval: ConfidenceInterval;
  } {
    // Treat mean as conversion rate (0-1)
    const controlConversions = Math.round(control.mean * control.count);
    const controlTotal = control.count;
    const treatmentConversions = Math.round(treatment.mean * treatment.count);
    const treatmentTotal = treatment.count;

    const { pValue } = chiSquareTest(
      controlConversions,
      controlTotal,
      treatmentConversions,
      treatmentTotal
    );

    // Effect size (risk difference)
    const effectSize = treatment.mean - control.mean;

    // Confidence interval for difference in proportions
    const diff = treatment.mean - control.mean;
    const seDiff = Math.sqrt(
      (control.mean * (1 - control.mean)) / control.count +
        (treatment.mean * (1 - treatment.mean)) / treatment.count
    );
    const zCrit = normalInvCDF(1 - alpha / 2);

    const confidenceInterval: ConfidenceInterval = {
      lower: diff - zCrit * seDiff,
      upper: diff + zCrit * seDiff,
      level: 1 - alpha,
    };

    return { pValue, effectSize, confidenceInterval };
  }

  /**
   * Perform power analysis
   */
  analyzePower(
    effectSize: number,
    sampleSize: number,
    alpha?: number
  ): PowerAnalysisResult {
    const alphaValue = alpha || this.defaultAlpha;

    // Calculate power for given sample size and effect size
    const zAlpha = normalInvCDF(1 - alphaValue / 2);
    const zBeta = effectSize * Math.sqrt(sampleSize / 2) - zAlpha;
    const power = normalCDF(zBeta);

    let recommendation: string;
    if (power < 0.5) {
      recommendation = `Low power (${(power * 100).toFixed(1)}%). Increase sample size to at least ${Math.ceil(sampleSize * 4)} for adequate power.`;
    } else if (power < 0.8) {
      recommendation = `Moderate power (${(power * 100).toFixed(1)}%). Consider increasing sample size to ${Math.ceil(sampleSize * 1.5)} for 80% power.`;
    } else {
      recommendation = `Good power (${(power * 100).toFixed(1)}%). Sample size is adequate.`;
    }

    return {
      sampleSize,
      power,
      effectSize,
      alpha: alphaValue,
      recommendation,
    };
  }

  /**
   * Calculate required sample size
   */
  calculateSampleSize(
    effectSize: number,
    targetPower: number = 0.8,
    alpha?: number
  ): number {
    const alphaValue = alpha || this.defaultAlpha;
    const zAlpha = normalInvCDF(1 - alphaValue / 2);
    const zBeta = normalInvCDF(targetPower);
    const n = 2 * Math.pow((zAlpha + zBeta) / effectSize, 2);
    return Math.ceil(n);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Estimate statistical power
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
   * Generate distribution from summary statistics
   */
  private generateDistribution(summary: MetricSummary): number[] {
    const values: number[] = [];
    // Simple normal approximation
    for (let i = 0; i < summary.count; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      values.push(summary.mean + summary.stdDev * z);
    }
    return values;
  }

  /**
   * Generate recommendation
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
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a significance tester
 */
export function createSignificanceTester(alpha?: number): SignificanceTester {
  return new SignificanceTester(alpha);
}

/**
 * Quick check if result is significant
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
