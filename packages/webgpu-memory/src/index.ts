/**
 * @lsi/webgpu-memory - WebGPU Memory Management
 *
 * Main entry point for the WebGPU memory management package.
 * Exports all public APIs.
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
  // Basic types
  MemoryType,
  BufferUsage,
  // Memory pool types
  MemoryPool,
  FreeBlock,
  Allocation,
  PoolConfig,
  // Memory stats
  MemoryStats,
  SizeHistogram,
  // Allocation types
  AllocatorConfig,
  AllocationResult,
  BufferOptions,
  // Transfer types
  TransferOptions,
  // Memory limits
  MemoryLimitConfig,
  // Profiling types
  ProfileData,
  LeakDetectionResult,
  AgeBreakdown,
  TimelineEntry,
  LifetimeHistogram,
  // Cache types
  CacheEntry,
  EvictionResult,
  // Memory manager types
  MemoryManagerConfig,
  MemoryEvent,
  MemoryHealth,
  GCResult,
  DefragmentationResult,
  DeviceInfo,
  StagingBuffer,
  MemoryBudget,
  PoolStats,
  // Stress test types
  StressTestConfig,
  StressTestResult,
  // Migration types
  MigrationOptions,
  MigrationResult,
} from "./types.js";

// Export values and enums
export {
  // WebGPU types
  GPUDevice,
  GPUBuffer,
  GPUAdapter,
  GPUBufferUsage,
  GPUMapMode,
  // Enums
  MemoryPressure,
  EvictionStrategy,
  PoolStrategy,
  MemoryEventType,
  Alignment,
} from "./types.js";

// ============================================================================
// Memory Manager
// ============================================================================

export { MemoryManager } from "./MemoryManager.js";

// ============================================================================
// Buffer Pool
// ============================================================================

export {
  BufferPool,
  createMultiTypePools,
  HierarchicalPoolManager,
} from "./BufferPool.js";

// ============================================================================
// Memory Allocators
// ============================================================================

export {
  ArenaAllocator,
  StackAllocator,
  PoolAllocator,
  FreeListAllocator,
  AllocatorType,
  AllocatorFactory,
} from "./MemoryAllocator.js";

// ============================================================================
// Buffer Transfer
// ============================================================================

export { BufferTransfer, StreamingUploader } from "./BufferTransfer.js";

// ============================================================================
// Memory Limits
// ============================================================================

export { MemoryLimits, MemoryPressureMonitor } from "./MemoryLimits.js";

// ============================================================================
// Memory Profiler
// ============================================================================

export { MemoryProfiler } from "./MemoryProfiler.js";

export type { MemorySnapshot } from "./MemoryProfiler.js";

// ============================================================================
// Smart Eviction
// ============================================================================

export {
  SmartEviction,
  MultiTierCache,
  PredictiveEviction,
} from "./SmartEviction.js";

// ============================================================================
// Integration
// ============================================================================

export {
  VLJEPAMemoryAllocator,
  CrossContextSharing,
  TempBufferManager,
  NNMemoryLayout,
} from "./integration.js";

export type { TempBuffer } from "./integration.js";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes for human-readable display
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Calculate memory alignment
 */
export function alignUp(size: number, alignment: number): number {
  return Math.ceil(size / alignment) * alignment;
}

/**
 * Check if size is power of 2
 */
export function isPowerOfTwo(size: number): boolean {
  return size > 0 && (size & (size - 1)) === 0;
}

/**
 * Get next power of 2
 */
export function nextPowerOfTwo(size: number): number {
  return Math.pow(2, Math.ceil(Math.log2(size)));
}

/**
 * Calculate buffer size for VL-JEPA embeddings (768-dim float32)
 */
export function getEmbeddingSize(batchSize: number = 1): number {
  return batchSize * 768 * 4; // 768 dimensions * 4 bytes (float32)
}

/**
 * Estimate memory needed for neural network layer
 */
export function estimateLayerMemory(
  inputSize: number,
  outputSize: number,
  batchSize: number = 1
): {
  weights: number;
  activations: number;
  total: number;
} {
  const weights = inputSize * outputSize * 4; // float32
  const activations = batchSize * outputSize * 4; // float32

  return {
    weights,
    activations,
    total: weights + activations,
  };
}

/**
 * Create default memory configuration
 */
export function createDefaultConfig() {
  return {
    defaultMemoryType: "device_local" as MemoryType,
    initialPoolSize: 16 * 1024 * 1024, // 16MB
    maxMemory: 0, // Device limit
    enableAutoDefrag: true,
    defragThreshold: 0.4,
    enableProfiling: true,
    budget: {
      total: 0,
      allocations: 0.6,
      cache: 0.25,
      temporary: 0.1,
      reserve: 0.05,
    },
  };
}

/**
 * Create VL-JEPA memory configuration
 */
export function createVLJEPAConfig() {
  return {
    embeddingDim: 768,
    maxBatchSize: 32,
    tempBufferSize: 16 * 1024 * 1024,
    cacheEmbeddings: true,
    maxCachedEmbeddings: 1000,
  };
}

// ============================================================================
// Version Info
// ============================================================================

export const PACKAGE_NAME = "@lsi/webgpu-memory";
export const PACKAGE_VERSION = "1.0.0";
export const PACKAGE_DESCRIPTION =
  "WebGPU Memory Management - Efficient GPU memory allocation, pooling, and management for Aequor";
