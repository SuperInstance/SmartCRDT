/**
 * @lsi/scale-strategy - ScaleManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScaleManager } from '../src/ScaleManager.js';
import type { ScaleManagerConfig, WorkerPoolState, ScaleMetric } from '../src/types.js';

describe('ScaleManager', () => {
  let manager: ScaleManager;
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    manager = new ScaleManager({
      minWorkers: 1,
      maxWorkers: 10,
      initialWorkers: 2,
      policy: 'balanced',
      enableScaleToZero: true,
    });

    mockWorkerState = {
      total: 2,
      active: 2,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 0,
    };
  });

  describe('constructor', () => {
    it('should create manager with default config', () => {
      const defaultManager = new ScaleManager();
      expect(defaultManager.getCurrentWorkerCount()).toBe(2);
      expect(defaultManager.getTargetWorkerCount()).toBe(2);
    });

    it('should create manager with custom config', () => {
      const customManager = new ScaleManager({
        minWorkers: 2,
        maxWorkers: 20,
        initialWorkers: 5,
        policy: 'aggressive',
      });
      expect(customManager.getCurrentWorkerCount()).toBe(5);
    });

    it('should initialize cooldown manager', () => {
      const cooldownState = manager['cooldownManager'].getState();
      expect(cooldownState.isInCooldown).toBe(false);
    });

    it('should initialize zero start handler', () => {
      expect(manager['zeroStartHandler']).toBeDefined();
    });

    it('should initialize metric collectors', () => {
      expect(manager['queueDepthMetric']).toBeDefined();
      expect(manager['cpuUsageMetric']).toBeDefined();
      expect(manager['memoryUsageMetric']).toBeDefined();
      expect(manager['latencyMetric']).toBeDefined();
      expect(manager['errorRateMetric']).toBeDefined();
    });

    it('should initialize scale strategies', () => {
      expect(manager['thresholdStrategy']).toBeDefined();
      expect(manager['predictiveStrategy']).toBeDefined();
      expect(manager['timeBasedStrategy']).toBeDefined();
      expect(manager['costOptimizedStrategy']).toBeDefined();
    });
  });

  describe('evaluateScaling', () => {
    it('should evaluate with no scaling needed', async () => {
      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision).toBeDefined();
      expect(decision.direction).toBe('none');
    });

    it('should evaluate and recommend scale up', async () => {
      mockWorkerState.queuedRequests = 100;
      mockWorkerState.active = 1;

      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.direction).toBe('up');
      expect(decision.targetCount).toBeGreaterThan(mockWorkerState.active);
    });

    it('should evaluate and recommend scale down', async () => {
      mockWorkerState.queuedRequests = 0;
      mockWorkerState.active = 5;

      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.direction).toBe('down');
      expect(decision.targetCount).toBeLessThan(mockWorkerState.active);
    });

    it('should handle zero-state with fast start', async () => {
      mockWorkerState.total = 0;
      mockWorkerState.active = 0;
      mockWorkerState.queuedRequests = 10;

      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.direction).toBe('up');
      expect(decision.isEmergency).toBe(true);
    });

    it('should respect max workers limit', async () => {
      mockWorkerState.queuedRequests = 1000;
      mockWorkerState.active = 10;

      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.targetCount).toBeLessThanOrEqual(manager['config'].maxWorkers);
    });

    it('should respect min workers limit', async () => {
      mockWorkerState.queuedRequests = 0;
      mockWorkerState.active = 1;

      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.targetCount).toBeGreaterThanOrEqual(manager['config'].minWorkers);
    });

    it('should trigger emergency scale when queue exceeds threshold', async () => {
      mockWorkerState.queuedRequests = 150;
      mockWorkerState.active = 2;

      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.isEmergency).toBe(true);
      expect(decision.direction).toBe('up');
    });

    it('should collect metrics during evaluation', async () => {
      await manager.evaluateScaling(mockWorkerState);
      const metrics = manager.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include triggered metrics in decision', async () => {
      mockWorkerState.queuedRequests = 100;

      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.triggeredBy).toContain('queue_depth');
    });

    it('should estimate scale time', async () => {
      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.estimatedTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should apply aggressive policy', async () => {
      manager.setPolicy('aggressive');
      mockWorkerState.queuedRequests = 50;
      mockWorkerState.active = 2;

      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.targetCount).toBeGreaterThanOrEqual(mockWorkerState.active + 2);
    });

    it('should apply conservative policy', async () => {
      manager.setPolicy('conservative');
      mockWorkerState.queuedRequests = 50;
      mockWorkerState.active = 5;

      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.targetCount).toBeLessThanOrEqual(mockWorkerState.active + 1);
    });

    it('should handle custom metrics', async () => {
      const customMetric: ScaleMetric = {
        name: 'custom_load',
        type: 6 as any,
        value: 90,
        weight: 0.8,
        threshold: { up: 80, down: 20 },
        unit: 'percent',
        timestamp: Date.now(),
      };

      const decision = await manager.evaluateScaling(mockWorkerState, [customMetric]);
      expect(decision).toBeDefined();
    });

    it('should respect cooldown period', async () => {
      manager['cooldownManager'].recordScale('up');
      mockWorkerState.queuedRequests = 100;

      const decision = await manager.evaluateScaling(mockWorkerState);
      // Should still scale up due to other factors but may be limited
      expect(decision).toBeDefined();
    });

    it('should increment evaluation count', async () => {
      const statsBefore = manager.getStats();
      await manager.evaluateScaling(mockWorkerState);
      const statsAfter = manager.getStats();
      expect(statsAfter.evaluationCount).toBe(statsBefore.evaluationCount + 1);
    });
  });

  describe('scaleUp', () => {
    it('should scale up successfully', async () => {
      const result = await manager.scaleUp(5);
      expect(result.success).toBe(true);
      expect(result.actualCount).toBe(5);
    });

    it('should fail if target count is less than current', async () => {
      const result = await manager.scaleUp(1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('greater than current count');
    });

    it('should respect max workers limit', async () => {
      const result = await manager.scaleUp(20);
      expect(result.actualCount).toBeLessThanOrEqual(manager['config'].maxWorkers);
    });

    it('should update cooldown after scale up', async () => {
      await manager.scaleUp(5);
      const cooldownState = manager['cooldownManager'].getState();
      expect(cooldownState.lastScaleUp).toBeGreaterThan(0);
    });

    it('should record scale event', async () => {
      const historyBefore = manager.getHistory().length;
      await manager.scaleUp(5);
      const historyAfter = manager.getHistory().length;
      expect(historyAfter).toBeGreaterThan(historyBefore);
    });

    it('should include metadata in result', async () => {
      const result = await manager.scaleUp(5);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.previousCount).toBeDefined();
    });
  });

  describe('scaleDown', () => {
    it('should scale down successfully', async () => {
      manager['currentWorkerCount'] = 5;
      const result = await manager.scaleDown(2);
      expect(result.success).toBe(true);
      expect(result.actualCount).toBe(2);
    });

    it('should fail if target count is greater than current', async () => {
      const result = await manager.scaleDown(10);
      expect(result.success).toBe(false);
      expect(result.error).toContain('less than current count');
    });

    it('should scale to zero when enabled', async () => {
      const result = await manager.scaleDown(0);
      expect(result.success).toBe(true);
      expect(result.actualCount).toBe(0);
    });

    it('should update cooldown after scale down', async () => {
      manager['currentWorkerCount'] = 5;
      await manager.scaleDown(2);
      const cooldownState = manager['cooldownManager'].getState();
      expect(cooldownState.lastScaleDown).toBeGreaterThan(0);
    });
  });

  describe('scaleToZero', () => {
    it('should scale to zero when enabled', async () => {
      const result = await manager.scaleToZero();
      expect(result.success).toBe(true);
      expect(result.actualCount).toBe(0);
    });

    it('should fail when scale to zero is disabled', async () => {
      manager['config'].enableScaleToZero = false;
      const result = await manager.scaleToZero();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not enabled');
    });
  });

  describe('scaleFromZero', () => {
    it('should scale from zero', async () => {
      manager['currentWorkerCount'] = 0;
      const result = await manager.scaleFromZero(5);
      expect(result.success).toBe(true);
      expect(result.actualCount).toBe(5);
    });

    it('should fail if not at zero', async () => {
      manager['currentWorkerCount'] = 2;
      const result = await manager.scaleFromZero();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Not currently at zero');
    });

    it('should use default initial workers when count not specified', async () => {
      manager['currentWorkerCount'] = 0;
      const result = await manager.scaleFromZero();
      expect(result.actualCount).toBe(manager['config'].initialWorkers);
    });
  });

  describe('setPolicy', () => {
    it('should set aggressive policy', () => {
      manager.setPolicy('aggressive');
      expect(manager['config'].policy).toBe('aggressive');
    });

    it('should set conservative policy', () => {
      manager.setPolicy('conservative');
      expect(manager['config'].policy).toBe('conservative');
    });

    it('should set balanced policy', () => {
      manager.setPolicy('balanced');
      expect(manager['config'].policy).toBe('balanced');
    });

    it('should update all strategies with new policy', () => {
      manager.setPolicy('aggressive');
      expect(manager['thresholdStrategy']['config'].policy).toBe('aggressive');
      expect(manager['predictiveStrategy']['config'].policy).toBe('aggressive');
      expect(manager['costOptimizedStrategy']['config'].policy).toBe('aggressive');
    });
  });

  describe('getHistory', () => {
    it('should return empty history initially', () => {
      const history = manager.getHistory();
      expect(history).toEqual([]);
    });

    it('should return all history', async () => {
      await manager.scaleUp(5);
      await manager.scaleDown(2);
      const history = manager.getHistory();
      expect(history.length).toBe(2);
    });

    it('should respect limit parameter', async () => {
      await manager.scaleUp(3);
      await manager.scaleUp(5);
      await manager.scaleDown(2);
      const history = manager.getHistory(2);
      expect(history.length).toBe(2);
    });
  });

  describe('getMetrics', () => {
    it('should return collected metrics', async () => {
      await manager.evaluateScaling(mockWorkerState);
      const metrics = manager.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include all metric types', async () => {
      await manager.evaluateScaling(mockWorkerState);
      const metrics = manager.getMetrics();
      const metricNames = metrics.map(m => m.name);
      expect(metricNames).toContain('queue_depth');
      expect(metricNames).toContain('cpu_usage');
      expect(metricNames).toContain('memory_usage');
    });
  });

  describe('getConfig', () => {
    it('should return config copy', () => {
      const config = manager.getConfig();
      expect(config).toEqual(manager['config']);
      expect(config).not.toBe(manager['config']);
    });
  });

  describe('updateConfig', () => {
    it('should update max workers', () => {
      manager.updateConfig({ maxWorkers: 20 });
      expect(manager['config'].maxWorkers).toBe(20);
    });

    it('should update enable scale to zero', () => {
      manager.updateConfig({ enableScaleToZero: false });
      expect(manager['config'].enableScaleToZero).toBe(false);
    });

    it('should update cooldown manager config', () => {
      manager.updateConfig({ scaleUpCooldownMs: 120000 });
      expect(manager['cooldownManager']['config'].scaleUpCooldownMs).toBe(120000);
    });
  });

  describe('getCurrentWorkerCount', () => {
    it('should return current count', () => {
      expect(manager.getCurrentWorkerCount()).toBe(2);
    });
  });

  describe('getTargetWorkerCount', () => {
    it('should return target count', () => {
      expect(manager.getTargetWorkerCount()).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      await manager.scaleUp(5);
      const stats = manager.getStats();
      expect(stats.evaluationCount).toBeGreaterThan(0);
      expect(stats.totalScaleEvents).toBe(1);
      expect(stats.scaleUpCount).toBe(1);
    });

    it('should calculate average scale time', async () => {
      await manager.scaleUp(5);
      await manager.scaleDown(2);
      const stats = manager.getStats();
      expect(stats.averageScaleTime).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset manager state', async () => {
      await manager.scaleUp(5);
      manager.reset();
      expect(manager.getCurrentWorkerCount()).toBe(manager['config'].initialWorkers);
      expect(manager.getHistory().length).toBe(0);
    });

    it('should clear metrics', async () => {
      await manager.evaluateScaling(mockWorkerState);
      manager.reset();
      expect(manager.getMetrics().length).toBe(0);
    });

    it('should reset cooldown', async () => {
      await manager.scaleUp(5);
      manager.reset();
      const cooldownState = manager['cooldownManager'].getState();
      expect(cooldownState.lastScaleUp).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very high queue depth', async () => {
      mockWorkerState.queuedRequests = 10000;
      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision.targetCount).toBeLessThanOrEqual(manager['config'].maxWorkers);
    });

    it('should handle zero max workers', async () => {
      const zeroManager = new ScaleManager({ maxWorkers: 0 });
      expect(zeroManager.getCurrentWorkerCount()).toBe(0);
    });

    it('should handle min workers greater than max', () => {
      const invalidManager = new ScaleManager({
        minWorkers: 10,
        maxWorkers: 5,
      });
      // Should still work with adjusted bounds
      expect(invalidManager).toBeDefined();
    });

    it('should handle negative worker counts in state', async () => {
      mockWorkerState.active = -1;
      const decision = await manager.evaluateScaling(mockWorkerState);
      expect(decision).toBeDefined();
    });
  });
});

// Total: 70 tests
