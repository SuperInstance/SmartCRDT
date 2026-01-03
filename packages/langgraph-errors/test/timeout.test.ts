/**
 * @file timeout.test.ts - Tests for timeout manager
 * @package @lsi/langgraph-errors
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TimeoutManager, TimeoutError } from '../src/timeout.js';

describe('TimeoutManager', () => {
  let timeoutManager: TimeoutManager;

  beforeEach(() => {
    timeoutManager = new TimeoutManager({
      global_timeout: 1000,
      escalate_on_timeout: true,
      escalation_timeout: 2000,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('executeWithTimeout', () => {
    it('should execute operation successfully within timeout', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const promise = timeoutManager.executeWithTimeout('agent-1', operation, 1000);
      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should timeout if operation takes too long', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 2000))
      );

      const promise = timeoutManager.executeWithTimeout('agent-1', operation, 1000);

      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toThrow(TimeoutError);
      await expect(promise).rejects.toThrow('timed out');
    });

    it('should use custom timeout', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 500))
      );

      const promise = timeoutManager.executeWithTimeout('agent-1', operation, 2000);

      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result).toBe('success');
    });
  });

  describe('executeWithGlobalTimeout', () => {
    it('should use global timeout', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 500))
      );

      const promise = timeoutManager.executeWithGlobalTimeout(operation);

      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should timeout with global timeout', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 2000))
      );

      const promise = timeoutManager.executeWithGlobalTimeout(operation);

      await vi.advanceTimersByTimeAsync(1000);

      await expect(promise).rejects.toThrow(TimeoutError);
    });
  });

  describe('executeWithEscalation', () => {
    it('should escalate on timeout', async () => {
      const operation = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('success'), 2000))
      );

      const escalationHandler = vi.fn().mockResolvedValue('escalated');

      const promise = timeoutManager.executeWithEscalation(
        'agent-1',
        operation,
        escalationHandler,
        1000
      );

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;

      expect(escalationHandler).toHaveBeenCalled();
      expect(result).toBe('escalated');
    });

    it('should not escalate if operation succeeds', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const escalationHandler = vi.fn().mockResolvedValue('escalated');

      const promise = timeoutManager.executeWithEscalation(
        'agent-1',
        operation,
        escalationHandler,
        1000
      );

      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;

      expect(result).toBe('success');
      expect(escalationHandler).not.toHaveBeenCalled();
    });
  });

  describe('executeAllWithTimeouts', () => {
    it('should execute all operations with individual timeouts', async () => {
      const operations = [
        { agentId: 'agent-1', operation: vi.fn().mockResolvedValue('result1'), timeout: 500 },
        { agentId: 'agent-2', operation: vi.fn().mockResolvedValue('result2'), timeout: 500 },
        { agentId: 'agent-3', operation: vi.fn().mockResolvedValue('result3'), timeout: 500 },
      ];

      const promise = timeoutManager.executeAllWithTimeouts(operations);
      await vi.advanceTimersByTimeAsync(500);

      const results = await promise;

      expect(results).toHaveLength(3);
      expect(results[0].result).toBe('result1');
      expect(results[1].result).toBe('result2');
      expect(results[2].result).toBe('result3');
    });

    it('should handle partial failures', async () => {
      const operations = [
        {
          agentId: 'agent-1',
          operation: vi.fn().mockResolvedValue('result1'),
          timeout: 500,
        },
        {
          agentId: 'agent-2',
          operation: vi.fn().mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve('result2'), 2000))
          ),
          timeout: 500,
        },
      ];

      const promise = timeoutManager.executeAllWithTimeouts(operations);
      await vi.advanceTimersByTimeAsync(500);

      const results = await promise;

      expect(results).toHaveLength(2);
      expect(results[0].result).toBe('result1');
      expect(results[1].error).toBeInstanceOf(TimeoutError);
    });
  });

  describe('raceWithTimeouts', () => {
    it('should return fastest operation', async () => {
      const operations = [
        {
          agentId: 'agent-1',
          operation: () => new Promise((resolve) => setTimeout(() => resolve('slow'), 500)),
          timeout: 1000,
        },
        {
          agentId: 'agent-2',
          operation: () => new Promise((resolve) => setTimeout(() => resolve('fast'), 100)),
          timeout: 1000,
        },
      ];

      const promise = timeoutManager.raceWithTimeouts(operations);
      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;

      expect(result.agentId).toBe('agent-2');
      expect(result.result).toBe('fast');
    });
  });

  describe('Configuration', () => {
    it('should set timeout for agent', () => {
      timeoutManager.setTimeoutForAgent('agent-1', 5000);
      const stats = timeoutManager.getStatistics();

      expect(stats.agentTimeouts['agent-1']).toBe(5000);
    });

    it('should set global timeout', () => {
      timeoutManager.setGlobalTimeout(5000);
      const stats = timeoutManager.getStatistics();

      expect(stats.globalTimeout).toBe(5000);
    });

    it('should set escalation timeout', () => {
      timeoutManager.setEscalationTimeout(5000);
      const stats = timeoutManager.getStatistics();

      expect(stats.escalationTimeout).toBe(5000);
    });

    it('should enable/disable escalation', () => {
      timeoutManager.setEscalationOnTimeout(false);
      const stats = timeoutManager.getStatistics();

      expect(stats.escalateOnTimeout).toBe(false);
    });
  });

  describe('getStatistics', () => {
    it('should return timeout statistics', () => {
      const stats = timeoutManager.getStatistics();

      expect(stats.globalTimeout).toBeDefined();
      expect(stats.agentTimeouts).toBeDefined();
      expect(stats.escalateOnTimeout).toBeDefined();
      expect(stats.escalationTimeout).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset configuration', () => {
      timeoutManager.setTimeoutForAgent('agent-1', 5000);
      timeoutManager.setGlobalTimeout(10000);

      timeoutManager.reset();

      const stats = timeoutManager.getStatistics();
      expect(stats.globalTimeout).toBe(30000);
      expect(Object.keys(stats.agentTimeouts)).toHaveLength(0);
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error with details', () => {
      const error = new TimeoutError('Test timeout', 'agent-1', 5000);

      expect(error.message).toBe('Test timeout');
      expect(error.agentId).toBe('agent-1');
      expect(error.timeout).toBe(5000);
      expect(error.name).toBe('TimeoutError');
    });
  });

  describe('createTimeoutPromise', () => {
    it('should create timeout promise', async () => {
      vi.useRealTimers();

      await expect(
        TimeoutManager.createTimeoutPromise(100, 'Custom timeout message')
      ).rejects.toThrow('Custom timeout message');
    });
  });

  describe('withTimeout', () => {
    it('should wrap function with timeout', async () => {
      vi.useRealTimers();

      const fn = () => Promise.resolve('success');
      const result = await TimeoutManager.withTimeout(fn, 1000);

      expect(result).toBe('success');
    });

    it('should timeout wrapped function', async () => {
      vi.useRealTimers();

      const fn = () => new Promise((resolve) => setTimeout(() => resolve('success'), 2000));

      await expect(TimeoutManager.withTimeout(fn, 100)).rejects.toThrow();
    });
  });
});
