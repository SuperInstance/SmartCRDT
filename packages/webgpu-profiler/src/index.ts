/**
 * @lsi/webgpu-profiler - WebGPU Profiling Tools
 *
 * GPU performance analysis and optimization for browser-based compute
 *
 * @example
 * ```typescript
 * import { ProfilerSuite } from '@lsi/webgpu-profiler';
 *
 * const device = await adapter.requestDevice();
 * const profiler = new ProfilerSuite(device);
 *
 * profiler.startAll();
 * // ... GPU operations ...
 * const report = profiler.stopAll();
 *
 * const html = profiler.reporter.exportAsHTML(report);
 * ```
 */

// Main profiler
export { GPUProfiler } from "./profiler/GPUProfiler.js";

// Re-export GPU types for convenience
export type { GPUDevice, GPUAdapter } from "./types.js";

// Component profilers
export { KernelProfiler } from "./kernel/KernelProfiler.js";
export { MemoryProfiler } from "./memory/MemoryProfiler.js";
export { TransferProfiler } from "./transfer/TransferProfiler.js";
export { UtilizationMonitor } from "./utilization/UtilizationMonitor.js";

// Analysis and visualization
export { BottleneckAnalyzer } from "./bottleneck/BottleneckAnalyzer.js";
export { TimelineView } from "./timeline/TimelineView.js";
export { PerformanceReport } from "./report/PerformanceReport.js";

// Integration
export {
  ProfilerSuite,
  DevToolsIntegration,
  VLJEPAProfiling,
  createDevToolsIntegration,
  createVLJEPAProfiling,
} from "./integration.js";

// Types
export type {
  // Core types
  MetricType,
  ProfileScope,
  MetricUnit,
  BottleneckCategory,
  BottleneckSeverity,
  OptimizationCategory,
  // Data structures
  PerformanceMetric,
  KernelExecution,
  MemoryAllocation,
  TransferRecord,
  FrameProfile,
  Bottleneck,
  OptimizationSuggestion,
  TimelineEvent,
  // Configuration
  ProfilerConfig,
  ProfileReport,
  ComparisonReport,
  GPUInfo,
  ProfiledGPUDevice,
  ProfilerSession,
  // Export types
  ExportFormat,
  ExportOptions,
  // Analysis types
  Statistics,
  Histogram,
  HistogramBin,
  UtilizationSample,
  ResourceSnapshot,
} from "./types.js";

// Create default config for external use
export const DEFAULT_PROFILER_CONFIG = {
  samplingRate: 0,
  bufferSize: 10000,
  autoAnalyze: true,
  enabledScopes: ["kernel", "memory", "transfer", "frame"] as const,
  minDurationThreshold: 1000,
  trackMemory: true,
  trackTransfers: true,
  useGPUTimestamps: true,
};
