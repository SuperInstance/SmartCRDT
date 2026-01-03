/**
 * @fileoverview Namespace Isolation - Multi-Tenant Namespace Management
 *
 * Provides namespace isolation for tenant data including:
 * - Knowledge graphs
 * - Cache partitions
 * - Embedding spaces
 * - Intent encoders
 * - Model instances
 *
 * @module @lsi/superinstance/isolation/NamespaceIsolation
 */

import type {
  TenantId,
  TenantNamespace,
  IsolationGuarantee,
  NamespaceAccessControl,
  AccessPermission,
} from "@lsi/protocol";

// ============================================================================
// ERROR TYPES
// ============================================================================

export class NamespaceIsolationError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId?: TenantId
  ) {
    super(message);
    this.name = "NamespaceIsolationError";
  }
}

// ============================================================================
// NAMESPACE MANAGER
// ============================================================================

export interface NamespaceManagerConfig {
  defaultIsolation?: IsolationGuarantee;
  enableCrossTenantChecks?: boolean;
}

export class NamespaceIsolationManager {
  private config: NamespaceManagerConfig;
  private namespaces: Map<string, TenantNamespace> = new Map(); // namespace ID -> namespace
  private tenantNamespaces: Map<TenantId, Set<string>> = new Map(); // tenant ID -> namespace IDs
  private accessControls: Map<TenantId, NamespaceAccessControl> = new Map();

  constructor(config?: NamespaceManagerConfig) {
    this.config = {
      defaultIsolation: "logical",
      enableCrossTenantChecks: true,
      ...config,
    };
  }

  /**
   * Create namespace for tenant
   */
  createNamespace(
    tenantId: TenantId,
    type: "knowledge" | "cache" | "embeddings" | "intent" | "models",
    isolation?: IsolationGuarantee
  ): TenantNamespace {
    const namespaceId = `${tenantId}_${type}_ns_${Date.now()}`;

    // Check for duplicate
    if (this.namespaces.has(namespaceId)) {
      throw new NamespaceIsolationError(
        `Namespace already exists: ${namespaceId}`,
        "NAMESPACE_EXISTS",
        tenantId
      );
    }

    const namespace: TenantNamespace = {
      id: namespaceId,
      tenantId,
      name: `${type} namespace`,
      type,
      createdAt: Date.now(),
      isolation: isolation || this.config.defaultIsolation!,
    };

    // Store namespace
    this.namespaces.set(namespaceId, namespace);

    // Add to tenant namespaces
    if (!this.tenantNamespaces.has(tenantId)) {
      this.tenantNamespaces.set(tenantId, new Set());
    }
    this.tenantNamespaces.get(tenantId)!.add(namespaceId);

    // Create default access control
    this.createDefaultAccessControl(tenantId, namespaceId);

    return namespace;
  }

  /**
   * Get namespace by ID
   */
  getNamespace(namespaceId: string): TenantNamespace | undefined {
    return this.namespaces.get(namespaceId);
  }

  /**
   * Get namespaces for tenant
   */
  getTenantNamespaces(tenantId: TenantId): TenantNamespace[] {
    const namespaceIds = this.tenantNamespaces.get(tenantId);
    if (!namespaceIds) {
      return [];
    }

    return Array.from(namespaceIds)
      .map((id) => this.namespaces.get(id))
      .filter((ns) => ns !== undefined) as TenantNamespace[];
  }

  /**
   * Get namespace by type for tenant
   */
  getNamespaceByType(
    tenantId: TenantId,
    type: string
  ): TenantNamespace | undefined {
    const namespaces = this.getTenantNamespaces(tenantId);
    return namespaces.find((ns) => ns.type === type);
  }

  /**
   * Delete namespace
   */
  deleteNamespace(namespaceId: string): void {
    const namespace = this.namespaces.get(namespaceId);
    if (!namespace) {
      return;
    }

    // Remove from tenant namespaces
    const tenantNs = this.tenantNamespaces.get(namespace.tenantId);
    if (tenantNs) {
      tenantNs.delete(namespaceId);
    }

    // Remove access control
    this.accessControls.delete(namespace.tenantId);

    // Remove namespace
    this.namespaces.delete(namespaceId);
  }

  /**
   * Check cross-tenant access
   */
  checkCrossTenantAccess(
    fromTenantId: TenantId,
    toNamespaceId: string,
    permission: "read" | "write" | "delete" | "admin"
  ): boolean {
    if (!this.config.enableCrossTenantChecks) {
      return true;
    }

    const namespace = this.namespaces.get(toNamespaceId);
    if (!namespace) {
      return false;
    }

    // Same tenant always has access
    if (namespace.tenantId === fromTenantId) {
      return true;
    }

    // Cross-enant access is denied by default
    return false;
  }

  /**
   * Create default access control
   */
  private createDefaultAccessControl(
    tenantId: TenantId,
    namespaceId: string
  ): void {
    const permissions: AccessPermission[] = [
      {
        id: `${namespaceId}_read`,
        type: "read",
        resource: namespaceId,
        granted: true,
      },
      {
        id: `${namespaceId}_write`,
        type: "write",
        resource: namespaceId,
        granted: true,
      },
      {
        id: `${namespaceId}_delete`,
        type: "delete",
        resource: namespaceId,
        granted: true,
      },
      {
        id: `${namespaceId}_admin`,
        type: "admin",
        resource: namespaceId,
        granted: true,
      },
    ];

    this.accessControls.set(tenantId, {
      tenantId,
      namespaceId,
      permissions,
      updatedAt: Date.now(),
    });
  }

  /**
   * Get access control for tenant
   */
  getAccessControl(tenantId: TenantId): NamespaceAccessControl | undefined {
    return this.accessControls.get(tenantId);
  }

  /**
   * Clear all namespaces
   */
  clearAll(): void {
    this.namespaces.clear();
    this.tenantNamespaces.clear();
    this.accessControls.clear();
  }
}
