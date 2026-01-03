/**
 * @lsi/webgpu-multi - Multi-GPU Support Types
 *
 * Type definitions for multi-GPU orchestration, work distribution,
 * and synchronization in WebGPU applications.
 */

/**
 * GPU device wrapper with metadata
 */
export interface GPUDevice {
  /** Unique device identifier */
  device_id: string;
  /** WebGPU adapter */
  adapter: GPUAdapter;
  /** WebGPU device */
  device: GPUDevice;
  /** Device queue for command submission */
  queue: GPUQueue;
  /** Supported features */
  features: string[];
  /** Device limits */
  limits: GPUSupportedLimits;
  /** Device type (integrated/discrete) */
  type: "integrated" | "discrete" | "cpu" | "unknown";
  /** Vendor name */
  vendor: string;
  /** Architecture name */
  architecture: string;
  /** Memory size in bytes */
  memorySize: number;
  /** Whether device is currently busy */
  busy: boolean;
  /** Current utilization (0-1) */
  utilization: number;
  /** Current temperature (if available) */
  temperature?: number;
  /** Power usage in watts (if available) */
  powerUsage?: number;
}

/**
 * Device selection criteria
 */
export type DeviceSelection =
  | "auto" // Automatically select best device
  | "integrated" // Prefer integrated GPU
  | "discrete" // Prefer discrete GPU
  | "cpu" // Prefer CPU (software implementation)
  | "specific"; // Use specific device ID

/**
 * Work distribution strategies
 */
export type WorkDistribution =
  | "round-robin" // Distribute work evenly across devices
  | "split-by-task" // Split by task granularity
  | "data-parallel" // Same task on different data chunks
  | "pipeline" // Pipeline stages across devices
  | "model-parallel" // Split model across devices
  | "hybrid"; // Combination of strategies

/**
 * Synchronization strategies
 */
export type SyncStrategy =
  | "barrier" // Wait for all devices to complete
  | "event" // Event-based synchronization
  | "fence" // Fence-based synchronization
  | "timeline" // Timeline semaphores
  | "callback"; // Callback-based synchronization

/**
 * Multi-GPU configuration
 */
export interface MultiGPUConfig {
  /** Available GPU devices */
  devices: GPUDevice[];
  /** Work distribution strategy */
  workDistribution: WorkDistribution;
  /** Synchronization strategy */
  syncStrategy: SyncStrategy;
  /** Maximum devices to use (0 = all) */
  maxDevices?: number;
  /** Whether to enable load balancing */
  enableLoadBalancing?: boolean;
  /** Whether to enable work stealing */
  enableWorkStealing?: boolean;
  /** Load balance threshold (0-1) */
  loadBalanceThreshold?: number;
  /** Memory per device in bytes */
  memoryPerDevice?: number;
  /** Whether to use peer-to-peer access */
  usePeerAccess?: boolean;
  /** Timeout for operations in ms */
  timeout?: number;
}

/**
 * GPU device information
 */
export interface GPUDeviceInfo {
  /** Device identifier */
  deviceId: string;
  /** Adapter info */
  adapterInfo: GPUAdapterInfo;
  /** Supported features */
  features: string[];
  /** Device limits */
  limits: GPUSupportedLimits;
  /** Device type */
  type: "integrated" | "discrete" | "cpu" | "unknown";
  /** Memory size */
  memorySize: number;
  /** Vendor */
  vendor: string;
  /** Architecture */
  architecture: string;
  /** Driver description */
  driver: string;
}

/**
 * Work task definition
 */
export interface WorkTask {
  /** Unique task identifier */
  taskId: string;
  /** Task type */
  type: string;
  /** Input data */
  inputData: ArrayBuffer | ArrayBuffer[];
  /** Kernel or shader to execute */
  kernel: string;
  /** Bind group layouts */
  layouts: GPUBindGroupLayout[];
  /** Pipeline layout */
  pipelineLayout: GPUPipelineLayout;
  /** Compute pipeline */
  pipeline: GPUComputePipeline;
  /** Workgroup sizes */
  workgroupSizes: [number, number, number];
  /** Dispatch sizes */
  dispatchSizes: [number, number, number];
  /** Priority (0-1, higher = more important) */
  priority: number;
  /** Estimated execution time in ms */
  estimatedTime?: number;
  /** Memory requirements in bytes */
  memoryRequired?: number;
  /** Dependencies (task IDs that must complete first) */
  dependencies: string[];
}

/**
 * Task assignment to device
 */
export interface TaskAssignment {
  /** Task being assigned */
  task: WorkTask;
  /** Target device */
  device: GPUDevice;
  /** Assignment index */
  index: number;
  /** Expected completion time */
  expectedCompletion: number;
  /** Actual completion time */
  actualCompletion?: number;
  /** Status */
  status: "pending" | "running" | "completed" | "failed";
  /** Error if failed */
  error?: Error;
}

/**
 * Data distribution configuration
 */
export interface DataDistribution {
  /** Data chunks */
  chunks: ArrayBuffer[];
  /** Chunk device assignments */
  assignments: GPUDevice[];
  /** Whether to replicate data */
  replicate: boolean;
  /** Replication factor */
  replicationFactor?: number;
  /** Data alignment */
  alignment: number;
}

/**
 * Synchronization point
 */
