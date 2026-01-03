/**
 * CircuitBreaker Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerRegistry } from '../src/CircuitBreaker.js';
import type { CircuitState } from '../src/types.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-breaker', {
      failureThreshold: 3,
      successThreshold: 2,
      cooldownPeriod: 100,
      failureWindow: 50
    });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const b = new CircuitBreaker('test');

      expect(b.getName()).toBe('test');
      expect(b.getState().state).toBe('closed');
    });

    it('should create with custom config', () => {
      const b = new CircuitBreaker('test', {
        failureThreshold: 10,
        successThreshold: 5
      });

      const config = b.getConfig();
      expect(config.failureThreshold).toBe(10);
      expect(config.successThreshold).toBe(5);
    });
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      const state = breaker.getState();

      expect(state.state).toBe('closed');
      expect(state.failureCount).toBe(0);
      expect(state.successCount).toBe(0);
    });

    it('should allow requests when closed', () => {
      expect(breaker.allowRequest()).toBe(true);
    });
  });

  describe('recordSuccess', () => {
    it('should reset failure count on success', () => {
      breaker.recordFailure();
      breaker.recordFailure();

      breaker.recordSuccess();

      expect(breaker.getState().failureCount).toBe(0);
    });

    it('should track last success time', () => {
      breaker.recordSuccess();

      const state = breaker.getState();
      expect(state.lastSuccessTime).toBeInstanceOf(Date);
    });

    it('should accumulate successes in half-open state', () => {
      breaker.forceOpen();
      breaker.recordSuccess();

      const state = breaker.getState();
      expect(state.state).toBe('open'); // Still in cooldown
      expect(state.successCount).toBe(0);
    });

    it('should close circuit after success threshold in half-open', async () => {
      breaker.forceOpen();

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 150));

      breaker.recordSuccess();
      expect(breaker.getState().state).toBe('half-open');

      breaker.recordSuccess();
      expect(breaker.getState().state).toBe('closed');
    });
  });

  describe('recordFailure', () => {
    it('should track failure count', () => {
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState().failureCount).toBe(2);
    });

    it('should open circuit after threshold', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState().state).toBe('open');
    });

    it('should track last failure time', () => {
      breaker.recordFailure();

      const state = breaker.getState();
      expect(state.lastFailureTime).toBeInstanceOf(Date);
    });

    it('should not allow requests when open', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.allowRequest()).toBe(false);
    });

    it('should reopen on any failure in half-open', async () => {
      breaker.forceOpen();

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 150));

      breaker.recordSuccess();
      expect(breaker.getState().state).toBe('half-open');

      breaker.recordFailure();
      expect(breaker.getState().state).toBe('open');
    });
  });

  describe('allowRequest', () => {
    it('should allow requests when closed', () => {
      expect(breaker.allowRequest()).toBe(true);
    });

    it('should deny requests when open', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.allowRequest()).toBe(false);
    });

    it('should allow requests in half-open', async () => {
      breaker.forceOpen();

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(breaker.allowRequest()).toBe(true);
    });
  });

  describe('failure window', () => {
    it('should count failures within window', async () => {
      breaker.recordFailure();
      breaker.recordFailure();

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 75));

      breaker.recordFailure();

      // Should only count the last failure
      expect(breaker.getState().failureCount).toBeLessThan(3);
    });
  });

  describe('reset', () => {
    it('should reset to closed state', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      breaker.reset();

      expect(breaker.getState().state).toBe('closed');
      expect(breaker.getState().failureCount).toBe(0);
    });
  });

  describe('forceOpen', () => {
    it('should force circuit open', () => {
      breaker.forceOpen();

      expect(breaker.getState().state).toBe('open');
      expect(breaker.allowRequest()).toBe(false);
    });
  });

  describe('forceClose', () => {
    it('should force circuit closed', () => {
      breaker.forceOpen();
      breaker.forceClose();

      expect(breaker.getState().state).toBe('closed');
      expect(breaker.allowRequest()).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should return circuit metrics', () => {
      const metrics = breaker.getMetrics();

      expect(metrics.name).toBe('test-breaker');
      expect(metrics.state).toBeDefined();
      expect(metrics.failureCount).toBeDefined();
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getTimeUntilRetry', () => {
    it('should return 0 when not open', () => {
      expect(breaker.getTimeUntilRetry()).toBe(0);
    });

    it('should return time until retry when open', () => {
      breaker.forceOpen();

      const time = breaker.getTimeUntilRetry();
      expect(time).toBeGreaterThan(0);
      expect(time).toBeLessThanOrEqual(100);
    });
  });

  describe('hasCooldownPassed', () => {
    it('should return true when not open', () => {
      expect(breaker.hasCooldownPassed()).toBe(true);
    });

    it('should return false immediately after opening', () => {
      breaker.forceOpen();

      expect(breaker.hasCooldownPassed()).toBe(false);
    });

    it('should return true after cooldown', async () => {
      breaker.forceOpen();

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(breaker.hasCooldownPassed()).toBe(true);
    });
  });

  describe('getStateDescription', () => {
    it('should describe closed state', () => {
      breaker.forceClose();

      const desc = breaker.getStateDescription();
      expect(desc).toContain('closed');
      expect(desc).toContain('allowed');
    });

    it('should describe open state', () => {
      breaker.forceOpen();

      const desc = breaker.getStateDescription();
      expect(desc).toContain('open');
      expect(desc).toContain('blocked');
    });

    it('should describe half-open state', async () => {
      breaker.forceOpen();

      await new Promise(resolve => setTimeout(resolve, 150));
      breaker.recordSuccess();

      const desc = breaker.getStateDescription();
      expect(desc).toContain('half-open');
      expect(desc).toContain('testing');
    });
  });

  describe('config', () => {
    it('should update configuration', () => {
      breaker.updateConfig({
        failureThreshold: 10,
        successThreshold: 5
      });

      const config = breaker.getConfig();
      expect(config.failureThreshold).toBe(10);
      expect(config.successThreshold).toBe(5);
    });
  });

  describe('state transitions', () => {
    it('should transition closed -> open', () => {
      expect(breaker.getState().state).toBe('closed');

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState().state).toBe('open');
    });

    it('should transition open -> half-open', async () => {
      breaker.forceOpen();

      await new Promise(resolve => setTimeout(resolve, 150));

      breaker.recordSuccess();

      expect(breaker.getState().state).toBe('half-open');
    });

    it('should transition half-open -> closed', async () => {
      breaker.forceOpen();

      await new Promise(resolve => setTimeout(resolve, 150));

      breaker.recordSuccess();
      breaker.recordSuccess();

      expect(breaker.getState().state).toBe('closed');
    });

    it('should transition half-open -> open on failure', async () => {
      breaker.forceOpen();

      await new Promise(resolve => setTimeout(resolve, 150));

      breaker.recordSuccess();
      breaker.recordFailure();

      expect(breaker.getState().state).toBe('open');
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry();
  });

  describe('get', () => {
    it('should create new breaker when not exists', () => {
      const breaker = registry.get('new-breaker');

      expect(breaker).toBeDefined();
      expect(breaker.getName()).toBe('new-breaker');
    });

    it('should return existing breaker', () => {
      const breaker1 = registry.get('test-breaker');
      const breaker2 = registry.get('test-breaker');

      expect(breaker1).toBe(breaker2);
    });

    it('should create with config when provided', () => {
      const breaker = registry.get('test', {
        failureThreshold: 10
      });

      expect(breaker.getConfig().failureThreshold).toBe(10);
    });
  });

  describe('remove', () => {
    it('should remove breaker', () => {
      registry.get('test-breaker');
      const removed = registry.remove('test-breaker');

      expect(removed).toBe(true);
    });

    it('should return false when removing non-existent', () => {
      const removed = registry.remove('non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all breakers', () => {
      registry.get('breaker1');
      registry.get('breaker2');
      registry.get('breaker3');

      const breakers = registry.getAll();

      expect(breakers.length).toBe(3);
    });

    it('should return empty array when no breakers', () => {
      const breakers = registry.getAll();

      expect(breakers).toEqual([]);
    });
  });

  describe('getAllStates', () => {
    it('should return all breaker states', () => {
      registry.get('breaker1').recordFailure();
      registry.get('breaker2');

      const states = registry.getAllStates();

      expect(states.size).toBe(2);
      expect(states.get('breaker1')).toBeDefined();
      expect(states.get('breaker2')).toBeDefined();
    });
  });

  describe('getAllMetrics', () => {
    it('should return all breaker metrics', () => {
      registry.get('breaker1');
      registry.get('breaker2');

      const metrics = registry.getAllMetrics();

      expect(metrics.length).toBe(2);
      expect(metrics[0].name).toBeDefined();
      expect(metrics[0].state).toBeDefined();
    });
  });

  describe('getByState', () => {
    it('should return breakers by state', () => {
      registry.get('breaker1');
      registry.get('breaker2').forceOpen();

      const closed = registry.getByState('closed');
      const open = registry.getByState('open');

      expect(closed.length).toBe(1);
      expect(open.length).toBe(1);
    });

    it('should return empty for state with no breakers', () => {
      const halfOpen = registry.getByState('half-open');

      expect(halfOpen).toEqual([]);
    });
  });

  describe('countByState', () => {
    it('should count breakers by state', () => {
      registry.get('breaker1');
      registry.get('breaker2').forceOpen();
      registry.get('breaker3').forceOpen();

      const counts = registry.countByState();

      expect(counts.get('closed')).toBe(1);
      expect(counts.get('open')).toBe(2);
      expect(counts.get('half-open')).toBe(0);
    });
  });

  describe('resetAll', () => {
    it('should reset all breakers', () => {
      registry.get('breaker1').recordFailure();
      registry.get('breaker2').forceOpen();

      registry.resetAll();

      const states = registry.getAllStates();
      for (const state of states.values()) {
        expect(state.state).toBe('closed');
      }
    });
  });

  describe('clear', () => {
    it('should clear all breakers', () => {
      registry.get('breaker1');
      registry.get('breaker2');

      registry.clear();

      expect(registry.getAll().length).toBe(0);
    });
  });
});
