/**
 * MemoryProfiler - GPU memory allocation tracking and leak detection
 *
 * Tracks buffer/texture allocations, detects memory leaks, and analyzes fragmentation
 */

import type {
  MemoryAllocation,
  PerformanceMetric,
  ResourceSnapshot,
} from "../types.js";

/**
 * Memory pool information
 */
interface MemoryPool {
  /** Pool identifier */
  id: string;
  /** Pool size in bytes */
  size: number;
  /** Allocated bytes */
  allocated: number;
  /** Allocations in pool */
  allocations: Set<string>;
}

/**
 * Fragmentation analysis result
 */
interface FragmentationAnalysis {
  /** Total free space */
  totalFree: number;
  /** Largest contiguous free block */
  largestFreeBlock: number;
  /** Fragmentation ratio (0-1, higher = more fragmented) */
  fragmentationRatio: number;
  /** Fragmented block count */
  fragmentedBlocks: number;
}

/**
 * Memory leak detection result
 */
interface MemoryLeak {
  /** Allocation ID */
  allocationId: string;
  /** Allocation type */
  type: string;
  /** Size in bytes */
  size: number;
  /** Age in milliseconds */
  age: number;
  /** Usage flags */
  usage: string[];
  /** Likely cause */
  likelyCause: string;
}

/**
 * MemoryProfiler - Tracks GPU memory allocations and detects issues
 *
 * @example
 * ```typescript
 * const memoryProfiler = new MemoryProfiler();
 *
 * const bufferId = memoryProfiler.recordAllocation(1024 * 1024, 'buffer', ['STORAGE', 'COPY_DST']);
 * // ... use buffer ...
 * memoryProfiler.recordDeallocation(bufferId);
 *
 * const leaks = memoryProfiler.detectLeaks();
 * const snapshot = memoryProfiler.getSnapshot();
 * ```
 */
export class MemoryProfiler {
  /** All recorded allocations */
  private allocations: Map<string, MemoryAllocation> = new Map();
  /** Memory pools */
  private pools: Map<string, MemoryPool> = new Map();
  /** Snapshot history */
  private snapshots: ResourceSnapshot[] = [];
  /** Allocation counter */
  private allocationCounter = 0;

  /**
   * Record a memory allocation
   *
   * @param size - Size in bytes
   * @param type - Resource type
   * @param usage - Usage flags
   * @param poolId - Optional pool identifier
   * @returns Allocation ID
   */
  recordAllocation(
    size: number,
    type: "buffer" | "texture" | "sampler" | "bind-group" | "pipeline",
    usage: string[] = [],
    poolId?: string
  ): string {
    const id = `alloc-${this.allocationCounter++}`;
    const timestamp = performance.now();

    const allocation: MemoryAllocation = {
      id,
      type,
      size,
      usage,
      timestamp,
      freed: false,
      poolId,
    };

    this.allocations.set(id, allocation);

    // Add to pool if specified
    if (poolId) {
      let pool = this.pools.get(poolId);
      if (!pool) {
        pool = {
          id: poolId,
          size: 0,
          allocated: 0,
          allocations: new Set(),
        };
        this.pools.set(poolId, pool);
      }
      pool.size = Math.max(pool.size, pool.allocated + size);
      pool.allocated += size;
      pool.allocations.add(id);
    }

    return id;
  }

  /**
   * Record a memory deallocation
   *
   * @param id - Allocation ID
   */
  recordDeallocation(id: string): void {
    const allocation = this.allocations.get(id);
    if (!allocation || allocation.freed) {
      return;
    }

    const freeTimestamp = performance.now();
    allocation.freed = true;
    allocation.freeTimestamp = freeTimestamp;
    allocation.lifetime = freeTimestamp - allocation.timestamp;

    // Update pool
    if (allocation.poolId) {
      const pool = this.pools.get(allocation.poolId);
      if (pool) {
        pool.allocated -= allocation.size;
        pool.allocations.delete(id);
      }
    }
  }

  /**
   * Get current memory usage
   *
   * @returns Current memory statistics
   */
  getCurrentUsage(): {
    totalAllocated: number;
    activeAllocations: number;
    freedAllocations: number;
    peakMemory: number;
    bufferMemory: number;
    textureMemory: number;
  } {
    let activeAllocations = 0;
    let freedAllocations = 0;
    let totalAllocated = 0;
    let bufferMemory = 0;
    let textureMemory = 0;

    for (const allocation of this.allocations.values()) {
      if (allocation.freed) {
        freedAllocations++;
      } else {
        activeAllocations++;
        totalAllocated += allocation.size;

        if (allocation.type === "buffer") {
          bufferMemory += allocation.size;
        } else if (allocation.type === "texture") {
          textureMemory += allocation.size;
        }
      }
    }

    return {
      totalAllocated,
      activeAllocations,
      freedAllocations,
      peakMemory: totalAllocated, // Simplified
      bufferMemory,
      textureMemory,
    };
  }

