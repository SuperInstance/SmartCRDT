/**
 * Constraint Solver Tests
 *
 * Tests for constraint algebra, optimization strategies,
 * and multi-objective routing decisions.
 */

import { describe, it, expect } from 'vitest';
import {
  ConstraintType,
  OptimizationStrategy,
  type Constraint,
  type ConstraintSet,
  type RouteOption,
  type OptimizationResult,
  ConstraintSolver,
  parseConstraint,
  validateConstraint,
  createDefaultConstraints,
} from '../src/constraints.js';

describe('Constraint Types', () => {
  it('should accept PRIVACY constraint', () => {
    const constraint: Constraint = {
      name: 'High Privacy',
      type: ConstraintType.PRIVACY,
      weight: 0.9,
      minValue: 0.8,
      isHard: true,
    };

    expect(constraint.type).toBe(ConstraintType.PRIVACY);
    expect(constraint.minValue).toBe(0.8);
  });

  it('should accept BUDGET constraint', () => {
    const constraint: Constraint = {
      name: 'Cost Limit',
      type: ConstraintType.BUDGET,
      weight: 0.7,
      maxValue: 0.1,
      isHard: true,
    };

    expect(constraint.type).toBe(ConstraintType.BUDGET);
    expect(constraint.maxValue).toBe(0.1);
  });

  it('should accept THERMAL constraint', () => {
    const constraint: Constraint = {
      name: 'Thermal Limit',
      type: ConstraintType.THERMAL,
      weight: 0.8,
      maxValue: 0.7,
      isHard: true,
    };

    expect(constraint.type).toBe(ConstraintType.THERMAL);
  });

  it('should accept LATENCY constraint', () => {
    const constraint: Constraint = {
      name: 'Low Latency',
      type: ConstraintType.LATENCY,
      weight: 0.9,
      maxValue: 500,
      isHard: false,
    };

    expect(constraint.type).toBe(ConstraintType.LATENCY);
  });

  it('should accept QUALITY constraint', () => {
    const constraint: Constraint = {
      name: 'High Quality',
      type: ConstraintType.QUALITY,
      weight: 0.8,
      minValue: 0.8,
      isHard: false,
    };

    expect(constraint.type).toBe(ConstraintType.QUALITY);
  });

  it('should accept ENERGY constraint', () => {
    const constraint: Constraint = {
      name: 'Energy Efficient',
      type: ConstraintType.ENERGY,
      weight: 0.6,
      maxValue: 100,
      isHard: false,
    };

    expect(constraint.type).toBe(ConstraintType.ENERGY);
  });

  it('should accept BATTERY constraint', () => {
    const constraint: Constraint = {
      name: 'Battery Saver',
      type: ConstraintType.BATTERY,
      weight: 0.7,
      minValue: 0.2,
      isHard: true,
    };

    expect(constraint.type).toBe(ConstraintType.BATTERY);
  });

  it('should accept constraint with target value', () => {
    const constraint: Constraint = {
      name: 'Target Quality',
      type: ConstraintType.QUALITY,
      weight: 0.8,
      targetValue: 0.85,
      isHard: false,
    };

    expect(constraint.targetValue).toBe(0.85);
  });

  it('should accept hard constraint', () => {
    const constraint: Constraint = {
      name: 'Must Have Privacy',
      type: ConstraintType.PRIVACY,
      weight: 1.0,
      minValue: 0.9,
      isHard: true,
    };

    expect(constraint.isHard).toBe(true);
  });

  it('should accept soft constraint', () => {
    const constraint: Constraint = {
      name: 'Prefer Low Cost',
      type: ConstraintType.BUDGET,
      weight: 0.5,
      maxValue: 0.05,
      isHard: false,
    };

    expect(constraint.isHard).toBe(false);
  });

  it('should accept weight of 0', () => {
    const constraint: Constraint = {
      name: 'Ignored',
      type: ConstraintType.ENERGY,
      weight: 0,
      maxValue: 1000,
      isHard: false,
    };

    expect(constraint.weight).toBe(0);
  });

  it('should accept weight of 1', () => {
    const constraint: Constraint = {
      name: 'Critical',
      type: ConstraintType.PRIVACY,
      weight: 1,
      minValue: 0.95,
      isHard: true,
    };

    expect(constraint.weight).toBe(1);
  });
});

