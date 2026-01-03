/**
 * @lsi/webgpu-profiler - WebGPU Profiling Tools
 *
 * Types for GPU performance analysis and optimization
 */

/**
 * Metric types for GPU profiling
 */
export type MetricType = "timing" | "memory" | "throughput" | "utilization";

/**
 * Scopes for profiling operations
 */
export type ProfileScope = "kernel" | "memory" | "transfer" | "frame";

/**
 * Units for metric measurements
 */
export type MetricUnit =
  | "ms"
  | "ns"
  | "bytes"
  | "MB"
  | "GB"
  | "GB/s"
  | "%"
  | "ops/s"
  | "ops"
  | "W"
  | "C";

/**
 * Categories of performance bottlenecks
 */
export type BottleneckCategory =
  | "compute-bound"
  | "memory-bound"
  | "transfer-bound"
  | "latency-bound"
  | "synchronization"
  | "resource-contention"
  | "insufficient-parallelism";

/**
 * Severity levels for bottlenecks
 */
export type BottleneckSeverity = "low" | "medium" | "high" | "critical";

/**
 * Optimization suggestion categories
 */
export type OptimizationCategory =
  | "kernel-optimization"
  | "memory-layout"
  | "transfer-reduction"
  | "workgroup-size"
  | "memory-coalescing"
  | "pipeline-optimization"
  | "resource-management"
  | "insufficient-parallelism";

/**
 * GPU types from WebGPU API (browser-provided)
 * These are declared here for TypeScript compatibility
 */
export interface GPUDevice {
  queue: GPUQueue;
  lost: Promise<GPULostContext>;
  destroy(): void;
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
  createBindGroupLayout(
    descriptor: GPUBindGroupLayoutDescriptor
  ): GPUBindGroupLayout;
  createPipelineLayout(
    descriptor: GPUPipelineLayoutDescriptor
  ): GPUPipelineLayout;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createComputePipeline(
    descriptor: GPUComputePipelineDescriptor
  ): GPUComputePipeline;
  createRenderPipeline(
    descriptor: GPURenderPipelineDescriptor
  ): GPURenderPipeline;
  createRenderBundleEncoder(
    descriptor: GPURenderBundleEncoderDescriptor
  ): GPURenderBundleEncoder;
  createQuerySet(descriptor: GPUQuerySetDescriptor): GPUQuerySet;
  importExternalTexture(
    descriptor: GPUExternalTextureDescriptor
  ): GPUExternalTexture;
  adapter?: GPUAdapter;
}

export interface GPUAdapter {
  info: GPUAdapterInfo;
  requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
}

interface GPUAdapterInfo {
  vendor: string;
  architecture: string;
  description: string;
  vendorId: number;
  deviceId: number;
}

