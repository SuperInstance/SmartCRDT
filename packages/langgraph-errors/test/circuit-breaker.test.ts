/**
 * @file circuit-breaker.test.ts - Tests for circuit breaker
 * @package @lsi/langgraph-errors
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreakerManager } from '../src/circuit-breaker.js';
import type { CircuitBreakerConfig, CircuitState } from '../src/types.js';

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager({
      failure_threshold: 3,
      reset_timeout: 1000,
      success_threshold: 2,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Circuit States', () => {
    it('should start in closed state', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      await manager.execute('agent-1', operation);

      const state = manager.getState('agent-1');
      expect(state?.state).toBe('closed');
    });

    it('should open circuit after threshold failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', operation);
        } catch (e) {
          // Expected
        }
      }

      const state = manager.getState('agent-1');
      expect(state?.state).toBe('open');
    });

    it('should reject requests when circuit is open', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // Fail enough to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', operation);
        } catch (e) {
          // Expected
        }
      }

      // Try to execute with open circuit
      await expect(manager.execute('agent-1', operation)).rejects.toThrow(
        'Circuit breaker is open'
      );
    });

    it('should transition to half-open after reset timeout', async () => {
      vi.useFakeTimers();

      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // Fail enough to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', operation);
        } catch (e) {
          // Expected
        }
      }

      // Advance past reset timeout
      await vi.advanceTimersByTimeAsync(1100);

      // Execute should now attempt (half-open)
      operation.mockResolvedValueOnce('success');
      const result = await manager.execute('agent-1', operation);

      expect(result).toBe('success');

      const state = manager.getState('agent-1');
      expect(state?.state).toBe('half-open');
    });

    it('should close circuit after successful attempts in half-open', async () => {
      vi.useFakeTimers();

      const failOp = vi.fn().mockRejectedValue(new Error('fail'));
      const successOp = vi.fn().mockResolvedValue('success');

      // Fail enough to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', failOp);
        } catch (e) {
          // Expected
        }
      }

      // Advance past reset timeout
      await vi.advanceTimersByTimeAsync(1100);

      // Succeed twice to close circuit
      await manager.execute('agent-1', successOp);
      await manager.execute('agent-1', successOp);

      const state = manager.getState('agent-1');
      expect(state?.state).toBe('closed');
    });

    it('should open circuit again on failure in half-open', async () => {
      vi.useFakeTimers();

      const failOp = vi.fn().mockRejectedValue(new Error('fail'));

      // Fail enough to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', failOp);
        } catch (e) {
          // Expected
        }
      }

      // Advance past reset timeout
      await vi.advanceTimersByTimeAsync(1100);

      // Fail in half-open
      try {
        await manager.execute('agent-1', failOp);
      } catch (e) {
        // Expected
      }

      const state = manager.getState('agent-1');
      expect(state?.state).toBe('open');
    });
  });

  describe('State Management', () => {
    it('should track failure count', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 2; i++) {
        try {
          await manager.execute('agent-1', operation);
        } catch (e) {
          // Expected
        }
      }

      const state = manager.getState('agent-1');
      expect(state?.failure_count).toBe(2);
    });

    it('should reset failure count on success', async () => {
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));
      const successOp = vi.fn().mockResolvedValue('success');

      // Fail twice
      for (let i = 0; i < 2; i++) {
        try {
          await manager.execute('agent-1', failOp);
        } catch (e) {
          // Expected
        }
      }

      // Succeed
      await manager.execute('agent-1', successOp);

      const state = manager.getState('agent-1');
      expect(state?.failure_count).toBe(0);
    });

    it('should track total requests', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      await manager.execute('agent-1', operation);
      await manager.execute('agent-1', operation);

      const state = manager.getState('agent-1');
      expect(state?.total_requests).toBe(2);
    });

    it('should track total failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', operation);
        } catch (e) {
          // Expected
        }
      }

      const state = manager.getState('agent-1');
      expect(state?.total_failures).toBe(3);
    });
  });

  describe('allowsRequests', () => {
    it('should allow requests when closed', () => {
      expect(manager.allowsRequests('agent-1')).toBe(true);
    });

    it('should not allow requests when open', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', operation);
        } catch (e) {
          // Expected
        }
      }

      expect(manager.allowsRequests('agent-1')).toBe(false);
    });

    it('should allow requests after reset timeout', async () => {
      vi.useFakeTimers();

      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', operation);
        } catch (e) {
          // Expected
        }
      }

      await vi.advanceTimersByTimeAsync(1100);

      expect(manager.allowsRequests('agent-1')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', operation);
        } catch (e) {
          // Expected
        }
      }

      manager.reset('agent-1');

      const state = manager.getState('agent-1');
      expect(state?.state).toBe('closed');
      expect(state?.failure_count).toBe(0);
    });
  });

  describe('forceOpen', () => {
    it('should force circuit open', () => {
      manager.forceOpen('agent-1');

      const state = manager.getState('agent-1');
      expect(state?.state).toBe('open');
    });
  });

  describe('forceClose', () => {
    it('should force circuit closed', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-1', operation);
        } catch (e) {
          // Expected
        }
      }

      manager.forceClose('agent-1');

      const state = manager.getState('agent-1');
      expect(state?.state).toBe('closed');
    });
  });

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      const successOp = vi.fn().mockResolvedValue('success');
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));

      await manager.execute('agent-1', successOp);
      await manager.execute('agent-2', successOp);

      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('agent-3', failOp);
        } catch (e) {
          // Expected
        }
      }

      const stats = manager.getStatistics();

      expect(stats.total).toBe(3);
      expect(stats.byState.closed).toBe(2);
      expect(stats.byState.open).toBe(1);
      expect(stats.details).toHaveLength(3);
    });
  });

  describe('remove', () => {
    it('should remove circuit breaker', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      await manager.execute('agent-1', operation);

      manager.remove('agent-1');

      const state = manager.getState('agent-1');
      expect(state).toBeUndefined();
    });
  });
});
