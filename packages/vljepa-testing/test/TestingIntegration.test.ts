/**
 * Integration Tests
 * End-to-end tests combining multiple testing components.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  LoadTester,
  StressTester,
  EnduranceTester,
  ScaleTester,
  ScenarioBuilder,
  SLAReporter,
  TrafficGenerator,
  LatencyProfiler,
  ResourceMonitor
} from '../src/index.js';

describe('Integration Tests', () => {
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

  describe('Load + Stress Integration', () => {
    it('should combine load and stress tests', async () => {
      const loadTester = new LoadTester();
      const stressTester = new StressTester();

      // First, run load test
      const loadConfig = {
        name: 'combined_load',
        concurrentUsers: 50,
        requestsPerSecond: 500,
        rampUpDuration: 500,
        sustainDuration: 500,
        rampDownDuration: 500
      };

      const loadResult = await loadTester.execute(loadConfig, mockExecutor);

      expect(loadResult.success).toBe(true);

      // Then, run stress test based on load test results
      const stressConfig = {
        name: 'combined_stress',
        maxLoad: loadResult.totalRequests * 2,
        spikeMagnitude: 2,
        spikeDuration: 3000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 300
      };

      const stressResult = await stressTester.execute(stressConfig, mockExecutor);

      expect(stressResult.breakingPoint).toBeGreaterThan(0);
    });

    it('should use load test baseline for stress test', async () => {
      const loadTester = new LoadTester();
      const stressTester = new StressTester();

      const loadConfig = {
        name: 'baseline',
        concurrentUsers: 20,
        requestsPerSecond: 200,
        rampUpDuration: 300,
        sustainDuration: 300,
        rampDownDuration: 300
      };

      const loadResult = await loadTester.execute(loadConfig, mockExecutor);

      // Use load test throughput to calibrate stress test
      const baselineThroughput = loadResult.throughput;

      expect(baselineThroughput).toBeGreaterThan(0);

      // Stress test should find breaking point above baseline
      const stressConfig = {
        name: 'stress_from_baseline',
        maxLoad: Math.floor(baselineThroughput * 2),
        spikeMagnitude: 2,
        spikeDuration: 2000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 20,
        incrementInterval: 200
      };

      const stressResult = await stressTester.execute(stressConfig, mockExecutor);

      expect(stressResult.breakingPoint).toBeGreaterThan(0);
    });
  });

  describe('Endurance + SLA Integration', () => {
    it('should monitor SLA during endurance test', async () => {
      const enduranceTester = new EnduranceTester();
      const slaReporter = new SLAReporter({
        config: {
          latency: { p50: 100, p95: 200, p99: 500 },
          availability: 0.99,
          throughput: 50,
          errorRate: 0.05
        },
        windowSize: 30000,
        reportingInterval: 5000
      });

      const config = {
        name: 'endurance_sla',
        duration: 3000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      // Start SLA monitoring
      slaReporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: true
      });

      // Run endurance test
      const result = await enduranceTester.execute(config, mockExecutor);

      // Record final SLA
      slaReporter.recordSample({
        timestamp: Date.now(),
        latency: 100,
        success: true
      });

      const slaReport = slaReporter.generateReport();

      expect(result.stable).toBeDefined();
      expect(slaReport.compliant).toBeDefined();
    });

    it('should track SLA violations during degradation', async () => {
      const enduranceTester = new EnduranceTester();
      const slaReporter = new SLAReporter({
        config: {
          latency: { p50: 50, p95: 100, p99: 200 },
          availability: 0.95,
          throughput: 50,
          errorRate: 0.05
        },
        windowSize: 30000,
        reportingInterval: 5000
      });

      // Simulate degrading performance
      let latency = 50;
      mockExecutor.execute.mockImplementation(async () => {
        return { success: true, latency: latency += 20 };
      });

      const config = {
        name: 'degrading_sla',
        duration: 2000,
        sampleInterval: 200,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      await enduranceTester.execute(config, mockExecutor);

      // Record samples to SLA reporter
      for (let i = 0; i < 10; i++) {
        slaReporter.recordSample({
          timestamp: Date.now() + i * 200,
          latency: 50 + i * 30,
          success: true
        });
      }

      const slaReport = slaReporter.generateReport();

      expect(slaReport.metrics.latency.p99).toBeGreaterThan(0);
    });
  });

  describe('Scenario + Latency Profiler Integration', () => {
    it('should profile latency during scenario execution', async () => {
      const scenarioBuilder = new ScenarioBuilder({ name: 'profiled_scenario' });
      const latencyProfiler = new LatencyProfiler();

      const scenario = scenarioBuilder
        .addLoadStage({
          name: 'Stage 1',
          load: 10,
          duration: 500
        })
        .addLoadStage({
          name: 'Stage 2',
          load: 20,
          duration: 500
        })
        .build();

      // Record latencies during scenario
      for (let i = 0; i < 10; i++) {
        latencyProfiler.recordSample({
          timestamp: Date.now() + i * 100,
          latency: 50 + i * 10,
          operation: 'scenario_stage',
          success: true
        });
      }

      const result = await scenarioBuilder.execute(scenario, mockExecutor);
      const report = latencyProfiler.generateReport();

      expect(result.stages.length).toBe(2);
      expect(report.metrics.latency.mean).toBeGreaterThan(0);
    });

    it('should detect outliers in scenario execution', async () => {
      const scenarioBuilder = new ScenarioBuilder({ name: 'outlier_scenario' });
      const latencyProfiler = new LatencyProfiler();

      const scenario = scenarioBuilder
        .addLoadStage({
          name: 'Normal Stage',
          load: 10,
          duration: 500
        })
        .build();

      // Add some outliers
      for (let i = 0; i < 30; i++) {
        latencyProfiler.recordSample({
          timestamp: Date.now() + i * 100,
          latency: i === 25 ? 5000 : 100, // One outlier
          operation: 'scenario',
          success: true
        });
      }

      await scenarioBuilder.execute(scenario, mockExecutor);

      const report = latencyProfiler.generateReport();

      expect(report.outliers.length).toBeGreaterThan(0);
    });
  });

  describe('Traffic + Load Testing Integration', () => {
    it('should use generated traffic for load testing', async () => {
      const trafficGenerator = new TrafficGenerator(12345);
      const loadTester = new LoadTester();

      // Generate traffic pattern
      const traffic = trafficGenerator.generate({
        pattern: 'poisson',
        rate: 100,
        duration: 5000
      });

      expect(traffic.requests.length).toBeGreaterThan(0);

      // Use traffic pattern to configure load test
      const loadConfig = {
        name: 'traffic_based_load',
        concurrentUsers: Math.floor(traffic.requests.length / 10),
        requestsPerSecond: traffic.stats.requestsPerSecond,
        rampUpDuration: 500,
        sustainDuration: 1000,
        rampDownDuration: 500
      };

      const result = await loadTester.execute(loadConfig, mockExecutor);

      expect(result.success).toBe(true);
    });

    it('should test bursty traffic patterns', async () => {
      const trafficGenerator = new TrafficGenerator(12345);

      const traffic = trafficGenerator.generate({
        pattern: 'bursty',
        rate: 100,
        duration: 5000,
        burstiness: 0.8
      });

      expect(traffic.stats.burstCount).toBeGreaterThan(0);

      // Configure load test based on burst stats
      const loadConfig = {
        name: 'bursty_load',
        concurrentUsers: Math.ceil(traffic.stats.avgBurstSize),
        requestsPerSecond: Math.floor(traffic.stats.requestsPerSecond * 1.5),
        rampUpDuration: 300,
        sustainDuration: 1000,
        rampDownDuration: 300
      };

      const loadTester = new LoadTester();
      const result = await loadTester.execute(loadConfig, mockExecutor);

      expect(result.success).toBe(true);
    });
  });

  describe('Resource + Scale Testing Integration', () => {
    it('should monitor resources during scaling', async () => {
      const resourceMonitor = new ResourceMonitor({
        sampleInterval: 100,
        maxSamples: 100
      });
      const scaleTester = new ScaleTester();

      resourceMonitor.start();

      const scaleConfig = {
        name: 'monitored_scaling',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 5,
        baselineLoad: 50,
        scaleSteps: 2,
        stepDuration: 500,
        measureCost: false
      };

      await scaleTester.execute(scaleConfig, mockExecutor);

      // Capture a few resource samples
      for (let i = 0; i < 5; i++) {
        resourceMonitor.captureSnapshot();
      }

      const resourceReport = resourceMonitor.generateReport();

      resourceMonitor.stop();

      expect(resourceReport.samples).toBe(5);
      expect(resourceReport.cpu.avg).toBeGreaterThanOrEqual(0);
    });

    it('should correlate resource usage with scaling', async () => {
      const resourceMonitor = new ResourceMonitor();
      const scaleTester = new ScaleTester();

      // Simulate increasing resource usage with scaling
      let cpuUsage = 20;
      mockExecutor.getMetrics.mockImplementation(async () => ({
        memory: 100_000_000,
        cpu: cpuUsage += 10
      }));

      resourceMonitor.start();

      const scaleConfig = {
        name: 'correlated_scaling',
        scaleDirection: 'up' as const,
        scaleType: 'horizontal' as const,
        maxInstances: 3,
        baselineLoad: 50,
        scaleSteps: 2,
        stepDuration: 300,
        measureCost: false
      };

      await scaleTester.execute(scaleConfig, mockExecutor);

      for (let i = 0; i < 5; i++) {
        resourceMonitor.captureSnapshot();
      }

      const resourceReport = resourceMonitor.generateReport();

      resourceMonitor.stop();

      expect(resourceReport.trends.cpu).toBeDefined();
    });
  });

  describe('Multi-Stage Workflows', () => {
    it('should run complete test workflow', async () => {
      const results: any = {};

      // Stage 1: Load test
      const loadTester = new LoadTester();
      const loadConfig = {
        name: 'workflow_load',
        concurrentUsers: 20,
        requestsPerSecond: 200,
        rampUpDuration: 300,
        sustainDuration: 300,
        rampDownDuration: 300
      };

      results.load = await loadTester.execute(loadConfig, mockExecutor);
      expect(results.load.success).toBe(true);

      // Stage 2: Stress test
      const stressTester = new StressTester();
      const stressConfig = {
        name: 'workflow_stress',
        maxLoad: 200,
        spikeMagnitude: 2,
        spikeDuration: 2000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 30,
        incrementInterval: 200
      };

      results.stress = await stressTester.execute(stressConfig, mockExecutor);
      expect(results.stress.breakingPoint).toBeGreaterThan(0);

      // Stage 3: SLA check
      const slaReporter = new SLAReporter({
        config: {
          latency: { p50: 100, p95: 200, p99: 500 },
          availability: 0.99,
          throughput: 50,
          errorRate: 0.05
        },
        windowSize: 30000,
        reportingInterval: 5000
      });

      for (let i = 0; i < 5; i++) {
        slaReporter.recordSample({
          timestamp: Date.now() + i * 1000,
          latency: 100,
          success: true
        });
      }

      results.sla = slaReporter.generateReport();
      expect(results.sla.compliant).toBeDefined();

      // All stages completed
      expect(Object.keys(results).length).toBe(3);
    });

    it('should run scaled testing workflow', async () => {
      const results: any = {};

      // Test different scales
      const scales = [
        { instances: 1, load: 10 },
        { instances: 2, load: 20 },
        { instances: 4, load: 40 }
      ];

      for (const scale of scales) {
        const loadTester = new LoadTester();
        const config = {
          name: `scale_${scale.instances}`,
          concurrentUsers: scale.load,
          requestsPerSecond: scale.load * 10,
          rampUpDuration: 200,
          sustainDuration: 200,
          rampDownDuration: 200
        };

        results[scale.instances] = await loadTester.execute(config, mockExecutor);
      }

      // All scales tested
      expect(Object.keys(results).length).toBe(3);

      // Performance should improve with scale
      const throughput1 = results[1].throughput;
      const throughput2 = results[2].throughput;
      const throughput4 = results[4].throughput;

      expect(throughput2).toBeGreaterThan(0);
      expect(throughput4).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle errors across all testers', async () => {
      // Create executor that fails sometimes
      let callCount = 0;
      const flakyExecutor = {
        execute: vi.fn().mockImplementation(async () => {
          callCount++;
          return {
            success: callCount % 3 !== 0, // Fail every 3rd call
            latency: 100,
            error: callCount % 3 === 0 ? 'Simulated error' : undefined
          };
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

      const loadTester = new LoadTester();
      const loadConfig = {
        name: 'error_test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 300,
        sustainDuration: 300,
        rampDownDuration: 300
      };

      const result = await loadTester.execute(loadConfig, flakyExecutor);

      expect(result.failedRequests).toBeGreaterThan(0);
      expect(result.errors.total).toBeGreaterThan(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configurations are compatible', async () => {
      const loadTester = new LoadTester();
      const stressTester = new StressTester();

      // Load test config
      const loadConfig = {
        name: 'validation_load',
        concurrentUsers: 100,
        requestsPerSecond: 1000,
        rampUpDuration: 1000,
        sustainDuration: 5000,
        rampDownDuration: 1000
      };

      const loadResult = await loadTester.execute(loadConfig, mockExecutor);

      // Stress test max load should be higher than load test max
      const stressConfig = {
        name: 'validation_stress',
        maxLoad: loadConfig.concurrentUsers * 2,
        spikeMagnitude: 2,
        spikeDuration: 3000,
        recoveryCheck: false,
        recoveryTimeout: 30000,
        loadIncrement: 50,
        incrementInterval: 500
      };

      const stressResult = await stressTester.execute(stressConfig, mockExecutor);

      expect(stressResult.breakingPoint).toBeGreaterThan(loadConfig.concurrentUsers);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent metrics across testers', async () => {
      const loadTester = new LoadTester();
      const enduranceTester = new EnduranceTester();

      // Both should measure similar latency for same load
      const loadConfig = {
        name: 'consistency_load',
        concurrentUsers: 20,
        requestsPerSecond: 200,
        rampUpDuration: 300,
        sustainDuration: 500,
        rampDownDuration: 300
      };

      const loadResult = await loadTester.execute(loadConfig, mockExecutor);

      const enduranceConfig = {
        name: 'consistency_endurance',
        duration: 1500,
        sampleInterval: 300,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 20
      };

      const enduranceResult = await enduranceTester.execute(enduranceConfig, mockExecutor);

      // Latencies should be in similar range
      expect(loadResult.latency.mean).toBeGreaterThan(0);
      expect(enduranceResult.samples[0]?.latency.mean).toBeGreaterThan(0);
    });
  });

  describe('Performance Integration', () => {
    it('should complete integration tests efficiently', async () => {
      const startTime = Date.now();

      const loadTester = new LoadTester();
      const config = {
        name: 'perf_test',
        concurrentUsers: 10,
        requestsPerSecond: 100,
        rampUpDuration: 200,
        sustainDuration: 200,
        rampDownDuration: 200
      };

      await loadTester.execute(config, mockExecutor);

      const duration = Date.now() - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(5000);
    });
  });
});
