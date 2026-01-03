/**
 * @fileoverview Zero Knowledge Proof Usage Examples
 *
 * Demonstrates various ZKP use cases for the Aequor platform:
 * - Proving routing decisions without revealing queries
 * - Proving age/credentials without revealing exact values
 * - Proving set membership (allowlists, credentials)
 * - General ZKP patterns
 */

import {
  ZKPSystem,
  ProofGenerator,
  ProofVerifier,
} from "./index.js";
import {
  RouterProofGenerator,
  RouterProofVerifier,
  generateRoutingProof,
  createRoutingProof,
} from "./RouterZKP.js";
import {
  RangeProof,
  proveAgeRange,
  proveScoreRange,
} from "./RangeProof.js";
import {
  SetMembershipProof,
  proveEmailOnAllowlist,
  proveCredentialValid,
  proveUserInGroup,
} from "./SetMembershipProof.js";

// ============================================================================
// EXAMPLE 1: ROUTING DECISION PROOFS
// ============================================================================

/**
 * Example 1: Prove routing decision without revealing query
 *
 * Scenario: A cloud service wants to prove they routed a query correctly
 * based on its complexity, without revealing the actual query content.
 */
export async function example1_routingDecision() {
  console.log("\n=== Example 1: Routing Decision Proof ===\n");

  // Create proof generator and verifier
  const generator = new RouterProofGenerator();
  const verifier = new RouterProofVerifier();

  // Generate a routing proof
  // The query text is SECRET and will not be revealed
  const proof = await generator.generate({
    query: "Explain quantum entanglement in simple terms", // SECRET
    complexity: 0.85, // SECRET
    confidence: 0.92,
    route: "cloud", // This is revealed (public)
    threshold: 0.6, // This is revealed (public)
    reason: "Complexity > 0.6, requires cloud model",
  });

  console.log("Generated routing proof:");
  console.log(`  Proof ID: ${proof.proofId}`);
  console.log(`  Route: ${proof.statement.publicInputs.selectedRoute}`);
  console.log(`  Query hash: ${proof.proofData.queryHash.substring(0, 16)}...`);
  console.log(`  Query commitment: ${proof.proofData.commitments.queryCommitment.value.substring(0, 16)}...`);

  // Verify the proof without learning the query
  const result = await verifier.verify(proof);

  console.log("\nVerification result:");
  console.log(`  Valid: ${result.valid}`);
  console.log(`  Correct routing: ${result.correctRouting}`);
  console.log(`  Query authentic: ${result.queryAuthentic}`);

  // The verifier knows the routing was correct but doesn't know the query!

  return { proof, result };
}

/**
 * Example 1b: Create routing proof from CascadeRouter output
 *
 * Convenience function for integrating with CascadeRouter.
 */
export async function example1b_routingFromCascade() {
  console.log("\n=== Example 1b: Routing from CascadeRouter ===\n");

  // Simulate output from CascadeRouter
  const query = "What is the capital of France?";
  const complexity = 0.45; // Low complexity
  const route: "local" | "cloud" | "hybrid" = "local";
  const threshold = 0.6;

  // Create proof directly
  const proof = await createRoutingProof(query, complexity, route, threshold);

  console.log("Generated proof from routing decision:");
  console.log(`  Route: ${proof.statement.publicInputs.selectedRoute}`);
  console.log(`  Reason: ${proof.statement.publicInputs.reason}`);

  return proof;
}

// ============================================================================
// EXAMPLE 2: AGE VERIFICATION
// ============================================================================

/**
 * Example 2: Prove age is in range without revealing exact age
 *
 * Scenario: Prove you're 18+ without revealing your actual age.
 * Useful for age-gated content while preserving privacy.
 */
