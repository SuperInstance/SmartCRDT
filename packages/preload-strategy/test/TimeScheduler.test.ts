/**
 * TimeScheduler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimeScheduler } from '../src/TimeScheduler.js';
import type { ModuleMetadata, Schedule } from '../src/types.js';

describe('TimeScheduler', () => {
  let scheduler: TimeScheduler;
  let testModule: ModuleMetadata;

  beforeEach(() => {
    scheduler = new TimeScheduler();
    testModule = {
      id: 'test-module',
      name: 'Test Module',
      version: '1.0.0',
      size: 10000,
      loadTime: 100,
      dependencies: [],
    };

    scheduler.registerModule(testModule);
  });

  afterEach(() => {
    scheduler.destroy();
  });

  describe('Module Management', () => {
    it('should register a module', () => {
      scheduler.registerModule(testModule);
      const module = scheduler.getModule('test-module');
      expect(module).toBeDefined();
      expect(module?.id).toBe('test-module');
    });

    it('should get all registered modules', () => {
      scheduler.registerModule({
        id: 'module-1',
        name: 'Module 1',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: [],
      });

      const modules = scheduler.getAllModules();
      expect(modules.length).toBeGreaterThan(0);
    });

    it('should unregister a module', () => {
      scheduler.unregisterModule('test-module');
      const module = scheduler.getModule('test-module');
      expect(module).toBeUndefined();
    });

    it('should return undefined for non-existent module', () => {
      const module = scheduler.getModule('non-existent');
      expect(module).toBeUndefined();
    });

    it('should remove schedules when module is unregistered', () => {
      scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      scheduler.unregisterModule('test-module');

      const schedules = scheduler.getSchedulesForModule('test-module');
      expect(schedules).toHaveLength(0);
    });
  });

  describe('Schedule Management', () => {
    it('should add a schedule', () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule).toBeDefined();
      expect(schedule?.moduleName).toBe('test-module');
    });

    it('should generate unique schedule IDs', () => {
      const id1 = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const id2 = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '30 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      expect(id1).not.toBe(id2);
    });

    it('should set created timestamp', () => {
      const before = Date.now();
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });
      const after = Date.now();

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.createdAt).toBeGreaterThanOrEqual(before);
      expect(schedule?.createdAt).toBeLessThanOrEqual(after);
    });

    it('should remove a schedule', () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const removed = scheduler.removeSchedule(scheduleId);
      expect(removed).toBe(true);

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule).toBeUndefined();
    });

    it('should return false when removing non-existent schedule', () => {
      const removed = scheduler.removeSchedule('non-existent');
      expect(removed).toBe(false);
    });

    it('should update a schedule', () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const updated = scheduler.updateSchedule(scheduleId, {
        enabled: false,
      });

      expect(updated).toBe(true);

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.enabled).toBe(false);
    });

    it('should return false when updating non-existent schedule', () => {
      const updated = scheduler.updateSchedule('non-existent', { enabled: false });
      expect(updated).toBe(false);
    });

    it('should update timestamp on modification', () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      scheduler.updateSchedule(scheduleId, { enabled: false });

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.updatedAt).toBeGreaterThan(schedule?.createdAt || 0);
    });

    it('should get all schedules', () => {
      scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '30 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const schedules = scheduler.getAllSchedules();
      expect(schedules.length).toBe(2);
    });

    it('should get schedules for a specific module', () => {
      scheduler.registerModule({
        id: 'module-2',
        name: 'Module 2',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: [],
      });

      scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      scheduler.addSchedule({
        moduleName: 'module-2',
        cron: '30 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const testModuleSchedules = scheduler.getSchedulesForModule('test-module');
      expect(testModuleSchedules).toHaveLength(1);
      expect(testModuleSchedules[0].moduleName).toBe('test-module');
    });

    it('should get active schedules', () => {
      const enabledId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '30 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: false,
      });

      const activeSchedules = scheduler.getActiveSchedules();
      expect(activeSchedules.length).toBe(1);
      expect(activeSchedules[0].id).toBe(enabledId);
    });

    it('should filter out schedules with max applications reached', () => {
      scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
        maxApplications: 0,
      });

      const activeSchedules = scheduler.getActiveSchedules();
      expect(activeSchedules).toHaveLength(0);
    });
  });

  describe('Schedule Execution', () => {
    it('should execute a schedule', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const result = await scheduler.executeSchedule(scheduleId);
      expect(result.success).toBe(true);
      expect(result.modulesPreloaded).toContain('test-module');
    });

    it('should return error for non-existent schedule', async () => {
      const result = await scheduler.executeSchedule('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Schedule not found');
    });

    it('should return error when schedule already running', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      // Start first execution (don't await)
      const promise1 = scheduler.executeSchedule(scheduleId);

      // Try to execute again while first is running
      const promise2 = scheduler.executeSchedule(scheduleId);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Schedule already running');
    });

    it('should respect max applications', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
        maxApplications: 1,
      });

      const result1 = await scheduler.executeSchedule(scheduleId);
      expect(result1.success).toBe(true);

      const result2 = await scheduler.executeSchedule(scheduleId);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Maximum applications reached');
    });

    it('should update application count', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      await scheduler.executeSchedule(scheduleId);

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.applicationCount).toBe(1);
    });

    it('should update last run timestamp', async () => {
      const before = Date.now();
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      await scheduler.executeSchedule(scheduleId);
      const after = Date.now();

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.lastRun).toBeGreaterThanOrEqual(before);
      expect(schedule?.lastRun).toBeLessThanOrEqual(after);
    });

    it('should preload dependencies', async () => {
      scheduler.registerModule({
        id: 'dep-module',
        name: 'Dependency Module',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: [],
      });

      const moduleWithDep: ModuleMetadata = {
        id: 'module-with-dep',
        name: 'Module With Dependency',
        version: '1.0.0',
        size: 10000,
        loadTime: 100,
        dependencies: ['dep-module'],
      };

      scheduler.registerModule(moduleWithDep);

      const scheduleId = scheduler.addSchedule({
        moduleName: 'module-with-dep',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const result = await scheduler.executeSchedule(scheduleId);
      expect(result.modulesPreloaded).toContain('dep-module');
      expect(result.modulesPreloaded).toContain('module-with-dep');
    });

    it('should handle module not found', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'non-existent',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const result = await scheduler.executeSchedule(scheduleId);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Module not found');
    });
  });

  describe('Lifecycle Control', () => {
    it('should start all schedules', () => {
      scheduler.start();
      // Should not throw
    });

    it('should stop all schedules', () => {
      scheduler.start();
      scheduler.stop();
      // Should not throw
    });

    it('should not start schedules when disabled', async () => {
      const disabledScheduler = new TimeScheduler({ enabled: false });
      disabledScheduler.start();

      const schedules = disabledScheduler.getActiveSchedules();
      expect(schedules).toHaveLength(0);

      disabledScheduler.destroy();
    });
  });

  describe('Statistics', () => {
    it('should get execution history', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      await scheduler.executeSchedule(scheduleId);

      const history = scheduler.getExecutionHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(true);
    });

    it('should respect history limit', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      for (let i = 0; i < 150; i++) {
        await scheduler.executeSchedule(scheduleId);
      }

      const history = scheduler.getExecutionHistory(100);
      expect(history.length).toBe(100);
    });

    it('should get statistics', async () => {
      scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const stats = scheduler.getStats();
      expect(stats).toHaveProperty('totalSchedules');
      expect(stats).toHaveProperty('activeSchedules');
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successfulExecutions');
      expect(stats).toHaveProperty('failedExecutions');
      expect(stats).toHaveProperty('upcomingRuns');
    });

    it('should count successful executions', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      await scheduler.executeSchedule(scheduleId);

      const stats = scheduler.getStats();
      expect(stats.successfulExecutions).toBe(1);
    });

    it('should include upcoming runs', () => {
      scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const stats = scheduler.getStats();
      expect(Array.isArray(stats.upcomingRuns)).toBe(true);
    });

    it('should clear execution history', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      await scheduler.executeSchedule(scheduleId);
      scheduler.clearHistory();

      const history = scheduler.getExecutionHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Cleanup', () => {
    it('should destroy resources', () => {
      scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      scheduler.destroy();

      expect(scheduler.getAllSchedules()).toHaveLength(0);
      expect(scheduler.getAllModules()).toHaveLength(0);
    });

    it('should stop running schedules on destroy', async () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      // Start execution
      const promise = scheduler.executeSchedule(scheduleId);

      // Destroy while executing
      scheduler.destroy();

      await promise;
      // Should complete without hanging
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty module registry', () => {
      const emptyScheduler = new TimeScheduler();

      const scheduleId = emptyScheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const result = emptyScheduler.executeSchedule(scheduleId);

      expect(result).resolves.toHaveProperty('success', false);
      emptyScheduler.destroy();
    });

    it('should handle invalid cron expression', () => {
      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: 'invalid-cron',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule).toBeDefined();
    });

    it('should handle one-time schedules', () => {
      const now = Date.now();
      const oneHourLater = now + 3600000;

      const scheduleId = scheduler.addSchedule({
        moduleName: 'test-module',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: false,
        enabled: true,
        oneTimeAt: oneHourLater,
      });

      const schedule = scheduler.getSchedule(scheduleId);
      expect(schedule?.recurring).toBe(false);
      expect(schedule?.oneTimeAt).toBe(oneHourLater);
    });

    it('should handle concurrent limit', async () => {
      const limitedScheduler = new TimeScheduler({ maxConcurrentSchedules: 1 });

      limitedScheduler.registerModule({
        id: 'mod-1',
        name: 'Module 1',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: [],
      });

      limitedScheduler.registerModule({
        id: 'mod-2',
        name: 'Module 2',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: [],
      });

      const id1 = limitedScheduler.addSchedule({
        moduleName: 'mod-1',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      const id2 = limitedScheduler.addSchedule({
        moduleName: 'mod-2',
        cron: '0 * * * *',
        timeZone: 'UTC',
        recurring: true,
        enabled: true,
      });

      // Start first execution
      const promise1 = limitedScheduler.executeSchedule(id1);
      // Try second while first is running
      const result2 = await limitedScheduler.executeSchedule(id2);

      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Maximum concurrent schedules reached');

      await promise1;
      limitedScheduler.destroy();
    });
  });
});
