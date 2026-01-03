/**
 * @fileoverview Tenant Resolver - Multi-Tenant Request Resolution
 *
 * Resolves tenant identity from incoming requests using various methods:
 * - API key resolution
 * - JWT token resolution
 * - Domain-based resolution
 * - Header-based resolution
 * - Query parameter resolution
 *
 * @module @lsi/superinstance/tenant/TenantResolver
 */

import type {
  TenantId,
  TenantResolutionResult,
  TenantResolutionMethod,
  TenantAPIKey,
} from "@lsi/protocol";
import { createTenantId } from "@lsi/protocol";
import { TenantRegistry } from "./TenantRegistry.js";

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Tenant resolution error
 */
export class TenantResolutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public method?: TenantResolutionMethod
  ) {
    super(message);
    this.name = "TenantResolutionError";
  }
}

// ============================================================================
// RESOLUTION CONTEXT
// ============================================================================

/**
 * Request context for tenant resolution
 */
export interface TenantResolutionContext {
  /** Request headers */
  headers?: Record<string, string>;
  /** Query parameters */
  query?: Record<string, string>;
  /** Request domain */
  domain?: string;
  /** API key (from Authorization header or x-api-key) */
  apiKey?: string;
  /** JWT token (from Authorization header) */
  jwt?: string;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// TENANT RESOLVER
// ============================================================================

/**
 * Tenant resolver configuration
 */
export interface TenantResolverConfig {
  /** Default resolution method */
  defaultMethod?: TenantResolutionMethod;
  /** Enable fallback methods */
  enableFallback?: boolean;
  /** Fallback methods in order */
  fallbackMethods?: TenantResolutionMethod[];
  /** Cache resolution results */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
}

/**
 * Tenant resolver
 *
 * Resolves tenant identity from incoming requests using multiple methods.
 * Supports caching and fallback strategies.
 */
export class TenantResolver {
  private registry: TenantRegistry;
  private config: TenantResolverConfig;
  private resolutionCache: Map<string, { result: TenantResolutionResult; expiresAt: number }> = new Map();

  constructor(
    registry: TenantRegistry,
    config?: TenantResolverConfig
  ) {
    this.registry = registry;
    this.config = {
      defaultMethod: "api-key",
      enableFallback: true,
      fallbackMethods: ["jwt", "api-key", "domain", "header"],
      enableCache: true,
      cacheTTL: 300000, // 5 minutes
      ...config,
    };
  }

  // ========================================================================
  // RESOLUTION METHODS
  // ========================================================================

  /**
   * Resolve tenant from request context
   */
  async resolve(context: TenantResolutionContext): Promise<TenantResolutionResult> {
    // Check cache first
    if (this.config.enableCache) {
      const cacheKey = this.getCacheKey(context);
      const cached = this.resolutionCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
      }
    }

    // Try default method first
    let result: TenantResolutionResult | undefined;

    try {
      if (this.config.defaultMethod) {
        result = await this.resolveByMethod(this.config.defaultMethod, context);
      }
    } catch (error) {
      // Ignore error, try fallback
    }

    // Try fallback methods
    if (!result && this.config.enableFallback && this.config.fallbackMethods) {
      for (const method of this.config.fallbackMethods) {
        try {
          result = await this.resolveByMethod(method, context);
          if (result) {
            break;
          }
        } catch (error) {
          // Try next method
        }
      }
    }

    if (!result) {
      throw new TenantResolutionError(
        "Failed to resolve tenant",
        "RESOLUTION_FAILED"
      );
    }

    // Validate tenant is active
    if (result.tenant.status !== "active") {
      throw new TenantResolutionError(
        `Tenant is not active: ${result.tenant.status}`,
        "TENANT_NOT_ACTIVE",
        result.method
      );
    }

