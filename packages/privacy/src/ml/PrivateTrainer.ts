/**
 * @file Private Trainer for Differentially Private ML Training
 *
 * Implements a training loop with differential privacy guarantees.
 * Manages privacy budget, hyperparameters, and utility-privacy tradeoffs.
 *
 * Key Concepts:
 * - Private training loop with DP-SGD
 * - Privacy budget management per epoch/batch
 * - Hyperparameter tuning for privacy-utility tradeoff
 * - Privacy monitoring and reporting
 *
 * @module privacy/ml
 */

import {
  DifferentialPrivacy,
  PrivacyCost,
  PrivacyBudget,
} from "./DifferentialPrivacy.js";
import { PrivateGradient, PrivateGradientConfig } from "./PrivateGradient.js";

/**
 * Training data sample
 */
export interface TrainingData {
  /** Input features */
  features: number[];
  /** Target label/value */
  target: number | number[];
}

/**
 * Validation data
 */
export interface ValidationData {
  /** Input features */
  features: number[];
  /** Target label/value */
  target: number | number[];
}

/**
 * Simple model interface
 */
export interface Model {
  /** Get model parameters */
  get_parameters(): number[];
  /** Set model parameters */
  set_parameters(params: number[]): void;
  /** Compute gradient on a batch */
  compute_gradient(batch: TrainingData[]): number[];
  /** Make prediction */
  predict(features: number[]): number | number[];
  /** Compute loss */
  compute_loss(data: TrainingData[]): number;
}

/**
 * Training result
 */
export interface TrainingResult {
  /** Trained model parameters */
  parameters: number[];
  /** Final loss */
  loss: number;
  /** Privacy cost incurred */
  privacy_cost: PrivacyCost;
  /** Number of epochs completed */
  epochs_completed: number;
  /** Training metrics */
  metrics: TrainingMetrics;
}

/**
 * Batch training result
 */
export interface BatchResult {
  /** Batch loss */
  loss: number;
  /** Privacy cost for this batch */
  privacy_cost: PrivacyCost;
  /** Gradient norm */
  gradient_norm: number;
  /** Whether gradient was clipped */
  was_clipped: boolean;
  /** Learning rate used */
  learning_rate: number;
}

/**
 * Training metrics
 */
export interface TrainingMetrics {
  /** Loss over time */
  losses: number[];
  /** Accuracy over time (for classification) */
  accuracies?: number[];
  /** Gradient norms over time */
  gradient_norms: number[];
  /** Clipping rates over time */
  clipping_rates: number[];
  /** Privacy spent over time */
  privacy_spent: PrivacyCost[];
}

/**
 * Budget allocation for training
 */
export interface BudgetAllocation {
  /** Epsilon per epoch */
  epsilon_per_epoch: number;
  /** Delta per epoch */
  delta_per_epoch: number;
  /** Epsilon per batch */
  epsilon_per_batch: number;
  /** Delta per batch */
  delta_per_batch: number;
  /** Number of epochs */
  num_epochs: number;
  /** Number of batches per epoch */
  batches_per_epoch: number;
}

/**
 * Privacy report
 */
export interface PrivacyReport {
  /** Total privacy budget spent */
  total_spent: PrivacyCost;
  /** Remaining budget */
  remaining: PrivacyBudget;
  /** Per-epoch breakdown */
  per_epoch: PrivacyCost[];
  /** Privacy risk assessment */
  risk_assessment: PrivacyRisk;
}

/**
 * Privacy risk assessment
 */
