/**
 * CascadeRouter - Soulful AI routing with emotional intelligence
 *
 * Routes AI requests based on:
 * 1. Query complexity (simple → local, complex → cloud)
 * 2. System state (thermal, network, budget)
 * 3. Cadence (temporal patterns - user's rhythm)
 * 4. Motivation (emotional state - user's mood)
 *
 * This is "Soulful Routing" - the system adapts to the user's cognitive
 * and emotional state, not just efficiency metrics.
 *
 * Example:
 * ```ts
 * const router = new CascadeRouter(config);
 * const decision = await router.route(query, context);
 * if (decision.suggestBreakdown) {
 *   // User is procrastinating - suggest breaking down task
 * }
 * ```
 */
import type { RouteDecision, RouterConfig, QueryContext, RouteFeedback, RefinedQuery, CostAwareRoutingResult, CacheStatus } from "../types.js";
import { SimpleSessionContext } from "../psychology/MotivationEncoder.js";
import { CostAwareRouter } from "./CostAwareRouter.js";
import { SemanticCache } from "../refiner/SemanticCache.js";
import { type ShadowLogEntry } from "../shadow/index.js";
/**
 * CascadeRouter - Main router with emotional intelligence
 */
export declare class CascadeRouter {
    private complexityScorer;
    private cadenceDetector;
    private motivationEncoder;
    private sessionContext;
    private refiner;
    private config;
    private enableRefiner;
    private costAwareRouter;
    private enableCostAware;
    private semanticCache;
    private enableCache;
    private shadowLogger;
    constructor(config?: RouterConfig, enableRefiner?: boolean);
    /**
     * Route a query to the optimal resource
     * @param query - The user's query
     * @param context - Additional context (timestamp, sessionId, etc.)
     * @returns RouteDecision with routing and UX recommendations
     */
    route(query: string, context?: QueryContext): Promise<RouteDecision>;
    /**
     * Route a query with semantic caching
     * @param query - The user's query
     * @param context - Additional context (timestamp, sessionId, etc.)
     * @returns RouteDecision with routing and UX recommendations
     */
    routeWithCache(query: string, context?: QueryContext): Promise<RouteDecision>;
    /**
     * Apply refiner insights to routing decision
     */
    private applyRefinerInsights;
    /**
     * Calculate base routing decision from complexity
     */
    private calculateBaseRoute;
    /**
     * Apply soulful adjustments based on user's state
     */
    private applySoulfulAdjustments;
    /**
     * Learn from routing feedback (adaptive weights)
     */
    learnFromFeedback(feedback: RouteFeedback): void;
    /**
     * Get current session context
     */
    getSessionContext(): SimpleSessionContext;
    /**
     * Reset session (e.g., new user)
     */
    resetSession(): void;
    /**
     * Route with cost-aware decision making
     * @param query - The user's query
     * @param context - Additional context
     * @returns Cost-aware routing result
     */
    routeWithCost(query: string, context?: QueryContext): Promise<CostAwareRoutingResult | RouteDecision>;
    /**
     * Get the cost-aware router instance
     */
    getCostAwareRouter(): CostAwareRouter | null;
    /**
     * Enable or disable cost-aware routing
     */
    setCostAwareEnabled(enabled: boolean, config?: RouterConfig["costAware"]): void;
    /**
     * Get current budget summary (if cost-aware routing is enabled)
     */
    getBudgetSummary(): {
        budgetLimit: number;
        currentSpending: number;
        remaining: number;
        percentageUsed: number;
        requestCount: number;
        averageCost: number;
        spendingRate: number;
        sessionDuration: number;
    } | null;
    /**
     * Store query result in cache
     * @param refinedQuery - The refined query to use as cache key
     * @param result - The result to cache (typically RouteDecision)
     */
    cacheResult(refinedQuery: RefinedQuery, result: unknown): Promise<void>;
    /**
     * Get cache statistics
     * @returns Enhanced cache statistics
     */
    getCacheStats(): import("../refiner/SemanticCache.js").EnhancedCacheStats | {
        size: number;
        hitRate: number;
        totalHits: number;
        totalMisses: number;
        exactHits: number;
        semanticHits: number;
        similarityDistribution: {
            high: number;
            medium: number;
            low: number;
        };
        byQueryType: {};
        currentThreshold: number;
        thresholdAdjustments: number;
        topEntries: never[];
    };
    /**
     * Clear the cache
     */
    clearCache(): void;
    /**
     * Enable or disable caching
     * @param enabled - Whether to enable caching
     */
    setCacheEnabled(enabled: boolean): void;
    /**
     * Get the semantic cache instance
     */
    getSemanticCache(): SemanticCache;
    /**
     * Route with intelligent caching
     *
     * This method integrates semantic caching with the routing flow:
     * 1. Check semantic cache first (fast path)
     * 2. Route on cache miss
     * 3. Store result in cache asynchronously
     * 4. Track comprehensive cache statistics
     *
     * @param query - The user's query
     * @param context - Additional context
     * @returns RouteDecision with cache status
     */
    routeWithIntelligentCache(query: string, context?: QueryContext): Promise<RouteDecision & {
        cacheStatus: CacheStatus;
    }>;
    /**
     * Create decision from cached result with metadata
     */
    private createCachedDecision;
    /**
     * Cache result asynchronously (non-blocking)
     */
    private cacheResultAsync;
    /**
     * Warm cache with common queries
     *
     * Pre-populates the cache with expected common queries to improve
     * initial cache hit rate. Useful for cold-start optimization.
     *
     * @param commonQueries - Array of common queries to warm
     * @returns Statistics about warming process
     */
    warmCache(commonQueries: string[]): Promise<{
        successful: number;
        failed: number;
        duration: number;
    }>;
    /**
     * Get comprehensive cache statistics
     *
     * Returns enhanced cache statistics including:
     * - Basic hit/miss rates
     * - Per-query-type breakdown
     * - Similarity distributions
     * - Top cache entries
     *
     * @returns Comprehensive cache statistics
     */
    getCacheStatistics(): {
        size: number;
        hitRate: number;
        totalHits: number;
        totalMisses: number;
        exactHits: number;
        semanticHits: number;
        similarityDistribution: {
            high: number;
            medium: number;
            low: number;
        };
        byQueryType: {};
        currentThreshold: number;
        thresholdAdjustments: number;
        topEntries: never[];
    } | {
        missRate: number;
        averageSimilarity: number;
        size: number;
        hitRate: number;
        totalHits: number;
        totalMisses: number;
        exactHits: number;
        semanticHits: number;
        similarityDistribution: {
            high: number;
            medium: number;
            low: number;
        };
        byQueryType: Record<import("../types.js").QueryType, {
            hits: number;
            misses: number;
            hitRate: number;
            avgSimilarity: number;
        }>;
        currentThreshold: number;
        thresholdAdjustments: number;
        topEntries: Array<{
            query: string;
            hitCount: number;
        }>;
    };
    /**
     * Calculate average similarity score from cache statistics
     */
    private calculateAverageSimilarity;
    /**
     * Get per-query-type cache statistics
     */
    getPerQueryTypeStats(): Record<string, {
        hits: number;
        misses: number;
        hitRate: number;
        avgSimilarity: number;
    }>;
    /**
     * Route with shadow logging enabled
     *
     * This method routes the query AND logs the query/response pair
     * for ORPO training data collection with privacy filtering.
     *
     * @param query - The user's query
     * @param response - The response generated
     * @param context - Additional context
     * @returns RouteDecision with routing and UX recommendations
     */
    routeWithLogging(query: string, response: string, context?: QueryContext): Promise<RouteDecision>;
    /**
     * Get shadow logs for ORPO training
     *
     * @returns All shadow log entries
     */
    getShadowLogs(): ShadowLogEntry[];
    /**
     * Export logs for ORPO training
     *
     * @returns Log entries suitable for training (SOVEREIGN data excluded)
     */
    exportForTraining(): ShadowLogEntry[];
    /**
     * Get shadow logger statistics
     *
     * @returns Current shadow logger stats
     */
    getShadowStats(): import("../index.js").ShadowLoggerStats;
    /**
     * Enable or disable shadow logging
     *
     * @param enabled - Whether to enable shadow logging
     */
    setShadowLoggingEnabled(enabled: boolean): void;
    /**
     * Check if shadow logging is enabled
     *
     * @returns True if shadow logging is enabled
     */
    isShadowLoggingEnabled(): boolean;
}
/**
 * Default configuration
 */
export declare const DEFAULT_ROUTER_CONFIG: RouterConfig;
//# sourceMappingURL=CascadeRouter.d.ts.map