describe('ConstraintSet', () => {
  it('should create valid constraint set', () => {
    const constraintSet: ConstraintSet = {
      constraints: [
        {
          name: 'Privacy',
          type: ConstraintType.PRIVACY,
          weight: 0.8,
          minValue: 0.7,
          isHard: true,
        },
        {
          name: 'Cost',
          type: ConstraintType.BUDGET,
          weight: 0.6,
          maxValue: 0.1,
          isHard: false,
        },
      ],
      optimizationStrategy: OptimizationStrategy.WEIGHTED_SUM,
    };

    expect(constraintSet.constraints.length).toBe(2);
    expect(constraintSet.optimizationStrategy).toBe(OptimizationStrategy.WEIGHTED_SUM);
  });

  it('should accept empty constraint set', () => {
    const constraintSet: ConstraintSet = {
      constraints: [],
      optimizationStrategy: OptimizationStrategy.WEIGHTED_SUM,
    };

    expect(constraintSet.constraints).toEqual([]);
  });

  it('should accept PARETO strategy', () => {
    const constraintSet: ConstraintSet = {
      constraints: [],
      optimizationStrategy: OptimizationStrategy.PARETO,
    };

    expect(constraintSet.optimizationStrategy).toBe(OptimizationStrategy.PARETO);
  });

  it('should accept LEXICOGRAPHIC strategy', () => {
    const constraintSet: ConstraintSet = {
      constraints: [],
      optimizationStrategy: OptimizationStrategy.LEXICOGRAPHIC,
    };

    expect(constraintSet.optimizationStrategy).toBe(OptimizationStrategy.LEXICOGRAPHIC);
  });

  it('should accept CONSTRAINT_PRIORITY strategy', () => {
    const constraintSet: ConstraintSet = {
      constraints: [],
      optimizationStrategy: OptimizationStrategy.CONSTRAINT_PRIORITY,
    };

    expect(constraintSet.optimizationStrategy).toBe(OptimizationStrategy.CONSTRAINT_PRIORITY);
  });
});

