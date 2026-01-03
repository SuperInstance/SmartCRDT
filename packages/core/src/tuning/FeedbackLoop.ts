/**
 * @lsi/core/tuning - FeedbackLoop for Aequor Cognitive Orchestration Platform
 *
 * Feedback loop implementation with:
 * - Feedback collection from system metrics
 * - Performance trend analysis
 * - Anomaly detection in tuning results
 * - Automatic rollback on degradation
 * - Baseline management and learning
 */

import {
  PerformanceMetrics,
  TuningHistoryEntry,
  TunableParameter,
} from "./AutoTuner.js";
import {
  AnomalyDetector,
  AnomalyResult,
  AnomalyReport,
} from "./AnomalyDetector.js";

/**
 * Feedback loop configuration
 */
export interface FeedbackConfig {
  /** Collection interval in milliseconds */
  collection_interval: number;
  /** Baseline window size (number of samples) */
  baseline_window: number;
  /** Degradation threshold (0-1) */
  degradation_threshold: number;
  /** Rollback threshold (0-1) */
  rollback_threshold: number;
  /** Trend analysis window size */
  trend_window: number;
  /** Enable automatic rollback */
  enable_auto_rollback: boolean;
  /** Minimum confidence for trend detection */
  min_trend_confidence: number;
}

/**
 * System metrics collected for feedback
 */
export interface SystemMetrics {
  /** Timestamp */
  timestamp: number;
  /** Performance metrics */
  performance: PerformanceMetrics;
  /** Resource utilization */
  utilization: {
    memoryPercent: number;
    cpuPercent: number;
    diskPercent: number;
    networkBandwidth: number;
  };
  /** Application-specific metrics */
  application: {
    cacheHitRate: number;
    errorCount: number;
    requestCount: number;
  };
}

/**
 * Performance data with context
 */
export interface PerformanceData {
  /** Metrics */
  metrics: SystemMetrics;
  /** Context information */
  context: {
    workload: string;
    timeOfDay: number;
    dayOfWeek: number;
  };
  /** Active tunings */
  activeTunings: string[];
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  /** Direction */
  direction: "improving" | "degrading" | "stable";
  /** Confidence score (0-1) */
  confidence: number;
  /** Rate of change per unit time */
  rateOfChange: number;
  /** Affected metrics */
  affectedMetrics: string[];
  /** Predicted values (next N steps) */
  prediction: {
    steps: number;
    values: number[];
  };
}

/**
 * Degradation report
 */
export interface DegradationReport {
  /** Whether degradation occurred */
  isDegraded: boolean;
  /** Severity level */
  severity: "low" | "medium" | "high" | "critical";
  /** Degraded metrics */
  degradedMetrics: {
    name: string;
    previousValue: number;
    currentValue: number;
    percentChange: number;
  }[];
  /** Overall degradation score (0-1) */
  degradationScore: number;
  /** Recommended actions */
  recommendations: string[];
}

/**
 * Feedback data
 */
export interface Feedback {
  /** Timestamp */
  timestamp: number;
  /** Current metrics */
  metrics: SystemMetrics;
  /** Previous metrics for comparison */
  previousMetrics: SystemMetrics | null;
  /** Trend analysis */
  trends: Map<string, TrendAnalysis>;
  /** Degradation report */
  degradation: DegradationReport;
  /** Anomalies detected */
  anomalies: AnomalyResult[];
}

/**
 * Tuning result for feedback evaluation
 */
export interface TuningResult {
  /** Parameter that was tuned */
  parameter: string;
  /** Old value */
  oldValue: number;
  /** New value */
  newValue: number;
  /** Performance before */
  performanceBefore: PerformanceMetrics;
  /** Performance after */
  performanceAfter: PerformanceMetrics;
  /** Improvement score */
  improvement: number;
  /** Successful flag */
  successful: boolean;
}

/**
 * Adjustment recommendation
 */
export interface AdjustmentRecommendation {
  /** Type of adjustment */
  type: "increase" | "decrease" | "restore" | "no_action";
  /** Target parameter */
  parameter: string;
  /** Recommended value */
  value: number;
  /** Confidence (0-1) */
  confidence: number;
  /** Reason for recommendation */
  reason: string;
  /** Expected impact */
  expectedImpact: {
    metric: string;
    change: number;
  }[];
}

/**
 * Default feedback configuration
 */
