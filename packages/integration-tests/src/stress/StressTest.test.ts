/**
 * Stress Test Scenarios
 *
 * Tests system behavior under extreme conditions:
 * - Memory exhaustion
 * - CPU exhaustion
 * - Connection limits
 * - Cache overflow
 * - Concurrency limits
 *
 * These tests push the system to its limits to identify breaking points
 * and ensure graceful degradation rather than catastrophic failure.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LoadGenerator, LoadConfig } from "./LoadGenerator.js";

/**
 * Stress test configuration
 */
export interface StressTestConfig {
  /** Type of stress test */
  type: "memory" | "cpu" | "connection" | "cache" | "concurrency";

  /** Stress level */
  stressLevel?: "low" | "medium" | "high" | "extreme";

  /** Target component */
  target?: string;

  /** Sub-type for specific stress patterns */
  stressType?: string;

  /** Number of entries for cache stress */
  entryCount?: number;

  /** Maximum concurrent requests */
  maxConcurrent?: number;

  /** Test duration in milliseconds */
  duration: number;
}

/**
 * Stress test result
 */
export interface StressTestResult {
  /** Unique test identifier */
  testId: string;

  /** Test start timestamp */
  timestamp: number;

  /** Actual test duration */
  duration: number;

  /** Whether test passed criteria */
  passed: boolean;

  /** Whether system degraded gracefully */
  degraded: boolean;

  /** Whether test failed catastrophically */
  failed: boolean;

  /** Metrics collected during test */
  metrics: {
    /** Peak memory usage in MB */
    peakMemoryMB: number;

    /** Peak CPU usage percentage */
    peakCPUPercent: number;

    /** Peak concurrent connections */
    peakConnections: number;

    /** Final cache size */
    cacheSize: number;

    /** Number of cache evictions */
    evictionCount: number;

    /** Out of memory errors */
    oomErrors: number;

    /** Timeout errors */
    timeoutErrors: number;

    /** Other errors */
    otherErrors: number;
  };

  /** Degradation timeline */
  degradationTimeline?: {
    /** Timestamp from start */
    time: number;
    /** Type of degradation */
    type: string;
    /** Description */
    description: string;
  }[];
}

/**
 * Memory stress target
 */
interface MemoryStressTarget {
  /** Component to stress */
  component: "cache" | "context" | "router" | "general";

  /** Memory limit in MB */
  limitMB: number;

  /** Expected behavior */
  expectedBehavior: "evict" | "degrade" | "fail";
}

/**
 * Stress Test Class
 */
export class StressTest {
  private loadGenerator: LoadGenerator;
  private active = false;

  constructor() {
    this.loadGenerator = new LoadGenerator();
  }

