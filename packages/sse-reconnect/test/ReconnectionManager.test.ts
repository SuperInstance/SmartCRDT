/**
 * ReconnectionManager Tests
 * Tests for the main reconnection manager orchestrator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReconnectionManager, createReconnectionManager } from '../src/ReconnectionManager.js';
import type { ReconnectConfig, SSEEvent } from '../src/types.js';

describe('ReconnectionManager', () => {
  let manager: ReconnectionManager;
  const testUrl = 'https://example.com/events';

  beforeEach(() => {
    manager = new ReconnectionManager(testUrl, {
      config: {
        maxRetries: 5,
        initialDelay: 100,
        maxDelay: 1000,
        healthCheckInterval: 30000,
        connectionTimeout: 5000
      }
    });
  });

  describe('Construction', () => {
    it('should create with URL', () => {
      const m = new ReconnectionManager(testUrl);

      expect(m).toBeDefined();
      expect(m.getReconnectState()).toBe('disconnected');
    });

    it('should create with factory function', () => {
      const m = createReconnectionManager(testUrl);

      expect(m).toBeDefined();
    });

    it('should create with custom config', () => {
      const m = new ReconnectionManager(testUrl, {
        config: { maxRetries: 10 }
      });

      expect(m.getConfig().maxRetries).toBe(10);
    });

    it('should use default config when not provided', () => {
      const m = new ReconnectionManager(testUrl);

      const config = m.getConfig();

      expect(config).toBeDefined();
      expect(config.maxRetries).toBeGreaterThan(0);
    });
  });

  describe('State Management', () => {
    it('should start in disconnected state', () => {
      expect(manager.getReconnectState()).toBe('disconnected');
    });

    it('should transition to reconnecting on start', async () => {
      // Mock connect function
      const mockConnect = vi.fn().mockResolvedValue({
        url: testUrl,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      });

      const promise = manager.start(mockConnect);

      expect(manager.getReconnectState()).toBe('reconnecting');

      await promise;
    });

    it('should transition to connected on success', async () => {
      const mockConnection = {
        url: testUrl,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      };

      const mockConnect = vi.fn().mockResolvedValue(mockConnection);

      await manager.start(mockConnect);

      expect(manager.getReconnectState()).toBe('connected');
    });

    it('should transition to disconnected on stop', async () => {
      const mockConnection = {
        url: testUrl,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      };

      const mockConnect = vi.fn().mockResolvedValue(mockConnection);

      await manager.start(mockConnect);
      manager.stop();

      expect(manager.getReconnectState()).toBe('disconnected');
    });
  });

  describe('Event Handlers', () => {
    it('should emit state change events', async () => {
      const handler = vi.fn();

      manager.onEvent(handler);

      const mockConnection = {
        url: testUrl,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      };

      const mockConnect = vi.fn().mockResolvedValue(mockConnection);

      await manager.start(mockConnect);

      expect(handler).toHaveBeenCalled();

      const stateChangeEvent = handler.mock.calls.find(call =>
        call[0].type === 'state-change'
      );

      expect(stateChangeEvent).toBeDefined();
    });

    it('should support multiple handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.onEvent(handler1);
      manager.onEvent(handler2);

      const mockConnection = {
        url: testUrl,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      };

      const mockConnect = vi.fn().mockResolvedValue(mockConnection);

      await manager.start(mockConnect);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should unsubscribe handler', () => {
      const handler = vi.fn();

      const unsubscribe = manager.onEvent(handler);
      unsubscribe();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Attempt History', () => {
    it('should track attempt history', async () => {
      const mockConnect = vi.fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue({
          url: testUrl,
          readyState: 1,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          close: vi.fn()
        });

      // This will fail initially and then succeed
      try {
        await manager.start(mockConnect);
      } catch (error) {
        // First attempt failed
      }

      const history = manager.getAttemptHistory();

      expect(history.length).toBeGreaterThan(0);
    });

    it('should reset attempt history', async () => {
      const mockConnect = vi.fn().mockRejectedValue(new Error('Failed'));

      try {
        await manager.start(mockConnect);
      } catch (error) {
        // Failed
      }

      manager.resetHistory();

      expect(manager.getAttemptHistory()).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should return statistics', () => {
      const stats = manager.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.state).toBeDefined();
      expect(stats.totalAttempts).toBeDefined();
      expect(stats.bufferSize).toBeDefined();
    });

    it('should track total attempts', async () => {
      const mockConnect = vi.fn().mockRejectedValue(new Error('Failed'));

      try {
        await manager.start(mockConnect);
      } catch (error) {
        // Failed
      }

      const stats = manager.getStatistics();

      expect(stats.totalAttempts).toBeGreaterThan(0);
    });

    it('should track successful reconnections', async () => {
      const mockConnection = {
        url: testUrl,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      };

      const mockConnect = vi.fn().mockResolvedValue(mockConnection);

      await manager.start(mockConnect);

      const stats = manager.getStatistics();

      expect(stats.successfulReconnections).toBeGreaterThan(0);
    });
  });

  describe('Event Buffering', () => {
    it('should buffer events when disconnected', () => {
      const event: SSEEvent = {
        id: '1',
        event: 'message',
        data: 'test data'
      };

      manager.bufferEvent(event);

      const stats = manager.getStatistics();

      expect(stats.bufferedEventCount).toBe(1);
    });

    it('should emit event buffered event', () => {
      const handler = vi.fn();

      manager.onEvent(handler);

      manager.bufferEvent({
        data: 'test'
      });

      const bufferEvent = handler.mock.calls.find(call =>
        call[0].type === 'event-buffered'
      );

      expect(bufferEvent).toBeDefined();
    });

    it('should replay buffered events', () => {
      manager.bufferEvent({ data: 'event1' });
      manager.bufferEvent({ data: 'event2' });

      const replayed = manager.replayEvents();

      expect(replayed).toHaveLength(2);
    });

    it('should clear buffer after replay', () => {
      manager.bufferEvent({ data: 'event1' });

      manager.replayEvents();

      const stats = manager.getStatistics();

      expect(stats.bufferedEventCount).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update max retries', () => {
      manager.setMaxRetries(20);

      expect(manager.getConfig().maxRetries).toBe(20);
    });

    it('should update configuration', () => {
      manager.updateConfig({
        initialDelay: 500,
        maxDelay: 5000
      });

      const config = manager.getConfig();

      expect(config.initialDelay).toBe(500);
      expect(config.maxDelay).toBe(5000);
    });

    it('should get current configuration', () => {
      const config = manager.getConfig();

      expect(config).toBeDefined();
      expect(config.maxRetries).toBeDefined();
    });
  });

  describe('Force Reconnect', () => {
    it('should force reconnection', async () => {
      const mockConnection = {
        url: testUrl,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      };

      const mockConnect = vi.fn().mockResolvedValue(mockConnection);

      // First establish connection
      await manager.start(mockConnect);

      // Then force reconnect
      await manager.forceReconnect();

      expect(mockConnect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Reset', () => {
    it('should reset all state', async () => {
      const mockConnection = {
        url: testUrl,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      };

      const mockConnect = vi.fn().mockResolvedValue(mockConnection);

      await manager.start(mockConnect);
      manager.bufferEvent({ data: 'test' });

      manager.reset();

      expect(manager.getReconnectState()).toBe('disconnected');
      expect(manager.getAttemptHistory()).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      const mockConnect = vi.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(manager.start(mockConnect)).rejects.toThrow();
    });

    it('should handle missing connect function', async () => {
      await expect(manager.start()).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle stop when not started', () => {
      expect(() => {
        manager.stop();
      }).not.toThrow();
    });

    it('should handle multiple stop calls', async () => {
      const mockConnection = {
        url: testUrl,
        readyState: 1,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        close: vi.fn()
      };

      const mockConnect = vi.fn().mockResolvedValue(mockConnection);

      await manager.start(mockConnect);

      expect(() => {
        manager.stop();
        manager.stop();
        manager.stop();
      }).not.toThrow();
    });

    it('should handle force reconnect when disconnected', async () => {
      // This should just attempt to reconnect
      const mockConnect = vi.fn().mockRejectedValue(new Error('No connection'));

      await expect(manager.forceReconnect()).rejects.toThrow();
    });
  });
});
