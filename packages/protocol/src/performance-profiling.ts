/**
 * Performance Profiling Protocol Types
 *
 * Comprehensive types for performance profiling, benchmarking, and optimization:
 * - CPU profiling with flame graphs
 * - Memory profiling with allocation tracking
 * - Latency tracking with percentiles
 * - Throughput measurement
 * - Hot path identification
 * - Memory leak detection
 * - Report generation (JSON/HTML)
 *
 * @module @lsi/protocol/performance-profiling
 */

// ============================================================================
// CORE PROFILING TYPES
// ============================================================================

/**
 * Profiling metric categories
 */
export type ProfilingMetricType =
  | "cpu" // CPU usage and profiling
  | "memory" // Memory allocation and usage
  | "latency" // Operation latency
  | "throughput" // Operations per second
  | "io" // I/O operations
  | "network" // Network operations
  | "lock" // Lock contention
  | "custom"; // Custom metrics

/**
 * Profiling session configuration
 */
export interface ProfilingSessionConfig {
  /** Session identifier */
  sessionId: string;
  /** Session name */
  name: string;
  /** Metrics to collect */
  metrics: ProfilingMetricType[];
  /** Sampling interval (ms) */
  samplingInterval: number;
  /** Maximum session duration (ms, 0 = unlimited) */
  maxDuration: number;
  /** Enable stack trace collection */
  enableStackTraces: boolean;
  /** Enable memory heap snapshots */
  enableHeapSnapshots: boolean;
  /** Enable CPU profiling */
  enableCpuProfiling: boolean;
  /** Enable flame graph generation */
  enableFlameGraph: boolean;
  /** Tags for filtering/grouping */
  tags?: Record<string, string>;
}

/**
 * Profiling session state
 */
export type ProfilingSessionState =
  | "idle"
  | "running"
  | "paused"
  | "stopped"
  | "error";

/**
 * Profiling session metadata
 */
export interface ProfilingSession {
  /** Session identifier */
  sessionId: string;
  /** Session name */
  name: string;
  /** Session state */
  state: ProfilingSessionState;
  /** Start timestamp */
  startTime: number;
  /** End timestamp (0 if still running) */
  endTime: number;
  /** Session configuration */
  config: ProfilingSessionConfig;
  /** Collected metrics */
  metrics: CollectedMetrics;
  /** Number of samples collected */
  sampleCount: number;
  /** Session tags */
  tags: Record<string, string>;
}

// ============================================================================
// CPU PROFILING TYPES
// ============================================================================

/**
 * CPU profile sample
 */
export interface CpuProfileSample {
  /** Sample timestamp */
  timestamp: number;
  /** CPU usage percentage (0-100) */
  cpuUsage: number;
  /** User CPU time (ms) */
  userCpuTime: number;
  /** System CPU time (ms) */
  systemCpuTime: number;
  /** Stack trace at sample time */
  stackTrace?: StackFrame[];
  /** Current operation name */
  operation?: string;
}

/**
 * Stack frame information
 */
export interface StackFrame {
  /** Function name */
  name: string;
  /** Script/file path */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Whether this is a framework function */
  isFramework?: boolean;
  /** Whether this is a native function */
  isNative?: boolean;
}

/**
 * Flame graph node
 */
export interface FlameGraphNode {
  /** Function name */
  name: string;
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Total time spent in this function (ms) */
  totalTime: number;
  /** Self time (excluding children, ms) */
  selfTime: number;
  /** Percentage of total time */
  percentage: number;
  /** Number of samples */
  sampleCount: number;
  /** Child nodes */
  children: FlameGraphNode[];
  /** Parent node (null for root) */
  parent: FlameGraphNode | null;
  /** Depth in the call tree */
  depth: number;
}

/**
 * Hot path detection result
 */
export interface HotPath {
  /** Function name */
  functionName: string;
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Total time spent (ms) */
  totalTime: number;
  /** Percentage of total execution time */
  percentage: number;
  /** Call frequency */
  callCount: number;
  /** Average time per call (ms) */
  avgTimePerCall: number;
  /** Impact score (0-1) */
  impactScore: number;
  /** Optimization potential (0-1) */
  optimizationPotential: number;
}

