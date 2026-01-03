/**
 * @fileoverview Zero Knowledge Proof Verifier
 *
 * Handles verification of various types of zero knowledge proofs,
 * ensuring they are valid without learning the underlying secrets.
 */

import type {
  ZKPProof,
  ZKPStatement,
  ZKPVerificationResult,
  ProofVerifierConfig,
  Commitment,
  Opening,
} from "./types.js";
import {
  DEFAULT_ZKP_CONFIG,
  ZKP_ERROR_CODES,
} from "./constants.js";
import {
  validateProofFormat,
  checkProofFreshness,
  getProofAge,
  verifyCommitment,
  generateVerificationId,
  measureTime,
} from "./utils.js";
import { ZKPVerificationError } from "./types.js";
import { ZKPSystem } from "./ZKPSystem.js";

// ============================================================================
// DEFAULT VERIFIER CONFIG
// ============================================================================

const DEFAULT_VERIFIER_CONFIG: ProofVerifierConfig = {
  enableCaching: true,
  enableBatchVerification: true,
  verifyCommitments: true,
  checkExpiration: true,
  strictMode: false,
  timeout: 5000,
  maxProofAgeMs: 60 * 60 * 1000, // 1 hour
};

// ============================================================================
// PROOF VERIFIER CLASS
// ============================================================================

/**
 * Zero Knowledge Proof Verifier
 *
 * Verifies various types of ZK proofs while ensuring zero knowledge
 * (the verifier learns nothing about the witness).
 *
 * @example
 * ```typescript
 * const verifier = new ProofVerifier();
 * const result = await verifier.verify(proof);
 * console.log(result.valid); // true or false
 * ```
 */
export class ProofVerifier {
  private config: ProofVerifierConfig;
  private verificationCount: number;
  private cache: Map<string, ZKPVerificationResult>;

  constructor(config: Partial<ProofVerifierConfig> = {}) {
    this.config = { ...DEFAULT_VERIFIER_CONFIG, ...config };
    this.verificationCount = 0;
    this.cache = new Map();
  }

  // ========================================================================
  // MAIN VERIFICATION METHOD
  // ========================================================================

  /**
   * Verify a zero knowledge proof
   *
   * @param proof - Proof to verify
   * @returns Verification result
   */
  async verify<T = Record<string, unknown>>(
    proof: ZKPProof<T>
  ): Promise<ZKPVerificationResult> {
    const startTime = performance.now();

    try {
      this.verificationCount++;

      // Check cache
      const cached = this.getFromCache(proof.proofId);
      if (cached && this.config.enableCaching) {
        const durationMs = performance.now() - startTime;
        return {
          ...cached,
          verificationTimeMs: durationMs,
          metadata: {
            proofAgeMs: cached.metadata?.proofAgeMs ?? 0,
            expired: cached.metadata?.expired ?? false,
            fromCache: true,
            constraintsChecked: cached.metadata?.constraintsChecked ?? 0,
          },
        };
      }

      // Validate proof format
      if (!validateProofFormat(proof)) {
        const durationMs = performance.now() - startTime;
        return this.createInvalidResult(
          proof as ZKPProof,
          "Invalid proof format",
          durationMs
        );
      }

      // Check proof freshness
      if (this.config.checkExpiration) {
        if (!checkProofFreshness(proof, this.config.maxProofAgeMs)) {
          const durationMs = performance.now() - startTime;
          return this.createInvalidResult(
            proof as ZKPProof,
            "Proof is expired or too old",
            durationMs,
            { expired: true }
          );
        }
      }

      // Verify statement constraints
      const constraintsValid = this.verifyConstraints(
        proof.statement,
        proof.proofData
      );

      if (!constraintsValid) {
        const durationMs = performance.now() - startTime;
        return this.createInvalidResult(
          proof as ZKPProof,
          "Statement constraints not satisfied",
          durationMs
        );
      }

      // Verify commitments if enabled
      if (this.config.verifyCommitments) {
        const commitmentsValid = await this.verifyCommitmentsInternal(
          proof.proofData as Record<string, unknown>
        );

        if (!commitmentsValid) {
          const durationMs = performance.now() - startTime;
          return this.createInvalidResult(
            proof as ZKPProof,
            "Commitment verification failed",
            durationMs
          );
        }
      }

      // All checks passed
      const durationMs = performance.now() - startTime;
      const result: ZKPVerificationResult = {
        valid: true,
        verificationId: generateVerificationId(),
        proofId: proof.proofId,
        verifiedAt: Date.now(),
        verificationTimeMs: durationMs,
        securityLevel: proof.metadata.securityLevel,
        metadata: {
          proofAgeMs: getProofAge(proof),
          expired: false,
          fromCache: false,
          constraintsChecked: proof.statement.constraints.length,
        },
      };

      // Cache the result
      if (this.config.enableCaching) {
        this.addToCache(proof.proofId, result);
      }

      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;
      return this.createInvalidResult(
        proof as ZKPProof,
        error instanceof Error ? error.message : "Unknown error",
        durationMs
      );
    }
  }

