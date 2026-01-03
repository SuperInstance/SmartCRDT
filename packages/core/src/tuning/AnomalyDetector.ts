/**
 * @lsi/core/tuning - AnomalyDetector for Aequor Cognitive Orchestration Platform
 *
 * Anomaly detection implementation with:
 * - Statistical outlier detection using Z-score and IQR methods
 * - Sudden change detection using CUSUM
 * - Performance anomaly detection
 * - Configurable thresholds and window sizes
 * - Alert generation
 */

import { PerformanceMetrics } from "./AutoTuner.js";
import { SystemMetrics } from "./FeedbackLoop.js";

/**
 * Anomaly detector configuration
 */
export interface AnomalyDetectorConfig {
  /** Z-score threshold for outlier detection */
  zscore_threshold: number;
  /** IQR multiplier for outlier detection */
  iqr_multiplier: number;
  /** Window size for statistical analysis */
  window_size: number;
  /** Minimum samples required for detection */
  min_samples: number;
  /** Enable statistical outlier detection */
  enable_statistical: boolean;
  /** Enable sudden change detection */
  enable_sudden_change: boolean;
  /** Enable performance anomaly detection */
  enable_performance: boolean;
  /** Alert threshold sensitivity */
  alert_sensitivity: "low" | "medium" | "high";
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  /** Whether an anomaly was detected */
  is_anomaly: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Type of anomaly */
  type: "statistical" | "sudden" | "performance" | "composite";
  /** Severity level */
  severity: "low" | "medium" | "high" | "critical";
  /** Human-readable description */
  description: string;
  /** Detected value */
  value: number;
  /** Expected range */
  expected_range: { min: number; max: number };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Change detection result
 */
export interface ChangeDetection {
  /** Whether a change was detected */
  is_change: boolean;
  /** Magnitude of change */
  magnitude: number;
  /** Direction of change */
  direction: "increase" | "decrease" | "none";
  /** Confidence in detection */
  confidence: number;
  /** Change point index */
  change_point: number | null;
}

/**
 * Performance anomaly report
 */
export interface AnomalyReport {
  /** Whether any anomalies were detected */
  has_anomalies: boolean;
  /** List of detected anomalies */
  anomalies: AnomalyResult[];
  /** Overall severity (highest among all) */
  overall_severity: "none" | "low" | "medium" | "high" | "critical";
  /** Metrics checked */
  metrics_checked: string[];
  /** Timestamp of detection */
  timestamp: number;
}

/**
 * Alert definition
 */
export interface Alert {
  /** Alert ID */
  id: string;
  /** Severity level */
  severity: "low" | "medium" | "high" | "critical";
  /** Alert type */
  type: string;
  /** Alert message */
  message: string;
  /** Timestamp */
  timestamp: number;
  /** Related anomaly */
  anomaly: AnomalyResult;
  /** Recommended actions */
  recommendations: string[];
}

/**
 * Statistical summary
 */
export interface StatisticalSummary {
  /** Mean */
  mean: number;
  /** Standard deviation */
  std: number;
  /** Median */
  median: number;
  /** First quartile */
  q1: number;
  /** Third quartile */
  q3: number;
  /** Interquartile range */
  iqr: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Sample size */
  count: number;
}

/**
 * Default anomaly detector configuration
 */
export const DEFAULT_ANOMALY_DETECTOR_CONFIG: AnomalyDetectorConfig = {
  zscore_threshold: 3.0,
  iqr_multiplier: 1.5,
  window_size: 50,
  min_samples: 10,
  enable_statistical: true,
  enable_sudden_change: true,
  enable_performance: true,
  alert_sensitivity: "medium",
};

/**
 * Sensitivity thresholds
 */
const SENSITIVITY_THRESHOLDS = {
  low: { zscore: 4.0, iqr: 2.0 },
  medium: { zscore: 3.0, iqr: 1.5 },
  high: { zscore: 2.0, iqr: 1.0 },
};

/**
 * AnomalyDetector - Detects anomalies in system metrics
 *
 * The AnomalyDetector uses multiple statistical methods to identify
 * unusual patterns in performance data, enabling proactive response
 * to potential issues.
 */
export class AnomalyDetector {
  private config: AnomalyDetectorConfig;
  private history: Map<string, number[]>;
  private alerts: Alert[];
  private alertIdCounter: number;

  constructor(config: Partial<AnomalyDetectorConfig> = {}) {
    this.config = { ...DEFAULT_ANOMALY_DETECTOR_CONFIG, ...config };
    this.history = new Map();
    this.alerts = [];
    this.alertIdCounter = 0;

    // Apply sensitivity settings
    this.applySensitivity();
  }

