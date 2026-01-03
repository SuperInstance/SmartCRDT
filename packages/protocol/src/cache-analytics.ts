/**
 * Cache Analytics Protocol Types
 *
 * Comprehensive types for cache performance monitoring, analytics,
 * anomaly detection, and optimization recommendations.
 *
 * Features:
 * - Real-time metrics tracking
 * - Historical trend analysis
 * - Per-entry statistics
 * - Cache efficiency scoring
 * - Anomaly detection
 * - Optimization recommendations
 * - Prometheus/Graphite export
 */

// ============================================================================
// CORE METRICS TYPES
// ============================================================================

/**
 * Time window for metric aggregation
 */
export type TimeWindow =
  | "1m" // 1 minute
  | "5m" // 5 minutes
  | "15m" // 15 minutes
  | "1h" // 1 hour
  | "6h" // 6 hours
  | "24h" // 24 hours
  | "7d"; // 7 days

/**
 * Cache hit rate metrics
 */
export interface HitRateMetrics {
  /** Overall hit rate (0-1) */
  overall: number;
  /** Hit rate per time window */
  byTimeWindow: Partial<Record<TimeWindow, number>>;
  /** Rolling hit rate (last N queries) */
  rollingHitRate: number;
  /** Trend direction: improving, stable, declining */
  trend: "improving" | "stable" | "declining";
  /** Trend strength (0-1, higher = stronger trend) */
  trendStrength: number;
}

/**
 * Latency distribution metrics
 */
export interface LatencyMetrics {
  /** Median latency (P50) in milliseconds */
  p50: number;
  /** 95th percentile latency in milliseconds */
  p95: number;
  /** 99th percentile latency in milliseconds */
  p99: number;
  /** Average latency in milliseconds */
  average: number;
  /** Minimum latency in milliseconds */
  min: number;
  /** Maximum latency in milliseconds */
  max: number;
  /** Standard deviation in milliseconds */
  stdDev: number;
  /** Latency histogram (buckets in ms) */
  histogram: {
    bucket: number;
    count: number;
  }[];
}

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  /** Current memory usage in bytes */
  currentUsage: number;
  /** Peak memory usage in bytes */
  peakUsage: number;
  /** Memory limit in bytes (0 = no limit) */
  limit: number;
  /** Usage percentage (0-1) */
  usagePercent: number;
  /** Memory trend: growing, stable, shrinking */
  trend: "growing" | "stable" | "shrinking";
  /** Estimated memory per entry in bytes */
  bytesPerEntry: number;
}

/**
 * Cache entry statistics
 */
export interface EntryMetrics {
  /** Total number of entries */
  totalEntries: number;
  /** Active entries (not expired) */
  activeEntries: number;
  /** Expired entries (not yet evicted) */
  expiredEntries: number;
  /** Number of evictions */
  evictions: number;
  /** Eviction rate (evictions per second) */
  evictionRate: number;
  /** Average entry age in milliseconds */
  avgEntryAge: number;
  /** Oldest entry age in milliseconds */
  oldestEntryAge: number;
}

/**
 * Similarity score distribution
 */
export interface SimilarityMetrics {
  /** Average similarity score (0-1) */
  average: number;
  /** Median similarity score */
  median: number;
  /** Minimum similarity score */
  min: number;
  /** Maximum similarity score */
  max: number;
  /** Standard deviation */
  stdDev: number;
  /** Similarity histogram (buckets 0-1) */
  histogram: {
    minScore: number;
    maxScore: number;
    count: number;
  }[];
}

/**
 * Query pattern analysis
 */
export interface QueryPatternMetrics {
  /** Query frequency distribution */
  queryFrequency: {
    query: string;
    count: number;
    lastSeen: number;
  }[];
  /** Most frequent queries (hot entries) */
  hotEntries: {
    key: string;
    hitCount: number;
    hitRate: number;
  }[];
  /** Cold entries (rarely accessed) */
  coldEntries: {
    key: string;
    hitCount: number;
    lastAccess: number;
  }[];
  /** Query repetition rate (0-1) */
  repetitionRate: number;
}

// ============================================================================
// AGGREGATE METRICS
// ============================================================================

/**
 * Comprehensive cache metrics snapshot
 */
