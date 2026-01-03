/**
 * @lsi/webgpu-compute/types - WebGPU Compute Shaders Type Definitions
 *
 * Core type definitions for GPU-accelerated compute operations.
 * Provides interfaces for shader management, buffer handling, and compute operations.
 *
 * @version 1.0.0
 */

// ============================================================================
// WEBGPU ENUM TYPES
// ============================================================================

/**
 * Shader stage types
 */
export type ShaderStage = "compute" | "vertex" | "fragment";

/**
 * Buffer usage types for WebGPU
 */
export type BufferType =
  | "storage"
  | "uniform"
  | "vertex"
  | "index"
  | "indirect"
  | "query-resolve";

/**
 * Buffer storage types
 */
export type BufferStorageType = "read" | "read-write" | "uniform";

/**
 * Data types for compute operations
 */
export type ComputeDataType =
  | "float32"
  | "float16"
  | "int32"
  | "int16"
  | "int8"
  | "uint32"
  | "uint16"
  | "uint8";

// ============================================================================
// WORKGROUP AND DISPATCH TYPES
// ============================================================================

/**
 * Workgroup size for compute shaders
 *
 * Defines the number of workgroups to dispatch for a compute operation.
 * WebGPU supports up to 3 dimensions (x, y, z).
 */
export interface WorkgroupSize {
  /** X dimension (required) */
  x: number;
  /** Y dimension (optional, default: 1) */
  y?: number;
  /** Z dimension (optional, default: 1) */
  z?: number;
}

/**
 * Dispatch configuration for compute operations
 *
 * Configures how a compute shader should be dispatched on the GPU.
 */
export interface DispatchConfig {
  /** Number of workgroups in each dimension */
  workgroupCount: WorkgroupSize;
  /** Buffer sizes in bytes for each binding */
  bufferSizes?: number[];
  /** Workgroup size (must match shader @workgroup_size) */
  workgroupSize?: WorkgroupSize;
  /** Optional dispatch label for debugging */
  label?: string;
}

// ============================================================================
// SHADER TYPES
// ============================================================================

/**
 * Compute shader module wrapper
 *
 * Represents a compiled WebGPU compute shader module.
 */
export interface ComputeShader {
  /** WebGPU shader module */
  module: GPUShaderModule;
  /** Shader source code (WGSL) */
  code: string;
  /** Shader entry point function name */
  entryPoint: string;
  /** Shader label for debugging */
  label: string;
  /** Shader compilation info */
  compilationInfo?: GPUCompilationInfo;
}

/**
 * Compute pipeline configuration
 *
 * Defines the pipeline layout and shader for a compute operation.
 */
export interface ComputePipeline {
  /** Compute shader module */
  shader: ComputeShader;
  /** Pipeline layout (bind group layouts) */
  layout: GPUPipelineLayout | "auto";
  /** Bind group layout */
  bindGroupLayout: GPUBindGroupLayout;
  /** Compute pipeline */
  pipeline: GPUComputePipeline;
  /** Pipeline label for debugging */
  label?: string;
}

/**
 * Bind group configuration
 *
 * Defines how buffers are bound to a compute shader.
 */
export interface BindGroupConfig {
  /** Buffer bindings */
  bindings: Array<{
    /** Binding index */
    binding: number;
    /** GPU buffer */
    buffer: GPUBuffer;
    /** Buffer offset in bytes */
    offset?: number;
    /** Buffer size in bytes (optional, defaults to full buffer) */
    size?: number;
    /** Buffer visibility (compute, vertex, fragment) */
    visibility?: GPUShaderStageFlags;
  }>;
  /** Bind group label */
  label?: string;
}

// ============================================================================
// BUFFER TYPES
// ============================================================================

/**
 * Buffer creation options
 */
export interface BufferOptions {
  /** Buffer usage flags */
  usage: GPUBufferUsageFlags;
  /** Buffer size in bytes */
  size: number;
  /** Buffer label for debugging */
  label?: string;
  /** Whether to map at creation time */
  mappedAtCreation?: boolean;
  /** Buffer storage type */
  storageType?: BufferStorageType;
  /** Data type for typed arrays */
  dataType?: ComputeDataType;
}

