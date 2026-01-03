/**
 * @fileoverview Zero Knowledge Proof System Tests
 *
 * Comprehensive test suite for ZKP functionality including:
 * - Core ZKP system tests
 * - Proof generation tests
 * - Proof verification tests
 * - Routing proof tests
 * - Range proof tests
 * - Set membership proof tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ZKPSystem,
  ProofGenerator,
  ProofVerifier,
} from "./index.js";
import {
  RouterProofGenerator,
  RouterProofVerifier,
  generateRoutingProof,
  verifyRoutingProof,
  createRoutingProof,
} from "./RouterZKP.js";
import {
  RangeProof,
  RangeProofVerifier,
  generateRangeProof,
  verifyRangeProof,
  proveAgeRange,
  proveScoreRange,
} from "./RangeProof.js";
import {
  SetMembershipProof,
  SetMembershipProofVerifier,
  generateSetMembershipProof,
  verifySetMembershipProof,
  proveEmailOnAllowlist,
  proveCredentialValid,
  proveUserInGroup,
} from "./SetMembershipProof.js";
import {
  generateProofId,
  validateProofFormat,
  checkProofFreshness,
  computeCommitment,
  verifyCommitment,
  hashToField,
  serializeProof,
  deserializeProof,
} from "./utils.js";
import type { ZKPProof } from "./types.js";

// ============================================================================
// FIXTURES
// ============================================================================

function createTestProof(): ZKPProof {
  return {
    proofId: "test_proof_123" as any,
    type: "ROUTING",
    statement: {
      statementId: "stmt_test_123",
      type: "ROUTING",
      publicInputs: {
        complexityThreshold: 0.6,
        selectedRoute: "cloud",
        reason: "High complexity",
        timestamp: Date.now(),
      },
      claim: "Test claim",
      constraints: ["complexity > 0.6"],
    },
    proofData: {
      commitments: {
        queryCommitment: {
          value: "hash123",
          commitmentId: "commit_123",
          timestamp: Date.now(),
        },
      },
      queryHash: "query_hash_123",
      routingSignature: "sig_123",
      metadata: {
        constraintCount: 1,
        securityLevel: "HIGH",
        method: "non-interactive",
      },
    },
    metadata: {
      securityLevel: "HIGH",
      generationTimeMs: 100,
      proofSizeBytes: 1024,
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000,
    version: "1.0.0",
  };
}

// ============================================================================
// CORE ZKP SYSTEM TESTS
// ============================================================================

describe("ZKPSystem", () => {
  let zkp: ZKPSystem;

  beforeEach(() => {
    zkp = new ZKPSystem({
      securityLevel: "HIGH",
      hashFunction: "SHA256",
      enableProofCaching: true,
    });
  });

  describe("initialization", () => {
    it("should create ZKP system with default config", () => {
      const system = new ZKPSystem();
      expect(system).toBeDefined();
      const config = system.getConfig();
      expect(config.securityLevel).toBe("HIGH");
    });

    it("should create ZKP system with custom config", () => {
      const system = new ZKPSystem({
        securityLevel: "VERY_HIGH",
        enableProofCaching: false,
      });
      const config = system.getConfig();
      expect(config.securityLevel).toBe("VERY_HIGH");
      expect(config.enableProofCaching).toBe(false);
    });
  });

  describe("proof verification", () => {
    it("should verify a valid proof", async () => {
      const proof = createTestProof();
      const result = await zkp.verify(proof);

      expect(result.valid).toBe(true);
      expect(result.verificationId).toBeDefined();
      expect(result.verifiedAt).toBeDefined();
    });

    it("should reject an invalid proof format", async () => {
      const invalidProof = { invalid: "data" } as any;
      const result = await zkp.verify(invalidProof);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid proof format");
    });

    it("should reject an expired proof", async () => {
      const proof = createTestProof();
      proof.expiresAt = Date.now() - 1000; // Expired

      const result = await zkp.verify(proof);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("expired");
    });
  });

  describe("batch verification", () => {
    it("should verify multiple proofs", async () => {
      const proofs = [
        createTestProof(),
        createTestProof(),
        createTestProof(),
      ];

      const results = await zkp.verifyBatch(proofs);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.valid)).toBe(true);
    });

    it("should handle mixed valid and invalid proofs", async () => {
      const proofs = [
        createTestProof(),
        { invalid: "data" } as any,
        createTestProof(),
      ];

      const results = await zkp.verifyBatch(proofs);

      expect(results).toHaveLength(3);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(true);
    });
  });

  describe("caching", () => {
    it("should cache verified proofs", async () => {
      const proof = createTestProof();

      // First verification
      await zkp.verify(proof);
      const stats1 = zkp.getCacheStats();
      expect(stats1.misses).toBe(1);

      // Second verification (from cache)
      await zkp.verify(proof);
      const stats2 = zkp.getCacheStats();
      expect(stats2.hits).toBe(1);
    });

    it("should clear cache", async () => {
      const proof = createTestProof();
      await zkp.verify(proof);

      zkp.clearCache();
      const stats = zkp.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("configuration", () => {
    it("should update configuration", () => {
      zkp.updateConfig({
        securityLevel: "MEDIUM",
        enableProofCaching: false,
      });

      const config = zkp.getConfig();
      expect(config.securityLevel).toBe("MEDIUM");
      expect(config.enableProofCaching).toBe(false);
    });

    it("should set security level", () => {
      zkp.setSecurityLevel("VERY_HIGH");
      const config = zkp.getConfig();
      expect(config.securityLevel).toBe("VERY_HIGH");
    });
  });
});

// ============================================================================
// PROOF GENERATOR TESTS
// ============================================================================

describe("ProofGenerator", () => {
  let generator: ProofGenerator;

  beforeEach(() => {
    generator = new ProofGenerator({
      securityLevel: "HIGH",
      hashFunction: "SHA256",
    });
  });

  describe("proof generation", () => {
    it("should generate a basic proof", async () => {
      const statement = {
        statementId: "stmt_test",
        type: "ROUTING" as const,
        publicInputs: { threshold: 0.6 },
        claim: "Test claim",
        constraints: ["complexity > 0.6"],
      };

      const witness = {
        witnessId: "witness_test",
        privateInputs: { complexity: 0.8 },
        commitments: {},
      };

      const proof = await generator.generate("ROUTING", statement, witness);

      expect(proof.proofId).toBeDefined();
      expect(proof.type).toBe("ROUTING");
      expect(proof.createdAt).toBeDefined();
      expect(proof.metadata.generationTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("commitment generation", () => {
    it("should generate commitment to value", async () => {
      const commitment = await generator.generateCommitment("secret_value");

      expect(commitment.value).toBeDefined();
      expect(commitment.commitmentId).toBeDefined();
      expect(commitment.timestamp).toBeDefined();
      expect(commitment.randomness).toBeDefined();
    });

    it("should generate commitment with custom randomness", async () => {
      const randomness = "custom_randomness";
      const commitment = await generator.generateCommitment("value", randomness);

      expect(commitment.randomness).toBe(randomness);
    });
  });

  describe("witness creation", () => {
    it("should create witness from private inputs", async () => {
      const witness = await generator.createWitness({
        secret: "value",
        score: 0.85,
      });

      expect(witness.witnessId).toBeDefined();
      expect(witness.privateInputs).toEqual({ secret: "value", score: 0.85 });
      expect(witness.commitments).toBeDefined();
    });
  });

  describe("statement creation", () => {
    it("should create statement from inputs", () => {
      const statement = generator.createStatement(
        "ROUTING",
        "Routing decision claim",
        { threshold: 0.6 },
        ["complexity > 0.6"]
      );

      expect(statement.statementId).toBeDefined();
      expect(statement.type).toBe("ROUTING");
      expect(statement.claim).toBe("Routing decision claim");
      expect(statement.constraints).toEqual(["complexity > 0.6"]);
    });
  });
});

// ============================================================================
// PROOF VERIFIER TESTS
// ============================================================================

describe("ProofVerifier", () => {
  let verifier: ProofVerifier;

  beforeEach(() => {
    verifier = new ProofVerifier({
      enableCaching: true,
      verifyCommitments: true,
    });
  });

  describe("proof verification", () => {
    it("should verify valid proof", async () => {
      const proof = createTestProof();
      const result = await verifier.verify(proof);

      expect(result.valid).toBe(true);
    });

    it("should verify multiple proofs", async () => {
      const proofs = [createTestProof(), createTestProof()];
      const results = await verifier.verifyBatch(proofs);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.valid)).toBe(true);
    });
  });
});

// ============================================================================
// ROUTING PROOF TESTS
// ============================================================================

describe("RouterProofGenerator", () => {
  let generator: RouterProofGenerator;

  beforeEach(() => {
    generator = new RouterProofGenerator();
  });

  describe("proof generation", () => {
    it("should generate routing proof for cloud route", async () => {
      const proof = await generator.generate({
        query: "What is the meaning of life?",
        complexity: 0.85,
        confidence: 0.9,
        route: "cloud",
        threshold: 0.6,
        reason: "High complexity",
      });

      expect(proof.type).toBe("ROUTING");
      expect(proof.statement.publicInputs.selectedRoute).toBe("cloud");
      expect(proof.proofData.commitments).toBeDefined();
    });

    it("should generate routing proof for local route", async () => {
      const proof = await generator.generate({
        query: "Hello world",
        complexity: 0.3,
        confidence: 0.95,
        route: "local",
        threshold: 0.6,
        reason: "Low complexity",
      });

      expect(proof.statement.publicInputs.selectedRoute).toBe("local");
    });

    it("should generate routing proof for hybrid route", async () => {
      const proof = await generator.generate({
        query: "Medium complexity query",
        complexity: 0.6,
        confidence: 0.7,
        route: "hybrid",
        threshold: 0.6,
        reason: "Hybrid routing",
      });

      expect(proof.statement.publicInputs.selectedRoute).toBe("hybrid");
    });
  });
});

describe("RouterProofVerifier", () => {
  let verifier: RouterProofVerifier;
  let generator: RouterProofGenerator;

  beforeEach(() => {
    verifier = new RouterProofVerifier();
    generator = new RouterProofGenerator();
  });

  describe("proof verification", () => {
    it("should verify valid routing proof", async () => {
      const proof = await generator.generate({
        query: "Test query",
        complexity: 0.8,
        confidence: 0.85,
        route: "cloud",
        threshold: 0.6,
        reason: "High complexity",
      });

      const result = await verifier.verify(proof);

      expect(result.valid).toBe(true);
      expect(result.correctRouting).toBe(true);
      expect(result.queryAuthentic).toBe(true);
    });

    it("should batch verify routing proofs", async () => {
      const proofs = await Promise.all([
        generator.generate({
          query: "Query 1",
          complexity: 0.7,
          confidence: 0.8,
          route: "cloud",
          threshold: 0.6,
          reason: "High complexity",
        }),
        generator.generate({
          query: "Query 2",
          complexity: 0.4,
          confidence: 0.9,
          route: "local",
          threshold: 0.6,
          reason: "Low complexity",
        }),
      ]);

      const results = await verifier.verifyBatch(proofs);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.valid && r.correctRouting)).toBe(true);
    });
  });
});

describe("routing proof convenience functions", () => {
  it("should generate routing proof", async () => {
    const proof = await generateRoutingProof({
      query: "Test",
      complexity: 0.8,
      confidence: 0.85,
      route: "cloud",
      threshold: 0.6,
      reason: "Test",
    });

    expect(proof.type).toBe("ROUTING");
  });

  it("should verify routing proof", async () => {
    const proof = await createRoutingProof("Test query", 0.8, "cloud");
    const result = await verifyRoutingProof(proof);

    expect(result.valid).toBe(true);
  });

  it("should create routing proof from decision", async () => {
    const proof = await createRoutingProof(
      "Complex query about quantum computing",
      0.9,
      "cloud",
      0.6
    );

    expect(proof.type).toBe("ROUTING");
    expect(proof.statement.publicInputs.selectedRoute).toBe("cloud");
  });
});

// ============================================================================
// RANGE PROOF TESTS
// ============================================================================

describe("RangeProof", () => {
  let generator: RangeProof;

  beforeEach(() => {
    generator = new RangeProof();
  });

  describe("proof generation", () => {
    it("should generate range proof for value in range", async () => {
      const proof = await generator.generate({
        value: 25,
        min: 18,
        max: 120,
        inclusive: true,
      });

      expect(proof.type).toBe("RANGE");
      expect(proof.statement.publicInputs.min).toBe(18);
      expect(proof.statement.publicInputs.max).toBe(120);
      expect(proof.proofData.valueCommitment).toBeDefined();
    });

    it("should generate range proof for exclusive range", async () => {
      const proof = await generator.generate({
        value: 25,
        min: 18,
        max: 120,
        inclusive: false,
      });

      expect(proof.statement.publicInputs.inclusive).toBe(false);
    });

    it("should reject value outside range", async () => {
      await expect(
        generator.generate({
          value: 15,
          min: 18,
          max: 120,
          inclusive: true,
        })
      ).rejects.toThrow("not in range");
    });
  });
});

describe("RangeProofVerifier", () => {
  let generator: RangeProof;
  let verifier: RangeProofVerifier;

  beforeEach(() => {
    generator = new RangeProof();
    verifier = new RangeProofVerifier();
  });

  describe("proof verification", () => {
    it("should verify valid range proof", async () => {
      const proof = await generator.generate({
        value: 30,
        min: 18,
        max: 65,
        inclusive: true,
      });

      const result = await verifier.verify(proof);

      expect(result.valid).toBe(true);
      expect(result.inRange).toBe(true);
    });
  });
});

describe("range proof convenience functions", () => {
  it("should generate range proof", async () => {
    const proof = await generateRangeProof(25, 18, 120, true);

    expect(proof.type).toBe("RANGE");
  });

  it("should verify range proof", async () => {
    const proof = await generateRangeProof(25, 18, 120, true);
    const result = await verifyRangeProof(proof);

    expect(result.valid).toBe(true);
    expect(result.inRange).toBe(true);
  });

  it("should prove age range", async () => {
    const proof = await proveAgeRange(25, 18, 120);

    expect(proof.type).toBe("RANGE");
    expect(proof.statement.publicInputs.min).toBe(18);
    expect(proof.statement.publicInputs.max).toBe(120);
  });

  it("should prove score range", async () => {
    const proof = await proveScoreRange(85, 60, 100);

    expect(proof.type).toBe("RANGE");
    expect(proof.statement.publicInputs.min).toBe(60);
    expect(proof.statement.publicInputs.max).toBe(100);
  });
});

// ============================================================================
// SET MEMBERSHIP PROOF TESTS
// ============================================================================

describe("SetMembershipProof", () => {
  let generator: SetMembershipProof;
  let testSet: string[];

  beforeEach(() => {
    generator = new SetMembershipProof();
    testSet = ["alice@example.com", "bob@example.com", "charlie@example.com"];
  });

  describe("proof generation", () => {
    it("should generate set membership proof", async () => {
      const proof = await generator.generate({
        element: "alice@example.com",
        set: testSet,
      });

      expect(proof.type).toBe("MEMBERSHIP");
      expect(proof.statement.publicInputs.setSize).toBe(3);
      expect(proof.proofData.elementCommitment).toBeDefined();
      expect(proof.proofData.merkleProof).toBeDefined();
    });

    it("should generate proof for element in large set", async () => {
      const largeSet = Array.from({ length: 100 }, (_, i) => `user${i}@example.com`);

      const proof = await generator.generate({
        element: "user50@example.com",
        set: largeSet,
      });

      expect(proof.statement.publicInputs.setSize).toBe(100);
      expect(proof.proofData.metadata.treeDepth).toBeGreaterThan(0);
    });

    it("should reject element not in set", async () => {
      await expect(
        generator.generate({
          element: "dave@example.com",
          set: testSet,
        })
      ).rejects.toThrow("not in the set");
    });
  });
});

describe("SetMembershipProofVerifier", () => {
  let generator: SetMembershipProof;
  let verifier: SetMembershipProofVerifier;
  let testSet: string[];

  beforeEach(() => {
    generator = new SetMembershipProof();
    verifier = new SetMembershipProofVerifier();
    testSet = ["alice", "bob", "charlie"];
  });

  describe("proof verification", () => {
    it("should verify valid set membership proof", async () => {
      const proof = await generator.generate({
        element: "bob",
        set: testSet,
      });

      const result = await verifier.verify(proof);

      expect(result.valid).toBe(true);
      expect(result.isMember).toBe(true);
    });

    it("should batch verify set membership proofs", async () => {
      const proofs = await Promise.all([
        generator.generate({ element: "alice", set: testSet }),
        generator.generate({ element: "bob", set: testSet }),
      ]);

      const results = await verifier.verifyBatch(proofs);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.valid && r.isMember)).toBe(true);
    });
  });
});

describe("set membership convenience functions", () => {
  const allowlist = ["alice@company.com", "bob@company.com", "charlie@company.com"];

  it("should prove email on allowlist", async () => {
    const proof = await proveEmailOnAllowlist("bob@company.com", allowlist);

    expect(proof.type).toBe("MEMBERSHIP");
  });

  it("should prove credential valid", async () => {
    const validCredentials = ["cred_123", "cred_456", "cred_789"];

    const proof = await proveCredentialValid("cred_456", validCredentials);

    expect(proof.type).toBe("MEMBERSHIP");
  });

  it("should prove user in group", async () => {
    const groupMembers = ["user_1", "user_2", "user_3"];

    const proof = await proveUserInGroup("user_2", groupMembers, "group_alpha");

    expect(proof.type).toBe("MEMBERSHIP");
    expect(proof.statement.publicInputs.contextId).toBe("group_alpha");
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================

describe("utility functions", () => {
  describe("proof ID generation", () => {
    it("should generate unique proof IDs", () => {
      const id1 = generateProofId();
      const id2 = generateProofId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^zkp_/);
    });
  });

  describe("proof format validation", () => {
    it("should validate correct proof format", () => {
      const proof = createTestProof();
      expect(validateProofFormat(proof)).toBe(true);
    });

    it("should reject incorrect proof format", () => {
      expect(validateProofFormat({})).toBe(false);
      expect(validateProofFormat(null)).toBe(false);
    });
  });

  describe("proof freshness checking", () => {
    it("should check fresh proof", () => {
      const proof = createTestProof();
      expect(checkProofFreshness(proof)).toBe(true);
    });

    it("should check stale proof", () => {
      const proof = createTestProof();
      proof.expiresAt = Date.now() - 1000;
      expect(checkProofFreshness(proof)).toBe(false);
    });
  });

  describe("commitment operations", () => {
    it("should generate and verify commitment", async () => {
      const commitment = await computeCommitment("secret_value");

      const valid = await verifyCommitment(commitment, {
        value: "secret_value",
        randomness: commitment.randomness!,
      });

      expect(valid).toBe(true);
    });

    it("should reject invalid commitment opening", async () => {
      const commitment = await computeCommitment("secret_value");

      const valid = await verifyCommitment(commitment, {
        value: "wrong_value",
        randomness: commitment.randomness!,
      });

      expect(valid).toBe(false);
    });
  });

  describe("hash operations", () => {
    it("should hash string input", async () => {
      const hash = await hashToField("test_input");

      expect(hash.hex).toBeDefined();
      expect(hash.bytes).toBeDefined();
      expect(hash.hex.length).toBeGreaterThan(0);
    });

    it("should produce consistent hashes", async () => {
      const hash1 = await hashToField("consistent_input");
      const hash2 = await hashToField("consistent_input");

      expect(hash1.hex).toBe(hash2.hex);
    });

    it("should produce different hashes for different inputs", async () => {
      const hash1 = await hashToField("input_1");
      const hash2 = await hashToField("input_2");

      expect(hash1.hex).not.toBe(hash2.hex);
    });
  });

  describe("proof serialization", () => {
    it("should serialize proof to JSON", () => {
      const proof = createTestProof();
      const serialized = serializeProof(proof);

      expect(typeof serialized).toBe("string");
      expect(serialized).toContain("proofId");
      expect(serialized).toContain("type");
    });

    it("should deserialize proof from JSON", () => {
      const proof = createTestProof();
      const serialized = serializeProof(proof);
      const deserialized = deserializeProof(serialized);

      expect(deserialized.proofId).toBe(proof.proofId);
      expect(deserialized.type).toBe(proof.type);
    });

    it("should round-trip proof through serialization", () => {
      const proof = createTestProof();
      const serialized = serializeProof(proof);
      const deserialized = deserializeProof(serialized);

      expect(deserialized).toEqual(proof);
    });
  });
});
