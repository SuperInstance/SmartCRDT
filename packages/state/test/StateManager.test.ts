/**
 * @lsi/state - StateManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../src/core/StateManager.js';

interface TestState {
  count: number;
  name: string;
  nested: {
    value: number;
  };
}

describe('StateManager', () => {
  let manager: StateManager<TestState>;

  beforeEach(() => {
    manager = new StateManager<TestState>({
      count: 0,
      name: 'test',
      nested: { value: 42 }
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = manager.getState();
      expect(state).toEqual({
        count: 0,
        name: 'test',
        nested: { value: 42 }
      });
    });

    it('should return immutable copy', () => {
      const state1 = manager.getState();
      const state2 = manager.getState();
      expect(state1).not.toBe(state2);
    });
  });

  describe('get', () => {
    it('should get specific key', () => {
      expect(manager.get('count')).toBe(0);
      expect(manager.get('name')).toBe('test');
    });

    it('should return immutable copy', () => {
      const nested1 = manager.get('nested');
      const nested2 = manager.get('nested');
      expect(nested1).not.toBe(nested2);
      expect(nested1).toEqual(nested2);
    });
  });

  describe('set', () => {
    it('should update entire state', () => {
      manager.set({
        count: 1,
        name: 'updated',
        nested: { value: 100 }
      });

      expect(manager.getState()).toEqual({
        count: 1,
        name: 'updated',
        nested: { value: 100 }
      });
    });

    it('should update specific key', () => {
      manager.set('count', 5);
      expect(manager.get('count')).toBe(5);
      expect(manager.get('name')).toBe('test'); // unchanged
    });

    it('should emit change event', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.set('count', 5);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].current.count).toBe(5);
    });
  });

  describe('batch', () => {
    it('should batch multiple updates', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.batch(state => ({
        ...state,
        count: state.count + 1,
        name: 'batched'
      }));

      expect(manager.getState()).toEqual({
        count: 1,
        name: 'batched',
        nested: { value: 42 }
      });

      // Should only emit one event
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should update value using function', () => {
      manager.update('count', c => c + 10);
      expect(manager.get('count')).toBe(10);
    });
  });

  describe('merge', () => {
    it('should merge partial state', () => {
      manager.merge({ count: 5 });
      expect(manager.getState()).toEqual({
        count: 5,
        name: 'test',
        nested: { value: 42 }
      });
    });

    it('should deep merge nested objects', () => {
      manager.merge({ nested: { value: 100 } });
      expect(manager.getState().nested.value).toBe(100);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to all changes', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      manager.set('count', 1);
      manager.set('name', 'updated');

      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();

      manager.set('count', 2);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe correctly', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      unsubscribe();
      manager.set('count', 1);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      manager.set('count', 5);
      manager.set('name', 'changed');

      manager.reset();

      expect(manager.getState()).toEqual({
        count: 0,
        name: 'test',
        nested: { value: 42 }
      });
    });
  });

  describe('createSnapshot', () => {
    it('should create snapshot with label', () => {
      manager.set('count', 5);

      const snapshot = manager.createSnapshot('test snapshot');

      expect(snapshot.state.count).toBe(5);
      expect(snapshot.label).toBe('test snapshot');
      expect(snapshot.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('getHistory', () => {
    it('should track change history', () => {
      manager.set('count', 1);
      manager.set('count', 2);
      manager.set('name', 'updated');

      const history = manager.getHistory();
      expect(history.length).toBe(3);
    });

    it('should limit history size', () => {
      const limitedManager = new StateManager<TestState>(
        { count: 0, name: 'test', nested: { value: 0 } },
        { maxHistory: 2 }
      );

      limitedManager.set('count', 1);
      limitedManager.set('count', 2);
      limitedManager.set('count', 3);

      expect(limitedManager.getHistory().length).toBe(2);
    });
  });

  describe('isDirty', () => {
    it('should return false for initial state', () => {
      expect(manager.isDirty()).toBe(false);
    });

    it('should return true after changes', () => {
      manager.set('count', 5);
      expect(manager.isDirty()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should cleanup listeners', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.destroy();
      manager.set('count', 1);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
