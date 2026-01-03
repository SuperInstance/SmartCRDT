/**
 * @file ErrorHandler.test.ts - Tests for ErrorHandler
 * @package @lsi/langgraph-errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler } from '../src/ErrorHandler.js';
import type { ErrorPolicy, ErrorContext, AgentError } from '../src/types.js';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('Construction', () => {
    it('should create instance with default options', () => {
      expect(errorHandler).toBeInstanceOf(ErrorHandler);
    });

    it('should create instance with custom options', () => {
      const customHandler = new ErrorHandler({
        enable_logging: false,
        enable_analytics: false,
      });
      expect(customHandler).toBeInstanceOf(ErrorHandler);
    });
  });

  describe('handleError', () => {
    it('should handle basic error', async () => {
      const error = new Error('Test error');
      const result = await errorHandler.handleError(error, 'test-agent');

      expect(result).toBeDefined();
      expect(result.strategy).toBeDefined();
    });

    it('should handle error with context', async () => {
      const error = new Error('Test error');
      const context: ErrorContext = {
        agent_state: { key: 'value' },
        request: { method: 'test' },
      };

      const result = await errorHandler.handleError(error, 'test-agent', context);

      expect(result).toBeDefined();
    });

    it('should handle error with custom policy', async () => {
      const error = new Error('Test error');
      const policy: ErrorPolicy = {
        max_retries: 5,
        timeout: 60000,
       
        recovery_strategy: 'retry',
      };

      const result = await errorHandler.handleError(error, 'test-agent', undefined, policy);

      expect(result).toBeDefined();
    });

    it('should classify timeout errors correctly', async () => {
      const error = new Error('Operation timed out');
      const result = await errorHandler.handleError(error, 'test-agent');

      expect(result).toBeDefined();
      const history = errorHandler.getErrorHistory('test-agent');
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].category).toBe('timeout');
    });

    it('should classify network errors correctly', async () => {
      const error = new Error('ECONNREFUSED');
      const result = await errorHandler.handleError(error, 'test-agent');

      expect(result).toBeDefined();
      const history = errorHandler.getErrorHistory('test-agent');
      expect(history[0].category).toBe('network');
    });

    it('should classify validation errors correctly', async () => {
      const error = new Error('Validation failed: invalid input');
      const result = await errorHandler.handleError(error, 'test-agent');

      expect(result).toBeDefined();
      const history = errorHandler.getErrorHistory('test-agent');
      expect(history[0].category).toBe('validation');
    });

    it('should classify authentication errors correctly', async () => {
      const error = new Error('Unauthorized: 401');
      const result = await errorHandler.handleError(error, 'test-agent');

      expect(result).toBeDefined();
      const history = errorHandler.getErrorHistory('test-agent');
      expect(history[0].category).toBe('authentication');
    });

    it('should classify authorization errors correctly', async () => {
      const error = new Error('Forbidden: 403');
      const result = await errorHandler.handleError(error, 'test-agent');

      expect(result).toBeDefined();
      const history = errorHandler.getErrorHistory('test-agent');
      expect(history[0].category).toBe('authorization');
    });
  });

  describe('Error History', () => {
    it('should track error history for agent', async () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      await errorHandler.handleError(error1, 'agent-1');
      await errorHandler.handleError(error2, 'agent-1');

      const history = errorHandler.getErrorHistory('agent-1');
      expect(history).toHaveLength(2);
    });

    it('should track error history separately for different agents', async () => {
      await errorHandler.handleError(new Error('Error 1'), 'agent-1');
      await errorHandler.handleError(new Error('Error 2'), 'agent-2');

      const history1 = errorHandler.getErrorHistory('agent-1');
      const history2 = errorHandler.getErrorHistory('agent-2');

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
    });

    it('should return empty array for agent with no errors', () => {
      const history = errorHandler.getErrorHistory('non-existent-agent');
      expect(history).toEqual([]);
    });

    it('should clear error history for specific agent', async () => {
      await errorHandler.handleError(new Error('Error 1'), 'agent-1');
      errorHandler.clearErrorHistory('agent-1');

      const history = errorHandler.getErrorHistory('agent-1');
      expect(history).toEqual([]);
    });

    it('should clear all error history', async () => {
      await errorHandler.handleError(new Error('Error 1'), 'agent-1');
      await errorHandler.handleError(new Error('Error 2'), 'agent-2');
      errorHandler.clearErrorHistory();

      expect(errorHandler.getErrorHistory('agent-1')).toEqual([]);
      expect(errorHandler.getErrorHistory('agent-2')).toEqual([]);
    });
  });

  describe('Active Errors', () => {
    it('should track active errors', async () => {
      const error = new Error('Test error');
      const result = await errorHandler.handleError(error, 'test-agent');

      if (result.error) {
        const activeError = errorHandler.getActiveError(result.error.error_id);
        expect(activeError).toBeDefined();
        expect(activeError?.agent_id).toBe('test-agent');
      }
    });
  });

  describe('Statistics', () => {
    it('should return error statistics', async () => {
      await errorHandler.handleError(new Error('Error 1'), 'agent-1');
      await errorHandler.handleError(new Error('Error 2'), 'agent-2');

      const stats = errorHandler.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.total_errors).toBeGreaterThan(0);
    });
  });

  describe('Managers', () => {
    it('should provide access to retry manager', () => {
      const retryManager = errorHandler.getRetryManager();
      expect(retryManager).toBeDefined();
    });

    it('should provide access to fallback manager', () => {
      const fallbackManager = errorHandler.getFallbackManager();
      expect(fallbackManager).toBeDefined();
    });

    it('should provide access to circuit breaker manager', () => {
      const circuitBreakerManager = errorHandler.getCircuitBreakerManager();
      expect(circuitBreakerManager).toBeDefined();
    });

    it('should provide access to timeout manager', () => {
      const timeoutManager = errorHandler.getTimeoutManager();
      expect(timeoutManager).toBeDefined();
    });

    it('should provide access to dead letter queue', () => {
      const deadLetterQueue = errorHandler.getDeadLetterQueue();
      expect(deadLetterQueue).toBeDefined();
    });

    it('should provide access to analytics', () => {
      const analytics = errorHandler.getAnalytics();
      expect(analytics).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await errorHandler.handleError(new Error('Test'), 'agent-1');
      await errorHandler.shutdown();

      expect(errorHandler.getErrorHistory('agent-1')).toEqual([]);
    });
  });
});
