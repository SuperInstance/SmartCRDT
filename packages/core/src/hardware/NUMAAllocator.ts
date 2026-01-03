/**
 * NUMA-Aware Allocator
 *
 * Allocates CPU and memory resources with awareness of NUMA topology.
 * Optimizes for local memory access, load balancing, and minimal cross-node traffic.
 *
 * Strategies:
 * - pack: Concentrate allocations on few nodes (energy efficient)
 * - spread: Distribute across all nodes (maximize bandwidth)
 * - balanced: Balance between pack and spread
 *
 * @module hardware/NUMAAllocator
 */

import type { NUMATopology, NUMANode, NUMAStats } from "./NUMATopology.js";

/**
 * NUMA allocation request
 */
export interface AllocationRequest {
  /** Memory required in bytes */
  memoryBytes: number;

  /** Number of CPUs required */
  cpuCount: number;

  /** Preferred NUMA node */
  preferredNode?: number;

  /** Preferred CPU ID */
  preferredCPU?: number;

  /** Must allocate on local node */
  requireLocalMemory?: boolean;

  /** Must allocate CPU on local node */
  requireLocalCPU?: boolean;

  /** Affinity strategy */
  affinity?: NUMAAffinity;

  /** Task identifier */
  taskId?: string;

  /** Task priority */
  priority?: "low" | "normal" | "high";
}

/**
 * NUMA affinity type
 */
export type NUMAAffinity =
  | "strict" // Must be on preferred node
  | "prefer" // Prefer preferred node
  | "interleave"; // Interleave across nodes

/**
 * NUMA allocation result
 */
export interface AllocationResult {
  /** Allocated node ID */
  nodeId: number;

  /** Allocated CPU IDs */
  cpus: number[];

  /** Allocated memory in bytes */
  memoryBytes: number;

  /** Explanation of allocation decision */
  reasoning: string;

  /** Estimated latency in nanoseconds */
  estimatedLatency: number;

  /** Estimated bandwidth in bytes/second */
  estimatedBandwidth: number;

  /** Whether this is a fallback allocation */
  isFallback: boolean;

  /** Reason for fallback if applicable */
  fallbackReason?: string;
}

/**
 * NUMA allocator configuration
 */
export interface NUMAAllocatorConfig {
  /** Allocation strategy */
  strategy: "pack" | "spread" | "balanced";

  /** Maximum memory usage ratio (0-1) */
  maxMemoryUsage: number;

  /** Maximum CPU usage ratio (0-1) */
  maxCPUUsage: number;

  /** Enable automatic rebalancing */
  enableRebalancing: boolean;

  /** Rebalancing interval in milliseconds */
  rebalanceInterval: number;

  /** Allow cross-node allocation */
  allowCrossNode: boolean;

  /** Cross-node latency penalty multiplier */
  crossNodePenalty: number;

  /** Local memory latency (nanoseconds) */
  localLatency: number;

  /** Remote memory latency (nanoseconds) */
  remoteLatency: number;

  /** Local memory bandwidth (bytes/second) */
  localBandwidth: number;

  /** Remote memory bandwidth (bytes/second) */
  remoteBandwidth: number;
}

/**
 * NUMA allocator statistics
 */
export interface NUMAAllocatorStats {
  /** Total allocations performed */
  totalAllocations: number;

  /** Currently active allocations */
  activeAllocations: number;

  /** Allocations per node */
  allocationsByNode: number[];

  /** Average local access ratio */
  avgLocalAccessRatio: number;

  /** Average cross-node traffic in bytes/second */
  avgCrossNodeTraffic: number;

  /** Load balance score (0-1) */
  loadBalanceScore: number;

  /** Number of rebalances performed */
  rebalanceCount: number;

  /** Timestamp of last rebalance */
  lastRebalance?: number;
}

/**
 * Memory statistics per node
 */
export interface MemoryStats {
  /** Total memory in bytes */
  total: number;

  /** Used memory in bytes */
  used: number;

  /** Free memory in bytes */
  free: number;

  /** Cached memory in bytes */
  cached: number;

