/**
 * @lsi/webgpu-memory - Memory Limits
 *
 * Query device memory limits, set budgets, handle OOM, and detect memory pressure.
 */

import { GPUAdapter, GPUDevice } from "./types.js";
import type {
  MemoryLimitConfig,
  MemoryPressure,
  DeviceInfo,
  MemoryBudget,
} from "./types.js";

/**
 * Memory limit manager
 */
export class MemoryLimits {
  private deviceInfo: DeviceInfo | null = null;
  private config: MemoryLimitConfig;
  private currentUsage: number = 0;
  private warningEmitted: boolean = false;
  private criticalEmitted: boolean = false;

  constructor(config?: Partial<MemoryLimitConfig>) {
    this.config = {
      maxMemory: 0,
      warningThreshold: 0.7,
      criticalThreshold: 0.9,
      autoEvict: true,
      evictTarget: 0.8,
      ...config,
    };
  }

  /**
   * Set adapter and query device limits
   */
  async setAdapter(adapter: GPUAdapter): Promise<void> {
    this.adapter = adapter;
    this.deviceInfo = await this.queryDeviceInfo();

    // Set max memory from device if not configured
    if (this.config.maxMemory === 0 && this.deviceInfo) {
      // Estimate max memory as 10x max buffer size (heuristic)
      this.config.maxMemory = this.deviceInfo.maxBufferSize * 10;
    }
  }

  /**
   * Set device
   */
  setDevice(device: GPUDevice): void {
    this.device = device;
  }

  /**
   * Query device information and limits
   */
  private async queryDeviceInfo(): Promise<DeviceInfo> {
    if (!this.adapter) {
      throw new Error("Adapter not set");
    }

    const adapterInfo = await this.adapter.requestAdapterInfo();

    return {
      name: adapterInfo.device || "Unknown",
      vendor: adapterInfo.vendor || "Unknown",
      architecture: adapterInfo.architecture || "Unknown",
      maxBufferSize: this.adapter.limits.maxBufferSize,
      maxBufferAlignment: this.adapter.limits.minUniformBufferOffsetAlignment,
      maxStorageBuffersPerStage:
        this.adapter.limits.maxStorageBuffersPerShaderStage,
      maxUniformBuffersPerStage:
        this.adapter.limits.maxUniformBuffersPerShaderStage,
    };
  }

  /**
   * Get device information
   */
  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  /**
   * Get maximum buffer size
   */
  getMaxBufferSize(): number {
    return this.deviceInfo?.maxBufferSize || 0;
  }

  /**
   * Get maximum buffer alignment
   */
  getMaxBufferAlignment(): number {
    return this.deviceInfo?.maxBufferAlignment || 0;
  }

  /**
   * Get maximum storage buffers per stage
   */
  getMaxStorageBuffersPerStage(): number {
    return this.deviceInfo?.maxStorageBuffersPerStage || 0;
  }

  /**
   * Get maximum uniform buffers per stage
   */
  getMaxUniformBuffersPerStage(): number {
    return this.deviceInfo?.maxUniformBuffersPerStage || 0;
  }

  /**
   * Set memory budget
   */
  setBudget(budget: number): void {
    this.config.maxMemory = budget;
  }

  /**
   * Get memory budget
   */
  getBudget(): number {
    return this.config.maxMemory;
  }

  /**
   * Set memory budget with allocation
   */
  setBudgetAllocation(budget: MemoryBudget): void {
    const total = budget.total || this.config.maxMemory;
    this.config.maxMemory = total;

    // Budget is stored in config for reference
    // Actual allocation tracking is done by MemoryManager
  }

  /**
   * Record allocation
   */
  recordAllocation(size: number): void {
    this.currentUsage += size;
    this.checkPressure();
  }

  /**
   * Record deallocation
   */
  recordDeallocation(size: number): void {
    this.currentUsage = Math.max(0, this.currentUsage - size);
  }

  /**
   * Get current memory usage
   */
  getCurrentUsage(): number {
    return this.currentUsage;
  }

  /**
   * Get remaining memory
   */
  getRemainingMemory(): number {
    return Math.max(0, this.config.maxMemory - this.currentUsage);
  }

