/**
 * @fileoverview Constants for Zero Knowledge Proof system
 *
 * Defines default values, limits, and configuration constants used
 * across the ZKP implementation.
 */

// ============================================================================
// VERSION CONSTANTS
// ============================================================================

/**
 * Current ZKP proof format version
 *
 * Format: MAJOR.MINOR.PATCH
 * - MAJOR: Incompatible changes
 * - MINOR: Backwards-compatible additions
 * - PATCH: Backwards-compatible bug fixes
 */
export const PROOF_VERSION = "1.0.0";

/**
 * Supported proof versions for verification
 */
export const SUPPORTED_PROOF_VERSIONS = ["1.0.0"];

// ============================================================================
// SECURITY CONSTANTS
// ============================================================================

/**
 * Default security level
 *
 * HIGH (128-bit) provides a good balance of security and performance.
 */
export const DEFAULT_SECURITY_LEVEL: import("./types.js").ZKPSecurityLevel = "HIGH";

/**
 * Security level to bit length mapping
 *
 * Defines the cryptographic security strength for each level.
 */
export const SECURITY_LEVEL_BITS: Record<
  import("./types.js").ZKPSecurityLevel,
  number
> = {
  LOW: 80,
  MEDIUM: 112,
  HIGH: 128,
  VERY_HIGH: 256,
};

/**
 * Maximum acceptable proof age
 *
 * Proofs older than this are considered stale and rejected.
 * Default: 1 hour
 */
export const MAX_PROOF_AGE_MS = 60 * 60 * 1000;

/**
 * Default challenge length in bytes
 *
 * Challenges are random values used in interactive proofs.
 * 32 bytes = 256 bits of entropy.
 */
export const DEFAULT_CHALLENGE_LENGTH = 32;

// ============================================================================
// HASH FUNCTION CONSTANTS
// ============================================================================

/**
 * Default hash function
 *
 * SHA-256 provides 128-bit collision resistance and is widely supported.
 */
export const DEFAULT_HASH_FUNCTION: import("./types.js").HashFunctionType =
  "SHA256";

/**
 * Hash function output lengths in bytes
 */
export const HASH_OUTPUT_LENGTHS: Record<
  import("./types.js").HashFunctionType,
  number
> = {
  SHA256: 32,
  SHA384: 48,
  SHA512: 64,
  BLAKE2B: 64,
  BLAKE3: 32,
};

// ============================================================================
// CURVE TYPE CONSTANTS
// ============================================================================

/**
 * Supported elliptic curve types
 *
 * Different curves offer different trade-offs between security and performance.
 */
export const SUPPORTED_CURVE_TYPES = [
  "SECP256K1",
  "ED25519",
  "BN254",
  "BLS12_381",
] as const;

/**
 * Default curve type
 *
 * BN254 is commonly used for ZKP SNARKs and provides good performance.
 */
export const DEFAULT_CURVE_TYPE: (typeof SUPPORTED_CURVE_TYPES)[number] =
  "BN254";

/**
 * Curve security levels
 *
 * Maps each curve to its approximate security level in bits.
 */
export const CURVE_SECURITY_BITS: Record<
  (typeof SUPPORTED_CURVE_TYPES)[number],
  number
> = {
  SECP256K1: 128,
  ED25519: 128,
  BN254: 128,
  BLS12_381: 128,
};

// ============================================================================
// PROOF GENERATION CONSTANTS
// ============================================================================

/**
 * Default proof generation timeout in milliseconds
 *
 * Prevents proof generation from running indefinitely.
 */
export const DEFAULT_PROOF_GENERATION_TIMEOUT = 30000; // 30 seconds

/**
 * Default proof verification timeout in milliseconds
 *
 * Prevents proof verification from running indefinitely.
 */
export const DEFAULT_PROOF_VERIFICATION_TIMEOUT = 5000; // 5 seconds

/**
 * Maximum proof size in bytes
 *
 * Prevents acceptance of absurdly large proofs.
 */
export const MAX_PROOF_SIZE_BYTES = 1024 * 1024; // 1 MB

// ============================================================================
// BATCH VERIFICATION CONSTANTS
// ============================================================================

/**
 * Maximum batch size for batch verification
 *
 * Limits how many proofs can be verified in a single batch.
 */
export const MAX_BATCH_SIZE = 1000;

/**
 * Default batch size for batch verification
 */
export const DEFAULT_BATCH_SIZE = 100;

// ============================================================================
// CACHING CONSTANTS
// ============================================================================

/**
 * Default proof cache TTL in milliseconds
 *
 * How long to cache verified proofs before re-verification.
 */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Maximum cache size (number of proofs)
 */
export const MAX_CACHE_SIZE = 10000;

