/**
 * Tests for Constraint Algebra
 *
 * Tests the constraint optimization system for multi-objective routing.
 */

import { describe, it, expect } from "vitest";
import {
  ConstraintType,
  OptimizationStrategy,
  type Constraint,
  type RouteOption,
  ConstraintSolver,
  createDefaultConstraints,
  parseConstraint,
  validateConstraint,
} from "./constraints.js";

describe("ConstraintSolver", () => {
  const solver = new ConstraintSolver();

  describe("solve()", () => {
    const sampleOptions: RouteOption[] = [
      {
        backend: "local",
        model: "llama3.2",
        estimatedCost: 0,
        estimatedLatency: 50,
        estimatedQuality: 0.7,
        privacyLevel: 1.0,
        energyConsumption: 1,
        thermalImpact: 0.1,
      },
      {
        backend: "cloud",
        model: "gpt-4",
        estimatedCost: 0.02,
        estimatedLatency: 500,
        estimatedQuality: 0.95,
        privacyLevel: 0.5,
        energyConsumption: 0.5,
        thermalImpact: 0,
      },
      {
        backend: "cloud",
        model: "gpt-3.5-turbo",
        estimatedCost: 0.002,
        estimatedLatency: 200,
        estimatedQuality: 0.85,
        privacyLevel: 0.5,
        energyConsumption: 0.3,
        thermalImpact: 0,
      },
    ];

    it("should select local option for cost-optimized constraints", () => {
      const constraints: Constraint[] = [
        {
          name: "budget",
          type: ConstraintType.BUDGET,
          weight: 0.8,
          maxValue: 0.01,
          isHard: true,
        },
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.2,
          minValue: 0.6,
          isHard: true,
        },
      ];

      const result = solver.solve(sampleOptions, constraints);

      expect(result.selectedRoute).toBeDefined();
      expect(result.selectedRoute?.backend).toBe("local");
      expect(result.selectedRoute?.model).toBe("llama3.2");
      expect(result.satisfiedConstraints).toContain("budget");
      expect(result.satisfiedConstraints).toContain("quality");
      expect(result.violatedConstraints).toHaveLength(0);
    });

    it("should select high-quality cloud option for quality-optimized constraints", () => {
      const constraints: Constraint[] = [
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.9,
          minValue: 0.9,
          isHard: true,
        },
        {
          name: "latency",
          type: ConstraintType.LATENCY,
          weight: 0.1,
          maxValue: 1000,
          isHard: false,
        },
      ];

      const result = solver.solve(sampleOptions, constraints);

      expect(result.selectedRoute).toBeDefined();
      expect(result.selectedRoute?.backend).toBe("cloud");
      expect(result.selectedRoute?.model).toBe("gpt-4");
      expect(result.selectedRoute?.estimatedQuality).toBeGreaterThanOrEqual(
        0.9
      );
    });

    it("should return infeasible result when no option satisfies hard constraints", () => {
      const constraints: Constraint[] = [
        {
          name: "budget",
          type: ConstraintType.BUDGET,
          weight: 0.5,
          maxValue: 0.001,
          isHard: true,
        },
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.5,
          minValue: 0.95,
          isHard: true,
        },
      ];

      const result = solver.solve(sampleOptions, constraints);

      expect(result.selectedRoute).toBeNull();
      expect(result.infeasibilityReason).toBeDefined();
      expect(result.infeasibilityReason).toContain("hard constraints");
      expect(result.violatedConstraints.length).toBeGreaterThan(0);
    });

    it("should handle empty options array", () => {
      const constraints: Constraint[] = [
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 1,
          minValue: 0.7,
          isHard: true,
        },
      ];

      const result = solver.solve([], constraints);

      expect(result.selectedRoute).toBeNull();
      expect(result.infeasibilityReason).toContain("No route options");
    });

    it("should handle empty constraints array", () => {
      const result = solver.solve(sampleOptions, []);

      expect(result.selectedRoute).toBeDefined();
      expect(result.score).toBe(1);
    });

    it("should respect privacy constraints", () => {
      const constraints: Constraint[] = [
        {
          name: "privacy",
          type: ConstraintType.PRIVACY,
          weight: 0.8,
          minValue: 0.9,
          isHard: true,
        },
      ];

      const result = solver.solve(sampleOptions, constraints);

      expect(result.selectedRoute).toBeDefined();
      expect(result.selectedRoute?.privacyLevel).toBeGreaterThanOrEqual(0.9);
      expect(result.selectedRoute?.backend).toBe("local");
    });

    it("should respect latency constraints", () => {
      const constraints: Constraint[] = [
        {
          name: "latency",
          type: ConstraintType.LATENCY,
          weight: 1,
          maxValue: 100,
          isHard: true,
        },
      ];

      const result = solver.solve(sampleOptions, constraints);

      expect(result.selectedRoute).toBeDefined();
      expect(result.selectedRoute?.estimatedLatency).toBeLessThanOrEqual(100);
    });

    it("should use weighted sum optimization for soft constraints", () => {
      const constraints: Constraint[] = [
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.7,
          isHard: false,
        },
        {
          name: "budget",
          type: ConstraintType.BUDGET,
          weight: 0.3,
          maxValue: 0.01,
          isHard: false,
        },
      ];

      const result = solver.solve(sampleOptions, constraints);

      expect(result.selectedRoute).toBeDefined();
      // Should prioritize quality (0.7 weight) over budget (0.3 weight)
      expect(result.selectedRoute?.estimatedQuality).toBeGreaterThan(0.7);
    });

    it("should return all satisfied and violated constraints", () => {
      const constraints: Constraint[] = [
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.5,
          minValue: 0.8,
          isHard: true,
        },
        {
          name: "budget",
          type: ConstraintType.BUDGET,
          weight: 0.5,
          maxValue: 0.001,
          isHard: false,
        },
      ];

      const result = solver.solve(sampleOptions, constraints);

      expect(result.satisfiedConstraints).toContain("quality");
      // Budget may be violated depending on which option is selected
      expect(
        result.satisfiedConstraints.length + result.violatedConstraints.length
      ).toBe(constraints.length);
    });
  });

  describe("Pareto optimization", () => {
    it("should return Pareto frontier for PARETO strategy", () => {
      const solver = new ConstraintSolver();
      const options: RouteOption[] = [
        {
          backend: "local",
          model: "model1",
          estimatedCost: 0,
          estimatedLatency: 50,
          estimatedQuality: 0.7,
          privacyLevel: 1.0,
          energyConsumption: 1,
          thermalImpact: 0.1,
        },
        {
          backend: "cloud",
          model: "model2",
          estimatedCost: 0.01,
          estimatedLatency: 200,
          estimatedQuality: 0.9,
          privacyLevel: 0.6,
          energyConsumption: 0.5,
          thermalImpact: 0,
        },
      ];

      const constraints: Constraint[] = [
        {
          name: "quality",
          type: ConstraintType.QUALITY,
          weight: 0.5,
          isHard: false,
        },
        {
          name: "budget",
          type: ConstraintType.BUDGET,
          weight: 0.5,
          maxValue: 0.02,
          isHard: false,
        },
      ];

      // Force Pareto strategy by having no hard constraints
      const result = solver.solve(options, constraints);

      expect(result.selectedRoute).toBeDefined();
      // Pareto frontier may be returned
      if (result.paretoFrontier) {
        expect(result.paretoFrontier.length).toBeGreaterThan(0);
      }
    });
  });
});

