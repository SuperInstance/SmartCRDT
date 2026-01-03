/**
 * @fileoverview Model comparison metrics
 * @description Compare models and determine statistical significance
 */

import type {
  ModelComparison,
  ModelReference,
  ModelMetrics,
  ComparisonMetric,
  StatisticalSignificance,
  AccuracyMetrics,
  LatencyMetrics,
  MemoryMetrics,
  ThroughputMetrics,
  QualityMetrics,
} from "../types.js";

/**
 * Model comparison calculator
 */
export class ComparisonMetrics {
  /**
   * Compare two models
   * @param modelA First model reference
   * @param metricsA First model metrics
   * @param modelB Second model reference
   * @param metricsB Second model metrics
   * @param samplesA Sample counts for model A (for statistical tests)
   * @param samplesB Sample counts for model B
   * @returns Comparison result
   */
  compareModels(
    modelA: ModelReference,
    metricsA: ModelMetrics,
    modelB: ModelReference,
    metricsB: ModelMetrics,
    samplesA = 1000,
    samplesB = 1000
  ): ModelComparison {
    const comparison: ModelComparison = {
      modelA,
      modelB,
      metrics: [],
      winner: "tie",
      confidence: 0,
      significance: {
        test: "combined",
        pValue: 1,
        significant: false,
        effectSize: 0,
        confidenceInterval: [0, 0],
      },
      recommendation: "",
    };

    // Compare accuracy metrics
    this.addAccuracyComparison(
      comparison.metrics,
      metricsA.accuracy,
      metricsB.accuracy,
      samplesA,
      samplesB
    );

    // Compare latency metrics
    this.addLatencyComparison(
      comparison.metrics,
      metricsA.latency,
      metricsB.latency,
      samplesA,
      samplesB
    );

    // Compare memory metrics
    this.addMemoryComparison(
      comparison.metrics,
      metricsA.memory,
      metricsB.memory
    );

    // Compare throughput metrics
    this.addThroughputComparison(
      comparison.metrics,
      metricsA.throughput,
      metricsB.throughput
    );

    // Compare quality metrics
    this.addQualityComparison(
      comparison.metrics,
      metricsA.quality,
      metricsB.quality
    );

    // Determine overall winner
    const { winner, winsA, winsB } = this.determineWinner(comparison.metrics);
    comparison.winner = winner;

    // Calculate confidence based on significant differences
    const significantMetrics = comparison.metrics.filter(m => m.significant);
    const totalSignificant = significantMetrics.length;
    const totalMetrics = comparison.metrics.length;

    comparison.confidence =
      totalMetrics > 0 ? totalSignificant / totalMetrics : 0;

    // Perform overall statistical test
    comparison.significance = this.performOverallTest(
      comparison.metrics,
      samplesA,
      samplesB
    );

    // Generate recommendation
    comparison.recommendation = this.generateRecommendation(
      comparison,
      winsA,
      winsB
    );

    return comparison;
  }

  /**
   * Add accuracy metric comparisons
   * @param metrics Comparison metrics array
   * @param accA Model A accuracy
   * @param accB Model B accuracy
   * @param samplesA Sample count for A
   * @param samplesB Sample count for B
   */
  private addAccuracyComparison(
    metrics: ComparisonMetric[],
    accA: AccuracyMetrics,
    accB: AccuracyMetrics,
    samplesA: number,
    samplesB: number
  ): void {
    // Top-1 accuracy
    metrics.push(
      this.createMetric(
        "accuracy.top1",
        accA.top1,
        accB.top1,
        true, // higher is better
        samplesA,
        samplesB
      )
    );

    // Top-5 accuracy (if available)
    if (accA.top5 !== undefined && accB.top5 !== undefined) {
      metrics.push(
        this.createMetric(
          "accuracy.top5",
          accA.top5,
          accB.top5,
          true,
          samplesA,
          samplesB
        )
      );
    }

    // Preference accuracy (if available)
    if (accA.preference !== undefined && accB.preference !== undefined) {
      metrics.push(
        this.createMetric(
          "accuracy.preference",
          accA.preference,
          accB.preference,
          true,
          samplesA,
          samplesB
        )
      );
    }

    // Custom accuracy metrics
    for (const [name, valueA] of Object.entries(accA.custom)) {
      const valueB = accB.custom[name];
      if (valueB !== undefined) {
        metrics.push(
          this.createMetric(
            `accuracy.${name}`,
            valueA,
            valueB,
            true,
            samplesA,
            samplesB
          )
        );
      }
    }
  }

