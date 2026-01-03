/**
 * @fileoverview Range Proofs for Zero Knowledge Systems
 *
 * Implements ZKP range proofs, which allow proving that a value
 * falls within a specific range without revealing the actual value.
 *
 * Use case: Prove that a user's age is between 18 and 120 without
 * revealing their exact age.
 */

import type {
  ZKPProof,
  ZKPStatement,
  ZKPWitness,
  Commitment,
} from "./types.js";
import {
  RANGE_PROOF_CONSTANTS,
  ZKP_ERROR_CODES,
} from "./constants.js";
import { ProofGenerator } from "./ProofGenerator.js";
import { ProofVerifier } from "./ProofVerifier.js";
import {
  computeCommitment,
  hashToField,
  generateProofId,
  generateStatementId,
  generateWitnessId,
} from "./utils.js";

// ============================================================================
// RANGE PROOF TYPES
// ============================================================================

/**
 * Public inputs for range proof
 */
export interface RangeProofPublicInputs extends Record<string, unknown> {
  /** Minimum value of the range */
  min: number;
  /** Maximum value of the range */
  max: number;
  /** Whether range is inclusive */
  inclusive: boolean;
  /** Context identifier */
  contextId?: string;
  [key: string]: unknown;
}

/**
 * Private inputs for range proof
 */
export interface RangeProofPrivateInputs extends Record<string, unknown> {
  /** The secret value being proven */
  value: number;
  /** Optional blinding factor */
  blindingFactor?: string;
  [key: string]: unknown;
}

/**
 * Range proof claim
 */
export interface RangeProofClaim {
  /** Claim type */
  type: "RANGE";
  /** Claim description */
  description: string;
  /** Public inputs */
  publicInputs: RangeProofPublicInputs;
  /** Constraints */
  constraints: string[];
}

/**
 * Range proof data
 */
export interface RangeProofData {
  /** Commitment to the secret value */
  valueCommitment: Commitment;
  /** Commitments to range bounds */
  rangeCommitments: {
    min: Commitment;
    max: Commitment;
  };
  /** Proof that value is in range */
  membershipProof: {
    /** Hash of the proof */
    hash: string;
    /** Proof bytes */
    bytes: string;
  };
  /** Proof metadata */
  metadata: {
    /** Range size */
    rangeSize: number;
    /** Security level */
    securityLevel: string;
  };
}

// ============================================================================
// RANGE PROOF GENERATOR
// ============================================================================

/**
 * Range Proof Generator
 *
 * Generates zero knowledge range proofs.
 *
 * @example
 * ```typescript
 * const proof = await RangeProof.generate({
 *   value: 25,
 *   min: 18,
 *   max: 120,
 *   inclusive: true
 * });
 * ```
 */
export class RangeProof {
  private generator: ProofGenerator;

  constructor(config?: { securityLevel?: string; hashFunction?: string }) {
    this.generator = new ProofGenerator({
      securityLevel: (config?.securityLevel as any) || "HIGH",
      hashFunction: (config?.hashFunction as any) || "SHA256",
      includeMetadata: true,
    });
  }

  /**
   * Generate a range proof
   *
   * Proves that a value is within a specified range without revealing it.
   *
   * @param inputs - Range proof inputs
   * @returns Zero knowledge range proof
   */
  async generate(inputs: {
    /** The secret value */
    value: number;
    /** Minimum of range */
    min: number;
    /** Maximum of range */
    max: number;
    /** Whether range is inclusive */
    inclusive?: boolean;
    /** Optional context identifier */
    contextId?: string;
  }): Promise<ZKPProof<RangeProofData>> {
    const { value, min, max, inclusive = true, contextId } = inputs;

    // Validate inputs
    this.validateInputs(value, min, max, inclusive);

    // Check that value is actually in range
    const inRange = inclusive
      ? value >= min && value <= max
      : value > min && value < max;

    if (!inRange) {
      throw new Error(
        `Value ${value} is not in range [${min}, ${max}]${inclusive ? "" : " (exclusive)"}`
      );
    }

    // Create public inputs
    const publicInputs: RangeProofPublicInputs = {
      min,
      max,
      inclusive,
      contextId,
    };

    // Create private inputs
    const privateInputs: RangeProofPrivateInputs = {
      value,
      blindingFactor: generateBlindingFactor(),
    };

    // Create constraints
    const constraints = this.buildConstraints(min, max, inclusive);

    // Create claim
    const claim: RangeProofClaim = {
      type: "RANGE",
      description: `Value is in range [${min}, ${max}]${inclusive ? "" : " (exclusive)"}`,
      publicInputs,
      constraints,
    };

    // Generate commitments
    const valueCommitment = await computeCommitment(
      value,
      privateInputs.blindingFactor
    );
    const minCommitment = await computeCommitment(min);
    const maxCommitment = await computeCommitment(max);

    // Generate membership proof
    const membershipProof = await this.generateMembershipProof(
      value,
      min,
      max,
      inclusive
    );

    // Create proof data
    const proofData: RangeProofData = {
      valueCommitment,
      rangeCommitments: {
        min: minCommitment,
        max: maxCommitment,
      },
      membershipProof,
      metadata: {
        rangeSize: max - min,
        securityLevel: "HIGH",
      },
    };

    // Create statement
    const statement: ZKPStatement = {
      statementId: generateStatementId("RANGE"),
      type: "RANGE",
      publicInputs,
      claim: claim.description,
      constraints,
    };

    // Create witness
    const witness: ZKPWitness = {
      witnessId: generateWitnessId(),
      privateInputs,
      commitments: {
        value: valueCommitment,
      },
    };

    // Generate proof
    return this.generator.generate("RANGE", statement, witness, proofData);
  }

