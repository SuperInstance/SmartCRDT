/**
 * Benchmark Runner - Comprehensive Performance Benchmarking
 *
 * High-performance benchmarking framework with:
 * - Automated test execution
 * - Statistical analysis
 * - Memory leak detection
 * - Performance regression detection
 * - Configurable test scenarios
 */

import type {
  BenchmarkResult,
  PerformanceConfig,
  PerformanceBaseline
} from "../types/index.js";

export interface BenchmarkSuite {
  name: string;
  description: string;
  benchmarks: BenchmarkDefinition[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export interface BenchmarkDefinition {
  name: string;
  description: string;
  fn: () => Promise<any>;
  iterations?: number;
  warmup?: number;
  timeout?: number;
  memoryMeasurement?: boolean;
  tags?: string[];
}

export interface BenchmarkOptions {
  warmupRuns: number;
  measurementRuns: number;
  timeout: number;
  memoryMeasurement: boolean;
  iterationsPerRun?: number;
  parallel?: number;
  outputFormat?: 'json' | 'summary' | 'detailed';
}

/**
 * Advanced benchmark runner with comprehensive analysis
 */
export class BenchmarkRunner {
  private suites: Map<string, BenchmarkSuite> = new Map();
  private results: Map<string, BenchmarkResult[]> = new Map();
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private config: PerformanceConfig;

  constructor(config: PerformanceConfig) {
    this.config = config;
  }

  /**
   * Register a benchmark suite
   */
  registerSuite(suite: BenchmarkSuite): void {
    this.suites.set(suite.name, suite);
  }

  /**
   * Run all benchmark suites
   */
  async runAllSuites(options: Partial<BenchmarkOptions> = {}): Promise<{
    summary: BenchmarkSummary;
    results: Map<string, BenchmarkResult[]>;
  }> {
    const defaultOptions: BenchmarkOptions = {
      warmupRuns: options.warmupRuns ?? this.config.benchmarks.warmupRuns,
      measurementRuns: options.measurementRuns ?? this.config.benchmarks.measurementRuns,
      timeout: options.timeout ?? this.config.benchmarks.timeout,
      memoryMeasurement: options.memoryMeasurement ?? true,
      iterationsPerRun: options.iterationsPerRun ?? 10,
      parallel: options.parallel ?? 1,
      outputFormat: options.outputFormat ?? 'summary'
    };

    const allResults: Map<string, BenchmarkResult[]> = new Map();
    const summaryResults: Array<{
      suite: string;
      benchmark: string;
      result: BenchmarkResult;
    }> = [];

    for (const [suiteName, suite] of this.suites) {
      try {
        console.log(`Running suite: ${suiteName}`);

        // Setup suite
        if (suite.setup) {
          await suite.setup();
        }

        // Run benchmarks
        const suiteResults = await this.runSuite(suite, defaultOptions);

        // Teardown suite
        if (suite.teardown) {
          await suite.teardown();
        }

        allResults.set(suiteName, suiteResults);

        // Add to summary
        suiteResults.forEach(result => {
          summaryResults.push({
            suite: suiteName,
            benchmark: result.name,
            result
          });
        });

        console.log(`Suite ${suiteName} completed: ${suiteResults.length} benchmarks`);
      } catch (error) {
        console.error(`Error running suite ${suiteName}:`, error);
      }
    }

    const summary = this.createSummary(summaryResults);

    return {
      summary,
      results: allResults
    };
  }

  /**
   * Run a single benchmark suite
   */
  async runSuite(suite: BenchmarkSuite, options: BenchmarkOptions): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const benchmark of suite.benchmarks) {
      try {
        console.log(`  Running benchmark: ${benchmark.name}`);
        const result = await this.runBenchmark(benchmark, options);
        results.push(result);
      } catch (error) {
        console.error(`    Error running benchmark ${benchmark.name}:`, error);

        // Add failed benchmark result
        results.push({
          name: benchmark.name,
          timestamp: Date.now(),
          iterations: 0,
          totalTime: 0,
          averageTime: 0,
          minTime: 0,
          maxTime: 0,
          stdDev: 0,
          throughput: 0,
          memoryBefore: 0,
          memoryAfter: 0,
          memoryDelta: 0,
          errorRate: 1
        });
      }
    }

    return results;
  }