  /**
   * Add latency metric comparisons
   * @param metrics Comparison metrics array
   * @param latA Model A latency
   * @param latB Model B latency
   * @param samplesA Sample count for A
   * @param samplesB Sample count for B
   */
  private addLatencyComparison(
    metrics: ComparisonMetric[],
    latA: LatencyMetrics,
    latB: LatencyMetrics,
    samplesA: number,
    samplesB: number
  ): void {
    // P50, P95, P99, average latency (lower is better)
    metrics.push(
      this.createMetric(
        "latency.p50",
        latA.p50,
        latB.p50,
        false,
        samplesA,
        samplesB
      )
    );
    metrics.push(
      this.createMetric(
        "latency.p95",
        latA.p95,
        latB.p95,
        false,
        samplesA,
        samplesB
      )
    );
    metrics.push(
      this.createMetric(
        "latency.p99",
        latA.p99,
        latB.p99,
        false,
        samplesA,
        samplesB
      )
    );
    metrics.push(
      this.createMetric(
        "latency.avg",
        latA.avg,
        latB.avg,
        false,
        samplesA,
        samplesB
      )
    );
  }

  /**
   * Add memory metric comparisons
   * @param metrics Comparison metrics array
   * @param memA Model A memory
   * @param memB Model B memory
   */
  private addMemoryComparison(
    metrics: ComparisonMetric[],
    memA: MemoryMetrics,
    memB: MemoryMetrics
  ): void {
    metrics.push(
      this.createMetric(
        "memory.modelSize",
        memA.modelSize,
        memB.modelSize,
        false
      )
    );
    metrics.push(
      this.createMetric("memory.runtime", memA.runtime, memB.runtime, false)
    );
    metrics.push(this.createMetric("memory.peak", memA.peak, memB.peak, false));

    if (memA.gpu !== undefined && memB.gpu !== undefined) {
      metrics.push(this.createMetric("memory.gpu", memA.gpu, memB.gpu, false));
    }
  }

  /**
   * Add throughput metric comparisons
   * @param metrics Comparison metrics array
   * @param thrA Model A throughput
   * @param thrB Model B throughput
   */
  private addThroughputComparison(
    metrics: ComparisonMetric[],
    thrA: ThroughputMetrics,
    thrB: ThroughputMetrics
  ): void {
    metrics.push(this.createMetric("throughput.rps", thrA.rps, thrB.rps, true));

    if (thrA.sps !== undefined && thrB.sps !== undefined) {
      metrics.push(
        this.createMetric("throughput.sps", thrA.sps, thrB.sps, true)
      );
    }

    if (thrA.batch !== undefined && thrB.batch !== undefined) {
      metrics.push(
        this.createMetric("throughput.batch", thrA.batch, thrB.batch, true)
      );
    }
  }

  /**
   * Add quality metric comparisons
   * @param metrics Comparison metrics array
   * @param qualA Model A quality
   * @param qualB Model B quality
   * @param samplesA Sample count for A
   * @param samplesB Sample count for B
   */
  private addQualityComparison(
    metrics: ComparisonMetric[],
    qualA: QualityMetrics,
    qualB: QualityMetrics,
    samplesA = 1000,
    samplesB = 1000
  ): void {
    if (qualA.f1 !== undefined && qualB.f1 !== undefined) {
      metrics.push(
        this.createMetric(
          "quality.f1",
          qualA.f1,
          qualB.f1,
          true,
          samplesA,
          samplesB
        )
      );
    }
    if (qualA.precision !== undefined && qualB.precision !== undefined) {
      metrics.push(
        this.createMetric(
          "quality.precision",
          qualA.precision,
          qualB.precision,
          true,
          samplesA,
          samplesB
        )
      );
    }
    if (qualA.recall !== undefined && qualB.recall !== undefined) {
      metrics.push(
        this.createMetric(
          "quality.recall",
          qualA.recall,
          qualB.recall,
          true,
          samplesA,
          samplesB
        )
      );
    }
    if (qualA.auc !== undefined && qualB.auc !== undefined) {
      metrics.push(
        this.createMetric(
          "quality.auc",
          qualA.auc,
          qualB.auc,
          true,
          samplesA,
          samplesB
        )
      );
    }
  }

