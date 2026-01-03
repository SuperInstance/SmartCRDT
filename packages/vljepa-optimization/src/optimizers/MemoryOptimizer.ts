/**
 * Memory Optimizer
 * Optimizes memory usage through in-place operations, tensor fusion,
 * layout transformation, and buffer pooling
 */

import type {
  MemoryOptimizerConfig,
  MemoryOptimizationResult,
  Optimization,
  AllocationStrategy,
  BufferPoolSpec,
  ReusePolicy,
} from "../types.js";

export class MemoryOptimizer {
  private config: MemoryOptimizerConfig;
  private allocations: Map<string, AllocationInfo> = new Map();
  private pools: Map<number, BufferPool> = new Map();
  private optimizations: Optimization[] = [];

  constructor(config: Partial<MemoryOptimizerConfig> = {}) {
    this.config = {
      inPlaceOps: true,
      tensorFusion: true,
      bufferPooling: true,
      targetMemory: 100, // 100 MB target
      aggressiveCleanup: false,
      ...config,
    };
  }

  /**
   * Optimize memory allocation for a set of tensors
   */
  optimize(tensors: TensorInfo[]): MemoryOptimizationResult {
    const originalMemory = this.calculateTotalMemory(tensors);
    this.optimizations = [];

    let optimizedTensors = [...tensors];

    // Step 1: In-place operations
    if (this.config.inPlaceOps) {
      optimizedTensors = this.applyInPlaceOps(optimizedTensors);
    }

    // Step 2: Tensor fusion
    if (this.config.tensorFusion) {
      optimizedTensors = this.applyTensorFusion(optimizedTensors);
    }

    // Step 3: Buffer pooling
    if (this.config.bufferPooling) {
      optimizedTensors = this.applyBufferPooling(optimizedTensors);
    }

    const optimizedMemory = this.calculateTotalMemory(optimizedTensors);
    const reduction =
      ((originalMemory - optimizedMemory) / originalMemory) * 100;

    return {
      originalMemory,
      optimizedMemory,
      reduction,
      optimizations: this.optimizations,
      allocationStrategy: this.createAllocationStrategy(optimizedTensors),
    };
  }

  /**
   * Allocate memory for a tensor
   */
  allocate(size: number, usage: TensorUsage): string {
    const id = `alloc_${this.allocations.size}`;
    const poolSize = this.getPoolSize(size);
    let pool = this.pools.get(poolSize);

    if (!pool) {
      pool = new BufferPool(poolSize, this.config.targetMemory);
      this.pools.set(poolSize, pool);
    }

    const buffer = pool.acquire();

    this.allocations.set(id, {
      size,
      usage,
      buffer,
      poolSize,
      inPlace: false,
      timestamp: Date.now(),
    });

    return id;
  }

  /**
   * Deallocate memory
   */
  deallocate(id: string): void {
    const alloc = this.allocations.get(id);
    if (!alloc) return;

    const pool = this.pools.get(alloc.poolSize);
    if (pool) {
      pool.release(alloc.buffer);
    }

    this.allocations.delete(id);
  }

  /**
   * Find tensors that can share memory
   */
  findSharableTensors(tensors: TensorInfo[]): TensorPair[] {
    const sharable: TensorPair[] = [];
    const lifetimeInfo = this.analyzeLifetimes(tensors);

    for (let i = 0; i < tensors.length; i++) {
      for (let j = i + 1; j < tensors.length; j++) {
        const t1 = tensors[i];
        const t2 = tensors[j];

        if (this.canShareMemory(t1, t2, lifetimeInfo)) {
          sharable.push({ tensor1: t1, tensor2: t2, savings: t1.size });
        }
      }
    }

    return sharable.sort((a, b) => b.savings - a.savings);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): MemoryStats {
    let totalAllocated = 0;
    let totalUsed = 0;
    let fragmentation = 0;

    for (const pool of this.pools.values()) {
      const stats = pool.getStats();
      totalAllocated += stats.totalSize;
      totalUsed += stats.usedSize;
      fragmentation += stats.fragmentation;
    }

    return {
      totalAllocated,
      totalUsed,
      fragmentation: fragmentation / this.pools.size || 0,
      poolCount: this.pools.size,
      allocationCount: this.allocations.size,
    };
  }

  // ============================================================================
  // OPTIMIZATION: IN-PLACE OPERATIONS
  // ============================================================================

  private applyInPlaceOps(tensors: TensorInfo[]): TensorInfo[] {
    const optimized = [...tensors];

    // Find candidates for in-place operations
    for (let i = 0; i < optimized.length; i++) {
      const tensor = optimized[i];

      if (this.isInPlaceCandidate(tensor)) {
        const reuseTarget = this.findReuseTarget(tensor, optimized, i);
        if (reuseTarget) {
          tensor.reuseId = reuseTarget.id;
          tensor.inPlace = true;

          this.optimizations.push({
            type: "in_place_operation",
            description: `In-place operation for ${tensor.name}`,
            impact: tensor.size / 1024 / 1024, // MB
            confidence: 0.9,
          });
        }
      }
    }

    return optimized;
  }

