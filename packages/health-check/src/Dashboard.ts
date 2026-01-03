/**
 * Dashboard
 *
 * Real-time health monitoring dashboard with visualization data.
 */

import type {
  DashboardData,
  SystemHealth,
  WorkerHealth,
  AlertMessage,
  TrendData,
  CircuitBreakerState,
} from "./types.js";
import { HealthAggregator } from "./HealthAggregator.js";

/**
 * Dashboard class
 */
export class Dashboard {
  private systemHealth: SystemHealth | null;
  private recentAlerts: AlertMessage[];
  private trends: Map<string, TrendData>;
  private circuitBreakers: Map<string, CircuitBreakerState>;
  private aggregator: HealthAggregator;
  private lastUpdated: Date;
  private alertLimit: number;
  private trendHistory: Map<string, number[]>;

  constructor(alertLimit: number = 50) {
    this.systemHealth = null;
    this.recentAlerts = [];
    this.trends = new Map();
    this.circuitBreakers = new Map();
    this.aggregator = new HealthAggregator();
    this.lastUpdated = new Date();
    this.alertLimit = alertLimit;
    this.trendHistory = new Map();
  }

  /**
   * Update system health
   */
  updateSystemHealth(health: SystemHealth): void {
    this.systemHealth = health;

    // Update trends for each worker
    for (const [workerId, worker] of health.workers) {
      this.updateWorkerTrends(workerId, worker);
    }

    this.lastUpdated = new Date();
  }

