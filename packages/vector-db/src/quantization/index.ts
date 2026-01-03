/**
 * @lsi/vector-db/quantization - Product Quantization Module
 *
 * Provides vector compression using Product Quantization (PQ) and
 * Optimized Product Quantization (OPQ) for efficient approximate
 * nearest neighbor search.
 *
 * @packageDocumentation
 */

// Export types
export type {
  ProductQuantizationConfig,
  OPQConfig,
  PQTrainingResult,
  OPQTrainingResult,
  PQEncodedVector,
  PQEncodedBatch,
  PQMetrics,
  OPQMetrics,
  ADCCResult,
  SDCResult,
  NNResult,
  ANNResult,
  PQBenchmarkConfig,
  PQBenchmarkResults,
} from "./types.js";

// Export error classes
export {
  QuantizationError,
  TrainingError,
  EncodingError,
  DecodingError,
  ConfigError,
} from "./types.js";

// Export main classes
export { ProductQuantization } from "./ProductQuantization.js";
export { OptimizedProductQuantization } from "./OptimizedProductQuantization.js";
export { DistanceCalculator } from "./DistanceCalculator.js";

// Export utilities
export { QuantizationBenchmark } from "./benchmark.js";
