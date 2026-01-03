/**
 * @lsi/core/tuning - MultiObjectiveOptimizer for Aequor Cognitive Orchestration Platform
 *
 * Multi-objective optimization implementation with:
 * - Pareto frontier optimization
 * - Trade-off analysis between multiple objectives
 * - Weighted objective functions
 * - Constraint satisfaction
 * - Solution selection based on preferences
 */

import {
  TunableParameter as AutoTunerParameter,
  PerformanceMetrics,
} from "./AutoTuner.js";

/**
 * Optimization objective definition
 */
export interface OptimizationObjective {
  /** Objective name */
  name: string;
  /** Weight (0-1) */
  weight: number;
  /** Whether to minimize or maximize */
  optimize: "minimize" | "maximize";
  /** Optional constraint */
  constraint?: Constraint;
}

/**
 * Constraint definition
 */
export interface Constraint {
  /** Constraint name */
  name: string;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Target value */
  target?: number;
  /** Tolerance from target */
  tolerance?: number;
}

/**
 * Tunable parameter wrapper for optimization
 */
export interface OptimizableParameter {
  /** Parameter name */
  name: string;
  /** Current value */
  currentValue: number;
  /** Minimum value */
  minValue: number;
  /** Maximum value */
  maxValue: number;
  /** Step size */
  stepSize: number;
}

/**
 * Solution to optimization problem
 */
export interface Solution {
  /** Parameter values */
  parameters: Map<string, number>;
  /** Objective values */
  objectives: Map<string, number>;
  /** Overall score (weighted sum) */
  score: number;
  /** Whether solution is feasible */
  feasible: boolean;
  /** Constraint violations */
  violations: string[];
}

/**
 * Pareto frontier result
 */
export interface ParetoFrontier {
  /** Non-dominated solutions */
  solutions: Solution[];
  /** Dominant solutions (Pareto optimal) */
  dominant: Solution[];
  /** Dominated solutions */
  dominated: Solution[];
  /** Number of objectives */
  numObjectives: number;
  /** Number of parameters */
  numParameters: number;
}

/**
 * Pareto-optimal solution
 */
export interface ParetoSolution extends Solution {
  /** Rank in Pareto front */
  rank: number;
  /** Crowding distance */
  crowdingDistance: number;
  /** Dominance count */
  dominanceCount: number;
}

/**
 * Trade-off analysis result
 */
export interface TradeoffAnalysis {
  /** Solution being analyzed */
  solution: Solution;
  /** Conflicting objectives */
  conflicts: {
    objective1: string;
    objective2: string;
    correlation: number;
    description: string;
  }[];
  /** Improvement suggestions */
  improvements: {
    objective: string;
    direction: "increase" | "decrease";
    parameters: string[];
    potentialGain: number;
  }[];
  /** Recommended actions */
  recommendations: string[];
}

/**
 * Preference for solution selection
 */
export interface Preference {
  /** Objective weights (overrides default weights) */
  weights?: Map<string, number>;
  /** Priority objectives (must be optimized first) */
  priorities?: string[];
  /** Acceptable ranges for objectives */
  ranges?: Map<string, { min: number; max: number }>;
  /** Threshold values (must exceed these) */
  thresholds?: Map<string, number>;
}

/**
 * Weighted solution result
 */
export interface WeightedSolution extends Solution {
  /** Weights used */
  weights: Map<string, number>;
  /** Weighted objective scores */
  weightedScores: Map<string, number>;
  /** Confidence in solution */
  confidence: number;
}

/**
 * Optimization options
 */
export interface OptimizationOptions {
  /** Maximum number of iterations */
  maxIterations: number;
  /** Population size for evolutionary algorithms */
  populationSize: number;
  /** Mutation rate */
  mutationRate: number;
  /** Crossover rate */
  crossoverRate: number;
  /** Convergence tolerance */
  tolerance: number;
}

/**
 * Default optimization options
 */
export const DEFAULT_OPTIMIZATION_OPTIONS: OptimizationOptions = {
  maxIterations: 100,
  populationSize: 50,
  mutationRate: 0.1,
  crossoverRate: 0.8,
  tolerance: 1e-6,
};

