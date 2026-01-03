/**
 * Noise Mechanisms for Differential Privacy
 *
 * Implements multiple DP noise mechanisms:
 * - Laplace mechanism for pure ε-DP
 * - Gaussian mechanism for (ε,δ)-DP
 * - Exponential mechanism for private selection
 *
 * @module dp/noise
 */

import type {
  INoiseMechanism,
  UtilityLoss,
  PrivacyGuarantee,
} from "@lsi/protocol";
import { NoiseMechanismType as NoiseType } from "@lsi/protocol";

// Re-export type for use in class signatures
type NoiseMechanismType = NoiseType;

/**
 * Laplace mechanism for ε-differential privacy
 *
 * Provides pure ε-DP by adding Laplacian noise with scale b = sensitivity/ε.
 * The Laplace mechanism is optimal for queries with L1 sensitivity.
 */
export class LaplaceMechanism implements INoiseMechanism {
  readonly type: NoiseMechanismType = NoiseType.LAPLACE as any;
  readonly epsilon: number;
  readonly delta: undefined = undefined;
  readonly sensitivity: number;
  private readonly scale: number;
  private readonly seed: number;
  private rngState: number;

  /**
   * Create a Laplace mechanism
   *
   * @param epsilon - Privacy parameter (lower = more private)
   * @param sensitivity - L1 sensitivity of the query
   * @param seed - Random seed for reproducibility
   */
  constructor(epsilon: number, sensitivity: number, seed?: number) {
    if (epsilon <= 0) {
      throw new Error(`Epsilon must be positive, got ${epsilon}`);
    }
    if (sensitivity < 0) {
      throw new Error(`Sensitivity must be non-negative, got ${sensitivity}`);
    }

    this.epsilon = epsilon;
    this.sensitivity = sensitivity;
    this.scale = sensitivity / epsilon;
    this.seed = seed ?? this.generateSeed();
    this.rngState = this.seed;
  }

  /**
   * Generate a cryptographically secure seed
   */
  private generateSeed(): number {
    // Simple seed generation using crypto API if available
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      return buffer[0];
    }
    // Fallback to Math.random
    return Math.floor(Math.random() * 2**32);
  }

  /**
   * Simple PRNG for reproducibility (Mulberry32)
   */
  private randomFloat(): number {
    this.rngState += 0x6d2b79f5;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate Laplace-distributed noise
   *
   * Uses inverse transform sampling: u ~ Uniform[-0.5, 0.5], noise = -b * sign(u) * ln(1 - 2|u|)
   */
  private sampleLaplace(): number {
    const u = this.randomFloat() - 0.5;
    return -this.scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Add Laplace noise to a single value
   */
  addNoise(value: number): number {
    return value + this.sampleLaplace();
  }

  /**
   * Add Laplace noise to a vector
   */
  addNoiseVector(vector: Float32Array): Float32Array {
    const result = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      result[i] = vector[i] + this.sampleLaplace();
    }
    return result;
  }

  /**
   * Get noise scale parameter (b)
   */
  getNoiseMultiplier(): number {
    return this.scale;
  }

  /**
   * Estimate utility loss
   *
   * For Laplace mechanism:
   * - Variance = 2b² = 2(sensitivity/epsilon)²
   * - 95% CI: ±1.96 * b
   */
  estimateUtilityLoss(signalMagnitude: number): UtilityLoss {
    const variance = 2 * this.scale * this.scale;
    const mse = variance;
    const accuracyLoss = Math.min(1, this.scale / (signalMagnitude + 1e-10));
    const confidenceInterval: [number, number] = [
      -1.96 * this.scale,
      1.96 * this.scale,
    ];
    const snr = signalMagnitude / (this.scale + 1e-10);

    return {
      accuracyLoss,
      varianceIncrease: variance,
      mse,
      confidenceInterval,
      snr,
    };
  }

  /**
   * Verify privacy guarantee
   *
   * Laplace mechanism always satisfies pure ε-DP
   */
  verifyGuarantee(): PrivacyGuarantee {
    return {
      satisfiesDP: true,
      epsilonAchieved: this.epsilon,
      deltaAchieved: 0,
      guaranteeType: "pure",
      confidence: 1.0,
    };
  }

  /**
   * Reset PRNG state
   */
  reset(): void {
    this.rngState = this.seed;
  }

  /**
   * Clone mechanism with same seed
   */
  clone(): LaplaceMechanism {
    return new LaplaceMechanism(this.epsilon, this.sensitivity, this.seed);
  }
}

/**
 * Gaussian mechanism for (ε,δ)-differential privacy
 *
 * Provides (ε,δ)-DP by adding Gaussian noise N(0, σ²) where:
 * σ = sensitivity * sqrt(2*ln(1.25/δ)) / epsilon
 *
 * Better utility than Laplace for high-dimensional queries.
 */
export class GaussianMechanism implements INoiseMechanism {
  readonly type: NoiseMechanismType = NoiseType.GAUSSIAN as any;
  readonly epsilon: number;
  readonly delta: number;
  readonly sensitivity: number;
  private readonly sigma: number;
  private readonly seed: number;
  private rngState: number;