  private isInPlaceCandidate(tensor: TensorInfo): boolean {
    // Operations that can be done in-place
    const inPlaceOps = ["relu", "gelu", "add", "mul", "layer_norm"];

    return (
      tensor.usage.type === "activation" ||
      tensor.usage.type === "gradient" ||
      inPlaceOps.includes(tensor.usage.operation || "")
    );
  }

  private findReuseTarget(
    tensor: TensorInfo,
    tensors: TensorInfo[],
    currentIndex: number
  ): TensorInfo | null {
    // Find a tensor that's no longer needed and has the same size
    for (let i = 0; i < currentIndex; i++) {
      const candidate = tensors[i];
      if (
        candidate.size === tensor.size &&
        this.isTensorDead(candidate, tensor.usage.timestamp)
      ) {
        return candidate;
      }
    }
    return null;
  }

  private isTensorDead(tensor: TensorInfo, currentTime: number): boolean {
    const lifetime = tensor.usage.lifetimeEnd || Infinity;
    return currentTime >= lifetime;
  }

  // ============================================================================
  // OPTIMIZATION: TENSOR FUSION
  // ============================================================================

  private applyTensorFusion(tensors: TensorInfo[]): TensorInfo[] {
    const groups = this.findFusionGroups(tensors);

    for (const group of groups) {
      if (group.length > 1) {
        const fusedSize = Math.max(...group.map(t => t.size));
        const totalSize = group.reduce((sum, t) => sum + t.size, 0);
        const savings = totalSize - fusedSize;

        this.optimizations.push({
          type: "tensor_fusion",
          description: `Fused ${group.length} tensors into one buffer`,
          impact: savings / 1024 / 1024,
          confidence: 0.85,
        });

        // Mark tensors as fused
        for (const tensor of group) {
          tensor.fused = true;
          tensor.fusionGroup = group[0].id;
        }
      }
    }

    return tensors;
  }