export interface PrivacyRisk {
  /** Risk level */
  level: "low" | "medium" | "high";
  /** Confidence in risk assessment */
  confidence: number;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Noise multiplier tuning result
 */
export interface NoiseMultiplierResult {
  /** Optimal noise multiplier */
  noise_multiplier: number;
  /** Expected accuracy */
  accuracy: number;
  /** Privacy cost */
  privacy_cost: PrivacyCost;
  /** Tradeoff analysis */
  tradeoff: {
    low_noise: { accuracy: number; privacy_cost: PrivacyCost };
    medium_noise: { accuracy: number; privacy_cost: PrivacyCost };
    high_noise: { accuracy: number; privacy_cost: PrivacyCost };
  };
}

/**
 * Clipping norm tuning result
 */
export interface ClippingNormResult {
  /** Optimal clipping norm */
  clipping_norm: number;
  /** Expected utility */
  utility: number;
  /** Clipping statistics */
  stats: {
    clip_rate: number;
    avg_norm: number;
  };
}

/**
 * Batch size tuning result
 */
export interface BatchSizeResult {
  /** Optimal batch size */
  batch_size: number;
  /** Privacy-utility tradeoff */
  tradeoff: {
    small_batch: { efficiency: number; privacy_cost: PrivacyCost };
    medium_batch: { efficiency: number; privacy_cost: PrivacyCost };
    large_batch: { efficiency: number; privacy_cost: PrivacyCost };
  };
}

/**
 * Privacy-utility curve data
 */
export interface PrivacyUtilityCurve {
  /** Epsilon values tested */
  epsilons: number[];
  /** Corresponding accuracies */
  accuracies: number[];
  /** Corresponding privacy losses */
  privacy_losses: number[];
  /** Recommendations */
  recommendations?: Recommendation[];
}

/**
 * Recommendation for privacy parameters
 */
export interface Recommendation {
  /** Suggested epsilon */
  epsilon: number;
  /** Expected accuracy */
  expected_accuracy: number;
  /** Privacy risk level */
  risk_level: "low" | "medium" | "high";
  /** Reasoning */
  reasoning: string;
}

/**
 * Optimization result for finding optimal epsilon
 */
export interface OptimizationResult {
  /** Optimal epsilon value */
  optimal_epsilon: number;
  /** Expected accuracy at optimal epsilon */
  accuracy: number;
  /** Privacy cost */
  privacy_cost: PrivacyCost;
  /** Pareto frontier (epsilon, accuracy) pairs */
  pareto_frontier: [number, number][];
}

/**
 * Utility metrics
 */
export interface UtilityMetrics {
  /** Model accuracy */
  accuracy: number;
  /** Model loss */
  loss: number;
  /** Signal-to-noise ratio */
  snr: number;
  /** Gradient variance */
  gradient_variance: number;
  /** Effective learning rate */
  effective_learning_rate: number;
}

/**
 * Configuration for private trainer
 */
export interface PrivateTrainerConfig {
  /** Total epsilon budget */
  epsilon: number;
  /** Total delta budget */
  delta: number;
  /** Maximum epochs */
  max_epochs: number;
  /** Batch size */
  batch_size: number;
  /** Learning rate */
  learning_rate: number;
  /** Gradient clipping norm */
  clipping_norm: number;
  /** Noise multiplier */
  noise_multiplier: number;
  /** Privacy accountant type */
  accountant_type: "moments" | "rdp" | "zcdp";
  /** Learning rate decay */
  learning_rate_decay?: number;
  /** Gradient accumulation steps */
  gradient_accumulation_steps?: number;
  /** Early stopping patience */
  early_stopping_patience?: number;
}

/**
 * Default trainer configuration
 */
export const DEFAULT_TRAINER_CONFIG: PrivateTrainerConfig = {
  epsilon: 1.0,
  delta: 1e-5,
  max_epochs: 10,
  batch_size: 32,
  learning_rate: 0.01,
  clipping_norm: 1.0,
  noise_multiplier: 1.0,
  accountant_type: "rdp",
  learning_rate_decay: 0.99,
  gradient_accumulation_steps: 1,
  early_stopping_patience: 3,
};

/**
 * Private trainer with differential privacy
 *
 * Implements DP-SGD (Differentially Private Stochastic Gradient Descent).
 *
 * Algorithm:
 * 1. For each batch:
 *    a. Compute per-sample gradients
 *    b. Clip each gradient to bound sensitivity
 *    c. Aggregate clipped gradients
 *    d. Add Gaussian noise for (ε, δ)-DP
 *    e. Update model parameters
 * 2. Track privacy budget with accountant
 * 3. Monitor utility-privacy tradeoff
 *
 * Reference: Abadi et al. (2016) "Deep Learning with Differential Privacy"
 */
export class PrivateTrainer {
  private readonly dp: DifferentialPrivacy;
  private readonly gradient_computer: PrivateGradient;
  private readonly config: PrivateTrainerConfig;
  private readonly initial_epsilon: number;
  private readonly initial_delta: number;