/**
 * MultiObjectiveOptimizer - Optimizes multiple conflicting objectives
 *
 * The MultiObjectiveOptimizer finds Pareto-optimal solutions when
 * multiple objectives conflict, allowing trade-off analysis and
 * preference-based solution selection.
 */
export class MultiObjectiveOptimizer {
  private objectives: OptimizationObjective[];
  private constraints: Constraint[];
  private options: OptimizationOptions;

  constructor(
    objectives: OptimizationObjective[],
    constraints: Constraint[] = [],
    options: Partial<OptimizationOptions> = {}
  ) {
    this.objectives = objectives;
    this.constraints = constraints;
    this.options = { ...DEFAULT_OPTIMIZATION_OPTIONS, ...options };

    // Normalize weights
    this.normalizeWeights();
  }

  /**
   * Find Pareto frontier from candidate solutions
   */
  find_pareto_frontier(solutions: Solution[]): ParetoFrontier {
    // Separate feasible solutions
    const feasible = solutions.filter(s => s.feasible);

    // Find non-dominated solutions
    const dominant: Solution[] = [];
    const dominated: Solution[] = [];

    for (const solution of feasible) {
      let isDominated = false;

      for (const other of feasible) {
        if (solution === other) continue;

        if (this.dominates(other, solution)) {
          isDominated = true;
          break;
        }
      }

      if (isDominated) {
        dominated.push(solution);
      } else {
        dominant.push(solution);
      }
    }

    return {
      solutions: feasible,
      dominant,
      dominated,
      numObjectives: this.objectives.length,
      numParameters: solutions[0]?.parameters.size || 0,
    };
  }

  /**
   * Check if solution1 dominates solution2
   */
  private dominates(solution1: Solution, solution2: Solution): boolean {
    let atLeastOneBetter = false;

    for (const objective of this.objectives) {
      const value1 = solution1.objectives.get(objective.name) ?? 0;
      const value2 = solution2.objectives.get(objective.name) ?? 0;

      if (objective.optimize === "maximize") {
        if (value1 < value2) {
          return false; // Worse in at least one objective
        }
        if (value1 > value2) {
          atLeastOneBetter = true; // Better in at least one objective
        }
      } else {
        if (value1 > value2) {
          return false; // Worse (for minimization)
        }
        if (value1 < value2) {
          atLeastOneBetter = true;
        }
      }
    }

    return atLeastOneBetter;
  }

  /**
   * Optimize parameters for Pareto frontier
   */
  optimize_pareto(
    parameters: OptimizableParameter[],
    constraints: Constraint[] = []
  ): ParetoSolution[] {
    // Generate initial population
    const population = this.generateInitialPopulation(parameters);

    // Evaluate objectives for all solutions
    const evaluatedPopulation = population.map(solution =>
      this.evaluateSolution(solution, constraints)
    );

    // Run NSGA-II algorithm
    let currentPopulation = evaluatedPopulation;
    for (let i = 0; i < this.options.maxIterations; i++) {
      // Create offspring
      const offspring = this.createOffspring(currentPopulation, parameters);

      // Evaluate offspring
      const evaluatedOffspring = offspring.map(solution =>
        this.evaluateSolution(solution, constraints)
      );

      // Combine populations
      const combined = [...currentPopulation, ...evaluatedOffspring];

      // Select next generation
      currentPopulation = this.selectNextGeneration(combined);

      // Check convergence
      if (this.hasConverged(currentPopulation)) {
        break;
      }
    }

    // Rank solutions and calculate crowding distance
    const paretoSolutions = this.rankParetoSolutions(currentPopulation);

    return paretoSolutions.filter(s => s.feasible);
  }

  /**
   * Generate initial population
   */
  private generateInitialPopulation(
    parameters: OptimizableParameter[]
  ): Solution[] {
    const population: Solution[] = [];

    for (let i = 0; i < this.options.populationSize; i++) {
      const paramValues = new Map<string, number>();

      for (const param of parameters) {
        // Random value within bounds
        const range = param.maxValue - param.minValue;
        const value = param.minValue + Math.random() * range;
        paramValues.set(param.name, this.quantize(value, param.stepSize));
      }

      population.push({
        parameters: paramValues,
        objectives: new Map(),
        score: 0,
        feasible: true,
        violations: [],
      });
    }

    return population;
  }

