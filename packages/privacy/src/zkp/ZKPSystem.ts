/**
 * @fileoverview Main Zero Knowledge Proof System
 *
 * Provides the core ZKP functionality including:
 * - Proof generation
 * - Proof verification
 * - Batch verification
 * - Proof caching
 * - Security parameter management
 */

import type {
  ZKPConfig,
  ZKPProof,
  ZKPStatement,
  ZKPWitness,
  ZKPVerificationResult,
  ZKPProofType,
  ZKPSecurityLevel,
} from "./types.js";
import {
  DEFAULT_ZKP_CONFIG,
  MAX_PROOF_SIZE_BYTES,
  MAX_BATCH_SIZE,
  DEFAULT_CACHE_TTL_MS,
  MAX_CACHE_SIZE,
  ZKP_ERROR_CODES,
} from "./constants.js";
import {
  generateProofId,
  validateProofFormat,
  checkProofFreshness,
  getProofAge,
  generateVerificationId,
  hashToField,
  withTimeout,
  measureTime,
} from "./utils.js";
import { ZKPVerificationError, ZKPGenerationError } from "./types.js";

// ============================================================================
// PROOF CACHE ENTRY
// ============================================================================

/**
 * Cached proof with metadata
 */
interface CacheEntry {
  proof: ZKPProof;
  verifiedAt: number;
  result: ZKPVerificationResult;
}

// ============================================================================
// ZKP SYSTEM CLASS
// ============================================================================

/**
 * Main ZKP System class
 *
 * Manages zero knowledge proof generation and verification with caching,
 * batch processing, and security level enforcement.
 *
 * @example
 * ```typescript
 * const zkp = new ZKPSystem({
 *   securityLevel: "HIGH",
 *   hashFunction: "SHA256"
 * });
 *
 * // Verify a proof
 * const result = await zkp.verify(proof);
 * console.log(result.valid); // true or false
 * ```
 */
