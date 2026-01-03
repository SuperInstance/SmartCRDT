/**
 * @fileoverview Dashboard - Analytics dashboard for A/B testing
 * @author Aequor Project - Round 23 Agent 2
 * @version 1.0.0
 */

import type {
  Experiment,
  DashboardConfig,
  DashboardData,
  ChartType,
  ChartData,
  ChartDataPoint,
  Alert,
  AlertType,
  WinnerResult,
  Recommendation,
  MetricSummary,
  ExperimentReport,
} from "../types.js";

// ============================================================================
// DASHBOARD
// ============================================================================

/**
 * Dashboard - Analytics dashboard for A/B testing experiments
 *
 * Provides real-time metrics, charts, alerts, and recommendations.
 */
export class Dashboard {
  private config: DashboardConfig;
  private alerts: Alert[] = [];
  private listeners: Set<(data: DashboardData) => void> = new Set();
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(config?: Partial<DashboardConfig>) {
    this.config = {
      refreshInterval: 30000, // 30 seconds
      showRealtime: true,
      alertOnSignificant: true,
      charts: ["line", "bar", "funnel"],
      maxAlerts: 50,
      ...config,
    };

    if (this.config.showRealtime) {
      this.startAutoRefresh();
    }
  }

  /**
   * Generate dashboard data for an experiment
   */
  async generateDashboardData(
    experiment: Experiment,
    getMetrics: (variantId: string) => Promise<Map<string, MetricSummary>>,
    getWinner?: () => Promise<WinnerResult | undefined>
  ): Promise<DashboardData> {
    // Collect metrics for all variants
    const metrics: MetricSummary[] = [];
    const variantMetrics = new Map<string, Map<string, MetricSummary>>();

    for (const variant of experiment.variants) {
      const variantMetricSummaries = await getMetrics(variant.id);
      variantMetrics.set(variant.id, variantMetricSummaries);

      for (const summary of variantMetricSummaries.values()) {
        metrics.push(summary);
      }
    }

    // Generate charts
    const charts = this.generateCharts(experiment, variantMetrics);

    // Generate alerts
    this.checkForAlerts(experiment, variantMetrics);
    const recentAlerts = this.getRecentAlerts(experiment.id);

    // Get winner recommendation
    let winner: WinnerResult | undefined;
    if (getWinner) {
      winner = await getWinner();
    }

    return {
      experiment,
      metrics,
      charts,
      alerts: recentAlerts,
      winner,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate charts for dashboard
   */
  generateCharts(
    experiment: Experiment,
    variantMetrics: Map<string, Map<string, MetricSummary>>
  ): ChartData[] {
    const charts: ChartData[] = [];

    // Conversion rate comparison chart
    if (this.config.charts.includes("bar")) {
      charts.push(this.generateConversionChart(experiment, variantMetrics));
    }

    // Metrics over time chart
    if (this.config.charts.includes("line")) {
      charts.push(this.generateMetricsLineChart(experiment, variantMetrics));
    }

    // Funnel chart
    if (this.config.charts.includes("funnel")) {
      charts.push(this.generateFunnelChart(experiment, variantMetrics));
    }

    return charts;
  }

  /**
   * Generate conversion rate bar chart
   */
  private generateConversionChart(
    experiment: Experiment,
    variantMetrics: Map<string, Map<string, MetricSummary>>
  ): ChartData {
    const series = experiment.variants.map(variant => {
      const metrics = variantMetrics.get(variant.id);
      const conversionMetric = metrics?.get("conversion");

      const rate = conversionMetric?.mean || 0;

      return {
        name: variant.name,
        data: [
          {
            x: variant.name,
            y: rate * 100,
            label: `${(rate * 100).toFixed(2)}%`,
          },
        ],
        color: variant.isControl ? "#888" : this.generateColor(variant.id),
      };
    });

    return {
      type: "bar",
      title: "Conversion Rate by Variant",
      series,
      xAxis: "Variant",
      yAxis: "Conversion Rate (%)",
    };
  }

  /**
   * Generate metrics line chart
   */
  private generateMetricsLineChart(
    experiment: Experiment,
    variantMetrics: Map<string, Map<string, MetricSummary>>
  ): ChartData {
    const primaryMetric = experiment.primaryMetric;

    const series = experiment.variants.map(variant => {
      const metrics = variantMetrics.get(variant.id);
      const metric = metrics?.get(primaryMetric);

      return {
        name: variant.name,
        data: [{ x: "Current", y: metric?.mean || 0 }],
        color: variant.isControl ? "#888" : this.generateColor(variant.id),
      };
    });

    return {
      type: "line",
      title: `${primaryMetric} Comparison`,
      series,
      xAxis: "Time",
      yAxis: primaryMetric,
    };
  }

  /**
   * Generate funnel chart
   */
  private generateFunnelChart(
    experiment: Experiment,
    variantMetrics: Map<string, Map<string, MetricSummary>>
  ): ChartData {
    // Use the control variant for funnel
    const control = experiment.variants.find(v => v.isControl);
    if (!control) {
      return {
        type: "funnel",
        title: "Conversion Funnel",
        series: [],
      };
    }

    const metrics = variantMetrics.get(control.id);
    const impressions = metrics?.get("impressions")?.count || 100;
    const engagements = metrics?.get("engagements")?.count || 0;
    const conversions = metrics?.get("conversion")?.count || 0;

    const data: ChartDataPoint[] = [
      { x: "Impressions", y: impressions },
      { x: "Engagements", y: engagements },
      { x: "Conversions", y: conversions },
    ];

    return {
      type: "funnel",
      title: "Conversion Funnel",
      series: [{ name: control.name, data }],
    };
  }

  /**
   * Check for alerts and add them
   */
  private checkForAlerts(
    experiment: Experiment,
    variantMetrics: Map<string, Map<string, MetricSummary>>
  ): void {
    if (!this.config.alertOnSignificant) {
      return;
    }

    // Check for low sample size
    for (const variant of experiment.variants) {
      const metrics = variantMetrics.get(variant.id);
      const totalUsers = Array.from(metrics?.values() || []).reduce(
        (sum, m) => sum + m.count,
        0
      );

      if (totalUsers < experiment.minSampleSize) {
        this.addAlert({
          id: this.generateId(),
          type: "warning",
          title: "Low Sample Size",
          message: `Variant "${variant.name}" has only ${totalUsers} users (minimum: ${experiment.minSampleSize})`,
          timestamp: Date.now(),
          experimentId: experiment.id,
          data: {
            variantId: variant.id,
            currentSize: totalUsers,
            minSize: experiment.minSampleSize,
          },
        });
      }
    }

    // Check for winner found
    const control = experiment.variants.find(v => v.isControl);
    if (control) {
      const controlMetrics = variantMetrics.get(control.id);
      const controlConversion = controlMetrics?.get("conversion")?.mean || 0;

      for (const variant of experiment.variants) {
        if (variant.isControl) continue;

        const variantMetricsMap = variantMetrics.get(variant.id);
        const variantConversion =
          variantMetricsMap?.get("conversion")?.mean || 0;

        const lift =
          ((variantConversion - controlConversion) / controlConversion) * 100;

        if (lift > 20 && variantMetricsMap?.get("conversion")?.count) {
          this.addAlert({
            id: this.generateId(),
            type: "significant",
            title: "Significant Lift Detected",
            message: `Variant "${variant.name}" shows ${lift.toFixed(1)}% lift over control`,
            timestamp: Date.now(),
            experimentId: experiment.id,
            data: {
              variantId: variant.id,
              lift,
              controlConversion,
              variantConversion,
            },
          });
        }
      }
    }
  }

  /**
   * Add an alert
   */
  addAlert(alert: Alert): void {
    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.config.maxAlerts) {
      this.alerts = this.alerts.slice(-this.config.maxAlerts);
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Get recent alerts for an experiment
   */
  getRecentAlerts(experimentId: string, limit: number = 10): Alert[] {
    return this.alerts
      .filter(a => a.experimentId === experimentId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Clear alerts for an experiment
   */
  clearAlerts(experimentId: string): void {
    this.alerts = this.alerts.filter(a => a.experimentId !== experimentId);
  }

  /**
   * Subscribe to dashboard updates
   */
  subscribe(callback: (data: DashboardData) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Start auto-refresh
   */
  startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.notifyListeners();
    }, this.config.refreshInterval);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Destroy dashboard
   */
  destroy(): void {
    this.stopAutoRefresh();
    this.listeners.clear();
    this.alerts = [];
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    // Subclasses should implement actual data fetching
    // This is a placeholder for the notification mechanism
  }

  /**
   * Generate a color for a variant
   */
  private generateColor(variantId: string): string {
    const colors = ["#0066cc", "#00cc66", "#cc6600", "#cc0066", "#6600cc"];
    const hash = variantId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// EXPERIMENT REPORT GENERATOR
// ============================================================================

/**
 * ExperimentReport - Generate comprehensive experiment reports
 */
export class ExperimentReportGenerator {
  /**
   * Generate a comprehensive experiment report
   */
  async generateReport(
    experiment: Experiment,
    variantMetrics: Map<string, Map<string, MetricSummary>>,
    testResults: Map<string, import("../types.js").TestResult>,
    winner?: WinnerResult
  ): Promise<ExperimentReport> {
    // Calculate total participants
    let totalParticipants = 0;
    let totalConversions = 0;

    const variantSummaries = experiment.variants.map(variant => {
      const metrics = variantMetrics.get(variant.id) || new Map();
      const conversionMetric = metrics.get("conversion");
      const impressionsMetric = metrics.get("impressions");

      const impressions = impressionsMetric?.count || 0;
      const conversions = conversionMetric?.count || 0;
      const conversionRate = impressions > 0 ? conversions / impressions : 0;

      totalParticipants += impressions;
      totalConversions += conversions;

      return {
        variantId: variant.id,
        variantName: variant.name,
        impressions,
        conversions,
        conversionRate,
        metrics: Array.from(metrics.values()),
      };
    });

    const overallConversionRate =
      totalParticipants > 0 ? totalConversions / totalParticipants : 0;

    // Determine status
    let status: ExperimentReport["status"]["status"];
    if (totalParticipants < experiment.minSampleSize) {
      status = "needs_more_data";
    } else if (winner && winner.confidence > 0.95) {
      status = "significant_winner_found";
    } else if (totalParticipants >= experiment.targetSampleSize) {
      status = "ready_to_conclude";
    } else {
      status = "inconclusive";
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      experiment,
      variantMetrics,
      winner
    );

    return {
      experiment,
      status: {
        totalParticipants,
        totalConversions,
        overallConversionRate,
        status,
      },
      variants: variantSummaries,
      tests: Array.from(testResults.values()),
      winner,
      recommendations,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    experiment: Experiment,
    variantMetrics: Map<string, Map<string, MetricSummary>>,
    winner?: WinnerResult
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (winner && winner.confidence > 0.95) {
      recommendations.push({
        type: "implement",
        title: "Implement Winning Variant",
        description: `Variant "${winner.winningVariant}" shows statistically significant results with ${winner.confidence.toFixed(1)}% confidence`,
        variant: winner.winningVariant,
        priority: "high",
        reasoning: [
          `Statistical significance achieved (p < ${experiment.significanceLevel})`,
          `Expected lift: ${winner.lift.toFixed(1)}%`,
          `Risk level: ${winner.risk}`,
        ],
        timestamp: Date.now(),
      });
    } else {
      recommendations.push({
        type: "continue",
        title: "Continue Experiment",
        description:
          "Continue collecting data until statistical significance is achieved",
        variant: experiment.variants[0].id,
        priority: "medium",
        reasoning: [
          "Insufficient evidence to declare a winner",
          "Consider increasing sample size",
        ],
        timestamp: Date.now(),
      });
    }

    return recommendations;
  }
}

// ============================================================================
// WINNER DETERMINATION
// ============================================================================

/**
 * WinnerDetermination - Determine winning variant from experiment results
 */
export class WinnerDetermination {
  /**
   * Determine the winning variant
   */
  determineWinner(
    experiment: Experiment,
    variantMetrics: Map<string, Map<string, MetricSummary>>,
    testResults: Map<string, import("../types.js").TestResult>
  ): WinnerResult | undefined {
    const primaryMetric = experiment.primaryMetric;
    const control = experiment.variants.find(v => v.isControl);

    if (!control) {
      return undefined;
    }

    const controlMetrics = variantMetrics.get(control.id);
    const controlMetric = controlMetrics?.get(primaryMetric);

    if (!controlMetric) {
      return undefined;
    }

    let bestVariant = control.id;
    let bestValue = controlMetric.mean;
    let confidence = 0;
    let lift = 0;
    const reasoning: string[] = [];
    const cautions: string[] = [];
    const nextSteps: string[] = [];

    // Compare each treatment to control
    for (const variant of experiment.variants) {
      if (variant.isControl) continue;

      const metrics = variantMetrics.get(variant.id);
      const metric = metrics?.get(primaryMetric);

      if (!metric) continue;

      const testResult = testResults.get(`${control.id}:${variant.id}`);

      if (testResult && testResult.significant) {
        const variantLift =
          ((metric.mean - controlMetric.mean) / controlMetric.mean) * 100;

        if (variantLift > lift) {
          bestVariant = variant.id;
          bestValue = metric.mean;
          lift = variantLift;
          confidence = 1 - testResult.pValue;

          reasoning.push(
            `Variant "${variant.name}" shows ${variantLift.toFixed(1)}% lift over control`,
            `Statistically significant with p = ${testResult.pValue.toFixed(4)}`,
            `Effect size: ${testResult.effectSize.toFixed(3)}`
          );
        }
      }
    }

    if (bestVariant === control.id) {
      reasoning.push(
        "No variant showed statistically significant improvement over control"
      );
      nextSteps.push("Continue experiment with increased sample size");
    } else {
      nextSteps.push("Implement winning variant");
      nextSteps.push("Monitor performance after implementation");
    }

    // Assess risk
    let risk: "low" | "medium" | "high";
    if (confidence > 0.95) {
      risk = "low";
    } else if (confidence > 0.8) {
      risk = "medium";
    } else {
      risk = "high";
      cautions.push(
        "Low statistical confidence - results may not be reproducible"
      );
    }

    // Add cautions
    if (controlMetric.count < 100) {
      cautions.push("Small sample size - results may not be reliable");
    }

    return {
      winningVariant: bestVariant,
      confidence,
      lift,
      risk,
      reasoning,
      cautions,
      nextSteps,
      timestamp: Date.now(),
    };
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a dashboard
 */
export function createDashboard(config?: Partial<DashboardConfig>): Dashboard {
  return new Dashboard(config);
}

/**
 * Create a report generator
 */
export function createReportGenerator(): ExperimentReportGenerator {
  return new ExperimentReportGenerator();
}

/**
 * Create a winner determination
 */
export function createWinnerDetermination(): WinnerDetermination {
  return new WinnerDetermination();
}
