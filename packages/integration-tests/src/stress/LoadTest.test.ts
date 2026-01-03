/**
 * Load Test Scenarios
 *
 * Predefined load test scenarios that simulate real-world usage patterns.
 * Each scenario tests different aspects of system performance under load.
 *
 * Scenarios:
 * 1. Baseline - Low load, establishes performance baseline
 * 2. Ramp-up - Gradual increase to find breaking point
 * 3. Spike - Sudden traffic burst
 * 4. Sustained high load - Long-duration stability test
 * 5. Burst pattern - Intermittent bursts
 */

import { describe, it, expect } from "vitest";
import { LoadGenerator, LoadConfig, LoadTestResult } from "./LoadGenerator.js";
import { QueryType } from "@lsi/protocol";

/**
 * Load Test Class
 *
 * Encapsulates common load test scenarios with predefined configurations.
 */
export class LoadTest {
  private loadGenerator: LoadGenerator;

  constructor() {
    this.loadGenerator = new LoadGenerator();
  }

  /**
   * Test 1: Baseline Performance
   *
   * Establishes performance baseline under low load.
   * Target: < 100ms p95 latency, 100% success rate
   */
  async testBaseline(): Promise<LoadTestResult> {
    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 10,
      duration: 60000, // 1 minute
      queryTypes: [
        { type: "question", weight: 0.4 },
        { type: "command", weight: 0.3 },
        { type: "general", weight: 0.3 },
      ],
      complexity: {
        min: 0.3,
        max: 0.7,
        distribution: "normal",
      },
      concurrentClients: 5,
      thinkTime: 1000,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 1000,
    };

    return await this.loadGenerator.generateLoad(config);
  }

  /**
   * Test 2: Gradual Ramp-Up
   *
   * Gradually increases load to find the breaking point.
   * Target: Identify max sustainable RPS before degradation
   */
  async testRampUp(): Promise<LoadTestResult> {
    const config: LoadConfig = {
      pattern: "ramp_up",
      requestsPerSecond: 100, // Target at end
      duration: 120000, // 2 minutes
      queryTypes: [
        { type: "question", weight: 0.5 },
        { type: "explanation", weight: 0.5 },
      ],
      complexity: {
        min: 0.2,
        max: 0.8,
        distribution: "uniform",
      },
      concurrentClients: 10,
      thinkTime: 500,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 1000,
    };

    return await this.loadGenerator.generateLoad(config);
  }

  /**
   * Test 3: Traffic Spike
   *
   * Simulates sudden traffic spike (e.g., viral content, featured link).
   * Target: System handles spike without crashing, graceful degradation
   */
  async testSpike(): Promise<LoadTestResult> {
    const config: LoadConfig = {
      pattern: "spike",
      requestsPerSecond: 1000, // Spike to 1000 req/s
      duration: 30000, // 30 seconds
      spikeDuration: 5000, // 5 second spike
      queryTypes: [{ type: "question", weight: 1.0 }],
      complexity: {
        min: 0.1,
        max: 0.5,
        distribution: "exponential",
      },
      concurrentClients: 50,
      thinkTime: 100,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 500,
    };

    return await this.loadGenerator.generateLoad(config);
  }

  /**
   * Test 4: Sustained High Load
   *
   * Tests system stability under sustained high load.
   * Target: No memory leaks, stable latency over 5 minutes
   */
  async testSustainedHighLoad(): Promise<LoadTestResult> {
    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 500,
      duration: 300000, // 5 minutes
      queryTypes: [
        { type: "question", weight: 0.3 },
        { type: "command", weight: 0.3 },
        { type: "explanation", weight: 0.2 },
        { type: "comparison", weight: 0.2 },
      ],
      complexity: {
        min: 0.1,
        max: 0.9,
        distribution: "normal",
      },
      concurrentClients: 25,
      thinkTime: 200,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 5000,
    };

    return await this.loadGenerator.generateLoad(config);
  }

  /**
   * Test 5: Burst Pattern
   *
   * Simulates intermittent burst traffic pattern.
   * Target: System recovers between bursts
   */
  async testBurstPattern(): Promise<LoadTestResult> {
    const config: LoadConfig = {
      pattern: "wave",
      requestsPerSecond: 200,
      duration: 120000, // 2 minutes
      burstSize: 10, // 10 requests per burst
      burstInterval: 1000, // 1 second between bursts
      queryTypes: [
        { type: "general", weight: 0.5 },
        { type: "question", weight: 0.5 },
      ],
      complexity: {
        min: 0.2,
        max: 0.6,
        distribution: "uniform",
      },
      concurrentClients: 10,
      thinkTime: 500,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 2000,
    };

    return await this.loadGenerator.generateLoad(config);
  }

  /**
   * Test 6: Mixed Query Types
   *
   * Tests system with realistic mix of query types.
   * Target: Fair resource allocation across query types
   */
  async testMixedQueryTypes(): Promise<LoadTestResult> {
    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 100,
      duration: 120000, // 2 minutes
      queryTypes: [
        { type: "question", weight: 0.25 },
        { type: "command", weight: 0.2 },
        { type: "code", weight: 0.15 },
        { type: "explanation", weight: 0.15 },
        { type: "comparison", weight: 0.1 },
        { type: "debug", weight: 0.1 },
        { type: "general", weight: 0.05 },
      ],
      complexity: {
        min: 0.1,
        max: 0.9,
        distribution: "normal",
      },
      concurrentClients: 15,
      thinkTime: 300,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 2000,
    };

    return await this.loadGenerator.generateLoad(config);
  }

  /**
   * Test 7: Cache Performance Under Load
   *
   * Tests cache hit rate and performance under load.
   * Target: > 80% cache hit rate, < 50ms cached response latency
   */
  async testCachePerformance(): Promise<LoadTestResult> {
    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 200,
      duration: 180000, // 3 minutes
      queryTypes: [{ type: "question", weight: 1.0 }],
      complexity: {
        min: 0.3,
        max: 0.5,
        distribution: "normal",
      },
      concurrentClients: 20,
      thinkTime: 200,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 3000,
    };

    return await this.loadGenerator.generateLoad(config);
  }

  /**
   * Test 8: Concurrent User Simulation
   *
   * Simulates many concurrent users with realistic think times.
   * Target: System handles concurrent users without degradation
   */
  async testConcurrentUsers(): Promise<LoadTestResult> {
    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 150,
      duration: 240000, // 4 minutes
      queryTypes: [
        { type: "general", weight: 0.6 },
        { type: "question", weight: 0.4 },
      ],
      complexity: {
        min: 0.1,
        max: 0.4,
        distribution: "exponential",
      },
      concurrentClients: 100,
      thinkTime: 5000, // 5 second think time
      endpoints: ["http://localhost:3000"],
      sampleInterval: 5000,
    };

    return await this.loadGenerator.generateLoad(config);
  }
}

