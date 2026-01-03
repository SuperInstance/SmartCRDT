/**
 * @fileoverview Data Isolation - Multi-Tenant Data Isolation
 *
 * Ensures complete data isolation between tenants:
 * - Knowledge graph isolation (per-tenant graphs)
 * - Cache isolation (separate cache partitions)
 * - Embedding isolation (per-tenant embeddings)
 * - Intent vector isolation (per-tenant encoders)
 *
 * @module @lsi/superinstance/isolation/DataIsolation
 */

import type {
  TenantId,
  TenantNamespace,
} from "@lsi/protocol";
import { NamespaceIsolationManager } from "./NamespaceIsolation.js";

// ============================================================================
// ERROR TYPES
// ============================================================================

export class DataIsolationError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId?: TenantId
  ) {
    super(message);
    this.name = "DataIsolationError";
  }
}

// ============================================================================
// DATA ISOLATION MANAGER
// ============================================================================

export interface DataIsolationManagerConfig {
  enableEncryption?: boolean;
  enableDataVerification?: boolean;
}

export class DataIsolationManager {
  private namespaceManager: NamespaceIsolationManager;
  private config: DataIsolationManagerConfig;

  constructor(
    namespaceManager: NamespaceIsolationManager,
    config?: DataIsolationManagerConfig
  ) {
    this.namespaceManager = namespaceManager;
    this.config = {
      enableEncryption: true,
      enableDataVerification: true,
      ...config,
    };
  }

  /**
   * Get isolated knowledge graph namespace for tenant
   */
  getKnowledgeGraphNamespace(tenantId: TenantId): TenantNamespace {
    let namespace = this.namespaceManager.getNamespaceByType(tenantId, "knowledge");

    if (!namespace) {
      namespace = this.namespaceManager.createNamespace(tenantId, "knowledge", "logical");
    }

    return namespace;
  }

  /**
   * Get isolated cache namespace for tenant
   */
  getCacheNamespace(tenantId: TenantId): TenantNamespace {
    let namespace = this.namespaceManager.getNamespaceByType(tenantId, "cache");

    if (!namespace) {
      namespace = this.namespaceManager.createNamespace(tenantId, "cache", "logical");
    }

    return namespace;
  }

  /**
   * Get isolated embedding namespace for tenant
   */
  getEmbeddingNamespace(tenantId: TenantId): TenantNamespace {
    let namespace = this.namespaceManager.getNamespaceByType(tenantId, "embeddings");

    if (!namespace) {
      namespace = this.namespaceManager.createNamespace(tenantId, "embeddings", "strict");
    }

    return namespace;
  }

  /**
   * Get isolated intent encoder namespace for tenant
   */
  getIntentNamespace(tenantId: TenantId): TenantNamespace {
    let namespace = this.namespaceManager.getNamespaceByType(tenantId, "intent");

    if (!namespace) {
      namespace = this.namespaceManager.createNamespace(tenantId, "intent", "strict");
    }

    return namespace;
  }

  /**
   * Get isolated model namespace for tenant
   */
  getModelNamespace(tenantId: TenantId): TenantNamespace {
    let namespace = this.namespaceManager.getNamespaceByType(tenantId, "models");

    if (!namespace) {
      namespace = this.namespaceManager.createNamespace(tenantId, "models", "logical");
    }

    return namespace;
  }

  /**
   * Check if data access is allowed
   */
  checkDataAccess(
    tenantId: TenantId,
    namespaceId: string,
    operation: "read" | "write" | "delete"
  ): boolean {
    return this.namespaceManager.checkCrossTenantAccess(tenantId, namespaceId, operation);
  }

  /**
   * Verify data ownership
   */
  verifyDataOwnership(
    tenantId: TenantId,
    dataNamespaceId: string
  ): boolean {
    const namespace = this.namespaceManager.getNamespace(dataNamespaceId);

    if (!namespace) {
      return false;
    }

    return namespace.tenantId === tenantId;
  }

  /**
   * Prevent cross-tenant data leakage
   */
  preventCrossTenantLeakage(
    fromTenantId: TenantId,
    toTenantId: TenantId,
    dataType: string
  ): boolean {
    // Cross-tenant data sharing is not allowed
    return fromTenantId === toTenantId;
  }

  /**
   * Sanitize data for tenant (remove any cross-tenant references)
   */
  sanitizeData(tenantId: TenantId, data: any): any {
    // In production, this would recursively sanitize data
    // to remove any references to other tenants' data

    if (typeof data !== "object" || data === null) {
      return data;
    }

    // Add tenant watermark
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeData(tenantId, item));
    }

    const sanitized: any = { ...data };
    for (const key in sanitized) {
      if (sanitized.hasOwnProperty(key)) {
        // Filter out keys that might reference other tenants
        if (key.includes("tenantId") && sanitized[key] !== tenantId) {
          delete sanitized[key];
        } else {
          sanitized[key] = this.sanitizeData(tenantId, sanitized[key]);
        }
      }
    }

    return sanitized;
  }
}
