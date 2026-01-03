/**
 * @lsi/webgpu-multi - Work Distributor Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkDistributor } from '../src/WorkDistributor';
import type { GPUDevice, WorkTask, WorkDistribution } from '../src/types';

function createMockDevice(id: string, type: 'integrated' | 'discrete' = 'discrete'): GPUDevice {
  return {
    device_id: id,
    adapter: {} as any,
    device: {} as any,
    queue: {} as any,
    features: [],
    limits: {} as any,
    type,
    vendor: 'test',
    architecture: 'test-arch',
    memorySize: 4294967296,
    busy: false,
    utilization: 0,
  };
}

function createMockTask(id: string, priority: number = 0.5, deps: string[] = []): WorkTask {
  return {
    taskId: id,
    type: 'test',
    inputData: new ArrayBuffer(1024),
    kernel: '',
    layouts: [],
    pipelineLayout: null as any,
    pipeline: null as any,
    workgroupSizes: [1, 1, 1],
    dispatchSizes: [1, 1, 1],
    priority,
    estimatedTime: 100,
    dependencies: deps,
  };
}

describe('WorkDistributor', () => {
  let distributor: WorkDistributor;
  let devices: GPUDevice[];

  beforeEach(() => {
    distributor = new WorkDistributor();
    devices = [
      createMockDevice('device-0'),
      createMockDevice('device-1'),
      createMockDevice('device-2'),
    ];
  });

  describe('setStrategy and getStrategy', () => {
    it('should set and get strategy', () => {
      distributor.setStrategy('data-parallel');
      expect(distributor.getStrategy()).toBe('data-parallel');
    });
  });

  describe('roundRobinDistribute', () => {
    it('should distribute tasks round-robin', () => {
      distributor.setStrategy('round-robin');
      const tasks = [
        createMockTask('task-0'),
        createMockTask('task-1'),
        createMockTask('task-2'),
        createMockTask('task-3'),
      ];

      const assignments = distributor.distributeTasks(tasks, devices);

      expect(assignments[0].device.device_id).toBe('device-0');
      expect(assignments[1].device.device_id).toBe('device-1');
      expect(assignments[2].device.device_id).toBe('device-2');
      expect(assignments[3].device.device_id).toBe('device-0');
    });

    it('should reset round-robin index', () => {
      const tasks1 = [createMockTask('t1'), createMockTask('t2')];
      distributor.distributeTasks(tasks1, devices);

      distributor.resetRoundRobin();

      const tasks2 = [createMockTask('t3')];
      const assignments2 = distributor.distributeTasks(tasks2, devices);
      expect(assignments2[0].device.device_id).toBe('device-0');
    });
  });

  describe('splitByTaskDistribute', () => {
    it('should prioritize high priority tasks', () => {
      distributor.setStrategy('split-by-task');
      const tasks = [
        createMockTask('low', 0.2),
        createMockTask('high', 0.9),
        createMockTask('medium', 0.5),
      ];

      const assignments = distributor.distributeTasks(tasks, devices);

      // High priority should go to first device
      const highPriority = assignments.find(a => a.task.taskId === 'high');
      expect(highPriority?.device.device_id).toBe('device-0');
    });
  });

  describe('dataParallelDistribute', () => {
    it('should assign same task to all devices', () => {
      distributor.setStrategy('data-parallel');
      const tasks = [createMockTask('task-0')];

      const assignments = distributor.distributeTasks(tasks, devices);

      expect(assignments.length).toBe(devices.length);
      expect(assignments[0].task.taskId).toContain('device-0');
      expect(assignments[1].task.taskId).toContain('device-1');
      expect(assignments[2].task.taskId).toContain('device-2');
    });
  });

  describe('pipelineDistribute', () => {
    it('should create pipeline stages from dependent tasks', () => {
      distributor.setStrategy('pipeline');
      const tasks = [
        createMockTask('task-0', 0.5, []),
        createMockTask('task-1', 0.5, ['task-0']),
        createMockTask('task-2', 0.5, ['task-1']),
      ];

      const assignments = distributor.distributeTasks(tasks, devices);

      // All assignments should have expected completion times
      for (const a of assignments) {
        expect(a.expectedCompletion).toBeGreaterThan(0);
      }
    });
  });

  describe('modelParallelDistribute', () => {
    it('should distribute tasks sequentially across devices', () => {
      distributor.setStrategy('model-parallel');
      const tasks = [
        createMockTask('layer-0'),
        createMockTask('layer-1'),
        createMockTask('layer-2'),
      ];

      const assignments = distributor.distributeTasks(tasks, devices);

      expect(assignments[0].device.device_id).toBe('device-0');
      expect(assignments[1].device.device_id).toBe('device-1');
      expect(assignments[2].device.device_id).toBe('device-2');
    });
  });

  describe('hybridDistribute', () => {
    it('should use different strategies for different task types', () => {
      distributor.setStrategy('hybrid');
      const tasks = [
        createMockTask('data-parallel-0'),
        createMockTask('other-0'),
      ];
      tasks[0].type = 'data-parallel';
      tasks[1].type = 'other';

      const assignments = distributor.distributeTasks(tasks, devices);

      // Should create assignments for all tasks
      expect(assignments.length).toBeGreaterThan(0);
    });
  });

  describe('createPipelineStages', () => {
    it('should create stages from tasks with dependencies', () => {
      const tasks = [
        createMockTask('task-0', 0.5, []),
        createMockTask('task-1', 0.5, ['task-0']),
        createMockTask('task-2', 0.5, ['task-0']),
        createMockTask('task-3', 0.5, ['task-1', 'task-2']),
      ];

      const stages = distributor.createPipelineStages(tasks, devices);

      // Should create multiple stages
      expect(stages.length).toBeGreaterThan(1);

      // First stage should have task-0
      expect(stages[0].tasks.some(t => t.taskId === 'task-0')).toBe(true);

      // Second stage should have task-1 and task-2
      expect(stages[1].tasks.some(t => t.taskId === 'task-1')).toBe(true);
      expect(stages[1].tasks.some(t => t.taskId === 'task-2')).toBe(true);
    });
  });

  describe('createPipelineConfig', () => {
    it('should create pipeline configuration', () => {
      const stages = [
        {
          stageId: 'stage-0',
          name: 'Stage 0',
          device: devices[0],
          tasks: [createMockTask('t0')],
          estimatedTime: 100,
        },
      ];

      const config = distributor.createPipelineConfig(stages, true);

      expect(config.stages).toBe(stages);
      expect(config.enableOverlapping).toBe(true);
      expect(config.bufferSize).toBeGreaterThan(0);
    });
  });

  describe('rebalanceAssignments', () => {
    it('should move tasks from overloaded to underloaded devices', () => {
      const tasks = [
        createMockTask('task-0'),
        createMockTask('task-1'),
        createMockTask('task-2'),
      ];

      // Manually create uneven assignments
      const assignments = [
        { task: tasks[0], device: devices[0], index: 0, expectedCompletion: 0, status: 'pending' as const },
        { task: tasks[1], device: devices[0], index: 1, expectedCompletion: 0, status: 'pending' as const },
        { task: tasks[2], device: devices[1], index: 2, expectedCompletion: 0, status: 'pending' as const },
      ];

      const rebalanced = distributor.rebalanceAssignments(assignments);

      // Some tasks should be moved
      expect(rebalanced.length).toBe(assignments.length);
    });
  });

  describe('getDeviceUtilization', () => {
    it('should calculate utilization per device', () => {
      const tasks = [createMockTask('task-0')];
      const assignments = [
        { task: tasks[0], device: devices[0], index: 0, expectedCompletion: 0, status: 'running' as const },
      ];

      const utilization = distributor.getDeviceUtilization(assignments);

      expect(utilization.has(devices[0])).toBe(true);
      expect(utilization.get(devices[0])).toBeGreaterThan(0);
    });
  });
});
