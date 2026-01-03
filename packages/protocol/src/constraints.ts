/**
 * Constraint Algebra for Multi-Objective Routing
 *
 * Treats routing as constrained optimization:
 * - Maximize quality
 * - Minimize cost
 * - Satisfy privacy, thermal, latency constraints
 *
 * This module provides the mathematical foundation for making optimal routing
 * decisions under multiple competing constraints.
 */

/**
 * Constraint types for routing optimization
 *
 * These represent the different dimensions along which routing decisions
 * must be optimized.
 */
export enum ConstraintType {
  /** Privacy level required (0-1, higher = more private) */
  PRIVACY = "privacy",
  /** Maximum cost allowed */
  BUDGET = "budget",
  /** Thermal state of hardware */
  THERMAL = "thermal",
  /** Maximum latency allowed (ms) */
  LATENCY = "latency",
  /** Minimum quality required (0-1) */
  QUALITY = "quality",
  /** Energy consumption (Joules) */
  ENERGY = "energy",
  /** Battery level remaining (0-1) */
  BATTERY = "battery",
}

/**
 * A single constraint in the optimization problem
 */
export interface Constraint {
  /** Human-readable name for this constraint */
  name: string;
  /** Type of constraint */
  type: ConstraintType;
  /** Relative importance (0-1, higher = more important) */
  weight: number;
  /** Lower bound (for quality, privacy, battery) */
  minValue?: number;
  /** Upper bound (for budget, latency, thermal, energy) */
  maxValue?: number;
  /** Preferred value (for optimization) */
  targetValue?: number;
  /** If true, must be satisfied (hard constraint) */
  isHard: boolean;
}

/**
 * Set of constraints with optimization strategy
 */
export interface ConstraintSet {
  /** All constraints in this set */
  constraints: Constraint[];
  /** How to optimize multiple objectives */
  optimizationStrategy: OptimizationStrategy;
}

/**
 * Optimization strategies for multi-objective problems
 */
export enum OptimizationStrategy {
  /** Find Pareto-optimal frontier (all non-dominated solutions) */
  PARETO = "pareto",
  /** Weighted sum of all objectives (scalarization) */
  WEIGHTED_SUM = "weighted_sum",
  /** Optimize in priority order (lexicographic) */
  LEXICOGRAPHIC = "lexicographic",
  /** Satisfy hard constraints first, then optimize soft */
  CONSTRAINT_PRIORITY = "constraint_priority",
}

/**
 * A routing option to be evaluated
 */
export interface RouteOption {
  /** Which backend to use */
  backend: "local" | "cloud";
  /** Model identifier */
  model: string;
  /** Estimated cost in USD */
  estimatedCost: number;
  /** Estimated latency in milliseconds */
  estimatedLatency: number;
  /** Estimated quality (0-1) */
  estimatedQuality: number;
  /** Privacy level (0-1, higher = more private) */
  privacyLevel: number;
  /** Energy consumption in Joules */
  energyConsumption: number;
  /** Thermal impact (0-1, higher = more heat) */
  thermalImpact: number;
}

/**
 * Result of constraint optimization
 */
export interface OptimizationResult {
  /** Selected route (null if infeasible) */
  selectedRoute: RouteOption | null;
  /** Score of selected route (0-1) */
  score: number;
  /** Names of satisfied constraints */
  satisfiedConstraints: string[];
  /** Names of violated constraints */
  violatedConstraints: string[];
  /** Explanation if infeasible */
  infeasibilityReason?: string;
  /** All Pareto-optimal routes (for PARETO strategy) */
  paretoFrontier?: RouteOption[];
}

/**
 * ConstraintSolver - Find optimal route under constraints
 *
 * This class implements constrained optimization to find the best
 * routing option that satisfies all constraints.
 *
 * Usage:
 * ```typescript
 * const solver = new ConstraintSolver();
 * const result = solver.solve(routeOptions, constraints);
 * if (result.selectedRoute) {
 *   // Use result.selectedRoute
 * } else {
 *   // Handle infeasibility: result.infeasibilityReason
 * }
 * ```
 */