/**
 * Buffer view for partial buffer operations
 */
export interface BufferView {
  /** GPU buffer */
  buffer: GPUBuffer;
  /** Offset in bytes */
  offset: number;
  /** Size in bytes */
  size: number;
}

/**
 * Buffer pool entry for buffer reuse
 */
export interface BufferPoolEntry {
  /** GPU buffer */
  buffer: GPUBuffer;
  /** Buffer size in bytes */
  size: number;
  /** Buffer usage flags */
  usage: GPUBufferUsageFlags;
  /** Last used timestamp */
  lastUsed: number;
  /** Whether buffer is currently in use */
  inUse: boolean;
  /** Buffer label */
  label?: string;
}

// ============================================================================
// COMPUTE OPERATION TYPES
// ============================================================================

/**
 * Compute operation result
 *
 * Result from executing a compute shader on the GPU.
 */
export interface ComputeResult {
  /** Whether operation was successful */
  success: boolean;
  /** Output data (if successful) */
  data?: Float32Array | Uint8Array | Int32Array;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Error message (if failed) */
  error?: string;
  /** Additional metadata */
  metadata?: {
    /** Number of workgroups dispatched */
    workgroupsDispatched?: number;
    /** Buffer read time */
    readTime?: number;
    /** Buffer write time */
    writeTime?: number;
  };
}

/**
 * Compute operation configuration
 */
export interface ComputeOperationConfig {
  /** Compute pipeline to use */
  pipeline: ComputePipeline;
  /** Bind groups for the operation */
  bindGroups: GPUBindGroup[];
  /** Dispatch configuration */
  dispatch: DispatchConfig;
  /** Input buffers */
  inputs?: BufferView[];
  /** Output buffer */
  output?: BufferView;
  /** Whether to read back output */
  readOutput?: boolean;
  /** Operation label */
  label?: string;
}

// ============================================================================
// MATRIX OPERATION TYPES
// ============================================================================

/**
 * Matrix dimensions
 */
export interface MatrixShape {
  /** Number of rows */
  rows: number;
  /** Number of columns */
  cols: number;
}

/**
 * Matrix multiplication configuration
 *
 * Configures a matrix multiplication operation: C = A * B
 */
export interface MatMulConfig extends DispatchConfig {
  /** Left matrix dimensions (M x K) */
  leftMatrix: MatrixShape;
  /** Right matrix dimensions (K x N) */
  rightMatrix: MatrixShape;
  /** Output matrix dimensions (M x N) */
  outputMatrix: MatrixShape;
  /** Whether to use batched multiplication */
  batched?: boolean;
  /** Batch size (if batched) */
  batchSize?: number;
}

/**
 * Matrix transpose configuration
 */
export interface TransposeConfig extends DispatchConfig {
  /** Input matrix dimensions */
  inputShape: MatrixShape;
  /** Output matrix dimensions (swapped) */
  outputShape: MatrixShape;
}

// ============================================================================
// VECTOR OPERATION TYPES
// ============================================================================

/**
 * Vector operation types
 */
export type VectorOpType =
  | "add"
  | "sub"
  | "mul"
  | "div"
  | "dot"
  | "cross"
  | "normalize"
  | "magnitude"
  | "distance"
  | "similarity";

/**
 * Vector operation configuration
 */
export interface VectorOpConfig extends DispatchConfig {
  /** Operation type */
  operation: VectorOpType;
  /** Vector dimension */
  dimension: number;
  /** Number of vectors (for batch operations) */
  numVectors?: number;
}

// ============================================================================
// REDUCTION OPERATION TYPES
// ============================================================================

/**
 * Reduction operation types
 */
export type ReductionOpType =
  | "sum"
  | "min"
  | "max"
  | "argmin"
  | "argmax"
  | "mean"
  | "prod";

