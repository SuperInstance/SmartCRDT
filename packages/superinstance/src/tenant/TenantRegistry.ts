/**
 * @fileoverview Tenant Registry - Multi-Tenant Tenant Management
 *
 * Manages tenant registration, metadata, and lifecycle operations.
 * Provides tenant lookup, validation, and statistics.
 *
 * @module @lsi/superinstance/tenant/TenantRegistry
 */

import type {
  Tenant,
  TenantId,
  TenantStatus,
  TenantPlan,
  TenantConfig,
  TenantRegistryEntry,
  TenantRegistryStats,
  TenantValidationResult,
  TenantValidationError,
  TenantValidationWarning,
  TenantEvent,
  TenantEventType,
} from "@lsi/protocol";
import { createTenantId, getDefaultQuotasForPlan } from "@lsi/protocol";

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Tenant registry error
 */
export class TenantRegistryError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId?: string
  ) {
    super(message);
    this.name = "TenantRegistryError";
  }
}

// ============================================================================
// EVENT EMITTER
// ============================================================================

/**
 * Tenant event listener
 */
export type TenantEventListener = (event: TenantEvent) => void | Promise<void>;

/**
 * Tenant event emitter
 */
class TenantEventEmitter {
  private listeners: Map<TenantEventType, Set<TenantEventListener>> = new Map();

  on(eventType: TenantEventType, listener: TenantEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  off(eventType: TenantEventType, listener: TenantEventListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  async emit(event: TenantEvent): Promise<void> {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      await Promise.all([...listeners].map((listener) => listener(event)));
    }
  }
}

// ============================================================================
// TENANT REGISTRY
// ============================================================================

/**
 * Tenant registry configuration
 */
export interface TenantRegistryConfig {
  /** Enable automatic cleanup of deleted tenants */
  autoCleanup?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Enable event emission */
  enableEvents?: boolean;
  /** Maximum number of tenants */
  maxTenants?: number;
}

/**
 * Tenant registry options
 */
export interface TenantRegistryOptions {
  /** Registry configuration */
  config?: TenantRegistryConfig;
  /** Initial tenants */
  initialTenants?: Tenant[];
}

/**
 * Tenant registry
 *
 * Manages tenant registration, lookup, and lifecycle.
 * Ensures tenant isolation and provides validation.
 */
export class TenantRegistry {
  private tenants: Map<TenantId, TenantRegistryEntry> = new Map();
  private apiKeys: Map<string, TenantId> = new Map(); // key hash -> tenant ID
  private domains: Map<string, TenantId> = new Map(); // domain -> tenant ID
  private config: TenantRegistryConfig;
  private eventEmitter: TenantEventEmitter;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options?: TenantRegistryOptions) {
    this.config = {
      autoCleanup: true,
      cleanupInterval: 3600000, // 1 hour
      enableEvents: true,
      maxTenants: 10000,
      ...options?.config,
    };

    this.eventEmitter = new TenantEventEmitter();

    // Initialize with provided tenants
    if (options?.initialTenants) {
      for (const tenant of options.initialTenants) {
        this.registerSync(tenant);
      }
    }

    // Start cleanup timer
    if (this.config.autoCleanup) {
      this.startCleanupTimer();
    }
  }

  // ========================================================================
  // TENANT REGISTRATION
  // ========================================================================

