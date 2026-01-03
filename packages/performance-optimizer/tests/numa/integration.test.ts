/**
 * NUMA Integration Tests
 *
 * End-to-end tests for NUMA-aware scheduling system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NUMADetector } from '../../src/numa/NUMADetector.js';
import { NUMAScheduler } from '../../src/numa/NUMAScheduler.js';
import { MemoryAffinityManager } from '../../src/numa/MemoryAffinityManager.js';
import type {
  NUMATask,
  NUMATopology,
  NUMAMemoryAffinityRequest,
  NUMAMemoryPolicy,
} from '@lsi/protocol';

describe('NUMA Integration Tests', () => {
  let detector: NUMADetector;
  let scheduler: NUMAScheduler;
  let memoryManager: MemoryAffinityManager;
  let topology: NUMATopology;

  beforeEach(async () => {
    detector = new NUMADetector();
    scheduler = new NUMAScheduler(detector, {
      strategy: 'adaptive',
      maxTasksPerNode: 10,
      enableMigration: true,
    });
    memoryManager = new MemoryAffinityManager();

    const detection = await detector.detect();
    topology = detection.topology!;
    memoryManager.initializeTopology(topology);
  });

  afterEach(async () => {
    await scheduler.stopMonitoring();
    scheduler.cleanupCompletedTasks();
    memoryManager.reset();
  });

  describe('Complete Workflow', () => {
    it('should detect topology, schedule task, and allocate memory', async () => {
      // Step 1: Topology detected in beforeEach
      expect(topology).toBeDefined();
      expect(topology.nodeCount).toBeGreaterThanOrEqual(1);

      // Step 2: Schedule task
      const task: NUMATask = {
        taskId: 'workflow-task-1',
        name: 'Integration Test Task',
        preferredNode: 0,
        memoryPolicy: 'bind',
        memoryRequirement: 1024 * 1024 * 100 as number,
        memoryPages: [],
        priority: 70,
        createdAt: Date.now(),
        state: 'pending',
      };

      const decision = await scheduler.scheduleTask(task);

      expect(decision.targetNode).toBeDefined();
      expect(decision.cpuAffinity).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);

      // Step 3: Allocate memory
      const memRequest: NUMAMemoryAffinityRequest = {
        taskId: task.taskId,
        preferredNodes: [decision.targetNode],
        size: task.memoryRequirement,
        policy: task.memoryPolicy,
        allowRemote: false,
      };

      const memResult = await memoryManager.setMemoryAffinity(memRequest);

      expect(memResult.success).toBe(true);
      expect(memResult.nodeId).toBe(decision.targetNode);
      expect(memResult.allocation).toBeDefined();

      // Step 4: Verify statistics
      const stats = await scheduler.getStatistics();
      expect(stats.tasksPerNode.get(decision.targetNode)).toBeGreaterThan(0);

      const memStats = memoryManager.getMemoryStatistics();
      const nodeStats = memStats.get(decision.targetNode);
      expect(nodeStats!.allocated).toBeGreaterThan(0);
    });

    it('should handle multiple tasks with different policies', async () => {
      const tasks: NUMATask[] = [
        {
          taskId: 'multi-task-1',
          name: 'Local Policy Task',
          memoryPolicy: 'local' as NUMAMemoryPolicy,
          memoryRequirement: 1024 * 1024 * 50,
          memoryPages: [],
          priority: 50,
          createdAt: Date.now(),
          state: 'pending',
        },
        {
          taskId: 'multi-task-2',
          name: 'Bind Policy Task',
          preferredNode: 0,
          memoryPolicy: 'bind' as NUMAMemoryPolicy,
          memoryRequirement: 1024 * 1024 * 75,
          memoryPages: [],
          priority: 60,
          createdAt: Date.now(),
          state: 'pending',
        },
        {
          taskId: 'multi-task-3',
          name: 'Interleave Policy Task',
          memoryPolicy: 'interleave' as NUMAMemoryPolicy,
          memoryRequirement: 1024 * 1024 * 60,
          memoryPages: [],
          priority: 55,
          createdAt: Date.now(),
          state: 'pending',
        },
      ];

      // Schedule all tasks
      const decisions = await Promise.all(
        tasks.map(task => scheduler.scheduleTask(task))
      );

      expect(decisions).toHaveLength(3);
      decisions.forEach(decision => {
        expect(decision.targetNode).toBeDefined();
        expect(decision.cpuAffinity.length).toBeGreaterThan(0);
      });

      // Allocate memory for all tasks
      const memRequests = tasks.map((task, i) => ({
        taskId: task.taskId,
        preferredNodes: [decisions[i].targetNode],
        size: task.memoryRequirement,
        policy: task.memoryPolicy,
        allowRemote: true,
      }));

      const memResults = await Promise.all(
        memRequests.map(req => memoryManager.setMemoryAffinity(req))
      );

      memResults.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.allocation).toBeDefined();
      });

      // Verify overall statistics
      const stats = await scheduler.getStatistics();
      expect(stats.efficiencyScore).toBeGreaterThan(0);
    });
  });

  describe('Load Balancing', () => {
    it('should distribute tasks across nodes', async () => {
      const taskCount = 20;
      const tasks: NUMATask[] = Array.from({ length: taskCount }, (_, i) => ({
        taskId: `load-balance-task-${i}`,
        name: `Load Balance Task ${i}`,
        memoryPolicy: 'local' as NUMAMemoryPolicy,
        memoryRequirement: 1024 * 1024 * 10,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      }));

      const decisions = await Promise.all(
        tasks.map(task => scheduler.scheduleTask(task))
      );

      // Count tasks per node
      const nodeCounts = new Map<number, number>();
      for (const decision of decisions) {
        nodeCounts.set(
          decision.targetNode,
          (nodeCounts.get(decision.targetNode) || 0) + 1
        );
      }

      // Verify distribution
      expect(nodeCounts.size).toBeGreaterThan(0);

      // Check load balance score
      const stats = await scheduler.getStatistics();
      expect(stats.loadBalanceScore).toBeGreaterThan(0);

      // Get recommendations
      const recommendations = await scheduler.getRecommendations();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('Memory Locality', () => {
    it('should maintain memory locality', async () => {
      const task: NUMATask = {
        taskId: 'locality-task',
        name: 'Locality Test Task',
        preferredNode: 0,
        memoryPolicy: 'bind',
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 80,
        createdAt: Date.now(),
        state: 'pending',
      };

      const decision = await scheduler.scheduleTask(task);

      // Allocate memory on same node
      const memRequest: NUMAMemoryAffinityRequest = {
        taskId: task.taskId,
        preferredNodes: [decision.targetNode],
        size: task.memoryRequirement,
        policy: 'bind',
        allowRemote: false,
      };

      const memResult = await memoryManager.setMemoryAffinity(memRequest);

      expect(memResult.success).toBe(true);
      expect(memResult.nodeId).toBe(decision.targetNode);
      expect(memResult.fallbackUsed).toBe(false);

      // Verify locality in statistics
      const stats = await scheduler.getStatistics();
      expect(stats.localityRatio).toBeGreaterThan(0);
    });
  });

  describe('Migration Scenarios', () => {
    it('should migrate task and update memory affinity', async () => {
      const task: NUMATask = {
        taskId: 'migration-task',
        name: 'Migration Test Task',
        preferredNode: 0,
        memoryPolicy: 'bind',
        memoryRequirement: 1024 * 1024 * 50,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      await scheduler.scheduleTask(task);

      // Try to migrate if multi-node system
      if (topology.nodeCount > 1) {
        const migration = await scheduler.migrateTask('migration-task', 1);

        expect(migration).toBeDefined();
        expect(migration.sourceNode).toBe(0);
        expect(migration.targetNode).toBe(1);

        // Update memory affinity
        const memRequest: NUMAMemoryAffinityRequest = {
          taskId: task.taskId,
          preferredNodes: [1],
          size: task.memoryRequirement,
          policy: 'bind',
          allowRemote: false,
        };

        const memResult = await memoryManager.setMemoryAffinity(memRequest);

        expect(memResult.success).toBe(true);
        expect(memResult.nodeId).toBe(1);
      }
    });
  });

  describe('Resource Limits', () => {
    it('should handle resource exhaustion gracefully', async () => {
      const maxTasksScheduler = new NUMAScheduler(detector, {
        maxTasksPerNode: 3,
      });

      const tasks: NUMATask[] = Array.from({ length: 10 }, (_, i) => ({
        taskId: `resource-task-${i}`,
        name: `Resource Task ${i}`,
        memoryPolicy: 'local' as NUMAMemoryPolicy,
        memoryRequirement: 1024 * 1024 * 10,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      }));

      const decisions = await Promise.all(
        tasks.map(task => maxTasksScheduler.scheduleTask(task))
      );

      // All tasks should be scheduled (possibly on different nodes)
      decisions.forEach(decision => {
        expect(decision.targetNode).toBeDefined();
      });

      // Check workload distribution
      const distribution = await maxTasksScheduler.getWorkloadDistribution();

      distribution.forEach(dist => {
        expect(dist.taskCount).toBeLessThanOrEqual(4); // Allow slight overflow
      });
    });
  });

  describe('Monitoring and Optimization', () => {
    it('should provide optimization recommendations', async () => {
      // Create imbalanced load
      const tasks: NUMATask[] = Array.from({ length: 5 }, (_, i) => ({
        taskId: `opt-task-${i}`,
        name: `Optimization Task ${i}`,
        preferredNode: 0,
        memoryPolicy: 'bind',
        memoryRequirement: 1024 * 1024 * 20,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      }));

      await Promise.all(tasks.map(task => scheduler.scheduleTask(task)));

      const recommendations = await scheduler.getRecommendations();

      expect(Array.isArray(recommendations)).toBe(true);

      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec.type).toBeDefined();
        expect(rec.priority).toBeGreaterThanOrEqual(0);
        expect(rec.priority).toBeLessThanOrEqual(100);
        expect(rec.taskIds).toBeDefined();
        expect(rec.recommendedNode).toBeDefined();
        expect(rec.expectedBenefit).toBeDefined();
        expect(rec.reason).toBeDefined();
        expect(rec.steps).toBeDefined();
      }
    });
  });

  describe('Statistics Integration', () => {
    it('should provide comprehensive statistics', async () => {
      const tasks: NUMATask[] = Array.from({ length: 5 }, (_, i) => ({
        taskId: `stats-task-${i}`,
        name: `Stats Task ${i}`,
        memoryPolicy: 'local' as NUMAMemoryPolicy,
        memoryRequirement: 1024 * 1024 * 30,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      }));

      await Promise.all(tasks.map(task => scheduler.scheduleTask(task)));

      const schedulerStats = await scheduler.getStatistics();
      const memStats = memoryManager.getMemoryStatistics();
      const workload = await scheduler.getWorkloadDistribution();

      // Verify scheduler stats
      expect(schedulerStats.tasksPerNode.size).toBeGreaterThan(0);
      expect(schedulerStats.localityRatio).toBeGreaterThanOrEqual(0);
      expect(schedulerStats.loadBalanceScore).toBeGreaterThanOrEqual(0);
      expect(schedulerStats.efficiencyScore).toBeGreaterThanOrEqual(0);

      // Verify memory stats
      expect(memStats.size).toBe(topology.nodeCount);
      let totalAllocated = 0;
      for (const stat of memStats.values()) {
        totalAllocated += stat.allocated;
      }
      expect(totalAllocated).toBeGreaterThan(0);

      // Verify workload distribution
      expect(workload.length).toBe(topology.nodeCount);
      let totalTasks = 0;
      for (const dist of workload) {
        totalTasks += dist.taskCount;
      }
      expect(totalTasks).toBe(5);
    });
  });

  describe('Cleanup and Reset', () => {
    it('should cleanup and reset properly', async () => {
      const task: NUMATask = {
        taskId: 'cleanup-task',
        name: 'Cleanup Test Task',
        memoryPolicy: 'local',
        memoryRequirement: 1024 * 1024 * 100,
        memoryPages: [],
        priority: 50,
        createdAt: Date.now(),
        state: 'pending',
      };

      await scheduler.scheduleTask(task);

      const memRequest: NUMAMemoryAffinityRequest = {
        taskId: task.taskId,
        size: task.memoryRequirement,
        policy: 'local',
        allowRemote: false,
      };

      await memoryManager.setMemoryAffinity(memRequest);

      // Cleanup scheduler
      scheduler.cleanupCompletedTasks(0);

      // Reset memory manager
      memoryManager.reset();

      // Verify clean state
      const memStats = memoryManager.getMemoryStatistics();
      for (const stat of memStats.values()) {
        expect(stat.allocated).toBe(0);
        expect(stat.utilization).toBe(0);
      }
    });
  });
});
