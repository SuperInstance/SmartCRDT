/**
 * @fileoverview Resource Quotas - Multi-Tenant Resource Quota Enforcement
 *
 * Enforces resource quotas for tenants including:
 * - Rate limits (requests per second/minute/hour/day)
 * - Token quotas (daily/monthly limits)
 * - Storage quotas (knowledge graph, cache, embeddings)
 * - Inference quotas (compute time, concurrent requests)
 *
 * @module @lsi/superinstance/isolation/ResourceQuotas
 */

import type {
  TenantId,
  ResourceQuota,
  RateLimit,
  TokenQuota,
  StorageQuota,
  InferenceQuota,
  QuotaResetInterval,
  QuotaViolation,
} from "@lsi/protocol";

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Quota enforcement error
 */
export class QuotaEnforcementError extends Error {
  constructor(
    message: string,
    public code: string,
    public tenantId: TenantId,
    public quotaType: string
  ) {
    super(message);
    this.name = "QuotaEnforcementError";
  }
}

// ============================================================================
// QUOTA TRACKING
// ============================================================================

/**
 * Request tracking entry
 */
interface RequestTrackingEntry {
  timestamp: number;
  count: number;
}

/**
 * Token tracking entry
 */
interface TokenTrackingEntry {
  timestamp: number;
  tokens: number;
}

/**
 * Resource quota tracker
 *
 * Tracks resource usage for quota enforcement.
 */
class ResourceQuotaTracker {
  private tenantId: TenantId;
  private requests: RequestTrackingEntry[] = [];
  private tokens: TokenTrackingEntry[] = [];
  private storageUsed: number = 0;
  private knowledgeEntries: number = 0;
  private cacheEntries: number = 0;
  private inferenceRequests: number = 0;
  private inferenceComputeTime: number = 0;
  private currentConcurrentRequests: number = 0;
  private peakConcurrentRequests: number = 0;
  private lastReset: number;

  constructor(tenantId: TenantId) {
    this.tenantId = tenantId;
    this.lastReset = Date.now();
  }

  // ========================================================================
  // REQUEST TRACKING
  // ========================================================================

  /**
   * Track a request
   */
  trackRequest(): void {
    const now = Date.now();
    this.requests.push({ timestamp: now, count: 1 });
    this.cleanup();
  }

  /**
   * Get request count in window
   */
  getRequestCountInWindow(windowMs: number): number {
    const now = Date.now();
    const cutoff = now - windowMs;

    return this.requests
      .filter((r) => r.timestamp > cutoff)
      .reduce((sum, r) => sum + r.count, 0);
  }

  /**
   * Get burst count
   */
  getBurstCount(burstWindowMs: number): number {
    return this.getRequestCountInWindow(burstWindowMs);
  }

  // ========================================================================
  // TOKEN TRACKING
  // ========================================================================

  /**
   * Track token usage
   */
  trackTokens(tokens: number): void {
    const now = Date.now();
    this.tokens.push({ timestamp: now, tokens });
  }

  /**
   * Get token usage in window
   */
  getTokenUsageInWindow(windowMs: number): number {
    const now = Date.now();
    const cutoff = now - windowMs;

    return this.tokens
      .filter((t) => t.timestamp > cutoff)
      .reduce((sum, t) => sum + t.tokens, 0);
  }

  /**
   * Get total token usage (since last reset)
   */
  getTotalTokenUsage(): number {
    const lastReset = this.lastReset;
    return this.tokens
      .filter((t) => t.timestamp > lastReset)
      .reduce((sum, t) => sum + t.tokens, 0);
  }

  // ========================================================================
  // STORAGE TRACKING
  // ========================================================================

  /**
   * Track storage usage
   */
  trackStorage(bytes: number): void {
    this.storageUsed += bytes;
  }

  /**
   * Track knowledge entry
   */
  trackKnowledgeEntry(): void {
    this.knowledgeEntries++;
  }

  /**
   * Track cache entry
   */
  trackCacheEntry(): void {
    this.cacheEntries++;
  }

  /**
   * Get storage usage
   */
  getStorageUsage(): {
    totalBytes: number;
    knowledgeEntries: number;
    cacheEntries: number;
  } {
    return {
      totalBytes: this.storageUsed,
      knowledgeEntries: this.knowledgeEntries,
      cacheEntries: this.cacheEntries,
    };
  }

  // ========================================================================
  // INFERENCE TRACKING
  // ========================================================================

  /**
   * Track inference request start
   */
  trackInferenceStart(): void {
    this.inferenceRequests++;
    this.currentConcurrentRequests++;
    if (this.currentConcurrentRequests > this.peakConcurrentRequests) {
      this.peakConcurrentRequests = this.currentConcurrentRequests;
    }
  }