/**
 * CPU profiling report
 */
export interface CpuProfilingReport {
  /** Total profiling duration (ms) */
  totalDuration: number;
  /** Average CPU usage (0-100) */
  averageCpuUsage: number;
  /** Peak CPU usage (0-100) */
  peakCpuUsage: number;
  /** CPU usage histogram */
  usageHistogram: {
    range: string;
    count: number;
    percentage: number;
  }[];
  /** Flame graph */
  flameGraph: FlameGraphNode;
  /** Detected hot paths */
  hotPaths: HotPath[];
  /** Top functions by self time */
  topFunctionsBySelfTime: Array<{
    name: string;
    file: string;
    line: number;
    selfTime: number;
    percentage: number;
  }>;
  /** Top functions by total time */
  topFunctionsByTotalTime: Array<{
    name: string;
    file: string;
    line: number;
    totalTime: number;
    percentage: number;
  }>;
  /** Call graph statistics */
  callGraphStats: {
    totalFunctions: number;
    maxDepth: number;
    avgDepth: number;
    branchingFactor: number;
  };
}

// ============================================================================
// MEMORY PROFILING TYPES
// ============================================================================

/**
 * Memory profile sample
 */
export interface MemoryProfileSample {
  /** Sample timestamp */
  timestamp: number;
  /** Heap used (MB) */
  heapUsed: number;
  /** Heap total (MB) */
  heapTotal: number;
  /** Heap size limit (MB) */
  heapLimit: number;
  /** External memory (MB) */
  external: number;
  /** RSS memory (MB) */
  rss: number;
  /** Array buffer memory (MB) */
  arrayBuffers?: number;
  /** Heap usage percentage (0-1) */
  heapUsagePercent: number;
}

/**
 * Memory allocation info
 */
