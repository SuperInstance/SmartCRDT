/**
 * @lsi/protocol - Partially Homomorphic Encryption (PHE) Types
 *
 * This module defines types for PHE encryption, particularly for
 * privacy-preserving intent encoding using Paillier encryption.
 *
 * Paillier encryption enables:
 * - Semantic security for intent vectors
 * - Additive homomorphism for computation on encrypted data
 * - Layered privacy with ε-differential privacy
 */

/**
 * Encrypted embedding vector
 *
 * Represents a 768-dimensional intent vector encrypted with Paillier cryptosystem.
 * Each dimension is encrypted individually, preserving the vector structure
 * while providing semantic security.
 */
export interface EncryptedEmbedding {
  /** Encrypted vector data (each dimension encrypted with Paillier) */
  data: string[];

  /** Encryption metadata */
  metadata: {
    /** Total dimensions (typically 768) */
    dimensions: number;

    /** Encryption algorithm used */
    algorithm: "paillier";

    /** Key size in bits (e.g., 2048, 4096) */
    keySize: number;

    /** Version of encryption format */
    version: string;

    /** Timestamp of encryption */
    encryptedAt: number;
  };

  /** Vector hash for integrity verification */
  hash?: string;

  /** Base64-encoded serialization of encrypted vector */
  serialized?: string;
}

/**
 * Paillier public key for encryption
 *
 * The public key enables encryption of intent vectors without decryption capability.
 * Required by services that need to work with encrypted embeddings.
 */
export interface PaillierPublicKey {
  /** Modulus n (product of two primes) */
  n: string;

  /** Generator g (typically n+1 for Paillier) */
  g: string;

  /** Key size in bits */
  keySize: number;

  /** Key fingerprint for identification */
  fingerprint: string;

  /** Export timestamp */
  createdAt: number;

  /** Export format (hex, base64, etc.) */
  format: "hex" | "base64";

  /** Optional metadata about the key */
  metadata?: {
    /** Key purpose (e.g., "intent-encoding") */
    purpose?: string;
    /** Owner/creator identifier */
    owner?: string;
    /** Expiration timestamp */
    expiresAt?: number;
    /** Usage restrictions */
    usage?: string[];
  };
}

/**
 * Paillier private key for decryption
 *
 * The private key enables decryption of encrypted embeddings.
 * Must be kept secure and never transmitted to cloud services.
 */
export interface PaillierPrivateKey {
  /** Secret prime p */
  p: string;

  /** Secret prime q */
  q: string;

  /** Modulus n = p * q */
  n: string;

  /** Lambda = lcm(p-1, q-1) */
  lambda: string;

  /** Generator g (typically n+1) */
  g: string;

  /** Modular inverse of p mod q */
  pInv: string;

  /** Key size in bits */
  keySize: number;

  /** Key fingerprint for identification */
  fingerprint: string;

  /** Export timestamp */
  createdAt: number;

  /** Export format (hex, base64, etc.) */
  format: "hex" | "base64";

  /** Optional metadata about the key */
  metadata?: {
    /** Key purpose (e.g., "intent-encoding") */
    purpose?: string;
    /** Owner/creator identifier */
    owner?: string;
    /** Storage location (for audit) */
    storageLocation?: string;
    /** Access restrictions */
    access?: string[];
  };
}

/**
 * Paillier key pair
 *
 * Contains both public and private keys for the Paillier cryptosystem.
 * The private key should only be used locally for decryption.
 */
export interface PaillierKeyPair {
  /** Public key for encryption */
  publicKey: PaillierPublicKey;

  /** Private key for decryption */
  privateKey: PaillierPrivateKey;

  /** Key pair identifier */
  keyId: string;

  /** Creation timestamp */
  createdAt: number;

  /** Expiration timestamp (optional) */
  expiresAt?: number;
}

/**
 * PHE encryption configuration
 *
 * Configuration options for PHE encryption of intent vectors.
 * Enables fine-tuning of security parameters and performance.
 */
export interface PHEEncryptionConfig {
  /** Key size in bits (default: 2048) */
  keySize?: number;

