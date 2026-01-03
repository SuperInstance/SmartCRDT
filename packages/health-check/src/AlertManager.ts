/**
 * Alert Manager
 *
 * Manages health check alerts with deduplication and rate limiting.
 */

import type {
  AlertConfig,
  AlertMessage,
  AlertChannel,
  HealthStatus,
  WorkerHealth,
} from "./types.js";

/**
 * Alert Manager class
 */
export class AlertManager {
  private config: AlertConfig;
  private alertHistory: AlertMessage[];
  private lastAlertTimes: Map<string, number>;
  private lastStatuses: Map<string, HealthStatus>;
  private alertCounts: Map<string, number>;

  constructor(config: Partial<AlertConfig> = {}) {
    this.config = {
      enabled: true,
      alertOnDegraded: true,
      alertOnUnhealthy: true,
      alertOnStatusChange: true,
      minAlertInterval: 60000, // 1 minute
      channels: [],
    };
    this.config = { ...this.config, ...config };

    this.alertHistory = [];
    this.lastAlertTimes = new Map();
    this.lastStatuses = new Map();
    this.alertCounts = new Map();
  }

  /**
   * Evaluate worker health and send alerts if needed
   */
  async evaluateWorker(worker: WorkerHealth): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const lastStatus = this.lastStatuses.get(worker.workerId);
    const status = worker.status;

    // Check for status change
    if (lastStatus !== status) {
      if (this.config.alertOnStatusChange) {
        await this.sendAlert({
          id: this.generateAlertId(),
          workerId: worker.workerId,
          previousStatus: lastStatus || "unknown",
          currentStatus: status,
          severity: this.getSeverity(status),
          message: this.getStatusChangeMessage(
            worker.workerId,
            lastStatus || "unknown",
            status
          ),
          timestamp: new Date(),
          metrics: worker.metrics,
        });
      }

      this.lastStatuses.set(worker.workerId, status);
    }

    // Check for degraded status
    if (status === "degraded" && this.config.alertOnDegraded) {
      if (this.shouldSendAlert(worker.workerId, "degraded")) {
        await this.sendAlert({
          id: this.generateAlertId(),
          workerId: worker.workerId,
          previousStatus: lastStatus || "unknown",
          currentStatus: status,
          severity: "warning",
          message: this.getDegradedMessage(worker.workerId, worker.metrics),
          timestamp: new Date(),
          metrics: worker.metrics,
        });
      }
    }

