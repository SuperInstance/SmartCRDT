/**
 * RealTimeDashboard - Real-time metrics dashboard
 */

import { EventEmitter } from "eventemitter3";
import type { RealtimeMetrics, DashboardConfig } from "../types.js";

export class RealTimeDashboard extends EventEmitter {
  private config: DashboardConfig;
  private activeUsers: Set<string> = new Set();
  private currentPageViews: Set<string> = new Set();
  private eventBuffer: Array<{ type: string; timestamp: number }> = [];
  private latencySamples: number[] = [];
  private errorCount: number = 0;
  private totalEvents: number = 0;
  private refreshTimer: NodeJS.Timeout | null = null;
  private windowStart: number = Date.now();

  constructor(config: DashboardConfig) {
    super();
    this.config = config;
    this.startRefreshTimer();
  }

  /**
   * Get real-time metrics
   */
  getMetrics(): RealtimeMetrics {
    const now = Date.now();
    const windowSize = 60000; // 1 minute window

    // Clean old events
    this.eventBuffer = this.eventBuffer.filter(
      e => now - e.timestamp < windowSize
    );

    // Calculate events per minute
    const eventsPerMinute = this.eventBuffer.length;

    // Calculate average latency
    const avgLatency =
      this.latencySamples.length > 0
        ? this.latencySamples.reduce((a, b) => a + b, 0) /
          this.latencySamples.length
        : 0;

    // Calculate error rate
    const errorRate =
      this.totalEvents > 0 ? this.errorCount / this.totalEvents : 0;

    return {
      activeUsers: this.activeUsers.size,
      currentPageViews: this.currentPageViews.size,
      currentSessionCount: this.activeUsers.size,
      eventsPerMinute,
      averageLatency: avgLatency,
      errorRate,
      topPages: this.getTopPages(),
      timestamp: now,
    };
  }

  /**
   * Track active user
   */
  trackActiveUser(userId: string): void {
    this.activeUsers.add(userId);
    this.emit("userActive", userId);
  }

  /**
   * Remove inactive user
   */
  removeInactiveUser(userId: string): void {
    this.activeUsers.delete(userId);
    this.emit("userInactive", userId);
  }

  /**
   * Track page view
   */
  trackPageView(url: string, userId?: string): void {
    const key = `${url}-${userId ?? "anonymous"}`;
    this.currentPageViews.add(key);

    if (userId) {
      this.trackActiveUser(userId);
    }

    this.recordEvent("page_view");
    this.emit("pageViewed", { url, userId });
  }

  /**
   * Track event
   */
  trackEvent(type: string): void {
    this.recordEvent(type);
    this.emit("eventTracked", { type });
  }

  /**
   * Track latency
   */
  trackLatency(latency: number): void {
    this.latencySamples.push(latency);

    // Keep only last 100 samples
    if (this.latencySamples.length > 100) {
      this.latencySamples.shift();
    }

    this.emit("latencyRecorded", { latency });
  }

  /**
   * Track error
   */
  trackError(): void {
    this.errorCount++;
    this.emit("errorRecorded");
  }

  /**
   * Get top pages
   */
  private getTopPages(): Array<{ url: string; views: number }> {
    const pageCounts = new Map<string, number>();

    for (const key of this.currentPageViews) {
      const url = key.split("-")[0];
      pageCounts.set(url, (pageCounts.get(url) || 0) + 1);
    }

    return Array.from(pageCounts.entries())
      .map(([url, views]) => ({ url, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  /**
   * Record event
   */
  private recordEvent(type: string): void {
    this.eventBuffer.push({ type, timestamp: Date.now() });
    this.totalEvents++;
  }

  /**
   * Start refresh timer
   */
  private startRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      const metrics = this.getMetrics();
      this.emit("metricsUpdated", metrics);
    }, this.config.refreshInterval);
  }

  /**
   * Stop refresh timer
   */
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Reset
   */
  reset(): void {
    this.activeUsers.clear();
    this.currentPageViews.clear();
    this.eventBuffer = [];
    this.latencySamples = [];
    this.errorCount = 0;
    this.totalEvents = 0;
    this.windowStart = Date.now();
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    this.stopAutoRefresh();
    this.removeAllListeners();
  }
}
