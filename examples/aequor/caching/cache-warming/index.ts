#!/usr/bin/env node
/**
 * Cache Warming Example
 *
 * This example demonstrates cache warming - pre-populating the cache with
 * frequently-asked queries to improve performance from the start.
 *
 * Features demonstrated:
 * - Static warming with predefined query lists
 * - Log-based warming from historical data
 * - Batch processing with delays
 * - Background warming
 * - Custom query sets by category
 * - Performance comparison (cold vs. warmed cache)
 *
 * Run: npx tsx index.ts
 */

import { CacheWarmer, getCommonQueries } from '@lsi/cascade/src/cache/CacheWarmer';
import type { CacheWarmingResult } from '@lsi/cascade/src/cache/CacheWarmer';

/**
 * Mock CascadeRouter for demonstration
 */
class MockCascadeRouter {
  private cache = new Map<string, { response: string; timestamp: number }>();
  private recentQueries: string[] = [];

  async route(query: string, context: any) {
    const cached = this.cache.get(query);

    if (cached) {
      return {
        action: 'cached',
        response: cached.response,
        notes: 'Cache hit',
      };
    }

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    const response = `Response to: ${query}`;
    this.cache.set(query, { response, timestamp: Date.now() });
    this.recentQueries.push(query);

    return {
      action: 'processed',
      response,
      notes: 'Cache miss - processed and cached',
    };
  }

  getSessionContext() {
    return {
      getRecentQueries: () => this.recentQueries,
    };
  }
}

/**
 * Display warming results
 */
function displayWarmingResults(result: CacheWarmingResult, phase: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`🔥 ${phase} - Cache Warming Results`);
  console.log('='.repeat(70));
  console.log(`✅ Successful: ${result.successful}`);
  console.log(`❌ Failed: ${result.failed}`);
  console.log(`⏱️  Duration: ${result.duration}ms`);

  if (result.failedQueries && result.failedQueries.length > 0) {
    console.log('\n❌ Failed Queries:');
    for (const failed of result.failedQueries) {
      console.log(`  - "${failed.query}": ${failed.error}`);
    }
  }

  const successRate = (result.successful / (result.successful + result.failed)) * 100;
  console.log(`\n📊 Success Rate: ${successRate.toFixed(1)}%`);
  console.log('='.repeat(70));
}

/**
 * Simulate queries and measure performance
 */
async function measurePerformance(router: MockCascadeRouter, queries: string[], label: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`⚡ ${label}`);
  console.log('='.repeat(70));

  const startTime = Date.now();
  let hits = 0;
  let misses = 0;

  for (const query of queries) {
    const result = await router.route(query, {});

    if (result.notes?.includes('hit')) {
      hits++;
    } else {
      misses++;
    }
  }

  const duration = Date.now() - startTime;
  const avgLatency = duration / queries.length;
  const hitRate = (hits / queries.length) * 100;

  console.log(`📊 Results:`);
  console.log(`  Total Queries: ${queries.length}`);
  console.log(`  Cache Hits: ${hits} (${hitRate.toFixed(1)}%)`);
  console.log(`  Cache Misses: ${misses} (${(100 - hitRate).toFixed(1)}%)`);
  console.log(`  Total Duration: ${duration}ms`);
  console.log(`  Average Latency: ${avgLatency.toFixed(2)}ms`);
  console.log('='.repeat(70));

  return { hits, misses, duration, avgLatency, hitRate };
}

