/**
 * Dynamic Batcher Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DynamicBatcher,
  StaticBatchStrategy,
  PriorityBatchStrategy,
  DeadlineBatchStrategy,
  RequestBatcher,
} from '../src/batching/DynamicBatcher.js';

describe('DynamicBatcher', () => {
  let batcher: DynamicBatcher;

  beforeEach(() => {
    batcher = new DynamicBatcher({
      maxBatchSize: 8,
      maxWaitTime: 10,
      minBatchSize: 2,
      adaptive: true,
      priority: true,
    });
  });

  describe('constructor', () => {
    it('should create batcher with default config', () => {
      const b = new DynamicBatcher();
      expect(b).toBeDefined();
    });

    it('should create batcher with custom config', () => {
      const b = new DynamicBatcher({ maxBatchSize: 16 });
      expect(b).toBeDefined();
    });
  });

  describe('add', () => {
    it('should add request to queue', async () => {
      const promise = batcher.add('test_input');

      expect(promise).toBeDefined();
      expect(promise).toBeInstanceOf(Promise);
    });

    it('should resolve with result', async () => {
      const result = await batcher.add('test_input');

      expect(result).toBeDefined();
    });

    it('should handle priority', async () => {
      const result = await batcher.add('test_input', 0.8);

      expect(result).toBeDefined();
    });

    it('should process multiple requests', async () => {
      const promises = [
        batcher.add('input1'),
        batcher.add('input2'),
        batcher.add('input3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
    });
  });

  describe('getQueueSize', () => {
    it('should return current queue size', () => {
      const size1 = batcher.getQueueSize();

      batcher.add('input1');
      const size2 = batcher.getQueueSize();

      expect(typeof size1).toBe('number');
      expect(typeof size2).toBe('number');
    });
  });

  describe('getStats', () => {
    it('should return batcher statistics', async () => {
      await batcher.add('input1');
      await batcher.add('input2');

      const stats = batcher.getStats();

      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('avgBatchSize');
      expect(stats).toHaveProperty('avgLatency');
      expect(stats).toHaveProperty('avgEfficiency');
      expect(stats).toHaveProperty('totalBatches');
      expect(stats).toHaveProperty('droppedRequests');
      expect(stats).toHaveProperty('adaptiveParams');
    });

    it('should track adaptive parameters', () => {
      const stats = batcher.getStats();

      expect(stats.adaptiveParams).toHaveProperty('targetBatchSize');
      expect(stats.adaptiveParams).toHaveProperty('targetWaitTime');
      expect(stats.adaptiveParams).toHaveProperty('loadFactor');
    });
  });

  describe('clear', () => {
    it('should clear queue and history', () => {
      batcher.add('input1');

      batcher.clear();

      const stats = batcher.getStats();

      expect(stats.queueSize).toBe(0);
    });
  });
});

describe('StaticBatchStrategy', () => {
  let strategy: StaticBatchStrategy;

  beforeEach(() => {
    strategy = new StaticBatchStrategy(8, 10);
  });

  describe('shouldBatch', () => {
    it('should always return true for static strategy', () => {
      const result = strategy.shouldBatch({
        id: 'test',
        input: 'data',
        priority: 0.5,
        timestamp: Date.now(),
        timeout: Date.now() + 5000,
      });

      expect(result).toBe(true);
    });
  });

  describe('createBatch', () => {
    it('should create input batch from requests', () => {
      const requests = [
        { id: 'r1', input: 'input1', priority: 0.5, timestamp: 100, timeout: 5000 },
        { id: 'r2', input: 'input2', priority: 0.5, timestamp: 200, timeout: 5000 },
      ];

      const batch = strategy.createBatch(requests);

      expect(batch.inputs).toHaveLength(2);
      expect(batch.ids).toHaveLength(2);
      expect(batch.timestamps).toHaveLength(2);
      expect(batch.priorities).toHaveLength(2);
    });
  });

  describe('estimateWaitTime', () => {
    it('should estimate wait time based on current size', () => {
      const waitTime = strategy.estimateWaitTime(5);

      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(10);
    });
  });
});

describe('PriorityBatchStrategy', () => {
  let strategy: PriorityBatchStrategy;

  beforeEach(() => {
    strategy = new PriorityBatchStrategy(8, 10, 0.5);
  });

  describe('shouldBatch', () => {
    it('should batch based on priority threshold', () => {
      const highPriority = strategy.shouldBatch({
        id: 'test',
        input: 'data',
        priority: 0.8,
        timestamp: Date.now(),
        timeout: Date.now() + 5000,
      });

      const lowPriority = strategy.shouldBatch({
        id: 'test',
        input: 'data',
        priority: 0.2,
        timestamp: Date.now(),
        timeout: Date.now() + 5000,
      });

      expect(highPriority).toBe(true);
      expect(lowPriority).toBe(false);
    });
  });

  describe('createBatch', () => {
    it('should sort by priority', () => {
      const requests = [
        { id: 'r1', input: 'input1', priority: 0.3, timestamp: 100, timeout: 5000 },
        { id: 'r2', input: 'input2', priority: 0.9, timestamp: 200, timeout: 5000 },
        { id: 'r3', input: 'input3', priority: 0.5, timestamp: 300, timeout: 5000 },
      ];

      const batch = strategy.createBatch(requests);

      expect(batch.inputs[0]).toBe('input2'); // Highest priority
    });
  });

  describe('estimateWaitTime', () => {
    it('should estimate lower wait time for high priority', () => {
      const waitTime = strategy.estimateWaitTime(0);

      expect(waitTime).toBeLessThan(10);
    });
  });
});

describe('DeadlineBatchStrategy', () => {
  let strategy: DeadlineBatchStrategy;

  beforeEach(() => {
    strategy = new DeadlineBatchStrategy(8, 10);
  });

  describe('shouldBatch', () => {
    it('should batch based on deadline', () => {
      const validRequest = {
        id: 'test',
        input: 'data',
        priority: 0.5,
        timestamp: Date.now(),
        timeout: Date.now() + 10000, // Far deadline
      };

      const urgentRequest = {
        id: 'test',
        input: 'data',
        priority: 0.5,
        timestamp: Date.now(),
        timeout: Date.now() + 5, // Very tight deadline
      };

      expect(strategy.shouldBatch(validRequest)).toBe(true);
      expect(strategy.shouldBatch(urgentRequest)).toBe(false);
    });
  });

  describe('createBatch', () => {
    it('should sort by deadline', () => {
      const now = Date.now();
      const requests = [
        { id: 'r1', input: 'input1', priority: 0.5, timestamp: now, timeout: now + 100 },
        { id: 'r2', input: 'input2', priority: 0.5, timestamp: now, timeout: now + 50 },
        { id: 'r3', input: 'input3', priority: 0.5, timestamp: now, timeout: now + 150 },
      ];

      const batch = strategy.createBatch(requests);

      // r2 has earliest deadline (lowest timeout value)
      expect(batch.ids[0]).toBe('r2');
    });
  });
});

describe('RequestBatcher', () => {
  let batcher: RequestBatcher;
  let mockProcessor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockProcessor = vi.fn().mockResolvedValue(['result1', 'result2']);
    const strategy = new StaticBatchStrategy(8, 10);
    batcher = new RequestBatcher(strategy, mockProcessor);
  });

  describe('add', () => {
    it('should add request to batch', async () => {
      const result = await batcher.add('batch1', 'input1');

      expect(result).toBeDefined();
    });

    it('should batch requests with same key', async () => {
      const promises = [
        batcher.add('batch1', 'input1'),
        batcher.add('batch1', 'input2'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(mockProcessor).toHaveBeenCalled();
    });

    it('should handle priority', async () => {
      const result = await batcher.add('batch1', 'input1', 0.8);

      expect(result).toBeDefined();
    });
  });

  describe('flush', () => {
    it('should flush all pending batches', async () => {
      batcher.add('batch1', 'input1');
      batcher.add('batch2', 'input2');

      await batcher.flush();

      expect(mockProcessor).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return batcher statistics', () => {
      batcher.add('batch1', 'input1');

      const stats = batcher.getStats();

      expect(stats).toHaveProperty('pendingBatches');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('avgBatchSize');
    });

    it('should calculate average batch size', () => {
      batcher.add('batch1', 'input1');
      batcher.add('batch1', 'input2');
      batcher.add('batch2', 'input3');

      const stats = batcher.getStats();

      expect(stats.avgBatchSize).toBeGreaterThan(0);
    });
  });
});
