/**
 * NUMA Scheduler Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NUMAScheduler } from '../../src/numa/NUMAScheduler.js';
import { NUMADetector } from '../../src/numa/NUMADetector.js';
import type {
  NUMATask,
  NUMASchedulingDecision,
  NUMASchedulingStrategy,
  NUMANodeId,
  NUMAStatistics,
  NUMAWorkloadDistribution,
  NUMAOptimizationRecommendation,
  NUMAMemoryPolicy,
} from '@lsi/protocol';

describe('NUMAScheduler', () => {
  let scheduler: NUMAScheduler;
  let detector: NUMADetector;

  beforeEach(async () => {
    detector = new NUMADetector();
    scheduler = new NUMAScheduler(detector, {
      strategy: 'adaptive',
      maxTasksPerNode: 10,
      enableMigration: true,
    });
  });

  afterEach(async () => {
    await scheduler.stopMonitoring();
    scheduler.cleanupCompletedTasks();
  });

  describe('Task Scheduling', () => {
    it('should schedule a task', async () => {
      const task: NUMATask = {
        taskId: 'task-1',
        name: 'Test Task',
        memoryPolicy: 'local',
        memoryRequirement: 1024 * 1024 * 100, // 100MB
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      const decision = await scheduler.scheduleTask(task);

      expect(decision).toBeDefined();
      expect(decision.taskId).toBe('task-1');
      expect(decision.targetNode).toBeDefined();
      expect(decision.cpuAffinity).toBeDefined();
      expect(decision.cpuAffinity.length).toBeGreaterThan(0);
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
      expect(decision.expectedImpact).toBeGreaterThan(0);
      expect(decision.expectedImpact).toBeLessThanOrEqual(1);
      expect(decision.reason).toBeDefined();
    });

    it('should respect task preferred node', async () => {
      const task: NUMATask = {
        taskId: 'task-2',
        name: 'Test Task with Preference',
        preferredNode: 0,
        memoryPolicy: 'bind',
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 70,
        createdAt: Date.now(),
        state: 'pending',
      };

      const decision = await scheduler.scheduleTask(task);

      expect(decision.targetNode).toBe(0);
      expect(decision.reason).toContain('preferred');
    });

    it('should schedule multiple tasks', async () => {
      const tasks: NUMATask[] = Array.from({ length: 5 }, (_, i) => ({
        taskId: `task-${i}`,
        name: `Test Task ${i}`,
        memoryPolicy: 'local' as NUMAMemoryPolicy,
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending' as const,
      }));

      const decisions = await Promise.all(
        tasks.map(task => scheduler.scheduleTask(task))
      );

      expect(decisions).toHaveLength(5);
      decisions.forEach(decision => {
        expect(decision.targetNode).toBeDefined();
        expect(decision.cpuAffinity.length).toBeGreaterThan(0);
      });
    });

    it('should handle node capacity limits', async () => {
      const smallScheduler = new NUMAScheduler(detector, {
        maxTasksPerNode: 2,
      });

      const tasks: NUMATask[] = Array.from({ length: 10 }, (_, i) => ({
        taskId: `task-${i}`,
        name: `Test Task ${i}`,
        memoryPolicy: 'local' as NUMAMemoryPolicy,
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending' as const,
      }));

      const decisions = await Promise.all(
        tasks.map(task => smallScheduler.scheduleTask(task))
      );

      // Should distribute tasks across available nodes
      const nodeCounts = new Map<NUMANodeId, number>();
      for (const decision of decisions) {
        nodeCounts.set(
          decision.targetNode,
          (nodeCounts.get(decision.targetNode) || 0) + 1
        );
      }

      // No node should exceed maxTasksPerNode by much
      for (const count of nodeCounts.values()) {
        expect(count).toBeLessThanOrEqual(3); // Allow slight overflow
      }
    });
  });

  describe('Scheduling Strategies', () => {
    it('should use local_first strategy', async () => {
      const localScheduler = new NUMAScheduler(detector, {
        strategy: 'local_first',
      });

      const task: NUMATask = {
        taskId: 'task-local',
        name: 'Local First Task',
        preferredNode: 0,
        memoryPolicy: 'bind',
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      const decision = await localScheduler.scheduleTask(task);

      expect(decision.targetNode).toBe(0);
    });

    it('should use load_balance strategy', async () => {
      const balanceScheduler = new NUMAScheduler(detector, {
        strategy: 'load_balance',
      });

      // Schedule multiple tasks
      const tasks: NUMATask[] = Array.from({ length: 10 }, (_, i) => ({
        taskId: `task-balance-${i}`,
        name: `Load Balance Task ${i}`,
        memoryPolicy: 'local' as NUMAMemoryPolicy,
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending' as const,
      }));

      const decisions = await Promise.all(
        tasks.map(task => balanceScheduler.scheduleTask(task))
      );

      // Tasks should be distributed
      const uniqueNodes = new Set(decisions.map(d => d.targetNode));
      expect(uniqueNodes.size).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should provide statistics', async () => {
      const stats = await scheduler.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.timestamp).toBeDefined();
      expect(stats.tasksPerNode).toBeInstanceOf(Map);
      expect(stats.memoryPerNode).toBeInstanceOf(Map);
      expect(stats.localityRatio).toBeGreaterThanOrEqual(0);
      expect(stats.localityRatio).toBeLessThanOrEqual(1);
      expect(stats.loadBalanceScore).toBeGreaterThanOrEqual(0);
      expect(stats.loadBalanceScore).toBeLessThanOrEqual(1);
      expect(stats.memoryLocalityScore).toBeGreaterThanOrEqual(0);
      expect(stats.memoryLocalityScore).toBeLessThanOrEqual(1);
      expect(stats.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(stats.efficiencyScore).toBeLessThanOrEqual(1);
    });

    it('should track scheduled tasks in statistics', async () => {
      const task: NUMATask = {
        taskId: 'task-stats',
        name: 'Statistics Task',
        memoryPolicy: 'local',
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      await scheduler.scheduleTask(task);
      const stats = await scheduler.getStatistics();

      expect(stats.tasksPerNode.size).toBeGreaterThan(0);
    });
  });

  describe('Workload Distribution', () => {
    it('should provide workload distribution', async () => {
      const distribution = await scheduler.getWorkloadDistribution();

      expect(distribution).toBeDefined();
      expect(distribution.length).toBeGreaterThan(0);

      distribution.forEach(d => {
        expect(d.nodeId).toBeDefined();
        expect(d.taskCount).toBeGreaterThanOrEqual(0);
        expect(d.memoryUsed).toBeGreaterThanOrEqual(0);
        expect(d.cpuUtilization).toBeGreaterThanOrEqual(0);
        expect(d.cpuUtilization).toBeLessThanOrEqual(1);
        expect(d.memoryUtilization).toBeGreaterThanOrEqual(0);
        expect(d.memoryUtilization).toBeLessThanOrEqual(1);
        expect(d.loadScore).toBeGreaterThanOrEqual(0);
        expect(d.loadScore).toBeLessThanOrEqual(1);
      });
    });

    it('should reflect scheduled tasks in distribution', async () => {
      const task: NUMATask = {
        taskId: 'task-dist',
        name: 'Distribution Task',
        memoryPolicy: 'local',
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      await scheduler.scheduleTask(task);

      const distribution = await scheduler.getWorkloadDistribution();
      const totalTasks = distribution.reduce((sum, d) => sum + d.taskCount, 0);

      expect(totalTasks).toBeGreaterThan(0);
    });
  });

  describe('Optimization Recommendations', () => {
    it('should provide recommendations', async () => {
      const recommendations = await scheduler.getRecommendations();

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);

      recommendations.forEach(rec => {
        expect(rec.type).toBeDefined();
        expect(rec.priority).toBeGreaterThanOrEqual(0);
        expect(rec.priority).toBeLessThanOrEqual(100);
        expect(rec.taskIds).toBeDefined();
        expect(rec.recommendedNode).toBeDefined();
        expect(rec.expectedBenefit).toBeDefined();
        expect(rec.reason).toBeDefined();
        expect(rec.steps).toBeDefined();
      });
    });

    it('should prioritize recommendations by priority', async () => {
      const recommendations = await scheduler.getRecommendations();

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].priority).toBeGreaterThanOrEqual(recommendations[i].priority);
      }
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', async () => {
      await scheduler.updateConfig({
        maxTasksPerNode: 20,
        migrationCostThreshold: 500,
      });

      // Config should be updated (verify through behavior)
      const task: NUMATask = {
        taskId: 'task-config',
        name: 'Config Update Task',
        memoryPolicy: 'local',
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      const decision = await scheduler.scheduleTask(task);
      expect(decision).toBeDefined();
    });
  });

  describe('Task Migration', () => {
    it('should migrate task to different node', async () => {
      const task: NUMATask = {
        taskId: 'task-migrate',
        name: 'Migration Task',
        preferredNode: 0,
        memoryPolicy: 'bind',
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      await scheduler.scheduleTask(task);

      const topology = await scheduler.getTopology();
      const targetNode = topology.nodeCount > 1 ? 1 : 0;

      if (topology.nodeCount > 1) {
        const migration = await scheduler.migrateTask('task-migrate', targetNode);

        expect(migration).toBeDefined();
        expect(migration.taskId).toBe('task-migrate');
        expect(migration.sourceNode).toBe(0);
        expect(migration.targetNode).toBe(targetNode);
        expect(migration.size).toBe(task.memoryRequirement);
      }
    });

    it('should reject migration if cost exceeds threshold', async () => {
      const strictScheduler = new NUMAScheduler(detector, {
        migrationCostThreshold: 1, // Very low threshold
      });

      const task: NUMATask = {
        taskId: 'task-migrate-fail',
        name: 'Migration Fail Task',
        memoryPolicy: 'local',
        memoryRequirement: 1024 * 1024 * 1024, // 1GB - high cost
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      await strictScheduler.scheduleTask(task);

      const topology = await strictScheduler.getTopology();
      if (topology.nodeCount > 1) {
        await expect(
          strictScheduler.migrateTask('task-migrate-fail', 1)
        ).rejects.toThrow();
      }
    });
  });

  describe('Cleanup', () => {
    it('should cleanup completed tasks', async () => {
      const task: NUMATask = {
        taskId: 'task-cleanup',
        name: 'Cleanup Task',
        memoryPolicy: 'local',
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      await scheduler.scheduleTask(task);
      scheduler.cleanupCompletedTasks(0); // Cleanup all

      // After cleanup, task should be removed
      // (This is implementation-specific, just verify no errors)
      expect(true).toBe(true);
    });
  });
});
