/**
 * Run all cache benchmarks and generate report
 *
 * This script runs comprehensive benchmarks on the SemanticCache implementation,
 * measuring hit rate, latency, memory usage, and other performance metrics.
 * Results are formatted and displayed for analysis.
 *
 * Usage:
 * ```bash
 * tsx packages/cascade/benchmarks/run-benchmarks.ts
 * ```
 *
 * Or via npm:
 * ```bash
 * npm run benchmark:cache
 * ```
 */

import { SemanticCache, PRODUCTION_SEMANTIC_CACHE_CONFIG } from '../src/refiner/SemanticCache.js';
import { measureHitRate, formatHitRateResults, DEFAULT_WORKLOAD } from '../tools/measure-hit-rate.js';
import { CacheWarmer, getCommonQueries } from '../src/cache/CacheWarmer.js';
import { CacheOptimizer } from '../src/cache/CacheOptimizer.js';
import type { RefinedQuery, QueryType } from '../src/types.js';

/**
 * Benchmark results summary
 */
interface BenchmarkSummary {
  hitRate: number;
  exactHitRate: number;
  semanticHitRate: number;
  avgLatency: number;
  memoryUsage: number;
  recommendations: string[];
}

/**
 * Create a mock refined query for testing
 */
function createMockRefinedQuery(
  query: string,
  queryType: QueryType = 'question',
  embedding?: number[]
): RefinedQuery {
  const mockEmbedding = embedding || Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

  return {
    original: query,
    normalized: query.toLowerCase().trim(),
    staticFeatures: {
      length: query.length,
      wordCount: query.split(/\s+/).length,
      queryType,
      complexity: 0.5,
      hasCode: false,
      hasSQL: false,
      hasUrl: false,
      hasEmail: false,
      questionMark: query.includes('?'),
      exclamationCount: (query.match(/!/g) || []).length,
      ellipsisCount: (query.match(/\.\./g) || []).length,
      capitalizationRatio: (query.match(/[A-Z]/g) || []).length / query.length,
      punctuationDensity: (query.match(/[.,;:!]/g) || []).length / query.split(/\s+/).length,
      technicalTerms: [],
      domainKeywords: [],
    },
    semanticFeatures: {
      embedding: mockEmbedding,
      embeddingDim: mockEmbedding.length,
      similarQueries: [],
      cluster: null,
      semanticComplexity: 0.5,
    },
    cacheKey: `${queryType}:${query.toLowerCase().trim()}`,
    suggestions: [],
    timestamp: Date.now(),
  };
}

/**
 * Warm cache with common queries
 */
async function warmCache(cache: SemanticCache, queries: string[]): Promise<void> {
  console.log(`Warming cache with ${queries.length} queries...`);

  for (const query of queries) {
    const queryType: QueryType = query.includes('?') ? 'question' :
                                query.includes('Write') || query.includes('Create') ? 'command' : 'general';
    const refinedQuery = createMockRefinedQuery(query, queryType);
    await cache.set(refinedQuery, { warmed: true, timestamp: Date.now() });
  }

  console.log(`Cache warmed: ${cache.size()} entries\n`);
}

/**
 * Measure latency for cache operations
 */
interface LatencyMetrics {
  hitLatency: { avg: number; p50: number; p95: number; p99: number };
  missLatency: { avg: number; p50: number; p95: number; p99: number };
}

