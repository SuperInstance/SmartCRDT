/**
 * @lsi/health-check
 *
 * Health Check System for fast worker availability checks with circuit breakers and alerting.
 */

// Types
export type {
  HealthStatus,
  HealthCheckConfig,
  HealthMetric,
  WorkerHealth,
  SystemHealth,
  HealthCheckFunction,
  CustomHealthCheck,
  HealthCheckResult,
  HealthHistoryEntry,
  AlertConfig,
  AlertChannel,
  AlertChannelType,
  AlertMessage,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
  AggregationStrategy,
  AggregationConfig,
  TrendData,
  DashboardData,
  HttpCheckConfig,
  TcpCheckConfig,
  ProcessCheckConfig,
  DiskCheckConfig,
  MemoryCheckConfig,
  CpuCheckConfig,
  CustomScriptCheckConfig,
  MonitoringState,
} from "./types.js";

// Core Health Checker
export { HealthChecker } from "./HealthChecker.js";

// Health Aggregator
export { HealthAggregator } from "./HealthAggregator.js";

// Alert Manager
export { AlertManager } from "./AlertManager.js";

// Circuit Breaker
export { CircuitBreaker, CircuitBreakerRegistry } from "./CircuitBreaker.js";

// Dashboard
export { Dashboard } from "./Dashboard.js";

// Built-in Health Checks
export { HttpCheck } from "./checks/HttpCheck.js";
export { TcpCheck } from "./checks/TcpCheck.js";
export { ProcessCheck } from "./checks/ProcessCheck.js";
export { DiskCheck } from "./checks/DiskCheck.js";
export { MemoryCheck } from "./checks/MemoryCheck.js";
export { CpuCheck } from "./checks/CpuCheck.js";
export { CustomScriptCheck } from "./checks/CustomScriptCheck.js";