  /**
   * Apply sensitivity settings to config
   */
  private applySensitivity(): void {
    const thresholds = SENSITIVITY_THRESHOLDS[this.config.alert_sensitivity];
    this.config.zscore_threshold = thresholds.zscore;
    this.config.iqr_multiplier = thresholds.iqr;
  }

  /**
   * Detect statistical outlier in a value
   */
  detect_statistical_outlier(value: number, history: number[]): AnomalyResult {
    if (history.length < this.config.min_samples) {
      return {
        is_anomaly: false,
        confidence: 0,
        type: "statistical",
        severity: "low",
        description: "Insufficient data for outlier detection",
        value,
        expected_range: { min: value, max: value },
      };
    }

    const summary = this.calculate_summary(history);
    const anomalies: AnomalyResult[] = [];

    // Z-score method
    if (this.config.enable_statistical) {
      const zscore = Math.abs((value - summary.mean) / (summary.std || 1));
      if (zscore > this.config.zscore_threshold) {
        anomalies.push({
          is_anomaly: true,
          confidence: Math.min(1, (zscore - this.config.zscore_threshold) / 2),
          type: "statistical",
          severity: this.getZScoreSeverity(zscore),
          description: `Z-score ${zscore.toFixed(2)} exceeds threshold ${this.config.zscore_threshold}`,
          value,
          expected_range: {
            min: summary.mean - this.config.zscore_threshold * summary.std,
            max: summary.mean + this.config.zscore_threshold * summary.std,
          },
          metadata: { method: "zscore", zscore },
        });
      }
    }

    // IQR method
    if (this.config.enable_statistical) {
      const iqr_min = summary.q1 - this.config.iqr_multiplier * summary.iqr;
      const iqr_max = summary.q3 + this.config.iqr_multiplier * summary.iqr;

      if (value < iqr_min || value > iqr_max) {
        const iqr_distance =
          value < iqr_min
            ? (iqr_min - value) / summary.iqr
            : (value - iqr_max) / summary.iqr;

        anomalies.push({
          is_anomaly: true,
          confidence: Math.min(1, iqr_distance / 2),
          type: "statistical",
          severity: this.getIQRSeverity(iqr_distance),
          description: `Value ${value.toFixed(2)} outside IQR range [${iqr_min.toFixed(2)}, ${iqr_max.toFixed(2)}]`,
          value,
          expected_range: { min: iqr_min, max: iqr_max },
          metadata: { method: "iqr", iqr_distance },
        });
      }
    }

    // Return highest confidence anomaly or no anomaly
    if (anomalies.length > 0) {
      anomalies.sort((a, b) => b.confidence - a.confidence);
      return anomalies[0]!;
    }

    return {
      is_anomaly: false,
      confidence: 0,
      type: "statistical",
      severity: "low",
      description: "No statistical anomaly detected",
      value,
      expected_range: {
        min: summary.mean - 2 * summary.std,
        max: summary.mean + 2 * summary.std,
      },
    };
  }

  /**
   * Get severity based on Z-score
   */
  private getZScoreSeverity(zscore: number): AnomalyResult["severity"] {
    if (zscore > 5) return "critical";
    if (zscore > 4) return "high";
    if (zscore > 3) return "medium";
    return "low";
  }

  /**
   * Get severity based on IQR distance
   */
  private getIQRSeverity(distance: number): AnomalyResult["severity"] {
    if (distance > 3) return "critical";
    if (distance > 2) return "high";
    if (distance > 1) return "medium";
    return "low";
  }

  /**
   * Detect sudden change in time series
   */
  detect_sudden_change(current: number[], previous: number[]): ChangeDetection {
    if (
      current.length < this.config.min_samples ||
      previous.length < this.config.min_samples
    ) {
      return {
        is_change: false,
        magnitude: 0,
        direction: "none",
        confidence: 0,
        change_point: null,
      };
    }

    const currentMean = this.mean(current);
    const previousMean = this.mean(previous);
    const previousStd = this.std(previous);

    // Calculate change magnitude
    const change = currentMean - previousMean;
    const magnitude = Math.abs(change) / (previousStd || 1);

    // CUSUM-like detection
    const threshold = 2.0;
    const isChange = magnitude > threshold;

    return {
      is_change: isChange,
      magnitude,
      direction:
        change > 0.1 ? "increase" : change < -0.1 ? "decrease" : "none",
      confidence: Math.min(1, (magnitude - 1) / 2),
      change_point: isChange ? previous.length : null,
    };
  }