  /**
   * Quantize value to step size
   */
  private quantize(value: number, stepSize: number): number {
    return Math.round(value / stepSize) * stepSize;
  }

  /**
   * Evaluate solution
   */
  private evaluateSolution(
    solution: Solution,
    additionalConstraints: Constraint[]
  ): Solution {
    // Calculate objective values (simulated)
    const objectives = new Map<string, number>();

    for (const objective of this.objectives) {
      const value = this.calculateObjective(objective, solution.parameters);
      objectives.set(objective.name, value);
    }

    // Check constraints
    const violations: string[] = [];
    let feasible = true;

    const allConstraints = [...this.constraints, ...additionalConstraints];
    for (const constraint of allConstraints) {
      const violation = this.checkConstraint(
        constraint,
        solution.parameters,
        objectives
      );
      if (violation) {
        violations.push(violation);
        feasible = false;
      }
    }

    // Calculate weighted score
    let score = 0;
    let totalWeight = 0;

    for (const objective of this.objectives) {
      const value = objectives.get(objective.name) ?? 0;
      score += objective.weight * value;
      totalWeight += objective.weight;
    }

    score = totalWeight > 0 ? score / totalWeight : 0;

    return {
      ...solution,
      objectives,
      score,
      feasible,
      violations,
    };
  }

  /**
   * Calculate objective value (simulated)
   */
  private calculateObjective(
    objective: OptimizationObjective,
    parameters: Map<string, number>
  ): number {
    // Simulate objective calculation based on parameters
    // In a real implementation, this would use actual performance data

    const cacheMaxSize = parameters.get("cache.maxSize") || 1000;
    const cacheTTL = parameters.get("cache.ttl") || 600000;
    const cacheSimilarity = parameters.get("cache.similarityThreshold") || 0.85;
    const routingComplexity =
      parameters.get("routing.complexityThreshold") || 0.7;

    switch (objective.name) {
      case "latency":
        // Lower cache size and higher similarity threshold -> lower latency
        const baseLatency = 200;
        const cacheBenefit = (cacheMaxSize / 10000) * 50;
        const similarityBenefit = (cacheSimilarity - 0.7) * 200;
        return Math.max(50, baseLatency - cacheBenefit - similarityBenefit);

      case "throughput":
        // Higher cache size and TTL -> higher throughput
        const baseThroughput = 50;
        const cacheSizeBoost = (cacheMaxSize / 10000) * 100;
        const ttlBoost = (cacheTTL / 3600000) * 50;
        return baseThroughput + cacheSizeBoost + ttlBoost;

      case "quality":
        // Higher complexity threshold -> higher quality
        const baseQuality = 0.8;
        const complexityBoost = (routingComplexity - 0.3) * 0.3;
        return Math.min(1, baseQuality + complexityBoost);

      case "cost":
        // Higher cache size and TTL -> lower cost
        const baseCost = 0.01;
        const cacheSavings = (cacheMaxSize / 10000) * 0.005;
        const ttlSavings = (cacheTTL / 3600000) * 0.003;
        return Math.max(0.001, baseCost - cacheSavings - ttlSavings);

      default:
        return 0;
    }
  }

  /**
   * Check constraint
   */
  private checkConstraint(
    constraint: Constraint,
    parameters: Map<string, number>,
    objectives: Map<string, number>
  ): string | null {
    const value =
      objectives.get(constraint.name) ?? parameters.get(constraint.name);

    if (value === undefined) {
      return null;
    }

    if (constraint.min !== undefined && value < constraint.min) {
      return `${constraint.name} = ${value} < ${constraint.min}`;
    }

    if (constraint.max !== undefined && value > constraint.max) {
      return `${constraint.name} = ${value} > ${constraint.max}`;
    }

    if (constraint.target !== undefined) {
      const tolerance = constraint.tolerance ?? constraint.target * 0.1;
      const diff = Math.abs(value - constraint.target);
      if (diff > tolerance) {
        return `${constraint.name} = ${value} not within ${tolerance} of target ${constraint.target}`;
      }
    }

    return null;
  }

