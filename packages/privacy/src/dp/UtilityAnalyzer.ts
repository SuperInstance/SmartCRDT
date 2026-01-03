/**
 * Utility Analyzer for Differential Privacy
 *
 * Analyzes the privacy-utility tradeoff for DP mechanisms.
 * Provides recommendations for ε selection based on target utility.
 *
 * @module dp/utility
 */

import type {
  UtilityLoss,
  PrivacyGuarantee,
} from "@lsi/protocol";
import { NoiseMechanismType } from "@lsi/protocol";

/**
 * Utility metrics for a specific ε value
 */
export interface UtilityMetrics {
  /** Epsilon value */
  epsilon: number;
  /** Expected accuracy (0-1) */
  accuracy: number;
  /** Expected noise level */
  noiseLevel: number;
  /** Signal-to-noise ratio */
  snr: number;
  /** Utility loss estimate */
  utilityLoss: UtilityLoss;
  /** Recommended for use case? */
  recommended: boolean;
  /** Recommendation reason */
  reason: string;
}

/**
 * Utility analysis result
 */
export interface UtilityAnalysis {
  /** Sensitivity used */
  sensitivity: number;
  /** Signal magnitude assumed */
  signalMagnitude: number;
  /** Metrics at different ε values */
  metrics: UtilityMetrics[];
  /** Recommended ε */
  recommendedEpsilon: number;
  /** Privacy recommendation */
  privacyRecommendation: PrivacyRecommendation;
}

/**
 * Privacy recommendation
 */
export interface PrivacyRecommendation {
  /** Suggested ε value */
  epsilon: number;
  /** Expected accuracy */
  accuracy: number;
  /** Privacy risk level */
  privacyRisk: "low" | "medium" | "high";
  /** Reasoning */
  reasoning: string;
  /** Use cases suitable for this ε */
  suitableFor: string[];
}

/**
 * Utility analyzer for DP mechanisms
 *
 * Analyzes and predicts utility loss for different privacy parameters.
 */
export class UtilityAnalyzer {
  private readonly sensitivity: number;
  private readonly signalMagnitude: number;

  /**
   * Create a utility analyzer
   *
   * @param sensitivity - Query sensitivity (default: 2.0 for embeddings)
   * @param signalMagnitude - Expected signal magnitude (default: 1.0)
   */
  constructor(sensitivity: number = 2.0, signalMagnitude: number = 1.0) {
    if (sensitivity < 0) {
      throw new Error(`Sensitivity must be non-negative, got ${sensitivity}`);
    }
    if (signalMagnitude <= 0) {
      throw new Error(`Signal magnitude must be positive, got ${signalMagnitude}`);
    }

    this.sensitivity = sensitivity;
    this.signalMagnitude = signalMagnitude;
  }

  /**
   * Estimate utility loss for Laplace mechanism
   *
   * @param epsilon - Privacy parameter
   */
  estimateLaplaceUtility(epsilon: number): UtilityLoss {
    if (epsilon <= 0) {
      throw new Error(`Epsilon must be positive, got ${epsilon}`);
    }

    // Laplace scale
    const scale = this.sensitivity / epsilon;

    // Variance = 2b²
    const variance = 2 * scale * scale;
    const mse = variance;

    // Accuracy loss
    const accuracyLoss = Math.min(1, scale / (this.signalMagnitude + 1e-10));

    // 95% confidence interval
    const confidenceInterval: [number, number] = [
      -1.96 * scale,
      1.96 * scale,
    ];

    // Signal-to-noise ratio
    const snr = this.signalMagnitude / (scale + 1e-10);

    return {
      accuracyLoss,
      varianceIncrease: variance,
      mse,
      confidenceInterval,
      snr,
    };
  }

