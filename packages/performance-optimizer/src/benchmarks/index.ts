/**
 * Benchmarks - Comprehensive performance testing suite
 */

export { RouterBenchmarks } from './RouterBenchmarks.js';
export { EmbeddingBenchmarks } from './EmbeddingBenchmarks.js';
export { PrivacyBenchmarks } from './PrivacyBenchmarks.js';
export { HardwareBenchmarks } from './HardwareBenchmarks.js';
export { BenchmarkRunner } from './BenchmarkRunner.js';

// Re-export types
export type {
  BenchmarkResult,
  CacheEffectivenessMetrics,
  ComplexityTestResult,
  RouterBenchmarkSuite,
  RouterBenchmarkConfig,
  MockQuery,
} from './RouterBenchmarks.js';
export type {
  EmbeddingBenchmarkResult,
  HNSWCacheMetrics,
  BatchComparisonResult,
  TextComplexityResult,
  EmbeddingBenchmarkSuite,
  EmbeddingBenchmarkConfig,
  TextSample,
  EmbeddingProvider,
} from './EmbeddingBenchmarks.js';
export type {
  EncryptionBenchmarkResult,
  IntentEncodingResult,
  RAPProtocolResult,
  PrivacyClassificationResult,
  DifferentialPrivacyResult,
  PrivacyBenchmarkSuite,
  PrivacyBenchmarkConfig,
} from './PrivacyBenchmarks.js';
export type {
  ComputeBenchmarkResult,
  NUMABenchmarkResult,
  ThermalThrottlingResult,
  MemoryBenchmarkResult,
  HardwareBenchmarkSuite,
  HardwareBenchmarkConfig,
  HardwareDevice,
} from './HardwareBenchmarks.js';
