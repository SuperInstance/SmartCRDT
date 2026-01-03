/**
 * @fileoverview Tenant Context - Per-Tenant Execution Context
 *
 * Manages per-tenant execution context including configuration,
 * namespaces, resource allocation, and access control.
 *
 * @module @lsi/superinstance/tenant/TenantContext
 */

import type {
  TenantId,
  TenantConfig,
  TenantNamespace,
  TenantExecutionContext,
  TenantRequestContext,
  QuotaViolation,
  UsageMetrics,
  ResourcePoolAllocation,
  NamespaceAccessControl,
  ResourceQuota,
} from "@lsi/protocol";
import { TenantRegistry } from "./TenantRegistry.js";

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Tenant context error
 */
export class TenantContextError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId?: TenantId
  ) {
    super(message);
    this.name = "TenantContextError";
  }
}

// ============================================================================
// QUOTA VIOLATION ERROR
// ============================================================================

/**
 * Quota exceeded error
 */
export class QuotaExceededError extends TenantContextError {
  constructor(
    tenantId: TenantId,
    public violations: QuotaViolation[]
  ) {
    const messages = violations.map(
      (v) => `${v.type}: ${v.currentUsage}/${v.limit}`
    );
    super(
      `Quota exceeded for tenant ${tenantId}: ${messages.join(", ")}`,
      "QUOTA_EXCEEDED",
      tenantId
    );
    this.name = "QuotaExceededError";
  }
}

// ============================================================================
// TENANT CONTEXT MANAGER
// ============================================================================

/**
 * Tenant context manager configuration
 */
export interface TenantContextManagerConfig {
  /** Enable automatic quota checking */
  enableQuotaChecking?: boolean;
  /** Enable automatic usage tracking */
  enableUsageTracking?: boolean;
  /** Context cache TTL in milliseconds */
  contextCacheTTL?: number;
}

/**
 * Tenant context manager
 *
 * Manages per-tenant execution contexts with configuration,
 * namespaces, resource allocation, and access control.
 */
export class TenantContextManager {
  private registry: TenantRegistry;
  private config: TenantContextManagerConfig;
  private contexts: Map<TenantId, TenantExecutionContext> = new Map();
  private requestContexts: Map<string, TenantRequestContext> = new Map();
  private usageMetrics: Map<TenantId, UsageMetrics> = new Map();

  constructor(
    registry: TenantRegistry,
    config?: TenantContextManagerConfig
  ) {
    this.registry = registry;
    this.config = {
      enableQuotaChecking: true,
      enableUsageTracking: true,
      contextCacheTTL: 300000, // 5 minutes
      ...config,
    };
  }

  // ========================================================================
  // CONTEXT MANAGEMENT
  // ========================================================================

