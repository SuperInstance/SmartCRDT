/**
 * VL-JEPA Testing Framework
 * Comprehensive load, stress, performance, endurance, and scalability testing.
 */

// Types
export * from "./types.js";

// Load Testing
export { LoadTester } from "./load/LoadTester.js";
export {
  createRampStrategy,
  LinearRampStrategy,
  ExponentialRampStrategy,
  StepRampStrategy,
  CustomRampStrategy,
  type RampStrategy,
  type RampType,
} from "./load/RampStrategy.js";
export {
  SustainedLoad,
  type SustainedLoadConfig,
  type SustainedLoadResult,
} from "./load/SustainedLoad.js";

// Stress Testing
export { StressTester } from "./stress/StressTester.js";
export {
  SpikeTester,
  type SpikeTestConfig,
  type SpikeTestResult,
} from "./stress/SpikeTester.js";
export {
  BreakageTester,
  type BreakageTestConfig,
  type BreakageTestResult,
} from "./stress/BreakageTester.js";

// Endurance Testing
export { EnduranceTester } from "./endurance/EnduranceTester.js";
export {
  MemoryLeakDetector,
  type MemorySnapshot,
  type LeakDetectionConfig,
  type LeakDetectionResult,
} from "./endurance/MemoryLeakDetector.js";
export {
  StabilityTester,
  type StabilityTestConfig,
  type StabilityTestResult,
} from "./endurance/StabilityTester.js";

// Scalability Testing
export { ScaleTester } from "./scalability/ScaleTester.js";
export {
  VerticalScaler,
  type VerticalScaleConfig,
  type VerticalScaleResult,
} from "./scalability/VerticalScaler.js";
export {
  AutoScaler,
  type AutoScaleConfig,
  type AutoScaleResult,
} from "./scalability/AutoScaler.js";

// Scenario Testing
export {
  ScenarioBuilder,
  type ScenarioBuilderOptions,
  type ScenarioExecutor,
  type ScenarioResult,
} from "./scenarios/ScenarioBuilder.js";

// Performance Monitoring
export {
  LatencyProfiler,
  type LatencyProfilerConfig,
  type LatencyReport,
  type LatencySample,
} from "./performance/LatencyProfiler.js";
export {
  ThroughputTester,
  type ThroughputTestConfig,
  type ThroughputTestResult,
} from "./performance/ThroughputTester.js";
export {
  ResourceMonitor,
  type ResourceMonitorConfig,
  type ResourceSnapshot,
  type ResourceReport,
} from "./performance/ResourceMonitor.js";

// Reporting
export {
  SLAReporter,
  type SLAReporterOptions,
  type MetricSample,
} from "./reporters/SLAReporter.js";

// Utils
export { TrafficGenerator } from "./utils/TrafficGenerator.js";

// Convenience exports
export {
  createDefaultLoadTest,
  createDefaultStressTest,
  createDefaultEnduranceTest,
  createDefaultScaleTest,
} from "./defaults.js";

/**
 * Create a default load test configuration
 */
export function createDefaultLoadTest(
  overrides?: Partial<import("./types.js").LoadTestConfig>
): import("./types.js").LoadTestConfig {
  return {
    name: "default_load_test",
    concurrentUsers: 100,
    requestsPerSecond: 1000,
    rampUpDuration: 60000,
    sustainDuration: 300000,
    rampDownDuration: 60000,
    ...overrides,
  };
}

/**
 * Create a default stress test configuration
 */
export function createDefaultStressTest(
  overrides?: Partial<import("./types.js").StressTestConfig>
): import("./types.js").StressTestConfig {
  return {
    name: "default_stress_test",
    maxLoad: 1000,
    spikeMagnitude: 5,
    spikeDuration: 30000,
    recoveryCheck: true,
    recoveryTimeout: 60000,
    loadIncrement: 50,
    incrementInterval: 30000,
    ...overrides,
  };
}

/**
 * Create a default endurance test configuration
 */
export function createDefaultEnduranceTest(
  overrides?: Partial<import("./types.js").EnduranceTestConfig>
): import("./types.js").EnduranceTestConfig {
  return {
    name: "default_endurance_test",
    duration: 3600000, // 1 hour
    sampleInterval: 30000,
    memoryThreshold: 1000, // 1GB
    degradationThreshold: 20, // 20%
    stabilityThreshold: 0.5,
    loadLevel: 50,
    ...overrides,
  };
}

/**
 * Create a default scale test configuration
 */
export function createDefaultScaleTest(
  overrides?: Partial<import("./types.js").ScaleTestConfig>
): import("./types.js").ScaleTestConfig {
  return {
    name: "default_scale_test",
    scaleDirection: "up",
    scaleType: "horizontal",
    maxInstances: 10,
    baselineLoad: 100,
    scaleSteps: 5,
    stepDuration: 60000,
    measureCost: false,
    ...overrides,
  };
}