export interface SyncPoint {
  /** Sync point identifier */
  syncId: string;
  /** Devices to synchronize */
  devices: GPUDevice[];
  /** Associated task IDs */
  taskIds: string[];
  /** Sync strategy used */
  strategy: SyncStrategy;
  /** Sync event/fence */
  signal?: GPUFence | GPUEvent;
  /** Whether sync is complete */
  complete: boolean;
  /** Timestamp when sync was created */
  createdAt: number;
  /** Timestamp when sync completed */
  completedAt?: number;
}

/**
 * Collective operation types
 */
export type CollectiveOperation =
  | "reduce" // Reduce data from all devices
  | "allreduce" // Reduce and broadcast to all
  | "broadcast" // Broadcast from one to all
  | "scatter" // Scatter data to devices
  | "gather" // Gather data from devices
  | "alltoall"; // All-to-all communication

/**
 * Collective operation configuration
 */
export interface CollectiveConfig {
  /** Operation type */
  operation: CollectiveOperation;
  /** Participating devices */
  devices: GPUDevice[];
  /** Root device (for broadcast/reduce) */
  root?: GPUDevice;
  /** Input data */
  inputData: ArrayBuffer[];
  /** Output data */
  outputData?: ArrayBuffer[];
  /** Data type */
  dataType: "float32" | "float16" | "int32" | "int16" | "int8";
  /** Reduce operation (for reduce/allreduce) */
  reduceOp?: "sum" | "min" | "max" | "avg" | "prod";
}

/**
 * Load balancer configuration
 */
export interface LoadBalancerConfig {
  /** Whether to enable predictive balancing */
  enablePredictive?: boolean;
  /** Balance interval in ms */
  balanceInterval?: number;
  /** Load smoothing factor (0-1) */
  loadSmoothing?: number;
  /** Whether to use work stealing */
  enableWorkStealing?: boolean;
  /** Work stealing threshold (0-1) */
  stealThreshold?: number;
  /** Maximum steal attempts */
  maxStealAttempts?: number;
}

/**
 * GPU selection criteria
 */
export interface GPUSelectionCriteria {
  /** Device type preference */
  type?: DeviceSelection;
  /** Minimum memory in bytes */
  minMemory?: number;
  /** Required features */
  requiredFeatures?: string[];
  /** Preferred features */
  preferredFeatures?: string[];
  /** Maximum power usage in watts */
  maxPower?: number;
  /** Maximum temperature */
  maxTemperature?: number;
  /** Performance score (0-1) */
  minPerformance?: number;
  /** Whether to consider thermal state */
  considerThermal?: boolean;
  /** Whether to consider power efficiency */
  considerPower?: boolean;
}

/**
 * Multi-GPU execution result
 */
export interface MultiGPUResult {
  /** Task ID */
  taskId: string;
  /** Success status */
  success: boolean;
  /** Results per device */
  deviceResults: Map<string, ArrayBuffer>;
  /** Execution time in ms */
  executionTime: number;
  /** Data transfer time in ms */
  transferTime: number;
  /** Compute time in ms */
  computeTime: number;
  /** Sync time in ms */
  syncTime: number;
  /** Total memory used in bytes */
  memoryUsed: number;
  /** Energy consumed in joules */
  energyConsumed?: number;
  /** Error if failed */
  error?: Error;
}

/**
 * Multi-GPU statistics
 */
export interface MultiGPUStats {
  /** Total devices */
  totalDevices: number;
  /** Active devices */
  activeDevices: number;
  /** Total tasks executed */
  totalTasks: number;
  /** Completed tasks */
  completedTasks: number;
  /** Failed tasks */
  failedTasks: number;
  /** Average task time in ms */
  avgTaskTime: number;
  /** Average utilization (0-1) */
  avgUtilization: number;
  /** Total data transferred in bytes */
  totalDataTransferred: number;
  /** Total compute time in ms */
  totalComputeTime: number;
  /** Total sync time in ms */
  totalSyncTime: number;
  /** Efficiency score (0-1) */
  efficiency: number;
  /** Speedup factor */
  speedup: number;
}

/**
 * Pipeline stage
 */
export interface PipelineStage {
  /** Stage identifier */
  stageId: string;
  /** Stage name */
  name: string;
  /** Assigned device */
  device: GPUDevice;
  /** Stage tasks */
  tasks: WorkTask[];
  /** Input from previous stage */
  inputFrom?: string;
  /** Output to next stage */
  outputTo?: string;
  /** Estimated time in ms */
  estimatedTime: number;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Pipeline stages */
  stages: PipelineStage[];
  /** Whether to enable overlapping */
  enableOverlapping: boolean;
  /** Buffer size between stages */
  bufferSize: number;
}

/**
 * Memory pool per device
 */
export interface DeviceMemoryPool {
  /** Device */
  device: GPUDevice;
  /** Allocated buffers */
  buffers: Map<string, GPUBuffer>;
  /** Total allocated memory */
  totalAllocated: number;
  /** Available memory */
  availableMemory: number;
  /** Buffer usage tracking */
  usage: Map<string, number>;
}

/**
 * Peer access information
 */
export interface PeerAccessInfo {
  /** Source device */
  fromDevice: GPUDevice;
  /** Target device */
  toDevice: GPUDevice;
  /** Whether peer access is supported */
  supported: boolean;
  /** Access mode */
  accessMode: "read" | "write" | "read-write";
  /** Transfer bandwidth in MB/s */
  bandwidth?: number;
  /** Latency in microseconds */
  latency?: number;
}
