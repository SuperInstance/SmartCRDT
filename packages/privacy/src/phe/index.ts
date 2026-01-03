/**
 * PHE Module - Partially Homomorphic Encryption for Embedding Privacy
 *
 * This module exports all PHE-related classes and utilities.
 */

// Core PHE implementation
export {
  PHE,
  encryptedEuclideanDistance,
  encryptedCosineSimilarity,
  serializePublicKey,
  deserializePublicKey,
  serializePrivateKey,
  deserializePrivateKey,
  serializeEncryptedEmbedding,
  deserializeEncryptedEmbedding,
  DEFAULT_KEY_SIZE,
  DEFAULT_PRECISION,
  MAX_SAFE_VALUE,
} from "../phe";

export type {
  PaillierPublicKey,
  PaillierPrivateKey,
  PaillierKeyPair,
  EncryptedEmbedding,
  PHEConfig,
  PHEStats,
} from "../phe";

// PHE Intent Encoder
export { PHEIntentEncoder } from "./PHEIntentEncoder";

export type {
  PHEIntentEncoderConfig,
  EncryptedIntentVector,
  PHEEncodeResult,
} from "./PHEIntentEncoder";

// PHE Key Manager
export {
  PHEKeyManager,
  InMemoryKeyStorage,
} from "./PHEKeyManager";

export type {
  KeySize,
  KeyFormat,
  KeyMetadata,
  KeyRecord,
  KeyRotationConfig,
  PHEKeyManagerConfig,
  KeyStorageBackend,
  KeyExportResult,
  KeyImportResult,
  KeyManagerStats,
} from "./PHEKeyManager";

// PHE Operations
export { PHEOperations } from "./PHEOperations";

export type {
  OperationResult,
  AggregationResult,
  StatisticsResult,
  ComparisonResult,
  BatchConfig,
} from "./PHEOperations";

// PHE Utils
export {
  PHEUtils,
  PHEPerformanceProfiler,
} from "./PHEUtils";

export type {
  ValidationResult,
  KeyComparisonResult,
  PerformanceMetrics,
  SecurityCheckResult,
  ConversionOptions,
} from "./PHEUtils";