export interface CacheMetricsSnapshot {
  /** Timestamp when snapshot was taken */
  timestamp: number;
  /** Cache identifier */
  cacheId: string;
  /** Hit rate metrics */
  hitRate: HitRateMetrics;
  /** Latency metrics */
  latency: LatencyMetrics;
  /** Memory metrics */
  memory: MemoryMetrics;
  /** Entry metrics */
  entries: EntryMetrics;
  /** Similarity metrics */
  similarity: SimilarityMetrics;
  /** Query patterns */
  patterns: QueryPatternMetrics;
  /** Current cache size */
  size: number;
  /** Maximum cache size */
  maxSize: number;
  /** Current similarity threshold */
  threshold: number;
}

/**
 * Historical metrics data point
 */
export interface HistoricalDataPoint {
  /** Timestamp */
  timestamp: number;
  /** Hit rate */
  hitRate: number;
  /** Cache size */
  size: number;
  /** Memory usage */
  memoryUsage: number;
  /** P95 latency */
  latency: number;
}

/**
 * Time series data for trend analysis
 */
export interface TimeSeriesData {
  /** Data points */
  points: HistoricalDataPoint[];
  /** Time window represented */
  window: TimeWindow;
  /** Number of data points */
  count: number;
}

// ============================================================================
// ANOMALY DETECTION TYPES
// ============================================================================

/**
 * Anomaly severity level
 */
export type AnomalySeverity = "low" | "medium" | "high" | "critical";

/**
 * Anomaly type classification
 */
export type AnomalyType =
  | "hit_rate_drop" // Sudden drop in hit rate
  | "latency_spike" // Unusual latency increase
  | "memory_leak" // Continuous memory growth
  | "eviction_storm" // High eviction rate
  | "similarity_shift" // Change in similarity distribution
  | "pattern_change" // Query pattern shift
  | "cache_exhaustion" // Cache full and struggling
  | "unknown"; // Uncategorized anomaly

/**
 * Detected anomaly
 */
export interface Anomaly {
  /** Anomaly ID */
  id: string;
  /** Timestamp when detected */
  detectedAt: number;
  /** Anomaly type */
  type: AnomalyType;
  /** Severity level */
  severity: AnomalySeverity;
  /** Human-readable description */
  description: string;
  /** Current value */
  currentValue: number;
  /** Expected value (baseline) */
  expectedValue: number;
  /** Deviation from expected (absolute) */
  deviation: number;
  /** Deviation from expected (percentage) */
  deviationPercent: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Related metrics */
  relatedMetrics: string[];
  /** Suggested actions */
  suggestedActions: string[];
  /** Whether anomaly is still active */
  active: boolean;
  /** Timestamp when resolved (if resolved) */
  resolvedAt?: number;
}

/**
 * Anomaly detection configuration
 */
export interface AnomalyDetectionConfig {
  /** Hit rate drop threshold (percentage) */
  hitRateDropThreshold: number;
  /** Latency spike threshold (multiplier) */
  latencySpikeMultiplier: number;
  /** Memory leak threshold (growth rate %/minute) */
  memoryGrowthRate: number;
  /** Eviction storm threshold (evictions/second) */
  evictionStormThreshold: number;
  /** Similarity shift threshold (std devs) */
  similarityShiftThreshold: number;
  /** Minimum confidence to report (0-1) */
  minConfidence: number;
  /** Detection window (milliseconds) */
  detectionWindow: number;
  /** Baseline window (milliseconds) */
  baselineWindow: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetectionResult {
  /** Detected anomalies */
  anomalies: Anomaly[];
  /** Total anomalies detected */
  totalCount: number;
  /** Active anomalies */
  activeCount: number;
  /** Critical anomalies */
  criticalCount: number;
  /** Detection timestamp */
  timestamp: number;
  /** Next detection time recommended */
  nextDetectionTime: number;
}

// ============================================================================
// OPTIMIZATION RECOMMENDATION TYPES
// ============================================================================

/**
 * Optimization category
 */
export type OptimizationCategory =
  | "threshold" // Similarity threshold adjustment
  | "size" // Cache size adjustment
  | "ttl" // TTL adjustment
  | "warming" // Cache warming
  | "eviction" // Eviction policy change
  | "sharding" // Cache sharding/partitioning
  | "compression" // Data compression
  | "prefetching" // Query prefetching
  | "monitoring"; // Enhanced monitoring

/**
 * Recommendation priority
 */
export type RecommendationPriority = "low" | "medium" | "high" | "urgent";

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  /** Recommendation ID */
  id: string;
  /** Generated at timestamp */
  generatedAt: number;
  /** Priority level */
  priority: RecommendationPriority;
  /** Category */
  category: OptimizationCategory;
  /** Title */
  title: string;
  /** Detailed description */
  description: string;
  /** Current state */
  currentState: string;
  /** Recommended state */
  recommendedState: string;
  /** Expected improvement */
  expectedImprovement: {
    /** Hit rate improvement (absolute percentage) */
    hitRateImprovement?: number;
    /** Latency improvement (percentage) */
    latencyImprovement?: number;
    /** Memory improvement (percentage) */
    memoryImprovement?: number;
    /** Overall efficiency score improvement */
    efficiencyImprovement?: number;
  };
  /** Action to take */
  action: string;
  /** Estimated effort to implement */
  effort: "trivial" | "easy" | "moderate" | "significant" | "major";
  /** Risk level (0-1) */
  risk: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Supporting data/evidence */
  evidence: {
    metric: string;
    currentValue: number;
    targetValue: number;
    reason: string;
  }[];
  /** Related recommendations */
  relatedRecommendations: string[];
  /** Whether recommendation is auto-applicable */
  autoApplicable: boolean;
}