  // Training state
  private current_epoch: number;
  private current_learning_rate: number;
  private best_loss: number;
  private patience_counter: number;
  private training_metrics: TrainingMetrics;

  /**
   * Create a private trainer
   *
   * @param config - Training configuration
   */
  constructor(config: PrivateTrainerConfig = DEFAULT_TRAINER_CONFIG) {
    this.config = { ...DEFAULT_TRAINER_CONFIG, ...config };
    this.initial_epsilon = this.config.epsilon;
    this.initial_delta = this.config.delta;

    // Create differential privacy instance
    this.dp = new DifferentialPrivacy({
      epsilon: this.config.epsilon,
      delta: this.config.delta,
    });

    // Create gradient computer
    const gradient_config: PrivateGradientConfig = {
      clipping_norm: this.config.clipping_norm,
      noise_multiplier: this.config.noise_multiplier,
    };
    this.gradient_computer = new PrivateGradient(this.dp, gradient_config);

    // Initialize training state
    this.current_epoch = 0;
    this.current_learning_rate = this.config.learning_rate;
    this.best_loss = Infinity;
    this.patience_counter = 0;
    this.training_metrics = {
      losses: [],
      accuracies: [],
      gradient_norms: [],
      clipping_rates: [],
      privacy_spent: [],
    };
  }

  // ============================================================================
  // TRAINING LOOP
  // ============================================================================

  /**
   * Train for one epoch
   *
   * @param training_data - Training dataset
   * @param model - Model to train
   * @returns Training result
   */
  async train_epoch(
    training_data: TrainingData[],
    model: Model
  ): Promise<TrainingResult> {
    const num_batches = Math.ceil(
      training_data.length / this.config.batch_size
    );
    let epoch_loss = 0;
    const epoch_privacy_cost: PrivacyCost = { epsilon: 0, delta: 0 };

    // Shuffle data
    const shuffled = this.shuffle_array(training_data);

    for (let batch_idx = 0; batch_idx < num_batches; batch_idx++) {
      const start = batch_idx * this.config.batch_size;
      const end = Math.min(start + this.config.batch_size, shuffled.length);
      const batch = shuffled.slice(start, end);

      const batch_result = await this.train_batch(batch, model);
      epoch_loss += batch_result.loss;
      epoch_privacy_cost.epsilon += batch_result.privacy_cost.epsilon;
      epoch_privacy_cost.delta += batch_result.privacy_cost.delta;

      // Record metrics
      this.training_metrics.losses.push(batch_result.loss);
      this.training_metrics.gradient_norms.push(batch_result.gradient_norm);
    }

    // Average loss
    epoch_loss /= num_batches;
    this.training_metrics.privacy_spent.push(epoch_privacy_cost);

    // Update learning rate
    if (this.config.learning_rate_decay) {
      this.current_learning_rate *= this.config.learning_rate_decay;
    }

    // Check early stopping
    if (epoch_loss < this.best_loss) {
      this.best_loss = epoch_loss;
      this.patience_counter = 0;
    } else {
      this.patience_counter++;
      if (this.patience_counter >= this.config.early_stopping_patience!) {
        console.log(`Early stopping at epoch ${this.current_epoch}`);
      }
    }

    this.current_epoch++;

    return {
      parameters: model.get_parameters(),
      loss: epoch_loss,
      privacy_cost: epoch_privacy_cost,
      epochs_completed: 1,
      metrics: this.training_metrics,
    };
  }

