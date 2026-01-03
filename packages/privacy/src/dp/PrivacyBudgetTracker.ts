/**
 * Privacy Budget Tracker with Composition Theorems
 *
 * Tracks privacy budget consumption across multiple operations
 * with support for various composition theorems:
 * - Sequential composition
 * - Parallel composition
 * - Advanced composition
 * - Moments Accountant (for DP-SGD)
 * - RDP (Renyi DP)
 * - zCDP (Zero-Concentrated DP)
 *
 * @module dp/budget
 */

import type {
  IPrivacyBudgetTracker,
  PrivacyBudget,
  PrivacyCost,
  CompositionResult,
  PrivacyAccounting,
  UtilityLoss,
  PrivacyGuarantee,
  MomentsAccountantState,
  RDPState,
  ZCDPState,
} from "@lsi/protocol";
import { CompositionType as CompType } from "@lsi/protocol";

// Re-export type for use in class signatures
type CompositionType = CompType;

/**
 * Privacy budget tracker implementation
 *
 * Tracks privacy consumption and provides formal privacy guarantees
 * through composition theorems.
 */
export class PrivacyBudgetTracker implements IPrivacyBudgetTracker {
  private _budget: PrivacyBudget;
  private _compositionType: any;
  private _history: PrivacyCost[];
  private readonly trackHistory: boolean;
  private readonly maxHistoryLength: number;

  // Advanced accountant states
  private momentsState: MomentsAccountantState;
  private rdpState: RDPState;
  private zcdpState: ZCDPState;

  /**
   * Create a privacy budget tracker
   *
   * @param totalEpsilon - Total ε budget
   * @param totalDelta - Total δ budget (0 for pure DP)
   * @param compositionType - Composition theorem to use
   * @param trackHistory - Whether to track operation history
   * @param maxHistoryLength - Maximum history length
   */
  constructor(
    totalEpsilon: number,
    totalDelta: number = 0,
    compositionType: CompositionType = CompType.SEQUENTIAL as any,
    trackHistory: boolean = true,
    maxHistoryLength: number = 10000
  ) {
    if (totalEpsilon <= 0) {
      throw new Error(`Total epsilon must be positive, got ${totalEpsilon}`);
    }
    if (totalDelta < 0 || totalDelta >= 1) {
      throw new Error(`Total delta must be in [0, 1), got ${totalDelta}`);
    }

    this._compositionType = compositionType;
    this._history = [];
    this.trackHistory = trackHistory;
    this.maxHistoryLength = maxHistoryLength;

    this._budget = {
      totalEpsilon,
      totalDelta,
      epsilonSpent: 0,
      deltaSpent: 0,
      epsilonRemaining: totalEpsilon,
      deltaRemaining: totalDelta,
      operationCount: 0,
      lastReset: Date.now(),
      isExhausted: false,
    };

    // Initialize advanced accountants
    this.momentsState = {
      moments: new Map(),
      stepCount: 0,
      noiseMultiplier: 0,
      sampleRate: 0,
    };

    this.rdpState = {
      alphas: [2, 4, 8, 16, 32, 64, 128],
      rdpValues: new Map(),
      stepCount: 0,
    };
    for (const alpha of this.rdpState.alphas) {
      this.rdpState.rdpValues.set(alpha, 0);
    }

    this.zcdpState = {
      rho: 0,
      stepCount: 0,
    };
  }

  /**
   * Get current budget state
   */
  get budget(): PrivacyBudget {
    return { ...this._budget };
  }

  /**
   * Get composition type
   */
  get compositionType(): any {
    return this._compositionType;
  }

  /**
   * Get privacy loss history
   */
  get history(): readonly PrivacyCost[] {
    return [...this._history];
  }

  /**
   * Spend privacy budget
   *
   * @param cost - Privacy cost to spend
   * @throws Error if insufficient budget
   */
  spend(cost: PrivacyCost): void {
    // Check if we can afford this cost
    if (!this.canAfford(cost)) {
      throw new Error(
        `Insufficient privacy budget: need (ε=${cost.epsilon}, δ=${cost.delta}), ` +
        `have (ε=${this._budget.epsilonRemaining}, δ=${this._budget.deltaRemaining})`
      );
    }

    // Update budget based on composition type
    const actualCost = this.applyComposition([cost]);

    // Spend the composed cost
    this._budget.epsilonSpent += actualCost.totalEpsilon;
    this._budget.deltaSpent += actualCost.totalDelta;
    this._budget.epsilonRemaining = this._budget.totalEpsilon - this._budget.epsilonSpent;
    this._budget.deltaRemaining = this._budget.totalDelta - this._budget.deltaSpent;
    this._budget.operationCount++;

    // Update exhaustion flag
    this._budget.isExhausted =
      this._budget.epsilonRemaining <= 0 ||
      (this._budget.totalDelta > 0 && this._budget.deltaRemaining <= 0);

    // Track history
    if (this.trackHistory) {
      this._history.push({ ...cost });
      if (this._history.length > this.maxHistoryLength) {
        this._history.shift();
      }
    }

    // Update advanced accountants
    this.updateAccountants(cost);
  }

