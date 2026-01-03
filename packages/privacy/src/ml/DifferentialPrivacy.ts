/**
 * @file Differential Privacy Mechanisms
 *
 * Implements differential privacy mechanisms for machine learning training.
 * Provides noise addition, privacy budget tracking, and composition theorems.
 *
 * Key Concepts:
 * - ε-differential privacy: Pure DP using Laplace mechanism
 * - (ε, δ)-differential privacy: Approximate DP using Gaussian mechanism
 * - Privacy budget: Track ε, δ expenditure across computations
 * - Composition: Sequential, parallel, and advanced composition
 *
 * @module privacy/ml
 */

import { randomBytes } from "crypto";

/**
 * Privacy budget tracking
 */
export interface PrivacyBudget {
  /** Remaining epsilon budget */
  epsilon_remaining: number;
  /** Remaining delta budget */
  delta_remaining: number;
  /** Epsilon spent so far */
  epsilon_spent: number;
  /** Delta spent so far */
  delta_spent: number;
}

/**
 * Cost of a privacy operation
 */
export interface PrivacyCost {
  /** Epsilon consumed */
  epsilon: number;
  /** Delta consumed */
  delta: number;
}

/**
 * Utility loss estimation
 */
export interface UtilityLoss {
  /** Expected accuracy loss (0-1) */
  accuracy_loss: number;
  /** Expected variance increase */
  variance_increase: number;
  /** Confidence interval */
  confidence_interval: [number, number];
}

/**
 * Recommendation for privacy parameters
 */
export interface Recommendation {
  /** Suggested epsilon value */
  epsilon: number;
  /** Expected accuracy */
  accuracy: number;
  /** Privacy risk */
  privacy_risk: "low" | "medium" | "high";
  /** Reasoning */
  reasoning: string;
}

/**
 * Configuration for differential privacy
 */
export interface DifferentialPrivacyConfig {
  /** Total epsilon budget */
  epsilon: number;
  /** Total delta budget */
  delta: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Warn when budget exhausted */
  warnOnExhaustion?: boolean;
  /** Throw error when budget exhausted */
  throwOnExhaustion?: boolean;
}

/**
 * Differential privacy mechanisms
 *
 * Implements:
 * - Laplace mechanism for ε-DP
 * - Gaussian mechanism for (ε, δ)-DP
 * - Privacy budget tracking
 * - Composition theorems
 * - Utility analysis
 */
export class DifferentialPrivacy {
  private readonly config: Required<DifferentialPrivacyConfig>;
  private readonly initial_epsilon: number;
  private readonly initial_delta: number;
  private readonly seed: number;
  private rng_seed: number;

  /**
   * Create a differential privacy instance
   *
   * @param config - Privacy configuration
   */
  constructor(config: DifferentialPrivacyConfig) {
    if (config.epsilon <= 0) {
      throw new Error("Epsilon must be positive");
    }
    if (config.delta < 0 || config.delta >= 1) {
      throw new Error("Delta must be in [0, 1)");
    }

    this.initial_epsilon = config.epsilon;
    this.initial_delta = config.delta;
    this.seed = config.seed ?? this.generateSeed();
    this.rng_seed = this.seed;

    this.config = {
      epsilon: config.epsilon,
      delta: config.delta,
      seed: this.seed,
      warnOnExhaustion: config.warnOnExhaustion ?? true,
      throwOnExhaustion: config.throwOnExhaustion ?? false,
    };
  }

  /**
   * Generate a cryptographically secure random seed
   */
  private generateSeed(): number {
    const buffer = randomBytes(4);
    return buffer.readUInt32BE(0);
  }

