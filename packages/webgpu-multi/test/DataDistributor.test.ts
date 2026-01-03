/**
 * @lsi/webgpu-multi - Data Distributor Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataDistributor } from '../src/DataDistributor';
import type { GPUDevice, DataDistribution } from '../src/types';

function createMockDevice(id: string): GPUDevice {
  const mockBuffer = {
    destroy: vi.fn(),
    unmap: vi.fn(),
    getMappedRange: vi.fn(() => new Uint8Array(1024)),
    mapAsync: vi.fn(),
    size: 1024,
  };

  return {
    device_id: id,
    adapter: {} as any,
    device: {
      createBuffer: vi.fn(() => mockBuffer),
      queue: {
        submit: vi.fn(),
        onSubmittedWorkDone: vi.fn(() => Promise.resolve()),
      },
      createCommandEncoder: vi.fn(() => ({
        copyBufferToBuffer: vi.fn(),
        finish: vi.fn(),
      })),
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

describe('DataDistributor', () => {
  let distributor: DataDistributor;
  let devices: GPUDevice[];

  beforeEach(() => {
    distributor = new DataDistributor();
    devices = [createMockDevice('device-0'), createMockDevice('device-1')];
  });

  describe('splitData', () => {
    it('should split data evenly across devices', () => {
      const data = new ArrayBuffer(1000);
      const chunks = distributor.splitData(data, 2);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].byteLength).toBeGreaterThan(0);
      expect(chunks[1].byteLength).toBeGreaterThan(0);
    });

    it('should align chunks to specified alignment', () => {
      const data = new ArrayBuffer(1000);
      const chunks = distributor.splitData(data, 2, 64);

      for (const chunk of chunks) {
        expect(chunk.byteLength % 64).toBe(0);
      }
    });

    it('should handle single device', () => {
      const data = new ArrayBuffer(1000);
      const chunks = distributor.splitData(data, 1);

      expect(chunks).toHaveLength(1);
    });

    it('should handle zero-length data', () => {
      const data = new ArrayBuffer(0);
      const chunks = distributor.splitData(data, 2);

      expect(chunks).toHaveLength(2);
    });
  });

  describe('splitDataBySize', () => {
    it('should split data by specified chunk size', () => {
      const data = new ArrayBuffer(1000);
      const chunks = distributor.splitDataBySize(data, 300);

      expect(chunks.length).toBeGreaterThan(2);
    });

    it('should align chunk sizes', () => {
      const data = new ArrayBuffer(1000);
      const chunks = distributor.splitDataBySize(data, 300, 64);

      for (const chunk of chunks) {
        expect(chunk.byteLength % 64).toBe(0);
      }
    });

    it('should handle single chunk', () => {
      const data = new ArrayBuffer(100);
      const chunks = distributor.splitDataBySize(data, 1000);

      expect(chunks).toHaveLength(1);
    });
  });

  describe('createDistribution', () => {
    it('should create data distribution', () => {
      const data = new ArrayBuffer(1000);
      const dist = distributor.createDistribution(data, devices, false, 64);

      expect(dist.chunks).toHaveLength(devices.length);
      expect(dist.assignments).toBe(devices);
      expect(dist.replicate).toBe(false);
      expect(dist.alignment).toBe(64);
    });

    it('should create replicated distribution', () => {
      const data = new ArrayBuffer(1000);
      const dist = distributor.createDistribution(data, devices, true, 64);

      expect(dist.replicate).toBe(true);
      expect(dist.replicationFactor).toBeGreaterThan(1);
    });
  });

  describe('calculateOptimalChunkSize', () => {
    it('should calculate aligned chunk size', () => {
      const size = distributor.calculateOptimalChunkSize(1000, 3, 64);

      expect(size).toBeGreaterThan(0);
      expect(size % 64).toBe(0);
    });

    it('should handle different alignments', () => {
      const size1 = distributor.calculateOptimalChunkSize(1000, 3, 64);
      const size2 = distributor.calculateOptimalChunkSize(1000, 3, 128);

      expect(size2 % 128).toBe(0);
    });
  });

  describe('validateDistribution', () => {
    it('should validate correct distribution', () => {
      const data = new ArrayBuffer(1000);
      const dist = distributor.createDistribution(data, devices, false);

      expect(distributor.validateDistribution(dist)).toBe(true);
    });

    it('should reject mismatched chunks and assignments', () => {
      const invalidDist: DataDistribution = {
        chunks: [new ArrayBuffer(100)],
        assignments: devices,
        replicate: false,
        alignment: 64,
      };

      expect(distributor.validateDistribution(invalidDist)).toBe(false);
    });
  });

  describe('cacheReplicatedData and getCachedData', () => {
    it('should cache and retrieve data', () => {
      const data = new Map([
        ['device-0', new ArrayBuffer(100)],
        ['device-1', new ArrayBuffer(100)],
      ]);

      distributor.cacheReplicatedData('test-key', data);
      const retrieved = distributor.getCachedData('test-key');

      expect(retrieved).toBe(data);
    });

    it('should return undefined for non-existent cache', () => {
      const retrieved = distributor.getCachedData('non-existent');

      expect(retrieved).toBeUndefined();
    });

    it('should clear cache', () => {
      distributor.cacheReplicatedData('test', new Map());
      distributor.clearCache();

      expect(distributor.getCachedData('test')).toBeUndefined();
    });
  });

  describe('replicateData', () => {
    it('should replicate data to multiple devices', async () => {
      const data = new ArrayBuffer(100);

      const buffers = await distributor.replicateData(data, devices, 2);

      expect(buffers.size).toBe(2);
    });
  });

  describe('createDistributedBuffers', () => {
    it('should create buffers on all devices', () => {
      const sizes = [1024, 2048];
      const buffers = distributor.createDistributedBuffers(sizes, devices);

      expect(buffers.size).toBe(devices.length);
      expect(buffers.get(devices[0].device_id)).toHaveLength(sizes.length);
    });
  });

  describe('broadcastToAll', () => {
    it('should broadcast data to all devices', async () => {
      const data = new ArrayBuffer(100);

      const buffers = await distributor.broadcastToAll(data, devices);

      expect(buffers.size).toBe(devices.length);
    });
  });

  describe('scatterData', () => {
    it('should scatter data to devices', async () => {
      const data = [new ArrayBuffer(100), new ArrayBuffer(200)];

      const buffers = await distributor.scatterData(data, devices);

      expect(buffers.size).toBe(2);
    });
  });

  describe('reduceSum', () => {
    it('should reduce data from all devices', async () => {
      const buffers = new Map([
        [devices[0].device_id, null as any],
        [devices[1].device_id, null as any],
      ]);

      const result = await distributor.reduceSum(devices, buffers, devices[0]);

      expect(result).toBeDefined();
    });
  });

  describe('transferBetweenDevices', () => {
    it('should transfer data between devices', async () => {
      const data = new ArrayBuffer(100);

      const result = await distributor.transferBetweenDevices(
        data,
        devices[0],
        devices[1]
      );

      expect(result).toBeDefined();
    });
  });
});
