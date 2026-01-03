/**
 * @fileoverview Core types for Zero Knowledge Proof system
 *
 * Defines all fundamental types used across the ZKP implementation,
 * including proofs, statements, witnesses, and verification results.
 */

// Local type definition to avoid circular dependency
export type BrandedId<T extends string> = string & { readonly __brand: T };

// ============================================================================
// PROOF TYPE ENUMERATION
// ============================================================================

/**
 * Supported ZKP proof types
 *
 * Each proof type serves a different privacy verification scenario:
 * - ROUTING: Prove routing decision was made correctly
 * - RANGE: Prove a value is within a specific range
 * - MEMBERSHIP: Prove an element is in a set
 * - COMPUTATION: Prove arbitrary computation correctness
 * - EQUALITY: Prove two values are equal
 * - DISJUNCTION: Prove at least one of multiple statements is true
 * - CONJUNCTION: Prove all statements are true
 */
export type ZKPProofType =
  | "ROUTING" // Routing decision correctness
  | "RANGE" // Value in range proof
  | "MEMBERSHIP" // Set membership proof
  | "COMPUTATION" // General computation proof
  | "EQUALITY" // Equality proof
  | "DISJUNCTION" // OR-proof
  | "CONJUNCTION" // AND-proof;

/**
 * Security levels for ZKP
 *
 * Higher security = larger proofs, more computation time
 * - LOW: 80-bit security (fast, suitable for non-critical)
 * - MEDIUM: 112-bit security (balanced)
 * - HIGH: 128-bit security (recommended)
 * - VERY_HIGH: 256-bit security (maximum security)
 */
export type ZKPSecurityLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

/**
 * Proof generator configuration
 */
export interface ProofGeneratorConfig {
  /** Security level for proof generation */
  securityLevel?: ZKPSecurityLevel;
  /** Hash function to use */
  hashFunction?: HashFunctionType;
  /** Include metadata in proofs */
  includeMetadata?: boolean;
  /** Compress proof output */
  compressProof?: boolean;
  /** Generation timeout in milliseconds */
  timeout?: number;
  /** Maximum proof age in milliseconds */
  maxProofAgeMs?: number;
  /** Prover identifier */
  proverId?: string;
}

/**
 * Proof verifier configuration
 */
export interface ProofVerifierConfig {
  /** Enable result caching */
  enableCaching?: boolean;
  /** Enable batch verification */
  enableBatchVerification?: boolean;
  /** Verify commitments */
  verifyCommitments?: boolean;
  /** Check proof expiration */
  checkExpiration?: boolean;
  /** Strict mode (all constraints must be verifiable) */
  strictMode?: boolean;
  /** Verification timeout in milliseconds */
  timeout?: number;
  /** Maximum proof age in milliseconds */
  maxProofAgeMs?: number;
  /** Hash function to use */
  hashFunction?: HashFunctionType;
}

/**
 * Hash function types supported
 */
export type HashFunctionType = "SHA256" | "SHA384" | "SHA512" | "BLAKE2B" | "BLAKE3";

// ============================================================================
// CORE ZKP TYPES
// ============================================================================

/**
 * Zero Knowledge Proof configuration
 *
 * Configures the ZKP system with security parameters and algorithm choices.
 */