  private findFusionGroups(tensors: TensorInfo[]): TensorInfo[][] {
    const groups: TensorInfo[][] = [];
    const visited = new Set<string>();

    for (const tensor of tensors) {
      if (visited.has(tensor.id)) continue;

      const group = this.buildFusionGroup(tensor, tensors, visited);
      if (group.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  private buildFusionGroup(
    start: TensorInfo,
    tensors: TensorInfo[],
    visited: Set<string>
  ): TensorInfo[] {
    const group: TensorInfo[] = [start];
    visited.add(start.id);

    // Find tensors with compatible shapes and lifetimes
    for (const tensor of tensors) {
      if (visited.has(tensor.id)) continue;

      if (this.canFuse(start, tensor)) {
        group.push(tensor);
        visited.add(tensor.id);
      }
    }

    return group;
  }

  private canFuse(tensor1: TensorInfo, tensor2: TensorInfo): boolean {
    // Can fuse if same size and non-overlapping lifetimes
    if (tensor1.size !== tensor2.size) return false;

    const lifetime1 = tensor1.usage.lifetimeEnd || 0;
    const lifetime2 = tensor2.usage.lifetimeEnd || 0;
    const start1 = tensor1.usage.timestamp;
    const start2 = tensor2.usage.timestamp;

    // Non-overlapping lifetimes
    return lifetime1 < start2 || lifetime2 < start1;
  }

  // ============================================================================
  // OPTIMIZATION: BUFFER POOLING
  // ============================================================================

  private applyBufferPooling(tensors: TensorInfo[]): TensorInfo[] {
    const sizeGroups = new Map<number, TensorInfo[]>();

    // Group tensors by size
    for (const tensor of tensors) {
      const roundedSize = this.roundToPoolSize(tensor.size);
      if (!sizeGroups.has(roundedSize)) {
        sizeGroups.set(roundedSize, []);
      }
      sizeGroups.get(roundedSize)!.push(tensor);
    }

    // Create buffer pools for each size group
    for (const [size, group] of sizeGroups) {
      if (group.length > 2) {
        const pool = new BufferPool(size, group.length);
        this.pools.set(size, pool);

        this.optimizations.push({
          type: "buffer_pooling",
          description: `Created buffer pool for ${group.length} tensors of size ${size}B`,
          impact: ((group.length * size) / 1024 / 1024) * 0.3,
          confidence: 0.95,
        });
      }
    }

    return tensors;
  }

  private getPoolSize(requestedSize: number): number {
    // Round up to power of 2 for pool sizes
    return Math.pow(2, Math.ceil(Math.log2(requestedSize)));
  }

  private roundToPoolSize(size: number): number {
    const poolSizes = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536];
    for (const poolSize of poolSizes) {
      if (size <= poolSize) return poolSize;
    }
    return Math.pow(2, Math.ceil(Math.log2(size)));
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private calculateTotalMemory(tensors: TensorInfo[]): number {
    return tensors.reduce((sum, t) => {
      if (t.fused) return sum; // Don't count fused tensors
      return sum + t.size;
    }, 0);
  }

  private analyzeLifetimes(tensors: TensorInfo[]): Map<string, LifetimeInfo> {
    const lifetimes = new Map<string, LifetimeInfo>();

    for (const tensor of tensors) {
      lifetimes.set(tensor.id, {
        start: tensor.usage.timestamp,
        end: tensor.usage.lifetimeEnd || Infinity,
        size: tensor.size,
      });
    }

    return lifetimes;
  }

  private canShareMemory(
    t1: TensorInfo,
    t2: TensorInfo,
    lifetimes: Map<string, LifetimeInfo>
  ): boolean {
    if (t1.size !== t2.size) return false;

    const l1 = lifetimes.get(t1.id);
    const l2 = lifetimes.get(t2.id);

    if (!l1 || !l2) return false;

    // Non-overlapping lifetimes
    return l1.end < l2.start || l2.end < l1.start;
  }

  private createAllocationStrategy(tensors: TensorInfo[]): AllocationStrategy {
    const pools: BufferPoolSpec[] = [];
    const poolSizes = new Set(tensors.map(t => this.roundToPoolSize(t.size)));

    for (const size of poolSizes) {
      const count = tensors.filter(
        t => this.roundToPoolSize(t.size) === size
      ).length;
      pools.push({
        size,
        count: Math.max(2, Math.min(count, 8)),
        growStrategy: count > 4 ? "linear" : "on_demand",
      });
    }

    return {
      type: "dynamic",
      pools,
      reusePolicy: "lru",
    };
  }

  /**
   * Clear all allocations and reset pools
   */
  reset(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
    this.allocations.clear();
    this.pools.clear();
    this.optimizations = [];
  }
}

// ============================================================================
// BUFFER POOL IMPLEMENTATION
// ============================================================================

class BufferPool {
  private buffers: GPUBuffer[] = [];
  private acquired: Set<GPUBuffer> = new Set();
  private totalAllocations = 0;
  private totalReleases = 0;
  private peakUsage = 0;

  constructor(
    private bufferSize: number,
    private initialCount: number
  ) {
    this.preAllocate(initialCount);
  }

  acquire(): GPUBuffer {
    if (this.buffers.length > 0) {
      const buffer = this.buffers.pop()!;
      this.acquired.add(buffer);
      this.updatePeakUsage();
      return buffer;
    }

    // Grow pool if empty
    const newBuffer = this.allocateBuffer();
    this.acquired.add(newBuffer);
    this.totalAllocations++;
    this.updatePeakUsage();
    return newBuffer;
  }

  release(buffer: GPUBuffer): void {
    if (!this.acquired.has(buffer)) return;

    this.acquired.delete(buffer);
    this.buffers.push(buffer);
    this.totalReleases++;
  }

  getStats(): BufferPoolStats {
    const totalSize =
      (this.buffers.length + this.acquired.size) * this.bufferSize;
    const usedSize = this.acquired.size * this.bufferSize;

    return {
      totalSize,
      usedSize,
      availableBuffers: this.buffers.length,
      acquiredBuffers: this.acquired.size,
      totalAllocations: this.totalAllocations,
      totalReleases: this.totalReleases,
      hitRate: this.totalReleases / Math.max(1, this.totalAllocations),
      peakUsage: this.peakUsage * this.bufferSize,
      fragmentation: 0, // Pool has no fragmentation
    };
  }

  clear(): void {
    this.buffers = [];
    this.acquired.clear();
    this.totalAllocations = 0;
    this.totalReleases = 0;
    this.peakUsage = 0;
  }

  private preAllocate(count: number): void {
    for (let i = 0; i < count; i++) {
      this.buffers.push(this.allocateBuffer());
    }
  }

  private allocateBuffer(): GPUBuffer {
    // Placeholder - actual implementation would use WebGPU
    return {} as GPUBuffer;
  }

  private updatePeakUsage(): void {
    const currentUsage = this.acquired.size;
    if (currentUsage > this.peakUsage) {
      this.peakUsage = currentUsage;
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface TensorInfo {
  id: string;
  name: string;
  size: number;
  shape: number[];
  dtype: string;
  usage: TensorUsage;
  inPlace?: boolean;
  fused?: boolean;
  fusionGroup?: string;
  reuseId?: string;
}

export interface TensorUsage {
  type: "weight" | "activation" | "gradient" | "temporary" | "output";
  operation?: string;
  timestamp: number;
  lifetimeEnd?: number;
  readOnly?: boolean;
}

export interface AllocationInfo {
  size: number;
  usage: TensorUsage;
  buffer: GPUBuffer;
  poolSize: number;
  inPlace: boolean;
  timestamp: number;
}

export interface TensorPair {
  tensor1: TensorInfo;
  tensor2: TensorInfo;
  savings: number;
}

export interface LifetimeInfo {
  start: number;
  end: number;
  size: number;
}

export interface MemoryStats {
  totalAllocated: number;
  totalUsed: number;
  fragmentation: number;
  poolCount: number;
  allocationCount: number;
}

interface BufferPoolStats {
  totalSize: number;
  usedSize: number;
  availableBuffers: number;
  acquiredBuffers: number;
  totalAllocations: number;
  totalReleases: number;
  hitRate: number;
  peakUsage: number;
  fragmentation: number;
}
