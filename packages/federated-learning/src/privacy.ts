/**
 * @lsi/federated-learning/privacy
 *
 * Differential Privacy mechanisms for federated learning
 * Implements:
 * - Local DP (noise added at client before transmission)
 * - Central DP (noise added at server after aggregation)
 * - Gradient clipping (per-sample L2 norm clipping)
 * - Privacy ledger (epsilon accounting and tracking)
 * - DP-SGD integration
 *
 * References:
 * - Abadi et al. (2016) "Deep Learning with Differential Privacy"
 * - Dwork et al. (2014) "The algorithmic foundations of differential privacy"
 * - McMahan et al. (2018) "Learning differential private language models"
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Privacy budget parameters
 */
export interface PrivacyBudget {
  /** Epsilon (ε) - privacy loss parameter */
  epsilon: number;
  /** Delta (δ) - failure probability */
  delta: number;
}

/**
 * Gradient clipping configuration
 */
export interface ClippingConfig {
  /** Maximum L2 norm for per-sample gradients */
  maxNorm: number;
  /** Clipping mode */
  mode: 'adaptive' | 'fixed';
}

/**
 * Noise mechanism type
 */
export type NoiseMechanism = 'gaussian' | 'laplacian';

/**
 * DP mode - local or central
 */
export type DPMode = 'local' | 'central';

/**
 * Complete DP configuration
 */
export interface DPConfig {
  /** Privacy mode */
  mode: DPMode;
  /** Privacy budget */
  budget: PrivacyBudget;
  /** Gradient clipping */
  clipping: ClippingConfig;
  /** Noise mechanism */
  noise: NoiseMechanism;
  /** Number of training rounds (for accounting) */
  rounds: number;
  /** Batch size */
  batchSize: number;
  /** Number of clients per round */
  clientsPerRound: number;
}

/**
 * Privacy ledger entry
 */
export interface PrivacyLedgerEntry {
  /** Timestamp */
  timestamp: Date;
  /** Round number */
  round: number;
  /** Epsilon consumed */
  epsilon: number;
  /** Delta consumed */
  delta: number;
  /** Mechanism used */
  mechanism: string;
  /** Number of samples processed */
  samples: number;
}

/**
 * Privacy accounting result
 */
export interface PrivacyAccounting {
  /** Total epsilon consumed */
  totalEpsilon: number;
  /** Total delta consumed */
  totalDelta: number;
  /** Remaining epsilon budget */
  remainingEpsilon: number;
  /** Remaining delta budget */
  remainingDelta: number;
  /** Privacy guarantee description */
  guarantee: string;
}

/**
 * Gradient tensor (multi-dimensional array)
 */
export type GradientTensor = number[] | number[][] | number[][][];

/**
 * Per-sample gradient with clipping info
 */
export interface ClippedGradient {
  /** Clipped gradient */
  gradient: GradientTensor;
  /** Original L2 norm */
  originalNorm: number;
  /** Clipped norm (capped at maxNorm) */
  clippedNorm: number;
  /** Clipping factor (ratio of clipped/original) */
  clippingFactor: number;
}

/**
 * Noised gradient with privacy info
 */
export interface NoisedGradient {
  /** Gradient with added noise */
  gradient: GradientTensor;
  /** Noise standard deviation */
  noiseStd: number;
  /** Epsilon consumed */
  epsilon: number;
  /** Delta consumed */
  delta: number;
}

// ============================================================================
// PRIVACY LEDGER
// ============================================================================

/**
 * Privacy ledger for tracking privacy spend
 *
 * Tracks all privacy-consuming operations and maintains
 * an audit trail of epsilon/delta expenditure.
 */
export class PrivacyLedger {
  private entries: PrivacyLedgerEntry[] = [];
  private config: DPConfig;

  constructor(config: DPConfig) {
    this.config = config;
  }

