/**
 * Cost tracking and metrics for LSI caching demonstration.
 * This module tracks API usage, costs, and performance metrics.
 */

export interface QueryMetrics {
  id: string;
  timestamp: Date;
  query: string;
  responseTime: number;
  cacheHit: boolean;
  similarityScore: number;
  estimatedCost: number;
  tokensUsed: number;
}

export interface CacheMetrics {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgResponseTime: {
    cached: number;
    uncached: number;
  };
  totalCostSavings: number;
  totalAPICalls: number;
  apiCallsSaved: number;
}

/**
 * Tracks costs and metrics for LSI queries
 */
export class CostTracker {
  private queries: QueryMetrics[] = [];
  private cacheHits = 0;
  private cacheMisses = 0;
  private totalCost = 0;
  private totalAPICalls = 0;

  /**
   * Record a query execution
   */
  recordQuery(
    query: string,
    responseTime: number,
    cacheHit: boolean,
    similarityScore: number = 0,
    tokensUsed: number = 0
  ): void {
    const id = this.generateId();
    const estimatedCost = this.calculateCost(tokensUsed);

    const metrics: QueryMetrics = {
      id,
      timestamp: new Date(),
      query,
      responseTime,
      cacheHit,
      similarityScore,
      estimatedCost,
      tokensUsed
    };

    this.queries.push(metrics);

    if (cacheHit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
      this.totalAPICalls++;
    }

    this.totalCost += estimatedCost;
  }

  /**
   * Generate unique ID for query
   */
  private generateId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate estimated cost based on tokens
   * Using OpenAI pricing as reference: $0.002 per 1K tokens
   */
  private calculateCost(tokens: number): number {
    const pricePer1K = 0.002;
    return (tokens / 1000) * pricePer1K;
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    const totalQueries = this.queries.length;
    const cacheHits = this.cacheHits;
    const cacheMisses = this.cacheMisses;
    const hitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    const cachedQueries = this.queries.filter(q => q.cacheHit);
    const uncachedQueries = this.queries.filter(q => !q.cacheHit);

    const avgCachedTime = cachedQueries.length > 0
      ? cachedQueries.reduce((sum, q) => sum + q.responseTime, 0) / cachedQueries.length
      : 0;

    const avgUncachedTime = uncachedQueries.length > 0
      ? uncachedQueries.reduce((sum, q) => sum + q.responseTime, 0) / uncachedQueries.length
      : 0;

    const apiCallsWithoutCache = totalQueries;
    const apiCallsWithCache = this.cacheMisses;
    const apiCallsSaved = apiCallsWithoutCache - apiCallsWithCache;

    const costWithoutCache = this.queries.reduce((sum, q) => sum + q.estimatedCost, 0);
    const costWithCache = this.queries
      .filter(q => !q.cacheHit)
      .reduce((sum, q) => sum + q.estimatedCost, 0);

    const totalCostSavings = costWithoutCache - costWithCache;

    return {
      totalQueries,
      cacheHits,
      cacheMisses,
      hitRate,
      avgResponseTime: {
        cached: avgCachedTime,
        uncached: avgUncachedTime
      },
      totalCost: costWithoutCache,
      totalAPICalls: apiCallsWithCache,
      apiCallsSaved
    };
  }

  /**
   * Get query history
   */
  getQueryHistory(): QueryMetrics[] {
    return [...this.queries];
  }

  /**
   * Get recent queries (last N)
   */
  getRecentQueries(limit: number = 10): QueryMetrics[] {
    return this.queries.slice(-limit);
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      cacheMetrics: this.getCacheMetrics(),
      queries: this.queries,
      exportDate: new Date().toISOString()
    }, null, 2);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.queries = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.totalCost = 0;
    this.totalAPICalls = 0;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): string {
    const metrics = this.getCacheMetrics();

    return `
Performance Summary:
┌─────────────────────────────────────────────────────────┐
│ Total Queries: ${metrics.totalQueries.toString().padStart(10)} │
│ Cache Hits:   ${metrics.cacheHits.toString().padStart(10)}   │
│ Cache Misses: ${metrics.cacheMisses.toString().padStart(10)}   │
│ Hit Rate:     ${metrics.hitRate.toFixed(1).padStart(10)}%     │
├─────────────────────────────────────────────────────────┤
│ Avg Response Time:                                     │
│   Cached:      ${metrics.avgResponseTime.cached.toFixed(0).padStart(9)}ms  │
│   Uncached:    ${metrics.avgResponseTime.uncached.toFixed(0).padStart(9)}ms  │
│ Speedup:       ${((metrics.avgResponseTime.uncached / metrics.avgResponseTime.cached) || 1).toFixed(1)}x  │
├─────────────────────────────────────────────────────────┤
│ Cost Savings:                                          │
│   Original Cost: $${metrics.totalCost.toFixed(2).padStart(8)}        │
│   Saved:        $${metrics.totalCostSavings.toFixed(2).padStart(8)}        │
│   API Calls Saved: ${metrics.apiCallsSaved.toString().padStart(7)}       │
└─────────────────────────────────────────────────────────┘
    `.trim();
  }
}