  /** Local memory access count */
  localAccessCount: number;

  /** Remote memory access count */
  remoteAccessCount: number;

  /** Local memory bandwidth in bytes/second */
  bandwidthLocal: number;

  /** Remote memory bandwidth in bytes/second */
  bandwidthRemote: number;
}

/**
 * CPU statistics per node
 */
export interface CPUStats {
  /** CPU usage ratio (0-1) */
  usage: number;

  /** Local memory access count */
  localMemoryAccess: number;

  /** Remote memory access count */
  remoteMemoryAccess: number;

  /** Number of tasks on this node */
  tasks: number;

  /** Number of migrations */
  migrations: number;
}

/**
 * NUMA task placement
 */
export interface NUMAPlacement {
  /** Node ID */
  nodeId: number;

  /** CPU IDs */
  cpus: number[];

  /** Local memory in bytes */
  localMemory: number;

  /** Remote memory in bytes */
  remoteMemory: number;

  /** Whether placement is optimal */
  isOptimal: boolean;

  /** Placement score (0-1) */
  score: number;
}

/**
 * NUMA task
 */
export interface NUMATask {
  /** Task identifier */
  taskId: string;

  /** Memory required in bytes */
  memoryBytes: number;

  /** CPU affinity */
  cpuAffinity?: number[];

  /** Preferred CPU ID */
  preferredCPU?: number;

  /** Current node */
  currentNode?: number;

  /** Current CPUs */
  currentCPUs?: number[];

  /** Local memory access ratio */
  localMemoryAccessRatio?: number;

  /** Task context */
  context?: TaskContext;
}

/**
 * Task context for NUMA placement
 */
export interface TaskContext {
  /** Task type */
  type?: "compute" | "memory" | "mixed";

  /** Expected memory bandwidth */
  expectedBandwidth?: number;

  /** Expected compute intensity */
  expectedCompute?: number;
}

/**
 * NUMA-aware memory manager
 *
 * Manages memory allocation with NUMA locality awareness.
 * Supports allocation on specific nodes, local allocation, and interleaving.
 */
export class NUMAMemoryManager {
  private allocations: Map<
    string,
    { pointer: number; nodeId: number; size: number }
  > = new Map();
  private memoryByNode: Map<number, MemoryStats> = new Map();
  private nextPointer = 1;

  constructor(private topology: NUMATopology) {
    this.initializeMemoryStats();
  }

  /**
   * Initialize memory statistics for all nodes
   */
  private initializeMemoryStats(): void {
    this.topology.nodes.forEach(node => {
      this.memoryByNode.set(node.nodeId, {
        total: node.memory.total,
        used: node.memory.used,
        free: node.memory.free,
        cached: 0,
        localAccessCount: 0,
        remoteAccessCount: 0,
        bandwidthLocal: 0,
        bandwidthRemote: 0,
      });
    });
  }

  /**
   * Allocate memory on specific node
   * @param size Size in bytes
   * @param nodeId Node ID
   * @returns Allocation info
   */
  allocateOnNode(
    size: number,
    nodeId: number
  ): { pointer: number; nodeId: number } {
    const stats = this.memoryByNode.get(nodeId);
    if (!stats) {
      throw new Error(`Invalid node ID: ${nodeId}`);
    }

    if (stats.free < size) {
      throw new Error(`Insufficient memory on node ${nodeId}`);
    }

    const pointer = this.nextPointer++;
    this.allocations.set(`ptr_${pointer}`, { pointer, nodeId, size });

    stats.used += size;
    stats.free -= size;

    return { pointer, nodeId };
  }

  /**
   * Allocate memory on node local to CPU
   * @param size Size in bytes
   * @param cpuId CPU ID
   * @returns Allocation info
   */
  allocateLocal(
    size: number,
    cpuId: number
  ): { pointer: number; nodeId: number } {
    const nodeId = this.topology.getPreferredNode(cpuId);
    if (nodeId < 0) {
      throw new Error(`Cannot find local node for CPU ${cpuId}`);
    }

    return this.allocateOnNode(size, nodeId);
  }

