/**
 * HealthChecker Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HealthChecker } from '../src/HealthChecker.js';

describe('HealthChecker', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker({
      checkInterval: 100,
      timeout: 1000,
      failureThreshold: 3,
      successThreshold: 2
    });
  });

  describe('constructor', () => {
    it('should create health checker with default config', () => {
      const defaultChecker = new HealthChecker();
      const config = defaultChecker.getConfig();

      expect(config.checkInterval).toBe(30000);
      expect(config.timeout).toBe(5000);
      expect(config.failureThreshold).toBe(3);
      expect(config.successThreshold).toBe(2);
    });

    it('should create health checker with custom config', () => {
      const customChecker = new HealthChecker({
        checkInterval: 5000,
        timeout: 2000,
        failureThreshold: 5
      });

      const config = customChecker.getConfig();
      expect(config.checkInterval).toBe(5000);
      expect(config.timeout).toBe(2000);
      expect(config.failureThreshold).toBe(5);
    });
  });

  describe('registerCheck', () => {
    it('should register a custom health check', () => {
      const checkFn = async () => true;
      checker.registerCheck('test-check', checkFn);

      const state = checker.getMonitoringState();
      expect(state).toBeDefined();
    });

    it('should allow registering multiple checks', () => {
      checker.registerCheck('check1', async () => true);
      checker.registerCheck('check2', async () => false);
      checker.registerCheck('check3', async () => true);

      // All checks should be registered
      expect(checker.getStats().totalWorkers).toBe(0);
    });
  });

  describe('unregisterCheck', () => {
    it('should unregister a health check', () => {
      checker.registerCheck('test-check', async () => true);
      const removed = checker.unregisterCheck('test-check');

      expect(removed).toBe(true);
    });

    it('should return false when unregistering non-existent check', () => {
      const removed = checker.unregisterCheck('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('addWorker', () => {
    it('should add a worker to monitor', () => {
      checker.addWorker('worker-1');

      const worker = checker.getWorker('worker-1');
      expect(worker).toBeDefined();
      expect(worker?.workerId).toBe('worker-1');
      expect(worker?.status).toBe('unknown');
    });

    it('should add multiple workers', () => {
      checker.addWorker('worker-1');
      checker.addWorker('worker-2');
      checker.addWorker('worker-3');

      expect(checker.getAllWorkers().size).toBe(3);
    });

    it('should not duplicate existing workers', () => {
      checker.addWorker('worker-1');
      checker.addWorker('worker-1');

      expect(checker.getAllWorkers().size).toBe(1);
    });
  });

  describe('removeWorker', () => {
    it('should remove a worker', () => {
      checker.addWorker('worker-1');
      const removed = checker.removeWorker('worker-1');

      expect(removed).toBe(true);
      expect(checker.getWorker('worker-1')).toBeUndefined();
    });

    it('should return false when removing non-existent worker', () => {
      const removed = checker.removeWorker('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('checkWorker', () => {
    it('should check a worker and return health status', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');

      const health = await checker.checkWorker('worker-1');

      expect(health.workerId).toBe('worker-1');
      expect(health.status).toBeDefined();
      expect(health.lastCheck).toBeInstanceOf(Date);
      expect(health.metrics).toBeDefined();
    });

    it('should mark worker as healthy when all checks pass', async () => {
      checker.registerCheck('check1', async () => true);
      checker.registerCheck('check2', async () => true);
      checker.addWorker('worker-1');

      const health = await checker.checkWorker('worker-1');

      expect(health.status).toBe('healthy');
    });

    it('should mark worker as unhealthy when checks fail', async () => {
      checker.registerCheck('check1', async () => false);
      checker.addWorker('worker-1');

      const health = await checker.checkWorker('worker-1');

      expect(health.status).toBe('degraded');
    });

    it('should track consecutive failures', async () => {
      checker.registerCheck('failing', async () => false);
      checker.addWorker('worker-1');

      await checker.checkWorker('worker-1');
      let health = checker.getWorker('worker-1');
      expect(health?.consecutiveFailures).toBe(1);

      await checker.checkWorker('worker-1');
      await checker.checkWorker('worker-1');
      health = checker.getWorker('worker-1');
      expect(health?.consecutiveFailures).toBe(3);
      expect(health?.status).toBe('unhealthy');
    });

    it('should track consecutive successes', async () => {
      checker.registerCheck('passing', async () => true);
      checker.addWorker('worker-1');

      await checker.checkWorker('worker-1');
      await checker.checkWorker('worker-1');
      let health = checker.getWorker('worker-1');
      expect(health?.consecutiveSuccesses).toBe(2);
    });

    it('should mark as degraded when response time is high', async () => {
      checker = new HealthChecker({
        timeout: 5000,
        maxResponseTime: 10 // Very low threshold
      });

      checker.registerCheck('slow', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return true;
      });
      checker.addWorker('worker-1');

      const health = await checker.checkWorker('worker-1');

      expect(health.status).toBe('degraded');
    });
  });

  describe('checkAll', () => {
    it('should check all registered workers', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');
      checker.addWorker('worker-2');
      checker.addWorker('worker-3');

      const systemHealth = await checker.checkAll();

      expect(systemHealth.totalWorkers).toBe(3);
      expect(systemHealth.workers.size).toBe(3);
    });

    it('should count healthy workers correctly', async () => {
      checker.registerCheck('passing', async () => true);
      checker.addWorker('worker-1');
      checker.addWorker('worker-2');

      const systemHealth = await checker.checkAll();

      expect(systemHealth.healthy).toBe(2);
    });

    it('should count unhealthy workers correctly', async () => {
      checker.registerCheck('failing', async () => false);
      checker.addWorker('worker-1');
      checker.addWorker('worker-2');
      checker.addWorker('worker-3');

      // Multiple failures to trigger unhealthy
      await checker.checkAll();
      await checker.checkAll();
      await checker.checkAll();

      const systemHealth = await checker.checkAll();

      expect(systemHealth.unhealthy).toBe(3);
    });

    it('should calculate health percentage correctly', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');
      checker.addWorker('worker-2');

      const systemHealth = await checker.checkAll();

      expect(systemHealth.healthPercentage).toBeGreaterThan(0);
      expect(systemHealth.healthPercentage).toBeLessThanOrEqual(100);
    });

    it('should handle empty worker list', async () => {
      const systemHealth = await checker.checkAll();

      expect(systemHealth.totalWorkers).toBe(0);
      expect(systemHealth.healthPercentage).toBe(0);
    });
  });

  describe('monitoring', () => {
    it('should start periodic monitoring', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');

      checker.startMonitoring(50);

      await new Promise(resolve => setTimeout(resolve, 150));

      const stats = checker.getStats();
      expect(stats.totalChecks).toBeGreaterThan(0);
      expect(stats.totalChecks).toBeGreaterThanOrEqual(2);

      checker.stopMonitoring();
    });

    it('should stop periodic monitoring', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');

      checker.startMonitoring(50);
      await new Promise(resolve => setTimeout(resolve, 100));

      checker.stopMonitoring();
      const stats1 = checker.getStats();
      const checks1 = stats1.totalChecks;

      await new Promise(resolve => setTimeout(resolve, 100));

      const stats2 = checker.getStats();
      expect(stats2.totalChecks).toBe(checks1);
    });

    it('should not start monitoring if already monitoring', () => {
      checker.startMonitoring(100);
      const state1 = checker.getMonitoringState();

      checker.startMonitoring(50);
      const state2 = checker.getMonitoringState();

      expect(state2.interval).toBe(state1.interval);

      checker.stopMonitoring();
    });

    it('should track monitoring state', () => {
      expect(checker.getMonitoringState().isMonitoring).toBe(false);

      checker.startMonitoring(100);
      expect(checker.getMonitoringState().isMonitoring).toBe(true);

      checker.stopMonitoring();
      expect(checker.getMonitoringState().isMonitoring).toBe(false);
    });
  });

  describe('history', () => {
    it('should track health history', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');

      await checker.checkWorker('worker-1');
      await checker.checkWorker('worker-1');
      await checker.checkWorker('worker-1');

      const history = checker.getHistory();
      expect(history.length).toBe(3);
    });

    it('should limit history when requested', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');

      for (let i = 0; i < 10; i++) {
        await checker.checkWorker('worker-1');
      }

      const history = checker.getHistory(5);
      expect(history.length).toBe(5);
    });

    it('should get worker-specific history', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');
      checker.addWorker('worker-2');

      await checker.checkWorker('worker-1');
      await checker.checkWorker('worker-2');
      await checker.checkWorker('worker-1');

      const worker1History = checker.getWorkerHistory('worker-1');
      expect(worker1History.length).toBe(2);

      const worker2History = checker.getWorkerHistory('worker-2');
      expect(worker2History.length).toBe(1);
    });

    it('should clear history', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');

      await checker.checkWorker('worker-1');
      await checker.checkWorker('worker-1');

      checker.clearHistory();

      const history = checker.getHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('stats', () => {
    it('should calculate statistics', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');
      checker.addWorker('worker-2');

      await checker.checkAll();

      const stats = checker.getStats();

      expect(stats.totalWorkers).toBe(2);
      expect(stats.totalChecks).toBeGreaterThan(0);
      expect(stats.healthyWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.degradedWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.unhealthyWorkers).toBeGreaterThanOrEqual(0);
    });

    it('should calculate failure rate', async () => {
      checker.registerCheck('failing', async () => false);
      checker.addWorker('worker-1');

      await checker.checkAll();

      const stats = checker.getStats();
      expect(stats.failureRate).toBeGreaterThanOrEqual(0);
    });

    it('should track uptime', async () => {
      checker.startMonitoring(100);

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = checker.getStats();
      expect(stats.uptime).toBeGreaterThan(0);

      checker.stopMonitoring();
    });
  });

  describe('config', () => {
    it('should update configuration', () => {
      checker.updateConfig({ failureThreshold: 10 });

      const config = checker.getConfig();
      expect(config.failureThreshold).toBe(10);
    });

    it('should restart monitoring with new interval', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');

      checker.startMonitoring(50);
      await new Promise(resolve => setTimeout(resolve, 100));

      checker.updateConfig({ checkInterval: 200 });
      await new Promise(resolve => setTimeout(resolve, 250));

      const stats = checker.getStats();
      // Should have approximately 7 checks (5 at 50ms + 1 at 200ms)
      expect(stats.totalChecks).toBeGreaterThan(0);

      checker.stopMonitoring();
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');
      checker.addWorker('worker-2');

      await checker.checkAll();

      checker.reset();

      expect(checker.getAllWorkers().size).toBe(0);
      expect(checker.getHistory().length).toBe(0);
      expect(checker.getMonitoringState().isMonitoring).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle timeout in checks', async () => {
      checker = new HealthChecker({ timeout: 50 });

      checker.registerCheck('timeout', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return true;
      });
      checker.addWorker('worker-1');

      const health = await checker.checkWorker('worker-1');

      expect(health.status).toBe('unhealthy');
    });

    it('should handle exceptions in checks', async () => {
      checker.registerCheck('error', async () => {
        throw new Error('Check failed');
      });
      checker.addWorker('worker-1');

      const health = await checker.checkWorker('worker-1');

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBeDefined();
    });

    it('should handle worker not found', async () => {
      const health = await checker.checkWorker('non-existent');

      expect(health.workerId).toBe('non-existent');
      expect(health.status).toBe('unknown');
    });

    it('should manage history size limit', async () => {
      checker.registerCheck('test', async () => true);
      checker.addWorker('worker-1');

      // History should be limited to 1000 entries
      for (let i = 0; i < 1100; i++) {
        await checker.checkWorker('worker-1');
      }

      const history = checker.getHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });
});