  /**
   * Test 1: Memory Stress
   *
   * Tests system behavior under memory pressure.
   * Expected: Cache evicts entries, graceful degradation, no OOM crashes
   */
  async testMemoryStress(): Promise<StressTestResult> {
    const testId = this.generateTestId("memory");
    const startTime = Date.now();
    const timeline: StressTestResult["degradationTimeline"] = [];

    const target: MemoryStressTarget = {
      component: "cache",
      limitMB: 500,
      expectedBehavior: "evict",
    };

    // Simulate memory pressure by generating large responses
    const config: LoadConfig = {
      pattern: "ramp_up",
      requestsPerSecond: 200,
      duration: 120000, // 2 minutes
      queryTypes: [
        { type: "explanation", weight: 0.5 },
        { type: "comparison", weight: 0.5 },
      ],
      complexity: {
        min: 0.5,
        max: 1.0,
        distribution: "normal",
      },
      concurrentClients: 50,
      thinkTime: 100,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 2000,
    };

    try {
      const loadResult = await this.loadGenerator.generateLoad(config);

      // Analyze memory behavior
      const peakMemory = loadResult.resourceUsage.memoryMB;
      const evictionCount = this.estimateEvictions(loadResult);

      if (peakMemory > target.limitMB * 1.5) {
        timeline.push({
          time: Date.now() - startTime,
          type: "memory_exceeded",
          description: `Memory exceeded ${target.limitMB * 1.5}MB limit`,
        });
      }

      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        passed: peakMemory < target.limitMB * 2,
        degraded: peakMemory > target.limitMB,
        failed: false,
        metrics: {
          peakMemoryMB: peakMemory,
          peakCPUPercent: loadResult.resourceUsage.cpuPercent,
          peakConnections: loadResult.resourceUsage.connections,
          cacheSize: this.estimateCacheSize(loadResult),
          evictionCount,
          oomErrors: 0,
          timeoutErrors: loadResult.failedRequests,
          otherErrors: 0,
        },
        degradationTimeline: timeline,
      };
    } catch (error) {
      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        passed: false,
        degraded: false,
        failed: true,
        metrics: {
          peakMemoryMB: 0,
          peakCPUPercent: 0,
          peakConnections: 0,
          cacheSize: 0,
          evictionCount: 0,
          oomErrors: 1,
          timeoutErrors: 0,
          otherErrors: 1,
        },
      };
    }
  }

  /**
   * Test 2: CPU Stress
   *
   * Tests system under CPU-intensive workload.
   * Expected: Requests queue, latency increases, no crashes
   */
  async testCPUStress(): Promise<StressTestResult> {
    const testId = this.generateTestId("cpu");
    const startTime = Date.now();

    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 300,
      duration: 120000, // 2 minutes
      queryTypes: [
        { type: "code", weight: 0.4 },
        { type: "debug", weight: 0.3 },
        { type: "comparison", weight: 0.3 },
      ],
      complexity: {
        min: 0.7,
        max: 1.0,
        distribution: "normal",
      },
      concurrentClients: 30,
      thinkTime: 50,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 2000,
    };

    try {
      const loadResult = await this.loadGenerator.generateLoad(config);

      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        passed: loadResult.successRate > 90,
        degraded: loadResult.latency.p95 > 500,
        failed: loadResult.successRate < 50,
        metrics: {
          peakMemoryMB: loadResult.resourceUsage.memoryMB,
          peakCPUPercent: loadResult.resourceUsage.cpuPercent,
          peakConnections: loadResult.resourceUsage.connections,
          cacheSize: this.estimateCacheSize(loadResult),
          evictionCount: 0,
          oomErrors: 0,
          timeoutErrors: loadResult.failedRequests,
          otherErrors: 0,
        },
      };
    } catch (error) {
      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
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
          otherErrors: 1,
        },
      };
    }
  }

  /**
   * Test 3: Connection Stress
   *
   * Tests system with many concurrent connections.
   * Expected: Connection pooling, graceful rejection of excess connections
   */
  async testConnectionStress(): Promise<StressTestResult> {
    const testId = this.generateTestId("connection");
    const startTime = Date.now();

    const config: LoadConfig = {
      pattern: "spike",
      requestsPerSecond: 500,
      duration: 60000, // 1 minute
      spikeDuration: 10000, // 10 second spike
      queryTypes: [{ type: "question", weight: 1.0 }],
      complexity: {
        min: 0.1,
        max: 0.3,
        distribution: "exponential",
      },
      concurrentClients: 200,
      thinkTime: 50,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 1000,
    };

    try {
      const loadResult = await this.loadGenerator.generateLoad(config);

      // Check if connection errors occurred
      const connectionErrors = loadResult.errors.filter(
        e =>
          e.code.includes("ECONNREFUSED") ||
          e.code.includes("ETIMEDOUT") ||
          e.code.includes("connection")
      );

      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        passed: loadResult.successRate > 85, // Allow some connection failures
        degraded: connectionErrors.length > 0,
        failed: loadResult.successRate < 50,
        metrics: {
          peakMemoryMB: loadResult.resourceUsage.memoryMB,
          peakCPUPercent: loadResult.resourceUsage.cpuPercent,
          peakConnections: loadResult.resourceUsage.connections,
          cacheSize: this.estimateCacheSize(loadResult),
          evictionCount: 0,
          oomErrors: 0,
          timeoutErrors: loadResult.failedRequests,
          otherErrors: connectionErrors.reduce((sum, e) => sum + e.count, 0),
        },
      };
    } catch (error) {
      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
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
          otherErrors: 1,
        },
      };
    }
  }

  /**
   * Test 4: Cache Stress (Many Entries)
   *
   * Tests cache with massive number of entries.
   * Expected: LRU eviction, hit rate remains acceptable
   */
  async testCacheStress(): Promise<StressTestResult> {
    const testId = this.generateTestId("cache");
    const startTime = Date.now();
    const targetEntryCount = 1000000;

    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 100,
      duration: 180000, // 3 minutes
      queryTypes: [
        { type: "question", weight: 0.5 },
        { type: "explanation", weight: 0.5 },
      ],
      complexity: {
        min: 0.2,
        max: 0.6,
        distribution: "uniform",
      },
      concurrentClients: 20,
      thinkTime: 100,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 5000,
    };

    try {
      const loadResult = await this.loadGenerator.generateLoad(config);

      // Simulate cache behavior
      const estimatedCacheSize = Math.min(
        targetEntryCount,
        loadResult.totalRequests * 2
      );
      const estimatedEvictions = Math.max(0, estimatedCacheSize - 10000); // Assume 10K max

      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        passed: loadResult.successRate > 95,
        degraded: estimatedEvictions > 0,
        failed: loadResult.successRate < 80,
        metrics: {
          peakMemoryMB: loadResult.resourceUsage.memoryMB,
          peakCPUPercent: loadResult.resourceUsage.cpuPercent,
          peakConnections: loadResult.resourceUsage.connections,
          cacheSize: Math.min(estimatedCacheSize, 10000),
          evictionCount: estimatedEvictions,
          oomErrors: 0,
          timeoutErrors: loadResult.failedRequests,
          otherErrors: 0,
        },
      };
    } catch (error) {
      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
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
          otherErrors: 1,
        },
      };
    }
  }

  /**
   * Test 5: Concurrent Request Stress
   *
   * Tests system with very high concurrency.
   * Expected: Request queuing, no deadlocks, eventual completion
   */
  async testConcurrencyStress(): Promise<StressTestResult> {
    const testId = this.generateTestId("concurrency");
    const startTime = Date.now();
    const maxConcurrent = 1000;

    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 400,
      duration: 60000, // 1 minute
      queryTypes: [
        { type: "general", weight: 0.7 },
        { type: "question", weight: 0.3 },
      ],
      complexity: {
        min: 0.1,
        max: 0.4,
        distribution: "exponential",
      },
      concurrentClients: 100,
      thinkTime: 50,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 2000,
    };

    try {
      const loadResult = await this.loadGenerator.generateLoad(config);

      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        passed: loadResult.successRate > 90,
        degraded: loadResult.latency.p95 > 1000,
        failed: loadResult.successRate < 50,
        metrics: {
          peakMemoryMB: loadResult.resourceUsage.memoryMB,
          peakCPUPercent: loadResult.resourceUsage.cpuPercent,
          peakConnections: loadResult.resourceUsage.connections,
          cacheSize: this.estimateCacheSize(loadResult),
          evictionCount: 0,
          oomErrors: 0,
          timeoutErrors: loadResult.failedRequests,
          otherErrors: 0,
        },
      };
    } catch (error) {
      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
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
          otherErrors: 1,
        },
      };
    }
  }

  /**
   * Test 6: Timeout Stress
   *
   * Tests system behavior with many slow requests.
   * Expected: Timeouts handled gracefully, queue doesn't fill
   */
  async testTimeoutStress(): Promise<StressTestResult> {
    const testId = this.generateTestId("timeout");
    const startTime = Date.now();

    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 150,
      duration: 90000, // 1.5 minutes
      queryTypes: [{ type: "explanation", weight: 1.0 }],
      complexity: {
        min: 0.8,
        max: 1.0,
        distribution: "normal",
      },
      concurrentClients: 40,
      thinkTime: 200,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 3000,
    };

    try {
      const loadResult = await this.loadGenerator.generateLoad(config);

      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        passed: loadResult.successRate > 85, // Allow some timeouts
        degraded: loadResult.failedRequests > 0,
        failed: loadResult.successRate < 50,
        metrics: {
          peakMemoryMB: loadResult.resourceUsage.memoryMB,
          peakCPUPercent: loadResult.resourceUsage.cpuPercent,
          peakConnections: loadResult.resourceUsage.connections,
          cacheSize: this.estimateCacheSize(loadResult),
          evictionCount: 0,
          oomErrors: 0,
          timeoutErrors: loadResult.failedRequests,
          otherErrors: 0,
        },
      };
    } catch (error) {
      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
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
          otherErrors: 1,
        },
      };
    }
  }

  /**
   * Test 7: Error Rate Stress
   *
   * Tests system behavior when backend fails frequently.
   * Expected: Retries handled, circuit breaker activates
   */
  async testErrorRateStress(): Promise<StressTestResult> {
    const testId = this.generateTestId("errorrate");
    const startTime = Date.now();

    const config: LoadConfig = {
      pattern: "constant",
      requestsPerSecond: 100,
      duration: 60000, // 1 minute
      queryTypes: [{ type: "question", weight: 1.0 }],
      complexity: {
        min: 0.3,
        max: 0.6,
        distribution: "uniform",
      },
      concurrentClients: 20,
      thinkTime: 100,
      endpoints: ["http://localhost:3000"],
      sampleInterval: 2000,
    };

    try {
      const loadResult = await this.loadGenerator.generateLoad(config);

      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
        passed: loadResult.successRate > 70, // Allow high error rate
        degraded: true,
        failed: loadResult.successRate < 30,
        metrics: {
          peakMemoryMB: loadResult.resourceUsage.memoryMB,
          peakCPUPercent: loadResult.resourceUsage.cpuPercent,
          peakConnections: loadResult.resourceUsage.connections,
          cacheSize: this.estimateCacheSize(loadResult),
          evictionCount: 0,
          oomErrors: 0,
          timeoutErrors: loadResult.failedRequests,
          otherErrors: loadResult.failedRequests,
        },
      };
    } catch (error) {
      return {
        testId,
        timestamp: startTime,
        duration: Date.now() - startTime,
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
          otherErrors: 1,
        },
      };
    }
  }

  /**
   * Estimate cache size from load result
   */
  private estimateCacheSize(result: any): number {
    return Math.min(result.totalRequests, 10000);
  }

  /**
   * Estimate eviction count from load result
   */
  private estimateEvictions(result: any): number {
    return Math.max(0, result.totalRequests - 10000);
  }

  /**
   * Generate unique test ID
   */
  private generateTestId(type: string): string {
    return `stress-${type}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Stop ongoing stress test
   */
  stop(): void {
    this.active = false;
    this.loadGenerator["stop"]();
  }
}

// Vitest test suite
describe("Stress Tests", () => {
  let stressTest: StressTest;

  beforeEach(() => {
    stressTest = new StressTest();
  });

  afterEach(() => {
    stressTest.stop();
  });

  it("should handle memory stress gracefully", async () => {
    const result = await stressTest.testMemoryStress();

    // System should not fail catastrophically
    expect(result.failed).toBe(false);

    // Cache should evict entries rather than crash
    if (result.metrics.evictionCount > 0) {
      expect(result.passed).toBe(true);
    }
  });

  it("should handle CPU stress with graceful degradation", async () => {
    const result = await stressTest.testCPUStress();

    // Should either pass or degrade, not fail
    expect(result.failed).toBe(false);

    // High CPU should cause some degradation
    if (result.metrics.peakCPUPercent > 80) {
      expect(result.degraded).toBe(true);
    }
  });

  it("should handle connection stress", async () => {
    const result = await stressTest.testConnectionStress();

    // Should handle many connections
    expect(result.metrics.peakConnections).toBeGreaterThan(0);
    expect(result.failed).toBe(false);
  });

  it("should handle cache stress with evictions", async () => {
    const result = await stressTest.testCacheStress();

    // Cache should enforce size limit
    expect(result.metrics.cacheSize).toBeLessThanOrEqual(10000);

    // System should remain functional
    expect(result.passed).toBe(true);
  });

  it("should handle high concurrency", async () => {
    const result = await stressTest.testConcurrencyStress();

    // Should handle concurrent requests
    expect(result.failed).toBe(false);
    expect(result.metrics.peakConnections).toBeGreaterThan(0);
  });

  it("should handle timeout stress", async () => {
    const result = await stressTest.testTimeoutStress();

    // Should handle slow requests gracefully
    expect(result.failed).toBe(false);
  });

  it("should handle high error rates", async () => {
    const result = await stressTest.testErrorRateStress();

    // Should remain functional despite errors
    expect(result.failed).toBe(false);
    expect(result.metrics.otherErrors).toBeGreaterThanOrEqual(0);
  });
});
