/**
 * Notifier - Sends alert notifications to various channels
 */

import type { Alert, NotificationChannel } from "../types.js";

export interface NotificationResult {
  success: boolean;
  channelId: string;
  channelType: string;
  error?: string;
  timestamp: number;
}

export class Notifier {
  private channels: Map<string, NotificationChannel> = new Map();
  private notificationHistory: Array<{
    alert: Alert;
    channel: NotificationChannel;
    result: NotificationResult;
  }> = [];

  /**
   * Add a notification channel
   */
  addChannel(channel: NotificationChannel): void {
    this.channels.set(channel.id, channel);
  }

  /**
   * Remove a notification channel
   */
  removeChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  /**
   * Get all channels
   */
  getChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Send notification to a specific channel
   */
  async send(alert: Alert, channelId: string): Promise<NotificationResult> {
    const channel = this.channels.get(channelId);

    if (!channel) {
      return {
        success: false,
        channelId,
        channelType: "unknown",
        error: "Channel not found",
        timestamp: Date.now(),
      };
    }

    if (!channel.enabled) {
      return {
        success: false,
        channelId,
        channelType: channel.type,
        error: "Channel is disabled",
        timestamp: Date.now(),
      };
    }

    let result: NotificationResult;

    try {
      switch (channel.type) {
        case "email":
          result = await this.sendEmail(alert, channel);
          break;
        case "webhook":
          result = await this.sendWebhook(alert, channel);
          break;
        case "slack":
          result = await this.sendSlack(alert, channel);
          break;
        case "pagerduty":
          result = await this.sendPagerDuty(alert, channel);
          break;
        case "sms":
          result = await this.sendSMS(alert, channel);
          break;
        default:
          result = {
            success: false,
            channelId,
            channelType: channel.type,
            error: `Unsupported channel type: ${channel.type}`,
            timestamp: Date.now(),
          };
      }
    } catch (error) {
      result = {
        success: false,
        channelId,
        channelType: channel.type,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }

    // Record in history
    this.notificationHistory.push({
      alert,
      channel,
      result,
    });

    return result;
  }

  /**
   * Send to multiple channels
   */
  async sendToMultiple(
    alert: Alert,
    channelIds: string[]
  ): Promise<NotificationResult[]> {
    const results = await Promise.all(
      channelIds.map(id => this.send(alert, id))
    );

    return results;
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<NotificationResult> {
    const config = channel.config as {
      to?: string[];
      subject?: string;
      from?: string;
    };

    // Placeholder for actual email sending
    console.log(
      `Sending email to ${config.to?.join(", ") || "default"}: ${alert.title}`
    );

    return {
      success: true,
      channelId: channel.id,
      channelType: "email",
      timestamp: Date.now(),
    };
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<NotificationResult> {
    const config = channel.config as {
      url?: string;
      method?: "POST" | "PUT" | "PATCH";
      headers?: Record<string, string>;
    };

    if (!config.url) {
      return {
        success: false,
        channelId: channel.id,
        channelType: "webhook",
        error: "Webhook URL not configured",
        timestamp: Date.now(),
      };
    }

    try {
      // Placeholder for actual HTTP request
      console.log(`Sending webhook to ${config.url}: ${alert.title}`);

      return {
        success: true,
        channelId: channel.id,
        channelType: "webhook",
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        channelId: channel.id,
        channelType: "webhook",
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<NotificationResult> {
    const config = channel.config as {
      webhookUrl?: string;
      channel?: string;
      username?: string;
    };

    if (!config.webhookUrl && !config.channel) {
      return {
        success: false,
        channelId: channel.id,
        channelType: "slack",
        error: "Slack webhook URL or channel not configured",
        timestamp: Date.now(),
      };
    }

    const color = this.getSlackColor(alert.severity);
    const message = {
      text: alert.title,
      attachments: [
        {
          color,
          fields: [
            { title: "Severity", value: alert.severity, short: true },
            { title: "Metric", value: alert.metric || "N/A", short: true },
            {
              title: "Value",
              value: String(alert.value ?? "N/A"),
              short: true,
            },
            {
              title: "Threshold",
              value: String(alert.threshold ?? "N/A"),
              short: true,
            },
          ],
          text: alert.message,
        },
      ],
    };

    // Placeholder for actual Slack API call
    console.log(`Sending Slack notification: ${alert.title}`);

    return {
      success: true,
      channelId: channel.id,
      channelType: "slack",
      timestamp: Date.now(),
    };
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDuty(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<NotificationResult> {
    const config = channel.config as {
      integrationKey?: string;
      routingKey?: string;
    };

    if (!config.integrationKey && !config.routingKey) {
      return {
        success: false,
        channelId: channel.id,
        channelType: "pagerduty",
        error: "PagerDuty integration key not configured",
        timestamp: Date.now(),
      };
    }

    const payload = {
      routing_key: config.routingKey || config.integrationKey,
      event_action: "trigger",
      payload: {
        summary: alert.title,
        severity:
          alert.severity === "critical"
            ? "critical"
            : alert.severity === "error"
              ? "error"
              : "warning",
        source: alert.metric || "analytics",
        custom_details: {
          message: alert.message,
          value: alert.value,
          threshold: alert.threshold,
        },
      },
    };

    // Placeholder for actual PagerDuty API call
    console.log(`Sending PagerDuty notification: ${alert.title}`);

    return {
      success: true,
      channelId: channel.id,
      channelType: "pagerduty",
      timestamp: Date.now(),
    };
  }

  /**
   * Send SMS notification
   */
  private async sendSMS(
    alert: Alert,
    channel: NotificationChannel
  ): Promise<NotificationResult> {
    const config = channel.config as {
      to?: string[];
      from?: string;
      provider?: "twilio" | "aws-sns" | "custom";
    };

    if (!config.to || config.to.length === 0) {
      return {
        success: false,
        channelId: channel.id,
        channelType: "sms",
        error: "No recipients configured",
        timestamp: Date.now(),
      };
    }

    const message = `[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`;

    // Placeholder for actual SMS sending
    console.log(`Sending SMS to ${config.to.join(", ")}: ${message}`);

    return {
      success: true,
      channelId: channel.id,
      channelType: "sms",
      timestamp: Date.now(),
    };
  }

  /**
   * Get Slack color for severity
   */
  private getSlackColor(severity: string): string {
    const colors: Record<string, string> = {
      info: "#36a64f",
      warning: "#ff9900",
      error: "#ff0000",
      critical: "#990000",
    };

    return colors[severity] || "#cccccc";
  }

  /**
   * Get notification history
   */
  getHistory(limit: number = 100): Array<{
    alert: Alert;
    channel: NotificationChannel;
    result: NotificationResult;
  }> {
    return this.notificationHistory.slice(-limit);
  }

  /**
   * Get notification statistics
   */
  getStats(): {
    total: number;
    successful: number;
    failed: number;
    byChannel: Record<
      string,
      { total: number; successful: number; failed: number }
    >;
  } {
    const byChannel: Record<
      string,
      { total: number; successful: number; failed: number }
    > = {};

    for (const record of this.notificationHistory) {
      const channelId = record.channel.id;

      if (!byChannel[channelId]) {
        byChannel[channelId] = { total: 0, successful: 0, failed: 0 };
      }

      byChannel[channelId].total++;
      if (record.result.success) {
        byChannel[channelId].successful++;
      } else {
        byChannel[channelId].failed++;
      }
    }

    return {
      total: this.notificationHistory.length,
      successful: this.notificationHistory.filter(r => r.result.success).length,
      failed: this.notificationHistory.filter(r => !r.result.success).length,
      byChannel,
    };
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.notificationHistory = [];
  }
}
