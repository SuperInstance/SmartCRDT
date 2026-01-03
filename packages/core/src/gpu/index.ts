/**
 * GPU Optimization Module
 *
 * Exports all GPU-accelerated operations for embedding computations.
 * Provides WebGPU/WebGL compute with automatic fallback to CPU/SIMD.
 *
 * @packageDocumentation
 */

// GPU Device Manager
export { GPUDeviceManager, BufferUsage, TextureFormat } from "./GPUDevice.js";

export type {
  GPUBackend,
  GPUConfig,
  GPUInfo,
  GPULimits,
  GPUFeatures,
} from "./GPUDevice.js";

// GPU Vector Operations
export { GPUVectorOps } from "./GPUVectorOps.js";

export type { GPUBenchmarkResult, BatchCompareResult } from "./GPUVectorOps.js";

// GPU Embedding Operations
export { GPUEmbeddingOps } from "./GPUEmbeddingOps.js";

export type {
  MatrixPair,
  NeighborResult,
  GPUOperation,
  GPUBenchmarkResult as GPUEmbeddingBenchmarkResult,
} from "./GPUEmbeddingOps.js";

/**
 * Create GPU vector operations with default configuration
 */
export async function createGPUVectorOps(
  config?: Partial<{
    preferred_backend: "webgpu" | "webgl" | "cpu";
    fallback_enabled: boolean;
    memory_limit: number;
    compute_mode: "float32" | "float16";
  }>
) {
  const device = new (await import("./GPUDevice.js")).GPUDeviceManager(config);
  await device.initialize();
  const vecOps = new (await import("./GPUVectorOps.js")).GPUVectorOps(device);
  await vecOps.init();
  return vecOps;
}

/**
 * Create GPU embedding operations with default configuration
 */
export async function createGPUEmbeddingOps(
  config?: Partial<{
    preferred_backend: "webgpu" | "webgl" | "cpu";
    fallback_enabled: boolean;
    memory_limit: number;
    compute_mode: "float32" | "float16";
  }>
) {
  const device = new (await import("./GPUDevice.js")).GPUDeviceManager(config);
  await device.initialize();
  const vecOps = new (await import("./GPUVectorOps.js")).GPUVectorOps(device);
  await vecOps.init();
  const embOps = new (await import("./GPUEmbeddingOps.js")).GPUEmbeddingOps(
    device,
    vecOps
  );
  await embOps.init();
  return embOps;
}
