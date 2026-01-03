"use strict";
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConstraintSolver = exports.OptimizationStrategy = exports.ConstraintType = void 0;
exports.createDefaultConstraints = createDefaultConstraints;
exports.parseConstraint = parseConstraint;
exports.validateConstraint = validateConstraint;
/**
 * Constraint types for routing optimization
 *
 * These represent the different dimensions along which routing decisions
 * must be optimized.
 */
var ConstraintType;
(function (ConstraintType) {
    /** Privacy level required (0-1, higher = more private) */
    ConstraintType["PRIVACY"] = "privacy";
    /** Maximum cost allowed */
    ConstraintType["BUDGET"] = "budget";
    /** Thermal state of hardware */
    ConstraintType["THERMAL"] = "thermal";
    /** Maximum latency allowed (ms) */
    ConstraintType["LATENCY"] = "latency";
    /** Minimum quality required (0-1) */
    ConstraintType["QUALITY"] = "quality";
    /** Energy consumption (Joules) */
    ConstraintType["ENERGY"] = "energy";
    /** Battery level remaining (0-1) */
    ConstraintType["BATTERY"] = "battery";
})(ConstraintType || (exports.ConstraintType = ConstraintType = {}));
/**
 * Optimization strategies for multi-objective problems
 */
var OptimizationStrategy;
(function (OptimizationStrategy) {
    /** Find Pareto-optimal frontier (all non-dominated solutions) */
    OptimizationStrategy["PARETO"] = "pareto";
    /** Weighted sum of all objectives (scalarization) */
    OptimizationStrategy["WEIGHTED_SUM"] = "weighted_sum";
    /** Optimize in priority order (lexicographic) */
    OptimizationStrategy["LEXICOGRAPHIC"] = "lexicographic";
    /** Satisfy hard constraints first, then optimize soft */
    OptimizationStrategy["CONSTRAINT_PRIORITY"] = "constraint_priority";
})(OptimizationStrategy || (exports.OptimizationStrategy = OptimizationStrategy = {}));
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
var ConstraintSolver = /** @class */ (function () {
    function ConstraintSolver() {
    }
    /**
     * Solve constraint optimization problem
     *
     * @param options - Available routing options
     * @param constraints - Constraints to satisfy
     * @returns Optimization result with selected route
     */
    ConstraintSolver.prototype.solve = function (options, constraints) {
        // Validate inputs
        if (options.length === 0) {
            return {
                selectedRoute: null,
                score: 0,
                satisfiedConstraints: [],
                violatedConstraints: constraints.map(function (c) { return c.name; }),
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
        var feasible = this.filterByHardConstraints(options, constraints);
        if (feasible.length === 0) {
            // No feasible solution
            var violated_1 = this.findViolatedConstraints(options[0], constraints);
            return {
                selectedRoute: null,
                score: 0,
                satisfiedConstraints: [],
                violatedConstraints: violated_1,
                infeasibilityReason: "No routes satisfy all hard constraints",
            };
        }
        // Step 2: Apply optimization strategy
        var strategy = this.determineStrategy(constraints);
        var result = this.optimize(feasible, constraints, strategy);
        // Step 3: Track which constraints are satisfied
        var satisfied = [];
        var violated = [];
        for (var _i = 0, constraints_1 = constraints; _i < constraints_1.length; _i++) {
            var constraint = constraints_1[_i];
            if (result.selectedRoute &&
                this.satisfiesConstraint(result.selectedRoute, constraint)) {
                satisfied.push(constraint.name);
            }
            else {
                violated.push(constraint.name);
            }
        }
        return __assign(__assign({}, result), { satisfiedConstraints: satisfied, violatedConstraints: violated });
    };
    /**
     * Filter options by hard constraints
     *
     * @param options - All routing options
     * @param constraints - All constraints
     * @returns Options that satisfy all hard constraints
     */
    ConstraintSolver.prototype.filterByHardConstraints = function (options, constraints) {
        var _this = this;
        var hardConstraints = constraints.filter(function (c) { return c.isHard; });
        if (hardConstraints.length === 0) {
            // No hard constraints - all options feasible
            return options;
        }
        return options.filter(function (option) {
            return hardConstraints.every(function (constraint) {
                return _this.satisfiesConstraint(option, constraint);
            });
        });
    };
    /**
     * Check if an option satisfies a constraint
     *
     * @param option - Route option to check
     * @param constraint - Constraint to satisfy
     * @returns True if constraint is satisfied
     */
    ConstraintSolver.prototype.satisfiesConstraint = function (option, constraint) {
        switch (constraint.type) {
            case ConstraintType.BUDGET:
                return (constraint.maxValue !== undefined &&
                    option.estimatedCost <= constraint.maxValue);
            case ConstraintType.LATENCY:
                return (constraint.maxValue !== undefined &&
                    option.estimatedLatency <= constraint.maxValue);
            case ConstraintType.QUALITY:
                return (constraint.minValue !== undefined &&
                    option.estimatedQuality >= constraint.minValue);
            case ConstraintType.PRIVACY:
                return (constraint.minValue !== undefined &&
                    option.privacyLevel >= constraint.minValue);
            case ConstraintType.THERMAL:
                return (constraint.maxValue !== undefined &&
                    option.thermalImpact <= constraint.maxValue);
            case ConstraintType.ENERGY:
                return (constraint.maxValue !== undefined &&
                    option.energyConsumption <= constraint.maxValue);
            case ConstraintType.BATTERY:
                return (constraint.minValue !== undefined &&
                    option.estimatedQuality >= constraint.minValue);
            default:
                return true;
        }
    };
    /**
     * Find which constraints are violated
     *
     * @param option - Route option to check
     * @param constraints - All constraints
     * @returns Names of violated constraints
     */
    ConstraintSolver.prototype.findViolatedConstraints = function (option, constraints) {
        var violated = [];
        for (var _i = 0, constraints_2 = constraints; _i < constraints_2.length; _i++) {
            var constraint = constraints_2[_i];
            if (!this.satisfiesConstraint(option, constraint)) {
                violated.push(constraint.name);
            }
        }
        return violated;
    };
    /**
     * Determine optimization strategy from constraints
     *
     * @param constraints - All constraints
     * @returns Optimization strategy to use
     */
    ConstraintSolver.prototype.determineStrategy = function (constraints) {
        var hardCount = constraints.filter(function (c) { return c.isHard; }).length;
        if (hardCount > 0) {
            return OptimizationStrategy.CONSTRAINT_PRIORITY;
        }
        return OptimizationStrategy.WEIGHTED_SUM;
    };
    /**
     * Apply optimization strategy
     *
     * @param options - Feasible routing options
     * @param constraints - Constraints to optimize
     * @param strategy - Optimization strategy
     * @returns Optimization result
     */
    ConstraintSolver.prototype.optimize = function (options, constraints, strategy) {
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
    };
    /**
     * Weighted sum optimization (scalarization)
     *
     * Scores each option by weighted sum of normalized constraint scores.
     *
     * @param options - Feasible routing options
     * @param constraints - Constraints with weights
     * @returns Best option by weighted score
     */
    ConstraintSolver.prototype.weightedSumOptimization = function (options, constraints) {
        var bestOption = null;
        var bestScore = -Infinity;
        for (var _i = 0, options_1 = options; _i < options_1.length; _i++) {
            var option = options_1[_i];
            var score = 0;
            var totalWeight = 0;
            for (var _a = 0, constraints_3 = constraints; _a < constraints_3.length; _a++) {
                var constraint = constraints_3[_a];
                if (!constraint.isHard) {
                    // Only optimize soft constraints
                    var constraintScore = this.scoreOption(option, constraint);
                    score += constraintScore * constraint.weight;
                    totalWeight += constraint.weight;
                }
            }
            // Normalize by total weight
            if (totalWeight > 0) {
                score /= totalWeight;
            }
            else {
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
    };
    /**
     * Score an option on a single constraint
     *
     * Normalizes to 0-1 range, where higher is better.
     *
     * @param option - Route option to score
     * @param constraint - Constraint to score on
     * @returns Score (0-1)
     */
    ConstraintSolver.prototype.scoreOption = function (option, constraint) {
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
                    var normalized = option.estimatedCost / constraint.maxValue;
                    return Math.max(0, 1 - normalized);
                }
                return 0.5;
            case ConstraintType.LATENCY:
                // Latency: lower is better, invert
                if (constraint.maxValue) {
                    var normalized = option.estimatedLatency / constraint.maxValue;
                    return Math.max(0, 1 - normalized);
                }
                return 0.5;
            case ConstraintType.ENERGY:
                // Energy: lower is better, invert
                if (constraint.maxValue) {
                    var normalized = option.energyConsumption / constraint.maxValue;
                    return Math.max(0, 1 - normalized);
                }
                return 0.5;
            case ConstraintType.THERMAL:
                // Thermal: lower is better, invert
                if (constraint.maxValue) {
                    var normalized = option.thermalImpact / constraint.maxValue;
                    return Math.max(0, 1 - normalized);
                }
                return 0.5;
            case ConstraintType.BATTERY:
                // Battery: higher is better
                return option.estimatedQuality;
            default:
                return 0.5;
        }
    };
    /**
     * Constraint priority optimization
     *
     * Satisfies hard constraints first, then optimizes by soft constraints.
     *
     * @param options - Feasible routing options
     * @param constraints - All constraints
     * @returns Best option
     */
    ConstraintSolver.prototype.constraintPriorityOptimization = function (options, constraints) {
        // Same as weighted sum, but hard constraints already satisfied
        return this.weightedSumOptimization(options, constraints);
    };
    /**
     * Pareto optimization
     *
     * Finds all Pareto-optimal options (no option dominates another).
     *
     * @param options - Feasible routing options
     * @param constraints - Constraints to optimize
     * @returns Pareto frontier
     */
    ConstraintSolver.prototype.paretoOptimization = function (options, constraints) {
        // Find Pareto frontier (non-dominated options)
        var frontier = this.findParetoFrontier(options, constraints);
        // Return first option from frontier
        // In production, could use higher-level selection criteria
        return {
            selectedRoute: frontier[0] || null,
            score: 0,
            paretoFrontier: frontier,
        };
    };
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
    ConstraintSolver.prototype.findParetoFrontier = function (options, constraints) {
        var frontier = [];
        for (var _i = 0, options_2 = options; _i < options_2.length; _i++) {
            var candidate = options_2[_i];
            var isDominated = false;
            for (var _a = 0, options_3 = options; _a < options_3.length; _a++) {
                var other = options_3[_a];
                if (candidate === other)
                    continue;
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
    };
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
    ConstraintSolver.prototype.dominates = function (a, b, constraints) {
        var betterOnOne = false;
        var worseOnAny = false;
        for (var _i = 0, constraints_4 = constraints; _i < constraints_4.length; _i++) {
            var constraint = constraints_4[_i];
            if (constraint.isHard)
                continue;
            var scoreA = this.scoreOption(a, constraint);
            var scoreB = this.scoreOption(b, constraint);
            if (scoreA > scoreB) {
                betterOnOne = true;
            }
            else if (scoreA < scoreB) {
                worseOnAny = true;
                break;
            }
        }
        return betterOnOne && !worseOnAny;
    };
    /**
     * Lexicographic optimization
     *
     * Optimizes in priority order (highest weight first).
     *
     * @param options - Feasible routing options
     * @param constraints - Constraints with priorities
     * @returns Best option
     */
    ConstraintSolver.prototype.lexicographicOptimization = function (options, constraints) {
        var _this = this;
        // Sort constraints by weight (descending)
        var sortedConstraints = __spreadArray([], constraints, true).filter(function (c) { return !c.isHard; })
            .sort(function (a, b) { return b.weight - a.weight; });
        var candidates = options;
        var _loop_1 = function (constraint) {
            if (candidates.length <= 1)
                return "break";
            // Score candidates on this constraint
            var scored = candidates.map(function (option) { return ({
                option: option,
                score: _this.scoreOption(option, constraint),
            }); });
            // Find best score
            var bestScore = Math.max.apply(Math, scored.map(function (s) { return s.score; }));
            // Keep only candidates with best score
            candidates = scored.filter(function (s) { return s.score === bestScore; }).map(function (s) { return s.option; });
        };
        for (var _i = 0, sortedConstraints_1 = sortedConstraints; _i < sortedConstraints_1.length; _i++) {
            var constraint = sortedConstraints_1[_i];
            var state_1 = _loop_1(constraint);
            if (state_1 === "break")
                break;
        }
        return {
            selectedRoute: candidates[0] || null,
            score: 1,
        };
    };
    return ConstraintSolver;
}());
exports.ConstraintSolver = ConstraintSolver;
/**
 * Create default constraints for common scenarios
 *
 * @param scenario - Predefined scenario
 * @returns Constraint set for scenario
 */
function createDefaultConstraints(scenario) {
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
function parseConstraint(obj) {
    var _a, _b;
    return {
        name: obj.name,
        type: obj.type,
        weight: (_a = obj.weight) !== null && _a !== void 0 ? _a : 0.5,
        minValue: obj.minValue,
        maxValue: obj.maxValue,
        targetValue: obj.targetValue,
        isHard: (_b = obj.isHard) !== null && _b !== void 0 ? _b : false,
    };
}
/**
 * Validate constraint object
 *
 * @param constraint - Constraint to validate
 * @returns True if valid, false otherwise
 */
function validateConstraint(constraint) {
    // Check required fields
    if (!constraint.name || typeof constraint.name !== "string") {
        return false;
    }
    if (!Object.values(ConstraintType).includes(constraint.type)) {
        return false;
    }
    if (typeof constraint.weight !== "number" ||
        constraint.weight < 0 ||
        constraint.weight > 1) {
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
    if (constraint.minValue !== undefined &&
        constraint.maxValue !== undefined &&
        constraint.minValue > constraint.maxValue) {
        return false;
    }
    return true;
}
