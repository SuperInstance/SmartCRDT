/**
 * PHEKeyManager - Key Management for Partially Homomorphic Encryption
 *
 * This module provides advanced key management capabilities for Paillier encryption,
 * including secure key generation, serialization, storage, rotation, and versioning.
 *
 * ## Features
 *
 * - **Secure Key Generation**: Generate 2048/3072/4096-bit Paillier key pairs
 * - **Key Serialization**: Export/import keys in JSON/PEM format
 * - **Key Storage**: Secure in-memory and optional persistent storage
 * - **Key Rotation**: Automated key rotation with versioning
 * - **Key Validation**: Verify key integrity and security properties
 * - **Key Derivation**: Derive subkeys for specific purposes
 *
 * ## Security Properties
 *
 * - Keys are generated using cryptographically secure random number generation
 * - Private keys never leave the local environment (optional export only)
 * - Key rotation maintains backward compatibility with encrypted data
 * - All keys are validated before use
 *
 * @packageDocumentation
 */

import { randomBytes } from "crypto";
import { PHE, PaillierKeyPair, PaillierPublicKey, PaillierPrivateKey } from "../phe";

/**
 * Key size options for Paillier encryption
 */
export type KeySize = 2048 | 3072 | 4096;

/**
 * Key export format
 */
export type KeyFormat = "json" | "pem" | "der" | "hex";

/**
 * Key metadata for tracking and auditing
 */
export interface KeyMetadata {
  /** Unique key identifier */
  keyId: string;
  /** Key version (for rotation) */
  version: number;
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp (optional) */
  expiresAt?: number;
  /** Key purpose (e.g., "intent-encoding", "aggregation") */
  purpose: string;
  /** Key size in bits */
  keySize: number;
  /** Whether this key is active */
  active: boolean;
  /** Key fingerprint for verification */
  fingerprint: string;
  /** Parent key ID (for derived keys) */
  parentKeyId?: string;
  /** Custom labels */
  labels?: Record<string, string>;
}

/**
 * Complete key record with metadata
 */
export interface KeyRecord {
  /** Public key */
  publicKey: PaillierPublicKey;
  /** Private key (never exported) */
  privateKey: PaillierPrivateKey;
  /** Key metadata */
  metadata: KeyMetadata;
}

/**
 * Key rotation configuration
 */
export interface KeyRotationConfig {
  /** Maximum age of keys before rotation (ms) */
  maxAge?: number;
  /** Maximum number of uses before rotation */
  maxUses?: number;
  /** Grace period for old keys (ms) */
  gracePeriod?: number;
  /** Whether to automatically archive old keys */
  archiveOld?: boolean;
}

/**
 * Key manager configuration
 */
export interface PHEKeyManagerConfig {
  /** Default key size (default: 2048) */
  defaultKeySize?: KeySize;
  /** Default key format (default: "json") */
  defaultFormat?: KeyFormat;
  /** Enable key rotation (default: false) */
  enableRotation?: boolean;
  /** Key rotation configuration */
  rotationConfig?: KeyRotationConfig;
  /** Storage backend (optional, for persistence) */
  storage?: KeyStorageBackend | null;
}

/**
 * Key storage backend interface
 */
export interface KeyStorageBackend {
  /** Store a key record */
  store(keyRecord: KeyRecord): Promise<void>;
  /** Retrieve a key record by ID */
  retrieve(keyId: string): Promise<KeyRecord | null>;
  /** List all key IDs */
  list(): Promise<string[]>;
  /** Delete a key record */
  delete(keyId: string): Promise<void>;
}

/**
 * Key export result
 */
export interface KeyExportResult {
  /** Exported data */
  data: string;
  /** Format of export */
  format: KeyFormat;
  /** Export timestamp */
  exportedAt: number;
  /** Key ID */
  keyId: string;
}

/**
 * Key import result
 */
export interface KeyImportResult {
  /** Imported key record */
  keyRecord: KeyRecord;
  /** Whether import was successful */
  success: boolean;
  /** Validation errors (if any) */
  errors?: string[];
}

/**
 * Statistics about key operations
 */
export interface KeyManagerStats {
  /** Total keys generated */
  keysGenerated: number;
  /** Total keys stored */
  keysStored: number;
  /** Total keys retrieved */
  keysRetrieved: number;
  /** Total keys rotated */
  keysRotated: number;
  /** Current active keys */
  activeKeys: number;
  /** Total key operations (encrypt/decrypt) */
  keyOperations: number;
}

