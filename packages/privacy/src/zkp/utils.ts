/**
 * @fileoverview Utility functions for Zero Knowledge Proof system
 *
 * Provides cryptographic utilities, serialization helpers, and common
 * operations used across the ZKP implementation.
 */

import type {
  ZKPConfig,
  ZKPProof,
  Commitment,
  HashFunction,
  HashInput,
  HashOutput,
  BrandedId,
} from "./types.js";
import {
  DEFAULT_HASH_FUNCTION,
  DEFAULT_CHALLENGE_LENGTH,
  DEFAULT_COMMITMENT_RANDOMNESS_LENGTH,
  HASH_OUTPUT_LENGTHS,
  ZKP_ERROR_CODES,
} from "./constants.js";

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default ZKP configuration
 */
export const DEFAULT_ZKP_CONFIG: ZKPConfig = {
  securityLevel: "HIGH",
  hashFunction: DEFAULT_HASH_FUNCTION,
  maxProofAgeMs: 60 * 60 * 1000, // 1 hour
  enableProofCaching: true,
  curveType: "BN254",
  challengeLength: DEFAULT_CHALLENGE_LENGTH,
  enableBatchVerification: true,
  proofGenerationTimeout: 30000, // 30 seconds
  proofVerificationTimeout: 5000, // 5 seconds
};

// ============================================================================
// HASH FUNCTIONS
// ============================================================================

/**
 * Hash input data using specified algorithm
 *
 * @param input - Data to hash
 * @param algorithm - Hash algorithm to use
 * @returns Hash output as hex and bytes
 */
export async function hashToField(
  input: HashInput,
  algorithm: string = DEFAULT_HASH_FUNCTION
): Promise<HashOutput> {
  try {
    // Convert input to ArrayBuffer
    let buffer: ArrayBuffer;
    if (typeof input === "string") {
      buffer = new TextEncoder().encode(input).buffer;
    } else if (input instanceof Uint8Array) {
      buffer = input.buffer as ArrayBuffer;
    } else {
      buffer = input as ArrayBuffer;
    }

    // Use SubtleCrypto for hashing
    const subtle = crypto.subtle;

    // Map algorithm names to SubtleCrypto format
    const algorithmMap: Record<string, string> = {
      "SHA256": "SHA-256",
      "SHA384": "SHA-384",
      "SHA512": "SHA-512",
      "BLAKE2B": "SHA-256", // Fallback to SHA-256 if BLAKE2B not available
      "BLAKE3": "SHA-256", // Fallback to SHA-256 if BLAKE3 not available
    };

    const subtleAlgorithm = algorithmMap[algorithm.toUpperCase()] || algorithm;

    const hashBuffer = await subtle.digest(
      subtleAlgorithm as AlgorithmIdentifier,
      buffer
    );

    const hashBytes = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashBytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      hex: hashHex,
      bytes: hashBytes,
      algorithm: algorithm.toUpperCase().replace("-", "_") as any,
    };
  } catch (error) {
    throw new Error(
      `${ZKP_ERROR_CODES.HASH_ERROR}: Failed to hash input: ${error}`
    );
  }
}

/**
 * Generate random challenge value
 *
 * @param length - Challenge length in bytes
 * @returns Random challenge as hex string
 */
