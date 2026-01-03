/**
 * VL-JEPA Benchmarking Framework
 *
 * Comprehensive benchmarking suite for VL-JEPA (Vision-Language Joint Embedding Predictive Architecture)
 *
 * @packageDocumentation
 */

// Types
export type {
  VLJEPABenchmarkResult,
  BenchmarkConfiguration,
  UIFrameBenchmark,
  UserIntentBenchmark,
  GoalPredictionBenchmark,
  RealtimeBenchmark,
  WebGPUMetrics,
  CachingMetrics,
  VLMComparisonResult,
  BenchmarkSuiteResults,
  PerformanceReport,
} from "./types";

// Main benchmark suite
export { VLJEPABenchmark, VLJEPAEmbeddingCache } from "./VLJEPABenchmark";

// WebGPU benchmarking
export { WebGPUBenchmark, checkWebGPUCompatibility } from "./WebGPUBenchmark";

// Comparison benchmarking
export { ComparisonBenchmark } from "./ComparisonBenchmark";
export type {
  VLMProfile,
  ComparisonBenchmarkConfig,
  ComparisonBenchmarkSummary,
} from "./ComparisonBenchmark";

// Mock adapters for testing
export {
  MockVLJEPAAdapter,
  MockWebGPUVLJEPAAdapter,
  MockCachedVLJEPAAdapter,
} from "./MockVLJEPAAdapter";

// Caching strategies
export {
  VLJEPASmartCache,
  VLJEPTieredCache,
  createDefaultCache,
  createTieredCache,
} from "./CachingStrategy";
export type {
  CacheEntry,
  CacheConfig,
  InvalidationStrategy,
} from "./CachingStrategy";