  /**
   * Register a new tenant
   */
  async register(tenant: Omit<Tenant, "id" | "createdAt" | "updatedAt">): Promise<Tenant> {
    // Check max tenants limit
    if (this.tenants.size >= this.config.maxTenants!) {
      throw new TenantRegistryError(
        "Maximum number of tenants reached",
        "MAX_TENANTS_EXCEEDED"
      );
    }

    // Validate tenant
    const validation = this.validateTenantInput(tenant);
    if (!validation.valid) {
      throw new TenantRegistryError(
        `Invalid tenant: ${validation.errors.map((e) => e.message).join(", ")}`,
        "INVALID_TENANT"
      );
    }

    // Generate tenant ID
    const tenantId = createTenantId(
      `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    );

    // Create full tenant
    const fullTenant: Tenant = {
      ...tenant,
      id: tenantId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Get default quotas for plan
    const quotas = getDefaultQuotasForPlan(tenant.plan);

    // Create tenant config
    const config: TenantConfig = {
      tenantId,
      quotas,
      updatedAt: Date.now(),
    };

    // Create registry entry
    const entry: TenantRegistryEntry = {
      tenant: fullTenant,
      config,
      namespaces: [],
      registeredAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Store tenant
    this.tenants.set(tenantId, entry);

    // Emit event
    if (this.config.enableEvents) {
      await this.eventEmitter.emit({
        type: "tenant.created",
        tenantId,
        timestamp: Date.now(),
        data: { tenant: fullTenant },
        eventId: this.generateEventId(),
      });
    }

    return fullTenant;
  }

  /**
   * Register tenant synchronously (for internal use)
   */
  private registerSync(tenant: Tenant): void {
    const quotas = getDefaultQuotasForPlan(tenant.plan);
    const config: TenantConfig = {
      tenantId: tenant.id,
      quotas,
      updatedAt: Date.now(),
    };

    const entry: TenantRegistryEntry = {
      tenant,
      config,
      namespaces: [],
      registeredAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tenants.set(tenant.id, entry);

    // Register domain if provided
    if (tenant.domain) {
      this.domains.set(tenant.domain, tenant.id);
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(
    tenantId: TenantId,
    updates: Partial<Omit<Tenant, "id" | "createdAt">>
  ): Promise<Tenant> {
    const entry = this.tenants.get(tenantId);
    if (!entry) {
      throw new TenantRegistryError(
        `Tenant not found: ${tenantId}`,
        "TENANT_NOT_FOUND",
        tenantId
      );
    }

    // Update tenant
    const updatedTenant: Tenant = {
      ...entry.tenant,
      ...updates,
      id: tenantId, // Ensure ID doesn't change
      createdAt: entry.tenant.createdAt, // Preserve creation time
      updatedAt: Date.now(),
    };

    entry.tenant = updatedTenant;
    entry.updatedAt = Date.now();

    // Update domain mapping if changed
    if (updates.domain && updates.domain !== entry.tenant.domain) {
      if (entry.tenant.domain) {
        this.domains.delete(entry.tenant.domain);
      }
      this.domains.set(updates.domain, tenantId);
    }

    // Emit event
    if (this.config.enableEvents) {
      await this.eventEmitter.emit({
        type: "tenant.updated",
        tenantId,
        timestamp: Date.now(),
        data: { tenant: updatedTenant, updates },
        eventId: this.generateEventId(),
      });
    }

    return updatedTenant;
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(tenantId: TenantId, reason?: string): Promise<Tenant> {
    return this.updateTenant(tenantId, { status: "suspended" });
  }

  /**
   * Activate tenant
   */
  async activateTenant(tenantId: TenantId): Promise<Tenant> {
    return this.updateTenant(tenantId, { status: "active" });
  }

  /**
   * Delete tenant (soft delete)
   */
  async deleteTenant(tenantId: TenantId): Promise<Tenant> {
    const entry = this.tenants.get(tenantId);
    if (!entry) {
      throw new TenantRegistryError(
        `Tenant not found: ${tenantId}`,
        "TENANT_NOT_FOUND",
        tenantId
      );
    }

    // Mark as deleted
    entry.tenant.status = "deleted";
    entry.tenant.deletedAt = Date.now();
    entry.tenant.updatedAt = Date.now();
    entry.updatedAt = Date.now();

    // Emit event
    if (this.config.enableEvents) {
      await this.eventEmitter.emit({
        type: "tenant.deleted",
        tenantId,
        timestamp: Date.now(),
        data: { tenant: entry.tenant },
        eventId: this.generateEventId(),
      });
    }

    return entry.tenant;
  }

  /**
   * Permanently remove tenant
   */
  async removeTenant(tenantId: TenantId): Promise<void> {
    const entry = this.tenants.get(tenantId);
    if (!entry) {
      throw new TenantRegistryError(
        `Tenant not found: ${tenantId}`,
        "TENANT_NOT_FOUND",
        tenantId
      );
    }

    // Remove domain mapping
    if (entry.tenant.domain) {
      this.domains.delete(entry.tenant.domain);
    }

    // Remove API key mappings
    // (would need to iterate through apiKeys map)

    // Remove tenant
    this.tenants.delete(tenantId);
  }

  // ========================================================================
  // TENANT LOOKUP
  // ========================================================================

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: TenantId): Tenant | undefined {
    const entry = this.tenants.get(tenantId);
    return entry?.tenant;
  }

  /**
   * Get tenant registry entry
   */
  getTenantEntry(tenantId: TenantId): TenantRegistryEntry | undefined {
    return this.tenants.get(tenantId);
  }

  /**
   * Get tenant by domain
   */
  getTenantByDomain(domain: string): Tenant | undefined {
    const tenantId = this.domains.get(domain);
    if (tenantId) {
      return this.getTenant(tenantId);
    }
    return undefined;
  }

  /**
   * Get tenant by API key hash
   */
  getTenantByAPIKey(keyHash: string): Tenant | undefined {
    const tenantId = this.apiKeys.get(keyHash);
    if (tenantId) {
      return this.getTenant(tenantId);
    }
    return undefined;
  }

  /**
   * Check if tenant exists
   */
  hasTenant(tenantId: TenantId): boolean {
    return this.tenants.has(tenantId);
  }

  /**
   * List all tenants
   */
  listTenants(filter?: {
    status?: TenantStatus;
    plan?: TenantPlan;
  }): Tenant[] {
    let tenants = Array.from(this.tenants.values()).map((e) => e.tenant);

    if (filter?.status) {
      tenants = tenants.filter((t) => t.status === filter.status);
    }

    if (filter?.plan) {
      tenants = tenants.filter((t) => t.plan === filter.plan);
    }

    return tenants;
  }

  // ========================================================================
  // TENANT CONFIGURATION
  // ========================================================================

  /**
   * Get tenant configuration
   */
  getTenantConfig(tenantId: TenantId): TenantConfig | undefined {
    const entry = this.tenants.get(tenantId);
    return entry?.config;
  }

  /**
   * Update tenant configuration
   */
  async updateTenantConfig(
    tenantId: TenantId,
    configUpdates: Partial<TenantConfig>
  ): Promise<TenantConfig> {
    const entry = this.tenants.get(tenantId);
    if (!entry) {
      throw new TenantRegistryError(
        `Tenant not found: ${tenantId}`,
        "TENANT_NOT_FOUND",
        tenantId
      );
    }

    // Update config
    entry.config = {
      ...entry.config,
      ...configUpdates,
      tenantId, // Ensure ID doesn't change
      updatedAt: Date.now(),
    };

    entry.updatedAt = Date.now();

    return entry.config;
  }

  // ========================================================================
  // STATISTICS
  // ========================================================================

  /**
   * Get registry statistics
   */
  getStats(): TenantRegistryStats {
    const tenants = Array.from(this.tenants.values()).map((e) => e.tenant);

    const tenantsByPlan: Record<TenantPlan, number> = {
      free: 0,
      basic: 0,
      pro: 0,
      enterprise: 0,
    };

    for (const tenant of tenants) {
      tenantsByPlan[tenant.plan]++;
    }

    return {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === "active").length,
      suspendedTenants: tenants.filter((t) => t.status === "suspended").length,
      pendingTenants: tenants.filter((t) => t.status === "pending").length,
      deletedTenants: tenants.filter((t) => t.status === "deleted").length,
      tenantsByPlan,
      timestamp: Date.now(),
    };
  }

  // ========================================================================
  // EVENT HANDLING
  // ========================================================================

  /**
   * Register event listener
   */
  on(eventType: TenantEventType, listener: TenantEventListener): void {
    this.eventEmitter.on(eventType, listener);
  }

  /**
   * Unregister event listener
   */
  off(eventType: TenantEventType, listener: TenantEventListener): void {
    this.eventEmitter.off(eventType, listener);
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Cleanup deleted tenants
   */
  private cleanup(): void {
    const now = Date.now();
    const deletionThreshold = 30 * 24 * 3600000; // 30 days

    for (const [tenantId, entry] of this.tenants.entries()) {
      if (
        entry.tenant.status === "deleted" &&
        entry.tenant.deletedAt &&
        now - entry.tenant.deletedAt > deletionThreshold
      ) {
        // Permanently remove tenant
        this.tenants.delete(tenantId);
      }
    }
  }

  /**
   * Destroy registry
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.tenants.clear();
    this.apiKeys.clear();
    this.domains.clear();
  }

  // ========================================================================
  // VALIDATION
  // ========================================================================

  /**
   * Validate tenant input
   */
  private validateTenantInput(
    tenant: Omit<Tenant, "id" | "createdAt" | "updatedAt">
  ): TenantValidationResult {
    const errors: TenantValidationError[] = [];
    const warnings: TenantValidationWarning[] = [];

    // Validate name
    if (!tenant.name || tenant.name.trim().length === 0) {
      errors.push({
        code: "INVALID_NAME",
        message: "Tenant name is required",
        field: "name",
      });
    }

    // Validate status
    const validStatuses: TenantStatus[] = ["active", "suspended", "deleted", "pending"];
    if (!validStatuses.includes(tenant.status)) {
      errors.push({
        code: "INVALID_STATUS",
        message: `Invalid tenant status: ${tenant.status}`,
        field: "status",
      });
    }

    // Validate plan
    const validPlans: TenantPlan[] = ["free", "basic", "pro", "enterprise"];
    if (!validPlans.includes(tenant.plan)) {
      errors.push({
        code: "INVALID_PLAN",
        message: `Invalid tenant plan: ${tenant.plan}`,
        field: "plan",
      });
    }

    // Validate domain format
    if (tenant.domain) {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
      if (!domainRegex.test(tenant.domain)) {
        errors.push({
          code: "INVALID_DOMAIN",
          message: "Invalid domain format",
          field: "domain",
        });
      }
    }

    // Validate email format
    if (tenant.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(tenant.email)) {
        errors.push({
          code: "INVALID_EMAIL",
          message: "Invalid email format",
          field: "email",
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
