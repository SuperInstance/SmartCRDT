/**
 * @fileoverview Billing - Multi-Tenant Billing and Metering
 *
 * Manages usage tracking, cost calculation, and invoicing:
 * - Usage tracking (requests, tokens, compute)
 * - Cost calculation (per resource)
 * - Billing integration
 * - Usage reports
 *
 * @module @lsi/superinstance/tenant/Billing
 */

import type {
  TenantId,
  TenantPlan,
  UsageMetrics,
  Invoice,
  InvoiceLineItem,
  PricingTier,
  BillingPeriod,
} from "@lsi/protocol";

// ============================================================================
// ERROR TYPES
// ============================================================================

export class BillingError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId?: TenantId
  ) {
    super(message);
    this.name = "BillingError";
  }
}

// ============================================================================
// PRICING TIERS
// ============================================================================

const DEFAULT_PRICING_TIERS: Record<TenantPlan, PricingTier> = {
  free: {
    name: "Free",
    plan: "free",
    monthlyPrice: 0,
    includedQuotas: {
      tenantId: "default" as any,
      rateLimit: {
        requestsPerSecond: 1,
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 1000,
        burstAllowance: 10,
      },
      tokenQuota: {
        tokensPerDay: 10000,
        tokensPerMonth: 100000,
        usedTokens: 0,
        lastReset: Date.now(),
      },
      storageQuota: {
        maxStorageBytes: 100 * 1024 * 1024,
        maxKnowledgeEntries: 1000,
        maxCacheEntries: 100,
        usedStorageBytes: 0,
        usedKnowledgeEntries: 0,
        usedCacheEntries: 0,
      },
      inferenceQuota: {
        requestsPerDay: 100,
        computeTimePerDay: 300,
        maxConcurrentRequests: 1,
        usedRequests: 0,
        usedComputeTime: 0,
        lastReset: Date.now(),
      },
      resetInterval: "daily",
    },
    overagePricing: {
      pricePer1kTokens: 0.01,
      pricePer1mbStorage: 0.001,
      pricePer1kRequests: 0.001,
      currency: "USD",
    },
    currency: "USD",
  },
  basic: {
    name: "Basic",
    plan: "basic",
    monthlyPrice: 29,
    includedQuotas: {
      tenantId: "default" as any,
      rateLimit: {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstAllowance: 100,
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
    },
    overagePricing: {
      pricePer1kTokens: 0.008,
      pricePer1mbStorage: 0.0008,
      pricePer1kRequests: 0.0008,
      currency: "USD",
    },
    currency: "USD",
  },
  pro: {
    name: "Pro",
    plan: "pro",
    monthlyPrice: 99,
    includedQuotas: {
      tenantId: "default" as any,
      rateLimit: {
        requestsPerSecond: 50,
        requestsPerMinute: 500,
        requestsPerHour: 10000,
        requestsPerDay: 100000,
        burstAllowance: 500,
      },
      tokenQuota: {
        tokensPerDay: 1000000,
        tokensPerMonth: 10000000,
        usedTokens: 0,
        lastReset: Date.now(),
      },
      storageQuota: {
        maxStorageBytes: 10 * 1024 * 1024 * 1024,
        maxKnowledgeEntries: 100000,
        maxCacheEntries: 10000,
        usedStorageBytes: 0,
        usedKnowledgeEntries: 0,
        usedCacheEntries: 0,
      },
      inferenceQuota: {
        requestsPerDay: 10000,
        computeTimePerDay: 14400,
        maxConcurrentRequests: 20,
        usedRequests: 0,
        usedComputeTime: 0,
        lastReset: Date.now(),
      },
      resetInterval: "daily",
    },
    overagePricing: {
      pricePer1kTokens: 0.005,
      pricePer1mbStorage: 0.0005,
      pricePer1kRequests: 0.0005,
      currency: "USD",
    },
    currency: "USD",
  },
  enterprise: {
    name: "Enterprise",
    plan: "enterprise",
    monthlyPrice: 499,
    includedQuotas: {
      tenantId: "default" as any,
      rateLimit: {
        requestsPerSecond: 1000,
        requestsPerMinute: 10000,
        requestsPerHour: 100000,
        requestsPerDay: 1000000,
        burstAllowance: 10000,
      },
      tokenQuota: {
        tokensPerDay: 10000000,
        tokensPerMonth: 100000000,
        usedTokens: 0,
        lastReset: Date.now(),
      },
      storageQuota: {
        maxStorageBytes: 100 * 1024 * 1024 * 1024,
        maxKnowledgeEntries: 1000000,
        maxCacheEntries: 100000,
        usedStorageBytes: 0,
        usedKnowledgeEntries: 0,
        usedCacheEntries: 0,
      },
      inferenceQuota: {
        requestsPerDay: 100000,
        computeTimePerDay: 86400,
        maxConcurrentRequests: 100,
        usedRequests: 0,
        usedComputeTime: 0,
        lastReset: Date.now(),
      },
      resetInterval: "daily",
    },
    overagePricing: {
      pricePer1kTokens: 0.003,
      pricePer1mbStorage: 0.0003,
      pricePer1kRequests: 0.0003,
      currency: "USD",
    },
    currency: "USD",
  },
};

// ============================================================================
// BILLING MANAGER
// ============================================================================

export interface BillingManagerConfig {
  pricingTiers?: Record<TenantPlan, PricingTier>;
  defaultBillingPeriod?: BillingPeriod;
  enableAutoInvoicing?: boolean;
}

export class BillingManager {
  private config: BillingManagerConfig;
  private usageMetrics: Map<TenantId, UsageMetrics[]> = new Map(); // tenant ID -> metrics history
  private invoices: Map<string, Invoice> = new Map(); // invoice ID -> invoice
  private currentMetrics: Map<TenantId, UsageMetrics> = new Map();

  constructor(config?: BillingManagerConfig) {
    this.config = {
      pricingTiers: DEFAULT_PRICING_TIERS,
      defaultBillingPeriod: "monthly",
      enableAutoInvoicing: true,
      ...config,
    };
  }

  // ========================================================================
  // USAGE TRACKING
  // ========================================================================

  /**
   * Track usage for tenant
   */
  trackUsage(
    tenantId: TenantId,
    usage: {
      requests?: number;
      tokens?: number;
      computeTime?: number;
      storage?: number;
      model?: string;
    }
  ): void {
    let metrics = this.currentMetrics.get(tenantId);

    if (!metrics) {
      metrics = this.createInitialMetrics(tenantId);
      this.currentMetrics.set(tenantId, metrics);
    }

    // Update request metrics
    if (usage.requests) {
      metrics.requests.totalRequests += usage.requests;
    }

    // Update token metrics
    if (usage.tokens) {
      metrics.tokens.totalTokens += usage.tokens;
      metrics.tokens.promptTokens += Math.floor(usage.tokens * 0.7);
      metrics.tokens.completionTokens += Math.floor(usage.tokens * 0.3);

      if (usage.model) {
        metrics.tokens.tokensByModel[usage.model] =
          (metrics.tokens.tokensByModel[usage.model] || 0) + usage.tokens;
      }
    }

    // Update inference metrics
    if (usage.computeTime) {
      metrics.inference.totalComputeTime += usage.computeTime;
    }

    if (usage.model) {
      metrics.inference.requestsByModel[usage.model] =
        (metrics.inference.requestsByModel[usage.model] || 0) + 1;
    }

    // Update storage metrics
    if (usage.storage) {
      metrics.storage.totalStorageBytes += usage.storage;
    }
  }

  /**
   * Get current usage for tenant
   */
  getCurrentUsage(tenantId: TenantId): UsageMetrics | undefined {
    return this.currentMetrics.get(tenantId);
  }

  /**
   * Reset usage for tenant
   */
  resetUsage(tenantId: TenantId): void {
    // Archive current metrics
    const current = this.currentMetrics.get(tenantId);
    if (current) {
      let history = this.usageMetrics.get(tenantId);
      if (!history) {
        history = [];
        this.usageMetrics.set(tenantId, history);
      }
      history.push(current);
    }

    // Create new metrics
    this.currentMetrics.set(tenantId, this.createInitialMetrics(tenantId));
  }

  // ========================================================================
  // COST CALCULATION
  // ========================================================================

  /**
   * Calculate cost for tenant
   */
  calculateCost(
    tenantId: TenantId,
    plan: TenantPlan,
    billingPeriod: BillingPeriod = "monthly"
  ): {
    baseCost: number;
    overageCost: number;
    totalCost: number;
    currency: string;
    breakdown: InvoiceLineItem[];
  } {
    const pricingTier = this.config.pricingTiers![plan];
    const metrics = this.currentMetrics.get(tenantId);

    if (!metrics) {
      return {
        baseCost: 0,
        overageCost: 0,
        totalCost: 0,
        currency: pricingTier.currency,
        breakdown: [],
      };
    }

    // Calculate base cost
    let baseCost = pricingTier.monthlyPrice;
    if (billingPeriod === "quarterly") {
      baseCost *= 3;
    } else if (billingPeriod === "annual") {
      baseCost *= 12;
    }

    // Calculate overage
    const overage = this.calculateOverage(plan, metrics);
    const overageCost =
      overage.tokens * pricingTier.overagePricing.pricePer1kTokens +
      overage.storage * pricingTier.overagePricing.pricePer1mbStorage +
      overage.requests * pricingTier.overagePricing.pricePer1kRequests;

    const totalCost = baseCost + overageCost;

    // Create breakdown
    const breakdown: InvoiceLineItem[] = [
      {
        id: "base",
        description: `${pricingTier.name} plan (${billingPeriod})`,
        quantity: 1,
        unitPrice: baseCost,
        total: baseCost,
      },
    ];

    if (overage.tokens > 0) {
      breakdown.push({
        id: "overage-tokens",
        description: "Token overage",
        quantity: overage.tokens,
        unitPrice: pricingTier.overagePricing.pricePer1kTokens,
        total: overage.tokens * pricingTier.overagePricing.pricePer1kTokens,
      });
    }

    if (overage.storage > 0) {
      breakdown.push({
        id: "overage-storage",
        description: "Storage overage",
        quantity: overage.storage,
        unitPrice: pricingTier.overagePricing.pricePer1mbStorage,
        total: overage.storage * pricingTier.overagePricing.pricePer1mbStorage,
      });
    }

    if (overage.requests > 0) {
      breakdown.push({
        id: "overage-requests",
        description: "Request overage",
        quantity: overage.requests,
        unitPrice: pricingTier.overagePricing.pricePer1kRequests,
        total: overage.requests * pricingTier.overagePricing.pricePer1kRequests,
      });
    }

    return {
      baseCost,
      overageCost,
      totalCost,
      currency: pricingTier.currency,
      breakdown,
    };
  }

  /**
   * Calculate overage
   */
  private calculateOverage(
    plan: TenantPlan,
    metrics: UsageMetrics
  ): {
    tokens: number; // in 1K
    storage: number; // in MB
    requests: number; // in 1K
  } {
    const pricingTier = this.config.pricingTiers![plan];
    const quotas = pricingTier.includedQuotas;

    // Calculate token overage (in 1K tokens)
    const tokenOverage = Math.max(
      0,
      metrics.tokens.totalTokens - quotas.tokenQuota.tokensPerMonth
    ) / 1000;

    // Calculate storage overage (in MB)
    const storageOverage = Math.max(
      0,
      metrics.storage.totalStorageBytes - quotas.storageQuota.maxStorageBytes
    ) / (1024 * 1024);

    // Calculate request overage (in 1K requests)
    const requestOverage = Math.max(
      0,
      metrics.requests.totalRequests - quotas.rateLimit.requestsPerDay * 30
    ) / 1000;

    return {
      tokens: tokenOverage,
      storage: storageOverage,
      requests: requestOverage,
    };
  }

  // ========================================================================
  // INVOICING
  // ========================================================================

  /**
   * Generate invoice for tenant
   */
  generateInvoice(
    tenantId: TenantId,
    plan: TenantPlan,
    billingPeriod: BillingPeriod = "monthly"
  ): Invoice {
    const now = Date.now();
    const cost = this.calculateCost(tenantId, plan, billingPeriod);

    // Calculate period
    let periodStart: number;
    let periodEnd: number;

    if (billingPeriod === "monthly") {
      periodStart = now - 30 * 24 * 3600000;
      periodEnd = now;
    } else if (billingPeriod === "quarterly") {
      periodStart = now - 90 * 24 * 3600000;
      periodEnd = now;
    } else {
      periodStart = now - 365 * 24 * 3600000;
      periodEnd = now;
    }

    const invoice: Invoice = {
      invoiceId: `inv_${tenantId}_${now}`,
      tenantId,
      periodStart,
      periodEnd,
      status: "pending",
      subtotal: cost.totalCost,
      tax: 0, // Calculate tax based on jurisdiction
      total: cost.totalCost,
      currency: cost.currency,
      lineItems: cost.breakdown,
      createdAt: now,
      dueAt: now + 14 * 24 * 3600000, // 14 days
    };

    this.invoices.set(invoice.invoiceId, invoice);

    return invoice;
  }

  /**
   * Get invoice
   */
  getInvoice(invoiceId: string): Invoice | undefined {
    return this.invoices.get(invoiceId);
  }

  /**
   * Get invoices for tenant
   */
  getTenantInvoices(tenantId: TenantId): Invoice[] {
    return Array.from(this.invoices.values()).filter(
      (inv) => inv.tenantId === tenantId
    );
  }

  /**
   * Mark invoice as paid
   */
  markInvoicePaid(invoiceId: string): void {
    const invoice = this.invoices.get(invoiceId);
    if (invoice) {
      invoice.status = "paid";
      invoice.paidAt = Date.now();
    }
  }

  // ========================================================================
  // USAGE REPORTS
  // ========================================================================

  /**
   * Generate usage report for tenant
   */
  generateUsageReport(
    tenantId: TenantId,
    startDate: number,
    endDate: number
  ): UsageMetrics | undefined {
    // Filter metrics by date range
    const history = this.usageMetrics.get(tenantId);
    if (!history) {
      return undefined;
    }

    return history.find((m) => m.timestamp >= startDate && m.timestamp <= endDate);
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  /**
   * Create initial metrics
   */
  private createInitialMetrics(tenantId: TenantId): UsageMetrics {
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
   * Clear all data
   */
  clearAll(): void {
    this.usageMetrics.clear();
    this.invoices.clear();
    this.currentMetrics.clear();
  }
}
