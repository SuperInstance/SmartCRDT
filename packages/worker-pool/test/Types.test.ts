/**
 * Types Tests
 *
 * Tests for type definitions and enums
 */

import { describe, it, expect } from 'vitest';
import type {
  WorkerState,
  Priority,
  LoadBalancingStrategy,
  WorkerEventType,
  WorkerPoolConfig,
  WorkerMetrics,
  PoolStatistics,
  QueuedRequest,
  WarmupTask,
  ScaleResult,
  DrainResult
} from '../src/types.js';
import { DEFAULT_WORKER_POOL_CONFIG } from '../src/types.js';

describe('Types', () => {
  describe('WorkerState', () => {
    it('should have valid state types', () => {
      const states: WorkerState[] = ['idle', 'busy', 'warming', 'draining', 'terminated'];
      expect(states).toHaveLength(5);
    });

    it('should accept valid worker state', () => {
      const state: WorkerState = 'idle';
      expect(state).toBe('idle');
    });
  });

  describe('Priority', () => {
    it('should have valid priority levels', () => {
      const priorities: Priority[] = ['critical', 'high', 'normal', 'low'];
      expect(priorities).toHaveLength(4);
    });

    it('should order priorities correctly', () => {
      const order: Record<Priority, number> = {
        critical: 4,
        high: 3,
        normal: 2,
        low: 1
      };

      expect(order.critical).toBeGreaterThan(order.high);
      expect(order.high).toBeGreaterThan(order.normal);
      expect(order.normal).toBeGreaterThan(order.low);
    });
  });

  describe('LoadBalancingStrategy', () => {
    it('should have valid strategies', () => {
      const strategies: LoadBalancingStrategy[] = ['round-robin', 'least-connections', 'least-latency'];
      expect(strategies).toHaveLength(3);
    });
  });

  describe('WorkerEventType', () => {
    it('should have valid event types', () => {
      const eventTypes: WorkerEventType[] = [
        'initialized',
        'warming',
        'ready',
        'reserved',
        'released',
        'failed',
        'replaced',
        'draining',
        'terminated'
      ];
      expect(eventTypes).toHaveLength(9);
    });
  });

  describe('WorkerPoolConfig', () => {
    it('should have default configuration', () => {
      expect(DEFAULT_WORKER_POOL_CONFIG.minWorkers).toBe(2);
      expect(DEFAULT_WORKER_POOL_CONFIG.maxWorkers).toBe(10);
      expect(DEFAULT_WORKER_POOL_CONFIG.warmStandbyCount).toBe(2);
      expect(DEFAULT_WORKER_POOL_CONFIG.warmupTimeout).toBe(30000);
      expect(DEFAULT_WORKER_POOL_CONFIG.healthCheckInterval).toBe(30000);
      expect(DEFAULT_WORKER_POOL_CONFIG.maxHealthCheckFailures).toBe(3);
      expect(DEFAULT_WORKER_POOL_CONFIG.maxQueueWaitTime).toBe(60000);
      expect(DEFAULT_WORKER_POOL_CONFIG.maxQueueDepth).toBe(100);
      expect(DEFAULT_WORKER_POOL_CONFIG.loadBalancingStrategy).toBe('least-connections');
      expect(DEFAULT_WORKER_POOL_CONFIG.enableAutoReplacement).toBe(true);
      expect(DEFAULT_WORKER_POOL_CONFIG.enableMetrics).toBe(true);
    });

    it('should allow partial configuration override', () => {
      const config: Partial<WorkerPoolConfig> = {
        minWorkers: 5,
        maxWorkers: 20
      };

      expect(config.minWorkers).toBe(5);
      expect(config.maxWorkers).toBe(20);
    });
  });

  describe('WorkerMetrics', () => {
    it('should create valid worker metrics', () => {
      const metrics: WorkerMetrics = {
        workerId: 'worker-1',
        state: 'idle',
        cpuUsage: 50.5,
        memoryUsage: 1024000,
        requestsProcessed: 100,
        avgLatency: 125.5,
        activeConnections: 2,
        healthCheckFailures: 0,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        uptime: 60000
      };

      expect(metrics.workerId).toBe('worker-1');
      expect(metrics.state).toBe('idle');
      expect(metrics.cpuUsage).toBe(50.5);
      expect(metrics.memoryUsage).toBe(1024000);
      expect(metrics.requestsProcessed).toBe(100);
      expect(metrics.avgLatency).toBe(125.5);
    });
  });

  describe('PoolStatistics', () => {
    it('should create valid pool statistics', () => {
      const stats: PoolStatistics = {
        totalWorkers: 10,
        activeWorkers: 5,
        idleWorkers: 3,
        warmingWorkers: 1,
        drainingWorkers: 0,
        terminatedWorkers: 1,
        queueDepth: 2,
        utilizationPercentage: 50,
        warmWorkers: 3,
        avgCpuUsage: 45.5,
        avgMemoryUsage: 512000,
        avgLatency: 100.5,
        totalRequestsProcessed: 500,
        timestamp: Date.now()
      };

      expect(stats.totalWorkers).toBe(10);
      expect(stats.activeWorkers).toBe(5);
      expect(stats.utilizationPercentage).toBe(50);
    });
  });

  describe('QueuedRequest', () => {
    it('should create valid queued request', () => {
      const request: QueuedRequest = {
        requestId: 'req-123',
        priority: 'high',
        queuedAt: Date.now(),
        resolve: () => {},
        reject: () => {},
        workerCount: 2,
        timeout: 60000
      };

      expect(request.requestId).toBe('req-123');
      expect(request.priority).toBe('high');
      expect(request.workerCount).toBe(2);
    });
  });

  describe('WarmupTask', () => {
    it('should create valid warmup task', () => {
      const task: WarmupTask = {
        name: 'load-model',
        fn: async () => {},
        expectedDuration: 5000
      };

      expect(task.name).toBe('load-model');
      expect(task.expectedDuration).toBe(5000);
    });
  });

  describe('ScaleResult', () => {
    it('should create valid scale result', () => {
      const result: ScaleResult = {
        previousCount: 5,
        newCount: 8,
        workersAdded: 3,
        workersRemoved: 0,
        timestamp: Date.now()
      };

      expect(result.workersAdded).toBe(3);
      expect(result.workersRemoved).toBe(0);
    });
  });

  describe('DrainResult', () => {
    it('should create valid drain result', () => {
      const result: DrainResult = {
        workersDrained: 5,
        requestsCompleted: 100,
        requestsCancelled: 2,
        drainTime: 5000,
        timestamp: Date.now()
      };

      expect(result.workersDrained).toBe(5);
      expect(result.requestsCompleted).toBe(100);
    });
  });
});
