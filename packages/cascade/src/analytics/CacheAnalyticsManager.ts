/**
 * CacheAnalyticsManager - Unified orchestrator for cache analytics
 *
 * Coordinates all analytics components:
 * - Metrics collection
 * - Anomaly detection
 * - Efficiency scoring
 * - Optimization recommendations
 * - Dashboard generation
 * - Metrics export
 *
 * Features:
 * - Automatic metrics collection on interval
 * - Real-time anomaly detection
 * - Comprehensive dashboard generation
 * - Prometheus/Graphite export
 * - Event-driven architecture
 */

import type {
  CacheAnalyticsConfig,
  CacheMetricsSnapshot,
  AnomalyDetectionResult,
  OptimizationSummary,
  DashboardData,
  CacheAnalyticsReport,
  ReportConfig,
  ReportFormat,
  MetricsExportConfig,
  PrometheusExport,
  GraphiteExport,
} from "@lsi/protocol";

import { MetricsCollector } from "./MetricsCollector.js";
import { AnomalyDetector } from "./AnomalyDetector.js";
import { OptimizationRecommender } from "./OptimizationRecommender.js";
import { EfficiencyScoreCalculator } from "./EfficiencyScoreCalculator.js";
import { DashboardGenerator } from "./DashboardGenerator.js";

/**
 * Analytics event listener
 */
export type AnalyticsEventListener = (event: AnalyticsEvent) => void;

/**
 * Analytics event types
 */
export type AnalyticsEventType =
  | "metrics_collected"
  | "anomaly_detected"
  | "recommendation_generated"
  | "efficiency_calculated"
  | "dashboard_generated";

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: number;
  data: unknown;
}

/**
 * CacheAnalyticsManager - Unified cache analytics orchestrator
 */
export class CacheAnalyticsManager {
  private config: CacheAnalyticsConfig;
  private collector: MetricsCollector;
  private detector: AnomalyDetector;
  private recommender: OptimizationRecommender;
  private scoreCalculator: EfficiencyScoreCalculator;
  private dashboardGenerator: DashboardGenerator;

  private eventListeners: Map<AnalyticsEventType, AnalyticsEventListener[]> = new Map();
  private collectionInterval: NodeJS.Timeout | null = null;
  private latestSnapshot: CacheMetricsSnapshot | null = null;
  private latestAnomalies: any[] = [];
  private latestRecommendations: any[] = [];
  private latestEfficiencyScore: number = 0;

  constructor(cacheId: string, config: Partial<CacheAnalyticsConfig> = {}) {
    this.config = {
      ...require("@lsi/protocol").DEFAULT_CACHE_ANALYTICS_CONFIG,
      ...config,
    };

    // Initialize components
    this.collector = new MetricsCollector(cacheId, this.config);
    this.detector = new AnomalyDetector(this.config.anomalyDetection);
    this.recommender = new OptimizationRecommender();
    this.scoreCalculator = new EfficiencyScoreCalculator(this.config.efficiencyScore);
    this.dashboardGenerator = new DashboardGenerator();
  }

  /**
   * Start analytics collection
   */
  start(): void {
    if (this.collectionInterval) {
      return; // Already started
    }

    // Collect initial metrics
    this.collectAndAnalyze();

    // Set up interval collection
    this.collectionInterval = setInterval(() => {
      this.collectAndAnalyze();
    }, this.config.metricsCollectionInterval);
  }

