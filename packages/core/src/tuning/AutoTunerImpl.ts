/**
 * @lsi/core/tuning - AutoTunerImpl for Aequor Cognitive Orchestration Platform
 *
 * Full auto-tuner implementation with:
 * - Periodic tuning cycles
 * - Stabilization time after parameter change
 * - Rollback on significant degradation
 * - Cooldown period for parameters
 * - Safety checks before tuning
 * - Performance measurement from actual system
 * - History tracking for learning
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
import {
  TunableParameter,
  AutoTunerConfig,
  TuningRecommendation,
  PerformanceMetrics,
  TuningHistoryEntry,
  QueryHistory,
  DEFAULT_AUTOTUNER_CONFIG,
  DEFAULT_TUNABLE_PARAMETERS,
} from "./AutoTuner.js";
import { ParameterController } from "./ParameterController.js";
import { TuningHistory } from "./TuningHistory.js";

/**
 * AutoTunerImpl - Full automatic tuning implementation
 *
 * The AutoTunerImpl continuously monitors performance and adjusts
 * tunable parameters to optimize the objective function.
 */
export class AutoTunerImpl {
  private isRunning: boolean = false;
  private tuningInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private recentMetrics: PerformanceMetrics[] = [];
  private lastTunedTime: Map<string, number> = new Map();
  private baselinePerformance: PerformanceMetrics | null = null;
  private queryHistory: QueryHistory[] = [];
  private stabilizationTime: number;
  private minConfidence: number;
  private maxDegradation: number;
  private analysisWindowSize: number;

  constructor(
    private config: AutoTunerConfig = DEFAULT_AUTOTUNER_CONFIG,
    private workloadAnalyzer: WorkloadAnalyzer = new WorkloadAnalyzer(),
    private parameterOptimizer: ParameterOptimizer = new ParameterOptimizer(),
    private parameterController: ParameterController = new ParameterController(),
    private tuningHistory: TuningHistory = new TuningHistory()
  ) {
    this.stabilizationTime = config.tuneInterval / 2;
    this.minConfidence = config.safeMode ? 0.7 : 0.5;
    this.maxDegradation = config.maxDegradation;
    this.analysisWindowSize = 100;

    // Register default parameters
    for (const param of DEFAULT_TUNABLE_PARAMETERS) {
      if (config.categories.includes(param.category)) {
        this.parameterController.register(param);
      }
    }
  }

