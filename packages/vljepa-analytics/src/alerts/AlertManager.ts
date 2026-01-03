/**
 * AlertManager - Manages alerts based on metrics and thresholds
 */

import { EventEmitter } from "eventemitter3";
import type {
  Alert,
  AlertConfig,
  AlertRule,
  NotificationChannel,
  AlertType,
  AlertSeverity,
} from "../types.js";

export class AlertManager extends EventEmitter {
  private config: AlertConfig;
  private alerts: Map<string, Alert> = new Map();
  private alertHistory: Map<string, Alert[]> = new Map();
  private metricValues: Map<string, number> = new Map();
  private lastAlertTime: Map<string, number> = new Map();

  constructor(config: AlertConfig) {
    super();
    this.config = config;

    // Initialize alert history
    for (const rule of config.rules) {
      this.alertHistory.set(rule.id, []);
    }
  }

  /**
   * Update metric value and check for alerts
   */
  updateMetric(metricName: string, value: number): void {
    this.metricValues.set(metricName, value);

    // Check all rules for this metric
    const applicableRules = this.config.rules.filter(
      rule => rule.metric === metricName && rule.enabled
    );

    for (const rule of applicableRules) {
      this.checkRule(rule, value);
    }
  }

  /**
   * Check if a rule should trigger an alert
   */
  private checkRule(rule: AlertRule, value: number): void {
    const shouldAlert = this.evaluateCondition(rule, value);

    if (shouldAlert) {
      // Check cooldown
      const lastAlert = this.lastAlertTime.get(rule.id) || 0;
      const cooldownElapsed = Date.now() - lastAlert >= rule.cooldown;

      if (cooldownElapsed) {
        this.createAlert(rule, value);
        this.lastAlertTime.set(rule.id, Date.now());
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(rule: AlertRule, value: number): boolean {
    const threshold = rule.threshold;

    switch (rule.condition) {
      case "gt":
        return value > (threshold as number);
      case "lt":
        return value < (threshold as number);
      case "eq":
        return value === (threshold as number);
      case "gte":
        return value >= (threshold as number);
      case "lte":
        return value <= (threshold as number);
      case "outside":
        return (
          value < (threshold as [number, number])[0] ||
          value > (threshold as [number, number])[1]
        );
      case "inside":
        return (
          value >= (threshold as [number, number])[0] &&
          value <= (threshold as [number, number])[1]
        );
      default:
        return false;
    }
  }

  /**
   * Create an alert
   */
  private createAlert(rule: AlertRule, value: number): void {
    const alert: Alert = {
      id: this.generateId(),
      type: rule.type,
      severity: rule.severity,
      status: "open",
      title: `${rule.name}: Alert triggered`,
      message: `Metric ${rule.metric} is ${value}, which is ${rule.condition} threshold ${rule.threshold}`,
      metric: rule.metric,
      value,
      threshold: rule.threshold as number,
      timestamp: Date.now(),
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
      },
    };

    this.alerts.set(alert.id, alert);
    this.alertHistory.get(rule.id)!.push(alert);

    this.emit("alert", alert);

    // Send notifications
    this.sendNotifications(alert, rule.notificationChannels);
  }

  /**
   * Send notifications for an alert
   */
  private sendNotifications(alert: Alert, channelIds: string[]): void {
    for (const channelId of channelIds) {
      const channel = this.config.notifications.find(n => n.id === channelId);
      if (channel && channel.enabled) {
        this.sendNotification(alert, channel);
      }
    }
  }

  /**
   * Send notification to a specific channel
   */
  private sendNotification(alert: Alert, channel: NotificationChannel): void {
    this.emit("notification", { alert, channel });

    // In a real implementation, this would send to the actual notification service
    console.log(
      `Sending ${alert.severity} alert to ${channel.name} (${channel.type})`
    );
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status === "open") {
      alert.status = "acknowledged";
      alert.acknowledgedAt = Date.now();
      alert.acknowledgedBy = acknowledgedBy;

      this.emit("alertAcknowledged", alert);
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolvedBy: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status !== "resolved") {
      alert.status = "resolved";
      alert.resolvedAt = Date.now();
      alert.resolvedBy = resolvedBy;

      this.emit("alertResolved", alert);
    }
  }

  /**
   * Dismiss an alert
   */
  dismissAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status !== "dismissed") {
      alert.status = "dismissed";

      this.emit("alertDismissed", alert);
    }
  }

  /**
   * Get all alerts
   */
  getAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get open alerts
   */
  getOpenAlerts(): Alert[] {
    return this.getAlerts().filter(a => a.status === "open");
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.getAlerts().filter(
      a => a.severity === severity && a.status !== "resolved"
    );
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: AlertType): Alert[] {
    return this.getAlerts().filter(
      a => a.type === type && a.status !== "resolved"
    );
  }

  /**
   * Get alert history for a rule
   */
  getAlertHistory(ruleId: string, limit: number = 100): Alert[] {
    const history = this.alertHistory.get(ruleId) || [];
    return history.slice(-limit);
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    total: number;
    open: number;
    acknowledged: number;
    resolved: number;
    dismissed: number;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
  } {
    const alerts = this.getAlerts();

    const bySeverity: Record<AlertSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const byType: Record<AlertType, number> = {
      threshold: 0,
      anomaly: 0,
      trend: 0,
      system: 0,
    };

    for (const alert of alerts) {
      bySeverity[alert.severity]++;
      byType[alert.type]++;
    }

    return {
      total: alerts.length,
      open: alerts.filter(a => a.status === "open").length,
      acknowledged: alerts.filter(a => a.status === "acknowledged").length,
      resolved: alerts.filter(a => a.status === "resolved").length,
      dismissed: alerts.filter(a => a.status === "dismissed").length,
      bySeverity,
      byType,
    };
  }

  /**
   * Add a rule
   */
  addRule(rule: AlertRule): void {
    this.config.rules.push(rule);
    this.alertHistory.set(rule.id, []);
  }

  /**
   * Update a rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const index = this.config.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.config.rules[index] = { ...this.config.rules[index], ...updates };
    }
  }

  /**
   * Delete a rule
   */
  deleteRule(ruleId: string): void {
    this.config.rules = this.config.rules.filter(r => r.id !== ruleId);
    this.alertHistory.delete(ruleId);
  }

  /**
   * Enable/disable a rule
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.config.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * Add notification channel
   */
  addNotificationChannel(channel: NotificationChannel): void {
    this.config.notifications.push(channel);
  }

  /**
   * Delete notification channel
   */
  deleteNotificationChannel(channelId: string): void {
    this.config.notifications = this.config.notifications.filter(
      n => n.id !== channelId
    );
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts.clear();
  }

  /**
   * Clear old alerts (older than specified days)
   */
  clearOldAlerts(daysOld: number = 30): void {
    const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    for (const [id, alert] of this.alerts) {
      if (alert.timestamp < cutoff && alert.status === "resolved") {
        this.alerts.delete(id);
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
