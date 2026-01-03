/**
 * RealTimeMonitor - Real-time monitoring and alerting for privacy events
 *
 * Provides real-time monitoring of audit events with configurable thresholds,
 * aggregation windows, and multiple alert channels.
 *
 * @packageDocumentation
 */

import { EventEmitter } from "events";
import type {
  PrivacyAuditEvent,
  PIIType,
  PrivacyClassification,
} from "@lsi/protocol";
import type { AuditLogger } from "./AuditLogger.js";

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /** Alert thresholds */
  alertThresholds: AlertThresholds;
  /** Alert channels for notifications */
  alertChannels: AlertChannel[];
  /** Sampling rate (0-1, 1 = all events) */
  samplingRate: number;
  /** Aggregation window in milliseconds */
  aggregationWindow: number;
  /** Maximum events to keep in memory for monitoring */
  maxEvents?: number;
}

/**
 * Alert thresholds
 */
export interface AlertThresholds {
  /** Alert if PII exposure rate exceeds this (0-1) */
  piiExposureRate: number;
  /** Alert if block rate exceeds this (0-1) */
  blockRate: number;
  /** Alert if high-risk rate exceeds this (0-1) */
  highRiskRate: number;
  /** Alert if data leak exceeds this (bytes) */
  dataLeakThreshold: number;
  /** Alert if queries per minute exceeds this */
  queriesPerMinute: number;
  /** Alert if errors per minute exceeds this */
  errorsPerMinute: number;
}

/**
 * Alert channel configuration
 */
export interface AlertChannel {
  /** Channel type */
  type: "webhook" | "email" | "slack" | "pagerduty" | "log";
  /** Channel-specific configuration */
  config: Record<string, unknown>;
}

/**
 * Alert notification
 */
export interface Alert {
  /** Unique alert identifier */
  alertId: string;
  /** Alert timestamp */
  timestamp: number;
  /** Alert severity */
  severity: "info" | "warning" | "error" | "critical";
  /** Alert type */
  type: AlertType;
  /** Alert message */
  message: string;
  /** Current metrics that triggered the alert */
  metrics: AlertMetrics;
  /** Recommended actions */
  recommendations: string[];
}

/**
 * Alert types
 */
export type AlertType =
  | "pii_exposure_spike"
  | "block_rate_high"
  | "high_risk_spike"
  | "data_leak_detected"
  | "compliance_violation"
  | "unusual_pattern"
  | "system_error";

/**
 * Alert metrics
 */
export interface AlertMetrics {
  /** Current metric value */
  currentValue: number;
  /** Threshold value that was breached */
  threshold: number;
  /** Aggregation window (ms) */
  window: number;
  /** Number of queries affected */
  affectedQueries: number;
  /** Additional context */
  context?: Record<string, number>;
}

/**
 * Monitoring metrics snapshot
 */
export interface MonitoringMetrics {
  /** Queries per minute */
  queriesPerMinute: number;
  /** Blocks per minute */
  blocksPerMinute: number;
  /** PII exposure rate (0-1) */
  piiExposureRate: number;
  /** High-risk query rate (0-1) */
  highRiskRate: number;
  /** Average classification confidence */
  avgConfidence: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Top PII types with counts */
  topPIITypes: { type: PIIType; count: number }[];
  /** Top classifications with counts */
  topClassifications: { type: string; count: number }[];
}

/**
 * Aggregated event data
 */
interface AggregatedEvents {
  events: PrivacyAuditEvent[];
  windowStart: number;
  windowEnd: number;
}

/**
 * Alert subscription (for unsubscribe)
 */
export interface AlertSubscription {
  unsubscribe: () => void;
}

/**
 * Default thresholds
 */
const DEFAULT_THRESHOLDS: AlertThresholds = {
  piiExposureRate: 0.3, // Alert if >30% queries have PII
  blockRate: 0.2, // Alert if >20% queries blocked
  highRiskRate: 0.15, // Alert if >15% high-risk queries
  dataLeakThreshold: 10000, // Alert if >10KB leaked
  queriesPerMinute: 1000, // Alert if >1000 QPM
  errorsPerMinute: 10, // Alert if >10 errors/min
};

