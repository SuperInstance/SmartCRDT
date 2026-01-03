/**
 * @lsi/core - Core hardware monitoring and dispatch infrastructure for Aequor
 *
 * This package provides:
 * - HardwareMonitor: Real-time hardware state monitoring
 * - ThermalManager: Thermal-aware resource management
 * - ThermalIntegration: Thermal-aware dispatch recommendations
 * - HardwareAwareDispatcher: Intelligent routing based on hardware state
 * - AutoTuner: Automatic performance tuning system
 * - WorkloadAnalyzer: Workload pattern detection and prediction
 * - ParameterOptimizer: Multi-algorithm parameter optimization
 * - SIMD: SIMD-accelerated vector and embedding operations
 * - GPU: GPU-accelerated vector and embedding operations (WebGPU/WebGL)
 */

// Hardware state types and utilities
export {
  CPUState,
  GPUState,
  MemoryState,
  ThermalState,
  NetworkState,
  HardwareState,
  ResourceType,
  HardwareCapabilities,
  StateChangeEvent,
  HardwareStateOptions,
  DEFAULT_HARDWARE_STATE_OPTIONS,
  determineThermalZone,
  canProcessLocally,
  calculateConfidence,
  recommendAction,
  assessCapabilities,
} from "./hardware/HardwareState.js";

// Hardware monitor
export {
  HardwareMonitor,
  DEFAULT_MONITOR_CONFIG,
} from "./hardware/HardwareMonitor.js";

export type {
  HardwareMonitorConfig,
  HardwareMonitorEvent,
} from "./hardware/HardwareMonitor.js";

// Thermal manager
export {
  ThermalManager,
  DEFAULT_THERMAL_POLICY,
  createThermalManager,
} from "./hardware/ThermalManager.js";

export type {
  ThermalAction,
  ThermalZone,
  ThermalPolicy,
  ThermalMetrics,
  ThermalManagerConfig,
} from "./hardware/ThermalManager.js";

// Thermal integration
export {
  ThermalIntegration,
  DEFAULT_THERMAL_DISPATCH_POLICY,
  createThermalIntegration,
} from "./hardware/ThermalIntegration.js";

export type {
  DispatchAction,
  ThermalDispatchPolicy,
  ThermalDispatchRecommendation,
  ThermalIntegrationOptions,
} from "./hardware/ThermalIntegration.js";

// Hardware-aware dispatcher
export {
  HardwareAwareDispatcher,
  DEFAULT_DISPATCHER_CONFIG,
  createHardwareAwareDispatcher,
} from "./hardware/HardwareAwareDispatcher.js";

export type {
  DispatchDecision,
  DispatchConstraints,
  DispatchStats,
  DispatcherConfig,
  DispatchDestination,
  ResourceSpec,
  RefinedQuery,
} from "./hardware/HardwareAwareDispatcher.js";

// ============================================================================
// AUTO-TUNING SYSTEM (Performance Optimization)
// ============================================================================

// AutoTuner - Main automatic tuning system
export {
  AutoTuner,
  DEFAULT_AUTOTUNER_CONFIG,
  DEFAULT_TUNABLE_PARAMETERS,
  createAutoTuner,
} from "./tuning/AutoTuner.js";

export type {
  ParameterCategory,
  TunableParameter,
  OptimizationObjective,
  TuningConstraints,
  AutoTunerConfig,
  TuningRecommendation,
  PerformanceMetrics,
  TuningHistoryEntry,
  QueryHistory,
} from "./tuning/AutoTuner.js";

// WorkloadAnalyzer - Workload pattern detection and prediction
export {
  WorkloadAnalyzer,
  createWorkloadAnalyzer,
} from "./tuning/WorkloadAnalyzer.js";

export type {
  WorkloadType,
  WorkloadPattern,
  BurstInfo,
  WorkloadPrediction,
  WorkloadState,
  WorkloadAnalyzerConfig,
} from "./tuning/WorkloadAnalyzer.js";

// ParameterOptimizer - Multi-algorithm parameter optimization
export {
  ParameterOptimizer,
  createParameterOptimizer,
} from "./tuning/ParameterOptimizer.js";

export type {
  OptimizationResult as ParameterOptimizationResult,
  OptimizationRecommendation,
  OptimizationAlgorithm,
} from "./tuning/ParameterOptimizer.js";

// ============================================================================
// SIMD OPTIMIZATION (CPU Vector Operations)
// ============================================================================

// SIMD Optimizer
export { SIMDOptimizer } from "./simd/SIMDOptimizer.js";

export type {
  SIMDOperation,
  SIMDCapabilities,
  SIMDPerformanceMetrics,
  SIMDImplementation,
} from "./simd/SIMDOptimizer.js";

// Vector Operations
export { VectorOps } from "./simd/VectorOps.js";

export type { BatchCompareResult } from "./simd/VectorOps.js";

// Embedding Operations
export { EmbeddingOps } from "./simd/EmbeddingOps.js";

export type {
  AttentionConfig,
  PCAConfig,
  PCAResult,
  MatrixLayout,
} from "./simd/EmbeddingOps.js";

// ============================================================================
// GPU OPTIMIZATION (GPU Compute with WebGPU/WebGL)
// ============================================================================

// GPU Device Manager
export {
  GPUDeviceManager,
  BufferUsage,
  TextureFormat,
} from "./gpu/GPUDevice.js";

export type {
  GPUBackend,
  GPUConfig,
  GPUInfo,
  GPULimits,
  GPUFeatures,
} from "./gpu/GPUDevice.js";

// GPU Vector Operations
export { GPUVectorOps } from "./gpu/GPUVectorOps.js";

export type {
  GPUBenchmarkResult,
  BatchCompareResult as GPUBatchCompareResult,
} from "./gpu/GPUVectorOps.js";

// GPU Embedding Operations
export { GPUEmbeddingOps } from "./gpu/GPUEmbeddingOps.js";

export type {
  MatrixPair,
  NeighborResult,
  GPUOperation,
  GPUBenchmarkResult as GPUEmbeddingBenchmarkResult,
} from "./gpu/GPUEmbeddingOps.js";

// ============================================================================
// POWER MANAGEMENT (CPU Power State & Battery Optimization)
// ============================================================================

// Power State Controller
export { PowerStateController } from "./power/PowerStateController.js";

export type {
  PowerState,
  CpuFrequencies,
  CState,
  PState,
  Governor,
  CStateUsage,
  PowerConsumption,
  PowerDataPoint as PowerHistoryDataPoint,
  Duration as PowerDuration,
  PowerCost,
  PowerProfile,
  CustomProfileConfig,
  PowerStateConfig,
} from "./power/PowerStateController.js";

// Battery Manager
export { BatteryManager } from "./power/BatteryManager.js";

export type {
  BatteryStatus,
  BatteryHealth,
  BatteryPrediction,
  PowerDataPoint as BatteryPowerDataPoint,
  Duration as BatteryDuration,
  PowerStrategy,
  PowerSource,
  BatteryManagerConfig,
  BatteryStatusEvent,
} from "./power/BatteryManager.js";

// Power-Aware Dispatcher
export { PowerAwareDispatcher } from "./power/PowerAwareDispatcher.js";

export type {
  DispatchRequest as PowerDispatchRequest,
  RequestType,
  Complexity,
  UrgencyLevel,
  ModelSelection,
  DispatchDecision as PowerDispatchDecision,
  PowerState as DispatchPowerState,
  BatteryImpact,
  Duration as DispatchDuration,
  Constraints,
  OptimizationResult,
  PowerAwareDispatcherConfig,
} from "./power/PowerAwareDispatcher.js";
