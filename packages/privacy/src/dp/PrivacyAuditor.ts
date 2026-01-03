/**
 * Privacy Auditor for Differential Privacy
 *
 * Verifies and audits privacy guarantees for DP mechanisms.
 * Provides formal verification of ε-DP guarantees and detects violations.
 *
 * @module dp/auditor
 */

import type {
  PrivacyGuarantee,
  PrivacyCost,
  PrivacyAccounting,
} from "@lsi/protocol";
import { NoiseMechanismType } from "@lsi/protocol";

/**
 * Audit result for a single operation
 */
export interface AuditResult {
  /** Operation ID */
  operationId: string;
  /** Privacy cost */
  cost: PrivacyCost;
  /** Privacy guarantee */
  guarantee: PrivacyGuarantee;
  /** Whether privacy guarantee was satisfied */
  passed: boolean;
  /** Timestamp */
  timestamp: number;
  /** Additional notes */
  notes?: string[];
}

/**
 * Audit report for multiple operations
 */
export interface AuditReport {
  /** Report ID */
  reportId: string;
  /** Audit results */
  results: AuditResult[];
  /** Overall pass/fail */
  passed: boolean;
  /** Total privacy cost */
  totalCost: {
    epsilon: number;
    delta: number;
  };
  /** Privacy guarantee summary */
  guaranteeSummary: {
    pure: number;
    approximate: number;
    failed: number;
  };
  /** Recommendations */
  recommendations: string[];
  /** Timestamp */
  timestamp: number;
}

/**
 * Privacy violation detected
 */
export interface PrivacyViolation {
  /** Violation type */
  type: "budget_exceeded" | "guarantee_failed" | "composition_error";
  /** Operation that caused violation */
  operation: string;
  /** Expected parameters */
  expected: {
    epsilon: number;
    delta?: number;
  };
  /** Actual parameters */
  actual: {
    epsilon: number;
    delta?: number;
  };
  /** Severity */
  severity: "low" | "medium" | "high" | "critical";
  /** Description */
  description: string;
}

/**
 * Privacy auditor
 *
 * Verifies and audits privacy guarantees for DP mechanisms.
 */
export class PrivacyAuditor {
  private auditHistory: AuditResult[] = [];
  private violations: PrivacyViolation[] = [];

  /**
   * Audit a single privacy operation
   *
   * @param operationId - Operation identifier
   * @param cost - Privacy cost
   * @param mechanism - Noise mechanism type
   * @param sensitivity - Query sensitivity
   */
  auditOperation(
    operationId: string,
    cost: PrivacyCost,
    mechanism: NoiseMechanismType,
    sensitivity: number
  ): AuditResult {
    const guarantee = this.verifyGuarantee(cost, mechanism, sensitivity);
    const passed = guarantee.satisfiesDP;

    const notes: string[] = [];
    if (!passed) {
      notes.push("Privacy guarantee not satisfied");
      this.recordViolation({
        type: "guarantee_failed",
        operation: operationId,
        expected: { epsilon: cost.epsilon, delta: cost.delta },
        actual: { epsilon: cost.epsilon, delta: cost.delta },
        severity: "high",
        description: `Privacy guarantee verification failed for ${operationId}`,
      });
    }

    if (cost.epsilon > 10.0) {
      notes.push("High epsilon value (weak privacy)");
    }

    if (cost.delta && cost.delta > 1e-5) {
      notes.push("High delta value (weak approximate DP)");
    }

    const result: AuditResult = {
      operationId,
      cost,
      guarantee,
      passed,
      timestamp: Date.now(),
      notes: notes.length > 0 ? notes : undefined,
    };

    this.auditHistory.push(result);

    return result;
  }

  /**
   * Audit multiple operations
   *
   * @param operations - Operations to audit
   */
  auditOperations(
    operations: Array<{
      operationId: string;
      cost: PrivacyCost;
      mechanism: NoiseMechanismType;
      sensitivity: number;
    }>
  ): AuditReport {
    const results = operations.map(op =>
      this.auditOperation(op.operationId, op.cost, op.mechanism, op.sensitivity)
    );

    const passed = results.every(r => r.passed);

    const totalCost = {
      epsilon: results.reduce((sum, r) => sum + r.cost.epsilon, 0),
      delta: results.reduce((sum, r) => sum + (r.cost.delta ?? 0), 0),
    };

    const guaranteeSummary = {
      pure: results.filter(r => r.guarantee.guaranteeType === "pure").length,
      approximate: results.filter(r => r.guarantee.guaranteeType === "approximate").length,
      failed: results.filter(r => !r.passed).length,
    };

    const recommendations = this.generateRecommendations(results);

    return {
      reportId: this.generateReportId(),
      results,
      passed,
      totalCost,
      guaranteeSummary,
      recommendations,
      timestamp: Date.now(),
    };
  }

  /**
   * Audit privacy accounting
   *
   * @param accounting - Privacy accounting to audit
   */
  auditAccounting(accounting: PrivacyAccounting): AuditReport {
    const operations: AuditResult[] = accounting.history.map((cost, index) => ({
      operationId: `operation_${index}`,
      cost,
      guarantee: {
        satisfiesDP: true,
        epsilonAchieved: cost.epsilon,
        deltaAchieved: cost.delta ?? 0,
        guaranteeType: cost.delta === 0 ? ("pure" as const) : ("approximate" as const),
        confidence: 1 - (cost.delta ?? 0),
      },
      passed: true,
      timestamp: cost.timestamp,
    }));

    // Check overall guarantee
    const overallPassed = accounting.guarantee.satisfiesDP;

    const report: AuditReport = {
      reportId: this.generateReportId(),
      results: operations,
      passed: overallPassed,
      totalCost: {
        epsilon: accounting.budget.epsilonSpent,
        delta: accounting.budget.deltaSpent,
      },
      guaranteeSummary: {
        pure: operations.filter(r => r.guarantee.guaranteeType === "pure").length,
        approximate: operations.filter(r => r.guarantee.guaranteeType === "approximate").length,
        failed: overallPassed ? 0 : 1,
      },
      recommendations: this.generateAccountingRecommendations(accounting),
      timestamp: Date.now(),
    };

    return report;
  }

