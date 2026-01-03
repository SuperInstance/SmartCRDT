/**
 * NUMA (Non-Uniform Memory Access) Protocol Types
 *
 * Provides types and interfaces for NUMA-aware task scheduling and memory management
 * on multi-socket systems with non-uniform memory access patterns.
 *
 * NUMA Architecture:
 * - Multiple sockets/CPUs with local memory
 * - Remote memory access has higher latency
 * - Optimal performance requires memory locality
 * - Workload balancing across nodes prevents hotspots
 */

/**
 * NUMA node identifier (0-based)
 */
export type NUMANodeId = number;

/**
 * CPU core identifier
 */
export type CPUId = number;

/**
 * Memory size in bytes
 */
export type MemorySize = number;

/**
 * NUMA memory policy types
 */
export enum NUMAMemoryPolicy {
  /** Default OS policy */
  DEFAULT = 'default',
  /** Bind to specific node */
  BIND = 'bind',
  /** Interleave across nodes */
  INTERLEAVE = 'interleave',
  /** Prefer local node but allow remote */
  PREFERRED = 'preferred',
  /** Local allocation only */
  LOCAL = 'local'
}

/**
 * NUMA node topology
 */
export interface NUMANode {
  /** Node ID */
  nodeId: NUMANodeId;

  /** Distance to this node (relative to node 0) */
  distance: number;

  /** CPUs belonging to this node */
  cpus: CPUId[];

  /** Total memory size (bytes) */
  totalMemory: MemorySize;

  /** Free memory size (bytes) */
  freeMemory: MemorySize;

  /** Memory usage percentage */
  memoryUsage: number;

  /** CPU usage percentage */
  cpuUsage: number;

  /** Number of active tasks on this node */
  activeTasks: number;
}

/**
 * NUMA system topology
 */
export interface NUMATopology {
  /** Number of NUMA nodes */
  nodeCount: number;

  /** All NUMA nodes */
  nodes: Map<NUMANodeId, NUMANode>;

  /** Distance matrix (nodeId -> nodeId -> distance) */
  distances: Map<NUMANodeId, Map<NUMANodeId, number>>;

  /** Total system memory (bytes) */
  totalMemory: MemorySize;

  /** Total CPU cores */
  totalCpus: number;

  /** Whether NUMA is available/enabled */
  numaAvailable: boolean;

  /** Detection timestamp */
  timestamp: number;
}

/**
 * NUMA-aware task metadata
 */
export interface NUMATask {
  /** Unique task ID */
  taskId: string;

  /** Task name/description */
  name: string;

  /** Preferred NUMA node (if any) */
  preferredNode?: NUMANodeId;

  /** Memory policy for this task */
  memoryPolicy: NUMAMemoryPolicy;

  /** Estimated memory requirement (bytes) */
  memoryRequirement: MemorySize;

  /** CPU affinity (specific cores, if any) */
  cpuAffinity?: CPUId[];

  /** Memory pages allocated (for tracking locality) */
  memoryPages: Array<{
    nodeId: NUMANodeId;
    pageCount: number;
  }>;

  /** Current node (if running) */
  currentNode?: NUMANodeId;

  /** Task priority (0-100) */
  priority: number;

  /** Creation timestamp */
  createdAt: number;

  /** Task state */
  state: 'pending' | 'running' | 'migrating' | 'completed' | 'failed';
}

/**
 * NUMA scheduling decision
 */
export interface NUMASchedulingDecision {
  /** Task being scheduled */
  taskId: string;

  /** Target NUMA node */
  targetNode: NUMANodeId;

  /** CPU cores to use */
  cpuAffinity: CPUId[];

  /** Memory policy to apply */
  memoryPolicy: NUMAMemoryPolicy;

  /** Confidence in this decision (0-1) */
  confidence: number;

  /** Reasoning for this decision */
  reason: string;

  /** Expected performance impact (0-1) */
  expectedImpact: number;

  /** Estimated migration cost (ms) */
  migrationCost?: number;

  /** Alternative nodes (in order of preference) */
  alternatives: Array<{
    nodeId: NUMANodeId;
    score: number;
    reason: string;
  }>;
}

