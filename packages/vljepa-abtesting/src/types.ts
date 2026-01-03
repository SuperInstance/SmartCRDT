/**
 * @fileoverview Core type definitions for A/B Testing Framework
 * @author Aequor Project - Round 23 Agent 2
 * @version 1.0.0
 */

import type { A2UIResponse } from "@lsi/protocol";

// ============================================================================
// EXPERIMENT TYPES
// ============================================================================

/**
 * Experiment status
 */
export type ExperimentStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "archived";

/**
 * Traffic allocation strategy
 */
export type AllocationStrategy =
  | "random" // Random assignment
  | "sticky" // Consistent assignment based on user ID
  | "hash" // Deterministic hashing
  | "adaptive"; // Adaptive allocation based on performance

/**
 * Metric types for tracking
 */
export type MetricType =
  | "conversion"
  | "engagement"
  | "revenue"
  | "satisfaction";

/**
 * Statistical test types
 */
export type StatisticalTest =
  | "z_test"
  | "t_test"
  | "chi_square"
  | "fisher_exact"
  | "bootstrap";

/**
 * UI change description
 */
export interface UIChange {
  type: string;
  path?: string;
  description: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Experiment variant
 */
export interface Variant {
  /** Unique variant ID */
  id: string;
  /** Variant name */
  name: string;
  /** Variant description */
  description: string;
  /** Traffic allocation percentage (0-100) */
  allocation: number;
  /** UI changes for this variant */
  changes: UIChange[];
  /** Whether this is the control variant */
  isControl: boolean;
  /** A2UI response for this variant */
  ui?: A2UIResponse;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Goal definition
 */
export interface Goal {
  /** Goal ID */
  id: string;
  /** Goal name */
  name: string;
  /** Goal description */
  description: string;
  /** Goal type */
  type: MetricType;
  /** Target value */
  targetValue?: number;
  /** Goal condition */
  condition?: "greater_than" | "less_than" | "equals";
}

/**
 * Metric configuration
 */
export interface Metric {
  /** Metric ID */
  id: string;
  /** Metric name */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Metric description */
  description: string;
  /** Whether higher is better */
  higherIsBetter: boolean;
  /** Unit label */
  unit?: string;
}

/**
 * Experiment configuration
 */
export interface ExperimentConfig {
  /** Unique experiment ID */
  id?: string;
  /** Experiment name */
  name: string;
  /** Experiment description */
  description: string;
  /** Variants to test */
  variants: Variant[];
  /** Allocation strategy */
  allocationStrategy: AllocationStrategy;
  /** Metrics to track */
  metrics: Metric[];
  /** Primary metric for winner determination */
  primaryMetric: string;
  /** Secondary metrics */
  secondaryMetrics?: string[];
  /** Goals */
  goals: Goal[];
  /** Target sample size */
  targetSampleSize?: number;
  /** Minimum sample size */
  minSampleSize?: number;
  /** Significance level (alpha) */
  significanceLevel?: number;
  /** Statistical power */
  power?: number;
  /** Minimum detectable effect */
  mde?: number;
  /** Experiment duration */
  duration?: {
    start: Date;
    end?: Date;
    minDuration?: number;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Experiment definition
 */
export interface Experiment {
  /** Experiment ID */
  id: string;
  /** Experiment name */
  name: string;
  /** Experiment description */
  description: string;
  /** Experiment status */
  status: ExperimentStatus;
  /** Variants */
  variants: Variant[];
  /** Allocation strategy */
  allocationStrategy: AllocationStrategy;
  /** Metrics */
  metrics: Metric[];
  /** Primary metric */
  primaryMetric: string;
  /** Secondary metrics */
  secondaryMetrics: string[];
  /** Goals */
  goals: Goal[];
  /** Target sample size */
  targetSampleSize?: number;
  /** Minimum sample size */
  minSampleSize: number;
  /** Significance level */
  significanceLevel: number;
  /** Statistical power */
  power: number;
  /** Minimum detectable effect */
  mde: number;
  /** Duration */
  duration?: {
    start: Date;
    end?: Date;
    minDuration?: number;
  };
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Created by */
  createdBy: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// ALLOCATION TYPES
// ============================================================================

/**
 * Allocation configuration
 */
export interface AllocationConfig {
  /** Allocation strategy */
  strategy: AllocationStrategy;
  /** How long to stick to assignment (days) */
  stickiness?: number;
  /** Hash key for deterministic allocation */
  hashKey?: string;
  /** Adaptation rate for adaptive strategy */
  adaptationRate?: number;
}

/**
 * Allocation result
 */
export interface AllocationResult {
  /** User ID */
  userId: string;
  /** Assigned variant ID */
  variant: string;
  /** Experiment ID */
  experiment: string;
  /** Assignment timestamp */
  timestamp: number;
  /** Allocation strategy used */
  strategy: AllocationStrategy;
  /** Confidence in allocation */
  confidence?: number;
}

// ============================================================================
// METRIC TYPES
// ============================================================================

/**
 * Metric value record
 */
export interface MetricValue {
  /** Metric name */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Value */
  value: number;
  /** Timestamp */
  timestamp: number;
  /** User ID */
  userId: string;
  /** Variant ID */
  variant: string;
  /** Experiment ID */
  experiment: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Metric summary statistics
 */
export interface MetricSummary {
  /** Metric ID */
  metricId: string;
  /** Variant ID */
  variantId: string;
  /** Count */
  count: number;
  /** Sum */
  sum: number;
  /** Mean */
  mean: number;
  /** Variance */
  variance: number;
  /** Standard deviation */
  stdDev: number;
  /** Minimum */
  min: number;
  /** Maximum */
  max: number;
  /** Median */
  median: number;
  /** Percentiles */
  percentiles?: {
    p25: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

/**
 * Conversion tracking data
 */
export interface ConversionData {
  /** User ID */
  userId: string;
  /** Variant ID */
  variantId: string;
  /** Experiment ID */
  experimentId: string;
  /** Whether converted */
  converted: boolean;
  /** Conversion value */
  value?: number;
  /** Timestamp */
  timestamp: number;
  /** Time to conversion (ms) */
  timeToConvert?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Engagement tracking data
 */
export interface EngagementData {
  /** User ID */
  userId: string;
  /** Variant ID */
  variantId: string;
  /** Experiment ID */
  experimentId: string;
  /** Session duration (ms) */
  duration: number;
  /** Number of interactions */
  interactions: number;
  /** Pages viewed */
  pageViews: number;
  /** Timestamp */
  timestamp: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

/**
 * Confidence interval
 */
export interface ConfidenceInterval {
  /** Lower bound */
  lower: number;
  /** Upper bound */
  upper: number;
  /** Confidence level */
  level: number;
}

/**
 * Test configuration
 */
export interface TestConfig {
  /** Metric to test */
  metric: string;
  /** Control variant */
  control: string;
  /** Treatment variant */
  treatment: string;
  /** Statistical test */
  test: StatisticalTest;
  /** Significance level */
  alpha: number;
  /** Two-tailed test */
  twoTailed: boolean;
}

/**
 * Test result
 */
export interface TestResult {
  /** Whether statistically significant */
  significant: boolean;
  /** P-value */
  pValue: number;
  /** Confidence interval */
  confidenceInterval: ConfidenceInterval;
  /** Effect size */
  effectSize: number;
  /** Statistical power */
  power: number;
  /** Recommendation */
  recommendation: string;
  /** Test used */
  test: StatisticalTest;
}

/**
 * Power analysis result
 */
export interface PowerAnalysisResult {
  /** Required sample size */
  sampleSize: number;
  /** Achieved power */
  power: number;
  /** Effect size */
  effectSize: number;
  /** Alpha level */
  alpha: number;
  /** Recommendation */
  recommendation: string;
}

// ============================================================================
// REPORTING TYPES
// ============================================================================

/**
 * Chart type
 */
export type ChartType =
  | "line"
  | "bar"
  | "pie"
  | "area"
  | "scatter"
  | "funnel"
  | "heatmap";

/**
 * Chart data point
 */
export interface ChartDataPoint {
  /** X value */
  x: string | number;
  /** Y value */
  y: number;
  /** Label */
  label?: string;
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Chart data
 */
export interface ChartData {
  /** Chart type */
  type: ChartType;
  /** Chart title */
  title: string;
  /** Data series */
  series: {
    /** Series name */
    name: string;
    /** Data points */
    data: ChartDataPoint[];
    /** Color */
    color?: string;
  }[];
  /** X-axis label */
  xAxis?: string;
  /** Y-axis label */
  yAxis?: string;
}

/**
 * Alert type
 */
export type AlertType = "significant" | "warning" | "info" | "error";

/**
 * Alert
 */
export interface Alert {
  /** Alert ID */
  id: string;
  /** Alert type */
  type: AlertType;
  /** Alert title */
  title: string;
  /** Alert message */
  message: string;
  /** Timestamp */
  timestamp: number;
  /** Experiment ID */
  experimentId: string;
  /** Associated data */
  data?: Record<string, unknown>;
}

/**
 * Winner determination result
 */
export interface WinnerResult {
  /** Winning variant ID */
  winningVariant: string;
  /** Confidence level */
  confidence: number;
  /** Expected lift */
  lift: number;
  /** Risk level */
  risk: "low" | "medium" | "high";
  /** Reasoning */
  reasoning: string[];
  /** Cautions */
  cautions: string[];
  /** Next steps */
  nextSteps: string[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Recommendation
 */
export interface Recommendation {
  /** Recommendation type */
  type: "implement" | "continue" | "stop" | "modify";
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Affected variant */
  variant: string;
  /** Priority */
  priority: "low" | "medium" | "high";
  /** Reasoning */
  reasoning: string[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Dashboard configuration
 */
export interface DashboardConfig {
  /** Auto-refresh interval (ms) */
  refreshInterval: number;
  /** Show real-time data */
  showRealtime: boolean;
  /** Alert on significant results */
  alertOnSignificant: boolean;
  /** Chart types to display */
  charts: ChartType[];
  /** Maximum alerts to display */
  maxAlerts: number;
}

/**
 * Dashboard data
 */
export interface DashboardData {
  /** Experiment */
  experiment: Experiment;
  /** Metric summaries */
  metrics: MetricSummary[];
  /** Charts */
  charts: ChartData[];
  /** Alerts */
  alerts: Alert[];
  /** Winner recommendation */
  winner?: WinnerResult;
  /** Timestamp */
  timestamp: number;
}

/**
 * Experiment report
 */
export interface ExperimentReport {
  /** Experiment */
  experiment: Experiment;
  /** Status summary */
  status: {
    totalParticipants: number;
    totalConversions: number;
    overallConversionRate: number;
    status:
      | "needs_more_data"
      | "ready_to_conclude"
      | "inconclusive"
      | "significant_winner_found";
  };
  /** Variant summaries */
  variants: {
    variantId: string;
    variantName: string;
    impressions: number;
    conversions: number;
    conversionRate: number;
    metrics: MetricSummary[];
  }[];
  /** Statistical tests */
  tests: TestResult[];
  /** Winner recommendation */
  winner?: WinnerResult;
  /** Recommendations */
  recommendations: Recommendation[];
  /** Timestamp */
  timestamp: number;
}

// ============================================================================
// INTEGRATION TYPES
// ============================================================================

/**
 * A2UI integration configuration
 */
export interface A2UIConfig {
  /** Experiment ID */
  experiment: string;
  /** Variant UIs */
  variants: Record<string, A2UIResponse>;
  /** Default variant */
  defaultVariant: string;
  /** Fallback variant */
  fallbackVariant: string;
}

/**
 * A2UI event
 */
export interface A2UIEvent {
  /** Event type */
  type: string;
  /** Component ID */
  componentId?: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
  /** User ID */
  userId?: string;
  /** Variant ID */
  variantId?: string;
}

// ============================================================================
// STORAGE TYPES
// ============================================================================

/**
 * Experiment storage interface
 */
export interface ExperimentStorage {
  /** Get experiment by ID */
  getExperiment(id: string): Promise<Experiment | null>;
  /** Save experiment */
  saveExperiment(experiment: Experiment): Promise<void>;
  /** Delete experiment */
  deleteExperiment(id: string): Promise<void>;
  /** List experiments */
  listExperiments(filter?: {
    status?: ExperimentStatus;
  }): Promise<Experiment[]>;
}

/**
 * Result storage interface */
export interface ResultStorage {
  /** Save metric value */
  saveMetric(value: MetricValue): Promise<void>;
  /** Get metric values */
  getMetrics(experimentId: string, variantId?: string): Promise<MetricValue[]>;
  /** Save conversion data */
  saveConversion(conversion: ConversionData): Promise<void>;
  /** Get conversion data */
  getConversions(
    experimentId: string,
    variantId?: string
  ): Promise<ConversionData[]>;
  /** Save engagement data */
  saveEngagement(engagement: EngagementData): Promise<void>;
  /** Get engagement data */
  getEngagement(
    experimentId: string,
    variantId?: string
  ): Promise<EngagementData[]>;
  /** Clear results for experiment */
  clearResults(experimentId: string): Promise<void>;
}

/**
 * Event storage interface
 */
export interface EventStorage {
  /** Save event */
  saveEvent(event: A2UIEvent): Promise<void>;
  /** Get events */
  getEvents(experimentId: string, userId?: string): Promise<A2UIEvent[]>;
  /** Clear events */
  clearEvents(experimentId: string): Promise<void>;
}
