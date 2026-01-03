/**
 * @lsi/webgpu-memory - Memory Manager
 *
 * Central memory management for WebGPU applications.
 * Handles buffer allocation, pooling, deallocation, and statistics.
 */

import { GPUBuffer, GPUBufferUsage, MemoryEventType } from './types.js';
import type {
  GPUDevice,
  GPUAdapter,
  BufferUsage,
  MemoryType,
  Allocation,
  MemoryPool,
  MemoryStats,
  BufferOptions,
  AllocationResult,
  MemoryManagerConfig,
  MemoryEvent,
  MemoryHealth,
  GCResult,
  DefragmentationResult,
  DeviceInfo,
  MemorySnapshot,
  FreeBlock,
  SizeHistogram,
} from './types.js';

/**
 * Default configuration for MemoryManager
 */
const DEFAULT_CONFIG: MemoryManagerConfig = {
  defaultMemoryType: 'device_local',
  initialPoolSize: 16 * 1024 * 1024, // 16MB
  maxMemory: 0, // Device limit
  enableAutoDefrag: true,
  defragThreshold: 0.4, // Defrag when 40% fragmented
  enableProfiling: true,
  budget: {
    total: 0,
    allocations: 0.6,
    cache: 0.25,
    temporary: 0.1,
    reserve: 0.05,
  },
};

/**
 * Central memory manager for WebGPU buffers
 *
 * Manages multiple memory pools, handles allocation/deallocation,
 * tracks statistics, and provides memory health monitoring.
 */
export class MemoryManager {
  private device: GPUDevice;
  private adapter: GPUAdapter | null = null;
  private config: MemoryManagerConfig;
  private pools: Map<string, MemoryPool> = new Map();
  private allocations: Map<string, Allocation> = new Map();
  private allocationCounter: number = 0;
  private peakMemory: number = 0;
  private eventCallbacks: Set<(event: MemoryEvent) => void> = new Set();
  private profilingEnabled: boolean;
  private deviceInfo: DeviceInfo | null = null;

  constructor(device: GPUDevice, config?: Partial<MemoryManagerConfig>) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profilingEnabled = this.config.enableProfiling;

