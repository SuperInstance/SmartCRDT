/**
 * Buffer Pool
 * Efficient GPU buffer management with pre-allocation, reuse, and size management
 */

import type {
  BufferPoolConfig,
  PoolStats,
  GrowStrategy,
  ShrinkStrategy,
} from "../types.js";

export class BufferPool {
  private available: GPUBuffer[] = [];
  private acquired: Set<GPUBuffer> = new Set();
  private totalAllocations: number = 0;
  private totalReleases: number = 0;
  private peakUsage: number = 0;
  private lastShrinkTime: number = Date.now();
  private shrinkTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private config: BufferPoolConfig) {
    this.preAllocate(config.initialSize);
    this.startShrinkTimer();
  }

  /**
   * Acquire a buffer from the pool
   */
  acquire(): GPUBuffer | Promise<GPUBuffer> {
    if (this.available.length > 0) {
      const buffer = this.available.pop()!;
      this.acquired.add(buffer);
      this.updatePeakUsage();
      return buffer;
    }

    // Pool is empty, allocate new buffer
    return this.allocateNew();
  }

  /**
   * Return a buffer to the pool
   */
  release(buffer: GPUBuffer): void {
    if (!this.acquired.has(buffer)) {
      throw new Error("Buffer not acquired from this pool");
    }

    this.acquired.delete(buffer);
    this.available.push(buffer);
    this.totalReleases++;

    // Check if we should shrink
    if (this.shouldShrink()) {
      this.scheduleShrink();
    }
  }

  /**
   * Get pool statistics
   */
  stats(): PoolStats {
    const totalBuffers = this.available.length + this.acquired.size;
    const memoryUsage = totalBuffers * this.config.bufferSize;

    return {
      totalBuffers,
      availableBuffers: this.available.length,
      acquiredBuffers: this.acquired.size,
      totalAllocations: this.totalAllocations,
      totalReleases: this.totalReleases,
      hitRate: this.totalReleases / Math.max(1, this.totalAllocations),
      memoryUsage: memoryUsage / 1024 / 1024, // Convert to MB
      peakUsage: (this.peakUsage * this.config.bufferSize) / 1024 / 1024,
    };
  }

  /**
   * Clear all buffers from the pool
   */
  clear(): void {
    // Destroy all buffers
    for (const buffer of this.available) {
      buffer.destroy();
    }
    for (const buffer of this.acquired) {
      buffer.destroy();
    }

    this.available = [];
    this.acquired.clear();
    this.totalAllocations = 0;
    this.totalReleases = 0;
    this.peakUsage = 0;
  }

  /**
   * Resize the pool to a target size
   */
  resize(targetSize: number): void {
    const currentSize = this.available.length + this.acquired.size;

    if (targetSize > currentSize) {
      // Grow pool
      const toAdd = targetSize - currentSize;
      this.preAllocate(toAdd);
    } else if (targetSize < currentSize) {
      // Shrink pool (only available buffers)
      const toRemove = Math.min(
        this.available.length,
        currentSize - targetSize
      );
      for (let i = 0; i < toRemove; i++) {
        const buffer = this.available.pop();
        if (buffer) {
          buffer.destroy();
        }
      }
    }
  }

  /**
   * Warm up the pool with a specific number of buffers
   */
  warmup(count: number): void {
    const toAdd = Math.max(0, count - this.available.length);
    this.preAllocate(toAdd);
  }

  /**
   * Get the current size of the pool
   */
  size(): number {
    return this.available.length + this.acquired.size;
  }

  /**
   * Check if pool is healthy (has available buffers)
   */
  isHealthy(): boolean {
    return (
      this.available.length > 0 ||
      !this.config.maxSize ||
      this.size() < this.config.maxSize
    );
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.shrinkTimer) {
      clearTimeout(this.shrinkTimer);
    }
    this.clear();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private preAllocate(count: number): void {
    for (let i = 0; i < count; i++) {
      this.available.push(this.createBuffer());
    }
  }

  private async allocateNew(): Promise<GPUBuffer> {
    // Check if we're at max size
    if (this.config.maxSize && this.size() >= this.config.maxSize) {
      // Wait for a buffer to become available
      return this.waitForBuffer();
    }

    const buffer = this.createBuffer();
    this.totalAllocations++;
    this.acquired.add(buffer);
    this.updatePeakUsage();
    return buffer;
  }

  private createBuffer(): GPUBuffer {
    // In a real implementation, this would use WebGPU device
    // For now, return a mock object
    return {
      size: this.config.bufferSize,
      destroy: () => {},
      mapAsync: async () => {},
      unmap: () => {},
      // Other GPUBuffer methods would be here
    } as unknown as GPUBuffer;
  }

  private updatePeakUsage(): void {
    const currentUsage = this.acquired.size;
    if (currentUsage > this.peakUsage) {
      this.peakUsage = currentUsage;
    }
  }

  private shouldShrink(): boolean {
    if (this.config.shrinkStrategy === "never") {
      return false;
    }

    const idleTime = Date.now() - this.lastShrinkTime;
    const utilizationRate = this.acquired.size / this.size();

    if (this.config.shrinkStrategy === "aggressive") {
      return utilizationRate < 0.25 && this.available.length > 2;
    } else if (this.config.shrinkStrategy === "idle") {
      return (
        utilizationRate < 0.1 && idleTime > 30000 && this.available.length > 4
      );
    } else if (this.config.shrinkStrategy === "adaptive") {
      // Shrink if we have many idle buffers and low utilization
      return this.available.length > 10 && utilizationRate < 0.3;
    }

    return false;
  }

  private scheduleShrink(): void {
    if (this.shrinkTimer) return;

    this.shrinkTimer = setTimeout(() => {
      this.shrink();
      this.shrinkTimer = null;
    }, 1000); // Wait 1 second before shrinking
  }

  private shrink(): void {
    const targetSize = this.calculateTargetSize();
    this.resize(targetSize);
    this.lastShrinkTime = Date.now();
  }

  private calculateTargetSize(): number {
    const currentUsage = this.acquired.size;
    const headroom = Math.ceil(currentUsage * 1.5);

    // Ensure minimum of 2 buffers
    return Math.max(2, headroom);
  }

  private startShrinkTimer(): void {
    // Periodic cleanup every minute
    setInterval(() => {
      if (this.shouldShrink()) {
        this.scheduleShrink();
      }
    }, 60000);
  }

  private async waitForBuffer(): Promise<GPUBuffer> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.available.length > 0) {
          clearInterval(checkInterval);
          const buffer = this.available.pop()!;
          this.acquired.add(buffer);
          resolve(buffer);
        }
      }, 10); // Check every 10ms
    });
  }
}

