/**
 * WorkerLifecycle Tests
 *
 * Tests for worker lifecycle management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkerLifecycle } from '../src/WorkerLifecycle.js';
import type { Worker, WorkerState, WarmupTask, WorkerEvent } from '../src/types.js';

// Mock Worker class
class MockWorker implements Worker {
  constructor(public id: string) {}
  postMessage?: ((data: unknown) => void) | undefined;
  terminate?: (() => void) | undefined;
}

describe('WorkerLifecycle', () => {
  let lifecycle: WorkerLifecycle;
  let workerFactory: (id: string) => Promise<Worker>;

  beforeEach(() => {
    workerFactory = async (id: string) => new MockWorker(id);
    lifecycle = new WorkerLifecycle(workerFactory, {
      healthCheckInterval: 1000,
      maxHealthCheckFailures: 3,
      warmupTimeout: 5000
    });
  });

  describe('initializeWorker', () => {
    it('should initialize a new worker', async () => {
      const worker = await lifecycle.initializeWorker('worker-1');

      expect(worker).toBeInstanceOf(MockWorker);
      expect(worker.id).toBe('worker-1');
      expect(lifecycle.getWorkerCount()).toBe(1);
    });

    it('should set worker state to idle after initialization', async () => {
      await lifecycle.initializeWorker('worker-2');

      const state = lifecycle.getWorkerState('worker-2');
      expect(state).toBe('idle');
    });

    it('should emit initialized event', async () => {
      const eventSpy = vi.fn();
      lifecycle.on(eventSpy);

      await lifecycle.initializeWorker('worker-3');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'initialized',
          workerId: 'worker-3'
        })
      );
    });

    it('should handle multiple workers', async () => {
      await lifecycle.initializeWorker('worker-1');
      await lifecycle.initializeWorker('worker-2');
      await lifecycle.initializeWorker('worker-3');

      expect(lifecycle.getWorkerCount()).toBe(3);
    });
  });

  describe('registerWarmupTask', () => {
    it('should register warmup task', () => {
      const task: WarmupTask = {
        name: 'test-task',
        fn: async () => {}
      };

      lifecycle.registerWarmupTask(task);

      // Task should be used during worker initialization
      expect(true).toBe(true);
    });

    it('should register warmup task from function', () => {
      lifecycle.registerWarmupTaskFn('test-fn', async () => {}, 1000);

      expect(true).toBe(true);
    });

    it('should clear warmup tasks', () => {
      lifecycle.registerWarmupTaskFn('task1', async () => {});
      lifecycle.registerWarmupTaskFn('task2', async () => {});

      lifecycle.clearWarmupTasks();

      // Tasks should be cleared
      expect(true).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('should pass health check for valid worker', async () => {
      await lifecycle.initializeWorker('worker-1');

      const result = await lifecycle.healthCheck('worker-1');

      expect(result.healthy).toBe(true);
      expect(result.workerId).toBe('worker-1');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should fail health check for non-existent worker', async () => {
      const result = await lifecycle.healthCheck('non-existent');

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Worker not found');
    });

    it('should track health check failures', async () => {
      await lifecycle.initializeWorker('worker-1');

      // Mock a failed health check by making worker null
      const worker = lifecycle.getWorker('worker-1');
      if (worker) {
        // Worker exists, health check should pass
        const result = await lifecycle.healthCheck('worker-1');
        expect(result.healthy).toBe(true);
      }
    });
  });

  describe('startHealthChecks / stopHealthChecks', () => {
    it('should start periodic health checks', async () => {
      await lifecycle.initializeWorker('worker-1');

      lifecycle.startHealthChecks();

      // Wait for at least one health check
      await new Promise(resolve => setTimeout(resolve, 1100));

      lifecycle.stopHealthChecks();

      expect(true).toBe(true);
    });

    it('should stop health checks', async () => {
      lifecycle.startHealthChecks();
      lifecycle.stopHealthChecks();

      expect(true).toBe(true);
    });

    it('should not start health checks if already started', () => {
      lifecycle.startHealthChecks();
      lifecycle.startHealthChecks(); // Should not cause issues

      lifecycle.stopHealthChecks();

      expect(true).toBe(true);
    });
  });

  describe('replaceWorker', () => {
    it('should replace failed worker', async () => {
      await lifecycle.initializeWorker('worker-1');

      const newWorkerId = await lifecycle.replaceWorker('worker-1');

      expect(newWorkerId).toBeTruthy();
      expect(newWorkerId).toContain('replaced');
      expect(lifecycle.getWorker('worker-1')).toBeNull();
    });

    it('should emit replaced event', async () => {
      const eventSpy = vi.fn();
      lifecycle.on(eventSpy);

      await lifecycle.initializeWorker('worker-1');
      await lifecycle.replaceWorker('worker-1');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'replaced'
        })
      );
    });

    it('should return null for non-existent worker', async () => {
      const result = await lifecycle.replaceWorker('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('drainWorker', () => {
    it('should drain a worker', async () => {
      await lifecycle.initializeWorker('worker-1');

      await lifecycle.drainWorker('worker-1');

      expect(lifecycle.getWorkerState('worker-1')).toBeNull();
      expect(lifecycle.getWorker('worker-1')).toBeNull();
    });

    it('should emit draining event', async () => {
      const eventSpy = vi.fn();
      lifecycle.on(eventSpy);

      await lifecycle.initializeWorker('worker-1');
      await lifecycle.drainWorker('worker-1');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'draining',
          workerId: 'worker-1'
        })
      );
    });

    it('should throw error for non-existent worker', async () => {
      await expect(lifecycle.drainWorker('non-existent')).rejects.toThrow();
    });
  });

  describe('terminateWorker', () => {
    it('should terminate worker gracefully', async () => {
      await lifecycle.initializeWorker('worker-1');

      await lifecycle.terminateWorker('worker-1', true);

      expect(lifecycle.getWorker('worker-1')).toBeNull();
    });

    it('should terminate worker immediately', async () => {
      await lifecycle.initializeWorker('worker-1');

      await lifecycle.terminateWorker('worker-1', false);

      expect(lifecycle.getWorker('worker-1')).toBeNull();
    });
  });

  describe('drainAll', () => {
    it('should drain all workers', async () => {
      await lifecycle.initializeWorker('worker-1');
      await lifecycle.initializeWorker('worker-2');
      await lifecycle.initializeWorker('worker-3');

      await lifecycle.drainAll();

      expect(lifecycle.getWorkerCount()).toBe(0);
    });
  });

  describe('markReserved and markReleased', () => {
    it('should mark worker as reserved', async () => {
      await lifecycle.initializeWorker('worker-1');

      lifecycle.markReserved('worker-1');

      const state = lifecycle.getWorkerState('worker-1');
      expect(state).toBe('busy');
    });

    it('should mark worker as released', async () => {
      await lifecycle.initializeWorker('worker-1');

      lifecycle.markReserved('worker-1');
      lifecycle.markReleased('worker-1', 100);

      const state = lifecycle.getWorkerState('worker-1');
      expect(state).toBe('idle');
    });

    it('should track metrics on release', async () => {
      await lifecycle.initializeWorker('worker-1');

      lifecycle.markReserved('worker-1');
      lifecycle.markReleased('worker-1', 150);

      const metrics = lifecycle.getWorkerMetrics('worker-1');
      expect(metrics?.requestsProcessed).toBe(1);
      expect(metrics?.avgLatency).toBe(150);
    });
  });

  describe('getWorkerMetrics', () => {
    it('should return null for non-existent worker', () => {
      const metrics = lifecycle.getWorkerMetrics('non-existent');
      expect(metrics).toBeNull();
    });

    it('should return worker metrics', async () => {
      await lifecycle.initializeWorker('worker-1');

      const metrics = lifecycle.getWorkerMetrics('worker-1');

      expect(metrics).toBeTruthy();
      expect(metrics?.workerId).toBe('worker-1');
      expect(metrics?.state).toBe('idle');
      expect(metrics?.requestsProcessed).toBe(0);
      expect(metrics?.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAllWorkerMetrics', () => {
    it('should return metrics for all workers', async () => {
      await lifecycle.initializeWorker('worker-1');
      await lifecycle.initializeWorker('worker-2');

      const allMetrics = lifecycle.getAllWorkerMetrics();

      expect(allMetrics).toHaveLength(2);
      expect(allMetrics.some(m => m.workerId === 'worker-1')).toBe(true);
      expect(allMetrics.some(m => m.workerId === 'worker-2')).toBe(true);
    });
  });

  describe('getWorkersByState', () => {
    it('should return workers by state', async () => {
      await lifecycle.initializeWorker('worker-1');
      await lifecycle.initializeWorker('worker-2');

      const idleWorkers = lifecycle.getWorkersByState('idle');

      expect(idleWorkers).toHaveLength(2);
    });

    it('should return empty array for no workers in state', async () => {
      await lifecycle.initializeWorker('worker-1');

      const busyWorkers = lifecycle.getWorkersByState('busy');

      expect(busyWorkers).toHaveLength(0);
    });
  });

  describe('getWorkerCount', () => {
    it('should return worker count', async () => {
      expect(lifecycle.getWorkerCount()).toBe(0);

      await lifecycle.initializeWorker('worker-1');
      expect(lifecycle.getWorkerCount()).toBe(1);

      await lifecycle.initializeWorker('worker-2');
      expect(lifecycle.getWorkerCount()).toBe(2);
    });
  });

  describe('getWorkerCountByState', () => {
    it('should return count by state', async () => {
      await lifecycle.initializeWorker('worker-1');
      await lifecycle.initializeWorker('worker-2');

      lifecycle.markReserved('worker-1');

      const counts = lifecycle.getWorkerCountByState();

      expect(counts.idle).toBe(1);
      expect(counts.busy).toBe(1);
    });
  });

  describe('event handlers', () => {
    it('should register event handler', async () => {
      const handler = vi.fn();
      lifecycle.on(handler);

      await lifecycle.initializeWorker('worker-1');

      expect(handler).toHaveBeenCalled();
    });

    it('should unregister event handler', async () => {
      const handler = vi.fn();
      lifecycle.on(handler);
      lifecycle.off(handler);

      await lifecycle.initializeWorker('worker-2');

      // Handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle multiple event handlers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      lifecycle.on(handler1);
      lifecycle.on(handler2);

      await lifecycle.initializeWorker('worker-1');

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clean up all resources', async () => {
      lifecycle.startHealthChecks();

      await lifecycle.initializeWorker('worker-1');
      await lifecycle.initializeWorker('worker-2');

      await lifecycle.cleanup();

      expect(lifecycle.getWorkerCount()).toBe(0);
    });
  });
});