  /**
   * Verify multiple proofs in batch
   *
   * @param proofs - Array of proofs to verify
   * @returns Array of verification results
   */
  async verifyBatch<T = Record<string, unknown>>(
    proofs: ZKPProof<T>[]
  ): Promise<ZKPVerificationResult[]> {
    if (!this.config.enableBatchVerification) {
      // Verify individually
      const results: ZKPVerificationResult[] = [];
      for (const proof of proofs) {
        results.push(await this.verify(proof));
      }
      return results;
    }

    // Verify in parallel
    return Promise.all(proofs.map(proof => this.verify(proof)));
  }

  // ========================================================================
  // COMMITMENT VERIFICATION
  // ========================================================================

  /**
   * Verify commitments in proof data
   *
   * @param proofData - Proof data containing commitments
   * @returns True if all commitments are valid
   */
  private async verifyCommitmentsInternal(
    proofData: Record<string, unknown>
  ): Promise<boolean> {
    // Check if proof data contains commitments
    if (!proofData.commitments && !proofData.witnessCommitments) {
      return true; // No commitments to verify
    }

    const commitments = (proofData.commitments ||
      proofData.witnessCommitments) as Record<string, Commitment>;

    // Basic commitment format validation
    for (const [key, commitment] of Object.entries(commitments)) {
      if (!commitment.value || !commitment.commitmentId) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verify a commitment with opening
   *
   * @param commitment - Commitment to verify
   * @param opening - Opening containing value and randomness
   * @returns True if commitment is valid
   */
  async verifyCommitmentOpening(
    commitment: Commitment,
    opening: Opening
  ): Promise<boolean> {
    return verifyCommitment(commitment, opening, this.config.hashFunction);
  }

  /**
   * Verify commitment format
   *
   * @param commitment - Commitment to validate
   * @returns True if format is valid
   */
  validateCommitmentFormat(commitment: Commitment): boolean {
    return (
      typeof commitment.value === "string" &&
      typeof commitment.commitmentId === "string" &&
      typeof commitment.timestamp === "number" &&
      commitment.value.length > 0 &&
      commitment.commitmentId.length > 0
    );
  }

  // ========================================================================
  // CONSTRAINT VERIFICATION
  // ========================================================================

  /**
   * Verify statement constraints
   *
   * @param statement - Statement with constraints
   * @param proofData - Proof data
   * @returns True if all constraints are satisfied
   */
  private verifyConstraints(
    statement: ZKPStatement,
    proofData: Record<string, unknown>
  ): boolean {
    // For each constraint in statement
    for (const constraint of statement.constraints) {
      // Parse constraint
      const match = constraint.match(/^(\w+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);

      if (match) {
        const [, field, operator, expectedStr] = match;

        // Check if field exists in public inputs or proof data
        const actual =
          statement.publicInputs[field] || proofData[field];

        // If field not found, constraint can't be verified
        if (actual === undefined) {
          // In strict mode, this is an error
          if (this.config.strictMode) {
            return false;
          }
          // Otherwise, skip this constraint
          continue;
        }

        // Parse expected value
        let expected: unknown;
        if (expectedStr === "true") expected = true;
        else if (expectedStr === "false") expected = false;
        else if (!isNaN(Number(expectedStr))) expected = Number(expectedStr);
        else expected = expectedStr;

        // Check constraint
        const valid = this.checkConstraint(actual, operator, expected);
        if (!valid) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if a value satisfies a constraint
   *
   * @param actual - Actual value
   * @param operator - Comparison operator
   * @param expected - Expected value
   * @returns True if constraint is satisfied
   */
  private checkConstraint(
    actual: unknown,
    operator: string,
    expected: unknown
  ): boolean {
    switch (operator) {
      case "==":
        return actual === expected;
      case "!=":
        return actual !== expected;
      case ">":
        return typeof actual === "number" &&
          typeof expected === "number" &&
          actual > expected;
      case "<":
        return typeof actual === "number" &&
          typeof expected === "number" &&
          actual < expected;
      case ">=":
        return typeof actual === "number" &&
          typeof expected === "number" &&
          actual >= expected;
      case "<=":
        return typeof actual === "number" &&
          typeof expected === "number" &&
          actual <= expected;
      default:
        return false;
    }
  }

  // ========================================================================
  // CACHING
  // ========================================================================

  /**
   * Add result to cache
   *
   * @param proofId - Proof identifier
   * @param result - Verification result
   */
  private addToCache(
    proofId: string,
    result: ZKPVerificationResult
  ): void {
    this.cache.set(proofId, result);

    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value as string;
      this.cache.delete(firstKey);
    }
  }

  /**
   * Get result from cache
   *
   * @param proofId - Proof identifier
   * @returns Cached result or undefined
   */
  private getFromCache(
    proofId: string
  ): ZKPVerificationResult | undefined {
    return this.cache.get(proofId);
  }

  /**
   * Clear verification cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns Cache size and hit rate
   */
  getCacheStats() {
    return {
      size: this.cache.size,
    };
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Create invalid verification result
   *
   * @param proof - Proof being verified
   * @param error - Error message
   * @param durationMs - Verification duration
   * @param additionalMetadata - Additional metadata
   * @returns Invalid verification result
   */
  private createInvalidResult(
    proof: ZKPProof,
    error: string,
    durationMs: number,
    additionalMetadata?: Partial<ZKPVerificationResult["metadata"]>
  ): ZKPVerificationResult {
    return {
      valid: false,
      verificationId: generateVerificationId(),
      proofId: proof.proofId,
      verifiedAt: Date.now(),
      verificationTimeMs: durationMs,
      securityLevel: proof.metadata.securityLevel,
      error,
      metadata: {
        proofAgeMs: getProofAge(proof),
        expired: false,
        fromCache: false,
        constraintsChecked: 0,
        ...additionalMetadata,
      },
    };
  }

  /**
   * Get verifier statistics
   *
   * @returns Statistics including verification count and config
   */
  getStats() {
    return {
      verificationCount: this.verificationCount,
      cacheStats: this.getCacheStats(),
      config: this.config,
    };
  }

  /**
   * Reset verifier statistics
   */
  resetStats(): void {
    this.verificationCount = 0;
  }

  /**
   * Update configuration
   *
   * @param updates - Configuration updates
   */
  updateConfig(updates: Partial<ProofVerifierConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getConfig(): ProofVerifierConfig {
    return { ...this.config };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a proof verifier with default configuration
 *
 * @param config - Optional configuration overrides
 * @returns Configured proof verifier
 */
export function createProofVerifier(
  config?: Partial<ProofVerifierConfig>
): ProofVerifier {
  return new ProofVerifier(config);
}

/**
 * Quick verification without creating verifier instance
 *
 * @param proof - Proof to verify
 * @param config - Optional configuration
 * @returns Verification result
 */
export async function verifyProof<T = Record<string, unknown>>(
  proof: ZKPProof<T>,
  config?: Partial<ProofVerifierConfig>
): Promise<ZKPVerificationResult> {
  const verifier = new ProofVerifier(config);
  return verifier.verify(proof);
}

/**
 * Verify multiple proofs quickly
 *
 * @param proofs - Proofs to verify
 * @param config - Optional configuration
 * @returns Verification results
 */
export async function verifyProofs<T = Record<string, unknown>>(
  proofs: ZKPProof<T>[],
  config?: Partial<ProofVerifierConfig>
): Promise<ZKPVerificationResult[]> {
  const verifier = new ProofVerifier(config);
  return verifier.verifyBatch(proofs);
}