  /**
   * Interleave allocation across nodes
   * @param size Total size in bytes
   * @param nodes Nodes to interleave across (default: all)
   * @returns Allocation info
   */
  allocateInterleaved(
    size: number,
    nodes?: number[]
  ): { pointer: number; nodes: number[] } {
    const targetNodes = nodes ?? this.topology.nodes.map(n => n.nodeId);
    const chunkSize = Math.ceil(size / targetNodes.length);

    const pointer = this.nextPointer++;
    const actualNodes: number[] = [];

    let allocated = 0;
    for (const nodeId of targetNodes) {
      if (allocated >= size) break;

      const toAlloc = Math.min(chunkSize, size - allocated);
      try {
        this.allocateOnNode(toAlloc, nodeId);
        actualNodes.push(nodeId);
        allocated += toAlloc;
      } catch (e) {
        // Skip this node if allocation fails
        continue;
      }
    }

    if (allocated < size) {
      throw new Error(
        `Could not allocate interleaved memory: only ${allocated}/${size} bytes allocated`
      );
    }

    return { pointer, nodes: actualNodes };
  }

  /**
   * Get memory locality info
   * @param pointer Memory pointer
   * @returns Locality info
   */
  getLocality(pointer: number): {
    nodeId: number;
    isLocal: boolean;
    accessCost: number;
  } {
    const alloc = this.allocations.get(`ptr_${pointer}`);
    if (!alloc) {
      throw new Error(`Unknown pointer: ${pointer}`);
    }

    return {
      nodeId: alloc.nodeId,
      isLocal: true, // Would need CPU context to determine
      accessCost: 100, // Base cost in nanoseconds
    };
  }

  /**
   * Migrate memory to another node
   * @param pointer Memory pointer
   * @param toNode Destination node ID
   */
  async migrate(pointer: number, toNode: number): Promise<void> {
    const alloc = this.allocations.get(`ptr_${pointer}`);
    if (!alloc) {
      throw new Error(`Unknown pointer: ${pointer}`);
    }

    const fromStats = this.memoryByNode.get(alloc.nodeId);
    const toStats = this.memoryByNode.get(toNode);

    if (!fromStats || !toStats) {
      throw new Error(`Invalid node ID`);
    }

    if (toStats.free < alloc.size) {
      throw new Error(`Insufficient memory on target node ${toNode}`);
    }

    // Simulate migration
    await new Promise(resolve => setTimeout(resolve, 1));

    fromStats.used -= alloc.size;
    fromStats.free += alloc.size;
    toStats.used += alloc.size;
    toStats.free -= alloc.size;

    alloc.nodeId = toNode;
  }

  /**
   * Prefetch memory to local node
   * @param pointer Memory pointer
   * @param cpuId CPU ID
   */
  prefetch(pointer: number, cpuId: number): void {
    const alloc = this.allocations.get(`ptr_${pointer}`);
    if (!alloc) {
      throw new Error(`Unknown pointer: ${pointer}`);
    }

    const localNode = this.topology.getPreferredNode(cpuId);
    if (localNode === alloc.nodeId) {
      // Already local
      return;
    }

    // Would trigger hardware prefetch in real implementation
    // For now, just track the intent
  }

  /**
   * Get memory statistics by node
   * @returns Map of node ID to memory stats
   */
  getMemoryStats(): Map<number, MemoryStats> {
    return new Map(this.memoryByNode);
  }

  /**
   * Free memory allocation
   * @param pointer Memory pointer
   */
  free(pointer: number): void {
    const alloc = this.allocations.get(`ptr_${pointer}`);
    if (!alloc) {
      throw new Error(`Unknown pointer: ${pointer}`);
    }

    const stats = this.memoryByNode.get(alloc.nodeId);
    if (stats) {
      stats.used -= alloc.size;
      stats.free += alloc.size;
    }

    this.allocations.delete(`ptr_${pointer}`);
  }
}

/**
 * NUMA-aware CPU scheduler
 *
 * Schedules tasks on optimal CPUs based on NUMA topology.
 * Supports CPU binding, migration, and placement optimization.
 */
