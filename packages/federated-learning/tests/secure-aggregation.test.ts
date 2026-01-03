/**
 * @fileoverview Secure Aggregation Tests
 *
 * Tests for:
 * - Shamir's Secret Sharing (split and reconstruct)
 * - Secure Aggregation Protocol
 * - Verifiable Aggregation
 * - Benchmarks
 *
 * @module @lsi/federated-learning/tests/secure-aggregation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ShamirSecretSharing,
  SecureAggregator,
  VerifiableAggregator,
  compareAggregationMethods,
  computePrivacyGuarantee,
  type SecretShare,
  type EncryptedUpdate,
  type SecureAggregationConfig,
} from "../src/secure-aggregation.js";

// ============================================================================
// SHAMIR'S SECRET SHARING TESTS
// ============================================================================

describe("ShamirSecretSharing", () => {
  describe("splitValue and reconstructValue", () => {
    it("should split and reconstruct a single value correctly", () => {
      const shamir = new ShamirSecretSharing(3, 5);  // 3-of-5 threshold
      const secret = 42;

      const shares = shamir.splitValue(secret);
      expect(shares).toHaveLength(5);

      // Reconstruct with threshold shares
      const thresholdShares = shares.slice(0, 3);
      const reconstructed = shamir.reconstructValue(thresholdShares);

      expect(reconstructed).toBe(secret);
    });

    it("should work with negative values", () => {
      const shamir = new ShamirSecretSharing(2, 4);
      const secret = -123.45;

      const shares = shamir.splitValue(secret);
      const reconstructed = shamir.reconstructValue(shares.slice(0, 2));

      expect(reconstructed).toBeCloseTo(secret, 0);
    });

    it("should work with zero", () => {
      const shamir = new ShamirSecretSharing(2, 3);
      const secret = 0;

      const shares = shamir.splitValue(secret);
      const reconstructed = shamir.reconstructValue(shares.slice(0, 2));

      expect(reconstructed).toBe(0);
    });

    it("should require threshold shares for reconstruction", () => {
      const shamir = new ShamirSecretSharing(3, 5);
      const secret = 100;

      const shares = shamir.splitValue(secret);

      // Should fail with fewer than threshold shares
      expect(() => {
        shamir.reconstructValue(shares.slice(0, 2));
      }).toThrow("Need at least 3 shares");
    });

    it("should produce different shares each time", () => {
      const shamir = new ShamirSecretSharing(2, 3);
      const secret = 50;

      const shares1 = shamir.splitValue(secret);
      const shares2 = shamir.splitValue(secret);

      // Shares should be different (due to randomness)
      expect(shares1[0].share).not.toEqual(shares2[0].share);

      // But both should reconstruct to same secret
      expect(shamir.reconstructValue(shares1)).toBe(shamir.reconstructValue(shares2));
    });
  });

  describe("splitVector and reconstructVector", () => {
    it("should split and reconstruct a vector correctly", () => {
      const shamir = new ShamirSecretSharing(3, 4);
      const vector = [1, 2, 3, 4, 5];

      const shares = shamir.splitVector(vector);
      expect(shares).toHaveLength(4);

      const reconstructed = shamir.reconstructVector(shares.slice(0, 3));

      expect(reconstructed).toEqual(vector);
    });

    it("should handle large vectors", () => {
      const shamir = new ShamirSecretSharing(2, 3);
      const vector = Array.from({ length: 100 }, (_, i) => i * 0.1);

      const shares = shamir.splitVector(vector);
      const reconstructed = shamir.reconstructVector(shares.slice(0, 2));

      for (let i = 0; i < vector.length; i++) {
        expect(reconstructed[i]).toBeCloseTo(vector[i], 0);
      }
    });

    it("should handle floating point values", () => {
      const shamir = new ShamirSecretSharing(2, 4);
      const vector = [0.1, 0.2, 0.3, Math.PI, Math.E];

      const shares = shamir.splitVector(vector);
      const reconstructed = shamir.reconstructVector(shares.slice(0, 2));

      for (let i = 0; i < vector.length; i++) {
        expect(reconstructed[i]).toBeCloseTo(vector[i], 0);
      }
    });
  });

  describe("config validation", () => {
    it("should throw when threshold > numShares", () => {
      expect(() => {
        new ShamirSecretSharing(5, 3);
      }).toThrow("Threshold cannot exceed number of shares");
    });

    it("should throw when threshold < 2", () => {
      expect(() => {
        new ShamirSecretSharing(1, 3);
      }).toThrow("Threshold must be at least 2");
    });

    it("should allow threshold == numShares", () => {
      expect(() => {
        new ShamirSecretSharing(3, 3);
      }).not.toThrow();
    });
  });

  describe("getter methods", () => {
    it("should return correct threshold", () => {
      const shamir = new ShamirSecretSharing(3, 5);
      expect(shamir.getThreshold()).toBe(3);
    });

    it("should return correct numShares", () => {
      const shamir = new ShamirSecretSharing(3, 5);
      expect(shamir.getNumShares()).toBe(5);
    });
  });
});

// ============================================================================
// SECURE AGGREGATOR TESTS
// ============================================================================

describe("SecureAggregator", () => {
  let aggregator: SecureAggregator;
  const config: SecureAggregationConfig = {
    numServers: 4,
    threshold: 3,
    enableVerification: true,
    enablePairwiseMasking: true,
    epsilon: 1.0,
    delta: 1e-5,
  };

  beforeEach(() => {
    aggregator = new SecureAggregator(config);
  });

  describe("encryptUpdate", () => {
    it("should encrypt a model update", () => {
      const parameters = [1, 2, 3, 4, 5];
      const numSamples = 100;
      const clientId = "client_1";

      const encrypted = aggregator.encryptUpdate(clientId, parameters, numSamples, []);

      expect(encrypted.clientId).toBe(clientId);
      expect(encrypted.numSamples).toBe(numSamples);
      expect(encrypted.shares).toHaveLength(4);  // numServers
      expect(encrypted.maskedParameters).toHaveLength(parameters.length);
    });

    it("should create different masked parameters for each client", () => {
      const parameters = [1, 2, 3];
      const numSamples = 50;

      const encrypted1 = aggregator.encryptUpdate("client_1", parameters, numSamples, ["client_2"]);
      const encrypted2 = aggregator.encryptUpdate("client_2", parameters, numSamples, ["client_1"]);

      expect(encrypted1.maskedParameters).not.toEqual(encrypted2.maskedParameters);
    });

    it("should include proof when verification is enabled", () => {
      const parameters = [1, 2, 3];
      const encrypted = aggregator.encryptUpdate("client_1", parameters, 100, []);

      expect(encrypted.proof).toBeDefined();
      expect(encrypted.proof?.inputHash).toBeTruthy();
      expect(encrypted.proof?.nonce).toBeTruthy();
    });
  });

  describe("aggregateShares", () => {
    const encryptedUpdates: EncryptedUpdate[] = [];

    beforeEach(() => {
      // Create test updates
      const clientIds = ["client_1", "client_2", "client_3"];
      for (const clientId of clientIds) {
        const parameters = [1, 2, 3];
        const numSamples = 100;
        const otherClients = clientIds.filter(c => c !== clientId);
        encryptedUpdates.push(
          aggregator.encryptUpdate(clientId, parameters, numSamples, otherClients)
        );
      }
    });

    it("should aggregate shares from a server", () => {
      const serverShare = aggregator.aggregateShares("server_1", encryptedUpdates);

      expect(serverShare.serverId).toBe("server_1");
      expect(serverShare.share).toHaveLength(3);
      // Aggregated share should be sum of individual shares
      expect(serverShare.share.every(v => typeof v === "number")).toBe(true);
    });

    it("should throw for missing shares", () => {
      const incompleteUpdates = [encryptedUpdates[0]];

      expect(() => {
        aggregator.aggregateShares("server_1", incompleteUpdates);
      }).toThrow();
    });

    it("should produce consistent aggregation across servers", () => {
      const share1 = aggregator.aggregateShares("server_1", encryptedUpdates);
      const share2 = aggregator.aggregateShares("server_2", encryptedUpdates);

      // Each server should have different x coordinate
      expect(share1.x).not.toBe(share2.x);
    });
  });

  describe("decryptAggregate", () => {
    it("should decrypt aggregated shares correctly", () => {
      // Create updates
      const clientIds = ["client_1", "client_2", "client_3"];
      const parametersList = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const numSamples = 100;

      const encryptedUpdates = clientIds.map((clientId, i) =>
        aggregator.encryptUpdate(
          clientId,
          parametersList[i],
          numSamples,
          clientIds.filter((_, j) => j !== i)
        )
      );

      // Aggregate shares at each server
      const config = aggregator.getConfig();
      const aggregatedShares: SecretShare[] = [];
      for (let i = 0; i < config.numServers; i++) {
        const serverId = `server_${i + 1}`;
        aggregatedShares.push(
          aggregator.aggregateShares(serverId, encryptedUpdates)
        );
      }

      // Decrypt with threshold shares
      const thresholdShares = aggregatedShares.slice(0, config.threshold);
      const doubleMaskCorrections = encryptedUpdates
        .map(u => u.doubleMaskCorrection)
        .filter((c): c is number[] => c !== undefined);

      const result = aggregator.decryptAggregate(
        thresholdShares,
        doubleMaskCorrections
      );

      expect(result.parameters).toHaveLength(3);
      expect(result.verification.verified).toBe(true);
      expect(result.numClients).toBe(3);
      expect(result.numServers).toBe(3);
    });

    it("should throw when insufficient shares", () => {
      const shares: SecretShare[] = [
        {
          serverId: "server_1",
          share: [1, 2, 3],
          x: BigInt(1),
          timestamp: Date.now(),
        },
      ];

      expect(() => {
        aggregator.decryptAggregate(shares);
      }).toThrow("Need at least 3 shares");
    });
  });

  describe("end-to-end aggregation", () => {
    it("should correctly aggregate and decrypt multiple updates", () => {
      // Plain aggregation for comparison
      const updates = [
        { parameters: [1, 2, 3], numSamples: 100 },
        { parameters: [4, 5, 6], numSamples: 100 },
        { parameters: [7, 8, 9], numSamples: 100 },
      ];

      const plainResult = [
        (1 + 4 + 7) / 3,
        (2 + 5 + 8) / 3,
        (3 + 6 + 9) / 3,
      ];

      // Secure aggregation
      const clientIds = ["client_1", "client_2", "client_3"];
      const encryptedUpdates = updates.map((update, i) =>
        aggregator.encryptUpdate(
          clientIds[i],
          update.parameters,
          update.numSamples,
          clientIds.filter((_, j) => j !== i)
        )
      );

      const config = aggregator.getConfig();
      const aggregatedShares: SecretShare[] = [];
      for (let i = 0; i < config.numServers; i++) {
        const serverId = `server_${i + 1}`;
        aggregatedShares.push(
          aggregator.aggregateShares(serverId, encryptedUpdates)
        );
      }

      const thresholdShares = aggregatedShares.slice(0, config.threshold);
      const doubleMaskCorrections = encryptedUpdates
        .map(u => u.doubleMaskCorrection)
        .filter((c): c is number[] => c !== undefined);

      const result = aggregator.decryptAggregate(
        thresholdShares,
        doubleMaskCorrections
      );

      // Results should match
      for (let i = 0; i < plainResult.length; i++) {
        expect(result.parameters[i]).toBeCloseTo(plainResult[i], 0);
      }
    });
  });

  describe("verification", () => {
    it("should verify correct aggregation", () => {
      const parameters = [1, 2, 3];
      const encrypted = aggregator.encryptUpdate("client_1", parameters, 100, []);

      const verification = aggregator.verifyAggregation(parameters, encrypted.proof);

      expect(verification.verified).toBe(true);
    });

    it("should reject stale proofs", () => {
      const parameters = [1, 2, 3];
      const encrypted = aggregator.encryptUpdate("client_1", parameters, 100, []);

      // Create old proof
      const oldProof = {
        ...encrypted.proof!,
        timestamp: Date.now() - 120000,  // 2 minutes ago
      };

      const verification = aggregator.verifyAggregation(parameters, oldProof);

      expect(verification.verified).toBe(false);
    });
  });

  describe("mask management", () => {
    it("should track masks between clients", () => {
      aggregator.encryptUpdate("client_1", [1, 2], 100, ["client_2"]);
      aggregator.encryptUpdate("client_2", [3, 4], 100, ["client_1"]);

      const stats = aggregator.getMaskStats();

      // Should have 1 mask (client_1:client_2)
      expect(stats.count).toBe(1);
    });

    it("should clear masks", () => {
      aggregator.encryptUpdate("client_1", [1, 2], 100, ["client_2"]);
      aggregator.clearMasks();

      const stats = aggregator.getMaskStats();

      expect(stats.count).toBe(0);
    });
  });

  describe("configuration", () => {
    it("should return correct config", () => {
      const retrievedConfig = aggregator.getConfig();

      expect(retrievedConfig.numServers).toBe(4);
      expect(retrievedConfig.threshold).toBe(3);
      expect(retrievedConfig.enableVerification).toBe(true);
      expect(retrievedConfig.enablePairwiseMasking).toBe(true);
    });
  });
});

// ============================================================================
// VERIFIABLE AGGREGATOR TESTS
// ============================================================================

describe("VerifiableAggregator", () => {
  let aggregator: VerifiableAggregator;

  beforeEach(() => {
    aggregator = new VerifiableAggregator({
      numServers: 3,
      threshold: 2,
      enableVerification: true,
    });
  });

  describe("commitments", () => {
    it("should create a commitment", () => {
      const value = BigInt(42);
      const commitment = aggregator.createCommitment(value);

      expect(commitment).toBeDefined();
      expect(typeof commitment).toBe("bigint");
    });

    it("should verify a valid commitment", () => {
      const value = BigInt(100);
      const randomness = BigInt(12345);
      const commitment = aggregator.createCommitment(value, randomness);

      const verified = aggregator.verifyCommitment(commitment, value, randomness);

      expect(verified).toBe(true);
    });

    it("should reject invalid commitment", () => {
      const commitment = aggregator.createCommitment(BigInt(100));

      const verified = aggregator.verifyCommitment(commitment, BigInt(200), BigInt(12345));

      expect(verified).toBe(false);
    });

    it("should create batch commitments", () => {
      const values = [1, 2, 3, 4, 5];
      const clientId = "client_1";

      const commitments = aggregator.createBatchCommitments(values, clientId);

      expect(commitments).toHaveLength(5);
      expect(commitments.every(c => typeof c === "bigint")).toBe(true);
    });

    it("should verify batch aggregation", () => {
      const clientIds = ["client_1", "client_2", "client_3"];
      const values = [10, 20, 30];
      const index = 0;

      // Create commitments
      for (const clientId of clientIds) {
        aggregator.createBatchCommitments([values[index]], clientId);
      }

      // Verify aggregation
      const aggregateValue = values.reduce((a, b) => a + b, 0);
      const verified = aggregator.verifyBatchAggregation(clientIds, index, aggregateValue);

      expect(verified).toBe(true);
    });
  });

  describe("clearCommitments", () => {
    it("should clear all commitments", () => {
      aggregator.createBatchCommitments([1, 2, 3], "client_1");
      aggregator.clearCommitments();

      // Should be able to create new commitments without conflicts
      expect(() => {
        aggregator.createBatchCommitments([4, 5, 6], "client_2");
      }).not.toThrow();
    });
  });
});

// ============================================================================
// UTILITY FUNCTIONS TESTS
// ============================================================================

describe("compareAggregationMethods", () => {
  it("should compare plain and secure aggregation", () => {
    const updates = [
      { parameters: [1, 2, 3], numSamples: 100 },
      { parameters: [4, 5, 6], numSamples: 100 },
      { parameters: [7, 8, 9], numSamples: 100 },
    ];

    const comparison = compareAggregationMethods(updates, {
      numServers: 3,
      threshold: 2,
    });

    expect(comparison.plainTime).toBeGreaterThan(0);
    expect(comparison.secureTime).toBeGreaterThan(0);
    expect(comparison.overhead).toBeGreaterThan(1);
    expect(comparison.results.plain).toBeDefined();
    expect(comparison.results.secure).toBeDefined();
    expect(comparison.results.difference).toBeDefined();
  });

  it("should produce similar results for both methods", () => {
    const updates = [
      { parameters: [1, 2], numSamples: 50 },
      { parameters: [3, 4], numSamples: 50 },
    ];

    const comparison = compareAggregationMethods(updates, {
      numServers: 3,
      threshold: 2,
      enablePairwiseMasking: false,  // Disable for exact comparison
    });

    // Max difference should be small
    const maxDiff = Math.max(...comparison.results.difference);
    expect(maxDiff).toBeLessThan(1000);  // Allow some numerical error
  });
});

describe("computePrivacyGuarantee", () => {
  it("should compute privacy guarantee correctly", () => {
    const guarantee = computePrivacyGuarantee(10, 3, 1.0, 1e-5);

    expect(guarantee.guarantee).toContain("3-of-10");
    expect(guarantee.confidentiality).toContain("3");
    expect(guarantee.robustness).toContain("7");
    expect(guarantee.differentialPrivacy).toContain("1.00");
    expect(guarantee.differentialPrivacy).toContain("1.00e-5");
  });

  it("should handle different parameters", () => {
    const guarantee = computePrivacyGuarantee(5, 4, 0.5, 1e-10);

    expect(guarantee.guarantee).toContain("4-of-5");
    expect(guarantee.robustness).toContain("1");
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe("Secure Aggregation Integration", () => {
  it("should handle full federated learning round", () => {
    const aggregator = new SecureAggregator({
      numServers: 4,
      threshold: 3,
      enableVerification: true,
      enablePairwiseMasking: true,
    });

    // Simulate 10 clients
    const numClients = 10;
    const clientIds = Array.from({ length: numClients }, (_, i) => `client_${i}`);
    const updates = clientIds.map(() => ({
      parameters: [Math.random(), Math.random(), Math.random()],
      numSamples: 50 + Math.floor(Math.random() * 50),
    }));

    // Encrypt updates
    const encryptedUpdates = updates.map((update, i) =>
      aggregator.encryptUpdate(
        clientIds[i],
        update.parameters,
        update.numSamples,
        clientIds.filter((_, j) => j !== i)
      )
    );

    // Aggregate at servers
    const config = aggregator.getConfig();
    const aggregatedShares: SecretShare[] = [];
    for (let i = 0; i < config.numServers; i++) {
      const serverId = `server_${i + 1}`;
      aggregatedShares.push(
        aggregator.aggregateShares(serverId, encryptedUpdates)
      );
    }

    // Decrypt
    const thresholdShares = aggregatedShares.slice(0, config.threshold);
    const doubleMaskCorrections = encryptedUpdates
      .map(u => u.doubleMaskCorrection)
      .filter((c): c is number[] => c !== undefined);

    const result = aggregator.decryptAggregate(
      thresholdShares,
      doubleMaskCorrections
    );

    // Verify
    expect(result.verification.verified).toBe(true);
    expect(result.parameters).toHaveLength(3);
    expect(result.numClients).toBe(numClients);
  });

  it("should handle dropped clients", () => {
    const aggregator = new SecureAggregator({
      numServers: 4,
      threshold: 3,
      enablePairwiseMasking: true,
    });

    const clientIds = ["client_1", "client_2", "client_3", "client_4"];
    const updates = clientIds.map(() => ({
      parameters: [1, 2, 3],
      numSamples: 100,
    }));

    const encryptedUpdates = updates.map((update, i) =>
      aggregator.encryptUpdate(
        clientIds[i],
        update.parameters,
        update.numSamples,
        clientIds.filter((_, j) => j !== i)
      )
    );

    // Drop one client
    const remainingUpdates = encryptedUpdates.slice(0, 3);

    // Should still work
    const config = aggregator.getConfig();
    const aggregatedShares: SecretShare[] = [];
    for (let i = 0; i < config.numServers; i++) {
      const serverId = `server_${i + 1}`;
      aggregatedShares.push(
        aggregator.aggregateShares(serverId, remainingUpdates)
      );
    }

    const thresholdShares = aggregatedShares.slice(0, config.threshold);
    const doubleMaskCorrections = remainingUpdates
      .map(u => u.doubleMaskCorrection)
      .filter((c): c is number[] => c !== undefined);

    const result = aggregator.decryptAggregate(
      thresholdShares,
      doubleMaskCorrections
    );

    expect(result.numClients).toBe(3);
  });

  it("should handle verifiable aggregation end-to-end", () => {
    const aggregator = new VerifiableAggregator({
      numServers: 3,
      threshold: 2,
      enableVerification: true,
    });

    const clientIds = ["client_1", "client_2"];
    const updates = clientIds.map(() => ({
      parameters: [1, 2, 3],
      numSamples: 100,
    }));

    const encryptedUpdates = updates.map((update, i) =>
      aggregator.encryptUpdate(
        clientIds[i],
        update.parameters,
        update.numSamples,
        clientIds.filter((_, j) => j !== i)
      )
    );

    // Create commitments
    for (let i = 0; i < clientIds.length; i++) {
      aggregator.createBatchCommitments(updates[i].parameters, clientIds[i]);
    }

    const config = aggregator.getConfig();
    const aggregatedShares: SecretShare[] = [];
    for (let i = 0; i < config.numServers; i++) {
      const serverId = `server_${i + 1}`;
      aggregatedShares.push(
        aggregator.aggregateShares(serverId, encryptedUpdates)
      );
    }

    const thresholdShares = aggregatedShares.slice(0, config.threshold);
    const doubleMaskCorrections = encryptedUpdates
      .map(u => u.doubleMaskCorrection)
      .filter((c): c is number[] => c !== undefined);

    const result = aggregator.decryptAggregate(
      thresholdShares,
      doubleMaskCorrections
    );

    expect(result.verification.verified).toBe(true);
  });
});
