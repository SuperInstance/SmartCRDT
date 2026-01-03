/**
 * @fileoverview Zero Knowledge Proof Generator
 *
 * Handles the generation of various types of zero knowledge proofs,
 * including routing proofs, range proofs, and set membership proofs.
 */

import type {
  ZKPProof,
  ZKPStatement,
  ZKPWitness,
  ZKPProofType,
  ProofGeneratorConfig,
  Commitment,
} from "./types.js";
import {
  DEFAULT_ZKP_CONFIG,
  ZKP_ERROR_CODES,
} from "./constants.js";
import {
  computeCommitment,
  hashToField,
  generateProofId,
  generateStatementId,
  generateWitnessId,
  measureTime,
} from "./utils.js";
import { ZKPGenerationError } from "./types.js";

// ============================================================================
// DEFAULT GENERATOR CONFIG
// ============================================================================

const DEFAULT_GENERATOR_CONFIG: ProofGeneratorConfig = {
  securityLevel: "HIGH",
  hashFunction: "SHA256",
  includeMetadata: true,
  compressProof: false,
  timeout: 30000,
};

// ============================================================================
// PROOF GENERATOR CLASS
// ============================================================================

/**
 * Zero Knowledge Proof Generator
 *
 * Generates various types of ZK proofs while maintaining privacy of
 * the witness (secret inputs).
 *
 * @example
 * ```typescript
 * const generator = new ProofGenerator();
 * const proof = await generator.generate({
 *   type: "ROUTING",
 *   statement: { ... },
 *   witness: { ... }
 * });
 * ```
 */
export class ProofGenerator {
  private config: ProofGeneratorConfig;
  private proofCount: number;

  constructor(config: Partial<ProofGeneratorConfig> = {}) {
    this.config = { ...DEFAULT_GENERATOR_CONFIG, ...config };
    this.proofCount = 0;
  }

  // ========================================================================
  // MAIN GENERATION METHOD
  // ========================================================================

