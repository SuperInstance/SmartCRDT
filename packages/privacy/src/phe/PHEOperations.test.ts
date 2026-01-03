/**
 * Tests for PHEOperations
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PHE } from "../phe";
import { PHEOperations } from "./PHEOperations";

describe("PHEOperations", () => {
  let phe: PHE;
  let operations: PHEOperations;
  let keyPair: any;

  beforeEach(async () => {
    phe = new PHE({ keySize: 2048 });
    operations = new PHEOperations();
    keyPair = await phe.generateKeyPair();
  });

  describe("Encrypted Addition", () => {
    it("should add two encrypted embeddings", () => {
      const embedding1 = new Float32Array([1.0, 2.0, 3.0]);
      const embedding2 = new Float32Array([4.0, 5.0, 6.0]);

      const encrypted1 = phe.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe.encrypt(embedding2, keyPair.publicKey);

      const sumResult = operations.addEncrypted(encrypted1, encrypted2);

      expect(sumResult.success).toBe(true);
      expect(sumResult.result).toBeDefined();
      expect(sumResult.error).toBeUndefined();

      // Decrypt and verify
      const decryptedSum = phe.decrypt(sumResult.result, keyPair.privateKey);

      expect(decryptedSum[0]).toBeCloseTo(5.0, 5); // 1.0 + 4.0
      expect(decryptedSum[1]).toBeCloseTo(7.0, 5); // 2.0 + 5.0
      expect(decryptedSum[2]).toBeCloseTo(9.0, 5); // 3.0 + 6.0
    });

    it("should fail with dimension mismatch", () => {
      const embedding1 = new Float32Array([1.0, 2.0]);
      const embedding2 = new Float32Array([4.0, 5.0, 6.0]);

      const encrypted1 = phe.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe.encrypt(embedding2, keyPair.publicKey);

      const sumResult = operations.addEncrypted(encrypted1, encrypted2);

      expect(sumResult.success).toBe(false);
      expect(sumResult.error).toBeDefined();
      expect(sumResult.error).toContain("Dimension mismatch");
    });

    it("should fail with precision mismatch", () => {
      const phe1 = new PHE({ precision: 1000 });
      const phe2 = new PHE({ precision: 2000 });

      const embedding1 = new Float32Array([1.0, 2.0]);
      const embedding2 = new Float32Array([4.0, 5.0]);

      const encrypted1 = phe1.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe2.encrypt(embedding2, keyPair.publicKey);

      encrypted1.precision = 1000;
      encrypted2.precision = 2000;

      const sumResult = operations.addEncrypted(encrypted1, encrypted2);

      expect(sumResult.success).toBe(false);
      expect(sumResult.error).toContain("Precision mismatch");
    });
  });

  describe("Encrypted Subtraction", () => {
    it("should subtract two encrypted embeddings", () => {
      const embedding1 = new Float32Array([5.0, 7.0, 9.0]);
      const embedding2 = new Float32Array([1.0, 2.0, 3.0]);

      const encrypted1 = phe.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe.encrypt(embedding2, keyPair.publicKey);

      const diffResult = operations.subtractEncrypted(encrypted1, encrypted2);

      expect(diffResult.success).toBe(true);

      // Decrypt and verify
      const decryptedDiff = phe.decrypt(diffResult.result, keyPair.privateKey);

      expect(decryptedDiff[0]).toBeCloseTo(4.0, 5); // 5.0 - 1.0
      expect(decryptedDiff[1]).toBeCloseTo(5.0, 5); // 7.0 - 2.0
      expect(decryptedDiff[2]).toBeCloseTo(6.0, 5); // 9.0 - 3.0
    });

    it("should handle negative results", () => {
      const embedding1 = new Float32Array([1.0, 2.0, 3.0]);
      const embedding2 = new Float32Array([5.0, 7.0, 9.0]);

      const encrypted1 = phe.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe.encrypt(embedding2, keyPair.publicKey);

      const diffResult = operations.subtractEncrypted(encrypted1, encrypted2);

      expect(diffResult.success).toBe(true);

      // Decrypt and verify
      const decryptedDiff = phe.decrypt(diffResult.result, keyPair.privateKey);

      expect(decryptedDiff[0]).toBeCloseTo(-4.0, 5); // 1.0 - 5.0
      expect(decryptedDiff[1]).toBeCloseTo(-5.0, 5); // 2.0 - 7.0
      expect(decryptedDiff[2]).toBeCloseTo(-6.0, 5); // 3.0 - 9.0
    });
  });

  describe("Scalar Multiplication", () => {
    it("should multiply encrypted embedding by scalar", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const scalar = 5;

      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const multResult = operations.scalarMultiply(encrypted, scalar);

      expect(multResult.success).toBe(true);

      // Decrypt and verify
      const decrypted = phe.decrypt(multResult.result, keyPair.privateKey);

      expect(decrypted[0]).toBeCloseTo(5.0, 5); // 1.0 * 5
      expect(decrypted[1]).toBeCloseTo(10.0, 5); // 2.0 * 5
      expect(decrypted[2]).toBeCloseTo(15.0, 5); // 3.0 * 5
    });

    it("should handle negative scalars", () => {
      const embedding = new Float32Array([2.0, 3.0, 4.0]);
      const scalar = -3;

      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const multResult = operations.scalarMultiply(encrypted, scalar);

      expect(multResult.success).toBe(true);

      // Decrypt and verify
      const decrypted = phe.decrypt(multResult.result, keyPair.privateKey);

      expect(decrypted[0]).toBeCloseTo(-6.0, 5); // 2.0 * -3
      expect(decrypted[1]).toBeCloseTo(-9.0, 5); // 3.0 * -3
      expect(decrypted[2]).toBeCloseTo(-12.0, 5); // 4.0 * -3
    });

    it("should handle zero scalar", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const scalar = 0;

      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const multResult = operations.scalarMultiply(encrypted, scalar);

      expect(multResult.success).toBe(true);

      // Decrypt and verify
      const decrypted = phe.decrypt(multResult.result, keyPair.privateKey);

      expect(decrypted[0]).toBeCloseTo(0.0, 5);
      expect(decrypted[1]).toBeCloseTo(0.0, 5);
      expect(decrypted[2]).toBeCloseTo(0.0, 5);
    });
  });

  describe("Encrypted Summation", () => {
    it("should sum multiple encrypted embeddings", async () => {
      const embeddings = [
        new Float32Array([1.0, 2.0, 3.0]),
        new Float32Array([4.0, 5.0, 6.0]),
        new Float32Array([7.0, 8.0, 9.0]),
      ];

      const encrypted = embeddings.map((e) => phe.encrypt(e, keyPair.publicKey));

      const sumResult = await operations.sumEncrypted(encrypted);

      expect(sumResult.success).toBe(true);

      // Decrypt and verify
      const decryptedSum = phe.decrypt(sumResult.result, keyPair.privateKey);

      expect(decryptedSum[0]).toBeCloseTo(12.0, 5); // 1.0 + 4.0 + 7.0
      expect(decryptedSum[1]).toBeCloseTo(15.0, 5); // 2.0 + 5.0 + 8.0
      expect(decryptedSum[2]).toBeCloseTo(18.0, 5); // 3.0 + 6.0 + 9.0
    });

    it("should fail with empty array", async () => {
      const sumResult = await operations.sumEncrypted([]);

      expect(sumResult.success).toBe(false);
      expect(sumResult.error).toContain("empty array");
    });

    it("should fail with single embedding", async () => {
      const embeddings = [
        new Float32Array([1.0, 2.0, 3.0]),
        new Float32Array([4.0, 5.0]), // Different dimensions
      ];

      const encrypted = embeddings.map((e) => phe.encrypt(e, keyPair.publicKey));

      const sumResult = await operations.sumEncrypted(encrypted);

      expect(sumResult.success).toBe(false);
    });

    it("should report progress when enabled", async () => {
      const embeddings = [
        new Float32Array([1.0, 2.0]),
        new Float32Array([3.0, 4.0]),
        new Float32Array([5.0, 6.0]),
      ];

      const encrypted = embeddings.map((e) => phe.encrypt(e, keyPair.publicKey));

      let progressCalls = 0;
      const sumResult = await operations.sumEncrypted(encrypted, {
        enableProgress: true,
        onProgress: (current, total) => {
          progressCalls++;
          expect(current).toBeGreaterThan(0);
          expect(total).toBe(3);
        },
      });

      expect(sumResult.success).toBe(true);
      expect(progressCalls).toBe(2); // Called for embeddings 2 and 3
    });
  });

  describe("Encrypted Mean", () => {
    it("should compute mean of encrypted embeddings", async () => {
      const embeddings = [
        new Float32Array([2.0, 4.0, 6.0]),
        new Float32Array([4.0, 8.0, 12.0]),
      ];

      const encrypted = embeddings.map((e) => phe.encrypt(e, keyPair.publicKey));

      const meanResult = await operations.meanEncrypted(
        encrypted,
        keyPair.privateKey
      );

      expect(meanResult.success).toBe(true);

      // Verify mean
      expect(meanResult.result[0]).toBeCloseTo(3.0, 5); // (2.0 + 4.0) / 2
      expect(meanResult.result[1]).toBeCloseTo(6.0, 5); // (4.0 + 8.0) / 2
      expect(meanResult.result[2]).toBeCloseTo(9.0, 5); // (6.0 + 12.0) / 2
    });

    it("should compute mean of multiple embeddings", async () => {
      const embeddings = [
        new Float32Array([1.0, 2.0]),
        new Float32Array([3.0, 4.0]),
        new Float32Array([5.0, 6.0]),
      ];

      const encrypted = embeddings.map((e) => phe.encrypt(e, keyPair.publicKey));

      const meanResult = await operations.meanEncrypted(
        encrypted,
        keyPair.privateKey
      );

      expect(meanResult.success).toBe(true);
      expect(meanResult.result[0]).toBeCloseTo(3.0, 5); // (1.0 + 3.0 + 5.0) / 3
      expect(meanResult.result[1]).toBeCloseTo(4.0, 5); // (2.0 + 4.0 + 6.0) / 3
    });
  });

  describe("Encrypted Variance", () => {
    it("should compute variance of encrypted embeddings", async () => {
      const embeddings = [
        new Float32Array([2.0, 4.0]),
        new Float32Array([4.0, 8.0]),
      ];

      const encrypted = embeddings.map((e) => phe.encrypt(e, keyPair.publicKey));

      const varianceResult = await operations.varianceEncrypted(
        encrypted,
        keyPair.privateKey
      );

      expect(varianceResult.success).toBe(true);

      // Verify variance
      // Mean: [3.0, 6.0]
      // Variance: [1.0, 4.0]
      expect(varianceResult.result[0]).toBeCloseTo(1.0, 4); // Var([2.0, 4.0])
      expect(varianceResult.result[1]).toBeCloseTo(4.0, 4); // Var([4.0, 8.0])
    });
  });

  describe("Encrypted Statistics", () => {
    it("should compute full statistics", async () => {
      const embeddings = [
        new Float32Array([1.0]),
        new Float32Array([2.0]),
        new Float32Array([3.0]),
        new Float32Array([4.0]),
        new Float32Array([5.0]),
      ];

      const encrypted = embeddings.map((e) => phe.encrypt(e, keyPair.publicKey));

      const statsResult = await operations.statisticsEncrypted(
        encrypted,
        keyPair.privateKey
      );

      expect(statsResult.success).toBe(true);
      expect(statsResult.result).toBeDefined();

      // Verify statistics
      expect(statsResult.result.mean).toBeCloseTo(3.0, 5);
      expect(statsResult.result.min).toBeCloseTo(1.0, 5);
      expect(statsResult.result.max).toBeCloseTo(5.0, 5);
      expect(statsResult.result.stdDev).toBeCloseTo(Math.sqrt(2.0), 4);
    });
  });

  describe("Encrypted Comparison", () => {
    it("should compare two encrypted embeddings", async () => {
      const embedding1 = new Float32Array([1.0, 2.0, 3.0]);
      const embedding2 = new Float32Array([4.0, 5.0, 6.0]);

      const encrypted1 = phe.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe.encrypt(embedding2, keyPair.publicKey);

      const comparison = await operations.compareEncrypted(
        encrypted1,
        encrypted2,
        keyPair.privateKey
      );

      expect(comparison.result).toBe(-1); // embedding1 < embedding2
      expect(comparison.encrypted).toBe(false); // Required decryption
    });

    it("should detect equal embeddings", async () => {
      const embedding1 = new Float32Array([1.0, 2.0, 3.0]);
      const embedding2 = new Float32Array([1.0, 2.0, 3.0]);

      const encrypted1 = phe.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe.encrypt(embedding2, keyPair.publicKey);

      const comparison = await operations.compareEncrypted(
        encrypted1,
        encrypted2,
        keyPair.privateKey
      );

      expect(comparison.result).toBe(0); // embedding1 == embedding2
    });
  });

  describe("Dot Product", () => {
    it("should compute dot product", () => {
      const encryptedEmbedding = new Float32Array([1.0, 2.0, 3.0]);
      const plaintextEmbedding = new Float32Array([4.0, 5.0, 6.0]);

      const encrypted = phe.encrypt(encryptedEmbedding, keyPair.publicKey);

      const dotResult = operations.dotProduct(
        encrypted,
        plaintextEmbedding,
        keyPair.privateKey
      );

      expect(dotResult.success).toBe(true);
      expect(dotResult.result).toBeCloseTo(32.0, 5); // 1.0*4.0 + 2.0*5.0 + 3.0*6.0
    });

    it("should fail with dimension mismatch", () => {
      const encryptedEmbedding = new Float32Array([1.0, 2.0]);
      const plaintextEmbedding = new Float32Array([4.0, 5.0, 6.0]);

      const encrypted = phe.encrypt(encryptedEmbedding, keyPair.publicKey);

      const dotResult = operations.dotProduct(
        encrypted,
        plaintextEmbedding,
        keyPair.privateKey
      );

      expect(dotResult.success).toBe(false);
      expect(dotResult.error).toContain("Dimension mismatch");
    });
  });

  describe("Statistics", () => {
    it("should track operation counts", () => {
      const embedding1 = new Float32Array([1.0, 2.0]);
      const embedding2 = new Float32Array([3.0, 4.0]);

      const encrypted1 = phe.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe.encrypt(embedding2, keyPair.publicKey);

      operations.addEncrypted(encrypted1, encrypted2);
      operations.scalarMultiply(encrypted1, 2);

      const stats = operations.getStats();

      expect(stats.additions).toBe(1);
      expect(stats.multiplications).toBe(1);
    });

    it("should reset statistics", () => {
      const embedding1 = new Float32Array([1.0, 2.0]);
      const embedding2 = new Float32Array([3.0, 4.0]);

      const encrypted1 = phe.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe.encrypt(embedding2, keyPair.publicKey);

      operations.addEncrypted(encrypted1, encrypted2);
      operations.resetStats();

      const stats = operations.getStats();

      expect(stats.additions).toBe(0);
      expect(stats.multiplications).toBe(0);
    });
  });
});
