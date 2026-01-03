/**
import { SecuritySeverity, CodeLocation, DetectionConfidence } from "../types.js";

 * CryptoHardening - Security hardening through cryptography best practices
 *
 * Provides cryptographic utilities and recommendations:
 * - Strong algorithm enforcement
 * - Key derivation (PBKDF2, argon2)
 * - Random number generation
 * - Hash verification
 * - Encryption/decryption helpers
 * - Key management
 */

import type { SecuritySeverity } from "@lsi/protocol";
import { DetectionConfidence } from "@lsi/protocol";

/**
 * Supported symmetric algorithms
 */
export enum SymmetricAlgorithm {
  AES_256_GCM = "aes-256-gcm",
  AES_256_CBC = "aes-256-cbc",
  AES_192_GCM = "aes-192-gcm",
  AES_192_CBC = "aes-192-cbc",
}

/**
 * Supported hash algorithms
 */
export enum HashAlgorithm {
  SHA256 = "sha256",
  SHA384 = "sha384",
  SHA512 = "sha512",
}

/**
 * Supported KDF algorithms
 */
export enum KDFAlgorithm {
  PBKDF2 = "pbkdf2",
  ARGON2 = "argon2",
  SCRYPT = "scrypt",
}

/**
 * Crypto validation result
 */
export interface CryptoValidationResult {
  secure: boolean;
  severity: SecuritySeverity;
  confidence: DetectionConfidence;
  issues: string[];
  recommendations: string[];
}

/**
 * CryptoHardening - Provides cryptographic security utilities
 */
export class CryptoHardening {
  private readonly weakAlgorithms = [
    "md4",
    "md5",
    "sha1",
    "rc4",
    "des",
    "3des",
    "blowfish",
    "ecb",
  ];

  private readonly secureKeySizes = {
    aes: 256,
    rsa: 4096,
    ecdsa: 384,
    ed25519: 255,
  };

