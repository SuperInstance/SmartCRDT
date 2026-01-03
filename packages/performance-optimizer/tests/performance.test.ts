import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PerformanceOptimizer } from '../src/PerformanceOptimizer.js';
import { PerformanceProfiler } from '../src/profiler/index.js';
import { BottleneckDetector } from '../src/optimizer/BottleneckDetector.js';
import { OptimizationSuggestionEngine } from '../src/optimizer/OptimizationSuggestionEngine.js';

describe('Performance Optimization Suite', () => {
  let optimizer: PerformanceOptimizer;

  beforeAll(async () => {
    optimizer = new PerformanceOptimizer({
      enableCpuProfiling: true,
      enableMemoryProfiling: true,
      bottleneckSensitivity: 5,
      suggestionPriorityThreshold: 3,
      maxSuggestions: 10
    });
  });

  afterAll(async () => {
    await optimizer.shutdown();
  });

  describe('PerformanceOptimizer', () => {
    it('should initialize with correct configuration', () => {
      const status = optimizer.getStatus();
      expect(status.isActive).toBe(false);
      expect(status.config.enableCpuProfiling).toBe(true);
      expect(status.config.enableMemoryProfiling).toBe(true);
    });

    it('should start and stop operations', async () => {
      await optimizer.startOperation('test-operation');

      const status = optimizer.getStatus();
      expect(status.isActive).toBe(true);
      expect(status.activeOperations).toContain('test-operation');

      const stopResult = await optimizer.stopOperation('test-operation');
      expect(stopResult.report.reportId).toBeDefined();
      expect(stopResult.duration).toBeGreaterThan(0);
    });

    it('should profile operations and generate reports', async () => {
      // Simulate a CPU-intensive operation
      const cpuIntensiveOperation = async () => {
        let result = 0;
        for (let i = 0; i < 1000000; i++) {
          result += Math.sqrt(i);
        }
        return result;
      };

      await optimizer.startOperation('cpu-test');

      const { report } = await optimizer.profileOperation(
        'cpu-test',
        cpuIntensiveOperation
      );

      expect(report.reportId).toBeDefined();
      expect(report.overallScore).toBeGreaterThan(0);
      expect(report.metrics.latency.average).toBeGreaterThan(0);
      expect(report.bottlenecks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle failed operations gracefully', async () => {
      const failingOperation = async () => {
        throw new Error('Test failure');
      };

      await optimizer.startOperation('failing-test');

      const { report } = await optimizer.profileOperation(
        'failing-test',
        failingOperation
      );

      expect(report.reportId).toBeDefined();
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.suggestions.length).toBeGreaterThan(0);
    });

    it('should generate optimization suggestions', async () => {
      // Create a mock bottleneck
      const mockBottleneck = {
        type: 'cpu' as const,
        severity: 8,
        description: 'High CPU usage',
        impact: 0.8,
        confidence: 0.9,
        metrics: { usage: 95 }
      };

      // Update the suggestion engine to use our mock
      const suggestionEngine = new OptimizationSuggestionEngine({
        enableCpuProfiling: true,
        enableMemoryProfiling: true,
        bottleneckSensitivity: 5,
        suggestionPriorityThreshold: 1,
        maxSuggestions: 10
      });

      const suggestions = suggestionEngine.generateSuggestions([mockBottleneck]);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('architecture');
      expect(suggestions[0].priority).toBeGreaterThan(0);
    });
  });

  describe('PerformanceProfiler', () => {
    it('should capture memory snapshots', () => {
      const profiler = new PerformanceProfiler();
      profiler.start('test');

      const snapshot = profiler.captureMemorySnapshot('test');
      expect(snapshot.heapUsed).toBeGreaterThan(0);
      expect(snapshot.heapTotal).toBeGreaterThan(0);
      expect(snapshot.operationName).toBe('test');
    });

    it('should capture CPU snapshots', () => {
      const profiler = new PerformanceProfiler();
      profiler.start('test');

      const snapshot = profiler.captureCpuSnapshot('test');
      expect(snapshot.cpuUsage).toBeGreaterThanOrEqual(0);
      expect(snapshot.operationName).toBe('test');
    });

    it('should record latency measurements', () => {
      const profiler = new PerformanceProfiler();
      profiler.start('test');

      profiler.recordLatency('test', 100, { processing: 80, io: 20 });

      const latencyReport = profiler.generateLatencyReport('test');
      expect(latencyReport.average).toBe(100);
      expect(latencyReport.breakdown.processing).toBe(80);
      expect(latencyReport.breakdown.io).toBe(20);
    });

    it('should detect memory leaks', async () => {
      // Simulate memory leak by creating objects
      const profiler = new PerformanceProfiler();
      await profiler.start('memory-leak-test');

      // Capture initial snapshot
      profiler.captureMemorySnapshot('memory-leak-test');

      // Simulate memory growth
      const leakyArray: any[] = [];
      for (let i = 0; i < 100000; i++) {
        leakyArray.push(new Array(1000).fill('memory'));
      }

      // Capture final snapshot
      profiler.captureMemorySnapshot('memory-leak-test');

      const memoryReport = profiler.generateMemoryReport('memory-leak-test');
      expect(memoryReport.growth).toBeGreaterThan(0);
    });
  });

  describe('BottleneckDetector', () => {
    it('should detect CPU bottlenecks', () => {
      const detector = new BottleneckDetector();
      detector.setSensitivity(5);

      const cpuMetrics = {
        usage: 95,
        cores: 8,
        breakdown: { user: 70, system: 20, idle: 5, iowait: 5 },
        spikes: [
          { timestamp: Date.now(), usage: 98, duration: 1000 }
        ]
      };

      const bottlenecks = detector.detectBottlenecks(cpuMetrics, null, null);
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].type).toBe('cpu');
      expect(bottlenecks[0].severity).toBeGreaterThan(5);
    });

    it('should detect memory bottlenecks', () => {
      const detector = new BottleneckDetector();
      detector.setSensitivity(5);

      const memoryMetrics = {
        heapUsed: 800,
        heapTotal: 1024,
        external: 200,
        rss: 900,
        history: [],
        leak: {
          suspected: true,
          ratePerMinute: 2.5,
          suspiciousObjects: ['Buffer']
        }
      };

      const bottlenecks = detector.detectBottlenecks(null, memoryMetrics, null);
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks.some(b => b.type === 'memory')).toBe(true);
    });

    it('should detect latency bottlenecks', () => {
      const detector = new BottleneckDetector();
      detector.setSensitivity(5);

      const latencyMetrics = {
        total: 500,
        queue: 100,
        processing: 200,
        io: 150,
        network: 50,
        p50: 300,
        p90: 600,
        p95: 700,
        p99: 900,
        stdDev: 200
      };

      const bottlenecks = detector.detectBottlenecks(null, null, latencyMetrics);
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks.some(b => b.type === 'io')).toBe(true);
    });

    it('should analyze trends', () => {
      const detector = new BottleneckDetector();

      // Add some history
      detector.detectBottlenecks(
        { usage: 70, cores: 8, breakdown: { user: 50, system: 20, idle: 25, iowait: 5 }, spikes: [] },
        { heapUsed: 500, heapTotal: 1024, external: 100, rss: 600, history: [], leak: undefined },
        { total: 100, queue: 20, processing: 50, io: 30, network: 0, p50: 80, p90: 120, p95: 150, p99: 200, stdDev: 30 }
      );

      const trends = detector.analyzeTrends();
      expect(trends.trends).toBeDefined();
      expect(trends.recommendations).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should end-to-end profile an operation and generate complete report', async () => {
      // Create an operation that tests multiple aspects
      const complexOperation = async () => {
        // CPU intensive
        let cpuResult = 0;
        for (let i = 0; i < 500000; i++) {
          cpuResult += Math.sin(i);
        }

        // Memory allocation
        const data = new Array(10000).fill({ value: cpuResult });

        // Simulate I/O
        await new Promise(resolve => setTimeout(resolve, 10));

        return data.length;
      };

      await optimizer.startOperation('integration-test');

      const { report } = await optimizer.profileOperation(
        'integration-test',
        complexOperation
      );

      // Verify the report is complete
      expect(report.reportId).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Number);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);

      // Verify metrics are present
      expect(report.metrics.cpu).toBeDefined();
      expect(report.metrics.memory).toBeDefined();
      expect(report.metrics.latency).toBeDefined();

      // Verify latency has percentiles
      expect(report.metrics.latency.p50).toBeGreaterThanOrEqual(0);
      expect(report.metrics.latency.p90).toBeGreaterThanOrEqual(0);
      expect(report.metrics.latency.p95).toBeGreaterThanOrEqual(0);
      expect(report.metrics.latency.p99).toBeGreaterThanOrEqual(0);

      // Report should have at least one bottleneck or suggestion
      expect(report.bottlenecks.length + report.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle concurrent operations', async () => {
      const operations = [];

      // Start multiple operations
      for (let i = 0; i < 3; i++) {
        operations.push(optimizer.startOperation(`concurrent-${i}`));
      }

      await Promise.all(operations);

      // Verify all are active
      const status = optimizer.getStatus();
      expect(status.activeOperations.length).toBe(3);

      // Stop all operations
      const stopOperations = status.activeOperations.map(name =>
        optimizer.stopOperation(name)
      );

      const results = await Promise.all(stopOperations);
      expect(results.length).toBe(3);

      // Verify all stopped
      expect(optimizer.getStatus().activeOperations.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when starting duplicate operation', async () => {
      await optimizer.startOperation('duplicate-test');

      await expect(optimizer.startOperation('duplicate-test'))
        .rejects.toThrow('Operation already in progress');
    });

    it('should throw error when stopping non-existent operation', async () => {
      await expect(optimizer.stopOperation('non-existent'))
        .rejects.toThrow('Operation not found');
    });

    it('should handle invalid configuration', () => {
      expect(() => {
        new PerformanceOptimizer({
          enableCpuProfiling: 'invalid' as any
        });
      }).not.toThrow();
    });
  });

  describe('Performance Targets', () => {
    it('should calculate performance score based on targets', async () => {
      // Create custom config with strict targets
      const strictOptimizer = new PerformanceOptimizer({
        targets: {
          latencyTarget: 50, // Very strict
          memoryTarget: 100, // Very strict
          cpuTarget: 30, // Very strict
          errorRateTarget: 0.1 // Very strict
        }
      });

      const fastOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'fast';
      };

      await strictOptimizer.startOperation('fast-test');

      const { report } = await strictOptimizer.profileOperation(
        'fast-test',
        fastOperation
      );

      // Should have high score since operation is fast
      expect(report.overallScore).toBeGreaterThan(50);

      await strictOptimizer.shutdown();
    });
  });
});