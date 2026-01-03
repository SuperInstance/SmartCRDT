/**
 * @lsi/webgpu-memory - Memory Allocator
 *
 * Multiple allocator strategies: Arena, Stack, Pool, and Free List allocators.
 * Each optimized for different allocation patterns.
 */

import { GPUDevice, GPUBuffer, GPUBufferUsage } from "./types.js";
import type {
  BufferUsage as BufferUsageType,
  Allocation,
  AllocatorConfig,
} from "./types.js";

/**
 * Default allocator configuration
 */
const DEFAULT_ALLOCATOR_CONFIG: AllocatorConfig = {
  initialSize: 4 * 1024 * 1024, // 4MB
  maxSize: 0, // Unlimited
  growthIncrement: 2 * 1024 * 1024, // 2MB
  alignment: 16, // SIMD alignment
  enableTracking: true,
};

/**
 * Arena Allocator - Bump pointer allocation
 *
 * Fastest allocator for temporary allocations. All allocations
 * are freed at once when reset() is called. No individual frees.
 */
export class ArenaAllocator {
  private config: AllocatorConfig;
  private currentOffset: number = 0;
  private arenaSize: number;
  private allocations: Map<string, Allocation> = new Map();
  private allocationCounter: number = 0;
  private active: boolean = true;

  constructor(device: GPUDevice, config?: Partial<AllocatorConfig>) {
    this.device = device;
    this.config = { ...DEFAULT_ALLOCATOR_CONFIG, ...config };
    this.arenaSize = this.config.initialSize;
    this.allocateArena();
  }

  /**
   * Allocate from arena
   */
  allocate(size: number): Allocation {
    if (!this.active) {
      throw new Error("Arena is not active");
    }

    const alignedSize = this.alignUp(size, this.config.alignment);

    // Check if we need to grow
    if (this.currentOffset + alignedSize > this.arenaSize) {
      if (this.config.maxSize > 0 && this.arenaSize >= this.config.maxSize) {
        throw new Error("Arena allocation failed: max size exceeded");
      }
      this.growArena(Math.max(this.config.growthIncrement, alignedSize));
    }

    const offset = this.currentOffset;
    this.currentOffset += alignedSize;

    // Create allocation record (doesn't create new buffer, just tracks offset)
    const allocation: Allocation = {
      allocation_id: `arena_alloc_${this.allocationCounter++}`,
      buffer: this.arena!,
      offset,
      size: alignedSize,
      pool_id: "arena",
      usage: 0,
      memoryType: "device_local",
      created_at: Date.now(),
      last_access: Date.now(),
      mapped: false,
    };

    if (this.config.enableTracking) {
      this.allocations.set(allocation.allocation_id, allocation);
    }

    return allocation;
  }

  /**
   * Allocate arena buffer
   */
  private allocateArena(): void {
    this.arena = this.device.createBuffer({
      size: this.arenaSize,
    });
    this.currentOffset = 0;
  }

  /**
   * Grow arena by specified amount
   */
  private growArena(amount: number): void {
    const oldArena = this.arena;
    const oldSize = this.arenaSize;

    this.arenaSize += amount;
    this.allocateArena();

    // Copy old data if tracking enabled
    if (oldArena && this.config.enableTracking) {
      // Note: In real implementation, would copy data via command encoder
      oldArena.destroy();
    }
  }

  /**
   * Reset arena (free all allocations at once)
   */
  reset(): void {
    this.currentOffset = 0;
    this.allocations.clear();
  }

  /**
   * Get current utilization
   */
  getUtilization(): number {
    return this.currentOffset / this.arenaSize;
  }

  /**
   * Get arena size
   */
  getSize(): number {
    return this.arenaSize;
  }

  /**
   * Destroy allocator
   */
  destroy(): void {
    if (this.arena) {
      this.arena.destroy();
      this.arena = null;
    }
    this.allocations.clear();
    this.active = false;
  }

  private alignUp(size: number, alignment: number): number {
    return Math.ceil(size / alignment) * alignment;
  }
}

/**
 * Stack Allocator - LIFO allocation
 *
 * Allocations can be freed individually, but only in LIFO order.
 * Markers can be used to free multiple allocations at once.
 */
export class StackAllocator {
  private device: GPUDevice;
  private config: AllocatorConfig;
  private stack: GPUBuffer | null = null;
  private stackSize: number;
  private currentOffset: number = 0;
  private markers: Map<string, number> = new Map();
  private markerCounter: number = 0;
  private allocations: Allocation[] = [];

  constructor(device: GPUDevice, config: Partial<AllocatorConfig> = {}) {
    this.device = device;
    this.config = { ...DEFAULT_ALLOCATOR_CONFIG, ...config };
    this.stackSize = this.config.initialSize;
    this.allocateStack();
  }