function measureLatency(cache: SemanticCache, iterations: number = 1000): LatencyMetrics {
  const hitLatencies: number[] = [];
  const missLatencies: number[] = [];

  // Populate cache
  const testQueries = [
    'What is JavaScript?',
    'How do I write a for loop?',
    'Explain recursion',
    'What is the capital of France?',
    'Who wrote Romeo and Juliet?',
  ];

  for (const query of testQueries) {
    const refinedQuery = createMockRefinedQuery(query, 'question');
    cache.set(refinedQuery, { cached: true });
  }

  // Measure hit latency
  for (let i = 0; i < iterations; i++) {
    const query = testQueries[i % testQueries.length];
    const refinedQuery = createMockRefinedQuery(query, 'question');

    const start = performance.now();
    cache.get(refinedQuery);
    const end = performance.now();

    hitLatencies.push(end - start);
  }

  // Measure miss latency
  for (let i = 0; i < iterations; i++) {
    const query = `Never seen before query ${i}`;
    const refinedQuery = createMockRefinedQuery(query, 'question');

    const start = performance.now();
    cache.get(refinedQuery);
    const end = performance.now();

    missLatencies.push(end - start);
  }

  const percentile = (arr: number[], p: number) => {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.floor((p / 100) * sorted.length);
    return sorted[index] || 0;
  };

  return {
    hitLatency: {
      avg: hitLatencies.reduce((a, b) => a + b, 0) / hitLatencies.length,
      p50: percentile(hitLatencies, 50),
      p95: percentile(hitLatencies, 95),
      p99: percentile(hitLatencies, 99),
    },
    missLatency: {
      avg: missLatencies.reduce((a, b) => a + b, 0) / missLatencies.length,
      p50: percentile(missLatencies, 50),
      p95: percentile(missLatencies, 95),
      p99: percentile(missLatencies, 99),
    },
  };
}

/**
 * Calculate memory usage
 */
function calculateMemoryUsage(cache: SemanticCache): number {
  const size = cache.size();
  // Assume ~21 KB per entry (including 1536-dim embeddings and metadata)
  return size * 21_000;
}

/**
 * Format latency metrics
 */
function formatLatencyMetrics(metrics: LatencyMetrics): string {
  const lines = [
    '',
    '═══════════════════════════════════════════════════════════',
    '                    LATENCY ANALYSIS',
    '═══════════════════════════════════════════════════════════',
    '',
    'Cache Hit Latency:',
    `  Average: ${metrics.hitLatency.avg.toFixed(2)}ms`,
    `  P50:     ${metrics.hitLatency.p50.toFixed(2)}ms`,
    `  P95:     ${metrics.hitLatency.p95.toFixed(2)}ms`,
    `  P99:     ${metrics.hitLatency.p99.toFixed(2)}ms`,
    '',
    'Cache Miss Latency:',
    `  Average: ${metrics.missLatency.avg.toFixed(2)}ms`,
    `  P50:     ${metrics.missLatency.p50.toFixed(2)}ms`,
    `  P95:     ${metrics.missLatency.p95.toFixed(2)}ms`,
    `  P99:     ${metrics.missLatency.p99.toFixed(2)}ms`,
    '',
    'Speedup:',
    `  Cache hits are ${(metrics.missLatency.avg / metrics.hitLatency.avg).toFixed(0)}x faster than misses`,
    '',
  ];
  return lines.join('\n');
}

/**
 * Main benchmark runner
 */
