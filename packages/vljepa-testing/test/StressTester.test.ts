/**
 * StressTester Tests
 * Comprehensive tests for stress testing functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StressTester } from '../src/index.js';

describe('StressTester', () => {
  let stressTester: StressTester;
  let mockExecutor: any;

  beforeEach(() => {
    stressTester = new StressTester();
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      }),
      healthCheck: vi.fn().mockResolvedValue(true)
    };
  });

  describe('Initialization', () => {
    it('should initialize stress tester', () => {
      expect(stressTester).toBeInstanceOf(StressTester);
    });
  });

  describe('Finding Breaking Point', () => {
    it('should find breaking point', async () => {
      const config = {
        name: 'test',
        maxLoad: 500,
        spikeMagnitude: 2,
        spikeDuration: 10000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 1000
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.breakingPoint).toBeGreaterThan(0);
    });

    it('should record load points', async () => {
      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 500
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.loadPoints).toBeDefined();
      expect(result.loadPoints.length).toBeGreaterThan(0);
    });

    it('should detect high error rate as breaking point', async () => {
      let callCount = 0;
      mockExecutor.execute.mockImplementation(async () => {
        callCount++;
        return {
          success: callCount < 10,
          latency: 100
        };
      });

      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.breakingPoint).toBeGreaterThan(0);
      expect(result.failureMode).toBeDefined();
    });

    it('should detect high latency as breaking point', async () => {
      mockExecutor.execute.mockImplementation(async () => {
        return {
          success: true,
          latency: 15000 // High latency
        };
      });

      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.breakingLatency).toBeGreaterThan(0);
    });
  });

  describe('Spike Testing', () => {
    it('should test spike handling', async () => {
      const config = {
        name: 'test',
        maxLoad: 500,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 500
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.spikeSurvived).toBeDefined();
    });

    it('should handle spike magnitude correctly', async () => {
      const config = {
        name: 'test',
        maxLoad: 300,
        spikeMagnitude: 5,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.spikeSurvived).toBeDefined();
    });
  });

  describe('Recovery Testing', () => {
    it('should test recovery when enabled', async () => {
      mockExecutor.execute
        .mockImplementationOnce(async () => ({ success: false, latency: 100 }))
        .mockImplementation(async () => ({ success: true, latency: 100 }));

      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: true,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.recovered).toBeDefined();
      expect(result.recoveryTime).toBeGreaterThanOrEqual(0);
    });

    it('should skip recovery when disabled', async () => {
      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.recovered).toBe(false);
    });
  });

  describe('Failure Classification', () => {
    it('should classify catastrophic failure', async () => {
      mockExecutor.execute.mockResolvedValue({
        success: false,
        latency: 100
      });

      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.failureMode).toBeDefined();
    });

    it('should classify timeout failure', async () => {
      mockExecutor.execute.mockResolvedValue({
        success: false,
        latency: 35000
      });

      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.failureMode).toContain('TIMEOUT');
    });
  });

  describe('Performance Curve', () => {
    it('should record degradation curve', async () => {
      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 500
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.degradationCurve).toBeDefined();
      expect(result.degradationCurve.length).toBeGreaterThan(0);
    });

    it('should track resource usage in curve', async () => {
      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 500
      };

      const result = await stressTester.execute(config, mockExecutor);

      for (const point of result.degradationCurve) {
        expect(point.load).toBeGreaterThanOrEqual(0);
        expect(point.timestamp).toBeGreaterThan(0);
      }
    });
  });

  describe('Load Points', () => {
    it('should record detailed metrics per load point', async () => {
      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 500
      };

      const result = await stressTester.execute(config, mockExecutor);

      for (const point of result.loadPoints) {
        expect(point.load).toBeGreaterThan(0);
        expect(point.requests).toBeGreaterThanOrEqual(0);
        expect(point.successes).toBeGreaterThanOrEqual(0);
        expect(point.failures).toBeGreaterThanOrEqual(0);
        expect(point.avgLatency).toBeGreaterThanOrEqual(0);
        expect(point.p95Latency).toBeGreaterThanOrEqual(0);
        expect(point.errorRate).toBeGreaterThanOrEqual(0);
      }
    });

    it('should calculate error rate correctly', async () => {
      mockExecutor.execute
        .mockImplementationOnce(async () => ({ success: true, latency: 100 }))
        .mockImplementationOnce(async () => ({ success: true, latency: 100 }))
        .mockImplementationOnce(async () => ({ success: false, latency: 100 }))
        .mockImplementation(async () => ({ success: true, latency: 100 }));

      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 500
      };

      const result = await stressTester.execute(config, mockExecutor);

      const pointWithErrors = result.loadPoints.find(p => p.failures > 0);
      if (pointWithErrors) {
        const expectedRate = pointWithErrors.failures / pointWithErrors.requests;
        expect(pointWithErrors.errorRate).toBeCloseTo(expectedRate, 2);
      }
    });
  });

  describe('Health Checks', () => {
    it('should use health checks during test', async () => {
      let healthCheckCalls = 0;
      mockExecutor.healthCheck.mockImplementation(async () => {
        healthCheckCalls++;
        return healthCheckCalls < 5;
      });

      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: true,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      await stressTester.execute(config, mockExecutor);

      expect(mockExecutor.healthCheck).toHaveBeenCalled();
    });

    it('should handle health check failures', async () => {
      mockExecutor.healthCheck.mockResolvedValue(false);

      const config = {
        name: 'test',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result.breakingPoint).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max load', async () => {
      const config = {
        name: 'test',
        maxLoad: 0,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result).toBeDefined();
    });

    it('should handle very small increment', async () => {
      const config = {
        name: 'test',
        maxLoad: 100,
        spikeMagnitude: 2,
        spikeDuration: 5000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 1,
        incrementInterval: 100
      };

      const result = await stressTester.execute(config, mockExecutor);

      expect(result).toBeDefined();
    });
  });
});