describe("createDefaultConstraints", () => {
  it("should create cost-optimized constraints", () => {
    const constraints = createDefaultConstraints("cost_optimized");

    expect(constraints).toHaveLength(2);
    expect(constraints[0].type).toBe(ConstraintType.BUDGET);
    expect(constraints[0].weight).toBe(0.8);
    expect(constraints[0].maxValue).toBe(0.01);
    expect(constraints[1].type).toBe(ConstraintType.QUALITY);
    expect(constraints[1].weight).toBe(0.2);
  });

  it("should create quality-optimized constraints", () => {
    const constraints = createDefaultConstraints("quality_optimized");

    expect(constraints).toHaveLength(2);
    expect(constraints[0].type).toBe(ConstraintType.QUALITY);
    expect(constraints[0].weight).toBe(0.8);
    expect(constraints[0].minValue).toBe(0.9);
  });

  it("should create balanced constraints", () => {
    const constraints = createDefaultConstraints("balanced");

    expect(constraints).toHaveLength(4);
    expect(constraints[0].type).toBe(ConstraintType.BUDGET);
    expect(constraints[1].type).toBe(ConstraintType.QUALITY);
    expect(constraints[2].type).toBe(ConstraintType.LATENCY);
    expect(constraints[3].type).toBe(ConstraintType.PRIVACY);

    // All should have equal weight
    for (const c of constraints) {
      expect(c.weight).toBe(0.25);
    }
  });

  it("should create privacy-first constraints", () => {
    const constraints = createDefaultConstraints("privacy_first");

    expect(constraints).toHaveLength(3);
    expect(constraints[0].type).toBe(ConstraintType.PRIVACY);
    expect(constraints[0].weight).toBe(0.6);
    expect(constraints[0].minValue).toBe(0.95);
    expect(constraints[0].isHard).toBe(true);
  });
});