    // Initialize default pool
    this.createPool({
      pool_id: 'default',
      size: this.config.initialPoolSize,
      memoryType: this.config.defaultMemoryType,
      free_blocks: [],
      allocated_blocks: [],
      created_at: Date.now(),
      last_access: Date.now(),
      access_count: 0,
    });
  }

  /**
   * Set GPU adapter for querying device limits
   */
  async setAdapter(adapter: GPUAdapter): Promise<void> {
    this.adapter = adapter;
    this.deviceInfo = await this.queryDeviceInfo();

    // Set max memory if not configured
    if (this.config.maxMemory === 0) {
      // Estimate from max buffer size
      this.config.maxMemory = this.deviceInfo.maxBufferSize;
    }

    // Set total budget
    if (this.config.budget.total === 0) {
      this.config.budget.total = this.deviceInfo.maxBufferSize;
    }
  }

  /**
   * Query device information and limits
   */
  private async queryDeviceInfo(): Promise<DeviceInfo> {
    const adapterInfo = await this.adapter!.requestAdapterInfo();

    return {
      name: adapterInfo.device || 'Unknown',
      vendor: adapterInfo.vendor || 'Unknown',
      architecture: adapterInfo.architecture || 'Unknown',
      maxBufferSize: this.device.limits.maxBufferSize,
      maxBufferAlignment: this.device.limits.minUniformBufferOffsetAlignment,
      maxStorageBuffersPerStage: this.device.limits.maxStorageBuffersPerStage,
      maxUniformBuffersPerStage: this.device.limits.maxUniformBuffersPerStage,
    };
  }

  /**
   * Get device information
   */
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  /**
   * Register event callback
   */
  onEvent(callback: (event: MemoryEvent) => void): void {
    this.eventCallbacks.add(callback);
  }

  /**
   * Unregister event callback
   */
  offEvent(callback: (event: MemoryEvent) => void): void {
    this.eventCallbacks.delete(callback);
  }

  /**
   * Emit memory event
   */
  private emitEvent(
    size: number,
    allocation?: Allocation,
    data?: Record<string, unknown>
  ): void {
    const event: MemoryEvent = {
      type,
      timestamp: Date.now(),
      size,
      allocation,
      data,
    };

    this.eventCallbacks.forEach((cb) => {
      try {
        cb(event);
      } catch (e) {
        console.error('Event callback error:', e);
      }
    });

    // Also call config callback
    if (this.config.onEvent) {
      try {
        this.config.onEvent(event);
      } catch (e) {
        console.error('Config event callback error:', e);
      }
    }
  }

  /**
   * Allocate a GPU buffer
   */
  allocateBuffer(
    size: number,
    usage: BufferUsage,
    memoryType?: MemoryType
  ): GPUBuffer {
    const effectiveMemoryType = memoryType || this.config.defaultMemoryType;

    // Check if would exceed budget
    if (this.config.maxMemory > 0) {
      const currentUsage = this.getMemoryStats().used_memory;
      if (currentUsage + size > this.config.maxMemory) {
        throw new Error(
          `Allocation would exceed memory budget: ${currentUsage + size} > ${this.config.maxMemory}`
        );
      }
    }

    // Try to allocate from existing pools
    const pool = this.findPool(size, effectiveMemoryType);
    if (pool) {
      const allocation = this.allocateFromPool(size, pool.pool_id);
      return allocation.buffer;
    }

    // Create new pool if needed
    const newPoolSize = Math.max(size, this.config.initialPoolSize);
    this.createPool({
      pool_id: `pool_${this.pools.size}`,
      size: newPoolSize,
      memoryType: effectiveMemoryType,
      free_blocks: [{ offset: 0, size: newPoolSize, available: true }],
      allocated_blocks: [],
      created_at: Date.now(),
      last_access: Date.now(),
      access_count: 0,
    });

    const newPool = this.pools.get(`pool_${this.pools.size - 1}`)!;
    const allocation = this.allocateFromPool(size, newPool.pool_id);
    return allocation.buffer;
  }

  /**
   * Allocate with full result information
   */
  allocate(options: BufferOptions): AllocationResult {
    const buffer = this.allocateBuffer(
      options.size,
      options.usage,
      options.memoryType
    );

    // Find the allocation
    for (const alloc of this.allocations.values()) {
      if (alloc.buffer === buffer) {
        return {
          buffer: alloc.buffer,
          offset: alloc.offset,
          size: alloc.size,
          allocationId: alloc.allocation_id,
          poolId: alloc.pool_id,
        };
      }
    }

    throw new Error('Failed to find allocation after creation');
  }

  /**
   * Find suitable pool for allocation
   */
  private findPool(size: number, memoryType: MemoryType): MemoryPool | null {
    for (const pool of this.pools.values()) {
      if (pool.memoryType !== memoryType) continue;

      // Check if pool has space
      const freeSpace = pool.free_blocks.reduce((sum, b) => sum + b.size, 0);
      if (freeSpace >= size) {
        return pool;
      }
    }
    return null;
  }

  /**
   * Allocate from specific pool
   */
  allocateFromPool(size: number, poolId: string): Allocation {
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`Pool not found: ${poolId}`);
    }

    // Find free block (first-fit)
    let blockIndex = -1;
    for (let i = 0; i < pool.free_blocks.length; i++) {
      if (pool.free_blocks[i].size >= size) {
        blockIndex = i;
        break;
      }
    }

    if (blockIndex === -1) {
      throw new Error(`No suitable block in pool ${poolId} for size ${size}`);
    }

    const block = pool.free_blocks[blockIndex];
    const offset = block.offset;

    // Split block if necessary
    if (block.size > size) {
      block.offset += size;
      block.size -= size;
    } else {
      // Remove block if fully used
      pool.free_blocks.splice(blockIndex, 1);
    }

    // Create GPU buffer
    const buffer = this.device.createBuffer({
      size,
      mappedAtCreation: false,
    });

    // Create allocation record
    const allocation: Allocation = {
      allocation_id: `alloc_${this.allocationCounter++}`,
      buffer,
      offset,
      size,
      pool_id: poolId,
      usage: 0,
      memoryType: pool.memoryType,
      created_at: Date.now(),
      last_access: Date.now(),
      mapped: false,
    };

    this.allocations.set(allocation.allocation_id, allocation);
    pool.allocated_blocks.push(allocation);
    pool.last_access = Date.now();
    pool.access_count++;

    // Update peak memory
    const currentUsage = this.getMemoryStats().used_memory;
    if (currentUsage > this.peakMemory) {
      this.peakMemory = currentUsage;
    }


    return allocation;
  }

  /**
   * Free a GPU buffer
   */
  freeBuffer(buffer: GPUBuffer): void {
    // Find allocation
    let allocation: Allocation | undefined;
    for (const alloc of this.allocations.values()) {
      if (alloc.buffer === buffer) {
        allocation = alloc;
        break;
      }
    }

    if (!allocation) {
      throw new Error('Buffer not allocated by this manager');
    }

    this.freeToPool(allocation);
  }

  /**
   * Free allocation to pool
   */
  freeToPool(allocation: Allocation): void {
    const pool = this.pools.get(allocation.pool_id);
    if (!pool) {
      throw new Error(`Pool not found: ${allocation.pool_id}`);
    }

    // Remove from allocated blocks
    const allocIndex = pool.allocated_blocks.findIndex(
      (a) => a.allocation_id === allocation.allocation_id
    );
    if (allocIndex !== -1) {
      pool.allocated_blocks.splice(allocIndex, 1);
    }

    // Add to free blocks
    pool.free_blocks.push({
      offset: allocation.offset,
      size: allocation.size,
      available: true,
    });

    // Merge adjacent free blocks
    this.mergeFreeBlocks(pool);

    // Destroy buffer
    allocation.buffer.destroy();

    // Remove from allocations
    this.allocations.delete(allocation.allocation_id);

  }

  /**
   * Merge adjacent free blocks to reduce fragmentation
   */
  private mergeFreeBlocks(pool: MemoryPool): void {
    // Sort by offset
    pool.free_blocks.sort((a, b) => a.offset - b.offset);

    // Merge adjacent
    const merged: FreeBlock[] = [];
    let current = pool.free_blocks[0];

    for (let i = 1; i < pool.free_blocks.length; i++) {
      const next = pool.free_blocks[i];

      if (current.offset + current.size === next.offset) {
        // Merge
        current.size += next.size;
      } else {
        merged.push(current);
        current = next;
      }
    }

    if (current) {
      merged.push(current);
    }

    pool.free_blocks = merged;
  }

  /**
   * Create a new memory pool
   */
  createPool(pool: MemoryPool): void {
    this.pools.set(pool.pool_id, pool);
  }

  /**
   * Get memory statistics
   */
  getMemoryStats(): MemoryStats {
    let totalMemory = 0;
    let usedMemory = 0;
    let freeMemory = 0;
    const sizeDist: SizeHistogram = {
      tiny: 0,
      small: 0,
      medium: 0,
      large: 0,
      huge: 0,
    };

    for (const pool of this.pools.values()) {
      totalMemory += pool.size;

      for (const alloc of pool.allocated_blocks) {
        usedMemory += alloc.size;

        // Update size distribution
        if (alloc.size < 1024) sizeDist.tiny++;
        else if (alloc.size < 64 * 1024) sizeDist.small++;
        else if (alloc.size < 1024 * 1024) sizeDist.medium++;
        else if (alloc.size < 16 * 1024 * 1024) sizeDist.large++;
        else sizeDist.huge++;
      }

      for (const block of pool.free_blocks) {
        freeMemory += block.size;
      }
    }

    // Calculate fragmentation (simplified)
    const totalFreeBlocks = Array.from(this.pools.values()).reduce(
      (sum, p) => sum + p.free_blocks.length,
      0
    );
    const fragmentation =
      totalFreeBlocks > 1
        ? 1 - freeMemory / (totalFreeBlocks * (totalMemory / totalFreeBlocks))
        : 0;

    return {
      total_memory: totalMemory,
      used_memory: usedMemory,
      free_memory: freeMemory,
      fragmentation: Math.max(0, Math.min(1, fragmentation)),
      allocation_count: this.allocations.size,
      free_block_count: totalFreeBlocks,
      peak_memory: this.peakMemory,
      size_distribution: sizeDist,
    };
  }

  /**
   * Get pool statistics
   */
  getPoolStats(poolId: string) {
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`Pool not found: ${poolId}`);
    }

    const usedMemory = pool.allocated_blocks.reduce((sum, a) => sum + a.size, 0);
    const freeMemory = pool.free_blocks.reduce((sum, b) => sum + b.size, 0);

    return {
      poolId: pool.pool_id,
      totalSize: pool.size,
      usedBytes: usedMemory,
      freeBytes: freeMemory,
      utilization: usedMemory / pool.size,
      allocationCount: pool.allocated_blocks.length,
      freeBlockCount: pool.free_blocks.length,
      fragmentation: 0, // TODO: implement
      totalServed: pool.access_count,
      hitRate: 0, // TODO: implement
    };
  }

  /**
   * Get memory health status
   */
  getMemoryHealth(): MemoryHealth {
    const stats = this.getMemoryStats();
    const utilization = stats.total_memory > 0 ? stats.used_memory / stats.total_memory : 0;
    const fragmentation = stats.fragmentation;

    // Determine pressure level
    let pressure: string;
    let score: number;

    if (this.config.maxMemory === 0) {
      pressure = 'none';
      score = 1.0;
    } else {
      const usage = stats.used_memory / this.config.maxMemory;
      if (usage < 0.5) {
        pressure = 'none';
        score = 1.0;
      } else if (usage < 0.7) {
        pressure = 'low';
        score = 0.9;
      } else if (usage < 0.85) {
        pressure = 'medium';
        score = 0.7;
      } else if (usage < 0.95) {
        pressure = 'high';
        score = 0.5;
      } else {
        pressure = 'critical';
        score = 0.2;
      }
    }

    // Adjust score for fragmentation
    score *= (1 - fragmentation * 0.5);

    const recommendations: string[] = [];
    if (fragmentation > 0.3) {
      recommendations.push('High fragmentation detected - run defragmentation');
    }
    if (utilization > 0.8) {
      recommendations.push('High memory utilization - consider freeing unused buffers');
    }
    if (stats.free_block_count > 100) {
      recommendations.push('Many free blocks - defragmentation recommended');
    }

    return {
      score,
      pressure: pressure as any,
      fragmentation,
      utilization,
      healthy: score > 0.5,
      recommendations,
    };
  }

  /**
   * Defragment memory pools
   */
  defragment(): DefragmentationResult {
    const startTime = Date.now();

    const beforeStats = this.getMemoryStats();
    let movedBuffers = 0;
    let copiedBytes = 0;

    // For each pool, compact allocations
    for (const pool of this.pools.values()) {
      // Sort allocations by offset
      pool.allocated_blocks.sort((a, b) => a.offset - b.offset);

      // Rebuild free blocks
      let currentOffset = 0;
      const newFreeBlocks: FreeBlock[] = [];

      for (const alloc of pool.allocated_blocks) {
        if (alloc.offset > currentOffset) {
          newFreeBlocks.push({
            offset: currentOffset,
            size: alloc.offset - currentOffset,
            available: true,
          });
        }
        currentOffset = alloc.offset + alloc.size;
      }

      // Add remaining space
      if (currentOffset < pool.size) {
        newFreeBlocks.push({
          offset: currentOffset,
          size: pool.size - currentOffset,
          available: true,
        });
      }

      pool.free_blocks = newFreeBlocks;
    }

    const afterStats = this.getMemoryStats();

    return {
      beforeMemory: beforeStats.used_memory,
      afterMemory: afterStats.used_memory,
      beforeFragmentation: beforeStats.fragmentation,
      afterFragmentation: afterStats.fragmentation,
      movedBuffers,
      copiedBytes,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Garbage collect unused resources
   */
  garbageCollect(): GCResult {
    const startTime = Date.now();
    let collectedCount = 0;
    let freedBytes = 0;
    let poolsReleased = 0;

    // Release empty pools
    for (const [poolId, pool] of this.pools.entries()) {
      if (
        pool.allocated_blocks.length === 0 &&
        pool.pool_id !== 'default' &&
        pool.access_count === 0
      ) {
        this.pools.delete(poolId);
        poolsReleased++;
        freedBytes += pool.size;
      }
    }

    const duration = Date.now() - startTime;

      poolsReleased,
      duration,
    });

    return {
      collectedCount,
      freedBytes,
      poolsReleased,
      duration,
    };
  }

  /**
   * Create memory snapshot for debugging
   */
  createSnapshot(): MemorySnapshot {
    return {
      timestamp: Date.now(),
      pools: Array.from(this.pools.values()),
      allocations: Array.from(this.allocations.values()),
      stats: this.getMemoryStats(),
      deviceInfo: this.deviceInfo || {
        name: 'Unknown',
        vendor: 'Unknown',
        architecture: 'Unknown',
        maxBufferSize: 0,
        maxBufferAlignment: 0,
        maxStorageBuffersPerStage: 0,
        maxUniformBuffersPerStage: 0,
      },
    };
  }

  /**
   * Get all allocations
   */
  getAllocations(): Allocation[] {
    return Array.from(this.allocations.values());
  }

  /**
   * Get all pools
   */
  getPools(): MemoryPool[] {
    return Array.from(this.pools.values());
  }

  /**
   * Reset all allocations (use with caution)
   */
  reset(): void {
    // Destroy all buffers
    for (const alloc of this.allocations.values()) {
      alloc.buffer.destroy();
    }

    this.allocations.clear();
    this.pools.clear();
    this.allocationCounter = 0;
    this.peakMemory = 0;

    // Recreate default pool
    this.createPool({
      pool_id: 'default',
      size: this.config.initialPoolSize,
      memoryType: this.config.defaultMemoryType,
      free_blocks: [],
      allocated_blocks: [],
      created_at: Date.now(),
      last_access: Date.now(),
      access_count: 0,
    });
  }

  /**
   * Destroy the memory manager and release all resources
   */
  destroy(): void {
    this.reset();
    this.eventCallbacks.clear();
  }
}