describe('RouteOption', () => {
  it('should create local route option', () => {
    const route: RouteOption = {
      backend: 'local',
      model: 'llama3.2',
      estimatedCost: 0,
      estimatedLatency: 100,
      estimatedQuality: 0.7,
      privacyLevel: 1.0,
      energyConsumption: 50,
      thermalImpact: 0.3,
    };

    expect(route.backend).toBe('local');
    expect(route.estimatedCost).toBe(0);
  });

  it('should create cloud route option', () => {
    const route: RouteOption = {
      backend: 'cloud',
      model: 'gpt-4',
      estimatedCost: 0.05,
      estimatedLatency: 500,
      estimatedQuality: 0.95,
      privacyLevel: 0.3,
      energyConsumption: 10,
      thermalImpact: 0.1,
    };

    expect(route.backend).toBe('cloud');
  });

  it('should accept zero cost', () => {
    const route: RouteOption = {
      backend: 'local',
      model: 'llama3.2',
      estimatedCost: 0,
      estimatedLatency: 100,
      estimatedQuality: 0.7,
      privacyLevel: 1.0,
      energyConsumption: 50,
      thermalImpact: 0.3,
    };

    expect(route.estimatedCost).toBe(0);
  });

  it('should accept zero latency', () => {
    const route: RouteOption = {
      backend: 'local',
      model: 'llama3.2',
      estimatedCost: 0,
      estimatedLatency: 0,
      estimatedQuality: 0.7,
      privacyLevel: 1.0,
      energyConsumption: 50,
      thermalImpact: 0.3,
    };

    expect(route.estimatedLatency).toBe(0);
  });

  it('should accept perfect quality', () => {
    const route: RouteOption = {
      backend: 'cloud',
      model: 'gpt-4',
      estimatedCost: 0.1,
      estimatedLatency: 500,
      estimatedQuality: 1.0,
      privacyLevel: 0.3,
      energyConsumption: 10,
      thermalImpact: 0.1,
    };

    expect(route.estimatedQuality).toBe(1.0);
  });

  it('should accept zero quality', () => {
    const route: RouteOption = {
      backend: 'local',
      model: 'tiny-model',
      estimatedCost: 0,
      estimatedLatency: 10,
      estimatedQuality: 0,
      privacyLevel: 1.0,
      energyConsumption: 5,
      thermalImpact: 0.1,
    };

    expect(route.estimatedQuality).toBe(0);
  });

  it('should accept full privacy', () => {
    const route: RouteOption = {
      backend: 'local',
      model: 'llama3.2',
      estimatedCost: 0,
      estimatedLatency: 100,
      estimatedQuality: 0.7,
      privacyLevel: 1.0,
      energyConsumption: 50,
      thermalImpact: 0.3,
    };

    expect(route.privacyLevel).toBe(1.0);
  });

  it('should accept zero privacy', () => {
    const route: RouteOption = {
      backend: 'cloud',
      model: 'gpt-4',
      estimatedCost: 0.1,
      estimatedLatency: 500,
      estimatedQuality: 0.95,
      privacyLevel: 0,
      energyConsumption: 10,
      thermalImpact: 0.1,
    };

    expect(route.privacyLevel).toBe(0);
  });
});

describe('ConstraintSolver', () => {
  const solver = new ConstraintSolver();

  it('should handle empty options', () => {
    const result: OptimizationResult = solver.solve([], []);

    expect(result.selectedRoute).toBeNull();
    expect(result.infeasibilityReason).toBeDefined();
  });

  it('should select best route when all constraints satisfied', () => {
    const options: RouteOption[] = [
      {
        backend: 'local',
        model: 'llama3.2',
        estimatedCost: 0,
        estimatedLatency: 100,
        estimatedQuality: 0.7,
        privacyLevel: 1.0,
        energyConsumption: 50,
        thermalImpact: 0.3,
      },
      {
        backend: 'cloud',
        model: 'gpt-4',
        estimatedCost: 0.05,
        estimatedLatency: 500,
        estimatedQuality: 0.95,
        privacyLevel: 0.3,
        energyConsumption: 10,
        thermalImpact: 0.1,
      },
    ];

    const constraints: Constraint[] = [
      {
        name: 'High Quality',
        type: ConstraintType.QUALITY,
        weight: 0.9,
        minValue: 0.8,
        isHard: false,
      },
    ];

    const result = solver.solve(options, constraints);

    expect(result.selectedRoute).toBeDefined();
    expect(result.selectedRoute?.model).toBe('gpt-4');
  });

  it('should return infeasible when hard constraints violated', () => {
    const options: RouteOption[] = [
      {
        backend: 'cloud',
        model: 'gpt-4',
        estimatedCost: 1.0,
        estimatedLatency: 500,
        estimatedQuality: 0.95,
        privacyLevel: 0.3,
        energyConsumption: 10,
        thermalImpact: 0.1,
      },
    ];

    const constraints: Constraint[] = [
      {
        name: 'Budget Limit',
        type: ConstraintType.BUDGET,
        weight: 1.0,
        maxValue: 0.1,
        isHard: true,
      },
    ];

    const result = solver.solve(options, constraints);

    expect(result.selectedRoute).toBeNull();
    expect(result.violatedConstraints).toContain('Budget Limit');
  });

  it('should track satisfied constraints', () => {
    const options: RouteOption[] = [
      {
        backend: 'local',
        model: 'llama3.2',
        estimatedCost: 0,
        estimatedLatency: 100,
        estimatedQuality: 0.7,
        privacyLevel: 1.0,
        energyConsumption: 50,
        thermalImpact: 0.3,
      },
    ];

    const constraints: Constraint[] = [
      {
        name: 'Privacy',
        type: ConstraintType.PRIVACY,
        weight: 0.8,
        minValue: 0.9,
        isHard: true,
      },
      {
        name: 'Budget',
        type: ConstraintType.BUDGET,
        weight: 0.6,
        maxValue: 0.1,
        isHard: false,
      },
    ];

    const result = solver.solve(options, constraints);

    expect(result.satisfiedConstraints.length).toBeGreaterThan(0);
  });
});

