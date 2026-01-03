/**
 * Power Management Module
 *
 * Exports all power management components for the Aequor Cognitive Orchestration Platform.
 *
 * @module power
 */

// PowerStateController exports
export {
  PowerStateController,
  type PowerState,
  type CpuFrequencies,
  type CState,
  type PState,
  type Governor,
  type CStateUsage,
  type PowerConsumption,
  type PowerDataPoint,
  type Duration,
  type PowerCost,
  type PowerProfile,
  type CustomProfileConfig,
  type PowerStateConfig,
} from "./PowerStateController.js";

// BatteryManager exports
export {
  BatteryManager,
  type BatteryStatus,
  type BatteryHealth,
  type BatteryPrediction,
  type PowerDataPoint as BatteryPowerDataPoint,
  type Duration as BatteryDuration,
  type PowerStrategy,
  type PowerSource,
  type BatteryManagerConfig,
  type BatteryStatusEvent,
} from "./BatteryManager.js";

// PowerAwareDispatcher exports
export {
  PowerAwareDispatcher,
  type DispatchRequest,
  type RequestType,
  type Complexity,
  type UrgencyLevel,
  type ModelSelection,
  type DispatchDecision,
  type PowerState as DispatchPowerState,
  type BatteryImpact,
  type Duration as DispatchDuration,
  type Constraints,
  type OptimizationResult,
  type PowerAwareDispatcherConfig,
} from "./PowerAwareDispatcher.js";