    // Check for unhealthy status
    if (status === "unhealthy" && this.config.alertOnUnhealthy) {
      if (this.shouldSendAlert(worker.workerId, "unhealthy")) {
        await this.sendAlert({
          id: this.generateAlertId(),
          workerId: worker.workerId,
          previousStatus: lastStatus || "unknown",
          currentStatus: status,
          severity: "critical",
          message: this.getUnhealthyMessage(
            worker.workerId,
            worker.error,
            worker.metrics
          ),
          timestamp: new Date(),
          metrics: worker.metrics,
        });
      }
    }
  }

  /**
   * Send alert to all enabled channels
   */
  private async sendAlert(alert: AlertMessage): Promise<void> {
    const now = Date.now();
    const key = `${alert.workerId}-${alert.currentStatus}`;

    // Check rate limiting
    const lastAlertTime = this.lastAlertTimes.get(key) || 0;
    if (now - lastAlertTime < this.config.minAlertInterval) {
      return; // Skip due to rate limiting
    }

    // Deduplicate - check if same alert was sent recently
    const isDuplicate = this.alertHistory.some(h => {
      return (
        h.workerId === alert.workerId &&
        h.currentStatus === alert.currentStatus &&
        now - h.timestamp.getTime() < this.config.minAlertInterval
      );
    });

    if (isDuplicate) {
      return;
    }

    // Send to all enabled channels
    for (const channel of this.config.channels) {
      if (channel.enabled) {
        await this.sendToChannel(alert, channel);
      }
    }

    // Update tracking
    this.lastAlertTimes.set(key, now);
    this.alertHistory.push(alert);

    // Update alert count
    const count = (this.alertCounts.get(alert.workerId) || 0) + 1;
    this.alertCounts.set(alert.workerId, count);

    // Keep history manageable
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }
  }

  /**
   * Send alert to specific channel
   */
  private async sendToChannel(
    alert: AlertMessage,
    channel: AlertChannel
  ): Promise<void> {
    try {
      switch (channel.type) {
        case "console":
          this.sendToConsole(alert, channel.config);
          break;

        case "log":
          this.sendToLog(alert, channel.config);
          break;

        case "webhook":
          await this.sendToWebhook(alert, channel.config);
          break;

        case "email":
          // Email sending would be implemented with an email service
          console.log("[EMAIL] Would send email:", alert.message);
          break;

        case "callback":
          await this.sendToCallback(alert, channel.config);
          break;

        default:
          console.warn(`Unknown alert channel type: ${channel.type}`);
      }
    } catch (error) {
      console.error(`Error sending alert to ${channel.type}:`, error);
    }
  }

  /**
   * Send alert to console
   */
  private sendToConsole(
    alert: AlertMessage,
    config: Record<string, unknown>
  ): void {
    const colors = {
      info: "\x1b[36m", // cyan
      warning: "\x1b[33m", // yellow
      critical: "\x1b[31m", // red
    };
    const reset = "\x1b[0m";

    const color = colors[alert.severity] || reset;
    console.log(
      `${color}[${alert.severity.toUpperCase()}]${reset} ${alert.message}`
    );
    console.log(`  Worker: ${alert.workerId}`);
    console.log(`  Status: ${alert.previousStatus} -> ${alert.currentStatus}`);
    console.log(`  Time: ${alert.timestamp.toISOString()}`);
  }

  /**
   * Send alert to log
   */
  private sendToLog(
    alert: AlertMessage,
    config: Record<string, unknown>
  ): void {
    const logEntry = {
      timestamp: alert.timestamp,
      severity: alert.severity,
      workerId: alert.workerId,
      message: alert.message,
      statusChange: `${alert.previousStatus} -> ${alert.currentStatus}`,
    };
    console.log("[ALERT]", JSON.stringify(logEntry));
  }

  /**
   * Send alert to webhook
   */
  private async sendToWebhook(
    alert: AlertMessage,
    config: Record<string, unknown>
  ): Promise<void> {
    const url = config.url as string;
    if (!url) {
      console.warn("Webhook URL not configured");
      return;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alert),
      });

      if (!response.ok) {
        console.warn(`Webhook returned ${response.status}`);
      }
    } catch (error) {
      console.error("Webhook error:", error);
    }
  }

  /**
   * Send alert to callback function
   */
  private async sendToCallback(
    alert: AlertMessage,
    config: Record<string, unknown>
  ): Promise<void> {
    const callback = config.callback as (
      alert: AlertMessage
    ) => void | Promise<void>;
    if (typeof callback === "function") {
      await callback(alert);
    }
  }

  /**
   * Check if alert should be sent
   */
  private shouldSendAlert(workerId: string, status: string): boolean {
    const key = `${workerId}-${status}`;
    const now = Date.now();
    const lastAlertTime = this.lastAlertTimes.get(key) || 0;

    return now - lastAlertTime >= this.config.minAlertInterval;
  }

  /**
   * Get severity for status
   */
  private getSeverity(status: HealthStatus): "info" | "warning" | "critical" {
    switch (status) {
      case "healthy":
        return "info";
      case "degraded":
        return "warning";
      case "unhealthy":
        return "critical";
      case "unknown":
        return "info";
      default:
        return "info";
    }
  }

  /**
   * Generate status change message
   */
  private getStatusChangeMessage(
    workerId: string,
    previousStatus: HealthStatus,
    currentStatus: HealthStatus
  ): string {
    return `Worker ${workerId} status changed from ${previousStatus} to ${currentStatus}`;
  }

  /**
   * Generate degraded message
   */
  private getDegradedMessage(
    workerId: string,
    metrics: import("./types.js").HealthMetric[]
  ): string {
    const issues = metrics
      .filter(m => m.status === "degraded" || m.status === "unhealthy")
      .map(m => `${m.name}=${m.value}${m.unit}`)
      .join(", ");

    return `Worker ${workerId} is degraded${issues ? ": " + issues : ""}`;
  }

  /**
   * Generate unhealthy message
   */
  private getUnhealthyMessage(
    workerId: string,
    error?: string,
    metrics?: import("./types.js").HealthMetric[]
  ): string {
    if (error) {
      return `Worker ${workerId} is unhealthy: ${error}`;
    }

    const issues = metrics
      ?.filter(m => m.status === "unhealthy")
      .map(m => `${m.name}=${m.value}${m.unit}`)
      .join(", ");

    return `Worker ${workerId} is unhealthy${issues ? ": " + issues : ""}`;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get alert history
   */
  getHistory(limit?: number): AlertMessage[] {
    if (limit) {
      return this.alertHistory.slice(-limit);
    }
    return [...this.alertHistory];
  }

  /**
   * Get alert history for a specific worker
   */
  getWorkerHistory(workerId: string, limit?: number): AlertMessage[] {
    const workerAlerts = this.alertHistory.filter(a => a.workerId === workerId);
    if (limit) {
      return workerAlerts.slice(-limit);
    }
    return workerAlerts;
  }

  /**
   * Get alert count for a worker
   */
  getAlertCount(workerId: string): number {
    return this.alertCounts.get(workerId) || 0;
  }

  /**
   * Get all alert counts
   */
  getAllAlertCounts(): Map<string, number> {
    return new Map(this.alertCounts);
  }

  /**
   * Clear alert history
   */
  clearHistory(): void {
    this.alertHistory = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AlertConfig {
    return { ...this.config };
  }

  /**
   * Add alert channel
   */
  addChannel(channel: AlertChannel): void {
    this.config.channels.push(channel);
  }

  /**
   * Remove alert channel
   */
  removeChannel(channelType: string): boolean {
    const initialLength = this.config.channels.length;
    this.config.channels = this.config.channels.filter(
      c => c.type !== channelType
    );
    return this.config.channels.length < initialLength;
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.alertHistory = [];
    this.lastAlertTimes.clear();
    this.lastStatuses.clear();
    this.alertCounts.clear();
  }
}