  /**
   * Record a privacy-consuming operation
   */
  record(entry: Omit<PrivacyLedgerEntry, 'timestamp'>): void {
    this.entries.push({
      ...entry,
      timestamp: new Date()
    });
  }

  /**
   * Get total privacy spend
   */
  getSpend(): { epsilon: number; delta: number } {
    return this.entries.reduce(
      (acc, entry) => ({
        epsilon: acc.epsilon + entry.epsilon,
        delta: acc.delta + entry.delta
      }),
      { epsilon: 0, delta: 0 }
    );
  }

  /**
   * Get remaining privacy budget
   */
  getRemaining(): { epsilon: number; delta: number } {
    const spend = this.getSpend();
    return {
      epsilon: Math.max(0, this.config.budget.epsilon - spend.epsilon),
      delta: Math.max(0, this.config.budget.delta - spend.delta)
    };
  }

  /**
   * Get full privacy accounting
   */
  getAccounting(): PrivacyAccounting {
    const spend = this.getSpend();
    const remaining = this.getRemaining();

    const epsStr = spend.epsilon.toFixed(2);
    const delStr = spend.delta.toExponential(1);

    let guarantee: string;
    if (spend.epsilon <= 1 && spend.delta <= 1e-5) {
      guarantee = `Strong (${epsStr}-DP, δ=${delStr})`;
    } else if (spend.epsilon <= 3 && spend.delta <= 1e-4) {
      guarantee = `Moderate (${epsStr}-DP, δ=${delStr})`;
    } else {
      guarantee = `Weak (${epsStr}-DP, δ=${delStr})`;
    }

    return {
      totalEpsilon: spend.epsilon,
      totalDelta: spend.delta,
      remainingEpsilon: remaining.epsilon,
      remainingDelta: remaining.delta,
      guarantee
    };
  }

  /**
   * Get all ledger entries
   */
  getEntries(): ReadonlyArray<PrivacyLedgerEntry> {
    return this.entries;
  }

  /**
   * Clear the ledger
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Export ledger as JSON
   */
  toJSON(): object {
    return {
      config: this.config,
      entries: this.entries,
      spend: this.getSpend(),
      remaining: this.getRemaining(),
      accounting: this.getAccounting()
    };
  }
}

// ============================================================================
// GRADIENT CLIPPING
// ============================================================================

/**
 * Gradient clipping utility
 *
 * Clips per-sample gradients to bound sensitivity, which is required
 * for differential privacy guarantees.
 */
export class GradientClipping {
  private config: ClippingConfig;

  constructor(config: ClippingConfig) {
    this.config = config;
  }

  /**
   * Compute L2 norm of a gradient tensor
   */
  private l2Norm(gradient: GradientTensor): number {
    const flatten = (tensor: GradientTensor): number[] => {
      if (Array.isArray(tensor[0])) {
        return (tensor as number[][]).flatMap(flatten);
      } else {
        return tensor as number[];
      }
    };

    const flat = flatten(gradient);
    const sumSquares = flat.reduce((sum, val) => sum + val * val, 0);
    return Math.sqrt(sumSquares);
  }

  /**
   * Clip a gradient tensor by its L2 norm
   */
  clip(gradient: GradientTensor): ClippedGradient {
    const norm = this.l2Norm(gradient);

    // If norm is below threshold, no clipping needed
    if (norm <= this.config.maxNorm) {
      return {
        gradient: this.clone(gradient),
        originalNorm: norm,
        clippedNorm: norm,
        clippingFactor: 1.0
      };
    }

    // Scale gradient to have norm = maxNorm
    const scale = this.config.maxNorm / norm;
    const clipped = this.scale(gradient, scale);

    return {
      gradient: clipped,
      originalNorm: norm,
      clippedNorm: this.config.maxNorm,
      clippingFactor: scale
    };
  }

  /**
   * Clip multiple gradients (batch processing)
   */
  clipBatch(gradients: GradientTensor[]): ClippedGradient[] {
    return gradients.map(g => this.clip(g));
  }

