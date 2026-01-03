/**
 * @lsi/webgpu-memory - Memory Profiler
 *
 * Track allocations, detect leaks, analyze usage patterns,
 * and generate memory reports.
 */

import type {
  Allocation,
  MemoryStats,
  ProfileData,
  LeakDetectionResult,
  AgeBreakdown,
  TimelineEntry,
  SizeHistogram,
  LifetimeHistogram,
  MemoryEvent,
  MemoryEventType,
} from "./types.js";

/**
 * Allocation record for profiling
 */
interface AllocationRecord {
  allocation: Allocation;
  deallocated: boolean;
  deallocationTime: number | null;
  stackTrace?: string;
}

/**
 * Memory profiler for tracking and analysis
 */
export class MemoryProfiler {
  private allocations: Map<string, AllocationRecord> = new Map();
  private events: MemoryEvent[] = [];
  private timeline: TimelineEntry[] = [];
  private startTime: number = Date.now();
  private peakMemory: number = 0;
  private totalAllocations: number = 0;
  private totalDeallocations: number = 0;
  private profilingEnabled: boolean = true;
  private snapshotInterval: number = 1000; // 1 second
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;

  constructor(autoSnapshot: boolean = false) {
    if (autoSnapshot) {
      this.startAutoSnapshot();
    }
  }

  /**
   * Record allocation
   */
  recordAllocation(allocation: Allocation): void {
    if (!this.profilingEnabled) return;

    const record: AllocationRecord = {
      allocation,
      deallocated: false,
      deallocationTime: null,
      stackTrace: this.captureStackTrace(),
    };

    this.allocations.set(allocation.allocation_id, record);
    this.totalAllocations++;

    this.addEvent({
      type: "allocate" as MemoryEventType.Allocate,
      timestamp: Date.now(),
      size: allocation.size,
      allocation,
    });

    this.updatePeakMemory();
  }

  /**
   * Record deallocation
   */
  recordDeallocation(allocationId: string): void {
    if (!this.profilingEnabled) return;

    const record = this.allocations.get(allocationId);
    if (record) {
      record.deallocated = true;
      record.deallocationTime = Date.now();
      this.totalDeallocations++;

      this.addEvent({
        type: "free" as MemoryEventType.Free,
        timestamp: Date.now(),
        size: record.allocation.size,
        allocation: record.allocation,
      });
    }
  }

  /**
   * Add memory event
   */
  addEvent(event: MemoryEvent): void {
    this.events.push(event);
  }

  /**
   * Start profiling
   */
  startProfiling(): void {
    this.profilingEnabled = true;
    this.startTime = Date.now();
  }

  /**
   * Stop profiling
   */
  stopProfiling(): void {
    this.profilingEnabled = false;
    this.stopAutoSnapshot();
  }

  /**
   * Get profiling report
   */
  getReport(): ProfileData {
    const now = Date.now();
    const duration = now - this.startTime;

    // Calculate statistics
    const activeAllocations = this.getActiveAllocations();
    const currentMemory = activeAllocations.reduce(
      (sum, r) => sum + r.allocation.size,
      0
    );

    const sizes = activeAllocations.map(r => r.allocation.size);
    const avgAllocationSize =
      sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;

    const sortedSizes = [...sizes].sort((a, b) => a - b);
    const medianAllocationSize =
      sortedSizes.length > 0
        ? sortedSizes[Math.floor(sortedSizes.length / 2)]
        : 0;

    const allocationRate =
      duration > 0 ? (this.totalAllocations / duration) * 1000 : 0;
    const deallocationRate =
      duration > 0 ? (this.totalDeallocations / duration) * 1000 : 0;

    const churnRate =
      duration > 0
        ? (activeAllocations.reduce((sum, r) => sum + r.allocation.size, 0) /
            duration) *
          1000
        : 0;

    return {
      totalAllocations: this.totalAllocations,
      totalDeallocations: this.totalDeallocations,
      peakMemory: this.peakMemory,
      avgAllocationSize,
      medianAllocationSize,
      allocationRate,
      deallocationRate,
      churnRate,
      timeline: [...this.timeline],
      sizeDistribution: this.getSizeDistribution(),
      lifetimeDistribution: this.getLifetimeDistribution(),
    };
  }