export async function runBenchmarks(): Promise<BenchmarkSummary> {
  console.log('\n🚀 Running SemanticCache Benchmarks...\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  const recommendations: string[] = [];

  // 1. Hit Rate Benchmark
  console.log('1️️⃣  HIT RATE BENCHMARK');
  console.log('═══════════════════════════════════════════════════════════');

  const cache = new SemanticCache({
    ...PRODUCTION_SEMANTIC_CACHE_CONFIG,
    enableAdaptiveThreshold: true,
    enableQueryTypeThresholds: true,
  });

  const commonQueries = getCommonQueries();
  await warmCache(cache, commonQueries);

  const hitRateResults = await measureHitRate(cache, DEFAULT_WORKLOAD, 1000, 0.3);
  console.log(formatHitRateResults(hitRateResults));

  // Check hit rate target
  if (hitRateResults.hitRate >= 0.80) {
    console.log('✅ Hit rate target (80%) achieved!\n');
  } else {
    console.log(`⚠️  Hit rate (${(hitRateResults.hitRate * 100).toFixed(1)}%) below 80% target`);
    recommendations.push('Consider decreasing similarity threshold to improve hit rate');
  }

  // 2. Latency Benchmark
  console.log('\n2️️⃣  LATENCY BENCHMARK');
  console.log('═══════════════════════════════════════════════════════════');

  const latencyMetrics = measureLatency(cache, 1000);
  console.log(formatLatencyMetrics(latencyMetrics));

  // 3. Memory Benchmark
  console.log('3️️⃣  MEMORY BENCHMARK');
  console.log('═══════════════════════════════════════════════════════════');

  const memoryUsage = calculateMemoryUsage(cache);
  const memoryUsageMB = memoryUsage / (1024 * 1024);
  const memoryPerEntryKB = (memoryUsage / cache.size()) / 1024;

  console.log('');
  console.log(`Cache Size:        ${cache.size()} entries`);
  console.log(`Total Memory:      ${memoryUsageMB.toFixed(2)} MB`);
  console.log(`Memory per Entry:  ${memoryPerEntryKB.toFixed(2)} KB`);
  console.log('');

  if (memoryUsageMB > 100) {
    recommendations.push('Memory usage > 100 MB - consider reducing cache size');
  } else {
    console.log('✅ Memory usage within acceptable range (< 100 MB)\n');
  }

  // 4. Optimization Analysis
  console.log('4️️⃣  OPTIMIZATION ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════');

  const optimizer = new CacheOptimizer(cache);
  console.log('\n' + optimizer.generateReport() + '\n');

  const suggestions = optimizer.analyze();
  if (suggestions.length > 0) {
    console.log(`\n📋 ${suggestions.length} optimization suggestion(s) found\n`);
    for (const suggestion of suggestions) {
      if (suggestion.priority === 'high' || suggestion.priority === 'medium') {
        recommendations.push(`[${suggestion.priority.toUpperCase()}] ${suggestion.suggestion}`);
      }
    }
  } else {
    console.log('✅ No optimizations needed - cache is well-tuned!\n');
  }

  // 5. Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('                    BENCHMARK SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Hit Rate:           ${(hitRateResults.hitRate * 100).toFixed(1)}% (target: 80%)`);
  console.log(`Exact Hit Rate:     ${(hitRateResults.exactHitRate * 100).toFixed(1)}%`);
  console.log(`Semantic Hit Rate:  ${(hitRateResults.semanticHitRate * 100).toFixed(1)}%`);
  console.log(`Avg Hit Latency:    ${latencyMetrics.hitLatency.avg.toFixed(2)}ms`);
  console.log(`Memory Usage:       ${memoryUsageMB.toFixed(2)} MB`);
  console.log('');

  if (hitRateResults.hitRate >= 0.80 && memoryUsageMB < 100) {
    console.log('✅ ALL BENCHMARKS PASSED');
    console.log('    Cache is performing optimally!');
  } else if (hitRateResults.hitRate >= 0.80) {
    console.log('⚠️  HIT RATE OK, but memory usage elevated');
  } else if (memoryUsageMB < 100) {
    console.log('⚠️  MEMORY OK, but hit rate below target');
  } else {
    console.log('❌ MULTIPLE ISSUES DETECTED');
  }

  if (recommendations.length > 0) {
    console.log('');
    console.log('Recommendations:');
    for (let i = 0; i < recommendations.length; i++) {
      console.log(`  ${i + 1}. ${recommendations[i]}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════\n');

  return {
    hitRate: hitRateResults.hitRate,
    exactHitRate: hitRateResults.exactHitRate,
    semanticHitRate: hitRateResults.semanticHitRate,
    avgLatency: latencyMetrics.hitLatency.avg,
    memoryUsage,
    recommendations,
  };
}

/**
 * Run quick benchmark (hit rate only)
 */
export async function runQuickBenchmark(): Promise<void> {
  console.log('\n⚡ Quick Cache Benchmark\n');

  const cache = new SemanticCache(PRODUCTION_SEMANTIC_CACHE_CONFIG);

  const commonQueries = getCommonQueries().slice(0, 30);
  await warmCache(cache, commonQueries);

  const results = await measureHitRate(cache, DEFAULT_WORKLOAD.slice(0, 10), 500, 0.3);

  console.log(`Hit Rate: ${(results.hitRate * 100).toFixed(1)}%`);
  console.log(`Target:   80.0%`);
  console.log(`Status:   ${results.hitRate >= 0.80 ? '✅ PASS' : '❌ FAIL'}\n`);
}

/**
 * CLI entry point
 */
export async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const quickMode = args.includes('--quick') || args.includes('-q');

  if (quickMode) {
    await runQuickBenchmark();
  } else {
    await runBenchmarks();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
