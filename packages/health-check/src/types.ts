/**
 * Health Check Types
 *
 * Comprehensive type definitions for health checking system.
 */

/**
 * Health status enumeration
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Check interval in milliseconds */
  checkInterval: number;
  /** Timeout for each check in milliseconds */
  timeout: number;
  /** Failure threshold before marking unhealthy */
  failureThreshold: number;
  /** Success threshold for recovery */
  successThreshold: number;
  /** Health endpoint to check */
  endpoint?: string;
  /** Expected HTTP status code */
  expectedStatus?: number;
  /** Maximum response time in ms before degraded */
  maxResponseTime?: number;
}

/**
 * Individual health metric
 */
export interface HealthMetric {
  /** Metric name */
  name: string;
  /** Current value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** Warning threshold */
  warningThreshold?: number;
  /** Critical threshold */
  criticalThreshold?: number;
  /** Current status */
  status: HealthStatus;
  /** Timestamp of measurement */
  timestamp: Date;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Worker health status
 */
export interface WorkerHealth {
  /** Worker identifier */
  workerId: string;
  /** Overall health status */
  status: HealthStatus;
  /** Individual health metrics */
  metrics: HealthMetric[];
  /** Last check timestamp */
  lastCheck: Date;
  /** Worker uptime in milliseconds */
  uptime: number;
  /** Consecutive failures */
  consecutiveFailures: number;
  /** Consecutive successes */
  consecutiveSuccesses: number;
  /** Error message if unhealthy */
  error?: string;
  /** Response time in milliseconds */
  responseTime?: number;
}

/**
 * System-wide health status
 */
export interface SystemHealth {
  /** Total number of workers */
  totalWorkers: number;
  /** Number of healthy workers */
  healthy: number;
  /** Number of degraded workers */
  degraded: number;
  /** Number of unhealthy workers */
  unhealthy: number;
  /** Number of unknown workers */
  unknown: number;
  /** Overall system health percentage */
  healthPercentage: number;
  /** Timestamp of check */
  timestamp: Date;
  /** Individual worker health */
  workers: Map<string, WorkerHealth>;
}

/**
 * Health check function signature
 */
export type HealthCheckFunction = () => Promise<boolean>;

/**
 * Custom health check registration
 */
export interface CustomHealthCheck {
  /** Check name */
  name: string;
  /** Check function */
  check: HealthCheckFunction;
  /** Check interval (overrides default) */
  interval?: number;
  /** Timeout for this check */
  timeout?: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Check name */
  name: string;
  /** Whether check passed */
  passed: boolean;
  /** Response time in milliseconds */
  responseTime: number;
  /** Error message if failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Health history entry
 */
export interface HealthHistoryEntry {
  /** Timestamp */
  timestamp: Date;
  /** Worker ID */
  workerId: string;
  /** Status */
  status: HealthStatus;
  /** Metrics snapshot */
  metrics: HealthMetric[];
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Alert enabled */
  enabled: boolean;
  /** Alert on degraded status */
  alertOnDegraded: boolean;
  /** Alert on unhealthy status */
  alertOnUnhealthy: boolean;
  /** Alert on status change */
  alertOnStatusChange: boolean;
  /** Minimum time between alerts (ms) */
  minAlertInterval: number;
  /** Alert channels */
  channels: AlertChannel[];
}

/**
 * Alert channel types
 */
export type AlertChannelType =
  | "console"
  | "webhook"
  | "email"
  | "log"
  | "callback";

/**
 * Alert channel configuration
 */
export interface AlertChannel {
  /** Channel type */
  type: AlertChannelType;
  /** Channel-specific config */
  config: Record<string, unknown>;
  /** Enabled flag */
  enabled: boolean;
}

/**
 * Alert message
 */
export interface AlertMessage {
  /** Alert ID */
  id: string;
  /** Worker ID */
  workerId: string;
  /** Previous status */
  previousStatus: HealthStatus;
  /** Current status */
  currentStatus: HealthStatus;
  /** Severity */
  severity: "info" | "warning" | "critical";
  /** Message */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Metrics snapshot */
  metrics: HealthMetric[];
}

/**
 * Circuit breaker state
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening */
  failureThreshold: number;
  /** Number of successes before closing */
  successThreshold: number;
  /** Time to wait before half-open (ms) */
  cooldownPeriod: number;
  /** Time window for counting failures (ms) */
  failureWindow: number;
}

/**
 * Circuit breaker state snapshot
 */
export interface CircuitBreakerState {
  /** Current state */
  state: CircuitState;
  /** Failure count */
  failureCount: number;
  /** Success count */
  successCount: number;
  /** Last failure time */
  lastFailureTime?: Date;
  /** Last success time */
  lastSuccessTime?: Date;
  /** Last state change */
  lastStateChange: Date;
}

/**
 * Aggregation strategy
 */
export type AggregationStrategy =
  | "average"
  | "weighted"
  | "min"
  | "max"
  | "custom";

/**
 * Aggregation configuration
 */
export interface AggregationConfig {
  /** Aggregation strategy */
  strategy: AggregationStrategy;
  /** Weights for weighted strategy */
  weights?: Map<string, number>;
  /** Custom aggregation function */
  customFunction?: (metrics: HealthMetric[]) => number;
  /** Minimum number of checks required */
  minChecks?: number;
}

/**
 * Trend analysis data
 */
export interface TrendData {
  /** Metric name */
  metric: string;
  /** Current value */
  current: number;
  /** Previous value */
  previous: number;
  /** Change percentage */
  changePercent: number;
  /** Trend direction */
  trend: "up" | "down" | "stable";
  /** Time period */
  period: number;
}

/**
 * Dashboard data
 */
export interface DashboardData {
  /** System health */
  systemHealth: SystemHealth;
  /** Recent alerts */
  recentAlerts: AlertMessage[];
  /** Health trends */
  trends: TrendData[];
  /** Circuit breaker states */
  circuitBreakers: Map<string, CircuitBreakerState>;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * HTTP check specific config
 */
export interface HttpCheckConfig extends HealthCheckConfig {
  /** URL to check */
  url: string;
  /** HTTP method */
  method?: "GET" | "POST" | "HEAD" | "OPTIONS";
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: string;
  /** Expected status codes */
  expectedStatuses?: number[];
  /** Follow redirects */
  followRedirects?: boolean;
}

/**
 * TCP check specific config
 */
export interface TcpCheckConfig extends HealthCheckConfig {
  /** Host to connect to */
  host: string;
  /** Port to connect to */
  port: number;
  /** Connection timeout */
  connectionTimeout?: number;
  /** Send data after connect */
  sendData?: string;
  /** Expected response */
  expectResponse?: string;
}

/**
 * Process check specific config
 */
export interface ProcessCheckConfig extends HealthCheckConfig {
  /** Process ID */
  pid?: number;
  /** Process name */
  processName?: string;
  /** Max CPU usage % */
  maxCpuUsage?: number;
  /** Max memory usage MB */
  maxMemoryUsage?: number;
}

/**
 * Disk check specific config
 */
export interface DiskCheckConfig extends HealthCheckConfig {
  /** Disk path */
  path: string;
  /** Min available space MB */
  minAvailableSpace?: number;
  /** Max usage % */
  maxUsagePercent?: number;
}

/**
 * Memory check specific config
 */
export interface MemoryCheckConfig extends HealthCheckConfig {
  /** Min available memory MB */
  minAvailableMemory?: number;
  /** Max swap usage % */
  maxSwapUsage?: number;
}

/**
 * CPU check specific config
 */
export interface CpuCheckConfig extends HealthCheckConfig {
  /** Max load average (1 min) */
  maxLoadAverage1?: number;
  /** Max load average (5 min) */
  maxLoadAverage5?: number;
  /** Max CPU usage % */
  maxCpuUsage?: number;
}

/**
 * Custom script check config
 */
export interface CustomScriptCheckConfig extends HealthCheckConfig {
  /** Script path */
  scriptPath: string;
  /** Script arguments */
  args?: string[];
  /** Working directory */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Expected exit code */
  expectedExitCode?: number;
  /** Parse output as metric */
  parseMetric?: boolean;
}

/**
 * Monitoring state
 */
export interface MonitoringState {
  /** Is monitoring active */
  isMonitoring: boolean;
  /** Check interval */
  interval: number;
  /** Worker IDs being monitored */
  workers: string[];
  /** Start time */
  startTime?: Date;
  /** Total checks performed */
  totalChecks: number;
  /** Total failures */
  totalFailures: number;
}