  /**
   * Detect memory leaks
   */
  detectLeaks(): LeakDetectionResult {
    const now = Date.now();
    const leaks: Allocation[] = [];

    for (const record of this.allocations.values()) {
      if (!record.deallocated) {
        leaks.push(record.allocation);
      }
    }

    const leakedBytes = leaks.reduce((sum, a) => sum + a.size, 0);

    // Age breakdown
    const ageBreakdown: AgeBreakdown = {
      recent: 0,
      short: 0,
      medium: 0,
      old: 0,
    };

    const oneMinute = 60 * 1000;
    const fiveMinutes = 5 * oneMinute;
    const thirtyMinutes = 30 * oneMinute;

    for (const leak of leaks) {
      const age = now - leak.created_at;

      if (age < oneMinute) ageBreakdown.recent++;
      else if (age < fiveMinutes) ageBreakdown.short++;
      else if (age < thirtyMinutes) ageBreakdown.medium++;
      else ageBreakdown.old++;
    }

    return {
      hasLeaks: leaks.length > 0,
      leakCount: leaks.length,
      leakedBytes,
      leaks,
      ageBreakdown,
    };
  }

  /**
   * Get active allocations
   */
  getActiveAllocations(): AllocationRecord[] {
    return Array.from(this.allocations.values()).filter(r => !r.deallocated);
  }

  /**
   * Get allocation by ID
   */
  getAllocation(id: string): AllocationRecord | undefined {
    return this.allocations.get(id);
  }