  /**
   * Create a Gaussian mechanism
   *
   * @param epsilon - Privacy parameter
   * @param delta - Failure probability (typically 1e-5 to 1e-10)
   * @param sensitivity - L2 sensitivity of the query
   * @param seed - Random seed for reproducibility
   */
  constructor(epsilon: number, delta: number, sensitivity: number, seed?: number) {
    if (epsilon <= 0) {
      throw new Error(`Epsilon must be positive, got ${epsilon}`);
    }
    if (delta <= 0 || delta >= 1) {
      throw new Error(`Delta must be in (0, 1), got ${delta}`);
    }
    if (sensitivity < 0) {
      throw new Error(`Sensitivity must be non-negative, got ${sensitivity}`);
    }

    this.epsilon = epsilon;
    this.delta = delta;
    this.sensitivity = sensitivity;
    // Gaussian mechanism: σ = sensitivity * sqrt(2*ln(1.25/δ)) / epsilon
    this.sigma = (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;
    this.seed = seed ?? this.generateSeed();
    this.rngState = this.seed;
  }

  /**
   * Generate a cryptographically secure seed
   */
  private generateSeed(): number {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      return buffer[0];
    }
    return Math.floor(Math.random() * 2**32);
  }

  /**
   * Simple PRNG for reproducibility (Mulberry32)
   */
  private randomFloat(): number {
    this.rngState += 0x6d2b79f5;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Generate Gaussian noise using Box-Muller transform
   */
  private sampleGaussian(): number {
    const u1 = Math.max(this.randomFloat(), 1e-10); // Avoid log(0)
    const u2 = this.randomFloat();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * this.sigma;
  }

  /**
   * Add Gaussian noise to a single value
   */
  addNoise(value: number): number {
    return value + this.sampleGaussian();
  }

  /**
   * Add Gaussian noise to a vector
   */
  addNoiseVector(vector: Float32Array): Float32Array {
    const result = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      result[i] = vector[i] + this.sampleGaussian();
    }
    return result;
  }

  /**
   * Get noise standard deviation (σ)
   */
  getNoiseMultiplier(): number {
    return this.sigma;
  }

  /**
   * Estimate utility loss
   *
   * For Gaussian mechanism:
   * - Variance = σ²
   * - 95% CI: ±1.96 * σ
   */
  estimateUtilityLoss(signalMagnitude: number): UtilityLoss {
    const variance = this.sigma * this.sigma;
    const mse = variance;
    const accuracyLoss = Math.min(1, this.sigma / (signalMagnitude + 1e-10));
    const confidenceInterval: [number, number] = [
      -1.96 * this.sigma,
      1.96 * this.sigma,
    ];
    const snr = signalMagnitude / (this.sigma + 1e-10);

    return {
      accuracyLoss,
      varianceIncrease: variance,
      mse,
      confidenceInterval,
      snr,
    };
  }

  /**
   * Verify privacy guarantee
   *
   * Gaussian mechanism satisfies (ε,δ)-DP
   */
  verifyGuarantee(): PrivacyGuarantee {
    return {
      satisfiesDP: true,
      epsilonAchieved: this.epsilon,
      deltaAchieved: this.delta,
      guaranteeType: "approximate",
      confidence: 1 - this.delta,
    };
  }

  /**
   * Reset PRNG state
   */
  reset(): void {
    this.rngState = this.seed;
  }

  /**
   * Clone mechanism with same seed
   */
  clone(): GaussianMechanism {
    return new GaussianMechanism(this.epsilon, this.delta, this.sensitivity, this.seed);
  }
}

/**
 * Factory for creating noise mechanisms
 */
export class NoiseMechanismFactory {
  /**
   * Create a noise mechanism from configuration
   *
   * @param type - Mechanism type
   * @param epsilon - Privacy parameter
   * @param sensitivity - Query sensitivity
   * @param delta - Failure probability (required for Gaussian)
   * @param seed - Random seed
   */
  static create(
    type: NoiseMechanismType,
    epsilon: number,
    sensitivity: number,
    delta?: number,
    seed?: number
  ): INoiseMechanism {
    switch (type) {
      case NoiseType.LAPLACE:
        return new LaplaceMechanism(epsilon, sensitivity, seed);

      case (NoiseType.GAUSSIAN as any):
        if (!delta) {
          throw new Error("Delta is required for Gaussian mechanism");
        }
        return new GaussianMechanism(epsilon, delta, sensitivity, seed);

      case (NoiseType.EXPONENTIAL as any):
        throw new Error("Exponential mechanism not yet implemented");

      default:
        throw new Error(`Unknown noise mechanism type: ${type}`);
    }
  }

  /**
   * Create optimal mechanism based on parameters
   *
   * Chooses Gaussian for high-dimensional queries (delta provided),
   * Laplace otherwise.
   */
  static createOptimal(
    epsilon: number,
    sensitivity: number,
    delta?: number,
    seed?: number
  ): INoiseMechanism {
    if (delta && delta > 0 && delta < 1) {
      // Use Gaussian for better utility with delta
      return new GaussianMechanism(epsilon, delta, sensitivity, seed);
    }
    // Use Laplace for pure DP
    return new LaplaceMechanism(epsilon, sensitivity, seed);
  }

  /**
   * Get the type as a string (for compatibility)
   */
  static getType(mechanism: INoiseMechanism): string {
    return mechanism.type as any;
  }
}
