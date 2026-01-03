/**
 * Protocol Constants for Aequor Cognitive Orchestration Platform
 *
 * Provides version information and type counts for the protocol.
 */

/**
 * Current protocol version
 *
 * Follows semantic versioning (MAJOR.MINOR.PATCH)
 * - MAJOR: Incompatible API changes
 * - MINOR: Backwards-compatible functionality additions
 * - PATCH: Backwards-compatible bug fixes
 */
export const PROTOCOL_VERSION = "1.0.0";

/**
 * Type count statistics
 *
 * Provides counts of exported types for documentation and validation purposes.
 * This is useful for ensuring protocol completeness and tracking API surface.
 */
export const TYPE_COUNT = {
  // Core types
  interfaces: 45,
  typeAliases: 32,
  enums: 15,
  classes: 12,

  // Protocol types
  atpTypes: 8,
  acpTypes: 6,
  constraintTypes: 5,
  cartridgeTypes: 12,
  rollbackTypes: 18,
  hypothesisTypes: 10,
  extensionTypes: 14,
  complianceTypes: 20,

  // Total
  total: 197,
} as const;

/**
 * Protocol metadata
 *
 * Additional metadata about the protocol implementation.
 */
export const PROTOCOL_METADATA = {
  /** Protocol name */
  name: "Aequor Cognitive Orchestration Protocol",

  /** Protocol version */
  version: PROTOCOL_VERSION,

  /** Protocol specification URL */
  specUrl: "https://protocol.aequor.ai/spec/v1",

  /** Protocol repository */
  repository: "https://github.com/aequor/protocol",

  /** License */
  license: "MIT",

  /** ATP protocol version */
  atpVersion: "1.0.0",

  /** ACP protocol version */
  acpVersion: "1.0.0",

  /** Cartridge protocol version */
  cartridgeVersion: "1.0.0",

  /** Rollback protocol version */
  rollbackVersion: "1.0.0",
} as const;

/**
 * Default constraints
 *
 * Default values for common constraint parameters.
 */
export const DEFAULT_CONSTRAINTS = {
  /** Maximum cost per query (USD) */
  maxCost: 0.01,

  /** Maximum latency per query (milliseconds) */
  maxLatency: 2000,

  /** Default privacy level */
  privacy: "standard",

  /** Default quality threshold (0-1) */
  quality: 0.8,

  /** Default timeout (milliseconds) */
  timeout: 30000,

  /** Maximum retries */
  maxRetries: 3,
} as const;

/**
 * Embedding dimensions
 *
 * Standard embedding dimensions used across the platform.
 */
export const EMBEDDING_DIMENSIONS = {
  /** Intent vector dimension */
  intent: 768,

  /** Context vector dimension */
  context: 1536,

  /** Thought vector dimension */
  thought: 768,

  /** Action vector dimension */
  action: 384,
} as const;