// ============================================================================
// TENSOR POOL
// ============================================================================

export interface Tensor {
  data: Float32Array;
  shape: number[];
  size: number;
}

export class TensorPool {
  private pools: Map<number, Tensor[]> = new Map();
  private acquired: Set<Tensor> = new Set();
  private stats = {
    hits: 0,
    misses: 0,
    allocations: 0,
  };

  constructor() {}

  /**
   * Acquire a tensor of the specified size
   */
  acquire(size: number): Tensor {
    const pool = this.pools.get(size);

    if (pool && pool.length > 0) {
      const tensor = pool.pop()!;
      this.acquired.add(tensor);
      this.stats.hits++;
      return tensor;
    }

    // No tensor available, allocate new one
    this.stats.misses++;
    this.stats.allocations++;

    const tensor = this.createTensor(size);
    this.acquired.add(tensor);
    return tensor;
  }

  /**
   * Return a tensor to the pool
   */
  release(tensor: Tensor): void {
    if (!this.acquired.has(tensor)) {
      throw new Error("Tensor not acquired from this pool");
    }

    this.acquired.delete(tensor);

    // Reset tensor data (optional, for security)
    tensor.data.fill(0);

    // Add to appropriate pool
    const size = tensor.size;
    if (!this.pools.has(size)) {
      this.pools.set(size, []);
    }

    this.pools.get(size)!.push(tensor);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const totalTensors = Array.from(this.pools.values()).reduce(
      (sum, pool) => sum + pool.length,
      0
    );
    const hitRate =
      this.stats.hits / Math.max(1, this.stats.hits + this.stats.misses);

    return {
      totalTensors,
      acquiredTensors: this.acquired.size,
      hitRate,
      allocations: this.stats.allocations,
      poolCount: this.pools.size,
    };
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.pools.clear();
    this.acquired.clear();
    this.stats = { hits: 0, misses: 0, allocations: 0 };
  }

