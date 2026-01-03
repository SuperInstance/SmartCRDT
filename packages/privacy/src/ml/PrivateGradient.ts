/**
 * @file Private Gradient Computation
 *
 * Implements differentially private gradient computation for machine learning.
 * Provides gradient clipping, noise addition, and per-parameter budgeting.
 *
 * Key Concepts:
 * - Gradient clipping: Bound L2 norm to limit sensitivity
 * - Noisy gradients: Add noise after clipping for DP
 * - Per-parameter privacy: Allocate budget across parameters
 * - Gradient aggregation: Combine gradients from multiple sources
 *
 * @module privacy/ml
 */

import { DifferentialPrivacy, PrivacyCost } from "./DifferentialPrivacy.js";

/**
 * Configuration for private gradient computation
 */
export interface PrivateGradientConfig {
  /** Maximum L2 norm for gradient clipping */
  clipping_norm: number;
  /** Noise multiplier (sigma = clipping_norm * noise_multiplier) */
  noise_multiplier: number;
  /** Enable per-parameter budgeting */
  per_parameter_budgeting?: boolean;
  /** Enable adaptive clipping */
  adaptive_clipping?: boolean;
  /** Clipping percentile for adaptive mode */
  clipping_percentile?: number;
}

/**
 * Default gradient configuration
 */
export const DEFAULT_GRADIENT_CONFIG: Required<PrivateGradientConfig> = {
  clipping_norm: 1.0,
  noise_multiplier: 1.0,
  per_parameter_budgeting: false,
  adaptive_clipping: false,
  clipping_percentile: 0.5,
};

/**
 * Statistics about gradient clipping
 */
export interface ClippingStats {
  /** Number of gradients clipped */
  num_clipped: number;
  /** Total number of gradients */
  total: number;
  /** Average norm before clipping */
  avg_norm_before: number;
  /** Average norm after clipping */
  avg_norm_after: number;
  /** Percentage of gradients that were clipped */
  clip_rate: number;
}

/**
 * Result of gradient computation
 */
export interface GradientResult {
  /** Private gradient */
  gradient: number[];
  /** Original gradient norm */
  original_norm: number;
  /** Clipped gradient norm */
  clipped_norm: number;
  /** Whether gradient was clipped */
  was_clipped: boolean;
  /** Privacy cost */
  privacy_cost: PrivacyCost;
}

/**
 * Private gradient computation
 *
 * Implements:
 * - Gradient clipping for bounded sensitivity
 * - Noisy gradient computation with DP
 * - Per-parameter privacy budgeting
 * - Gradient aggregation with privacy
 *
 * Theory:
 * - Each gradient has L2 sensitivity bounded by clipping_norm
 * - Add Gaussian noise: N(0, sigma^2) where sigma = clipping_norm * noise_multiplier
 * - Provides (ε, δ)-DP for each gradient
 *
 * Reference: Abadi et al. (2016) "Deep Learning with Differential Privacy"
 */
export class PrivateGradient {
  private readonly dp: DifferentialPrivacy;
  private readonly config: Required<PrivateGradientConfig>;
  private clipping_stats: ClippingStats;

  /**
   * Create a private gradient computer
   *
   * @param dp - Differential privacy instance
   * @param config - Gradient configuration
   */
  constructor(
    dp: DifferentialPrivacy,
    config: PrivateGradientConfig = DEFAULT_GRADIENT_CONFIG
  ) {
    this.dp = dp;
    this.config = { ...DEFAULT_GRADIENT_CONFIG, ...config };
    this.clipping_stats = {
      num_clipped: 0,
      total: 0,
      avg_norm_before: 0,
      avg_norm_after: 0,
      clip_rate: 0,
    };
  }

  // ============================================================================
  // GRADIENT CLIPPING
  // ============================================================================

  /**
   * Clip gradient to maximum L2 norm
   *
   * Ensures gradient has bounded sensitivity for differential privacy.
   *
   * @param gradient - Gradient vector
   * @param max_norm - Maximum L2 norm
   * @returns Clipped gradient
   */
  clip_gradient(gradient: number[], max_norm: number): number[] {
    const norm = this.compute_gradient_norm(gradient);

    if (norm <= max_norm) {
      return gradient.slice(); // Return copy
    }

    const scale = max_norm / norm;
    return gradient.map(g => g * scale);
  }

