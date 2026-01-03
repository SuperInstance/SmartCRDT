/**
 * HardwareState - Comprehensive hardware state tracking for dispatch decisions
 *
 * This module provides interfaces and types for tracking hardware capabilities
 * and current state to enable intelligent routing decisions.
 */

/**
 * CPU state information
 */
export interface CPUState {
  /** Current CPU usage (0-1) */
  usage: number;
  /** CPU temperature in Celsius */
  temperature: number;
  /** Number of available CPU cores */
  availableCores: number;
  /** Total CPU cores */
  totalCores: number;
  /** Current CPU frequency in MHz */
  frequency: number;
  /** CPU load average (1, 5, 15 minutes) */
  loadAverage: number[];
}

/**
 * GPU state information
 */
export interface GPUState {
  /** Whether GPU is available */
  available: boolean;
  /** GPU usage (0-1) if available */
  usage: number;
  /** GPU temperature in Celsius */
  temperature: number;
  /** GPU memory used in MB */
  memoryUsed: number;
  /** Total GPU memory in MB */
  memoryTotal: number;
  /** GPU utilization percentage (0-100) */
  utilization: number;
  /** GPU power usage in watts */
  powerUsage: number;
  /** GPU device ID (for multi-GPU systems) */
  deviceId?: string;
  /** GPU name/model */
  name: string;
}

/**
 * Memory state information
 */
export interface MemoryState {
  /** Memory used in MB */
  used: number;
  /** Total memory in MB */
  total: number;
  /** Available memory in MB */
  available: number;
  /** Memory usage ratio (0-1) */
  usageRatio: number;
  /** Cached memory in MB */
  cached: number;
  /** Buffered memory in MB */
  buffers: number;
}

/**
 * Thermal zone state
 */
export interface ThermalState {
  /** CPU temperature in Celsius */
  cpu: number;
  /** GPU temperature in Celsius (if available) */
  gpu?: number;
  /** Whether temperature is in critical zone */
  critical: boolean;
  /** Current thermal zone */
  zone: "normal" | "throttle" | "critical";
  /** Time spent in current zone (ms) */
  timeInZone: number;
}

/**
 * Network state information
 */
export interface NetworkState {
  /** Current network latency in milliseconds */
  latency: number;
  /** Whether network is available */
  available: boolean;
  /** Network type (wifi, ethernet, etc.) */
  type?: string;
}

/**
 * Complete hardware state snapshot
 */
export interface HardwareState {
  /** CPU state */
  cpu: CPUState;
  /** GPU state (if available) */
  gpu?: GPUState;
  /** Memory state */
  memory: MemoryState;
  /** Thermal state */
  thermal: ThermalState;
  /** Network state */
  network: NetworkState;
  /** Timestamp when state was captured */
  timestamp: number;
  /** Derived state - can process locally */
  canProcessLocal: boolean;
  /** Derived state - recommended action */
  recommendedAction: "local" | "cloud" | "hybrid";
  /** Derived state - confidence in recommendation (0-1) */
  confidence: number;
}

/**
 * Resource type for local processing
 */
export type ResourceType = "cpu" | "gpu" | "npu";

/**
 * Hardware capability assessment
 */
export interface HardwareCapabilities {
  /** Has CPU available */
  hasCPU: boolean;
  /** Has GPU available */
  hasGPU: boolean;
  /** Has NPU available */
  hasNPU: boolean;
  /** Recommended resource type */
  recommendedResource: ResourceType | null;
  /** Reason for recommendation */
  reason: string;
}

/**
 * State change event
 */
export interface StateChangeEvent {
  /** Previous state */
  previous: HardwareState;
  /** New state */
  current: HardwareState;
  /** Type of change */
  changeType: "thermal" | "memory" | "cpu" | "gpu" | "network";
  /** Severity of change */
  severity: "info" | "warning" | "critical";
  /** Description of change */
  description: string;
}

/**
 * Hardware state options
 */
