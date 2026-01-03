/**
 * PHEOperations - Encrypted Operations on Paillier-Encrypted Data
 *
 * This module provides operations for computing on encrypted data without decryption,
 * leveraging the additive homomorphism of the Paillier cryptosystem.
 *
 * ## Supported Operations
 *
 * - **Encrypted Addition**: E(a) + E(b) = E(a + b)
 * - **Scalar Multiplication**: E(a) * k = E(k * a)
 * - **Encrypted Aggregation**: Sum, mean, variance on encrypted vectors
 * - **Encrypted Comparison**: Secure comparison protocols
 * - **Batch Operations**: Efficient operations on multiple encrypted values
 *
 * ## Limitations
 *
 * Paillier only supports additive homomorphism. For full computation (multiplication,
 * comparison, etc.), we need either:
 * - Intermediate decryption (not fully private)
 * - Fully Homomorphic Encryption (FHE)
 * - Secure Multi-Party Computation (MPC)
 *
 * This module provides best-effort privacy with Paillier's additive properties.
 *
 * @packageDocumentation
 */

import {
  PHE,
  EncryptedEmbedding,
  PaillierPublicKey,
  PaillierPrivateKey,
  DEFAULT_PRECISION,
} from "../phe";

/**
 * Operation result metadata
 */
export interface OperationResult<T> {
  /** Result of the operation */
  result: T;
  /** Operation timestamp */
  timestamp: number;
  /** Operation duration in milliseconds */
  duration: number;
  /** Whether operation was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  /** Aggregated encrypted embedding */
  encrypted: EncryptedEmbedding;
  /** Number of embeddings aggregated */
  count: number;
  /** Aggregation duration in milliseconds */
  duration: number;
}

/**
 * Statistics result (requires decryption)
 */
export interface StatisticsResult {
  /** Mean value (requires decryption) */
  mean: number;
  /** Variance (requires decryption) */
  variance: number;
  /** Standard deviation (requires decryption) */
  stdDev: number;
  /** Minimum value (requires decryption) */
  min: number;
  /** Maximum value (requires decryption) */
  max: number;
  /** Computation duration in milliseconds */
  duration: number;
}

/**
 * Comparison result
 */
export interface ComparisonResult {
  /** Comparison result (-1, 0, 1) */
  result: number;
  /** Whether comparison was done on encrypted data */
  encrypted: boolean;
  /** Comparison duration in milliseconds */
  duration: number;
}

/**
 * Batch operation configuration
 */
export interface BatchConfig {
  /** Batch size for parallel processing (default: 100) */
  batchSize?: number;
  /** Enable progress tracking (default: false) */
  enableProgress?: boolean;
  /** Progress callback */
  onProgress?: (current: number, total: number) => void;
}

/**
 * PHEOperations - Operations on Encrypted Data
 *
 * @example
 * ```typescript
 * const ops = new PHEOperations();
 *
 * // Sum encrypted embeddings
 * const embeddings = [encrypted1, encrypted2, encrypted3];
 * const sum = await ops.sumEncrypted(embeddings);
 *
 * // Compute mean (requires decryption)
 * const mean = await ops.meanEncrypted(sum.encrypted, embeddings.length, privateKey);
 *
 * // Scalar multiplication
 * const scaled = ops.scalarMultiply(encrypted, 5);
 * ```
 */
export class PHEOperations {
  private phe: PHE;
  private stats: {
    additions: number;
    multiplications: number;
    aggregations: number;
    comparisons: number;
    totalTime: number;
  };

  constructor() {
    this.phe = new PHE({
      enableValidation: true,
    });
    this.stats = {
      additions: 0,
      multiplications: 0,
      aggregations: 0,
      comparisons: 0,
      totalTime: 0,
    };
  }