/**
 * NUMA scheduling strategy
 */
export enum NUMASchedulingStrategy {
  /** Always use local node */
  LOCAL_FIRST = 'local_first',
  /** Balance load across nodes */
  LOAD_BALANCE = 'load_balance',
  /** Minimize remote memory access */
  MINIMIZE_REMOTE = 'minimize_remote',
  /** Prefer node with most free memory */
  MAXIMIZE_FREE_MEMORY = 'maximize_free_memory',
  /** Adaptive strategy based on workload */
  ADAPTIVE = 'adaptive'
}

/**
 * NUMA scheduler configuration
 */
export interface NUMASchedulerConfig {
  /** Scheduling strategy */
  strategy: NUMASchedulingStrategy;

  /** Maximum tasks per node */
  maxTasksPerNode: number;

  /** Memory pressure threshold (0-1) */
  memoryPressureThreshold: number;

  /** CPU pressure threshold (0-1) */
  cpuPressureThreshold: number;

  /** Whether to enable automatic task migration */
  enableMigration: boolean;

  /** Migration cost threshold (ms) - don't migrate if cost exceeds this */
  migrationCostThreshold: number;

  /** Load balancing window (ms) */
  loadBalanceWindow: number;

  /** Monitoring interval (ms) */
  monitoringInterval: number;
}

/**
 * NUMA memory allocation result
 */
export interface NUMAMemoryAllocation {
  /** Allocation ID */
  allocationId: string;

  /** Task ID */
  taskId: string;

  /** Node where memory was allocated */
  nodeId: NUMANodeId;

  /** Allocated size (bytes) */
  size: MemorySize;

  /** Memory address range */
  addressRange: {
    start: bigint;
    end: bigint;
  };

  /** Whether allocation is on local node */
  isLocal: boolean;

  /** Allocation timestamp */
  timestamp: number;
}

/**
 * NUMA memory migration result
 */
export interface NUMAMemoryMigration {
  /** Migration ID */
  migrationId: string;

  /** Task ID */
  taskId: string;

  /** Source node */
  sourceNode: NUMANodeId;

  /** Target node */
  targetNode: NUMANodeId;

  /** Memory size being migrated (bytes) */
  size: MemorySize;

  /** Migration progress (0-1) */
  progress: number;

  /** Migration status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';

  /** Estimated time remaining (ms) */
  estimatedTimeRemaining?: number;

  /** Actual migration time (ms) */
  actualTime?: number;

  /** Error message (if failed) */
  error?: string;
}

/**
 * NUMA statistics
 */
export interface NUMAStatistics {
  /** Statistics timestamp */
  timestamp: number;

  /** Tasks scheduled per node */
  tasksPerNode: Map<NUMANodeId, number>;

  /** Memory allocated per node (bytes) */
  memoryPerNode: Map<NUMANodeId, MemorySize>;

  /** Local vs remote memory access ratio */
  localityRatio: number;

  /** Average task completion time per node (ms) */
  avgCompletionTime: Map<NUMANodeId, number>;

  /** Number of migrations performed */
  migrationsPerformed: number;

  /** Number of migrations in progress */
  migrationsInProgress: number;

  /** Load balance score (0-1, higher is better) */
  loadBalanceScore: number;

  /** Memory locality score (0-1, higher is better) */
  memoryLocalityScore: number;

  /** Overall efficiency score (0-1) */
  efficiencyScore: number;
}

/**
 * NUMA detection result
 */
export interface NUMADetectionResult {
  /** Whether NUMA is available */
  available: boolean;

  /** Detected topology */
  topology?: NUMATopology;

  /** Detection error (if any) */
  error?: string;

  /** Detection method used */
  method: 'linux_numactl' | 'lscpu' | 'procfs' | 'fallback' | 'windows';

  /** Detection timestamp */
  timestamp: number;
}

/**
 * NUMA memory affinity request
 */
export interface NUMAMemoryAffinityRequest {
  /** Task ID */
  taskId: string;

  /** Preferred node(s) */
  preferredNodes?: NUMANodeId[];

  /** Memory size required */
  size: MemorySize;

