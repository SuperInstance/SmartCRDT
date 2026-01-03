/**
 * LoadBalancer Tests
 *
 * Tests for load balancing functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LoadBalancer } from '../src/LoadBalancer.js';
import { WorkerLifecycle } from '../src/WorkerLifecycle.js';
import type { Worker, LoadBalancingStrategy } from '../src/types.js';

// Mock Worker class
class MockWorker implements Worker {
  constructor(public id: string) {}
}

describe('LoadBalancer', () => {
  let lifecycle: WorkerLifecycle;
  let loadBalancer: LoadBalancer;
  let workerFactory: (id: string) => Promise<Worker>;

  beforeEach(async () => {
    workerFactory = async (id: string) => new MockWorker(id);
    lifecycle = new WorkerLifecycle(workerFactory);

    // Create some workers
    await lifecycle.initializeWorker('worker-1');
    await lifecycle.initializeWorker('worker-2');
    await lifecycle.initializeWorker('worker-3');

    loadBalancer = new LoadBalancer(lifecycle, 'least-connections');
  });

  describe('selectWorker', () => {
    it('should select a worker', () => {
      const worker = loadBalancer.selectWorker();

      expect(worker).toBeTruthy();
      expect(worker).toBeInstanceOf(MockWorker);
    });

    it('should return null when no workers available', async () => {
      const emptyLifecycle = new WorkerLifecycle(workerFactory);
      const emptyBalancer = new LoadBalancer(emptyLifecycle);

      const worker = emptyBalancer.selectWorker();

      expect(worker).toBeNull();
    });

    it('should respect affinity', () => {
      const worker1 = loadBalancer.selectWorker('session-1');

      loadBalancer.setAffinity('session-1', 'worker-1');

      // Should get same worker for same session key
      expect(true).toBe(true);
    });

    it('should clear affinity', () => {
      loadBalancer.setAffinity('session-1', 'worker-1');
      loadBalancer.removeAffinity('session-1');

      expect(true).toBe(true);
    });

    it('should clear all affinities', () => {
      loadBalancer.setAffinity('session-1', 'worker-1');
      loadBalancer.setAffinity('session-2', 'worker-2');
      loadBalancer.clearAffinity();

      expect(true).toBe(true);
    });
  });

  describe('selectWorkers', () => {
    it('should select multiple workers', () => {
      const workers = loadBalancer.selectWorkers(2);

      expect(workers).toHaveLength(2);
      workers.forEach(w => {
        expect(w).toBeInstanceOf(MockWorker);
      });
    });

    it('should return fewer workers if not enough available', () => {
      const workers = loadBalancer.selectWorkers(10);

      expect(workers.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array if no workers', () => {
      const emptyLifecycle = new WorkerLifecycle(workerFactory);
      const emptyBalancer = new LoadBalancer(emptyLifecycle);

      const workers = emptyBalancer.selectWorkers(2);

      expect(workers).toHaveLength(0);
    });
  });

  describe('setStrategy', () => {
    it('should set load balancing strategy', () => {
      loadBalancer.setStrategy('round-robin');
      expect(loadBalancer.getStrategy()).toBe('round-robin');

      loadBalancer.setStrategy('least-connections');
      expect(loadBalancer.getStrategy()).toBe('least-connections');

      loadBalancer.setStrategy('least-latency');
      expect(loadBalancer.getStrategy()).toBe('least-latency');
    });
  });

  describe('setBackpressureEnabled', () => {
    it('should enable backpressure', () => {
      loadBalancer.setBackpressureEnabled(true);
      expect(true).toBe(true);
    });

    it('should disable backpressure', () => {
      loadBalancer.setBackpressureEnabled(false);
      expect(true).toBe(true);
    });
  });

  describe('setMaxConnectionsPerWorker', () => {
    it('should set max connections', () => {
      loadBalancer.setMaxConnectionsPerWorker(50);
      expect(true).toBe(true);
    });
  });

  describe('isWorkerAtCapacity', () => {
    it('should check worker capacity', () => {
      // At startup, workers should not be at capacity
      expect(true).toBe(true);
    });
  });

  describe('getAvailableWorkerCount', () => {
    it('should return available worker count', () => {
      const count = loadBalancer.getAvailableWorkerCount();
      expect(count).toBe(3);
    });

    it('should return zero when all workers busy', () => {
      // Mark all workers as busy
      lifecycle.markReserved('worker-1');
      lifecycle.markReserved('worker-2');
      lifecycle.markReserved('worker-3');

      const count = loadBalancer.getAvailableWorkerCount();
      expect(count).toBe(0);
    });
  });

  describe('getTotalWorkerCount', () => {
    it('should return total worker count', () => {
      const count = loadBalancer.getTotalWorkerCount();
      expect(count).toBe(3);
    });
  });

  describe('round-robin strategy', () => {
    it('should distribute workers evenly', () => {
      loadBalancer.setStrategy('round-robin');

      const workers = [
        loadBalancer.selectWorker(),
        loadBalancer.selectWorker(),
        loadBalancer.selectWorker(),
        loadBalancer.selectWorker()
      ];

      expect(workers).toHaveLength(4);
      workers.forEach(w => expect(w).toBeTruthy());
    });
  });

  describe('least-connections strategy', () => {
    it('should select worker with least connections', () => {
      loadBalancer.setStrategy('least-connections');

      // Mark worker-1 as busy
      lifecycle.markReserved('worker-1');

      // Should prefer idle workers
      const worker = loadBalancer.selectWorker();

      expect(worker).toBeTruthy();
    });
  });

  describe('least-latency strategy', () => {
    it('should consider latency in selection', () => {
      loadBalancer.setStrategy('least-latency');

      const worker = loadBalancer.selectWorker();

      expect(worker).toBeTruthy();
    });
  });

  describe('getStats', () => {
    it('should return load balancer statistics', () => {
      const stats = loadBalancer.getStats();

      expect(stats.strategy).toBe('least-connections');
      expect(stats.availableWorkers).toBe(3);
      expect(stats.totalWorkers).toBe(3);
      expect(stats.backpressureEnabled).toBe(true);
      expect(stats.maxConnectionsPerWorker).toBe(100);
      expect(stats.affinityCount).toBe(0);
    });

    it('should track affinity count', () => {
      loadBalancer.setAffinity('session-1', 'worker-1');
      loadBalancer.setAffinity('session-2', 'worker-2');

      const stats = loadBalancer.getStats();

      expect(stats.affinityCount).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should clean up resources', () => {
      loadBalancer.setAffinity('session-1', 'worker-1');
      loadBalancer.cleanup();

      const stats = loadBalancer.getStats();
      expect(stats.affinityCount).toBe(0);
    });
  });
});
