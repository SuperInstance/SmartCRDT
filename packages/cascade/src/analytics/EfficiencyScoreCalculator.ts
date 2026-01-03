/**
 * EfficiencyScoreCalculator - Calculate cache efficiency scores
 *
 * Computes overall cache efficiency scores based on multiple metrics
 * and compares against baselines.
 *
 * Features:
 * - Multi-factor efficiency scoring
 * - Component breakdown
 * - Trend analysis
 * - Baseline comparison
 * - Grade assignment
 */

import type {
  EfficiencyScore,
  EfficiencyScoreComponents,
  EfficiencyScoreConfig,
  CacheMetricsSnapshot,
} from "@lsi/protocol";

/**
 * EfficiencyScoreCalculator - Cache efficiency scoring
 */
export class EfficiencyScoreCalculator {
  private config: EfficiencyScoreConfig;
  private baselineScores: number[] = [];

  constructor(config: EfficiencyScoreConfig) {
    this.config = config;
  }

  /**
   * Calculate efficiency score from metrics snapshot
   */
  calculate(metrics: CacheMetricsSnapshot): EfficiencyScore {
    const components = this.calculateComponents(metrics);
    const overall = this.calculateOverall(components);

    // Determine trend
    const trend = this.calculateTrend();

    // Calculate percentile
    const percentile = this.calculatePercentile(overall);

    // Calculate grade
    const grade = this.calculateGrade(overall);

    // Baseline comparison
    const baselineComparison = this.calculateBaselineComparison(overall);

    return {
      overall,
      grade,
      components,
      trend,
      percentile,
      baselineComparison,
      calculatedAt: Date.now(),
    };
  }

  /**
   * Update baseline score
   */
  updateBaseline(score: number): void {
    this.baselineScores.push(score);
    // Keep only last 100 baseline scores
    if (this.baselineScores.length > 100) {
      this.baselineScores.shift();
    }
  }

  /**
   * Calculate component scores
   */
  private calculateComponents(
    metrics: CacheMetricsSnapshot
  ): EfficiencyScoreComponents {
    return {
      hitRateScore: this.calculateHitRateScore(metrics),
      memoryScore: this.calculateMemoryScore(metrics),
      latencyScore: this.calculateLatencyScore(metrics),
      evictionScore: this.calculateEvictionScore(metrics),
      patternScore: this.calculatePatternScore(metrics),
    };
  }

  /**
   * Calculate overall score from components
   */
  private calculateOverall(components: EfficiencyScoreComponents): number {
    const weightedSum =
      components.hitRateScore * this.config.hitRateWeight +
      components.memoryScore * this.config.memoryWeight +
      components.latencyScore * this.config.latencyWeight +
      components.evictionScore * this.config.evictionWeight +
      components.patternScore * this.config.patternWeight;

    return Math.min(100, Math.max(0, weightedSum));
  }

  /**
   * Calculate hit rate score (0-100)
   */
  private calculateHitRateScore(metrics: CacheMetricsSnapshot): number {
    const hitRate = metrics.hitRate.overall;

    // Hit rate score: 70% = 60 points, 80% = 80 points, 90%+ = 100 points
    if (hitRate >= 0.9) return 100;
    if (hitRate >= 0.8) return 80 + (hitRate - 0.8) * 200;
    if (hitRate >= 0.7) return 60 + (hitRate - 0.7) * 200;
    return hitRate * 85.7; // 0-70% maps to 0-60 points
  }

  /**
   * Calculate memory score (0-100)
   */
  private calculateMemoryScore(metrics: CacheMetricsSnapshot): number {
    const usagePercent = metrics.memory.usagePercent;

    // Memory score: lower usage is better
    // < 50% = 100 points, 50-80% = 100-50 points, > 80% = 50-0 points
    if (usagePercent < 0.5) return 100;
    if (usagePercent < 0.8) return 100 - (usagePercent - 0.5) * 166.67;
    return Math.max(0, 50 - (usagePercent - 0.8) * 250);
  }

  /**
   * Calculate latency score (0-100)
   */
  private calculateLatencyScore(metrics: CacheMetricsSnapshot): number {
    const p95 = metrics.latency.p95;

    // Latency score: < 10ms = 100 points, 10-50ms = 100-60 points, > 50ms = 60-0 points
    if (p95 < 10) return 100;
    if (p95 < 50) return 100 - (p95 - 10) * 1;
    if (p95 < 100) return 60 - (p95 - 50) * 1.2;
    return Math.max(0, 0);
  }

  /**
   * Calculate eviction score (0-100)
   */
  private calculateEvictionScore(metrics: CacheMetricsSnapshot): number {
    const evictionRate = metrics.entries.evictionRate;

    // Eviction score: < 1/s = 100 points, 1-10/s = 100-50 points, > 10/s = 50-0 points
    if (evictionRate < 1) return 100;
    if (evictionRate < 10) return 100 - (evictionRate - 1) * 5.56;
    return Math.max(0, 50 - (evictionRate - 10) * 5);
  }

  /**
   * Calculate pattern score (0-100)
   */
  private calculatePatternScore(metrics: CacheMetricsSnapshot): number {
    const repetitionRate = metrics.patterns.repetitionRate;

    // Pattern score: higher repetition is better (more cacheable)
    // > 50% = 100 points, 30-50% = 100-70 points, < 30% = 70-0 points
    if (repetitionRate > 0.5) return 100;
    if (repetitionRate > 0.3) return 70 + (repetitionRate - 0.3) * 150;
    return repetitionRate * 233.33; // 0-30% maps to 0-70 points
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(): "improving" | "stable" | "declining" {
    if (this.baselineScores.length < 5) {
      return "stable";
    }

    const recent = this.baselineScores.slice(-10);
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const delta = secondAvg - firstAvg;

    if (delta > 2) {
      return "improving";
    } else if (delta < -2) {
      return "declining";
    } else {
      return "stable";
    }
  }

  /**
   * Calculate percentile ranking
   */
  private calculatePercentile(score: number): number {
    // Simplified percentile based on score distribution
    // Assumes normal distribution centered at 75 with std dev of 15
    const mean = 75;
    const stdDev = 15;
    const zScore = (score - mean) / stdDev;

    // Approximate percentile from z-score using error function approximation
    const t = 1 / (1 + 0.2316419 * Math.abs(zScore));
    const d = 0.3989423 * Math.exp((-zScore * zScore) / 2);
    const p = 1 - d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    return Math.max(0, Math.min(100, (zScore > 0 ? p : 1 - p) * 100));
  }

  /**
   * Calculate grade from score
   */
  private calculateGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  /**
   * Calculate baseline comparison
   */
  private calculateBaselineComparison(currentScore: number) {
    const baseline = this.config.baselineScore ?? 75;
    const delta = currentScore - baseline;
    const deltaPercent = baseline > 0 ? (delta / baseline) * 100 : 0;

    return {
      baseline,
      current: currentScore,
      delta,
      deltaPercent,
    };
  }

  /**
   * Get average baseline score
   */
  getAverageBaseline(): number | null {
    if (this.baselineScores.length === 0) {
      return null;
    }
    return (
      this.baselineScores.reduce((a, b) => a + b, 0) / this.baselineScores.length
    );
  }

  /**
   * Reset calculator state
   */
  reset(): void {
    this.baselineScores = [];
  }
}