export class ConstraintSolver {
  /**
   * Solve constraint optimization problem
   *
   * @param options - Available routing options
   * @param constraints - Constraints to satisfy
   * @returns Optimization result with selected route
   */
  solve(options: RouteOption[], constraints: Constraint[]): OptimizationResult {
    // Validate inputs
    if (options.length === 0) {
      return {
        selectedRoute: null,
        score: 0,
        satisfiedConstraints: [],
        violatedConstraints: constraints.map(c => c.name),
        infeasibilityReason: "No route options available",
      };
    }

    if (constraints.length === 0) {
      // No constraints - return first option
      return {
        selectedRoute: options[0],
        score: 1,
        satisfiedConstraints: [],
        violatedConstraints: [],
      };
    }

    // Step 1: Filter by hard constraints
    const feasible = this.filterByHardConstraints(options, constraints);

    if (feasible.length === 0) {
      // No feasible solution
      const violated = this.findViolatedConstraints(options[0], constraints);
      return {
        selectedRoute: null,
        score: 0,
        satisfiedConstraints: [],
        violatedConstraints: violated,
        infeasibilityReason: "No routes satisfy all hard constraints",
      };
    }

    // Step 2: Apply optimization strategy
    const strategy = this.determineStrategy(constraints);
    const result = this.optimize(feasible, constraints, strategy);

    // Step 3: Track which constraints are satisfied
    const satisfied: string[] = [];
    const violated: string[] = [];
    for (const constraint of constraints) {
      if (
        result.selectedRoute &&
        this.satisfiesConstraint(result.selectedRoute, constraint)
      ) {
        satisfied.push(constraint.name);
      } else {
        violated.push(constraint.name);
      }
    }

    return {
      ...result,
      satisfiedConstraints: satisfied,
      violatedConstraints: violated,
    };
  }

  /**
   * Filter options by hard constraints
   *
   * @param options - All routing options
   * @param constraints - All constraints
   * @returns Options that satisfy all hard constraints
   */
  private filterByHardConstraints(
    options: RouteOption[],
    constraints: Constraint[]
  ): RouteOption[] {
    const hardConstraints = constraints.filter(c => c.isHard);

    if (hardConstraints.length === 0) {
      // No hard constraints - all options feasible
      return options;
    }

    return options.filter(option => {
      return hardConstraints.every(constraint => {
        return this.satisfiesConstraint(option, constraint);
      });
    });
  }

  /**
   * Check if an option satisfies a constraint
   *
   * @param option - Route option to check
   * @param constraint - Constraint to satisfy
   * @returns True if constraint is satisfied
   */
  private satisfiesConstraint(
    option: RouteOption,
    constraint: Constraint
  ): boolean {
    switch (constraint.type) {
      case ConstraintType.BUDGET:
        return (
          constraint.maxValue !== undefined &&
          option.estimatedCost <= constraint.maxValue
        );

      case ConstraintType.LATENCY:
        return (
          constraint.maxValue !== undefined &&
          option.estimatedLatency <= constraint.maxValue
        );

      case ConstraintType.QUALITY:
        return (
          constraint.minValue !== undefined &&
          option.estimatedQuality >= constraint.minValue
        );

      case ConstraintType.PRIVACY:
        return (
          constraint.minValue !== undefined &&
          option.privacyLevel >= constraint.minValue
        );

      case ConstraintType.THERMAL:
        return (
          constraint.maxValue !== undefined &&
          option.thermalImpact <= constraint.maxValue
        );

      case ConstraintType.ENERGY:
        return (
          constraint.maxValue !== undefined &&
          option.energyConsumption <= constraint.maxValue
        );

      case ConstraintType.BATTERY:
        return (
          constraint.minValue !== undefined &&
          option.estimatedQuality >= constraint.minValue
        );

      default:
        return true;
    }
  }

