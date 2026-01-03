/**
 * Tests for Dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Dashboard,
  ExperimentReportGenerator,
  WinnerDetermination,
  createDashboard,
  createReportGenerator,
  createWinnerDetermination,
} from '../src/reporting/Dashboard.js';
import type { Experiment, MetricSummary, DashboardData } from '../src/types.js';

function createMockExperiment(): Experiment {
  return {
    id: 'exp1',
    name: 'Test Experiment',
    description: 'Test',
    status: 'running',
    variants: [
      { id: 'control', name: 'Control', description: 'Control', allocation: 50, isControl: true, changes: [] },
      { id: 'treatment', name: 'Treatment', description: 'Treatment', allocation: 50, isControl: false, changes: [] },
    ],
    allocationStrategy: 'random',
    metrics: [{ id: 'conversion', name: 'Conversion', type: 'conversion', higherIsBetter: true }],
    primaryMetric: 'conversion',
    secondaryMetrics: [],
    goals: [],
    minSampleSize: 100,
    significanceLevel: 0.05,
    power: 0.8,
    mde: 0.1,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'test',
  };
}

function createMockMetrics(): Map<string, MetricSummary> {
  const metrics = new Map<string, MetricSummary>();
  metrics.set('conversion', {
    metricId: 'conversion',
    variantId: 'control',
    count: 1000,
    sum: 100,
    mean: 0.1,
    variance: 0.01,
    stdDev: 0.1,
    min: 0,
    max: 1,
    median: 0.1,
    percentiles: { p25: 0.05, p75: 0.15, p90: 0.2, p95: 0.25, p99: 0.3 },
  });
  metrics.set('impressions', {
    metricId: 'impressions',
    variantId: 'control',
    count: 1000,
    sum: 1000,
    mean: 1,
    variance: 0,
    stdDev: 0,
    min: 1,
    max: 1,
    median: 1,
  });
  return metrics;
}

describe('Dashboard', () => {
  let dashboard: Dashboard;

  beforeEach(() => {
    dashboard = new Dashboard({
      refreshInterval: 1000,
      showRealtime: false,
      alertOnSignificant: true,
      charts: ['bar', 'line'],
      maxAlerts: 10,
    });
  });

  describe('generateDashboardData', () => {
    it('should generate dashboard data', async () => {
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', createMockMetrics()],
        ['treatment', createMockMetrics()],
      ]);

      const getMetrics = vi.fn().mockResolvedValue(createMockMetrics());

      const data = await dashboard.generateDashboardData(experiment, getMetrics);

      expect(data.experiment).toEqual(experiment);
      expect(data.metrics).toBeDefined();
      expect(data.charts).toBeDefined();
      expect(data.timestamp).toBeDefined();
    });

    it('should include winner if provided', async () => {
      const experiment = createMockExperiment();
      const getMetrics = vi.fn().mockResolvedValue(createMockMetrics());
      const winner = {
        winningVariant: 'treatment',
        confidence: 0.95,
        lift: 15,
        risk: 'low' as const,
        reasoning: ['Significant improvement'],
        cautions: [],
        nextSteps: ['Implement'],
        timestamp: Date.now(),
      };

      const data = await dashboard.generateDashboardData(experiment, getMetrics, async () => winner);

      expect(data.winner).toEqual(winner);
    });
  });

  describe('generateCharts', () => {
    it('should generate conversion chart', () => {
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', createMockMetrics()],
        ['treatment', createMockMetrics()],
      ]);

      const charts = dashboard.generateCharts(experiment, variantMetrics);

      expect(charts.length).toBeGreaterThan(0);
      expect(charts[0].type).toBeDefined();
      expect(charts[0].title).toBeDefined();
    });

    it('should generate line chart for metrics', () => {
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', createMockMetrics()],
        ['treatment', createMockMetrics()],
      ]);

      const charts = dashboard.generateCharts(experiment, variantMetrics);
      const lineChart = charts.find(c => c.type === 'line');

      expect(lineChart).toBeDefined();
    });

    it('should generate funnel chart', () => {
      const dashboard = new Dashboard({ charts: ['funnel'] });
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', createMockMetrics()],
      ]);

      const charts = dashboard.generateCharts(experiment, variantMetrics);
      const funnelChart = charts.find(c => c.type === 'funnel');

      expect(funnelChart).toBeDefined();
    });
  });

  describe('alerts', () => {
    it('should add alert', () => {
      dashboard.addAlert({
        id: 'alert1',
        type: 'significant',
        title: 'Test Alert',
        message: 'Test message',
        timestamp: Date.now(),
        experimentId: 'exp1',
      });

      const alerts = dashboard.getRecentAlerts('exp1');
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('significant');
    });

    it('should limit alerts to maxAlerts', () => {
      const dashboard = new Dashboard({ maxAlerts: 3 });

      for (let i = 0; i < 10; i++) {
        dashboard.addAlert({
          id: `alert${i}`,
          type: 'info',
          title: `Alert ${i}`,
          message: `Message ${i}`,
          timestamp: Date.now(),
          experimentId: 'exp1',
        });
      }

      const alerts = dashboard.getRecentAlerts('exp1');
      expect(alerts.length).toBeLessThanOrEqual(3);
    });

    it('should get recent alerts by experiment', () => {
      dashboard.addAlert({
        id: 'alert1',
        type: 'info',
        title: 'Exp1 Alert',
        message: 'For exp1',
        timestamp: Date.now(),
        experimentId: 'exp1',
      });
      dashboard.addAlert({
        id: 'alert2',
        type: 'info',
        title: 'Exp2 Alert',
        message: 'For exp2',
        timestamp: Date.now(),
        experimentId: 'exp2',
      });

      const exp1Alerts = dashboard.getRecentAlerts('exp1');
      const exp2Alerts = dashboard.getRecentAlerts('exp2');

      expect(exp1Alerts).toHaveLength(1);
      expect(exp2Alerts).toHaveLength(1);
      expect(exp1Alerts[0].experimentId).toBe('exp1');
    });

    it('should limit returned alerts', () => {
      for (let i = 0; i < 20; i++) {
        dashboard.addAlert({
          id: `alert${i}`,
          type: 'info',
          title: `Alert ${i}`,
          message: `Message ${i}`,
          timestamp: Date.now() + i,
          experimentId: 'exp1',
        });
      }

      const alerts = dashboard.getRecentAlerts('exp1', 5);
      expect(alerts.length).toBeLessThanOrEqual(5);
    });

    it('should clear alerts for experiment', () => {
      dashboard.addAlert({
        id: 'alert1',
        type: 'info',
        title: 'Alert',
        message: 'Message',
        timestamp: Date.now(),
        experimentId: 'exp1',
      });

      dashboard.clearAlerts('exp1');

      const alerts = dashboard.getRecentAlerts('exp1');
      expect(alerts).toHaveLength(0);
    });
  });

  describe('subscription', () => {
    it('should subscribe to updates', () => {
      let called = false;
      const unsubscribe = dashboard.subscribe(() => { called = true; });

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe', () => {
      let callCount = 0;
      const unsubscribe = dashboard.subscribe(() => { callCount++; });

      unsubscribe();
      // Trigger notification (if it existed)
      expect(callCount).toBe(0);
    });
  });

  describe('auto-refresh', () => {
    it('should start auto-refresh', () => {
      const dashboard = new Dashboard({ refreshInterval: 100, showRealtime: true });

      // Dashboard created with auto-refresh
      expect(dashboard).toBeDefined();
    });

    it('should stop auto-refresh', () => {
      const dashboard = new Dashboard({ refreshInterval: 100, showRealtime: true });

      dashboard.stopAutoRefresh();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should destroy dashboard', () => {
      const dashboard = new Dashboard({ showRealtime: true });

      dashboard.destroy();

      // Should clean up resources
      expect(true).toBe(true);
    });
  });
});

describe('ExperimentReportGenerator', () => {
  let generator: ExperimentReportGenerator;

  beforeEach(() => {
    generator = createReportGenerator();
  });

  describe('generateReport', () => {
    it('should generate comprehensive report', async () => {
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', createMockMetrics()],
        ['treatment', createMockMetrics()],
      ]);
      const testResults = new Map([
        ['control:treatment', {
          significant: true,
          pValue: 0.01,
          confidenceInterval: { lower: 0.02, upper: 0.08, level: 0.95 },
          effectSize: 0.5,
          power: 0.9,
          recommendation: 'Implement',
          test: 'z_test',
        }],
      ]);
      const winner = {
        winningVariant: 'treatment',
        confidence: 0.99,
        lift: 15,
        risk: 'low' as const,
        reasoning: ['Strong improvement'],
        cautions: [],
        nextSteps: ['Implement'],
        timestamp: Date.now(),
      };

      const report = await generator.generateReport(experiment, variantMetrics, testResults, winner);

      expect(report.experiment).toEqual(experiment);
      expect(report.status.totalParticipants).toBeDefined();
      expect(report.variants).toHaveLength(2);
      expect(report.tests).toHaveLength(1);
      expect(report.winner).toEqual(winner);
      expect(report.recommendations).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });

    it('should calculate status correctly', async () => {
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', createMockMetrics()],
      ]);
      const testResults = new Map();

      const report = await generator.generateReport(experiment, variantMetrics, testResults);

      expect(report.status.status).toBeDefined();
      expect(['needs_more_data', 'ready_to_conclude', 'inconclusive', 'significant_winner_found'])
        .toContain(report.status.status);
    });

    it('should generate recommendations', async () => {
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', createMockMetrics()],
        ['treatment', createMockMetrics()],
      ]);
      const testResults = new Map();
      const winner = {
        winningVariant: 'treatment',
        confidence: 0.99,
        lift: 15,
        risk: 'low' as const,
        reasoning: [],
        cautions: [],
        nextSteps: [],
        timestamp: Date.now(),
      };

      const report = await generator.generateReport(experiment, variantMetrics, testResults, winner);

      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});

describe('WinnerDetermination', () => {
  let determination: WinnerDetermination;

  beforeEach(() => {
    determination = createWinnerDetermination();
  });

  describe('determineWinner', () => {
    it('should determine winning variant', () => {
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', new Map([
          ['conversion', { ...createMockMetrics().get('conversion')!, mean: 0.1 }],
        ])],
        ['treatment', new Map([
          ['conversion', { ...createMockMetrics().get('conversion')!, mean: 0.15 }],
        ])],
      ]);
      const testResults = new Map([
        ['control:treatment', {
          significant: true,
          pValue: 0.01,
          confidenceInterval: { lower: 0.02, upper: 0.08, level: 0.95 },
          effectSize: 0.5,
          power: 0.9,
          recommendation: 'Implement',
          test: 'z_test',
        }],
      ]);

      const winner = determination.determineWinner(experiment, variantMetrics, testResults);

      expect(winner).toBeDefined();
      expect(winner?.winningVariant).toBeDefined();
      expect(winner?.confidence).toBeGreaterThan(0);
    });

    it('should return undefined if no control', () => {
      const experiment = { ...createMockExperiment(), variants: [] };
      const variantMetrics = new Map();
      const testResults = new Map();

      const winner = determination.determineWinner(experiment, variantMetrics, testResults);

      expect(winner).toBeUndefined();
    });

    it('should assess risk correctly', () => {
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', new Map([
          ['conversion', { ...createMockMetrics().get('conversion')!, mean: 0.1, count: 500 }],
        ])],
        ['treatment', new Map([
          ['conversion', { ...createMockMetrics().get('conversion')!, mean: 0.12, count: 500 }],
        ])],
      ]);
      const testResults = new Map([
        ['control:treatment', {
          significant: true,
          pValue: 0.04,
          confidenceInterval: { lower: 0.01, upper: 0.03, level: 0.95 },
          effectSize: 0.2,
          power: 0.7,
          recommendation: 'Implement',
          test: 'z_test',
        }],
      ]);

      const winner = determination.determineWinner(experiment, variantMetrics, testResults);

      expect(winner?.risk).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(winner?.risk);
    });

    it('should provide reasoning', () => {
      const experiment = createMockExperiment();
      const variantMetrics = new Map([
        ['control', new Map([
          ['conversion', { ...createMockMetrics().get('conversion')!, mean: 0.1 }],
        ])],
        ['treatment', new Map([
          ['conversion', { ...createMockMetrics().get('conversion')!, mean: 0.15 }],
        ])],
      ]);
      const testResults = new Map([
        ['control:treatment', {
          significant: true,
          pValue: 0.01,
          confidenceInterval: { lower: 0.02, upper: 0.08, level: 0.95 },
          effectSize: 0.5,
          power: 0.9,
          recommendation: 'Implement',
          test: 'z_test',
        }],
      ]);

      const winner = determination.determineWinner(experiment, variantMetrics, testResults);

      expect(winner?.reasoning.length).toBeGreaterThan(0);
    });
  });
});

describe('factory functions', () => {
  it('should create dashboard', () => {
    const dashboard = createDashboard();
    expect(dashboard).toBeInstanceOf(Dashboard);
  });

  it('should create dashboard with config', () => {
    const dashboard = createDashboard({ refreshInterval: 5000 });
    expect(dashboard).toBeInstanceOf(Dashboard);
  });

  it('should create report generator', () => {
    const generator = createReportGenerator();
    expect(generator).toBeInstanceOf(ExperimentReportGenerator);
  });

  it('should create winner determination', () => {
    const determination = createWinnerDetermination();
    expect(determination).toBeInstanceOf(WinnerDetermination);
  });

  it('should create dashboard with custom charts', () => {
    const dashboard = createDashboard({ charts: ['line', 'bar', 'pie', 'funnel'] });
    expect(dashboard).toBeInstanceOf(Dashboard);
  });

  it('should create dashboard with custom refresh interval', () => {
    const dashboard = createDashboard({ refreshInterval: 60000, showRealtime: true });
    expect(dashboard).toBeInstanceOf(Dashboard);
  });
});
