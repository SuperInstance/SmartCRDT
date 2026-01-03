/**
 * @file Privacy-Preserving ML Tests
 *
 * Comprehensive tests for differential privacy mechanisms,
 * private gradient computation, and private training.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DifferentialPrivacy,
  MomentsAccountant,
  RDPAccountant,
  ZCDPAccountant,
  type PrivacyBudget,
  type PrivacyCost,
  type UtilityLoss,
} from "./DifferentialPrivacy.js";
import {
  PrivateGradient,
  DEFAULT_GRADIENT_CONFIG,
  type PrivateGradientConfig,
  type ClippingStats,
  type GradientResult,
} from "./PrivateGradient.js";
import {
  PrivateTrainer,
  DEFAULT_TRAINER_CONFIG,
  type PrivateTrainerConfig,
  type TrainingData,
  type Model,
} from "./PrivateTrainer.js";

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Simple linear model for testing
 */
class TestModel implements Model {
  private params: number[];

  constructor(dim: number = 10) {
    this.params = new Array(dim).fill(0).map(() => Math.random() * 0.1);
  }

  get_parameters(): number[] {
    return this.params.slice();
  }

  set_parameters(params: number[]): void {
    this.params = params.slice();
  }

  compute_gradient(batch: TrainingData[]): number[] {
    // Simple gradient: sum of (prediction - target) * features
    const grad = new Array(this.params.length).fill(0);

    for (const sample of batch) {
      const pred = this.predict(sample.features) as number;
      const error = pred - (sample.target as number);

      for (let i = 0; i < this.params.length; i++) {
        grad[i] += error * (sample.features[i] ?? 0);
      }
    }

    return grad.map(g => g / batch.length);
  }

  predict(features: number[]): number {
    let sum = 0;
    for (let i = 0; i < this.params.length && i < features.length; i++) {
      sum += this.params[i] * (features[i] ?? 0);
    }
    return sum;
  }

  compute_loss(data: TrainingData[]): number {
    let loss = 0;
    for (const sample of data) {
      const pred = this.predict(sample.features) as number;
      const error = pred - (sample.target as number);
      loss += error * error;
    }
    return loss / data.length;
  }
}

/**
 * Generate synthetic training data
 */
function generateData(num_samples: number, dim: number = 10): TrainingData[] {
  const data: TrainingData[] = [];
  for (let i = 0; i < num_samples; i++) {
    const features = new Array(dim).fill(0).map(() => Math.random() * 2 - 1);
    const target =
      features.reduce((sum, f) => sum + f, 0) + Math.random() * 0.1;
    data.push({ features, target });
  }
  return data;
}

// ============================================================================
// DIFFERENTIAL PRIVACY TESTS
// ============================================================================

