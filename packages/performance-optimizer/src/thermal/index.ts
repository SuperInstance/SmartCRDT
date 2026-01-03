/**
 * Thermal and Power Management Module
 *
 * Exports all thermal management components for the Aequor platform.
 */

// Core thermal management
export { ThermalMonitor } from "./ThermalMonitor.js";
export { ThrottlingDetector } from "./ThrottlingDetector.js";
export { PowerManager } from "./PowerManager.js";
export { PredictiveThermalModel } from "./PredictiveThermalModel.js";
export { ThermalManager } from "./ThermalManager.js";

// Re-export protocol types
export type {
  TemperatureReading,
  ThermalComponent,
  ThermalStatus,
  ThermalZoneConfig,
  ThermalState,
  ThermalTrend,
  ThrottlingEvent,
  ThrottlingType,
  ThrottlingDetectionResult,
  PowerState,
  PowerReading,
  PowerConsumptionState,
  PowerPolicy,
  PowerStateTransition,
  PowerTransitionReason,
  ThermalModelConfig,
  ThermalModelType,
  ThermalPrediction,
  ThermalAction,
  WorkloadCharacteristics,
  ThermalWorkloadType,
  ThermalManagementConfig,
  CoolingStrategy,
  ThermalEvent,
  ThermalEventType,
  ThermalEventListener,
  ThermalRoutingConstraint,
  ThermalRoutingDecision,
  ThermalDataPoint,
  ThermalStatistics,
  IThermalManager,
} from "@lsi/protocol";

// Export type-specific interfaces
export type { ThrottlingDetectorConfig } from "./ThrottlingDetector.js";
export type { PowerStateConfig, PowerManagerConfig } from "./PowerManager.js";