  /**
   * Run a single benchmark
   */
  async runBenchmark(
    benchmark: BenchmarkDefinition,
    options: BenchmarkOptions
  ): Promise<BenchmarkResult> {
    // Warmup phase
    const warmupIterations = benchmark.warmup || options.warmupRuns;
    for (let i = 0; i < warmupIterations; i++) {
      try {
        await benchmark.fn();
      } catch (error) {
        console.warn(`Warmup failed for ${benchmark.name}:`, error);
      }
    }

    // Memory measurement before
    let memoryBefore = 0;
    if (options.memoryMeasurement) {
      memoryBefore = this.getMemoryUsage();
    }

    // Measurement phase
    const measurementIterations = benchmark.iterations || options.iterationsPerRun!;
    const measurements: number[] = [];
    let errorCount = 0;

    const startTime = performance.now();

    for (let i = 0; i < measurementIterations; i++) {
      try {
        const iterStart = performance.now();
        await benchmark.fn();
        const iterEnd = performance.now();
        measurements.push(iterEnd - iterStart);
      } catch (error) {
        errorCount++;
        console.warn(`Iteration ${i} failed for ${benchmark.name}:`, error);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Memory measurement after
    let memoryAfter = 0;
    let memoryDelta = 0;
    if (options.memoryMeasurement) {
      memoryAfter = this.getMemoryUsage();
      memoryDelta = memoryAfter - memoryBefore;
    }

    // Calculate statistics
    const successfulMeasurements = measurements.length;
    const averageTime = successfulMeasurements > 0 ? totalTime / successfulMeasurements : 0;
    const minTime = successfulMeasurements > 0 ? Math.min(...measurements) : 0;
    const maxTime = successfulMeasurements > 0 ? Math.max(...measurements) : 0;
    const errorRate = measurementIterations > 0 ? errorCount / measurementIterations : 1;

    // Calculate standard deviation
    let stdDev = 0;
    if (successfulMeasurements > 1) {
      const mean = averageTime;
      const variance = measurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / successfulMeasurements;
      stdDev = Math.sqrt(variance);
    }

    // Calculate throughput
    const throughput = successfulMeasurements > 0 ? (successfulMeasurements / totalTime) * 1000 : 0;

    return {
      name: benchmark.name,
      timestamp: Date.now(),
      iterations: successfulMeasurements,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      stdDev,
      throughput,
      memoryBefore,
      memoryAfter,
      memoryDelta,
      errorRate
    };
  }

  /**
   * Compare current results with baseline
   */
  compareWithBaseline(
    suiteName: string,
    results: BenchmarkResult[],
    baselineName: string
  ): PerformanceComparison {
    const baseline = this.baselines.get(baselineName);
    if (!baseline) {
      throw new Error(`Baseline not found: ${baselineName}`);
    }

    const suiteBaseline = baseline.benchmarks.filter(b =>
      baseline.name === suiteName
    );

    const comparison: PerformanceComparison = {
      baselineName,
      suiteName,
      timestamp: Date.now(),
      benchmarks: [],
      overall: {
        throughputChange: 0,
        latencyChange: 0,
        memoryChange: 0,
        errorRateChange: 0,
        performanceScore: 0
      }
    };

    // Compare each benchmark
    results.forEach(result => {
      const baselineResult = suiteBaseline.find(b => b.name === result.name);
      if (baselineResult) {
        const benchmarkComparison = this.compareBenchmarkResults(result, baselineResult);
        comparison.benchmarks.push(benchmarkComparison);
      }
    });

    // Calculate overall metrics
    if (results.length > 0) {
      const baselineThroughput = suiteBaseline.reduce((sum, b) => sum + b.throughput, 0) / suiteBaseline.length;
      const currentThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;
      comparison.overall.throughputChange = ((currentThroughput - baselineThroughput) / baselineThroughput) * 100;

      const baselineAvgLatency = suiteBaseline.reduce((sum, b) => sum + b.averageTime, 0) / suiteBaseline.length;
      const currentAvgLatency = results.reduce((sum, r) => sum + r.averageTime, 0) / results.length;
      comparison.overall.latencyChange = ((currentAvgLatency - baselineAvgLatency) / baselineAvgLatency) * 100;

      const baselineMemory = suiteBaseline.reduce((sum, b) => sum + b.memoryDelta, 0) / suiteBaseline.length;
      const currentMemory = results.reduce((sum, r) => sum + r.memoryDelta, 0) / results.length;
      comparison.overall.memoryChange = ((currentMemory - baselineMemory) / baselineMemory) * 100;

      const baselineErrorRate = suiteBaseline.reduce((sum, b) => sum + b.errorRate, 0) / suiteBaseline.length;
      const currentErrorRate = results.reduce((sum, r) => sum + r.errorRate, 0) / results.length;
      comparison.overall.errorRateChange = ((currentErrorRate - baselineErrorRate) / baselineErrorRate) * 100;

      // Calculate performance score (0-100, higher is better)
      const scoreFactors = [
        Math.min(100, Math.max(0, 100 + comparison.overall.throughputChange)), // Throughput positive
        Math.max(0, 100 - Math.abs(comparison.overall.latencyChange)), // Latency negative
        Math.max(0, 100 - Math.abs(comparison.overall.memoryChange) / 2), // Memory slightly negative
        Math.max(0, 100 - comparison.overall.errorRateChange * 10) // Error rate very negative
      ];

      comparison.overall.performanceScore = scoreFactors.reduce((a, b) => a + b, 0) / scoreFactors.length;
    }

    return comparison;
  }

  /**
   * Create performance baseline
   */
  createBaseline(
    name: string,
    description?: string,
    systemInfo?: {
      cpu: number;
      memory: number;
      nodeVersion: string;
    }
  ): PerformanceBaseline {
    const results = Array.from(this.results.values()).flat();

    // Aggregate metrics
    const aggregated = this.aggregateResults(results);

    return {
      name,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'development',
      system: systemInfo || {
        cpu: require('os').cpus().length,
        memory: require('os').totalmem() / 1024 / 1024 / 1024, // GB
        nodeVersion: process.version
      },
      metrics: aggregated.metrics,
      benchmarks: results
    };
  }

  /**
   * Store baseline
   */
  storeBaseline(baseline: PerformanceBaseline): void {
    this.baselines.set(baseline.name, baseline);
    console.log(`Baseline stored: ${baseline.name}`);
  }

  /**
   * Get stored baselines
   */
  getBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values());
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(
    currentResults: BenchmarkResult[],
    baselineName: string
  ): RegressionReport {
    const comparison = this.compareWithBaseline('all', currentResults, baselineName);
    const regressions: Regression[] = [];

    comparison.benchmarks.forEach(benchmark => {
      if (benchmark.isRegression) {
        regressions.push({
          name: benchmark.name,
          type: benchmark.regressionType,
          severity: benchmark.severity,
          description: benchmark.description,
          metrics: {
            throughputChange: benchmark.throughputChange,
            latencyChange: benchmark.latencyChange,
            memoryChange: benchmark.memoryChange,
            errorRateChange: benchmark.errorRateChange
          }
        });
      }
    });

    return {
      baselineName,
      timestamp: Date.now(),
      totalBenchmarks: comparison.benchmarks.length,
      regressionCount: regressions.length,
      regressions,
      overallScore: comparison.overall.performanceScore
    };
  }

  // Private helper methods
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024; // Convert to MB
  }

