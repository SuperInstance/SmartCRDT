/**
 * VL-JEPA Optimization Package
 * Target: Sub-50ms inference latency on edge devices
 */

// Profilers
export {
  Profiler,
  ProfilerState,
  BottleneckAnalyzer,
} from "./profilers/Profiler.js";
export {
  BottleneckAnalyzer as BottleneckAnalyzerDetailed,
  BottleneckReport,
  MemoryProfiler,
} from "./profilers/BottleneckAnalyzer.js";

// Optimizers
export {
  GraphOptimizer,
  FusionAnalyzer,
  type ComputationGraph,
  type GraphNodeInput,
  type FusionOpportunity,
} from "./optimizers/GraphOptimizer.js";
export { MemoryOptimizer } from "./optimizers/MemoryOptimizer.js";

// Memory
export {
  BufferPool,
  TensorPool,
  MemoryArena,
  HierarchicalPoolManager,
  type Tensor,
  type ArenaAllocation,
} from "./memory/BufferPool.js";

// Batching
export {
  DynamicBatcher,
  StaticBatchStrategy,
  PriorityBatchStrategy,
  DeadlineBatchStrategy,
  RequestBatcher,
  type BatcherStats,
  type RequestBatcherStats,
} from "./batching/DynamicBatcher.js";

// Caching
export {
  ResultCache,
  EmbeddingCache,
  KernelCache,
  HierarchicalCache,
  type CompiledKernel,
} from "./caching/ResultCache.js";

// Tuning
export { AutoTuner, DeviceTuner, WorkgroupTuner } from "./tuning/AutoTuner.js";

// Types
export * from "./types.js";