interface GPUQueue {
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

// Placeholder types for WebGPU interfaces (not exhaustive)
type GPUBuffer = unknown;
type GPUTexture = unknown;
type GPUSampler = unknown;
type GPUBindGroupLayout = unknown;
type GPUPipelineLayout = unknown;
type GPUBindGroup = unknown;
type GPUShaderModule = unknown;
type GPUComputePipeline = unknown;
type GPURenderPipeline = unknown;
type GPURenderBundleEncoder = unknown;
type GPUQuerySet = unknown;
type GPUExternalTexture = unknown;
type GPUCommandBuffer = unknown;
type GPULostContext = unknown;
type GPUBufferDescriptor = unknown;
type GPUTextureDescriptor = unknown;
type GPUSamplerDescriptor = unknown;
type GPUBindGroupLayoutDescriptor = unknown;
type GPUPipelineLayoutDescriptor = unknown;
type GPUBindGroupDescriptor = unknown;
type GPUShaderModuleDescriptor = unknown;
type GPUComputePipelineDescriptor = unknown;
type GPURenderPipelineDescriptor = unknown;
type GPURenderBundleEncoderDescriptor = unknown;
type GPUQuerySetDescriptor = unknown;
type GPUExternalTextureDescriptor = unknown;
type GPUDeviceDescriptor = unknown;

/**
 * A single performance metric measurement
 */
export interface PerformanceMetric {
  /** Metric name/identifier */
  name: string;
  /** Metric type */
  type: MetricType;
  /** Current value */
  value: number;
  /** Unit of measurement */
  unit: MetricUnit;
  /** Minimum observed value */
  min: number;
  /** Maximum observed value */
  max: number;
  /** Average value */
  avg: number;
  /** Standard deviation */
  stdDev?: number;
  /** Sample count */
  sampleCount: number;
  /** Timestamp of first sample */
  firstSample: number;
  /** Timestamp of last sample */
  lastSample: number;
}

/**
 * Kernel execution record
 */
export interface KernelExecution {
  /** Execution identifier */
  id: string;
  /** Kernel name/identifier */
  name: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Duration in nanoseconds */
  duration: number;
  /** Workgroup size used */
  workgroupSize?: [number, number, number];
  /** Dispatch dimensions */
  dispatchSize: [number, number, number];
  /** GPU device timestamp (if available) */
  gpuTimestamp?: bigint;
  /** Thread ID for parallel tracking */
  threadId?: string;
}

/**
 * Memory allocation record
 */
export interface MemoryAllocation {
  /** Allocation identifier */
  id: string;
  /** Allocation type */
  type: "buffer" | "texture" | "sampler" | "bind-group" | "pipeline";
  /** Size in bytes */
  size: number;
  /** Usage flags */
  usage: string[];
  /** Allocation timestamp */
  timestamp: number;
  /** Whether allocation was freed */
  freed: boolean;
  /** Free timestamp (if freed) */
  freeTimestamp?: number;
  /** Lifetime duration (if freed) */
  lifetime?: number;
  /** Memory pool identifier */
  poolId?: string;
}

/**
 * Data transfer record
 */
export interface TransferRecord {
  /** Transfer identifier */
  id: string;
  /** Transfer direction */
  direction: "host-to-device" | "device-to-host" | "device-to-device";
  /** Size in bytes */
  size: number;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Duration in nanoseconds */
  duration: number;
  /** Calculated bandwidth (GB/s) */
  bandwidth: number;
  /** Source buffer */
  source?: string;
  /** Destination buffer */
  destination?: string;
  /** Whether transfer was async */
  async: boolean;
}

/**
 * Frame profiling data
 */
export interface FrameProfile {
  /** Frame number */
  frameNumber: number;
  /** Frame start timestamp */
  startTime: number;
  /** Frame end timestamp */
  endTime: number;
  /** Total frame duration */
  duration: number;
  /** Kernel executions in frame */
  kernels: KernelExecution[];
  /** Memory allocations in frame */
  allocations: MemoryAllocation[];
  /** Transfers in frame */
  transfers: TransferRecord[];
  /** Frame metadata */
  metadata: Record<string, unknown>;
}

/**
 * Bottleneck analysis result
 */
export interface Bottleneck {
  /** Bottleneck category */
  category: BottleneckCategory;
  /** Severity level */
  severity: BottleneckSeverity;
  /** Bottleneck description */
  description: string;
  /** Affected component(s) */
  affectedComponent: string[];
  /** Impact on performance (percentage) */
  impact: number;
  /** Evidence/supporting metrics */
  evidence: PerformanceMetric[];
  /** Optimization suggestions */
  suggestions: OptimizationSuggestion[];
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  /** Suggestion category */
  category: OptimizationCategory;
  /** Suggestion title */
  title: string;
  /** Detailed description */
  description: string;
  /** Expected improvement (percentage) */
  expectedImprovement: number;
  /** Implementation effort (low/medium/high) */
  effort: "low" | "medium" | "high";
  /** Code snippet reference (if applicable) */
  codeReference?: string;
  /** Priority */
  priority: number;
}

/**
 * Timeline event for visualization
 */
export interface TimelineEvent {
  /** Event type */
  type: "kernel" | "memory" | "transfer" | "synchronization";
  /** Event identifier */
  id: string;
  /** Event name/title */
  name: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Duration */
  duration: number;
  /** Thread/stream identifier */
  threadId?: string;
  /** Event color (for visualization) */
  color?: string;
  /** Associated metadata */
  metadata: Record<string, unknown>;
}

/**
 * Profiler configuration
 */
export interface ProfilerConfig {
  /** Sampling rate in Hz (0 = continuous) */
  samplingRate: number;
  /** Maximum buffer size for samples */
  bufferSize: number;
  /** Whether to automatically analyze bottlenecks */
  autoAnalyze: boolean;
  /** Which scopes to profile */
  enabledScopes: ProfileScope[];
  /** Minimum duration threshold for recording (ns) */
  minDurationThreshold: number;
  /** Whether to track memory allocations */
  trackMemory: boolean;
  /** Whether to track transfers */
  trackTransfers: boolean;
  /** Whether to use GPU timestamps */
  useGPUTimestamps: boolean;
  /** Timestamp period (from device) */
  timestampPeriod?: number;
  /** Custom event handlers */
  onKernelComplete?: (execution: KernelExecution) => void;
  onMemoryAllocate?: (allocation: MemoryAllocation) => void;
  onTransferComplete?: (transfer: TransferRecord) => void;
  onBottleneckDetected?: (bottleneck: Bottleneck) => void;
}

/**
 * Complete profiling report
 */
export interface ProfileReport {
  /** Report identifier */
  id: string;
  /** Report generation timestamp */
  timestamp: number;
  /** Session start timestamp */
  sessionStart: number;
  /** Session duration */
  sessionDuration: number;
  /** Collected metrics */
  metrics: PerformanceMetric[];
  /** Kernel execution summary */
  kernelSummary: {
    totalKernels: number;
    totalDuration: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    slowestKernels: KernelExecution[];
  };
  /** Memory summary */
  memorySummary: {
    totalAllocated: number;
    peakMemory: number;
    currentMemory: number;
    allocationCount: number;
    leakCount: number;
  };
  /** Transfer summary */
  transferSummary: {
    totalTransfers: number;
    totalBytes: number;
    avgBandwidth: number;
    maxBandwidth: number;
    totalTransferTime: number;
  };
  /** Identified bottlenecks */
  bottlenecks: Bottleneck[];
  /** Optimization suggestions */
  optimizations: OptimizationSuggestion[];
  /** Timeline data */
  timeline: TimelineEvent[];
  /** Raw frame data (optional) */
  frames?: FrameProfile[];
  /** Report metadata */
  metadata: Record<string, unknown>;
}

/**
 * Comparison report for before/after analysis
 */
export interface ComparisonReport {
  /** Before snapshot */
  before: ProfileReport;
  /** After snapshot */
  after: ProfileReport;
  /** Metric comparisons */
  comparisons: {
    metric: string;
    before: number;
    after: number;
    change: number;
    changePercent: number;
    improved: boolean;
  }[];
  /** Overall improvement percentage */
  overallImprovement: number;
  /** Key improvements */
  keyImprovements: string[];
  /** Regressions */
  regressions: string[];
}

/**
 * GPU information
 */
export interface GPUInfo {
  /** GPU adapter name */
  name: string;
  /** GPU vendor */
  vendor: string;
  /** Architecture/driver description */
  architecture?: string;
  /** Device description */
  description?: string;
  /** GPU vendor ID */
  vendorId?: number;
  /** GPU device ID */
  deviceId?: number;
}

/**
 * WebGPU device wrapper for profiling
 */
export interface ProfiledGPUDevice {
  /** Original device */
  device: GPUDevice;
  /** GPU info */
  info: GPUInfo;
  /** Active profiler session */
  session?: ProfilerSession;
  /** Whether profiling is enabled */
  profilingEnabled: boolean;
  /** Timestamp multiplier for converting GPU timestamps to nanoseconds */
  timestampMultiplier: number;
}

/**
 * Active profiling session
 */
export interface ProfilerSession {
  /** Session identifier */
  id: string;
  /** Device being profiled */
  device: ProfiledGPUDevice;
  /** Session start timestamp */
  startTime: number;
  /** Session configuration */
  config: ProfilerConfig;
  /** Collected frames */
  frames: FrameProfile[];
  /** Current frame being built */
  currentFrame?: Partial<FrameProfile>;
  /** Active kernel executions */
  activeKernels: Map<string, KernelExecution>;
  /** Active transfers */
  activeTransfers: Map<string, TransferRecord>;
  /** Memory allocations by ID */
  allocations: Map<string, MemoryAllocation>;
  /** Collected metrics */
  metrics: Map<string, PerformanceMetric>;
  /** Whether session is active */
  active: boolean;
}

/**
 * Export format options
 */
export type ExportFormat = "json" | "csv" | "html" | "markdown";

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Whether to include raw data */
  includeRawData: boolean;
  /** Whether to include timeline */
  includeTimeline: boolean;
  /** Whether to include bottlenecks */
  includeBottlenecks: boolean;
  /** Whether to include optimization suggestions */
  includeOptimizations: boolean;
  /** Custom filename (without extension) */
  filename?: string;
}