/**
 * Optimization recommendations summary
 */
export interface OptimizationSummary {
  /** All recommendations */
  recommendations: OptimizationRecommendation[];
  /** Count by priority */
  countByPriority: Partial<Record<RecommendationPriority, number>>;
  /** Count by category */
  countByCategory: Partial<Record<OptimizationCategory, number>>;
  /** Total potential improvement */
  totalPotentialImprovement: {
    hitRate: number;
    latency: number;
    memory: number;
  };
  /** Quick wins (high priority, low effort) */
  quickWins: OptimizationRecommendation[];
  /** Generated at timestamp */
  generatedAt: number;
}

// ============================================================================
// CACHE EFFICIENCY SCORING
// ============================================================================

/**
 * Cache efficiency score components
 */
export interface EfficiencyScoreComponents {
  /** Hit rate score (0-100) */
  hitRateScore: number;
  /** Memory efficiency score (0-100) */
  memoryScore: number;
  /** Latency score (0-100) */
  latencyScore: number;
  /** Eviction score (0-100) */
  evictionScore: number;
  /** Pattern optimization score (0-100) */
  patternScore: number;
}

/**
 * Overall cache efficiency score
 */
export interface EfficiencyScore {
  /** Overall score (0-100) */
  overall: number;
  /** Grade (A-F) */
  grade: "A" | "B" | "C" | "D" | "F";
  /** Component scores */
  components: EfficiencyScoreComponents;
  /** Score trend: improving, stable, declining */
  trend: "improving" | "stable" | "declining";
  /** Percentile ranking (0-100) */
  percentile: number;
  /** Comparison to baseline */
  baselineComparison: {
    baseline: number;
    current: number;
    delta: number;
    deltaPercent: number;
  };
  /** Timestamp calculated */
  calculatedAt: number;
}

/**
 * Efficiency score calculation config
 */
export interface EfficiencyScoreConfig {
  /** Hit rate weight (0-1) */
  hitRateWeight: number;
  /** Memory weight (0-1) */
  memoryWeight: number;
  /** Latency weight (0-1) */
  latencyWeight: number;
  /** Eviction weight (0-1) */
  evictionWeight: number;
  /** Pattern weight (0-1) */
  patternWeight: number;
  /** Baseline score for comparison */
  baselineScore?: number;
}

// ============================================================================
// DASHBOARD AND REPORTING TYPES
// ============================================================================

/**
 * Dashboard data structure
 */
export interface DashboardData {
  /** Metrics snapshot */
  metrics: CacheMetricsSnapshot;
  /** Recent anomalies */
  recentAnomalies: Anomaly[];
  /** Active recommendations */
  recommendations: OptimizationRecommendation[];
  /** Efficiency score */
  efficiencyScore: EfficiencyScore;
  /** Historical data (time series) */
  history: TimeSeriesData;
  /** Top issues */
  topIssues: {
    issue: string;
    severity: AnomalySeverity | RecommendationPriority;
    impact: string;
  }[];
  /** Generated at timestamp */
  generatedAt: number;
  /** Dashboard refresh interval (ms) */
  refreshInterval: number;
}

/**
 * Report format type
 */
export type ReportFormat = "json" | "html" | "markdown" | "csv";

/**
 * Report configuration
 */
export interface ReportConfig {
  /** Report format */
  format: ReportFormat;
  /** Include historical data */
  includeHistory: boolean;
  /** Include anomalies */
  includeAnomalies: boolean;
  /** Include recommendations */
  includeRecommendations: boolean;
  /** Include efficiency score */
  includeEfficiencyScore: boolean;
  /** Time window for historical data */
  historyWindow?: TimeWindow;
  /** Maximum anomalies to include */
  maxAnomalies?: number;
  /** Maximum recommendations to include */
  maxRecommendations?: number;
}

