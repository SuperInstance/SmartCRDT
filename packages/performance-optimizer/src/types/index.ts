/**
 * Performance Optimization Suite - Type Definitions
 *
 * Core types for performance profiling, optimization, and benchmarking
 */

import type { BaseResult } from "@lsi/protocol";
import type { MemorySnapshot, CpuSnapshot, LatencySnapshot } from "./snapshots.js";

/**
 * Latency metrics with detailed breakdown
 */
export interface LatencyMetrics {
  /** Total time from request to response (ms) */
  total: number;
  /** Time spent in queue (ms) */
  queue: number;
  /** Time spent processing (ms) */
  processing: number;
  /** Time waiting for I/O (ms) */
  io: number;
  /** Time spent in network requests (ms) */
  network: number;

  /** Percentiles (ms) */
  p50: number;
  p90: number;
  p95: number;
  p99: number;

  /** Standard deviation (ms) */
  stdDev: number;
}

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  /** Current heap used (MB) */
  heapUsed: number;
  /** Heap total allocated (MB) */
  heapTotal: number;
  /** External memory usage (MB) */
  external: number;
  /** RSS memory (MB) */
  rss: number;

  /** Memory usage history for trend analysis */
  history: Array<{
    timestamp: number;
    heapUsed: number;
    heapTotal: number;
  }>;

  /** Memory leak detection */
  leak?: {
    suspected: boolean;
    ratePerMinute: number;
    suspiciousObjects: string[];
  };
}

/**
 * CPU usage metrics
 */
export interface CpuMetrics {
  /** CPU usage percentage (0-100) */
  usage: number;
  /** Number of CPU cores */
  cores: number;

  /** CPU time distribution */
  breakdown: {
    user: number;
    system: number;
    idle: number;
    iowait: number;
  };

  /** CPU spikes detection */
  spikes: Array<{
    timestamp: number;
    usage: number;
    duration: number;
  }>;
}

/**
 * Performance bottleneck classification
 */
export interface Bottleneck {
  /** Type of bottleneck */
  type: 'cpu' | 'memory' | 'io' | 'network' | 'lock' | 'algorithm';

  /** Severity level (1-10) */
  severity: number;

  /** Location in code (if known) */
  location?: string;

  /** Description of the bottleneck */
  description: string;

  /** Impact score (0-1) */
  impact: number;

  /** Confidence in detection (0-1) */
  confidence: number;

  /** Metrics that triggered this detection */
  metrics: Record<string, number>;

  /** Duration of the bottleneck */
  duration?: number;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  /** Type of optimization */
  type: 'code' | 'config' | 'architecture' | 'hardware' | 'caching';

  /** Priority (1-10) */
  priority: number;

  /** Estimated impact (performance improvement percentage) */
  estimatedImpact: number;

  /** Implementation difficulty (1-10) */
  difficulty: number;

  /** Description of the issue */
  problem: string;

  /** Recommended solution */
  solution: string;

  /** Code snippet or configuration example */
  example?: string;

  /** Dependencies or side effects */
  sideEffects?: string[];

  /** Estimated time to implement */
  estimatedTime?: string;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  /** Report timestamp */
  timestamp: number;

  /** Unique report ID */
  reportId: string;

  /** Overall performance score (0-100) */
  overallScore: number;

  /** System metrics */
  metrics: {
    cpu: CpuMetrics;
    memory: MemoryMetrics;
    latency: LatencyMetrics;
    throughput: number;
    errorRate: number;
  };

  /** Detected bottlenecks */
  bottlenecks: Bottleneck[];

  /** Optimization suggestions */
  suggestions: OptimizationSuggestion[];

  /** System context */
  context: {
    environment: 'development' | 'staging' | 'production';
    load: 'low' | 'medium' | 'high' | 'peak';
    duration: number;
    operations: number;
  };
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  /** Enable CPU profiling */
  enableCpuProfiling: boolean;

  /** Enable memory profiling */
  enableMemoryProfiling: boolean;

  /** Memory history window size (minutes) */
  memoryHistoryWindow: number;

  /** CPU spike detection threshold */
  cpuSpikeThreshold: number;

  /** Memory leak detection threshold */
  memoryLeakThreshold: number;

  /** Bottleneck detection sensitivity (1-10) */
  bottleneckSensitivity: number;

  /** Optimization suggestion priority threshold */
  suggestionPriorityThreshold: number;

  /** Maximum number of suggestions to generate */
  maxSuggestions: number;

  /** Benchmark configuration */
  benchmarks: {
    /** Number of warmup runs */
    warmupRuns: number;
    /** Number of measurement runs */
    measurementRuns: number;
    /** Timeout for individual benchmarks (ms) */
    timeout: number;
  };

  /** Performance targets */
  targets: {
    /** Target latency (ms) */
    latencyTarget: number;
    /** Target memory usage (MB) */
    memoryTarget: number;
    /** Target CPU usage (%) */
    cpuTarget: number;
    /** Target error rate (%) */
    errorRateTarget: number;
  };
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  /** Benchmark name */
  name: string;

  /** Benchmark timestamp */
  timestamp: number;

  /** Number of iterations */
  iterations: number;

  /** Total time (ms) */
  totalTime: number;

  /** Average time per iteration (ms) */
  averageTime: number;

  /** Minimum time (ms) */
  minTime: number;

  /** Maximum time (ms) */
  maxTime: number;

  /** Standard deviation (ms) */
  stdDev: number;

  /** Throughput (ops/sec) */
  throughput: number;

  /** Memory usage before (MB) */
  memoryBefore: number;

  /** Memory usage after (MB) */
  memoryAfter: number;

  /** Memory delta (MB) */
  memoryDelta: number;

  /** Error rate (0-1) */
  errorRate: number;
}

/**
 * Performance baseline
 */
export interface PerformanceBaseline {
  /** Baseline name */
  name: string;

  /** Creation timestamp */
  timestamp: number;

  /** Environment */
  environment: string;

  /** System configuration */
  system: {
    cpu: number;
    memory: number;
    nodeVersion: string;
  };

  /** Performance metrics */
  metrics: {
    latency: LatencyMetrics;
    throughput: number;
    cpu: CpuMetrics;
    memory: MemoryMetrics;
  };

  /** Benchmark results */
  benchmarks: BenchmarkResult[];
}

/**
 * Performance threshold configuration
 */
export interface PerformanceThreshold {
  /** Metric name */
  metric: string;

  /** Warning threshold */
  warning: number;

  /** Critical threshold */
  critical: number;

  /** Comparison operator ('>', '<', '>=', '<=') */
  operator: 'gt' | 'lt' | 'gte' | 'lte';

  /** Alert message template */
  message: string;
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  /** Alert ID */
  id: string;

  /** Alert timestamp */
  timestamp: number;

  /** Alert type */
  type: 'warning' | 'critical';

  /** Affected metric */
  metric: string;

  /** Current value */
  value: number;

  /** Threshold that was crossed */
  threshold: PerformanceThreshold;

  /** Alert message */
  message: string;

  /** Recommended action */
  action?: string;
}