  /**
   * Validate range proof inputs
   */
  private validateInputs(
    value: number,
    min: number,
    max: number,
    inclusive: boolean
  ): void {
    if (!Number.isFinite(value)) {
      throw new Error("Value must be a finite number");
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error("Range bounds must be finite numbers");
    }

    if (min >= max) {
      throw new Error("Min must be less than max");
    }

    if (
      Math.abs(min) > RANGE_PROOF_CONSTANTS.MAX_RANGE_VALUE ||
      Math.abs(max) > RANGE_PROOF_CONSTANTS.MAX_RANGE_VALUE
    ) {
      throw new Error("Range bounds exceed maximum allowed value");
    }

    const rangeSize = max - min;
    if (rangeSize > RANGE_PROOF_CONSTANTS.MAX_RANGE_SIZE) {
      throw new Error("Range size exceeds maximum allowed");
    }
  }

  /**
   * Build constraints for range proof
   */
  private buildConstraints(
    min: number,
    max: number,
    inclusive: boolean
  ): string[] {
    const constraints: string[] = [];

    if (inclusive) {
      constraints.push(`value >= ${min}`);
      constraints.push(`value <= ${max}`);
    } else {
      constraints.push(`value > ${min}`);
      constraints.push(`value < ${max}`);
    }

    return constraints;
  }

  /**
   * Generate membership proof
   */
  private async generateMembershipProof(
    value: number,
    min: number,
    max: number,
    inclusive: boolean
  ): Promise<{ hash: string; bytes: string }> {
    const data = JSON.stringify({ value, min, max, inclusive });
    const hash = await hashToField(data);

    return {
      hash: hash.hex,
      bytes: btoa(data),
    };
  }
}

// ============================================================================
// RANGE PROOF VERIFIER
// ============================================================================

/**
 * Range Proof Verifier
 *
 * Verifies zero knowledge range proofs.
 */
export class RangeProofVerifier {
  private verifier: ProofVerifier;

  constructor(config?: { strictMode?: boolean }) {
    this.verifier = new ProofVerifier({
      strictMode: config?.strictMode || false,
      verifyCommitments: true,
    });
  }

  /**
   * Verify a range proof
   *
   * @param proof - Range proof to verify
   * @returns Verification result
   */
  async verify(proof: ZKPProof<RangeProofData>): Promise<{
    valid: boolean;
    inRange: boolean;
    reason?: string;
  }> {
    try {
      // Verify the ZKP
      const zkpResult = await this.verifier.verify(proof);

      if (!zkpResult.valid) {
        return {
          valid: false,
          inRange: false,
          reason: zkpResult.error,
        };
      }

      // Extract proof data
      const proofData = proof.proofData;
      const publicInputs = proof.statement
        .publicInputs as RangeProofPublicInputs;

      // Verify membership proof
      const membershipValid = await this.verifyMembershipProof(
        proofData,
        publicInputs
      );

      if (!membershipValid) {
        return {
          valid: false,
          inRange: false,
          reason: "Invalid membership proof",
        };
      }

      return {
        valid: true,
        inRange: true,
      };
    } catch (error) {
      return {
        valid: false,
        inRange: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verify membership proof
   */
  private async verifyMembershipProof(
    proofData: RangeProofData,
    publicInputs: RangeProofPublicInputs
  ): Promise<boolean> {
    const { min, max, inclusive } = publicInputs;

    const data = JSON.stringify({ min, max, inclusive });
    const hash = await hashToField(data);

    return hash.hex === proofData.membershipProof.hash;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate random blinding factor
 */
function generateBlindingFactor(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a range proof (convenience function)
 *
 * @param value - Secret value
 * @param min - Minimum of range
 * @param max - Maximum of range
 * @param inclusive - Whether range is inclusive
 * @returns Range proof
 */
export async function generateRangeProof(
  value: number,
  min: number,
  max: number,
  inclusive: boolean = true
): Promise<ZKPProof<RangeProofData>> {
  const generator = new RangeProof();
  return generator.generate({ value, min, max, inclusive });
}

/**
 * Verify a range proof (convenience function)
 *
 * @param proof - Range proof to verify
 * @returns Verification result
 */
export async function verifyRangeProof(
  proof: ZKPProof<RangeProofData>
): Promise<{ valid: boolean; inRange: boolean; reason?: string }> {
  const verifier = new RangeProofVerifier();
  return verifier.verify(proof);
}

/**
 * Prove age is within range (common use case)
 *
 * @param age - Actual age (secret)
 * @param minAge - Minimum age to prove
 * @param maxAge - Maximum age to prove
 * @returns Range proof for age
 */
export async function proveAgeRange(
  age: number,
  minAge: number = 18,
  maxAge: number = 120
): Promise<ZKPProof<RangeProofData>> {
  return generateRangeProof(age, minAge, maxAge, true);
}

/**
 * Prove score is within range (common use case)
 *
 * @param score - Actual score (secret)
 * @param passingScore - Minimum passing score
 * @param maxScore - Maximum possible score
 * @returns Range proof for score
 */
export async function proveScoreRange(
  score: number,
  passingScore: number,
  maxScore: number = 100
): Promise<ZKPProof<RangeProofData>> {
  return generateRangeProof(score, passingScore, maxScore, true);
}
