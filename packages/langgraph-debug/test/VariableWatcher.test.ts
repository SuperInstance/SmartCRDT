/**
 * Tests for VariableWatcher
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VariableWatcher } from '../src/VariableWatcher.js';
import type { StateSnapshot } from '../src/types.js';

describe('VariableWatcher', () => {
  let watcher: VariableWatcher;
  let sessionId: string;

  beforeEach(() => {
    watcher = new VariableWatcher();
    sessionId = 'test-session';
  });

  describe('Watch Management', () => {
    it('should add a watch', () => {
      const watch = watcher.addWatch({
        variablePath: 'state.counter',
      });

      expect(watch).toBeDefined();
      expect(watch.variable_path).toBe('state.counter');
      expect(watch.enabled).toBe(true);
      expect(watch.notify_on_change).toBe(true);
    });

    it('should add conditional watch', () => {
      const watch = watcher.addWatch({
        variablePath: 'state.value',
        condition: 'value > 100',
      });

      expect(watch.condition).toBe('value > 100');
    });

    it('should remove a watch', () => {
      const watch = watcher.addWatch({ variablePath: 'state.counter' });
      const removed = watcher.removeWatch(watch.watch_id);

      expect(removed).toBe(true);
      expect(watcher.getWatch(watch.watch_id)).toBeUndefined();
    });

    it('should enable/disable watch', () => {
      const watch = watcher.addWatch({ variablePath: 'state.counter' });

      watcher.disableWatch(watch.watch_id);
      expect(watcher.getWatch(watch.watch_id)?.enabled).toBe(false);

      watcher.enableWatch(watch.watch_id);
      expect(watcher.getWatch(watch.watch_id)?.enabled).toBe(true);
    });

    it('should get all watches', () => {
      watcher.addWatch({ variablePath: 'state.counter' });
      watcher.addWatch({ variablePath: 'state.value' });

      const all = watcher.getAllWatches();
      expect(all.length).toBe(2);
    });

    it('should get watches for path', () => {
      watcher.addWatch({ variablePath: 'state.counter' });
      watcher.addWatch({ variablePath: 'state.counter' });
      watcher.addWatch({ variablePath: 'state.other' });

      const forCounter = watcher.getWatchesForPath('state.counter');
      expect(forCounter.length).toBe(2);
    });
  });

  describe('Change Detection', () => {
    let watch: ReturnType<VariableWatcher['addWatch']>;
    let snapshot: StateSnapshot;

    beforeEach(() => {
      watch = watcher.addWatch({
        variablePath: 'state.counter',
      });

      snapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { state: { counter: 1 } },
        version: 0,
        changed_keys: [],
      };
    });

    it('should detect value change', async () => {
      const currentState = { state: { counter: 2 } };

      const changes = await watcher.checkWatches(sessionId, currentState, snapshot);

      expect(changes.length).toBe(1);
      expect(changes[0].variablePath).toBe('state.counter');
      expect(changes[0].oldValue).toBe(1);
      expect(changes[0].newValue).toBe(2);
    });

    it('should not detect no change', async () => {
      const changes = await watcher.checkWatches(sessionId, snapshot.state, snapshot);

      expect(changes.length).toBe(0);
    });

    it('should respect enabled status', async () => {
      watcher.disableWatch(watch.watch_id);

      const currentState = { state: { counter: 2 } };
      const changes = await watcher.checkWatches(sessionId, currentState, snapshot);

      expect(changes.length).toBe(0);
    });

    it('should respect notify_on_change', async () => {
      const silentWatch = watcher.addWatch({
        variablePath: 'state.value',
        notifyOnChange: false,
      });

      const currentState = { state: { counter: 2, value: 1 } };
      const changes = await watcher.checkWatches(sessionId, currentState, snapshot);

      expect(changes.some(c => c.watchId === silentWatch.watch_id)).toBe(false);
    });
  });

  describe('Conditional Watches', () => {
    it('should evaluate condition', async () => {
      const watch = watcher.addWatch({
        variablePath: 'state.value',
        condition: 'value > 100',
      });

      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { state: { value: 50 } },
        version: 0,
        changed_keys: [],
      };

      const currentState = { state: { value: 150 } };
      const changes = await watcher.checkWatches(sessionId, currentState, snapshot);

      expect(changes.length).toBe(1);
      expect(changes[0].watchId).toBe(watch.watch_id);
    });

    it('should not notify when condition is false', async () => {
      const watch = watcher.addWatch({
        variablePath: 'state.value',
        condition: 'value > 200',
      });

      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { state: { value: 50 } },
        version: 0,
        changed_keys: [],
      };

      const currentState = { state: { value: 150 } };
      const changes = await watcher.checkWatches(sessionId, currentState, snapshot);

      expect(changes.length).toBe(0);
    });
  });

  describe('Value History', () => {
    it('should track value history', async () => {
      const watch = watcher.addWatch({
        variablePath: 'state.counter',
      });

      const snapshot1: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { state: { counter: 1 } },
        version: 0,
        changed_keys: [],
      };

      await watcher.checkWatches(sessionId, { state: { counter: 2 } }, snapshot1);

      const history = watcher.getValueHistory(watch.watch_id);
      expect(history.length).toBe(1);
      expect(history[0].value).toBe(2);
    });

    it('should limit history size', async () => {
      const watch = watcher.addWatch({
        variablePath: 'state.counter',
      });

      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { state: { counter: 0 } },
        version: 0,
        changed_keys: [],
      };

      // Add many values
      for (let i = 0; i < 1500; i++) {
        await watcher.checkWatches(sessionId, { state: { counter: i } }, snapshot);
      }

      const history = watcher.getValueHistory(watch.watch_id);
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Nested Values', () => {
    it('should watch nested path', async () => {
      const watch = watcher.addWatch({
        variablePath: 'user.profile.age',
      });

      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { user: { profile: { age: 30 } } },
        version: 0,
        changed_keys: [],
      };

      const currentState = { user: { profile: { age: 31 } } };
      const changes = await watcher.checkWatches(sessionId, currentState, snapshot);

      expect(changes.length).toBe(1);
      expect(changes[0].oldValue).toBe(30);
      expect(changes[0].newValue).toBe(31);
    });
  });

  describe('Callbacks', () => {
    it('should call callback on change', async () => {
      const callback = vi.fn();
      const watch = watcher.addWatch({
        variablePath: 'state.counter',
      });

      watcher.onWatchChanged(watch.watch_id, callback);

      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { state: { counter: 1 } },
        version: 0,
        changed_keys: [],
      };

      await watcher.checkWatches(sessionId, { state: { counter: 2 } }, snapshot);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Change History', () => {
    beforeEach(async () => {
      watcher.addWatch({ variablePath: 'state.counter' });

      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { state: { counter: 1 } },
        version: 0,
        changed_keys: [],
      };

      await watcher.checkWatches(sessionId, { state: { counter: 2 } }, snapshot);
    });

    it('should get change history', () => {
      const history = watcher.getChangeHistory(sessionId);
      expect(history.length).toBe(1);
    });

    it('should get changes for watch', () => {
      const changes = watcher.getChangesForWatch(sessionId);
      expect(changes.length).toBe(1);
    });
  });

  describe('Search and Filter', () => {
    beforeEach(() => {
      watcher.addWatch({ variablePath: 'state.counter' });
      watcher.addWatch({ variablePath: 'state.value' });
      watcher.addWatch({ variablePath: 'user.name' });
    });

    it('should find watches by pattern', () => {
      const matches = watcher.findWatchesByPattern('state.*');
      expect(matches.length).toBe(2);
    });

    it('should match wildcard patterns', () => {
      const matches = watcher.findWatchesByPattern('*.*.name');
      expect(matches.length).toBe(1);
      expect(matches[0].variable_path).toBe('user.name');
    });
  });

  describe('Utilities', () => {
    it('should disable all watches', () => {
      watcher.addWatch({ variablePath: 'state.counter' });
      watcher.addWatch({ variablePath: 'state.value' });

      watcher.disableAllWatches();

      const all = watcher.getAllWatches();
      expect(all.every(w => !w.enabled)).toBe(true);
    });

    it('should enable all watches', () => {
      watcher.addWatch({ variablePath: 'state.counter' });
      watcher.disableAllWatches();
      watcher.enableAllWatches();

      const all = watcher.getAllWatches();
      expect(all.every(w => w.enabled)).toBe(true);
    });

    it('should clear all watches', () => {
      watcher.addWatch({ variablePath: 'state.counter' });
      watcher.clearAllWatches();

      expect(watcher.getAllWatches().length).toBe(0);
    });

    it('should clear change history', () => {
      watcher.clearChangeHistory(sessionId);
      expect(watcher.getChangeHistory(sessionId).length).toBe(0);
    });

    it('should clear value history', () => {
      const watch = watcher.addWatch({ variablePath: 'state.counter' });
      watcher.clearValueHistory(watch.watch_id);

      expect(watcher.getValueHistory(watch.watch_id).length).toBe(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      const w1 = watcher.addWatch({ variablePath: 'state.counter' });
      const w2 = watcher.addWatch({ variablePath: 'state.value' });
      watcher.disableWatch(w2.watch_id);
    });

    it('should get statistics', () => {
      const stats = watcher.getStatistics();

      expect(stats.total).toBe(2);
      expect(stats.enabled).toBe(1);
      expect(stats.disabled).toBe(1);
    });
  });

  describe('Validation', () => {
    it('should validate valid watch', () => {
      const watch = watcher.addWatch({
        variablePath: 'state.counter',
        condition: 'value > 10',
      });

      const result = watcher.validateWatch(watch);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate empty path', () => {
      const watch = watcher.addWatch({
        variablePath: '',
      });

      const result = watcher.validateWatch(watch);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate invalid condition', () => {
      const watch = watcher.addWatch({
        variablePath: 'state.counter',
        condition: 'invalid syntax',
      });

      const result = watcher.validateWatch(watch);

      expect(result.valid).toBe(false);
    });
  });

  describe('Expression Parsing', () => {
    it('should create watch from expression', () => {
      const watch = watcher.createWatchFromExpression('watch state.counter');

      expect(watch).toBeDefined();
      expect(watch?.variable_path).toBe('state.counter');
    });

    it('should create conditional watch from expression', () => {
      const watch = watcher.createWatchFromExpression('watch state.counter when value > 100');

      expect(watch?.variable_path).toBe('state.counter');
      expect(watch?.condition).toBe('value > 100');
    });
  });

  describe('Clone Watch', () => {
    it('should clone a watch', () => {
      const original = watcher.addWatch({
        variablePath: 'state.counter',
        condition: 'value > 10',
      });

      const cloned = watcher.cloneWatch(original.watch_id);

      expect(cloned).toBeDefined();
      expect(cloned?.watch_id).not.toBe(original.watch_id);
      expect(cloned?.variable_path).toBe(original.variable_path);
      expect(cloned?.value_history).toHaveLength(0);
    });
  });

  describe('Find Special Watches', () => {
    it('should find idle watches', () => {
      watcher.addWatch({ variablePath: 'state.counter' });
      watcher.addWatch({ variablePath: 'state.value' });

      const idle = watcher.findIdleWatches();
      expect(idle.length).toBe(2);
    });

    it('should find frequently changing watches', async () => {
      const watch = watcher.addWatch({ variablePath: 'state.counter' });

      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { state: { counter: 0 } },
        version: 0,
        changed_keys: [],
      };

      for (let i = 0; i < 15; i++) {
        await watcher.checkWatches(sessionId, { state: { counter: i } }, snapshot);
      }

      const frequent = watcher.findFrequentlyChangingWatches(10);
      expect(frequent.length).toBe(1);
      expect(frequent[0].watch_id).toBe(watch.watch_id);
    });
  });

  describe('Trend Analysis', () => {
    it('should get watch trend', async () => {
      const watch = watcher.addWatch({ variablePath: 'state.counter' });

      const snapshot: StateSnapshot = {
        snapshot_id: 'snap1',
        timestamp: Date.now(),
        graph_id: 'graph1',
        state: { state: { counter: 0 } },
        version: 0,
        changed_keys: [],
      };

      for (let i = 0; i < 10; i++) {
        await watcher.checkWatches(sessionId, { state: { counter: i } }, snapshot);
      }

      const trend = watcher.getWatchTrend(watch.watch_id, 100);
      expect(trend.length).toBeGreaterThan(0);
    });
  });

  describe('Callback Management', () => {
    it('should remove callback', () => {
      const callback = vi.fn();
      const watch = watcher.addWatch({ variablePath: 'state.counter' });

      watcher.onWatchChanged(watch.watch_id, callback);
      const removed = watcher.removeCallback(watch.watch_id, callback);

      expect(removed).toBe(true);
    });

    it('should clear callbacks', () => {
      const watch = watcher.addWatch({ variablePath: 'state.counter' });
      watcher.onWatchChanged(watch.watch_id, vi.fn());

      const cleared = watcher.clearCallbacks(watch.watch_id);
      expect(cleared).toBe(true);
    });
  });

  describe('Export/Import', () => {
    it('should export watches', () => {
      watcher.addWatch({ variablePath: 'state.counter' });
      watcher.addWatch({ variablePath: 'state.value' });

      const exported = watcher.exportWatches();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
    });

    it('should import watches', () => {
      const jsonData = JSON.stringify([
        {
          watch_id: 'imported1',
          variable_path: 'state.counter',
          enabled: true,
          notify_on_change: true,
          value_history: [],
          created_at: Date.now(),
        },
      ]);

      const imported = watcher.importWatches(jsonData);

      expect(imported.length).toBe(1);
      expect(imported[0].variable_path).toBe('state.counter');
    });
  });
});