  /**
   * Adaptive gradient clipping
   *
   * Adjusts clipping norm based on gradient distribution.
   * Uses percentile-based approach.
   *
   * @param gradients - Multiple gradient vectors for adaptation
   * @param percentile - Percentile for clipping norm (0-1)
   * @returns Adaptive clipping norm
   */
  clip_gradient_adaptive(gradients: number[][], percentile: number): number[][] {
    if (gradients.length === 0) {
      return [];
    }

    // Compute norms
    const norms = gradients.map(g => this.compute_gradient_norm(g));

    // Find percentile
    const sorted = norms.slice().sort((a, b) => a - b);
    const idx = Math.floor(percentile * sorted.length);
    const adaptive_norm = sorted[Math.min(idx, sorted.length - 1)];

    // Clip all gradients to adaptive norm
    return gradients.map(g => this.clip_gradient(g, adaptive_norm));
  }

  /**
   * Compute L2 norm of gradient
   *
   * @param gradient - Gradient vector
   * @returns L2 norm
   */
  compute_gradient_norm(gradient: number[]): number {
    let sum_squares = 0;
    for (const g of gradient) {
      sum_squares += g * g;
    }
    return Math.sqrt(sum_squares);
  }

  // ============================================================================
  // PRIVATE GRADIENT COMPUTATION
  // ============================================================================

  /**
   * Compute private gradient with clipping and noise
   *
   * Process:
   * 1. Clip gradient to bound sensitivity
   * 2. Add Gaussian noise for (ε, δ)-DP
   * 3. Update privacy budget
   *
   * @param gradient - Raw gradient
   * @param sensitivity - L2 sensitivity (usually clipping_norm)
   * @returns Private gradient result
   */
  compute_private_gradient(
    gradient: number[],
    sensitivity: number
  ): GradientResult {
    const original_norm = this.compute_gradient_norm(gradient);

    // Step 1: Clip gradient
    const clipped = this.clip_gradient(gradient, this.config.clipping_norm);
    const clipped_norm = this.compute_gradient_norm(clipped);
    const was_clipped = clipped_norm < original_norm;

    // Update clipping stats
    this.clipping_stats.total++;
    if (was_clipped) {
      this.clipping_stats.num_clipped++;
    }
    this.clipping_stats.avg_norm_before =
      (this.clipping_stats.avg_norm_before * (this.clipping_stats.total - 1) +
        original_norm) /
      this.clipping_stats.total;
    this.clipping_stats.avg_norm_after =
      (this.clipping_stats.avg_norm_after * (this.clipping_stats.total - 1) +
        clipped_norm) /
      this.clipping_stats.total;
    this.clipping_stats.clip_rate =
      this.clipping_stats.num_clipped / this.clipping_stats.total;

    // Step 2: Add noise
    const sigma = sensitivity * this.config.noise_multiplier;
    const private_gradient = clipped.map(g =>
      this.dp.add_gaussian_noise(g, sigma)
    );

    // Step 3: Compute privacy cost
    // For Gaussian mechanism with sensitivity sigma, noise multiplier c:
    // ε = sensitivity / (noise_multiplier * sigma) = 1 / noise_multiplier
    // This is simplified - actual cost depends on accountant
    const privacy_cost: PrivacyCost = {
      epsilon: 1 / this.config.noise_multiplier,
      delta: this.dp.get_delta() / 1000, // Rough approximation
    };

    this.dp.spend_budget(privacy_cost);

    return {
      gradient: private_gradient,
      original_norm,
      clipped_norm,
      was_clipped,
      privacy_cost,
    };
  }

  /**
   * Compute private gradient with per-parameter budgeting
   *
   * Allocates privacy budget across parameters based on importance.
   *
   * @param gradient - Raw gradient
   * @param sensitivities - Per-parameter sensitivities
   * @returns Private gradient result
   */
  compute_private_gradient_per_parameter(
    gradient: number[],
    sensitivities: number[]
  ): GradientResult {
    if (gradient.length !== sensitivities.length) {
      throw new Error("Gradient and sensitivities must have same length");
    }

    const original_norm = this.compute_gradient_norm(gradient);

    // Clip first
    const clipped = this.clip_gradient(gradient, this.config.clipping_norm);
    const clipped_norm = this.compute_gradient_norm(clipped);
    const was_clipped = clipped_norm < original_norm;

    // Add per-parameter noise
    const private_gradient = clipped.map((g, i) => {
      const sigma = sensitivities[i] * this.config.noise_multiplier;
      return this.dp.add_gaussian_noise(g, sigma);
    });

    // Compute total privacy cost (sum of per-parameter costs)
    const privacy_cost: PrivacyCost = {
      epsilon: sensitivities.reduce(
        (sum, s) => sum + 1 / this.config.noise_multiplier,
        0
      ),
      delta: this.dp.get_delta() / 1000,
    };

    this.dp.spend_budget(privacy_cost);

    return {
      gradient: private_gradient,
      original_norm,
      clipped_norm,
      was_clipped,
      privacy_cost,
    };
  }

