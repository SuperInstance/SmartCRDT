/**
 * ReconnectPolicy Tests
 * Tests for reconnection decision logic and policy evaluation
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ReconnectPolicy,
  createReconnectPolicy,
  createReconnectPolicyFromConfig
} from '../src/ReconnectPolicy.js';
import type { DisconnectReason, ReconnectConfig } from '../src/types.js';

describe('ReconnectPolicy', () => {
  describe('Construction', () => {
    it('should create with default config', () => {
      const policy = new ReconnectPolicy();

      expect(policy).toBeDefined();
      expect(policy.getAttemptCount()).toBe(0);
    });

    it('should create with factory function', () => {
      const policy = createReconnectPolicy();

      expect(policy).toBeDefined();
    });

    it('should create with custom config', () => {
      const policy = new ReconnectPolicy({
        maxRetries: 5,
        initialDelay: 500
      });

      const config = policy.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.initialDelay).toBe(500);
    });

    it('should create from ReconnectConfig', () => {
      const config: ReconnectConfig = {
        maxRetries: 15,
        initialDelay: 2000,
        maxDelay: 60000,
        jitterFactor: 0.2,
        backoffStrategy: 'exponential',
        enableEventBuffer: true,
        maxBufferSize: 2048,
        healthCheckInterval: 30000,
        connectionTimeout: 10000,
        reconnectOnServerClose: true,
        reconnectOnNetworkLoss: true,
        reconnectOnError: true
      };

      const policy = createReconnectPolicyFromConfig(config);

      expect(policy.getConfig().maxRetries).toBe(15);
      expect(policy.getConfig().initialDelay).toBe(2000);
    });
  });

  describe('Should Reconnect', () => {
    it('should return true for valid first attempt', () => {
      const policy = new ReconnectPolicy({ maxRetries: 10 });

      expect(policy.shouldReconnect('error', 1)).toBe(true);
    });

    it('should return true within max retries', () => {
      const policy = new ReconnectPolicy({ maxRetries: 5 });

      expect(policy.shouldReconnect('timeout', 3)).toBe(true);
      expect(policy.shouldReconnect('error', 5)).toBe(true);
    });

    it('should return false after max retries', () => {
      const policy = new ReconnectPolicy({ maxRetries: 5 });

      expect(policy.shouldReconnect('error', 6)).toBe(false);
      expect(policy.shouldReconnect('timeout', 10)).toBe(false);
    });

    it('should return true for infinite retries (maxRetries = 0)', () => {
      const policy = new ReconnectPolicy({ maxRetries: 0 });

      expect(policy.shouldReconnect('error', 1)).toBe(true);
      expect(policy.shouldReconnect('error', 100)).toBe(true);
      expect(policy.shouldReconnect('error', 1000)).toBe(true);
    });

    it('should respect reconnectOnServerClose setting', () => {
      const policy = new ReconnectPolicy({
        reconnectOnServerClose: false
      });

      expect(policy.shouldReconnect('server-close', 1)).toBe(false);
    });

    it('should respect reconnectOnNetworkLoss setting', () => {
      const policy = new ReconnectPolicy({
        reconnectOnNetworkLoss: false
      });

      expect(policy.shouldReconnect('network-loss', 1)).toBe(false);
    });

    it('should respect reconnectOnError setting', () => {
      const policy = new ReconnectPolicy({
        reconnectOnError: false
      });

      expect(policy.shouldReconnect('error', 1)).toBe(false);
    });

    it('should allow manual reconnect', () => {
      const policy = new ReconnectPolicy();

      // Manual should always be in reconnectOnReasons by default
      expect(policy.shouldReconnect('manual', 1)).toBe(true);
    });
  });

  describe('Reconnect Decision', () => {
    it('should return positive decision when reconnecting', () => {
      const policy = new ReconnectPolicy({
        maxRetries: 10,
        initialDelay: 1000
      });

      const decision = policy.getReconnectDecision('error', 1, 0);

      expect(decision.shouldReconnect).toBe(true);
      expect(decision.delay).toBeGreaterThan(0);
      expect(decision.reason).toBeDefined();
    });

    it('should return negative decision when not reconnecting', () => {
      const policy = new ReconnectPolicy({ maxRetries: 5 });

      const decision = policy.getReconnectDecision('error', 10, 0);

      expect(decision.shouldReconnect).toBe(false);
      expect(decision.delay).toBe(0);
      expect(decision.reason).toContain('Max retries');
    });

    it('should calculate correct delay', () => {
      const policy = new ReconnectPolicy({
        initialDelay: 1000,
        backoffStrategy: 'fixed'
      });

      const decision = policy.getReconnectDecision('error', 1, 0);

      expect(decision.delay).toBe(1000);
    });
  });

  describe('Retry Delay', () => {
    it('should calculate fixed delay', () => {
      const policy = new ReconnectPolicy({
        initialDelay: 1000,
        backoffStrategy: 'fixed'
      });

      expect(policy.getRetryDelay(1)).toBe(1000);
      expect(policy.getRetryDelay(5)).toBe(1000);
    });

    it('should calculate linear delay', () => {
      const policy = new ReconnectPolicy({
        initialDelay: 1000,
        backoffStrategy: 'linear'
      });

      expect(policy.getRetryDelay(1)).toBe(1000);
      expect(policy.getRetryDelay(2)).toBe(2000);
      expect(policy.getRetryDelay(5)).toBe(5000);
    });

    it('should calculate exponential delay', () => {
      const policy = new ReconnectPolicy({
        initialDelay: 1000,
        backoffStrategy: 'exponential'
      });

      expect(policy.getRetryDelay(1)).toBe(1000);
      expect(policy.getRetryDelay(2)).toBe(2000);
      expect(policy.getRetryDelay(3)).toBe(4000);
    });
  });

  describe('Attempt Tracking', () => {
    it('should record attempts', () => {
      const policy = new ReconnectPolicy();

      policy.recordAttempt();
      policy.recordAttempt();
      policy.recordAttempt();

      expect(policy.getAttemptCount()).toBe(3);
    });

    it('should reset on success', () => {
      const policy = new ReconnectPolicy();

      policy.recordAttempt();
      policy.recordAttempt();
      policy.recordSuccess(2);

      expect(policy.getAttemptCount()).toBe(0);
    });

    it('should track reconnect time', () => {
      const policy = new ReconnectPolicy();

      policy.recordAttempt();

      const time1 = policy.getTotalReconnectTime();

      expect(time1).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Max Retries Callback', () => {
    it('should call max retries callback', () => {
      const callback = vi.fn();

      const policy = new ReconnectPolicy({ maxRetries: 3 });

      policy.setMaxRetriesCallback(callback);
      policy.recordAttempt();
      policy.recordAttempt();
      policy.recordAttempt();
      policy.onMaxRetriesReached('error');

      expect(callback).toHaveBeenCalledWith(3, 'error');
    });

    it('should reset after max retries callback', () => {
      const callback = vi.fn();

      const policy = new ReconnectPolicy({ maxRetries: 3 });

      policy.setMaxRetriesCallback(callback);
      policy.recordAttempt();
      policy.recordAttempt();
      policy.onMaxRetriesReached('error');

      expect(policy.getAttemptCount()).toBe(0);
    });
  });

  describe('Success Callback', () => {
    it('should call success callback', () => {
      const callback = vi.fn();

      const policy = new ReconnectPolicy();

      policy.setReconnectSuccessCallback(callback);
      policy.recordAttempt();
      policy.recordAttempt();
      policy.recordSuccess(2);

      expect(callback).toHaveBeenCalledWith(2, expect.any(Number));
    });
  });

  describe('Configuration Updates', () => {
    it('should update max retries', () => {
      const policy = new ReconnectPolicy({ maxRetries: 5 });

      policy.updateConfig({ maxRetries: 10 });

      expect(policy.getConfig().maxRetries).toBe(10);
    });

    it('should update initial delay', () => {
      const policy = new ReconnectPolicy({ initialDelay: 1000 });

      policy.updateConfig({ initialDelay: 500 });

      expect(policy.getConfig().initialDelay).toBe(500);
    });

    it('should use updated config for decisions', () => {
      const policy = new ReconnectPolicy({
        maxRetries: 5,
        initialDelay: 1000
      });

      policy.updateConfig({ maxRetries: 2 });

      expect(policy.shouldReconnect('error', 3)).toBe(false);
    });
  });

  describe('Success Probability Estimation', () => {
    it('should return 1.0 for first attempt', () => {
      const policy = new ReconnectPolicy();

      expect(policy.estimateSuccessProbability()).toBe(1.0);
    });

    it('should decrease probability with attempts', () => {
      const policy = new ReconnectPolicy({ maxRetries: 10 });

      policy.recordAttempt();
      policy.recordAttempt();
      policy.recordAttempt();

      const prob = policy.estimateSuccessProbability();

      expect(prob).toBeGreaterThan(0);
      expect(prob).toBeLessThan(1);
    });

    it('should approach zero as attempts increase', () => {
      const policy = new ReconnectPolicy({ maxRetries: 10 });

      for (let i = 0; i < 9; i++) {
        policy.recordAttempt();
      }

      const prob = policy.estimateSuccessProbability();

      expect(prob).toBeLessThan(0.2);
    });

    it('should handle infinite retries', () => {
      const policy = new ReconnectPolicy({ maxRetries: 0 });

      for (let i = 0; i < 10; i++) {
        policy.recordAttempt();
      }

      const prob = policy.estimateSuccessProbability();

      expect(prob).toBeGreaterThan(0);
    });
  });

  describe('Reset', () => {
    it('should reset policy state', () => {
      const policy = new ReconnectPolicy();

      policy.recordAttempt();
      policy.recordAttempt();

      policy.reset();

      expect(policy.getAttemptCount()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max retries', () => {
      const policy = new ReconnectPolicy({ maxRetries: 0 });

      expect(policy.shouldReconnect('error', 1)).toBe(true);
      expect(policy.shouldReconnect('error', 1000)).toBe(true);
    });

    it('should handle very large max retries', () => {
      const policy = new ReconnectPolicy({ maxRetries: 1000000 });

      expect(policy.shouldReconnect('error', 1000)).toBe(true);
    });

    it('should handle zero initial delay', () => {
      const policy = new ReconnectPolicy({
        initialDelay: 0,
        backoffStrategy: 'fixed'
      });

      expect(policy.getRetryDelay(1)).toBe(0);
    });

    it('should handle max reconnect time limit', async () => {
      const policy = new ReconnectPolicy({
        maxReconnectTime: 100
      });

      policy.recordAttempt();

      // Wait for time limit to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(policy.shouldReconnect('error', 2)).toBe(false);
    });
  });
});
