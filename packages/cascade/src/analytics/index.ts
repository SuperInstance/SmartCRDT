/**
 * Cache Analytics Module
 *
 * Comprehensive cache performance monitoring, analytics, anomaly detection,
 * and optimization recommendations for the Aequor Cognitive Orchestration Platform.
 *
 * Components:
 * - MetricsCollector: Real-time metrics collection
 * - AnomalyDetector: Statistical anomaly detection
 * - OptimizationRecommender: ML-based optimization recommendations
 * - EfficiencyScoreCalculator: Cache efficiency scoring
 * - DashboardGenerator: Multi-format report generation
 * - CacheAnalyticsManager: Unified analytics orchestrator
 */

export { MetricsCollector } from "./MetricsCollector.js";
export { AnomalyDetector } from "./AnomalyDetector.js";
export { OptimizationRecommender } from "./OptimizationRecommender.js";
export { EfficiencyScoreCalculator } from "./EfficiencyScoreCalculator.js";
export { DashboardGenerator } from "./DashboardGenerator.js";
export { CacheAnalyticsManager } from "./CacheAnalyticsManager.js";

// Re-export types for convenience
export type {
  CacheAnalyticsConfig,
  CacheMetricsSnapshot,
  Anomaly,
  AnomalyDetectionResult,
  OptimizationSummary,
  EfficiencyScore,
  DashboardData,
  CacheAnalyticsReport,
  ReportFormat,
  ReportConfig,
  MetricsExportConfig,
} from "@lsi/protocol";