export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  collection_interval: 10000, // 10 seconds
  baseline_window: 100,
  degradation_threshold: 0.1,
  rollback_threshold: 0.15,
  trend_window: 20,
  enable_auto_rollback: true,
  min_trend_confidence: 0.6,
};

/**
 * FeedbackLoop - Collects and analyzes feedback from system metrics
 *
 * The FeedbackLoop continuously monitors system performance,
 * detects trends and anomalies, and recommends adjustments.
 */
export class FeedbackLoop {
  private baseline: SystemMetrics[] = [];
  private history: SystemMetrics[] = [];
  private feedbackHistory: Feedback[] = [];
  private anomalyDetector: AnomalyDetector;
  private config: FeedbackConfig;

  constructor(
    config: Partial<FeedbackConfig> = {},
    anomalyDetector?: AnomalyDetector
  ) {
    this.config = { ...DEFAULT_FEEDBACK_CONFIG, ...config };
    this.anomalyDetector = anomalyDetector || new AnomalyDetector();
  }

  /**
   * Collect system metrics
   */
  async collect_metrics(): Promise<SystemMetrics> {
    // In a real implementation, this would gather actual metrics from the system
    // For now, generate synthetic metrics
    const now = Date.now();

    // Simulate metrics with some variation
    const baseMetrics: SystemMetrics = {
      timestamp: now,
      performance: {
        latency: {
          p50: 80 + Math.random() * 40,
          p95: 150 + Math.random() * 100,
          p99: 250 + Math.random() * 150,
        },
        throughput: 40 + Math.random() * 60,
        errorRate: 0.005 + Math.random() * 0.02,
        qualityScore: 0.85 + Math.random() * 0.12,
        costPerRequest: 0.0008 + Math.random() * 0.0004,
        resourceUsage: {
          memoryMB: 400 + Math.random() * 300,
          cpuPercent: 25 + Math.random() * 40,
        },
      },
      utilization: {
        memoryPercent: 40 + Math.random() * 30,
        cpuPercent: 25 + Math.random() * 40,
        diskPercent: 30 + Math.random() * 20,
        networkBandwidth: 10 + Math.random() * 90,
      },
      application: {
        cacheHitRate: 0.6 + Math.random() * 0.3,
        errorCount: Math.floor(Math.random() * 10),
        requestCount: Math.floor(100 + Math.random() * 900),
      },
    };

    // Add to history
    this.history.push(baseMetrics);
    if (this.history.length > this.config.baseline_window * 2) {
      this.history = this.history.slice(-this.config.baseline_window * 2);
    }

    return baseMetrics;
  }

  /**
   * Collect performance data with context
   */
  async collect_performance_data(): Promise<PerformanceData> {
    const metrics = await this.collect_metrics();
    const now = Date.now();
    const date = new Date(now);

    return {
      metrics,
      context: {
        workload: this.detectWorkloadType(metrics),
        timeOfDay: date.getHours(),
        dayOfWeek: date.getDay(),
      },
      activeTunings: [], // Would be populated from actual tuning state
    };
  }

  /**
   * Detect workload type from metrics
   */
  private detectWorkloadType(metrics: SystemMetrics): string {
    const { throughput, latency, errorRate } = metrics.performance;

    if (throughput > 80 && latency.p95 < 100) {
      return "high_throughput";
    } else if (throughput < 20 && latency.p95 > 200) {
      return "low_traffic";
    } else if (errorRate > 0.05) {
      return "error_prone";
    } else if (metrics.application.cacheHitRate > 0.8) {
      return "cache_heavy";
    } else {
      return "balanced";
    }
  }

  /**
   * Analyze performance trends
   */
  analyze_trends(): Map<string, TrendAnalysis> {
    const trends = new Map<string, TrendAnalysis>();

    if (this.history.length < this.config.trend_window) {
      return trends;
    }

    const window = this.history.slice(-this.config.trend_window);

    // Analyze each metric
    const metricsToAnalyze = [
      {
        name: "latency.p95",
        extract: (m: SystemMetrics) => m.performance.latency.p95,
        optimize: "minimize" as const,
      },
      {
        name: "throughput",
        extract: (m: SystemMetrics) => m.performance.throughput,
        optimize: "maximize" as const,
      },
      {
        name: "qualityScore",
        extract: (m: SystemMetrics) => m.performance.qualityScore,
        optimize: "maximize" as const,
      },
      {
        name: "errorRate",
        extract: (m: SystemMetrics) => m.performance.errorRate,
        optimize: "minimize" as const,
      },
      {
        name: "costPerRequest",
        extract: (m: SystemMetrics) => m.performance.costPerRequest,
        optimize: "minimize" as const,
      },
      {
        name: "cacheHitRate",
        extract: (m: SystemMetrics) => m.application.cacheHitRate,
        optimize: "maximize" as const,
      },
    ];

    for (const metric of metricsToAnalyze) {
      const values = window.map(metric.extract);
      const trend = this.calculateTrend(values, metric.optimize);
      if (trend.confidence >= this.config.min_trend_confidence) {
        trends.set(metric.name, trend);
      }
    }

    return trends;
  }

