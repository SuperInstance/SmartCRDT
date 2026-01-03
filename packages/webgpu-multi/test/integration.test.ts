/**
 * @lsi/webgpu-multi - Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MultiGPUVLJEPAInference,
  MultiGPUBatchProcessor,
  ModelParallelProcessor,
  createMultiGPUInference,
  quickMultiGPUInference,
} from '../src/integration';
import type { MultiGPUConfig, GPUDevice, WorkDistribution } from '../src/types';

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

describe('Integration Layer', () => {
  let mockDevices: GPUDevice[];

  beforeEach(() => {
    mockDevices = [
      createMockDevice('device-0'),
      createMockDevice('device-1'),
      createMockDevice('device-2'),
    ];
  });

  describe('MultiGPUVLJEPAInference', () => {
    let inference: MultiGPUVLJEPAInference;
    let config: MultiGPUConfig;

    beforeEach(() => {
      config = {
        devices: [],
        workDistribution: 'data-parallel' as WorkDistribution,
        syncStrategy: 'barrier',
        maxDevices: 2,
        enableLoadBalancing: true,
        enableWorkStealing: true,
      };

      inference = new MultiGPUVLJEPAInference(config);
      vi.spyOn(inference['deviceManager'], 'createAllDevices').mockResolvedValue(mockDevices);
    });

    describe('initialize', () => {
      it('should initialize with devices', async () => {
        await inference.initialize();

        const stats = inference.getStats();
        expect(stats.devices).toBeGreaterThan(0);
      });

      it('should limit devices when maxDevices is set', async () => {
        config.maxDevices = 2;
        await inference.initialize();

        const stats = inference.getStats();
        expect(stats.devices).toBeLessThanOrEqual(2);
      });
    });

    describe('runInference', () => {
      it('should run inference on multiple GPUs', async () => {
        await inference.initialize();

        const frames = [new ArrayBuffer(100), new ArrayBuffer(100)];
        const inferenceFn = vi.fn(async (frame, device) => frame);

        const results = await inference.runInference(frames, inferenceFn);

        expect(results).toHaveLength(2);
        expect(inferenceFn).toHaveBeenCalled();
      });

      it('should throw error when not initialized', async () => {
        const frames = [new ArrayBuffer(100)];
        const inferenceFn = vi.fn();

        await expect(inference.runInference(frames, inferenceFn)).rejects.toThrow();
      });
    });

    describe('runBatchInference', () => {
      it('should run batch inference', async () => {
        await inference.initialize();

        const batches = [[new ArrayBuffer(100)], [new ArrayBuffer(100)]];
        const batchFn = vi.fn(async (batch, device) => batch);

        const results = await inference.runBatchInference(batches, batchFn);

        expect(results).toHaveLength(2);
      });
    });

    describe('runPipelineInference', () => {
      it('should run pipeline inference', async () => {
        await inference.initialize();

        const frames = [new ArrayBuffer(100), new ArrayBuffer(100)];
        const pipelineFn = vi.fn(async (frame, stage, device) => frame);
        const stages = 2;

        const results = await inference.runPipelineInference(frames, pipelineFn, stages);

        expect(results).toBeDefined();
      });
    });

    describe('getStats', () => {
      it('should return statistics', async () => {
        await inference.initialize();

        const stats = inference.getStats();

        expect(stats).toBeDefined();
        expect(stats.devices).toBeGreaterThan(0);
        expect(stats.executor).toBeDefined();
        expect(stats.balancer).toBeDefined();
        expect(stats.sync).toBeDefined();
      });
    });

    describe('cleanup', () => {
      it('should cleanup resources', async () => {
        await inference.initialize();
        inference.cleanup();

        const destroySpy = vi.spyOn(inference['deviceManager'], 'destroyAllDevices');
        inference.cleanup();

        expect(destroySpy).toHaveBeenCalled();
      });
    });
  });

  describe('MultiGPUBatchProcessor', () => {
    let processor: MultiGPUBatchProcessor;

    beforeEach(() => {
      processor = new MultiGPUBatchProcessor(mockDevices);
    });

    describe('processBatch', () => {
      it('should process batch across GPUs', async () => {
        const items = [1, 2, 3, 4, 5, 6];
        const processFn = vi.fn(async (item, device) => item * 2);

        const results = await processor.processBatch(items, processFn, 'round-robin');

        expect(results).toHaveLength(6);
        expect(processFn).toHaveBeenCalledTimes(6);
      });

      it('should handle empty batch', async () => {
        const items: number[] = [];
        const processFn = vi.fn();

        const results = await processor.processBatch(items, processFn);

        expect(results).toHaveLength(0);
      });

      it('should distribute across strategies', async () => {
        const items = [1, 2, 3, 4, 5, 6];
        const processFn = vi.fn(async (item, device) => item);

        await processor.processBatch(items, processFn, 'data-parallel');
        await processor.processBatch(items, processFn, 'split-by-task');

        expect(processFn).toHaveBeenCalled();
      });
    });

    describe('splitBatch', () => {
      it('should split batch into chunks', () => {
        const items = [1, 2, 3, 4, 5, 6];
        const chunks = processor['splitBatch'](items, 2);

        expect(chunks).toHaveLength(2);
        expect(chunks[0].length).toBe(3);
        expect(chunks[1].length).toBe(3);
      });
    });
  });

  describe('ModelParallelProcessor', () => {
    let processor: ModelParallelProcessor;

    beforeEach(() => {
      processor = new ModelParallelProcessor(mockDevices);
    });

    describe('splitAndExecute', () => {
      it('should execute layers across devices', async () => {
        const input = new ArrayBuffer(100);
        const layers = [
          vi.fn(async (data, device) => data),
          vi.fn(async (data, device) => data),
          vi.fn(async (data, device) => data),
        ];

        const result = await processor.splitAndExecute(input, layers);

        expect(result).toBeDefined();
        expect(layers[0]).toHaveBeenCalled();
        expect(layers[1]).toHaveBeenCalled();
        expect(layers[2]).toHaveBeenCalled();
      });

      it('should handle empty layers', async () => {
        const input = new ArrayBuffer(100);
        const layers: Array<(data: ArrayBuffer, device: GPUDevice) => Promise<ArrayBuffer>> = [];

        const result = await processor.splitAndExecute(input, layers);

        expect(result).toBeDefined();
      });

      it('should assign layers round-robin', async () => {
        const input = new ArrayBuffer(100);
        const layers = [
          vi.fn(async (data, device) => {
            expect(device.device_id).toBe('device-0');
            return data;
          }),
          vi.fn(async (data, device) => {
            expect(device.device_id).toBe('device-1');
            return data;
          }),
          vi.fn(async (data, device) => {
            expect(device.device_id).toBe('device-2');
            return data;
          }),
        ];

        await processor.splitAndExecute(input, layers);
      });
    });
  });

  describe('createMultiGPUInference', () => {
    it('should create inference system with default config', async () => {
      vi.spyOn(DeviceManager.prototype, 'createAllDevices').mockResolvedValue(mockDevices);

      const inference = await createMultiGPUInference();

      expect(inference).toBeInstanceOf(MultiGPUVLJEPAInference);
      inference.cleanup();
    });

    it('should create inference system with custom config', async () => {
      vi.spyOn(DeviceManager.prototype, 'createAllDevices').mockResolvedValue(mockDevices);

      const inference = await createMultiGPUInference({
        gpuCount: 2,
        distribution: 'data-parallel',
      });

      expect(inference).toBeInstanceOf(MultiGPUVLJEPAInference);
      inference.cleanup();
    });
  });

  describe('quickMultiGPUInference', () => {
    it('should run quick inference with auto cleanup', async () => {
      vi.spyOn(DeviceManager.prototype, 'createAllDevices').mockResolvedValue(mockDevices);

      const frames = [new ArrayBuffer(100), new ArrayBuffer(100)];
      const inferenceFn = vi.fn(async (frame, device) => frame);

      const results = await quickMultiGPUInference(frames, inferenceFn);

      expect(results).toBeDefined();
      expect(inferenceFn).toHaveBeenCalled();
    });

    it('should cleanup after inference', async () => {
      vi.spyOn(DeviceManager.prototype, 'createAllDevices').mockResolvedValue(mockDevices);
      const cleanupSpy = vi.spyOn(MultiGPUVLJEPAInference.prototype, 'cleanup');

      await quickMultiGPUInference([new ArrayBuffer(100)], async (f, d) => f);

      expect(cleanupSpy).toHaveBeenCalled();
    });

    it('should handle errors and cleanup', async () => {
      vi.spyOn(DeviceManager.prototype, 'createAllDevices').mockResolvedValue(mockDevices);

      const errorFn = vi.fn(async () => {
        throw new Error('Test error');
      });

      await expect(
        quickMultiGPUInference([new ArrayBuffer(100)], errorFn)
      ).rejects.toThrow();
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle multiple inference rounds', async () => {
      vi.spyOn(DeviceManager.prototype, 'createAllDevices').mockResolvedValue(mockDevices);

      const inference = await createMultiGPUInference({ gpuCount: 2 });

      const frames = [new ArrayBuffer(100), new ArrayBuffer(100), new ArrayBuffer(100)];
      const inferenceFn = vi.fn(async (frame, device) => frame);

      const results1 = await inference.runInference([frames[0]], inferenceFn);
      const results2 = await inference.runInference([frames[1]], inferenceFn);
      const results3 = await inference.runInference([frames[2]], inferenceFn);

      expect(results1).toBeDefined();
      expect(results2).toBeDefined();
      expect(results3).toBeDefined();

      inference.cleanup();
    });

    it('should handle concurrent batch processing', async () => {
      vi.spyOn(DeviceManager.prototype, 'createAllDevices').mockResolvedValue(mockDevices);

      const processor = new MultiGPUBatchProcessor(mockDevices);

      const batch1 = [1, 2, 3];
      const batch2 = [4, 5, 6];
      const processFn = vi.fn(async (item, device) => item * 2);

      const [results1, results2] = await Promise.all([
        processor.processBatch(batch1, processFn),
        processor.processBatch(batch2, processFn),
      ]);

      expect(results1).toHaveLength(3);
      expect(results2).toHaveLength(3);
    });

    it('should integrate with load balancer', async () => {
      vi.spyOn(DeviceManager.prototype, 'createAllDevices').mockResolvedValue(mockDevices);

      const inference = await createMultiGPUInference({
        gpuCount: 2,
        distribution: 'round-robin',
      });

      await inference.initialize();

      const stats = inference.getStats();
      expect(stats.balancer).toBeDefined();

      inference.cleanup();
    });

    it('should integrate with sync manager', async () => {
      vi.spyOn(DeviceManager.prototype, 'createAllDevices').mockResolvedValue(mockDevices);

      const inference = await createMultiGPUInference();

      await inference.initialize();

      const stats = inference.getStats();
      expect(stats.sync).toBeDefined();

      inference.cleanup();
    });
  });
});
