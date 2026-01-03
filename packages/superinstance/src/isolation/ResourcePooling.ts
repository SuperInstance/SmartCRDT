/**
 * @fileoverview Resource Pooling - Multi-Tenant Resource Pool Management
 *
 * Manages resource pools for tenants with different isolation levels:
 * - Dedicated pools (exclusive resources for enterprise tenants)
 * - Shared pools (shared resources with priority scheduling)
 * - Hybrid pools (mix of dedicated and shared)
 *
 * @module @lsi/superinstance/isolation/ResourcePooling
 */

import type {
  TenantId,
  ResourcePoolType,
  ResourcePoolAllocation,
  AllocatedResources,
  ResourcePoolPriority,
} from "@lsi/protocol";

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Resource pool error
 */
export class ResourcePoolError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId?: TenantId
  ) {
    super(message);
    this.name = "ResourcePoolError";
  }
}

/**
 * Resource unavailable error
 */
export class ResourceUnavailableError extends ResourcePoolError {
  constructor(
    tenantId: TenantId,
    public resourceType: string
  ) {
    super(
      `Resource unavailable for tenant ${tenantId}: ${resourceType}`,
      "RESOURCE_UNAVAILABLE",
      tenantId
    );
    this.name = "ResourceUnavailableError";
  }
}

// ============================================================================
// RESOURCE POOL
// ============================================================================

/**
 * Resource pool
 *
 * Represents a pool of resources that can be allocated to tenants.
 */
class ResourcePool {
  id: string;
  type: ResourcePoolType;
  totalResources: AllocatedResources;
  allocatedResources: Map<TenantId, AllocatedResources> = new Map();
  waitingQueue: TenantId[] = [];

  constructor(
    id: string,
    type: ResourcePoolType,
    totalResources: AllocatedResources
  ) {
    this.id = id;
    this.type = type;
    this.totalResources = totalResources;
  }

  /**
   * Get available resources
   */
  getAvailableResources(): AllocatedResources {
    let allocatedCpuCores = 0;
    let allocatedMemoryBytes = 0;
    let allocatedGpu = 0;
    let allocatedStorageBytes = 0;
    let allocatedNetworkBandwidth = 0;

    for (const resources of this.allocatedResources.values()) {
      allocatedCpuCores += resources.cpuCores || 0;
      allocatedMemoryBytes += resources.memoryBytes || 0;
      allocatedGpu += typeof resources.gpu === "number" ? resources.gpu : 0;
      allocatedStorageBytes += resources.storageBytes || 0;
      allocatedNetworkBandwidth += resources.networkBandwidth || 0;
    }

    return {
      cpuCores: (this.totalResources.cpuCores || 0) - allocatedCpuCores,
      memoryBytes: (this.totalResources.memoryBytes || 0) - allocatedMemoryBytes,
      gpu: (this.totalResources.gpu || 0) - allocatedGpu,
      storageBytes: (this.totalResources.storageBytes || 0) - allocatedStorageBytes,
      networkBandwidth: (this.totalResources.networkBandwidth || 0) - allocatedNetworkBandwidth,
    };
  }

  /**
   * Check if resources are available
   */
  hasAvailableResources(required: AllocatedResources): boolean {
    const available = this.getAvailableResources();

    return (
      (required.cpuCores === undefined || available.cpuCores! >= required.cpuCores) &&
      (required.memoryBytes === undefined || available.memoryBytes! >= required.memoryBytes) &&
      (required.gpu === undefined || available.gpu! >= required.gpu) &&
      (required.storageBytes === undefined || available.storageBytes! >= required.storageBytes) &&
      (required.networkBandwidth === undefined || available.networkBandwidth! >= required.networkBandwidth)
    );
  }

  /**
   * Allocate resources to tenant
   */
  allocate(tenantId: TenantId, resources: AllocatedResources): boolean {
    if (!this.hasAvailableResources(resources)) {
      return false;
    }

    this.allocatedResources.set(tenantId, resources);
    return true;
  }

