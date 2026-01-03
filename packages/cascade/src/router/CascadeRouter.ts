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

import type {
  RouteDecision,
  RouterConfig,
  SystemState,
  QueryContext,
  RouteFeedback,
  RefinedQuery,
  CostAwareRoutingResult,
  CacheStatus,
} from "../types.js";
import { ComplexityScorer } from "./ComplexityScorer.js";
import { ProsodyDetector } from "../cadence/ProsodyDetector.js";
import {
  MotivationEncoder,
  SimpleSessionContext,
} from "../psychology/MotivationEncoder.js";
import { QueryRefiner } from "../refiner/QueryRefiner.js";
import { CostAwareRouter } from "./CostAwareRouter.js";
import {
  SemanticCache,
  type CacheHit,
  type CacheMiss,
} from "../refiner/SemanticCache.js";
import {
  ShadowLogger,
  createShadowLogger,
  type ShadowLoggerConfig,
  type ShadowLogEntry,
} from "../shadow/index.js";
import {
  OllamaHealthChecker,
  createOllamaHealthChecker,
} from "../health/OllamaHealthChecker.js";
import type { OllamaHealthCheckResult } from "@lsi/protocol";
import {
  FallbackManager,
  createFallbackManager,
} from "./FallbackManager.js";
import type {
  FallbackStrategy,
  FallbackResult,
  RouteDecisionWithFallback,
  FallbackTrigger,
  FallbackManagerConfig,
} from "@lsi/protocol";

/**
 * CascadeRouter - Main router with emotional intelligence
 */
export class CascadeRouter {
  private complexityScorer: ComplexityScorer;
  private cadenceDetector: ProsodyDetector;
  private motivationEncoder: MotivationEncoder;
  private sessionContext: SimpleSessionContext;
  private refiner: QueryRefiner;
  private config: RouterConfig;
  private enableRefiner: boolean;
  private costAwareRouter: CostAwareRouter | null;
  private enableCostAware: boolean;
  private semanticCache: SemanticCache;
  private enableCache: boolean;
  private shadowLogger: ShadowLogger;
  private healthChecker: OllamaHealthChecker;
  private enableHealthChecks: boolean;
  private cachedHealthStatus: OllamaHealthCheckResult | null;
  private lastHealthCheck: number;
  private fallbackManager: FallbackManager;
  private enableFallback: boolean;