  /**
   * Add alert to recent alerts
   */
  addAlert(alert: AlertMessage): void {
    this.recentAlerts.push(alert);

    // Keep only recent alerts
    if (this.recentAlerts.length > this.alertLimit) {
      this.recentAlerts.shift();
    }

    this.lastUpdated = new Date();
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreaker(name: string, state: CircuitBreakerState): void {
    this.circuitBreakers.set(name, state);
    this.lastUpdated = new Date();
  }

  /**
   * Update all circuit breaker states
   */
  updateCircuitBreakers(states: Map<string, CircuitBreakerState>): void {
    this.circuitBreakers = new Map(states);
    this.lastUpdated = new Date();
  }

  /**
   * Update worker trends
   */
  private updateWorkerTrends(workerId: string, worker: WorkerHealth): void {
    // Aggregate worker metrics
    const aggregation = this.aggregator.aggregate(worker.metrics);

    // Track score for trend analysis
    if (!this.trendHistory.has(workerId)) {
      this.trendHistory.set(workerId, []);
    }

    const history = this.trendHistory.get(workerId)!;
    history.push(aggregation.score);

    // Keep last 20 data points
    if (history.length > 20) {
      history.shift();
    }

    // Calculate trend
    if (history.length >= 2) {
      const current = history[history.length - 1];
      const previous = history[0];
      const changePercent =
        previous !== 0 ? ((current - previous) / previous) * 100 : 0;

      let trend: "up" | "down" | "stable";
      if (Math.abs(changePercent) < 5) {
        trend = "stable";
      } else {
        trend = changePercent > 0 ? "up" : "down";
      }

      this.trends.set(workerId, {
        metric: "health-score",
        current,
        previous,
        changePercent,
        trend,
        period: history.length,
      });
    }
  }

  /**
   * Get dashboard data
   */
  getData(): DashboardData {
    if (!this.systemHealth) {
      throw new Error("System health not set");
    }

    return {
      systemHealth: this.systemHealth,
      recentAlerts: [...this.recentAlerts],
      trends: Array.from(this.trends.values()),
      circuitBreakers: new Map(this.circuitBreakers),
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Get summary data
   */
  getSummary(): {
    totalWorkers: number;
    healthyWorkers: number;
    degradedWorkers: number;
    unhealthyWorkers: number;
    healthPercentage: number;
    recentAlerts: number;
    openCircuitBreakers: number;
    lastUpdated: Date;
  } {
    if (!this.systemHealth) {
      return {
        totalWorkers: 0,
        healthyWorkers: 0,
        degradedWorkers: 0,
        unhealthyWorkers: 0,
        healthPercentage: 0,
        recentAlerts: this.recentAlerts.length,
        openCircuitBreakers: this.countOpenCircuitBreakers(),
        lastUpdated: this.lastUpdated,
      };
    }

    return {
      totalWorkers: this.systemHealth.totalWorkers,
      healthyWorkers: this.systemHealth.healthy,
      degradedWorkers: this.systemHealth.degraded,
      unhealthyWorkers: this.systemHealth.unhealthy,
      healthPercentage: this.systemHealth.healthPercentage,
      recentAlerts: this.recentAlerts.length,
      openCircuitBreakers: this.countOpenCircuitBreakers(),
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Get worker list with status
   */
  getWorkerList(): Array<{
    workerId: string;
    status: string;
    healthScore: number;
    uptime: number;
    lastCheck: Date;
  }> {
    if (!this.systemHealth) {
      return [];
    }

    const workers: Array<{
      workerId: string;
      status: string;
      healthScore: number;
      uptime: number;
      lastCheck: Date;
    }> = [];

    for (const [workerId, worker] of this.systemHealth.workers) {
      const aggregation = this.aggregator.aggregate(worker.metrics);

      workers.push({
        workerId,
        status: worker.status,
        healthScore: aggregation.score,
        uptime: worker.uptime,
        lastCheck: worker.lastCheck,
      });
    }

    // Sort by health score
    workers.sort((a, b) => b.healthScore - a.healthScore);

    return workers;
  }

  /**
   * Get metrics for a worker
   */
  getWorkerMetrics(workerId: string): {
    worker: WorkerHealth | undefined;
    trend: TrendData | undefined;
    metrics: Array<{
      name: string;
      value: number;
      unit: string;
      status: string;
      timestamp: Date;
    }>;
  } {
    if (!this.systemHealth) {
      return {
        worker: undefined,
        trend: undefined,
        metrics: [],
      };
    }

    const worker = this.systemHealth.workers.get(workerId);
    const trend = this.trends.get(workerId);

    const metrics =
      worker?.metrics.map(m => ({
        name: m.name,
        value: m.value,
        unit: m.unit,
        status: m.status,
        timestamp: m.timestamp,
      })) || [];

    return {
      worker,
      trend,
      metrics,
    };
  }

  /**
   * Get top issues
   */
  getTopIssues(limit: number = 5): Array<{
    workerId: string;
    issue: string;
    severity: string;
    count: number;
  }> {
    const issues: Map<
      string,
      { workerId: string; issue: string; severity: string; count: number }
    > = new Map();

    // Collect issues from unhealthy workers
    if (this.systemHealth) {
      for (const [workerId, worker] of this.systemHealth.workers) {
        if (worker.status === "unhealthy" || worker.status === "degraded") {
          for (const metric of worker.metrics) {
            if (metric.status === "unhealthy" || metric.status === "degraded") {
              const key = `${workerId}-${metric.name}`;
              const existing = issues.get(key);

              if (existing) {
                existing.count++;
              } else {
                issues.set(key, {
                  workerId,
                  issue: `${metric.name}: ${metric.value}${metric.unit}`,
                  severity: metric.status,
                  count: 1,
                });
              }
            }
          }
        }
      }
    }

    // Sort by severity and count
    const sorted = Array.from(issues.values()).sort((a, b) => {
      const severityOrder = { unhealthy: 0, degraded: 1 };
      const aSeverity =
        severityOrder[a.severity as keyof typeof severityOrder] ?? 2;
      const bSeverity =
        severityOrder[b.severity as keyof typeof severityOrder] ?? 2;

      if (aSeverity !== bSeverity) {
        return aSeverity - bSeverity;
      }

      return b.count - a.count;
    });

    return sorted.slice(0, limit);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit?: number): AlertMessage[] {
    if (limit) {
      return this.recentAlerts.slice(-limit);
    }
    return [...this.recentAlerts];
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(
    severity: "info" | "warning" | "critical"
  ): AlertMessage[] {
    return this.recentAlerts.filter(a => a.severity === severity);
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get open circuit breakers
   */
  getOpenCircuitBreakers(): Array<{
    name: string;
    state: CircuitBreakerState;
  }> {
    const open: Array<{ name: string; state: CircuitBreakerState }> = [];

    for (const [name, state] of this.circuitBreakers) {
      if (state.state === "open") {
        open.push({ name, state });
      }
    }

    return open;
  }

  /**
   * Count open circuit breakers
   */
  private countOpenCircuitBreakers(): number {
    let count = 0;
    for (const state of this.circuitBreakers.values()) {
      if (state.state === "open") {
        count++;
      }
    }
    return count;
  }

  /**
   * Get time series data for a metric
   */
  getTimeSeries(
    workerId: string,
    metricName: string
  ): Array<{
    timestamp: Date;
    value: number;
  }> {
    const history = this.trendHistory.get(workerId);
    if (!history) {
      return [];
    }

    return history.map((value, index) => ({
      timestamp: new Date(Date.now() - (history.length - index) * 60000),
      value,
    }));
  }

  /**
   * Get health distribution
   */
  getHealthDistribution(): {
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  } {
    if (!this.systemHealth) {
      return {
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        unknown: 0,
      };
    }

    return {
      healthy: this.systemHealth.healthy,
      degraded: this.systemHealth.degraded,
      unhealthy: this.systemHealth.unhealthy,
      unknown: this.systemHealth.unknown,
    };
  }

  /**
   * Get last update time
   */
  getLastUpdated(): Date {
    return this.lastUpdated;
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.recentAlerts = [];
    this.lastUpdated = new Date();
  }

  /**
   * Reset dashboard
   */
  reset(): void {
    this.systemHealth = null;
    this.recentAlerts = [];
    this.trends.clear();
    this.circuitBreakers.clear();
    this.trendHistory.clear();
    this.lastUpdated = new Date();
  }

  /**
   * Export dashboard data as JSON
   */
  exportJson(): string {
    return JSON.stringify(
      this.getData(),
      (key, value) => {
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        return value;
      },
      2
    );
  }

  /**
   * Check if data is stale
   */
  isDataStale(maxAgeMs: number = 60000): boolean {
    const age = Date.now() - this.lastUpdated.getTime();
    return age > maxAgeMs;
  }
}
