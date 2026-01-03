/**
 * Analytics Types for @lsi/vljepa-analytics
 * Comprehensive type definitions for analytics, dashboards, and personalization
 */

// ============================================================================
// Event Types
// ============================================================================

export type EventType =
  | "page_view"
  | "click"
  | "hover"
  | "scroll"
  | "submit"
  | "custom"
  | "impression"
  | "engagement"
  | "conversion"
  | "error";

export type EventCategory =
  | "navigation"
  | "interaction"
  | "transaction"
  | "system"
  | "custom";

export interface EventContext {
  url?: string;
  referrer?: string;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  screen?: {
    width: number;
    height: number;
  };
  locale?: string;
  timezone?: string;
  platform?: string;
  appVersion?: string;
}

export interface Event {
  id: string;
  type: EventType;
  category: EventCategory;
  timestamp: number;
  userId: string;
  sessionId: string;
  properties: Record<string, unknown>;
  context: EventContext;
}

export interface EventCollectorConfig {
  batchSize: number;
  flushInterval: number; // ms
  sampling: number; // 0-1, sampling rate
  endpoint?: string;
  bufferSize?: number;
}

// ============================================================================
// Metric Types
// ============================================================================

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface MetricCollectorConfig {
  flushInterval: number;
  aggregationWindow: number; // ms
  percentiles: number[];
}

// ============================================================================
// User and Session Types
// ============================================================================

export interface UserProfile {
  userId: string;
  traits: Record<string, unknown>;
  preferences: UserPreferences;
  segments: string[];
  firstSeen: number;
  lastSeen: number;
  sessionCount: number;
  totalSessions: number;
  lifetimeValue: number;
  customProperties: Record<string, unknown>;
}

export interface UserPreferences {
  language: string;
  theme: string;
  notifications: boolean;
  accessibility: Record<string, boolean>;
  customSettings: Record<string, unknown>;
}