  /**
   * Find which constraints are violated
   *
   * @param option - Route option to check
   * @param constraints - All constraints
   * @returns Names of violated constraints
   */
  private findViolatedConstraints(
    option: RouteOption,
    constraints: Constraint[]
  ): string[] {
    const violated: string[] = [];

    for (const constraint of constraints) {
      if (!this.satisfiesConstraint(option, constraint)) {
        violated.push(constraint.name);
      }
    }

    return violated;
  }

  /**
   * Determine optimization strategy from constraints
   *
   * @param constraints - All constraints
   * @returns Optimization strategy to use
   */
  private determineStrategy(constraints: Constraint[]): OptimizationStrategy {
    const hardCount = constraints.filter(c => c.isHard).length;
    if (hardCount > 0) {
      return OptimizationStrategy.CONSTRAINT_PRIORITY;
    }
    return OptimizationStrategy.WEIGHTED_SUM;
  }

  /**
   * Apply optimization strategy
   *
   * @param options - Feasible routing options
   * @param constraints - Constraints to optimize
   * @param strategy - Optimization strategy
   * @returns Optimization result
   */
  private optimize(
    options: RouteOption[],
    constraints: Constraint[],
    strategy: OptimizationStrategy
  ): Omit<OptimizationResult, "satisfiedConstraints" | "violatedConstraints"> {
    switch (strategy) {
      case OptimizationStrategy.WEIGHTED_SUM:
        return this.weightedSumOptimization(options, constraints);

      case OptimizationStrategy.CONSTRAINT_PRIORITY:
        return this.constraintPriorityOptimization(options, constraints);

      case OptimizationStrategy.PARETO:
        return this.paretoOptimization(options, constraints);

      case OptimizationStrategy.LEXICOGRAPHIC:
        return this.lexicographicOptimization(options, constraints);

      default:
        return this.weightedSumOptimization(options, constraints);
    }
  }

  /**
   * Weighted sum optimization (scalarization)
   *
   * Scores each option by weighted sum of normalized constraint scores.
   *
   * @param options - Feasible routing options
   * @param constraints - Constraints with weights
   * @returns Best option by weighted score
   */
  private weightedSumOptimization(
    options: RouteOption[],
    constraints: Constraint[]
  ): Omit<OptimizationResult, "satisfiedConstraints" | "violatedConstraints"> {
    let bestOption: RouteOption | null = null;
    let bestScore = -Infinity;

    for (const option of options) {
      let score = 0;
      let totalWeight = 0;

      for (const constraint of constraints) {
        if (!constraint.isHard) {
          // Only optimize soft constraints
          const constraintScore = this.scoreOption(option, constraint);
          score += constraintScore * constraint.weight;
          totalWeight += constraint.weight;
        }
      }

      // Normalize by total weight
      if (totalWeight > 0) {
        score /= totalWeight;
      } else {
        // No soft constraints - all equal
        score = 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestOption = option;
      }
    }

    return {
      selectedRoute: bestOption,
      score: bestScore,
    };
  }

  /**
   * Score an option on a single constraint
   *
   * Normalizes to 0-1 range, where higher is better.
   *
   * @param option - Route option to score
   * @param constraint - Constraint to score on
   * @returns Score (0-1)
   */
  private scoreOption(option: RouteOption, constraint: Constraint): number {
    // Normalize to 0-1 range
    switch (constraint.type) {
      case ConstraintType.QUALITY:
        // Quality: higher is better
        return option.estimatedQuality;

      case ConstraintType.PRIVACY:
        // Privacy: higher is better
        return option.privacyLevel;

      case ConstraintType.BUDGET:
        // Cost: lower is better, invert
        if (constraint.maxValue) {
          const normalized = option.estimatedCost / constraint.maxValue;
          return Math.max(0, 1 - normalized);
        }
        return 0.5;

      case ConstraintType.LATENCY:
        // Latency: lower is better, invert
        if (constraint.maxValue) {
          const normalized = option.estimatedLatency / constraint.maxValue;
          return Math.max(0, 1 - normalized);
        }
        return 0.5;

      case ConstraintType.ENERGY:
        // Energy: lower is better, invert
        if (constraint.maxValue) {
          const normalized = option.energyConsumption / constraint.maxValue;
          return Math.max(0, 1 - normalized);
        }
        return 0.5;

      case ConstraintType.THERMAL:
        // Thermal: lower is better, invert
        if (constraint.maxValue) {
          const normalized = option.thermalImpact / constraint.maxValue;
          return Math.max(0, 1 - normalized);
        }
        return 0.5;

      case ConstraintType.BATTERY:
        // Battery: higher is better
        return option.estimatedQuality;

      default:
        return 0.5;
    }
  }