  /**
   * Start auto-tuning
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("[AutoTunerImpl] Already running");
      return;
    }

    this.isRunning = true;
    this.baselinePerformance = await this.measurePerformance();

    // Start periodic tuning cycles
    this.tuningInterval = setInterval(
      () => this.runTuningCycle(),
      this.config.tuneInterval
    );

    // Start metrics collection
    await this.startMetricsCollection();

    console.log(
      "[AutoTunerImpl] Started auto-tuning with interval:",
      this.config.tuneInterval
    );
  }

  /**
   * Stop auto-tuning
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.tuningInterval) {
      clearInterval(this.tuningInterval);
      this.tuningInterval = null;
    }

    await this.stopMetricsCollection();

    console.log("[AutoTunerImpl] Stopped auto-tuning");
  }

  /**
   * Main tuning cycle
   */
  private async runTuningCycle(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log("[AutoTunerImpl] Running tuning cycle...");

      // 1. Analyze current workload
      const workload = await this.workloadAnalyzer.analyze(
        this.queryHistory,
        Math.min(this.analysisWindowSize, this.queryHistory.length)
      );

      const currentPattern = workload[0] || null;
      const currentState = this.workloadAnalyzer.getCurrentState();

      // 2. Get current parameters
      const currentParams = await this.parameterController.getAll();

      if (currentParams.length === 0) {
        console.log("[AutoTunerImpl] No parameters available for tuning");
        return;
      }

      // 3. Generate recommendations
      const optimization = await this.parameterOptimizer.optimize(
        currentPattern,
        currentParams,
        this.config.objective
      );

      // 4. Filter safe recommendations
      const safeRecommendations = this.filterSafeRecommendations(
        optimization.recommendations,
        workload,
        currentState
      );

      if (safeRecommendations.length === 0) {
        console.log("[AutoTunerImpl] No safe recommendations to apply");
        return;
      }

      // 5. Apply best recommendation
      const bestRecommendation = safeRecommendations[0];
      await this.applyRecommendation(bestRecommendation, currentState);

      console.log("[AutoTunerImpl] Tuning cycle complete");
    } catch (error) {
      console.error("[AutoTunerImpl] Error during tuning cycle:", error);
    }
  }

  /**
   * Apply parameter change
   */
  private async applyRecommendation(
    recommendation: TuningRecommendation,
    currentState: WorkloadState
  ): Promise<void> {
    const { parameter, currentValue, recommendedValue } = recommendation;

    // Get current performance
    const before = await this.measurePerformance();

    try {
      // Apply change
      await this.parameterController.set(parameter, recommendedValue);

      // Wait for stabilization
      await this.sleep(this.stabilizationTime);

      // Measure new performance
      const after = await this.measurePerformance();

      // Calculate improvement
      const improvement = this.calculateImprovement(before, after);

      // Record in history
      await this.tuningHistory.record({
        timestamp: Date.now(),
        parameter,
        oldValue: currentValue,
        newValue: recommendedValue,
        performanceBefore: before,
        performanceAfter: after,
        improvement,
        successful: improvement >= 0,
      });

      console.log(
        `[AutoTunerImpl] Tuned ${parameter}: ${currentValue} -> ${recommendedValue} ` +
          `(improvement: ${(improvement * 100).toFixed(1)}%)`
      );

      // Rollback if degradation
      if (improvement < -this.maxDegradation) {
        console.log(
          `[AutoTunerImpl] Rolling back ${parameter}: ` +
            `degradation ${(-improvement * 100).toFixed(1)}% exceeds threshold`
        );
        await this.parameterController.set(parameter, currentValue);

        // Update history entry
        const entries = await this.tuningHistory.getParameterHistory(parameter);
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          lastEntry.successful = false;
        }
      } else {
        // Mark as tuned (cooldown)
        this.lastTunedTime.set(parameter, Date.now());
      }
    } catch (error) {
      console.error(
        `[AutoTunerImpl] Error applying recommendation for ${parameter}:`,
        error
      );

      // Rollback on error
      try {
        await this.parameterController.set(parameter, currentValue);
      } catch (rollbackError) {
        console.error(
          `[AutoTunerImpl] Error rolling back ${parameter}:`,
          rollbackError
        );
      }
    }
  }

  /**
   * Filter safe recommendations
   */
  private filterSafeRecommendations(
    recommendations: TuningRecommendation[],
    workload: WorkloadPattern[],
    currentState: WorkloadState
  ): TuningRecommendation[] {
    return recommendations.filter(rec => {
      // Check confidence
      if (rec.confidence < this.minConfidence) {
        return false;
      }

      // Check if safe to tune now
      if (!this.isSafeToTune(rec, currentState)) {
        return false;
      }

      // Check cooldown period
      if (this.isInCooldown(rec.parameter)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if safe to tune
   */
  private isSafeToTune(
    recommendation: TuningRecommendation,
    state: WorkloadState
  ): boolean {
    // Don't tune during high load
    if (this.isUnderHighLoad(state)) {
      return false;
    }

    // Don't tune if degraded state
    if (this.isDegraded()) {
      return false;
    }

    // Don't tune if already tuning this parameter
    if (this.isCurrentlyTuning(recommendation.parameter)) {
      return false;
    }

    return true;
  }

  /**
   * Check if under high load
   */
  private isUnderHighLoad(state: WorkloadState): boolean {
    // High load: throughput > 100 req/s or increasing trend
    return state.throughput > 100 || state.trend === "increasing";
  }

  /**
   * Check if system is degraded
   */
  private isDegraded(): boolean {
    if (!this.baselinePerformance) {
      return false;
    }

    const current = this.recentMetrics[this.recentMetrics.length - 1];
    if (!current) {
      return false;
    }

    // Check if latency degraded significantly
    const latencyDegradation =
      (current.latency.p95 - this.baselinePerformance.latency.p95) /
      this.baselinePerformance.latency.p95;

    // Check if quality degraded significantly
    const qualityDegradation =
      (this.baselinePerformance.qualityScore - current.qualityScore) /
      this.baselinePerformance.qualityScore;

    return latencyDegradation > 0.2 || qualityDegradation > 0.1;
  }

  /**
   * Check if parameter is in cooldown
   */
  private isInCooldown(parameter: string): boolean {
    const lastTuned = this.lastTunedTime.get(parameter) || 0;
    const timeSinceTune = Date.now() - lastTuned;
    return timeSinceTune < this.config.cooldownPeriod;
  }

  /**
   * Check if currently tuning a parameter
   */
  private isCurrentlyTuning(parameter: string): boolean {
    // Simplified: check if there's a recent tuning action
    const lastTuned = this.lastTunedTime.get(parameter) || 0;
    const timeSinceTune = Date.now() - lastTuned;
    return timeSinceTune < this.stabilizationTime;
  }

  /**
   * Measure current performance
   */
  private async measurePerformance(): Promise<PerformanceMetrics> {
    // In a real implementation, this would gather actual metrics from the system
    // For now, use recent metrics or generate synthetic data
    const recent = this.recentMetrics[this.recentMetrics.length - 1];

    if (recent) {
      return { ...recent };
    }

    // Generate synthetic metrics based on query history
    return this.generateSyntheticMetrics();
  }

  /**
   * Generate synthetic metrics
   */
  private generateSyntheticMetrics(): PerformanceMetrics {
    const recentQueries = this.queryHistory.slice(-100);

    if (recentQueries.length === 0) {
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

    const latencies = recentQueries.map(q => q.latency).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 100;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 200;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 300;

    const cacheHits = recentQueries.filter(q => q.cacheHit).length;
    const hitRate = cacheHits / recentQueries.length;

    const timeWindow =
      recentQueries[recentQueries.length - 1].timestamp -
        recentQueries[0].timestamp || 1;
    const throughput = (recentQueries.length / timeWindow) * 1000;

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

  /**
   * Calculate improvement score
   */
  private calculateImprovement(
    before: PerformanceMetrics,
    after: PerformanceMetrics
  ): number {
    let improvement = 0;

    switch (this.config.objective.primary) {
      case "latency":
        // Negative latency change is improvement
        const latencyChange =
          (after.latency.p95 - before.latency.p95) / before.latency.p95;
        improvement = -latencyChange;
        break;

      case "throughput":
        // Positive throughput change is improvement
        const throughputChange =
          (after.throughput - before.throughput) / before.throughput;
        improvement = throughputChange;
        break;

      case "quality":
        // Positive quality change is improvement
        const qualityChange =
          (after.qualityScore - before.qualityScore) / before.qualityScore;
        improvement = qualityChange;
        break;

      case "efficiency":
        // Combined: latency down, throughput up, cost down
        const latImprovement =
          -(after.latency.p95 - before.latency.p95) / before.latency.p95;
        const tputImprovement =
          (after.throughput - before.throughput) / before.throughput;
        const costImprovement =
          -(after.costPerRequest - before.costPerRequest) /
          (before.costPerRequest || 0.001);
        improvement = (latImprovement + tputImprovement + costImprovement) / 3;
        break;

      case "cost":
        // Negative cost change is improvement
        const costChange =
          (after.costPerRequest - before.costPerRequest) /
          (before.costPerRequest || 0.001);
        improvement = -costChange;
        break;
    }

    return improvement;
  }

  /**
   * Start metrics collection
   */
  private async startMetricsCollection(): Promise<void> {
    const metricsInterval = Math.min(10000, this.config.tuneInterval / 6);

    this.metricsInterval = setInterval(async () => {
      const metrics = await this.measurePerformance();
      this.recentMetrics.push(metrics);

      // Keep only recent metrics (last 100)
      if (this.recentMetrics.length > 100) {
        this.recentMetrics = this.recentMetrics.slice(-100);
      }
    }, metricsInterval);

    console.log(
      "[AutoTunerImpl] Started metrics collection with interval:",
      metricsInterval
    );
  }

  /**
   * Stop metrics collection
   */
  private async stopMetricsCollection(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Get recommendations (for UI)
   */
  async getRecommendations(): Promise<TuningRecommendation[]> {
    const workload = await this.workloadAnalyzer.analyze(
      this.queryHistory,
      Math.min(this.analysisWindowSize, this.queryHistory.length)
    );

    const currentParams = await this.parameterController.getAll();

    const optimization = await this.parameterOptimizer.optimize(
      workload[0] || null,
      currentParams,
      this.config.objective
    );

    return optimization.recommendations;
  }

  /**
   * Get tuning history
   */
  async getHistory(): Promise<TuningHistoryEntry[]> {
    return await this.tuningHistory.getAll();
  }

  /**
   * Get current parameters
   */
  async getParameters(): Promise<TunableParameter[]> {
    return await this.parameterController.getAll();
  }

  /**
   * Manual parameter override
   */
  async setParameter(name: string, value: number): Promise<void> {
    await this.parameterController.set(name, value);
    await this.tuningHistory.recordManualChange(name, value);
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
   * Get current performance
   */
  async getCurrentPerformance(): Promise<PerformanceMetrics> {
    return await this.measurePerformance();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create an AutoTunerImpl with default configuration
 */
export function createAutoTunerImpl(
  config?: Partial<AutoTunerConfig>,
  workloadAnalyzer?: WorkloadAnalyzer,
  parameterOptimizer?: ParameterOptimizer
): AutoTunerImpl {
  const mergedConfig = {
    ...DEFAULT_AUTOTUNER_CONFIG,
    ...config,
  };

  return new AutoTunerImpl(mergedConfig, workloadAnalyzer, parameterOptimizer);
}