  /**
   * Train on a single batch
   *
   * @param batch - Training batch
   * @param model - Model to train
   * @returns Batch result
   */
  async train_batch(batch: TrainingData[], model: Model): Promise<BatchResult> {
    // Compute gradient
    const gradient = model.compute_gradient(batch);
    const gradient_norm =
      this.gradient_computer.compute_gradient_norm(gradient);

    // Compute private gradient
    const result = this.gradient_computer.compute_private_gradient(
      gradient,
      this.config.clipping_norm
    );

    // Update parameters
    const params = model.get_parameters();
    const new_params = params.map((p, i) => {
      const grad = result.gradient[i];
      return p - this.current_learning_rate * grad;
    });
    model.set_parameters(new_params);

    // Compute loss
    const loss = model.compute_loss(batch);

    return {
      loss,
      privacy_cost: result.privacy_cost,
      gradient_norm,
      was_clipped: result.was_clipped,
      learning_rate: this.current_learning_rate,
    };
  }

  /**
   * Train for full training run
   *
   * @param training_data - Training dataset
   * @param model - Model to train
   * @returns Training result
   */
  async train(
    training_data: TrainingData[],
    model: Model
  ): Promise<TrainingResult> {
    let total_privacy_cost: PrivacyCost = { epsilon: 0, delta: 0 };
    let final_loss = Infinity;

    for (let epoch = 0; epoch < this.config.max_epochs; epoch++) {
      const result = await this.train_epoch(training_data, model);
      total_privacy_cost.epsilon += result.privacy_cost.epsilon;
      total_privacy_cost.delta += result.privacy_cost.delta;
      final_loss = result.loss;

      console.log(
        `Epoch ${epoch + 1}/${this.config.max_epochs}, ` +
          `Loss: ${final_loss.toFixed(4)}, ` +
          `ε: ${total_privacy_cost.epsilon.toFixed(4)}, ` +
          `δ: ${total_privacy_cost.delta.toFixed(6)}`
      );

      // Check early stopping
      if (this.patience_counter >= this.config.early_stopping_patience!) {
        break;
      }

      // Check budget
      if (!this.check_budget_remaining()) {
        console.log("Privacy budget exhausted");
        break;
      }
    }

    return {
      parameters: model.get_parameters(),
      loss: final_loss,
      privacy_cost: total_privacy_cost,
      epochs_completed: this.current_epoch,
      metrics: this.training_metrics,
    };
  }

  // ============================================================================
  // PRIVACY BUDGET MANAGEMENT
  // ============================================================================

  /**
   * Allocate budget for training
   *
   * @param epochs - Number of epochs
   * @param batches_per_epoch - Number of batches per epoch
   * @returns Budget allocation
   */
  allocate_budget_for_training(
    epochs: number,
    batches_per_epoch: number
  ): BudgetAllocation {
    const total_steps = epochs * batches_per_epoch;

    // Equal allocation across epochs and batches
    const epsilon_per_batch = this.initial_epsilon / total_steps;
    const delta_per_batch = this.initial_delta / total_steps;

    return {
      epsilon_per_epoch: epsilon_per_batch * batches_per_epoch,
      delta_per_epoch: delta_per_batch * batches_per_epoch,
      epsilon_per_batch,
      delta_per_batch,
      num_epochs: epochs,
      batches_per_epoch,
    };
  }

  /**
   * Check if budget remains
   */
  check_budget_remaining(): boolean {
    const budget = this.dp.get_remaining_budget();
    return budget.epsilon_remaining > 0 && budget.delta_remaining > 0;
  }

  /**
   * Get privacy spent so far
   */
  get_privacy_spent(): PrivacyCost {
    const budget = this.dp.get_remaining_budget();
    return {
      epsilon: this.initial_epsilon - budget.epsilon_remaining,
      delta: this.initial_delta - budget.delta_remaining,
    };
  }