  /**
   * Release resources from tenant
   */
  release(tenantId: TenantId): void {
    this.allocatedResources.delete(tenantId);
  }

  /**
   * Add tenant to waiting queue
   */
  addToQueue(tenantId: TenantId): void {
    if (!this.waitingQueue.includes(tenantId)) {
      this.waitingQueue.push(tenantId);
    }
  }

  /**
   * Remove tenant from waiting queue
   */
  removeFromQueue(tenantId: TenantId): void {
    const index = this.waitingQueue.indexOf(tenantId);
    if (index > -1) {
      this.waitingQueue.splice(index, 1);
    }
  }

  /**
   * Get queue position
   */
  getQueuePosition(tenantId: TenantId): number {
    return this.waitingQueue.indexOf(tenantId);
  }
}

// ============================================================================
// RESOURCE POOL MANAGER
// ============================================================================

/**
 * Resource pool manager configuration
 */
export interface ResourcePoolManagerConfig {
  /** Enable priority scheduling */
  enablePriorityScheduling?: boolean;
  /** Enable fair allocation */
  enableFairAllocation?: boolean;
  /** Maximum wait time in queue (ms) */
  maxQueueWaitTime?: number;
}

/**
 * Priority levels for scheduling
 */
const PRIORITY_LEVELS: Record<ResourcePoolPriority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Resource pool manager
 *
 * Manages resource pools and allocations for tenants.
 */
export class ResourcePoolManager {
  private config: ResourcePoolManagerConfig;
  private dedicatedPools: Map<TenantId, ResourcePool> = new Map();
  private sharedPools: Map<string, ResourcePool> = new Map();
  private allocations: Map<TenantId, ResourcePoolAllocation> = new Map();

  constructor(config?: ResourcePoolManagerConfig) {
    this.config = {
      enablePriorityScheduling: true,
      enableFairAllocation: true,
      maxQueueWaitTime: 60000, // 1 minute
      ...config,
    };

    // Initialize default shared pools
    this.initializeDefaultPools();
  }

  // ========================================================================
  // POOL MANAGEMENT
  // ========================================================================

  /**
   * Initialize default shared pools
   */
  private initializeDefaultPools(): void {
    // Create shared CPU pool
    this.sharedPools.set(
      "shared-cpu",
      new ResourcePool("shared-cpu", "shared", {
        cpuCores: 64,
        memoryBytes: 256 * 1024 * 1024 * 1024, // 256 GB
      })
    );

    // Create shared GPU pool
    this.sharedPools.set(
      "shared-gpu",
      new ResourcePool("shared-gpu", "shared", {
        gpu: 8,
      })
    );

    // Create shared storage pool
    this.sharedPools.set(
      "shared-storage",
      new ResourcePool("shared-storage", "shared", {
        storageBytes: 1024 * 1024 * 1024 * 1024, // 1 TB
      })
    );
  }

  /**
   * Create dedicated pool for tenant
   */
  createDedicatedPool(
    tenantId: TenantId,
    resources: AllocatedResources
  ): ResourcePool {
    const poolId = `dedicated-${tenantId}`;
    const pool = new ResourcePool(poolId, "dedicated", resources);
    this.dedicatedPools.set(tenantId, pool);
    return pool;
  }

  /**
   * Get pool for tenant
   */
  getPool(tenantId: TenantId): ResourcePool | undefined {
    // Check dedicated pool first
    const dedicatedPool = this.dedicatedPools.get(tenantId);
    if (dedicatedPool) {
      return dedicatedPool;
    }

    // Return default shared pool
    return this.sharedPools.get("shared-cpu");
  }

  // ========================================================================
  // RESOURCE ALLOCATION
  // ========================================================================

