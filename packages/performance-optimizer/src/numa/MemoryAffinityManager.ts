/**
 * NUMA Memory Affinity Manager
 *
 * Manages memory allocation with NUMA affinity policies.
 * Ensures memory is allocated on the optimal node for performance.
 */

import type {
  NUMATopology,
  NUMANodeId,
  NUMAMemoryPolicy,
  NUMAMemoryAllocation,
  NUMAMemoryAffinityRequest,
  NUMAMemoryAffinityResult,
  INUMAMemoryAffinityManager,
  MemorySize,
} from '@lsi/protocol';

/**
 * Memory allocation tracking
 */
interface AllocationRecord {
  allocation: NUMAMemoryAllocation;
  taskId: string;
  createdAt: number;
  lastAccessed: number;
}

/**
 * Memory pool per node
 */
interface NodeMemoryPool {
  nodeId: NUMANodeId;
  allocated: MemorySize;
  available: MemorySize;
  allocations: Map<string, AllocationRecord>;
}

/**
 * Memory Affinity Manager Implementation
 */
export class MemoryAffinityManager implements INUMAMemoryAffinityManager {
  private topology?: NUMATopology;
  private pools: Map<NUMANodeId, NodeMemoryPool>;
  private allocationCounter: number;

  constructor() {
    this.pools = new Map();
    this.allocationCounter = 0;
  }

  /**
   * Set memory affinity for a task
   */
  async setMemoryAffinity(request: NUMAMemoryAffinityRequest): Promise<NUMAMemoryAffinityResult> {
    if (!this.topology) {
      return {
        requestId: this.generateRequestId(),
        taskId: request.taskId,
        success: false,
        nodeId: 0,
        error: 'Topology not initialized',
      };
    }

    // Determine target node based on policy
    const targetNode = this.selectTargetNode(request);

    // Check if allocation is possible
    const pool = this.pools.get(targetNode);
    if (!pool || pool.available < request.size) {
      // Try fallback to other nodes if allowed
      if (request.allowRemote) {
        return this.fallbackAllocation(request);
      }

      return {
        requestId: this.generateRequestId(),
        taskId: request.taskId,
        success: false,
        nodeId: targetNode,
        error: `Insufficient memory on node ${targetNode}`,
      };
    }

    // Perform allocation
    const allocation = await this.allocateMemoryOnNode(request, targetNode);

    return {
      requestId: this.generateRequestId(),
      taskId: request.taskId,
      success: true,
      nodeId: targetNode,
      allocation,
      fallbackUsed: false,
    };
  }

  /**
   * Get memory affinity for a task
   */
  async getMemoryAffinity(taskId: string): Promise<NUMAMemoryAffinityResult | null> {
    for (const [nodeId, pool] of this.pools.entries()) {
      for (const [allocId, record] of pool.allocations.entries()) {
        if (record.taskId === taskId) {
          return {
            requestId: allocId,
            taskId,
            success: true,
            nodeId,
            allocation: record.allocation,
          };
        }
      }
    }

    return null;
  }