/**
 * Reduction configuration
 */
export interface ReductionConfig extends DispatchConfig {
  /** Reduction operation type */
  operation: ReductionOpType;
  /** Input size (number of elements) */
  inputSize: number;
  /** Whether to reduce along a specific dimension */
  reduceAlongAxis?: boolean;
  /** Axis to reduce along (0-based) */
  axis?: number;
}

// ============================================================================
// EMBEDDING OPERATION TYPES
// ============================================================================

/**
 * Embedding similarity metric types
 */
export type SimilarityMetric =
  | "cosine"
  | "euclidean"
  | "manhattan"
  | "dot"
  | "chebyshev";

/**
 * Embedding operation configuration
 */
export interface EmbeddingOpConfig extends DispatchConfig {
  /** Embedding dimension (e.g., 768 for VL-JEPA) */
  embeddingDim: number;
  /** Number of embeddings */
  numEmbeddings?: number;
}

/**
 * Embedding similarity search configuration
 */
export interface SimilaritySearchConfig extends EmbeddingOpConfig {
  /** Query embedding */
  query: Float32Array;
  /** Candidate embeddings */
  candidates: Float32Array[];
  /** Similarity metric */
  metric: SimilarityMetric;
  /** Number of top results to return */
  topK?: number;
  /** Minimum similarity threshold */
  threshold?: number;
}

// ============================================================================
// NEURAL NETWORK OPERATION TYPES
// ============================================================================

/**
 * Activation function types
 */
export type ActivationType =
  | "relu"
  | "gelu"
  | "swish"
  | "sigmoid"
  | "tanh"
  | "softmax"
  | "leaky-relu";

/**
 * Pooling operation types
 */
export type PoolingType = "max" | "avg" | "min";

/**
 * Convolution configuration
 */
export interface ConvConfig extends DispatchConfig {
  /** Input dimensions [batch, height, width, channels] */
  inputShape: [number, number, number, number];
  /** Filter/kernel dimensions [filterHeight, filterWidth, inChannels, outChannels] */
  filterShape: [number, number, number, number];
  /** Stride [height, width] */
  stride: [number, number];
  /** Padding [top, bottom, left, right] */
  padding: [number, number, number, number];
  /** Dilation [height, width] */
  dilation?: [number, number];
}

/**
 * Pooling configuration
 */
export interface PoolConfig extends DispatchConfig {
  /** Input dimensions [batch, height, width, channels] */
  inputShape: [number, number, number, number];
  /** Pooling type */
  poolType: PoolingType;
  /** Kernel size [height, width] */
  kernelSize: [number, number];
  /** Stride [height, width] */
  stride: [number, number];
  /** Padding [top, bottom, left, right] */
  padding: [number, number, number, number];
}

// ============================================================================
// VL-JEPA SPECIFIC TYPES
// ============================================================================

/**
 * VL-JEPA embedding operation types
 */
export type VLJEPAOpType =
  | "embedding-prediction"
  | "attention-compute"
  | "layer-norm"
  | "patch-embedding"
  | "position-embedding"
  | "mlp-forward"
  | "concat-embeddings"
  | "confidence-score";

/**
 * VL-JEPA operation configuration
 *
 * Specialized configuration for VL-JEPA operations.
 */
export interface VLJEPAOpConfig extends DispatchConfig {
  /** VL-JEPA operation type */
  operation: VLJEPAOpType;
  /** Embedding dimension (always 768 for VL-JEPA) */
  embeddingDim: 768;
  /** Sequence length (for attention) */
  seqLen?: number;
  /** Number of attention heads */
  numHeads?: number;
  /** Hidden dimension (for predictor) */
  hiddenDim?: number;
  /** Patch size (for vision encoder) */
  patchSize?: number;
}

// ============================================================================
// STATISTICS AND PROFILING TYPES
// ============================================================================

/**
 * Buffer statistics
 */
