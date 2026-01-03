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
import { ComplexityScorer } from "./ComplexityScorer.js";
import { ProsodyDetector } from "../cadence/ProsodyDetector.js";
import { MotivationEncoder, SimpleSessionContext, } from "../psychology/MotivationEncoder.js";
import { QueryRefiner } from "../refiner/QueryRefiner.js";
import { CostAwareRouter } from "./CostAwareRouter.js";
import { SemanticCache, } from "../refiner/SemanticCache.js";
import { createShadowLogger, } from "../shadow/index.js";
/**
 * CascadeRouter - Main router with emotional intelligence
 */
export class CascadeRouter {
    complexityScorer;
    cadenceDetector;
    motivationEncoder;
    sessionContext;
    refiner;
    config;
    enableRefiner;
    costAwareRouter;
    enableCostAware;
    semanticCache;
    enableCache;
    shadowLogger;
    constructor(config = {}, enableRefiner = true) {
        this.complexityScorer = new ComplexityScorer();
        this.cadenceDetector = new ProsodyDetector();
        this.motivationEncoder = new MotivationEncoder();
        this.sessionContext = new SimpleSessionContext();
        this.refiner = new QueryRefiner();
        this.enableRefiner = enableRefiner;
        this.enableCostAware = config.enableCostAware ?? false;
        this.enableCache = config.enableCache ?? true;
        this.config = {
            complexityThreshold: config.complexityThreshold ?? 0.6,
            confidenceThreshold: config.confidenceThreshold ?? 0.6,
            maxLatency: config.maxLatency ?? 1000,
            useSigmoidal: config.useSigmoidal ?? false,
            sigmoidalWeights: config.sigmoidalWeights,
            costAware: config.costAware,
            enableCostAware: this.enableCostAware,
            enableCache: this.enableCache,
            cacheConfig: {
                maxSize: config.cacheConfig?.maxSize ?? 1000,
                ttl: config.cacheConfig?.ttl ?? 300000,
            },
            cacheSimilarityThreshold: config.cacheSimilarityThreshold ?? 0.85,
            enableAdaptiveCache: config.enableAdaptiveCache ?? true,
        };
        // Initialize cost-aware router if enabled
        this.costAwareRouter =
            this.enableCostAware && this.config.costAware
                ? new CostAwareRouter(this.config.costAware)
                : null;
        // Initialize semantic cache
        this.semanticCache = new SemanticCache({
            maxSize: this.config.cacheConfig?.maxSize ?? 1000,
            ttl: this.config.cacheConfig?.ttl ?? 300000,
            similarityThreshold: this.config.cacheSimilarityThreshold ?? 0.85,
            enableAdaptiveThreshold: this.config.enableAdaptiveCache ?? true,
        });
        // Initialize shadow logger
        this.shadowLogger = createShadowLogger({
            enableLogging: false, // Disabled by default, can be enabled via config
            storagePath: "./shadow-logs",
            privacyFilter: {
                enablePIIDetection: true,
                enableSemanticAnalysis: true,
                redactionToken: "[REDACTED]",
            },
            maxEntries: 10000,
            persistToDisk: false,
        });
    }
    /**
     * Route a query to the optimal resource
     * @param query - The user's query
     * @param context - Additional context (timestamp, sessionId, etc.)
     * @returns RouteDecision with routing and UX recommendations
     */
    async route(query, context) {
        const timestamp = context?.timestamp || Date.now();
        // Stage 0: Refine query (static + semantic analysis)
        let refinedQuery = null;
        if (this.enableRefiner) {
            refinedQuery = await this.refiner.refine(query);
            // Use refinement suggestions to enhance routing
            if (refinedQuery.suggestions.length > 0) {
                // Attach suggestions to decision notes
            }
        }
        // Update session context
        this.sessionContext.addQuery(query, timestamp);
        // Detect cadence
        const prosody = this.cadenceDetector.detect(query, timestamp);
        const trend = this.cadenceDetector.getTrend();
        // Detect motivation
        const motivation = this.motivationEncoder.encode(query, this.sessionContext);
        // Score complexity (use refined complexity if available)
        const complexity = this.complexityScorer.score(query, context);
        // Calculate base routing decision
        let decision = this.calculateBaseRoute(complexity, query, context);
        // Apply soulful adjustments based on cadence and motivation
        decision = this.applySoulfulAdjustments(decision, prosody, trend, motivation);
        // Apply refiner suggestions if available
        if (refinedQuery) {
            decision = this.applyRefinerInsights(decision, refinedQuery);
        }
        return decision;
    }
    /**
     * Route a query with semantic caching
     * @param query - The user's query
     * @param context - Additional context (timestamp, sessionId, etc.)
     * @returns RouteDecision with routing and UX recommendations
     */
    async routeWithCache(query, context) {
        // If cache is disabled, use regular routing
        if (!this.enableCache) {
            return this.route(query, context);
        }
        const timestamp = context?.timestamp || Date.now();
        // Stage 0: Refine query (static + semantic analysis)
        let refinedQuery = null;
        if (this.enableRefiner) {
            refinedQuery = await this.refiner.refine(query);
        }
        // Check cache first if we have a refined query
        if (refinedQuery) {
            const cached = await this.semanticCache.get(refinedQuery);
            if (cached.found) {
                // Cache hit - return cached route decision
                const cachedDecision = cached.result;
                // Update notes to indicate cache hit
                const matchType = cached.similarity === 1.0 ? "exact" : "semantic";
                cachedDecision.notes = [
                    ...(cachedDecision.notes || []),
                    `Cache hit (${matchType}, similarity: ${cached.similarity.toFixed(3)})`,
                ];
                return cachedDecision;
            }
        }
        // Cache miss - route normally
        const decision = await this.route(query, context);
        // Store in cache for future
        if (refinedQuery) {
            await this.cacheResult(refinedQuery, decision);
        }
        return decision;
    }
    /**
     * Apply refiner insights to routing decision
     */
    applyRefinerInsights(decision, refined) {
        const adjusted = { ...decision };
        // Include refiner complexity if it's higher than scorer's
        if (refined.staticFeatures.complexity > 0.7) {
            adjusted.notes?.push(`Refiner: High complexity detected (${refined.staticFeatures.complexity.toFixed(2)})`);
        }
        // Add query type to notes for transparency
        adjusted.notes?.push(`Query type: ${refined.staticFeatures.queryType}`);
        // Add domain keywords if detected
        if (refined.staticFeatures.domainKeywords.length > 0) {
            adjusted.notes?.push(`Domains: ${refined.staticFeatures.domainKeywords.join(", ")}`);
        }
        // Attach suggestions to decision
        if (refined.suggestions.length > 0) {
            const suggestionNotes = refined.suggestions.map(s => `[${s.type}] ${s.message}`);
            adjusted.notes = [...(adjusted.notes || []), ...suggestionNotes];
        }
        // Check if semantic features suggest similar queries
        if (refined.semanticFeatures?.similarQueries &&
            refined.semanticFeatures.similarQueries.length > 0) {
            adjusted.notes?.push(`${refined.semanticFeatures.similarQueries.length} similar queries found in cache`);
        }
        return adjusted;
    }
    /**
     * Calculate base routing decision from complexity
     */
    calculateBaseRoute(complexity, query, context) {
        const threshold = this.config.complexityThreshold ?? 0.6;
        if (complexity.overall < threshold) {
            // Simple query → local
            return {
                route: "local",
                confidence: 1 - complexity.overall,
                estimatedLatency: 50,
                estimatedCost: 0,
                notes: ["Simple query - using local model"],
            };
        }
        else {
            // Complex query → cloud
            return {
                route: "cloud",
                confidence: complexity.overall,
                estimatedLatency: 200,
                estimatedCost: 0.01,
                notes: ["Complex query - using cloud model"],
            };
        }
    }
    /**
     * Apply soulful adjustments based on user's state
     */
    applySoulfulAdjustments(decision, prosody, trend, motivation) {
        const adjusted = { ...decision };
        // High anxiety → prefer faster, more certain routes
        if (motivation.anxiety > 0.7) {
            adjusted.preferLocal = true;
            // Note: Lower confidence threshold handled in routing logic
            adjusted.notes?.push("User anxious - prioritizing speed");
        }
        // High curiosity → explore, allow cloud for broader knowledge
        if (motivation.curiosity > 0.7) {
            // Note: Complexity threshold adjustment handled in routing logic
            adjusted.notes?.push("User curious - allowing broader exploration");
        }
        // High flow → don't interrupt, use fastest route
        if (motivation.flow > 0.7) {
            adjusted.preferLocal = true;
            adjusted.skipRefinement = true;
            adjusted.notes?.push("User in flow - minimizing interruption");
        }
        // High procrastination → suggest breaking down task
        if (motivation.procrastination > 0.6) {
            adjusted.suggestBreakdown = true;
            adjusted.notes?.push("User may be stuck - suggesting task breakdown");
        }
        // High social → suggest sharing/collaboration
        if (motivation.social > 0.6) {
            adjusted.suggestSharing = true;
            adjusted.notes?.push("User seeking collaboration");
        }
        // Urgent (speeding up) → prefer local for speed
        if (trend.wpmTrend === "increasing" && prosody.wpmAcceleration > 20) {
            adjusted.preferLocal = true;
            adjusted.notes?.push("User speeding up - prioritizing responsiveness");
        }
        // Deep thought (long pauses) → prefer quality
        if (trend.avgSilence > 30000) {
            // Note: Complexity threshold adjustment handled in routing logic
            adjusted.notes?.push("User in deep thought - prioritizing quality");
        }
        return adjusted;
    }
    /**
     * Learn from routing feedback (adaptive weights)
     */
    learnFromFeedback(feedback) {
        // TODO: Implement adaptive weight adjustment
        // For now, this is a placeholder for future learning
        console.debug("[CascadeRouter] Received feedback:", feedback);
    }
    /**
     * Get current session context
     */
    getSessionContext() {
        return this.sessionContext;
    }
    /**
     * Reset session (e.g., new user)
     */
    resetSession() {
        this.sessionContext = new SimpleSessionContext();
        this.cadenceDetector.clear();
    }
    /**
     * Route with cost-aware decision making
     * @param query - The user's query
     * @param context - Additional context
     * @returns Cost-aware routing result
     */
    async routeWithCost(query, context) {
        if (!this.costAwareRouter) {
            // Fall back to regular routing if cost-aware not enabled
            return this.route(query, context);
        }
        const complexity = this.complexityScorer.score(query, context);
        const costResult = await this.costAwareRouter.route(query, complexity.overall, context);
        // Add cost-aware notes to result
        costResult.notes = costResult.notes || [];
        if (!costResult.withinBudget) {
            costResult.notes.push("⚠️  Budget exceeded - request may be blocked");
        }
        if (costResult.backend === "local") {
            costResult.notes.push("🟢 Using local model (free)");
        }
        else {
            costResult.notes.push(`🔵 Using cloud model ($${costResult.estimatedCost.toFixed(4)} estimated)`);
        }
        return costResult;
    }
    /**
     * Get the cost-aware router instance
     */
    getCostAwareRouter() {
        return this.costAwareRouter;
    }
    /**
     * Enable or disable cost-aware routing
     */
    setCostAwareEnabled(enabled, config) {
        this.enableCostAware = enabled;
        if (enabled && config) {
            this.config.costAware = config;
            this.costAwareRouter = new CostAwareRouter(config);
        }
        else if (!enabled) {
            this.costAwareRouter = null;
        }
    }
    /**
     * Get current budget summary (if cost-aware routing is enabled)
     */
    getBudgetSummary() {
        return this.costAwareRouter?.getBudgetSummary() ?? null;
    }
    /**
     * Store query result in cache
     * @param refinedQuery - The refined query to use as cache key
     * @param result - The result to cache (typically RouteDecision)
     */
    async cacheResult(refinedQuery, result) {
        if (!this.enableCache)
            return;
        await this.semanticCache.set(refinedQuery, result);
    }
    /**
     * Get cache statistics
     * @returns Enhanced cache statistics
     */
    getCacheStats() {
        if (!this.enableCache) {
            return {
                size: 0,
                hitRate: 0,
                totalHits: 0,
                totalMisses: 0,
                exactHits: 0,
                semanticHits: 0,
                similarityDistribution: { high: 0, medium: 0, low: 0 },
                byQueryType: {},
                currentThreshold: 0,
                thresholdAdjustments: 0,
                topEntries: [],
            };
        }
        return this.semanticCache.getStats();
    }
    /**
     * Clear the cache
     */
    clearCache() {
        if (!this.enableCache)
            return;
        this.semanticCache.clear();
    }
    /**
     * Enable or disable caching
     * @param enabled - Whether to enable caching
     */
    setCacheEnabled(enabled) {
        this.enableCache = enabled;
        this.config.enableCache = enabled;
    }
    /**
     * Get the semantic cache instance
     */
    getSemanticCache() {
        return this.semanticCache;
    }
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
    async routeWithIntelligentCache(query, context) {
        // If cache is disabled, use regular routing
        if (!this.enableCache) {
            const decision = await this.route(query, context);
            return {
                ...decision,
                cacheStatus: {
                    hit: false,
                    level: null,
                    similarity: 0,
                    matchType: null,
                },
            };
        }
        const timestamp = context?.timestamp || Date.now();
        // Stage 0: Refine query (static + semantic analysis)
        let refinedQuery = null;
        if (this.enableRefiner) {
            refinedQuery = await this.refiner.refine(query);
        }
        // Check cache if we have a refined query
        if (refinedQuery) {
            const cacheResult = await this.semanticCache.get(refinedQuery);
            if (cacheResult.found) {
                // Cache hit - return cached decision with enhanced metadata
                return {
                    ...this.createCachedDecision(cacheResult),
                    cacheStatus: {
                        hit: true,
                        level: "l1",
                        similarity: cacheResult.similarity,
                        matchType: cacheResult.similarity === 1.0 ? "exact" : "semantic",
                    },
                };
            }
        }
        // Cache miss - route normally
        const decision = await this.route(query, context);
        // Store in cache asynchronously (don't block response)
        if (refinedQuery) {
            this.cacheResultAsync(refinedQuery, decision).catch(err => {
                console.warn("[CascadeRouter] Failed to cache result:", err);
            });
        }
        return {
            ...decision,
            cacheStatus: {
                hit: false,
                level: null,
                similarity: 0,
                matchType: null,
            },
        };
    }
    /**
     * Create decision from cached result with metadata
     */
    createCachedDecision(cacheResult) {
        const baseDecision = cacheResult.entry.result;
        return {
            ...baseDecision,
            notes: [
                ...(baseDecision.notes || []),
                `Cache hit (${cacheResult.similarity === 1.0 ? "exact" : "semantic"}, similarity: ${cacheResult.similarity.toFixed(3)})`,
            ],
            // Add cache metadata for tracking
            estimatedLatency: Math.min(baseDecision.estimatedLatency, 10), // Cached responses are fast
        };
    }
    /**
     * Cache result asynchronously (non-blocking)
     */
    async cacheResultAsync(refinedQuery, decision) {
        await this.semanticCache.set(refinedQuery, decision);
    }
    /**
     * Warm cache with common queries
     *
     * Pre-populates the cache with expected common queries to improve
     * initial cache hit rate. Useful for cold-start optimization.
     *
     * @param commonQueries - Array of common queries to warm
     * @returns Statistics about warming process
     */
    async warmCache(commonQueries) {
        const startTime = Date.now();
        let successful = 0;
        let failed = 0;
        for (const query of commonQueries) {
            try {
                const decision = await this.route(query);
                const refinedQuery = await this.refiner.refine(query);
                await this.semanticCache.set(refinedQuery, decision);
                successful++;
            }
            catch (error) {
                console.warn(`[CascadeRouter] Failed to warm cache for query: ${query}`, error);
                failed++;
            }
        }
        const duration = Date.now() - startTime;
        console.log(`[CascadeRouter] Cache warming complete: ${successful} successful, ${failed} failed, ${duration}ms`);
        return { successful, failed, duration };
    }
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
    getCacheStatistics() {
        if (!this.enableCache) {
            return {
                size: 0,
                hitRate: 0,
                totalHits: 0,
                totalMisses: 0,
                exactHits: 0,
                semanticHits: 0,
                similarityDistribution: { high: 0, medium: 0, low: 0 },
                byQueryType: {},
                currentThreshold: 0,
                thresholdAdjustments: 0,
                topEntries: [],
            };
        }
        const stats = this.semanticCache.getStats();
        return {
            ...stats,
            // Additional computed metrics
            missRate: stats.totalMisses / (stats.totalHits + stats.totalMisses),
            averageSimilarity: this.calculateAverageSimilarity(stats),
        };
    }
    /**
     * Calculate average similarity score from cache statistics
     */
    calculateAverageSimilarity(stats) {
        if (stats.totalHits === 0)
            return 0;
        // Weight exact hits as 1.0 similarity
        const exactScore = stats.exactHits * 1.0;
        let semanticScore = 0;
        for (const type of Object.keys(stats.byQueryType)) {
            const typeStats = stats.byQueryType[type];
            semanticScore += typeStats.hits * typeStats.avgSimilarity;
        }
        return (exactScore + semanticScore) / stats.totalHits;
    }
    /**
     * Get per-query-type cache statistics
     */
    getPerQueryTypeStats() {
        if (!this.enableCache) {
            return {};
        }
        const stats = this.semanticCache.getStats();
        return stats.byQueryType;
    }
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
    async routeWithLogging(query, response, context) {
        const startTime = Date.now();
        // Route normally
        const decision = await this.route(query, context);
        const endTime = Date.now();
        const actualLatency = endTime - startTime;
        // Log to shadow buffer (privacy-filtered)
        await this.shadowLogger.log(query, response, decision.route === "local" ? "local-model" : "cloud-model", decision.route === "hybrid" ? "cloud" : decision.route, {
            latency: actualLatency,
            cost: decision.estimatedCost,
            tokensUsed: 0, // Not tracked in RouteDecision
            fromCache: false, // Not tracked in RouteDecision
            sessionId: context?.sessionId,
        });
        return decision;
    }
    /**
     * Get shadow logs for ORPO training
     *
     * @returns All shadow log entries
     */
    getShadowLogs() {
        return this.shadowLogger.getLogs();
    }
    /**
     * Export logs for ORPO training
     *
     * @returns Log entries suitable for training (SOVEREIGN data excluded)
     */
    exportForTraining() {
        return this.shadowLogger.exportForTraining();
    }
    /**
     * Get shadow logger statistics
     *
     * @returns Current shadow logger stats
     */
    getShadowStats() {
        return this.shadowLogger.getStats();
    }
    /**
     * Enable or disable shadow logging
     *
     * @param enabled - Whether to enable shadow logging
     */
    setShadowLoggingEnabled(enabled) {
        this.shadowLogger.setEnabled(enabled);
    }
    /**
     * Check if shadow logging is enabled
     *
     * @returns True if shadow logging is enabled
     */
    isShadowLoggingEnabled() {
        return this.shadowLogger.isEnabled();
    }
}
/**
 * Default configuration
 */
export const DEFAULT_ROUTER_CONFIG = {
    complexityThreshold: 0.6,
    confidenceThreshold: 0.6,
    maxLatency: 1000,
    useSigmoidal: false,
};
//# sourceMappingURL=CascadeRouter.js.map