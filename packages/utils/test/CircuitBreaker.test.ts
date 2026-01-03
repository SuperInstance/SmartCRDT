/**
 * Tests for CircuitBreaker
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, createCircuitBreaker, createStandardCircuitBreaker, CircuitBreakerError } from '../src/retry/CircuitBreaker.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      halfOpenAttempts: 2,
    });
  });

  afterEach(() => {
    breaker.dispose();
  });

  describe('Basic operations', () => {
    it('should start closed', () => {
      expect(breaker.getState()).toBe('closed');
      expect(breaker.isClosed()).toBe(true);
    });

    it('should execute successfully', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('should track successes', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      await breaker.execute(fn);
      await breaker.execute(fn);

      const stats = breaker.getStats();
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.successCount).toBe(2);
    });

    it('should track failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'));

      try {
        await breaker.execute(fn);
      } catch {
        // Expected
      }

      const stats = breaker.getStats();
      expect(stats.totalFailures).toBe(1);
      expect(stats.failureCount).toBe(1);
    });
  });

  describe('Opening circuit', () => {
    it('should open after threshold failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'));

      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open');
      expect(breaker.isOpen()).toBe(true);
    });

    it('should reject when open', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      // Try to execute again
      await expect(breaker.execute(fn)).rejects.toThrow(CircuitBreakerError);
      expect(breaker.isOpen()).toBe(true);
    });

    it('should not open before threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'));

      // Fail 2 times (below threshold of 3)
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('Half-open state', () => {
    it('should transition to half-open after timeout', async () => {
      vi.useFakeTimers();

      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open');

      // Advance past recovery timeout
      vi.advanceTimersByTime(1100);

      // Next execution should transition to half-open
      const successFn = vi.fn().mockResolvedValue('success');
      const result = await breaker.execute(successFn);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('half-open');

      vi.useRealTimers();
    });

    it('should close on sufficient successes in half-open', async () => {
      vi.useFakeTimers();

      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      // Advance past recovery timeout
      vi.advanceTimersByTime(1100);

      // Succeed multiple times to close circuit
      const successFn = vi.fn().mockResolvedValue('success');
      await breaker.execute(successFn);
      await breaker.execute(successFn);

      expect(breaker.getState()).toBe('closed');

      vi.useRealTimers();
    });

    it('should reopen on failure in half-open', async () => {
      vi.useFakeTimers();

      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      // Advance past recovery timeout
      vi.advanceTimersByTime(1100);

      // Fail in half-open
      try {
        await breaker.execute(failFn);
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('open');

      vi.useRealTimers();
    });
  });

  describe('Statistics', () => {
    it('should track total executions', async () => {
      const successFn = vi.fn().mockResolvedValue('success');
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));

      await breaker.execute(successFn);
      await breaker.execute(successFn);

      try {
        await breaker.execute(failFn);
      } catch {
        // Expected
      }

      const stats = breaker.getStats();
      expect(stats.totalExecutions).toBe(3);
    });

    it('should calculate success rate', async () => {
      const successFn = vi.fn().mockResolvedValue('success');
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));

      await breaker.execute(successFn);
      await breaker.execute(successFn);

      try {
        await breaker.execute(failFn);
      } catch {
        // Expected
      }

      expect(breaker.getSuccessRate()).toBe(2 / 3);
      expect(breaker.getFailureRate()).toBe(1 / 3);
    });

    it('should track timestamps', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failed'));

      try {
        await breaker.execute(fn);
      } catch {
        // Expected
      }

      const stats = breaker.getStats();
      expect(stats.lastFailureTime).toBeGreaterThan(0);
    });

    it('should track time since opened', async () => {
      vi.useFakeTimers();

      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      vi.advanceTimersByTime(500);

      expect(breaker.getTimeSinceOpened()).toBe(500);

      vi.useRealTimers();
    });

    it('should estimate time until recovery', async () => {
      vi.useFakeTimers();

      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      vi.advanceTimersByTime(200);

      const timeUntilRecovery = breaker.getTimeUntilRecovery();
      expect(timeUntilRecovery).toBeGreaterThan(0);
      expect(timeUntilRecovery).toBeLessThanOrEqual(1000);

      vi.useRealTimers();
    });
  });

  describe('Reset and manual control', () => {
    it('should reset to closed state', async () => {
      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      expect(breaker.isOpen()).toBe(true);

      breaker.reset();

      expect(breaker.isClosed()).toBe(true);
      expect(breaker.getStats().failureCount).toBe(0);
    });

    it('should force open', () => {
      breaker.open();

      expect(breaker.getState()).toBe('open');
    });

    it('should force close', () => {
      breaker.open();
      breaker.close();

      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('Function wrapping', () => {
    it('should wrap function', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const wrapped = breaker.wrap(fn);

      const result = await wrapped();

      expect(result).toBe('success');
    });

    it('should pass arguments to wrapped function', async () => {
      const fn = vi.fn((a: number, b: string) => `${a}-${b}`);
      const wrapped = breaker.wrap(fn);

      const result = await wrapped(42, 'test');

      expect(result).toBe('42-test');
      expect(fn).toHaveBeenCalledWith(42, 'test');
    });
  });

  describe('Convenience functions', () => {
    it('should create with createCircuitBreaker', () => {
      const b = createCircuitBreaker({ failureThreshold: 5 });

      expect(b).toBeInstanceOf(CircuitBreaker);
    });

    it('should create standard breaker', () => {
      const b = createStandardCircuitBreaker();

      expect(b).toBeInstanceOf(CircuitBreaker);
      expect(b.getStats().state).toBe('closed');
    });
  });

  describe('Auto-recovery', () => {
    it('should auto-recover after timeout', async () => {
      vi.useFakeTimers();

      const b = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 500,
        autoRecover: true,
      });

      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error('Failed'));
      for (let i = 0; i < 2; i++) {
        try {
          await b.execute(failFn);
        } catch {
          // Expected
        }
      }

      expect(b.getState()).toBe('open');

      // Advance past recovery timeout
      vi.advanceTimersByTime(600);

      // Should be in half-open now
      expect(b.getState()).toBe('half-open');

      b.dispose();
      vi.useRealTimers();
    });
  });

  describe('Execution timeout', () => {
    it('should timeout execution', async () => {
      const b = new CircuitBreaker({
        executionTimeout: 100,
      });

      const slowFn = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 500))
      );

      await expect(b.execute(slowFn)).rejects.toThrow('timed out');
    });
  });
});