export interface Session {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  pageViews: number;
  events: number;
  conversions: number;
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  device?: {
    type: "desktop" | "mobile" | "tablet";
    os?: string;
    browser?: string;
  };
  customProperties: Record<string, unknown>;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export type WidgetType =
  | "overview"
  | "users"
  | "sessions"
  | "events"
  | "funnels"
  | "cohorts"
  | "realtime"
  | "personalization"
  | "experiments";

export type DateRangePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_14_days"
  | "last_30_days"
  | "last_90_days"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom";

export interface DateRange {
  start: Date;
  end: Date;
  preset?: DateRangePreset;
}

export interface Filter {
  field: string;
  operator:
    | "equals"
    | "contains"
    | "startsWith"
    | "endsWith"
    | "gt"
    | "lt"
    | "gte"
    | "lte"
    | "in";
  value: unknown;
}

export interface DashboardConfig {
  refreshInterval: number; // ms
  widgets: WidgetType[];
  dateRange: DateRange;
  filters: Filter[];
  exportFormats: ("csv" | "json" | "pdf")[];
  theme?: "light" | "dark";
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface OverviewMetrics {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  totalEvents: number;
  bounceRate: number;
  avgSessionDuration: number;
  conversionRate: number;
  pageViewsPerSession: number;
  dateRange: DateRange;
}

export interface UserMetrics {
  total: number;
  new: number;
  returning: number;
  active: number;
  churned: number;
  retention: {
    day1: number;
    day7: number;
    day30: number;
  };
  topSegments: Array<{
    segment: string;
    count: number;
    percentage: number;
  }>;
}

export interface SessionMetrics {
  total: number;
  average: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  bounceRate: number;
  averagePageViews: number;
  topReferrers: Array<{
    referrer: string;
    count: number;
    percentage: number;
  }>;
}

export interface EventMetrics {
  total: number;
  unique: number;
  perSession: number;
  topEvents: Array<{
    event: string;
    count: number;
    unique: number;
    percentage: number;
  }>;
  byCategory: Record<string, number>;
  trends: Array<{
    date: string;
    count: number;
  }>;
}

export interface FunnelStep {
  name: string;
  count: number;
  percentage: number;
  dropoff: number;
  averageTime: number;
}

export interface FunnelMetrics {
  name: string;
  steps: FunnelStep[];
  totalUsers: number;
  completionRate: number;
  averageDropoffRate: number;
  totalDuration: number;
  breakdown?: Record<string, FunnelMetrics>;
}

export interface CohortMetrics {
  cohorts: Array<{
    name: string;
    size: number;
    retention: Array<{
      period: number;
      percentage: number;
      count: number;
    }>;
  }>;
}

export interface DashboardData {
  overview: OverviewMetrics;
  users: UserMetrics;
  sessions: SessionMetrics;
  events: EventMetrics;
  funnels: FunnelMetrics[];
  cohorts: CohortMetrics;
  timestamp: number;
}

// ============================================================================
// Personalization Types
// ============================================================================

export interface RecMetrics {
  diversity: number;
  novelty: number;
  serendipity: number;
  coverage: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
}

export interface PersonalizationMetrics {
  accuracy: number; // Prediction accuracy
  precision: number;
  recall: number;
  f1Score: number;
  satisfaction: number; // User satisfaction (0-1)
  engagementLift: number; // Engagement lift vs baseline (percentage)
  recommendationPerformance: RecMetrics;
  clickThroughRate: number;
  conversionRate: number;
  averageOrderValue: number;
  personalizationCoverage: number; // Percentage of users receiving personalized content
  timestamp: number;
  dateRange: DateRange;
}

export interface PersonalizationInsight {
  type: "preference" | "behavior" | "demographic" | "contextual";
  userId: string;
  preference: string;
  confidence: number;
  impact: "low" | "medium" | "high";
  description: string;
  suggestedActions: string[];
  metadata: Record<string, unknown>;
}

// ============================================================================
// Chart Types
// ============================================================================

export type ChartType =
  | "line"
  | "bar"
  | "pie"
  | "heatmap"
  | "funnel"
  | "sankey"
  | "scatter"
  | "area";

export interface ChartData {
  labels?: string[];
  datasets: Array<{
    label: string;
    data: number[] | Record<string, number>;
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
  }>;
}

export interface ChartOptions {
  responsive?: boolean;
  interactive?: boolean;
  animation?: boolean;
  legend?: boolean;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  tooltip?: {
    enabled?: boolean;
    format?: string;
  };
  colors?: string[];
  theme?: "light" | "dark";
}

export interface ChartConfig {
  type: ChartType;
  data: ChartData;
  options: ChartOptions;
  interactive: boolean;
  responsive: boolean;
  elementId: string;
}

export interface RenderedChart {
  type: string;
  data: unknown;
  options: unknown;
  element: string; // DOM element ID
  renderTime: number;
}

// ============================================================================
// Insight Types
// ============================================================================

export type InsightType =
  | "trend"
  | "anomaly"
  | "correlation"
  | "recommendation";

export interface InsightData {
  metric?: string;
  currentValue?: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  trend?: "up" | "down" | "stable" | "volatile";
  correlation?: {
    metric1: string;
    metric2: string;
    coefficient: number;
  };
}

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  confidence: number; // 0-1
  impact: "low" | "medium" | "high";
  actionable: boolean;
  suggestedActions: string[];
  data: InsightData;
  timestamp: number;
  expiresAt?: number;
  dismissed: boolean;
}

export interface InsightConfig {
  minConfidence: number;
  lookbackPeriod: number; // ms
  refreshInterval: number; // ms
  categories: InsightType[];
}

// ============================================================================
// Alert Types
// ============================================================================

export type AlertType = "threshold" | "anomaly" | "trend" | "system";
export type AlertSeverity = "info" | "warning" | "error" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  timestamp: number;
  acknowledgedAt?: number;
  resolvedAt?: number;
  acknowledgedBy?: string;
  resolvedBy?: string;
  metadata: Record<string, unknown>;
}

export interface AlertRule {
  id: string;
  name: string;
  type: AlertType;
  metric: string;
  condition: "gt" | "lt" | "eq" | "gte" | "lte" | "outside" | "inside";
  threshold: number | [number, number];
  severity: AlertSeverity;
  cooldown: number; // ms between alerts
  enabled: boolean;
  notificationChannels: string[];
}

export interface AlertConfig {
  rules: AlertRule[];
  notifications: NotificationChannel[];
  cooldown: number; // ms between alerts
  maxAlertsPerHour: number;
}

export type NotificationChannelType =
  | "email"
  | "webhook"
  | "slack"
  | "pagerduty"
  | "sms";

export interface NotificationChannel {
  id: string;
  name: string;
  type: NotificationChannelType;
  enabled: boolean;
  config: Record<string, unknown>;
}

// ============================================================================
// Aggregation Types
// ============================================================================

export type AggregationType =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "unique";

export interface AggregationConfig {
  type: AggregationType;
  field?: string;
  groupBy?: string[];
  window?: number; // ms
  filters?: Filter[];
}