export async function example2_ageVerification() {
  console.log("\n=== Example 2: Age Verification ===\n");

  const actualAge = 28; // SECRET - we don't want to reveal this
  const minAge = 18;
  const maxAge = 120;

  // Generate proof that age is in range [18, 120]
  const proof = await proveAgeRange(actualAge, minAge, maxAge);

  console.log("Generated age range proof:");
  console.log(`  Proof type: ${proof.type}`);
  console.log(`  Range: [${proof.statement.publicInputs.min}, ${proof.statement.publicInputs.max}]`);
  console.log(`  Value commitment: ${proof.proofData.valueCommitment.value.substring(0, 16)}...`);

  // Verifier can check the proof
  const rangeProof = new RangeProof();
  const verifier = new (await import("./RangeProof.js")).RangeProofVerifier();
  const result = await verifier.verify(proof);

  console.log("\nVerification result:");
  console.log(`  Valid: ${result.valid}`);
  console.log(`  In range: ${result.inRange}`);

  // Verifier knows age is >= 18 but not the exact age!

  return { proof, result, actualAge };
}

// ============================================================================
// EXAMPLE 3: SCORE VERIFICATION
// ============================================================================

/**
 * Example 3: Prove passing score without revealing exact score
 *
 * Scenario: Prove you passed a test without revealing your exact score.
 */
export async function example3_scoreVerification() {
  console.log("\n=== Example 3: Score Verification ===\n");

  const actualScore = 87; // SECRET
  const passingScore = 60;
  const maxScore = 100;

  // Generate proof that score is in range [60, 100]
  const proof = await proveScoreRange(actualScore, passingScore, maxScore);

  console.log("Generated score range proof:");
  console.log(`  Range: [${proof.statement.publicInputs.min}, ${proof.statement.publicInputs.max}]`);
  console.log(`  Range size: ${proof.proofData.metadata.rangeSize}`);

  const verifier = new (await import("./RangeProof.js")).RangeProofVerifier();
  const result = await verifier.verify(proof);

  console.log("\nVerification result:");
  console.log(`  Passed: ${result.valid && result.inRange}`);

  return { proof, result, actualScore };
}

// ============================================================================
// EXAMPLE 4: ALLOWLIST MEMBERSHIP
// ============================================================================

/**
 * Example 4: Prove email is on allowlist
 *
 * Scenario: Prove your email is on an allowlist without revealing
 * which email address is yours.
 */
export async function example4_allowlistMembership() {
  console.log("\n=== Example 4: Allowlist Membership ===\n");

  const companyAllowlist = [
    "alice@company.com",
    "bob@company.com",
    "charlie@company.com",
    "david@company.com",
  ];

  const myEmail = "charlie@company.com"; // SECRET

  // Generate proof that email is on allowlist
  const proof = await proveEmailOnAllowlist(myEmail, companyAllowlist);

  console.log("Generated allowlist membership proof:");
  console.log(`  Set size: ${proof.statement.publicInputs.setSize}`);
  console.log(`  Set hash: ${String(proof.statement.publicInputs.setHash).substring(0, 16)}...`);
  console.log(`  Element commitment: ${proof.proofData.elementCommitment.value.substring(0, 16)}...`);

  // Verifier checks proof
  const verifier = new (await import("./SetMembershipProof.js")).SetMembershipProofVerifier();
  const result = await verifier.verify(proof);

  console.log("\nVerification result:");
  console.log(`  On allowlist: ${result.valid && result.isMember}`);

  // Verifier knows email is on allowlist but not which one!

  return { proof, result, myEmail };
}

// ============================================================================
// EXAMPLE 5: CREDENTIAL VALIDATION
// ============================================================================

/**
 * Example 5: Prove credential is valid
 *
 * Scenario: Prove you have a valid credential without revealing
 * which specific credential you hold.
 */
export async function example5_credentialValidation() {
  console.log("\n=== Example 5: Credential Validation ===\n");

  const validCredentials = [
    "premium_2024",
    "enterprise_2024",
    "basic_2024",
  ];

  const myCredential = "premium_2024"; // SECRET

  // Generate proof that credential is valid
  const proof = await proveCredentialValid(myCredential, validCredentials);

  console.log("Generated credential validity proof:");
  console.log(`  Valid credentials: ${proof.statement.publicInputs.setSize}`);
  console.log(`  Tree depth: ${proof.proofData.metadata.treeDepth}`);

  const verifier = new (await import("./SetMembershipProof.js")).SetMembershipProofVerifier();
  const result = await verifier.verify(proof);

  console.log("\nVerification result:");
  console.log(`  Credential valid: ${result.valid && result.isMember}`);

  return { proof, result, myCredential };
}

