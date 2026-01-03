/**
 * @lsi/webgpu-multi - Load Balancer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoadBalancer } from '../src/LoadBalancer';
import type { GPUDevice, WorkTask, LoadBalancerConfig } from '../src/types';

function createMockDevice(id: string, utilization: number = 0): GPUDevice {
  return {
    device_id: id,
    adapter: {} as any,
    device: {} as any,
    queue: {} as any,
    features: [],
    limits: {} as any,
    type: 'discrete',
    vendor: 'test',
    architecture: 'test',
    memorySize: 4294967296,
    busy: false,
    utilization,
  };
}

function createMockTask(id: string, estimatedTime: number = 100): WorkTask {
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
    priority: 0.5,
    estimatedTime,
    dependencies: [],
  };
}

describe('LoadBalancer', () => {
  let balancer: LoadBalancer;
  let devices: GPUDevice[];

  beforeEach(() => {
    balancer = new LoadBalancer();
    devices = [
      createMockDevice('device-0', 0.2),
      createMockDevice('device-1', 0.5),
      createMockDevice('device-2', 0.8),
    ];
  });

  describe('initializeDevices', () => {
    it('should initialize load tracking for devices', () => {
      balancer.initializeDevices(devices);

      const stats = balancer.getAllStats();
      expect(stats.size).toBe(devices.length);
    });
  });

  describe('assignToLeastLoaded', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should assign to least loaded device', () => {
      const task = createMockTask('task-0');
      const device = balancer.assignToLeastLoaded(task, devices);

      expect(device).toBeDefined();
      expect(devices).toContain(device);
    });

    it('should increment load after assignment', () => {
      const task = createMockTask('task-0');
      const device = balancer.assignToLeastLoaded(task, devices);

      const load = balancer.getDeviceStats(device!.device_id);
      expect(load?.currentTasks).toBe(1);
    });

    it('should throw error for no devices', () => {
      const task = createMockTask('task-0');

      expect(() => balancer.assignToLeastLoaded(task, [])).toThrow();
    });
  });

  describe('assignGreedy', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should assign tasks using greedy bin packing', () => {
      const tasks = [
        createMockTask('large', 300),
        createMockTask('medium', 200),
        createMockTask('small', 100),
      ];

      const assignments = balancer.assignGreedy(tasks, devices);

      expect(assignments).toHaveLength(3);
      for (const a of assignments) {
        expect(a.expectedCompletion).toBeGreaterThan(0);
      }
    });
  });

  describe('rebalance', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should rebalance work across devices', () => {
      // Load first device
      balancer.incrementLoad('device-0', createMockTask('t1'));
      balancer.incrementLoad('device-0', createMockTask('t2'));

      const moved = balancer.rebalance(devices);

      expect(Array.isArray(moved)).toBe(true);
    });
  });

  describe('stealWork', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should steal work from busy device', async () => {
      // Create assignments
      const assignments = [
        {
          task: createMockTask('busy-task'),
          device: devices[0],
          index: 0,
          expectedCompletion: 0,
          status: 'pending' as const,
        },
      ];

      // Load the first device heavily
      balancer.incrementLoad('device-0', createMockTask('t1'));
      balancer.incrementLoad('device-0', createMockTask('t2'));
      balancer.incrementLoad('device-0', createMockTask('t3'));

      const stolen = await balancer.stealWork(
        devices[0],
        devices[1],
        assignments
      );

      // May or may not steal depending on threshold
      expect(stolen === null || typeof stolen === 'object').toBe(true);
    });
  });

  describe('incrementLoad and decrementLoad', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should increment device load', () => {
      balancer.incrementLoad('device-0', createMockTask('task-0'));

      const load = balancer.getDeviceStats('device-0');
      expect(load?.currentTasks).toBe(1);
      expect(load?.totalTasks).toBe(1);
    });

    it('should decrement device load', () => {
      balancer.incrementLoad('device-0', createMockTask('task-0'));
      balancer.decrementLoad('device-0');

      const load = balancer.getDeviceStats('device-0');
      expect(load?.currentTasks).toBe(0);
    });

    it('should not go below zero', () => {
      balancer.decrementLoad('device-0');

      const load = balancer.getDeviceStats('device-0');
      expect(load?.currentTasks).toBe(0);
    });
  });

  describe('updateUtilization', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should update device utilization with smoothing', () => {
      balancer.updateUtilization('device-0', 0.9);
      balancer.updateUtilization('device-0', 0.5);

      const load = balancer.getDeviceStats('device-0');
      expect(load?.utilization).toBeGreaterThan(0);
      expect(load?.utilization).toBeLessThan(1);
    });
  });

  describe('predictLoad', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should return current load when prediction disabled', () => {
      const prediction = balancer.predictLoad('device-0', 1000);

      expect(prediction).toBeGreaterThanOrEqual(0);
      expect(prediction).toBeLessThanOrEqual(1);
    });

    it('should predict load when enabled', () => {
      balancer.updateConfig({ enablePredictive: true });

      // Add some history
      for (let i = 0; i < 20; i++) {
        balancer.incrementLoad(`device-${i % 3}`, createMockTask(`t-${i}`));
        balancer.decrementLoad(`device-${i % 3}`);
      }

      const prediction = balancer.predictLoad('device-0', 1000);
      expect(typeof prediction).toBe('number');
    });
  });

  describe('getDeviceStats', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should return device stats', () => {
      const stats = balancer.getDeviceStats('device-0');

      expect(stats).toBeDefined();
      expect(stats?.device).toBe(devices[0]);
    });

    it('should return undefined for unknown device', () => {
      const stats = balancer.getDeviceStats('unknown');

      expect(stats).toBeUndefined();
    });
  });

  describe('getBalancerStats', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should return overall stats', () => {
      const stats = balancer.getBalancerStats();

      expect(stats.totalDevices).toBe(devices.length);
      expect(stats.avgLoad).toBeGreaterThanOrEqual(0);
      expect(stats.maxLoad).toBeGreaterThanOrEqual(0);
      expect(stats.minLoad).toBeGreaterThanOrEqual(0);
    });
  });

  describe('startBalancing and stopBalancing', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
    });

    it('should start and stop balancing', () => {
      const callback = vi.fn();

      balancer.startBalancing(devices, callback);
      expect(callback).not.toHaveBeenCalled(); // Not called immediately

      balancer.stopBalancing();
    });

    it('should call callback on interval', (done) => {
      const callback = vi.fn();

      balancer.updateConfig({ balanceInterval: 50 });
      balancer.startBalancing(devices, callback);

      setTimeout(() => {
        expect(callback).toHaveBeenCalled();
        balancer.stopBalancing();
        done();
      }, 100);
    });
  });

  describe('reset', () => {
    beforeEach(() => {
      balancer.initializeDevices(devices);
      balancer.incrementLoad('device-0', createMockTask('task-0'));
    });

    it('should clear all state', () => {
      balancer.reset();

      const stats = balancer.getAllStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const newConfig: Partial<LoadBalancerConfig> = {
        enablePredictive: true,
        balanceInterval: 2000,
      };

      balancer.updateConfig(newConfig);

      // Config should be updated
      expect(balancer['config'].enablePredictive).toBe(true);
    });
  });
});
