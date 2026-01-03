/**
 * Stress Test Suite Runner
 *
 * Orchestrates running all stress and load tests in sequence,
 * collecting results, and generating reports.
 */

import { LoadTest, LoadTestResult } from "./LoadTest.js";
import { StressTest, StressTestResult } from "./StressTest.js";
import { RecoveryTestSuite, RecoveryResult } from "./FailureInjection.js";

/**
 * Test suite result
 */
export interface TestSuiteResult {
  /** Suite name */
  suite: string;

  /** Test name */
  test: string;

  /** Whether test passed */
  passed: boolean;

  /** Test duration in milliseconds */
  duration: number;

  /** Result object */
  result: LoadTestResult | StressTestResult | RecoveryResult;
}

/**
 * Complete test run report
 */
export interface StressTestReport {
  /** Run ID */
  runId: string;

  /** Start timestamp */
  startTime: number;

  /** End timestamp */
  endTime: number;

  /** Total duration */
  duration: number;

  /** All test results */
  results: TestSuiteResult[];

  /** Summary statistics */
  summary: {
    /** Total tests run */
    totalTests: number;

    /** Tests passed */
    passed: number;

    /** Tests failed */
    failed: number;

    /** Pass rate */
    passRate: number;

    /** Total requests across all load tests */
    totalRequests: number;

    /** Peak memory across all tests */
    peakMemoryMB: number;

    /** Peak CPU across all tests */
    peakCPUPercent: number;
  };
}

/**
 * Test runner configuration
 */
export interface TestRunnerConfig {
  /** Which suites to run */
  suites: ("load" | "stress" | "failure")[];

  /** Specific tests to run (optional, runs all if not specified) */
  tests?: string[];

  /** Whether to stop on first failure */
  stopOnFailure: boolean;

  /** Timeout for each test in milliseconds */
  testTimeout: number;

  /** Output format */
  outputFormat: "json" | "text" | "both";
}

/**
 * Stress Test Suite Runner
 */
export class StressTestRunner {
  private loadTest: LoadTest;
  private stressTest: StressTest;
  private recoverySuite: RecoveryTestSuite;

  constructor() {
    this.loadTest = new LoadTest();
    this.stressTest = new StressTest();
    this.recoverySuite = new RecoveryTestSuite();
  }

