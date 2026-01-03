/**
 * @lsi/webgpu-multi - MultiGPU Executor Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiGPUExecutor } from '../src/MultiGPUExecutor';
import type { GPUDevice, WorkTask, CollectiveConfig } from '../src/types';

function createMockDevice(id: string): GPUDevice {
  return {
    device_id: id,
    adapter: {} as any,
    device: {
      createBuffer: vi.fn(() => ({
        destroy: vi.fn(),
        unmap: vi.fn(),
        getMappedRange: vi.fn(() => new ArrayBuffer(100)),
        mapAsync: vi.fn(() => Promise.resolve()),
        size: 100,
      })),
      createBindGroup: vi.fn(),
      createCommandEncoder: vi.fn(() => ({
        beginComputePass: vi.fn(() => ({
          setPipeline: vi.fn(),
          setBindGroup: vi.fn(),
          dispatchWorkgroups: vi.fn(),
          end: vi.fn(),
        })),
        copyBufferToBuffer: vi.fn(),
        finish: vi.fn(),
      })),
      createFence: vi.fn(() => ({ getCompletedValue: vi.fn(() => 1) })),
      queue: {
        submit: vi.fn(),
        onSubmittedWorkDone: vi.fn(() => Promise.resolve()),
      },
    } as any,
    queue: {} as any,
    features: [],
    limits: {} as any,
    type: 'discrete',
    vendor: 'test',
    architecture: 'test',
    memorySize: 4294967296,
    busy: false,
    utilization: 0,
  };
}

function createMockTask(id: string): WorkTask {
  return {
    taskId: id,
    type: 'test',
    inputData: new ArrayBuffer(100),
    kernel: 'test-kernel',
    layouts: [],
    pipelineLayout: null as any,
    pipeline: {
      getBindGroupLayout: vi.fn(),
    } as any,
    workgroupSizes: [1, 1, 1],
    dispatchSizes: [1, 1, 1],
    priority: 0.5,
    estimatedTime: 100,
    dependencies: [],
  };
}

describe('MultiGPUExecutor', () => {
  let executor: MultiGPUExecutor;
  let devices: GPUDevice[];

  beforeEach(() => {
    devices = [createMockDevice('device-0'), createMockDevice('device-1')];
    executor = new MultiGPUExecutor(devices);
  });

  describe('setDevices', () => {
    it('should set devices for execution', () => {
      const newDevices = [createMockDevice('device-2')];
      executor.setDevices(newDevices);

      const stats = executor.getStats();
      expect(stats.totalDevices).toBe(1);
    });
  });

  describe('executeTask', () => {
    it('should execute a task successfully', async () => {
      const task = createMockTask('task-0');
      const result = await executor.executeTask(task, devices[0]);

      expect(result.taskId).toBe('task-0');
      expect(result.success).toBe(true);
    });

    it('should handle execution errors', async () => {
      const task = createMockTask('task-0');
      // Make device throw error
      (devices[0].device.queue.onSubmittedWorkDone as any) = vi.fn(() => Promise.reject(new Error('Test error')));

      const result = await executor.executeTask(task, devices[0]);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('executeTasks', () => {
    it('should execute tasks across devices', async () => {
      const tasks = [
        createMockTask('task-0'),
        createMockTask('task-1'),
      ];

      const assignments = [
        { task: tasks[0], device: devices[0], index: 0, expectedCompletion: 0, status: 'pending' as const },
        { task: tasks[1], device: devices[1], index: 1, expectedCompletion: 0, status: 'pending' as const },
      ];

      const results = await executor.executeTasks(assignments);

      expect(results).toHaveLength(2);
    });

    it('should handle mixed success/failure', async () => {
      const tasks = [createMockTask('task-0'), createMockTask('task-1')];

      const assignments = [
        { task: tasks[0], device: devices[0], index: 0, expectedCompletion: 0, status: 'pending' as const },
        { task: tasks[1], device: devices[1], index: 1, expectedCompletion: 0, status: 'pending' as const },
      ];

      const results = await executor.executeTasks(assignments);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('executeCollective', () => {
    it('should execute reduce operation', async () => {
      const config: CollectiveConfig = {
        operation: 'reduce',
        devices,
        root: devices[0],
        inputData: [new ArrayBuffer(100), new ArrayBuffer(100)],
        dataType: 'float32',
        reduceOp: 'sum',
      };

      const result = await executor.executeCollective(config);

      expect(result.taskId).toContain('collective-reduce');
    });

    it('should execute broadcast operation', async () => {
      const config: CollectiveConfig = {
        operation: 'broadcast',
        devices,
        root: devices[0],
        inputData: new ArrayBuffer(100),
        dataType: 'float32',
      };

      const result = await executor.executeCollective(config);

      expect(result.taskId).toContain('collective-broadcast');
    });

    it('should execute scatter operation', async () => {
      const config: CollectiveConfig = {
        operation: 'scatter',
        devices,
        root: devices[0],
        inputData: [new ArrayBuffer(100), new ArrayBuffer(100)],
        dataType: 'float32',
      };

      const result = await executor.executeCollective(config);

      expect(result.taskId).toContain('collective-scatter');
    });

    it('should execute gather operation', async () => {
      const config: CollectiveConfig = {
        operation: 'gather',
        devices,
        root: devices[0],
        inputData: [new ArrayBuffer(100), new ArrayBuffer(100)],
        dataType: 'float32',
      };

      const result = await executor.executeCollective(config);

      expect(result.taskId).toContain('collective-gather');
    });

    it('should execute allreduce operation', async () => {
      const config: CollectiveConfig = {
        operation: 'allreduce',
        devices,
        inputData: [new ArrayBuffer(100), new ArrayBuffer(100)],
        dataType: 'float32',
        reduceOp: 'sum',
      };

      const result = await executor.executeCollective(config);

      expect(result.taskId).toContain('collective-allreduce');
    });

    it('should execute alltoall operation', async () => {
      const config: CollectiveConfig = {
        operation: 'alltoall',
        devices,
        inputData: [new ArrayBuffer(100), new ArrayBuffer(100)],
        dataType: 'float32',
      };

      const result = await executor.executeCollective(config);

      expect(result.taskId).toContain('collective-alltoall');
    });
  });

  describe('getStats', () => {
    it('should return execution statistics', () => {
      const stats = executor.getStats();

      expect(stats.totalDevices).toBe(devices.length);
      expect(stats.totalTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
    });

    it('should update stats after execution', async () => {
      const task = createMockTask('task-0');
      await executor.executeTask(task, devices[0]);

      const stats = executor.getStats();
      expect(stats.totalTasks).toBe(1);
    });
  });

  describe('getResult', () => {
    it('should return result for task', async () => {
      const task = createMockTask('task-0');
      await executor.executeTask(task, devices[0]);

      const result = executor.getResult('task-0');
      expect(result).toBeDefined();
    });

    it('should return undefined for non-existent task', () => {
      const result = executor.getResult('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('cancelTask', () => {
    it('should cancel active task', () => {
      const task = createMockTask('task-0');
      const assignment = {
        task,
        device: devices[0],
        index: 0,
        expectedCompletion: 0,
        status: 'pending' as const,
      };

      executor['activeTasks'].set('task-0', assignment);

      const cancelled = executor.cancelTask('task-0');
      expect(cancelled).toBe(true);
      expect(executor['activeTasks'].has('task-0')).toBe(false);
    });

    it('should return false for non-existent task', () => {
      const cancelled = executor.cancelTask('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('cancelAll', () => {
    it('should cancel all active tasks', () => {
      const task1 = createMockTask('task-0');
      const task2 = createMockTask('task-1');

      executor['activeTasks'].set('task-0', {
        task: task1,
        device: devices[0],
        index: 0,
        expectedCompletion: 0,
        status: 'pending' as const,
      });
      executor['activeTasks'].set('task-1', {
        task: task2,
        device: devices[1],
        index: 1,
        expectedCompletion: 0,
        status: 'pending' as const,
      });

      executor.cancelAll();

      expect(executor['activeTasks'].size).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset executor state', async () => {
      const task = createMockTask('task-0');
      await executor.executeTask(task, devices[0]);

      executor.reset();

      const stats = executor.getStats();
      expect(stats.totalTasks).toBe(0);
      expect(executor['activeTasks'].size).toBe(0);
      expect(executor['results'].size).toBe(0);
    });
  });

  describe('getActiveTasks', () => {
    it('should return active tasks', () => {
      const task = createMockTask('task-0');

      executor['activeTasks'].set('task-0', {
        task,
        device: devices[0],
        index: 0,
        expectedCompletion: 0,
        status: 'pending' as const,
      });

      const active = executor.getActiveTasks();
      expect(active).toHaveLength(1);
      expect(active[0].task.taskId).toBe('task-0');
    });

    it('should return empty array when no active tasks', () => {
      const active = executor.getActiveTasks();
      expect(active).toHaveLength(0);
    });
  });
});
