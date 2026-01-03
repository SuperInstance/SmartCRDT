/**
 * @lsi/core/tuning - Auto-Tuner for Aequor Cognitive Orchestration Platform
 *
 * The AutoTuner provides automatic performance tuning by:
 * - Analyzing workload patterns
 * - Optimizing tunable parameters
 * - Applying safety checks before tuning
 * - Rolling back on performance degradation
 */

import {
  WorkloadAnalyzer,
  WorkloadPattern,
  WorkloadState,
} from "./WorkloadAnalyzer.js";
import {
  ParameterOptimizer,
  OptimizationResult,
} from "./ParameterOptimizer.js";

/**
 * Parameter category for grouping related parameters
 */
export type ParameterCategory =
  | "cache"
  | "routing"
  | "thermal"
  | "memory"
  | "network";

/**
 * A tunable parameter with constraints and metadata
 */
export interface TunableParameter {
  /** Parameter name */
  name: string;
  /** Parameter category */
  category: ParameterCategory;

  // Range
  /** Minimum allowed value */
  minValue: number;
  /** Maximum allowed value */
  maxValue: number;
  /** Current value */
  currentValue: number;

  // Constraints
  /** Step size for adjustments */
  stepSize: number;
  /** Whether changing this parameter requires a restart */
  requiresRestart: boolean;

  // Impact
  /** Estimated impact on performance (0-1) */
  impactEstimate: number;

  // Validation
  /** Custom validation function */
  validate: (value: number) => boolean;
}

/**
 * Optimization objective configuration
 */
export interface OptimizationObjective {
  /** Primary objective to maximize */
  primary: "latency" | "throughput" | "quality" | "cost" | "efficiency";

  /** Secondary objectives with weights */
  secondary: {
    /** Metric name */
    metric: string;
    /** Weight (0-1) */
    weight: number;
    /** Whether to maximize or minimize */
    maximize: boolean;
  }[];

  /** Target values for specific metrics */
  targets?: {
    /** Metric name */
    metric: string;
    /** Target value */
    value: number;
  }[];
}

/**
 * Tuning constraints
 */
export interface TuningConstraints {
  /** Maximum memory usage in MB */
  maxMemoryMB: number;
  /** Maximum CPU usage percentage */
  maxCPUPercent: number;

  /** Maximum acceptable latency in ms */
  maxLatency?: number;
  /** Minimum acceptable throughput in req/s */
  minThroughput?: number;
  /** Minimum acceptable quality score (0-1) */
  minQuality?: number;

  /** Maximum cost per request in USD */
  maxCostPerRequest?: number;
}

/**
 * Auto-tuner configuration
 */
export interface AutoTunerConfig {
  /** Tuning scope - which parameter categories to tune */
  categories: ParameterCategory[];

  /** Optimization objective */
  objective: OptimizationObjective;
  /** Tuning constraints */
  constraints: TuningConstraints;

  /** Learning rate for adaptive tuning */
  learningRate: number;
  /** Exploration rate (0-1) - how much to explore vs exploit */
  explorationRate: number;

  /** Tuning interval in milliseconds */
  tuneInterval: number;
  /** Cooldown period before tuning same parameter again (ms) */
  cooldownPeriod: number;

  /** Safety mode - only tune if high confidence */
  safeMode: boolean;
  /** Rollback changes if performance degrades */
  rollbackOnDegradation: boolean;
  /** Maximum acceptable performance drop (0-1) */
  maxDegradation: number;
}

/**
 * Tuning recommendation
 */
export interface TuningRecommendation {
  /** Parameter name */
  parameter: string;
  /** Current value */
  currentValue: number;
  /** Recommended value */
  recommendedValue: number;
  /** Expected improvement (0-1) */
  expectedImprovement: number;
  /** Confidence in recommendation (0-1) */
  confidence: number;
  /** Reason for recommendation */
  reason: string;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Latency percentiles in ms */
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  /** Throughput in requests per second */
  throughput: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Quality score (0-1) */
  qualityScore: number;
  /** Cost per request in USD */
  costPerRequest: number;
  /** Resource usage */
  resourceUsage: {
    /** Memory usage in MB */
    memoryMB: number;
    /** CPU usage percentage */
    cpuPercent: number;
  };
}