describe('parseConstraint', () => {
  it('should parse privacy constraint', () => {
    const constraint = parseConstraint('privacy>=0.8');

    expect(constraint?.type).toBe(ConstraintType.PRIVACY);
    expect(constraint?.minValue).toBe(0.8);
  });

  it('should parse budget constraint', () => {
    const constraint = parseConstraint('budget<=0.1');

    expect(constraint?.type).toBe(ConstraintType.BUDGET);
    expect(constraint?.maxValue).toBe(0.1);
  });

  it('should parse latency constraint', () => {
    const constraint = parseConstraint('latency<=500');

    expect(constraint?.type).toBe(ConstraintType.LATENCY);
    expect(constraint?.maxValue).toBe(500);
  });

  it('should parse quality constraint', () => {
    const constraint = parseConstraint('quality>=0.9');

    expect(constraint?.type).toBe(ConstraintType.QUALITY);
    expect(constraint?.minValue).toBe(0.9);
  });

  it('should return null for invalid format', () => {
    const constraint = parseConstraint('invalid');

    expect(constraint).toBeNull();
  });

  it('should return null for unknown type', () => {
    const constraint = parseConstraint('unknown>=0.5');

    expect(constraint).toBeNull();
  });
});

describe('validateConstraint', () => {
  it('should validate valid constraint', () => {
    const constraint: Constraint = {
      name: 'Test',
      type: ConstraintType.PRIVACY,
      weight: 0.8,
      minValue: 0.7,
      isHard: false,
    };

    const result = validateConstraint(constraint);

    expect(result.valid).toBe(true);
  });

  it('should reject negative weight', () => {
    const constraint: Constraint = {
      name: 'Test',
      type: ConstraintType.PRIVACY,
      weight: -0.1,
      minValue: 0.7,
      isHard: false,
    };

    const result = validateConstraint(constraint);

    expect(result.valid).toBe(false);
  });

  it('should reject weight > 1', () => {
    const constraint: Constraint = {
      name: 'Test',
      type: ConstraintType.PRIVACY,
      weight: 1.5,
      minValue: 0.7,
      isHard: false,
    };

    const result = validateConstraint(constraint);

    expect(result.valid).toBe(false);
  });

  it('should reject constraint without bounds or target', () => {
    const constraint: Constraint = {
      name: 'Test',
      type: ConstraintType.PRIVACY,
      weight: 0.8,
      isHard: false,
    };

    const result = validateConstraint(constraint);

    expect(result.valid).toBe(false);
  });
});

describe('createDefaultConstraints', () => {
  it('should create default constraints', () => {
    const defaults = createDefaultConstraints();

    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults[0].type).toBeDefined();
    expect(defaults[0].weight).toBeGreaterThanOrEqual(0);
    expect(defaults[0].weight).toBeLessThanOrEqual(1);
  });

  it('should include all constraint types', () => {
    const defaults = createDefaultConstraints();
    const types = new Set(defaults.map((c) => c.type));

    expect(types.has(ConstraintType.PRIVACY)).toBe(true);
    expect(types.has(ConstraintType.BUDGET)).toBe(true);
    expect(types.has(ConstraintType.LATENCY)).toBe(true);
    expect(types.has(ConstraintType.QUALITY)).toBe(true);
  });
});
