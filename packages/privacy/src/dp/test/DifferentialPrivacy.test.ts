/**
 * Comprehensive Tests for Differential Privacy Implementation
 *
 * Tests for:
 * - Noise mechanisms (Laplace, Gaussian)
 * - Privacy budget tracking
 * - Composition theorems
 * - Utility analysis
 * - Privacy guarantees
 * - Enhanced IntentEncoder
 *
 * @module dp/test
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  LaplaceMechanism,
  GaussianMechanism,
  NoiseMechanismFactory,
} from "../NoiseMechanisms.js";
import { PrivacyBudgetTracker } from "../PrivacyBudgetTracker.js";
import { UtilityAnalyzer } from "../UtilityAnalyzer.js";
import { PrivacyAuditor } from "../PrivacyAuditor.js";
import { EnhancedIntentEncoder } from "../EnhancedIntentEncoder.js";
import type {
  NoiseMechanismType,
  CompositionType,
  PrivacyCost,
} from "@lsi/protocol";
import { NoiseMechanismType as NoiseType, CompositionType as CompType } from "@lsi/protocol";

describe("Differential Privacy - Noise Mechanisms", () => {
  describe("LaplaceMechanism", () => {
    it("should create mechanism with valid parameters", () => {
      const mechanism = new LaplaceMechanism(1.0, 2.0);

      expect(mechanism.type).toBe(NoiseType.LAPLACE);
      expect(mechanism.epsilon).toBe(1.0);
      expect(mechanism.sensitivity).toBe(2.0);
      expect(mechanism.delta).toBeUndefined();
    });

    it("should throw error for invalid epsilon", () => {
      expect(() => new LaplaceMechanism(0, 2.0)).toThrow("Epsilon must be positive");
      expect(() => new LaplaceMechanism(-1, 2.0)).toThrow("Epsilon must be positive");
    });

    it("should throw error for invalid sensitivity", () => {
      expect(() => new LaplaceMechanism(1.0, -1)).toThrow("Sensitivity must be non-negative");
    });

    it("should add noise to single value", () => {
      const mechanism = new LaplaceMechanism(1.0, 2.0, 42); // Fixed seed
      const value = 10.0;
      const noisy = mechanism.addNoise(value);

      expect(noisy).not.toBe(value);
      expect(typeof noisy).toBe("number");
    });

    it("should add noise to vector", () => {
      const mechanism = new LaplaceMechanism(1.0, 2.0, 42);
      const vector = new Float32Array([1.0, 2.0, 3.0]);
      const noisy = mechanism.addNoiseVector(vector);

      expect(noisy.length).toBe(vector.length);
      expect(noisy[0]).not.toBe(vector[0]);
    });

    it("should calculate correct noise scale", () => {
      const mechanism = new LaplaceMechanism(1.0, 2.0);
      const scale = mechanism.getNoiseMultiplier();

      // scale = sensitivity / epsilon = 2.0 / 1.0 = 2.0
      expect(scale).toBe(2.0);
    });

    it("should estimate utility loss", () => {
      const mechanism = new LaplaceMechanism(1.0, 2.0);
      const utilityLoss = mechanism.estimateUtilityLoss(1.0);

      expect(utilityLoss.accuracyLoss).toBeGreaterThanOrEqual(0);
      expect(utilityLoss.accuracyLoss).toBeLessThanOrEqual(1);
      expect(utilityLoss.varianceIncrease).toBeGreaterThan(0);
      expect(utilityLoss.confidenceInterval).toHaveLength(2);
      expect(utilityLoss.snr).toBeGreaterThanOrEqual(0);
    });

    it("should verify privacy guarantee", () => {
      const mechanism = new LaplaceMechanism(1.0, 2.0);
      const guarantee = mechanism.verifyGuarantee();

      expect(guarantee.satisfiesDP).toBe(true);
      expect(guarantee.epsilonAchieved).toBe(1.0);
      expect(guarantee.deltaAchieved).toBe(0);
      expect(guarantee.guaranteeType).toBe("pure");
      expect(guarantee.confidence).toBe(1.0);
    });

    it("should produce reproducible noise with same seed", () => {
      const mechanism1 = new LaplaceMechanism(1.0, 2.0, 42);
      const mechanism2 = new LaplaceMechanism(1.0, 2.0, 42);

      const value = 10.0;
      const noisy1 = mechanism1.addNoise(value);
      const noisy2 = mechanism2.addNoise(value);

      expect(noisy1).toBe(noisy2);
    });
  });

  describe("GaussianMechanism", () => {
    it("should create mechanism with valid parameters", () => {
      const mechanism = new GaussianMechanism(1.0, 1e-5, 2.0);

      expect(mechanism.type).toBe(NoiseType.GAUSSIAN);
      expect(mechanism.epsilon).toBe(1.0);
      expect(mechanism.delta).toBe(1e-5);
      expect(mechanism.sensitivity).toBe(2.0);
    });

    it("should throw error for invalid parameters", () => {
      expect(() => new GaussianMechanism(0, 1e-5, 2.0)).toThrow("Epsilon must be positive");
      expect(() => new GaussianMechanism(1.0, 0, 2.0)).toThrow("Delta must be in");
      expect(() => new GaussianMechanism(1.0, 1, 2.0)).toThrow("Delta must be in");
    });

    it("should add noise to single value", () => {
      const mechanism = new GaussianMechanism(1.0, 1e-5, 2.0, 42);
      const value = 10.0;
      const noisy = mechanism.addNoise(value);

      expect(noisy).not.toBe(value);
      expect(typeof noisy).toBe("number");
    });

    it("should add noise to vector", () => {
      const mechanism = new GaussianMechanism(1.0, 1e-5, 2.0, 42);
      const vector = new Float32Array([1.0, 2.0, 3.0]);
      const noisy = mechanism.addNoiseVector(vector);

      expect(noisy.length).toBe(vector.length);
    });

    it("should calculate correct sigma", () => {
      const mechanism = new GaussianMechanism(1.0, 1e-5, 2.0);
      const sigma = mechanism.getNoiseMultiplier();

      // sigma = sensitivity * sqrt(2*ln(1.25/delta)) / epsilon
      // sigma = 2.0 * sqrt(2*ln(1.25/1e-5)) / 1.0 ≈ 2.0 * 4.8 ≈ 9.6
      expect(sigma).toBeGreaterThan(0);
      expect(sigma).toBeGreaterThan(9.0);
      expect(sigma).toBeLessThan(10.5);
    });

    it("should verify approximate DP guarantee", () => {
      const mechanism = new GaussianMechanism(1.0, 1e-5, 2.0);
      const guarantee = mechanism.verifyGuarantee();

      expect(guarantee.satisfiesDP).toBe(true);
      expect(guarantee.epsilonAchieved).toBe(1.0);
      expect(guarantee.deltaAchieved).toBe(1e-5);
      expect(guarantee.guaranteeType).toBe("approximate");
      expect(guarantee.confidence).toBeCloseTo(1.0, 4);
    });
  });

  describe("NoiseMechanismFactory", () => {
    it("should create Laplace mechanism", () => {
      const mechanism = NoiseMechanismFactory.create(
        NoiseType.LAPLACE,
        1.0,
        2.0,
        undefined,
        42
      );

      expect(mechanism.type).toBe(NoiseType.LAPLACE);
    });

    it("should create Gaussian mechanism with delta", () => {
      const mechanism = NoiseMechanismFactory.create(
        NoiseType.GAUSSIAN,
        1.0,
        2.0,
        1e-5,
        42
      );

      expect(mechanism.type).toBe(NoiseType.GAUSSIAN);
    });

    it("should throw error for Gaussian without delta", () => {
      expect(() =>
        NoiseMechanismFactory.create(NoiseType.GAUSSIAN, 1.0, 2.0)
      ).toThrow("Delta is required for Gaussian mechanism");
    });

    it("should create optimal mechanism with delta", () => {
      const mechanism = NoiseMechanismFactory.createOptimal(1.0, 2.0, 1e-5, 42);

      expect(mechanism.type).toBe(NoiseType.GAUSSIAN);
    });

    it("should create optimal mechanism without delta", () => {
      const mechanism = NoiseMechanismFactory.createOptimal(1.0, 2.0, undefined, 42);

      expect(mechanism.type).toBe(NoiseType.LAPLACE);
    });
  });
});

describe("Differential Privacy - Budget Tracking", () => {
  let tracker: PrivacyBudgetTracker;

  beforeEach(() => {
    tracker = new PrivacyBudgetTracker(10.0, 1e-5, CompType.SEQUENTIAL);
  });

  describe("PrivacyBudgetTracker", () => {
    it("should initialize with correct budget", () => {
      const budget = tracker.budget;

      expect(budget.totalEpsilon).toBe(10.0);
      expect(budget.totalDelta).toBe(1e-5);
      expect(budget.epsilonSpent).toBe(0);
      expect(budget.deltaSpent).toBe(0);
      expect(budget.epsilonRemaining).toBe(10.0);
      expect(budget.deltaRemaining).toBe(1e-5);
      expect(budget.operationCount).toBe(0);
      expect(budget.isExhausted).toBe(false);
    });

    it("should spend privacy budget", () => {
      const cost: PrivacyCost = {
        epsilon: 1.0,
        delta: 0,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
        timestamp: Date.now(),
      };

      tracker.spend(cost);

      const budget = tracker.budget;
      expect(budget.epsilonSpent).toBe(1.0);
      expect(budget.epsilonRemaining).toBe(9.0);
      expect(budget.operationCount).toBe(1);
    });

    it("should throw error when budget exceeded", () => {
      const cost: PrivacyCost = {
        epsilon: 11.0,
        delta: 0,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
        timestamp: Date.now(),
      };

      expect(() => tracker.spend(cost)).toThrow("Insufficient privacy budget");
    });

    it("should check if can afford cost", () => {
      const affordableCost: PrivacyCost = {
        epsilon: 5.0,
        delta: 0,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
        timestamp: Date.now(),
      };

      const unaffordableCost: PrivacyCost = {
        epsilon: 15.0,
        delta: 0,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
        timestamp: Date.now(),
      };

      expect(tracker.canAfford(affordableCost)).toBe(true);
      expect(tracker.canAfford(unaffordableCost)).toBe(false);
    });

    it("should compose costs sequentially", () => {
      const costs: PrivacyCost[] = [
        {
          epsilon: 1.0,
          delta: 0,
          mechanism: NoiseType.LAPLACE,
          sensitivity: 2.0,
          timestamp: Date.now(),
        },
        {
          epsilon: 2.0,
          delta: 0,
          mechanism: NoiseType.LAPLACE,
          sensitivity: 2.0,
          timestamp: Date.now(),
        },
      ];

      const composition = tracker.compose(costs, CompType.SEQUENTIAL);

      expect(composition.totalEpsilon).toBe(3.0);
      expect(composition.totalDelta).toBe(0);
      expect(composition.compositionType).toBe(CompType.SEQUENTIAL);
      expect(composition.mechanismCount).toBe(2);
    });

    it("should compose costs in parallel", () => {
      const costs: PrivacyCost[] = [
        {
          epsilon: 1.0,
          delta: 0,
          mechanism: NoiseType.LAPLACE,
          sensitivity: 2.0,
          timestamp: Date.now(),
        },
        {
          epsilon: 2.0,
          delta: 0,
          mechanism: NoiseType.LAPLACE,
          sensitivity: 2.0,
          timestamp: Date.now(),
        },
      ];

      const composition = tracker.compose(costs, CompType.PARALLEL);

      expect(composition.totalEpsilon).toBe(2.0); // max
      expect(composition.compositionType).toBe(CompType.PARALLEL);
    });

    it("should get complete accounting", () => {
      const cost: PrivacyCost = {
        epsilon: 1.0,
        delta: 0,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
        timestamp: Date.now(),
      };

      tracker.spend(cost);

      const accounting = tracker.getAccounting();

      expect(accounting.budget.epsilonSpent).toBe(1.0);
      expect(accounting.composition.totalEpsilon).toBe(1.0);
      expect(accounting.utilityLoss).toBeDefined();
      expect(accounting.guarantee.satisfiesDP).toBe(true);
      expect(accounting.history).toHaveLength(1);
    });

    it("should reset budget", () => {
      const cost: PrivacyCost = {
        epsilon: 5.0,
        delta: 0,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
        timestamp: Date.now(),
      };

      tracker.spend(cost);
      expect(tracker.budget.epsilonSpent).toBe(5.0);

      tracker.reset();

      expect(tracker.budget.epsilonSpent).toBe(0);
      expect(tracker.budget.epsilonRemaining).toBe(10.0);
      expect(tracker.budget.operationCount).toBe(0);
    });
  });
});

describe("Differential Privacy - Utility Analysis", () => {
  let analyzer: UtilityAnalyzer;

  beforeEach(() => {
    analyzer = new UtilityAnalyzer(2.0, 1.0);
  });

  it("should estimate Laplace utility loss", () => {
    const utilityLoss = analyzer.estimateLaplaceUtility(1.0);

    expect(utilityLoss.accuracyLoss).toBeGreaterThanOrEqual(0);
    expect(utilityLoss.accuracyLoss).toBeLessThanOrEqual(1);
    expect(utilityLoss.varianceIncrease).toBeGreaterThan(0);
    expect(utilityLoss.confidenceInterval).toHaveLength(2);
    expect(utilityLoss.snr).toBeGreaterThanOrEqual(0);
  });

  it("should estimate Gaussian utility loss", () => {
    const utilityLoss = analyzer.estimateGaussianUtility(1.0, 1e-5);

    expect(utilityLoss.accuracyLoss).toBeGreaterThanOrEqual(0);
    expect(utilityLoss.varianceIncrease).toBeGreaterThan(0);
  });

  it("should recommend epsilon for target accuracy", () => {
    const epsilon = analyzer.recommendEpsilonForAccuracy(0.9, NoiseType.LAPLACE);

    expect(epsilon).toBeGreaterThan(0);
    expect(epsilon).toBeLessThan(Infinity);
  });

  it("should recommend infinite epsilon for perfect accuracy", () => {
    const epsilon = analyzer.recommendEpsilonForAccuracy(1.0, NoiseType.LAPLACE);

    expect(epsilon).toBe(Infinity);
  });

  it("should analyze utility across multiple epsilons", () => {
    const epsilons = [0.1, 0.5, 1.0, 2.0, 5.0];
    const analysis = analyzer.analyzeUtility(epsilons, NoiseType.LAPLACE);

    expect(analysis.metrics).toHaveLength(epsilons.length);
    expect(analysis.sensitivity).toBe(2.0);
    expect(analysis.signalMagnitude).toBe(1.0);
    expect(analysis.recommendedEpsilon).toBeGreaterThan(0);
    expect(analysis.privacyRecommendation).toBeDefined();
  });

  it("should compare Laplace and Gaussian mechanisms", () => {
    const comparison = analyzer.compareMechanisms(1.0);

    expect(comparison.laplace).toBeDefined();
    expect(comparison.gaussian).toBeDefined();
    expect(comparison.better).toMatch(/^(laplace|gaussian|similar)$/);
    expect(comparison.reason).toBeDefined();
  });
});

describe("Differential Privacy - Privacy Auditing", () => {
  let auditor: PrivacyAuditor;

  beforeEach(() => {
    auditor = new PrivacyAuditor();
  });

  it("should audit a single operation", () => {
    const cost: PrivacyCost = {
      epsilon: 1.0,
      delta: 0,
      mechanism: NoiseType.LAPLACE,
      sensitivity: 2.0,
      timestamp: Date.now(),
    };

    const result = auditor.auditOperation("op1", cost, NoiseType.LAPLACE, 2.0);

    expect(result.operationId).toBe("op1");
    expect(result.cost).toBe(cost);
    expect(result.passed).toBe(true);
    expect(result.guarantee.satisfiesDP).toBe(true);
  });

  it("should detect invalid epsilon", () => {
    const cost: PrivacyCost = {
      epsilon: -1.0,
      delta: 0,
      mechanism: NoiseType.LAPLACE,
      sensitivity: 2.0,
      timestamp: Date.now(),
    };

    const result = auditor.auditOperation("op_invalid", cost, NoiseType.LAPLACE, 2.0);

    expect(result.passed).toBe(false);
    expect(result.notes).toContain("Privacy guarantee not satisfied");
  });

  it("should audit multiple operations", () => {
    const operations = [
      {
        operationId: "op1",
        cost: {
          epsilon: 1.0,
          delta: 0,
          mechanism: NoiseType.LAPLACE,
          sensitivity: 2.0,
          timestamp: Date.now(),
        } as PrivacyCost,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
      },
      {
        operationId: "op2",
        cost: {
          epsilon: 2.0,
          delta: 0,
          mechanism: NoiseType.LAPLACE,
          sensitivity: 2.0,
          timestamp: Date.now(),
        } as PrivacyCost,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
      },
    ];

    const report = auditor.auditOperations(operations);

    expect(report.results).toHaveLength(2);
    expect(report.passed).toBe(true);
    expect(report.totalCost.epsilon).toBe(3.0);
    expect(report.recommendations).toBeDefined();
  });

  it("should track violations", () => {
    const cost: PrivacyCost = {
      epsilon: -1.0,
      delta: 0,
      mechanism: NoiseType.LAPLACE,
      sensitivity: 2.0,
      timestamp: Date.now(),
    };

    auditor.auditOperation("op_invalid", cost, NoiseType.LAPLACE, 2.0);

    const violations = auditor.getViolations();
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe("guarantee_failed");
  });

  it("should clear audit history", () => {
    const cost: PrivacyCost = {
      epsilon: 1.0,
      delta: 0,
      mechanism: NoiseType.LAPLACE,
      sensitivity: 2.0,
      timestamp: Date.now(),
    };

    auditor.auditOperation("op1", cost, NoiseType.LAPLACE, 2.0);
    expect(auditor.getAuditHistory()).toHaveLength(1);

    auditor.clearHistory();
    expect(auditor.getAuditHistory()).toHaveLength(0);
  });
});

describe("Differential Privacy - Privacy Guarantees", () => {
  it("should verify pure ε-DP for Laplace", () => {
    const mechanism = new LaplaceMechanism(1.0, 2.0);
    const guarantee = mechanism.verifyGuarantee();

    expect(guarantee.satisfiesDP).toBe(true);
    expect(guarantee.guaranteeType).toBe("pure");
    expect(guarantee.deltaAchieved).toBe(0);
    expect(guarantee.confidence).toBe(1.0);
  });

  it("should verify (ε,δ)-DP for Gaussian", () => {
    const mechanism = new GaussianMechanism(1.0, 1e-5, 2.0);
    const guarantee = mechanism.verifyGuarantee();

    expect(guarantee.satisfiesDP).toBe(true);
    expect(guarantee.guaranteeType).toBe("approximate");
    expect(guarantee.deltaAchieved).toBe(1e-5);
    expect(guarantee.confidence).toBeCloseTo(1.0, 4);
  });

  it("should track privacy loss over multiple operations", () => {
    const tracker = new PrivacyBudgetTracker(10.0, 0, CompType.SEQUENTIAL);

    const costs: PrivacyCost[] = [
      {
        epsilon: 1.0,
        delta: 0,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
        timestamp: Date.now(),
      },
      {
        epsilon: 2.0,
        delta: 0,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
        timestamp: Date.now(),
      },
      {
        epsilon: 1.5,
        delta: 0,
        mechanism: NoiseType.LAPLACE,
        sensitivity: 2.0,
        timestamp: Date.now(),
      },
    ];

    costs.forEach(cost => tracker.spend(cost));

    const budget = tracker.budget;
    expect(budget.epsilonSpent).toBe(4.5);
    expect(budget.epsilonRemaining).toBe(5.5);
    expect(budget.operationCount).toBe(3);
  });

  it("should provide utility vs privacy tradeoff analysis", () => {
    const analyzer = new UtilityAnalyzer(2.0, 1.0);

    const epsilons = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0];
    const analysis = analyzer.analyzeUtility(epsilons, NoiseType.LAPLACE);

    // Lower epsilon should give higher noise (lower utility)
    const lowEpsilonMetric = analysis.metrics.find(m => m.epsilon === 0.1);
    const highEpsilonMetric = analysis.metrics.find(m => m.epsilon === 10.0);

    expect(lowEpsilonMetric!.noiseLevel).toBeGreaterThan(highEpsilonMetric!.noiseLevel);
    expect(lowEpsilonMetric!.accuracy).toBeLessThan(highEpsilonMetric!.accuracy);
  });
});