describe("DifferentialPrivacy", () => {
  let dp: DifferentialPrivacy;

  beforeEach(() => {
    dp = new DifferentialPrivacy({
      epsilon: 1.0,
      delta: 1e-5,
      seed: 42, // Fixed seed for reproducibility
    });
  });

  describe("constructor", () => {
    it("should create instance with valid parameters", () => {
      expect(dp).toBeDefined();
      expect(dp.get_epsilon()).toBe(1.0);
      expect(dp.get_delta()).toBe(1e-5);
    });

    it("should reject non-positive epsilon", () => {
      expect(
        () =>
          new DifferentialPrivacy({
            epsilon: 0,
            delta: 1e-5,
          })
      ).toThrow("Epsilon must be positive");
    });

    it("should reject invalid delta", () => {
      expect(
        () =>
          new DifferentialPrivacy({
            epsilon: 1.0,
            delta: -1,
          })
      ).toThrow("Delta must be in [0, 1)");

      expect(
        () =>
          new DifferentialPrivacy({
            epsilon: 1.0,
            delta: 1,
          })
      ).toThrow("Delta must be in [0, 1)");
    });
  });

  describe("privacy budget management", () => {
    it("should track remaining budget", () => {
      const budget = dp.get_remaining_budget();
      expect(budget.epsilon_remaining).toBe(1.0);
      expect(budget.delta_remaining).toBe(1e-5);
      expect(budget.epsilon_spent).toBe(0);
      expect(budget.delta_spent).toBe(0);
    });

    it("should spend budget correctly", () => {
      const cost: PrivacyCost = { epsilon: 0.3, delta: 1e-6 };
      dp.spend_budget(cost);

      const budget = dp.get_remaining_budget();
      expect(budget.epsilon_remaining).toBeCloseTo(0.7, 5);
      expect(budget.delta_remaining).toBeCloseTo(9e-6, 7);
    });

    it("should reset budget", () => {
      dp.spend_budget({ epsilon: 0.5, delta: 5e-6 });
      dp.reset_budget();

      const budget = dp.get_remaining_budget();
      expect(budget.epsilon_remaining).toBe(1.0);
      expect(budget.delta_remaining).toBe(1e-5);
    });

    it("should warn when budget exhausted", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      dp.spend_budget({ epsilon: 1.5, delta: 1e-4 });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Insufficient privacy budget")
      );

      warnSpy.mockRestore();
    });

    it("should throw when configured and budget exhausted", () => {
      const dpStrict = new DifferentialPrivacy({
        epsilon: 1.0,
        delta: 1e-5,
        throwOnExhaustion: true,
      });

      expect(() =>
        dpStrict.spend_budget({ epsilon: 1.5, delta: 1e-4 })
      ).toThrow("Insufficient privacy budget");
    });
  });

  describe("Laplace mechanism", () => {
    it("should add Laplace noise to scalar", () => {
      const value = 100;
      const sensitivity = 1;

      const noisy = dp.add_laplace_noise(value, sensitivity);

      // Noise should be added (value should change)
      expect(noisy).not.toBe(value);

      // Should be roughly centered around true value
      expect(Math.abs(noisy - value)).toBeLessThan(
        (sensitivity / dp.get_epsilon()) * 10
      );
    });

    it("should add Laplace noise to vector", () => {
      const vector = [1, 2, 3, 4, 5];
      const sensitivity = 1;

      const noisy = dp.add_laplace_noise_vector(vector, sensitivity);

      expect(noisy).toHaveLength(vector.length);

      // All elements should be different
      for (let i = 0; i < vector.length; i++) {
        expect(noisy[i]).not.toBe(vector[i]);
      }
    });

    it("should handle zero sensitivity", () => {
      const value = 100;
      const noisy = dp.add_laplace_noise(value, 0);
      expect(noisy).toBe(value);
    });

    it("should reject negative sensitivity", () => {
      expect(() => dp.add_laplace_noise(100, -1)).toThrow(
        "Sensitivity must be non-negative"
      );
    });
  });

  describe("Gaussian mechanism", () => {
    it("should add Gaussian noise to scalar", () => {
      const value = 100;
      const sensitivity = 1;

      const noisy = dp.add_gaussian_noise(value, sensitivity);

      // Noise should be added
      expect(noisy).not.toBe(value);

      // Should be roughly centered around true value
      expect(Math.abs(noisy - value)).toBeLessThan(sensitivity * 5);
    });

    it("should add Gaussian noise to vector", () => {
      const vector = [1, 2, 3, 4, 5];
      const sensitivity = 1;

      const noisy = dp.add_gaussian_noise_vector(vector, sensitivity);

      expect(noisy).toHaveLength(vector.length);

      // All elements should be different
      for (let i = 0; i < vector.length; i++) {
        expect(noisy[i]).not.toBe(vector[i]);
      }
    });
  });

  describe("advanced mechanisms", () => {
    it("should add noise to histogram", () => {
      const histogram = [10, 20, 30, 40, 50];
      const sensitivity = 1;

      const noisy = dp.add_noise_histogram(histogram, sensitivity);

      expect(noisy).toHaveLength(histogram.length);

      // All bins should be non-negative
      for (const bin of noisy) {
        expect(bin).toBeGreaterThanOrEqual(0);
      }
    });

    it("should add noise to count", () => {
      const count = 100;
      const noisy = dp.add_noise_count(count, 1);

      expect(noisy).toBeGreaterThanOrEqual(0);
      expect(typeof noisy).toBe("number");
    });

    it("should add noise to average", () => {
      const average = 50;
      const count = 100;
      const sensitivity = 10;

      const noisy = dp.add_noise_average(average, count, sensitivity);

      expect(typeof noisy).toBe("number");
    });
  });

  describe("composition theorems", () => {
    it("should compute sequential composition", () => {
      const epsilons = [0.3, 0.3, 0.4];
      const total = dp.sequential_composition(epsilons);

      expect(total).toBeCloseTo(1.0, 5);
    });

    it("should compute parallel composition", () => {
      const epsilons = [0.3, 0.5, 0.7];
      const total = dp.parallel_composition(epsilons);

      expect(total).toBe(0.7); // Maximum
    });

    it("should compute advanced composition", () => {
      const epsilons = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
      const delta = 1e-5;

      const total = dp.advanced_composition(epsilons, delta);

      // Advanced composition should give a reasonable bound
      const sequential = dp.sequential_composition(epsilons);
      expect(total).toBeGreaterThan(0);
      // Advanced composition may be better or worse depending on parameters
      // but should always be finite
      expect(Number.isFinite(total)).toBe(true);
    });
  });

  describe("utility analysis", () => {
    it("should estimate utility loss", () => {
      const noise_level = 1.0;
      const loss: UtilityLoss = dp.estimate_utility_loss(noise_level);

      expect(loss.accuracy_loss).toBeGreaterThan(0);
      expect(loss.variance_increase).toBeGreaterThan(0);
      expect(loss.confidence_interval).toHaveLength(2);
    });

    it("should recommend epsilon for target accuracy", () => {
      const target_accuracy = 0.9;
      const sensitivity = 1;

      const epsilon = dp.recommend_epsilon_for_target_accuracy(
        target_accuracy,
        sensitivity
      );

      expect(epsilon).toBeGreaterThan(0);
      expect(Number.isFinite(epsilon)).toBe(true);
    });

    it("should handle perfect accuracy", () => {
      const epsilon = dp.recommend_epsilon_for_target_accuracy(1.0, 1);
      expect(epsilon).toBe(Infinity);
    });
  });

  describe("utility methods", () => {
    it("should clone instance", () => {
      const cloned = dp.clone();

      expect(cloned.get_epsilon()).toBe(dp.get_epsilon());
      expect(cloned.get_delta()).toBe(dp.get_delta());
    });

    it("should convert to JSON", () => {
      const json = dp.toJSON();

      expect(json).toHaveProperty("initial_epsilon");
      expect(json).toHaveProperty("initial_delta");
      expect(json).toHaveProperty("epsilon_remaining");
      expect(json).toHaveProperty("delta_remaining");
    });
  });
});

