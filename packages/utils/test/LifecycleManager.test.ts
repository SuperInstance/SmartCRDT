/**
 * Tests for LifecycleManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifecycleManager, createLifecycle, withLifecycle } from '../src/lifecycle/LifecycleManager.js';

describe('LifecycleManager', () => {
  let manager: LifecycleManager;

  beforeEach(() => {
    manager = new LifecycleManager();
  });

  describe('State management', () => {
    it('should start uninitialized', () => {
      expect(manager.getState()).toBe('uninitialized');
      expect(manager.isInitialized()).toBe(false);
      expect(manager.isStarted()).toBe(false);
    });

    it('should initialize', async () => {
      await manager.initialize();

      expect(manager.getState()).toBe('initialized');
      expect(manager.isInitialized()).toBe(true);
    });

    it('should start', async () => {
      await manager.initialize();
      await manager.start();

      expect(manager.getState()).toBe('started');
      expect(manager.isStarted()).toBe(true);
    });

    it('should stop', async () => {
      await manager.initialize();
      await manager.start();
      await manager.stop();

      expect(manager.getState()).toBe('stopped');
      expect(manager.isStopped()).toBe(true);
    });

    it('should dispose', async () => {
      await manager.initialize();
      await manager.dispose();

      expect(manager.getState()).toBe('disposed');
      expect(manager.isDisposed()).toBe(true);
    });
  });

  describe('Lifecycle hooks', () => {
    it('should call onInitialize hook', async () => {
      const hook = vi.fn();
      const m = new LifecycleManager({ onInitialize: hook });

      await m.initialize();

      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('should call onStart hook', async () => {
      const hook = vi.fn();
      const m = new LifecycleManager({ onStart: hook });

      await m.initialize();
      await m.start();

      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('should call onStop hook', async () => {
      const hook = vi.fn();
      const m = new LifecycleManager({ onStop: hook });

      await m.initialize();
      await m.start();
      await m.stop();

      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('should call onDispose hook', async () => {
      const hook = vi.fn();
      const m = new LifecycleManager({ onDispose: hook });

      await m.initialize();
      await m.dispose();

      expect(hook).toHaveBeenCalledTimes(1);
    });

    it('should call onError hook on error', async () => {
      const errorHook = vi.fn();
      const m = new LifecycleManager({
        onInitialize: () => { throw new Error('Init failed'); },
        onError: errorHook,
      });

      try {
        await m.initialize();
      } catch {
        // Expected
      }

      expect(errorHook).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Init failed' })
      );
    });
  });

  describe('State transitions', () => {
    it('should not start without initialization', async () => {
      await expect(manager.start()).rejects.toThrow();
    });

    it('should not stop without starting', async () => {
      await manager.initialize();
      await expect(manager.stop()).rejects.toThrow();
    });

    it('should restart', async () => {
      await manager.initialize();
      await manager.start();
      await manager.restart();

      expect(manager.getState()).toBe('started');
    });

    it('should stop automatically when disposing', async () => {
      await manager.initialize();
      await manager.start();
      await manager.dispose();

      expect(manager.getState()).toBe('disposed');
    });
  });

  describe('Events', () => {
    it('should emit state change events', async () => {
      const listener = vi.fn();
      manager.on('stateChanged', listener);

      await manager.initialize();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'initialized' })
      );
    });

    it('should emit specific state events', async () => {
      const initListener = vi.fn();
      manager.on('initialized', initListener);

      await manager.initialize();

      expect(initListener).toHaveBeenCalledWith(
        expect.objectContaining({ state: 'initialized' })
      );
    });

    it('should unregister listeners', async () => {
      const listener = vi.fn();
      manager.on('initialized', listener);
      manager.off('initialized', listener);

      await manager.initialize();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support one-time listeners', async () => {
      const listener = vi.fn();
      manager.once('initialized', listener);

      await manager.initialize();
      await manager.start();

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should transition to error state on failure', async () => {
      const m = new LifecycleManager({
        onInitialize: () => { throw new Error('Failed'); },
      });

      try {
        await m.initialize();
      } catch {
        // Expected
      }

      expect(m.getState()).toBe('error');
      expect(m.isError()).toBe(true);
      expect(m.getError()).toBeDefined();
    });

    it('should reset from error state', async () => {
      const m = new LifecycleManager({
        onInitialize: () => { throw new Error('Failed'); },
      });

      try {
        await m.initialize();
      } catch {
        // Expected
      }

      await m.reset();

      expect(m.getState()).toBe('uninitialized');
      expect(m.getError()).toBeUndefined();
    });

    it('should not reset from disposed state', async () => {
      await manager.initialize();
      await manager.dispose();

      await expect(manager.reset()).rejects.toThrow();
    });
  });

  describe('Auto-recovery', () => {
    it('should recover from error', async () => {
      let shouldFail = true;
      const m = new LifecycleManager({
        onInitialize: () => {
          if (shouldFail) throw new Error('Failed');
        },
        autoRecover: true,
        maxRetries: 3,
      });

      try {
        await m.initialize();
      } catch {
        // Expected first failure
      }

      expect(m.getState()).toBe('error');

      shouldFail = false;
      await m.recover();

      expect(m.getState()).toBe('started');
    });

    it('should exhaust retry attempts', async () => {
      const m = new LifecycleManager({
        onInitialize: () => { throw new Error('Always fails'); },
        autoRecover: true,
        maxRetries: 2,
      });

      try {
        await m.initialize();
      } catch {
        // Expected
      }

      expect(m.isError()).toBe(true);

      await expect(m.recover()).rejects.toThrow();
    });
  });

  describe('Timeout', () => {
    it('should timeout on long initialization', async () => {
      const m = new LifecycleManager({
        onInitialize: () => new Promise((resolve) => setTimeout(resolve, 10000)),
        timeout: 100,
      });

      await expect(m.initialize()).rejects.toThrow('timed out');
    });
  });

  describe('Waiting for state', () => {
    it('should wait for state', async () => {
      const waitForStarted = manager.waitForState('started', 1000);

      setTimeout(async () => {
        await manager.initialize();
        await manager.start();
      }, 50);

      await expect(waitForStarted).resolves.not.toThrow();
    });

    it('should timeout waiting for state', async () => {
      await expect(manager.waitForState('started', 100))
        .rejects.toThrow('Timeout');
    });

    it('should resolve immediately if already in state', async () => {
      await manager.initialize();

      await expect(manager.waitForState('initialized')).resolves.not.toThrow();
    });
  });

  describe('Convenience functions', () => {
    it('should create with createLifecycle', () => {
      const m = createLifecycle({
        onInitialize: vi.fn(),
      });

      expect(m).toBeInstanceOf(LifecycleManager);
    });

    it('should create with LifecycleManager.create', () => {
      const m = LifecycleManager.create({
        onInitialize: vi.fn(),
      });

      expect(m).toBeInstanceOf(LifecycleManager);
    });
  });

  describe('withLifecycle mixin', () => {
    it('should add lifecycle to class', async () => {
      class TestClass {
        value = 42;
      }

      const LifecycleTestClass = withLifecycle(TestClass, {
        onInitialize: async function(this: TestClass) {
          this.value = 100;
        },
      });

      const instance = new LifecycleTestClass();
      await instance.initialize();

      expect(instance.lifecycleState).toBe('initialized');
      expect((instance as TestClass).value).toBe(100);
    });
  });
});