  /**
   * Allocate resources to tenant
   */
  async allocateResources(
    tenantId: TenantId,
    poolType: ResourcePoolType,
    requiredResources: AllocatedResources,
    priority: ResourcePoolPriority = "normal"
  ): Promise<ResourcePoolAllocation> {
    // Check if already allocated
    const existingAllocation = this.allocations.get(tenantId);
    if (existingAllocation) {
      return existingAllocation;
    }

    let pool: ResourcePool | undefined;
    let allocated = false;

    // Try dedicated pool first
    if (poolType === "dedicated") {
      pool = this.dedicatedPools.get(tenantId);
      if (!pool) {
        // Create new dedicated pool
        pool = this.createDedicatedPool(tenantId, requiredResources);
      }
      allocated = pool.allocate(tenantId, requiredResources);
    } else {
      // Try shared pools
      for (const sharedPool of this.sharedPools.values()) {
        if (sharedPool.hasAvailableResources(requiredResources)) {
          pool = sharedPool;

          // Check priority if enabled
          if (this.config.enablePriorityScheduling) {
            const canAllocate = this.canAllocateByPriority(
              tenantId,
              sharedPool,
              requiredResources,
              priority
            );
            if (!canAllocate) {
              sharedPool.addToQueue(tenantId);
              throw new ResourceUnavailableError(tenantId, "priority_queue");
            }
          }

          allocated = sharedPool.allocate(tenantId, requiredResources);
          if (allocated) {
            break;
          }
        }
      }
    }

    if (!allocated || !pool) {
      throw new ResourceUnavailableError(tenantId, "no_capacity");
    }

    // Create allocation record
    const allocation: ResourcePoolAllocation = {
      id: `allocation-${tenantId}-${Date.now()}`,
      tenantId,
      poolType,
      resources: requiredResources,
      priority,
      allocatedAt: Date.now(),
    };

    this.allocations.set(tenantId, allocation);

    return allocation;
  }

  /**
   * Release resources from tenant
   */
  releaseResources(tenantId: TenantId): void {
    const allocation = this.allocations.get(tenantId);
    if (!allocation) {
      return;
    }

    // Release from dedicated pool
    if (allocation.poolType === "dedicated") {
      const pool = this.dedicatedPools.get(tenantId);
      if (pool) {
        pool.release(tenantId);
      }
    } else {
      // Release from shared pools
      for (const pool of this.sharedPools.values()) {
        pool.release(tenantId);
        pool.removeFromQueue(tenantId);
      }
    }

    // Remove allocation record
    this.allocations.delete(tenantId);

    // Try to allocate to waiting tenants
    this.processWaitingQueues();
  }

  /**
   * Get allocation for tenant
   */
  getAllocation(tenantId: TenantId): ResourcePoolAllocation | undefined {
    return this.allocations.get(tenantId);
  }

  // ========================================================================
  // PRIORITY SCHEDULING
  // ========================================================================

