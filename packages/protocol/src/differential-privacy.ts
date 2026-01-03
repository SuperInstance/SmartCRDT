/**
 * Differential Privacy Protocol Types
 *
 * Comprehensive types for ε-differential privacy implementation including:
 * - Noise mechanisms (Laplace, Gaussian, Exponential)
 * - Privacy budget tracking with composition theorems
 * - Moments Accountant for DP-SGD
 * - RDP and zCDP accountants
 * - Utility loss estimation
 * - Privacy guarantee verification
 *
 * These types are used by @lsi/privacy's IntentEncoder and other
 * privacy-preserving components in the Aequor platform.
 *
 * @module differential-privacy
 */

// ============================================================================
// NOISE MECHANISM TYPES
// ============================================================================

/**
 * Noise mechanism types for differential privacy
 *
 * Different mechanisms provide different privacy-utility tradeoffs:
 * - Laplace: Pure ε-DP, simple, good for small datasets
 * - Gaussian: (ε,δ)-DP, better utility for high-dimensional data
 * - Exponential: Best for queries with discrete outputs
 */
export enum NoiseMechanismType {
  /** Laplace mechanism for ε-differential privacy */
  LAPLACE = "laplace",
  /** Gaussian mechanism for (ε,δ)-differential privacy */
  GAUSSIAN = "gaussian",
  /** Exponential mechanism for private selection */
  EXPONENTIAL = "exponential",
}

/**
 * Differential privacy mechanism parameters
 *
 * Configuration for a single DP mechanism application.
 * Defines the privacy budget consumed and noise distribution.
 */
export interface DPMechanism {
  /** Type of noise mechanism */
  type: NoiseMechanismType;
  /** Privacy parameter ε (lower = more private) */
  epsilon: number;
  /** Failure probability δ (for Gaussian) */
  delta?: number;
  /** Query sensitivity (L1 for Laplace, L2 for Gaussian) */
  sensitivity: number;
  /** Noise multiplier (computed from ε, δ, sensitivity) */
  noiseMultiplier?: number;
}

// ============================================================================
// PRIVACY BUDGET TRACKING
// ============================================================================

/**
 * Privacy budget state tracker
 *
 * Tracks privacy budget consumption across multiple operations
 * with support for composition theorems.
 */
export interface PrivacyBudget {
  /** Total ε budget allocated */
  totalEpsilon: number;
  /** Total δ budget allocated */
  totalDelta: number;
  /** ε spent so far */
  epsilonSpent: number;
  /** δ spent so far */
  deltaSpent: number;
  /** ε remaining */
  epsilonRemaining: number;
  /** δ remaining */
  deltaRemaining: number;
  /** Number of operations performed */
  operationCount: number;
  /** Last reset timestamp */
  lastReset: number;
  /** Whether budget is exhausted */
  isExhausted: boolean;
}

/**
 * Privacy cost of a single operation
 *
 * Records the privacy budget consumed by one mechanism application.
 */
export interface PrivacyCost {
  /** ε consumed */
  epsilon: number;
  /** δ consumed (0 for pure DP) */
  delta: number;
  /** Mechanism type */
  mechanism: NoiseMechanismType;
  /** Sensitivity used */
  sensitivity: number;
  /** Timestamp of operation */
  timestamp: number;
}

// ============================================================================
// COMPOSITION THEOREMS
// ============================================================================

/**
 * Composition theorem type
 *
 * Different composition theorems provide different bounds on
 * total privacy loss when composing multiple mechanisms.
 */
export enum CompositionType {
  /** Sequential composition: ε_total = Σ ε_i */
  SEQUENTIAL = "sequential",
  /** Parallel composition: ε_total = max ε_i */
  PARALLEL = "parallel",
  /** Advanced composition: tighter bound for adaptive composition */
  ADVANCED = "advanced",
  /** Moments Accountant: optimal for SGD/DP training */
  MOMENTS = "moments",
  /** RDP: Renyi Differential Privacy for tight Gaussian composition */
  RDP = "rdp",
  /** zCDP: Zero-Concentrated DP, composes linearly */
  ZCDP = "zcdp",
}

/**
 * Composition result
 *
 * Result of composing multiple privacy mechanisms using
 * a specific composition theorem.
 */
export interface CompositionResult {
  /** Total ε composed */
  totalEpsilon: number;
  /** Total δ composed */
  totalDelta: number;
  /** Composition type used */
  compositionType: CompositionType;
  /** Number of mechanisms composed */
  mechanismCount: number;
  /** Individual costs composed */
  costs: PrivacyCost[];
}

// ============================================================================
// ADVANCED ACCOUNTING
// ============================================================================

/**
 * Moments Accountant state
 *
 * Tracks log moments of privacy loss random variable for
 * tight composition bounds in DP-SGD.
 */
