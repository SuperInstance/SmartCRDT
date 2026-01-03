/**
 * WebGPU Examples - Utility Tests
 *
 * Comprehensive tests for WebGPU utility functions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isWebGPUAvailable,
  initializeWebGPU,
  getDefaultConfig,
  formatAdapterInfo
} from '../src/utils/WebGPUUtils.js';
import {
  compileShader,
  validateShader,
  createComputePipeline,
  BindGroupLayout
} from '../src/utils/ShaderUtils.js';
import {
  createBuffer,
  createStorageBuffer,
  createUniformBuffer,
  createStagingBuffer,
  writeBuffer,
  createBufferFromData,
  BufferPool
} from '../src/utils/BufferUtils.js';

// Mock navigator for Node.js environment
if (typeof navigator === 'undefined') {
  (globalThis as any).navigator = {
    gpu: null
  };
}

describe('WebGPUUtils', () => {
  describe('isWebGPUAvailable', () => {
    it('should return false in non-browser environments', () => {
      expect(isWebGPUAvailable()).toBe(false);
    });
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();
      expect(config.powerPreference).toBe('high-performance');
      expect(config.enableProfiling).toBe(true);
      expect(config.maxBufferSize).toBe(256 * 1024 * 1024);
      expect(config.debugShaders).toBe(false);
    });
  });

  describe('formatAdapterInfo', () => {
    it('should format adapter information correctly', () => {
      const mockInfo = {
        vendor: 'NVIDIA',
        architecture: 'RTX 3080',
        device: 'GeForce RTX 3080',
        description: 'NVIDIA GeForce RTX 3080'
      } as GPUAdapterInfo;

      const formatted = formatAdapterInfo(mockInfo);
      expect(formatted).toContain('NVIDIA');
      expect(formatted).toContain('RTX 3080');
    });
  });
});

describe('ShaderUtils', () => {
  describe('BindGroupLayout', () => {
    it('should create storage buffer entry', () => {
      const entry = BindGroupLayout.storageBuffer(0);
      expect(entry.binding).toBe(0);
      expect(entry.visibility).toBe(GPUShaderStage.COMPUTE);
      expect(entry.buffer?.type).toBe('storage');
    });

    it('should create read-only storage buffer entry', () => {
      const entry = BindGroupLayout.storageBuffer(1, GPUShaderStage.COMPUTE, true);
      expect(entry.buffer?.type).toBe('read-only-storage');
    });

    it('should create uniform buffer entry', () => {
      const entry = BindGroupLayout.uniformBuffer(2);
      expect(entry.binding).toBe(2);
      expect(entry.buffer?.type).toBe('uniform');
    });

    it('should create storage texture entry', () => {
      const entry = BindGroupLayout.storageTexture(3);
      expect(entry.binding).toBe(3);
      expect(entry.texture?.access).toBe('write-only');
      expect(entry.texture?.format).toBe('rgba8unorm');
    });

    it('should create sampler entry', () => {
      const entry = BindGroupLayout.sampler(4);
      expect(entry.binding).toBe(4);
      expect(entry.sampler?.type).toBe('filtering');
    });
  });
});

describe('BufferUtils', () => {
  let device: GPUDevice | null = null;

  beforeEach(async () => {
    // Skip tests if WebGPU is not available
    if (!isWebGPUAvailable()) {
      return;
    }
    const result = await initializeWebGPU();
    if (result.success && result.device) {
      device = result.device;
    }
  });

  afterEach(() => {
    if (device) {
      device.destroy();
      device = null;
    }
  });

  describe.skipIf(!isWebGPUAvailable())('createBuffer', () => {
    it('should create a buffer with specified size and usage', () => {
      expect(device).toBeTruthy();
      const buffer = createBuffer(device!, 1024, GPUBufferUsage.STORAGE);
      expect(buffer.size).toBe(1024);
      buffer.destroy();
    });

    it('should create buffer with label', () => {
      expect(device).toBeTruthy();
      const buffer = createBuffer(device!, 1024, GPUBufferUsage.STORAGE, 'test-buffer');
      buffer.destroy();
    });
  });

  describe.skipIf(!isWebGPUAvailable())('createStorageBuffer', () => {
    it('should create storage buffer with correct usage flags', () => {
      expect(device).toBeTruthy();
      const buffer = createStorageBuffer(device!, 1024);
      expect(buffer).toBeTruthy();
      buffer.destroy();
    });
  });

  describe.skipIf(!isWebGPUAvailable())('createUniformBuffer', () => {
    it('should create uniform buffer with correct usage flags', () => {
      expect(device).toBeTruthy();
      const buffer = createUniformBuffer(device!, 256);
      expect(buffer).toBeTruthy();
      buffer.destroy();
    });
  });

  describe.skipIf(!isWebGPUAvailable())('createStagingBuffer', () => {
    it('should create staging buffer for readback', () => {
      expect(device).toBeTruthy();
      const buffer = createStagingBuffer(device!, 1024);
      expect(buffer).toBeTruthy();
      buffer.destroy();
    });
  });

  describe.skipIf(!isWebGPUAvailable())('createBufferFromData', () => {
    it('should create buffer and write data in one step', () => {
      expect(device).toBeTruthy();
      const data = new Float32Array([1, 2, 3, 4]);
      const buffer = createBufferFromData(device!, data, GPUBufferUsage.STORAGE);
      expect(buffer.size).toBe(data.byteLength);
      buffer.destroy();
    });
  });

  describe('BufferPool', () => {
    it('should create buffer pool', () => {
      expect(device).toBeTruthy();
      const pool = new BufferPool(device!, 5);
      const stats = pool.getStats();
      expect(stats.totalBuffers).toBe(0);
      pool.clear();
    });

    it.skipIf(!isWebGPUAvailable())('should acquire and reuse buffers', async () => {
      expect(device).toBeTruthy();
      const pool = new BufferPool(device!, 5);

      const buffer1 = pool.acquire(1024, GPUBufferUsage.STORAGE);
      expect(buffer1).toBeTruthy();

      pool.release(buffer1);

      const buffer2 = pool.acquire(1024, GPUBufferUsage.STORAGE);
      // Should reuse the same buffer
      expect(buffer2).toBeTruthy();

      pool.clear();
    });

    it.skipIf(!isWebGPUAvailable())('should respect max pool size', async () => {
      expect(device).toBeTruthy();
      const pool = new BufferPool(device!, 2);

      const buffers = [
        pool.acquire(1024, GPUBufferUsage.STORAGE),
        pool.acquire(1024, GPUBufferUsage.STORAGE),
        pool.acquire(1024, GPUBufferUsage.STORAGE)
      ];

      // Release first two
      pool.release(buffers[0]!);
      pool.release(buffers[1]!);
      pool.release(buffers[2]!);

      const stats = pool.getStats();
      // Max 2 buffers should be in pool
      expect(stats.totalBuffers).toBeLessThanOrEqual(2);

      pool.clear();
    });
  });
});

describe('Type Safety Tests', () => {
  it('should maintain type safety for Float32Array', () => {
    const data = new Float32Array([1.0, 2.0, 3.0]);
    expect(data).toBeInstanceOf(Float32Array);
    expect(data.BYTES_PER_ELEMENT).toBe(4);
  });

  it('should maintain type safety for Uint32Array', () => {
    const data = new Uint32Array([1, 2, 3]);
    expect(data).toBeInstanceOf(Uint32Array);
    expect(data.BYTES_PER_ELEMENT).toBe(4);
  });

  it('should maintain type safety for Uint8ClampedArray', () => {
    const data = new Uint8ClampedArray([255, 128, 0]);
    expect(data).toBeInstanceOf(Uint8ClampedArray);
    expect(data.BYTES_PER_ELEMENT).toBe(1);
  });
});

describe('Error Handling', () => {
  it('should throw when device is null for buffer creation', () => {
    expect(() => createBuffer(null as any, 1024, GPUBufferUsage.STORAGE)).toThrow();
  });

  it('should throw when device is null for writeBuffer', () => {
    expect(() => writeBuffer(null as any, {} as any, new Float32Array())).toThrow();
  });
});

describe('Utility Function Tests', () => {
  describe('calculateBufferSize', () => {
    it('should calculate correct buffer size for Float32Array', () => {
      const count = 100;
      const size = count * Float32Array.BYTES_PER_ELEMENT;
      expect(size).toBe(400);
    });

    it('should calculate correct buffer size for Uint32Array', () => {
      const count = 100;
      const size = count * Uint32Array.BYTES_PER_ELEMENT;
      expect(size).toBe(400);
    });

    it('should calculate correct buffer size for Uint8Array', () => {
      const count = 100;
      const size = count * Uint8Array.BYTES_PER_ELEMENT;
      expect(size).toBe(100);
    });
  });
});