  /**
   * Add two encrypted embeddings element-wise
   *
   * E(a) + E(b) = E(a + b)
   *
   * @param a - First encrypted embedding
   * @param b - Second encrypted embedding
   * @returns Encrypted sum
   */
  addEncrypted(
    a: EncryptedEmbedding,
    b: EncryptedEmbedding
  ): OperationResult<EncryptedEmbedding> {
    const startTime = Date.now();

    try {
      if (a.dimensions !== b.dimensions) {
        throw new Error(`Dimension mismatch: ${a.dimensions} != ${b.dimensions}`);
      }

      if (a.precision !== b.precision) {
        throw new Error(`Precision mismatch: ${a.precision} != ${b.precision}`);
      }

      const result: bigint[] = [];
      for (let i = 0; i < a.values.length; i++) {
        // Homomorphic addition: multiply ciphertexts
        const sum = (a.values[i] * b.values[i]) % a.publicKey.n2;
        result.push(sum);
      }

      this.stats.additions++;
      const duration = Date.now() - startTime;
      this.stats.totalTime += duration;

      return {
        result: {
          values: result,
          publicKey: a.publicKey,
          dimensions: a.dimensions,
          precision: a.precision,
        },
        timestamp: Date.now(),
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        result: null as any,
        timestamp: Date.now(),
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Subtract encrypted b from encrypted a
   *
   * E(a) - E(b) = E(a - b)
   *
   * Uses the property: E(-b) = E(b)^(-1) mod n²
   *
   * @param a - First encrypted embedding
   * @param b - Second encrypted embedding (to subtract)
   * @returns Encrypted difference
   */
  subtractEncrypted(
    a: EncryptedEmbedding,
    b: EncryptedEmbedding
  ): OperationResult<EncryptedEmbedding> {
    const startTime = Date.now();

    try {
      if (a.dimensions !== b.dimensions) {
        throw new Error(`Dimension mismatch: ${a.dimensions} != ${b.dimensions}`);
      }

      const result: bigint[] = [];
      for (let i = 0; i < a.values.length; i++) {
        // Compute modular inverse of b's ciphertext
        const bInv = this.modInverse(b.values[i], a.publicKey.n2);
        // Multiply: a * b^(-1) = a - b (mod n²)
        const diff = (a.values[i] * bInv) % a.publicKey.n2;
        result.push(diff);
      }

      this.stats.additions++;
      const duration = Date.now() - startTime;
      this.stats.totalTime += duration;

      return {
        result: {
          values: result,
          publicKey: a.publicKey,
          dimensions: a.dimensions,
          precision: a.precision,
        },
        timestamp: Date.now(),
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        result: null as any,
        timestamp: Date.now(),
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Multiply encrypted embedding by scalar
   *
   * E(a)^k = E(k * a)
   *
   * @param encrypted - Encrypted embedding
   * @param scalar - Scalar multiplier
   * @returns Encrypted scaled embedding
   */
  scalarMultiply(
    encrypted: EncryptedEmbedding,
    scalar: number
  ): OperationResult<EncryptedEmbedding> {
    const startTime = Date.now();

    try {
      const k = BigInt(scalar);
      const result: bigint[] = [];

      for (let i = 0; i < encrypted.values.length; i++) {
        // Enc(a)^k = Enc(k * a)
        const scaled = this.modPow(encrypted.values[i], k, encrypted.publicKey.n2);
        result.push(scaled);
      }

      this.stats.multiplications++;
      const duration = Date.now() - startTime;
      this.stats.totalTime += duration;

      return {
        result: {
          values: result,
          publicKey: encrypted.publicKey,
          dimensions: encrypted.dimensions,
          precision: encrypted.precision,
        },
        timestamp: Date.now(),
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        result: null as any,
        timestamp: Date.now(),
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Sum multiple encrypted embeddings
   *
   * E(a1) + E(a2) + ... + E(an) = E(a1 + a2 + ... + an)
   *
   * @param embeddings - Array of encrypted embeddings
   * @param config - Batch configuration
   * @returns Aggregation result
   */
  async sumEncrypted(
    embeddings: EncryptedEmbedding[],
    config?: BatchConfig
  ): Promise<OperationResult<EncryptedEmbedding>> {
    const startTime = Date.now();
    const batchSize = config?.batchSize ?? 100;

    try {
      if (embeddings.length === 0) {
        throw new Error("Cannot sum empty array");
      }

      const { dimensions, precision, publicKey } = embeddings[0];

      // Validate all embeddings have same dimensions
      for (let i = 1; i < embeddings.length; i++) {
        if (embeddings[i].dimensions !== dimensions) {
          throw new Error(`Dimension mismatch at index ${i}`);
        }
      }

      // Initialize result with first embedding
      let result: EncryptedEmbedding = {
        values: [...embeddings[0].values],
        publicKey,
        dimensions,
        precision,
      };

      // Add remaining embeddings in batches
      for (let i = 1; i < embeddings.length; i++) {
        const addResult = this.addEncrypted(result, embeddings[i]);
        if (!addResult.success) {
          throw new Error(`Failed to add embedding at index ${i}: ${addResult.error}`);
        }
        result = addResult.result;

        // Report progress
        if (config?.enableProgress && config.onProgress) {
          config.onProgress(i + 1, embeddings.length);
        }
      }

      this.stats.aggregations++;
      const duration = Date.now() - startTime;
      this.stats.totalTime += duration;

      return {
        result,
        timestamp: Date.now(),
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        result: null as any,
        timestamp: Date.now(),
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Compute mean of encrypted embeddings
   *
   * Mean = Sum / count
   * Note: Division is not directly supported in Paillier.
   * This requires decrypting the sum, dividing, and re-encrypting.
   *
   * @param embeddings - Array of encrypted embeddings
   * @param privateKey - Private key for intermediate decryption
   * @param config - Batch configuration
   * @returns Decrypted mean (as Float32Array)
   */
  async meanEncrypted(
    embeddings: EncryptedEmbedding[],
    privateKey: PaillierPrivateKey,
    config?: BatchConfig
  ): Promise<OperationResult<Float32Array>> {
    const startTime = Date.now();

    try {
      // Sum encrypted embeddings
      const sumResult = await this.sumEncrypted(embeddings, config);
      if (!sumResult.success) {
        throw new Error(`Failed to sum embeddings: ${sumResult.error}`);
      }

      // Decrypt sum
      const decryptedSum = this.phe.decrypt(sumResult.result, privateKey);

      // Divide by count
      const count = embeddings.length;
      const mean = new Float32Array(decryptedSum.length);
      for (let i = 0; i < mean.length; i++) {
        mean[i] = decryptedSum[i] / count;
      }

      const duration = Date.now() - startTime;
      this.stats.totalTime += duration;

      return {
        result: mean,
        timestamp: Date.now(),
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        result: null as any,
        timestamp: Date.now(),
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Compute variance of encrypted embeddings
   *
   * Var = E[(X - μ)²] = E[X²] - μ²
   *
   * Note: This requires decrypting intermediate results.
   * For fully encrypted variance, use FHE or MPC.
   *
   * @param embeddings - Array of encrypted embeddings
   * @param privateKey - Private key for intermediate decryption
   * @param config - Batch configuration
   * @returns Variance per dimension
   */
  async varianceEncrypted(
    embeddings: EncryptedEmbedding[],
    privateKey: PaillierPrivateKey,
    config?: BatchConfig
  ): Promise<OperationResult<Float32Array>> {
    const startTime = Date.now();

    try {
      // Compute mean
      const meanResult = await this.meanEncrypted(embeddings, privateKey, config);
      if (!meanResult.success) {
        throw new Error(`Failed to compute mean: ${meanResult.error}`);
      }

      const mean = meanResult.result;
      const dimensions = mean.length;
      const variance = new Float32Array(dimensions);

      // Decrypt all embeddings
      const decrypted: Float32Array[] = [];
      for (const emb of embeddings) {
        decrypted.push(this.phe.decrypt(emb, privateKey));
      }

      // Compute variance
      for (let i = 0; i < dimensions; i++) {
        let sumSquaredDiff = 0;
        for (let j = 0; j < decrypted.length; j++) {
          const diff = decrypted[j][i] - mean[i];
          sumSquaredDiff += diff * diff;
        }
        variance[i] = sumSquaredDiff / decrypted.length;
      }

      const duration = Date.now() - startTime;
      this.stats.totalTime += duration;

      return {
        result: variance,
        timestamp: Date.now(),
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        result: null as any,
        timestamp: Date.now(),
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Compute full statistics on encrypted embeddings
   *
   * @param embeddings - Array of encrypted embeddings
   * @param privateKey - Private key for intermediate decryption
   * @param config - Batch configuration
   * @returns Statistics result
   */
  async statisticsEncrypted(
    embeddings: EncryptedEmbedding[],
    privateKey: PaillierPrivateKey,
    config?: BatchConfig
  ): Promise<OperationResult<StatisticsResult>> {
    const startTime = Date.now();

    try {
      // Compute mean
      const meanResult = await this.meanEncrypted(embeddings, privateKey, config);
      if (!meanResult.success) {
        throw new Error(`Failed to compute mean: ${meanResult.error}`);
      }

      // Compute variance
      const varianceResult = await this.varianceEncrypted(
        embeddings,
        privateKey,
        config
      );
      if (!varianceResult.success) {
        throw new Error(`Failed to compute variance: ${varianceResult.error}`);
      }

      const mean = meanResult.result;
      const variance = varianceResult.result;
      const stdDev = new Float32Array(mean.length);
      const min = new Float32Array(mean.length);
      const max = new Float32Array(mean.length);

      // Initialize min/max
      for (let i = 0; i < mean.length; i++) {
        stdDev[i] = Math.sqrt(variance[i]);
        min[i] = Infinity;
        max[i] = -Infinity;
      }

      // Decrypt all embeddings to compute min/max
      for (const emb of embeddings) {
        const decrypted = this.phe.decrypt(emb, privateKey);
        for (let i = 0; i < decrypted.length; i++) {
          if (decrypted[i] < min[i]) min[i] = decrypted[i];
          if (decrypted[i] > max[i]) max[i] = decrypted[i];
        }
      }

      const duration = Date.now() - startTime;
      this.stats.totalTime += duration;

      return {
        result: {
          mean: mean[0], // Return first dimension as scalar
          variance: variance[0],
          stdDev: stdDev[0],
          min: min[0],
          max: max[0],
          duration,
        },
        timestamp: Date.now(),
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        result: null as any,
        timestamp: Date.now(),
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Compare two encrypted values (requires decryption)
   *
   * For true encrypted comparison, use secure comparison protocols
   * or FHE. This implementation decrypts for comparison.
   *
   * @param a - First encrypted embedding
   * @param b - Second encrypted embedding
   * @param privateKey - Private key for decryption
   * @returns Comparison result (-1, 0, 1)
   */
  async compareEncrypted(
    a: EncryptedEmbedding,
    b: EncryptedEmbedding,
    privateKey: PaillierPrivateKey
  ): Promise<ComparisonResult> {
    const startTime = Date.now();

    try {
      // Decrypt both embeddings
      const decryptedA = this.phe.decrypt(a, privateKey);
      const decryptedB = this.phe.decrypt(b, privateKey);

      // Compute L2 norm for comparison
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < decryptedA.length; i++) {
        normA += decryptedA[i] * decryptedA[i];
        normB += decryptedB[i] * decryptedB[i];
      }
      normA = Math.sqrt(normA);
      normB = Math.sqrt(normB);

      let result: number;
      if (Math.abs(normA - normB) < 1e-6) {
        result = 0;
      } else if (normA < normB) {
        result = -1;
      } else {
        result = 1;
      }

      this.stats.comparisons++;
      const duration = Date.now() - startTime;
      this.stats.totalTime += duration;

      return {
        result,
        encrypted: false, // Required decryption
        duration,
      };
    } catch (error) {
      return {
        result: 0,
        encrypted: false,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Compute dot product of encrypted and plaintext vectors
   *
   * Note: This requires decrypting intermediate results.
   *
   * @param encryptedA - Encrypted embedding A
   * @param plaintextB - Plaintext embedding B
   * @param privateKey - Private key for decryption
   * @returns Dot product
   */
  dotProduct(
    encryptedA: EncryptedEmbedding,
    plaintextB: Float32Array,
    privateKey: PaillierPrivateKey
  ): OperationResult<number> {
    const startTime = Date.now();

    try {
      if (encryptedA.dimensions !== plaintextB.length) {
        throw new Error(
          `Dimension mismatch: ${encryptedA.dimensions} != ${plaintextB.length}`
        );
      }

      // Decrypt encrypted A
      const decryptedA = this.phe.decrypt(encryptedA, privateKey);

      // Compute dot product
      let dotProduct = 0;
      for (let i = 0; i < decryptedA.length; i++) {
        dotProduct += decryptedA[i] * plaintextB[i];
      }

      const duration = Date.now() - startTime;
      this.stats.totalTime += duration;

      return {
        result: dotProduct,
        timestamp: Date.now(),
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        result: 0,
        timestamp: Date.now(),
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get statistics about operations
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      additions: 0,
      multiplications: 0,
      aggregations: 0,
      comparisons: 0,
      totalTime: 0,
    };
  }

  /**
   * Modular exponentiation
   */
  private modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = BigInt(1);
    let b = base % mod;
    let e = exp;

    while (e > BigInt(0)) {
      if (e % BigInt(2) === BigInt(1)) {
        result = (result * b) % mod;
      }
      e >>= BigInt(1);
      b = (b * b) % mod;
    }

    return result;
  }

  /**
   * Modular multiplicative inverse
   */
  private modInverse(a: bigint, m: bigint): bigint {
    const [gcd, x] = this.extendedGcd(a, m);

    if (gcd !== BigInt(1)) {
      throw new Error("Modular inverse does not exist");
    }

    return ((x % m) + m) % m;
  }

  /**
   * Extended Euclidean algorithm
   */
  private extendedGcd(a: bigint, m: bigint): [bigint, bigint, bigint] {
    if (a === BigInt(0)) {
      return [m, BigInt(0), BigInt(1)];
    }

    const [gcd, x1, y1] = this.extendedGcd(m % a, a);
    const x = y1 - (m / a) * x1;
    const y = x1;

    return [gcd, x, y];
  }
}