  /** Whether to generate new key pair (default: false) */
  generateKeyPair?: boolean;

  /** Existing key pair to use (optional) */
  existingKeyPair?: PaillierKeyPair;

  /** Public key for encryption (if not generating) */
  publicKey?: PaillierPublicKey;

  /** Private key for decryption (if not generating) */
  privateKey?: PaillierPrivateKey;

  /** Serialization format for encrypted vectors (default: "array") */
  serializationFormat?: "array" | "base64" | "hex";

  /** Whether to include hash for integrity checking (default: true) */
  includeHash?: boolean;

  /** Security level for encryption (default: "high") */
  securityLevel?: "low" | "medium" | "high" | "very_high";

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * PHE encryption result
 *
 * Contains both encrypted and plaintext versions of the intent vector,
 * along with metadata about the encryption process.
 */
export interface PHEEncryptionResult {
  /** Original plaintext intent vector */
  plaintext: Float32Array;

  /** Encrypted intent vector */
  encrypted: EncryptedEmbedding;

  /** Public key used for encryption */
  publicKey: PaillierPublicKey;

  /** Encryption timestamp */
  timestamp: number;

  /** Encryption latency in milliseconds */
  latency: number;

  /** Whether encryption was successful */
  success: boolean;

  /** Error message if encryption failed */
  error?: string;
}

/**
 * PHE decryption result
 *
 * Contains the decrypted intent vector along with metadata about
 * the decryption process.
 */
export interface PHEDecryptionResult {
  /** Decrypted intent vector */
  plaintext: Float32Array;

  /** Original encrypted vector for comparison */
  encrypted: EncryptedEmbedding;

  /** Decryption timestamp */
  timestamp: number;

  /** Decryption latency in milliseconds */
  latency: number;

  /** Whether decryption was successful */
  success: boolean;

  /** Error message if decryption failed */
  error?: string;
}

/**
 * PHE operation types
 */
export type PHEOperationType = "encrypt" | "decrypt" | "add" | "multiply";

/**
 * PHE operation result
 *
 * Generic result type for PHE operations (encryption, decryption,
 * homomorphic operations).
 */
export interface PHEOperationResult {
  /** Operation type performed */
  operation: PHEOperationType;

  /** Result data (encrypted or decrypted vector) */
  result: EncryptedEmbedding | Float32Array;

  /** Operation timestamp */
  timestamp: number;

  /** Operation latency in milliseconds */
  latency: number;

  /** Whether operation was successful */
  success: boolean;

  /** Error message if operation failed */
  error?: string;
}

/**
 * PHE capabilities interface
 *
 * Defines what operations are supported by a PHE implementation.
 * Useful for feature detection and capability negotiation.
 */
export interface PHECapabilities {
  /** Whether encryption is supported */
  encryption: boolean;

  /** Whether decryption is supported */
  decryption: boolean;

  /** Whether additive homomorphism is supported */
  homomorphicAddition: boolean;

  /** Whether scalar multiplication is supported */
  homomorphicMultiplication: boolean;

  /** Supported key sizes */
  supportedKeySizes: number[];

  /** Maximum supported vector dimensions */
  maxDimensions: number;

  /** Supported serialization formats */
  supportedFormats: string[];

  /** Performance characteristics */
  performance: {
    /** Encryption throughput (vectors/second) */
    encryptionThroughput?: number;
    /** Decryption throughput (vectors/second) */
    decryptionThroughput?: number;
    /** Homomorphic operation throughput (operations/second) */
    homomorphicThroughput?: number;
  };
}

/**
 * PHE security metadata
 *
 * Contains security-related information about encrypted vectors
 * and keys.
 */
export interface PHESecurityMetadata {
  /** Encryption algorithm version */
  algorithmVersion: string;

  /** Security strength estimate */
  securityStrength: "weak" | "moderate" | "strong" | "very_strong";

  /** Known vulnerabilities (if any) */
  vulnerabilities?: string[];

  /** Compliance certifications (if any) */
  certifications?: string[];

  /** Security audit timestamp */
  lastAudit?: number;

  /** Recommended refresh interval (ms) */
  refreshInterval?: number;
}