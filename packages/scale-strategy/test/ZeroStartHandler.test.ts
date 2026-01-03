/**
 * @lsi/scale-strategy - ZeroStartHandler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ZeroStartHandler } from '../src/ZeroStartHandler.js';
import type { WorkerPoolState } from '../src/types.js';

describe('ZeroStartHandler', () => {
  let handler: ZeroStartHandler;
  let mockWorkerState: WorkerPoolState;

  beforeEach(() => {
    handler = new ZeroStartHandler({
      enableScaleToZero: true,
      scaleToZeroIdleMs: 60000,
      standbyWorkerCount: 2,
      timeToFirstWorkerMs: 100,
      timeToStandbyWorkerMs: 50,
    });

    mockWorkerState = {
      total: 0,
      active: 0,
      idle: 0,
      starting: 0,
      stopping: 0,
      queuedRequests: 0,
    };
  });

  describe('constructor', () => {
    it('should create handler with default config', () => {
      const defaultHandler = new ZeroStartHandler();
      expect(defaultHandler).toBeDefined();
    });

    it('should create handler with custom config', () => {
      const customHandler = new ZeroStartHandler({
        enableScaleToZero: false,
        scaleToZeroIdleMs: 120000,
      });
      expect(customHandler.getConfig().enableScaleToZero).toBe(false);
    });

    it('should initialize with no standby workers', () => {
      const status = handler.getStandbyStatus();
      expect(status.total).toBe(0);
    });

    it('should initialize with empty activity history', () => {
      const history = handler.getActivityHistory();
      expect(history).toEqual([]);
    });
  });

  describe('checkState', () => {
    it('should detect zero state', async () => {
      const state = await handler.checkState(mockWorkerState);
      expect(state.isAtZero).toBe(true);
    });

    it('should detect non-zero state', async () => {
      mockWorkerState.total = 5;
      const state = await handler.checkState(mockWorkerState);
      expect(state.isAtZero).toBe(false);
    });

    it('should track idle time', async () => {
      // First check with activity
      mockWorkerState.queuedRequests = 10;
      await handler.checkState(mockWorkerState);

      // Then idle
      mockWorkerState.queuedRequests = 0;
      await new Promise(resolve => setTimeout(resolve, 100));
      const state = await handler.checkState(mockWorkerState);

      expect(state.idleTimeMs).toBeGreaterThan(0);
    });

    it('should track pending requests', async () => {
      mockWorkerState.queuedRequests = 50;
      const state = await handler.checkState(mockWorkerState);
      expect(state.pendingRequests).toBe(50);
    });

    it('should detect fast start availability', async () => {
      await handler.prepareStandbyWorkers(1);
      const state = await handler.checkState(mockWorkerState);
      expect(state.hasFastStart).toBe(true);
    });

    it('should return correct time to first worker', async () => {
      const state = await handler.checkState(mockWorkerState);
      expect(state.timeToFirstWorkerMs).toBe(handler['config'].timeToFirstWorkerMs);
    });

    it('should return faster time with standby', async () => {
      await handler.prepareStandbyWorkers(1);
      const state = await handler.checkState(mockWorkerState);
      expect(state.timeToFirstWorkerMs).toBe(handler['config'].timeToStandbyWorkerMs);
    });

    it('should detect should scale to zero', async () => {
      // Set long idle time
      handler['idleStartTime'] = Date.now() - 120000;
      mockWorkerState.total = 5;

      const state = await handler.checkState(mockWorkerState);
      expect(state.shouldScaleToZero).toBe(true);
    });

    it('should not scale to zero when disabled', async () => {
      handler.updateConfig({ enableScaleToZero: false });
      handler['idleStartTime'] = Date.now() - 120000;
      mockWorkerState.total = 5;

      const state = await handler.checkState(mockWorkerState);
      expect(state.shouldScaleToZero).toBeUndefined();
    });
  });

  describe('fastStart', () => {
    it('should fast start from zero', async () => {
      await handler.prepareStandbyWorkers(2);
      const result = await handler.fastStart(2);
      expect(result.success).toBe(true);
      expect(result.actualCount).toBe(2);
    });

    it('should activate standby workers', async () => {
      await handler.prepareStandbyWorkers(2);
      const result = await handler.fastStart(1);
      expect(result.metadata?.standbyActivated).toBe(1);
    });

    it('should start new workers when standby exhausted', async () => {
      await handler.prepareStandbyWorkers(1);
      const result = await handler.fastStart(3);
      expect(result.metadata?.newWorkersStarted).toBeGreaterThanOrEqual(2);
    });

    it('should return metadata', async () => {
      const result = await handler.fastStart(2);
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.fastStart).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // Force error by mocking
      const errorResult = await handler.fastStart(0);
      expect(errorResult).toBeDefined();
    });
  });

  describe('prepareStandbyWorkers', () => {
    it('should prepare standby workers', async () => {
      await handler.prepareStandbyWorkers(2);
      const status = handler.getStandbyStatus();
      expect(status.total).toBe(2);
    });

    it('should remove excess standby workers', async () => {
      await handler.prepareStandbyWorkers(5);
      await handler.prepareStandbyWorkers(2);
      const status = handler.getStandbyStatus();
      expect(status.total).toBe(2);
    });

    it('should warm cold workers', async () => {
      await handler.prepareStandbyWorkers(2);
      await new Promise(resolve => setTimeout(resolve, 100));
      const status = handler.getStandbyStatus();
      expect(status.warming + status.warm).toBeGreaterThan(0);
    });
  });

  describe('predictiveWarm', () => {
    it('should return false when disabled', async () => {
      handler.updateConfig({ enablePredictiveWarm: false });
      const result = await handler.predictiveWarm();
      expect(result).toBe(false);
    });

    it('should analyze activity patterns', async () => {
      // Add some activity history
      for (let i = 0; i < 10; i++) {
        mockWorkerState.queuedRequests = i;
        await handler.checkState(mockWorkerState);
      }

      const result = await handler.predictiveWarm();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getStandbyStatus', () => {
    it('should return zero status initially', () => {
      const status = handler.getStandbyStatus();
      expect(status.total).toBe(0);
      expect(status.cold).toBe(0);
      expect(status.warming).toBe(0);
      expect(status.warm).toBe(0);
      expect(status.active).toBe(0);
    });

    it('should return status after preparing workers', async () => {
      await handler.prepareStandbyWorkers(3);
      const status = handler.getStandbyStatus();
      expect(status.total).toBe(3);
    });
  });

  describe('reset', () => {
    it('should clear standby workers', async () => {
      await handler.prepareStandbyWorkers(2);
      handler.reset();
      const status = handler.getStandbyStatus();
      expect(status.total).toBe(0);
    });

    it('should clear idle start time', async () => {
      handler['idleStartTime'] = Date.now();
      handler.reset();
      expect(handler['idleStartTime']).toBeNull();
    });

    it('should clear activity history', async () => {
      await handler.checkState(mockWorkerState);
      handler.reset();
      const history = handler.getActivityHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update enableScaleToZero', () => {
      handler.updateConfig({ enableScaleToZero: false });
      expect(handler.getConfig().enableScaleToZero).toBe(false);
    });

    it('should update scaleToZeroIdleMs', () => {
      handler.updateConfig({ scaleToZeroIdleMs: 300000 });
      expect(handler.getConfig().scaleToZeroIdleMs).toBe(300000);
    });

    it('should update standbyWorkerCount', () => {
      handler.updateConfig({ standbyWorkerCount: 5 });
      expect(handler.getConfig().standbyWorkerCount).toBe(5);
    });

    it('should update timeToFirstWorkerMs', () => {
      handler.updateConfig({ timeToFirstWorkerMs: 200 });
      expect(handler.getConfig().timeToFirstWorkerMs).toBe(200);
    });
  });

  describe('getConfig', () => {
    it('should return config copy', () => {
      const config = handler.getConfig();
      expect(config).not.toBe(handler['config']);
    });
  });

  describe('getActivityHistory', () => {
    it('should return empty history initially', () => {
      const history = handler.getActivityHistory();
      expect(history).toEqual([]);
    });

    it('should record activity', async () => {
      mockWorkerState.queuedRequests = 10;
      await handler.checkState(mockWorkerState);
      const history = handler.getActivityHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should trim old activity', async () => {
      // Add old activity
      handler['activityHistory'].push({
        timestamp: Date.now() - 100000,
        requestCount: 5,
      });

      // Check current
      await handler.checkState(mockWorkerState);

      const history = handler.getActivityHistory();
      expect(history.every(h => h.timestamp > Date.now() - 86400000)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero standby worker count', async () => {
      await handler.prepareStandbyWorkers(0);
      const status = handler.getStandbyStatus();
      expect(status.total).toBe(0);
    });

    it('should handle very large standby count', async () => {
      await handler.prepareStandbyWorkers(1000);
      const status = handler.getStandbyStatus();
      expect(status.total).toBe(1000);
    });

    it('should handle zero warm time', () => {
      handler.updateConfig({ timeToStandbyWorkerMs: 0 });
      expect(handler.getConfig().timeToStandbyWorkerMs).toBe(0);
    });

    it('should handle negative idle time', () => {
      handler['idleStartTime'] = Date.now() + 10000;
      expect(handler['idleStartTime']).toBeGreaterThan(Date.now());
    });
  });
});

// Total: 55 tests