// ============================================================================
// CIRCUIT CONSTRAINT CONSTANTS
// ============================================================================

/**
 * Maximum number of constraints in a circuit
 *
 * Prevents excessively complex circuits that could cause DoS.
 */
export const MAX_CIRCUIT_CONSTRAINTS = 1000000;

/**
 * Maximum number of wires in a circuit
 */
export const MAX_CIRCUIT_WIRES = 10000000;

/**
 * Maximum wire value (for field elements)
 *
 * Used to prevent overflow attacks.
 */
export const MAX_WIRE_VALUE = BigInt(
  "0x8000000000000000000000000000000000000000000000000000000000000000"
);

// ============================================================================
// COMMITMENT CONSTANTS
// ============================================================================

/**
 * Default commitment randomness length in bytes
 */
export const DEFAULT_COMMITMENT_RANDOMNESS_LENGTH = 32;

/**
 * Commitment format version
 */
export const COMMITMENT_VERSION = "1.0";

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * ZKP error codes
 */
export const ZKP_ERROR_CODES = {
  // Generation errors
  INVALID_PROOF_TYPE: "ZKP_INVALID_PROOF_TYPE",
  WITNESS_MISSING: "ZKP_WITNESS_MISSING",
  CONSTRAINT_VIOLATION: "ZKP_CONSTRAINT_VIOLATION",
  GENERATION_TIMEOUT: "ZKP_GENERATION_TIMEOUT",
  CIRCUIT_INVALID: "ZKP_CIRCUIT_INVALID",

  // Verification errors
  PROOF_EXPIRED: "ZKP_PROOF_EXPIRED",
  PROOF_INVALID: "ZKP_PROOF_INVALID",
  SIGNATURE_INVALID: "ZKP_SIGNATURE_INVALID",
  COMMITMENT_INVALID: "ZKP_COMMITMENT_INVALID",
  CHALLENGE_INVALID: "ZKP_CHALLENGE_INVALID",
  VERIFICATION_TIMEOUT: "ZKP_VERIFICATION_TIMEOUT",

  // General errors
  UNSUPPORTED_VERSION: "ZKP_UNSUPPORTED_VERSION",
  UNSUPPORTED_SECURITY_LEVEL: "ZKP_UNSUPPORTED_SECURITY_LEVEL",
  INVALID_CONFIG: "ZKP_INVALID_CONFIG",
  HASH_ERROR: "ZKP_HASH_ERROR",
  SERIALIZATION_ERROR: "ZKP_SERIALIZATION_ERROR",
} as const;

// ============================================================================
// PROOF TYPE SPECIFIC CONSTANTS
// ============================================================================

/**
 * Routing proof constants
 */
export const ROUTING_PROOF_CONSTANTS = {
  MAX_COMPLEXITY_VALUE: 1.0,
  MIN_COMPLEXITY_VALUE: 0.0,
  MAX_CONFIDENCE_VALUE: 1.0,
  MIN_CONFIDENCE_VALUE: 0.0,
  VALID_ROUTES: ["local", "cloud", "hybrid"] as const,
} as const;

/**
 * Range proof constants
 */
export const RANGE_PROOF_CONSTANTS = {
  MAX_RANGE_SIZE: 2 ** 32,
  MIN_RANGE_VALUE: Number.MIN_SAFE_INTEGER,
  MAX_RANGE_VALUE: Number.MAX_SAFE_INTEGER,
} as const;

/**
 * Set membership proof constants
 */
export const SET_MEMBERSHIP_PROOF_CONSTANTS = {
  MAX_SET_SIZE: 10000,
  MIN_SET_SIZE: 1,
} as const;

/**
 * Disjunction proof constants
 */
export const DISJUNCTION_PROOF_CONSTANTS = {
  MAX_STATEMENTS: 100,
  MIN_STATEMENTS: 2,
} as const;

/**
 * Proof aggregation constants
 */
export const AGGREGATION_CONSTANTS = {
  MIN_BATCH_SIZE: 2,
  MAX_BATCH_SIZE: 10000,
} as const;

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default ZKP configuration
 */
export const DEFAULT_ZKP_CONFIG = {
  securityLevel: DEFAULT_SECURITY_LEVEL,
  hashFunction: DEFAULT_HASH_FUNCTION,
  curveType: DEFAULT_CURVE_TYPE,
  proofGenerationTimeout: DEFAULT_PROOF_GENERATION_TIMEOUT,
  proofVerificationTimeout: DEFAULT_PROOF_VERIFICATION_TIMEOUT,
  cacheTTL: DEFAULT_CACHE_TTL_MS,
  maxCacheSize: MAX_CACHE_SIZE,
  maxBatchSize: MAX_BATCH_SIZE,
  maxProofSize: MAX_PROOF_SIZE_BYTES,
} as const;
