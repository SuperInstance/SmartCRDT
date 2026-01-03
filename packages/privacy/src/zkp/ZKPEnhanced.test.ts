/**
 * @fileoverview Comprehensive Test Suite for Enhanced ZKP System
 *
 * Tests all ZKP proof types including:
 * - Routing proofs
 * - Range proofs
 * - Set membership proofs
 * - Disjunction proofs (NEW)
 * - Proof aggregation (NEW)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RouterProofGenerator,
  RouterProofVerifier,
  generateRoutingProof,
  verifyRoutingProof,
  type RoutingProofData,
} from "./RouterZKP.js";
import {
  RangeProof,
  RangeProofVerifier,
  generateRangeProof,
  verifyRangeProof,
  proveAgeRange,
  proveScoreRange,
  type RangeProofData,
} from "./RangeProof.js";
import {
  SetMembershipProof,
  SetMembershipProofVerifier,
  generateSetMembershipProof,
  verifySetMembershipProof,
  proveEmailOnAllowlist,
  proveCredentialValid,
  proveUserInGroup,
  type SetMembershipProofData,
} from "./SetMembershipProof.js";
import {
  DisjunctionProof,
  DisjunctionProofVerifier,
  generateDisjunctionProof,
  verifyDisjunctionProof,
  proveOneOf,
  type DisjunctionProofData,
  type DisjunctionStatement,
} from "./DisjunctionProof.js";
import {
  ProofAggregator,
  AggregatedProofVerifier,
  aggregateProofs,
  verifyAggregatedProof,
  estimateAggregationSavings,
  type AggregatedProof,
} from "./ProofAggregation.js";
import type { ZKPProof } from "./types.js";

// ============================================================================
// ROUTING PROOF TESTS
// ============================================================================

describe("RouterProofGenerator", () => {
  it("should generate a valid routing proof for local route", async () => {
    const generator = new RouterProofGenerator();

    const proof = await generator.generate({
      query: "What is 2+2?",
      complexity: 0.3,
      confidence: 0.9,
      route: "local",
      threshold: 0.6,
      reason: "Low complexity query",
    });

    expect(proof).toBeDefined();
    expect(proof.type).toBe("ROUTING");
    expect(proof.proofData.queryHash).toBeDefined();
    expect(proof.proofData.routingSignature).toBeDefined();
    expect(proof.proofData.commitments).toBeDefined();
  });

  it("should generate a valid routing proof for cloud route", async () => {
    const generator = new RouterProofGenerator();

    const proof = await generator.generate({
      query: "Explain quantum entanglement in simple terms",
      complexity: 0.85,
      confidence: 0.92,
      route: "cloud",
      threshold: 0.6,
      reason: "High complexity query",
    });

    expect(proof).toBeDefined();
    expect(proof.type).toBe("ROUTING");
    expect(proof.statement.publicInputs.selectedRoute).toBe("cloud");
  });

  it("should generate a valid routing proof for hybrid route", async () => {
    const generator = new RouterProofGenerator();

    const proof = await generator.generate({
      query: "Medium complexity query",
      complexity: 0.55,
      confidence: 0.7,
      route: "hybrid",
      threshold: 0.5,
      reason: "Medium complexity query",
    });

    expect(proof).toBeDefined();
    expect(proof.type).toBe("ROUTING");
    expect(proof.statement.publicInputs.selectedRoute).toBe("hybrid");
  });

  it("should throw error for empty query", async () => {
    const generator = new RouterProofGenerator();

    await expect(
      generator.generate({
        query: "",
        complexity: 0.5,
        confidence: 0.8,
        route: "local",
        threshold: 0.6,
        reason: "test",
      })
    ).rejects.toThrow("Query cannot be empty");
  });

  it("should throw error for invalid complexity", async () => {
    const generator = new RouterProofGenerator();

    await expect(
      generator.generate({
        query: "test",
        complexity: 1.5,
        confidence: 0.8,
        route: "local",
        threshold: 0.6,
        reason: "test",
      })
    ).rejects.toThrow("Complexity must be between 0 and 1");
  });
});

describe("RouterProofVerifier", () => {
  it("should verify a valid routing proof", async () => {
    const generator = new RouterProofGenerator();
    const verifier = new RouterProofVerifier();

    const proof = await generator.generate({
      query: "test query",
      complexity: 0.7,
      confidence: 0.85,
      route: "cloud",
      threshold: 0.6,
      reason: "High complexity",
    });

    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.correctRouting).toBe(true);
    expect(result.queryAuthentic).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should batch verify multiple routing proofs", async () => {
    const generator = new RouterProofGenerator();
    const verifier = new RouterProofVerifier();

    const proofs = await Promise.all([
      generator.generate({
        query: "simple query",
        complexity: 0.3,
        confidence: 0.9,
        route: "local",
        threshold: 0.6,
        reason: "Low complexity",
      }),
      generator.generate({
        query: "complex query",
        complexity: 0.8,
        confidence: 0.95,
        route: "cloud",
        threshold: 0.6,
        reason: "High complexity",
      }),
    ]);

    const results = await verifier.verifyBatch(proofs);

    expect(results).toHaveLength(2);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(true);
  });
});

// ============================================================================
// RANGE PROOF TESTS
// ============================================================================

describe("RangeProof", () => {
  it("should generate a valid range proof", async () => {
    const generator = new RangeProof();

    const proof = await generator.generate({
      value: 25,
      min: 18,
      max: 120,
      inclusive: true,
    });

    expect(proof).toBeDefined();
    expect(proof.type).toBe("RANGE");
    expect(proof.proofData.valueCommitment).toBeDefined();
    expect(proof.proofData.rangeCommitments).toBeDefined();
    expect(proof.proofData.membershipProof).toBeDefined();
  });

  it("should throw error for value outside range", async () => {
    const generator = new RangeProof();

    await expect(
      generator.generate({
        value: 15,
        min: 18,
        max: 120,
        inclusive: true,
      })
    ).rejects.toThrow("Value 15 is not in range [18, 120]");
  });

  it("should verify a valid range proof", async () => {
    const generator = new RangeProof();
    const verifier = new RangeProofVerifier();

    const proof = await generator.generate({
      value: 30,
      min: 18,
      max: 120,
      inclusive: true,
    });

    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.inRange).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe("RangeProof helpers", () => {
  it("should prove age range", async () => {
    const proof = await proveAgeRange(25);

    expect(proof).toBeDefined();
    expect(proof.type).toBe("RANGE");

    const verifier = new RangeProofVerifier();
    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.inRange).toBe(true);
  });

  it("should prove score range", async () => {
    const proof = await proveScoreRange(85, 60, 100);

    expect(proof).toBeDefined();
    expect(proof.type).toBe("RANGE");

    const verifier = new RangeProofVerifier();
    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.inRange).toBe(true);
  });
});

// ============================================================================
// SET MEMBERSHIP PROOF TESTS
// ============================================================================

describe("SetMembershipProof", () => {
  it("should generate a valid set membership proof", async () => {
    const generator = new SetMembershipProof();
    const allowlist = [
      "alice@example.com",
      "bob@example.com",
      "charlie@example.com",
    ];

    const proof = await generator.generate({
      element: "bob@example.com",
      set: allowlist,
    });

    expect(proof).toBeDefined();
    expect(proof.type).toBe("MEMBERSHIP");
    expect(proof.proofData.elementCommitment).toBeDefined();
    expect(proof.proofData.merkleProof).toBeDefined();
  });

  it("should throw error for element not in set", async () => {
    const generator = new SetMembershipProof();
    const allowlist = ["alice@example.com", "bob@example.com"];

    await expect(
      generator.generate({
        element: "eve@example.com",
        set: allowlist,
      })
    ).rejects.toThrow('Element "eve@example.com" is not in the provided set');
  });

  it("should verify a valid set membership proof", async () => {
    const generator = new SetMembershipProof();
    const verifier = new SetMembershipProofVerifier();
    const credentials = ["cred1", "cred2", "cred3"];

    const proof = await generator.generate({
      element: "cred2",
      set: credentials,
    });

    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.isMember).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe("SetMembershipProof helpers", () => {
  it("should prove email on allowlist", async () => {
    const allowlist = [
      "user1@example.com",
      "user2@example.com",
      "user3@example.com",
    ];

    const proof = await proveEmailOnAllowlist("user2@example.com", allowlist);

    expect(proof).toBeDefined();
    expect(proof.type).toBe("MEMBERSHIP");

    const verifier = new SetMembershipProofVerifier();
    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.isMember).toBe(true);
  });

  it("should prove credential valid", async () => {
    const validCredentials = ["CRED001", "CRED002", "CRED003"];

    const proof = await proveCredentialValid("CRED002", validCredentials);

    expect(proof).toBeDefined();
    expect(proof.type).toBe("MEMBERSHIP");

    const verifier = new SetMembershipProofVerifier();
    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.isMember).toBe(true);
  });

  it("should prove user in group", async () => {
    const groupMembers = ["user1", "user2", "user3", "user4"];

    const proof = await proveUserInGroup("user3", groupMembers, "admin-group");

    expect(proof).toBeDefined();
    expect(proof.type).toBe("MEMBERSHIP");

    const verifier = new SetMembershipProofVerifier();
    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.isMember).toBe(true);
  });
});

// ============================================================================
// DISJUNCTION PROOF TESTS (NEW)
// ============================================================================

describe("DisjunctionProof", () => {
  it("should generate a valid disjunction proof", async () => {
    const generator = new DisjunctionProof();

    const statements: DisjunctionStatement[] = [
      {
        statementId: "stmt1",
        publicInputs: {},
        constraints: ["age >= 18"],
        description: "User is over 18",
      },
      {
        statementId: "stmt2",
        publicInputs: {},
        constraints: ["hasConsent == true"],
        description: "User has parental consent",
      },
    ];

    const proof = await generator.generate({
      statements,
      trueStatementIndex: 0,
      witness: { age: 25 },
    });

    expect(proof).toBeDefined();
    expect(proof.type).toBe("DISJUNCTION");
    expect(proof.proofData.indexCommitment).toBeDefined();
    expect(proof.proofData.statementCommitment).toBeDefined();
    expect(proof.proofData.allStatementCommitments).toHaveLength(2);
    expect(proof.proofData.satisfactionProof).toBeDefined();
  });

  it("should verify a valid disjunction proof", async () => {
    const generator = new DisjunctionProof();
    const verifier = new DisjunctionProofVerifier();

    const statements: DisjunctionStatement[] = [
      {
        statementId: "stmt1",
        publicInputs: {},
        constraints: ["age >= 18"],
        description: "User is over 18",
      },
      {
        statementId: "stmt2",
        publicInputs: {},
        constraints: ["hasConsent == true"],
        description: "User has parental consent",
      },
    ];

    const proof = await generator.generate({
      statements,
      trueStatementIndex: 0,
      witness: { age: 25 },
    });

    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.atLeastOneTrue).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should throw error if witness doesn't satisfy constraints", async () => {
    const generator = new DisjunctionProof();

    const statements: DisjunctionStatement[] = [
      {
        statementId: "stmt1",
        publicInputs: {},
        constraints: ["age >= 18"],
        description: "User is over 18",
      },
      {
        statementId: "stmt2",
        publicInputs: {},
        constraints: ["hasConsent == true"],
        description: "User has parental consent",
      },
    ];

    await expect(
      generator.generate({
        statements,
        trueStatementIndex: 0,
        witness: { age: 15 }, // Doesn't satisfy age >= 18
      })
    ).rejects.toThrow("Witness does not satisfy constraint");
  });

  it("should handle multiple statements correctly", async () => {
    const generator = new DisjunctionProof();
    const verifier = new DisjunctionProofVerifier();

    const statements: DisjunctionStatement[] = [
      {
        statementId: "stmt1",
        publicInputs: {},
        constraints: ["score >= 90"],
        description: "Excellent score",
      },
      {
        statementId: "stmt2",
        publicInputs: {},
        constraints: ["score >= 80 && score < 90"],
        description: "Good score",
      },
      {
        statementId: "stmt3",
        publicInputs: {},
        constraints: ["score >= 70 && score < 80"],
        description: "Average score",
      },
    ];

    const proof = await generator.generate({
      statements,
      trueStatementIndex: 1,
      witness: { score: 85 },
    });

    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.atLeastOneTrue).toBe(true);
  });
});

describe("DisjunctionProof helpers", () => {
  it("should prove one of multiple conditions", async () => {
    const conditions = [
      { description: "Premium user", field: "tier", operator: "==", value: "premium" },
      { description: "VIP user", field: "tier", operator: "==", value: "vip" },
      { description: "Trial user", field: "tier", operator: "==", value: "trial" },
    ];

    const proof = await proveOneOf(conditions, 1, { tier: "vip" });

    expect(proof).toBeDefined();
    expect(proof.type).toBe("DISJUNCTION");

    const verifier = new DisjunctionProofVerifier();
    const result = await verifier.verify(proof);

    expect(result.valid).toBe(true);
    expect(result.atLeastOneTrue).toBe(true);
  });
});

// ============================================================================
// PROOF AGGREGATION TESTS (NEW)
// ============================================================================

describe("ProofAggregator", () => {
  it("should aggregate multiple proofs", async () => {
    const aggregator = new ProofAggregator();

    // Create some routing proofs
    const generator = new RouterProofGenerator();
    const proofs = await Promise.all([
      generator.generate({
        query: "query1",
        complexity: 0.3,
        confidence: 0.9,
        route: "local",
        threshold: 0.6,
        reason: "test1",
      }),
      generator.generate({
        query: "query2",
        complexity: 0.7,
        confidence: 0.8,
        route: "cloud",
        threshold: 0.6,
        reason: "test2",
      }),
      generator.generate({
        query: "query3",
        complexity: 0.5,
        confidence: 0.85,
        route: "hybrid",
        threshold: 0.5,
        reason: "test3",
      }),
    ]);

    const result = await aggregator.aggregate(proofs);

    expect(result.aggregatedProof).toBeDefined();
    expect(result.aggregatedProof.data.proofCount).toBe(3);
    expect(result.stats.compressionRatio).toBeGreaterThan(1);
    expect(result.stats.spaceSavedBytes).toBeGreaterThan(0);
  });

  it("should support different aggregation methods", async () => {
    const aggregator = new ProofAggregator();

    const generator = new RouterProofGenerator();
    const proofs = await Promise.all([
      generator.generate({
        query: "query1",
        complexity: 0.3,
        confidence: 0.9,
        route: "local",
        threshold: 0.6,
        reason: "test1",
      }),
      generator.generate({
        query: "query2",
        complexity: 0.7,
        confidence: 0.8,
        route: "cloud",
        threshold: 0.6,
        reason: "test2",
      }),
    ]);

    const homomorphicResult = await aggregator.aggregate(proofs, {
      method: "homomorphic",
    });

    const merkleResult = await aggregator.aggregate(proofs, {
      method: "merkle",
    });

    const batchResult = await aggregator.aggregate(proofs, {
      method: "batch",
    });

    expect(homomorphicResult.aggregatedProof.data.metadata.method).toBe("homomorphic");
    expect(merkleResult.aggregatedProof.data.metadata.method).toBe("merkle");
    expect(batchResult.aggregatedProof.data.metadata.method).toBe("batch");
  });

  it("should throw error for empty proof array", async () => {
    const aggregator = new ProofAggregator();

    await expect(aggregator.aggregate([])).rejects.toThrow(
      "Proofs must be a non-empty array"
    );
  });

  it("should track aggregation statistics", async () => {
    const aggregator = new ProofAggregator();

    const generator = new RouterProofGenerator();
    const proofs = await Promise.all([
      generator.generate({
        query: "query1",
        complexity: 0.3,
        confidence: 0.9,
        route: "local",
        threshold: 0.6,
        reason: "test1",
      }),
    ]);

    await aggregator.aggregate(proofs);

    const stats = aggregator.getStats();

    expect(stats.aggregationCount).toBe(1);
    expect(stats.totalAggregatedProofs).toBe(1);
    expect(stats.totalSpaceSaved).toBeGreaterThan(0);
  });
});

describe("AggregatedProofVerifier", () => {
  it("should verify an aggregated proof", async () => {
    const aggregator = new ProofAggregator();
    const verifier = new AggregatedProofVerifier();

    const generator = new RouterProofGenerator();
    const proofs = await Promise.all([
      generator.generate({
        query: "query1",
        complexity: 0.3,
        confidence: 0.9,
        route: "local",
        threshold: 0.6,
        reason: "test1",
      }),
      generator.generate({
        query: "query2",
        complexity: 0.7,
        confidence: 0.8,
        route: "cloud",
        threshold: 0.6,
        reason: "test2",
      }),
    ]);

    const aggregated = await aggregator.aggregate(proofs);

    const result = await verifier.verify(
      aggregated.aggregatedProof,
      proofs
    );

    expect(result.valid).toBe(true);
    expect(result.allProofsValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should batch verify multiple aggregated proofs", async () => {
    const aggregator = new ProofAggregator();
    const verifier = new AggregatedProofVerifier();

    const generator = new RouterProofGenerator();

    const batch1 = await Promise.all([
      generator.generate({
        query: "query1",
        complexity: 0.3,
        confidence: 0.9,
        route: "local",
        threshold: 0.6,
        reason: "test1",
      }),
      generator.generate({
        query: "query2",
        complexity: 0.7,
        confidence: 0.8,
        route: "cloud",
        threshold: 0.6,
        reason: "test2",
      }),
    ]);

    const batch2 = await Promise.all([
      generator.generate({
        query: "query3",
        complexity: 0.5,
        confidence: 0.85,
        route: "hybrid",
        threshold: 0.5,
        reason: "test3",
      }),
    ]);

    const agg1 = await aggregator.aggregate(batch1);
    const agg2 = await aggregator.aggregate(batch2);

    const results = await verifier.verifyBatch([
      agg1.aggregatedProof,
      agg2.aggregatedProof,
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(true);
  });
});

describe("Proof aggregation helpers", () => {
  it("should estimate aggregation savings", async () => {
    const generator = new RouterProofGenerator();
    const proofs = await Promise.all([
      generator.generate({
        query: "query1",
        complexity: 0.3,
        confidence: 0.9,
        route: "local",
        threshold: 0.6,
        reason: "test1",
      }),
      generator.generate({
        query: "query2",
        complexity: 0.7,
        confidence: 0.8,
        route: "cloud",
        threshold: 0.6,
        reason: "test2",
      }),
      generator.generate({
        query: "query3",
        complexity: 0.5,
        confidence: 0.85,
        route: "hybrid",
        threshold: 0.5,
        reason: "test3",
      }),
    ]);

    const estimate = await estimateAggregationSavings(proofs);

    expect(estimate.originalSizeBytes).toBeGreaterThan(0);
    expect(estimate.estimatedAggregatedSizeBytes).toBeGreaterThan(0);
    expect(estimate.estimatedCompressionRatio).toBeGreaterThan(1);
    expect(estimate.estimatedSpaceSavedBytes).toBeGreaterThan(0);
    expect(estimate.estimatedSpaceSavedPercent).toBeGreaterThan(0);
    expect(estimate.estimatedSpaceSavedPercent).toBeLessThan(100);
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("ZKP Integration Tests", () => {
  it("should generate and verify routing proof end-to-end", async () => {
    const proof = await generateRoutingProof({
      query: "What is the capital of France?",
      complexity: 0.4,
      confidence: 0.95,
      route: "local",
      threshold: 0.6,
      reason: "Simple factual query",
    });

    const result = await verifyRoutingProof(proof);

    expect(result.valid).toBe(true);
    expect(result.correctRouting).toBe(true);
    expect(result.queryAuthentic).toBe(true);
  });

  it("should generate and verify range proof end-to-end", async () => {
    const proof = await generateRangeProof(25, 18, 120, true);

    const result = await verifyRangeProof(proof);

    expect(result.valid).toBe(true);
    expect(result.inRange).toBe(true);
  });

  it("should generate and verify set membership proof end-to-end", async () => {
    const proof = await generateSetMembershipProof(
      "user@example.com",
      ["user1@example.com", "user@example.com", "user3@example.com"]
    );

    const result = await verifySetMembershipProof(proof);

    expect(result.valid).toBe(true);
    expect(result.isMember).toBe(true);
  });

  it("should generate and verify disjunction proof end-to-end", async () => {
    const statements: DisjunctionStatement[] = [
      {
        statementId: "stmt1",
        publicInputs: {},
        constraints: ["age >= 18"],
        description: "Over 18",
      },
      {
        statementId: "stmt2",
        publicInputs: {},
        constraints: ["hasConsent == true"],
        description: "Has consent",
      },
    ];

    const proof = await generateDisjunctionProof(statements, 0, { age: 25 });

    const result = await verifyDisjunctionProof(proof);

    expect(result.valid).toBe(true);
    expect(result.atLeastOneTrue).toBe(true);
  });

  it("should aggregate and verify multiple different proof types", async () => {
    const routingProof = await generateRoutingProof({
      query: "test",
      complexity: 0.5,
      confidence: 0.8,
      route: "local",
      threshold: 0.6,
      reason: "test",
    });

    const rangeProof = await generateRangeProof(25, 18, 120);

    const membershipProof = await generateSetMembershipProof(
      "user@example.com",
      ["user@example.com", "other@example.com"]
    );

    const aggregated = await aggregateProofs([
      routingProof,
      rangeProof,
      membershipProof,
    ]);

    expect(aggregated.stats.compressionRatio).toBeGreaterThan(1);
    expect(aggregated.aggregatedProof.data.proofCount).toBe(3);

    const result = await verifyAggregatedProof(
      aggregated.aggregatedProof,
      [routingProof, rangeProof, membershipProof]
    );

    expect(result.valid).toBe(true);
    expect(result.allProofsValid).toBe(true);
  });
});