  private createSummary(results: Array<{
    suite: string;
    benchmark: string;
    result: BenchmarkResult;
  }>): BenchmarkSummary {
    const summary: BenchmarkSummary = {
      totalBenchmarks: results.length,
      totalDuration: results.reduce((sum, r) => sum + r.result.totalTime, 0),
      averageThroughput: 0,
      averageLatency: 0,
      averageMemoryDelta: 0,
      averageErrorRate: 0,
      fastestBenchmark: null,
      slowestBenchmark: null,
      mostMemoryIntensive: null,
      errorProneBenchmark: null
    };

    if (results.length === 0) return summary;

    // Calculate averages
    summary.averageThroughput = results.reduce((sum, r) => sum + r.result.throughput, 0) / results.length;
    summary.averageLatency = results.reduce((sum, r) => sum + r.result.averageTime, 0) / results.length;
    summary.averageMemoryDelta = results.reduce((sum, r) => sum + r.result.memoryDelta, 0) / results.length;
    summary.averageErrorRate = results.reduce((sum, r) => sum + r.result.errorRate, 0) / results.length;

    // Find extremes
    summary.fastestBenchmark = results.reduce((prev, curr) =>
      curr.result.throughput > (prev?.result.throughput || 0) ? curr : prev
    );

    summary.slowestBenchmark = results.reduce((prev, curr) =>
      curr.result.throughput < (prev?.result.throughput || Infinity) ? curr : prev
    );

    summary.mostMemoryIntensive = results.reduce((prev, curr) =>
      Math.abs(curr.result.memoryDelta) > Math.abs(prev?.result.memoryDelta || 0) ? curr : prev
    );

    summary.errorProneBenchmark = results.reduce((prev, curr) =>
      curr.result.errorRate > (prev?.result.errorRate || 0) ? curr : prev
    );

    return summary;
  }