  private createTensor(size: number): Tensor {
    return {
      data: new Float32Array(size),
      shape: [size],
      size,
    };
  }
}

// ============================================================================
// MEMORY ARENA
// ============================================================================

export interface ArenaAllocation {
  offset: number;
  size: number;
  inUse: boolean;
  timestamp: number;
}

export class MemoryArena {
  private buffer: Uint8Array;
  private allocations: Map<string, ArenaAllocation> = new Map();
  private freeBlocks: Array<{ offset: number; size: number }> = [];
  private nextId = 0;

  constructor(size: number) {
    this.buffer = new Uint8Array(size);
    this.freeBlocks.push({ offset: 0, size });
  }

  /**
   * Allocate memory from the arena
   */
  allocate(size: number, alignment: number = 16): string {
    // Align size
    const alignedSize = Math.ceil(size / alignment) * alignment;

    // Find suitable free block
    const blockIndex = this.findFreeBlock(alignedSize);
    if (blockIndex === -1) {
      throw new Error("Arena out of memory");
    }

    const block = this.freeBlocks[blockIndex];
    const id = `arena_${this.nextId++}`;

    // Remove block from free list
    this.freeBlocks.splice(blockIndex, 1);

    // Split block if there's remaining space
    if (block.size > alignedSize) {
      this.freeBlocks.push({
        offset: block.offset + alignedSize,
        size: block.size - alignedSize,
      });
      // Sort by offset for coalescing
      this.freeBlocks.sort((a, b) => a.offset - b.offset);
    }

    this.allocations.set(id, {
      offset: block.offset,
      size: alignedSize,
      inUse: true,
      timestamp: Date.now(),
    });

    return id;
  }

  /**
   * Free memory from the arena
   */
  free(id: string): void {
    const allocation = this.allocations.get(id);
    if (!allocation) {
      throw new Error("Invalid allocation ID");
    }

    this.allocations.delete(id);

    // Add to free blocks
    this.freeBlocks.push({
      offset: allocation.offset,
      size: allocation.size,
    });

    // Coalesce adjacent free blocks
    this.coalesceFreeBlocks();
  }

  /**
   * Get pointer to allocated memory
   */
  getPointer(id: string): number {
    const allocation = this.allocations.get(id);
    if (!allocation) {
      throw new Error("Invalid allocation ID");
    }
    return allocation.offset;
  }

  /**
   * Get arena statistics
   */
  getStats() {
    const totalSize = this.buffer.length;
    const usedSize = Array.from(this.allocations.values()).reduce(
      (sum, a) => sum + a.size,
      0
    );
    const freeSize = totalSize - usedSize;
    const fragmentation = this.calculateFragmentation();

    return {
      totalSize,
      usedSize,
      freeSize,
      utilization: usedSize / totalSize,
      fragmentation,
      allocationCount: this.allocations.size,
      freeBlockCount: this.freeBlocks.length,
    };
  }

