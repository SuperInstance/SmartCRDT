/**
 * Tests for PHEKeyManager
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PHEKeyManager,
  InMemoryKeyStorage,
  type KeyRecord,
} from "./PHEKeyManager";

describe("PHEKeyManager", () => {
  let manager: PHEKeyManager;

  beforeEach(() => {
    manager = new PHEKeyManager({
      defaultKeySize: 2048,
    });
  });

  describe("Key Generation", () => {
    it("should generate a new key pair", async () => {
      const keyRecord = await manager.generateKey("test-purpose");

      expect(keyRecord).toBeDefined();
      expect(keyRecord.publicKey).toBeDefined();
      expect(keyRecord.privateKey).toBeDefined();
      expect(keyRecord.metadata).toBeDefined();
      expect(keyRecord.metadata.keyId).toBeDefined();
      expect(keyRecord.metadata.purpose).toBe("test-purpose");
      expect(keyRecord.metadata.active).toBe(true);
      expect(keyRecord.metadata.keySize).toBe(2048);
    });

    it("should generate unique key IDs", async () => {
      const key1 = await manager.generateKey("test");
      const key2 = await manager.generateKey("test");

      expect(key1.metadata.keyId).not.toBe(key2.metadata.keyId);
    });

    it("should generate keys with different sizes", async () => {
      const key2048 = await manager.generateKey("test", 2048);
      const key3072 = await manager.generateKey("test", 3072);
      const key4096 = await manager.generateKey("test", 4096);

      expect(key2048.metadata.keySize).toBe(2048);
      expect(key3072.metadata.keySize).toBe(3072);
      expect(key4096.metadata.keySize).toBe(4096);
    });

    it("should include custom labels", async () => {
      const labels = {
        environment: "test",
        owner: "test-suite",
      };

      const keyRecord = await manager.generateKey("test", 2048, labels);

      expect(keyRecord.metadata.labels).toEqual(labels);
    });

    it("should track key versions", async () => {
      const key1 = await manager.generateKey("test");
      const key2 = await manager.generateKey("test");

      expect(key1.metadata.version).toBe(1);
      expect(key2.metadata.version).toBe(2);
    });
  });

  describe("Key Retrieval", () => {
    it("should retrieve a stored key", async () => {
      const keyRecord = await manager.generateKey("test");
      const retrieved = await manager.getKey(keyRecord.metadata.keyId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.keyId).toBe(keyRecord.metadata.keyId);
    });

    it("should return null for non-existent key", async () => {
      const retrieved = await manager.getKey("non-existent");

      expect(retrieved).toBeNull();
    });
  });

  describe("Key Export/Import", () => {
    it("should export public key in JSON format", async () => {
      const keyRecord = await manager.generateKey("test");
      const exported = await manager.exportPublicKey(
        keyRecord.metadata.keyId,
        "json"
      );

      expect(exported.data).toBeDefined();
      expect(exported.format).toBe("json");
      expect(exported.keyId).toBe(keyRecord.metadata.keyId);

      // Verify JSON can be parsed
      const parsed = JSON.parse(exported.data);
      expect(parsed.n).toBeDefined();
      expect(parsed.g).toBeDefined();
      expect(parsed.bitLength).toBe(2048);
    });

    it("should export public key in hex format", async () => {
      const keyRecord = await manager.generateKey("test");
      const exported = await manager.exportPublicKey(
        keyRecord.metadata.keyId,
        "hex"
      );

      expect(exported.data).toBeDefined();
      expect(exported.format).toBe("hex");

      // Verify hex format (n:g:bitlength)
      const parts = exported.data.split(":");
      expect(parts.length).toBe(3);
    });

    it("should export public key in PEM format", async () => {
      const keyRecord = await manager.generateKey("test");
      const exported = await manager.exportPublicKey(
        keyRecord.metadata.keyId,
        "pem"
      );

      expect(exported.data).toContain("-----BEGIN PAILLIER PUBLIC KEY-----");
      expect(exported.data).toContain("-----END PAILLIER PUBLIC KEY-----");
    });

    it("should import public key from JSON", async () => {
      const keyRecord = await manager.generateKey("test");
      const exported = await manager.exportPublicKey(
        keyRecord.metadata.keyId,
        "json"
      );

      const imported = await manager.importPublicKey(
        exported.data,
        "json",
        "imported"
      );

      expect(imported.success).toBe(true);
      expect(imported.keyRecord).toBeDefined();
      expect(imported.keyRecord.metadata.purpose).toBe("imported");
      expect(imported.errors).toBeUndefined();
    });

    it("should import public key from hex", async () => {
      const keyRecord = await manager.generateKey("test");
      const exported = await manager.exportPublicKey(
        keyRecord.metadata.keyId,
        "hex"
      );

      const imported = await manager.importPublicKey(
        exported.data,
        "hex",
        "imported"
      );

      expect(imported.success).toBe(true);
      expect(imported.keyRecord).toBeDefined();
    });

    it("should fail to import invalid data", async () => {
      const imported = await manager.importPublicKey(
        "invalid-data",
        "json",
        "test"
      );

      expect(imported.success).toBe(false);
      expect(imported.errors).toBeDefined();
      expect(imported.errors?.length).toBeGreaterThan(0);
    });
  });

  describe("Key Rotation", () => {
    it("should rotate a key", async () => {
      const oldKey = await manager.generateKey("test");
      const newKey = await manager.rotateKey(oldKey.metadata.keyId);

      expect(newKey.metadata.keyId).not.toBe(oldKey.metadata.keyId);
      expect(newKey.metadata.parentKeyId).toBe(oldKey.metadata.keyId);
      expect(newKey.metadata.purpose).toBe(oldKey.metadata.purpose);
    });

    it("should deactivate old key after rotation", async () => {
      const oldKey = await manager.generateKey("test");
      await manager.rotateKey(oldKey.metadata.keyId);

      const retrieved = await manager.getKey(oldKey.metadata.keyId);
      expect(retrieved?.metadata.active).toBe(false);
    });

    it("should preserve labels during rotation", async () => {
      const labels = { test: "value" };
      const oldKey = await manager.generateKey("test", 2048, labels);
      const newKey = await manager.rotateKey(oldKey.metadata.keyId);

      expect(newKey.metadata.labels).toEqual(labels);
    });
  });

  describe("Key Deletion", () => {
    it("should delete a key", async () => {
      const keyRecord = await manager.generateKey("test");
      const keyId = keyRecord.metadata.keyId;

      await manager.deleteKey(keyId);

      const retrieved = await manager.getKey(keyId);
      expect(retrieved).toBeNull();
    });
  });

  describe("Key Listing", () => {
    it("should list all key IDs", async () => {
      await manager.generateKey("test1");
      await manager.generateKey("test2");
      await manager.generateKey("test3");

      const keys = await manager.listKeys();

      expect(keys.length).toBe(3);
    });

    it("should return empty array when no keys", async () => {
      const keys = await manager.listKeys();

      expect(keys).toEqual([]);
    });
  });

  describe("Key Rotation Checks", () => {
    it("should check if key needs rotation by age", async () => {
      const rotationManager = new PHEKeyManager({
        enableRotation: true,
        rotationConfig: {
          maxAge: 1000, // 1 second
        },
      });

      const keyRecord = await rotationManager.generateKey("test");

      // Should not need rotation immediately
      expect(await rotationManager.needsRotation(keyRecord.metadata.keyId)).toBe(
        false
      );

      // Wait for key to age
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should need rotation after maxAge
      expect(await rotationManager.needsRotation(keyRecord.metadata.keyId)).toBe(
        true
      );
    });

    it("should not check rotation when disabled", async () => {
      const keyRecord = await manager.generateKey("test");

      expect(await manager.needsRotation(keyRecord.metadata.keyId)).toBe(false);
    });
  });

  describe("Statistics", () => {
    it("should track key generation", async () => {
      await manager.generateKey("test1");
      await manager.generateKey("test2");

      const stats = manager.getStats();

      expect(stats.keysGenerated).toBe(2);
    });

    it("should track key retrieval", async () => {
      const keyRecord = await manager.generateKey("test");
      await manager.getKey(keyRecord.metadata.keyId);

      const stats = manager.getStats();

      expect(stats.keysRetrieved).toBe(1);
    });

    it("should track key rotation", async () => {
      const keyRecord = await manager.generateKey("test");
      await manager.rotateKey(keyRecord.metadata.keyId);

      const stats = manager.getStats();

      expect(stats.keysRotated).toBe(1);
    });

    it("should reset statistics", async () => {
      await manager.generateKey("test");

      manager.resetStats();

      const stats = manager.getStats();

      expect(stats.keysGenerated).toBe(0);
    });
  });
});

describe("InMemoryKeyStorage", () => {
  let storage: InMemoryKeyStorage;

  beforeEach(() => {
    storage = new InMemoryKeyStorage();
  });

  it("should store and retrieve key records", async () => {
    const keyRecord: KeyRecord = {
      publicKey: {
        n: BigInt(123),
        g: BigInt(456),
        n2: BigInt(123 * 123),
        bitLength: 2048,
      },
      privateKey: {
        n: BigInt(123),
        lambda: BigInt(789),
        mu: BigInt(101),
        n2: BigInt(123 * 123),
      },
      metadata: {
        keyId: "test-key",
        version: 1,
        createdAt: Date.now(),
        purpose: "test",
        keySize: 2048,
        active: true,
        fingerprint: "abc123",
      },
    };

    await storage.store(keyRecord);
    const retrieved = await storage.retrieve("test-key");

    expect(retrieved).toEqual(keyRecord);
  });

  it("should return null for non-existent keys", async () => {
    const retrieved = await storage.retrieve("non-existent");

    expect(retrieved).toBeNull();
  });

  it("should list all key IDs", async () => {
    const keyRecord1: KeyRecord = {
      publicKey: {
        n: BigInt(1),
        g: BigInt(2),
        n2: BigInt(1),
        bitLength: 2048,
      },
      privateKey: {
        n: BigInt(1),
        lambda: BigInt(3),
        mu: BigInt(4),
        n2: BigInt(1),
      },
      metadata: {
        keyId: "key1",
        version: 1,
        createdAt: Date.now(),
        purpose: "test",
        keySize: 2048,
        active: true,
        fingerprint: "abc",
      },
    };

    const keyRecord2: KeyRecord = {
      publicKey: {
        n: BigInt(5),
        g: BigInt(6),
        n2: BigInt(25),
        bitLength: 2048,
      },
      privateKey: {
        n: BigInt(5),
        lambda: BigInt(7),
        mu: BigInt(8),
        n2: BigInt(25),
      },
      metadata: {
        keyId: "key2",
        version: 1,
        createdAt: Date.now(),
        purpose: "test",
        keySize: 2048,
        active: true,
        fingerprint: "def",
      },
    };

    await storage.store(keyRecord1);
    await storage.store(keyRecord2);

    const keys = await storage.list();

    expect(keys).toContain("key1");
    expect(keys).toContain("key2");
    expect(keys.length).toBe(2);
  });

  it("should delete keys", async () => {
    const keyRecord: KeyRecord = {
      publicKey: {
        n: BigInt(1),
        g: BigInt(2),
        n2: BigInt(1),
        bitLength: 2048,
      },
      privateKey: {
        n: BigInt(1),
        lambda: BigInt(3),
        mu: BigInt(4),
        n2: BigInt(1),
      },
      metadata: {
        keyId: "test-key",
        version: 1,
        createdAt: Date.now(),
        purpose: "test",
        keySize: 2048,
        active: true,
        fingerprint: "abc",
      },
    };

    await storage.store(keyRecord);
    await storage.delete("test-key");

    const retrieved = await storage.retrieve("test-key");

    expect(retrieved).toBeNull();
  });
});