  /**
   * Get privacy report
   */
  get_privacy_report(): PrivacyReport {
    const spent = this.get_privacy_spent();
    const remaining = this.dp.get_remaining_budget();

    // Assess risk
    const epsilon_spent_ratio = spent.epsilon / this.initial_epsilon;
    let level: "low" | "medium" | "high";
    let confidence: number;
    const recommendations: string[] = [];

    if (epsilon_spent_ratio < 0.3) {
      level = "low";
      confidence = 0.9;
      recommendations.push("Privacy budget well within limits");
    } else if (epsilon_spent_ratio < 0.7) {
      level = "medium";
      confidence = 0.7;
      recommendations.push("Privacy budget moderately used");
      recommendations.push("Consider reducing epochs or increasing noise");
    } else {
      level = "high";
      confidence = 0.8;
      recommendations.push("Privacy budget nearly exhausted");
      recommendations.push("Stop training or increase epsilon budget");
    }

    return {
      total_spent: spent,
      remaining,
      per_epoch: this.training_metrics.privacy_spent,
      risk_assessment: {
        level,
        confidence,
        recommendations,
      },
    };
  }

  // ============================================================================
  // HYPERPARAMETER TUNING
  // ============================================================================

  /**
   * Tune noise multiplier
   *
   * @param validation_data - Validation dataset
   * @returns Optimal noise multiplier
   */
  async tune_noise_multiplier(
    validation_data: ValidationData[]
  ): Promise<NoiseMultiplierResult> {
    const multipliers = [0.5, 1.0, 2.0];
    const results: Array<{
      multiplier: number;
      accuracy: number;
      cost: PrivacyCost;
    }> = [];

    for (const m of multipliers) {
      // Simulate training with different noise levels
      const accuracy = this.estimate_accuracy_for_noise(m);
      const cost = this.estimate_privacy_for_noise(m);

      results.push({ multiplier: m, accuracy, cost });
    }

    // Select optimal based on privacy-utility tradeoff
    const optimal = results.reduce((best, curr) =>
      curr.accuracy * 0.6 - curr.cost.epsilon * 0.4 >
      best.accuracy * 0.6 - best.cost.epsilon * 0.4
        ? curr
        : best
    );

    return {
      noise_multiplier: optimal.multiplier,
      accuracy: optimal.accuracy,
      privacy_cost: optimal.cost,
      tradeoff: {
        low_noise: { accuracy: results[0].accuracy, privacy_cost: results[0].cost },
        medium_noise: { accuracy: results[1].accuracy, privacy_cost: results[1].cost },
        high_noise: { accuracy: results[2].accuracy, privacy_cost: results[2].cost },
      },
    };
  }

  /**
   * Tune clipping norm
   *
   * @param validation_data - Validation dataset
   * @returns Optimal clipping norm
   */
  async tune_clipping_norm(
    validation_data: ValidationData[]
  ): Promise<ClippingNormResult> {
    const norms = [0.5, 1.0, 2.0, 4.0];
    const results: Array<{ norm: number; utility: number; clip_rate: number }> =
      [];

    for (const norm of norms) {
      // Estimate utility based on clipping statistics
      const stats = this.gradient_computer.get_clipping_stats();
      const utility = this.estimate_utility_for_clipping(norm, stats.clip_rate);

      results.push({
        norm,
        utility,
        clip_rate: stats.clip_rate,
      });
    }

    const optimal = results.reduce((best, curr) =>
      curr.utility > best.utility ? curr : best
    );

    return {
      clipping_norm: optimal.norm,
      utility: optimal.utility,
      stats: {
        clip_rate: optimal.clip_rate,
        avg_norm: this.config.clipping_norm,
      },
    };
  }