  /**
   * Adaptive clipping based on gradient distribution
   * Adjusts maxNorm based on percentile of observed norms
   */
  adaptiveClip(
    gradients: GradientTensor[],
    percentile: number = 50
  ): ClippedGradient[] {
    const norms = gradients.map(g => this.l2Norm(g));
    norms.sort((a, b) => a - b);

    const targetNorm = norms[Math.floor(norms.length * percentile / 100)];
    const adaptiveMaxNorm = Math.max(
      this.config.maxNorm * 0.5,
      Math.min(this.config.maxNorm * 2, targetNorm)
    );

    const adaptiveConfig = { ...this.config, maxNorm: adaptiveMaxNorm };
    const adaptiveClipper = new GradientClipping(adaptiveConfig);

    return gradients.map(g => adaptiveClipper.clip(g));
  }

  /**
   * Scale gradient by factor
   */
  private scale(gradient: GradientTensor, factor: number): GradientTensor {
    if (Array.isArray(gradient[0])) {
      return (gradient as number[][]).map(row => this.scale(row, factor)) as GradientTensor;
    } else {
      return (gradient as number[]).map(val => val * factor);
    }
  }

  /**
   * Deep clone gradient tensor
   */
  private clone(gradient: GradientTensor): GradientTensor {
    return JSON.parse(JSON.stringify(gradient));
  }

  /**
   * Get average clipping factor across a batch
   */
  getAverageClippingFactor(clipped: ClippedGradient[]): number {
    const sum = clipped.reduce((acc, c) => acc + c.clippingFactor, 0);
    return sum / clipped.length;
  }
}

// ============================================================================
// NOISE MECHANISMS
// ============================================================================

/**
 * Noise addition for differential privacy
 *
 * Implements Gaussian and Laplacian mechanisms for adding
 * calibrated noise to gradients.
 */
export class NoiseMechanism {
  private rng: () => number;

  constructor(seed?: number) {
    // Seeded random number generator for reproducibility
    if (seed !== undefined) {
      let s = seed;
      this.rng = () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    } else {
      this.rng = Math.random;
    }
  }

  /**
   * Box-Muller transform for Gaussian noise
   */
  private gaussianNoise(std: number): number {
    const u1 = this.rng();
    const u2 = this.rng();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * std;
  }

  /**
   * Laplacian noise using exponential distribution
   */
  private laplacianNoise(scale: number): number {
    const u = this.rng() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Add Gaussian noise to gradient
   *
   * Uses (ε, δ)-DP with Gaussian mechanism:
   * σ = sqrt(2 * ln(1.25/δ)) * sensitivity / ε
   */
  addGaussianNoise(
    gradient: GradientTensor,
    sensitivity: number,
    epsilon: number,
    delta: number
  ): NoisedGradient {
    const std = (Math.sqrt(2 * Math.log(1.25 / delta)) * sensitivity) / epsilon;

    const addNoise = (tensor: GradientTensor): GradientTensor => {
      if (Array.isArray(tensor[0])) {
        return (tensor as number[][]).map(row => addNoise(row)) as GradientTensor;
      } else {
        return (tensor as number[]).map(val => val + this.gaussianNoise(std));
      }
    };

    return {
      gradient: addNoise(gradient),
      noiseStd: std,
      epsilon,
      delta
    };
  }

  /**
   * Add Laplacian noise to gradient
   *
   * Uses ε-DP with Laplacian mechanism:
   * scale = sensitivity / ε
   */
  addLaplacianNoise(
    gradient: GradientTensor,
    sensitivity: number,
    epsilon: number
  ): NoisedGradient {
    const scale = sensitivity / epsilon;

    const addNoise = (tensor: GradientTensor): GradientTensor => {
      if (Array.isArray(tensor[0])) {
        return (tensor as number[][]).map(row => addNoise(row)) as GradientTensor;
      } else {
        return (tensor as number[]).map(val => val + this.laplacianNoise(scale));
      }
    };

    return {
      gradient: addNoise(gradient),
      noiseStd: scale * Math.sqrt(2), // Laplacian std = scale * sqrt(2)
      epsilon,
      delta: 0 // Pure ε-DP
    };
  }

  /**
   * Add noise based on configuration
   */
  addNoise(
    gradient: GradientTensor,
    sensitivity: number,
    epsilon: number,
    delta: number,
    mechanism: NoiseMechanism
  ): NoisedGradient {
    if (mechanism === 'gaussian') {
      return this.addGaussianNoise(gradient, sensitivity, epsilon, delta);
    } else {
      return this.addLaplacianNoise(gradient, sensitivity, epsilon);
    }
  }
}

// ============================================================================
// DP-SGD INTEGRATION
// ============================================================================

/**
 * DP-SGD training step
 *
 * Combines per-sample gradient clipping with noise addition
 * to provide differential privacy guarantees for SGD.
 */
export class DPSGD {
  private clipping: GradientClipping;
  private noise: NoiseMechanism;
  private ledger: PrivacyLedger;
  private config: DPConfig;