export interface ZKPConfig {
  /** Security level (determines proof size and computation time) */
  securityLevel: ZKPSecurityLevel;
  /** Hash function to use for commitments */
  hashFunction: HashFunctionType;
  /** Maximum age of proofs before they're considered stale */
  maxProofAgeMs: number;
  /** Whether to enable proof caching */
  enableProofCaching: boolean;
  /** Curve type for elliptic curve operations */
  curveType: "SECP256K1" | "ED25519" | "BN254" | "BLS12_381";
  /** Challenge length in bytes */
  challengeLength: number;
  /** Enable batch verification (verify multiple proofs at once) */
  enableBatchVerification: boolean;
  /** Timeout for proof generation in milliseconds */
  proofGenerationTimeout: number;
  /** Timeout for proof verification in milliseconds */
  proofVerificationTimeout: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Zero Knowledge Proof
 *
 * The core proof structure containing all necessary information for verification.
 * A ZKP proves that a statement is true without revealing the witness (secret).
 *
 * @template T - Type of proof-specific data
 */
export interface ZKPProof<T = Record<string, unknown>> {
  /** Unique proof identifier */
  proofId: BrandedId<"ZKPProof">;
  /** Proof type discriminator */
  type: ZKPProofType;
  /** Public statement (what is being proven) */
  statement: ZKPStatement;
  /** Cryptographic proof data */
  proofData: T;
  /** Proof metadata */
  metadata: ZKPMetadata;
  /** Proof creation timestamp */
  createdAt: number;
  /** Proof expiration timestamp */
  expiresAt: number;
  /** Version of proof format */
  version: string;
}

/**
 * ZKP Statement (public)
 *
 * The public claim that is being proven. This is visible to verifiers.
 *
 * @example
 * "The routing decision for this query was 'cloud' based on complexity > 0.6"
 */
export interface ZKPStatement {
  /** Statement identifier */
  statementId: string;
  /** Type of statement */
  type: ZKPProofType;
  /** Public inputs (visible to verifier) */
  publicInputs: Record<string, unknown> & { [key: string]: unknown };
  /** Claim being proven (human-readable description) */
  claim: string;
  /** Constraints that the witness must satisfy */
  constraints: string[];
}

/**
 * ZKP Witness (private)
 *
 * The secret information known only to the prover. The verifier never sees this.
 *
 * @example
 * The actual query text, complexity score, and routing decision parameters
 */
export interface ZKPWitness {
  /** Witness identifier */
  witnessId: string;
  /** Private inputs (NOT shared with verifier) */
  privateInputs: Record<string, unknown>;
  /** Hash commitments to private inputs (can be shared) */
  commitments: Record<string, Commitment>;
}

/**
 * ZKP Metadata
 *
 * Additional information about the proof that doesn't affect its validity.
 */
export interface ZKPMetadata {
  /** Prover identifier */
  proverId?: string;
  /** Verifier identifier (if known) */
  verifierId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Request/transaction identifier */
  requestId?: string;
  /** Proof generation duration in milliseconds */
  generationTimeMs?: number;
  /** Proof size in bytes */
  proofSizeBytes?: number;
  /** Number of circuit constraints */
  constraintCount?: number;
  /** Security level used */
  securityLevel: ZKPSecurityLevel;
  /** Additional custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * ZKP Verification Result
 *
 * Result of verifying a ZKP, including whether it's valid and metadata.
 */
export interface ZKPVerificationResult {
  /** Whether the proof is valid */
  valid: boolean;
  /** Verification result identifier */
  verificationId: string;
  /** Proof being verified */
  proofId: BrandedId<"ZKPProof">;
  /** Verification timestamp */
  verifiedAt: number;
  /** Verification duration in milliseconds */
  verificationTimeMs: number;
  /** Security level verified */
  securityLevel: ZKPSecurityLevel;
  /** Verification error (if invalid) */
  error?: string;
  /** Additional metadata */
  metadata?: {
    /** Proof age at verification time */
    proofAgeMs: number;
    /** Whether proof was expired */
    expired: boolean;
    /** Whether proof was cached */
    fromCache: boolean;
    /** Number of constraints verified */
    constraintsChecked: number;
  };
}

// ============================================================================
// COMMITMENT SCHEME TYPES
// ============================================================================

/**
 * Cryptographic commitment
 *
 * A commitment allows a prover to commit to a value without revealing it,
 * and later open the commitment to reveal the value.
 */
export interface Commitment {
  /** Commitment value (hash) */
  value: string;
  /** Commitment identifier */
  commitmentId: string;
  /** Timestamp of commitment */
  timestamp: number;
  /** Randomness used for commitment (blinding factor) */
  randomness?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Opening of a commitment
 *
 * Reveals the original value and randomness to verify a commitment.
 */
export interface Opening {
  /** Original value that was committed */
  value: unknown;
  /** Randomness used in commitment */
  randomness: string;
  /** Commitment being opened */
  commitment: Commitment;
}

// ============================================================================
// CHALLENGE-RESPONSE TYPES
// ============================================================================

/**
 * Proof challenge
 *
 * Random challenge sent from verifier to prover during interactive proof.
 */
export interface ProofChallenge {
  /** Challenge identifier */
  challengeId: string;
  /** Challenge value (random bytes) */
  value: string;
  /** Challenge length in bytes */
  length: number;
  /** Timestamp of challenge */
  timestamp: number;
}

/**
 * Proof response
 *
 * Prover's response to a challenge, containing the proof data.
 */
export interface ProofResponse {
  /** Response identifier */
  responseId: string;
  /** Challenge being responded to */
  challengeId: string;
  /** Response data */
  data: Record<string, unknown>;
  /** Response timestamp */
  timestamp: number;
}

// ============================================================================
// HASH TYPES
// ============================================================================

/**
 * Hash function interface
 */
export interface HashFunction {
  /** Hash algorithm name */
  name: HashFunctionType;
  /** Output length in bytes */
  outputLength: number;
  /** Hash the input and return output */
  hash(input: HashInput): Promise<HashOutput>;
}

/**
 * Hash input
 */
export type HashInput = string | ArrayBuffer | Uint8Array;

/**
 * Hash output
 */
export interface HashOutput {
  /** Hash value as hex string */
  hex: string;
  /** Hash value as bytes */
  bytes: Uint8Array;
  /** Hash algorithm used */
  algorithm: HashFunctionType;
}

// ============================================================================
// ARITHMETIC CIRCUIT TYPES
// ============================================================================

/**
 * Arithmetic circuit for ZKP
 *
 * Circuits express computations as polynomial constraints over finite fields.
 * Each constraint is a linear combination of wire assignments.
 */
export interface ArithmeticCircuit {
  /** Circuit identifier */
  circuitId: string;
  /** Number of input wires */
  inputCount: number;
  /** Number of output wires */
  outputCount: number;
  /** Number of intermediate wires */
  wireCount: number;
  /** Circuit constraints */
  constraints: CircuitConstraint[];
  /** Circuit description */
  description?: string;
}

/**
 * Circuit constraint
 *
 * Each constraint is of the form: a * b + c = 0
 * where a, b, c are linear combinations of wire assignments.
 */
export interface CircuitConstraint {
  /** Constraint index */
  index: number;
  /** Left linear combination */
  a: number[];
  /** Right linear combination */
  b: number[];
  /** Output linear combination */
  c: number[];
  /** Constraint description */
  description?: string;
}

/**
 * Wire assignment
 *
 * Values assigned to circuit wires (inputs, outputs, intermediates).
 */
export interface WireAssignment {
  /** Wire identifier */
  wireId: string;
  /** Wire value */
  value: bigint;
  /** Wire type */
  type: "input" | "output" | "intermediate";
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Base ZKP error
 */
export class ZKPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ZKPError";
  }
}

/**
 * ZKP generation error
 *
 * Thrown when proof generation fails.
 */
export class ZKPGenerationError extends ZKPError {
  constructor(
    message: string,
    public proofType: ZKPProofType,
    details?: Record<string, unknown>
  ) {
    super(message, "ZKP_GENERATION_ERROR", details);
    this.name = "ZKPGenerationError";
  }
}

/**
 * ZKP verification error
 *
 * Thrown when proof verification fails.
 */
export class ZKPVerificationError extends ZKPError {
  constructor(
    message: string,
    public proofId: string,
    details?: Record<string, unknown>
  ) {
    super(message, "ZKP_VERIFICATION_ERROR", details);
    this.name = "ZKPVerificationError";
  }
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is a ZKP proof
 */
export function isZKPProof(obj: unknown): obj is ZKPProof {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "proofId" in obj &&
    "type" in obj &&
    "statement" in obj &&
    "proofData" in obj &&
    "createdAt" in obj
  );
}

/**
 * Check if a value is a ZKP statement
 */
export function isZKPStatement(obj: unknown): obj is ZKPStatement {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "statementId" in obj &&
    "type" in obj &&
    "publicInputs" in obj &&
    "claim" in obj
  );
}

/**
 * Check if a value is a ZKP witness
 */
export function isZKPWitness(obj: unknown): obj is ZKPWitness {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "witnessId" in obj &&
    "privateInputs" in obj &&
    "commitments" in obj
  );
}

/**
 * Check if a value is a verification result
 */
export function isZKPVerificationResult(obj: unknown): obj is ZKPVerificationResult {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "valid" in obj &&
    "verificationId" in obj &&
    "proofId" in obj &&
    "verifiedAt" in obj
  );
}

/**
 * Check if a value is a commitment
 */
export function isCommitment(obj: unknown): obj is Commitment {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "value" in obj &&
    "commitmentId" in obj &&
    "timestamp" in obj
  );
}