  /**
   * Constraint priority optimization
   *
   * Satisfies hard constraints first, then optimizes by soft constraints.
   *
   * @param options - Feasible routing options
   * @param constraints - All constraints
   * @returns Best option
   */
  private constraintPriorityOptimization(
    options: RouteOption[],
    constraints: Constraint[]
  ): Omit<OptimizationResult, "satisfiedConstraints" | "violatedConstraints"> {
    // Same as weighted sum, but hard constraints already satisfied
    return this.weightedSumOptimization(options, constraints);
  }

  /**
   * Pareto optimization
   *
   * Finds all Pareto-optimal options (no option dominates another).
   *
   * @param options - Feasible routing options
   * @param constraints - Constraints to optimize
   * @returns Pareto frontier
   */
  private paretoOptimization(
    options: RouteOption[],
    constraints: Constraint[]
  ): Omit<OptimizationResult, "satisfiedConstraints" | "violatedConstraints"> {
    // Find Pareto frontier (non-dominated options)
    const frontier = this.findParetoFrontier(options, constraints);

    // Return first option from frontier
    // In production, could use higher-level selection criteria
    return {
      selectedRoute: frontier[0] || null,
      score: 0,
      paretoFrontier: frontier,
    };
  }

  /**
   * Find Pareto frontier from options
   *
   * An option is on the frontier if no other option dominates it
   * (i.e., is better on at least one criterion and not worse on any).
   *
   * @param options - All options
   * @param constraints - Constraints to optimize
   * @returns Non-dominated options
   */
  private findParetoFrontier(
    options: RouteOption[],
    constraints: Constraint[]
  ): RouteOption[] {
    const frontier: RouteOption[] = [];

    for (const candidate of options) {
      let isDominated = false;

      for (const other of options) {
        if (candidate === other) continue;

        // Check if 'other' dominates 'candidate'
        if (this.dominates(other, candidate, constraints)) {
          isDominated = true;
          break;
        }
      }

      if (!isDominated) {
        frontier.push(candidate);
      }
    }

    return frontier;
  }

  /**
   * Check if option A dominates option B
   *
   * A dominates B if:
   * - A is better than B on at least one criterion
   * - A is not worse than B on any criterion
   *
   * @param a - First option
   * @param b - Second option
   * @param constraints - Constraints to compare
   * @returns True if a dominates b
   */
  private dominates(
    a: RouteOption,
    b: RouteOption,
    constraints: Constraint[]
  ): boolean {
    let betterOnOne = false;
    let worseOnAny = false;

    for (const constraint of constraints) {
      if (constraint.isHard) continue;

      const scoreA = this.scoreOption(a, constraint);
      const scoreB = this.scoreOption(b, constraint);

      if (scoreA > scoreB) {
        betterOnOne = true;
      } else if (scoreA < scoreB) {
        worseOnAny = true;
        break;
      }
    }

    return betterOnOne && !worseOnAny;
  }

  /**
   * Lexicographic optimization
   *
   * Optimizes in priority order (highest weight first).
   *
   * @param options - Feasible routing options
   * @param constraints - Constraints with priorities
   * @returns Best option
   */
  private lexicographicOptimization(
    options: RouteOption[],
    constraints: Constraint[]
  ): Omit<OptimizationResult, "satisfiedConstraints" | "violatedConstraints"> {
    // Sort constraints by weight (descending)
    const sortedConstraints = [...constraints]
      .filter(c => !c.isHard)
      .sort((a, b) => b.weight - a.weight);

    let candidates = options;

    for (const constraint of sortedConstraints) {
      if (candidates.length <= 1) break;

      // Score candidates on this constraint
      const scored = candidates.map(option => ({
        option,
        score: this.scoreOption(option, constraint),
      }));

      // Find best score
      const bestScore = Math.max(...scored.map(s => s.score));

      // Keep only candidates with best score
      candidates = scored.filter(s => s.score === bestScore).map(s => s.option);
    }

    return {
      selectedRoute: candidates[0] || null,
      score: 1,
    };
  }
}

