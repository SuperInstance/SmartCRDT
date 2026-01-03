#!/usr/bin/env node
/**
 * Cache Analytics Example
 *
 * This example demonstrates comprehensive cache performance monitoring
 * and analytics using the MetricsCollector from @lsi/cascade.
 *
 * Features demonstrated:
 * - Real-time metrics collection (hit rate, latency, memory)
 * - Time-windowed aggregation (1m, 5m, 15m, 1h, etc.)
 * - Historical data tracking and trend analysis
 * - Per-entry statistics (hot/cold entries)
 * - Query pattern analysis
 * - Performance optimization insights
 *
 * Run: npx tsx index.ts
 */

import { MetricsCollector } from '@lsi/cascade/src/analytics/MetricsCollector';
import type { CacheAnalyticsConfig } from '@lsi/protocol';

interface QuerySimulation {
  query: string;
  hit: boolean;
  latency: number;
  similarity?: number;
}

/**
 * Simulate cache queries for demonstration
 */
async function simulateQueries(collector: MetricsCollector, count: number = 100) {
  const queries: QuerySimulation[] = [];

  // Generate simulated queries with realistic patterns
  const commonQueries = [
    'What is the capital of France?',
    'How do I parse JSON in JavaScript?',
    'Explain async/await',
    'What is a REST API?',
  ];

  for (let i = 0; i < count; i++) {
    const isCommonQuery = Math.random() < 0.4; // 40% cache hit rate
    const query = isCommonQuery
      ? commonQueries[Math.floor(Math.random() * commonQueries.length)]
      : `Unique query ${i}`;

    const hit = isCommonQuery && Math.random() < 0.85; // 85% hit rate for common queries
    const latency = hit
      ? Math.random() * 10 + 1 // 1-11ms for cache hits
      : Math.random() * 500 + 100; // 100-600ms for cache misses

    const similarity = hit ? Math.random() * 0.15 + 0.85 : undefined; // 0.85-1.0 for hits

    queries.push({ query, hit, latency, similarity });
  }

  // Process queries
  for (const q of queries) {
    if (q.hit) {
      collector.recordHit(q.query, q.latency, q.similarity);
    } else {
      collector.recordMiss(q.query, q.latency);
    }

    // Simulate some memory changes
    if (Math.random() < 0.1) {
      const memoryUsage = Math.random() * 50 + 10; // 10-60MB
      collector.recordMemoryUsage(memoryUsage);
    }

    // Simulate some evictions
    if (Math.random() < 0.02) {
      collector.recordEviction();
    }

    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Update cache size
  collector.updateSize(Math.floor(Math.random() * 500 + 500), 1000);

  return queries;
}

/**
 * Display metrics snapshot
 */
function displaySnapshot(snapshot: any) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 CACHE METRICS SNAPSHOT');
  console.log('='.repeat(70));

  // Hit Rate Metrics
  console.log('\n🎯 Hit Rate Metrics:');
  console.log(`  Overall Hit Rate: ${(snapshot.hitRate.overall * 100).toFixed(1)}%`);
  console.log(`  Rolling Hit Rate (last 1000): ${(snapshot.hitRate.rollingHitRate * 100).toFixed(1)}%`);
  console.log(`  Trend: ${snapshot.hitRate.trend} (strength: ${snapshot.hitRate.trendStrength.toFixed(2)})`);

  if (snapshot.hitRate.byTimeWindow) {
    console.log('  By Time Window:');
    for (const [window, rate] of Object.entries(snapshot.hitRate.byTimeWindow)) {
      console.log(`    ${window}: ${(rate as number * 100).toFixed(1)}%`);
    }
  }

  // Latency Metrics
  console.log('\n⏱️  Latency Metrics:');
  console.log(`  Average: ${snapshot.latency.average.toFixed(2)}ms`);
  console.log(`  Median (p50): ${snapshot.latency.p50.toFixed(2)}ms`);
  console.log(`  p95: ${snapshot.latency.p95.toFixed(2)}ms`);
  console.log(`  p99: ${snapshot.latency.p99.toFixed(2)}ms`);
  console.log(`  Min: ${snapshot.latency.min.toFixed(2)}ms`);
  console.log(`  Max: ${snapshot.latency.max.toFixed(2)}ms`);
  console.log(`  Std Dev: ${snapshot.latency.stdDev.toFixed(2)}ms`);

  if (snapshot.latency.histogram.length > 0) {
    console.log('  Latency Distribution:');
    for (const bucket of snapshot.latency.histogram.slice(0, 5)) {
      const bar = '█'.repeat(Math.min(50, bucket.count * 5));
      console.log(`    ${bucket.bucket.toString().padStart(5)}ms: ${bar} (${bucket.count})`);
    }
  }

  // Memory Metrics
  console.log('\n💾 Memory Metrics:');
  console.log(`  Current Usage: ${snapshot.memory.currentUsage.toFixed(2)}MB`);
  console.log(`  Peak Usage: ${snapshot.memory.peakUsage.toFixed(2)}MB`);
  console.log(`  Trend: ${snapshot.memory.trend}`);
  console.log(`  Bytes per Entry: ${snapshot.memory.bytesPerEntry.toFixed(2)}`);

  // Entry Metrics
  console.log('\n📦 Entry Metrics:');
  console.log(`  Total Entries: ${snapshot.entries.totalEntries}`);
  console.log(`  Active Entries: ${snapshot.entries.activeEntries}`);
  console.log(`  Evictions: ${snapshot.entries.evictions}`);
  console.log(`  Eviction Rate: ${snapshot.entries.evictionRate.toFixed(2)}/sec`);

  // Similarity Metrics
  console.log('\n🔍 Similarity Metrics:');
  console.log(`  Average: ${snapshot.similarity.average.toFixed(3)}`);
  console.log(`  Median: ${snapshot.similarity.median.toFixed(3)}`);
  console.log(`  Min: ${snapshot.similarity.min.toFixed(3)}`);
  console.log(`  Max: ${snapshot.similarity.max.toFixed(3)}`);
  console.log(`  Std Dev: ${snapshot.similarity.stdDev.toFixed(3)}`);

  // Query Pattern Metrics
  console.log('\n📈 Query Pattern Metrics:');
  console.log(`  Repetition Rate: ${(snapshot.patterns.repetitionRate * 100).toFixed(1)}%`);
  console.log(`  Top 5 Queries by Frequency:`);
  for (const item of snapshot.patterns.queryFrequency.slice(0, 5)) {
    const truncated = item.query.length > 40 ? item.query.substring(0, 37) + '...' : item.query;
    console.log(`    ${truncated.padEnd(40)} (${item.count}x)`);
  }

  console.log(`\n  Top 5 Hot Entries (most accessed):`);
  for (const item of snapshot.patterns.hotEntries.slice(0, 5)) {
    const truncated = item.key.length > 40 ? item.key.substring(0, 37) + '...' : item.key;
    console.log(`    ${truncated.padEnd(40)} (${item.hitCount}x)`);
  }

  // Cache Size
  console.log('\n📏 Cache Size:');
  console.log(`  Current: ${snapshot.size}`);
  console.log(`  Max: ${snapshot.maxSize}`);
  console.log(`  Utilization: ${((snapshot.size / snapshot.maxSize) * 100).toFixed(1)}%`);
  console.log(`  Similarity Threshold: ${snapshot.threshold.toFixed(3)}`);

  console.log('='.repeat(70));
}