  /**
   * Push allocation onto stack
   */
  push(size: number): Allocation {
    const alignedSize = this.alignUp(size, this.config.alignment);

    if (this.currentOffset + alignedSize > this.stackSize) {
      this.growStack(Math.max(this.config.growthIncrement, alignedSize));
    }

    const offset = this.currentOffset;
    this.currentOffset += alignedSize;

    const allocation: Allocation = {
      allocation_id: `stack_alloc_${this.allocations.length}`,
      buffer: this.stack!,
      offset,
      size: alignedSize,
      pool_id: "stack",
      usage: 0,
      memoryType: "device_local",
      created_at: Date.now(),
      last_access: Date.now(),
      mapped: false,
    };

    this.allocations.push(allocation);
    return allocation;
  }

  /**
   * Pop allocation from stack
   */
  pop(allocation?: Allocation): void {
    if (this.allocations.length === 0) {
      throw new Error("Cannot pop from empty stack");
    }

    if (allocation) {
      const top = this.allocations[this.allocations.length - 1];
      if (top.allocation_id !== allocation.allocation_id) {
        throw new Error("Can only pop top of stack (LIFO order)");
      }
    }

    const popped = this.allocations.pop()!;
    this.currentOffset = popped.offset;
  }

  /**
   * Create marker for bulk deallocation
   */
  createMarker(): string {
    const markerId = `marker_${this.markerCounter++}`;
    this.markers.set(markerId, this.currentOffset);
    return markerId;
  }

  /**
   * Free to marker
   */
  freeToMarker(markerId: string): void {
    const offset = this.markers.get(markerId);
    if (offset === undefined) {
      throw new Error(`Marker not found: ${markerId}`);
    }

    this.currentOffset = offset;

    // Remove allocations above marker
    while (
      this.allocations.length > 0 &&
      this.allocations[this.allocations.length - 1].offset >= offset
    ) {
      this.allocations.pop();
    }

    this.markers.delete(markerId);
  }

  /**
   * Get current stack position
   */
  getTop(): number {
    return this.currentOffset;
  }