export interface MemoryAllocation {
  /** Allocation timestamp */
  timestamp: number;
  /** Allocation size (bytes) */
  size: number;
  /** Object type/class name */
  type: string;
  /** Stack trace at allocation */
  stackTrace?: StackFrame[];
  /** Whether allocation was freed */
  freed: boolean;
  /** Deallocation timestamp (0 if still alive) */
  freedAt?: number;
  /** Object lifetime (ms) */
  lifetime?: number;
  /** Allocation site (file:line) */
  allocationSite?: string;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakDetection {
  /** Whether leak is suspected */
  suspected: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Leak rate (MB/minute) */
  leakRate: number;
  /** Total leaked memory (MB) */
  totalLeaked: number;
  /** Suspected leak locations */
  leakLocations: Array<{
    file: string;
    line: number;
    function: string;
    allocationCount: number;
    totalSize: number;
    avgSize: number;
  }>;
  /** Leaked object types */
  leakedObjectTypes: Array<{
    type: string;
    count: number;
    totalSize: number;
    avgSize: number;
  }>;
}

/**
 * Memory profiling report
 */
export interface MemoryProfilingReport {
  /** Initial memory snapshot */
  initialSnapshot: MemoryProfileSample;
  /** Final memory snapshot */
  finalSnapshot: MemoryProfileSample;
  /** Memory growth (MB) */
  memoryGrowth: number;
  /** Growth rate (MB/minute) */
  growthRate: number;
  /** Peak memory usage (MB) */
  peakMemory: number;
  /** Average memory usage (MB) */
  averageMemory: number;
  /** Memory usage timeline */
  timeline: MemoryProfileSample[];
  /** Allocation statistics */
  allocationStats: {
    totalAllocations: number;
    totalDeallocations: number;
    currentLiveObjects: number;
    totalAllocatedMemory: number;
    totalFreedMemory: number;
    avgAllocationSize: number;
    medianAllocationSize: number;
  };
  /** Object type distribution */
  objectDistribution: Array<{
    type: string;
    count: number;
    totalSize: number;
    avgSize: number;
    percentage: number;
  }>;
  /** Memory leak detection */
  leakDetection: MemoryLeakDetection;
  /** Memory optimization suggestions */
  suggestions: Array<{
    type: "allocation" | "retention" | "fragmentation";
    severity: "low" | "medium" | "high";
    description: string;
    recommendation: string;
    location?: {
      file: string;
      line: number;
    };
  }>;
}

// ============================================================================
// LATENCY TRACKING TYPES
// ============================================================================

/**
 * Latency sample
 */
export interface LatencySample {
  /** Sample timestamp */
  timestamp: number;
  /** Operation name */
  operation: string;
  /** Total latency (ms) */
  totalLatency: number;
  /** Latency breakdown */
  breakdown?: LatencyBreakdown;
  /** Operation success */
  success: boolean;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Latency breakdown by component
 */
export interface LatencyBreakdown {
  /** Queue wait time (ms) */
  queue: number;
  /** Processing time (ms) */
  processing: number;
  /** I/O time (ms) */
  io: number;
  /** Network time (ms) */
  network: number;
  /** Serialization time (ms) */
  serialization: number;
  /** Other overhead (ms) */
  other: number;
}

/**
 * Percentile measurements
 */
export interface PercentileMeasurements {
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Average (arithmetic mean) */
  average: number;
  /** Median (P50) */
  p50: number;
  /** 75th percentile */
  p75: number;
  /** 90th percentile */
  p90: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
  /** 99.9th percentile */
  p99_9: number;
  /** Standard deviation */
  stdDev: number;
  /** Variance */
  variance: number;
}

/**
 * Latency tracking report
 */
export interface LatencyTrackingReport {
  /** Operation name */
  operation: string;
  /** Total number of samples */
  sampleCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Error count */
  errorCount: number;
  /** Total latency percentiles */
  percentiles: PercentileMeasurements;
  /** Latency breakdown percentiles */
  breakdownPercentiles: {
    queue: PercentileMeasurements;
    processing: PercentileMeasurements;
    io: PercentileMeasurements;
    network: PercentileMeasurements;
    serialization: PercentileMeasurements;
    other: PercentileMeasurements;
  };
  /** Latency histogram */
  histogram: {
    bucket: string;
    min: number;
    max: number;
    count: number;
    percentage: number;
  }[];
  /** Latency timeline */
  timeline: LatencySample[];
  /** Outliers */
  outliers: Array<{
    timestamp: number;
    value: number;
    deviation: number;
    reason?: string;
  }>;
}

// ============================================================================
// THROUGHPUT MEASUREMENT TYPES
// ============================================================================

/**
 * Throughput measurement
 */
export interface ThroughputMeasurement {
  /** Measurement timestamp */
  timestamp: number;
  /** Operation name */
  operation: string;
  /** Operations completed */
  operationsCompleted: number;
  /** Operations failed */
  operationsFailed: number;
  /** Operations per second */
  opsPerSecond: number;
  /** Time window (ms) */
  timeWindow: number;
}

/**
 * Throughput statistics
 */
export interface ThroughputStatistics {
  /** Average throughput (ops/sec) */
  averageThroughput: number;
  /** Peak throughput (ops/sec) */
  peakThroughput: number;
  /** Minimum throughput (ops/sec) */
  minThroughput: number;
  /** Throughput percentiles */
  percentiles: PercentileMeasurements;
  /** Total operations */
  totalOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Throughput trend */
  trend: "increasing" | "stable" | "decreasing";
  /** Trend strength (0-1) */
  trendStrength: number;
}

/**
 * Throughput report
 */
export interface ThroughputReport {
  /** Operation name */
  operation: string;
  /** Total measurement duration (ms) */
  totalDuration: number;
  /** Throughput statistics */
  statistics: ThroughputStatistics;
  /** Throughput timeline */
  timeline: ThroughputMeasurement[];
  /** Throughput by time window */
  byTimeWindow: {
    window: string;
    throughput: number;
    timestamp: number;
  }[];
}

// ============================================================================
// COLLECTED METRICS
// ============================================================================

/**
 * All collected metrics during a profiling session
 */
export interface CollectedMetrics {
  /** CPU metrics */
  cpu?: {
    samples: CpuProfileSample[];
    report?: CpuProfilingReport;
  };
  /** Memory metrics */
  memory?: {
    samples: MemoryProfileSample[];
    allocations: MemoryAllocation[];
    report?: MemoryProfilingReport;
  };
  /** Latency metrics by operation */
  latency?: Map<string, LatencyTrackingReport>;
  /** Throughput metrics by operation */
  throughput?: Map<string, ThroughputReport>;
  /** Custom metrics */
  custom?: Map<string, Array<{
    timestamp: number;
    value: number;
  }>>;
}

// ============================================================================
// REPORT GENERATION TYPES
// ============================================================================

/**
 * Complete profiling report
 */
export interface ProfilingReport {
  /** Report metadata */
  metadata: {
    reportId: string;
    sessionId: string;
    timestamp: number;
    duration: number;
    reportFormat: "json" | "html" | "markdown";
  };
  /** Session information */
  session: ProfilingSession;
  /** CPU profiling report (if enabled) */
  cpuReport?: CpuProfilingReport;
  /** Memory profiling report (if enabled) */
  memoryReport?: MemoryProfilingReport;
  /** Latency reports by operation */
  latencyReports?: Map<string, LatencyTrackingReport>;
  /** Throughput reports by operation */
  throughputReports?: Map<string, ThroughputReport>;
  /** Overall performance score (0-100) */
  performanceScore: number;
  /** Performance summary */
  summary: PerformanceSummary;
  /** Recommendations */
  recommendations: OptimizationRecommendation[];
}

/**
 * Performance summary
 */
export interface PerformanceSummary {
  /** Overall health status */
  healthStatus: "excellent" | "good" | "fair" | "poor" | "critical";
  /** Key metrics */
  keyMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    avgLatency: number;
    throughput: number;
    errorRate: number;
  };
  /** Top bottlenecks */
  topBottlenecks: Array<{
    type: string;
    description: string;
    impact: number;
  }>;
  /** Performance trends */
  trends: {
    cpu: "improving" | "stable" | "degrading";
    memory: "improving" | "stable" | "degrading";
    latency: "improving" | "stable" | "degrading";
    throughput: "improving" | "stable" | "degrading";
  };
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  /** Recommendation ID */
  id: string;
  /** Recommendation type */
  type: "cpu" | "memory" | "latency" | "throughput" | "general";
  /** Priority (1-10, 10 = highest) */
  priority: number;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Expected impact */
  expectedImpact: {
    performanceGain: number; // Percentage
    confidence: number; // 0-1
  };
  /** Implementation difficulty (1-10) */
  difficulty: number;
  /** Estimated implementation time */
  estimatedTime: string;
  /** Code examples */
  codeExample?: string;
  /** Related metrics */
  relatedMetrics: string[];
  /** Affected components */
  affectedComponents: string[];
}

// ============================================================================
// BENCHMARK FRAMEWORK TYPES
// ============================================================================

/**
 * Benchmark definition
 */
export interface BenchmarkDefinition {
  /** Benchmark name */
  name: string;
  /** Description */
  description: string;
  /** Benchmark function */
  fn: () => Promise<any> | any;
  /** Number of iterations */
  iterations: number;
  /** Warmup iterations */
  warmupIterations: number;
  /** Setup function */
  setup?: () => Promise<void> | void;
  /** Teardown function */
  teardown?: () => Promise<void> | void;
  /** Benchmark tags */
  tags?: string[];
  /** Expected performance (for regression detection) */
  expectedPerformance?: {
    maxLatency: number;
    minThroughput: number;
    maxMemory: number;
  };
}

/**
 * Benchmark suite
 */
export interface BenchmarkSuite {
  /** Suite name */
  name: string;
  /** Description */
  description: string;
  /** Benchmarks */
  benchmarks: BenchmarkDefinition[];
  /** Suite setup */
  setup?: () => Promise<void>;
  /** Suite teardown */
  teardown?: () => Promise<void>;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  /** Benchmark name */
  name: string;
  /** Result timestamp */
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
  /** Percentiles */
  percentiles: PercentileMeasurements;
  /** Throughput (ops/sec) */
  throughput: number;
  /** Memory before (MB) */
  memoryBefore: number;
  /** Memory after (MB) */
  memoryAfter: number;
  /** Memory delta (MB) */
  memoryDelta: number;
  /** Error count */
  errorCount: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Success (met expectations) */
  success: boolean;
}

/**
 * Benchmark comparison
 */
export interface BenchmarkComparison {
  /** Baseline result */
  baseline: BenchmarkResult;
  /** Current result */
  current: BenchmarkResult;
  /** Throughput change (%) */
  throughputChange: number;
  /** Latency change (%) */
  latencyChange: number;
  /** Memory change (%) */
  memoryChange: number;
  /** Is regression */
  isRegression: boolean;
  /** Regression severity */
  severity: "minor" | "moderate" | "major" | "critical";
  /** Regression description */
  description: string;
}

/**
 * Benchmark suite result
 */
export interface BenchmarkSuiteResult {
  /** Suite name */
  suiteName: string;
  /** Result timestamp */
  timestamp: number;
  /** Total duration (ms) */
  totalDuration: number;
  /** Benchmark results */
  results: BenchmarkResult[];
  /** Summary statistics */
  summary: {
    totalBenchmarks: number;
    successfulBenchmarks: number;
    failedBenchmarks: number;
    averageThroughput: number;
    averageLatency: number;
    totalMemoryDelta: number;
  };
}

// ============================================================================
// PROFILING OPTIONS
// ============================================================================

/**
 * Profiling options
 */
export interface ProfilingOptions {
  /** Enable CPU profiling */
  enableCpuProfiling: boolean;
  /** Enable memory profiling */
  enableMemoryProfiling: boolean;
  /** Enable latency tracking */
  enableLatencyTracking: boolean;
  /** Enable throughput measurement */
  enableThroughputMeasurement: boolean;
  /** CPU profiling options */
  cpu?: {
    /** Sampling interval (ms) */
    samplingInterval: number;
    /** Enable stack traces */
    enableStackTraces: boolean;
    /** Enable flame graph */
    enableFlameGraph: boolean;
    /** Hot path threshold (percentage) */
    hotPathThreshold: number;
  };
  /** Memory profiling options */
  memory?: {
    /** Sampling interval (ms) */
    samplingInterval: number;
    /** Enable heap snapshots */
    enableHeapSnapshots: boolean;
    /** Enable allocation tracking */
    enableAllocationTracking: boolean;
    /** Leak detection threshold (MB/minute) */
    leakThreshold: number;
  };
  /** Latency tracking options */
  latency?: {
    /** Enable breakdown */
    enableBreakdown: boolean;
    /** Percentile precision */
    percentilePrecision: number;
    /** Histogram buckets */
    histogramBuckets: number[];
  };
  /** Throughput options */
  throughput?: {
    /** Measurement window (ms) */
    measurementWindow: number;
    /** Sliding window size */
    slidingWindow: number;
  };
  /** Report options */
  reports?: {
    /** Report format */
    format: "json" | "html" | "markdown";
    /** Include flame graph */
    includeFlameGraph: boolean;
    /** Include hot paths */
    includeHotPaths: boolean;
    /** Include recommendations */
    includeRecommendations: boolean;
    /** Report output path */
    outputPath?: string;
  };
}

/**
 * Default profiling options
 */
export const DEFAULT_PROFILING_OPTIONS: ProfilingOptions = {
  enableCpuProfiling: true,
  enableMemoryProfiling: true,
  enableLatencyTracking: true,
  enableThroughputMeasurement: true,
  cpu: {
    samplingInterval: 10,
    enableStackTraces: true,
    enableFlameGraph: true,
    hotPathThreshold: 5.0, // 5% of total time
  },
  memory: {
    samplingInterval: 100,
    enableHeapSnapshots: false,
    enableAllocationTracking: false,
    leakThreshold: 1.0, // 1 MB/minute
  },
  latency: {
    enableBreakdown: true,
    percentilePrecision: 2,
    histogramBuckets: [0, 1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000],
  },
  throughput: {
    measurementWindow: 1000,
    slidingWindow: 5,
  },
  reports: {
    format: "json",
    includeFlameGraph: true,
    includeHotPaths: true,
    includeRecommendations: true,
  },
};