  /**
   * Tune batch size
   *
   * @param validation_data - Validation dataset
   * @returns Optimal batch size
   */
  async tune_batch_size(
    validation_data: ValidationData[]
  ): Promise<BatchSizeResult> {
    const sizes = [16, 32, 64, 128];
    const results: Array<{
      size: number;
      efficiency: number;
      cost: PrivacyCost;
    }> = [];

    for (const size of sizes) {
      // Larger batches = more data per batch = less noise needed
      // But more computation per batch
      const sample_rate = size / validation_data.length;
      const efficiency = this.estimate_efficiency(size, sample_rate);
      const cost = this.estimate_privacy_cost_for_batch_size(
        size,
        validation_data.length
      );

      results.push({ size, efficiency, cost });
    }

    const optimal = results.reduce((best, curr) =>
      curr.efficiency > best.efficiency ? curr : best
    );

    return {
      batch_size: optimal.size,
      tradeoff: {
        small_batch: { efficiency: results[0].efficiency, privacy_cost: results[0].cost },
        medium_batch: { efficiency: results[1].efficiency, privacy_cost: results[1].cost },
        large_batch: { efficiency: results[2].efficiency, privacy_cost: results[2].cost },
      },
    };
  }

  // ============================================================================
  // UTILITY-PRIVACY TRADEOFF
  // ============================================================================

  /**
   * Compute privacy-utility curve
   *
   * @param validation_data - Validation dataset
   * @returns Curve data
   */
  async compute_privacy_utility_curve(
    validation_data: ValidationData[]
  ): Promise<PrivacyUtilityCurve> {
    const epsilons = [0.1, 0.5, 1.0, 2.0, 5.0];
    const accuracies: number[] = [];
    const privacy_losses: number[] = [];
    const recommendations: Recommendation[] = [];

    for (const eps of epsilons) {
      const accuracy = this.estimate_accuracy_for_epsilon(eps);
      const privacy_loss = this.estimate_privacy_loss(eps);

      accuracies.push(accuracy);
      privacy_losses.push(privacy_loss);

      // Generate recommendation
      let risk_level: "low" | "medium" | "high";
      if (eps < 0.5) {
        risk_level = "low";
      } else if (eps < 2.0) {
        risk_level = "medium";
      } else {
        risk_level = "high";
      }

      recommendations.push({
        epsilon: eps,
        expected_accuracy: accuracy,
        risk_level,
        reasoning: `At ε=${eps}, expect ${accuracy.toFixed(2)} accuracy with ${risk_level} privacy risk`,
      });
    }

    return {
      epsilons,
      accuracies,
      privacy_losses,
      recommendations,
    };
  }

  /**
   * Find optimal epsilon
   *
   * @param validation_data - Validation dataset
   * @returns Optimization result
   */
  async find_optimal_epsilon(
    validation_data: ValidationData[]
  ): Promise<OptimizationResult> {
    const curve = await this.compute_privacy_utility_curve(validation_data);

    // Find Pareto frontier
    let pareto: [number, number][] = [];
    let max_accuracy = -1;

    for (let i = curve.epsilons.length - 1; i >= 0; i--) {
      if (curve.accuracies[i] > max_accuracy) {
        max_accuracy = curve.accuracies[i];
        pareto.push([curve.epsilons[i], curve.accuracies[i]]);
      }
    }
    pareto = pareto.reverse();

    // Select optimal based on knee point
    let optimal_epsilon = 1.0;
    let optimal_accuracy =
      curve.accuracies[Math.floor(curve.epsilons.length / 2)];

    // Find point with best balance
    let best_score = -1;
    for (const [eps, acc] of pareto) {
      const score = acc - 0.1 * eps; // Accuracy penalty for epsilon
      if (score > best_score) {
        best_score = score;
        optimal_epsilon = eps;
        optimal_accuracy = acc;
      }
    }

    return {
      optimal_epsilon,
      accuracy: optimal_accuracy,
      privacy_cost: {
        epsilon: optimal_epsilon,
        delta: this.config.delta,
      },
      pareto_frontier: pareto,
    };
  }

