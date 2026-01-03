/**
 * @lsi/state - StateHistory Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateHistory } from '../src/history/StateHistory.js';

interface TestState {
  value: number;
  name: string;
}

describe('StateHistory', () => {
  let history: StateHistory<TestState>;

  beforeEach(() => {
    history = new StateHistory<TestState>(10);
  });

  describe('record', () => {
    it('should record state', () => {
      const state: TestState = { value: 1, name: 'test' };
      const id = history.record(state, 'increment');

      expect(id).toBeTruthy();
      expect(history.getCurrent()?.state).toEqual(state);
    });

    it('should clear future on new record', () => {
      const state1: TestState = { value: 1, name: 'test1' };
      const state2: TestState = { value: 2, name: 'test2' };

      history.record(state1);
      history.undo(state1);
      history.record(state2);

      expect(history.canRedo()).toBe(false);
    });
  });

  describe('undo', () => {
    it('should undo to previous state', () => {
      const state1: TestState = { value: 1, name: 'test1' };
      const state2: TestState = { value: 2, name: 'test2' };

      history.record(state1);
      history.record(state2);

      const undone = history.undo(state2);

      expect(undone).toEqual(state1);
      expect(history.canRedo()).toBe(true);
    });

    it('should return null when nothing to undo', () => {
      const state: TestState = { value: 1, name: 'test' };
      const result = history.undo(state);

      expect(result).toBeNull();
    });
  });

  describe('redo', () => {
    it('should redo to next state', () => {
      const state1: TestState = { value: 1, name: 'test1' };
      const state2: TestState = { value: 2, name: 'test2' };

      history.record(state1);
      history.record(state2);
      history.undo(state2);

      const redone = history.redo(state1);

      expect(redone).toEqual(state2);
    });

    it('should return null when nothing to redo', () => {
      const state: TestState = { value: 1, name: 'test' };
      const result = history.redo(state);

      expect(result).toBeNull();
    });
  });

  describe('canUndo/canRedo', () => {
    it('should track undo/redo availability', () => {
      const state1: TestState = { value: 1, name: 'test1' };
      const state2: TestState = { value: 2, name: 'test2' };

      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);

      history.record(state1);
      history.record(state2);

      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);

      history.undo(state2);

      expect(history.canRedo()).toBe(true);
    });
  });

  describe('snapshots', () => {
    it('should create snapshot', () => {
      const state: TestState = { value: 1, name: 'test' };
      const snapshot = history.createSnapshot(state, 'test snapshot');

      expect(snapshot.state).toEqual(state);
      expect(snapshot.label).toBe('test snapshot');
    });

    it('should retrieve snapshot', () => {
      const state: TestState = { value: 1, name: 'test' };
      const snapshot = history.createSnapshot(state, 'test');

      const retrieved = history.getSnapshot(snapshot.id);

      expect(retrieved).toEqual(snapshot);
    });

    it('should jump to snapshot', () => {
      const state1: TestState = { value: 1, name: 'test1' };
      const state2: TestState = { value: 2, name: 'test2' };

      history.record(state1);
      const snapshot = history.createSnapshot(state1, 'initial');
      history.record(state2);

      const jumped = history.jumpToSnapshot(snapshot.id);

      expect(jumped).toEqual(state1);
    });

    it('should delete snapshot', () => {
      const state: TestState = { value: 1, name: 'test' };
      const snapshot = history.createSnapshot(state, 'test');

      history.deleteSnapshot(snapshot.id);

      expect(history.getSnapshot(snapshot.id)).toBeUndefined();
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics', () => {
      const state1: TestState = { value: 1, name: 'test1' };
      const state2: TestState = { value: 2, name: 'test2' };

      history.record(state1);
      history.record(state2);

      const stats = history.getStatistics();

      expect(stats.totalEntries).toBe(2);
      expect(stats.canUndo).toBe(true);
      expect(stats.canRedo).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear history', () => {
      const state: TestState = { value: 1, name: 'test' };
      history.record(state);

      history.clear();

      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('search', () => {
    it('should search by label', () => {
      history.record({ value: 1, name: 'test1' }, 'action1', 'increment counter');
      history.record({ value: 2, name: 'test2' }, 'action2', 'decrement counter');

      const results = history.searchByLabel('counter');

      expect(results.length).toBe(2);
    });

    it('should search by action', () => {
      history.record({ value: 1, name: 'test1' }, 'user-action');
      history.record({ value: 2, name: 'test2' }, 'system-action');

      const results = history.searchByAction('user');

      expect(results.length).toBe(1);
    });
  });

  describe('export/import', () => {
    it('should export and import history', () => {
      const state1: TestState = { value: 1, name: 'test1' };
      const state2: TestState = { value: 2, name: 'test2' };

      history.record(state1);
      history.record(state2);

      const exported = history.export();

      const newHistory = new StateHistory<TestState>();
      newHistory.import(exported);

      expect(newHistory.canUndo()).toBe(true);
      expect(newHistory.getPast().length).toBe(1);
    });
  });
});
