/**
 * @lsi/webgpu-multi - GPU Selector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GPUSelector } from '../src/GPUSelector';
import type { GPUDevice, GPUSelectionCriteria, DeviceSelection, WorkTask } from '../src/types';

function createMockDevice(
  id: string,
  type: 'integrated' | 'discrete' | 'cpu' = 'discrete',
  utilization: number = 0,
  temperature?: number,
  powerUsage?: number
): GPUDevice {
  return {
    device_id: id,
    adapter: {} as any,
    device: {} as any,
    queue: {} as any,
    features: ['timestamp-query', 'texture-compression-bc'],
    limits: {} as any,
    type,
    vendor: 'test-vendor',
    architecture: 'test-arch',
    memorySize: 4294967296,
    busy: false,
    utilization,
    temperature,
    powerUsage,
  };
}

describe('GPUSelector', () => {
  let selector: GPUSelector;
  let devices: GPUDevice[];

  beforeEach(() => {
    selector = new GPUSelector();
    devices = [
      createMockDevice('device-0', 'discrete', 0.2, 65, 120),
      createMockDevice('device-1', 'integrated', 0.5, 75, 30),
      createMockDevice('device-2', 'discrete', 0.8, 85, 200),
    ];
  });

  describe('selectDevice', () => {
    it('should return best device', async () => {
      const device = await selector.selectDevice(devices);

      expect(device).toBeDefined();
      expect(devices).toContain(device);
    });

    it('should return null for empty device list', async () => {
      const device = await selector.selectDevice([]);
      expect(device).toBeNull();
    });

    it('should return single device when only one', async () => {
      const device = await selector.selectDevice([devices[0]]);
      expect(device).toBe(devices[0]);
    });

    it('should respect type preference', async () => {
      const device = await selector.selectDevice(devices, { type: 'integrated' });

      expect(device?.type).toBe('integrated');
    });

    it('should respect min memory requirement', async () => {
      const largeMem = createMockDevice('large', 'discrete', 0, undefined, undefined);
      (largeMem as any).memorySize = 16 * 1024 * 1024 * 1024;

      const device = await selector.selectDevice([devices[0], largeMem], {
        minMemory: 8 * 1024 * 1024 * 1024,
      });

      expect(device?.device_id).toBe('large');
    });
  });

  describe('selectDevices', () => {
    it('should return multiple devices', async () => {
      const selected = await selector.selectDevices(devices, 2);

      expect(selected).toHaveLength(2);
    });

    it('should return fewer devices if requested more than available', async () => {
      const selected = await selector.selectDevices(devices, 10);

      expect(selected.length).toBeLessThanOrEqual(devices.length);
    });

    it('should return devices sorted by score', async () => {
      const selected = await selector.selectDevices(devices, 3);

      // First device should have highest score
      expect(selected[0]).toBeDefined();
    });
  });

  describe('scoreDevices', () => {
    it('should score all devices', async () => {
      const scores = await selector.scoreDevices(devices);

      expect(scores).toHaveLength(devices.length);
      for (const score of scores) {
        expect(score.device).toBeDefined();
        expect(score.score).toBeGreaterThanOrEqual(0);
        expect(score.reasons).toBeDefined();
      }
    });

    it('should sort by score descending', async () => {
      const scores = await selector.scoreDevices(devices);

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score);
      }
    });
  });

  describe('scoreDevice', () => {
    it('should score discrete GPUs higher than integrated', async () => {
      const discrete = await selector.scoreDevice(devices[0]);
      const integrated = await selector.scoreDevice(devices[1]);

      expect(discrete.score).toBeGreaterThan(integrated.score);
    });

    it('should penalize high utilization', async () => {
      const lowUtil = await selector.scoreDevice(devices[0]);
      const highUtil = await selector.scoreDevice(devices[2]);

      expect(lowUtil.score).toBeGreaterThan(highUtil.score);
    });

    it('should penalize high temperature when enabled', async () => {
      const withThermal = await selector.scoreDevice(devices[2], { considerThermal: true });
      const withoutThermal = await selector.scoreDevice(devices[2], { considerThermal: false });

      expect(withThermal.score).toBeLessThan(withoutThermal.score);
    });

    it('should penalize high power when enabled', async () => {
      const withPower = await selector.scoreDevice(devices[2], { considerPower: true, maxPower: 150 });
      const withoutPower = await selector.scoreDevice(devices[2]);

      expect(withPower.score).toBeLessThan(withoutPower.score);
    });

    it('should check required features', async () => {
      const device = createMockDevice('test', 'discrete', 0);
      device.features = ['feature-a'];

      const score = await selector.scoreDevice(device, {
        requiredFeatures: ['feature-a', 'feature-b'],
      });

      expect(score.score).toBeLessThan(0); // Should be disqualified
    });
  });

  describe('scoreByType', () => {
    it('should give highest score for matching discrete preference', async () => {
      const score = await selector['scoreByType'](devices[0], 'discrete');
      expect(score.score).toBeGreaterThan(50);
    });

    it('should give highest score for matching integrated preference', async () => {
      const score = await selector['scoreByType'](devices[1], 'integrated');
      expect(score.score).toBeGreaterThan(50);
    });
  });

  describe('scoreByMemory', () => {
    it('should give bonus for sufficient memory', async () => {
      const score = await selector['scoreByMemory'](devices[0], 1024);
      expect(score.score).toBeGreaterThan(50);
    });
  });

  describe('scoreByFeatures', () => {
    it('should reward preferred features', async () => {
      const score = await selector['scoreByFeatures'](devices[0], {
        preferredFeatures: ['timestamp-query'],
      });

      expect(score.score).toBeGreaterThan(0);
    });
  });

  describe('scoreByThermal', () => {
    it('should give bonus for low temperature', async () => {
      const coolDevice = createMockDevice('cool', 'discrete', 0, 50);
      const score = await selector['scoreByThermal'](coolDevice, true);

      expect(score.score).toBeGreaterThan(0);
    });

    it('should penalize high temperature', async () => {
      const hotDevice = createMockDevice('hot', 'discrete', 0, 90);
      const score = await selector['scoreByThermal'](hotDevice, true);

      expect(score.score).toBeLessThan(0);
    });
  });

  describe('scoreByPower', () => {
    it('should reward low power consumption', async () => {
      const lowPower = createMockDevice('low-power', 'integrated', 0, undefined, 30);
      const score = await selector['scoreByPower'](lowPower, true);

      expect(score.score).toBeGreaterThan(10);
    });

    it('should penalize exceeding power budget', async () => {
      const highPower = createMockDevice('high-power', 'discrete', 0, undefined, 250);
      const score = await selector['scoreByPower'](highPower, true, 200);

      expect(score.score).toBeLessThan(0);
    });
  });

  describe('scoreByUtilization', () => {
    it('should reward low utilization', async () => {
      const lowUtil = createMockDevice('low-util', 'discrete', 0.1);
      const score = await selector['scoreByUtilization'](lowUtil);

      expect(score.score).toBeGreaterThan(20);
    });

    it('should penalize very high utilization', async () => {
      const highUtil = createMockDevice('high-util', 'discrete', 0.95);
      const score = await selector['scoreByUtilization'](highUtil);

      expect(score.score).toBeLessThan(0);
    });
  });

  describe('recordPerformance', () => {
    it('should record performance data', () => {
      selector.recordPerformance('device-0', 0.8);
      selector.recordPerformance('device-0', 0.9);

      const stats = selector.getStats();
      expect(stats.performanceSamples).toBe(2);
    });

    it('should limit history size', () => {
      for (let i = 0; i < 200; i++) {
        selector.recordPerformance('device-0', i % 100 / 100);
      }

      const stats = selector.getStats();
      expect(stats.performanceSamples).toBeLessThanOrEqual(100);
    });
  });

  describe('recordThermal', () => {
    it('should record thermal data', () => {
      selector.recordThermal('device-0', 65);
      selector.recordThermal('device-0', 70);

      const stats = selector.getStats();
      expect(stats.thermalSamples).toBe(2);
    });
  });

  describe('recordPower', () => {
    it('should record power data', () => {
      selector.recordPower('device-0', 120);
      selector.recordPower('device-0', 130);

      const stats = selector.getStats();
      expect(stats.powerSamples).toBe(2);
    });
  });

  describe('selectDeviceForTask', () => {
    it('should consider task memory requirements', async () => {
      const task: WorkTask = {
        taskId: 'task-0',
        type: 'test',
        inputData: new ArrayBuffer(1024),
        kernel: '',
        layouts: [],
        pipelineLayout: null as any,
        pipeline: null as any,
        workgroupSizes: [1, 1, 1],
        dispatchSizes: [1, 1, 1],
        priority: 0.5,
        memoryRequired: 8 * 1024 * 1024 * 1024,
        dependencies: [],
      };

      const device = await selector.selectDeviceForTask(devices, task);

      expect(device).toBeDefined();
    });
  });

  describe('selectDevicesForPipeline', () => {
    it('should select devices for pipeline stages', async () => {
      const selected = await selector.selectDevicesForPipeline(devices, 2);

      expect(selected.length).toBe(2);
    });

    it('should limit to available devices', async () => {
      const selected = await selector.selectDevicesForPipeline(devices, 10);

      expect(selected.length).toBeLessThanOrEqual(devices.length);
    });
  });

  describe('explainSelection', () => {
    it('should explain device selection', async () => {
      const explanation = await selector.explainSelection(devices);

      expect(explanation).toContain('Selected:');
      expect(explanation).toContain('Score:');
      expect(explanation).toContain('Reasons:');
    });

    it('should handle empty device list', async () => {
      const explanation = await selector.explainSelection([]);

      expect(explanation).toContain('No devices');
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      selector.recordPerformance('device-0', 0.8);
      selector.recordThermal('device-0', 65);
      selector.recordPower('device-0', 120);

      selector.clearHistory();

      const stats = selector.getStats();
      expect(stats.performanceSamples).toBe(0);
      expect(stats.thermalSamples).toBe(0);
      expect(stats.powerSamples).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return selector statistics', () => {
      selector.recordPerformance('device-0', 0.8);
      selector.recordThermal('device-1', 65);

      const stats = selector.getStats();

      expect(stats.devicesTracked).toBeGreaterThanOrEqual(0);
      expect(stats.performanceSamples).toBe(1);
      expect(stats.thermalSamples).toBe(1);
    });
  });
});