  /**
   * Generate a zero knowledge proof
   *
   * @param type - Proof type to generate
   * @param statement - Public statement being proven
   * @param witness - Private witness data
   * @param customData - Custom proof data
   * @returns Generated proof
   */
  async generate<T = Record<string, unknown>>(
    type: ZKPProofType,
    statement: ZKPStatement,
    witness: ZKPWitness,
    customData?: T
  ): Promise<ZKPProof<T>> {
    const startTime = performance.now();

    // Validate inputs
    this.validateInputs(type, statement, witness);

    // Generate commitments to witness values
    const commitments = await this.generateCommitments(
      witness.privateInputs
    );

    // Create proof data
    const proofData: T = {
      ...customData,
      commitments,
      witnessCommitments: witness.commitments,
    } as T;

    // Calculate duration
    const durationMs = performance.now() - startTime;

    // Create proof
    const proof: ZKPProof<T> = {
      proofId: generateProofId(),
      type,
      statement,
      proofData,
      metadata: {
        proverId: this.config.proverId,
        securityLevel: this.config.securityLevel ?? "HIGH",
        generationTimeMs: durationMs,
        proofSizeBytes: 0, // Will be calculated
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + (this.config.maxProofAgeMs ?? 3600000),
      version: "1.0.0",
    };

    // Calculate proof size
    proof.metadata.proofSizeBytes = JSON.stringify(proof).length;

    this.proofCount++;

    return proof;
  }

  // ========================================================================
  // COMMITMENT GENERATION
  // ========================================================================

  /**
   * Generate commitments to witness values
   *
   * Creates cryptographic commitments to each private input, allowing
   * the prover to later reveal them without the ability to change them.
   *
   * @param privateInputs - Private witness inputs
   * @returns Map of field to commitment
   */
  async generateCommitments(
    privateInputs: Record<string, unknown>
  ): Promise<Record<string, Commitment>> {
    const commitments: Record<string, Commitment> = {};

    for (const [key, value] of Object.entries(privateInputs)) {
      commitments[key] = await computeCommitment(
        value,
        undefined, // Generate new randomness
        this.config.hashFunction
      );
    }

    return commitments;
  }

  /**
   * Generate a single commitment
   *
   * @param value - Value to commit to
   * @param randomness - Optional randomness (generated if not provided)
   * @returns Commitment
   */
  async generateCommitment(
    value: unknown,
    randomness?: string
  ): Promise<Commitment> {
    return computeCommitment(value, randomness, this.config.hashFunction);
  }

  // ========================================================================
  // WITNESS CREATION
  // ========================================================================

  /**
   * Create a witness from private inputs
   *
   * @param privateInputs - Private input values
   * @param commitments - Optional pre-computed commitments
   * @returns Witness object
   */
  async createWitness(
    privateInputs: Record<string, unknown>,
    commitments?: Record<string, Commitment>
  ): Promise<ZKPWitness> {
    const witnessCommitments =
      commitments ||
      (await this.generateCommitments(privateInputs));

    return {
      witnessId: generateWitnessId(),
      privateInputs,
      commitments: witnessCommitments,
    };
  }

  // ========================================================================
  // STATEMENT CREATION
  // ========================================================================

  /**
   * Create a statement from public inputs and constraints
   *
   * @param type - Proof type
   * @param claim - Human-readable claim being proven
   * @param publicInputs - Public input values
   * @param constraints - Constraints that must be satisfied
   * @returns Statement object
   */
  createStatement(
    type: ZKPProofType,
    claim: string,
    publicInputs: Record<string, unknown>,
    constraints: string[]
  ): ZKPStatement {
    return {
      statementId: generateStatementId(type),
      type,
      publicInputs,
      claim,
      constraints,
    };
  }

  // ========================================================================
  // VALIDATION
  // ========================================================================

  /**
   * Validate proof generation inputs
   *
   * @param type - Proof type
   * @param statement - Statement to validate
   * @param witness - Witness to validate
   * @throws ZKPGenerationError if inputs are invalid
   */
  private validateInputs(
    type: ZKPProofType,
    statement: ZKPStatement,
    witness: ZKPWitness
  ): void {
    // Validate statement
    if (!statement.statementId) {
      throw new ZKPGenerationError(
        "Statement must have a statementId",
        type,
        { statement }
      );
    }

    if (!statement.claim) {
      throw new ZKPGenerationError(
        "Statement must have a claim",
        type,
        { statement }
      );
    }

    if (!Array.isArray(statement.constraints) || statement.constraints.length === 0) {
      throw new ZKPGenerationError(
        "Statement must have at least one constraint",
        type,
        { statement }
      );
    }

    // Validate witness
    if (!witness.witnessId) {
      throw new ZKPGenerationError(
        "Witness must have a witnessId",
        type,
        { witness }
      );
    }

    if (Object.keys(witness.privateInputs).length === 0) {
      throw new ZKPGenerationError(
        "Witness must have at least one private input",
        type,
        { witness }
      );
    }

    // Validate that witness satisfies statement constraints
    this.validateWitnessConstraints(witness, statement, type);
  }

  /**
   * Validate that witness satisfies statement constraints
   *
   * @param witness - Witness to validate
   * @param statement - Statement with constraints
   * @param type - Proof type
   * @throws ZKPGenerationError if constraints are not satisfied
   */
  private validateWitnessConstraints(
    witness: ZKPWitness,
    statement: ZKPStatement,
    type: ZKPProofType
  ): void {
    // For each constraint, check if witness can satisfy it
    // This is a simplified check - real ZKP would use arithmetic circuits

    for (const constraint of statement.constraints) {
      const match = constraint.match(/^(\w+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);

      if (match) {
        const [, field, operator, expectedStr] = match;

        // Check if field exists in witness
        if (!(field in witness.privateInputs)) {
          throw new ZKPGenerationError(
            `Witness missing required field: ${field}`,
            type,
            { constraint, availableFields: Object.keys(witness.privateInputs) }
          );
        }

        const actual = witness.privateInputs[field];
        let expected: unknown;

        if (expectedStr === "true") expected = true;
        else if (expectedStr === "false") expected = false;
        else if (!isNaN(Number(expectedStr))) expected = Number(expectedStr);
        else expected = expectedStr;

        // Validate constraint
        const valid = this.checkConstraint(actual, operator, expected);

        if (!valid) {
          throw new ZKPGenerationError(
            `Witness does not satisfy constraint: ${constraint}`,
            type,
            { field, actual, operator, expected }
          );
        }
      }
    }
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
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get generator statistics
   *
   * @returns Statistics including proof count and config
   */
  getStats() {
    return {
      proofCount: this.proofCount,
      config: this.config,
    };
  }

  /**
   * Reset generator statistics
   */
  resetStats(): void {
    this.proofCount = 0;
  }

  /**
   * Update configuration
   *
   * @param updates - Configuration updates
   */
  updateConfig(updates: Partial<ProofGeneratorConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   *
   * @returns Current configuration
   */
  getConfig(): ProofGeneratorConfig {
    return { ...this.config };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a proof generator with default configuration
 *
 * @param config - Optional configuration overrides
 * @returns Configured proof generator
 */
export function createProofGenerator(
  config?: Partial<ProofGeneratorConfig>
): ProofGenerator {
  return new ProofGenerator(config);
}

/**
 * Generate a simple commitment proof
 *
 * Useful for proving knowledge of a value without revealing it.
 *
 * @param value - Value to commit to
 * @param hashFn - Hash function to use
 * @returns Commitment
 */
export async function generateCommitmentProof(
  value: unknown,
  hashFn: string = "SHA256"
): Promise<Commitment> {
  return computeCommitment(value, undefined, hashFn);
}

/**
 * Generate a hash commitment (simplified)
 *
 * @param data - Data to hash
 * @param hashFn - Hash function
 * @returns Hash as hex string
 */
export async function generateHashCommitment(
  data: unknown,
  hashFn: string = "SHA256"
): Promise<string> {
  const hash = await hashToField(JSON.stringify(data), hashFn);
  return hash.hex;
}