export interface AggregatedMetric {
  timestamp: number;
  value: number;
  metadata: Record<string, unknown>;
}

// ============================================================================
// Anomaly Detection Types
// ============================================================================

export type AnomalyAlgorithm =
  | "zscore"
  | "iqr"
  | "isolation_forest"
  | "moving_average";

export interface AnomalyConfig {
  algorithm: AnomalyAlgorithm;
  sensitivity: number; // 0-1
  windowSize: number; // number of data points
  minDataPoints: number;
}

export interface Anomaly {
  id: string;
  metric: string;
  timestamp: number;
  value: number;
  expected: number;
  deviation: number;
  score: number;
  severity: "low" | "medium" | "high";
  description: string;
}

// ============================================================================
// Export Types
// ============================================================================

export type ExportFormat = "csv" | "json" | "pdf" | "xlsx";

export interface ExportConfig {
  format: ExportFormat;
  dateRange: DateRange;
  filters: Filter[];
  metrics: string[];
  includeRawData: boolean;
  compression: boolean;
}

export interface ExportResult {
  id: string;
  format: ExportFormat;
  url: string;
  size: number;
  createdAt: number;
  expiresAt: number;
}

// ============================================================================
// Report Types
// ============================================================================

export interface ReportSchedule {
  id: string;
  name: string;
  type: "daily" | "weekly" | "monthly";
  recipients: string[];
  format: ExportFormat;
  dashboardId: string;
  enabled: boolean;
  nextRun: number;
  timezone: string;
}

export interface Report {
  id: string;
  name: string;
  description: string;
  dashboardId: string;
  dateRange: DateRange;
  filters: Filter[];
  format: ExportFormat;
  createdAt: number;
  createdBy: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface AnalyticsAPIConfig {
  port: number;
  host: string;
  cors?: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  authentication?: {
    enabled: boolean;
    type: "api_key" | "oauth2" | "jwt";
  };
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: number;
    requestId: string;
    version: string;
  };
}

// ============================================================================
// WebSocket Types
// ============================================================================

export interface WebSocketMessage {
  type: "event" | "metric" | "alert" | "insight" | "dashboard_update";
  data: unknown;
  timestamp: number;
}

export interface WebSocketConfig {
  port: number;
  path: string;
  pingInterval: number;
  pongTimeout: number;
}

// ============================================================================
// Segmentation Types
// ============================================================================

export interface Segment {
  id: string;
  name: string;
  description: string;
  filters: Filter[];
  size: number;
  createdAt: number;
  updatedAt: number;
}

export interface SegmentRule {
  id: string;
  name: string;
  conditions: Filter[];
  logic: "and" | "or";
}

// ============================================================================
// Experiment/A-B Testing Types
// ============================================================================

export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: "draft" | "running" | "paused" | "completed";
  variants: Array<{
    id: string;
    name: string;
    traffic: number; // percentage
    config: Record<string, unknown>;
  }>;
  metrics: string[];
  startDate?: number;
  endDate?: number;
  sampleSize: number;
  confidence: number;
  winner?: string;
  results?: ExperimentResults;
}

export interface ExperimentResults {
  totalParticipants: number;
  totalConversions: number;
  variants: Array<{
    id: string;
    participants: number;
    conversions: number;
    conversionRate: number;
    confidence: number;
    significance: number;
    uplift?: number;
    improvement?: number;
  }>;
  winner: string;
  recommended: boolean;
}

// ============================================================================
// Real-time Types
// ============================================================================

export interface RealtimeMetrics {
  activeUsers: number;
  currentPageViews: number;
  currentSessionCount: number;
  eventsPerMinute: number;
  averageLatency: number;
  errorRate: number;
  topPages: Array<{
    url: string;
    views: number;
  }>;
  timestamp: number;
}

// ============================================================================
// Flow Types
// ============================================================================

export interface FlowNode {
  id: string;
  name: string;
  type: "page" | "event" | "action";
  count: number;
  percentage: number;
}

export interface FlowConnection {
  source: string;
  target: string;
  count: number;
  percentage: number;
  averageTime: number;
}

export interface UserFlow {
  nodes: FlowNode[];
  connections: FlowConnection[];
  totalUsers: number;
  dropoffPoints: FlowNode[];
  timestamp: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Sort {
  field: string;
  direction: "asc" | "desc";
}

export interface QueryOptions {
  pagination?: Pagination;
  sort?: Sort;
  filters?: Filter[];
  dateRange?: DateRange;
}