  /**
   * Create a comparison metric
   * @param name Metric name
   * @param valueA Value for model A
   * @param valueB Value for model B
   * @param higherIsBetter Whether higher value is better
   * @param samplesA Sample count for A (for statistical test)
   * @param samplesB Sample count for B
   * @returns Comparison metric
   */
  private createMetric(
    name: string,
    valueA: number,
    valueB: number,
    higherIsBetter: boolean,
    samplesA = 1000,
    samplesB = 1000
  ): ComparisonMetric {
    const difference = valueA - valueB;
    const relativeDifference =
      valueB !== 0 ? (difference / Math.abs(valueB)) * 100 : 0;

    // Perform statistical test (simplified z-test)
    const { significant, pValue } = this.performZTest(
      valueA,
      valueB,
      samplesA,
      samplesB
    );

    // Calculate effect size (Cohen's d)
    const effectSize = this.calculateCohensD(
      valueA,
      valueB,
      samplesA,
      samplesB
    );

    // Determine which is better
    let better: "A" | "B" | "tie" = "tie";
    if (difference > 0.001) {
      better = higherIsBetter ? "A" : "B";
    } else if (difference < -0.001) {
      better = higherIsBetter ? "B" : "A";
    }

    return {
      name,
      valueA,
      valueB,
      difference,
      relativeDifference,
      significant,
      pValue,
      effectSize,
      better,
    };
  }

