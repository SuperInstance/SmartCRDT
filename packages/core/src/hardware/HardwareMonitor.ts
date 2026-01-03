/**
 * HardwareMonitor - Real-time hardware monitoring and state tracking
 *
 * This module provides the core hardware monitoring functionality using
 * the systeminformation library for cross-platform hardware access.
 */

import type {
  HardwareState,
  HardwareStateOptions,
  StateChangeEvent,
  CPUState,
  GPUState,
  MemoryState,
  ThermalState,
  NetworkState,
} from "./HardwareState.js";
import {
  DEFAULT_HARDWARE_STATE_OPTIONS,
  determineThermalZone,
  canProcessLocally,
  calculateConfidence,
  recommendAction,
} from "./HardwareState.js";

// Dynamic import for systeminformation (optional dependency)
let si: any = null;
async function loadSystemInformation() {
  if (!si) {
    try {
      // @ts-ignore - systeminformation is optional
      si = await import("systeminformation");
    } catch (e) {
      // systeminformation not available
      si = null;
    }
  }
  return si;
}

/**
 * Hardware monitor event types
 */
export type HardwareMonitorEvent =
  | "stateChange"
  | "thermalAlert"
  | "memoryAlert"
  | "cpuAlert"
  | "gpuAlert";

/**
 * Hardware monitor configuration
 */
export interface HardwareMonitorConfig extends HardwareStateOptions {
  /** Callback for state changes */
  onStateChange?: (event: StateChangeEvent) => void;
  /** Callback for thermal alerts */
  onThermalAlert?: (temperature: number, zone: ThermalState["zone"]) => void;
  /** Enable event emission */
  enableEvents?: boolean;
}

/**
 * Default monitor configuration
 */
export const DEFAULT_MONITOR_CONFIG: HardwareMonitorConfig = {
  ...DEFAULT_HARDWARE_STATE_OPTIONS,
  enableEvents: true,
};

/**
 * HardwareMonitor - Monitors system hardware state in real-time
 */
export class HardwareMonitor {
  private config: HardwareMonitorConfig;
  private currentState: HardwareState | null = null;
  private previousState: HardwareState | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private eventListeners: Map<HardwareMonitorEvent, Set<Function>> = new Map();
  private gpuInfo: any[] | null = null;
  private timeInThermalZone: number = 0;

  constructor(config: HardwareMonitorConfig = {}) {
    this.config = {
      ...DEFAULT_MONITOR_CONFIG,
      ...config,
    };

    // Initialize event listener maps
    this.eventListeners.set("stateChange", new Set());
    this.eventListeners.set("thermalAlert", new Set());
    this.eventListeners.set("memoryAlert", new Set());
    this.eventListeners.set("cpuAlert", new Set());
    this.eventListeners.set("gpuAlert", new Set());
  }

