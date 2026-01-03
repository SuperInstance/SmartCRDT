/**
 * @lsi/cascade - Cascade Router with Emotional Intelligence
 *
 * Complexity-based AI request routing enhanced with:
 * - Cadence Detection (temporal awareness)
 * - Motivation Encoding (emotional intelligence)
 * - Soulful Routing (empathetic decision-making)
 */

// Core router exports
export {
  CascadeRouter,
  DEFAULT_ROUTER_CONFIG,
} from "./router/CascadeRouter";
export { ComplexityScorer } from "./router/ComplexityScorer";
export { IntentRouter, DEFAULT_INTENT_ROUTER_CONFIG } from "./router/IntentRouter";
export type { IntentRouterConfig, IntentRoutingResult } from "./router/IntentRouter";

// Cadence detection exports
export {
  ProsodyDetector,
  ProsodyFeatures,
  TrendAnalysis,
} from "./cadence/ProsodyDetector";

// Psychology/Motivation exports
export {
  MotivationEncoder,
  UserMotivation,
  MotivationDetector,
} from "./psychology/MotivationEncoder";

// Refiner exports
export {
  QueryRefiner,
  SemanticCache,
  DEFAULT_REFINER_CONFIG,
  DEFAULT_SEMANTIC_CACHE_CONFIG,
} from "./refiner/index";

// Configuration exports
export {
  createConfiguration,
  getConfiguration,
  initializeConfiguration,
  resetConfiguration,
  loadFromEnv,
  validateConfig,
  isCloudAvailable,
  getConfigurationSummary,
  ConfigurationError,
} from "./config/index";

export type {
  Configuration,
  ConfigurationOptions,
  EmbeddingModel,
  InferenceModel,
  OllamaModel,
  LogLevel,
} from "./config/index";

// Adapter exports
export {
  OllamaAdapter,
  OllamaAdapterError,
  createOllamaAdapter,
} from "./adapters/index";

// Service exports
export {
  CapabilityDiscoveryService,
  createCapabilityDiscoveryService,
  OllamaModelFingerprinter,
  createOllamaModelFingerprinter,
  defaultFingerprinter,
} from "./services/index";

// Health check exports
export {
  OllamaHealthChecker,
  createOllamaHealthChecker,
} from "./health/OllamaHealthChecker";

// Rate limiting exports
export {
  createRateLimiter,
  TokenBucketRateLimiter,
  SlidingWindowRateLimiter,
  RateLimitError,
  DEFAULT_RATE_LIMIT_CONFIG,
  createTokenBucketLimiter,
  createSlidingWindowLimiter,
} from "./ratelimit/index";

export type {
  RateLimiter,
  RateLimiterConfig,
  RateLimitStats,
  TokenBucketConfig,
  SlidingWindowConfig,
} from "./ratelimit/index";

// Types
export type {
  SystemState,
  QueryContext,
  RouteDecision,
  RouterConfig,
  RouteFeedback,
  SessionContext,
  QueryType,
  StaticFeatures,
  SemanticFeatures,
  RefinementSuggestion,
  RefinedQuery,
  SemanticCacheEntry,
} from "./types";

// Tiering exports
export {
  TierManager,
  RequestRateMonitor,
  QuickFlowRouter,
  EnterpriseRouter,
  RequestQueue,
  DEFAULT_TIER_LIMITS,
  DEFAULT_TIER_CONFIG,
  routeByTier,
} from "./tiering/index";

export { DEFAULT_ENTERPRISE_CONFIG } from "./tiering/EnterpriseRouter";

export type {
  Tier,
  TierConfig,
  TierLimits,
  TierFeature,
  TierStats,
  PriorityLevel,
  PriorityRequest,
  QueueStats,
  RequestRateMetrics,
  TierRouter,
  RoutingDecision,
} from "./tiering/types";

// Shadow logging exports
export {
  ShadowLogger,
  PrivacyFilter,
  createShadowLogger,
  DataSensitivity,
  PIIType,
  PreferencePairGenerator,
  PreferencePair,
  ScoringConfig,
} from "./shadow/export";

export type {
  ShadowLogEntry,
  ShadowLoggerStats,
  ShadowLoggerConfig,
  PrivacyFilterResult,
  PrivacyFilterConfig,
  PIIDetection,
} from "./shadow/index";

// ============================================================================
// ADAPTER TYPES (For Type Compatibility Tests)
// ============================================================================

/**
 * ModelAdapter - Interface for AI model adapters
 *
 * Provides a standard interface for connecting different AI models
 * to the cascade routing system.
 */
export interface ModelAdapter {
  /** Unique adapter identifier */
  id: string;
  /** Model name */
  model: string;
  /** Backend type */
  backend: "local" | "cloud";
  /** Execute a query */
  query(query: string, options?: Record<string, unknown>): Promise<ModelAdapterResponse>;
  /** Check if adapter is available */
  isAvailable(): Promise<boolean>;
  /** Get adapter capabilities */
  getCapabilities(): AdapterCapabilities;
}

/**
 * ModelAdapterResponse - Response from model adapter
 */
export interface ModelAdapterResponse {
  /** Generated content */
  content: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Processing latency in milliseconds */
  latency: number;
  /** Token usage */
  tokensUsed?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AdapterCapabilities - Capabilities of a model adapter
 *
 * Describes what a model adapter can do and its constraints.
 */
export interface AdapterCapabilities {
  /** Maximum input tokens */
  maxInputTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Supported intent categories */
  supportedIntents: string[];
  /** Whether adapter supports streaming */
  supportsStreaming: boolean;
  /** Estimated cost per 1K tokens (USD) */
  costPer1KTokens: number;
  /** Average latency in milliseconds */
  averageLatency: number;
  /** Quality score (0-1) */
  quality: number;
}
