/**
 * @file analytics.ts - Error analytics and monitoring
 * @package @lsi/langgraph-errors
 */

import type {
  AgentError,
  ErrorStatistics,
  RecoveryResult,
  ErrorSeverity,
  ErrorCategory,
} from "./types.js";

/**
 * Error record for analytics
 */
interface ErrorRecord {
  error: AgentError;
  recovery: RecoveryResult | null;
  timestamp: number;
}

/**
 * Error pattern
 */
interface ErrorPattern {
  pattern: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  agents: string[];
  categories: ErrorCategory[];
}

/**
 * Error analytics manager
 */
export class ErrorAnalytics {
  private errors: ErrorRecord[];
  private errorPatterns: Map<string, ErrorPattern>;
  private alertThresholds: Map<ErrorSeverity, number>;
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 10000) {
    this.errors = [];
    this.errorPatterns = new Map();
    this.maxHistorySize = maxHistorySize;
    this.alertThresholds = new Map([
      ["fatal", 1],
      ["critical", 3],
      ["error", 10],
      ["warning", 50],
      ["info", 100],
    ]);
  }

  /**
   * Track an error
   */
  trackError(error: AgentError): void {
    this.errors.push({
      error,
      recovery: null,
      timestamp: Date.now(),
    });

    // Trim history if necessary
    if (this.errors.length > this.maxHistorySize) {
      this.errors.shift();
    }

    // Update patterns
    this.updatePatterns(error);
  }

  /**
   * Track recovery result
   */
  trackRecovery(error: AgentError, recovery: RecoveryResult): void {
    const record = this.errors.find(r => r.error.error_id === error.error_id);
    if (record) {
      record.recovery = recovery;
    }
  }

  /**
   * Update error patterns
   */
  private updatePatterns(error: AgentError): void {
    const patternKey = this.getPatternKey(error);
    const now = Date.now();

    let pattern = this.errorPatterns.get(patternKey);

    if (!pattern) {
      pattern = {
        pattern: patternKey,
        count: 0,
        firstSeen: now,
        lastSeen: now,
        agents: [],
        categories: [],
      };
      this.errorPatterns.set(patternKey, pattern);
    }

    pattern.count++;
    pattern.lastSeen = now;

    if (!pattern.agents.includes(error.agent_id)) {
      pattern.agents.push(error.agent_id);
    }

    if (!pattern.categories.includes(error.category)) {
      pattern.categories.push(error.category);
    }
  }

  /**
   * Get pattern key from error
   */
  private getPatternKey(error: AgentError): string {
    // Create pattern key from message (removing variable parts)
    return error.message
      .replace(/\d+/g, "N")
      .replace(/['"][^'"]*['"]/g, "X")
      .substring(0, 100);
  }

  /**
   * Get error statistics
   */
  getStatistics(): ErrorStatistics {
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
      fatal: 0,
    };

    const errorsByCategory: Record<ErrorCategory, number> = {
      validation: 0,
      execution: 0,
      timeout: 0,
      resource: 0,
      network: 0,
      authentication: 0,
      authorization: 0,
      rate_limit: 0,
      dependency: 0,
      unknown: 0,
    };

    const errorsByAgent: Record<string, number> = {};

    let totalRecoveryTime = 0;
    let successfulRecoveries = 0;

    for (const record of this.errors) {
      const error = record.error;

      errorsBySeverity[error.severity]++;
      errorsByCategory[error.category]++;

      errorsByAgent[error.agent_id] = (errorsByAgent[error.agent_id] || 0) + 1;

      if (record.recovery) {
        totalRecoveryTime += record.recovery.recovery_time;
        if (record.recovery.success) {
          successfulRecoveries++;
        }
      }
    }

    const commonErrors = this.getCommonErrors(10);
    const errorRate = this.calculateErrorRate();

    return {
      total_errors: this.errors.length,
      errors_by_severity: errorsBySeverity,
      errors_by_category: errorsByCategory,
      errors_by_agent: errorsByAgent,
      recovery_success_rate:
        this.errors.length > 0 ? successfulRecoveries / this.errors.length : 0,
      avg_recovery_time:
        this.errors.length > 0 ? totalRecoveryTime / this.errors.length : 0,
      common_errors: commonErrors,
      error_rate: errorRate,
    };
  }

  /**
   * Get common errors
   */
  getCommonErrors(
    limit: number = 10
  ): Array<{ message: string; count: number }> {
    const messageCounts: Map<string, number> = new Map();

    for (const record of this.errors) {
      const message = record.error.message;
      messageCounts.set(message, (messageCounts.get(message) || 0) + 1);
    }

    return Array.from(messageCounts.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Calculate error rate (errors per minute)
   */
  calculateErrorRate(windowMs: number = 60000): number {
    const now = Date.now();
    const recentErrors = this.errors.filter(r => now - r.timestamp <= windowMs);

    return (recentErrors.length / windowMs) * 60000;
  }

  /**
   * Get error patterns
   */
  getPatterns(): ErrorPattern[] {
    return Array.from(this.errorPatterns.values()).sort(
      (a, b) => b.count - a.count
    );
  }

  /**
   * Get patterns for a specific agent
   */
  getPatternsByAgent(agentId: string): ErrorPattern[] {
    return this.getPatterns().filter(p => p.agents.includes(agentId));
  }

  /**
   * Get errors in time range
   */
  getErrorsInTimeRange(startTime: number, endTime: number): ErrorRecord[] {
    return this.errors.filter(
      r => r.timestamp >= startTime && r.timestamp <= endTime
    );
  }

  /**
   * Get error trend
   */
  getErrorTrend(
    bucketSizeMs: number = 3600000,
    buckets: number = 24
  ): Array<{ time: number; count: number }> {
    const now = Date.now();
    const trend: Array<{ time: number; count: number }> = [];

    for (let i = buckets - 1; i >= 0; i--) {
      const bucketStart = now - (i + 1) * bucketSizeMs;
      const bucketEnd = now - i * bucketSizeMs;

      const count = this.errors.filter(
        r => r.timestamp >= bucketStart && r.timestamp < bucketEnd
      ).length;

      trend.push({
        time: bucketStart,
        count,
      });
    }

    return trend;
  }

  /**
   * Get agent performance
   */
  getAgentPerformance(agentId: string): {
    totalErrors: number;
    errorsBySeverity: Record<ErrorSeverity, number>;
    errorsByCategory: Record<ErrorCategory, number>;
    recoverySuccessRate: number;
    avgRecoveryTime: number;
  } {
    const agentErrors = this.errors.filter(r => r.error.agent_id === agentId);

    const errorsBySeverity: Record<ErrorSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
      fatal: 0,
    };

    const errorsByCategory: Record<ErrorCategory, number> = {
      validation: 0,
      execution: 0,
      timeout: 0,
      resource: 0,
      network: 0,
      authentication: 0,
      authorization: 0,
      rate_limit: 0,
      dependency: 0,
      unknown: 0,
    };

    let totalRecoveryTime = 0;
    let successfulRecoveries = 0;

    for (const record of agentErrors) {
      const error = record.error;
      errorsBySeverity[error.severity]++;
      errorsByCategory[error.category]++;

      if (record.recovery) {
        totalRecoveryTime += record.recovery.recovery_time;
        if (record.recovery.success) {
          successfulRecoveries++;
        }
      }
    }

    return {
      totalErrors: agentErrors.length,
      errorsBySeverity,
      errorsByCategory,
      recoverySuccessRate:
        agentErrors.length > 0 ? successfulRecoveries / agentErrors.length : 0,
      avgRecoveryTime:
        agentErrors.length > 0 ? totalRecoveryTime / agentErrors.length : 0,
    };
  }

  /**
   * Check for alerts
   */
  checkAlerts(): Array<{
    severity: ErrorSeverity;
    count: number;
    threshold: number;
    message: string;
  }> {
    const alerts: Array<{
      severity: ErrorSeverity;
      count: number;
      threshold: number;
      message: string;
    }> = [];

    const stats = this.getStatistics();

    for (const [severity, threshold] of this.alertThresholds) {
      const count = stats.errors_by_severity[severity];
      if (count >= threshold) {
        alerts.push({
          severity,
          count,
          threshold,
          message: `${severity.toUpperCase()} alert: ${count} errors (threshold: ${threshold})`,
        });
      }
    }

    return alerts;
  }

  /**
   * Set alert threshold
   */
  setAlertThreshold(severity: ErrorSeverity, threshold: number): void {
    this.alertThresholds.set(severity, threshold);
  }

  /**
   * Generate report
   */
  generateReport(): string {
    const stats = this.getStatistics();
    const patterns = this.getPatterns().slice(0, 5);
    const trend = this.getErrorTrend();
    const alerts = this.checkAlerts();

    let report = "=== Error Analytics Report ===\n\n";

    report += `Total Errors: ${stats.total_errors}\n`;
    report += `Error Rate: ${stats.error_rate.toFixed(2)}/min\n`;
    report += `Recovery Success Rate: ${(stats.recovery_success_rate * 100).toFixed(1)}%\n`;
    report += `Avg Recovery Time: ${stats.avg_recovery_time.toFixed(0)}ms\n\n`;

    report += "Errors by Severity:\n";
    for (const [severity, count] of Object.entries(stats.errors_by_severity)) {
      report += `  ${severity}: ${count}\n`;
    }

    report += "\nErrors by Category:\n";
    for (const [category, count] of Object.entries(stats.errors_by_category)) {
      report += `  ${category}: ${count}\n`;
    }

    report += "\nTop Agents by Errors:\n";
    const sortedAgents = Object.entries(stats.errors_by_agent)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    for (const [agentId, count] of sortedAgents) {
      report += `  ${agentId}: ${count}\n`;
    }

    report += "\nTop Error Patterns:\n";
    for (const pattern of patterns) {
      report += `  "${pattern.pattern}" (${pattern.count} occurrences)\n`;
    }

    if (alerts.length > 0) {
      report += "\nActive Alerts:\n";
      for (const alert of alerts) {
        report += `  ${alert.message}\n`;
      }
    }

    return report;
  }

  /**
   * Create dashboard data
   */
  createDashboardData(): {
    statistics: ErrorStatistics;
    patterns: ErrorPattern[];
    trend: Array<{ time: number; count: number }>;
    alerts: Array<{
      severity: ErrorSeverity;
      count: number;
      threshold: number;
      message: string;
    }>;
  } {
    return {
      statistics: this.getStatistics(),
      patterns: this.getPatterns(),
      trend: this.getErrorTrend(),
      alerts: this.checkAlerts(),
    };
  }

  /**
   * Reset analytics
   */
  reset(): void {
    this.errors = [];
    this.errorPatterns.clear();
  }

  /**
   * Export analytics data
   */
  export(): string {
    return JSON.stringify({
      errors: this.errors,
      patterns: Array.from(this.errorPatterns.values()),
      statistics: this.getStatistics(),
    });
  }

  /**
   * Import analytics data
   */
  import(json: string): void {
    try {
      const data = JSON.parse(json);
      if (data.errors) {
        this.errors = data.errors;
      }
      if (data.patterns) {
        for (const pattern of data.patterns) {
          this.errorPatterns.set(pattern.pattern, pattern);
        }
      }
    } catch (error) {
      console.error("Failed to import analytics data:", error);
    }
  }
}

/**
 * Singleton instance
 */
export const errorAnalytics = new ErrorAnalytics();