export interface MomentsAccountantState {
  /** Log moments per order λ */
  moments: Map<number, number>;
  /** Number of steps tracked */
  stepCount: number;
  /** Noise multiplier used */
  noiseMultiplier: number;
  /** Sample rate used */
  sampleRate: number;
}

/**
 * RDP (Renyi Differential Privacy) state
 *
 * Tracks RDP privacy loss at multiple orders α for
 * optimal Gaussian composition.
 */
export interface RDPState {
  /** Orders α to track */
  alphas: number[];
  /** RDP values at each order */
  rdpValues: Map<number, number>;
  /** Number of steps */
  stepCount: number;
}

/**
 * zCDP (Zero-Concentrated DP) state
 *
 * Tracks zCDP parameter ρ which composes linearly.
 */
export interface ZCDPState {
  /** zCDP parameter ρ */
  rho: number;
  /** Number of steps */
  stepCount: number;
}

// ============================================================================
// UTILITY ANALYSIS
// ============================================================================

/**
 * Utility loss estimation
 *
 * Measures the expected impact of DP noise on utility.
 */
export interface UtilityLoss {
  /** Expected accuracy loss (0-1) */
  accuracyLoss: number;
  /** Expected variance increase */
  varianceIncrease: number;
  /** Mean squared error */
  mse: number;
  /** 95% confidence interval around true value */
  confidenceInterval: [number, number];
  /** Signal-to-noise ratio */
  snr: number;
}

// ============================================================================
// PRIVACY GUARANTEES
// ============================================================================

/**
 * Privacy guarantee verification
 *
 * Formal verification that privacy guarantees hold.
 */
export interface PrivacyGuarantee {
  /** Whether ε-DP is satisfied */
  satisfiesDP: boolean;
  /** Actual ε achieved */
  epsilonAchieved: number;
  /** Actual δ achieved (0 for pure DP) */
  deltaAchieved: number;
  /** Privacy guarantee type */
  guaranteeType: "pure" | "approximate";
  /** Verification confidence (0-1) */
  confidence: number;
}

// ============================================================================
// CONFIGURATION AND ACCOUNTING
// ============================================================================

/**
 * Differential privacy configuration
 *
 * Comprehensive configuration for DP mechanisms with
 * budget tracking and composition support.
 */
export interface DifferentialPrivacyConfig {
  /** Total ε budget */
  epsilon: number;
  /** Total δ budget */
  delta: number;
  /** Composition type to use */
  compositionType?: CompositionType;
  /** Mechanism type to use */
  mechanismType?: NoiseMechanismType;
  /** Random seed for reproducibility */
  seed?: number;
  /** Warn when budget exhausted */
  warnOnExhaustion?: boolean;
  /** Throw error when budget exhausted */
  throwOnExhaustion?: boolean;
  /** Track privacy loss history */
  trackHistory?: boolean;
  /** Maximum history length */
  maxHistoryLength?: number;
}

/**
 * Privacy accounting result
 *
 * Complete accounting of privacy budget consumption
 * with composition and utility analysis.
 */
export interface PrivacyAccounting {
  /** Current budget state */
  budget: PrivacyBudget;
  /** Composition result */
  composition: CompositionResult;
  /** Utility loss estimate */
  utilityLoss: UtilityLoss;
  /** Privacy guarantee verification */
  guarantee: PrivacyGuarantee;
  /** Privacy loss history */
  history: PrivacyCost[];
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Noise mechanism interface
 *
 * Generic interface for all DP noise mechanisms.
 */
export interface INoiseMechanism {
  /** Mechanism type */
  readonly type: NoiseMechanismType;
  /** Current ε parameter */
  readonly epsilon: number;
  /** Current δ parameter (undefined for pure DP) */
  readonly delta?: number;
  /** Query sensitivity */
  readonly sensitivity: number;

  /**
   * Add noise to a single value
   * @param value - True value to privatize
   * @returns Noisy value
   */
  addNoise(value: number): number;

  /**
   * Add noise to a vector
   * @param vector - Vector to privatize
   * @returns Noisy vector
   */
  addNoiseVector(vector: Float32Array): Float32Array;

  /**
   * Get noise multiplier (scale/sigma)
   */
  getNoiseMultiplier(): number;

  /**
   * Estimate utility loss
   * @param signalMagnitude - Expected magnitude of true values
   */
  estimateUtilityLoss(signalMagnitude: number): UtilityLoss;

  /**
   * Verify privacy guarantee
   */
  verifyGuarantee(): PrivacyGuarantee;
}

/**
 * Privacy budget tracker interface
 *
 * Manages privacy budget across multiple operations with
 * support for composition theorems.
 */
export interface IPrivacyBudgetTracker {
  /** Current budget state */
  readonly budget: PrivacyBudget;

  /** Composition type being used */
  readonly compositionType: CompositionType;

  /** Privacy loss history */
  readonly history: readonly PrivacyCost[];

