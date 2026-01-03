/**
 * GPUProfiler - Main WebGPU profiling interface
 *
 * Provides high-level profiling API for WebGPU applications
 */

import type {
  ProfilerConfig,
  ProfileReport,
  ProfileScope,
  ProfilerSession,
  ProfiledGPUDevice,
  GPUInfo,
  PerformanceMetric,
  MetricType,
  MetricUnit,
  FrameProfile,
  GPUDevice,
  GPUAdapter,
} from "../types.js";

/**
 * Default profiler configuration
 */
const DEFAULT_CONFIG: ProfilerConfig = {
  samplingRate: 0, // Continuous
  bufferSize: 10000,
  autoAnalyze: true,
  enabledScopes: ["kernel", "memory", "transfer", "frame"],
  minDurationThreshold: 1000, // 1 microsecond
  trackMemory: true,
  trackTransfers: true,
  useGPUTimestamps: true,
};

/**
 * GPUProfiler - Main profiling interface
 *
 * Wraps a GPUDevice and tracks all GPU operations for performance analysis.
 *
 * @example
 * ```typescript
 * const adapter = await navigator.gpu.requestAdapter();
 * const device = await adapter.requestDevice();
 * const profiler = new GPUProfiler(device);
 *
 * profiler.startProfiling();
 * // ... GPU operations ...
 * const report = profiler.stopProfiling();
 * console.log(report.bottlenecks);
 * ```
 */
export class GPUProfiler {
  /** Original device being profiled */
  readonly device: GPUDevice;
  /** Device info */
  readonly info: GPUInfo;
  /** Current profiler session */
  private session?: ProfilerSession;
  /** Profiler configuration */
  config: ProfilerConfig;
  /** Session counter for unique IDs */
  private sessionCounter = 0;
  /** Frame counter */
  private frameCounter = 0;

  /**
   * Create a new GPU profiler
   *
   * @param device - The WebGPU device to profile
   * @param config - Profiler configuration
   */
  constructor(device: GPUDevice, config: Partial<ProfilerConfig> = {}) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Extract GPU info from adapter if available
    this.info = this.extractGPUInfo();