export function generateChallenge(length: number = DEFAULT_CHALLENGE_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// COMMITMENT SCHEME
// ============================================================================

/**
 * Compute cryptographic commitment to a value
 *
 * Uses a simple hash-based commitment scheme: commitment = H(value || randomness)
 *
 * @param value - Value to commit to
 * @param randomness - Optional randomness (generated if not provided)
 * @param hashFn - Hash function to use
 * @returns Commitment containing hash and randomness
 */
export async function computeCommitment(
  value: unknown,
  randomness?: string,
  hashFn: string = DEFAULT_HASH_FUNCTION
): Promise<Commitment> {
  // Generate randomness if not provided
  if (!randomness) {
    const bytes = new Uint8Array(DEFAULT_COMMITMENT_RANDOMNESS_LENGTH);
    crypto.getRandomValues(bytes);
    randomness = Array.from(bytes)
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Serialize value (handle undefined and circular references)
  let valueStr: string;
  try {
    valueStr = JSON.stringify(value) || String(value);
  } catch (e) {
    // Handle circular references or non-serializable values
    valueStr = String(value);
  }
  const combined = `${valueStr}|${randomness}`;

  // Hash the combination
  const hash = await hashToField(combined, hashFn);

  return {
    value: hash.hex,
    commitmentId: `commit_${Date.now()}_${generateChallenge(8)}`,
    timestamp: Date.now(),
    randomness,
    metadata: {
      hashAlgorithm: hashFn,
      valueLength: valueStr.length,
    },
  };
}

/**
 * Verify a commitment
 *
 * @param commitment - Commitment to verify
 * @param opening - Opening containing value and randomness
 * @param hashFn - Hash function used
 * @returns True if commitment is valid
 */
export async function verifyCommitment(
  commitment: Commitment,
  opening: { value: unknown; randomness: string },
  hashFn: string = DEFAULT_HASH_FUNCTION
): Promise<boolean> {
  const recomputed = await computeCommitment(
    opening.value,
    opening.randomness,
    hashFn
  );
  return recomputed.value === commitment.value;
}

// ============================================================================
// PROOF SERIALIZATION
// ============================================================================

/**
 * Serialize a ZKP proof to JSON string
 *
 * @param proof - Proof to serialize
 * @returns JSON string representation
 */
export function serializeProof<T = Record<string, unknown>>(
  proof: ZKPProof<T>
): string {
  try {
    return JSON.stringify(proof, (key, value) => {
      // Handle BigInt serialization
      if (typeof value === "bigint") {
        return { __bigint__: value.toString() };
      }
      // Handle Set/Map serialization
      if (value instanceof Set) {
        return { __set__: Array.from(value) };
      }
      if (value instanceof Map) {
        return { __map__: Array.from(value.entries()) };
      }
      return value;
    });
  } catch (error) {
    throw new Error(
      `${ZKP_ERROR_CODES.SERIALIZATION_ERROR}: Failed to serialize proof: ${error}`
    );
  }
}

/**
 * Deserialize a ZKP proof from JSON string
 *
 * @param json - JSON string to deserialize
 * @returns Deserialized proof
 */
export function deserializeProof<T = Record<string, unknown>>(
  json: string
): ZKPProof<T> {
  try {
    return JSON.parse(json, (key, value) => {
      // Handle BigInt deserialization
      if (value && typeof value === "object" && "__bigint__" in value) {
        return BigInt(value.__bigint__);
      }
      // Handle Set deserialization
      if (value && typeof value === "object" && "__set__" in value) {
        return new Set(value.__set__);
      }
      // Handle Map deserialization
      if (value && typeof value === "object" && "__map__" in value) {
        return new Map(value.__map__);
      }
      return value;
    });
  } catch (error) {
    throw new Error(
      `${ZKP_ERROR_CODES.SERIALIZATION_ERROR}: Failed to deserialize proof: ${error}`
    );
  }
}

/**
 * Convert proof to JSON with additional metadata
 *
 * @param proof - Proof to convert
 * @returns JSON object with proof and metadata
 */
export function proofToJson<T = Record<string, unknown>>(
  proof: ZKPProof<T>
): Record<string, unknown> {
  return {
    proof: JSON.parse(serializeProof(proof)),
    serialized: serializeProof(proof),
    size: serializeProof(proof).length,
    encoding: "utf-8",
    format: "json",
  };
}

/**
 * Create proof from JSON
 *
 * @param json - JSON object containing proof
 * @returns Deserialized proof
 */
export function proofFromJson<T = Record<string, unknown>>(
  json: Record<string, unknown>
): ZKPProof<T> {
  if ("proof" in json && typeof json.proof === "string") {
    return deserializeProof<T>(json.proof);
  }
  if ("proof" in json && typeof json.proof === "object") {
    return json.proof as ZKPProof<T>;
  }
  throw new Error(
    `${ZKP_ERROR_CODES.SERIALIZATION_ERROR}: Invalid JSON format for proof`
  );
}

// ============================================================================
// PROOF IDENTIFIERS
// ============================================================================

/**
 * Generate unique proof identifier
 *
 * Format: zkp_<timestamp>_<random>
 *
 * @returns Unique proof ID
 */
export function generateProofId(): BrandedId<"ZKPProof"> {
  const timestamp = Date.now().toString(36);
  const random = generateChallenge(8);
  return `zkp_${timestamp}_${random}` as BrandedId<"ZKPProof">;
}

/**
 * Generate unique statement identifier
 *
 * @param type - Statement type
 * @returns Unique statement ID
 */
export function generateStatementId(type: string): string {
  const timestamp = Date.now().toString(36);
  const random = generateChallenge(8);
  return `stmt_${type}_${timestamp}_${random}`;
}

/**
 * Generate unique witness identifier
 *
 * @returns Unique witness ID
 */
export function generateWitnessId(): string {
  const timestamp = Date.now().toString(36);
  const random = generateChallenge(8);
  return `witness_${timestamp}_${random}`;
}

/**
 * Generate unique verification identifier
 *
 * @returns Unique verification ID
 */
export function generateVerificationId(): string {
  const timestamp = Date.now().toString(36);
  const random = generateChallenge(8);
  return `verif_${timestamp}_${random}`;
}

// ============================================================================
// PROOF VALIDATION
// ============================================================================

/**
 * Validate proof format
 *
 * Checks if a proof object has all required fields.
 *
 * @param proof - Proof to validate
 * @returns True if format is valid
 */
export function validateProofFormat<T = Record<string, unknown>>(
  proof: unknown
): proof is ZKPProof<T> {
  if (typeof proof !== "object" || proof === null) {
    return false;
  }

  const p = proof as Record<string, unknown>;

  return (
    typeof p.proofId === "string" &&
    typeof p.type === "string" &&
    typeof p.createdAt === "number" &&
    typeof p.expiresAt === "number" &&
    typeof p.version === "string" &&
    typeof p.statement === "object" &&
    p.statement !== null &&
    typeof p.proofData === "object" &&
    p.proofData !== null
  );
}

/**
 * Check if a proof is still fresh (not expired)
 *
 * @param proof - Proof to check
 * @param maxAge - Maximum age in milliseconds
 * @returns True if proof is fresh
 */
export function checkProofFreshness<T = Record<string, unknown>>(
  proof: ZKPProof<T>,
  maxAge?: number
): boolean {
  const now = Date.now();
  const age = now - proof.createdAt;
  const maxAgeMs = maxAge || proof.metadata.custom?.maxAgeMs as number || (60 * 60 * 1000);

  if (age > maxAgeMs) {
    return false;
  }

  if (proof.expiresAt && now > proof.expiresAt) {
    return false;
  }

  return true;
}

/**
 * Calculate proof age in milliseconds
 *
 * @param proof - Proof to check
 * @returns Age in milliseconds
 */
export function getProofAge<T = Record<string, unknown>>(
  proof: ZKPProof<T>
): number {
  return Date.now() - proof.createdAt;
}

/**
 * Calculate proof size in bytes
 *
 * @param proof - Proof to measure
 * @returns Size in bytes
 */
export function getProofSize<T = Record<string, unknown>>(
  proof: ZKPProof<T>
): number {
  return serializeProof(proof).length;
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Convert value to field element (bigint)
 *
 * Ensures value is within valid range for field operations.
 *
 * @param value - Value to convert
 * @param modulus - Field modulus
 * @returns Field element as bigint
 */
export function toFieldElement(value: unknown, modulus: bigint): bigint {
  let num: bigint;
  if (typeof value === "bigint") {
    num = value;
  } else if (typeof value === "number") {
    num = BigInt(value);
  } else if (typeof value === "string") {
    num = BigInt(value);
  } else {
    throw new Error(`Cannot convert value to field element: ${typeof value}`);
  }

  // Ensure value is within field
  return ((num % modulus) + modulus) % modulus;
}

/**
 * Modular exponentiation
 *
 * Computes (base^exp) mod modulus efficiently.
 *
 * @param base - Base value
 * @param exp - Exponent
 * @param modulus - Modulus
 * @returns Result of modular exponentiation
 */
export function modExp(base: bigint, exp: bigint, modulus: bigint): bigint {
  let result = BigInt(1);
  base = base % modulus;

  while (exp > 0) {
    if (exp % BigInt(2) === BigInt(1)) {
      result = (result * base) % modulus;
    }
    exp = exp >> BigInt(1);
    base = (base * base) % modulus;
  }

  return result;
}

/**
 * Compute modular inverse
 *
 * Finds x such that (a * x) mod m = 1
 *
 * @param a - Value to invert
 * @param m - Modulus
 * @returns Modular inverse
 */
export function modInverse(a: bigint, m: bigint): bigint {
  const [gcd, x] = extendedGCD(a, m);
  if (gcd !== BigInt(1)) {
    throw new Error("Modular inverse does not exist");
  }
  return ((x % m) + m) % m;
}

/**
 * Extended GCD algorithm
 *
 * Returns (gcd, x, y) such that a*x + b*y = gcd(a,b)
 *
 * @param a - First number
 * @param b - Second number
 * @returns Tuple of (gcd, x, y)
 */
export function extendedGCD(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (a === BigInt(0)) {
    return [b, BigInt(0), BigInt(1)];
  }

  const [gcd, x1, y1] = extendedGCD(b % a, a);
  const x = y1 - (b / a) * x1;
  const y = x1;

  return [gcd, x, y];
}

// ============================================================================
// BUFFER UTILITIES
// ============================================================================

/**
 * Convert hex string to bytes
 *
 * @param hex - Hex string
 * @returns Uint8Array of bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert bytes to hex string
 *
 * @param bytes - Uint8Array of bytes
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Concatenate byte arrays
 *
 * @param arrays - Arrays to concatenate
 * @returns Concatenated array
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================================
// TIMING UTILITIES
// ============================================================================

/**
 * Measure execution time of an async function
 *
 * @param fn - Function to measure
 * @returns Result and duration in milliseconds
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

/**
 * Create a timeout promise
 *
 * @param ms - Timeout in milliseconds
 * @returns Promise that rejects after timeout
 */
export function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Operation timed out")), ms);
  });
}

/**
 * Run function with timeout
 *
 * @param fn - Function to run
 * @param timeoutMs - Timeout in milliseconds
 * @returns Function result or timeout error
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([fn(), createTimeout(timeoutMs)]);
}
