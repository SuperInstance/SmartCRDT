/**
 * Tests for BaseManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseManager } from '../src/base/BaseManager.js';

interface TestConfig {
  timeout: number;
  retries: number;
  apiKey: string;
  nested?: {
    value: number;
  };
}

interface TestStats {
  requestsProcessed: number;
  totalLatency: number;
  errorCount: number;
}

interface TestState {
  isActive: boolean;
  currentMode: string;
}

class TestManager extends BaseManager<TestConfig, TestStats, TestState> {
  constructor(config?: Partial<TestConfig>, options?: { debug?: boolean }) {
    super(
      { timeout: 30000, retries: 3, apiKey: '' },
      config,
      options
    );
  }

  protected getDefaultConfig(): TestConfig {
    return { timeout: 30000, retries: 3, apiKey: '' };
  }

  protected initializeStats(): TestStats {
    return { requestsProcessed: 0, totalLatency: 0, errorCount: 0 };
  }

  protected initializeState(): TestState {
    return { isActive: false, currentMode: 'idle' };
  }

  async initialize(): Promise<void> {
    this.state.isActive = true;
    this.initialized = true;
    this.emit({ type: 'initialized', timestamp: Date.now() });
  }

  async dispose(): Promise<void> {
    this.state.isActive = false;
    this.disposed = true;
    this.emit({ type: 'disposed', timestamp: Date.now() });
  }

  // Test helper methods
  processRequest(latency: number): void {
    this.incrementStat('requestsProcessed');
    this.incrementStat('totalLatency', latency);
  }

  recordError(): void {
    this.incrementStat('errorCount');
  }
}

describe('BaseManager', () => {
  let manager: TestManager;

  beforeEach(() => {
    manager = new TestManager();
  });

  describe('Configuration', () => {
    it('should use default config', () => {
      expect(manager.getConfig().timeout).toBe(30000);
      expect(manager.getConfig().retries).toBe(3);
    });

    it('should merge user config with defaults', () => {
      const customManager = new TestManager({ timeout: 60000 });
      expect(customManager.getConfig().timeout).toBe(60000);
      expect(customManager.getConfig().retries).toBe(3);
    });

    it('should deep merge nested objects', () => {
      const customManager = new TestManager({
        nested: { value: 42 }
      });
      expect(customManager.getConfig().nested?.value).toBe(42);
    });

    it('should update config', () => {
      manager.updateConfig({ timeout: 90000 });
      expect(manager.getConfig().timeout).toBe(90000);
    });

    it('should return readonly config', () => {
      const config = manager.getConfig();
      expect(() => {
        (config as { timeout: number }).timeout = 123;
      }).not.toThrow();
      expect(manager.getConfig().timeout).toBe(30000);
    });
  });

  describe('Statistics', () => {
    it('should initialize stats', () => {
      expect(manager.getStats().requestsProcessed).toBe(0);
      expect(manager.getStats().totalLatency).toBe(0);
    });

    it('should increment stats', () => {
      manager.processRequest(100);
      manager.processRequest(200);

      expect(manager.getStats().requestsProcessed).toBe(2);
      expect(manager.getStats().totalLatency).toBe(300);
    });

    it('should track errors', () => {
      manager.recordError();
      manager.recordError();

      expect(manager.getStats().errorCount).toBe(2);
    });

    it('should reset stats', () => {
      manager.processRequest(100);
      manager.recordError();

      manager.resetStats();

      expect(manager.getStats().requestsProcessed).toBe(0);
      expect(manager.getStats().errorCount).toBe(0);
    });

    it('should return readonly stats', () => {
      const stats = manager.getStats();
      stats.requestsProcessed = 999;
      expect(manager.getStats().requestsProcessed).toBe(0);
    });
  });

  describe('State', () => {
    it('should initialize state', () => {
      expect(manager.getState().isActive).toBe(false);
      expect(manager.getState().currentMode).toBe('idle');
    });

    it('should return readonly state', () => {
      const state = manager.getState();
      state.isActive = true;
      expect(manager.getState().isActive).toBe(false);
    });
  });

  describe('Lifecycle', () => {
    it('should initialize', async () => {
      await manager.initialize();
      expect(manager.isInitialized()).toBe(true);
      expect(manager.getState().isActive).toBe(true);
    });

    it('should dispose', async () => {
      await manager.initialize();
      await manager.dispose();
      expect(manager.isDisposed()).toBe(true);
      expect(manager.getState().isActive).toBe(false);
    });

    it('should start after initialization', async () => {
      await manager.initialize();
      await manager.start();
      // Should not throw
    });

    it('should throw if start called before initialize', async () => {
      await expect(manager.start()).rejects.toThrow();
    });

    it('should stop', async () => {
      await manager.initialize();
      await manager.start();
      await manager.stop();
      // Should not throw
    });
  });

  describe('Events', () => {
    it('should emit config_updated event', () => {
      const listener = vi.fn();
      manager.on('config_updated', listener);

      manager.updateConfig({ timeout: 60000 });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'config_updated' })
      );
    });

    it('should unregister event listener', () => {
      const listener = vi.fn();
      manager.on('config_updated', listener);
      manager.off('config_updated', listener);

      manager.updateConfig({ timeout: 60000 });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should emit error event', () => {
      const listener = vi.fn();
      manager.on('error', listener);

      const error = new Error('Test error');
      manager.handleError(error, 'test context');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', error })
      );
    });
  });

  describe('Snapshots', () => {
    it('should create snapshot', () => {
      manager.processRequest(100);
      const snapshot = manager.createSnapshot();

      expect(snapshot.stats.requestsProcessed).toBe(1);
      expect(snapshot.timestamp).toBeGreaterThan(0);
    });

    it('should restore from snapshot', async () => {
      await manager.initialize();
      manager.processRequest(100);
      const snapshot = manager.createSnapshot();

      manager.resetStats();
      expect(manager.getStats().requestsProcessed).toBe(0);

      manager.restoreSnapshot(snapshot);
      expect(manager.getStats().requestsProcessed).toBe(1);
    });
  });
});