// ============================================================================
// EXAMPLE 6: GROUP MEMBERSHIP
// ============================================================================

/**
 * Example 6: Prove user is in group
 *
 * Scenario: Prove you're a member of a group without revealing
 * your specific identity.
 */
export async function example6_groupMembership() {
  console.log("\n=== Example 6: Group Membership ===\n");

  const adminGroup = [
    "user_12345",
    "user_67890",
    "user_24680",
  ];

  const myUserId = "user_67890"; // SECRET

  // Generate proof of group membership
  const proof = await proveUserInGroup(myUserId, adminGroup, "admin_group");

  console.log("Generated group membership proof:");
  console.log(`  Group ID: ${proof.statement.publicInputs.contextId}`);
  console.log(`  Group size: ${proof.statement.publicInputs.setSize}`);

  const verifier = new (await import("./SetMembershipProof.js")).SetMembershipProofVerifier();
  const result = await verifier.verify(proof);

  console.log("\nVerification result:");
  console.log(`  Is admin: ${result.valid && result.isMember}`);

  return { proof, result, myUserId };
}

// ============================================================================
// EXAMPLE 7: BATCH VERIFICATION
// ============================================================================

/**
 * Example 7: Verify multiple proofs efficiently
 *
 * Scenario: Verify many routing proofs at once (e.g., audit log).
 */
export async function example7_batchVerification() {
  console.log("\n=== Example 7: Batch Verification ===\n");

  const generator = new RouterProofGenerator();
  const verifier = new RouterProofVerifier();

  // Generate multiple routing proofs
  const proofs = await Promise.all([
    generator.generate({
      query: "Simple question",
      complexity: 0.3,
      confidence: 0.95,
      route: "local",
      threshold: 0.6,
      reason: "Low complexity",
    }),
    generator.generate({
      query: "Complex analysis",
      complexity: 0.9,
      confidence: 0.7,
      route: "cloud",
      threshold: 0.6,
      reason: "High complexity",
    }),
    generator.generate({
      query: "Medium query",
      complexity: 0.6,
      confidence: 0.8,
      route: "hybrid",
      threshold: 0.6,
      reason: "Hybrid routing",
    }),
  ]);

  console.log(`Generated ${proofs.length} proofs`);

  // Verify all at once
  const results = await verifier.verifyBatch(proofs);

  console.log("\nBatch verification results:");
  results.forEach((result, i) => {
    console.log(`  Proof ${i + 1}: valid=${result.valid}, correct=${result.correctRouting}`);
  });

  const allValid = results.every(r => r.valid && r.correctRouting);
  console.log(`\nAll proofs valid: ${allValid}`);

  return { proofs, results };
}

// ============================================================================
// EXAMPLE 8: GENERAL ZKP
// ============================================================================

/**
 * Example 8: General purpose ZKP
 *
 * Scenario: Create a custom ZKP for arbitrary statements.
 */
export async function example8_generalZKP() {
  console.log("\n=== Example 8: General ZKP ===\n");

  const generator = new ProofGenerator();
  const verifier = new ProofVerifier();

  // Define a custom statement
  const statement = generator.createStatement(
    "COMPUTATION",
    "Sum of two secret numbers equals a public value",
    { publicSum: 42 },
    ["a + b == 42", "a > 0", "b > 0"]
  );

  // Create witness (secret values)
  const witness = await generator.createWitness({
    a: 15, // SECRET
    b: 27, // SECRET
  });

  // Generate proof
  const proof = await generator.generate(
    "COMPUTATION",
    statement,
    witness,
    { customData: "example" }
  );

  console.log("Generated general ZKP:");
  console.log(`  Type: ${proof.type}`);
  console.log(`  Claim: ${proof.statement.claim}`);
  console.log(`  Constraints: ${proof.statement.constraints.length}`);

  // Verify
  const result = await verifier.verify(proof);

  console.log("\nVerification result:");
  console.log(`  Valid: ${result.valid}`);

  return { proof, result };
}