export interface BufferStats {
  /** Total number of buffers */
  totalBuffers: number;
  /** Number of pooled buffers */
  pooledBuffers: number;
  /** Number of active buffers */
  activeBuffers: number;
  /** Total memory usage in bytes */
  totalMemory: number;
  /** Pooled memory usage in bytes */
  pooledMemory: number;
  /** Active memory usage in bytes */
  activeMemory: number;
  /** Number of allocations */
  allocations: number;
  /** Number of deallocations */
  deallocations: number;
  /** Pool cache hits */
  poolHits: number;
  /** Pool cache misses */
  poolMisses: number;
}

/**
 * Compute statistics
 */
export interface ComputeStats {
  /** Total compute operations */
  totalOperations: number;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Total execution time in milliseconds */
  totalExecutionTime: number;
  /** Average execution time in milliseconds */
  averageExecutionTime: number;
  /** Total data transferred in bytes */
  totalDataTransferred: number;
  /** Total workgroups dispatched */
  totalWorkgroupsDispatched: number;
}

/**
 * GPU memory info
 */
export interface GPUMemoryInfo {
  /** Total available memory in bytes */
  totalMemory: number;
  /** Used memory in bytes */
  usedMemory: number;
  /** Free memory in bytes */
  freeMemory: number;
  /** Memory usage percentage */
  usagePercentage: number;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * WebGPU Compute Error Types
 */
export class WebGPUComputeError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "WebGPUComputeError";
  }
}

export class ShaderCompilationError extends WebGPUComputeError {
  constructor(
    message: string,
    public compilationInfo?: GPUCompilationInfo
  ) {
    super(message, "SHADER_COMPILATION_ERROR", { compilationInfo });
    this.name = "ShaderCompilationError";
  }
}

export class BufferAllocationError extends WebGPUComputeError {
  constructor(
    message: string,
    public requestedSize: number
  ) {
    super(message, "BUFFER_ALLOCATION_ERROR", { requestedSize });
    this.name = "BufferAllocationError";
  }
}

export class DispatchError extends WebGPUComputeError {
  constructor(
    message: string,
    public dispatchConfig: DispatchConfig
  ) {
    super(message, "DISPATCH_ERROR", { dispatchConfig });
    this.name = "DispatchError";
  }
}

export class DeviceLostError extends WebGPUComputeError {
  constructor(
    message: string,
    public reason?: string
  ) {
    super(message, "DEVICE_LOST_ERROR", { reason });
    this.name = "DeviceLostError";
  }
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * WebGPU context configuration
 */
export interface WebGPUContextConfig {
  /** Requested power preference */
  powerPreference?: "low-power" | "high-performance";
  /** Required features */
  requiredFeatures?: GPUFeatureName[];
  /** Required limits */
  requiredLimits?: Record<string, number>;
  /** Device label */
  label?: string;
  /** Whether to enable adapter tracing */
  enableTracing?: boolean;
}

/**
 * WebGPU device wrapper
 *
 * Wraps a WebGPU device with context for compute operations.
 */
export interface WebGPUContext {
  /** GPU device */
  device: GPUDevice;
  /** GPU adapter */
  adapter: GPUAdapter;
  /** Device queue */
  queue: GPUQueue;
  /** Context configuration */
  config: WebGPUContextConfig;
  /** Whether device is lost */
  isLost: boolean;
  /** Create command encoder */
  createCommandEncoder(label?: string): GPUCommandEncoder;
  /** Submit commands to queue */
  submit(commandBuffers: GPUCommandBuffer[]): void;
  /** Read buffer from GPU */
  readBuffer(buffer: GPUBuffer, size: number): Promise<ArrayBuffer>;
  /** Destroy buffer */
  destroyBuffer(buffer: GPUBuffer): void;
  /** Get device */
  getDevice(): GPUDevice;
  /** Get adapter info */
  getAdapterInfo(): GPUAdapterInfo;
  /** Get memory info */
  getMemoryInfo(): Promise<GPUMemoryInfo>;
  /** Dispose of context */
  dispose(): void;
}