export class NUMACPUScheduler {
  private tasks: Map<string, NUMATask> = new Map();
  private cpuStats: Map<number, CPUStats> = new Map();
  private taskPlacements: Map<string, NUMAPlacement> = new Map();

  constructor(private topology: NUMATopology) {
    this.initializeCPUStats();
  }

  /**
   * Initialize CPU statistics for all nodes
   */
  private initializeCPUStats(): void {
    this.topology.nodes.forEach(node => {
      node.cpus.forEach(cpu => {
        this.cpuStats.set(cpu, {
          usage: 0,
          localMemoryAccess: 0,
          remoteMemoryAccess: 0,
          tasks: 0,
          migrations: 0,
        });
      });
    });
  }

  /**
   * Schedule task on optimal CPU
   * @param task Task to schedule
   * @param preferredCPU Preferred CPU ID
   * @returns Scheduled CPU ID
   */
  schedule(task: NUMATask, preferredCPU?: number): number {
    let nodeId: number;

    // Determine target node
    if (preferredCPU !== undefined) {
      nodeId = this.topology.getPreferredNode(preferredCPU);
    } else if (task.currentNode !== undefined) {
      nodeId = task.currentNode;
    } else {
      // Select node with most free resources
      nodeId = this.selectBestNode(task);
    }

    // Select CPU on node
    const cpus = this.topology.getCPUs(nodeId);
    if (cpus.length === 0) {
      throw new Error(`No CPUs available on node ${nodeId}`);
    }

    let bestCPU: number;

    // If preferred CPU is specified and is on the target node, use it
    if (preferredCPU !== undefined && cpus.includes(preferredCPU)) {
      bestCPU = preferredCPU;
    } else {
      // Find least loaded CPU
      bestCPU = cpus[0];
      let minLoad = this.cpuStats.get(bestCPU)?.tasks ?? 0;

      for (const cpu of cpus) {
        const stats = this.cpuStats.get(cpu);
        if (stats && stats.tasks < minLoad) {
          bestCPU = cpu;
          minLoad = stats.tasks;
        }
      }
    }

    // Update task and stats
    task.currentNode = nodeId;
    task.currentCPUs = [bestCPU];

    const stats = this.cpuStats.get(bestCPU);
    if (stats) {
      stats.tasks++;
    }

    this.tasks.set(task.taskId, task);

    // Record placement
    this.taskPlacements.set(task.taskId, {
      nodeId,
      cpus: [bestCPU],
      localMemory: task.memoryBytes,
      remoteMemory: 0,
      isOptimal: true,
      score: 1.0,
    });

    return bestCPU;
  }

  /**
   * Select best node for task
   * @param task Task to place
   * @returns Best node ID
   */
  private selectBestNode(task: NUMATask): number {
    let bestNode = 0;
    let bestScore = -1;

    for (const node of this.topology.nodes) {
      const stats = Array.from(node.cpus)
        .map(cpu => this.cpuStats.get(cpu))
        .filter((s): s is CPUStats => s !== undefined);

      const avgTasks =
        stats.reduce((sum, s) => sum + s.tasks, 0) / stats.length;
      const score = 1 - avgTasks / node.cpus.length;

      if (score > bestScore) {
        bestScore = score;
        bestNode = node.nodeId;
      }
    }

    return bestNode;
  }