  constructor(config: RouterConfig = {}, enableRefiner: boolean = true) {
    this.complexityScorer = new ComplexityScorer();
    this.cadenceDetector = new ProsodyDetector();
    this.motivationEncoder = new MotivationEncoder();
    this.sessionContext = new SimpleSessionContext();
    this.refiner = new QueryRefiner();
    this.enableRefiner = enableRefiner;
    this.enableCostAware = config.enableCostAware ?? false;
    this.enableCache = config.enableCache ?? true;
    this.enableHealthChecks = config.enableHealthChecks ?? true;
    this.enableFallback = config.enableFallback ?? true;
    this.cachedHealthStatus = null;
    this.lastHealthCheck = 0;
    this.config = {
      complexityThreshold: config.complexityThreshold ?? 0.6,
      confidenceThreshold: config.confidenceThreshold ?? 0.6,
      maxLatency: config.maxLatency ?? 1000,
      useSigmoidal: config.useSigmoidal ?? false,
      sigmoidalWeights: config.sigmoidalWeights,
      costAware: config.costAware,
      enableCostAware: this.enableCostAware,
      enableCache: this.enableCache,
      cacheSimilarityThreshold: config.cacheSimilarityThreshold ?? 0.85,
      enableAdaptiveCache: config.enableAdaptiveCache ?? true,
      enableHealthChecks: this.enableHealthChecks,
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

    // Initialize Ollama health checker
    this.healthChecker = createOllamaHealthChecker(
      config.ollamaBaseURL || "http://localhost:11434",
      config.ollamaModel || "llama2",
      {
        timeout: 5000,
        cacheTTL: 10000,
        maxResponseTime: 1000,
        enablePerformanceMetrics: true,
        enableModelCheck: true,
        enableResourceMonitoring: true,
      }
    );

    // Initialize fallback manager
    this.fallbackManager = createFallbackManager({
      defaultStrategy: config.fallbackStrategy,
      routeStrategies: config.routeFallbackStrategies,
      enableAdaptive: config.enableAdaptiveFallback ?? true,
      enableMetrics: true,
      maxFallbackDepth: config.maxFallbackDepth ?? 3,
    });
  }

  /**
   * Route a query to the optimal resource
   * @param query - The user's query
   * @param context - Additional context (timestamp, sessionId, etc.)
   * @returns RouteDecision with routing and UX recommendations
   */
  async route(query: string, context?: QueryContext): Promise<RouteDecision> {
    const timestamp = context?.timestamp || Date.now();

    // Stage 0: Refine query (static + semantic analysis)
    let refinedQuery: RefinedQuery | null = null;
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
    const motivation = this.motivationEncoder.encode(
      query,
      this.sessionContext
    );

    // Score complexity (use refined complexity if available)
    const complexity = this.complexityScorer.score(query, context);

    // Calculate base routing decision
    let decision = this.calculateBaseRoute(complexity, query, context);

    // Apply soulful adjustments based on cadence and motivation
    decision = this.applySoulfulAdjustments(
      decision,
      prosody,
      trend,
      motivation
    );

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
  async routeWithCache(
    query: string,
    context?: QueryContext
  ): Promise<RouteDecision> {
    // If cache is disabled, use regular routing
    if (!this.enableCache) {
      return this.route(query, context);
    }

    const timestamp = context?.timestamp || Date.now();

    // Stage 0: Refine query (static + semantic analysis)
    let refinedQuery: RefinedQuery | null = null;
    if (this.enableRefiner) {
      refinedQuery = await this.refiner.refine(query);
    }

    // Check cache first if we have a refined query
    if (refinedQuery) {
      const cached = await this.semanticCache.get(refinedQuery);

      if (cached.found) {
        // Cache hit - return cached route decision
        const cachedDecision = cached.result as RouteDecision;

        // Update notes to indicate cache hit
        const matchType =
          (cached as CacheHit).similarity === 1.0 ? "exact" : "semantic";
        cachedDecision.notes = [
          ...(cachedDecision.notes || []),
          `Cache hit (${matchType}, similarity: ${(cached as CacheHit).similarity.toFixed(3)})`,
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
  private applyRefinerInsights(
    decision: RouteDecision,
    refined: RefinedQuery
  ): RouteDecision {
    const adjusted = { ...decision };

    // Include refiner complexity if it's higher than scorer's
    if (refined.staticFeatures.complexity > 0.7) {
      adjusted.notes?.push(
        `Refiner: High complexity detected (${refined.staticFeatures.complexity.toFixed(2)})`
      );
    }

    // Add query type to notes for transparency
    adjusted.notes?.push(`Query type: ${refined.staticFeatures.queryType}`);

    // Add domain keywords if detected
    if (refined.staticFeatures.domainKeywords.length > 0) {
      adjusted.notes?.push(
        `Domains: ${refined.staticFeatures.domainKeywords.join(", ")}`
      );
    }

    // Attach suggestions to decision
    if (refined.suggestions.length > 0) {
      const suggestionNotes = refined.suggestions.map(
        s => `[${s.type}] ${s.message}`
      );
      adjusted.notes = [...(adjusted.notes || []), ...suggestionNotes];
    }

    // Check if semantic features suggest similar queries
    if (
      refined.semanticFeatures?.similarQueries &&
      refined.semanticFeatures.similarQueries.length > 0
    ) {
      adjusted.notes?.push(
        `${refined.semanticFeatures.similarQueries.length} similar queries found in cache`
      );
    }

    return adjusted;
  }

  /**
   * Calculate base routing decision from complexity
   */
  private calculateBaseRoute(
    complexity: ReturnType<ComplexityScorer["score"]>,
    query: string,
    context?: QueryContext
  ): RouteDecision {
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
    } else {
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
  private applySoulfulAdjustments(
    decision: RouteDecision,
    prosody: ReturnType<ProsodyDetector["detect"]>,
    trend: ReturnType<ProsodyDetector["getTrend"]>,
    motivation: Awaited<ReturnType<MotivationEncoder["encode"]>>
  ): RouteDecision {
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
  learnFromFeedback(feedback: RouteFeedback): void {
    // TODO: Implement adaptive weight adjustment
    // For now, this is a placeholder for future learning
    console.debug("[CascadeRouter] Received feedback:", feedback);
  }

  /**
   * Get current session context
   */
  getSessionContext(): SimpleSessionContext {
    return this.sessionContext;
  }

  /**
   * Reset session (e.g., new user)
   */
  resetSession(): void {
    this.sessionContext = new SimpleSessionContext();
    this.cadenceDetector.clear();
  }

  /**
   * Route with cost-aware decision making
   * @param query - The user's query
   * @param context - Additional context
   * @returns Cost-aware routing result
   */
  async routeWithCost(
    query: string,
    context?: QueryContext
  ): Promise<CostAwareRoutingResult | RouteDecision> {
    if (!this.costAwareRouter) {
      // Fall back to regular routing if cost-aware not enabled
      return this.route(query, context);
    }

    const complexity = this.complexityScorer.score(query, context);
    const costResult = await this.costAwareRouter.route(
      query,
      complexity.overall,
      context
    );

    // Add cost-aware notes to result
    costResult.notes = costResult.notes || [];

    if (!costResult.withinBudget) {
      costResult.notes.push("⚠️  Budget exceeded - request may be blocked");
    }

    if (costResult.backend === "local") {
      costResult.notes.push("🟢 Using local model (free)");
    } else {
      costResult.notes.push(
        `🔵 Using cloud model ($${costResult.estimatedCost.toFixed(4)} estimated)`
      );
    }

    return costResult;
  }

  /**
   * Get the cost-aware router instance
   */
  getCostAwareRouter(): CostAwareRouter | null {
    return this.costAwareRouter;
  }

  /**
   * Enable or disable cost-aware routing
   */
  setCostAwareEnabled(
    enabled: boolean,
    config?: RouterConfig["costAware"]
  ): void {
    this.enableCostAware = enabled;

    if (enabled && config) {
      this.config.costAware = config;
      this.costAwareRouter = new CostAwareRouter(config);
    } else if (!enabled) {
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
  async cacheResult(
    refinedQuery: RefinedQuery,
    result: unknown
  ): Promise<void> {
    if (!this.enableCache) return;
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
  clearCache(): void {
    if (!this.enableCache) return;
    this.semanticCache.clear();
  }

  /**
   * Enable or disable caching
   * @param enabled - Whether to enable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.enableCache = enabled;
    this.config.enableCache = enabled;
  }

  /**
   * Get the semantic cache instance
   */
  getSemanticCache(): SemanticCache {
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
  async routeWithIntelligentCache(
    query: string,
    context?: QueryContext
  ): Promise<RouteDecision & { cacheStatus: CacheStatus }> {
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
    let refinedQuery: RefinedQuery | null = null;
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
  private createCachedDecision(cacheResult: CacheHit): RouteDecision {
    const baseDecision = cacheResult.entry.result as RouteDecision;

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
  private async cacheResultAsync(
    refinedQuery: RefinedQuery,
    decision: RouteDecision
  ): Promise<void> {
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
  async warmCache(commonQueries: string[]): Promise<{
    successful: number;
    failed: number;
    duration: number;
  }> {
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;

    for (const query of commonQueries) {
      try {
        const decision = await this.route(query);
        const refinedQuery = await this.refiner.refine(query);
        await this.semanticCache.set(refinedQuery, decision);
        successful++;
      } catch (error) {
        console.warn(
          `[CascadeRouter] Failed to warm cache for query: ${query}`,
          error
        );
        failed++;
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[CascadeRouter] Cache warming complete: ${successful} successful, ${failed} failed, ${duration}ms`
    );

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
  private calculateAverageSimilarity(stats: {
    totalHits: number;
    exactHits: number;
    semanticHits: number;
    byQueryType: Record<string, { hits: number; avgSimilarity: number }>;
  }): number {
    if (stats.totalHits === 0) return 0;

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
  getPerQueryTypeStats(): Record<
    string,
    {
      hits: number;
      misses: number;
      hitRate: number;
      avgSimilarity: number;
    }
  > {
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
  async routeWithLogging(
    query: string,
    response: string,
    context?: QueryContext
  ): Promise<RouteDecision> {
    const startTime = Date.now();

    // Route normally
    const decision = await this.route(query, context);

    const endTime = Date.now();
    const actualLatency = endTime - startTime;

    // Log to shadow buffer (privacy-filtered)
    await this.shadowLogger.log(
      query,
      response,
      decision.route === "local" ? "local-model" : "cloud-model",
      decision.route === "hybrid" ? "cloud" : decision.route,
      {
        latency: actualLatency,
        cost: decision.estimatedCost,
        tokensUsed: 0, // Not tracked in RouteDecision
        fromCache: false, // Not tracked in RouteDecision
        sessionId: context?.sessionId,
      }
    );

    return decision;
  }

  /**
   * Get shadow logs for ORPO training
   *
   * @returns All shadow log entries
   */
  getShadowLogs(): ShadowLogEntry[] {
    return this.shadowLogger.getLogs();
  }

  /**
   * Export logs for ORPO training
   *
   * @returns Log entries suitable for training (SOVEREIGN data excluded)
   */
  exportForTraining(): ShadowLogEntry[] {
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
  setShadowLoggingEnabled(enabled: boolean): void {
    this.shadowLogger.setEnabled(enabled);
  }

  /**
   * Check if shadow logging is enabled
   *
   * @returns True if shadow logging is enabled
   */
  isShadowLoggingEnabled(): boolean {
    return this.shadowLogger.isEnabled();
  }

  // ==========================================================================
  // HEALTH CHECK METHODS
  // ==========================================================================

  /**
   * Check Ollama health status
   *
   * Uses cached result if available and fresh (within TTL).
   * Performs health check if cache is stale or missing.
   *
   * @returns Ollama health check result
   */
  async checkOllamaHealth(): Promise<OllamaHealthCheckResult> {
    if (!this.enableHealthChecks) {
      // Return healthy status if health checks disabled
      return {
        healthy: true,
        score: 1,
        message: "Health checks disabled",
        status: "healthy",
        timestamp: Date.now(),
        duration: 0,
        daemonRunning: true,
        availableModels: [],
        defaultModelAvailable: true,
        responseTime: 0,
        healthStatus: "healthy",
      };
    }

    const now = Date.now();
    const healthCacheTTL = 10000; // 10 seconds

    // Return cached status if fresh
    if (
      this.cachedHealthStatus &&
      now - this.lastHealthCheck < healthCacheTTL
    ) {
      return this.cachedHealthStatus;
    }

    // Perform fresh health check
    this.cachedHealthStatus = await this.healthChecker.checkHealth();
    this.lastHealthCheck = now;

    return this.cachedHealthStatus;
  }

  /**
   * Quick health check - returns cached result if available
   *
   * Use this for fast checks where absolute freshness is not critical.
   *
   * @returns Ollama health check result (possibly cached)
   */
  async quickHealthCheck(): Promise<OllamaHealthCheckResult> {
    if (!this.enableHealthChecks) {
      return {
        healthy: true,
        score: 1,
        message: "Health checks disabled",
        status: "healthy",
        timestamp: Date.now(),
        duration: 0,
        daemonRunning: true,
        availableModels: [],
        defaultModelAvailable: true,
        responseTime: 0,
        healthStatus: "healthy",
      };
    }

    return this.healthChecker.quickCheck();
  }

  /**
   * Force health check bypassing cache
   *
   * Use this when you need absolutely fresh health status.
   *
   * @returns Fresh Ollama health check result
   */
  async forceHealthCheck(): Promise<OllamaHealthCheckResult> {
    if (!this.enableHealthChecks) {
      return {
        healthy: true,
        score: 1,
        message: "Health checks disabled",
        status: "healthy",
        timestamp: Date.now(),
        duration: 0,
        daemonRunning: true,
        availableModels: [],
        defaultModelAvailable: true,
        responseTime: 0,
        healthStatus: "healthy",
      };
    }

    this.cachedHealthStatus = await this.healthChecker.forceCheck();
    this.lastHealthCheck = Date.now();
    return this.cachedHealthStatus;
  }

  /**
   * Get cached health status without performing check
   *
   * @returns Cached health status or null if not available
   */
  getCachedHealthStatus(): OllamaHealthCheckResult | null {
    return this.cachedHealthStatus;
  }

  /**
   * Check if Ollama is healthy
   *
   * Convenience method that returns boolean.
   *
   * @returns True if Ollama is healthy
   */
  async isOllamaHealthy(): Promise<boolean> {
    const health = await this.checkOllamaHealth();
    return health.healthy && health.healthStatus !== "unhealthy";
  }

  /**
   * Enable or disable health checks
   *
   * @param enabled - Whether to enable health checks
   */
  setHealthChecksEnabled(enabled: boolean): void {
    this.enableHealthChecks = enabled;
    this.config.enableHealthChecks = enabled;
  }

  /**
   * Check if health checks are enabled
   *
   * @returns True if health checks are enabled
   */
  isHealthChecksEnabled(): boolean {
    return this.enableHealthChecks;
  }

  /**
   * Clear health status cache
   *
   * Forces next health check to be fresh.
   */
  clearHealthCache(): void {
    this.cachedHealthStatus = null;
    this.lastHealthCheck = 0;
    this.healthChecker.clearCache();
  }

  // ============================================================================
  // FALLBACK MANAGEMENT METHODS
  // ============================================================================

  /**
   * Determine if fallback should be triggered based on error
   * @param currentRoute - Current route that failed
   * @param error - Error that occurred
   * @returns Fallback decision
   */
  async shouldFallback(
    currentRoute: "local" | "cloud" | "hybrid",
    error: Error
  ): Promise<
    import("@lsi/protocol").FallbackDecision
  > {
    if (!this.enableFallback) {
      return {
        shouldFallback: false,
        targetRoute: currentRoute,
        reason: "none",
        confidence: 1.0,
        estimatedSuccessRate: 0.0,
      };
    }

    return this.fallbackManager.shouldFallback(currentRoute, error);
  }

  /**
   * Execute a function with fallback support
   * @param route - Primary route to use
   * @param fn - Function to execute
   * @returns Result with automatic fallback on error
   */
  async executeWithFallback<T>(
    route: "local" | "cloud" | "hybrid",
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.enableFallback) {
      return fn();
    }

    try {
      return await fn();
    } catch (error) {
      const fallbackDecision = await this.shouldFallback(
        route,
        error as Error
      );

      if (fallbackDecision.shouldFallback) {
        // Execute fallback
        const fallbackResult = await this.fallbackManager.executeFallback(
          route,
          fallbackDecision.targetRoute,
          fallbackDecision.reason,
          fn
        );

        if (fallbackResult.success && fallbackResult.result) {
          return fallbackResult.result;
        }

        // Fallback also failed, throw original error
        throw error;
      }

      // No fallback triggered, throw original error
      throw error;
    }
  }

  /**
   * Get fallback metrics
   * @returns Current fallback metrics
   */
  getFallbackMetrics() {
    return this.fallbackManager.getMetrics();
  }

  /**
   * Get fallback state
   * @returns Current fallback state
   */
  getFallbackState() {
    return this.fallbackManager.getState();
  }

  /**
   * Reset fallback manager
   */
  resetFallback(): void {
    this.fallbackManager.reset();
  }

  /**
   * Enable or disable fallback
   * @param enabled - Whether to enable fallback
   */
  setFallbackEnabled(enabled: boolean): void {
    this.enableFallback = enabled;
  }

  /**
   * Check if fallback is enabled
   * @returns True if fallback is enabled
   */
  isFallbackEnabled(): boolean {
    return this.enableFallback;
  }

  /**
   * Get circuit breaker stats for a route
   * @param route - Route to get stats for
   * @returns Circuit breaker stats
   */
  getCircuitBreakerStats(route: "local" | "cloud" | "hybrid") {
    return this.fallbackManager.getCircuitBreakerStats(route);
  }

  /**
   * Manually open circuit for a route
   * @param route - Route to open circuit for
   */
  openCircuit(route: "local" | "cloud" | "hybrid"): void {
    this.fallbackManager.openCircuit(route);
  }

  /**
   * Manually close circuit for a route
   * @param route - Route to close circuit for
   */
  closeCircuit(route: "local" | "cloud" | "hybrid"): void {
    this.fallbackManager.closeCircuit(route);
  }

  /**
   * Record performance for adaptive learning
   * @param route - Route that was used
   * @param success - Whether operation was successful
   * @param latency - Latency in milliseconds
   * @param cost - Cost in USD
   */
  recordPerformance(
    route: "local" | "cloud" | "hybrid",
    success: boolean,
    latency: number,
    cost: number
  ): void {
    this.fallbackManager.recordPerformance(route, success, latency, cost);
  }

  /**
   * Route with fallback-enhanced decision
   * @param query - The user's query
   * @param context - Additional context
   * @returns Route decision with fallback information
   */
  async routeWithFallback(
    query: string,
    context?: QueryContext
  ): Promise<RouteDecisionWithFallback> {
    const decision = await this.route(query, context);

    return this.fallbackManager.enhanceRouteDecision({
      ...decision,
      fallbackAvailable: false,
      fallbackTriggers: [],
    });
  }
}

/**
 * Default configuration
 */
export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  complexityThreshold: 0.6,
  confidenceThreshold: 0.6,
  maxLatency: 1000,
  useSigmoidal: false,
};
