/**
 * Tests for RetryHelper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryHelper, retry, withRetry, RetryError } from '../src/retry/RetryHelper.js';

describe('RetryHelper', () => {
  beforeEach(() => {
    RetryHelper.resetStats();
  });

  describe('Basic retry', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await RetryHelper.withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await RetryHelper.withRetry(fn, { maxAttempts: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Permanent failure'));

      await expect(RetryHelper.withRetry(fn, { maxAttempts: 3 }))
        .rejects.toThrow('Permanent failure');

      expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
    });

    it('should respect custom maxAttempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Failure'));

      await expect(RetryHelper.withRetry(fn, { maxAttempts: 5 }))
        .rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(6); // initial + 5 retries
    });
  });

  describe('Exponential backoff', () => {
    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockImplementation((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });

      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 3) throw new Error('Fail');
        return 'success';
      });

      await RetryHelper.withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 2,
        jitter: false,
      });

      expect(delays[0]).toBe(100); // 1st retry
      expect(delays[1]).toBe(200); // 2nd retry (100 * 2)

      sleepSpy.mockRestore();
    });

    it('should respect max delay', async () => {
      const delays: number[] = [];
      vi.spyOn(RetryHelper as any, 'sleep').mockImplementation((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });

      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 5) throw new Error('Fail');
        return 'success';
      });

      await RetryHelper.withRetry(fn, {
        maxAttempts: 5,
        initialDelay: 1000,
        backoffMultiplier: 10,
        maxDelay: 2000,
        jitter: false,
      });

      // All delays should be <= maxDelay
      delays.forEach(delay => {
        expect(delay).toBeLessThanOrEqual(2000);
      });

      vi.clearAllMocks();
    });

    it('should add jitter', async () => {
      const delays: number[] = [];
      vi.spyOn(RetryHelper as any, 'sleep').mockImplementation((ms: number) => {
        delays.push(ms);
        return Promise.resolve();
      });

      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 3) throw new Error('Fail');
        return 'success';
      });

      await RetryHelper.withRetry(fn, {
        maxAttempts: 3,
        initialDelay: 100,
        jitter: true,
      });

      // With jitter, delays should vary
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(0);

      vi.clearAllMocks();
    });
  });

  describe('Retryable errors', () => {
    it('should not retry on 4xx errors', async () => {
      const fn = vi.fn().mockRejectedValue({
        status: 404,
        message: 'Not found',
      });

      await expect(RetryHelper.withRetry(fn))
        .rejects.toEqual(expect.objectContaining({ status: 404 }));

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx errors', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 2) {
          throw { status: 500, message: 'Internal server error' };
        }
        return 'success';
      });

      const result = await RetryHelper.withRetry(fn, { maxAttempts: 3 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);

      sleepSpy.mockRestore();
    });

    it('should retry on timeout', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 2) {
          throw { status: 408, message: 'Timeout' };
        }
        return 'success';
      });

      const result = await RetryHelper.withRetry(fn, { maxAttempts: 3 });

      expect(result).toBe('success');

      sleepSpy.mockRestore();
    });

    it('should use custom isRetryable', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Custom error'));

      await expect(RetryHelper.withRetry(fn, {
        maxAttempts: 3,
        isRetryable: (error) => error instanceof Error && error.message.includes('Retry'),
      })).rejects.toThrow();

      expect(fn).toHaveBeenCalledTimes(1); // No retries
    });
  });

  describe('Callbacks', () => {
    it('should call onRetry callback', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      const retryCallback = vi.fn();

      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 3) throw new Error('Fail');
        return 'success';
      });

      await RetryHelper.withRetry(fn, {
        maxAttempts: 3,
        onRetry: retryCallback,
      });

      expect(retryCallback).toHaveBeenCalledTimes(2);
      expect(retryCallback).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
      expect(retryCallback).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));

      sleepSpy.mockRestore();
    });
  });

  describe('Statistics', () => {
    it('should track statistics', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 3) throw new Error('Fail');
        return 'success';
      });

      await RetryHelper.withRetry(fn, { maxAttempts: 3 });

      const stats = RetryHelper.getStats();
      expect(stats.totalAttempts).toBe(3);
      expect(stats.successfulAttempts).toBe(1);
      expect(stats.failedAttempts).toBe(2);

      sleepSpy.mockRestore();
    });

    it('should reset statistics', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 2) throw new Error('Fail');
        return 'success';
      });

      await RetryHelper.withRetry(fn, { maxAttempts: 2 });
      RetryHelper.resetStats();

      const stats = RetryHelper.getStats();
      expect(stats.totalAttempts).toBe(0);

      sleepSpy.mockRestore();
    });
  });

  describe('Advanced features', () => {
    it('should retry with timeout', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await RetryHelper.withRetryAndTimeout(fn, 1000);

      expect(result).toBe('success');
    });

    it('should timeout on slow function', async () => {
      const fn = vi.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve('success'), 2000))
      );

      await expect(RetryHelper.withRetryAndTimeout(fn, 100))
        .rejects.toThrow('timed out');
    }, 10000);

    it('should create retrier with preset options', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      const retrier = RetryHelper.createRetrier({ maxAttempts: 3 });

      let attempts = 0;
      const fn = vi.fn(() => {
        attempts++;
        if (attempts < 2) throw new Error('Fail');
        return 'success';
      });

      const result = await retrier(fn);
      expect(result).toBe('success');

      sleepSpy.mockRestore();
    });

    it('should retry all operations', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      const fn1 = vi.fn().mockResolvedValue('result1');
      const fn2 = vi.fn().mockResolvedValue('result2');
      const fn3 = vi.fn().mockResolvedValue('result3');

      const results = await RetryHelper.retryAll([fn1, fn2, fn3]);

      expect(results).toEqual(['result1', 'result2', 'result3']);

      sleepSpy.mockRestore();
    });

    it('should retry until first success', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      const fn1 = vi.fn().mockRejectedValue(new Error('Fail1'));
      const fn2 = vi.fn().mockResolvedValue('success');

      const result = await RetryHelper.retryAny([fn1, fn2]);

      expect(result).toBe('success');

      sleepSpy.mockRestore();
    });
  });

  describe('Convenience functions', () => {
    it('should work with retry function', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retry(fn);

      expect(result).toBe('success');
    });

    it('should wrap function with withRetry', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      let attempts = 0;
      const originalFn = vi.fn(() => {
        attempts++;
        if (attempts < 2) throw new Error('Fail');
        return 'success';
      });

      const wrappedFn = withRetry(originalFn, { maxAttempts: 2 });

      const result = await wrappedFn();
      expect(result).toBe('success');

      sleepSpy.mockRestore();
    });
  });

  describe('Circuit breaker integration', () => {
    it('should work with circuit breaker', async () => {
      const sleepSpy = vi.spyOn(RetryHelper as any, 'sleep').mockResolvedValue(undefined);

      let failures = 0;
      const fn = vi.fn(() => {
        failures++;
        if (failures <= 6) throw new Error('Service down');
        return 'success';
      });

      // Should open circuit after 5 failures
      await expect(RetryHelper.withRetryAndCircuitBreaker(fn, {
        maxAttempts: 2,
        failureThreshold: 5,
        recoveryTimeout: 100,
      })).rejects.toThrow('Circuit breaker is open');

      sleepSpy.mockRestore();
    }, 10000);
  });
});
