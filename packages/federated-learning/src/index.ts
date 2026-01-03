/**
 * @fileoverview Federated Learning Package
 *
 * Provides state-of-the-art federated learning aggregation algorithms:
 * - FedAvg: Weighted averaging by dataset size or quality
 * - FedProx: Proximal term for bounded client drift
 * - Byzantine-resilient: Krum and MultiKrum for adversarial robustness
 * - Secure Aggregation: Privacy-preserving aggregation with secret sharing
 * - Verifiable Aggregation: Cryptographic proofs of correct aggregation
 * - Benchmarking: Compare algorithms under various conditions
 *
 * @package @lsi/federated-learning
 */

// Re-export selection module
export * from './selection.js';

// ============================================================================
// AGGREGATION ALGORITHMS
// ============================================================================

export {
  FedAvgAggregator,
  FedProxAggregator,
  KrumAggregator,
  createAggregator,
} from "./aggregation.js";

// ============================================================================
// TYPES
// ============================================================================

export type {
  ModelUpdate,
  AggregationResult,
  AggregationMetrics,
  FedAvgConfig,
  FedProxConfig,
  ByzantineConfig,
  AggregationMethod,
} from "./aggregation.js";

// ============================================================================
// SECURE AGGREGATION
// ============================================================================

export {
  ShamirSecretSharing,
  SecureAggregator,
  VerifiableAggregator,
  compareAggregationMethods,
  computePrivacyGuarantee,
} from "./secure-aggregation.js";

export type {
  SecretShare,
  EncryptedUpdate,
  AggregationProof,
  SecureAggregationResult,
  SecureAggregationConfig,
  PairwiseMask,
} from "./secure-aggregation.js";

export {
  DEFAULT_SECURE_CONFIG,
} from "./secure-aggregation.js";

// ============================================================================
// BENCHMARKING
// ============================================================================

export {
  AggregationBenchmark,
  SecureAggregationBenchmark,
  runQuickBenchmark,
  runQuickSecureBenchmark,
} from "./benchmark.js";

export type {
  BenchmarkConfig,
  BenchmarkResults,
  AlgorithmResult,
  ComparisonMetrics,
  RobustnessMetrics,
  SecureBenchmarkResults,
  SecureBenchmarkConfig,
} from "./benchmark.js";

export {
  DEFAULT_BENCHMARK_CONFIG,
  DEFAULT_SECURE_BENCHMARK_CONFIG,
} from "./benchmark.js";

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export {
  l2Norm,
  cosineSimilarity,
  manhattanDistance,
  validateUpdates,
  normalizeParameters,
  clipParameters,
} from "./aggregation.js";

// ============================================================================
// DEFAULTS
// ============================================================================

export {
  DEFAULT_FEDAVG_CONFIG,
  DEFAULT_FEDPROX_CONFIG,
  DEFAULT_BYZANTINE_CONFIG,
} from "./aggregation.js";

// Future exports will include:
// export * from './orchestration.js';
