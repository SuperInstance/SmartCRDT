/**
 * Router Benchmarks - Comprehensive router performance testing
 *
 * Benchmarks:
 * - CascadeRouter performance (QPS, latency percentiles)
 * - Query complexity impact on routing
 * - Cache effectiveness (hit rate, latency reduction)
 * - Concurrent request handling
 * - Comparison across different router configurations
 */

import { performance } from 'perf_hooks';

/**
 * Benchmark result metrics
 */
export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p50: number;
  p95: number;
  p99: number;
  p999: number;
  throughput: number; // operations per second
  durationDistribution: number[];
}

/**
 * Cache effectiveness metrics
 */
export interface CacheEffectivenessMetrics {
  hitRate: number;
  missRate: number;
  averageHitLatency: number;
  averageMissLatency: number;
  latencyReduction: number; // percentage
  cacheSize: number;
  evictions: number;
}

/**
 * Query complexity test result
 */
export interface ComplexityTestResult {
  complexity: number;
  queryCount: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  localModelUsage: number;
  cloudModelUsage: number;
  cacheHitRate: number;
}

/**
 * Router benchmark suite results
 */
export interface RouterBenchmarkSuite {
  timestamp: number;
  routerType: string;
  configuration: any;
  benchmarks: {
    qpsBenchmark: BenchmarkResult;
    latencyBenchmark: BenchmarkResult;
    cacheEffectiveness: CacheEffectivenessMetrics;
    complexityTests: ComplexityTestResult[];
    concurrentRequests: BenchmarkResult;
  };
}

/**
 * Benchmark configuration
 */
export interface RouterBenchmarkConfig {
  warmupIterations?: number;
  benchmarkIterations?: number;
  concurrencyLevels?: number[];
  queryComplexities?: number[];
  enableCacheTests?: boolean;
  enableComplexityTests?: boolean;
  enableConcurrencyTests?: boolean;
}

/**
 * Mock query for testing
 */
export interface MockQuery {
  text: string;
  complexity: number;
  expectedRoute: 'local' | 'cloud';
}

/**
 * Router benchmark suite
 */
export class RouterBenchmarks {
  private config: Required<RouterBenchmarkConfig>;
  private queries: MockQuery[] = [];

  constructor(config: RouterBenchmarkConfig = {}) {
    this.config = {
      warmupIterations: config.warmupIterations ?? 100,
      benchmarkIterations: config.benchmarkIterations ?? 1000,
      concurrencyLevels: config.concurrencyLevels ?? [1, 10, 50, 100, 500],
      queryComplexities: config.queryComplexities ?? [0.1, 0.3, 0.5, 0.7, 0.9],
      enableCacheTests: config.enableCacheTests ?? true,
      enableComplexityTests: config.enableComplexityTests ?? true,
      enableConcurrencyTests: config.enableConcurrencyTests ?? true,
    };

    this.generateMockQueries();
  }

  /**
   * Generate mock queries for testing
   */
  private generateMockQueries(): void {
    const templates = [
      { text: 'What is the capital of France?', complexity: 0.1, expectedRoute: 'local' },
      { text: 'Calculate 2 + 2', complexity: 0.15, expectedRoute: 'local' },
      { text: 'Who won the 1998 World Cup?', complexity: 0.3, expectedRoute: 'local' },
      { text: 'Explain quantum entanglement', complexity: 0.5, expectedRoute: 'cloud' },
      { text: 'Compare economic policies of 20th century', complexity: 0.6, expectedRoute: 'cloud' },
      { text: 'Analyze the impact of AI on healthcare', complexity: 0.7, expectedRoute: 'cloud' },
      { text: 'Write a comprehensive analysis of climate change', complexity: 0.8, expectedRoute: 'cloud' },
      { text: 'Design a distributed system architecture', complexity: 0.9, expectedRoute: 'cloud' },
    ];

    for (let i = 0; i < this.config.benchmarkIterations; i++) {
      const template = templates[i % templates.length];
      this.queries.push({
        ...template,
        text: `${template.text} (Query ${i})`,
      });
    }
  }

  /**
   * Run benchmark function with timing
   */
  private async runBenchmark<T>(
    name: string,
    fn: () => Promise<T>,
    iterations: number
  ): Promise<BenchmarkResult> {
    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      await fn();
    }

