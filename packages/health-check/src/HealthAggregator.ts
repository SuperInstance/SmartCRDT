/**
 * Health Aggregator
 *
 * Aggregates multiple health checks with weighted scoring and trend analysis.
 */

import type {
  HealthMetric,
  HealthStatus,
  AggregationConfig,
  TrendData,
  WorkerHealth,
} from "./types.js";

/**
 * Health Aggregator class
 */
export class HealthAggregator {
  private config: AggregationConfig;
  private history: Map<string, number[]>;

  constructor(config: AggregationConfig = { strategy: "average" }) {
    this.config = config;
    this.history = new Map();
  }

  /**
   * Aggregate health metrics
   */
  aggregate(metrics: HealthMetric[]): {
    score: number;
    status: HealthStatus;
    weight: number;
  } {
    if (metrics.length === 0) {
      return { score: 0, status: "unknown", weight: 0 };
    }

    let score: number;

    switch (this.config.strategy) {
      case "average":
        score = this.calculateAverage(metrics);
        break;

      case "weighted":
        score = this.calculateWeighted(metrics);
        break;

      case "min":
        score = this.calculateMin(metrics);
        break;

      case "max":
        score = this.calculateMax(metrics);
        break;

      case "custom":
        score = this.config.customFunction
          ? this.config.customFunction(metrics)
          : this.calculateAverage(metrics);
        break;

      default:
        score = this.calculateAverage(metrics);
    }

    const status = this.scoreToStatus(score);
    const weight = this.calculateWeight(metrics);

    return { score, status, weight };
  }

  /**
   * Calculate average score
   */
  private calculateAverage(metrics: HealthMetric[]): number {
    if (metrics.length === 0) return 0;

    const sum = metrics.reduce((acc, m) => {
      const value = this.normalizeMetric(m);
      return acc + value;
    }, 0);

    return sum / metrics.length;
  }