  /**
   * Validate cryptographic algorithm choice
   */
  validateAlgorithm(algorithm: string): CryptoValidationResult {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const normalizedAlgo = algorithm.toLowerCase().replace(/[-_]/g, "");

    // Check for weak algorithms
    for (const weak of this.weakAlgorithms) {
      if (normalizedAlgo.includes(weak)) {
        issues.push(`Weak algorithm detected: ${algorithm}`);
        recommendations.push(`Use strong alternatives (AES-256-GCM, SHA-256+)`);
        return {
          secure: false,
          severity: "CRITICAL" as SecuritySeverity,
          confidence: DetectionConfidence.CERTAIN,
          issues,
          recommendations,
        };
      }
    }

    // Check for insecure modes
    if (normalizedAlgo.includes("ecb")) {
      issues.push("ECB mode is insecure (does not provide authenticated encryption)");
      recommendations.push("Use GCM mode or add HMAC for authentication");
    }

    if (normalizedAlgo.includes("cbc") && !normalizedAlgo.includes("hmac")) {
      issues.push("CBC mode without HMAC is vulnerable to padding oracle attacks");
      recommendations.push("Add HMAC or use GCM mode instead");
    }

    // Check key size for AES
    const aesMatch = algorithm.match(/aes-(\d+)/i);
    if (aesMatch) {
      const keySize = parseInt(aesMatch[1], 10);
      if (keySize < 256) {
        issues.push(`AES key size is only ${keySize} bits`);
        recommendations.push("Use AES-256 for stronger encryption");
      }
    }

    return {
      secure: issues.length === 0,
      severity: issues.length > 0 ? ("HIGH" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.HIGH,
      issues,
      recommendations,
    };
  }

  /**
   * Validate random number generation
   */
  validateRandomGeneration(method: string): CryptoValidationResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const normalized = method.toLowerCase();

    if (normalized.includes("math.random")) {
      issues.push("Math.random() is predictable and not suitable for security");
      recommendations.push("Use crypto.randomBytes() or window.crypto.getRandomValues()");
    }

    if (normalized.includes("date.now") || normalized.includes("timestamp")) {
      issues.push("Using timestamps as random seed is predictable");
      recommendations.push("Use cryptographic random number generators");
    }

    if (normalized.includes("rand") || normalized.includes("srand")) {
      issues.push("C rand() function is not cryptographically secure");
      recommendations.push("Use /dev/urandom, getrandom(), or crypto library");
    }

    return {
      secure: issues.length === 0,
      severity: issues.length > 0 ? ("CRITICAL" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.HIGH,
      issues,
      recommendations,
    };
  }

  /**
   * Generate cryptographically secure random bytes
   */
  static randomBytes(length: number): Buffer {
    const crypto = require("crypto");
    return crypto.randomBytes(length);
  }

  /**
   * Generate cryptographically secure random string
   */
  static randomString(length: number, encoding: "hex" | "base64" = "hex"): string {
    const bytes = this.randomBytes(Math.ceil(length / 2));
    return bytes.toString(encoding).slice(0, length);
  }

  /**
   * Generate secure random integer
   */
  static randomInt(min: number, max: number): number {
    const range = max - min + 1;
    const bytesNeeded = Math.ceil(Math.log2(range) / 8);
    const cutoff = Math.floor((256 ** bytesNeeded / range) * range);

    let value;
    do {
      value = this.randomBytes(bytesNeeded).reduce((acc, byte) => (acc << 8) + byte, 0);
    } while (value >= cutoff);

    return min + (value % range);
  }

  /**
   * Generate UUID v4
   */
  static generateUUID(): string {
    const crypto = require("crypto");
    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40; // Version 4
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // Variant 10

    return [
      bytes.slice(0, 4).toString("hex"),
      bytes.slice(4, 6).toString("hex"),
      bytes.slice(6, 8).toString("hex"),
      bytes.slice(8, 10).toString("hex"),
      bytes.slice(10, 16).toString("hex"),
    ].join("-");
  }

  /**
   * Hash data with specified algorithm
   */
  static hash(data: string | Buffer, algorithm: HashAlgorithm = HashAlgorithm.SHA256): string {
    const crypto = require("crypto");
    return crypto.createHash(algorithm).update(data).digest("hex");
  }

  /**
   * Hash with key (HMAC)
   */
  static hmac(
    data: string | Buffer,
    key: string | Buffer,
    algorithm: HashAlgorithm = HashAlgorithm.SHA256
  ): string {
    const crypto = require("crypto");
    return crypto.createHmac(algorithm, key).update(data).digest("hex");
  }

  /**
   * Derive key from password using PBKDF2
   */
  static deriveKeyPBKDF2(
    password: string,
    salt: string | Buffer,
    iterations: number = 100000,
    keyLength: number = 32,
    digest: HashAlgorithm = HashAlgorithm.SHA256
  ): Buffer {
    const crypto = require("crypto");
    return crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest);
  }

