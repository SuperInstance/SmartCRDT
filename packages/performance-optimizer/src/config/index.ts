/**
 * Performance Configuration Management
 *
 * Centralized configuration for performance optimization suite:
 * - Default configurations for different environments
 * - Configuration validation
 * - Environment variable support
 * - Dynamic configuration updates
 */

import type { PerformanceConfig } from "../types/index.js";

/**
 * Create default performance configuration
 */
export function createDefaultConfig(): PerformanceConfig {
  return {
    enableCpuProfiling: true,
    enableMemoryProfiling: true,
    memoryHistoryWindow: 60, // minutes
    cpuSpikeThreshold: 90, // percentage
    memoryLeakThreshold: 1, // MB per minute
    bottleneckSensitivity: 5, // 1-10 scale
    suggestionPriorityThreshold: 3, // 1-10 scale
    maxSuggestions: 10,
    benchmarks: {
      warmupRuns: 3,
      measurementRuns: 10,
      timeout: 5000 // milliseconds
    },
    targets: {
      latencyTarget: 100, // milliseconds
      memoryTarget: 600, // MB
      cpuTarget: 80, // percentage
      errorRateTarget: 1 // percentage
    }
  };
}

/**
 * Create production configuration
 */
export function createProductionConfig(): PerformanceConfig {
  return {
    ...createDefaultConfig(),
    enableCpuProfiling: false, // CPU profiling can impact production
    enableMemoryProfiling: true, // Memory profiling is safe
    memoryHistoryWindow: 120, // Longer history for production
    bottleneckSensitivity: 7, // Higher sensitivity for production
    suggestionPriorityThreshold: 5, // Higher threshold for production
    maxSuggestions: 5, // Fewer suggestions in production
    benchmarks: {
      warmupRuns: 5,
      measurementRuns: 20,
      timeout: 10000
    },
    targets: {
      latencyTarget: 50, // Stricter latency in production
      memoryTarget: 500, // Lower memory limit in production
      cpuTarget: 70, // Lower CPU limit in production
      errorRateTarget: 0.1 // Stricter error rate in production
    }
  };
}

/**
 * Create development configuration
 */
export function createDevelopmentConfig(): PerformanceConfig {
  return {
    ...createDefaultConfig(),
    enableCpuProfiling: true,
    enableMemoryProfiling: true,
    memoryHistoryWindow: 30, // Shorter history for development
    bottleneckSensitivity: 3, // Lower sensitivity for development
    suggestionPriorityThreshold: 1, // Lower threshold for development
    maxSuggestions: 20, // More suggestions in development
    benchmarks: {
      warmupRuns: 2,
      measurementRuns: 5,
      timeout: 2000
    },
    targets: {
      latencyTarget: 200, // More relaxed in development
      memoryTarget: 1000, // Higher memory limit in development
      cpuTarget: 90, // Higher CPU limit in development
      errorRateTarget: 5 // More relaxed error rate in development
    }
  };
}

/**
 * Create test configuration
 */
