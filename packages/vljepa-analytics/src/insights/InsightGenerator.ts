/**
 * InsightGenerator - Generates insights from analytics data
 * Detects trends, anomalies, correlations, and provides recommendations
 */

import { EventEmitter } from "eventemitter3";
import type {
  Insight,
  InsightType,
  InsightConfig,
  InsightData,
} from "../types.js";

export class InsightGenerator extends EventEmitter {
  private config: InsightConfig;
  private insights: Map<string, Insight> = new Map();
  private metricHistory: Map<
    string,
    Array<{ value: number; timestamp: number }>
  > = new Map();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<InsightConfig> = {}) {
    super();

    this.config = {
      minConfidence: config.minConfidence ?? 0.7,
      lookbackPeriod: config.lookbackPeriod ?? 24 * 60 * 60 * 1000, // 24 hours
      refreshInterval: config.refreshInterval ?? 60 * 60 * 1000, // 1 hour
      categories: config.categories ?? [
        "trend",
        "anomaly",
        "correlation",
        "recommendation",
      ],
    };

    this.startRefreshTimer();
  }

  /**
   * Record metric value
   */
  recordMetric(name: string, value: number): void {
    if (!this.metricHistory.has(name)) {
      this.metricHistory.set(name, []);
    }

    const history = this.metricHistory.get(name)!;
    history.push({ value, timestamp: Date.now() });

    // Keep only data within lookback period
    const cutoff = Date.now() - this.config.lookbackPeriod;
    const filtered = history.filter(d => d.timestamp >= cutoff);
    this.metricHistory.set(name, filtered);

    // Check for anomalies immediately
    this.detectAnomaly(name, value);
  }

  /**
   * Generate insights
   */
  async generateInsights(): Promise<Insight[]> {
    const newInsights: Insight[] = [];

    // Generate trend insights
    if (this.config.categories.includes("trend")) {
      newInsights.push(...this.detectTrends());
    }

    // Generate anomaly insights
    if (this.config.categories.includes("anomaly")) {
      newInsights.push(...this.detectAllAnomalies());
    }

    // Generate correlation insights
    if (this.config.categories.includes("correlation")) {
      newInsights.push(...this.detectCorrelations());
    }

    // Generate recommendations
    if (this.config.categories.includes("recommendation")) {
      newInsights.push(...this.generateRecommendations());
    }

    // Store and emit insights
    for (const insight of newInsights) {
      this.insights.set(insight.id, insight);
      this.emit("insight", insight);
    }

    return newInsights.filter(i => i.confidence >= this.config.minConfidence);
  }

  /**
   * Detect trends
   */
  private detectTrends(): Insight[] {
    const insights: Insight[] = [];

    for (const [metric, history] of this.metricHistory) {
      if (history.length < 10) continue;

      const trend = this.calculateTrend(history);
      if (!trend) continue;

      const direction =
        trend.slope > 0.1 ? "up" : trend.slope < -0.1 ? "down" : "stable";
      const volatility = this.calculateVolatility(history);

      const title = `${metric} is ${direction === "up" ? "increasing" : direction === "down" ? "decreasing" : "stable"}`;
      const description = `${metric} has a ${direction} trend with ${volatility > 0.2 ? "high" : "low"} volatility`;

      insights.push({
        id: this.generateId(),
        type: "trend",
        title,
        description,
        confidence: Math.abs(trend.correlation),
        impact: Math.abs(trend.slope) > 0.5 ? "high" : "medium",
        actionable: direction === "down",
        suggestedActions:
          direction === "down"
            ? [
                `Investigate drop in ${metric}`,
                "Review recent changes",
                "Check for errors",
              ]
            : [`Continue current strategy for ${metric}`],
        data: {
          metric,
          currentValue: history[history.length - 1].value,
          previousValue: history[0].value,
          change: history[history.length - 1].value - history[0].value,
          changePercent:
            history[0].value !== 0
              ? ((history[history.length - 1].value - history[0].value) /
                  history[0].value) *
                100
              : 0,
          trend: direction,
        },
        timestamp: Date.now(),
        dismissed: false,
      });
    }

    return insights;
  }

  /**
   * Detect anomaly for a single metric
   */
  private detectAnomaly(metric: string, value: number): void {
    const history = this.metricHistory.get(metric);
    if (!history || history.length < 20) return;

    const { mean, stdDev } = this.calculateStatistics(history);
    const zScore = stdDev > 0 ? (value - mean) / stdDev : 0;

    if (Math.abs(zScore) > 3) {
      const insight: Insight = {
        id: this.generateId(),
        type: "anomaly",
        title: `Anomaly detected in ${metric}`,
        description: `${metric} value ${value.toFixed(2)} is ${zScore > 0 ? "above" : "below"} normal range`,
        confidence: Math.min(1, Math.abs(zScore) / 3),
        impact: Math.abs(zScore) > 4 ? "high" : "medium",
        actionable: true,
        suggestedActions: [
          "Investigate the cause of this anomaly",
          "Check for data quality issues",
          "Review recent system changes",
        ],
        data: {
          metric,
          currentValue: value,
          expected: mean,
          deviation: Math.abs(zScore),
        },
        timestamp: Date.now(),
        dismissed: false,
      };

      this.insights.set(insight.id, insight);
      this.emit("insight", insight);
    }
  }

  /**
   * Detect all anomalies
   */
  private detectAllAnomalies(): Insight[] {
    const insights: Insight[] = [];

    for (const [metric, history] of this.metricHistory) {
      if (history.length < 20) continue;

      const { mean, stdDev } = this.calculateStatistics(history);

      for (const dataPoint of history) {
        const zScore = stdDev > 0 ? (dataPoint.value - mean) / stdDev : 0;

        if (Math.abs(zScore) > 3) {
          insights.push({
            id: this.generateId(),
            type: "anomaly",
            title: `Historical anomaly in ${metric}`,
            description: `${metric} was ${zScore > 0 ? "above" : "below"} normal range`,
            confidence: Math.min(1, Math.abs(zScore) / 3),
            impact: Math.abs(zScore) > 4 ? "high" : "medium",
            actionable: false,
            suggestedActions: [],
            data: {
              metric,
              currentValue: dataPoint.value,
              expected: mean,
              deviation: Math.abs(zScore),
            },
            timestamp: dataPoint.timestamp,
            dismissed: false,
          });
        }
      }
    }

    return insights;
  }

  /**
   * Detect correlations
   */
  private detectCorrelations(): Insight[] {
    const insights: Insight[] = [];
    const metrics = Array.from(this.metricHistory.keys());

    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const metric1 = metrics[i];
        const metric2 = metrics[j];

        const history1 = this.metricHistory.get(metric1)!;
        const history2 = this.metricHistory.get(metric2)!;

        if (history1.length < 10 || history2.length < 10) continue;

        const correlation = this.calculateCorrelation(history1, history2);

        if (Math.abs(correlation) > 0.8) {
          insights.push({
            id: this.generateId(),
            type: "correlation",
            title: `Strong correlation between ${metric1} and ${metric2}`,
            description: `${metric1} and ${metric2} have a correlation coefficient of ${correlation.toFixed(2)}`,
            confidence: Math.abs(correlation),
            impact: "medium",
            actionable: true,
            suggestedActions: [
              `Consider if changes to ${metric1} affect ${metric2}`,
              "Investigate causal relationship",
              "Use this correlation for forecasting",
            ],
            data: {
              correlation: {
                metric1,
                metric2,
                coefficient: correlation,
              },
            },
            timestamp: Date.now(),
            dismissed: false,
          });
        }
      }
    }

    return insights;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(): Insight[] {
    const insights: Insight[] = [];

    // Find metrics with declining trends
    for (const [metric, history] of this.metricHistory) {
      if (history.length < 10) continue;

      const trend = this.calculateTrend(history);
      if (!trend || trend.slope >= -0.1) continue;

      const recentValue = history[history.length - 1].value;
      const oldValue = history[0].value;
      const decline = ((oldValue - recentValue) / oldValue) * 100;

      if (decline > 20) {
        insights.push({
          id: this.generateId(),
          type: "recommendation",
          title: `Action needed: ${metric} declined by ${decline.toFixed(1)}%`,
          description: `${metric} has shown a consistent decline over the analysis period`,
          confidence: Math.abs(trend.correlation),
          impact: decline > 50 ? "high" : "medium",
          actionable: true,
          suggestedActions: [
            "Analyze the root cause of the decline",
            "Implement corrective actions",
            "Monitor closely for recovery",
            "Consider A/B testing solutions",
          ],
          data: {
            metric,
            currentValue: recentValue,
            previousValue: oldValue,
            changePercent: -decline,
            trend: "down",
          },
          timestamp: Date.now(),
          dismissed: false,
        });
      }
    }

    return insights;
  }

  /**
   * Calculate trend
   */
  private calculateTrend(
    history: Array<{ value: number; timestamp: number }>
  ): {
    slope: number;
    correlation: number;
  } | null {
    if (history.length < 2) return null;

    const n = history.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0,
      sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = history[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const correlation =
      (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return { slope, correlation: isNaN(correlation) ? 0 : correlation };
  }

  /**
   * Calculate statistics
   */
  private calculateStatistics(history: Array<{ value: number }>): {
    mean: number;
    stdDev: number;
  } {
    const values = history.map(h => h.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    return {
      mean,
      stdDev: Math.sqrt(variance),
    };
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(history: Array<{ value: number }>): number {
    const { mean, stdDev } = this.calculateStatistics(history);
    return mean > 0 ? stdDev / mean : 0;
  }

  /**
   * Calculate correlation between two metrics
   */
  private calculateCorrelation(
    history1: Array<{ value: number }>,
    history2: Array<{ value: number }>
  ): number {
    const n = Math.min(history1.length, history2.length);
    if (n < 2) return 0;

    const values1 = history1.slice(-n).map(h => h.value);
    const values2 = history2.slice(-n).map(h => h.value);

    const mean1 = values1.reduce((a, b) => a + b, 0) / n;
    const mean2 = values2.reduce((a, b) => a + b, 0) / n;

    let sumXY = 0,
      sumX2 = 0,
      sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const dx = values1[i] - mean1;
      const dy = values2[i] - mean2;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    const denominator = Math.sqrt(sumX2 * sumY2);
    return denominator > 0 ? sumXY / denominator : 0;
  }

  /**
   * Get all insights
   */
  getInsights(): Insight[] {
    return Array.from(this.insights.values()).filter(i => !i.dismissed);
  }

  /**
   * Get insights by type
   */
  getInsightsByType(type: InsightType): Insight[] {
    return this.getInsights().filter(i => i.type === type);
  }

  /**
   * Dismiss an insight
   */
  dismissInsight(id: string): void {
    const insight = this.insights.get(id);
    if (insight) {
      insight.dismissed = true;
      this.emit("insightDismissed", insight);
    }
  }

  /**
   * Clear dismissed insights
   */
  clearDismissed(): void {
    for (const [id, insight] of this.insights) {
      if (insight.dismissed) {
        this.insights.delete(id);
      }
    }
  }

  /**
   * Start refresh timer
   */
  private startRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.generateInsights();
    }, this.config.refreshInterval);
  }

  /**
   * Stop refresh timer
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