  /**
   * Create offspring using genetic operators
   */
  private createOffspring(
    population: Solution[],
    parameters: OptimizableParameter[]
  ): Solution[] {
    const offspring: Solution[] = [];

    while (offspring.length < this.options.populationSize) {
      // Select parents (tournament selection)
      const parent1 = this.tournamentSelect(population);
      const parent2 = this.tournamentSelect(population);

      // Crossover
      let childParams = this.crossover(
        parent1.parameters,
        parent2.parameters,
        this.options.crossoverRate
      );

      // Mutate
      childParams = this.mutate(
        childParams,
        parameters,
        this.options.mutationRate
      );

      offspring.push({
        parameters: childParams,
        objectives: new Map(),
        score: 0,
        feasible: true,
        violations: [],
      });
    }

    return offspring;
  }

  /**
   * Tournament selection
   */
  private tournamentSelect(population: Solution[]): Solution {
    const tournamentSize = 3;
    let best = population[Math.floor(Math.random() * population.length)];

    for (let i = 1; i < tournamentSize; i++) {
      const competitor =
        population[Math.floor(Math.random() * population.length)];
      if (
        competitor.feasible &&
        (!best.feasible || competitor.score > best.score)
      ) {
        best = competitor;
      }
    }

    return best;
  }

  /**
   * Crossover operator
   */
  private crossover(
    params1: Map<string, number>,
    params2: Map<string, number>,
    rate: number
  ): Map<string, number> {
    const child = new Map<string, number>();

    for (const [name, value1] of params1.entries()) {
      const value2 = params2.get(name) ?? value1;

      if (Math.random() < rate) {
        // Blend crossover
        const alpha = 0.5;
        const blended = alpha * value1 + (1 - alpha) * value2;
        child.set(name, blended);
      } else {
        child.set(name, value1);
      }
    }

    return child;
  }

  /**
   * Mutation operator
   */
  private mutate(
    params: Map<string, number>,
    parameters: OptimizableParameter[],
    rate: number
  ): Map<string, number> {
    const mutated = new Map(params);

    for (const param of parameters) {
      if (Math.random() < rate) {
        const currentValue = mutated.get(param.name) ?? param.currentValue;
        const range = param.maxValue - param.minValue;
        const delta = (Math.random() - 0.5) * range * 0.1; // 10% mutation
        const newValue = Math.max(
          param.minValue,
          Math.min(param.maxValue, currentValue + delta)
        );
        mutated.set(param.name, this.quantize(newValue, param.stepSize));
      }
    }

    return mutated;
  }

  /**
   * Select next generation using NSGA-II
   */
  private selectNextGeneration(population: Solution[]): Solution[] {
    // Sort by non-dominated fronts
    const fronts = this.fastNonDominatedSort(population);

    // Select individuals from fronts until population is filled
    const selected: Solution[] = [];
    let frontIndex = 0;

    while (
      selected.length < this.options.populationSize &&
      frontIndex < fronts.length
    ) {
      const front = fronts[frontIndex];

      if (selected.length + front.length <= this.options.populationSize) {
        selected.push(...front);
      } else {
        // Select from this front using crowding distance
        const remaining = this.options.populationSize - selected.length;
        const sorted = this.sortByCrowdingDistance(front);
        selected.push(...sorted.slice(0, remaining));
      }

      frontIndex++;
    }

    return selected;
  }