export interface HardwareStateOptions {
  /** Update interval in milliseconds */
  updateInterval?: number;
  /** Thermal thresholds */
  thermalThresholds?: {
    normal: number;
    throttle: number;
    critical: number;
  };
  /** Memory threshold (0-1) */
  memoryThreshold?: number;
  /** CPU threshold (0-1) */
  cpuThreshold?: number;
  /** Enable GPU monitoring */
  enableGPUMonitoring?: boolean;
  /** Enable network monitoring */
  enableNetworkMonitoring?: boolean;
}

/**
 * Default hardware state options
 */
export const DEFAULT_HARDWARE_STATE_OPTIONS: HardwareStateOptions = {
  updateInterval: 1000,
  thermalThresholds: {
    normal: 70,
    throttle: 85,
    critical: 95,
  },
  memoryThreshold: 0.9,
  cpuThreshold: 0.95,
  enableGPUMonitoring: true,
  enableNetworkMonitoring: true,
};

/**
 * Determine thermal zone from temperature
 */
export function determineThermalZone(
  temperature: number,
  thresholds: { normal: number; throttle: number; critical: number }
): ThermalState["zone"] {
  if (temperature >= thresholds.critical) {
    return "critical";
  } else if (temperature >= thresholds.throttle) {
    return "throttle";
  }
  return "normal";
}

/**
 * Check if hardware can process locally
 */
export function canProcessLocally(
  state: HardwareState,
  options: HardwareStateOptions = DEFAULT_HARDWARE_STATE_OPTIONS
): boolean {
  const { thermalThresholds, memoryThreshold, cpuThreshold } = {
    ...DEFAULT_HARDWARE_STATE_OPTIONS,
    ...options,
  };

  // Check thermal state
  if (state.thermal.zone === "critical") {
    return false;
  }

  // Check memory
  if (state.memory.usageRatio > (memoryThreshold ?? 0.9)) {
    return false;
  }

  // Check CPU
  if (state.cpu.usage > (cpuThreshold ?? 0.95)) {
    return false;
  }

  return true;
}

/**
 * Calculate confidence in local processing decision
 */
export function calculateConfidence(state: HardwareState): number {
  let confidence = 1.0;

  // Reduce confidence based on thermal zone
  switch (state.thermal.zone) {
    case "critical":
      confidence *= 0.0;
      break;
    case "throttle":
      confidence *= 0.3;
      break;
    case "normal":
      confidence *= 1.0;
      break;
  }

  // Reduce confidence based on memory usage
  if (state.memory.usageRatio > 0.8) {
    confidence *= 0.5;
  } else if (state.memory.usageRatio > 0.6) {
    confidence *= 0.8;
  }

  // Reduce confidence based on CPU usage
  if (state.cpu.usage > 0.9) {
    confidence *= 0.3;
  } else if (state.cpu.usage > 0.7) {
    confidence *= 0.7;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Recommend action based on hardware state
 */
export function recommendAction(
  state: HardwareState
): "local" | "cloud" | "hybrid" {
  if (!state.canProcessLocal) {
    return "cloud";
  }

  if (state.confidence > 0.8) {
    return "local";
  } else if (state.confidence > 0.5) {
    return "hybrid";
  }

  return "cloud";
}

/**
 * Assess hardware capabilities
 */
export function assessCapabilities(state: HardwareState): HardwareCapabilities {
  const capabilities: HardwareCapabilities = {
    hasCPU: state.cpu.availableCores > 0,
    hasGPU: state.gpu?.available ?? false,
    hasNPU: false, // TODO: Implement NPU detection
    recommendedResource: null,
    reason: "",
  };

  // Determine recommended resource
  if (capabilities.hasGPU && state.gpu!.usage < 0.8) {
    capabilities.recommendedResource = "gpu";
    capabilities.reason = "GPU available with sufficient capacity";
  } else if (capabilities.hasCPU && state.cpu.usage < 0.8) {
    capabilities.recommendedResource = "cpu";
    capabilities.reason = "CPU available with sufficient capacity";
  } else {
    capabilities.reason =
      "No local resources available with sufficient capacity";
  }

  return capabilities;
}