  /**
   * Check if allocation would exceed budget
   */
  wouldExceedBudget(size: number): boolean {
    return this.currentUsage + size > this.config.maxMemory;
  }

  /**
   * Get memory pressure level
   */
  getMemoryPressure(): MemoryPressure {
    if (this.config.maxMemory === 0) {
      return "none" as MemoryPressure.None;
    }

    const usage = this.currentUsage / this.config.maxMemory;

    if (usage >= this.config.criticalThreshold) {
      return "critical" as MemoryPressure.Critical;
    } else if (usage >= 0.95) {
      return "high" as MemoryPressure.High;
    } else if (usage >= this.config.warningThreshold) {
      return "medium" as MemoryPressure.Medium;
    } else if (usage >= 0.5) {
      return "low" as MemoryPressure.Low;
    } else {
      return "none" as MemoryPressure.None;
    }
  }

  /**
   * Get memory usage ratio
   */
  getUsageRatio(): number {
    if (this.config.maxMemory === 0) return 0;
    return this.currentUsage / this.config.maxMemory;
  }

  /**
   * Check pressure and emit warnings
   */
  private checkPressure(): void {
    const pressure = this.getMemoryPressure();

    if (pressure === "critical" && !this.criticalEmitted) {
      this.criticalEmitted = true;
      console.warn(
        `CRITICAL: Memory pressure ${this.getUsageRatio().toFixed(1)}%`
      );
    } else if (pressure === "medium" && !this.warningEmitted) {
      this.warningEmitted = true;
      console.warn(
        `WARNING: Memory pressure ${this.getUsageRatio().toFixed(1)}%`
      );
    }

    // Reset flags when pressure decreases
    if (pressure === "none" || pressure === "low") {
      this.warningEmitted = false;
      this.criticalEmitted = false;
    }
  }

  /**
   * Check if auto-eviction is needed
   */
  shouldAutoEvict(): boolean {
    return (
      this.config.autoEvict &&
      this.getUsageRatio() > this.config.criticalThreshold
    );
  }

  /**
   * Get eviction target size
   */
  getEvictionTarget(): number {
    const targetBytes = this.config.maxMemory * this.config.evictTarget;
    return Math.max(0, this.currentUsage - targetBytes);
  }

  /**
   * Handle out of memory error
   */
  handleOOM(requiredSize: number): {
    canRecover: boolean;
    bytesToFree: number;
  } {
    const pressure = this.getMemoryPressure();

    if (pressure === "critical" || this.wouldExceedBudget(requiredSize)) {
      const bytesToFree = requiredSize + this.getEvictionTarget();

      if (this.config.autoEvict) {
        return { canRecover: true, bytesToFree };
      } else {
        return { canRecover: false, bytesToFree };
      }
    }

    return { canRecover: true, bytesToFree: 0 };
  }

  /**
   * Reset usage tracking
   */
  reset(): void {
    this.currentUsage = 0;
    this.warningEmitted = false;
    this.criticalEmitted = false;
  }

  /**
   * Get configuration
   */
  getConfig(): MemoryLimitConfig {
    return { ...this.config };
  }
}

/**
 * Memory pressure monitor
 */
export class MemoryPressureMonitor {
  private limits: MemoryLimits;
  private pollInterval: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private callbacks: Set<(pressure: MemoryPressure) => void> = new Set();

  constructor(limits: MemoryLimits, pollInterval: number = 1000) {
    this.limits = limits;
    this.pollInterval = pollInterval;
  }

  /**
   * Start monitoring
   */
  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      const pressure = this.limits.getMemoryPressure();
      this.callbacks.forEach(cb => {
        try {
          cb(pressure);
        } catch (e) {
          console.error("Memory pressure callback error:", e);
        }
      });
    }, this.pollInterval);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Register pressure change callback
   */
  onPressureChange(callback: (pressure: MemoryPressure) => void): void {
    this.callbacks.add(callback);
  }

  /**
   * Unregister callback
   */
  offPressureChange(callback: (pressure: MemoryPressure) => void): void {
    this.callbacks.delete(callback);
  }
}
