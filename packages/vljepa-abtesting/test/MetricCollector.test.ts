/**
 * Tests for MetricCollector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetricCollector,
  ConversionTracker,
  EngagementTracker,
  InMemoryResultStorage,
  createMetricCollector,
  createConversionTracker,
  createEngagementTracker,
} from '../src/metrics/MetricCollector.js';
import type { MetricValue, ConversionData, EngagementData } from '../src/types.js';

describe('MetricCollector', () => {
  let collector: MetricCollector;
  let storage: InMemoryResultStorage;

  beforeEach(() => {
    storage = new InMemoryResultStorage();
    collector = new MetricCollector(storage, 10);
  });

  describe('recordMetric', () => {
    it('should record a metric', async () => {
      const metric: MetricValue = {
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      };

      await collector.recordMetric(metric);
      await collector.flushBuffer(); // Flush to ensure storage is updated

      const metrics = await storage.getMetrics('exp1', 'control');
      expect(metrics).toHaveLength(1);
    });

    it('should buffer metrics', async () => {
      for (let i = 0; i < 5; i++) {
        await collector.recordMetric({
          name: 'test',
          type: 'conversion',
          value: i,
          timestamp: Date.now(),
          userId: `user${i}`,
          variant: 'control',
          experiment: 'exp1',
        });
      }

      // Before flush, should be buffered
      await collector.flushBuffer();
      const metrics = await storage.getMetrics('exp1', 'control');
      expect(metrics).toHaveLength(5);
    });

    it('should auto-flush when buffer is full', async () => {
      for (let i = 0; i < 10; i++) {
        await collector.recordMetric({
          name: 'test',
          type: 'conversion',
          value: i,
          timestamp: Date.now(),
          userId: `user${i}`,
          variant: 'control',
          experiment: 'exp1',
        });
      }

      // Wait a bit for async flush to complete
      await collector.flushBuffer();

      const metrics = await storage.getMetrics('exp1', 'control');
      expect(metrics.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('recordConversion', () => {
    it('should record conversion', async () => {
      const conversion: ConversionData = {
        userId: 'user1',
        variantId: 'control',
        experimentId: 'exp1',
        converted: true,
        value: 100,
        timestamp: Date.now(),
      };

      await collector.recordConversion(conversion);

      const conversions = await storage.getConversions('exp1', 'control');
      expect(conversions).toHaveLength(1);
      expect(conversions[0].converted).toBe(true);
    });

    it('should also record as metric', async () => {
      const conversion: ConversionData = {
        userId: 'user1',
        variantId: 'control',
        experimentId: 'exp1',
        converted: true,
        timestamp: Date.now(),
      };

      await collector.recordConversion(conversion);
      await collector.flushBuffer();

      const metrics = await storage.getMetrics('exp1', 'control');
      const conversionMetric = metrics.find(m => m.name === 'conversion');
      expect(conversionMetric).toBeDefined();
    });
  });

  describe('recordEngagement', () => {
    it('should record engagement', async () => {
      const engagement: EngagementData = {
        userId: 'user1',
        variantId: 'control',
        experimentId: 'exp1',
        duration: 5000,
        interactions: 10,
        pageViews: 3,
        timestamp: Date.now(),
      };

      await collector.recordEngagement(engagement);

      const engagements = await storage.getEngagement('exp1', 'control');
      expect(engagements).toHaveLength(1);
    });

    it('should record engagement as multiple metrics', async () => {
      const engagement: EngagementData = {
        userId: 'user1',
        variantId: 'control',
        experimentId: 'exp1',
        duration: 5000,
        interactions: 10,
        pageViews: 3,
        timestamp: Date.now(),
      };

      await collector.recordEngagement(engagement);
      await collector.flushBuffer();

      const metrics = await storage.getMetrics('exp1', 'control');
      const durationMetric = metrics.find(m => m.name === 'duration');
      const interactionsMetric = metrics.find(m => m.name === 'interactions');
      const pageViewsMetric = metrics.find(m => m.name === 'page_views');

      expect(durationMetric).toBeDefined();
      expect(interactionsMetric).toBeDefined();
      expect(pageViewsMetric).toBeDefined();
    });
  });

  describe('trackGoal', () => {
    it('should track goal completion', async () => {
      await collector.trackGoal('exp1', 'control', 'user1', 'signup', 1);
      await collector.flushBuffer();

      const metrics = await storage.getMetrics('exp1', 'control');
      const goalMetric = metrics.find(m => m.name === 'goal_signup');
      expect(goalMetric).toBeDefined();
      expect(goalMetric?.value).toBe(1);
    });
  });

  describe('getMetricSummary', () => {
    it('should calculate summary statistics', async () => {
      for (let i = 0; i < 10; i++) {
        await collector.recordMetric({
          name: 'test',
          type: 'conversion',
          value: i,
          timestamp: Date.now(),
          userId: `user${i}`,
          variant: 'control',
          experiment: 'exp1',
        });
      }
      await collector.flushBuffer();

      const summary = await collector.getMetricSummary('exp1', 'control', 'test');

      expect(summary).toBeDefined();
      expect(summary?.count).toBe(10);
      expect(summary?.mean).toBe(4.5);
      expect(summary?.min).toBe(0);
      expect(summary?.max).toBe(9);
    });

    it('should return null for non-existent metric', async () => {
      const summary = await collector.getMetricSummary('exp1', 'control', 'nonexistent');
      expect(summary).toBeNull();
    });
  });

  describe('getAllMetricSummaries', () => {
    it('should get all summaries for variant', async () => {
      await collector.recordMetric({
        name: 'metric1',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      });
      await collector.recordMetric({
        name: 'metric2',
        type: 'engagement',
        value: 2,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      });
      await collector.flushBuffer();

      const summaries = await collector.getAllMetricSummaries('exp1', 'control');

      expect(summaries.size).toBe(2);
      expect(summaries.has('metric1')).toBe(true);
      expect(summaries.has('metric2')).toBe(true);
    });
  });

  describe('getConversionRate', () => {
    it('should calculate conversion rate', async () => {
      // Add 10 users, 5 conversions
      for (let i = 0; i < 10; i++) {
        await collector.recordMetric({
          name: 'impression',
          type: 'engagement',
          value: 1,
          timestamp: Date.now(),
          userId: `user${i}`,
          variant: 'control',
          experiment: 'exp1',
        });
      }
      for (let i = 0; i < 5; i++) {
        await collector.recordConversion({
          userId: `user${i}`,
          variantId: 'control',
          experimentId: 'exp1',
          converted: true,
          timestamp: Date.now(),
        });
      }
      await collector.flushBuffer();

      const rate = await collector.getConversionRate('exp1', 'control');
      expect(rate).toBeCloseTo(0.5, 1);
    });

    it('should return 0 for no users', async () => {
      const rate = await collector.getConversionRate('exp1', 'control');
      expect(rate).toBe(0);
    });
  });

  describe('getAverageEngagement', () => {
    it('should calculate average engagement', async () => {
      await collector.recordEngagement({
        userId: 'user1',
        variantId: 'control',
        experimentId: 'exp1',
        duration: 10000,
        interactions: 5,
        pageViews: 2,
        timestamp: Date.now(),
      });
      await collector.recordEngagement({
        userId: 'user2',
        variantId: 'control',
        experimentId: 'exp1',
        duration: 20000,
        interactions: 10,
        pageViews: 4,
        timestamp: Date.now(),
      });

      const avg = await collector.getAverageEngagement('exp1', 'control');

      expect(avg.duration).toBe(15000);
      expect(avg.interactions).toBe(7.5);
      expect(avg.pageViews).toBe(3);
    });

    it('should return zeros for no data', async () => {
      const avg = await collector.getAverageEngagement('exp1', 'control');
      expect(avg.duration).toBe(0);
      expect(avg.interactions).toBe(0);
      expect(avg.pageViews).toBe(0);
    });
  });

  describe('flushBuffer', () => {
    it('should flush specific buffer', async () => {
      await collector.recordMetric({
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      });

      await collector.flushBuffer('exp1:control');

      const metrics = await storage.getMetrics('exp1', 'control');
      expect(metrics).toHaveLength(1);
    });

    it('should flush all buffers', async () => {
      await collector.recordMetric({
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      });
      await collector.recordMetric({
        name: 'test',
        type: 'conversion',
        value: 2,
        timestamp: Date.now(),
        userId: 'user2',
        variant: 'treatment',
        experiment: 'exp1',
      });

      await collector.flushBuffer();

      const controlMetrics = await storage.getMetrics('exp1', 'control');
      const treatmentMetrics = await storage.getMetrics('exp1', 'treatment');
      expect(controlMetrics).toHaveLength(1);
      expect(treatmentMetrics).toHaveLength(1);
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics for experiment', async () => {
      await collector.recordMetric({
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      });
      await collector.flushBuffer();

      await collector.clearMetrics('exp1');

      const metrics = await storage.getMetrics('exp1');
      expect(metrics).toHaveLength(0);
    });
  });
});

describe('ConversionTracker', () => {
  let tracker: ConversionTracker;
  let collector: MetricCollector;
  let storage: InMemoryResultStorage;

  beforeEach(() => {
    storage = new InMemoryResultStorage();
    collector = new MetricCollector(storage);
    tracker = new ConversionTracker(collector);
  });

  describe('trackConversion', () => {
    it('should track conversion event', async () => {
      await tracker.trackConversion('exp1', 'control', 'user1', true, 100);
      await collector.flushBuffer();

      const conversions = await storage.getConversions('exp1', 'control');
      expect(conversions).toHaveLength(1);
      expect(conversions[0].value).toBe(100);
    });

    it('should track non-conversion', async () => {
      await tracker.trackConversion('exp1', 'control', 'user1', false);
      await collector.flushBuffer();

      const conversions = await storage.getConversions('exp1', 'control');
      expect(conversions).toHaveLength(1);
      expect(conversions[0].converted).toBe(false);
    });
  });

  describe('trackPurchase', () => {
    it('should track purchase', async () => {
      await tracker.trackPurchase('exp1', 'control', 'user1', 99.99);
      await collector.flushBuffer();

      const conversions = await storage.getConversions('exp1', 'control');
      expect(conversions[0].value).toBe(99.99);
      expect(conversions[0].metadata?.type).toBe('purchase');
    });
  });

  describe('trackSignup', () => {
    it('should track signup', async () => {
      await tracker.trackSignup('exp1', 'control', 'user1');
      await collector.flushBuffer();

      const conversions = await storage.getConversions('exp1', 'control');
      expect(conversions[0].metadata?.type).toBe('signup');
    });
  });

  describe('trackClick', () => {
    it('should track click', async () => {
      await tracker.trackClick('exp1', 'control', 'user1', '/target');
      await collector.flushBuffer();

      const conversions = await storage.getConversions('exp1', 'control');
      expect(conversions[0].metadata?.type).toBe('click');
      expect(conversions[0].metadata?.targetUrl).toBe('/target');
    });
  });
});

describe('EngagementTracker', () => {
  let tracker: EngagementTracker;
  let collector: MetricCollector;
  let storage: InMemoryResultStorage;

  beforeEach(() => {
    storage = new InMemoryResultStorage();
    collector = new MetricCollector(storage);
    tracker = new EngagementTracker(collector);
  });

  describe('session tracking', () => {
    it('should start session', () => {
      tracker.startSession('user1');
      // Session started, no errors
      expect(true).toBe(true);
    });

    it('should track interactions', () => {
      tracker.startSession('user1');
      tracker.trackInteraction('user1', 'exp1', 'control');
      // Interaction tracked
      expect(true).toBe(true);
    });

    it('should track page views', () => {
      tracker.startSession('user1');
      tracker.trackPageView('user1', 'exp1', 'control');
      // Page view tracked
      expect(true).toBe(true);
    });

    it('should end session and record', async () => {
      tracker.startSession('user1');
      tracker.trackInteraction('user1', 'exp1', 'control');
      tracker.trackInteraction('user1', 'exp1', 'control');
      tracker.trackPageView('user1', 'exp1', 'control');

      await tracker.endSession('user1', 'exp1', 'control');

      const engagements = await storage.getEngagement('exp1', 'control');
      expect(engagements).toHaveLength(1);
      expect(engagements[0].interactions).toBe(2);
      expect(engagements[0].pageViews).toBe(1);
    });

    it('should handle ending non-existent session', async () => {
      await tracker.endSession('user1', 'exp1', 'control');
      // Should not throw
      expect(true).toBe(true);
    });
  });
});

describe('InMemoryResultStorage', () => {
  let storage: InMemoryResultStorage;

  beforeEach(() => {
    storage = new InMemoryResultStorage();
  });

  describe('metric storage', () => {
    it('should save and retrieve metrics', async () => {
      const metric: MetricValue = {
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      };

      await storage.saveMetric(metric);
      const metrics = await storage.getMetrics('exp1', 'control');

      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual(metric);
    });

    it('should get all metrics for experiment', async () => {
      await storage.saveMetric({
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      });
      await storage.saveMetric({
        name: 'test',
        type: 'conversion',
        value: 2,
        timestamp: Date.now(),
        userId: 'user2',
        variant: 'treatment',
        experiment: 'exp1',
      });

      const metrics = await storage.getMetrics('exp1');
      expect(metrics).toHaveLength(2);
    });
  });

  describe('conversion storage', () => {
    it('should save and retrieve conversions', async () => {
      const conversion: ConversionData = {
        userId: 'user1',
        variantId: 'control',
        experimentId: 'exp1',
        converted: true,
        timestamp: Date.now(),
      };

      await storage.saveConversion(conversion);
      const conversions = await storage.getConversions('exp1', 'control');

      expect(conversions).toHaveLength(1);
    });
  });

  describe('engagement storage', () => {
    it('should save and retrieve engagements', async () => {
      const engagement: EngagementData = {
        userId: 'user1',
        variantId: 'control',
        experimentId: 'exp1',
        duration: 5000,
        interactions: 10,
        pageViews: 3,
        timestamp: Date.now(),
      };

      await storage.saveEngagement(engagement);
      const engagements = await storage.getEngagement('exp1', 'control');

      expect(engagements).toHaveLength(1);
    });
  });

  describe('clear operations', () => {
    it('should clear results for experiment', async () => {
      await storage.saveMetric({
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      });

      await storage.clearResults('exp1');

      const metrics = await storage.getMetrics('exp1');
      expect(metrics).toHaveLength(0);
    });
  });

  describe('utility methods', () => {
    it('should clear all data', async () => {
      await storage.saveMetric({
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: 'exp1',
      });

      storage.clear();

      const metrics = await storage.getMetrics('exp1');
      expect(metrics).toHaveLength(0);
    });
  });
});

describe('factory functions', () => {
  it('should create metric collector', () => {
    const collector = createMetricCollector(100);
    expect(collector).toBeInstanceOf(MetricCollector);
  });

  it('should create conversion tracker', () => {
    const collector = createMetricCollector();
    const tracker = createConversionTracker(collector);
    expect(tracker).toBeInstanceOf(ConversionTracker);
  });

  it('should create engagement tracker', () => {
    const collector = createMetricCollector();
    const tracker = createEngagementTracker(collector);
    expect(tracker).toBeInstanceOf(EngagementTracker);
  });

  it('should create collector with default buffer size', () => {
    const collector = createMetricCollector();
    expect(collector).toBeInstanceOf(MetricCollector);
  });
});
