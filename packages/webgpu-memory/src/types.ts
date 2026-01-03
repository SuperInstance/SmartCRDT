/**
 * @lsi/webgpu-memory - Type Definitions
 *
 * Core types for WebGPU memory management, including memory types,
 * buffer usage flags, pools, allocations, and statistics.
 */

// WebGPU type stubs (for when @webgpu/types is not available)
export interface GPUDevice {
  createBuffer(descriptor: {
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
  }): GPUBuffer;
  limits: any;
  queue: GPUQueue;
  createCommandEncoder(): GPUCommandEncoder;
}

export interface GPUBuffer {
  size: number;
  usage: number;
  destroy(): void;
  mapAsync(mode: number, offset?: number, size?: number): Promise<void>;
  getMappedRange(offset?: number, size?: number): ArrayBuffer;
  unmap(): void;
}

export interface GPUAdapter {
  limits: any;
  requestAdapterInfo(): Promise<any>;
}

export interface GPUQueue {
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: number,
    data: ArrayBufferView | ArrayBuffer,
    dataOffset?: number,
    size?: number
  ): void;
  submit(commandBuffers: GPUCommandBuffer[]): void;
}

export interface GPUCommandEncoder {
  copyBufferToBuffer(
    srcBuffer: GPUBuffer,
    srcOffset: number,
    dstBuffer: GPUBuffer,
    dstOffset: number,
    size: number
  ): void;
  finish(): GPUCommandBuffer;
}

export interface GPUCommandBuffer {}

// WebGPU constants
export const GPUBufferUsage = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200,
};

export const GPUMapMode = {
  READ: 0x0001,
  WRITE: 0x0002,
};

/**
 * Memory type classification for WebGPU buffers
 *
 * - device_local: Fast GPU access, no CPU access (optimal for GPU-only data)
 * - host_visible: CPU visible, may need explicit flush
 * - host_coherent: CPU writes automatically visible to GPU
 * - cached: Cached host memory for faster CPU read access
 */
export type MemoryType =
  | "device_local"
  | "host_visible"
  | "host_coherent"
  | "cached";

/**
 * Buffer usage flags (GPUBufferUsage combined flags)
 */
export type BufferUsage = number;

/**
 * Memory pool configuration and state
 */
export interface MemoryPool {
  /** Unique pool identifier */
  pool_id: string;
  /** Total pool size in bytes */
  size: number;
  /** Memory type for this pool */
  memoryType: MemoryType;
  /** List of free blocks available for allocation */
  free_blocks: FreeBlock[];
  /** List of currently allocated blocks */
  allocated_blocks: Allocation[];
  /** Creation timestamp */
  created_at: number;
  /** Last access timestamp (for LRU tracking) */
  last_access: number;
  /** Access frequency counter */
  access_count: number;
}

/**
 * Free block within a memory pool
 */
export interface FreeBlock {
  /** Block offset within pool (bytes) */
  offset: number;
  /** Block size in bytes */
  size: number;
  /** Whether block is available for allocation */
  available: boolean;
}

/**
 * Individual buffer allocation
 */
export interface Allocation {
  /** Unique allocation identifier */
  allocation_id: string;
  /** GPU buffer handle */
  buffer: GPUBuffer;
  /** Offset within buffer (for sub-allocations) */
  offset: number;
  /** Allocation size in bytes */
  size: number;
  /** ID of pool this allocation belongs to */
  pool_id: string;
  /** Buffer usage flags */
  usage: BufferUsage;
  /** Memory type */
  memoryType: MemoryType;
  /** Allocation timestamp */
  created_at: number;
  /** Last access timestamp */
  last_access: number;
  /** Whether allocation is mapped */
  mapped: boolean;
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  /** Total memory managed (bytes) */
  total_memory: number;
  /** Currently used memory (bytes) */
  used_memory: number;
  /** Free memory available (bytes) */
  free_memory: number;
  /** Fragmentation ratio (0-1, higher = more fragmented) */
  fragmentation: number;
  /** Number of allocations */
  allocation_count: number;
  /** Number of free blocks */
  free_block_count: number;
  /** Peak memory usage (bytes) */
  peak_memory: number;
  /** Allocation size histogram */
  size_distribution: SizeHistogram;
}

/**
 * Size histogram for allocation tracking
 */
export interface SizeHistogram {
  /** Allocations < 1KB */
  tiny: number;
  /** Allocations 1KB - 64KB */
  small: number;
  /** Allocations 64KB - 1MB */
  medium: number;
  /** Allocations 1MB - 16MB */
  large: number;
  /** Allocations > 16MB */
  huge: number;
}