  /**
   * Track inference request end
   */
  trackInferenceEnd(computeTime: number): void {
    this.currentConcurrentRequests--;
    this.inferenceComputeTime += computeTime;
  }

  /**
   * Get inference usage
   */
  getInferenceUsage(): {
    totalRequests: number;
    computeTime: number;
    currentConcurrent: number;
    peakConcurrent: number;
  } {
    return {
      totalRequests: this.inferenceRequests,
      computeTime: this.inferenceComputeTime,
      currentConcurrent: this.currentConcurrentRequests,
      peakConcurrent: this.peakConcurrentRequests,
    };
  }

  // ========================================================================
  // RESET
  // ========================================================================

  /**
   * Reset counters
   */
  reset(): void {
    this.requests = [];
    this.tokens = [];
    this.inferenceRequests = 0;
    this.inferenceComputeTime = 0;
    this.lastReset = Date.now();
  }

  /**
   * Get last reset time
   */
  getLastReset(): number {
    return this.lastReset;
  }

  // ========================================================================
  // CLEANUP
  // ========================================================================

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - 86400000; // 24 hours

    // Cleanup old request entries
    this.requests = this.requests.filter((r) => r.timestamp > cutoff);

    // Cleanup old token entries
    this.tokens = this.tokens.filter((t) => t.timestamp > cutoff);
  }
}

// ============================================================================
// RESOURCE QUOTA ENFORCER
// ============================================================================

/**
 * Resource quota enforcer configuration
 */
export interface ResourceQuotaEnforcerConfig {
  /** Enable rate limiting */
  enableRateLimiting?: boolean;
  /** Enable token quotas */
  enableTokenQuotas?: boolean;
  /** Enable storage quotas */
  enableStorageQuotas?: boolean;
  /** Enable inference quotas */
  enableInferenceQuotas?: boolean;
  /** Action when quota exceeded */
  quotaExceededAction?: "reject" | "warn" | "throttle";
}

/**
 * Resource quota enforcer
 *
 * Enforces resource quotas for tenants.
 */
export class ResourceQuotaEnforcer {
  private config: ResourceQuotaEnforcerConfig;
  private trackers: Map<TenantId, ResourceQuotaTracker> = new Map();
  private quotas: Map<TenantId, ResourceQuota> = new Map();

  constructor(config?: ResourceQuotaEnforcerConfig) {
    this.config = {
      enableRateLimiting: true,
      enableTokenQuotas: true,
      enableStorageQuotas: true,
      enableInferenceQuotas: true,
      quotaExceededAction: "reject",
      ...config,
    };
  }

  // ========================================================================
  // QUOTA MANAGEMENT
  // ========================================================================

  /**
   * Set quota for tenant
   */
  setQuota(tenantId: TenantId, quota: ResourceQuota): void {
    this.quotas.set(tenantId, quota);
  }

  /**
   * Get quota for tenant
   */
  getQuota(tenantId: TenantId): ResourceQuota | undefined {
    return this.quotas.get(tenantId);
  }

  /**
   * Remove quota for tenant
   */
  removeQuota(tenantId: TenantId): void {
    this.quotas.delete(tenantId);
    this.trackers.delete(tenantId);
  }

  // ========================================================================
  // RATE LIMITING
  // ========================================================================

  /**
   * Check rate limit
   */
  async checkRateLimit(
    tenantId: TenantId,
    burstAllowance?: number
  ): Promise<QuotaViolation | null> {
    if (!this.config.enableRateLimiting) {
      return null;
    }

    const quota = this.quotas.get(tenantId);
    if (!quota) {
      return null;
    }

    const tracker = this.getTracker(tenantId);
    const rateLimit = quota.rateLimit;

    const now = Date.now();

    // Check per-second limit
    const requestsPerSecond = tracker.getRequestCountInWindow(1000);
    if (requestsPerSecond > rateLimit.requestsPerSecond) {
      return {
        type: "rate-limit",
        severity: "error",
        currentUsage: requestsPerSecond,
        limit: rateLimit.requestsPerSecond,
        timestamp: now,
      };
    }

    // Check burst allowance
    if (burstAllowance) {
      const burstCount = tracker.getBurstCount(burstAllowance);
      if (burstCount > rateLimit.burstAllowance) {
        return {
          type: "rate-limit",
          severity: "warning",
          currentUsage: burstCount,
          limit: rateLimit.burstAllowance,
          timestamp: now,
        };
      }
    }

    // Check per-minute limit
    const requestsPerMinute = tracker.getRequestCountInWindow(60000);
    if (requestsPerMinute > rateLimit.requestsPerMinute) {
      return {
        type: "rate-limit",
        severity: "error",
        currentUsage: requestsPerMinute,
        limit: rateLimit.requestsPerMinute,
        timestamp: now,
      };
    }

    // Check per-hour limit
    const requestsPerHour = tracker.getRequestCountInWindow(3600000);
    if (requestsPerHour > rateLimit.requestsPerHour) {
      return {
        type: "rate-limit",
        severity: "error",
        currentUsage: requestsPerHour,
        limit: rateLimit.requestsPerHour,
        timestamp: now,
      };
    }

    // Check per-day limit
    const requestsPerDay = tracker.getRequestCountInWindow(86400000);
    if (requestsPerDay > rateLimit.requestsPerDay) {
      return {
        type: "rate-limit",
        severity: "error",
        currentUsage: requestsPerDay,
        limit: rateLimit.requestsPerDay,
        timestamp: now,
      };
    }

    return null;
  }

