/**
 * @lsi/performance-tests
 *
 * Benchmark entry point - exports all benchmark suites and utilities.
 */

// Core utilities
export {
  createTracker,
  PerformanceTracker,
  type BenchmarkConfig,
  type BenchmarkStats,
  type BenchmarkResult,
  type MemorySnapshot,
} from "../Runner.js";

export {
  createBaselineTracker,
  BaselineTracker,
  type BaselineConfig,
  type TaskComparison,
  type ComparisonReport,
  type RegressionReport,
} from "../BaselineTracker.js";

// Benchmark suites
export {
  runProtocolBenchmarks,
  runAndExport as runProtocolAndExport,
} from "./ProtocolBenchmarks.js";

export {
  runPrivacyBenchmarks,
  runAndExport as runPrivacyAndExport,
} from "./PrivacyBenchmarks.js";

export {
  runCacheBenchmarks,
  runAndExport as runCacheAndExport,
} from "./CacheBenchmarks.js";

export {
  runTrainingBenchmarks,
  runAndExport as runTrainingAndExport,
} from "./TrainingBenchmarks.js";

export {
  runIntegrationBenchmarks,
  runAndExport as runIntegrationAndExport,
} from "./IntegrationBenchmarks.js";

/**
 * Run all benchmark suites
 */
export async function runAllBenchmarks() {
  const results = [
    await runProtocolBenchmarks(),
    await runPrivacyBenchmarks(),
    await runCacheBenchmarks(),
    await runTrainingBenchmarks(),
    await runIntegrationBenchmarks(),
  ];

  return results;
}

/**
 * Run all benchmarks and generate reports
 */
export async function runAllAndExport() {
  await runProtocolAndExport();
  await runPrivacyAndExport();
  await runCacheAndExport();
  await runTrainingAndExport();
  await runIntegrationAndExport();
}