/**
 * RealTimeMonitor - Real-time privacy event monitoring
 *
 * Monitors audit events in real-time and generates alerts when thresholds
 * are breached. Supports multiple alert channels and configurable aggregation.
 */
export class RealTimeMonitor extends EventEmitter {
  private config: Required<MonitoringConfig>;
  private eventBuffer: PrivacyAuditEvent[] = [];
  private currentWindow: AggregatedEvents | null = null;
  private monitoringActive = false;
  private alertHistory: Alert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(
    private logger: AuditLogger,
    config: Partial<MonitoringConfig> = {}
  ) {
    super();

    this.config = {
      alertThresholds: config.alertThresholds || DEFAULT_THRESHOLDS,
      alertChannels: config.alertChannels || [{ type: "log", config: {} }],
      samplingRate: config.samplingRate ?? 1.0,
      aggregationWindow: config.aggregationWindow || 60000, // 1 minute default
      maxEvents: config.maxEvents || 10000,
    };
  }

  /**
   * Start monitoring
   *
   * Begins processing events and checking thresholds
   */
  start(): void {
    if (this.monitoringActive) {
      return;
    }

    this.monitoringActive = true;
    this.startAggregationWindow();

    // Process events from the logger periodically
    this.monitoringInterval = setInterval(() => {
      this.processNewEvents();
    }, 1000); // Check every second

    this.emit("started");
  }

  /**
   * Stop monitoring
   *
   * Stops processing events and checking thresholds
   */
  stop(): void {
    if (!this.monitoringActive) {
      return;
    }

    this.monitoringActive = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.emit("stopped");
  }

  /**
   * Process a single event immediately
   *
   * @param event - Event to process
   */
  processEvent(event: PrivacyAuditEvent): void {
    if (!this.monitoringActive) {
      return;
    }

    // Apply sampling
    if (Math.random() > this.config.samplingRate) {
      return;
    }

    // Add to current window
    if (this.currentWindow) {
      this.currentWindow.events.push(event);

      // Check buffer size
      if (this.eventBuffer.length > this.config.maxEvents) {
        this.eventBuffer.shift();
      }
      this.eventBuffer.push(event);
    }
  }

  /**
   * Subscribe to alerts
   *
   * @param callback - Callback function for alerts
   * @returns Subscription object with unsubscribe method
   */
  onAlert(callback: (alert: Alert) => void): AlertSubscription {
    this.on("alert", callback);

    return {
      unsubscribe: () => {
        this.off("alert", callback);
      },
    };
  }