/**
 * Tuning history entry
 */
export interface TuningHistoryEntry {
  /** Timestamp of tuning action */
  timestamp: number;
  /** Parameter that was tuned */
  parameter: string;
  /** Old value */
  oldValue: number;
  /** New value */
  newValue: number;
  /** Performance before tuning */
  performanceBefore: PerformanceMetrics;
  /** Performance after tuning */
  performanceAfter?: PerformanceMetrics;
  /** Improvement score (0-1) */
  improvement?: number;
  /** Whether the tuning was successful */
  successful?: boolean;
  /** Whether the change was manual (vs automatic) */
  manual?: boolean;
}

/**
 * Query history entry for workload analysis
 */
export interface QueryHistory {
  /** Query timestamp */
  timestamp: number;
  /** Query type */
  queryType: string;
  /** Query complexity (0-1) */
  complexity: number;
  /** Query length */
  length: number;
  /** Query latency in ms */
  latency: number;
  /** Whether the query was a cache hit */
  cacheHit: boolean;
}

/**
 * Default auto-tuner configuration
 */
export const DEFAULT_AUTOTUNER_CONFIG: AutoTunerConfig = {
  categories: ["cache", "routing", "thermal", "memory"],
  objective: {
    primary: "efficiency",
    secondary: [
      { metric: "latency", weight: 0.4, maximize: false },
      { metric: "throughput", weight: 0.3, maximize: true },
      { metric: "quality", weight: 0.2, maximize: true },
      { metric: "cost", weight: 0.1, maximize: false },
    ],
    targets: [
      { metric: "latency", value: 100 },
      { metric: "quality", value: 0.95 },
    ],
  },
  constraints: {
    maxMemoryMB: 4096,
    maxCPUPercent: 80,
    maxLatency: 500,
    minThroughput: 10,
    minQuality: 0.8,
    maxCostPerRequest: 0.01,
  },
  learningRate: 0.1,
  explorationRate: 0.2,
  tuneInterval: 60000, // 1 minute
  cooldownPeriod: 300000, // 5 minutes
  safeMode: true,
  rollbackOnDegradation: true,
  maxDegradation: 0.1,
};

/**
 * Default tunable parameters
 */
export const DEFAULT_TUNABLE_PARAMETERS: TunableParameter[] = [
  // Cache parameters
  {
    name: "cache.maxSize",
    category: "cache",
    minValue: 100,
    maxValue: 10000,
    currentValue: 1000,
    stepSize: 100,
    requiresRestart: false,
    impactEstimate: 0.7,
    validate: v => v >= 100 && v <= 10000,
  },
  {
    name: "cache.ttl",
    category: "cache",
    minValue: 60000,
    maxValue: 3600000,
    currentValue: 600000,
    stepSize: 60000,
    requiresRestart: false,
    impactEstimate: 0.5,
    validate: v => v >= 60000 && v <= 3600000,
  },
  {
    name: "cache.similarityThreshold",
    category: "cache",
    minValue: 0.7,
    maxValue: 0.99,
    currentValue: 0.85,
    stepSize: 0.01,
    requiresRestart: false,
    impactEstimate: 0.8,
    validate: v => v >= 0.7 && v <= 0.99,
  },

  // Routing parameters
  {
    name: "routing.complexityThreshold",
    category: "routing",
    minValue: 0.3,
    maxValue: 0.9,
    currentValue: 0.7,
    stepSize: 0.05,
    requiresRestart: false,
    impactEstimate: 0.9,
    validate: v => v >= 0.3 && v <= 0.9,
  },
  {
    name: "routing.confidenceThreshold",
    category: "routing",
    minValue: 0.4,
    maxValue: 0.95,
    currentValue: 0.6,
    stepSize: 0.05,
    requiresRestart: false,
    impactEstimate: 0.85,
    validate: v => v >= 0.4 && v <= 0.95,
  },

  // Thermal parameters
  {
    name: "thermal.throttleThreshold",
    category: "thermal",
    minValue: 60,
    maxValue: 90,
    currentValue: 75,
    stepSize: 5,
    requiresRestart: false,
    impactEstimate: 0.6,
    validate: v => v >= 60 && v <= 90,
  },
  {
    name: "thermal.targetTemperature",
    category: "thermal",
    minValue: 40,
    maxValue: 70,
    currentValue: 55,
    stepSize: 5,
    requiresRestart: false,
    impactEstimate: 0.5,
    validate: v => v >= 40 && v <= 70,
  },

  // Memory parameters
  {
    name: "memory.maxCacheSize",
    category: "memory",
    minValue: 256,
    maxValue: 2048,
    currentValue: 512,
    stepSize: 256,
    requiresRestart: false,
    impactEstimate: 0.6,
    validate: v => v >= 256 && v <= 2048,
  },
  {
    name: "memory.vectorCacheSize",
    category: "memory",
    minValue: 1000,
    maxValue: 100000,
    currentValue: 10000,
    stepSize: 5000,
    requiresRestart: true,
    impactEstimate: 0.4,
    validate: v => v >= 1000 && v <= 100000,
  },
];

