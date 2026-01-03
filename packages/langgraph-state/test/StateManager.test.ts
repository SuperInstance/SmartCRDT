/**
 * @lsi/langgraph-state - StateManager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AdvancedStateManager,
  createStateManager,
  createStateVersion
} from '../src/StateManager.js';

describe('AdvancedStateManager', () => {
  let manager: AdvancedStateManager<{ foo: string; baz?: number }>;

  beforeEach(() => {
    manager = new AdvancedStateManager({ foo: 'bar' });
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('initialization', () => {
    it('should initialize with state', () => {
      expect(manager.state).toEqual({ foo: 'bar' });
    });

    it('should have initial version', () => {
      expect(manager.version.major).toBe(1);
      expect(manager.version.minor).toBe(0);
      expect(manager.version.patch).toBe(0);
    });

    it('should have main branch', () => {
      expect(manager.branches.has('main')).toBe(true);
      expect(manager.currentBranch).toBe('main');
    });

    it('should generate unique ID', () => {
      expect(manager.id).toBeTruthy();
      expect(manager.id).toMatch(/^state_/);
    });
  });

  describe('getState', () => {
    it('should get state at scope', () => {
      const state = manager.getState('global');
      expect(state).toBeDefined();
    });

    it('should get nested value by key', () => {
      manager.state = { foo: { bar: { baz: 'qux' } } } as any;
      const value = manager.getState('global', 'foo.bar.baz');
      expect(value).toBe('qux');
    });

    it('should return undefined for missing key', () => {
      const value = manager.getState('global', 'missing');
      expect(value).toBeUndefined();
    });

    it('should throw for invalid scope', () => {
      expect(() => manager.getState('invalid' as any)).toThrow();
    });
  });

  describe('setState', () => {
    it('should set state with merge strategy', async () => {
      await manager.setState('global', 'baz', 1, 'merge');
      expect((manager.state as any).baz).toBe(1);
    });

    it('should set state with replace strategy', async () => {
      await manager.setState('global', 'foo', 'new', 'replace');
      expect(manager.state.foo).toBe('new');
    });

    it('should set state with append strategy', async () => {
      manager.state = { items: [1, 2] } as any;
      await manager.setState('global', 'items', 3, 'append');
      expect((manager.state as any).items).toEqual([1, 2, 3]);
    });

    it('should create transition in history', async () => {
      await manager.setState('global', 'baz', 1, 'merge');
      const history = manager.getHistory('global');
      expect(history.length).toBeGreaterThan(0);
    });

    it('should emit state change event', async () => {
      let emitted = false;
      manager.on('state:change', () => { emitted = true; });

      await manager.setState('global', 'baz', 1, 'merge');
      expect(emitted).toBe(true);
    });
  });

  describe('updateState', () => {
    it('should update state using reducer', async () => {
      const reducer = (state: any) => ({ ...state, baz: 1 });
      const newVersion = await manager.updateState('global', reducer);
      expect(newVersion.patch).toBe(1);
    });

    it('should support async reducers', async () => {
      const reducer = async (state: any) => ({ ...state, baz: await Promise.resolve(1) });
      const newVersion = await manager.updateState('global', reducer);
      expect((manager.state as any).baz).toBe(1);
    });
  });

  describe('snapshots', () => {
    it('should create snapshot', async () => {
      const snapshot = await manager.createSnapshot('test');
      expect(snapshot.id).toBeTruthy();
      expect(snapshot.data).toEqual(manager.state);
    });

    it('should restore from snapshot', async () => {
      const snapshot = await manager.createSnapshot('test');
      manager.state = { foo: 'changed' } as any;
      await manager.restoreSnapshot(snapshot.id);
      expect(manager.state.foo).toBe('bar');
    });

    it('should throw for missing snapshot', async () => {
      await expect(manager.restoreSnapshot('missing')).rejects.toThrow();
    });
  });

  describe('history', () => {
    it('should get empty history initially', () => {
      const history = manager.getHistory();
      expect(history).toEqual([]);
    });

    it('should track state changes', async () => {
      await manager.setState('global', 'baz', 1, 'merge');
      const history = manager.getHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('should limit history size', async () => {
      for (let i = 0; i < 10; i++) {
        await manager.setState('global', `key${i}`, i, 'merge');
      }

      const history = manager.getHistory('global', 5);
      expect(history.length).toBe(5);
    });
  });

  describe('diff', () => {
    it('should diff two versions', () => {
      const v1 = createStateVersion(1, 0, 0);
      const v2 = createStateVersion(1, 0, 1);
      const diff = manager.diff(v1, v2);
      expect(diff).toBeDefined();
    });
  });

  describe('branches', () => {
    it('should create branch', () => {
      const branch = manager.createBranch('feature');
      expect(branch.id).toBe('feature');
      expect(branch.status).toBe('active');
    });

    it('should throw for duplicate branch', () => {
      manager.createBranch('feature');
      expect(() => manager.createBranch('feature')).toThrow();
    });

    it('should switch to branch', () => {
      manager.createBranch('feature');
      manager.switchBranch('feature');
      expect(manager.currentBranch).toBe('feature');
    });

    it('should throw for missing branch', () => {
      expect(() => manager.switchBranch('missing')).toThrow();
    });
  });

  describe('validate', () => {
    it('should validate state', () => {
      const result = manager.validate();
      expect(result).toBeDefined();
      expect(typeof result.valid).toBe('boolean');
    });

    it('should validate specific state', () => {
      const result = manager.validate({ foo: 'test' });
      expect(result).toBeDefined();
    });
  });

  describe('middleware', () => {
    it('should register middleware', () => {
      const middleware = async (_ctx: any, next: () => Promise<void>) => await next();
      manager.use(middleware);
      expect((manager as any).middleware).toHaveLength(1);
    });
  });

  describe('event listeners', () => {
    it('should register event listener', () => {
      const listener = () => {};
      manager.on('state:change', listener);
      expect((manager as any).eventListeners.has('state:change')).toBe(true);
    });

    it('should unregister event listener', () => {
      const listener = () => {};
      manager.on('state:change', listener);
      manager.off('state:change', listener);
      const listeners = (manager as any).eventListeners.get('state:change');
      expect(listeners?.has(listener)).toBe(false);
    });
  });

  describe('registerReducer', () => {
    it('should register custom reducer', () => {
      const reducer = (state: any) => state;
      manager.registerReducer('custom', reducer);
      expect((manager as any).reducers.has('custom')).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics', () => {
      const stats = manager.getStatistics();
      expect(stats).toBeDefined();
      expect(typeof stats.totalTransitions).toBe('number');
      expect(typeof stats.totalSnapshots).toBe('number');
    });
  });

  describe('destroy', () => {
    it('should destroy manager', async () => {
      await manager.destroy();
      expect((manager as any).destroyed).toBe(true);
    });

    it('should throw after destroyed', async () => {
      await manager.destroy();
      await expect(manager.setState('global', 'foo', 'bar', 'merge')).rejects.toThrow();
    });
  });
});

describe('createStateManager', () => {
  it('should create state manager', () => {
    const manager = createStateManager({ foo: 'bar' });
    expect(manager).toBeInstanceOf(AdvancedStateManager);
  });

  it('should accept custom config', () => {
    const manager = createStateManager({ foo: 'bar' }, {
      defaultStrategy: 'replace',
      snapshots: false
    });
    expect(manager.config.defaultStrategy).toBe('replace');
    expect(manager.config.snapshots).toBe(false);
  });
});
