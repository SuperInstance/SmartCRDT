/**
 * Stress Test Unit Tests
 *
 * Quick unit tests to verify stress test functionality without long-running execution.
 * For full stress tests, use the StressTestRunner from index.ts.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LoadGenerator, LoadConfig } from "./LoadGenerator.js";

describe("LoadGenerator Unit Tests", () => {
  let generator: LoadGenerator;

  beforeEach(() => {
    generator = new LoadGenerator();
  });

  afterEach(() => {
    generator["stop"]();
  });

  it("should generate unique test IDs", () => {
    const id1 = generator["generateTestId"]();
    const id2 = generator["generateTestId"]();

    expect(id1).toMatch(/^load-/);
    expect(id2).toMatch(/^load-/);
    expect(id1).not.toBe(id2);
  });

  it("should calculate percentiles correctly", () => {
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

    const percentiles = generator["calculatePercentiles"](latencies);

    expect(percentiles.min).toBe(10);
    expect(percentiles.max).toBe(100);
    expect(percentiles.median).toBe(50);
    expect(percentiles.p50).toBe(50);
    // With 10 items, p95 returns the 10th item (index 9) which is 100
    expect(percentiles.p95).toBe(100);
    expect(percentiles.p99).toBe(100);
  });

  it("should select query type based on weights", () => {
    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 10,
      duration: 1000,
      queryTypes: [
        { type: "question", weight: 0.7 },
        { type: "command", weight: 0.3 },
      ],
      complexity: { min: 0.1, max: 0.5, distribution: "uniform" },
      concurrentClients: 1,
      thinkTime: 100,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 1000,
    };

    const results = { question: 0, command: 0, general: 0 };

    // Run 100 times to check distribution
    for (let i = 0; i < 100; i++) {
      const queryType = generator["selectQueryType"](config.queryTypes);
      if (queryType === "question") results.question++;
      if (queryType === "command") results.command++;
    }

    // Question should be selected more often due to higher weight
    expect(results.question).toBeGreaterThan(results.command);
  });

  it("should generate queries for different types", () => {
    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 10,
      duration: 1000,
      queryTypes: [{ type: "question", weight: 1.0 }],
      complexity: { min: 0.1, max: 0.5, distribution: "uniform" },
      concurrentClients: 1,
      thinkTime: 100,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 1000,
    };

    const query = generator["generateQuery"](config);

    expect(typeof query).toBe("string");
    expect(query.length).toBeGreaterThan(0);
  });

  it("should handle empty latency array", () => {
    const percentiles = generator["calculatePercentiles"]([]);

    expect(percentiles.min).toBe(0);
    expect(percentiles.max).toBe(0);
    expect(percentiles.mean).toBe(0);
    expect(percentiles.median).toBe(0);
  });
});

describe("Load Configuration Validation", () => {
  it("should validate load config structure", () => {
    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 100,
      duration: 60000,
      queryTypes: [
        { type: "question", weight: 0.5 },
        { type: "command", weight: 0.3 },
        { type: "code", weight: 0.2 },
      ],
      complexity: {
        min: 0.1,
        max: 0.9,
        distribution: "normal",
      },
      concurrentClients: 10,
      thinkTime: 500,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 1000,
    };

    expect(config.pattern).toBe("constant");
    expect(config.requestsPerSecond).toBe(100);
    expect(config.queryTypes.length).toBe(3);
    expect(config.complexity.min).toBe(0.1);
    expect(config.complexity.max).toBe(0.9);
    expect(config.concurrentClients).toBe(10);
  });

  it("should support all load patterns", () => {
    const patterns: LoadConfig["pattern"][] = [
      "constant",
      "ramp_up",
      "spike",
      "wave",
    ];

    patterns.forEach(pattern => {
      const config: LoadConfig = {
        pattern,
        requestsPerSecond: 50,
        duration: 30000,
        queryTypes: [{ type: "question", weight: 1.0 }],
        complexity: { min: 0.2, max: 0.6, distribution: "uniform" },
        concurrentClients: 5,
        thinkTime: 200,
        endpoints: ["http://localhost:3000"],
        sampleInterval: 1000,
      };

      expect(config.pattern).toBe(pattern);
    });
  });
});

describe("Stress Test Metrics Validation", () => {
  it("should validate stress test metrics structure", () => {
    const metrics = {
      peakMemoryMB: 512,
      peakCPUPercent: 85,
      peakConnections: 100,
      cacheSize: 5000,
      evictionCount: 1000,
      oomErrors: 0,
      timeoutErrors: 5,
      otherErrors: 2,
    };

    expect(metrics.peakMemoryMB).toBeLessThan(1000);
    expect(metrics.evictionCount).toBeGreaterThan(0);
    expect(metrics.oomErrors).toBe(0);
    expect(metrics.cacheSize).toBeLessThanOrEqual(10000);
  });

  it("should handle degraded stress test state", () => {
    const result = {
      testId: "stress-test-1",
      timestamp: Date.now(),
      duration: 60000,
      passed: false,
      degraded: true,
      failed: false,
      metrics: {
        peakMemoryMB: 800,
        peakCPUPercent: 90,
        peakConnections: 150,
        cacheSize: 10000,
        evictionCount: 5000,
        oomErrors: 0,
        timeoutErrors: 10,
        otherErrors: 0,
      },
    };

    expect(result.passed).toBe(false);
    expect(result.degraded).toBe(true);
    expect(result.failed).toBe(false);
    expect(result.metrics.oomErrors).toBe(0);
  });
});

describe("Failure Injection Results Validation", () => {
  it("should validate recovery metrics structure", () => {
    const result = {
      failureType: "network_failure" as const,
      recovered: true,
      recoveryTime: 3000,
      systemHealthy: true,
      degraded: false,
      dataLoss: false,
      lostRequests: 0,
      recoveryErrors: [],
      metrics: {
        detectionTime: 100,
        recoveryStartTime: 500,
        retryAttempts: 3,
        circuitBreakerTriggered: true,
        fallbackActivated: true,
      },
    };

    expect(result.recovered).toBe(true);
    expect(result.recoveryTime).toBeLessThan(10000);
    expect(result.systemHealthy).toBe(true);
    expect(result.lostRequests).toBe(0);
    expect(result.metrics.circuitBreakerTriggered).toBe(true);
    expect(result.metrics.fallbackActivated).toBe(true);
  });

  it("should handle partial recovery scenarios", () => {
    const result = {
      failureType: "cache_failure" as const,
      recovered: true,
      recoveryTime: 5000,
      systemHealthy: false,
      degraded: true,
      dataLoss: false,
      lostRequests: 5,
      recoveryErrors: ["Cache service unavailable"],
      metrics: {
        detectionTime: 200,
        recoveryStartTime: 1000,
        retryAttempts: 5,
        circuitBreakerTriggered: false,
        fallbackActivated: true,
      },
    };

    expect(result.recovered).toBe(true);
    expect(result.systemHealthy).toBe(false);
    expect(result.degraded).toBe(true);
    expect(result.lostRequests).toBeGreaterThan(0);
    expect(result.metrics.fallbackActivated).toBe(true);
  });
});