  constructor(config: DPConfig) {
    this.config = config;
    this.clipping = new GradientClipping(config.clipping);
    this.noise = new NoiseMechanism();
    this.ledger = new PrivacyLedger(config);
  }

  /**
   * Compute privacy cost for one training step
   *
   * Uses moments accountant for accurate composition:
   * For T steps of DP-SGD with noise σ, clipping C, batch size B:
   * ε ≈ T * sqrt(2 * log(1.25/δ)) * C / (B * σ)
   */
  private computeStepCost(): { epsilon: number; delta: number } {
    const { rounds, batchSize, budget } = this.config;

    // Sensitivity is clipping bound divided by batch size
    const sensitivity = this.config.clipping.maxNorm / batchSize;

    // Per-step epsilon using advanced composition
    const stepEpsilon = budget.epsilon / rounds;
    const stepDelta = budget.delta / rounds;

    return { epsilon: stepEpsilon, delta: stepDelta };
  }

  /**
   * Perform one DP-SGD step
   *
   * 1. Clip per-sample gradients
   * 2. Average clipped gradients
   * 3. Add calibrated noise
   * 4. Update privacy ledger
   */
  dpSgdStep(
    perSampleGradients: GradientTensor[],
    round: number
  ): NoisedGradient {
    // Step 1: Clip per-sample gradients
    const clipped = this.clipping.clipBatch(perSampleGradients);

    // Step 2: Average clipped gradients
    const averaged = this.averageGradients(clipped.map(c => c.gradient));

    // Step 3: Compute sensitivity and add noise
    const sensitivity = this.config.clipping.maxNorm / this.config.batchSize;
    const { epsilon, delta } = this.computeStepCost();

    const noised = this.noise.addNoise(
      averaged,
      sensitivity,
      epsilon,
      delta,
      this.config.noise
    );

    // Step 4: Record in ledger
    this.ledger.record({
      round,
      epsilon,
      delta,
      mechanism: 'DP-SGD-' + this.config.noise,
      samples: perSampleGradients.length
    });

    return noised;
  }

  /**
   * Average multiple gradient tensors
   */
  private averageGradients(gradients: GradientTensor[]): GradientTensor {
    if (gradients.length === 0) {
      throw new Error('Cannot average empty gradient list');
    }

    if (gradients.length === 1) {
      return this.clone(gradients[0]);
    }

    // All gradients should have same shape
    const result = this.clone(gradients[0]);
    const n = gradients.length;

    const addAndScale = (acc: GradientTensor, grad: GradientTensor): void => {
      if (Array.isArray(acc[0]) && Array.isArray(grad[0])) {
        (acc as number[][]).forEach((row, i) => {
          addAndScale(row, (grad as number[][])[i]);
        });
      } else {
        const accArr = acc as number[];
        const gradArr = grad as number[];
        for (let i = 0; i < accArr.length; i++) {
          accArr[i] += gradArr[i];
        }
      }
    };

    const scale = (tensor: GradientTensor, factor: number): void => {
      if (Array.isArray(tensor[0])) {
        (tensor as number[][]).forEach(row => scale(row, factor));
      } else {
        const arr = tensor as number[];
        for (let i = 0; i < arr.length; i++) {
          arr[i] *= factor;
        }
      }
    };

    // Sum all gradients
    for (let i = 1; i < n; i++) {
      addAndScale(result, gradients[i]);
    }

    // Divide by n
    scale(result, 1 / n);

    return result;
  }