  /**
   * Bind task to specific CPUs
   * @param taskId Task ID
   * @param cpus CPU IDs to bind to
   */
  bindToCPUs(taskId: string, cpus: number[]): void {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`);
    }

    // Unbind from previous CPUs
    if (task.currentCPUs) {
      for (const cpu of task.currentCPUs) {
        const stats = this.cpuStats.get(cpu);
        if (stats) {
          stats.tasks--;
        }
      }
    }

    // Bind to new CPUs
    task.currentCPUs = cpus;
    for (const cpu of cpus) {
      const stats = this.cpuStats.get(cpu);
      if (stats) {
        stats.tasks++;
      }
    }

    // Determine node from first CPU
    const nodeId = this.topology.getPreferredNode(cpus[0]);
    task.currentNode = nodeId;

    // Update placement to reflect new CPUs
    const placement = this.taskPlacements.get(taskId);
    if (placement) {
      placement.cpus = cpus;
      placement.nodeId = nodeId;
    }
  }

  /**
   * Get task placement
   * @param taskId Task ID
   * @returns Task placement
   */
  getPlacement(taskId: string): NUMAPlacement {
    const placement = this.taskPlacements.get(taskId);
    if (!placement) {
      throw new Error(`Unknown task: ${taskId}`);
    }
    return placement;
  }

  /**
   * Migrate task to better node
   * @param taskId Task ID
   */
  async migrate(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Unknown task: ${taskId}`);
    }

    // Find better node
    const newNode = this.selectBestNode(task);
    if (newNode === task.currentNode) {
      // Already on best node
      return;
    }

    // Get CPUs on new node
    const newCPUs = this.topology.getCPUs(newNode);
    if (newCPUs.length === 0) {
      throw new Error(`No CPUs available on node ${newNode}`);
    }

    // Migrate
    this.bindToCPUs(taskId, [newCPUs[0]]);

    // Update migration stats
    const stats = this.cpuStats.get(newCPUs[0]);
    if (stats) {
      stats.migrations++;
    }
  }

  /**
   * Get CPU statistics by node
   * @returns Map of node ID to CPU stats
   */
  getCPUStats(): Map<number, CPUStats> {
    const nodeStats = new Map<number, CPUStats>();

    this.topology.nodes.forEach(node => {
      const nodeCPUs = node.cpus;
      const stats = nodeCPUs
        .map(cpu => this.cpuStats.get(cpu))
        .filter((s): s is CPUStats => s !== undefined);

      // Aggregate stats for node
      const agg: CPUStats = {
        usage: stats.reduce((sum, s) => sum + s.usage, 0) / stats.length,
        localMemoryAccess: stats.reduce(
          (sum, s) => sum + s.localMemoryAccess,
          0
        ),
        remoteMemoryAccess: stats.reduce(
          (sum, s) => sum + s.remoteMemoryAccess,
          0
        ),
        tasks: stats.reduce((sum, s) => sum + s.tasks, 0),
        migrations: stats.reduce((sum, s) => sum + s.migrations, 0),
      };

      nodeStats.set(node.nodeId, agg);
    });

    return nodeStats;
  }
}

/**
 * NUMA-aware resource allocator
 *
 * Allocates CPU and memory resources with NUMA topology awareness.
 * Supports multiple strategies: pack, spread, and balanced.
 */
export class NUMAAllocator {
  private allocations: Map<string, AllocationResult> = new Map();
  private allocationHistory: AllocationResult[] = [];
  private stats: NUMAAllocatorStats = {
    totalAllocations: 0,
    activeAllocations: 0,
    allocationsByNode: [],
    avgLocalAccessRatio: 1.0,
    avgCrossNodeTraffic: 0,
    loadBalanceScore: 1.0,
    rebalanceCount: 0,
  };

  private memoryManager: NUMAMemoryManager;
  private cpuScheduler: NUMACPUScheduler;
  private rebalanceTimer?: NodeJS.Timeout;

  constructor(
    private topology: NUMATopology,
    private config: Partial<NUMAAllocatorConfig> = {}
  ) {
    const fullConfig: NUMAAllocatorConfig = {
      strategy: "balanced",
      maxMemoryUsage: 0.9,
      maxCPUUsage: 0.9,
      enableRebalancing: false,
      rebalanceInterval: 60000,
      allowCrossNode: true,
      crossNodePenalty: 1.5,
      localLatency: 100,
      remoteLatency: 200,
      localBandwidth: 50 * 1024 * 1024 * 1024, // 50 GB/s
      remoteBandwidth: 25 * 1024 * 1024 * 1024, // 25 GB/s
      ...config,
    };

    this.config = fullConfig;
    this.memoryManager = new NUMAMemoryManager(topology);
    this.cpuScheduler = new NUMACPUScheduler(topology);

    // Initialize stats
    this.stats.allocationsByNode = new Array(topology.numNodes).fill(0);

    // Start rebalancing if enabled
    if (fullConfig.enableRebalancing) {
      this.startRebalancing();
    }
  }

