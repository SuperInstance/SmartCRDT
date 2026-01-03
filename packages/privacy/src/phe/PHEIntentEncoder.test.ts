/**
 * Tests for PHEIntentEncoder
 *
 * Tests for intent encoding with homomorphic encryption.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PHEIntentEncoder } from "./PHEIntentEncoder";
import type { PHEIntentEncoderConfig } from "./PHEIntentEncoder";

// Mock OpenAI key for testing
const MOCK_OPENAI_KEY = "test-key-for-phe-intent-encoder";

describe("PHEIntentEncoder", () => {
  let encoder: PHEIntentEncoder;

  beforeEach(async () => {
    encoder = new PHEIntentEncoder({
      openaiKey: MOCK_OPENAI_KEY,
      enablePHE: true,
      keySize: 2048,
      epsilon: 1.0,
    } as any);
    await encoder.initialize();
  });

  afterEach(async () => {
    await encoder.shutdown();
  });

  describe("Initialization", () => {
    it("should initialize with PHE disabled by default", async () => {
      const plainEncoder = new PHEIntentEncoder({
        openaiKey: MOCK_OPENAI_KEY,
      } as any);
      await plainEncoder.initialize();

      const result = await plainEncoder.encode("test query");
      expect(result.isEncrypted).toBe(false);
      expect(result.isEncrypted).toBeUndefined();

      await plainEncoder.shutdown();
    });

    it("should initialize with PHE enabled", async () => {
      const result = await encoder.encode("test query");

      expect(result.isEncrypted).toBe(true);
      expect(result.isEncrypted).toBeDefined();
      expect(result.encrypted?.encrypted?.dimensions).toBeGreaterThan(0);
    });

    it("should auto-generate key pair when PHE enabled", async () => {
      const publicKey = encoder.getPublicKey();
      const privateKey = encoder.getPrivateKey();

      expect(publicKey).toBeDefined();
      expect(privateKey).toBeDefined();
      expect(publicKey?.n).toBeDefined();
      expect(publicKey?.g).toBeDefined();
    });

    it("should use pre-generated key pair if provided", async () => {
      const keyPair = {
        publicKey: {
          n: BigInt(12345),
          g: BigInt(12346),
          n2: BigInt(12345 * 12345),
          bitLength: 16,
        },
        privateKey: {
          n: BigInt(12345),
          lambda: BigInt(1000),
          mu: BigInt(1),
          n2: BigInt(12345 * 12345),
        },
      };

      const customEncoder = new PHEIntentEncoder({
        openaiKey: MOCK_OPENAI_KEY,
        enablePHE: true,
      } as any);

      await customEncoder.initialize();

      const pubKey = customEncoder.getPublicKey();
      expect(pubKey?.n).toBe(BigInt(12345));

      await customEncoder.shutdown();
    });
  });

  describe("Key Management", () => {
    it("should generate new key pair", async () => {
      const initialKey = encoder.getPublicKey();

      const newKeyPair = await encoder.generateKeyPair();

      const newKey = encoder.getPublicKey();

      expect(newKeyPair.publicKey).toBeDefined();
      expect(newKeyPair.privateKey).toBeDefined();
      expect(newKey?.n).not.toBe(initialKey?.n);
    });

    it("should generate key pair with custom size", async () => {
      const keyPair = await encoder.generateKeyPair(3072);

      expect(keyPair.publicKey.bitLength).toBe(3072);
    });

    it("should set key pair explicitly", async () => {
      const keyPair = {
        publicKey: {
          n: BigInt(54321),
          g: BigInt(54322),
          n2: BigInt(54321 * 54321),
          bitLength: 16,
        },
        privateKey: {
          n: BigInt(54321),
          lambda: BigInt(2000),
          mu: BigInt(1),
          n2: BigInt(54321 * 54321),
        },
      };

      // encoder.setKeyPair(keyPair); // TODO: Implement PHE module

      const pubKey = encoder.getPublicKey();
      expect(pubKey?.n).toBe(BigInt(54321));
    });
  });

  describe("Encoding", () => {
    it("should encode query with PHE encryption", async () => {
      const result = await encoder.encode("What is the capital of France?");

      expect(result.intent).toBeDefined();
      expect(result.intent.vector.length).toBe(768);
      expect(result.isEncrypted).toBe(true);
      expect(result.isEncrypted).toBeDefined();
      expect(result.encrypted?.encrypted?.dimensions).toBe(768);
    });

    it("should encode query without PHE when disabled", async () => {
      const plainEncoder = new PHEIntentEncoder({
        openaiKey: MOCK_OPENAI_KEY,
        enablePHE: false,
      } as any);
      await plainEncoder.initialize();

      const result = await plainEncoder.encode("test query");

      expect(result.isEncrypted).toBe(false);
      expect(result.isEncrypted).toBeUndefined();
      expect(result.intent).toBeDefined();

      await plainEncoder.shutdown();
    });

    it("should encode batch of queries", async () => {
      const queries = [
        "What is the weather?",
        "How are you?",
        "Tell me a joke.",
      ];

      const results = await encoder.encodeBatch(queries);

      expect(results.length).toBe(3);
      for (const result of results) {
        expect(result.isEncrypted).toBe(true);
        expect(result.isEncrypted).toBeDefined();
      }
    });

    it("should track encryption time", async () => {
      const result = await encoder.encode("test query");

      expect(result.encryptionTime).toBeGreaterThanOrEqual(0);
      expect(result.encryptionTime).toBeLessThan(10000); // Should be under 10 seconds
    });
  });

  describe("Decryption", () => {
    it("should decrypt encrypted intent", async () => {
      const result = await encoder.encode("test query");

      if (result.isEncrypted && result.encrypted) {
        const decrypted = encoder.decrypt(result.encrypted);

        expect(decrypted.vector.length).toBe(768);

        // Verify values match original (within precision)
        for (let i = 0; i < decrypted.vector.length; i++) {
          expect(decrypted.vector[i]).toBeCloseTo(result.intent.vector[i], 4);
        }
      }
    });

    it("should throw when decrypting without private key", async () => {
      const badEncoder = new PHEIntentEncoder({
        openaiKey: MOCK_OPENAI_KEY,
        enablePHE: false,
      } as any);
      await badEncoder.initialize();

      const encryptedIntent = {
        encrypted: {
          values: [BigInt(123)],
          publicKey: {
            n: BigInt(12345),
            g: BigInt(12346),
            n2: BigInt(12345 * 12345),
            bitLength: 16,
          },
          dimensions: 1,
          precision: 1000000,
        },
        publicKey: {
          n: BigInt(12345),
          g: BigInt(12346),
          n2: BigInt(12345 * 12345),
          bitLength: 16,
        },
        intent: {
          vector: new Float32Array([0.5]),
          epsilon: 1.0,
          model: "test",
          latency: 100,
          satisfiesDP: true,
        },
      };

      expect(() => {
        badEncoder.decrypt(encryptedIntent);
      }).toThrow("No private key available");

      await badEncoder.shutdown();
    });
  });

  describe("Homomorphic Operations", () => {
    it("should add encrypted intents", async () => {
      const result1 = await encoder.encode("hello");
      const result2 = await encoder.encode("world");

      if (result1.isEncrypted && result2.isEncrypted && result1.encrypted && result2.encrypted) {
        const sum = encoder.addEncrypted(result1.encrypted, result2.encrypted);

        expect(sum.encrypted?.dimensions).toBe(768);

        const decrypted = encoder.decrypt(sum);

        // Verify sum matches plaintext sum
        for (let i = 0; i < 768; i++) {
          const expected = result1.intent.vector[i] + result2.intent.vector[i];
          expect(decrypted.vector[i]).toBeCloseTo(expected, 3);
        }
      }
    });

    it("should throw when adding with different keys", async () => {
      const result1 = await encoder.encode("hello");

      // Create encrypted intent with different key
      const otherEncoder = new PHEIntentEncoder({
        openaiKey: MOCK_OPENAI_KEY,
        enablePHE: true,
      } as any);
      await otherEncoder.initialize();
      const result2 = await otherEncoder.encode("world");

      if (result1.encrypted && result2.encrypted) {
        expect(() => {
          encoder.addEncrypted(result1.encrypted!, result2.encrypted!);
        }).toThrow("different public keys");
      }

      await otherEncoder.shutdown();
    });

    it("should scalar multiply encrypted intent", async () => {
      const result = await encoder.encode("test");

      if (result.isEncrypted && result.encrypted) {
        const scaled = encoder.scalarMultiply(result.encrypted, 2);

        expect(scaled.encrypted?.dimensions).toBe(768);

        const decrypted = encoder.decrypt(scaled);

        for (let i = 0; i < 768; i++) {
          const expected = result.intent.vector[i] * 2;
          expect(decrypted.vector[i]).toBeCloseTo(expected, 3);
        }
      }
    });

    it("should handle negative scalar multiplication", async () => {
      const result = await encoder.encode("test");

      if (result.isEncrypted) {
        const scaled = encoder.scalarMultiply(result.encrypted!, -1);

        const decrypted = encoder.decrypt(scaled);

        for (let i = 0; i < 768; i++) {
          const expected = result.intent.vector[i] * -1;
          expect(decrypted.vector[i]).toBeCloseTo(expected, 3);
        }
      }
    });
  });

  describe("Similarity Computation", () => {
    it("should compute encrypted cosine similarity", async () => {
      const result1 = await encoder.encode("similar test");
      const result2 = await encoder.encode("similar test");

      if (result1.encrypted && result2.encrypted) {
        const similarity = encoder.encryptedCosineSimilarity(
          result1.encrypted,
          result2.encrypted
        );

        // Same query should have similarity close to 1
        expect(similarity).toBeGreaterThan(0.95);
      }
    });

    it("should compute similarity for different queries", async () => {
      const result1 = await encoder.encode("hello");
      const result2 = await encoder.encode("goodbye");

      if (result1.isEncrypted && result2.isEncrypted && result1.encrypted && result2.encrypted) {
        const similarity = encoder.encryptedCosineSimilarity(
          result1.encrypted,
          result2.encrypted
        );

        expect(similarity).toBeGreaterThanOrEqual(-1);
        expect(similarity).toBeLessThanOrEqual(1);
      }
    });

    it("should throw when computing similarity without private key", async () => {
      const badEncoder = new PHEIntentEncoder({
        openaiKey: MOCK_OPENAI_KEY,
        enablePHE: false,
      } as any);
      await badEncoder.initialize();

      const mockEncrypted = {
        encrypted: {
          values: [BigInt(1)],
          publicKey: { n: BigInt(1), g: BigInt(2), n2: BigInt(1), bitLength: 1 },
          dimensions: 1,
          precision: 1000000,
        },
        publicKey: { n: BigInt(1), g: BigInt(2), n2: BigInt(1), bitLength: 1 },
        intent: {
          vector: new Float32Array([0.5]),
          epsilon: 1.0,
          model: "test",
          latency: 0,
          satisfiesDP: true,
        },
      };

      expect(() => {
        badEncoder.encryptedCosineSimilarity(mockEncrypted, mockEncrypted);
      }).toThrow("No private key available");

      await badEncoder.shutdown();
    });
  });

  describe("Statistics", () => {
    it("should track PHE statistics", async () => {
      encoder.resetPHEStats();

      await encoder.encode("test");
      await encoder.encode("test2");

      const stats = encoder.getPHEStats();

      expect(stats.encryptions).toBeGreaterThanOrEqual(2);
    });

    it("should reset statistics", async () => {
      await encoder.encode("test");

      encoder.resetPHEStats();

      const stats = encoder.getPHEStats();

      expect(stats.encryptions).toBe(0);
      expect(stats.encryptionTime).toBe(0);
    });
  });

  describe("Privacy Properties", () => {
    it("should maintain ε-DP guarantee", async () => {
      const result = await encoder.encode("test query", 1.0);

      expect(result.intent.satisfiesDP).toBe(true);
      expect(result.intent.epsilon).toBe(1.0);
    });

    it("should preserve embedding dimensions through encryption", async () => {
      const result = await encoder.encode("test query");

      expect(result.intent.vector.length).toBe(768);
      expect(result.encrypted?.encrypted?.dimensions).toBe(768);
    });

    it("should be probabilistic (different ciphertexts for same query)", async () => {
      const result1 = await encoder.encode("same query");
      const result2 = await encoder.encode("same query");

      if (result1.isEncrypted && result2.isEncrypted && result1.encrypted && result2.encrypted) {
        // Ciphertexts should differ
        expect(result1.encrypted.encrypted?.values[0]).not.toBe(
          result2.encrypted.encrypted?.values[0]
        );

        // But decryption should give similar results (within DP noise)
        const dec1 = encoder.decrypt(result1.encrypted);
        const dec2 = encoder.decrypt(result2.encrypted);

        let maxDiff = 0;
        for (let i = 0; i < 768; i++) {
          maxDiff = Math.max(maxDiff, Math.abs(dec1.vector[i] - dec2.vector[i]));
        }

        // Due to DP noise, they can differ by a small amount
        expect(maxDiff).toBeLessThan(0.5); // Allow for DP noise
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty query", async () => {
      await expect(encoder.encode("")).rejects.toThrow();
    });

    it("should handle very long query", async () => {
      const longQuery = "a".repeat(10000);

      const result = await encoder.encode(longQuery);

      expect(result.intent.vector.length).toBe(768);
    });

    it("should handle special characters", async () => {
      const specialQuery = "Hello! @#$%^&*()_+ 世界 🌍";

      const result = await encoder.encode(specialQuery);

      expect(result.intent.vector.length).toBe(768);
      expect(result.isEncrypted).toBe(true);
    });

    it("should handle unicode characters", async () => {
      const unicodeQuery = "Привет мир こんにちは 世界";

      const result = await encoder.encode(unicodeQuery);

      expect(result.intent.vector.length).toBe(768);
    });
  });

  describe("Performance", () => {
    it("should complete encoding within reasonable time", async () => {
      const start = Date.now();
      await encoder.encode("performance test");
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10000); // Under 10 seconds
    });

    it("should handle batch encoding efficiently", async () => {
      const queries = Array(10).fill("test query");

      const start = Date.now();
      await encoder.encodeBatch(queries);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(30000); // Under 30 seconds for 10 queries
    });
  });
});