  /**
   * Detect potential memory leaks
   *
   * @param ageThreshold - Minimum age in milliseconds to consider as leak
   * @param maxAge - Maximum expected allocation age
   * @returns Detected memory leaks
   */
  detectLeaks(ageThreshold = 10000, maxAge = 60000): MemoryLeak[] {
    const now = performance.now();
    const leaks: MemoryLeak[] = [];

    for (const allocation of this.allocations.values()) {
      if (allocation.freed) {
        continue;
      }

      const age = now - allocation.timestamp;

      // Check for old allocations
      if (age > ageThreshold) {
        leaks.push({
          allocationId: allocation.id,
          type: allocation.type,
          size: allocation.size,
          age,
          usage: allocation.usage,
          likelyCause: this.determineLeakCause(allocation, age),
        });
      }
    }

    // Sort by size (largest first)
    leaks.sort((a, b) => b.size - a.size);

    return leaks;
  }

  /**
   * Determine likely cause of a memory leak
   */
  private determineLeakCause(
    allocation: MemoryAllocation,
    age: number
  ): string {
    if (age > 300000) {
      return "Long-lived allocation - possible forgotten deallocation";
    }

    if (allocation.usage.includes("STORAGE")) {
      return "Storage buffer - possible retained computation result";
    }

    if (allocation.type === "texture") {
      return "Texture - possible mipmaps or render targets not released";
    }

    return "Possible reference leak or missing cleanup";
  }

  /**
   * Analyze memory fragmentation
   *
   * @returns Fragmentation analysis
   */
  analyzeFragmentation(): FragmentationAnalysis {
    const activeAllocations = Array.from(this.allocations.values()).filter(
      a => !a.freed
    );

    if (activeAllocations.length === 0) {
      return {
        totalFree: 0,
        largestFreeBlock: 0,
        fragmentationRatio: 0,
        fragmentedBlocks: 0,
      };
    }

    // Simplified fragmentation analysis
    // In reality, this would need actual memory layout information
    const sortedAllocations = activeAllocations.sort(
      (a, b) => a.timestamp - b.timestamp
    );

    let totalFree = 0;
    let largestFreeBlock = 0;
    let fragmentedBlocks = 0;

    // This is a simplified analysis
    // Real fragmentation analysis requires memory address tracking
    for (let i = 0; i < sortedAllocations.length - 1; i++) {
      const current = sortedAllocations[i];
      const next = sortedAllocations[i + 1];

      if (current.freed && !next.freed) {
        const gap = next.timestamp - current.timestamp;
        totalFree += gap;
        largestFreeBlock = Math.max(largestFreeBlock, gap);
        fragmentedBlocks++;
      }
    }

    const totalAllocated = activeAllocations.reduce(
      (sum, a) => sum + a.size,
      0
    );
    const fragmentationRatio =
      totalAllocated > 0 ? fragmentedBlocks / activeAllocations.length : 0;

    return {
      totalFree,
      largestFreeBlock,
      fragmentationRatio,
      fragmentedBlocks,
    };
  }

  /**
   * Take a snapshot of current memory state
   *
   * @returns Snapshot data
   */
  takeSnapshot(): ResourceSnapshot {
    const usage = this.getCurrentUsage();
    const snapshot: ResourceSnapshot = {
      timestamp: performance.now(),
      bufferMemoryUsed: usage.bufferMemory,
      textureMemoryUsed: usage.textureMemory,
      totalMemoryUsed: usage.totalAllocated,
      activePipelines: Array.from(this.allocations.values()).filter(
        a => a.type === "pipeline" && !a.freed
      ).length,
      activeBindGroups: Array.from(this.allocations.values()).filter(
        a => a.type === "bind-group" && !a.freed
      ).length,
      pendingCommands: 0, // Not tracked here
    };

    this.snapshots.push(snapshot);

    return snapshot;
  }

  /**
   * Get memory usage history
   *
   * @returns Array of historical snapshots
   */
  getHistory(): ResourceSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Get allocation details
   *
   * @param id - Allocation ID
   * @returns Allocation details or undefined
   */
  getAllocation(id: string): MemoryAllocation | undefined {
    return this.allocations.get(id);
  }

  /**
   * Get all active allocations
   *
   * @returns Array of active allocations
   */
  getActiveAllocations(): MemoryAllocation[] {
    return Array.from(this.allocations.values()).filter(a => !a.freed);
  }