/**
 * Display historical data
 */
function displayHistory(collector: MetricsCollector) {
  console.log('\n' + '='.repeat(70));
  console.log('📈 HISTORICAL DATA');
  console.log('='.repeat(70));

  // Get time series data for different windows
  const windows = ['1m', '5m', '15m', '1h'] as const;

  for (const window of windows) {
    const data = collector.getTimeSeries(window);
    if (data.count > 0) {
      console.log(`\n⏰ ${window} Time Window (${data.count} points):`);

      const hitRates = data.points.map(p => p.hitRate);
      const avgHitRate = hitRates.reduce((a, b) => a + b, 0) / hitRates.length;
      const minHitRate = Math.min(...hitRates);
      const maxHitRate = Math.max(...hitRates);

      console.log(`  Hit Rate: avg ${(avgHitRate * 100).toFixed(1)}%, range ${(minHitRate * 100).toFixed(1)}% - ${(maxHitRate * 100).toFixed(1)}%`);

      const latencies = data.points.map(p => p.latency);
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log(`  Latency: avg ${avgLatency.toFixed(2)}ms`);
    }
  }

  console.log('='.repeat(70));
}

/**
 * Display optimization recommendations
 */
function displayRecommendations(snapshot: any) {
  console.log('\n' + '='.repeat(70));
  console.log('💡 OPTIMIZATION RECOMMENDATIONS');
  console.log('='.repeat(70));

  const recommendations: string[] = [];

  // Hit rate analysis
  if (snapshot.hitRate.overall < 0.6) {
    recommendations.push('⚠️  Low hit rate (<60%). Consider cache warming with common queries.');
  } else if (snapshot.hitRate.overall < 0.8) {
    recommendations.push('⚡ Hit rate is moderate. Increase warm-up queries for better performance.');
  }

  // Latency analysis
  if (snapshot.latency.p95 > 100) {
    recommendations.push('⚠️  High p95 latency (>100ms). Consider optimizing cache lookup or increasing size.');
  }

  // Memory analysis
  if (snapshot.memory.trend === 'growing') {
    recommendations.push('⚠️  Memory usage is growing. Monitor for potential leaks.');
  }

  // Eviction rate
  if (snapshot.entries.evictionRate > 1) {
    recommendations.push('⚠️  High eviction rate. Consider increasing cache size.');
  }

  // Similarity threshold
  if (snapshot.similarity.average < 0.8 && snapshot.similarity.average > 0) {
    recommendations.push('⚡ Consider adjusting similarity threshold for better cache hits.');
  }

  // Repetition rate
  if (snapshot.patterns.repetitionRate < 0.3) {
    recommendations.push('⚡ Low query repetition. Consider focusing cache on specific query patterns.');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Cache performance is optimal!');
  }

  for (const rec of recommendations) {
    console.log(`  ${rec}`);
  }

  console.log('='.repeat(70));
}

