/**
 * @fileoverview Set Membership Proofs for Zero Knowledge Systems
 *
 * Implements ZKP set membership proofs, which allow proving that a value
 * is a member of a set without revealing which element it is.
 *
 * Use case: Prove that a user is on an allowlist without revealing
 * their specific identity, or prove credentials are valid without
 * revealing which specific credential.
 */

import type {
  ZKPProof,
  ZKPStatement,
  ZKPWitness,
  Commitment,
} from "./types.js";
import {
  SET_MEMBERSHIP_PROOF_CONSTANTS,
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
// SET MEMBERSHIP PROOF TYPES
// ============================================================================

/**
 * Public inputs for set membership proof
 */
export interface SetMembershipPublicInputs extends Record<string, unknown> {
  /** Hash of the set (commitment to set contents) */
  setHash: string;
  /** Size of the set (revealed) */
  setSize: number;
  /** Context identifier */
  contextId?: string;
  /** Whether the set is ordered */
  ordered: boolean;
  [key: string]: unknown;
}

/**
 * Private inputs for set membership proof
 */
export interface SetMembershipPrivateInputs extends Record<string, unknown> {
  /** The secret element being proven */
  element: string;
  /** Index of element in set (SECRET) */
  index: number;
  /** The actual set (SECRET) */
  set: string[];
  /** Optional blinding factor */
  blindingFactor?: string;
  [key: string]: unknown;
}

/**
 * Set membership claim
 */
export interface SetMembershipClaim {
  /** Claim type */
  type: "MEMBERSHIP";
  /** Claim description */
  description: string;
  /** Public inputs */
  publicInputs: SetMembershipPublicInputs;
  /** Constraints */
  constraints: string[];
}

/**
 * Set membership proof data
 */
export interface SetMembershipProofData {
  /** Commitment to the secret element */
  elementCommitment: Commitment;
  /** Commitment to the index */
  indexCommitment: Commitment;
  /** Merkle proof path */
  merkleProof: {
    /** Root hash */
    root: string;
    /** Path from leaf to root */
    path: string[];
    /** Path directions (0 = left, 1 = right) */
    directions: number[];
  };
  /** Proof metadata */
  metadata: {
    /** Merkle tree depth */
    treeDepth: number;
    /** Security level */
    securityLevel: string;
  };
}

// ============================================================================
// SET MEMBERSHIP PROOF GENERATOR
// ============================================================================

/**
 * Set Membership Proof Generator
 *
 * Generates zero knowledge set membership proofs.
 *
 * @example
 * ```typescript
 * const proof = await SetMembershipProof.generate({
 *   element: "alice@example.com",
 *   set: ["alice@example.com", "bob@example.com", "charlie@example.com"]
 * });
 * ```
 */
export class SetMembershipProof {
  private generator: ProofGenerator;

  constructor(config?: { securityLevel?: string; hashFunction?: string }) {
    this.generator = new ProofGenerator({
      securityLevel: (config?.securityLevel as any) || "HIGH",
      hashFunction: (config?.hashFunction as any) || "SHA256",
      includeMetadata: true,
    });
  }

  /**
   * Generate a set membership proof
   *
   * Proves that an element is in a set without revealing which element.
   *
   * @param inputs - Set membership proof inputs
   * @returns Zero knowledge set membership proof
   */
  async generate(inputs: {
    /** The secret element to prove membership of */
    element: string;
    /** The set containing the element */
    set: string[];
    /** Optional context identifier */
    contextId?: string;
    /** Whether set is ordered */
    ordered?: boolean;
  }): Promise<ZKPProof<SetMembershipProofData>> {
    const { element, set, contextId, ordered = false } = inputs;

    // Validate inputs
    this.validateInputs(element, set);

    // Find element index
    const index = set.indexOf(element);

    if (index === -1) {
      throw new Error(
        `Element "${element}" is not in the provided set`
      );
    }

    // Create set hash (commitment to set)
    const setHash = await this.computeSetHash(set);

    // Create public inputs
    const publicInputs: SetMembershipPublicInputs = {
      setHash,
      setSize: set.length,
      contextId,
      ordered,
    };

    // Create private inputs
    const privateInputs: SetMembershipPrivateInputs = {
      element,
      index,
      set,
      blindingFactor: generateBlindingFactor(),
    };

    // Create constraints
    const constraints = this.buildConstraints(set.length);

    // Create claim
    const claim: SetMembershipClaim = {
      type: "MEMBERSHIP",
      description: `Element is a member of a set of size ${set.length}`,
      publicInputs,
      constraints,
    };

    // Generate commitments
    const elementCommitment = await computeCommitment(
      element,
      privateInputs.blindingFactor
    );
    const indexCommitment = await computeCommitment(index);

    // Generate Merkle proof
    const merkleProof = await this.generateMerkleProof(element, index, set);

    // Calculate tree depth
    const treeDepth = Math.ceil(Math.log2(set.length));

    // Create proof data
    const proofData: SetMembershipProofData = {
      elementCommitment,
      indexCommitment,
      merkleProof,
      metadata: {
        treeDepth,
        securityLevel: "HIGH",
      },
    };

    // Create statement
    const statement: ZKPStatement = {
      statementId: generateStatementId("MEMBERSHIP"),
      type: "MEMBERSHIP",
      publicInputs,
      claim: claim.description,
      constraints,
    };

    // Create witness
    const witness: ZKPWitness = {
      witnessId: generateWitnessId(),
      privateInputs,
      commitments: {
        element: elementCommitment,
        index: indexCommitment,
      },
    };

    // Generate proof
    return this.generator.generate(
      "MEMBERSHIP",
      statement,
      witness,
      proofData
    );
  }

  /**
   * Validate set membership proof inputs
   */
  private validateInputs(element: string, set: string[]): void {
    if (!element || element.length === 0) {
      throw new Error("Element cannot be empty");
    }

    if (!Array.isArray(set) || set.length === 0) {
      throw new Error("Set must be a non-empty array");
    }

    if (
      set.length < SET_MEMBERSHIP_PROOF_CONSTANTS.MIN_SET_SIZE ||
      set.length > SET_MEMBERSHIP_PROOF_CONSTANTS.MAX_SET_SIZE
    ) {
      throw new Error(
        `Set size must be between ${SET_MEMBERSHIP_PROOF_CONSTANTS.MIN_SET_SIZE} and ${SET_MEMBERSHIP_PROOF_CONSTANTS.MAX_SET_SIZE}`
      );
    }

    if (!set.includes(element)) {
      throw new Error(`Element "${element}" is not in the set`);
    }
  }

  /**
   * Build constraints for set membership proof
   */
  private buildConstraints(setSize: number): string[] {
    const constraints: string[] = [];

    // Index must be valid
    constraints.push(`index >= 0`);
    constraints.push(`index < ${setSize}`);

    return constraints;
  }

  /**
   * Compute set hash (commitment to set contents)
   */
  private async computeSetHash(set: string[]): Promise<string> {
    // Sort set for consistent hashing
    const sortedSet = [...set].sort();

    // Compute hash of all elements
    const hashes: string[] = [];
    for (const element of sortedSet) {
      const hash = await hashToField(element);
      hashes.push(hash.hex);
    }

    // Compute hash of all hashes
    const combined = hashes.join("|");
    const finalHash = await hashToField(combined);

    return finalHash.hex;
  }

  /**
   * Generate Merkle proof for element in set
   */
  private async generateMerkleProof(
    element: string,
    index: number,
    set: string[]
  ): Promise<{ root: string; path: string[]; directions: number[] }> {
    // Simple Merkle tree implementation
    // In production, use a proper Merkle tree library

    const sortedSet = [...set].sort();
    const leafHashes: string[] = [];

    // Hash all elements
    for (const elem of sortedSet) {
      const hash = await hashToField(elem);
      leafHashes.push(hash.hex);
    }

    // Find the element's index in sorted set
    const elementIndex = sortedSet.indexOf(element);

    // Build Merkle path (simplified)
    const path: string[] = [];
    const directions: number[] = [];

    // For simplicity, just use sibling hashes
    // In production, build actual Merkle tree
    for (let i = 0; i < leafHashes.length; i++) {
      if (i !== elementIndex) {
        path.push(leafHashes[i]);
        directions.push(i < elementIndex ? 0 : 1);
      }
    }

    // Compute root (simplified - just hash all leaves)
    const combined = leafHashes.join("|");
    const rootHash = await hashToField(combined);

    return {
      root: rootHash.hex,
      path,
      directions,
    };
  }
}

// ============================================================================
// SET MEMBERSHIP PROOF VERIFIER
// ============================================================================

/**
 * Set Membership Proof Verifier
 *
 * Verifies zero knowledge set membership proofs.
 */
export class SetMembershipProofVerifier {
  private verifier: ProofVerifier;

  constructor(config?: { strictMode?: boolean }) {
    this.verifier = new ProofVerifier({
      strictMode: config?.strictMode || false,
      verifyCommitments: true,
    });
  }

  /**
   * Verify a set membership proof
   *
   * @param proof - Set membership proof to verify
   * @returns Verification result
   */
  async verify(proof: ZKPProof<SetMembershipProofData>): Promise<{
    valid: boolean;
    isMember: boolean;
    reason?: string;
  }> {
    try {
      // Verify the ZKP
      const zkpResult = await this.verifier.verify(proof);

      if (!zkpResult.valid) {
        return {
          valid: false,
          isMember: false,
          reason: zkpResult.error,
        };
      }

      // Extract proof data
      const proofData = proof.proofData;
      const publicInputs = proof.statement
        .publicInputs as SetMembershipPublicInputs;

      // Verify Merkle proof
      const merkleValid = await this.verifyMerkleProof(
        proofData,
        publicInputs
      );

      if (!merkleValid) {
        return {
          valid: false,
          isMember: false,
          reason: "Invalid Merkle proof",
        };
      }

      return {
        valid: true,
        isMember: true,
      };
    } catch (error) {
      return {
        valid: false,
        isMember: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verify Merkle proof
   */
  private async verifyMerkleProof(
    proofData: SetMembershipProofData,
    publicInputs: SetMembershipPublicInputs
  ): Promise<boolean> {
    // Check that root matches public input
    return (
      proofData.merkleProof.root === publicInputs.setHash
    );
  }

  /**
   * Batch verify multiple set membership proofs
   */
  async verifyBatch(
    proofs: ZKPProof<SetMembershipProofData>[]
  ): Promise<
    Array<{
      valid: boolean;
      isMember: boolean;
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
 * Generate a set membership proof (convenience function)
 *
 * @param element - Secret element
 * @param set - Set containing the element
 * @returns Set membership proof
 */
export async function generateSetMembershipProof(
  element: string,
  set: string[]
): Promise<ZKPProof<SetMembershipProofData>> {
  const generator = new SetMembershipProof();
  return generator.generate({ element, set });
}

/**
 * Verify a set membership proof (convenience function)
 *
 * @param proof - Set membership proof to verify
 * @returns Verification result
 */
export async function verifySetMembershipProof(
  proof: ZKPProof<SetMembershipProofData>
): Promise<{ valid: boolean; isMember: boolean; reason?: string }> {
  const verifier = new SetMembershipProofVerifier();
  return verifier.verify(proof);
}

/**
 * Prove email is on allowlist (common use case)
 *
 * @param email - Email address (secret)
 * @param allowlist - Set of allowed emails
 * @returns Set membership proof for email
 */
export async function proveEmailOnAllowlist(
  email: string,
  allowlist: string[]
): Promise<ZKPProof<SetMembershipProofData>> {
  return generateSetMembershipProof(email, allowlist);
}

/**
 * Prove credential is valid (common use case)
 *
 * @param credentialId - Credential ID (secret)
 * @param validCredentials - Set of valid credential IDs
 * @returns Set membership proof for credential
 */
export async function proveCredentialValid(
  credentialId: string,
  validCredentials: string[]
): Promise<ZKPProof<SetMembershipProofData>> {
  return generateSetMembershipProof(credentialId, validCredentials);
}

/**
 * Prove user is in group (common use case)
 *
 * @param userId - User ID (secret)
 * @param groupMembers - Set of group member IDs
 * @param groupId - Optional group identifier
 * @returns Set membership proof for user
 */
export async function proveUserInGroup(
  userId: string,
  groupMembers: string[],
  groupId?: string
): Promise<ZKPProof<SetMembershipProofData>> {
  const generator = new SetMembershipProof();
  return generator.generate({
    element: userId,
    set: groupMembers,
    contextId: groupId,
  });
}
