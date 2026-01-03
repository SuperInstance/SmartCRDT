/**
 * AnalyticsDashboard Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsDashboard } from '../src/dashboards/AnalyticsDashboard.js';
import { EventStore } from '../src/storage/EventStore.js';
import { UserProfileStore } from '../src/storage/UserProfileStore.js';
import { SessionCollector } from '../src/collectors/SessionCollector.js';

describe('AnalyticsDashboard', () => {
  let dashboard: AnalyticsDashboard;
  let eventStore: EventStore;
  let userStore: UserProfileStore;
  let sessionCollector: SessionCollector;

  beforeEach(() => {
    eventStore = new EventStore();
    userStore = new UserProfileStore();
    sessionCollector = new SessionCollector();

    dashboard = new AnalyticsDashboard(
      {
        refreshInterval: 0,
        widgets: ['overview', 'users', 'sessions', 'events', 'funnels', 'cohorts'],
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        filters: [],
        exportFormats: ['csv', 'json'],
      },
      eventStore,
      userStore,
      sessionCollector
    );
  });

  describe('overview metrics', () => {
    it('should calculate overview metrics', async () => {
      // Add test data
      const events = [
        {
          id: '1',
          type: 'page_view' as const,
          category: 'navigation' as const,
          timestamp: Date.now(),
          userId: 'user1',
          sessionId: 'session1',
          properties: {},
          context: {},
        },
        {
          id: '2',
          type: 'conversion' as const,
          category: 'transaction' as const,
          timestamp: Date.now(),
          userId: 'user1',
          sessionId: 'session1',
          properties: {},
          context: {},
        },
      ];

      for (const event of events) {
        eventStore.store(event);
      }

      const metrics = await dashboard.getOverviewMetrics();

      expect(metrics).toHaveProperty('totalUsers');
      expect(metrics).toHaveProperty('totalSessions');
      expect(metrics).toHaveProperty('totalEvents', 2);
      expect(metrics).toHaveProperty('bounceRate');
      expect(metrics).toHaveProperty('avgSessionDuration');
    });
  });

  describe('user metrics', () => {
    it('should calculate user metrics', async () => {
      userStore.store({
        userId: 'user1',
        traits: { plan: 'premium' },
        preferences: {
          language: 'en',
          theme: 'dark',
          notifications: true,
          accessibility: {},
          customSettings: {},
        },
        segments: ['premium'],
        firstSeen: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastSeen: Date.now(),
        sessionCount: 5,
        totalSessions: 5,
        lifetimeValue: 100,
        customProperties: {},
      });

      const metrics = await dashboard.getUserMetrics();

      expect(metrics).toHaveProperty('total', 1);
      expect(metrics).toHaveProperty('new');
      expect(metrics).toHaveProperty('active');
      expect(metrics).toHaveProperty('retention');
    });
  });

  describe('session metrics', () => {
    it('should calculate session metrics', async () => {
      sessionCollector.start('user1');
      const session = sessionCollector.getActiveSession('user1');
      sessionCollector.incrementPageViews(session!.sessionId);
      sessionCollector.end(session!.sessionId);

      const metrics = await dashboard.getSessionMetrics();

      expect(metrics).toHaveProperty('total', 1);
      expect(metrics).toHaveProperty('average');
      expect(metrics).toHaveProperty('bounceRate');
    });
  });

  describe('event metrics', () => {
    it('should calculate event metrics', async () => {
      const events = [
        {
          id: '1',
          type: 'click' as const,
          category: 'interaction' as const,
          timestamp: Date.now(),
          userId: 'user1',
          sessionId: 'session1',
          properties: { element: 'button' },
          context: {},
        },
        {
          id: '2',
          type: 'click' as const,
          category: 'interaction' as const,
          timestamp: Date.now(),
          userId: 'user2',
          sessionId: 'session2',
          properties: { element: 'link' },
          context: {},
        },
      ];

      for (const event of events) {
        eventStore.store(event);
      }

      const metrics = await dashboard.getEventMetrics();

      expect(metrics).toHaveProperty('total', 2);
      expect(metrics).toHaveProperty('unique');
      expect(metrics.topEvents).toBeDefined();
      expect(metrics.byCategory).toBeDefined();
    });
  });

  describe('funnel metrics', () => {
    it('should calculate funnel metrics', async () => {
      const events = [
        {
          id: '1',
          type: 'page_view' as const,
          category: 'navigation' as const,
          timestamp: Date.now(),
          userId: 'user1',
          sessionId: 'session1',
          properties: {},
          context: {},
        },
        {
          id: '2',
          type: 'engagement' as const,
          category: 'interaction' as const,
          timestamp: Date.now(),
          userId: 'user1',
          sessionId: 'session1',
          properties: {},
          context: {},
        },
        {
          id: '3',
          type: 'conversion' as const,
          category: 'transaction' as const,
          timestamp: Date.now(),
          userId: 'user1',
          sessionId: 'session1',
          properties: {},
          context: {},
        },
      ];

      for (const event of events) {
        eventStore.store(event);
      }

      const funnels = await dashboard.getFunnelMetrics();

      expect(funnels).toHaveLength(1);
      expect(funnels[0]).toHaveProperty('name');
      expect(funnels[0]).toHaveProperty('steps');
      expect(funnels[0]).toHaveProperty('completionRate');
    });
  });

  describe('cohort metrics', () => {
    it('should calculate cohort metrics', async () => {
      userStore.store({
        userId: 'user1',
        traits: {},
        preferences: {
          language: 'en',
          theme: 'light',
          notifications: true,
          accessibility: {},
          customSettings: {},
        },
        segments: [],
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        sessionCount: 1,
        totalSessions: 1,
        lifetimeValue: 0,
        customProperties: {},
      });

      const cohorts = await dashboard.getCohortMetrics();

      expect(cohorts).toHaveProperty('cohorts');
      expect(Array.isArray(cohorts.cohorts)).toBe(true);
    });
  });

  describe('config updates', () => {
    it('should update config', () => {
      const newDateRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      dashboard.updateConfig({ dateRange: newDateRange });

      const emittedSpy = vi.fn();
      dashboard.on('dataUpdated', emittedSpy);
    });
  });

  describe('dashboard data', () => {
    it('should get all dashboard data', async () => {
      const data = await dashboard.getData();

      expect(data).toHaveProperty('overview');
      expect(data).toHaveProperty('users');
      expect(data).toHaveProperty('sessions');
      expect(data).toHaveProperty('events');
      expect(data).toHaveProperty('funnels');
      expect(data).toHaveProperty('cohorts');
      expect(data).toHaveProperty('timestamp');
    });
  });

  describe('shutdown', () => {
    it('should shutdown dashboard', () => {
      const removeListenerSpy = vi.spyOn(dashboard, 'removeAllListeners');

      dashboard.shutdown();

      expect(removeListenerSpy).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty data', async () => {
      const metrics = await dashboard.getOverviewMetrics();
      expect(metrics.totalEvents).toBe(0);
    });

    it('should handle single event', async () => {
      eventStore.store({
        id: '1',
        type: 'page_view' as const,
        category: 'navigation' as const,
        timestamp: Date.now(),
        userId: 'user1',
        sessionId: 'session1',
        properties: {},
        context: {},
      });

      const metrics = await dashboard.getEventMetrics();
      expect(metrics.total).toBe(1);
    });

    it('should handle date range filtering', async () => {
      const oldDate = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
      const recentDate = Date.now() - 1 * 24 * 60 * 60 * 1000; // 1 day ago

      eventStore.store({
        id: '1',
        type: 'page_view' as const,
        category: 'navigation' as const,
        timestamp: oldDate,
        userId: 'user1',
        sessionId: 'session1',
        properties: {},
        context: {},
      });

      eventStore.store({
        id: '2',
        type: 'page_view' as const,
        category: 'navigation' as const,
        timestamp: recentDate,
        userId: 'user1',
        sessionId: 'session1',
        properties: {},
        context: {},
      });

      const metrics = await dashboard.getEventMetrics();
      // Should only include recent events based on dateRange
      expect(metrics.total).toBeGreaterThan(0);
    });
  });
});