  /**
   * Detect performance anomalies
   */
  detect_performance_anomaly(metrics: SystemMetrics): AnomalyReport {
    const anomalies: AnomalyResult[] = [];
    const metrics_checked: string[] = [];

    // Get history for each metric
    const history = this.get_metrics_history();

    // Check latency metrics
    const latencyHistory = history.get("latency.p95") || [];
    if (latencyHistory.length >= this.config.min_samples) {
      const latencyAnomaly = this.detect_statistical_outlier(
        metrics.performance.latency.p95,
        latencyHistory
      );
      if (latencyAnomaly.is_anomaly) {
        anomalies.push(latencyAnomaly);
      }
      metrics_checked.push("latency.p95");
    }

    // Check throughput
    const throughputHistory = history.get("throughput") || [];
    if (throughputHistory.length >= this.config.min_samples) {
      const throughputAnomaly = this.detect_statistical_outlier(
        metrics.performance.throughput,
        throughputHistory
      );
      if (throughputAnomaly.is_anomaly) {
        anomalies.push(throughputAnomaly);
      }
      metrics_checked.push("throughput");
    }

    // Check error rate
    const errorHistory = history.get("errorRate") || [];
    if (errorHistory.length >= this.config.min_samples) {
      const errorAnomaly = this.detect_statistical_outlier(
        metrics.performance.errorRate * 100, // Convert to percentage
        errorHistory
      );
      if (errorAnomaly.is_anomaly) {
        anomalies.push(errorAnomaly);
      }
      metrics_checked.push("errorRate");
    }

    // Check quality score
    const qualityHistory = history.get("qualityScore") || [];
    if (qualityHistory.length >= this.config.min_samples) {
      const qualityAnomaly = this.detect_statistical_outlier(
        metrics.performance.qualityScore * 100, // Convert to percentage
        qualityHistory
      );
      if (qualityAnomaly.is_anomaly) {
        anomalies.push(qualityAnomaly);
      }
      metrics_checked.push("qualityScore");
    }

    // Determine overall severity
    let overall_severity: AnomalyReport["overall_severity"] = "none";
    if (anomalies.length > 0) {
      const severities: AnomalyResult["severity"][] = [
        "critical",
        "high",
        "medium",
        "low",
      ];
      for (const severity of severities) {
        if (anomalies.some(a => a.severity === severity)) {
          overall_severity = severity;
          break;
        }
      }
    }

    return {
      has_anomalies: anomalies.length > 0,
      anomalies,
      overall_severity,
      metrics_checked,
      timestamp: Date.now(),
    };
  }

  /**
   * Get metrics history
   */
  get_metrics_history(): Map<string, number[]> {
    return new Map(this.history);
  }

  /**
   * Add value to history
   */
  add_to_history(metric: string, value: number): void {
    const values = this.history.get(metric) || [];
    values.push(value);

    // Keep only window_size values
    if (values.length > this.config.window_size) {
      values.shift();
    }

    this.history.set(metric, values);
  }

  /**
   * Add system metrics to history
   */
  add_metrics(metrics: SystemMetrics): void {
    this.add_to_history("latency.p95", metrics.performance.latency.p95);
    this.add_to_history("throughput", metrics.performance.throughput);
    this.add_to_history("errorRate", metrics.performance.errorRate * 100);
    this.add_to_history("qualityScore", metrics.performance.qualityScore * 100);
    this.add_to_history(
      "costPerRequest",
      metrics.performance.costPerRequest * 1000
    );
    this.add_to_history("memoryMB", metrics.performance.resourceUsage.memoryMB);
    this.add_to_history(
      "cpuPercent",
      metrics.performance.resourceUsage.cpuPercent
    );
  }

  /**
   * Calculate statistical summary
   */
  calculate_summary(values: number[]): StatisticalSummary {
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const mean = this.mean(values);
    const std = this.std(values);

    const q1Index = Math.floor(count * 0.25);
    const medianIndex = Math.floor(count * 0.5);
    const q3Index = Math.floor(count * 0.75);

    return {
      mean,
      std,
      median: sorted[medianIndex] ?? 0,
      q1: sorted[q1Index] ?? 0,
      q3: sorted[q3Index] ?? 0,
      iqr: (sorted[q3Index] ?? 0) - (sorted[q1Index] ?? 0),
      min: sorted[0] ?? 0,
      max: sorted[count - 1] ?? 0,
      count,
    };
  }

  /**
   * Calculate mean
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private std(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) /
      (values.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Set threshold for detection
   */
  set_threshold(threshold: number): void {
    this.config.zscore_threshold = threshold;
  }