  /**
   * Allocate resources based on request
   * @param request Allocation request
   * @returns Allocation result
   */
  allocate(request: AllocationRequest): AllocationResult {
    const nodeId = this.selectNode(request);
    const cpus = this.selectCPUs(nodeId, request.cpuCount);

    // Validate memory availability
    const node = this.topology.nodes[nodeId];
    const memoryAvailable = node.memory.free >= request.memoryBytes;

    if (!memoryAvailable && this.config.allowCrossNode) {
      // Try to allocate across nodes
      return this.allocateCrossNode(request);
    }

    // Estimate performance
    const { estimatedLatency, estimatedBandwidth } = this.estimatePerformance(
      nodeId,
      cpus,
      request.memoryBytes
    );

    const result: AllocationResult = {
      nodeId,
      cpus,
      memoryBytes: request.memoryBytes,
      reasoning: this.generateReasoning(request, nodeId, cpus),
      estimatedLatency,
      estimatedBandwidth,
      isFallback: false,
    };

    // Track allocation
    if (request.taskId) {
      this.allocations.set(request.taskId, result);
      this.stats.activeAllocations++;
    }

    this.stats.totalAllocations++;
    this.stats.allocationsByNode[nodeId]++;
    this.allocationHistory.push(result);

    return result;
  }

  /**
   * Select best node for allocation
   * @param request Allocation request
   * @returns Selected node ID
   */
  private selectNode(request: AllocationRequest): number {
    const strategy = this.config.strategy ?? "balanced";

    // Handle strict affinity
    if (request.affinity === "strict" && request.preferredNode !== undefined) {
      return request.preferredNode;
    }

    // Handle preferred CPU
    if (request.preferredCPU !== undefined) {
      const preferredNode = this.topology.getPreferredNode(
        request.preferredCPU
      );
      if (preferredNode >= 0) {
        return preferredNode;
      }
    }

    // Handle preferred node
    if (request.preferredNode !== undefined) {
      if (request.affinity === "prefer") {
        return request.preferredNode;
      }
    }

    // Select based on strategy
    switch (strategy) {
      case "pack":
        return this.selectNodePack(request);
      case "spread":
        return this.selectNodeSpread(request);
      case "balanced":
      default:
        return this.selectNodeBalanced(request);
    }
  }

  /**
   * Select node using pack strategy (fill nodes sequentially)
   * @param request Allocation request
   * @returns Selected node ID
   */
  private selectNodePack(request: AllocationRequest): number {
    let bestNode = 0;
    let mostAllocations = -1;

    for (let i = 0; i < this.topology.numNodes; i++) {
      const node = this.topology.nodes[i];
      const usage = node.memory.used / node.memory.total;

      if (usage < (this.config.maxMemoryUsage ?? 0.9)) {
        if (this.stats.allocationsByNode[i] > mostAllocations) {
          mostAllocations = this.stats.allocationsByNode[i];
          bestNode = i;
        }
      }
    }

    return bestNode;
  }

  /**
   * Select node using spread strategy (distribute evenly)
   * @param request Allocation request
   * @returns Selected node ID
   */
  private selectNodeSpread(request: AllocationRequest): number {
    let bestNode = 0;
    let fewestAllocations = Infinity;

    for (let i = 0; i < this.topology.numNodes; i++) {
      const node = this.topology.nodes[i];
      const usage = node.memory.used / node.memory.total;

      if (usage < (this.config.maxMemoryUsage ?? 0.9)) {
        if (this.stats.allocationsByNode[i] < fewestAllocations) {
          fewestAllocations = this.stats.allocationsByNode[i];
          bestNode = i;
        }
      }
    }

    return bestNode;
  }