  /** Memory policy */
  policy: NUMAMemoryPolicy;

  /** Whether to allow remote allocation */
  allowRemote: boolean;

  /** Allocation flags */
  flags?: {
    /** Lock pages in memory */
    lock?: boolean;
    /** Pre-fault pages */
    prefault?: boolean;
    /** Huge pages */
    hugePages?: boolean;
  };
}

/**
 * NUMA memory affinity result
 */
export interface NUMAMemoryAffinityResult {
  /** Request ID */
  requestId: string;

  /** Task ID */
  taskId: string;

  /** Success status */
  success: boolean;

  /** Node where memory was allocated */
  nodeId: NUMANodeId;

  /** Actual memory allocated */
  allocation?: NUMAMemoryAllocation;

  /** Error message (if failed) */
  error?: string;

  /** Fallback to remote node */
  fallbackUsed?: boolean;
}

/**
 * NUMA workload distribution
 */
export interface NUMAWorkloadDistribution {
  /** Node ID */
  nodeId: NUMANodeId;

  /** Number of tasks */
  taskCount: number;

  /** Total memory used (bytes) */
  memoryUsed: MemorySize;

  /** CPU utilization (0-1) */
  cpuUtilization: number;

  /** Memory utilization (0-1) */
  memoryUtilization: number;

  /** Load score (0-1, higher is more loaded) */
  loadScore: number;
}

/**
 * NUMA optimization recommendation
 */
export interface NUMAOptimizationRecommendation {
  /** Recommendation type */
  type: 'schedule' | 'migrate' | 'rebalance' | 'policy_change';

  /** Priority (0-100) */
  priority: number;

  /** Affected task(s) */
  taskIds: string[];

  /** Current node */
  currentNode?: NUMANodeId;

  /** Recommended node */
  recommendedNode: NUMANodeId;

  /** Expected benefit */
  expectedBenefit: {
    /** Performance improvement (0-1) */
    performanceImprovement: number;
    /** Latency reduction (ms) */
    latencyReduction: number;
    /** Cost estimate (ms) */
    cost: number;
  };

  /** Recommendation reason */
  reason: string;

  /** Implementation steps */
  steps: string[];
}

/**
 * NUMA scheduler interface
 */
export interface INUMAScheduler {
  /** Get current topology */
  getTopology(): Promise<NUMATopology>;

  /** Schedule a task */
  scheduleTask(task: NUMATask): Promise<NUMASchedulingDecision>;

  /** Migrate a task to different node */
  migrateTask(taskId: string, targetNode: NUMANodeId): Promise<NUMAMemoryMigration>;

  /** Get current statistics */
  getStatistics(): Promise<NUMAStatistics>;

  /** Get workload distribution */
  getWorkloadDistribution(): Promise<NUMAWorkloadDistribution[]>;

  /** Get optimization recommendations */
  getRecommendations(): Promise<NUMAOptimizationRecommendation[]>;

  /** Update scheduler configuration */
  updateConfig(config: Partial<NUMASchedulerConfig>): Promise<void>;
}

/**
 * NUMA detector interface
 */
export interface INUMADetector {
  /** Detect NUMA topology */
  detect(): Promise<NUMADetectionResult>;

  /** Monitor topology changes */
  monitorTopology(callback: (topology: NUMATopology) => void): void;

  /** Stop monitoring */
  stopMonitoring(): void;
}

/**
 * NUMA memory affinity manager interface
 */
export interface INUMAMemoryAffinityManager {
  /** Set memory affinity for a task */
  setMemoryAffinity(request: NUMAMemoryAffinityRequest): Promise<NUMAMemoryAffinityResult>;

  /** Get memory affinity for a task */
  getMemoryAffinity(taskId: string): Promise<NUMAMemoryAffinityResult | null>;

  /** Update memory policy for a task */
  updateMemoryPolicy(taskId: string, policy: NUMAMemoryPolicy): Promise<boolean>;

  /** Allocate memory on specific node */
  allocateMemory(request: NUMAMemoryAffinityRequest): Promise<NUMAMemoryAllocation>;

  /** Free memory allocation */
  freeMemory(allocationId: string): Promise<boolean>;
}