describe("parseConstraint", () => {
  it("should parse valid constraint object", () => {
    const obj = {
      name: "test_budget",
      type: "budget",
      weight: 0.7,
      maxValue: 0.01,
      isHard: false,
    };

    const constraint = parseConstraint(obj);

    expect(constraint.name).toBe("test_budget");
    expect(constraint.type).toBe(ConstraintType.BUDGET);
    expect(constraint.weight).toBe(0.7);
    expect(constraint.maxValue).toBe(0.01);
    expect(constraint.isHard).toBe(false);
  });

  it("should use default values for optional fields", () => {
    const obj = {
      name: "test_quality",
      type: "quality",
    };

    const constraint = parseConstraint(obj);

    expect(constraint.name).toBe("test_quality");
    expect(constraint.type).toBe(ConstraintType.QUALITY);
    expect(constraint.weight).toBe(0.5); // default
    expect(constraint.isHard).toBe(false); // default
  });
});

describe("validateConstraint", () => {
  it("should validate correct constraint", () => {
    const constraint: Constraint = {
      name: "test",
      type: ConstraintType.BUDGET,
      weight: 0.5,
      maxValue: 0.01,
      isHard: false,
    };

    expect(validateConstraint(constraint)).toBe(true);
  });

  it("should reject constraint with invalid name", () => {
    const constraint: Constraint = {
      name: "",
      type: ConstraintType.BUDGET,
      weight: 0.5,
      isHard: false,
    };

    expect(validateConstraint(constraint)).toBe(false);
  });

  it("should reject constraint with invalid type", () => {
    const constraint = {
      name: "test",
      type: "invalid_type" as ConstraintType,
      weight: 0.5,
      isHard: false,
    };

    expect(validateConstraint(constraint)).toBe(false);
  });

  it("should reject constraint with weight out of range", () => {
    const constraint: Constraint = {
      name: "test",
      type: ConstraintType.BUDGET,
      weight: 1.5, // > 1
      isHard: false,
    };

    expect(validateConstraint(constraint)).toBe(false);
  });

  it("should reject constraint with minValue > maxValue", () => {
    const constraint: Constraint = {
      name: "test",
      type: ConstraintType.BUDGET,
      weight: 0.5,
      minValue: 10,
      maxValue: 5,
      isHard: false,
    };

    expect(validateConstraint(constraint)).toBe(false);
  });

  it("should reject constraint with negative minValue", () => {
    const constraint: Constraint = {
      name: "test",
      type: ConstraintType.QUALITY,
      weight: 0.5,
      minValue: -0.1,
      isHard: false,
    };

    expect(validateConstraint(constraint)).toBe(false);
  });

  it("should reject constraint with negative maxValue", () => {
    const constraint: Constraint = {
      name: "test",
      type: ConstraintType.BUDGET,
      weight: 0.5,
      maxValue: -0.01,
      isHard: false,
    };

    expect(validateConstraint(constraint)).toBe(false);
  });
});

describe("ConstraintType enum", () => {
  it("should have all expected constraint types", () => {
    expect(ConstraintType.PRIVACY).toBe("privacy");
    expect(ConstraintType.BUDGET).toBe("budget");
    expect(ConstraintType.THERMAL).toBe("thermal");
    expect(ConstraintType.LATENCY).toBe("latency");
    expect(ConstraintType.QUALITY).toBe("quality");
    expect(ConstraintType.ENERGY).toBe("energy");
    expect(ConstraintType.BATTERY).toBe("battery");
  });
});

