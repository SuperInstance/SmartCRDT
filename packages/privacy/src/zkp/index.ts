/**
 * @fileoverview Zero Knowledge Proof System for Aequor Privacy Suite
 *
 * This module provides ZKP (Zero Knowledge Proof) functionality for verifying
 * computations without revealing sensitive data. It implements:
 *
 * 1. Proof Generation - Generate cryptographic proofs of computation correctness
 * 2. Proof Verification - Verify proofs without learning the underlying data
 * 3. Routing Proofs - Prove routing decisions were made correctly
 * 4. Range Proofs - Prove values fall within specific ranges
 * 5. Set Membership Proofs - Prove membership without revealing the element
 *
 * @module @lsi/privacy/zkp
 *
 * @example
 * ```typescript
 * import { ZKPSystem, RouterProofGenerator } from '@lsi/privacy/zkp';
 *
 * // Create ZKP system
 * const zkp = new ZKPSystem();
 *
 * // Generate proof for routing decision
 * const proof = await RouterProofGenerator.generate({
 *   query: "user query",
 *   complexity: 0.75,
 *   route: "cloud",
 *   reason: "high complexity"
 * });
 *
 * // Verify proof without learning the query
 * const valid = await zkp.verify(proof);
 * ```
 */

// Re-export all ZKP components
export { ZKPSystem } from "./ZKPSystem.js";
export { ProofGenerator } from "./ProofGenerator.js";
export { ProofVerifier } from "./ProofVerifier.js";
export {
  RouterProofGenerator,
  RouterProofVerifier,
  generateRoutingProof,
  verifyRoutingProof,
  createRoutingProof,
  type RoutingProofClaim,
  type RoutingProofPublicInputs,
  type RoutingProofPrivateInputs,
} from "./RouterZKP.js";
export {
  RangeProof,
  generateRangeProof,
  verifyRangeProof,
  proveAgeRange,
  proveScoreRange,
  type RangeProofClaim,
  type RangeProofPublicInputs,
  type RangeProofPrivateInputs,
} from "./RangeProof.js";
export {
  SetMembershipProof,
  generateSetMembershipProof,
  verifySetMembershipProof,
  proveEmailOnAllowlist,
  proveCredentialValid,
  proveUserInGroup,
  type SetMembershipClaim,
  type SetMembershipPublicInputs,
  type SetMembershipPrivateInputs,
} from "./SetMembershipProof.js";
export {
  DisjunctionProof,
  DisjunctionProofVerifier,
  generateDisjunctionProof,
  verifyDisjunctionProof,
  proveOneOf,
  type DisjunctionProofClaim,
  type DisjunctionProofPublicInputs,
  type DisjunctionProofPrivateInputs,
  type DisjunctionStatement,
} from "./DisjunctionProof.js";
export {
  ProofAggregator,
  AggregatedProofVerifier,
  aggregateProofs,
  verifyAggregatedProof,
  estimateAggregationSavings,
  type AggregatedProof,
  type AggregatedProofData,
  type AggregationResult,
} from "./ProofAggregation.js";

// Type exports
export type {
  // Core types
  ZKPConfig,
  ZKPProof,
  ZKPStatement,
  ZKPWitness,
  ZKPVerificationResult,
  ZKPMetadata,
  ZKPProofType,
  ZKPSecurityLevel,
  ProofGeneratorConfig,
  ProofVerifierConfig,

  // Common types
  ProofChallenge,
  ProofResponse,
  Commitment,
  Opening,

  // Hash types
  HashFunction,
  HashOutput,
  HashInput,

  // Circuit types
  ArithmeticCircuit,
  CircuitConstraint,
  WireAssignment,

  // Errors
  ZKPError,
  ZKPVerificationError,
  ZKPGenerationError,
} from "./types.js";

// Utilities
export {
  hashToField,
  computeCommitment,
  generateChallenge,
  verifyCommitment,
  serializeProof,
  deserializeProof,
  proofToJson,
  proofFromJson,
  generateProofId,
  validateProofFormat,
  checkProofFreshness,
  DEFAULT_ZKP_CONFIG,
} from "./utils.js";

// Constants
export {
  PROOF_VERSION,
  DEFAULT_SECURITY_LEVEL,
  DEFAULT_HASH_FUNCTION,
  DEFAULT_CHALLENGE_LENGTH,
  MAX_PROOF_AGE_MS,
  SUPPORTED_CURVE_TYPES,
} from "./constants.js";