/**
 * Statistics for a set of values
 */
export interface Statistics {
  /** Count of samples */
  count: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Mean value */
  mean: number;
  /** Median value */
  median: number;
  /** Standard deviation */
  stdDev: number;
  /** Variance */
  variance: number;
  /** Percentiles */
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

/**
 * Histogram bin
 */
export interface HistogramBin {
  /** Bin start value */
  start: number;
  /** Bin end value */
  end: number;
  /** Count of values in bin */
  count: number;
  /** Percentage of total */
  percentage: number;
}

/**
 * Histogram data
 */
export interface Histogram {
  /** Metric name */
  metric: string;
  /** Bins */
  bins: HistogramBin[];
  /** Total count */
  totalCount: number;
  /** Bin width */
  binWidth: number;
}

/**
 * Utilization sample
 */
export interface UtilizationSample {
  /** Timestamp */
  timestamp: number;
  /** Compute utilization (0-100) */
  compute: number;
  /** Memory bandwidth utilization (0-100) */
  memoryBandwidth: number;
  /** Power consumption (Watts, if available) */
  power?: number;
  /** Temperature (Celsius, if available) */
  temperature?: number;
}

/**
 * Resource usage snapshot
 */
export interface ResourceSnapshot {
  /** Timestamp */
  timestamp: number;
  /** Buffer memory used (bytes) */
  bufferMemoryUsed: number;
  /** Texture memory used (bytes) */
  textureMemoryUsed: number;
  /** Total memory used (bytes) */
  totalMemoryUsed: number;
  /** Active pipelines */
  activePipelines: number;
  /** Active bind groups */
  activeBindGroups: number;
  /** Pending commands */
  pendingCommands: number;
}