    // Create profiled device wrapper
    this.createProfiledDevice();
  }

  /**
   * Extract GPU information from device/adapter
   */
  private extractGPUInfo(): GPUInfo {
    const info: GPUInfo = {
      name: "Unknown GPU",
      vendor: "Unknown Vendor",
    };

    // Try to get adapter info from device
    if ("adapter" in this.device && this.device.adapter) {
      const adapter = this.device.adapter as GPUAdapter;
      info.vendor = adapter.info.vendor;
      info.name = adapter.info.architecture
        ? `${adapter.info.vendor} ${adapter.info.architecture}`
        : adapter.info.description || `${adapter.info.vendor} GPU`;
      info.architecture = adapter.info.architecture;
      info.description = adapter.info.description;
      info.vendorId = adapter.info.vendorId;
      info.deviceId = adapter.info.deviceId;
    }

    return info;
  }

  /**
   * Create profiled device wrapper
   */
  private createProfiledDevice(): void {
    // Override device methods for profiling
    if (!this.device.lost) {
      const originalQueue = this.device.queue;
      const profiler = this;

      // Wrap queue submit method
      const originalSubmit = originalQueue.submit.bind(originalQueue);
      const queueProxy = {
        submit: (...args: Parameters<typeof originalQueue.submit>) => {
          const result = originalSubmit(...args);
          profiler.recordSubmit();
          return result;
        },
      } as Partial<typeof originalQueue>;

      // Copy all other properties
      for (const key in originalQueue) {
        if (!(key in queueProxy)) {
          (queueProxy as any)[key] = (originalQueue as any)[key];
        }
      }

      this.device.queue = queueProxy as typeof originalQueue;
    }
  }

  /**
   * Start a new profiling session
   *
   * @returns Session identifier
   */
  startProfiling(): string {
    if (this.session?.active) {
      throw new Error(
        "Profiling session already active. Stop current session first."
      );
    }

    const sessionId = `session-${this.sessionCounter++}`;
    const startTime = performance.now();

    this.session = {
      id: sessionId,
      device: {
        device: this.device,
        info: this.info,
        profilingEnabled: true,
        timestampMultiplier: 1,
      },
      startTime,
      config: this.config,
      frames: [],
      activeKernels: new Map(),
      activeTransfers: new Map(),
      allocations: new Map(),
      metrics: new Map(),
      active: true,
    };

    this.frameCounter = 0;

    return sessionId;
  }

  /**
   * Stop profiling and generate report
   *
   * @returns Complete profiling report
   */
  stopProfiling(): ProfileReport {
    if (!this.session?.active) {
      throw new Error("No active profiling session. Start profiling first.");
    }

    const endTime = performance.now();
    const sessionDuration = endTime - this.session.startTime;

    // Finalize current frame if any
    this.endFrame();

    // Mark session as inactive
    this.session.active = false;

    // Generate report
    const report = this.generateReport();

    // Clear session
    this.session = undefined;

    return report;
  }

  /**
   * Get current profiling session (if active)
   */
  getSession(): ProfilerSession | undefined {
    return this.session?.active ? this.session : undefined;
  }

  /**
   * Record a kernel dispatch
   *
   * @param name - Kernel name
   * @param workgroups - Workgroup dimensions
   */
  recordKernelDispatch(
    name: string,
    workgroups: [number, number, number]
  ): void {
    if (!this.session?.active) return;

    const execution = {
      id: `kernel-${this.session.activeKernels.size}`,
      name,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      dispatchSize: workgroups,
    };

    this.session.activeKernels.set(execution.id, execution);
  }

  /**
   * Complete a kernel dispatch
   *
   * @param name - Kernel name
   * @returns Duration in milliseconds
   */
  completeKernel(name: string): number {
    if (!this.session?.active) return 0;

    // Find matching kernel
    for (const [id, kernel] of this.session.activeKernels) {
      if (kernel.name === name && kernel.duration === 0) {
        const endTime = performance.now();
        const duration = endTime - kernel.startTime;

        const completedKernel = {
          ...kernel,
          endTime,
          duration,
        };

        this.session.activeKernels.delete(id);

        // Add to current frame
        if (this.session.currentFrame) {
          if (!this.session.currentFrame.kernels) {
            this.session.currentFrame.kernels = [];
          }
          this.session.currentFrame.kernels.push(completedKernel);
        }

        // Update metrics
        this.updateMetric("kernel-duration", duration, "timing");

        // Call handler if configured
        if (this.config.onKernelComplete) {
          this.config.onKernelComplete(completedKernel);
        }

        return duration;
      }
    }

    return 0;
  }

  /**
   * Record memory allocation
   *
   * @param size - Allocation size in bytes
   * @param type - Resource type
   * @param usage - Usage flags
   * @returns Allocation ID
   */
  recordMemoryAllocation(
    size: number,
    type: "buffer" | "texture",
    usage: string[] = []
  ): string {
    if (!this.session?.active || !this.config.trackMemory) return "";

    const allocation = {
      id: `alloc-${this.session.allocations.size}`,
      type,
      size,
      usage,
      timestamp: performance.now(),
      freed: false,
    };

    this.session.allocations.set(allocation.id, allocation);

    // Add to current frame
    if (this.session.currentFrame) {
      if (!this.session.currentFrame.allocations) {
        this.session.currentFrame.allocations = [];
      }
      this.session.currentFrame.allocations.push(allocation);
    }

    // Update metrics
    this.updateMetric("memory-allocation-size", size, "memory");
    this.updateMetric("memory-allocations", 1, "memory");

    // Call handler if configured
    if (this.config.onMemoryAllocate) {
      this.config.onMemoryAllocate(allocation);
    }

    return allocation.id;
  }

  /**
   * Record memory deallocation
   *
   * @param id - Allocation ID
   */
  recordMemoryDeallocation(id: string): void {
    if (!this.session?.active || !this.config.trackMemory) return;

    const allocation = this.session.allocations.get(id);
    if (allocation && !allocation.freed) {
      const freeTimestamp = performance.now();
      allocation.freed = true;
      allocation.freeTimestamp = freeTimestamp;
      allocation.lifetime = freeTimestamp - allocation.timestamp;

      // Update metrics
      this.updateMetric("memory-lifetime", allocation.lifetime, "timing");
    }
  }

  /**
   * Record a data transfer
   *
   * @param size - Transfer size in bytes
   * @param direction - Transfer direction
   * @param async - Whether transfer was async
   * @returns Transfer ID
   */
  startTransfer(
    size: number,
    direction: "host-to-device" | "device-to-host" | "device-to-device",
    async = false
  ): string {
    if (!this.session?.active || !this.config.trackTransfers) return "";

    const transfer = {
      id: `transfer-${this.session.activeTransfers.size}`,
      direction,
      size,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      bandwidth: 0,
      async,
    };

    this.session.activeTransfers.set(transfer.id, transfer);

    return transfer.id;
  }

  /**
   * Complete a data transfer
   *
   * @param id - Transfer ID
   * @returns Bandwidth in GB/s
   */
  completeTransfer(id: string): number {
    if (!this.session?.active || !this.config.trackTransfers) return 0;

    const transfer = this.session.activeTransfers.get(id);
    if (!transfer) return 0;

    const endTime = performance.now();
    const durationMs = endTime - transfer.startTime;
    const durationNs = durationMs * 1_000_000;
    const bandwidth =
      ((transfer.size / durationNs) * 1_000_000_000) / (1024 * 1024 * 1024);

    const completedTransfer = {
      ...transfer,
      endTime,
      duration: durationNs,
      bandwidth,
    };

    this.session.activeTransfers.delete(id);

    // Add to current frame
    if (this.session.currentFrame) {
      if (!this.session.currentFrame.transfers) {
        this.session.currentFrame.transfers = [];
      }
      this.session.currentFrame.transfers.push(completedTransfer);
    }

    // Update metrics
    this.updateMetric("transfer-bandwidth", bandwidth, "throughput");
    this.updateMetric("transfer-size", transfer.size, "memory");
    this.updateMetric("transfer-duration", durationMs, "timing");

    // Call handler if configured
    if (this.config.onTransferComplete) {
      this.config.onTransferComplete(completedTransfer);
    }

    return bandwidth;
  }

  /**
   * Begin a new frame
   */
  beginFrame(): void {
    if (!this.session?.active) return;

    // End previous frame if exists
    if (this.session.currentFrame) {
      this.endFrame();
    }

    this.session.currentFrame = {
      frameNumber: this.frameCounter++,
      startTime: performance.now(),
    };
  }

  /**
   * End current frame
   */
  endFrame(): void {
    if (!this.session?.active || !this.session.currentFrame) return;

    const endTime = performance.now();
    const frame: FrameProfile = {
      frameNumber: this.session.currentFrame.frameNumber ?? 0,
      startTime: this.session.currentFrame.startTime ?? performance.now(),
      endTime,
      duration:
        endTime - (this.session.currentFrame.startTime ?? performance.now()),
      kernels: this.session.currentFrame.kernels || [],
      allocations: this.session.currentFrame.allocations || [],
      transfers: this.session.currentFrame.transfers || [],
      metadata: {},
    };

    this.session.frames.push(frame);
    this.session.currentFrame = undefined;

    // Update frame metrics
    this.updateMetric("frame-duration", frame.duration, "timing");
    this.updateMetric("frame-kernels", frame.kernels.length, "throughput");
  }

  /**
   * Record command buffer submission
   */
  private recordSubmit(): void {
    if (!this.session?.active) return;
    this.updateMetric("submit-count", 1, "throughput");
  }

  /**
   * Update a metric with a new sample
   */
  private updateMetric(name: string, value: number, type: MetricType): void {
    if (!this.session?.active) return;

    let metric = this.session.metrics.get(name);

    if (!metric) {
      metric = {
        name,
        type,
        value,
        unit: this.getUnitForType(type),
        min: value,
        max: value,
        avg: value,
        sampleCount: 1,
        firstSample: performance.now(),
        lastSample: performance.now(),
      };
      this.session.metrics.set(name, metric);
    } else {
      const count = metric.sampleCount + 1;
      const newAvg = (metric.avg * metric.sampleCount + value) / count;

      metric = {
        ...metric,
        value,
        min: Math.min(metric.min, value),
        max: Math.max(metric.max, value),
        avg: newAvg,
        sampleCount: count,
        lastSample: performance.now(),
      };

      // Calculate standard deviation
      if (count > 1) {
        const variance = (value - newAvg) ** 2;
        metric.stdDev = Math.sqrt(variance / count);
      }

      this.session.metrics.set(name, metric);
    }
  }

  /**
   * Get appropriate unit for metric type
   */
  private getUnitForType(type: MetricType): MetricUnit {
    const units: Record<MetricType, MetricUnit> = {
      timing: "ms",
      memory: "bytes",
      throughput: "ops/s",
      utilization: "%",
    };
    return units[type] || ("ms" as MetricUnit);
  }

  /**
   * Generate complete profiling report
   */
  private generateReport(): ProfileReport {
    if (!this.session) {
      throw new Error("No session data available");
    }

    const endTime = performance.now();
    const sessionDuration = endTime - this.session.startTime;

    // Collect all metrics
    const metrics = Array.from(this.session.metrics.values());

    // Calculate kernel summary
    const allKernels = this.session.frames.flatMap(f => f.kernels);
    const kernelDurations = allKernels.map(k => k.duration);
    const kernelSummary = {
      totalKernels: allKernels.length,
      totalDuration: kernelDurations.reduce((a, b) => a + b, 0),
      avgDuration:
        kernelDurations.length > 0
          ? kernelDurations.reduce((a, b) => a + b, 0) / kernelDurations.length
          : 0,
      minDuration:
        kernelDurations.length > 0 ? Math.min(...kernelDurations) : 0,
      maxDuration:
        kernelDurations.length > 0 ? Math.max(...kernelDurations) : 0,
      slowestKernels: [...allKernels]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10),
    };

    // Calculate memory summary
    const allocations = Array.from(this.session.allocations.values());
    const activeAllocations = allocations.filter(a => !a.freed);
    const memorySummary = {
      totalAllocated: allocations.reduce((sum, a) => sum + a.size, 0),
      peakMemory: allocations.reduce((sum, a) => sum + a.size, 0),
      currentMemory: activeAllocations.reduce((sum, a) => sum + a.size, 0),
      allocationCount: allocations.length,
      leakCount: activeAllocations.length,
    };

    // Calculate transfer summary
    const allTransfers = this.session.frames.flatMap(f => f.transfers);
    const transferSummary = {
      totalTransfers: allTransfers.length,
      totalBytes: allTransfers.reduce((sum, t) => sum + t.size, 0),
      avgBandwidth:
        allTransfers.length > 0
          ? allTransfers.reduce((sum, t) => sum + t.bandwidth, 0) /
            allTransfers.length
          : 0,
      maxBandwidth:
        allTransfers.length > 0
          ? Math.max(...allTransfers.map(t => t.bandwidth))
          : 0,
      totalTransferTime: allTransfers.reduce((sum, t) => sum + t.duration, 0),
    };

    // Import bottleneck analyzer dynamically to avoid circular dependency
    // Will be done by Integration layer

    return {
      id: this.session.id,
      timestamp: endTime,
      sessionStart: this.session.startTime,
      sessionDuration,
      metrics,
      kernelSummary,
      memorySummary,
      transferSummary,
      bottlenecks: [], // Filled by BottleneckAnalyzer
      optimizations: [], // Filled by BottleneckAnalyzer
      timeline: [], // Filled by TimelineView
      frames: this.session.frames,
      metadata: {
        gpuInfo: this.info,
        config: this.config,
      },
    };
  }

  /**
   * Check if profiling is active
   */
  isProfiling(): boolean {
    return this.session?.active ?? false;
  }

  /**
   * Get current session statistics
   */
  getStats(): {
    frames: number;
    kernels: number;
    allocations: number;
    transfers: number;
    duration: number;
  } {
    if (!this.session?.active) {
      return {
        frames: 0,
        kernels: 0,
        allocations: 0,
        transfers: 0,
        duration: 0,
      };
    }

    return {
      frames: this.session.frames.length,
      kernels: this.session.frames.reduce(
        (sum, f) => sum + f.kernels.length,
        0
      ),
      allocations: this.session.allocations.size,
      transfers: this.session.frames.reduce(
        (sum, f) => sum + f.transfers.length,
        0
      ),
      duration: performance.now() - this.session.startTime,
    };
  }

  /**
   * Reset profiler state
   */
  reset(): void {
    this.session = undefined;
    this.frameCounter = 0;
  }
}
