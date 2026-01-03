/**
 * @lsi/webgpu-multi - Type Validation Tests
 */

import { describe, it, expect } from 'vitest';
import type {
  GPUDevice,
  DeviceSelection,
  WorkDistribution,
  SyncStrategy,
  MultiGPUConfig,
  GPUDeviceInfo,
  WorkTask,
  TaskAssignment,
  DataDistribution,
  SyncPoint,
  CollectiveOperation,
  CollectiveConfig,
  LoadBalancerConfig,
  GPUSelectionCriteria,
  MultiGPUResult,
  MultiGPUStats,
  PipelineStage,
  PipelineConfig,
  DeviceMemoryPool,
  PeerAccessInfo,
} from '../src/types';

describe('Type Definitions', () => {
  describe('GPUDevice', () => {
    it('should accept valid GPUDevice', () => {
      const device: GPUDevice = {
        device_id: 'test-device',
        adapter: {} as any,
        device: {} as any,
        queue: {} as any,
        features: ['feature1', 'feature2'],
        limits: {} as any,
        type: 'discrete',
        vendor: 'NVIDIA',
        architecture: 'Ada',
        memorySize: 8589934592,
        busy: false,
        utilization: 0.5,
        temperature: 65,
        powerUsage: 120,
      };

      expect(device.device_id).toBe('test-device');
      expect(device.features).toHaveLength(2);
    });

    it('should accept all device types', () => {
      const types: Array<GPUDevice['type']> = ['integrated', 'discrete', 'cpu', 'unknown'];

      for (const type of types) {
        const device: Partial<GPUDevice> = { type };
        expect(device.type).toBe(type);
      }
    });
  });

  describe('DeviceSelection', () => {
    it('should accept all selection types', () => {
      const selections: DeviceSelection[] = ['auto', 'integrated', 'discrete', 'specific', 'cpu'];

      for (const selection of selections) {
        expect(selection).toBeDefined();
      }
    });
  });

  describe('WorkDistribution', () => {
    it('should accept all distribution types', () => {
      const distributions: WorkDistribution[] = [
        'round-robin',
        'split-by-task',
        'data-parallel',
        'pipeline',
        'model-parallel',
        'hybrid',
      ];

      for (const dist of distributions) {
        expect(dist).toBeDefined();
      }
    });
  });

  describe('SyncStrategy', () => {
    it('should accept all sync strategies', () => {
      const strategies: SyncStrategy[] = ['barrier', 'event', 'fence', 'timeline', 'callback'];

      for (const strategy of strategies) {
        expect(strategy).toBeDefined();
      }
    });
  });

  describe('MultiGPUConfig', () => {
    it('should accept valid config', () => {
      const config: MultiGPUConfig = {
        devices: [] as any,
        workDistribution: 'round-robin',
        syncStrategy: 'barrier',
        maxDevices: 2,
        enableLoadBalancing: true,
        enableWorkStealing: false,
        loadBalanceThreshold: 0.7,
        memoryPerDevice: 4294967296,
        usePeerAccess: false,
        timeout: 5000,
      };

      expect(config.workDistribution).toBe('round-robin');
      expect(config.maxDevices).toBe(2);
    });
  });

  describe('WorkTask', () => {
    it('should accept valid task', () => {
      const task: WorkTask = {
        taskId: 'task-0',
        type: 'compute',
        inputData: new ArrayBuffer(1024),
        kernel: 'test-kernel',
        layouts: [] as any,
        pipelineLayout: null as any,
        pipeline: null as any,
        workgroupSizes: [16, 16, 1],
        dispatchSizes: [64, 64, 1],
        priority: 0.8,
        estimatedTime: 100,
        memoryRequired: 1048576,
        dependencies: ['task-1', 'task-2'],
      };

      expect(task.taskId).toBe('task-0');
      expect(task.dependencies).toHaveLength(2);
    });
  });

  describe('TaskAssignment', () => {
    it('should accept valid assignment', () => {
      const assignment: TaskAssignment = {
        task: {} as any,
        device: {} as any,
        index: 0,
        expectedCompletion: Date.now() + 100,
        status: 'pending',
      };

      expect(assignment.index).toBe(0);
      expect(assignment.status).toBe('pending');
    });

    it('should accept all status values', () => {
      const statuses: Array<TaskAssignment['status']> = ['pending', 'running', 'completed', 'failed'];

      for (const status of statuses) {
        const assignment: Partial<TaskAssignment> = { status };
        expect(assignment.status).toBe(status);
      }
    });
  });

  describe('CollectiveOperation', () => {
    it('should accept all operation types', () => {
      const operations: CollectiveOperation[] = [
        'reduce',
        'allreduce',
        'broadcast',
        'scatter',
        'gather',
        'alltoall',
      ];

      for (const op of operations) {
        expect(op).toBeDefined();
      }
    });
  });

  describe('CollectiveConfig', () => {
    it('should accept valid config for each operation', () => {
      const operations: CollectiveOperation[] = ['reduce', 'allreduce', 'broadcast', 'scatter', 'gather', 'alltoall'];
      const dataTypes: Array<CollectiveConfig['dataType']> = ['float32', 'float16', 'int32', 'int16', 'int8'];
      const reduceOps: Array<NonNullable<CollectiveConfig['reduceOp']>> = ['sum', 'min', 'max', 'avg', 'prod'];

      for (const operation of operations) {
        for (const dataType of dataTypes) {
          const config: CollectiveConfig = {
            operation,
            devices: [] as any,
            root: {} as any,
            inputData: [new ArrayBuffer(100)],
            outputData: [new ArrayBuffer(100)],
            dataType,
            reduceOp: operation === 'reduce' || operation === 'allreduce' ? reduceOps[0] : undefined,
          };

          expect(config.operation).toBe(operation);
          expect(config.dataType).toBe(dataType);
        }
      }
    });
  });

  describe('LoadBalancerConfig', () => {
    it('should accept valid config', () => {
      const config: LoadBalancerConfig = {
        enablePredictive: true,
        balanceInterval: 1000,
        loadSmoothing: 0.5,
        enableWorkStealing: true,
        stealThreshold: 0.7,
        maxStealAttempts: 5,
      };

      expect(config.enablePredictive).toBe(true);
      expect(config.balanceInterval).toBe(1000);
    });
  });

  describe('GPUSelectionCriteria', () => {
    it('should accept valid criteria', () => {
      const criteria: GPUSelectionCriteria = {
        type: 'discrete',
        minMemory: 4294967296,
        requiredFeatures: ['feature1', 'feature2'],
        preferredFeatures: ['feature3'],
        maxPower: 200,
        maxTemperature: 85,
        minPerformance: 0.7,
        considerThermal: true,
        considerPower: true,
      };

      expect(criteria.type).toBe('discrete');
      expect(criteria.requiredFeatures).toHaveLength(2);
    });
  });

  describe('MultiGPUResult', () => {
    it('should accept valid result', () => {
      const result: MultiGPUResult = {
        taskId: 'task-0',
        success: true,
        deviceResults: new Map(),
        executionTime: 100,
        transferTime: 20,
        computeTime: 70,
        syncTime: 10,
        memoryUsed: 1048576,
        energyConsumed: 50,
      };

      expect(result.success).toBe(true);
      expect(result.executionTime).toBe(100);
    });

    it('should accept result with error', () => {
      const result: MultiGPUResult = {
        taskId: 'task-0',
        success: false,
        deviceResults: new Map(),
        executionTime: 50,
        transferTime: 0,
        computeTime: 0,
        syncTime: 0,
        memoryUsed: 0,
        error: new Error('Test error'),
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('MultiGPUStats', () => {
    it('should accept valid stats', () => {
      const stats: MultiGPUStats = {
        totalDevices: 4,
        activeDevices: 3,
        totalTasks: 100,
        completedTasks: 95,
        failedTasks: 5,
        avgTaskTime: 150,
        avgUtilization: 0.7,
        totalDataTransferred: 1073741824,
        totalComputeTime: 10000,
        totalSyncTime: 500,
        efficiency: 0.85,
        speedup: 3.2,
      };

      expect(stats.totalDevices).toBe(4);
      expect(stats.efficiency).toBe(0.85);
      expect(stats.speedup).toBe(3.2);
    });
  });

  describe('PipelineStage', () => {
    it('should accept valid stage', () => {
      const stage: PipelineStage = {
        stageId: 'stage-0',
        name: 'Encoder Stage',
        device: {} as any,
        tasks: [] as any,
        inputFrom: undefined,
        outputTo: 'stage-1',
        estimatedTime: 50,
      };

      expect(stage.stageId).toBe('stage-0');
      expect(stage.estimatedTime).toBe(50);
    });
  });

  describe('PipelineConfig', () => {
    it('should accept valid config', () => {
      const config: PipelineConfig = {
        stages: [] as any,
        enableOverlapping: true,
        bufferSize: 1048576,
      };

      expect(config.enableOverlapping).toBe(true);
      expect(config.bufferSize).toBe(1048576);
    });
  });

  describe('DeviceMemoryPool', () => {
    it('should accept valid pool', () => {
      const pool: DeviceMemoryPool = {
        device: {} as any,
        buffers: new Map(),
        totalAllocated: 1073741824,
        availableMemory: 3221225472,
        usage: new Map(),
      };

      expect(pool.totalAllocated).toBe(1073741824);
      expect(pool.availableMemory).toBe(3221225472);
    });
  });

  describe('PeerAccessInfo', () => {
    it('should accept valid info', () => {
      const info: PeerAccessInfo = {
        fromDevice: {} as any,
        toDevice: {} as any,
        supported: true,
        accessMode: 'read-write',
        bandwidth: 25000,
        latency: 15,
      };

      expect(info.supported).toBe(true);
      expect(info.bandwidth).toBe(25000);
    });

    it('should accept all access modes', () => {
      const modes: Array<PeerAccessInfo['accessMode']> = ['read', 'write', 'read-write'];

      for (const mode of modes) {
        const info: Partial<PeerAccessInfo> = { accessMode: mode };
        expect(info.accessMode).toBe(mode);
      }
    });
  });
});