  /**
   * Calculate weighted average score
   */
  private calculateWeighted(metrics: HealthMetric[]): number {
    if (metrics.length === 0 || !this.config.weights) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const metric of metrics) {
      const weight = this.config.weights.get(metric.name) || 1;
      const value = this.normalizeMetric(metric);

      weightedSum += value * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Calculate minimum score
   */
  private calculateMin(metrics: HealthMetric[]): number {
    if (metrics.length === 0) return 0;

    const values = metrics.map(m => this.normalizeMetric(m));
    return Math.min(...values);
  }

  /**
   * Calculate maximum score
   */
  private calculateMax(metrics: HealthMetric[]): number {
    if (metrics.length === 0) return 0;

    const values = metrics.map(m => this.normalizeMetric(m));
    return Math.max(...values);
  }

  /**
   * Normalize metric to 0-100 scale
   */
  private normalizeMetric(metric: HealthMetric): number {
    // If metric is already a percentage
    if (metric.unit === "%") {
      return metric.value;
    }

    // If metric has critical threshold
    if (metric.criticalThreshold) {
      const ratio = metric.value / metric.criticalThreshold;
      return Math.max(0, Math.min(100, (1 - ratio) * 100));
    }

    // If metric has warning threshold
    if (metric.warningThreshold) {
      const ratio = metric.value / metric.warningThreshold;
      return Math.max(0, Math.min(100, (1 - ratio) * 100));
    }

    // Use status-based scoring
    switch (metric.status) {
      case "healthy":
        return 100;
      case "degraded":
        return 60;
      case "unhealthy":
        return 20;
      case "unknown":
        return 50;
      default:
        return 50;
    }
  }

  /**
   * Convert score to health status
   */
  private scoreToStatus(score: number): HealthStatus {
    if (score >= 80) return "healthy";
    if (score >= 50) return "degraded";
    if (score > 0) return "unhealthy";
    return "unknown";
  }

  /**
   * Calculate weight of aggregation
   */
  private calculateWeight(metrics: HealthMetric[]): number {
    if (this.config.minChecks && metrics.length < this.config.minChecks) {
      return metrics.length / this.config.minChecks;
    }
    return 1;
  }

  /**
   * Aggregate multiple worker health states
   */
  aggregateWorkers(workers: WorkerHealth[]): {
    overallScore: number;
    overallStatus: HealthStatus;
    workerScores: Map<string, number>;
  } {
    if (workers.length === 0) {
      return {
        overallScore: 0,
        overallStatus: "unknown",
        workerScores: new Map(),
      };
    }

    const workerScores = new Map<string, number>();

    for (const worker of workers) {
      const aggregation = this.aggregate(worker.metrics);
      workerScores.set(worker.workerId, aggregation.score);
    }

    const overallScore =
      Array.from(workerScores.values()).reduce((a, b) => a + b, 0) /
      workerScores.size;
    const overallStatus = this.scoreToStatus(overallScore);

    return {
      overallScore,
      overallStatus,
      workerScores,
    };
  }

  /**
   * Analyze trends for a metric
   */
  analyzeTrends(metricName: string, period: number = 5): TrendData | null {
    const history = this.history.get(metricName);
    if (!history || history.length < 2) {
      return null;
    }

    const current = history[history.length - 1];
    const previous = history[Math.max(0, history.length - period - 1)];

    const changePercent =
      previous !== 0 ? ((current - previous) / previous) * 100 : 0;

    let trend: "up" | "down" | "stable";
    if (Math.abs(changePercent) < 5) {
      trend = "stable";
    } else {
      trend = changePercent > 0 ? "up" : "down";
    }

    return {
      metric: metricName,
      current,
      previous,
      changePercent,
      trend,
      period,
    };
  }

  /**
   * Add metric value to history
   */
  addToHistory(metricName: string, value: number): void {
    if (!this.history.has(metricName)) {
      this.history.set(metricName, []);
    }

    const metricHistory = this.history.get(metricName)!;
    metricHistory.push(value);

    // Keep last 100 values
    if (metricHistory.length > 100) {
      metricHistory.shift();
    }
  }

  /**
   * Get metric history
   */
  getHistory(metricName: string, limit?: number): number[] {
    const history = this.history.get(metricName);
    if (!history) return [];

    return limit ? history.slice(-limit) : [...history];
  }

  /**
   * Clear history for a metric
   */
  clearHistory(metricName?: string): void {
    if (metricName) {
      this.history.delete(metricName);
    } else {
      this.history.clear();
    }
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(metricName: string, window: number = 5): number {
    const history = this.getHistory(metricName, window);
    if (history.length === 0) return 0;

    const sum = history.reduce((a, b) => a + b, 0);
    return sum / history.length;
  }

  /**
   * Detect anomalies in metric history
   */
  detectAnomalies(
    metricName: string,
    threshold: number = 2
  ): Array<{ index: number; value: number; deviation: number }> {
    const history = this.getHistory(metricName);
    if (history.length < 3) return [];

    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const variance =
      history.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      history.length;
    const stdDev = Math.sqrt(variance);

    const anomalies: Array<{
      index: number;
      value: number;
      deviation: number;
    }> = [];

    for (let i = 0; i < history.length; i++) {
      const zScore = Math.abs((history[i] - mean) / (stdDev || 1));
      if (zScore > threshold) {
        anomalies.push({
          index: i,
          value: history[i],
          deviation: zScore,
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate health velocity (rate of change)
   */
  calculateVelocity(
    metricName: string,
    window: number = 3
  ): {
    velocity: number;
    acceleration: number;
  } {
    const history = this.getHistory(metricName, window + 1);
    if (history.length < 2) {
      return { velocity: 0, acceleration: 0 };
    }

    // Calculate first derivative (velocity)
    const velocities: number[] = [];
    for (let i = 1; i < history.length; i++) {
      velocities.push(history[i] - history[i - 1]);
    }

    const velocity =
      velocities.length > 0
        ? velocities.reduce((a, b) => a + b, 0) / velocities.length
        : 0;

    // Calculate second derivative (acceleration)
    const accelerations: number[] = [];
    for (let i = 1; i < velocities.length; i++) {
      accelerations.push(velocities[i] - velocities[i - 1]);
    }

    const acceleration =
      accelerations.length > 0
        ? accelerations.reduce((a, b) => a + b, 0) / accelerations.length
        : 0;

    return { velocity, acceleration };
  }

  /**
   * Predict future values based on trend
   */
  predict(metricName: string, steps: number = 1): number | null {
    const history = this.getHistory(metricName, 10);
    if (history.length < 3) return null;

    // Simple linear regression
    const n = history.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += history[i];
      sumXY += i * history[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return slope * (n + steps - 1) + intercept;
  }

  /**
   * Get all metric names with history
   */
  getTrackedMetrics(): string[] {
    return Array.from(this.history.keys());
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AggregationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AggregationConfig {
    return { ...this.config };
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.history.clear();
  }
}