  /**
   * Reset the arena (free all allocations)
   */
  reset(): void {
    this.allocations.clear();
    this.freeBlocks = [{ offset: 0, size: this.buffer.length }];
    this.nextId = 0;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private findFreeBlock(size: number): number {
    // First-fit strategy
    for (let i = 0; i < this.freeBlocks.length; i++) {
      if (this.freeBlocks[i].size >= size) {
        return i;
      }
    }
    return -1;
  }

  private coalesceFreeBlocks(): void {
    if (this.freeBlocks.length < 2) return;

    // Sort by offset
    this.freeBlocks.sort((a, b) => a.offset - b.offset);

    const coalesced: Array<{ offset: number; size: number }> = [];
    let current = this.freeBlocks[0];

    for (let i = 1; i < this.freeBlocks.length; i++) {
      const next = this.freeBlocks[i];

      // Check if blocks are adjacent
      if (current.offset + current.size === next.offset) {
        // Merge blocks
        current.size += next.size;
      } else {
        coalesced.push(current);
        current = next;
      }
    }

    coalesced.push(current);
    this.freeBlocks = coalesced;
  }

  private calculateFragmentation(): number {
    if (this.freeBlocks.length <= 1) return 0;

    const totalFree = this.freeBlocks.reduce((sum, b) => sum + b.size, 0);
    const largestFree = Math.max(...this.freeBlocks.map(b => b.size));

    return 1 - largestFree / totalFree;
  }
}

// ============================================================================
// HIERARCHICAL POOL MANAGER
// ============================================================================

export class HierarchicalPoolManager {
  private smallBufferPool: BufferPool;
  private mediumBufferPool: BufferPool;
  private largeBufferPool: BufferPool;
  private tensorPool: TensorPool;

  constructor() {
    this.smallBufferPool = new BufferPool({
      initialSize: 16,
      bufferSize: 1024, // 1KB
      growStrategy: "on_demand",
      shrinkStrategy: "idle",
    });

    this.mediumBufferPool = new BufferPool({
      initialSize: 8,
      bufferSize: 1024 * 1024, // 1MB
      growStrategy: "linear",
      shrinkStrategy: "idle",
    });

    this.largeBufferPool = new BufferPool({
      initialSize: 2,
      bufferSize: 16 * 1024 * 1024, // 16MB
      growStrategy: "on_demand",
      shrinkStrategy: "never",
    });

    this.tensorPool = new TensorPool();
  }

  /**
   * Acquire a buffer of appropriate size
   */
  acquireBuffer(size: number): GPUBuffer | Promise<GPUBuffer> {
    if (size <= 1024) {
      return this.smallBufferPool.acquire();
    } else if (size <= 1024 * 1024) {
      return this.mediumBufferPool.acquire();
    } else {
      return this.largeBufferPool.acquire();
    }
  }

  /**
   * Release a buffer
   */
  releaseBuffer(buffer: GPUBuffer): void {
    const size = buffer.size;

    if (size <= 1024) {
      this.smallBufferPool.release(buffer);
    } else if (size <= 1024 * 1024) {
      this.mediumBufferPool.release(buffer);
    } else {
      this.largeBufferPool.release(buffer);
    }
  }

  /**
   * Acquire a tensor
   */
  acquireTensor(size: number): Tensor {
    return this.tensorPool.acquire(size);
  }

  /**
   * Release a tensor
   */
  releaseTensor(tensor: Tensor): void {
    this.tensorPool.release(tensor);
  }

  /**
   * Get aggregate statistics
   */
  getStats() {
    return {
      smallBuffers: this.smallBufferPool.stats(),
      mediumBuffers: this.mediumBufferPool.stats(),
      largeBuffers: this.largeBufferPool.stats(),
      tensors: this.tensorPool.getStats(),
    };
  }

  /**
   * Clean up all pools
   */
  dispose(): void {
    this.smallBufferPool.dispose();
    this.mediumBufferPool.dispose();
    this.largeBufferPool.dispose();
    this.tensorPool.clear();
  }
}