  /**
   * Get all events
   */
  getEvents(): MemoryEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: MemoryEventType): MemoryEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Get allocation size histogram
   */
  getSizeDistribution(): SizeHistogram {
    const histogram: SizeHistogram = {
      tiny: 0,
      small: 0,
      medium: 0,
      large: 0,
      huge: 0,
    };

    for (const record of this.allocations.values()) {
      const size = record.allocation.size;

      if (size < 1024) histogram.tiny++;
      else if (size < 64 * 1024) histogram.small++;
      else if (size < 1024 * 1024) histogram.medium++;
      else if (size < 16 * 1024 * 1024) histogram.large++;
      else histogram.huge++;
    }

    return histogram;
  }

  /**
   * Get allocation lifetime distribution
   */
  getLifetimeDistribution(): LifetimeHistogram {
    const now = Date.now();
    const histogram: LifetimeHistogram = {
      ephemeral: 0,
      brief: 0,
      medium: 0,
      long: 0,
      persistent: 0,
    };

    for (const record of this.allocations.values()) {
      const lifetime = record.deallocationTime
        ? record.deallocationTime - record.allocation.created_at
        : now - record.allocation.created_at;

      if (lifetime < 1000) histogram.ephemeral++;
      else if (lifetime < 10000) histogram.brief++;
      else if (lifetime < 60000) histogram.medium++;
      else if (lifetime < 600000) histogram.long++;
      else histogram.persistent++;
    }

    return histogram;
  }

  /**
   * Update peak memory
   */
  private updatePeakMemory(): void {
    const currentMemory = Array.from(this.allocations.values())
      .filter(r => !r.deallocated)
      .reduce((sum, r) => sum + r.allocation.size, 0);

    if (currentMemory > this.peakMemory) {
      this.peakMemory = currentMemory;
    }
  }

  /**
   * Create timeline snapshot
   */
  private createTimelineSnapshot(): TimelineEntry {
    const currentMemory = Array.from(this.allocations.values())
      .filter(r => !r.deallocated)
      .reduce((sum, r) => sum + r.allocation.size, 0);

    return {
      timestamp: Date.now(),
      memory: currentMemory,
      allocations: this.getActiveAllocations().length,
    };
  }

  /**
   * Start automatic snapshots
   */
  private startAutoSnapshot(): void {
    this.snapshotTimer = setInterval(() => {
      this.timeline.push(this.createTimelineSnapshot());

      // Limit timeline size
      if (this.timeline.length > 3600) {
        this.timeline = this.timeline.slice(-3600);
      }
    }, this.snapshotInterval);
  }

  /**
   * Stop automatic snapshots
   */
  private stopAutoSnapshot(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  /**
   * Capture stack trace for debugging
   */
  private captureStackTrace(): string {
    const stack = new Error().stack;
    return stack || "";
  }

  /**
   * Reset profiler
   */
  reset(): void {
    this.allocations.clear();
    this.events = [];
    this.timeline = [];
    this.startTime = Date.now();
    this.peakMemory = 0;
    this.totalAllocations = 0;
    this.totalDeallocations = 0;
  }

  /**
   * Generate summary report
   */
  generateSummary(): string {
    const report = this.getReport();
    const leaks = this.detectLeaks();

    const summary = `
Memory Profiler Summary
=======================
Total Allocations: ${report.totalAllocations}
Total Deallocations: ${report.totalDeallocations}
Active Allocations: ${report.totalAllocations - report.totalDeallocations}
Peak Memory: ${this.formatBytes(report.peakMemory)}
Current Memory: ${this.formatBytes(
      this.getActiveAllocations().reduce((sum, r) => sum + r.allocation.size, 0)
    )}

Average Allocation Size: ${this.formatBytes(report.avgAllocationSize)}
Median Allocation Size: ${this.formatBytes(report.medianAllocationSize)}

Allocation Rate: ${report.allocationRate.toFixed(2)} allocs/sec
Deallocation Rate: ${report.deallocationRate.toFixed(2)} frees/sec
Churn Rate: ${this.formatBytes(report.churnRate)}/sec

Memory Leaks: ${leaks.leakCount}
Leaked Bytes: ${this.formatBytes(leaks.leakedBytes)}

Size Distribution:
  Tiny (< 1KB): ${report.sizeDistribution.tiny}
  Small (1-64KB): ${report.sizeDistribution.small}
  Medium (64KB-1MB): ${report.sizeDistribution.medium}
  Large (1-16MB): ${report.sizeDistribution.large}
  Huge (> 16MB): ${report.sizeDistribution.huge}

Lifetime Distribution:
  Ephemeral (< 1s): ${report.lifetimeDistribution.ephemeral}
  Brief (1-10s): ${report.lifetimeDistribution.brief}
  Medium (10-60s): ${report.lifetimeDistribution.medium}
  Long (1-10m): ${report.lifetimeDistribution.long}
  Persistent (> 10m): ${report.lifetimeDistribution.persistent}
    `.trim();

    return summary;
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Destroy profiler
   */
  destroy(): void {
    this.stopProfiling();
    this.reset();
  }
}

/**
 * Memory snapshot for point-in-time analysis
 */
export class MemorySnapshot {
  private timestamp: number;
  private allocations: Allocation[];
  private stats: MemoryStats;

  constructor(allocations: Allocation[], stats: MemoryStats) {
    this.timestamp = Date.now();
    this.allocations = allocations;
    this.stats = stats;
  }

  /**
   * Get snapshot timestamp
   */
  getTimestamp(): number {
    return this.timestamp;
  }

  /**
   * Get allocations
   */
  getAllocations(): Allocation[] {
    return [...this.allocations];
  }

  /**
   * Get statistics
   */
  getStats(): MemoryStats {
    return { ...this.stats };
  }

  /**
   * Compare with another snapshot
   */
  compare(other: MemorySnapshot): {
    allocationDelta: number;
    memoryDelta: number;
    allocationsCreated: Allocation[];
    allocationsFreed: Allocation[];
  } {
    const thisIds = new Set(this.allocations.map(a => a.allocation_id));
    const otherIds = new Set(other.allocations.map(a => a.allocation_id));

    const allocationsCreated = this.allocations.filter(
      a => !otherIds.has(a.allocation_id)
    );
    const allocationsFreed = other.allocations.filter(
      a => !thisIds.has(a.allocation_id)
    );

    return {
      allocationDelta: this.allocations.length - other.allocations.length,
      memoryDelta: this.stats.used_memory - other.stats.used_memory,
      allocationsCreated,
      allocationsFreed,
    };
  }
}