  /**
   * Run all configured test suites
   */
  async run(
    config: TestRunnerConfig = {
      suites: ["load", "stress", "failure"],
      stopOnFailure: false,
      testTimeout: 300000,
      outputFormat: "both",
    }
  ): Promise<StressTestReport> {
    const runId = this.generateRunId();
    const startTime = Date.now();
    const results: TestSuiteResult[] = [];

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Stress Test Run: ${runId}`);
    console.log(`Started: ${new Date(startTime).toISOString()}`);
    console.log(`${"=".repeat(60)}\n`);

    // Run Load Tests
    if (config.suites.includes("load")) {
      const loadResults = await this.runLoadTests(config);
      results.push(...loadResults);
    }

    // Run Stress Tests
    if (config.suites.includes("stress")) {
      const stressResults = await this.runStressTests(config);
      results.push(...stressResults);
    }

    // Run Failure Injection Tests
    if (config.suites.includes("failure")) {
      const failureResults = await this.runFailureTests(config);
      results.push(...failureResults);
    }

    const endTime = Date.now();

    // Generate report
    const report = this.generateReport(runId, startTime, endTime, results);

    // Print report
    this.printReport(report, config.outputFormat);

    return report;
  }

  /**
   * Run all load tests
   */
  private async runLoadTests(
    config: TestRunnerConfig
  ): Promise<TestSuiteResult[]> {
    const results: TestSuiteResult[] = [];
    const tests = [
      { name: "Baseline", fn: () => this.loadTest.testBaseline() },
      { name: "Ramp-up", fn: () => this.loadTest.testRampUp() },
      { name: "Spike", fn: () => this.loadTest.testSpike() },
      {
        name: "Sustained High Load",
        fn: () => this.loadTest.testSustainedHighLoad(),
      },
      { name: "Burst Pattern", fn: () => this.loadTest.testBurstPattern() },
      {
        name: "Mixed Query Types",
        fn: () => this.loadTest.testMixedQueryTypes(),
      },
      {
        name: "Cache Performance",
        fn: () => this.loadTest.testCachePerformance(),
      },
      {
        name: "Concurrent Users",
        fn: () => this.loadTest.testConcurrentUsers(),
      },
    ];

    console.log("\n📊 Running Load Tests...");

    for (const test of tests) {
      if (config.tests && !config.tests.includes(test.name)) {
        continue;
      }

      console.log(`\n  Running: ${test.name}...`);
      const startTime = Date.now();

      try {
        const result = await this.withTimeout(test.fn(), config.testTimeout);
        const duration = Date.now() - startTime;

        // Determine if test passed based on success rate
        const passed = result.successRate > 95;

        results.push({
          suite: "load",
          test: test.name,
          passed,
          duration,
          result,
        });

        console.log(
          `  ✅ ${test.name}: ${passed ? "PASSED" : "FAILED"} (${duration}ms)`
        );
        console.log(`     Success Rate: ${result.successRate.toFixed(2)}%`);
        console.log(`     P95 Latency: ${result.latency.p95.toFixed(2)}ms`);
        console.log(`     Throughput: ${result.throughput.toFixed(2)} req/s`);

        if (config.stopOnFailure && !passed) {
          console.log(`\n  Stopping due to failure...`);
          break;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          suite: "load",
          test: test.name,
          passed: false,
          duration,
          result: {
            testId: "error",
            timestamp: startTime,
            duration,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            successRate: 0,
            latency: {
              min: 0,
              max: 0,
              mean: 0,
              median: 0,
              p50: 0,
              p95: 0,
              p99: 0,
              p999: 0,
            },
            throughput: 0,
            errors: [],
            resourceUsage: { memoryMB: 0, cpuPercent: 0, connections: 0 },
          },
        });
        console.log(`  ❌ ${test.name}: ERROR - ${error}`);

        if (config.stopOnFailure) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Run all stress tests
   */
  private async runStressTests(
    config: TestRunnerConfig
  ): Promise<TestSuiteResult[]> {
    const results: TestSuiteResult[] = [];
    const tests = [
      { name: "Memory Stress", fn: () => this.stressTest.testMemoryStress() },
      { name: "CPU Stress", fn: () => this.stressTest.testCPUStress() },
      {
        name: "Connection Stress",
        fn: () => this.stressTest.testConnectionStress(),
      },
      { name: "Cache Stress", fn: () => this.stressTest.testCacheStress() },
      {
        name: "Concurrency Stress",
        fn: () => this.stressTest.testConcurrencyStress(),
      },
      { name: "Timeout Stress", fn: () => this.stressTest.testTimeoutStress() },
      {
        name: "Error Rate Stress",
        fn: () => this.stressTest.testErrorRateStress(),
      },
    ];

    console.log("\n🔥 Running Stress Tests...");

    for (const test of tests) {
      if (config.tests && !config.tests.includes(test.name)) {
        continue;
      }

      console.log(`\n  Running: ${test.name}...`);
      const startTime = Date.now();

      try {
        const result = await this.withTimeout(test.fn(), config.testTimeout);
        const duration = Date.now() - startTime;

        results.push({
          suite: "stress",
          test: test.name,
          passed: result.passed,
          duration,
          result,
        });

        console.log(
          `  ${result.passed ? "✅" : result.degraded ? "⚠️" : "❌"} ${test.name}: ${result.passed ? "PASSED" : result.degraded ? "DEGRADED" : "FAILED"} (${duration}ms)`
        );
        console.log(
          `     Peak Memory: ${result.metrics.peakMemoryMB.toFixed(2)}MB`
        );
        console.log(
          `     Peak CPU: ${result.metrics.peakCPUPercent.toFixed(2)}%`
        );
        console.log(`     Timeout Errors: ${result.metrics.timeoutErrors}`);

        if (config.stopOnFailure && result.failed) {
          console.log(`\n  Stopping due to failure...`);
          break;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          suite: "stress",
          test: test.name,
          passed: false,
          duration,
          result: {
            testId: "error",
            timestamp: startTime,
            duration,
            passed: false,
            degraded: false,
            failed: true,
            metrics: {
              peakMemoryMB: 0,
              peakCPUPercent: 0,
              peakConnections: 0,
              cacheSize: 0,
              evictionCount: 0,
              oomErrors: 0,
              timeoutErrors: 0,
              otherErrors: 0,
            },
          },
        });
        console.log(`  ❌ ${test.name}: ERROR - ${error}`);

        if (config.stopOnFailure) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Run failure injection tests
   */
  private async runFailureTests(
    config: TestRunnerConfig
  ): Promise<TestSuiteResult[]> {
    const results: TestSuiteResult[] = [];
    const tests = [
      {
        name: "Network Failure Recovery",
        fn: () => this.recoverySuite.testNetworkFailureRecovery(),
      },
      {
        name: "Memory Exhaustion Recovery",
        fn: () => this.recoverySuite.testMemoryExhaustionRecovery(),
      },
      {
        name: "CPU Exhaustion Recovery",
        fn: () => this.recoverySuite.testCPUExhaustionRecovery(),
      },
      {
        name: "Database Failure Recovery",
        fn: () => this.recoverySuite.testDatabaseFailureRecovery(),
      },
      {
        name: "Cache Failure Recovery",
        fn: () => this.recoverySuite.testCacheFailureRecovery(),
      },
      {
        name: "Process Crash Recovery",
        fn: () => this.recoverySuite.testProcessCrashRecovery(),
      },
      {
        name: "Disk Failure Recovery",
        fn: () => this.recoverySuite.testDiskFailureRecovery(),
      },
    ];

    console.log("\n💉 Running Failure Injection Tests...");

    for (const test of tests) {
      if (config.tests && !config.tests.includes(test.name)) {
        continue;
      }

      console.log(`\n  Running: ${test.name}...`);
      const startTime = Date.now();

      try {
        const result = await this.withTimeout(test.fn(), config.testTimeout);
        const duration = Date.now() - startTime;

        results.push({
          suite: "failure",
          test: test.name,
          passed: result.recovered,
          duration,
          result,
        });

        console.log(
          `  ${result.recovered ? "✅" : "⚠️"} ${test.name}: ${result.recovered ? "RECOVERED" : "NOT RECOVERED"} (${duration}ms)`
        );
        console.log(`     Recovery Time: ${result.recoveryTime}ms`);
        console.log(`     System Healthy: ${result.systemHealthy}`);
        console.log(`     Lost Requests: ${result.lostRequests}`);

        if (config.stopOnFailure && !result.recovered) {
          console.log(`\n  Stopping due to failure...`);
          break;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        results.push({
          suite: "failure",
          test: test.name,
          passed: false,
          duration,
          result: {
            failureType: "network_failure",
            recovered: false,
            recoveryTime: duration,
            systemHealthy: false,
            degraded: true,
            dataLoss: true,
            lostRequests: 0,
            recoveryErrors: [String(error)],
            metrics: {
              detectionTime: 0,
              recoveryStartTime: 0,
              retryAttempts: 0,
              circuitBreakerTriggered: false,
              fallbackActivated: false,
            },
          },
        });
        console.log(`  ❌ ${test.name}: ERROR - ${error}`);

        if (config.stopOnFailure) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Generate comprehensive report
   */
  private generateReport(
    runId: string,
    startTime: number,
    endTime: number,
    results: TestSuiteResult[]
  ): StressTestReport {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    // Calculate aggregate metrics
    let totalRequests = 0;
    let peakMemory = 0;
    let peakCPU = 0;

    for (const result of results) {
      if (result.suite === "load") {
        const lr = result.result as LoadTestResult;
        totalRequests += lr.totalRequests;
        peakMemory = Math.max(peakMemory, lr.resourceUsage.memoryMB);
        peakCPU = Math.max(peakCPU, lr.resourceUsage.cpuPercent);
      } else if (result.suite === "stress") {
        const sr = result.result as StressTestResult;
        peakMemory = Math.max(peakMemory, sr.metrics.peakMemoryMB);
        peakCPU = Math.max(peakCPU, sr.metrics.peakCPUPercent);
      }
    }

    return {
      runId,
      startTime,
      endTime,
      duration: endTime - startTime,
      results,
      summary: {
        totalTests: results.length,
        passed,
        failed,
        passRate: (passed / results.length) * 100,
        totalRequests,
        peakMemoryMB: peakMemory,
        peakCPUPercent: peakCPU,
      },
    };
  }

  /**
   * Print report to console
   */
  private printReport(
    report: StressTestReport,
    format: "json" | "text" | "both"
  ): void {
    if (format === "json" || format === "both") {
      console.log("\n" + "=".repeat(60));
      console.log("JSON Report:");
      console.log(JSON.stringify(report, null, 2));
    }

    if (format === "text" || format === "both") {
      console.log("\n" + "=".repeat(60));
      console.log("STRESS TEST REPORT");
      console.log("=".repeat(60));
      console.log(`Run ID: ${report.runId}`);
      console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
      console.log(``);
      console.log("SUMMARY:");
      console.log(`  Total Tests: ${report.summary.totalTests}`);
      console.log(`  Passed: ${report.summary.passed} ✅`);
      console.log(`  Failed: ${report.summary.failed} ❌`);
      console.log(`  Pass Rate: ${report.summary.passRate.toFixed(2)}%`);
      console.log(``);
      console.log("RESOURCE USAGE:");
      console.log(`  Total Requests: ${report.summary.totalRequests}`);
      console.log(`  Peak Memory: ${report.summary.peakMemoryMB.toFixed(2)}MB`);
      console.log(`  Peak CPU: ${report.summary.peakCPUPercent.toFixed(2)}%`);
      console.log(``);
      console.log("DETAILED RESULTS:");

      for (const result of report.results) {
        const status = result.passed ? "✅ PASS" : "⚠️ DEGRADED";
        console.log(
          `  [${result.suite.toUpperCase()}] ${result.test}: ${status} (${result.duration}ms)`
        );
      }

      console.log("=".repeat(60) + "\n");
    }
  }

  /**
   * Wrap function with timeout
   */
  private async withTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Test timeout after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
  }

  /**
   * Generate unique run ID
   */
  private generateRunId(): string {
    return `stress-run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stressTest.stop();
    this.recoverySuite.cleanup();
  }
}