  /**
   * Generate a random float in [0, 1) using a simple PRNG
   * Uses Mulberry32 for reproducibility with seed
   */
  private randomFloat(): number {
    this.rng_seed += 0x6d2b79f5;
    let t = this.rng_seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate a random float from a standard normal distribution
   * Uses Box-Muller transform
   */
  private randomNormal(): number {
    const u1 = this.randomFloat();
    const u2 = this.randomFloat();
    while (u1 === 0) {
      // Avoid log(0)
    }
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  /**
   * Generate a random float from a Laplace distribution
   *
   * @param scale - Scale parameter (b = sensitivity/epsilon)
   */
  private randomLaplace(scale: number): number {
    const u = this.randomFloat() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  // ============================================================================
  // PRIVACY BUDGET MANAGEMENT
  // ============================================================================

  /**
   * Get current epsilon budget
   */
  get_epsilon(): number {
    return this.config.epsilon;
  }

  /**
   * Get current delta budget
   */
  get_delta(): number {
    return this.config.delta;
  }

  /**
   * Get remaining privacy budget
   */
  get_remaining_budget(): PrivacyBudget {
    return {
      epsilon_remaining: this.config.epsilon,
      delta_remaining: this.config.delta,
      epsilon_spent: this.initial_epsilon - this.config.epsilon,
      delta_spent: this.initial_delta - this.config.delta,
    };
  }

  /**
   * Spend privacy budget
   *
   * @param cost - Privacy cost to spend
   * @throws Error if insufficient budget and throwOnExhaustion is true
   */
  spend_budget(cost: PrivacyCost): void {
    const remaining_epsilon = this.config.epsilon - cost.epsilon;
    const remaining_delta = this.config.delta - cost.delta;

    if (remaining_epsilon < 0 || remaining_delta < 0) {
      if (this.config.warnOnExhaustion) {
        console.warn(
          `[DP] Insufficient privacy budget. ` +
            `Need (ε=${cost.epsilon}, δ=${cost.delta}), ` +
            `have (ε=${this.config.epsilon}, δ=${this.config.delta})`
        );
      }
      if (this.config.throwOnExhaustion) {
        throw new Error("Insufficient privacy budget");
      }
      // Clamp to zero
      this.config.epsilon = Math.max(0, this.config.epsilon);
      this.config.delta = Math.max(0, this.config.delta);
    } else {
      this.config.epsilon = remaining_epsilon;
      this.config.delta = remaining_delta;
    }
  }

  /**
   * Reset privacy budget to initial values
   */
  reset_budget(): void {
    this.config.epsilon = this.initial_epsilon;
    this.config.delta = this.initial_delta;
    this.rng_seed = this.seed;
  }

  // ============================================================================
  // LAPLACE MECHANISM (ε-DP)
  // ============================================================================

  /**
   * Add Laplace noise to a single value
   *
   * Provides ε-differential privacy for queries with bounded sensitivity.
   *
   * @param value - True value to privatize
   * @param sensitivity - L1 sensitivity of the query
   * @param epsilon - Privacy parameter (uses instance default if not specified)
   * @returns Noisy value
   */
  add_laplace_noise(
    value: number,
    sensitivity: number,
    epsilon?: number
  ): number {
    if (sensitivity < 0) {
      throw new Error("Sensitivity must be non-negative");
    }

    const eps = epsilon ?? this.initial_epsilon;
    if (eps <= 0) {
      throw new Error("Epsilon must be positive");
    }

    const scale = sensitivity / eps;
    const noise = this.randomLaplace(scale);
    return value + noise;
  }

  /**
   * Add Laplace noise to a vector
   *
   * @param vector - Vector of values to privatize
   * @param sensitivity - L1 sensitivity of the query
   * @param epsilon - Privacy parameter
   * @returns Noisy vector
   */
  add_laplace_noise_vector(
    vector: number[],
    sensitivity: number,
    epsilon?: number
  ): number[] {
    const eps = epsilon ?? this.initial_epsilon;
    return vector.map(v => this.add_laplace_noise(v, sensitivity, eps));
  }

  // ============================================================================
  // GAUSSIAN MECHANISM ((ε, δ)-DP)
  // ============================================================================

  /**
   * Add Gaussian noise to a single value
   *
   * Provides (ε, δ)-differential privacy for queries with bounded L2 sensitivity.
   *
   * @param value - True value to privatize
   * @param sensitivity - L2 sensitivity of the query
   * @param epsilon - Privacy parameter
   * @param delta - Failure probability
   * @returns Noisy value
   */
  add_gaussian_noise(
    value: number,
    sensitivity: number,
    epsilon?: number,
    delta?: number
  ): number {
    if (sensitivity < 0) {
      throw new Error("Sensitivity must be non-negative");
    }

    const eps = epsilon ?? this.initial_epsilon;
    const del = delta ?? this.initial_delta;

    if (eps <= 0) {
      throw new Error("Epsilon must be positive");
    }
    if (del <= 0 || del >= 1) {
      throw new Error("Delta must be in (0, 1)");
    }

    // Gaussian mechanism: σ = sensitivity * sqrt(2*ln(1.25/delta)) / epsilon
    const sigma = (sensitivity * Math.sqrt(2 * Math.log(1.25 / del))) / eps;
    const noise = this.randomNormal() * sigma;
    return value + noise;
  }

  /**
   * Add Gaussian noise to a vector
   *
   * @param vector - Vector of values to privatize
   * @param sensitivity - L2 sensitivity of the query
   * @param epsilon - Privacy parameter
   * @param delta - Failure probability
   * @returns Noisy vector
   */
  add_gaussian_noise_vector(
    vector: number[],
    sensitivity: number,
    epsilon?: number,
    delta?: number
  ): number[] {
    const eps = epsilon ?? this.initial_epsilon;
    const del = delta ?? this.initial_delta;
    return vector.map(v => this.add_gaussian_noise(v, sensitivity, eps, del));
  }

  // ============================================================================
  // ADVANCED MECHANISMS
  // ============================================================================

  /**
   * Add noise to a histogram
   *
   * Histograms have sensitivity 1 (changing one record changes one bin by 1).
   *
   * @param histogram - Histogram bin counts
   * @param sensitivity - L1 sensitivity (typically 1 for histograms)
   * @param epsilon - Privacy parameter
   * @returns Noisy histogram
   */
  add_noise_histogram(
    histogram: number[],
    sensitivity: number,
    epsilon?: number
  ): number[] {
    const eps = epsilon ?? this.initial_epsilon;
    const noisy = this.add_laplace_noise_vector(histogram, sensitivity, eps);

    // Ensure all bins are non-negative
    return noisy.map(v => Math.max(0, v));
  }

  /**
   * Add noise to a count query
   *
   * @param count - True count
   * @param sensitivity - L1 sensitivity (typically 1)
   * @param epsilon - Privacy parameter
   * @returns Noisy count (rounded to integer)
   */
  add_noise_count(
    count: number,
    sensitivity: number,
    epsilon?: number
  ): number {
    const eps = epsilon ?? this.initial_epsilon;
    const noisy = this.add_laplace_noise(count, sensitivity, eps);
    return Math.max(0, Math.round(noisy));
  }

  /**
   * Add noise to a sum query
   *
   * @param sum - True sum
   * @param sensitivity - L1 sensitivity (max value - min value)
   * @param epsilon - Privacy parameter
   * @returns Noisy sum
   */
  add_noise_sum(sum: number, sensitivity: number, epsilon?: number): number {
    const eps = epsilon ?? this.initial_epsilon;
    return this.add_laplace_noise(sum, sensitivity, eps);
  }

  /**
   * Add noise to an average query
   *
   * Uses the "noisy sum / noisy count" approach.
   *
   * @param average - True average
   * @param count - Number of elements
   * @param sensitivity - L1 sensitivity per element
   * @param epsilon - Privacy parameter (split between sum and count)
   * @returns Noisy average
   */
  add_noise_average(
    average: number,
    count: number,
    sensitivity: number,
    epsilon?: number
  ): number {
    const eps = epsilon ?? this.initial_epsilon;
    // Split budget between sum and count
    const eps_sum = eps / 2;
    const eps_count = eps / 2;

    const sum = average * count;
    const noisy_sum = this.add_laplace_noise(sum, sensitivity, eps_sum);
    const noisy_count = this.add_noise_count(count, 1, eps_count);
    return noisy_sum / noisy_count;
  }

  // ============================================================================
  // COMPOSITION THEOREMS
  // ============================================================================

  /**
   * Sequential composition
   *
   * When running multiple DP mechanisms on the same data sequentially,
   * the total epsilon is the sum of individual epsilons.
   *
   * @param epsilons - List of epsilon values for each mechanism
   * @returns Total epsilon
   */
  sequential_composition(epsilons: number[]): number {
    return epsilons.reduce((sum, eps) => sum + eps, 0);
  }

  /**
   * Parallel composition
   *
   * When running DP mechanisms on disjoint subsets of data,
   * the total epsilon is the maximum of individual epsilons.
   *
   * @param epsilons - List of epsilon values for each mechanism
   * @returns Total epsilon
   */
  parallel_composition(epsilons: number[]): number {
    return Math.max(...epsilons);
  }

  /**
   * Advanced composition theorem
   *
   * Better bound than sequential composition for k mechanisms.
   * Total epsilon = sqrt(2*k*ln(1/delta)) * eps + k*eps*(exp(eps)-1)
   *
   * @param epsilons - List of epsilon values (assumed equal)
   * @param delta - Failure probability
   * @returns Total epsilon
   */
  advanced_composition(epsilons: number[], delta: number): number {
    const k = epsilons.length;
    const eps = epsilons[0]; // Assume all epsilons are equal

    const term1 = Math.sqrt(2 * k * Math.log(1 / delta)) * eps;
    const term2 = k * eps * (Math.exp(eps) - 1);

    return term1 + term2;
  }

  // ============================================================================
  // UTILITY ANALYSIS
  // ============================================================================

  /**
   * Estimate utility loss from noise
   *
   * @param noise_level - Standard deviation of noise
   * @returns Estimated utility loss
   */
  estimate_utility_loss(noise_level: number): UtilityLoss {
    // Accuracy loss scales with signal-to-noise ratio
    // Assuming unit signal magnitude
    const accuracy_loss = Math.min(1, noise_level / 2);

    // Variance increase is noise_level^2
    const variance_increase = noise_level * noise_level;

    // 95% confidence interval
    const confidence_interval: [number, number] = [
      -1.96 * noise_level,
      1.96 * noise_level,
    ];

    return {
      accuracy_loss,
      variance_increase,
      confidence_interval,
    };
  }

  /**
   * Recommend epsilon for target accuracy
   *
   * @param target_accuracy - Desired accuracy (0-1)
   * @param sensitivity - Query sensitivity
   * @returns Recommended epsilon
   */
  recommend_epsilon_for_target_accuracy(
    target_accuracy: number,
    sensitivity: number
  ): number {
    if (target_accuracy < 0 || target_accuracy > 1) {
      throw new Error("Target accuracy must be in [0, 1]");
    }

    // Invert the utility loss estimation
    // accuracy_loss ≈ (sensitivity / epsilon) / 2
    // epsilon ≈ sensitivity / (2 * accuracy_loss)

    const accuracy_loss = 1 - target_accuracy;

    if (accuracy_loss === 0) {
      return Infinity; // Perfect accuracy requires infinite epsilon
    }

    return sensitivity / (2 * accuracy_loss);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Clone this instance with reset budget
   */
  clone(): DifferentialPrivacy {
    return new DifferentialPrivacy({
      epsilon: this.initial_epsilon,
      delta: this.initial_delta,
      seed: this.seed,
      warnOnExhaustion: this.config.warnOnExhaustion,
      throwOnExhaustion: this.config.throwOnExhaustion,
    });
  }

  /**
   * Get string representation
   */
  toString(): string {
    const budget = this.get_remaining_budget();
    return (
      `DifferentialPrivacy(ε=${this.initial_epsilon}, δ=${this.initial_delta}, ` +
      `ε_spent=${budget.epsilon_spent.toFixed(4)}, δ_spent=${budget.delta_spent.toFixed(6)})`
    );
  }

  /**
   * Convert to JSON
   */
  toJSON(): Record<string, unknown> {
    const budget = this.get_remaining_budget();
    return {
      initial_epsilon: this.initial_epsilon,
      initial_delta: this.initial_delta,
      epsilon_remaining: budget.epsilon_remaining,
      delta_remaining: budget.delta_remaining,
      epsilon_spent: budget.epsilon_spent,
      delta_spent: budget.delta_spent,
    };
  }
}

/**
 * Moments Accountant for tracking privacy loss
 *
 * Tracks privacy loss using the moments accountant method,
 * which provides tighter bounds for composed mechanisms.
 */
export class MomentsAccountant {
  private moments: Map<number, number>;

  constructor() {
    this.moments = new Map();
  }

  /**
   * Add privacy loss from a mechanism
   *
   * @param noise_multiplier - Ratio of noise to gradient clipping norm
   * @param sample_rate - Fraction of data used in each batch
   * @param steps - Number of training steps
   */
  add_step(noise_multiplier: number, sample_rate: number, steps: number): void {
    const lambda = 1 / (noise_multiplier * noise_multiplier);

    for (let i = 0; i < steps; i++) {
      const current = this.moments.get(lambda) ?? 0;
      this.moments.set(
        lambda,
        current + this.compute_moment(lambda, sample_rate)
      );
    }
  }

  /**
   * Compute moment for given lambda and sample rate
   */
  private compute_moment(lambda: number, sample_rate: number): number {
    // Approximate log moment of privacy loss
    const alpha = lambda + 1;
    const beta = (lambda * sample_rate * sample_rate) / 2;
    return Math.log(alpha) + beta;
  }

  /**
   * Get epsilon and delta for target delta
   *
   * @param target_delta - Target delta value
   * @returns Privacy parameters (epsilon, delta)
   */
  get_privacy_spent(target_delta: number): PrivacyCost {
    // Find epsilon such that delta <= target_delta
    // This is a simplified version - full implementation requires numeric optimization

    let min_epsilon = Infinity;

    for (const [lambda, moment] of this.moments) {
      const epsilon = moment / lambda;
      const delta = Math.exp(-lambda * (epsilon - 1));

      if (delta <= target_delta && epsilon < min_epsilon) {
        min_epsilon = epsilon;
      }
    }

    return {
      epsilon: min_epsilon === Infinity ? 0 : min_epsilon,
      delta: target_delta,
    };
  }

  /**
   * Reset the accountant
   */
  reset(): void {
    this.moments.clear();
  }
}

/**
 * Renyi Differential Privacy (RDP) Accountant
 *
 * Provides tight composition bounds using Renyi differential privacy.
 */
export class RDPAccountant {
  private alphas: number[];
  private moments: Map<number, number>;

  constructor(alphas: number[] = [2, 4, 8, 16, 32, 64, 128]) {
    this.alphas = alphas;
    this.moments = new Map();
    for (const alpha of alphas) {
      this.moments.set(alpha, 0);
    }
  }

  /**
   * Add privacy loss from a Gaussian mechanism
   *
   * @param noise_multiplier - Standard deviation of noise relative to sensitivity
   * @param sample_rate - Probability of sampling each data point
   * @param steps - Number of steps
   */
  add_step(noise_multiplier: number, sample_rate: number, steps: number): void {
    for (const alpha of this.alphas) {
      const moment = this.compute_rdp_gaussian(
        alpha,
        noise_multiplier,
        sample_rate
      );
      const current = this.moments.get(alpha) ?? 0;
      this.moments.set(alpha, current + steps * moment);
    }
  }

  /**
   * Compute RDP for Gaussian mechanism at order alpha
   */
  private compute_rdp_gaussian(
    alpha: number,
    noise_multiplier: number,
    sample_rate: number
  ): number {
    if (alpha === 1) {
      // Not defined for alpha = 1, use limit
      return Infinity;
    }

    const sigma_squared = noise_multiplier * noise_multiplier;

    // Simplified RDP computation for subsampled Gaussian
    const term1 = (sample_rate * sample_rate * alpha) / (2 * sigma_squared);
    const term2 =
      Math.log1p(sample_rate * (Math.exp(alpha / sigma_squared) - 1)) /
      (alpha - 1);

    return term1 + term2;
  }

  /**
   * Convert RDP to (epsilon, delta)-DP
   *
   * @param target_delta - Target delta value
   * @returns Privacy parameters
   */
  get_privacy_spent(target_delta: number): PrivacyCost {
    let min_epsilon = Infinity;

    for (const alpha of this.alphas) {
      if (alpha === 1) continue;

      const rdp = this.moments.get(alpha) ?? 0;
      const epsilon = rdp + Math.log1p(-target_delta) / (alpha - 1);

      if (epsilon < min_epsilon) {
        min_epsilon = epsilon;
      }
    }

    return {
      epsilon: min_epsilon === Infinity ? 0 : min_epsilon,
      delta: target_delta,
    };
  }

  /**
   * Reset the accountant
   */
  reset(): void {
    for (const alpha of this.alphas) {
      this.moments.set(alpha, 0);
    }
  }
}

/**
 * Zero-Concentrated Differential Privacy (zCDP) Accountant
 *
 * Tracks privacy loss using zCDP, which composes linearly.
 */
export class ZCDPAccountant {
  private rho: number;

  constructor() {
    this.rho = 0;
  }

  /**
   * Add privacy loss from a Gaussian mechanism
   *
   * @param noise_multiplier - Standard deviation of noise
   * @param sample_rate - Probability of sampling each data point
   * @param steps - Number of steps
   */
  add_step(noise_multiplier: number, sample_rate: number, steps: number): void {
    // zCDP for Gaussian: rho = sample_rate^2 / (2 * noise_multiplier^2)
    const rho_per_step =
      (sample_rate * sample_rate) / (2 * noise_multiplier * noise_multiplier);
    this.rho += steps * rho_per_step;
  }

  /**
   * Convert zCDP to (epsilon, delta)-DP
   *
   * For zCDP parameter rho:
   * epsilon = rho + sqrt(2 * rho * log(1/delta))
   *
   * @param target_delta - Target delta value
   * @returns Privacy parameters
   */
  get_privacy_spent(target_delta: number): PrivacyCost {
    if (this.rho === 0) {
      return { epsilon: 0, delta: 0 };
    }

    const epsilon =
      this.rho + Math.sqrt(2 * this.rho * Math.log(1 / target_delta));
    return { epsilon, delta: target_delta };
  }

  /**
   * Reset the accountant
   */
  reset(): void {
    this.rho = 0;
  }
}
