/**
 * @lsi/webgpu-multi - Device Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceManager } from '../src/DeviceManager';
import type { GPUDevice, GPUSelectionCriteria } from '../src/types';

// Mock WebGPU types
class MockGPUAdapter {
  info: GPUAdapterInfo;
  features: Set<string>;
  limits: GPUSupportedLimits;

  constructor(info: Partial<GPUAdapterInfo> = {}, features: string[] = []) {
    this.info = {
      vendor: info.vendor || 'test-vendor',
      architecture: info.architecture || 'test-arch',
      description: info.description || 'Test GPU',
      device: info.device || 0,
    };
    this.features = new Set(features);
    this.limits = {
      maxTextureDimension2D: 8192,
      maxBufferSize: 1 << 30,
    } as GPUSupportedLimits;
  }

  async requestAdapterInfo(): Promise<GPUAdapterInfo> {
    return this.info;
  }
}

class MockGPUDevice {
  constructor(
    public device_id: string,
    public adapter: MockGPUAdapter,
    public type: 'integrated' | 'discrete' | 'cpu',
    public memorySize: number
  ) {}

  get device() {
    return {
      destroy: vi.fn(),
      createBuffer: vi.fn(),
      createTexture: vi.fn(),
      createBindGroupLayout: vi.fn(),
      createPipelineLayout: vi.fn(),
      createComputePipeline: vi.fn(),
      createCommandEncoder: vi.fn(),
      queue: { submit: vi.fn(), onSubmittedWorkDone: vi.fn() },
    } as any;
  }

  get queue() {
    return this.device.queue;
  }

  get features() {
    return Array.from(this.adapter.features);
  }

  get limits() {
    return this.adapter.limits;
  }

  get vendor() {
    return this.adapter.info.vendor || '';
  }

  get architecture() {
    return this.adapter.info.architecture || '';
  }

  busy = false;
  utilization = 0;
  temperature?: number;
  powerUsage?: number;
}

describe('DeviceManager', () => {
  let deviceManager: DeviceManager;

  beforeEach(() => {
    deviceManager = new DeviceManager();
  });

  describe('isWebGPUAvailable', () => {
    it('should return true when WebGPU is available', () => {
      // @ts-ignore - testing with mocked navigator
      global.navigator = { gpu: {} };
      expect(deviceManager.isWebGPUAvailable()).toBe(true);
    });

    it('should return false when WebGPU is not available', () => {
      // @ts-ignore
      global.navigator = {};
      expect(deviceManager.isWebGPUAvailable()).toBe(false);
    });
  });

  describe('scoreDevice', () => {
    it('should give higher score to discrete GPUs', async () => {
      const discrete = new MockGPUDevice('d1', new MockGPUAdapter({ description: 'RTX 4090' }), 'discrete', 8589934592);
      const integrated = new MockGPUDevice('i1', new MockGPUAdapter({ description: 'Intel Iris' }), 'integrated', 1073741824);

      const discreteScore = await deviceManager['scoreDevice'](discrete as any);
      const integratedScore = await deviceManager['scoreDevice'](integrated as any);

      expect(discreteScore).toBeGreaterThan(integratedScore);
    });

    it('should penalize high utilization', async () => {
      const device = new MockGPUDevice('d1', new MockGPUAdapter(), 'discrete', 4294967296);
      device.utilization = 0.9;

      const lowUtilScore = await deviceManager['scoreDevice'](device as any);
      device.utilization = 0.1;
      const highUtilScore = await deviceManager['scoreDevice'](device as any);

      expect(highUtilScore).toBeGreaterThan(lowUtilScore);
    });

    it('should penalize high temperature', async () => {
      const device = new MockGPUDevice('d1', new MockGPUAdapter(), 'discrete', 4294967296);
      device.temperature = 90;

      const score = await deviceManager['scoreDevice'](device as any);
      expect(score).toBeLessThan(100); // Should be penalized
    });

    it('should give bonus for more memory', async () => {
      const highMem = new MockGPUDevice('h1', new MockGPUAdapter(), 'discrete', 17179869184);
      const lowMem = new MockGPUDevice('l1', new MockGPUAdapter(), 'discrete', 1073741824);

      const highMemScore = await deviceManager['scoreDevice'](highMem as any);
      const lowMemScore = await deviceManager['scoreDevice'](lowMem as any);

      expect(highMemScore).toBeGreaterThan(lowMemScore);
    });
  });

  describe('classifyAdapterType', () => {
    it('should classify NVIDIA as discrete', () => {
      const info = { vendor: 'nvidia', description: 'GeForce RTX', architecture: 'ampere' };
      const type = deviceManager['classifyAdapterType'](info as any);
      expect(type).toBe('discrete');
    });

    it('should classify Intel as integrated', () => {
      const info = { vendor: 'intel', description: 'Intel Iris Xe', architecture: 'gen12' };
      const type = deviceManager['classifyAdapterType'](info as any);
      expect(type).toBe('integrated');
    });

    it('should classify SwiftShader as CPU', () => {
      const info = { vendor: 'google', description: 'SwiftShader', architecture: 'cpu' };
      const type = deviceManager['classifyAdapterType'](info as any);
      expect(type).toBe('cpu');
    });
  });

  describe('estimateMemorySize', () => {
    it('should extract memory from description', () => {
      const info = { description: 'NVIDIA RTX 4090 (24GB)' };
      const size = deviceManager['estimateMemorySize'](info as any);
      expect(size).toBe(24 * 1024 * 1024 * 1024);
    });

    it('should estimate memory for RTX cards', () => {
      const info = { description: 'RTX 3080' };
      const size = deviceManager['estimateMemorySize'](info as any);
      expect(size).toBe(8 * 1024 * 1024 * 1024);
    });

    it('should estimate memory for Intel cards', () => {
      const info = { description: 'Intel Iris' };
      const size = deviceManager['estimateMemorySize'](info as any);
      expect(size).toBe(1 * 1024 * 1024 * 1024);
    });
  });

  describe('updateDeviceUtilization', () => {
    it('should update device utilization', () => {
      const device = {
        device_id: 'test',
        utilization: 0.5,
        busy: false,
      } as any;

      deviceManager.devices.set('test', device);
      deviceManager.updateDeviceUtilization('test', 0.9);

      expect(device.utilization).toBe(0.9);
      expect(device.busy).toBe(true);
    });
  });

  describe('updateDeviceTemperature', () => {
    it('should update device temperature', () => {
      const device = {
        device_id: 'test',
        temperature: undefined,
      } as any;

      deviceManager.devices.set('test', device);
      deviceManager.updateDeviceTemperature('test', 75);

      expect(device.temperature).toBe(75);
    });
  });

  describe('updateDevicePowerUsage', () => {
    it('should update device power usage', () => {
      const device = {
        device_id: 'test',
        powerUsage: undefined,
      } as any;

      deviceManager.devices.set('test', device);
      deviceManager.updateDevicePowerUsage('test', 150);

      expect(device.powerUsage).toBe(150);
    });
  });

  describe('destroyDevice', () => {
    it('should destroy a device', () => {
      const mockDevice = {
        device_id: 'test',
        device: { destroy: vi.fn() },
      } as any;

      deviceManager.devices.set('test', mockDevice);
      deviceManager.destroyDevice('test');

      expect(mockDevice.device.destroy).toHaveBeenCalled();
      expect(deviceManager.devices.has('test')).toBe(false);
    });
  });

  describe('destroyAllDevices', () => {
    it('should destroy all devices', () => {
      const mockDevice1 = { device_id: 'test1', device: { destroy: vi.fn() } } as any;
      const mockDevice2 = { device_id: 'test2', device: { destroy: vi.fn() } } as any;

      deviceManager.devices.set('test1', mockDevice1);
      deviceManager.devices.set('test2', mockDevice2);
      deviceManager.destroyAllDevices();

      expect(mockDevice1.device.destroy).toHaveBeenCalled();
      expect(mockDevice2.device.destroy).toHaveBeenCalled();
      expect(deviceManager.devices.size).toBe(0);
    });
  });
});