  /**
   * Get allocations by type
   *
   * @param type - Allocation type
   * @returns Array of allocations of that type
   */
  getAllocationsByType(type: string): MemoryAllocation[] {
    return Array.from(this.allocations.values()).filter(a => a.type === type);
  }

  /**
   * Analyze allocation patterns
   *
   * @returns Pattern analysis results
   */
  analyzePatterns(): {
    averageAllocationSize: number;
    medianAllocationSize: number;
    mostCommonSize: number;
    allocationRate: number; // allocations per second
    deallocationRate: number;
    averageLifetime: number;
  } {
    const allocations = Array.from(this.allocations.values());

    if (allocations.length === 0) {
      return {
        averageAllocationSize: 0,
        medianAllocationSize: 0,
        mostCommonSize: 0,
        allocationRate: 0,
        deallocationRate: 0,
        averageLifetime: 0,
      };
    }

    const sizes = allocations.map(a => a.size);
    sizes.sort((a, b) => a - b);

    const totalSize = sizes.reduce((sum, s) => sum + s, 0);
    const averageAllocationSize = totalSize / sizes.length;
    const medianAllocationSize = sizes[Math.floor(sizes.length / 2)];

    // Find most common size (mode)
    const sizeCounts = new Map<number, number>();
    for (const size of sizes) {
      sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1);
    }
    let mostCommonSize = 0;
    let maxCount = 0;
    for (const [size, count] of sizeCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonSize = size;
      }
    }

    // Calculate rates
    const now = performance.now();
    const firstAllocation = Math.min(...allocations.map(a => a.timestamp));
    const durationSeconds = (now - firstAllocation) / 1000;

    const allocationRate =
      durationSeconds > 0 ? allocations.length / durationSeconds : 0;
    const deallocationRate =
      durationSeconds > 0
        ? allocations.filter(a => a.freed).length / durationSeconds
        : 0;

    // Calculate average lifetime
    const freedAllocations = allocations.filter(a => a.freed && a.lifetime);
    const averageLifetime =
      freedAllocations.length > 0
        ? freedAllocations.reduce((sum, a) => sum + (a.lifetime ?? 0), 0) /
          freedAllocations.length
        : 0;

    return {
      averageAllocationSize,
      medianAllocationSize,
      mostCommonSize,
      allocationRate,
      deallocationRate,
      averageLifetime,
    };
  }

  /**
   * Get performance metrics
   *
   * @returns Array of performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    const usage = this.getCurrentUsage();
    const patterns = this.analyzePatterns();

    return [
      {
        name: "memory-total-allocated",
        type: "memory",
        value: usage.totalAllocated,
        unit: "bytes",
        min: 0,
        max: usage.peakMemory,
        avg: usage.totalAllocated,
        sampleCount: 1,
        firstSample: performance.now(),
        lastSample: performance.now(),
      },
      {
        name: "memory-active-allocations",
        type: "memory",
        value: usage.activeAllocations,
        unit: "ops",
        min: 0,
        max: usage.activeAllocations,
        avg: usage.activeAllocations,
        sampleCount: 1,
        firstSample: performance.now(),
        lastSample: performance.now(),
      },
      {
        name: "memory-buffer-used",
        type: "memory",
        value: usage.bufferMemory,
        unit: "bytes",
        min: 0,
        max: usage.bufferMemory,
        avg: usage.bufferMemory,
        sampleCount: 1,
        firstSample: performance.now(),
        lastSample: performance.now(),
      },
      {
        name: "memory-texture-used",
        type: "memory",
        value: usage.textureMemory,
        unit: "bytes",
        min: 0,
        max: usage.textureMemory,
        avg: usage.textureMemory,
        sampleCount: 1,
        firstSample: performance.now(),
        lastSample: performance.now(),
      },
      {
        name: "memory-allocation-rate",
        type: "throughput",
        value: patterns.allocationRate,
        unit: "ops/s",
        min: 0,
        max: patterns.allocationRate,
        avg: patterns.allocationRate,
        sampleCount: 1,
        firstSample: performance.now(),
        lastSample: performance.now(),
      },
      {
        name: "memory-average-lifetime",
        type: "timing",
        value: patterns.averageLifetime,
        unit: "ms",
        min: 0,
        max: patterns.averageLifetime,
        avg: patterns.averageLifetime,
        sampleCount: 1,
        firstSample: performance.now(),
        lastSample: performance.now(),
      },
    ];
  }

  /**
   * Clear all recorded data
   */
  clear(): void {
    this.allocations.clear();
    this.pools.clear();
    this.snapshots = [];
    this.allocationCounter = 0;
  }

  /**
   * Get total allocation count
   */
  getCount(): number {
    return this.allocations.size;
  }
}