  /**
   * Track request
   */
  trackRequest(tenantId: TenantId): void {
    const tracker = this.getTracker(tenantId);
    tracker.trackRequest();
  }

  // ========================================================================
  // TOKEN QUOTAS
  // ========================================================================

  /**
   * Check token quota
   */
  async checkTokenQuota(
    tenantId: TenantId,
    tokensToAdd: number = 0
  ): Promise<QuotaViolation | null> {
    if (!this.config.enableTokenQuotas) {
      return null;
    }

    const quota = this.quotas.get(tenantId);
    if (!quota) {
      return null;
    }

    const tracker = this.getTracker(tenantId);
    const tokenQuota = quota.tokenQuota;

    const currentUsage = tracker.getTotalTokenUsage() + tokensToAdd;

    // Check daily limit
    if (currentUsage > tokenQuota.tokensPerDay) {
      return {
        type: "token-quota",
        severity: "error",
        currentUsage,
        limit: tokenQuota.tokensPerDay,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  /**
   * Track token usage
   */
  trackTokens(tenantId: TenantId, tokens: number): void {
    const tracker = this.getTracker(tenantId);
    tracker.trackTokens(tokens);
  }

  // ========================================================================
  // STORAGE QUOTAS
  // ========================================================================

  /**
   * Check storage quota
   */
  async checkStorageQuota(
    tenantId: TenantId,
    bytesToAdd: number = 0
  ): Promise<QuotaViolation | null> {
    if (!this.config.enableStorageQuotas) {
      return null;
    }

    const quota = this.quotas.get(tenantId);
    if (!quota) {
      return null;
    }

    const tracker = this.getTracker(tenantId);
    const storageQuota = quota.storageQuota;

    const storageUsage = tracker.getStorageUsage();

    // Check storage bytes
    if (storageUsage.totalBytes + bytesToAdd > storageQuota.maxStorageBytes) {
      return {
        type: "storage-quota",
        severity: "warning",
        currentUsage: storageUsage.totalBytes + bytesToAdd,
        limit: storageQuota.maxStorageBytes,
        timestamp: Date.now(),
      };
    }

    // Check knowledge entries
    if (storageUsage.knowledgeEntries >= storageQuota.maxKnowledgeEntries) {
      return {
        type: "storage-quota",
        severity: "warning",
        currentUsage: storageUsage.knowledgeEntries,
        limit: storageQuota.maxKnowledgeEntries,
        timestamp: Date.now(),
      };
    }

    // Check cache entries
    if (storageUsage.cacheEntries >= storageQuota.maxCacheEntries) {
      return {
        type: "storage-quota",
        severity: "warning",
        currentUsage: storageUsage.cacheEntries,
        limit: storageQuota.maxCacheEntries,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  /**
   * Track storage usage
   */
  trackStorage(tenantId: TenantId, bytes: number): void {
    const tracker = this.getTracker(tenantId);
    tracker.trackStorage(bytes);
  }

  /**
   * Track knowledge entry
   */
  trackKnowledgeEntry(tenantId: TenantId): void {
    const tracker = this.getTracker(tenantId);
    tracker.trackKnowledgeEntry();
  }

  /**
   * Track cache entry
   */
  trackCacheEntry(tenantId: TenantId): void {
    const tracker = this.getTracker(tenantId);
    tracker.trackCacheEntry();
  }

  // ========================================================================
  // INFERENCE QUOTAS
  // ========================================================================

  /**
   * Check inference quota
   */
  async checkInferenceQuota(
    tenantId: TenantId,
    computeTimeToAdd: number = 0
  ): Promise<QuotaViolation | null> {
    if (!this.config.enableInferenceQuotas) {
      return null;
    }

    const quota = this.quotas.get(tenantId);
    if (!quota) {
      return null;
    }

    const tracker = this.getTracker(tenantId);
    const inferenceQuota = quota.inferenceQuota;

    const inferenceUsage = tracker.getInferenceUsage();

    // Check daily request limit
    if (inferenceUsage.totalRequests >= inferenceQuota.requestsPerDay) {
      return {
        type: "inference-quota",
        severity: "error",
        currentUsage: inferenceUsage.totalRequests,
        limit: inferenceQuota.requestsPerDay,
        timestamp: Date.now(),
      };
    }

    // Check compute time limit
    if (inferenceUsage.computeTime + computeTimeToAdd > inferenceQuota.computeTimePerDay) {
      return {
        type: "inference-quota",
        severity: "error",
        currentUsage: inferenceUsage.computeTime + computeTimeToAdd,
        limit: inferenceQuota.computeTimePerDay,
        timestamp: Date.now(),
      };
    }

    // Check concurrent requests
    if (inferenceUsage.currentConcurrent >= inferenceQuota.maxConcurrentRequests) {
      return {
        type: "inference-quota",
        severity: "error",
        currentUsage: inferenceUsage.currentConcurrent,
        limit: inferenceQuota.maxConcurrentRequests,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  /**
   * Track inference start
   */
  trackInferenceStart(tenantId: TenantId): void {
    const tracker = this.getTracker(tenantId);
    tracker.trackInferenceStart();
  }

  /**
   * Track inference end
   */
  trackInferenceEnd(tenantId: TenantId, computeTime: number): void {
    const tracker = this.getTracker(tenantId);
    tracker.trackInferenceEnd(computeTime);
  }

  // ========================================================================
  // COMPREHENSIVE QUOTA CHECK
  // ========================================================================

  /**
   * Check all quotas
   */
  async checkAllQuotas(tenantId: TenantId): Promise<QuotaViolation[]> {
    const violations: QuotaViolation[] = [];

    // Check rate limit
    const rateLimitViolation = await this.checkRateLimit(tenantId);
    if (rateLimitViolation) {
      violations.push(rateLimitViolation);
    }

    // Check token quota
    const tokenQuotaViolation = await this.checkTokenQuota(tenantId);
    if (tokenQuotaViolation) {
      violations.push(tokenQuotaViolation);
    }

    // Check storage quota
    const storageQuotaViolation = await this.checkStorageQuota(tenantId);
    if (storageQuotaViolation) {
      violations.push(storageQuotaViolation);
    }

    // Check inference quota
    const inferenceQuotaViolation = await this.checkInferenceQuota(tenantId);
    if (inferenceQuotaViolation) {
      violations.push(inferenceQuotaViolation);
    }

    return violations;
  }

  // ========================================================================
  // TRACKER MANAGEMENT
  // ========================================================================

  /**
   * Get tracker for tenant
   */
  private getTracker(tenantId: TenantId): ResourceQuotaTracker {
    let tracker = this.trackers.get(tenantId);
    if (!tracker) {
      tracker = new ResourceQuotaTracker(tenantId);
      this.trackers.set(tenantId, tracker);
    }
    return tracker;
  }

  /**
   * Reset tracker for tenant
   */
  resetTracker(tenantId: TenantId): void {
    const tracker = this.trackers.get(tenantId);
    if (tracker) {
      tracker.reset();
    }
  }

  /**
   * Get usage for tenant
   */
  getUsage(tenantId: TenantId): {
    requests: { perSecond: number; perMinute: number; perHour: number; perDay: number };
    tokens: number;
    storage: { bytes: number; knowledgeEntries: number; cacheEntries: number };
    inference: { requests: number; computeTime: number; currentConcurrent: number };
  } | undefined {
    const tracker = this.trackers.get(tenantId);
    if (!tracker) {
      return undefined;
    }

    return {
      requests: {
        perSecond: tracker.getRequestCountInWindow(1000),
        perMinute: tracker.getRequestCountInWindow(60000),
        perHour: tracker.getRequestCountInWindow(3600000),
        perDay: tracker.getRequestCountInWindow(86400000),
      },
      tokens: tracker.getTotalTokenUsage(),
      storage: {
        bytes: tracker.getStorageUsage().totalBytes,
        knowledgeEntries: tracker.getStorageUsage().knowledgeEntries,
        cacheEntries: tracker.getStorageUsage().cacheEntries,
      },
      inference: {
        requests: tracker.getInferenceUsage().totalRequests,
        computeTime: tracker.getInferenceUsage().computeTime,
        currentConcurrent: tracker.getInferenceUsage().currentConcurrent,
      },
    };
  }

  /**
   * Clear all trackers
   */
  clearAll(): void {
    this.trackers.clear();
    this.quotas.clear();
  }
}
