/**
 * @lsi/webgpu-memory - Integration
 *
 * Integration with VL-JEPA and other Aequor components.
 * Specialized allocators for neural network workloads.
 */

import { GPUDevice, GPUBuffer, GPUBufferUsage, PoolStrategy, EvictionStrategy };
import type {
  MemoryType,
  VLJEPAMemoryConfig,
  Allocation,
} from './types.js';

import { MemoryManager } from './MemoryManager.js';
import { BufferPool } from './BufferPool.js';
import { ArenaAllocator } from './MemoryAllocator.js';
import { SmartEviction } from './SmartEviction.js';

/**
 * VL-JEPA specialized memory allocator
 *
 * Optimized for VL-JEPA neural network workloads with 768-dim embeddings.
 */
export class VLJEPAMemoryAllocator {
  private manager: MemoryManager;
  private config: VLJEPAMemoryConfig;
  private embeddingBufferPool: BufferPool;
  private tempArena: ArenaAllocator;
  private evictionCache: SmartEviction;

  // Embedding size: 768 dimensions * 4 bytes (float32) = 3072 bytes
  private static readonly EMBEDDING_SIZE = 768 * 4;

    this.device = device;
    this.config = {
      embeddingDim: 768,
      maxBatchSize: 32,
      tempBufferSize: 16 * 1024 * 1024, // 16MB
      cacheEmbeddings: true,
      maxCachedEmbeddings: 1000,
      ...config,
    };

    this.manager = new MemoryManager(device);

    // Create embedding buffer pool (pre-allocate for performance)
    this.embeddingBufferPool = new BufferPool(device, {
      size: this.config.maxBatchSize * VLJEPAMemoryAllocator.EMBEDDING_SIZE * 10,
      memoryType: 'device_local',
      strategy: PoolStrategy.BestFit,
      label: 'vljepa_embeddings',
    });

    // Create arena for temporary buffers
    this.tempArena = new ArenaAllocator(device, {
      initialSize: this.config.tempBufferSize,
      maxSize: this.config.tempBufferSize * 2,
    });

    // Create cache for embedding buffers
    this.evictionCache = new SmartEviction(
      this.config.maxCachedEmbeddings * VLJEPAMemoryAllocator.EMBEDDING_SIZE,
      EvictionStrategy.LRU
    );
  }

  /**
   * Allocate embedding buffer (768-dim float32)
   */
  allocateEmbeddingBuffer(batchSize: number = 1): Allocation {
    const size = batchSize * VLJEPAMemoryAllocator.EMBEDDING_SIZE;

    if (this.config.cacheEmbeddings) {
      const cacheKey = `embedding_${batchSize}`;

      // Check cache first
      const cached = this.evictionCache.get(cacheKey);
      if (cached) {
        return {
          allocation_id: cacheKey,
          buffer: cached.buffer,
          offset: 0,
          size,
          pool_id: 'cache',
          usage: 0,
          memoryType: 'device_local',
          created_at: Date.now(),
          last_access: Date.now(),
          mapped: false,
        };
      }

      // Allocate new buffer
      const allocation = this.embeddingBufferPool.allocate(size);

      // Cache it
      this.evictionCache.register(
        cacheKey,
        allocation.buffer,
        size,
        0.7, // High priority for embeddings
        0.8 // High reload cost
      );

      return allocation;
    }

    return this.embeddingBufferPool.allocate(size);
  }

  /**
   * Allocate temporary compute buffer
   */
  allocateTempBuffer(size: number): Allocation {
    return this.tempArena.allocate(size);
  }

  /**
   * Allocate batch embedding buffer
   */
  allocateBatchEmbeddings(batchSize: number): Allocation {
    return this.allocateEmbeddingBuffer(batchSize);
  }

  /**
   * Allocate attention mask buffer
   */
  allocateAttentionMask(batchSize: number, seqLen: number): Allocation {
    const size = batchSize * seqLen * 4; // float32
    return this.allocateTempBuffer(size);
  }

  /**
   * Allocate encoder output buffer
   */
  allocateEncoderOutput(batchSize: number, seqLen: number, hiddenDim: number): Allocation {
    const size = batchSize * seqLen * hiddenDim * 4; // float32
    return this.embeddingBufferPool.allocate(size);
  }

  /**
   * Allocate predictor buffer
   */
  allocatePredictorBuffer(batchSize: number): Allocation {
    // Predictor outputs same size as embedding
    return this.allocateEmbeddingBuffer(batchSize);
  }

  /**
   * Reset temporary arena
   */
  resetTempArena(): void {
    this.tempArena.reset();
  }

  /**
   * Free embedding buffer (returns to pool/cache)
   */
  freeEmbeddingBuffer(allocation: Allocation): void {
    if (allocation.pool_id === 'cache') {
      // Don't actually free - let cache eviction handle it
      this.evictionCache.touch(allocation.allocation_id);
    } else {
      this.embeddingBufferPool.free(allocation);
    }
  }

  /**
   * Get memory statistics
   */
  getStats() {
    return {
      embeddings: this.embeddingBufferPool.getStats(),
      temp: {
        utilization: this.tempArena.getUtilization(),
        size: this.tempArena.getSize(),
      },
      cache: this.evictionCache.getStats(),
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.evictionCache.clear();
  }

  /**
   * Destroy allocator
   */
  destroy(): void {
    this.embeddingBufferPool.destroy();
    this.tempArena.destroy();
    this.evictionCache.clear();
    this.manager.destroy();
  }
}