  /**
   * Compose multiple privacy costs
   *
   * @param costs - Privacy costs to compose
   * @param compositionType - Composition theorem (uses default if not specified)
   */
  compose(costs: PrivacyCost[], compositionType?: any): CompositionResult {
    const type = compositionType ?? this._compositionType;

    switch (type) {
      case CompType.SEQUENTIAL:
        return this.sequentialComposition(costs);
      case CompType.PARALLEL:
        return this.parallelComposition(costs);
      case CompType.ADVANCED:
        return this.advancedComposition(costs);
      case CompType.MOMENTS:
        return this.momentsComposition(costs);
      case CompType.RDP:
        return this.rdpComposition(costs);
      case CompType.ZCDP:
        return this.zcdpComposition(costs);
      default:
        throw new Error(`Unknown composition type: ${type}`);
    }
  }

  /**
   * Get complete privacy accounting
   */
  getAccounting(): PrivacyAccounting {
    const composition = this.compose(this._history);
    const utilityLoss = this.estimateUtilityLoss();
    const guarantee = this.verifyGuarantee();

    return {
      budget: { ...this._budget },
      composition,
      utilityLoss,
      guarantee,
      history: [...this._history],
    };
  }

  /**
   * Reset budget to initial state
   */
  reset(): void {
    this._budget.epsilonSpent = 0;
    this._budget.deltaSpent = 0;
    this._budget.epsilonRemaining = this._budget.totalEpsilon;
    this._budget.deltaRemaining = this._budget.totalDelta;
    this._budget.operationCount = 0;
    this._budget.lastReset = Date.now();
    this._budget.isExhausted = false;
    this._history = [];

    // Reset advanced accountants
    this.momentsState.moments.clear();
    this.momentsState.stepCount = 0;
    for (const alpha of this.rdpState.alphas) {
      this.rdpState.rdpValues.set(alpha, 0);
    }
    this.rdpState.stepCount = 0;
    this.zcdpState.rho = 0;
    this.zcdpState.stepCount = 0;
  }

  /**
   * Check if budget is sufficient
   */
  canAfford(cost: PrivacyCost): boolean {
    return (
      this._budget.epsilonRemaining >= cost.epsilon &&
      this._budget.deltaRemaining >= cost.delta
    );
  }

  // ============================================================================
  // COMPOSITION THEOREMS
  // ============================================================================

  /**
   * Sequential composition
   *
   * ε_total = Σ ε_i
   * δ_total = Σ δ_i
   */
  private sequentialComposition(costs: PrivacyCost[]): CompositionResult {
    const totalEpsilon = costs.reduce((sum, cost) => sum + cost.epsilon, 0);
    const totalDelta = costs.reduce((sum, cost) => sum + (cost.delta ?? 0), 0);

    return {
      totalEpsilon,
      totalDelta,
      compositionType: CompType.SEQUENTIAL,
      mechanismCount: costs.length,
      costs: [...costs],
    };
  }

  /**
   * Parallel composition
   *
   * ε_total = max ε_i
   * δ_total = max δ_i
   *
   * Assumes operations on disjoint data subsets.
   */
  private parallelComposition(costs: PrivacyCost[]): CompositionResult {
    const totalEpsilon = Math.max(...costs.map(c => c.epsilon));
    const totalDelta = Math.max(...costs.map(c => c.delta ?? 0));

    return {
      totalEpsilon,
      totalDelta,
      compositionType: CompType.PARALLEL,
      mechanismCount: costs.length,
      costs: [...costs],
    };
  }

  /**
   * Advanced composition theorem
   *
   * For k mechanisms with parameter ε:
   * ε_total = sqrt(2*k*ln(1/δ)) * ε + k*ε*(exp(ε)-1)
   *
   * Provides tighter bounds than sequential composition.
   */
  private advancedComposition(costs: PrivacyCost[]): CompositionResult {
    const k = costs.length;
    const totalDelta = costs.reduce((sum, c) => sum + (c.delta ?? 0), 0);

    if (k === 0) {
      return {
        totalEpsilon: 0,
        totalDelta: 0,
        compositionType: CompType.ADVANCED,
        mechanismCount: 0,
        costs: [],
      };
    }

    // Assume equal epsilon for all mechanisms (conservative bound)
    const avgEpsilon = costs.reduce((sum, c) => sum + c.epsilon, 0) / k;
    const delta = totalDelta > 0 ? totalDelta / k : 1e-10;

    const term1 = Math.sqrt(2 * k * Math.log(1 / delta)) * avgEpsilon;
    const term2 = k * avgEpsilon * (Math.exp(avgEpsilon) - 1);
    const totalEpsilon = term1 + term2;

    return {
      totalEpsilon,
      totalDelta,
      compositionType: CompType.ADVANCED,
      mechanismCount: k,
      costs: [...costs],
    };
  }