  /**
   * Estimate utility loss for Gaussian mechanism
   *
   * @param epsilon - Privacy parameter
   * @param delta - Failure probability
   */
  estimateGaussianUtility(epsilon: number, delta: number = 1e-5): UtilityLoss {
    if (epsilon <= 0) {
      throw new Error(`Epsilon must be positive, got ${epsilon}`);
    }
    if (delta <= 0 || delta >= 1) {
      throw new Error(`Delta must be in (0, 1), got ${delta}`);
    }

    // Gaussian sigma
    const sigma = (this.sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;

    // Variance = σ²
    const variance = sigma * sigma;
    const mse = variance;

    // Accuracy loss
    const accuracyLoss = Math.min(1, sigma / (this.signalMagnitude + 1e-10));

    // 95% confidence interval
    const confidenceInterval: [number, number] = [
      -1.96 * sigma,
      1.96 * sigma,
    ];

    // Signal-to-noise ratio
    const snr = this.signalMagnitude / (sigma + 1e-10);

    return {
      accuracyLoss,
      varianceIncrease: variance,
      mse,
      confidenceInterval,
      snr,
    };
  }

  /**
   * Recommend epsilon for target accuracy
   *
   * @param targetAccuracy - Desired accuracy (0-1)
   * @param mechanism - Noise mechanism type
   */
  recommendEpsilonForAccuracy(
    targetAccuracy: number,
    mechanism: NoiseMechanismType = NoiseMechanismType.LAPLACE
  ): number {
    if (targetAccuracy < 0 || targetAccuracy > 1) {
      throw new Error(`Target accuracy must be in [0, 1], got ${targetAccuracy}`);
    }

    const accuracyLoss = 1 - targetAccuracy;

    if (accuracyLoss === 0) {
      return Infinity; // Perfect accuracy requires infinite epsilon
    }

    switch (mechanism) {
      case NoiseMechanismType.LAPLACE:
        // accuracy_loss ≈ (sensitivity / epsilon) / signal
        // epsilon ≈ sensitivity / (accuracy_loss * signal)
        return this.sensitivity / (accuracyLoss * this.signalMagnitude);

      case NoiseMechanismType.GAUSSIAN:
        // Similar but with different scaling
        return this.sensitivity / (accuracyLoss * this.signalMagnitude * 0.7);

      default:
        throw new Error(`Unknown mechanism type: ${mechanism}`);
    }
  }

  /**
   * Analyze utility across multiple epsilon values
   *
   * @param epsilons - Epsilon values to analyze
   * @param mechanism - Noise mechanism type
   */
  analyzeUtility(
    epsilons: number[],
    mechanism: NoiseMechanismType = NoiseMechanismType.LAPLACE
  ): UtilityAnalysis {
    const metrics: UtilityMetrics[] = epsilons.map(epsilon => {
      const utilityLoss =
        mechanism === NoiseMechanismType.GAUSSIAN
          ? this.estimateGaussianUtility(epsilon)
          : this.estimateLaplaceUtility(epsilon);

      const accuracy = 1 - utilityLoss.accuracyLoss;
      const noiseLevel = Math.sqrt(utilityLoss.varianceIncrease);
      const snr = utilityLoss.snr;

      // Determine recommendation
      const { recommended, reason } = this.evaluateEpsilon(epsilon, accuracy, snr);

      return {
        epsilon,
        accuracy,
        noiseLevel,
        snr,
        utilityLoss,
        recommended,
        reason,
      };
    });

    // Find recommended epsilon
    const recommendedMetric = metrics.find(m => m.recommended) || metrics[Math.floor(metrics.length / 2)];

    const privacyRecommendation = this.generatePrivacyRecommendation(recommendedMetric.epsilon);

    return {
      sensitivity: this.sensitivity,
      signalMagnitude: this.signalMagnitude,
      metrics,
      recommendedEpsilon: recommendedMetric.epsilon,
      privacyRecommendation,
    };
  }

  /**
   * Generate privacy recommendation
   *
   * @param epsilon - Epsilon value
   */
  private generatePrivacyRecommendation(epsilon: number): PrivacyRecommendation {
    const utilityLoss = this.estimateLaplaceUtility(epsilon);
    const accuracy = 1 - utilityLoss.accuracyLoss;

    // Determine privacy risk
    let privacyRisk: "low" | "medium" | "high";
    let reasoning: string;
    let suitableFor: string[];

    if (epsilon <= 0.5) {
      privacyRisk = "low";
      reasoning = `ε=${epsilon.toFixed(2)} provides strong privacy guarantees with minimal information leakage.`;
      suitableFor = [
        "Health and medical data",
        "Financial information",
        "Personal identifiers",
        "Highly sensitive queries",
      ];
    } else if (epsilon <= 2.0) {
      privacyRisk = "medium";
      reasoning = `ε=${epsilon.toFixed(2)} provides balanced privacy-utility tradeoff for general use.`;
      suitableFor = [
        "General-purpose queries",
        "Business analytics",
        "Recommendation systems",
        "Moderate sensitivity data",
      ];
    } else {
      privacyRisk = "high";
      reasoning = `ε=${epsilon.toFixed(2)} provides high utility but weak privacy protection.`;
      suitableFor = [
        "Public data analytics",
        "Aggregated statistics",
        "Non-sensitive research",
        "Exploratory analysis",
      ];
    }

    return {
      epsilon,
      accuracy,
      privacyRisk,
      reasoning,
      suitableFor,
    };
  }

  /**
   * Evaluate if an epsilon value is recommended
   *
   * @param epsilon - Epsilon value
   * @param accuracy - Expected accuracy
   * @param snr - Signal-to-noise ratio
   */
  private evaluateEpsilon(
    epsilon: number,
    accuracy: number,
    snr: number
  ): { recommended: boolean; reason: string } {
    // Recommended range: 0.5 ≤ ε ≤ 2.0
    if (epsilon >= 0.5 && epsilon <= 2.0) {
      return {
        recommended: true,
        reason: "Balanced privacy-utility tradeoff",
      };
    }

    if (epsilon < 0.5) {
      return {
        recommended: false,
        reason: "Strong privacy but may impact utility",
      };
    }

    if (epsilon > 5.0) {
      return {
        recommended: false,
        reason: "Weak privacy, consider reducing ε",
      };
    }

    return {
      recommended: true,
      reason: "Acceptable for use case",
    };
  }

  /**
   * Compare two mechanisms
   *
   * @param epsilon - Privacy parameter
   */
  compareMechanisms(epsilon: number): {
    laplace: UtilityLoss;
    gaussian: UtilityLoss;
    better: "laplace" | "gaussian" | "similar";
    reason: string;
  } {
    const laplace = this.estimateLaplaceUtility(epsilon);
    const gaussian = this.estimateGaussianUtility(epsilon, 1e-5);

    // Compare variance (lower is better)
    const varianceRatio = gaussian.varianceIncrease / laplace.varianceIncrease;

    let better: "laplace" | "gaussian" | "similar";
    let reason: string;

    if (varianceRatio > 1.1) {
      better = "laplace";
      reason = `Laplace has ${(1 / varianceRatio * 100).toFixed(0)}% less variance`;
    } else if (varianceRatio < 0.9) {
      better = "gaussian";
      reason = `Gaussian has ${(varianceRatio * 100).toFixed(0)}% less variance`;
    } else {
      better = "similar";
      reason = "Both mechanisms have similar utility";
    }

    return {
      laplace,
      gaussian,
      better,
      reason,
    };
  }
}
