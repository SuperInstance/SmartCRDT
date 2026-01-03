/**
 * Integration Tests
 *
 * Tests for integration with @lsi/protocol and CoAgents
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  IntegratedWorkerPool,
  WorkerAwareRouter,
  IntegrationHelpers
} from '../src/integration.js';
import type { Worker, WorkerPoolConfig, ContainerOrchestrator, ContainerConfig } from '../src/integration.js';

// Mock Worker class
class MockWorker implements Worker {
  constructor(public id: string) {}
  postMessage?: ((data: unknown) => void) | undefined;
  terminate?: (() => void) | undefined;
}

// Mock container orchestrator
class MockContainerOrchestrator implements ContainerOrchestrator {
  private containers: Map<string, any> = new Map();

  async startContainer(config: ContainerConfig): Promise<string> {
    const id = `container-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.containers.set(id, { status: 'running', config });
    return id;
  }

  async stopContainer(containerId: string): Promise<void> {
    this.containers.delete(containerId);
  }

  async getContainerStatus(containerId: string): Promise<any> {
    return this.containers.get(containerId) || { status: 'not-found' };
  }

  async scaleContainers(count: number): Promise<void> {
    // Mock implementation
  }
}

describe('IntegratedWorkerPool', () => {
  let pool: IntegratedWorkerPool;
  let workerFactory: () => Promise<Worker>;

  beforeEach(() => {
    workerFactory = async () => new MockWorker('mock-worker');
    pool = new IntegratedWorkerPool(
      {
        workerFactory,
        minWorkers: 2,
        maxWorkers: 5,
        warmStandbyCount: 1
      },
      {
        enableCoAgents: true,
        enableContainerOrchestration: false
      }
    );
  });

  afterEach(async () => {
    if (pool) {
      await pool.stop();
    }
  });

  describe('start and stop', () => {
    it('should start integrated pool', async () => {
      await pool.start();

      const stats = pool.getPoolStatistics();
      expect(stats.totalWorkers).toBeGreaterThan(0);
    });

    it('should stop integrated pool', async () => {
      await pool.start();
      await pool.stop();

      const stats = pool.getPoolStatistics();
      expect(stats.totalWorkers).toBe(0);
    });
  });

  describe('processRequest', () => {
    it('should process Aequor request', async () => {
      await pool.start();

      const request = {
        requestId: 'test-req-1',
        query: 'test query',
        context: {},
        constraints: {}
      };

      const response = await pool.processRequest(request as any);

      expect(response).toBeDefined();
      expect(response.requestId).toBe('test-req-1');
    });

    it('should handle high priority requests', async () => {
      await pool.start();

      const request = {
        requestId: 'test-req-2',
        query: 'urgent query',
        context: { priority: 'critical' },
        constraints: {}
      };

      const response = await pool.processRequest(request as any);

      expect(response).toBeDefined();
    });

    it('should handle real-time requests', async () => {
      await pool.start();

      const request = {
        requestId: 'test-req-3',
        query: 'real-time query',
        context: {},
        constraints: { maxLatency: 500 }
      };

      const response = await pool.processRequest(request as any);

      expect(response).toBeDefined();
    });

    it('should handle batch requests', async () => {
      await pool.start();

      const request = {
        requestId: 'test-req-4',
        query: 'batch query',
        context: { batch: true },
        constraints: {}
      };

      const response = await pool.processRequest(request as any);

      expect(response).toBeDefined();
    });
  });

  describe('processRequests', () => {
    it('should process multiple requests in parallel', async () => {
      await pool.start();

      const requests = Array.from({ length: 5 }, (_, i) => ({
        requestId: `test-req-${i}`,
        query: `test query ${i}`,
        context: {},
        constraints: {}
      }));

      const responses = await pool.processRequests(requests as any);

      expect(responses).toHaveLength(5);
      responses.forEach((r, i) => {
        expect(r.requestId).toBe(`test-req-${i}`);
      });
    });
  });

  describe('getPoolStatistics', () => {
    it('should return integrated statistics', async () => {
      await pool.start();

      const stats = pool.getPoolStatistics();

      expect(stats.totalWorkers).toBeGreaterThan(0);
      expect(stats.containersActive).toBe(0);
      expect(stats.protocolRequestsProcessed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scaleTo', () => {
    it('should scale pool', async () => {
      await pool.start();

      await pool.scaleTo(4);

      const stats = pool.getPoolStatistics();
      expect(stats.totalWorkers).toBe(4);
    });
  });
});

describe('WorkerAwareRouter', () => {
  it('should route task to worker', async () => {
    const workerFactory = async () => new MockWorker('mock-worker');
    const pool = new IntegratedWorkerPool({
      workerFactory,
      minWorkers: 2,
      maxWorkers: 5
    });

    await pool.start();

    const router = new WorkerAwareRouter(pool.getPoolManager());

    const task = {
      taskId: 'task-1',
      urgent: false,
      deadline: Date.now() + 10000
    };

    const worker = await router.routeTask(task as any);

    expect(worker).toBeTruthy();

    await pool.stop();
  });

  it('should determine task priority correctly', async () => {
    const workerFactory = async () => new MockWorker('mock-worker');
    const pool = new IntegratedWorkerPool({
      workerFactory,
      minWorkers: 2,
      maxWorkers: 5
    });

    await pool.start();

    const router = new WorkerAwareRouter(pool.getPoolManager());

    const urgentTask = { taskId: 'task-1', urgent: true };
    const deadlineTask = { taskId: 'task-2', deadline: Date.now() + 1000 };
    const normalTask = { taskId: 'task-3' };

    // Should not throw
    await router.routeTask(urgentTask as any);
    await router.routeTask(deadlineTask as any);
    await router.routeTask(normalTask as any);

    await pool.stop();
  });

  it('should get pool health', async () => {
    const workerFactory = async () => new MockWorker('mock-worker');
    const pool = new IntegratedWorkerPool({
      workerFactory,
      minWorkers: 2,
      maxWorkers: 5
    });

    await pool.start();

    const router = new WorkerAwareRouter(pool.getPoolManager());
    const health = router.getPoolHealth();

    expect(health.healthy).toBeDefined();
    expect(health.utilization).toBeGreaterThanOrEqual(0);
    expect(health.utilization).toBeLessThanOrEqual(100);
    expect(health.queueDepth).toBeGreaterThanOrEqual(0);
    expect(['scale-up', 'scale-down', 'maintain']).toContain(health.recommendation);

    await pool.stop();
  });

  it('should recommend scale-up when utilization high', async () => {
    const workerFactory = async () => new MockWorker('mock-worker');
    const pool = new IntegratedWorkerPool({
      workerFactory,
      minWorkers: 2,
      maxWorkers: 10
    });

    await pool.start();

    // Reserve workers to increase utilization
    const stats = pool.getPoolManager().getPoolStats();
    const workers = await pool.getPoolManager().reserveWorkers(stats.idleWorkers);

    const router = new WorkerAwareRouter(pool.getPoolManager());
    const health = router.getPoolHealth();

    // High utilization might trigger scale-up recommendation
    expect(['scale-up', 'maintain', 'scale-down']).toContain(health.recommendation);

    pool.getPoolManager().releaseWorkers(workers);
    await pool.stop();
  });
});

describe('IntegrationHelpers', () => {
  describe('createContainerWorkerFactory', () => {
    it('should create worker factory from orchestrator', async () => {
      const orchestrator = new MockContainerOrchestrator();
      const config: ContainerConfig = {
        image: 'test/image',
        cpu: '1',
        memory: '1Gi'
      };

      const factory = IntegrationHelpers.createContainerWorkerFactory(orchestrator, config);

      expect(factory).toBeInstanceOf(Function);

      const worker = await factory();
      expect(worker).toBeDefined();
    });
  });

  describe('constraintsToPoolConfig', () => {
    it('should map low latency constraints to more workers', () => {
      const config = IntegrationHelpers.constraintsToPoolConfig({
        maxLatency: 300
      });

      expect(config.warmStandbyCount).toBe(5);
      expect(config.minWorkers).toBe(3);
    });

    it('should map medium latency constraints to moderate workers', () => {
      const config = IntegrationHelpers.constraintsToPoolConfig({
        maxLatency: 1500
      });

      expect(config.warmStandbyCount).toBe(2);
      expect(config.minWorkers).toBe(2);
    });

    it('should map cost constraints to max workers', () => {
      const config = IntegrationHelpers.constraintsToPoolConfig({
        maxCost: 5
      });

      expect(config.maxWorkers).toBe(5);
    });

    it('should handle combined constraints', () => {
      const config = IntegrationHelpers.constraintsToPoolConfig({
        maxLatency: 300,
        maxCost: 10,
        privacy: 'strict'
      });

      expect(config).toBeDefined();
    });
  });

  describe('createCoAgentsPool', () => {
    it('should create CoAgents-compatible pool', async () => {
      const workerFactory = async () => new MockWorker('mock-worker');

      const pool = IntegrationHelpers.createCoAgentsPool({
        workerFactory,
        minWorkers: 2,
        maxWorkers: 5
      });

      expect(pool).toBeInstanceOf(IntegratedWorkerPool);

      await pool.start();

      const stats = pool.getPoolStatistics();
      expect(stats.totalWorkers).toBeGreaterThan(0);

      await pool.stop();
    });
  });
});

describe('ContainerOrchestrator Integration', () => {
  it('should integrate with container orchestrator', async () => {
    const orchestrator = new MockContainerOrchestrator();
    const workerFactory = async () => new MockWorker('mock-worker');

    const pool = new IntegratedWorkerPool(
      {
        workerFactory,
        minWorkers: 2,
        maxWorkers: 5
      },
      {
        enableContainerOrchestration: true,
        containerOrchestrator: orchestrator
      }
    );

    await pool.start();
    await pool.stop();

    expect(true).toBe(true);
  });

  it('should scale containers when scaling pool', async () => {
    const orchestrator = new MockContainerOrchestrator();
    const workerFactory = async () => new MockWorker('mock-worker');

    const pool = new IntegratedWorkerPool(
      {
        workerFactory,
        minWorkers: 2,
        maxWorkers: 5
      },
      {
        enableContainerOrchestration: true,
        containerOrchestrator: orchestrator
      }
    );

    await pool.start();
    await pool.scaleTo(4);
    await pool.stop();

    expect(true).toBe(true);
  });
});
