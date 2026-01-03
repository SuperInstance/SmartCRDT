/**
 * VL-JEPA Optimization Package - Core Types
 * Target: Sub-50ms inference latency on edge devices
 */

// ============================================================================
// PROFILER TYPES
// ============================================================================

export interface ProfilerConfig {
  trackMemory: boolean;
  trackGPU: boolean;
  samplingRate: number; // Samples per second
  detailedTraces: boolean;
  enableStackTraces: boolean;
  maxTraceDepth: number;
}

export interface ProfileResult {
  operations: OperationProfile[];
  totalLatency: number; // Total time in ms
  peakMemory: number; // Peak memory in MB
  averageGPUUtilization: number; // 0-1
  bottlenecks: Bottleneck[];
  recommendations: OptimizationRecommendation[];
  metadata: ProfileMetadata;
}

export interface OperationProfile {
  name: string;
  latency: number; // Time in ms
  memory: number; // Memory in MB
  gpu?: number; // GPU utilization 0-1
  percentage: number; // % of total time
  calls: number; // Number of times called
  avgLatency: number; // Average latency per call
  minLatency: number;
  maxLatency: number;
  stdDev: number;
  startTime: number;
  endTime: number;
}

export interface Bottleneck {
  operation: string;
  severity: "low" | "medium" | "high" | "critical";
  impact: number; // Impact on total latency (ms)
  description: string;
  suggestedOptimizations: string[];
}

export interface ProfileMetadata {
  timestamp: number;
  deviceInfo: DeviceInfo;
  modelInfo: ModelInfo;
  inputShape: number[];
  batchSize: number;
  framework: string;
}

export interface DeviceInfo {
  gpuModel: string;
  vram: number; // MB
  computeUnits: number;
  maxFrequency: number; // MHz
  os: string;
  browser?: string;
}

export interface ModelInfo {
  name: string;
  version: string;
  parameters: number;
  quantization: string; // e.g., "int8", "float16"
}

// ============================================================================
// OPTIMIZER TYPES
// ============================================================================

export interface GraphOptimizerConfig {
  fuseOperators: boolean;
  eliminateDeadCode: boolean;
  foldConstants: boolean;
  optimizeLayout: boolean;
  targetLatency: number; // Target: 50ms
  maxIterations: number;
}

export interface GraphOptimizationResult {
  originalLatency: number;
  optimizedLatency: number;
  speedup: number; // Speedup factor
  optimizations: Optimization[];
  graph: OptimizedGraph;
  fusionGroups: FusionGroup[];
}

export interface Optimization {
  type: OptimizationType;
  description: string;
  impact: number; // Latency reduction in ms
  confidence: number; // 0-1
}

export type OptimizationType =
  | "operator_fusion"
  | "dead_code_elimination"
  | "constant_folding"
  | "layout_transformation"
  | "in_place_operation"
  | "tensor_fusion"
  | "buffer_pooling"
  | "kernel_optimization"
  | "batching"
  | "caching";

export interface OptimizedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphMetadata;
}

export interface GraphNode {
  id: string;
  type: string;
  inputs: string[];
  outputs: string[];
  attributes: Record<string, unknown>;
  fused?: string[]; // IDs of fused ops
}

export interface GraphEdge {
  source: string;
  target: string;
  tensorShape: number[];
  dataType: string;
}

export interface GraphMetadata {
  originalNodes: number;
  optimizedNodes: number;
  reduction: number; // % reduction
}

export interface FusionGroup {
  operations: string[];
  estimatedSpeedup: number;
  memorySaved: number; // MB
}

// ============================================================================
// MEMORY OPTIMIZER TYPES
// ============================================================================

export interface MemoryOptimizerConfig {
  inPlaceOps: boolean;
  tensorFusion: boolean;
  bufferPooling: boolean;
  targetMemory: number; // Target memory usage (MB)
  aggressiveCleanup: boolean;
}

export interface MemoryOptimizationResult {
  originalMemory: number;
  optimizedMemory: number;
  reduction: number; // % reduction
  optimizations: Optimization[];
  allocationStrategy: AllocationStrategy;
}

export interface AllocationStrategy {
  type: "static" | "dynamic" | "arena";
  pools: BufferPoolSpec[];
  reusePolicy: ReusePolicy;
}

export interface BufferPoolSpec {
  size: number; // Buffer size in bytes
  count: number; // Number of buffers
  growStrategy: GrowStrategy;
}

export type GrowStrategy = "double" | "linear" | "on_demand" | "fixed";

export type ReusePolicy = "lru" | "fifo" | "priority" | "smart";

// ============================================================================
// BUFFER POOL TYPES
// ============================================================================

export interface BufferPoolConfig {
  initialSize: number; // Number of buffers
  bufferSize: number; // Size per buffer in bytes
  growStrategy: GrowStrategy;
  shrinkStrategy: ShrinkStrategy;
  maxSize?: number; // Max pool size
}

export type ShrinkStrategy = "never" | "idle" | "aggressive" | "adaptive";

export interface BufferPool {
  acquire(): GPUBuffer | Promise<GPUBuffer>;
  release(buffer: GPUBuffer): void;
  stats(): PoolStats;
  clear(): void;
  resize(size: number): void;
}

export interface PoolStats {
  totalBuffers: number;
  availableBuffers: number;
  acquiredBuffers: number;
  totalAllocations: number;
  totalReleases: number;
  hitRate: number; // 0-1
  memoryUsage: number; // MB
  peakUsage: number; // MB
}

