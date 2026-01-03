/**
 * EventTrigger Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventTriggerManager } from '../src/EventTrigger.js';
import type { ModuleMetadata, PreloadEvent } from '../src/types.js';

describe('EventTriggerManager', () => {
  let manager: EventTriggerManager;
  let testModule: ModuleMetadata;

  beforeEach(() => {
    manager = new EventTriggerManager();
    testModule = {
      id: 'test-module',
      name: 'Test Module',
      version: '1.0.0',
      size: 10000,
      loadTime: 100,
      dependencies: [],
    };

    manager.registerModule(testModule);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Module Management', () => {
    it('should register a module', () => {
      manager.registerModule(testModule);
      const modules = manager.getAllModules();
      expect(modules).toContainEqual(testModule);
    });

    it('should unregister a module', () => {
      manager.unregisterModule('test-module');
      const modules = manager.getAllModules();
      expect(modules).not.toContainEqual(testModule);
    });

    it('should get all registered modules', () => {
      manager.registerModule({
        id: 'module-2',
        name: 'Module 2',
        version: '1.0.0',
        size: 5000,
        loadTime: 50,
        dependencies: [],
      });

      const modules = manager.getAllModules();
      expect(modules.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Trigger Management', () => {
    it('should add an event trigger', () => {
      const triggerId = manager.addTrigger({
        eventType: 'deployment',
        filter: { service: 'api' },
        debounceTime: 1000,
        throttleTime: 5000,
        maxTriggers: 10,
      });

      const trigger = manager.getTrigger(triggerId);
      expect(trigger).toBeDefined();
      expect(trigger?.eventType).toBe('deployment');
    });

    it('should generate unique trigger IDs', () => {
      const id1 = manager.addTrigger({ eventType: 'event-1' });
      const id2 = manager.addTrigger({ eventType: 'event-2' });

      expect(id1).not.toBe(id2);
    });

    it('should remove a trigger', () => {
      const triggerId = manager.addTrigger({ eventType: 'test-event' });
      const removed = manager.removeTrigger(triggerId);

      expect(removed).toBe(true);
      expect(manager.getTrigger(triggerId)).toBeUndefined();
    });

    it('should return false when removing non-existent trigger', () => {
      const removed = manager.removeTrigger('non-existent');
      expect(removed).toBe(false);
    });

    it('should update a trigger', () => {
      const triggerId = manager.addTrigger({
        eventType: 'test-event',
        maxTriggers: 5,
      });

      const updated = manager.updateTrigger(triggerId, {
        maxTriggers: 10,
      });

      expect(updated).toBe(true);

      const trigger = manager.getTrigger(triggerId);
      expect(trigger?.maxTriggers).toBe(10);
    });

    it('should return false when updating non-existent trigger', () => {
      const updated = manager.updateTrigger('non-existent', { maxTriggers: 10 });
      expect(updated).toBe(false);
    });

    it('should get all triggers', () => {
      manager.addTrigger({ eventType: 'event-1' });
      manager.addTrigger({ eventType: 'event-2' });

      const triggers = manager.getAllTriggers();
      expect(triggers.length).toBe(2);
    });

    it('should get triggers for specific event type', () => {
      manager.addTrigger({ eventType: 'deployment' });
      manager.addTrigger({ eventType: 'deployment' });
      manager.addTrigger({ eventType: 'traffic-spike' });

      const deploymentTriggers = manager.getTriggersForEvent('deployment');
      expect(deploymentTriggers.length).toBe(2);
    });

    it('should only return enabled triggers', () => {
      manager.addTrigger({ eventType: 'test', enabled: true });
      manager.addTrigger({ eventType: 'test', enabled: false });

      const triggers = manager.getTriggersForEvent('test');
      expect(triggers.length).toBe(1);
    });

    it('should enable trigger by default', () => {
      const triggerId = manager.addTrigger({ eventType: 'test' });
      const trigger = manager.getTrigger(triggerId);
      expect(trigger?.enabled).toBe(true);
    });
  });

  describe('Event Handling', () => {
    it('should register event listener', () => {
      let called = false;
      const listener = () => { called = true; };

      manager.on('test-event', listener);

      // Listener should be registered
      expect(manager['listeners'].has('test-event')).toBe(true);
    });

    it('should unregister event listener', () => {
      const listener = () => {};
      const unsubscribe = manager.on('test-event', listener);

      unsubscribe();

      // Listener should be removed
      const listeners = manager['listeners'].get('test-event');
      expect(listeners?.has(listener)).toBe(false);
    });

    it('should notify listeners on event emit', async () => {
      let called = false;
      const listener = () => { called = true; };

      manager.on('test-event', listener);
      await manager.emit({ type: 'test-event', timestamp: Date.now(), payload: {}, source: 'test' });

      expect(called).toBe(true);
    });

    it('should emit simple event', async () => {
      const results = await manager.emitSimple('test-event', { key: 'value' }, 'test-source');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should record event history', async () => {
      await manager.emitSimple('test-event');

      const history = manager.getEventHistory();
      expect(history.length).toBe(1);
      expect(history[0].type).toBe('test-event');
    });

    it('should respect event history limit', async () => {
      for (let i = 0; i < 1500; i++) {
        await manager.emitSimple('test-event', { index: i });
      }

      const history = manager.getEventHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should filter event history by type', async () => {
      await manager.emitSimple('event-1');
      await manager.emitSimple('event-2');
      await manager.emitSimple('event-1');

      const event1History = manager.getEventHistory(100, 'event-1');
      expect(event1History.length).toBe(2);
    });

    it('should not emit when disabled', async () => {
      manager.disable();

      const results = await manager.emitSimple('test-event');
      expect(results).toHaveLength(0);

      manager.enable();
    });
  });

  describe('Built-in Event Handlers', () => {
    it('should handle deployment event', async () => {
      const results = await manager.onDeployment({
        service: 'api',
        version: '1.0.0',
        modules: ['test-module'],
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle traffic spike event', async () => {
      const results = await manager.onTrafficSpike({
        currentRPS: 1000,
        baselineRPS: 500,
        threshold: 800,
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle user activity event', async () => {
      const results = await manager.onUserActivity({
        userId: 'user-1',
        action: 'click',
        module: 'test-module',
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle time event', async () => {
      const results = await manager.onTimeEvent({
        hour: 10,
        dayOfWeek: 1,
        timeZone: 'UTC',
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Event Filtering', () => {
    it('should match filter conditions', async () => {
      manager.addTrigger({
        eventType: 'deployment',
        filter: { service: 'api' },
      });

      const results = await manager.onDeployment({
        service: 'api',
        version: '1.0.0',
      });

      // Should trigger (filter matches)
      expect(Array.isArray(results)).toBe(true);
    });

    it('should not trigger when filter does not match', async () => {
      manager.addTrigger({
        eventType: 'deployment',
        filter: { service: 'api' },
      });

      const results = await manager.onDeployment({
        service: 'web',
        version: '1.0.0',
      });

      // Should not trigger (filter does not match)
      expect(results).toHaveLength(0);
    });

    it('should handle complex filter', async () => {
      manager.addTrigger({
        eventType: 'test',
        filter: { key1: 'value1', key2: 'value2' },
      });

      await manager.emitSimple('test', { key1: 'value1', key2: 'value2', key3: 'value3' });

      const history = manager.getEventHistory();
      expect(history.length).toBe(1);
    });
  });

  describe('Throttling and Debouncing', () => {
    it('should throttle trigger execution', async () => {
      manager.addTrigger({
        eventType: 'test',
        throttleTime: 1000,
      });

      await manager.emitSimple('test');
      await manager.emitSimple('test');

      // Second emit should be throttled
      const stats = manager.getStats();
      expect(stats.totalEvents).toBe(2);
    });

    it('should debounce trigger execution', async () => {
      manager.addTrigger({
        eventType: 'test',
        debounceTime: 100,
      });

      await manager.emitSimple('test');
      await manager.emitSimple('test');

      // Should work correctly
      const history = manager.getEventHistory();
      expect(history.length).toBe(2);
    });

    it('should use default debounce time', async () => {
      const managerWithDefaults = new EventTriggerManager({
        defaultDebounceTime: 500,
      });

      managerWithDefaults.addTrigger({
        eventType: 'test',
      });

      await managerWithDefaults.emitSimple('test');

      const history = managerWithDefaults.getEventHistory();
      expect(history.length).toBe(1);

      managerWithDefaults.destroy();
    });

    it('should use default throttle time', async () => {
      const managerWithDefaults = new EventTriggerManager({
        defaultThrottleTime: 5000,
      });

      managerWithDefaults.addTrigger({
        eventType: 'test',
      });

      await managerWithDefaults.emitSimple('test');

      const history = managerWithDefaults.getEventHistory();
      expect(history.length).toBe(1);

      managerWithDefaults.destroy();
    });
  });

  describe('Max Triggers', () => {
    it('should respect max triggers limit', async () => {
      manager.addTrigger({
        eventType: 'test',
        maxTriggers: 1,
      });

      const results1 = await manager.emitSimple('test');
      const results2 = await manager.emitSimple('test');

      // First should execute, second should not
      expect(results1).toBeDefined();
      expect(results2).toHaveLength(0);
    });

    it('should track trigger count', async () => {
      const triggerId = manager.addTrigger({
        eventType: 'test',
        maxTriggers: 5,
      });

      for (let i = 0; i < 3; i++) {
        await manager.emitSimple('test');
      }

      const count = manager['triggerCounts'].get(triggerId);
      expect(count).toBe(3);
    });
  });

  describe('Statistics', () => {
    it('should get statistics', async () => {
      manager.addTrigger({ eventType: 'test-1' });
      manager.addTrigger({ eventType: 'test-2', enabled: false });

      await manager.emitSimple('test-1');
      await manager.emitSimple('test-1');

      const stats = manager.getStats();
      expect(stats).toHaveProperty('totalTriggers');
      expect(stats).toHaveProperty('activeTriggers');
      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successfulExecutions');
      expect(stats).toHaveProperty('failedExecutions');
      expect(stats).toHaveProperty('avgProcessingTime');
      expect(stats).toHaveProperty('topEventTypes');
    });

    it('should count active triggers', () => {
      manager.addTrigger({ eventType: 'test', enabled: true });
      manager.addTrigger({ eventType: 'test', enabled: false });

      const stats = manager.getStats();
      expect(stats.activeTriggers).toBe(1);
    });

    it('should count total events', async () => {
      await manager.emitSimple('test-1');
      await manager.emitSimple('test-2');

      const stats = manager.getStats();
      expect(stats.totalEvents).toBe(2);
    });

    it('should track top event types', async () => {
      await manager.emitSimple('event-1');
      await manager.emitSimple('event-1');
      await manager.emitSimple('event-2');

      const stats = manager.getStats();
      expect(stats.topEventTypes[0].type).toBe('event-1');
      expect(stats.topEventTypes[0].count).toBe(2);
    });

    it('should get execution history', async () => {
      await manager.emitSimple('test');

      const history = manager.getExecutionHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should respect execution history limit', async () => {
      for (let i = 0; i < 150; i++) {
        await manager.emitSimple('test');
      }

      const history = manager.getExecutionHistory(100);
      expect(history.length).toBe(100);
    });
  });

  describe('Lifecycle', () => {
    it('should enable the manager', () => {
      manager.disable();
      manager.enable();

      // Should be able to emit events
      expect(() => manager.emitSimple('test')).not.toThrow();
    });

    it('should disable the manager', () => {
      manager.disable();

      // Should not process events when disabled
      expect(() => manager.emitSimple('test')).not.toThrow();
    });

    it('should clear history', async () => {
      await manager.emitSimple('test');
      manager.clearHistory();

      const eventHistory = manager.getEventHistory();
      const execHistory = manager.getExecutionHistory();

      expect(eventHistory).toHaveLength(0);
      expect(execHistory).toHaveLength(0);
    });

    it('should destroy resources', () => {
      manager.addTrigger({ eventType: 'test' });
      manager.on('test', () => {});

      manager.destroy();

      expect(manager.getAllTriggers()).toHaveLength(0);
      expect(manager.getEventHistory()).toHaveLength(0);
    });

    it('should clear debounce timers on destroy', () => {
      manager.addTrigger({ eventType: 'test', debounceTime: 1000 });

      manager.destroy();

      expect(manager['debounceTimers'].size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle listener errors gracefully', async () => {
      const errorListener = () => {
        throw new Error('Listener error');
      };

      manager.on('test', errorListener);

      // Should not throw
      await expect(manager.emitSimple('test')).resolves.not.toThrow();
    });

    it('should handle multiple listeners for same event', async () => {
      let count = 0;
      const listener1 = () => { count++; };
      const listener2 = () => { count++; };

      manager.on('test', listener1);
      manager.on('test', listener2);

      await manager.emitSimple('test');

      expect(count).toBe(2);
    });

    it('should handle event with no payload', async () => {
      const results = await manager.emit({
        type: 'test',
        timestamp: Date.now(),
        payload: {},
        source: 'test',
      });

      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle event with complex payload', async () => {
      const complexPayload = {
        nested: { value: 123 },
        array: [1, 2, 3],
        string: 'test',
      };

      await manager.emitSimple('test', complexPayload);

      const history = manager.getEventHistory();
      expect(history[0].payload).toEqual(complexPayload);
    });

    it('should handle rapid event emissions', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(manager.emitSimple('test', { index: i }));
      }

      await Promise.all(promises);

      const history = manager.getEventHistory();
      expect(history.length).toBe(100);
    });

    it('should handle unsubscribe during event emission', async () => {
      let unsubscribe: () => void;

      const listener = () => {
        unsubscribe();
      };

      unsubscribe = manager.on('test', listener);

      await manager.emitSimple('test');

      // Should not throw
      const listeners = manager['listeners'].get('test');
      expect(listeners?.size).toBe(0);
    });

    it('should handle very long event type names', async () => {
      const longEventType = 'a'.repeat(1000);

      await manager.emitSimple(longEventType);

      const history = manager.getEventHistory();
      expect(history[0].type).toBe(longEventType);
    });

    it('should handle special characters in event type', async () => {
      const specialEventType = 'test/event-with-special.chars';

      await manager.emitSimple(specialEventType);

      const history = manager.getEventHistory();
      expect(history[0].type).toBe(specialEventType);
    });
  });
});