  private compareBenchmarkResults(
    current: BenchmarkResult,
    baseline: BenchmarkResult
  ): BenchmarkComparison {
    const throughputChange = ((current.throughput - baseline.throughput) / baseline.throughput) * 100;
    const latencyChange = ((current.averageTime - baseline.averageTime) / baseline.averageTime) * 100;
    const memoryChange = ((current.memoryDelta - baseline.memoryDelta) / baseline.memoryDelta) * 100;
    const errorRateChange = ((current.errorRate - baseline.errorRate) / baseline.errorRate) * 100;

    // Determine if this is a regression
    const isRegression = throughputChange < -10 || latencyChange > 20 || errorRateChange > 50;
    const regressionType: RegressionType =
      throughputChange < -10 ? 'throughput' :
      latencyChange > 20 ? 'latency' :
      errorRateChange > 50 ? 'error' :
      memoryChange > 100 ? 'memory' : null;

    const severity = Math.max(
      Math.abs(throughputChange),
      Math.abs(latencyChange),
      Math.abs(errorRateChange * 10),
      Math.abs(memoryChange)
    );

    return {
      name: current.name,
      baseline,
      current,
      throughputChange,
      latencyChange,
      memoryChange,
      errorRateChange,
      isRegression,
      regressionType,
      severity,
      description: this.generateRegressionDescription(
        isRegression, regressionType, throughputChange, latencyChange
      )
    };
  }

  private generateRegressionDescription(
    isRegression: boolean,
    type: RegressionType | null,
    throughputChange: number,
    latencyChange: number
  ): string {
    if (!isRegression) {
      return 'Performance meets or exceeds baseline';
    }

    switch (type) {
      case 'throughput':
        return `Throughput decreased by ${throughputChange.toFixed(1)}%`;
      case 'latency':
        return `Latency increased by ${latencyChange.toFixed(1)}%`;
      case 'error':
        return 'Error rate increased significantly';
      case 'memory':
        return 'Memory usage increased significantly';
      default:
        return 'Performance regression detected';
    }
  }

  private aggregateResults(results: BenchmarkResult[]): {
    metrics: {
      latency: any;
      throughput: number;
      cpu: any;
      memory: any;
    };
  } {
    if (results.length === 0) {
      return {
        metrics: {
          latency: { p50: 0, p90: 0, p95: 0, p99: 0 },
          throughput: 0,
          cpu: { usage: 0 },
          memory: { heapUsed: 0, heapTotal: 0 }
        }
      };
    }

    // Calculate latency percentiles
    const latencies = results.map(r => r.averageTime).sort((a, b) => a - b);
    const latencyMetrics = {
      p50: latencies[Math.floor(latencies.length * 0.5)],
      p90: latencies[Math.floor(latencies.length * 0.9)],
      p95: latencies[Math.floor(latencies.length * 0.95)],
      p99: latencies[Math.floor(latencies.length * 0.99)]
    };

    // Average throughput
    const throughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;

    return {
      metrics: {
        latency: latencyMetrics,
        throughput,
        cpu: { usage: 0 }, // Would need CPU metrics
        memory: {
          heapUsed: results.reduce((sum, r) => sum + r.memoryAfter, 0) / results.length,
          heapTotal: 1024 // Default
        }
      }
    };
  }
}

// Type definitions
export interface BenchmarkSummary {
  totalBenchmarks: number;
  totalDuration: number;
  averageThroughput: number;
  averageLatency: number;
  averageMemoryDelta: number;
  averageErrorRate: number;
  fastestBenchmark: Array<{
    suite: string;
    benchmark: string;
    result: BenchmarkResult;
  }> | null;
  slowestBenchmark: Array<{
    suite: string;
    benchmark: string;
    result: BenchmarkResult;
  }> | null;
  mostMemoryIntensive: Array<{
    suite: string;
    benchmark: string;
    result: BenchmarkResult;
  }> | null;
  errorProneBenchmark: Array<{
    suite: string;
    benchmark: string;
    result: BenchmarkResult;
  }> | null;
}

export interface PerformanceComparison {
  baselineName: string;
  suiteName: string;
  timestamp: number;
  benchmarks: BenchmarkComparison[];
  overall: {
    throughputChange: number;
    latencyChange: number;
    memoryChange: number;
    errorRateChange: number;
    performanceScore: number;
  };
}

export interface BenchmarkComparison {
  name: string;
  baseline: BenchmarkResult;
  current: BenchmarkResult;
  throughputChange: number;
  latencyChange: number;
  memoryChange: number;
  errorRateChange: number;
  isRegression: boolean;
  regressionType: RegressionType | null;
  severity: number;
  description: string;
}

export interface RegressionReport {
  baselineName: string;
  timestamp: number;
  totalBenchmarks: number;
  regressionCount: number;
  regressions: Regression[];
  overallScore: number;
}

export interface Regression {
  name: string;
  type: RegressionType;
  severity: number;
  description: string;
  metrics: {
    throughputChange: number;
    latencyChange: number;
    memoryChange: number;
    errorRateChange: number;
  };
}

export type RegressionType = 'throughput' | 'latency' | 'error' | 'memory' | null;