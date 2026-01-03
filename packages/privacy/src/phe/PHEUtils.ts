/**
 * PHEUtils - Utility Functions for Partially Homomorphic Encryption
 *
 * This module provides utility functions for common PHE operations including
 * validation, conversion, comparison, and performance monitoring.
 *
 * ## Features
 *
 * - **Validation**: Validate keys, encrypted embeddings, and operations
 * - **Conversion**: Convert between different formats and representations
 * - **Comparison**: Compare encrypted values securely
 * - **Performance**: Monitor and optimize PHE operations
 * - **Security**: Security checks and best practices
 *
 * @packageDocumentation
 */

import {
  EncryptedEmbedding,
  PaillierPublicKey,
  PaillierPrivateKey,
  PaillierKeyPair,
  serializePublicKey,
  deserializePublicKey,
  serializePrivateKey,
  deserializePrivateKey,
  serializeEncryptedEmbedding,
  deserializeEncryptedEmbedding,
} from "../phe";

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors (if any) */
  errors: string[];
  /** Validation warnings (if any) */
  warnings: string[];
}

/**
 * Key comparison result
 */
export interface KeyComparisonResult {
  /** Whether keys match */
  matches: boolean;
  /** Comparison details */
  details: {
    /** Modulus matches */
    modulusMatches: boolean;
    /** Generator matches */
    generatorMatches: boolean;
    /** Bit length matches */
    bitLengthMatches: boolean;
  };
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Operation name */
  operation: string;
  /** Duration in milliseconds */
  duration: number;
  /** Memory usage in bytes */
  memoryUsage: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Security check result
 */
export interface SecurityCheckResult {
  /** Whether security check passed */
  passed: boolean;
  /** Security level */
  securityLevel: "weak" | "moderate" | "strong" | "very_strong";
  /** Recommendations */
  recommendations: string[];
  /** Warnings */
  warnings: string[];
}

/**
 * Conversion options
 */
export interface ConversionOptions {
  /** Target format */
  format: "json" | "base64" | "hex" | "binary";
  /** Include metadata */
  includeMetadata?: boolean;
  /** Compress output */
  compress?: boolean;
}

/**
 * PHEUtils - Utility Functions for PHE
 *
 * @example
 * ```typescript
 * // Validate public key
 * const validation = PHEUtils.validatePublicKey(publicKey);
 *
 * // Compare keys
 * const comparison = PHEUtils.compareKeys(key1, key2);
 *
 * // Security check
 * const security = PHEUtils.checkSecurity(keyPair);
 *
 * // Convert format
 * const converted = PHEUtils.convertFormat(encrypted, "base64");
 * ```
 */
export class PHEUtils {
  /**
   * Minimum recommended key size for Paillier encryption
   */
  static readonly MIN_KEY_SIZE = 2048;

  /**
   * Recommended key size for long-term security
   */
  static readonly RECOMMENDED_KEY_SIZE = 3072;

  /**
   * Maximum safe embedding dimension
   */
  static readonly MAX_DIMENSIONS = 10000;

  /**
   * Validate a Paillier public key
   *
   * @param key - Public key to validate
   * @returns Validation result
   */
  static validatePublicKey(key: PaillierPublicKey): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!key.n) {
      errors.push("Public key missing modulus (n)");
    }
    if (!key.g) {
      errors.push("Public key missing generator (g)");
    }
    if (!key.n2) {
      errors.push("Public key missing n squared (n2)");
    }

    // Check bit length
    if (key.bitLength < this.MIN_KEY_SIZE) {
      errors.push(
        `Key size too small: ${key.bitLength} bits (minimum: ${this.MIN_KEY_SIZE})`
      );
    } else if (key.bitLength < this.RECOMMENDED_KEY_SIZE) {
      warnings.push(
        `Key size below recommended: ${key.bitLength} bits (recommended: ${this.RECOMMENDED_KEY_SIZE})`
      );
    }

    // Verify n2 = n * n
    if (key.n && key.n2 && key.n2 !== key.n * key.n) {
      errors.push("Invalid public key: n2 != n * n");
    }