// ============================================================================
// BATCHING TYPES
// ============================================================================

export interface BatcherConfig {
  maxBatchSize: number;
  maxWaitTime: number; // ms
  minBatchSize: number;
  adaptive: boolean;
  priority: boolean;
}

export interface BatchResult {
  batch: InputBatch;
  latency: number; // Time to form batch (ms)
  efficiency: number; // 0-1, higher is better
  batchSize: number;
  requestsProcessed: number;
  requestsDropped: number;
}

export interface InputBatch {
  inputs: unknown[];
  ids: string[];
  timestamps: number[];
  priorities: number[];
}

export interface BatchingStrategy {
  shouldBatch(request: BatchRequest): boolean;
  createBatch(requests: BatchRequest[]): InputBatch;
  estimateWaitTime(currentSize: number): number;
}

export interface BatchRequest {
  id: string;
  input: unknown;
  priority: number;
  timestamp: number;
  timeout: number;
}

// ============================================================================
// CACHING TYPES
// ============================================================================

export interface ResultCacheConfig {
  maxSize: number; // Number of entries
  similarityThreshold: number; // For semantic matching (0-1)
  ttl: number; // Time to live (ms)
  persistent: boolean; // Persist across sessions
  compression: boolean;
}

export interface ResultCache {
  get(key: string): CacheEntry | null;
  set(key: string, value: Float32Array): void;
  has(key: string): boolean;
  invalidate(key: string): void;
  clear(): void;
  stats(): CacheStats;
  findSimilar(embedding: Float32Array): CacheEntry[];
}

export interface CacheEntry {
  key: string;
  embedding: Float32Array;
  timestamp: number;
  hits: number;
  size: number;
  ttl: number;
}

export interface CacheStats {
  size: number; // Current entries
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number; // 0-1
  evictions: number;
  memoryUsage: number; // MB
}

// ============================================================================
// AUTO TUNER TYPES
// ============================================================================

export interface AutoTunerConfig {
  parameters: TunableParameter[];
  searchStrategy: SearchStrategy;
  maxIterations: number;
  targetMetric: TargetMetric;
  convergenceThreshold: number;
  timeout: number; // ms
}

export type SearchStrategy = "grid" | "random" | "bayesian" | "evolutionary";

export type TargetMetric = "latency" | "memory" | "throughput" | "energy";

export interface TunableParameter {
  name: string;
  min: number;
  max: number;
  step: number;
  type: "discrete" | "continuous";
  current: number;
}

export interface TuningResult {
  bestParameters: Record<string, number>;
  bestMetric: number;
  iterations: number;
  convergence: boolean;
  history: TuningIteration[];
  duration: number; // ms
}

export interface TuningIteration {
  iteration: number;
  parameters: Record<string, number>;
  metric: number;
  timestamp: number;
}

// ============================================================================
// SCHEDULER TYPES
// ============================================================================

export interface SchedulerConfig {
  maxConcurrentOps: number;
  prioritizeMemoryOps: boolean;
  enablePipelining: boolean;
  overlapComputeTransfer: boolean;
}

export interface ScheduleResult {
  operations: ScheduledOp[];
  estimatedLatency: number;
  estimatedMemory: number;
  parallelism: number;
}

export interface ScheduledOp {
  name: string;
  startTime: number;
  duration: number;
  dependencies: string[];
  pipelineStage?: number;
}

// ============================================================================
// KERNEL TYPES
// ============================================================================

export interface KernelSpec {
  name: string;
  source: string;
  workgroupSize: [number, number, number];
  bindings: KernelBinding[];
  specialization: string;
}

export interface KernelBinding {
  binding: number;
  type: "uniform" | "storage" | "read-only-storage";
  access: "read" | "write" | "read-write";
}

export interface CompiledKernel {
  module: GPUShaderModule;
  pipeline: GPUComputePipeline;
  workgroupSize: [number, number, number];
  bindGroupLayout: GPUBindGroupLayout;
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

export interface PerformanceMetrics {
  latency: LatencyMetrics;
  memory: MemoryMetrics;
  throughput: ThroughputMetrics;
  utilization: UtilizationMetrics;
}

export interface LatencyMetrics {
  total: number; // Total inference time (ms)
  xEncoder: number; // X-Encoder time (ms)
  yEncoder: number; // Y-Encoder time (ms)
  predictor: number; // Predictor time (ms)
  postprocessing: number; // Postprocessing time (ms)
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface MemoryMetrics {
  peak: number; // MB
  average: number; // MB
  allocations: number;
  deallocations: number;
  fragmentation: number; // 0-1
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  batchesPerSecond: number;
  tokensPerSecond: number;
}

export interface UtilizationMetrics {
  gpu: number; // 0-1
  memory: number; // 0-1
  compute: number; // 0-1
}

// ============================================================================
// OPTIMIZATION RECOMMENDATIONS
// ============================================================================

export interface OptimizationRecommendation {
  priority: "low" | "medium" | "high" | "critical";
  category: OptimizationType;
  title: string;
  description: string;
  expectedImpact: number; // ms reduction
  effort: "trivial" | "easy" | "medium" | "hard";
  implementation: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class OptimizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OptimizationError";
  }
}

export class ProfilerError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ProfilerError";
  }
}

export class TuningError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TuningError";
  }
}