  /**
   * Fast non-dominated sort (NSGA-II)
   */
  private fastNonDominatedSort(population: Solution[]): Solution[][] {
    const fronts: Solution[][] = [];
    const dominationCounts = new Map<Solution, number>();
    const dominatedSets = new Map<Solution, Set<Solution>>();

    // Initialize
    for (const solution of population) {
      dominationCounts.set(solution, 0);
      dominatedSets.set(solution, new Set());
    }

    // Calculate domination
    for (const p of population) {
      for (const q of population) {
        if (p === q) continue;

        if (this.dominates(p, q)) {
          dominatedSets.get(p)!.add(q);
        } else if (this.dominates(q, p)) {
          dominationCounts.set(p, (dominationCounts.get(p) ?? 0) + 1);
        }
      }
    }

    // Build first front
    const firstFront: Solution[] = [];
    for (const solution of population) {
      if ((dominationCounts.get(solution) ?? 0) === 0) {
        firstFront.push(solution);
      }
    }
    fronts.push(firstFront);

    // Build subsequent fronts
    let currentFront = firstFront;
    while (currentFront.length > 0) {
      const nextFront: Solution[] = [];

      for (const p of currentFront) {
        const dominated = dominatedSets.get(p) ?? new Set();
        for (const q of dominated) {
          const count = (dominationCounts.get(q) ?? 0) - 1;
          dominationCounts.set(q, count);
          if (count === 0) {
            nextFront.push(q);
          }
        }
      }

      if (nextFront.length > 0) {
        fronts.push(nextFront);
      }
      currentFront = nextFront;
    }

    return fronts;
  }

  /**
   * Sort by crowding distance
   */
  private sortByCrowdingDistance(front: Solution[]): Solution[] {
    // Calculate crowding distance
    const distances = new Map<Solution, number>();

    for (const solution of front) {
      distances.set(solution, 0);
    }

    for (const objective of this.objectives) {
      // Sort by this objective
      const sorted = [...front].sort((a, b) => {
        const valA = a.objectives.get(objective.name) ?? 0;
        const valB = b.objectives.get(objective.name) ?? 0;
        return objective.optimize === "maximize" ? valB - valA : valA - valB;
      });

      // Set boundary distances to infinity
      if (sorted.length > 0) {
        distances.set(sorted[0]!, Infinity);
        distances.set(sorted[sorted.length - 1]!, Infinity);
      }

      // Calculate crowding distance
      const min = sorted[0]?.objectives.get(objective.name) ?? 0;
      const max =
        sorted[sorted.length - 1]?.objectives.get(objective.name) ?? 0;
      const range = max - min;

      if (range > 0) {
        for (let i = 1; i < sorted.length - 1; i++) {
          const current = distances.get(sorted[i]!) ?? 0;
          const prevVal = sorted[i - 1]?.objectives.get(objective.name) ?? 0;
          const nextVal = sorted[i + 1]?.objectives.get(objective.name) ?? 0;
          distances.set(sorted[i]!, current + (nextVal - prevVal) / range);
        }
      }
    }

    // Sort by distance (descending)
    return [...front].sort((a, b) => {
      const distA = distances.get(a) ?? 0;
      const distB = distances.get(b) ?? 0;
      return distB - distA;
    });
  }

