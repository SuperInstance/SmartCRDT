/**
 * @lsi/scale-strategy - Cost Optimized Strategy
 *
 * Scale for minimum cost while meeting performance targets.
 */

import type {
  ScaleDecision,
  ScalePolicy,
  ScaleMetric,
  ScaleManagerConfig,
  WorkerPoolState,
  CostOptimizedConfig,
} from "../types.js";

/**
 * Cost optimization configuration
 */
export interface CostOptimizedStrategyConfig {
  /** Whether this strategy is enabled */
  enabled: boolean;
  /** Scale policy */
  policy: ScalePolicy;
  /** Cost configuration */
  costConfig: CostOptimizedConfig;
  /** Performance target (latency in ms) */
  performanceTarget: number;
  /** Allow performance breach for cost (0-1) */
  costVsPerformanceTradeoff: number;
}

/**
 * Cost calculation result
 */
interface CostCalculation {
  workerCount: number;
  hourlyCost: number;
  estimatedLatency: number;
  meetsPerformanceTarget: boolean;
  score: number;
}

/**
 * Default configuration
 */
const DEFAULT_COST_CONFIG: CostOptimizedConfig = {
  maxCostPerHour: 10,
  costPerWorkerPerHour: 0.5,
  costLatencyTradeoff: 0.7,
  budgetPeriodMs: 3600000, // 1 hour
  currentBudgetSpent: 0,
};

const DEFAULT_CONFIG: CostOptimizedStrategyConfig = {
  enabled: true,
  policy: "balanced",
  costConfig: DEFAULT_COST_CONFIG,
  performanceTarget: 500, // 500ms target latency
  costVsPerformanceTradeoff: 0.7,
};

/**
 * Cost-optimized scaling strategy
 */
export class CostOptimizedStrategy {
  private config: CostOptimizedStrategyConfig;
  private managerConfig: ScaleManagerConfig;
  private budgetSpent: number = 0;
  private budgetStartTime: number = Date.now();

