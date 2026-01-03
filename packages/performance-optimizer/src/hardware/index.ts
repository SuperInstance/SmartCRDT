/**
 * Hardware Detection and Routing Module
 *
 * Exports hardware detection, capability profiling, and intelligent routing.
 */

export { HardwareDetector } from "./HardwareDetector.js";
export { CapabilityProfiler } from "./CapabilityProfiler.js";
export { HardwareRouter } from "./HardwareRouter.js";

// Re-export types from protocol
export type {
  GPUType,
  GPUInfo,
  CPUInfo,
  MemoryInfo,
  NPUInfo,
  ThermalInfo,
  ThermalState,
  HardwareProfile,
  HardwareCapabilities,
  HardwareTarget,
  RoutingPriority,
  OperationType,
  HardwareRoutingDecision,
  HardwareRoutingConstraints,
  HardwareDetectionResult,
  CapabilityScoringResult,
  IHardwareDetector,
  ICapabilityProfiler,
  IHardwareRouter,
  HardwareDetectorConfig,
  CapabilityProfilerConfig,
  HardwareRouterConfig,
  HardwareEventType,
  HardwareEvent,
  HardwareEventListener,
} from "@lsi/protocol";
