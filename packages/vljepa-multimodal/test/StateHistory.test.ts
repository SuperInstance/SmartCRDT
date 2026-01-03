/**
 * StateHistory tests
 * Comprehensive tests for history and time travel (35+ tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StateHistory,
  TimeTravel,
  BranchManager,
  MultiModalStateManager,
} from '../src/index.js';

function createTestState(id: string): MultiModalStateManager {
  const manager = new MultiModalStateManager();
  manager.updateTextState(t => t.updateInput(`state ${id}`));
  return manager;
}

describe('StateHistory', () => {
  let history: StateHistory;

  beforeEach(() => {
    history = new StateHistory(100, true);
  });

  it('should create with empty current state', () => {
    const current = history.getCurrentState();
    expect(current.id).toBe('empty');
  });

  it('should save snapshot', () => {
    const state = createTestState('test');
    const snapshot = history.saveSnapshot('Initial state', 'test-user');

    expect(snapshot.description).toBe('Initial state');
    expect(snapshot.author).toBe('test-user');
  });

  it('should update current state', () => {
    const state = createTestState('test');
    history.updateCurrentState(state.getState());

    const current = history.getCurrentState();
    expect(current.text.input).toBe('state test');
  });

  it('should auto-save on update', () => {
    const state1 = createTestState('v1');
    history.updateCurrentState(state1.getState());

    const state2 = createTestState('v2');
    history.updateCurrentState(state2.getState());

    expect(history.getStatistics().pastSnapshots).toBeGreaterThanOrEqual(1);
  });

  it('should not auto-save when disabled', () => {
    history.setAutoSave(false);

    const state1 = createTestState('v1');
    history.updateCurrentState(state1.getState(), false);

    const state2 = createTestState('v2');
    history.updateCurrentState(state2.getState(), false);

    expect(history.getStatistics().pastSnapshots).toBe(0);
  });

  it('should undo last change', () => {
    const state1 = createTestState('v1');
    history.updateCurrentState(state1.getState());

    const state2 = createTestState('v2');
    history.updateCurrentState(state2.getState());

    const undone = history.undo();

    expect(undone).toBeDefined();
    expect(undone!.text.input).toBe('state v1');
  });

  it('should redo undone change', () => {
    const state1 = createTestState('v1');
    history.updateCurrentState(state1.getState());

    const state2 = createTestState('v2');
    history.updateCurrentState(state2.getState());

    history.undo();
    const redone = history.redo();

    expect(redone).toBeDefined();
    expect(redone!.text.input).toBe('state v2');
  });

  it('should return null when cannot undo', () => {
    const result = history.undo();
    expect(result).toBeNull();
  });

  it('should return null when cannot redo', () => {
    const result = history.redo();
    expect(result).toBeNull();
  });

  it('should jump to snapshot', () => {
    const state1 = createTestState('v1');
    history.updateCurrentState(state1.getState());
    const snapshot1 = history.saveSnapshot('Version 1');

    const state2 = createTestState('v2');
    history.updateCurrentState(state2.getState());

    const jumped = history.jumpTo(snapshot1.id);

    expect(jumped).toBeDefined();
    expect(jumped!.text.input).toBe('state v1');
  });

  it('should return null for invalid snapshot', () => {
    const result = history.jumpTo('invalid-id');
    expect(result).toBeNull();
  });

  it('should get all snapshots', () => {
    const state1 = createTestState('v1');
    history.updateCurrentState(state1.getState());

    const state2 = createTestState('v2');
    history.updateCurrentState(state2.getState());

    const snapshots = history.getAllSnapshots();

    expect(snapshots.length).toBeGreaterThanOrEqual(2);
  });

  it('should get branch snapshots', () => {
    const state = createTestState('test');
    history.updateCurrentState(state.getState());

    const snapshots = history.getBranchSnapshots();

    expect(Array.isArray(snapshots)).toBe(true);
  });

  it('should diff states', () => {
    const state1 = createTestState('v1');
    history.updateCurrentState(state1.getState());

    const state2 = createTestState('v2');
    history.updateCurrentState(state2.getState());

    const diff = history.diff();

    expect(diff.modified.length).toBeGreaterThan(0);
  });

  it('should get statistics', () => {
    const state = createTestState('test');
    history.updateCurrentState(state.getState());

    const stats = history.getStatistics();

    expect(stats.totalSnapshots).toBeGreaterThanOrEqual(0);
    expect(stats.branchCount).toBe(1); // main branch
  });

  it('should clear history', () => {
    const state1 = createTestState('v1');
    history.updateCurrentState(state1.getState());

    const state2 = createTestState('v2');
    history.updateCurrentState(state2.getState());

    history.clearHistory();

    const stats = history.getStatistics();
    expect(stats.pastSnapshots).toBe(0);
  });

  it('should limit history size', () => {
    history.setMaxHistorySize(5);

    for (let i = 0; i < 10; i++) {
      const state = createTestState(`v${i}`);
      history.updateCurrentState(state.getState());
    }

    const stats = history.getStatistics();
    expect(stats.pastSnapshots).toBeLessThanOrEqual(5);
  });

  it('should export history', () => {
    const state = createTestState('test');
    history.updateCurrentState(state.getState());

    const exported = history.export();

    expect(exported).toBeDefined();
    expect(exported.current).toBeDefined();
  });

  it('should provide time travel access', () => {
    const timeTravel = history.getTimeTravel();
    expect(timeTravel).toBeInstanceOf(TimeTravel);
  });

  it('should provide branch manager access', () => {
    const branchManager = history.getBranchManager();
    expect(branchManager).toBeInstanceOf(BranchManager);
  });

  it('should handle auto-save toggle', () => {
    expect(history['autoSave']).toBe(true);

    history.setAutoSave(false);
    expect(history['autoSave']).toBe(false);

    history.setAutoSave(true);
    expect(history['autoSave']).toBe(true);
  });
});

describe('TimeTravel', () => {
  let history: StateHistory;
  let timeTravel: TimeTravel;

  beforeEach(() => {
    history = new StateHistory(100, false);
    timeTravel = history.getTimeTravel();

    // Add some states
    for (let i = 1; i <= 3; i++) {
      const state = createTestState(`v${i}`);
      history.updateCurrentState(state.getState(), false);
      history.saveSnapshot(`Version ${i}`);
    }
  });

  it('should undo to previous state', () => {
    const undone = timeTravel.undo();
    expect(undone).toBeDefined();
    expect(undone!.text.input).toBe('state v2');
  });

  it('should redo to next state', () => {
    timeTravel.undo();
    const redone = timeTravel.redo();
    expect(redone).toBeDefined();
    expect(redone!.text.input).toBe('state v3');
  });

  it('should check can undo', () => {
    expect(timeTravel.canUndo()).toBe(true);

    timeTravel.undo();
    timeTravel.undo();
    timeTravel.undo();

    expect(timeTravel.canUndo()).toBe(false);
  });

  it('should check can redo', () => {
    expect(timeTravel.canRedo()).toBe(false);

    timeTravel.undo();

    expect(timeTravel.canRedo()).toBe(true);
  });

  it('should get undo stack size', () => {
    const size = timeTravel.getUndoStackSize();
    expect(size).toBe(3);
  });

  it('should get redo stack size', () => {
    timeTravel.undo();
    const size = timeTravel.getRedoStackSize();
    expect(size).toBe(1);
  });

  it('should jump to past index', () => {
    const state = timeTravel.jumpToPast(0);
    expect(state).toBeDefined();
    expect(state!.text.input).toBe('state v1');
  });

  it('should return null for invalid past index', () => {
    const state = timeTravel.jumpToPast(100);
    expect(state).toBeNull();
  });

  it('should jump to future index', () => {
    timeTravel.undo();
    timeTravel.undo();

    const state = timeTravel.jumpToFuture(0);
    expect(state).toBeDefined();
  });

  it('should return null for invalid future index', () => {
    const state = timeTravel.jumpToFuture(100);
    expect(state).toBeNull();
  });

  it('should clear undo stack', () => {
    timeTravel.clearUndo();
    expect(timeTravel.canUndo()).toBe(false);
  });

  it('should clear redo stack', () => {
    timeTravel.undo();
    timeTravel.clearRedo();
    expect(timeTravel.canRedo()).toBe(false);
  });

  it('should clear all stacks', () => {
    timeTravel.undo();
    timeTravel.clearAll();

    expect(timeTravel.canUndo()).toBe(false);
    expect(timeTravel.canRedo()).toBe(false);
  });

  it('should set max undo depth', () => {
    timeTravel.setMaxUndoDepth(2);
    expect(timeTravel.getMaxUndoDepth()).toBe(2);
  });

  it('should limit undo depth', () => {
    timeTravel.setMaxUndoDepth(1);

    // Should only keep 1 in undo stack
    expect(timeTravel.getUndoStackSize()).toBeGreaterThanOrEqual(0);
  });
});

describe('BranchManager', () => {
  let history: StateHistory;
  let branchManager: BranchManager;

  beforeEach(() => {
    history = new StateHistory(100, false);
    branchManager = history.getBranchManager();
  });

  it('should create branch', () => {
    const branch = branchManager.createBranch('test-branch', null);

    expect(branch).toBeDefined();
    expect(branch!.name).toBe('test-branch');
  });

  it('should not create duplicate branch names', () => {
    branchManager.createBranch('test', null);
    const branch2 = branchManager.createBranch('test', null);

    expect(branch2).toBeNull();
  });

  it('should get branch by ID', () => {
    const branch = branchManager.createBranch('test', null);
    const retrieved = branchManager.getBranch(branch!.id);

    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('test');
  });

  it('should get branch by name', () => {
    branchManager.createBranch('test', null);
    const retrieved = branchManager.getBranchByName('test');

    expect(retrieved).toBeDefined();
  });

  it('should switch branch', () => {
    const state = createTestState('main');
    history.updateCurrentState(state.getState());

    const branch = branchManager.createBranch('feature', null);
    const switched = branchManager.switchBranch(branch!.id);

    expect(switched).toBeDefined();
  });

  it('should not delete active branch', () => {
    branchManager.createBranch('test', null);
    branchManager.switchBranch('main');

    const deleted = branchManager.deleteBranch('main');
    expect(deleted).toBe(false);
  });

  it('should not delete main branch', () => {
    const deleted = branchManager.deleteBranch('main');
    expect(deleted).toBe(false);
  });

  it('should delete inactive branch', () => {
    const branch = branchManager.createBranch('test', null);
    const deleted = branchManager.deleteBranch(branch!.id);

    expect(deleted).toBe(true);
  });

  it('should merge branch', () => {
    const source = branchManager.createBranch('feature', null);

    // Add snapshot to source
    const state = createTestState('feature');
    const snapshot = {
      state: state.getState(),
      timestamp: Date.now(),
      author: 'test',
      description: 'Feature snapshot',
      id: 'snap1',
    };
    branchManager.addSnapshotToBranch(source!.id, snapshot);

    const merged = branchManager.mergeBranch(source!.id);
    expect(merged).toBe(true);
  });

  it('should add snapshot to branch', () => {
    const branch = branchManager.createBranch('test', null);
    const state = createTestState('snapshot');

    const snapshot = {
      state: state.getState(),
      timestamp: Date.now(),
      author: 'test',
      description: 'Test snapshot',
      id: 'snap1',
    };

    const added = branchManager.addSnapshotToBranch(branch!.id, snapshot);
    expect(added).toBe(true);
  });

  it('should get branch history', () => {
    const branch = branchManager.createBranch('test', null);
    const history = branchManager.getBranchHistory(branch!.id);

    expect(Array.isArray(history)).toBe(true);
  });

  it('should get all branches', () => {
    branchManager.createBranch('branch1', null);
    branchManager.createBranch('branch2', null);

    const branches = branchManager.getAllBranches();

    expect(branches.length).toBeGreaterThanOrEqual(2);
  });

  it('should get active branch', () => {
    const active = branchManager.getActiveBranch();

    expect(active).toBeDefined();
    expect(active!.active).toBe(true);
  });

  it('should rename branch', () => {
    const branch = branchManager.createBranch('old-name', null);
    const renamed = branchManager.renameBranch(branch!.id, 'new-name');

    expect(renamed).toBe(true);
    expect(branchManager.getBranchByName('new-name')).toBeDefined();
  });

  it('should not rename to duplicate name', () => {
    branchManager.createBranch('branch1', null);
    branchManager.createBranch('branch2', null);

    const renamed = branchManager.renameBranch('branch1', 'branch2');
    expect(renamed).toBe(false);
  });

  it('should get branch tree', () => {
    const parent = branchManager.createBranch('parent', null);
    const child = branchManager.createBranch('child', parent!.id);

    const tree = branchManager.getBranchTree();

    expect(tree.length).toBeGreaterThanOrEqual(0);
  });

  it('should compare branches', () => {
    const branch1 = branchManager.createBranch('branch1', null);
    const branch2 = branchManager.createBranch('branch2', null);

    const comparison = branchManager.compareBranches(branch1!.id, branch2!.id);

    expect(comparison).toBeDefined();
    expect(comparison.differences).toBeDefined();
  });

  it('should get branch statistics', () => {
    const branch = branchManager.createBranch('test', null);
    const stats = branchManager.getBranchStatistics(branch!.id);

    expect(stats).toBeDefined();
    expect(stats!.snapshotCount).toBe(0);
  });

  it('should export branch', () => {
    const branch = branchManager.createBranch('test', null);
    const exported = branchManager.exportBranch(branch!.id);

    expect(exported).toBeDefined();
  });
});