    const durations: number[] = [];
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterStart = performance.now();
      await fn();
      durations.push(performance.now() - iterStart);
    }

    const totalDuration = performance.now() - startTime;
    const sortedDurations = durations.sort((a, b) => a - b);

    return {
      name,
      iterations,
      totalDuration,
      averageDuration: totalDuration / iterations,
      minDuration: sortedDurations[0],
      maxDuration: sortedDurations[sortedDurations.length - 1],
      p50: this.percentile(sortedDurations, 50),
      p95: this.percentile(sortedDurations, 95),
      p99: this.percentile(sortedDurations, 99),
      p999: this.percentile(sortedDurations, 99.9),
      throughput: (iterations / totalDuration) * 1000,
      durationDistribution: sortedDurations,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Benchmark queries per second
   */
  async benchmarkQPS(routerFn: (query: string) => Promise<any>): Promise<BenchmarkResult> {
    return this.runBenchmark('QPS Benchmark', async () => {
      const query = this.queries[Math.floor(Math.random() * this.queries.length)];
      await routerFn(query.text);
    }, this.config.benchmarkIterations);
  }

  /**
   * Benchmark latency percentiles
   */
  async benchmarkLatency(routerFn: (query: string) => Promise<any>): Promise<BenchmarkResult> {
    return this.runBenchmark('Latency Benchmark', async () => {
      const query = this.queries[Math.floor(Math.random() * this.queries.length)];
      await routerFn(query.text);
    }, this.config.benchmarkIterations);
  }

  /**
   * Benchmark cache effectiveness
   */
  async benchmarkCacheEffectiveness(
    routerFn: (query: string) => Promise<any>,
    cacheFn?: () => { hitRate: number; size: number; evictions: number }
  ): Promise<CacheEffectivenessMetrics> {
    const hitLatencies: number[] = [];
    const missLatencies: number[] = [];
    const results = new Map<string, any>();

    // First pass - populate cache
    for (const query of this.queries.slice(0, 100)) {
      const start = performance.now();
      const result = await routerFn(query.text);
      const duration = performance.now() - start;
      results.set(query.text, result);
      missLatencies.push(duration);
    }

    // Second pass - measure cache hits
    for (const query of this.queries.slice(0, 100)) {
      const start = performance.now();
      await routerFn(query.text);
      const duration = performance.now() - start;
      hitLatencies.push(duration);
    }

    // Third pass - measure cache misses (new queries)
    for (const query of this.queries.slice(100, 200)) {
      const start = performance.now();
      await routerFn(query.text);
      const duration = performance.now() - start;
      missLatencies.push(duration);
    }

    const avgHitLatency =
      hitLatencies.length > 0
        ? hitLatencies.reduce((sum, d) => sum + d, 0) / hitLatencies.length
        : 0;
    const avgMissLatency =
      missLatencies.length > 0
        ? missLatencies.reduce((sum, d) => sum + d, 0) / missLatencies.length
        : 0;

    const hitRate = hitLatencies.length / (hitLatencies.length + missLatencies.length);
    const missRate = 1 - hitRate;
    const latencyReduction = avgMissLatency > 0 ? ((avgMissLatency - avgHitLatency) / avgMissLatency) * 100 : 0;

    const cacheInfo = cacheFn?.() || { hitRate, size: results.size, evictions: 0 };

    return {
      hitRate: cacheInfo.hitRate,
      missRate,
      averageHitLatency: avgHitLatency,
      averageMissLatency: avgMissLatency,
      latencyReduction,
      cacheSize: cacheInfo.size,
      evictions: cacheInfo.evictions,
    };
  }

  /**
   * Benchmark query complexity impact
   */
  async benchmarkComplexity(
    routerFn: (query: string) => Promise<{ route?: 'local' | 'cloud'; latency?: number }>
  ): Promise<ComplexityTestResult[]> {
    const results: ComplexityTestResult[] = [];

    for (const complexity of this.config.queryComplexities) {
      const queries = this.queries.filter((q) => q.complexity === complexity);
      if (queries.length === 0) continue;

      const latencies: number[] = [];
      const routes: ('local' | 'cloud')[] = [];
      const cacheHits: number[] = [];

      // First pass - cold cache
      for (const query of queries.slice(0, 50)) {
        const start = performance.now();
        const result = await routerFn(query.text);
        const duration = performance.now() - start;

        latencies.push(duration);
        routes.push(result.route || query.expectedRoute);
        cacheHits.push(0);
      }

      // Second pass - warm cache
      for (const query of queries.slice(0, 50)) {
        const start = performance.now();
        await routerFn(query.text);
        const duration = performance.now() - start;

        latencies.push(duration);
        cacheHits.push(1);
      }

      const sortedLatencies = latencies.sort((a, b) => a - b);
      const localUsage = routes.filter((r) => r === 'local').length / routes.length;
      const cloudUsage = 1 - localUsage;
      const cacheHitRate = cacheHits.filter((h) => h > 0).length / cacheHits.length;

      results.push({
        complexity,
        queryCount: queries.length,
        averageLatency: latencies.reduce((sum, d) => sum + d, 0) / latencies.length,
        p95Latency: this.percentile(sortedLatencies, 95),
        p99Latency: this.percentile(sortedLatencies, 99),
        localModelUsage: localUsage,
        cloudModelUsage: cloudUsage,
        cacheHitRate,
      });
    }

    return results;
  }

  /**
   * Benchmark concurrent request handling
   */
  async benchmarkConcurrency(
    routerFn: (query: string) => Promise<any>,
    concurrency: number
  ): Promise<BenchmarkResult> {
    const queryBatch = this.queries.slice(0, this.config.benchmarkIterations);
    const durations: number[] = [];

    // Warmup
    for (let i = 0; Math.min(i, queryBatch.length) < this.config.warmupIterations; i++) {
      await Promise.all(
        Array.from({ length: Math.min(concurrency, queryBatch.length) }, (_, j) =>
          routerFn(queryBatch[j % queryBatch.length].text)
        )
      );
    }

    // Benchmark
    const startTime = performance.now();
    let completed = 0;

    while (completed < queryBatch.length) {
      const batchSize = Math.min(concurrency, queryBatch.length - completed);
      const batchStart = performance.now();

      await Promise.all(
        Array.from({ length: batchSize }, (_, i) =>
          routerFn(queryBatch[completed + i].text)
        )
      );

      const batchDuration = performance.now() - batchStart;
      durations.push(...Array(batchSize).fill(batchDuration / batchSize));
      completed += batchSize;
    }

    const totalDuration = performance.now() - startTime;
    const sortedDurations = durations.sort((a, b) => a - b);

    return {
      name: `Concurrency-${concurrency}`,
      iterations: queryBatch.length,
      totalDuration,
      averageDuration: totalDuration / queryBatch.length,
      minDuration: sortedDurations[0],
      maxDuration: sortedDurations[sortedDurations.length - 1],
      p50: this.percentile(sortedDurations, 50),
      p95: this.percentile(sortedDurations, 95),
      p99: this.percentile(sortedDurations, 99),
      p999: this.percentile(sortedDurations, 99.9),
      throughput: (queryBatch.length / totalDuration) * 1000,
      durationDistribution: sortedDurations,
    };
  }

  /**
   * Run full router benchmark suite
   */
  async runFullBenchmark(
    routerType: string,
    routerFn: (query: string) => Promise<any>,
    configuration: any = {},
    cacheFn?: () => { hitRate: number; size: number; evictions: number }
  ): Promise<RouterBenchmarkSuite> {
    const results: RouterBenchmarkSuite = {
      timestamp: Date.now(),
      routerType,
      configuration,
      benchmarks: {
        qpsBenchmark: await this.benchmarkQPS(routerFn),
        latencyBenchmark: await this.benchmarkLatency(routerFn),
        cacheEffectiveness: this.config.enableCacheTests
          ? await this.benchmarkCacheEffectiveness(routerFn, cacheFn)
          : {
              hitRate: 0,
              missRate: 1,
              averageHitLatency: 0,
              averageMissLatency: 0,
              latencyReduction: 0,
              cacheSize: 0,
              evictions: 0,
            },
        complexityTests: this.config.enableComplexityTests
          ? await this.benchmarkComplexity(routerFn)
          : [],
        concurrentRequests: await this.benchmarkConcurrency(
          routerFn,
          this.config.concurrencyLevels[Math.floor(this.config.concurrencyLevels.length / 2)]
        ),
      },
    };

    return results;
  }

  /**
   * Compare two router configurations
   */
  async compareRouters(
    name1: string,
    router1Fn: (query: string) => Promise<any>,
    config1: any,
    name2: string,
    router2Fn: (query: string) => Promise<any>,
    config2: any,
    cacheFn?: () => { hitRate: number; size: number; evictions: number }
  ): Promise<{
    router1: RouterBenchmarkSuite;
    router2: RouterBenchmarkSuite;
    comparison: {
      qpsDifference: number;
      latencyDifference: number;
      cacheHitRateDifference: number;
      recommendations: string[];
    };
  }> {
    const [router1, router2] = await Promise.all([
      this.runFullBenchmark(name1, router1Fn, config1, cacheFn),
      this.runFullBenchmark(name2, router2Fn, config2, cacheFn),
    ]);

    const qpsDifference =
      ((router2.benchmarks.qpsBenchmark.throughput -
        router1.benchmarks.qpsBenchmark.throughput) /
        router1.benchmarks.qpsBenchmark.throughput) *
      100;
    const latencyDifference =
      ((router1.benchmarks.latencyBenchmark.p99 -
        router2.benchmarks.latencyBenchmark.p99) /
        router1.benchmarks.latencyBenchmark.p99) *
      100;
    const cacheHitRateDifference =
      (router2.benchmarks.cacheEffectiveness.hitRate -
        router1.benchmarks.cacheEffectiveness.hitRate) *
      100;

    const recommendations: string[] = [];
    if (qpsDifference > 10) {
      recommendations.push(`${name2} has significantly higher QPS (+${qpsDifference.toFixed(1)}%)`);
    } else if (qpsDifference < -10) {
      recommendations.push(`${name1} has significantly higher QPS (+${Math.abs(qpsDifference).toFixed(1)}%)`);
    }

    if (latencyDifference > 10) {
      recommendations.push(`${name2} has significantly lower p99 latency (+${latencyDifference.toFixed(1)}%)`);
    } else if (latencyDifference < -10) {
      recommendations.push(`${name1} has significantly lower p99 latency (+${Math.abs(latencyDifference).toFixed(1)}%)`);
    }

    if (cacheHitRateDifference > 5) {
      recommendations.push(`${name2} has better cache hit rate (+${cacheHitRateDifference.toFixed(1)}%)`);
    } else if (cacheHitRateDifference < -5) {
      recommendations.push(`${name1} has better cache hit rate (+${Math.abs(cacheHitRateDifference).toFixed(1)}%)`);
    }

    return {
      router1,
      router2,
      comparison: {
        qpsDifference,
        latencyDifference,
        cacheHitRateDifference,
        recommendations,
      },
    };
  }

  /**
   * Generate benchmark report
   */
  generateReport(suite: RouterBenchmarkSuite): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push(`ROUTER BENCHMARK REPORT: ${suite.routerType}`);
    lines.push(`Timestamp: ${new Date(suite.timestamp).toISOString()}`);
    lines.push('='.repeat(80));
    lines.push('');

    // QPS Benchmark
    lines.push('QUERIES PER SECOND');
    lines.push('-'.repeat(80));
    const qps = suite.benchmarks.qpsBenchmark;
    lines.push(`Throughput: ${qps.throughput.toFixed(2)} QPS`);
    lines.push(`Average Latency: ${qps.averageDuration.toFixed(2)}ms`);
    lines.push(`P50: ${qps.p50.toFixed(2)}ms | P95: ${qps.p95.toFixed(2)}ms | P99: ${qps.p99.toFixed(2)}ms`);
    lines.push('');

    // Cache Effectiveness
    lines.push('CACHE EFFECTIVENESS');
    lines.push('-'.repeat(80));
    const cache = suite.benchmarks.cacheEffectiveness;
    lines.push(`Hit Rate: ${(cache.hitRate * 100).toFixed(1)}%`);
    lines.push(`Avg Hit Latency: ${cache.averageHitLatency.toFixed(2)}ms`);
    lines.push(`Avg Miss Latency: ${cache.averageMissLatency.toFixed(2)}ms`);
    lines.push(`Latency Reduction: ${cache.latencyReduction.toFixed(1)}%`);
    lines.push(`Cache Size: ${cache.cacheSize} entries`);
    lines.push('');

    // Complexity Tests
    if (suite.benchmarks.complexityTests.length > 0) {
      lines.push('QUERY COMPLEXITY IMPACT');
      lines.push('-'.repeat(80));
      for (const test of suite.benchmarks.complexityTests) {
        lines.push(`Complexity ${test.complexity}:`);
        lines.push(`  Avg Latency: ${test.averageLatency.toFixed(2)}ms`);
        lines.push(`  P99: ${test.p99Latency.toFixed(2)}ms`);
        lines.push(`  Local: ${(test.localModelUsage * 100).toFixed(1)}% | Cloud: ${(test.cloudModelUsage * 100).toFixed(1)}%`);
        lines.push(`  Cache Hit Rate: ${(test.cacheHitRate * 100).toFixed(1)}%`);
      }
      lines.push('');
    }

    // Concurrent Requests
    lines.push('CONCURRENT REQUESTS');
    lines.push('-'.repeat(80));
    const concur = suite.benchmarks.concurrentRequests;
    lines.push(`Throughput: ${concur.throughput.toFixed(2)} ops/sec`);
    lines.push(`P99 Latency: ${concur.p99.toFixed(2)}ms`);
    lines.push('');

    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * Get mock queries
   */
  getQueries(): MockQuery[] {
    return [...this.queries];
  }

  /**
   * Clear queries
   */
  clearQueries(): void {
    this.queries = [];
  }
}
