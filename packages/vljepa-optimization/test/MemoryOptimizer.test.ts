/**
 * Memory Optimizer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryOptimizer } from '../src/optimizers/MemoryOptimizer.js';

interface TensorInfo {
  id: string;
  name: string;
  size: number;
  shape: number[];
  dtype: string;
  usage: {
    type: 'weight' | 'activation' | 'gradient' | 'temporary' | 'output';
    operation?: string;
    timestamp: number;
    lifetimeEnd?: number;
    readOnly?: boolean;
  };
  inPlace?: boolean;
  fused?: boolean;
  fusionGroup?: string;
  reuseId?: string;
}

describe('MemoryOptimizer', () => {
  let optimizer: MemoryOptimizer;

  beforeEach(() => {
    optimizer = new MemoryOptimizer({
      inPlaceOps: true,
      tensorFusion: true,
      bufferPooling: true,
      targetMemory: 100,
      aggressiveCleanup: false,
    });
  });

  describe('constructor', () => {
    it('should create optimizer with default config', () => {
      const opt = new MemoryOptimizer();
      expect(opt).toBeDefined();
    });

    it('should create optimizer with custom config', () => {
      const opt = new MemoryOptimizer({ inPlaceOps: false });
      expect(opt).toBeDefined();
    });
  });

  describe('optimize', () => {
    it('should optimize tensor allocations', () => {
      const tensors: TensorInfo[] = [
        {
          id: 't1',
          name: 'tensor1',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation', timestamp: 0 },
        },
        {
          id: 't2',
          name: 'tensor2',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation', timestamp: 1 },
        },
      ];

      const result = optimizer.optimize(tensors);

      expect(result).toHaveProperty('originalMemory');
      expect(result).toHaveProperty('optimizedMemory');
      expect(result).toHaveProperty('reduction');
      expect(result).toHaveProperty('optimizations');
      expect(result).toHaveProperty('allocationStrategy');
    });

    it('should calculate original memory correctly', () => {
      const tensors: TensorInfo[] = [
        {
          id: 't1',
          name: 'tensor1',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation', timestamp: 0 },
        },
        {
          id: 't2',
          name: 'tensor2',
          size: 2048,
          shape: [32, 64],
          dtype: 'float32',
          usage: { type: 'activation', timestamp: 1 },
        },
      ];

      const result = optimizer.optimize(tensors);

      expect(result.originalMemory).toBe(1024 + 2048);
    });

    it('should apply in-place optimizations', () => {
      const tensors: TensorInfo[] = [
        {
          id: 't1',
          name: 'relu_output',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation', operation: 'relu', timestamp: 0 },
        },
      ];

      const result = optimizer.optimize(tensors);

      const hasInPlaceOpt = result.optimizations.some((opt) => opt.type === 'in_place_operation');
      expect(hasInPlaceOpt).toBe(true);
    });

    it('should apply tensor fusion', () => {
      const now = Date.now();
      const tensors: TensorInfo[] = [
        {
          id: 't1',
          name: 'temp1',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'temporary', timestamp: now, lifetimeEnd: now + 10 },
        },
        {
          id: 't2',
          name: 'temp2',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'temporary', timestamp: now + 20, lifetimeEnd: now + 30 },
        },
      ];

      const result = optimizer.optimize(tensors);

      const hasFusionOpt = result.optimizations.some((opt) => opt.type === 'tensor_fusion');
      expect(hasFusionOpt).toBe(true);
    });

    it('should apply buffer pooling', () => {
      const tensors: TensorInfo[] = Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        name: `tensor${i}`,
        size: 1024,
        shape: [32, 32],
        dtype: 'float32',
        usage: { type: 'activation', timestamp: i },
      }));

      const result = optimizer.optimize(tensors);

      const hasPoolingOpt = result.optimizations.some((opt) => opt.type === 'buffer_pooling');
      expect(hasPoolingOpt).toBe(true);
    });

    it('should calculate memory reduction', () => {
      const tensors: TensorInfo[] = [
        {
          id: 't1',
          name: 'tensor1',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation', timestamp: 0 },
        },
        {
          id: 't2',
          name: 'tensor2',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation', timestamp: 1 },
        },
      ];

      const result = optimizer.optimize(tensors);

      expect(result.reduction).toBeGreaterThanOrEqual(0);
      expect(result.reduction).toBeLessThanOrEqual(100);
    });
  });

  describe('allocate and deallocate', () => {
    it('should allocate memory for tensor', () => {
      const id = optimizer.allocate(1024, {
        type: 'activation',
        timestamp: Date.now(),
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should deallocate memory', () => {
      const id = optimizer.allocate(1024, {
        type: 'activation',
        timestamp: Date.now(),
      });

      expect(() => optimizer.deallocate(id)).not.toThrow();
    });

    it('should track allocations', () => {
      optimizer.allocate(1024, { type: 'activation', timestamp: 0 });
      optimizer.allocate(2048, { type: 'activation', timestamp: 1 });

      const stats = optimizer.getMemoryStats();

      expect(stats.allocationCount).toBe(2);
    });
  });

  describe('findSharableTensors', () => {
    it('should find tensors that can share memory', () => {
      const now = Date.now();
      const tensors: TensorInfo[] = [
        {
          id: 't1',
          name: 'tensor1',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'temporary', timestamp: now, lifetimeEnd: now + 10 },
        },
        {
          id: 't2',
          name: 'tensor2',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'temporary', timestamp: now + 20, lifetimeEnd: now + 30 },
        },
      ];

      const sharable = optimizer.findSharableTensors(tensors);

      expect(sharable).toBeDefined();
    });

    it('should not share tensors with different sizes', () => {
      const tensors: TensorInfo[] = [
        {
          id: 't1',
          name: 'tensor1',
          size: 1024,
          shape: [32, 32],
          dtype: 'float32',
          usage: { type: 'activation', timestamp: 0 },
        },
        {
          id: 't2',
          name: 'tensor2',
          size: 2048,
          shape: [32, 64],
          dtype: 'float32',
          usage: { type: 'activation', timestamp: 1 },
        },
      ];

      const sharable = optimizer.findSharableTensors(tensors);

      expect(sharable.length).toBe(0);
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics', () => {
      optimizer.allocate(1024, { type: 'activation', timestamp: 0 });
      optimizer.allocate(2048, { type: 'activation', timestamp: 1 });

      const stats = optimizer.getMemoryStats();

      expect(stats).toHaveProperty('totalAllocated');
      expect(stats).toHaveProperty('totalUsed');
      expect(stats).toHaveProperty('fragmentation');
      expect(stats).toHaveProperty('poolCount');
      expect(stats).toHaveProperty('allocationCount');
    });

    it('should track fragmentation', () => {
      optimizer.allocate(1024, { type: 'activation', timestamp: 0 });

      const stats = optimizer.getMemoryStats();

      expect(stats.fragmentation).toBeGreaterThanOrEqual(0);
      expect(stats.fragmentation).toBeLessThanOrEqual(1);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      optimizer.allocate(1024, { type: 'activation', timestamp: 0 });
      optimizer.reset();

      const stats = optimizer.getMemoryStats();

      expect(stats.allocationCount).toBe(0);
      expect(stats.poolCount).toBe(0);
    });
  });
});