  /**
   * Perform z-test for two proportions/means
   * @param valueA Value for A
   * @param valueB Value for B
   * @param samplesA Sample count for A
   * @param samplesB Sample count for B
   * @returns Test results
   */
  private performZTest(
    valueA: number,
    valueB: number,
    samplesA: number,
    samplesB: number
  ): { significant: boolean; pValue: number } {
    // Simplified z-test assuming standard deviation proportional to sqrt(p*(1-p)/n)
    const pooled =
      (valueA * samplesA + valueB * samplesB) / (samplesA + samplesB);
    const se = Math.sqrt(pooled * (1 - pooled) * (1 / samplesA + 1 / samplesB));

    if (se === 0) {
      return { significant: false, pValue: 1 };
    }

    const z = (valueA - valueB) / se;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));

    return {
      significant: pValue < 0.05,
      pValue,
    };
  }

  /**
   * Calculate Cohen's d effect size
   * @param valueA Value for A
   * @param valueB Value for B
   * @param samplesA Sample count for A
   * @param samplesB Sample count for B
   * @returns Effect size
   */
  private calculateCohensD(
    valueA: number,
    valueB: number,
    samplesA: number,
    samplesB: number
  ): number {
    // Simplified calculation assuming SD ~ sqrt(p*(1-p)) for proportions
    const pooledSD = Math.sqrt(
      ((samplesA - 1) * 0.25 + (samplesB - 1) * 0.25) /
        (samplesA + samplesB - 2)
    );
    return pooledSD > 0 ? (valueA - valueB) / pooledSD : 0;
  }

  /**
   * Standard normal CDF
   * @param x Value
   * @returns CDF value
   */
  private normalCDF(x: number): number {
    // Approximation of standard normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1 / (1 + p * x);
    const y =
      1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1 + sign * y);
  }

  /**
   * Determine overall winner
   * @param metrics Comparison metrics
   * @returns Winner and win counts
   */
  private determineWinner(metrics: ComparisonMetric[]): {
    winner: "A" | "B" | "tie";
    winsA: number;
    winsB: number;
  } {
    let winsA = 0;
    let winsB = 0;

    for (const metric of metrics) {
      if (metric.better === "A") {
        winsA++;
      } else if (metric.better === "B") {
        winsB++;
      }
    }

    let winner: "A" | "B" | "tie" = "tie";
    if (winsA > winsB) {
      winner = "A";
    } else if (winsB > winsA) {
      winner = "B";
    }

    return { winner, winsA, winsB };
  }

  /**
   * Perform overall statistical test
   * @param metrics Comparison metrics
   * @param samplesA Sample count for A
   * @param samplesB Sample count for B
   * @returns Statistical significance
   */
  private performOverallTest(
    metrics: ComparisonMetric[],
    samplesA: number,
    samplesB: number
  ): StatisticalSignificance {
    // Count significant metrics
    const significantMetrics = metrics.filter(m => m.significant);

    // Combine p-values using Fisher's method
    let chiSquared = 0;
    for (const metric of metrics) {
      if (metric.pValue !== undefined) {
        chiSquared -= 2 * Math.log(Math.max(metric.pValue, 1e-10));
      }
    }
    chiSquared *= 2;

    const degreesOfFreedom = 2 * metrics.length;
    // Simplified chi-squared CDF
    const pValue = 1 - this.chiSquaredCDF(chiSquared, degreesOfFreedom);

    // Calculate overall effect size
    const effectSizes = metrics
      .filter(m => m.effectSize !== undefined)
      .map(m => Math.abs(m.effectSize!));
    const avgEffectSize =
      effectSizes.length > 0
        ? effectSizes.reduce((a, b) => a + b, 0) / effectSizes.length
        : 0;

    // Confidence interval
    const margin = 1.96 * Math.sqrt(1 / samplesA + 1 / samplesB);

    return {
      test: "fisher_combined",
      pValue,
      significant: pValue < 0.05,
      effectSize: avgEffectSize,
      confidenceInterval: [-margin, margin],
    };
  }

  /**
   * Chi-squared CDF approximation
   * @param x Chi-squared value
   * @param k Degrees of freedom
   * @returns CDF value
   */
  private chiSquaredCDF(x: number, k: number): number {
    // Simplified approximation
    if (x <= 0) return 0;
    if (k === 2) {
      return 1 - Math.exp(-x / 2);
    }
    // For other cases, use Wilson-Hilferty approximation
    const z = Math.pow(x / k, 1 / 3) - (1 - 2 / (9 * k));
    const sigma = Math.sqrt(2 / (9 * k));
    return this.normalCDF(z / sigma);
  }

  /**
   * Generate recommendation
   * @param comparison Model comparison
   * @param winsA Number of wins for A
   * @param winsB Number of wins for B
   * @returns Recommendation text
   */
  private generateRecommendation(
    comparison: ModelComparison,
    winsA: number,
    winsB: number
  ): string {
    if (comparison.winner === "tie") {
      return "Both models perform similarly. Consider deployment constraints.";
    }

    const winner =
      comparison.winner === "A"
        ? comparison.modelA.name
        : comparison.modelB.name;
    const loser =
      comparison.winner === "A"
        ? comparison.modelB.name
        : comparison.modelA.name;

    if (comparison.confidence > 0.8) {
      return `Strongly recommend ${winner} over ${loser}. Significant improvements across multiple metrics.`;
    } else if (comparison.confidence > 0.5) {
      return `Recommend ${winner} over ${loser}. Moderate improvements detected.`;
    } else {
      return `${winner} shows slight advantages over ${loser}, but differences are not statistically significant.`;
    }
  }

  /**
   * Compare multiple models and find the best
   * @param candidates Model candidates with metrics
   * @returns Ranking of models
   */
  rankModels(
    candidates: Array<{ reference: ModelReference; metrics: ModelMetrics }>
  ): ModelRanking[] {
    const rankings: ModelRanking[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const score = this.calculateModelScore(candidates[i].metrics);

      // Compare against all others
      let wins = 0;
      let comparisons = 0;

      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue;

        const comparison = this.compareModels(
          candidates[i].reference,
          candidates[i].metrics,
          candidates[j].reference,
          candidates[j].metrics
        );

        comparisons++;
        if (comparison.winner === "A") {
          wins++;
        }
      }

      rankings.push({
        reference: candidates[i].reference,
        score,
        wins,
        comparisons,
        winRate: comparisons > 0 ? wins / comparisons : 0,
      });
    }

    return rankings.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate overall model score
   * @param metrics Model metrics
   * @returns Composite score
   */
  private calculateModelScore(metrics: ModelMetrics): number {
    let score = 0;

    // Accuracy (40% weight)
    score += metrics.accuracy.top1 * 0.4;

    // Latency (30% weight, inverted - lower is better)
    const latencyScore = Math.max(0, 1 - metrics.latency.avg / 1000); // Normalize to 0-1
    score += latencyScore * 0.3;

    // Memory (15% weight, inverted)
    const memoryScore = Math.max(0, 1 - metrics.memory.runtime / 10000); // Normalize to 0-1
    score += memoryScore * 0.15;

    // Throughput (15% weight)
    const throughputScore = Math.min(1, metrics.throughput.rps / 1000); // Normalize to 0-1
    score += throughputScore * 0.15;

    return score;
  }
}

/**
 * Model ranking result
 */
export interface ModelRanking {
  reference: ModelReference;
  score: number;
  wins: number;
  comparisons: number;
  winRate: number;
}