  /**
   * Get current metrics
   *
   * @returns Current monitoring metrics
   */
  getCurrentMetrics(): MonitoringMetrics {
    const events = this.currentWindow?.events || [];

    if (events.length === 0) {
      return {
        queriesPerMinute: 0,
        blocksPerMinute: 0,
        piiExposureRate: 0,
        highRiskRate: 0,
        avgConfidence: 0,
        errorRate: 0,
        topPIITypes: [],
        topClassifications: [],
      };
    }

    // Calculate metrics
    const blockedQueries = events.filter(
      e => e.decision.action === "deny"
    ).length;
    const piiQueries = events.filter(
      e => e.piiDetected && e.piiDetected.length > 0
    ).length;
    const highRiskQueries = events.filter(e => {
      const lowConfidence =
        e.classification && e.classification.confidence < 0.6;
      const highPII = e.piiDetected && e.piiDetected.length >= 3;
      return lowConfidence || highPII;
    }).length;

    // Average confidence
    const confidenceValues = events
      .filter(e => e.classification?.confidence !== undefined)
      .map(e => e.classification!.confidence);
    const avgConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((sum, c) => sum + c, 0) /
          confidenceValues.length
        : 0;

    // Count PII types
    const piiTypeCounts = new Map<PIIType, number>();
    for (const event of events) {
      if (event.piiDetected) {
        for (const piiType of event.piiDetected) {
          piiTypeCounts.set(piiType, (piiTypeCounts.get(piiType) || 0) + 1);
        }
      }
    }

    const topPIITypes = Array.from(piiTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count classifications
    const classificationCounts = new Map<string, number>();
    for (const event of events) {
      if (event.classification) {
        const level = event.classification.level;
        classificationCounts.set(
          level,
          (classificationCounts.get(level) || 0) + 1
        );
      }
    }

    const topClassifications = Array.from(classificationCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate rates
    const windowMs = this.config.aggregationWindow;
    const queriesPerMinute = (events.length / windowMs) * 60000;
    const blocksPerMinute = (blockedQueries / windowMs) * 60000;

    return {
      queriesPerMinute,
      blocksPerMinute,
      piiExposureRate: piiQueries / events.length,
      highRiskRate: highRiskQueries / events.length,
      avgConfidence,
      errorRate: 0, // No error tracking in current implementation
      topPIITypes,
      topClassifications,
    };
  }

  /**
   * Get recent alerts
   *
   * @param limit - Maximum number of alerts to return
   * @returns Recent alerts
   */
  getRecentAlerts(limit: number = 50): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Update alert thresholds
   *
   * @param thresholds - New threshold values
   */
  updateThresholds(thresholds: Partial<AlertThresholds>): void {
    this.config.alertThresholds = {
      ...this.config.alertThresholds,
      ...thresholds,
    };
  }

  /**
   * Add alert channel
   *
   * @param channel - Channel to add
   */
  addAlertChannel(channel: AlertChannel): void {
    this.config.alertChannels.push(channel);
  }

  /**
   * Remove alert channel
   *
   * @param type - Channel type to remove
   */
  removeAlertChannel(type: AlertChannel["type"]): void {
    this.config.alertChannels = this.config.alertChannels.filter(
      ch => ch.type !== type
    );
  }

  /**
   * Get alert history statistics
   *
   * @returns Alert statistics
   */
  getAlertStatistics(): {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    last24h: number;
  } {
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const recentAlerts = this.alertHistory.filter(a => a.timestamp >= last24h);

    const bySeverity: Record<string, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const byType: Record<string, number> = {};

    for (const alert of this.alertHistory) {
      bySeverity[alert.severity]++;
      byType[alert.type] = (byType[alert.type] || 0) + 1;
    }

    return {
      total: this.alertHistory.length,
      bySeverity,
      byType,
      last24h: recentAlerts.length,
    };
  }

  /**
   * Start a new aggregation window
   */
  private startAggregationWindow(): void {
    const now = Date.now();

    this.currentWindow = {
      events: [],
      windowStart: now,
      windowEnd: now + this.config.aggregationWindow,
    };

    // Schedule window completion
    setTimeout(() => {
      this.completeAggregationWindow();
    }, this.config.aggregationWindow);
  }

  /**
   * Complete current aggregation window and check thresholds
   */
  private completeAggregationWindow(): void {
    if (!this.currentWindow || !this.monitoringActive) {
      return;
    }

    // Check all thresholds
    this.checkThresholds(this.currentWindow.events);

    // Start new window
    this.startAggregationWindow();
  }

  /**
   * Check thresholds against aggregated events
   *
   * @param events - Events to check
   */
  private checkThresholds(events: PrivacyAuditEvent[]): void {
    const metrics = this.getCurrentMetrics();
    const thresholds = this.config.alertThresholds;

    // Check PII exposure rate
    if (metrics.piiExposureRate > thresholds.piiExposureRate) {
      this.generateAlert({
        alertId: this.generateAlertId(),
        timestamp: Date.now(),
        severity: "warning",
        type: "pii_exposure_spike",
        message: `PII exposure rate (${(metrics.piiExposureRate * 100).toFixed(1)}%) exceeds threshold (${(thresholds.piiExposureRate * 100).toFixed(1)}%)`,
        metrics: {
          currentValue: metrics.piiExposureRate,
          threshold: thresholds.piiExposureRate,
          window: this.config.aggregationWindow,
          affectedQueries: events.length,
          context: {
            piiQueries: Math.round(metrics.piiExposureRate * events.length),
          },
        },
        recommendations: [
          "Review redaction rules for PII-heavy queries",
          "Consider implementing intent encoding for high-PII queries",
          "Analyze top PII types for patterns",
        ],
      });
    }

    // Check block rate
    const blockRate =
      metrics.blocksPerMinute / Math.max(1, metrics.queriesPerMinute);
    if (blockRate > thresholds.blockRate) {
      this.generateAlert({
        alertId: this.generateAlertId(),
        timestamp: Date.now(),
        severity: "warning",
        type: "block_rate_high",
        message: `Block rate (${(blockRate * 100).toFixed(1)}%) exceeds threshold (${(thresholds.blockRate * 100).toFixed(1)}%)`,
        metrics: {
          currentValue: blockRate,
          threshold: thresholds.blockRate,
          window: this.config.aggregationWindow,
          affectedQueries: Math.round(blockRate * events.length),
          context: { blockedQueries: metrics.blocksPerMinute },
        },
        recommendations: [
          "Review privacy rules for false positives",
          "Check if user intent is being misunderstood",
          "Consider adjusting rule sensitivity",
        ],
      });
    }

    // Check high-risk rate
    if (metrics.highRiskRate > thresholds.highRiskRate) {
      this.generateAlert({
        alertId: this.generateAlertId(),
        timestamp: Date.now(),
        severity: "error",
        type: "high_risk_spike",
        message: `High-risk query rate (${(metrics.highRiskRate * 100).toFixed(1)}%) exceeds threshold (${(thresholds.highRiskRate * 100).toFixed(1)}%)`,
        metrics: {
          currentValue: metrics.highRiskRate,
          threshold: thresholds.highRiskRate,
          window: this.config.aggregationWindow,
          affectedQueries: Math.round(metrics.highRiskRate * events.length),
        },
        recommendations: [
          "Investigate high-risk queries for patterns",
          "Review classification confidence scores",
          "Consider additional validation for risky queries",
        ],
      });
    }

    // Check queries per minute
    if (metrics.queriesPerMinute > thresholds.queriesPerMinute) {
      this.generateAlert({
        alertId: this.generateAlertId(),
        timestamp: Date.now(),
        severity: "warning",
        type: "unusual_pattern",
        message: `Query rate (${Math.round(metrics.queriesPerMinute)} QPM) exceeds threshold (${thresholds.queriesPerMinute} QPM)`,
        metrics: {
          currentValue: metrics.queriesPerMinute,
          threshold: thresholds.queriesPerMinute,
          window: this.config.aggregationWindow,
          affectedQueries: events.length,
        },
        recommendations: [
          "Check for unusual traffic patterns or potential abuse",
          "Verify if this is expected load",
          "Consider rate limiting if necessary",
        ],
      });
    }

    // Check for data leaks (PII going to cloud)
    const cloudPIIEvents = events.filter(
      e =>
        e.destination === "cloud" && e.piiDetected && e.piiDetected.length > 0
    );
    const leakedBytes = cloudPIIEvents.reduce(
      (sum, e) => sum + e.queryLength,
      0
    );

    if (leakedBytes > thresholds.dataLeakThreshold) {
      this.generateAlert({
        alertId: this.generateAlertId(),
        timestamp: Date.now(),
        severity: "critical",
        type: "data_leak_detected",
        message: `Data leak detected: ${leakedBytes} bytes of PII transmitted to cloud`,
        metrics: {
          currentValue: leakedBytes,
          threshold: thresholds.dataLeakThreshold,
          window: this.config.aggregationWindow,
          affectedQueries: cloudPIIEvents.length,
          context: { cloudQueries: cloudPIIEvents.length },
        },
        recommendations: [
          "IMMEDIATE: Investigate PII transmission to cloud",
          "Review redaction rules before cloud routing",
          "Consider enabling intent encoding for all cloud queries",
        ],
      });
    }
  }

  /**
   * Generate and dispatch alert
   *
   * @param alert - Alert to generate
   */
  private generateAlert(alert: Alert): void {
    // Add to history
    this.alertHistory.push(alert);

    // Limit history size
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }

    // Emit to subscribers
    this.emit("alert", alert);

    // Send to configured channels
    for (const channel of this.config.alertChannels) {
      this.sendToChannel(alert, channel).catch(err => {
        console.error(`Failed to send alert to ${channel.type}:`, err);
      });
    }
  }

  /**
   * Send alert to a channel
   *
   * @param alert - Alert to send
   * @param channel - Channel to send to
   */
  private async sendToChannel(
    alert: Alert,
    channel: AlertChannel
  ): Promise<void> {
    switch (channel.type) {
      case "log":
        console.log(
          `[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`
        );
        break;

      case "webhook":
        await this.sendWebhook(alert, channel.config);
        break;

      case "email":
        await this.sendEmail(alert, channel.config);
        break;

      case "slack":
        await this.sendSlack(alert, channel.config);
        break;

      case "pagerduty":
        await this.sendPagerDuty(alert, channel.config);
        break;

      default:
        console.warn(`Unknown alert channel type: ${channel.type}`);
    }
  }

  /**
   * Send webhook alert
   *
   * @param alert - Alert to send
   * @param config - Webhook configuration
   */
  private async sendWebhook(
    alert: Alert,
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
          ...(config.headers as Record<string, string>),
        },
        body: JSON.stringify(alert),
      });

      if (!response.ok) {
        console.error(
          `Webhook failed: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("Webhook error:", error);
    }
  }

  /**
   * Send email alert (placeholder)
   *
   * @param alert - Alert to send
   * @param config - Email configuration
   */
  private async sendEmail(
    alert: Alert,
    config: Record<string, unknown>
  ): Promise<void> {
    // Placeholder for email implementation
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    console.log(
      `[EMAIL] To: ${config.to as string}, Subject: ${alert.message}`
    );
  }

  /**
   * Send Slack alert
   *
   * @param alert - Alert to send
   * @param config - Slack configuration
   */
  private async sendSlack(
    alert: Alert,
    config: Record<string, unknown>
  ): Promise<void> {
    const webhookUrl = config.webhookUrl as string;
    if (!webhookUrl) {
      console.warn("Slack webhook URL not configured");
      return;
    }

    const severityEmoji = {
      info: ":information_source:",
      warning: ":warning:",
      error: ":x:",
      critical: ":rotating_light:",
    };

    const slackMessage = {
      text: `${severityEmoji[alert.severity]} Privacy Alert: ${alert.type.toUpperCase()}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${alert.type.toUpperCase()}*\n${alert.message}`,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Severity:*\n${alert.severity}`,
            },
            {
              type: "mrkdwn",
              text: `*Time:*\n${new Date(alert.timestamp).toISOString()}`,
            },
            {
              type: "mrkdwn",
              text: `*Current:*\n${alert.metrics.currentValue}`,
            },
            {
              type: "mrkdwn",
              text: `*Threshold:*\n${alert.metrics.threshold}`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Recommendations:*",
          },
        },
        ...alert.recommendations.map(rec => ({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• ${rec}`,
          },
        })),
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackMessage),
      });

      if (!response.ok) {
        console.error(`Slack webhook failed: ${response.status}`);
      }
    } catch (error) {
      console.error("Slack webhook error:", error);
    }
  }

  /**
   * Send PagerDuty alert (placeholder)
   *
   * @param alert - Alert to send
   * @param config - PagerDuty configuration
   */
  private async sendPagerDuty(
    alert: Alert,
    config: Record<string, unknown>
  ): Promise<void> {
    // Placeholder for PagerDuty integration
    // In production, integrate with PagerDuty API
    console.log(
      `[PAGERDUTY] ${alert.severity.toUpperCase()}: ${alert.message}`
    );
  }

  /**
   * Process new events from logger
   */
  private processNewEvents(): void {
    // Get recent events from logger
    const recentEvents = this.logger.getRecentEvents(100);

    // Process each event
    for (const event of recentEvents) {
      // Check if event is already in current window
      const exists = this.currentWindow?.events.some(
        e => e.timestamp === event.timestamp
      );
      if (!exists) {
        this.processEvent(event);
      }
    }
  }

  /**
   * Generate unique alert ID
   *
   * @returns Alert ID
   */
  private generateAlertId(): string {
    return `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}