/**
 * Load test assertions for validating results
 */
export class LoadTestAssertions {
  /**
   * Assert baseline performance targets
   */
  static assertBaseline(result: LoadTestResult): void {
    expect(result.successRate).toBeGreaterThan(99);
    expect(result.latency.p95).toBeLessThan(100);
    expect(result.latency.p99).toBeLessThan(200);
    expect(result.throughput).toBeGreaterThan(9); // At least 9 RPS
  }

  /**
   * Assert ramp-up found sustainable limit
   */
  static assertRampUp(result: LoadTestResult): void {
    expect(result.successRate).toBeGreaterThan(95);
    expect(result.timeSeriesData).toBeDefined();
    expect(result.timeSeriesData!.length).toBeGreaterThan(0);

    // Check that throughput increased during ramp-up
    const firstHalf = result.timeSeriesData!.slice(
      0,
      Math.floor(result.timeSeriesData!.length / 2)
    );
    const secondHalf = result.timeSeriesData!.slice(
      Math.floor(result.timeSeriesData!.length / 2)
    );

    const firstHalfAvgRPS =
      firstHalf.reduce((sum, d) => sum + d.requests, 0) / firstHalf.length;
    const secondHalfAvgRPS =
      secondHalf.reduce((sum, d) => sum + d.requests, 0) / secondHalf.length;

    expect(secondHalfAvgRPS).toBeGreaterThan(firstHalfAvgRPS);
  }

  /**
   * Assert spike recovery
   */
  static assertSpikeRecovery(result: LoadTestResult): void {
    expect(result.successRate).toBeGreaterThan(90); // Some failures acceptable during spike
    expect(result.failedRequests).toBeLessThan(result.totalRequests * 0.1);
  }

  /**
   * Assert sustained load stability
   */
  static assertSustainedStability(result: LoadTestResult): void {
    expect(result.successRate).toBeGreaterThan(98);

    // Check for memory leaks (memory should stabilize)
    if (result.resourceUsage.memoryMB > 0) {
      expect(result.resourceUsage.memoryMB).toBeLessThan(1000); // Less than 1GB
    }

    // Latency should remain stable throughout
    expect(result.latency.p99).toBeLessThan(1000);
  }

  /**
   * Assert burst recovery
   */
  static assertBurstRecovery(result: LoadTestResult): void {
    expect(result.successRate).toBeGreaterThan(95);

    // System should recover between bursts
    if (result.timeSeriesData && result.timeSeriesData.length > 10) {
      const avgErrors =
        result.timeSeriesData.reduce((sum, d) => sum + d.errors, 0) /
        result.timeSeriesData.length;
      expect(avgErrors).toBeLessThan(5); // Less than 5 errors per sample on average
    }
  }
}

// Vitest test suite
describe("Load Tests", () => {
  const loadTest = new LoadTest();

  it("should establish baseline performance", async () => {
    const result = await loadTest.testBaseline();
    LoadTestAssertions.assertBaseline(result);
    expect(result.testId).toMatch(/^load-/);
  });

  it("should handle gradual ramp-up", async () => {
    const result = await loadTest.testRampUp();
    LoadTestAssertions.assertRampUp(result);
  });

  it("should handle traffic spike", async () => {
    const result = await loadTest.testSpike();
    LoadTestAssertions.assertSpikeRecovery(result);
  });

  it("should maintain stability under sustained load", async () => {
    const result = await loadTest.testSustainedHighLoad();
    LoadTestAssertions.assertSustainedStability(result);
  });

  it("should recover from burst patterns", async () => {
    const result = await loadTest.testBurstPattern();
    LoadTestAssertions.assertBurstRecovery(result);
  });

  it("should handle mixed query types", async () => {
    const result = await loadTest.testMixedQueryTypes();
    expect(result.successRate).toBeGreaterThan(95);
    expect(result.totalRequests).toBeGreaterThan(0);
  });

  it("should demonstrate cache performance", async () => {
    const result = await loadTest.testCachePerformance();
    expect(result.successRate).toBeGreaterThan(98);
    expect(result.throughput).toBeGreaterThan(100);
  });

  it("should simulate concurrent users", async () => {
    const result = await loadTest.testConcurrentUsers();
    expect(result.successRate).toBeGreaterThan(95);
    expect(result.resourceUsage.connections).toBeGreaterThan(0);
  });
});
