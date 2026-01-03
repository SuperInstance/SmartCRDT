/**
 * @fileoverview Multi-Tenant Isolation Protocol Types
 *
 * This module defines protocol types for multi-tenant isolation in Aequor.
 * Supports multiple tenants (users, organizations) with complete data,
 * resource, and configuration isolation.
 *
 * @module @lsi/protocol/tenant
 */

// ============================================================================
// TENANT CORE TYPES
// ============================================================================

/**
 * Unique tenant identifier
 */
export type TenantId = string & { readonly __brand: "TenantId" };

/**
 * Tenant status
 */
export type TenantStatus =
  | "active"       // Tenant is active and can use resources
  | "suspended"    // Tenant is temporarily suspended
  | "deleted"      // Tenant is marked for deletion
  | "pending";     // Tenant is being provisioned

/**
 * Tenant plan/subscription tier
 */
export type TenantPlan =
  | "free"         // Free tier with limited resources
  | "basic"        // Basic tier with standard resources
  | "pro"          // Professional tier with enhanced resources
  | "enterprise";  // Enterprise tier with unlimited resources

/**
 * Tenant metadata
 */
export interface Tenant {
  /** Unique tenant identifier */
  id: TenantId;
  /** Tenant name (organization or user name) */
  name: string;
  /** Tenant display name */
  displayName?: string;
  /** Tenant status */
  status: TenantStatus;
  /** Subscription plan */
  plan: TenantPlan;
  /** Tenant creation timestamp */
  createdAt: number;
  /** Tenant last updated timestamp */
  updatedAt: number;
  /** Tenant deletion timestamp (if deleted) */
  deletedAt?: number;
  /** Tenant contact email */
  email?: string;
  /** Tenant domain (for domain-based resolution) */
  domain?: string;
  /** Tenant metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tenant configuration
 */
export interface TenantConfig {
  /** Tenant ID */
  tenantId: TenantId;
  /** Resource quotas */
  quotas: ResourceQuota;
  /** Per-tenant model preferences */
  modelPreferences?: ModelPreferences;
  /** Per-tenant routing rules */
  routingRules?: RoutingRules;
  /** Per-tenant privacy settings */
  privacySettings?: PrivacySettings;
  /** Per-tenant hardware preferences */
  hardwarePreferences?: HardwarePreferences;
  /** Per-tenant cache configuration */
  cacheConfig?: CacheConfiguration;
  /** Configuration timestamp */
  updatedAt: number;
}

// ============================================================================
// RESOURCE QUOTA TYPES
// ============================================================================

/**
 * Resource quota limits
 */
export interface ResourceQuota {
  /** Tenant ID */
  tenantId: TenantId;
  /** Request rate limits */
  rateLimit: RateLimit;
  /** Token quotas */
  tokenQuota: TokenQuota;
  /** Storage quotas */
  storageQuota: StorageQuota;
  /** Model inference quotas */
  inferenceQuota: InferenceQuota;
  /** Quota reset interval */
  resetInterval: QuotaResetInterval;
}

/**
 * Rate limit configuration
 */
export interface RateLimit {
  /** Maximum requests per second */
  requestsPerSecond: number;
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum requests per hour */
  requestsPerHour: number;
  /** Maximum requests per day */
  requestsPerDay: number;
  /** Burst allowance (for traffic spikes) */
  burstAllowance: number;
}

/**
 * Token quota configuration
 */
export interface TokenQuota {
  /** Maximum tokens per day */
  tokensPerDay: number;
  /** Maximum tokens per month */
  tokensPerMonth: number;
  /** Token usage counter */
  usedTokens: number;
  /** Token reset timestamp */
  lastReset: number;
}

/**
 * Storage quota configuration
 */
export interface StorageQuota {
  /** Maximum storage in bytes */
  maxStorageBytes: number;
  /** Maximum knowledge graph entries */
  maxKnowledgeEntries: number;
  /** Maximum cache entries */
  maxCacheEntries: number;
  /** Current storage usage in bytes */
  usedStorageBytes: number;
  /** Current knowledge graph entries */
  usedKnowledgeEntries: number;
  /** Current cache entries */
  usedCacheEntries: number;
}

/**
 * Model inference quota configuration
 */
export interface InferenceQuota {
  /** Maximum inference requests per day */
  requestsPerDay: number;
  /** Maximum inference time per day (seconds) */
  computeTimePerDay: number;
  /** Maximum concurrent inference requests */
  maxConcurrentRequests: number;
  /** Usage counters */
  usedRequests: number;
  usedComputeTime: number;
  /** Last reset timestamp */
  lastReset: number;
}

/**
 * Quota reset interval
 */
export type QuotaResetInterval =
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly";

// ============================================================================
// USAGE METRICS TYPES
// ============================================================================

/**
 * Usage metrics for a tenant
 */
export interface UsageMetrics {
  /** Tenant ID */
  tenantId: TenantId;
  /** Metrics collection timestamp */
  timestamp: number;
  /** Request metrics */
  requests: RequestMetrics;
  /** Token usage metrics */
  tokens: TokenUsageMetrics;
  /** Storage usage metrics */
  storage: StorageUsageMetrics;
  /** Inference metrics */
  inference: InferenceMetrics;
  /** Cost metrics */
  cost: CostMetrics;
}

/**
 * Request metrics
 */
export interface RequestMetrics {
  /** Total requests in period */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average latency (ms) */
  averageLatency: number;
  /** P50 latency (ms) */
  p50Latency: number;
  /** P95 latency (ms) */
  p95Latency: number;
  /** P99 latency (ms) */
  p99Latency: number;
}

/**
 * Token usage metrics
 */
export interface TokenUsageMetrics {
  /** Total tokens used */
  totalTokens: number;
  /** Prompt tokens */
  promptTokens: number;
  /** Completion tokens */
  completionTokens: number;
  /** Tokens by model */
  tokensByModel: Record<string, number>;
}

/**
 * Storage usage metrics
 */
export interface StorageUsageMetrics {
  /** Total storage used (bytes) */
  totalStorageBytes: number;
  /** Knowledge graph entries */
  knowledgeEntries: number;
  /** Cache entries */
  cacheEntries: number;
  /** Embedding storage (bytes) */
  embeddingStorageBytes: number;
}

/**
 * Inference metrics
 */
export interface InferenceMetrics {
  /** Total inference requests */
  totalRequests: number;
  /** Total compute time (seconds) */
  totalComputeTime: number;
  /** Average compute time per request */
  averageComputeTime: number;
  /** Peak concurrent requests */
  peakConcurrentRequests: number;
  /** Requests by model */
  requestsByModel: Record<string, number>;
}

/**
 * Cost metrics
 */
export interface CostMetrics {
  /** Total cost in period */
  totalCost: number;
  /** Compute cost */
  computeCost: number;
  /** Storage cost */
  storageCost: number;
  /** Network cost */
  networkCost: number;
  /** Cost by model */
  costByModel: Record<string, number>;
  /** Currency code */
  currency: string;
}

// ============================================================================
// TENANT RESOLUTION TYPES
// ============================================================================

/**
 * Tenant resolution method
 */
export type TenantResolutionMethod =
  | "api-key"       // Resolve by API key
  | "jwt"           // Resolve by JWT token
  | "domain"        // Resolve by domain name
  | "header"        // Resolve by request header
  | "query-param";  // Resolve by query parameter

/**
 * Tenant resolution result
 */
export interface TenantResolutionResult {
  /** Resolved tenant */
  tenant: Tenant;
  /** Resolution method used */
  method: TenantResolutionMethod;
  /** Resolution confidence */
  confidence: number;
  /** Resolution timestamp */
  timestamp: number;
}

/**
 * API key for tenant authentication
 */
export interface TenantAPIKey {
  /** API key ID */
  keyId: string;
  /** API key hash (not stored in plain text) */
  keyHash: string;
  /** Tenant ID */
  tenantId: TenantId;
  /** API key creation timestamp */
  createdAt: number;
  /** API key expiration timestamp */
  expiresAt?: number;
  /** API key last used timestamp */
  lastUsedAt?: number;
  /** API key status */
  status: "active" | "revoked" | "expired";
  /** API key scopes */
  scopes: string[];
  /** API key name (for user reference) */
  name?: string;
}

/**
 * JWT token for tenant authentication
 */
export interface TenantJWT {
  /** JWT issuer */
  issuer: string;
  /** JWT subject (tenant ID) */
  subject: TenantId;
  /** JWT audience */
  audience: string[];
  /** JWT issued at timestamp */
  issuedAt: number;
  /** JWT expiration timestamp */
  expiresAt: number;
  /** JWT not valid before */
  notBefore?: number;
  /** JWT scopes/permissions */
  scopes: string[];
}

// ============================================================================
// BILLING TYPES
// ============================================================================

/**
 * Billing period
 */
export type BillingPeriod =
  | "monthly"
  | "quarterly"
  | "annual";

/**
 * Invoice status
 */
export type InvoiceStatus =
  | "draft"
  | "pending"
  | "paid"
  | "overdue"
  | "cancelled";

/**
 * Pricing tier
 */
export interface PricingTier {
  /** Tier name */
  name: string;
  /** Tier plan */
  plan: TenantPlan;
  /** Monthly base price */
  monthlyPrice: number;
  /** Included resource quotas */
  includedQuotas: ResourceQuota;
  /** Overage pricing */
  overagePricing: OveragePricing;
  /** Currency code */
  currency: string;
}

/**
 * Overage pricing (when quotas are exceeded)
 */
export interface OveragePricing {
  /** Price per 1K tokens beyond quota */
  pricePer1kTokens: number;
  /** Price per 1MB storage beyond quota */
  pricePer1mbStorage: number;
  /** Price per 1K requests beyond quota */
  pricePer1kRequests: number;
  /** Currency code */
  currency: string;
}

/**
 * Invoice for billing
 */
export interface Invoice {
  /** Invoice ID */
  invoiceId: string;
  /** Tenant ID */
  tenantId: TenantId;
  /** Invoice period start */
  periodStart: number;
  /** Invoice period end */
  periodEnd: number;
  /** Invoice status */
  status: InvoiceStatus;
  /** Invoice subtotal */
  subtotal: number;
  /** Tax amount */
  tax: number;
  /** Total amount */
  total: number;
  /** Currency code */
  currency: string;
  /** Line items */
  lineItems: InvoiceLineItem[];
  /** Invoice creation timestamp */
  createdAt: number;
  /** Invoice due timestamp */
  dueAt: number;
  /** Invoice paid timestamp */
  paidAt?: number;
}

/**
 * Invoice line item
 */
export interface InvoiceLineItem {
  /** Line item ID */
  id: string;
  /** Line item description */
  description: string;
  /** Quantity */
  quantity: number;
  /** Unit price */
  unitPrice: number;
  /** Line item total */
  total: number;
  /** Line item metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CONFIGURATION ISOLATION TYPES
// ============================================================================

/**
 * Per-tenant model preferences
 */
export interface ModelPreferences {
  /** Default model for queries */
  defaultModel?: string;
  /** Preferred models by complexity */
  modelsByComplexity: {
    lowComplexity?: string;
    mediumComplexity?: string;
    highComplexity?: string;
  };
  /** Model allowlist */
  allowedModels: string[];
  /** Model blocklist */
  blockedModels?: string[];
}

/**
 * Per-tenant routing rules
 */
export interface RoutingRules {
  /** Custom complexity threshold */
  complexityThreshold?: number;
  /** Custom confidence threshold */
  confidenceThreshold?: number;
  /** Always route to local */
  preferLocal?: boolean;
  /** Always route to cloud */
  preferCloud?: boolean;
  /** Custom routing rules */
  customRules?: RoutingRule[];
}

/**
 * Custom routing rule
 */
export interface RoutingRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule condition (expression) */
  condition: string;
  /** Rule action (backend to use) */
  action: "local" | "cloud" | "hybrid";
  /** Rule priority */
  priority: number;
  /** Rule enabled */
  enabled: boolean;
}

/**
 * Per-tenant privacy settings
 */
export interface PrivacySettings {
  /** Enable redaction */
  enableRedaction?: boolean;
  /** Differential privacy epsilon */
  epsilon?: number;
  /** Strict mode */
  strictMode?: boolean;
  /** Minimum privacy level */
  minPrivacyLevel?: "public" | "sensitive" | "sovereign";
  /** Privacy firewall enabled */
  enableFirewall?: boolean;
  /** PII detection enabled */
  enablePIIDetection?: boolean;
}

/**
 * Per-tenant hardware preferences
 */
export interface HardwarePreferences {
  /** Prefer GPU acceleration */
  preferGPU?: boolean;
  /** Prefer NPU acceleration */
  preferNPU?: boolean;
  /** NUMA policy */
  numaPolicy?: "strict" | "relaxed" | "disabled";
  /** Thermal throttling policy */
  thermalPolicy?: "performance" | "balanced" | "cool";
  /** Maximum thermal limit (°C) */
  maxTemperature?: number;
}

/**
 * Per-tenant cache configuration
 */
export interface CacheConfiguration {
  /** Enable semantic cache */
  enabled?: boolean;
  /** Maximum cache size (entries) */
  maxSize?: number;
  /** Cache TTL (milliseconds) */
  ttl?: number;
  /** Similarity threshold (0-1) */
  similarityThreshold?: number;
  /** Cache partition (for isolation) */
  partition?: string;
}

// ============================================================================
// NAMESPACE ISOLATION TYPES
// ============================================================================

/**
 * Tenant namespace
 */
export interface TenantNamespace {
  /** Namespace ID */
  id: string;
  /** Tenant ID */
  tenantId: TenantId;
  /** Namespace name */
  name: string;
  /** Namespace type */
  type: "knowledge" | "cache" | "embeddings" | "intent" | "models";
  /** Namespace creation timestamp */
  createdAt: number;
  /** Isolation guarantees */
  isolation: IsolationGuarantee;
}

/**
 * Isolation guarantee level
 */
export type IsolationGuarantee =
  | "strict"        // Complete isolation (separate resources)
  | "logical"       // Logical isolation (shared resources, separated data)
  | "relaxed";      // Relaxed isolation (shared resources with tagging)

/**
 * Namespace access control
 */
export interface NamespaceAccessControl {
  /** Tenant ID */
  tenantId: TenantId;
  /** Namespace ID */
  namespaceId: string;
  /** Access permissions */
  permissions: AccessPermission[];
  /** Access control timestamp */
  updatedAt: number;
}

/**
 * Access permission
 */
export interface AccessPermission {
  /** Permission ID */
  id: string;
  /** Permission type */
  type: "read" | "write" | "delete" | "admin";
  /** Resource pattern */
  resource: string;
  /** Permission granted */
  granted: boolean;
}

// ============================================================================
// RESOURCE POOLING TYPES
// ============================================================================

/**
 * Resource pool type
 */
export type ResourcePoolType =
  | "dedicated"    // Tenant has dedicated resources
  | "shared"       // Tenant shares resources with others
  | "hybrid";      // Mix of dedicated and shared resources

/**
 * Resource pool allocation
 */
export interface ResourcePoolAllocation {
  /** Allocation ID */
  id: string;
  /** Tenant ID */
  tenantId: TenantId;
  /** Pool type */
  poolType: ResourcePoolType;
  /** Allocated resources */
  resources: AllocatedResources;
  /** Priority level (for shared pools) */
  priority: number;
  /** Allocation timestamp */
  allocatedAt: number;
  /** Allocation expires at */
  expiresAt?: number;
}

/**
 * Allocated resources
 */
export interface AllocatedResources {
  /** CPU cores allocated */
  cpuCores?: number;
  /** Memory allocated (bytes) */
  memoryBytes?: number;
  /** GPU allocated (fraction or count) */
  gpu?: number | string;
  /** Storage allocated (bytes) */
  storageBytes?: number;
  /** Network bandwidth (bytes/sec) */
  networkBandwidth?: number;
}

/**
 * Resource pool priority
 */
export type ResourcePoolPriority =
  | "critical"  // Highest priority (enterprise)
  | "high"      // High priority (pro)
  | "normal"    // Normal priority (basic)
  | "low";      // Low priority (free)

// ============================================================================
// TENANT CONTEXT TYPES
// ============================================================================

/**
 * Per-tenant execution context
 */
export interface TenantExecutionContext {
  /** Tenant ID */
  tenantId: TenantId;
  /** Tenant configuration */
  config: TenantConfig;
  /** Tenant namespace mappings */
  namespaces: Map<string, TenantNamespace>;
  /** Resource pool allocation */
  resourceAllocation: ResourcePoolAllocation;
  /** Current usage metrics */
  currentUsage: UsageMetrics;
  /** Access control */
  accessControl: NamespaceAccessControl;
  /** Context creation timestamp */
  createdAt: number;
  /** Context last accessed timestamp */
  lastAccessedAt: number;
}

/**
 * Tenant request context (attached to each request)
 */
export interface TenantRequestContext {
  /** Tenant ID */
  tenantId: TenantId;
  /** Request ID */
  requestId: string;
  /** Request timestamp */
  timestamp: number;
  /** Tenant configuration snapshot */
  config: TenantConfig;
  /** Resource quotas check */
  quotasValid: boolean;
  /** Quota violations (if any) */
  quotaViolations: QuotaViolation[];
}

/**
 * Quota violation
 */
export interface QuotaViolation {
  /** Violation type */
  type: "rate-limit" | "token-quota" | "storage-quota" | "inference-quota";
  /** Violation severity */
  severity: "warning" | "error" | "critical";
  /** Current usage */
  currentUsage: number;
  /** Quota limit */
  limit: number;
  /** Violation timestamp */
  timestamp: number;
}

// ============================================================================
// TENANT REGISTRY TYPES
// ============================================================================

/**
 * Tenant registry entry
 */
export interface TenantRegistryEntry {
  /** Tenant */
  tenant: Tenant;
  /** Tenant configuration */
  config: TenantConfig;
  /** Tenant namespaces */
  namespaces: TenantNamespace[];
  /** Resource allocation */
  resourceAllocation?: ResourcePoolAllocation;
  /** Registry entry timestamp */
  registeredAt: number;
  /** Registry entry last updated */
  updatedAt: number;
}

/**
 * Tenant registry statistics
 */
export interface TenantRegistryStats {
  /** Total tenants */
  totalTenants: number;
  /** Active tenants */
  activeTenants: number;
  /** Suspended tenants */
  suspendedTenants: number;
  /** Pending tenants */
  pendingTenants: number;
  /** Deleted tenants */
  deletedTenants: number;
  /** Tenants by plan */
  tenantsByPlan: Record<TenantPlan, number>;
  /** Statistics timestamp */
  timestamp: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Tenant event types
 */
export type TenantEventType =
  | "tenant.created"
  | "tenant.updated"
  | "tenant.suspended"
  | "tenant.deleted"
  | "tenant.quota-exceeded"
  | "tenant.invoice-generated"
  | "tenant.invoice-paid"
  | "tenant.resource-allocated"
  | "tenant.namespace-created";

/**
 * Tenant event
 */
export interface TenantEvent {
  /** Event type */
  type: TenantEventType;
  /** Tenant ID */
  tenantId: TenantId;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data: Record<string, unknown>;
  /** Event ID */
  eventId: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Tenant validation result
 */
export interface TenantValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: TenantValidationError[];
  /** Validation warnings */
  warnings: TenantValidationWarning[];
  /** Validation timestamp */
  timestamp: number;
}

/**
 * Tenant validation error
 */
export interface TenantValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error field */
  field?: string;
}

/**
 * Tenant validation warning
 */
export interface TenantValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Warning field */
  field?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a tenant ID
 */
export function createTenantId(id: string): TenantId {
  return id as TenantId;
}

/**
 * Check if tenant ID is valid
 */
export function isValidTenantId(id: string): id is TenantId {
  return typeof id === "string" && id.length > 0;
}

/**
 * Get default resource quotas for a plan
 */
export function getDefaultQuotasForPlan(plan: TenantPlan): ResourceQuota {
  const tenantId = createTenantId("default");

  switch (plan) {
    case "free":
      return {
        tenantId,
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
          maxStorageBytes: 100 * 1024 * 1024, // 100 MB
          maxKnowledgeEntries: 1000,
          maxCacheEntries: 100,
          usedStorageBytes: 0,
          usedKnowledgeEntries: 0,
          usedCacheEntries: 0,
        },
        inferenceQuota: {
          requestsPerDay: 100,
          computeTimePerDay: 300, // 5 minutes
          maxConcurrentRequests: 1,
          usedRequests: 0,
          usedComputeTime: 0,
          lastReset: Date.now(),
        },
        resetInterval: "daily",
      };

    case "basic":
      return {
        tenantId,
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
          maxStorageBytes: 1024 * 1024 * 1024, // 1 GB
          maxKnowledgeEntries: 10000,
          maxCacheEntries: 1000,
          usedStorageBytes: 0,
          usedKnowledgeEntries: 0,
          usedCacheEntries: 0,
        },
        inferenceQuota: {
          requestsPerDay: 1000,
          computeTimePerDay: 3600, // 1 hour
          maxConcurrentRequests: 5,
          usedRequests: 0,
          usedComputeTime: 0,
          lastReset: Date.now(),
        },
        resetInterval: "daily",
      };

    case "pro":
      return {
        tenantId,
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
          maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
          maxKnowledgeEntries: 100000,
          maxCacheEntries: 10000,
          usedStorageBytes: 0,
          usedKnowledgeEntries: 0,
          usedCacheEntries: 0,
        },
        inferenceQuota: {
          requestsPerDay: 10000,
          computeTimePerDay: 14400, // 4 hours
          maxConcurrentRequests: 20,
          usedRequests: 0,
          usedComputeTime: 0,
          lastReset: Date.now(),
        },
        resetInterval: "daily",
      };

    case "enterprise":
      return {
        tenantId,
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
          maxStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
          maxKnowledgeEntries: 1000000,
          maxCacheEntries: 100000,
          usedStorageBytes: 0,
          usedKnowledgeEntries: 0,
          usedCacheEntries: 0,
        },
        inferenceQuota: {
          requestsPerDay: 100000,
          computeTimePerDay: 86400, // 24 hours
          maxConcurrentRequests: 100,
          usedRequests: 0,
          usedComputeTime: 0,
          lastReset: Date.now(),
        },
        resetInterval: "daily",
      };

    default:
      return getDefaultQuotasForPlan("free");
  }
}