export function createTestConfig(): PerformanceConfig {
  return {
    ...createDefaultConfig(),
    enableCpuProfiling: true,
    enableMemoryProfiling: true,
    memoryHistoryWindow: 5, // Very short history for tests
    bottleneckSensitivity: 1, // Very low sensitivity for tests
    suggestionPriorityThreshold: 1,
    maxSuggestions: 10,
    benchmarks: {
      warmupRuns: 1,
      measurementRuns: 3,
      timeout: 1000
    },
    targets: {
      latencyTarget: 1000, // Very relaxed for tests
      memoryTarget: 2000, // Very high limit for tests
      cpuTarget: 95, // Very high limit for tests
      errorRateTarget: 10 // Very relaxed for tests
    }
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Partial<PerformanceConfig> {
  const config: Partial<PerformanceConfig> = {};

  // CPU profiling
  if (process.env.PERF_CPU_PROFILING !== undefined) {
    config.enableCpuProfiling = process.env.PERF_CPU_PROFILING === 'true';
  }

  // Memory profiling
  if (process.env.PERF_MEMORY_PROFILING !== undefined) {
    config.enableMemoryProfiling = process.env.PERF_MEMORY_PROFILING === 'true';
  }

  // Memory history window
  if (process.env.PERF_MEMORY_HISTORY_WINDOW !== undefined) {
    config.memoryHistoryWindow = parseInt(process.env.PERF_MEMORY_HISTORY_WINDOW, 10);
  }

  // CPU spike threshold
  if (process.env.PERF_CPU_SPIKE_THRESHOLD !== undefined) {
    config.cpuSpikeThreshold = parseInt(process.env.PERF_CPU_SPIKE_THRESHOLD, 10);
  }

  // Memory leak threshold
  if (process.env.PERF_MEMORY_LEAK_THRESHOLD !== undefined) {
    config.memoryLeakThreshold = parseFloat(process.env.PERF_MEMORY_LEAK_THRESHOLD);
  }

  // Bottleneck sensitivity
  if (process.env.PERF_BOTTLENECK_SENSITIVITY !== undefined) {
    config.benchmarkSensitivity = parseInt(process.env.PERF_BOTTLENECK_SENSITIVITY, 10);
  }

  // Suggestion priority threshold
  if (process.env.PERF_SUGGESTION_PRIORITY_THRESHOLD !== undefined) {
    config.suggestionPriorityThreshold = parseInt(process.env.PERF_SUGGESTION_PRIORITY_THRESHOLD, 10);
  }

  // Max suggestions
  if (process.env.PERF_MAX_SUGGESTIONS !== undefined) {
    config.maxSuggestions = parseInt(process.env.PERF_MAX_SUGGESTIONS, 10);
  }

  // Benchmarks
  if (process.env.PERF_BENCHMARK_WARMUP_RUNS !== undefined) {
    config.benchmarks = {
      ...config.benchmarks,
      warmupRuns: parseInt(process.env.PERF_BENCHMARK_WARMUP_RUNS, 10)
    };
  }

  if (process.env.PERF_BENCHMARK_MEASUREMENT_RUNS !== undefined) {
    config.benchmarks = {
      ...config.benchmarks,
      measurementRuns: parseInt(process.env.PERF_BENCHMARK_MEASUREMENT_RUNS, 10)
    };
  }

  if (process.env.PERF_BENCHMARK_TIMEOUT !== undefined) {
    config.benchmarks = {
      ...config.benchmarks,
      timeout: parseInt(process.env.PERF_BENCHMARK_TIMEOUT, 10)
    };
  }

  // Targets
  if (process.env.PERF_LATENCY_TARGET !== undefined) {
    config.targets = {
      ...config.targets,
      latencyTarget: parseInt(process.env.PERF_LATENCY_TARGET, 10)
    };
  }

  if (process.env.PERF_MEMORY_TARGET !== undefined) {
    config.targets = {
      ...config.targets,
      memoryTarget: parseInt(process.env.PERF_MEMORY_TARGET, 10)
    };
  }

  if (process.env.PERF_CPU_TARGET !== undefined) {
    config.targets = {
      ...config.targets,
      cpuTarget: parseInt(process.env.PERF_CPU_TARGET, 10)
    };
  }

  if (process.env.PERF_ERROR_RATE_TARGET !== undefined) {
    config.targets = {
      ...config.targets,
      errorRateTarget: parseFloat(process.env.PERF_ERROR_RATE_TARGET)
    };
  }

  return config;
}

/**
 * Get environment-appropriate configuration
 */
export function getEnvironmentConfig(): PerformanceConfig {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return createProductionConfig();
    case 'test':
      return createTestConfig();
    case 'development':
    default:
      return createDevelopmentConfig();
  }
}

/**
 * Merge configurations with precedence: default < environment < user-provided < environment variables
 */
export function mergeConfigurations(
  baseConfig?: Partial<PerformanceConfig>,
  envConfig?: Partial<PerformanceConfig>,
  userConfig?: Partial<PerformanceConfig>,
  envConfigOverride?: Partial<PerformanceConfig>
): PerformanceConfig {
  // Start with default
  const config = createDefaultConfig();

  // Apply environment-specific config
  Object.assign(config, envConfig || getEnvironmentConfig());

  // Apply user-provided config (higher precedence)
  Object.assign(config, userConfig);

  // Apply base config (highest precedence before env vars)
  Object.assign(config, baseConfig);

  // Apply environment variables (highest precedence)
  Object.assign(config, loadConfigFromEnv());

  // Validate and normalize values
  return validateConfig(config);
}

/**
 * Validate configuration values
 */
export function validateConfig(config: PerformanceConfig): PerformanceConfig {
  const validated = { ...config };

  // Validate numeric ranges
  validated.memoryHistoryWindow = Math.max(1, Math.min(1440, validated.memoryHistoryWindow)); // 1-1440 minutes
  validated.cpuSpikeThreshold = Math.max(0, Math.min(100, validated.cpuSpikeThreshold)); // 0-100%
  validated.memoryLeakThreshold = Math.max(0, validated.memoryLeakThreshold); // >= 0 MB/min
  validated.benchmarkSensitivity = Math.max(1, Math.min(10, validated.benchmarkSensitivity)); // 1-10
  validated.suggestionPriorityThreshold = Math.max(1, Math.min(10, validated.suggestionPriorityThreshold)); // 1-10
  validated.maxSuggestions = Math.max(1, Math.min(100, validated.maxSuggestions)); // 1-100

  // Validate benchmarks
  validated.benchmarks = {
    warmupRuns: Math.max(0, Math.min(100, validated.benchmarks.warmupRuns)),
    measurementRuns: Math.max(1, Math.min(1000, validated.benchmarks.measurementRuns)),
    timeout: Math.max(100, Math.min(60000, validated.benchmarks.timeout))
  };

  // Validate targets
  validated.targets = {
    latencyTarget: Math.max(0, validated.targets.latencyTarget),
    memoryTarget: Math.max(0, validated.targets.memoryTarget),
    cpuTarget: Math.max(0, Math.min(100, validated.targets.cpuTarget)),
    errorRateTarget: Math.max(0, Math.min(100, validated.targets.errorRateTarget))
  };

  return validated;
}