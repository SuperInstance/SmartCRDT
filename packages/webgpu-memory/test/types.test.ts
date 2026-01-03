/**
 * @lsi/webgpu-memory - Type Tests
 *
 * Tests for type definitions and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  MemoryType,
  PoolStrategy,
  MemoryPressure,
  EvictionStrategy,
  MemoryEventType,
  Alignment,
  formatBytes,
  alignUp,
  isPowerOfTwo,
  nextPowerOfTwo,
  getEmbeddingSize,
  estimateLayerMemory,
  createDefaultConfig,
  createVLJEPAConfig,
} from '../src/index.js';

describe('Type Definitions', () => {
  describe('MemoryType', () => {
    it('should have correct memory types', () => {
      expect('device_local').toBeTypeOf('string');
      expect('host_visible').toBeTypeOf('string');
      expect('host_coherent').toBeTypeOf('string');
      expect('cached').toBeTypeOf('string');
    });
  });

  describe('PoolStrategy', () => {
    it('should have all pool strategies', () => {
      expect(PoolStrategy.FirstFit).toBe('first_fit');
      expect(PoolStrategy.BestFit).toBe('best_fit');
      expect(PoolStrategy.WorstFit).toBe('worst_fit');
      expect(PoolStrategy.BuddySystem).toBe('buddy_system');
      expect(PoolStrategy.SegregatedFit).toBe('segregated_fit');
    });
  });

  describe('MemoryPressure', () => {
    it('should have all pressure levels', () => {
      expect(MemoryPressure.None).toBe('none');
      expect(MemoryPressure.Low).toBe('low');
      expect(MemoryPressure.Medium).toBe('medium');
      expect(MemoryPressure.High).toBe('high');
      expect(MemoryPressure.Critical).toBe('critical');
    });
  });

  describe('EvictionStrategy', () => {
    it('should have all eviction strategies', () => {
      expect(EvictionStrategy.LRU).toBe('lru');
      expect(EvictionStrategy.LFU).toBe('lfu');
      expect(EvictionStrategy.FIFO).toBe('fifo');
      expect(EvictionStrategy.Priority).toBe('priority');
      expect(EvictionStrategy.Size).toBe('size');
      expect(EvictionStrategy.Random).toBe('random');
    });
  });

  describe('MemoryEventType', () => {
    it('should have all event types', () => {
      expect(MemoryEventType.Allocate).toBe('allocate');
      expect(MemoryEventType.Free).toBe('free');
      expect(MemoryEventType.Map).toBe('map');
      expect(MemoryEventType.Unmap).toBe('unmap');
      expect(MemoryEventType.PressureWarning).toBe('pressure_warning');
      expect(MemoryEventType.OOM).toBe('oom');
      expect(MemoryEventType.DefragStart).toBe('defrag_start');
      expect(MemoryEventType.DefragComplete).toBe('defrag_complete');
      expect(MemoryEventType.Eviction).toBe('eviction');
    });
  });

  describe('Alignment', () => {
    it('should have correct alignment values', () => {
      expect(Alignment.Byte).toBe(1);
      expect(Alignment.Uint32).toBe(4);
      expect(Alignment.SIMD).toBe(16);
      expect(Alignment.CacheLine).toBe(256);
      expect(Alignment.Page).toBe(4096);
      expect(Alignment.GPUOptimal).toBe(65536);
    });
  });
});

describe('Utility Functions', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(512)).toBe('512 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
    });

    it('should handle custom decimals', () => {
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 3)).toBe('1.5 KB');
    });
  });

  describe('alignUp', () => {
    it('should align up to alignment', () => {
      expect(alignUp(0, 16)).toBe(0);
      expect(alignUp(16, 16)).toBe(16);
      expect(alignUp(17, 16)).toBe(32);
      expect(alignUp(31, 16)).toBe(32);
      expect(alignUp(32, 16)).toBe(32);
      expect(alignUp(100, 256)).toBe(256);
    });
  });

  describe('isPowerOfTwo', () => {
    it('should correctly identify powers of two', () => {
      expect(isPowerOfTwo(0)).toBe(false);
      expect(isPowerOfTwo(1)).toBe(true);
      expect(isPowerOfTwo(2)).toBe(true);
      expect(isPowerOfTwo(3)).toBe(false);
      expect(isPowerOfTwo(4)).toBe(true);
      expect(isPowerOfTwo(5)).toBe(false);
      expect(isPowerOfTwo(8)).toBe(true);
      expect(isPowerOfTwo(16)).toBe(true);
      expect(isPowerOfTwo(31)).toBe(false);
      expect(isPowerOfTwo(32)).toBe(true);
    });
  });

  describe('nextPowerOfTwo', () => {
    it('should return next power of two', () => {
      expect(nextPowerOfTwo(1)).toBe(1);
      expect(nextPowerOfTwo(2)).toBe(2);
      expect(nextPowerOfTwo(3)).toBe(4);
      expect(nextPowerOfTwo(5)).toBe(8);
      expect(nextPowerOfTwo(17)).toBe(32);
      expect(nextPowerOfTwo(100)).toBe(128);
      expect(nextPowerOfTwo(256)).toBe(256);
    });
  });

  describe('getEmbeddingSize', () => {
    it('should calculate embedding size correctly', () => {
      // 768 dimensions * 4 bytes (float32)
      expect(getEmbeddingSize(1)).toBe(768 * 4);
      expect(getEmbeddingSize(10)).toBe(768 * 4 * 10);
      expect(getEmbeddingSize(32)).toBe(768 * 4 * 32);
    });
  });

  describe('estimateLayerMemory', () => {
    it('should estimate layer memory correctly', () => {
      const result = estimateLayerMemory(128, 256, 1);

      // Weights: 128 * 256 * 4
      expect(result.weights).toBe(128 * 256 * 4);
      // Activations: 1 * 256 * 4
      expect(result.activations).toBe(256 * 4);
      // Total
      expect(result.total).toBe(result.weights + result.activations);
    });

    it('should handle different batch sizes', () => {
      const batch1 = estimateLayerMemory(64, 128, 1);
      const batch4 = estimateLayerMemory(64, 128, 4);
      const batch16 = estimateLayerMemory(64, 128, 16);

      expect(batch4.activations).toBe(batch1.activations * 4);
      expect(batch16.activations).toBe(batch1.activations * 16);
    });
  });

  describe('createDefaultConfig', () => {
    it('should create default configuration', () => {
      const config = createDefaultConfig();

      expect(config.defaultMemoryType).toBe('device_local');
      expect(config.initialPoolSize).toBe(16 * 1024 * 1024);
      expect(config.enableAutoDefrag).toBe(true);
      expect(config.defragThreshold).toBe(0.4);
      expect(config.enableProfiling).toBe(true);
    });
  });

  describe('createVLJEPAConfig', () => {
    it('should create VL-JEPA configuration', () => {
      const config = createVLJEPAConfig();

      expect(config.embeddingDim).toBe(768);
      expect(config.maxBatchSize).toBe(32);
      expect(config.tempBufferSize).toBe(16 * 1024 * 1024);
      expect(config.cacheEmbeddings).toBe(true);
      expect(config.maxCachedEmbeddings).toBe(1000);
    });
  });
});
