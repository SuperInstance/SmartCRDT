/**
 * @lsi/webgpu-memory - Integration Tests
 *
 * Tests for VL-JEPA integration components.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VLJEPAMemoryAllocator,
  CrossContextSharing,
  TempBufferManager,
  NNMemoryLayout,
  getEmbeddingSize,
} from '../src/integration.js';

// Mock GPUDevice
class MockGPUBuffer {
  destroyed = false;
  constructor(
    public size: number,
    public usage: number
  ) {}
  destroy() {
    this.destroyed = true;
  }
}

class MockGPUDevice {
  createBuffer(descriptor: { size: number; usage: number }) {
    return new MockGPUBuffer(descriptor.size, descriptor.usage);
  }
}

describe('VLJEPAMemoryAllocator', () => {
  let device: MockGPUDevice;
  let allocator: VLJEPAMemoryAllocator;

  beforeEach(() => {
    device = new MockGPUDevice();
    allocator = new VLJEPAMemoryAllocator(device as any);
  });

  describe('allocateEmbeddingBuffer', () => {
    it('should allocate embedding buffer', () => {
      const alloc = allocator.allocateEmbeddingBuffer(1);

      expect(alloc).toBeDefined();
      expect(alloc.size).toBe(getEmbeddingSize(1));
      expect(alloc.buffer).toBeInstanceOf(MockGPUBuffer);
    });

    it('should allocate batch embedding buffer', () => {
      const alloc = allocator.allocateEmbeddingBuffer(10);

      expect(alloc.size).toBe(getEmbeddingSize(10));
    });

    it('should reuse cached embeddings', () => {
      const alloc1 = allocator.allocateEmbeddingBuffer(1);
      allocator.freeEmbeddingBuffer(alloc1);
      const alloc2 = allocator.allocateEmbeddingBuffer(1);

      expect(alloc2).toBeDefined();
    });
  });

  describe('allocateTempBuffer', () => {
    it('should allocate temporary buffer', () => {
      const alloc = allocator.allocateTempBuffer(1024);

      expect(alloc).toBeDefined();
      expect(alloc.size).toBe(1024);
    });
  });

  describe('allocateBatchEmbeddings', () => {
    it('should allocate batch embeddings', () => {
      const alloc = allocator.allocateBatchEmbeddings(16);

      expect(alloc).toBeDefined();
      expect(alloc.size).toBe(getEmbeddingSize(16));
    });
  });

  describe('allocateAttentionMask', () => {
    it('should allocate attention mask', () => {
      const alloc = allocator.allocateAttentionMask(8, 128);

      expect(alloc).toBeDefined();
      expect(alloc.size).toBe(8 * 128 * 4); // float32
    });
  });

  describe('allocateEncoderOutput', () => {
    it('should allocate encoder output buffer', () => {
      const alloc = allocator.allocateEncoderOutput(4, 128, 768);

      expect(alloc).toBeDefined();
      expect(alloc.size).toBe(4 * 128 * 768 * 4); // float32
    });
  });

  describe('allocatePredictorBuffer', () => {
    it('should allocate predictor buffer', () => {
      const alloc = allocator.allocatePredictorBuffer(8);

      expect(alloc).toBeDefined();
      expect(alloc.size).toBe(getEmbeddingSize(8));
    });
  });

  describe('resetTempArena', () => {
    it('should reset temporary arena', () => {
      allocator.allocateTempBuffer(1024);
      allocator.allocateTempBuffer(2048);

      allocator.resetTempArena();

      const stats = allocator.getStats();
      expect(stats.temp.utilization).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear embedding cache', () => {
      allocator.allocateEmbeddingBuffer(1);
      allocator.allocateEmbeddingBuffer(10);

      allocator.clearCache();

      const stats = allocator.getStats();
      expect(stats.cache.entryCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return memory statistics', () => {
      allocator.allocateEmbeddingBuffer(1);
      allocator.allocateTempBuffer(1024);

      const stats = allocator.getStats();

      expect(stats).toBeDefined();
      expect(stats.embeddings).toBeDefined();
      expect(stats.temp).toBeDefined();
      expect(stats.cache).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('should destroy allocator', () => {
      const alloc = allocator.allocateEmbeddingBuffer(1);

      allocator.destroy();

      expect(() => allocator.destroy()).not.toThrow();
    });
  });
});

describe('CrossContextSharing', () => {
  let device: MockGPUDevice;
  let sharing: CrossContextSharing;

  beforeEach(() => {
    device = new MockGPUDevice();
    sharing = new CrossContextSharing(device as any);
  });

  describe('createSharedBuffer', () => {
    it('should create shared buffer', () => {
      const buffer = sharing.createSharedBuffer('key1', 1024, 0x08);

      expect(buffer).toBeInstanceOf(MockGPUBuffer);
      expect(buffer.size).toBe(1024);
    });

    it('should return existing buffer for same key', () => {
      const buf1 = sharing.createSharedBuffer('key1', 1024, 0x08);
      const buf2 = sharing.createSharedBuffer('key1', 2048, 0x08);

      expect(buf1).toBe(buf2);
    });
  });

  describe('getSharedBuffer', () => {
    it('should get shared buffer', () => {
      const buffer = sharing.createSharedBuffer('key1', 1024, 0x08);

      const result = sharing.getSharedBuffer('key1');

      expect(result).toBe(buffer);
    });

    it('should return undefined for non-existent key', () => {
      const result = sharing.getSharedBuffer('unknown');

      expect(result).toBeUndefined();
    });
  });

  describe('releaseSharedBuffer', () => {
    it('should release shared buffer', () => {
      const buffer = sharing.createSharedBuffer('key1', 1024, 0x08);

      sharing.releaseSharedBuffer('key1');
      sharing.releaseSharedBuffer('key1');

      // Should be destroyed after second release (ref count reaches 0)
      const result = sharing.getSharedBuffer('key1');
      expect(result).toBeUndefined();
    });
  });

  describe('getSharedBuffers', () => {
    it('should return all shared buffers', () => {
      sharing.createSharedBuffer('key1', 1024, 0x08);
      sharing.createSharedBuffer('key2', 2048, 0x08);

      const buffers = sharing.getSharedBuffers();

      expect(buffers).toHaveLength(2);
    });
  });
});

describe('TempBufferManager', () => {
  let device: MockGPUDevice;
  let manager: TempBufferManager;

  beforeEach(() => {
    device = new MockGPUDevice();
    manager = new TempBufferManager(device as any);
  });

  describe('acquire', () => {
    it('should acquire temporary buffer', () => {
      const tempBuf = manager.acquire(1024, 0x08);

      expect(tempBuf).toBeDefined();
      expect(tempBuf.buffer).toBeInstanceOf(MockGPUBuffer);
      expect(tempBuf.inUse).toBe(true);
    });

    it('should reuse released buffers', () => {
      const buf1 = manager.acquire(1024, 0x08);
      manager.release(buf1);
      const buf2 = manager.acquire(1024, 0x08);

      expect(buf1.buffer).toBe(buf2.buffer);
    });
  });

  describe('release', () => {
    it('should release temporary buffer', () => {
      const tempBuf = manager.acquire(1024, 0x08);

      manager.release(tempBuf);

      expect(tempBuf.inUse).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all pools', () => {
      manager.acquire(1024, 0x08);
      manager.acquire(2048, 0x08);

      manager.clear();

      // Should not throw
      const tempBuf = manager.acquire(1024, 0x08);
      expect(tempBuf).toBeDefined();
    });
  });
});

describe('NNMemoryLayout', () => {
  let device: MockGPUDevice;
  let layout: NNMemoryLayout;

  beforeEach(() => {
    device = new MockGPUDevice();
    layout = new NNMemoryLayout(device as any);
  });

  describe('allocateParameter', () => {
    it('should allocate parameter buffer', () => {
      const buffer = layout.allocateParameter('layer1', 1024);

      expect(buffer).toBeInstanceOf(MockGPUBuffer);
      expect(buffer.size).toBe(1024);
    });

    it('should reuse existing parameter buffer', () => {
      const buf1 = layout.allocateParameter('layer1', 1024);
      const buf2 = layout.allocateParameter('layer1', 2048);

      expect(buf1).toBe(buf2);
    });
  });

  describe('allocateActivation', () => {
    it('should allocate activation buffer', () => {
      const buffer = layout.allocateActivation('layer1', 2048);

      expect(buffer).toBeInstanceOf(MockGPUBuffer);
      expect(buffer.size).toBe(2048);
    });

    it('should reuse existing activation buffer', () => {
      const buf1 = layout.allocateActivation('layer1', 2048);
      const buf2 = layout.allocateActivation('layer1', 4096);

      expect(buf1).toBe(buf2);
    });
  });

  describe('getParameter', () => {
    it('should get parameter buffer', () => {
      layout.allocateParameter('layer1', 1024);

      const buffer = layout.getParameter('layer1');

      expect(buffer).toBeDefined();
    });

    it('should return undefined for non-existent layer', () => {
      const buffer = layout.getParameter('unknown');

      expect(buffer).toBeUndefined();
    });
  });

  describe('getActivation', () => {
    it('should get activation buffer', () => {
      layout.allocateActivation('layer1', 1024);

      const buffer = layout.getActivation('layer1');

      expect(buffer).toBeDefined();
    });

    it('should return undefined for non-existent layer', () => {
      const buffer = layout.getActivation('unknown');

      expect(buffer).toBeUndefined();
    });
  });

  describe('freeParameter', () => {
    it('should free parameter buffer', () => {
      const buffer = layout.allocateParameter('layer1', 1024);

      layout.freeParameter('layer1');

      expect(buffer.destroyed).toBe(true);
      expect(layout.getParameter('layer1')).toBeUndefined();
    });
  });

  describe('freeActivation', () => {
    it('should free activation buffer', () => {
      const buffer = layout.allocateActivation('layer1', 1024);

      layout.freeActivation('layer1');

      expect(buffer.destroyed).toBe(true);
      expect(layout.getActivation('layer1')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all buffers', () => {
      const param = layout.allocateParameter('layer1', 1024);
      const activation = layout.allocateActivation('layer1', 2048);

      layout.clear();

      expect(param.destroyed).toBe(true);
      expect(activation.destroyed).toBe(true);
    });
  });
});
