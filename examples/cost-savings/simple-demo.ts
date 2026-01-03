#!/usr/bin/env node

/**
 * Cost Savings Example - LSI
 *
 * Simplified demo showing semantic caching benefits with simulated metrics.
 */

interface QueryMetric {
  query: string;
  responseTime: number;
  cacheHit: boolean;
  similarityScore: number;
  tokenCount: number;
}

interface CacheMetrics {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  totalCost: number;
  totalCostSavings: number;
  apiCallsSaved: number;
  averageResponseTime: {
    cached: number;
    uncached: number;
  };
}

class SimpleCostTracker {
  private queries: QueryMetric[] = [];
  private readonly inputRate = 0.002; // $0.002 per 1K tokens
  private readonly outputRate = 0.002; // $0.002 per 1K tokens

  recordQuery(query: string, responseTime: number, cacheHit: boolean, similarityScore: number, tokenCount: number): void {
    this.queries.push({
      query,
      responseTime,
      cacheHit,
      similarityScore,
      tokenCount
    });
  }

  getCacheMetrics(): CacheMetrics {
    const totalQueries = this.queries.length;
    const cacheHits = this.queries.filter(q => q.cacheHit).length;
    const cacheMisses = totalQueries - cacheHits;

    // Calculate costs
    const uncachedQueries = this.queries.filter(q => !q.cacheHit);
    const cachedQueries = this.queries.filter(q => q.cacheHit);

    // Average token count per query
    const avgTokens = this.queries.reduce((sum, q) => sum + q.tokenCount, 0) / totalQueries;

    // Base cost without cache
    const totalCost = uncachedQueries.length * avgTokens * (this.inputRate + this.outputRate) / 1000;

    // With cache, only miss queries cost
    const costWithCache = uncachedQueries.length * avgTokens * (this.inputRate + this.outputRate) / 1000;

    const totalCostSavings = totalCost - costWithCache;
    const apiCallsSaved = cacheHits;

    // Calculate average response times
    const cachedTimes = this.queries.filter(q => q.cacheHit).map(q => q.responseTime);
    const uncachedTimes = this.queries.filter(q => !q.cacheHit).map(q => q.responseTime);

    return {
      totalQueries,
      cacheHits,
      cacheMisses,
      totalCost,
      totalCostSavings,
      apiCallsSaved,
      averageResponseTime: {
        cached: cachedTimes.length > 0 ? cachedTimes.reduce((a, b) => a + b) / cachedTimes.length : 0,
        uncached: uncachedTimes.length > 0 ? uncachedTimes.reduce((a, b) => a + b) / uncachedTimes.length : 0
      }
    };
  }

  getPerformanceSummary(): string {
    const metrics = this.getCacheMetrics();
    const hitRate = (metrics.cacheHits / metrics.totalQueries) * 100;

    return `Performance Summary:
┌─────────────────────────────────────────────────────────┐
│ Total Queries: ${metrics.totalQueries.toString().padStart(11)}                              │
│ Cache Hits:   ${metrics.cacheHits.toString().padStart(11)}                               │
│ Cache Misses: ${metrics.cacheMisses.toString().padStart(11)}                              │
│ Hit Rate:     ${hitRate.toFixed(1).padStart(11)}%                                    │
├─────────────────────────────────────────────────────────┤
│ Avg Response Time:                                     │
│   Cached:      ${metrics.averageResponseTime.cached.toFixed(0).padStart(8)}ms                          │
│   Uncached:    ${metrics.averageResponseTime.uncached.toFixed(0).padStart(8)}ms                          │
│ Speedup:       ${metrics.averageResponseTime.uncached > 0 ? (metrics.averageResponseTime.uncached / metrics.averageResponseTime.cached).toFixed(1) : 'N/A'}x                                   │
└─────────────────────────────────────────────────────────┘`;
  }
}

class SimpleCostSavingsDemo {
  private tracker: SimpleCostTracker;
  private queryCount = 0;

  constructor() {
    this.tracker = new SimpleCostTracker();
  }

  async run(): Promise<void> {
    console.log('💰 LSI Cost Savings Demo');
    console.log('==================================================\n');
    console.log('This demo shows how semantic caching saves time and money.\n');

    // Run initial warm-up queries
    await this.warmUpCache();

    // Run cost comparison demo
    await this.runCostComparison();

    // Show metrics
    this.displayMetrics();

    // Interactive demo
    this.interactiveDemo();
  }