  /**
   * Allocate stack buffer
   */
  private allocateStack(): void {
    this.stack = this.device.createBuffer({
      size: this.stackSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
    this.currentOffset = 0;
  }

  /**
   * Grow stack
   */
  private growStack(amount: number): void {
    const oldStack = this.stack;
    this.stackSize += amount;
    this.allocateStack();
    if (oldStack) {
      oldStack.destroy();
    }
  }

  /**
   * Destroy allocator
   */
  destroy(): void {
    if (this.stack) {
      this.stack.destroy();
      this.stack = null;
    }
    this.allocations = [];
    this.markers.clear();
  }

  private alignUp(size: number, alignment: number): number {
    return Math.ceil(size / alignment) * alignment;
  }
}

/**
 * Pool Allocator - Fixed-size block allocation
 *
 * Pre-allocates fixed-size blocks for fast allocation/deallocation.
 * Best for objects of known size.
 */
export class PoolAllocator {
  private device: GPUDevice;
  private blockSize: number;
  private maxBlocks: number;
  private blocks: GPUBuffer[] = [];
  private freeList: Set<number> = new Set();

  constructor(device: GPUDevice, blockSize: number, maxBlocks: number = 1024) {
    this.device = device;
    this.blockSize = blockSize;
    this.maxBlocks = maxBlocks;

    // Pre-allocate blocks
    for (let i = 0; i < maxBlocks; i++) {
      this.freeList.add(i);
    }
  }

  /**
   * Allocate block
   */
  allocate(): { buffer: GPUBuffer; index: number } {
    if (this.freeList.size === 0) {
      throw new Error("Pool exhausted: no free blocks");
    }

    // Get first free index
    const index = this.freeList.values().next().value;
    this.freeList.delete(index);

    // Create buffer if not exists
    if (!this.blocks[index]) {
      this.blocks[index] = this.device.createBuffer({
        size: this.blockSize,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST |
          GPUBufferUsage.COPY_SRC,
      });
    }

    return { buffer: this.blocks[index], index };
  }

  /**
   * Free block back to pool
   */
  free(index: number): void {
    if (index < 0 || index >= this.maxBlocks) {
      throw new Error(`Invalid block index: ${index}`);
    }

    this.freeList.add(index);
  }

  /**
   * Get free block count
   */
  getFreeCount(): number {
    return this.freeList.size;
  }

  /**
   * Get utilization ratio
   */
  getUtilization(): number {
    return 1 - this.freeList.size / this.maxBlocks;
  }

  /**
   * Destroy allocator
   */
  destroy(): void {
    for (const buffer of this.blocks) {
      if (buffer) buffer.destroy();
    }
    this.blocks = [];
    this.freeList.clear();
  }
}

/**
 * Free List Allocator - General purpose allocator
 *
 * Tracks free blocks in a linked list for efficient reuse.
 * Supports variable allocation sizes.
 */
export class FreeListAllocator {
  private device: GPUDevice;
  private config: AllocatorConfig;
  private freeList: FreeBlock[] = [];
  private allocations: Map<string, Allocation> = new Map();
  private totalSize: number;
  private allocationCounter: number = 0;

  constructor(device: GPUDevice, config: Partial<AllocatorConfig> = {}) {
    this.device = device;
    this.config = { ...DEFAULT_ALLOCATOR_CONFIG, ...config };
    this.totalSize = this.config.initialSize;

    // Initialize with one free block
    this.freeList.push({
      offset: 0,
      size: this.totalSize,
      available: true,
    });
  }

  /**
   * Allocate using free list
   */
  allocate(size: number): Allocation {
    const alignedSize = this.alignUp(size, this.config.alignment);

    // Find suitable block (first-fit)
    const blockIndex = this.findFreeBlock(alignedSize);

    if (blockIndex === -1) {
      // Try to grow
      this.grow(Math.max(this.config.growthIncrement, alignedSize));
      return this.allocate(size);
    }

    const block = this.freeList[blockIndex];

    // Create buffer
    const buffer = this.device.createBuffer({
      size: alignedSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });

    const allocation: Allocation = {
      allocation_id: `freelist_alloc_${this.allocationCounter++}`,
      buffer,
      offset: block.offset,
      size: alignedSize,
      pool_id: "freelist",
      usage: 0,
      memoryType: "device_local",
      created_at: Date.now(),
      last_access: Date.now(),
      mapped: false,
    };

    this.allocations.set(allocation.allocation_id, allocation);

    // Update or remove free block
    if (block.size > alignedSize) {
      block.offset += alignedSize;
      block.size -= alignedSize;
    } else {
      this.freeList.splice(blockIndex, 1);
    }

    return allocation;
  }

  /**
   * Free allocation
   */
  free(allocationId: string): void {
    const allocation = this.allocations.get(allocationId);
    if (!allocation) {
      throw new Error(`Allocation not found: ${allocationId}`);
    }

    // Add to free list
    this.freeList.push({
      offset: allocation.offset,
      size: allocation.size,
      available: true,
    });

    // Coalesce adjacent blocks
    this.coalesce();

    // Destroy buffer
    allocation.buffer.destroy();

    this.allocations.delete(allocationId);
  }

  /**
   * Find free block (first-fit)
   */
  private findFreeBlock(size: number): number {
    for (let i = 0; i < this.freeList.length; i++) {
      if (this.freeList[i].size >= size && this.freeList[i].available) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Coalesce adjacent free blocks
   */
  private coalesce(): void {
    if (this.freeList.length < 2) return;

    // Sort by offset
    this.freeList.sort((a, b) => a.offset - b.offset);

    const coalesced: FreeBlock[] = [];
    let current = this.freeList[0];

    for (let i = 1; i < this.freeList.length; i++) {
      const next = this.freeList[i];

      if (
        current.offset + current.size === next.offset &&
        current.available &&
        next.available
      ) {
        // Merge
        current.size += next.size;
      } else {
        coalesced.push(current);
        current = next;
      }
    }

    coalesced.push(current);
    this.freeList = coalesced;
  }

  /**
   * Grow allocator
   */
  private grow(amount: number): void {
    const offset = this.totalSize;
    this.totalSize += amount;

    this.freeList.push({
      offset,
      size: amount,
      available: true,
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    const usedBytes = Array.from(this.allocations.values()).reduce(
      (sum, a) => sum + a.size,
      0
    );
    const freeBytes = this.freeList.reduce((sum, b) => sum + b.size, 0);

    return {
      totalSize: this.totalSize,
      usedBytes,
      freeBytes,
      utilization: this.totalSize > 0 ? usedBytes / this.totalSize : 0,
      allocationCount: this.allocations.size,
      freeBlockCount: this.freeList.length,
    };
  }

  /**
   * Destroy allocator
   */
  destroy(): void {
    for (const alloc of this.allocations.values()) {
      alloc.buffer.destroy();
    }
    this.allocations.clear();
    this.freeList = [];
  }

  private alignUp(size: number, alignment: number): number {
    return Math.ceil(size / alignment) * alignment;
  }
}

/**
 * Free block for free list allocator
 */
interface FreeBlock {
  offset: number;
  size: number;
  available: boolean;
}

/**
 * Allocator type enum
 */
export enum AllocatorType {
  Arena = "arena",
  Stack = "stack",
  Pool = "pool",
  FreeList = "free_list",
}

/**
 * Allocator factory
 */
export class AllocatorFactory {
  static create(
    type: AllocatorType,
    device: GPUDevice,
    config?: Partial<AllocatorConfig>
  ): ArenaAllocator | StackAllocator | PoolAllocator | FreeListAllocator {
    switch (type) {
      case AllocatorType.Arena:
        return new ArenaAllocator(device, config);
      case AllocatorType.Stack:
        return new StackAllocator(device, config);
      case AllocatorType.Pool:
        return new PoolAllocator(
          device,
          config?.initialSize || 4096,
          config?.maxSize
            ? config.maxSize / (config?.initialSize || 4096)
            : 1024
        ) as unknown as PoolAllocator;
      case AllocatorType.FreeList:
        return new FreeListAllocator(device, config);
      default:
        throw new Error(`Unknown allocator type: ${type}`);
    }
  }
}
