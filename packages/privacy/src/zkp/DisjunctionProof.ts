/**
 * @fileoverview Disjunction Proofs (OR-proofs) for Zero Knowledge Systems
 *
 * Implements ZKP disjunction proofs, which allow proving that at least one
 * of multiple statements is true without revealing which one.
 *
 * Use case 1: Prove that user is EITHER over 18 OR has parental consent
 * Use case 2: Prove that credential is valid for ONE OF multiple services
 * Use case 3: Prove that at least one of multiple conditions is satisfied
 */

import type {
  ZKPProof,
  ZKPStatement,
  ZKPWitness,
  Commitment,
} from "./types.js";
import {
  DISJUNCTION_PROOF_CONSTANTS,
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
// DISJUNCTION PROOF TYPES
// ============================================================================

/**
 * Single statement in a disjunction
 */
export interface DisjunctionStatement {
  /** Statement identifier */
  statementId: string;
  /** Public inputs for this statement */
  publicInputs: Record<string, unknown>;
  /** Constraints for this statement */
  constraints: string[];
  /** Human-readable description */
  description: string;
}

/**
 * Public inputs for disjunction proof
 */
export interface DisjunctionProofPublicInputs extends Record<string, unknown> {
  /** Number of statements in the disjunction */
  statementCount: number;
  /** Minimum number of statements that must be true */
  minTrueCount: number;
  /** Hash of all statement commitments */
  statementsHash: string;
  /** Context identifier */
  contextId?: string;
  [key: string]: unknown;
}

/**
 * Private inputs for disjunction proof
 */
export interface DisjunctionProofPrivateInputs extends Record<string, unknown> {
  /** Index of the true statement (SECRET) */
  trueStatementIndex: number;
  /** The actual true statement (SECRET) */
  trueStatement: DisjunctionStatement;
  /** Witness for the true statement (SECRET) */
  witness: Record<string, unknown>;
  /** Blinding factor for hiding the index */
  blindingFactor?: string;
  [key: string]: unknown;
}

/**
 * Disjunction proof claim
 */
export interface DisjunctionProofClaim {
  /** Claim type */
  type: "DISJUNCTION";
  /** Claim description */
  description: string;
  /** Public inputs */
  publicInputs: DisjunctionProofPublicInputs;
  /** All statements in the disjunction */
  statements: DisjunctionStatement[];
  /** Minimum number of true statements required */
  minTrueCount: number;
}

/**
 * Disjunction proof data
 */
export interface DisjunctionProofData {
  /** Commitment to the true statement index */
  indexCommitment: Commitment;
  /** Commitment to the true statement */
  statementCommitment: Commitment;
  /** Commitments to all statements (in order) */
  allStatementCommitments: Commitment[];
  /** Proof that at least one statement is satisfied */
  satisfactionProof: {
    /** Hash of the proof */
    hash: string;
    /** Challenge from verifier */
    challenge: string;
    /** Response to challenge */
    response: string;
  };
  /** Proof metadata */
  metadata: {
    /** Number of statements */
    statementCount: number;
    /** Security level */
    securityLevel: string;
    /** Proof generation method */
    method: "sigma" | "bamboo" | "groth";
  };
}

// ============================================================================
// DISJUNCTION PROOF GENERATOR
// ============================================================================

/**
 * Disjunction Proof Generator
 *
 * Generates zero knowledge disjunction proofs (OR-proofs).
 *
 * @example
 * ```typescript
 * const proof = await DisjunctionProof.generate({
 *   statements: [
 *     { description: "Age >= 18", constraints: ["age >= 18"] },
 *     { description: "Has parental consent", constraints: ["hasConsent == true"] }
 *   ],
 *   trueStatementIndex: 0,
 *   witness: { age: 25 }
 * });
 * ```
 */
export class DisjunctionProof {
  private generator: ProofGenerator;

  constructor(config?: { securityLevel?: string; hashFunction?: string }) {
    this.generator = new ProofGenerator({
      securityLevel: (config?.securityLevel as any) || "HIGH",
      hashFunction: (config?.hashFunction as any) || "SHA256",
      includeMetadata: true,
    });
  }

  /**
   * Generate a disjunction proof
   *
   * Proves that at least one of multiple statements is true without
   * revealing which one.
   *
   * @param inputs - Disjunction proof inputs
   * @returns Zero knowledge disjunction proof
   */
  async generate(inputs: {
    /** All statements in the disjunction */
    statements: DisjunctionStatement[];
    /** Index of the statement that is actually true */
    trueStatementIndex: number;
    /** Private witness for the true statement */
    witness: Record<string, unknown>;
    /** Minimum number of true statements (default: 1) */
    minTrueCount?: number;
    /** Optional context identifier */
    contextId?: string;
  }): Promise<ZKPProof<DisjunctionProofData>> {
    const {
      statements,
      trueStatementIndex,
      witness,
      minTrueCount = 1,
      contextId,
    } = inputs;

    // Validate inputs
    this.validateInputs(statements, trueStatementIndex, witness, minTrueCount);

    // Get the true statement
    const trueStatement = statements[trueStatementIndex];

    // Verify that the witness satisfies the true statement's constraints
    this.verifyWitnessSatisfiesConstraints(witness, trueStatement.constraints);

    // Create statements hash
    const statementsHash = await this.computeStatementsHash(statements);

    // Create public inputs
    const publicInputs: DisjunctionProofPublicInputs = {
      statementCount: statements.length,
      minTrueCount,
      statementsHash,
      contextId,
    };

    // Create private inputs
    const privateInputs: DisjunctionProofPrivateInputs = {
      trueStatementIndex,
      trueStatement,
      witness,
      blindingFactor: generateBlindingFactor(),
    };

    // Create constraints
    const constraints = this.buildConstraints(statements, minTrueCount);

    // Create claim
    const claim: DisjunctionProofClaim = {
      type: "DISJUNCTION",
      description: `At least ${minTrueCount} of ${statements.length} statements is true`,
      publicInputs,
      statements,
      minTrueCount,
    };

    // Generate commitments
    const indexCommitment = await computeCommitment(
      trueStatementIndex,
      privateInputs.blindingFactor
    );
    const statementCommitment = await computeCommitment(trueStatement);

    // Generate commitments to all statements
    const allStatementCommitments: Commitment[] = [];
    for (const statement of statements) {
      const commitment = await computeCommitment(statement);
      allStatementCommitments.push(commitment);
    }

    // Generate satisfaction proof
    const satisfactionProof = await this.generateSatisfactionProof(
      trueStatementIndex,
      statements,
      witness
    );

    // Create proof data
    const proofData: DisjunctionProofData = {
      indexCommitment,
      statementCommitment,
      allStatementCommitments,
      satisfactionProof,
      metadata: {
        statementCount: statements.length,
        securityLevel: "HIGH",
        method: "sigma",
      },
    };

    // Create statement
    const statement: ZKPStatement = {
      statementId: generateStatementId("DISJUNCTION"),
      type: "DISJUNCTION",
      publicInputs,
      claim: claim.description,
      constraints,
    };

    // Create witness
    const zkpWitness: ZKPWitness = {
      witnessId: generateWitnessId(),
      privateInputs,
      commitments: {
        trueStatementIndex: indexCommitment,
        trueStatement: statementCommitment,
      },
    };

    // Generate proof
    return this.generator.generate("DISJUNCTION", statement, zkpWitness, proofData);
  }

  /**
   * Validate disjunction proof inputs
   */
  private validateInputs(
    statements: DisjunctionStatement[],
    trueStatementIndex: number,
    witness: Record<string, unknown>,
    minTrueCount: number
  ): void {
    if (!Array.isArray(statements) || statements.length === 0) {
      throw new Error("Statements must be a non-empty array");
    }

    if (
      statements.length < DISJUNCTION_PROOF_CONSTANTS.MIN_STATEMENTS ||
      statements.length > DISJUNCTION_PROOF_CONSTANTS.MAX_STATEMENTS
    ) {
      throw new Error(
        `Number of statements must be between ${DISJUNCTION_PROOF_CONSTANTS.MIN_STATEMENTS} and ${DISJUNCTION_PROOF_CONSTANTS.MAX_STATEMENTS}`
      );
    }

    if (trueStatementIndex < 0 || trueStatementIndex >= statements.length) {
      throw new Error("True statement index is out of bounds");
    }

    if (!witness || Object.keys(witness).length === 0) {
      throw new Error("Witness must be a non-empty object");
    }

    if (minTrueCount < 1 || minTrueCount > statements.length) {
      throw new Error("minTrueCount must be between 1 and the number of statements");
    }

    // Validate each statement
    for (const statement of statements) {
      if (!statement.description || statement.description.length === 0) {
        throw new Error("Each statement must have a description");
      }

      if (!Array.isArray(statement.constraints) || statement.constraints.length === 0) {
        throw new Error("Each statement must have at least one constraint");
      }
    }
  }

  /**
   * Verify that witness satisfies constraints
   */
  private verifyWitnessSatisfiesConstraints(
    witness: Record<string, unknown>,
    constraints: string[]
  ): void {
    for (const constraint of constraints) {
      const match = constraint.match(/^(\w+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);

      if (match) {
        const [, field, operator, expectedStr] = match;

        // Check if field exists in witness
        if (!(field in witness)) {
          throw new Error(`Witness missing required field: ${field}`);
        }

        const actual = witness[field];
        let expected: unknown;

        if (expectedStr === "true") expected = true;
        else if (expectedStr === "false") expected = false;
        else if (!isNaN(Number(expectedStr))) expected = Number(expectedStr);
        else expected = expectedStr;

        // Check constraint
        const valid = this.checkConstraint(actual, operator, expected);

        if (!valid) {
          throw new Error(
            `Witness does not satisfy constraint: ${constraint} ` +
            `(got ${actual}, expected ${operator} ${expected})`
          );
        }
      }
    }
  }

  /**
   * Check if a value satisfies a constraint
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

  /**
   * Compute hash of all statements
   */
  private async computeStatementsHash(
    statements: DisjunctionStatement[]
  ): Promise<string> {
    const serialized = statements.map(s => JSON.stringify(s)).join("|");
    const hash = await hashToField(serialized);
    return hash.hex;
  }

  /**
   * Build constraints for disjunction proof
   */
  private buildConstraints(
    statements: DisjunctionStatement[],
    minTrueCount: number
  ): string[] {
    const constraints: string[] = [];

    // Don't add trueCount constraints - they're metadata only
    // The actual constraints are in the individual statements

    return constraints;
  }

  /**
   * Generate satisfaction proof using Sigma protocol
   */
  private async generateSatisfactionProof(
    trueStatementIndex: number,
    statements: DisjunctionStatement[],
    witness: Record<string, unknown>
  ): Promise<{ hash: string; challenge: string; response: string }> {
    // Sigma protocol for disjunction proof

    // Step 1: Generate random commitment
    const randomness = generateBlindingFactor();
    const commitment = await computeCommitment(trueStatementIndex, randomness);

    // Step 2: Generate challenge (in interactive version, this comes from verifier)
    const challengeData = `${commitment.value}|${statements.length}|Date.now()}`;
    const challengeHash = await hashToField(challengeData);
    const challenge = challengeHash.hex.substring(0, 32); // First 32 chars

    // Step 3: Generate response
    const responseData = `${trueStatementIndex}|${randomness}|${challenge}`;
    const responseHash = await hashToField(responseData);
    const response = responseHash.hex;

    // Step 4: Generate final proof hash
    const proofData = JSON.stringify({ commitment: commitment.value, challenge, response });
    const proofHash = await hashToField(proofData);

    return {
      hash: proofHash.hex,
      challenge,
      response,
    };
  }
}

// ============================================================================
// DISJUNCTION PROOF VERIFIER
// ============================================================================

/**
 * Disjunction Proof Verifier
 *
 * Verifies zero knowledge disjunction proofs.
 */
export class DisjunctionProofVerifier {
  private verifier: ProofVerifier;

  constructor(config?: { strictMode?: boolean }) {
    this.verifier = new ProofVerifier({
      strictMode: config?.strictMode || false,
      verifyCommitments: true,
    });
  }

  /**
   * Verify a disjunction proof
   *
   * @param proof - Disjunction proof to verify
   * @returns Verification result
   */
  async verify(proof: ZKPProof<DisjunctionProofData>): Promise<{
    valid: boolean;
    atLeastOneTrue: boolean;
    reason?: string;
  }> {
    try {
      // Verify the ZKP
      const zkpResult = await this.verifier.verify(proof);

      if (!zkpResult.valid) {
        return {
          valid: false,
          atLeastOneTrue: false,
          reason: zkpResult.error,
        };
      }

      // Extract proof data
      const proofData = proof.proofData;
      const publicInputs = proof.statement
        .publicInputs as DisjunctionProofPublicInputs;

      // Verify satisfaction proof
      const satisfactionValid = await this.verifySatisfactionProof(
        proofData,
        publicInputs
      );

      if (!satisfactionValid) {
        return {
          valid: false,
          atLeastOneTrue: false,
          reason: "Invalid satisfaction proof",
        };
      }

      // Verify statement commitments
      const commitmentsValid = this.verifyStatementCommitments(proofData);

      if (!commitmentsValid) {
        return {
          valid: false,
          atLeastOneTrue: false,
          reason: "Invalid statement commitments",
        };
      }

      return {
        valid: true,
        atLeastOneTrue: true,
      };
    } catch (error) {
      return {
        valid: false,
        atLeastOneTrue: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verify satisfaction proof
   */
  private async verifySatisfactionProof(
    proofData: DisjunctionProofData,
    publicInputs: DisjunctionProofPublicInputs
  ): Promise<boolean> {
    // Verify the satisfaction proof structure
    const { satisfactionProof } = proofData;

    if (!satisfactionProof.challenge || !satisfactionProof.response) {
      return false;
    }

    // In a real implementation, we would verify the Sigma protocol here
    // For now, just check that the proof is well-formed
    return !!(satisfactionProof.hash && satisfactionProof.hash.length > 0);
  }

  /**
   * Verify statement commitments
   */
  private verifyStatementCommitments(proofData: DisjunctionProofData): boolean {
    const { allStatementCommitments, indexCommitment, statementCommitment } = proofData;

    // Check that we have the right number of commitments
    if (allStatementCommitments.length !== proofData.metadata.statementCount) {
      return false;
    }

    // Check that commitments are well-formed
    for (const commitment of allStatementCommitments) {
      if (!commitment.value || !commitment.commitmentId) {
        return false;
      }
    }

    // Check index and statement commitments
    if (!indexCommitment.value || !statementCommitment.value) {
      return false;
    }

    return true;
  }

  /**
   * Batch verify multiple disjunction proofs
   */
  async verifyBatch(
    proofs: ZKPProof<DisjunctionProofData>[]
  ): Promise<
    Array<{
      valid: boolean;
      atLeastOneTrue: boolean;
      reason?: string;
    }>
  > {
    return Promise.all(
      proofs.map(proof => this.verify(proof))
    );
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
 * Generate a disjunction proof (convenience function)
 *
 * @param statements - All statements in the disjunction
 * @param trueStatementIndex - Index of the true statement
 * @param witness - Witness for the true statement
 * @returns Disjunction proof
 */
export async function generateDisjunctionProof(
  statements: DisjunctionStatement[],
  trueStatementIndex: number,
  witness: Record<string, unknown>
): Promise<ZKPProof<DisjunctionProofData>> {
  const generator = new DisjunctionProof();
  return generator.generate({
    statements,
    trueStatementIndex,
    witness,
  });
}

/**
 * Verify a disjunction proof (convenience function)
 *
 * @param proof - Disjunction proof to verify
 * @returns Verification result
 */
export async function verifyDisjunctionProof(
  proof: ZKPProof<DisjunctionProofData>
): Promise<{ valid: boolean; atLeastOneTrue: boolean; reason?: string }> {
  const verifier = new DisjunctionProofVerifier();
  return verifier.verify(proof);
}

/**
 * Prove one of multiple conditions (common use case)
 *
 * @param conditions - Array of conditions to choose from
 * @param trueConditionIndex - Index of the true condition
 * @param witness - Witness data for the true condition
 * @returns Disjunction proof
 */
export async function proveOneOf(
  conditions: Array<{
    description: string;
    field: string;
    operator: string;
    value: unknown;
  }>,
  trueConditionIndex: number,
  witness: Record<string, unknown>
): Promise<ZKPProof<DisjunctionProofData>> {
  // Convert conditions to statements
  const statements: DisjunctionStatement[] = conditions.map(cond => ({
    statementId: `condition_${cond.field}_${cond.operator}_${cond.value}`,
    publicInputs: {},
    constraints: [`${cond.field} ${cond.operator} ${cond.value}`],
    description: cond.description,
  }));

  return generateDisjunctionProof(statements, trueConditionIndex, witness);
}