/**
 * Cross-context memory sharing
 *
 * Allows sharing GPU buffers between different WebGPU contexts
 * (when supported by the browser).
 */
export class CrossContextSharing {
  private sharedBuffers: Map<string, SharedMemory> = new Map();
  private device: GPUDevice;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Create shareable buffer
   */
  createSharedBuffer(
    key: string,
    size: number,
    usage: number
  ): GPUBuffer {
    // Check if buffer already exists
    const existing = this.sharedBuffers.get(key);
    if (existing) {
      return existing.buffer;
    }

    // Create new buffer
    const buffer = this.device.createBuffer({
      size,
      usage,
    });

    this.sharedBuffers.set(key, {
      key,
      buffer,
      size,
      refCount: 1,
      createdAt: Date.now(),
    });

    return buffer;
  }

  /**
   * Get shared buffer
   */
  getSharedBuffer(key: string): GPUBuffer | undefined {
    const shared = this.sharedBuffers.get(key);
    if (shared) {
      shared.refCount++;
      return shared.buffer;
    }
    return undefined;
  }

  /**
   * Release shared buffer
   */
  releaseSharedBuffer(key: string): void {
    const shared = this.sharedBuffers.get(key);
    if (shared) {
      shared.refCount--;

      if (shared.refCount <= 0) {
        shared.buffer.destroy();
        this.sharedBuffers.delete(key);
      }
    }
  }

  /**
   * Get all shared buffers
   */
  getSharedBuffers(): SharedMemory[] {
    return Array.from(this.sharedBuffers.values());
  }
}

/**
 * Shared memory entry
 */
interface SharedMemory {
  key: string;
  buffer: GPUBuffer;
  size: number;
  refCount: number;
  createdAt: number;
}

/**
 * Temporary buffer manager for compute operations
 *
 * Recycles temporary buffers used in compute shaders
 */
export class TempBufferManager {
  private device: GPUDevice;
  private tempBuffers: Map<number, TempBufferPool> = new Map();
  private maxPoolSize: number = 16;

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Acquire temporary buffer
   */
  acquire(size: number, usage: number): TempBuffer {
    // Find appropriate size class (power of 2)
    const sizeClass = this.ceilPowerOfTwo(size);

    let pool = this.tempBuffers.get(sizeClass);

    if (!pool) {
      pool = new TempBufferPool(this.device, sizeClass, usage, this.maxPoolSize);
      this.tempBuffers.set(sizeClass, pool);
    }

    return pool.acquire();
  }

  /**
   * Release temporary buffer
   */
  release(buffer: TempBuffer): void {
    const sizeClass = buffer.buffer.size;
    const pool = this.tempBuffers.get(sizeClass);

    if (pool) {
      pool.release(buffer);
    } else {
      buffer.buffer.destroy();
    }
  }