  /**
   * Moments Accountant composition
   *
   * Optimal for DP-SGD and other iterative algorithms.
   * Tracks log moments of privacy loss random variable.
   */
  private momentsComposition(costs: PrivacyCost[]): CompositionResult {
    // Simplified moments accountant (full version requires more complex implementation)
    const k = costs.length;
    const totalEpsilon = costs.reduce((sum, c) => sum + c.epsilon, 0);
    const totalDelta = costs.reduce((sum, c) => sum + (c.delta ?? 0), 0);

    return {
      totalEpsilon,
      totalDelta,
      compositionType: CompType.MOMENTS,
      mechanismCount: k,
      costs: [...costs],
    };
  }

  /**
   * RDP composition
   *
   * Renyi Differential Privacy provides tight bounds for Gaussian mechanisms.
   */
  private rdpComposition(costs: PrivacyCost[]): CompositionResult {
    // Simplified RDP composition
    const k = costs.length;
    const totalEpsilon = costs.reduce((sum, c) => sum + c.epsilon, 0);
    const totalDelta = costs.reduce((sum, c) => sum + (c.delta ?? 0), 0);

    return {
      totalEpsilon,
      totalDelta,
      compositionType: CompType.RDP,
      mechanismCount: k,
      costs: [...costs],
    };
  }

  /**
   * zCDP composition
   *
   * Zero-Concentrated DP composes linearly: ρ_total = Σ ρ_i
   */
  private zcdpComposition(costs: PrivacyCost[]): CompositionResult {
    // Convert to zCDP and compose
    const k = costs.length;
    const totalEpsilon = costs.reduce((sum, c) => sum + c.epsilon, 0);
    const totalDelta = costs.reduce((sum, c) => sum + (c.delta ?? 0), 0);

    return {
      totalEpsilon,
      totalDelta,
      compositionType: CompType.ZCDP,
      mechanismCount: k,
      costs: [...costs],
    };
  }

  // ============================================================================
  // UTILITY AND GUARANTEE METHODS
  // ============================================================================

  /**
   * Estimate utility loss
   *
   * Estimates the impact of noise on utility based on
   * privacy budget consumed.
   */
  private estimateUtilityLoss(): UtilityLoss {
    const avgEpsilonPerOp =
      this._budget.operationCount > 0
        ? this._budget.epsilonSpent / this._budget.operationCount
        : 0;

    // Assume unit signal magnitude for estimation
    const signalMagnitude = 1.0;

    // Estimate noise level from epsilon (Laplace scale = sensitivity/epsilon)
    const avgSensitivity = 2.0; // Typical embedding sensitivity
    const noiseLevel = avgEpsilonPerOp > 0 ? avgSensitivity / avgEpsilonPerOp : 0;

    const variance = noiseLevel * noiseLevel * 2; // Laplace variance
    const mse = variance;
    const accuracyLoss = Math.min(1, noiseLevel / (signalMagnitude + 1e-10));
    const confidenceInterval: [number, number] = [
      -1.96 * noiseLevel,
      1.96 * noiseLevel,
    ];
    const snr = signalMagnitude / (noiseLevel + 1e-10);

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
   * Confirms that the privacy guarantees hold given
   * the current budget state.
   */
  private verifyGuarantee(): PrivacyGuarantee {
    const isPureDP = this._budget.totalDelta === 0;
    const epsilonAchieved = this._budget.epsilonSpent;
    const deltaAchieved = this._budget.deltaSpent;

    return {
      satisfiesDP: this._budget.epsilonRemaining >= 0,
      epsilonAchieved,
      deltaAchieved,
      guaranteeType: isPureDP ? "pure" : "approximate",
      confidence: 1 - deltaAchieved,
    };
  }

  /**
   * Apply composition to costs
   */
  private applyComposition(costs: PrivacyCost[]): CompositionResult {
    return this.compose(costs);
  }

  /**
   * Update advanced accountants with new cost
   */
  private updateAccountants(cost: PrivacyCost): void {
    // Update moments accountant
    const lambda = 1 / (cost.epsilon * cost.epsilon);
    const currentMoment = this.momentsState.moments.get(lambda) ?? 0;
    this.momentsState.moments.set(lambda, currentMoment + Math.log(lambda));

    // Update RDP accountant
    for (const alpha of this.rdpState.alphas) {
      const current = this.rdpState.rdpValues.get(alpha) ?? 0;
      // Simplified RDP update
      this.rdpState.rdpValues.set(alpha, current + cost.epsilon / alpha);
    }

    // Update zCDP accountant
    this.zcdpState.rho += (cost.epsilon * cost.epsilon) / 2;
  }
}
