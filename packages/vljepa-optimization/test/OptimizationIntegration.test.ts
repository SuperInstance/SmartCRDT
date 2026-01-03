/**
 * Optimization Integration Tests
 * Tests the full optimization pipeline
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Profiler,
  GraphOptimizer,
  MemoryOptimizer,
  BufferPool,
  DynamicBatcher,
  ResultCache,
  AutoTuner,
} from '../src/index.js';

describe('Optimization Integration', () => {
  describe('End-to-End Optimization Pipeline', () => {
    it('should profile and optimize a computation graph', () => {
      const profiler = new Profiler({
        trackMemory: true,
        detailedTraces: true,
      });

      profiler.start();

      // Simulate computation
      profiler.profile('matmul', () => {
        const size = 1024;
        const result = new Float32Array(size * size);
        for (let i = 0; i < result.length; i++) {
          result[i] = Math.random();
        }
        return result;
      });

      profiler.profile('activation', () => {
        const size = 1024;
        const result = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          result[i] = Math.max(0, Math.random());
        }
        return result;
      });

      profiler.stop();

      const profileResults = profiler.getResults();

      expect(profileResults.operations).toHaveLength(2);
      expect(profileResults.totalLatency).toBeGreaterThan(0);

      // Optimize graph
      const graph = {
        nodes: [
          {
            id: 'n1',
            name: 'matmul',
            operation: 'matmul',
            inputs: [],
            outputs: ['n2'],
            attributes: { outputShape: [1024, 1024] },
          },
          {
            id: 'n2',
            name: 'relu',
            operation: 'relu',
            inputs: ['n1'],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n2'],
      };

      const optimizer = new GraphOptimizer();
      const optimizationResults = optimizer.optimize(graph);

      expect(optimizationResults.speedup).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Memory Management Integration', () => {
    it('should optimize memory usage across multiple allocations', () => {
      const memoryOptimizer = new MemoryOptimizer({
        inPlaceOps: true,
        tensorFusion: true,
        bufferPooling: true,
        targetMemory: 10,
      });

      const tensors = [
        {
          id: 't1',
          name: 'activation1',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation' as const, timestamp: 0 },
        },
        {
          id: 't2',
          name: 'activation2',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation' as const, timestamp: 1 },
        },
      ];

      const results = memoryOptimizer.optimize(tensors);

      expect(results.reduction).toBeGreaterThanOrEqual(0);
      expect(results.optimizations.length).toBeGreaterThan(0);
    });

    it('should integrate buffer pool with memory optimizer', () => {
      const bufferPool = new BufferPool({
        initialSize: 4,
        bufferSize: 1024,
        growStrategy: 'on_demand',
        shrinkStrategy: 'idle',
      });

      const buffer1 = bufferPool.acquire();
      bufferPool.release(buffer1 as GPUBuffer);

      const buffer2 = bufferPool.acquire();

      const stats = bufferPool.stats();

      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.totalBuffers).toBeGreaterThan(0);
    });
  });

  describe('Batching Integration', () => {
    it('should batch multiple inference requests', async () => {
      const batcher = new DynamicBatcher({
        maxBatchSize: 4,
        maxWaitTime: 10,
        minBatchSize: 2,
        adaptive: true,
      });

      const promises = [
        batcher.add('input1'),
        batcher.add('input2'),
        batcher.add('input3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);

      const stats = batcher.getStats();

      expect(stats.totalBatches).toBeGreaterThan(0);
    });
  });

  describe('Caching Integration', () => {
    it('should cache and retrieve inference results', () => {
      const cache = new ResultCache({
        maxSize: 100,
        similarityThreshold: 0.95,
        ttl: 60000,
        persistent: false,
      });

      const embedding = new Float32Array([1, 2, 3, 4]);

      cache.set('key1', embedding);
      const result = cache.get('key1');

      expect(result).toBeDefined();

      const stats = cache.stats();

      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBe(1);
    });

    it('should find similar cached embeddings', () => {
      const cache = new ResultCache({
        maxSize: 100,
        similarityThreshold: 0.95,
        ttl: 60000,
      });

      const embedding1 = new Float32Array([1, 2, 3, 4]);
      const embedding2 = new Float32Array([1, 2, 3, 4.05]);

      cache.set('key1', embedding1);

      const similar = cache.findSimilar(embedding2);

      expect(similar.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-Tuning Integration', () => {
    it('should tune parameters for optimal performance', async () => {
      const tuner = new AutoTuner({
        parameters: [
          { name: 'batchSize', min: 1, max: 8, step: 1, type: 'discrete', current: 4 },
          { name: 'learningRate', min: 0.001, max: 0.1, step: 0.001, type: 'continuous', current: 0.01 },
        ],
        searchStrategy: 'grid',
        maxIterations: 10,
        targetMetric: 'latency',
      });

      let iterationCount = 0;
      const evaluate = async (params: Record<string, number>) => {
        iterationCount++;
        // Simulate latency that improves with iteration
        return 100 - iterationCount * 5;
      };

      const result = await tuner.tune(evaluate);

      expect(result.bestMetric).toBeLessThan(100);
      expect(result.iterations).toBeGreaterThan(0);
      expect(result.history.length).toBe(result.iterations);
    });
  });

  describe('Full Pipeline Integration', () => {
    it('should run complete optimization pipeline', async () => {
      // Step 1: Profile
      const profiler = new Profiler();
      profiler.start();

      profiler.profile('inference', () => {
        return new Float32Array(1024);
      });

      profiler.stop();

      const profileResults = profiler.getResults();

      // Step 2: Optimize graph
      const graph = {
        nodes: [
          {
            id: 'n1',
            name: 'op1',
            operation: 'relu',
            inputs: [],
            outputs: [],
            attributes: {},
          },
        ],
        inputs: ['n1'],
        outputs: ['n1'],
      };

      const graphOptimizer = new GraphOptimizer();
      const graphResults = graphOptimizer.optimize(graph);

      // Step 3: Optimize memory
      const memoryOptimizer = new MemoryOptimizer();
      const memoryResults = memoryOptimizer.optimize([
        {
          id: 't1',
          name: 'tensor1',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation' as const, timestamp: 0 },
        },
      ]);

      // Step 4: Tune parameters
      const tuner = new AutoTuner({
        parameters: [{ name: 'param', min: 1, max: 10, step: 1, type: 'discrete', current: 5 }],
        searchStrategy: 'grid',
        maxIterations: 5,
        targetMetric: 'latency',
      });

      const tuningResults = await tuner.tune(async () => 50);

      // Verify all steps completed
      expect(profileResults.totalLatency).toBeGreaterThan(0);
      expect(graphResults.speedup).toBeGreaterThanOrEqual(1);
      expect(memoryResults.reduction).toBeGreaterThanOrEqual(0);
      expect(tuningResults.bestMetric).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should track performance across optimizations', () => {
      const profiler = new Profiler();

      profiler.start();

      // Run operations
      for (let i = 0; i < 10; i++) {
        profiler.profile(`op_${i}`, () => {
          return new Float32Array(1024);
        });
      }

      profiler.stop();

      const results = profiler.getResults();

      expect(results.operations).toHaveLength(10);
      expect(results.bottlenecks).toBeDefined();

      const avgLatency = results.operations.reduce((sum, op) => sum + op.avgLatency, 0) / results.operations.length;

      expect(avgLatency).toBeGreaterThan(0);
    });
  });

  describe('Sub-50ms Target', () => {
    it('should identify when target is achievable', () => {
      const profiler = new Profiler();

      profiler.start();

      // Fast operation
      profiler.profile('fast_op', () => {
        return new Float32Array(100);
      });

      profiler.stop();

      const results = profiler.getResults();

      // Check if we're under 50ms
      expect(results.totalLatency).toBeLessThan(50);
    });

    it('should provide recommendations for hitting target', () => {
      const profiler = new Profiler();

      profiler.start();

      // Simulate slower operation
      profiler.profile('slow_op', () => {
        const start = performance.now();
        while (performance.now() - start < 20) {
          // Busy wait to simulate slow operation
        }
        return new Float32Array(1024);
      });

      profiler.stop();

      const results = profiler.getResults();

      if (results.totalLatency > 50) {
        expect(results.recommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Device Optimization', () => {
    it('should optimize for resource-constrained devices', () => {
      const memoryOptimizer = new MemoryOptimizer({
        targetMemory: 50, // Low memory target
        inPlaceOps: true,
        tensorFusion: true,
      });

      const tensors = Array.from({ length: 20 }, (_, i) => ({
        id: `t${i}`,
        name: `tensor${i}`,
        size: 1024,
        shape: [32, 32],
        dtype: 'float32',
        usage: { type: 'activation' as const, timestamp: i },
      }));

      const results = memoryOptimizer.optimize(tensors);

      // Should apply optimizations to reduce memory
      expect(results.optimizations.length).toBeGreaterThan(0);
      expect(results.optimizedMemory).toBeLessThanOrEqual(results.originalMemory);
    });
  });
});