/**
 * Main example execution
 */
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        Aequor Cache Analytics Example                                ║');
  console.log('║        Comprehensive Cache Performance Monitoring                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  // Create metrics collector with configuration
  const config: CacheAnalyticsConfig = {
    metricsCollectionInterval: 1000, // 1 second
    maxHistoryPoints: 10000,
    enableRealTimeAnalytics: true,
    enablePredictiveAnalysis: false,
  };

  const collector = new MetricsCollector('demo-cache', config);

  console.log('\n📊 MetricsCollector initialized');
  console.log('   - Cache ID: demo-cache');
  console.log('   - Collection interval: 1s');
  console.log('   - Max history points: 10,000');

  // Phase 1: Simulate initial queries
  console.log('\n🔄 Phase 1: Simulating 100 queries...');
  await simulateQueries(collector, 100);

  // Collect metrics
  collector.collectMetrics();

  // Get snapshot
  const snapshot1 = collector.getSnapshot();
  displaySnapshot(snapshot1);
  displayHistory(collector);
  displayRecommendations(snapshot1);

  // Phase 2: Simulate more queries to show trends
  console.log('\n🔄 Phase 2: Simulating additional 200 queries...');
  await simulateQueries(collector, 200);
  collector.collectMetrics();

  const snapshot2 = collector.getSnapshot();
  console.log('\n📊 Updated Snapshot:');
  console.log(`   Hit Rate: ${(snapshot2.hitRate.overall * 100).toFixed(1)}% (${snapshot1.hitRate.overall < snapshot2.hitRate.overall ? '↑' : '↓'} from ${(snapshot1.hitRate.overall * 100).toFixed(1)}%)`);
  console.log(`  Avg Latency: ${snapshot2.latency.average.toFixed(2)}ms (${snapshot1.latency.average < snapshot2.latency.average ? '↑' : '↓'} from ${snapshot1.latency.average.toFixed(2)}ms)`);

  // Phase 3: Display counters
  const counters = collector.getCounters();
  console.log('\n🔢 Final Counters:');
  console.log(`   Total Hits: ${counters.hits}`);
  console.log(`   Total Misses: ${counters.missCount}`);
  console.log(`   Total Evictions: ${counters.evictions}`);
  console.log(`   Total Requests: ${counters.hits + counters.missCount}`);

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📋 ANALYTICS SUMMARY');
  console.log('='.repeat(70));
  console.log('\n✅ Metrics Collected:');
  console.log('   • Real-time hit rate tracking');
  console.log('   • Latency distribution (p50, p95, p99)');
  console.log('   • Memory usage monitoring');
  console.log('   • Query pattern analysis');
  console.log('   • Time-windowed aggregation');
  console.log('   • Hot/cold entry detection');
  console.log('   • Similarity score tracking');

  console.log('\n📈 Key Insights:');
  console.log(`   • Overall hit rate: ${(snapshot2.hitRate.overall * 100).toFixed(1)}%`);
  console.log(`   • Average latency: ${snapshot2.latency.average.toFixed(2)}ms`);
  console.log(`   • Query repetition: ${(snapshot2.patterns.repetitionRate * 100).toFixed(1)}%`);
  console.log(`   • Peak memory usage: ${snapshot2.memory.peakUsage.toFixed(2)}MB`);

  console.log('\n🎯 Next Steps:');
  console.log('   1. Monitor hit rate trends over time');
  console.log('   2. Identify and warm frequently-missed queries');
  console.log('   3. Adjust cache size based on eviction rate');
  console.log('   4. Optimize similarity threshold for better matches');
  console.log('   5. Set up alerts for performance degradation');

  console.log('\n✨ Example complete!');
}

// Run the example
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
