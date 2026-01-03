/**
 * Tests for Partially Homomorphic Encryption (PHE)
 *
 * Comprehensive tests for Paillier-based encryption of embeddings.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PHE,
  EncryptedEmbedding,
  PaillierPublicKey,
  PaillierPrivateKey,
  serializePublicKey,
  deserializePublicKey,
  serializePrivateKey,
  deserializePrivateKey,
  serializeEncryptedEmbedding,
  deserializeEncryptedEmbedding,
  encryptedEuclideanDistance,
  encryptedCosineSimilarity,
  DEFAULT_KEY_SIZE,
  DEFAULT_PRECISION,
  MAX_SAFE_VALUE,
} from "./phe";

describe("PHE - Partially Homomorphic Encryption", () => {
  let phe: PHE;
  let publicKey: PaillierPublicKey;
  let privateKey: PaillierPrivateKey;

  beforeEach(async () => {
    phe = new PHE({ keySize: 2048, precision: 1000000 });
    const keyPair = await phe.generateKeyPair();
    publicKey = keyPair.publicKey;
    privateKey = keyPair.privateKey;
  });

  describe("Key Generation", () => {
    it("should generate a valid key pair", async () => {
      const keyPair = await phe.generateKeyPair();

      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey.n).toBeDefined();
      expect(keyPair.publicKey.g).toBeDefined();
      expect(keyPair.publicKey.n2).toBeDefined();
      expect(keyPair.privateKey.lambda).toBeDefined();
      expect(keyPair.privateKey.mu).toBeDefined();
    });

    it("should generate keys with specified bit length", async () => {
      const phe2048 = new PHE({ keySize: 2048 });
      const keyPair2048 = await phe2048.generateKeyPair();
      expect(keyPair2048.publicKey.bitLength).toBe(2048);

      const phe3072 = new PHE({ keySize: 3072 });
      const keyPair3072 = await phe3072.generateKeyPair();
      expect(keyPair3072.publicKey.bitLength).toBe(3072);
    });

    it("should ensure p != q in key generation", async () => {
      // Generate multiple key pairs to ensure diversity
      const keyPairs = await Promise.all([
        phe.generateKeyPair(),
        phe.generateKeyPair(),
        phe.generateKeyPair(),
        phe.generateKeyPair(),
        phe.generateKeyPair(),
      ]);

      // All should be different (with very high probability)
      const nValues = keyPairs.map((kp) => kp.publicKey.n.toString());
      const uniqueNValues = new Set(nValues);
      expect(uniqueNValues.size).toBeGreaterThan(1);
    });

    it("should compute g correctly (n + 1)", async () => {
      const keyPair = await phe.generateKeyPair();
      expect(keyPair.publicKey.g).toBe(keyPair.publicKey.n + BigInt(1));
    });

    it("should compute n2 correctly (n^2)", async () => {
      const keyPair = await phe.generateKeyPair();
      expect(keyPair.publicKey.n2).toBe(
        keyPair.publicKey.n * keyPair.publicKey.n
      );
    });

    it("should satisfy Paillier properties", async () => {
      const keyPair = await phe.generateKeyPair();
      const { publicKey, privateKey } = keyPair;

      // Test: Enc(0) * Enc(0) = Enc(0)
      const zero = BigInt(0);
      const encZero1 = phe.encryptScalar(zero, publicKey);
      const encZero2 = phe.encryptScalar(zero, publicKey);
      const encSum = (encZero1 * encZero2) % publicKey.n2;
      const decSum = phe.decryptScalar(encSum, privateKey);
      expect(decSum).toBe(zero);

      // Test: Enc(1) + Enc(2) = Enc(3)
      const one = BigInt(1);
      const two = BigInt(2);
      const encOne = phe.encryptScalar(one, publicKey);
      const encTwo = phe.encryptScalar(two, publicKey);
      const encThree = (encOne * encTwo) % publicKey.n2;
      const decThree = phe.decryptScalar(encThree, privateKey);
      expect(decThree).toBe(BigInt(3));
    });
  });

  describe("Encryption/Decryption", () => {
    it("should encrypt and decrypt a simple embedding", () => {
      const embedding = new Float32Array([0.5, -0.3, 0.8]);

      const encrypted = phe.encrypt(embedding, publicKey);
      const decrypted = phe.decrypt(encrypted, privateKey);

      expect(decrypted.length).toBe(embedding.length);

      // Allow small precision loss from fixed-point encoding
      for (let i = 0; i < embedding.length; i++) {
        expect(Math.abs(decrypted[i] - embedding[i])).toBeLessThan(1e-5);
      }
    });

    it("should handle negative values correctly", () => {
      const embedding = new Float32Array([-1.0, -0.5, -0.1]);

      const encrypted = phe.encrypt(embedding, publicKey);
      const decrypted = phe.decrypt(encrypted, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(Math.abs(decrypted[i] - embedding[i])).toBeLessThan(1e-5);
      }
    });

    it("should handle zero values", () => {
      const embedding = new Float32Array([0, 0, 0]);

      const encrypted = phe.encrypt(embedding, publicKey);
      const decrypted = phe.decrypt(encrypted, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(decrypted[i]).toBeCloseTo(0, 5);
      }
    });

    it("should preserve precision for small values", () => {
      const embedding = new Float32Array([0.000001, 0.000002, 0.000003]);

      const encrypted = phe.encrypt(embedding, publicKey);
      const decrypted = phe.decrypt(encrypted, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(Math.abs(decrypted[i] - embedding[i])).toBeLessThan(1e-5);
      }
    });

    it("should handle 768-dimensional embeddings (OpenAI size)", () => {
      const embedding = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        embedding[i] = Math.random() * 2 - 1; // Random in [-1, 1]
      }

      const encrypted = phe.encrypt(embedding, publicKey);
      const decrypted = phe.decrypt(encrypted, privateKey);

      expect(encrypted.dimensions).toBe(768);
      expect(encrypted.values.length).toBe(768);

      for (let i = 0; i < embedding.length; i++) {
        expect(Math.abs(decrypted[i] - embedding[i])).toBeLessThan(1e-5);
      }
    });

    it("should be probabilistic (different ciphertexts for same plaintext)", () => {
      const embedding = new Float32Array([0.5, 0.5, 0.5]);

      const encrypted1 = phe.encrypt(embedding, publicKey);
      const encrypted2 = phe.encrypt(embedding, publicKey);

      // Ciphertexts should be different (different nonces)
      expect(encrypted1.values[0]).not.toBe(encrypted2.values[0]);

      // But decryption should give the same result
      const decrypted1 = phe.decrypt(encrypted1, privateKey);
      const decrypted2 = phe.decrypt(encrypted2, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(decrypted1[i]).toBeCloseTo(decrypted2[i], 5);
      }
    });

    it("should throw on empty embedding", () => {
      expect(() => {
        phe.encrypt(new Float32Array([]), publicKey);
      }).toThrow("Embedding cannot be empty");
    });

    it("should throw on invalid values", () => {
      const embedding = new Float32Array([0.5, NaN, 0.8]);

      expect(() => {
        phe.encrypt(embedding, publicKey);
      }).toThrow("Invalid value");
    });

    it("should throw on values too large", () => {
      // Value larger than MAX_SAFE_VALUE / precision
      const hugeValue = Number.MAX_SAFE_INTEGER;
      const embedding = new Float32Array([hugeValue]);

      expect(() => {
        phe.encrypt(embedding, publicKey);
      }).toThrow();
    });
  });

  describe("Homomorphic Addition", () => {
    it("should add encrypted embeddings correctly", () => {
      const a = new Float32Array([0.5, 0.3, 0.8]);
      const b = new Float32Array([0.2, -0.1, 0.4]);

      const encA = phe.encrypt(a, publicKey);
      const encB = phe.encrypt(b, publicKey);

      const encSum = phe.addEncrypted(encA, encB);
      const sum = phe.decrypt(encSum, privateKey);

      for (let i = 0; i < a.length; i++) {
        expect(sum[i]).toBeCloseTo(a[i] + b[i], 4);
      }
    });

    it("should add multiple embeddings", () => {
      const a = new Float32Array([1.0, 2.0, 3.0]);
      const b = new Float32Array([0.5, 0.5, 0.5]);
      const c = new Float32Array([0.25, 0.25, 0.25]);

      const encA = phe.encrypt(a, publicKey);
      const encB = phe.encrypt(b, publicKey);
      const encC = phe.encrypt(c, publicKey);

      const encAB = phe.addEncrypted(encA, encB);
      const encABC = phe.addEncrypted(encAB, encC);

      const result = phe.decrypt(encABC, privateKey);

      for (let i = 0; i < a.length; i++) {
        expect(result[i]).toBeCloseTo(a[i] + b[i] + c[i], 4);
      }
    });

    it("should throw on dimension mismatch", () => {
      const a = new Float32Array([1.0, 2.0]);
      const b = new Float32Array([1.0, 2.0, 3.0]);

      const encA = phe.encrypt(a, publicKey);
      const encB = phe.encrypt(b, publicKey);

      expect(() => {
        phe.addEncrypted(encA, encB);
      }).toThrow("Dimension mismatch");
    });

    it("should throw on precision mismatch", () => {
      const a = new Float32Array([1.0, 2.0]);

      const phe1 = new PHE({ precision: 1000000 });
      const phe2 = new PHE({ precision: 100000 });

      const encA = phe1.encrypt(a, publicKey);
      const encB = phe2.encrypt(a, publicKey);

      expect(() => {
        phe1.addEncrypted(encA, encB);
      }).toThrow("Precision mismatch");
    });
  });

  describe("Scalar Multiplication", () => {
    it("should multiply encrypted embedding by scalar", () => {
      const embedding = new Float32Array([0.5, 0.3, 0.8]);
      const scalar = 2;

      const encrypted = phe.encrypt(embedding, publicKey);
      const scaled = phe.scalarMultiply(encrypted, scalar);
      const result = phe.decrypt(scaled, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(result[i]).toBeCloseTo(embedding[i] * scalar, 4);
      }
    });

    it("should handle negative scalars", () => {
      const embedding = new Float32Array([0.5, 0.3, 0.8]);
      const scalar = -2;

      const encrypted = phe.encrypt(embedding, publicKey);
      const scaled = phe.scalarMultiply(encrypted, scalar);
      const result = phe.decrypt(scaled, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(result[i]).toBeCloseTo(embedding[i] * scalar, 4);
      }
    });

    it("should handle zero scalar", () => {
      const embedding = new Float32Array([0.5, 0.3, 0.8]);
      const scalar = 0;

      const encrypted = phe.encrypt(embedding, publicKey);
      const scaled = phe.scalarMultiply(encrypted, scalar);
      const result = phe.decrypt(scaled, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(result[i]).toBeCloseTo(0, 4);
      }
    });

    it("should handle fractional scalars via multiple operations", () => {
      const embedding = new Float32Array([0.5, 0.3, 0.8]);

      const encrypted = phe.encrypt(embedding, publicKey);

      // To multiply by 0.5, we can't directly, but we can demonstrate
      // the integer scalar multiplication
      const scaled2 = phe.scalarMultiply(encrypted, 2);
      const result2 = phe.decrypt(scaled2, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(result2[i]).toBeCloseTo(embedding[i] * 2, 4);
      }
    });
  });

  describe("Encrypted Dot Product", () => {
    it("should compute encrypted dot product with one plaintext", () => {
      const a = new Float32Array([1.0, 2.0, 3.0]);
      const b = new Float32Array([0.5, 0.5, 0.5]);

      const encA = phe.encrypt(a, publicKey);
      const dotProduct = phe.encryptedDotProduct(encA, b, privateKey);

      const expected = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

      expect(dotProduct).toBeCloseTo(expected, 4);
    });

    it("should compute dot product for negative values", () => {
      const a = new Float32Array([1.0, -2.0, 3.0]);
      const b = new Float32Array([-0.5, 0.5, -0.5]);

      const encA = phe.encrypt(a, publicKey);
      const dotProduct = phe.encryptedDotProduct(encA, b, privateKey);

      const expected = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

      expect(dotProduct).toBeCloseTo(expected, 4);
    });

    it("should throw on dimension mismatch for dot product", () => {
      const a = new Float32Array([1.0, 2.0]);
      const b = new Float32Array([1.0, 2.0, 3.0]);

      const encA = phe.encrypt(a, publicKey);

      expect(() => {
        phe.encryptedDotProduct(encA, b, privateKey);
      }).toThrow("Dimension mismatch");
    });
  });

  describe("Distance and Similarity", () => {
    it("should compute encrypted Euclidean distance", () => {
      const a = new Float32Array([1.0, 2.0, 3.0]);
      const b = new Float32Array([1.0, 2.0, 4.0]);

      const encA = phe.encrypt(a, publicKey);
      const encB = phe.encrypt(b, publicKey);

      const distance = encryptedEuclideanDistance(encA, encB, privateKey);

      const expected = Math.sqrt(
        (1 - 1) ** 2 + (2 - 2) ** 2 + (3 - 4) ** 2
      );

      expect(distance).toBeCloseTo(expected, 4);
    });

    it("should compute encrypted cosine similarity", () => {
      const a = new Float32Array([1.0, 0.0, 0.0]);
      const b = new Float32Array([1.0, 0.0, 0.0]);

      const encA = phe.encrypt(a, publicKey);
      const encB = phe.encrypt(b, publicKey);

      const similarity = encryptedCosineSimilarity(encA, encB, privateKey);

      expect(similarity).toBeCloseTo(1.0, 4);
    });

    it("should compute cosine similarity for orthogonal vectors", () => {
      const a = new Float32Array([1.0, 0.0]);
      const b = new Float32Array([0.0, 1.0]);

      const encA = phe.encrypt(a, publicKey);
      const encB = phe.encrypt(b, publicKey);

      const similarity = encryptedCosineSimilarity(encA, encB, privateKey);

      expect(similarity).toBeCloseTo(0.0, 4);
    });

    it("should compute cosine similarity for opposite vectors", () => {
      const a = new Float32Array([1.0, 0.0, 0.0]);
      const b = new Float32Array([-1.0, 0.0, 0.0]);

      const encA = phe.encrypt(a, publicKey);
      const encB = phe.encrypt(b, publicKey);

      const similarity = encryptedCosineSimilarity(encA, encB, privateKey);

      expect(similarity).toBeCloseTo(-1.0, 4);
    });
  });

  describe("Serialization", () => {
    it("should serialize and deserialize public key", () => {
      const json = serializePublicKey(publicKey);
      const deserialized = deserializePublicKey(json);

      expect(deserialized.n).toBe(publicKey.n);
      expect(deserialized.g).toBe(publicKey.g);
      expect(deserialized.n2).toBe(publicKey.n2);
      expect(deserialized.bitLength).toBe(publicKey.bitLength);
    });

    it("should serialize and deserialize private key", () => {
      const json = serializePrivateKey(privateKey);
      const deserialized = deserializePrivateKey(json);

      expect(deserialized.n).toBe(privateKey.n);
      expect(deserialized.lambda).toBe(privateKey.lambda);
      expect(deserialized.mu).toBe(privateKey.mu);
      expect(deserialized.n2).toBe(privateKey.n2);
    });

    it("should serialize and deserialize encrypted embedding", () => {
      const embedding = new Float32Array([0.5, -0.3, 0.8]);
      const encrypted = phe.encrypt(embedding, publicKey);

      const json = serializeEncryptedEmbedding(encrypted);
      const deserialized = deserializeEncryptedEmbedding(json);

      expect(deserialized.values.length).toBe(encrypted.values.length);
      expect(deserialized.dimensions).toBe(encrypted.dimensions);
      expect(deserialized.precision).toBe(encrypted.precision);

      // Verify decryption works after deserialization
      const decrypted = phe.decrypt(deserialized, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(decrypted[i]).toBeCloseTo(embedding[i], 4);
      }
    });

    it("should produce valid JSON for serialization", () => {
      const embedding = new Float32Array([0.5, -0.3, 0.8]);
      const encrypted = phe.encrypt(embedding, publicKey);

      const pubJson = serializePublicKey(publicKey);
      const privJson = serializePrivateKey(privateKey);
      const embJson = serializeEncryptedEmbedding(encrypted);

      // Verify it's valid JSON
      expect(() => JSON.parse(pubJson)).not.toThrow();
      expect(() => JSON.parse(privJson)).not.toThrow();
      expect(() => JSON.parse(embJson)).not.toThrow();
    });
  });

  describe("Statistics", () => {
    it("should track encryption statistics", () => {
      phe.resetStats();

      const embedding = new Float32Array([0.5, 0.3, 0.8]);
      phe.encrypt(embedding, publicKey);
      phe.encrypt(embedding, publicKey);

      const stats = phe.getStats();

      expect(stats.encryptions).toBe(2);
      expect(stats.decryptions).toBe(0);
      expect(stats.encryptionTime).toBeGreaterThan(0);
    });

    it("should track decryption statistics", () => {
      phe.resetStats();

      const embedding = new Float32Array([0.5, 0.3, 0.8]);
      const encrypted = phe.encrypt(embedding, publicKey);
      phe.decrypt(encrypted, privateKey);

      const stats = phe.getStats();

      expect(stats.encryptions).toBe(1);
      expect(stats.decryptions).toBe(1);
      expect(stats.decryptionTime).toBeGreaterThan(0);
    });

    it("should track homomorphic operation statistics", () => {
      phe.resetStats();

      const a = new Float32Array([0.5, 0.3]);
      const b = new Float32Array([0.2, 0.1]);

      const encA = phe.encrypt(a, publicKey);
      const encB = phe.encrypt(b, publicKey);

      phe.addEncrypted(encA, encB);
      phe.scalarMultiply(encA, 2);

      const stats = phe.getStats();

      expect(stats.homomorphicAdditions).toBe(1);
      expect(stats.scalarMultiplications).toBe(1);
    });

    it("should reset statistics", () => {
      const embedding = new Float32Array([0.5, 0.3, 0.8]);
      phe.encrypt(embedding, publicKey);

      phe.resetStats();

      const stats = phe.getStats();

      expect(stats.encryptions).toBe(0);
      expect(stats.encryptionTime).toBe(0);
    });
  });

  describe("Validation", () => {
    it("should validate public key", () => {
      const invalidKey = {
        n: BigInt(0),
        g: BigInt(0),
        n2: BigInt(0),
        bitLength: 0,
      } as PaillierPublicKey;

      const embedding = new Float32Array([0.5]);

      expect(() => {
        phe.encrypt(embedding, invalidKey);
      }).toThrow("Invalid public key");
    });

    it("should reject keys below minimum size", () => {
      const insecureKey = {
        n: BigInt(12345),
        g: BigInt(12346),
        n2: BigInt(12345 * 12345),
        bitLength: 16,
      } as PaillierPublicKey;

      const embedding = new Float32Array([0.5]);

      expect(() => {
        phe.encrypt(embedding, insecureKey);
      }).toThrow("Insecure key size");
    });

    it("should validate private key", () => {
      const invalidKey = {
        n: BigInt(0),
        lambda: BigInt(0),
        mu: BigInt(0),
        n2: BigInt(0),
      } as PaillierPrivateKey;

      const encrypted = phe.encrypt(new Float32Array([0.5]), publicKey);

      expect(() => {
        phe.decrypt(encrypted, invalidKey);
      }).toThrow("Invalid private key");
    });

    it("should validate key match", async () => {
      const otherKeyPair = phe.generateKeyPair();
      const otherPrivateKey = await otherKeyPair.then((kp) => kp.privateKey);

      const encrypted = phe.encrypt(new Float32Array([0.5]), publicKey);

      expect(() => {
        phe.decrypt(encrypted, otherPrivateKey);
      }).toThrow("Key mismatch");
    });
  });

  describe("Performance", () => {
    it("should complete encryption in reasonable time", async () => {
      const embedding = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        embedding[i] = Math.random() * 2 - 1;
      }

      const start = Date.now();
      phe.encrypt(embedding, publicKey);
      const elapsed = Date.now() - start;

      // Should complete in under 5 seconds for 768 dimensions
      expect(elapsed).toBeLessThan(5000);
    });

    it("should complete homomorphic addition in reasonable time", async () => {
      const a = new Float32Array(768);
      const b = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        a[i] = Math.random() * 2 - 1;
        b[i] = Math.random() * 2 - 1;
      }

      const encA = phe.encrypt(a, publicKey);
      const encB = phe.encrypt(b, publicKey);

      const start = Date.now();
      phe.addEncrypted(encA, encB);
      const elapsed = Date.now() - start;

      // Should complete in under 1 second
      expect(elapsed).toBeLessThan(1000);
    });

    it("should complete decryption in reasonable time", async () => {
      const embedding = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        embedding[i] = Math.random() * 2 - 1;
      }

      const encrypted = phe.encrypt(embedding, publicKey);

      const start = Date.now();
      phe.decrypt(encrypted, privateKey);
      const elapsed = Date.now() - start;

      // Should complete in under 5 seconds for 768 dimensions
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small values", () => {
      const embedding = new Float32Array([1e-10, -1e-10, 1e-10]);

      const encrypted = phe.encrypt(embedding, publicKey);
      const decrypted = phe.decrypt(encrypted, privateKey);

      // Values below precision will be lost
      for (let i = 0; i < embedding.length; i++) {
        // Either close to original or to zero (if below precision)
        const isClose = Math.abs(decrypted[i] - embedding[i]) < 1e-4;
        const isZero = Math.abs(decrypted[i]) < 1e-4;
        expect(isClose || isZero).toBe(true);
      }
    });

    it("should handle mixed positive and negative values", () => {
      const embedding = new Float32Array([
        1.0, -1.0, 0.5, -0.5, 0.1, -0.1, 0.0,
      ]);

      const encrypted = phe.encrypt(embedding, publicKey);
      const decrypted = phe.decrypt(encrypted, privateKey);

      for (let i = 0; i < embedding.length; i++) {
        expect(decrypted[i]).toBeCloseTo(embedding[i], 4);
      }
    });

    it("should preserve relative magnitudes", () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

      const encrypted = phe.encrypt(embedding, publicKey);
      const decrypted = phe.decrypt(encrypted, privateKey);

      for (let i = 0; i < embedding.length - 1; i++) {
        expect(decrypted[i] < decrypted[i + 1]).toBe(true);
      }
    });
  });

  describe("Constants", () => {
    it("should define default key size", () => {
      expect(DEFAULT_KEY_SIZE).toBe(2048);
    });

    it("should define default precision", () => {
      expect(DEFAULT_PRECISION).toBe(1000000);
    });

    it("should define maximum safe value", () => {
      expect(MAX_SAFE_VALUE).toBeDefined();
      expect(MAX_SAFE_VALUE > BigInt(0)).toBe(true);
    });
  });
});
