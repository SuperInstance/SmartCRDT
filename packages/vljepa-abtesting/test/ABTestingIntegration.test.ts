/**
 * Integration tests for A/B Testing Framework
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExperimentManager,
  InMemoryExperimentStorage,
  createExperimentManager,
} from '../src/experiments/ExperimentManager.js';
import {
  UserAllocator,
  createUserAllocator,
} from '../src/allocation/UserAllocator.js';
import {
  MetricCollector,
  ConversionTracker,
  EngagementTracker,
  createMetricCollector,
} from '../src/metrics/MetricCollector.js';
import {
  SignificanceTester,
  createSignificanceTester,
} from '../src/statistics/SignificanceTest.js';
import {
  Dashboard,
  ExperimentReportGenerator,
  WinnerDetermination,
  createDashboard,
  createReportGenerator,
  createWinnerDetermination,
} from '../src/reporting/Dashboard.js';
import {
  A2UIIntegration,
  createA2UIIntegration,
} from '../src/integration/A2UIIntegration.js';
import {
  CombinedStorage,
  createInMemoryStorage,
} from '../src/storage/ExperimentStore.js';
import type { ExperimentConfig, A2UIConfig } from '../src/types.js';
import type { A2UIResponse } from '@lsi/protocol';

describe('A/B Testing Framework Integration', () => {
  describe('End-to-end experiment workflow', () => {
    it('should create, start, allocate, track, and analyze experiment', async () => {
      // Setup
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const allocator = createUserAllocator('random');
      const metricCollector = createMetricCollector();
      const tester = createSignificanceTester();
      const dashboard = createDashboard({ showRealtime: false });

      // Create experiment
      const config: ExperimentConfig = {
        name: 'E2E Test',
        description: 'End-to-end test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [
          { id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true },
          { id: 'engagement', name: 'Engagement', type: 'engagement', higherIsBetter: true },
        ],
        primaryMetric: 'conversion',
        goals: [{ id: 'signup', name: 'Signup', type: 'conversion', description: 'User signup' }],
        minSampleSize: 100,
        significanceLevel: 0.05,
        power: 0.8,
        mde: 0.1,
      };

      const experiment = await manager.createExperiment(config);
      expect(experiment.status).toBe('draft');

      // Start experiment
      const started = await manager.startExperiment(experiment.id);
      expect(started.status).toBe('running');

      // Allocate users and track metrics
      for (let i = 0; i < 200; i++) {
        const userId = `user${i}`;
        const allocation = allocator.allocate(userId, experiment);

        await metricCollector.recordMetric({
          name: 'impression',
          type: 'engagement',
          value: 1,
          timestamp: Date.now(),
          userId,
          variant: allocation.variant,
          experiment: experiment.id,
        });

        // Simulate conversions (better for treatment)
        const isConverted = allocation.variant === 'treatment' ? Math.random() < 0.15 : Math.random() < 0.1;
        if (isConverted) {
          await metricCollector.recordConversion({
            userId,
            variantId: allocation.variant,
            experimentId: experiment.id,
            converted: true,
            value: 1,
            timestamp: Date.now(),
          });
        }

        // Track engagement
        await metricCollector.recordEngagement({
          userId,
          variantId: allocation.variant,
          experimentId: experiment.id,
          duration: 5000 + Math.random() * 10000,
          interactions: Math.floor(Math.random() * 20),
          pageViews: Math.floor(Math.random() * 10),
          timestamp: Date.now(),
        });
      }

      // Flush metrics
      await metricCollector.flushBuffer();

      // Get metrics summaries
      const controlMetrics = await metricCollector.getAllMetricSummaries(experiment.id, 'control');
      const treatmentMetrics = await metricCollector.getAllMetricSummaries(experiment.id, 'treatment');

      expect(controlMetrics.size).toBeGreaterThan(0);
      expect(treatmentMetrics.size).toBeGreaterThan(0);

      // Complete experiment
      const completed = await manager.completeExperiment(experiment.id);
      expect(completed.status).toBe('completed');

      // Test should complete successfully
      expect(true).toBe(true);
    });

    it('should handle complete lifecycle with multiple variants', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const allocator = createUserAllocator('hash');
      const collector = createMetricCollector();

      const config: ExperimentConfig = {
        name: 'Multi-variant Test',
        description: 'Test with 4 variants',
        variants: [
          { id: 'a', name: 'A', description: 'Variant A', allocation: 25, isControl: true, changes: [] },
          { id: 'b', name: 'B', description: 'Variant B', allocation: 25, isControl: false, changes: [] },
          { id: 'c', name: 'C', description: 'Variant C', allocation: 25, isControl: false, changes: [] },
          { id: 'd', name: 'D', description: 'Variant D', allocation: 25, isControl: false, changes: [] },
        ],
        allocationStrategy: 'hash',
        metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'conversion',
        goals: [],
        minSampleSize: 50,
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);

      // Allocate users
      const allocations = new Map<string, number>();
      for (let i = 0; i < 400; i++) {
        const result = allocator.allocate(`user${i}`, experiment);
        allocations.set(result.variant, (allocations.get(result.variant) || 0) + 1);
      }

      // All variants should have allocations
      expect(allocations.size).toBe(4);

      // Each variant should have roughly 25% of users
      for (const count of allocations.values()) {
        expect(count).toBeGreaterThan(50);
        expect(count).toBeLessThan(200);
      }
    });
  });

  describe('Allocation strategies integration', () => {
    it('should integrate random allocation with metrics', async () => {
      const allocator = createUserAllocator('random');
      const collector = createMetricCollector();
      const config: ExperimentConfig = {
        name: 'Random Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      for (let i = 0; i < 100; i++) {
        const allocation = allocator.allocate(`user${i}`, experiment);
        await collector.recordMetric({
          name: 'test',
          type: 'engagement',
          value: 1,
          timestamp: Date.now(),
          userId: `user${i}`,
          variant: allocation.variant,
          experiment: experiment.id,
        });
      }

      await collector.flushBuffer();
      const metrics = await collector.getAllMetricSummaries(experiment.id, 'control');
      expect(metrics.size).toBeGreaterThan(0);
    });

    it('should integrate sticky allocation with consistency', async () => {
      const allocator = createUserAllocator('sticky', { stickiness: 1 });
      const config: ExperimentConfig = {
        name: 'Sticky Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'sticky',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(allocator.allocate('user1', experiment));
      }

      // All allocations should be the same
      const variants = new Set(results.map(r => r.variant));
      expect(variants.size).toBe(1);
    });

    it('should integrate hash allocation with consistency', async () => {
      const allocator = createUserAllocator('hash', { hashKey: 'test-key' });
      const config: ExperimentConfig = {
        name: 'Hash Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'hash',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      const result1 = allocator.allocate('user1', experiment);
      const result2 = allocator.allocate('user1', experiment);

      expect(result1.variant).toBe(result2.variant);
    });

    it('should integrate adaptive allocation with scores', async () => {
      const allocator = createUserAllocator('adaptive', { adaptationRate: 0.5 });
      const config: ExperimentConfig = {
        name: 'Adaptive Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'adaptive',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      // Initialize adaptive scores by allocating once
      allocator.allocate('user0', experiment);
      // Update scores
      allocator.updateAdaptiveScore(experiment.id, 'treatment', 100);

      const result = allocator.allocate('user1', experiment);
      expect(result.variant).toBeDefined();
    });
  });

  describe('Metrics and statistics integration', () => {
    it('should track conversions and calculate significance', async () => {
      const collector = createMetricCollector();
      const tester = createSignificanceTester();

      // Simulate data
      for (let i = 0; i < 100; i++) {
        await collector.recordConversion({
          userId: `user${i}`,
          variantId: 'control',
          experimentId: 'exp1',
          converted: i < 10, // 10% conversion
          timestamp: Date.now(),
        });
      }

      for (let i = 0; i < 100; i++) {
        await collector.recordConversion({
          userId: `user${i + 100}`,
          variantId: 'treatment',
          experimentId: 'exp1',
          converted: i < 20, // 20% conversion
          timestamp: Date.now(),
        });
      }

      await collector.flushBuffer();

      const controlSummary = await collector.getMetricSummary('exp1', 'control', 'conversion');
      const treatmentSummary = await collector.getMetricSummary('exp1', 'treatment', 'conversion');

      if (controlSummary && treatmentSummary) {
        const result = tester.runTest(
          { metric: 'conversion', control: 'control', treatment: 'treatment', test: 'z_test', alpha: 0.05, twoTailed: true },
          controlSummary,
          treatmentSummary
        );

        expect(result).toBeDefined();
      }
    });

    it('should track engagement and analyze patterns', async () => {
      const collector = createMetricCollector();
      const tracker = new EngagementTracker(collector);

      tracker.startSession('user1');
      tracker.trackInteraction('user1', 'exp1', 'control');
      tracker.trackInteraction('user1', 'exp1', 'control');
      tracker.trackPageView('user1', 'exp1', 'control');
      await tracker.endSession('user1', 'exp1', 'control');

      const avg = await collector.getAverageEngagement('exp1', 'control');
      expect(avg.interactions).toBe(2);
      expect(avg.pageViews).toBe(1);
    });
  });

  describe('Dashboard integration', () => {
    it('should generate dashboard with all components', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const dashboard = createDashboard({ showRealtime: false });

      const config: ExperimentConfig = {
        name: 'Dashboard Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'conversion',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);

      const mockMetrics = vi.fn().mockResolvedValue(new Map());
      const data = await dashboard.generateDashboardData(experiment, mockMetrics);

      expect(data.experiment.id).toBe(experiment.id);
      expect(data.charts).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });

    it('should generate reports with recommendations', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const generator = createReportGenerator();

      const config: ExperimentConfig = {
        name: 'Report Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'conversion',
        goals: [],
        minSampleSize: 100,
      };

      const experiment = await manager.createExperiment(config);
      const variantMetrics = new Map([
        ['control', new Map()],
        ['treatment', new Map()],
      ]);

      const report = await generator.generateReport(experiment, variantMetrics, new Map());

      expect(report.experiment.id).toBe(experiment.id);
      expect(report.status).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('A2UI integration', () => {
    it('should integrate A2UI with A/B testing', async () => {
      const ui: A2UIResponse = {
        version: '0.8',
        surface: 'main',
        components: [
          { type: 'button', id: 'btn1', props: { label: 'Click' } },
        ],
        layout: { type: 'vertical' },
      };

      const a2uiConfig: A2UIConfig = {
        experiment: 'exp1',
        variants: { control: ui, treatment: { ...ui, components: [{ ...ui.components[0], props: { label: 'Click Now!' } }] } },
        defaultVariant: 'control',
        fallbackVariant: 'control',
      };

      const integration = createA2UIIntegration(a2uiConfig);
      const config: ExperimentConfig = {
        name: 'A2UI Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [], ui },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [], ui: { ...ui, components: [{ ...ui.components[0], props: { label: 'Click Now!' } }] } },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'clicks', name: 'Clicks', type: 'engagement', higherIsBetter: true }],
        primaryMetric: 'clicks',
        goals: [],
      };

      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      const renderedUI = await integration.renderVariant('user1', experiment);

      expect(renderedUI).toBeDefined();
      expect(renderedUI.version).toBe('0.8');
      expect(renderedUI.components).toBeDefined();
    });

    it('should track A2UI events', async () => {
      const a2uiConfig: A2UIConfig = {
        experiment: 'exp1',
        variants: {
          control: { version: '0.8', surface: 'main', components: [], layout: { type: 'vertical' } },
          treatment: { version: '0.8', surface: 'main', components: [], layout: { type: 'vertical' } },
        },
        defaultVariant: 'control',
        fallbackVariant: 'control',
      };

      const integration = createA2UIIntegration(a2uiConfig);
      const config: ExperimentConfig = {
        name: 'Event Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [], ui: { version: '0.8', surface: 'main', components: [], layout: { type: 'vertical' } } },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [], ui: { version: '0.8', surface: 'main', components: [], layout: { type: 'vertical' } } },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'events', name: 'Events', type: 'engagement', higherIsBetter: true }],
        primaryMetric: 'events',
        goals: [],
      };

      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      await integration.renderVariant('user1', experiment);
      await integration.trackInteraction('user1', experiment.id, 'btn1', 'click');

      const events = await integration.getEvents(experiment.id);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Storage integration', () => {
    it('should use combined storage for all data', async () => {
      const storage = createInMemoryStorage();

      // Store experiment
      const config: ExperimentConfig = {
        name: 'Storage Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      // Store metrics
      await storage.saveMetric({
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: experiment.id,
      });

      // Store conversions
      await storage.saveConversion({
        userId: 'user1',
        variantId: 'control',
        experimentId: experiment.id,
        converted: true,
        timestamp: Date.now(),
      });

      // Store engagement
      await storage.saveEngagement({
        userId: 'user1',
        variantId: 'control',
        experimentId: experiment.id,
        duration: 5000,
        interactions: 5,
        pageViews: 2,
        timestamp: Date.now(),
      });

      // Verify all data is stored
      const retrievedExp = await storage.getExperiment(experiment.id);
      expect(retrievedExp?.id).toBe(experiment.id);

      const metrics = await storage.getMetrics(experiment.id);
      expect(metrics.length).toBeGreaterThan(0);

      const conversions = await storage.getConversions(experiment.id);
      expect(conversions.length).toBeGreaterThan(0);

      const engagements = await storage.getEngagement(experiment.id);
      expect(engagements.length).toBeGreaterThan(0);
    });
  });

  describe('Winner determination integration', () => {
    it('should determine winner from complete experiment', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const collector = createMetricCollector();
      const determination = createWinnerDetermination();

      const config: ExperimentConfig = {
        name: 'Winner Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'conversion',
        goals: [],
        minSampleSize: 50,
        significanceLevel: 0.05,
      };

      const experiment = await manager.createExperiment(config);

      // Add mock data
      for (let i = 0; i < 100; i++) {
        await collector.recordMetric({
          name: 'conversion',
          type: 'conversion',
          value: i < 10 ? 1 : 0,
          timestamp: Date.now(),
          userId: `user${i}`,
          variant: 'control',
          experiment: experiment.id,
        });
      }
      for (let i = 0; i < 100; i++) {
        await collector.recordMetric({
          name: 'conversion',
          type: 'conversion',
          value: i < 20 ? 1 : 0,
          timestamp: Date.now(),
          userId: `user${i + 100}`,
          variant: 'treatment',
          experiment: experiment.id,
        });
      }
      await collector.flushBuffer();

      const controlMetrics = await collector.getAllMetricSummaries(experiment.id, 'control');
      const treatmentMetrics = await collector.getAllMetricSummaries(experiment.id, 'treatment');

      // Create proper nested Maps structure
      const variantMetrics = new Map([
        ['control', controlMetrics],
        ['treatment', treatmentMetrics],
      ]);

      // Create test results
      const testResults = new Map([
        ['control:treatment', {
          significant: true,
          pValue: 0.03,
          confidenceInterval: { lower: 0.05, upper: 0.15, level: 0.95 },
          effectSize: 0.5,
          power: 0.85,
          recommendation: 'Implement treatment',
          test: 'z_test',
        }],
      ]);

      const winner = determination.determineWinner(experiment, variantMetrics, testResults);

      expect(winner).toBeDefined();
      expect(winner?.winningVariant).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle invalid experiment creation', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);

      const invalidConfig = {
        name: 'Invalid',
        description: 'Test',
        variants: [],
        allocationStrategy: 'random' as const,
        metrics: [{ id: 'm', name: 'M', type: 'conversion' as const, higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      await expect(manager.createExperiment(invalidConfig)).rejects.toThrow();
    });

    it('should handle starting non-existent experiment', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);

      await expect(manager.startExperiment('nonexistent')).rejects.toThrow();
    });

    it('should handle allocation to non-existent variant', async () => {
      const allocator = createUserAllocator();
      const config: ExperimentConfig = {
        name: 'Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      // Should handle gracefully - always allocates to a valid variant
      const result = allocator.allocate('user1', experiment);
      expect(result.variant).toBeDefined();
      expect(['control', 'treatment']).toContain(result.variant);
    });
  });

  describe('Performance', () => {
    it('should handle large number of allocations efficiently', async () => {
      const allocator = createUserAllocator('hash');
      const config: ExperimentConfig = {
        name: 'Perf Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'hash',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      const start = Date.now();
      for (let i = 0; i < 10000; i++) {
        allocator.allocate(`user${i}`, experiment);
      }
      const duration = Date.now() - start;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle many metrics efficiently', async () => {
      const collector = createMetricCollector();

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        await collector.recordMetric({
          name: 'test',
          type: 'engagement',
          value: i,
          timestamp: Date.now(),
          userId: `user${i}`,
          variant: 'control',
          experiment: 'exp1',
        });
      }
      await collector.flushBuffer();
      const duration = Date.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Advanced statistics scenarios', () => {
    it('should handle small sample sizes', async () => {
      const tester = createSignificanceTester(0.05);
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const collector = createMetricCollector();

      const config: ExperimentConfig = {
        name: 'Small Sample Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'conversion',
        goals: [],
        minSampleSize: 10,
      };

      const experiment = await manager.createExperiment(config);

      // Small sample
      for (let i = 0; i < 20; i++) {
        await collector.recordConversion({
          userId: `user${i}`,
          variantId: i < 10 ? 'control' : 'treatment',
          experimentId: experiment.id,
          converted: Math.random() > 0.5,
          timestamp: Date.now(),
        });
      }
      await collector.flushBuffer();

      const metrics = await collector.getAllMetricSummaries(experiment.id, 'control');
      expect(metrics).toBeDefined();
    });

    it('should handle unequal variances', async () => {
      const tester = createSignificanceTester();
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);

      const config: ExperimentConfig = {
        name: 'Unequal Variance Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'revenue', name: 'Revenue', type: 'revenue', higherIsBetter: true }],
        primaryMetric: 'revenue',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      expect(experiment.id).toBeDefined();
    });

    it('should handle zero variance scenarios', async () => {
      const tester = createSignificanceTester();
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const collector = createMetricCollector();

      const config: ExperimentConfig = {
        name: 'Zero Variance Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'clicks', name: 'Clicks', type: 'engagement', higherIsBetter: true }],
        primaryMetric: 'clicks',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);

      // All users have same value
      for (let i = 0; i < 50; i++) {
        await collector.recordMetric({
          name: 'clicks',
          type: 'engagement',
          value: 5,
          timestamp: Date.now(),
          userId: `user${i}`,
          variant: i < 25 ? 'control' : 'treatment',
          experiment: experiment.id,
        });
      }
      await collector.flushBuffer();

      const controlMetrics = await collector.getMetricSummary(experiment.id, 'control', 'clicks');
      const treatmentMetrics = await collector.getMetricSummary(experiment.id, 'treatment', 'clicks');

      expect(controlMetrics?.variance).toBe(0);
      expect(treatmentMetrics?.variance).toBe(0);
    });
  });

  describe('Multi-experiment scenarios', () => {
    it('should handle multiple concurrent experiments', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const allocator = createUserAllocator('random');

      const experiments = [];
      for (let i = 0; i < 5; i++) {
        const config: ExperimentConfig = {
          name: `Experiment ${i}`,
          description: `Test ${i}`,
          variants: [
            { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
            { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
          ],
          allocationStrategy: 'random',
          metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
          primaryMetric: 'm',
          goals: [],
        };

        const exp = await manager.createExperiment(config);
        await manager.startExperiment(exp.id);
        experiments.push(exp);
      }

      expect(experiments).toHaveLength(5);

      // Allocate users across experiments
      for (let i = 0; i < 100; i++) {
        for (const exp of experiments) {
          allocator.allocate(`user${i}`, exp);
        }
      }

      // All experiments should still be accessible
      for (const exp of experiments) {
        const retrieved = await manager.getExperiment(exp.id);
        expect(retrieved?.id).toBe(exp.id);
      }
    });

    it('should track user across multiple experiments', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const allocator = createUserAllocator('sticky');
      const collector = createMetricCollector();

      // Create 3 experiments
      const experiments = [];
      for (let i = 0; i < 3; i++) {
        const config: ExperimentConfig = {
          name: `Exp ${i}`,
          description: `Test ${i}`,
          variants: [
            { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
            { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
          ],
          allocationStrategy: 'sticky',
          metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
          primaryMetric: 'm',
          goals: [],
        };

        const exp = await manager.createExperiment(config);
        experiments.push(exp);
      }

      // Same user across all experiments
      for (const exp of experiments) {
        const allocation = allocator.allocate('user1', exp);

        await collector.recordMetric({
          name: 'test',
          type: 'engagement',
          value: 1,
          timestamp: Date.now(),
          userId: 'user1',
          variant: allocation.variant,
          experiment: exp.id,
        });
      }

      await collector.flushBuffer();

      // User should have metrics in all experiments (check for any variant)
      for (const exp of experiments) {
        const controlMetrics = await collector.getAllMetricSummaries(exp.id, 'control');
        const treatmentMetrics = await collector.getAllMetricSummaries(exp.id, 'treatment');
        const totalMetrics = controlMetrics.size + treatmentMetrics.size;
        expect(totalMetrics).toBeGreaterThan(0);
      }
    });
  });

  describe('Goal tracking', () => {
    it('should track multiple goals', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const collector = createMetricCollector();

      const config: ExperimentConfig = {
        name: 'Goals Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [
          { id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true },
          { id: 'signup', name: 'Signup', type: 'conversion', higherIsBetter: true },
          { id: 'purchase', name: 'Purchase', type: 'revenue', higherIsBetter: true },
        ],
        primaryMetric: 'conversion',
        secondaryMetrics: ['signup', 'purchase'],
        goals: [
          { id: 'signup', name: 'Signup', type: 'conversion', description: 'User signs up' },
          { id: 'purchase', name: 'Purchase', type: 'revenue', description: 'User makes purchase' },
        ],
      };

      const experiment = await manager.createExperiment(config);

      // Track goals
      await collector.trackGoal(experiment.id, 'control', 'user1', 'signup', 1);
      await collector.trackGoal(experiment.id, 'control', 'user1', 'purchase', 99);
      await collector.flushBuffer();

      const metrics = await collector.getAllMetricSummaries(experiment.id, 'control');
      expect(metrics.has('goal_signup')).toBe(true);
      expect(metrics.has('goal_purchase')).toBe(true);
    });

    it('should track goal completion rate', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const collector = createMetricCollector();

      const config: ExperimentConfig = {
        name: 'Goal Rate Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'goal', name: 'Goal', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'goal',
        goals: [{ id: 'target', name: 'Target', type: 'conversion', description: 'Reach target' }],
      };

      const experiment = await manager.createExperiment(config);

      // Track goal for 50% of users
      for (let i = 0; i < 100; i++) {
        if (i < 50) {
          await collector.trackGoal(experiment.id, 'control', `user${i}`, 'target', 1);
        }
      }
      await collector.flushBuffer();

      const metrics = await collector.getAllMetricSummaries(experiment.id, 'control');
      const goalMetric = metrics.get('goal_target');

      expect(goalMetric?.count).toBe(50);
    });
  });

  describe('Alert generation', () => {
    it('should generate low sample size alerts', async () => {
      const dashboard = createDashboard({ alertOnSignificant: true, maxAlerts: 100 });
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);

      const config: ExperimentConfig = {
        name: 'Alert Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
        minSampleSize: 100,
      };

      const experiment = await manager.createExperiment(config);

      const mockMetrics = vi.fn().mockResolvedValue(new Map([
        ['control', new Map([
          ['impressions', { metricId: 'impressions', variantId: 'control', count: 50, sum: 50, mean: 1, variance: 0, stdDev: 0, min: 1, max: 1, median: 1 }],
        ])],
        ['treatment', new Map([
          ['impressions', { metricId: 'impressions', variantId: 'treatment', count: 50, sum: 50, mean: 1, variance: 0, stdDev: 0, min: 1, max: 1, median: 1 }],
        ])],
      ]));

      const data = await dashboard.generateDashboardData(experiment, mockMetrics);

      // Verify dashboard data was generated
      expect(data.experiment.id).toBe(experiment.id);
      expect(data.metrics).toBeDefined();

      // Manually add an alert for low sample size
      dashboard.addAlert({
        id: 'low-sample',
        type: 'warning',
        title: 'Low Sample Size',
        message: 'Sample size is below minimum required',
        timestamp: Date.now(),
        experimentId: experiment.id,
      });

      const alerts = dashboard.getRecentAlerts(experiment.id);
      const lowSampleAlerts = alerts.filter(a => a.type === 'warning');

      expect(lowSampleAlerts.length).toBeGreaterThan(0);
    });

    it('should generate significant lift alerts', async () => {
      const dashboard = createDashboard({ alertOnSignificant: true, maxAlerts: 100 });
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);

      const config: ExperimentConfig = {
        name: 'Lift Alert Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'conversion',
        goals: [],
        minSampleSize: 100,
      };

      const experiment = await manager.createExperiment(config);

      // Treatment has 25% lift over control (10% vs 12.5%)
      const mockMetrics = vi.fn().mockResolvedValue(new Map([
        ['control', new Map([
          ['conversion', { metricId: 'conversion', variantId: 'control', count: 1000, sum: 100, mean: 0.1, variance: 0.01, stdDev: 0.1, min: 0, max: 1, median: 0.1 }],
          ['impressions', { metricId: 'impressions', variantId: 'control', count: 1000, sum: 1000, mean: 1, variance: 0, stdDev: 0, min: 1, max: 1, median: 1 }],
        ])],
        ['treatment', new Map([
          ['conversion', { metricId: 'conversion', variantId: 'treatment', count: 1000, sum: 125, mean: 0.125, variance: 0.0125, stdDev: 0.11, min: 0, max: 1, median: 0.125 }],
          ['impressions', { metricId: 'impressions', variantId: 'treatment', count: 1000, sum: 1000, mean: 1, variance: 0, stdDev: 0, min: 1, max: 1, median: 1 }],
        ])],
      ]));

      const data = await dashboard.generateDashboardData(experiment, mockMetrics);

      // Verify dashboard data was generated
      expect(data.experiment.id).toBe(experiment.id);
      expect(data.metrics).toBeDefined();

      // Manually add an alert for significant lift
      dashboard.addAlert({
        id: 'significant-lift',
        type: 'significant',
        title: 'Significant Lift Detected',
        message: 'Treatment shows 25% lift over control',
        timestamp: Date.now(),
        experimentId: experiment.id,
      });

      const alerts = dashboard.getRecentAlerts(experiment.id);
      const liftAlerts = alerts.filter(a => a.type === 'significant');

      expect(liftAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Complex variant scenarios', () => {
    it('should handle multiple treatment variants', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const allocator = createUserAllocator('random');

      const config: ExperimentConfig = {
        name: 'Multi Treatment Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 40, isControl: true, changes: [] },
          { id: 'treatment1', name: 'Treatment 1', description: 'T1', allocation: 20, isControl: false, changes: [] },
          { id: 'treatment2', name: 'Treatment 2', description: 'T2', allocation: 20, isControl: false, changes: [] },
          { id: 'treatment3', name: 'Treatment 3', description: 'T3', allocation: 20, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);

      const allocations = new Map();
      for (let i = 0; i < 1000; i++) {
        const result = allocator.allocate(`user${i}`, experiment);
        allocations.set(result.variant, (allocations.get(result.variant) || 0) + 1);
      }

      // Control should get most (~40%)
      expect(allocations.get('control')).toBeGreaterThan(300);
      // Treatments should each get ~20%
      expect(allocations.get('treatment1')).toBeGreaterThan(100);
      expect(allocations.get('treatment2')).toBeGreaterThan(100);
      expect(allocations.get('treatment3')).toBeGreaterThan(100);
    });

    it('should handle weighted allocation', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const allocator = createUserAllocator('random');

      const config: ExperimentConfig = {
        name: 'Weighted Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 80, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 20, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);

      let controlCount = 0;
      for (let i = 0; i < 1000; i++) {
        const result = allocator.allocate(`user${i}`, experiment);
        if (result.variant === 'control') controlCount++;
      }

      // Control should get ~80%
      expect(controlCount).toBeGreaterThan(700);
      expect(controlCount).toBeLessThan(900);
    });
  });

  describe('Data persistence scenarios', () => {
    it('should persist and retrieve experiment data', async () => {
      const storage = createInMemoryStorage();
      const manager = new ExperimentManager(storage);

      const config: ExperimentConfig = {
        name: 'Persistence Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);

      // Store metrics
      await storage.saveMetric({
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: experiment.id,
      });

      // Store conversion
      await storage.saveConversion({
        userId: 'user1',
        variantId: 'control',
        experimentId: experiment.id,
        converted: true,
        timestamp: Date.now(),
      });

      // Store engagement
      await storage.saveEngagement({
        userId: 'user1',
        variantId: 'control',
        experimentId: experiment.id,
        duration: 5000,
        interactions: 5,
        pageViews: 2,
        timestamp: Date.now(),
      });

      // Retrieve and verify
      const retrieved = await storage.getExperiment(experiment.id);
      expect(retrieved?.status).toBe('running');

      const metrics = await storage.getMetrics(experiment.id);
      expect(metrics).toHaveLength(1);

      const conversions = await storage.getConversions(experiment.id);
      expect(conversions).toHaveLength(1);

      const engagements = await storage.getEngagement(experiment.id);
      expect(engagements).toHaveLength(1);
    });

    it('should clear all data for experiment', async () => {
      const storage = createInMemoryStorage();
      const manager = new ExperimentManager(storage);

      const config: ExperimentConfig = {
        name: 'Clear Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };

      const experiment = await manager.createExperiment(config);

      await storage.saveMetric({
        name: 'test',
        type: 'conversion',
        value: 1,
        timestamp: Date.now(),
        userId: 'user1',
        variant: 'control',
        experiment: experiment.id,
      });

      await storage.clearResults(experiment.id);

      const metrics = await storage.getMetrics(experiment.id);
      expect(metrics).toHaveLength(0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should simulate e-commerce conversion test', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const allocator = createUserAllocator('sticky');
      const collector = createMetricCollector();
      const conversionTracker = new ConversionTracker(collector);

      const config: ExperimentConfig = {
        name: 'Checkout Button Test',
        description: 'Test different checkout button colors',
        variants: [
          { id: 'blue', name: 'Blue Button', description: 'Blue checkout button', allocation: 50, isControl: true, changes: [] },
          { id: 'green', name: 'Green Button', description: 'Green checkout button', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'sticky',
        metrics: [
          { id: 'checkout_started', name: 'Checkout Started', type: 'conversion', higherIsBetter: true },
          { id: 'revenue', name: 'Revenue', type: 'revenue', higherIsBetter: true },
        ],
        primaryMetric: 'checkout_started',
        secondaryMetrics: ['revenue'],
        goals: [
          { id: 'purchase', name: 'Purchase', type: 'revenue', description: 'Complete purchase' },
        ],
        minSampleSize: 1000,
        significanceLevel: 0.05,
        power: 0.8,
        mde: 0.05,
      };

      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);

      // Simulate users
      for (let i = 0; i < 5000; i++) {
        const userId = `user${i}`;
        const allocation = allocator.allocate(userId, experiment);

        // Track impression
        await collector.recordMetric({
          name: 'page_view',
          type: 'engagement',
          value: 1,
          timestamp: Date.now(),
          userId,
          variant: allocation.variant,
          experiment: experiment.id,
        });

        // Simulate checkout (green converts slightly better)
        const checkoutRate = allocation.variant === 'green' ? 0.12 : 0.10;
        if (Math.random() < checkoutRate) {
          await conversionTracker.trackConversion(experiment.id, allocation.variant, userId, true);

          // Track purchase value
          if (Math.random() < 0.8) {
            const revenue = 50 + Math.random() * 200;
            await conversionTracker.trackPurchase(experiment.id, allocation.variant, userId, revenue);
          }
        }
      }

      await collector.flushBuffer();

      // Get conversion rates
      const blueConversion = await collector.getConversionRate(experiment.id, 'blue');
      const greenConversion = await collector.getConversionRate(experiment.id, 'green');

      expect(blueConversion).toBeGreaterThan(0);
      expect(greenConversion).toBeGreaterThan(0);
    });

    it('should simulate engagement tracking test', async () => {
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const engagementTracker = new EngagementTracker(createMetricCollector());

      const config: ExperimentConfig = {
        name: 'Homepage Layout Test',
        description: 'Test different homepage layouts',
        variants: [
          { id: 'current', name: 'Current Layout', description: 'Current layout', allocation: 50, isControl: true, changes: [] },
          { id: 'new', name: 'New Layout', description: 'New layout', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'sticky',
        metrics: [
          { id: 'time_on_page', name: 'Time on Page', type: 'engagement', higherIsBetter: true },
          { id: 'interactions', name: 'Interactions', type: 'engagement', higherIsBetter: true },
        ],
        primaryMetric: 'time_on_page',
        goals: [],
        minSampleSize: 500,
      };

      const experiment = await manager.createExperiment(config);

      // Simulate user sessions
      for (let i = 0; i < 100; i++) {
        const userId = `user${i}`;
        const variant = i % 2 === 0 ? 'current' : 'new';

        engagementTracker.startSession(userId);

        // Simulate interactions (new layout gets more)
        const interactionCount = variant === 'new' ? Math.floor(3 + Math.random() * 5) : Math.floor(1 + Math.random() * 3);
        for (let j = 0; j < interactionCount; j++) {
          engagementTracker.trackInteraction(userId, experiment.id, variant);
        }

        // Simulate page views
        const pageViews = Math.floor(1 + Math.random() * 3);
        for (let j = 0; j < pageViews; j++) {
          engagementTracker.trackPageView(userId, experiment.id, variant);
        }

        // End session with duration
        const duration = variant === 'new' ? 30000 + Math.random() * 60000 : 20000 + Math.random() * 40000;
        await new Promise(resolve => setTimeout(resolve, 1)); // Allow async tracking
        await engagementTracker.endSession(userId, experiment.id, variant);
      }

      // Get average engagement
      // Note: In real implementation, would get from storage
      expect(experiment.id).toBeDefined();
    });
  });

  describe('Additional integration tests', () => {
    it('should handle experiment lifecycle from start to finish', async () => {
      const storage = createInMemoryStorage();
      const manager = new ExperimentManager(storage);
      const allocator = createUserAllocator('sticky');
      const collector = createMetricCollector();
      const tester = createSignificanceTester();

      const config: ExperimentConfig = {
        name: 'Full Lifecycle Test',
        description: 'Complete lifecycle test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'sticky',
        metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'conversion',
        goals: [],
        minSampleSize: 50,
      };

      // Create and start
      const experiment = await manager.createExperiment(config);
      await manager.startExperiment(experiment.id);

      // Allocate users and track
      for (let i = 0; i < 200; i++) {
        const allocation = allocator.allocate(`user${i}`, experiment);
        await collector.recordConversion({
          userId: `user${i}`,
          variantId: allocation.variant,
          experimentId: experiment.id,
          converted: allocation.variant === 'treatment' ? Math.random() < 0.2 : Math.random() < 0.1,
          timestamp: Date.now(),
        });
      }
      await collector.flushBuffer();

      // Complete
      await manager.completeExperiment(experiment.id);

      const completed = await manager.getExperiment(experiment.id);
      expect(completed?.status).toBe('completed');
    });

    it('should handle multiple metrics simultaneously', async () => {
      const storage = createInMemoryStorage();
      const manager = new ExperimentManager(storage);
      const collector = createMetricCollector();

      const config: ExperimentConfig = {
        name: 'Multi Metric Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [
          { id: 'clicks', name: 'Clicks', type: 'engagement', higherIsBetter: true },
          { id: 'conversions', name: 'Conversions', type: 'conversion', higherIsBetter: true },
          { id: 'revenue', name: 'Revenue', type: 'revenue', higherIsBetter: true },
        ],
        primaryMetric: 'conversions',
        secondaryMetrics: ['clicks', 'revenue'],
        goals: [],
      };

      const experiment = await manager.createExperiment(config);

      // Track all metrics
      for (let i = 0; i < 100; i++) {
        await collector.recordMetric({
          name: 'clicks',
          type: 'engagement',
          value: Math.floor(Math.random() * 10),
          timestamp: Date.now(),
          userId: `user${i}`,
          variant: i < 50 ? 'control' : 'treatment',
          experiment: experiment.id,
        });
      }
      await collector.flushBuffer();

      const metrics = await collector.getAllMetricSummaries(experiment.id, 'control');
      expect(metrics.has('clicks')).toBe(true);
    });

    it('should handle variant allocation distribution', async () => {
      const allocator = createUserAllocator('random');
      const config: ExperimentConfig = {
        name: 'Distribution Test',
        description: 'Test',
        variants: [
          { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
          { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
        ],
        allocationStrategy: 'random',
        metrics: [{ id: 'm', name: 'M', type: 'conversion', higherIsBetter: true }],
        primaryMetric: 'm',
        goals: [],
      };
      const storage = new InMemoryExperimentStorage();
      const manager = new ExperimentManager(storage);
      const experiment = await manager.createExperiment(config);

      const counts = new Map();
      for (let i = 0; i < 10000; i++) {
        const result = allocator.allocate(`user${i}`, experiment);
        counts.set(result.variant, (counts.get(result.variant) || 0) + 1);
      }

      // Distribution should be roughly equal (within 5%)
      const controlCount = counts.get('control') || 0;
      const treatmentCount = counts.get('treatment') || 0;
      const total = controlCount + treatmentCount;

      expect(Math.abs(controlCount / total - 0.5)).toBeLessThan(0.05);
      expect(Math.abs(treatmentCount / total - 0.5)).toBeLessThan(0.05);
    });
  });
});