  /**
   * Check convergence
   */
  private hasConverged(population: Solution[]): boolean {
    if (population.length < 2) {
      return true;
    }

    // Calculate variance in scores
    const scores = population.map(s => s.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;

    return variance < this.options.tolerance;
  }

  /**
   * Rank Pareto solutions
   */
  private rankParetoSolutions(solutions: Solution[]): ParetoSolution[] {
    const fronts = this.fastNonDominatedSort(solutions);
    const ranked: ParetoSolution[] = [];

    for (let rank = 0; rank < fronts.length; rank++) {
      const front = fronts[rank];

      // Calculate crowding distance
      const sorted = this.sortByCrowdingDistance(front);

      for (let i = 0; i < sorted.length; i++) {
        const solution = sorted[i]!;
        const dominanceCount = this.countDominance(solution, solutions);

        ranked.push({
          ...solution,
          rank,
          crowdingDistance:
            i === 0 || i === sorted.length - 1
              ? Infinity
              : this.calculateCrowdingDistance(solution, front),
          dominanceCount,
        });
      }
    }

    return ranked;
  }

  /**
   * Count how many solutions this solution dominates
   */
  private countDominance(solution: Solution, population: Solution[]): number {
    let count = 0;
    for (const other of population) {
      if (this.dominates(solution, other)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculate crowding distance for a solution
   */
  private calculateCrowdingDistance(
    solution: Solution,
    front: Solution[]
  ): number {
    let distance = 0;

    for (const objective of this.objectives) {
      const value = solution.objectives.get(objective.name) ?? 0;

      // Find neighbors in objective space
      const sorted = [...front].sort((a, b) => {
        const valA = a.objectives.get(objective.name) ?? 0;
        const valB = b.objectives.get(objective.name) ?? 0;
        return valA - valB;
      });

      const index = sorted.indexOf(solution);
      if (index === 0 || index === sorted.length - 1) {
        return Infinity;
      }

      const prevVal = sorted[index - 1]?.objectives.get(objective.name) ?? 0;
      const nextVal = sorted[index + 1]?.objectives.get(objective.name) ?? 0;
      const range =
        (sorted[sorted.length - 1]?.objectives.get(objective.name) ?? 0) -
        (sorted[0]?.objectives.get(objective.name) ?? 0);

      if (range > 0) {
        distance += (nextVal - prevVal) / range;
      }
    }

    return distance;
  }

  /**
   * Analyze trade-offs for a solution
   */
  analyze_tradeoffs(solution: Solution): TradeoffAnalysis {
    const conflicts: TradeoffAnalysis["conflicts"] = [];
    const improvements: TradeoffAnalysis["improvements"] = [];

    // Find conflicting objectives (negative correlation)
    for (let i = 0; i < this.objectives.length; i++) {
      for (let j = i + 1; j < this.objectives.length; j++) {
        const obj1 = this.objectives[i]!;
        const obj2 = this.objectives[j]!;

        // Check if objectives conflict (one maximize, one minimize)
        if (obj1.optimize !== obj2.optimize) {
          conflicts.push({
            objective1: obj1.name,
            objective2: obj2.name,
            correlation: -0.8,
            description: `Improving ${obj1.name} may degrade ${obj2.name}`,
          });
        }
      }
    }

    // Generate improvement suggestions
    for (const objective of this.objectives) {
      const value = solution.objectives.get(objective.name) ?? 0;

      if (objective.optimize === "maximize" && value < 0.8) {
        improvements.push({
          objective: objective.name,
          direction: "increase",
          parameters: this.getParametersForObjective(objective.name),
          potentialGain: (0.8 - value) * objective.weight,
        });
      } else if (objective.optimize === "minimize" && value > 0.2) {
        improvements.push({
          objective: objective.name,
          direction: "decrease",
          parameters: this.getParametersForObjective(objective.name),
          potentialGain: (value - 0.2) * objective.weight,
        });
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (conflicts.length > 0) {
      recommendations.push(
        "Consider trade-offs between conflicting objectives"
      );
    }
    if (improvements.length > 0) {
      const best = improvements.sort(
        (a, b) => b.potentialGain - a.potentialGain
      )[0];
      if (best) {
        recommendations.push(`Focus on ${best.objective} for maximum gain`);
      }
    }

    return {
      solution,
      conflicts,
      improvements,
      recommendations,
    };
  }

  /**
   * Get parameters affecting an objective
   */
  private getParametersForObjective(objectiveName: string): string[] {
    switch (objectiveName) {
      case "latency":
        return ["cache.maxSize", "cache.similarityThreshold"];
      case "throughput":
        return ["cache.maxSize", "cache.ttl"];
      case "quality":
        return ["routing.complexityThreshold", "routing.confidenceThreshold"];
      case "cost":
        return ["cache.maxSize", "cache.ttl"];
      default:
        return [];
    }
  }

  /**
   * Select optimal solution based on preferences
   */
  select_optimal(solutions: Solution[], preferences: Preference): Solution {
    // Filter by priorities if specified
    let candidates = solutions;
    if (preferences.priorities && preferences.priorities.length > 0) {
      candidates = solutions.filter(s => {
        for (const priority of preferences.priorities!) {
          const value = s.objectives.get(priority);
          const obj = this.objectives.find(o => o.name === priority);
          if (obj && value !== undefined) {
            if (obj.optimize === "maximize" && value < 0.5) return false;
            if (obj.optimize === "minimize" && value > 0.5) return false;
          }
        }
        return true;
      });
    }

    // Filter by thresholds if specified
    if (preferences.thresholds) {
      candidates = candidates.filter(s => {
        for (const [name, threshold] of preferences.thresholds!.entries()) {
          const value = s.objectives.get(name);
          if (value !== undefined && value < threshold) {
            return false;
          }
        }
        return true;
      });
    }

    // Use custom weights or default
    const weights =
      preferences.weights ||
      new Map(this.objectives.map(o => [o.name, o.weight]));

    // Calculate weighted scores
    const scored = candidates.map(s => {
      let score = 0;
      for (const [name, weight] of weights.entries()) {
        const value = s.objectives.get(name) ?? 0;
        score += weight * value;
      }
      return { solution: s, score };
    });

    // Return best
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.solution ?? solutions[0]!;
  }

  /**
   * Set objective weights
   */
  set_weights(weights: Record<string, number>): void {
    for (const [name, weight] of Object.entries(weights)) {
      const objective = this.objectives.find(o => o.name === name);
      if (objective) {
        objective.weight = weight;
      }
    }
    this.normalizeWeights();
  }

  /**
   * Normalize weights to sum to 1
   */
  private normalizeWeights(): void {
    const total = this.objectives.reduce((sum, obj) => sum + obj.weight, 0);
    if (total > 0) {
      for (const objective of this.objectives) {
        objective.weight /= total;
      }
    }
  }

  /**
   * Optimize using weighted sum method
   */
  optimize_weighted(parameters: OptimizableParameter[]): WeightedSolution {
    // Generate single best solution using weighted sum
    let bestSolution: Solution | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < this.options.maxIterations; i++) {
      // Generate candidate solution
      const paramValues = new Map<string, number>();
      for (const param of parameters) {
        const range = param.maxValue - param.minValue;
        const value = param.minValue + Math.random() * range;
        paramValues.set(param.name, this.quantize(value, param.stepSize));
      }

      const solution = this.evaluateSolution(
        {
          parameters: paramValues,
          objectives: new Map(),
          score: 0,
          feasible: true,
          violations: [],
        },
        []
      );

      if (solution.feasible && solution.score > bestScore) {
        bestScore = solution.score;
        bestSolution = solution;
      }
    }

    if (!bestSolution) {
      throw new Error("No feasible solution found");
    }

    // Calculate weighted scores
    const weightedScores = new Map<string, number>();
    for (const objective of this.objectives) {
      const value = bestSolution.objectives.get(objective.name) ?? 0;
      weightedScores.set(objective.name, objective.weight * value);
    }

    return {
      ...bestSolution,
      weights: new Map(this.objectives.map(o => [o.name, o.weight])),
      weightedScores,
      confidence: Math.min(1, bestSolution.feasible ? 0.8 : 0.3),
    };
  }

  /**
   * Get objectives
   */
  get_objectives(): OptimizationObjective[] {
    return [...this.objectives];
  }

  /**
   * Get constraints
   */
  get_constraints(): Constraint[] {
    return [...this.constraints];
  }

  /**
   * Add objective
   */
  add_objective(objective: OptimizationObjective): void {
    this.objectives.push(objective);
    this.normalizeWeights();
  }

  /**
   * Add constraint
   */
  add_constraint(constraint: Constraint): void {
    this.constraints.push(constraint);
  }

  /**
   * Remove objective
   */
  remove_objective(name: string): boolean {
    const index = this.objectives.findIndex(o => o.name === name);
    if (index >= 0) {
      this.objectives.splice(index, 1);
      this.normalizeWeights();
      return true;
    }
    return false;
  }

  /**
   * Remove constraint
   */
  remove_constraint(name: string): boolean {
    const index = this.constraints.findIndex(c => c.name === name);
    if (index >= 0) {
      this.constraints.splice(index, 1);
      return true;
    }
    return false;
  }
}

/**
 * Create a MultiObjectiveOptimizer
 */
export function createMultiObjectiveOptimizer(
  objectives: OptimizationObjective[],
  constraints?: Constraint[],
  options?: Partial<OptimizationOptions>
): MultiObjectiveOptimizer {
  return new MultiObjectiveOptimizer(objectives, constraints, options);
}
