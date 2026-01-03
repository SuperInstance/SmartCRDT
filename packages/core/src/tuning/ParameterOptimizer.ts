/**
 * @lsi/core/tuning - ParameterOptimizer for Aequor Cognitive Orchestration Platform
 *
 * The ParameterOptimizer implements multiple optimization algorithms:
 * - Bayesian optimization: Efficient global optimization using surrogate models
 * - Grid search: Exhaustive search for small parameter spaces
 * - Simulated annealing: Probabilistic optimization for escaping local optima
 */

import {
  TunableParameter,
  PerformanceMetrics,
  QueryHistory,
} from "./AutoTuner.js";

// Re-export types for convenience
export type { TunableParameter };
import { WorkloadPattern } from "./WorkloadAnalyzer.js";

/**
 * Optimization objective configuration
 */
export interface OptimizationObjective {
  /** Primary objective to maximize */
  primary: "latency" | "throughput" | "quality" | "cost" | "efficiency";

  /** Secondary objectives with weights */
  secondary: {
    metric: string;
    weight: number;
    maximize: boolean;
  }[];

  /** Target values for specific metrics */
  targets?: {
    metric: string;
    value: number;
  }[];
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  /** Recommended parameter values */
  parameters: Map<string, number>;

  /** Expected performance metrics */
  expectedMetrics: PerformanceMetrics;

  /** Confidence in recommendation (0-1) */
  confidence: number;

  /** Exploration vs exploitation ratio (0-1) */
  explorationRatio: number;

  /** Detailed recommendations */
  recommendations: OptimizationRecommendation[];
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
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
 * Optimization algorithm type
 */
export type OptimizationAlgorithm = "bayesian" | "grid" | "annealing";

/**
 * Parameter sample for Bayesian optimization
 */
interface ParameterSample {
  parameters: Map<string, number>;
  objectiveValue: number;
}

/**
 * Gaussian process for surrogate modeling
 */
class GaussianProcess {
  private kernel: (x1: number[], x2: number[]) => number;
  private noise: number = 0.01;

  constructor() {
    // RBF kernel
    this.kernel = (x1: number[], x2: number[]) => {
      const squaredDistance = x1.reduce(
        (sum, v, i) => sum + Math.pow(v - x2[i], 2),
        0
      );
      return Math.exp(-squaredDistance / 2);
    };
  }

  /**
   * Predict mean and variance for a point
   */
  predict(
    x: number[],
    X: number[][],
    y: number[]
  ): { mean: number; variance: number } {
    const n = X.length;

    if (n === 0) {
      return { mean: 0, variance: 1 };
    }

    // Compute kernel matrix
    const K: number[][] = [];
    for (let i = 0; i < n; i++) {
      K[i] = [];
      for (let j = 0; j < n; j++) {
        K[i][j] = this.kernel(X[i], X[j]);
      }
      K[i][i] += this.noise; // Add noise to diagonal
    }

    // Compute kernel vector
    const k: number[] = [];
    for (let i = 0; i < n; i++) {
      k[i] = this.kernel(X[i], x);
    }

    // Simple approximation (in production, use proper matrix operations)
    const mean = this.predictMean(k, y);
    const variance = this.predictVariance(k, K);

    return { mean, variance };
  }

  private predictMean(k: number[], y: number[]): number {
    // Simple weighted average (approximation)
    const sum = k.reduce((s, v, i) => s + v * y[i], 0);
    const weight = k.reduce((s, v) => s + v, 0);
    return weight > 0 ? sum / weight : 0;
  }

  private predictVariance(k: number[], K: number[][]): number {
    // Simplified variance calculation
    const kDotK = k.reduce((sum, v) => sum + v * v, 0);
    return Math.max(0, 1 - kDotK);
  }
}

/**
 * ParameterOptimizer - Optimizes tunable parameters
 *
 * The ParameterOptimizer uses multiple algorithms to find optimal
 * parameter values for the current workload and objective.
 */
export class ParameterOptimizer {
  private samples: ParameterSample[] = [];
  private gp: GaussianProcess;
  private algorithm: OptimizationAlgorithm = "bayesian";

  constructor() {
    this.gp = new GaussianProcess();
  }