  /**
   * Hash password securely
   */
  static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const crypto = require("crypto");
    const passwordSalt = salt || crypto.randomBytes(16).toString("hex");
    const hash = this.deriveKeyPBKDF2(password, passwordSalt);
    return {
      hash: hash.toString("hex"),
      salt: passwordSalt,
    };
  }

  /**
   * Verify password against hash
   */
  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const derived = this.deriveKeyPBKDF2(password, salt);
    return derived.toString("hex") === hash;
  }

  /**
   * Encrypt using AES-256-GCM
   */
  static encrypt(plaintext: string | Buffer, key: Buffer, iv?: Buffer): { encrypted: string; authTag: string; iv: string } {
    const crypto = require("crypto");
    const algorithm = SymmetricAlgorithm.AES_256_GCM;

    const encryptionIV = iv || crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, encryptionIV);

    let encrypted = cipher.update(plaintext as Buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString("base64"),
      authTag: authTag.toString("base64"),
      iv: encryptionIV.toString("base64"),
    };
  }

  /**
   * Decrypt using AES-256-GCM
   */
  static decrypt(
    encrypted: string,
    key: Buffer,
    iv: string,
    authTag: string
  ): Buffer {
    const crypto = require("crypto");
    const algorithm = SymmetricAlgorithm.AES_256_GCM;

    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(authTag, "base64"));

    let decrypted = decipher.update(Buffer.from(encrypted, "base64"));
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }

  /**
   * Generate key pair for asymmetric encryption
   */
  static generateKeyPair(modulusLength: number = 4096): {
    publicKey: string;
    privateKey: string;
  } {
    const crypto = require("crypto");
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    return { publicKey, privateKey };
  }

  /**
   * Sign data with private key
   */
  static sign(data: string | Buffer, privateKey: string): string {
    const crypto = require("crypto");
    const sign = crypto.createSign("SHA256");
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, "base64");
  }

  /**
   * Verify signature with public key
   */
  static verify(data: string | Buffer, signature: string, publicKey: string): boolean {
    const crypto = require("crypto");
    const verify = crypto.createVerify("SHA256");
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, "base64");
  }

  /**
   * Generate constant-time comparison for timing attack prevention
   */
  static timingSafeEqual(a: Buffer, b: Buffer): boolean {
    const crypto = require("crypto");
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Validate key size
   */
  validateKeySize(algorithm: string, keySize: number): CryptoValidationResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const algo = algorithm.toLowerCase();

    if (algo.includes("aes")) {
      const minKeySize = this.secureKeySizes.aes;
      if (keySize < minKeySize) {
        issues.push(`AES key size is only ${keySize} bits`);
        recommendations.push(`Use AES-${minKeySize} or higher`);
      }
    } else if (algo.includes("rsa")) {
      const minKeySize = this.secureKeySizes.rsa;
      if (keySize < minKeySize) {
        issues.push(`RSA key size is only ${keySize} bits`);
        recommendations.push(`Use RSA-${minKeySize} or higher`);
      }
    }

    return {
      secure: issues.length === 0,
      severity: issues.length > 0 ? ("HIGH" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.HIGH,
      issues,
      recommendations,
    };
  }

  /**
   * Scan code for crypto issues
   */
  scanCodeForCryptoIssues(code: string): CryptoValidationResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for weak algorithms
    const weakPatterns = [
      { regex: /createHash\s*\(\s*['"`]md5['"`]/gi, name: "MD5" },
      { regex: /createHash\s*\(\s*['"`]sha1['"`]/gi, name: "SHA1" },
      { regex: /createCipheriv?\s*\(\s*['"`](?:aes-128|des|rc4)/gi, name: "Weak cipher" },
      { regex: /Math\.random\s*\(/gi, name: "Math.random()" },
    ];

    weakPatterns.forEach((pattern) => {
      if (pattern.regex.test(code)) {
        issues.push(`Weak cryptography detected: ${pattern.name}`);
        recommendations.push(`Replace ${pattern.name} with stronger alternative`);
      }
    });

    return {
      secure: issues.length === 0,
      severity: issues.length > 0 ? ("HIGH" as SecuritySeverity) : ("NONE" as SecuritySeverity),
      confidence: DetectionConfidence.HIGH,
      issues,
      recommendations,
    };
  }

  /**
   * Get recommended algorithms
   */
  static getRecommendedAlgorithms(): {
    symmetric: SymmetricAlgorithm;
    hash: HashAlgorithm;
    kdf: KDFAlgorithm;
    keySize: number;
  } {
    return {
      symmetric: SymmetricAlgorithm.AES_256_GCM,
      hash: HashAlgorithm.SHA256,
      kdf: KDFAlgorithm.PBKDF2,
      keySize: 256,
    };
  }
}

/**
 * Create crypto hardening utilities
 */
export function createCryptoHardening(): CryptoHardening {
  return new CryptoHardening();
}

/**
 * Convenience exports
 */
export const CryptoUtils = {
  randomBytes: CryptoHardening.randomBytes,
  randomString: CryptoHardening.randomString,
  randomInt: CryptoHardening.randomInt,
  generateUUID: CryptoHardening.generateUUID,
  hash: CryptoHardening.hash,
  hmac: CryptoHardening.hmac,
  hashPassword: CryptoHardening.hashPassword,
  verifyPassword: CryptoHardening.verifyPassword,
  encrypt: CryptoHardening.encrypt,
  decrypt: CryptoHardening.decrypt,
  generateKeyPair: CryptoHardening.generateKeyPair,
  sign: CryptoHardening.sign,
  verify: CryptoHardening.verify,
  timingSafeEqual: CryptoHardening.timingSafeEqual,
};
