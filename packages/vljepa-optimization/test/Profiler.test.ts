/**
 * Profiler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Profiler, ProfilerState, BottleneckAnalyzer } from '../src/profilers/Profiler.js';

describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler({
      trackMemory: true,
      trackGPU: false,
      samplingRate: 100,
      detailedTraces: true,
      enableStackTraces: true,
      maxTraceDepth: 10,
    });
  });

  describe('constructor', () => {
    it('should create profiler with default config', () => {
      const p = new Profiler();
      expect(p).toBeDefined();
    });

    it('should create profiler with custom config', () => {
      const p = new Profiler({ trackMemory: false, trackGPU: true });
      expect(p).toBeDefined();
    });
  });

  describe('start and stop', () => {
    it('should start profiling session', () => {
      profiler.start();
      expect(profiler['enabled']).toBe(true);
    });

    it('should stop profiling session', () => {
      profiler.start();
      profiler.stop();
      expect(profiler['enabled']).toBe(false);
    });

    it('should record start and end times', () => {
      profiler.start();
      const start = profiler['startTime'];
      expect(start).toBeGreaterThan(0);

      // Simulate some work
      profiler.profile('test_op', () => {
        // no-op
      });

      profiler.stop();
      const end = profiler['endTime'];
      expect(end).toBeGreaterThan(start);
    });
  });

  describe('profile', () => {
    it('should profile synchronous operation', () => {
      profiler.start();

      profiler.profile('test_op', () => {
        // Synchronous operation
      });

      profiler.stop();

      const results = profiler.getResults();
      expect(results.operations).toHaveLength(1);
      expect(results.operations[0].name).toBe('test_op');
    });

    it('should profile async operation', async () => {
      profiler.start();

      await profiler.profile('async_op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      profiler.stop();

      const results = profiler.getResults();
      expect(results.operations).toHaveLength(1);
      expect(results.operations[0].name).toBe('async_op');
      expect(results.operations[0].latency).toBeGreaterThan(0);
    });

    it('should return operation result', () => {
      profiler.start();

      const result = profiler.profile('compute', () => {
        return 42;
      });

      profiler.stop();

      expect(result).toBe(42);
    });

    it('should return async operation result', async () => {
      profiler.start();

      const result = await profiler.profile('async_compute', async () => {
        return 42;
      });

      profiler.stop();

      expect(result).toBe(42);
    });

    it('should handle errors in operations', () => {
      profiler.start();

      expect(() => {
        profiler.profile('failing_op', () => {
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      profiler.stop();

      const results = profiler.getResults();
      expect(results.operations).toHaveLength(1);
    });

    it('should handle errors in async operations', async () => {
      profiler.start();

      await expect(
        profiler.profile('failing_async_op', async () => {
          throw new Error('Async error');
        })
      ).rejects.toThrow('Async error');

      profiler.stop();

      const results = profiler.getResults();
      expect(results.operations).toHaveLength(1);
    });

    it('should not profile when disabled', () => {
      const result = profiler.profile('disabled_op', () => 42);

      expect(result).toBe(42);

      const results = profiler.getResults();
      expect(results.operations).toHaveLength(0);
    });

    it('should profile multiple operations', () => {
      profiler.start();

      profiler.profile('op1', () => {});
      profiler.profile('op2', () => {});
      profiler.profile('op3', () => {});

      profiler.stop();

      const results = profiler.getResults();
      expect(results.operations).toHaveLength(3);
    });
  });

  describe('getResults', () => {
    it('should return profile results', () => {
      profiler.start();

      profiler.profile('op1', () => {});
      profiler.profile('op2', () => {});

      profiler.stop();

      const results = profiler.getResults();
      expect(results).toHaveProperty('operations');
      expect(results).toHaveProperty('totalLatency');
      expect(results).toHaveProperty('bottlenecks');
      expect(results).toHaveProperty('recommendations');
      expect(results).toHaveProperty('metadata');
    });

    it('should calculate total latency correctly', () => {
      profiler.start();

      profiler.profile('op1', () => {});
      profiler.profile('op2', () => {});

      profiler.stop();

      const results = profiler.getResults();
      expect(results.totalLatency).toBeGreaterThan(0);
    });

    it('should identify bottlenecks', () => {
      profiler.start();

      // Simulate a slow operation
      profiler.profile('slow_op', () => {
        const start = performance.now();
        while (performance.now() - start < 5) {
          // Busy wait
        }
      });

      profiler.profile('fast_op', () => {});

      profiler.stop();

      const results = profiler.getResults();
      expect(results.bottlenecks.length).toBeGreaterThan(0);
    });

    it('should generate recommendations', () => {
      profiler.start();

      profiler.profile('op', () => {});

      profiler.stop();

      const results = profiler.getResults();
      expect(results.recommendations).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset profiler state', () => {
      profiler.start();

      profiler.profile('op', () => {});

      profiler.stop();

      profiler.reset();

      expect(profiler['operations'].size).toBe(0);
      expect(profiler['memorySnapshots']).toHaveLength(0);
      expect(profiler['callStack']).toHaveLength(0);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      profiler.start();

      const state = profiler.getState();

      expect(state).toHaveProperty('enabled');
      expect(state).toHaveProperty('duration');
      expect(state).toHaveProperty('operationCount');
      expect(state.enabled).toBe(true);

      profiler.stop();
    });

    it('should return disabled state when not started', () => {
      const state = profiler.getState();

      expect(state.enabled).toBe(false);
    });
  });
});

describe('BottleneckAnalyzer', () => {
  let profiler: Profiler;
  let analyzer: BottleneckAnalyzer;

  beforeEach(() => {
    profiler = new Profiler();
    analyzer = new BottleneckAnalyzer(profiler);
  });

  describe('getTopBottlenecks', () => {
    it('should return top N bottlenecks', () => {
      profiler.start();

      // Create operations with varying latencies
      profiler.profile('fast_op', () => {});
      profiler.profile('slow_op', () => {
        const start = performance.now();
        while (performance.now() - start < 5) {}
      });

      profiler.stop();

      const topBottlenecks = analyzer.getTopBottlenecks(2);

      expect(topBottlenecks).toBeDefined();
      expect(topBottlenecks.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array if no bottlenecks', () => {
      profiler.start();
      profiler.stop();

      const topBottlenecks = analyzer.getTopBottlenecks(5);

      expect(topBottlenecks).toHaveLength(0);
    });
  });

  describe('getBottlenecksBySeverity', () => {
    it('should filter bottlenecks by severity', () => {
      profiler.start();

      profiler.profile('op', () => {});

      profiler.stop();

      const critical = analyzer.getBottlenecksBySeverity('critical');
      const high = analyzer.getBottlenecksBySeverity('high');

      expect(critical).toBeDefined();
      expect(high).toBeDefined();
    });
  });

  describe('getOptimizationRoadmap', () => {
    it('should generate optimization roadmap', () => {
      profiler.start();

      profiler.profile('op1', () => {});
      profiler.profile('op2', () => {});

      profiler.stop();

      const roadmap = analyzer.getOptimizationRoadmap();

      expect(roadmap).toHaveProperty('currentLatency');
      expect(roadmap).toHaveProperty('targetLatency');
      expect(roadmap).toHaveProperty('potentialLatency');
      expect(roadmap).toHaveProperty('potentialSpeedup');
      expect(roadmap).toHaveProperty('bottlenecks');
      expect(roadmap).toHaveProperty('recommendations');
      expect(roadmap).toHaveProperty('priority');
    });

    it('should set priority based on latency', () => {
      profiler.start();

      // Very slow operation
      profiler.profile('slow_op', () => {
        const start = performance.now();
        while (performance.now() - start < 50) {}
      });

      profiler.stop();

      const roadmap = analyzer.getOptimizationRoadmap();

      expect(roadmap.priority).toBeDefined();
    });
  });
});