  /**
   * Spend privacy budget
   * @param cost - Privacy cost to spend
   * @throws Error if insufficient budget and throwOnExhaustion is true
   */
  spend(cost: PrivacyCost): void;

  /**
   * Compose multiple privacy costs
   * @param costs - Privacy costs to compose
   * @param compositionType - Composition theorem to use
   */
  compose(costs: PrivacyCost[], compositionType?: CompositionType): CompositionResult;

  /**
   * Get complete accounting
   */
  getAccounting(): PrivacyAccounting;

  /**
   * Reset budget to initial state
   */
  reset(): void;

  /**
   * Check if budget is sufficient
   * @param cost - Cost to check
   */
  canAfford(cost: PrivacyCost): boolean;
}

// ============================================================================
// ENHANCED INTENT ENCODER TYPES
// ============================================================================

/**
 * Enhanced IntentEncoderConfig with full DP support
 *
 * Extends the basic IntentEncoderConfig with comprehensive
 * differential privacy options.
 */
export interface IntentEncoderConfigDP {
  /** OpenAI API key */
  openaiKey?: string;
  /** Base URL for embedding API */
  baseURL?: string;
  /** Default ε value for differential privacy (default: 1.0) */
  epsilon: number;
  /** δ parameter for (ε,δ)-DP (default: 1e-5) */
  delta?: number;
  /** Output dimension (default: 768) */
  outputDimensions?: number;
  /** PCA projection matrix */
  pcaMatrix?: number[][];
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Noise mechanism type */
  noiseMechanism?: NoiseMechanismType;
  /** Composition type for batch operations */
  compositionType?: CompositionType;
  /** Query sensitivity (default: 2.0 for embeddings) */
  sensitivity?: number;
  /** Maximum privacy budget (default: Infinity) */
  maxPrivacyBudget?: number;
  /** Track detailed privacy accounting */
  trackPrivacy?: boolean;
  /** Warn when privacy budget exhausted */
  warnOnBudgetExhausted?: boolean;
  /** Throw error when privacy budget exhausted */
  throwOnBudgetExhausted?: boolean;
  /** Random seed for reproducibility */
  seed?: number;
}

/**
 * Enhanced IntentVector with full DP metadata
 *
 * Extends IntentVector with comprehensive privacy accounting.
 */
export interface IntentVectorDP {
  /** 768-dimensional intent vector (L2-normalized) */
  vector: Float32Array;
  /** Privacy parameter used (ε-differential privacy) */
  epsilon: number;
  /** δ parameter (for approximate DP) */
  delta?: number;
  /** Noise mechanism used */
  mechanism: NoiseMechanismType;
  /** Actual sensitivity computed */
  sensitivity: number;
  /** Noise multiplier applied */
  noiseMultiplier: number;
  /** Model used for base embedding */
  model: string;
  /** Time taken in milliseconds */
  latency: number;
  /** Whether this satisfies ε-differential privacy */
  satisfiesDP: boolean;
  /** Utility loss estimate */
  utilityLoss?: UtilityLoss;
  /** Privacy guarantee verification */
  guarantee?: PrivacyGuarantee;
  /** Privacy accounting (if tracking enabled) */
  accounting?: PrivacyAccounting;
}

/**
 * Enhanced IntentEncoder with full DP support
 *
 * Extends IntentEncoder interface with comprehensive
 * differential privacy features.
 */
export interface IntentEncoderDP {
  /**
   * Encode a single query as an intent vector
   * @param query - Text query to encode
   * @param options - Encoding options including ε
   */
  encode(
    query: string,
    options?: { epsilon?: number; delta?: number }
  ): Promise<IntentVectorDP>;

  /**
   * Encode multiple queries with composition tracking
   * @param queries - Array of queries to encode
   * @param options - Encoding options
   */
  encodeBatch(
    queries: string[],
    options?: { epsilon?: number; delta?: number; compositionType?: CompositionType }
  ): Promise<IntentVectorDP[]>;

  /**
   * Initialize the encoder
   */
  initialize?(): Promise<void>;

  /**
   * Shutdown and release resources
   */
  shutdown?(): Promise<void>;

  /**
   * Get current privacy budget state
   */
  getPrivacyBudget(): PrivacyBudget;

  /**
   * Get complete privacy accounting
   */
  getPrivacyAccounting(): PrivacyAccounting;

  /**
   * Reset privacy budget
   */
  resetPrivacyBudget(): void;

  /**
   * Set privacy budget
   */
  setPrivacyBudget(epsilon: number, delta?: number): void;

  /**
   * Get noise mechanism
   */
  getNoiseMechanism(): INoiseMechanism;

  /**
   * Estimate utility loss for given ε
   */
  estimateUtilityLoss(epsilon: number, signalMagnitude: number): UtilityLoss;

  /**
   * Verify privacy guarantees
   */
  verifyPrivacyGuarantee(epsilon: number, delta?: number): PrivacyGuarantee;
}