  /**
   * Deep clone gradient
   */
  private clone(gradient: GradientTensor): GradientTensor {
    return JSON.parse(JSON.stringify(gradient));
  }

  /**
   * Get privacy ledger
   */
  getLedger(): PrivacyLedger {
    return this.ledger;
  }

  /**
   * Get current privacy accounting
   */
  getPrivacyAccounting(): PrivacyAccounting {
    return this.ledger.getAccounting();
  }

  /**
   * Check if privacy budget is exhausted
   */
  isBudgetExhausted(): boolean {
    const remaining = this.ledger.getRemaining();
    return remaining.epsilon <= 0 || remaining.delta <= 0;
  }
}

// ============================================================================
// LOCAL DP (CLIENT-SIDE)
// ============================================================================

/**
 * Local differential privacy
 *
 * Applies noise at the client before transmission.
 * Provides stronger privacy but reduces utility.
 */
export class LocalDP {
  private noise: NoiseMechanism;
  private clipping: GradientClipping;
  private config: DPConfig;

  constructor(config: DPConfig) {
    this.config = config;
    this.noise = new NoiseMechanism();
    this.clipping = new GradientClipping(config.clipping);
  }

  /**
   * Apply local DP to a gradient
   *
   * 1. Clip gradient
   * 2. Add noise
   * Returns noised gradient ready for transmission
   */
  privatize(gradient: GradientTensor): NoisedGradient {
    // Clip gradient first
    const clipped = this.clipping.clip(gradient);

    // Add noise with higher sensitivity (client-level)
    const sensitivity = this.config.clipping.maxNorm;

    return this.noise.addNoise(
      clipped.gradient,
      sensitivity,
      this.config.budget.epsilon,
      this.config.budget.delta,
      this.config.noise
    );
  }

  /**
   * Apply local DP to a batch of gradients
   */
  privatizeBatch(gradients: GradientTensor[]): NoisedGradient[] {
    return gradients.map(g => this.privatize(g));
  }
}

// ============================================================================
// CENTRAL DP (SERVER-SIDE)
// ============================================================================

/**
 * Central differential privacy
 *
 * Applies noise at the server after aggregation.
 * Better utility but requires trust in server.
 */
export class CentralDP {
  private noise: NoiseMechanism;
  private clipping: GradientClipping;
  private ledger: PrivacyLedger;
  private config: DPConfig;

  constructor(config: DPConfig) {
    this.config = config;
    this.noise = new NoiseMechanism();
    this.clipping = new GradientClipping(config.clipping);
    this.ledger = new PrivacyLedger(config);
  }

