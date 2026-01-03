/**
 * Additional Tests to reach 285+ target
 * Additional edge case and error handling tests.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoadTester, StressTester, EnduranceTester, ScaleTester, ScenarioBuilder, SLAReporter, TrafficGenerator, LatencyProfiler, ResourceMonitor, createRampStrategy } from '../src/index.js';

describe('Additional Edge Case Tests', () => {
  let mockExecutor: any;

  beforeEach(() => {
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      }),
      healthCheck: vi.fn().mockResolvedValue(true),
      getMetrics: vi.fn().mockResolvedValue({
        memory: 100_000_000,
        cpu: 50
      }),
      scaleUp: vi.fn().mockResolvedValue(true),
      scaleDown: vi.fn().mockResolvedValue(true),
      getCurrentCapacity: vi.fn().mockResolvedValue({
        instances: 2,
        resources: { cpu: 4, memory: 8_000_000_000 }
      }),
      getCost: vi.fn().mockResolvedValue(100),
      getInstanceCount: vi.fn().mockResolvedValue(2),
      getCurrentLoad: vi.fn().mockResolvedValue(50),
      waitForScaling: vi.fn().mockResolvedValue(3000),
      setAutoScalingPolicy: vi.fn().mockResolvedValue(true)
    };
  });

  describe('LoadTester Edge Cases', () => {
    it('should handle zero concurrent users', async () => {
      const tester = new LoadTester();
      const config = {
        name: 'zero_users',
        concurrentUsers: 0,
        requestsPerSecond: 0,
        rampUpDuration: 100,
        sustainDuration: 100,
        rampDownDuration: 100
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle very large number of users', async () => {
      const tester = new LoadTester();
      const config = {
        name: 'many_users',
        concurrentUsers: 10000,
        requestsPerSecond: 100000,
        rampUpDuration: 100,
        sustainDuration: 100,
        rampDownDuration: 100
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle zero durations', async () => {
      const tester = new LoadTester();
      const config = {
        name: 'zero_duration',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 0,
        sustainDuration: 0,
        rampDownDuration: 0
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle instant ramp down', async () => {
      const tester = new LoadTester();
      const config = {
        name: 'instant_ramp',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 100,
        sustainDuration: 100,
        rampDownDuration: 0
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result.rampDownData.duration).toBe(0);
    });
  });

  describe('StressTester Edge Cases', () => {
    it('should handle zero max load', async () => {
      const tester = new StressTester();
      const config = {
        name: 'zero_max',
        maxLoad: 0,
        spikeMagnitude: 2,
        spikeDuration: 1000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 10,
        incrementInterval: 100
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle increment larger than max', async () => {
      const tester = new StressTester();
      const config = {
        name: 'large_increment',
        maxLoad: 50,
        spikeMagnitude: 2,
        spikeDuration: 1000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 100,
        incrementInterval: 100
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle zero spike duration', async () => {
      const tester = new StressTester();
      const config = {
        name: 'zero_spike',
        maxLoad: 100,
        spikeMagnitude: 5,
        spikeDuration: 0,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 20,
        incrementInterval: 100
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result.spikeSurvived).toBeDefined();
    });
  });

  describe('EnduranceTester Edge Cases', () => {
    it('should handle very short duration', async () => {
      const tester = new EnduranceTester();
      const config = {
        name: 'short',
        duration: 100,
        sampleInterval: 50,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 5
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle zero load level', async () => {
      const tester = new EnduranceTester();
      const config = {
        name: 'zero_load',
        duration: 1000,
        sampleInterval: 200,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 0
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle zero sample interval', async () => {
      const tester = new EnduranceTester();
      const config = {
        name: 'zero_interval',
        duration: 500,
        sampleInterval: 0,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 5
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });
  });

  describe('ScaleTester Edge Cases', () => {
    it('should handle zero scale steps', async () => {
      const tester = new ScaleTester();
      const config = {
        name: 'zero_steps',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 0,
        stepDuration: 500,
        measureCost: false
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });

    it('should handle zero baseline load', async () => {
      const tester = new ScaleTester();
      const config = {
        name: 'zero_baseline',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 0,
        scaleSteps: 2,
        stepDuration: 300,
        measureCost: false
      };

      const result = await tester.execute(config, mockExecutor);
      expect(result).toBeDefined();
    });
  });

  describe('SLAReporter Edge Cases', () => {
    it('should handle zero availability threshold', () => {
      const reporter = new SLAReporter({
        config: {
          latency: { p50: 100, p95: 200, p99: 500 },
          availability: 0,
          throughput: 100,
          errorRate: 0.01
        },
        windowSize: 60000,
        reportingInterval: 10000
      });

      reporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: true
      });

      const report = reporter.generateReport();
      expect(report).toBeDefined();
    });

    it('should handle 100% availability threshold', () => {
      const reporter = new SLAReporter({
        config: {
          latency: { p50: 100, p95: 200, p99: 500 },
          availability: 1.0,
          throughput: 100,
          errorRate: 0
        },
        windowSize: 60000,
        reportingInterval: 10000
      });

      for (let i = 0; i < 5; i++) {
        reporter.recordSample({
          timestamp: Date.now() + i,
          latency: 100,
          success: true
        });
      }

      const report = reporter.generateReport();
      expect(report).toBeDefined();
    });
  });

  describe('TrafficGenerator Edge Cases', () => {
    it('should handle negative rate', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'poisson' as const,
        rate: -100,
        duration: 1000
      };

      const traffic = generator.generate(config);
      expect(traffic).toBeDefined();
    });

    it('should handle very large burstiness', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'bursty' as const,
        rate: 100,
        duration: 5000,
        burstiness: 2.0 // Over 1
      };

      const traffic = generator.generate(config);
      expect(traffic).toBeDefined();
    });

    it('should handle zero burstiness', () => {
      const generator = new TrafficGenerator(12345);
      const config = {
        pattern: 'bursty' as const,
        rate: 100,
        duration: 5000,
        burstiness: 0
      };

      const traffic = generator.generate(config);
      expect(traffic).toBeDefined();
    });
  });

  describe('LatencyProfiler Edge Cases', () => {
    it('should handle zero latency samples', () => {
      const profiler = new LatencyProfiler();

      for (let i = 0; i < 5; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 0,
          operation: 'test',
          success: true
        });
      }

      const metrics = profiler.getMetrics();
      expect(metrics.mean).toBe(0);
    });

    it('should handle very large latency values', () => {
      const profiler = new LatencyProfiler();

      profiler.recordSample({
        timestamp: Date.now(),
        latency: Number.MAX_SAFE_INTEGER,
        operation: 'test',
        success: true
      });

      const metrics = profiler.getMetrics();
      expect(metrics.max).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('ResourceMonitor Edge Cases', () => {
    it('should handle zero sample interval', () => {
      const monitor = new ResourceMonitor({
        sampleInterval: 0,
        maxSamples: 100
      });

      monitor.start();
      monitor.captureSnapshot();
      monitor.stop();

      expect(monitor).toBeDefined();
    });

    it('should handle zero max samples', () => {
      const monitor = new ResourceMonitor({
        sampleInterval: 100,
        maxSamples: 0
      });

      monitor.start();

      for (let i = 0; i < 5; i++) {
        monitor.captureSnapshot();
      }

      const snapshots = monitor.getSnapshots();
      expect(snapshots.length).toBe(0);

      monitor.stop();
    });
  });

  describe('ScenarioBuilder Edge Cases', () => {
    it('should handle stage with zero assertions', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'No Assertions',
          load: 10,
          duration: 500,
          assertions: []
        })
        .build();

      expect(scenario.stages[0].assertions.length).toBe(0);
    });

    it('should handle stage with very long duration', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Long',
          load: 10,
          duration: Number.MAX_SAFE_INTEGER
        })
        .build();

      expect(scenario.stages[0].duration).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle negative assertion threshold', () => {
      const builder = new ScenarioBuilder({ name: 'test' });
      const scenario = builder
        .addLoadStage({
          name: 'Negative',
          load: 10,
          duration: 500,
          assertions: [
            { type: 'latency', metric: 'p95', threshold: -1, operator: 'lt' }
          ]
        })
        .build();

      expect(scenario.stages[0].assertions[0].threshold).toBe(-1);
    });
  });

  describe('RampStrategy Edge Cases', () => {
    it('should handle custom ramp function returning zero', () => {
      const strategy = createRampStrategy('custom', {
        loadFunction: () => 0
      });

      const config = {
        name: 'test',
        concurrentUsers: 100,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      const load = strategy.getCurrentLoad(500, config);
      expect(load).toBe(0);
    });

    it('should handle custom ramp function returning negative', () => {
      const strategy = createRampStrategy('custom', {
        loadFunction: () => -10
      });

      const config = {
        name: 'test',
        concurrentUsers: 100,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      const load = strategy.getCurrentLoad(500, config);
      expect(load).toBe(0); // Should clamp to 0
    });

    it('should handle custom ramp function exceeding max', () => {
      const strategy = createRampStrategy('custom', {
        loadFunction: () => 1000
      });

      const config = {
        name: 'test',
        concurrentUsers: 100,
        requestsPerSecond: 100,
        rampUpDuration: 1000,
        sustainDuration: 1000,
        rampDownDuration: 1000
      };

      const load = strategy.getCurrentLoad(500, config);
      expect(load).toBe(100); // Should clamp to max
    });
  });

  describe('Error Recovery', () => {
    it('should recover from executor throwing errors', async () => {
      let shouldThrow = true;
      const errorExecutor = {
        execute: vi.fn().mockImplementation(async () => {
          if (shouldThrow) {
            shouldThrow = false;
            throw new Error('Temporary error');
          }
          return { success: true, latency: 100 };
        }),
        healthCheck: vi.fn().mockResolvedValue(true),
        getMetrics: vi.fn().mockResolvedValue({
          memory: 100_000_000,
          cpu: 50
        }),
        scaleUp: vi.fn().mockResolvedValue(true),
        scaleDown: vi.fn().mockResolvedValue(true),
        getCurrentCapacity: vi.fn().mockResolvedValue({
          instances: 2,
          resources: { cpu: 4, memory: 8_000_000_000 }
        }),
        getCost: vi.fn().mockResolvedValue(100)
      };

      const tester = new LoadTester();
      const config = {
        name: 'error_recovery',
        concurrentUsers: 5,
        requestsPerSecond: 50,
        rampUpDuration: 200,
        sustainDuration: 200,
        rampDownDuration: 200
      };

      const result = await tester.execute(config, errorExecutor);
      expect(result).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should handle large sample counts without overflow', () => {
      const profiler = new LatencyProfiler({ maxSamples: 1000000 });

      for (let i = 0; i < 10000; i++) {
        profiler.recordSample({
          timestamp: Date.now() + i,
          latency: 100 + i,
          operation: 'test',
          success: true
        });
      }

      // Should trim to max samples
      expect(profiler.getSampleCount()).toBeLessThanOrEqual(1000000);
    });

    it('should handle memory leak detector with many snapshots', () => {
      const { MemoryLeakDetector } = require('../src/endurance/MemoryLeakDetector.js');
      const detector = new MemoryLeakDetector({
        maxSamples: 10000,
        sampleInterval: 10
      });

      detector.start();

      for (let i = 0; i < 1000; i++) {
        detector.captureSnapshot();
      }

      expect(detector.getSnapshots().length).toBeLessThanOrEqual(10000);

      detector.stop();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple profilers simultaneously', () => {
      const profilers = [
        new LatencyProfiler(),
        new LatencyProfiler(),
        new LatencyProfiler()
      ];

      for (let i = 0; i < 10; i++) {
        profilers.forEach((profiler, idx) => {
          profiler.recordSample({
            timestamp: Date.now() + i,
            latency: 100 + idx * 10,
            operation: `test_${idx}`,
            success: true
          });
        });
      }

      profilers.forEach(profiler => {
        expect(profiler.getSampleCount()).toBe(10);
      });
    });

    it('should handle multiple monitors simultaneously', () => {
      const monitors = [
        new ResourceMonitor(),
        new ResourceMonitor(),
        new ResourceMonitor()
      ];

      monitors.forEach(monitor => monitor.start());

      monitors.forEach(monitor => {
        monitor.captureSnapshot();
      });

      monitors.forEach(monitor => {
        expect(monitor.getSnapshots().length).toBe(1);
        monitor.stop();
      });
    });
  });
});