  /**
   * Check if tenant can allocate based on priority
   */
  private canAllocateByPriority(
    tenantId: TenantId,
    pool: ResourcePool,
    requiredResources: AllocatedResources,
    priority: ResourcePoolPriority
  ): boolean {
    if (!this.config.enablePriorityScheduling) {
      return true;
    }

    const tenantPriority = PRIORITY_LEVELS[priority];

    // Check if any higher priority tenants are waiting
    for (const waitingTenantId of pool.waitingQueue) {
      const waitingAllocation = this.allocations.get(waitingTenantId);
      if (waitingAllocation) {
        const waitingPriority = PRIORITY_LEVELS[waitingAllocation.priority];
        if (waitingPriority > tenantPriority) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Process waiting queues
   */
  private processWaitingQueues(): void {
    for (const pool of this.sharedPools.values()) {
      // Sort queue by priority
      const sortedQueue = [...pool.waitingQueue].sort((a, b) => {
        const allocationA = this.allocations.get(a);
        const allocationB = this.allocations.get(b);
        const priorityA = allocationA ? PRIORITY_LEVELS[allocationA.priority] : 0;
        const priorityB = allocationB ? PRIORITY_LEVELS[allocationB.priority] : 0;
        return priorityB - priorityA;
      });

      // Try to allocate to waiting tenants
      for (const tenantId of sortedQueue) {
        const allocation = this.allocations.get(tenantId);
        if (allocation && pool.hasAvailableResources(allocation.resources)) {
          pool.allocate(tenantId, allocation.resources);
          pool.removeFromQueue(tenantId);
        }
      }
    }
  }

  // ========================================================================
  // FAIR ALLOCATION
  // ========================================================================

  /**
   * Calculate fair share for tenant
   */
  calculateFairShare(
    tenantId: TenantId,
    poolId: string
  ): AllocatedResources | undefined {
    if (!this.config.enableFairAllocation) {
      return undefined;
    }

    const pool = this.sharedPools.get(poolId);
    if (!pool) {
      return undefined;
    }

    const totalTenants = pool.allocatedResources.size + 1; // Include current tenant

    const fairShare: AllocatedResources = {};

    if (pool.totalResources.cpuCores) {
      fairShare.cpuCores = Math.floor(pool.totalResources.cpuCores / totalTenants);
    }

    if (pool.totalResources.memoryBytes) {
      fairShare.memoryBytes = Math.floor(pool.totalResources.memoryBytes / totalTenants);
    }

    if (pool.totalResources.gpu) {
      fairShare.gpu = pool.totalResources.gpu / totalTenants;
    }

    if (pool.totalResources.storageBytes) {
      fairShare.storageBytes = Math.floor(pool.totalResources.storageBytes / totalTenants);
    }

    if (pool.totalResources.networkBandwidth) {
      fairShare.networkBandwidth = Math.floor(pool.totalResources.networkBandwidth / totalTenants);
    }

    return fairShare;
  }

  // ========================================================================
  // MONITORING
  // ========================================================================

  /**
   * Get pool utilization
   */
  getPoolUtilization(poolId: string): {
    total: AllocatedResources;
    used: AllocatedResources;
    available: AllocatedResources;
    utilizationPercentage: number;
  } | undefined {
    const pool = this.sharedPools.get(poolId) || this.dedicatedPools.get(poolId);
    if (!pool) {
      return undefined;
    }

    const available = pool.getAvailableResources();
    const used: AllocatedResources = {};

    if (pool.totalResources.cpuCores) {
      used.cpuCores = (pool.totalResources.cpuCores || 0) - (available.cpuCores || 0);
    }

    if (pool.totalResources.memoryBytes) {
      used.memoryBytes = (pool.totalResources.memoryBytes || 0) - (available.memoryBytes || 0);
    }

    if (pool.totalResources.gpu) {
      used.gpu = (pool.totalResources.gpu || 0) - (available.gpu || 0);
    }

    if (pool.totalResources.storageBytes) {
      used.storageBytes = (pool.totalResources.storageBytes || 0) - (available.storageBytes || 0);
    }

    if (pool.totalResources.networkBandwidth) {
      used.networkBandwidth = (pool.totalResources.networkBandwidth || 0) - (available.networkBandwidth || 0);
    }

    // Calculate overall utilization (simplified)
    let utilizationPercentage = 0;
    if (used.cpuCores && pool.totalResources.cpuCores) {
      utilizationPercentage = (used.cpuCores / pool.totalResources.cpuCores) * 100;
    }

    return {
      total: pool.totalResources,
      used,
      available,
      utilizationPercentage,
    };
  }

  /**
   * Get tenant queue position
   */
  getQueuePosition(tenantId: TenantId): number | undefined {
    for (const pool of this.sharedPools.values()) {
      const position = pool.getQueuePosition(tenantId);
      if (position >= 0) {
        return position;
      }
    }
    return undefined;
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Clear all allocations and pools
   */
  clearAll(): void {
    this.allocations.clear();
    this.dedicatedPools.clear();
    this.sharedPools.clear();
    this.initializeDefaultPools();
  }
}
