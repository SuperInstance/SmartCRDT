/**
 * Performance Optimizer - Main orchestrator class
 *
 * Coordinates all performance optimization components:
 * - Profiling operations
 * - Bottleneck detection
 * - Optimization suggestions
 * - Benchmarking
 * - Performance monitoring
 */

import { PerformanceProfiler } from "./profiler/index.js";
import { BottleneckDetector } from "./optimizer/BottleneckDetector.js";
import { OptimizationSuggestionEngine } from "./optimizer/OptimizationSuggestionEngine.js";
import { BenchmarkRunner } from "./benchmarks/BenchmarkRunner.js";
import { PerformanceMetrics, MetricsAggregator } from "./metrics/index.js";
import type {
  PerformanceReport,
  PerformanceConfig,
  Bottleneck,
  OptimizationSuggestion,
  BenchmarkResult,
  PerformanceBaseline,
  PerformanceAlert
} from "./types/index.js";

/**
 * Main performance optimization orchestrator
 */
export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private profiler: PerformanceProfiler;
  private bottleneckDetector: BottleneckDetector;
  private suggestionEngine: OptimizationSuggestionEngine;
  private benchmarkRunner: BenchmarkRunner;
  private metrics: PerformanceMetrics;
  private metricsAggregator: MetricsAggregator;

  private isActive: boolean = false;
  private operations: Map<string, {
    startTime: number;
    profiler: PerformanceProfiler;
    completed: boolean;
    metricsInterval?: NodeJS.Timeout;
  }> = new Map();

  /**
   * Create a new PerformanceOptimizer instance
   */
  constructor(config?: Partial<PerformanceConfig>) {
    // Initialize with default config if none provided
    this.config = this.mergeWithDefaultConfig(config);

    // Initialize all components
    this.profiler = new PerformanceProfiler();
    this.bottleneckDetector = new BottleneckDetector();
    this.bottleneckDetector.setSensitivity(this.config.benchmarkSensitivity);
    this.suggestionEngine = new OptimizationSuggestionEngine(this.config);
    this.benchmarkRunner = new BenchmarkRunner(this.config);
    this.metrics = new PerformanceMetrics();
    this.metricsAggregator = new MetricsAggregator(this.config.memoryHistoryWindow * 60 * 1000);
  }

  /**
   * Start profiling an operation
   */
  async startOperation(operationName: string): Promise<void> {
    if (this.operations.has(operationName)) {
      throw new Error(`Operation already in progress: ${operationName}`);
    }

    console.log(`Starting performance profiling for: ${operationName}`);

    // Create a new profiler for this operation
    const operationProfiler = new PerformanceProfiler();
    await operationProfiler.start(operationName);

    this.operations.set(operationName, {
      startTime: Date.now(),
      profiler: operationProfiler,
      completed: false
    });

    this.isActive = true;

    // Start metrics collection
    this.metrics.start(operationName);

    // Start continuous metrics aggregation
    this.startMetricsAggregation(operationName);
  }

  /**
   * Profile an operation and return performance report
   */
  async profileOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<{
    result: T;
    report: PerformanceReport;
  }> {
    if (!this.operations.has(operationName)) {
      throw new Error(`Operation not started: ${operationName}. Call startOperation() first.`);
    }

    const operationEntry = this.operations.get(operationName)!;

    try {
      // Capture metrics before operation
      const memoryBefore = this.profiler.captureMemorySnapshot(operationName);
      const cpuBefore = this.profiler.captureCpuSnapshot(operationName);

      // Execute the operation
      const startTime = performance.now();
      const result = await operation();
      const endTime = performance.now();

      // Capture metrics after operation
      const latency = endTime - startTime;
      this.profiler.recordLatency(operationName, latency);

      const memoryAfter = this.profiler.captureMemorySnapshot(operationName);
      const cpuAfter = this.profiler.captureCpuSnapshot(operationName);

      // Get operation metrics
      const operationMetrics = this.metrics.getSummary();

      // Detect bottlenecks
      const bottlenecks = this.bottleneckDetector.detectBottlenecks(
        operationMetrics.cpu,
        operationMetrics.memory,
        operationMetrics.latency[operationName] || null
      );

      // Generate optimization suggestions
      const suggestions = this.suggestionEngine.generateSuggestions(
        bottlenecks,
        {
          environment: process.env.NODE_ENV || 'development',
          loadLevel: this.estimateLoadLevel(),
          architecture: 'microservices'
        }
      );

      // Calculate overall performance score
      const overallScore = this.calculateOverallScore(operationMetrics, bottlenecks);

      // Generate performance report
      const report: PerformanceReport = {
        timestamp: Date.now(),
        reportId: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        overallScore,
        metrics: {
          cpu: operationMetrics.cpu!,
          memory: operationMetrics.memory!,
          latency: operationMetrics.latency[operationName]!,
          throughput: operationMetrics.throughput[operationName] || 0,
          errorRate: operationMetrics.errorRate[operationName] || 0
        },
        bottlenecks,
        suggestions,
        context: {
          environment: process.env.NODE_ENV || 'development',
          load: this.estimateLoadLevel(),
          duration: latency,
          operations: 1
        }
      };

      return {
        result,
        report
      };

    } catch (error) {
      console.error(`Error profiling operation ${operationName}:`, error);

      // Generate error report
      const errorReport: PerformanceReport = {
        timestamp: Date.now(),
        reportId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        overallScore: 0,
        metrics: {
          cpu: { usage: 0, cores: 0, breakdown: { user: 0, system: 0, idle: 0, iowait: 0 }, spikes: [] },
          memory: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, history: [] },
          latency: { total: 0, queue: 0, processing: 0, io: 0, network: 0, p50: 0, p90: 0, p95: 0, p99: 0, stdDev: 0 },
          throughput: 0,
          errorRate: 1
        },
        bottlenecks: [],
        suggestions: [
          {
            type: 'code',
            priority: 10,
            estimatedImpact: 0.8,
            difficulty: 3,
            problem: 'Operation failed to execute',
            solution: 'Handle errors and implement retry logic',
            sideEffects: ['Requires error handling implementation']
          }
        ],
        context: {
          environment: process.env.NODE_ENV || 'development',
          load: this.estimateLoadLevel(),
          duration: 0,
          operations: 0
        }
      };

      return {
        result: null as any,
        report: errorReport
      };
    }
  }

  /**
   * Stop profiling an operation
   */
  async stopOperation(operationName: string): Promise<{
    report: PerformanceReport;
    duration: number;
  }> {
    if (!this.operations.has(operationName)) {
      throw new Error(`Operation not found: ${operationName}`);
    }

    const operationEntry = this.operations.get(operationName)!;

    if (operationEntry.completed) {
      throw new Error(`Operation already completed: ${operationName}`);
    }

    // Stop profiler
    await operationEntry.profiler.stop(operationName);

    // Stop metrics interval
    if (operationEntry.metricsInterval) {
      clearInterval(operationEntry.metricsInterval);
    }

    // Stop metrics collection
    this.metrics.stop(operationName);

    // Remove from active operations
    this.operations.delete(operationName);

    // Check if we have any active operations left
    this.isActive = this.operations.size > 0;

    console.log(`Performance profiling completed for: ${operationName}`);

    // Get aggregated metrics
    const metrics = this.metrics.getSummary();

    // Detect bottlenecks
    const bottlenecks = this.bottleneckDetector.detectBottlenecks(
      metrics.cpu,
      metrics.memory,
      metrics.latency[operationName] || null
    );

    // Generate suggestions
    const suggestions = this.suggestionEngine.generateSuggestions(bottlenecks, {
      environment: process.env.NODE_ENV || 'development',
      loadLevel: this.estimateLoadLevel()
    });

    // Calculate score
    const overallScore = this.calculateOverallScore(metrics, bottlenecks);

    const report: PerformanceReport = {
      timestamp: Date.now(),
      reportId: `perf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      overallScore,
      metrics: {
        cpu: metrics.cpu!,
        memory: metrics.memory!,
        latency: metrics.latency[operationName]!,
        throughput: metrics.throughput[operationName] || 0,
        errorRate: metrics.errorRate[operationName] || 0
      },
      bottlenecks,
      suggestions,
      context: {
        environment: process.env.NODE_ENV || 'development',
        load: this.estimateLoadLevel(),
        duration: Date.now() - operationEntry.startTime,
        operations: 1
      }
    };

    return {
      report,
      duration: Date.now() - operationEntry.startTime
    };
  }

  /**
   * Run benchmarks
   */
  async runBenchmarks(
    suites: Array<{
      name: string;
      description: string;
      benchmarks: Array<{
        name: string;
        description: string;
        fn: () => Promise<any>;
        iterations?: number;
        warmup?: number;
      }>;
      setup?: () => Promise<void>;
      teardown?: () => Promise<void>;
    }>
  ): Promise<{
    summary: any;
    results: Map<string, BenchmarkResult[]>;
  }> {
    // Register benchmark suites
    suites.forEach(suite => {
      this.benchmarkRunner.registerSuite({
        name: suite.name,
        description: suite.description,
        benchmarks: suite.benchmarks.map(b => ({
          name: b.name,
          description: b.description,
          fn: b.fn,
          iterations: b.iterations,
          warmup: b.warmup
        })),
        setup: suite.setup,
        teardown: suite.teardown
      });
    });

    // Run benchmarks
    return this.benchmarkRunner.runAllSuites();
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
    const baseline = this.benchmarkRunner.createBaseline(name, description, systemInfo);
    this.benchmarkRunner.storeBaseline(baseline);
    return baseline;
  }

  /**
   * Compare performance with baseline
   */
  compareWithBaseline(
    currentResults: BenchmarkResult[],
    baselineName: string
  ): any {
    return this.benchmarkRunner.compareWithBaseline('all', currentResults, baselineName);
  }

  /**
   * Detect performance regressions
   */
  detectRegressions(
    currentResults: BenchmarkResult[],
    baselineName: string
  ): any {
    return this.benchmarkRunner.detectRegressions(currentResults, baselineName);
  }

  /**
   * Get performance metrics summary
   */
  getMetricsSummary(): any {
    return this.metrics.getSummary();
  }

  /**
   * Get active operations
   */
  getActiveOperations(): string[] {
    return Array.from(this.operations.keys());
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = this.mergeWithDefaultConfig(newConfig);

    // Update components with new config
    this.bottleneckDetector.setSensitivity(this.config.benchmarkSensitivity);
    this.suggestionEngine.updateConfig(this.config);
    this.benchmarkRunner = new BenchmarkRunner(this.config);
  }

  /**
   * Get optimizer status
   */
  getStatus(): {
    isActive: boolean;
    activeOperations: string[];
    config: PerformanceConfig;
  } {
    return {
      isActive: this.isActive,
      activeOperations: this.getActiveOperations(),
      config: this.config
    };
  }

  /**
   * Stop all operations and clean up
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down PerformanceOptimizer...');

    // Stop all active operations
    for (const operationName of this.getActiveOperations()) {
      try {
        await this.stopOperation(operationName);
      } catch (error) {
        console.error(`Error stopping operation ${operationName}:`, error);
      }
    }

    // Clear all metrics
    this.metrics.clear();
    this.metricsAggregator.clear();

    console.log('PerformanceOptimizer shutdown complete');
  }

  // Private helper methods
  private mergeWithDefaultConfig(config?: Partial<PerformanceConfig>): PerformanceConfig {
    const defaultConfig: PerformanceConfig = {
      enableCpuProfiling: true,
      enableMemoryProfiling: true,
      memoryHistoryWindow: 60,
      cpuSpikeThreshold: 90,
      memoryLeakThreshold: 1,
      bottleneckSensitivity: 5,
      suggestionPriorityThreshold: 3,
      maxSuggestions: 10,
      benchmarks: {
        warmupRuns: 3,
        measurementRuns: 10,
        timeout: 5000
      },
      targets: {
        latencyTarget: 100,
        memoryTarget: 600,
        cpuTarget: 80,
        errorRateTarget: 1
      }
    };

    return { ...defaultConfig, ...config };
  }

  private estimateLoadLevel(): 'low' | 'medium' | 'high' | 'peak' {
    const metrics = this.metrics.getSummary();
    const cpuUsage = metrics.cpu?.usage || 0;
    const memoryUsage = (metrics.memory?.heapUsed || 0) / (metrics.memory?.heapTotal || 1) * 100;

    if (cpuUsage > 90 || memoryUsage > 90) return 'peak';
    if (cpuUsage > 70 || memoryUsage > 70) return 'high';
    if (cpuUsage > 40 || memoryUsage > 40) return 'medium';
    return 'low';
  }

  private calculateOverallScore(metrics: any, bottlenecks: Bottleneck[]): number {
    if (!metrics.cpu || !metrics.memory || !metrics.latency) {
      return 0;
    }

    // Calculate component scores (0-100)
    const cpuScore = Math.max(0, 100 - (metrics.cpu.usage / 100) * 100);
    const memoryScore = Math.max(0, 100 - (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100);
    const latencyScore = Math.max(0, 100 - (metrics.latency.p95 / 1000) * 100); // Assuming 1000ms is bad
    const errorScore = metrics.errorRate ? Math.max(0, 100 - metrics.errorRate * 100) : 100;

    // Weighted average
    const weights = {
      cpu: 0.25,
      memory: 0.25,
      latency: 0.4,
      errors: 0.1
    };

    const rawScore =
      cpuScore * weights.cpu +
      memoryScore * weights.memory +
      latencyScore * weights.latency +
      errorScore * weights.errors;

    // Apply bottleneck penalty
    const bottleneckPenalty = bottlenecks.reduce((penalty, bottleneck) => {
      return penalty + (bottleneck.severity / 10) * 20; // Up to 20% penalty per bottleneck
    }, 0);

    return Math.max(0, Math.min(100, rawScore - bottleneckPenalty));
  }

  private startMetricsAggregation(operationName: string): void {
    const interval = setInterval(() => {
      try {
        const metrics = this.metrics.getSummary();

        // Aggregate metrics
        this.metricsAggregator.add(Date.now(), {
          cpu: metrics.cpu?.usage || 0,
          memory: metrics.memory?.heapUsed || 0,
          latency: metrics.latency[operationName]?.p95 || 0,
          errorRate: metrics.errorRate[operationName] || 0
        });

        // Check for alerts
        const alerts = this.metrics.checkThresholds(operationName);
        if (alerts.length > 0) {
          console.log(`Performance alerts for ${operationName}:`, alerts);
        }

      } catch (error) {
        console.error('Error in metrics aggregation:', error);
      }
    }, 5000); // Every 5 seconds

    // Store interval ID to cleanup later
    if (!this.operations.get(operationName)) {
      this.operations.set(operationName, {
        startTime: Date.now(),
        profiler: this.profiler,
        completed: false
      });
    }
    this.operations.get(operationName)!.metricsInterval = interval;
  }
}