  /**
   * Update memory policy for a task
   */
  async updateMemoryPolicy(taskId: string, policy: NUMAMemoryPolicy): Promise<boolean> {
    // Find the task's allocation
    for (const pool of this.pools.values()) {
      for (const record of pool.allocations.values()) {
        if (record.taskId === taskId) {
          // In a real implementation, this would update the OS memory policy
          // For now, we just track the change
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Allocate memory on specific node
   */
  async allocateMemory(request: NUMAMemoryAffinityRequest): Promise<NUMAMemoryAllocation> {
    if (!this.topology) {
      throw new Error('Topology not initialized');
    }

    const targetNode = this.selectTargetNode(request);
    return await this.allocateMemoryOnNode(request, targetNode);
  }

  /**
   * Free memory allocation
   */
  async freeMemory(allocationId: string): Promise<boolean> {
    for (const [nodeId, pool] of this.pools.entries()) {
      const record = pool.allocations.get(allocationId);
      if (record) {
        // Return memory to pool
        pool.allocated -= record.allocation.size;
        pool.available += record.allocation.size;
        pool.allocations.delete(allocationId);
        return true;
      }
    }

    return false;
  }

  /**
   * Initialize with topology
   */
  initializeTopology(topology: NUMATopology): void {
    this.topology = topology;
    this.pools.clear();

    // Create memory pools for each node
    for (const [nodeId, node] of topology.nodes.entries()) {
      this.pools.set(nodeId, {
        nodeId,
        allocated: 0 as MemorySize,
        available: node.totalMemory,
        allocations: new Map(),
      });
    }
  }

  /**
   * Get memory statistics
   */
  getMemoryStatistics(): Map<NUMANodeId, { allocated: MemorySize; available: MemorySize; utilization: number }> {
    const stats = new Map();

    for (const [nodeId, pool] of this.pools.entries()) {
      const node = this.topology!.nodes.get(nodeId)!;
      const utilization = pool.allocated / node.totalMemory;

      stats.set(nodeId, {
        allocated: pool.allocated,
        available: pool.available,
        utilization,
      });
    }

    return stats;
  }

  /**
   * Select target node based on policy
   */
  private selectTargetNode(request: NUMAMemoryAffinityRequest): NUMANodeId {
    if (!this.topology) {
      return 0;
    }

    const policy = request.policy;
    const preferredNodes = request.preferredNodes;

    switch (policy) {
      case 'bind':
        // Allocate only on preferred nodes
        if (preferredNodes && preferredNodes.length > 0) {
          for (const nodeId of preferredNodes) {
            const pool = this.pools.get(nodeId);
            if (pool && pool.available >= request.size) {
              return nodeId;
            }
          }
        }
        // Fall through to default if no preferred nodes with capacity
        return this.findNodeWithMostMemory(request.size);

      case 'interleave':
        // Round-robin across nodes
        return this.selectRoundRobinNode(request.size);

      case 'preferred':
        // Try preferred node first, then any node
        if (preferredNodes && preferredNodes.length > 0) {
          const pool = this.pools.get(preferredNodes[0]);
          if (pool && pool.available >= request.size) {
            return preferredNodes[0];
          }
        }
        return this.findNodeWithMostMemory(request.size);

      case 'local':
        // Allocate on local node (node 0 for single-threaded)
        return this.findLocalNode(request.size);

      case 'default':
      default:
        // Default policy: allocate on node with most free memory
        return this.findNodeWithMostMemory(request.size);
    }
  }

  /**
   * Find node with most available memory
   */
  private findNodeWithMostMemory(size: MemorySize): NUMANodeId {
    let bestNode = 0;
    let maxAvailable = 0;

    for (const [nodeId, pool] of this.pools.entries()) {
      if (pool.available >= size && pool.available > maxAvailable) {
        maxAvailable = pool.available;
        bestNode = nodeId;
      }
    }

    return bestNode;
  }

  /**
   * Select node using round-robin
   */
  private selectRoundRobinNode(size: MemorySize): NUMANodeId {
    const nodeIds = Array.from(this.pools.keys());
    const startIndex = this.allocationCounter % nodeIds.length;

    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[(startIndex + i) % nodeIds.length];
      const pool = this.pools.get(nodeId);
      if (pool && pool.available >= size) {
        this.allocationCounter++;
        return nodeId;
      }
    }

    // Fallback to first node
    return nodeIds[0];
  }

  /**
   * Find local node (simplified)
   */
  private findLocalNode(size: MemorySize): NUMANodeId {
    // In a real implementation, this would use the current CPU's node
    // For now, use node 0
    const pool = this.pools.get(0);
    if (pool && pool.available >= size) {
      return 0;
    }

    return this.findNodeWithMostMemory(size);
  }

  /**
   * Allocate memory on specific node
   */
  private async allocateMemoryOnNode(
    request: NUMAMemoryAffinityRequest,
    nodeId: NUMANodeId
  ): Promise<NUMAMemoryAllocation> {
    const pool = this.pools.get(nodeId)!;
    const allocationId = this.generateAllocationId();

    // Update pool
    pool.allocated += request.size;
    pool.available -= request.size;

    // Create allocation record
    const allocation: NUMAMemoryAllocation = {
      allocationId,
      taskId: request.taskId,
      nodeId,
      size: request.size,
      addressRange: {
        start: BigInt(0x1000 * (this.allocationCounter + 1)),
        end: BigInt(0x1000 * (this.allocationCounter + 1) + request.size - 1),
      },
      isLocal: true,
      timestamp: Date.now(),
    };

    const record: AllocationRecord = {
      allocation,
      taskId: request.taskId,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    pool.allocations.set(allocationId, record);
    this.allocationCounter++;

    return allocation;
  }

  /**
   * Fallback allocation to remote node
   */
  private async fallbackAllocation(request: NUMAMemoryAffinityRequest): Promise<NUMAMemoryAffinityResult> {
    // Find any node with available memory
    for (const [nodeId, pool] of this.pools.entries()) {
      if (pool.available >= request.size) {
        const allocation = await this.allocateMemoryOnNode(request, nodeId);

        return {
          requestId: this.generateRequestId(),
          taskId: request.taskId,
          success: true,
          nodeId,
          allocation,
          fallbackUsed: true,
        };
      }
    }

    return {
      requestId: this.generateRequestId(),
      taskId: request.taskId,
      success: false,
      nodeId: 0,
      error: 'No node has sufficient memory',
    };
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate allocation ID
   */
  private generateAllocationId(): string {
    return `alloc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up old allocations
   */
  cleanup(olderThan: number = 3600000): void {
    const now = Date.now();

    for (const [nodeId, pool] of this.pools.entries()) {
      for (const [allocId, record] of pool.allocations.entries()) {
        if ((now - record.lastAccessed) > olderThan) {
          this.freeMemory(allocId);
        }
      }
    }
  }

  /**
   * Get total memory usage
   */
  getTotalMemoryUsage(): { total: MemorySize; allocated: MemorySize; available: MemorySize } {
    let total = 0 as MemorySize;
    let allocated = 0 as MemorySize;
    let available = 0 as MemorySize;

    for (const pool of this.pools.values()) {
      allocated += pool.allocated;
      available += pool.available;
    }

    total = (allocated + available) as MemorySize;

    return { total, allocated, available };
  }

  /**
   * Reset all allocations
   */
  reset(): void {
    this.pools.clear();
    this.allocationCounter = 0;

    if (this.topology) {
      this.initializeTopology(this.topology);
    }
  }
}
