/**
 * Auto Tuner
 * Automatically tunes parameters for optimal performance
 */

import type {
  AutoTunerConfig,
  TunableParameter,
  TuningResult,
  TuningIteration,
  SearchStrategy,
  TargetMetric,
} from "../types.js";

export class AutoTuner {
  private config: AutoTunerConfig;
  private history: TuningIteration[] = [];
  private bestParameters: Record<string, number> = {};
  private bestMetric: number | null = null;
  private startTime: number = 0;

  constructor(config: Partial<AutoTunerConfig> = {}) {
    this.config = {
      parameters: [],
      searchStrategy: "grid",
      maxIterations: 100,
      targetMetric: "latency",
      convergenceThreshold: 0.01,
      timeout: 300000, // 5 minutes
      ...config,
    };

    // Initialize best parameters
    for (const param of this.config.parameters) {
      this.bestParameters[param.name] = param.current;
    }
  }

  /**
   * Start tuning process
   */
  async tune(
    evaluate: (params: Record<string, number>) => Promise<number>
  ): Promise<TuningResult> {
    this.startTime = Date.now();
    this.history = [];
    this.bestMetric = null;

    const strategy = this.createStrategy();

    try {
      await strategy.search(this.config.parameters, evaluate);

      return {
        bestParameters: { ...this.bestParameters },
        bestMetric: this.bestMetric || 0,
        iterations: this.history.length,
        convergence: this.hasConverged(),
        history: [...this.history],
        duration: Date.now() - this.startTime,
      };
    } catch (error) {
      throw new Error(
        `Tuning failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get current best parameters
   */
  getBestParameters(): Record<string, number> {
    return { ...this.bestParameters };
  }

  /**
   * Get tuning history
   */
  getHistory(): TuningIteration[] {
    return [...this.history];
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private createStrategy(): SearchStrategyImpl {
    switch (this.config.searchStrategy) {
      case "grid":
        return new GridSearchStrategy(this);
      case "random":
        return new RandomSearchStrategy(this);
      case "bayesian":
        return new BayesianSearchStrategy(this);
      case "evolutionary":
        return new EvolutionarySearchStrategy(this);
      default:
        return new GridSearchStrategy(this);
    }
  }

  private updateBest(params: Record<string, number>, metric: number): void {
    // Lower is better for latency and memory, higher is better for throughput
    const isBetter =
      this.bestMetric === null ||
      (this.config.targetMetric === "latency" && metric < this.bestMetric) ||
      (this.config.targetMetric === "memory" && metric < this.bestMetric) ||
      (this.config.targetMetric === "throughput" && metric > this.bestMetric);

    if (isBetter) {
      this.bestParameters = { ...params };
      this.bestMetric = metric;
    }
  }

  private recordIteration(
    params: Record<string, number>,
    metric: number
  ): void {
    this.history.push({
      iteration: this.history.length,
      parameters: { ...params },
      metric,
      timestamp: Date.now() - this.startTime,
    });

    this.updateBest(params, metric);
  }

  private hasConverged(): boolean {
    if (this.history.length < 10) return false;

    // Check if the last N iterations have similar metrics
    const recentMetrics = this.history.slice(-10).map(h => h.metric);
    const variance = this.calculateVariance(recentMetrics);

    return variance < this.config.convergenceThreshold;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  }
}

// ============================================================================
// SEARCH STRATEGY INTERFACE
// ============================================================================

interface SearchStrategyImpl {
  search(
    parameters: TunableParameter[],
    evaluate: (params: Record<string, number>) => Promise<number>
  ): Promise<void>;
}

// ============================================================================
// GRID SEARCH
// ============================================================================

class GridSearchStrategy implements SearchStrategyImpl {
  constructor(private tuner: AutoTuner) {}

  async search(
    parameters: TunableParameter[],
    evaluate: (params: Record<string, number>) => Promise<number>
  ): Promise<void> {
    const combinations = this.generateGridCombinations(parameters);

    for (const params of combinations) {
      if (this.shouldStop()) break;

      const metric = await evaluate(params);
      this.tuner["recordIteration"](params, metric);
    }
  }

  private generateGridCombinations(
    parameters: TunableParameter[]
  ): Record<string, number>[] {
    const paramValues = parameters.map(param => {
      const values: number[] = [];
      for (let v = param.min; v <= param.max; v += param.step) {
        values.push(v);
      }
      return values;
    });

    const combinations: Record<string, number>[] = [];

    const generate = (index: number, current: Record<string, number>) => {
      if (index >= parameters.length) {
        combinations.push({ ...current });
        return;
      }

      for (const value of paramValues[index]) {
        current[parameters[index].name] = value;
        generate(index + 1, current);
      }
    };

    generate(0, {});
    return combinations;
  }

  private shouldStop(): boolean {
    const history = this.tuner["history"];
    const config = this.tuner["config"];

    return (
      history.length >= config.maxIterations ||
      Date.now() - this.tuner["startTime"] > config.timeout
    );
  }
}

// ============================================================================
// RANDOM SEARCH
// ============================================================================

class RandomSearchStrategy implements SearchStrategyImpl {
  constructor(private tuner: AutoTuner) {}

  async search(
    parameters: TunableParameter[],
    evaluate: (params: Record<string, number>) => Promise<number>
  ): Promise<void> {
    const config = this.tuner["config"];

    for (let i = 0; i < config.maxIterations; i++) {
      if (this.shouldStop()) break;

      const params = this.randomSample(parameters);
      const metric = await evaluate(params);
      this.tuner["recordIteration"](params, metric);
    }
  }

  private randomSample(parameters: TunableParameter[]): Record<string, number> {
    const params: Record<string, number> = {};

    for (const param of parameters) {
      if (param.type === "discrete") {
        const steps = Math.floor((param.max - param.min) / param.step);
        const randomStep = Math.floor(Math.random() * (steps + 1));
        params[param.name] = param.min + randomStep * param.step;
      } else {
        params[param.name] =
          param.min + Math.random() * (param.max - param.min);
      }
    }

    return params;
  }

  private shouldStop(): boolean {
    return Date.now() - this.tuner["startTime"] > this.tuner["config"].timeout;
  }
}

// ============================================================================
// BAYESIAN OPTIMIZATION (Simplified)
// ============================================================================

class BayesianSearchStrategy implements SearchStrategyImpl {
  private observations: Array<{
    params: Record<string, number>;
    metric: number;
  }> = [];

  constructor(private tuner: AutoTuner) {}

  async search(
    parameters: TunableParameter[],
    evaluate: (params: Record<string, number>) => Promise<number>
  ): Promise<void> {
    const config = this.tuner["config"];

    // Initial random samples
    const initialSamples = Math.min(10, config.maxIterations);
    for (let i = 0; i < initialSamples; i++) {
      const params = this.randomSample(parameters);
      const metric = await evaluate(params);
      this.tuner["recordIteration"](params, metric);
      this.observations.push({ params, metric });
    }

    // Bayesian optimization iterations
    for (let i = initialSamples; i < config.maxIterations; i++) {
      if (this.shouldStop()) break;

      // Acquisition function: Expected Improvement
      const params = this.suggestNext(parameters);
      const metric = await evaluate(params);
      this.tuner["recordIteration"](params, metric);
      this.observations.push({ params, metric });
    }
  }

  private randomSample(parameters: TunableParameter[]): Record<string, number> {
    const params: Record<string, number> = {};

    for (const param of parameters) {
      params[param.name] = param.min + Math.random() * (param.max - param.min);
    }

    return params;
  }

  private suggestNext(parameters: TunableParameter[]): Record<string, number> {
    // Simplified: sample around the best observation
    const sorted = [...this.observations].sort((a, b) => a.metric - b.metric);
    const best = sorted[0];

    const params: Record<string, number> = {};

    for (const param of parameters) {
      const bestValue = best.params[param.name] || param.current;
      const noise = (Math.random() - 0.5) * param.step * 2;
      params[param.name] = Math.max(
        param.min,
        Math.min(param.max, bestValue + noise)
      );
    }

    return params;
  }

  private shouldStop(): boolean {
    const tuner = this.tuner as any;
    return (
      tuner["history"].length >= tuner["config"].maxIterations ||
      Date.now() - tuner["startTime"] > tuner["config"].timeout ||
      tuner["hasConverged"]()
    );
  }
}

// ============================================================================
// EVOLUTIONARY STRATEGY
// ============================================================================

class EvolutionarySearchStrategy implements SearchStrategyImpl {
  private population: Array<{
    params: Record<string, number>;
    metric: number;
  }> = [];

  constructor(private tuner: AutoTuner) {}

  async search(
    parameters: TunableParameter[],
    evaluate: (params: Record<string, number>) => Promise<number>
  ): Promise<void> {
    const config = this.tuner["config"];
    const populationSize = 10;

    // Initialize population
    this.population = await this.initializePopulation(
      parameters,
      populationSize,
      evaluate
    );

    // Evolution loop
    let generation = 0;
    while (this.population.length > 0 && generation < config.maxIterations) {
      if (this.shouldStop()) break;

      // Select parents
      const parents = this.selectParents(4);

      // Create offspring
      const offspring = await this.createOffspring(
        parents,
        parameters,
        evaluate
      );

      // Survival selection
      this.population = this.survivalSelection(
        [...this.population, ...offspring],
        populationSize
      );

      generation++;
    }
  }

  private async initializePopulation(
    parameters: TunableParameter[],
    size: number,
    evaluate: (params: Record<string, number>) => Promise<number>
  ): Promise<Array<{ params: Record<string, number>; metric: number }>> {
    const population: Array<{
      params: Record<string, number>;
      metric: number;
    }> = [];

    for (let i = 0; i < size; i++) {
      const params = this.randomSample(parameters);
      const metric = await evaluate(params);
      this.tuner["recordIteration"](params, metric);
      population.push({ params, metric });
    }

    return population;
  }

  private randomSample(parameters: TunableParameter[]): Record<string, number> {
    const params: Record<string, number> = {};

    for (const param of parameters) {
      params[param.name] = param.min + Math.random() * (param.max - param.min);
    }

    return params;
  }

  private selectParents(
    count: number
  ): Array<{ params: Record<string, number>; metric: number }> {
    // Tournament selection
    const parents: Array<{ params: Record<string, number>; metric: number }> =
      [];

    for (let i = 0; i < count; i++) {
      const tournamentSize = 3;
      const tournament = [];

      for (let j = 0; j < tournamentSize; j++) {
        const idx = Math.floor(Math.random() * this.population.length);
        tournament.push(this.population[idx]);
      }

      tournament.sort((a, b) => a.metric - b.metric);
      parents.push(tournament[0]);
    }

    return parents;
  }

  private async createOffspring(
    parents: Array<{ params: Record<string, number>; metric: number }>,
    parameters: TunableParameter[],
    evaluate: (params: Record<string, number>) => Promise<number>
  ): Promise<Array<{ params: Record<string, number>; metric: number }>> {
    const offspring: Array<{ params: Record<string, number>; metric: number }> =
      [];

    // Crossover
    for (let i = 0; i < parents.length; i += 2) {
      const parent1 = parents[i];
      const parent2 = parents[i + 1] || parents[0];

      const childParams = this.crossover(
        parent1.params,
        parent2.params,
        parameters
      );
      const mutatedParams = this.mutate(childParams, parameters);

      const metric = await evaluate(mutatedParams);
      this.tuner["recordIteration"](mutatedParams, metric);
      offspring.push({ params: mutatedParams, metric });
    }

    return offspring;
  }

  private crossover(
    params1: Record<string, number>,
    params2: Record<string, number>,
    parameters: TunableParameter[]
  ): Record<string, number> {
    const child: Record<string, number> = {};

    for (const param of parameters) {
      // Uniform crossover
      child[param.name] =
        Math.random() < 0.5 ? params1[param.name] : params2[param.name];
    }

    return child;
  }

  private mutate(
    params: Record<string, number>,
    parameters: TunableParameter[]
  ): Record<string, number> {
    const mutated = { ...params };

    for (const param of parameters) {
      if (Math.random() < 0.2) {
        // 20% mutation rate
        const delta = (Math.random() - 0.5) * param.step * 4;
        mutated[param.name] = Math.max(
          param.min,
          Math.min(param.max, mutated[param.name] + delta)
        );
      }
    }

    return mutated;
  }

  private survivalSelection(
    population: Array<{ params: Record<string, number>; metric: number }>,
    size: number
  ): Array<{ params: Record<string, number>; metric: number }> {
    population.sort((a, b) => a.metric - b.metric);
    return population.slice(0, size);
  }

  private shouldStop(): boolean {
    const tuner = this.tuner as any;
    return (
      Date.now() - tuner["startTime"] > tuner["config"].timeout ||
      tuner["hasConverged"]()
    );
  }
}

// ============================================================================
// DEVICE TUNER
// ============================================================================

export class DeviceTuner {
  private deviceProfiles: Map<string, DeviceProfile> = new Map();

  /**
   * Tune parameters for a specific device
   */
  async tuneForDevice(
    device: GPUAdapter,
    parameters: TunableParameter[],
    evaluate: (params: Record<string, number>) => Promise<number>
  ): Promise<Record<string, number>> {
    const deviceInfo = this.getDeviceInfo(device);
    const profile = this.deviceProfiles.get(deviceInfo);

    if (profile) {
      return profile.optimalParameters;
    }

    // Run tuning for new device
    const tuner = new AutoTuner({
      parameters,
      searchStrategy: "bayesian",
      maxIterations: 50,
      targetMetric: "latency",
    });

    const result = await tuner.tune(evaluate);

    // Cache profile
    this.deviceProfiles.set(deviceInfo, {
      deviceInfo,
      optimalParameters: result.bestParameters,
      metric: result.bestMetric,
      timestamp: Date.now(),
    });

    return result.bestParameters;
  }

  private getDeviceInfo(device: GPUAdapter): string {
    return `${device.vendor || "unknown"}_${device.architecture || "unknown"}`;
  }
}

interface DeviceProfile {
  deviceInfo: string;
  optimalParameters: Record<string, number>;
  metric: number;
  timestamp: number;
}

// ============================================================================
// WORKGROUP TUNER
// ============================================================================

export class WorkgroupTuner {
  /**
   * Find optimal workgroup size for a compute shader
   */
  async findOptimalWorkgroupSize(
    shader: string,
    device: GPUDevice,
    workloadSize: [number, number, number],
    evaluate: (workgroupSize: [number, number, number]) => Promise<number>
  ): Promise<[number, number, number]> {
    const candidates = this.generateCandidates(workloadSize);

    let bestSize: [number, number, number] = [16, 16, 1];
    let bestMetric = Infinity;

    for (const size of candidates) {
      const metric = await evaluate(size);

      if (metric < bestMetric) {
        bestMetric = metric;
        bestSize = size;
      }
    }

    return bestSize;
  }

  private generateCandidates(
    maxSize: [number, number, number]
  ): [number, number, number][] {
    const candidates: [number, number, number][] = [];
    const sizes = [4, 8, 16, 32, 64];

    for (const x of sizes) {
      for (const y of sizes) {
        for (const z of [1, 2, 4, 8]) {
          if (x <= maxSize[0] && y <= maxSize[1] && z <= maxSize[2]) {
            candidates.push([x, y, z]);
          }
        }
      }
    }

    return candidates;
  }
}
