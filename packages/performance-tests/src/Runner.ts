/**
 * @lsi/performance-tests
 *
 * Benchmark Runner with configurable options and statistics collection.
 * Provides warmup, measurement phases, and result export capabilities.
 */

import { Bench, Task } from "tinybench";

/**
 * Benchmark configuration options
 */
export interface BenchmarkConfig {
  /** Duration in milliseconds to run each benchmark */
  time?: number;
  /** Number of iterations to run */
  iterations?: number;
  /** Whether to run warmup phase */
  warmup?: boolean;
  /** Number of warmup iterations */
  warmupIterations?: number;
  /** Whether to setup and teardown functions */
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
}

/**
 * Statistics for a single benchmark task
 */
export interface BenchmarkStats {
  /** Task name */
  name: string;
  /** Mean execution time (ms) */
  mean: number;
  /** Minimum execution time (ms) */
  min: number;
  /** Maximum execution time (ms) */
  max: number;
  /** Standard deviation (ms) */
  sd: number;
  /** 95th percentile (ms) */
  p95: number;
  /** 99th percentile (ms) */
  p99: number;
  /** Samples per second */
  hz: number;
  /** Total iterations */
  samples: number;
  /** Error if task failed */
  error?: string;
}

/**
 * Memory usage snapshot
 */
export interface MemorySnapshot {
  /** Heap used in bytes */
  heapUsed: number;
  /** Heap total in bytes */
  heapTotal: number;
  /** RSS in bytes */
  rss: number;
  /** External memory in bytes */
  external: number;
  /** Array buffers in bytes */
  arrayBuffers: number;
}

/**
 * Complete benchmark result
 */
export interface BenchmarkResult {
  /** Benchmark suite name */
  name: string;
  /** Timestamp when benchmark was run */
  timestamp: Date;
  /** Node version */
  nodeVersion: string;
  /** Platform information */
  platform: string;
  /** CPU architecture */
  arch: string;
  /** CPU info */
  cpuModel: string;
  /** Number of CPUs */
  cpuCount: number;
  /** Total memory in GB */
  totalMemory: number;
  /** Individual task results */
  tasks: BenchmarkStats[];
  /** Memory before benchmarks */
  memoryBefore: MemorySnapshot;
  /** Memory after benchmarks */
  memoryAfter: MemorySnapshot;
  /** Total duration (ms) */
  totalDuration: number;
}

/**
 * Performance tracker for benchmark execution
 */
export class PerformanceTracker {
  private results: Map<string, BenchmarkResult> = new Map();
  private config: BenchmarkConfig;

  constructor(config: BenchmarkConfig = {}) {
    this.config = {
      time: 1000,
      iterations: 100,
      warmup: true,
      warmupIterations: 10,
      ...config,
    };
  }

  /**
   * Run a benchmark suite with the given tasks
   */
  async runBenchmark(
    name: string,
    tasks: Record<string, () => void | Promise<void>>,
    config?: BenchmarkConfig
  ): Promise<BenchmarkResult> {
    const benchmarkConfig = { ...this.config, ...config };

    // Capture initial state
    const memoryBefore = this.captureMemory();
    const startTime = Date.now();

    // Create benchmark instance
    const bench = new Bench({
      time: benchmarkConfig.time,
      iterations: benchmarkConfig.iterations,
      warmup: benchmarkConfig.warmup,
      warmupIterations: benchmarkConfig.warmupIterations,
      setup: benchmarkConfig.setup,
      teardown: benchmarkConfig.teardown,
    });

    // Add tasks
    for (const [taskName, taskFn] of Object.entries(tasks)) {
      bench.add(taskName, taskFn);
    }

    // Run benchmarks
    await bench.run();

    const endTime = Date.now();
    const memoryAfter = this.captureMemory();

    // Extract results
    const taskResults: BenchmarkStats[] = bench.tasks.map(
      this.extractTaskStats
    );

    const result: BenchmarkResult = {
      name,
      timestamp: new Date(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: process.arch, // Note: More detailed CPU info requires additional deps
      cpuCount: require("os").cpus().length,
      totalMemory: require("os").totalmem() / 1024 ** 3,
      tasks: taskResults,
      memoryBefore,
      memoryAfter,
      totalDuration: endTime - startTime,
    };

    this.results.set(name, result);
    return result;
  }

  /**
   * Extract statistics from a tinybench Task
   */
  private extractTaskStats(task: Task): BenchmarkStats {
    const result = task.result;

    if (!result) {
      return {
        name: task.name,
        mean: 0,
        min: 0,
        max: 0,
        sd: 0,
        p95: 0,
        p99: 0,
        hz: 0,
        samples: 0,
        error: task.result?.error?.message || "No results",
      };
    }

    return {
      name: task.name,
      mean: result.mean,
      min: result.min,
      max: result.max,
      sd: result.sd,
      p95: result.p95,
      p99: result.p99,
      hz: result.hz,
      samples: result.samples,
    };
  }

  /**
   * Capture current memory usage
   */
  private captureMemory(): MemorySnapshot {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
    };
  }