/**
 * Quick run function for default configuration
 */
export async function runStressTests(): Promise<StressTestReport> {
  const runner = new StressTestRunner();
  try {
    return await runner.run();
  } finally {
    runner.cleanup();
  }
}

/**
 * Run only load tests
 */
export async function runLoadTests(): Promise<StressTestReport> {
  const runner = new StressTestRunner();
  try {
    return await runner.run({
      suites: ["load"],
      stopOnFailure: false,
      testTimeout: 300000,
      outputFormat: "both",
    });
  } finally {
    runner.cleanup();
  }
}

/**
 * Run only stress tests
 */
export async function runStressTestsOnly(): Promise<StressTestReport> {
  const runner = new StressTestRunner();
  try {
    return await runner.run({
      suites: ["stress"],
      stopOnFailure: false,
      testTimeout: 300000,
      outputFormat: "both",
    });
  } finally {
    runner.cleanup();
  }
}

/**
 * Run only failure injection tests
 */
export async function runFailureTests(): Promise<StressTestReport> {
  const runner = new StressTestRunner();
  try {
    return await runner.run({
      suites: ["failure"],
      stopOnFailure: false,
      testTimeout: 300000,
      outputFormat: "both",
    });
  } finally {
    runner.cleanup();
  }
}

// Export all types and classes
export * from "./LoadGenerator.js";
export * from "./LoadTest.js";
export * from "./StressTest.js";
export * from "./FailureInjection.js";