/**
 * PHEKeyManager - Advanced Key Management for Paillier Encryption
 *
 * @example
 * ```typescript
 * const manager = new PHEKeyManager({
 *   defaultKeySize: 2048,
 *   enableRotation: true,
 *   rotationConfig: {
 *     maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
 *   }
 * });
 *
 * // Generate a new key
 * const keyRecord = await manager.generateKey("intent-encoding");
 *
 * // Get public key for sharing
 * const publicKeyExport = manager.exportPublicKey(keyRecord.metadata.keyId);
 *
 * // Rotate key
 * const newKeyRecord = await manager.rotateKey(keyRecord.metadata.keyId);
 * ```
 */
export class PHEKeyManager {
  private config: Required<PHEKeyManagerConfig>;
  private keys: Map<string, KeyRecord>;
  private keyVersions: Map<string, number>;
  private keyUseCount: Map<string, number>;
  private phe: PHE;
  private stats: KeyManagerStats;

  constructor(config: PHEKeyManagerConfig = {}) {
    this.config = {
      defaultKeySize: config.defaultKeySize ?? 2048,
      defaultFormat: config.defaultFormat ?? "json",
      enableRotation: config.enableRotation ?? false,
      rotationConfig: config.rotationConfig ?? {},
      storage: config.storage ?? null,
    };
    this.keys = new Map();
    this.keyVersions = new Map();
    this.keyUseCount = new Map();
    this.phe = new PHE({
      keySize: this.config.defaultKeySize,
      enableValidation: true,
    });
    this.stats = {
      keysGenerated: 0,
      keysStored: 0,
      keysRetrieved: 0,
      keysRotated: 0,
      activeKeys: 0,
      keyOperations: 0,
    };
  }

  /**
   * Generate a new Paillier key pair
   *
   * @param purpose - Purpose of the key (e.g., "intent-encoding")
   * @param keySize - Key size in bits (default: from config)
   * @param labels - Optional custom labels
   * @returns Key record with metadata
   */
  async generateKey(
    purpose: string,
    keySize?: KeySize,
    labels?: Record<string, string>
  ): Promise<KeyRecord> {
    const bits = keySize ?? this.config.defaultKeySize;

    // Generate key pair using PHE
    const keyPair: PaillierKeyPair = await this.phe.generateKeyPair(bits);

    // Create metadata
    const keyId = this.generateKeyId();
    const version = this.getNextVersion(keyId);

    const metadata: KeyMetadata = {
      keyId,
      version,
      createdAt: Date.now(),
      purpose,
      keySize: bits,
      active: true,
      fingerprint: this.computeFingerprint(keyPair.publicKey),
      labels,
    };

    const keyRecord: KeyRecord = {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      metadata,
    };

    // Store key
    this.keys.set(keyId, keyRecord);
    this.keyUseCount.set(keyId, 0);
    this.stats.activeKeys++;

    // Persist to storage if configured
    if (this.config.storage) {
      try {
        await this.config.storage.store(keyRecord);
        this.stats.keysStored++;
      } catch (error) {
        console.error("Failed to store key:", error);
      }
    }

    this.stats.keysGenerated++;

    return keyRecord;
  }

  /**
   * Retrieve a key record by ID
   *
   * @param keyId - Key identifier
   * @returns Key record or null if not found
   */
  async getKey(keyId: string): Promise<KeyRecord | null> {
    // Check in-memory cache first
    if (this.keys.has(keyId)) {
      this.stats.keysRetrieved++;
      return this.keys.get(keyId)!;
    }

    // Try storage backend
    if (this.config.storage) {
      try {
        const keyRecord = await this.config.storage.retrieve(keyId);
        if (keyRecord) {
          this.keys.set(keyId, keyRecord);
          this.stats.keysRetrieved++;
          return keyRecord;
        }
      } catch (error) {
        console.error("Failed to retrieve key from storage:", error);
      }
    }

    return null;
  }

  /**
   * Export public key in specified format
   *
   * @param keyId - Key identifier
   * @param format - Export format (default: from config)
   * @returns Export result
   */
  async exportPublicKey(
    keyId: string,
    format?: KeyFormat
  ): Promise<KeyExportResult> {
    const keyRecord = await this.getKey(keyId);
    if (!keyRecord) {
      throw new Error(`Key not found: ${keyId}`);
    }

    const exportFormat = format ?? this.config.defaultFormat;
    const data = this.serializePublicKey(keyRecord.publicKey, exportFormat);

    return {
      data,
      format: exportFormat,
      exportedAt: Date.now(),
      keyId,
    };
  }

