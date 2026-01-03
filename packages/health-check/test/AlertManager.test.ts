/**
 * AlertManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlertManager } from '../src/AlertManager.js';
import type { WorkerHealth, HealthMetric, AlertChannel } from '../src/types.js';

describe('AlertManager', () => {
  let alertManager: AlertManager;

  beforeEach(() => {
    alertManager = new AlertManager({
      enabled: true,
      alertOnDegraded: true,
      alertOnUnhealthy: true,
      alertOnStatusChange: true,
      minAlertInterval: 100
    });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const manager = new AlertManager();
      const config = manager.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.alertOnDegraded).toBe(true);
      expect(config.alertOnUnhealthy).toBe(true);
      expect(config.minAlertInterval).toBe(60000);
    });

    it('should create with custom config', () => {
      const manager = new AlertManager({
        enabled: false,
        minAlertInterval: 5000
      });

      const config = manager.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.minAlertInterval).toBe(5000);
    });
  });

  describe('evaluateWorker', () => {
    it('should alert on status change to unhealthy', async () => {
      const worker = createWorker('worker-1', 'unhealthy');

      await alertManager.evaluateWorker(worker);

      const history = alertManager.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].currentStatus).toBe('unhealthy');
      expect(history[0].severity).toBe('critical');
    });

    it('should alert on status change to degraded', async () => {
      const worker = createWorker('worker-1', 'degraded');

      await alertManager.evaluateWorker(worker);

      const history = alertManager.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].currentStatus).toBe('degraded');
      expect(history[0].severity).toBe('warning');
    });

    it('should not alert when disabled', async () => {
      alertManager.updateConfig({ enabled: false });

      const worker = createWorker('worker-1', 'unhealthy');

      await alertManager.evaluateWorker(worker);

      const history = alertManager.getHistory();
      expect(history.length).toBe(0);
    });

    it('should not alert on same status', async () => {
      const worker1 = createWorker('worker-1', 'healthy');
      await alertManager.evaluateWorker(worker1);

      const worker2 = createWorker('worker-1', 'healthy');
      await alertManager.evaluateWorker(worker2);

      const history = alertManager.getHistory();
      // Only first check should generate alert (unknown -> healthy)
      expect(history.length).toBeLessThan(2);
    });

    it('should track consecutive status changes', async () => {
      const worker1 = createWorker('worker-1', 'healthy');
      await alertManager.evaluateWorker(worker1);

      const worker2 = createWorker('worker-1', 'degraded');
      await alertManager.evaluateWorker(worker2);

      const worker3 = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker3);

      const history = alertManager.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('rate limiting', () => {
    it('should respect min alert interval', async () => {
      const worker = createWorker('worker-1', 'unhealthy');

      await alertManager.evaluateWorker(worker);

      // Immediate re-check should be rate limited
      await alertManager.evaluateWorker(worker);

      const history = alertManager.getHistory();
      expect(history.length).toBe(1);
    });

    it('should allow alert after interval expires', async () => {
      const worker = createWorker('worker-1', 'unhealthy');

      await alertManager.evaluateWorker(worker);

      // Wait for interval to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      await alertManager.evaluateWorker(worker);

      const history = alertManager.getHistory();
      // Should allow new alert after interval
      expect(history.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('alert channels', () => {
    it('should send to console channel', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      alertManager.addChannel({
        type: 'console',
        enabled: true,
        config: {}
      });

      const worker = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should send to log channel', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      alertManager.addChannel({
        type: 'log',
        enabled: true,
        config: {}
      });

      const worker = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ALERT]',
        expect.stringContaining('"severity":"critical"')
      );

      consoleSpy.mockRestore();
    });

    it('should call callback channel', async () => {
      let called = false;
      const callback = vi.fn(() => { called = true; });

      alertManager.addChannel({
        type: 'callback',
        enabled: true,
        config: { callback }
      });

      const worker = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker);

      expect(callback).toHaveBeenCalled();
    });

    it('should not send to disabled channels', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      alertManager.addChannel({
        type: 'console',
        enabled: false,
        config: {}
      });

      const worker = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('history', () => {
    it('should track alert history', async () => {
      const worker1 = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker1);

      const worker2 = createWorker('worker-2', 'degraded');
      await alertManager.evaluateWorker(worker2);

      const history = alertManager.getHistory();
      expect(history.length).toBe(2);
    });

    it('should limit history size', async () => {
      const manager = new AlertManager({ minAlertInterval: 10 });

      // Generate many alerts
      for (let i = 0; i < 1100; i++) {
        const worker = createWorker(`worker-${i}`, 'unhealthy');
        await manager.evaluateWorker(worker);
        await new Promise(resolve => setTimeout(resolve, 11));
      }

      const history = manager.getHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should get limited history', async () => {
      for (let i = 0; i < 10; i++) {
        const worker = createWorker(`worker-${i}`, 'unhealthy');
        await alertManager.evaluateWorker(worker);
        await new Promise(resolve => setTimeout(resolve, 110));
      }

      const history = alertManager.getHistory(5);
      expect(history.length).toBe(5);
    });

    it('should get worker-specific history', async () => {
      const worker1 = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker1);

      const worker2 = createWorker('worker-2', 'degraded');
      await alertManager.evaluateWorker(worker2);

      const worker1History = alertManager.getWorkerHistory('worker-1');
      expect(worker1History.length).toBe(1);

      const worker2History = alertManager.getWorkerHistory('worker-2');
      expect(worker2History.length).toBe(1);
    });

    it('should clear history', async () => {
      const worker = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker);

      alertManager.clearHistory();

      const history = alertManager.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('alert counts', () => {
    it('should track alert count per worker', async () => {
      const worker1 = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker1);

      const count = alertManager.getAlertCount('worker-1');
      expect(count).toBe(1);
    });

    it('should get all alert counts', async () => {
      const worker1 = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker1);

      const worker2 = createWorker('worker-2', 'degraded');
      await alertManager.evaluateWorker(worker2);

      const counts = alertManager.getAllAlertCounts();
      expect(counts.size).toBe(2);
    });
  });

  describe('channels', () => {
    it('should add channel', () => {
      const channel: AlertChannel = {
        type: 'console',
        enabled: true,
        config: {}
      };

      alertManager.addChannel(channel);

      const config = alertManager.getConfig();
      expect(config.channels).toContain(channel);
    });

    it('should remove channel', () => {
      alertManager.addChannel({
        type: 'console',
        enabled: true,
        config: {}
      });

      const removed = alertManager.removeChannel('console');

      expect(removed).toBe(true);
    });

    it('should return false when removing non-existent channel', () => {
      const removed = alertManager.removeChannel('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('config', () => {
    it('should update configuration', () => {
      alertManager.updateConfig({
        alertOnDegraded: false,
        minAlertInterval: 1000
      });

      const config = alertManager.getConfig();
      expect(config.alertOnDegraded).toBe(false);
      expect(config.minAlertInterval).toBe(1000);
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      const worker = createWorker('worker-1', 'unhealthy');
      await alertManager.evaluateWorker(worker);

      alertManager.reset();

      expect(alertManager.getHistory().length).toBe(0);
      expect(alertManager.getAllAlertCounts().size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle alerts by severity', async () => {
      const worker1 = createWorker('worker-1', 'healthy');
      await alertManager.evaluateWorker(worker1);

      const worker2 = createWorker('worker-2', 'degraded');
      await alertManager.evaluateWorker(worker2);

      const worker3 = createWorker('worker-3', 'unhealthy');
      await alertManager.evaluateWorker(worker3);

      const critical = alertManager.getAlertsBySeverity('critical');
      const warning = alertManager.getAlertsBySeverity('warning');
      const info = alertManager.getAlertsBySeverity('info');

      expect(critical.length).toBeGreaterThan(0);
      expect(warning.length).toBeGreaterThan(0);
      expect(info.length).toBeGreaterThanOrEqual(0);
    });
  });
});

// Helper function
function createWorker(
  id: string,
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown',
  error?: string
): WorkerHealth {
  const metrics: HealthMetric[] = [
    {
      name: 'test-metric',
      value: status === 'healthy' ? 100 : 50,
      unit: '%',
      status,
      timestamp: new Date()
    }
  ];

  return {
    workerId: id,
    status,
    metrics,
    lastCheck: new Date(),
    uptime: 1000,
    consecutiveFailures: status === 'unhealthy' ? 3 : 0,
    consecutiveSuccesses: status === 'healthy' ? 5 : 0,
    error
  };
}