/**
 * Memory pool allocation strategy
 */
export enum PoolStrategy {
  /** First block that fits (fast, but may fragment) */
  FirstFit = "first_fit",
  /** Smallest block that fits (slower, less fragmentation) */
  BestFit = "best_fit",
  /** Largest block that fits (for large allocations) */
  WorstFit = "worst_fit",
  /** Buddy system allocation (power-of-2 sizes) */
  BuddySystem = "buddy_system",
  /** Segregated fit by size classes */
  SegregatedFit = "segregated_fit",
}

/**
 * Pool configuration options
 */
export interface PoolConfig {
  /** Pool size in bytes */
  size: number;
  /** Memory type */
  memoryType: MemoryType;
  /** Allocation strategy */
  strategy: PoolStrategy;
  /** Buffer usage flags */
  usage: BufferUsage;
  /** Label for debugging */
  label?: string;
  /** Minimum block size for allocation */
  minBlockSize?: number;
  /** Whether to enable automatic defragmentation */
  enableDefrag?: boolean;
}

/**
 * Memory allocator configuration
 */
export interface AllocatorConfig {
  /** Initial arena size in bytes */
  initialSize: number;
  /** Maximum size to grow to (0 = unlimited) */
  maxSize: number;
  /** Growth increment when out of space */
  growthIncrement: number;
  /** Alignment for allocations */
  alignment: number;
  /** Whether to track allocations for debugging */
  enableTracking: boolean;
}

/**
 * Buffer transfer options
 */
