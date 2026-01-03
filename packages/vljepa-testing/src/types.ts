/**
 * Core Types for VL-JEPA Testing Framework
 * Provides comprehensive type definitions for load, stress, performance,
 * endurance, scalability testing, and reporting.
 */

// ============================================================================
// Common Test Types
// ============================================================================

export interface TestConfig {
  name: string;
  description?: string;
  timeout?: number;
  retries?: number;
}

export interface TestResult {
  success: boolean;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Latency and Performance Types
// ============================================================================

export interface LatencyMetrics {
  min: number;
  max: number;
  mean: number;
  median: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  p999: number;
  stddev: number;
}

export interface ResourceMetrics {
  cpu: {
    usage: number;
    load: number[];
    cores: number;
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
    heap?: {
      used: number;
      limit: number;
      total: number;
    };
  };
  network?: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  disk?: {
    read: number;
    write: number;
    iops: number;
  };
}

export interface PerformanceMetrics {
  latency: LatencyMetrics;
  throughput: number;
  resourceUsage: ResourceMetrics;
  timestamp: number;
}

// ============================================================================
// Load Testing Types
// ============================================================================

export interface LoadTestConfig extends TestConfig {
  concurrentUsers: number;
  requestsPerSecond: number;
  rampUpDuration: number;
  sustainDuration: number;
  rampDownDuration: number;
  requestGenerator?: () => TestRequest;
  clientConfig?: ClientConfig;
}

export interface LoadTestResult extends TestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latency: LatencyMetrics;
  throughput: number;
  errors: ErrorStats;
  resourceUsage: ResourceMetrics;
  rampUpData: LoadPhase;
  sustainData: LoadPhase;
  rampDownData: LoadPhase;
}

export interface LoadPhase {
  requests: number;
  successes: number;
  failures: number;
  duration: number;
  avgLatency: number;
}

export interface TestRequest {
  id: string;
  type: string;
  payload: unknown;
  timestamp: number;
  timeout?: number;
}

export interface ClientConfig {
  connectionTimeout: number;
  requestTimeout: number;
  keepAlive: boolean;
  maxConnections: number;
  maxRetries: number;
}

export interface ErrorStats {
  total: number;
  byType: Record<string, number>;
  byCode: Record<string, number>;
  samples: ErrorSample[];
}

export interface ErrorSample {
  error: string;
  code?: string;
  timestamp: number;
  latency: number;
  request: TestRequest;
}

// ============================================================================
// Stress Testing Types
// ============================================================================

export interface StressTestConfig extends TestConfig {
  maxLoad: number;
  spikeMagnitude: number;
  spikeDuration: number;
  recoveryCheck: boolean;
  recoveryTimeout: number;
  loadIncrement: number;
  incrementInterval: number;
}

export interface StressTestResult extends TestResult {
  breakingPoint: number;
  breakingLatency: number;
  failureMode: string;
  recovered: boolean;
  recoveryTime: number;
  spikeSurvived: boolean;
  loadPoints: LoadPoint[];
  degradationCurve: PerformancePoint[];
}

export interface LoadPoint {
  load: number;
  requests: number;
  successes: number;
  failures: number;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
}

export interface PerformancePoint {
  load: number;
  throughput: number;
  latency: number;
  resourceUsage: number;
  timestamp: number;
}

// ============================================================================
// Endurance Testing Types
// ============================================================================

export interface EnduranceTestConfig extends TestConfig {
  duration: number;
  sampleInterval: number;
  memoryThreshold: number;
  degradationThreshold: number;
  stabilityThreshold: number;
  loadLevel: number;
}

export interface EnduranceTestResult extends TestResult {
  duration: number;
  samples: EnduranceSample[];
  memoryLeaks: MemoryLeak[];
  stable: boolean;
  degradation: number;
  stabilityScore: number;
  recommendation: string;
  trends: PerformanceTrend[];
}

export interface EnduranceSample {
  timestamp: number;
  latency: LatencyMetrics;
  throughput: number;
  memory: number;
  cpu: number;
  errors: number;
}

export interface MemoryLeak {
  detected: boolean;
  leakRate: number;
  estimatedLeak: number;
  confidence: number;
  location?: string;
}

export interface PerformanceTrend {
  metric: string;
  direction: "improving" | "stable" | "degrading";
  rate: number;
  correlation: number;
}

// ============================================================================
// Scalability Testing Types
// ============================================================================

export interface ScaleTestConfig extends TestConfig {
  scaleDirection: "up" | "down";
  scaleType: "horizontal" | "vertical";
  maxInstances?: number;
  maxResources?: ResourceLimits;
  measureCost: boolean;
  baselineLoad: number;
  scaleSteps: number;
  stepDuration: number;
}

export interface ResourceLimits {
  cpu: number;
  memory: number;
  disk?: number;
  network?: number;
}

export interface ScaleTestResult extends TestResult {
  baseline: PerformanceMetrics;
  scaled: PerformanceMetrics[];
  scalability: ScalabilityType;
  scalingFactor: number;
  optimalConfiguration: OptimalConfig;
  costPerRequest: number;
  efficiency: number;
  scalingCurve: ScalingPoint[];
}