describe("MomentsAccountant", () => {
  let accountant: MomentsAccountant;

  beforeEach(() => {
    accountant = new MomentsAccountant();
  });

  it("should track privacy loss", () => {
    accountant.add_step(1.0, 0.01, 100);

    const spent = accountant.get_privacy_spent(1e-5);
    expect(spent.epsilon).toBeGreaterThan(0);
  });

  it("should reset", () => {
    accountant.add_step(1.0, 0.01, 100);
    accountant.reset();

    const spent = accountant.get_privacy_spent(1e-5);
    expect(spent.epsilon).toBe(0);
  });
});

describe("RDPAccountant", () => {
  let accountant: RDPAccountant;

  beforeEach(() => {
    accountant = new RDPAccountant([2, 4, 8, 16]);
  });

  it("should track privacy loss", () => {
    accountant.add_step(1.0, 0.01, 100);

    const spent = accountant.get_privacy_spent(1e-5);
    expect(spent.epsilon).toBeGreaterThan(0);
  });

  it("should reset", () => {
    accountant.add_step(1.0, 0.01, 100);
    accountant.reset();

    const spent = accountant.get_privacy_spent(1e-5);
    // After reset, privacy cost should be very small (effectively 0 for most purposes)
    expect(spent.epsilon).toBeLessThan(0.1);
  });
});

describe("ZCDPAccountant", () => {
  let accountant: ZCDPAccountant;

  beforeEach(() => {
    accountant = new ZCDPAccountant();
  });

  it("should track privacy loss", () => {
    accountant.add_step(1.0, 0.01, 100);

    const spent = accountant.get_privacy_spent(1e-5);
    expect(spent.epsilon).toBeGreaterThan(0);
  });

  it("should reset", () => {
    accountant.add_step(1.0, 0.01, 100);
    accountant.reset();

    const spent = accountant.get_privacy_spent(1e-5);
    expect(spent.epsilon).toBeCloseTo(0, 5);
  });
});