/**
 * Main example execution
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor Cache Warming Example                                  ║');
  console.log('║        Pre-populating Cache for Better Performance                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Create router and warmer
  const router = new MockCascadeRouter();

  // Phase 1: Default common queries
  console.log('\n📚 Phase 1: Warming with Default Common Queries');
  console.log('   Using built-in common query set (mix of programming, general knowledge, etc.)');

  const warmer1 = new CacheWarmer(router as any, {
    commonQueries: CacheWarmer.getDefaultCommonQueries(),
    batchSize: 10,
    delayBetweenBatches: 50,
  });

  const result1 = await warmer1.warm();
  displayWarmingResults(result1, 'Phase 1');

  // Phase 2: Programming-specific queries
  console.log('\n💻 Phase 2: Warming with Programming Queries');
  console.log('   Using programming-focused query set');

  const warmer2 = new CacheWarmer(router as any, {
    commonQueries: CacheWarmer.getProgrammingQueries(),
    batchSize: 5,
    delayBetweenBatches: 30,
  });

  const result2 = await warmer2.warm();
  displayWarmingResults(result2, 'Phase 2');

  // Phase 3: General knowledge queries
  console.log('\n🌍 Phase 3: Warming with General Knowledge Queries');
  console.log('   Using general knowledge query set');

  const warmer3 = new CacheWarmer(router as any, {
    commonQueries: CacheWarmer.getGeneralKnowledgeQueries(),
    batchSize: 5,
    delayBetweenBatches: 20,
  });

  const result3 = await warmer3.warm();
  displayWarmingResults(result3, 'Phase 3');

  // Phase 4: Custom domain-specific queries
  console.log('\n🎯 Phase 4: Warming with Custom Domain Queries');
  console.log('   Using custom web development query set');

  const customQueries = [
    'What is React?',
    'How do I create a component in React?',
    'What is the useState hook?',
    'Explain useEffect in React',
    'What is the virtual DOM?',
    'How do I handle forms in React?',
    'What is Redux?',
    'Explain React context',
    'What is Next.js?',
    'How do I deploy a React app?',
  ];

  const warmer4 = new CacheWarmer(router as any, {
    commonQueries: customQueries,
    batchSize: 3,
    delayBetweenBatches: 30,
  });

  const result4 = await warmer4.warm();
  displayWarmingResults(result4, 'Phase 4');

  // Phase 5: Background warming
  console.log('\n🔄 Phase 5: Background Warming');
  console.log('   Starting background cache warming...');

  const warmer5 = new CacheWarmer(router as any, {
    commonQueries: getCommonQueries().slice(0, 20),
    batchSize: 5,
    delayBetweenBatches: 50,
  });

  // Start background warming (don't await)
  const backgroundPromise = warmer5.warmInBackground();
  console.log('   ✓ Background warming started (running in parallel)');

  // Phase 6: Performance comparison
  console.log('\n📊 Phase 6: Performance Comparison');

  // Test queries that should be in cache
  const testQueries = [
    'What is JavaScript?',
    'How do I write a for loop in Python?',
    'What is the capital of France?',
    'Explain recursion',
    'What is React?',
    'How do I create a component in React?',
  ];

  // Wait for background warming to complete
  await backgroundPromise;

  console.log('\n✅ All warming complete. Measuring performance...');

  const performance = await measurePerformance(router, testQueries, 'Warmed Cache Performance');

  // Phase 7: Cold cache comparison (create new router)
  console.log('\n❄️  Phase 7: Cold Cache Comparison');

  const coldRouter = new MockCascadeRouter();
  const coldPerformance = await measurePerformance(coldRouter, testQueries, 'Cold Cache Performance');

  // Calculate improvement
  console.log('\n' + '='.repeat(70));
  console.log('📈 PERFORMANCE IMPROVEMENT');
  console.log('='.repeat(70));

  const latencyImprovement = ((coldPerformance.avgLatency - performance.avgLatency) / coldPerformance.avgLatency) * 100;
  const hitRateImprovement = performance.hitRate - coldPerformance.hitRate;
  const speedup = coldPerformance.avgLatency / performance.avgLatency;

  console.log(`\n🎯 Key Metrics:`);
  console.log(`   Hit Rate Improvement: +${hitRateImprovement.toFixed(1)}%`);
  console.log(`   Latency Reduction: ${latencyImprovement.toFixed(1)}%`);
  console.log(`   Speedup: ${speedup.toFixed(2)}x faster`);
  console.log(`   Warmed Cache Latency: ${performance.avgLatency.toFixed(2)}ms`);
  console.log(`   Cold Cache Latency: ${coldPerformance.avgLatency.toFixed(2)}ms`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 CACHE WARMING SUMMARY');
  console.log('='.repeat(70));

  const totalWarmed = result1.successful + result2.successful + result3.successful + result4.successful;
  const totalDuration = result1.duration + result2.duration + result3.duration + result4.duration;

  console.log('\n✅ Warming Statistics:');
  console.log(`   Total Queries Warmed: ${totalWarmed}`);
  console.log(`   Total Warming Time: ${totalDuration}ms`);
  console.log(`   Average Warming Speed: ${(totalDuration / totalWarmed).toFixed(2)}ms/query`);

  console.log('\n🎯 Benefits Achieved:');
  console.log(`   • ${latencyImprovement.toFixed(1)}% latency reduction`);
  console.log(`   • ${speedup.toFixed(2)}x faster response times`);
  console.log(`   • ${hitRateImprovement.toFixed(1)}% higher hit rate`);
  console.log(`   • Instant responses for common queries`);

  console.log('\n💡 Warming Strategies Demonstrated:');
  console.log('   1. Static warming with default common queries');
  console.log('   2. Category-specific warming (programming, general knowledge)');
  console.log('   3. Custom domain-specific warming');
  console.log('   4. Background warming for non-blocking initialization');
  console.log('   5. Batch processing with configurable sizes and delays');

  console.log('\n🔧 Configuration Options:');
  console.log('   • batchSize: Number of queries per batch (3-10 recommended)');
  console.log('   • delayBetweenBatches: Delay between batches (20-100ms)');
  console.log('   • commonQueries: Custom query arrays for your domain');

  console.log('\n📚 Built-in Query Sets:');
  console.log('   • getDefaultCommonQueries(): 60+ mixed common queries');
  console.log('   • getProgrammingQueries(): 20+ programming queries');
  console.log('   • getGeneralKnowledgeQueries(): 15+ general knowledge queries');

  console.log('\n🎯 Best Practices:');
  console.log('   1. Use batch processing to avoid overwhelming the system');
  console.log('   2. Start with default queries, then customize for your domain');
  console.log('   3. Use background warming during application startup');
  console.log('   4. Monitor cache analytics to identify warming candidates');
  console.log('   5. Update warm-up queries based on production logs');

  console.log('\n✨ Example complete!');
}

// Run the example
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