/**
 * Create default constraints for common scenarios
 *
 * @param scenario - Predefined scenario
 * @returns Constraint set for scenario
 */
export function createDefaultConstraints(
  scenario:
    | "cost_optimized"
    | "quality_optimized"
    | "balanced"
    | "privacy_first"
): Constraint[] {
  switch (scenario) {
    case "cost_optimized":
      return [
        {
          name: "budget",
          type: ConstraintType.BUDGET,
          weight: 0.8,
          maxValue: 0.01,
          isHard: false,
        },
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.2,
          minValue: 0.6,
          isHard: true,
        },
      ];

    case "quality_optimized":
      return [
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.8,
          minValue: 0.9,
          isHard: false,
        },
        {
          name: "latency",
          type: ConstraintType.LATENCY,
          weight: 0.2,
          maxValue: 2000,
          isHard: false,
        },
      ];

    case "balanced":
      return [
        {
          name: "budget",
          type: ConstraintType.BUDGET,
          weight: 0.25,
          maxValue: 0.01,
          isHard: false,
        },
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.25,
          minValue: 0.7,
          isHard: true,
        },
        {
          name: "latency",
          type: ConstraintType.LATENCY,
          weight: 0.25,
          maxValue: 1000,
          isHard: false,
        },
        {
          name: "privacy",
          type: ConstraintType.PRIVACY,
          weight: 0.25,
          minValue: 0.8,
          isHard: true,
        },
      ];

    case "privacy_first":
      return [
        {
          name: "privacy",
          type: ConstraintType.PRIVACY,
          weight: 0.6,
          minValue: 0.95,
          isHard: true,
        },
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.2,
          minValue: 0.7,
          isHard: false,
        },
        {
          name: "latency",
          type: ConstraintType.LATENCY,
          weight: 0.2,
          maxValue: 1500,
          isHard: false,
        },
      ];

    default:
      return [];
  }
}

/**
 * Parse constraint from simple object
 *
 * @param obj - Object with constraint properties
 * @returns Parsed constraint
 */
export function parseConstraint(obj: {
  name: string;
  type: string;
  weight?: number;
  minValue?: number;
  maxValue?: number;
  targetValue?: number;
  isHard?: boolean;
}): Constraint {
  return {
    name: obj.name,
    type: obj.type as ConstraintType,
    weight: obj.weight ?? 0.5,
    minValue: obj.minValue,
    maxValue: obj.maxValue,
    targetValue: obj.targetValue,
    isHard: obj.isHard ?? false,
  };
}

/**
 * Validate constraint object
 *
 * @param constraint - Constraint to validate
 * @returns True if valid, false otherwise
 */
export function validateConstraint(constraint: Constraint): boolean {
  // Check required fields
  if (!constraint.name || typeof constraint.name !== "string") {
    return false;
  }

  if (!Object.values(ConstraintType).includes(constraint.type)) {
    return false;
  }

  if (
    typeof constraint.weight !== "number" ||
    constraint.weight < 0 ||
    constraint.weight > 1
  ) {
    return false;
  }

  if (typeof constraint.isHard !== "boolean") {
    return false;
  }

  // Check bounds
  if (constraint.minValue !== undefined && constraint.minValue < 0) {
    return false;
  }

  if (constraint.maxValue !== undefined && constraint.maxValue < 0) {
    return false;
  }

  if (
    constraint.minValue !== undefined &&
    constraint.maxValue !== undefined &&
    constraint.minValue > constraint.maxValue
  ) {
    return false;
  }

  return true;
}
