/**
 * LoadTester Tests
 * Comprehensive tests for load testing functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoadTester, createRampStrategy, LinearRampStrategy } from '../src/index.js';

describe('LoadTester', () => {
  let loadTester: LoadTester;
  let mockExecutor: any;

  beforeEach(() => {
    loadTester = new LoadTester();
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      })
    };
  });

  describe('Initialization', () => {
    it('should initialize with default linear strategy', () => {
      expect(loadTester).toBeInstanceOf(LoadTester);
    });

    it('should accept custom ramp strategy', () => {
      const customStrategy = new LinearRampStrategy();
      const tester = new LoadTester(customStrategy);
      expect(tester).toBeInstanceOf(LoadTester);
    });
  });

  describe('Load Test Execution', () => {
    it('should execute load test with basic config', async () => {
      const config = {
        name: 'test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      const result = await loadTester.execute(config, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.successfulRequests).toBeGreaterThan(0);
    });

    it('should record latency metrics', async () => {
      const config = {
        name: 'test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      const result = await loadTester.execute(config, mockExecutor);

      expect(result.latency).toBeDefined();
      expect(result.latency.min).toBeGreaterThanOrEqual(0);
      expect(result.latency.max).toBeGreaterThanOrEqual(0);
      expect(result.latency.mean).toBeGreaterThan(0);
      expect(result.latency.p50).toBeGreaterThan(0);
      expect(result.latency.p95).toBeGreaterThan(0);
      expect(result.latency.p99).toBeGreaterThan(0);
    });

    it('should calculate throughput', async () => {
      const config = {
        name: 'test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      const result = await loadTester.execute(config, mockExecutor);

      expect(result.throughput).toBeGreaterThan(0);
    });

    it('should track errors', async () => {
      mockExecutor.execute.mockResolvedValueOnce({
        success: false,
        latency: 100,
        error: 'Test error'
      });

      const config = {
        name: 'test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 500,
        sustainDuration: 500,
        rampDownDuration: 500
      };

      const result = await loadTester.execute(config, mockExecutor);

      expect(result.failedRequests).toBeGreaterThan(0);
      expect(result.errors.total).toBeGreaterThan(0);
    });

    it('should record phase data', async () => {
      const config = {
        name: 'test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 500,
        sustainDuration: 500,
        rampDownDuration: 500
      };

      const result = await loadTester.execute(config, mockExecutor);

      expect(result.rampUpData).toBeDefined();
      expect(result.sustainData).toBeDefined();
      expect(result.rampDownData).toBeDefined();
    });
  });

  describe('Ramp Strategy', () => {
    it('should use linear ramp strategy by default', async () => {
      const strategy = new LinearRampStrategy();
      const config = {
        name: 'test',
        concurrentUsers: 100,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 500,
        rampDownDuration: 1000
      };

      loadTester.setStrategy(strategy);
      const result = await loadTester.execute(config, mockExecutor);

      expect(result.success).toBe(true);
    });

    it('should calculate current load correctly during ramp up', () => {
      const strategy = new LinearRampStrategy();
      const config = {
        name: 'test',
        concurrentUsers: 100,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      // At 50% of ramp up, should have 50% load
      const load = strategy.getCurrentLoad(500, config);
      expect(load).toBe(50);
    });

    it('should maintain full load during sustain', () => {
      const strategy = new LinearRampStrategy();
      const config = {
        name: 'test',
        concurrentUsers: 100,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      // During sustain, should have full load
      const load = strategy.getCurrentLoad(1500, config);
      expect(load).toBe(100);
    });

    it('should ramp down load correctly', () => {
      const strategy = new LinearRampStrategy();
      const config = {
        name: 'test',
        concurrentUsers: 100,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      // At 50% of ramp down, should have 50% load
      const load = strategy.getCurrentLoad(2500, config);
      expect(load).toBe(50);
    });
  });

  describe('Latency Calculations', () => {
    it('should calculate percentiles correctly', async () => {
      const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      mockExecutor.execute.mockImplementation(async () => {
        const latency = latencies.shift() ?? 100;
        return { success: true, latency };
      });

      const config = {
        name: 'test',
        concurrentUsers: 10,
        requestsPerSecond: 1000,
        rampUpDuration: 100,
        sustainDuration: 100,
        rampDownDuration: 100
      };

      const result = await loadTester.execute(config, mockExecutor);

      expect(result.latency.min).toBeGreaterThan(0);
      expect(result.latency.max).toBeGreaterThan(0);
      expect(result.latency.p50).toBeGreaterThan(0);
    });

    it('should handle empty latency samples', async () => {
      mockExecutor.execute.mockResolvedValue({
        success: false,
        latency: 0,
        error: 'Failed'
      });

      const config = {
        name: 'test',
        concurrentUsers: 1,
        requestsPerSecond: 10,
        rampUpDuration: 100,
        sustainDuration: 100,
        rampDownDuration: 100
      };

      const result = await loadTester.execute(config, mockExecutor);

      expect(result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should aggregate error types', async () => {
      mockExecutor.execute
        .mockResolvedValueOnce({ success: false, latency: 100, error: 'Error 1' })
        .mockResolvedValueOnce({ success: false, latency: 100, error: 'Error 1' })
        .mockResolvedValueOnce({ success: false, latency: 100, error: 'Error 2' });

      const config = {
        name: 'test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 200,
        sustainDuration: 200,
        rampDownDuration: 200
      };

      const result = await loadTester.execute(config, mockExecutor);

      expect(result.errors.byType['Error 1']).toBeGreaterThan(0);
      expect(result.errors.byType['Error 2']).toBeGreaterThan(0);
    });

    it('should extract error codes', async () => {
      mockExecutor.execute.mockResolvedValue({
        success: false,
        latency: 100,
        error: '[TIMEOUT] Request timeout'
      });

      const config = {
        name: 'test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 200,
        sustainDuration: 200,
        rampDownDuration: 200
      };

      const result = await loadTester.execute(config, mockExecutor);

      expect(result.errors.byCode).toBeDefined();
    });
  });

  describe('Current Statistics', () => {
    it('should return current stats during test', async () => {
      const config = {
        name: 'test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      // Start test (we won't await)
      const testPromise = loadTester.execute(config, mockExecutor);

      // Wait a bit then get stats
      await new Promise(resolve => setTimeout(resolve, 100));
      const stats = loadTester.getCurrentStats();

      expect(stats).toBeDefined();
      expect(stats.requests).toBeGreaterThanOrEqual(0);
      expect(stats.avgLatency).toBeGreaterThanOrEqual(0);

      await testPromise;
    });
  });

  describe('Strategy Factory', () => {
    it('should create linear strategy', () => {
      const strategy = createRampStrategy('linear');
      expect(strategy).toBeInstanceOf(LinearRampStrategy);
    });

    it('should create exponential strategy', () => {
      const strategy = createRampStrategy('exponential', { base: 2 });
      expect(strategy).toBeDefined();
      expect(strategy.type).toBe('exponential');
    });

    it('should create step strategy', () => {
      const strategy = createRampStrategy('step', { steps: 5 });
      expect(strategy).toBeDefined();
      expect(strategy.type).toBe('step');
    });
  });
});

describe('RampStrategy', () => {
  const config = {
    name: 'test',
    concurrentUsers: 100,
    requestsPerSecond: 100,
    rampUpDuration: 1000,
    sustainDuration: 1000,
    rampDownDuration: 1000
  };

  describe('LinearRampStrategy', () => {
    it('should start at 0 load', () => {
      const strategy = new LinearRampStrategy();
      expect(strategy.getCurrentLoad(-1, config)).toBe(0);
    });

    it('should linearly increase during ramp up', () => {
      const strategy = new LinearRampStrategy();
      expect(strategy.getCurrentLoad(0, config)).toBe(0);
      expect(strategy.getCurrentLoad(500, config)).toBe(50);
      expect(strategy.getCurrentLoad(1000, config)).toBe(100);
    });

    it('should maintain load during sustain', () => {
      const strategy = new LinearRampStrategy();
      expect(strategy.getCurrentLoad(1500, config)).toBe(100);
      expect(strategy.getCurrentLoad(1999, config)).toBe(100);
    });

    it('should linearly decrease during ramp down', () => {
      const strategy = new LinearRampStrategy();
      expect(strategy.getCurrentLoad(2000, config)).toBe(100);
      expect(strategy.getCurrentLoad(2500, config)).toBe(50);
      expect(strategy.getCurrentLoad(3000, config)).toBe(0);
    });

    it('should return 0 after test complete', () => {
      const strategy = new LinearRampStrategy();
      expect(strategy.getCurrentLoad(4000, config)).toBe(0);
    });
  });

  describe('ExponentialRampStrategy', () => {
    it('should increase exponentially during ramp up', () => {
      const strategy = createRampStrategy('exponential', { base: 2 }) as any;
      const loadAt25 = strategy.getCurrentLoad(250, config);
      const loadAt75 = strategy.getCurrentLoad(750, config);

      expect(loadAt75).toBeGreaterThan(loadAt25);
    });
  });

  describe('StepRampStrategy', () => {
    it('should increase in discrete steps', () => {
      const strategy = createRampStrategy('step', { steps: 4 }) as any;
      const load1 = strategy.getCurrentLoad(200, config);
      const load2 = strategy.getCurrentLoad(300, config);

      // Should be same step
      expect(load1).toBe(load2);
    });
  });
});