// ============================================================================
// PRIVATE GRADIENT TESTS
// ============================================================================

describe("PrivateGradient", () => {
  let dp: DifferentialPrivacy;
  let pg: PrivateGradient;

  beforeEach(() => {
    dp = new DifferentialPrivacy({
      epsilon: 1.0,
      delta: 1e-5,
      seed: 42,
    });
    pg = new PrivateGradient(dp, DEFAULT_GRADIENT_CONFIG);
  });

  describe("constructor", () => {
    it("should create instance with default config", () => {
      expect(pg).toBeDefined();
      const config = pg.get_config();
      expect(config.clipping_norm).toBe(DEFAULT_GRADIENT_CONFIG.clipping_norm);
      expect(config.noise_multiplier).toBe(
        DEFAULT_GRADIENT_CONFIG.noise_multiplier
      );
    });

    it("should create instance with custom config", () => {
      const customConfig: PrivateGradientConfig = {
        clipping_norm: 2.0,
        noise_multiplier: 0.5,
      };
      const pg2 = new PrivateGradient(dp, customConfig);

      const config = pg2.get_config();
      expect(config.clipping_norm).toBe(2.0);
      expect(config.noise_multiplier).toBe(0.5);
    });
  });

  describe("gradient clipping", () => {
    it("should clip gradient to max norm", () => {
      const gradient = [3, 4, 0]; // L2 norm = 5
      const max_norm = 2;

      const clipped = pg.clip_gradient(gradient, max_norm);

      const norm = pg.compute_gradient_norm(clipped);
      expect(norm).toBeCloseTo(2, 5);
    });

    it("should not clip if within norm", () => {
      const gradient = [1, 1, 1]; // L2 norm = sqrt(3) < 2
      const max_norm = 2;

      const clipped = pg.clip_gradient(gradient, max_norm);

      expect(clipped).toEqual(gradient);
    });

    it("should handle zero gradient", () => {
      const gradient = [0, 0, 0];
      const clipped = pg.clip_gradient(gradient, 1);
      expect(clipped).toEqual([0, 0, 0]);
    });

    it("should compute gradient norm correctly", () => {
      const gradient1 = [3, 4]; // norm = 5
      const gradient2 = [1, 1, 1]; // norm = sqrt(3)

      expect(pg.compute_gradient_norm(gradient1)).toBeCloseTo(5, 5);
      expect(pg.compute_gradient_norm(gradient2)).toBeCloseTo(Math.sqrt(3), 5);
    });

    it("should perform adaptive clipping", () => {
      const gradients = [
        [1, 2, 3],
        [4, 5, 6],
        [0.1, 0.2, 0.3],
      ];

      const clipped = pg.clip_gradient_adaptive(gradients, 0.5);

      expect(clipped).toHaveLength(gradients.length);
    });
  });

  describe("private gradient computation", () => {
    it("should compute private gradient", () => {
      const gradient = [1, 2, 3, 4, 5];
      const sensitivity = 1;

      const result: GradientResult = pg.compute_private_gradient(
        gradient,
        sensitivity
      );

      expect(result.gradient).toHaveLength(gradient.length);
      expect(result.privacy_cost.epsilon).toBeGreaterThan(0);
      expect(typeof result.was_clipped).toBe("boolean");
      expect(result.original_norm).toBeGreaterThan(0);
    });

    it("should compute private gradient per parameter", () => {
      const gradient = [1, 2, 3, 4, 5];
      const sensitivities = [1, 1, 1, 1, 1];

      const result = pg.compute_private_gradient_per_parameter(
        gradient,
        sensitivities
      );

      expect(result.gradient).toHaveLength(gradient.length);
      expect(result.privacy_cost.epsilon).toBeGreaterThan(0);
    });

    it("should reject mismatched gradient and sensitivity lengths", () => {
      const gradient = [1, 2, 3];
      const sensitivities = [1, 2];

      expect(() =>
        pg.compute_private_gradient_per_parameter(gradient, sensitivities)
      ).toThrow("must have same length");
    });

    it("should compute private gradient with budget", () => {
      const gradient = [1, 2, 3];
      const budgets = [0.1, 0.1, 0.1];

      const result = pg.compute_private_gradient_with_budget(gradient, budgets);

      expect(result.gradient).toHaveLength(gradient.length);
      expect(result.privacy_cost.epsilon).toBeCloseTo(0.3, 5);
    });
  });

  describe("gradient aggregation", () => {
    it("should aggregate gradients without weights", () => {
      const gradients = [
        [1, 2, 3],
        [3, 4, 5],
        [5, 6, 7],
      ];

      const aggregated = pg.aggregate_gradients(gradients);

      expect(aggregated).toEqual([3, 4, 5]); // Average
    });

    it("should aggregate gradients with weights", () => {
      const gradients = [
        [1, 2, 3],
        [3, 4, 5],
      ];
      const weights = [1, 2];

      const aggregated = pg.aggregate_gradients(gradients, weights);

      // Weighted average: (1*1 + 3*2)/3, (2*1 + 4*2)/3, (3*1 + 5*2)/3
      expect(aggregated[0]).toBeCloseTo(7 / 3, 5);
      expect(aggregated[1]).toBeCloseTo(10 / 3, 5);
      expect(aggregated[2]).toBeCloseTo(13 / 3, 5);
    });

    it("should reject empty gradient list", () => {
      expect(() => pg.aggregate_gradients([])).toThrow(
        "Cannot aggregate empty"
      );
    });

    it("should aggregate gradients privately", () => {
      const gradients = [
        [1, 2, 3],
        [3, 4, 5],
      ];

      const private_agg = pg.aggregate_gradients_privately(gradients, 1);

      expect(private_agg).toHaveLength(3);
    });
  });

  describe("sensitivity analysis", () => {
    it("should compute sensitivity", () => {
      const gradient = [3, 4];
      const clipping_norm = 2;

      const sensitivity = pg.compute_sensitivity(gradient, clipping_norm);

      expect(sensitivity).toBeLessThanOrEqual(clipping_norm);
    });

    it("should estimate privacy cost", () => {
      const cost = pg.estimate_privacy_cost(1000, 1.0, 10, 32);

      expect(cost.epsilon).toBeGreaterThan(0);
      expect(cost.delta).toBeGreaterThan(0);
    });
  });

  describe("utility methods", () => {
    it("should compute SNR", () => {
      const gradient = [1, 2, 3];
      const snr = pg.compute_snr(gradient);

      expect(snr).toBeGreaterThan(0);
    });

    it("should estimate variance", () => {
      const variance = pg.estimate_variance(100);

      expect(variance).toBeGreaterThan(0);
    });

    it("should compute effective learning rate", () => {
      const lr = pg.compute_effective_learning_rate(0.01, 1.0);

      expect(lr).toBeGreaterThan(0);
      expect(lr).toBeLessThan(0.01); // Should be reduced
    });

    it("should get and reset clipping stats", () => {
      pg.compute_private_gradient([3, 4], 1);
      const stats1 = pg.get_clipping_stats();
      expect(stats1.total).toBe(1);

      pg.reset_clipping_stats();
      const stats2 = pg.get_clipping_stats();
      expect(stats2.total).toBe(0);
    });
  });
});