export type ScalabilityType =
  | "linear"
  | "superlinear"
  | "sublinear"
  | "degrading";

export interface OptimalConfig {
  instances: number;
  resources: ResourceLimits;
  performance: number;
  cost: number;
  score: number;
}

export interface ScalingPoint {
  configuration: number;
  throughput: number;
  latency: number;
  efficiency: number;
  costPerRequest: number;
}

// ============================================================================
// Scenario Testing Types
// ============================================================================

export interface TestScenario {
  name: string;
  description: string;
  stages: TestStage[];
  duration: number;
  expectedBehavior: string;
  tags: string[];
}

export interface TestStage {
  name: string;
  load: LoadConfig;
  duration: number;
  assertions: Assertion[];
  actions?: TestAction[];
}

export interface LoadConfig {
  pattern: TrafficPattern;
  rate: number;
  users: number;
  duration: number;
  rampUp?: number;
  rampDown?: number;
}

export type TrafficPattern =
  | "poisson"
  | "bursty"
  | "periodic"
  | "real_world"
  | "constant";

export interface Assertion {
  type: "latency" | "error_rate" | "throughput" | "resource" | "availability";
  metric: string;
  threshold: number;
  operator: ComparisonOperator;
  duration?: number;
}

export type ComparisonOperator = "lt" | "lte" | "gt" | "gte" | "eq" | "ne";

export interface TestAction {
  type: "scale" | "fault" | "config_change" | "traffic_change";
  timestamp: number;
  config: Record<string, unknown>;
  description: string;
}

// ============================================================================
// SLA Reporting Types
// ============================================================================

export interface SLAConfig {
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  availability: number;
  throughput: number;
  errorRate: number;
  resourceUsage?: {
    cpu: number;
    memory: number;
  };
}

export interface SLAReport {
  compliant: boolean;
  score: number;
  metrics: SLAMetrics;
  violations: SLAViolation[];
  recommendations: string[];
  summary: SLASummary;
  timestamp: number;
}

export interface SLAMetrics {
  latency: SLALatencyMetrics;
  availability: number;
  throughput: number;
  errorRate: number;
  resourceUsage?: ResourceMetrics;
  compliance: Record<string, boolean>;
}

export interface SLALatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  compliant: boolean;
}

export interface SLAViolation {
  metric: string;
  threshold: number;
  actual: number;
  severity: "minor" | "major" | "critical";
  duration: number;
  timestamp: number;
}

export interface SLASummary {
  totalMetrics: number;
  passingMetrics: number;
  failingMetrics: number;
  overallCompliance: number;
  worstViolation: SLAViolation | null;
}

// ============================================================================
// Traffic Generation Types
// ============================================================================

export interface TrafficConfig {
  pattern: TrafficPattern;
  rate: number;
  duration: number;
  burstiness?: number;
  period?: number;
  realData?: TrafficData;
  seed?: number;
}

export interface TrafficData {
  timestamps: number[];
  requestsPerInterval: number[];
  pattern: string;
  source: string;
}

export interface GeneratedTraffic {
  requests: GeneratedRequest[];
  duration: number;
  stats: TrafficStats;
  pattern: TrafficPattern;
}

export interface GeneratedRequest {
  timestamp: number;
  type: string;
  payload: unknown;
  priority: number;
  expectedLatency?: number;
}

export interface TrafficStats {
  totalRequests: number;
  requestsPerSecond: number;
  burstCount: number;
  avgBurstSize: number;
  periodicity: number;
}

// ============================================================================
// Alert and Notification Types
// ============================================================================

export interface Alert {
  id: string;
  severity: "info" | "warning" | "error" | "critical";
  type: string;
  message: string;
  metric: string;
  threshold: number;
  actual: number;
  timestamp: number;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface AlertConfig {
  enabled: boolean;
  thresholds: Record<string, number>;
  cooldown: number;
  notifications: NotificationConfig[];
}

export interface NotificationConfig {
  type: "email" | "webhook" | "slack" | "pagerduty";
  destination: string;
  filters: AlertFilter[];
}

export interface AlertFilter {
  severity: string[];
  types: string[];
}

// ============================================================================
// Utility Types
// ============================================================================

export interface PercentileResult {
  value: number;
  count: number;
  percentage: number;
}

export interface Histogram {
  buckets: number[];
  counts: number[];
  min: number;
  max: number;
  mean: number;
  stddev: number;
}

export interface TimeSeries {
  timestamps: number[];
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface ComparisonResult {
  baseline: number;
  current: number;
  diff: number;
  diffPercent: number;
  significant: boolean;
  confidence: number;
}

// ============================================================================
// Test Execution Types
// ============================================================================

export interface TestExecutionContext {
  testId: string;
  startTime: number;
  config: TestConfig;
  state: TestState;
  metrics: MetricsAggregator;
  cancelRequested: boolean;
}

export type TestState =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface MetricsAggregator {
  latency: number[];
  errors: ErrorSample[];
  resourceSamples: ResourceMetrics[];
  throughputSamples: number[];
  addLatency(value: number): void;
  addError(error: ErrorSample): void;
  addResource(sample: ResourceMetrics): void;
  getLatencyMetrics(): LatencyMetrics;
  getThroughput(): number;
}