/**
 * Generated report
 */
export interface CacheAnalyticsReport {
  /** Report data (format-dependent) */
  data: unknown;
  /** Report format */
  format: ReportFormat;
  /** Generated at timestamp */
  generatedAt: number;
  /** Time range covered */
  timeRange: {
    start: number;
    end: number;
  };
  /** Report metadata */
  metadata: {
    cacheId: string;
    metricsSnapshots: number;
    anomaliesDetected: number;
    recommendationsGenerated: number;
  };
}

// ============================================================================
// PROMETHEUS/GRAPHITE EXPORT TYPES
// ============================================================================

/**
 * Prometheus metric type
 */
export type PrometheusMetricType = "gauge" | "counter" | "histogram" | "summary";

/**
 * Prometheus metric
 */
export interface PrometheusMetric {
  /** Metric name */
  name: string;
  /** Metric type */
  type: PrometheusMetricType;
  /** Metric value */
  value: number;
  /** Metric labels */
  labels: Record<string, string>;
  /** Help text */
  help?: string;
}

/**
 * Prometheus export format
 */
export interface PrometheusExport {
  /** Metrics in Prometheus text format */
  textFormat: string;
  /** Metrics as structured data */
  metrics: PrometheusMetric[];
  /** Export timestamp */
  exportedAt: number;
}

/**
 * Graphite metric
 */
export interface GraphiteMetric {
  /** Metric path (dot-separated) */
  path: string;
  /** Metric value */
  value: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Graphite export format
 */
export interface GraphiteExport {
  /** Metrics in Graphite plaintext format */
  plaintextFormat: string;
  /** Metrics as structured data */
  metrics: GraphiteMetric[];
  /** Export timestamp */
  exportedAt: number;
}

/**
 * Metrics export configuration
 */
export interface MetricsExportConfig {
  /** Include labels/dimensions */
  includeLabels: boolean;
  /** Prefix for metric names */
  metricPrefix?: string;
  /** Histogram buckets (for Prometheus) */
  histogramBuckets?: number[];
  /** Custom labels to add */
  customLabels?: Record<string, string>;
}

// ============================================================================
// CACHE ANALYTICS CONFIGURATION
// ============================================================================

/**
 * Main cache analytics configuration
 */
export interface CacheAnalyticsConfig {
  /** Metrics collection interval (ms) */
  metricsCollectionInterval: number;
  /** Historical data retention (ms) */
  historyRetention: number;
  /** Maximum historical data points */
  maxHistoryPoints: number;
  /** Anomaly detection config */
  anomalyDetection: AnomalyDetectionConfig;
  /** Efficiency score config */
  efficiencyScore: EfficiencyScoreConfig;
  /** Metrics export config */
  metricsExport: MetricsExportConfig;
  /** Enable real-time monitoring */
  enableRealTimeMonitoring: boolean;
  /** Enable anomaly detection */
  enableAnomalyDetection: boolean;
  /** Enable optimization recommendations */
  enableRecommendations: boolean;
  /** Dashboard refresh interval (ms) */
  dashboardRefreshInterval: number;
}

/**
 * Default cache analytics configuration
 */
export const DEFAULT_CACHE_ANALYTICS_CONFIG: CacheAnalyticsConfig = {
  metricsCollectionInterval: 60_000, // 1 minute
  historyRetention: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxHistoryPoints: 10_000,
  anomalyDetection: {
    hitRateDropThreshold: 0.15, // 15% drop
    latencySpikeMultiplier: 2.0, // 2x increase
    memoryGrowthRate: 0.05, // 5% growth/minute
    evictionStormThreshold: 10, // 10 evictions/second
    similarityShiftThreshold: 2.0, // 2 standard deviations
    minConfidence: 0.7,
    detectionWindow: 5 * 60 * 1000, // 5 minutes
    baselineWindow: 60 * 60 * 1000, // 1 hour
  },
  efficiencyScore: {
    hitRateWeight: 0.35,
    memoryWeight: 0.2,
    latencyWeight: 0.2,
    evictionWeight: 0.15,
    patternWeight: 0.1,
  },
  metricsExport: {
    includeLabels: true,
    metricPrefix: "cache_analytics",
    histogramBuckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    customLabels: {},
  },
  enableRealTimeMonitoring: true,
  enableAnomalyDetection: true,
  enableRecommendations: true,
  dashboardRefreshInterval: 5_000, // 5 seconds
};