    // Cache result
    if (this.config.enableCache) {
      const cacheKey = this.getCacheKey(context);
      this.resolutionCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + this.config.cacheTTL!,
      });
    }

    return result;
  }

  /**
   * Resolve by specific method
   */
  async resolveByMethod(
    method: TenantResolutionMethod,
    context: TenantResolutionContext
  ): Promise<TenantResolutionResult> {
    switch (method) {
      case "api-key":
        return this.resolveByAPIKey(context);
      case "jwt":
        return this.resolveByJWT(context);
      case "domain":
        return this.resolveByDomain(context);
      case "header":
        return this.resolveByHeader(context);
      case "query-param":
        return this.resolveByQueryParam(context);
      default:
        throw new TenantResolutionError(
          `Unknown resolution method: ${method}`,
          "UNKNOWN_METHOD",
          method
        );
    }
  }

  // ========================================================================
  // API KEY RESOLUTION
  // ========================================================================

  /**
   * Resolve tenant by API key
   */
  private async resolveByAPIKey(
    context: TenantResolutionContext
  ): Promise<TenantResolutionResult> {
    // Extract API key from context
    const apiKey = this.extractAPIKey(context);
    if (!apiKey) {
      throw new TenantResolutionError(
        "No API key provided",
        "NO_API_KEY",
        "api-key"
      );
    }

    // Hash the API key (for lookup)
    const keyHash = this.hashAPIKey(apiKey);

    // Look up tenant by key hash
    const tenant = this.registry.getTenantByAPIKey(keyHash);
    if (!tenant) {
      throw new TenantResolutionError(
        "Invalid API key",
        "INVALID_API_KEY",
        "api-key"
      );
    }

    return {
      tenant,
      method: "api-key",
      confidence: 1.0,
      timestamp: Date.now(),
    };
  }

  /**
   * Extract API key from context
   */
  private extractAPIKey(context: TenantResolutionContext): string | undefined {
    // Try x-api-key header first
    if (context.headers?.["x-api-key"]) {
      return context.headers["x-api-key"];
    }

    // Try Authorization header with Bearer
    const authHeader = context.headers?.["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      // Check if it looks like a JWT (contains dots)
      if (!token.includes(".")) {
        return token;
      }
    }

    // Try context.apiKey
    if (context.apiKey) {
      return context.apiKey;
    }

    return undefined;
  }

  /**
   * Hash API key (simplified - use proper crypto in production)
   */
  private hashAPIKey(apiKey: string): string {
    // In production, use proper cryptographic hash
    return `hash_${apiKey.substring(0, 8)}_${apiKey.length}`;
  }

  // ========================================================================
  // JWT RESOLUTION
  // ========================================================================

  /**
   * Resolve tenant by JWT token
   */
  private async resolveByJWT(
    context: TenantResolutionContext
  ): Promise<TenantResolutionResult> {
    // Extract JWT from context
    const jwt = this.extractJWT(context);
    if (!jwt) {
      throw new TenantResolutionError(
        "No JWT token provided",
        "NO_JWT",
        "jwt"
      );
    }

    // Decode and validate JWT
    const payload = this.decodeJWT(jwt);
    if (!payload) {
      throw new TenantResolutionError(
        "Invalid JWT token",
        "INVALID_JWT",
        "jwt"
      );
    }

    // Extract tenant ID from subject
    const sub = payload.sub as string | undefined;
    const tenantId = createTenantId(sub || "unknown");
    const tenant = this.registry.getTenant(tenantId);
    if (!tenant) {
      throw new TenantResolutionError(
        `Tenant not found: ${tenantId}`,
        "TENANT_NOT_FOUND",
        "jwt"
      );
    }

    // Check token expiration
    const exp = payload.exp as number | undefined;
    if (exp && exp < Date.now() / 1000) {
      throw new TenantResolutionError(
        "JWT token expired",
        "JWT_EXPIRED",
        "jwt"
      );
    }

    // Check token not before
    const nbf = payload.nbf as number | undefined;
    if (nbf && nbf > Date.now() / 1000) {
      throw new TenantResolutionError(
        "JWT token not yet valid",
        "JWT_NOT_YET_VALID",
        "jwt"
      );
    }

    return {
      tenant,
      method: "jwt",
      confidence: 1.0,
      timestamp: Date.now(),
    };
  }

  /**
   * Extract JWT from context
   */
  private extractJWT(context: TenantResolutionContext): string | undefined {
    // Try Authorization header with Bearer
    const authHeader = context.headers?.["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      // Check if it looks like a JWT (contains dots)
      if (token.includes(".")) {
        return token;
      }
    }

    // Try context.jwt
    if (context.jwt) {
      return context.jwt;
    }

    return undefined;
  }

  /**
   * Decode JWT (simplified - use proper JWT library in production)
   */
  private decodeJWT(jwt: string): Record<string, unknown> | null {
    try {
      const parts = jwt.split(".");
      if (parts.length !== 3) {
        return null;
      }

      // Decode payload (base64url)
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      );

      return payload;
    } catch (error) {
      return null;
    }
  }

  // ========================================================================
  // DOMAIN RESOLUTION
  // ========================================================================

  /**
   * Resolve tenant by domain
   */
  private async resolveByDomain(
    context: TenantResolutionContext
  ): Promise<TenantResolutionResult> {
    // Extract domain from context
    const domain = this.extractDomain(context);
    if (!domain) {
      throw new TenantResolutionError(
        "No domain provided",
        "NO_DOMAIN",
        "domain"
      );
    }

    // Look up tenant by domain
    const tenant = this.registry.getTenantByDomain(domain);
    if (!tenant) {
      throw new TenantResolutionError(
        `No tenant found for domain: ${domain}`,
        "DOMAIN_NOT_FOUND",
        "domain"
      );
    }

    return {
      tenant,
      method: "domain",
      confidence: 0.9,
      timestamp: Date.now(),
    };
  }

  /**
   * Extract domain from context
   */
  private extractDomain(context: TenantResolutionContext): string | undefined {
    // Try context.domain first
    if (context.domain) {
      return context.domain;
    }

    // Try Host header
    if (context.headers?.["host"]) {
      const host = context.headers["host"];
      // Remove port if present
      return host.split(":")[0];
    }

    // Try x-forwarded-host header
    if (context.headers?.["x-forwarded-host"]) {
      return context.headers["x-forwarded-host"];
    }

    return undefined;
  }

  // ========================================================================
  // HEADER RESOLUTION
  // ========================================================================

  /**
   * Resolve tenant by custom header
   */
  private async resolveByHeader(
    context: TenantResolutionContext
  ): Promise<TenantResolutionResult> {
    // Try x-tenant-id header
    const tenantIdHeader = context.headers?.["x-tenant-id"];
    if (tenantIdHeader) {
      const tenantId = createTenantId(tenantIdHeader);
      const tenant = this.registry.getTenant(tenantId);
      if (tenant) {
        return {
          tenant,
          method: "header",
          confidence: 0.8,
          timestamp: Date.now(),
        };
      }
    }

    // Try x-tenant-name header
    const tenantNameHeader = context.headers?.["x-tenant-name"];
    if (tenantNameHeader) {
      const tenants = this.registry.listTenants();
      const tenant = tenants.find((t) => t.name === tenantNameHeader);
      if (tenant) {
        return {
          tenant,
          method: "header",
          confidence: 0.7,
          timestamp: Date.now(),
        };
      }
    }

    throw new TenantResolutionError(
      "No tenant found in headers",
      "NO_TENANT_IN_HEADERS",
      "header"
    );
  }

  // ========================================================================
  // QUERY PARAMETER RESOLUTION
  // ========================================================================

  /**
   * Resolve tenant by query parameter
   */
  private async resolveByQueryParam(
    context: TenantResolutionContext
  ): Promise<TenantResolutionResult> {
    // Try tenant_id query parameter
    const tenantIdParam = context.query?.["tenant_id"];
    if (tenantIdParam) {
      const tenantId = createTenantId(tenantIdParam);
      const tenant = this.registry.getTenant(tenantId);
      if (tenant) {
        return {
          tenant,
          method: "query-param",
          confidence: 0.6,
          timestamp: Date.now(),
        };
      }
    }

    // Try tenant query parameter
    const tenantParam = context.query?.["tenant"];
    if (tenantParam) {
      const tenants = this.registry.listTenants();
      const tenant = tenants.find((t) => t.name === tenantParam);
      if (tenant) {
        return {
          tenant,
          method: "query-param",
          confidence: 0.5,
          timestamp: Date.now(),
        };
      }
    }

    throw new TenantResolutionError(
      "No tenant found in query parameters",
      "NO_TENANT_IN_QUERY",
      "query-param"
    );
  }

  // ========================================================================
  // CACHING
  // ========================================================================

  /**
   * Get cache key for context
   */
  private getCacheKey(context: TenantResolutionContext): string {
    const parts: string[] = [];

    if (context.apiKey) {
      parts.push(`apikey:${context.apiKey.substring(0, 8)}`);
    }

    if (context.jwt) {
      parts.push(`jwt:${context.jwt.substring(0, 8)}`);
    }

    if (context.domain) {
      parts.push(`domain:${context.domain}`);
    }

    if (context.headers?.["x-tenant-id"]) {
      parts.push(`header:${context.headers["x-tenant-id"]}`);
    }

    if (context.query?.["tenant_id"]) {
      parts.push(`query:${context.query["tenant_id"]}`);
    }

    return parts.join("|") || "default";
  }

  /**
   * Clear resolution cache
   */
  clearCache(): void {
    this.resolutionCache.clear();
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.resolutionCache.entries()) {
      if (value.expiresAt < now) {
        this.resolutionCache.delete(key);
      }
    }
  }

  // ========================================================================
  // API KEY MANAGEMENT
  // ========================================================================

  /**
   * Register API key for tenant
   */
  async registerAPIKey(
    tenantId: TenantId,
    apiKey: string,
    metadata?: {
      name?: string;
      scopes?: string[];
      expiresAt?: number;
    }
  ): Promise<TenantAPIKey> {
    const tenant = this.registry.getTenant(tenantId);
    if (!tenant) {
      throw new TenantResolutionError(
        `Tenant not found: ${tenantId}`,
        "TENANT_NOT_FOUND"
      );
    }

    // Hash the API key
    const keyHash = this.hashAPIKey(apiKey);

    // Store API key hash mapping
    // (In production, store in secure database)

    return {
      keyId: `key_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      keyHash,
      tenantId,
      createdAt: Date.now(),
      expiresAt: metadata?.expiresAt,
      lastUsedAt: undefined,
      status: "active",
      scopes: metadata?.scopes || [],
      name: metadata?.name,
    };
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(_keyId: string): Promise<void> {
    // Remove API key mapping
    // (In production, update in secure database)
  }

  /**
   * Validate API key
   */
  async validateAPIKey(apiKey: string): Promise<TenantAPIKey | null> {
    const keyHash = this.hashAPIKey(apiKey);
    const tenant = this.registry.getTenantByAPIKey(keyHash);

    if (!tenant) {
      return null;
    }

    return {
      keyId: `key_${keyHash}`,
      keyHash,
      tenantId: tenant.id,
      createdAt: Date.now(),
      status: "active",
      scopes: [],
    };
  }
}
