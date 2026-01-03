/**
 * ScaleTester Tests
 * Tests for horizontal and vertical scaling functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScaleTester, VerticalScaler, AutoScaler } from '../src/index.js';

describe('ScaleTester', () => {
  let scaleTester: ScaleTester;
  let mockExecutor: any;

  beforeEach(() => {
    scaleTester = new ScaleTester();
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      }),
      scaleUp: vi.fn().mockResolvedValue(true),
      scaleDown: vi.fn().mockResolvedValue(true),
      getCurrentCapacity: vi.fn().mockResolvedValue({
        instances: 2,
        resources: { cpu: 4, memory: 8_000_000_000 }
      }),
      getCost: vi.fn().mockResolvedValue(100)
    };
  });

  describe('Initialization', () => {
    it('should initialize scale tester', () => {
      expect(scaleTester).toBeInstanceOf(ScaleTester);
    });
  });

  describe('Horizontal Scaling', () => {
    it('should test horizontal scaling up', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 3,
        stepDuration: 1000,
        measureCost: false
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.baseline).toBeDefined();
      expect(result.scaled.length).toBeGreaterThan(0);
      expect(mockExecutor.scaleUp).toHaveBeenCalled();
    });

    it('should test horizontal scaling down', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'down' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 2,
        stepDuration: 1000,
        measureCost: false
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.success).toBe(true);
      expect(mockExecutor.scaleDown).toHaveBeenCalled();
    });

    it('should record scaling curve', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 3,
        stepDuration: 1000,
        measureCost: false
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.scalingCurve).toBeDefined();
      expect(result.scalingCurve.length).toBeGreaterThan(0);

      for (const point of result.scalingCurve) {
        expect(point.configuration).toBeGreaterThan(0);
        expect(point.throughput).toBeGreaterThan(0);
        expect(point.efficiency).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Scalability Analysis', () => {
    it('should identify linear scalability', async () => {
      let instanceCount = 1;
      mockExecutor.execute.mockImplementation(async () => {
        const throughput = instanceCount * 100;
        return { success: true, latency: 100 };
      });
      mockExecutor.getCurrentCapacity.mockImplementation(async () => ({
        instances: instanceCount++,
        resources: { cpu: 2, memory: 4_000_000_000 }
      }));

      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 3,
        stepDuration: 500,
        measureCost: false
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.scalability).toBeDefined();
      expect(['linear', 'sublinear', 'superlinear', 'degrading']).toContain(result.scalability);
    });

    it('should calculate scaling factor', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 2,
        stepDuration: 500,
        measureCost: false
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.scalingFactor).toBeGreaterThan(0);
    });

    it('should find optimal configuration', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 3,
        stepDuration: 500,
        measureCost: false
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.optimalConfig).toBeDefined();
      expect(result.optimalConfig.instances).toBeGreaterThan(0);
      expect(result.optimalConfig.resources).toBeDefined();
    });

    it('should calculate efficiency', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 2,
        stepDuration: 500,
        measureCost: false
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.efficiency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cost Analysis', () => {
    it('should measure cost per request when enabled', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 2,
        stepDuration: 500,
        measureCost: true
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.costPerRequest).toBeGreaterThanOrEqual(0);
      expect(mockExecutor.getCost).toHaveBeenCalled();
    });

    it('should skip cost measurement when disabled', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 2,
        stepDuration: 500,
        measureCost: false
      };

      await scaleTester.execute(config, mockExecutor);

      expect(mockExecutor.getCost).not.toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    it('should measure baseline performance', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 2,
        stepDuration: 500,
        measureCost: false
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.baseline).toBeDefined();
      expect(result.baseline.throughput).toBeGreaterThan(0);
      expect(result.baseline.latency).toBeDefined();
    });

    it('should measure performance at each scale', async () => {
      const config = {
        name: 'test',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 2,
        stepDuration: 500,
        measureCost: false
      };

      const result = await scaleTester.execute(config, mockExecutor);

      expect(result.scaled.length).toBeGreaterThan(0);

      for (const metrics of result.scaled) {
        expect(metrics.throughput).toBeGreaterThan(0);
        expect(metrics.latency).toBeDefined();
      }
    });
  });
});

describe('VerticalScaler', () => {
  let verticalScaler: VerticalScaler;
  let mockExecutor: any;

  beforeEach(() => {
    verticalScaler = new VerticalScaler();
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      }),
      setResources: vi.fn().mockResolvedValue(true),
      getCurrentResources: vi.fn().mockResolvedValue({
        cpu: 2,
        memory: 4_000_000_000
      })
    };
  });

  describe('Vertical Scaling', () => {
    it('should test vertical scaling', async () => {
      const config = {
        baselineResources: { cpu: 1, memory: 2_000_000_000 },
        maxResources: { cpu: 8, memory: 16_000_000_000 },
        scaleSteps: 3,
        measureDuration: 1000,
        stabilizeTime: 500
      };

      const result = await verticalScaler.execute(config, mockExecutor);

      expect(result.scaled).toBeDefined();
      expect(result.scaled.length).toBeGreaterThan(0);
      expect(mockExecutor.setResources).toHaveBeenCalled();
    });

    it('should calculate improvement', async () => {
      let latency = 200;
      mockExecutor.execute.mockImplementation(async () => {
        return { success: true, latency: latency -= 20 };
      });

      const config = {
        baselineResources: { cpu: 1, memory: 2_000_000_000 },
        maxResources: { cpu: 4, memory: 8_000_000_000 },
        scaleSteps: 3,
        measureDuration: 500,
        stabilizeTime: 200
      };

      const result = await verticalScaler.execute(config, mockExecutor);

      for (const point of result.scaled) {
        expect(point.improvement).toBeDefined();
      }
    });

    it('should analyze scalability pattern', async () => {
      const config = {
        baselineResources: { cpu: 1, memory: 2_000_000_000 },
        maxResources: { cpu: 4, memory: 8_000_000_000 },
        scaleSteps: 3,
        measureDuration: 500,
        stabilizeTime: 200
      };

      const result = await verticalScaler.execute(config, mockExecutor);

      expect(['linear', 'sublinear', 'plateau', 'diminishing']).toContain(result.scalability);
    });

    it('should find optimal resources', async () => {
      const config = {
        baselineResources: { cpu: 1, memory: 2_000_000_000 },
        maxResources: { cpu: 4, memory: 8_000_000_000 },
        scaleSteps: 3,
        measureDuration: 500,
        stabilizeTime: 200
      };

      const result = await verticalScaler.execute(config, mockExecutor);

      expect(result.optimalResources).toBeDefined();
      expect(result.optimalResources.cpu).toBeGreaterThan(0);
      expect(result.optimalResources.memory).toBeGreaterThan(0);
    });

    it('should calculate cost efficiency', async () => {
      const config = {
        baselineResources: { cpu: 1, memory: 2_000_000_000 },
        maxResources: { cpu: 4, memory: 8_000_000_000 },
        scaleSteps: 3,
        measureDuration: 500,
        stabilizeTime: 200
      };

      const result = await verticalScaler.execute(config, mockExecutor);

      expect(result.costEfficiency).toBeGreaterThanOrEqual(0);
    });

    it('should generate recommendation', async () => {
      const config = {
        baselineResources: { cpu: 1, memory: 2_000_000_000 },
        maxResources: { cpu: 4, memory: 8_000_000_000 },
        scaleSteps: 3,
        measureDuration: 500,
        stabilizeTime: 200
      };

      const result = await verticalScaler.execute(config, mockExecutor);

      expect(result.recommendation).toBeDefined();
      expect(result.recommendation.length).toBeGreaterThan(0);
    });
  });
});

describe('AutoScaler', () => {
  let autoScaler: AutoScaler;
  let mockExecutor: any;

  beforeEach(() => {
    autoScaler = new AutoScaler();
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      }),
      getInstanceCount: vi.fn().mockResolvedValue(2),
      getCurrentLoad: vi.fn().mockResolvedValue(50),
      waitForScaling: vi.fn().mockResolvedValue(3000),
      setAutoScalingPolicy: vi.fn().mockResolvedValue(true)
    };
  });

  describe('Auto-scaling Tests', () => {
    it('should test auto-scaling behavior', async () => {
      const config = {
        minInstances: 1,
        maxInstances: 5,
        scaleUpThreshold: 70,
        scaleDownThreshold: 30,
        cooldownPeriod: 5000,
        targetLoad: 50,
        scaleTestDuration: 5000
      };

      const result = await autoScaler.execute(config, mockExecutor);

      expect(result).toBeDefined();
      expect(result.scalingEvents).toBeDefined();
    });

    it('should track scaling events', async () => {
      let instanceCount = 2;
      mockExecutor.getInstanceCount.mockImplementation(async () => instanceCount++);
      mockExecutor.getCurrentLoad.mockResolvedValue(80);

      const config = {
        minInstances: 1,
        maxInstances: 5,
        scaleUpThreshold: 70,
        scaleDownThreshold: 30,
        cooldownPeriod: 1000,
        targetLoad: 50,
        scaleTestDuration: 3000
      };

      const result = await autoScaler.execute(config, mockExecutor);

      expect(result.scalingEvents).toBeDefined();
      expect(result.scaleUpCount).toBeGreaterThanOrEqual(0);
    });

    it('should measure scaling latency', async () => {
      const config = {
        minInstances: 1,
        maxInstances: 5,
        scaleUpThreshold: 70,
        scaleDownThreshold: 30,
        cooldownPeriod: 2000,
        targetLoad: 50,
        scaleTestDuration: 3000
      };

      const result = await autoScaler.execute(config, mockExecutor);

      expect(result.scaleUpLatency).toBeGreaterThanOrEqual(0);
      expect(result.scaleDownLatency).toBeGreaterThanOrEqual(0);
    });

    it('should detect oscillations', async () => {
      const config = {
        minInstances: 1,
        maxInstances: 5,
        scaleUpThreshold: 70,
        scaleDownThreshold: 30,
        cooldownPeriod: 1000,
        targetLoad: 50,
        scaleTestDuration: 3000
      };

      const result = await autoScaler.execute(config, mockExecutor);

      expect(result.stable).toBeDefined();
    });

    it('should count overshoots', async () => {
      const config = {
        minInstances: 1,
        maxInstances: 5,
        scaleUpThreshold: 70,
        scaleDownThreshold: 30,
        cooldownPeriod: 1000,
        targetLoad: 50,
        scaleTestDuration: 3000
      };

      const result = await autoScaler.execute(config, mockExecutor);

      expect(result.overshoots).toBeGreaterThanOrEqual(0);
      expect(result.undershoots).toBeGreaterThanOrEqual(0);
    });

    it('should generate recommendation', async () => {
      const config = {
        minInstances: 1,
        maxInstances: 5,
        scaleUpThreshold: 70,
        scaleDownThreshold: 30,
        cooldownPeriod: 1000,
        targetLoad: 50,
        scaleTestDuration: 3000
      };

      const result = await autoScaler.execute(config, mockExecutor);

      expect(result.recommendation).toBeDefined();
      expect(result.recommendation.length).toBeGreaterThan(0);
    });
  });

  describe('Average Response Time', () => {
    it('should measure average response time', async () => {
      const config = {
        minInstances: 1,
        maxInstances: 5,
        scaleUpThreshold: 70,
        scaleDownThreshold: 30,
        cooldownPeriod: 1000,
        targetLoad: 50,
        scaleTestDuration: 2000
      };

      const result = await autoScaler.execute(config, mockExecutor);

      expect(result.avgResponseTime).toBeGreaterThan(0);
    });
  });
});
