/**
 * Tests for PHEUtils
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PHE } from "../phe";
import {
  PHEUtils,
  PHEPerformanceProfiler,
} from "./PHEUtils";
import {
  serializePublicKey,
  serializeEncryptedEmbedding,
} from "../phe";

describe("PHEUtils", () => {
  let phe: PHE;
  let keyPair: any;

  beforeEach(async () => {
    phe = new PHE({ keySize: 2048 });
    keyPair = await phe.generateKeyPair();
  });

  describe("Public Key Validation", () => {
    it("should validate a correct public key", () => {
      const result = PHEUtils.validatePublicKey(keyPair.publicKey);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject public key missing modulus", () => {
      const invalidKey = { ...keyPair.publicKey, n: undefined };

      const result = PHEUtils.validatePublicKey(invalidKey as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Public key missing modulus (n)");
    });

    it("should reject public key missing generator", () => {
      const invalidKey = { ...keyPair.publicKey, g: undefined };

      const result = PHEUtils.validatePublicKey(invalidKey as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Public key missing generator (g)");
    });

    it("should reject public key with small key size", () => {
      const invalidKey = { ...keyPair.publicKey, bitLength: 1024 };

      const result = PHEUtils.validatePublicKey(invalidKey);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Key size too small: 1024 bits");
    });

    it("should warn about key size below recommended", () => {
      const key = { ...keyPair.publicKey, bitLength: 2048 };

      const result = PHEUtils.validatePublicKey(key);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("below recommended"))).toBe(
        true
      );
    });

    it("should reject public key with invalid n2", () => {
      const invalidKey = { ...keyPair.publicKey, n2: BigInt(999) };

      const result = PHEUtils.validatePublicKey(invalidKey);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid public key: n2 != n * n");
    });
  });

  describe("Private Key Validation", () => {
    it("should validate a correct private key", () => {
      const result = PHEUtils.validatePrivateKey(keyPair.privateKey);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject private key missing lambda", () => {
      const invalidKey = { ...keyPair.privateKey, lambda: undefined };

      const result = PHEUtils.validatePrivateKey(invalidKey as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Private key missing lambda (λ)");
    });

    it("should reject private key missing mu", () => {
      const invalidKey = { ...keyPair.privateKey, mu: undefined };

      const result = PHEUtils.validatePrivateKey(invalidKey as any);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Private key missing mu (μ)");
    });

    it("should reject private key with invalid n2", () => {
      const invalidKey = { ...keyPair.privateKey, n2: BigInt(999) };

      const result = PHEUtils.validatePrivateKey(invalidKey);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid private key: n2 != n * n");
    });
  });

  describe("Encrypted Embedding Validation", () => {
    it("should validate a correct encrypted embedding", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const result = PHEUtils.validateEncryptedEmbedding(encrypted);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject embedding missing values", () => {
      const invalidEmbedding = {
        publicKey: keyPair.publicKey,
        dimensions: 3,
        precision: 1000000,
        values: undefined,
      } as any;

      const result = PHEUtils.validateEncryptedEmbedding(invalidEmbedding);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Encrypted embedding missing values");
    });

    it("should reject embedding with dimension mismatch", () => {
      const invalidEmbedding = {
        publicKey: keyPair.publicKey,
        dimensions: 5,
        precision: 1000000,
        values: [BigInt(1), BigInt(2), BigInt(3)],
      } as any;

      const result = PHEUtils.validateEncryptedEmbedding(invalidEmbedding);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Values length mismatch");
    });

    it("should warn about large dimensions", () => {
      const largeEmbedding = {
        publicKey: keyPair.publicKey,
        dimensions: 15000,
        precision: 1000000,
        values: Array(15000).fill(BigInt(1)),
      } as any;

      const result = PHEUtils.validateEncryptedEmbedding(largeEmbedding);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes("Large dimensions"))).toBe(
        true
      );
    });
  });

  describe("Key Pair Validation", () => {
    it("should validate a correct key pair", () => {
      const result = PHEUtils.validateKeyPair(keyPair);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject mismatched key pair", () => {
      const otherPair = { ...keyPair, publicKey: { ...keyPair.publicKey } };
      (otherPair.publicKey as any).n = BigInt(999);

      const result = PHEUtils.validateKeyPair(otherPair);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Key pair mismatch");
    });
  });

  describe("Key Comparison", () => {
    it("should compare matching keys", () => {
      const result = PHEUtils.comparePublicKeys(
        keyPair.publicKey,
        keyPair.publicKey
      );

      expect(result.matches).toBe(true);
      expect(result.details.modulusMatches).toBe(true);
      expect(result.details.generatorMatches).toBe(true);
      expect(result.details.bitLengthMatches).toBe(true);
    });

    it("should compare different keys", () => {
      const otherKey = {
        ...keyPair.publicKey,
        n: keyPair.publicKey.n + BigInt(1),
      };

      const result = PHEUtils.comparePublicKeys(keyPair.publicKey, otherKey);

      expect(result.matches).toBe(false);
      expect(result.details.modulusMatches).toBe(false);
    });
  });

  describe("Security Check", () => {
    it("should pass security check for 2048-bit key", () => {
      const result = PHEUtils.checkSecurity(keyPair);

      expect(result.passed).toBe(true);
      expect(result.securityLevel).not.toBe("weak");
    });

    it("should recommend upgrade for 2048-bit key", () => {
      const result = PHEUtils.checkSecurity(keyPair);

      expect(result.recommendations.some((r) => r.includes("3072"))).toBe(true);
    });

    it("should fail security check for small key", async () => {
      const smallKeyPair = await phe.generateKeyPair(1024);

      const result = PHEUtils.checkSecurity(smallKeyPair);

      expect(result.passed).toBe(false);
      expect(result.securityLevel).toBe("weak");
    });

    it("should rate 4096-bit key as very strong", async () => {
      const largeKeyPair = await phe.generateKeyPair(4096);

      const result = PHEUtils.checkSecurity(largeKeyPair);

      expect(result.securityLevel).toBe("very_strong");
    });
  });

  describe("Format Conversion", () => {
    it("should convert to JSON format", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const converted = PHEUtils.convertFormat(encrypted, {
        format: "json",
      });

      expect(converted).toBeDefined();
      expect(typeof converted).toBe("string");

      // Should be parseable JSON
      expect(() => JSON.parse(converted)).not.toThrow();
    });

    it("should convert to base64 format", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const converted = PHEUtils.convertFormat(encrypted, {
        format: "base64",
      });

      expect(converted).toBeDefined();
      expect(typeof converted).toBe("string");
    });

    it("should convert to hex format", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const converted = PHEUtils.convertFormat(encrypted, {
        format: "hex",
      });

      expect(converted).toBeDefined();
      expect(typeof converted).toBe("string");
    });

    it("should parse from JSON format", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const jsonStr = serializeEncryptedEmbedding(encrypted);
      const parsed = PHEUtils.parseFormat(jsonStr, "json");

      expect(parsed.dimensions).toBe(encrypted.dimensions);
      expect(parsed.values.length).toBe(encrypted.values.length);
    });

    it("should parse from base64 format", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const jsonStr = serializeEncryptedEmbedding(encrypted);
      const base64Str = Buffer.from(jsonStr).toString("base64");
      const parsed = PHEUtils.parseFormat(base64Str, "base64");

      expect(parsed.dimensions).toBe(encrypted.dimensions);
    });

    it("should parse from hex format", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const jsonStr = serializeEncryptedEmbedding(encrypted);
      const hexStr = Buffer.from(jsonStr).toString("hex");
      const parsed = PHEUtils.parseFormat(hexStr, "hex");

      expect(parsed.dimensions).toBe(encrypted.dimensions);
    });
  });

  describe("Performance Measurement", () => {
    it("should measure operation performance", async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "result";
      };

      const { result, metrics } = await PHEUtils.measurePerformance(
        operation,
        "test-operation"
      );

      expect(result).toBe("result");
      expect(metrics.operation).toBe("test-operation");
      expect(metrics.duration).toBeGreaterThanOrEqual(10);
      expect(metrics.timestamp).toBeDefined();
    });
  });

  describe("Performance Estimation", () => {
    it("should estimate encryption time", () => {
      const time2048 = PHEUtils.estimateEncryptionTime(768, 2048);
      const time4096 = PHEUtils.estimateEncryptionTime(768, 4096);

      expect(time2048).toBeGreaterThan(0);
      expect(time4096).toBeGreaterThan(time2048); // Larger key = slower
    });

    it("should estimate decryption time", () => {
      const time = PHEUtils.estimateDecryptionTime(768, 2048);

      expect(time).toBeGreaterThan(0);
    });

    it("should estimate addition time", () => {
      const time = PHEUtils.estimateAdditionTime(768);

      expect(time).toBeGreaterThan(0);
      expect(time).toBeLessThan(
        PHEUtils.estimateEncryptionTime(768, 2048)
      ); // Addition is faster
    });
  });

  describe("Fingerprint Generation", () => {
    it("should generate consistent fingerprint", () => {
      const fingerprint1 = PHEUtils.generateFingerprint(keyPair.publicKey);
      const fingerprint2 = PHEUtils.generateFingerprint(keyPair.publicKey);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it("should generate unique fingerprints for different keys", async () => {
      const otherKeyPair = await phe.generateKeyPair();

      const fingerprint1 = PHEUtils.generateFingerprint(keyPair.publicKey);
      const fingerprint2 = PHEUtils.generateFingerprint(otherKeyPair.publicKey);

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it("should generate 16-character fingerprint", () => {
      const fingerprint = PHEUtils.generateFingerprint(keyPair.publicKey);

      expect(fingerprint).toHaveLength(16);
    });
  });

  describe("Embedding Cloning", () => {
    it("should clone encrypted embedding", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const cloned = PHEUtils.cloneEncryptedEmbedding(encrypted);

      expect(cloned).toEqual(encrypted);
      expect(cloned).not.toBe(encrypted); // Different reference
      expect(cloned.values).not.toBe(encrypted.values); // Different array
    });
  });

  describe("Empty Check", () => {
    it("should detect non-empty embedding", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      expect(PHEUtils.isEmpty(encrypted)).toBe(false);
    });

    it("should detect empty embedding", () => {
      const emptyEmbedding = {
        publicKey: keyPair.publicKey,
        dimensions: 0,
        precision: 1000000,
        values: [],
      } as any;

      expect(PHEUtils.isEmpty(emptyEmbedding)).toBe(true);
    });
  });

  describe("Size Calculation", () => {
    it("should calculate size in bytes", () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0]);
      const encrypted = phe.encrypt(embedding, keyPair.publicKey);

      const size = PHEUtils.getSizeInBytes(encrypted);

      expect(size).toBeGreaterThan(0);
    });

    it("should scale with dimensions", () => {
      const embedding1 = new Float32Array(Array(100).fill(1.0));
      const embedding2 = new Float32Array(Array(500).fill(1.0));

      const encrypted1 = phe.encrypt(embedding1, keyPair.publicKey);
      const encrypted2 = phe.encrypt(embedding2, keyPair.publicKey);

      const size1 = PHEUtils.getSizeInBytes(encrypted1);
      const size2 = PHEUtils.getSizeInBytes(encrypted2);

      expect(size2).toBeGreaterThan(size1);
    });
  });

  describe("Operation Result Validation", () => {
    it("should validate successful result", () => {
      const result = { success: true, result: "data" };

      expect(PHEUtils.isValidOperationResult<string>(result)).toBe(true);
    });

    it("should reject failed result", () => {
      const result = { success: false, error: "Error" };

      expect(PHEUtils.isValidOperationResult<string>(result)).toBe(false);
    });

    it("should reject result with error", () => {
      const result = { success: true, error: "Error" };

      expect(PHEUtils.isValidOperationResult<string>(result)).toBe(false);
    });
  });
});

describe("PHEPerformanceProfiler", () => {
  let profiler: PHEPerformanceProfiler;

  beforeEach(() => {
    profiler = new PHEPerformanceProfiler();
  });

  it("should profile an operation", () => {
    const end = profiler.start("test-operation");

    // Simulate some work
    const sum = Array(1000)
      .fill(0)
      .reduce((a, b) => a + b, 0);

    const metrics = end();

    expect(metrics.operation).toBe("test-operation");
    expect(metrics.duration).toBeGreaterThanOrEqual(0);
    expect(metrics.timestamp).toBeDefined();
  });

  it("should collect multiple metrics", () => {
    profiler.start("op1")();
    profiler.start("op2")();
    profiler.start("op1")();

    const allMetrics = profiler.getMetrics();

    expect(allMetrics.length).toBe(3);
  });

  it("should filter metrics by operation", () => {
    profiler.start("op1")();
    profiler.start("op2")();
    profiler.start("op1")();

    const op1Metrics = profiler.getMetricsForOperation("op1");
    const op2Metrics = profiler.getMetricsForOperation("op2");

    expect(op1Metrics.length).toBe(2);
    expect(op2Metrics.length).toBe(1);
  });

  it("should calculate average duration", () => {
    profiler.start("test")();
    profiler.start("test")();
    profiler.start("test")();

    const avg = profiler.getAverageDuration("test");

    expect(avg).toBeGreaterThanOrEqual(0);
  });

  it("should calculate total duration", () => {
    profiler.start("op1")();
    profiler.start("op2")();

    const total = profiler.getTotalDuration();

    expect(total).toBeGreaterThanOrEqual(0);
  });

  it("should clear metrics", () => {
    profiler.start("test")();
    profiler.clear();

    const metrics = profiler.getMetrics();

    expect(metrics).toEqual([]);
  });

  it("should generate report", () => {
    profiler.start("encryption")();
    profiler.start("decryption")();
    profiler.start("encryption")();

    const report = profiler.generateReport();

    expect(report).toContain("PHE Performance Report");
    expect(report).toContain("Total operations: 3");
    expect(report).toContain("encryption:");
    expect(report).toContain("decryption:");
  });
});