/**
 * AutoTuner - Automatic performance tuning system
 *
 * The AutoTuner continuously monitors performance and adjusts
 * tunable parameters to optimize the objective function.
 */
export class AutoTuner {
  private isRunning: boolean = false;
  private tuningTimer: NodeJS.Timeout | null = null;
  private parameters: Map<string, TunableParameter>;
  private history: TuningHistoryEntry[] = [];
  private lastTunedTime: Map<string, number> = new Map();
  private baselinePerformance: PerformanceMetrics | null = null;
  private queryHistory: QueryHistory[] = [];

  constructor(
    private workloadAnalyzer: WorkloadAnalyzer,
    private parameterOptimizer: ParameterOptimizer,
    private config: AutoTunerConfig
  ) {
    // Initialize parameters from defaults
    this.parameters = new Map();
    for (const param of DEFAULT_TUNABLE_PARAMETERS) {
      if (config.categories.includes(param.category)) {
        this.parameters.set(param.name, { ...param });
      }
    }
  }

  /**
   * Start auto-tuning
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.baselinePerformance = await this.measurePerformance();

    // Start periodic tuning cycles
    this.tuningTimer = setInterval(
      () => this.runTuningCycle(),
      this.config.tuneInterval
    );

    console.log("[AutoTuner] Started auto-tuning");
  }

  /**
   * Stop auto-tuning
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.tuningTimer) {
      clearInterval(this.tuningTimer);
      this.tuningTimer = null;
    }

    console.log("[AutoTuner] Stopped auto-tuning");
  }

  /**
   * Get current tunable parameters
   */
  getParameters(): TunableParameter[] {
    return Array.from(this.parameters.values());
  }

  /**
   * Update a parameter value (manual override)
   */
  async setParameter(name: string, value: number): Promise<void> {
    const param = this.parameters.get(name);
    if (!param) {
      throw new Error(`Unknown parameter: ${name}`);
    }

    if (!param.validate(value)) {
      throw new Error(`Invalid value for ${name}: ${value}`);
    }

    const oldValue = param.currentValue;
    param.currentValue = value;

    // Record in history
    const entry: TuningHistoryEntry = {
      timestamp: Date.now(),
      parameter: name,
      oldValue,
      newValue: value,
      performanceBefore: await this.measurePerformance(),
      successful: true,
    };
    this.history.push(entry);

    console.log(`[AutoTuner] Set ${name} = ${value} (was ${oldValue})`);
  }

  /**
   * Get current tuning recommendations
   */
  getRecommendations(): TuningRecommendation[] {
    // This would be generated by the optimizer
    // For now, return empty array
    return [];
  }