  /**
   * Select node using balanced strategy
   * @param request Allocation request
   * @returns Selected node ID
   */
  private selectNodeBalanced(request: AllocationRequest): number {
    // Calculate score for each node
    const scores = this.topology.nodes.map((node, i) => {
      const memoryUsage = node.memory.used / node.memory.total;
      const allocationCount = this.stats.allocationsByNode[i];
      const cpuCount = node.cpus.length;

      // Lower memory usage and fewer allocations is better
      return (
        (1 - memoryUsage) * 0.6 + (1 - allocationCount / (cpuCount * 2)) * 0.4
      );
    });

    // Return node with highest score
    let bestNode = 0;
    let bestScore = -1;

    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestNode = i;
      }
    }

    return bestNode;
  }

  /**
   * Select CPUs on a node
   * @param nodeId Node ID
   * @param count Number of CPUs to select
   * @returns Array of CPU IDs
   */
  private selectCPUs(nodeId: number, count: number): number[] {
    const node = this.topology.nodes[nodeId];
    const availableCPUs = node.cpus;

    if (count > availableCPUs.length) {
      throw new Error(
        `Requested ${count} CPUs but node ${nodeId} only has ${availableCPUs.length}`
      );
    }

    // Return first N CPUs (simple round-robin)
    return availableCPUs.slice(0, count);
  }

  /**
   * Allocate across multiple nodes (fallback)
   * @param request Allocation request
   * @returns Allocation result
   */
  private allocateCrossNode(request: AllocationRequest): AllocationResult {
    // Find node with most free memory
    let bestNode = 0;
    let mostFree = 0;

    for (let i = 0; i < this.topology.numNodes; i++) {
      const node = this.topology.nodes[i];
      if (node.memory.free > mostFree) {
        mostFree = node.memory.free;
        bestNode = i;
      }
    }

    const cpus = this.selectCPUs(bestNode, request.cpuCount);

    // Apply cross-node penalty
    const penalty = this.config.crossNodePenalty ?? 1.5;

    return {
      nodeId: bestNode,
      cpus,
      memoryBytes: request.memoryBytes,
      reasoning: `Cross-node allocation due to insufficient local memory`,
      estimatedLatency: (this.config.remoteLatency ?? 200) * penalty,
      estimatedBandwidth:
        (this.config.remoteBandwidth ?? 25 * 1024 * 1024 * 1024) / penalty,
      isFallback: true,
      fallbackReason: "Insufficient local memory",
    };
  }

  /**
   * Estimate performance characteristics
   * @param nodeId Node ID
   * @param cpus CPU IDs
   * @param memoryBytes Memory size
   * @returns Latency and bandwidth estimates
   */
  private estimatePerformance(
    nodeId: number,
    cpus: number[],
    memoryBytes: number
  ): { estimatedLatency: number; estimatedBandwidth: number } {
    const config = this.config;

    // Check if allocation is local to CPUs
    const isLocal = cpus.every(
      cpu => this.topology.getPreferredNode(cpu) === nodeId
    );

    const estimatedLatency = isLocal
      ? (config.localLatency ?? 100)
      : (config.remoteLatency ?? 200);

    const estimatedBandwidth = isLocal
      ? (config.localBandwidth ?? 50 * 1024 * 1024 * 1024)
      : (config.remoteBandwidth ?? 25 * 1024 * 1024 * 1024);

    return { estimatedLatency, estimatedBandwidth };
  }

  /**
   * Generate explanation of allocation decision
   * @param request Allocation request
   * @param nodeId Selected node
   * @param cpus Selected CPUs
   * @returns Human-readable reasoning
   */
  private generateReasoning(
    request: AllocationRequest,
    nodeId: number,
    cpus: number[]
  ): string {
    const parts: string[] = [];

    const strategy = this.config.strategy ?? "balanced";
    parts.push(`Strategy: ${strategy}`);

    if (request.preferredNode !== undefined) {
      if (request.affinity === "strict") {
        parts.push(`Strict affinity to node ${request.preferredNode}`);
      } else if (request.affinity === "prefer") {
        parts.push(`Preferred node ${request.preferredNode}`);
      }
    }

    if (request.preferredCPU !== undefined) {
      parts.push(
        `Preferred CPU ${request.preferredCPU} (local to node ${nodeId})`
      );
    }

    const node = this.topology.nodes[nodeId];
    parts.push(
      `Node ${nodeId}: ${node.cpus.length} CPUs, ${(node.memory.free / 1024 / 1024 / 1024).toFixed(2)} GB free`
    );

    return parts.join(". ");
  }

  /**
   * Check if allocation is possible
   * @param request Allocation request
   * @returns True if allocation possible
   */
  canAllocate(request: AllocationRequest): boolean {
    for (const node of this.topology.nodes) {
      if (
        node.memory.free >= request.memoryBytes &&
        node.cpus.length >= request.cpuCount
      ) {
        return true;
      }
    }
    return this.config.allowCrossNode ?? true;
  }

  /**
   * Free allocation
   * @param allocation Allocation to free
   */
  free(allocation: AllocationResult): void {
    // Find task ID for this allocation
    let taskId: string | undefined;
    for (const [id, alloc] of this.allocations.entries()) {
      if (alloc === allocation) {
        taskId = id;
        break;
      }
    }

    if (taskId) {
      this.allocations.delete(taskId);
      this.stats.activeAllocations--;
    }
  }

  /**
   * Get current allocations
   * @returns Map of task ID to allocation
   */
  getAllocations(): Map<string, AllocationResult> {
    return new Map(this.allocations);
  }

  /**
   * Get allocator statistics
   * @returns Allocator statistics
   */
  getStats(): NUMAAllocatorStats {
    // Update load balance score
    const meanAllocations =
      this.stats.allocationsByNode.reduce((a, b) => a + b, 0) /
      this.topology.numNodes;

    const variance =
      this.stats.allocationsByNode.reduce(
        (sum, count) => sum + Math.pow(count - meanAllocations, 2),
        0
      ) / this.topology.numNodes;

    const cv = meanAllocations > 0 ? Math.sqrt(variance) / meanAllocations : 0;
    this.stats.loadBalanceScore = Math.max(0, 1 - cv);

    return { ...this.stats };
  }

  /**
   * Rebalance allocations across nodes
   */
  rebalance(): void {
    this.stats.rebalanceCount++;
    this.stats.lastRebalance = Date.now();

    // Simple rebalancing: move tasks from over-utilized to under-utilized nodes
    const meanAllocations =
      this.stats.allocationsByNode.reduce((a, b) => a + b, 0) /
      this.topology.numNodes;

    // Find nodes above and below mean
    const aboveMean: number[] = [];
    const belowMean: number[] = [];

    for (let i = 0; i < this.topology.numNodes; i++) {
      if (this.stats.allocationsByNode[i] > meanAllocations * 1.2) {
        aboveMean.push(i);
      } else if (this.stats.allocationsByNode[i] < meanAllocations * 0.8) {
        belowMean.push(i);
      }
    }

    // In a real implementation, would migrate tasks here
    // For now, just track the rebalance event
  }

  /**
   * Start automatic rebalancing
   */
  private startRebalancing(): void {
    if (this.rebalanceTimer) {
      clearInterval(this.rebalanceTimer);
    }

    const interval = this.config.rebalanceInterval ?? 60000;
    this.rebalanceTimer = setInterval(() => {
      this.rebalance();
    }, interval);
  }

  /**
   * Stop automatic rebalancing
   */
  stopRebalancing(): void {
    if (this.rebalanceTimer) {
      clearInterval(this.rebalanceTimer);
      this.rebalanceTimer = undefined;
    }
  }

  /**
   * Get memory manager
   * @returns Memory manager instance
   */
  getMemoryManager(): NUMAMemoryManager {
    return this.memoryManager;
  }

  /**
   * Get CPU scheduler
   * @returns CPU scheduler instance
   */
  getCPUScheduler(): NUMACPUScheduler {
    return this.cpuScheduler;
  }
}

/**
 * Create a NUMA allocator with default configuration
 * @param topology NUMA topology
 * @param config Optional configuration
 * @returns NUMA allocator instance
 */
export function createNUMAAllocator(
  topology: NUMATopology,
  config?: Partial<NUMAAllocatorConfig>
): NUMAAllocator {
  return new NUMAAllocator(topology, config);
}
