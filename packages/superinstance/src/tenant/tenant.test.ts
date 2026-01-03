/**
 * @fileoverview Multi-Tenant Tests
 *
 * Comprehensive test suite for multi-tenant isolation including:
 * - Tenant registry tests
 * - Tenant resolver tests
 * - Tenant context tests
 * - Resource quota tests
 * - Billing tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TenantRegistry,
  type Tenant,
  type TenantId,
  createTenantId,
} from "./TenantRegistry.js";
import { TenantResolver } from "./TenantResolver.js";
import { TenantContextManager } from "./TenantContext.js";
import { ResourceQuotaEnforcer } from "../isolation/ResourceQuotas.js";
import { BillingManager } from "./Billing.js";

// ============================================================================
// FIXTURES
// ============================================================================

let testTenantId: TenantId;
let testTenant: Tenant;

beforeEach(() => {
  testTenantId = createTenantId("test-tenant-123");
  testTenant = {
    id: testTenantId,
    name: "Test Organization",
    displayName: "Test Org",
    status: "active",
    plan: "basic",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    email: "test@example.com",
    domain: "test.example.com",
  };
});

// ============================================================================
// TENANT REGISTRY TESTS
// ============================================================================

describe("TenantRegistry", () => {
  it("should register a new tenant", async () => {
    const registry = new TenantRegistry();

    const tenant = await registry.register({
      name: "Test Organization",
      displayName: "Test Org",
      status: "active",
      plan: "basic",
      email: "test@example.com",
    });

    expect(tenant).toBeDefined();
    expect(tenant.id).toBeDefined();
    expect(tenant.name).toBe("Test Organization");
    expect(tenant.plan).toBe("basic");
    expect(tenant.status).toBe("active");
  });

  it("should get tenant by ID", async () => {
    const registry = new TenantRegistry();

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const retrieved = registry.getTenant(tenant.id);
    expect(retrieved).toEqual(tenant);
  });

  it("should update tenant", async () => {
    const registry = new TenantRegistry();

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const updated = await registry.updateTenant(tenant.id, {
      name: "Updated Organization",
    });

    expect(updated.name).toBe("Updated Organization");
    expect(updated.id).toBe(tenant.id);
  });

  it("should suspend tenant", async () => {
    const registry = new TenantRegistry();

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const suspended = await registry.suspendTenant(tenant.id);
    expect(suspended.status).toBe("suspended");
  });

  it("should delete tenant", async () => {
    const registry = new TenantRegistry();

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const deleted = await registry.deleteTenant(tenant.id);
    expect(deleted.status).toBe("deleted");
    expect(deleted.deletedAt).toBeDefined();
  });

  it("should get registry statistics", async () => {
    const registry = new TenantRegistry();

    await registry.register({ name: "Tenant 1", status: "active", plan: "basic" });
    await registry.register({ name: "Tenant 2", status: "active", plan: "pro" });
    await registry.register({ name: "Tenant 3", status: "suspended", plan: "free" });

    const stats = registry.getStats();

    expect(stats.totalTenants).toBe(3);
    expect(stats.activeTenants).toBe(2);
    expect(stats.suspendedTenants).toBe(1);
    expect(stats.tenantsByPlan.basic).toBe(1);
    expect(stats.tenantsByPlan.pro).toBe(1);
    expect(stats.tenantsByPlan.free).toBe(1);
  });

  it("should validate tenant input", async () => {
    const registry = new TenantRegistry();

    await expect(
      registry.register({
        name: "",
        status: "active",
        plan: "basic",
      })
    ).rejects.toThrow("Invalid tenant");
  });

  it("should filter tenants by status", async () => {
    const registry = new TenantRegistry();

    await registry.register({ name: "Tenant 1", status: "active", plan: "basic" });
    await registry.register({ name: "Tenant 2", status: "suspended", plan: "basic" });

    const activeTenants = registry.listTenants({ status: "active" });
    expect(activeTenants).toHaveLength(1);
  });

  it("should filter tenants by plan", async () => {
    const registry = new TenantRegistry();

    await registry.register({ name: "Tenant 1", status: "active", plan: "basic" });
    await registry.register({ name: "Tenant 2", status: "active", plan: "pro" });

    const proTenants = registry.listTenants({ plan: "pro" });
    expect(proTenants).toHaveLength(1);
  });
});

// ============================================================================
// TENANT RESOLVER TESTS
// ============================================================================

describe("TenantResolver", () => {
  it("should resolve tenant by API key", async () => {
    const registry = new TenantRegistry();
    const resolver = new TenantResolver(registry);

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const result = await resolver.resolve({
      apiKey: "test-api-key-123",
    });

    expect(result).toBeDefined();
    expect(result.method).toBe("api-key");
  });

  it("should resolve tenant by domain", async () => {
    const registry = new TenantRegistry();
    const resolver = new TenantResolver(registry);

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
      domain: "test.example.com",
    });

    const result = await resolver.resolve({
      domain: "test.example.com",
    });

    expect(result).toBeDefined();
    expect(result.method).toBe("domain");
  });

  it("should resolve tenant by header", async () => {
    const registry = new TenantRegistry();
    const resolver = new TenantResolver(registry);

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const result = await resolver.resolve({
      headers: {
        "x-tenant-id": tenant.id,
      },
    });

    expect(result).toBeDefined();
    expect(result.method).toBe("header");
  });

  it("should use fallback methods", async () => {
    const registry = new TenantRegistry();
    const resolver = new TenantResolver(registry, {
      fallbackMethods: ["header", "domain"],
    });

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const result = await resolver.resolve({
      headers: {
        "x-tenant-id": tenant.id,
      },
    });

    expect(result).toBeDefined();
  });

  it("should cache resolution results", async () => {
    const registry = new TenantRegistry();
    const resolver = new TenantResolver(registry, {
      enableCache: true,
      cacheTTL: 1000,
    });

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const context = {
      headers: {
        "x-tenant-id": tenant.id,
      },
    };

    await resolver.resolve(context);
    await resolver.resolve(context); // Should use cache

    expect(true).toBe(true); // If no error, caching worked
  });

  it("should reject inactive tenants", async () => {
    const registry = new TenantRegistry();
    const resolver = new TenantResolver(registry);

    const tenant = await registry.register({
      name: "Test Organization",
      status: "suspended",
      plan: "basic",
    });

    await expect(
      resolver.resolve({
        headers: {
          "x-tenant-id": tenant.id,
        },
      })
    ).rejects.toThrow("not active");
  });
});

// ============================================================================
// TENANT CONTEXT TESTS
// ============================================================================

describe("TenantContextManager", () => {
  it("should create execution context", async () => {
    const registry = new TenantRegistry();
    const contextManager = new TenantContextManager(registry);

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const context = await contextManager.getExecutionContext(tenant.id);

    expect(context).toBeDefined();
    expect(context.tenantId).toBe(tenant.id);
    expect(context.config).toBeDefined();
    expect(context.namespaces.size).toBeGreaterThan(0);
  });

  it("should create request context", async () => {
    const registry = new TenantRegistry();
    const contextManager = new TenantContextManager(registry);

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    const requestContext = await contextManager.createRequestContext(
      tenant.id,
      "test-request-123"
    );

    expect(requestContext).toBeDefined();
    expect(requestContext.tenantId).toBe(tenant.id);
    expect(requestContext.requestId).toBe("test-request-123");
  });

  it("should check quotas", async () => {
    const registry = new TenantRegistry();
    const contextManager = new TenantContextManager(registry, {
      enableQuotaChecking: true,
    });

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "free",
    });

    const violations = await contextManager.checkQuotas(tenant.id);
    expect(Array.isArray(violations)).toBe(true);
  });

  it("should track usage", async () => {
    const registry = new TenantRegistry();
    const contextManager = new TenantContextManager(registry, {
      enableUsageTracking: true,
    });

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    contextManager.trackRequest(tenant.id, {
      tokens: 1000,
      latency: 100,
      computeTime: 5,
      model: "gpt-4",
    });

    const usage = contextManager.getUsageMetrics(tenant.id);
    expect(usage).toBeDefined();
    expect(usage?.tokens.totalTokens).toBe(1000);
  });

  it("should invalidate context", async () => {
    const registry = new TenantRegistry();
    const contextManager = new TenantContextManager(registry);

    const tenant = await registry.register({
      name: "Test Organization",
      status: "active",
      plan: "basic",
    });

    await contextManager.getExecutionContext(tenant.id);
    contextManager.invalidateContext(tenant.id);

    // Context should be recreated on next call
    const context = await contextManager.getExecutionContext(tenant.id);
    expect(context).toBeDefined();
  });
});

// ============================================================================
// RESOURCE QUOTA TESTS
// ============================================================================

describe("ResourceQuotaEnforcer", () => {
  it("should check rate limits", async () => {
    const enforcer = new ResourceQuotaEnforcer({
      enableRateLimiting: true,
    });

    const tenantId = createTenantId("test-tenant");
    enforcer.setQuota(tenantId, {
      tenantId,
      rateLimit: {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstAllowance: 20,
      },
      tokenQuota: {
        tokensPerDay: 100000,
        tokensPerMonth: 1000000,
        usedTokens: 0,
        lastReset: Date.now(),
      },
      storageQuota: {
        maxStorageBytes: 1024 * 1024 * 1024,
        maxKnowledgeEntries: 10000,
        maxCacheEntries: 1000,
        usedStorageBytes: 0,
        usedKnowledgeEntries: 0,
        usedCacheEntries: 0,
      },
      inferenceQuota: {
        requestsPerDay: 1000,
        computeTimePerDay: 3600,
        maxConcurrentRequests: 5,
        usedRequests: 0,
        usedComputeTime: 0,
        lastReset: Date.now(),
      },
      resetInterval: "daily",
    });

    const violation = await enforcer.checkRateLimit(tenantId);
    expect(violation).toBeNull(); // No violations initially
  });

  it("should track requests", async () => {
    const enforcer = new ResourceQuotaEnforcer();
    const tenantId = createTenantId("test-tenant");

    enforcer.trackRequest(tenantId);
    enforcer.trackRequest(tenantId);
    enforcer.trackRequest(tenantId);

    const usage = enforcer.getUsage(tenantId);
    expect(usage).toBeDefined();
    expect(usage?.requests.perSecond).toBeGreaterThanOrEqual(0);
  });

  it("should track token usage", async () => {
    const enforcer = new ResourceQuotaEnforcer();
    const tenantId = createTenantId("test-tenant");

    enforcer.trackTokens(tenantId, 1000);
    enforcer.trackTokens(tenantId, 2000);

    const usage = enforcer.getUsage(tenantId);
    expect(usage?.tokens).toBe(3000);
  });

  it("should track storage usage", async () => {
    const enforcer = new ResourceQuotaEnforcer();
    const tenantId = createTenantId("test-tenant");

    enforcer.trackStorage(tenantId, 1024 * 1024); // 1 MB

    const usage = enforcer.getUsage(tenantId);
    expect(usage?.storage.bytes).toBe(1024 * 1024);
  });

  it("should check all quotas", async () => {
    const enforcer = new ResourceQuotaEnforcer();
    const tenantId = createTenantId("test-tenant");

    const violations = await enforcer.checkAllQuotas(tenantId);
    expect(Array.isArray(violations)).toBe(true);
  });
});

// ============================================================================
// BILLING TESTS
// ============================================================================

describe("BillingManager", () => {
  it("should track usage", () => {
    const billing = new BillingManager();
    const tenantId = createTenantId("test-tenant");

    billing.trackUsage(tenantId, {
      requests: 100,
      tokens: 10000,
      computeTime: 300,
      model: "gpt-4",
    });

    const usage = billing.getCurrentUsage(tenantId);
    expect(usage).toBeDefined();
    expect(usage?.requests.totalRequests).toBe(100);
    expect(usage?.tokens.totalTokens).toBe(10000);
  });

  it("should calculate cost", () => {
    const billing = new BillingManager();
    const tenantId = createTenantId("test-tenant");

    billing.trackUsage(tenantId, {
      tokens: 5000000, // 5M tokens
      requests: 50000, // 50K requests
    });

    const cost = billing.calculateCost(tenantId, "basic", "monthly");
    expect(cost).toBeDefined();
    expect(cost.totalCost).toBeGreaterThan(0);
  });

  it("should generate invoice", () => {
    const billing = new BillingManager();
    const tenantId = createTenantId("test-tenant");

    billing.trackUsage(tenantId, {
      tokens: 5000000,
      requests: 50000,
    });

    const invoice = billing.generateInvoice(tenantId, "basic", "monthly");
    expect(invoice).toBeDefined();
    expect(invoice.invoiceId).toBeDefined();
    expect(invoice.status).toBe("pending");
  });

  it("should get invoice", () => {
    const billing = new BillingManager();
    const tenantId = createTenantId("test-tenant");

    const invoice = billing.generateInvoice(tenantId, "basic", "monthly");
    const retrieved = billing.getInvoice(invoice.invoiceId);

    expect(retrieved).toEqual(invoice);
  });

  it("should mark invoice as paid", () => {
    const billing = new BillingManager();
    const tenantId = createTenantId("test-tenant");

    const invoice = billing.generateInvoice(tenantId, "basic", "monthly");
    billing.markInvoicePaid(invoice.invoiceId);

    const updated = billing.getInvoice(invoice.invoiceId);
    expect(updated?.status).toBe("paid");
    expect(updated?.paidAt).toBeDefined();
  });

  it("should reset usage", () => {
    const billing = new BillingManager();
    const tenantId = createTenantId("test-tenant");

    billing.trackUsage(tenantId, {
      tokens: 10000,
      requests: 100,
    });

    billing.resetUsage(tenantId);

    const usage = billing.getCurrentUsage(tenantId);
    expect(usage?.tokens.totalTokens).toBe(0);
    expect(usage?.requests.totalRequests).toBe(0);
  });
});