  constructor(
    managerConfig: ScaleManagerConfig,
    config?: Partial<CostOptimizedStrategyConfig>
  ) {
    this.managerConfig = managerConfig;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      costConfig: { ...DEFAULT_COST_CONFIG, ...config?.costConfig },
    };
    this.budgetSpent = this.config.costConfig.currentBudgetSpent;
  }

  /**
   * Evaluate metrics and make cost-optimized scaling decision
   */
  async evaluate(
    metrics: ScaleMetric[],
    workerState: WorkerPoolState
  ): Promise<ScaleDecision> {
    if (!this.config.enabled) {
      return this.noActionDecision(workerState);
    }

    // Check budget
    if (this.isBudgetExceeded()) {
      return this.budgetExceededDecision(workerState);
    }

    // Find optimal worker count
    const optimal = this.findOptimalWorkerCount(metrics, workerState);

    // Apply policy adjustments
    let targetCount = optimal.workerCount;

    if (this.config.policy === "conservative") {
      // Scale more gradually
      const diff = targetCount - workerState.active;
      targetCount =
        workerState.active + Math.sign(diff) * Math.min(Math.abs(diff), 1);
    }

    // Enforce bounds
    const minCount = this.managerConfig.enableScaleToZero
      ? 0
      : this.managerConfig.minWorkers;
    targetCount = Math.max(
      minCount,
      Math.min(this.managerConfig.maxWorkers, targetCount)
    );

    const direction = this.determineDirection(targetCount, workerState);

    // Update budget tracking
    this.updateBudget(workerState.active);

    return {
      direction,
      targetCount,
      currentCount: workerState.active,
      reason: `Cost-optimized strategy: ${targetCount} workers at $${optimal.hourlyCost.toFixed(2)}/hour, est. latency ${optimal.estimatedLatency.toFixed(0)}ms (score: ${optimal.score.toFixed(2)})`,
      confidence: optimal.meetsPerformanceTarget ? 0.85 : 0.6,
      triggeredBy: ["cost_optimization", "budget_tracking"],
      estimatedTimeMs: this.estimateTime(direction, targetCount, workerState),
      isEmergency: false,
    };
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(): {
    spent: number;
    remaining: number;
    periodStart: number;
    periodEnd: number;
    isExceeded: boolean;
  } {
    const remaining = this.config.costConfig.maxCostPerHour - this.budgetSpent;

    return {
      spent: this.budgetSpent,
      remaining: Math.max(0, remaining),
      periodStart: this.budgetStartTime,
      periodEnd: this.budgetStartTime + this.config.costConfig.budgetPeriodMs,
      isExceeded: this.isBudgetExceeded(),
    };
  }

  /**
   * Reset budget period
   */
  resetBudget(): void {
    this.budgetSpent = 0;
    this.budgetStartTime = Date.now();
  }

  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set policy
   */
  setPolicy(policy: ScalePolicy): void {
    this.config.policy = policy;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CostOptimizedStrategyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      costConfig: { ...this.config.costConfig, ...config?.costConfig },
    };
  }

  /**
   * Get configuration
   */
  getConfig(): CostOptimizedStrategyConfig {
    return {
      ...this.config,
      costConfig: { ...this.config.costConfig },
    };
  }

  private findOptimalWorkerCount(
    metrics: ScaleMetric[],
    workerState: WorkerPoolState
  ): CostCalculation {
    const currentLatency = this.getCurrentLatency(metrics);
    const currentLoad = this.getCurrentLoad(metrics, workerState);

    // Evaluate worker counts from min to max
    const calculations: CostCalculation[] = [];

    for (
      let count = this.managerConfig.minWorkers;
      count <= this.managerConfig.maxWorkers;
      count++
    ) {
      const hourlyCost = count * this.config.costConfig.costPerWorkerPerHour;
      const estimatedLatency = this.estimateLatency(
        count,
        currentLoad,
        workerState
      );
      const meetsPerformanceTarget =
        estimatedLatency <= this.config.performanceTarget;
      const score = this.calculateScore(
        hourlyCost,
        estimatedLatency,
        meetsPerformanceTarget
      );

      calculations.push({
        workerCount: count,
        hourlyCost,
        estimatedLatency,
        meetsPerformanceTarget,
        score,
      });
    }

    // Sort by score (higher is better)
    calculations.sort((a, b) => b.score - a.score);

    // Return best option
    return calculations[0];
  }

  private calculateScore(
    hourlyCost: number,
    estimatedLatency: number,
    meetsTarget: boolean
  ): number {
    const costScore = 1 - hourlyCost / this.config.costConfig.maxCostPerHour;
    const latencyScore =
      1 - Math.min(1, estimatedLatency / (this.config.performanceTarget * 2));

    // Weight based on tradeoff preference
    const weightedScore =
      costScore * this.config.costVsPerformanceTradeoff +
      latencyScore * (1 - this.config.costVsPerformanceTradeoff);

    // Penalize not meeting performance target
    return meetsTarget ? weightedScore : weightedScore * 0.5;
  }

  private getCurrentLatency(metrics: ScaleMetric[]): number {
    const latencyMetric = metrics.find(m => m.name === "latency");
    return latencyMetric?.value || 500;
  }

  private getCurrentLoad(
    metrics: ScaleMetric[],
    workerState: WorkerPoolState
  ): number {
    // Calculate load based on queue and CPU
    const queueMetric = metrics.find(m => m.name === "queue_depth");
    const cpuMetric = metrics.find(m => m.name === "cpu_usage");

    const queueLoad = (queueMetric?.value || 0) / 100;
    const cpuLoad = (cpuMetric?.value || 0) / 100;

    return Math.max(queueLoad, cpuLoad);
  }

  private estimateLatency(
    workerCount: number,
    load: number,
    workerState: WorkerState
  ): number {
    if (workerCount === 0) {
      return 999999; // Infinite latency with no workers
    }

    // Simple queuing model: latency scales with load/worker ratio
    const loadPerWorker = load / workerCount;

    if (loadPerWorker < 0.5) {
      // Low load: baseline latency
      return 200;
    } else if (loadPerWorker < 0.8) {
      // Medium load: gradual increase
      return 200 + (loadPerWorker - 0.5) * 1000;
    } else if (loadPerWorker < 1.0) {
      // High load: exponential increase
      return 500 + Math.pow(loadPerWorker - 0.8, 2) * 5000;
    } else {
      // Overloaded: very high latency
      return 1000 + (loadPerWorker - 1.0) * 10000;
    }
  }

  private isBudgetExceeded(): boolean {
    return this.budgetSpent >= this.config.costConfig.maxCostPerHour;
  }

  private updateBudget(workerCount: number): void {
    // Calculate time elapsed in budget period
    const now = Date.now();
    const elapsedMs = now - this.budgetStartTime;

    // If budget period elapsed, reset
    if (elapsedMs >= this.config.costConfig.budgetPeriodMs) {
      this.resetBudget();
      return;
    }

    // Accumulate cost for this interval
    // Assuming this is called every ~10 seconds
    const intervalHours = 10 / 3600000;
    const intervalCost =
      workerCount * this.config.costConfig.costPerWorkerPerHour * intervalHours;

    this.budgetSpent += intervalCost;
  }

  private determineDirection(
    targetCount: number,
    workerState: WorkerPoolState
  ): ScaleDirection {
    if (targetCount > workerState.active) {
      return "up";
    } else if (targetCount < workerState.active) {
      return "down";
    }
    return "none";
  }

  private estimateTime(
    direction: ScaleDirection,
    targetCount: number,
    workerState: WorkerPoolState
  ): number {
    if (direction === "none") {
      return 0;
    }

    const countDiff = Math.abs(targetCount - workerState.active);
    const timePerWorker = direction === "up" ? 2000 : 5000;

    return countDiff * timePerWorker;
  }

  private noActionDecision(workerState: WorkerPoolState): ScaleDecision {
    return {
      direction: "none",
      targetCount: workerState.active,
      currentCount: workerState.active,
      reason: "Cost-optimized strategy is disabled",
      confidence: 0,
      triggeredBy: [],
      estimatedTimeMs: 0,
      isEmergency: false,
    };
  }

  private budgetExceededDecision(workerState: WorkerPoolState): ScaleDecision {
    return {
      direction: "down",
      targetCount: this.managerConfig.minWorkers,
      currentCount: workerState.active,
      reason: `Cost-optimized strategy: budget exceeded ($${this.budgetSpent.toFixed(2)} / $${this.config.costConfig.maxCostPerHour})`,
      confidence: 1.0,
      triggeredBy: ["cost_optimization", "budget_exceeded"],
      estimatedTimeMs: this.estimateTime(
        "down",
        this.managerConfig.minWorkers,
        workerState
      ),
      isEmergency: true,
    };
  }
}
