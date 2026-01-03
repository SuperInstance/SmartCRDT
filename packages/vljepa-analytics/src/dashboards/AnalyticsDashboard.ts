/**
 * AnalyticsDashboard - Main analytics dashboard
 * Provides overview, users, sessions, events, funnels, and cohorts analytics
 */

import { EventEmitter } from "eventemitter3";
import type {
  DashboardConfig,
  DashboardData,
  OverviewMetrics,
  UserMetrics,
  SessionMetrics,
  EventMetrics,
  FunnelMetrics,
  CohortMetrics,
  DateRange,
  WidgetType,
} from "../types.js";
import { EventStore } from "../storage/EventStore.js";
import { UserProfileStore } from "../storage/UserProfileStore.js";
import { SessionCollector } from "../collectors/SessionCollector.js";

export class AnalyticsDashboard extends EventEmitter {
  private config: DashboardConfig;
  private eventStore: EventStore;
  private userStore: UserProfileStore;
  private sessionCollector: SessionCollector;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    config: DashboardConfig,
    eventStore: EventStore,
    userStore: UserProfileStore,
    sessionCollector: SessionCollector
  ) {
    super();
    this.config = config;
    this.eventStore = eventStore;
    this.userStore = userStore;
    this.sessionCollector = sessionCollector;

    if (config.refreshInterval > 0) {
      this.startRefreshTimer();
    }
  }

  /**
   * Get dashboard data
   */
  async getData(): Promise<DashboardData> {
    const data: DashboardData = {
      overview: await this.getOverviewMetrics(),
      users: await this.getUserMetrics(),
      sessions: await this.getSessionMetrics(),
      events: await this.getEventMetrics(),
      funnels: await this.getFunnelMetrics(),
      cohorts: await this.getCohortMetrics(),
      timestamp: Date.now(),
    };

    this.emit("dataUpdated", data);
    return data;
  }

  /**
   * Get overview metrics
   */
  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const events = this.eventStore.getByDateRange(this.config.dateRange);
    const users = this.userStore.query({ dateRange: this.config.dateRange });
    const sessions = this.sessionCollector.getAll();

    const uniqueUsers = new Set(events.map(e => e.userId)).size;
    const uniqueSessions = new Set(events.map(e => e.sessionId)).size;
    const pageViews = events.filter(e => e.type === "page_view").length;
    const conversions = events.filter(e => e.type === "conversion").length;

    const completedSessions = sessions.filter(s => s.endTime);
    const avgDuration =
      completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + (s.duration || 0), 0) /
          completedSessions.length
        : 0;

    const bounceRate =
      sessions.length > 0
        ? sessions.filter(s => s.pageViews === 1).length / sessions.length
        : 0;

    return {
      totalUsers: users.length,
      activeUsers: uniqueUsers,
      totalSessions: uniqueSessions,
      totalEvents: events.length,
      bounceRate,
      avgSessionDuration: avgDuration,
      conversionRate: uniqueSessions > 0 ? conversions / uniqueSessions : 0,
      pageViewsPerSession: uniqueSessions > 0 ? pageViews / uniqueSessions : 0,
      dateRange: this.config.dateRange,
    };
  }

  /**
   * Get user metrics
   */
  async getUserMetrics(): Promise<UserMetrics> {
    const users = this.userStore.query({ dateRange: this.config.dateRange });
    const { start, end } = this.config.dateRange;

    const newUsers = this.userStore.getNewUsers(start, end);
    const activeUsers = this.userStore.getActiveUsers(30);
    const churnedUsers = this.userStore.getChurnedUsers(30);
    const retention = this.userStore.getRetention(30);

    // Calculate segments
    const segmentCounts = new Map<string, number>();
    for (const user of users) {
      for (const segment of user.segments) {
        segmentCounts.set(segment, (segmentCounts.get(segment) || 0) + 1);
      }
    }

    const topSegments = Array.from(segmentCounts.entries())
      .map(([segment, count]) => ({
        segment,
        count,
        percentage: users.length > 0 ? (count / users.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: users.length,
      new: newUsers.length,
      returning: users.length - newUsers.length,
      active: activeUsers.length,
      churned: churnedUsers.length,
      retention,
      topSegments,
    };
  }

  /**
   * Get session metrics
   */
  async getSessionMetrics(): Promise<SessionMetrics> {
    const sessions = this.sessionCollector.getAll();
    const completedSessions = sessions.filter(s => s.endTime);

    const durations = completedSessions
      .map(s => s.duration || 0)
      .sort((a, b) => a - b);

    const referrerCounts = new Map<string, number>();
    for (const session of sessions) {
      if (session.referrer) {
        referrerCounts.set(
          session.referrer,
          (referrerCounts.get(session.referrer) || 0) + 1
        );
      }
    }

    const topReferrers = Array.from(referrerCounts.entries())
      .map(([referrer, count]) => ({
        referrer,
        count,
        percentage: sessions.length > 0 ? (count / sessions.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const average =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    return {
      total: sessions.length,
      average,
      median:
        durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0,
      p75:
        durations.length > 0
          ? durations[Math.floor(durations.length * 0.75)]
          : 0,
      p90:
        durations.length > 0
          ? durations[Math.floor(durations.length * 0.9)]
          : 0,
      p95:
        durations.length > 0
          ? durations[Math.floor(durations.length * 0.95)]
          : 0,
      p99:
        durations.length > 0
          ? durations[Math.floor(durations.length * 0.99)]
          : 0,
      bounceRate:
        sessions.length > 0
          ? sessions.filter(s => s.pageViews === 1).length / sessions.length
          : 0,
      averagePageViews:
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + s.pageViews, 0) / sessions.length
          : 0,
      topReferrers,
    };
  }

  /**
   * Get event metrics
   */
  async getEventMetrics(): Promise<EventMetrics> {
    const events = this.eventStore.getByDateRange(this.config.dateRange);

    const uniqueUsers = new Set(events.map(e => e.userId)).size;
    const uniqueSessions = new Set(events.map(e => e.sessionId)).size;

    // Count events by type
    const eventCounts = new Map<string, number>();
    const eventUniqueUsers = new Map<string, Set<string>>();
    const categoryCounts = new Map<string, number>();

    for (const event of events) {
      eventCounts.set(event.type, (eventCounts.get(event.type) || 0) + 1);
      categoryCounts.set(
        event.category,
        (categoryCounts.get(event.category) || 0) + 1
      );

      if (!eventUniqueUsers.has(event.type)) {
        eventUniqueUsers.set(event.type, new Set());
      }
      eventUniqueUsers.get(event.type)!.add(event.userId);
    }

    const topEvents = Array.from(eventCounts.entries())
      .map(([event, count]) => ({
        event,
        count,
        unique: eventUniqueUsers.get(event)!.size,
        percentage: events.length > 0 ? (count / events.length) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Generate trends
    const trends = this.generateTrends(events);

    return {
      total: events.length,
      unique: uniqueUsers,
      perSession: uniqueSessions > 0 ? events.length / uniqueSessions : 0,
      topEvents,
      byCategory: Object.fromEntries(categoryCounts),
      trends,
    };
  }

  /**
   * Get funnel metrics
   */
  async getFunnelMetrics(): Promise<FunnelMetrics[]> {
    // Default funnel: Page View -> Engagement -> Conversion
    const events = this.eventStore.getByDateRange(this.config.dateRange);
    const users = new Set(events.map(e => e.userId));

    const pageViewUsers = new Set(
      events.filter(e => e.type === "page_view").map(e => e.userId)
    );
    const engagementUsers = new Set(
      events.filter(e => e.type === "engagement").map(e => e.userId)
    );
    const conversionUsers = new Set(
      events.filter(e => e.type === "conversion").map(e => e.userId)
    );

    const steps = [
      {
        name: "Page View",
        count: pageViewUsers.size,
        percentage: 100,
        dropoff: 0,
        averageTime: 0,
      },
      {
        name: "Engagement",
        count: engagementUsers.size,
        percentage:
          pageViewUsers.size > 0
            ? (engagementUsers.size / pageViewUsers.size) * 100
            : 0,
        dropoff:
          pageViewUsers.size > 0
            ? pageViewUsers.size - engagementUsers.size
            : 0,
        averageTime: 0,
      },
      {
        name: "Conversion",
        count: conversionUsers.size,
        percentage:
          engagementUsers.size > 0
            ? (conversionUsers.size / engagementUsers.size) * 100
            : 0,
        dropoff:
          engagementUsers.size > 0
            ? engagementUsers.size - conversionUsers.size
            : 0,
        averageTime: 0,
      },
    ];

    return [
      {
        name: "Default Funnel",
        steps,
        totalUsers: users.size,
        completionRate:
          users.size > 0 ? (conversionUsers.size / users.size) * 100 : 0,
        averageDropoffRate:
          users.size > 0
            ? (users.size - conversionUsers.size) / users.size / steps.length
            : 0,
        totalDuration: 0,
      },
    ];
  }

  /**
   * Get cohort metrics
   */
  async getCohortMetrics(): Promise<CohortMetrics> {
    // Group users by signup week
    const users = this.userStore.query({ dateRange: this.config.dateRange });
    const cohortMap = new Map<string, Set<string>>();

    for (const user of users) {
      const week = Math.floor(user.firstSeen / (7 * 24 * 60 * 60 * 1000));
      const cohortKey = `Week ${week}`;
      if (!cohortMap.has(cohortKey)) {
        cohortMap.set(cohortKey, new Set());
      }
      cohortMap.get(cohortKey)!.add(user.userId);
    }

    const cohorts = Array.from(cohortMap.entries()).map(([name, userIds]) => {
      const retention: Array<{
        period: number;
        percentage: number;
        count: number;
      }> = [];
      const cohortUsers = Array.from(userIds);

      for (let period = 1; period <= 8; period++) {
        const cutoff = period * 7 * 24 * 60 * 60 * 1000;
        const retained = cohortUsers.filter(userId => {
          const user = this.userStore.get(userId);
          return user && user.lastSeen - user.firstSeen >= cutoff;
        }).length;

        retention.push({
          period,
          percentage:
            cohortUsers.length > 0 ? (retained / cohortUsers.length) * 100 : 0,
          count: retained,
        });
      }

      return {
        name,
        size: userIds.size,
        retention,
      };
    });

    return { cohorts };
  }

  /**
   * Generate trends from events
   */
  private generateTrends(
    events: unknown[]
  ): Array<{ date: string; count: number }> {
    // Group by day
    const dailyCounts = new Map<string, number>();

    for (const event of events as Array<{ timestamp: number }>) {
      const date = new Date(event.timestamp).toISOString().split("T")[0];
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    }

    return Array.from(dailyCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.refreshInterval !== undefined) {
      this.stopRefreshTimer();
      if (config.refreshInterval > 0) {
        this.startRefreshTimer();
      }
    }
  }

  /**
   * Start refresh timer
   */
  private startRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    this.refreshTimer = setInterval(() => {
      this.getData();
    }, this.config.refreshInterval);
  }

  /**
   * Stop refresh timer
   */
  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    this.stopRefreshTimer();
    this.removeAllListeners();
  }
}