  /**
   * Optimize parameters for current workload
   */
  async optimize(
    workload: WorkloadPattern | null,
    currentParameters: TunableParameter[],
    objective: OptimizationObjective
  ): Promise<OptimizationResult> {
    // Select algorithm based on parameter space size
    const paramSpace = currentParameters.reduce((product, p) => {
      const steps = (p.maxValue - p.minValue) / p.stepSize;
      return product * steps;
    }, 1);

    let algorithm: OptimizationAlgorithm;

    if (paramSpace < 1000) {
      algorithm = "grid";
    } else if (paramSpace < 100000) {
      algorithm = "bayesian";
    } else {
      algorithm = "annealing";
    }

    // Run optimization
    const optimizedParams = await this.runOptimization(
      algorithm,
      currentParameters,
      objective,
      workload
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      currentParameters,
      optimizedParams,
      objective,
      workload
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(recommendations, workload);

    // Estimate expected performance
    const expectedMetrics = this.estimateMetrics(
      optimizedParams,
      currentParameters,
      workload
    );

    return {
      parameters: optimizedParams,
      expectedMetrics,
      confidence,
      explorationRatio: this.calculateExplorationRatio(workload),
      recommendations,
    };
  }

  /**
   * Run the selected optimization algorithm
   */
  private async runOptimization(
    algorithm: OptimizationAlgorithm,
    parameters: TunableParameter[],
    objective: OptimizationObjective,
    workload: WorkloadPattern | null
  ): Promise<Map<string, number>> {
    switch (algorithm) {
      case "bayesian":
        return await this.bayesianOptimize(parameters, objective, workload);
      case "grid":
        return await this.gridSearch(parameters, objective, workload);
      case "annealing":
        return await this.simulatedAnnealing(parameters, objective, workload);
      default:
        return await this.bayesianOptimize(parameters, objective, workload);
    }
  }

  /**
   * Bayesian optimization using Gaussian process surrogate model
   */
  private async bayesianOptimize(
    parameters: TunableParameter[],
    objective: OptimizationObjective,
    workload: WorkloadPattern | null
  ): Promise<Map<string, number>> {
    const iterations = Math.min(50, parameters.length * 10);
    const bestParams = new Map<string, number>();

    // Initialize with current values
    for (const param of parameters) {
      bestParams.set(param.name, param.currentValue);
    }

    let bestValue = await this.evaluate(bestParams, objective, workload);
    this.samples.push({
      parameters: new Map(bestParams),
      objectiveValue: bestValue,
    });

    // Bayesian optimization loop
    for (let i = 0; i < iterations; i++) {
      // Generate candidate points
      const candidates = this.generateCandidates(parameters, 5);

      // Select best candidate using acquisition function (Expected Improvement)
      let bestCandidate = candidates[0];
      let bestEI = -Infinity;

      for (const candidate of candidates) {
        const ei = this.calculateExpectedImprovement(
          candidate,
          parameters,
          bestValue
        );

        if (ei > bestEI) {
          bestEI = ei;
          bestCandidate = candidate;
        }
      }

      // Evaluate candidate
      const value = await this.evaluate(bestCandidate, objective, workload);

      if (value > bestValue) {
        bestValue = value;
        for (const [name, val] of bestCandidate.entries()) {
          bestParams.set(name, val);
        }
      }

      // Add to samples
      this.samples.push({
        parameters: new Map(bestCandidate),
        objectiveValue: value,
      });

      // Keep only recent samples
      if (this.samples.length > 100) {
        this.samples = this.samples.slice(-100);
      }
    }

    return bestParams;
  }

  /**
   * Grid search for small parameter spaces
   */
  private async gridSearch(
    parameters: TunableParameter[],
    objective: OptimizationObjective,
    workload: WorkloadPattern | null
  ): Promise<Map<string, number>> {
    const bestParams = new Map<string, number>();
    let bestValue = -Infinity;

    // Generate grid points
    const grid = this.generateGrid(parameters);

    // Evaluate each point
    for (const point of grid) {
      const value = await this.evaluate(point, objective, workload);

      if (value > bestValue) {
        bestValue = value;
        for (const [name, val] of point.entries()) {
          bestParams.set(name, val);
        }
      }
    }

    return bestParams;
  }

  /**
   * Simulated annealing for large parameter spaces
   */
  private async simulatedAnnealing(
    parameters: TunableParameter[],
    objective: OptimizationObjective,
    workload: WorkloadPattern | null
  ): Promise<Map<string, number>> {
    // Initialize with current values
    let current = new Map<string, number>();
    for (const param of parameters) {
      current.set(param.name, param.currentValue);
    }

    let currentValue = await this.evaluate(current, objective, workload);

    let best = new Map(current);
    let bestValue = currentValue;

    // Annealing parameters
    const initialTemp = 1.0;
    const finalTemp = 0.01;
    const iterations = 100;
    const coolingRate = Math.pow(finalTemp / initialTemp, 1 / iterations);

    let temp = initialTemp;

    for (let i = 0; i < iterations; i++) {
      // Generate neighbor
      const neighbor = this.generateNeighbor(current, parameters);
      const neighborValue = await this.evaluate(neighbor, objective, workload);

      // Accept or reject
      const delta = neighborValue - currentValue;

      if (delta > 0 || Math.random() < Math.exp(delta / temp)) {
        current = neighbor;
        currentValue = neighborValue;

        if (currentValue > bestValue) {
          best = new Map(current);
          bestValue = currentValue;
        }
      }

      // Cool down
      temp *= coolingRate;
    }

    return best;
  }

  /**
   * Evaluate parameter configuration
   */
  private async evaluate(
    parameters: Map<string, number>,
    objective: OptimizationObjective,
    workload: WorkloadPattern | null
  ): Promise<number> {
    // Simulate performance based on parameters
    const metrics = this.simulateMetrics(parameters, workload);

    // Calculate objective score
    let score = 0;

    switch (objective.primary) {
      case "latency":
        score += -Math.log(metrics.latency.p95 + 1) * 100;
        break;
      case "throughput":
        score += metrics.throughput;
        break;
      case "quality":
        score += metrics.qualityScore * 100;
        break;
      case "cost":
        score += -metrics.costPerRequest * 1000;
        break;
      case "efficiency":
        score += metrics.throughput / (metrics.costPerRequest * 1000 + 1);
        break;
    }

    // Add secondary objectives
    for (const sec of objective.secondary) {
      let value = 0;

      switch (sec.metric) {
        case "latency":
          value = -metrics.latency.p95;
          break;
        case "throughput":
          value = metrics.throughput;
          break;
        case "quality":
          value = metrics.qualityScore * 100;
          break;
        case "cost":
          value = -metrics.costPerRequest * 1000;
          break;
      }

      score += (sec.maximize ? value : -value) * sec.weight;
    }

    // Check targets
    if (objective.targets) {
      for (const target of objective.targets) {
        let value = 0;

        switch (target.metric) {
          case "latency":
            value = metrics.latency.p95;
            break;
          case "throughput":
            value = metrics.throughput;
            break;
          case "quality":
            value = metrics.qualityScore * 100;
            break;
        }

        // Penalize distance from target
        const distance = Math.abs(value - target.value);
        score -= distance;
      }
    }

    return score;
  }

  /**
   * Simulate performance metrics for a parameter configuration
   */
  private simulateMetrics(
    parameters: Map<string, number>,
    workload: WorkloadPattern | null
  ): PerformanceMetrics {
    // Get parameter values
    const cacheMaxSize = parameters.get("cache.maxSize") || 1000;
    const cacheTTL = parameters.get("cache.ttl") || 600000;
    const cacheThreshold = parameters.get("cache.similarityThreshold") || 0.85;
    const complexityThreshold =
      parameters.get("routing.complexityThreshold") || 0.7;
    const confidenceThreshold =
      parameters.get("routing.confidenceThreshold") || 0.6;

    // Simulate cache hit rate based on cache size
    const baseHitRate = 0.5;
    const sizeBonus = Math.min(0.3, (cacheMaxSize - 1000) / 10000);
    const ttlBonus = Math.min(0.1, (cacheTTL - 600000) / 3000000);
    const thresholdBonus = (cacheThreshold - 0.7) * 2;
    const hitRate = Math.min(
      0.95,
      baseHitRate + sizeBonus + ttlBonus + thresholdBonus
    );

    // Simulate latency
    const baseLatency = 100;
    const cacheBenefit = hitRate * 80;
    const latency = Math.max(10, baseLatency - cacheBenefit);

    // Simulate throughput
    const baseThroughput = 50;
    const throughput = baseThroughput * (1 + hitRate);

    // Simulate quality
    const baseQuality = 0.85;
    const quality = baseQuality + hitRate * 0.1;

    // Simulate cost
    const baseCost = 0.001;
    const cost = baseCost * (1 - hitRate * 0.5);

    // Simulate resource usage
    const memory = 512 + (cacheMaxSize / 10000) * 1024;
    const cpuPercent = 30 + (1 - hitRate) * 20;

    return {
      latency: {
        p50: latency * 0.7,
        p95: latency,
        p99: latency * 1.3,
      },
      throughput,
      errorRate: 0.01,
      qualityScore: Math.min(1, quality),
      costPerRequest: cost,
      resourceUsage: {
        memoryMB: memory,
        cpuPercent,
      },
    };
  }

  /**
   * Generate candidate parameter points
   */
  private generateCandidates(
    parameters: TunableParameter[],
    count: number
  ): Map<string, number>[] {
    const candidates: Map<string, number>[] = [];

    for (let i = 0; i < count; i++) {
      const candidate = new Map<string, number>();

      for (const param of parameters) {
        const range = param.maxValue - param.minValue;
        const randomOffset = Math.random() * range;
        const steppedValue =
          Math.round(randomOffset / param.stepSize) * param.stepSize;
        candidate.set(param.name, param.minValue + steppedValue);
      }

      candidates.push(candidate);
    }

    return candidates;
  }

  /**
   * Calculate Expected Improvement (acquisition function)
   */
  private calculateExpectedImprovement(
    candidate: Map<string, number>,
    parameters: TunableParameter[],
    bestValue: number
  ): number {
    if (this.samples.length === 0) {
      return 1;
    }

    // Convert candidate to array
    const x = Array.from(candidate.values());

    // Build training data
    const X: number[][] = [];
    const y: number[] = [];

    for (const sample of this.samples) {
      X.push(Array.from(sample.parameters.values()));
      y.push(sample.objectiveValue);
    }

    // Predict using Gaussian process
    const { mean, variance } = this.gp.predict(x, X, y);

    // Calculate Expected Improvement
    const improvement = mean - bestValue;
    const std = Math.sqrt(variance);

    if (std === 0) {
      return 0;
    }

    const z = improvement / std;
    const ei = improvement * this.cdf(z) + std * this.pdf(z);

    return ei;
  }

  /**
   * Generate grid for grid search
   */
  private generateGrid(parameters: TunableParameter[]): Map<string, number>[] {
    const grid: Map<string, number>[] = [];

    // For simplicity, generate a limited grid
    const paramValues = parameters.map(param => {
      const values: number[] = [];
      const steps = Math.min(
        5,
        Math.ceil((param.maxValue - param.minValue) / param.stepSize)
      );

      for (let i = 0; i < steps; i++) {
        const value =
          param.minValue +
          (i * (param.maxValue - param.minValue)) / (steps - 1);
        values.push(value);
      }

      return values;
    });

    // Generate all combinations
    this.generateCombinations(
      paramValues,
      0,
      new Map<string, number>(),
      grid,
      parameters
    );

    return grid;
  }

  /**
   * Recursive combination generation
   */
  private generateCombinations(
    paramValues: number[][],
    index: number,
    current: Map<string, number>,
    results: Map<string, number>[],
    parameters: TunableParameter[]
  ): void {
    if (index >= paramValues.length) {
      results.push(new Map(current));
      return;
    }

    for (const value of paramValues[index]) {
      current.set(parameters[index].name, value);
      this.generateCombinations(
        paramValues,
        index + 1,
        current,
        results,
        parameters
      );
    }
  }

  /**
   * Generate neighbor for simulated annealing
   */
  private generateNeighbor(
    current: Map<string, number>,
    parameters: TunableParameter[]
  ): Map<string, number> {
    const neighbor = new Map<string, number>(current);

    // Randomly select a parameter to modify
    const paramIndex = Math.floor(Math.random() * parameters.length);
    const param = parameters[paramIndex];

    // Randomly step up or down
    const direction = Math.random() > 0.5 ? 1 : -1;
    const newValue = param.currentValue + direction * param.stepSize;

    // Clamp to valid range
    const clampedValue = Math.max(
      param.minValue,
      Math.min(param.maxValue, newValue)
    );

    neighbor.set(param.name, clampedValue);

    return neighbor;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    currentParameters: TunableParameter[],
    optimizedParams: Map<string, number>,
    objective: OptimizationObjective,
    workload: WorkloadPattern | null
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    for (const param of currentParameters) {
      const currentValue = param.currentValue;
      const recommendedValue = optimizedParams.get(param.name) || currentValue;

      if (Math.abs(recommendedValue - currentValue) < param.stepSize / 2) {
        continue;
      }

      const improvement = this.estimateImprovement(
        param,
        recommendedValue,
        workload
      );
      const confidence = this.calculateParameterConfidence(param, workload);

      let reason = "";

      if (param.category === "cache") {
        reason = `Cache ${param.name.split(".")[1]} adjustment for ${workload?.patternType || "current"} workload`;
      } else if (param.category === "routing") {
        reason = `Routing threshold optimized for ${objective.primary} objective`;
      } else if (param.category === "thermal") {
        reason = `Thermal parameter tuned for optimal performance`;
      } else {
        reason = `${param.category} parameter optimized based on workload analysis`;
      }

      recommendations.push({
        parameter: param.name,
        currentValue,
        recommendedValue,
        expectedImprovement: improvement,
        confidence,
        reason,
      });
    }

    return recommendations.sort(
      (a, b) => b.expectedImprovement - a.expectedImprovement
    );
  }

  /**
   * Estimate improvement for a parameter change
   */
  estimateImprovement(
    parameter: TunableParameter,
    newValue: number,
    workload: WorkloadPattern | null
  ): number {
    // Estimate based on parameter impact and change magnitude
    const changePercent =
      Math.abs(newValue - parameter.currentValue) / parameter.currentValue;
    const estimatedImpact = parameter.impactEstimate;

    // Adjust based on workload predictability
    const workloadFactor = workload?.predictability || 0.5;

    return Math.min(1, changePercent * estimatedImpact * workloadFactor * 2);
  }

  /**
   * Calculate confidence in recommendations
   */
  private calculateConfidence(
    recommendations: OptimizationRecommendation[],
    workload: WorkloadPattern | null
  ): number {
    if (recommendations.length === 0) {
      return 0;
    }

    // Average confidence across recommendations
    const avgConfidence =
      recommendations.reduce((sum, r) => sum + r.confidence, 0) /
      recommendations.length;

    // Adjust based on workload predictability
    const workloadFactor = workload?.predictability || 0.5;

    return avgConfidence * 0.7 + workloadFactor * 0.3;
  }

  /**
   * Calculate confidence for a specific parameter
   */
  private calculateParameterConfidence(
    parameter: TunableParameter,
    workload: WorkloadPattern | null
  ): number {
    let confidence = parameter.impactEstimate;

    // Adjust based on workload
    if (workload) {
      if (parameter.category === "cache" && workload.cacheHitRate > 0.7) {
        confidence *= 1.2;
      }

      if (parameter.category === "routing" && workload.predictability > 0.7) {
        confidence *= 1.1;
      }
    }

    return Math.min(1, confidence);
  }

  /**
   * Calculate exploration vs exploitation ratio
   */
  private calculateExplorationRatio(workload: WorkloadPattern | null): number {
    if (!workload) {
      return 0.3;
    }

    // Higher exploration for less predictable workloads
    return 1 - workload.predictability;
  }

  /**
   * Estimate expected performance metrics
   */
  private estimateMetrics(
    optimizedParams: Map<string, number>,
    currentParameters: TunableParameter[],
    workload: WorkloadPattern | null
  ): PerformanceMetrics {
    return this.simulateMetrics(optimizedParams, workload);
  }

  /**
   * Standard normal CDF
   */
  private cdf(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const p =
      d *
      t *
      (0.3193815 +
        t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    return x > 0 ? 1 - p : p;
  }

  /**
   * Standard normal PDF
   */
  private pdf(x: number): number {
    return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  }
}

/**
 * Create a ParameterOptimizer
 */
export function createParameterOptimizer(): ParameterOptimizer {
  return new ParameterOptimizer();
}