    // Verify g is in correct range
    if (key.g && key.n && key.n2) {
      if (key.g <= BigInt(1) || key.g >= key.n2) {
        errors.push("Invalid public key: g out of range [1, n²)");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a Paillier private key
   *
   * @param key - Private key to validate
   * @returns Validation result
   */
  static validatePrivateKey(key: PaillierPrivateKey): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!key.n) {
      errors.push("Private key missing modulus (n)");
    }
    if (!key.lambda) {
      errors.push("Private key missing lambda (λ)");
    }
    if (!key.mu) {
      errors.push("Private key missing mu (μ)");
    }
    if (!key.n2) {
      errors.push("Private key missing n squared (n2)");
    }

    // Verify n2 = n * n
    if (key.n && key.n2 && key.n2 !== key.n * key.n) {
      errors.push("Invalid private key: n2 != n * n");
    }

    // Verify lambda > 0
    if (key.lambda && key.lambda <= BigInt(0)) {
      errors.push("Invalid private key: lambda must be positive");
    }

    // Verify mu in range
    if (key.mu && key.n && (key.mu <= BigInt(0) || key.mu >= key.n)) {
      errors.push("Invalid private key: mu out of range [0, n)");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate an encrypted embedding
   *
   * @param embedding - Encrypted embedding to validate
   * @returns Validation result
   */
  static validateEncryptedEmbedding(
    embedding: EncryptedEmbedding
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!embedding.values) {
      errors.push("Encrypted embedding missing values");
    }
    if (!embedding.publicKey) {
      errors.push("Encrypted embedding missing public key");
    }
    if (!embedding.dimensions) {
      errors.push("Encrypted embedding missing dimensions");
    }
    if (!embedding.precision) {
      errors.push("Encrypted embedding missing precision");
    }

    // Check dimensions
    if (embedding.dimensions) {
      if (embedding.dimensions <= 0) {
        errors.push(`Invalid dimensions: ${embedding.dimensions} (must be positive)`);
      }
      if (embedding.dimensions > this.MAX_DIMENSIONS) {
        warnings.push(
          `Large dimensions: ${embedding.dimensions} (max: ${this.MAX_DIMENSIONS})`
        );
      }
    }

    // Check values length matches dimensions
    if (
      embedding.values &&
      embedding.dimensions &&
      embedding.values.length !== embedding.dimensions
    ) {
      errors.push(
        `Values length mismatch: ${embedding.values.length} != ${embedding.dimensions}`
      );
    }

    // Validate public key
    if (embedding.publicKey) {
      const keyValidation = this.validatePublicKey(embedding.publicKey);
      errors.push(...keyValidation.errors);
      warnings.push(...keyValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a key pair
   *
   * @param keyPair - Key pair to validate
   * @returns Validation result
   */
  static validateKeyPair(keyPair: PaillierKeyPair): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate public key
    const pubKeyValidation = this.validatePublicKey(keyPair.publicKey);
    errors.push(...pubKeyValidation.errors);
    warnings.push(...pubKeyValidation.warnings);

    // Validate private key
    const privKeyValidation = this.validatePrivateKey(keyPair.privateKey);
    errors.push(...privKeyValidation.errors);
    warnings.push(...privKeyValidation.warnings);

    // Check keys match
    if (
      keyPair.publicKey.n &&
      keyPair.privateKey.n &&
      keyPair.publicKey.n !== keyPair.privateKey.n
    ) {
      errors.push("Key pair mismatch: public and private keys have different n");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Compare two public keys
   *
   * @param key1 - First public key
   * @param key2 - Second public key
   * @returns Comparison result
   */
  static comparePublicKeys(
    key1: PaillierPublicKey,
    key2: PaillierPublicKey
  ): KeyComparisonResult {
    const modulusMatches = key1.n === key2.n;
    const generatorMatches = key1.g === key2.g;
    const bitLengthMatches = key1.bitLength === key2.bitLength;

    return {
      matches: modulusMatches && generatorMatches && bitLengthMatches,
      details: {
        modulusMatches,
        generatorMatches,
        bitLengthMatches,
      },
    };
  }

  /**
   * Perform security check on key pair
   *
   * @param keyPair - Key pair to check
   * @returns Security check result
   */
  static checkSecurity(keyPair: PaillierKeyPair): SecurityCheckResult {
    const recommendations: string[] = [];
    const warnings: string[] = [];
    let securityLevel: "weak" | "moderate" | "strong" | "very_strong" = "weak";

    const keySize = keyPair.publicKey.bitLength;

    // Assess security level based on key size
    if (keySize >= 4096) {
      securityLevel = "very_strong";
    } else if (keySize >= 3072) {
      securityLevel = "strong";
    } else if (keySize >= 2048) {
      securityLevel = "moderate";
      recommendations.push("Consider upgrading to 3072-bit keys for long-term security");
    } else {
      securityLevel = "weak";
      recommendations.push(`Key size ${keySize} is below minimum 2048 bits`);
    }

    // Check for potential issues
    if (keyPair.privateKey.p && keyPair.privateKey.q) {
      // Check if p and q are too close (security risk)
      const ratio =
        Number(keyPair.privateKey.p) / Number(keyPair.privateKey.q);
      if (ratio > 0.9 && ratio < 1.1) {
        warnings.push("Primes p and q are very close, consider regenerating keys");
      }
    }

    return {
      passed: securityLevel !== "weak",
      securityLevel,
      recommendations,
      warnings,
    };
  }

  /**
   * Convert encrypted embedding to different format
   *
   * @param embedding - Encrypted embedding
   * @param options - Conversion options
   * @returns Converted data
   */
  static convertFormat(
    embedding: EncryptedEmbedding,
    options: ConversionOptions
  ): string {
    switch (options.format) {
      case "json":
        return serializeEncryptedEmbedding(embedding);

      case "base64":
        const jsonStr = serializeEncryptedEmbedding(embedding);
        return Buffer.from(jsonStr).toString("base64");

      case "hex":
        const jsonStr2 = serializeEncryptedEmbedding(embedding);
        return Buffer.from(jsonStr2).toString("hex");

      case "binary":
        return serializeEncryptedEmbedding(embedding);

      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Parse encrypted embedding from format
   *
   * @param data - Serialized data
   * @param format - Source format
   * @returns Deserialized encrypted embedding
   */
  static parseFormat(
    data: string,
    format: "json" | "base64" | "hex" | "binary"
  ): EncryptedEmbedding {
    switch (format) {
      case "json":
        return deserializeEncryptedEmbedding(data);

      case "base64":
        const jsonStr = Buffer.from(data, "base64").toString("utf-8");
        return deserializeEncryptedEmbedding(jsonStr);

      case "hex":
        const jsonStr2 = Buffer.from(data, "hex").toString("utf-8");
        return deserializeEncryptedEmbedding(jsonStr2);

      case "binary":
        return deserializeEncryptedEmbedding(data);

      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Measure performance of an operation
   *
   * @param operation - Operation to measure
   * @param operationName - Name of operation
   * @returns Performance metrics
   */
  static async measurePerformance<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = Date.now();

    const result = await operation();

    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;

    const metrics: PerformanceMetrics = {
      operation: operationName,
      duration: endTime - startTime,
      memoryUsage: endMemory - startMemory,
      timestamp: startTime,
    };

    return { result, metrics };
  }

  /**
   * Estimate encryption time for given dimensions
   *
   * @param dimensions - Number of dimensions
   * @param keySize - Key size in bits
   * @returns Estimated time in milliseconds
   */
  static estimateEncryptionTime(
    dimensions: number,
    keySize: number
  ): number {
    // Base time for 2048-bit key, 768 dimensions
    const baseTime = 100;
    const baseDimensions = 768;
    const baseKeySize = 2048;

    // Time scales linearly with dimensions
    const dimensionFactor = dimensions / baseDimensions;

    // Time scales with key size (roughly cubic for modular exponentiation)
    const keySizeFactor = Math.pow(keySize / baseKeySize, 3);

    return Math.round(baseTime * dimensionFactor * keySizeFactor);
  }

  /**
   * Estimate decryption time for given dimensions
   *
   * @param dimensions - Number of dimensions
   * @param keySize - Key size in bits
   * @returns Estimated time in milliseconds
   */
  static estimateDecryptionTime(
    dimensions: number,
    keySize: number
  ): number {
    // Decryption is similar to encryption (modular exponentiation)
    return this.estimateEncryptionTime(dimensions, keySize);
  }

  /**
   * Estimate homomorphic addition time for given dimensions
   *
   * @param dimensions - Number of dimensions
   * @returns Estimated time in milliseconds
   */
  static estimateAdditionTime(dimensions: number): number {
    // Addition is multiplication modulo n², much faster than encryption
    const baseTime = 10;
    const baseDimensions = 768;

    return Math.round(baseTime * (dimensions / baseDimensions));
  }

  /**
   * Generate key fingerprint for identification
   *
   * @param publicKey - Public key to fingerprint
   * @returns Fingerprint string
   */
  static generateFingerprint(publicKey: PaillierPublicKey): string {
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256");

    // Hash the modulus n
    hash.update(publicKey.n.toString(16));

    // Return first 16 characters of hash
    return hash.digest("hex").substring(0, 16);
  }

  /**
   * Clone encrypted embedding (deep copy)
   *
   * @param embedding - Encrypted embedding to clone
   * @returns Cloned embedding
   */
  static cloneEncryptedEmbedding(
    embedding: EncryptedEmbedding
  ): EncryptedEmbedding {
    return {
      values: [...embedding.values],
      publicKey: { ...embedding.publicKey },
      dimensions: embedding.dimensions,
      precision: embedding.precision,
    };
  }

  /**
   * Check if encrypted embedding is empty
   *
   * @param embedding - Encrypted embedding to check
   * @returns True if empty
   */
  static isEmpty(embedding: EncryptedEmbedding): boolean {
    return !embedding.values || embedding.values.length === 0;
  }

  /**
   * Get size of encrypted embedding in bytes
   *
   * @param embedding - Encrypted embedding
   * @returns Size in bytes
   */
  static getSizeInBytes(embedding: EncryptedEmbedding): number {
    // Each encrypted value is a bigint (roughly keySize/8 bytes)
    const valueSize = embedding.publicKey.bitLength / 8;
    const valuesSize = embedding.values.length * valueSize;

    // Add metadata overhead
    const metadataSize = JSON.stringify({
      dimensions: embedding.dimensions,
      precision: embedding.precision,
    }).length;

    return Math.round(valuesSize + metadataSize);
  }

  /**
   * Validate operation result
   *
   * @param result - Operation result to validate
   * @returns True if valid
   */
  static isValidOperationResult<T>(result: {
    success?: boolean;
    error?: string;
  }): result is { success: true; result: T } {
    return result.success === true && !result.error;
  }
}

/**
 * Performance profiler for PHE operations
 */
export class PHEPerformanceProfiler {
  private metrics: PerformanceMetrics[] = [];

  /**
   * Start profiling an operation
   */
  start(operationName: string): () => PerformanceMetrics {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    return () => {
      const endTime = Date.now();
      const endMemory = process.memoryUsage().heapUsed;

      const metrics: PerformanceMetrics = {
        operation: operationName,
        duration: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        timestamp: startTime,
      };

      this.metrics.push(metrics);
      return metrics;
    };
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific operation
   */
  getMetricsForOperation(operationName: string): PerformanceMetrics[] {
    return this.metrics.filter((m) => m.operation === operationName);
  }

  /**
   * Get average duration for an operation
   */
  getAverageDuration(operationName: string): number {
    const opsMetrics = this.getMetricsForOperation(operationName);
    if (opsMetrics.length === 0) return 0;

    const total = opsMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / opsMetrics.length;
  }

  /**
   * Get total duration for all operations
   */
  getTotalDuration(): number {
    return this.metrics.reduce((sum, m) => sum + m.duration, 0);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Generate summary report
   */
  generateReport(): string {
    const lines: string[] = [];
    lines.push("=== PHE Performance Report ===");
    lines.push(`Total operations: ${this.metrics.length}`);
    lines.push(`Total duration: ${this.getTotalDuration()}ms`);
    lines.push("");

    // Group by operation
    const grouped = new Map<string, PerformanceMetrics[]>();
    for (const metric of this.metrics) {
      if (!grouped.has(metric.operation)) {
        grouped.set(metric.operation, []);
      }
      grouped.get(metric.operation)!.push(metric);
    }

    // Report each operation
    for (const [operation, opsMetrics] of grouped.entries()) {
      const avgDuration =
        opsMetrics.reduce((sum, m) => sum + m.duration, 0) / opsMetrics.length;
      const avgMemory =
        opsMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / opsMetrics.length;
      lines.push(`${operation}:`);
      lines.push(`  Count: ${opsMetrics.length}`);
      lines.push(`  Avg duration: ${avgDuration.toFixed(2)}ms`);
      lines.push(`  Avg memory: ${avgMemory.toFixed(2)} bytes`);
    }

    return lines.join("\n");
  }
}
