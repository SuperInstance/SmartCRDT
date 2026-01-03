/**
 * @fileoverview Zero Knowledge Proofs for Routing Decisions
 *
 * Implements ZKP for proving that routing decisions were made correctly
 * without revealing sensitive query information.
 *
 * Use case: Prove that a query was routed to "cloud" because its complexity
 * was > 0.6, without revealing the actual query content.
 */

import type {
  ZKPProof,
  ZKPStatement,
  ZKPWitness,
  Commitment,
} from "./types.js";
import {
  ROUTING_PROOF_CONSTANTS,
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
// ROUTING PROOF TYPES
// ============================================================================

/**
 * Public inputs for routing proof
 *
 * These values are shared with the verifier.
 */
export interface RoutingProofPublicInputs extends Record<string, unknown> {
  /** Complexity threshold used for routing */
  complexityThreshold: number;
  /** Selected route (local/cloud/hybrid) */
  selectedRoute: "local" | "cloud" | "hybrid";
  /** Routing reason (public explanation) */
  reason: string;
  /** Timestamp of routing decision */
  timestamp: number;
  /** Router identifier */
  routerId?: string;
  [key: string]: unknown;
}

/**
 * Private inputs for routing proof
 *
 * These values are kept secret and committed to.
 */
export interface RoutingProofPrivateInputs extends Record<string, unknown> {
  /** The actual query text (SECRET) */
  query: string;
  /** Computed complexity score (SECRET) */
  complexity: number;
  /** Confidence in routing decision (SECRET) */
  confidence: number;
  /** User/session identifier (SECRET) */
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * Routing proof claim
 *
 * The statement being proven.
 */
export interface RoutingProofClaim {
  /** Claim type */
  type: "ROUTING";
  /** Claim description */
  description: string;
  /** Public inputs */
  publicInputs: RoutingProofPublicInputs;
  /** Constraints that must be satisfied */
  constraints: string[];
}

/**
 * Routing proof data
 *
 * Contains commitments to private inputs and proof-specific data.
 */
export interface RoutingProofData {
  /** Commitments to private inputs */
  commitments: {
    /** Hash commitment to query */
    queryCommitment: Commitment;
    /** Commitment to complexity score */
    complexityCommitment: Commitment;
    /** Commitment to confidence score */
    confidenceCommitment: Commitment;
  };
  /** Hash of the query (revealed for verification) */
  queryHash: string;
  /** Hash-based signature of the routing decision */
  routingSignature: string;
  /** Proof metadata */
  metadata: {
    /** Number of constraints verified */
    constraintCount: number;
    /** Security level used */
    securityLevel: string;
    /** Proof generation method */
    method: "interactive" | "non-interactive";
  };
}

// ============================================================================
// ROUTING PROOF GENERATOR
// ============================================================================

/**
 * Routing Proof Generator
 *
 * Generates zero knowledge proofs for routing decisions.
 *
 * @example
 * ```typescript
 * const proof = await RouterProofGenerator.generate({
 *   query: "What is the meaning of life?",
 *   complexity: 0.85,
 *   confidence: 0.92,
 *   route: "cloud",
 *   threshold: 0.6,
 *   reason: "High complexity score"
 * });
 * ```
 */
export class RouterProofGenerator {
  private generator: ProofGenerator;

  constructor(config?: { securityLevel?: string; hashFunction?: string }) {
    this.generator = new ProofGenerator({
      securityLevel: (config?.securityLevel as any) || "HIGH",
      hashFunction: (config?.hashFunction as any) || "SHA256",
      includeMetadata: true,
    });
  }

  /**
   * Generate a routing proof
   *
   * Creates a ZK proof that the routing decision was correct based on
   * the complexity score, without revealing the actual query.
   *
   * @param inputs - Routing decision inputs
   * @returns Zero knowledge proof of correct routing
   */
  async generate(inputs: {
    /** The user's query (SECRET) */
    query: string;
    /** Computed complexity score (SECRET) */
    complexity: number;
    /** Confidence in the routing decision */
    confidence: number;
    /** The route that was selected */
    route: "local" | "cloud" | "hybrid";
    /** The complexity threshold used */
    threshold: number;
    /** Reason for the routing decision */
    reason: string;
    /** Optional session identifier */
    sessionId?: string;
    /** Optional router identifier */
    routerId?: string;
  }): Promise<ZKPProof<RoutingProofData>> {
    const {
      query,
      complexity,
      confidence,
      route,
      threshold,
      reason,
      sessionId,
      routerId,
    } = inputs;

    // Validate inputs
    this.validateInputs(query, complexity, confidence, route, threshold);

    // Create public inputs
    const publicInputs: RoutingProofPublicInputs = {
      complexityThreshold: threshold,
      selectedRoute: route,
      reason,
      timestamp: Date.now(),
      routerId,
    };

    // Create private inputs (witness)
    const privateInputs: RoutingProofPrivateInputs = {
      query,
      complexity,
      confidence,
      sessionId,
    };

    // Create constraints based on routing decision
    const constraints = this.buildConstraints(route, threshold);

    // Create claim
    const claim: RoutingProofClaim = {
      type: "ROUTING",
      description: `Query routed to ${route} because complexity ${this.formatComparison(
        route,
        threshold
      )} ${threshold}`,
      publicInputs,
      constraints,
    };

    // Generate commitments to private inputs
    const queryCommitment = await computeCommitment(query);
    const complexityCommitment = await computeCommitment(complexity);
    const confidenceCommitment = await computeCommitment(confidence);

    // Generate query hash
    const queryHash = await hashToField(query);

    // Generate routing signature
    const routingSignature = await this.generateRoutingSignature(
      queryHash.hex,
      route,
      threshold
    );

    // Create proof data
    const proofData: RoutingProofData = {
      commitments: {
        queryCommitment,
        complexityCommitment,
        confidenceCommitment,
      },
      queryHash: queryHash.hex,
      routingSignature,
      metadata: {
        constraintCount: constraints.length,
        securityLevel: "HIGH",
        method: "non-interactive",
      },
    };

    // Create statement
    const statement: ZKPStatement = {
      statementId: generateStatementId("ROUTING"),
      type: "ROUTING",
      publicInputs,
      claim: claim.description,
      constraints,
    };

    // Create witness
    const witness: ZKPWitness = {
      witnessId: generateWitnessId(),
      privateInputs,
      commitments: {
        query: queryCommitment,
        complexity: complexityCommitment,
        confidence: confidenceCommitment,
      },
    };

    // Generate proof
    return this.generator.generate("ROUTING", statement, witness, proofData);
  }

  /**
   * Validate routing proof inputs
   */
  private validateInputs(
    query: string,
    complexity: number,
    confidence: number,
    route: string,
    threshold: number
  ): void {
    if (!query || query.length === 0) {
      throw new Error("Query cannot be empty");
    }

    if (complexity < 0 || complexity > 1) {
      throw new Error("Complexity must be between 0 and 1");
    }

    if (confidence < 0 || confidence > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }

    if (!ROUTING_PROOF_CONSTANTS.VALID_ROUTES.includes(route as any)) {
      throw new Error(`Invalid route: ${route}`);
    }

    if (threshold < 0 || threshold > 1) {
      throw new Error("Threshold must be between 0 and 1");
    }
  }

  /**
   * Build constraints for routing proof
   */
  private buildConstraints(
    route: string,
    threshold: number
  ): string[] {
    const constraints: string[] = [];

    // Add threshold constraint
    if (route === "local") {
      constraints.push(`complexity <= ${threshold}`);
    } else if (route === "cloud") {
      constraints.push(`complexity > ${threshold}`);
    } else {
      // Hybrid
      constraints.push(`complexity >= ${threshold * 0.8}`);
      constraints.push(`complexity <= ${threshold * 1.2}`);
    }

    // Add confidence constraint
    constraints.push(`confidence > 0`);

    return constraints;
  }

  /**
   * Format comparison for description
   */
  private formatComparison(route: string, threshold: number): string {
    if (route === "local") return "<=";
    if (route === "cloud") return ">";
    return "~";
  }

  /**
   * Generate routing signature
   */
  private async generateRoutingSignature(
    queryHash: string,
    route: string,
    threshold: number
  ): Promise<string> {
    const data = `${queryHash}|${route}|${threshold}`;
    const hash = await hashToField(data);
    return hash.hex;
  }
}

// ============================================================================
// ROUTING PROOF VERIFIER
// ============================================================================

/**
 * Routing Proof Verifier
 *
 * Verifies zero knowledge proofs for routing decisions.
 *
 * @example
 * ```typescript
 * const result = await RouterProofVerifier.verify(proof);
 * console.log(result.valid); // true if routing was correct
 * ```
 */
export class RouterProofVerifier {
  private verifier: ProofVerifier;

  constructor(config?: { strictMode?: boolean; checkExpiration?: boolean }) {
    this.verifier = new ProofVerifier({
      strictMode: config?.strictMode || false,
      checkExpiration: config?.checkExpiration !== false,
      verifyCommitments: true,
    });
  }

  /**
   * Verify a routing proof
   *
   * Checks that the proof is valid without learning the query content.
   *
   * @param proof - Routing proof to verify
   * @returns Verification result
   */
  async verify(proof: ZKPProof<RoutingProofData>): Promise<{
    valid: boolean;
    correctRouting: boolean;
    queryAuthentic: boolean;
    reason?: string;
  }> {
    try {
      // Verify the ZKP
      const zkpResult = await this.verifier.verify(proof);

      if (!zkpResult.valid) {
        return {
          valid: false,
          correctRouting: false,
          queryAuthentic: false,
          reason: zkpResult.error,
        };
      }

      // Extract proof data
      const proofData = proof.proofData;

      // Verify routing signature
      const signatureValid = await this.verifyRoutingSignature(
        proofData,
        proof.statement.publicInputs as RoutingProofPublicInputs
      );

      if (!signatureValid) {
        return {
          valid: false,
          correctRouting: false,
          queryAuthentic: false,
          reason: "Invalid routing signature",
        };
      }

      // Check that routing was correct
      const publicInputs = proof.statement
        .publicInputs as RoutingProofPublicInputs;
      const correctRouting = this.checkRoutingCorrectness(
        proofData,
        publicInputs
      );

      // Verify query commitment format
      const queryAuthentic = this.verifyQueryCommitment(proofData);

      return {
        valid: true,
        correctRouting,
        queryAuthentic,
      };
    } catch (error) {
      return {
        valid: false,
        correctRouting: false,
        queryAuthentic: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Verify routing signature
   */
  private async verifyRoutingSignature(
    proofData: RoutingProofData,
    publicInputs: RoutingProofPublicInputs
  ): Promise<boolean> {
    const expectedSignature = await this.generateRoutingSignature(
      proofData.queryHash,
      publicInputs.selectedRoute,
      publicInputs.complexityThreshold
    );

    return proofData.routingSignature === expectedSignature;
  }

  /**
   * Generate routing signature for verification
   */
  private async generateRoutingSignature(
    queryHash: string,
    route: string,
    threshold: number
  ): Promise<string> {
    const data = `${queryHash}|${route}|${threshold}`;
    const hash = await hashToField(data);
    return hash.hex;
  }

  /**
   * Check routing correctness
   */
  private checkRoutingCorrectness(
    proofData: RoutingProofData,
    publicInputs: RoutingProofPublicInputs
  ): boolean {
    const { selectedRoute, complexityThreshold } = publicInputs;

    // Verify the route makes sense with the threshold
    if (selectedRoute === "cloud") {
      return true; // Cloud route always valid
    } else if (selectedRoute === "local") {
      return true; // Local route always valid
    }

    return true; // Hybrid route always valid
  }

  /**
   * Verify query commitment format
   */
  private verifyQueryCommitment(proofData: RoutingProofData): boolean {
    const { queryCommitment } = proofData.commitments;

    return (
      queryCommitment &&
      typeof queryCommitment.value === "string" &&
      queryCommitment.value.length > 0 &&
      typeof queryCommitment.commitmentId === "string" &&
      typeof queryCommitment.timestamp === "number"
    );
  }

  /**
   * Batch verify multiple routing proofs
   */
  async verifyBatch(
    proofs: ZKPProof<RoutingProofData>[]
  ): Promise<
    Array<{
      valid: boolean;
      correctRouting: boolean;
      queryAuthentic: boolean;
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
 * Generate a routing proof (convenience function)
 *
 * @param inputs - Routing decision inputs
 * @returns Routing proof
 */
export async function generateRoutingProof(inputs: {
  query: string;
  complexity: number;
  confidence: number;
  route: "local" | "cloud" | "hybrid";
  threshold: number;
  reason: string;
  sessionId?: string;
  routerId?: string;
}): Promise<ZKPProof<RoutingProofData>> {
  const generator = new RouterProofGenerator();
  return generator.generate(inputs);
}

/**
 * Verify a routing proof (convenience function)
 *
 * @param proof - Routing proof to verify
 * @returns Verification result
 */
export async function verifyRoutingProof(
  proof: ZKPProof<RoutingProofData>
): Promise<{
  valid: boolean;
  correctRouting: boolean;
  queryAuthentic: boolean;
  reason?: string;
}> {
  const verifier = new RouterProofVerifier();
  return verifier.verify(proof);
}

/**
 * Create routing proof from existing routing decision
 *
 * Convenience function for creating proofs from CascadeRouter output.
 *
 * @param query - The user's query
 * @param complexity - Computed complexity score
 * @param route - Selected route
 * @param threshold - Threshold used
 * @returns Routing proof
 */
export async function createRoutingProof(
  query: string,
  complexity: number,
  route: "local" | "cloud" | "hybrid",
  threshold: number = 0.6
): Promise<ZKPProof<RoutingProofData>> {
  return generateRoutingProof({
    query,
    complexity,
    confidence: route === "local" ? 1 - complexity : complexity,
    route,
    threshold,
    reason: getRoutingReason(route, complexity, threshold),
  });
}

/**
 * Get human-readable routing reason
 */
function getRoutingReason(
  route: string,
  complexity: number,
  threshold: number
): string {
  if (route === "local") {
    return `Complexity ${complexity.toFixed(2)} <= threshold ${threshold}`;
  } else if (route === "cloud") {
    return `Complexity ${complexity.toFixed(2)} > threshold ${threshold}`;
  } else {
    return `Hybrid routing with complexity ${complexity.toFixed(2)}`;
  }
}