  private async warmUpCache(): Promise<void> {
    console.log('🔥 Warming up cache...');
    console.log('-'.repeat(30));

    const warmUpQueries = [
      "What is user authentication?",
      "How does database connection work?",
      "Explain API endpoints",
      "What is error handling?",
      "How does routing work?"
    ];

    for (const query of warmUpQueries) {
      await this.executeQuery(query, true);
    }

    console.log('✅ Cache warmed up!\n');
  }

  private async executeQuery(query: string, isWarmUp: boolean = false): Promise<void> {
    const startTime = Date.now();

    // Simulate LSI processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Check if this was a cache hit
    const cacheHit = this.isCacheHit(query);

    // Simulate similarity score and token count
    const similarityScore = cacheHit ? 0.9 + Math.random() * 0.1 : 0.3 + Math.random() * 0.4;
    const tokenCount = 1000 + Math.floor(Math.random() * 1000);

    // Track metrics
    this.tracker.recordQuery(query, responseTime, cacheHit, similarityScore, tokenCount);

    if (!isWarmUp) {
      this.queryCount++;
      console.log(`${this.queryCount}. ${query}`);
      console.log(`   ${cacheHit ? '🟢' : '🔴'} ${responseTime}ms`);
    }
  }

  private isCacheHit(query: string): boolean {
    const key = query.toLowerCase().trim();
    const cacheKeys = [
      'user authentication',
      'database connection',
      'api endpoints',
      'error handling',
      'routing work'
    ];

    return cacheKeys.some(cacheKey => key.includes(cacheKey));
  }

  private async runCostComparison(): Promise<void> {
    console.log('\n💡 Cost Comparison Demo');
    console.log('-'.repeat(30));
    console.log('Running queries to demonstrate caching benefits...\n');

    const demoQueries = [
      // These should hit the cache
      "Tell me about user authentication systems",
      "How are database connections managed",
      "Explain the API endpoint structure",
      "What error handling mechanisms exist",
      "Describe the routing system",

      // These should miss the cache
      "How do I add a new feature?",
      "What is the codebase architecture?",
      "Where are configuration files stored?",
      "How do tests work?",
      "What dependencies are used?"
    ];

    for (const query of demoQueries) {
      await this.executeQuery(query);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private displayMetrics(): void {
    console.log('\n📊 Cost & Performance Metrics');
    console.log('='.repeat(50));

    // Performance summary
    console.log(this.tracker.getPerformanceSummary());

    // Cost breakdown
    const metrics = this.tracker.getCacheMetrics();

    console.log('\n💰 Cost Breakdown:');
    console.log('┌─────────────────────────────────────────────────┐');
    console.log('│ Scenario Without Cache:                         │');
    console.log(`│ Total Cost: $${metrics.totalCost.toFixed(2).padStart(10)}                    │`);
    console.log(`│ API Calls:  ${metrics.totalQueries.toString().padStart(10)}                 │`);
    console.log('├─────────────────────────────────────────────────┤');
    console.log('│ Scenario With Cache:                           │');
    console.log(`│ Total Cost: $${metrics.totalCostSavings > 0 ? (metrics.totalCost - metrics.totalCostSavings).toFixed(2) : '0.00'.padStart(10)}                 │`);
    console.log(`│ API Calls:  ${metrics.totalQueries - metrics.apiCallsSaved.toString().padStart(10)}                 │`);
    console.log('├─────────────────────────────────────────────────┤');
    console.log('│ Savings:                                       │');
    console.log(`│ Cost Saved: $${metrics.totalCostSavings.toFixed(2).padStart(10)}                 │`);
    console.log(`│ API Calls Saved: ${metrics.apiCallsSaved.toString().padStart(7)}               │`);
    console.log(`│ Cost Reduction: ${metrics.totalCost > 0 ? ((metrics.totalCostSavings / metrics.totalCost) * 100).toFixed(1) : 0}%${' '.repeat(3)}│`);
    console.log('└─────────────────────────────────────────────────┘');
  }

  private interactiveDemo(): void {
    console.log('\n🎯 Interactive Demo');
    console.log('='.repeat(30));
    console.log('\nTry these queries to see caching in action:\n');

    const demoQueries = [
      'How does authentication work?',
      'Tell me about auth systems',
      'Explain login process',
      'What is user authentication?',
      'Describe authentication flow'
    ];

    console.log('Suggested queries:');
    demoQueries.forEach((query, index) => {
      console.log(`${index + 1}. "${query}"`);
    });

    console.log('\n💡 Tip: Similar queries will hit the cache and be much faster!');
    console.log('In a real implementation, these queries would be served from the cache.');
  }
}

// Run the demo
async function runDemo() {
  const demo = new SimpleCostSavingsDemo();
  await demo.run();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { runDemo };
export default runDemo;