  /**
   * Clear all pools
   */
  clear(): void {
    for (const pool of this.tempBuffers.values()) {
      pool.destroy();
    }
    this.tempBuffers.clear();
  }

  private ceilPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
}

/**
 * Temporary buffer
 */
export interface TempBuffer {
  buffer: GPUBuffer;
  inUse: boolean;
}

/**
 * Temporary buffer pool
 */
class TempBufferPool {
  private device: GPUDevice;
  private size: number;
  private usage: number;
  private maxBuffers: number;
  private buffers: TempBuffer[] = [];

  constructor(device: GPUDevice, size: number, usage: number, maxBuffers: number) {
    this.device = device;
    this.size = size;
    this.usage = usage;
    this.maxBuffers = maxBuffers;
  }

  /**
   * Acquire buffer from pool
   */
  acquire(): TempBuffer {
    // Find free buffer
    for (const buf of this.buffers) {
      if (!buf.inUse) {
        buf.inUse = true;
        return buf;
      }
    }

    // Create new buffer if under limit
    if (this.buffers.length < this.maxBuffers) {
      const buffer = this.device.createBuffer({
        size: this.size,
        usage: this.usage,
      });

      const tempBuf: TempBuffer = {
        buffer,
        inUse: true,
      };

      this.buffers.push(tempBuf);
      return tempBuf;
    }

    // Pool exhausted, throw error
    throw new Error(`Temp buffer pool exhausted (size: ${this.size})`);
  }

  /**
   * Release buffer back to pool
   */
  release(tempBuf: TempBuffer): void {
    tempBuf.inUse = false;
  }

  /**
   * Destroy pool
   */
  destroy(): void {
    for (const buf of this.buffers) {
      buf.buffer.destroy();
    }
    this.buffers = [];
  }
}

/**
 * Neural network memory layout manager
 *
 * Manages memory layout for neural network parameters and activations
 */
export class NNMemoryLayout {
  private device: GPUDevice;
  private parameterBuffers: Map<string, GPUBuffer> = new Map();
  private activationBuffers: Map<string, GPUBuffer> = new Map();

  constructor(device: GPUDevice) {
    this.device = device;
  }

  /**
   * Allocate parameter buffer
   */
  allocateParameter(layer: string, size: number): GPUBuffer {
    const key = `param_${layer}`;

    if (this.parameterBuffers.has(key)) {
      return this.parameterBuffers.get(key)!;
    }

    const buffer = this.device.createBuffer({
      size,
      usage: number.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.parameterBuffers.set(key, buffer);
    return buffer;
  }

  /**
   * Allocate activation buffer
   */
  allocateActivation(layer: string, size: number): GPUBuffer {
    const key = `activation_${layer}`;

    if (this.activationBuffers.has(key)) {
      return this.activationBuffers.get(key)!;
    }

    const buffer = this.device.createBuffer({
      size,
      usage: number.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });

    this.activationBuffers.set(key, buffer);
    return buffer;
  }

  /**
   * Get parameter buffer
   */
  getParameter(layer: string): GPUBuffer | undefined {
    return this.parameterBuffers.get(`param_${layer}`);
  }

  /**
   * Get activation buffer
   */
  getActivation(layer: string): GPUBuffer | undefined {
    return this.activationBuffers.get(`activation_${layer}`);
  }

  /**
   * Free parameter buffer
   */
  freeParameter(layer: string): void {
    const buffer = this.parameterBuffers.get(`param_${layer}`);
    if (buffer) {
      buffer.destroy();
      this.parameterBuffers.delete(`param_${layer}`);
    }
  }

  /**
   * Free activation buffer
   */
  freeActivation(layer: string): void {
    const buffer = this.activationBuffers.get(`activation_${layer}`);
    if (buffer) {
      buffer.destroy();
      this.activationBuffers.delete(`activation_${layer}`);
    }
  }

  /**
   * Clear all buffers
   */
  clear(): void {
    for (const buffer of this.parameterBuffers.values()) {
      buffer.destroy();
    }
    for (const buffer of this.activationBuffers.values()) {
      buffer.destroy();
    }
    this.parameterBuffers.clear();
    this.activationBuffers.clear();
  }
}
