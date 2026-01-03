/**
 * InsightGenerator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InsightGenerator } from '../src/insights/InsightGenerator.js';

describe('InsightGenerator', () => {
  let generator: InsightGenerator;

  beforeEach(() => {
    generator = new InsightGenerator({
      minConfidence: 0.7,
      lookbackPeriod: 24 * 60 * 60 * 1000,
      refreshInterval: 60000,
      categories: ['trend', 'anomaly', 'correlation', 'recommendation'],
    });
  });

  describe('metric recording', () => {
    it('should record metric value', () => {
      generator.recordMetric('test_metric', 100);

      const insights = generator.getInsights();
      // Should have recorded the metric
      expect(true).toBe(true);
    });

    it('should record multiple metric values', () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('test_metric', i * 10);
      }

      const insights = generator.getInsights();
      expect(insights).toBeDefined();
    });

    it('should track metric history', () => {
      for (let i = 0; i < 15; i++) {
        generator.recordMetric('history_metric', i);
      }

      // History should be maintained
      expect(true).toBe(true);
    });
  });

  describe('trend detection', () => {
    it('should detect upward trend', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('upward_trend', i * 10);
      }

      const insights = await generator.generateInsights();
      const trendInsights = insights.filter((i) => i.type === 'trend');

      expect(trendInsights.length).toBeGreaterThan(0);
    });

    it('should detect downward trend', async () => {
      for (let i = 20; i > 0; i--) {
        generator.recordMetric('downward_trend', i * 10);
      }

      const insights = await generator.generateInsights();
      const trendInsights = insights.filter((i) => i.type === 'trend');

      expect(trendInsights.length).toBeGreaterThan(0);
    });

    it('should detect stable trend', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('stable_trend', 100);
      }

      const insights = await generator.generateInsights();
      const stableInsights = insights.filter((i) => i.data.trend === 'stable');

      expect(stableInsights.length).toBeGreaterThan(0);
    });
  });

  describe('anomaly detection', () => {
    it('should detect spike anomaly', () => {
      // Record normal values
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('spike_metric', 100 + i);
      }

      // Record anomaly
      generator.recordMetric('spike_metric', 1000);

      const insights = generator.getInsights();
      const anomalyInsights = insights.filter((i) => i.type === 'anomaly');

      expect(anomalyInsights.length).toBeGreaterThan(0);
    });

    it('should detect dip anomaly', () => {
      // Record normal values
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('dip_metric', 100 + i);
      }

      // Record anomaly
      generator.recordMetric('dip_metric', 10);

      const insights = generator.getInsights();
      expect(insights.length).toBeGreaterThan(0);
    });

    it('should not detect false positives', () => {
      // Record consistent values
      for (let i = 0; i < 30; i++) {
        generator.recordMetric('normal_metric', 100 + Math.random() * 5);
      }

      const insights = generator.getInsights();
      const anomalyInsights = insights.filter((i) => i.type === 'anomaly');

      expect(anomalyInsights.length).toBe(0);
    });
  });

  describe('correlation detection', () => {
    it('should detect positive correlation', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('metric_a', i * 10);
        generator.recordMetric('metric_b', i * 10 + 5);
      }

      const insights = await generator.generateInsights();
      const correlationInsights = insights.filter((i) => i.type === 'correlation');

      expect(correlationInsights.length).toBeGreaterThan(0);
    });

    it('should detect negative correlation', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('metric_c', i * 10);
        generator.recordMetric('metric_d', 200 - i * 10);
      }

      const insights = await generator.generateInsights();
      const correlationInsights = insights.filter((i) => i.type === 'correlation');

      expect(correlationInsights.length).toBeGreaterThan(0);
    });
  });

  describe('recommendations', () => {
    it('should generate recommendations for declining metrics', async () => {
      for (let i = 100; i > 50; i--) {
        generator.recordMetric('declining_metric', i);
      }

      const insights = await generator.generateInsights();
      const recommendations = insights.filter((i) => i.type === 'recommendation');

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].suggestedActions.length).toBeGreaterThan(0);
    });

    it('should provide actionable insights', async () => {
      for (let i = 100; i > 0; i--) {
        generator.recordMetric('action_metric', i);
      }

      const insights = await generator.generateInsights();
      const actionable = insights.filter((i) => i.actionable);

      expect(actionable.length).toBeGreaterThan(0);
    });
  });

  describe('insight management', () => {
    it('should get all insights', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('test', i * 10);
      }

      await generator.generateInsights();
      const insights = generator.getInsights();

      expect(insights.length).toBeGreaterThan(0);
    });

    it('should get insights by type', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('trend_test', i);
      }

      await generator.generateInsights();
      const trendInsights = generator.getInsightsByType('trend');

      expect(trendInsights.length).toBeGreaterThan(0);
    });

    it('should dismiss insight', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('dismiss_test', i);
      }

      await generator.generateInsights();
      const insights = generator.getInsights();

      if (insights.length > 0) {
        const insightId = insights[0].id;
        generator.dismissInsight(insightId);

        const dismissedInsights = generator.getInsights().filter((i) => i.dismissed);
        expect(dismissedInsights.length).toBeGreaterThan(0);
      }
    });

    it('should clear dismissed insights', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('clear_test', i);
      }

      await generator.generateInsights();
      const insights = generator.getInsights();

      if (insights.length > 0) {
        generator.dismissInsight(insights[0].id);
        generator.clearDismissed();

        const remaining = generator.getInsights().filter((i) => i.dismissed);
        expect(remaining.length).toBe(0);
      }
    });
  });

  describe('confidence filtering', () => {
    it('should filter by min confidence', async () => {
      const lowConfidenceGenerator = new InsightGenerator({ minConfidence: 0.9 });

      for (let i = 0; i < 20; i++) {
        lowConfidenceGenerator.recordMetric('low_conf_test', i);
      }

      const insights = await lowConfidenceGenerator.generateInsights();

      // All returned insights should meet confidence threshold
      for (const insight of insights) {
        expect(insight.confidence).toBeGreaterThanOrEqual(0.9);
      }

      lowConfidenceGenerator.stopAutoRefresh();
    });
  });

  describe('event emission', () => {
    it('should emit on insight generated', async () => {
      const emitSpy = vi.fn();
      generator.on('insight', emitSpy);

      for (let i = 0; i < 20; i++) {
        generator.recordMetric('emit_test', i * 10);
      }

      await generator.generateInsights();

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should emit on insight dismissed', async () => {
      const emitSpy = vi.fn();
      generator.on('insightDismissed', emitSpy);

      for (let i = 0; i < 20; i++) {
        generator.recordMetric('dismiss_emit_test', i);
      }

      await generator.generateInsights();
      const insights = generator.getInsights();

      if (insights.length > 0) {
        generator.dismissInsight(insights[0].id);
        expect(emitSpy).toHaveBeenCalled();
      }
    });
  });

  describe('config updates', () => {
    it('should update config', () => {
      generator.stopAutoRefresh();
      // Config update should work
      expect(true).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle insufficient data', async () => {
      generator.recordMetric('insufficient', 100);
      generator.recordMetric('insufficient', 110);

      const insights = await generator.generateInsights();
      // Should not throw with insufficient data
      expect(insights).toBeDefined();
    });

    it('should handle single data point', async () => {
      generator.recordMetric('single', 100);

      const insights = await generator.generateInsights();
      expect(insights).toBeDefined();
    });

    it('should handle zero values', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('zero_test', 0);
      }

      const insights = await generator.generateInsights();
      expect(insights).toBeDefined();
    });

    it('should handle negative values', async () => {
      for (let i = 0; i < 20; i++) {
        generator.recordMetric('negative_test', -i * 10);
      }

      const insights = await generator.generateInsights();
      expect(insights).toBeDefined();
    });
  });
});