  /**
   * Start monitoring hardware state
   */
  async start(): Promise<void> {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    // Initialize GPU info
    await this.initializeGPUInfo();

    // Get initial state
    this.currentState = await this.captureState();
    this.previousState = this.currentState;

    // Start periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.updateState();
    }, this.config.updateInterval ?? 1000);
  }

  /**
   * Stop monitoring hardware state
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Get current hardware state
   */
  getState(): HardwareState | null {
    return this.currentState;
  }

  /**
   * Get previous hardware state
   */
  getPreviousState(): HardwareState | null {
    return this.previousState;
  }

  /**
   * Capture a snapshot of current hardware state
   */
  async captureState(): Promise<HardwareState> {
    const si = await loadSystemInformation();

    if (!si) {
      // Return mock state when systeminformation is not available
      return this.getMockState();
    }

    const [cpuData, memData, tempData, networkData] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.cpuTemperature(),
      this.getNetworkStats(),
    ]);

    const cpuState: CPUState = {
      usage: cpuData.currentLoad / 100,
      temperature: tempData.main || tempData.cpus?.[0] || 0,
      availableCores: cpuData.cpus.length,
      totalCores: cpuData.cpus.length,
      frequency: cpuData.cpus[0]?.speed || 0,
      loadAverage: cpuData.currentLoad ? [cpuData.currentLoad] : [0],
    };

    const memState: MemoryState = {
      used: Math.round(memData.used / 1024 / 1024),
      total: Math.round(memData.total / 1024 / 1024),
      available: Math.round(memData.available / 1024 / 1024),
      usageRatio: memData.used / memData.total,
      cached: Math.round((memData.cached || 0) / 1024 / 1024),
      buffers: Math.round((memData.buffers || 0) / 1024 / 1024),
    };

    const gpuState = await this.captureGPUState();

    const thermalZone = determineThermalZone(
      cpuState.temperature,
      this.config.thermalThresholds ??
        DEFAULT_HARDWARE_STATE_OPTIONS.thermalThresholds!
    );

    // Update time in zone
    if (this.currentState?.thermal.zone === thermalZone) {
      this.timeInThermalZone += this.config.updateInterval ?? 1000;
    } else {
      this.timeInThermalZone = 0;
    }

    const thermalState: ThermalState = {
      cpu: cpuState.temperature,
      gpu: gpuState?.temperature,
      critical: thermalZone === "critical",
      zone: thermalZone,
      timeInZone: this.timeInThermalZone,
    };

    const networkState: NetworkState = {
      latency: networkData?.latency ?? 0,
      available: networkData?.available ?? true,
      type: networkData?.type,
    };

    const state: HardwareState = {
      cpu: cpuState,
      gpu: gpuState,
      memory: memState,
      thermal: thermalState,
      network: networkState,
      timestamp: Date.now(),
      canProcessLocal: false, // Will be set below
      recommendedAction: "cloud", // Will be set below
      confidence: 0, // Will be set below
    };

    // Calculate derived state
    state.canProcessLocal = canProcessLocally(state, this.config);
    state.confidence = calculateConfidence(state);
    state.recommendedAction = recommendAction(state);

    return state;
  }

  /**
   * Capture GPU state if available
   */
  private async captureGPUState(): Promise<GPUState | undefined> {
    if (
      !this.config.enableGPUMonitoring ||
      !this.gpuInfo ||
      this.gpuInfo.length === 0
    ) {
      return undefined;
    }

    const si = await loadSystemInformation();
    if (!si) {
      return undefined;
    }

    try {
      const gpuData = await si.graphics();

      if (gpuData.controllers && gpuData.controllers.length > 0) {
        const controller = gpuData.controllers[0];
        return {
          available: true,
          usage: (controller.utilizationGpu ?? 0) / 100,
          temperature: controller.temperatureGpu ?? 0,
          memoryUsed: Math.round((controller.vramUsed ?? 0) / 1024 / 1024),
          memoryTotal: Math.round((controller.vram ?? 0) / 1024 / 1024),
          utilization: controller.utilizationGpu ?? 0,
          powerUsage: controller.powerDraw ?? 0,
          deviceId: controller.bus,
          name: controller.model || "Unknown GPU",
        };
      }
    } catch (error) {
      // GPU monitoring failed, continue without it
      console.warn("GPU monitoring failed:", error);
    }

    return undefined;
  }

  /**
   * Initialize GPU information
   */
  private async initializeGPUInfo(): Promise<void> {
    const si = await loadSystemInformation();
    if (!si) {
      this.gpuInfo = null;
      return;
    }

    try {
      const graphics = await si.graphics();
      this.gpuInfo =
        graphics.controllers?.length > 0 ? graphics.controllers : null;
    } catch (error) {
      this.gpuInfo = null;
    }
  }

  /**
   * Get mock hardware state (when systeminformation is not available)
   */
  private getMockState(): HardwareState {
    return {
      cpu: {
        usage: 0.3,
        temperature: 50,
        availableCores: 4,
        totalCores: 4,
        frequency: 3000,
        loadAverage: [0.3],
      },
      memory: {
        used: 4000,
        total: 16000,
        available: 12000,
        usageRatio: 0.25,
        cached: 1000,
        buffers: 500,
      },
      thermal: {
        cpu: 50,
        critical: false,
        zone: "normal",
        timeInZone: 0,
      },
      network: {
        latency: 10,
        available: true,
        type: "ethernet",
      },
      timestamp: Date.now(),
      canProcessLocal: true,
      recommendedAction: "local",
      confidence: 1.0,
    };
  }

  /**
   * Get network statistics
   */
  private async getNetworkStats(): Promise<{
    latency: number;
    available: boolean;
    type?: string;
  } | null> {
    if (!this.config.enableNetworkMonitoring) {
      return null;
    }

    const si = await loadSystemInformation();
    if (!si) {
      return { latency: 10, available: true, type: "unknown" };
    }

    try {
      const networkInterface = await si.networkInterfaceDefault();
      if (!networkInterface) {
        return { latency: 0, available: false };
      }

      const networkStats = await si.networkStats();
      const defaultIface = networkStats.find(
        (iface: any) => iface.iface === networkInterface
      );

      return {
        latency: 0, // TODO: Implement actual latency measurement
        available: true,
        type: defaultIface?.type || "unknown",
      };
    } catch (error) {
      return { latency: 0, available: false };
    }
  }

  /**
   * Update internal state and emit events
   */
  private async updateState(): Promise<void> {
    this.previousState = this.currentState;
    this.currentState = await this.captureState();

    if (!this.config.enableEvents) {
      return;
    }

    // Check for state changes and emit events
    if (this.previousState) {
      await this.checkForStateChanges();
    }
  }

  /**
   * Check for significant state changes and emit events
   */
  private async checkForStateChanges(): Promise<void> {
    if (!this.currentState || !this.previousState) {
      return;
    }

    const current = this.currentState;
    const previous = this.previousState;

    // Check thermal zone changes
    if (current.thermal.zone !== previous.thermal.zone) {
      this.emitEvent("thermalAlert", current.thermal.cpu, current.thermal.zone);
      this.emitStateChange(
        "thermal",
        "warning",
        `Thermal zone changed from ${previous.thermal.zone} to ${current.thermal.zone}`
      );
    }

    // Check memory alerts
    if (
      current.memory.usageRatio > (this.config.memoryThreshold ?? 0.9) &&
      previous.memory.usageRatio <= (this.config.memoryThreshold ?? 0.9)
    ) {
      this.emitEvent("memoryAlert", current.memory.usageRatio);
      this.emitStateChange(
        "memory",
        "warning",
        `Memory usage exceeded threshold: ${(current.memory.usageRatio * 100).toFixed(1)}%`
      );
    }

    // Check CPU alerts
    if (
      current.cpu.usage > (this.config.cpuThreshold ?? 0.95) &&
      previous.cpu.usage <= (this.config.cpuThreshold ?? 0.95)
    ) {
      this.emitEvent("cpuAlert", current.cpu.usage);
      this.emitStateChange(
        "cpu",
        "warning",
        `CPU usage exceeded threshold: ${(current.cpu.usage * 100).toFixed(1)}%`
      );
    }

    // Check GPU alerts
    if (current.gpu && current.gpu.usage > 0.95) {
      const prevGPU = previous.gpu;
      if (!prevGPU || prevGPU.usage <= 0.95) {
        this.emitEvent("gpuAlert", current.gpu.usage);
        this.emitStateChange(
          "gpu",
          "warning",
          `GPU usage exceeded threshold: ${(current.gpu.usage * 100).toFixed(1)}%`
        );
      }
    }
  }

  /**
   * Emit a state change event
   */
  private emitStateChange(
    changeType: StateChangeEvent["changeType"],
    severity: StateChangeEvent["severity"],
    description: string
  ): void {
    if (!this.currentState || !this.previousState) {
      return;
    }

    const event: StateChangeEvent = {
      previous: this.previousState,
      current: this.currentState,
      changeType,
      severity,
      description,
    };

    this.emitEvent("stateChange", event);

    if (this.config.onStateChange) {
      this.config.onStateChange(event);
    }
  }

  /**
   * Add event listener
   */
  on(event: HardwareMonitorEvent, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }
  }

  /**
   * Remove event listener
   */
  off(event: HardwareMonitorEvent, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: HardwareMonitorEvent, ...args: unknown[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Check if local processing is recommended
   */
  isLocalProcessingRecommended(): boolean {
    return this.currentState?.recommendedAction === "local";
  }

  /**
   * Get current thermal zone
   */
  getThermalZone(): ThermalState["zone"] | null {
    return this.currentState?.thermal.zone ?? null;
  }

  /**
   * Check if in thermal throttle zone
   */
  isThermalThrottling(): boolean {
    return (
      this.currentState?.thermal.zone === "throttle" ||
      this.currentState?.thermal.zone === "critical"
    );
  }

  /**
   * Get available resources
   */
  getAvailableResources(): { cpu: boolean; gpu: boolean; npu: boolean } {
    return {
      cpu: (this.currentState?.cpu.availableCores ?? 0) > 0,
      gpu: this.currentState?.gpu?.available ?? false,
      npu: false, // TODO: Implement NPU detection
    };
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    this.eventListeners.clear();
  }
}