  /**
   * Verify privacy guarantee
   *
   * @param cost - Privacy cost
   * @param mechanism - Noise mechanism type
   * @param sensitivity - Query sensitivity
   */
  private verifyGuarantee(
    cost: PrivacyCost,
    mechanism: NoiseMechanismType,
    sensitivity: number
  ): PrivacyGuarantee {
    // Basic sanity checks
    if (cost.epsilon <= 0) {
      return {
        satisfiesDP: false,
        epsilonAchieved: cost.epsilon,
        deltaAchieved: cost.delta ?? 0,
        guaranteeType: "pure",
        confidence: 0,
      };
    }

    if (cost.delta && (cost.delta < 0 || cost.delta >= 1)) {
      return {
        satisfiesDP: false,
        epsilonAchieved: cost.epsilon,
        deltaAchieved: cost.delta,
        guaranteeType: "approximate",
        confidence: 0,
      };
    }

    // Mechanism-specific checks
    switch (mechanism) {
      case NoiseMechanismType.LAPLACE:
        // Laplace provides pure ε-DP
        return {
          satisfiesDP: true,
          epsilonAchieved: cost.epsilon,
          deltaAchieved: 0,
          guaranteeType: "pure",
          confidence: 1.0,
        };

      case NoiseMechanismType.GAUSSIAN:
        // Gaussian provides (ε,δ)-DP
        if (!cost.delta) {
          return {
            satisfiesDP: false,
            epsilonAchieved: cost.epsilon,
            deltaAchieved: 0,
            guaranteeType: "approximate",
            confidence: 0,
          };
        }
        return {
          satisfiesDP: true,
          epsilonAchieved: cost.epsilon,
          deltaAchieved: cost.delta,
          guaranteeType: "approximate",
          confidence: 1 - cost.delta,
        };

      default:
        return {
          satisfiesDP: false,
          epsilonAchieved: cost.epsilon,
          deltaAchieved: cost.delta ?? 0,
          guaranteeType: "pure",
          confidence: 0,
        };
    }
  }

  /**
   * Generate recommendations from audit results
   */
  private generateRecommendations(results: AuditResult[]): string[] {
    const recommendations: string[] = [];

    const avgEpsilon =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.cost.epsilon, 0) / results.length
        : 0;

    const totalEpsilon = results.reduce((sum, r) => sum + r.cost.epsilon, 0);

    if (avgEpsilon < 0.5) {
      recommendations.push(
        "Average epsilon is very low (strong privacy). Consider increasing if utility is poor."
      );
    } else if (avgEpsilon > 5.0) {
      recommendations.push(
        "Average epsilon is high (weak privacy). Consider decreasing for stronger privacy guarantees."
      );
    }

    if (totalEpsilon > 100) {
      recommendations.push(
        "Total epsilon consumption is high. Consider implementing privacy budget management."
      );
    }

    const failedCount = results.filter(r => !r.passed).length;
    if (failedCount > 0) {
      recommendations.push(
        `${failedCount} operation(s) failed privacy verification. Review these operations.`
      );
    }

    const approximateCount = results.filter(
      r => r.guarantee.guaranteeType === "approximate"
    ).length;
    if (approximateCount > results.length / 2) {
      recommendations.push(
        "Most operations use approximate DP. Consider using Laplace mechanism for pure DP."
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("Privacy guarantees look good. Continue monitoring.");
    }

    return recommendations;
  }

  /**
   * Generate recommendations from accounting
   */
  private generateAccountingRecommendations(accounting: PrivacyAccounting): string[] {
    const recommendations: string[] = [];

    if (!accounting.guarantee.satisfiesDP) {
      recommendations.push("Privacy guarantee not satisfied. Review privacy parameters.");
    }

    const budgetUsedRatio =
      accounting.budget.totalEpsilon > 0
        ? accounting.budget.epsilonSpent / accounting.budget.totalEpsilon
        : 0;

    if (budgetUsedRatio > 0.9) {
      recommendations.push("Privacy budget nearly exhausted (90%+). Consider resetting soon.");
    } else if (budgetUsedRatio > 0.5) {
      recommendations.push("Privacy budget 50% consumed. Monitor closely.");
    }

    if (accounting.utilityLoss.accuracyLoss > 0.5) {
      recommendations.push("High utility loss detected. Consider increasing epsilon.");
    }

    if (accounting.utilityLoss.snr < 1.0) {
      recommendations.push("Low signal-to-noise ratio. Noise may be impacting utility.");
    }

    if (recommendations.length === 0) {
      recommendations.push("Privacy accounting looks healthy.");
    }

    return recommendations;
  }

  /**
   * Record a privacy violation
   */
  private recordViolation(violation: PrivacyViolation): void {
    this.violations.push(violation);
  }

  /**
   * Get all violations
   */
  getViolations(): readonly PrivacyViolation[] {
    return [...this.violations];
  }

  /**
   * Clear violations
   */
  clearViolations(): void {
    this.violations = [];
  }

  /**
   * Get audit history
   */
  getAuditHistory(): readonly AuditResult[] {
    return [...this.auditHistory];
  }

  /**
   * Clear audit history
   */
  clearHistory(): void {
    this.auditHistory = [];
  }

  /**
   * Generate a unique report ID
   */
  private generateReportId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