  /**
   * Get a stored benchmark result
   */
  getResult(name: string): BenchmarkResult | undefined {
    return this.results.get(name);
  }

  /**
   * Get all stored results
   */
  getAllResults(): BenchmarkResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Export results as JSON
   */
  exportJSON(result?: BenchmarkResult): string {
    const data = result ? [result] : this.getAllResults();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export results as Markdown table
   */
  exportMarkdown(result: BenchmarkResult): string {
    const lines: string[] = [];

    lines.push(`# ${result.name} Benchmark Results`);
    lines.push("");
    lines.push(`**Timestamp:** ${result.timestamp.toISOString()}`);
    lines.push(`**Node Version:** ${result.nodeVersion}`);
    lines.push(`**Platform:** ${result.platform} (${result.arch})`);
    lines.push(`**CPU:** ${result.cpuModel} (${result.cpuCount} cores)`);
    lines.push(`**Memory:** ${result.totalMemory.toFixed(2)} GB`);
    lines.push(`**Duration:** ${result.totalDuration}ms`);
    lines.push("");

    // Memory usage
    const heapBeforeMB = result.memoryBefore.heapUsed / (1024 * 1024);
    const heapAfterMB = result.memoryAfter.heapUsed / (1024 * 1024);
    const heapDeltaMB = heapAfterMB - heapBeforeMB;

    lines.push("## Memory Usage");
    lines.push("");
    lines.push(`| Metric | Before | After | Delta |`);
    lines.push(`|--------|--------|-------|-------|`);
    lines.push(
      `| Heap Used | ${heapBeforeMB.toFixed(2)} MB | ${heapAfterMB.toFixed(2)} MB | ${heapDeltaMB >= 0 ? "+" : ""}${heapDeltaMB.toFixed(2)} MB |`
    );
    lines.push("");

    // Task results
    lines.push("## Benchmark Tasks");
    lines.push("");
    lines.push(
      "| Task | Mean (ms) | Min (ms) | Max (ms) | SD (ms) | P95 (ms) | P99 (ms) | Ops/sec |"
    );
    lines.push(
      "|------|-----------|----------|----------|---------|----------|----------|---------|"
    );

    for (const task of result.tasks) {
      lines.push(
        `| ${task.name} | ${task.mean.toFixed(4)} | ${task.min.toFixed(4)} | ` +
          `${task.max.toFixed(4)} | ${task.sd.toFixed(4)} | ${task.p95.toFixed(4)} | ` +
          `${task.p99.toFixed(4)} | ${task.hz.toFixed(2)} |`
      );
    }

    lines.push("");

    // Errors
    const errors = result.tasks.filter(t => t.error);
    if (errors.length > 0) {
      lines.push("## Errors");
      lines.push("");
      for (const task of errors) {
        lines.push(`### ${task.name}`);
        lines.push(`\`\`\``);
        lines.push(task.error);
        lines.push(`\`\`\``);
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Save results to file
   */
  async saveToFile(filepath: string, result?: BenchmarkResult): Promise<void> {
    const fs = await import("fs/promises");
    const json = this.exportJSON(result);
    await fs.writeFile(filepath, json, "utf-8");
  }

  /**
   * Load results from file
   */
  async loadFromFile(filepath: string): Promise<BenchmarkResult[]> {
    const fs = await import("fs/promises");
    const content = await fs.readFile(filepath, "utf-8");
    const results = JSON.parse(content) as BenchmarkResult[];

    // Parse timestamp strings back to Date objects
    for (const result of results) {
      result.timestamp = new Date(result.timestamp);
      this.results.set(result.name, result);
    }

    return results;
  }

  /**
   * Clear all stored results
   */
  clear(): void {
    this.results.clear();
  }
}

/**
 * Create a performance tracker with default configuration
 */
export function createTracker(config?: BenchmarkConfig): PerformanceTracker {
  return new PerformanceTracker(config);
}
