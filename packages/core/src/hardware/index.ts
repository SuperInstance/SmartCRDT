/**
 * Hardware monitoring and dispatch exports
 *
 * This module exports all hardware-related functionality including:
 * - Hardware state tracking
 * - Hardware monitoring
 * - Thermal management with policy framework
 * - Adaptive thermal control
 * - Thermal-aware dispatch
 * - Hardware-aware dispatch
 * - NUMA-aware allocation and topology detection
 */

export * from "./HardwareState.js";
export * from "./HardwareMonitor.js";
export * from "./ThermalManager.js";
export * from "./ThermalIntegration.js";

// Export policy types with explicit names to avoid conflicts
export type {
  ThermalPolicyConfig,
  PolicyStats,
  ThermalHistoryEntry,
  ThermalPrediction,
} from "./ThermalPolicy.js";

export {
  ConservativeThermalPolicy,
  AggressiveThermalPolicy,
  BalancedThermalPolicy,
  AdaptiveThermalPolicy,
  createThermalPolicy,
  type ThermalAction as PolicyThermalAction,
} from "./ThermalPolicy.js";

export * from "./AdaptiveThermalController.js";
export * from "./HardwareAwareDispatcher.js";

// NUMA-aware allocation and topology
export * from "./NUMATopology.js";
export * from "./NUMAAllocator.js";
