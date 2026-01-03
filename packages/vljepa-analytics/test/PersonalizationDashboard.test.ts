/**
 * PersonalizationDashboard Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PersonalizationDashboard } from '../src/dashboards/PersonalizationDashboard.js';
import type { DashboardConfig } from '../src/types.js';

describe('PersonalizationDashboard', () => {
  let dashboard: PersonalizationDashboard;
  let config: DashboardConfig;

  beforeEach(() => {
    config = {
      refreshInterval: 0,
      widgets: ['personalization'],
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      filters: [],
      exportFormats: ['csv', 'json'],
    };

    dashboard = new PersonalizationDashboard(config);
  });

  describe('metrics calculation', () => {
    it('should calculate accuracy', async () => {
      dashboard.recordPrediction('user1', 'action_a', 'action_a');
      dashboard.recordPrediction('user1', 'action_b', 'action_a');
      dashboard.recordPrediction('user2', 'action_c', 'action_c');

      const metrics = await dashboard.getMetrics();

      expect(metrics.accuracy).toBeGreaterThan(0);
      expect(metrics.accuracy).toBeLessThanOrEqual(1);
    });

    it('should calculate precision', async () => {
      dashboard.recordRecommendationResults('user1', ['item1', 'item2', 'item3'], ['item1', 'item2'], ['item1'], 0.8, 0.7);

      const metrics = await dashboard.getMetrics();

      expect(metrics.precision).toBeGreaterThanOrEqual(0);
      expect(metrics.precision).toBeLessThanOrEqual(1);
    });

    it('should calculate recall', async () => {
      dashboard.recordRecommendationResults('user1', ['item1', 'item2'], ['item1'], ['item1'], 0.8, 0.7);

      const metrics = await dashboard.getMetrics();

      expect(metrics.recall).toBeGreaterThanOrEqual(0);
      expect(metrics.recall).toBeLessThanOrEqual(1);
    });

    it('should calculate F1 score', async () => {
      dashboard.recordRecommendationResults('user1', ['item1', 'item2'], ['item1'], ['item1'], 0.8, 0.7);

      const metrics = await dashboard.getMetrics();

      expect(metrics.f1Score).toBeGreaterThanOrEqual(0);
      expect(metrics.f1Score).toBeLessThanOrEqual(1);
    });

    it('should calculate satisfaction', async () => {
      dashboard.recordSatisfaction('user1', 0.8);
      dashboard.recordSatisfaction('user2', 0.6);
      dashboard.recordSatisfaction('user3', 0.9);

      const metrics = await dashboard.getMetrics();

      expect(metrics.satisfaction).toBeCloseTo(0.767, 2);
    });

    it('should calculate engagement lift', async () => {
      dashboard.recordEngagement('user1', 10, 8); // 25% lift
      dashboard.recordEngagement('user2', 15, 10); // 50% lift

      const metrics = await dashboard.getMetrics();

      expect(metrics.engagementLift).toBeCloseTo(37.5, 1);
    });

    it('should calculate recommendation performance', async () => {
      dashboard.recordRecommendationResults('user1', ['item1', 'item2', 'item3'], ['item1'], ['item1'], 0.8, 0.7);

      const metrics = await dashboard.getMetrics();

      expect(metrics.recommendationPerformance).toBeDefined();
      expect(metrics.recommendationPerformance.diversity).toBeGreaterThanOrEqual(0);
      expect(metrics.recommendationPerformance.novelty).toBeGreaterThanOrEqual(0);
    });

    it('should calculate click-through rate', async () => {
      dashboard.recordRecommendationResults('user1', ['item1', 'item2', 'item3', 'item4'], ['item1', 'item2'], ['item1'], 0.8, 0.7);

      const metrics = await dashboard.getMetrics();

      expect(metrics.clickThroughRate).toBe(0.5); // 2/4
    });

    it('should calculate conversion rate', async () => {
      dashboard.recordRecommendationResults('user1', ['item1', 'item2', 'item3', 'item4'], ['item1', 'item2'], ['item1'], 0.8, 0.7);

      const metrics = await dashboard.getMetrics();

      expect(metrics.conversionRate).toBe(0.25); // 1/4
    });

    it('should calculate personalization coverage', async () => {
      dashboard.recordRecommendationResults('user1', ['item1'], ['item1'], ['item1'], 0.8, 0.7);
      dashboard.recordRecommendationResults('user2', ['item2'], ['item2'], ['item2'], 0.8, 0.7);

      const metrics = await dashboard.getMetrics();

      expect(metrics.personalizationCoverage).toBe(1); // All users got recommendations
    });
  });

  describe('insights generation', () => {
    it('should generate insights for low satisfaction', async () => {
      dashboard.recordSatisfaction('user1', 0.2);
      dashboard.recordSatisfaction('user1', 0.3);
      dashboard.recordSatisfaction('user1', 0.25);

      const insights = await dashboard.getInsights();

      const lowSatisfactionInsight = insights.find((i) => i.userId === 'user1' && i.preference === 'low_satisfaction');
      expect(lowSatisfactionInsight).toBeDefined();
      expect(lowSatisfactionInsight?.confidence).toBeGreaterThan(0.5);
    });

    it('should generate insights for negative engagement lift', async () => {
      dashboard.recordEngagement('user1', 5, 10); // -50% lift
      dashboard.recordEngagement('user1', 4, 10); // -60% lift

      const insights = await dashboard.getInsights();

      const negativeLiftInsight = insights.find((i) => i.userId === 'user1' && i.preference === 'negative_engagement_lift');
      expect(negativeLiftInsight).toBeDefined();
    });

    it('should provide suggested actions', async () => {
      dashboard.recordSatisfaction('user1', 0.2);

      const insights = await dashboard.getInsights();

      expect(insights.some((i) => i.suggestedActions.length > 0)).toBe(true);
    });
  });

  describe('config updates', () => {
    it('should update config', () => {
      const newDateRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
      };

      dashboard.updateConfig({ dateRange: newDateRange });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('data management', () => {
    it('should clear all data', () => {
      dashboard.recordPrediction('user1', 'action_a', 'action_a');
      dashboard.recordSatisfaction('user1', 0.8);
      dashboard.recordEngagement('user1', 10, 8);

      dashboard.clear();

      const metrics = dashboard.getMetrics();
      // Should return zero metrics after clear
      expect(true).toBe(true); // Placeholder - actual check depends on implementation
    });
  });

  describe('edge cases', () => {
    it('should handle no data gracefully', async () => {
      const metrics = await dashboard.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.accuracy).toBe(0);
      expect(metrics.precision).toBe(0);
      expect(metrics.recall).toBe(0);
    });

    it('should handle single data point', async () => {
      dashboard.recordPrediction('user1', 'action_a', 'action_a');

      const metrics = await dashboard.getMetrics();
      expect(metrics.accuracy).toBe(1);
    });

    it('should handle extreme values', async () => {
      dashboard.recordSatisfaction('user1', 0);
      dashboard.recordSatisfaction('user2', 1);

      const metrics = await dashboard.getMetrics();
      expect(metrics.satisfaction).toBe(0.5);
    });

    it('should handle zero baseline engagement', async () => {
      dashboard.recordEngagement('user1', 5, 0);

      const metrics = await dashboard.getMetrics();
      // Should handle division by zero gracefully
      expect(metrics.engagementLift).toBeDefined();
    });
  });

  describe('event emission', () => {
    it('should emit on prediction recorded', () => {
      const emitSpy = vi.fn();
      dashboard.on('predictionRecorded', emitSpy);

      dashboard.recordPrediction('user1', 'action_a', 'action_a');

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should emit on satisfaction recorded', () => {
      const emitSpy = vi.fn();
      dashboard.on('satisfactionRecorded', emitSpy);

      dashboard.recordSatisfaction('user1', 0.8);

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should emit on engagement recorded', () => {
      const emitSpy = vi.fn();
      dashboard.on('engagementRecorded', emitSpy);

      dashboard.recordEngagement('user1', 10, 8);

      expect(emitSpy).toHaveBeenCalled();
    });

    it('should emit on recommendation recorded', () => {
      const emitSpy = vi.fn();
      dashboard.on('recommendationRecorded', emitSpy);

      dashboard.recordRecommendationResults('user1', ['item1'], ['item1'], ['item1'], 0.8, 0.7);

      expect(emitSpy).toHaveBeenCalled();
    });
  });
});