describe("OptimizationStrategy enum", () => {
  it("should have all expected strategies", () => {
    expect(OptimizationStrategy.PARETO).toBe("pareto");
    expect(OptimizationStrategy.WEIGHTED_SUM).toBe("weighted_sum");
    expect(OptimizationStrategy.LEXICOGRAPHIC).toBe("lexicographic");
    expect(OptimizationStrategy.CONSTRAINT_PRIORITY).toBe(
      "constraint_priority"
    );
  });
});

describe("Edge cases", () => {
  const solver = new ConstraintSolver();

  it("should handle all constraints as hard", () => {
    const options: RouteOption[] = [
      {
        backend: "local",
        model: "model1",
        estimatedCost: 0,
        estimatedLatency: 50,
        estimatedQuality: 0.7,
        privacyLevel: 1.0,
        energyConsumption: 1,
        thermalImpact: 0.1,
      },
    ];

    const constraints: Constraint[] = [
      {
        name: "quality",
        type: ConstraintType.QUALITY,
        weight: 0.5,
        minValue: 0.6,
        isHard: true,
      },
      {
        name: "privacy",
        type: ConstraintType.PRIVACY,
        weight: 0.5,
        minValue: 0.9,
        isHard: true,
      },
    ];

    const result = solver.solve(options, constraints);

    expect(result.selectedRoute).toBeDefined();
    expect(result.satisfiedConstraints).toHaveLength(2);
  });

  it("should handle single route option", () => {
    const options: RouteOption[] = [
      {
        backend: "local",
        model: "model1",
        estimatedCost: 0,
        estimatedLatency: 50,
        estimatedQuality: 0.7,
        privacyLevel: 1.0,
        energyConsumption: 1,
        thermalImpact: 0.1,
      },
    ];

    const constraints: Constraint[] = [
      {
        name: "quality",
        type: ConstraintType.QUALITY,
        weight: 1,
        minValue: 0.6,
        isHard: true,
      },
    ];

    const result = solver.solve(options, constraints);

    expect(result.selectedRoute).toBeDefined();
    expect(result.selectedRoute?.model).toBe("model1");
  });

  it("should handle thermal constraints", () => {
    const options: RouteOption[] = [
      {
        backend: "local",
        model: "model1",
        estimatedCost: 0,
        estimatedLatency: 50,
        estimatedQuality: 0.7,
        privacyLevel: 1.0,
        energyConsumption: 1,
        thermalImpact: 0.8,
      },
      {
        backend: "cloud",
        model: "model2",
        estimatedCost: 0.01,
        estimatedLatency: 200,
        estimatedQuality: 0.85,
        privacyLevel: 0.6,
        energyConsumption: 0.5,
        thermalImpact: 0,
      },
    ];

    const constraints: Constraint[] = [
      {
        name: "thermal",
        type: ConstraintType.THERMAL,
        weight: 1,
        maxValue: 0.5,
        isHard: true,
      },
    ];

    const result = solver.solve(options, constraints);

    expect(result.selectedRoute).toBeDefined();
    expect(result.selectedRoute?.thermalImpact).toBeLessThanOrEqual(0.5);
  });

  it("should handle energy constraints", () => {
    const options: RouteOption[] = [
      {
        backend: "local",
        model: "model1",
        estimatedCost: 0,
        estimatedLatency: 50,
        estimatedQuality: 0.7,
        privacyLevel: 1.0,
        energyConsumption: 5,
        thermalImpact: 0.1,
      },
      {
        backend: "cloud",
        model: "model2",
        estimatedCost: 0.01,
        estimatedLatency: 200,
        estimatedQuality: 0.85,
        privacyLevel: 0.6,
        energyConsumption: 1,
        thermalImpact: 0,
      },
    ];

    const constraints: Constraint[] = [
      {
        name: "energy",
        type: ConstraintType.ENERGY,
        weight: 1,
        maxValue: 2,
        isHard: true,
      },
    ];

    const result = solver.solve(options, constraints);

    expect(result.selectedRoute).toBeDefined();
    expect(result.selectedRoute?.energyConsumption).toBeLessThanOrEqual(2);
  });
});