  /**
   * Set window size
   */
  set_window_size(size: number): void {
    this.config.window_size = size;
  }

  /**
   * Set sensitivity
   */
  set_sensitivity(sensitivity: "low" | "medium" | "high"): void {
    this.config.alert_sensitivity = sensitivity;
    this.applySensitivity();
  }

  /**
   * Generate alert from anomaly
   */
  generate_alert(anomaly: AnomalyResult): Alert {
    const alert: Alert = {
      id: `alert-${++this.alertIdCounter}`,
      severity: anomaly.severity,
      type: anomaly.type,
      message: this.generateAlertMessage(anomaly),
      timestamp: Date.now(),
      anomaly,
      recommendations: this.generateRecommendations(anomaly),
    };

    this.alerts.push(alert);

    return alert;
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(anomaly: AnomalyResult): string {
    const severity = anomaly.severity.toUpperCase();
    const type = anomaly.type;

    switch (type) {
      case "statistical":
        return `${severity}: Statistical anomaly detected - ${anomaly.description}`;
      case "sudden":
        return `${severity}: Sudden change detected - ${anomaly.description}`;
      case "performance":
        return `${severity}: Performance anomaly detected - ${anomaly.description}`;
      case "composite":
        return `${severity}: Composite anomaly detected - ${anomaly.description}`;
      default:
        return `${severity}: Anomaly detected - ${anomaly.description}`;
    }
  }

  /**
   * Generate recommendations for anomaly
   */
  private generateRecommendations(anomaly: AnomalyResult): string[] {
    const recommendations: string[] = [];

    switch (anomaly.severity) {
      case "critical":
        recommendations.push("Immediate investigation required");
        recommendations.push("Consider rolling back recent changes");
        recommendations.push("Alert on-call personnel");
        break;
      case "high":
        recommendations.push("Investigate the root cause");
        recommendations.push("Monitor closely for escalation");
        recommendations.push("Review recent configuration changes");
        break;
      case "medium":
        recommendations.push("Continue monitoring");
        recommendations.push("Check related metrics");
        recommendations.push("Document for post-mortem analysis");
        break;
      case "low":
        recommendations.push("Add to watch list");
        recommendations.push("Monitor for patterns");
        break;
    }

    switch (anomaly.type) {
      case "statistical":
        recommendations.push("Verify data quality");
        recommendations.push("Check for sensor errors");
        break;
      case "sudden":
        recommendations.push("Review recent deployments");
        recommendations.push("Check for external factors");
        break;
      case "performance":
        recommendations.push("Review resource utilization");
        recommendations.push("Check for bottlenecks");
        break;
    }

    return recommendations;
  }

  /**
   * Get recent alerts
   */
  get_alerts(severity?: Alert["severity"]): Alert[] {
    let alerts = [...this.alerts];

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get alert count by severity
   */
  get_alert_counts(): Record<string, number> {
    const counts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const alert of this.alerts) {
      counts[alert.severity]++;
    }

    return counts;
  }

  /**
   * Clear old alerts
   */
  clear_alerts(olderThanMs?: number): void {
    if (olderThanMs) {
      const cutoff = Date.now() - olderThanMs;
      this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
    } else {
      this.alerts = [];
    }
  }

  /**
   * Clear history for a metric
   */
  clear_history(metric?: string): void {
    if (metric) {
      this.history.delete(metric);
    } else {
      this.history.clear();
    }
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.history.clear();
    this.alerts = [];
    this.alertIdCounter = 0;
  }

  /**
   * Get configuration
   */
  get_config(): AnomalyDetectorConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  update_config(config: Partial<AnomalyDetectorConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.alert_sensitivity) {
      this.applySensitivity();
    }
  }

  /**
   * Export state as JSON
   */
  export_state(): string {
    return JSON.stringify({
      config: this.config,
      history: Array.from(this.history.entries()),
      alerts: this.alerts,
      alertIdCounter: this.alertIdCounter,
    });
  }

  /**
   * Import state from JSON
   */
  import_state(json: string): void {
    try {
      const state = JSON.parse(json);
      this.config = { ...DEFAULT_ANOMALY_DETECTOR_CONFIG, ...state.config };
      this.history = new Map(state.history);
      this.alerts = state.alerts || [];
      this.alertIdCounter = state.alertIdCounter || 0;
    } catch (error) {
      console.error("[AnomalyDetector] Error importing state:", error);
    }
  }
}

/**
 * Create an AnomalyDetector
 */
export function createAnomalyDetector(
  config?: Partial<AnomalyDetectorConfig>
): AnomalyDetector {
  return new AnomalyDetector(config);
}