// ============================================================================
// EXAMPLE 9: COMMITMENTS
// ============================================================================

/**
 * Example 9: Cryptographic commitments
 *
 * Scenario: Commit to values and reveal them later.
 */
export async function example9_commitments() {
  console.log("\n=== Example 9: Cryptographic Commitments ===\n");

  const generator = new ProofGenerator();

  // Commit to a secret value
  const secretValue = "My secret payload";
  const commitment = await generator.generateCommitment(secretValue);

  console.log("Generated commitment:");
  console.log(`  Commitment: ${commitment.value.substring(0, 16)}...`);
  console.log(`  Randomness: ${commitment.randomness?.substring(0, 16)}...`);
  console.log(`  Timestamp: ${commitment.timestamp}`);

  // Later, reveal the value
  const opening: any = {
    value: secretValue,
    randomness: commitment.randomness!,
    commitment: commitment,
  };

  const verifier = new ProofVerifier();
  const valid = await verifier.verifyCommitmentOpening(commitment, opening);

  console.log("\nCommitment verification:");
  console.log(`  Valid: ${valid}`);

  return { commitment, opening, valid };
}

// ============================================================================
// EXAMPLE 10: INTEGRATED WORKFLOW
// ============================================================================

/**
 * Example 10: Integrated ZKP workflow with Aequor
 *
 * Scenario: Complete workflow showing ZKP in the context of Aequor routing.
 */
export async function example10_integratedWorkflow() {
  console.log("\n=== Example 10: Integrated Aequor Workflow ===\n");

  // Simulate user query
  const userQuery = "Design a microservices architecture for a scalable e-commerce platform";

  // Simulate CascadeRouter analysis
  const complexity = 0.92; // High complexity
  const route: "local" | "cloud" = "cloud";
  const threshold = 0.6;
  const confidence = 0.88;

  console.log("User query:", userQuery);
  console.log(`Complexity: ${complexity.toFixed(2)} → Route: ${route}`);

  // Generate ZKP for routing decision
  const proof = await createRoutingProof(userQuery, complexity, route, threshold);

  console.log("\nGenerated routing proof:");
  console.log(`  Proof ID: ${proof.proofId}`);
  console.log(`  Route: ${proof.statement.publicInputs.selectedRoute}`);

  // Verify proof (simulating audit/trust verification)
  const verifier = new RouterProofVerifier();
  const result = await verifier.verify(proof);

  console.log("\nAudit verification:");
  console.log(`  Routing valid: ${result.valid && result.correctRouting}`);
  console.log(`  Query authentic: ${result.queryAuthentic}`);

  // Auditor knows routing was correct but didn't see the query!

  console.log("\nPrivacy achieved:");
  console.log("  ✓ Routing decision verified");
  console.log("  ✓ Query content kept private");
  console.log("  ✓ No sensitive data exposed");

  return { query: userQuery, proof, verification: result };
}

// ============================================================================
// RUN ALL EXAMPLES
// ============================================================================

/**
 * Run all ZKP examples
 */
export async function runAllExamples() {
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║     Zero Knowledge Proof Examples for Aequor            ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  try {
    await example1_routingDecision();
    await example1b_routingFromCascade();
    await example2_ageVerification();
    await example3_scoreVerification();
    await example4_allowlistMembership();
    await example5_credentialValidation();
    await example6_groupMembership();
    await example7_batchVerification();
    await example8_generalZKP();
    await example9_commitments();
    await example10_integratedWorkflow();

    console.log("\n✓ All examples completed successfully!");
  } catch (error) {
    console.error("\n✗ Example failed:", error);
  }
}

// Export individual examples for selective running
export const examples = {
  routingDecision: example1_routingDecision,
  routingFromCascade: example1b_routingFromCascade,
  ageVerification: example2_ageVerification,
  scoreVerification: example3_scoreVerification,
  allowlistMembership: example4_allowlistMembership,
  credentialValidation: example5_credentialValidation,
  groupMembership: example6_groupMembership,
  batchVerification: example7_batchVerification,
  generalZKP: example8_generalZKP,
  commitments: example9_commitments,
  integratedWorkflow: example10_integratedWorkflow,
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}
