/**
 * ReconnectionManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReconnectionManager,
  calculateLinearBackoff,
  calculateExponentialBackoff,
  calculateJitterBackoff
} from '../src/ReconnectionManager.js';

describe('ReconnectionManager', () => {
  let reconnectManager: ReconnectionManager;
  let mockConnectFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reconnectManager = new ReconnectionManager({
      strategy: 'exponential',
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000
    });
    mockConnectFn = vi.fn().mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateDelay', () => {
    it('should calculate linear delay', () => {
      const rm = new ReconnectionManager({ strategy: 'linear' });
      expect(rm.calculateDelay(1)).toBe(1000);
      expect(rm.calculateDelay(2)).toBe(2000);
      expect(rm.calculateDelay(3)).toBe(3000);
    });

    it('should calculate exponential delay', () => {
      const rm = new ReconnectionManager({ strategy: 'exponential' });
      expect(rm.calculateDelay(1)).toBe(1000);
      expect(rm.calculateDelay(2)).toBe(2000);
      expect(rm.calculateDelay(3)).toBe(4000);
      expect(rm.calculateDelay(4)).toBe(8000);
    });

    it('should clamp delay to maxDelay', () => {
      const rm = new ReconnectionManager({
        strategy: 'exponential',
        maxDelay: 5000
      });
      expect(rm.calculateDelay(10)).toBeLessThanOrEqual(5000);
    });

    it('should add jitter', () => {
      const rm = new ReconnectionManager({
        strategy: 'jitter',
        jitterAmount: 0.5
      });
      const delay1 = rm.calculateDelay(1);
      const delay2 = rm.calculateDelay(1);
      // Should vary due to jitter
      expect(delay1).not.toBe(delay2);
    });
  });

  describe('reconnect', () => {
    it('should connect successfully', async () => {
      mockConnectFn.mockResolvedValue(undefined);
      await reconnectManager.reconnect(mockConnectFn);
      expect(mockConnectFn).toHaveBeenCalledTimes(1);
    });

    it('should wait for delay before connecting', async () => {
      const rm = new ReconnectionManager({
        strategy: 'linear',
        initialDelay: 5000
      });
      const promise = rm.reconnect(mockConnectFn);
      expect(mockConnectFn).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      await promise;
      expect(mockConnectFn).toHaveBeenCalled();
    });

    it('should reset attempts on success', async () => {
      mockConnectFn.mockResolvedValue(undefined);
      await reconnectManager.reconnect(mockConnectFn);
      expect(reconnectManager.getRetryCount()).toBe(0);
    });

    it('should increment attempts on failure', async () => {
      mockConnectFn.mockRejectedValue(new Error('Connection failed'));
      await expect(reconnectManager.reconnect(mockConnectFn)).rejects.toThrow();
      expect(reconnectManager.getRetryCount()).toBe(1);
    });

    it('should call onAttempt handler', async () => {
      const onAttempt = vi.fn();
      const rm = new ReconnectionManager({}, { onAttempt });
      await rm.reconnect(mockConnectFn);
      expect(onAttempt).toHaveBeenCalled();
    });

    it('should call onSuccess handler', async () => {
      const onSuccess = vi.fn();
      const rm = new ReconnectionManager({}, { onSuccess });
      await rm.reconnect(mockConnectFn);
      expect(onSuccess).toHaveBeenCalled();
    });

    it('should call onFailure handler', async () => {
      const onFailure = vi.fn();
      mockConnectFn.mockRejectedValue(new Error('Failed'));
      const rm = new ReconnectionManager({}, { onFailure });
      await expect(rm.reconnect(mockConnectFn)).rejects.toThrow();
      expect(onFailure).toHaveBeenCalled();
    });

    it('should reject if already reconnecting', async () => {
      const rm = new ReconnectionManager({ initialDelay: 10000 });
      const promise1 = rm.reconnect(mockConnectFn);
      await expect(rm.reconnect(mockConnectFn)).rejects.toThrow('already in progress');
      vi.advanceTimersByTime(10000);
      await promise1;
    });

    it('should reject on max retries', async () => {
      const rm = new ReconnectionManager({
        maxRetries: 2,
        initialDelay: 100
      });
      mockConnectFn.mockRejectedValue(new Error('Failed'));
      await expect(rm.reconnect(mockConnectFn)).rejects.toThrow();
      await expect(rm.reconnect(mockConnectFn)).rejects.toThrow();
      await expect(rm.reconnect(mockConnectFn)).rejects.toThrow('Max retries exceeded');
    });

    it('should call onMaxRetriesReached', async () => {
      const onMaxRetriesReached = vi.fn();
      const rm = new ReconnectionManager({
        maxRetries: 1,
        initialDelay: 100
      }, { onMaxRetriesReached });
      mockConnectFn.mockRejectedValue(new Error('Failed'));
      await expect(rm.reconnect(mockConnectFn)).rejects.toThrow();
      await expect(rm.reconnect(mockConnectFn)).rejects.toThrow();
      expect(onMaxRetriesReached).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel pending reconnection', async () => {
      const rm = new ReconnectionManager({ initialDelay: 10000 });
      const promise = rm.reconnect(mockConnectFn);
      rm.cancel();
      vi.advanceTimersByTime(10000);
      expect(mockConnectFn).not.toHaveBeenCalled();
    });

    it('should reset reconnecting state', () => {
      const rm = new ReconnectionManager({ initialDelay: 10000 });
      rm.reconnect(mockConnectFn);
      expect(rm.isReconnecting()).toBe(true);
      rm.cancel();
      expect(rm.isReconnecting()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset state', async () => {
      mockConnectFn.mockRejectedValue(new Error('Failed'));
      await expect(reconnectManager.reconnect(mockConnectFn)).rejects.toThrow();
      expect(reconnectManager.getRetryCount()).toBe(1);
      reconnectManager.reset();
      expect(reconnectManager.getRetryCount()).toBe(0);
      expect(reconnectManager.getState().history).toHaveLength(0);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = reconnectManager.getState();
      expect(state).toHaveProperty('attempts');
      expect(state).toHaveProperty('nextAttemptAt');
      expect(state).toHaveProperty('nextDelay');
      expect(state).toHaveProperty('history');
      expect(state).toHaveProperty('isReconnecting');
    });
  });

  describe('isReconnecting', () => {
    it('should return false initially', () => {
      expect(reconnectManager.isReconnecting()).toBe(false);
    });

    it('should return true while reconnecting', async () => {
      const rm = new ReconnectionManager({ initialDelay: 10000 });
      const promise = rm.reconnect(mockConnectFn);
      expect(rm.isReconnecting()).toBe(true);
      rm.cancel();
      await promise.catch(() => {});
    });
  });

  describe('getRetryCount', () => {
    it('should return 0 initially', () => {
      expect(reconnectManager.getRetryCount()).toBe(0);
    });

    it('should increment on failure', async () => {
      mockConnectFn.mockRejectedValue(new Error('Failed'));
      await expect(reconnectManager.reconnect(mockConnectFn)).rejects.toThrow();
      expect(reconnectManager.getRetryCount()).toBe(1);
    });
  });

  describe('getNextDelay', () => {
    it('should return null initially', () => {
      expect(reconnectManager.getNextDelay()).toBeNull();
    });

    it('should return delay when reconnecting', async () => {
      const rm = new ReconnectionManager({
        strategy: 'linear',
        initialDelay: 5000
      });
      const promise = rm.reconnect(mockConnectFn);
      expect(rm.getNextDelay()).toBe(5000);
      rm.cancel();
      await promise.catch(() => {});
    });
  });

  describe('getTimeUntilNextAttempt', () => {
    it('should return null when not reconnecting', () => {
      expect(reconnectManager.getTimeUntilNextAttempt()).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return empty array initially', () => {
      expect(reconnectManager.getHistory()).toEqual([]);
    });

    it('should record attempts', async () => {
      await reconnectManager.reconnect(mockConnectFn);
      const history = reconnectManager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(true);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      reconnectManager.updateConfig({ maxRetries: 10 });
      // Test by checking if new config affects behavior
      const delay = reconnectManager.calculateDelay(1);
      expect(delay).toBeGreaterThan(0);
    });
  });

  describe('updateHandlers', () => {
    it('should update handlers', () => {
      const newHandler = vi.fn();
      reconnectManager.updateHandlers({ onAttempt: newHandler });
      // Handler should be called on next attempt
      reconnectManager.reconnect(mockConnectFn);
      expect(newHandler).toHaveBeenCalled();
    });
  });

  describe('shouldReconnect', () => {
    it('should return true for non-fatal errors', () => {
      const error = { type: 'connection', fatal: false };
      expect(reconnectManager.shouldReconnect(error)).toBe(true);
    });

    it('should return false for fatal errors', () => {
      const error = { type: 'connection', fatal: true };
      expect(reconnectManager.shouldReconnect(error)).toBe(false);
    });

    it('should return false when max retries exceeded', async () => {
      const rm = new ReconnectionManager({
        maxRetries: 1
      });
      mockConnectFn.mockRejectedValue(new Error('Failed'));
      await expect(rm.reconnect(mockConnectFn)).rejects.toThrow();
      const error = { type: 'connection', fatal: false };
      expect(rm.shouldReconnect(error)).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      mockConnectFn.mockResolvedValueOnce(undefined);
      mockConnectFn.mockRejectedValueOnce(new Error('Failed'));
      await reconnectManager.reconnect(mockConnectFn);
      try {
        await reconnectManager.reconnect(mockConnectFn);
      } catch {}
      const stats = reconnectManager.getStats();
      expect(stats.attempts).toBe(2);
      expect(stats.successfulAttempts).toBe(1);
      expect(stats.failedAttempts).toBe(1);
    });

    it('should calculate average delay', async () => {
      await reconnectManager.reconnect(mockConnectFn);
      const stats = reconnectManager.getStats();
      expect(stats.averageDelay).toBeGreaterThan(0);
    });
  });
});

describe('Backoff Calculations', () => {
  describe('calculateLinearBackoff', () => {
    it('should calculate linear backoff', () => {
      expect(calculateLinearBackoff(1000, 1, 10000)).toBe(1000);
      expect(calculateLinearBackoff(1000, 5, 10000)).toBe(5000);
      expect(calculateLinearBackoff(1000, 15, 10000)).toBe(10000); // Clamped
    });
  });

  describe('calculateExponentialBackoff', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateExponentialBackoff(1000, 1, 10000)).toBe(1000);
      expect(calculateExponentialBackoff(1000, 2, 10000)).toBe(2000);
      expect(calculateExponentialBackoff(1000, 3, 10000)).toBe(4000);
      expect(calculateExponentialBackoff(1000, 4, 10000)).toBe(8000);
      expect(calculateExponentialBackoff(1000, 5, 10000)).toBe(10000); // Clamped
    });
  });

  describe('calculateJitterBackoff', () => {
    it('should add jitter to exponential backoff', () => {
      const delay1 = calculateJitterBackoff(1000, 3, 10000, 0.1);
      const delay2 = calculateJitterBackoff(1000, 3, 10000, 0.1);
      // Base is 4000, with 10% jitter = 4000 +/- 400 = 3600-4400
      expect(delay1).toBeGreaterThanOrEqual(3600);
      expect(delay1).toBeLessThanOrEqual(4400);
      // Should vary
      expect(delay1).not.toBe(delay2);
    });

    it('should clamp to maxDelay', () => {
      const delay = calculateJitterBackoff(1000, 20, 5000, 0.1);
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('should not go negative', () => {
      const delay = calculateJitterBackoff(100, 1, 10000, 0.5);
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });
});
