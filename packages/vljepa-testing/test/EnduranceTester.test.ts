/**
 * EnduranceTester Tests
 * Tests for endurance testing and memory leak detection.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EnduranceTester, MemoryLeakDetector, StabilityTester } from '../src/index.js';

describe('EnduranceTester', () => {
  let enduranceTester: EnduranceTester;
  let mockExecutor: any;

  beforeEach(() => {
    enduranceTester = new EnduranceTester();
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      }),
      healthCheck: vi.fn().mockResolvedValue(true),
      getMetrics: vi.fn().mockResolvedValue({
        memory: 100_000_000,
        cpu: 50
      })
    };
  });

  afterEach(() => {
    enduranceTester.cancel();
  });

  describe('Initialization', () => {
    it('should initialize endurance tester', () => {
      expect(enduranceTester).toBeInstanceOf(EnduranceTester);
    });

    it('should have memory leak detector', () => {
      const detector = enduranceTester.getMemoryLeakDetector();
      expect(detector).toBeInstanceOf(MemoryLeakDetector);
    });
  });

  describe('Endurance Test Execution', () => {
    it('should execute short endurance test', async () => {
      const config = {
        name: 'test',
        duration: 5000,
        sampleInterval: 1000,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      expect(result.success).toBe(true);
      expect(result.samples.length).toBeGreaterThan(0);
    });

    it('should collect samples throughout test', async () => {
      const config = {
        name: 'test',
        duration: 5000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 5
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      expect(result.samples.length).toBeGreaterThan(5);
    });

    it('should calculate degradation', async () => {
      const config = {
        name: 'test',
        duration: 3000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      expect(result.degradation).toBeGreaterThanOrEqual(0);
    });

    it('should determine stability', async () => {
      const config = {
        name: 'test',
        duration: 3000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      expect(result.stable).toBeDefined();
    });

    it('should generate recommendation', async () => {
      const config = {
        name: 'test',
        duration: 3000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      expect(result.recommendation).toBeDefined();
      expect(result.recommendation.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect memory leaks', async () => {
      // Simulate memory growth
      let memCount = 0;
      mockExecutor.getMetrics.mockImplementation(async () => ({
        memory: 100_000_000 + memCount++ * 10_000_000,
        cpu: 50
      }));

      const config = {
        name: 'test',
        duration: 5000,
        sampleInterval: 500,
        memoryThreshold: 100,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      expect(result.memoryLeaks).toBeDefined();
    });

    it('should report no leaks when stable', async () => {
      mockExecutor.getMetrics.mockResolvedValue({
        memory: 100_000_000,
        cpu: 50
      });

      const config = {
        name: 'test',
        duration: 3000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      // Should not have leaks or have low confidence
      const hasHighConfidenceLeak = result.memoryLeaks.some(
        m => m.detected && m.confidence > 0.7
      );
      expect(hasHighConfidenceLeak).toBe(false);
    });
  });

  describe('Progress Tracking', () => {
    it('should report progress during test', async () => {
      const config = {
        name: 'test',
        duration: 3000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      // Start test without waiting
      const testPromise = enduranceTester.execute(config, mockExecutor);

      // Check progress
      await new Promise(resolve => setTimeout(resolve, 100));
      const progress = enduranceTester.getProgress(config);

      expect(progress.elapsed).toBeGreaterThan(0);
      expect(progress.remaining).toBeGreaterThanOrEqual(0);
      expect(progress.progress).toBeGreaterThan(0);
      expect(progress.progress).toBeLessThanOrEqual(1);

      await testPromise;
    });
  });

  describe('Cancellation', () => {
    it('should cancel running test', async () => {
      const config = {
        name: 'test',
        duration: 10000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      // Start test
      const testPromise = enduranceTester.execute(config, mockExecutor);

      // Cancel after short delay
      await new Promise(resolve => setTimeout(resolve, 500));
      enduranceTester.cancel();

      const result = await testPromise;

      expect(result).toBeDefined();
      expect(result.duration).toBeLessThan(config.duration);
    });
  });

  describe('Sample Collection', () => {
    it('should collect samples with latency metrics', async () => {
      const config = {
        name: 'test',
        duration: 2000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      for (const sample of result.samples) {
        expect(sample.timestamp).toBeGreaterThan(0);
        expect(sample.latency).toBeDefined();
        expect(sample.latency.mean).toBeGreaterThan(0);
        expect(sample.latency.p50).toBeGreaterThan(0);
        expect(sample.latency.p95).toBeGreaterThan(0);
      }
    });

    it('should track throughput', async () => {
      const config = {
        name: 'test',
        duration: 2000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      for (const sample of result.samples) {
        expect(sample.throughput).toBeGreaterThan(0);
      }
    });

    it('should track errors', async () => {
      mockExecutor.execute
        .mockResolvedValueOnce({ success: false, latency: 100 })
        .mockImplementation(async () => ({ success: true, latency: 100 }));

      const config = {
        name: 'test',
        duration: 2000,
        sampleInterval: 500,
        memoryThreshold: 1000,
        degradationThreshold: 20,
        stabilityThreshold: 0.5,
        loadLevel: 10
      };

      const result = await enduranceTester.execute(config, mockExecutor);

      const sampleWithErrors = result.samples.find(s => s.errors > 0);
      expect(sampleWithErrors).toBeDefined();
    });
  });
});

describe('MemoryLeakDetector', () => {
  let detector: MemoryLeakDetector;

  beforeEach(() => {
    detector = new MemoryLeakDetector({
      sampleInterval: 100,
      thresholdMB: 100,
      growthRateThreshold: 10,
      minSamples: 5
    });
  });

  afterEach(() => {
    detector.stop();
  });

  describe('Initialization', () => {
    it('should initialize with config', () => {
      expect(detector).toBeInstanceOf(MemoryLeakDetector);
    });

    it('should have default config', () => {
      const defaultDetector = new MemoryLeakDetector();
      expect(defaultDetector).toBeInstanceOf(MemoryLeakDetector);
    });
  });

  describe('Memory Monitoring', () => {
    it('should start monitoring', () => {
      detector.start();
      expect(detector).toBeDefined();
    });

    it('should stop monitoring', () => {
      detector.start();
      detector.stop();
      expect(detector).toBeDefined();
    });

    it('should capture snapshots', () => {
      const snapshot = detector.captureSnapshot();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.heapUsed).toBeGreaterThan(0);
      expect(snapshot.heapTotal).toBeGreaterThan(0);
      expect(snapshot.rss).toBeGreaterThan(0);
    });

    it('should collect multiple snapshots', () => {
      detector.start();

      const snapshots = [];
      for (let i = 0; i < 5; i++) {
        snapshots.push(detector.captureSnapshot());
      }

      expect(snapshots.length).toBe(5);
      expect(snapshots[0].timestamp).toBeLessThan(snapshots[4].timestamp);

      detector.stop();
    });
  });

  describe('Leak Analysis', () => {
    it('should detect no leak with stable memory', () => {
      detector.start();

      // Capture stable memory samples
      for (let i = 0; i < 10; i++) {
        detector.captureSnapshot();
      }

      const result = detector.analyze();

      expect(result.hasLeak).toBe(false);
      expect(result.confidence).toBeGreaterThanOrEqual(0);

      detector.stop();
    });

    it('should calculate trend', () => {
      detector.start();

      for (let i = 0; i < 10; i++) {
        detector.captureSnapshot();
      }

      const result = detector.analyze();

      expect(['increasing', 'stable', 'decreasing', 'unknown']).toContain(result.trend);

      detector.stop();
    });

    it('should calculate leak rate', () => {
      detector.start();

      for (let i = 0; i < 10; i++) {
        detector.captureSnapshot();
      }

      const result = detector.analyze();

      expect(result.leakRate).toBeGreaterThanOrEqual(0);

      detector.stop();
    });

    it('should generate recommendation', () => {
      detector.start();

      for (let i = 0; i < 10; i++) {
        detector.captureSnapshot();
      }

      const result = detector.analyze();

      expect(result.recommendation).toBeDefined();
      expect(result.recommendation.length).toBeGreaterThan(0);

      detector.stop();
    });
  });

  describe('Statistics', () => {
    it('should get memory statistics', () => {
      detector.start();

      for (let i = 0; i < 10; i++) {
        detector.captureSnapshot();
      }

      const stats = detector.getStats();

      expect(stats.currentHeap).toBeGreaterThan(0);
      expect(stats.peakHeap).toBeGreaterThan(0);
      expect(stats.avgHeap).toBeGreaterThan(0);
      expect(stats.minHeap).toBeGreaterThan(0);
      expect(stats.totalGrowth).toBeGreaterThanOrEqual(0);

      detector.stop();
    });

    it('should export snapshots as CSV', () => {
      detector.start();

      for (let i = 0; i < 5; i++) {
        detector.captureSnapshot();
      }

      const csv = detector.exportCSV();

      expect(csv).toContain('timestamp');
      expect(csv).toContain('heapUsed');
      expect(csv).split('\n').length).toBeGreaterThan(5);

      detector.stop();
    });
  });

  describe('Edge Cases', () => {
    it('should handle insufficient samples', () => {
      const result = detector.analyze();

      expect(result.hasLeak).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should clear snapshots', () => {
      detector.start();

      for (let i = 0; i < 5; i++) {
        detector.captureSnapshot();
      }

      expect(detector.getSnapshots().length).toBeGreaterThan(0);

      detector.clear();

      expect(detector.getSnapshots().length).toBe(0);

      detector.stop();
    });
  });
});

describe('StabilityTester', () => {
  let stabilityTester: StabilityTester;
  let mockExecutor: any;

  beforeEach(() => {
    stabilityTester = new StabilityTester();
    mockExecutor = {
      execute: vi.fn().mockResolvedValue({
        success: true,
        latency: 100
      }),
      healthCheck: vi.fn().mockResolvedValue(true),
      getMetrics: vi.fn().mockResolvedValue({
        memory: 100_000_000,
        cpu: 50
      })
    };
  });

  describe('Stability Testing', () => {
    it('should execute stability test', async () => {
      const config = {
        duration: 3000,
        sampleInterval: 500,
        driftThreshold: 0.5,
        varianceThreshold: 0.5,
        healthCheckInterval: 1000
      };

      const result = await stabilityTester.execute(config, mockExecutor);

      expect(result.stable).toBeDefined();
      expect(result.samples.length).toBeGreaterThan(0);
    });

    it('should calculate drift score', async () => {
      const config = {
        duration: 3000,
        sampleInterval: 500,
        driftThreshold: 0.5,
        varianceThreshold: 0.5,
        healthCheckInterval: 1000
      };

      const result = await stabilityTester.execute(config, mockExecutor);

      expect(result.driftScore).toBeGreaterThanOrEqual(0);
    });

    it('should calculate variance score', async () => {
      const config = {
        duration: 3000,
        sampleInterval: 500,
        driftThreshold: 0.5,
        varianceThreshold: 0.5,
        healthCheckInterval: 1000
      };

      const result = await stabilityTester.execute(config, mockExecutor);

      expect(result.varianceScore).toBeGreaterThanOrEqual(0);
    });

    it('should calculate health score', async () => {
      const config = {
        duration: 3000,
        sampleInterval: 500,
        driftThreshold: 0.5,
        varianceThreshold: 0.5,
        healthCheckInterval: 1000
      };

      const result = await stabilityTester.execute(config, mockExecutor);

      expect(result.healthScore).toBeGreaterThanOrEqual(0);
      expect(result.healthScore).toBeLessThanOrEqual(1);
    });

    it('should calculate overall stability score', async () => {
      const config = {
        duration: 3000,
        sampleInterval: 500,
        driftThreshold: 0.5,
        varianceThreshold: 0.5,
        healthCheckInterval: 1000
      };

      const result = await stabilityTester.execute(config, mockExecutor);

      expect(result.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.stabilityScore).toBeLessThanOrEqual(1);
    });

    it('should analyze trends', async () => {
      const config = {
        duration: 3000,
        sampleInterval: 500,
        driftThreshold: 0.5,
        varianceThreshold: 0.5,
        healthCheckInterval: 1000
      };

      const result = await stabilityTester.execute(config, mockExecutor);

      expect(result.trends).toBeDefined();
    });

    it('should generate recommendations', async () => {
      const config = {
        duration: 3000,
        sampleInterval: 500,
        driftThreshold: 0.5,
        varianceThreshold: 0.5,
        healthCheckInterval: 1000
      };

      const result = await stabilityTester.execute(config, mockExecutor);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Health Checks', () => {
    it('should perform health checks', async () => {
      const config = {
        duration: 2000,
        sampleInterval: 500,
        driftThreshold: 0.5,
        varianceThreshold: 0.5,
        healthCheckInterval: 500
      };

      await stabilityTester.execute(config, mockExecutor);

      expect(mockExecutor.healthCheck).toHaveBeenCalled();
    });

    it('should handle health check failures', async () => {
      mockExecutor.healthCheck.mockResolvedValue(false);

      const config = {
        duration: 2000,
        sampleInterval: 500,
        driftThreshold: 0.5,
        varianceThreshold: 0.5,
        healthCheckInterval: 500
      };

      const result = await stabilityTester.execute(config, mockExecutor);

      expect(result.healthScore).toBeLessThan(1);
    });
  });
});