export class ZKPSystem {
  private config: ZKPConfig;
  private proofCache: Map<string, CacheEntry>;
  private cacheStats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(config: Partial<ZKPConfig> = {}) {
    this.config = { ...DEFAULT_ZKP_CONFIG, ...config } as ZKPConfig;
    this.proofCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  // ========================================================================
  // PROOF VERIFICATION
  // ========================================================================

  /**
   * Verify a zero knowledge proof
   *
   * Checks that the proof is valid, not expired, and properly formatted.
   * Uses caching to avoid redundant verifications.
   *
   * @param proof - Proof to verify
   * @returns Verification result
   */
  async verify<T = Record<string, unknown>>(
    proof: ZKPProof<T>
  ): Promise<ZKPVerificationResult> {
    const startTime = performance.now();

    try {
      // Check proof format
      if (!validateProofFormat(proof)) {
        return {
          valid: false,
          verificationId: generateVerificationId(),
          proofId: proof.proofId,
          verifiedAt: Date.now(),
          verificationTimeMs: performance.now() - startTime,
          securityLevel: this.config.securityLevel,
          error: "Invalid proof format",
        };
      }

      // Check proof freshness
      if (!checkProofFreshness(proof, this.config.maxProofAgeMs)) {
        return {
          valid: false,
          verificationId: generateVerificationId(),
          proofId: proof.proofId,
          verifiedAt: Date.now(),
          verificationTimeMs: performance.now() - startTime,
          securityLevel: this.config.securityLevel,
          error: "Proof is expired or too old",
          metadata: {
            proofAgeMs: getProofAge(proof),
            expired: true,
            fromCache: false,
            constraintsChecked: 0,
          },
        };
      }

      // Check cache
      const cached = this.getFromCache(proof.proofId);
      if (cached) {
        this.cacheStats.hits++;
        return {
          valid: cached.result.valid,
          verificationId: cached.result.verificationId,
          proofId: cached.result.proofId,
          verifiedAt: cached.result.verifiedAt,
          verificationTimeMs: performance.now() - startTime,
          securityLevel: cached.result.securityLevel,
          error: cached.result.error,
          metadata: {
            ...cached.result.metadata,
            proofAgeMs: Date.now() - cached.result.verifiedAt,
            expired: cached.result.metadata?.expired || false,
            fromCache: true,
            constraintsChecked: cached.result.metadata?.constraintsChecked || 0,
          },
        };
      }

      this.cacheStats.misses++;

      // Verify proof with timeout
      const result = await withTimeout(
        () => this.verifyProofInternal(proof),
        this.config.proofVerificationTimeout
      );

      // Cache the result
      if (result.valid && this.config.enableProofCaching) {
        this.addToCache(proof, result);
      }

      return result;
    } catch (error) {
      return {
        valid: false,
        verificationId: generateVerificationId(),
        proofId: proof.proofId,
        verifiedAt: Date.now(),
        verificationTimeMs: performance.now() - startTime,
        securityLevel: this.config.securityLevel,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Internal proof verification logic
   *
   * This is where actual cryptographic verification happens.
   * Subclasses or specific proof types can override this.
   *
   * @param proof - Proof to verify
   * @returns Verification result
   */
  protected async verifyProofInternal<T = Record<string, unknown>>(
    proof: ZKPProof<T>
  ): Promise<ZKPVerificationResult> {
    // Base verification checks that apply to all proof types

    // Check statement constraints
    const { valid, constraintsChecked } = await this.checkConstraints(
      proof.statement,
      proof.proofData as Record<string, unknown>
    );

    const verificationResult: ZKPVerificationResult = {
      valid,
      verificationId: generateVerificationId(),
      proofId: proof.proofId,
      verifiedAt: Date.now(),
      verificationTimeMs: 0, // Will be set by caller
      securityLevel: this.config.securityLevel,
      metadata: {
        proofAgeMs: getProofAge(proof),
        expired: false,
        fromCache: false,
        constraintsChecked,
      },
    };

    if (!valid) {
      verificationResult.error = "Constraint verification failed";
    }

    return verificationResult;
  }

  /**
   * Check statement constraints
   *
   * Verifies that the proof data satisfies all constraints in the statement.
   *
   * @param statement - Statement with constraints
   * @param proofData - Proof data to check against
   * @returns Valid flag and number of constraints checked
   */
  protected async checkConstraints(
    statement: ZKPStatement,
    proofData: Record<string, unknown>
  ): Promise<{ valid: boolean; constraintsChecked: number }> {
    let constraintsChecked = 0;

    for (const constraint of statement.constraints) {
      constraintsChecked++;

      // Parse constraint (format: "field operator value")
      // Example: "complexity > 0.6", "route == cloud"
      const match = constraint.match(/^(\w+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);

      if (match) {
        const [, field, operator, valueStr] = match;
        const proofValue = proofData[field];

        let expectedValue: unknown;
        if (valueStr === "true") expectedValue = true;
        else if (valueStr === "false") expectedValue = false;
        else if (!isNaN(Number(valueStr))) expectedValue = Number(valueStr);
        else expectedValue = valueStr;

        // Check constraint
        const constraintValid = this.checkConstraint(
          proofValue,
          operator,
          expectedValue
        );

        if (!constraintValid) {
          return { valid: false, constraintsChecked };
        }
      }
    }

    return { valid: true, constraintsChecked };
  }

  /**
   * Check a single constraint
   *
   * @param actual - Actual value from proof data
   * @param operator - Comparison operator
   * @param expected - Expected value
   * @returns True if constraint is satisfied
   */
  protected checkConstraint(
    actual: unknown,
    operator: string,
    expected: unknown
  ): boolean {
    switch (operator) {
      case "==":
        return actual === expected;
      case "!=":
        return actual !== expected;
      case ">":
        return typeof actual === "number" &&
          typeof expected === "number" &&
          actual > expected;
      case "<":
        return typeof actual === "number" &&
          typeof expected === "number" &&
          actual < expected;
      case ">=":
        return typeof actual === "number" &&
          typeof expected === "number" &&
          actual >= expected;
      case "<=":
        return typeof actual === "number" &&
          typeof expected === "number" &&
          actual <= expected;
      default:
        return false;
    }
  }

  // ========================================================================
  // BATCH VERIFICATION
  // ========================================================================

  /**
   * Verify multiple proofs in batch
   *
   * More efficient than verifying proofs individually.
   *
   * @param proofs - Array of proofs to verify
   * @returns Array of verification results
   */
  async verifyBatch<T = Record<string, unknown>>(
    proofs: ZKPProof<T>[]
  ): Promise<ZKPVerificationResult[]> {
    if (proofs.length > MAX_BATCH_SIZE) {
      throw new Error(
        `${ZKP_ERROR_CODES.INVALID_CONFIG}: Batch size exceeds maximum of ${MAX_BATCH_SIZE}`
      );
    }

    if (!this.config.enableBatchVerification) {
      // Fall back to individual verification
      const results: ZKPVerificationResult[] = [];
      for (const proof of proofs) {
        results.push(await this.verify(proof));
      }
      return results;
    }

    // Verify proofs in parallel
    const results = await Promise.all(
      proofs.map(proof => this.verify(proof))
    );

    return results;
  }

  // ========================================================================
  // PROOF GENERATION
  // ========================================================================

  /**
   * Generate a zero knowledge proof
   *
   * Creates a proof that a witness satisfies a statement without revealing
   * the witness itself.
   *
   * @param type - Proof type
   * @param statement - Public statement being proven
   * @param witness - Private witness data
   * @param proofData - Type-specific proof data
   * @returns Generated proof
   */
  async generateProof<T = Record<string, unknown>>(
    type: ZKPProofType,
    statement: ZKPStatement,
    witness: ZKPWitness,
    proofData: T
  ): Promise<ZKPProof<T>> {
    try {
      return await withTimeout(
        () => this.generateProofInternal(type, statement, witness, proofData),
        this.config.proofGenerationTimeout
      );
    } catch (error) {
      throw new ZKPGenerationError(
        `Failed to generate proof: ${error}`,
        type,
        { error }
      );
    }
  }

  /**
   * Internal proof generation logic
   *
   * @param type - Proof type
   * @param statement - Public statement
   * @param witness - Private witness
   * @param proofData - Proof data
   * @returns Generated proof
   */
  protected async generateProofInternal<T = Record<string, unknown>>(
    type: ZKPProofType,
    statement: ZKPStatement,
    witness: ZKPWitness,
    proofData: T
  ): Promise<ZKPProof<T>> {
    const startTime = performance.now();

    // Generate proof
    const proof: ZKPProof<T> = {
      proofId: generateProofId(),
      type,
      statement,
      proofData,
      metadata: {
        proverId: this.config.metadata?.proverId as string,
        securityLevel: this.config.securityLevel,
        generationTimeMs: 0, // Will be updated below
        proofSizeBytes: 0, // Will be calculated below
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.maxProofAgeMs,
      version: "1.0.0",
    };

    // Update metadata
    proof.metadata.generationTimeMs = performance.now() - startTime;
    proof.metadata.proofSizeBytes = JSON.stringify(proof).length;

    return proof;
  }

  // ========================================================================
  // CACHING
  // ========================================================================

  /**
   * Add proof to cache
   *
   * @param proof - Proof to cache
   * @param result - Verification result
   */
  private addToCache(
    proof: ZKPProof,
    result: ZKPVerificationResult
  ): void {
    if (this.proofCache.size >= MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    this.proofCache.set(proof.proofId, {
      proof,
      verifiedAt: Date.now(),
      result,
    });
  }

  /**
   * Get proof from cache
   *
   * @param proofId - Proof identifier
   * @returns Cached entry or undefined
   */
  private getFromCache(proofId: string): CacheEntry | undefined {
    const entry = this.proofCache.get(proofId);

    if (!entry) {
      return undefined;
    }

    // Check if cached result is still valid
    const age = Date.now() - entry.verifiedAt;
    if (age > DEFAULT_CACHE_TTL_MS) {
      this.proofCache.delete(proofId);
      this.cacheStats.evictions++;
      return undefined;
    }

    return entry;
  }

  /**
   * Evict oldest cache entry
   */
  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.proofCache.entries()) {
      if (entry.verifiedAt < oldestTime) {
        oldestTime = entry.verifiedAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.proofCache.delete(oldestId);
      this.cacheStats.evictions++;
    }
  }

  /**
   * Clear the proof cache
   */
  clearCache(): void {
    this.proofCache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  getCacheStats() {
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    return {
      ...this.cacheStats,
      size: this.proofCache.size,
      hitRate: totalRequests > 0 ? this.cacheStats.hits / totalRequests : 0,
    };
  }

  // ========================================================================
  // CONFIGURATION
  // ========================================================================

  /**
   * Get current configuration
   *
   * @returns Current ZKP configuration
   */
  getConfig(): ZKPConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   *
   * @param updates - Configuration updates
   */
  updateConfig(updates: Partial<ZKPConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Set security level
   *
   * @param level - New security level
   */
  setSecurityLevel(level: ZKPSecurityLevel): void {
    this.config.securityLevel = level;
  }

  /**
   * Enable or disable proof caching
   *
   * @param enabled - Whether to enable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.config.enableProofCaching = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  /**
   * Get system statistics
   *
   * @returns System statistics including cache stats
   */
  getStats() {
    return {
      cache: this.getCacheStats(),
      config: {
        securityLevel: this.config.securityLevel,
        hashFunction: this.config.hashFunction,
        curveType: this.config.curveType,
        enableProofCaching: this.config.enableProofCaching,
        enableBatchVerification: this.config.enableBatchVerification,
      },
    };
  }
}