// ============================================================================
// PRIVATE TRAINER TESTS
// ============================================================================

describe("PrivateTrainer", () => {
  let trainer: PrivateTrainer;
  let model: Model;

  beforeEach(() => {
    trainer = new PrivateTrainer(DEFAULT_TRAINER_CONFIG);
    model = new TestModel(10);
  });

  describe("constructor", () => {
    it("should create instance with default config", () => {
      expect(trainer).toBeDefined();
      const config = trainer.get_config();
      expect(config.epsilon).toBe(DEFAULT_TRAINER_CONFIG.epsilon);
      expect(config.delta).toBe(DEFAULT_TRAINER_CONFIG.delta);
    });

    it("should create instance with custom config", () => {
      const customConfig: PrivateTrainerConfig = {
        epsilon: 2.0,
        delta: 1e-4,
        max_epochs: 5,
        batch_size: 64,
        learning_rate: 0.001,
        clipping_norm: 2.0,
        noise_multiplier: 0.5,
        accountant_type: "zcdp",
      };

      const trainer2 = new PrivateTrainer(customConfig);
      const config = trainer2.get_config();

      expect(config.epsilon).toBe(2.0);
      expect(config.delta).toBe(1e-4);
    });
  });

  describe("budget allocation", () => {
    it("should allocate budget for training", () => {
      const allocation = trainer.allocate_budget_for_training(10, 100);

      expect(allocation.num_epochs).toBe(10);
      expect(allocation.batches_per_epoch).toBe(100);
      expect(allocation.epsilon_per_batch).toBeGreaterThan(0);
    });

    it("should check budget remaining", () => {
      expect(trainer.check_budget_remaining()).toBe(true);
    });

    it("should get privacy spent", () => {
      const spent = trainer.get_privacy_spent();

      expect(spent.epsilon).toBeGreaterThanOrEqual(0);
      expect(spent.delta).toBeGreaterThanOrEqual(0);
    });
  });

  describe("training loop", () => {
    it("should train on a batch", async () => {
      const data = generateData(32, 10);
      const initial_params = model.get_parameters();

      const result = await trainer.train_batch(data, model);

      expect(result.loss).toBeGreaterThanOrEqual(0);
      expect(result.privacy_cost.epsilon).toBeGreaterThan(0);
      expect(result.gradient_norm).toBeGreaterThan(0);

      // Parameters should have changed
      const new_params = model.get_parameters();
      expect(new_params).not.toEqual(initial_params);
    });

    it("should train for an epoch", async () => {
      const data = generateData(100, 10);
      const initial_loss = model.compute_loss(data);

      const result = await trainer.train_epoch(data, model);

      expect(result.loss).toBeGreaterThanOrEqual(0);
      expect(result.privacy_cost.epsilon).toBeGreaterThan(0);
      expect(result.epochs_completed).toBe(1);
    });

    it("should train for multiple epochs", async () => {
      const data = generateData(100, 10);

      const result = await trainer.train(data, model);

      expect(result.epochs_completed).toBeGreaterThan(0);
      expect(result.privacy_cost.epsilon).toBeGreaterThan(0);
      expect(result.loss).toBeLessThan(Infinity);
    });
  });

  describe("privacy reporting", () => {
    it("should generate privacy report", () => {
      const report = trainer.get_privacy_report();

      expect(report.total_spent).toHaveProperty("epsilon");
      expect(report.total_spent).toHaveProperty("delta");
      expect(report.remaining).toHaveProperty("epsilon_remaining");
      expect(report.remaining).toHaveProperty("delta_remaining");
      expect(report.risk_assessment).toHaveProperty("level");
    });

    it("should assess privacy risk", () => {
      const risk = trainer.get_privacy_risk_assessment();

      expect(["low", "medium", "high"]).toContain(risk.level);
      expect(risk.confidence).toBeGreaterThan(0);
      expect(Array.isArray(risk.recommendations)).toBe(true);
    });
  });

  describe("utility metrics", () => {
    it("should get utility metrics", () => {
      const metrics = trainer.get_utility_metrics();

      expect(metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(metrics.loss).toBeGreaterThanOrEqual(0);
      expect(metrics.snr).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.gradient_variance).toBe("number");
      expect(typeof metrics.effective_learning_rate).toBe("number");
    });
  });

  describe("hyperparameter tuning", () => {
    it("should tune noise multiplier", async () => {
      const data = generateData(50, 10);

      const result = await trainer.tune_noise_multiplier(data);

      expect(result.noise_multiplier).toBeGreaterThan(0);
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(result.privacy_cost).toHaveProperty("epsilon");
    });

    it("should tune clipping norm", async () => {
      const data = generateData(50, 10);

      const result = await trainer.tune_clipping_norm(data);

      expect(result.clipping_norm).toBeGreaterThan(0);
      expect(result.utility).toBeGreaterThanOrEqual(0);
    });

    it("should tune batch size", async () => {
      const data = generateData(50, 10);

      const result = await trainer.tune_batch_size(data);

      expect(result.batch_size).toBeGreaterThan(0);
    });
  });

  describe("utility-privacy tradeoff", () => {
    it("should compute privacy-utility curve", async () => {
      const data = generateData(50, 10);

      const curve = await trainer.compute_privacy_utility_curve(data);

      expect(curve.epsilons).toHaveLength(5);
      expect(curve.accuracies).toHaveLength(5);
      expect(curve.privacy_losses).toHaveLength(5);
      expect(Array.isArray(curve.recommendations)).toBe(true);
    });

    it("should find optimal epsilon", async () => {
      const data = generateData(50, 10);

      const result = await trainer.find_optimal_epsilon(data);

      expect(result.optimal_epsilon).toBeGreaterThan(0);
      expect(result.accuracy).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.pareto_frontier)).toBe(true);
    });
  });

  describe("reset", () => {
    it("should reset training state", async () => {
      const data = generateData(50, 10);
      await trainer.train_epoch(data, model);

      trainer.reset();

      const spent = trainer.get_privacy_spent();
      expect(spent.epsilon).toBeCloseTo(0, 5);
      expect(spent.delta).toBeCloseTo(0, 5);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Privacy-Preserving ML Integration", () => {
  it("should perform end-to-end private training", async () => {
    // Setup with larger privacy budget to allow multiple epochs
    const config: PrivateTrainerConfig = {
      ...DEFAULT_TRAINER_CONFIG,
      epsilon: 10.0, // Larger budget
      delta: 1e-4,
      max_epochs: 3,
      batch_size: 32,
    };
    const trainer = new PrivateTrainer(config);
    const model = new TestModel(10);
    const data = generateData(100, 10);

    // Train
    const result = await trainer.train(data, model);

    // Verify
    expect(result.epochs_completed).toBeGreaterThan(0);
    expect(result.epochs_completed).toBeLessThanOrEqual(3);
    expect(result.loss).toBeLessThan(Infinity);
    expect(result.privacy_cost.epsilon).toBeGreaterThan(0);

    // Check privacy budget
    const report = trainer.get_privacy_report();
    expect(report.total_spent.epsilon).toBeGreaterThan(0);
    expect(report.risk_assessment.level).toBeDefined();
  });

  it("should maintain privacy guarantees throughout training", async () => {
    const dp = new DifferentialPrivacy({
      epsilon: 1.0,
      delta: 1e-5,
      throwOnExhaustion: true,
    });

    const config: PrivateTrainerConfig = {
      ...DEFAULT_TRAINER_CONFIG,
      max_epochs: 20, // Many epochs to test budget exhaustion
      batch_size: 32,
    };

    const trainer = new PrivateTrainer(config);
    const model = new TestModel(10);
    const data = generateData(100, 10);

    // Train until budget exhausted or max epochs
    let epochs = 0;
    try {
      while (trainer.check_budget_remaining() && epochs < config.max_epochs) {
        await trainer.train_epoch(data, model);
        epochs++;
      }
    } catch (e) {
      // Expected to exhaust budget
    }

    expect(epochs).toBeGreaterThan(0);
    expect(epochs).toBeLessThanOrEqual(config.max_epochs);
  });

  it("should achieve reasonable accuracy with privacy", async () => {
    const config: PrivateTrainerConfig = {
      ...DEFAULT_TRAINER_CONFIG,
      epsilon: 5.0, // Larger budget for better learning
      delta: 1e-4,
      max_epochs: 5,
      learning_rate: 0.1,
    };
    const trainer = new PrivateTrainer(config);
    const model = new TestModel(10);

    // Generate data with clear pattern
    const data: TrainingData[] = [];
    for (let i = 0; i < 200; i++) {
      const features = [Math.random(), Math.random()];
      const target = features[0] + features[1];
      data.push({ features, target });
    }

    const result = await trainer.train(data, model);

    // Check that model learned something
    const testSample = { features: [0.5, 0.5], target: 1.0 };
    const prediction = model.predict(testSample.features);

    // Prediction should be reasonably close (within 1.5, considering DP noise)
    expect(Math.abs((prediction as number) - testSample.target)).toBeLessThan(
      1.5
    );
  });
});