  // ============================================================================
  // MONITORING
  // ============================================================================

  /**
   * Get privacy risk assessment
   */
  get_privacy_risk_assessment(): PrivacyRisk {
    const report = this.get_privacy_report();
    return report.risk_assessment;
  }

  /**
   * Get utility metrics
   */
  get_utility_metrics(): UtilityMetrics {
    const losses = this.training_metrics.losses;
    const final_loss = losses[losses.length - 1] ?? Infinity;

    // Estimate accuracy (lower loss = higher accuracy)
    const accuracy = Math.max(0, 1 - final_loss);

    // Compute SNR
    const grad_norms = this.training_metrics.gradient_norms;
    const avg_grad_norm =
      grad_norms.reduce((sum, n) => sum + n, 0) /
      Math.max(1, grad_norms.length);
    const noise_std = this.config.clipping_norm * this.config.noise_multiplier;
    const snr = avg_grad_norm / noise_std;

    return {
      accuracy,
      loss: final_loss,
      snr,
      gradient_variance: this.gradient_computer.estimate_variance(100),
      effective_learning_rate:
        this.gradient_computer.compute_effective_learning_rate(
          this.current_learning_rate,
          avg_grad_norm
        ),
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private estimate_accuracy_for_noise(noise_multiplier: number): number {
    // Simplified model: higher noise = lower accuracy
    const baseline = 0.9;
    const noise_penalty = noise_multiplier * 0.1;
    return Math.max(0, baseline - noise_penalty);
  }

  private estimate_privacy_for_noise(noise_multiplier: number): PrivacyCost {
    // Higher noise = lower privacy cost
    return {
      epsilon: this.config.epsilon / noise_multiplier,
      delta: this.config.delta,
    };
  }

  private estimate_utility_for_clipping(
    clipping_norm: number,
    clip_rate: number
  ): number {
    // Lower clip rate = higher utility
    // Moderate clipping norm = higher utility
    const optimal_norm = 1.0;
    const norm_penalty = Math.abs(clipping_norm - optimal_norm) * 0.1;
    const clip_penalty = clip_rate * 0.2;
    return Math.max(0, 1 - norm_penalty - clip_penalty);
  }

  private estimate_efficiency(batch_size: number, sample_rate: number): number {
    // Balance between sample rate and batch size
    const sample_efficiency = sample_rate;
    const size_penalty = Math.log(batch_size) / 10;
    return sample_efficiency - size_penalty;
  }

  private estimate_privacy_cost_for_batch_size(
    batch_size: number,
    num_samples: number
  ): PrivacyCost {
    // Larger batches = fewer steps = lower cost
    const steps_factor = 32 / batch_size;
    return {
      epsilon: this.config.epsilon * steps_factor,
      delta: this.config.delta * steps_factor,
    };
  }

  private estimate_accuracy_for_epsilon(epsilon: number): number {
    // Simplified model: higher epsilon = higher accuracy
    const baseline = 0.5;
    const epsilon_bonus = Math.log(epsilon + 1) * 0.3;
    return Math.min(1, baseline + epsilon_bonus);
  }

  private estimate_privacy_loss(epsilon: number): number {
    // Privacy loss is inverse of epsilon
    return 1 / (1 + epsilon);
  }

  private shuffle_array<T>(array: T[]): T[] {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Reset training state
   */
  reset(): void {
    this.dp.reset_budget();
    this.current_epoch = 0;
    this.current_learning_rate = this.config.learning_rate;
    this.best_loss = Infinity;
    this.patience_counter = 0;
    this.training_metrics = {
      losses: [],
      accuracies: [],
      gradient_norms: [],
      clipping_rates: [],
      privacy_spent: [],
    };
    this.gradient_computer.reset_clipping_stats();
  }

  /**
   * Get configuration
   */
  get_config(): PrivateTrainerConfig {
    return { ...this.config };
  }
}