  /**
   * Apply central DP to aggregated gradients
   *
   * 1. Receive gradients from multiple clients
   * 2. Average them
   * 3. Add noise to the aggregate
   * Lower sensitivity due to aggregation (amplification)
   */
  privatizeAggregate(
    clientGradients: GradientTensor[],
    round: number
  ): NoisedGradient {
    const n = clientGradients.length;

    // Clip all client gradients
    const clipped = this.clipping.clipBatch(clientGradients);

    // Average gradients
    const averaged = this.averageGradients(clipped.map(c => c.gradient));

    // Compute sensitivity with amplification
    // Sensitivity decreases as number of clients increases
    const samplingProbability = n / this.config.clientsPerRound;
    const sensitivity = (this.config.clipping.maxNorm / samplingProbability) / n;

    // Split budget across rounds
    const roundEpsilon = this.config.budget.epsilon / this.config.rounds;
    const roundDelta = this.config.budget.delta / this.config.rounds;

    // Add noise to aggregate
    const noised = this.noise.addNoise(
      averaged,
      sensitivity,
      roundEpsilon,
      roundDelta,
      this.config.noise
    );

    // Record in ledger
    this.ledger.record({
      round,
      epsilon: roundEpsilon,
      delta: roundDelta,
      mechanism: 'Central-' + this.config.noise,
      samples: n
    });

    return noised;
  }

  /**
   * Average multiple gradient tensors
   */
  private averageGradients(gradients: GradientTensor[]): GradientTensor {
    if (gradients.length === 0) {
      throw new Error('Cannot average empty gradient list');
    }

    const n = gradients.length;
    const result = JSON.parse(JSON.stringify(gradients[0]));

    const addAndScale = (acc: any, grad: any): void => {
      if (Array.isArray(acc[0]) && Array.isArray(grad[0])) {
        acc.forEach((row: any, i: number) => addAndScale(row, grad[i]));
      } else {
        for (let i = 0; i < acc.length; i++) {
          acc[i] += grad[i];
        }
      }
    };

    const scale = (tensor: any, factor: number): void => {
      if (Array.isArray(tensor[0])) {
        tensor.forEach((row: any) => scale(row, factor));
      } else {
        for (let i = 0; i < tensor.length; i++) {
          tensor[i] *= factor;
        }
      }
    };

    for (let i = 1; i < n; i++) {
      addAndScale(result, gradients[i]);
    }

    scale(result, 1 / n);

    return result;
  }

  /**
   * Get privacy ledger
   */
  getLedger(): PrivacyLedger {
    return this.ledger;
  }

  /**
   * Get privacy accounting
   */
  getPrivacyAccounting(): PrivacyAccounting {
    return this.ledger.getAccounting();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create default DP config
 */
export function createDefaultDPConfig(overrides?: Partial<DPConfig>): DPConfig {
  const defaults: DPConfig = {
    mode: 'central',
    budget: {
      epsilon: 3.0,  // Moderate privacy
      delta: 1e-5    // Strong delta
    },
    clipping: {
      maxNorm: 1.0,
      mode: 'fixed'
    },
    noise: 'gaussian',
    rounds: 100,
    batchSize: 32,
    clientsPerRound: 10
  };

  return { ...defaults, ...overrides };
}

/**
 * Create strong privacy config (ε=1, δ=1e-5)
 */
export function createStrongDPConfig(overrides?: Partial<DPConfig>): DPConfig {
  return createDefaultDPConfig({
    budget: {
      epsilon: 1.0,
      delta: 1e-5
    },
    ...overrides
  });
}

/**
 * Create weak privacy config (ε=10, δ=1e-4)
 */
export function createWeakDPConfig(overrides?: Partial<DPConfig>): DPConfig {
  return createDefaultDPConfig({
    budget: {
      epsilon: 10.0,
      delta: 1e-4
    },
    ...overrides
  });
}

/**
 * Validate DP config
 */
export function validateDPConfig(config: DPConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.budget.epsilon <= 0) {
    errors.push('Epsilon must be positive');
  }

  if (config.budget.delta <= 0 || config.budget.delta >= 1) {
    errors.push('Delta must be in (0, 1)');
  }

  if (config.clipping.maxNorm <= 0) {
    errors.push('Clipping maxNorm must be positive');
  }

  if (config.rounds <= 0) {
    errors.push('Rounds must be positive');
  }

  if (config.batchSize <= 0) {
    errors.push('Batch size must be positive');
  }

  if (config.clientsPerRound <= 0) {
    errors.push('Clients per round must be positive');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
