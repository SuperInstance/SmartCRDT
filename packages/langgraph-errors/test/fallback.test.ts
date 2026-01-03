/**
 * @file fallback.test.ts - Tests for fallback manager
 * @package @lsi/langgraph-errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FallbackManager } from '../src/fallback.js';
import type { FallbackConfig, AgentError, ErrorPolicy } from '../src/types.js';

describe('FallbackManager', () => {
  let fallbackManager: FallbackManager;
  let mockError: AgentError;

  beforeEach(() => {
    fallbackManager = new FallbackManager();
    mockError = {
      error_id: 'err_test',
      agent_id: 'primary-agent',
      severity: 'error',
      category: 'execution',
      message: 'Test error',
      context: {},
      timestamp: Date.now(),
     
      retry_count: 0,
    };
  });

  describe('fallback', () => {
    it('should use fallback handler', async () => {
      const handler = vi.fn().mockResolvedValue('fallback-result');
      fallbackManager.registerFallbackHandler('fallback-1', handler);

      const policy: ErrorPolicy = {
        max_retries: 0,
        timeout: 1000,
        retryable: false,
        fallback_agent: 'fallback-1',
      };

      const result = await fallbackManager.fallback(mockError, policy);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('fallback');
      expect(result.result).toBe('fallback-result');
    });

    it('should try fallback chain in order', async () => {
      const handler1 = vi.fn().mockRejectedValue(new Error('fail'));
      const handler2 = vi.fn().mockResolvedValue('result-2');
      const handler3 = vi.fn().mockResolvedValue('result-3');

      fallbackManager.registerFallbackHandler('fallback-1', handler1);
      fallbackManager.registerFallbackHandler('fallback-2', handler2);
      fallbackManager.registerFallbackHandler('fallback-3', handler3);

      const policy: ErrorPolicy = {
        max_retries: 0,
        timeout: 1000,
        retryable: false,
      };

      // Manually set up fallback chain
      (fallbackManager as any).buildConfig = () => ({
        fallback_chain: ['fallback-1', 'fallback-2', 'fallback-3'],
        use_cache: false,
        validate_result: undefined,
      });

      const result = await fallbackManager.fallback(mockError, policy);

      expect(result.success).toBe(true);
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should use default result if no fallback works', async () => {
      const policy: ErrorPolicy = {
        max_retries: 0,
        timeout: 1000,
        retryable: false,
      };

      (fallbackManager as any).buildConfig = () => ({
        fallback_chain: [],
        default_result: 'default-value',
        use_cache: false,
      });

      const result = await fallbackManager.fallback(mockError, policy);

      expect(result.success).toBe(true);
      expect(result.result).toBe('default-value');
    });

    it('should fail if no fallback available', async () => {
      const policy: ErrorPolicy = {
        max_retries: 0,
        timeout: 1000,
        retryable: false,
      };

      (fallbackManager as any).buildConfig = () => ({
        fallback_chain: [],
        use_cache: false,
      });

      const result = await fallbackManager.fallback(mockError, policy);

      expect(result.success).toBe(false);
    });

    it('should use cached result', async () => {
      const cacheKey = (fallbackManager as any).getCacheKey(mockError);
      fallbackManager.cacheResult(cacheKey, 'cached-result', 60000);

      (fallbackManager as any).buildConfig = () => ({
        fallback_chain: [],
        use_cache: true,
      });

      const result = await fallbackManager.fallback(mockError, {});

      expect(result.success).toBe(true);
      expect(result.result).toBe('cached-result');
    });

    it('should validate fallback result', async () => {
      const handler = vi.fn().mockResolvedValue('invalid-result');
      fallbackManager.registerFallbackHandler('fallback-1', handler);

      const policy: ErrorPolicy = {
        max_retries: 0,
        timeout: 1000,
        retryable: false,
        fallback_agent: 'fallback-1',
      };

      (fallbackManager as any).buildConfig = () => ({
        fallback_chain: ['fallback-1'],
        use_cache: false,
        validate_result: (result: unknown) => result === 'valid-result',
      });

      const result = await fallbackManager.fallback(mockError, policy);

      expect(result.success).toBe(false);
    });
  });

  describe('registerFallbackHandler', () => {
    it('should register fallback handler', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      fallbackManager.registerFallbackHandler('agent-1', handler);

      const policy: ErrorPolicy = {
        max_retries: 0,
        timeout: 1000,
        retryable: false,
        fallback_agent: 'agent-1',
      };

      const result = await fallbackManager.fallback(mockError, policy);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith(mockError);
    });
  });

  describe('unregisterFallbackHandler', () => {
    it('should unregister fallback handler', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      fallbackManager.registerFallbackHandler('agent-1', handler);
      fallbackManager.unregisterFallbackHandler('agent-1');

      const policy: ErrorPolicy = {
        max_retries: 0,
        timeout: 1000,
        retryable: false,
        fallback_agent: 'agent-1',
      };

      const result = await fallbackManager.fallback(mockError, policy);

      expect(result.success).toBe(false);
    });
  });

  describe('cacheResult', () => {
    it('should cache result', () => {
      fallbackManager.cacheResult('key-1', 'result-1', 1000);

      const result = fallbackManager.getCachedResult('key-1');

      expect(result).toBe('result-1');
    });

    it('should respect cache TTL', () => {
      vi.useFakeTimers();

      fallbackManager.cacheResult('key-1', 'result-1', 1000);

      vi.advanceTimersByTime(1500);

      const result = fallbackManager.getCachedResult('key-1');

      expect(result).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('getCachedResult', () => {
    it('should return undefined for non-existent key', () => {
      const result = fallbackManager.getCachedResult('non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should clear specific cache entry', () => {
      fallbackManager.cacheResult('key-1', 'result-1', 1000);
      fallbackManager.clearCache('key-1');

      const result = fallbackManager.getCachedResult('key-1');

      expect(result).toBeUndefined();
    });

    it('should clear all cache', () => {
      fallbackManager.cacheResult('key-1', 'result-1', 1000);
      fallbackManager.cacheResult('key-2', 'result-2', 1000);
      fallbackManager.clearCache();

      expect(fallbackManager.getCachedResult('key-1')).toBeUndefined();
      expect(fallbackManager.getCachedResult('key-2')).toBeUndefined();
    });
  });

  describe('cleanCache', () => {
    it('should remove expired cache entries', () => {
      vi.useFakeTimers();

      fallbackManager.cacheResult('key-1', 'result-1', 1000);
      fallbackManager.cacheResult('key-2', 'result-2', 5000);

      vi.advanceTimersByTime(1500);

      fallbackManager.cleanCache();

      expect(fallbackManager.getCachedResult('key-1')).toBeUndefined();
      expect(fallbackManager.getCachedResult('key-2')).toBe('result-2');

      vi.useRealTimers();
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      fallbackManager.cacheResult('key-1', 'result-1', 1000);
      fallbackManager.cacheResult('key-2', 'result-2', 1000);

      const stats = fallbackManager.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key-1');
      expect(stats.keys).toContain('key-2');
    });
  });

  describe('createFallbackChain', () => {
    it('should create fallback chain', () => {
      const chain = fallbackManager.createFallbackChain('agent-1', 'agent-2', 'agent-3');

      expect(chain).toEqual(['agent-1', 'agent-2', 'agent-3']);
    });
  });

  describe('validateResult', () => {
    it('should validate non-null results', () => {
      expect(FallbackManager.validateResult('value')).toBe(true);
      expect(FallbackManager.validateResult(0)).toBe(true);
      expect(FallbackManager.validateResult(false)).toBe(true);
      expect(FallbackManager.validateResult(null)).toBe(false);
      expect(FallbackManager.validateResult(undefined)).toBe(false);
    });
  });
});