  /**
   * Get tuning history
   */
  getHistory(): TuningHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Record a query for workload analysis
   */
  recordQuery(query: QueryHistory): void {
    this.queryHistory.push(query);

    // Keep only recent history (last 1000 queries)
    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-1000);
    }
  }

  /**
   * Get current workload state
   */
  getWorkloadState(): WorkloadState {
    return this.workloadAnalyzer.getCurrentState();
  }

  /**
   * Run a tuning cycle
   */
  private async runTuningCycle(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log("[AutoTuner] Running tuning cycle...");

      // Analyze workload
      const patterns = await this.workloadAnalyzer.analyze(
        this.queryHistory,
        Math.min(100, this.queryHistory.length)
      );

      const currentPattern = patterns[0] || null;
      const currentState = this.workloadAnalyzer.getCurrentState();

      // Measure current performance
      const currentPerformance = await this.measurePerformance();

      // Find parameters that can be tuned
      const tunableParams = this.getTunableParameters();

      if (tunableParams.length === 0) {
        console.log("[AutoTuner] No parameters available for tuning");
        return;
      }

      // Optimize parameters
      const optimization = await this.parameterOptimizer.optimize(
        currentPattern,
        tunableParams,
        this.config.objective
      );

      // Apply recommendations if safe
      for (const rec of optimization.recommendations) {
        if (this.isSafeToTune(rec, currentState, currentPerformance)) {
          await this.applyTuning(rec, currentPerformance);
        } else {
          console.log(
            `[AutoTuner] Skipping ${rec.parameter} - not safe to tune`
          );
        }
      }

      console.log("[AutoTuner] Tuning cycle complete");
    } catch (error) {
      console.error("[AutoTuner] Error during tuning cycle:", error);
    }
  }

  /**
   * Get parameters that can be tuned (not on cooldown)
   */
  private getTunableParameters(): TunableParameter[] {
    const now = Date.now();
    const tunable: TunableParameter[] = [];

    for (const param of this.parameters.values()) {
      const lastTuned = this.lastTunedTime.get(param.name) || 0;
      const timeSinceTune = now - lastTuned;

      if (timeSinceTune >= this.config.cooldownPeriod) {
        tunable.push(param);
      }
    }

    return tunable;
  }

  /**
   * Check if it's safe to tune a parameter
   */
  private isSafeToTune(
    rec: TuningRecommendation,
    state: WorkloadState,
    current: PerformanceMetrics
  ): boolean {
    // In safe mode, require high confidence
    if (this.config.safeMode && rec.confidence < 0.7) {
      return false;
    }

    // Check if parameter change is significant enough
    const changePercent = Math.abs(
      (rec.recommendedValue - rec.currentValue) / rec.currentValue
    );
    if (changePercent < 0.05) {
      return false;
    }

    // Check resource constraints
    if (
      current.resourceUsage.memoryMB >
      this.config.constraints.maxMemoryMB * 0.9
    ) {
      return false;
    }

    if (
      current.resourceUsage.cpuPercent >
      this.config.constraints.maxCPUPercent * 0.9
    ) {
      return false;
    }

    // Check performance constraints
    if (
      this.config.constraints.maxLatency &&
      current.latency.p95 > this.config.constraints.maxLatency * 1.2
    ) {
      return false;
    }

    if (
      this.config.constraints.minQuality &&
      current.qualityScore < this.config.constraints.minQuality * 1.1
    ) {
      return false;
    }

    return true;
  }

  /**
   * Apply a tuning recommendation
   */
  private async applyTuning(
    rec: TuningRecommendation,
    before: PerformanceMetrics
  ): Promise<void> {
    const param = this.parameters.get(rec.parameter);
    if (!param) {
      return;
    }

    const oldValue = param.currentValue;
    param.currentValue = rec.recommendedValue;

    // Mark as tuned
    this.lastTunedTime.set(rec.parameter, Date.now());

    // Record in history
    const entry: TuningHistoryEntry = {
      timestamp: Date.now(),
      parameter: rec.parameter,
      oldValue,
      newValue: rec.recommendedValue,
      performanceBefore: before,
      successful: true,
    };
    this.history.push(entry);

    console.log(
      `[AutoTuner] Tuned ${rec.parameter}: ${oldValue} -> ${rec.recommendedValue} ` +
        `(expected improvement: ${(rec.expectedImprovement * 100).toFixed(1)}%, ` +
        `confidence: ${(rec.confidence * 100).toFixed(1)}%)`
    );

    // Schedule rollback check
    if (this.config.rollbackOnDegradation) {
      setTimeout(
        () => this.checkRollback(rec.parameter, oldValue, entry),
        this.config.tuneInterval * 2
      );
    }
  }

  /**
   * Check if we should rollback a change
   */
  private async checkRollback(
    paramName: string,
    oldValue: number,
    entry: TuningHistoryEntry
  ): Promise<void> {
    const current = await this.measurePerformance();
    const before = entry.performanceBefore;

    if (!this.baselinePerformance) {
      return;
    }

    // Calculate degradation
    const degradation = this.calculateDegradation(before, current);

    if (degradation > this.config.maxDegradation) {
      console.log(
        `[AutoTuner] Rolling back ${paramName}: ` +
          `degradation ${(degradation * 100).toFixed(1)}% exceeds threshold ` +
          `${(this.config.maxDegradation * 100).toFixed(1)}%`
      );

      // Rollback
      const param = this.parameters.get(paramName);
      if (param) {
        param.currentValue = oldValue;
        entry.successful = false;
        entry.performanceAfter = current;
        entry.improvement = -degradation;
      }
    } else {
      // Update entry with positive improvement
      entry.performanceAfter = current;
      entry.improvement = -degradation; // Negative degradation = improvement
    }
  }

  /**
   * Calculate performance degradation
   */
  private calculateDegradation(
    before: PerformanceMetrics,
    after: PerformanceMetrics
  ): number {
    // Primary objective-based degradation
    let degradation = 0;

    switch (this.config.objective.primary) {
      case "latency":
        const latencyChange =
          (after.latency.p95 - before.latency.p95) / before.latency.p95;
        degradation = Math.max(0, latencyChange);
        break;

      case "throughput":
        const throughputChange =
          (before.throughput - after.throughput) / before.throughput;
        degradation = Math.max(0, throughputChange);
        break;

      case "quality":
        const qualityChange =
          (before.qualityScore - after.qualityScore) / before.qualityScore;
        degradation = Math.max(0, qualityChange);
        break;

      case "efficiency":
        // Combined metric
        const latencyDeg = Math.max(
          0,
          (after.latency.p95 - before.latency.p95) / before.latency.p95
        );
        const costDeg = Math.max(
          0,
          (after.costPerRequest - before.costPerRequest) /
            (before.costPerRequest || 0.001)
        );
        degradation = (latencyDeg + costDeg) / 2;
        break;

      case "cost":
        const costChange =
          (after.costPerRequest - before.costPerRequest) /
          (before.costPerRequest || 0.001);
        degradation = Math.max(0, costChange);
        break;
    }

    return degradation;
  }

  /**
   * Measure current performance
   */
  private async measurePerformance(): Promise<PerformanceMetrics> {
    // In a real implementation, this would gather actual metrics
    // For now, return synthetic data based on query history
    const recent = this.queryHistory.slice(-100);

    if (recent.length === 0) {
      return {
        latency: { p50: 100, p95: 200, p99: 300 },
        throughput: 50,
        errorRate: 0.01,
        qualityScore: 0.9,
        costPerRequest: 0.001,
        resourceUsage: {
          memoryMB: 512,
          cpuPercent: 30,
        },
      };
    }

    const latencies = recent.map(q => q.latency).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 100;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 200;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 300;

    const cacheHits = recent.filter(q => q.cacheHit).length;
    const hitRate = cacheHits / recent.length;

    // Calculate throughput from time window
    const timeWindow =
      recent[recent.length - 1].timestamp - recent[0].timestamp || 1;
    const throughput = (recent.length / timeWindow) * 1000;

    return {
      latency: { p50, p95, p99 },
      throughput: Math.min(throughput, 1000),
      errorRate: 0.01,
      qualityScore: 0.85 + hitRate * 0.1,
      costPerRequest: 0.001 + (1 - hitRate) * 0.002,
      resourceUsage: {
        memoryMB: 512 + hitRate * 200,
        cpuPercent: 30 + (1 - hitRate) * 20,
      },
    };
  }
}

/**
 * Create an AutoTuner with default configuration
 */
export function createAutoTuner(
  workloadAnalyzer: WorkloadAnalyzer,
  parameterOptimizer: ParameterOptimizer,
  config?: Partial<AutoTunerConfig>
): AutoTuner {
  const mergedConfig = {
    ...DEFAULT_AUTOTUNER_CONFIG,
    ...config,
  };

  return new AutoTuner(workloadAnalyzer, parameterOptimizer, mergedConfig);
}