  /**
   * Stop analytics collection
   */
  stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
  }

  /**
   * Record a cache hit
   */
  recordHit(query: string, latency: number, similarity?: number): void {
    this.collector.recordHit(query, latency, similarity);
  }

  /**
   * Record a cache miss
   */
  recordMiss(query: string, latency: number): void {
    this.collector.recordMiss(query, latency);
  }

  /**
   * Record an eviction
   */
  recordEviction(): void {
    this.collector.recordEviction();
  }

  /**
   * Update cache configuration
   */
  updateCacheConfig(size: number, maxSize: number, threshold: number): void {
    this.collector.updateSize(size, maxSize);
    this.collector.updateThreshold(threshold);
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics(): CacheMetricsSnapshot | null {
    return this.latestSnapshot;
  }

  /**
   * Get latest anomalies
   */
  getAnomalies(limit?: number): any[] {
    return limit ? this.latestAnomalies.slice(0, limit) : this.latestAnomalies;
  }

  /**
   * Get latest recommendations
   */
  getRecommendations(limit?: number): any[] {
    return limit
      ? this.latestRecommendations.slice(0, limit)
      : this.latestRecommendations;
  }

  /**
   * Get efficiency score
   */
  getEfficiencyScore(): number {
    return this.latestEfficiencyScore;
  }

  /**
   * Generate dashboard
   */
  generateDashboard(): DashboardData {
    if (!this.latestSnapshot) {
      throw new Error("No metrics available. Call start() first.");
    }

    const history = this.collector.getAllHistory().points.slice(-100);

    return this.dashboardGenerator.generateDashboard(
      this.latestSnapshot,
      this.latestAnomalies,
      this.latestRecommendations,
      this.latestEfficiencyScore,
      history.map((h) => ({ timestamp: h.timestamp, hitRate: h.hitRate }))
    );
  }

  /**
   * Generate report
   */
  generateReport(format: ReportFormat = "json"): CacheAnalyticsReport {
    const dashboard = this.generateDashboard();
    const config: ReportConfig = {
      format,
      includeHistory: true,
      includeAnomalies: true,
      includeRecommendations: true,
      includeEfficiencyScore: true,
    };

    return this.dashboardGenerator.generateReport(dashboard, config);
  }

  /**
   * Export metrics to Prometheus format
   */
  exportToPrometheus(customConfig?: Partial<MetricsExportConfig>): PrometheusExport {
    if (!this.latestSnapshot) {
      throw new Error("No metrics available. Call start() first.");
    }

    const config = { ...this.config.metricsExport, ...customConfig };
    return this.dashboardGenerator.exportToPrometheus(this.latestSnapshot, config);
  }

  /**
   * Export metrics to Graphite format
   */
  exportToGraphite(customConfig?: Partial<MetricsExportConfig>): GraphiteExport {
    if (!this.latestSnapshot) {
      throw new Error("No metrics available. Call start() first.");
    }

    const config = { ...this.config.metricsExport, ...customConfig };
    return this.dashboardGenerator.exportToGraphite(this.latestSnapshot, config);
  }

  /**
   * Add event listener
   */
  on(eventType: AnalyticsEventType, listener: AnalyticsEventListener): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off(eventType: AnalyticsEventType, listener: AnalyticsEventListener): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Collect metrics and run analytics
   */
  private collectAndAnalyze(): void {
    // Collect metrics snapshot
    const snapshot = this.collector.getSnapshot();
    this.latestSnapshot = snapshot;

    // Add historical data point
    this.collector.collectMetrics();

    // Emit metrics collected event
    this.emit("metrics_collected", { snapshot });

    // Detect anomalies if enabled
    if (this.config.enableAnomalyDetection) {
      const anomalyResult = this.detector.detect(snapshot);
      this.latestAnomalies = anomalyResult.anomalies;

      if (anomalyResult.anomalies.length > 0) {
        this.emit("anomaly_detected", { anomalies: anomalyResult.anomalies });
      }
    }

    // Calculate efficiency score
    const efficiency = this.scoreCalculator.calculate(snapshot);
    this.latestEfficiencyScore = efficiency.overall;
    this.scoreCalculator.updateBaseline(efficiency.overall);

    this.emit("efficiency_calculated", { efficiency });

    // Generate recommendations if enabled
    if (this.config.enableRecommendations) {
      const summary = this.recommender.generateRecommendations({
        metrics: snapshot,
        anomalies: this.latestAnomalies,
        efficiency,
        history: {
          hitRate: this.collector.getAllHistory().points.map((p) => p.hitRate),
          memoryUsage: this.collector.getAllHistory().points.map((p) => p.memoryUsage),
          latency: this.collector.getAllHistory().points.map((p) => p.latency),
        },
      });

      this.latestRecommendations = summary.recommendations;

      if (summary.recommendations.length > 0) {
        this.emit("recommendation_generated", { recommendations: summary });
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(type: AnalyticsEventType, data: unknown): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const event: AnalyticsEvent = {
        type,
        timestamp: Date.now(),
        data,
      };

      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in analytics event listener for ${type}:`, error);
        }
      }
    }
  }

  /**
   * Reset all analytics state
   */
  reset(): void {
    this.collector.reset();
    this.detector.reset();
    this.scoreCalculator.reset();
    this.latestSnapshot = null;
    this.latestAnomalies = [];
    this.latestRecommendations = [];
    this.latestEfficiencyScore = 0;
  }

  /**
   * Get analytics configuration
   */
  getConfig(): CacheAnalyticsConfig {
    return { ...this.config };
  }

  /**
   * Update analytics configuration
   */
  updateConfig(updates: Partial<CacheAnalyticsConfig>): void {
    this.config = { ...this.config, ...updates };

    // Update component configs
    this.detector = new AnomalyDetector(this.config.anomalyDetection);
    this.scoreCalculator = new EfficiencyScoreCalculator(this.config.efficiencyScore);
  }
}
