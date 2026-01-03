/**
 * @lsi/webgpu-multi - WebGPU Multi-GPU Support
 *
 * Multi-GPU orchestration, work distribution, and synchronization
 * for browser-based compute applications.
 *
 * @packageDocumentation
 */

// Core types
export type {
  GPUDevice,
  DeviceSelection,
  WorkDistribution,
  SyncStrategy,
  MultiGPUConfig,
  GPUDeviceInfo,
  WorkTask,
  TaskAssignment,
  DataDistribution,
  SyncPoint,
  CollectiveOperation,
  CollectiveConfig,
  LoadBalancerConfig,
  GPUSelectionCriteria,
  MultiGPUResult,
  MultiGPUStats,
  PipelineStage,
  PipelineConfig,
  DeviceMemoryPool,
  PeerAccessInfo,
} from "./types.js";

// Device Manager
export { DeviceManager, defaultDeviceManager } from "./DeviceManager.js";

// Work Distributor
export { WorkDistributor, defaultWorkDistributor } from "./WorkDistributor.js";

// Sync Manager
export { SyncManager, defaultSyncManager } from "./SyncManager.js";

// Data Distributor
export { DataDistributor, defaultDataDistributor } from "./DataDistributor.js";

// Load Balancer
export { LoadBalancer, defaultLoadBalancer } from "./LoadBalancer.js";

// Multi-GPU Executor
export {
  MultiGPUExecutor,
  defaultMultiGPUExecutor,
} from "./MultiGPUExecutor.js";

// GPU Selector
export { GPUSelector, defaultGPUSelector } from "./GPUSelector.js";

// Integration Layer
export {
  MultiGPUVLJEPAInference,
  MultiGPUBatchProcessor,
  ModelParallelProcessor,
  createMultiGPUInference,
  quickMultiGPUInference,
} from "./integration.js";

export type { MultiGPUInferenceConfig } from "./integration.js";

/**
 * Quick start example:
 *
 * ```typescript
 * import { createMultiGPUInference } from '@lsi/webgpu-multi';
 *
 * // Create multi-GPU inference system
 * const inference = await createMultiGPUInference({
 *   gpuCount: 2,
 *   distribution: 'data-parallel',
 * });
 *
 * // Run inference on multiple GPUs
 * const results = await inference.runInference(frames, async (frame, device) => {
 *   // Your inference logic here
 *   return processFrame(frame);
 * });
 *
 * // Cleanup
 * inference.cleanup();
 * ```
 */