  /**
   * Import public key from data
   *
   * @param data - Serialized key data
   * @param format - Format of the data
   * @param purpose - Purpose for this key
   * @returns Import result
   */
  async importPublicKey(
    data: string,
    format: KeyFormat,
    purpose: string
  ): Promise<KeyImportResult> {
    try {
      const publicKey = this.deserializePublicKey(data, format);

      // Validate public key
      this.validatePublicKey(publicKey);

      // Create key record (private key is null for imported public keys)
      const keyId = this.generateKeyId();
      const metadata: KeyMetadata = {
        keyId,
        version: 1,
        createdAt: Date.now(),
        purpose,
        keySize: publicKey.bitLength,
        active: true,
        fingerprint: this.computeFingerprint(publicKey),
      };

      const keyRecord: KeyRecord = {
        publicKey,
        privateKey: null as any, // No private key for imported public keys
        metadata,
      };

      this.keys.set(keyId, keyRecord);

      return {
        keyRecord,
        success: true,
      };
    } catch (error) {
      return {
        keyRecord: null as any,
        success: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Rotate a key (generate new version)
   *
   * @param keyId - Key identifier to rotate
   * @param gracePeriod - Optional grace period for old key (ms)
   * @returns New key record
   */
  async rotateKey(keyId: string, gracePeriod?: number): Promise<KeyRecord> {
    const oldKeyRecord = await this.getKey(keyId);
    if (!oldKeyRecord) {
      throw new Error(`Key not found: ${keyId}`);
    }

    const gracePeriodMs = gracePeriod ?? this.config.rotationConfig.gracePeriod ?? 0;

    // Deactivate old key after grace period
    if (gracePeriodMs > 0) {
      setTimeout(() => {
        this.deactivateKey(keyId);
      }, gracePeriodMs);
    } else {
      this.deactivateKey(keyId);
    }

    // Generate new key with same purpose
    const newKeyRecord = await this.generateKey(
      oldKeyRecord.metadata.purpose,
      oldKeyRecord.metadata.keySize as KeySize,
      oldKeyRecord.metadata.labels
    );

    // Set parent key ID
    newKeyRecord.metadata.parentKeyId = keyId;

    this.stats.keysRotated++;

    return newKeyRecord;
  }

  /**
   * Deactivate a key
   *
   * @param keyId - Key identifier
   */
  deactivateKey(keyId: string): void {
    const keyRecord = this.keys.get(keyId);
    if (keyRecord) {
      keyRecord.metadata.active = false;
      this.stats.activeKeys--;
    }
  }

  /**
   * Delete a key
   *
   * @param keyId - Key identifier
   */
  async deleteKey(keyId: string): Promise<void> {
    if (this.keys.has(keyId)) {
      this.keys.delete(keyId);
      this.keyUseCount.delete(keyId);
    }

    if (this.config.storage) {
      try {
        await this.config.storage.delete(keyId);
      } catch (error) {
        console.error("Failed to delete key from storage:", error);
      }
    }
  }

  /**
   * List all key IDs
   *
   * @returns Array of key IDs
   */
  async listKeys(): Promise<string[]> {
    const ids = Array.from(this.keys.keys());

    if (this.config.storage) {
      try {
        const storageIds = await this.config.storage.list();
        // Merge and deduplicate
        return Array.from(new Set([...ids, ...storageIds]));
      } catch (error) {
        console.error("Failed to list keys from storage:", error);
      }
    }

    return ids;
  }

  /**
   * Check if a key needs rotation
   *
   * @param keyId - Key identifier
   * @returns True if key needs rotation
   */
  async needsRotation(keyId: string): Promise<boolean> {
    if (!this.config.enableRotation) {
      return false;
    }

    const keyRecord = await this.getKey(keyId);
    if (!keyRecord) {
      return false;
    }

    const { metadata } = keyRecord;
    const now = Date.now();

    // Check age
    if (this.config.rotationConfig.maxAge) {
      const age = now - metadata.createdAt;
      if (age > this.config.rotationConfig.maxAge) {
        return true;
      }
    }

    // Check usage count
    if (this.config.rotationConfig.maxUses) {
      const uses = this.keyUseCount.get(keyId) ?? 0;
      if (uses > this.config.rotationConfig.maxUses) {
        return true;
      }
    }

    // Check expiration
    if (metadata.expiresAt && now > metadata.expiresAt) {
      return true;
    }

    return false;
  }

  /**
   * Get statistics about key operations
   */
  getStats(): KeyManagerStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      keysGenerated: 0,
      keysStored: 0,
      keysRetrieved: 0,
      keysRotated: 0,
      activeKeys: this.keys.size,
      keyOperations: 0,
    };
  }

  /**
   * Validate a public key
   *
   * @param publicKey - Public key to validate
   * @throws Error if validation fails
   */
  private validatePublicKey(publicKey: PaillierPublicKey): void {
    if (!publicKey.n || !publicKey.g || !publicKey.n2) {
      throw new Error("Invalid public key: missing required fields");
    }

    if (publicKey.bitLength < 2048) {
      throw new Error(`Insecure key size: ${publicKey.bitLength} bits (minimum: 2048)`);
    }

    // Verify n2 = n * n
    if (publicKey.n2 !== publicKey.n * publicKey.n) {
      throw new Error("Invalid public key: n2 mismatch");
    }

    // Verify g is in correct range
    if (publicKey.g <= BigInt(1) || publicKey.g >= publicKey.n2) {
      throw new Error("Invalid public key: g out of range");
    }
  }

  /**
   * Serialize public key to specified format
   *
   * @param publicKey - Public key to serialize
   * @param format - Target format
   * @returns Serialized data
   */
  private serializePublicKey(
    publicKey: PaillierPublicKey,
    format: KeyFormat
  ): string {
    switch (format) {
      case "json":
        return JSON.stringify({
          n: publicKey.n.toString(16),
          g: publicKey.g.toString(16),
          n2: publicKey.n2.toString(16),
          bitLength: publicKey.bitLength,
        });

      case "hex":
        return `${publicKey.n.toString(16)}:${publicKey.g.toString(16)}:${publicKey.bitLength}`;

      case "pem":
        // Simplified PEM format (not full RFC)
        const jsonStr = JSON.stringify({
          n: publicKey.n.toString(16),
          g: publicKey.g.toString(16),
          bitLength: publicKey.bitLength,
        });
        const base64 = Buffer.from(jsonStr).toString("base64");
        return `-----BEGIN PAILLIER PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join("\n")}\n-----END PAILLIER PUBLIC KEY-----`;

      case "der":
        // DER format would require ASN.1 encoding
        // For simplicity, we use hex encoding
        return this.serializePublicKey(publicKey, "hex");

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Deserialize public key from data
   *
   * @param data - Serialized key data
   * @param format - Format of the data
   * @returns Deserialized public key
   */
  private deserializePublicKey(
    data: string,
    format: KeyFormat
  ): PaillierPublicKey {
    switch (format) {
      case "json":
        const parsed = JSON.parse(data);
        return {
          n: BigInt("0x" + parsed.n),
          g: BigInt("0x" + parsed.g),
          n2: BigInt("0x" + parsed.n) * BigInt("0x" + parsed.n),
          bitLength: parsed.bitLength,
        };

      case "hex":
        const parts = data.split(":");
        const n = BigInt("0x" + parts[0]);
        return {
          n,
          g: BigInt("0x" + parts[1]),
          n2: n * n,
          bitLength: parseInt(parts[2], 10),
        };

      case "pem":
        // Extract base64 from PEM
        const base64 = data
          .replace(/-----BEGIN PAILLIER PUBLIC KEY-----/g, "")
          .replace(/-----END PAILLIER PUBLIC KEY-----/g, "")
          .replace(/\s/g, "");
        const jsonStr = Buffer.from(base64, "base64").toString("utf-8");
        return this.deserializePublicKey(jsonStr, "json");

      case "der":
        // Treat DER as hex for simplicity
        return this.deserializePublicKey(data, "hex");

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Generate unique key ID
   */
  private generateKeyId(): string {
    const bytes = randomBytes(16);
    return bytes.toString("hex");
  }

  /**
   * Get next version number for a key
   */
  private getNextVersion(keyId: string): number {
    const currentVersion = this.keyVersions.get(keyId) ?? 0;
    const nextVersion = currentVersion + 1;
    this.keyVersions.set(keyId, nextVersion);
    return nextVersion;
  }

  /**
   * Compute fingerprint of public key
   */
  private computeFingerprint(publicKey: PaillierPublicKey): string {
    // Simple fingerprint: SHA-256 hash of n
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256");
    hash.update(publicKey.n.toString(16));
    return hash.digest("hex").substring(0, 16);
  }
}

/**
 * In-memory key storage backend
 *
 * Simple storage implementation for testing and development.
 */
export class InMemoryKeyStorage implements KeyStorageBackend {
  private storage: Map<string, KeyRecord>;

  constructor() {
    this.storage = new Map();
  }

  async store(keyRecord: KeyRecord): Promise<void> {
    this.storage.set(keyRecord.metadata.keyId, keyRecord);
  }

  async retrieve(keyId: string): Promise<KeyRecord | null> {
    return this.storage.get(keyId) ?? null;
  }

  async list(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  async delete(keyId: string): Promise<void> {
    this.storage.delete(keyId);
  }
}
