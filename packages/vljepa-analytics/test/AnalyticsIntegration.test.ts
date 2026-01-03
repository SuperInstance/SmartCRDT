/**
 * Analytics Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EventCollector,
  AnalyticsDashboard,
  PersonalizationDashboard,
  EventStore,
  UserProfileStore,
  SessionCollector,
  InsightGenerator,
  AlertManager,
  ChartRenderer,
} from '../src/index.js';

describe('Analytics Integration Tests', () => {
  let eventCollector: EventCollector;
  let analyticsDashboard: AnalyticsDashboard;
  let personalizationDashboard: PersonalizationDashboard;
  let eventStore: EventStore;
  let userStore: UserProfileStore;
  let sessionCollector: SessionCollector;
  let insightGenerator: InsightGenerator;
  let alertManager: AlertManager;
  let chartRenderer: ChartRenderer;

  beforeEach(() => {
    eventCollector = new EventCollector({ batchSize: 10, flushInterval: 1000 });
    eventStore = new EventStore();
    userStore = new UserProfileStore();
    sessionCollector = new SessionCollector();

    analyticsDashboard = new AnalyticsDashboard(
      {
        refreshInterval: 0,
        widgets: ['overview', 'users', 'sessions', 'events', 'funnels'],
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

    personalizationDashboard = new PersonalizationDashboard({
      refreshInterval: 0,
      widgets: ['personalization'],
      dateRange: { start: new Date(), end: new Date() },
      filters: [],
      exportFormats: [],
    });

    insightGenerator = new InsightGenerator({ minConfidence: 0.7 });
    alertManager = new AlertManager({
      rules: [],
      notifications: [],
      cooldown: 60000,
      maxAlertsPerHour: 100,
    });
    chartRenderer = new ChartRenderer();
  });

  describe('end-to-end event flow', () => {
    it('should track event and update dashboard', async () => {
      eventCollector.initialize('user-123', { url: 'https://example.com' });
      eventCollector.trackPageView('/home');

      // Listen for flush
      eventCollector.once('flush', (events) => {
        for (const event of events) {
          eventStore.store(event);
        }
      });

      await eventCollector.flush();

      const metrics = await analyticsDashboard.getOverviewMetrics();
      expect(metrics.totalEvents).toBeGreaterThan(0);
    });

    it('should track multiple events in session', async () => {
      eventCollector.initialize('user-456', { url: 'https://example.com' });

      const sessionId = sessionCollector.start('user-456');

      eventCollector.trackPageView('/home');
      eventCollector.trackClick('button-cta');
      eventCollector.trackScroll(500, 2000);
      eventCollector.trackConversion('signup', 0);

      sessionCollector.incrementConversions(sessionId);
      sessionCollector.end(sessionId);

      await eventCollector.flush();

      const metrics = await analyticsDashboard.getSessionMetrics();
      expect(metrics.total).toBeGreaterThan(0);
    });
  });

  describe('user journey tracking', () => {
    it('should track user through funnel', async () => {
      eventCollector.initialize('user-journey', { url: 'https://example.com' });

      const userId = 'user-journey';
      const sessionId = sessionCollector.start(userId);

      // Page view
      eventCollector.trackPageView('/landing');
      await eventCollector.flush();

      // Engagement
      eventCollector.trackEngagement('click', 'hero-button');
      await eventCollector.flush();

      // Conversion
      eventCollector.trackConversion('purchase', 99.99);
      await eventCollector.flush();

      // Check funnel
      const funnels = await analyticsDashboard.getFunnelMetrics();
      expect(funnels.length).toBeGreaterThan(0);
    });
  });

  describe('personalization tracking', () => {
    it('should track personalization metrics', async () => {
      personalizationDashboard.recordPrediction('user-pers', 'item_a', 'item_a');
      personalizationDashboard.recordSatisfaction('user-pers', 0.9);
      personalizationDashboard.recordEngagement('user-pers', 15, 10);
      personalizationDashboard.recordRecommendationResults(
        'user-pers',
        ['item_a', 'item_b', 'item_c'],
        ['item_a', 'item_b'],
        ['item_a'],
        0.8,
        0.7
      );

      const metrics = await personalizationDashboard.getMetrics();

      expect(metrics.accuracy).toBeGreaterThan(0);
      expect(metrics.satisfaction).toBeCloseTo(0.9, 1);
      expect(metrics.engagementLift).toBeCloseTo(50, 0);
    });
  });

  describe('insight generation integration', () => {
    it('should generate insights from tracked metrics', async () => {
      for (let i = 0; i < 20; i++) {
        insightGenerator.recordMetric('page_views', 100 + i * 10);
      }

      const insights = await insightGenerator.generateInsights();
      expect(insights.length).toBeGreaterThan(0);
    });

    it('should detect anomalies in event patterns', async () => {
      // Normal pattern
      for (let i = 0; i < 20; i++) {
        insightGenerator.recordMetric('errors', 1 + Math.random());
      }

      // Anomaly
      insightGenerator.recordMetric('errors', 50);

      const insights = await insightGenerator.generateInsights();
      const anomalies = insights.filter((i) => i.type === 'anomaly');

      expect(anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('alert integration', () => {
    it('should trigger alert on threshold breach', () => {
      alertManager.addRule({
        id: 'test-rule',
        name: 'Test Alert',
        type: 'threshold',
        metric: 'test_metric',
        condition: 'gt',
        threshold: 100,
        severity: 'warning',
        cooldown: 1000,
        enabled: true,
        notificationChannels: [],
      });

      const alertSpy = vi.fn();
      alertManager.on('alert', alertSpy);

      alertManager.updateMetric('test_metric', 150);

      expect(alertSpy).toHaveBeenCalled();
    });
  });

  describe('visualization integration', () => {
    it('should render chart from dashboard data', async () => {
      const metrics = await analyticsDashboard.getOverviewMetrics();

      const chartConfig = {
        type: 'line' as const,
        data: {
          labels: ['Users', 'Sessions', 'Events'],
          datasets: [
            {
              label: 'Overview',
              data: [
                metrics.totalUsers,
                metrics.totalSessions,
                metrics.totalEvents,
              ],
            },
          ],
        },
        options: { responsive: true },
        elementId: 'overview-chart',
      };

      const chart = chartRenderer.render(chartConfig);

      expect(chart.type).toBe('line');
      expect(chart.renderTime).toBeGreaterThanOrEqual(0);
    });

    it('should render funnel chart', async () => {
      const funnels = await analyticsDashboard.getFunnelMetrics();

      if (funnels.length > 0) {
        const funnel = funnels[0];
        const chartConfig = {
          type: 'funnel' as const,
          data: {
            labels: funnel.steps.map((s) => s.name),
            datasets: [
              {
                label: funnel.name,
                data: funnel.steps.map((s) => s.count),
              },
            ],
          },
          options: {},
          elementId: 'funnel-chart',
        };

        const chart = chartRenderer.render(chartConfig);
        expect(chart.type).toBe('funnel');
      }
    });
  });

  describe('user profile integration', () => {
    it('should track user traits and preferences', async () => {
      userStore.store({
        userId: 'user-profile',
        traits: { plan: 'premium', country: 'US' },
        preferences: {
          language: 'en',
          theme: 'dark',
          notifications: true,
          accessibility: {},
          customSettings: {},
        },
        segments: ['premium', 'active'],
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        sessionCount: 5,
        totalSessions: 5,
        lifetimeValue: 500,
        customProperties: {},
      });

      const profile = userStore.get('user-profile');
      expect(profile).toBeDefined();
      expect(profile?.traits.plan).toBe('premium');
    });

    it('should calculate user metrics from profiles', async () => {
      userStore.store({
        userId: 'user-metrics-1',
        traits: {},
        preferences: {
          language: 'en',
          theme: 'light',
          notifications: false,
          accessibility: {},
          customSettings: {},
        },
        segments: [],
        firstSeen: Date.now() - 10 * 24 * 60 * 60 * 1000,
        lastSeen: Date.now(),
        sessionCount: 1,
        totalSessions: 1,
        lifetimeValue: 0,
        customProperties: {},
      });

      const metrics = await analyticsDashboard.getUserMetrics();
      expect(metrics.total).toBeGreaterThan(0);
    });
  });

  describe('data persistence integration', () => {
    it('should store and retrieve events', () => {
      eventCollector.initialize('user-storage', { url: 'https://example.com' });
      const eventId = eventCollector.trackPageView('/test');

      eventCollector.once('flush', (events) => {
        for (const event of events) {
          eventStore.store(event);
        }
      });

      eventCollector.flush();

      const storedEvents = eventStore.getByUser('user-storage');
      expect(storedEvents.length).toBeGreaterThan(0);
    });

    it('should query events by date range', () => {
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;

      const event = {
        id: 'query-test-1',
        type: 'page_view' as const,
        category: 'navigation' as const,
        timestamp: now,
        userId: 'user-query',
        sessionId: 'session-query',
        properties: {},
        context: {},
      };

      eventStore.store(event);

      const events = eventStore.getByDateRange({
        start: new Date(dayAgo),
        end: new Date(now + 1000),
      });

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('real-time dashboard integration', () => {
    it('should update real-time metrics', () => {
      realTimeDashboard.trackActiveUser('user-realtime-1');
      realTimeDashboard.trackPageView('/realtime-test', 'user-realtime-1');
      realTimeDashboard.trackEvent('click');

      const metrics = realTimeDashboard.getMetrics();

      expect(metrics.activeUsers).toBeGreaterThan(0);
      expect(metrics.currentPageViews).toBeGreaterThan(0);
    });
  });

  describe('error handling integration', () => {
    it('should handle collector errors gracefully', async () => {
      // Track without initialization
      eventCollector.trackPageView('/error-test');

      const stats = eventCollector.getStats();
      expect(stats).toBeDefined();
    });

    it('should handle empty data in dashboard', async () => {
      const emptyStore = new EventStore();
      const emptyDashboard = new AnalyticsDashboard(
        {
          refreshInterval: 0,
          widgets: [],
          dateRange: { start: new Date(), end: new Date() },
          filters: [],
          exportFormats: [],
        },
        emptyStore,
        userStore,
        sessionCollector
      );

      const metrics = await emptyDashboard.getOverviewMetrics();
      expect(metrics.totalEvents).toBe(0);
    });
  });

  describe('performance integration', () => {
    it('should handle large event volumes efficiently', async () => {
      eventCollector.initialize('user-perf', { url: 'https://example.com' });

      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        eventCollector.trackPageView(`/page-${i}`);
      }

      await eventCollector.flush();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('cleanup', () => {
    it('should properly shutdown all components', async () => {
      await eventCollector.shutdown();
      analyticsDashboard.shutdown();
      insightGenerator.stopAutoRefresh();
      realTimeDashboard.shutdown();

      expect(true).toBe(true);
    });
  });
});