  /**
   * Compute private gradient with allocated budget
   *
   * @param gradient - Raw gradient
   * @param budgets - Per-parameter epsilon budgets
   * @returns Private gradient result
   */
  compute_private_gradient_with_budget(
    gradient: number[],
    budgets: number[]
  ): GradientResult {
    if (gradient.length !== budgets.length) {
      throw new Error("Gradient and budgets must have same length");
    }

    const original_norm = this.compute_gradient_norm(gradient);
    const clipped = this.clip_gradient(gradient, this.config.clipping_norm);
    const clipped_norm = this.compute_gradient_norm(clipped);
    const was_clipped = clipped_norm < original_norm;

    // Add noise with per-parameter budget
    const private_gradient = clipped.map((g, i) => {
      const epsilon = budgets[i];
      const sensitivity = this.config.clipping_norm;
      // For Gaussian: scale = sensitivity * sqrt(2*ln(1.25/delta)) / epsilon
      const delta = this.dp.get_delta();
      const scale =
        (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;
      return this.dp.add_gaussian_noise(g, scale, epsilon, delta);
    });

    const privacy_cost: PrivacyCost = {
      epsilon: budgets.reduce((sum, b) => sum + b, 0),
      delta: this.dp.get_delta(),
    };

    this.dp.spend_budget(privacy_cost);

    return {
      gradient: private_gradient,
      original_norm,
      clipped_norm,
      was_clipped,
      privacy_cost,
    };
  }

  // ============================================================================
  // GRADIENT AGGREGATION
  // ============================================================================

  /**
   * Aggregate gradients (simple average)
   *
   * @param gradients - List of gradient vectors
   * @param weights - Optional weights for each gradient
   * @returns Aggregated gradient
   */
  aggregate_gradients(gradients: number[][], weights?: number[]): number[] {
    if (gradients.length === 0) {
      throw new Error("Cannot aggregate empty gradient list");
    }

    const dim = gradients[0].length;
    const aggregated = new Array(dim).fill(0);

    if (weights) {
      if (weights.length !== gradients.length) {
        throw new Error("Weights must match number of gradients");
      }
      const total_weight = weights.reduce((sum, w) => sum + w, 0);

      for (let i = 0; i < gradients.length; i++) {
        const grad = gradients[i];
        if (grad.length !== dim) {
          throw new Error("All gradients must have same dimension");
        }
        for (let j = 0; j < dim; j++) {
          aggregated[j] += grad[j] * weights[i];
        }
      }

      // Normalize by total weight
      for (let j = 0; j < dim; j++) {
        aggregated[j] /= total_weight;
      }
    } else {
      // Simple average
      for (const grad of gradients) {
        if (grad.length !== dim) {
          throw new Error("All gradients must have same dimension");
        }
        for (let j = 0; j < dim; j++) {
          aggregated[j] += grad[j];
        }
      }

      for (let j = 0; j < dim; j++) {
        aggregated[j] /= gradients.length;
      }
    }

    return aggregated;
  }

  /**
   * Aggregate gradients with privacy
   *
   * Uses parallel composition: aggregating disjoint gradients
   * only costs max(epsilon_i), not sum(epsilon_i).
   *
   * @param gradients - List of gradient vectors
   * @param sensitivity - Sensitivity of aggregation
   * @returns Private aggregated gradient
   */
  aggregate_gradients_privately(
    gradients: number[][],
    sensitivity: number
  ): number[] {
    // Aggregate normally
    const aggregated = this.aggregate_gradients(gradients);

    // Add noise for the aggregation step
    // For average, sensitivity is bounded
    return this.dp.add_gaussian_noise_vector(aggregated, sensitivity);
  }

  // ============================================================================
  // PER-PARAMETER PRIVACY
  // ============================================================================

  /**
   * Allocate privacy budget across parameters
   *
   * Strategies:
   * - Uniform: Equal budget for all parameters
   * - Importance-based: More budget for important parameters
   * - Norm-based: Budget proportional to gradient norm
   *
   * @param num_parameters - Number of parameters
   * @param total_epsilon - Total epsilon budget
   * @param strategy - Allocation strategy
   * @returns Per-parameter epsilon budgets
   */
  allocate_budget_per_parameter(
    num_parameters: number,
    total_epsilon: number,
    strategy: "uniform" | "importance" | "norm" = "uniform"
  ): number[] {
    const budgets = new Array(num_parameters).fill(0);

    if (strategy === "uniform") {
      const per_param = total_epsilon / num_parameters;
      return budgets.fill(per_param);
    }

    // For importance and norm-based, we'd need gradient information
    // For now, return uniform as default
    const per_param = total_epsilon / num_parameters;
    return budgets.fill(per_param);
  }

  // ============================================================================
  // SENSITIVITY ANALYSIS
  // ============================================================================

  /**
   * Compute gradient sensitivity
   *
   * For clipped gradients, sensitivity is bounded by clipping_norm.
   *
   * @param gradient - Gradient vector
   * @param clipping_norm - Clipping norm used
   * @returns L2 sensitivity
   */
  compute_sensitivity(gradient: number[], clipping_norm: number): number {
    // After clipping, sensitivity is bounded by clipping_norm
    const norm = this.compute_gradient_norm(gradient);
    return Math.min(norm, clipping_norm);
  }

  /**
   * Estimate privacy cost for training
   *
   * Uses the privacy accountant approach.
   *
   * @param num_samples - Number of training samples
   * @param noise_multiplier - Noise multiplier used
   * @param epochs - Number of training epochs
   * @param batch_size - Batch size
   * @returns Estimated privacy cost
   */
  estimate_privacy_cost(
    num_samples: number,
    noise_multiplier: number,
    epochs: number,
    batch_size: number
  ): PrivacyCost {
    // Number of steps per epoch
    const steps_per_epoch = Math.ceil(num_samples / batch_size);
    const total_steps = epochs * steps_per_epoch;

    // Sample probability (q)
    const q = batch_size / num_samples;

    // Using simplified Gaussian mechanism analysis
    // For each step: epsilon_step ≈ q * sqrt(2 * log(1.25/delta)) / noise_multiplier
    // Total epsilon: sequential composition
    const delta = this.dp.get_delta();
    const epsilon_per_step =
      (q * Math.sqrt(2 * Math.log(1.25 / delta))) / noise_multiplier;

    const epsilon = epsilon_per_step * total_steps;

    return {
      epsilon,
      delta,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get clipping statistics
   */
  get_clipping_stats(): ClippingStats {
    return { ...this.clipping_stats };
  }

  /**
   * Reset clipping statistics
   */
  reset_clipping_stats(): void {
    this.clipping_stats = {
      num_clipped: 0,
      total: 0,
      avg_norm_before: 0,
      avg_norm_after: 0,
      clip_rate: 0,
    };
  }

  /**
   * Get configuration
   */
  get_config(): Required<PrivateGradientConfig> {
    return { ...this.config };
  }

  /**
   * Compute signal-to-noise ratio
   *
   * @param gradient - Gradient vector
   * @returns SNR estimate
   */
  compute_snr(gradient: number[]): number {
    const signal_norm = this.compute_gradient_norm(gradient);
    const noise_std = this.config.clipping_norm * this.config.noise_multiplier;
    return signal_norm / noise_std;
  }

  /**
   * Estimate gradient variance from noise
   *
   * @param dimension - Gradient dimension
   * @returns Expected variance
   */
  estimate_variance(dimension: number): number {
    const noise_std = this.config.clipping_norm * this.config.noise_multiplier;
    return noise_std * noise_std * dimension;
  }

  /**
   * Compute effective learning rate with noise
   *
   * @param base_learning_rate - Base learning rate
   * @param gradient_norm - Expected gradient norm
   * @returns Effective learning rate
   */
  compute_effective_learning_rate(
    base_learning_rate: number,
    gradient_norm: number
  ): number {
    // SNR = gradient_norm / noise_std
    const noise_std = this.config.clipping_norm * this.config.noise_multiplier;
    const snr = gradient_norm / noise_std;
    return base_learning_rate / (1 + 1 / snr);
  }
}