export interface TransferOptions {
  /** Use staging buffer for upload */
  useStaging: boolean;
  /** Staging buffer size */
  stagingSize: number;
  /** Whether to wait for completion */
  wait: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Memory limit configuration
 */
export interface MemoryLimitConfig {
  /** Maximum memory budget in bytes */
  maxMemory: number;
  /** Warning threshold (0-1) */
  warningThreshold: number;
  /** Critical threshold (0-1) */
  criticalThreshold: number;
  /** Whether to auto-evict on OOM */
  autoEvict: boolean;
  /** Eviction target ratio (0-1) */
  evictTarget: number;
}

/**
 * Memory pressure level
 */
export enum MemoryPressure {
  /** Plenty of memory available */
  None = "none",
  /** Approaching limit, consider cleanup */
  Low = "low",
  /** Near limit, cleanup recommended */
  Medium = "medium",
  /** Critical, immediate cleanup required */
  High = "high",
  /** Out of memory */
  Critical = "critical",
}

/**
 * Memory leak detection result
 */
export interface LeakDetectionResult {
  /** Whether leaks were detected */
  hasLeaks: boolean;
  /** Number of leaked buffers */
  leakCount: number;
  /** Total leaked memory */
  leakedBytes: number;
  /** List of leaked allocations */
  leaks: Allocation[];
  /** Leak report by age */
  ageBreakdown: AgeBreakdown;
}

/**
 * Breakdown of leaks by allocation age
 */
export interface AgeBreakdown {
  /** Allocations < 1 minute old */
  recent: number;
  /** Allocations 1-5 minutes old */
  short: number;
  /** Allocations 5-30 minutes old */
  medium: number;
  /** Allocations > 30 minutes old */
  old: number;
}

/**
 * Memory profiling data
 */
export interface ProfileData {
  /** Total allocations profiled */
  totalAllocations: number;
  /** Total deallocations */
  totalDeallocations: number;
  /** Peak memory usage */
  peakMemory: number;
  /** Average allocation size */
  avgAllocationSize: number;
  /** Median allocation size */
  medianAllocationSize: number;
  /** Allocation rate (allocations/second) */
  allocationRate: number;
  /** Deallocation rate (deallocations/second) */
  deallocationRate: number;
  /** Memory churn rate (bytes/second) */
  churnRate: number;
  /** Timeline of memory usage */
  timeline: TimelineEntry[];
  /** Size distribution */
  sizeDistribution: SizeHistogram;
  /** Lifetime distribution */
  lifetimeDistribution: LifetimeHistogram;
}

/**
 * Timeline entry for memory tracking
 */
export interface TimelineEntry {
  /** Timestamp */
  timestamp: number;
  /** Memory usage at this point */
  memory: number;
  /** Number of allocations */
  allocations: number;
}

/**
 * Lifetime histogram for allocations
 */
export interface LifetimeHistogram {
  /** Short-lived (< 1 second) */
  ephemeral: number;
  /** Brief (1-10 seconds) */
  brief: number;
  /** Medium (10-60 seconds) */
  medium: number;
  /** Long (1-10 minutes) */
  long: number;
  /** Persistent (> 10 minutes) */
  persistent: number;
}

/**
 * Eviction strategy
 */
export enum EvictionStrategy {
  /** Least Recently Used */
  LRU = "lru",
  /** Least Frequently Used */
  LFU = "lfu",
  /** First In First Out */
  FIFO = "fifo",
  /** Priority-based */
  Priority = "priority",
  /** Size-based (evict largest first) */
  Size = "size",
  /** Random */
  Random = "random",
}

/**
 * Cache entry for smart eviction
 */
export interface CacheEntry {
  /** Entry key */
  key: string;
  /** GPU buffer */
  buffer: GPUBuffer;
  /** Size in bytes */
  size: number;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccess: number;
  /** Access count */
  accessCount: number;
  /** Priority (0-1, higher = more important) */
  priority: number;
  /** Estimated access cost (0-1, higher = costlier to reload) */
  reloadCost: number;
}

/**
 * Eviction result
 */
export interface EvictionResult {
  /** Number of entries evicted */
  evictedCount: number;
  /** Total memory freed */
  freedBytes: number;
  /** Evicted entries */
  evictedEntries: CacheEntry[];
  /** Remaining entries */
  remainingCount: number;
}

/**
 * Defragmentation result
 */
export interface DefragmentationResult {
  /** Memory before defrag */
  beforeMemory: number;
  /** Memory after defrag */
  afterMemory: number;
  /** Fragmentation before */
  beforeFragmentation: number;
  /** Fragmentation after */
  afterFragmentation: number;
  /** Number of buffers moved */
  movedBuffers: number;
  /** Bytes copied */
  copiedBytes: number;
  /** Time taken (ms) */
  duration: number;
}

/**
 * Memory budget settings
 */
export interface MemoryBudget {
  /** Total budget in bytes */
  total: number;
  /** Allocations budget */
  allocations: number;
  /** Cache budget */
  cache: number;
  /** Temporary buffers budget */
  temporary: number;
  /** Reserve for emergencies */
  reserve: number;
}

/**
 * Memory event types
 */
export enum MemoryEventType {
  /** Buffer allocated */
  Allocate = "allocate",
  /** Buffer freed */
  Free = "free",
  /** Buffer mapped */
  Map = "map",
  /** Buffer unmapped */
  Unmap = "unmap",
  /** Memory pressure warning */
  PressureWarning = "pressure_warning",
  /** Out of memory error */
  OOM = "oom",
  /** Defragmentation started */
  DefragStart = "defrag_start",
  /** Defragmentation completed */
  DefragComplete = "defrag_complete",
  /** Eviction occurred */
  Eviction = "eviction",
}

/**
 * Memory event for monitoring
 */
export interface MemoryEvent {
  /** Event type */
  type: MemoryEventType;
  /** Timestamp */
  timestamp: number;
  /** Associated allocation (if applicable) */
  allocation?: Allocation;
  /** Memory size affected (bytes) */
  size: number;
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
  /** Default memory type */
  defaultMemoryType: MemoryType;
  /** Initial pool size (bytes) */
  initialPoolSize: number;
  /** Maximum total memory (0 = device limit) */
  maxMemory: number;
  /** Enable automatic defragmentation */
  enableAutoDefrag: boolean;
  /** Defrag threshold (fragmentation level) */
  defragThreshold: number;
  /** Enable memory profiling */
  enableProfiling: boolean;
  /** Memory budget */
  budget: MemoryBudget;
  /** Event callbacks */
  onEvent?: (event: MemoryEvent) => void;
}

/**
 * VL-JEPA specific memory configuration
 */
export interface VLJEPAMemoryConfig {
  /** Embedding dimension (default: 768 for VL-JEPA) */
  embeddingDim: number;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Temporary buffer size for compute */
  tempBufferSize: number;
  /** Enable embedding buffer caching */
  cacheEmbeddings: boolean;
  /** Maximum cached embeddings */
  maxCachedEmbeddings: number;
}

/**
 * Buffer creation options
 */
export interface BufferOptions {
  /** Buffer size in bytes */
  size: number;
  /** Usage flags */
  usage: BufferUsage;
  /** Memory type */
  memoryType?: MemoryType;
  /** Whether to map at creation */
  mappedAtCreation?: boolean;
  /** Label for debugging */
  label?: string;
  /** Alignment requirement */
  alignment?: number;
}

/**
 * Memory allocation result
 */
export interface AllocationResult {
  /** Allocated buffer */
  buffer: GPUBuffer;
  /** Allocation offset (for sub-allocations) */
  offset: number;
  /** Actual size allocated (may be rounded up) */
  size: number;
  /** Allocation ID */
  allocationId: string;
  /** Pool ID */
  poolId: string;
}

/**
 * Memory health status
 */
export interface MemoryHealth {
  /** Overall health score (0-1) */
  score: number;
  /** Memory pressure level */
  pressure: MemoryPressure;
  /** Fragmentation level */
  fragmentation: number;
  /** Utilization ratio */
  utilization: number;
  /** Whether system is healthy */
  healthy: boolean;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Staging buffer for host-device transfers
 */
export interface StagingBuffer {
  /** GPU buffer handle */
  buffer: GPUBuffer;
  /** Whether currently in use */
  inUse: boolean;
  /** Buffer size */
  size: number;
  /** Last used timestamp */
  lastUsed: number;
}

/**
 * Memory alignment requirements
 */
export enum Alignment {
  /** 1 byte alignment (no alignment) */
  Byte = 1,
  /** 4 byte alignment */
  Uint32 = 4,
  /** 16 byte alignment (SIMD) */
  SIMD = 16,
  /** 256 byte alignment (cache line) */
  CacheLine = 256,
  /** 4KB alignment (page) */
  Page = 4096,
  /** 64KB alignment (GPU optimal) */
  GPUOptimal = 65536,
}

/**
 * Memory pool statistics
 */
export interface PoolStats {
  /** Pool ID */
  poolId: string;
  /** Total pool size */
  totalSize: number;
  /** Used bytes */
  usedBytes: number;
  /** Free bytes */
  freeBytes: number;
  /** Utilization ratio */
  utilization: number;
  /** Allocation count */
  allocationCount: number;
  /** Free block count */
  freeBlockCount: number;
  /** Fragmentation score */
  fragmentation: number;
  /** Total allocations served */
  totalServed: number;
  /** Cache hit rate */
  hitRate: number;
}

/**
 * Garbage collection result
 */
export interface GCResult {
  /** Number of buffers collected */
  collectedCount: number;
  /** Bytes freed */
  freedBytes: number;
  /** Number of pools released */
  poolsReleased: number;
  /** Time taken (ms) */
  duration: number;
}

/**
 * Memory snapshot for debugging
 */
export interface MemorySnapshot {
  /** Snapshot timestamp */
  timestamp: number;
  /** All pools */
  pools: MemoryPool[];
  /** All allocations */
  allocations: Allocation[];
  /** Global stats */
  stats: MemoryStats;
  /** Device info */
  deviceInfo: DeviceInfo;
}

/**
 * WebGPU device information
 */
export interface DeviceInfo {
  /** Device name/identifier */
  name: string;
  /** Vendor */
  vendor: string;
  /** Architecture */
  architecture: string;
  /** Maximum buffer size */
  maxBufferSize: number;
  /** Maximum buffer alignment */
  maxBufferAlignment: number;
  /** Maximum storage buffers per stage */
  maxStorageBuffersPerStage: number;
  /** Maximum uniform buffers per stage */
  maxUniformBuffersPerStage: number;
}

/**
 * Memory stress test configuration
 */
export interface StressTestConfig {
  /** Number of iterations */
  iterations: number;
  /** Allocation size range */
  minSize: number;
  maxSize: number;
  /** Allocation probability (0-1) */
  allocProbability: number;
  /** Free probability */
  freeProbability: number;
  /** Concurrent operations */
  concurrency: number;
  /** Duration limit (ms, 0 = unlimited) */
  duration: number;
}

/**
 * Stress test result
 */
export interface StressTestResult {
  /** Whether test passed */
  passed: boolean;
  /** Total operations */
  totalOps: number;
  /** Allocations performed */
  allocations: number;
  /** Deallocations performed */
  deallocations: number;
  /** Peak memory usage */
  peakMemory: number;
  /** Average allocation time (ms) */
  avgAllocTime: number;
  /** Average free time (ms) */
  avgFreeTime: number;
  /** Errors encountered */
  errors: string[];
  /** Memory leaks detected */
  leaks: number;
}

/**
 * Memory migration options
 */
export interface MigrationOptions {
  /** Source memory type */
  fromType: MemoryType;
  /** Destination memory type */
  toType: MemoryType;
  /** Whether to validate after migration */
  validate: boolean;
  /** Progress callback */
  onProgress?: (progress: number) => void;
}

/**
 * Memory migration result
 */
export interface MigrationResult {
  /** Number of buffers migrated */
  migratedBuffers: number;
  /** Total bytes migrated */
  totalBytes: number;
  /** Migration time (ms) */
  duration: number;
  /** Validation passed */
  validated: boolean;
  /** Errors */
  errors: string[];
}
