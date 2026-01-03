/**
 * @file retry.test.ts - Tests for retry manager
 * @package @lsi/langgraph-errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryManager } from '../src/retry.js';
import type { RetryConfig, AgentError, ErrorPolicy } from '../src/types.js';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('retryWithFixedDelay', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await retryManager.retryWithFixedDelay(operation, 3, 1000);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = retryManager.retryWithFixedDelay(operation, 3, 100);

      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should exhaust retries and throw', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      await expect(
        retryManager.retryWithFixedDelay(operation, 3, 100)
      ).rejects.toThrow('fail');

      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('retryWithExponentialBackoff', () => {
    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      global.setTimeout = vi.fn((fn, delay) => {
        delays.push(delay as number);
        return originalSetTimeout(fn, delay);
      }) as unknown as typeof setTimeout;

      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = retryManager.retryWithExponentialBackoff(operation, 4, 100, 1000);

      // Advance timers for each retry
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      const result = await promise;

      expect(result).toBe('success');
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);

      global.setTimeout = originalSetTimeout;
    });
  });

  describe('retryWithLinearBackoff', () => {
    it('should use linear backoff', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = retryManager.retryWithLinearBackoff(operation, 4, 100);

      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(100);
      }

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('retryWithJitter', () => {
    it('should add jitter to delays', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = retryManager.retryWithJitter(operation, 3, 100, 0.5);

      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryIf', () => {
    it('should retry only if condition matches', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('retryable error'))
        .mockRejectedValueOnce(new Error('non-retryable error'))
        .mockResolvedValue('success');

      const condition = (error: Error) => error.message.includes('retryable');

      await expect(
        retryManager.retryIf(operation, condition, 5)
      ).rejects.toThrow('non-retryable');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry until condition fails', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('retryable error'))
        .mockRejectedValueOnce(new Error('retryable error'))
        .mockResolvedValue('success');

      const condition = (error: Error) => error.message.includes('retryable');

      const promise = retryManager.retryIf(operation, condition, 5);

      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate fixed delay correctly', () => {
      const config: RetryConfig = {
        max_attempts: 3,
        initial_delay: 1000,
        strategy: 'fixed',
      };

      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = (retryManager as any).calculateDelay(attempt, config);
        expect(delay).toBe(1000);
      }
    });

    it('should calculate exponential delay correctly', () => {
      const config: RetryConfig = {
        max_attempts: 3,
        initial_delay: 1000,
        backoff_multiplier: 2,
        strategy: 'exponential',
      };

      const delay0 = (retryManager as any).calculateDelay(0, config);
      const delay1 = (retryManager as any).calculateDelay(1, config);
      const delay2 = (retryManager as any).calculateDelay(2, config);

      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(4000);
    });

    it('should calculate linear delay correctly', () => {
      const config: RetryConfig = {
        max_attempts: 3,
        initial_delay: 1000,
        strategy: 'linear',
      };

      const delay0 = (retryManager as any).calculateDelay(0, config);
      const delay1 = (retryManager as any).calculateDelay(1, config);
      const delay2 = (retryManager as any).calculateDelay(2, config);

      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(3000);
    });

    it('should respect max delay', () => {
      const config: RetryConfig = {
        max_attempts: 3,
        initial_delay: 1000,
        max_delay: 2500,
        backoff_multiplier: 2,
        strategy: 'exponential',
      };

      const delay2 = (retryManager as any).calculateDelay(2, config);

      expect(delay2).toBe(2500); // Capped at max_delay
    });
  });

  describe('Config Management', () => {
    it('should return default config', () => {
      const config = retryManager.getDefaultConfig();

      expect(config.max_attempts).toBeDefined();
      expect(config.initial_delay).toBeDefined();
      expect(config.strategy).toBeDefined();
    });

    it('should create custom config', () => {
      const overrides = {
        max_attempts: 5,
        initial_delay: 2000,
      };

      const config = retryManager.createConfig(overrides);

      expect(config.max_attempts).toBe(5);
      expect(config.initial_delay).toBe(2000);
    });
  });
});
