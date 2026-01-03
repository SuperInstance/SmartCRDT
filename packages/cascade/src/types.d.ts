/**
 * Core types for @lsi/cascade
 *
 * This file extends common types from @lsi/protocol with cascade-specific fields.
 */
import type { RouterConfig as BaseRouterConfig, SystemState as BaseSystemState } from "@lsi/protocol";
/**
 * System state used for routing decisions
 *
 * Note: This is domain-specific for Cascade (thermal, network, entropy)
 * and differs from the generic SystemState in @lsi/protocol.
 */
export interface SystemState extends BaseSystemState {
    /** Thermal state (0-100, higher is hotter) */
    thermal: number;
    /** Network latency in milliseconds */
    networkLatency: number;
    /** Entropy/chaos level (0-1) */
    entropy: number;
    /** Budget used (0-1 ratio) */
    budgetUsed: number;
    /** Total budget available */
    budgetTotal: number;
    /** Intent match score (0-1) */
    intentMatch: number;
}
/**
 * Context for a specific query
 */
export interface QueryContext {
    /** The query text */
    query: string;
    /** Timestamp of query */
    timestamp: number;
    /** Session ID */
    sessionId: string;
    /** User ID (optional) */
    userId?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}
/**
 * Routing decision output
 */
export interface RouteDecision {
    /** Which route to take */
    route: "local" | "cloud" | "hybrid";
    /** Confidence in this decision (0-1) */
    confidence: number;
    /** Estimated latency in milliseconds */
    estimatedLatency: number;
    /** Estimated cost */
    estimatedCost: number;
    /** Whether to use local preference */
    preferLocal?: boolean;
    /** Whether to skip refinement for speed */
    skipRefinement?: boolean;
    /** Suggest task breakdown to user */
    suggestBreakdown?: boolean;
    /** Suggest sharing/collaboration */
    suggestSharing?: boolean;
    /** Additional notes */
    notes?: string[];
}
/**
 * Route feedback for learning
 */
export interface RouteFeedback {
    /** Which route was taken */
    route: "local" | "cloud" | "hybrid";
    /** Was the route successful? */
    success: boolean;
    /** User satisfaction (0-1) */
    satisfaction?: number;
    /** Actual latency achieved */
    actualLatency?: number;
    /** Actual cost incurred */
    actualCost?: number;
    /** Any error that occurred */
    error?: string;
}
/**
 * Configuration for CascadeRouter
 *
 * Extends the base RouterConfig from @lsi/protocol with cascade-specific options.
 */
export interface RouterConfig extends BaseRouterConfig {
    /** Whether to use sigmoidal scoring */
    useSigmoidal?: boolean;
    /** Sigmoidal weights (if enabled) */
    sigmoidalWeights?: {
        thermal: number;
        network: number;
        entropy: number;
        budget: number;
        intent: number;
    };
    /** Cost-aware routing configuration */
    costAware?: CostAwareConfig;
    /** Enable cost-aware routing */
    enableCostAware?: boolean;
    /** Enable adaptive cache threshold */
    enableAdaptiveCache?: boolean;
    /** Cache similarity threshold (0-1) */
    cacheSimilarityThreshold?: number;
}
/**
 * Session context for tracking user state over time
 */
export interface SessionContext {
    /** Session identifier */
    sessionId: string;
    /** Query history */
    getRecentQueries(count: number): string[];
    /** Get recent topics */
    getRecentTopics(count: number): string[];
    /** Check if topic seen before */
    hasSeenTopicBefore(query: string): boolean;
    /** Get topic consistency */
    getTopicConsistency(count: number): number;
    /** Get average pause between queries */
    getAveragePauseMs(count: number): number;
    /** Check if query is repeating */
    isRepeatingQuery(query: string): boolean;
}
/**
 * Query type classification
 */
export type QueryType = "question" | "command" | "code" | "explanation" | "comparison" | "debug" | "general";
/**
 * Static analysis features (zero LLM cost)
 */
