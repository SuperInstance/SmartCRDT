/**
 * @lsi/vljepa-analytics - Comprehensive analytics dashboard for UI usage and personalization analytics
 *
 * Provides event collection, metrics tracking, dashboard visualization,
 * personalization analytics, insights generation, and alerting.
 *
 * @example
 * ```typescript
 * import { AnalyticsDashboard, EventCollector } from '@lsi/vljepa-analytics';
 *
 * const collector = new EventCollector();
 * const dashboard = new AnalyticsDashboard(config, stores);
 *
 * collector.initialize('user-123', { url: 'https://example.com' });
 * collector.trackPageView('/home');
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export * from "./types.js";

// ============================================================================
// Collectors
// ============================================================================

export { EventCollector } from "./collectors/EventCollector.js";
export { MetricCollector } from "./collectors/MetricCollector.js";
export { UserCollector } from "./collectors/UserCollector.js";
export { SessionCollector } from "./collectors/SessionCollector.js";

// ============================================================================
// Storage
// ============================================================================

export { EventStore } from "./storage/EventStore.js";
export { MetricStore } from "./storage/MetricStore.js";
export { UserProfileStore } from "./storage/UserProfileStore.js";
export { DashboardStore } from "./storage/DashboardStore.js";

// ============================================================================
// Dashboards
// ============================================================================

export { AnalyticsDashboard } from "./dashboards/AnalyticsDashboard.js";
export { PersonalizationDashboard } from "./dashboards/PersonalizationDashboard.js";
export { ExperimentDashboard } from "./dashboards/ExperimentDashboard.js";
export { RealTimeDashboard } from "./dashboards/RealTimeDashboard.js";

// ============================================================================
// Visualizations
// ============================================================================

export { ChartRenderer } from "./visualizations/ChartRenderer.js";
export { HeatmapRenderer } from "./visualizations/HeatmapRenderer.js";
export { FlowRenderer } from "./visualizations/FlowRenderer.js";
export { FunnelRenderer } from "./visualizations/FunnelRenderer.js";

// ============================================================================
// Insights
// ============================================================================

export { InsightGenerator } from "./insights/InsightGenerator.js";
export { TrendAnalyzer } from "./insights/TrendAnalyzer.js";
export { RecommendationEngine } from "./insights/RecommendationEngine.js";
export { Forecaster } from "./insights/Forecaster.js";

// ============================================================================
// Alerts
// ============================================================================

export { AlertManager } from "./alerts/AlertManager.js";
export { ThresholdChecker } from "./alerts/ThresholdChecker.js";
export { Notifier } from "./alerts/Notifier.js";

// ============================================================================
// Exports
// ============================================================================

export { DataExporter } from "./exports/DataExporter.js";
export { ReportGenerator } from "./exports/ReportGenerator.js";
export { Scheduler } from "./exports/Scheduler.js";

// ============================================================================
// Processors
// ============================================================================

export { EventProcessor } from "./processors/EventProcessor.js";
export { Aggregator } from "./processors/Aggregator.js";
export { Segmenter } from "./processors/Segmenter.js";
export { AnomalyDetector } from "./processors/AnomalyDetector.js";

// ============================================================================
// API
// ============================================================================

export { AnalyticsAPI } from "./api/AnalyticsAPI.js";
export { WebSocketAPI } from "./api/WebSocketAPI.js";
export { GraphQLAPI } from "./api/GraphQLAPI.js";

// ============================================================================
// Version
// ============================================================================

export const VERSION = "1.0.0";