  /**
   * Get or create tenant execution context
   */
  async getExecutionContext(tenantId: TenantId): Promise<TenantExecutionContext> {
    // Check cache
    const cached = this.contexts.get(tenantId);
    if (cached && Date.now() - cached.lastAccessedAt < this.config.contextCacheTTL!) {
      cached.lastAccessedAt = Date.now();
      return cached;
    }

    // Get tenant and config
    const tenant = this.registry.getTenant(tenantId);
    if (!tenant) {
      throw new TenantContextError(
        `Tenant not found: ${tenantId}`,
        "TENANT_NOT_FOUND",
        tenantId
      );
    }

    const config = this.registry.getTenantConfig(tenantId);
    if (!config) {
      throw new TenantContextError(
        `Tenant config not found: ${tenantId}`,
        "CONFIG_NOT_FOUND",
        tenantId
      );
    }

    // Create namespaces
    const namespaces = this.createTenantNamespaces(tenantId, config);

    // Create resource allocation
    const resourceAllocation = this.createResourceAllocation(tenantId, config);

    // Get or create usage metrics
    let currentUsage = this.usageMetrics.get(tenantId);
    if (!currentUsage) {
      currentUsage = this.createInitialUsageMetrics(tenantId);
      this.usageMetrics.set(tenantId, currentUsage);
    }

    // Create access control
    const accessControl = this.createAccessControl(tenantId, namespaces);

    // Create context
    const context: TenantExecutionContext = {
      tenantId,
      config,
      namespaces: new Map(namespaces.map((ns) => [ns.id, ns])),
      resourceAllocation,
      currentUsage,
      accessControl,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    // Cache context
    this.contexts.set(tenantId, context);

    return context;
  }

  /**
   * Create request context for a specific request
   */
  async createRequestContext(
    tenantId: TenantId,
    requestId: string
  ): Promise<TenantRequestContext> {
    // Get execution context
    const execContext = await this.getExecutionContext(tenantId);

    // Check quotas if enabled
    let quotasValid = true;
    const quotaViolations: QuotaViolation[] = [];

    if (this.config.enableQuotaChecking) {
      const violations = await this.checkQuotas(tenantId);
      if (violations.length > 0) {
        quotasValid = false;
        quotaViolations.push(...violations);
      }
    }

    // Create request context
    const requestContext: TenantRequestContext = {
      tenantId,
      requestId,
      timestamp: Date.now(),
      config: execContext.config,
      quotasValid,
      quotaViolations,
    };

    // Cache request context
    this.requestContexts.set(requestId, requestContext);

    return requestContext;
  }

  /**
   * Invalidate cached context
   */
  invalidateContext(tenantId: TenantId): void {
    this.contexts.delete(tenantId);
  }

  /**
   * Invalidate all cached contexts
   */
  invalidateAllContexts(): void {
    this.contexts.clear();
  }

  // ========================================================================
  // QUOTA MANAGEMENT
  // ========================================================================

  /**
   * Check if tenant has exceeded quotas
   */
  async checkQuotas(tenantId: TenantId): Promise<QuotaViolation[]> {
    const violations: QuotaViolation[] = [];
    const execContext = await this.getExecutionContext(tenantId);
    const quotas = execContext.config.quotas;
    const usage = execContext.currentUsage;

    // Check rate limits
    const now = Date.now();
    const requestsInLastSecond = this.countRequestsInWindow(tenantId, now - 1000, now);
    if (requestsInLastSecond > quotas.rateLimit.requestsPerSecond) {
      violations.push({
        type: "rate-limit",
        severity: "error",
        currentUsage: requestsInLastSecond,
        limit: quotas.rateLimit.requestsPerSecond,
        timestamp: now,
      });
    }

    // Check token quota
    if (usage.tokens.totalTokens > quotas.tokenQuota.tokensPerDay) {
      violations.push({
        type: "token-quota",
        severity: "error",
        currentUsage: usage.tokens.totalTokens,
        limit: quotas.tokenQuota.tokensPerDay,
        timestamp: now,
      });
    }

    // Check storage quota
    if (usage.storage.totalStorageBytes > quotas.storageQuota.maxStorageBytes) {
      violations.push({
        type: "storage-quota",
        severity: "warning",
        currentUsage: usage.storage.totalStorageBytes,
        limit: quotas.storageQuota.maxStorageBytes,
        timestamp: now,
      });
    }

    // Check inference quota
    if (usage.inference.totalRequests > quotas.inferenceQuota.requestsPerDay) {
      violations.push({
        type: "inference-quota",
        severity: "error",
        currentUsage: usage.inference.totalRequests,
        limit: quotas.inferenceQuota.requestsPerDay,
        timestamp: now,
      });
    }

    return violations;
  }

  /**
   * Check quotas and throw if exceeded
   */
  async validateQuotas(tenantId: TenantId): Promise<void> {
    const violations = await this.checkQuotas(tenantId);
    if (violations.length > 0) {
      throw new QuotaExceededError(tenantId, violations);
    }
  }

  /**
   * Count requests in time window
   */
  private countRequestsInWindow(
    tenantId: TenantId,
    startTime: number,
    endTime: number
  ): number {
    // In production, this would query a request log
    // For now, return 0
    return 0;
  }

  // ========================================================================
  // USAGE TRACKING
  // ========================================================================

  /**
   * Track request usage
   */
  trackRequest(
    tenantId: TenantId,
    metrics: {
      tokens: number;
      latency: number;
      computeTime: number;
      model: string;
    }
  ): void {
    if (!this.config.enableUsageTracking) {
      return;
    }

    const usage = this.usageMetrics.get(tenantId);
    if (!usage) {
      return;
    }

    // Update request metrics
    usage.requests.totalRequests++;
    usage.requests.averageLatency =
      (usage.requests.averageLatency * (usage.requests.totalRequests - 1) +
        metrics.latency) /
      usage.requests.totalRequests;

    // Update token metrics
    usage.tokens.totalTokens += metrics.tokens;
    usage.tokens.promptTokens += Math.floor(metrics.tokens * 0.7);
    usage.tokens.completionTokens += Math.floor(metrics.tokens * 0.3);
    usage.tokens.tokensByModel[metrics.model] =
      (usage.tokens.tokensByModel[metrics.model] || 0) + metrics.tokens;

    // Update inference metrics
    usage.inference.totalRequests++;
    usage.inference.totalComputeTime += metrics.computeTime;
    usage.inference.requestsByModel[metrics.model] =
      (usage.inference.requestsByModel[metrics.model] || 0) + 1;

    // Update cost (simplified)
    const costPer1kTokens = 0.002; // Example: $0.002 per 1K tokens
    usage.cost.computeCost += (metrics.tokens / 1000) * costPer1kTokens;
    usage.cost.totalCost = usage.cost.computeCost + usage.cost.storageCost + usage.cost.networkCost;
  }

  /**
   * Reset usage metrics for tenant
   */
  resetUsage(tenantId: TenantId): void {
    const usage = this.createInitialUsageMetrics(tenantId);
    this.usageMetrics.set(tenantId, usage);
  }

  /**
   * Get usage metrics for tenant
   */
  getUsageMetrics(tenantId: TenantId): UsageMetrics | undefined {
    return this.usageMetrics.get(tenantId);
  }

  // ========================================================================
  // NAMESPACE MANAGEMENT
// ========================================================================

  /**
   * Get namespace for tenant
   */
  async getNamespace(
    tenantId: TenantId,
    type: string
  ): Promise<TenantNamespace | undefined> {
    const context = await this.getExecutionContext(tenantId);
    for (const namespace of context.namespaces.values()) {
      if (namespace.type === type) {
        return namespace;
      }
    }
    return undefined;
  }

  /**
   * Check namespace access
   */
  async checkNamespaceAccess(
    tenantId: TenantId,
    namespaceId: string,
    permission: "read" | "write" | "delete" | "admin"
  ): Promise<boolean> {
    const context = await this.getExecutionContext(tenantId);
    const accessControl = context.accessControl;

    return accessControl.permissions.some(
      (p) =>
        p.resource === namespaceId &&
        p.type === permission &&
        p.granted
    );
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Create tenant namespaces
   */
  private createTenantNamespaces(
    tenantId: TenantId,
    config: TenantConfig
  ): TenantNamespace[] {
    const namespaceTypes = [
      "knowledge",
      "cache",
      "embeddings",
      "intent",
      "models",
    ] as const;

    return namespaceTypes.map((type) => ({
      id: `${tenantId}_${type}_ns`,
      tenantId,
      name: `${type} namespace`,
      type,
      createdAt: Date.now(),
      isolation: "logical",
    }));
  }

  /**
   * Create resource allocation
   */
  private createResourceAllocation(
    tenantId: TenantId,
    config: TenantConfig
  ): ResourcePoolAllocation {
    // Determine pool type based on plan
    const poolType = config.quotas.rateLimit.requestsPerSecond > 100
      ? "dedicated"
      : "shared";

    return {
      id: `${tenantId}_pool`,
      tenantId,
      poolType,
      resources: {
        cpuCores: poolType === "dedicated" ? 4 : undefined,
        memoryBytes: poolType === "dedicated" ? 8 * 1024 * 1024 * 1024 : undefined,
        gpu: poolType === "dedicated" ? 1 : undefined,
      },
      priority: this.getPriorityFromQuotas(config.quotas),
      allocatedAt: Date.now(),
    };
  }

  /**
   * Get priority from quotas
   */
  private getPriorityFromQuotas(quotas: ResourceQuota): number {
    if (quotas.rateLimit.requestsPerSecond >= 1000) {
      return 4; // critical
    } else if (quotas.rateLimit.requestsPerSecond >= 100) {
      return 3; // high
    } else if (quotas.rateLimit.requestsPerSecond >= 10) {
      return 2; // normal
    } else {
      return 1; // low
    }
  }

  /**
   * Create initial usage metrics
   */
  private createInitialUsageMetrics(tenantId: TenantId): UsageMetrics {
    return {
      tenantId,
      timestamp: Date.now(),
      requests: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
      },
      tokens: {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        tokensByModel: {},
      },
      storage: {
        totalStorageBytes: 0,
        knowledgeEntries: 0,
        cacheEntries: 0,
        embeddingStorageBytes: 0,
      },
      inference: {
        totalRequests: 0,
        totalComputeTime: 0,
        averageComputeTime: 0,
        peakConcurrentRequests: 0,
        requestsByModel: {},
      },
      cost: {
        totalCost: 0,
        computeCost: 0,
        storageCost: 0,
        networkCost: 0,
        costByModel: {},
        currency: "USD",
      },
    };
  }

  /**
   * Create access control
   */
  private createAccessControl(
    tenantId: TenantId,
    namespaces: TenantNamespace[]
  ): NamespaceAccessControl {
    const permissions = namespaces.flatMap((ns) => [
      {
        id: `${ns.id}_read`,
        type: "read" as const,
        resource: ns.id,
        granted: true,
      },
      {
        id: `${ns.id}_write`,
        type: "write" as const,
        resource: ns.id,
        granted: true,
      },
      {
        id: `${ns.id}_delete`,
        type: "delete" as const,
        resource: ns.id,
        granted: true,
      },
      {
        id: `${ns.id}_admin`,
        type: "admin" as const,
        resource: ns.id,
        granted: true,
      },
    ]);

    return {
      tenantId,
      namespaceId: namespaces[0]?.id || "",
      permissions,
      updatedAt: Date.now(),
    };
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Clear all contexts
   */
  clearAll(): void {
    this.contexts.clear();
    this.requestContexts.clear();
    this.usageMetrics.clear();
  }

  /**
   * Clear expired request contexts
   */
  clearExpiredRequestContexts(maxAge: number = 3600000): void {
    const now = Date.now();
    for (const [requestId, context] of this.requestContexts.entries()) {
      if (now - context.timestamp > maxAge) {
        this.requestContexts.delete(requestId);
      }
    }
  }
}
