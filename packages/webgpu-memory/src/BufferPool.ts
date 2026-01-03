/**
 * @lsi/webgpu-memory - Buffer Pool
 *
 * Memory pool implementation with multiple allocation strategies
 * including first-fit, best-fit, worst-fit, buddy-system, and segregated fit.
 */

import type {
  BufferUsage as BufferUsageType,
  MemoryType,
  Allocation,
  MemoryPool,
  FreeBlock,
  PoolConfig,
  PoolStats,
} from "./types.js";
import { GPUDevice, GPUBuffer, PoolStrategy, GPUBufferUsage } from "./types.js";

/**
 * Default pool configuration
 */
const DEFAULT_POOL_CONFIG: PoolConfig = {
  size: 16 * 1024 * 1024, // 16MB
  memoryType: "device_local",
  strategy: PoolStrategy.BestFit,
  usage: 0,
  minBlockSize: 256,
  enableDefrag: true,
};

/**
 * Memory pool for efficient GPU buffer allocation
 *
 * Implements multiple allocation strategies to optimize for
 * different usage patterns and minimize fragmentation.
 */
export class BufferPool {
  private device: GPUDevice;
  private config: PoolConfig;
  private pool: MemoryPool;
  private allocationCounter: number = 0;
  private totalServed: number = 0;
  private cacheHits: number = 0;

  constructor(device: GPUDevice, config: Partial<PoolConfig> = {}) {
    this.device = device;
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };

    // Initialize pool with single free block
    this.pool = {
      pool_id: this.config.label || `pool_${Date.now()}`,
      size: this.config.size,
      memoryType: this.config.memoryType,
      free_blocks: [
        {
          offset: 0,
          size: this.config.size,
          available: true,
        },
      ],
      allocated_blocks: [],
      created_at: Date.now(),
      last_access: Date.now(),
      access_count: 0,
    };
  }

  /**
   * Allocate from pool
   */
  allocate(size: number, alignment: number = 1): Allocation {
    // Align size
    const alignedSize = this.alignUp(size, alignment);

    // Find free block using configured strategy
    const blockIndex = this.findFreeBlock(alignedSize);

    if (blockIndex === -1) {
      throw new Error(
        `Pool ${this.pool.pool_id}: No space for allocation of ${alignedSize} bytes`
      );
    }

    const block = this.pool.free_blocks[blockIndex];
    const offset = block.offset;

    // Split block if necessary
    if (block.size > alignedSize + this.config.minBlockSize!) {
      block.offset += alignedSize;
      block.size -= alignedSize;
    } else {
      // Use entire block
      this.pool.free_blocks.splice(blockIndex, 1);
    }

    // Create GPU buffer
    const buffer = this.device.createBuffer({
      size: alignedSize,
      usage:
        this.config.usage || GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Create allocation
    const allocation: Allocation = {
      allocation_id: `${this.pool.pool_id}_alloc_${this.allocationCounter++}`,
      buffer,
      offset,
      size: alignedSize,
      pool_id: this.pool.pool_id,
      usage: this.config.usage || 0,
      memoryType: this.pool.memoryType,
      created_at: Date.now(),
      last_access: Date.now(),
      mapped: false,
    };

    this.pool.allocated_blocks.push(allocation);
    this.pool.last_access = Date.now();
    this.pool.access_count++;
    this.totalServed++;

    return allocation;
  }

  /**
   * Free allocation back to pool
   */
  free(allocation: Allocation): void {
    // Verify allocation belongs to this pool
    if (allocation.pool_id !== this.pool.pool_id) {
      throw new Error(
        `Allocation does not belong to pool ${this.pool.pool_id}`
      );
    }

    // Find and remove from allocated blocks
    const index = this.pool.allocated_blocks.findIndex(
      a => a.allocation_id === allocation.allocation_id
    );

    if (index === -1) {
      throw new Error(`Allocation not found: ${allocation.allocation_id}`);
    }

    this.pool.allocated_blocks.splice(index, 1);

    // Add to free blocks
    this.pool.free_blocks.push({
      offset: allocation.offset,
      size: allocation.size,
      available: true,
    });

    // Merge adjacent free blocks
    this.coalesceFreeBlocks();

    // Destroy GPU buffer
    allocation.buffer.destroy();

    this.pool.last_access = Date.now();
  }

  /**
   * Find free block using configured strategy
   */
  private findFreeBlock(size: number): number {
    switch (this.config.strategy) {
      case PoolStrategy.FirstFit:
        return this.findFirstFit(size);
      case PoolStrategy.BestFit:
        return this.findBestFit(size);
      case PoolStrategy.WorstFit:
        return this.findWorstFit(size);
      case PoolStrategy.BuddySystem:
        return this.findBuddyBlock(size);
      case PoolStrategy.SegregatedFit:
        return this.findSegregatedFit(size);
      default:
        return this.findBestFit(size);
    }
  }

  /**
   * First-fit: First block that fits
   */
  private findFirstFit(size: number): number {
    for (let i = 0; i < this.pool.free_blocks.length; i++) {
      if (this.pool.free_blocks[i].size >= size) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Best-fit: Smallest block that fits
   */
  private findBestFit(size: number): number {
    let bestIndex = -1;
    let bestSize = Infinity;

    for (let i = 0; i < this.pool.free_blocks.length; i++) {
      const blockSize = this.pool.free_blocks[i].size;
      if (blockSize >= size && blockSize < bestSize) {
        bestIndex = i;
        bestSize = blockSize;
      }
    }

    return bestIndex;
  }

  /**
   * Worst-fit: Largest block that fits
   */
  private findWorstFit(size: number): number {
    let worstIndex = -1;
    let worstSize = -1;

    for (let i = 0; i < this.pool.free_blocks.length; i++) {
      const blockSize = this.pool.free_blocks[i].size;
      if (blockSize >= size && blockSize > worstSize) {
        worstIndex = i;
        worstSize = blockSize;
      }
    }

    return worstIndex;
  }

  /**
   * Buddy system: Power-of-2 allocation
   */
  private findBuddyBlock(size: number): number {
    const buddySize = this.nextPowerOfTwo(size);

    for (let i = 0; i < this.pool.free_blocks.length; i++) {
      const blockSize = this.pool.free_blocks[i].size;
      if (blockSize >= buddySize && this.isPowerOfTwo(blockSize)) {
        // Try to split block if it's too large
        if (blockSize > buddySize * 2) {
          this.splitBlock(i, buddySize);
          return this.findBuddyBlock(size); // Retry with split blocks
        }
        return i;
      }
    }

    return -1;
  }

  /**
   * Split a block into two equal halves (buddy system)
   */
  private splitBlock(index: number, targetSize: number): void {
    const block = this.pool.free_blocks[index];
    const halfSize = block.size / 2;

    this.pool.free_blocks.splice(index, 1);

    // Create two buddy blocks
    this.pool.free_blocks.push(
      { offset: block.offset, size: halfSize, available: true },
      { offset: block.offset + halfSize, size: halfSize, available: true }
    );
  }

  /**
   * Segregated fit: Size-class based allocation
   */
  private findSegregatedFit(size: number): number {
    const sizeClasses = [
      256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144,
      524288, 1048576, 2097152, 4194304,
    ];

    // Find appropriate size class
    let classIndex = 0;
    for (let i = 0; i < sizeClasses.length; i++) {
      if (size <= sizeClasses[i]) {
        classIndex = i;
        break;
      }
    }

    const targetSize = sizeClasses[classIndex];

    // Find block in this class
    for (let i = 0; i < this.pool.free_blocks.length; i++) {
      const blockSize = this.pool.free_blocks[i].size;
      if (blockSize >= targetSize && blockSize < targetSize * 2) {
        return i;
      }
    }

    // Fallback to best fit
    return this.findBestFit(size);
  }

  /**
   * Merge adjacent free blocks (coalescing)
   */
  private coalesceFreeBlocks(): void {
    if (this.pool.free_blocks.length < 2) return;

    // Sort by offset
    this.pool.free_blocks.sort((a, b) => a.offset - b.offset);

    const merged: FreeBlock[] = [];
    let current = this.pool.free_blocks[0];

    for (let i = 1; i < this.pool.free_blocks.length; i++) {
      const next = this.pool.free_blocks[i];

      // Check if adjacent
      if (current.offset + current.size === next.offset) {
        // Merge
        current.size += next.size;
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    this.pool.free_blocks = merged;
  }

  /**
   * Grow pool size
   */
  grow(additionalSize: number): void {
    const currentEnd = this.pool.size;

    // Extend pool
    this.pool.size += additionalSize;

    // Add new free block
    this.pool.free_blocks.push({
      offset: currentEnd,
      size: additionalSize,
      available: true,
    });
  }

  /**
   * Shrink pool (only if free space at end)
   */
  shrink(targetSize: number): number {
    if (targetSize >= this.pool.size) {
      return 0;
    }

    // Find free block at end
    const endBlockIndex = this.pool.free_blocks.findIndex(
      b => b.offset + b.size === this.pool.size
    );

    if (endBlockIndex === -1) {
      throw new Error("Cannot shrink: allocated blocks at end of pool");
    }

    const endBlock = this.pool.free_blocks[endBlockIndex];
    const reduction = this.pool.size - targetSize;

    if (endBlock.size < reduction) {
      throw new Error("Cannot shrink: not enough free space at end");
    }

    // Reduce block size
    endBlock.size -= reduction;
    this.pool.size = targetSize;

    return reduction;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const usedBytes = this.pool.allocated_blocks.reduce(
      (sum, a) => sum + a.size,
      0
    );
    const freeBytes = this.pool.free_blocks.reduce((sum, b) => sum + b.size, 0);

    // Calculate fragmentation
    const largestFreeBlock =
      this.pool.free_blocks.length > 0
        ? Math.max(...this.pool.free_blocks.map(b => b.size))
        : 0;
    const fragmentation = freeBytes > 0 ? 1 - largestFreeBlock / freeBytes : 0;

    return {
      poolId: this.pool.pool_id,
      totalSize: this.pool.size,
      usedBytes,
      freeBytes,
      utilization: this.pool.size > 0 ? usedBytes / this.pool.size : 0,
      allocationCount: this.pool.allocated_blocks.length,
      freeBlockCount: this.pool.free_blocks.length,
      fragmentation,
      totalServed: this.totalServed,
      hitRate: this.totalServed > 0 ? this.cacheHits / this.totalServed : 0,
    };
  }

  /**
   * Get pool info
   */
  getPool(): MemoryPool {
    return { ...this.pool };
  }

  /**
   * Check if pool has space for allocation
   */
  hasSpace(size: number): boolean {
    const alignedSize = this.alignUp(size, 1);
    const totalFree = this.pool.free_blocks.reduce((sum, b) => sum + b.size, 0);
    return totalFree >= alignedSize;
  }

  /**
   * Get largest free block size
   */
  getLargestFreeBlock(): number {
    if (this.pool.free_blocks.length === 0) {
      return 0;
    }
    return Math.max(...this.pool.free_blocks.map(b => b.size));
  }

  /**
   * Reset pool (free all allocations)
   */
  reset(): void {
    // Destroy all buffers
    for (const alloc of this.pool.allocated_blocks) {
      alloc.buffer.destroy();
    }

    // Reset to initial state
    this.pool.allocated_blocks = [];
    this.pool.free_blocks = [
      {
        offset: 0,
        size: this.pool.size,
        available: true,
      },
    ];
    this.allocationCounter = 0;
  }

  /**
   * Destroy pool
   */
  destroy(): void {
    this.reset();
  }

  /**
   * Align size up to alignment
   */
  private alignUp(size: number, alignment: number): number {
    return Math.ceil(size / alignment) * alignment;
  }

  /**
   * Check if number is power of 2
   */
  private isPowerOfTwo(n: number): boolean {
    return n > 0 && (n & (n - 1)) === 0;
  }

  /**
   * Get next power of 2
   */
  private nextPowerOfTwo(n: number): number {
    return Math.pow(2, Math.ceil(Math.log2(n)));
  }
}

/**
 * Create multiple pools with different memory types
 */
export function createMultiTypePools(
  device: GPUDevice,
  baseSize: number,
  count: number = 4
): Map<MemoryType, BufferPool> {
  const pools = new Map<MemoryType, BufferPool>();

  const types: MemoryType[] = ["device_local", "host_visible", "host_coherent"];

  for (const type of types) {
    pools.set(
      type,
      new BufferPool(device, {
        size: baseSize,
        memoryType: type,
        label: `${type}_pool`,
      })
    );
  }

  return pools;
}

/**
 * Hierarchical pool manager for size-class based pooling
 */
export class HierarchicalPoolManager {
  private device: GPUDevice;
  private pools: Map<number, BufferPool> = new Map();
  private sizeClasses: number[];

  constructor(device: GPUDevice, sizeClasses?: number[]) {
    this.device = device;

    // Default size classes (powers of 2 from 256 to 16MB)
    this.sizeClasses = sizeClasses || [
      256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144,
      524288, 1048576, 2097152, 4194304, 8388608, 16777216,
    ];

    // Create pools for each size class
    for (const size of this.sizeClasses) {
      this.pools.set(
        size,
        new BufferPool(device, {
          size: size * 16, // 16 blocks per pool
          label: `pool_${size}`,
        })
      );
    }
  }

  /**
   * Allocate from appropriate pool
   */
  allocate(size: number): Allocation {
    // Find appropriate size class
    const classSize = this.findSizeClass(size);

    const pool = this.pools.get(classSize);
    if (!pool) {
      throw new Error(`No pool for size class: ${classSize}`);
    }

    return pool.allocate(size);
  }

  /**
   * Free allocation
   */
  free(allocation: Allocation): void {
    const pool = this.pools.get(allocation.size);
    if (pool) {
      pool.free(allocation);
    }
  }

  /**
   * Find size class for allocation
   */
  private findSizeClass(size: number): number {
    for (const classSize of this.sizeClasses) {
      if (size <= classSize) {
        return classSize;
      }
    }
    // Return largest class if too big
    return this.sizeClasses[this.sizeClasses.length - 1];
  }

  /**
   * Get all pool stats
   */
  getAllStats(): PoolStats[] {
    const stats: PoolStats[] = [];
    for (const pool of this.pools.values()) {
      stats.push(pool.getStats());
    }
    return stats;
  }
}
