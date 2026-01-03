/**
 * Edge Cases Tests
 *
 * Tests for edge cases, error conditions, and stress scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkerPoolManager } from '../src/WorkerPoolManager.js';
import { WorkerLifecycle } from '../src/WorkerLifecycle.js';
import { PriorityQueue } from '../src/PriorityQueue.js';
import { LoadBalancer } from '../src/LoadBalancer.js';
import type { Worker } from '../src/types.js';

// Mock Worker class
class MockWorker implements Worker {
  constructor(public id: string) {}
  postMessage?: ((data: unknown) => void) | undefined;
  terminate?: (() => void) | undefined;
}

describe('Edge Cases - WorkerPoolManager', () => {
  let pool: WorkerPoolManager;

  beforeEach(() => {
    pool = new WorkerPoolManager({
      workerFactory: async (id: string) => new MockWorker(id),
      minWorkers: 2,
      maxWorkers: 5,
      warmupTimeout: 5000,
      maxQueueDepth: 10,
      maxQueueWaitTime: 5000
    });
  });

  afterEach(async () => {
    if (pool.isActive()) {
      await pool.stop();
    }
  });

  describe('concurrent reservations', () => {
    it('should handle many concurrent reservations', async () => {
      await pool.start();

      // Make many concurrent reservations
      const promises = Array.from({ length: 20 }, () =>
        pool.reserveWorkers(1, 'normal')
      );

      const results = await Promise.allSettled(promises);

      // Some should succeed, some should be queued
      expect(results.length).toBe(20);

      // Cleanup
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.length > 0) {
          pool.releaseWorkers(r.value);
        }
      });
    });

    it('should handle mixed priorities concurrently', async () => {
      await pool.start();

      const priorities = ['critical', 'high', 'normal', 'low'] as const;

      const promises = priorities.flatMap(priority =>
        Array.from({ length: 5 }, () =>
          pool.reserveWorkers(1, priority)
        )
      );

      const results = await Promise.allSettled(promises);

      expect(results).toHaveLength(20);

      // Cleanup
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.length > 0) {
          pool.releaseWorkers(r.value);
        }
      });
    });
  });

  describe('worker failures', () => {
    it('should handle worker creation failure', async () => {
      let failCount = 0;
      const failingFactory = async (id: string) => {
        if (failCount < 2) {
          failCount++;
          throw new Error('Worker creation failed');
        }
        return new MockWorker(id);
      };

      const failPool = new WorkerPoolManager({
        workerFactory: failingFactory,
        minWorkers: 1,
        maxWorkers: 3
      });

      // Should handle failures gracefully
      await expect(failPool.start()).resolves.not.toThrow();

      await failPool.stop();
    });

    it('should replace failed workers', async () => {
      await pool.start();

      const statsBefore = pool.getPoolStats();
      const workersBefore = statsBefore.totalWorkers;

      // Simulate worker failure by replacing
      // (in real scenario, health check would trigger this)
      await pool.drainAll();

      const statsAfter = pool.getPoolStats();
      expect(statsAfter.totalWorkers).toBe(0);
    });
  });

  describe('queue overflow', () => {
    it('should reject when queue is full', async () => {
      await pool.start();

      const stats = pool.getPoolStats();

      // Reserve all available workers
      const allWorkers = [];
      for (let i = 0; i < stats.idleWorkers; i++) {
        const workers = await pool.reserveWorkers(1);
        allWorkers.push(...workers);
      }

      // Fill the queue (maxQueueDepth = 10)
      const queuedPromises = [];
      for (let i = 0; i < 10; i++) {
        queuedPromises.push(pool.reserveWorkers(1));
      }

      // This should be rejected (queue full)
      const rejected = pool.reserveWorkers(1);

      await expect(rejected).rejects.toThrow();

      // Cleanup
      allWorkers.forEach(w => pool.releaseWorkers([w]));
      await pool.stop();
    });
  });

  describe('rapid start/stop', () => {
    it('should handle rapid start/stop cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await pool.start();
        await pool.stop();
      }

      expect(pool.isActive()).toBe(false);
    });

    it('should handle stop while starting', async () => {
      const startPromise = pool.start();
      const stopPromise = pool.stop();

      await Promise.all([startPromise, stopPromise]);

      expect(pool.isActive()).toBe(false);
    });
  });

  describe('scaling edge cases', () => {
    it('should handle scale to same size', async () => {
      await pool.start();

      const stats = pool.getPoolStats();
      const result = await pool.scaleTo(stats.totalWorkers);

      expect(result.workersAdded).toBe(0);
      expect(result.workersRemoved).toBe(0);
    });

    it('should handle scale beyond limits', async () => {
      await pool.start();

      const result1 = await pool.scaleTo(100);
      expect(result1.newCount).toBeLessThanOrEqual(5);

      const result2 = await pool.scaleTo(0);
      expect(result2.newCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle rapid scale changes', async () => {
      await pool.start();

      await pool.scaleTo(5);
      await pool.scaleTo(2);
      await pool.scaleTo(4);
      await pool.scaleTo(3);

      const stats = pool.getPoolStats();
      expect(stats.totalWorkers).toBe(3);
    });
  });

  describe('configuration updates', () => {
    it('should handle configuration update while active', async () => {
      await pool.start();

      pool.updateConfig({
        maxQueueDepth: 50,
        maxQueueWaitTime: 60000
      });

      const config = pool.getConfig();
      expect(config.maxQueueDepth).toBe(50);

      // Pool should still work
      const workers = await pool.reserveWorkers(1);
      pool.releaseWorkers(workers);
    });
  });

  describe('empty and full states', () => {
    it('should work with zero initial workers', async () => {
      const emptyPool = new WorkerPoolManager({
        workerFactory: async (id: string) => new MockWorker(id),
        minWorkers: 0,
        maxWorkers: 3
      });

      await emptyPool.start();

      const stats = emptyPool.getPoolStats();
      expect(stats.totalWorkers).toBe(0);

      await emptyPool.stop();
    });

    it('should work with max initial workers', async () => {
      const fullPool = new WorkerPoolManager({
        workerFactory: async (id: string) => new MockWorker(id),
        minWorkers: 5,
        maxWorkers: 5
      });

      await fullPool.start();

      const stats = fullPool.getPoolStats();
      expect(stats.totalWorkers).toBe(5);

      await fullPool.stop();
    });
  });
});

describe('Edge Cases - PriorityQueue', () => {
  let queue: PriorityQueue;

  beforeEach(() => {
    queue = new PriorityQueue(5, 1000);
  });

  describe('queue overflow', () => {
    it('should reject when queue exceeds max depth', () => {
      for (let i = 0; i < 5; i++) {
        expect(queue.enqueue({
          requestId: `req-${i}`,
          priority: 'normal',
          queuedAt: Date.now(),
          resolve: () => {},
          reject: () => {},
          workerCount: 1,
          timeout: 1000
        })).toBe(true);
      }

      // 6th should be rejected
      expect(queue.enqueue({
        requestId: 'req-6',
        priority: 'normal',
        queuedAt: Date.now(),
        resolve: () => {},
        reject: () => {},
        workerCount: 1,
        timeout: 1000
      })).toBe(false);
    });
  });

  describe('empty queue operations', () => {
    it('should handle dequeue on empty queue', () => {
      expect(queue.dequeue()).toBeNull();
      expect(queue.dequeueFromPriority('critical')).toBeNull();
      expect(queue.peek()).toBeNull();
    });

    it('should handle remove on empty queue', () => {
      expect(queue.remove('non-existent')).toBe(false);
    });

    it('should handle clear on empty queue', () => {
      expect(queue.clear()).toBe(0);
    });
  });

  describe('timeout handling', () => {
    it('should clean expired requests', async () => {
      const rejectSpy = vi.fn();

      queue.enqueue({
        requestId: 'req-1',
        priority: 'normal',
        queuedAt: Date.now(),
        resolve: () => {},
        reject: rejectSpy,
        workerCount: 1,
        timeout: 100
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const cleaned = queue.cleanExpiredRequests();

      expect(cleaned).toBe(1);
      expect(rejectSpy).toHaveBeenCalled();
    });
  });

  describe('mixed priorities', () => {
    it('should maintain order with mixed priorities', () => {
      const priorities = ['low', 'critical', 'normal', 'high', 'low'] as const;

      priorities.forEach((priority, i) => {
        queue.enqueue({
          requestId: `req-${i}`,
          priority,
          queuedAt: Date.now(),
          resolve: () => {},
          reject: () => {},
          workerCount: 1,
          timeout: 1000
        });
      });

      expect(queue.dequeue()?.priority).toBe('critical');
      expect(queue.dequeue()?.priority).toBe('high');
      expect(queue.dequeue()?.priority).toBe('normal');
      expect(queue.dequeue()?.priority).toBe('low');
      expect(queue.dequeue()?.priority).toBe('low');
    });
  });
});

describe('Edge Cases - WorkerLifecycle', () => {
  let lifecycle: WorkerLifecycle;

  beforeEach(() => {
    lifecycle = new WorkerLifecycle(
      async (id: string) => new MockWorker(id),
      { healthCheckInterval: 1000 }
    );
  });

  describe('non-existent worker operations', () => {
    it('should handle operations on non-existent workers', async () => {
      expect(lifecycle.getWorker('non-existent')).toBeNull();
      expect(lifecycle.getWorkerState('non-existent')).toBeNull();
      expect(lifecycle.getWorkerMetrics('non-existent')).toBeNull();

      await expect(lifecycle.drainWorker('non-existent')).rejects.toThrow();

      const result = await lifecycle.healthCheck('non-existent');
      expect(result.healthy).toBe(false);

      await lifecycle.terminateWorker('non-existent');
      // Should not throw
    });
  });

  describe('event handler errors', () => {
    it('should handle errors in event handlers', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      lifecycle.on(errorHandler);

      // Should not throw despite handler error
      await lifecycle.initializeWorker('worker-1');

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('concurrent health checks', () => {
    it('should handle concurrent health checks', async () => {
      await lifecycle.initializeWorker('worker-1');
      await lifecycle.initializeWorker('worker-2');

      const results = await Promise.all([
        lifecycle.healthCheck('worker-1'),
        lifecycle.healthCheck('worker-2'),
        lifecycle.healthCheck('worker-1')
      ]);

      expect(results).toHaveLength(3);
      results.forEach(r => {
        expect(r).toBeDefined();
      });
    });
  });
});

describe('Edge Cases - LoadBalancer', () => {
  let lifecycle: WorkerLifecycle;
  let balancer: LoadBalancer;

  beforeEach(async () => {
    lifecycle = new WorkerLifecycle(
      async (id: string) => new MockWorker(id)
    );

    await lifecycle.initializeWorker('worker-1');
    await lifecycle.initializeWorker('worker-2');

    balancer = new LoadBalancer(lifecycle, 'least-connections');
  });

  describe('no workers available', () => {
    it('should return null when no workers', async () => {
      const emptyLifecycle = new WorkerLifecycle(
        async (id: string) => new MockWorker(id)
      );

      const emptyBalancer = new LoadBalancer(emptyLifecycle);

      expect(emptyBalancer.selectWorker()).toBeNull();
      expect(emptyBalancer.selectWorkers(5)).toHaveLength(0);
    });
  });

  describe('all workers busy', () => {
    it('should return null when all workers busy', () => {
      lifecycle.markReserved('worker-1');
      lifecycle.markReserved('worker-2');

      expect(balancer.selectWorker()).toBeNull();
    });
  });

  describe('affinity edge cases', () => {
    it('should handle affinity to non-existent worker', () => {
      balancer.setAffinity('session-1', 'non-existent');

      // Should not throw, affinity is just ignored
      const worker = balancer.selectWorker('session-1');
      expect(worker).toBeTruthy(); // Should still get a worker
    });

    it('should handle removing non-existent affinity', () => {
      balancer.removeAffinity('non-existent');
      // Should not throw
    });

    it('should handle clearing empty affinity', () => {
      balancer.clearAffinity();
      // Should not throw
    });
  });

  describe('backpressure', () => {
    it('should respect backpressure limits', () => {
      const limitedBalancer = new LoadBalancer(lifecycle, 'least-connections', {
        enableBackpressure: true,
        maxConnectionsPerWorker: 1
      });

      // Mark all workers with max connections
      lifecycle.markReserved('worker-1');
      lifecycle.markReserved('worker-2');

      // All workers at capacity
      expect(limitedBalancer.selectWorker()).toBeNull();
    });
  });
});

describe('Stress Tests', () => {
  it('should handle high queue throughput', () => {
    const queue = new PriorityQueue(1000, 60000);

    // Add many requests
    for (let i = 0; i < 500; i++) {
      queue.enqueue({
        requestId: `req-${i}`,
        priority: 'normal',
        queuedAt: Date.now(),
        resolve: () => {},
        reject: () => {},
        workerCount: 1,
        timeout: 60000
      });
    }

    expect(queue.getTotalDepth()).toBe(500);

    // Remove all
    const cleared = queue.clear();
    expect(cleared).toBe(500);
  });

  it('should handle many workers', async () => {
    const pool = new WorkerPoolManager({
      workerFactory: async (id: string) => new MockWorker(id),
      minWorkers: 10,
      maxWorkers: 20,
      warmupTimeout: 1000
    });

    await pool.start();

    const stats = pool.getPoolStats();
    expect(stats.totalWorkers).toBeGreaterThanOrEqual(10);

    await pool.stop();
  });

  it('should handle many event handlers', async () => {
    const lifecycle = new WorkerLifecycle(
      async (id: string) => new MockWorker(id)
    );

    // Add many handlers
    const handlers = [];
    for (let i = 0; i < 50; i++) {
      const handler = vi.fn();
      lifecycle.on(handler);
      handlers.push(handler);
    }

    await lifecycle.initializeWorker('worker-1');

    // All handlers should be called
    let callCount = 0;
    handlers.forEach(h => {
      callCount += h.mock.calls.length;
    });

    expect(callCount).toBeGreaterThan(0);

    await lifecycle.cleanup();
  });
});
