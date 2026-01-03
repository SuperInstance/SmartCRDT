/**
 * Tests for StateInspector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateInspector } from '../src/StateInspector.js';
import type { StateSnapshot } from '../src/types.js';

describe('StateInspector', () => {
  let inspector: StateInspector;
  let sessionId: string;

  beforeEach(() => {
    inspector = new StateInspector();
    sessionId = 'test-session';
  });

  describe('Snapshot Management', () => {
    it('should add a state snapshot', () => {
      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { value: 1, nested: { key: 'test' } },
        version: 0,
        changed_keys: [],
      };

      inspector.addSnapshot(sessionId, snapshot);

      const history = inspector.getStateHistory(sessionId);
      expect(history.length).toBe(1);
      expect(history[0].snapshot_id).toBe('snap1');
    });

    it('should get current state', () => {
      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { current: 'value' },
        version: 0,
        changed_keys: [],
      };

      inspector.addSnapshot(sessionId, snapshot);

      const current = inspector.getCurrentState(sessionId);
      expect(current).toEqual({ current: 'value' });
    });

    it('should return null for non-existent session', () => {
      const current = inspector.getCurrentState('non-existent');
      expect(current).toBeNull();
    });

    it('should get state at specific timestamp', () => {
      const now = Date.now();
      const snapshot1: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: now - 1000,
        graph_id: 'graph1',
        state: { value: 1 },
        version: 0,
        changed_keys: [],
      };

      const snapshot2: StateSnapshot = {
        snapshot_id: 'snap2',
        timestamp: now,
        graph_id: 'graph1',
        state: { value: 2 },
        version: 1,
        changed_keys: ['value'],
      };

      inspector.addSnapshot(sessionId, snapshot1);
      inspector.addSnapshot(sessionId, snapshot2);

      const state = inspector.getStateAt(sessionId, now - 500);
      expect(state).toEqual({ value: 1 }); // Closest to snap1
    });
  });

  describe('State Comparison', () => {
    let snap1: StateSnapshot;
    let snap2: StateSnapshot;

    beforeEach(() => {
      snap1 = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: {
          value: 1,
          nested: { key: 'old' },
          list: [1, 2, 3],
        },
        version: 0,
        changed_keys: [],
      };

      snap2 = {
        snapshot_id: 'snap2',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: {
          value: 2,
          nested: { key: 'new' },
          added: 'new_value',
          list: [1, 2, 3],
        },
        version: 1,
        changed_keys: ['value', 'nested', 'added'],
      };
    });

    it('should compare two snapshots', () => {
      const comparison = inspector.compareSnapshots(snap1, snap2);

      expect(comparison.added_keys).toContain('added');
      expect(comparison.removed_keys).toContain('nested');
      expect(Object.keys(comparison.changed_keys)).toContain('value');
      expect(comparison.unchanged_keys).toContain('list');
    });

    it('should detect added keys', () => {
      const comparison = inspector.compareSnapshots(snap1, snap2);
      expect(comparison.added_keys).toContain('added');
    });

    it('should detect changed keys', () => {
      const comparison = inspector.compareSnapshots(snap1, snap2);

      expect(comparison.changed_keys['value']).toEqual({
        old: 1,
        new: 2,
      });
    });

    it('should detect unchanged keys', () => {
      const comparison = inspector.compareSnapshots(snap1, snap2);
      expect(comparison.unchanged_keys).toContain('list');
    });

    it('should format diff as string', () => {
      const comparison = inspector.compareSnapshots(snap1, snap2);
      const diffStr = inspector.diffToString(comparison);

      expect(diffStr).toContain('Added keys');
      expect(diffStr).toContain('Changed keys');
      expect(diffStr).toContain('value');
    });
  });

  describe('State Search', () => {
    beforeEach(() => {
      const now = Date.now();

      inspector.addSnapshot(sessionId, {
        snapshot_id: 'snap1',
        timestamp: now,
        graph_id: 'graph1',
        state: {
          user: { name: 'Alice', age: 30 },
          config: { debug: true },
          value: 100,
        },
        version: 0,
        changed_keys: [],
      });

      inspector.addSnapshot(sessionId, {
        snapshot_id: 'snap2',
        timestamp: now + 1000,
        graph_id: 'graph1',
        state: {
          user: { name: 'Bob', age: 25 },
          config: { debug: false },
          value: 200,
        },
        version: 1,
        changed_keys: ['user', 'config', 'value'],
      });
    });

    it('should search by key pattern', () => {
      const results = inspector.searchState(sessionId, {
        keyPattern: 'user.*',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].key).toMatch(/user/);
    });

    it('should search by value', () => {
      const results = inspector.searchState(sessionId, {
        value: 100,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].value).toBe(100);
    });

    it('should search by value type', () => {
      const results = inspector.searchState(sessionId, {
        valueType: 'number',
      });

      expect(results.length).toBeGreaterThan(0);
      expect(typeof results[0].value).toBe('number');
    });

    it('should filter by time range', () => {
      const now = Date.now();
      const results = inspector.searchState(sessionId, {
        timeRange: { start: now, end: now + 500 },
      });

      expect(results.length).toBe(1);
    });
  });

  describe('Value Access', () => {
    beforeEach(() => {
      inspector.addSnapshot(sessionId, {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: {
          user: {
            name: 'Alice',
            profile: { age: 30, city: 'NYC' },
          },
          counter: 42,
        },
        version: 0,
        changed_keys: [],
      });
    });

    it('should get nested value', () => {
      const value = inspector.getValue(sessionId, 'user.name');
      expect(value).toBe('Alice');
    });

    it('should get deeply nested value', () => {
      const value = inspector.getValue(sessionId, 'user.profile.city');
      expect(value).toBe('NYC');
    });

    it('should return undefined for non-existent path', () => {
      const value = inspector.getValue(sessionId, 'user.nonexistent');
      expect(value).toBeUndefined();
    });

    it('should set nested value', () => {
      const success = inspector.setValue(sessionId, 'user.name', 'Bob');
      expect(success).toBe(true);

      const value = inspector.getValue(sessionId, 'user.name');
      expect(value).toBe('Bob');
    });

    it('should create nested structure when setting', () => {
      const success = inspector.setValue(sessionId, 'new.nested.value', 123);
      expect(success).toBe(true);

      const value = inspector.getValue(sessionId, 'new.nested.value');
      expect(value).toBe(123);
    });
  });

  describe('Change Tracking', () => {
    beforeEach(() => {
      const now = Date.now();

      inspector.addSnapshot(sessionId, {
        snapshot_id: 'snap1',
        timestamp: now,
        graph_id: 'graph1',
        state: { value: 1 },
        version: 0,
        changed_keys: [],
      });

      inspector.addSnapshot(sessionId, {
        snapshot_id: 'snap2',
        timestamp: now + 1000,
        graph_id: 'graph1',
        state: { value: 2 },
        version: 1,
        changed_keys: ['value'],
      });

      inspector.addSnapshot(sessionId, {
        snapshot_id: 'snap3',
        timestamp: now + 2000,
        graph_id: 'graph1',
        state: { value: 3 },
        version: 2,
        changed_keys: ['value'],
      });
    });

    it('should track change history', () => {
      const changes = inspector.getChangeHistory(sessionId);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].key).toBe('value');
    });

    it('should get changes for specific key', () => {
      const changes = inspector.getChangesForKey(sessionId, 'value');

      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].key).toBe('value');
    });

    it('should get value history', () => {
      const history = inspector.getValueHistory(sessionId, 'value');

      expect(history.length).toBe(3);
      expect(history[0].value).toBe(1);
      expect(history[1].value).toBe(2);
      expect(history[2].value).toBe(3);
    });

    it('should get state transitions', () => {
      const transitions = inspector.getStateTransitions(sessionId);

      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions[0].key).toBe('value');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        inspector.addSnapshot(sessionId, {
          snapshot_id: `snap${i}`,
          timestamp: now + i * 1000,
          graph_id: 'graph1',
          state: { value: i, counter: i * 2 },
          version: i,
          changed_keys: ['value', 'counter'],
        });
      }
    });

    it('should calculate state statistics', () => {
      const stats = inspector.getStateStatistics(sessionId);

      expect(stats).toBeDefined();
      expect(stats?.snapshotCount).toBe(5);
      expect(stats?.changeCount).toBeGreaterThan(0);
      expect(stats?.keyCount).toBe(2);
    });

    it('should identify most changed keys', () => {
      const stats = inspector.getStateStatistics(sessionId);

      expect(stats?.mostChangedKeys.length).toBeGreaterThan(0);
      expect(stats?.mostChangedKeys[0].key).toBe('value');
    });
  });

  describe('State Manipulation', () => {
    it('should clone state', () => {
      const state = { nested: { value: 1 } };
      const cloned = inspector.cloneState(state);

      expect(cloned).toEqual(state);
      expect(cloned).not.toBe(state);
    });

    it('should merge states', () => {
      const base = { a: 1, b: 2 };
      const overlay = { b: 3, c: 4 };

      const merged = inspector.mergeStates(base, overlay);

      expect(merged).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should restore state from snapshot', () => {
      const originalState = { value: 42 };

      inspector.addSnapshot(sessionId, {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: originalState,
        version: 0,
        changed_keys: [],
      });

      const restored = inspector.restoreState(sessionId, 'snap1');
      expect(restored).toEqual(originalState);
    });
  });

  describe('State Validation', () => {
    it('should validate state against schema', () => {
      const state = {
        name: 'Alice',
        age: 30,
        email: 'alice@example.com',
      };

      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', required: true },
        email: { type: 'string', required: false },
      };

      const result = inspector.validateState(state as Record<string, unknown>, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect validation errors', () => {
      const state = {
        name: 'Alice',
        age: '30', // Should be number
      };

      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', required: true },
      };

      const result = inspector.validateState(state as Record<string, unknown>, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing required keys', () => {
      const state = {
        name: 'Alice',
      };

      const schema = {
        name: { type: 'string', required: true },
        age: { type: 'number', required: true },
      };

      const result = inspector.validateState(state as Record<string, unknown>, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing'))).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should clear history', () => {
      inspector.addSnapshot(sessionId, {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: {},
        version: 0,
        changed_keys: [],
      });

      inspector.clearHistory(sessionId);

      const history = inspector.getStateHistory(sessionId);
      expect(history.length).toBe(0);
    });
  });
});
