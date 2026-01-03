/**
 * Dashboard Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Dashboard } from '../src/Dashboard.js';
import type {
  SystemHealth,
  WorkerHealth,
  AlertMessage,
  CircuitBreakerState,
  HealthMetric
} from '../src/types.js';

describe('Dashboard', () => {
  let dashboard: Dashboard;

  beforeEach(() => {
    dashboard = new Dashboard(50);
  });

  describe('constructor', () => {
    it('should create with default alert limit', () => {
      const dash = new Dashboard();

      const summary = dash.getSummary();
      expect(summary.recentAlerts).toBe(0);
    });

    it('should create with custom alert limit', () => {
      const dash = new Dashboard(100);

      expect(dash).toBeDefined();
    });
  });

  describe('updateSystemHealth', () => {
    it('should update system health', () => {
      const health = createSystemHealth();

      dashboard.updateSystemHealth(health);

      const data = dashboard.getData();
      expect(data.systemHealth).toBe(health);
    });

    it('should update last updated time', () => {
      const before = new Date();
      const health = createSystemHealth();

      dashboard.updateSystemHealth(health);

      const summary = dashboard.getSummary();
      expect(summary.lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should update worker trends', () => {
      const health = createSystemHealth();

      dashboard.updateSystemHealth(health);
      dashboard.updateSystemHealth(health);
      dashboard.updateSystemHealth(health);

      const data = dashboard.getData();
      expect(data.trends.length).toBeGreaterThan(0);
    });
  });

  describe('addAlert', () => {
    it('should add alert to history', () => {
      const alert = createAlert('worker-1', 'healthy', 'unhealthy');

      dashboard.addAlert(alert);

      const recentAlerts = dashboard.getRecentAlerts();
      expect(recentAlerts.length).toBe(1);
      expect(recentAlerts[0]).toBe(alert);
    });

    it('should limit alert history', () => {
      const dash = new Dashboard(5);

      for (let i = 0; i < 10; i++) {
        dash.addAlert(createAlert(`worker-${i}`, 'healthy', 'unhealthy'));
      }

      const alerts = dash.getRecentAlerts();
      expect(alerts.length).toBe(5);
    });

    it('should update last updated time', () => {
      const alert = createAlert('worker-1', 'healthy', 'unhealthy');

      dashboard.addAlert(alert);

      const summary = dashboard.getSummary();
      expect(summary.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('updateCircuitBreakers', () => {
    it('should update circuit breaker states', () => {
      const states = new Map<string, CircuitBreakerState>();
      states.set('breaker1', {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastStateChange: new Date()
      });

      dashboard.updateCircuitBreakers(states);

      const data = dashboard.getData();
      expect(data.circuitBreakers.size).toBe(1);
    });

    it('should update single circuit breaker', () => {
      const state: CircuitBreakerState = {
        state: 'open',
        failureCount: 5,
        successCount: 0,
        lastStateChange: new Date()
      };

      dashboard.updateCircuitBreaker('breaker1', state);

      const states = dashboard.getCircuitBreakerStates();
      expect(states.get('breaker1')).toBe(state);
    });
  });

  describe('getData', () => {
    it('should throw error when system health not set', () => {
      expect(() => dashboard.getData()).toThrow('System health not set');
    });

    it('should return dashboard data', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const data = dashboard.getData();

      expect(data.systemHealth).toBeDefined();
      expect(data.recentAlerts).toEqual([]);
      expect(data.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('getSummary', () => {
    it('should return summary with default values', () => {
      const summary = dashboard.getSummary();

      expect(summary.totalWorkers).toBe(0);
      expect(summary.healthyWorkers).toBe(0);
      expect(summary.degradedWorkers).toBe(0);
      expect(summary.unhealthyWorkers).toBe(0);
      expect(summary.healthPercentage).toBe(0);
      expect(summary.recentAlerts).toBe(0);
      expect(summary.openCircuitBreakers).toBe(0);
    });

    it('should return summary with system health', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const summary = dashboard.getSummary();

      expect(summary.totalWorkers).toBe(3);
      expect(summary.healthyWorkers).toBe(2);
      expect(summary.degradedWorkers).toBe(1);
    });

    it('should count open circuit breakers', () => {
      const states = new Map<string, CircuitBreakerState>();
      states.set('breaker1', { state: 'closed', failureCount: 0, successCount: 0, lastStateChange: new Date() });
      states.set('breaker2', { state: 'open', failureCount: 5, successCount: 0, lastStateChange: new Date() });
      states.set('breaker3', { state: 'half-open', failureCount: 3, successCount: 0, lastStateChange: new Date() });

      dashboard.updateCircuitBreakers(states);

      const summary = dashboard.getSummary();
      expect(summary.openCircuitBreakers).toBe(1);
    });
  });

  describe('getWorkerList', () => {
    it('should return empty list when no health data', () => {
      const workers = dashboard.getWorkerList();
      expect(workers).toEqual([]);
    });

    it('should return worker list sorted by health score', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const workers = dashboard.getWorkerList();

      expect(workers.length).toBe(3);
      expect(workers[0].healthScore).toBeGreaterThanOrEqual(workers[1].healthScore);
      expect(workers[1].healthScore).toBeGreaterThanOrEqual(workers[2].healthScore);
    });

    it('should include worker details', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const workers = dashboard.getWorkerList();

      expect(workers[0].workerId).toBeDefined();
      expect(workers[0].status).toBeDefined();
      expect(workers[0].healthScore).toBeGreaterThanOrEqual(0);
      expect(workers[0].uptime).toBeGreaterThanOrEqual(0);
      expect(workers[0].lastCheck).toBeInstanceOf(Date);
    });
  });

  describe('getWorkerMetrics', () => {
    it('should return worker metrics', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const metrics = dashboard.getWorkerMetrics('worker-1');

      expect(metrics.worker).toBeDefined();
      expect(metrics.metrics).toBeDefined();
    });

    it('should return trend for worker', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);
      dashboard.updateSystemHealth(health);
      dashboard.updateSystemHealth(health);

      const metrics = dashboard.getWorkerMetrics('worker-1');

      expect(metrics.trend).toBeDefined();
    });

    it('should return undefined for non-existent worker', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const metrics = dashboard.getWorkerMetrics('non-existent');

      expect(metrics.worker).toBeUndefined();
    });
  });

  describe('getTopIssues', () => {
    it('should return empty array when no issues', () => {
      const health = createSystemHealth();
      health.workers.get('worker-1')!.status = 'healthy';
      health.workers.get('worker-2')!.status = 'healthy';
      health.workers.get('worker-3')!.status = 'healthy';

      dashboard.updateSystemHealth(health);

      const issues = dashboard.getTopIssues();
      expect(issues).toEqual([]);
    });

    it('should return top issues', () => {
      const health = createSystemHealth();

      dashboard.updateSystemHealth(health);

      const issues = dashboard.getTopIssues(5);

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].workerId).toBeDefined();
      expect(issues[0].issue).toBeDefined();
      expect(issues[0].severity).toBeDefined();
    });

    it('should limit results', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const issues = dashboard.getTopIssues(2);

      expect(issues.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getRecentAlerts', () => {
    it('should return all alerts when no limit', () => {
      for (let i = 0; i < 5; i++) {
        dashboard.addAlert(createAlert(`worker-${i}`, 'healthy', 'unhealthy'));
      }

      const alerts = dashboard.getRecentAlerts();
      expect(alerts.length).toBe(5);
    });

    it('should limit alerts when requested', () => {
      for (let i = 0; i < 10; i++) {
        dashboard.addAlert(createAlert(`worker-${i}`, 'healthy', 'unhealthy'));
      }

      const alerts = dashboard.getRecentAlerts(3);
      expect(alerts.length).toBe(3);
    });

    it('should return recent alerts', () => {
      dashboard.addAlert(createAlert('worker-1', 'healthy', 'unhealthy'));
      dashboard.addAlert(createAlert('worker-2', 'healthy', 'degraded'));

      const alerts = dashboard.getRecentAlerts(1);

      expect(alerts.length).toBe(1);
      expect(alerts[0].workerId).toBe('worker-2');
    });
  });

  describe('getAlertsBySeverity', () => {
    it('should filter alerts by severity', () => {
      dashboard.addAlert(createAlert('worker-1', 'healthy', 'unhealthy'));
      dashboard.addAlert(createAlert('worker-2', 'healthy', 'degraded'));
      dashboard.addAlert(createAlert('worker-3', 'degraded', 'healthy'));

      const critical = dashboard.getAlertsBySeverity('critical');
      const warning = dashboard.getAlertsBySeverity('warning');
      const info = dashboard.getAlertsBySeverity('info');

      expect(critical.length).toBeGreaterThan(0);
      expect(warning.length).toBeGreaterThan(0);
      expect(info.length).toBeGreaterThan(0);
    });
  });

  describe('getOpenCircuitBreakers', () => {
    it('should return empty when no open breakers', () => {
      const states = new Map<string, CircuitBreakerState>();
      states.set('breaker1', { state: 'closed', failureCount: 0, successCount: 0, lastStateChange: new Date() });

      dashboard.updateCircuitBreakers(states);

      const open = dashboard.getOpenCircuitBreakers();
      expect(open).toEqual([]);
    });

    it('should return open breakers', () => {
      const states = new Map<string, CircuitBreakerState>();
      states.set('breaker1', { state: 'closed', failureCount: 0, successCount: 0, lastStateChange: new Date() });
      states.set('breaker2', { state: 'open', failureCount: 5, successCount: 0, lastStateChange: new Date() });

      dashboard.updateCircuitBreakers(states);

      const open = dashboard.getOpenCircuitBreakers();
      expect(open.length).toBe(1);
      expect(open[0].name).toBe('breaker2');
    });
  });

  describe('getHealthDistribution', () => {
    it('should return distribution', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const dist = dashboard.getHealthDistribution();

      expect(dist.healthy).toBe(2);
      expect(dist.degraded).toBe(1);
      expect(dist.unhealthy).toBe(0);
    });

    it('should return zeros when no data', () => {
      const dist = dashboard.getHealthDistribution();

      expect(dist.healthy).toBe(0);
      expect(dist.degraded).toBe(0);
      expect(dist.unhealthy).toBe(0);
      expect(dist.unknown).toBe(0);
    });
  });

  describe('getTimeSeries', () => {
    it('should return time series data', () => {
      const health = createSystemHealth();

      for (let i = 0; i < 5; i++) {
        dashboard.updateSystemHealth(health);
      }

      const series = dashboard.getTimeSeries('worker-1', 'health-score');

      expect(series.length).toBeGreaterThan(0);
      expect(series[0].timestamp).toBeInstanceOf(Date);
      expect(series[0].value).toBeGreaterThanOrEqual(0);
    });

    it('should return empty for non-existent worker', () => {
      const series = dashboard.getTimeSeries('non-existent', 'test');
      expect(series).toEqual([]);
    });
  });

  describe('clearAlerts', () => {
    it('should clear alerts', () => {
      dashboard.addAlert(createAlert('worker-1', 'healthy', 'unhealthy'));
      dashboard.addAlert(createAlert('worker-2', 'healthy', 'degraded'));

      dashboard.clearAlerts();

      const alerts = dashboard.getRecentAlerts();
      expect(alerts).toEqual([]);
    });

    it('should update last updated time', () => {
      dashboard.addAlert(createAlert('worker-1', 'healthy', 'unhealthy'));

      dashboard.clearAlerts();

      const summary = dashboard.getSummary();
      expect(summary.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);
      dashboard.addAlert(createAlert('worker-1', 'healthy', 'unhealthy'));

      dashboard.reset();

      const summary = dashboard.getSummary();
      expect(summary.totalWorkers).toBe(0);
      expect(summary.recentAlerts).toBe(0);
    });
  });

  describe('exportJson', () => {
    it('should throw error when no data', () => {
      expect(() => dashboard.exportJson()).toThrow();
    });

    it('should export as JSON', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const json = dashboard.exportJson();

      expect(json).toBeDefined();
      expect(JSON.parse(json)).toBeDefined();
    });
  });

  describe('isDataStale', () => {
    it('should detect stale data', () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      expect(dashboard.isDataStale(10)).toBe(false);
    });

    it('should detect fresh data', async () => {
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(dashboard.isDataStale(10)).toBe(true);
    });
  });

  describe('getLastUpdated', () => {
    it('should return last update time', () => {
      const before = new Date();
      const health = createSystemHealth();
      dashboard.updateSystemHealth(health);

      const lastUpdated = dashboard.getLastUpdated();
      expect(lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});

// Helper functions
function createSystemHealth(): SystemHealth {
  const workers = new Map<string, WorkerHealth>();

  workers.set('worker-1', {
    workerId: 'worker-1',
    status: 'healthy',
    metrics: [createMetric('cpu', 30, '%')],
    lastCheck: new Date(),
    uptime: 10000,
    consecutiveFailures: 0,
    consecutiveSuccesses: 5
  });

  workers.set('worker-2', {
    workerId: 'worker-2',
    status: 'healthy',
    metrics: [createMetric('cpu', 50, '%')],
    lastCheck: new Date(),
    uptime: 5000,
    consecutiveFailures: 0,
    consecutiveSuccesses: 3
  });

  workers.set('worker-3', {
    workerId: 'worker-3',
    status: 'degraded',
    metrics: [createMetric('cpu', 85, '%')],
    lastCheck: new Date(),
    uptime: 2000,
    consecutiveFailures: 1,
    consecutiveSuccesses: 0
  });

  return {
    totalWorkers: 3,
    healthy: 2,
    degraded: 1,
    unhealthy: 0,
    unknown: 0,
    healthPercentage: 83.33,
    timestamp: new Date(),
    workers
  };
}

function createAlert(
  workerId: string,
  previousStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown',
  currentStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
): AlertMessage {
  return {
    id: `alert-${Date.now()}-${Math.random()}`,
    workerId,
    previousStatus,
    currentStatus,
    severity: currentStatus === 'unhealthy' ? 'critical' : 'warning',
    message: `Worker ${workerId} status changed from ${previousStatus} to ${currentStatus}`,
    timestamp: new Date(),
    metrics: []
  };
}

function createMetric(name: string, value: number, unit: string): HealthMetric {
  return {
    name,
    value,
    unit,
    status: value > 80 ? 'degraded' : 'healthy',
    timestamp: new Date()
  };
}
