/**
 * BackoffCalculator Tests
 * Tests for all backoff strategies and calculations
 */

import { describe, it, expect } from 'vitest';
import { BackoffCalculator, createBackoffCalculator } from '../src/BackoffCalculator.js';
import type { BackoffStrategy, ReconnectConfig } from '../src/types.js';

describe('BackoffCalculator', () => {
  const defaultConfig: ReconnectConfig = {
    maxRetries: 10,
    initialDelay: 1000,
    maxDelay: 30000,
    jitterFactor: 0.1,
    backoffStrategy: 'exponential-with-jitter',
    enableEventBuffer: true,
    maxBufferSize: 1024 * 1024,
    healthCheckInterval: 30000,
    connectionTimeout: 10000,
    reconnectOnServerClose: true,
    reconnectOnNetworkLoss: true,
    reconnectOnError: true
  };

  describe('Construction', () => {
    it('should create with default config', () => {
      const calculator = new BackoffCalculator(defaultConfig);
      expect(calculator).toBeDefined();
    });

    it('should create with factory function', () => {
      const calculator = createBackoffCalculator();
      expect(calculator).toBeDefined();
    });

    it('should create with custom config', () => {
      const calculator = createBackoffCalculator({
        initialDelay: 500,
        maxDelay: 10000
      });

      const config = calculator.getConfig();
      expect(config.initialDelay).toBe(500);
      expect(config.maxDelay).toBe(10000);
    });
  });

  describe('Fixed Delay Strategy', () => {
    it('should return constant delay for all attempts', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'fixed',
        initialDelay: 1000
      });

      expect(calculator.calculateFixedDelay(1)).toBe(1000);
      expect(calculator.calculateFixedDelay(2)).toBe(1000);
      expect(calculator.calculateFixedDelay(10)).toBe(1000);
    });

    it('should return initial delay regardless of attempt', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'fixed',
        initialDelay: 2000
      });

      for (let i = 1; i <= 20; i++) {
        expect(calculator.calculateFixedDelay(i)).toBe(2000);
      }
    });

    it('should use fixed strategy in calculateDelay', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'fixed',
        initialDelay: 1500
      });

      const result1 = calculator.calculateDelay(1);
      const result2 = calculator.calculateDelay(5);

      expect(result1.delay).toBe(1500);
      expect(result2.delay).toBe(1500);
      expect(result1.strategy).toBe('fixed');
      expect(result1.jitterApplied).toBe(false);
    });
  });

  describe('Linear Delay Strategy', () => {
    it('should increase delay linearly', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'linear',
        initialDelay: 1000
      });

      expect(calculator.calculateLinearDelay(1)).toBe(1000);
      expect(calculator.calculateLinearDelay(2)).toBe(2000);
      expect(calculator.calculateLinearDelay(3)).toBe(3000);
      expect(calculator.calculateLinearDelay(5)).toBe(5000);
    });

    it('should use correct formula: delay = initialDelay * attempt', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'linear',
        initialDelay: 500
      });

      expect(calculator.calculateLinearDelay(1)).toBe(500);
      expect(calculator.calculateLinearDelay(10)).toBe(5000);
      expect(calculator.calculateLinearDelay(20)).toBe(10000);
    });

    it('should use linear strategy in calculateDelay', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'linear',
        initialDelay: 1000
      });

      const result = calculator.calculateDelay(3);

      expect(result.delay).toBe(3000);
      expect(result.strategy).toBe('linear');
      expect(result.jitterApplied).toBe(false);
    });
  });

  describe('Exponential Delay Strategy', () => {
    it('should double delay each attempt', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential',
        initialDelay: 1000
      });

      expect(calculator.calculateExponentialDelay(1)).toBe(1000);  // 2^0
      expect(calculator.calculateExponentialDelay(2)).toBe(2000);  // 2^1
      expect(calculator.calculateExponentialDelay(3)).toBe(4000);  // 2^2
      expect(calculator.calculateExponentialDelay(4)).toBe(8000);  // 2^3
      expect(calculator.calculateExponentialDelay(5)).toBe(16000); // 2^4
    });

    it('should use correct formula: delay = initialDelay * 2^(attempt-1)', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential',
        initialDelay: 500
      });

      expect(calculator.calculateExponentialDelay(1)).toBe(500);
      expect(calculator.calculateExponentialDelay(2)).toBe(1000);
      expect(calculator.calculateExponentialDelay(3)).toBe(2000);
      expect(calculator.calculateExponentialDelay(4)).toBe(4000);
    });

    it('should use exponential strategy in calculateDelay', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential',
        initialDelay: 1000
      });

      const result = calculator.calculateDelay(3);

      expect(result.delay).toBe(4000);
      expect(result.strategy).toBe('exponential');
      expect(result.jitterApplied).toBe(false);
    });
  });

  describe('Exponential with Jitter Strategy', () => {
    it('should add jitter to exponential delay', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential-with-jitter',
        initialDelay: 1000,
        jitterFactor: 0.1
      });

      const baseDelay = calculator.calculateExponentialDelay(3); // 4000
      const jitteredDelays: number[] = [];

      // Generate multiple delays to check variance
      for (let i = 0; i < 20; i++) {
        jitteredDelays.push(calculator.calculateDelayWithStrategy(3, 'exponential-with-jitter'));
      }

      // Check that delays vary (jitter is working)
      const uniqueDelays = new Set(jitteredDelays);
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // Check that all delays are within expected range (4000 +/- 400)
      for (const delay of jitteredDelays) {
        expect(delay).toBeGreaterThan(3600);
        expect(delay).toBeLessThan(4400);
      }
    });

    it('should respect jitter factor', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential-with-jitter',
        initialDelay: 1000,
        jitterFactor: 0.5 // 50% jitter
      });

      const baseDelay = 1000;
      const delays: number[] = [];

      for (let i = 0; i < 50; i++) {
        delays.push(calculator.calculateDelayWithStrategy(1, 'exponential-with-jitter'));
      }

      // With 50% jitter, range should be 500-1500
      const minDelay = Math.min(...delays);
      const maxDelay = Math.max(...delays);

      expect(minDelay).toBeGreaterThan(400);
      expect(maxDelay).toBeLessThan(1600);
    });

    it('should use exponential-with-jitter in calculateDelay', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential-with-jitter',
        initialDelay: 1000
      });

      const result = calculator.calculateDelay(1);

      expect(result.strategy).toBe('exponential-with-jitter');
      expect(result.jitterApplied).toBe(true);
    });

    it('should handle zero jitter factor', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        jitterFactor: 0
      });

      const delay1 = calculator.calculateJitterDelay(1000, 0);
      const delay2 = calculator.calculateJitterDelay(1000, 0);

      expect(delay1).toBe(1000);
      expect(delay2).toBe(1000);
    });

    it('should handle negative jitter factor', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        jitterFactor: -0.1
      });

      const delay = calculator.calculateJitterDelay(1000, -0.1);

      // Should return base delay for invalid jitter
      expect(delay).toBe(1000);
    });

    it('should handle jitter factor >= 1', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        jitterFactor: 1.0
      });

      const delay = calculator.calculateJitterDelay(1000, 1.0);

      // Should return base delay for invalid jitter
      expect(delay).toBe(1000);
    });
  });

  describe('Max Delay Clamping', () => {
    it('should clamp delays to maxDelay', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 5000
      });

      // Without clamping, this would be 32000
      const clampedDelay = calculator.calculateDelay(6).delay;

      expect(clampedDelay).toBeLessThanOrEqual(5000);
    });

    it('should clamp linear strategy', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'linear',
        initialDelay: 1000,
        maxDelay: 3000
      });

      expect(calculator.calculateDelay(2).delay).toBe(2000);
      expect(calculator.calculateDelay(3).delay).toBe(3000);
      expect(calculator.calculateDelay(5).delay).toBe(3000); // Clamped
    });

    it('should clamp exponential strategy', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000
      });

      expect(calculator.calculateDelay(1).delay).toBe(1000);
      expect(calculator.calculateDelay(2).delay).toBe(2000);
      expect(calculator.calculateDelay(3).delay).toBe(4000);
      expect(calculator.calculateDelay(4).delay).toBe(8000);
      expect(calculator.calculateDelay(5).delay).toBe(10000); // Clamped from 16000
    });
  });

  describe('Cumulative Delay Calculation', () => {
    it('should calculate cumulative delay correctly for fixed', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'fixed',
        initialDelay: 1000,
        maxDelay: 10000
      });

      expect(calculator.calculateCumulativeDelay(1)).toBe(1000);
      expect(calculator.calculateCumulativeDelay(3)).toBe(3000);
      expect(calculator.calculateCumulativeDelay(5)).toBe(5000);
    });

    it('should calculate cumulative delay correctly for linear', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'linear',
        initialDelay: 1000,
        maxDelay: 10000
      });

      // 1 + 2 + 3 = 6 seconds = 6000ms
      expect(calculator.calculateCumulativeDelay(3)).toBe(6000);
    });

    it('should calculate cumulative delay correctly for exponential', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000
      });

      // 1 + 2 + 4 + 8 = 15 seconds = 15000ms, but clamped to maxDelay
      const cumulative = calculator.calculateCumulativeDelay(4);

      expect(cumulative).toBeGreaterThan(0);
      expect(cumulative).toBeLessThanOrEqual(40000);
    });
  });

  describe('Attempt Estimation', () => {
    it('should estimate attempts within budget', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'fixed',
        initialDelay: 1000
      });

      const attempts = calculator.estimateAttemptsWithinBudget(5000);

      expect(attempts).toBe(5); // 5 attempts * 1000ms = 5000ms
    });

    it('should estimate attempts for linear strategy', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'linear',
        initialDelay: 1000,
        maxDelay: 10000
      });

      const attempts = calculator.estimateAttemptsWithinBudget(6000);

      // 1+2+3 = 6 seconds
      expect(attempts).toBe(3);
    });

    it('should handle large time budgets', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'fixed',
        initialDelay: 100
      });

      const attempts = calculator.estimateAttemptsWithinBudget(100000);

      expect(attempts).toBeGreaterThan(100);
    });
  });

  describe('Custom Strategy Override', () => {
    it('should allow custom strategy in calculateDelayWithStrategy', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'fixed',
        initialDelay: 1000
      });

      const fixedDelay = calculator.calculateDelayWithStrategy(3, 'fixed');
      const exponentialDelay = calculator.calculateDelayWithStrategy(3, 'exponential');

      expect(fixedDelay).toBe(1000);
      expect(exponentialDelay).toBe(4000);
    });
  });

  describe('Configuration Management', () => {
    it('should get current config', () => {
      const calculator = new BackoffCalculator(defaultConfig);
      const config = calculator.getConfig();

      expect(config).toBeDefined();
      expect(config.initialDelay).toBe(1000);
      expect(config.maxDelay).toBe(30000);
    });

    it('should update config', () => {
      const calculator = new BackoffCalculator(defaultConfig);

      calculator.updateConfig({
        initialDelay: 500,
        maxDelay: 10000
      });

      const config = calculator.getConfig();

      expect(config.initialDelay).toBe(500);
      expect(config.maxDelay).toBe(10000);
    });

    it('should use updated config for calculations', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'fixed',
        initialDelay: 1000
      });

      expect(calculator.calculateFixedDelay(1)).toBe(1000);

      calculator.updateConfig({ initialDelay: 500 });

      expect(calculator.calculateFixedDelay(1)).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle attempt number 0', () => {
      const calculator = new BackoffCalculator(defaultConfig);

      // Exponential with attempt 0: 2^-1 = 0.5, should be handled gracefully
      const delay = calculator.calculateExponentialDelay(0);

      expect(delay).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large attempt numbers', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        backoffStrategy: 'exponential',
        maxDelay: 30000
      });

      const delay = calculator.calculateDelay(100).delay;

      // Should be clamped to maxDelay
      expect(delay).toBeLessThanOrEqual(30000);
    });

    it('should handle negative initial delay', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        initialDelay: -1000
      });

      const delay = calculator.calculateFixedDelay(1);

      // Should return the negative value (caller's responsibility)
      expect(delay).toBe(-1000);
    });

    it('should handle zero initial delay', () => {
      const calculator = new BackoffCalculator({
        ...defaultConfig,
        initialDelay: 0
      });

      const delay = calculator.calculateFixedDelay(1);

      expect(delay).toBe(0);
    });
  });
});