  /**
   * Calculate trend for a series of values
   */
  private calculateTrend(
    values: number[],
    optimize: "minimize" | "maximize"
  ): TrendAnalysis {
    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = values.reduce((sum, y, x) => {
      const predicted = slope * x + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    const confidence = Math.max(0, Math.min(1, rSquared));

    // Determine direction based on optimization goal
    const direction =
      optimize === "maximize"
        ? slope > 0.01
          ? "improving"
          : slope < -0.01
            ? "degrading"
            : "stable"
        : slope < -0.01
          ? "improving"
          : slope > 0.01
            ? "degrading"
            : "stable";

    // Predict next values
    const prediction = {
      steps: 5,
      values: Array.from({ length: 5 }, (_, i) => slope * (n + i) + intercept),
    };

    return {
      direction,
      confidence,
      rateOfChange: slope,
      affectedMetrics: [],
      prediction,
    };
  }

  /**
   * Detect performance degradation
   */
  detect_degradation(
    previous: SystemMetrics,
    current: SystemMetrics
  ): DegradationReport {
    const degradedMetrics: DegradationReport["degradedMetrics"] = [];
    const threshold = this.config.degradation_threshold;

    // Check latency (increase is bad)
    const latencyChange =
      (current.performance.latency.p95 - previous.performance.latency.p95) /
      previous.performance.latency.p95;
    if (latencyChange > threshold) {
      degradedMetrics.push({
        name: "latency.p95",
        previousValue: previous.performance.latency.p95,
        currentValue: current.performance.latency.p95,
        percentChange: latencyChange,
      });
    }

    // Check throughput (decrease is bad)
    const throughputChange =
      (previous.performance.throughput - current.performance.throughput) /
      previous.performance.throughput;
    if (throughputChange > threshold) {
      degradedMetrics.push({
        name: "throughput",
        previousValue: previous.performance.throughput,
        currentValue: current.performance.throughput,
        percentChange: -throughputChange,
      });
    }

    // Check quality score (decrease is bad)
    const qualityChange =
      (previous.performance.qualityScore - current.performance.qualityScore) /
      previous.performance.qualityScore;
    if (qualityChange > threshold) {
      degradedMetrics.push({
        name: "qualityScore",
        previousValue: previous.performance.qualityScore,
        currentValue: current.performance.qualityScore,
        percentChange: -qualityChange,
      });
    }

    // Check error rate (increase is bad)
    const errorChange =
      (current.performance.errorRate - previous.performance.errorRate) /
      (previous.performance.errorRate || 0.001);
    if (errorChange > threshold * 2) {
      // More lenient for error rate
      degradedMetrics.push({
        name: "errorRate",
        previousValue: previous.performance.errorRate,
        currentValue: current.performance.errorRate,
        percentChange: errorChange,
      });
    }

    // Calculate overall degradation score
    const degradationScore =
      degradedMetrics.length > 0
        ? degradedMetrics.reduce(
            (sum, m) => sum + Math.abs(m.percentChange),
            0
          ) / degradedMetrics.length
        : 0;

    // Determine severity
    let severity: DegradationReport["severity"] = "low";
    if (degradationScore > this.config.rollback_threshold) {
      severity = "critical";
    } else if (degradationScore > this.config.rollback_threshold * 0.8) {
      severity = "high";
    } else if (degradationScore > this.config.degradation_threshold * 2) {
      severity = "medium";
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (severity === "critical") {
      recommendations.push("Immediate rollback recommended");
      recommendations.push("Investigate parameter changes");
    } else if (severity === "high") {
      recommendations.push("Consider parameter adjustment");
      recommendations.push("Monitor closely");
    } else if (severity === "medium") {
      recommendations.push("Continue monitoring");
    }

    return {
      isDegraded: degradedMetrics.length > 0,
      severity,
      degradedMetrics,
      degradationScore,
      recommendations,
    };
  }

  /**
   * Check if rollback is needed
   */
  should_rollback(tuningResult: TuningResult): boolean {
    const { performanceBefore, performanceAfter, improvement } = tuningResult;

    // If improvement is negative (degradation), check severity
    if (improvement < -this.config.rollback_threshold) {
      return true;
    }

    // Check for critical degradation in any metric
    const beforeMetrics = this.performanceToSystemMetrics(performanceBefore);
    const afterMetrics = this.performanceToSystemMetrics(performanceAfter);
    const degradation = this.detect_degradation(beforeMetrics, afterMetrics);

    if (degradation.severity === "critical") {
      return true;
    }

    return false;
  }

  /**
   * Generate adjustment recommendations
   */
  recommend_adjustment(
    current: TunableParameter[],
    feedback: Feedback
  ): AdjustmentRecommendation[] {
    const recommendations: AdjustmentRecommendation[] = [];

    // Check degradation
    if (feedback.degradation.isDegraded) {
      for (const degraded of feedback.degradation.degradedMetrics) {
        const rec = this.generateAdjustmentForMetric(
          degraded.name,
          current,
          degraded
        );
        if (rec) {
          recommendations.push(rec);
        }
      }
    }

    // Check trends
    for (const [metric, trend] of feedback.trends.entries()) {
      if (
        trend.direction === "degrading" &&
        trend.confidence > this.config.min_trend_confidence
      ) {
        const rec = this.generateAdjustmentForTrend(metric, trend, current);
        if (rec) {
          recommendations.push(rec);
        }
      }
    }

    return recommendations;
  }

  /**
   * Generate adjustment for a degraded metric
   */
  private generateAdjustmentForMetric(
    metricName: string,
    parameters: TunableParameter[],
    degraded: { name: string; percentChange: number }
  ): AdjustmentRecommendation | null {
    // Find relevant parameter
    let parameterName: string | null = null;
    let adjustment: "increase" | "decrease" | null = null;

    if (metricName.includes("latency") || metricName.includes("cost")) {
      parameterName = "cache.maxSize";
      adjustment = "increase";
    } else if (metricName === "throughput") {
      parameterName = "cache.similarityThreshold";
      adjustment = "decrease";
    } else if (metricName === "qualityScore") {
      parameterName = "routing.complexityThreshold";
      adjustment = "increase";
    }

    if (!parameterName || !adjustment) {
      return null;
    }

    const param = parameters.find(p => p.name === parameterName);
    if (!param) {
      return null;
    }

    const newValue =
      adjustment === "increase"
        ? param.currentValue * (1 + Math.min(0.2, degraded.percentChange))
        : param.currentValue * (1 - Math.min(0.2, degraded.percentChange));

    return {
      type: adjustment,
      parameter: parameterName,
      value: Math.max(param.minValue, Math.min(param.maxValue, newValue)),
      confidence: 0.7,
      reason: `Metric ${metricName} degraded by ${(degraded.percentChange * 100).toFixed(1)}%`,
      expectedImpact: [
        { metric: metricName, change: -degraded.percentChange * 0.5 },
      ],
    };
  }

  /**
   * Generate adjustment for a trend
   */
  private generateAdjustmentForTrend(
    metricName: string,
    trend: TrendAnalysis,
    parameters: TunableParameter[]
  ): AdjustmentRecommendation | null {
    // Find relevant parameter based on metric
    let parameterName: string | null = null;
    let adjustment: "increase" | "decrease" | null = null;

    if (metricName.includes("latency")) {
      parameterName = "cache.ttl";
      adjustment = "decrease";
    } else if (metricName === "throughput") {
      parameterName = "cache.maxSize";
      adjustment = "increase";
    }

    if (!parameterName || !adjustment) {
      return null;
    }

    const param = parameters.find(p => p.name === parameterName);
    if (!param) {
      return null;
    }

    const change = Math.abs(trend.rateOfChange) * 10;
    const newValue =
      adjustment === "increase"
        ? param.currentValue + change
        : param.currentValue - change;

    return {
      type: adjustment,
      parameter: parameterName,
      value: Math.max(param.minValue, Math.min(param.maxValue, newValue)),
      confidence: trend.confidence * 0.8,
      reason: `Metric ${metricName} showing ${trend.direction} trend (confidence: ${(trend.confidence * 100).toFixed(0)}%)`,
      expectedImpact: [{ metric: metricName, change: -trend.rateOfChange * 5 }],
    };
  }

  /**
   * Update baseline metrics
   */
  update_baseline(metrics: SystemMetrics): void {
    this.baseline.push(metrics);
    if (this.baseline.length > this.config.baseline_window) {
      this.baseline = this.baseline.slice(-this.config.baseline_window);
    }
  }

  /**
   * Learn from feedback
   */
  learn_from_feedback(feedback: Feedback): void {
    // Store feedback for learning
    this.feedbackHistory.push(feedback);
    if (this.feedbackHistory.length > 1000) {
      this.feedbackHistory = this.feedbackHistory.slice(-1000);
    }

    // Update baseline if no degradation
    if (!feedback.degradation.isDegraded) {
      this.update_baseline(feedback.metrics);
    }
  }

  /**
   * Get current baseline
   */
  get_baseline(): SystemMetrics | null {
    if (this.baseline.length === 0) {
      return null;
    }

    // Return average of baseline
    const n = this.baseline.length;
    return {
      timestamp: Date.now(),
      performance: {
        latency: {
          p50: this.average(this.baseline.map(m => m.performance.latency.p50)),
          p95: this.average(this.baseline.map(m => m.performance.latency.p95)),
          p99: this.average(this.baseline.map(m => m.performance.latency.p99)),
        },
        throughput: this.average(
          this.baseline.map(m => m.performance.throughput)
        ),
        errorRate: this.average(
          this.baseline.map(m => m.performance.errorRate)
        ),
        qualityScore: this.average(
          this.baseline.map(m => m.performance.qualityScore)
        ),
        costPerRequest: this.average(
          this.baseline.map(m => m.performance.costPerRequest)
        ),
        resourceUsage: {
          memoryMB: this.average(
            this.baseline.map(m => m.performance.resourceUsage.memoryMB)
          ),
          cpuPercent: this.average(
            this.baseline.map(m => m.performance.resourceUsage.cpuPercent)
          ),
        },
      },
      utilization: {
        memoryPercent: this.average(
          this.baseline.map(m => m.utilization.memoryPercent)
        ),
        cpuPercent: this.average(
          this.baseline.map(m => m.utilization.cpuPercent)
        ),
        diskPercent: this.average(
          this.baseline.map(m => m.utilization.diskPercent)
        ),
        networkBandwidth: this.average(
          this.baseline.map(m => m.utilization.networkBandwidth)
        ),
      },
      application: {
        cacheHitRate: this.average(
          this.baseline.map(m => m.application.cacheHitRate)
        ),
        errorCount: Math.round(
          this.average(this.baseline.map(m => m.application.errorCount))
        ),
        requestCount: Math.round(
          this.average(this.baseline.map(m => m.application.requestCount))
        ),
      },
    };
  }

  /**
   * Get feedback history
   */
  get_feedback_history(): Feedback[] {
    return [...this.feedbackHistory];
  }

  /**
   * Get metrics history
   */
  get_metrics_history(): SystemMetrics[] {
    return [...this.history];
  }

  /**
   * Calculate average of numbers
   */
  private average(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Convert PerformanceMetrics to SystemMetrics
   */
  private performanceToSystemMetrics(
    performance: PerformanceMetrics
  ): SystemMetrics {
    return {
      timestamp: Date.now(),
      performance,
      utilization: {
        memoryPercent: (performance.resourceUsage.memoryMB / 4096) * 100,
        cpuPercent: performance.resourceUsage.cpuPercent,
        diskPercent: 50,
        networkBandwidth: 50,
      },
      application: {
        cacheHitRate: 0.7,
        errorCount: Math.floor(performance.errorRate * 100),
        requestCount: Math.floor(performance.throughput * 10),
      },
    };
  }

  /**
   * Reset feedback loop state
   */
  reset(): void {
    this.baseline = [];
    this.history = [];
    this.feedbackHistory = [];
  }

  /**
   * Get configuration
   */
  get_config(): FeedbackConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  update_config(config: Partial<FeedbackConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a FeedbackLoop
 */
export function createFeedbackLoop(
  config?: Partial<FeedbackConfig>,
  anomalyDetector?: AnomalyDetector
): FeedbackLoop {
  return new FeedbackLoop(config, anomalyDetector);
}