export interface StaticFeatures {
    /** Original query length */
    length: number;
    /** Word count */
    wordCount: number;
    /** Detected query type */
    queryType: QueryType;
    /** Complexity score (0-1) */
    complexity: number;
    /** Contains code snippet */
    hasCode: boolean;
    /** Contains SQL */
    hasSQL: boolean;
    /** Contains URL */
    hasUrl: boolean;
    /** Contains email */
    hasEmail: boolean;
    /** Has question mark */
    questionMark: boolean;
    /** Exclamation count */
    exclamationCount: number;
    /** Ellipsis count */
    ellipsisCount: number;
    /** Capitalization ratio (0-1) */
    capitalizationRatio: number;
    /** Punctuation density (punct per word) */
    punctuationDensity: number;
    /** Technical terms found */
    technicalTerms: string[];
    /** Domain keywords detected */
    domainKeywords: string[];
}
/**
 * Semantic analysis features (embedding-based)
 */
export interface SemanticFeatures {
    /** Query embedding vector */
    embedding: number[];
    /** Embedding dimension */
    embeddingDim: number;
    /** Similar queries from cache */
    similarQueries: Array<{
        query: string;
        similarity: number;
    }>;
    /** Query cluster (topic group) */
    cluster: string | null;
    /** Semantic complexity (0-1) */
    semanticComplexity: number;
}
/**
 * Refinement suggestion
 */
export interface RefinementSuggestion {
    /** Suggestion type */
    type: "breakdown" | "format" | "related" | "clarify" | "optimize";
    /** Priority level */
    priority: "low" | "medium" | "high";
    /** Human-readable message */
    message: string;
    /** Suggested action */
    action: string;
    /** Optional data (e.g., related queries) */
    data?: unknown;
}
/**
 * Refined query with features
 */
export interface RefinedQuery {
    /** Original query */
    original: string;
    /** Normalized query */
    normalized: string;
    /** Static analysis results */
    staticFeatures: StaticFeatures;
    /** Semantic analysis results (null if disabled) */
    semanticFeatures: SemanticFeatures | null;
    /** Cache key for this query */
    cacheKey: string;
    /** Refinement suggestions */
    suggestions: RefinementSuggestion[];
    /** Timestamp of refinement */
    timestamp: number;
}
/**
 * Semantic cache entry
 */
export interface SemanticCacheEntry {
    /** Query text */
    query: string;
    /** Embedding vector */
    embedding: number[];
    /** Response/result */
    result: unknown;
    /** Hit count */
    hitCount: number;
    /** Last accessed */
    lastAccessed: number;
    /** Created at */
    createdAt: number;
}
/**
 * Cache status for routing decisions
 */
export interface CacheStatus {
    /** Whether cache hit occurred */
    hit: boolean;
    /** Which cache level (l1/l2/l3) or null if miss */
    level: "l1" | "l2" | "l3" | null;
    /** Similarity score (0-1) for semantic hits */
    similarity: number;
    /** Match type (exact or semantic) or null if miss */
    matchType: "exact" | "semantic" | null;
}
/**
 * Cost-aware routing mode
 */
export type CostMode = "economy" | "balanced" | "performance";
/**
 * Cost-aware routing configuration
 */
export interface CostAwareConfig {
    /** Routing mode */
    mode: CostMode;
    /** Maximum cost per request (USD) */
    maxCostPerRequest?: number;
    /** Total budget limit (USD) */
    budgetLimit?: number;
    /** Prefer local models when possible */
    preferLocal?: boolean;
    /** Budget warning threshold (0-1) */
    warningThreshold?: number;
    /** Budget critical threshold (0-1) */
    criticalThreshold?: number;
    /** Block requests when budget exceeded */
    blockOnExceed?: boolean;
    /** Custom model weights for scoring */
    modelWeights?: Record<string, number>;
}
/**
 * Cost-aware routing result
 * Re-export from @lsi/protocol
 */
export interface CostAwareRoutingResult {
    notes?: string[];
    backend: "local" | "cloud";
    model: string;
    estimatedCost: number;
    reason: string;
    confidence: number;
    estimatedLatency: number;
    withinBudget: boolean;
}
/**
 * Model recommendation for routing
 */
export interface ModelRecommendation {
    /** Model name */
    model: string;
    /** Provider */
    provider: "local" | "openai" | "anthropic" | "google";
    /** Quality tier (1-5) */
    qualityTier: number;
    /** Estimated cost */
    estimatedCost: number;
    /** Estimated latency (ms) */
    estimatedLatency: number;
    /** Overall score (0-1) */
    score: number;
    /** Reasoning */
    reasoning: string;
}
//# sourceMappingURL=types.d.ts.map